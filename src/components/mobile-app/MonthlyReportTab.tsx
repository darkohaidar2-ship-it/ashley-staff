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
}

export function MonthlyReportTab({ user, stats }: MonthlyReportTabProps) {
  const records = stats?.records || [];

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>📊</span> ڕاپۆرتی دەوامی مانگانە
        </h2>
        <p className="text-[11px] text-slate-400">
          ئاماری ئامادەبوون و کاتی زیادەی مانگی {stats?.month || 'ئەم مانگە'}
        </p>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-center">
          <span className="text-[10px] text-slate-400 block mb-1">ڕۆژانی ئامادەبوو</span>
          <span className="text-xl font-bold font-mono text-emerald-400">
            {stats?.presentDays || 0}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">ڕۆژ</span>
        </div>

        <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-center">
          <span className="text-[10px] text-slate-400 block mb-1">کاتی زیادە</span>
          <span className="text-xl font-bold font-mono text-amber-400">
            {stats?.totalOvertimeMinutes ? Math.round(stats.totalOvertimeMinutes / 60) : 0}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">کاتژمێر</span>
        </div>

        <div className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-center">
          <span className="text-[10px] text-slate-400 block mb-1">تەئخیربوون</span>
          <span className="text-xl font-bold font-mono text-rose-400">
            {stats?.totalLateMinutes || 0}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">خولەک</span>
        </div>
      </div>

      {/* Detailed Day-by-Day List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 px-1">
          خشتەی ڕۆژانەی ئەم مانگە
        </h3>

        {records.length === 0 ? (
          <div className="py-12 bg-slate-800/40 border border-slate-800 rounded-3xl text-center text-slate-500 text-xs">
            هیچ دەوامێک تۆمار نەکراوە لەم مانگەدا.
          </div>
        ) : (
          records.map((rec, idx) => (
            <div
              key={`${rec.date}-${idx}`}
              className="p-3.5 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-slate-400 font-mono">
                    {rec.date.split('-')[1]}
                  </span>
                  <span className="text-xs font-black text-white font-mono">
                    {rec.date.split('-')[2]}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-white font-mono">
                      {rec.date}
                    </span>
                    {rec.status === 'Present' ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        ئامادەبوو
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-400 font-medium">
                        {rec.status}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-300 font-mono">
                    <span>هاتن: {rec.check_in_time || '--:--'}</span>
                    <span>•</span>
                    <span>دەرچوون: {rec.check_out_time || '--:--'}</span>
                  </div>

                  {rec.check_out_note && (
                    <p className="text-[10px] text-amber-400/90 mt-0.5">
                      هۆکار: {rec.check_out_note}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left shrink-0">
                {(rec.overtime_minutes || 0) > 0 && (
                  <span className="text-[10px] font-bold text-amber-400 block font-mono">
                    +{rec.overtime_minutes} خولەک
                  </span>
                )}
                {(rec.late_minutes || 0) > 0 && (
                  <span className="text-[10px] font-bold text-rose-400 block font-mono">
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
