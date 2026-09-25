// /apps/api/src/auth.ts
import { Context, Next } from 'hono';
import * as jwt from 'jsonwebtoken';
import { User, UserRole } from '@apkrunner/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production_32chars_min';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export function signToken(user: { id: string; email: string; role: UserRole }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export type AuthContext = {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Check cookie
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/apkrunner_session=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: missing session token' }, 401);
  }

  const payload = verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Unauthorized: invalid or expired session token' }, 401);
  }

  c.set('user', {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
  });

  await next();
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user') as { id: string; email: string; role: UserRole } | undefined;
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden: admin privilege required' }, 403);
  }
  await next();
}
