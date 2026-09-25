// /apps/web/src/app/apps/[id]/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  UploadCloud,
  Trash2,
  Package,
  Calendar,
  Layers,
  FileCode,
  HardDrive,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { App, Build } from '@apkrunner/shared';

interface AppDetail extends App {
  owner?: { id: string; email: string; name?: string };
  builds: Build[];
}

export default function AppDetailPage() {
  const params = useParams();
  const router = useRouter();
  const appId = params.id as string;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAppDetail();
  }, [appId]);

  const loadAppDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('apkrunner_token');
      const res = await fetch(`/api/apps/${appId}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        throw new Error('Application could not be found or access is denied');
      }

      const data = await res.json();
      setApp(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching application details');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!confirm(`Are you sure you want to delete ${app?.name}? This will permanently remove all historical APK builds and MinIO storage binaries.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem('apkrunner_token');
      const res = await fetch(`/api/apps/${appId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete application');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete app');
      setIsDeleting(false);
    }
  };

  const handleUploadNewBuild = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apk')) {
      alert('Only Android .apk files can be uploaded');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const token = localStorage.getItem('apkrunner_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(60);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Build upload failed');
      }

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setShowUploadModal(false);
        setUploadProgress(null);
        loadAppDetail();
      }, 600);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to upload build');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-zinc-400">Loading App & Build History...</p>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Error</h2>
          <p className="text-xs text-zinc-400 mb-6">{error || 'App not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const latestBuild = app.builds?.[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
              {app.name}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {app.packageName}
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
            onClick={() => router.push(`/apps/${app.id}/run`)}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Latest (v{latestBuild?.version || '1.0.0'})
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* App Overview Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">🤖</span>
              )}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white">{app.name}</h2>
              <p className="text-xs font-mono text-emerald-400">{app.packageName}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-500" />
                  {app.builds.length} {app.builds.length === 1 ? 'Build' : 'Builds'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  Created {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'Recent'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteApp}
              disabled={isDeleting}
              className="px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-red-300 hover:text-red-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? 'Deleting...' : 'Delete App'}
            </button>
          </div>
        </div>

        {/* Build History Table */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Build History</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Every uploaded APK binary is preserved in MinIO S3 and runnable directly in the WebGPU canvas
              </p>
            </div>
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
                {app.builds.map((b, idx) => (
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
                        onClick={() => router.push(`/apps/${app.id}/run?buildId=${b.id}`)}
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1">Upload New Build for {app.name}</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Select or drop an updated <code className="text-emerald-400 font-mono">.apk</code>. Version numbers will be automatically extracted from AndroidManifest.xml.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer transition bg-zinc-950/40"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleUploadNewBuild(selectedFile);
                }}
              />
              <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-200">Click to choose or drag updated APK</p>
              <p className="text-xs text-zinc-500 mt-1">Chunked upload up to 500MB</p>
            </div>

            {isUploading && (
              <div className="mt-4 space-y-2">
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
