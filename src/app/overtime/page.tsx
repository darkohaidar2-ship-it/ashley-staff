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
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto font-sans dir-rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
              <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
            </Button>
          </Link>
          <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-white shadow-md shadow-orange-500/20">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              تۆمار و ئاماری کاتی زیادە (Overtime Management)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              سیستەمی بەڕێوەبردن، ئاماری ڕۆژانە و مانگانەی کاتی زیادەی کارمەندان (پەیوەست بە ئامادەبوون)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="outline" className="btn-classic text-xs font-bold gap-1.5">
              <span>گەرانەوە بۆ داشبۆردی سەرەکی</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Overtime Module */}
      <AdminOvertimeModule employees={employees} />
    </div>
  );
}

export default withAuth(OvertimePage);
