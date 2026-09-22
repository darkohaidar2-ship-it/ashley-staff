'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  Trash2,
  ExternalLink
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
import { 
  resolveEmployeeDayAttendance, 
  getCheckInStatus, 
  getCheckOutStatus 
} from '@/lib/attendance-helpers';

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
  selectedMonth: propSelectedMonth,
}: AdminDailyAttendanceTableProps) {
  // Always default to current date (Today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  // Dynamically derive active month from selected date
  const activeMonth = useMemo(() => selectedDate.slice(0, 7), [selectedDate]);
  const selectedMonth = activeMonth;

  const [searchTerm, setSearchTerm] = useState('');
  const [editingAdminNoteKey, setEditingAdminNoteKey] = useState<string | null>(null);
  const [tempAdminNoteText, setTempAdminNoteText] = useState('');

  // Enhanced Edit Time & Status Modal state (Unified Check-In & Check-Out)
  const [editingTimeModal, setEditingTimeModal] = useState<{
    empId: string;
    empName: string;
    targetType: 'in' | 'out';
    checkInTime: string;
    checkOutTime: string;
    status: string;
    dateStr: string;
    isWaived: boolean;
  } | null>(null);

  const [modalCheckIn, setModalCheckIn] = useState('08:00');
  const [modalCheckOut, setModalCheckOut] = useState('');
  const [modalStatus, setModalStatus] = useState('Present');
  const [modalIsWaived, setModalIsWaived] = useState(false);
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

  // 31-Day Matrix Overrides Map (Shared Single Source of Truth)
  const [matrixOverrides, setMatrixOverrides] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`ashley_matrix_overrides_${activeMonth}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {};
  });

  const loadMatrixOverrides = useCallback(async () => {
    try {
      let localMap: Record<string, any> = {};
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`ashley_matrix_overrides_${activeMonth}`);
          if (cached) localMap = JSON.parse(cached);
        } catch {}
      }

      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = { ...localMap };
        (data.attendance || []).forEach((r: any) => {
          if (r.status && r.status !== 'empty' && r.status !== 'delete' && r.status !== 'Empty') {
            const checkInTime = r.checkInTime || r.check_in_time || '';
            const checkOutTime = r.checkOutTime || r.check_out_time || '';
            const rawCheckIn = r.rawCheckInTime || r.raw_check_in_time || r.rawCheckIn || checkInTime;
            const rawCheckOut = r.rawCheckOutTime || r.raw_check_out_time || r.rawCheckOut || checkOutTime;
            const rawNote = r.note || r.notes || r.reason || r.employeeNote || r.edit_note || r.editNote || '';
            let cleanNote = rawNote;
            if (typeof cleanNote === 'string' && cleanNote.includes('): ')) {
              cleanNote = cleanNote.split('): ')[1] || cleanNote;
            }
            const checkInNote = r.check_in_edit_note || r.check_in_note || r.checkInNote || cleanNote || '';
            const checkOutNote = r.check_out_edit_note || r.check_out_note || r.checkOutNote || '';
            const note = cleanNote || checkInNote || '';
            const adminNote = r.adminNote || r.admin_note || r.editNote || '';
            const adminCheckInNote = r.adminCheckInNote || r.admin_check_in_note || adminNote || '';
            const adminCheckOutNote = r.adminCheckOutNote || r.admin_check_out_note || '';
            const adminDecision = r.adminDecision || null;
            const adminCheckInDecision = r.adminCheckInDecision || null;
            const adminCheckOutDecision = r.adminCheckOutDecision || null;
            const isCheckInWaived = Boolean(r.isCheckInWaived ?? (adminCheckInDecision === 'waived'));
            const isCheckOutWaived = Boolean(r.isCheckOutWaived ?? (adminCheckOutDecision === 'waived'));
            const isWaived = Boolean(r.isWaived ?? (adminDecision === 'waived') ?? (isCheckInWaived || isCheckOutWaived));

            const recordObj = {
              status: r.status,
              checkInTime,
              checkOutTime,
              rawCheckIn,
              rawCheckOut,
              note,
              checkInNote,
              checkOutNote,
              adminNote,
              adminCheckInNote,
              adminCheckOutNote,
              adminDecision,
              adminCheckInDecision,
              adminCheckOutDecision,
              isWaived,
              isCheckInWaived,
              isCheckOutWaived,
              historyLogs: r.historyLogs || [],
            };

            const cleanEmpId = (r.userId || '').toString().trim();
            const rawNum = cleanEmpId.replace(/^emp-0*/i, '');
            map[`${cleanEmpId}_${r.date}`] = recordObj;
            map[`${cleanEmpId.toLowerCase()}_${r.date}`] = recordObj;
            if (rawNum) {
              map[`${rawNum}_${r.date}`] = recordObj;
              map[`emp-${rawNum}_${r.date}`] = recordObj;
              map[`emp-${rawNum.padStart(2, '0')}_${r.date}`] = recordObj;
            }
            if (r.userName) {
              map[`${r.userName.trim().toLowerCase()}_${r.date}`] = recordObj;
            }
          }
        });
        setMatrixOverrides(map);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`ashley_matrix_overrides_${activeMonth}`, JSON.stringify(map));
          } catch {}
        }
      } else if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    } catch {}
  }, [activeMonth]);

  useEffect(() => {
    loadMatrixOverrides();
  }, [loadMatrixOverrides]);

  React.useEffect(() => {
    const handleUpdate = () => {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`ashley_matrix_overrides_${activeMonth}`);
          if (cached) {
            setMatrixOverrides(JSON.parse(cached));
          }
        } catch {}
      }
      setLocalOverridesVersion(v => v + 1);
      fetchDailyExcursions(selectedDate);
    };
    window.addEventListener('ashley_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ashley_attendance_updated', handleUpdate);
  }, [selectedDate, fetchDailyExcursions, activeMonth]);

  // Active Employees only
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Gather all live & prop attendance logs
  const allCombinedLogs = useMemo(() => {
    let list: AttendanceRecord[] = [...attendanceLogs];
    if (typeof window !== 'undefined') {
      try {
        const rawLive = localStorage.getItem('ashley_live_checkins');
        if (rawLive) {
          const liveList = JSON.parse(rawLive);
          if (Array.isArray(liveList)) list = [...liveList, ...list];
        }
        const rawLocal = localStorage.getItem('ashley_local_attendanceLogs');
        if (rawLocal) {
          const localList = JSON.parse(rawLocal);
          if (Array.isArray(localList)) list = [...list, ...localList];
        }
      } catch {}
    }
    return list;
  }, [attendanceLogs, localOverridesVersion]);

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

  const [yearStr, monthStr] = activeMonth.split('-');
  const yearNum = parseInt(yearStr || '2026', 10);
  const monthNum = parseInt(monthStr || '09', 10);
  const totalDaysInMonth = useMemo(() => getDaysInMonth(new Date(yearNum, monthNum - 1, 1)), [yearNum, monthNum]);

  // 📈 Calculate Monthly Overtime Sum for every active employee (> 8 hours rule)
  const empMonthlyOvertimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    activeEmployees.forEach(emp => {
      let totalOt = 0;
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dStr = d < 10 ? `0${d}` : `${d}`;
        const dayDateStr = `${activeMonth}-${dStr}`;
        const dateObj = new Date(yearNum, monthNum - 1, d);
        const dWeek = getDay(dateObj);
        const isFri = dWeek === 5;
        const isFut = dayDateStr > todayStr;
        const isTod = dayDateStr === todayStr;

        const resolved = resolveEmployeeDayAttendance(
          emp,
          { dayNum: d, dateStr: dayDateStr, isFriday: isFri, isFuture: isFut, isToday: isTod },
          matrixOverrides,
          allCombinedLogs
        );

        if (resolved.status === 'Present' && resolved.workedHours > 8) {
          totalOt += (resolved.workedHours - 8);
        }
      }
      map[emp.id] = parseFloat(totalOt.toFixed(1));
    });
    return map;
  }, [activeEmployees, totalDaysInMonth, activeMonth, yearNum, monthNum, matrixOverrides, allCombinedLogs]);

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

  // Helper to get day data for any specific date — unified with 31-day Matrix Table!
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
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    let presentCount = 0;
    let lateCount = 0;
    let overtimeCount = 0;
    let totalOvertimeHours = 0;

    const rows: DailyReportRow[] = activeEmployees.map((emp, idx) => {
      const dayItem = {
        dayNum: dNum,
        dateStr,
        isFriday: isFri,
        isFuture: dateStr > todayStr,
        isToday: dateStr === todayStr,
      };

      const resolved = resolveEmployeeDayAttendance(emp, dayItem, matrixOverrides, allCombinedLogs);

      const checkInTime = resolved.checkInTime ? resolved.checkInTime.slice(0, 5) : '-';
      const checkOutTime = resolved.checkOutTime ? resolved.checkOutTime.slice(0, 5) : '-';
      const checkInOriginalTime = (resolved.rawCheckIn && resolved.rawCheckIn.slice(0, 5) !== checkInTime) ? resolved.rawCheckIn.slice(0, 5) : '';
      const checkOutOriginalTime = (resolved.rawCheckOut && resolved.rawCheckOut.slice(0, 5) !== checkOutTime) ? resolved.rawCheckOut.slice(0, 5) : '';

      const checkInNote = resolved.checkInNote || '';
      const checkOutNote = resolved.checkOutNote || '';
      const adminNote = resolved.adminNote || adminNotes[`${emp.id}_${dateStr}`] || '';

      let durationStr = '-';
      let overtimeStr = '-';
      let dailyOtHours = 0;

      const isOngoing = !checkOutTime || checkOutTime === '-' || checkOutTime.startsWith('بەرد');

      if (resolved.status === 'Present' && checkInTime !== '-' && !isOngoing) {
        durationStr = `${resolved.workedHours} کاتژمێر`;
        if (resolved.workedHours > 8) {
          dailyOtHours = parseFloat((resolved.workedHours - 8).toFixed(1));
          overtimeStr = `+${dailyOtHours} کاتژمێر`;
        }
      } else if (resolved.status === 'Present' && checkInTime !== '-') {
        durationStr = 'بەردەوام';
      }

      if (resolved.status === 'Present' && checkInTime !== '-') presentCount++;
      if (resolved.checkInStatus?.isLate && !resolved.checkInStatus?.isWaived) lateCount++;
      if (dailyOtHours > 0) {
        overtimeCount++;
        totalOvertimeHours += dailyOtHours;
      }

      let rowStatus: 'present' | 'absent' | 'off' | 'future' | 'leave' = 'absent';
      if (isFri) rowStatus = 'off';
      else if (dateStr > todayStr) rowStatus = 'future';
      else if (resolved.status === 'Leave' || resolved.status === 'مۆڵەت') rowStatus = 'leave';
      else if (resolved.status === 'Present' || checkInTime !== '-') rowStatus = 'present';

      const monthlyOt = empMonthlyOvertimeMap[emp.id] || 0;

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
        monthlyOvertimeStr: monthlyOt > 0 ? `${monthlyOt} کاتژمێر` : '-',
        monthlyOvertimeHours: monthlyOt,
        adminNote,
        status: rowStatus,
        isWaived: resolved.isWaived,
      };
    });

      const totalAllMonthlyOvertime = activeEmployees.reduce((sum, emp) => sum + (empMonthlyOvertimeMap[emp.id] || 0), 0);

      return {
        rows,
        summary: {
          totalEmployees: activeEmployees.length,
          presentCount,
          lateCount,
          overtimeCount,
          totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(1)),
          totalMonthlyOvertimeHours: parseFloat(totalAllMonthlyOvertime.toFixed(1)),
        },
      };
  };

  // Current selected day data
  const currentDayData = useMemo(() => {
    return computeDayRows(selectedDate);
  }, [selectedDate, activeEmployees, matrixOverrides, allCombinedLogs, adminNotes, empMonthlyOvertimeMap]);

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
  const handleSaveAdminNote = async (empId: string) => {
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
      } catch {}
    }

    // Sync to matrix overrides & cloud
    const existing = matrixOverrides[key] || {};
    const updated = {
      ...existing,
      adminNote: cleanText,
    };
    const nextMap = { ...matrixOverrides, [key]: updated };
    setMatrixOverrides(nextMap);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(nextMap));
      } catch {}
    }

    try {
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: [{
            userId: empId,
            date: selectedDate,
            adminNote: cleanText,
          }]
        })
      });
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    setEditingAdminNoteKey(null);
    setTempAdminNoteText('');
  };

  // Delete Attendance Record for specific Employee on this date - 0ms Instant Reaction & Permanent Server Sync
  const handleDeleteRowAttendance = (empId: string, empName: string) => {
    if (confirm(`ئایا دڵنیایت لە سڕینەوەی دەوامی (${empName}) بۆ ئەم بەروارە (${selectedDate})؟\nبەم کارە سەرجەم کاتەکانی هاتن، ڕۆیشتن، و داتای دەوامی ئەم ڕۆژە بە تەواوی دەسڕێنەوە.`)) {
      const cleanEmpId = (empId || '').toString().trim();
      const rawNum = cleanEmpId.replace(/^emp-0*/i, '') || cleanEmpId.replace('emp-', '');
      const rawNumPadded = rawNum.length === 1 ? `0${rawNum}` : rawNum;
      const cleanName = (empName || '').trim();

      const allKeys = [
        `${cleanEmpId}_${selectedDate}`,
        `${rawNum}_${selectedDate}`,
        `${rawNumPadded}_${selectedDate}`,
        `emp-${rawNum}_${selectedDate}`,
        `emp-${rawNumPadded}_${selectedDate}`,
      ];
      if (cleanName) {
        allKeys.push(`${cleanName.toLowerCase()}_${selectedDate}`);
      }

      const tombstone = {
        status: 'empty',
        action: 'delete',
        deletedAt: new Date().toISOString(),
        userId: cleanEmpId,
        userName: cleanName,
        date: selectedDate
      };

      // 1. Update matrixOverrides state immediately
      setMatrixOverrides(prev => {
        const next = { ...prev };
        allKeys.forEach(k => {
          next[k] = tombstone;
        });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`ashley_matrix_overrides_${activeMonth}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // 2. Purge cached live logs from browser storage
      if (typeof window !== 'undefined') {
        try {
          const purgeLogs = (storageKey: string) => {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const filtered = list.filter((l: any) => {
                  const lDate = l.date || l.log_date || (l.time ? l.time.split(' ')[0] : l.createdAt?.split('T')[0]);
                  if (lDate !== selectedDate) return true;
                  const lEmp = (l.employeeId || l.userId || '').toString().trim().toLowerCase();
                  const lName = (l.employeeName || l.userName || l.name || '').toString().trim().toLowerCase();
                  if (lEmp === cleanEmpId.toLowerCase() || lEmp === rawNum || lEmp === rawNumPadded || lEmp === `emp-${rawNum}` || lEmp === `emp-${rawNumPadded}`) return false;
                  if (cleanName && (lName === cleanName.toLowerCase() || lName.includes(cleanName.toLowerCase()))) return false;
                  return true;
                });
                localStorage.setItem(storageKey, JSON.stringify(filtered));
              }
            } catch {}
          };

          purgeLogs('ashley_live_checkins');
          purgeLogs('ashley_local_attendanceLogs');
          purgeLogs('ashley_sb_attendanceLogs');

          window.dispatchEvent(new CustomEvent('ashley_attendance_deleted', {
            detail: { empId: cleanEmpId, dateStr: selectedDate, name: cleanName }
          }));
          window.dispatchEvent(new Event('ashley_attendance_updated'));
        } catch {}
      }

      setLocalOverridesVersion(v => v + 1);

      // 3. Background server & Supabase persistent delete
      void fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: [{
            userId: cleanEmpId,
            userName: cleanName,
            date: selectedDate,
            action: 'delete',
            status: 'empty'
          }]
        })
      }).catch(err => console.error('Error deleting daily attendance row:', err));
    }
  };

  // Save Time Change from Modal - 0ms INSTANT REACTION
  const handleSaveTimeModal = () => {
    if (!editingTimeModal) return;
    const { empId, empName, dateStr } = editingTimeModal;
    const cleanIn = modalCheckIn.trim();
    const cleanOut = modalCheckOut.trim();
    const cleanReason = adminReasonInput.trim();

    const adminNoteKey = `${empId}_${dateStr}`;
    let formattedAdminReason = cleanReason;
    if (cleanReason) {
      formattedAdminReason = `🛡️ دەستکاری ئەدمین (${cleanIn || '-'} تا ${cleanOut || '-'}): ${cleanReason}`;
    }

    // 1. Update Admin Notes (concatenate if existing notes exist)
    let combinedNote = formattedAdminReason;
    if (typeof window !== 'undefined') {
      try {
        const storedAdminNotes = JSON.parse(localStorage.getItem(`ashley_admin_notes_${activeMonth}`) || '{}');
        const existing = storedAdminNotes[adminNoteKey] || adminNotes[adminNoteKey] || '';
        if (existing && existing.trim() && cleanReason && !existing.includes(cleanReason)) {
          combinedNote = `${existing.trim()}\n${formattedAdminReason}`;
        }
        if (combinedNote) {
          storedAdminNotes[adminNoteKey] = combinedNote;
          localStorage.setItem(`ashley_admin_notes_${activeMonth}`, JSON.stringify(storedAdminNotes));
        }
      } catch {}
    }
    if (onUpdateAdminNote && combinedNote) {
      onUpdateAdminNote(adminNoteKey, combinedNote);
    }

    // 2. Remove deletion flag if user is explicitly re-adding/editing time
    if (typeof window !== 'undefined') {
      try {
        const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${activeMonth}`) || '{}');
        delete delMap[adminNoteKey];
        localStorage.setItem(`ashley_deleted_attendance_${activeMonth}`, JSON.stringify(delMap));
      } catch {}
    }

    // 3. Update ashley_matrix_overrides_${activeMonth} INSTANTLY
    const existingOverride = matrixOverrides[adminNoteKey] || {};
    const updatedOverride = {
      ...existingOverride,
      status: modalStatus,
      checkInTime: modalStatus === 'Present' ? (cleanIn || '08:00') : modalStatus === 'Leave' ? 'مۆڵەت' : '',
      checkOutTime: modalStatus === 'Present' ? (cleanOut || '') : modalStatus === 'Leave' ? 'مۆڵەت' : '',
      rawCheckIn: existingOverride.rawCheckIn || cleanIn || '08:00',
      rawCheckOut: existingOverride.rawCheckOut || cleanOut || '',
      adminNote: combinedNote || existingOverride.adminNote || '',
      adminCheckInNote: cleanReason || existingOverride.adminCheckInNote || undefined,
      adminCheckOutNote: cleanReason || existingOverride.adminCheckOutNote || undefined,
      isWaived: modalIsWaived,
      isCheckInWaived: modalIsWaived,
      isCheckOutWaived: modalIsWaived,
      adminDecision: modalIsWaived ? 'waived' : null,
    };

    const nextOverrides = { ...matrixOverrides, [adminNoteKey]: updatedOverride };
    const rawNum = empId.replace(/^emp-0*/i, '');
    if (rawNum) {
      nextOverrides[`${rawNum}_${dateStr}`] = updatedOverride;
      nextOverrides[`emp-${rawNum}_${dateStr}`] = updatedOverride;
      nextOverrides[`emp-${rawNum.padStart(2, '0')}_${dateStr}`] = updatedOverride;
    }
    if (empName) {
      nextOverrides[`${empName.trim().toLowerCase()}_${dateStr}`] = updatedOverride;
    }

    setMatrixOverrides(nextOverrides);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`ashley_matrix_overrides_${activeMonth}`, JSON.stringify(nextOverrides));
      } catch {}
    }

    // Close modal IMMEDIATELY (0ms instant response)
    setEditingTimeModal(null);
    setLocalOverridesVersion(v => v + 1);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }

    // 4. Background non-blocking persistent server sync
    void fetch('/api/attendance/admin/manual-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: [{
          userId: empId,
          userName: empName,
          date: dateStr,
          status: updatedOverride.status,
          checkInTime: updatedOverride.checkInTime || undefined,
          checkOutTime: updatedOverride.checkOutTime || undefined,
          adminNote: combinedNote || undefined,
          isWaived: modalIsWaived,
          adminDecision: modalIsWaived ? 'waived' : null,
        }]
      })
    }).catch(err => {
      console.warn('Background sync warning:', err);
    });
  };

  // 🗑️ Wipe All Attendance Data
  const handleWipeAllAttendanceData = async () => {
    if (!confirm('⚠️ ئایا دڵنیایت لە سڕینەوەی سەرجەم داتاکانی ئامادەبوون، مۆڵەتەکان، غیاب و پشووەکان؟ ئەم کارە داتابەیسی سێرڤەر و خشتەکان بە تەواوی پاک دەکاتەوە.')) return;
    
    try {
      await fetch('/api/attendance/reset-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-wipe-confirm': 'CONFIRMED_WIPE_ALL' },
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
      { header: '⚡ ئیزافەی ڕۆژ', key: 'overtimeStr', align: 'center', width: '75px' },
      { header: '📊 کۆی ئیزافەی مانگ', key: 'monthlyOvertimeStr', align: 'center', width: '85px' },
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
      { header: 'ئیزافەی ڕۆژ', key: 'overtimeStr' },
      { header: 'کۆی ئیزافەی مانگ', key: 'monthlyOvertimeStr' },
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
          monthlyOvertime: r.monthlyOvertimeStr || '-',
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
      { header: 'ئیزافەی ڕۆژ', key: 'overtime' },
      { header: 'کۆی ئیزافەی مانگ', key: 'monthlyOvertime' },
      { header: 'تێبینی ئەدمین', key: 'adminNote' },
    ];

    exportToCSV(cols, allRows, `Ashley_Full_Month_Daily_${selectedMonth}`);
  };

  // 🔄 Google Sheets Clean Export
  const handleSyncGoogleSheet = () => {
    handleExportMonthCSV();
  };

  return (
    <div className="space-y-4 font-sans select-none" dir="rtl">
      
      {/* 🍏 Apple iOS Glassmorphic Top Controls Bar */}
      <div className="bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[24px] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Date Navigator - Apple Segmented Pill */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#3a3a3c] p-1 rounded-full border border-slate-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={handlePrevDay}
            className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="ڕۆژی پێشوو"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1">
            <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
            />
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25">
              {dayName}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="w-8 h-8 rounded-full hover:bg-white dark:hover:bg-white/10 text-slate-700 dark:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="ڕۆژی دواتر"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-bold px-3 py-1.5 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white rounded-full shadow-xs hover:bg-slate-50 transition-all cursor-pointer active:scale-95 border border-slate-200/60 dark:border-white/10"
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
            className="px-3.5 py-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300/60 dark:border-amber-700/40 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title="بینینی لیستی دەرچوونی کاتی کارمەندان"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>دەرچوونە کاتییەکان</span>
            {dailyExcursions.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {dailyExcursions.length}
              </span>
            )}
          </button>


          {/* 🖨️ Print Single Day */}
          <button
            type="button"
            onClick={handlePrintSingleDayPDF}
            className="h-8 w-8 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white flex items-center justify-center shadow-2xs transition-all active:scale-90 cursor-pointer"
            title="پرێنتکردنی داتای ئەمڕۆ (Print Day PDF)"
            aria-label="Print Day PDF"
          >
            <Printer className="w-4 h-4 text-white" />
          </button>

          {/* 🖨️ 31-PAGE FULL MONTH MULTI-PAGE PDF */}
          <button
            type="button"
            onClick={handlePrint31DayMonthPDF}
            className="h-8 px-3 rounded-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-90 cursor-pointer"
            title="پرێنتی گشتی ۳۱ ڕۆژ (۳۱ لاپەڕە)"
            aria-label="Print 31-Day Month PDF"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>۳۱ لاپەڕە</span>
          </button>

          {/* 📊 Day CSV */}
          <button
            type="button"
            onClick={handleExportDayCSV}
            className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/40 flex items-center justify-center cursor-pointer transition-all active:scale-90 shadow-2xs"
            title="داگرتنی CSV بۆ ئەمڕۆ"
            aria-label="CSV Day"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          {/* 📊 Month CSV */}
          <button
            type="button"
            onClick={handleExportMonthCSV}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white flex items-center justify-center cursor-pointer transition-all active:scale-90 border border-slate-200/80 dark:border-white/10 shadow-2xs"
            title="داگرتنی CSV بۆ تەواوی مانگ"
            aria-label="CSV Month"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>

        </div>

      </div>

      {/* 📊 Apple Style Daily Summary KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[22px] p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">کۆی کارمەندانی چالاک</div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {currentDayData.summary.totalEmployees} <span className="text-xs text-slate-400 font-medium">کەس</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[22px] p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">ئامادەبووانی ئەم ڕۆژە</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {currentDayData.summary.presentCount} <span className="text-xs text-slate-400 font-medium">کەس</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[22px] p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">دواکەوتوو (دوای 08:15)</div>
            <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {currentDayData.summary.lateCount} <span className="text-xs text-slate-400 font-medium">کەس</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[22px] p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">خاوەن ئیزافە (Overtime)</div>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5">
              {currentDayData.summary.overtimeCount} <span className="text-xs text-purple-500 font-medium">({currentDayData.summary.totalOvertimeHours}h)</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 🔍 Apple Style Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="گەڕان بەدوای ناوی کارمەند، پۆست، تێبینی کارمەند، یان تێبینی ئەدمین..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-3 pr-10 py-2.5 rounded-2xl bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#007AFF] placeholder-slate-400 shadow-xs"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-700 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 📋 🍏 Apple iOS Master Daily Attendance Table */}
      <div className="w-full overflow-x-auto border border-slate-200/80 dark:border-white/5 rounded-[24px] shadow-xs bg-white dark:bg-[#2c2c2e] overflow-hidden">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="bg-slate-50/90 dark:bg-[#2c2c2e]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
            <tr className="text-slate-800 dark:text-slate-200 font-bold border-b-2 border-slate-300 dark:border-slate-700">
              <th className="p-3 text-center w-10 border-l border-slate-300 dark:border-slate-700">#</th>
              <th className="p-3 w-44 border-l border-slate-300 dark:border-slate-700">ناوی کارمەند</th>
              <th className="p-3 w-32 border-l border-slate-300 dark:border-slate-700">پۆست / ئەرک</th>
              <th className="p-3 text-center w-28 border-l border-slate-300 dark:border-slate-700">📥 کاتی هاتن</th>
              <th className="p-3 w-40 border-l border-slate-300 dark:border-slate-700">💬 تێبینی کارمەند (هاتن)</th>
              <th className="p-3 text-center w-28 border-l border-slate-300 dark:border-slate-700">📤 کاتی چوون</th>
              <th className="p-3 w-40 border-l border-slate-300 dark:border-slate-700">💬 تێبینی کارمەند (چوون)</th>
              <th className="p-3 text-center w-24 border-l border-slate-300 dark:border-slate-700">⏱️ دەوام</th>
              <th className="p-3 text-center w-28 border-l border-slate-300 dark:border-slate-700 bg-purple-50/50 dark:bg-purple-950/20 text-purple-950 dark:text-purple-300">⚡ ئیزافەی ڕۆژ</th>
              <th className="p-3 text-center w-32 border-l border-slate-300 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-300">📊 کۆی ئیزافەی مانگ</th>
              <th className="p-3">🛡️ تێبینی ئەدمین (دەستکاری)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300/80 dark:divide-slate-700">
            {filteredRows.length > 0 ? (
              filteredRows.map((row, rIdx) => {
                const inBadge = getAttendanceTimeBadge(row.checkInTime, 'in');
                const outBadge = getAttendanceTimeBadge(row.checkOutTime, 'out');
                const isEditingThisAdminNote = editingAdminNoteKey === row.empId;

                return (
                  <tr key={row.empId} className={`hover:bg-blue-50/40 dark:hover:bg-white/5 transition-colors border-b border-slate-300/80 dark:border-slate-700/80 ${rIdx % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.02]' : ''}`}>
                    <td className="p-3 text-center font-mono text-slate-400 font-bold border-l-2 border-slate-300 dark:border-slate-700">
                      {row.index}
                    </td>

                    <td className="p-3 font-bold text-slate-900 dark:text-white border-l border-slate-300/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-1.5">
                        <Link 
                          href={`/employees/${row.empId}`}
                          className="hover:text-[#007AFF] hover:underline flex items-center gap-1.5 transition-colors group"
                          title="بینینی پرۆفایل و دۆسیەی کارمەند"
                        >
                          <span>{row.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-30 group-hover:opacity-100 text-blue-500 transition-opacity" />
                        </Link>
                        {row.isWaived && (
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 border border-white shadow-xs inline-block shrink-0" title="لێخۆشبوو لە سەرپێچی (Waiver)" />
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-slate-500 dark:text-slate-400 font-medium border-l border-slate-300/80 dark:border-slate-700/80">
                      {row.role}
                    </td>

                    {/* Check-In */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        {row.checkInTime !== '-' ? (
                          <div className="flex flex-col items-center">
                            {row.checkInOriginalTime ? (
                              <>
                                <span className="line-through text-rose-400 font-bold font-mono text-[9px] block">
                                  {row.checkInOriginalTime}
                                </span>
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 font-mono font-bold text-xs inline-flex items-center gap-1 shadow-xs">
                                  📥 {inBadge.formattedTime}
                                </span>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 font-mono font-bold text-xs inline-block">
                                📥 {inBadge.formattedTime}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono font-bold">-</span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const cIn = row.checkInTime !== '-' ? row.checkInTime : '08:00';
                            const cOut = row.checkOutTime !== '-' ? row.checkOutTime : '';
                            const st = row.status === 'leave' ? 'Leave' : row.status === 'absent' ? 'Absent' : 'Present';
                            setEditingTimeModal({
                              empId: row.empId,
                              empName: row.name,
                              targetType: 'in',
                              checkInTime: cIn,
                              checkOutTime: cOut,
                              status: st,
                              dateStr: selectedDate,
                              isWaived: Boolean(row.isWaived),
                            });
                            setModalCheckIn(cIn);
                            setModalCheckOut(cOut);
                            setModalStatus(st);
                            setModalIsWaived(Boolean(row.isWaived));
                            setAdminReasonInput(row.adminNote || '');
                          }}
                          className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-[#007AFF] hover:bg-blue-50 dark:hover:bg-white/10 rounded-full transition-all flex items-center gap-0.5 font-bold cursor-pointer"
                          title="گۆڕینی کاتی هاتن"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>گۆڕین</span>
                        </button>
                      </div>
                    </td>

                    {/* Check-In Employee Note */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80">
                      {row.checkInNote ? (
                        <div className="flex items-start gap-1.5 text-[11px] text-blue-900 dark:text-blue-200 font-medium bg-blue-50/80 dark:bg-blue-950/30 p-2 rounded-xl border border-blue-200/60 dark:border-blue-800/30">
                          <MessageSquare className="w-3 h-3 text-[#007AFF] shrink-0 mt-0.5" />
                          <span>{row.checkInNote}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Check-Out */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        {row.checkOutTime !== '-' ? (
                          <div className="flex flex-col items-center">
                            {row.checkOutOriginalTime ? (
                              <>
                                <span className="line-through text-rose-400 font-bold font-mono text-[9px] block">
                                  {row.checkOutOriginalTime}
                                </span>
                                <span className="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/25 font-mono font-bold text-xs inline-flex items-center gap-1 shadow-xs">
                                  📤 {outBadge.formattedTime}
                                </span>
                              </>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/25 font-mono font-bold text-xs inline-block">
                                📤 {outBadge.formattedTime}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono font-bold">-</span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const cIn = row.checkInTime !== '-' ? row.checkInTime : '08:00';
                            const cOut = row.checkOutTime !== '-' ? row.checkOutTime : '';
                            const st = row.status === 'leave' ? 'Leave' : row.status === 'absent' ? 'Absent' : 'Present';
                            setEditingTimeModal({
                              empId: row.empId,
                              empName: row.name,
                              targetType: 'out',
                              checkInTime: cIn,
                              checkOutTime: cOut,
                              status: st,
                              dateStr: selectedDate,
                              isWaived: Boolean(row.isWaived),
                            });
                            setModalCheckIn(cIn);
                            setModalCheckOut(cOut);
                            setModalStatus(st);
                            setModalIsWaived(Boolean(row.isWaived));
                            setAdminReasonInput(row.adminNote || '');
                          }}
                          className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-[#007AFF] hover:bg-blue-50 dark:hover:bg-white/10 rounded-full transition-all flex items-center gap-0.5 font-bold cursor-pointer"
                          title="گۆڕینی کاتی چوون"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>گۆڕین</span>
                        </button>
                      </div>
                    </td>

                    {/* Check-Out Employee Note / Overtime Reason */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80">
                      {row.checkOutNote ? (
                        <div className="flex items-start gap-1.5 text-[11px] text-purple-900 dark:text-purple-200 font-medium bg-purple-50/80 dark:bg-purple-950/30 p-2 rounded-xl border border-purple-200/60 dark:border-purple-800/30">
                          <MessageSquare className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
                          <span>{row.checkOutNote}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {row.durationStr}
                    </td>

                    {/* Daily Overtime */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80 text-center">
                      {row.overtimeStr !== '-' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/25 font-mono font-black text-xs inline-block">
                          {row.overtimeStr}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                      )}
                    </td>

                    {/* Monthly Overtime Total */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80 text-center">
                      {row.monthlyOvertimeStr && row.monthlyOvertimeStr !== '-' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/25 font-mono font-black text-xs inline-block">
                          {row.monthlyOvertimeStr}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                      )}
                    </td>

                    {/* Admin Note Column */}
                    <td className="p-2.5 border-l border-slate-300/80 dark:border-slate-700/80">
                      {isEditingThisAdminNote ? (
                        <div className="flex items-center gap-1.5">
                          <textarea
                            autoFocus
                            rows={2}
                            value={tempAdminNoteText}
                            onChange={(e) => setTempAdminNoteText(e.target.value)}
                            placeholder="تێبینی ئەدمین بنووسە..."
                            className="w-full text-xs font-medium py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-[#3a3a3c] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-[#007AFF]"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveAdminNote(row.empId)}
                              className="p-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer transition-all active:scale-90"
                              title="پاشەکەوت"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAdminNoteKey(null)}
                              className="p-1.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer transition-all active:scale-90"
                              title="پاشگەزبوونەوە"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-1.5 group">
                          {row.adminNote ? (
                            <div className="flex flex-col gap-1 text-xs font-medium text-amber-950 dark:text-amber-200 flex-1">
                              {row.adminNote.split('\n').filter(Boolean).map((noteLine, nIdx) => (
                                <div key={nIdx} className="flex items-start gap-1.5 bg-amber-50/90 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl border border-amber-300/60 dark:border-amber-700/30 shadow-xs">
                                  <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">{noteLine}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs italic">تێبینی نییە</span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdminNoteKey(row.empId);
                                setTempAdminNoteText(row.adminNote || '');
                              }}
                              className="opacity-60 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-[#007AFF] hover:bg-blue-50 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                              title="دەستکاریکردنی تێبینی ئەدمین"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRowAttendance(row.empId, row.name)}
                              className="opacity-60 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                              title="سڕینەوەی دەوامی کارمەند"
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
                <td colSpan={11} className="p-8 text-center text-slate-500 font-bold">
                  {isFriday ? '🌴 ئەمڕۆ ڕۆژی هەینییە — پشووی فەرمیی هەفتانەیە' : 'هیچ تۆمارێک بەپێی ئەم بەروارە یان فلتەرە نەدۆزرایەوە'}
                </td>
              </tr>
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot className="bg-slate-900 text-white font-black border-t-2 border-slate-950">
              <tr>
                <td colSpan={8} className="p-3 text-right text-xs sm:text-sm font-black text-slate-200">
                  💎 کۆی گشتی ئامادەبووان و کاتەکانی ئیزافە ({selectedDate}):
                </td>
                <td className="p-3 text-center font-mono font-black text-xs sm:text-sm bg-purple-900/60 text-purple-200 border-x border-slate-700">
                  {currentDayData.summary.totalOvertimeHours > 0 ? `+${currentDayData.summary.totalOvertimeHours}h` : '-'}
                </td>
                <td className="p-3 text-center font-mono font-black text-xs sm:text-sm bg-amber-900/60 text-amber-200 border-x border-slate-700">
                  {currentDayData.summary.totalMonthlyOvertimeHours > 0 ? `${currentDayData.summary.totalMonthlyOvertimeHours}h` : '-'}
                </td>
                <td className="p-3 text-slate-300 text-xs font-bold text-center">
                  {currentDayData.summary.presentCount} کارمەند ئامادەبووە
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ⏱️ ENHANCED UNIFIED MODAL FOR CHECK-IN, CHECK-OUT, WAIVER & NOTES */}
      {editingTimeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-300 dark:border-slate-700 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    دەستکاریکردنی کاتی دەوام و ئامادەبوون
                  </h3>
                  <p className="text-[11px] text-slate-300 font-bold">
                    کارمەند: <span className="text-amber-300">{editingTimeModal.empName}</span> | بەروار: <span className="font-mono text-emerald-300">{editingTimeModal.dateStr}</span>
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
            <div className="p-5 space-y-4 text-xs font-bold text-slate-800 dark:text-slate-200">
              
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 dark:text-white">حاڵەتی کارمەند لەم ڕۆژەدا:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'Present', label: 'ئامادەبوو', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                    { key: 'Leave', label: 'مۆڵەت', color: 'border-amber-500 bg-amber-50 text-amber-700' },
                    { key: 'Absent', label: 'غیاب', color: 'border-rose-500 bg-rose-50 text-rose-700' },
                  ].map(st => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setModalStatus(st.key)}
                      className={`py-2 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                        modalStatus === st.key ? `${st.color} shadow-xs` : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Check-In & Check-Out Times Side by Side if Present */}
              {modalStatus === 'Present' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {/* Check-In Time */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                      <span>📥 کاتی هاتن (Check-In):</span>
                    </label>
                    <input
                      type="time"
                      value={modalCheckIn}
                      onChange={(e) => setModalCheckIn(e.target.value)}
                      className="input-classic w-full text-base font-black text-center font-mono py-2 bg-white dark:bg-slate-900 border-emerald-300 focus:border-emerald-500 rounded-xl"
                    />
                    <div className="flex items-center gap-1 pt-0.5">
                      {['08:00', '08:15', '08:30'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setModalCheckIn(t)}
                          className="flex-1 py-1 text-[10px] font-mono font-bold bg-emerald-100/70 hover:bg-emerald-200 text-emerald-900 rounded-lg transition-all"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Check-Out Time */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-blue-800 dark:text-blue-300 flex items-center justify-between">
                      <span>📤 کاتی ڕۆیشتن (Check-Out):</span>
                      {modalCheckOut && (
                        <button
                          type="button"
                          onClick={() => setModalCheckOut('')}
                          className="text-[9px] text-rose-500 hover:underline font-normal cursor-pointer"
                        >
                          سڕینەوە
                        </button>
                      )}
                    </label>
                    <input
                      type="time"
                      value={modalCheckOut}
                      onChange={(e) => setModalCheckOut(e.target.value)}
                      className="input-classic w-full text-base font-black text-center font-mono py-2 bg-white dark:bg-slate-900 border-blue-300 focus:border-blue-500 rounded-xl"
                    />
                    <div className="flex items-center gap-1 pt-0.5">
                      {['17:00', '18:00', '19:00'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setModalCheckOut(t)}
                          className="flex-1 py-1 text-[10px] font-mono font-bold bg-blue-100/70 hover:bg-blue-200 text-blue-900 rounded-lg transition-all"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Duration Preview Box */}
              {modalStatus === 'Present' && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/40 flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>ماوەی کارکردن:</span>
                  </div>
                  <div className="font-mono">
                    {modalCheckIn && modalCheckOut ? (() => {
                      const [inH, inM] = modalCheckIn.split(':').map(Number);
                      const [outH, outM] = modalCheckOut.split(':').map(Number);
                      const inTot = inH * 60 + (inM || 0);
                      const outTot = outH * 60 + (outM || 0);
                      if (outTot > inTot) {
                        const gross = outTot - inTot;
                        const breakStart = 12 * 60;
                        const breakEnd = 13 * 60;
                        const overlap = Math.max(0, Math.min(outTot, breakEnd) - Math.max(inTot, breakStart));
                        const hrs = parseFloat((Math.max(0, gross - overlap) / 60).toFixed(1));
                        const ot = hrs > 8 ? parseFloat((hrs - 8).toFixed(1)) : 0;
                        return (
                          <span>
                            {hrs} کاتژمێر {ot > 0 ? `(+${ot} ئیزافە)` : ''}
                          </span>
                        );
                      }
                      return '-';
                    })() : (
                      <span className="text-amber-700 dark:text-amber-400">🟢 لە دەوامدایە (بەردەوام)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Waiver Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 cursor-pointer text-purple-950 dark:text-purple-200">
                <input
                  type="checkbox"
                  checked={modalIsWaived}
                  onChange={(e) => setModalIsWaived(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded-md border-purple-300 focus:ring-purple-500"
                />
                <span className="text-xs font-bold">
                  🟣 لێخۆشبوون (Waiver) بۆ ئەم دەوامە ئەژمار بکرێت (بازنەی مۆر دەخرێتە سەر خانەکە)
                </span>
              </label>

              {/* Admin Reason Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-700" />
                  <span>تێبینی ئەدمین (لە خشتەکە و ڕاپۆرتدا پیشان دەدرێت):</span>
                </label>
                <textarea
                  rows={2}
                  value={adminReasonInput}
                  onChange={(e) => setAdminReasonInput(e.target.value)}
                  placeholder="هۆکاری گۆڕانکاری بنووسە (ئارەزوومەندانە)..."
                  className="input-classic w-full text-xs font-bold p-2.5 rounded-xl border-amber-300 focus:border-amber-500 bg-amber-50/40 dark:bg-slate-900"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTimeModal(null)}
                  className="btn-classic text-xs px-4 py-2 cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingTimeModal) {
                      const { empId, empName } = editingTimeModal;
                      setEditingTimeModal(null);
                      handleDeleteRowAttendance(empId, empName);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-rose-200 dark:border-rose-900/40"
                  title="سڕینەوەی دەوامی ئەم کارمەندە بۆ ئەم ڕۆژە"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>سڕینەوەی دەوام</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveTimeModal}
                className="btn-classic-primary text-xs px-6 py-2.5 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black cursor-pointer shadow-md active:scale-95 transition-all"
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
