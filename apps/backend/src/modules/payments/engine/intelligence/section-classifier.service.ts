// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — SECTION CLASSIFIER ────────────

import { ISectionClassifier } from '../contracts/receipt-understanding.interface';
import { DocumentLayoutBlock, ReceiptSectionType } from './receipt-grammar.definitions';
import { SectionGraph, SectionBlock } from '../types/foundation-types';
import { DEFAULT_SEMANTIC_ONTOLOGY } from '../config/semantic-ontology.config';
import { logger } from '../../../../infrastructure/logger/logger';

export class SectionClassifierService implements ISectionClassifier {
  /**
   * Main entrypoint for Stage 5: Section Classifier.
   * Classifies structured layout blocks into semantic section graph nodes:
   * HEADER, HERO_AMOUNT, STATUS, RECEIVER, SENDER, TRANSACTION, FOOTER.
   */
  public classifySections(blocks: DocumentLayoutBlock[]): SectionGraph {
    const classifiedSections: SectionBlock[] = [];
    const heroAmountCandidates: number[] = [];
    let detectedApp: string | null = null;
    let detectedStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN' = 'UNKNOWN';

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      const textLines = block.lines.map((l) => (typeof l === 'string' ? l : l.text));
      const fullBlockText = textLines.join(' ');
      const lower = fullBlockText.toLowerCase();

      // 1. Detect Payment App Branding in HEADER / Top Block
      if (!detectedApp) {
        detectedApp = this.detectPaymentApp(lower);
      }

      // 2. Classify Section Type
      let sectionType: ReceiptSectionType = block.sectionType || 'HEADER_SECTION';

      if (i === 0 && !this.isKnownHeaderTrigger(lower)) {
        sectionType = 'HEADER_SECTION';
      } else if (this.isStatusSection(lower)) {
        sectionType = 'STATUS_SECTION';
        detectedStatus = this.detectStatusState(lower);
      } else if (this.isHeroAmountSection(lower, i, blocks.length)) {
        sectionType = 'HERO_AMOUNT_SECTION';
      } else if (this.isReceiverSection(lower)) {
        sectionType = 'RECEIVER_SECTION';
      } else if (this.isSenderSection(lower)) {
        sectionType = 'SENDER_SECTION';
      } else if (this.isTransactionSection(lower)) {
        sectionType = 'TRANSACTION_SECTION';
      } else if (i === blocks.length - 1 && this.isFooterSection(lower)) {
        sectionType = 'FOOTER_SECTION';
      }

      // Collect hero numeric candidates from any upper half or hero block
      if (i <= Math.max(2, Math.floor(blocks.length * 0.5)) || sectionType === 'HERO_AMOUNT_SECTION') {
        const candidate = this.extractNumericCandidate(fullBlockText);
        if (candidate !== null && !heroAmountCandidates.includes(candidate)) {
          heroAmountCandidates.push(candidate);
        }
      }

      classifiedSections.push({
        sectionType,
        lines: textLines,
        confidence: 95,
        boundingBox: block.boundary,
      });
    }

    const sectionGraph: SectionGraph = {
      sections: classifiedSections,
      heroAmountCandidates,
      detectedApp,
      detectedStatus,
    };

    logger.info(
      {
        totalSections: classifiedSections.length,
        detectedApp: sectionGraph.detectedApp,
        detectedStatus: sectionGraph.detectedStatus,
        heroCandidatesCount: heroAmountCandidates.length,
      },
      '📊 Section Classifier processing complete.'
    );

    return sectionGraph;
  }

  private isKnownHeaderTrigger(lower: string): boolean {
    return DEFAULT_SEMANTIC_ONTOLOGY.supportedPaymentApps.some((app) =>
      lower.includes(app.toLowerCase())
    );
  }

  private detectPaymentApp(lowerText: string): string | null {
    for (const app of DEFAULT_SEMANTIC_ONTOLOGY.supportedPaymentApps) {
      if (lowerText.includes(app.toLowerCase())) {
        return app;
      }
    }
    return null;
  }

  private isStatusSection(lowerText: string): boolean {
    const successKw = DEFAULT_SEMANTIC_ONTOLOGY.statuses.success.keywords;
    const failedKw = DEFAULT_SEMANTIC_ONTOLOGY.statuses.failed.keywords;
    const pendingKw = DEFAULT_SEMANTIC_ONTOLOGY.statuses.pending.keywords;
    return [...successKw, ...failedKw, ...pendingKw].some((kw) => lowerText.includes(kw));
  }

  private detectStatusState(lowerText: string): 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN' {
    if (DEFAULT_SEMANTIC_ONTOLOGY.statuses.success.keywords.some((kw) => lowerText.includes(kw))) {
      return 'SUCCESS';
    }
    if (DEFAULT_SEMANTIC_ONTOLOGY.statuses.failed.keywords.some((kw) => lowerText.includes(kw))) {
      return 'FAILED';
    }
    if (DEFAULT_SEMANTIC_ONTOLOGY.statuses.pending.keywords.some((kw) => lowerText.includes(kw))) {
      return 'PENDING';
    }
    return 'UNKNOWN';
  }

  private isHeroAmountSection(lowerText: string, index: number, totalBlocks: number): boolean {
    const isUpperHalf = index <= Math.max(2, Math.floor(totalBlocks * 0.5));
    const hasNumeric = /[\d,]+(?:\.\d{1,2})?/.test(lowerText);
    const hasAnchor = /(?:₹|rs\.?|inr|r5|amount|paid|total|debited|credited|sent|received)/i.test(lowerText);

    return (isUpperHalf && hasNumeric) || (hasAnchor && hasNumeric);
  }

  private isReceiverSection(lowerText: string): boolean {
    const receiverLabels = DEFAULT_SEMANTIC_ONTOLOGY.categories.receiver.labels;
    return receiverLabels.some((lbl) => lowerText.includes(lbl)) || lowerText.includes('@');
  }

  private isSenderSection(lowerText: string): boolean {
    const senderLabels = DEFAULT_SEMANTIC_ONTOLOGY.categories.sender.labels;
    return senderLabels.some((lbl) => lowerText.includes(lbl));
  }

  private isTransactionSection(lowerText: string): boolean {
    const txnLabels = DEFAULT_SEMANTIC_ONTOLOGY.categories.transactionId.labels;
    return txnLabels.some((lbl) => lowerText.includes(lbl));
  }

  private isFooterSection(lowerText: string): boolean {
    return (
      lowerText.includes('powered by') ||
      lowerText.includes('upi') ||
      lowerText.includes('help') ||
      lowerText.includes('support')
    );
  }

  private extractNumericCandidate(text: string): number | null {
    const matches = text.match(/\b([\d,]+(?:\.\d{1,2})?)\b/g);
    if (!matches) return null;

    for (const match of matches) {
      const val = parseFloat(match.replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 500000 && String(Math.floor(val)).length < 8) {
        return val;
      }
    }
    return null;
  }
}
