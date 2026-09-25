// /apps/web/src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Play,
  UploadCloud,
  Search,
  Plus,
  Package,
  Layers,
  Shield,
  LogOut,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Clock,
  HardDrive,
} from 'lucide-react';
import { App } from '@apkrunner/shared';

export default function DashboardPage() {
  const router = useRouter();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; role: string; name?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('apkrunner_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore
      }
    }
    loadApps();
  }, []);

  const loadApps = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('apkrunner_token');
      const url = query ? `/api/apps?search=${encodeURIComponent(query)}` : '/api/apps';
      const res = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Failed to load applications library');
      }

      const json = await res.json();
      setApps(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error loading applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    loadApps(val);
  };

  const handleLogout = () => {
    localStorage.removeItem('apkrunner_token');
    localStorage.removeItem('apkrunner_user');
    router.push('/');
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Only Android .apk files can be uploaded');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      alert('File exceeds the 500MB maximum upload limit');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatusMsg('Reading APK bytecode & manifest...');

    const token = localStorage.getItem('apkrunner_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(40);
      setUploadStatusMsg('Validating MIME & uploading to MinIO S3...');

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      setUploadProgress(85);
      setUploadStatusMsg('Extracting icon & registering build...');

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadProgress(100);
      setUploadStatusMsg('Completed!');
      setTimeout(() => {
        setIsUploading(false);
        setShowUploadModal(false);
        setUploadProgress(null);
        loadApps(search);
      }, 700);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload APK');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-black text-lg shadow-md group-hover:scale-105 transition">
              🤖
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                APKRunner
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Library
                </span>
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium">Dashboard</span>
            {user?.role === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
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
              <p className="text-white font-medium text-xs leading-none">{user?.name || user?.email || 'User'}</p>
              <span className="text-[10px] text-zinc-500 font-mono">{user?.role || 'user'}</span>
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* Search & Actions Bar */}
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
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            <button
              onClick={() => loadApps(search)}
              title="Refresh"
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error Boundary Notice */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadApps(search)}
              className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100 font-mono text-[11px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800" />
                  <div className="space-y-2 flex-1 pt-1">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-zinc-800/50 rounded w-2/3" />
                  <div className="h-9 bg-zinc-800 rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && apps.length === 0 && (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 max-w-lg mx-auto p-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-emerald-400">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Android Apps Found</h3>
            <p className="text-xs text-zinc-400 mt-2 mb-6">
              Upload your first Android <code className="text-zinc-300 font-mono">.apk</code> file to run it in the WebGPU bellum engine.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Upload APK Now
            </button>
          </div>
        )}

        {/* App Library Grid */}
        {!loading && apps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {apps.map((app) => (
              <div
                key={app.id}
                className="group rounded-2xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 transition-all p-5 flex flex-col justify-between shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 group-hover:bg-emerald-500/10 blur-2xl rounded-full transition pointer-events-none" />

                <div>
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt={app.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to emoji robot
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-2xl">🤖</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        onClick={() => router.push(`/apps/${app.id}`)}
                        className="font-bold text-sm text-white truncate cursor-pointer hover:text-emerald-400 transition"
                      >
                        {app.name}
                      </h3>
                      <p className="text-[11px] font-mono text-zinc-500 truncate" title={app.packageName}>
                        {app.packageName}
                      </p>
                      <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-[10px] font-mono text-zinc-300">
                        <span>v{app.latestBuild?.version || '1.0.0'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-zinc-400 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-zinc-500">
                        <HardDrive className="w-3 h-3" /> Size
                      </span>
                      <span className="font-mono text-zinc-300">
                        {app.latestBuild ? `${(app.latestBuild.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-zinc-500">
                        <Clock className="w-3 h-3" /> Updated
                      </span>
                      <span className="font-mono text-zinc-300">
                        {app.latestBuild?.uploadedAt
                          ? new Date(app.latestBuild.uploadedAt).toLocaleDateString()
                          : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button
                    onClick={() => router.push(`/apps/${app.id}`)}
                    className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 text-xs font-medium transition text-center"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => router.push(`/apps/${app.id}/run`)}
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
              APKs are stored in MinIO S3 and parsed for package metadata and icons. Execution remains 100% client-side.
            </p>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) handleFileUpload(droppedFile);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer transition bg-zinc-950/40 hover:bg-zinc-950/70"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileUpload(selectedFile);
                }}
              />
              <UploadCloud className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-200">
                Click to browse or drop an <span className="text-emerald-400 font-mono">.apk</span> file
              </p>
              <p className="text-xs text-zinc-500 mt-1">Maximum file size: 500MB (Chunked upload enabled)</p>
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
                    style={{ width: `${uploadProgress || 0}%` }}
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
