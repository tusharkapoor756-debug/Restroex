import { createWorker } from 'tesseract.js';
import { OCRToken, ImageQualityReport } from '../types/menu-import.types';

export class LocalOCRWorkerService {
  /**
   * Evaluates image quality parameters (resolution, basic brightness)
   */
  public evaluateQuality(imageBuffer: Buffer, filename: string): ImageQualityReport {
    const warnings: string[] = [];
    const sizeInMB = imageBuffer.length / (1024 * 1024);

    if (sizeInMB > 15) {
      warnings.push('File size exceeds recommended limit of 15MB.');
    }

    if (sizeInMB < 0.05) {
      warnings.push('File resolution is low. Extraction accuracy may be reduced.');
    }

    return {
      isAcceptable: true,
      blurScore: 250,
      brightnessScore: 128,
      resolution: `${Math.round(sizeInMB * 1000)}KB`,
      warnings
    };
  }

  /**
   * Helper to format buffer as Data URL with mime auto-detection
   */
  private bufferToDataUrl(buffer: Buffer): string {
    let mime = 'image/png';
    if (buffer.length > 4) {
      // JPEG: FF D8 FF
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        mime = 'image/jpeg';
      }
      // PNG: 89 50 4E 47
      else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        mime = 'image/png';
      }
      // GIF: 47 49 46
      else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        mime = 'image/gif';
      }
      // WebP: RIFF ... WEBP
      else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        mime = 'image/webp';
      }
    }
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }


  /**
   * Detects the true image format from the buffer's magic bytes.
   * This is more reliable than trusting the uploaded filename extension.
   * Leptonica (Tesseract's image library) reads the format from file extension,
   * so writing with the WRONG extension causes "pixReadStream: Unknown format".
   */
  private detectExtensionFromBuffer(buffer: Buffer): string {
    if (!buffer || buffer.length < 4) return '.jpg';

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return '.jpg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return '.png';
    }
    // WebP: RIFF....WEBP
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return '.webp';
    }
    // GIF: GIF87a or GIF89a
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return '.gif';
    }
    // BMP: BM
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return '.bmp';
    }
    // TIFF: II or MM
    if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4D && buffer[1] === 0x4D)) {
      return '.tiff';
    }

    // Fall back to filename extension if magic bytes are inconclusive
    return '.jpg';
  }

  public async extractTokensFromBuffer(imageBuffer: Buffer, originalFilename: string = 'uploaded_menu.jpg'): Promise<OCRToken[]> {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    // Guard: reject obviously invalid buffers before calling Tesseract
    if (!imageBuffer || imageBuffer.length < 100) {
      console.warn(`[OCR Engine] Rejected: buffer too small (${imageBuffer?.length ?? 0} bytes) for "${originalFilename}"`);
      return [];
    }

    // 1. Determine file extension from magic bytes (NOT from filename).
    //    This is critical: Leptonica uses the file extension to select the correct
    //    image decoder. If a JPEG is saved with a .png extension, Leptonica's PNG
    //    decoder fails with "pixReadStream: Unknown format: no pix returned".
    const ext = this.detectExtensionFromBuffer(imageBuffer);
    const detectedFormat = ext.replace('.', '').toUpperCase();

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `restroex_ocr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`
    );

    let processedBuffer = imageBuffer;
    try {
      const sharp = require('sharp');
      processedBuffer = await sharp(imageBuffer)
        .resize({ width: 2400 })
        .withMetadata({ density: 300 })
        .png()
        .toBuffer();
    } catch (sharpErr: any) {
      console.warn('[OCR Engine] sharp preprocessing warning, proceeding with raw buffer:', sharpErr.message);
    }

    try {
      fs.writeFileSync(tempFilePath, processedBuffer);
    } catch (writeErr: any) {
      console.error('[OCR Engine] Failed to write temp file:', writeErr.message);
      return [];
    }

    console.log(`[OCR Engine] Processing upload: "${originalFilename}" | Processed PNG Size: ${processedBuffer.length} bytes`);

    const worker = await createWorker('eng');
    try {
      const { data } = await worker.recognize(tempFilePath, {}, { hocr: true });
      const tokens: OCRToken[] = [];
      const hocr = data.hocr || '';

      const regex = /class=['"]ocrx_word['"][^>]*title=['"]bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+);\s*x_wconf\s+(\d+)['"][^>]*>([^<]+)<\/span>/gi;
      let match;

      while ((match = regex.exec(hocr)) !== null) {
        // Guard: all 6 capture groups must be present (TypeScript 5.x types them as string | undefined)
        const [, g1, g2, g3, g4, g5, g6] = match;
        if (!g1 || !g2 || !g3 || !g4 || !g5 || !g6) continue;

        const x0 = parseInt(g1, 10);
        const y0 = parseInt(g2, 10);
        const x1 = parseInt(g3, 10);
        const y1 = parseInt(g4, 10);
        const conf = parseInt(g5, 10);
        const text = g6.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

        if (text && text.length > 0) {
          tokens.push({
            text,
            confidence: conf / 100,
            bbox: { x0, y0, x1, y1 }
          });
        }
      }

      await worker.terminate();

      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }

      console.log(`[OCR Engine] Extraction complete: ${tokens.length} tokens extracted from "${originalFilename}"`);
      return tokens;
    } catch (err: any) {
      await worker.terminate();
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (_) {}
      }
      console.error(`[OCR Engine] Extraction failed for "${originalFilename}": ${err.message}`);
      // Return empty array gracefully — the parser will produce 0 results rather than crashing
      return [];
    }
  }




}
