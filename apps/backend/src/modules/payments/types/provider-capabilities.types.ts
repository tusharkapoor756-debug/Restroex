export interface ProviderCapabilities {
  /** Supports extracting structured details from payment screenshots */
  supportsOcr: boolean;
  /** Supports instant automatic payment verification */
  supportsAutoVerification: boolean;
  /** Supports programmatic refunds via API */
  supportsRefund: boolean;
  /** Supports incoming webhooks for payment state updates */
  supportsWebhooks: boolean;
  /** Supports manual merchant verification flow */
  supportsManualReview: boolean;
  /** Supports sandbox/test mode operations */
  supportsTestMode: boolean;
}
