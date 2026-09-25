// /apps/api/src/trpc/router.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import {
  loginSchema,
  signupSchema,
  appQuerySchema,
  startSessionSchema,
  UserRole,
} from '@apkrunner/shared';
import * as crypto from 'crypto';
import { signToken } from '../auth.ts';
import { getPresignedDownloadUrl } from '../minio.ts';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = 'apkrunner_salt_2025';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export interface Context {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

export const appRouter = t.router({
  // Auth procedures
  login: t.procedure.input(loginSchema).mutation(async ({ input }) => {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || user.passwordHash !== hashPassword(input.password)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid email or password' });
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }),

  signup: t.procedure.input(signupSchema).mutation(async ({ input }) => {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'User already exists' });
    }
    const count = await prisma.user.count();
    const role: UserRole = count === 0 ? 'admin' : 'user';

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name || input.email.split('@')[0],
        passwordHash: hashPassword(input.password),
        role,
      },
    });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }),

  // App catalog
  getApps: t.procedure.use(isAuthed).input(appQuerySchema).query(async ({ input }) => {
    const { page, limit, search } = input;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { packageName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, apps] = await Promise.all([
      prisma.app.count({ where }),
      prisma.app.findMany({
        where,
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

    return {
      data: apps.map((a) => ({
        id: a.id,
        name: a.name,
        packageName: a.packageName,
        iconUrl: a.iconUrl,
        ownerId: a.ownerId,
        createdAt: a.createdAt,
        latestBuild: a.builds[0] || null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }),

  // Start execution session
  startSession: t.procedure.use(isAuthed).input(startSessionSchema).mutation(async ({ ctx, input }) => {
    const build = await prisma.build.findUnique({
      where: { id: input.buildId },
      include: { app: true },
    });

    if (!build) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Build not found' });
    }

    const session = await prisma.runSession.create({
      data: {
        userId: ctx.user.id,
        buildId: build.id,
      },
    });

    let presignedUrl = build.fileUrl;
    try {
      const match = build.fileUrl.match(/s3:\/\/[^/]+\/(.+)$/);
      if (match) {
        presignedUrl = await getPresignedDownloadUrl(match[1], 1800);
      }
    } catch {
      // direct url fallback
    }

    return {
      sessionId: session.id,
      build: {
        id: build.id,
        version: build.version,
        appName: build.app.name,
        packageName: build.app.packageName,
        iconUrl: build.app.iconUrl,
        fileSize: build.fileSize,
      },
      presignedUrl,
      wasmUrl: '/wasm/bellum.wasm',
    };
  }),
});

export type AppRouter = typeof appRouter;
