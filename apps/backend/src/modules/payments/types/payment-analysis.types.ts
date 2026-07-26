import { PaymentEngineConfig } from '../config/payment-engine.config';
export * from '../engine/config/semantic-ontology.config';
export * from '../engine/types/structured-receipt.schema';
export * from '../engine/intelligence/receipt-grammar.definitions';
export * from '../engine/contracts/receipt-understanding.interface';

export interface FieldConfidence<T> {
  value: T;
  confidence: number; // 0 - 100
  source?: 'local_ocr' | 'ai_vision' | 'rule_engine' | 'default';
}

export interface ExtractedPaymentDetails {
  amount: FieldConfidence<number | null>;
  currency: FieldConfidence<string>;
  upiReference: FieldConfidence<string | null>;
  transactionId: FieldConfidence<string | null>;
  date: FieldConfidence<string | null>;
  time: FieldConfidence<string | null>;
  senderName: FieldConfidence<string | null>;
  receiverName: FieldConfidence<string | null>;
  receiverUpiId: FieldConfidence<string | null>;
  bankName: FieldConfidence<string | null>;
  paymentApp: FieldConfidence<string | null>;
  paymentStatusInScreenshot: FieldConfidence<string | null>;
  overallConfidence: number; // Aggregate confidence 0 - 100
  structuredReceipt?: any;
}

export interface ExplanationCheck {
  code:
    | 'AMOUNT_MATCH'
    | 'RECEIVER_VERIFIED'
    | 'DUPLICATE_UTR'
    | 'EXACT_IMAGE_REUSED'
    | 'SIMILAR_PAYMENT_PATTERN'
    | 'STATUS_VERIFIED'
    | 'CONFIDENCE_CHECK'
    | 'FORMAT_CHECK';
  passed: boolean;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface MerchantVerificationRule {
  ruleId: 'MERCHANT_UPI_MATCH' | 'MERCHANT_NAME_MATCH' | 'AMOUNT_MATCH' | 'PAYMENT_STATUS_CHECK' | 'UTR_PRESENCE';
  title: string;
  passed: boolean;
  expected: string | number;
  actual: string | number;
  weight: number;
  message: string;
}

export interface MerchantVerificationResult {
  verificationScore: number; // 0 - 100%
  merchantUpiMatched: boolean;
  merchantNameMatched: boolean;
  amountMatched: boolean;
  statusMatched: boolean;
  utrPresent: boolean;
  rules: MerchantVerificationRule[];
}

export interface PipelineMetrics {
  totalDurationMs: number;
  layerTimings: Record<string, number>;
}

export interface PaymentAnalysisResult {
  provider: string;
  status: 'pending' | 'verified' | 'manual_review_required' | 'rejected';
  ocrConfidence: number;       // 1. OCR Extraction Accuracy Score (0 - 100%)
  verificationScore: number;   // 2. Business Verification Rules Pass Score (0 - 100%)
  riskScore: number;           // 3. Fraud Risk Score (0 - 100%)
  overallConfidence: number;   // Legacy aggregate score (mapped to verificationScore)
  duplicate: boolean;
  imageHash: string | null;
  exactFingerprint: string | null;
  similarityFingerprint: string | null;
  warnings: string[];
  explanationChecks: ExplanationCheck[];
  humanSummary: string;
  recommendedAction: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
  extractedDetails: ExtractedPaymentDetails;
  structuredReceipt?: any;
  merchantVerification?: MerchantVerificationResult;
  localOcrDetails?: ExtractedPaymentDetails;
  aiDetails?: ExtractedPaymentDetails;
  analysisSource?: 'Local OCR' | 'AI Enhanced';
  aiStatus?: 'Available' | 'Unavailable' | 'Failed' | 'Skipped';
  aiEscalated: boolean;
  aiEscalationReason?: string;
  metrics?: PipelineMetrics;
  analyzedAt: string;
}

export interface PaymentVerificationContext {
  paymentId: string;
  orderId: string;
  restaurantId: string;
  expectedAmount: number;
  expectedCurrency?: string;
  merchantUpiId?: string;
  merchantName?: string;
  imageBuffer?: Buffer;
  imageUrl?: string;
  storagePath?: string;
}
