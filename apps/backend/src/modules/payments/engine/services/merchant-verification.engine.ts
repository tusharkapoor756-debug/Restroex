// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — MERCHANT VERIFICATION ENGINE ────

import { IMerchantVerificationEngine } from '../contracts/receipt-understanding.interface';
import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { ExpectedMerchantData, MerchantVerificationResult } from '../types/foundation-types';
import { logger } from '../../../../infrastructure/logger/logger';

export class MerchantVerificationEngine implements IMerchantVerificationEngine {
  /**
   * Main entrypoint for Stage 7: Merchant Verification Engine.
   * Verifies extracted receipt details against expected merchant order metadata.
   * Evaluates Merchant UPI ID, Merchant Name, Order Amount, and Execution Status.
   */
  public verifyMerchant(
    receipt: StructuredPaymentReceipt,
    expected: ExpectedMerchantData
  ): MerchantVerificationResult {
    const discrepancies: string[] = [];

    // 1. Merchant UPI Verification
    const upiMatch = this.verifyUpi(receipt.receiverUpi, expected.merchantUpiId, discrepancies);

    // 2. Merchant Name Verification
    const nameMatch = this.verifyName(receipt.receiverName, expected.merchantName, discrepancies);

    // 3. Amount Verification
    const amountMatch = this.verifyAmount(receipt.amount, expected.expectedAmount, discrepancies);

    // 4. Status Verification
    const statusMatch = this.verifyStatus(receipt.status, discrepancies);

    // 5. Calculate Weighted Match Score (UPI: 35%, Amount: 35%, Name: 15%, Status: 15%)
    let score = 0;
    if (upiMatch) score += 35;
    if (amountMatch) score += 35;
    if (nameMatch) score += 15;
    if (statusMatch) score += 15;

    const overallMatchScore = Math.min(100, Math.max(0, score));

    const result: MerchantVerificationResult = {
      upiMatch,
      nameMatch,
      amountMatch,
      statusMatch,
      overallMatchScore,
      discrepancies,
    };

    logger.info(
      {
        merchantId: expected.merchantId,
        orderId: expected.orderId,
        upiMatch,
        amountMatch,
        nameMatch,
        statusMatch,
        score: overallMatchScore,
        discrepanciesCount: discrepancies.length,
      },
      '🏛️ Merchant Verification Engine evaluation complete.'
    );

    return result;
  }

  private verifyUpi(actualUpi: string | null, expectedUpi?: string, discrepancies: string[] = []): boolean {
    if (!expectedUpi || !expectedUpi.trim()) {
      return true; // Merchant UPI not configured; pass verification without penalty
    }

    if (!actualUpi) {
      discrepancies.push(`Merchant UPI Missing: Expected "${expectedUpi}", but screenshot contains no receiver VPA.`);
      return false;
    }

    const normActual = actualUpi.trim().toLowerCase();
    const normExpected = expectedUpi.trim().toLowerCase();

    const isMatched = normActual === normExpected;
    if (!isMatched) {
      discrepancies.push(`Merchant UPI Mismatch: Expected "${expectedUpi}", detected "${actualUpi}".`);
    }

    return isMatched;
  }

  private verifyName(actualName: string | null, expectedName: string, discrepancies: string[] = []): boolean {
    if (!expectedName || !expectedName.trim()) {
      return true;
    }

    if (!actualName) {
      discrepancies.push(`Merchant Name Missing: Expected "${expectedName}", but screenshot contains no receiver name.`);
      return false;
    }

    const normExp = expectedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const normAct = actualName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    const isSub = normExp.includes(normAct) || normAct.includes(normExp);
    const simScore = this.calculateSimilarity(normExp, normAct);
    const isMatched = isSub || simScore >= 0.4;

    if (!isMatched) {
      discrepancies.push(`Merchant Name Mismatch: Expected "${expectedName}", detected "${actualName}".`);
    }

    return isMatched;
  }

  private verifyAmount(actualAmount: number | null, expectedAmount: number, discrepancies: string[] = []): boolean {
    if (actualAmount === null || isNaN(actualAmount)) {
      discrepancies.push(`Order Amount Missing: Expected ₹${expectedAmount}, but no amount was detected in screenshot.`);
      return false;
    }

    const diff = Math.abs(actualAmount - expectedAmount);
    const isMatched = diff < 0.01; // Cent-exact match

    if (!isMatched) {
      discrepancies.push(`Order Amount Mismatch: Expected ₹${expectedAmount}, detected ₹${actualAmount}.`);
    }

    return isMatched;
  }

  private verifyStatus(actualStatus: string, discrepancies: string[] = []): boolean {
    const isMatched = actualStatus === 'SUCCESS' || actualStatus === 'COMPLETED';

    if (!isMatched) {
      discrepancies.push(`Payment Status Invalid: Expected SUCCESS, detected status "${actualStatus}".`);
    }

    return isMatched;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    const words1 = str1.split(/\s+/).filter(Boolean);
    const words2 = str2.split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const w1 of words1) {
      if (words2.some((w2) => w2.includes(w1) || w1.includes(w2))) {
        matches++;
      }
    }
    return words1.length > 0 ? matches / words1.length : 0;
  }
}
