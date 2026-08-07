import { OCRToken, ColumnBounds } from '../types/rdie.types';

export class ColumnDetectorService {
  /**
   * Dynamically detects 1, 2, 3, or uneven column boundaries using Vertical Projection Histograms ($V(x)$).
   */
  public detectColumns(tokens: OCRToken[], imageWidth: number): ColumnBounds[] {
    if (!tokens || tokens.length === 0) {
      return [{ columnIndex: 0, x0: 0, x1: imageWidth, tokenCount: 0 }];
    }

    // Step 1: Calculate Median Font Size
    const fontSizes = tokens.map((t) => t.fontSizeEstimate).sort((a, b) => a - b);
    const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 16;

    // Step 2: Build Vertical Projection Profile V(x)
    const binSize = 5; // 5px bins
    const numBins = Math.ceil(imageWidth / binSize);
    const histogram = new Array<number>(numBins).fill(0);

    for (const token of tokens) {
      const startBin = Math.max(0, Math.floor(token.bbox.x0 / binSize));
      const endBin = Math.min(numBins - 1, Math.floor(token.bbox.x1 / binSize));
      for (let b = startBin; b <= endBin; b++) {
        histogram[b]!++;
      }
    }

    // Step 3: Identify Gutter Ranges (where V(x) <= threshold)
    const gutterBins: number[] = [];
    for (let b = 0; b < numBins; b++) {
      // Allow minor noise (V(x) <= 1)
      if (histogram[b]! <= 1) {
        gutterBins.push(b);
      }
    }

    // Cluster continuous gutter bins
    const minGutterWidthPx = Math.max(25, medianFontSize * 1.5);
    const minGutterBins = Math.ceil(minGutterWidthPx / binSize);

    const validGutters: Array<{ xStart: number; xEnd: number }> = [];
    let currentStart: number | null = null;
    let currentCount = 0;

    for (let i = 0; i < gutterBins.length; i++) {
      const bin = gutterBins[i]!;
      if (currentStart === null) {
        currentStart = bin;
        currentCount = 1;
      } else if (bin === gutterBins[i - 1]! + 1) {
        currentCount++;
      } else {
        if (currentCount >= minGutterBins) {
          const xStart = currentStart * binSize;
          const xEnd = (gutterBins[i - 1]! + 1) * binSize;
          // Ignore page margin gutters (far left / far right)
          if (xStart > imageWidth * 0.15 && xEnd < imageWidth * 0.85) {
            validGutters.push({ xStart, xEnd });
          }
        }
        currentStart = bin;
        currentCount = 1;
      }
    }

    // Final check for trailing gutter
    if (currentStart !== null && currentCount >= minGutterBins) {
      const xStart = currentStart * binSize;
      const xEnd = gutterBins[gutterBins.length - 1]! * binSize;
      if (xStart > imageWidth * 0.15 && xEnd < imageWidth * 0.85) {
        validGutters.push({ xStart, xEnd });
      }
    }

    // Step 4: Construct Columns from Gutters
    if (validGutters.length === 0) {
      return [{ columnIndex: 0, x0: 0, x1: imageWidth, tokenCount: tokens.length }];
    }

    const columns: ColumnBounds[] = [];
    let prevX = 0;

    for (let idx = 0; idx < validGutters.length; idx++) {
      const gutter = validGutters[idx]!;
      const colX0 = prevX;
      const colX1 = Math.floor((gutter.xStart + gutter.xEnd) / 2);
      const count = tokens.filter((t) => t.bbox.x0 >= colX0 && t.bbox.x1 <= colX1).length;

      columns.push({ columnIndex: idx, x0: colX0, x1: colX1, tokenCount: count });
      prevX = colX1;
    }

    // Add trailing column
    const lastColX1 = imageWidth;
    const lastCount = tokens.filter((t) => t.bbox.x0 >= prevX).length;
    columns.push({ columnIndex: validGutters.length, x0: prevX, x1: lastColX1, tokenCount: lastCount });

    return columns;
  }
}
