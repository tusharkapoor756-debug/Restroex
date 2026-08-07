import { OCRToken } from '../types/rdie.types';

export class SpatialGridService {
  /**
   * Parses Tesseract hOCR HTML output into strict Spatial OCR Tokens.
   */
  public parseHOCR(hocrHtml: string): OCRToken[] {
    const tokens: OCRToken[] = [];
    const wordRegex = /class=['"]ocrx_word['"][^>]*title=['"]bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+);\s*x_wconf\s+(\d+)['"][^>]*>([^<]+)<\/span>/gi;
    let match: RegExpExecArray | null;

    let index = 0;
    while ((match = wordRegex.exec(hocrHtml)) !== null) {
      const [, g1, g2, g3, g4, g5, g6] = match;
      if (!g1 || !g2 || !g3 || !g4 || !g5 || !g6) continue;

      const x0 = parseInt(g1, 10);
      const y0 = parseInt(g2, 10);
      const x1 = parseInt(g3, 10);
      const y1 = parseInt(g4, 10);
      const conf = parseInt(g5, 10);
      let rawText = g6.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

      if (!rawText || rawText.length === 0) continue;

      // Filter out low-confidence OCR noise tokens (< 15% confidence for non-digits)
      const isNumeric = /^[\d.,/$-]+$/.test(rawText);
      if (conf < 15 && !isNumeric && rawText.length <= 2) continue;

      // Clean decorative border symbols and bullet artifacts
      rawText = rawText.replace(/^[~*°^«»|\\§©®™•]+|[~*°^«»|\\§©®™•]+$/g, '').trim();
      if (!rawText || rawText.length === 0) continue;

      // Ignore isolated single-character non-alphanumeric punctuation artifacts (except valid currency / price symbols)
      if (rawText.length === 1 && !/[a-zA-Z0-9₹$]/i.test(rawText) && !/^[/-]$/.test(rawText)) {
        continue;
      }

      const height = Math.max(1, y1 - y0);
      const isCurrencySymbol = /^(?:Rs\.?|INR|₹|\$)$/i.test(rawText);

      tokens.push({
        id: `token_${index++}`,
        text: rawText,
        bbox: { x0, y0, x1, y1 },
        confidence: conf / 100,
        fontSizeEstimate: height,
        isNumeric,
        isCurrencySymbol,
      });
    }

    return tokens;
  }
}
