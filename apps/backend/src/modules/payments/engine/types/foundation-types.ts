// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — FOUNDATION TYPES ───────────────

import { StructuredPaymentReceipt } from './structured-receipt.schema';
import { ReceiptSectionType, BoundingBox2D } from '../intelligence/receipt-grammar.definitions';

/**
 * Stage 2 Preprocessing Output: Normalized Image & Metadata
 */
export interface NormalizedImage {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  dpi?: number;
  orientation: number; // 0, 90, 180, 270
  isDarkMode: boolean;
  brightnessScore: number; // 0-100
  contrastScore: number;   // 0-100
  hasAutoRotated: boolean;
}

/**
 * Stage 3 OCR Output: Word Token & Bounding Box
 */
export interface OcrWordToken {
  text: string;
  confidence: number; // 0-100
  boundingBox?: BoundingBox2D;
}

/**
 * Stage 3 OCR Output: Raw Result
 */
export interface RawOcrResult {
  fullText: string;
  lines: string[];
  words: OcrWordToken[];
  meanConfidence: number;
  ocrEngineName: string;
  executionTimeMs: number;
}

/**
 * Stage 5 Section Classifier: Classified Section Block
 */
export interface SectionBlock {
  sectionType: ReceiptSectionType;
  lines: string[];
  confidence: number;
  boundingBox?: BoundingBox2D;
}

/**
 * Stage 5 Section Classifier Output: Graph of Sections
 */
export interface SectionGraph {
  sections: SectionBlock[];
  heroAmountCandidates: number[];
  detectedApp: string | null;
  detectedStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';
}

/**
 * Expected Merchant Order Data for Verification
 */
export interface ExpectedMerchantData {
  merchantId: string;
  merchantName: string;
  merchantUpiId?: string;
  expectedAmount: number;
  orderId: string;
}

/**
 * Stage 7 Merchant Verification Output
 */
export interface MerchantVerificationResult {
  upiMatch: boolean;
  nameMatch: boolean;
  amountMatch: boolean;
  statusMatch: boolean;
  overallMatchScore: number; // 0-100
  discrepancies: string[];
}

/**
 * Stage 8 Fraud Detection Output
 */
export interface FraudAnalysisResult {
  isDuplicateScreenshot: boolean;
  isDuplicateUtr: boolean;
  isWrongMerchant: boolean;
  amountMismatch: boolean;
  fraudScore: number; // 0-100 (0 = clean, 100 = definite fraud)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFlags: string[];
}

/**
 * Stage 9 Decision Engine Output
 */
export interface PaymentDecision {
  action: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  confidenceScore: number; // 0-100
  explanations: string[];
  evidence: {
    receipt?: StructuredPaymentReceipt;
    verification?: MerchantVerificationResult;
    fraud?: FraudAnalysisResult;
  };
}
