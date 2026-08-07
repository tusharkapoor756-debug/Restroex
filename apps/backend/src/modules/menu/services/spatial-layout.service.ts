import { OCRToken, SpatialLine, BoundingBox } from '../types/menu-import.types';

export class SpatialLayoutReconstructor {
  /**
   * Groups OCR tokens into spatial horizontal lines based on y-center proximity
   */
  public groupTokensIntoLines(tokens: OCRToken[], yTolerancePx: number = 10): SpatialLine[] {
    if (!tokens || tokens.length === 0) return [];

    // Sort tokens by top-to-bottom y0 coordinate
    const sortedTokens = [...tokens].sort((a, b) => a.bbox.y0 - b.bbox.y0);
    const lineGroups: OCRToken[][] = [];

    for (const token of sortedTokens) {
      const tokenYCenter = (token.bbox.y0 + token.bbox.y1) / 2;
      let matchedGroup = false;

      for (const group of lineGroups) {
        const groupYCenter =
          group.reduce((acc, t) => acc + (t.bbox.y0 + t.bbox.y1) / 2, 0) / group.length;

        if (Math.abs(tokenYCenter - groupYCenter) <= yTolerancePx) {
          group.push(token);
          matchedGroup = true;
          break;
        }
      }

      if (!matchedGroup) {
        lineGroups.push([token]);
      }
    }

    // Sort tokens in each line horizontally left-to-right
    return lineGroups.map((groupTokens, index) => {
      const sortedInLine = groupTokens.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const text = sortedInLine.map((t) => t.text).join(' ');

      const xMin = Math.min(...sortedInLine.map((t) => t.bbox.x0));
      const xMax = Math.max(...sortedInLine.map((t) => t.bbox.x1));
      const yMin = Math.min(...sortedInLine.map((t) => t.bbox.y0));
      const yMax = Math.max(...sortedInLine.map((t) => t.bbox.y1));

      return {
        lineId: `line_${index + 1}`,
        tokens: sortedInLine,
        text,
        yCenter: (yMin + yMax) / 2,
        xMin,
        xMax,
        bbox: { x0: xMin, y0: yMin, x1: xMax, y1: yMax }
      };
    });
  }

  /**
   * Cleans dot leaders (e.g. "Paneer Tikka ..... 180")
   */
  public stripDotLeaders(text: string): string {
    return text.replace(/[\.·•\-_]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract normalized prices from string tokens
   */
  public extractPrices(text: string): number[] {
    const cleaned = text.replace(/(?:₹|Rs\.?|INR|\/-)/gi, '');
    const matches = cleaned.match(/\b\d+(?:\.\d{1,2})?\b/g);
    if (!matches) return [];
    return matches.map((m) => parseFloat(m)).filter((p) => p > 0 && p < 10000);
  }
}
