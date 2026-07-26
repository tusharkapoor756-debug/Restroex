// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — CONTRACTS & INTERFACES ────────

import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { DocumentLayoutBlock } from '../intelligence/receipt-grammar.definitions';
import { SemanticOntologyConfig } from '../config/semantic-ontology.config';
import { ExtractedPaymentDetails } from '../../types/payment-analysis.types';
import {
  NormalizedImage,
  RawOcrResult,
  SectionGraph,
  ExpectedMerchantData,
  MerchantVerificationResult,
  FraudAnalysisResult,
  PaymentDecision,
} from '../types/foundation-types';

/**
 * Sprint 2: Image Preprocessing Engine Contract
 */
export interface IImageNormalizerService {
  normalizeImage(buffer: Buffer): Buffer | NormalizedImage;
}

/**
 * Sprint 3: OCR Engine Contract
 */
export interface IOcrEngine {
  extractRawOcr(buffer: Buffer): Promise<RawOcrResult>;
}

/**
 * Sprint 4: Layout Detection Engine Contract
 */
export interface IReceiptLayoutDetector {
  detectLayout(rawText: string): DocumentLayoutBlock[];
}

/**
 * Sprint 5: Section Classifier Contract
 */
export interface ISectionClassifier {
  classifySections(blocks: DocumentLayoutBlock[]): SectionGraph;
}

/**
 * Sprint 1: Semantic Ontology Loader Contract
 */
export interface ISemanticOntologyLoader {
  getConfig(): SemanticOntologyConfig;
  extendReceiverLabels(newLabels: string[]): void;
  extendSenderLabels(newLabels: string[]): void;
  extendTransactionLabels(newLabels: string[]): void;
}

/**
 * Sprint 6: Universal Grammar Engine Contract
 */
export interface IUniversalReceiptGrammarEngine {
  parseReceipt(rawText: string): ExtractedPaymentDetails;
  parseToStructuredReceipt(rawText: string): StructuredPaymentReceipt;
}

/**
 * Sprint 7: Merchant Verification Engine Contract
 */
export interface IMerchantVerificationEngine {
  verifyMerchant(
    receipt: StructuredPaymentReceipt,
    expected: ExpectedMerchantData
  ): MerchantVerificationResult;
}

/**
 * Sprint 8: Fraud Engine Contract
 */
export interface IFraudEngine {
  analyzeFraud(
    receipt: StructuredPaymentReceipt,
    imageHash?: string,
    metadata?: Record<string, any>
  ): FraudAnalysisResult;
}

/**
 * Sprint 9: Decision Engine Contract
 */
export interface IDecisionEngine {
  makeDecision(
    verification: MerchantVerificationResult,
    fraud: FraudAnalysisResult,
    receipt?: StructuredPaymentReceipt
  ): PaymentDecision;
}

/**
 * High-Level Receipt Understanding Facade Contract
 */
export interface IReceiptUnderstandingService {
  processReceipt(imageBufferOrText: Buffer | string): Promise<ExtractedPaymentDetails>;
}
