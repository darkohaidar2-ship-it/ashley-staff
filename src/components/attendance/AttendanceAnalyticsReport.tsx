'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Printer, 
  Edit3, 
  Save, 
  UserCheck, 
  Search, 
  Calendar,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { getDaysInMonth, format } from 'date-fns';

interface AttendanceAnalyticsReportProps {
  attendanceLogs: AttendanceRecord[];
  employees: Employee[];
  selectedMonth: string;
}

export function AttendanceAnalyticsReport({
  attendanceLogs,
  employees,
  selectedMonth,
}: AttendanceAnalyticsReportProps) {
  // Working Hours (Default: 08:00 to 17:00)
  const [shiftStartTime, setShiftStartTime] = useState<string>('08:00');
  const [shiftEndTime, setShiftEndTime] = useState<string>('17:00');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'late' | 'overtime' | 'overtime30'>('all');

  // Overtime Admin Notes stored locally / DB
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState<string>('');
  const [savingNote, setSavingNote] = useState(false);

  // Load saved admin notes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ashley_ot_notes_${selectedMonth}`);
      if (saved) {
        setAdminNotes(JSON.parse(saved));
      }
    } catch {}
  }, [selectedMonth]);

  // Save admin note helper
  const handleSaveNote = async (key: string) => {
    setSavingNote(true);
    const updated = { ...adminNotes, [key]: tempNoteText.trim() };
    setAdminNotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_ot_notes_${selectedMonth}`, JSON.stringify(updated));
    }
    
    // Also try to persist to settings API
    try {
      await fetch('/api/attendance/admin/overtime-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          noteKey: key,
          note: tempNoteText.trim(),
        }),
      });
    } catch {}

    setEditingNoteKey(null);
    setSavingNote(false);
  };

  // Convert time "HH:MM" to total minutes from midnight
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const cleanTime = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const parts = cleanTime.split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  };

  // Format minutes into "X کاتژمێر و Y خولەک"
  const formatMinutesHuman = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return '0 خولەک';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours} کاتژمێر و ${mins} خولەک`;
    }
    if (hours > 0) {
      return `${hours} کاتژمێر`;
    }
    return `${mins} خولەک`;
  };

  // Format minutes into digital format "H:MM"
  const formatMinutesDigital = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return '0:00';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins < 10 ? '0' : ''}${mins}`;
  };

  const shiftStartMins = useMemo(() => timeToMinutes(shiftStartTime), [shiftStartTime]);
  const shiftEndMins = useMemo(() => timeToMinutes(shiftEndTime), [shiftEndTime]);

  // Active employees list
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Compute detailed analytics for each employee
  const employeeAnalytics = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const month = parseInt(monthStr || '08', 10);
    const totalDays = getDaysInMonth(new Date(year, month - 1, 1));

    return activeEmployees.map(emp => {
      let daysPresent = 0;
      let totalLateMinutes = 0;
      let totalOvertimeMinutes = 0;
      let lateDaysCount = 0;
      let overtimeDaysCount = 0;
      let overtime30DaysCount = 0;
      const dailyDetails: Array<{
        date: string;
        dayNum: number;
        checkInTime: string | null;
        checkOutTime: string | null;
        lateMinutes: number;
        overtimeMinutes: number;
        isOvertime30: boolean;
        noteKey: string;
      }> = [];

      for (let d = 1; d <= totalDays; d++) {
        const dayStr = d.toString().padStart(2, '0');
        const targetDate = `${selectedMonth}-${dayStr}`;

        // Find check-in and check-out logs for this employee on this day
        const dayLogs = attendanceLogs.filter(log => {
          const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
          if (logDate !== targetDate) return false;

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

        const checkInLog = dayLogs.find(l => l.type === 'Check In' || (l as any).checkInTime);
        const checkOutLog = dayLogs.find(l => l.type === 'Check Out' || (l as any).checkOutTime);

        const checkInTimeStr = checkInLog?.time 
          ? (checkInLog.time.includes(' ') ? checkInLog.time.split(' ')[1] : checkInLog.time)
          : (checkInLog as any)?.checkInTime || null;

        const checkOutTimeStr = checkOutLog?.time 
          ? (checkOutLog.time.includes(' ') ? checkOutLog.time.split(' ')[1] : checkOutLog.time)
          : (checkOutLog as any)?.checkOutTime || null;

        if (checkInTimeStr || checkOutTimeStr) {
          daysPresent++;
        }

        // Late calculation (Check In > Shift Start e.g. 08:00)
        let dayLateMins = 0;
        if (checkInTimeStr) {
          const checkInMins = timeToMinutes(checkInTimeStr);
          if (checkInMins > shiftStartMins) {
            dayLateMins = checkInMins - shiftStartMins;
            totalLateMinutes += dayLateMins;
            lateDaysCount++;
          }
        }

        // Overtime calculation (Check Out > Shift End e.g. 17:00)
        let dayOvertimeMins = 0;
        let isOt30 = false;
        if (checkOutTimeStr) {
          const checkOutMins = timeToMinutes(checkOutTimeStr);
          if (checkOutMins > shiftEndMins) {
            dayOvertimeMins = checkOutMins - shiftEndMins;
            totalOvertimeMinutes += dayOvertimeMins;
            overtimeDaysCount++;
            if (dayOvertimeMins >= 30) {
              isOt30 = true;
              overtime30DaysCount++;
            }
          }
        }

        if (checkInTimeStr || checkOutTimeStr) {
          dailyDetails.push({
            date: targetDate,
            dayNum: d,
            checkInTime: checkInTimeStr ? checkInTimeStr.slice(0, 5) : null,
            checkOutTime: checkOutTimeStr ? checkOutTimeStr.slice(0, 5) : null,
            lateMinutes: dayLateMins,
            overtimeMinutes: dayOvertimeMins,
            isOvertime30: isOt30,
            noteKey: `${emp.id}_${targetDate}`,
          });
        }
      }

      return {
        employee: emp,
        daysPresent,
        totalLateMinutes,
        totalOvertimeMinutes,
        lateDaysCount,
        overtimeDaysCount,
        overtime30DaysCount,
        dailyDetails,
      };
    });
  }, [activeEmployees, attendanceLogs, selectedMonth, shiftStartMins, shiftEndMins]);

  // Overall KPI aggregates
  const totalCompanyLateMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalLateMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyOvertimeMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalOvertimeMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyOvertime30Count = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.overtime30DaysCount, 0);
  }, [employeeAnalytics]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return employeeAnalytics.filter(item => {
      const empName = (item.employee.fullName3Part || item.employee.name || '').toLowerCase();
      const empRole = (item.employee.role || '').toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      if (q && !empName.includes(q) && !empRole.includes(q)) {
        return false;
      }

      if (filterType === 'late' && item.totalLateMinutes <= 0) return false;
      if (filterType === 'overtime' && item.totalOvertimeMinutes <= 0) return false;
      if (filterType === 'overtime30' && item.overtime30DaysCount <= 0) return false;

      return true;
    });
  }, [employeeAnalytics, searchQuery, filterType]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'کۆدی کارمەند,ناوی کارمەند,پۆست,ڕۆژانی ئامادەبوون,کۆی دواکەوتن (خولەک),کۆی دواکەوتن (کاتژمێر),کۆی ئیزافە (خولەک),کۆی ئیزافە (کاتژمێر),ڕۆژانی ئیزافەی سەروو ۳۰ خولەک,تێبینی ئەدمین\n';
    const rows = filteredRows.map(r => {
      const notes = r.dailyDetails
        .filter(d => d.isOvertime30 && adminNotes[d.noteKey])
        .map(d => `${d.date}: ${adminNotes[d.noteKey]}`)
        .join(' | ');

      return `"${r.employee.employeeId || r.employee.id}","${r.employee.fullName3Part || r.employee.name}","${r.employee.role || '-'}","${r.daysPresent}","${r.totalLateMinutes}","${formatMinutesDigital(r.totalLateMinutes)}","${r.totalOvertimeMinutes}","${formatMinutesDigital(r.totalOvertimeMinutes)}","${r.overtime30DaysCount}","${notes}"`;
    }).join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `ashley-attendance-analytics-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pt-6 border-t-2 border-slate-300 font-sans dir-rtl text-slate-900" dir="rtl">
      
      {/* 📊 SECTION HEADER BANNER */}
      <div className="panel-classic p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-md rounded-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-wide flex items-center gap-2">
              <span>لیستی ئامار و ڕاپۆرتی کاتەکانی کارمەندان (Statistics & HR Analytics)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-mono">
                {selectedMonth}
              </span>
            </h2>
            <p className="text-[11px] text-slate-300 font-bold mt-0.5">
              ئاماری دواکەوتنی هاتن (دوای 08:00) و کاتی ئیزافەی دەرچوون (دوای 17:00) لەگەڵ تێبینی ئەدمین بۆ ئیزافەی سەروو ٣٠ خولەک
            </p>
          </div>
        </div>

        {/* Quick Shift Working Hours Adjuster */}
        <div className="flex items-center gap-3 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <span className="text-slate-300 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> کاتی فەرمی دەوام:
          </span>
          <div className="flex items-center gap-1 font-mono font-bold" dir="ltr">
            <input
              type="time"
              value={shiftStartTime}
              onChange={(e) => setShiftStartTime(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs font-bold text-center"
            />
            <span className="text-slate-400">بۆ</span>
            <input
              type="time"
              value={shiftEndTime}
              onChange={(e) => setShiftEndTime(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white text-xs font-bold text-center"
            />
          </div>
        </div>
      </div>

      {/* 🌟 FOUR SUMMARY KPI STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Total Late Time */}
        <div className="p-3.5 rounded-xl border-2 border-rose-300 bg-rose-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-rose-800 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> کۆی کاتی دواکەوتن
            </span>
            <div className="text-lg font-black font-mono text-rose-950">
              {formatMinutesHuman(totalCompanyLateMins)}
            </div>
            <span className="text-[10px] text-rose-700 font-bold block">
              دیجیتاڵ: <span className="font-mono font-black">{formatMinutesDigital(totalCompanyLateMins)}</span> کاتژمێر
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-200/80 text-rose-800 flex items-center justify-center font-black">
            ⏰
          </div>
        </div>

        {/* Total Overtime */}
        <div className="p-3.5 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-emerald-800 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> کۆی کاتی ئیزافە
            </span>
            <div className="text-lg font-black font-mono text-emerald-950">
              {formatMinutesHuman(totalCompanyOvertimeMins)}
            </div>
            <span className="text-[10px] text-emerald-700 font-bold block">
              دیجیتاڵ: <span className="font-mono font-black">{formatMinutesDigital(totalCompanyOvertimeMins)}</span> کاتژمێر
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-200/80 text-emerald-800 flex items-center justify-center font-black">
            ⚡
          </div>
        </div>

        {/* Overtime > 30 Mins Needing Admin Review */}
        <div className="p-3.5 rounded-xl border-2 border-amber-300 bg-amber-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-amber-900 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> ئیزافەی سەروو ٣٠ خولەک
            </span>
            <div className="text-lg font-black font-mono text-amber-950">
              {totalCompanyOvertime30Count} <span className="text-xs font-bold text-amber-800">حاڵەت</span>
            </div>
            <span className="text-[10px] text-amber-800 font-bold block">
              پێویستی بە تێبینی و ڕەزامەندیی ئەدمینە
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center font-black">
            📝
          </div>
        </div>

        {/* Active Staff Monitored */}
        <div className="p-3.5 rounded-xl border-2 border-blue-300 bg-blue-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold text-blue-900 uppercase flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" /> کارمەندانی بەشداربوو
            </span>
            <div className="text-lg font-black font-mono text-blue-950">
              {filteredRows.length} <span className="text-xs font-bold text-blue-800">کارمەند</span>
            </div>
            <span className="text-[10px] text-blue-800 font-bold block">
              لەم مانگەدا تۆماریان هەبووە
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-200/80 text-blue-800 flex items-center justify-center font-black">
            👥
          </div>
        </div>

      </div>

      {/* 🔍 FILTER & ACTION TOOLBAR */}
      <div className="panel-classic p-2.5 bg-slate-100 flex flex-wrap items-center justify-between gap-2 shadow-sm rounded-lg">
        
        {/* Search & Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناوی کارمەند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-classic pr-8 text-xs w-48 sm:w-60 font-bold"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded border border-slate-300 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هەموو ({employeeAnalytics.length})
            </button>
            <button
              onClick={() => setFilterType('late')}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === 'late' ? 'bg-rose-600 text-white shadow-sm font-black' : 'text-rose-800 hover:bg-rose-100'
              }`}
            >
              دواکەوتووەکان ({employeeAnalytics.filter(e => e.totalLateMinutes > 0).length})
            </button>
            <button
              onClick={() => setFilterType('overtime')}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === 'overtime' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              ئیزافەکان ({employeeAnalytics.filter(e => e.totalOvertimeMinutes > 0).length})
            </button>
            <button
              onClick={() => setFilterType('overtime30')}
              className={`px-2.5 py-1 rounded transition-all ${
                filterType === 'overtime30' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              ئیزافەی &gt;٣٠ خولەک ({employeeAnalytics.filter(e => e.overtime30DaysCount > 0).length})
            </button>
          </div>
        </div>

        {/* Print & CSV Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>هەناردەکردنی Excel / CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300"
          >
            <Printer className="w-3.5 h-3.5 text-blue-700" />
            <span>🖨️ پرینتی ڕاپۆرت</span>
          </button>
        </div>

      </div>

      {/* 📋 DETAILED ANALYTICS TABLE */}
      <div className="border border-slate-400 bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-right text-xs border-collapse">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-slate-400 text-slate-800 font-black">
              <th className="p-2.5 border-l border-slate-300 text-center w-12">#</th>
              <th className="p-2.5 border-l border-slate-300">ناوی کارمەند و پۆست</th>
              <th className="p-2.5 border-l border-slate-300 text-center">ڕۆژانی ئامادەبوون</th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-rose-100/70 text-rose-950">
                کۆی کاتی دواکەوتن (Late)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-emerald-100/70 text-emerald-950">
                کۆی کاتی ئیزافە (Overtime)
              </th>
              <th className="p-2.5 border-l border-slate-300 bg-amber-100/70 text-amber-950">
                ئیزافەی سەروو ٣٠ خولەک و تێبینی ئەدمین
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 font-bold">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-bold text-xs bg-slate-50">
                  هیچ تۆمارێک بۆ ئەم فلتەرە نەدۆزرایەوە.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const hasLate = row.totalLateMinutes > 0;
                const hasOt = row.totalOvertimeMinutes > 0;
                const ot30Logs = row.dailyDetails.filter(d => d.isOvertime30);

                return (
                  <tr key={row.employee.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* Index */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500 text-xs">
                      {idx + 1}
                    </td>

                    {/* Employee Profile */}
                    <td className="p-2.5 border-l border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 border border-slate-400 flex items-center justify-center font-black text-slate-700 text-xs flex-shrink-0">
                          {row.employee.fullName3Part ? row.employee.fullName3Part.charAt(0) : 'E'}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 block text-xs">
                            {row.employee.fullName3Part || row.employee.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-mono">
                            {row.employee.role || 'فەرمانبەر'} | {row.employee.employeeId ? `EMP-${row.employee.employeeId}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Days Present */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 font-black">
                        {row.daysPresent} ڕۆژ
                      </span>
                    </td>

                    {/* Total Late */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-rose-50/40">
                      {hasLate ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-black text-xs inline-block">
                            {formatMinutesHuman(row.totalLateMinutes)}
                          </span>
                          <span className="text-[10px] text-rose-800 block font-bold">
                            {row.lateDaysCount} ڕۆژ دواکەوتووە ({formatMinutesDigital(row.totalLateMinutes)} ک)
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">
                          ✓ هیچ دواکەوتنێک نییە
                        </span>
                      )}
                    </td>

                    {/* Total Overtime */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-emerald-50/40">
                      {hasOt ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono font-black text-xs inline-block">
                            {formatMinutesHuman(row.totalOvertimeMinutes)}
                          </span>
                          <span className="text-[10px] text-emerald-800 block font-bold">
                            {row.overtimeDaysCount} ڕۆژ ئیزافە ({formatMinutesDigital(row.totalOvertimeMinutes)} ک)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          -
                        </span>
                      )}
                    </td>

                    {/* Overtime > 30 Mins & Admin Notes */}
                    <td className="p-2.5 border-l border-slate-200 bg-amber-50/30">
                      {ot30Logs.length === 0 ? (
                        <span className="text-[11px] text-slate-400">ئیزافەی سەروو ٣٠ خولەک تۆمار نەکراوە</span>
                      ) : (
                        <div className="space-y-2">
                          {ot30Logs.map((otLog) => {
                            const noteKey = otLog.noteKey;
                            const isEditing = editingNoteKey === noteKey;
                            const savedNote = adminNotes[noteKey] || '';

                            return (
                              <div key={noteKey} className="p-2 rounded border border-amber-300 bg-amber-100/60 text-xs space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-black text-amber-950 flex items-center gap-1 text-[11px]">
                                    📅 {otLog.date} (دەرچوون: {otLog.checkOutTime})
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-700 text-white font-mono text-[10px] font-black">
                                    +{formatMinutesHuman(otLog.overtimeMinutes)} ئیزافە
                                  </span>
                                </div>

                                {/* Admin Note Box */}
                                <div className="pt-1">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        placeholder="تێبینی / هۆکاری پەسەندکردنی ئیزافە..."
                                        value={tempNoteText}
                                        onChange={(e) => setTempNoteText(e.target.value)}
                                        className="input-classic flex-1 text-xs bg-white font-bold"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveNote(noteKey)}
                                        disabled={savingNote}
                                        className="btn-classic-primary text-xs px-2 py-1 flex items-center gap-1"
                                      >
                                        <Save className="w-3 h-3" />
                                        <span>پاشەکەوت</span>
                                      </button>
                                      <button
                                        onClick={() => setEditingNoteKey(null)}
                                        className="btn-classic text-xs px-2 py-1"
                                      >
                                        پەشیمان
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2 bg-white/80 p-1.5 rounded border border-amber-200">
                                      <div className="text-[11px] text-slate-800 font-bold">
                                        <span className="text-amber-800 font-extrabold">تێبینی ئەدمین: </span>
                                        {savedNote ? (
                                          <span className="text-slate-900">{savedNote}</span>
                                        ) : (
                                          <span className="text-rose-700 italic">⚠️ هێشتا تێبینی نەنووسراوە (پێویستە)</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setEditingNoteKey(noteKey);
                                          setTempNoteText(savedNote);
                                        }}
                                        className="text-amber-800 hover:text-amber-950 p-1 rounded hover:bg-amber-100 flex items-center gap-1 text-[10px] font-black border border-amber-300"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>{savedNote ? 'دەستکاری' : 'نووسینی تێبینی'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-slate-100 border border-slate-300 rounded text-[11px] text-slate-600 font-bold flex items-center justify-between">
        <span>
          💡 ئەگەر کاتی فەرمی دەوام بگۆڕدرێت (بۆ نموونە 09:00 یان 16:30)، ئامار و ژماردنی دواکەوتن و ئیزافەکان دەستبەجێ بەپێی کاتی نوێ نوێ دەبنەوە.
        </span>
        <span className="font-mono font-bold text-slate-800">
          ASHLEY HR Analytics Engine v2.0
        </span>
      </div>

    </div>
  );
}
