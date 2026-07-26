import { Request, Response } from 'express';
import { db } from '../../../infrastructure/database/database.client';

export class CustomerController {
  private get client() {
    return db.getClient();
  }

  public getCustomers = async (req: Request, res: Response): Promise<void> => {
    const restaurantId = String((req as any).restaurantId || '');
    const search = req.query.search ? String(req.query.search).trim() : '';

    // Fetch customers table records
    let customerQuery = this.client
      .from('customers')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (search) {
      customerQuery = customerQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customerRows, error: custError } = await customerQuery;
    if (custError) {
      res.status(500).json({ success: false, error: custError.message });
      return;
    }

    // Fetch orders to calculate real aggregations (total_orders, total_spent, last_order_date)
    const { data: orderRows, error: ordError } = await this.client
      .from('orders')
      .select('customer_phone, total_amount, created_at, status')
      .eq('restaurant_id', restaurantId);

    if (ordError) {
      res.status(500).json({ success: false, error: ordError.message });
      return;
    }

    // Map order metrics by normalized customer phone
    const { normalizePhoneNumber } = require('../../../shared/utils/phone-normalizer');
    const metricsMap = new Map<string, { totalOrders: number; totalSpent: number; lastOrderDate: string; firstOrderDate: string }>();

    (orderRows || []).forEach((ord: any) => {
      const phone = normalizePhoneNumber(ord.customer_phone);
      if (!phone) return;

      const amt = Number(ord.total_amount || 0);
      const date = ord.created_at;
      const current = metricsMap.get(phone) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: date,
        firstOrderDate: date,
      };

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

      metricsMap.set(phone, current);
    });

    const result = (customerRows || []).map((c: any) => {
      const cleanPhone = normalizePhoneNumber(c.phone);
      const stats = metricsMap.get(cleanPhone) || metricsMap.get(c.phone) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: c.created_at,
        firstOrderDate: c.created_at,
      };

      return {
        id: c.id,
        name: c.name || 'WhatsApp Customer',
        phone: c.phone,
        address: c.address,
        totalOrders: stats.totalOrders,
        totalSpent: stats.totalSpent,
        lastOrderDate: stats.lastOrderDate,
        createdAt: c.created_at,
      };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  };
}
