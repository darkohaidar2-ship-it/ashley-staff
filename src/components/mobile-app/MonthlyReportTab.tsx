'use client';

import React from 'react';
import { 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles,
  UserCheck
} from 'lucide-react';
import { MonthStatsInfo, MobileAuthUser } from './types';

interface MonthlyReportTabProps {
  user: MobileAuthUser;
  stats: MonthStatsInfo | null;
  isDark?: boolean;
}

export function MonthlyReportTab({ user, stats, isDark = false }: MonthlyReportTabProps) {
  const records = stats?.records || [];

  return (
    <div className="space-y-3.5 pb-20">
      {/* Header */}
      <div>
        <h2 className={`text-base font-black flex items-center gap-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          <span>📊</span> ڕاپۆرتی دەوامی مانگانە
        </h2>
        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          ئاماری ئامادەبوون و کاتی زیادەی مانگی {stats?.month || 'ئەم مانگە'}
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className={`p-3.5 border rounded-2xl text-center shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <span className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ڕۆژانی ئامادەبوو</span>
          <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.presentDays || 0}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">ڕۆژ</span>
        </div>

        <div className={`p-3.5 border rounded-2xl text-center shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <span className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کاتی زیادە</span>
          <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
            {stats?.totalOvertimeMinutes ? Math.round(stats.totalOvertimeMinutes / 60) : 0}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">کاتژمێر</span>
        </div>

        <div className={`p-3.5 border rounded-2xl text-center shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <span className={`text-[10px] font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>تەئخیربوون</span>
          <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
            {stats?.totalLateMinutes || 0}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">خولەک</span>
        </div>
      </div>

      {/* Detailed Day-by-Day List */}
      <div className="space-y-2">
        <h3 className={`text-xs font-bold px-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          خشتەی ڕۆژانەی ئەم مانگە
        </h3>

        {records.length === 0 ? (
          <div className={`py-12 border rounded-3xl text-center text-xs ${
            isDark 
              ? 'bg-slate-900/40 border-slate-800 text-slate-500' 
              : 'bg-white border-slate-200 text-slate-400'
          }`}>
            هیچ دەوامێک تۆمار نەکراوە لەم مانگەدا.
          </div>
        ) : (
          records.map((rec, idx) => (
            <div
              key={`${rec.date}-${idx}`}
              className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 shadow-xs ${
                isDark 
                  ? 'bg-slate-900/90 border-slate-800 text-white' 
                  : 'bg-white border-slate-200/90 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800' 
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {rec.date.split('-')[1]}
                  </span>
                  <span className={`text-xs font-black font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {rec.date.split('-')[2]}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold font-mono" dir="ltr">
                      {rec.date}
                    </span>
                    {rec.status === 'Present' ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        ئامادەبوو
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {rec.status}
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-2 text-[11px] font-mono ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>هاتن: {rec.check_in_time || '--:--'}</span>
                    <span>•</span>
                    <span>دەرچوون: {rec.check_out_time || '--:--'}</span>
                  </div>

                  {rec.check_out_note && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                      هۆکار: {rec.check_out_note}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left shrink-0 font-mono" dir="ltr">
                {(rec.overtime_minutes || 0) > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">
                    +{rec.overtime_minutes} خولەک
                  </span>
                )}
                {(rec.late_minutes || 0) > 0 && (
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">
                    -{rec.late_minutes} خولەک
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
