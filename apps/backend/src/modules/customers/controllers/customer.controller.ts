import { Request, Response } from 'express';
import { db } from '../../../infrastructure/database/database.client';
import { BadRequestError, NotFoundError } from '../../../shared/errors/app-error';

export class CustomerController {
  private get client() {
    return db.getClient();
  }

  /**
   * GET /api/v1/customers — Server-side paginated customer list
   */
  public getCustomers = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = String((req as any).restaurantId || '');
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 15;
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const segment = req.query.segment ? String(req.query.segment).trim() : 'all';

    // 1. Query base customers (exclude soft-merged duplicates)
    let customerQuery = this.client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .eq('is_merged', false);

    if (search) {
      customerQuery = customerQuery.or(
        `name.ilike.%${search}%,customer_code.ilike.%${search}%,primary_phone.ilike.%${search}%,phone.ilike.%${search}%,contact_phone.ilike.%${search}%`
      );
    }

    const { data: customerRows, error: custError, count } = await customerQuery;
    if (custError) {
      res.status(500).json({ success: false, error: custError.message });
      return;
    }

    // 2. Fetch order aggregations for this restaurant
    const { data: orderRows } = await this.client
      .from('orders')
      .select('id, customer_id, customer_phone, total_amount, created_at, status')
      .eq('restaurant_id', restaurantId);

    const { normalizePhoneNumber } = require('../../../shared/utils/phone-normalizer');

    // Build metrics map keyed by customer ID & phone
    const metricsMap = new Map<string, { totalOrders: number; totalSpent: number; lastOrderDate: string; firstOrderDate: string }>();

    (orderRows || []).forEach((ord: any) => {
      const keys = [ord.customer_id, ord.customer_phone, normalizePhoneNumber(ord.customer_phone)].filter(Boolean);
      const amt = Number(ord.total_amount || 0);
      const date = ord.created_at;

      keys.forEach((key: string) => {
        const current = metricsMap.get(key) || {
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: date,
          firstOrderDate: date,
        };

        // Avoid double counting if multiple keys match
        if (key === ord.customer_id || (!metricsMap.has(ord.customer_id) && key === ord.customer_phone)) {
          current.totalOrders += 1;
          if (['paid', 'completed', 'accepted', 'preparing', 'ready'].includes(ord.status)) {
            current.totalSpent += amt;
          }
          if (new Date(date) > new Date(current.lastOrderDate)) {
            current.lastOrderDate = date;
          }
          if (new Date(date) < new Date(current.firstOrderDate)) {
            current.firstOrderDate = date;
          }
          metricsMap.set(key, current);
        }
      });
    });

    // 3. Map customer rows — expose customerCode, never expose @lid
    let customersList = (customerRows || []).map((c: any) => {
      // Display phone: prefer primary_phone, fallback contact_phone, never LID
      const displayPhone =
        c.primary_phone ||
        c.contact_phone ||
        (!c.phone?.includes('@lid') && !c.phone?.includes('@s.whatsapp') ? c.phone : null);

      const stats = metricsMap.get(c.id) || metricsMap.get(c.phone) || metricsMap.get(normalizePhoneNumber(c.phone)) || {
        totalOrders: Number(c.total_orders || 0),
        totalSpent: Number(c.total_spend || 0),
        lastOrderDate: c.last_order_at || c.created_at,
        firstOrderDate: c.first_order_at || c.created_at,
      };

      return {
        id: c.id,
        customerCode: c.customer_code || null,
        name: c.name || 'WhatsApp Customer',
        phone: displayPhone || 'Not Available',
        address: c.address || null,
        notes: c.notes || null,
        createdSource: c.created_source || 'WHATSAPP',
        totalOrders: stats.totalOrders,
        totalSpent: stats.totalSpent,
        lastOrderDate: stats.lastOrderDate,
        firstOrderDate: stats.firstOrderDate,
        createdAt: c.created_at,
      };
    });

    // 4. Segment filtering
    if (segment === 'high_value') {
      customersList = customersList.filter((c) => c.totalSpent >= 1000);
    } else if (segment === 'repeat') {
      customersList = customersList.filter((c) => c.totalOrders >= 2);
    }

    const totalCount = segment !== 'all' ? customersList.length : (count || customersList.length);
    const paginatedCustomers = customersList.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      data: paginatedCustomers,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    });
  };

  /**
   * GET /api/v1/customers/:customerId/details — Deep CRM metrics & activity
   */
  public getCustomerDetails = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = String((req as any).restaurantId || '');
    const customerId = String(req.params.customerId || '');

    if (!customerId) throw new BadRequestError('Customer ID is required');

    // 1. Fetch customer row
    const { data: customer, error } = await this.client
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error || !customer) {
      throw new NotFoundError('Customer not found');
    }

    // 2. Fetch all orders for this customer (by customer_id or phone)
    const { normalizePhoneNumber } = require('../../../shared/utils/phone-normalizer');
    const cleanPhone = normalizePhoneNumber(customer.phone) || normalizePhoneNumber(customer.contact_phone);

    let orderQuery = this.client
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (cleanPhone) {
      orderQuery = orderQuery.or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone},customer_phone.ilike.%${cleanPhone}%`);
    } else {
      orderQuery = orderQuery.or(`customer_id.eq.${customer.id},customer_phone.eq.${customer.phone}`);
    }

    const { data: ordersData } = await orderQuery;
    const orders = ordersData || [];

    // Calculate metrics
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) => ['completed', 'paid'].includes(o.status)).length;
    const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
    const lifetimeSpend = orders
      .filter((o) => ['paid', 'completed', 'accepted', 'preparing', 'ready'].includes(o.status))
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const averageOrderValue = completedOrders > 0 ? Math.round(lifetimeSpend / completedOrders) : (totalOrders > 0 ? Math.round(lifetimeSpend / totalOrders) : 0);

    const firstOrder = orders.length > 0 ? orders[orders.length - 1] : null;
    const lastOrder = orders.length > 0 ? orders[0] : null;

    // Top 5 ordered menu items
    const itemMap = new Map<string, { name: string; quantity: number }>();
    orders.forEach((o) => {
      (o.items || []).forEach((item: any) => {
        const name = item.item_name_snapshot || 'Menu Item';
        const qty = Number(item.quantity || 1);
        const current = itemMap.get(name) || { name, quantity: 0 };
        current.quantity += qty;
        itemMap.set(name, current);
      });
    });

    const favouriteItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Recent 10 orders formatted
    const recentOrders = orders.slice(0, 10).map((o) => ({
      id: o.id,
      humanReadableId: o.human_readable_id || o.id.substring(0, 8),
      date: o.created_at,
      status: o.status,
      amount: Number(o.total_amount || 0),
    }));

    // Preferred order source
    const whatsappCount = orders.filter((o) => (o.source || '').toLowerCase().includes('whatsapp')).length;
    const preferredSource = whatsappCount >= orders.length / 2 ? 'WhatsApp' : 'Web App';

    // Format display phone (never expose @lid)
    const displayPhone = customer.contact_phone || (!customer.phone?.includes('@lid') && !customer.phone?.includes('@s.whatsapp') ? customer.phone : null);

    res.status(200).json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          customerCode: customer.customer_code || null,
          name: customer.name || 'WhatsApp Customer',
          phone: displayPhone || 'Not Available',
          address: customer.address || null,
          notes: customer.notes || null,
          createdSource: customer.created_source || 'WHATSAPP',
          isMerged: Boolean(customer.is_merged),
          createdAt: customer.created_at,
        },
        metrics: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          lifetimeSpend,
          averageOrderValue,
          firstOrderDate: firstOrder ? firstOrder.created_at : customer.created_at,
          lastOrderDate: lastOrder ? lastOrder.created_at : customer.created_at,
          segment: totalOrders >= 2 ? 'Repeat Customer' : totalOrders === 1 ? 'Customer' : 'Lead',
        },
        favouriteItems,
        recentOrders,
        activity: {
          lastSeen: lastOrder ? lastOrder.created_at : customer.created_at,
          preferredSource,
        },
      },
    });
  };

  /**
   * PATCH /api/v1/customers/:customerId/notes — Update internal restaurant notes
   */
  public updateCustomerNotes = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = String((req as any).restaurantId || '');
    const customerId = String(req.params.customerId || '');
    const notes = req.body.notes !== undefined ? String(req.body.notes).trim() : '';

    if (!customerId) throw new BadRequestError('Customer ID is required');

    const { data: customer, error } = await this.client
      .from('customers')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error || !customer) {
      throw new NotFoundError('Failed to update customer notes');
    }

    res.status(200).json({
      success: true,
      data: { id: customer.id, notes: customer.notes },
    });
  };
}

