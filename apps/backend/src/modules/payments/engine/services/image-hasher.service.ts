import crypto from 'crypto';

export class ImageHasherService {
  /**
   * Generates a deterministic SHA-256 hash of an image buffer or string data.
   * Enables 0ms short-circuit duplicate detection for re-uploaded screenshots.
   */
  public static generateHash(data: Buffer | string): string {
    const hash = crypto.createHash('sha256');
    if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(Buffer.from(data, 'utf-8'));
    }
    return hash.digest('hex');
  }
}
