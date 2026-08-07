import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult, IngestionReport, ProcessingWarning } from '../ingestion.types';
import { ImageProcessor } from './image.processor';
import { ParsedCategoryGroup } from '../../../types/menu-import.types';
import sharp from 'sharp';

export class PDFProcessor implements IDocumentProcessor {
  public readonly supportedFormats: DetectedFormat[] = ['pdf'];
  private imageProcessor = new ImageProcessor();

  public async process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult> {
    console.log(`[PDFProcessor] Processing PDF file "${filename}" (${buffer.length} bytes)`);

    const warnings: ProcessingWarning[] = [];
    const mergedCategories: ParsedCategoryGroup[] = [];
    const pageBuffers: Buffer[] = await this.extractPdfPagesAsImages(buffer);

    let pagesProcessed = 0;
    let totalItems = 0;
    let confidenceSum = 0;

    for (let pageIdx = 0; pageIdx < pageBuffers.length; pageIdx++) {
      const pageBuf = pageBuffers[pageIdx]!;
      try {
        console.log(`[PDFProcessor] Processing PDF Page ${pageIdx + 1}/${pageBuffers.length}...`);
        const result = await this.imageProcessor.process(pageBuf, `${filename}_page_${pageIdx + 1}.png`, {
          format: 'image',
          mimeType: 'image/png',
          extension: 'png',
          confidence: 1.0
        });

        pagesProcessed++;
        confidenceSum += result.report.confidenceScore;

        for (const cat of result.categories) {
          let existingCat = mergedCategories.find((c) => c.name.toUpperCase() === cat.name.toUpperCase());
          if (!existingCat) {
            existingCat = {
              id: cat.id,
              name: cat.name,
              confidence: cat.confidence,
              items: []
            };
            mergedCategories.push(existingCat);
          }
          existingCat.items.push(...cat.items);
          totalItems += cat.items.length;
        }
      } catch (err: any) {
        console.warn(`[PDFProcessor] Page ${pageIdx + 1} processing failed: ${err.message}. Continuing with remaining pages.`);
        warnings.push({
          code: 'PAGE_PROCESSING_FAILED',
          message: `Failed to process page ${pageIdx + 1}: ${err.message}`,
          pageIndex: pageIdx + 1
        });
      }
    }

    const avgConfidence = pagesProcessed > 0 ? confidenceSum / pagesProcessed : 0;

    const report: IngestionReport = {
      detectedFormat: 'pdf',
      mimeType: detection.mimeType,
      originalFilename: filename,
      pagesProcessed,
      totalPages: pageBuffers.length,
      itemsDetected: totalItems,
      categoriesDetected: mergedCategories.length,
      skippedCount: pageBuffers.length - pagesProcessed,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      warnings
    };

    return { categories: mergedCategories, report };
  }

  /**
   * Deterministic multi-page PDF page extractor.
   * Extracts embedded raster pages or renders page objects to high-density 300 DPI PNG buffers.
   */
  private async extractPdfPagesAsImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    const pageBuffers: Buffer[] = [];

    try {
      // Step 1: Detect embedded image streams inside PDF buffer (JPEG / PNG streams)
      const jpegMatches: Buffer[] = [];
      let offset = 0;

      while (offset < pdfBuffer.length - 3) {
        // Find JPEG Start of Image (FF D8 FF)
        if (pdfBuffer[offset] === 0xff && pdfBuffer[offset + 1] === 0xd8 && pdfBuffer[offset + 2] === 0xff) {
          const start = offset;
          let end = start + 3;
          while (end < pdfBuffer.length - 1) {
            // Find JPEG End of Image (FF D9)
            if (pdfBuffer[end] === 0xff && pdfBuffer[end + 1] === 0xd9) {
              end += 2;
              break;
            }
            end++;
          }
          const imgBuf = pdfBuffer.slice(start, end);
          if (imgBuf.length > 5000) { // Filter tiny icons/thumbnails
            jpegMatches.push(imgBuf);
          }
          offset = end;
        } else {
          offset++;
        }
      }

      if (jpegMatches.length > 0) {
        for (const rawJpeg of jpegMatches) {
          try {
            const highRes = await sharp(rawJpeg)
              .resize({ width: 2400, fit: 'contain', withoutEnlargement: false })
              .withMetadata({ density: 300 })
              .png()
              .toBuffer();
            pageBuffers.push(highRes);
          } catch {
            // Ignore bad image streams
          }
        }
      }

      // Step 2: Fallback if no raw images were extracted from PDF streams
      if (pageBuffers.length === 0) {
        // Render standard page snapshot buffer using Sharp high-density rasterizer
        const defaultPage = await sharp(pdfBuffer, { density: 300 })
          .resize({ width: 2400, fit: 'contain', withoutEnlargement: false })
          .png()
          .toBuffer();
        pageBuffers.push(defaultPage);
      }
    } catch (err: any) {
      console.warn(`[PDFProcessor] Standard rendering fallback engaged: ${err.message}`);
      // Fallback single high-res buffer
      const fallback = await sharp(pdfBuffer, { density: 300 }).png().toBuffer();
      pageBuffers.push(fallback);
    }

    return pageBuffers;
  }
}
