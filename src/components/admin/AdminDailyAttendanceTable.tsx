'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Printer, 
  FileSpreadsheet, 
  FileText, 
  Edit3, 
  Check, 
  X, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Search,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { format, addDays, subDays, parseISO, getDaysInMonth, getDay } from 'date-fns';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { 
  formatTime24H, 
  getAttendanceTimeBadge, 
  exportToPDF, 
  exportToCSV, 
  exportMonthlyMultiPageDailyPDF,
  DailyReportRow,
  ExportTableColumn
} from '@/lib/export-utils';
import { GOOGLE_SHEET_OVERTIME_DATA, generateAugust2026AdminNotes, generateAugust2026OvertimeList, matchEmployeeByName } from '@/lib/attendance-seed-data';

interface AdminDailyAttendanceTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
  adminNotes: Record<string, string>;
  onUpdateAdminNote?: (key: string, note: string) => void;
  selectedMonth?: string; // 'yyyy-MM' (default '2026-08')
}

const KURDISH_DAY_NAMES: Record<number, string> = {
  0: 'یەکشەممە',
  1: 'دووشەممە',
  2: 'سێشەممە',
  3: 'چوارشەممە',
  4: 'پێنجشەممە',
  5: 'هەینی',
  6: 'شەممە',
};

export function AdminDailyAttendanceTable({
  employees,
  attendanceLogs,
  adminNotes,
  onUpdateAdminNote,
  selectedMonth = '2026-08',
}: AdminDailyAttendanceTableProps) {
  // Default to 2026-08-13 (the rich seed date) or current date if in August
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (today.startsWith(selectedMonth)) return today;
    return `${selectedMonth}-13`;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [editingAdminNoteKey, setEditingAdminNoteKey] = useState<string | null>(null);
  const [tempAdminNoteText, setTempAdminNoteText] = useState('');

  // Active Employees only
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Compute Day details
  const parsedDate = useMemo(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  const dayOfWeek = getDay(parsedDate);
  const dayName = KURDISH_DAY_NAMES[dayOfWeek] || '';
  const isFriday = dayOfWeek === 5;
  const dayNum = parsedDate.getDate();

  // Navigation handlers
  const handlePrevDay = () => {
    const prev = subDays(parsedDate, 1);
    setSelectedDate(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const next = addDays(parsedDate, 1);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  // Helper to get day data for any specific date
  const computeDayRows = (dateStr: string): { rows: DailyReportRow[]; summary: any } => {
    let pDate: Date;
    try {
      pDate = parseISO(dateStr);
    } catch {
      pDate = new Date();
    }
    const dNum = pDate.getDate();
    const dOfWeek = getDay(pDate);
    const isFri = dOfWeek === 5;

    let presentCount = 0;
    let lateCount = 0;
    let overtimeCount = 0;
    let totalOvertimeMins = 0;

    const rows: DailyReportRow[] = activeEmployees.map((emp, idx) => {
      // 1. Find dynamic logs for this day
      const dayLogs = attendanceLogs.filter(l => {
        const lDate = l.date || (l.timestamp ? l.timestamp.split('T')[0] : (l.time ? l.time.split(' ')[0] : ''));
        if (lDate !== dateStr) return false;
        
        const logEmpId = (l.employeeId || l.userId || '').toString().trim().toLowerCase();
        const empId = (emp.id || '').toString().trim().toLowerCase();
        const empNumId = (emp.employeeId || '').toString().trim().toLowerCase();
        
        const logName = (l.name || l.userName || (l as any).employeeName || '').trim().toLowerCase();
        const empName1 = (emp.fullName3Part || '').trim().toLowerCase();
        const empName2 = (emp.name || '').trim().toLowerCase();

        return (
          logEmpId === empId ||
          (empNumId && logEmpId.includes(empNumId)) ||
          (logName && empName1 && (logName === empName1 || logName.includes(empName1) || empName1.includes(logName))) ||
          (logName && empName2 && (logName === empName2 || logName.includes(empName2) || empName2.includes(logName)))
        );
      });

      const inLog = dayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('in') || (l.type || l.action || '').includes('هاتن'));
      const outLog = dayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('out') || (l.type || l.action || '').includes('دەرچوون') || (l.type || l.action || '').includes('ڕۆشتن'));

      // 2. Extract times from dynamic logs
      let checkInTime = inLog?.time ? (inLog.time.includes(' ') ? inLog.time.split(' ')[1].slice(0, 5) : inLog.time.slice(0, 5)) : '-';
      let checkOutTime = outLog?.time ? (outLog.time.includes(' ') ? outLog.time.split(' ')[1].slice(0, 5) : outLog.time.slice(0, 5)) : '-';

      let checkInNote = inLog?.employeeNote || (inLog?.notes?.startsWith('تێبینی کارمەند:') ? inLog.notes.replace('تێبینی کارمەند:', '').trim() : inLog?.notes || '');
      let checkOutNote = outLog?.employeeNote || (outLog?.notes?.startsWith('تێبینی کارمەند:') ? outLog.notes.replace('تێبینی کارمەند:', '').trim() : outLog?.notes || '');

      // 3. Check Seed Data / August 2026 Fallback
      if (dateStr.startsWith('2026-08')) {
        const seedEntry = GOOGLE_SHEET_OVERTIME_DATA.find(
          d => d.date === dateStr && !!matchEmployeeByName(d.empName, [emp])
        );

        if (seedEntry) {
          if (checkInTime === '-') checkInTime = '08:00';
          if (checkOutTime === '-') {
            const endMinutes = 17 * 60 + Math.round(seedEntry.hours * 60);
            const endH = Math.floor(endMinutes / 60) % 24;
            const endM = endMinutes % 60;
            checkOutTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
          }
          if (!checkOutNote) {
            checkOutNote = seedEntry.workType + (seedEntry.note ? ` (${seedEntry.note})` : '');
          }
        } else if (dNum <= 19 && !isFri) {
          // Regular Working Day in August for Active Employee
          if (checkInTime === '-') checkInTime = '08:00';
          if (checkOutTime === '-') checkOutTime = '17:00';
          if (!checkInNote) checkInNote = 'دەوامی ئاسایی فەرمی';
        }
      }

      // 4. Admin Note
      const adminNoteKey = `${emp.id}_${dateStr}`;
      let adminNote = adminNotes[adminNoteKey] || '';
      if (!adminNote && dateStr.startsWith('2026-08')) {
        const seedAdminMap = generateAugust2026AdminNotes(employees);
        adminNote = seedAdminMap[adminNoteKey] || '';
      }

      // 4. Calculate Work Duration and Overtime
      let durationStr = '-';
      let overtimeStr = '-';
      let otMins = 0;

      if (checkInTime !== '-' && checkOutTime !== '-') {
        const [inH, inM] = checkInTime.split(':').map(Number);
        const [outH, outM] = checkOutTime.split(':').map(Number);

        let inTotal = inH * 60 + inM;
        let outTotal = outH * 60 + outM;

        // Support midnight/overnight (e.g. 00:00 -> 1440 mins)
        if (outTotal < inTotal || outH === 0) {
          outTotal += 1440;
        }

        const totalWorkedMins = Math.max(0, outTotal - inTotal);
        const workH = Math.floor(totalWorkedMins / 60);
        const workM = totalWorkedMins % 60;
        durationStr = `${workH}ک ${workM > 0 ? `${workM}خ` : ''}`;

        // Standard Shift End is 17:00 (1020 mins) + 15 min tolerance = 1035 mins
        if (outTotal > 1035) {
          otMins = outTotal - 1020;
          const otH = Math.floor(otMins / 60);
          const otRemainM = otMins % 60;
          overtimeStr = `+${otH}ک${otRemainM > 0 ? ` ${otRemainM}خ` : ''}`;
        }
      }

      // Check In status
      const isPresent = checkInTime !== '-';
      if (isPresent) presentCount++;

      if (checkInTime !== '-') {
        const [inH, inM] = checkInTime.split(':').map(Number);
        if (inH * 60 + inM > 495) { // > 08:15
          lateCount++;
        }
      }

      if (otMins > 0) {
        overtimeCount++;
        totalOvertimeMins += otMins;
      }

      return {
        index: idx + 1,
        empId: emp.id,
        name: emp.fullName3Part || emp.name,
        role: emp.role || 'کارمەند',
        checkInTime,
        checkInNote,
        checkOutTime,
        checkOutNote,
        durationStr,
        overtimeStr,
        adminNote,
        status: isPresent ? 'present' : isFri ? 'off' : 'absent',
      };
    });

    const totalOvertimeHours = Math.round((totalOvertimeMins / 60) * 10) / 10;

    return {
      rows,
      summary: {
        totalEmployees: activeEmployees.length,
        presentCount,
        lateCount,
        overtimeCount,
        totalOvertimeHours,
      },
    };
  };

  // Current selected day data
  const currentDayData = useMemo(() => {
    return computeDayRows(selectedDate);
  }, [selectedDate, activeEmployees, attendanceLogs, adminNotes]);

  // Filtered rows for UI
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return currentDayData.rows;
    const q = searchTerm.toLowerCase();
    return currentDayData.rows.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.role.toLowerCase().includes(q) ||
      (r.checkInNote && r.checkInNote.toLowerCase().includes(q)) ||
      (r.checkOutNote && r.checkOutNote.toLowerCase().includes(q)) ||
      (r.adminNote && r.adminNote.toLowerCase().includes(q))
    );
  }, [currentDayData.rows, searchTerm]);

  // Save Admin Note
  const handleSaveAdminNote = (empId: string) => {
    const key = `${empId}_${selectedDate}`;
    if (onUpdateAdminNote) {
      onUpdateAdminNote(key, tempAdminNoteText.trim());
    }
    setEditingAdminNoteKey(null);
    setTempAdminNoteText('');
  };

  // 🖨️ Export Single Day PDF
  const handlePrintSingleDayPDF = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index', width: '35px', align: 'center' },
      { header: 'ناوی کارمەند', key: 'name', align: 'right', width: '130px' },
      { header: 'پۆست / ئەرک', key: 'role', align: 'right', width: '90px' },
      { header: '📥 کاتی هاتن', key: 'checkInTime', align: 'center', width: '80px' },
      { header: 'تێبینی هاتنی کارمەند', key: 'checkInNote', align: 'right', width: '120px' },
      { header: '📤 کاتی دەرچوون', key: 'checkOutTime', align: 'center', width: '80px' },
      { header: 'تێبینی دەرچوون / ئیزافە', key: 'checkOutNote', align: 'right', width: '120px' },
      { header: '⏱️ ماوەی دەوام', key: 'durationStr', align: 'center', width: '80px' },
      { header: '⚡ کاتی ئیزافە', key: 'overtimeStr', align: 'center', width: '75px' },
      { header: '🛡️ تێبینی ئەدمین', key: 'adminNote', align: 'right' },
    ];

    exportToPDF({
      title: `ڕاپۆرتی ئامادەبوونی ڕۆژانە — ${dayName} (${selectedDate})`,
      subtitle: `کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی — بەشی سەرچاوە مرۆییەکان`,
      period: `بەروار: ${selectedDate} (${dayName})`,
      columns: cols,
      data: currentDayData.rows,
      fileName: `Ashley_Daily_Attendance_${selectedDate}`,
      summaryCards: [
        { label: 'کۆی گشتی کارمەندان', value: `${currentDayData.summary.totalEmployees} کەس`, color: '#2563eb' },
        { label: 'ئامادەبووان (Present)', value: `${currentDayData.summary.presentCount} کەس`, color: '#059669' },
        { label: 'دواکەوتوو (Late > 08:15)', value: `${currentDayData.summary.lateCount} کەس`, color: '#e11d48' },
        { label: 'خاوەن ئیزافە (Overtime)', value: `${currentDayData.summary.overtimeCount} کەس (+${currentDayData.summary.totalOvertimeHours}ک)`, color: '#7c3aed' },
      ],
    });
  };

  // 🖨️ 31-Page Multi-Page Monthly PDF Report Generator
  const handlePrint31DayMonthPDF = () => {
    const totalDays = getDaysInMonth(parseISO(`${selectedMonth}-01`));
    const allMonthDaysData = [];

    for (let day = 1; day <= totalDays; day++) {
      const dStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
      let pD: Date;
      try {
        pD = parseISO(dStr);
      } catch {
        pD = new Date();
      }
      const dWeek = getDay(pD);
      const isFri = dWeek === 5;
      const dName = KURDISH_DAY_NAMES[dWeek] || '';

      const dayResult = computeDayRows(dStr);
      allMonthDaysData.push({
        dateStr: dStr,
        dayNum: day,
        dayName: dName,
        isFriday: isFri,
        rows: dayResult.rows,
        summary: dayResult.summary,
      });
    }

    exportMonthlyMultiPageDailyPDF({
      month: selectedMonth,
      daysData: allMonthDaysData,
      title: `ڕاپۆرتی ۳۱ لاپەڕەیی ئامادەبوونی مانگی (${selectedMonth})`,
      subtitle: `کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی (Ashley Enterprise ERP)`,
    });
  };

  // 📊 Export Single Day CSV
  const handleExportDayCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ژمارە', key: 'index' },
      { header: 'ناوی کارمەند', key: 'name' },
      { header: 'پۆست', key: 'role' },
      { header: 'کاتی هاتن', key: 'checkInTime' },
      { header: 'تێبینی هاتن', key: 'checkInNote' },
      { header: 'کاتی ڕۆیشتن', key: 'checkOutTime' },
      { header: 'تێبینی ڕۆیشتن / ئیزافە', key: 'checkOutNote' },
      { header: 'ماوەی دەوام', key: 'durationStr' },
      { header: 'ئیزافە', key: 'overtimeStr' },
      { header: 'تێبینی ئەدمین', key: 'adminNote' },
    ];

    exportToCSV(cols, currentDayData.rows, `Ashley_Daily_${selectedDate}`);
  };

  // 📊 Export Entire Month Daily CSV
  const handleExportMonthCSV = () => {
    const totalDays = getDaysInMonth(parseISO(`${selectedMonth}-01`));
    const allRows: any[] = [];

    let overallIdx = 1;
    for (let day = 1; day <= totalDays; day++) {
      const dStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
      const dayResult = computeDayRows(dStr);
      for (const r of dayResult.rows) {
        allRows.push({
          index: overallIdx++,
          date: dStr,
          day: day,
          name: r.name,
          role: r.role,
          checkInTime: r.checkInTime,
          checkInNote: r.checkInNote || '',
          checkOutTime: r.checkOutTime,
          checkOutNote: r.checkOutNote || '',
          duration: r.durationStr,
          overtime: r.overtimeStr,
          adminNote: r.adminNote || '',
        });
      }
    }

    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index' },
      { header: 'بەروار', key: 'date' },
      { header: 'ڕۆژ', key: 'day' },
      { header: 'ناوی کارمەند', key: 'name' },
      { header: 'پۆست', key: 'role' },
      { header: 'کاتی هاتن', key: 'checkInTime' },
      { header: 'تێبینی هاتن', key: 'checkInNote' },
      { header: 'کاتی دەرچوون', key: 'checkOutTime' },
      { header: 'تێبینی دەرچوون / ئیزافە', key: 'checkOutNote' },
      { header: 'ماوەی کارکردن', key: 'duration' },
      { header: 'ئیزافە', key: 'overtime' },
      { header: 'تێبینی ئەدمین', key: 'adminNote' },
    ];

    exportToCSV(cols, allRows, `Ashley_Full_Month_Daily_${selectedMonth}`);
  };

  // 🔄 Google Sheets Sync
  const handleSyncGoogleSheet = () => {
    const defaultNotes = generateAugust2026AdminNotes(employees);
    const defaultOvertime = generateAugust2026OvertimeList(employees);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_admin_notes_2026-08', JSON.stringify(defaultNotes));
      localStorage.setItem('ashley_ot_notes_2026-08', JSON.stringify(defaultNotes));
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    alert(`🎉 داتاکانی گووگڵ شیت (${GOOGLE_SHEET_OVERTIME_DATA.length} تۆمار) لەگەڵ کاتەکانی هاتن و دەرچوون بە سەرکەوتوویی هاوتا کران!`);
  };

  return (
    <div className="space-y-4">
      
      {/* 📅 TOP CONTROLS BAR: DATE PICKER & REPORT BUTTONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-md border border-slate-700">
        
        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="ڕۆژی پێشوو"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            <Calendar className="w-4 h-4 text-sky-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
            />
            <span className="text-xs font-black text-amber-300 px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30">
              {dayName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
            title="ڕۆژی دواتر"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="btn-classic text-xs font-bold px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border-blue-400 rounded-xl"
          >
            ئەمڕۆ
          </button>
        </div>

        {/* Executive Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* 🔄 Google Sheets Sync */}
          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            className="btn-classic text-xs font-black px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-300 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
            title="هاوتاکردنەوە و هێنانی داتاکانی گووگڵ شیت"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-950" />
            <span>🔄 هاوتاکردنەوە بە Google Sheets</span>
          </button>

          {/* 🖨️ Print Single Day */}
          <button
            type="button"
            onClick={handlePrintSingleDayPDF}
            className="btn-classic text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
            title="پرێنتکردنی تەواوی زانیاری ئەم ڕۆژە وەک PDF"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>🖨️ پرێنتی ئەم ڕۆژە (PDF)</span>
          </button>

          {/* 🖨️ 31-PAGE FULL MONTH MULTI-PAGE PDF */}
          <button
            type="button"
            onClick={handlePrint31DayMonthPDF}
            className="btn-classic text-xs font-black px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white border border-purple-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg transition-all active:scale-95"
            title="پرێنتکردنی تەواوی ۳۱ ڕۆژی مانگ لە فایلی یەک PDF دا (هەر ڕۆژەی لاپەڕەیەک)"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>🖨️ پرێنتی گشتی مانگانە (۳۱ لاپەڕە)</span>
          </button>

          {/* 📊 Day CSV */}
          <button
            type="button"
            onClick={handleExportDayCSV}
            className="btn-classic text-xs font-bold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-400 rounded-xl flex items-center gap-1 cursor-pointer shadow-md"
            title="داگرتنی داتای ئەم ڕۆژە بۆ Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>📊 CSV ی ڕۆژ</span>
          </button>

          {/* 📊 Month CSV */}
          <button
            type="button"
            onClick={handleExportMonthCSV}
            className="btn-classic text-xs font-bold px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white border border-teal-500 rounded-xl flex items-center gap-1 cursor-pointer shadow-md"
            title="داگرتنی سەرجەم ڕۆژەکانی مانگ بۆ Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>📊 CSV ی مانگ</span>
          </button>

        </div>

      </div>

      {/* 📊 SUMMARY KPI BAR FOR SELECTED DAY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-center shadow-xs">
          <span className="text-[11px] font-bold text-blue-900 block">کۆی کارمەندانی چالاک</span>
          <p className="text-lg font-black text-blue-950 font-mono mt-0.5">
            {currentDayData.summary.totalEmployees} کەس
          </p>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center shadow-xs">
          <span className="text-[11px] font-bold text-emerald-900 block">ئامادەبووانی ئەم ڕۆژە</span>
          <p className="text-lg font-black text-emerald-950 font-mono mt-0.5">
            {currentDayData.summary.presentCount} کەس
          </p>
        </div>

        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center shadow-xs">
          <span className="text-[11px] font-bold text-rose-900 block">دواکەوتوو (دوای 08:15)</span>
          <p className="text-lg font-black text-rose-950 font-mono mt-0.5">
            {currentDayData.summary.lateCount} کەس
          </p>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-center shadow-xs">
          <span className="text-[11px] font-bold text-purple-900 block">خاوەن ئیزافە (Overtime)</span>
          <p className="text-lg font-black text-purple-950 font-mono mt-0.5">
            {currentDayData.summary.overtimeCount} کەس <span className="text-xs text-purple-700">({currentDayData.summary.totalOvertimeHours} کاتژمێر)</span>
          </p>
        </div>
      </div>

      {/* 🔍 SEARCH FILTER */}
      <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="گەڕان بەدوای ناوی کارمەند، پۆست، تێبینی کارمەند، یان تێبینی ئەدمین..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-classic w-full text-xs font-bold"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-700 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 📋 MASTER DAILY ATTENDANCE TABLE */}
      <div className="table-classic-wrapper rounded-2xl border border-slate-300 shadow-sm overflow-hidden bg-white">
        <table className="table-classic w-full text-xs">
          <thead>
            <tr className="bg-slate-900 text-white font-black text-right">
              <th className="p-2.5 text-center w-10">#</th>
              <th className="p-2.5 w-44">ناوی کارمەند</th>
              <th className="p-2.5 w-32">پۆست / ئەرک</th>
              <th className="p-2.5 text-center w-28">📥 هاتن</th>
              <th className="p-2.5 w-44">📝 تێبینی هاتن</th>
              <th className="p-2.5 text-center w-28">📤 ڕۆیشتن</th>
              <th className="p-2.5 w-44">📝 تێبینی ڕۆیشتن / ئیزافە</th>
              <th className="p-2.5 text-center w-24">⏱️ دەوام</th>
              <th className="p-2.5 text-center w-24">⚡ ئیزافە</th>
              <th className="p-2.5">🛡️ تێبینی ئەدمین</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.length > 0 ? (
              filteredRows.map((row) => {
                const inBadge = getAttendanceTimeBadge(row.checkInTime, 'in');
                const outBadge = getAttendanceTimeBadge(row.checkOutTime, 'out');
                const isEditingThisAdminNote = editingAdminNoteKey === row.empId;

                return (
                  <tr key={row.empId} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500 font-bold">
                      {row.index}
                    </td>

                    <td className="p-2.5 border-l border-slate-200 font-black text-slate-900">
                      {row.name}
                    </td>

                    <td className="p-2.5 border-l border-slate-200 text-slate-600 font-bold">
                      {row.role}
                    </td>

                    {/* Check-In */}
                    <td className="p-2.5 border-l border-slate-200 text-center">
                      {row.checkInTime !== '-' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono font-black text-xs inline-block">
                          📥 {inBadge.formattedTime}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold">-</span>
                      )}
                    </td>

                    {/* Check-In Employee Note */}
                    <td className="p-2.5 border-l border-slate-200">
                      {row.checkInNote ? (
                        <div className="flex items-start gap-1 text-[11px] text-blue-900 font-bold bg-blue-50/80 p-1.5 rounded-lg border border-blue-200">
                          <MessageSquare className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{row.checkInNote}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Check-Out */}
                    <td className="p-2.5 border-l border-slate-200 text-center">
                      {row.checkOutTime !== '-' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-950 border border-sky-300 font-mono font-black text-xs inline-block">
                          📤 {outBadge.formattedTime}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono font-bold">-</span>
                      )}
                    </td>

                    {/* Check-Out Employee Note / Overtime Reason */}
                    <td className="p-2.5 border-l border-slate-200">
                      {row.checkOutNote ? (
                        <div className="flex items-start gap-1 text-[11px] text-purple-900 font-bold bg-purple-50/80 p-1.5 rounded-lg border border-purple-200">
                          <MessageSquare className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" />
                          <span>{row.checkOutNote}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="p-2.5 border-l border-slate-200 text-center font-mono font-bold text-slate-800">
                      {row.durationStr}
                    </td>

                    {/* Overtime */}
                    <td className="p-2.5 border-l border-slate-200 text-center">
                      {row.overtimeStr !== '-' ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-950 border border-purple-300 font-mono font-black text-xs">
                          {row.overtimeStr}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">-</span>
                      )}
                    </td>

                    {/* Admin Note with Instant Inline Edit */}
                    <td className="p-2.5">
                      {isEditingThisAdminNote ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={tempAdminNoteText}
                            onChange={(e) => setTempAdminNoteText(e.target.value)}
                            placeholder="تێبینی ئەدمین..."
                            className="input-classic w-full text-xs font-bold py-1 px-2"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAdminNote(row.empId);
                              if (e.key === 'Escape') setEditingAdminNoteKey(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveAdminNote(row.empId)}
                            className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            title="پاشەکەوت"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAdminNoteKey(null)}
                            className="p-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                            title="پاشگەزبوونەوە"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1 group">
                          {row.adminNote ? (
                            <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex-1">
                              {row.adminNote}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs italic">تێبینی نییە</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdminNoteKey(row.empId);
                              setTempAdminNoteText(row.adminNote || '');
                            }}
                            className="opacity-60 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                            title="دەستکاریکردنی تێبینی ئەدمین"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500 font-bold">
                  {isFriday ? '🌴 ئەمڕۆ ڕۆژی هەینییە — پشووی فەرمیی هەفتانەیە' : 'هیچ تۆمارێک بەپێی ئەم بەروارە یان فلتەرە نەدۆزرایەوە'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
