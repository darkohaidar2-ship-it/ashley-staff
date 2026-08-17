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
  ShieldCheck,
  UserX,
  DollarSign,
  Coffee,
  Eye,
  Info,
  CalendarDays
} from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import { exportToPDF, exportToCSV, formatTime12H, type ExportTableColumn } from '@/lib/export-utils';

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
  // Working Hours & Rates (Admin Configurable)
  const [shiftStartTime, setShiftStartTime] = useState<string>('08:00');
  const [shiftEndTime, setShiftEndTime] = useState<string>('17:00');
  const [hourlyRate, setHourlyRate] = useState<number>(5000); // 5,000 IQD per overtime hour
  const [lateDeductionRate, setLateDeductionRate] = useState<number>(5000); // 5,000 IQD per late hour
  const [applyLateDeduction, setApplyLateDeduction] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'late' | 'overtime' | 'absent' | 'overtime30'>('all');

  // Employee Off-Days / Excused Leaves State per month (e.g. { "empId_2026-08-15": true })
  const [employeeLeaves, setEmployeeLeaves] = useState<Record<string, { type: 'off' | 'excused' | 'sick'; note?: string }>>(() => {
    try {
      const saved = localStorage.getItem(`ashley_leaves_${selectedMonth}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Selected Employee for Daily First-In / Last-Out Logs Drawer Modal
  const [activeEmpDrawer, setActiveEmpDrawer] = useState<any | null>(null);

  // Overtime Admin Notes stored locally / DB
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState<string>('');
  const [savingNote, setSavingNote] = useState(false);

  // Off Day / Leave Editor Modal
  const [leaveModalEmp, setLeaveModalEmp] = useState<Employee | null>(null);
  const [leaveDate, setLeaveDate] = useState<string>(() => `${selectedMonth}-01`);
  const [leaveType, setLeaveType] = useState<'off' | 'excused' | 'sick'>('off');
  const [leaveNote, setLeaveNote] = useState<string>('');

  // Load saved admin notes & leaves
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem(`ashley_ot_notes_${selectedMonth}`);
      if (savedNotes) setAdminNotes(JSON.parse(savedNotes));
      const savedLeaves = localStorage.getItem(`ashley_leaves_${selectedMonth}`);
      if (savedLeaves) setEmployeeLeaves(JSON.parse(savedLeaves));
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

  // Save Leave / Off Day for employee
  const handleSaveLeave = () => {
    if (!leaveModalEmp) return;
    const key = `${leaveModalEmp.id}_${leaveDate}`;
    const updated = {
      ...employeeLeaves,
      [key]: { type: leaveType, note: leaveNote.trim() },
    };
    setEmployeeLeaves(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_leaves_${selectedMonth}`, JSON.stringify(updated));
    }
    alert(`🎉 ڕۆژی پشوو/مۆڵەت بۆ (${leaveModalEmp.fullName3Part || leaveModalEmp.name}) تۆمارکرا!`);
    setLeaveModalEmp(null);
    setLeaveNote('');
  };

  const handleRemoveLeave = (key: string) => {
    const updated = { ...employeeLeaves };
    delete updated[key];
    setEmployeeLeaves(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_leaves_${selectedMonth}`, JSON.stringify(updated));
    }
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
      return `${hours} ک و ${mins} خ`;
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

  // Days in month calculation
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '08', 10);
  const totalDaysInMonth = getDaysInMonth(new Date(year, month - 1, 1));

  // Compute detailed analytics for each employee
  const employeeAnalytics = useMemo(() => {
    return activeEmployees.map(emp => {
      let daysPresent = 0;
      let totalLateMinutes = 0;
      let totalEarlyLeaveMinutes = 0;
      let totalOvertimeMinutes = 0;
      let totalWorkedMinutes = 0;
      let lateDaysCount = 0;
      let earlyLeaveDaysCount = 0;
      let overtimeDaysCount = 0;
      let overtime30DaysCount = 0;
      let officialOffDaysCount = 0;
      let absentDaysCount = 0;

      const dailyDetails: Array<{
        date: string;
        dayNum: number;
        dayOfWeek: string;
        isFriday: boolean;
        isOffDay: boolean;
        leaveInfo?: { type: string; note?: string };
        checkInTime: string | null;
        checkOutTime: string | null;
        workedMinutes: number;
        lateMinutes: number;
        earlyLeaveMinutes: number;
        overtimeMinutes: number;
        netDailyMinutes: number;
        isOvertime30: boolean;
        noteKey: string;
      }> = [];

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dayStr = d.toString().padStart(2, '0');
        const targetDate = `${selectedMonth}-${dayStr}`;
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeekIndex = getDay(dateObj); // 5 is Friday
        const isFriday = dayOfWeekIndex === 5;
        const leaveKey = `${emp.id}_${targetDate}`;
        const customLeave = employeeLeaves[leaveKey];
        const isOff = isFriday || !!customLeave;

        if (isOff) {
          officialOffDaysCount++;
        }

        // Find check-in and check-out logs for this employee on this day
        const dayLogs = attendanceLogs.filter(log => {
          const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
          if (logDate !== targetDate) return false;

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

        const checkInLog = dayLogs.find(l => {
          const t = (l.type || '').toLowerCase();
          return t.includes('in') || t.includes('هاتن') || !!(l as any).checkInTime;
        });
        const checkOutLog = dayLogs.find(l => {
          const t = (l.type || '').toLowerCase();
          return t.includes('out') || t.includes('دەرچوون') || t.includes('ڕۆشتن') || !!(l as any).checkOutTime;
        });

        const checkInTimeStr = checkInLog?.time 
          ? (checkInLog.time.includes(' ') ? checkInLog.time.split(' ')[1]?.slice(0, 5) : checkInLog.time.slice(0, 5))
          : (checkInLog as any)?.checkInTime?.slice(0, 5) || null;

        const checkOutTimeStr = checkOutLog?.time 
          ? (checkOutLog.time.includes(' ') ? checkOutLog.time.split(' ')[1]?.slice(0, 5) : checkOutLog.time.slice(0, 5))
          : (checkOutLog as any)?.checkOutTime?.slice(0, 5) || null;

        const isPresent = !!(checkInTimeStr || checkOutTimeStr);
        const isFutureDay = targetDate > '2026-08-15' && selectedMonth === '2026-08';

        if (isPresent) {
          daysPresent++;
        } else if (!isOff && !isFutureDay) {
          absentDaysCount++;
        }

        // Work Hours calculation
        let dayWorkedMins = 0;
        if (checkInTimeStr && checkOutTimeStr) {
          const inM = timeToMinutes(checkInTimeStr);
          const outM = timeToMinutes(checkOutTimeStr);
          if (outM > inM) {
            dayWorkedMins = outM - inM;
            totalWorkedMinutes += dayWorkedMins;
          }
        } else if (checkInTimeStr && !checkOutTimeStr) {
          // If only checked in, count default shift duration (e.g. 8 hours)
          dayWorkedMins = Math.max(0, shiftEndMins - shiftStartMins);
          totalWorkedMinutes += dayWorkedMins;
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

        // Early Leave calculation (Check Out < Shift End e.g. 17:00)
        let dayEarlyLeaveMins = 0;
        if (checkOutTimeStr) {
          const checkOutMins = timeToMinutes(checkOutTimeStr);
          if (checkOutMins < shiftEndMins) {
            dayEarlyLeaveMins = shiftEndMins - checkOutMins;
            totalEarlyLeaveMinutes += dayEarlyLeaveMins;
            earlyLeaveDaysCount++;
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

        const dayNetMins = dayOvertimeMins - (dayLateMins + dayEarlyLeaveMins);

        dailyDetails.push({
          date: targetDate,
          dayNum: d,
          dayOfWeek: format(dateObj, 'EEE'),
          isFriday,
          isOffDay: isOff,
          leaveInfo: customLeave,
          checkInTime: checkInTimeStr ? checkInTimeStr.slice(0, 5) : null,
          checkOutTime: checkOutTimeStr ? checkOutTimeStr.slice(0, 5) : null,
          workedMinutes: dayWorkedMins,
          lateMinutes: dayLateMins,
          earlyLeaveMinutes: dayEarlyLeaveMins,
          overtimeMinutes: dayOvertimeMins,
          netDailyMinutes: dayNetMins,
          isOvertime30: isOt30,
          noteKey: `${emp.id}_${targetDate}`,
        });
      }

      // Net Time Balance (+ / -): Overtime - (Late + EarlyLeave)
      const netTimeBalanceMinutes = totalOvertimeMinutes - (totalLateMinutes + totalEarlyLeaveMinutes);

      // Approved Overtime > 30 Mins (Only sessions >= 30 mins)
      const approvedOvertime30Minutes = dailyDetails
        .filter(d => d.isOvertime30)
        .reduce((acc, curr) => acc + curr.overtimeMinutes, 0);
      const approvedOvertime30PayIQD = Math.round((approvedOvertime30Minutes / 60) * hourlyRate);

      // Overtime Financial Pay & Late Deduction
      const overtimePayIQD = Math.round((totalOvertimeMinutes / 60) * hourlyRate);
      const lateDeductionIQD = Math.round((totalLateMinutes / 60) * lateDeductionRate);

      // Total expected working days in month (excluding fridays & leaves)
      const expectedWorkingDays = Math.max(1, totalDaysInMonth - officialOffDaysCount);
      const attendanceScore = Math.min(100, Math.round((daysPresent / expectedWorkingDays) * 100));

      return {
        employee: emp,
        daysPresent,
        absentDaysCount,
        officialOffDaysCount,
        expectedWorkingDays,
        totalWorkedMinutes,
        totalLateMinutes,
        totalEarlyLeaveMinutes,
        totalOvertimeMinutes,
        netTimeBalanceMinutes,
        approvedOvertime30Minutes,
        approvedOvertime30PayIQD,
        overtimePayIQD,
        lateDeductionIQD,
        lateDaysCount,
        earlyLeaveDaysCount,
        overtimeDaysCount,
        overtime30DaysCount,
        attendanceScore,
        dailyDetails,
      };
    });
  }, [activeEmployees, attendanceLogs, selectedMonth, shiftStartMins, shiftEndMins, hourlyRate, lateDeductionRate, totalDaysInMonth, year, month, employeeLeaves]);

  // Overall KPI aggregates
  const totalCompanyWorkedHours = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalWorkedMinutes, 0) / 60;
  }, [employeeAnalytics]);

  const totalCompanyLateMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalLateMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyEarlyLeaveMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalEarlyLeaveMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyOvertimeMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.totalOvertimeMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyNetBalanceMins = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.netTimeBalanceMinutes, 0);
  }, [employeeAnalytics]);

  const totalCompanyOvertimePay = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.overtimePayIQD, 0);
  }, [employeeAnalytics]);

  const totalCompanyAbsentDays = useMemo(() => {
    return employeeAnalytics.reduce((acc, curr) => acc + curr.absentDaysCount, 0);
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
      if (filterType === 'absent' && item.absentDaysCount <= 0) return false;
      if (filterType === 'overtime30' && item.overtime30DaysCount <= 0) return false;

      return true;
    });
  }, [employeeAnalytics, searchQuery, filterType]);

  // Columns definition for PDF & CSV (Comprehensive with 3 new columns)
  const reportColumns: ExportTableColumn[] = [
    { header: 'کۆدی کارمەند', key: 'empCode', width: '70px', align: 'center' },
    { header: 'ناوی کارمەند', key: 'name', align: 'right' },
    { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
    { header: 'ڕۆژانی دەوام', key: 'daysPresent', align: 'center' },
    { header: 'غیاب', key: 'absentDays', align: 'center' },
    { header: 'کاتی کارکردن', key: 'workedHours', align: 'center' },
    { header: 'کۆی دواکەوتن (+)', key: 'lateTime', align: 'center' },
    { header: 'زوو ڕۆشتنەوە (-)', key: 'earlyLeaveTime', align: 'center' },
    { header: 'هاوسەنگی کات (+/-)', key: 'netBalance', align: 'center' },
    { header: 'ئیزافەی >٣٠خ (Approved)', key: 'approvedOt30', align: 'center' },
    { header: 'کۆی ئیزافە', key: 'overtime', align: 'center' },
    { header: 'پارەی ئیزافە (IQD)', key: 'overtimePay', align: 'center' },
    { header: 'ڕێژەی پابەندبوون', key: 'score', align: 'center' },
    { header: 'تێبینیەکانی ئیزافە', key: 'notes', align: 'right' },
  ];

  const getExportData = () => {
    return filteredRows.map(r => {
      const notes = r.dailyDetails
        .filter(d => d.isOvertime30 && adminNotes[d.noteKey])
        .map(d => `${d.date}: ${adminNotes[d.noteKey]}`)
        .join(' | ');

      const netFormatted = r.netTimeBalanceMinutes > 0
        ? `+${formatMinutesHuman(r.netTimeBalanceMinutes)}`
        : r.netTimeBalanceMinutes < 0
        ? `-${formatMinutesHuman(Math.abs(r.netTimeBalanceMinutes))}`
        : '0:00 (هاوسەنگ)';

      return {
        empCode: r.employee.employeeId || r.employee.id,
        name: r.employee.fullName3Part || r.employee.name,
        role: r.employee.role || '-',
        daysPresent: `${r.daysPresent} ڕۆژ`,
        absentDays: `${r.absentDaysCount} ڕۆژ`,
        workedHours: `${(r.totalWorkedMinutes / 60).toFixed(1)} کاتژمێر`,
        lateTime: r.totalLateMinutes > 0 ? `+${formatMinutesHuman(r.totalLateMinutes)}` : 'بێ دواکەوتن',
        earlyLeaveTime: r.totalEarlyLeaveMinutes > 0 ? `-${formatMinutesHuman(r.totalEarlyLeaveMinutes)}` : 'تەواو',
        netBalance: netFormatted,
        approvedOt30: r.overtime30DaysCount > 0 ? `+${formatMinutesHuman(r.approvedOvertime30Minutes)} (${r.overtime30DaysCount} ڕۆژ)` : '-',
        overtime: r.totalOvertimeMinutes > 0 ? formatMinutesHuman(r.totalOvertimeMinutes) : '-',
        overtimePay: r.overtimePayIQD > 0 ? `${r.overtimePayIQD.toLocaleString()} IQD` : '0 IQD',
        score: `${r.attendanceScore}%`,
        notes: notes || '-',
      };
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const data = getExportData();
    exportToCSV(reportColumns, data, `Ashley_HR_Analytics_${selectedMonth}`);
  };

  // Export PDF (Full Width Multi-Page)
  const handleExportPDF = () => {
    const data = getExportData();
    exportToPDF({
      title: 'ڕاپۆرت و ئاماری گشتگیری ئامادەبوون و کاتەکان (HR Attendance & Overtime Report)',
      subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی - لقی سەرەکی و لقەکان',
      period: `مانگی ${selectedMonth}`,
      columns: reportColumns,
      data,
      orientation: 'landscape',
      fileName: `Ashley_HR_Analytics_${selectedMonth}`,
      summaryCards: [
        { label: 'کۆی کاتژمێری ئیشکراو', value: `${totalCompanyWorkedHours.toFixed(1)} کاتژمێر`, color: '#1e40af' },
        { label: 'کۆی دواکەوتن (+)', value: `+${formatMinutesHuman(totalCompanyLateMins)}`, color: '#be123c' },
        { label: 'کۆی زوو دەرچوون (-)', value: `-${formatMinutesHuman(totalCompanyEarlyLeaveMins)}`, color: '#c2410c' },
        { label: 'هاوسەنگی گشتی کات (Net)', value: totalCompanyNetBalanceMins >= 0 ? `+${formatMinutesHuman(totalCompanyNetBalanceMins)}` : `-${formatMinutesHuman(Math.abs(totalCompanyNetBalanceMins))}`, color: totalCompanyNetBalanceMins >= 0 ? '#047857' : '#be123c' },
        { label: 'کۆی پارەی ئیزافە', value: `${totalCompanyOvertimePay.toLocaleString()} IQD`, color: '#065f46' },
      ],
    });
  };

  const handlePrint = () => {
    handleExportPDF();
  };

  return (
    <div className="space-y-4 pt-8 border-t-4 border-slate-300 font-sans dir-rtl text-slate-900" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950 text-white rounded-xl shadow-lg border border-blue-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-800/80 rounded-xl border border-blue-600 shadow-inner">
            <BarChart3 className="w-6 h-6 text-blue-200" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-2">
              <span>لیستی ئامار و ڕاپۆرتی کاتەکان (HR Analytics & Overtime Master)</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400 text-blue-200 font-mono font-black">
                مانگی {selectedMonth}
              </span>
            </h2>
            <p className="text-[11px] text-blue-200/90 font-medium mt-0.5">
              ئاماری تەواوی کاتژمێری ئیشکراو، دواکەوتن، ئیزافە، غیابات، شایستەی پارەی ئیزافە بە IQD و تێبینی ئەدمین
            </p>
          </div>
        </div>

        {/* ⚙️ DYNAMIC SHIFT & OVERTIME PAY SETTINGS */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/90 p-2 px-3 rounded-xl border border-slate-700 shadow-inner">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-slate-300 font-bold">دیاریکردنی کاتی دەوام:</span>
            <div className="flex items-center gap-1.5 font-mono font-bold" dir="ltr">
              <input
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs font-bold text-center"
              />
              <span className="text-slate-400">تا</span>
              <input
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs font-bold text-center"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-bold">نرخی ئیزافە/ک:</span>
            <input
              type="number"
              step="500"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseInt(e.target.value, 10) || 5000)}
              className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs font-mono font-bold w-24 text-center"
            />
            <span className="text-[11px] text-slate-400">IQD</span>
          </div>
        </div>
      </div>

      {/* 🌟 6 SUMMARY KPI STAT CARDS (ALL NEW METRICS) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* Total Worked Hours */}
        <div className="p-3 rounded-xl border-2 border-blue-300 bg-blue-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-blue-900 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-700" /> کۆی کارکردن
            </span>
            <div className="text-base font-black font-mono text-blue-950">
              {totalCompanyWorkedHours.toFixed(1)} <span className="text-xs font-bold">ک</span>
            </div>
            <span className="text-[10px] text-blue-800 font-bold block">
              تێکڕای دەوامی ستاف
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-200/80 text-blue-900 flex items-center justify-center font-black">
            💼
          </div>
        </div>

        {/* Total Late Time (+) */}
        <div className="p-3 rounded-xl border-2 border-rose-300 bg-rose-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-rose-800 uppercase flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> کۆی دواکەوتن (+)
            </span>
            <div className="text-base font-black font-mono text-rose-950">
              +{formatMinutesHuman(totalCompanyLateMins)}
            </div>
            <span className="text-[10px] text-rose-700 font-bold block">
              درەنگ هاتنی بەیانیان
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-200/80 text-rose-800 flex items-center justify-center font-black">
            ⏰
          </div>
        </div>

        {/* Total Early Leave Time (-) */}
        <div className="p-3 rounded-xl border-2 border-orange-300 bg-orange-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-orange-900 uppercase flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-orange-700" /> زوو دەرچوون (-)
            </span>
            <div className="text-base font-black font-mono text-orange-950">
              -{formatMinutesHuman(totalCompanyEarlyLeaveMins)}
            </div>
            <span className="text-[10px] text-orange-800 font-bold block">
              ڕۆشتن پێش کاتی دەوام
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-orange-200/80 text-orange-900 flex items-center justify-center font-black">
            🚪
          </div>
        </div>

        {/* Net Time Balance (+ / -) */}
        <div className={`p-3 rounded-xl border-2 shadow-sm flex items-center justify-between ${
          totalCompanyNetBalanceMins >= 0 
            ? 'border-emerald-300 bg-emerald-50/80' 
            : 'border-rose-300 bg-rose-50/80'
        }`}>
          <div className="space-y-1">
            <span className={`text-[10px] font-extrabold uppercase flex items-center gap-1 ${
              totalCompanyNetBalanceMins >= 0 ? 'text-emerald-900' : 'text-rose-900'
            }`}>
              <Sparkles className="w-3.5 h-3.5" /> هاوسەنگی کات (+/-)
            </span>
            <div className={`text-base font-black font-mono ${
              totalCompanyNetBalanceMins >= 0 ? 'text-emerald-950' : 'text-rose-950'
            }`}>
              {totalCompanyNetBalanceMins >= 0 
                ? `+${formatMinutesHuman(totalCompanyNetBalanceMins)}` 
                : `-${formatMinutesHuman(Math.abs(totalCompanyNetBalanceMins))}`}
            </div>
            <span className={`text-[10px] font-bold block ${
              totalCompanyNetBalanceMins >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              {totalCompanyNetBalanceMins >= 0 ? '✅ کاتی زیادە باڵادەستە' : '⚠️ کورتهێنانی کاتی گشتی'}
            </span>
          </div>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
            totalCompanyNetBalanceMins >= 0 ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-200 text-rose-950'
          }`}>
            ⚖️
          </div>
        </div>

        {/* Overtime > 30 Mins & Pay */}
        <div className="p-3 rounded-xl border-2 border-amber-300 bg-amber-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-amber-900 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> ئیزافەی &gt;٣٠خ
            </span>
            <div className="text-base font-black font-mono text-amber-950">
              {employeeAnalytics.reduce((acc, curr) => acc + curr.overtime30DaysCount, 0)} <span className="text-xs font-bold">جار</span>
            </div>
            <span className="text-[10px] text-amber-800 font-bold block font-mono">
              پارە: <span className="font-black">{totalCompanyOvertimePay.toLocaleString()}</span> IQD
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center font-black">
            📝
          </div>
        </div>

        {/* Total Absent Days */}
        <div className="p-3 rounded-xl border-2 border-red-300 bg-red-50/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-red-900 uppercase flex items-center gap-1">
              <UserX className="w-3.5 h-3.5 text-red-700" /> ڕۆژانی غیاب
            </span>
            <div className="text-base font-black font-mono text-red-950">
              {totalCompanyAbsentDays} <span className="text-xs font-bold">ڕۆژ</span>
            </div>
            <span className="text-[10px] text-red-800 font-bold block">
              نەهاتنی بێ پشوو
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-red-200/80 text-red-800 flex items-center justify-center font-black">
            ❌
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
              className="input-classic pr-8 text-xs w-48 sm:w-56 font-bold"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-200 p-0.5 rounded border border-slate-300 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-1 rounded transition-all ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-sm font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هەموو ({employeeAnalytics.length})
            </button>
            <button
              onClick={() => setFilterType('late')}
              className={`px-2 py-1 rounded transition-all ${
                filterType === 'late' ? 'bg-rose-600 text-white shadow-sm font-black' : 'text-rose-800 hover:bg-rose-100'
              }`}
            >
              دواکەوتووەکان ({employeeAnalytics.filter(e => e.totalLateMinutes > 0).length})
            </button>
            <button
              onClick={() => setFilterType('overtime')}
              className={`px-2 py-1 rounded transition-all ${
                filterType === 'overtime' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              ئیزافەکان ({employeeAnalytics.filter(e => e.totalOvertimeMinutes > 0).length})
            </button>
            <button
              onClick={() => setFilterType('absent')}
              className={`px-2 py-1 rounded transition-all ${
                filterType === 'absent' ? 'bg-red-600 text-white shadow-sm font-black' : 'text-red-800 hover:bg-red-100'
              }`}
            >
              غیابات ({employeeAnalytics.filter(e => e.absentDaysCount > 0).length})
            </button>
            <button
              onClick={() => setFilterType('overtime30')}
              className={`px-2 py-1 rounded transition-all ${
                filterType === 'overtime30' ? 'bg-amber-600 text-white shadow-sm font-black' : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              ئیزافەی &gt;٣٠ خولەک ({employeeAnalytics.filter(e => e.overtime30DaysCount > 0).length})
            </button>
          </div>
        </div>

        {/* PDF & CSV Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-900 border-red-300 shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-red-700" />
            <span>📄 هەناردەکردنی PDF (Full Width)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>📊 هەناردەکردنی CSV (Excel)</span>
          </button>
        </div>

      </div>

      {/* 📋 COMPREHENSIVE DETAILED ANALYTICS TABLE */}
      <div className="border border-slate-400 bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-right text-xs border-collapse">
          <thead>
            <tr className="bg-slate-200 border-b-2 border-slate-400 text-slate-800 font-black">
              <th className="p-2.5 border-l border-slate-300 text-center w-10">#</th>
              <th className="p-2.5 border-l border-slate-300">ناوی کارمەند و پۆست</th>
              <th className="p-2.5 border-l border-slate-300 text-center">ڕۆژانی دەوام</th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-red-50 text-red-950">غیاب</th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-blue-50 text-blue-950">کاتی کارکردن</th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-rose-100/70 text-rose-950">
                کۆی دواکەوتن (+)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-orange-100/70 text-orange-950">
                زوو ڕۆشتنەوە (-)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-indigo-100/70 text-indigo-950">
                هاوسەنگی کات (+/-)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-amber-100/80 text-amber-950">
                ئیزافەی &gt;٣٠خ (Approved)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-emerald-100/70 text-emerald-950">
                کۆی ئیزافە
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center bg-emerald-50 text-emerald-950">
                پارەی ئیزافە (IQD)
              </th>
              <th className="p-2.5 border-l border-slate-300 text-center">پابەندبوون</th>
              <th className="p-2.5 border-l border-slate-300 bg-amber-100/70 text-amber-950">
                تێبینی ئیزافەی &gt;٣٠ خولەک
              </th>
              <th className="p-2.5 text-center w-20">کردار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 font-bold">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={14} className="p-8 text-center text-slate-500 font-bold text-xs bg-slate-50">
                  هیچ تۆمارێک بۆ ئەم فلتەرە نەدۆزرایەوە.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const hasLate = row.totalLateMinutes > 0;
                const hasEarlyLeave = row.totalEarlyLeaveMinutes > 0;
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

                    {/* Absent Days */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono text-xs bg-red-50/30">
                      {row.absentDaysCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black">
                          {row.absentDaysCount} ڕۆژ غیاب
                        </span>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">0</span>
                      )}
                    </td>

                    {/* Total Worked Hours */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono text-xs bg-blue-50/30">
                      <span className="font-black text-slate-900">
                        {(row.totalWorkedMinutes / 60).toFixed(1)} ک
                      </span>
                    </td>

                    {/* Total Late (+) (Clickable Link to 31-Day Sheet Grid Row) */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-rose-50/40">
                      {hasLate ? (
                        <button
                          type="button"
                          onClick={() => {
                            const targetRow = document.getElementById(`sheet-row-emp-${row.employee.id}`);
                            if (targetRow) {
                              targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              
                              // Remove highlight from any other rows first
                              document.querySelectorAll('.emp-sheet-row-highlight').forEach(el => {
                                el.classList.remove('emp-sheet-row-highlight');
                              });
                              
                              // Add clean yellow highlight (No stroke/ring)
                              targetRow.classList.add('emp-sheet-row-highlight');
                              
                              // Clear on next click anywhere
                              const clearHighlight = () => {
                                targetRow.classList.remove('emp-sheet-row-highlight');
                                window.removeEventListener('click', clearHighlight);
                              };
                              setTimeout(() => {
                                window.addEventListener('click', clearHighlight, { once: true });
                              }, 150);

                              // Auto-remove after 4 seconds
                              setTimeout(() => {
                                targetRow.classList.remove('emp-sheet-row-highlight');
                              }, 4000);
                            } else {
                              const sheetSection = document.getElementById('attendance-sheet-grid-section');
                              if (sheetSection) sheetSection.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="space-y-0.5 group cursor-pointer w-full text-center hover:scale-105 transition-all p-1 rounded hover:bg-rose-100"
                          title="کرتە بکە بۆ بازدان بۆ سەر خشتەی ۳۱ ڕۆژەی ئامادەبوون و هایلایتکردنی کارمەند"
                        >
                          <span className="px-2.5 py-1 rounded-lg bg-rose-600 group-hover:bg-rose-700 text-white font-mono font-black text-xs inline-flex items-center gap-1.5 shadow-md">
                            <span>⏰ +{formatMinutesHuman(row.totalLateMinutes)}</span>
                            <span className="text-[11px] bg-rose-800 px-1 rounded">↗</span>
                          </span>
                          <span className="text-[10px] text-rose-900 block font-bold group-hover:underline mt-0.5">
                            {row.lateDaysCount} ڕۆژ ({formatMinutesDigital(row.totalLateMinutes)} ک)
                          </span>
                        </button>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">
                          ✓ بێ دواکەوتن
                        </span>
                      )}
                    </td>

                    {/* NEW COLUMN 1: Early Leave (-) */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-orange-50/40">
                      {hasEarlyLeave ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-orange-700 text-white font-mono font-black text-xs inline-block shadow-xs">
                            -{formatMinutesHuman(row.totalEarlyLeaveMinutes)}
                          </span>
                          <span className="text-[10px] text-orange-950 block font-bold">
                            {row.earlyLeaveDaysCount} ڕۆژ ({formatMinutesDigital(row.totalEarlyLeaveMinutes)} ک)
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 text-xs font-bold">
                          ✓ تەواو
                        </span>
                      )}
                    </td>

                    {/* NEW COLUMN 2: Net Time Balance (+ / -) */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono font-black text-xs">
                      {row.netTimeBalanceMinutes > 0 ? (
                        <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-400 shadow-xs inline-block">
                          +{formatMinutesHuman(row.netTimeBalanceMinutes)}
                        </span>
                      ) : row.netTimeBalanceMinutes < 0 ? (
                        <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-950 border border-rose-400 shadow-xs inline-block">
                          -{formatMinutesHuman(Math.abs(row.netTimeBalanceMinutes))}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-bold">0:00 (هاوسەنگ)</span>
                      )}
                    </td>

                    {/* NEW COLUMN 3: Approved Overtime > 30 Mins */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-amber-50/50 font-mono text-xs">
                      {row.overtime30DaysCount > 0 ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-amber-700 text-white font-black inline-block shadow-xs">
                            +{formatMinutesHuman(row.approvedOvertime30Minutes)}
                          </span>
                          <span className="text-[10px] text-amber-950 block font-bold">
                            {row.overtime30DaysCount} جار (&gt;٣٠خ)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    {/* Total Overtime (All Overtime) */}
                    <td className="p-2.5 border-l border-slate-200 text-center bg-emerald-50/40">
                      {hasOt ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-mono font-black text-xs inline-block">
                            {formatMinutesHuman(row.totalOvertimeMinutes)}
                          </span>
                          <span className="text-[10px] text-emerald-800 block font-bold">
                            {row.overtimeDaysCount} ڕۆژ ({formatMinutesDigital(row.totalOvertimeMinutes)} ک)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          -
                        </span>
                      )}
                    </td>

                    {/* Overtime Pay IQD */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono font-black text-emerald-950 bg-emerald-50/30">
                      {row.overtimePayIQD > 0 ? (
                        <span>+{row.overtimePayIQD.toLocaleString()} IQD</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Attendance Punctuality Score */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono font-black">
                      <span className={`px-2 py-0.5 rounded border text-xs ${
                        row.attendanceScore >= 90
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : row.attendanceScore >= 75
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-rose-100 text-rose-950 border-rose-300'
                      }`}>
                        {row.attendanceScore}%
                      </span>
                    </td>

                    {/* Overtime > 30 Mins & Admin Notes */}
                    <td className="p-2.5 border-l border-slate-200 bg-amber-50/30">
                      {ot30Logs.length === 0 ? (
                        <span className="text-[11px] text-slate-400">نییە</span>
                      ) : (
                        <div className="space-y-1.5">
                          {ot30Logs.map((otLog) => {
                            const noteKey = otLog.noteKey;
                            const isEditing = editingNoteKey === noteKey;
                            const savedNote = adminNotes[noteKey] || '';

                            return (
                              <div key={noteKey} className="p-1.5 rounded border border-amber-300 bg-amber-100/60 text-xs space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono font-black text-amber-950 text-[10px]">
                                    📅 {otLog.date} (دەرچوون: {formatTime12H(otLog.checkOutTime)})
                                  </span>
                                  <span className="px-1 py-0.2 rounded bg-amber-700 text-white font-mono text-[9px] font-black">
                                    +{formatMinutesHuman(otLog.overtimeMinutes)}
                                  </span>
                                </div>

                                {/* Admin Note Box */}
                                <div className="pt-0.5">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        placeholder="تێبینی / هۆکاری ئیزافە..."
                                        value={tempNoteText}
                                        onChange={(e) => setTempNoteText(e.target.value)}
                                        className="input-classic flex-1 text-xs bg-white font-bold py-0.5"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveNote(noteKey)}
                                        disabled={savingNote}
                                        className="btn-classic-primary text-[10px] px-1.5 py-0.5 flex items-center gap-1"
                                      >
                                        <Save className="w-2.5 h-2.5" />
                                        <span>پاشەکەوت</span>
                                      </button>
                                      <button
                                        onClick={() => setEditingNoteKey(null)}
                                        className="btn-classic text-[10px] px-1.5 py-0.5"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-1 bg-white/80 p-1 rounded border border-amber-200">
                                      <div className="text-[10px] text-slate-800 font-bold truncate">
                                        <span className="text-amber-900 font-black">تێبینی: </span>
                                        {savedNote ? (
                                          <span className="text-slate-900">{savedNote}</span>
                                        ) : (
                                          <span className="text-rose-700 italic">⚠️ پێویستە</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setEditingNoteKey(noteKey);
                                          setTempNoteText(savedNote);
                                        }}
                                        className="text-amber-900 hover:text-amber-950 p-0.5 rounded flex items-center gap-0.5 text-[9px] font-black border border-amber-300"
                                      >
                                        <Edit3 className="w-2.5 h-2.5" />
                                        <span>{savedNote ? 'دەستکاری' : 'نووسین'}</span>
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

                    {/* Actions: View Daily First-In/Last-Out & Manage Leaves */}
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setActiveEmpDrawer(row)}
                          className="btn-classic text-[10px] px-1.5 py-1 text-blue-900 hover:bg-blue-50 flex items-center gap-1"
                          title="بینینی کاتی هاتن و دەرچوونی ڕۆژانە"
                        >
                          <Eye className="w-3 h-3 text-blue-700" />
                          <span>تۆمارەکان</span>
                        </button>

                        <button
                          onClick={() => {
                            setLeaveModalEmp(row.employee);
                            setLeaveDate(`${selectedMonth}-01`);
                          }}
                          className="btn-classic text-[10px] px-1.5 py-1 text-purple-900 hover:bg-purple-50 flex items-center gap-1"
                          title="دیاریکردنی پشوو یان مۆڵەتی فەرمی"
                        >
                          <Coffee className="w-3 h-3 text-purple-700" />
                          <span>پشوو</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 🖼️ MODAL 1: DAILY FIRST-IN / LAST-OUT DRAWER */}
      {activeEmpDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 max-w-3xl w-full shadow-2xl p-1 text-slate-900 font-sans">
            <div className="bg-blue-900 text-white p-2 px-3 flex items-center justify-between text-xs font-bold font-mono">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-300" />
                <span>کاتی یەکەم هاتن، دەرچوون و هاوسەنگی ڕۆژانە: {activeEmpDrawer.employee.fullName3Part || activeEmpDrawer.employee.name} ({selectedMonth})</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveEmpDrawer(null)}
                className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-white max-h-[70vh] overflow-y-auto space-y-2 text-xs">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-400 text-slate-900 font-black">
                    <th className="p-2 border-l border-slate-300 text-center w-12">ڕۆژ</th>
                    <th className="p-2 border-l border-slate-300 text-center">بەروار</th>
                    <th className="p-2 border-l border-slate-300 text-center bg-emerald-50 text-emerald-950">یەکەم هاتن (In)</th>
                    <th className="p-2 border-l border-slate-300 text-center bg-rose-50 text-rose-950">کۆتا دەرچوون (Out)</th>
                    <th className="p-2 border-l border-slate-300 text-center bg-rose-100/70">دواکەوتن (+)</th>
                    <th className="p-2 border-l border-slate-300 text-center bg-orange-100/70">زوو دەرچوون (-)</th>
                    <th className="p-2 border-l border-slate-300 text-center bg-emerald-100/70">ئیزافە (+)</th>
                    <th className="p-2 text-center bg-indigo-100/70 font-mono">هاوسەنگی (+/-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-bold">
                  {activeEmpDrawer.dailyDetails.map((day: any) => (
                    <tr key={day.date} className={`hover:bg-slate-50 ${day.isFriday ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-2 border-l border-slate-200 text-center font-mono font-black">{day.dayNum}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.date} <span className="text-[10px] text-slate-500">({day.dayOfWeek})</span>
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.checkInTime ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-black">
                            📥 {formatTime12H(day.checkInTime)}
                          </span>
                        ) : day.isOffDay ? (
                          <span className="text-amber-800 text-[11px] font-bold">پشوو / ئۆف</span>
                        ) : (
                          <span className="text-red-600 font-bold">غایب</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.checkOutTime ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-black">
                            📤 {formatTime12H(day.checkOutTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.lateMinutes > 0 ? (
                          <span className="text-rose-700 font-black">+{day.lateMinutes} خ</span>
                        ) : (
                          <span className="text-emerald-700 text-xs">✓</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.earlyLeaveMinutes > 0 ? (
                          <span className="text-orange-700 font-black">-{day.earlyLeaveMinutes} خ</span>
                        ) : (
                          <span className="text-emerald-700 text-xs">✓</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {day.overtimeMinutes > 0 ? (
                          <span className="text-emerald-700 font-black">+{day.overtimeMinutes} خ</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center font-mono font-black">
                        {day.netDailyMinutes > 0 ? (
                          <span className="text-emerald-700">+{day.netDailyMinutes} خ</span>
                        ) : day.netDailyMinutes < 0 ? (
                          <span className="text-rose-700">-{Math.abs(day.netDailyMinutes)} خ</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2 bg-slate-200 border-t border-slate-300 flex justify-end">
              <button
                onClick={() => setActiveEmpDrawer(null)}
                className="btn-classic-primary text-xs px-4 py-1"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL 2: ASSIGN OFF-DAY / EXCUSED LEAVE FOR EMPLOYEE */}
      {leaveModalEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 max-w-md w-full shadow-2xl p-1 text-slate-900 font-sans">
            <div className="bg-purple-900 text-white p-2 px-3 flex items-center justify-between text-xs font-bold font-mono">
              <span className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-purple-300" />
                <span>دیاریکردنی پشوو یان مۆڵەت: {leaveModalEmp.fullName3Part || leaveModalEmp.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setLeaveModalEmp(null)}
                className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 bg-white text-xs font-bold">
              <div>
                <label className="block text-slate-800 mb-1">بەرواری پشوو / مۆڵەت:</label>
                <input
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="input-classic w-full font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">جۆری پشوو:</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="input-classic w-full font-bold"
                >
                  <option value="off">پشووی هەفتانە (Weekly Off)</option>
                  <option value="excused">مۆڵەتی بەمۆڵەت / فەرمی (Excused Leave)</option>
                  <option value="sick">مۆڵەتی نەخۆشی (Sick Leave)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-800 mb-1">تێبینی یان هۆکار:</label>
                <input
                  type="text"
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  placeholder="بۆ نموونە: گەشت، مۆڵەتی نەخۆشخانە..."
                  className="input-classic w-full font-bold"
                />
              </div>

              <div className="pt-2 border-t border-slate-300 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalEmp(null)}
                  className="btn-classic text-xs"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="button"
                  onClick={handleSaveLeave}
                  className="btn-classic-primary text-xs flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>تۆمارکردنی پشوو</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
