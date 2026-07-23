export interface IStorageService {
  upload(bucket: string, path: string, fileData: Buffer, contentType?: string): Promise<string>;
  download(bucket: string, path: string): Promise<Buffer>;
  delete(bucket: string, paths: string[]): Promise<void>;
  move(bucket: string, fromPath: string, toPath: string): Promise<string>;
  copy(bucket: string, fromPath: string, toPath: string): Promise<string>;
  exists(bucket: string, path: string): Promise<boolean>;
  generateSignedUrl(bucket: string, path: string, expiresInSeconds?: number): Promise<string>;
}
