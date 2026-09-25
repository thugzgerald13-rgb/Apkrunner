// /apps/web/src/app/admin/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  HardDrive,
  Activity,
  Shield,
  Clock,
  Layers,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { AdminMetrics } from '@apkrunner/shared';

export default function AdminPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sessions' | 'users'>('sessions');

  useEffect(() => {
    loadAdminMetrics();
  }, []);

  const loadAdminMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('apkrunner_token');
      const res = await fetch('/api/admin/metrics', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          router.push('/dashboard');
          return;
        }
        throw new Error('Failed to load administrative telemetry');
      }

      const data = await res.json();
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching admin metrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
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
              <Shield className="w-4 h-4 text-emerald-400" />
              APKRunner Administration
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Audit & Infrastructure
              </span>
            </h1>
          </div>
        </div>

        <button
          onClick={loadAdminMetrics}
          className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Main Admin Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Telemetry KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">MinIO Storage Consumed</span>
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.storageUsageFormatted : '...'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">S3 Object Bucket: apkrunner-apks</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Active WebGPU Sessions</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono flex items-center gap-2">
              {metrics ? metrics.activeSessionsCount : '...'}
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Client-side active bellum runtimes</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total Registered Users</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.totalUsers : '...'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Better Auth JWT Managed</p>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 mb-2">
              <span className="text-xs font-medium">Total App Builds</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {metrics ? `${metrics.totalApps} apps / ${metrics.totalBuilds} builds` : '...'}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              ClamAV Scanner: {metrics?.clamavEnabled ? 'ACTIVE' : 'OFF'}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="border-b border-zinc-800 flex items-center gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'sessions'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Session Audit Log ({metrics?.recentSessions.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management ({metrics?.usersList.length || 0})
          </button>
        </div>

        {/* Sessions Audit Log Table */}
        {activeTab === 'sessions' && (
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">Session ID</th>
                    <th className="py-3.5 px-6">User</th>
                    <th className="py-3.5 px-6">Target App</th>
                    <th className="py-3.5 px-6">Build Version</th>
                    <th className="py-3.5 px-6">Started At</th>
                    <th className="py-3.5 px-6">Status / Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {metrics?.recentSessions.map((session) => {
                    const isRunning = !session.endedAt;
                    let durationStr = 'Active';
                    if (session.endedAt) {
                      const durMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
                      const seconds = Math.floor(durMs / 1000);
                      durationStr = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
                    }

                    return (
                      <tr key={session.id} className="hover:bg-zinc-800/30 transition">
                        <td className="py-4 px-6 font-mono text-zinc-400">
                          {session.id.substring(0, 8)}...
                        </td>
                        <td className="py-4 px-6 font-medium text-white">
                          {session.user?.email || session.userId}
                        </td>
                        <td className="py-4 px-6 text-zinc-200">
                          {session.build?.app?.name || 'Application'}
                        </td>
                        <td className="py-4 px-6 font-mono text-emerald-400">
                          v{session.build?.version || '1.0.0'}
                        </td>
                        <td className="py-4 px-6 font-mono text-zinc-400">
                          {new Date(session.startedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-4 px-6">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              RUNNING
                            </span>
                          ) : (
                            <span className="font-mono text-zinc-400 text-[11px]">
                              Completed ({durationStr})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users List Table */}
        {activeTab === 'users' && (
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-6">User ID</th>
                    <th className="py-3.5 px-6">Email Address</th>
                    <th className="py-3.5 px-6">Display Name</th>
                    <th className="py-3.5 px-6">Assigned Role</th>
                    <th className="py-3.5 px-6">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {metrics?.usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-4 px-6 font-mono text-zinc-500">
                        {u.id.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-6 font-medium text-white">{u.email}</td>
                      <td className="py-4 px-6 text-zinc-300">{u.name || '—'}</td>
                      <td className="py-4 px-6 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            u.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-zinc-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
