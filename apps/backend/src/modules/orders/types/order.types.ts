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
  subtotal: number;
  tax: number;
  discountAmount: number;
  packingCharge: number;
  deliveryCharge: number;
  receiptSnapshot?: ReceiptSnapshot;
  paidAt?: string | null;
  paymentVerifiedAt?: string | null;
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  estimatedReadyAt?: string | null;
  readyAt?: string | null;
  collectedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemSnapshot[];
  orderType?: 'takeaway' | 'dining' | string;
  tableNumber?: number | null;
  customerId?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  payment?: any;
}

export interface CheckoutValidationResult {
  isValid: boolean;
  errors: string[];
  validatedItems: OrderItemSnapshot[];
}
