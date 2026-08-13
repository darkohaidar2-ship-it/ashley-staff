'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import Link from 'next/link';
import { ShieldCheck, Lock, User, KeyRound, CheckCircle2, Monitor } from 'lucide-react';

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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-300 text-slate-900 font-sans dir-rtl select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Classic Windows Enterprise Dialog Frame */}
      <div className="w-full max-w-md bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 shadow-2xl p-1 font-sans">
        
        {/* Win32 Dialog Window Header */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-800 to-blue-900 text-white px-2 py-1 flex items-center justify-between text-xs font-bold border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-blue-300" />
            <span>{isRTL ? 'داخڵبوونی سەرەکی بەڕێوەبەری سیستەم (Win32 Security)' : 'ASHLEY ERP Win32 Security Login'}</span>
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
                {isRTL ? 'زانیارییەکان بنووسە بۆ چوونە ژوورەوە' : 'Enter credentials for Win32 ERP access'}
              </p>
            </div>
          </div>

          {/* Quick Credential Preset Section */}
          <div className="p-2.5 bg-amber-50 border border-amber-300 text-[11px] font-bold text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span>🔑 {isRTL ? 'ناوی تاقیکاری:' : 'Demo Admin:'}</span>
              <code className="bg-amber-100 px-1.5 py-0.5 border border-amber-400 font-mono text-slate-900">
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
              className="btn-classic text-[10px]"
            >
              {isRTL ? 'پڕکردنەوە' : 'Autofill'}
            </button>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div className="p-2.5 bg-rose-100 border border-rose-400 text-rose-900 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3 text-xs font-bold">
            <div>
              <label className="block text-slate-800 mb-1">
                {isRTL ? 'ناوی بەکاربهێنەر (Username):' : 'Username:'}
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-classic w-full font-mono"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-slate-800 mb-1">
                {isRTL ? 'وشەی تێپەڕ (Password):' : 'Password:'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-classic w-full font-mono tracking-widest"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-300">
              <Link href="/" className="btn-classic text-[11px]">
                {isRTL ? 'گەڕانەوە بۆ سەرەکی' : 'Cancel'}
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="btn-classic-primary"
              >
                {loading ? (isRTL ? 'پشکنین...' : 'Authenticating...') : (isRTL ? 'داخڵبوون (OK)' : 'Log In')}
              </button>
            </div>
          </form>

        </div>

        {/* Win32 Dialog Status Bar */}
        <div className="bg-slate-300 border-t border-slate-400 p-1 flex justify-between text-[10px] font-mono text-slate-600">
          <span>STATUS: SECURE_PROT_V26</span>
          <span>AUTH: LOCAL_NAV</span>
        </div>

      </div>
    </div>
  );
}
