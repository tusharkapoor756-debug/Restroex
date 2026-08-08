import sharp from 'sharp';
import { logger } from '../../infrastructure/logger/logger';
import { storageService } from '../../infrastructure/storage/storage.service';
import { BadRequestError } from '../errors/app-error';

export interface IMediaStorageService {
  processAndOptimizeImage(fileBuffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string; extension: string }>;
  uploadMedia(bucket: string, fileBuffer: Buffer, mimeType: string, filename: string): Promise<string>;
  deleteMedia(bucket: string, fileUrlOrPath: string): Promise<void>;
  replaceMedia(
    bucket: string,
    oldUrlOrPath: string | null,
    newFileBuffer: Buffer,
    mimeType: string,
    filename: string,
    dbUpdateCallback: (newUrl: string) => Promise<void>
  ): Promise<string>;
}

export class MediaStorageService implements IMediaStorageService {
  private readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ]);

  private readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB max upload threshold

  /**
   * Validates, resizes, compresses, and converts incoming image buffers to WebP format.
   */
  public async processAndOptimizeImage(
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestError('Empty file payload provided');
    }

    if (fileBuffer.length > this.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(`File size exceeds maximum threshold of 10MB (${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB)`);
    }

    if (!this.ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestError(`Invalid file format '${mimeType}'. Supported formats: JPEG, PNG, WebP, GIF, SVG.`);
    }

    // Preserve SVG vectors without rasterization
    if (mimeType.toLowerCase() === 'image/svg+xml') {
      return { buffer: fileBuffer, mimeType: 'image/svg+xml', extension: '.svg' };
    }

    try {
      // Automatic Resize (max 1600px width/height) + WebP Conversion & Compression
      const optimizedBuffer = await sharp(fileBuffer)
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();

      return {
        buffer: optimizedBuffer,
        mimeType: 'image/webp',
        extension: '.webp',
      };
    } catch (err) {
      logger.warn({ err, mimeType }, 'Sharp image optimization failed. Falling back to original buffer...');
      const ext = mimeType.includes('/') ? `.${mimeType.split('/')[1]}` : '.bin';
      return { buffer: fileBuffer, mimeType, extension: ext };
    }
  }

  /**
   * Uploads an optimized media file to the storage provider.
   */
  public async uploadMedia(
    bucket: string,
    fileBuffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<string> {
    const publicUrl = await storageService.upload(bucket, filename, fileBuffer, mimeType);
    return publicUrl;
  }

  /**
   * Deletes a media file from the storage provider.
   */
  public async deleteMedia(bucket: string, fileUrlOrPath: string): Promise<void> {
    if (!fileUrlOrPath) return;
    try {
      await storageService.delete(bucket, [fileUrlOrPath]);
      logger.info({ bucket, fileUrlOrPath }, 'Media file deleted successfully from storage provider');
    } catch (err) {
      logger.warn({ err, bucket, fileUrlOrPath }, 'Failed to delete media file from storage provider');
    }
  }

  /**
   * Single Entry Point Transaction-Safe Media Replacement:
   * 1. Validates, resizes, and converts image buffer to WebP via Sharp.
   * 2. Uploads optimized WebP image to storage provider.
   * 3. Executes database update callback to associate new URL.
   * 4. Deletes old media file ONLY IF step 2 & 3 succeed.
   * 5. If DB update fails, deletes newly uploaded WebP file to prevent orphan storage bloat.
   */
  public async replaceMedia(
    bucket: string,
    oldUrlOrPath: string | null,
    newFileBuffer: Buffer,
    mimeType: string,
    filename: string,
    dbUpdateCallback: (newUrl: string) => Promise<void>
  ): Promise<string> {
    // 1. Process, Resize & Convert to WebP
    const { buffer: processedBuffer, mimeType: processedMime, extension } =
      await this.processAndOptimizeImage(newFileBuffer, mimeType);

    const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const finalFilename = `${baseName}_${Date.now()}${extension}`;

    // 2. Upload optimized WebP file
    const newPublicUrl = await this.uploadMedia(bucket, processedBuffer, processedMime, finalFilename);

    try {
      // 3. Execute database update callback
      await dbUpdateCallback(newPublicUrl);
    } catch (dbError) {
      // Rollback: delete newly uploaded file if DB update fails
      logger.error({ dbError, newPublicUrl }, 'DB update failed during media replacement. Rolling back newly uploaded file...');
      await this.deleteMedia(bucket, newPublicUrl).catch(() => {});
      throw dbError;
    }

    // 4. Delete old media file ONLY after successful DB commit
    if (oldUrlOrPath && oldUrlOrPath !== newPublicUrl) {
      this.deleteMedia(bucket, oldUrlOrPath).catch((err) => {
        logger.warn({ err, oldUrlOrPath }, 'Non-fatal: Old media file cleanup failed after DB commit');
      });
    }

    return newPublicUrl;
  }
}

export const mediaStorageService = new MediaStorageService();
