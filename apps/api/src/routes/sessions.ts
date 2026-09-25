// /apps/api/src/routes/sessions.ts
import { Hono, Context } from 'hono';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth.ts';
import { startSessionSchema, endSessionParamSchema } from '@apkrunner/shared';
import { getPresignedDownloadUrl } from '../minio.ts';

export const sessionsRoute = new Hono();
const prisma = new PrismaClient();

// POST /api/sessions (starts an execution session and returns build metadata + presigned MinIO URL)
sessionsRoute.post('/', authMiddleware, async (c: Context) => {
  const user = c.get('user') as { id: string; email: string };
  const body = await c.req.json();

  const parseResult = startSessionSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Invalid session input', details: parseResult.error.flatten() }, 400);
  }

  const { buildId } = parseResult.data;

  // Retrieve build and parent app
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: { app: true },
  });

  if (!build) {
    return c.json({ error: 'Requested APK build does not exist' }, 404);
  }

  // Generate presigned download URL for the client-side bellum WASM runtime
  let presignedUrl: string;
  try {
    const s3Match = build.fileUrl.match(/s3:\/\/[^/]+\/(.+)$/);
    const objectKey = s3Match ? s3Match[1] : build.fileUrl;
    presignedUrl = await getPresignedDownloadUrl(objectKey, 1800); // 30 minutes
  } catch (err: unknown) {
    console.warn('[SessionsRoute] Fallback direct URL used:', err);
    presignedUrl = build.fileUrl;
  }

  // Create active session record
  const session = await prisma.runSession.create({
    data: {
      userId: user.id,
      buildId: build.id,
    },
  });

  return c.json(
    {
      sessionId: session.id,
      build: {
        id: build.id,
        version: build.version,
        fileSize: build.fileSize,
        appName: build.app.name,
        packageName: build.app.packageName,
        iconUrl: build.app.iconUrl,
      },
      presignedUrl,
      wasmUrl: process.env.NEXT_PUBLIC_BELLUM_WASM_URL || '/wasm/bellum.wasm',
    },
    201
  );
});

// PATCH /api/sessions/:id/end (sets endedAt)
sessionsRoute.patch('/:id/end', authMiddleware, async (c: Context) => {
  const sessionId = c.req.param('id');
  const user = c.get('user') as { id: string; role: string };

  const session = await prisma.runSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  if (session.userId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden: cannot terminate other users sessions' }, 403);
  }

  const updated = await prisma.runSession.update({
    where: { id: sessionId },
    data: {
      endedAt: new Date(),
    },
  });

  return c.json({
    success: true,
    sessionId: updated.id,
    endedAt: updated.endedAt,
  });
});
