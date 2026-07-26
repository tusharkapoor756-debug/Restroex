// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — CONFIGURATION ──────────────────

export interface ReceiptEngineConfig {
  version: string;
  environment: 'development' | 'production' | 'test';
  minImageWidth: number;
  minImageHeight: number;
  highConfidenceThreshold: number;   // >= 90
  reviewConfidenceThreshold: number; // < 70
  maxFraudScoreAllowed: number;       // <= 30
  loggingEnabled: boolean;
}

export const DEFAULT_RECEIPT_ENGINE_CONFIG: ReceiptEngineConfig = {
  version: '2.0.0',
  environment: (process.env.NODE_ENV as any) || 'development',
  minImageWidth: 200,
  minImageHeight: 200,
  highConfidenceThreshold: 90,
  reviewConfidenceThreshold: 70,
  maxFraudScoreAllowed: 30,
  loggingEnabled: true,
};
