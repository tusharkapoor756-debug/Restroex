import { ParsedCategoryGroup, ImageQualityReport } from '../../types/menu-import.types';

export type DetectedFormat =
  | 'image'
  | 'pdf'
  | 'csv'
  | 'excel'
  | 'json'
  | 'unknown';

export interface FileTypeDetectionResult {
  format: DetectedFormat;
  mimeType: string;
  extension: string;
  confidence: number;
}

export interface ProcessingWarning {
  code: string;
  message: string;
  pageIndex?: number;
  rowIndex?: number;
}

export interface IngestionReport {
  detectedFormat: DetectedFormat;
  mimeType: string;
  originalFilename: string;
  pagesProcessed: number;
  totalPages?: number;
  itemsDetected: number;
  categoriesDetected: number;
  skippedCount: number;
  confidenceScore: number;
  warnings: ProcessingWarning[];
  qualityReport?: ImageQualityReport;
}

export interface DocumentProcessingResult {
  categories: ParsedCategoryGroup[];
  report: IngestionReport;
}

export interface IDocumentProcessor {
  readonly supportedFormats: DetectedFormat[];
  process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult>;
}
