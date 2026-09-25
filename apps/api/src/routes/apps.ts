// /apps/api/src/routes/apps.ts
import { Hono, Context } from 'hono';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth.ts';
import { appQuerySchema } from '@apkrunner/shared';
import { deleteApkObject } from '../minio.ts';

export const appsRoute = new Hono();
const prisma = new PrismaClient();

// GET /api/apps (paginated with optional search by name / package)
appsRoute.get('/', authMiddleware, async (c: Context) => {
  const queryResult = appQuerySchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
    search: c.req.query('search'),
  });

  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400);
  }

  const { page, limit, search } = queryResult.data;
  const skip = (page - 1) * limit;

  const whereCondition = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { packageName: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [total, apps] = await Promise.all([
    prisma.app.count({ where: whereCondition }),
    prisma.app.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        builds: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
        },
      },
    }),
  ]);

  const formattedApps = apps.map((app) => ({
    id: app.id,
    name: app.name,
    packageName: app.packageName,
    iconUrl: app.iconUrl,
    ownerId: app.ownerId,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    latestBuild: app.builds[0] || null,
  }));

  return c.json({
    data: formattedApps,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/apps/:id (app detail with build history)
appsRoute.get('/:id', authMiddleware, async (c: Context) => {
  const appId = c.req.param('id');

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      builds: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  if (!app) {
    return c.json({ error: 'Application not found' }, 404);
  }

  return c.json({
    ...app,
    latestBuild: app.builds[0] || null,
  });
});

// GET /api/apps/:id/builds (build history)
appsRoute.get('/:id/builds', authMiddleware, async (c: Context) => {
  const appId = c.req.param('id');

  const builds = await prisma.build.findMany({
    where: { appId },
    orderBy: { uploadedAt: 'desc' },
    include: {
      _count: {
        select: { sessions: true },
      },
    },
  });

  return c.json(builds);
});

// DELETE /api/apps/:id (cascades to builds)
appsRoute.delete('/:id', authMiddleware, async (c: Context) => {
  const appId = c.req.param('id');
  const user = c.get('user') as { id: string; role: string };

  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { builds: true },
  });

  if (!app) {
    return c.json({ error: 'Application not found' }, 404);
  }

  // Check ownership unless admin
  if (app.ownerId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden: you can only delete your own applications' }, 403);
  }

  // Remove files from MinIO S3
  for (const build of app.builds) {
    try {
      const match = build.fileUrl.match(/s3:\/\/[^/]+\/(.+)$/);
      if (match) {
        await deleteApkObject(match[1]);
      }
    } catch (e: unknown) {
      console.warn(`Could not delete storage object for build ${build.id}:`, e);
    }
  }

  // Delete App cascade
  await prisma.app.delete({
    where: { id: appId },
  });

  return c.json({ success: true, message: `Application ${app.name} and all builds deleted successfully` });
});
