// /packages/shared/src/schemas.ts
import { z } from 'zod';

export const userRoleSchema = z.enum(['user', 'admin']);

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Must be a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

export const signupSchema = z.object({
  email: z.string().trim().email({ message: 'Must be a valid email address' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one digit' }),
  name: z.string().trim().min(2, { message: 'Name must be at least 2 characters' }).optional(),
});

export const appQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().optional(),
});

export const startSessionSchema = z.object({
  buildId: z.string().uuid({ message: 'buildId must be a valid UUID' }),
});

export const endSessionParamSchema = z.object({
  id: z.string().uuid({ message: 'Session ID must be a valid UUID' }),
});

export const appIdParamSchema = z.object({
  id: z.string().uuid({ message: 'App ID must be a valid UUID' }),
});

export const apkUploadMetaSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  packageName: z.string().min(3).max(256).regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, {
    message: 'Must be a valid Android package name (e.g. com.example.app)',
  }),
  version: z.string().min(1).max(64),
  fileSize: z.number().int().positive().max(524288000, {
    message: 'APK file exceeds 500MB maximum upload limit',
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type AppQueryInput = z.infer<typeof appQuerySchema>;
export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type ApkUploadMetaInput = z.infer<typeof apkUploadMetaSchema>;
