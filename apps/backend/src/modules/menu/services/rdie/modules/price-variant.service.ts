import { OCRToken, SpatialLine, PriceEntity, VariantMatrixSpec, VariantSpec } from '../types/rdie.types';

export class PriceVariantService {
  /**
   * Extracts scalar price entities using DFA pattern matching.
   */
  public extractPrices(tokens: OCRToken[]): PriceEntity[] {
    const prices: PriceEntity[] = [];
    let priceCounter = 0;

    for (const token of tokens) {
      // Currency & Price DFA regex patterns
      const priceMatch = token.text.match(/(?:Rs\.?|INR|₹|\$)?\s*(\d{1,4}(?:\.\d{2})?)\s*\/-?/i);
      if (priceMatch && priceMatch[1]) {
        const val = parseFloat(priceMatch[1]);
        if (val >= 5 && val <= 10000) {
          prices.push({
            id: `price_${priceCounter++}`,
            value: val,
            rawText: token.text,
            bbox: { ...token.bbox },
            columnIndex: 0, // Assigned later in spatial stage
          });
        }
      }
    }

    return prices;
  }

  /**
   * Detects variant matrix column headers (e.g. "Half / Full", "Small / Medium / Large") beneath headings.
   */
  public detectVariantMatrix(lines: SpatialLine[]): VariantMatrixSpec[] {
    const specs: VariantMatrixSpec[] = [];

    const variantKeywords = ['HALF', 'FULL', 'SMALL', 'MEDIUM', 'LARGE', 'GLASS', 'BOTTLE', '250ML', '500ML', '1PC', '2PC'];

    for (const line of lines) {
      const upperText = line.text.toUpperCase();
      const tokensInLine = line.tokens;

      const detectedVariants: VariantSpec[] = [];

      for (const token of tokensInLine) {
        const cleaned = token.text.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (variantKeywords.includes(cleaned)) {
          const xCenter = (token.bbox.x0 + token.bbox.x1) / 2;
          detectedVariants.push({
            name: this.formatVariantName(cleaned),
            xCenter,
          });
        }
      }

      if (detectedVariants.length >= 2) {
        specs.push({
          columnIndex: line.columnIndex,
          yPosition: (line.bbox.y0 + line.bbox.y1) / 2,
          variants: detectedVariants,
        });
      }
    }

    return specs;
  }

  private formatVariantName(raw: string): string {
    const map: Record<string, string> = {
      HALF: 'Half',
      FULL: 'Full',
      SMALL: 'Small',
      MEDIUM: 'Medium',
      LARGE: 'Large',
    };
    return map[raw] || raw;
  }
}
