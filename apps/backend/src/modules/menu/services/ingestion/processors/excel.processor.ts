import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult, IngestionReport, ProcessingWarning } from '../ingestion.types';
import { ParsedCategoryGroup, StagedMenuItem, StagedVariant } from '../../../types/menu-import.types';
import * as zlib from 'zlib';

export class ExcelProcessor implements IDocumentProcessor {
  public readonly supportedFormats: DetectedFormat[] = ['excel'];

  public async process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult> {
    console.log(`\n===============================================================`);
    console.log(`[EXCEL PROCESSOR] Forensic Workbook Analysis for "${filename}"`);
    console.log(`===============================================================`);

    const warnings: ProcessingWarning[] = [];

    // Stage 1: Workbook opened
    if (!buffer || buffer.length < 30) {
      console.error(`Stage 1: Workbook opened? ❌ FAILED (Invalid/Empty buffer, size: ${buffer?.length || 0} bytes)`);
      return this.buildEmptyResult(filename, detection, warnings, 'EMPTY_FILE', 'Excel buffer is empty or corrupted');
    }
    console.log(`Stage 1: Workbook opened? ✅ SUCCESS (${buffer.length} bytes read)`);

    // Extract Zip Entries from XLSX Buffer
    const zipEntries = this.unzipXlsx(buffer);

    // Stage 2: Total worksheets detected
    const sheetFiles = Array.from(zipEntries.keys()).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
    console.log(`Stage 2: Total worksheets detected: ${sheetFiles.length} (${sheetFiles.join(', ') || 'None'})`);

    if (sheetFiles.length === 0) {
      console.error(`Stage 2 Failure: No worksheet XML entries found in XLSX container.`);
      return this.buildEmptyResult(filename, detection, warnings, 'NO_WORKSHEET', 'No valid worksheets found in Excel file');
    }

    // Stage 3: Active worksheet selected
    const activeSheetName = sheetFiles[0]!;
    const activeSheetXml = zipEntries.get(activeSheetName) || '';
    const sharedStringsXml = zipEntries.get('xl/sharedStrings.xml') || '';

    console.log(`Stage 3: Active worksheet selected: "${activeSheetName}" (${activeSheetXml.length} bytes XML)`);

    // Parse Shared Strings Table
    const sharedStrings = this.parseSharedStrings(sharedStringsXml);
    console.log(`[ExcelProcessor] Shared strings dictionary parsed: ${sharedStrings.length} entries`);

    // Parse Rows & Cell Matrix from Worksheet XML
    const rawMatrix = this.parseWorksheetRows(activeSheetXml, sharedStrings);

    // Stage 4 & 5: Rows & Columns
    const rowCount = rawMatrix.length;
    const colCount = rowCount > 0 ? Math.max(...rawMatrix.map((r) => r.length)) : 0;

    console.log(`Stage 4: Number of rows: ${rowCount}`);
    console.log(`Stage 5: Number of columns: ${colCount}`);

    // Stage 6: First 10 rows exactly as parsed
    console.log(`Stage 6: First 10 rows parsed:`);
    const previewRows = rawMatrix.slice(0, 10);
    if (previewRows.length === 0) {
      console.log(`   (No rows found in worksheet XML)`);
    } else {
      previewRows.forEach((r, idx) => {
        console.log(`   Row ${idx + 1}: [${r.map((c) => `"${c}"`).join(', ')}]`);
      });
    }

    if (rowCount === 0) {
      console.error(`Stage 6 Failure: Data disappeared because worksheet contained 0 cell values.`);
      return this.buildEmptyResult(filename, detection, warnings, 'EMPTY_WORKSHEET', 'Worksheet contains no data rows');
    }

    // Stage 7: Header row detected?
    let headerRowIndex = -1;
    let colIndexMap: Record<string, number> = { category: -1, itemName: -1, price: -1, description: -1, vegType: -1, halfPrice: -1, fullPrice: -1 };

    for (let r = 0; r < Math.min(rawMatrix.length, 5); r++) {
      const candidateHeader = rawMatrix[r]!.map((c) => c.toLowerCase().trim());
      const mapped = this.mapColumns(candidateHeader);
      if (mapped.itemName !== -1 || mapped.price !== -1) {
        headerRowIndex = r;
        colIndexMap = mapped;
        break;
      }
    }

    const headerDetected = headerRowIndex !== -1;
    console.log(`Stage 7: Header row detected? ${headerDetected ? '✅ YES' : '⚠️ NO (Falling back to column defaults)'} (Header Index: ${headerRowIndex})`);

    // Stage 8: Column mapping result
    console.log(`Stage 8: Column mapping result:`, JSON.stringify(colIndexMap));

    // Stage 9: Normalized menu rows generated
    const dataRows = headerRowIndex !== -1 ? rawMatrix.slice(headerRowIndex + 1) : rawMatrix;
    const categoriesMap = new Map<string, StagedMenuItem[]>();
    let skippedCount = 0;
    let itemsDetected = 0;

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx]!;
      if (row.length === 0 || row.every((c) => c.trim().length === 0)) {
        skippedCount++;
        continue;
      }

      const itemName = colIndexMap.itemName !== -1 ? this.getCol(row, colIndexMap.itemName) : this.getCol(row, 0);
      if (!itemName || itemName.length < 2 || /^item|name|title|product$/i.test(itemName)) {
        skippedCount++;
        continue;
      }

      const categoryName = (colIndexMap.category !== -1 ? this.getCol(row, colIndexMap.category) : '') || 'GENERAL SPECIALS';
      const rawPrice = colIndexMap.price !== -1 ? this.getCol(row, colIndexMap.price) : this.getCol(row, 1);
      const description = colIndexMap.description !== -1 ? this.getCol(row, colIndexMap.description) : '';
      const rawVeg = colIndexMap.vegType !== -1 ? this.getCol(row, colIndexMap.vegType) : '';

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

    console.log(`Stage 9: Normalized menu rows generated: ${itemsDetected} items across ${categoriesMap.size} categories (Skipped: ${skippedCount})`);

    const categories: ParsedCategoryGroup[] = Array.from(categoriesMap.entries()).map(([name, items], idx) => ({
      id: `cat_excel_${idx + 1}`,
      name,
      confidence: 1.0,
      items
    }));

    // Enforce Rule: Confidence must NEVER exceed 0 when items == 0 && categories == 0
    const finalConfidence = (itemsDetected === 0 && categories.length === 0) ? 0.0 : 1.0;

    // Stage 10: Final MenuDocument
    console.log(`Stage 10: Final MenuDocument: Categories: ${categories.length} | Items: ${itemsDetected} | Confidence: ${finalConfidence}`);
    console.log(`===============================================================\n`);

    const report: IngestionReport = {
      detectedFormat: 'excel',
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

  private buildEmptyResult(
    filename: string,
    detection: FileTypeDetectionResult,
    warnings: ProcessingWarning[],
    code: string,
    message: string
  ): DocumentProcessingResult {
    warnings.push({ code, message });
    return {
      categories: [],
      report: {
        detectedFormat: 'excel',
        mimeType: detection.mimeType,
        originalFilename: filename,
        pagesProcessed: 1,
        itemsDetected: 0,
        categoriesDetected: 0,
        skippedCount: 0,
        confidenceScore: 0.0, // Enforced 0.0 confidence for empty imports
        warnings
      }
    };
  }

  /**
   * Deterministic Zip Unpacker for XLSX files using Node zlib
   */
  private unzipXlsx(buffer: Buffer): Map<string, string> {
    const files = new Map<string, string>();
    let offset = 0;

    while (offset < buffer.length - 30) {
      // Local File Header Signature: 0x50 0x4B 0x03 0x04
      if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4b && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
        const compMethod = buffer.readUInt16LE(offset + 8);
        const compSize = buffer.readUInt32LE(offset + 18);
        const filenameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);

        const filename = buffer.toString('utf-8', offset + 30, offset + 30 + filenameLen);
        const dataStart = offset + 30 + filenameLen + extraLen;
        const compData = buffer.slice(dataStart, dataStart + compSize);

        let content = '';
        if (compMethod === 0) {
          content = compData.toString('utf-8');
        } else if (compMethod === 8) {
          try {
            const decomp = zlib.inflateRawSync(compData);
            content = decomp.toString('utf-8');
          } catch {
            // Decompression error fallback
          }
        }

        if (filename && content) {
          files.set(filename, content);
        }

        offset = dataStart + compSize;
      } else {
        offset++;
      }
    }

    return files;
  }

  /**
   * Parse xl/sharedStrings.xml entries
   */
  private parseSharedStrings(xmlStr: string): string[] {
    const strings: string[] = [];
    if (!xmlStr) return strings;

    // Match <si>...</si> string items
    const siRegex = /<si>(.*?)<\/si>/gi;
    let match: RegExpExecArray | null;

    while ((match = siRegex.exec(xmlStr)) !== null) {
      const itemXml = match[1] || '';
      const textMatches = itemXml.match(/<t[^>]*>(.*?)<\/t>/gi) || [];
      const text = textMatches
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
        .trim();
      strings.push(text);
    }

    return strings;
  }

  /**
   * Parse sheet XML rows & cells
   */
  private parseWorksheetRows(sheetXml: string, sharedStrings: string[]): string[][] {
    const matrix: string[][] = [];
    if (!sheetXml) return matrix;

    const rowRegex = /<row[^>]*>(.*?)<\/row>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowContent = rowMatch[1] || '';
      const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:\s+t="([a-z]+)")?[^>]*>(?:<v>(.*?)<\/v>)?/gi;
      let cellMatch: RegExpExecArray | null;

      const rowCells: Array<{ colIdx: number; val: string }> = [];

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const colLetters = cellMatch[1] || 'A';
        const type = cellMatch[3];
        let rawVal = cellMatch[4] || '';

        const colIdx = this.colLettersToIndex(colLetters);

        let cellVal = rawVal;
        if (type === 's') {
          // Shared string reference index
          const strIdx = parseInt(rawVal, 10);
          cellVal = !isNaN(strIdx) && sharedStrings[strIdx] ? sharedStrings[strIdx]! : rawVal;
        } else if (type === 'inlineStr') {
          const inlineMatch = cellContentMatch(rowContent);
          cellVal = inlineMatch;
        }

        rowCells.push({ colIdx, val: cellVal.trim() });
      }

      if (rowCells.length > 0) {
        const maxCol = Math.max(...rowCells.map((c) => c.colIdx));
        const rowArr = new Array(maxCol + 1).fill('');
        for (const cell of rowCells) {
          rowArr[cell.colIdx] = cell.val;
        }
        matrix.push(rowArr);
      }
    }

    return matrix;

    function cellContentMatch(str: string): string {
      const m = str.match(/<t[^>]*>(.*?)<\/t>/i);
      return m && m[1] ? m[1] : '';
    }
  }

  private colLettersToIndex(letters: string): number {
    let index = 0;
    for (let i = 0; i < letters.length; i++) {
      index = index * 26 + (letters.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  private getCol(row: string[], idx: number | undefined): string {
    if (idx === undefined || idx < 0 || idx >= row.length) return '';
    return row[idx]?.trim() || '';
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
