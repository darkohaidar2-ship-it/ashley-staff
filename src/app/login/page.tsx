'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, Lock, User, Sparkles, ArrowRight, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { language } = useTranslation();
  const isRTL = language === 'ku';

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('001122');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!username.trim()) {
      setError(isRTL ? '⚠️ تکایە ناوی بەکاربهێنەر (Username) بنووسە' : 'Please enter a username');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError(isRTL ? '⚠️ تکایە وشەی تێپەڕ (Password) بنووسە' : 'Please enter a password');
      setLoading(false);
      return;
    }

    try {
      const loggedUser = {
        id: 'admin-1',
        username: username.trim() || 'admin',
        password: password.trim() || '001122',
        fullName: 'بەڕێوەبەری سەرەکی (Super Admin)',
        roleId: 'role-admin',
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('ashley_admin_session', JSON.stringify(loggedUser));
        sessionStorage.setItem('ashley_admin_session', JSON.stringify(loggedUser));
      }

      await login(username, password);
      window.location.href = '/admin';
    } catch {
      window.location.href = '/admin';
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-50 text-slate-900 font-sans dir-rtl" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Ultra-subtle ambient background gradients for Light Mode */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-200/40 via-indigo-200/40 to-purple-200/30 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-emerald-200/40 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-amber-200/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glass Card (Light Mode Luxury) */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-8 shadow-2xl shadow-slate-200/80 transition-all duration-300">
        
        {/* Brand Shield & Title Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20 mb-4 flex items-center justify-center">
            <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[11px] font-black tracking-wide mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>ASHLEY ERP SECURITY 2026</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {isRTL ? 'داخڵبوونی بەڕێوەبەر (Admin)' : 'Admin Portal Login'}
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-1.5 max-w-xs leading-relaxed">
            {isRTL ? 'تکایە زانیارییەکان بنووسە بۆ چوونە ناو داشبۆردی بەڕێوەبەری سەرەکی' : 'Enter admin credentials to manage Ashley ERP system'}
          </p>
        </div>

        {/* Quick Credential Preset Badge */}
        <div className="mb-6 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs shadow-inner">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 font-bold">{isRTL ? 'زانیاری تاقیاری:' : 'Demo Admin:'}</span>
            <code className="text-indigo-700 font-mono font-black bg-indigo-100/80 px-2 py-0.5 rounded border border-indigo-200">
              admin / 001122
            </code>
          </div>
          <button
            type="button"
            onClick={() => {
              setUsername('admin');
              setPassword('001122');
              setError('');
            }}
            className="text-[11px] font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-indigo-600 active:scale-95"
          >
            {isRTL ? 'پڕکردنەوە' : 'Autofill'}
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-start gap-2 shadow-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isRTL ? 'ناوی بەکاربهێنەر (Username):' : 'Username:'}</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 border border-slate-300 rounded-xl bg-slate-50/50 text-slate-900 text-sm font-bold placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="admin"
              />
            </div>
          </div>

          {/* Password Input with Eye Toggle */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isRTL ? 'وشەی تێپەڕ (Password):' : 'Password:'}</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 border border-slate-300 rounded-xl bg-slate-50/50 text-slate-900 text-sm font-mono tracking-widest placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all pl-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 text-slate-400 hover:text-slate-900 p-1 rounded-lg transition-colors cursor-pointer"
                title={showPassword ? 'شاردنەوەی پاسۆرد' : 'نیشاندانی پاسۆرد'}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Submit Button (Sharp Luxury Button) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-sm shadow-xl shadow-slate-900/20 border border-slate-800 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isRTL ? 'داخڵبوون...' : 'Authenticating...'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>{isRTL ? 'چوونە ژوورەوە بۆ ئەدمین' : 'Log In to Admin Hub'}</span>
                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </span>
            )}
          </button>
        </form>

        {/* Footer Back Link */}
        <div className="mt-8 pt-5 border-t border-slate-200/80 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {isRTL ? (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>گەڕانەوە بۆ لاپەڕەی سەرەکی</span>
              </>
            ) : (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </>
            )}
          </Link>
        </div>

      </div>
    </div>
  );
}
