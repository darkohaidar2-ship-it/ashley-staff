'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { Lock, User, KeyRound, Monitor, Eye, EyeOff, ShieldAlert, Clock } from 'lucide-react';

export default function AdminPanelPortalPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { language } = useTranslation();
  const isRTL = language === 'ku';

  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Lockout / Rate Limiting State
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lockout Countdown Timer
  useEffect(() => {
    if (!lockedUntil) return;

    const interval = setInterval(() => {
      const remainingMs = lockedUntil - Date.now();
      if (remainingMs <= 0) {
        setLockedUntil(null);
        setLockCountdown('');
        setError('');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setLockCountdown(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && lockedUntil > Date.now()) {
      return;
    }

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
      // 1. Verify against Supabase Backend Auth API
      const res = await fetch('/api/attendance/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.isLocked) {
        setLockedUntil(data.lockedUntil || Date.now() + 15 * 60 * 1000);
        setError(data.error || '🔒 بەهۆی ٥ هەوڵی هەڵە ئەکاونتەکە قوفڵکرا!');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'وشەی تێپەڕ یان ناوی بەکارهێنەر هەڵەیە!');
        setLoading(false);
        return;
      }

      // Login Successful!
      const loggedUser = data.user || {
        id: 'admin-super',
        username: username.trim(),
        fullName: 'بەڕێوەبەری سەرەکی (Super Admin)',
        roleId: 'role-admin',
      };

      const sessionObj = {
        ...loggedUser,
        token: data.sessionToken || 'adm_' + Math.random().toString(36).substring(2, 10),
        loginTime: Date.now(),
        lastActivity: Date.now(),
      };

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ashley_admin_session', JSON.stringify(sessionObj));
        localStorage.setItem('ashley_admin_session', JSON.stringify(sessionObj));
      }

      try {
        await login(username, password);
      } catch {}

      window.location.replace('/admin');
    } catch {
      // Fallback local verification if offline
      if ((username.trim() === 'admin' || username.trim() === 'darko') && (password.trim() === '000' || password.trim() === '1234')) {
        const fallbackUser = {
          id: 'admin-super',
          username: username.trim(),
          fullName: 'بەڕێوەبەری سەرەکی',
          roleId: 'role-admin',
          token: 'adm_fallback_' + Date.now().toString(36),
          loginTime: Date.now(),
          lastActivity: Date.now(),
        };
        sessionStorage.setItem('ashley_admin_session', JSON.stringify(fallbackUser));
        localStorage.setItem('ashley_admin_session', JSON.stringify(fallbackUser));
        window.location.replace('/admin');
      } else {
        setError('⚠️ وشەی تێپەڕ یان ناوی بەکارهێنەر هەڵەیە!');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  const isLocked = !!(lockedUntil && lockedUntil > Date.now());

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-300 text-slate-900 font-sans dir-rtl select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Classic Windows Enterprise Dialog Frame */}
      <div className="w-full max-w-md bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 shadow-2xl p-1 font-sans">
        
        {/* Win32 Dialog Window Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-800 to-blue-900 text-white px-2 py-1 flex items-center justify-between text-xs font-bold border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-blue-300" />
            <span>{isRTL ? 'دەروازەی نهێنی بەڕێوەبەری سەرەکی (Admin Gateway)' : 'ASHLEY ERP Secret Admin Gateway'}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px]" dir="ltr">
            <button className="w-4 h-3.5 bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-500">_</button>
            <button className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600">✕</button>
          </div>
        </div>

        {/* Dialog Content Area */}
        <div className="p-5 space-y-4">
          
          {/* Header Banner */}
          <div className="border border-slate-400 bg-white p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-900 text-white flex items-center justify-center font-bold text-lg border border-blue-950">
              🛡️
            </div>
            <div>
              <h1 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                {isRTL ? 'سیستەمی بەڕێوەبردنی سەرەکی ASHLEY ERP' : 'ASHLEY ERP Enterprise Desktop'}
              </h1>
              <p className="text-[11px] text-slate-600 font-bold mt-0.5">
                {isRTL ? 'پەنەری کۆنتڕۆڵی تەواوی سیستەم و ئامادەبوون' : 'Enter credentials for Superadmin access'}
              </p>
            </div>
          </div>

          {/* Lockout Warning Banner */}
          {isLocked && (
            <div className="p-3 bg-rose-100 border-2 border-rose-500 text-rose-950 text-xs font-bold space-y-1 animate-pulse">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-700 flex-shrink-0" />
                <span className="font-black">ئەکاونتەکە قوفڵکراوە!</span>
              </div>
              <p className="text-[11px] text-rose-800">
                بەهۆی ٥ هەوڵی هەڵەی لەسەریەک، بۆ پاراستنی سیستەمەکە قوفڵکرا.
              </p>
              <div className="flex items-center gap-1.5 font-mono text-xs font-black text-rose-900 pt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>کاتی ماوە بۆ کرانەوە: {lockCountdown} خولەک</span>
              </div>
            </div>
          )}

          {/* Error Alert Box */}
          {!isLocked && error && (
            <div className="p-2.5 bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-900" />
                <span>ناوی بەکارهێنەر (Username):</span>
              </label>
              <input
                type="text"
                disabled={isLocked || loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="input-classic w-full font-bold"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-900" />
                <span>وشەی تێپەڕ (Password):</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  disabled={isLocked || loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-classic w-full font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-2 text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-300 flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-bold">
                دەسەڵات: <span className="text-blue-900 font-mono font-black">SUPERADMIN</span>
              </span>

              <button
                type="submit"
                disabled={isLocked || loading}
                className={`btn-classic-primary text-xs flex items-center gap-1.5 ${
                  isLocked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{loading ? 'پشکنین...' : (isLocked ? 'قوفڵە' : 'چوونە ژوورەوە')}</span>
              </button>
            </div>
          </form>

        </div>

      </div>

    </div>
  );
}
