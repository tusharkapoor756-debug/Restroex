// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — UNIVERSAL GRAMMAR ENGINE ───────

import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { ExtractedPaymentDetails } from '../../types/payment-analysis.types';
import { ReceiptLayoutDetector } from './receipt-layout.detector';
import { SemanticOntologyLoader } from '../services/semantic-ontology.loader';
import { SectionClassifierService } from './section-classifier.service';
import { UniversalAmountExtractor } from './universal-amount.extractor';
import { logger } from '../../../../infrastructure/logger/logger';

export class UniversalReceiptGrammarEngine {
  /**
   * Main entrypoint for Stage 6: Universal Grammar Engine.
   * Performs grammar parsing, semantic ontology label mapping, key-value spatial association,
   * and semantic value normalization to produce a StructuredPaymentReceipt.
   */
  public static parseToStructuredReceipt(rawText: string): StructuredPaymentReceipt {
    const layoutDetector = new ReceiptLayoutDetector();
    const blocks = layoutDetector.detectLayout(rawText);
    const classifier = new SectionClassifierService();
    const sectionGraph = classifier.classifySections(blocks);

    const ontology = SemanticOntologyLoader.getInstance().getConfig();
    const fullText = rawText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');

    // 1. Spatial Section Text Scoping
    const receiverBlock = blocks.find((b) => b.sectionType === 'RECEIVER_SECTION');
    const senderBlock = blocks.find((b) => b.sectionType === 'SENDER_SECTION');
    const txnBlock = blocks.find((b) => b.sectionType === 'TRANSACTION_SECTION');
    const statusBlock = blocks.find((b) => b.sectionType === 'STATUS_SECTION');

    const receiverText = receiverBlock ? receiverBlock.lines.map(l => (typeof l === 'string' ? l : l.text)).join(' ') : fullText;
    const senderText = senderBlock ? senderBlock.lines.map(l => (typeof l === 'string' ? l : l.text)).join(' ') : '';
    const txnText = txnBlock ? txnBlock.lines.map(l => (typeof l === 'string' ? l : l.text)).join(' ') : fullText;
    const statusText = statusBlock ? statusBlock.lines.map(l => (typeof l === 'string' ? l : l.text)).join(' ') : fullText;

    // 2. Multi-Evidence Universal Amount Extraction
    const { value: amountVal, candidate: amountCandidate } = UniversalAmountExtractor.extractAmount(
      rawText,
      blocks,
      sectionGraph
    );

    const receiverUpi = this.normalizeUpiId(this.extractUpiId(receiverText, senderText) || this.extractUpiId(fullText, senderText));
    const senderUpi = this.normalizeUpiId(senderText ? this.extractUpiId(senderText, '') : null);

    const receiverName = this.normalizeName(this.extractReceiverName(receiverText, ontology.categories.receiver.labels));
    const senderName = this.normalizeName(this.extractSenderName(senderText || fullText, ontology.categories.sender.labels));

    const upiRef = this.normalizeUpiReference(this.extractUpiReference(txnText) || this.extractUpiReference(fullText));
    const txnId = this.extractTransactionId(txnText) || this.extractTransactionId(fullText);

    const status = sectionGraph.detectedStatus !== 'UNKNOWN'
      ? sectionGraph.detectedStatus
      : this.normalizePaymentStatus(statusText);

    const paymentApp = sectionGraph.detectedApp || this.extractPaymentApp(fullText, ontology.supportedPaymentApps);
    const bankName = this.extractBankName(fullText, ontology.supportedBanks);
    const { date, time } = this.extractDateTime(fullText);

    // 3. Composite Field Confidence Model
    const amountConfidence = amountCandidate ? amountCandidate.confidenceScore : (amountVal !== null ? 95 : 0);
    const receiverUpiConfidence = receiverUpi !== null ? 95 : 0;
    const upiReferenceConfidence = upiRef !== null ? 95 : 0;
    const statusConfidence = status !== 'UNKNOWN' ? 95 : 30;

    const overallConfidence = this.calculateOverallConfidence({
      amountVal,
      upiRef,
      receiverUpi,
      status,
    });

    const structuredReceipt: StructuredPaymentReceipt = {
      amount: amountVal,
      currency: 'INR',
      receiverName,
      receiverUpi,
      receiverAccount: null,
      senderName,
      senderUpi,
      senderAccount: null,
      transactionId: txnId,
      upiReference: upiRef,
      status,
      paymentApp,
      paymentMethod: 'UPI',
      bankName,
      timestamp: time,
      date,
      confidenceScores: {
        amountConfidence,
        receiverUpiConfidence,
        upiReferenceConfidence,
        statusConfidence,
        overallConfidence,
        isHighConfidence: overallConfidence >= 90,
        requiresSecondaryReview: overallConfidence < 70,
      },
      rawLineCount: rawText.split(/\r?\n/).filter(Boolean).length,
    };

    logger.info({ structuredReceipt }, '🧾 Universal Structured Receipt object created.');
    return structuredReceipt;
  }

  /**
   * Facade method returning ExtractedPaymentDetails
   */
  public static parseReceipt(rawText: string): ExtractedPaymentDetails {
    const structuredReceipt = this.parseToStructuredReceipt(rawText);

    return {
      amount: { value: structuredReceipt.amount, confidence: structuredReceipt.confidenceScores.amountConfidence, source: 'rule_engine' },
      currency: { value: 'INR', confidence: 95, source: 'rule_engine' },
      upiReference: { value: structuredReceipt.upiReference, confidence: structuredReceipt.confidenceScores.upiReferenceConfidence, source: 'rule_engine' },
      transactionId: { value: structuredReceipt.transactionId, confidence: structuredReceipt.transactionId ? 85 : 0, source: 'rule_engine' },
      date: { value: structuredReceipt.date, confidence: structuredReceipt.date ? 85 : 0, source: 'rule_engine' },
      time: { value: structuredReceipt.timestamp, confidence: structuredReceipt.timestamp ? 85 : 0, source: 'rule_engine' },
      senderName: { value: structuredReceipt.senderName, confidence: structuredReceipt.senderName ? 85 : 0, source: 'rule_engine' },
      receiverName: { value: structuredReceipt.receiverName, confidence: structuredReceipt.receiverName ? 85 : 0, source: 'rule_engine' },
      receiverUpiId: { value: structuredReceipt.receiverUpi, confidence: structuredReceipt.confidenceScores.receiverUpiConfidence, source: 'rule_engine' },
      bankName: { value: structuredReceipt.bankName, confidence: structuredReceipt.bankName ? 90 : 0, source: 'rule_engine' },
      paymentApp: { value: structuredReceipt.paymentApp, confidence: structuredReceipt.paymentApp ? 95 : 0, source: 'rule_engine' },
      paymentStatusInScreenshot: { value: structuredReceipt.status, confidence: structuredReceipt.confidenceScores.statusConfidence, source: 'rule_engine' },
      overallConfidence: structuredReceipt.confidenceScores.overallConfidence,
      structuredReceipt,
    };
  }

  // ─── Extraction & Normalization Methods ─────────────────────────────────

  private static extractAmount(text: string): number | null {
    const currencyRegex = /(?:₹|rs\.?|inr|r5|r\s)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let match = currencyRegex.exec(text);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 500000) return val;
    }

    const paidRegex = /(?:paid|payment|amount|total)\s*(?:of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    match = paidRegex.exec(text);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 500000) return val;
    }

    return null;
  }

  private static normalizeAmount(val: number | null): number | null {
    if (val === null || isNaN(val) || val <= 0) return null;
    return Math.round(val * 100) / 100;
  }

  private static extractUpiId(targetText: string, excludeText: string): string | null {
    const upiRegex = /\b([a-zA-Z0-9.\-_]{3,30}@(okaxis|okhdfcbank|okicici|oksbi|ybl|paytm|upi|ibl|axl))\b/gi;
    let match: RegExpExecArray | null;

    while ((match = upiRegex.exec(targetText)) !== null) {
      const captured = match[1];
      if (!captured) continue;
      const vpa = captured.toLowerCase();
      if (!excludeText || !excludeText.toLowerCase().includes(vpa)) {
        return vpa;
      }
    }

    const genericVpa = /\b([a-zA-Z0-9.\-_]{3,30}@[a-zA-Z0-9]{2,15})\b/gi;
    while ((match = genericVpa.exec(targetText)) !== null) {
      const captured = match[1];
      if (!captured) continue;
      const vpa = captured.toLowerCase();
      if (!excludeText || !excludeText.toLowerCase().includes(vpa)) {
        return vpa;
      }
    }

    return null;
  }

  private static normalizeUpiId(vpa: string | null): string | null {
    if (!vpa) return null;
    const cleaned = vpa.trim().toLowerCase().replace(/[.,;:]+$/, '');
    return cleaned.includes('@') ? cleaned : null;
  }

  private static extractUpiReference(text: string): string | null {
    const utrLabelRegex = /(?:upi\s*ref(?:erence)?(?:\s*no)?|utr|rrn|ref\s*no|txn\s*ref)\s*[:\-]?\s*(\d{10,18})\b/i;
    let match = utrLabelRegex.exec(text);
    if (match && match[1]) return match[1];

    const standalone12Digit = /\b(\d{12})\b/g;
    match = standalone12Digit.exec(text);
    if (match && match[1]) return match[1];

    return null;
  }

  private static normalizeUpiReference(utr: string | null): string | null {
    if (!utr) return null;
    const digitsOnly = utr.replace(/\D/g, '');
    return digitsOnly.length >= 10 && digitsOnly.length <= 18 ? digitsOnly : null;
  }

  private static extractTransactionId(text: string): string | null {
    const txnIdRegex = /(?:txn|transaction|ref)\s*(?:id|no|number)?\s*[:\-]?\s*([a-z0-9]{8,24})/i;
    const match = txnIdRegex.exec(text);
    if (match && match[1] && match[1].length >= 8) return match[1];
    return null;
  }

  private static extractReceiverName(text: string, labels: string[]): string | null {
    const labelPattern = labels.join('|');
    const regex = new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*([a-zA-Z0-9\\s.]{3,30})`, 'i');
    const match = regex.exec(text);
    if (match && match[1]) return match[1].trim();
    return null;
  }

  private static extractSenderName(text: string, labels: string[]): string | null {
    const labelPattern = labels.join('|');
    const regex = new RegExp(`(?:${labelPattern})\\s*[:\\-]?\\s*([a-zA-Z\\s.]{3,30})`, 'i');
    const match = regex.exec(text);
    if (match && match[1]) return match[1].trim();
    return null;
  }

  private static normalizeName(name: string | null): string | null {
    if (!name) return null;
    const cleaned = name.replace(/[^\w\s.]/g, '').trim();
    return cleaned.length >= 2 ? cleaned : null;
  }

  private static normalizePaymentStatus(text: string): 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN' {
    const lower = text.toLowerCase();
    if (
      lower.includes('paid successfully') ||
      lower.includes('payment successful') ||
      lower.includes('successful') ||
      lower.includes('completed') ||
      lower.includes('paid') ||
      lower.includes('success')
    ) {
      return 'SUCCESS';
    }
    if (lower.includes('processing') || lower.includes('pending')) {
      return 'PENDING';
    }
    if (lower.includes('failed') || lower.includes('declined') || lower.includes('unsuccessful')) {
      return 'FAILED';
    }
    return 'UNKNOWN';
  }

  private static extractPaymentApp(text: string, supportedApps: string[]): string | null {
    for (const app of supportedApps) {
      if (new RegExp(`\\b${app}\\b`, 'i').test(text)) {
        return app === 'GPay' ? 'Google Pay' : app;
      }
    }
    return null;
  }

  private static extractBankName(text: string, supportedBanks: string[]): string | null {
    for (const bank of supportedBanks) {
      if (new RegExp(`\\b${bank}\\b`, 'i').test(text)) return bank;
    }
    return null;
  }

  private static extractDateTime(text: string): { date: string | null; time: string | null } {
    const dateRegex = /\b(\d{1,2}[\/\-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2})[\/\-\s]\d{2,4})\b/i;
    const timeRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
    return {
      date: dateRegex.exec(text)?.[1] ?? null,
      time: timeRegex.exec(text)?.[1] ?? null,
    };
  }

  private static calculateOverallConfidence(data: {
    amountVal: number | null;
    upiRef: string | null;
    receiverUpi: string | null;
    status: string;
  }): number {
    let score = 0;
    if (data.amountVal !== null) score += 35;
    if (data.upiRef !== null) score += 35;
    if (data.receiverUpi !== null) score += 15;
    if (data.status === 'SUCCESS' || data.status === 'COMPLETED') score += 15;
    return score;
  }
}
