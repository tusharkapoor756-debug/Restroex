// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — DECISION ENGINE ──────────────────

import { IDecisionEngine } from '../contracts/receipt-understanding.interface';
import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { MerchantVerificationResult, FraudAnalysisResult, PaymentDecision } from '../types/foundation-types';
import { logger } from '../../../../infrastructure/logger/logger';

export class DecisionEngine implements IDecisionEngine {
  /**
   * Main entrypoint for Stage 9: Decision Engine.
   * Synthesizes MerchantVerificationResult and FraudAnalysisResult to produce the final PaymentDecision:
   * APPROVE, REJECT, or MANUAL_REVIEW, complete with confidence scores, audit explanations, and evidence.
   */
  public makeDecision(
    verification: MerchantVerificationResult,
    fraud: FraudAnalysisResult,
    receipt?: StructuredPaymentReceipt
  ): PaymentDecision {
    const explanations: string[] = [];

    // 1. Evaluate Automatic Rejection Rules (CRITICAL Fraud or Severe Verification Mismatch)
    const shouldReject = this.evaluateRejectionRules(verification, fraud, explanations);

    // 2. Evaluate Manual Review Routing Rules (Medium Risk, Low Extraction Confidence, Name Discrepancies)
    const shouldReview = !shouldReject && this.evaluateManualReviewRules(verification, fraud, receipt, explanations);

    // 3. Determine Final Action
    let action: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW' = 'APPROVE';
    if (shouldReject) {
      action = 'REJECT';
    } else if (shouldReview) {
      action = 'MANUAL_REVIEW';
    } else {
      explanations.push('Payment APPROVED: Merchant UPI, order amount, and status verified cleanly with 0 fraud risk flags.');
    }

    // 4. Calculate Unified Decision Confidence Score
    const decisionConfidence = this.calculateDecisionConfidence(verification, fraud, receipt);

    const decision: PaymentDecision = {
      action,
      confidenceScore: decisionConfidence,
      explanations,
      evidence: {
        receipt,
        verification,
        fraud,
      },
    };

    logger.info(
      {
        action: decision.action,
        confidenceScore: decision.confidenceScore,
        explanationsCount: explanations.length,
      },
      '⚖️ Decision Engine final payment decision rendered.'
    );

    return decision;
  }

  private evaluateRejectionRules(
    verification: MerchantVerificationResult,
    fraud: FraudAnalysisResult,
    explanations: string[]
  ): boolean {
    let reject = false;

    if (fraud.isDuplicateScreenshot) {
      explanations.push('Payment REJECTED: Duplicate screenshot detected. Image has already been submitted.');
      reject = true;
    }

    if (fraud.isDuplicateUtr) {
      explanations.push('Payment REJECTED: Duplicate UTR claimed. UPI Reference has already been used.');
      reject = true;
    }

    if (fraud.riskLevel === 'CRITICAL') {
      explanations.push('Payment REJECTED: Critical fraud risk detected (Risk score >= 80).');
      reject = true;
    }

    if (!verification.upiMatch) {
      explanations.push('Payment REJECTED: Merchant UPI ID mismatch. Payment was routed to an unauthorized VPA.');
      reject = true;
    }

    if (!verification.amountMatch) {
      explanations.push('Payment REJECTED: Order amount mismatch. Screenshot amount does not match order amount.');
      reject = true;
    }

    if (!verification.statusMatch) {
      explanations.push('Payment REJECTED: Invalid screenshot status (Expected SUCCESS/COMPLETED).');
      reject = true;
    }

    return reject;
  }

  private evaluateManualReviewRules(
    verification: MerchantVerificationResult,
    fraud: FraudAnalysisResult,
    receipt?: StructuredPaymentReceipt,
    explanations: string[] = []
  ): boolean {
    let review = false;

    if (fraud.riskLevel === 'HIGH' || fraud.riskLevel === 'MEDIUM') {
      explanations.push(`Payment routed to MANUAL REVIEW: ${fraud.riskLevel} fraud risk level detected.`);
      review = true;
    }

    if (verification.overallMatchScore < 80) {
      explanations.push(`Payment routed to MANUAL REVIEW: Merchant verification match score (${verification.overallMatchScore}%) below auto-approval threshold.`);
      review = true;
    }

    if (!verification.nameMatch) {
      explanations.push('Payment routed to MANUAL REVIEW: Merchant payee name fuzzy similarity match mismatch.');
      review = true;
    }

    if (receipt && receipt.confidenceScores && receipt.confidenceScores.requiresSecondaryReview) {
      explanations.push('Payment routed to MANUAL REVIEW: OCR extraction overall confidence below secondary review threshold (< 70%).');
      review = true;
    }

    return review;
  }

  private calculateDecisionConfidence(
    verification: MerchantVerificationResult,
    fraud: FraudAnalysisResult,
    receipt?: StructuredPaymentReceipt
  ): number {
    const vScore = verification.overallMatchScore;
    const fScore = Math.max(0, 100 - fraud.fraudScore);
    const ocrScore = receipt?.confidenceScores?.overallConfidence ?? 90;

    // Weighted average: 40% Verification, 40% Fraud Safety, 20% OCR Confidence
    const weightedScore = Math.round(vScore * 0.4 + fScore * 0.4 + ocrScore * 0.2);
    return Math.min(100, Math.max(0, weightedScore));
  }
}
