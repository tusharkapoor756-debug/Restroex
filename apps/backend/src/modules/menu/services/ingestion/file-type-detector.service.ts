import { FileTypeDetectionResult, DetectedFormat } from './ingestion.types';

export class FileTypeDetectorService {
  /**
   * Detects true document format from buffer magic bytes & header signatures.
   */
  public detect(buffer: Buffer, fallbackFilename: string = ''): FileTypeDetectionResult {
    if (!buffer || buffer.length === 0) {
      return { format: 'unknown', mimeType: 'application/octet-stream', extension: 'bin', confidence: 0 };
    }

    // 1. PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return { format: 'pdf', mimeType: 'application/pdf', extension: 'pdf', confidence: 1.0 };
    }

    // 2. PNG Magic Bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47
    ) {
      return { format: 'image', mimeType: 'image/png', extension: 'png', confidence: 1.0 };
    }

    // 3. JPEG Magic Bytes: 0xFF 0xD8 0xFF
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return { format: 'image', mimeType: 'image/jpeg', extension: 'jpg', confidence: 1.0 };
    }

    // 4. WEBP Magic Bytes: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return { format: 'image', mimeType: 'image/webp', extension: 'webp', confidence: 1.0 };
    }

    // 5. GIF Magic Bytes: GIF87a or GIF89a (0x47 0x49 0x46)
    if (buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return { format: 'image', mimeType: 'image/gif', extension: 'gif', confidence: 1.0 };
    }

    // 6. BMP Magic Bytes: BM (0x42 0x4D)
    if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return { format: 'image', mimeType: 'image/bmp', extension: 'bmp', confidence: 0.9 };
    }

    // 7. TIFF Magic Bytes: II*. or MM.* (0x49 0x49 or 0x4D 0x4D)
    if (
      buffer.length >= 4 &&
      ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4d && buffer[1] === 0x4d))
    ) {
      return { format: 'image', mimeType: 'image/tiff', extension: 'tiff', confidence: 0.95 };
    }

    // 8. ZIP / XLSX Magic Bytes: PK.. (0x50 0x4B 0x03 0x04)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return { format: 'excel', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', confidence: 0.95 };
    }

    // 9. Text inspection (JSON or CSV)
    const sampleText = buffer.slice(0, Math.min(buffer.length, 2048)).toString('utf-8').trim();

    // Check JSON signature: starts with { or [
    if ((sampleText.startsWith('{') && sampleText.endsWith('}')) || (sampleText.startsWith('[') && sampleText.endsWith(']'))) {
      try {
        JSON.parse(sampleText);
        return { format: 'json', mimeType: 'application/json', extension: 'json', confidence: 1.0 };
      } catch {
        // Continue to CSV check
      }
    }

    // Check CSV signature: contains linebreaks and delimited columns (commas, semicolons, tabs)
    if (sampleText.includes('\n') || sampleText.includes('\r')) {
      const lines = sampleText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length >= 1) {
        const firstLine = lines[0]!;
        if (firstLine.includes(',') || firstLine.includes(';') || firstLine.includes('\t')) {
          return { format: 'csv', mimeType: 'text/csv', extension: 'csv', confidence: 0.85 };
        }
      }
    }

    // 10. Fallback check by extension if magic bytes were inconclusive
    const ext = fallbackFilename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(ext)) {
      return { format: 'image', mimeType: `image/${ext}`, extension: ext, confidence: 0.6 };
    }
    if (ext === 'pdf') {
      return { format: 'pdf', mimeType: 'application/pdf', extension: 'pdf', confidence: 0.6 };
    }
    if (['xlsx', 'xls'].includes(ext)) {
      return { format: 'excel', mimeType: 'application/vnd.ms-excel', extension: ext, confidence: 0.6 };
    }
    if (ext === 'csv') {
      return { format: 'csv', mimeType: 'text/csv', extension: 'csv', confidence: 0.6 };
    }
    if (ext === 'json') {
      return { format: 'json', mimeType: 'application/json', extension: 'json', confidence: 0.6 };
    }

    return { format: 'unknown', mimeType: 'application/octet-stream', extension: 'bin', confidence: 0 };
  }
}
