import { OCRToken, ColumnBounds, SpatialLine, SpatialBlock } from '../types/rdie.types';

export class SpatialBlockService {
  /**
   * Groups tokens into spatial lines (via Y-overlap) and blocks per column.
   */
  public buildSpatialBlocks(tokens: OCRToken[], columns: ColumnBounds[]): SpatialBlock[] {
    const allBlocks: SpatialBlock[] = [];
    let lineCounter = 0;
    let blockCounter = 0;

    for (const col of columns) {
      // Step 1: Assign tokens to current column
      const colTokens = tokens.filter((t) => {
        const midX = (t.bbox.x0 + t.bbox.x1) / 2;
        return midX >= col.x0 && midX < col.x1;
      });

      if (colTokens.length === 0) continue;

      // Sort tokens vertically by top coordinate (y0)
      colTokens.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // Step 2: Cluster tokens into lines using Y-Overlap
      const lines: SpatialLine[] = [];

      for (const token of colTokens) {
        let matchedLine: SpatialLine | null = null;

        for (const line of lines) {
          const lineH = Math.max(1, line.bbox.y1 - line.bbox.y0);
          const tokenH = Math.max(1, token.bbox.y1 - token.bbox.y0);
          const minH = Math.min(lineH, tokenH);
          const maxH = Math.max(lineH, tokenH);

          const lineYCenter = (line.bbox.y0 + line.bbox.y1) / 2;
          const tokenYCenter = (token.bbox.y0 + token.bbox.y1) / 2;
          const yCenterDelta = Math.abs(tokenYCenter - lineYCenter);

          const overlapY = Math.max(0, Math.min(line.bbox.y1, token.bbox.y1) - Math.max(line.bbox.y0, token.bbox.y0));
          const overlapRatioMin = overlapY / minH;
          const overlapRatioMax = overlapY / maxH;

          // Strict line match: Y-centers within 45% of min height AND significant Y overlap ratio
          if (yCenterDelta <= minH * 0.45 && overlapRatioMin >= 0.50 && overlapRatioMax >= 0.20) {
            matchedLine = line;
            break;
          }
        }

        if (matchedLine) {
          matchedLine.tokens.push(token);
          matchedLine.bbox.x0 = Math.min(matchedLine.bbox.x0, token.bbox.x0);
          matchedLine.bbox.y0 = Math.min(matchedLine.bbox.y0, token.bbox.y0);
          matchedLine.bbox.x1 = Math.max(matchedLine.bbox.x1, token.bbox.x1);
          matchedLine.bbox.y1 = Math.max(matchedLine.bbox.y1, token.bbox.y1);
        } else {
          lines.push({
            id: `line_${lineCounter++}`,
            columnIndex: col.columnIndex,
            bbox: { ...token.bbox },
            tokens: [token],
            text: '',
            medianFontSize: token.fontSizeEstimate,
            isCentered: false,
            isUppercase: false,
          });
        }
      }

      // Finalize line properties
      for (const line of lines) {
        // Sort tokens horizontally in reading order
        line.tokens.sort((a, b) => a.bbox.x0 - b.bbox.x0);
        line.text = line.tokens.map((t) => t.text).join(' ');

        const fontSizes = line.tokens.map((t) => t.fontSizeEstimate).sort((a, b) => a - b);
        line.medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 16;

        const letters = line.text.replace(/[^a-zA-Z]/g, '');
        line.isUppercase = letters.length > 2 && letters === letters.toUpperCase();

        const colWidth = col.x1 - col.x0;
        const lineMidX = (line.bbox.x0 + line.bbox.x1) / 2;
        const colMidX = (col.x0 + col.x1) / 2;
        line.isCentered = Math.abs(lineMidX - colMidX) < colWidth * 0.15;
      }

      // Step 3: Sort lines top-to-bottom
      lines.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      // Step 4: Cluster lines into blocks
      let currentBlockLines: SpatialLine[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (currentBlockLines.length === 0) {
          currentBlockLines.push(line);
        } else {
          const prevLine = currentBlockLines[currentBlockLines.length - 1]!;
          const deltaY = line.bbox.y0 - prevLine.bbox.y1;
          const maxGap = Math.max(prevLine.medianFontSize, line.medianFontSize) * 1.8;

          if (deltaY <= maxGap) {
            currentBlockLines.push(line);
          } else {
            allBlocks.push(this.createBlock(`block_${blockCounter++}`, col.columnIndex, currentBlockLines));
            currentBlockLines = [line];
          }
        }
      }

      if (currentBlockLines.length > 0) {
        allBlocks.push(this.createBlock(`block_${blockCounter++}`, col.columnIndex, currentBlockLines));
      }
    }

    return allBlocks;
  }

  private createBlock(id: string, columnIndex: number, lines: SpatialLine[]): SpatialBlock {
    const x0 = Math.min(...lines.map((l) => l.bbox.x0));
    const y0 = Math.min(...lines.map((l) => l.bbox.y0));
    const x1 = Math.max(...lines.map((l) => l.bbox.x1));
    const y1 = Math.max(...lines.map((l) => l.bbox.y1));

    return { id, columnIndex, bbox: { x0, y0, x1, y1 }, lines };
  }
}
