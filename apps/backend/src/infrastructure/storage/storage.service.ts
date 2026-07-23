import { IStorageService } from './storage.interface';
import { db } from '../database/database.client';
import { logger } from '../logger/logger';

export class StorageService implements IStorageService {
  private client = db.getClient().storage;

  /**
   * Ensures the bucket exists. If not, it creates a private bucket.
   */
  private async ensureBucket(bucket: string): Promise<void> {
    try {
      const { data: buckets, error } = await this.client.listBuckets();
      if (error) {
        logger.warn({ error, bucket }, 'Failed to list buckets, proceeding anyway');
        return;
      }

      const exists = buckets.some((b) => b.name === bucket);
      if (!exists) {
        const { error: createError } = await this.client.createBucket(bucket, {
          public: false, // Buckets must remain PRIVATE
        });
        if (createError) {
          logger.warn({ error: createError, bucket }, 'Failed to create bucket, proceeding anyway');
        } else {
          logger.info({ bucket }, 'Created private bucket');
        }
      }
    } catch (e) {
      logger.warn({ error: e, bucket }, 'ensureBucket failed, proceeding to direct upload');
    }
  }

  public async upload(bucket: string, path: string, fileData: Buffer, contentType?: string): Promise<string> {
    await this.ensureBucket(bucket);
    const { data, error } = await this.client.from(bucket).upload(path, fileData, {
      contentType: contentType ?? 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      logger.error({ error, bucket, path }, 'Upload failed');
      throw new Error(`Upload failed: ${error.message}`);
    }

    return `${bucket}/${data.path}`;
  }

  public async download(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.from(bucket).download(path);
    if (error || !data) {
      throw new Error(`Download failed: ${error?.message || 'No data returned'}`);
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  public async delete(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.client.from(bucket).remove(paths);
    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  public async move(bucket: string, fromPath: string, toPath: string): Promise<string> {
    const { error } = await this.client.from(bucket).move(fromPath, toPath);
    if (error) {
      throw new Error(`Move failed: ${error.message}`);
    }
    return `${bucket}/${toPath}`;
  }

  public async copy(bucket: string, fromPath: string, toPath: string): Promise<string> {
    const { error } = await this.client.from(bucket).copy(fromPath, toPath);
    if (error) {
      throw new Error(`Copy failed: ${error.message}`);
    }
    return `${bucket}/${toPath}`;
  }

  public async exists(bucket: string, path: string): Promise<boolean> {
    // A trick to check existence without downloading: list the directory
    const dir = path.substring(0, path.lastIndexOf('/'));
    const filename = path.substring(path.lastIndexOf('/') + 1);

    const { data, error } = await this.client.from(bucket).list(dir, {
      limit: 100,
      search: filename,
    });

    if (error) return false;
    return data?.some((f) => f.name === filename) ?? false;
  }

  public async generateSignedUrl(bucket: string, path: string, expiresInSeconds = 60 * 60): Promise<string> {
    const { data, error } = await this.client.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message}`);
    }
    return data.signedUrl;
  }
}

// Export a singleton instance
export const storageService = new StorageService();
