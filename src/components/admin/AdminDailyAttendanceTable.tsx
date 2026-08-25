'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Shield,
  Trash2
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

  // Edit Time Modal state
  const [editingTimeModal, setEditingTimeModal] = useState<{
    empId: string;
    empName: string;
    targetType: 'in' | 'out';
    currentTime: string;
    originalTime?: string;
    dateStr: string;
  } | null>(null);

  const [newTimeInput, setNewTimeInput] = useState('');
  const [adminReasonInput, setAdminReasonInput] = useState('');
  const [localOverridesVersion, setLocalOverridesVersion] = useState(0);

  // 📋 Excursion Reports (Mid-Day Exits)
  const [showExcursionReportModal, setShowExcursionReportModal] = useState(false);
  const [dailyExcursions, setDailyExcursions] = useState<any[]>([]);
  const [loadingExcursions, setLoadingExcursions] = useState(false);

  const fetchDailyExcursions = useCallback(async (targetDate?: string) => {
    const d = targetDate || selectedDate;
    setLoadingExcursions(true);
    try {
      const res = await fetch(`/api/attendance/excursions?date=${d}`);
      const data = await res.json();
      if (data?.excursions) {
        setDailyExcursions(data.excursions);
      }
    } catch {
      setDailyExcursions([]);
    } finally {
      setLoadingExcursions(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDailyExcursions(selectedDate);
  }, [selectedDate, fetchDailyExcursions]);

  const handleExcursionDecision = async (excursionId: string, decision: 'deduct' | 'count_as_work') => {
    try {
      await fetch('/api/attendance/excursion-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excursionId, date: selectedDate, decision })
      });
      setDailyExcursions(prev => prev.map(item => item.id === excursionId ? { ...item, decision } : item));
    } catch {
      alert('هەڵە لە پاشەکەوتکردنی بڕیار');
    }
  };

  // Listen for local attendance updates
  React.useEffect(() => {
    const handleUpdate = () => {
      setLocalOverridesVersion(v => v + 1);
      fetchDailyExcursions(selectedDate);
    };
    window.addEventListener('ashley_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ashley_attendance_updated', handleUpdate);
  }, [selectedDate, fetchDailyExcursions]);

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

    // 1. Gather all live & prop attendance logs
    let combinedLogs: AttendanceRecord[] = [...attendanceLogs];
    if (typeof window !== 'undefined') {
      try {
        const rawLive = localStorage.getItem('ashley_live_checkins');
        if (rawLive) {
          const liveList = JSON.parse(rawLive);
          if (Array.isArray(liveList)) {
            combinedLogs = [...liveList, ...combinedLogs];
          }
        }
        const rawLocal = localStorage.getItem('ashley_local_attendanceLogs');
        if (rawLocal) {
          const localList = JSON.parse(rawLocal);
          if (Array.isArray(localList)) {
            combinedLogs = [...combinedLogs, ...localList];
          }
        }
      } catch {}
    }

    const rows: DailyReportRow[] = activeEmployees.map((emp, idx) => {
      // 1. Find dynamic logs for this day
      const dayLogs = combinedLogs.filter(l => {
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

      const directRec = dayLogs.find(l => (l as any).checkInTime || (l as any).checkOutTime);
      const inLog = dayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('in') || (l.type || l.action || '').includes('هاتن'));
      const outLog = dayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('out') || (l.type || l.action || '').includes('دەرچوون') || (l.type || l.action || '').includes('ڕۆشتن'));

      // 2. Extract times from dynamic logs or direct unified record
      let checkInTime = (directRec as any)?.checkInTime 
        ? (directRec as any).checkInTime.slice(0, 5)
        : (inLog?.time ? (inLog.time.includes(' ') ? inLog.time.split(' ')[1].slice(0, 5) : inLog.time.slice(0, 5)) : '-');

      let checkOutTime = (directRec as any)?.checkOutTime 
        ? (directRec as any).checkOutTime.slice(0, 5)
        : (outLog?.time ? (outLog.time.includes(' ') ? outLog.time.split(' ')[1].slice(0, 5) : outLog.time.slice(0, 5)) : '-');

      let checkInOriginalTime = inLog?.originalTime || (inLog as any)?.checkInOriginalTime || '';
      let checkOutOriginalTime = outLog?.originalTime || (outLog as any)?.checkOutOriginalTime || '';

      let checkInNote = inLog?.employeeNote || (inLog?.notes?.startsWith('تێبینی کارمەند:') ? inLog.notes.replace('تێبینی کارمەند:', '').trim() : inLog?.notes || '');
      let checkOutNote = outLog?.employeeNote || (outLog?.notes?.startsWith('تێبینی کارمەند:') ? outLog.notes.replace('تێبینی کارمەند:', '').trim() : outLog?.notes || '');

      // Check if this attendance record was deleted by Admin
      let isDeleted = false;
      if (typeof window !== 'undefined') {
        try {
          const rawDel = localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`);
          if (rawDel) {
            const delMap = JSON.parse(rawDel);
            if (delMap[`${emp.id}_${dateStr}`]) isDeleted = true;
          }
        } catch {}
      }

      // Check Local Overrides (manual edits by Admin) (ONLY if NOT explicitly deleted)
      if (!isDeleted && typeof window !== 'undefined') {
        try {
          const rawIn = localStorage.getItem(`ashley_time_override_${emp.id}_${dateStr}_in`);
          if (rawIn) {
            const parsedIn = JSON.parse(rawIn);
            if (parsedIn.time) {
              checkInTime = parsedIn.time;
              checkInOriginalTime = parsedIn.originalTime || checkInOriginalTime || '08:00';
            }
          }
          const rawOut = localStorage.getItem(`ashley_time_override_${emp.id}_${dateStr}_out`);
          if (rawOut) {
            const parsedOut = JSON.parse(rawOut);
            if (parsedOut.time) {
              checkOutTime = parsedOut.time;
              checkOutOriginalTime = parsedOut.originalTime || checkOutOriginalTime || '17:00';
            }
          }
        } catch {}
      }

      if (isDeleted) {
        checkInTime = '-';
        checkOutTime = '-';
        checkInOriginalTime = '';
        checkOutOriginalTime = '';
        checkInNote = '';
        checkOutNote = '';
      }

      // 4. Admin Note (Priority: Props -> LocalStorage)
      const adminNoteKey = `${emp.id}_${dateStr}`;
      let adminNote = adminNotes[adminNoteKey] || '';
      if (!adminNote && typeof window !== 'undefined') {
        try {
          const storedNotes = JSON.parse(localStorage.getItem(`ashley_admin_notes_${selectedMonth}`) || '{}');
          if (storedNotes[adminNoteKey]) {
            adminNote = storedNotes[adminNoteKey];
          }
        } catch {}
      }

      // 5. Holiday & Leave Override (Highest Authority Level)
      let isCompanyHoliday = false;
      let empLeave: any = null;
      if (typeof window !== 'undefined') {
        try {
          const rawH = localStorage.getItem(`ashley_holidays_${selectedMonth}`);
          if (rawH) {
            const hObj = JSON.parse(rawH);
            if (hObj[dateStr]) isCompanyHoliday = true;
          }
          const rawL = localStorage.getItem(`ashley_leaves_${selectedMonth}`);
          if (rawL) {
            const lObj = JSON.parse(rawL);
            if (lObj[adminNoteKey]) empLeave = lObj[adminNoteKey];
          }
        } catch {}
      }

      // 6. Calculate Work Duration and Overtime
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

      // Check In status & Hierarchy Resolution
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

      let finalStatus: 'present' | 'absent' | 'leave' | 'off' = isPresent ? 'present' : isFri ? 'off' : 'absent';
      if (isCompanyHoliday) {
        finalStatus = 'off';
        if (!adminNote) adminNote = '🏖️ پشووی فەرمی کۆمپانیا';
      } else if (empLeave) {
        if (empLeave.type === 'excused') {
          finalStatus = 'leave';
          if (!adminNote) adminNote = `📝 مۆڵەت بە ئاگاداریەوە (${empLeave.note || 'مۆڵەت'})`;
        } else if (empLeave.type === 'unexcused') {
          finalStatus = 'absent';
          if (!adminNote) adminNote = `❌ مۆڵەت بێ ئاگاداری / غیاب (${empLeave.note || 'غیاب'})`;
        } else if (empLeave.type === 'field') {
          finalStatus = 'present';
          if (!adminNote) adminNote = `🚗 لە دەرەوەی کۆمپانیا (${empLeave.note || 'ئەرکی فەرمی'})`;
        } else if (empLeave.type === 'off') {
          finalStatus = 'off';
          if (!adminNote) adminNote = '🏖️ پشوو';
        }
      }

      return {
        index: idx + 1,
        empId: emp.id,
        name: emp.fullName3Part || emp.name,
        role: emp.role || 'کارمەند',
        checkInTime,
        checkInOriginalTime,
        checkInNote,
        checkOutTime,
        checkOutOriginalTime,
        checkOutNote,
        durationStr,
        overtimeStr,
        adminNote,
        status: finalStatus,
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
  }, [selectedDate, activeEmployees, attendanceLogs, adminNotes, localOverridesVersion]);

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
  }, [currentDayData, searchTerm]);

  // Save Inline Admin Note
  const handleSaveAdminNote = (empId: string) => {
    const key = `${empId}_${selectedDate}`;
    const cleanText = tempAdminNoteText.trim();
    if (onUpdateAdminNote) {
      onUpdateAdminNote(key, cleanText);
    }
    if (typeof window !== 'undefined') {
      try {
        const storedAdminNotes = JSON.parse(localStorage.getItem(`ashley_admin_notes_${selectedMonth}`) || '{}');
        if (cleanText) {
          storedAdminNotes[key] = cleanText;
        } else {
          delete storedAdminNotes[key];
        }
        localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(storedAdminNotes));
        window.dispatchEvent(new Event('ashley_attendance_updated'));
      } catch {}
    }
    setEditingAdminNoteKey(null);
    setTempAdminNoteText('');
  };

  // Delete Attendance Record for specific Employee on this date
  const handleDeleteRowAttendance = (empId: string, empName: string) => {
    if (confirm(`ئایا دڵنیایت لە سڕینەوەی دەوامی (${empName}) بۆ ئەم بەروارە (${selectedDate})؟\nبەم کارە سەرجەم کاتەکانی هاتن، ڕۆیشتن، و داتای گۆگڵ شیت دەسڕێنەوە.`)) {
      if (typeof window !== 'undefined') {
        try {
          const delKey = `${empId}_${selectedDate}`;
          const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`) || '{}');
          delMap[delKey] = true;
          localStorage.setItem(`ashley_deleted_attendance_${selectedMonth}`, JSON.stringify(delMap));
          localStorage.removeItem(`ashley_time_override_${empId}_${selectedDate}_in`);
          localStorage.removeItem(`ashley_time_override_${empId}_${selectedDate}_out`);
          window.dispatchEvent(new Event('ashley_attendance_updated'));
        } catch {}
      }
      setLocalOverridesVersion(v => v + 1);
    }
  };

  // Save Time Change from Modal
  const handleSaveTimeModal = () => {
    if (!editingTimeModal) return;
    const { empId, targetType, dateStr, originalTime } = editingTimeModal;
    const cleanTime = newTimeInput.trim();
    if (!cleanTime) {
      alert('تکایە کاتی نوێ دیاری بکە (بۆ نموونە 08:45)');
      return;
    }

    const cleanReason = adminReasonInput.trim();
    if (!cleanReason) {
      alert('تکایە هۆکاری گۆڕینی کات (تێبینی ئەدمین) بنووسە');
      return;
    }

    const adminNoteKey = `${empId}_${dateStr}`;
    const formattedAdminReason = `🛡️ دەستکاریکردنی کاتی ${targetType === 'in' ? 'هاتن' : 'ڕۆیشتن'} بۆ (${cleanTime}): ${cleanReason}`;

    // 1. Update Admin Notes (concatenate if existing notes exist)
    let combinedNote = formattedAdminReason;
    if (typeof window !== 'undefined') {
      try {
        const storedAdminNotes = JSON.parse(localStorage.getItem(`ashley_admin_notes_${selectedMonth}`) || '{}');
        const existing = storedAdminNotes[adminNoteKey] || adminNotes[adminNoteKey] || '';
        if (existing && existing.trim() && !existing.includes(cleanReason)) {
          combinedNote = `${existing.trim()}\n${formattedAdminReason}`;
        }
        storedAdminNotes[adminNoteKey] = combinedNote;
        localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(storedAdminNotes));
      } catch {}
    }
    if (onUpdateAdminNote) {
      onUpdateAdminNote(adminNoteKey, combinedNote);
    }

    // 2. Remove deletion flag if user is explicitly re-adding/editing time
    if (typeof window !== 'undefined') {
      try {
        const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`) || '{}');
        delete delMap[adminNoteKey];
        localStorage.setItem(`ashley_deleted_attendance_${selectedMonth}`, JSON.stringify(delMap));
      } catch {}
    }

    // 3. Update local storage for log overrides
    if (typeof window !== 'undefined') {
      try {
        const overrideKey = `ashley_time_override_${empId}_${dateStr}_${targetType}`;
        localStorage.setItem(overrideKey, JSON.stringify({
          time: cleanTime,
          originalTime: originalTime || (targetType === 'in' ? '08:00' : '17:00'),
          editNote: cleanReason,
        }));
        window.dispatchEvent(new Event('ashley_attendance_updated'));
      } catch {}
    }

    setEditingTimeModal(null);
    setLocalOverridesVersion(v => v + 1);
  };

  // 🗑️ Wipe All Attendance Data
  const handleWipeAllAttendanceData = async () => {
    if (!confirm('⚠️ ئایا دڵنیایت لە سڕینەوەی سەرجەم داتاکانی ئامادەبوون، مۆڵەتەکان، غیاب و پشووەکان؟ ئەم کارە داتابەیسی سێرڤەر و خشتەکان بە تەواوی پاک دەکاتەوە.')) return;
    
    try {
      await fetch('/api/attendance/reset-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipeAll: true })
      });
    } catch (e) {
      console.warn('Wipe server attendance error:', e);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ashley_local_attendanceLogs');
        localStorage.removeItem('ashley_live_checkins');
        localStorage.removeItem('ashley_local_overtime');
        localStorage.removeItem(`ashley_leaves_${selectedMonth}`);
        localStorage.removeItem(`ashley_holidays_${selectedMonth}`);
        localStorage.removeItem('ashley_leaves_2026-08');
        localStorage.removeItem('ashley_holidays_2026-08');
        localStorage.removeItem(`ashley_admin_notes_${selectedMonth}`);
        localStorage.removeItem(`ashley_ot_notes_${selectedMonth}`);
        Object.keys(localStorage).forEach(k => {
          if (
            k.startsWith('ashley_leaves_') ||
            k.startsWith('ashley_holidays_') ||
            k.startsWith('ashley_deleted_attendance_') ||
            k.startsWith('ashley_time_override_')
          ) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    alert('✅ سەرجەم داتاکانی ئامادەبوون و تۆمارەکان بە سەرکەوتوویی سڕانەوە.');
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

  // 🔄 Google Sheets Clean Export
  const handleSyncGoogleSheet = () => {
    handleExportMonthCSV();
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
          
          {/* 📋 Mid-Day Excursion Reviews */}
          <button
            type="button"
            onClick={() => {
              fetchDailyExcursions(selectedDate);
              setShowExcursionReportModal(true);
            }}
            className="btn-classic text-xs font-black px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 border border-amber-300 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            title="بینینی لیستی دەرچوونی کاتی کارمەندان و لێبڕین یان حیسابکردنی دەوام"
          >
            <Clock className="w-3.5 h-3.5 text-slate-950" />
            <span>📋 دەرچوونە کاتییەکان</span>
            {dailyExcursions.length > 0 && (
              <span className="bg-slate-950 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-black">
                {dailyExcursions.length}
              </span>
            )}
          </button>

          {/* 🗑️ Wipe All Attendance Data Button */}
          <button
            type="button"
            onClick={handleWipeAllAttendanceData}
            className="btn-classic text-xs font-black px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white border border-rose-400 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            title="سڕینەوەی سەرجەم داتاکانی ئامادەبوون لە سێرڤەر و پاککردنەوەی تەواوی خشتەکە"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
            <span>🗑️ سڕینەوەی سەرجەم داتاکان (Wipe All)</span>
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
              <th className="p-2.5 w-44">💬 تێبینی کارمەند (هاتن)</th>
              <th className="p-2.5 text-center w-28">📤 ڕۆیشتن</th>
              <th className="p-2.5 w-44">💬 تێبینی کارمەند (ڕۆیشتن / ئیزافە)</th>
              <th className="p-2.5 text-center w-24">⏱️ دەوام</th>
              <th className="p-2.5 text-center w-24">⚡ ئیزافە</th>
              <th className="p-2.5">🛡️ تێبینی ئەدمین (دەستکاریکردن و هۆکارەکان)</th>
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
                      <div className="flex flex-col items-center justify-center gap-1">
                        {row.checkInTime !== '-' ? (
                          <div className="flex flex-col items-center">
                            {row.checkInOriginalTime ? (
                              <>
                                <span className="line-through text-rose-500 font-bold font-mono text-[10px] block">
                                  {row.checkInOriginalTime}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs inline-flex items-center gap-1 shadow-xs">
                                  📥 {inBadge.formattedTime}
                                </span>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 font-mono font-black text-xs inline-block">
                                📥 {inBadge.formattedTime}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono font-bold">-</span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingTimeModal({
                              empId: row.empId,
                              empName: row.name,
                              targetType: 'in',
                              currentTime: row.checkInTime !== '-' ? row.checkInTime : '08:00',
                              originalTime: row.checkInOriginalTime || (row.checkInTime !== '-' ? row.checkInTime : '08:00'),
                              dateStr: selectedDate,
                            });
                            setNewTimeInput(row.checkInTime !== '-' ? row.checkInTime : '08:00');
                            setAdminReasonInput('');
                          }}
                          className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-all flex items-center gap-0.5 font-bold cursor-pointer"
                          title="گۆڕینی کاتی هاتن و نووسینی هۆکارەکەی لە تێبینی ئەدمین"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>گۆڕین</span>
                        </button>
                      </div>
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
                      <div className="flex flex-col items-center justify-center gap-1">
                        {row.checkOutTime !== '-' ? (
                          <div className="flex flex-col items-center">
                            {row.checkOutOriginalTime ? (
                              <>
                                <span className="line-through text-rose-500 font-bold font-mono text-[10px] block">
                                  {row.checkOutOriginalTime}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white font-mono font-black text-xs inline-flex items-center gap-1 shadow-xs">
                                  📤 {outBadge.formattedTime}
                                </span>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-950 border border-sky-300 font-mono font-black text-xs inline-block">
                                📤 {outBadge.formattedTime}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono font-bold">-</span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingTimeModal({
                              empId: row.empId,
                              empName: row.name,
                              targetType: 'out',
                              currentTime: row.checkOutTime !== '-' ? row.checkOutTime : '17:00',
                              originalTime: row.checkOutOriginalTime || (row.checkOutTime !== '-' ? row.checkOutTime : '17:00'),
                              dateStr: selectedDate,
                            });
                            setNewTimeInput(row.checkOutTime !== '-' ? row.checkOutTime : '17:00');
                            setAdminReasonInput('');
                          }}
                          className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-sky-800 hover:bg-sky-50 rounded transition-all flex items-center gap-0.5 font-bold cursor-pointer"
                          title="گۆڕینی کاتی دەرچوون و نووسینی هۆکارەکەی لە تێبینی ئەدمین"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>گۆڕین</span>
                        </button>
                      </div>
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

                    {/* Admin Note Column (Supports Multiple Notes & Direct Delete) */}
                    <td className="p-2.5 border-l border-slate-200">
                      {isEditingThisAdminNote ? (
                        <div className="flex items-center gap-1.5">
                          <textarea
                            autoFocus
                            rows={2}
                            value={tempAdminNoteText}
                            onChange={(e) => setTempAdminNoteText(e.target.value)}
                            placeholder="تێبینی ئەدمین بنووسە..."
                            className="input-classic w-full text-xs font-bold py-1 px-2"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveAdminNote(row.empId)}
                              className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                              title="پاشەکەوت"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAdminNoteKey(null)}
                              className="p-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                              title="پاشگەزبوونەوە"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-1.5 group">
                          {row.adminNote ? (
                            <div className="flex flex-col gap-1 text-xs font-bold text-amber-950 flex-1">
                              {row.adminNote.split('\n').filter(Boolean).map((noteLine, nIdx) => (
                                <div key={nIdx} className="flex items-start gap-1.5 bg-amber-50/95 px-2.5 py-1 rounded-xl border border-amber-300 shadow-xs">
                                  <Shield className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">{noteLine}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-xs italic">تێبینی نییە</span>
                          )}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdminNoteKey(row.empId);
                                setTempAdminNoteText(row.adminNote || '');
                              }}
                              className="opacity-60 group-hover:opacity-100 p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="دەستکاریکردنی تێبینی ئەدمین"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRowAttendance(row.empId, row.name)}
                              className="opacity-60 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="سڕینەوەی ئەم دەوامە (هەموو کات و داتای شیت دەسڕێتەوە)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </button>
                          </div>
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

      {/* 🛠️ MODAL FOR EDITING ATTENDANCE TIME & WRITING ADMIN NOTE */}
      {editingTimeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/10 text-amber-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black">
                    گۆڕینی کاتی {editingTimeModal.targetType === 'in' ? 'هاتن (Check-In)' : 'ڕۆیشتن (Check-Out)'}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-bold">
                    بۆ کارمەند: {editingTimeModal.empName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTimeModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs font-bold text-slate-800">
              <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>کاتی کۆن (سەرەتایی):</span>
                  <span className="font-mono font-bold line-through text-rose-600">
                    {editingTimeModal.originalTime || editingTimeModal.currentTime}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>بەرواری تۆمار:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {editingTimeModal.dateStr}
                  </span>
                </div>
              </div>

              {/* New Time Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>کاتی نوێی دروست دیاری بکە (سەعات:خولەک):</span>
                </label>
                <input
                  type="time"
                  value={newTimeInput}
                  onChange={(e) => setNewTimeInput(e.target.value)}
                  className="input-classic w-full text-base font-black text-center font-mono py-2 bg-emerald-50/50 border-emerald-300 focus:border-emerald-500 rounded-xl"
                />
              </div>

              {/* Admin Reason Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>هۆکاری گۆڕانکاری (تێبینی ئەدمین کە لە خشتەکە دەردەکەوێت):</span>
                </label>
                <textarea
                  rows={3}
                  value={adminReasonInput}
                  onChange={(e) => setAdminReasonInput(e.target.value)}
                  placeholder="بۆ نموونە: لەدەرەوەی کۆمپانیا لە ئەرک بوو، مۆڵەتی پێدرابوو، یان دواکەوت بەهۆی چاککردنەوە..."
                  className="input-classic w-full text-xs font-bold p-2.5 rounded-xl border-amber-300 focus:border-amber-500 bg-amber-50/40"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingTimeModal(null)}
                className="btn-classic text-xs px-4 py-2 cursor-pointer"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={handleSaveTimeModal}
                className="btn-classic-primary text-xs px-5 py-2 flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black cursor-pointer shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>پاشەکەوتکردنی کات و تێبینی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📋 MODAL: DAILY EXCURSIONS REPORT & ADMIN DECISION */}
      {/* ========================================================================= */}
      {showExcursionReportModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border-2 border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-600 to-orange-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-2xl">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black">ڕاپۆرتی دەرچوونی کاتی کارمەندان (Excursions)</h3>
                  <p className="text-xs text-amber-100 font-bold">بۆ بەرواری ({selectedDate})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExcursionReportModal(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {loadingExcursions ? (
                <div className="text-center py-10 text-slate-500 font-bold text-sm">
                  خەریکی بارکردنی داتاکان... ⏳
                </div>
              ) : dailyExcursions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <span className="text-3xl block">✨</span>
                  <span className="text-sm font-black text-slate-800">هیچ دەرچوونێکی کاتی لەم ڕۆژەدا تۆمار نەکراوە!</span>
                  <p className="text-xs text-slate-500 font-bold">سەرجەم کارمەندان بە بەردەوامی لەناو لۆکەیشنی کۆمپانیا بوون.</p>
                </div>
              ) : (
                dailyExcursions.map((item, idx) => {
                  const isDeducted = item.decision === 'deduct';
                  return (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-amber-400 transition-all space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 text-sm">{item.userName || 'کارمەند'}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs font-black">
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-lg border border-rose-200">
                            چوونە دەرەوە: {item.exitTime || '--:--'}
                          </span>
                          <span>⬅️</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-200">
                            گەڕانەوە: {item.returnTime || '--:--'}
                          </span>
                        </div>
                      </div>

                      {/* Employee Note / Reason */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 font-bold flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[11px] text-slate-500 font-black block">هۆکاری نووسراوی کارمەند:</span>
                          <span className="text-slate-900">{item.note || 'هیچ هۆکارێک نەنووسراوە'}</span>
                        </div>
                      </div>

                      {/* Admin Decision Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-xs font-black text-slate-600">بڕیاری ئەدمین:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExcursionDecision(item.id, 'deduct')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                              isDeducted
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                                : 'bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-800'
                            }`}
                          >
                            <span>🔴 لێبڕین (Deduct)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcursionDecision(item.id, 'count_as_work')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                              !isDeducted
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                                : 'bg-slate-200 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800'
                            }`}
                          >
                            <span>🟢 حیسابکردنی دەوام</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-600">
              <span>💡 دەتوانیت بۆ هەر دەرچوونێک لێبڕین یان حیسابکردن دیاری بکەیت.</span>
              <button
                type="button"
                onClick={() => setShowExcursionReportModal(false)}
                className="btn-classic text-xs px-5 py-2 cursor-pointer bg-slate-800 text-white hover:bg-slate-900 rounded-xl"
              >
                داخستن
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
