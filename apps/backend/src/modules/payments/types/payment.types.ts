// ============================================================
// Universal Payment Types
// Provider-agnostic. Gateway-specific data lives in gateway_data JSONB.
// ============================================================

export type PaymentStatus =
  | 'pending'
  | 'link_sent'
  | 'customer_opened'
  | 'processing'
  | 'initiated'
  | 'screenshot_uploaded'
  | 'pending_verification'
  | 'verified'
  | 'captured'
  | 'failed'
  | 'rejected'
  | 'expired'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod =
  | 'manual_upi'
  | 'upi_intent'
  | 'upi_qr'
  | 'payment_link'
  | 'card'
  | 'netbanking'
  | 'razorpay'
  | 'cashfree'
  | 'phonepe'
  | 'payu'
  | 'easebuzz'
  | 'stripe'
  | 'cash'
  | string; // extensible for future providers

export type GatewayConfigStatus =
  | 'connected'
  | 'not_connected'
  | 'configuration_error'
  | 'invalid_credentials'
  | 'webhook_missing'
  | 'provider_offline';

export interface RestaurantPaymentConfig {
  id: string;
  restaurantId: string;
  providerName: string;
  isEnabled: boolean;
  isSandbox: boolean;
  credentials: Record<string, any>;
  status: GatewayConfigStatus;
  statusMessage?: string | null;
  lastHealthCheckAt?: string | null;
  lastHealthCheckResponse?: Record<string, any> | null;
  webhookSecret?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttemptHistory {
  id: string;
  paymentId: string;
  orderId: string;
  attemptNumber: number;
  providerName: string;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentLink?: string | null;
  providerTransactionId?: string | null;
  providerOrderId?: string | null;
  failureReason?: string | null;
  gatewayResponse?: Record<string, any> | null;
  createdAt: string;
  completedAt?: string | null;
}

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

  // Payment Link & Orchestration
  paymentLinkUrl?: string | null;
  paymentLinkShortUrl?: string | null;

  // Universal Provider Fields (Provider-Agnostic)
  providerTransactionId?: string | null;
  providerOrderId?: string | null;
  exactFingerprint?: string | null;
  similarityFingerprint?: string | null;
  imageHash?: string | null;

  // Analysis & Intelligence Audit Logs (Immutable History)
  analysisHistory?: any[];
  attemptsHistory?: PaymentAttemptHistory[];

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
  providerName?: string;
  paymentLinkUrl?: string;
  paymentLinkShortUrl?: string;
  gatewayData?: Record<string, any>;
  metadata?: Record<string, any>;
  providerTransactionId?: string;
  providerOrderId?: string;
  exactFingerprint?: string;
  similarityFingerprint?: string;
  imageHash?: string;
  analysisHistory?: any[];
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

