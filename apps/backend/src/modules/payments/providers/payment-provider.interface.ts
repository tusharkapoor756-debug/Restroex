import { CreatePaymentDto, Payment, UpdatePaymentDto } from '../types/payment.types';

// ============================================================
// IPaymentProvider — Strategy Pattern Interface
//
// Every payment gateway (Manual UPI, Razorpay, PhonePe, Stripe)
// implements this interface. The PaymentService delegates to the
// active provider without knowing gateway internals.
//
// To add a new gateway:
//   1. Create a new class implementing IPaymentProvider
//   2. Register it in PaymentProviderRegistry
//   3. No other code changes required.
// ============================================================
export interface IPaymentProvider {
  /** Unique provider identifier, must match payment_method values */
  readonly providerName: string;

  /**
   * Initialises a payment with the provider.
   * Returns any provider-specific data to store in gateway_data.
   * For manual providers, this may simply record UPI details.
   * For API gateways, this creates an order/session server-side.
   */
  initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }>;

  /**
   * Verifies a payment from provider-side data.
   * For manual UPI: admin-triggered, returns true.
   * For API gateways: signature verification, webhook reconciliation.
   */
  verifyPayment?(payment: Payment, verificationData: Record<string, any>): Promise<boolean>;

  /**
   * Returns a display name for the customer-facing flow.
   */
  getDisplayName(): string;
}
