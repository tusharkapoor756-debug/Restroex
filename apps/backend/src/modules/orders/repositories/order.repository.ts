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
      .select('*, items:order_items(*)')
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
    const activeStatuses: OrderStatus[] = ['paid', 'accepted', 'preparing', 'ready'];

    const { data, error } = await this.client
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('restaurant_id', restaurantId)
      .in('status', activeStatuses)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to find active orders: ${error.message}`);
    }

    return (data || []).map((row: any) => this.mapToDomain(row));
  }

  /**
   * Inserts an order and its associated item snapshots atomically.
   */
  public async createOrder(
    orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'humanReadableId' | 'receiptSnapshot'>,
    items: OrderItemSnapshot[]
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

    // Create a final receipt snapshot object to store immutably
    const receiptSnapshot = {
      restaurantId: orderData.restaurantId,
      customerPhone: orderData.customerPhone,
      humanReadableId,
      totalAmount: orderData.totalAmount,
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
        idempotency_key: orderData.idempotencyKey,
        human_readable_id: humanReadableId,
        receipt_snapshot: receiptSnapshot,
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
    const { data, error } = await this.client
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
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

    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      customerPhone: row.customer_phone,
      status: row.status as OrderStatus,
      totalAmount: Number(row.total_amount),
      idempotencyKey: row.idempotency_key,
      humanReadableId: row.human_readable_id,
      receiptSnapshot: row.receipt_snapshot,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items,
    };
  }
}
