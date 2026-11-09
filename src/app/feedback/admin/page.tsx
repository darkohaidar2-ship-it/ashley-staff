'use client';

import React, { Suspense } from 'react';
import { AdminFeedbackDashboard } from '@/components/admin/AdminFeedbackDashboard';
import { Loader2, ArrowRight, ShieldCheck, Home } from 'lucide-react';
import Link from 'next/link';

function FeedbackAdminContent() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-3 sm:p-6" dir="rtl">
      {/* Top Breadcrumb Header for Direct Access */}
      <div className="max-w-[1920px] mx-auto mb-4 flex items-center justify-between bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center font-black">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900">
                سیستەمی بەڕێوەبردنی فیدباک و هەڵسەنگاندن
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                داشبۆردی سەربەخۆ
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              پەڕەی سەربەخۆی بەڕێوەبردن • بەستراوە بە هەردوو ناونیشانی /feedback/admin و /adm1n_pan0l
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/adm1n_pan0l"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="گەڕانەوە بۆ کۆنتڕۆڵ پانێڵی سەرەکی"
          >
            <Home className="w-3.5 h-3.5" />
            <span>کۆنتڕۆڵ پانێڵ</span>
          </Link>

          <Link
            href="/feedback"
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
            title="کردنەوەی پۆرتاڵی فیدباک لە پەنجەرەیەکی نوێ"
          >
            <span>کردنەوەی پۆرتاڵ</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      </div>

      <div className="max-w-[1920px] mx-auto">
        <AdminFeedbackDashboard />
      </div>
    </div>
  );
}

export default function FeedbackAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]" dir="rtl">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs font-bold text-slate-500">بارکردنی داشبۆردی فیدباک...</p>
          </div>
        </div>
      }
    >
      <FeedbackAdminContent />
    </Suspense>
  );
}
