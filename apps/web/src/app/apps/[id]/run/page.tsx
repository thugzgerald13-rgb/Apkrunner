// /apps/web/src/app/apps/[id]/run/page.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Square,
  Play,
  Pause,
  RotateCw,
  Terminal,
  Cpu,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Upload,
  Info,
  Maximize2,
  Minimize2,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AndroidLogEntry, BellumRuntimeStats, LogLevel } from '@apkrunner/shared';

// Interface matching the WebAssembly bellum runtime specification
interface BellumModule {
  init: (wasmUrl: string, canvas: HTMLCanvasElement) => Promise<boolean>;
  loadApk: (buffer: ArrayBuffer, name?: string) => Promise<{ packageName: string; mainActivity: string }>;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  sendTouchEvent: (type: 'down' | 'move' | 'up', normalizedX: number, normalizedY: number) => void;
  sendKeyEvent: (action: 'down' | 'up', keyCode: number) => void;
  onLog: (callback: (log: AndroidLogEntry) => void) => () => void;
  onStatusChange: (callback: (stats: BellumRuntimeStats) => void) => () => void;
  isWebGPUSupported: () => boolean;
}

export default function ApkRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const appId = params.id as string;
  const specificBuildId = searchParams.get('buildId');

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Runtime State
  const [bellumInstance, setBellumInstance] = useState<BellumModule | null>(null);
  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean | null>(null);
  const [webGpuAdapterInfo, setWebGpuAdapterInfo] = useState<string>('');
  const [overrideGpuNotice, setOverrideGpuNotice] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [logs, setLogs] = useState<AndroidLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [logSearch, setLogSearch] = useState<string>('');
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [runtimeStatus, setRuntimeStatus] = useState<BellumRuntimeStats>({
    status: 'idle',
    fps: 0,
    frameTimeMs: 0,
    vramUsageMb: 0,
    activeActivity: null,
    webgpuSupported: false,
    adapterName: null,
    currentError: null,
  });

  const [loadingStep, setLoadingStep] = useState<string>('Initializing APKRunner...');
  const [appName, setAppName] = useState<string>('Android App');
  const [packageName, setPackageName] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Check WebGPU capability
  const checkWebGpuSupport = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('gpu' in navigator)) {
      setWebGpuAvailable(false);
      return false;
    }
    try {
      const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<{ info?: { device?: string } }> } }).gpu.requestAdapter();
      if (!adapter) {
        setWebGpuAvailable(false);
        return false;
      }
      setWebGpuAvailable(true);
      setWebGpuAdapterInfo(adapter.info?.device || 'Hardware Accelerated WebGPU Adapter');
      return true;
    } catch {
      setWebGpuAvailable(false);
      return false;
    }
  }, []);

  // Initialize and run session
  useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    let activeModule: BellumModule | null = null;
    let cleanupLogListener: (() => void) | null = null;
    let cleanupStatusListener: (() => void) | null = null;

    const bootstrapRunner = async () => {
      const gpuOk = await checkWebGpuSupport();
      if (!mounted) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        setLoadingStep('Starting execution session with backend...');
        const token = localStorage.getItem('apkrunner_token');

        // Fetch app detail to get latest build if not specified
        let targetBuildId = specificBuildId;
        if (!targetBuildId) {
          const appRes = await fetch(`/api/apps/${appId}`, {
            headers: { Authorization: token ? `Bearer ${token}` : '' },
          });
          if (!appRes.ok) throw new Error('Could not load application details');
          const appData = await appRes.json();
          setAppName(appData.name);
          setPackageName(appData.packageName);
          targetBuildId = appData.latestBuild?.id;
        }

        if (!targetBuildId) {
          throw new Error('No build available for this application. Please upload a build first.');
        }

        // 1. POST /api/sessions starts an execution session and returns build metadata + presigned MinIO URL
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({ buildId: targetBuildId }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json();
          throw new Error(errData.error || 'Failed to start execution session');
        }

        const sessionData = await sessionRes.json();
        currentSessionId = sessionData.sessionId;
        setSessionId(currentSessionId);
        setAppName(sessionData.build.appName);
        setPackageName(sessionData.build.packageName);

        // 2. Dynamically import bellum
        setLoadingStep('Dynamically loading bellum WebAssembly runtime...');
        const bellumMod = await import('@/public/wasm/bellum.js');
        const bellum: BellumModule = bellumMod.default || bellumMod;
        activeModule = bellum;
        setBellumInstance(bellum);

        // Attach listeners
        cleanupLogListener = bellum.onLog((entry) => {
          setLogs((prev) => [...prev.slice(-300), entry]);
        });

        cleanupStatusListener = bellum.onStatusChange((stats) => {
          setRuntimeStatus(stats);
        });

        // 3. bellum.init('/wasm/bellum.wasm')
        setLoadingStep('Initializing WebGPU context & WebAssembly memory...');
        await bellum.init(sessionData.wasmUrl || '/wasm/bellum.wasm', canvas);

        // 4. Fetch APK from presigned MinIO URL as ArrayBuffer
        setLoadingStep(`Streaming APK from MinIO (${(sessionData.build.fileSize / (1024 * 1024)).toFixed(1)} MB)...`);
        const apkResponse = await fetch(sessionData.presignedUrl);
        if (!apkResponse.ok) {
          throw new Error('Failed to download APK from presigned storage URL');
        }
        const apkBuffer = await apkResponse.arrayBuffer();

        // 5. bellum.loadApk(buffer)
        setLoadingStep('Parsing DEX bytecode, resources.arsc & initializing Dalvik runtime...');
        await bellum.loadApk(apkBuffer, sessionData.build.appName);

        // 6. bellum.start()
        setLoadingStep('Launching main activity...');
        await bellum.start();
        setLoadingStep('');
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Execution error';
        setLoadingStep('');
        setRuntimeStatus((prev) => ({
          ...prev,
          status: 'error',
          currentError: msg,
        }));
      }
    };

    bootstrapRunner();

    return () => {
      mounted = false;
      if (cleanupLogListener) cleanupLogListener();
      if (cleanupStatusListener) cleanupStatusListener();
      if (activeModule) {
        try {
          activeModule.stop();
        } catch {
          // ignore
        }
      }
      // End session via PATCH if unmounting
      if (currentSessionId) {
        const token = localStorage.getItem('apkrunner_token');
        fetch(`/api/sessions/${currentSessionId}/end`, {
          method: 'PATCH',
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        }).catch(() => {});
      }
    };
  }, [appId, specificBuildId, checkWebGpuSupport]);

  // Handle Stop button that calls bellum.stop() and ends session via PATCH
  const handleStopSession = async () => {
    if (bellumInstance) {
      try {
        bellumInstance.stop();
      } catch (err) {
        console.error('Error stopping bellum:', err);
      }
    }

    if (sessionId) {
      try {
        const token = localStorage.getItem('apkrunner_token');
        await fetch(`/api/sessions/${sessionId}/end`, {
          method: 'PATCH',
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        });
      } catch (err) {
        console.error('Error ending session:', err);
      }
    }

    router.push(`/apps/${appId}`);
  };

  // Drag and drop local APK onto canvas directly without uploading
  const handleDropOnCanvas = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Only Android .apk files can be dropped here.');
      return;
    }

    if (!bellumInstance || !canvasRef.current) {
      alert('Runtime not ready yet. Please wait for initialization.');
      return;
    }

    try {
      setLoadingStep(`Loading local APK: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);
      const buffer = await file.arrayBuffer();

      setAppName(file.name.replace(/\.apk$/i, ''));
      setPackageName('com.local.' + file.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());

      await bellumInstance.loadApk(buffer, file.name);
      await bellumInstance.start();
      setLoadingStep('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to execute dropped APK');
      setLoadingStep('');
    }
  };

  // Touch & Pointer interaction on 1080x1920 canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bellumInstance || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('down', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bellumInstance || !canvasRef.current || e.buttons === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('move', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bellumInstance || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    bellumInstance.sendTouchEvent('up', Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny)));
  };

  // Android Navigation Bar Actions
  const handleNavBack = () => bellumInstance?.sendKeyEvent('down', 4); // KEYCODE_BACK
  const handleNavHome = () => bellumInstance?.sendKeyEvent('down', 3); // KEYCODE_HOME
  const handleNavRecents = () => bellumInstance?.sendKeyEvent('down', 187); // KEYCODE_APP_SWITCH

  // Auto scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter((l) => {
    if (logFilter !== 'ALL' && l.level !== logFilter) return false;
    if (logSearch) {
      const q = logSearch.toLowerCase();
      return l.message.toLowerCase().includes(q) || l.tag.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-hidden z-50"
    >
      {/* Compatibility Notice if WebGPU is unavailable */}
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
                onClick={() => router.push(`/apps/${appId}`)}
                className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition"
              >
                Return to App Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Runner Bar */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleStopSession}
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
                {appName}
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400">
                  {runtimeStatus.status.toUpperCase()}
                </span>
              </h1>
              <p className="text-[10px] font-mono text-zinc-500">{packageName || 'Client-Side Runtime'}</p>
            </div>
          </div>
        </div>

        {/* Runtime Performance Telemetry */}
        <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                runtimeStatus.status === 'running'
                  ? 'bg-emerald-400 animate-pulse'
                  : runtimeStatus.status === 'error'
                  ? 'bg-red-400'
                  : 'bg-amber-400'
              }`}
            />
            {runtimeStatus.fps} FPS
          </span>
          <span className="text-zinc-600">|</span>
          <span>{runtimeStatus.frameTimeMs.toFixed(1)} ms</span>
          <span className="text-zinc-600">|</span>
          <span className="text-emerald-400">1080x1920 WebGPU</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {runtimeStatus.status === 'running' ? (
            <button
              onClick={() => bellumInstance?.pause()}
              title="Pause Emulation"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => bellumInstance?.resume()}
              title="Resume Emulation"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 transition"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            title="Toggle Logcat Inspector"
            className={`p-2 rounded-lg transition border ${
              sidePanelOpen
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Stop Button */}
          <button
            onClick={handleStopSession}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-black font-bold text-xs transition flex items-center gap-1.5 border border-red-500/30"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop Session
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Android Virtual Device Stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-zinc-950/90 overflow-hidden relative">
          {/* Loading Overlay */}
          {loadingStep && (
            <div className="absolute inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
                <Cpu className="w-6 h-6 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-white">{loadingStep}</p>
              <p className="text-xs text-zinc-500 mt-1 font-mono">100% Client-Side WebAssembly Execution</p>
            </div>
          )}

          {/* Virtual Phone Hardware Bezel */}
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
            onDrop={handleDropOnCanvas}
          >
            {/* Phone Speaker Notch / Status Bar */}
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
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />

              {/* Drag and Drop Overlay Prompt */}
              {isDraggingOver && (
                <div className="absolute inset-0 bg-emerald-950/70 border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center p-4 text-center z-20">
                  <Upload className="w-12 h-12 text-emerald-300 animate-bounce mb-2" />
                  <p className="text-sm font-bold text-white">Drop .apk here to run directly</p>
                  <p className="text-xs text-emerald-300 font-mono">No server upload • Instant local execution</p>
                </div>
              )}
            </div>

            {/* Android Navigation Bar (Back, Home, Recents) */}
            <div className="h-10 bg-zinc-900 rounded-b-[36px] flex items-center justify-around px-8 shrink-0 border-t border-zinc-800/40">
              <button
                onClick={handleNavBack}
                title="Back (KEYCODE_BACK)"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
              >
                ◀
              </button>
              <button
                onClick={handleNavHome}
                title="Home (KEYCODE_HOME)"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
              >
                ●
              </button>
              <button
                onClick={handleNavRecents}
                title="Recents (KEYCODE_APP_SWITCH)"
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
              >
                ■
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Side Panel: Logcat & bellum status messages */}
        {sidePanelOpen && (
          <aside className="w-96 border-l border-zinc-800/80 bg-zinc-900/95 flex flex-col shrink-0 shadow-2xl backdrop-blur-sm z-20">
            {/* Side Panel Header */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Android Logcat & Bellum Console</span>
              </div>
              <button
                onClick={() => setSidePanelOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Runtime Status Summary */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-950/20 text-[11px] font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Engine:</span>
                <span className="text-emerald-400">bellum WebAssembly v1.4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Renderer:</span>
                <span className="text-zinc-300">{webGpuAvailable ? 'WebGPU (1080x1920)' : 'Canvas2D Fallback'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Activity:</span>
                <span className="text-zinc-300 truncate max-w-[180px]">{runtimeStatus.activeActivity || 'Loading...'}</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
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
              <button
                onClick={() => setLogs([])}
                title="Clear Logs"
                className="p-1 text-zinc-500 hover:text-zinc-300"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Log Stream */}
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
