import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MinioStorageProvider } from './providers/minio-storage.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    MinioStorageProvider,
    {
      provide: 'IStorageProvider',
      useFactory: (
        config: ConfigService,
        minioProvider: MinioStorageProvider,
      ) => {
        const type = config.get('STORAGE_TYPE', 'minio');
        if (type === 'minio') {
          return minioProvider;
        }
        // Future providers (S3, GCS) can be added here
        throw new Error(`Unsupported storage type: ${type}`);
      },
      inject: [ConfigService, MinioStorageProvider],
    },
  ],
  exports: ['IStorageProvider'],
})
export class StorageModule {}
