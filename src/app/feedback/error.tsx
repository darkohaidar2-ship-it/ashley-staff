'use client';

import React, { useEffect } from 'react';
import { RotateCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function FeedbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for diagnostics
    console.error('[Feedback Client Exception]:', error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#f2f2f7]" dir="rtl">
      <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-slate-900">
            کێشەیەکی کاتی لە پەڕەکە ڕوویدا
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
            پەڕەکە دەتوانێت دەستبەجێ بە شێوازێکی پارێزراو نوێ ببێتەوە.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 text-right">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>وەڵامەکانت پارێزراون و فیدباکەکە بەردەوامە.</span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else {
              reset();
            }
          }}
          className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
        >
          <RotateCw className="w-4 h-4" />
          <span>دووبارە کردنەوە و بەردەوامبوون</span>
        </button>
      </div>
    </div>
  );
}
