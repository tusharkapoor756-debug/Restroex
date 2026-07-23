export type CartStatus =
  | 'active'
  | 'checkout_pending'
  | 'payment_pending'
  | 'order_created'
  | 'abandoned'
  | 'expired'
  | 'completed';

export interface CartItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
}

export interface CustomerCart {
  id: string;
  restaurantId: string;
  customerPhone: string;
  status: CartStatus;
  items: CartItem[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
