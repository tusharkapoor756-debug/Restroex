import { CartRepository } from '../repositories/cart.repository';
import { CustomerCart, CartStatus, CartItem } from '../types/cart.types';

export class CartService {
  private repository = new CartRepository();

  public async getOrCreateActiveCart(restaurantId: string, customerPhone: string): Promise<CustomerCart> {
    const active = await this.repository.findActiveCart(restaurantId, customerPhone);
    if (active) return active;
    return this.repository.createCart(restaurantId, customerPhone);
  }

  public async getActiveCart(restaurantId: string, customerPhone: string): Promise<CustomerCart | null> {
    return this.repository.findActiveCart(restaurantId, customerPhone);
  }

  public async updateItems(cartId: string, items: CartItem[]): Promise<void> {
    await this.repository.updateItems(cartId, items);
  }

  public async updateStatus(cartId: string, status: CartStatus): Promise<void> {
    await this.repository.updateStatus(cartId, status);
  }

  public async abandonCart(cartId: string): Promise<void> {
    await this.repository.updateStatus(cartId, 'abandoned');
  }

  public async completeCart(cartId: string): Promise<void> {
    await this.repository.updateStatus(cartId, 'completed');
  }
}

export const cartService = new CartService();
