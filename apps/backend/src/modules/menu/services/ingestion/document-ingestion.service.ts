import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult } from './ingestion.types';
import { FileTypeDetectorService } from './file-type-detector.service';
import { ImageProcessor } from './processors/image.processor';
import { PDFProcessor } from './processors/pdf.processor';
import { CSVProcessor } from './processors/csv.processor';
import { ExcelProcessor } from './processors/excel.processor';
import { JsonProcessor } from './processors/json.processor';

export class DocumentIngestionService {
  private detector = new FileTypeDetectorService();
  private processors = new Map<DetectedFormat, IDocumentProcessor>();

  constructor() {
    this.registerProcessor(new ImageProcessor());
    this.registerProcessor(new PDFProcessor());
    this.registerProcessor(new CSVProcessor());
    this.registerProcessor(new ExcelProcessor());
    this.registerProcessor(new JsonProcessor());
  }

  /**
   * Register a new pluggable document processor for future file formats.
   */
  public registerProcessor(processor: IDocumentProcessor): void {
    for (const format of processor.supportedFormats) {
      this.processors.set(format, processor);
    }
  }

  /**
   * Universal document ingestion route coordinator.
   */
  public async ingestDocument(
    buffer: Buffer,
    filename: string
  ): Promise<DocumentProcessingResult> {
    // 1. Detect file type using MIME & magic bytes
    const detection = this.detector.detect(buffer, filename);
    console.log(`[DocumentIngestion] Ingesting "${filename}" | Detected format: ${detection.format.toUpperCase()} (${detection.mimeType})`);

    // 2. Resolve processor from registry
    const processor = this.processors.get(detection.format);
    if (!processor) {
      throw new Error(`Unsupported document format '${detection.format}' for file '${filename}'`);
    }

    // 3. Process document through targeted processor
    const result = await processor.process(buffer, filename, detection);

    console.log(
      `[DocumentIngestion] ✅ Ingestion complete | Format: ${result.report.detectedFormat.toUpperCase()} | Pages: ${result.report.pagesProcessed} | Categories: ${result.report.categoriesDetected} | Items: ${result.report.itemsDetected} | Confidence: ${result.report.confidenceScore}`
    );

    return result;
  }
}
