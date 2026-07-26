// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — UNIVERSAL AMOUNT EXTRACTOR ──────

import { DocumentLayoutBlock } from './receipt-grammar.definitions';
import { SectionGraph } from '../types/foundation-types';
import { logger } from '../../../../infrastructure/logger/logger';

export interface AmountCandidate {
  rawText: string;
  value: number;
  confidenceScore: number;
  hasCurrencySymbol: boolean;
  hasSemanticKeyword: boolean;
  isHeroRegion: boolean;
  isStandaloneLine: boolean;
  hasDecimalFormat: boolean;
  sourceLine: string;
  sourceSection?: string;
  scoringReasons: string[];
}

export class UniversalAmountExtractor {
  private static readonly CURRENCY_SYMBOL_REGEX = /(?:₹|rs\.?|inr|r5|r\s)/i;
  private static readonly SEMANTIC_KEYWORDS = [
    'paid', 'amount', 'total', 'debited', 'credited', 'sent', 'received',
    'payment', 'transferred', 'bill', 'order', 'rupees', 'rs'
  ];

  /**
   * Main entrypoint for Universal Amount Extraction.
   * Scans OCR text, layout regions, font prominence, currency symbols, and semantic keywords
   * to generate, score, rank, and select the highest-confidence amount candidate.
   */
  public static extractAmount(
    rawText: string,
    blocks?: DocumentLayoutBlock[],
    sectionGraph?: SectionGraph
  ): { value: number | null; candidate: AmountCandidate | null; allCandidates: AmountCandidate[] } {
    const candidates: AmountCandidate[] = [];
    const rejectedCandidates: Array<{ rawText: string; value?: number; reason: string; sourceLine: string }> = [];
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    logger.info('=================================================================');
    logger.info('🔍 [DEBUG] UNIVERSAL AMOUNT EXTRACTOR DIAGNOSTIC LOG');
    logger.info('=================================================================');
    logger.info({ completeOcrText: rawText }, '📄 [1/6] Complete OCR Text (Untruncated)');

    // 1. Candidate Generation across all lines
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      const isTopSection = lineIdx < Math.max(3, Math.ceil(lines.length * 0.4));
      
      // Extract numeric candidates from line
      const numericMatches = this.findNumericMatches(line);

      for (const match of numericMatches) {
        const { candidate, rejectionReason } = this.evaluateCandidateWithReason(
          match.raw,
          match.val,
          line,
          lineIdx,
          lines,
          isTopSection,
          blocks,
          sectionGraph
        );

        if (candidate && candidate.confidenceScore > 0) {
          candidates.push(candidate);
        } else if (rejectionReason) {
          rejectedCandidates.push({
            rawText: match.raw,
            value: match.val,
            reason: rejectionReason,
            sourceLine: line,
          });
        }
      }
    }

    // Deduplicate candidates by value, keeping highest confidence
    const dedupedMap = new Map<number, AmountCandidate>();
    for (const cand of candidates) {
      const existing = dedupedMap.get(cand.value);
      if (!existing || cand.confidenceScore > existing.confidenceScore) {
        dedupedMap.set(cand.value, cand);
      }
    }

    const sortedCandidates = Array.from(dedupedMap.values()).sort(
      (a, b) => b.confidenceScore - a.confidenceScore
    );

    const winner = sortedCandidates.length > 0 ? sortedCandidates[0]! : null;

    logger.info(
      {
        totalCandidatesGenerated: candidates.length,
        dedupedCandidates: sortedCandidates.map((c) => ({
          value: c.value,
          confidenceScore: c.confidenceScore,
          sourceLine: c.sourceLine,
        })),
      },
      '🔢 [2/6] Every Generated Amount Candidate'
    );

    logger.info(
      {
        scoreBreakdown: sortedCandidates.map((c) => ({
          amount: c.value,
          confidenceScore: c.confidenceScore,
          scoringReasons: c.scoringReasons,
          sourceLine: c.sourceLine,
        })),
      },
      '📊 [3/6] Candidate Evidence Score Breakdown'
    );

    logger.info(
      {
        rejectedCandidatesCount: rejectedCandidates.length,
        rejectedCandidates,
      },
      '🚫 [4/6] Rejected Candidates & Discard Reasons'
    );

    if (winner) {
      logger.info(
        {
          selectedAmount: winner.value,
          confidenceScore: winner.confidenceScore,
          sourceLine: winner.sourceLine,
          winningReasons: winner.scoringReasons,
        },
        '🏆 [5/6] Final Selected Amount Candidate'
      );
    } else {
      logger.warn(
        {
          totalEvaluated: candidates.length + rejectedCandidates.length,
          discardSummary: rejectedCandidates.length > 0
            ? 'All extracted numeric candidates failed validation guardrails or scored <= 0.'
            : 'No numeric sequences matching candidate criteria were found in OCR text.',
        },
        '⚠️ [6/6] No Amount Candidate Selected'
      );
    }

    logger.info('=================================================================\n');

    return {
      value: winner ? winner.value : null,
      candidate: winner,
      allCandidates: sortedCandidates,
    };
  }

  private static findNumericMatches(line: string): Array<{ raw: string; val: number }> {
    const results: Array<{ raw: string; val: number }> = [];

    // Pattern A: Currency Symbol + Number (e.g. ₹200, ₹ 200.00, Rs.500)
    const currPattern = /(?:₹|rs\.?|inr|r5|r\s)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let match: RegExpExecArray | null;
    while ((match = currPattern.exec(line)) !== null) {
      const rawNum = match[1]!.replace(/,/g, '');
      const val = parseFloat(rawNum);
      if (!isNaN(val) && val > 0 && val < 500000) {
        results.push({ raw: match[0], val });
      }
    }

    // Pattern B: Semantic Keyword + Number (e.g. Paid 500, Amount ₹200)
    const semanticPattern = /(?:paid|amount|total|debited|credited|sent|received)\s*(?:of)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/gi;
    while ((match = semanticPattern.exec(line)) !== null) {
      const rawNum = match[1]!.replace(/,/g, '');
      const val = parseFloat(rawNum);
      if (!isNaN(val) && val > 0 && val < 500000) {
        results.push({ raw: match[0], val });
      }
    }

    // Pattern C: Standalone numbers / decimal numbers (e.g. 200.00, 500)
    const standalonePattern = /\b([\d,]+(?:\.\d{1,2})?)\b/g;
    while ((match = standalonePattern.exec(line)) !== null) {
      const rawNum = match[1]!.replace(/,/g, '');
      const val = parseFloat(rawNum);
      if (!isNaN(val) && val > 0 && val < 500000) {
        results.push({ raw: match[0], val });
      }
    }

    return results;
  }

  private static evaluateCandidateWithReason(
    rawText: string,
    val: number,
    line: string,
    lineIdx: number,
    lines: string[],
    isTopSection: boolean,
    blocks?: DocumentLayoutBlock[],
    sectionGraph?: SectionGraph
  ): { candidate: AmountCandidate | null; rejectionReason?: string } {
    const lineLower = line.toLowerCase();
    const strVal = String(Math.floor(val));

    // Guardrail 1: UTR / Reference numbers (10-18 digits)
    if (strVal.length >= 10 && strVal.length <= 18) {
      return { candidate: null, rejectionReason: `Excluded UTR/Ref digits (${strVal.length} digits: ${strVal})` };
    }
    if (lineLower.includes('utr') || lineLower.includes('upi ref') || lineLower.includes('rrn') || lineLower.includes('txn')) {
      if (strVal.length >= 8) {
        return { candidate: null, rejectionReason: `Excluded number on UTR/Ref line: "${line}"` };
      }
    }

    // Guardrail 2: Phone numbers (10 digits starting with 6-9)
    if (/^[6-9]\d{9}$/.test(strVal)) {
      return { candidate: null, rejectionReason: `Excluded phone number sequence (${strVal})` };
    }

    // Guardrail 3: Date Years (2020-2030)
    if (
      val >= 2020 &&
      val <= 2030 &&
      (lineLower.includes('jan') ||
        lineLower.includes('feb') ||
        lineLower.includes('mar') ||
        lineLower.includes('apr') ||
        lineLower.includes('may') ||
        lineLower.includes('jun') ||
        lineLower.includes('jul') ||
        lineLower.includes('aug') ||
        lineLower.includes('sep') ||
        lineLower.includes('oct') ||
        lineLower.includes('nov') ||
        lineLower.includes('dec') ||
        lineLower.includes('pm') ||
        lineLower.includes('am'))
    ) {
      return { candidate: null, rejectionReason: `Excluded calendar year (${val}) on date/time line` };
    }

    // Guardrail 4: Timestamp / Date Fragments (e.g. 7, 5, 38 from 7:05:38 PM)
    const isTimePattern = /:\d{2}/.test(line) || lineLower.includes('pm') || lineLower.includes('am') || lineLower.includes('time') || lineLower.includes('date');
    if (isTimePattern && val <= 59 && !this.CURRENCY_SYMBOL_REGEX.test(line)) {
      return { candidate: null, rejectionReason: `Excluded date/time fragment number (${val}) on timestamp line: "${line}"` };
    }

    const candidate = this.evaluateCandidate(
      rawText,
      val,
      line,
      lineIdx,
      lines,
      isTopSection,
      blocks,
      sectionGraph
    );

    if (!candidate || candidate.confidenceScore < 40) {
      return { candidate: null, rejectionReason: `Candidate confidence score < 40 (Low-confidence timestamp fragment)` };
    }

    return { candidate };
  }

  private static evaluateCandidate(
    rawText: string,
    val: number,
    line: string,
    lineIdx: number,
    lines: string[],
    isTopSection: boolean,
    blocks?: DocumentLayoutBlock[],
    sectionGraph?: SectionGraph
  ): AmountCandidate | null {
    const lineLower = line.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // Signal 1: Currency Symbol Anchor (+40 pts)
    const hasCurrencySymbol = this.CURRENCY_SYMBOL_REGEX.test(line);
    if (hasCurrencySymbol) {
      score += 40;
      reasons.push('Currency symbol anchor (₹/Rs/INR) detected');
    }

    // Signal 2: Semantic Keyword Anchor (+25 pts for same line, +30 pts for adjacent line)
    const hasSemanticKeyword = this.SEMANTIC_KEYWORDS.some((kw) => lineLower.includes(kw));
    if (hasSemanticKeyword) {
      score += 25;
      reasons.push('Semantic payment keyword anchor detected');
    }

    // Signal 2b: Adjacent Line Payment Recipient / Transfer Anchor Boost (+30 pts)
    const adjacentLineKeyword = this.SEMANTIC_KEYWORDS.some((kw) =>
      lineIdx > 0 && lines[lineIdx - 1]?.toLowerCase().includes(kw)
    ) || this.SEMANTIC_KEYWORDS.some((kw) =>
      lineIdx < lines.length - 1 && lines[lineIdx + 1]?.toLowerCase().includes(kw)
    );

    if (adjacentLineKeyword && !hasSemanticKeyword) {
      score += 30;
      reasons.push('Adjacent line payment transfer/recipient anchor boost (Paid to/Sent to/Debited from)');
    }

    // Signal 3: Hero Section / Top 40% Reading Order (+25 pts)
    const isHeroRegion = isTopSection || (sectionGraph && sectionGraph.heroAmountCandidates.includes(val)) || false;
    if (isHeroRegion) {
      score += 25;
      reasons.push('Hero region / Top visual placement');
    }

    // Signal 4: Standalone Prominent Line (+15 pts)
    const cleanLineText = line.replace(/[^a-zA-Z0-9.\s₹]/g, '').trim();
    const isStandaloneLine = cleanLineText.split(/\s+/).length <= 3;
    if (isStandaloneLine) {
      score += 15;
      reasons.push('Standalone prominent line text');
    }

    // Signal 5: Explicit 2-Decimal Format (+10 pts)
    const hasDecimalFormat = /\.\d{2}\b/.test(line);
    if (hasDecimalFormat) {
      score += 10;
      reasons.push('Explicit 2-decimal format (.00)');
    }

    // High-Confidence Anchor Boost (+15 pts for currency symbol + hero or standalone)
    if (hasCurrencySymbol && (isHeroRegion || isStandaloneLine || hasDecimalFormat)) {
      score += 15;
      reasons.push('High-Confidence Currency Anchor Boost');
    }

    // Signal 6: Penalties for noise
    if (!hasCurrencySymbol && !hasSemanticKeyword && !isHeroRegion && !hasDecimalFormat) {
      score -= 40;
      reasons.push('Penalty: Generic unanchored number');
    }

    if (score <= 0) return null;

    return {
      rawText,
      value: Math.round(val * 100) / 100,
      confidenceScore: Math.min(100, Math.max(0, score)),
      hasCurrencySymbol,
      hasSemanticKeyword,
      isHeroRegion,
      isStandaloneLine,
      hasDecimalFormat,
      sourceLine: line,
      sourceSection: isHeroRegion ? 'HERO_AMOUNT_SECTION' : 'AMOUNT_SECTION',
      scoringReasons: reasons,
    };
  }
}
