'use client';

import React, { useState } from 'react';
import { KeyRound, Lock, User, CheckCircle2, AlertTriangle, X, Shield } from 'lucide-react';

interface AdminPasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminPasswordChangeModal({ isOpen, onClose }: AdminPasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword.trim()) {
      setMessage({ text: 'تکایە وشەی تێپەڕی ئێستات بنووسە', isError: true });
      return;
    }

    if (!newPassword.trim()) {
      setMessage({ text: 'تکایە وشەی تێپەڕی نوێ بنووسە', isError: true });
      return;
    }

    if (newPassword.trim().length < 3) {
      setMessage({ text: 'وشەی تێپەڕ دەبێت بەلایەنی کەم ٣ پیت یان ژمارە بێت', isError: true });
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setMessage({ text: 'دووبارەکردنەوەی وشەی تێپەڕ وەک یەک نییە!', isError: true });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/attendance/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'هەڵەیەک ڕوویدا');
      }

      setMessage({ text: '🎉 وشەی تێپەڕی ئەدمین بە سەرکەوتوویی لەسەر سوپابەیس نوێکرایەوە!', isError: false });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setMessage({ text: err.message || 'هەڵەیەک ڕوویدا لە کاتی نوێکردنەوە', isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans dir-rtl" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black">گۆڕینی وشەی تێپەڕی ئەدمین (Admin Security)</h3>
              <p className="text-[10px] text-slate-400 font-semibold">پاشەکەوتکردنی ڕاستەوخۆ لەسەر داتابەیسی سوپابەیس</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`p-3 text-xs font-bold flex items-center gap-2 ${
            message.isError ? 'bg-rose-50 text-rose-800 border-b border-rose-200' : 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
          }`}>
            {message.isError ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-bold">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1">
              وشەی تێپەڕی ئێستا (Current Password):
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="وشەی تێپەڕی ئێستات..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none font-mono"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <label className="block text-slate-700 dark:text-slate-300 mb-1">
              ناوی بەکارهێنەری نوێ (ئارەزوومەندانە):
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="admin (ئەگەر بەتاڵ بێت ناگۆڕێت)"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1">
              وشەی تێپەڕی نوێ (New Password):
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="وشەی تێپەڕی نوێ..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 mb-1">
              دووبارەکردنەوەی وشەی تێپەڕی نوێ (Confirm New Password):
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="دووبارەکردنەوە..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl"
            >
              پاشگەزبوونەوە
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-md shadow-indigo-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              {loading ? 'نوێکردنەوە...' : '💾 پاشەکەوتکردنی پاسۆرد'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
