import { PaymentVerificationContext, ExtractedPaymentDetails, ExplanationCheck, MerchantVerificationResult } from '../../types/payment-analysis.types';
import { PaymentEngineConfig } from '../../config/payment-engine.config';

export interface ILogger {
  info(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
}

export interface PipelineContext {
  verificationContext: PaymentVerificationContext;
  config: PaymentEngineConfig;
  rawInput?: Buffer | string;
  imageHash?: string;
  extractedDetails?: ExtractedPaymentDetails;
  merchantVerification?: MerchantVerificationResult;
  ocrConfidence?: number;
  verificationScore?: number;
  localOcrDetails?: ExtractedPaymentDetails;
  aiDetails?: ExtractedPaymentDetails;
  analysisSource?: 'Local OCR' | 'AI Enhanced';
  aiStatus?: 'Available' | 'Unavailable' | 'Failed' | 'Skipped';
  duplicatePaymentId?: string;
  exactFingerprint?: string | null;
  similarityFingerprint?: string | null;
  warnings: string[];
  explanationChecks: ExplanationCheck[];
  shouldShortCircuit?: boolean;
  shortCircuitReason?: string;
  aiEscalated?: boolean;
  aiEscalationReason?: string;
  timings: Record<string, number>;
}

export interface LayerExecutionResult {
  layerName: string;
  passed: boolean;
  durationMs: number;
  warnings?: string[];
  explanationChecks?: ExplanationCheck[];
  shouldShortCircuit?: boolean;
  shortCircuitReason?: string;
  data?: Record<string, any>;
  error?: string;
}

export interface IValidationLayer {
  readonly name: string;
  readonly isCritical: boolean;
  readonly order?: number;
  evaluate(context: PipelineContext): Promise<LayerExecutionResult>;
}
