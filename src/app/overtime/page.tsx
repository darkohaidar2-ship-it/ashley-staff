'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import { cn } from '@/lib/utils';
import { AdminOvertimeModule } from '@/components/admin/AdminOvertimeModule';

function OvertimePage() {
  const { language } = useTranslation();
  const { employees } = useAppContext();
  const isRTL = language === 'ku';

  return (
    <div className="space-y-4 p-3 sm:p-6 max-w-[1600px] mx-auto font-sans dir-rtl" dir="rtl">
      {/* Quick Navigation Bar */}
      <div className="flex items-center justify-between gap-3 bg-white/90 backdrop-blur-xl p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-xs no-print">
        <div className="flex items-center gap-2.5">
          <Link 
            href="/adm1n_pan0l"
            className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95"
            title="گەرانەوە بۆ داشبۆردی سەرەکی"
          >
            <ArrowLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-slate-900">
              بەشی کاتی زیادەی کارمەندان
            </span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline-block">
              / Overtime Hub
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link 
            href="/adm1n_pan0l"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
          >
            داشبۆردی سەرەکی
          </Link>
        </div>
      </div>

      {/* Main Overtime Module */}
      <AdminOvertimeModule employees={employees} />
    </div>
  );
}

export default withAuth(OvertimePage);
