// /apps/web/src/app/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, ShieldCheck, Zap, HardDrive, Smartphone, ArrowRight, Lock, Mail, User } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin ? { email, password } : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('apkrunner_token', data.token);
      localStorage.setItem('apkrunner_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAdminLogin = () => {
    setEmail('admin@apkrunner.local');
    setPassword('AdminPassword123!');
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-black font-black text-xl">
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
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Zero Server Execution
          </span>
          <a
            href="#auth-section"
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition border border-zinc-700 text-xs font-medium"
          >
            Sign In
          </a>
        </div>
      </header>

      {/* Main Hero & Split Layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Value Prop */}
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
            APKRunner executes Android APK binaries 100% on your local machine using the high-performance WebAssembly
            runtime <code className="text-emerald-300 font-mono">bellum</code>, blitting pixels to a native 1080x1920
            WebGPU canvas. Your APKs and data never execute on our servers.
          </p>

          {/* Key Architectural Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/30 transition">
              <div className="flex items-center gap-3 mb-2 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-zinc-200">100% Client-Side Sandbox</h3>
              </div>
              <p className="text-xs text-zinc-400">
                Execution strictly confined inside browser WebAssembly isolation. The server only handles storage.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/30 transition">
              <div className="flex items-center gap-3 mb-2 text-cyan-400">
                <Zap className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-zinc-200">Hardware WebGPU Blit</h3>
              </div>
              <p className="text-xs text-zinc-400">
                Native GPU shaders rasterize Android SurfaceFlinger frames at low-latency 60 FPS.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/30 transition">
              <div className="flex items-center gap-3 mb-2 text-amber-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-zinc-200">Drag & Drop Instant Run</h3>
              </div>
              <p className="text-xs text-zinc-400">
                Drop any local <code className="text-zinc-300 font-mono">.apk</code> directly into the virtual phone to boot immediately.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/30 transition">
              <div className="flex items-center gap-3 mb-2 text-indigo-400">
                <HardDrive className="w-5 h-5" />
                <h3 className="font-semibold text-sm text-zinc-200">Self-Hosted MinIO Storage</h3>
              </div>
              <p className="text-xs text-zinc-400">
                S3-compatible object storage with chunked uploads up to 500MB and automatic icon extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div id="auth-section" className="lg:col-span-5">
          <div className="p-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

            <div className="flex items-center justify-between pb-6 border-b border-zinc-800 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {isLogin ? 'Sign in to access your Android APK library' : 'Set up your self-hosted APKRunner user'}
                </p>
              </div>
              <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    !isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : isLogin ? 'Sign In to APKRunner' : 'Create Account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center">
              <button
                type="button"
                onClick={handleDemoAdminLogin}
                className="text-xs text-zinc-400 hover:text-emerald-400 font-mono transition flex items-center justify-center gap-1 mx-auto"
              >
                <span>Quick Fill:</span>
                <span className="underline decoration-dotted text-zinc-300">admin@apkrunner.local</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 px-6 py-4 text-center text-xs text-zinc-600 font-mono">
        APKRunner • Architecture: Browser WASM Dalvik/ART + WebGPU SurfaceFlinger • No Server Emulation
      </footer>
    </div>
  );
}
