import { Request, Response } from 'express';
import { db } from '../../../infrastructure/database/database.client';
import { whatsappProviderFactory } from '../../whatsapp/providers/whatsapp-provider.factory';
import { redis } from '../../../infrastructure/redis/redis.client';
import { getQueueHealthStatus } from '../../../infrastructure/queue';

export class OperationsController {
  private get client() {
    return db.getClient();
  }

  /**
   * GET /api/v1/operations/hub — Single Optimized Operations Snapshot Endpoint
   * Returns Today's operational KPIs, System Health matrix, Needs Immediate Attention alerts,
   * Today's top selling items, Today's payment snapshot, Today's customer snapshot, and KDS queues.
   */
  public getOperationsHub = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = String((req as any).restaurantId || '');

    // Today's Start Boundary formatted as explicit UTC ISO string (e.g. 2026-08-07T00:00:00.000Z)
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStart = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;

    // 1. Parallel Database & Infrastructure State Queries
    const [
      restaurantRes,
      whatsappProvider,
      todayOrdersRes,
      activeOrdersRes,
      todayPaymentsRes,
      todayCustomersRes,
      conversationsRes,
    ] = await Promise.all([
      this.client.from('restaurants').select('id, name, is_active, settings').eq('id', restaurantId).maybeSingle(),
      whatsappProviderFactory.getProviderForRestaurant(restaurantId).catch(() => null),
      this.client.from('orders').select('*, items:order_items(*)').eq('restaurant_id', restaurantId).gte('created_at', todayStart),
      this.client.from('orders').select('*, items:order_items(*)').eq('restaurant_id', restaurantId).in('status', ['checkout_pending', 'payment_pending', 'paid', 'accepted', 'preparing', 'ready']).order('created_at', { ascending: true }),
      this.client.from('payments').select('*').eq('restaurant_id', restaurantId).gte('created_at', todayStart),
      this.client.from('customers').select('*').eq('restaurant_id', restaurantId).eq('is_merged', false).gte('created_at', todayStart),
      this.client.from('conversation_sessions').select('*').eq('restaurant_id', restaurantId),
    ]);

    // System Health Checks
    const dbStatus = db.getConnectionStatus();
    let redisStatus = 'DISCONNECTED';
    try {
      redisStatus = redis.getClient().status === 'ready' ? 'CONNECTED' : 'DISCONNECTED';
    } catch {
      redisStatus = 'DISCONNECTED';
    }
    const queueStatus = getQueueHealthStatus();

    let whatsappStatus = 'DISCONNECTED';
    if (whatsappProvider) {
      const waStatusObj: any = await whatsappProvider.getStatus(restaurantId).catch(() => null);
      const rawState = String(waStatusObj?.state || waStatusObj?.status || 'DISCONNECTED').toUpperCase();
      whatsappStatus = (rawState === 'CONNECTED' || rawState === 'AUTHENTICATED') ? 'HEALTHY' : 'WARNING';
    }

    const todayPayments = todayPaymentsRes.data || [];
    const todayFailedPayments = todayPayments.filter((p) => p.status === 'FAILED' || p.status === 'failed').length;
    const paymentGatewayStatus = todayFailedPayments > 3 ? 'WARNING' : 'HEALTHY';

    const isStoreOpen = restaurantRes.data?.is_active !== false;
    const storeStatus = isStoreOpen ? 'HEALTHY' : 'OFFLINE';

    const systemHealth = {
      store: { status: storeStatus, isStoreOpen, name: restaurantRes.data?.name || 'Restaurant' },
      whatsApp: { status: whatsappStatus === 'HEALTHY' ? 'HEALTHY' : 'WARNING', gateway: whatsappStatus },
      paymentGateway: { status: paymentGatewayStatus, failedCountToday: todayFailedPayments },
      database: { status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'ERROR' },
      apiBackend: { status: 'HEALTHY' },
      realtimeSync: { status: 'HEALTHY' },
      backgroundQueue: { status: queueStatus === 'CONNECTED' ? 'HEALTHY' : 'WARNING' },
    };

    // ── SECTION 2: TODAY'S LIVE KPIS ──
    const todayOrders = todayOrdersRes.data || [];
    // Only count completed, paid, or ready/preparing orders that are finalized/active as paid revenue
    const isPaid = (s: string) => ['paid', 'completed', 'ready'].includes(s);

    const todayPaidOrders = todayOrders.filter((o) => isPaid(o.status));
    const todayRevenue = todayPaidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const pendingOrdersCount = todayOrders.filter((o) => o.status === 'checkout_pending' || o.status === 'created' || o.status === 'paid' || o.status === 'payment_pending').length;
    const preparingOrdersCount = todayOrders.filter((o) => o.status === 'preparing' || o.status === 'accepted').length;
    const readyOrdersCount = todayOrders.filter((o) => o.status === 'ready').length;
    const cancelledOrdersCount = todayOrders.filter((o) => o.status === 'cancelled').length;
    const completedOrdersCount = todayOrders.filter((o) => o.status === 'completed').length;

    const conversations = conversationsRes.data || [];
    const activeConversationsCount = conversations.filter((c) => new Date(c.last_interaction_at || c.updated_at || c.created_at) >= new Date(todayStart)).length;

    const todayKpis = {
      todayRevenue,
      todayTotalOrders: todayOrders.length,
      pendingOrders: pendingOrdersCount,
      preparingOrders: preparingOrdersCount,
      readyOrders: readyOrdersCount,
      cancelledOrders: cancelledOrdersCount,
      completedOrders: completedOrdersCount,
      activeConversations: activeConversationsCount,
    };

    // ── SECTION 3: NEEDS IMMEDIATE ATTENTION (PROBLEM DETECTOR) ──
    const immediateAttention: Array<{ id: string; severity: 'critical' | 'warning'; title: string; message: string; actionLabel?: string; actionTarget?: string }> = [];

    // Helper to safely parse ISO timestamp strings from Supabase DB into UTC epoch milliseconds.
    // Supabase string timestamps (e.g. "2026-08-07T02:40:00") lack 'Z' suffix, causing JS Date() 
    // to interpret them in local runtime time (IST +5:30), resulting in a +330m offset bug.
    const toUtcMs = (ts?: string | null): number | null => {
      if (!ts) return null;
      const normalized = ts.endsWith('Z') || ts.includes('+') || (ts.includes('-') && ts.lastIndexOf('-') > 7)
        ? ts
        : ts + 'Z';
      return new Date(normalized).getTime();
    };

    // Detector 1: Delayed Cooking Orders (> 20 mins in preparing)
    // Uses dedicated preparing_started_at timestamp to calculate exact cooking duration
    const getPrepStartMs = (o: any): number => {
      const prepStart = toUtcMs(o.preparing_started_at) || toUtcMs(o.accepted_at);
      if (prepStart) return prepStart;
      
      const createdMs = toUtcMs(o.created_at) || now.getTime();
      const todayStartMs = new Date(todayStart).getTime();
      return createdMs >= todayStartMs ? createdMs : now.getTime();
    };

    const delayedPreparing = (activeOrdersRes.data || []).filter((o) => 
      (o.status === 'preparing' || o.status === 'accepted') && 
      (now.getTime() - getPrepStartMs(o)) > 20 * 60 * 1000
    );
    if (delayedPreparing.length > 0) {
      immediateAttention.push({
        id: 'delayed_orders',
        severity: 'critical',
        title: `${delayedPreparing.length} Delayed Order${delayedPreparing.length > 1 ? 's' : ''} in Kitchen`,
        message: `Orders ${delayedPreparing.map((o) => o.human_readable_id || o.id.substring(0, 6)).slice(0, 3).join(', ')} have been in preparation for over 20 minutes!`,
        actionLabel: 'View Kitchen Queue',
        actionTarget: '/dashboard/orders',
      });
    }

    // Detector 2: Pending Acceptance Backlog (> 5 mins in checkout_pending/paid/payment_pending)
    const stuckPending = (activeOrdersRes.data || []).filter((o) => (o.status === 'checkout_pending' || o.status === 'payment_pending' || o.status === 'paid') && (now.getTime() - new Date(o.created_at).getTime()) > 5 * 60 * 1000);
    if (stuckPending.length > 0) {
      immediateAttention.push({
        id: 'stuck_pending',
        severity: 'warning',
        title: `${stuckPending.length} Order${stuckPending.length > 1 ? 's' : ''} Awaiting Kitchen Start`,
        message: `Orders ${stuckPending.map((o) => o.human_readable_id || o.id.substring(0, 6)).slice(0, 3).join(', ')} are waiting for staff acceptance.`,
        actionLabel: 'Accept Now',
        actionTarget: '/dashboard/orders',
      });
    }

    // Detector 3: WhatsApp Gateway Disconnected
    if (systemHealth.whatsApp.status !== 'HEALTHY') {
      immediateAttention.push({
        id: 'wa_disconnected',
        severity: 'critical',
        title: 'WhatsApp Bot Disconnected',
        message: 'WhatsApp automated ordering and notifications are currently offline. Re-connect session immediately.',
        actionLabel: 'Reconnect WhatsApp',
        actionTarget: '/dashboard/whatsapp',
      });
    }

    // Detector 4: Kitchen Overload (> 8 orders preparing simultaneously)
    if (preparingOrdersCount >= 8) {
      immediateAttention.push({
        id: 'kitchen_overload',
        severity: 'warning',
        title: 'Kitchen Overload Warning',
        message: `${preparingOrdersCount} tickets are currently cooking simultaneously in the kitchen.`,
        actionLabel: 'Manage Tickets',
        actionTarget: '/dashboard/orders',
      });
    }

    // Detector 5: Today's High Cancellation Rate
    const cancellationRate = todayOrders.length > 0 ? (cancelledOrdersCount / todayOrders.length) * 100 : 0;
    if (cancellationRate > 15 && todayOrders.length >= 5) {
      immediateAttention.push({
        id: 'high_cancellations',
        severity: 'critical',
        title: 'High Cancellation Rate Alert',
        message: `Today's cancellation rate is ${Math.round(cancellationRate)}% (${cancelledOrdersCount} cancelled out of ${todayOrders.length} orders).`,
      });
    }

    // Detector 6: Payment Failures Today
    if (todayFailedPayments > 0) {
      immediateAttention.push({
        id: 'payment_failures',
        severity: 'warning',
        title: `${todayFailedPayments} Payment Failure${todayFailedPayments > 1 ? 's' : ''} Today`,
        message: 'Customer payments were declined or failed today. Review payment gateway logs.',
        actionLabel: 'View Payments',
        actionTarget: '/dashboard/payments',
      });
    }

    // ── SECTION 4 & 5: LIVE ORDER QUEUE & KITCHEN KDS QUEUES ──
    const activeOrders = (activeOrdersRes.data || []).map((o) => {
      // Calculate elapsed cooking minutes strictly from preparing_started_at
      const prepStart = getPrepStartMs(o);
      const elapsedMins = Math.max(0, Math.floor((now.getTime() - prepStart) / (60 * 1000)));
      return {
        id: o.id,
        humanReadableId: o.human_readable_id || o.id.substring(0, 8),
        customerPhone: o.customer_contact_phone || o.customer_phone || 'Walk-in',
        customerName: o.customer_name || 'Customer',
        status: o.status,
        totalAmount: Number(o.total_amount || 0),
        createdAt: o.created_at,
        elapsedMins,
        isDelayed: (o.status === 'preparing' || o.status === 'accepted') && elapsedMins > 20,
        items: (o.items || []).map((itm: any) => ({
          name: itm.item_name_snapshot || itm.name || 'Menu Item',
          variantName: itm.variant_name_snapshot || undefined,
          quantity: Number(itm.quantity || 1),
          price: Number(itm.total_price || itm.unit_price || 0),
        })),
      };
    });

    const kitchenQueue = {
      waiting: activeOrders.filter((o) => o.status === 'checkout_pending' || o.status === 'accepted' || o.status === 'created'),
      preparing: activeOrders.filter((o) => o.status === 'preparing'),
      ready: activeOrders.filter((o) => o.status === 'ready'),
    };

    // ── SECTION 6: RECENT ACTIVITY TIMELINE ──
    const recentOrdersForFeed = [...todayOrders].sort((a, b) => (toUtcMs(b.created_at) || 0) - (toUtcMs(a.created_at) || 0)).slice(0, 8);
    const recentActivityFeed = recentOrdersForFeed.map((o) => {
      const orderId = o.human_readable_id || o.id.substring(0, 8);
      const utcMs = toUtcMs(o.created_at);
      const timeStr = utcMs
        ? new Date(utcMs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toLowerCase()
        : new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        id: o.id,
        time: timeStr,
        timestamp: o.created_at,
        message: `Order #${orderId} (${o.status.toUpperCase()}) — ₹${o.total_amount || 0}`,
        status: o.status,
      };
    });

    // ── SECTION 8: TODAY'S DETERMINISTIC BUSINESS ALERTS (NO AI) ──
    const businessAlerts: Array<{ type: 'warning' | 'critical' | 'info'; title: string; message: string }> = [];

    if (todayOrders.length === 0) {
      businessAlerts.push({
        type: 'info',
        title: 'No Orders Placed Yet Today',
        message: 'No online or POS orders have been recorded today. Ensure restaurant is listed as Open.',
      });
    }

    if (preparingOrdersCount >= 6) {
      businessAlerts.push({
        type: 'warning',
        title: 'High Kitchen Activity',
        message: `${preparingOrdersCount} orders are actively cooking in the kitchen right now.`,
      });
    }

    if (todayFailedPayments > 0) {
      businessAlerts.push({
        type: 'critical',
        title: 'Gateway Failures Logged',
        message: `${todayFailedPayments} payment transactions failed today. Check gateway logs.`,
      });
    }

    // ── SECTION 9: TODAY'S TOP SELLING ITEMS ──
    const todayItemSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    todayOrders.forEach((ord) => {
      (ord.items || []).forEach((itm: any) => {
        const name = itm.item_name_snapshot || itm.name || 'Menu Item';
        const qty = Number(itm.quantity || 1);
        const price = Number(itm.total_price || itm.unit_price || 0);

        const current = todayItemSalesMap.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += qty;
        current.revenue += isPaid(ord.status) ? price : 0;
        todayItemSalesMap.set(name, current);
      });
    });

    const todayTopSellingItems = Array.from(todayItemSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // ── SECTION 10: TODAY'S PAYMENT SNAPSHOT ──
    const paymentSnapshotByGateway: Record<string, { collected: number; pending: number; failed: number }> = {};
    const paidOrderIds = new Set(todayOrders.filter((o) => isPaid(o.status)).map((o) => o.id));

    todayPayments.forEach((p) => {
      const provider = p.payment_provider || 'manual_upi';
      const current = paymentSnapshotByGateway[provider] || { collected: 0, pending: 0, failed: 0 };
      const amt = Number(p.amount || 0);
      const isPaymentSuccess = p.status === 'SUCCESS' || p.status === 'captured' || p.status === 'paid' || p.status === 'verified';
      const isLinkedOrderPaid = p.order_id && paidOrderIds.has(p.order_id);

      if (isPaymentSuccess || isLinkedOrderPaid) {
        current.collected += amt;
      } else if (p.status === 'FAILED' || p.status === 'failed' || p.status === 'rejected') {
        current.failed += amt;
      } else {
        current.pending += amt;
      }
      paymentSnapshotByGateway[provider] = current;
    });

    // ── SECTION 11: TODAY'S CUSTOMER SNAPSHOT ──
    const todayCustomers = todayCustomersRes.data || [];
    const todayNewCustomersCount = todayCustomers.length;
    const todayRepeatCustomersCount = todayOrders.filter((o) => isPaid(o.status)).length > todayNewCustomersCount ? todayOrders.filter((o) => isPaid(o.status)).length - todayNewCustomersCount : 0;

    const customerSnapshot = {
      todayNewCustomers: todayNewCustomersCount,
      todayReturningCustomers: todayRepeatCustomersCount,
    };

    const responsePayload = {
      success: true,
      data: {
        timestamp: now.toISOString(),
        systemHealth,
        todayKpis,
        immediateAttention,
        activeOrders,
        kitchenQueue,
        recentActivityFeed,
        businessAlerts,
        todayTopSellingItems,
        paymentSnapshotByGateway,
        customerSnapshot,
      },
    };

    console.log('[RUNTIME VERIFICATION] GET /api/v1/operations/hub response:', JSON.stringify(responsePayload, null, 2));

    res.status(200).json(responsePayload);
  };
}
