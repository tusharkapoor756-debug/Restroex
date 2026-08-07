import { SpatialBlock, SpatialLine, HeadingNode } from '../types/rdie.types';

export class HeadingDetectorService {
  /**
   * Deterministically identifies section and category headings using typographic Z-scores, centering, uppercase ratios, and split token healing.
   */
  public detectHeadings(blocks: SpatialBlock[]): HeadingNode[] {
    const headings: HeadingNode[] = [];
    const allLines: SpatialLine[] = blocks.flatMap((b) => b.lines);

    if (allLines.length === 0) return headings;

    // Step 1: Calculate global font size mean & standard deviation
    const fontSizes = allLines.map((l) => l.medianFontSize);
    const meanSize = fontSizes.reduce((acc, val) => acc + val, 0) / fontSizes.length;
    const variance = fontSizes.reduce((acc, val) => acc + Math.pow(val - meanSize, 2), 0) / fontSizes.length;
    const stdDevSize = Math.sqrt(variance) || 1;

    let headingCounter = 0;

    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      const block = blocks[bIdx]!;
      for (let lIdx = 0; lIdx < block.lines.length; lIdx++) {
        const line = block.lines[lIdx]!;

        // Heal split tokens (e.g. "BREA DS" -> "BREADS", "S T A R T E R S" -> "STARTERS")
        const healedText = this.healSplitHeadingTokens(line.text);
        const upperText = healedText.toUpperCase().trim();

        // Rule 1: Exclude Footer / Banner / Disclaimer lines
        if (this.isFooterOrBannerLine(upperText)) {
          continue;
        }

        // Rule 2: Cannot contain standalone prices or currency indicators unless it's a section tag
        if (/\b\d{2,4}\b/.test(healedText) && !/SECTION|MENU|SPECIAL|COMBO\s*\d/i.test(healedText)) {
          continue;
        }

        // Calculate Typographic Z-score
        const zScore = (line.medianFontSize - meanSize) / stdDevSize;

        // Weights for deterministic scoring
        let score = 0;

        // Font size weight
        if (zScore > 0.8) score += 40;
        else if (zScore > 0.3) score += 20;

        // Uppercase weight
        if (line.isUppercase) score += 25;

        // Centering weight
        if (line.isCentered) score += 20;

        // Spatial Isolation Weight (vertical gap above line)
        if (lIdx > 0) {
          const prevLine = block.lines[lIdx - 1]!;
          const gapAbove = line.bbox.y0 - prevLine.bbox.y1;
          if (gapAbove > line.medianFontSize * 1.4) {
            score += 20;
          }
        } else if (bIdx > 0) {
          score += 15; // Top line of a reading block
        }

        // Expanded Category Vocabulary Boost
        if (
          /STARTER|APPETIZER|MAIN\s*COURSE|SOUP|SALAD|BEVERAGE|DRINK|DESSERT|BREAD|RICE|BIRYAN|NOODLE|PASTA|PIZZA|BURGER|SANDWICH|THALI|COMBO|SIDE|SNACK|TANDOOR|MOMOS|SHAKE|MOCKTAIL|ICE\s*CREAM|ROTI|NAAN|CURRY|GRAVY|DAL|CHINESE|INDIAN|ITALIAN|CONTINENTAL|ORIENTAL|MEXICAN|BARBECUE|GRILL|RECOMMEND|CHEF/i.test(
            upperText
          )
        ) {
          score += 35;
        }

        // Heading Threshold: Score >= 45
        if (score >= 45) {
          headings.push({
            id: `heading_${headingCounter++}`,
            name: this.cleanHeadingText(healedText),
            rawText: line.text,
            columnIndex: line.columnIndex,
            bbox: { ...line.bbox },
            confidence: Math.min(1.0, score / 100),
            headingScore: score,
          });
        }
      }
    }

    return headings;
  }

  /**
   * Deterministically identifies footer / banner / disclaimer lines.
   */
  public isFooterOrBannerLine(text: string): boolean {
    const upper = text.toUpperCase();
    return (
      /FSSAI|LIC\s*NO|LICENSE|GST|GOVT\s*TAX|TAXES\s*EXTRA|PACKING\s*CHARGES|SERVICE\s*CHARGE/i.test(upper) ||
      /TERMS\s*(?:&|AND)\s*CONDITIONS|T\s*&\s*C|ALL\s*RIGHTS\s*RESERVED|PRICES\s*ARE\s*SUBJECT/i.test(upper) ||
      /FREE\s*HOME\s*DELIVERY|ORDER\s*(?:ONLINE|NOW)|CALL\s*FOR\s*DELIVERY|PHONE|MOBILE|WHATSAPP/i.test(upper) ||
      /HTTP|WWW\.|NEAR\s+[A-Z]|OPP\.|OPPOSITE|ROAD|STREET|NAGAR|MARKET|CITY|\b\d{6}\b/i.test(upper)
    );
  }

  /**
   * Deterministically heals split OCR tokens in category headings (e.g., "BREA DS" -> "BREADS").
   */
  private healSplitHeadingTokens(text: string): string {
    // 1. Join single spaced uppercase letters: "S T A R T E R S" -> "STARTERS"
    let processed = text.replace(/\b([A-Z])\s+([A-Z])\s+([A-Z])\s+([A-Z])\b/gi, '$1$2$3$4');
    processed = processed.replace(/\b([A-Z]{2,})\s+([A-Z]{1,2})\b/gi, (match, p1, p2) => {
      const combined = (p1 + p2).toUpperCase();
      if (/^(BREADS|TANDOORI|NOODLES|STARTERS|SOUPS|SALADS|BEVERAGES|APPETIZERS|DESSERTS)$/.test(combined)) {
        return combined;
      }
      return match;
    });

    const knownHeadingsMap: Record<string, string> = {
      'BREA DS': 'BREADS',
      'MAIN COURSE': 'MAIN COURSE',
      'APP ETIZERS': 'APPETIZERS',
      'TAN DOORI': 'TANDOORI',
      'NOO DLES': 'NOODLES',
      'BEV ERAGES': 'BEVERAGES',
    };

    const upperText = processed.toUpperCase().trim();
    if (knownHeadingsMap[upperText]) {
      return knownHeadingsMap[upperText];
    }

    return processed;
  }

  private cleanHeadingText(text: string): string {
    return text
      .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
}
