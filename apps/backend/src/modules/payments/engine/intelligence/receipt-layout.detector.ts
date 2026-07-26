// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — LAYOUT DETECTION ENGINE ─────────

import {
  DocumentLayoutBlock,
  SpatialTextLine,
  ReceiptSectionType,
  BoundingBox2D,
} from './receipt-grammar.definitions';
import { RawOcrResult } from '../types/foundation-types';
import { IReceiptLayoutDetector } from '../contracts/receipt-understanding.interface';
import { logger } from '../../../../infrastructure/logger/logger';

export class ReceiptLayoutDetector implements IReceiptLayoutDetector {
  /**
   * Main entrypoint for Stage 4: Layout Detection Engine.
   * Performs line detection, top-to-bottom reading order sorting, spatial grouping into layout regions,
   * and block boundary calculations. Outputs a Structured Layout (DocumentLayoutBlock[]).
   */
  public detectLayout(input: string | RawOcrResult): DocumentLayoutBlock[] {
    // 1. Line Detection & Text Line Normalization
    const spatialLines = this.extractSpatialLines(input);
    if (spatialLines.length === 0) return [];

    // 2. Reading Order Sorting (Top-to-Bottom, Left-to-Right)
    const sortedLines = this.sortByReadingOrder(spatialLines);

    // 3. Spatial Grouping & Paragraph Region Segmentation
    const rawBlocks = this.groupIntoSpatialRegions(sortedLines);

    // 4. Boundary Calculation for Regions
    const blocks: DocumentLayoutBlock[] = rawBlocks.map((b, idx) => {
      const boundary = this.calculateBlockBoundary(b.lines);
      return {
        blockId: `layout-block-${idx + 1}`,
        sectionType: b.sectionType,
        lines: b.lines,
        startIndex: b.startIndex,
        endIndex: b.endIndex,
        boundary,
      };
    });

    logger.info(
      {
        totalBlocks: blocks.length,
        totalLinesProcessed: sortedLines.length,
        regions: blocks.map((b) => b.sectionType),
      },
      '📐 Layout Detection Engine processing complete.'
    );

    return blocks;
  }

  /**
   * Static helper for backward-compatibility
   */
  public static detectLayout(input: string | RawOcrResult): DocumentLayoutBlock[] {
    const detector = new ReceiptLayoutDetector();
    return detector.detectLayout(input);
  }

  /**
   * Creates a SpatialTextLine object with custom toString() for string join compatibility
   */
  private createSpatialLine(
    lineIndex: number,
    text: string,
    confidence: number,
    boundingBox?: BoundingBox2D
  ): SpatialTextLine {
    const obj: SpatialTextLine = {
      lineIndex,
      text,
      confidence,
      boundingBox,
    };
    Object.defineProperty(obj, 'toString', {
      value: function () {
        return this.text;
      },
      enumerable: false,
      writable: true,
      configurable: true,
    });
    return obj;
  }

  /**
   * 1. Line Detection: Converts raw text string or RawOcrResult into SpatialTextLine array
   */
  private extractSpatialLines(input: string | RawOcrResult): SpatialTextLine[] {
    if (typeof input === 'string') {
      const rawLines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      return rawLines.map((text, idx) =>
        this.createSpatialLine(idx, text, 95, {
          x: 10,
          y: 20 + idx * 30,
          width: Math.min(500, Math.max(100, text.length * 10)),
          height: 25,
        })
      );
    }

    if (input && Array.isArray(input.words) && input.words.length > 0) {
      // Group OCR words into lines based on Y-coordinate proximity
      const linesMap = new Map<number, SpatialTextLine>();
      let lineCounter = 0;

      for (const word of input.words) {
        if (!word.text) continue;
        const bbox = word.boundingBox || { x: 10, y: lineCounter * 30, width: 50, height: 20 };
        const lineY = Math.floor(bbox.y / 25); // Group words within 25px vertical band

        if (!linesMap.has(lineY)) {
          linesMap.set(
            lineY,
            this.createSpatialLine(lineCounter++, word.text, word.confidence, { ...bbox })
          );
        } else {
          const line = linesMap.get(lineY)!;
          line.text += ' ' + word.text;
          line.confidence = Math.round((line.confidence + word.confidence) / 2);
          if (line.boundingBox) {
            line.boundingBox.width = bbox.x + bbox.width - line.boundingBox.x;
            line.boundingBox.height = Math.max(line.boundingBox.height, bbox.height);
          }
        }
      }
      return Array.from(linesMap.values());
    }

    // Fallback if input.words is empty
    return (input.lines || []).map((text, idx) =>
      this.createSpatialLine(idx, text, input.meanConfidence || 90, {
        x: 10,
        y: idx * 30,
        width: 300,
        height: 25,
      })
    );
  }

  /**
   * 2. Reading Order Sorting: Primary sort by Y (top-to-bottom), secondary sort by X (left-to-right)
   */
  private sortByReadingOrder(lines: SpatialTextLine[]): SpatialTextLine[] {
    return [...lines].sort((a, b) => {
      const yA = a.boundingBox ? a.boundingBox.y : a.lineIndex * 30;
      const yB = b.boundingBox ? b.boundingBox.y : b.lineIndex * 30;
      if (Math.abs(yA - yB) > 15) {
        return yA - yB;
      }
      const xA = a.boundingBox ? a.boundingBox.x : 0;
      const xB = b.boundingBox ? b.boundingBox.x : 0;
      return xA - xB;
    });
  }

  /**
   * 3. Spatial Grouping & Region Segmentation based on paragraph structural cues
   */
  private groupIntoSpatialRegions(
    lines: SpatialTextLine[]
  ): Array<{ sectionType: ReceiptSectionType; lines: SpatialTextLine[]; startIndex: number; endIndex: number }> {
    const rawBlocks: Array<{
      sectionType: ReceiptSectionType;
      lines: SpatialTextLine[];
      startIndex: number;
      endIndex: number;
    }> = [];

    let currentSection: ReceiptSectionType = 'HEADER_SECTION';
    let currentLines: SpatialTextLine[] = [];
    let startIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lower = line.text.toLowerCase();
      const detectedSection = this.detectSectionHeader(lower);

      if (detectedSection && detectedSection !== currentSection) {
        if (currentLines.length > 0) {
          rawBlocks.push({
            sectionType: currentSection,
            lines: [...currentLines],
            startIndex,
            endIndex: i - 1,
          });
        }
        currentSection = detectedSection;
        currentLines = [line];
        startIndex = i;
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      rawBlocks.push({
        sectionType: currentSection,
        lines: currentLines,
        startIndex,
        endIndex: lines.length - 1,
      });
    }

    return rawBlocks;
  }

  /**
   * Section Header Trigger Detection
   */
  private detectSectionHeader(lowerLine: string): ReceiptSectionType | null {
    if (
      /\b(?:paid to|to|receiver|merchant|beneficiary|payee|transfer to|sent to)\b/i.test(lowerLine) ||
      (lowerLine.includes('@') && !lowerLine.includes('from') && !lowerLine.includes('paid by'))
    ) {
      return 'RECEIVER_SECTION';
    }

    if (/\b(?:from|paid by|sender|payer|paid from|customer|debited from)\b/i.test(lowerLine)) {
      return 'SENDER_SECTION';
    }

    if (/\b(?:upi\s*ref|reference|txn\s*id|transaction\s*id|utr|rrn|ref\s*no)\b/i.test(lowerLine)) {
      return 'TRANSACTION_SECTION';
    }

    if (/(?:₹|rs\.?|inr|r5|amount|total)\s*[\d,]+/i.test(lowerLine)) {
      return 'AMOUNT_SECTION';
    }

    if (/\b(?:completed|successful|success|paid|failed|declined|pending)\b/i.test(lowerLine)) {
      return 'STATUS_SECTION';
    }

    return null;
  }

  /**
   * 4. Boundary Calculation for Spatial Regions (Enclosing 2D Box)
   */
  private calculateBlockBoundary(lines: SpatialTextLine[]): BoundingBox2D {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const l of lines) {
      if (l.boundingBox) {
        minX = Math.min(minX, l.boundingBox.x);
        minY = Math.min(minY, l.boundingBox.y);
        maxX = Math.max(maxX, l.boundingBox.x + l.boundingBox.width);
        maxY = Math.max(maxY, l.boundingBox.y + l.boundingBox.height);
      }
    }

    if (minX === Infinity) {
      return { x: 10, y: 10, width: 300, height: 100 };
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
    };
  }
}
