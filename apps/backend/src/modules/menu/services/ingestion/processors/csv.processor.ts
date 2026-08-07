import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult, IngestionReport, ProcessingWarning } from '../ingestion.types';
import { ParsedCategoryGroup, StagedMenuItem, StagedVariant } from '../../../types/menu-import.types';

export class CSVProcessor implements IDocumentProcessor {
  public readonly supportedFormats: DetectedFormat[] = ['csv'];

  public async process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult> {
    console.log(`[CSVProcessor] Ingesting CSV file "${filename}" (${buffer.length} bytes)`);

    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const warnings: ProcessingWarning[] = [];
    const categoriesMap = new Map<string, StagedMenuItem[]>();

    if (lines.length === 0) {
      return {
        categories: [],
        report: {
          detectedFormat: 'csv',
          mimeType: detection.mimeType,
          originalFilename: filename,
          pagesProcessed: 1,
          itemsDetected: 0,
          categoriesDetected: 0,
          skippedCount: 0,
          confidenceScore: 1.0,
          warnings: [{ code: 'EMPTY_FILE', message: 'CSV file is empty' }]
        }
      };
    }

    // Auto-detect delimiter (, or ; or \t)
    const firstLine = lines[0]!;
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const header = this.parseCSVLine(firstLine, delimiter).map((h) => h.toLowerCase().trim());
    const colIndexMap = this.mapColumns(header);

    let skippedCount = 0;
    let itemsDetected = 0;

    const dataLines = header.length > 0 && colIndexMap.itemName !== -1 ? lines.slice(1) : lines;

    for (let rIdx = 0; rIdx < dataLines.length; rIdx++) {
      const lineStr = dataLines[rIdx]!;
      const row = this.parseCSVLine(lineStr, delimiter);

      if (row.length === 0 || row.every((c) => c.trim().length === 0)) {
        skippedCount++;
        continue;
      }

      const itemName = colIndexMap.itemName !== -1 ? this.getCol(row, colIndexMap.itemName) : this.getCol(row, 0);
      if (!itemName || itemName.length < 2 || /^item|name|title$/i.test(itemName)) {
        skippedCount++;
        continue;
      }

      const categoryName = (colIndexMap.category !== -1 ? this.getCol(row, colIndexMap.category) : '') || 'GENERAL SPECIALS';
      const rawPrice = colIndexMap.price !== -1 ? this.getCol(row, colIndexMap.price) : '';
      const description = colIndexMap.description !== -1 ? this.getCol(row, colIndexMap.description) : '';
      const rawVeg = colIndexMap.vegType !== -1 ? this.getCol(row, colIndexMap.vegType) : '';

      // Parse price & variants
      const basePrice = this.extractNumber(rawPrice);
      const variants: StagedVariant[] = [];

      if (colIndexMap.halfPrice !== -1) {
        const hp = this.extractNumber(this.getCol(row, colIndexMap.halfPrice));
        if (hp) variants.push({ name: 'Half', price: hp, confidence: 1.0 });
      }
      if (colIndexMap.fullPrice !== -1) {
        const fp = this.extractNumber(this.getCol(row, colIndexMap.fullPrice));
        if (fp) variants.push({ name: 'Full', price: fp, confidence: 1.0 });
      }

      let vegType: 'veg' | 'non-veg' | 'egg' | 'vegan' = 'veg';
      if (/(?:non|chicken|mutton|fish|egg)/i.test(rawVeg || itemName)) {
        vegType = 'non-veg';
      }

      const item: StagedMenuItem = {
        categoryName,
        itemName,
        description: description || null,
        basePrice,
        vegType,
        isBestseller: false,
        variants,
        customizations: [],
        confidenceScore: 1.0,
        needsReview: false,
        syncAction: 'create'
      };

      const normalizedCat = categoryName.toUpperCase();
      if (!categoriesMap.has(normalizedCat)) {
        categoriesMap.set(normalizedCat, []);
      }
      categoriesMap.get(normalizedCat)!.push(item);
      itemsDetected++;
    }

    const categories: ParsedCategoryGroup[] = Array.from(categoriesMap.entries()).map(([name, items], idx) => ({
      id: `cat_csv_${idx + 1}`,
      name,
      confidence: 1.0,
      items
    }));

    const finalConfidence = (itemsDetected === 0 && categories.length === 0) ? 0.0 : 1.0;

    const report: IngestionReport = {
      detectedFormat: 'csv',
      mimeType: detection.mimeType,
      originalFilename: filename,
      pagesProcessed: 1,
      itemsDetected,
      categoriesDetected: categories.length,
      skippedCount,
      confidenceScore: finalConfidence,
      warnings
    };

    return { categories, report };
  }

  private getCol(row: string[], idx: number | undefined): string {
    if (idx === undefined || idx < 0 || idx >= row.length) return '';
    return row[idx]?.trim() || '';
  }

  private parseCSVLine(text: string, delimiter: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  private mapColumns(header: string[]): Record<string, number> {
    const map = { category: -1, itemName: -1, price: -1, description: -1, vegType: -1, halfPrice: -1, fullPrice: -1 };
    for (let i = 0; i < header.length; i++) {
      const col = header[i]!;
      if (/category|section|group/i.test(col)) map.category = i;
      else if (/item|name|title|product/i.test(col)) map.itemName = i;
      else if (/half/i.test(col)) map.halfPrice = i;
      else if (/full/i.test(col)) map.fullPrice = i;
      else if (/price|rate|cost|amount/i.test(col)) map.price = i;
      else if (/desc|detail|ingredients/i.test(col)) map.description = i;
      else if (/veg|type|diet/i.test(col)) map.vegType = i;
    }
    return map;
  }

  private extractNumber(val: string): number | null {
    if (!val) return null;
    const match = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(match);
    return !isNaN(num) && num > 0 ? num : null;
  }
}
