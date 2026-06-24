export type OrderStatus =
  | 'cart_active'
  | 'checkout_pending'
  | 'payment_pending'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface OrderItemSnapshot {
  menuItemId: string;
  itemNameSnapshot: string;
  variantNameSnapshot?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptSnapshotItem {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptSnapshot {
  restaurantId: string;
  customerPhone: string;
  humanReadableId: string;
  totalAmount: number;
  items: ReceiptSnapshotItem[];
  generatedAt: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  idempotencyKey: string;
  humanReadableId: string;
  receiptSnapshot?: ReceiptSnapshot;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemSnapshot[];
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: string[];
  validatedItems: OrderItemSnapshot[];
  totalAmount: number;
}
