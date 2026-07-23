import { db } from '../../../infrastructure/database/database.client';
import { CustomerCart, CartStatus, CartItem } from '../types/cart.types';

export class CartRepository {
  private get client() {
    return db.getClient();
  }

  public async findActiveCart(restaurantId: string, customerPhone: string): Promise<CustomerCart | null> {
    const { data, error } = await this.client
      .from('customer_carts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('customer_phone', customerPhone)
      .in('status', ['active', 'checkout_pending', 'payment_pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to find active cart: ${error.message}`);
    }

    if (!data) return null;
    return this.mapToDomain(data);
  }

  public async createCart(restaurantId: string, customerPhone: string, items: CartItem[] = []): Promise<CustomerCart> {
    const { data, error } = await this.client
      .from('customer_carts')
      .insert({
        restaurant_id: restaurantId,
        customer_phone: customerPhone,
        status: 'active',
        items,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to create cart: ${error.message}`);
    }

    return this.mapToDomain(data);
  }

  public async updateStatus(id: string, status: CartStatus): Promise<void> {
    const { error } = await this.client
      .from('customer_carts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update cart status: ${error.message}`);
    }
  }

  public async updateItems(id: string, items: CartItem[]): Promise<void> {
    const { error } = await this.client
      .from('customer_carts')
      .update({ items, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update cart items: ${error.message}`);
    }
  }

  private mapToDomain(row: any): CustomerCart {
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      customerPhone: row.customer_phone,
      status: row.status as CartStatus,
      items: row.items || [],
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
