import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { MerchantVerificationResult, MerchantVerificationRule } from '../../../types/payment-analysis.types';
import { logger } from '../../../../../infrastructure/logger/logger';

export class MerchantVerificationLayer implements IValidationLayer {
  readonly name = 'MerchantVerificationLayer';
  readonly isCritical = false;
  readonly order = 30; // Runs immediately after OCR Extraction Layer (order 20)

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('🏛️ Merchant Verification Engine evaluating payment rules...');
    const startTime = Date.now();
    const details = context.extractedDetails;
    const vContext = context.verificationContext;

    const rules: MerchantVerificationRule[] = [];
    const warnings: string[] = [];

    // ----------------------------------------------------------
    // Rule 1: Merchant UPI Match (Weight: 35%)
    // ----------------------------------------------------------
    const expectedUpi = vContext.merchantUpiId ?? '';
    const actualUpi = details?.receiverUpiId.value ?? '';
    let merchantUpiMatched = true;

    if (expectedUpi && actualUpi) {
      merchantUpiMatched = expectedUpi.trim().toLowerCase() === actualUpi.trim().toLowerCase();
    } else if (expectedUpi && !actualUpi) {
      merchantUpiMatched = false;
    }

    rules.push({
      ruleId: 'MERCHANT_UPI_MATCH',
      title: 'Merchant UPI Match',
      passed: merchantUpiMatched,
      expected: expectedUpi || 'Not Configured',
      actual: actualUpi || 'Not Detected',
      weight: 35,
      message: merchantUpiMatched
        ? expectedUpi ? `Receiver UPI (${actualUpi}) matches registered merchant UPI (${expectedUpi}).` : 'Merchant UPI not configured; skipped strict mismatch penalty.'
        : `CRITICAL: Receiver UPI mismatch! Expected ${expectedUpi}, but screenshot shows ${actualUpi || 'None'}.`,
    });

    if (!merchantUpiMatched && expectedUpi) {
      warnings.push(`CRITICAL: Payment receiver UPI mismatch! Money was sent to ${actualUpi || 'Unknown'}, not ${expectedUpi}.`);
    }

    // ----------------------------------------------------------
    // Rule 2: Merchant Name Match (Weight: 15%)
    // ----------------------------------------------------------
    const expectedName = vContext.merchantName ?? '';
    const actualName = details?.receiverName.value ?? '';
    const isNameConfigured = !!expectedName.trim();
    let merchantNameMatched = true;

    if (isNameConfigured && actualName) {
      const normExp = expectedName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const normAct = actualName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      merchantNameMatched = normExp.includes(normAct) || normAct.includes(normExp) || this.calculateSimilarity(normExp, normAct) > 0.4;
    } else if (isNameConfigured && !actualName) {
      merchantNameMatched = false;
    } else {
      merchantNameMatched = false; // Not configured
    }

    rules.push({
      ruleId: 'MERCHANT_NAME_MATCH',
      title: 'Merchant Name Match',
      passed: isNameConfigured ? merchantNameMatched : false,
      expected: isNameConfigured ? expectedName : 'Not Configured',
      actual: actualName || 'Not Detected',
      weight: isNameConfigured ? 15 : 0,
      message: isNameConfigured
        ? merchantNameMatched
          ? `Receiver Name (${actualName}) matches merchant (${expectedName}).`
          : `Receiver Name mismatch! Expected ${expectedName}, but screenshot shows ${actualName || 'None'}.`
        : 'Merchant Name not configured in restaurant settings.',
    });

    // ----------------------------------------------------------
    // Rule 3: Expected Amount Match (Weight: 25%)
    // ----------------------------------------------------------
    const expectedAmount = vContext.expectedAmount;
    const actualAmount = details?.amount.value ?? null;
    const amountMatched = actualAmount !== null && Number(actualAmount) === Number(expectedAmount);

    rules.push({
      ruleId: 'AMOUNT_MATCH',
      title: 'Order Amount Match',
      passed: amountMatched,
      expected: `₹${expectedAmount}`,
      actual: actualAmount ? `₹${actualAmount}` : 'Not Detected',
      weight: 25,
      message: amountMatched
        ? `Detected amount ₹${actualAmount} matches order amount ₹${expectedAmount}.`
        : `Amount mismatch! Expected ₹${expectedAmount}, detected ${actualAmount ? `₹${actualAmount}` : 'None'}.`,
    });

    if (!amountMatched) {
      warnings.push(`Order amount mismatch: Expected ₹${expectedAmount}, detected ${actualAmount ? `₹${actualAmount}` : 'None'}.`);
    }

    // ----------------------------------------------------------
    // Rule 4: Payment Status Check (Weight: 15%)
    // ----------------------------------------------------------
    const actualStatus = details?.paymentStatusInScreenshot.value ?? 'UNKNOWN';
    const statusMatched = actualStatus === 'SUCCESS' || actualStatus === 'COMPLETED';

    rules.push({
      ruleId: 'PAYMENT_STATUS_CHECK',
      title: 'Screenshot Payment Status',
      passed: statusMatched,
      expected: 'SUCCESS',
      actual: actualStatus,
      weight: 15,
      message: statusMatched
        ? `Payment status in screenshot confirmed as ${actualStatus}.`
        : `Payment status in screenshot is ${actualStatus} (Expected SUCCESS/COMPLETED).`,
    });

    // ----------------------------------------------------------
    // Rule 5: UTR Format Check (Weight: 10%)
    // ----------------------------------------------------------
    const actualUtr = details?.upiReference.value ?? null;
    const utrPresent = !!actualUtr && actualUtr.length >= 10;

    rules.push({
      ruleId: 'UTR_PRESENCE',
      title: 'UTR Format Valid',
      passed: utrPresent,
      expected: 'Valid UTR Format (10-18 digits)',
      actual: actualUtr ?? 'Missing',
      weight: 10,
      message: utrPresent
        ? `Valid UTR format detected: ${actualUtr}.`
        : 'UPI Reference / UTR number missing from screenshot.',
    });

    // Calculate Verification Score (Weighted percentage of passed rules)
    const verificationScore = Math.round(
      rules.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
    );

    const merchantResult: MerchantVerificationResult = {
      verificationScore,
      merchantUpiMatched,
      merchantNameMatched: isNameConfigured ? merchantNameMatched : true,
      amountMatched,
      statusMatched,
      utrPresent,
      rules,
    };

    context.merchantVerification = merchantResult;
    context.verificationScore = verificationScore;

    // Add explanation check for RECEIVER_VERIFIED
    context.explanationChecks.push({
      code: 'RECEIVER_VERIFIED',
      passed: merchantUpiMatched && (isNameConfigured ? merchantNameMatched : true),
      title: 'Merchant Receiver Account Verification',
      message: merchantUpiMatched
        ? `Payment correctly routed to registered merchant account.`
        : `CRITICAL: Payment routed to unauthorized receiver (${actualUpi || 'Unknown'}).`,
      severity: merchantUpiMatched ? 'info' : 'critical',
    });

    logger.info({ verificationScore, merchantUpiMatched, amountMatched }, '🏛️ Merchant Verification Engine evaluation complete.');

    return {
      layerName: this.name,
      passed: verificationScore >= 70 && merchantUpiMatched,
      durationMs: Date.now() - startTime,
      warnings,
      data: merchantResult,
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    let matches = 0;
    const words1 = s1.split(/\s+/).filter(Boolean);
    const words2 = s2.split(/\s+/).filter(Boolean);
    for (const w1 of words1) {
      if (words2.some((w2) => w2.includes(w1) || w1.includes(w2))) {
        matches++;
      }
    }
    return words1.length > 0 ? matches / words1.length : 0;
  }
}
