export interface PaymentEngineConfig {
  /** OCR confidence threshold below which AI Vision is triggered (0-100) */
  ocrConfidenceThreshold: number;
  /** Amount tolerance for currency matching */
  amountTolerance: number;
  /** Fraud Risk Score thresholds for recommended actions */
  riskScoreThresholds: {
    manualReview: number;
    reject: number;
  };
  /** Maximum allowed screenshot upload buffer size in bytes (e.g. 10MB) */
  maxImageSizeBytes: number;
  /** Default timeout for AI Vision fallback calls in milliseconds */
  aiVisionTimeoutMs: number;
  /** Enables short-circuiting on critical duplicate matches */
  enableShortCircuit: boolean;
}

export const defaultPaymentEngineConfig: PaymentEngineConfig = {
  ocrConfidenceThreshold: 80,
  amountTolerance: 0.05,
  riskScoreThresholds: {
    manualReview: 25,
    reject: 70,
  },
  maxImageSizeBytes: 10 * 1024 * 1024, // 10 MB
  aiVisionTimeoutMs: 15000,
  enableShortCircuit: true,
};
