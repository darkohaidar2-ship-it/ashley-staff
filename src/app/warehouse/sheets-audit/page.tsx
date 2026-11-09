'use client';

import React, { Suspense } from 'react';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { Loader2, ArrowRight, Boxes, Home, Sparkles } from 'lucide-react';
import Link from 'next/link';

function WarehouseSheetsAuditContent() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-2 sm:p-4 lg:p-6" dir="rtl">
      {/* Top Breadcrumb Header for Standalone Direct Access */}
      <div className="max-w-[1920px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-black">
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900">
                پشکنینی باری نوێ و جەردی کۆگا • Google Sheets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                پەڕەی سەربەخۆ
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              هاوکاتکردنی دوولایەنەی زەخیڕە و بار لەگەڵ Google Sheets • چێککردنی داگرتنی کۆنتێنەر و جەردی فیزیایی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/adm1n_pan0l?view=sheets_warehouse"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="چوون بۆ پانێڵی سەرەکی ئەدمین"
          >
            <Home className="w-3.5 h-3.5" />
            <span>کۆنتڕۆڵ پانێڵ</span>
          </Link>

          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-800 text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>سیستەمی هۆشمەندی کۆگا</span>
          </div>
        </div>
      </div>

      {/* Main Google Sheets Warehouse Audit Component */}
      <div className="max-w-[1920px] mx-auto">
        <GoogleSheetsWarehouseAudit />
      </div>
    </div>
  );
}

export default function WarehouseSheetsAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-600 font-bold text-sm">تکایە چاوەڕوان بن... پشکنینی باری کۆگا باردەکرێت</p>
        </div>
      }
    >
      <WarehouseSheetsAuditContent />
    </Suspense>
  );
}
