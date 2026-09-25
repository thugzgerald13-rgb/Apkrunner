// /apps/api/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { initStorageBuckets } from './minio.ts';
import { uploadRoute } from './routes/upload.ts';
import { appsRoute } from './routes/apps.ts';
import { sessionsRoute } from './routes/sessions.ts';
import { adminRoute } from './routes/admin.ts';
import { signToken, verifyToken } from './auth.ts';
import { loginSchema, signupSchema, UserRole } from '@apkrunner/shared';

import { Context } from 'hono';

const app = new Hono();
const prisma = new PrismaClient();

const PORT = parseInt(process.env.PORT || '4000', 10);

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin: string | undefined) => origin || '*',
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'x-trpc-source'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

function hashPassword(password: string): string {
  const salt = 'apkrunner_salt_2025';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// GET /api/health
app.get('/api/health', async (c: Context) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return c.json({
    status: dbOk ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'connected' : 'disconnected',
      storage: 'minio-s3',
      runtime: 'client-wasm-bellum',
      clamav: process.env.ENABLE_VIRUS_SCAN === 'true' ? 'enabled' : 'disabled',
    },
  });
});

// Auth endpoints
app.post('/api/auth/login', async (c: Context) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid credentials input', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.passwordHash !== hashPassword(password)) {
    return c.json({ error: 'Incorrect email or password' }, 401);
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

app.post('/api/auth/signup', async (c: Context) => {
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid signup input', details: parsed.error.flatten() }, 400);
  }

  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return c.json({ error: 'An account with this email already exists' }, 409);
  }

  const totalUsers = await prisma.user.count();
  const role: UserRole = totalUsers === 0 ? 'admin' : 'user';

  const user = await prisma.user.create({
    data: {
      email,
      name: name || email.split('@')[0],
      passwordHash: hashPassword(password),
      role,
    },
  });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  return c.json(
    {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    201
  );
});

app.get('/api/auth/me', async (c: Context) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// Mount modular sub-routers
app.route('/api/upload', uploadRoute);
app.route('/api/apps', appsRoute);
app.route('/api/sessions', sessionsRoute);
app.route('/api/admin', adminRoute);

// Global error handler
app.onError((err: Error, c: Context) => {
  console.error('[Hono Server Error]:', err);
  return c.json({ error: err.message || 'Internal Server Error' }, 500);
});

// Startup bootstrap
async function bootstrap() {
  await initStorageBuckets();
  serve({
    fetch: app.fetch,
    port: PORT,
  });
  console.log(`🚀 APKRunner API server listening on http://0.0.0.0:${PORT}`);
}

bootstrap().catch((e) => {
  console.error('Failed to bootstrap APKRunner API:', e);
});

export default app;
