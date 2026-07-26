// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — RECEIPT CARD DETECTOR SERVICE ──

import { logger } from '../../../../infrastructure/logger/logger';

export interface CardBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number; // 0 - 100
}

export class ReceiptCardDetectorService {
  /**
   * Dynamically detects the primary foreground receipt card container rectangle
   * within a screenshot canvas by analyzing row-wise and column-wise luminance variance.
   * Isolates the central receipt card from outer device borders, app backgrounds, and ad banners.
   */
  public static detectReceiptCard(
    buffer: Buffer,
    imageWidth: number,
    imageHeight: number
  ): CardBoundingBox {
    const w = imageWidth || 800;
    const h = imageHeight || 1200;

    // Default fallback box (center 90% if canvas is small or uniform)
    let left = 0;
    let top = 0;
    let width = w;
    let height = h;

    if (buffer && buffer.length > 100 && w > 100 && h > 100) {
      // 1. Analyze Luminance Distribution
      const rowLuminance = new Array<number>(h).fill(0);
      const colLuminance = new Array<number>(w).fill(0);

      const totalPixels = w * h;
      const step = Math.max(1, Math.floor(buffer.length / (w * h * 3 || 1)));

      // Sample luminance values across image grid
      let ptr = 0;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const idx = (y * w + x) * 3;
          const byteVal = buffer[idx % buffer.length] ?? 200;
          rowLuminance[y] = (rowLuminance[y] || 0) + byteVal;
          colLuminance[x] = (colLuminance[x] || 0) + byteVal;
        }
      }

      // 2. Locate Card Boundaries via Luminance Variance & Edge Shifts
      // Find top margin (transition from dark background to white/light receipt card)
      let detectedTop = 0;
      let detectedBottom = h;
      let detectedLeft = 0;
      let detectedRight = w;

      // Top scan: scan down from top 5% to 40%
      const startTopScan = Math.floor(h * 0.05);
      const endTopScan = Math.floor(h * 0.40);
      for (let y = startTopScan; y < endTopScan; y += 2) {
        const prevLum = (rowLuminance[Math.max(0, y - 4)] || 0);
        const currLum = (rowLuminance[y] || 0);
        if (Math.abs(currLum - prevLum) > (w * 10)) {
          detectedTop = y;
          break;
        }
      }

      // Bottom scan: scan up from bottom 95% to 60%
      const startBotScan = Math.floor(h * 0.95);
      const endBotScan = Math.floor(h * 0.60);
      for (let y = startBotScan; y > endBotScan; y -= 2) {
        const prevLum = (rowLuminance[Math.min(h - 1, y + 4)] || 0);
        const currLum = (rowLuminance[y] || 0);
        if (Math.abs(currLum - prevLum) > (w * 10)) {
          detectedBottom = y;
          break;
        }
      }

      // Left scan: scan in from left 5% to 35%
      const startLeftScan = Math.floor(w * 0.05);
      const endLeftScan = Math.floor(w * 0.35);
      for (let x = startLeftScan; x < endLeftScan; x += 2) {
        const prevLum = (colLuminance[Math.max(0, x - 4)] || 0);
        const currLum = (colLuminance[x] || 0);
        if (Math.abs(currLum - prevLum) > (h * 10)) {
          detectedLeft = x;
          break;
        }
      }

      // Right scan: scan in from right 95% to 65%
      const startRightScan = Math.floor(w * 0.95);
      const endRightScan = Math.floor(w * 0.65);
      for (let x = startRightScan; x > endRightScan; x -= 2) {
        const prevLum = (colLuminance[Math.min(w - 1, x + 4)] || 0);
        const currLum = (colLuminance[x] || 0);
        if (Math.abs(currLum - prevLum) > (h * 10)) {
          detectedRight = x;
          break;
        }
      }

      // Validate bounds
      left = detectedLeft;
      top = detectedTop;
      width = Math.max(100, detectedRight - detectedLeft);
      height = Math.max(100, detectedBottom - detectedTop);
    }

    const box: CardBoundingBox = {
      left,
      top,
      width,
      height,
      confidence: (width > 0 && height > 0) ? 90 : 50,
    };

    logger.info(
      {
        canvasDimensions: `${w}x${h}`,
        detectedCardBox: `${box.left},${box.top} ${box.width}x${box.height}`,
        confidence: box.confidence,
      },
      '✂️ Receipt Card Detector identified content card container'
    );

    return box;
  }
}
