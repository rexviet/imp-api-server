import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import {
  IStorageProvider,
  StorageFile,
  UploadOptions,
} from '../../common/interfaces/storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements IStorageProvider, OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly logger = new Logger(MinioStorageProvider.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.config.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.config.get('MINIO_PORT', '9000'), 10),
      useSSL: this.config.get('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY'),
      secretKey: this.config.get('MINIO_SECRET_KEY'),
    });
    this.bucket = this.config.get('MINIO_BUCKET', 'ielts-master-records');
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        this.logger.log(`Bucket "${this.bucket}" not found. Creating...`);
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" created successfully.`);
      }
    } catch (e) {
      if (e.code === 'ECONNREFUSED') {
        this.logger.warn(
          `Could not connect to MinIO to ensure bucket exists. Is Docker running?`,
        );
      } else {
        this.logger.error(`Failed to ensure bucket exists: ${e.message}`);
      }
    }
  }

  async upload(
    file: Buffer,
    path: string,
    options?: UploadOptions,
  ): Promise<StorageFile> {
    try {
      const metaData = {
        'Content-Type': options?.contentType || 'application/octet-stream',
        ...options?.metadata,
      };

      await this.client.putObject(
        this.bucket,
        path,
        file,
        file.length,
        metaData,
      );

      this.logger.log(`File uploaded successfully to ${this.bucket}/${path}`);

      return {
        filename: path.split('/').pop() || path,
        path: path,
        bucket: this.bucket,
        mimeType: options?.contentType,
        size: file.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to MinIO: ${error.message}`);
      throw error;
    }
  }

  async download(path: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(this.bucket, path);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => reject(err));
      });
    } catch (error) {
      this.logger.error(`Failed to download file from MinIO: ${error.message}`);
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, path);
      this.logger.log(`File deleted successfully from ${this.bucket}/${path}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from MinIO: ${error.message}`);
      throw error;
    }
  }

  async getPresignedUrl(path: string, expiresIn = 3600): Promise<string> {
    try {
      return await this.client.presignedGetObject(this.bucket, path, expiresIn);
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned GET URL for MinIO: ${error.message}`,
      );
      throw error;
    }
  }

  async getPresignedUploadUrl(path: string, expiresIn = 3600): Promise<string> {
    try {
      return await this.client.presignedPutObject(this.bucket, path, expiresIn);
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned PUT URL for MinIO: ${error.message}`,
      );
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, path);
      return true;
    } catch (e) {
      return false;
    }
  }
}
