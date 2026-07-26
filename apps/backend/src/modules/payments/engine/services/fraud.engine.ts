// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — FRAUD ENGINE ────────────────────

import { IFraudEngine } from '../contracts/receipt-understanding.interface';
import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { FraudAnalysisResult } from '../types/foundation-types';
import { logger } from '../../../../infrastructure/logger/logger';

export class FraudEngine implements IFraudEngine {
  /**
   * Main entrypoint for Stage 8: Fraud Engine.
   * Analyzes payment receipts and context metadata for fraud indicators:
   * Duplicate Screenshots, Duplicate UTRs, Wrong Merchant routing, and Amount Mismatches.
   * Computes risk score (0-100), risk level (LOW/MEDIUM/HIGH/CRITICAL), and fraud recommendation.
   */
  public analyzeFraud(
    receipt: StructuredPaymentReceipt,
    imageHash?: string,
    metadata?: Record<string, any>
  ): FraudAnalysisResult {
    const riskFlags: string[] = [];
    let fraudScore = 0;

    // 1. Duplicate Screenshot Detection
    const isDuplicateScreenshot = this.checkDuplicateScreenshot(imageHash, metadata, riskFlags);
    if (isDuplicateScreenshot) fraudScore += 60;

    // 2. Duplicate UTR Detection
    const isDuplicateUtr = this.checkDuplicateUtr(receipt.upiReference, metadata, riskFlags);
    if (isDuplicateUtr) fraudScore += 50;

    // 3. Wrong Merchant Payee Detection
    const isWrongMerchant = this.checkWrongMerchant(receipt.receiverUpi, metadata, riskFlags);
    if (isWrongMerchant) fraudScore += 45;

    // 4. Amount Mismatch Analysis
    const amountMismatch = this.checkAmountMismatch(receipt.amount, metadata, riskFlags);
    if (amountMismatch) fraudScore += 35;

    // 5. Additional Risk Indicators (Failed/Pending Status or Low Confidence)
    if (receipt.status === 'FAILED' || receipt.status === 'PENDING') {
      fraudScore += 30;
      riskFlags.push(`Invalid Screenshot Status: Payment execution status is "${receipt.status}".`);
    }

    if (receipt.confidenceScores && receipt.confidenceScores.overallConfidence < 70) {
      fraudScore += 15;
      riskFlags.push('Low Extraction Confidence: Extraction confidence is below 70%.');
    }

    // Cap Score to 0-100
    const finalFraudScore = Math.min(100, Math.max(0, fraudScore));

    // 6. Risk Level Classification
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (finalFraudScore >= 80) {
      riskLevel = 'CRITICAL';
    } else if (finalFraudScore >= 50) {
      riskLevel = 'HIGH';
    } else if (finalFraudScore >= 25) {
      riskLevel = 'MEDIUM';
    }

    const result: FraudAnalysisResult = {
      isDuplicateScreenshot,
      isDuplicateUtr,
      isWrongMerchant,
      amountMismatch,
      fraudScore: finalFraudScore,
      riskLevel,
      riskFlags,
    };

    logger.info(
      {
        fraudScore: result.fraudScore,
        riskLevel: result.riskLevel,
        isDuplicateScreenshot: result.isDuplicateScreenshot,
        isDuplicateUtr: result.isDuplicateUtr,
        isWrongMerchant: result.isWrongMerchant,
        amountMismatch: result.amountMismatch,
        riskFlagsCount: riskFlags.length,
      },
      '🛡️ Fraud Engine risk analysis complete.'
    );

    return result;
  }

  private checkDuplicateScreenshot(imageHash?: string, metadata?: Record<string, any>, riskFlags: string[] = []): boolean {
    if (metadata && metadata.isDuplicateScreenshot === true) {
      riskFlags.push('Duplicate Image Detected: Image hash matches an existing payment submission.');
      return true;
    }
    if (metadata && Array.isArray(metadata.knownHashes) && imageHash) {
      if (metadata.knownHashes.includes(imageHash)) {
        riskFlags.push('Duplicate Image Detected: SHA-256 hash matches historical submission.');
        return true;
      }
    }
    return false;
  }

  private checkDuplicateUtr(upiRef: string | null, metadata?: Record<string, any>, riskFlags: string[] = []): boolean {
    if (!upiRef) return false;
    if (metadata && metadata.isDuplicateUtr === true) {
      riskFlags.push(`Duplicate UTR Detected: UPI Reference "${upiRef}" has already been claimed.`);
      return true;
    }
    if (metadata && Array.isArray(metadata.knownUtrs)) {
      if (metadata.knownUtrs.includes(upiRef)) {
        riskFlags.push(`Duplicate UTR Detected: UTR "${upiRef}" exists in transaction database.`);
        return true;
      }
    }
    return false;
  }

  private checkWrongMerchant(receiverUpi: string | null, metadata?: Record<string, any>, riskFlags: string[] = []): boolean {
    if (!metadata || !metadata.merchantUpiId || !metadata.merchantUpiId.trim()) {
      return false; // Merchant UPI not configured; skip penalty
    }
    if (!receiverUpi) {
      riskFlags.push('Unverified Receiver: Missing receiver VPA in screenshot.');
      return true;
    }
    const expected = metadata.merchantUpiId.trim().toLowerCase();
    const actual = receiverUpi.trim().toLowerCase();
    if (actual !== expected) {
      riskFlags.push(`Unauthorized Receiver: Screenshot VPA "${actual}" does not match merchant VPA "${expected}".`);
      return true;
    }
    return false;
  }

  private checkAmountMismatch(amount: number | null, metadata?: Record<string, any>, riskFlags: string[] = []): boolean {
    if (!metadata || typeof metadata.expectedAmount !== 'number') {
      return false;
    }
    if (amount === null || isNaN(amount)) {
      riskFlags.push('Missing Amount: Amount could not be extracted from screenshot.');
      return true;
    }
    const diff = Math.abs(amount - metadata.expectedAmount);
    if (diff >= 0.01) {
      riskFlags.push(`Amount Mismatch Penalty: Screenshot amount (₹${amount}) differs from order (₹${metadata.expectedAmount}).`);
      return true;
    }
    return false;
  }
}
