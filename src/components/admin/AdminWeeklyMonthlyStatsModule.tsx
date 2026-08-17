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
        return (
          log.employeeId === emp.id ||
          log.userId === emp.id ||
          (emp.employeeId && log.employeeId === `EMP-${emp.employeeId}`) ||
          log.name === emp.fullName3Part ||
          log.name === emp.name ||
          log.userName === emp.name ||
          log.userName === emp.fullName3Part
        );
      });

      const checkInLogs = empLogs.filter(l => l.type === 'Check In' || (l as any).checkInTime);
      const checkOutLogs = empLogs.filter(l => l.type === 'Check Out' || (l as any).checkOutTime);

      let lateCount = 0;
      let totalLateMins = 0;
      let overtimeCount = 0;
      let totalOvertimeMins = 0;

      checkInLogs.forEach(l => {
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1] : l.time) : (l as any).checkInTime;
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
        const timeStr = l.time ? (l.time.includes(' ') ? l.time.split(' ')[1] : l.time) : (l as any).checkOutTime;
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

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300 rounded">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeframe('weekly')}
            className={`btn-classic ${timeframe === 'weekly' ? 'bg-blue-900 text-white font-black' : ''}`}
          >
            📅 ئاماری ئەم هەفتەیە (Weekly Report)
          </button>
          <button
            onClick={() => setTimeframe('monthly')}
            className={`btn-classic ${timeframe === 'monthly' ? 'bg-blue-900 text-white font-black' : ''}`}
          >
            📊 ئاماری تەواوی مانگ (Monthly Report)
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono">
          {timeframe === 'weekly' ? (
            <span className="text-[11px] bg-blue-100 text-blue-900 border border-blue-300 px-2 py-1 rounded font-bold">
              شەممە ({format(currentWeekStart, 'MM/dd')}) تا پێنجشەممە ({format(currentWeekEnd, 'MM/dd')})
            </span>
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-classic font-bold"
            />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2 text-center bg-blue-50 border-blue-200">
          <span className="text-[10px] text-blue-900 block font-bold">تێکڕای ڕێژەی ئامادەبوون</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{avgAttendanceRate}%</p>
        </div>
        <div className="panel-classic p-2 text-center bg-rose-50 border-rose-200">
          <span className="text-[10px] text-rose-900 block font-bold">کۆی کاتی دواکەوتن</span>
          <p className="text-base font-black text-rose-950 font-mono mt-0.5">
            {Math.floor(totalLateMinutes / 60)} ک و {totalLateMinutes % 60} خولەک
          </p>
        </div>
        <div className="panel-classic p-2 text-center bg-emerald-50 border-emerald-200">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی کاتی ئیزافە</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
            {Math.floor(totalOvertimeMinutes / 60)} ک و {totalOvertimeMinutes % 60} خولەک
          </p>
        </div>
        <div className="panel-classic p-2 text-center bg-purple-50 border-purple-200">
          <span className="text-[10px] text-purple-900 block font-bold">کۆی ڕۆژانی دەوامکراو</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">{totalDaysPresentAll} ڕۆژ</p>
        </div>
      </div>

      {/* Detailed Analytics Table */}
      <div className="border border-slate-400 bg-white rounded overflow-x-auto shadow-sm">
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
