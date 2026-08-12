'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { language } = useTranslation();
  const isRTL = language === 'ku';

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(username, password);
      if (success) {
        router.push('/admin');
      } else {
        setError(isRTL ? 'ناوی بەکاربهێنەر یان وشەی تێپەڕ نادروستە' : 'Invalid username or password');
      }
    } catch {
      setError(isRTL ? 'هەڵەیەک ڕوویدا لە کاتی چوونە ژوورەوە' : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-8 shadow-md">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isRTL ? 'داخڵبوونی ئەدمین (Admin)' : 'Admin Login'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isRTL ? 'تکایە زانیارییەکان بنووسە بۆ بەڕێوەبردنی سیستەم' : 'Enter credentials to access full management system'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'ناوی بەکاربهێنەر (Username):' : 'Username:'}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isRTL ? 'وشەی تێپەڕ (Password):' : 'Password:'}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-md text-sm transition-colors cursor-pointer"
          >
            {loading ? (isRTL ? 'داخڵبوون...' : 'Logging in...') : (isRTL ? 'چوونە ژوورەوە' : 'Log In')}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <Link href="/" className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            {isRTL ? '← گەڕانەوە بۆ لاپەڕەی سەرەکی' : '← Back to Main Page'}
          </Link>
        </div>

      </div>
    </div>
  );
}
