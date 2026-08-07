import sharp from 'sharp';

export interface PreprocessorResult {
  imageBuffer: Buffer;
  metadata: {
    width: number;
    height: number;
    dpi: number;
    channels: number;
  };
}

export class ImagePreprocessorService {
  /**
   * Preprocesses raw menu image buffers into standardized 300 DPI high-contrast PNGs.
   */
  public async preprocess(inputBuffer: Buffer): Promise<PreprocessorResult> {
    const sharpInstance = sharp(inputBuffer);
    const meta = await sharpInstance.metadata();

    const targetWidth = 2400; // Standardized high-density width
    let pipeline = sharpInstance;

    // Auto-rotate based on EXIF tag if present
    pipeline = pipeline.rotate();

    // Resize to fixed high-density width while retaining aspect ratio
    pipeline = pipeline.resize({
      width: targetWidth,
      withoutEnlargement: false,
      fit: 'contain',
    });

    // Normalize image contrast and convert to grayscale for optimal OCR thresholding
    pipeline = pipeline
      .grayscale()
      .normalize()
      .sharpen()
      .withMetadata({ density: 300 })
      .png({ compressionLevel: 6 });

    const processedBuffer = await pipeline.toBuffer();
    const finalMeta = await sharp(processedBuffer).metadata();

    return {
      imageBuffer: processedBuffer,
      metadata: {
        width: finalMeta.width || targetWidth,
        height: finalMeta.height || 0,
        dpi: 300,
        channels: finalMeta.channels || 1,
      },
    };
  }
}
