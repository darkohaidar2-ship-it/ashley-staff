'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldAlert,
  Lock,
  ArrowRight,
  Award,
  MessageSquareHeart,
  ShieldCheck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { AdminFeedbackDashboard } from '@/components/admin/AdminFeedbackDashboard';
import { AdminManagerEvaluationDashboard } from '@/components/admin/AdminManagerEvaluationDashboard';

function FeedbackAdminContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');

  const [checkingSession, setCheckingSession] = useState<boolean>(true);
  const [isAdminAuthed, setIsAdminAuthed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'manager_evaluation' | 'feedback'>(
    viewParam === 'feedback' ? 'feedback' : 'manager_evaluation'
  );

  useEffect(() => {
    if (viewParam === 'feedback' || viewParam === 'manager_evaluation') {
      setActiveTab(viewParam);
    }
  }, [viewParam]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Never allow employee/form 0000-5999 PIN tokens to unlock the admin results page
    try {
      sessionStorage.removeItem('ashley_manager_auth_pin');
    } catch {
      // ignore storage errors
    }

    try {
      const stored =
        sessionStorage.getItem('ashley_admin_session') ||
        localStorage.getItem('ashley_admin_session');
      if (stored) {
        if (stored === 'active') {
          setIsAdminAuthed(true);
        } else {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
            setIsAdminAuthed(true);
          }
        }
      }
    } catch {
      setIsAdminAuthed(false);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-6 text-white" dir="rtl">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-300">پشکنینی مۆڵەتی ئەدمین...</p>
      </div>
    );
  }

  // Strictly block access unless signed in as an Administrator (ashley_admin_session)
  if (!isAdminAuthed) {
    return (
      <div
        className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center p-4 sm:p-6"
        dir="rtl"
      >
        <div className="w-full max-w-lg rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-400 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-black">
              <Lock className="w-3.5 h-3.5" />
              تەنها بۆ ئەدمین (Admin-Only)
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              شیکردنەوەی ئەنجامەکان تەنها لە ئەدمین پانێڵە
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              کۆدەکانی <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">0000 - 5999</code> تەنها بۆ پڕکردنەوەی فۆرمە نهێنییەکەیە لەلایەن کارمەندان و فرۆشیارانەوە. بۆ بینینی ئەنجامەکانی هەڵسەنگاندنی بەڕێوەبەر (بەشی سێیەم ٢٠ تا ١٠٠) تکایە وەک ئەدمین بچۆ ژوورەوە.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <Link
              href="/adm1n_pan0l?view=manager_evaluation"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Award className="w-4 h-4" />
              <span>چوونەژوورەوە بۆ ئەدمین پانێڵ (هەڵسەنگاندنی بەڕێوەبەر)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/adm1n_pan0l?view=feedback"
              className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageSquareHeart className="w-4 h-4 text-rose-400" />
              <span>بەشی فیدباکی کارمەندان (ئەدمین پانێڵ)</span>
            </Link>

            <Link
              href="/feedback"
              className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>گەڕانەوە بۆ دەرگای فۆرمی هەڵسەنگاندن (PIN)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900" dir="rtl">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/adm1n_pan0l"
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all"
            >
              <ArrowRight className="w-4 h-4 text-amber-600" />
              <span>ئەدمین پانێڵی سەرەکی</span>
            </Link>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>دەسەڵاتی ئەدمین چالاکە</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('manager_evaluation')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'manager_evaluation'
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>هەڵسەنگاندنی بەڕێوەبەر</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('feedback')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                activeTab === 'feedback'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquareHeart className="w-4 h-4 text-rose-500" />
              <span>فیدباکی کارمەندان</span>
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 sm:p-6">
        {activeTab === 'manager_evaluation' ? (
          <AdminManagerEvaluationDashboard />
        ) : (
          <AdminFeedbackDashboard />
        )}
      </main>
    </div>
  );
}

export default function FeedbackAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-slate-950 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <FeedbackAdminContent />
    </Suspense>
  );
}
