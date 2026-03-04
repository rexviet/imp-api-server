import { MinioStorageProvider } from '../src/storage/providers/minio-storage.provider';

// Mock ConfigService manually
const mockConfig: any = {
  get: (key: string, defaultValue?: any) => {
    const env: Record<string, string> = {
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_BUCKET: 'ielts-master-records',
      MINIO_USE_SSL: 'false',
    };
    return env[key] || defaultValue;
  }
};

async function verify() {
  const provider = new MinioStorageProvider(mockConfig);
  
  console.log('--- Initializing MinIO Provider ---');
  await provider.onModuleInit();
  
  const testPath = 'test-upload.txt';
  const testBuffer = Buffer.from('Hello IELTS Master Storage');
  
  console.log('--- Uploading test file ---');
  await provider.upload(testBuffer, testPath, { contentType: 'text/plain' });
  
  console.log('--- Checking if file exists ---');
  const exists = await provider.exists(testPath);
  console.log(`Exists: ${exists}`);
  
  console.log('--- Downloading file ---');
  const downloaded = await provider.download(testPath);
  console.log(`Content: ${downloaded.toString()}`);
  
  console.log('--- Generating Presigned URL ---');
  const url = await provider.getPresignedUrl(testPath);
  console.log(`URL: ${url}`);
  
  console.log('--- Verification Complete! ---');
}

verify().catch(console.error);
