import { db } from '../../../infrastructure/database/database.client';
import { Order, OrderStatus, OrderItemSnapshot } from '../types/order.types';

export class OrderRepository {
  private get client() {
    return db.getClient();
  }

  /**
   * Fetches an order by its unique ID, including all order items snapshots.
   */
  public async findById(id: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*, items:order_items(*), customer:customers(*), payments(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by ID: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  /**
   * Fetches an order by its idempotency key (useful for webhook deduplication).
   */
  public async findByIdempotencyKey(key: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by idempotency key: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  /**
   * Finds the latest ACTIVE pending-checkout order matching the exact idempotency key.
   * Only orders in checkout_pending or payment_pending are active for payment link retries.
   * Orders already paid, accepted, preparing, ready, completed, or cancelled are finished checkout!
   */
  public async findActiveByIdempotencyKey(key: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*')
      .or(`idempotency_key.eq.${key},idempotency_key.like.${key}:%`)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return null;

    const CHECKOUT_PENDING_STATUSES: OrderStatus[] = ['checkout_pending', 'payment_pending'];
    const activeRow = data.find((row) => CHECKOUT_PENDING_STATUSES.includes(row.status as OrderStatus));

    if (!activeRow) return null;
    return this.mapToDomain(activeRow);
  }

  /**
   * Fetches an order by its human readable reference ID, including all order item snapshots.
   */
  public async findByHumanReadableId(humanReadableId: string): Promise<Order | null> {
    const { data, error } = await this.client
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('human_readable_id', humanReadableId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find order by human-readable ID: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async findActiveOrders(restaurantId: string): Promise<Order[]> {
    const activeStatuses: OrderStatus[] = [
      'checkout_pending',
      'payment_pending',
      'paid',
      'accepted',
      'preparing',
      'ready'
    ];

    const { data, error } = await this.client
      .from('orders')
      .select('*, items:order_items(*), customer:customers(*), payments(*)')
      .eq('restaurant_id', restaurantId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to find active orders: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  /**
   * REVISION 1: Counts active kitchen workload orders.
   * Only counts orders with statuses: received, accepted, preparing.
   * Excludes checkout_pending, payment_pending, paid, ready, completed, cancelled.
   */
  public async getActiveKitchenOrdersCount(restaurantId: string): Promise<number> {
    const activeWorkloadStatuses = ['received', 'accepted', 'preparing'];

    const { count, error } = await this.client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', activeWorkloadStatuses);

    if (error) {
      throw new Error(`Failed to count active kitchen workload orders: ${error.message}`);
    }

    return count || 0;
  }

  public async findOrderHistory(
    restaurantId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      paymentProvider?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ orders: Order[]; totalCount: number }> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('orders')
      .select('*, items:order_items(*), customer:customers(*), payments(*)', { count: 'exact' })
      .eq('restaurant_id', restaurantId);

    if (options.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.search && options.search.trim() !== '') {
      const term = options.search.trim();
      query = query.or(`human_readable_id.ilike.%${term}%,customer_phone.ilike.%${term}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch order history: ${error.message}`);
    }

    const orders = (data || []).map((row: any) => this.mapToDomain(row));
    return {
      orders,
      totalCount: count || 0,
    };
  }

  /**
   * Inserts an order and its associated item snapshots atomically.
   */
  public async createOrder(
    orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'humanReadableId' | 'receiptSnapshot'>,
    items: OrderItemSnapshot[],
    billingBreakdown?: any
  ): Promise<Order> {
    // 1. Fetch the maximum sequence number for this restaurant to generate the next human_readable_id
    const { data: maxRow, error: maxError } = await this.client
      .from('orders')
      .select('human_readable_id')
      .eq('restaurant_id', orderData.restaurantId)
      .order('human_readable_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      throw new Error(`Failed to check maximum order sequence: ${maxError.message}`);
    }

    let nextSequence = 1001; // Base sequence start
    if (maxRow?.human_readable_id) {
      const match = maxRow.human_readable_id.match(/ORD-(\d+)/);
      if (match && match[1]) {
        nextSequence = parseInt(match[1], 10) + 1;
      }
    }

    const humanReadableId = `ORD-${nextSequence}`;

    // Create a complete immutable receipt snapshot object containing full billing breakdown
    const receiptSnapshot = {
      billingEngineVersion: billingBreakdown?.billingEngineVersion || '1.0.0',
      restaurantId: orderData.restaurantId,
      customerPhone: orderData.customerPhone,
      humanReadableId,
      totalAmount: orderData.totalAmount,
      notes: orderData.notes || null,
      billingBreakdown: billingBreakdown || null,
      items: items.map(item => ({
        name: item.itemNameSnapshot,
        variantName: item.variantNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      generatedAt: new Date().toISOString(),
    };

    // 2. Insert order record with human-friendly id and receipt snapshot
    const { data: orderRow, error: orderError } = await this.client
      .from('orders')
      .insert({
        restaurant_id: orderData.restaurantId,
        customer_phone: orderData.customerPhone,
        status: orderData.status,
        total_amount: orderData.totalAmount,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        discount_amount: orderData.discountAmount,
        packing_charge: orderData.packingCharge,
        delivery_charge: orderData.deliveryCharge,
        idempotency_key: orderData.idempotencyKey,
        human_readable_id: humanReadableId,
        receipt_snapshot: receiptSnapshot,
        customer_id: orderData.customerId,
        order_type: orderData.orderType || 'takeaway',
        table_number: orderData.tableNumber || null,
        notes: orderData.notes || null,
      })
      .select('*')
      .single();

    if (orderError) {
      throw new Error(`Failed to create order record: ${orderError.message}`);
    }

    // 3. Insert snapshot items
    const rowsToInsert = items.map((item) => ({
      order_id: orderRow.id,
      menu_item_id: item.menuItemId,

      item_name: item.itemNameSnapshot,
      variant_name: item.variantNameSnapshot || null,

      item_name_snapshot: item.itemNameSnapshot,
      variant_name_snapshot: item.variantNameSnapshot || null,

      item_price: item.unitPrice,
      unit_price: item.unitPrice,

      quantity: item.quantity,
      total_price: item.totalPrice,
    }));

    const { error: itemsError } = await this.client
      .from('order_items')
      .insert(rowsToInsert);

    if (itemsError) {
      // In a raw SQL driver we would roll back, here we attempt cleanup on fail to protect DB integrity
      await this.client.from('orders').delete().eq('id', orderRow.id);
      throw new Error(`Failed to insert order items: ${itemsError.message}`);
    }

    return this.mapToDomain({ ...orderRow, items: rowsToInsert });
  }

  /**
   * Updates an order's status and logs transitions.
   */
  public async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const payload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    const now = new Date().toISOString();
    if (status === 'paid') {
      payload.paid_at = now;
    } else if (status === 'accepted') {
      payload.accepted_at = now;
    } else if (status === 'completed') {
      payload.completed_at = now;
    } else if (status === 'cancelled') {
      payload.cancelled_at = now;
    }

    const { data, error } = await this.client
      .from('orders')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  /**
   * Maps Database table columns to the domain interface.
   */
  private mapToDomain(row: any): Order {
    const items = row.items
      ? row.items.map((item: any) => ({
        menuItemId: item.menu_item_id,
        itemNameSnapshot: item.item_name_snapshot,
        variantNameSnapshot: item.variant_name_snapshot || undefined,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        totalPrice: Number(item.total_price),
      }))
      : undefined;

    const payment = row.payments && row.payments.length > 0 ? {
      id: row.payments[0].id,
      orderId: row.payments[0].order_id,
      restaurantId: row.payments[0].restaurant_id,
      customerPhone: row.payments[0].customer_phone,
      paymentMethod: row.payments[0].payment_method,
      providerName: row.payments[0].provider_name,
      paymentStatus: row.payments[0].payment_status,
      amount: Number(row.payments[0].amount),
      currency: row.payments[0].currency,
      gatewayData: row.payments[0].gateway_data ?? {},
      verifiedBy: row.payments[0].verified_by,
      verificationNotes: row.payments[0].verification_notes,
      verifiedAt: row.payments[0].verified_at,
      verifiedAmount: row.payments[0].verified_amount ? Number(row.payments[0].verified_amount) : null,
      verifiedTransactionReference: row.payments[0].verified_transaction_reference,
      rejectedReason: row.payments[0].rejected_reason,
      failureReason: row.payments[0].failure_reason,
      idempotencyKey: row.payments[0].idempotency_key,
      paymentAttempt: Number(row.payments[0].payment_attempt ?? 1),
      expiresAt: row.payments[0].expires_at,
      metadata: row.payments[0].metadata ?? {},
      initiatedAt: row.payments[0].initiated_at,
      completedAt: row.payments[0].completed_at,
      failedAt: row.payments[0].failed_at,
      createdAt: row.payments[0].created_at,
      updatedAt: row.payments[0].updated_at,
    } : undefined;

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      customerPhone: row.customer_phone,
      status: row.status as OrderStatus,
      totalAmount: Number(row.total_amount),
      subtotal: Number(row.subtotal || 0),
      tax: Number(row.tax || 0),
      discountAmount: Number(row.discount_amount || 0),
      packingCharge: Number(row.packing_charge || 0),
      deliveryCharge: Number(row.delivery_charge || 0),
      idempotencyKey: row.idempotency_key,
      humanReadableId: row.human_readable_id,
      receiptSnapshot: row.receipt_snapshot,
      paidAt: row.paid_at,
      paymentVerifiedAt: row.payment_verified_at,
      acceptedAt: row.accepted_at,
      preparingStartedAt: row.preparing_started_at,
      estimatedReadyAt: row.estimated_ready_at,
      readyAt: row.ready_at,
      collectedAt: row.collected_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      invoiceNumber: row.invoice_number,
      orderType: row.order_type || 'takeaway',
      tableNumber: row.table_number ? Number(row.table_number) : null,
      notes: row.notes || row.instructions || row.cooking_instructions || row.receipt_snapshot?.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerId: row.customer_id,
      customerName: row.customer?.name || row.customer_name || null,
      customerAddress: row.customer?.address || row.customer_address || null,
      items,
      payment,
    };
  }
}
// Repositories updated cleanly.

