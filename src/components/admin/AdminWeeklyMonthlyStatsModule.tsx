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
      let overtimeCount = 0;
      let totalOvertimeMins = 0;

      checkInLogs.forEach(l => {
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1]?.slice(0, 5) : l.time.slice(0, 5)) : (l as any).checkInTime?.slice(0, 5);
        if (timeStr) {
          const parts = timeStr.split(':');
          const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          if (mins > 8 * 60) { // After 08:00
            lateCount++;
            totalLateMins += (mins - 480);
          }
        }
      });

      checkOutLogs.forEach(l => {
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1]?.slice(0, 5) : l.time.slice(0, 5)) : (l as any).checkOutTime?.slice(0, 5);
        if (timeStr) {
          const parts = timeStr.split(':');
          const mins = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
          if (mins > 17 * 60) { // After 17:00
            overtimeCount++;
            totalOvertimeMins += (mins - 1020);
          }
        }
      });

      const daysPresent = new Set(empLogs.map(l => l.date || (l.time ? l.time.split(' ')[0] : ''))).size;
      const expectedDays = timeframe === 'weekly' ? 6 : 26;
      const attendanceScore = expectedDays > 0 ? Math.min(100, Math.round((daysPresent / expectedDays) * 100)) : 100;

      return {
        employee: emp,
        daysPresent,
        lateCount,
        totalLateMins,
        overtimeCount,
        totalOvertimeMins,
        attendanceScore,
      };
    });
  }, [activeEmployees, filteredLogs, timeframe]);

  // Aggregates
  const totalLateMinutes = employeeStats.reduce((sum, e) => sum + e.totalLateMins, 0);
  const totalOvertimeMinutes = employeeStats.reduce((sum, e) => sum + e.totalOvertimeMins, 0);
  const totalDaysPresentAll = employeeStats.reduce((sum, e) => sum + e.daysPresent, 0);
  const avgAttendanceRate = employeeStats.length > 0
    ? Math.round(employeeStats.reduce((sum, e) => sum + e.attendanceScore, 0) / employeeStats.length)
    : 100;

  const handleExportPDF = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name', align: 'right' },
      { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
      { header: 'ڕۆژانی دەوام', key: 'daysPresent', align: 'center' },
      { header: 'کاتی دواکەوتن', key: 'lateTime', align: 'center' },
      { header: 'کاتی ئیزافە', key: 'overtime', align: 'center' },
      { header: 'ڕێژەی پابەندبوون', key: 'score', align: 'center' },
    ];
    const data = employeeStats.map(s => ({
      name: s.employee.fullName3Part || s.employee.name,
      role: s.employee.role || 'کارمەند',
      daysPresent: `${s.daysPresent} ڕۆژ`,
      lateTime: s.totalLateMins > 0 ? `${Math.floor(s.totalLateMins / 60)} ک و ${s.totalLateMins % 60} خ` : 'بێ دواکەوتن',
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
        { label: 'کۆی کاتی دواکەوتن', value: `${Math.floor(totalLateMinutes / 60)} ک و ${totalLateMinutes % 60} خ`, color: '#be123c' },
        { label: 'کۆی کاتی ئیزافە', value: `${Math.floor(totalOvertimeMinutes / 60)} ک و ${totalOvertimeMinutes % 60} خ`, color: '#1e40af' },
        { label: 'کۆی ڕۆژانی دەوامکراو', value: `${totalDaysPresentAll} ڕۆژ`, color: '#6b21a8' },
      ],
    });
  };

  const handleExportCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name' },
      { header: 'پۆست', key: 'role' },
      { header: 'ڕۆژانی دەوام', key: 'daysPresent' },
      { header: 'کاتی دواکەوتن (خولەک)', key: 'lateMinutes' },
      { header: 'کاتی ئیزافە (خولەک)', key: 'overtimeMinutes' },
      { header: 'ڕێژەی پابەندبوون', key: 'score' },
    ];
    const data = employeeStats.map(s => ({
      name: s.employee.fullName3Part || s.employee.name,
      role: s.employee.role || 'کارمەند',
      daysPresent: s.daysPresent,
      lateMinutes: s.totalLateMins,
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
        <span className="text-xs font-mono font-black bg-purple-500/30 text-purple-100 border border-purple-400 px-3 py-1 rounded-full">
          HR ANALYTICS
        </span>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2.5 text-center bg-blue-50/80 border-2 border-blue-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-blue-900 block font-bold">تێکڕای ڕێژەی ئامادەبوون</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{avgAttendanceRate}%</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-rose-50/80 border-2 border-rose-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-rose-900 block font-bold">کۆی کاتی دواکەوتن</span>
          <p className="text-base font-black text-rose-950 font-mono mt-0.5">
            {Math.floor(totalLateMinutes / 60)} ک و {totalLateMinutes % 60} خولەک
          </p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-emerald-50/80 border-2 border-emerald-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی کاتی ئیزافە</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
            {Math.floor(totalOvertimeMinutes / 60)} ک و {totalOvertimeMinutes % 60} خولەک
          </p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-purple-50/80 border-2 border-purple-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-purple-900 block font-bold">کۆی ڕۆژانی دەوامکراو</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">{totalDaysPresentAll} ڕۆژ</p>
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
              <th className="p-2 border-l border-slate-300 text-center">ڕۆژانی ئامادەبوون</th>
              <th className="p-2 border-l border-slate-300 text-center">کاتی دواکەوتن</th>
              <th className="p-2 border-l border-slate-300 text-center">کاتی ئیزافە</th>
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
                      {Math.floor(st.totalLateMins / 60)} ک و {st.totalLateMins % 60} خولەک
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-xs">✓ بە کات</span>
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
