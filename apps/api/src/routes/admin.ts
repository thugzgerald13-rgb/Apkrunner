// /apps/api/src/routes/admin.ts
import { Hono, Context } from 'hono';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireAdmin } from '../auth.ts';
import { AdminMetrics } from '@apkrunner/shared';

export const adminRoute = new Hono();
const prisma = new PrismaClient();

adminRoute.use('*', authMiddleware, requireAdmin);

adminRoute.get('/metrics', async (c: Context) => {
  const [totalUsers, totalApps, totalBuilds, totalSessions, activeSessionsCount, usersList, recentSessions, storageAggregate] =
    await Promise.all([
      prisma.user.count(),
      prisma.app.count(),
      prisma.build.count(),
      prisma.runSession.count(),
      prisma.runSession.count({ where: { endedAt: null } }),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.runSession.findMany({
        take: 30,
        orderBy: { startedAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, name: true, role: true },
          },
          build: {
            include: {
              app: true,
            },
          },
        },
      }),
      prisma.build.aggregate({
        _sum: {
          fileSize: true,
        },
      }),
    ]);

  const totalBytes = storageAggregate._sum.fileSize || 0;
  const mb = totalBytes / (1024 * 1024);
  const formattedStorage = mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;

  const metrics: AdminMetrics = {
    totalUsers,
    totalApps,
    totalBuilds,
    totalSessions,
    storageUsageBytes: totalBytes,
    storageUsageFormatted: formattedStorage,
    activeSessionsCount,
    clamavEnabled: process.env.ENABLE_VIRUS_SCAN === 'true',
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      buildId: s.buildId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      user: s.user,
      build: s.build,
    })),
    usersList,
  };

  return c.json(metrics);
});
