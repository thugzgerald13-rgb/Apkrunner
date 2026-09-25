// /apps/api/src/minio.ts
import { Client as MinioClient } from 'minio';

const endpoint = process.env.S3_ENDPOINT || 'localhost';
const port = parseInt(process.env.S3_PORT || '9000', 10);
const useSSL = process.env.S3_USE_SSL === 'true';
const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.S3_SECRET_KEY || 'minioadmin123';

export const BUCKET_APKS = process.env.S3_BUCKET_APKS || 'apkrunner-apks';
export const BUCKET_ICONS = process.env.S3_BUCKET_ICONS || 'apkrunner-icons';

export const minioClient = new MinioClient({
  endPoint: endpoint,
  port: port,
  useSSL: useSSL,
  accessKey: accessKey,
  secretKey: secretKey,
});

export async function initStorageBuckets(): Promise<void> {
  const buckets = [BUCKET_APKS, BUCKET_ICONS];
  for (const bucket of buckets) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket, 'us-east-1');
        console.log(`[MinIO] Created storage bucket: ${bucket}`);
      }
    } catch (err: unknown) {
      console.warn(`[MinIO] Bucket check/create note for ${bucket}:`, err instanceof Error ? err.message : String(err));
    }
  }
}

export async function uploadApkBuffer(
  objectName: string,
  buffer: Buffer,
  metaData: Record<string, string> = {}
): Promise<string> {
  await minioClient.putObject(
    BUCKET_APKS,
    objectName,
    buffer,
    buffer.length,
    {
      'Content-Type': 'application/vnd.android.package-archive',
      ...metaData,
    }
  );
  return `s3://${BUCKET_APKS}/${objectName}`;
}

export async function uploadIconBuffer(
  objectName: string,
  buffer: Buffer,
  mimeType: string = 'image/png'
): Promise<string> {
  await minioClient.putObject(
    BUCKET_ICONS,
    objectName,
    buffer,
    buffer.length,
    {
      'Content-Type': mimeType,
    }
  );
  // Presigned or direct storage url
  return `/storage/${BUCKET_ICONS}/${objectName}`;
}

export async function getPresignedDownloadUrl(objectName: string, expirySeconds: number = 900): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET_APKS, objectName, expirySeconds);
}

export async function getPresignedUploadUrl(objectName: string, expirySeconds: number = 900): Promise<string> {
  return await minioClient.presignedPutObject(BUCKET_APKS, objectName, expirySeconds);
}

export async function deleteApkObject(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_APKS, objectName);
}
