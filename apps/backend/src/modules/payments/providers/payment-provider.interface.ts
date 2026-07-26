import { CreatePaymentDto, Payment } from '../types/payment.types';
import { ProviderCapabilities } from '../types/provider-capabilities.types';
import { PaymentAnalysisResult, PaymentVerificationContext } from '../types/payment-analysis.types';

// ============================================================
// IPaymentProvider — Strategy Pattern Interface
//
// Every payment gateway (UPI Screenshot, Razorpay, PhonePe, Stripe)
// implements this interface. The Payment Engine delegates to the
// active provider without knowing gateway internals.
// ============================================================
export interface CreatePaymentLinkParams {
  orderId: string;
  restaurantId: string;
  amount: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  description?: string;
  callbackUrl?: string;
  expiresInSeconds?: number;
  metadata?: Record<string, any>;
}

export interface PaymentLinkResponse {
  paymentLinkId: string;
  paymentUrl: string;
  shortUrl?: string;
  status: 'created' | 'active' | 'expired';
  expiresAt?: string;
  rawResponse?: Record<string, any>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event: string;
  paymentId?: string;
  orderId?: string;
  providerTransactionId?: string;
  amount?: number;
  currency?: string;
  status?: 'success' | 'failed' | 'cancelled' | 'expired';
  rawPayload?: any;
}

export interface ProviderHealthCheckResult {
  isHealthy: boolean;
  status: 'connected' | 'invalid_credentials' | 'configuration_error' | 'provider_offline';
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
}

export interface IPaymentProvider {
  /** Unique provider identifier (razorpay, cashfree, phonepe, payu, easebuzz, stripe, manual_upi, cash) */
  readonly providerName: string;

  /** Exposes dynamic feature capabilities for the payment provider */
  getCapabilities(): ProviderCapabilities;

  /**
   * Initializes payment or generates a payment link.
   */
  createPaymentLink(
    params: CreatePaymentLinkParams,
    credentials: Record<string, any>
  ): Promise<PaymentLinkResponse>;

  /**
   * Verifies incoming webhook signature & payload.
   */
  verifyWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult>;

  /**
   * Verifies HMAC/RSA signature explicitly.
   */
  verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Fetches latest transaction state directly from provider API.
   */
  fetchPayment(
    providerTransactionId: string,
    credentials: Record<string, any>
  ): Promise<{
    status: 'success' | 'failed' | 'pending' | 'cancelled';
    amount: number;
    currency: string;
    raw: Record<string, any>;
  }>;

  /**
   * Performs real-time health check & credential validation.
   */
  healthCheck(credentials: Record<string, any>): Promise<ProviderHealthCheckResult>;

  /**
   * Cancels/invalidates an active payment or link.
   */
  cancelPayment?(
    providerPaymentId: string,
    credentials: Record<string, any>
  ): Promise<boolean>;

  /**
   * Refunds a verified payment.
   */
  refundPayment?(
    params: { providerTransactionId: string; amount: number; reason?: string },
    credentials: Record<string, any>
  ): Promise<{ refundId: string; status: string }>;

  /**
   * Legacy payment initiation compatibility
   */
  initiatePayment?(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }>;

  /**
   * Analyzes payment intelligence asynchronously (for OCR/Vision providers).
   */
  analyzePayment?(
    context: PaymentVerificationContext,
    rawInput?: Buffer | string
  ): Promise<PaymentAnalysisResult>;

  /**
   * Verifies a payment from provider-side data.
   */
  verifyPayment?(payment: Payment, verificationData: Record<string, any>): Promise<boolean>;

  /** Returns a human-readable display name */
  getDisplayName(): string;
}
