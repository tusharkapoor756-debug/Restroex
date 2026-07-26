import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { logger } from '../../../../../infrastructure/logger/logger';

export class FraudIndicatorsLayer implements IValidationLayer {
  readonly name = 'FraudIndicatorsLayer';
  readonly isCritical = false;

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('🛡 Fraud Layer evaluating business risk...');
    const startTime = Date.now();
    let riskScore = 0;
    const warnings = [...context.warnings];
    const checks = [...context.explanationChecks];

    const imageHashDuplicate = checks.some((c) => c.code === 'EXACT_IMAGE_REUSED' && !c.passed);
    const duplicateUpiRef = checks.some((c) => c.code === 'DUPLICATE_UTR' && !c.passed);
    const exactFingerprintMatch = checks.some((c) => c.code === 'EXACT_IMAGE_REUSED' && !c.passed);
    const similarityFingerprintMatch = checks.some((c) => c.code === 'SIMILAR_PAYMENT_PATTERN' && !c.passed);

    const mv = context.merchantVerification;
    const upiMismatch = mv ? !mv.merchantUpiMatched : false;
    const nameMismatch = mv ? !mv.merchantNameMatched : false;
    const amountMismatch = mv ? !mv.amountMatched : false;
    const statusFailed = mv ? !mv.statusMatched : false;
    const utrMissing = mv ? !mv.utrPresent : false;

    const ocrConf = context.extractedDetails?.overallConfidence ?? 0;

    // Fraud Risk Penalties
    if (upiMismatch)                 riskScore += 60; // Money sent to wrong recipient account!
    if (imageHashDuplicate)         riskScore += 50;
    if (exactFingerprintMatch)     riskScore += 50;
    if (duplicateUpiRef)           riskScore += 45;
    if (statusFailed)              riskScore += 40;
    if (amountMismatch)            riskScore += 30;
    if (similarityFingerprintMatch)riskScore += 25;
    if (nameMismatch)              riskScore += 20;
    if (utrMissing)                riskScore += 20;

    if (ocrConf < 60)               riskScore += 15;

    riskScore = Math.min(100, Math.max(0, riskScore));

    // Decision Logic: Merchant UPI Mismatch or Failed Payment Status forces REJECT
    let recommendedAction: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';
    if (upiMismatch || statusFailed || riskScore >= 70) {
      recommendedAction = 'REJECT';
    } else if (
      riskScore >= 30 ||
      amountMismatch ||
      duplicateUpiRef ||
      imageHashDuplicate ||
      utrMissing ||
      nameMismatch
    ) {
      recommendedAction = 'MANUAL_REVIEW';
    } else {
      recommendedAction = 'APPROVE';
    }

    let summaryText = '';
    if (recommendedAction === 'REJECT') {
      if (upiMismatch) {
        summaryText = '❌ REJECT: Payment was NOT made to the restaurant merchant account.';
      } else {
        summaryText = '❌ REJECT: High risk payment validation failure detected.';
      }
    } else if (recommendedAction === 'MANUAL_REVIEW') {
      summaryText = '⚠️ MANUAL REVIEW: Verification flags require restaurant staff review.';
    } else {
      summaryText = '✅ APPROVED: Payment verified successfully for restaurant merchant account.';
    }

    const verificationScore = mv?.verificationScore ?? 0;
    const humanSummary = `${summaryText} (Verification Score: ${verificationScore}%, Fraud Risk: ${riskScore}/100, OCR Confidence: ${ocrConf}%).`;

    return {
      layerName: this.name,
      passed: riskScore < 70 && !upiMismatch,
      durationMs: Date.now() - startTime,
      warnings: Array.from(new Set(warnings)),
      explanationChecks: checks,
      data: {
        riskScore,
        recommendedAction,
        humanSummary,
      },
    };
  }
}
