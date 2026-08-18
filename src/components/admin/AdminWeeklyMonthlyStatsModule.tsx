'use client';

import React, { useState, useMemo } from 'react';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { useAppContext } from '@/context/app-provider';
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  TrendingUp, 
  UserCheck, 
  FileSpreadsheet, 
  Printer, 
  DollarSign, 
  Sparkles,
  Award,
  AlertCircle
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO, subDays } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface AdminWeeklyMonthlyStatsModuleProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

export function AdminWeeklyMonthlyStatsModule({
  employees,
  attendanceLogs,
}: AdminWeeklyMonthlyStatsModuleProps) {
  const { overtime, expenses } = useAppContext();

  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Current Week Interval
  const currentWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 6 }), []); // Saturday in Kurdistan
  const currentWeekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 6 }), []);

  // Filter attendance logs by timeframe
  const filteredLogs = useMemo(() => {
    if (timeframe === 'weekly') {
      return (attendanceLogs || []).filter(log => {
        const logDateStr = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
        if (!logDateStr) return false;
        try {
          const d = parseISO(logDateStr);
          return isWithinInterval(d, { start: currentWeekStart, end: currentWeekEnd });
        } catch {
          return false;
        }
      });
    } else {
      return (attendanceLogs || []).filter(log => {
        const logDateStr = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
        return logDateStr.startsWith(selectedMonth);
      });
    }
  }, [attendanceLogs, timeframe, currentWeekStart, currentWeekEnd, selectedMonth]);

  // Compute statistics per employee
  const employeeStats = useMemo(() => {
    return activeEmployees.map(emp => {
      const empLogs = filteredLogs.filter(log => {
        const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
        const targetEmpId = (emp.id || '').toString().trim().toLowerCase();
        const empCode = emp.employeeId ? `emp-${emp.employeeId}`.toLowerCase() : '';

        const logName = (log.name || log.userName || (log as any).employeeName || '').toString().trim().toLowerCase();
        const empName1 = (emp.fullName3Part || '').toString().trim().toLowerCase();
        const empName2 = (emp.name || '').toString().trim().toLowerCase();

        return (
          (logEmpId && logEmpId === targetEmpId) ||
          (empCode && logEmpId === empCode) ||
          (logName && empName1 && (logName === empName1 || logName.includes(empName1) || empName1.includes(logName))) ||
          (logName && empName2 && (logName === empName2 || logName.includes(empName2) || empName2.includes(logName)))
        );
      });

      const checkInLogs = empLogs.filter(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('in') || t.includes('هاتن') || !!(l as any).checkInTime;
      });
      const checkOutLogs = empLogs.filter(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('out') || t.includes('دەرچوون') || t.includes('ڕۆشتن') || !!(l as any).checkOutTime;
      });

      let lateCount = 0;
      let totalLateMins = 0;
      let earlyLeaveCount = 0;
      let totalEarlyLeaveMins = 0;
      let overtimeCount = 0;
      let totalOvertimeMins = 0;
      let overtime30Mins = 0;
      let overtime30Count = 0;

      checkInLogs.forEach(l => {
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1]?.slice(0, 5) : l.time.slice(0, 5)) : (l as any).checkInTime?.slice(0, 5);
        if (timeStr) {
          const parts = timeStr.split(':');
          const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          if (mins > 495) { // 15-min tolerance: After 08:15
            lateCount++;
            totalLateMins += (mins - 480);
          }
        }
      });

      checkOutLogs.forEach(l => {
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1]?.slice(0, 5) : l.time.slice(0, 5)) : (l as any).checkOutTime?.slice(0, 5);
        if (timeStr) {
          const parts = timeStr.split(':');
          let mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          if (mins <= 360) mins += 1440; // 🌟 12 midnight / 00:00 is 1440 mins

          if (mins < 1005) { // Early leave before 16:45
            earlyLeaveCount++;
            totalEarlyLeaveMins += (1020 - mins);
          } else if (mins > 1035) { // Overtime after 17:15
            overtimeCount++;
            const ot = mins - 1020;
            totalOvertimeMins += ot;
            if (ot >= 30) {
              overtime30Count++;
              overtime30Mins += ot;
            }
          }
        }
      });

      const netBalanceMins = totalOvertimeMins - (totalLateMins + totalEarlyLeaveMins);
      const daysPresent = new Set(empLogs.map(l => l.date || (l.time ? l.time.split(' ')[0] : ''))).size;
      const expectedDays = timeframe === 'weekly' ? 6 : 26;
      const attendanceScore = expectedDays > 0 ? Math.min(100, Math.round((daysPresent / expectedDays) * 100)) : 100;

      return {
        employee: emp,
        daysPresent,
        lateCount,
        totalLateMins,
        earlyLeaveCount,
        totalEarlyLeaveMins,
        overtimeCount,
        totalOvertimeMins,
        netBalanceMins,
        overtime30Count,
        overtime30Mins,
        attendanceScore,
      };
    });
  }, [activeEmployees, filteredLogs, timeframe]);

  // Aggregates
  const totalLateMinutes = employeeStats.reduce((sum, e) => sum + e.totalLateMins, 0);
  const totalEarlyLeaveMinutes = employeeStats.reduce((sum, e) => sum + e.totalEarlyLeaveMins, 0);
  const totalOvertimeMinutes = employeeStats.reduce((sum, e) => sum + e.totalOvertimeMins, 0);
  const totalNetBalanceMinutes = employeeStats.reduce((sum, e) => sum + e.netBalanceMins, 0);
  const totalDaysPresentAll = employeeStats.reduce((sum, e) => sum + e.daysPresent, 0);
  const avgAttendanceRate = employeeStats.length > 0
    ? Math.round(employeeStats.reduce((sum, e) => sum + e.attendanceScore, 0) / employeeStats.length)
    : 100;

  const handleExportPDF = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name', align: 'right' },
      { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
      { header: 'ڕۆژانی دەوام', key: 'daysPresent', align: 'center' },
      { header: 'کاتی دواکەوتن (+)', key: 'lateTime', align: 'center' },
      { header: 'زوو دەرچوون (-)', key: 'earlyLeaveTime', align: 'center' },
      { header: 'هاوسەنگی کات (+/-)', key: 'netBalance', align: 'center' },
      { header: 'ئیزافەی >٣٠خ', key: 'ot30', align: 'center' },
      { header: 'کاتی ئیزافە', key: 'overtime', align: 'center' },
      { header: 'ڕێژەی پابەندبوون', key: 'score', align: 'center' },
    ];
    const data = employeeStats.map(s => ({
      name: s.employee.fullName3Part || s.employee.name,
      role: s.employee.role || 'کارمەند',
      daysPresent: `${s.daysPresent} ڕۆژ`,
      lateTime: s.totalLateMins > 0 ? `+${Math.floor(s.totalLateMins / 60)} ک و ${s.totalLateMins % 60} خ` : 'بێ دواکەوتن',
      earlyLeaveTime: s.totalEarlyLeaveMins > 0 ? `-${Math.floor(s.totalEarlyLeaveMins / 60)} ک و ${s.totalEarlyLeaveMins % 60} خ` : 'تەواو',
      netBalance: s.netBalanceMins > 0 ? `+${Math.floor(s.netBalanceMins / 60)}ک ${s.netBalanceMins % 60}خ` : s.netBalanceMins < 0 ? `-${Math.floor(Math.abs(s.netBalanceMins) / 60)}ک ${Math.abs(s.netBalanceMins) % 60}خ` : '0:00',
      ot30: s.overtime30Count > 0 ? `+${Math.floor(s.overtime30Mins / 60)}ک ${s.overtime30Mins % 60}خ (${s.overtime30Count}جار)` : '-',
      overtime: s.totalOvertimeMins > 0 ? `+${Math.floor(s.totalOvertimeMins / 60)} ک و ${s.totalOvertimeMins % 60} خ` : '-',
      score: `${s.attendanceScore}%`,
    }));
    exportToPDF({
      title: timeframe === 'weekly' 
        ? 'ڕاپۆرتی ئاماری هەفتانەی کارمەندان (Weekly HR Performance Report)' 
        : 'ڕاپۆرتی ئاماری مانگانەی کارمەندان (Monthly HR Performance Report)',
      subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
      period: timeframe === 'weekly' 
        ? `شەممە (${format(currentWeekStart, 'yyyy-MM-dd')}) تا پێنجشەممە (${format(currentWeekEnd, 'yyyy-MM-dd')})`
        : `مانگی ${selectedMonth}`,
      columns: cols,
      data,
      fileName: `Ashley_HR_Stats_${timeframe}_${selectedMonth}`,
      summaryCards: [
        { label: 'تێکڕای ڕێژەی ئامادەبوون', value: `${avgAttendanceRate}%`, color: '#047857' },
        { label: 'کۆی دواکەوتن (+)', value: `+${Math.floor(totalLateMinutes / 60)} ک و ${totalLateMinutes % 60} خ`, color: '#be123c' },
        { label: 'کۆی زوو دەرچوون (-)', value: `-${Math.floor(totalEarlyLeaveMinutes / 60)} ک و ${totalEarlyLeaveMinutes % 60} خ`, color: '#c2410c' },
        { label: 'هاوسەنگی گشتی (Net)', value: totalNetBalanceMinutes >= 0 ? `+${Math.floor(totalNetBalanceMinutes / 60)}ک` : `-${Math.floor(Math.abs(totalNetBalanceMinutes) / 60)}ک`, color: totalNetBalanceMinutes >= 0 ? '#047857' : '#be123c' },
        { label: 'کۆی کاتی ئیزافە', value: `${Math.floor(totalOvertimeMinutes / 60)} ک و ${totalOvertimeMinutes % 60} خ`, color: '#1e40af' },
      ],
    });
  };

  const handleExportCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name' },
      { header: 'پۆست', key: 'role' },
      { header: 'ڕۆژانی دەوام', key: 'daysPresent' },
      { header: 'دواکەوتن (+ خولەک)', key: 'lateMinutes' },
      { header: 'زوو دەرچوون (- خولەک)', key: 'earlyLeaveMinutes' },
      { header: 'هاوسەنگی (+/- خولەک)', key: 'netBalanceMinutes' },
      { header: 'ئیزافەی >٣٠خ (خولەک)', key: 'ot30Minutes' },
      { header: 'کۆی ئیزافە (خولەک)', key: 'overtimeMinutes' },
      { header: 'ڕێژەی پابەندبوون', key: 'score' },
    ];
    const data = employeeStats.map(s => ({
      name: s.employee.fullName3Part || s.employee.name,
      role: s.employee.role || 'کارمەند',
      daysPresent: s.daysPresent,
      lateMinutes: s.totalLateMins,
      earlyLeaveMinutes: s.totalEarlyLeaveMins,
      netBalanceMinutes: s.netBalanceMins,
      ot30Minutes: s.overtime30Mins,
      overtimeMinutes: s.totalOvertimeMins,
      score: `${s.attendanceScore}%`,
    }));
    exportToCSV(cols, data, `Ashley_HR_Stats_${timeframe}_${selectedMonth}`);
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white rounded-xl shadow-md border border-purple-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-800/80 rounded-lg border border-purple-600 shadow-inner">
            <BarChart3 className="w-5 h-5 text-purple-200" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-purple-50">
              ئاماری هەفتانە و مانگانەی کارمەندان (HR Performance & Attendance Analytics)
            </h2>
            <p className="text-[11px] text-purple-200/90 font-medium">
              هەڵسەنگاندنی ڕێژەی ئامادەبوون، ڕۆژانی دەوام، کاتی دواکەوتن و ئیزافەی تەواوی کارمەندان
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/50 px-2.5 py-1 rounded-full font-bold">
            💡 ئاماری هاوسەنگی کات (+/-) و زوو دەرچوون
          </span>
        </div>
      </div>

      {/* 🛠️ TOP CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 border-2 border-slate-300 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeframe('weekly')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              timeframe === 'weekly' 
                ? 'bg-purple-900 text-white shadow-md border border-purple-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📅 ئاماری ئەم هەفتەیە (Weekly Report)</span>
          </button>
          <button
            onClick={() => setTimeframe('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              timeframe === 'monthly' 
                ? 'bg-purple-900 text-white shadow-md border border-purple-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>📊 ئاماری تەواوی مانگ (Monthly Report)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          {timeframe === 'weekly' ? (
            <span className="text-[11px] bg-purple-100 text-purple-950 border border-purple-300 px-2.5 py-1 rounded-lg font-bold">
              شەممە ({format(currentWeekStart, 'MM/dd')}) تا پێنجشەممە ({format(currentWeekEnd, 'MM/dd')})
            </span>
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-classic font-bold bg-white"
            />
          )}

          <button
            onClick={handleExportPDF}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-900 border-red-300 shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-red-700" />
            <span>📄 PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>📊 CSV</span>
          </button>
        </div>
      </div>

      {/* 📊 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="panel-classic p-2.5 text-center bg-blue-50/80 border-2 border-blue-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-blue-900 block font-bold">تێکڕای ڕێژەی ئامادەبوون</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{avgAttendanceRate}%</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-rose-50/80 border-2 border-rose-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-rose-900 block font-bold">کۆی دواکەوتن (+)</span>
          <p className="text-base font-black text-rose-950 font-mono mt-0.5">
            +{Math.floor(totalLateMinutes / 60)} ک و {totalLateMinutes % 60} خ
          </p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-orange-50/80 border-2 border-orange-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-orange-900 block font-bold">کۆی زوو دەرچوون (-)</span>
          <p className="text-base font-black text-orange-950 font-mono mt-0.5">
            -{Math.floor(totalEarlyLeaveMinutes / 60)} ک و {totalEarlyLeaveMinutes % 60} خ
          </p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-indigo-50/80 border-2 border-indigo-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-indigo-900 block font-bold">هاوسەنگی کات (+/-)</span>
          <p className={`text-base font-black font-mono mt-0.5 ${totalNetBalanceMinutes >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
            {totalNetBalanceMinutes >= 0 
              ? `+${Math.floor(totalNetBalanceMinutes / 60)}ک ${totalNetBalanceMinutes % 60}خ` 
              : `-${Math.floor(Math.abs(totalNetBalanceMinutes) / 60)}ک ${Math.abs(totalNetBalanceMinutes) % 60}خ`}
          </p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-emerald-50/80 border-2 border-emerald-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی ئیزافە</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
            +{Math.floor(totalOvertimeMinutes / 60)} ک و {totalOvertimeMinutes % 60} خ
          </p>
        </div>
      </div>

      {/* 📊 ANALYTICS DATA TABLE CONTAINER */}
      <div className="border-2 border-slate-300 bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-slate-800 text-white p-2 px-3 flex items-center justify-between">
          <h3 className="text-xs font-black flex items-center gap-2">
            <span>📋 خشتەی هەڵسەنگاندن و ئاماری پابەندبوونی کارمەندان ({timeframe === 'weekly' ? 'هەفتانە' : `مانگانە - ${selectedMonth}`})</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-300">
            {employeeStats.length} کارمەند
          </span>
        </div>
        <table className="w-full text-right text-xs border-collapse">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-400 text-slate-900 font-black">
              <th className="p-2 border-l border-slate-300 w-10 text-center">#</th>
              <th className="p-2 border-l border-slate-300">ناوی کارمەند و پۆست</th>
              <th className="p-2 border-l border-slate-300 text-center">ڕۆژانی دەوام</th>
              <th className="p-2 border-l border-slate-300 text-center bg-rose-100/70">دواکەوتن (+)</th>
              <th className="p-2 border-l border-slate-300 text-center bg-orange-100/70">زوو دەرچوون (-)</th>
              <th className="p-2 border-l border-slate-300 text-center bg-indigo-100/70">هاوسەنگی (+/-)</th>
              <th className="p-2 border-l border-slate-300 text-center bg-amber-100/70">ئیزافەی &gt;٣٠خ</th>
              <th className="p-2 border-l border-slate-300 text-center bg-emerald-100/70">کۆی ئیزافە</th>
              <th className="p-2 text-center">ڕێژەی پایبەندی</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 font-bold">
            {employeeStats.map((st, idx) => (
              <tr key={st.employee.id} className="hover:bg-slate-50">
                <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                <td className="p-2 border-l border-slate-200">
                  <span className="text-slate-900 block font-black">{st.employee.fullName3Part || st.employee.name}</span>
                  <span className="text-[10px] text-slate-500 block font-normal">{st.employee.role || 'کارمەند'}</span>
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-950 font-black">
                    {st.daysPresent} ڕۆژ
                  </span>
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  {st.totalLateMins > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[11px]">
                      +{Math.floor(st.totalLateMins / 60)}ک {st.totalLateMins % 60}خ
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-xs">✓ بە کات</span>
                  )}
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  {st.totalEarlyLeaveMins > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-orange-600 text-white font-black text-[11px]">
                      -{Math.floor(st.totalEarlyLeaveMins / 60)}ک {st.totalEarlyLeaveMins % 60}خ
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-xs">✓ تەواو</span>
                  )}
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  {st.netBalanceMins > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 font-black text-[11px]">
                      +{Math.floor(st.netBalanceMins / 60)}ک {st.netBalanceMins % 60}خ
                    </span>
                  ) : st.netBalanceMins < 0 ? (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-950 border border-rose-400 font-black text-[11px]">
                      -{Math.floor(Math.abs(st.netBalanceMins) / 60)}ک {Math.abs(st.netBalanceMins) % 60}خ
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">0:00</span>
                  )}
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  {st.overtime30Count > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-amber-700 text-white font-black text-[11px]">
                      +{Math.floor(st.overtime30Mins / 60)}ک ({st.overtime30Count}جار)
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </td>
                <td className="p-2 border-l border-slate-200 text-center font-mono">
                  {st.totalOvertimeMins > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[11px]">
                      +{Math.floor(st.totalOvertimeMins / 60)} ک و {st.totalOvertimeMins % 60} خولەک
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="p-2 text-center font-mono font-black">
                  <span className={`px-2 py-0.5 rounded ${
                    st.attendanceScore >= 90
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : st.attendanceScore >= 75
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {st.attendanceScore}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
