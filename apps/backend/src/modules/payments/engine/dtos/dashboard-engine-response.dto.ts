// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — DASHBOARD ENGINE RESPONSE DTO ────

import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { MerchantVerificationResult, FraudAnalysisResult, PaymentDecision } from '../types/foundation-types';

export interface ConfidenceVisualizationPayload {
  overallConfidence: number;
  isHighConfidence: boolean;
  requiresSecondaryReview: boolean;
  fieldBreakdown: {
    amountConfidence: number;
    upiReferenceConfidence: number;
    receiverUpiConfidence: number;
    statusConfidence: number;
  };
}

export interface DecisionExplanationPayload {
  action: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  confidenceScore: number;
  explanations: string[];
}

export interface VerificationSummaryPayload {
  overallMatchScore: number;
  upiMatch: boolean;
  nameMatch: boolean;
  amountMatch: boolean;
  statusMatch: boolean;
  discrepancies: string[];
}

export interface FraudRiskPayload {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  fraudScore: number;
  isDuplicateScreenshot: boolean;
  isDuplicateUtr: boolean;
  isWrongMerchant: boolean;
  amountMismatch: boolean;
  riskFlags: string[];
}

export interface DashboardPaymentDetailDto {
  paymentId: string;
  orderId: string;
  status: string;
  amount: number;
  currency: string;
  confidenceVisualization: ConfidenceVisualizationPayload;
  decisionPayload: DecisionExplanationPayload;
  verificationSummaryPayload: VerificationSummaryPayload;
  fraudRiskPayload: FraudRiskPayload;
  extractedReceiptPayload?: StructuredPaymentReceipt;
}

export class DashboardReceiptEngineDtoMapper {
  /**
   * Maps payment pipeline artifacts into serializable DashboardPaymentDetailDto format for Dashboard UI.
   */
  public static mapToDashboardDto(
    paymentId: string,
    orderId: string,
    amount: number,
    currency: string,
    decision: PaymentDecision,
    receipt?: StructuredPaymentReceipt
  ): DashboardPaymentDetailDto {
    const verification: MerchantVerificationResult = decision.evidence?.verification ?? {
      upiMatch: false,
      nameMatch: false,
      amountMatch: false,
      statusMatch: false,
      overallMatchScore: 0,
      discrepancies: ['No verification evidence available.'],
    };

    const fraud: FraudAnalysisResult = decision.evidence?.fraud ?? {
      isDuplicateScreenshot: false,
      isDuplicateUtr: false,
      isWrongMerchant: false,
      amountMismatch: false,
      fraudScore: 0,
      riskLevel: 'LOW',
      riskFlags: [],
    };

    const confidenceVisualization: ConfidenceVisualizationPayload = {
      overallConfidence: receipt?.confidenceScores?.overallConfidence ?? 0,
      isHighConfidence: receipt?.confidenceScores?.isHighConfidence ?? false,
      requiresSecondaryReview: receipt?.confidenceScores?.requiresSecondaryReview ?? true,
      fieldBreakdown: {
        amountConfidence: receipt?.confidenceScores?.amountConfidence ?? 0,
        upiReferenceConfidence: receipt?.confidenceScores?.upiReferenceConfidence ?? 0,
        receiverUpiConfidence: receipt?.confidenceScores?.receiverUpiConfidence ?? 0,
        statusConfidence: receipt?.confidenceScores?.statusConfidence ?? 0,
      },
    };

    const decisionPayload: DecisionExplanationPayload = {
      action: decision.action,
      confidenceScore: decision.confidenceScore,
      explanations: decision.explanations,
    };

    const verificationSummaryPayload: VerificationSummaryPayload = {
      overallMatchScore: verification.overallMatchScore,
      upiMatch: verification.upiMatch,
      nameMatch: verification.nameMatch,
      amountMatch: verification.amountMatch,
      statusMatch: verification.statusMatch,
      discrepancies: verification.discrepancies,
    };

    const fraudRiskPayload: FraudRiskPayload = {
      riskLevel: fraud.riskLevel,
      fraudScore: fraud.fraudScore,
      isDuplicateScreenshot: fraud.isDuplicateScreenshot,
      isDuplicateUtr: fraud.isDuplicateUtr,
      isWrongMerchant: fraud.isWrongMerchant,
      amountMismatch: fraud.amountMismatch,
      riskFlags: fraud.riskFlags,
    };

    return {
      paymentId,
      orderId,
      status: decision.action === 'APPROVE' ? 'verified' : decision.action === 'REJECT' ? 'rejected' : 'manual_review',
      amount,
      currency,
      confidenceVisualization,
      decisionPayload,
      verificationSummaryPayload,
      fraudRiskPayload,
      extractedReceiptPayload: receipt,
    };
  }
}
