'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { formatTime12H, formatTime24H, getAttendanceTimeBadge, exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';
import { 
  X, 
  User, 
  Calendar, 
  Clock, 
  DollarSign, 
  Award, 
  Phone, 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Camera, 
  RefreshCw, 
  Printer, 
  FileSpreadsheet, 
  Trash2,
  ExternalLink
} from 'lucide-react';
import { getDaysInMonth, getDay, format } from 'date-fns';

export function formatMinutesHuman(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ک و ${m} خ`;
  if (h > 0) return `${h} کاتژمێر`;
  return `${m} خولەک`;
}

interface AdminEmployeeDetailsModalProps {
  employee: Employee | null;
  selectedMonth: string; // 'yyyy-MM'
  attendanceLogs: AttendanceRecord[];
  adminNotes: Record<string, string>;
  shiftStartTime?: string; // default '08:00'
  shiftEndTime?: string; // default '17:00'
  hourlyRate?: number; // default 5000
  onClose: () => void;
  onEnrollFace?: (emp: Employee) => void;
  onDeleteFace?: (emp: Employee) => void;
  hasFaceRegistered?: boolean;
}

export function AdminEmployeeDetailsModal({
  employee,
  selectedMonth,
  attendanceLogs,
  adminNotes,
  shiftStartTime = '08:00',
  shiftEndTime = '17:00',
  hourlyRate = 5000,
  onClose,
  onEnrollFace,
  onDeleteFace,
  hasFaceRegistered,
}: AdminEmployeeDetailsModalProps) {
  if (!employee) return null;

  const [yStr, mStr] = selectedMonth.split('-');
  const year = parseInt(yStr || '2026', 10);
  const month = parseInt(mStr || '08', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const cleanTime = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const parts = (cleanTime || '').split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  };

  const shiftStartMins = timeToMinutes(shiftStartTime);
  const shiftEndMins = timeToMinutes(shiftEndTime);

  // Compute daily breakdown and totals
  const { dailyRecords, totals } = useMemo(() => {
    let daysPresent = 0;
    let totalWorkedMins = 0;
    let totalLateMins = 0;
    let totalEarlyLeaveMins = 0;
    let totalOvertimeMins = 0;
    let lateDaysCount = 0;
    let overtimeDaysCount = 0;

    const days: Array<{
      dayNum: number;
      dateStr: string;
      dayName: string;
      isFriday: boolean;
      checkInTime: string | null;
      checkOutTime: string | null;
      workedHours: number;
      lateMins: number;
      earlyLeaveMins: number;
      overtimeHours: number;
      overtimeAmount: number;
      note: string;
      status: 'present' | 'off' | 'future' | 'absent';
    }> = [];

    const kurdishDayNames = ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];
    const todayDayNum = new Date().getDate();
    const currentYm = format(new Date(), 'yyyy-MM');

    // Filter employee's logs (matching both ID and multiple Kurdish name aliases)
    const empLogs = (attendanceLogs || []).filter(l => {
      const logEmpId = (l.employeeId || l.userId || '').toString().trim().toLowerCase();
      const empId = employee.id.toLowerCase();
      const empNumId = (employee.employeeId || '').toLowerCase();
      
      const logName = (l.name || l.userName || (l as any).employeeName || '').toString().trim().toLowerCase();
      const empName1 = (employee.fullName3Part || '').toLowerCase();
      const empName2 = (employee.name || '').toLowerCase();

      return (
        logEmpId === empId ||
        (empNumId && logEmpId.includes(empNumId)) ||
        (logName && empName1 && (logName === empName1 || logName.includes(empName1) || empName1.includes(logName))) ||
        (logName && empName2 && (logName === empName2 || logName.includes(empName2) || empName2.includes(logName)))
      );
    });

    for (let d = 1; d <= totalDays; d++) {
      const dStr = d.toString().padStart(2, '0');
      const dateStr = `${selectedMonth}-${dStr}`;
      const dateObj = new Date(year, month - 1, d);
      const dayOfWeek = getDay(dateObj);
      const isFriday = dayOfWeek === 5;
      const isFuture = selectedMonth === currentYm ? d > todayDayNum : false;

      const dateLogs = empLogs.filter(l => {
        const lDate = l.date || (l.time ? l.time.split(' ')[0] : l.createdAt?.split('T')[0] || '');
        return lDate === dateStr;
      });

      const inLog = dateLogs.find(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('in') || t.includes('هاتن') || !!(l as any).checkInTime;
      });

      const outLog = dateLogs.find(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('out') || t.includes('دەرچوون') || t.includes('ڕۆشتن') || !!(l as any).checkOutTime;
      });

      const inTime = inLog?.time 
        ? (inLog.time.includes(' ') ? inLog.time.split(' ')[1]?.slice(0, 5) : inLog.time.slice(0, 5))
        : (inLog as any)?.checkInTime?.slice(0, 5) || null;

      const outTime = outLog?.time 
        ? (outLog.time.includes(' ') ? outLog.time.split(' ')[1]?.slice(0, 5) : outLog.time.slice(0, 5))
        : (outLog as any)?.checkOutTime?.slice(0, 5) || null;

      const noteKey = `${employee.id}_${dateStr}`;
      const savedNote = adminNotes[noteKey] || (outLog as any)?.notes || (inLog as any)?.notes || '';

      let dayWorked = 0;
      let dayLate = 0;
      let dayEarly = 0;
      let dayOtHours = 0;

      if (inTime && outTime) {
        const inM = timeToMinutes(inTime);
        let outM = timeToMinutes(outTime);
        if (outM <= 360) outM += 1440; // 🌟 12 midnight / 00:00 is 1440 mins
        if (outM > inM) dayWorked = (outM - inM) / 60;
      } else if (inTime) {
        dayWorked = 8;
      }

      if (inTime) {
        const inM = timeToMinutes(inTime);
        if (inM > 495) { // 15-min tolerance rule (> 08:15)
          dayLate = inM - 480;
          totalLateMins += dayLate;
          lateDaysCount++;
        }
      }

      if (outTime) {
        let outM = timeToMinutes(outTime);
        if (outM <= 360) outM += 1440; // 🌟 12 midnight / 00:00 is 1440 mins

        if (outM < 1005) { // Early leave if before 16:45
          dayEarly = 1020 - outM;
          totalEarlyLeaveMins += dayEarly;
        } else if (outM > 1035) { // Overtime if after 17:15
          const otM = outM - 1020;
          dayOtHours = Math.round((otM / 60) * 10) / 10;
          totalOvertimeMins += otM;
          overtimeDaysCount++;
        }
      }

      const isPresent = !!(inTime || outTime);
      let status: 'present' | 'off' | 'future' | 'absent' = 'absent';
      if (isPresent) {
        status = 'present';
        daysPresent++;
        totalWorkedMins += Math.round(dayWorked * 60);
      } else if (isFriday) {
        status = 'off';
      } else if (isFuture) {
        status = 'future';
      }

      days.push({
        dayNum: d,
        dateStr,
        dayName: kurdishDayNames[dayOfWeek] || '',
        isFriday,
        checkInTime: inTime,
        checkOutTime: outTime,
        workedHours: Math.round(dayWorked * 10) / 10,
        lateMins: dayLate,
        earlyLeaveMins: dayEarly,
        overtimeHours: dayOtHours,
        overtimeAmount: Math.round(dayOtHours * hourlyRate),
        note: savedNote,
        status,
      });
    }

    const totalOtHours = Math.round((totalOvertimeMins / 60) * 10) / 10;
    const totalOtPay = Math.round(totalOtHours * hourlyRate);
    const score = daysPresent > 0 ? Math.max(60, Math.min(100, 100 - (lateDaysCount * 4))) : 100;

    return {
      dailyRecords: days,
      totals: {
        daysPresent,
        totalWorkedHours: Math.round((totalWorkedMins / 60) * 10) / 10,
        totalLateMins,
        totalEarlyLeaveMins,
        totalOtHours,
        totalOtPay,
        overtimeDaysCount,
        lateDaysCount,
        punctualityScore: score,
      }
    };
  }, [employee, selectedMonth, attendanceLogs, adminNotes, shiftStartMins, shiftEndMins, hourlyRate, totalDays, year, month]);

  const handleExportPDF = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'dayNum', width: '35px', align: 'center' },
      { header: 'بەروار', key: 'dateStr', width: '85px', align: 'center' },
      { header: 'ڕۆژ', key: 'dayName', width: '60px', align: 'center' },
      { header: 'کاتی هاتن (In)', key: 'checkInTime', width: '75px', align: 'center' },
      { header: 'کاتی دەرچوون (Out)', key: 'checkOutTime', width: '75px', align: 'center' },
      { header: 'کاتی کارکردن', key: 'workedHours', width: '75px', align: 'center' },
      { header: 'ئیزافە', key: 'overtimeHours', width: '65px', align: 'center' },
      { header: 'بڕی پارە (IQD)', key: 'overtimeAmount', width: '85px', align: 'center' },
      { header: 'جۆری ئیش و تێبینی', key: 'note', align: 'right' },
      { header: 'دۆخ', key: 'statusLabel', width: '60px', align: 'center' },
    ];

    const data = dailyRecords.map(r => ({
      dayNum: r.dayNum,
      dateStr: r.dateStr,
      dayName: r.dayName,
      checkInTime: r.checkInTime ? formatTime24H(r.checkInTime) : '-',
      checkOutTime: r.checkOutTime ? formatTime24H(r.checkOutTime) : '-',
      workedHours: r.workedHours > 0 ? `${r.workedHours} ک` : '-',
      overtimeHours: r.overtimeHours > 0 ? `+${r.overtimeHours} ک` : '-',
      overtimeAmount: r.overtimeAmount > 0 ? `${r.overtimeAmount.toLocaleString()} IQD` : '-',
      note: r.note || '-',
      statusLabel: r.status === 'present' ? 'ئامادە' : r.status === 'off' ? 'پشوو' : r.status === 'future' ? 'داهاتوو' : 'غایب',
    }));

    exportToPDF({
      title: `ڕاپۆرتی دەوام و کاتی زیادەی کارمەند: ${employee.fullName3Part || employee.name}`,
      subtitle: `کۆمپانیای ئاشڵی — بەشی سەرچاوە مرۆییەکان (HR) — مانگی ${selectedMonth}`,
      period: `مانگی ${selectedMonth} (تەواوی ۳۱ ڕۆژ)`,
      columns: cols,
      data,
      fileName: `Ashley_Staff_Activity_${employee.name}_${selectedMonth}`,
      summaryCards: [
        { label: 'ڕۆژانی ئامادەبوون', value: `${totals.daysPresent} ڕۆژ`, color: '#2563eb' },
        { label: 'کۆی کارکردن', value: `${totals.totalWorkedHours} کاتژمێر`, color: '#d97706' },
        { label: 'کۆی دواکەوتن', value: totals.totalLateMins > 0 ? `+${totals.totalLateMins} خ` : 'بێ دواکەوتن', color: '#be123c' },
        { label: 'کۆی کاتی ئیزافە', value: `+${totals.totalOtHours} کاتژمێر`, color: '#7c3aed' },
        { label: 'شایستەی پارە (IQD)', value: `${totals.totalOtPay.toLocaleString()} IQD`, color: '#059669' },
      ],
    });
  };

  const handleExportCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ژمارەی ڕۆژ', key: 'dayNum' },
      { header: 'بەروار', key: 'dateStr' },
      { header: 'ڕۆژ', key: 'dayName' },
      { header: 'کاتی هاتن', key: 'checkInTime' },
      { header: 'کاتی دەرچوون', key: 'checkOutTime' },
      { header: 'کاتی کارکردن', key: 'workedHours' },
      { header: 'ئیزافە (کاتژمێر)', key: 'overtimeHours' },
      { header: 'شایستەی ئیزافە (IQD)', key: 'overtimeAmount' },
      { header: 'تێبینی و جۆری ئیش', key: 'note' },
      { header: 'دۆخ', key: 'statusLabel' },
    ];

    const data = dailyRecords.map(r => ({
      dayNum: r.dayNum,
      dateStr: r.dateStr,
      dayName: r.dayName,
      checkInTime: r.checkInTime ? formatTime24H(r.checkInTime) : '',
      checkOutTime: r.checkOutTime ? formatTime24H(r.checkOutTime) : '',
      workedHours: r.workedHours || '',
      overtimeHours: r.overtimeHours || '',
      overtimeAmount: r.overtimeAmount || '',
      note: r.note || '',
      statusLabel: r.status === 'present' ? 'ئامادە' : r.status === 'off' ? 'پشوو' : r.status === 'future' ? 'داهاتوو' : 'غایب',
    }));

    exportToCSV(cols, data, `Ashley_Activity_${employee.name}_${selectedMonth}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4 dir-rtl font-sans animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white rounded-[28px] border border-white/60 dark:border-white/10 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-right">
        
        {/* 🌟 iOS HEADER: EMPLOYEE PROFILE BANNER */}
        <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 overflow-hidden flex items-center justify-center text-white text-lg font-black shadow-sm flex-shrink-0">
              {(employee.photoUrl || (employee as any).photo) ? (
                <img src={employee.photoUrl || (employee as any).photo} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <span>{employee.fullName3Part ? employee.fullName3Part.charAt(0) : employee.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {employee.fullName3Part || employee.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 text-[10px] font-mono font-bold">
                  EMP-{employee.employeeId || employee.id.replace('emp-', '')}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  employee.status === 'resigned' || employee.isActive === false
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50'
                }`}>
                  {employee.status === 'resigned' ? 'وازهێناو' : 'چالاک'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  {employee.role || 'کارمەند'}
                </span>
                {employee.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    {employee.phone}
                  </span>
                )}
                <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                  مانگی: {selectedMonth}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="h-8 w-8 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
              title="پرێنتکردنی تەواوی چالاکی ئەم کارمەندە وەک PDF"
              aria-label="Export PDF"
            >
              <Printer className="w-4 h-4 text-white" />
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-2xs"
              title="داگرتنی داتای مانگانەی ئەم کارمەندە وەک CSV"
              aria-label="Export CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>

            {onEnrollFace && (
              <button
                type="button"
                onClick={() => onEnrollFace(employee)}
                className="px-3.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200/50 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                title="تۆمارکردن یان دووبارە ناساندنەوەی ڕوخسار"
              >
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>{hasFaceRegistered ? 'نوێکردنەوەی ڕوخسار' : 'ناساندنی ڕوخسار'}</span>
              </button>
            )}

            {hasFaceRegistered && onDeleteFace && (
              <button
                type="button"
                onClick={() => onDeleteFace(employee)}
                className="px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/50 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="سڕینەوەی ناسنامەی دەموچاو"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <Link
              href={`/employees/${employee.id}`}
              className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="کردنەوەی دۆسیە و پرۆفایلی تەواوی ئەم کارمەندە"
            >
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>دۆسیەی تەواو</span>
              <ExternalLink className="w-3 h-3 opacity-40" />
            </Link>

            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-90"
              title="داخستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 📊 SUMMARY KPI METRICS BAR (Apple Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 sm:p-5">
          <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">ڕۆژانی ئامادەبوون</span>
            <p className="text-base font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
              {totals.daysPresent} <span className="text-xs font-medium text-slate-400">ڕۆژ</span>
            </p>
          </div>

          <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">کۆی کاتی کارکردن</span>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {totals.totalWorkedHours} <span className="text-xs font-medium text-slate-400">h</span>
            </p>
          </div>

          <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">کۆی دواکەوتن</span>
            <p className="text-base font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
              {totals.totalLateMins > 0 ? `+${formatMinutesHuman(totals.totalLateMins)}` : '0'}
            </p>
          </div>

          <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">کاتی زیادە</span>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              +{totals.totalOtHours} <span className="text-xs font-medium text-slate-400">h</span>
            </p>
          </div>

          <div className="bg-white dark:bg-[#2c2c2e] p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">شایستەی پارە</span>
            <p className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5">
              +{totals.totalOtPay.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">IQD</span>
            </p>
          </div>
        </div>

        {/* 📋 DAY-BY-DAY ATTENDANCE & OVERTIME TABLE */}
        <div className="px-5 pb-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>خشتەی دەوامی ڕۆژانە و کاتی زیادەی کارمەند:</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500 font-bold bg-white dark:bg-[#2c2c2e] px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-white/5">
              {totals.overtimeDaysCount} ڕۆژ ئیزافە
            </span>
          </div>

          <div className="border border-slate-200/80 dark:border-white/5 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-[#2c2c2e]">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#3a3a3c] border-b border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 font-bold">
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">بەروار</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">ڕۆژ</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">هاتن (In)</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">دەرچوون (Out)</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">کاتی کارکردن</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">ئیزافە</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5 text-center">بڕی پارە</th>
                  <th className="p-2.5 border-l border-slate-200/80 dark:border-white/5">تێبینی</th>
                  <th className="p-2.5 text-center">دۆخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {dailyRecords.map((rec) => {
                  const hasOt = rec.overtimeHours > 0;
                  return (
                    <tr 
                      key={rec.dayNum} 
                      className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                        hasOt ? 'bg-amber-50/30 dark:bg-amber-950/20' : rec.isFriday ? 'bg-slate-50/50 dark:bg-white/5' : ''
                      }`}
                    >
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono text-slate-400">{rec.dayNum}</td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono">{rec.dateStr}</td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center text-slate-500 text-[11px]">{rec.dayName}</td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono">
                        {rec.checkInTime ? (
                          <span className="px-2 py-0.5 rounded-md font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30">
                            {formatTime12H(rec.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono">
                        {rec.checkOutTime ? (
                          <span className="px-2 py-0.5 rounded-md font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30">
                            {formatTime12H(rec.checkOutTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                        {rec.workedHours > 0 ? `${rec.workedHours}h` : '-'}
                      </td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                        {hasOt ? `+${rec.overtimeHours}h` : '-'}
                      </td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {rec.overtimeAmount > 0 ? `+${rec.overtimeAmount.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2.5 border-l border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300 text-xs">
                        {rec.note ? (
                          <span className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-[#1c1c1e] px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-white/5 block">
                            {rec.note}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {rec.status === 'present' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                            ئامادە
                          </span>
                        ) : rec.status === 'off' ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400 text-[10px] font-bold">
                            پشوو
                          </span>
                        ) : rec.status === 'future' ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] font-bold">
                            داهاتوو
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold">
                            غایب
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            کۆمپانیای ئاشڵی — پرۆفایلی وردی کارمەند
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
