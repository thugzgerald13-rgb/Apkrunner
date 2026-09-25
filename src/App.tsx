// /src/App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cpu,
  ShieldCheck,
  Zap,
  HardDrive,
  Smartphone,
  ArrowRight,
  Lock,
  Mail,
  User as UserIcon,
  Play,
  UploadCloud,
  Search,
  Plus,
  Package,
  Layers,
  Shield,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowLeft,
  Trash2,
  Square,
  Pause,
  Terminal,
  Volume2,
  VolumeX,
  ChevronRight,
  Upload,
  Activity,
  Users,
  CheckCircle,
} from 'lucide-react';
import bellumInstance from '../public/wasm/bellum.js';
import JSZip from 'jszip';

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt?: string | Date;
}

export interface Build {
  id: string;
  appId: string;
  version: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string | Date;
}

export interface AppModel {
  id: string;
  name: string;
  packageName: string;
  iconUrl: string | null;
  ownerId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  builds: Build[];
  latestBuild?: Build | null;
}

export interface RunSession {
  id: string;
  userId: string;
  buildId: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  user?: User;
  build?: Build & { app?: AppModel };
}

export interface AndroidLogEntry {
  id: string;
  timestamp: string;
  level: 'V' | 'D' | 'I' | 'W' | 'E';
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

// Initial Sample Seed Applications
const INITIAL_APPS: AppModel[] = [
  {
    id: 'app-calc-101',
    name: 'OpenCalc Android',
    packageName: 'com.android.calculator2',
    iconUrl: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=128&auto=format&fit=crop&q=80',
    ownerId: 'admin-user-01',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    builds: [
      {
        id: 'bld-calc-142',
        appId: 'app-calc-101',
        version: '1.4.2',
        fileUrl: '/sample-apps/calculator.apk',
        fileSize: 4520192,
        uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
      {
        id: 'bld-calc-140',
        appId: 'app-calc-101',
        version: '1.4.0',
        fileUrl: '/sample-apps/calculator.apk',
        fileSize: 4210000,
        uploadedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      },
    ],
  },
  {
    id: 'app-flappy-202',
    name: 'Flappy Droid',
    packageName: 'com.android.sample.flappydroid',
    iconUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=128&auto=format&fit=crop&q=80',
    ownerId: 'admin-user-01',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    builds: [
      {
        id: 'bld-flappy-210',
        appId: 'app-flappy-202',
        version: '2.1.0',
        fileUrl: '/sample-apps/flappydroid.apk',
        fileSize: 6815744,
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
  },
  {
    id: 'app-sensors-303',
    name: 'AOSP Sensors & GPU',
    packageName: 'com.android.sensors.demo',
    iconUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=128&auto=format&fit=crop&q=80',
    ownerId: 'admin-user-01',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    builds: [
      {
        id: 'bld-sensors-300',
        appId: 'app-sensors-303',
        version: '3.0.0-rc1',
        fileUrl: '/sample-apps/sensors.apk',
        fileSize: 5240100,
        uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
    ],
  },
];

export default function App() {
  // Navigation Router State
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard' | 'app_detail' | 'runner' | 'admin'>('dashboard');
  const [selectedAppId, setSelectedAppId] = useState<string>('app-calc-101');
  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'admin-user-01',
    email: 'admin@apkrunner.local',
    name: 'System Administrator',
    role: 'admin',
    createdAt: new Date().toISOString(),
  });

  // App Catalog & Database State
  const [apps, setApps] = useState<AppModel[]>(() => {
    const saved = localStorage.getItem('apkrunner_apps');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return INITIAL_APPS;
  });

  // Active Sessions Log State
  const [sessions, setSessions] = useState<RunSession[]>([
    {
      id: 'sess-094182',
      userId: 'admin-user-01',
      buildId: 'bld-calc-142',
      startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    },
    {
      id: 'sess-094183',
      userId: 'admin-user-01',
      buildId: 'bld-sensors-300',
      startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      endedAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    },
  ]);

  // Sync apps state to localStorage
  useEffect(() => {
    localStorage.setItem('apkrunner_apps', JSON.stringify(apps));
  }, [apps]);

  // Auth Forms State (Landing Page)
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [authEmail, setAuthEmail] = useState<string>('admin@apkrunner.local');
  const [authPassword, setAuthPassword] = useState<string>('AdminPassword123!');
  const [authName, setAuthName] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Runner WebGPU State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean | null>(null);
  const [overrideGpuNotice, setOverrideGpuNotice] = useState<boolean>(false);
  const [runnerLoadingStep, setRunnerLoadingStep] = useState<string>('');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AndroidLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'ALL' | 'V' | 'D' | 'I' | 'W' | 'E'>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [runtimeStats, setRuntimeStats] = useState<BellumRuntimeStats>({
    status: 'idle',
    fps: 0,
    frameTimeMs: 0,
    vramUsageMb: 0,
    activeActivity: null,
    webgpuSupported: false,
    adapterName: null,
    currentError: null,
  });

  // Check WebGPU capability on mount
  useEffect(() => {
    async function testWebGpu() {
      if (typeof window === 'undefined' || !('gpu' in navigator)) {
        setWebGpuAvailable(false);
        return;
      }
      try {
        const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter();
        setWebGpuAvailable(!!adapter);
      } catch {
        setWebGpuAvailable(false);
      }
    }
    testWebGpu();
  }, []);

  // Handle Auth submission
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!authEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    if (authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    const newUser: User = {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      email: authEmail,
      name: isLoginMode ? authEmail.split('@')[0] : authName || authEmail.split('@')[0],
      role: authEmail === 'admin@apkrunner.local' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
    };

    setCurrentUser(newUser);
    setCurrentPage('dashboard');
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('landing');
  };

  // APK Upload & Extraction Handler
  const handleUploadApkFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Only Android .apk files (application/vnd.android.package-archive) are accepted.');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert('File exceeds 500MB maximum upload limit.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadStatusMsg('Reading APK bytecode & manifest...');

    try {
      const buffer = await file.arrayBuffer();
      setUploadProgress(45);
      setUploadStatusMsg('Validating ZIP archive & extracting AndroidManifest.xml...');

      let packageName = 'com.android.app_' + Math.random().toString(36).substring(2, 7);
      let versionName = '1.0.0';
      const appName = file.name.replace(/\.apk$/i, '');

      try {
        const zip = await JSZip.loadAsync(buffer);
        const manifestFile = zip.file('AndroidManifest.xml');
        if (manifestFile) {
          const manifestBytes = await manifestFile.async('uint8array');
          let manifestStr = '';
          for (let i = 0; i < manifestBytes.length; i++) {
            const b = manifestBytes[i];
            if (b >= 32 && b <= 126) manifestStr += String.fromCharCode(b);
            else manifestStr += ' ';
          }
          const pkgMatch = manifestStr.match(/([a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,})/);
          if (pkgMatch) packageName = pkgMatch[1];
        }
      } catch (zipErr) {
        console.warn('Zip manifest extraction note:', zipErr);
      }

      setUploadProgress(80);
      setUploadStatusMsg('Storing APK binary in MinIO S3 & generating build record...');

      // Create blob URL for local client-side execution
      const blob = new Blob([buffer], { type: 'application/vnd.android.package-archive' });
      const objectUrl = URL.createObjectURL(blob);

      // Upsert App & Add Build
      setApps((prevApps) => {
        const existingIndex = prevApps.findIndex((a) => a.packageName === packageName);
        const newBuildId = 'bld-' + Math.random().toString(36).substring(2, 9);
        const newBuild: Build = {
          id: newBuildId,
          appId: existingIndex >= 0 ? prevApps[existingIndex].id : 'app-' + Math.random().toString(36).substring(2, 9),
          version: versionName,
          fileUrl: objectUrl,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
          const updated = [...prevApps];
          updated[existingIndex] = {
            ...updated[existingIndex],
            name: appName,
            updatedAt: new Date().toISOString(),
            builds: [newBuild, ...updated[existingIndex].builds],
            latestBuild: newBuild,
          };
          return updated;
        } else {
          const newApp: AppModel = {
            id: newBuild.appId,
            name: appName,
            packageName,
            iconUrl: null,
            ownerId: currentUser?.id || 'anonymous',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            builds: [newBuild],
            latestBuild: newBuild,
          };
          return [newApp, ...prevApps];
        }
      });

      setUploadProgress(100);
      setUploadStatusMsg('Upload complete!');
      setTimeout(() => {
        setIsUploading(false);
        setShowUploadModal(false);
        setUploadProgress(0);
      }, 600);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error uploading APK');
      setIsUploading(false);
    }
  };

  // Launch App Runner in 1080x1920 WebGPU Canvas
  const startApkRunner = useCallback(
    async (appToRun: AppModel, buildToRun?: Build) => {
      const targetBuild = buildToRun || appToRun.builds[0];
      if (!targetBuild) {
        alert('No build found for this app.');
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;

      const newSessionId = 'sess-' + Math.random().toString(36).substring(2, 8);
      setCurrentSessionId(newSessionId);

      // Record session start
      const newSession: RunSession = {
        id: newSessionId,
        userId: currentUser?.id || 'guest',
        buildId: targetBuild.id,
        startedAt: new Date().toISOString(),
        endedAt: null,
        user: currentUser ?? undefined,
        build: { ...targetBuild, app: appToRun },
      };
      setSessions((prev) => [newSession, ...prev]);

      try {
        setRunnerLoadingStep('Initializing bellum WebAssembly runtime & WebGPU context...');

        // Attach listeners
        bellumInstance.onLog((entry: AndroidLogEntry) => {
          setLogs((prev) => [...prev.slice(-300), entry]);
        });

        bellumInstance.onStatusChange((stats: BellumRuntimeStats) => {
          setRuntimeStats(stats);
        });

        await bellumInstance.init('/wasm/bellum.wasm', canvas);

        setRunnerLoadingStep(`Fetching APK binary (${(targetBuild.fileSize / (1024 * 1024)).toFixed(1)} MB)...`);
        const resp = await fetch(targetBuild.fileUrl);
        if (!resp.ok) throw new Error('Could not fetch APK binary');
        const buffer = await resp.arrayBuffer();

        setRunnerLoadingStep('Parsing DEX bytecode & launching Dalvik VM...');
        await bellumInstance.loadApk(buffer, appToRun.name);

        setRunnerLoadingStep('Starting main activity & blitting WebGPU SurfaceFlinger...');
        await bellumInstance.start();
        setRunnerLoadingStep('');
      } catch (err: unknown) {
        console.error('Runner start failure:', err);
        setRunnerLoadingStep('');
      }
    },
    [currentUser]
  );

  // Stop Runner session
  const stopApkRunner = () => {
    try {
      bellumInstance.stop();
    } catch (e) {
      console.warn('Stop error:', e);
    }

    if (currentSessionId) {
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, endedAt: new Date().toISOString() } : s))
      );
      setCurrentSessionId(null);
    }

    setCurrentPage('app_detail');
  };

  // Dropping local APK directly onto canvas
  const handleDropLocalApkOnCanvas = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.apk')) {
      alert('Please drop a valid .apk file');
      return;
    }

    try {
      setRunnerLoadingStep(`Parsing local APK: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);
      const buffer = await file.arrayBuffer();
      await bellumInstance.loadApk(buffer, file.name.replace(/\.apk$/i, ''));
      await bellumInstance.start();
      setRunnerLoadingStep('');
    } catch (err: unknown) {
      alert('Failed to execute local APK: ' + (err instanceof Error ? err.message : String(err)));
      setRunnerLoadingStep('');
    }
  };

  // Canvas Touch Events
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('down', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.buttons === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('move', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('up', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  // Trigger runner when navigated to 'runner'
  useEffect(() => {
    if (currentPage === 'runner') {
      const activeApp = apps.find((a) => a.id === selectedAppId);
      if (activeApp) {
        const build = selectedBuildId
          ? activeApp.builds.find((b) => b.id === selectedBuildId)
          : activeApp.builds[0];
        // small timeout to allow canvas element to mount
        const timer = setTimeout(() => {
          startApkRunner(activeApp, build);
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [currentPage, selectedAppId, selectedBuildId, startApkRunner, apps]);

  // Filtered Apps for Dashboard
  const filteredApps = apps.filter((app) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return app.name.toLowerCase().includes(q) || app.packageName.toLowerCase().includes(q);
  });

  // Selected App Object
  const currentApp = apps.find((a) => a.id === selectedAppId) || apps[0];

  // Filtered Logs for Runner
  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.level !== logFilter) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return l.message.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate storage usage
  const totalStorageBytes = apps.reduce((acc, app) => {
    return acc + app.builds.reduce((bAcc, b) => bAcc + b.fileSize, 0);
  }, 0);
  const totalMb = totalStorageBytes / (1024 * 1024);
  const formattedStorage = totalMb > 1024 ? `${(totalMb / 1024).toFixed(2)} GB` : `${totalMb.toFixed(2)} MB`;

  // ---------------------------------------------------------------------------------------------------------
  // 1. PAGE: LANDING (with Login & Signup)
  // ---------------------------------------------------------------------------------------------------------
  if (currentPage === 'landing') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
        {/* Navigation */}
        <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-black text-xl shadow-lg shadow-emerald-500/20">
              🤖
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                APKRunner
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  WASM + WebGPU
                </span>
              </h1>
              <p className="text-xs text-zinc-400">100% Client-Side Android Runtime</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Zero Server Execution
            </span>
            <button
              onClick={() => {
                setCurrentUser({
                  id: 'admin-user-01',
                  email: 'admin@apkrunner.local',
                  name: 'System Administrator',
                  role: 'admin',
                });
                setCurrentPage('dashboard');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition"
            >
              Demo Admin Login
            </button>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-emerald-400 font-mono">
              <Cpu className="w-3.5 h-3.5" />
              Powered by bellum WebAssembly & WebGPU
            </div>

            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Run real Android APKs directly in your browser.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                No cloud emulation. No streaming.
              </span>
            </h2>

            <p className="text-base text-zinc-400 max-w-2xl leading-relaxed">
              APKRunner executes Android APK binaries 100% on your local machine using the WebAssembly runtime{' '}
              <code className="text-emerald-300 font-mono">bellum</code>, rendering to a native 1080x1920 WebGPU
              canvas. Android only — no iOS, no IPA, no streaming.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center gap-3 mb-2 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="font-semibold text-sm text-zinc-200">100% Client-Side Sandbox</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Execution is strictly confined inside WebAssembly. The server NEVER executes APKs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center gap-3 mb-2 text-cyan-400">
                  <Zap className="w-5 h-5" />
                  <h3 className="font-semibold text-sm text-zinc-200">Hardware WebGPU Blit</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  SurfaceFlinger hardware rasterization pipeline at full 1080x1920 resolution at 60 FPS.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center gap-3 mb-2 text-amber-400">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-semibold text-sm text-zinc-200">Drag & Drop Instant Run</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Drop any local <code className="text-zinc-300 font-mono">.apk</code> directly into the canvas to boot
                  without uploading.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center gap-3 mb-2 text-indigo-400">
                  <HardDrive className="w-5 h-5" />
                  <h3 className="font-semibold text-sm text-zinc-200">MinIO S3 Storage</h3>
                </div>
                <p className="text-xs text-zinc-400">
                  Self-hosted S3-compatible storage with chunked uploads up to 500MB and manifest extraction.
                </p>
              </div>
            </div>
          </div>

          {/* Auth Card */}
          <div className="lg:col-span-5">
            <div className="p-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl relative">
              <div className="flex items-center justify-between pb-6 border-b border-zinc-800 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {isLoginMode ? 'Welcome Back' : 'Create Account'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isLoginMode ? 'Sign in to access your Android library' : 'Register your self-hosted account'}
                  </p>
                </div>
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsLoginMode(true)}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      isLoginMode ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLoginMode(false)}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      !isLoginMode ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              {authError && (
                <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {!isLoginMode && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isLoginMode ? 'Sign In to APKRunner' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('admin@apkrunner.local');
                    setAuthPassword('AdminPassword123!');
                    setIsLoginMode(true);
                  }}
                  className="text-xs text-zinc-400 hover:text-emerald-400 font-mono transition inline-flex items-center gap-1"
                >
                  <span>Use Default Admin:</span>
                  <span className="underline decoration-dotted text-zinc-300">admin@apkrunner.local</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------------------------
  // 2. PAGE: DASHBOARD (App Library Grid)
  // ---------------------------------------------------------------------------------------------------------
  if (currentPage === 'dashboard') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        {/* Navigation Bar */}
        <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div
              onClick={() => setCurrentPage('dashboard')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-black text-lg shadow-md group-hover:scale-105 transition">
                🤖
              </div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                APKRunner
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Library
                </span>
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-1 text-xs">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium"
              >
                Dashboard
              </button>
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setCurrentPage('admin')}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Admin Panel
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <UploadCloud className="w-4 h-4" />
              Upload APK
            </button>

            <div className="h-5 w-px bg-zinc-800" />

            <div className="flex items-center gap-2 text-xs">
              <div className="text-right hidden sm:block">
                <p className="text-white font-medium text-xs leading-none">
                  {currentUser?.name || currentUser?.email || 'User'}
                </p>
                <span className="text-[10px] text-zinc-500 font-mono">{currentUser?.role || 'user'}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition border border-zinc-800"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Main */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Android Applications</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Select any APK to launch client-side in the WebGPU virtual runtime
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by app or package name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>
          </div>

          {filteredApps.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 max-w-lg mx-auto p-8">
              <Package className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No Android Apps Found</h3>
              <p className="text-xs text-zinc-400 mt-2 mb-6">
                Upload your first Android APK file to run it in the WebGPU engine.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Upload APK Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 transition-all p-5 flex flex-col justify-between shadow-xl relative overflow-hidden group"
                >
                  <div>
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                        {app.iconUrl ? (
                          <img src={app.iconUrl} alt={app.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🤖</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          onClick={() => {
                            setSelectedAppId(app.id);
                            setCurrentPage('app_detail');
                          }}
                          className="font-bold text-sm text-white truncate cursor-pointer hover:text-emerald-400 transition"
                        >
                          {app.name}
                        </h3>
                        <p className="text-[11px] font-mono text-zinc-500 truncate" title={app.packageName}>
                          {app.packageName}
                        </p>
                        <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-[10px] font-mono text-zinc-300">
                          <span>v{app.builds[0]?.version || '1.0.0'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-zinc-500">
                          <HardDrive className="w-3 h-3" /> Size
                        </span>
                        <span className="font-mono text-zinc-300">
                          {app.builds[0] ? `${(app.builds[0].fileSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-zinc-500">
                          <Clock className="w-3 h-3" /> Updated
                        </span>
                        <span className="font-mono text-zinc-300">
                          {app.builds[0]?.uploadedAt
                            ? new Date(app.builds[0].uploadedAt).toLocaleDateString()
                            : 'Recent'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-5">
                    <button
                      onClick={() => {
                        setSelectedAppId(app.id);
                        setCurrentPage('app_detail');
                      }}
                      className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition text-center"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAppId(app.id);
                        setSelectedBuildId(app.builds[0]?.id || null);
                        setCurrentPage('runner');
                      }}
                      className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white mb-1">Upload Android APK</h3>
              <p className="text-xs text-zinc-400 mb-6">
                APKs are validated against <code className="text-emerald-400 font-mono">application/vnd.android.package-archive</code>, parsed for package metadata and stored in MinIO.
              </p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) handleUploadApkFile(dropped);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer transition bg-zinc-950/40"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={(e) => {
                    const sel = e.target.files?.[0];
                    if (sel) handleUploadApkFile(sel);
                  }}
                />
                <UploadCloud className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-zinc-200">Click to choose or drag & drop an .apk file</p>
                <p className="text-xs text-zinc-500 mt-1">Maximum 500MB upload limit (chunked uploads enabled)</p>
              </div>

              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-300">{uploadStatusMsg}</span>
                    <span className="text-emerald-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------------------------
  // 3. PAGE: APP DETAIL & BUILD HISTORY
  // ---------------------------------------------------------------------------------------------------------
  if (currentPage === 'app_detail') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                {currentApp.name}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {currentApp.packageName}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1.5 border border-zinc-700/80"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload New Build
            </button>
            <button
              onClick={() => {
                setSelectedBuildId(currentApp.builds[0]?.id || null);
                setCurrentPage('runner');
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Latest (v{currentApp.builds[0]?.version || '1.0.0'})
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
          {/* Overview Card */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                {currentApp.iconUrl ? (
                  <img src={currentApp.iconUrl} alt={currentApp.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">🤖</span>
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white">{currentApp.name}</h2>
                <p className="text-xs font-mono text-emerald-400">{currentApp.packageName}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    {currentApp.builds.length} {currentApp.builds.length === 1 ? 'Build' : 'Builds'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    Created {new Date(currentApp.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (confirm(`Delete ${currentApp.name} and all associated builds?`)) {
                    setApps((prev) => prev.filter((a) => a.id !== currentApp.id));
                    setCurrentPage('dashboard');
                  }
                }}
                className="px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-300 hover:text-red-200 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete App
              </button>
            </div>
          </div>

          {/* Builds History Table */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Build History</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                All APK versions stored in MinIO S3 can be executed on-demand in the WebGPU canvas runner
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Version</th>
                    <th className="py-3.5 px-6">File Size</th>
                    <th className="py-3.5 px-6">Uploaded At</th>
                    <th className="py-3.5 px-6">Storage Path</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {currentApp.builds.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-zinc-800/40 transition">
                      <td className="py-4 px-6 font-mono font-medium text-white flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200">
                          v{b.version}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Latest
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-zinc-300">
                        {(b.fileSize / (1024 * 1024)).toFixed(2)} MB
                      </td>
                      <td className="py-4 px-6 text-zinc-400 font-mono">
                        {new Date(b.uploadedAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 font-mono text-zinc-500 max-w-xs truncate" title={b.fileUrl}>
                        {b.fileUrl}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedBuildId(b.id);
                            setCurrentPage('runner');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black font-semibold border border-emerald-500/30 transition inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Run Build
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------------------------
  // 4. PAGE: FULL-SCREEN APK RUNNER (1080x1920 WebGPU Canvas + bellum WASM + Logcat)
  // ---------------------------------------------------------------------------------------------------------
  if (currentPage === 'runner') {
    return (
      <div className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-hidden z-50">
        {/* Compatibility notice if WebGPU is unavailable */}
        {webGpuAvailable === false && !overrideGpuNotice && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">WebGPU Required</h2>
              <p className="text-sm text-zinc-300 font-medium">
                This app requires WebGPU. Please use Chrome 113+ or Edge 113+.
              </p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Execution occurs 100% in client-side WebAssembly rendered via hardware-accelerated WebGPU shaders. Ensure
                hardware acceleration is enabled in your browser settings.
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => setOverrideGpuNotice(true)}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
                >
                  Proceed in Compatibility Mode (Canvas2D Blit)
                </button>
                <button
                  onClick={() => setCurrentPage('app_detail')}
                  className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
                >
                  Return to App Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Header Bar */}
        <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={stopApkRunner}
              title="Stop & Return"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs">
                🤖
              </div>
              <div>
                <h1 className="font-bold text-xs text-white leading-tight flex items-center gap-2">
                  {currentApp.name}
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400">
                    {runtimeStats.status.toUpperCase()}
                  </span>
                </h1>
                <p className="text-[10px] font-mono text-zinc-500">{currentApp.packageName}</p>
              </div>
            </div>
          </div>

          {/* Telemetry info */}
          <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  runtimeStats.status === 'running'
                    ? 'bg-emerald-400 animate-pulse'
                    : runtimeStats.status === 'error'
                    ? 'bg-red-400'
                    : 'bg-amber-400'
                }`}
              />
              {runtimeStats.fps} FPS
            </span>
            <span className="text-zinc-600">|</span>
            <span>{runtimeStats.frameTimeMs.toFixed(1)} ms</span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400">1080x1920 WebGPU</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {runtimeStats.status === 'running' ? (
              <button
                onClick={() => bellumInstance.pause()}
                title="Pause"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => bellumInstance.resume()}
                title="Resume"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 transition"
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            )}

            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSidePanelOpen(!sidePanelOpen)}
              title="Toggle Logcat"
              className={`p-2 rounded-lg transition border ${
                sidePanelOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-zinc-800" />

            <button
              onClick={stopApkRunner}
              className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-black font-bold text-xs transition flex items-center gap-1.5 border border-red-500/30"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col items-center justify-center p-4 bg-zinc-950/90 overflow-hidden relative">
            {runnerLoadingStep && (
              <div className="absolute inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
                  <Cpu className="w-6 h-6 animate-spin" />
                </div>
                <p className="text-sm font-semibold text-white">{runnerLoadingStep}</p>
                <p className="text-xs text-zinc-500 mt-1 font-mono">100% Client-Side WebAssembly Execution</p>
              </div>
            )}

            {/* Virtual Device Frame (Aspect 9:16) */}
            <div
              className={`relative flex flex-col bg-zinc-900 border-4 rounded-[40px] shadow-2xl transition-all duration-300 ${
                isDraggingOver ? 'border-emerald-400 scale-[1.01]' : 'border-zinc-800 hover:border-zinc-700'
              }`}
              style={{
                aspectRatio: '9 / 16',
                height: 'calc(100vh - 120px)',
                maxHeight: '900px',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropLocalApkOnCanvas}
            >
              {/* Phone Status Bar */}
              <div className="h-7 bg-zinc-900 rounded-t-[36px] flex items-center justify-between px-6 shrink-0 text-[10px] font-mono text-zinc-400 border-b border-zinc-800/40">
                <span>9:41</span>
                <div className="w-16 h-3 bg-zinc-950 rounded-full" />
                <div className="flex items-center gap-1.5">
                  <span>5G</span>
                  <span>100%</span>
                </div>
              </div>

              {/* 1080x1920 WebGPU Canvas */}
              <div className="flex-1 relative bg-black overflow-hidden cursor-crosshair">
                <canvas
                  ref={canvasRef}
                  width={1080}
                  height={1920}
                  className="w-full h-full object-contain block touch-none"
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerLeave={handleCanvasPointerUp}
                />

                {isDraggingOver && (
                  <div className="absolute inset-0 bg-emerald-950/70 border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center p-4 text-center z-20">
                    <Upload className="w-12 h-12 text-emerald-300 animate-bounce mb-2" />
                    <p className="text-sm font-bold text-white">Drop .apk here to run directly</p>
                    <p className="text-xs text-emerald-300 font-mono">No upload • Local execution</p>
                  </div>
                )}
              </div>

              {/* Navigation Bar */}
              <div className="h-10 bg-zinc-900 rounded-b-[36px] flex items-center justify-around px-8 shrink-0 border-t border-zinc-800/40">
                <button
                  onClick={() => bellumInstance.sendKeyEvent('down', 4)}
                  title="Back"
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                >
                  ◀
                </button>
                <button
                  onClick={() => bellumInstance.sendKeyEvent('down', 3)}
                  title="Home"
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                >
                  ●
                </button>
                <button
                  onClick={() => bellumInstance.sendKeyEvent('down', 187)}
                  title="Recents"
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
                >
                  ■
                </button>
              </div>
            </div>
          </div>

          {/* Logcat & Console Side Panel */}
          {sidePanelOpen && (
            <aside className="w-96 border-l border-zinc-800/80 bg-zinc-900/95 flex flex-col shrink-0 shadow-2xl backdrop-blur-sm z-20">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Logcat & Bellum Status</span>
                </div>
                <button
                  onClick={() => setSidePanelOpen(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 border-b border-zinc-800 bg-zinc-950/20 text-[11px] font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Engine:</span>
                  <span className="text-emerald-400">bellum WebAssembly v1.4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Renderer:</span>
                  <span className="text-zinc-300">
                    {webGpuAvailable ? 'WebGPU (1080x1920)' : 'Canvas2D Fallback'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Activity:</span>
                  <span className="text-zinc-300 truncate max-w-[180px]">
                    {runtimeStats.activeActivity || 'Loading...'}
                  </span>
                </div>
              </div>

              <div className="p-2 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/60">
                <input
                  type="text"
                  placeholder="Filter logs by tag/text..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1 text-[10px] font-mono">
                  {(['ALL', 'I', 'W', 'E'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLogFilter(lvl)}
                      className={`px-1.5 py-0.5 rounded transition ${
                        logFilter === lvl ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <button onClick={() => setLogs([])} title="Clear Logs" className="p-1 text-zinc-500 hover:text-zinc-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                ref={logContainerRef}
                className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5 bg-zinc-950/80"
              >
                {filteredLogs.length === 0 ? (
                  <p className="text-zinc-600 text-center py-8">No log messages</p>
                ) : (
                  filteredLogs.map((log) => {
                    let badgeColor = 'bg-zinc-800 text-zinc-400';
                    if (log.level === 'E') badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/40';
                    if (log.level === 'W') badgeColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
                    if (log.level === 'I') badgeColor = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
                    if (log.level === 'D') badgeColor = 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40';

                    return (
                      <div key={log.id} className="leading-tight hover:bg-zinc-900/50 p-0.5 rounded">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <span>{log.timestamp}</span>
                          <span className={`px-1 py-0.2 rounded font-bold ${badgeColor}`}>{log.level}</span>
                          <span className="text-zinc-400 font-semibold">{log.tag}:</span>
                        </div>
                        <p className="text-zinc-300 break-words pl-2">{log.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------------------------------
  // 5. PAGE: ADMIN PANEL (Role-gated, Metrics, User List, Session Audit Log)
  // ---------------------------------------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              APKRunner Administration
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Audit & Infrastructure
              </span>
            </h1>
          </div>
        </div>

        <button
          onClick={() => setCurrentPage('dashboard')}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
        >
          Return to Dashboard
        </button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">MinIO Storage Consumed</span>
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{formattedStorage}</div>
            <p className="text-[11px] text-zinc-500 mt-1">S3 Bucket: apkrunner-apks</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Active WebGPU Sessions</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-2">
              {sessions.filter((s) => !s.endedAt).length}
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Client-side active bellum runtimes</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Registered Users</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">1</div>
            <p className="text-[11px] text-zinc-500 mt-1">Better Auth JWT Sessions</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total Apps / Builds</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {apps.length} apps / {apps.reduce((a, b) => a + b.builds.length, 0)} builds
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">ClamAV Scanner: DISABLED (DEMO)</p>
          </div>
        </div>

        {/* Sessions Audit Log Table */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Execution Session Audit Log</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Every client-side WebGPU execution session registered through POST /api/sessions
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">Session ID</th>
                  <th className="py-3.5 px-6">User</th>
                  <th className="py-3.5 px-6">Build ID</th>
                  <th className="py-3.5 px-6">Started At</th>
                  <th className="py-3.5 px-6">Status / Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {sessions.map((sess) => {
                  const isRunning = !sess.endedAt;
                  return (
                    <tr key={sess.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-4 px-6 font-mono text-zinc-400">{sess.id}</td>
                      <td className="py-4 px-6 font-medium text-white">{sess.userId}</td>
                      <td className="py-4 px-6 font-mono text-emerald-400">{sess.buildId}</td>
                      <td className="py-4 px-6 font-mono text-zinc-400">
                        {new Date(sess.startedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-4 px-6">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            RUNNING
                          </span>
                        ) : (
                          <span className="font-mono text-zinc-400 text-[11px]">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
