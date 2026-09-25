// /packages/shared/src/types.ts

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt?: string | Date;
}

export interface App {
  id: string;
  name: string;
  packageName: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  builds?: Build[];
  latestBuild?: Build | null;
}

export interface Build {
  id: string;
  appId: string;
  version: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string | Date;
}

export interface RunSession {
  id: string;
  userId: string;
  buildId: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  user?: User;
  build?: Build & { app?: App };
}

export interface SessionStartResponse {
  sessionId: string;
  build: {
    id: string;
    version: string;
    fileSize: number;
    appName: string;
    packageName: string;
    iconUrl: string | null;
  };
  presignedUrl: string;
  wasmUrl: string;
}

export interface AppUploadResponse {
  success: boolean;
  appId: string;
  buildId: string;
  name: string;
  packageName: string;
  version: string;
  iconUrl: string | null;
  fileSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminMetrics {
  totalUsers: number;
  totalApps: number;
  totalBuilds: number;
  totalSessions: number;
  storageUsageBytes: number;
  storageUsageFormatted: string;
  activeSessionsCount: number;
  clamavEnabled: boolean;
  recentSessions: RunSession[];
  usersList: User[];
}

export type LogLevel = 'V' | 'D' | 'I' | 'W' | 'E';

export interface AndroidLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
}

export interface BellumRuntimeStats {
  status: 'idle' | 'initializing' | 'loading_apk' | 'booting' | 'running' | 'paused' | 'stopped' | 'error';
  fps: number;
  frameTimeMs: number;
  vramUsageMb: number;
  activeActivity: string | null;
  webgpuSupported: boolean;
  adapterName: string | null;
  currentError: string | null;
}
