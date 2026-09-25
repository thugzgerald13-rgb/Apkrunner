// /apps/api/src/routes/upload.ts
import { Hono, Context } from 'hono';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth.ts';
import { parseApkBuffer } from '../parser.ts';
import { scanApkBuffer } from '../scanner.ts';
import { uploadApkBuffer, uploadIconBuffer, getPresignedUploadUrl } from '../minio.ts';
import { AppUploadResponse } from '@apkrunner/shared';

export const uploadRoute = new Hono();
const prisma = new PrismaClient();

// Maximum 500MB upload limit
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024;
// Chunked/direct presigned threshold: 50MB
const PRESIGNED_THRESHOLD = 50 * 1024 * 1024;

// Request presigned URL for direct chunked upload for large files > 50MB
uploadRoute.post('/init-large', authMiddleware, async (c: Context) => {
  const body = (await c.req.json()) as { fileName: string; fileSize: number; contentType: string };

  if (!body.fileName || !body.fileSize) {
    return c.json({ error: 'fileName and fileSize are required' }, 400);
  }

  if (body.fileSize > MAX_UPLOAD_SIZE) {
    return c.json({ error: 'File size exceeds maximum allowed 500MB limit' }, 413);
  }

  const cleanName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `uploads/${Date.now()}-${cleanName}`;
  const presignedUrl = await getPresignedUploadUrl(objectKey, 3600);

  return c.json({
    uploadUrl: presignedUrl,
    objectKey,
    maxChunkSize: 10 * 1024 * 1024,
  });
});

// Standard multipart upload with APK MIME validation and extraction
uploadRoute.post('/', authMiddleware, async (c: Context) => {
  try {
    const user = c.get('user') as { id: string; email: string };
    const body = await c.req.parseBody({ all: true });
    const file = body['file'];

    if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
      return c.json({ error: 'Missing or invalid APK file in multipart field "file"' }, 400);
    }

    const fileObj = file as File;

    // MIME type check
    const allowedMimes = [
      'application/vnd.android.package-archive',
      'application/octet-stream',
      'application/x-zip-compressed',
    ];

    if (!fileObj.name.toLowerCase().endsWith('.apk') && !allowedMimes.includes(fileObj.type)) {
      return c.json(
        {
          error: 'Invalid file format. Only Android APK files (application/vnd.android.package-archive) are accepted.',
        },
        415
      );
    }

    if (fileObj.size > MAX_UPLOAD_SIZE) {
      return c.json({ error: 'File exceeds 500MB size limit' }, 413);
    }

    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optional ClamAV Antivirus scanning
    const scan = await scanApkBuffer(buffer);
    if (scan.isInfected) {
      return c.json(
        {
          error: `Security Alert: Malicious binary detected (${scan.virusName || 'Threat'}). Upload rejected.`,
        },
        422
      );
    }

    // Extract package name, version, and icon
    const baseName = fileObj.name.replace(/\.apk$/i, '');
    const meta = await parseApkBuffer(buffer, baseName);

    // Upload APK to MinIO
    const safePackageName = meta.packageName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeVersion = meta.versionName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${safePackageName}/${safeVersion}-${Date.now()}.apk`;

    const fileUrl = await uploadApkBuffer(objectKey, buffer, {
      'x-amz-meta-package': meta.packageName,
      'x-amz-meta-version': meta.versionName,
      'x-amz-meta-uploader': user.id,
    });

    // Upload icon if present
    let iconUrl: string | null = null;
    if (meta.iconBuffer) {
      const iconKey = `${safePackageName}/icon-${Date.now()}.png`;
      iconUrl = await uploadIconBuffer(iconKey, meta.iconBuffer, meta.iconMimeType);
    }

    // Database record creation / upsert App and create Build
    const app = await prisma.app.upsert({
      where: { packageName: meta.packageName },
      update: {
        name: meta.name || baseName,
        iconUrl: iconUrl ?? undefined,
      },
      create: {
        name: meta.name || baseName,
        packageName: meta.packageName,
        iconUrl: iconUrl,
        ownerId: user.id,
      },
    });

    const build = await prisma.build.create({
      data: {
        appId: app.id,
        version: meta.versionName,
        fileUrl: fileUrl,
        fileSize: buffer.length,
      },
    });

    const response: AppUploadResponse = {
      success: true,
      appId: app.id,
      buildId: build.id,
      name: app.name,
      packageName: app.packageName,
      version: build.version,
      iconUrl: app.iconUrl,
      fileSize: build.fileSize,
    };

    return c.json(response, 201);
  } catch (err: unknown) {
    console.error('[UploadRoute] Error uploading APK:', err);
    return c.json({ error: err instanceof Error ? err.message : 'Internal upload processing error' }, 500);
  }
});
