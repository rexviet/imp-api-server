export interface StorageFile {
  filename: string;
  path: string;
  bucket: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface UploadOptions {
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface IStorageProvider {
  /**
   * Uploads a file to the storage provider
   */
  upload(
    file: Buffer,
    path: string,
    options?: UploadOptions,
  ): Promise<StorageFile>;

  /**
   * Downloads a file from the storage provider as a Buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * Deletes a file from the storage provider
   */
  delete(path: string): Promise<void>;

  /**
   * Generates a presigned URL for temporary access to a file (reading)
   */
  getPresignedUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Generates a presigned URL for uploading a file (writing)
   */
  getPresignedUploadUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Checks if a file exists in the storage provider
   */
  exists(path: string): Promise<boolean>;
}
