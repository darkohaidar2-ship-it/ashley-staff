'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Sparkles,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Printer,
  FileText,
  ExternalLink,
  RefreshCw,
  Loader2,
  Calendar,
  X,
  MapPin,
  Check,
  Filter,
  AlertCircle
} from 'lucide-react';
import { MonthStatsInfo, MobileAuthUser } from './types';
import { 
  formatKurdishMonthName, 
  getPreviousMonthStr, 
  getNextMonthStr, 
  getKurdishDayName, 
  formatMinutesToKurdish 
} from '@/lib/attendance/report-helpers';
import { 
  getCachedMonthStats, 
  setCachedMonthStats, 
  triggerHaptic 
} from '@/lib/offline-sync-manager';

interface MonthlyReportTabProps {
  user: MobileAuthUser;
  stats: MonthStatsInfo | null;
  isDark?: boolean;
}

export function MonthlyReportTab({ user, stats: initialStats, isDark = false }: MonthlyReportTabProps) {
  // Current Baghdad Month by default
  const defaultMonth = useMemo(() => {
    return initialStats?.month || new Date().toISOString().slice(0, 7);
  }, [initialStats?.month]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [currentStats, setCurrentStats] = useState<MonthStatsInfo | null>(initialStats);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter Mode: 'all' | 'present' | 'overtime' | 'late' | 'issues'
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'overtime' | 'late' | 'issues'>('all');

  // Selected Day for Detail Bottom Sheet Modal
  const [selectedDayRecord, setSelectedDayRecord] = useState<any | null>(null);

  // Fetch / Refresh Stats for the selected month
  const fetchMonthStats = useCallback(async (monthToLoad: string, force = false) => {
    if (!user?.employeeId) return;

    // 1. Try local cache first for instant hydration
    if (!force) {
      const cached = getCachedMonthStats(user.employeeId, monthToLoad);
      if (cached) {
        setCurrentStats(cached);
      }
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(
        `/api/attendance/monthly-stats?emp=${encodeURIComponent(user.employeeId)}&month=${encodeURIComponent(monthToLoad)}`
      );
      const data = await res.json();

      if (data.success && data.stats) {
        const mappedStats: MonthStatsInfo = {
          month: monthToLoad,
          presentDays: data.stats.presentDays || 0,
          absentDays: data.stats.absentDays || 0,
          leaveDays: data.stats.leaveDays || 0,
          holidayDays: data.stats.holidayDays || 0,
          totalWorkMinutes: data.stats.totalWorkMinutes || 0,
          totalWorkHoursStr: data.stats.totalWorkHoursStr || formatMinutesToKurdish(data.stats.totalWorkMinutes || 0),
          totalOvertimeMinutes: data.stats.totalOvertimeMinutes || 0,
          totalOvertimeStr: data.stats.totalOvertimeStr || formatMinutesToKurdish(data.stats.totalOvertimeMinutes || 0),
          totalLateMinutes: data.stats.totalLateMinutes || 0,
          totalLateStr: data.stats.totalLateStr || formatMinutesToKurdish(data.stats.totalLateMinutes || 0),
          targetWorkingDays: data.stats.targetWorkingDays || 0,
          attendancePercent: data.stats.attendancePercent || 0,
          records: (data.stats.records || []).map((r: any) => ({
            date: r.date,
            dayName: r.dayName || getKurdishDayName(r.date),
            check_in_time: r.checkIn || r.check_in_time || null,
            check_out_time: r.checkOut || r.check_out_time || null,
            status: r.status || 'Present',
            duration_minutes: r.durationMinutes || 0,
            duration_str: r.durationStr || '',
            overtime_minutes: r.overtimeMinutes || 0,
            late_minutes: r.lateMinutes || 0,
            location_name: r.locationName || 'کۆمپانیای سەرەکی ئاشڵی',
            check_out_note: r.check_out_note || r.note || '',
          })),
        };

        setCurrentStats(mappedStats);
        setCachedMonthStats(user.employeeId, mappedStats, monthToLoad);
      } else {
        if (!currentStats) {
          setErrorMsg(data.error || 'نەتوانرا داتای ئەم مانگە باربکرێت.');
        }
      }
    } catch (err: any) {
      console.warn('[MonthlyReportTab] Fetch error (offline):', err);
      if (!currentStats) {
        setErrorMsg('پەیوەندی بە سێرڤەر نییە. داتای خەزنکراو پیشاندەدرێت.');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId, currentStats]);

  // Load when selectedMonth changes
  useEffect(() => {
    fetchMonthStats(selectedMonth);
  }, [selectedMonth, fetchMonthStats]);

  // Handle Month Switch with Apple Haptic
  const handlePrevMonth = () => {
    triggerHaptic('light');
    setSelectedMonth(prev => getPreviousMonthStr(prev));
  };

  const handleNextMonth = () => {
    triggerHaptic('light');
    setSelectedMonth(prev => getNextMonthStr(prev));
  };

  // Open Full Print / PDF Report in new tab
  const handleOpenPrintReport = () => {
    triggerHaptic('medium');
    const url = `/attendance/report/print?emp=${encodeURIComponent(user.employeeId)}&month=${encodeURIComponent(selectedMonth)}`;
    window.open(url, '_blank');
  };

  const records = currentStats?.records || [];

  // Counts for filters
  const counts = useMemo(() => {
    let present = 0;
    let overtime = 0;
    let late = 0;
    let issues = 0;

    for (const r of records) {
      if (r.status === 'Present') present++;
      if ((r.overtime_minutes || 0) > 0) overtime++;
      if ((r.late_minutes || 0) > 0) late++;
      if (r.status === 'Absent' || r.status === 'Incomplete') issues++;
    }

    return { total: records.length, present, overtime, late, issues };
  }, [records]);

  // Filtered records based on active tab
  const filteredRecords = useMemo(() => {
    if (activeFilter === 'all') return records;
    if (activeFilter === 'present') return records.filter(r => r.status === 'Present');
    if (activeFilter === 'overtime') return records.filter(r => (r.overtime_minutes || 0) > 0);
    if (activeFilter === 'late') return records.filter(r => (r.late_minutes || 0) > 0);
    if (activeFilter === 'issues') return records.filter(r => r.status === 'Absent' || r.status === 'Incomplete');
    return records;
  }, [records, activeFilter]);

  const kurdishMonthTitle = formatKurdishMonthName(selectedMonth);

  return (
    <div className="space-y-4 pb-28 select-none" dir="rtl">
      
      {/* 🍏 1. APPLE MONTH SELECTOR HEADER */}
      <div className={`p-4 rounded-[26px] border transition-all shadow-[0_4px_20px_rgba(0,0,0,0.03)] ios-spring ${
        isDark 
          ? 'bg-neutral-900/90 border-neutral-800 text-white' 
          : 'bg-white/95 border-slate-200/80 text-slate-900'
      }`}>
        <div className="flex items-center justify-between gap-2">
          {/* Previous Month Button (In RTL, prev is right arrow) */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className={`h-10 px-3 rounded-2xl flex items-center gap-1 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isDark 
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="مانگی پێشوو"
          >
            <ChevronRight className="w-4 h-4" />
            <span className="hidden sm:inline">مانگی پێشوو</span>
          </button>

          {/* Current Month Title Display */}
          <div className="text-center flex-1 px-1">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-black tracking-tight truncate">
                {kurdishMonthTitle}
              </h2>
            </div>
            <span className={`text-[11px] font-semibold block ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              ڕاپۆرتی دەوامی {user.employeeName}
            </span>
          </div>

          {/* Next Month Button (In RTL, next is left arrow) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleNextMonth}
              className={`h-10 px-3 rounded-2xl flex items-center gap-1 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                isDark 
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="مانگی داهاتوو"
            >
              <span className="hidden sm:inline">مانگی داهاتوو</span>
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchMonthStats(selectedMonth, true)}
              disabled={loading}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                isDark 
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="نوێکردنەوە"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* 🌟 2. PRIMARY ACTION: OPEN OFFICIAL PRINT/PDF REPORT */}
        <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleOpenPrintReport}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer active:scale-[0.98] transition-all"
          >
            <FileText className="w-4.5 h-4.5 text-slate-950" />
            <span>کردنەوە و چاپکردنی ڕاپۆرتی فەرمی ئەم مانگە (PDF)</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-950/70 mr-0.5" />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-bold leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {/* 🍏 3. APPLE KPI SUMMARY TILES (5 Key Attendance Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Metric 1: Days Present */}
        <div className={`p-4 border rounded-[22px] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.02)] ios-spring ${
          isDark 
            ? 'bg-neutral-900/90 border-neutral-800 text-white' 
            : 'bg-white/95 border-slate-200/80 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              ڕۆژانی دەوامکراو
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {currentStats?.presentDays || 0}
            </span>
            <span className="text-xs text-slate-400 font-bold">ڕۆژ</span>
          </div>
          {currentStats?.targetWorkingDays ? (
            <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
              لە کۆی {currentStats.targetWorkingDays} ڕۆژی کارکردن
            </span>
          ) : null}
        </div>

        {/* Metric 2: Total Working Hours */}
        <div className={`p-4 border rounded-[22px] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.02)] ios-spring ${
          isDark 
            ? 'bg-neutral-900/90 border-neutral-800 text-white' 
            : 'bg-white/95 border-slate-200/80 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              کۆی کاتژمێری کار
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 truncate">
              {currentStats?.totalWorkHoursStr || '٠ کاتژمێر'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
            دەوامی پاکی ئەنجامدراو
          </span>
        </div>

        {/* Metric 3: Total Overtime */}
        <div className={`p-4 border rounded-[22px] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.02)] ios-spring ${
          isDark 
            ? 'bg-neutral-900/90 border-neutral-800 text-white' 
            : 'bg-white/95 border-slate-200/80 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              کاتی زیادە (Overtime)
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 truncate">
              {currentStats?.totalOvertimeStr || '٠ خولەک'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
            +{currentStats?.totalOvertimeMinutes || 0} خولەکی زیادە
          </span>
        </div>

        {/* Metric 4: Late Minutes */}
        <div className={`p-4 border rounded-[22px] transition-all shadow-[0_2px_12px_rgba(0,0,0,0.02)] ios-spring ${
          isDark 
            ? 'bg-neutral-900/90 border-neutral-800 text-white' 
            : 'bg-white/95 border-slate-200/80 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[11px] font-bold ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              دواکەوتن (تەئخیر)
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 truncate">
              {currentStats?.totalLateStr || '٠ خولەک'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block font-semibold">
            {currentStats?.totalLateMinutes || 0} خولەکی دواکەوتن
          </span>
        </div>
      </div>

      {/* 🍏 4. APPLE SEGMENTED FILTER PILLS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveFilter('all');
          }}
          className={`h-9 px-3.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
            activeFilter === 'all'
              ? isDark ? 'bg-white text-slate-950 shadow-sm' : 'bg-slate-900 text-white shadow-sm'
              : isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          هەموو ({counts.total})
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveFilter('present');
          }}
          className={`h-9 px-3.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
            activeFilter === 'present'
              ? 'bg-emerald-600 text-white shadow-sm'
              : isDark ? 'bg-neutral-800 text-emerald-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}
        >
          ئامادەبوو ({counts.present})
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveFilter('overtime');
          }}
          className={`h-9 px-3.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
            activeFilter === 'overtime'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : isDark ? 'bg-neutral-800 text-amber-400' : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          کاتی زیادە ({counts.overtime})
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveFilter('late');
          }}
          className={`h-9 px-3.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
            activeFilter === 'late'
              ? 'bg-rose-600 text-white shadow-sm'
              : isDark ? 'bg-neutral-800 text-rose-400' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          تەئخیربوون ({counts.late})
        </button>

        {counts.issues > 0 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveFilter('issues');
            }}
            className={`h-9 px-3.5 rounded-full text-xs font-black shrink-0 transition-all cursor-pointer active:scale-95 ${
              activeFilter === 'issues'
                ? 'bg-purple-600 text-white shadow-sm'
                : isDark ? 'bg-neutral-800 text-purple-400' : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}
          >
            ناتەواو / غیاب ({counts.issues})
          </button>
        )}
      </div>

      {/* 🍏 5. DETAILED INSET GROUPED DAILY LIST */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className={`text-xs font-extrabold ${isDark ? 'text-neutral-300' : 'text-slate-700'}`}>
            تۆماری ڕۆژانەی دەوام ({filteredRecords.length} ڕۆژ)
          </h3>
          <span className="text-[11px] text-slate-400 font-semibold">
            کلیک لە هەر ڕۆژێک بکە بۆ بینینی وردەکاری
          </span>
        </div>

        {loading && records.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto mb-2" />
            <span className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              بارکردنی زانیارییەکانی دەوام...
            </span>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className={`py-12 border rounded-[26px] text-center text-xs ${
            isDark 
              ? 'bg-neutral-900/40 border-neutral-800 text-neutral-400' 
              : 'bg-white border-slate-200 text-slate-500'
          }`}>
            هیچ دەوامێک لەم بەشەدا بەردەست نییە.
          </div>
        ) : (
          filteredRecords.map((rec, idx) => {
            const hasOvertime = (rec.overtime_minutes || 0) > 0;
            const hasLate = (rec.late_minutes || 0) > 0;
            const dayParts = rec.date.split('-');
            const dayNum = dayParts[2] || '';
            const dayNameStr = rec.dayName || getKurdishDayName(rec.date);

            return (
              <div
                key={`${rec.date}-${idx}`}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDayRecord(rec);
                }}
                className={`p-3.5 border rounded-[22px] flex items-center justify-between gap-3 shadow-2xs transition-all cursor-pointer active:scale-[0.98] ios-spring ${
                  isDark 
                    ? 'bg-neutral-900/90 border-neutral-800 text-white hover:bg-neutral-800/80' 
                    : 'bg-white/95 border-slate-200/80 text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Date Badge */}
                  <div className={`w-12 h-12 rounded-[18px] border flex flex-col items-center justify-center shrink-0 ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <span className="text-[10px] text-slate-400 font-bold leading-none">
                      {dayNameStr.slice(0, 4)}
                    </span>
                    <span className={`text-base font-black font-mono leading-none mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {dayNum}
                    </span>
                  </div>

                  {/* Day Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black">
                        {dayNameStr}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400" dir="ltr">
                        {rec.date}
                      </span>

                      {/* Status Tag */}
                      {rec.status === 'Present' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          ئامادەبوو
                        </span>
                      ) : rec.status === 'Absent' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                          غیاب
                        </span>
                      ) : rec.status === 'Leave' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                          مۆڵەت
                        </span>
                      ) : rec.status === 'Holiday' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
                          پشوو
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                          ناتەواو
                        </span>
                      )}
                    </div>

                    {/* Punches */}
                    <div className={`flex items-center gap-2 text-xs font-mono font-semibold ${
                      isDark ? 'text-neutral-300' : 'text-slate-600'
                    }`}>
                      <span>هاتن: <b>{rec.check_in_time || '--:--'}</b></span>
                      <span>•</span>
                      <span>دەرچوون: <b>{rec.check_out_time || '--:--'}</b></span>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {rec.duration_str && (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          ماوە: {rec.duration_str}
                        </span>
                      )}
                      {hasOvertime && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black">
                          +{rec.overtime_minutes} خولەک کاتی زیادە
                        </span>
                      )}
                      {hasLate && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                          {rec.late_minutes} خولەک دواکەوتن
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-slate-300 dark:text-neutral-600">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 📱 6. APPLE DETAIL BOTTOM SHEET (WHEN A DAY RECORD IS TAPPED) */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-[440px] max-h-[85vh] rounded-t-[32px] sm:rounded-[32px] p-6 border transition-all ${
            isDark 
              ? 'bg-neutral-900 border-neutral-800 text-white' 
              : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
          }`} dir="rtl">
            
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700 mx-auto mb-4" />

            <div className="flex items-center justify-between pb-3 border-b dark:border-neutral-800 mb-4">
              <div>
                <h3 className="text-base font-black">
                  وردەکاری دەوامی {selectedDayRecord.dayName || getKurdishDayName(selectedDayRecord.date)}
                </h3>
                <span className="text-xs font-mono text-slate-400" dir="ltr">
                  {selectedDayRecord.date}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayRecord(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-neutral-950 border dark:border-neutral-800">
                <span className="font-bold text-slate-500">دۆخی ئامادەبوون:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {selectedDayRecord.status === 'Present' ? 'ئامادەبوو (Present)' : selectedDayRecord.status}
                </span>
              </div>

              {/* Punches */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-950 border dark:border-neutral-800 text-center">
                  <span className="font-bold text-slate-400 block mb-1">کاتی هاتن</span>
                  <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                    {selectedDayRecord.check_in_time || '--:--'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-950 border dark:border-neutral-800 text-center">
                  <span className="font-bold text-slate-400 block mb-1">کاتی دەرچوون</span>
                  <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400" dir="ltr">
                    {selectedDayRecord.check_out_time || '--:--'}
                  </span>
                </div>
              </div>

              {/* Work Duration & Overtime */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-950 border dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">ماوەی پاکی کارکردن:</span>
                  <span className="font-mono font-black">{selectedDayRecord.duration_str || '٠ خولەک'}</span>
                </div>

                {(selectedDayRecord.overtime_minutes || 0) > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t dark:border-neutral-800">
                    <span className="font-bold text-amber-600 dark:text-amber-400">کاتی زیادە (Overtime):</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                      +{selectedDayRecord.overtime_minutes} خولەک
                    </span>
                  </div>
                )}

                {(selectedDayRecord.late_minutes || 0) > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t dark:border-neutral-800">
                    <span className="font-bold text-rose-600 dark:text-rose-400">دواکەوتن (تەئخیر):</span>
                    <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                      {selectedDayRecord.late_minutes} خولەک
                    </span>
                  </div>
                )}
              </div>

              {/* Location */}
              {selectedDayRecord.location_name && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-950 border dark:border-neutral-800 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-slate-600 dark:text-neutral-300 font-semibold truncate">
                    {selectedDayRecord.location_name}
                  </span>
                </div>
              )}

              {/* Notes */}
              {selectedDayRecord.check_out_note && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">تێبینی:</span>
                  <p className="text-slate-700 dark:text-neutral-200">{selectedDayRecord.check_out_note}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedDayRecord(null)}
              className="w-full mt-4 h-12 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold text-xs cursor-pointer active:scale-98 transition-all"
            >
              داخستن
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
