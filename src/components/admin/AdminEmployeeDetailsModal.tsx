'use client';

import React, { useMemo } from 'react';
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
  Trash2
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-2 sm:p-4 dir-rtl" dir="rtl">
      <div className="bg-white rounded-2xl border-2 border-slate-400 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-right">
        
        {/* 🌟 HEADER: EMPLOYEE PROFILE 360 BANNER */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-none bg-slate-800 border-2 border-blue-400 overflow-hidden flex items-center justify-center text-white text-lg font-black shadow-md flex-shrink-0">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                <span>{employee.fullName3Part ? employee.fullName3Part.charAt(0) : employee.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  {employee.fullName3Part || employee.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-xs font-mono font-bold">
                  EMP-{employee.employeeId || employee.id.replace('emp-', '')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  employee.status === 'resigned' || employee.isActive === false
                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400'
                    : 'bg-blue-500/30 text-blue-200 border border-blue-400'
                }`}>
                  {employee.status === 'resigned' ? 'وازهێناو' : 'چالاک'}
                </span>
              </div>
              <p className="text-xs text-indigo-200 font-medium mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                  {employee.role || 'کارمەند'}
                </span>
                {employee.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    {employee.phone}
                  </span>
                )}
                <span className="font-mono text-[11px] text-slate-300">
                  مانگی: {selectedMonth}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="btn-classic text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              title="پرێنتکردنی تەواوی چالاکی ئەم کارمەندە وەک PDF"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>🖨️ پرێنت (PDF)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-classic text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
              title="داگرتنی داتای مانگانەی ئەم کارمەندە وەک Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>📊 CSV</span>
            </button>

            {onEnrollFace && (
              <button
                type="button"
                onClick={() => onEnrollFace(employee)}
                className="btn-classic text-xs font-bold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                title="تۆمارکردن یان دووبارە ناساندنەوەی ڕوخسار"
              >
                <Camera className="w-4 h-4 text-slate-950" />
                <span>📸 {hasFaceRegistered ? 'نوێکردنەوەی ڕوخسار' : 'ناساندنی ڕوخسار'}</span>
              </button>
            )}

            {hasFaceRegistered && onDeleteFace && (
              <button
                type="button"
                onClick={() => onDeleteFace(employee)}
                className="btn-classic text-xs font-bold px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 rounded-xl flex items-center gap-1 cursor-pointer shadow-md transition-all active:scale-95"
                title="سڕینەوە و پاککردنەوەی ناسنامەی دەموچاوی ئەم کارمەندە"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span>🗑️ سڕینەوەی ڕوخسار</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 📊 SUMMARY KPI METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-100 border-b border-slate-300 text-center">
          <div className="bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
            <span className="text-[10px] text-slate-600 block font-bold">ڕۆژانی ئامادەبوون</span>
            <p className="text-sm font-black text-blue-950 font-mono mt-0.5">
              {totals.daysPresent} ڕۆژ
            </p>
          </div>

          <div className="bg-white p-2 rounded-xl border border-amber-200 shadow-sm">
            <span className="text-[10px] text-amber-900 block font-bold">کۆی کاتی کارکردن</span>
            <p className="text-sm font-black text-amber-950 font-mono mt-0.5">
              {totals.totalWorkedHours} کاتژمێر
            </p>
          </div>

          <div className="bg-white p-2 rounded-xl border border-rose-200 shadow-sm">
            <span className="text-[10px] text-rose-900 block font-bold">کۆی دواکەوتن (+)</span>
            <p className="text-sm font-black text-rose-950 font-mono mt-0.5">
              {totals.totalLateMins > 0 ? `+${formatMinutesHuman(totals.totalLateMins)}` : '0'}
            </p>
          </div>

          <div className="bg-white p-2 rounded-xl border border-emerald-200 shadow-sm">
            <span className="text-[10px] text-emerald-900 block font-bold">کاتی زیادە (Overtime)</span>
            <p className="text-sm font-black text-emerald-950 font-mono mt-0.5">
              +{totals.totalOtHours} کاتژمێر
            </p>
          </div>

          <div className="bg-white p-2 rounded-xl border border-purple-200 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[10px] text-purple-900 block font-bold">کۆی شایستەی پارە (IQD)</span>
            <p className="text-sm font-black text-purple-950 font-mono mt-0.5">
              +{totals.totalOtPay.toLocaleString()} IQD
            </p>
          </div>
        </div>

        {/* 📋 DAY-BY-DAY ATTENDANCE & OVERTIME TABLE */}
        <div className="p-3 overflow-y-auto flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-700" />
              <span>خشتەی دەوامی ڕۆژانە و کاتی زیادەی کارمەند لە مانگی ({selectedMonth}):</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-500 font-bold">
              {totals.overtimeDaysCount} ڕۆژ ئیزافە
            </span>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b border-slate-300 text-slate-900 font-black">
                  <th className="p-2 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2 border-l border-slate-300 text-center">بەروار</th>
                  <th className="p-2 border-l border-slate-300 text-center">ڕۆژ</th>
                  <th className="p-2 border-l border-slate-300 text-center">کاتی هاتن (In)</th>
                  <th className="p-2 border-l border-slate-300 text-center">کاتی دەرچوون (Out)</th>
                  <th className="p-2 border-l border-slate-300 text-center bg-blue-50 text-blue-950">کاتی کارکردن</th>
                  <th className="p-2 border-l border-slate-300 text-center bg-amber-50 text-amber-950">ئیزافە</th>
                  <th className="p-2 border-l border-slate-300 text-center bg-emerald-50 text-emerald-950">بڕی پارە</th>
                  <th className="p-2 border-l border-slate-300">جۆری ئیش و تێبینی</th>
                  <th className="p-2 text-center">دۆخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {dailyRecords.map((rec) => {
                  const hasOt = rec.overtimeHours > 0;
                  return (
                    <tr 
                      key={rec.dayNum} 
                      className={`hover:bg-slate-50 transition-colors ${
                        hasOt ? 'bg-amber-50/50' : rec.isFriday ? 'bg-slate-50/60' : ''
                      }`}
                    >
                      <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">{rec.dayNum}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">{rec.dateStr}</td>
                      <td className="p-2 border-l border-slate-200 text-center text-slate-600 text-[11px]">{rec.dayName}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {rec.checkInTime ? (
                          <span className={`px-2 py-0.5 rounded-md border font-mono font-black ${
                            getAttendanceTimeBadge(rec.checkInTime, 'in').colorClass
                          }`}>
                            📥 {formatTime12H(rec.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {rec.checkOutTime ? (
                          <span className={`px-2 py-0.5 rounded-md border font-mono font-black ${
                            getAttendanceTimeBadge(rec.checkOutTime, 'out').colorClass
                          }`}>
                            📤 {formatTime12H(rec.checkOutTime)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono text-blue-950 bg-blue-50/30">
                        {rec.workedHours > 0 ? `${rec.workedHours} ک` : '-'}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono text-amber-950 font-black bg-amber-50/30">
                        {hasOt ? `+${rec.overtimeHours} ک` : '-'}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono text-emerald-950 font-black bg-emerald-50/30">
                        {rec.overtimeAmount > 0 ? `+${rec.overtimeAmount.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-slate-800 text-[11px]">
                        {rec.note ? (
                          <span className="text-slate-950 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 block">
                            📝 {rec.note}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {rec.status === 'present' ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px]">
                            ئامادە
                          </span>
                        ) : rec.status === 'off' ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            پشوو
                          </span>
                        ) : rec.status === 'future' ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px]">
                            داهاتوو
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-950 border border-rose-300 text-[10px]">
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
        <div className="p-3 bg-slate-100 border-t border-slate-300 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-bold">
            کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی — پرۆفایلی وردی کارمەند
          </span>
          <button
            onClick={onClose}
            className="btn-classic text-xs px-4 py-1.5 font-bold"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
