// ============================================================
// Universal Payment Types
// Provider-agnostic. Gateway-specific data lives in gateway_data JSONB.
// ============================================================

export type PaymentStatus =
  | 'pending'
  | 'initiated'
  | 'screenshot_uploaded'
  | 'pending_verification'
  | 'verified'
  | 'captured'
  | 'failed'
  | 'rejected'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod =
  | 'manual_upi'
  | 'razorpay'
  | 'phonepe'
  | 'stripe'
  | 'cash'
  | 'card'
  | string; // extensible for future providers

export interface Payment {
  id: string;
  orderId: string;
  restaurantId: string;
  customerPhone: string;

  // Provider classification
  paymentMethod: PaymentMethod;
  providerName: string;
  paymentStatus: PaymentStatus;

  // Financials
  amount: number;
  currency: string;

  // Provider-specific data (opaque to core logic)
  gatewayData: Record<string, any>;

  // Verification workflow
  verifiedBy?: string | null;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  verifiedAmount?: number | null;
  verifiedTransactionReference?: string | null;
  rejectedReason?: string | null;
  failureReason?: string | null;

  // Idempotency
  idempotencyKey?: string | null;

  // Retry tracking
  paymentAttempt: number;

  // Expiry — payment links, gateway sessions
  expiresAt?: string | null;

  // Extensible metadata
  metadata: Record<string, any>;

  // Lifecycle
  initiatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// DTO for creating a new payment record
export interface CreatePaymentDto {
  orderId: string;
  restaurantId: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  providerName: string;
  amount: number;
  currency?: string;
  gatewayData?: Record<string, any>;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

// DTO for updating payment status
export interface UpdatePaymentDto {
  paymentStatus?: PaymentStatus;
  gatewayData?: Record<string, any>;
  metadata?: Record<string, any>;
  verifiedBy?: string;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedAmount?: number;
  verifiedTransactionReference?: string;
  rejectedReason?: string;
  failureReason?: string;
  completedAt?: string;
  failedAt?: string;
  expiresAt?: string;
}
