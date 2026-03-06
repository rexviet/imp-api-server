import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioStorageProvider } from './minio-storage.provider';
import * as Minio from 'minio';

// Mock the minio client
jest.mock('minio');

describe('MinioStorageProvider', () => {
  let provider: MinioStorageProvider;
  let mockMinioClient: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: '9000',
        MINIO_ACCESS_KEY: 'test-key',
        MINIO_SECRET_KEY: 'test-secret',
        MINIO_BUCKET: 'test-bucket',
        MINIO_USE_SSL: 'false',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    // Reset the mocked Minio.Client before each test
    mockMinioClient = {
      putObject: jest.fn().mockResolvedValue({}),
      getObject: jest.fn().mockResolvedValue({
        on: jest.fn((event, cb) => {
          if (event === 'data') cb(Buffer.from('test-content'));
          if (event === 'end') cb();
          return mockMinioClient;
        }),
      }),
      removeObject: jest.fn().mockResolvedValue({}),
      presignedGetObject: jest.fn().mockResolvedValue('http://presigned-url'),
      presignedPutObject: jest.fn().mockResolvedValue('http://upload-url'),
      statObject: jest.fn().mockResolvedValue({}),
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn().mockResolvedValue({}),
    };

    (Minio.Client as jest.Mock).mockImplementation(() => mockMinioClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinioStorageProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<MinioStorageProvider>(MinioStorageProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('upload', () => {
    it('should upload a file and return StorageFile info', async () => {
      const buffer = Buffer.from('test');
      const result = await provider.upload(buffer, 'test.txt', {
        contentType: 'text/plain',
      });

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'test-bucket',
        'test.txt',
        buffer,
        buffer.length,
        expect.objectContaining({ 'Content-Type': 'text/plain' }),
      );
      expect(result.path).toBe('test.txt');
    });
  });

  describe('download', () => {
    it('should download a file and return a Buffer', async () => {
      const result = await provider.download('test.txt');
      expect(result.toString()).toBe('test-content');
      expect(mockMinioClient.getObject).toHaveBeenCalledWith(
        'test-bucket',
        'test.txt',
      );
    });
  });

  describe('delete', () => {
    it('should call removeObject', async () => {
      await provider.delete('test.txt');
      expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
        'test-bucket',
        'test.txt',
      );
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate a GET URL', async () => {
      const url = await provider.getPresignedUrl('test.txt');
      expect(url).toBe('http://presigned-url');
      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'test.txt',
        3600,
      );
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should generate a PUT URL', async () => {
      const url = await provider.getPresignedUploadUrl('test.txt');
      expect(url).toBe('http://upload-url');
      expect(mockMinioClient.presignedPutObject).toHaveBeenCalledWith(
        'test-bucket',
        'test.txt',
        3600,
      );
    });
  });

  describe('onModuleInit', () => {
    it("should create bucket if it doesn't exist", async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      await provider.onModuleInit();
      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('test-bucket');
    });
  });
});
