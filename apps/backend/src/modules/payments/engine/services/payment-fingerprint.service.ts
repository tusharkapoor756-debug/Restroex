import crypto from 'crypto';

export interface FingerprintInputs {
  amount?: number | null;
  upiReference?: string | null;
  receiverUpiId?: string | null;
  transactionId?: string | null;
  bankName?: string | null;
  timestamp?: string | null;
  date?: string | null;
}

export class PaymentFingerprintService {
  /**
   * Generates Dual Payment Fingerprints:
   * 1. Exact Fingerprint: SHA-256(amount | upiReference | receiverUpiId | transactionId | timestamp)
   *    Detects identical repeated payment submissions.
   * 2. Similarity Fingerprint: SHA-256(amount | receiverUpiId | bankName | date)
   *    Detects suspicious repeated payments of same amount to same merchant on same date.
   */
  public static generateFingerprints(inputs: FingerprintInputs): {
    exactFingerprint: string | null;
    similarityFingerprint: string | null;
  } {
    const normAmount = inputs.amount !== undefined && inputs.amount !== null ? inputs.amount.toFixed(2) : '';
    const normUpiRef = (inputs.upiReference ?? '').trim().toLowerCase();
    const normReceiver = (inputs.receiverUpiId ?? '').trim().toLowerCase();
    const normTxnId = (inputs.transactionId ?? '').trim().toLowerCase();
    const normBank = (inputs.bankName ?? '').trim().toLowerCase();
    const normTime = (inputs.timestamp ?? '').trim().toLowerCase();
    const normDate = (inputs.date ?? '').trim().toLowerCase();

    // Exact fingerprint requires at least amount and (UPI ref OR Txn ID)
    let exactFingerprint: string | null = null;
    if (normAmount && (normUpiRef || normTxnId)) {
      const exactRaw = `${normAmount}|${normUpiRef}|${normReceiver}|${normTxnId}|${normTime}`;
      exactFingerprint = crypto.createHash('sha256').update(exactRaw).digest('hex');
    }

    // Similarity fingerprint requires amount and receiver UPI or Bank
    let similarityFingerprint: string | null = null;
    if (normAmount && (normReceiver || normBank)) {
      const similarityRaw = `${normAmount}|${normReceiver}|${normBank}|${normDate}`;
      similarityFingerprint = crypto.createHash('sha256').update(similarityRaw).digest('hex');
    }

    return { exactFingerprint, similarityFingerprint };
  }
}
