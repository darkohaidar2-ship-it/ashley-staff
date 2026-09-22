'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Employee } from '@/lib/types';
import { useAppContext } from '@/context/app-provider';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  Printer, 
  User, 
  CheckCircle2, 
  Sparkles,
  Edit3,
  Save,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Edit,
  X
} from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';
import { exportToPDF, exportToCSV, formatTime12H, type ExportTableColumn } from '@/lib/export-utils';
import { resolveEmployeeDayAttendance } from '@/lib/attendance-helpers';

interface AdminOvertimeModuleProps {
  employees: Employee[];
}

export function AdminOvertimeModule({ employees }: AdminOvertimeModuleProps) {
  const { overtime, setOvertime, attendanceLogs, settings } = useAppContext();
  
  const [selectedDate, setSelectedDate] = useState<string>(() => '2026-08-01');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => '2026-08');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Shift and Rate Settings
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [hourlyRate, setHourlyRate] = useState<number>(5000);

  // Admin Notes stored in localStorage
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_admin_notes_2026-08');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  // Edit Overtime Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{ hours: string; rate: string; note: string }>({
    hours: '',
    rate: '5000',
    note: ''
  });

  // Keep notes synchronized with localStorage and Supabase Cloud
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`ashley_admin_notes_${selectedMonth}`);
        if (stored) {
          setAdminNotes(JSON.parse(stored));
        } else {
          setAdminNotes({});
        }
      } catch {}
    }

    // Cloud fetch from Supabase
    fetch(`/api/attendance/admin/overtime-notes?month=${selectedMonth}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !data?.notes) return;
        setAdminNotes(prev => {
          const merged = { ...prev, ...data.notes };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(merged));
            } catch {}
          }
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedMonth, employees]);

  // 31-Day Matrix Overrides Map (Shared Single Source of Truth)
  const [matrixOverrides, setMatrixOverrides] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`ashley_matrix_overrides_${selectedMonth}`);
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
          const cached = localStorage.getItem(`ashley_matrix_overrides_${selectedMonth}`);
          if (cached) localMap = JSON.parse(cached);
        } catch {}
      }

      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = { ...localMap };
        (data.attendance || []).forEach((r: any) => {
          if (r.status && r.status !== 'empty' && r.status !== 'delete' && r.status !== 'Empty') {
            const k = `${r.userId}_${r.date}`;
            const existing = map[k] || {};

            const checkInTime = r.checkInTime || r.check_in_time || existing.checkInTime;
            const checkOutTime = r.checkOutTime || r.check_out_time || existing.checkOutTime;
            const rawCheckIn = r.rawCheckInTime || r.raw_check_in_time || r.rawCheckIn || existing.rawCheckIn || checkInTime;
            const rawCheckOut = r.rawCheckOutTime || r.raw_check_out_time || r.rawCheckOut || existing.rawCheckOut || checkOutTime;
            const rawNote = r.note || r.notes || r.reason || r.employeeNote || r.edit_note || r.editNote || existing.note;
            let cleanNote = rawNote;
            if (typeof cleanNote === 'string' && cleanNote.includes('): ')) {
              cleanNote = cleanNote.split('): ')[1] || cleanNote;
            }
            const checkInNote = r.check_in_edit_note || r.check_in_note || r.checkInNote || cleanNote || existing.checkInNote;
            const checkOutNote = r.check_out_edit_note || r.check_out_note || r.checkOutNote || existing.checkOutNote;
            const note = cleanNote || checkInNote || existing.note;
            const adminNote = r.adminNote || r.admin_note || r.editNote || existing.adminNote;
            const adminCheckInNote = r.adminCheckInNote || r.admin_check_in_note || adminNote || existing.adminCheckInNote;
            const adminCheckOutNote = r.adminCheckOutNote || r.admin_check_out_note || existing.adminCheckOutNote;
            const adminDecision = r.adminDecision || existing.adminDecision || null;
            const adminCheckInDecision = r.adminCheckInDecision || existing.adminCheckInDecision || null;
            const adminCheckOutDecision = r.adminCheckOutDecision || existing.adminCheckOutDecision || null;
            const isCheckInWaived = Boolean(r.isCheckInWaived ?? (adminCheckInDecision === 'waived') ?? existing.isCheckInWaived);
            const isCheckOutWaived = Boolean(r.isCheckOutWaived ?? (adminCheckOutDecision === 'waived') ?? existing.isCheckOutWaived);
            const isWaived = Boolean(r.isWaived ?? (adminDecision === 'waived') ?? (isCheckInWaived || isCheckOutWaived) ?? existing.isWaived);

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
              historyLogs: r.historyLogs || existing.historyLogs || [],
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
            localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(map));
          } catch {}
        }
      } else if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    } catch {}
  }, [selectedMonth]);

  useEffect(() => {
    loadMatrixOverrides();
    const handleUpdate = () => {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`ashley_matrix_overrides_${selectedMonth}`);
          if (cached) {
            setMatrixOverrides(JSON.parse(cached));
          }
        } catch {}
      }
    };
    window.addEventListener('ashley_attendance_updated', handleUpdate);
    return () => window.removeEventListener('ashley_attendance_updated', handleUpdate);
  }, [loadMatrixOverrides, selectedMonth]);

  const handleSaveNote = async (key: string) => {
    const updated = { ...adminNotes, [key]: tempNoteText.trim() };
    setAdminNotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updated));
    }
    setEditingNoteKey(null);

    // Also update matrixOverrides so 31-day table gets the note!
    const [empId, dateStr] = key.split('_');
    if (empId && dateStr) {
      const existing = matrixOverrides[key] || {};
      const updatedOverride = {
        ...existing,
        checkOutNote: tempNoteText.trim(),
        adminNote: tempNoteText.trim(),
      };
      const nextMap = { ...matrixOverrides, [key]: updatedOverride };
      setMatrixOverrides(nextMap);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(nextMap));
        } catch {}
      }

      try {
        fetch('/api/attendance/admin/manual-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: [{
              userId: empId,
              date: dateStr,
              checkOutNote: tempNoteText.trim(),
              adminNote: tempNoteText.trim(),
            }]
          })
        });
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ashley_attendance_updated'));
      }
    }

    // Save to Supabase Cloud
    try {
      await fetch('/api/attendance/admin/overtime-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          noteKey: key,
          note: tempNoteText.trim()
        })
      });
    } catch (err) {
      console.warn('Could not sync note to cloud:', err);
    }
  };

  // Gather all live & prop attendance logs
  const allCombinedLogs = useMemo(() => {
    let list: any[] = [...(attendanceLogs || [])];
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
  }, [attendanceLogs]);

  // Form State for Manual Overtime Entry
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [manualHours, setManualHours] = useState<string>('');
  const [manualRate, setManualRate] = useState<string>('5000');
  const [manualNote, setManualNote] = useState<string>('');

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Convert time "HH:MM" to total minutes
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const cleanTime = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
    const parts = (cleanTime || '').split(':');
    if (parts.length < 2) return 0;
    const hours = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    return hours * 60 + mins;
  };

  const shiftEndMins = useMemo(() => timeToMinutes(shiftEndTime), [shiftEndTime]);

  const [yearStr, monthStr] = selectedMonth.split('-');
  const yearNum = parseInt(yearStr || '2026', 10);
  const monthNum = parseInt(monthStr || '08', 10);
  const totalDaysInMonth = useMemo(() => getDaysInMonth(new Date(yearNum, monthNum - 1, 1)), [yearNum, monthNum]);

  // Generate combined overtime records dynamically from 31-Day Attendance Matrix + Manual Entries
  const allOvertimeRecords = useMemo(() => {
    const recordsMap = new Map<string, {
      id: string;
      employeeId: string;
      employeeName: string;
      employeeRole: string;
      date: string;
      checkInTime?: string | null;
      checkOutTime?: string | null;
      hours: number;
      rate: number;
      totalAmount: number;
      note: string;
      source: 'attendance' | 'manual' | 'sheet';
    }>();

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Process 31-Day Attendance Matrix for each active employee (> 8 hours rule)
    activeEmployees.forEach(emp => {
      for (let d = 1; d <= totalDaysInMonth; d++) {
        const dStr = d < 10 ? `0${d}` : `${d}`;
        const dayDateStr = `${selectedMonth}-${dStr}`;
        const dateObj = new Date(yearNum, monthNum - 1, d);
        const dayOfWeek = getDay(dateObj);
        const isFri = dayOfWeek === 5;
        const isFut = dayDateStr > todayStr;
        const isTod = dayDateStr === todayStr;

        const resolved = resolveEmployeeDayAttendance(
          emp,
          { dayNum: d, dateStr: dayDateStr, isFriday: isFri, isFuture: isFut, isToday: isTod },
          matrixOverrides,
          allCombinedLogs
        );

        if (resolved.status === 'Present' && resolved.workedHours > 8) {
          const otHours = parseFloat((resolved.workedHours - 8).toFixed(1));
          const noteKey = `${emp.id}_${dayDateStr}`;
          const note = resolved.checkOutNote || resolved.checkInNote || resolved.adminNote || adminNotes[noteKey] || '';
          const recKey = `${emp.id}_${dayDateStr}`;

          recordsMap.set(recKey, {
            id: `att_${emp.id}_${dayDateStr}`,
            employeeId: emp.id,
            employeeName: emp.fullName3Part || emp.name || 'کارمەند',
            employeeRole: emp.role || 'کارمەند',
            date: dayDateStr,
            checkInTime: resolved.checkInTime || '08:00',
            checkOutTime: resolved.checkOutTime || '17:00',
            hours: otHours,
            rate: hourlyRate,
            totalAmount: Math.round(otHours * hourlyRate),
            note,
            source: 'attendance',
          });
        }
      }
    });

    // 2. Process Manual / Stored Overtime Entries
    (overtime || []).forEach((r: any) => {
      if (!r.date || !r.date.startsWith(selectedMonth)) return;
      if (r.id?.includes('sheet') || r.id?.includes('seed') || r.source === 'sheet') return;
      const emp = employees.find(e => e.id === (r.employeeId || r.userId));
      const hoursNum = parseFloat(r.hours || 0);
      const rateNum = parseFloat(r.rate || hourlyRate);
      const noteKey = `${r.employeeId || r.userId}_${r.date}`;
      const savedNote = adminNotes[noteKey] || r.note || r.notes || '';

      const recKey = `${r.employeeId || r.userId}_${r.date}`;
      recordsMap.set(recKey, {
        id: r.id || `manual_${Date.now()}_${Math.random()}`,
        employeeId: r.employeeId || r.userId || 'manual',
        employeeName: r.employeeName || emp?.fullName3Part || emp?.name || 'کارمەند',
        employeeRole: emp?.role || 'کارمەند',
        date: r.date,
        checkInTime: r.checkInTime || null,
        checkOutTime: r.checkOutTime || null,
        hours: hoursNum,
        rate: rateNum,
        totalAmount: Number(r.totalAmount || (hoursNum * rateNum)),
        note: savedNote,
        source: 'manual',
      });
    });

    return Array.from(recordsMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [activeEmployees, totalDaysInMonth, selectedMonth, yearNum, monthNum, matrixOverrides, allCombinedLogs, adminNotes, overtime, hourlyRate, employees]);

  // Days in selected month for 1-31 Calendar bar
  const monthDaysList = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr || '2026', 10);
    const m = parseInt(mStr || '08', 10);
    const totalDays = getDaysInMonth(new Date(y, m - 1, 1));
    const days: Array<{
      dayNum: number;
      dateStr: string;
      dayName: string;
      isFriday: boolean;
      overtimeCount: number;
    }> = [];

    const dayNamesKurdish = ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];

    for (let d = 1; d <= totalDays; d++) {
      const dStr = d.toString().padStart(2, '0');
      const fullDate = `${selectedMonth}-${dStr}`;
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = getDay(dateObj);
      const otCount = allOvertimeRecords.filter(r => r.date === fullDate).length;

      days.push({
        dayNum: d,
        dateStr: fullDate,
        dayName: dayNamesKurdish[dayOfWeek] || '',
        isFriday: dayOfWeek === 5,
        overtimeCount: otCount,
      });
    }

    return days;
  }, [selectedMonth, allOvertimeRecords]);

  // Daily records on selected date
  const dailyRecords = useMemo(() => {
    return allOvertimeRecords.filter(r => r.date === selectedDate);
  }, [allOvertimeRecords, selectedDate]);

  // Monthly records on selected month
  const monthlyRecords = useMemo(() => {
    return allOvertimeRecords.filter(r => r.date && r.date.startsWith(selectedMonth));
  }, [allOvertimeRecords, selectedMonth]);

  // Monthly summary: ONLY includes employees who actually have overtime
  const monthlySummary = useMemo(() => {
    const summaryMap: Record<string, { 
      empId: string; 
      name: string; 
      role: string; 
      totalHours: number; 
      totalAmount: number; 
      records: typeof allOvertimeRecords 
    }> = {};
    
    monthlyRecords.forEach(r => {
      const id = r.employeeId;
      if (!summaryMap[id]) {
        summaryMap[id] = { 
          empId: id, 
          name: r.employeeName, 
          role: r.employeeRole, 
          totalHours: 0, 
          totalAmount: 0, 
          records: [] 
        };
      }
      summaryMap[id].totalHours += Number(r.hours || 0);
      summaryMap[id].totalAmount += Number(r.totalAmount || 0);
      summaryMap[id].records.push(r);
    });

    return Object.values(summaryMap)
      .filter(s => s.totalHours > 0)
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [monthlyRecords]);

  // Totals
  const totalDailyHours = dailyRecords.reduce((acc, curr) => acc + curr.hours, 0);
  const totalDailyCost = dailyRecords.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const totalMonthlyHours = monthlySummary.reduce((acc, curr) => acc + curr.totalHours, 0);
  const totalMonthlyCost = monthlySummary.reduce((acc, curr) => acc + curr.totalAmount, 0);

  // Manual Add Form Submit
  const handleAddManualOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە');
    if (!manualHours || parseFloat(manualHours) <= 0) return alert('تکایە کاتژمێری دروست بنووسە');

    const emp = employees.find(e => e.id === selectedEmpId);
    const parsedHours = parseFloat(manualHours);
    const parsedRate = parseFloat(manualRate) || hourlyRate;

    const newRecord = {
      id: 'ot_manual_' + Date.now().toString(),
      employeeId: selectedEmpId,
      employeeName: emp?.fullName3Part || emp?.name || 'کارمەند',
      date: selectedDate,
      hours: parsedHours,
      rate: parsedRate,
      totalAmount: parsedHours * parsedRate,
      note: manualNote.trim(),
      createdAt: new Date().toISOString(),
    };

    setOvertime((prev: any) => [newRecord, ...(prev || [])]);

    if (manualNote.trim()) {
      const noteKey = `${selectedEmpId}_${selectedDate}`;
      const updatedNotes = { ...adminNotes, [noteKey]: manualNote.trim() };
      setAdminNotes(updatedNotes);
      localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updatedNotes));
    }

    setManualHours('');
    setManualNote('');
    alert(`🎉 کاتی زیادە (${parsedHours} کاتژمێر) بۆ (${newRecord.employeeName}) تۆمارکرا!`);
  };

  // Open Edit Modal for a Record
  const handleOpenEditModal = (rec: any) => {
    setEditingRecord(rec);
    const noteKey = `${rec.employeeId}_${rec.date}`;
    setEditForm({
      hours: rec.hours.toString(),
      rate: (rec.rate || hourlyRate).toString(),
      note: adminNotes[noteKey] || rec.note || ''
    });
  };

  // Save Edit Modal
  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    const parsedHours = parseFloat(editForm.hours);
    const parsedRate = parseFloat(editForm.rate) || hourlyRate;
    if (isNaN(parsedHours) || parsedHours <= 0) return alert('تکایە کاتژمێری دروست بنووسە');

    const noteKey = `${editingRecord.employeeId}_${editingRecord.date}`;
    const updatedNotes = { ...adminNotes, [noteKey]: editForm.note.trim() };
    setAdminNotes(updatedNotes);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updatedNotes));
    }

    setOvertime((prev: any[]) => {
      const existing = (prev || []).find(r => r.id === editingRecord.id || (r.employeeId === editingRecord.employeeId && r.date === editingRecord.date));
      if (existing) {
        return (prev || []).map(r => (r.id === existing.id ? {
          ...r,
          hours: parsedHours,
          rate: parsedRate,
          totalAmount: parsedHours * parsedRate,
          note: editForm.note.trim()
        } : r));
      } else {
        return [
          {
            id: editingRecord.id || `ot_edited_${Date.now()}`,
            employeeId: editingRecord.employeeId,
            employeeName: editingRecord.employeeName,
            date: editingRecord.date,
            hours: parsedHours,
            rate: parsedRate,
            totalAmount: parsedHours * parsedRate,
            note: editForm.note.trim(),
            createdAt: new Date().toISOString()
          },
          ...(prev || [])
        ];
      }
    });

    setEditingRecord(null);
    alert('✅ دەستکارییەکە بە سەرکەوتوویی پاشەکەوت کرا!');
  };

  const handleDelete = (id: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کاتە زیادەیە؟')) {
      setOvertime((prev: any) => (prev || []).filter((r: any) => r.id !== id));
    }
  };

  // Clean Export Handler
  const handleSyncGoogleSheet = () => {
    handleExportCSV();
  };

  // Clear All Overtime Records & Purge Stale Caches
  const handleClearAllOvertime = () => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی سەرجەم کاتە زیادەکان و تێبینیەکان؟')) {
      setOvertime([]);
      setAdminNotes({});
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ashley_local_overtime');
        localStorage.removeItem(`ashley_admin_notes_${selectedMonth}`);
        localStorage.removeItem(`ashley_ot_notes_${selectedMonth}`);
        window.dispatchEvent(new Event('ashley_attendance_updated'));
      }
      alert('✅ سەرجەم داتاکانی کاتی زیادە بە سەرکەوتوویی سڕانەوە.');
    }
  };

  // PDF & CSV Export Handlers
  const handleExportPDF = () => {
    if (viewMode === 'daily') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' },
        { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
        { header: 'کاتی دەرچوون', key: 'checkOutTime', align: 'center' },
        { header: 'کاتی زیادەی کارکردن', key: 'hours', align: 'center' },
        { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی و جۆری ئیش', key: 'note', align: 'right' },
      ];
      const data: Record<string, any>[] = dailyRecords.map(r => ({
        name: r.employeeName,
        role: r.employeeRole,
        checkOutTime: formatTime12H(r.checkOutTime),
        hours: `${r.hours} کاتژمێر`,
        amount: `${r.totalAmount.toLocaleString()} IQD`,
        note: r.note || '-',
      }));

      // Append prominent Grand Total row inside the table
      data.push({
        name: '⭐ کۆی گشتی شایستەی ڕۆژ',
        role: `${dailyRecords.length} کارمەند`,
        checkOutTime: '—',
        hours: `${totalDailyHours.toFixed(1)} کاتژمێر`,
        amount: `${totalDailyCost.toLocaleString()} IQD`,
        note: 'کۆی شایستەی خەرجکردنی ئیزافەی ئەمڕۆ',
      });

      exportToPDF({
        title: 'ڕاپۆرتی کاتی زیادەی ڕۆژانەی کارمەندان (Daily Overtime Report)',
        subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — تۆماری فەرمی کاتی زیادەی کارمەندان',
        period: `بەرواری ${selectedDate}`,
        columns: cols,
        data,
        fileName: `Ashley_Daily_Overtime_${selectedDate}`,
        settings,
        reportType: 'overtime',
        orientation: 'portrait',
        documentCode: `ASH-OT-${selectedDate.replace(/-/g, '')}`,
        summaryCards: [
          { label: 'کارمەندانی خاوەن ئیزافە', value: `${dailyRecords.length} کارمەند`, color: '#2563eb', icon: '👥' },
          { label: 'کۆی کاتژمێری ئیزافە', value: `${totalDailyHours.toFixed(1)} کاتژمێر`, color: '#d97706', icon: '⚡' },
          { label: 'کۆی شایستەی پارە', value: `${totalDailyCost.toLocaleString()} IQD`, color: '#059669', icon: '💰' },
          { label: 'بەرواری ڕۆژ', value: selectedDate, color: '#475569', icon: '📅' },
        ],
        summaryText: `کۆی کارمەندانی خاوەن ئیزافە لەم بەروارەدا: ${dailyRecords.length} کارمەند • کۆی گشتی کاتژمێری ئیزافەی ڕۆژ: ${totalDailyHours.toFixed(1)} کاتژمێر • کۆی گشتی پارەی شایستەی ئیزافە بۆ خەرجکردن: ${totalDailyCost.toLocaleString()} دیناری عێراقی (IQD).`,
      });
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' },
        { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
        { header: 'کاتی زیادەی کارکردن', key: 'hours', align: 'center' },
        { header: 'کۆی شایستەی پارە (IQD)', key: 'amount', align: 'center' },
      ];
      const data: Record<string, any>[] = monthlySummary.map(s => ({
        name: s.name,
        role: s.role,
        hours: `${s.totalHours.toFixed(1)} کاتژمێر`,
        amount: `${s.totalAmount.toLocaleString()} IQD`,
      }));

      // Append prominent Grand Total row inside the table
      data.push({
        name: '⭐ کۆی گشتی شایستەی مانگ',
        role: `${monthlySummary.length} کارمەند`,
        hours: `${totalMonthlyHours.toFixed(1)} کاتژمێر`,
        amount: `${totalMonthlyCost.toLocaleString()} IQD`,
      });

      exportToPDF({
        title: 'ڕاپۆرتی ئاماری مانگانەی کاتی زیادەی کارمەندان (Monthly Overtime Report)',
        subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — تەنها کارمەندانی خاوەن ئیزافە',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Monthly_Overtime_${selectedMonth}`,
        settings,
        reportType: 'overtime',
        orientation: 'portrait',
        documentCode: `ASH-OTM-${selectedMonth.replace(/-/g, '')}`,
        summaryCards: [
          { label: 'کارمەندانی خاوەن ئیزافە', value: `${monthlySummary.length} کارمەند`, color: '#2563eb', icon: '👥' },
          { label: 'کۆی کاتژمێری مانگ', value: `${totalMonthlyHours.toFixed(1)} کاتژمێر`, color: '#d97706', icon: '⚡' },
          { label: 'کۆی گشتی شایستەی ئیزافە', value: `${totalMonthlyCost.toLocaleString()} IQD`, color: '#059669', icon: '💰' },
          { label: 'مانگی ژمێریاری', value: selectedMonth, color: '#475569', icon: '📅' },
        ],
        summaryText: `کۆی کارمەندانی خاوەن ئیزافەی مانگ: ${monthlySummary.length} کارمەند • کۆی گشتی کاتژمێری زیادەی تۆمارکراو: ${totalMonthlyHours.toFixed(1)} کاتژمێر • کۆی گشتی پارەی شایستەی کاتی زیادەی مانگ: ${totalMonthlyCost.toLocaleString()} دیناری عێراقی (IQD).`,
      });
    }
  };

  const handleExportCSV = () => {
    if (viewMode === 'daily') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name' },
        { header: 'پۆست', key: 'role' },
        { header: 'کاتی دەرچوون', key: 'checkOutTime' },
        { header: 'کاتی زیادەی کارکردن', key: 'hours' },
        { header: 'بڕی پارە (IQD)', key: 'amount' },
        { header: 'تێبینی و هۆکار', key: 'note' },
      ];
      const data = dailyRecords.map(r => ({
        name: r.employeeName,
        role: r.employeeRole,
        checkOutTime: r.checkOutTime || '-',
        hours: r.hours,
        amount: r.totalAmount,
        note: r.note || '-',
      }));
      exportToCSV(cols, data, `Ashley_Daily_Overtime_${selectedDate}`);
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name' },
        { header: 'پۆست', key: 'role' },
        { header: 'کاتی زیادەی کارکردن', key: 'hours' },
        { header: 'کۆی شایستەی پارە (IQD)', key: 'amount' },
      ];
      const data = monthlySummary.map(s => ({
        name: s.name,
        role: s.role,
        hours: s.totalHours.toFixed(1),
        amount: s.totalAmount,
      }));
      exportToCSV(cols, data, `Ashley_Monthly_Overtime_${selectedMonth}`);
    }
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE (ACTIVE & SYNCED) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-orange-950 via-amber-950 to-slate-950 text-white rounded-xl shadow-lg border border-orange-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-800/90 rounded-xl border border-orange-600 shadow-inner">
            <Clock className="w-6 h-6 text-orange-200" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-orange-50 flex items-center gap-2">
              <span>لیستی کاتی زیادەی کارمەندان (Overtime Hub)</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400 text-emerald-200 font-mono font-black">
                🟢 چالاک و پەیوەستکراو بە ئامادەبوون
              </span>
            </h2>
          </div>
        </div>

        {/* 🔄 ACTIONS & CLEAR BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleClearAllOvertime}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border-rose-400 shadow-md cursor-pointer px-3 py-1.5 rounded-lg"
            title="سڕینەوەی سەرجەم کاتی زیادە و تێبینیەکان"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
            <span>🗑️ سڕینەوەی سەرجەم داتاکان (Clear All)</span>
          </button>

          <button
            onClick={handleSyncGoogleSheet}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-300 shadow-md cursor-pointer px-3 py-1.5 rounded-lg"
            title="هەناردەکردنی کاتی زیادەی مانگانە و ڕۆژانە بۆ فایلی Google Sheets / Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-950" />
            <span>📊 هەناردەکردن بۆ Google Sheets</span>
          </button>
        </div>
      </div>

      {/* 🛠️ TOP CONTROLS & TIMEFRAME SELECTOR */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 border-2 border-slate-300 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              viewMode === 'daily' 
                ? 'bg-orange-800 text-white shadow-md border border-orange-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>📅 تۆمار و ئاماری ڕۆژانە (Daily Calendar 1-31)</span>
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              viewMode === 'monthly' 
                ? 'bg-orange-800 text-white shadow-md border border-orange-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>📊 ئاماری مانگانەی کاتی زیادە (تەنها کاتی زیادە و پارە)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          {/* 📅 Icon-only Month Picker */}
          <div 
            className="relative h-8 w-8 rounded-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs transition-all cursor-pointer"
            title={`دیاریکردنی مانگ (${selectedMonth})`}
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title={`دیاریکردنی مانگ (${selectedMonth})`}
            />
          </div>

          <button
            onClick={handleExportPDF}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 shadow-2xs transition-all active:scale-90 cursor-pointer"
            title="هەناردەی PDF / چاپکردن"
            aria-label="Export PDF"
          >
            <Printer className="w-4 h-4 text-red-700" />
          </button>

          <button
            onClick={handleExportCSV}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs transition-all active:scale-90 cursor-pointer"
            title="هەناردەی CSV / ئێکسڵ"
            aria-label="Export CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      </div>

      {/* 📅 1-31 INTERACTIVE CALENDAR DAY SELECTOR BAR (FOR DAILY VIEW) */}
      {viewMode === 'daily' && (
        <div className="bg-white border-2 border-orange-300/80 rounded-xl p-2.5 shadow-sm space-y-2">
          <div className="flex items-center justify-between border-b border-orange-100 pb-1.5">
            <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span>کالێندەری ۱ تا ۳۱ی مانگی ({selectedMonth}) - ڕۆژ دیاری بکە:</span>
            </span>
            <span className="text-[11px] font-mono font-bold bg-orange-100 text-orange-900 border border-orange-300 px-2 py-0.5 rounded">
              ڕۆژی هەڵبژێردراو: {selectedDate}
            </span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 lg:grid-cols-31 gap-1">
            {monthDaysList.map((day) => {
              const isSelected = selectedDate === day.dateStr;
              const hasOt = day.overtimeCount > 0;

              return (
                <button
                  key={day.dayNum}
                  type="button"
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`relative p-1.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-orange-800 text-white border-orange-950 font-black shadow-md scale-105 z-10'
                      : hasOt
                      ? 'bg-amber-100/80 text-amber-950 border-amber-300 hover:bg-amber-200'
                      : day.isFriday
                      ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={`${day.dateStr} - ${day.dayName} ${hasOt ? `(${day.overtimeCount} ئیزافە)` : ''}`}
                >
                  <span className="text-xs font-mono font-black">{day.dayNum}</span>
                  <span className="text-[8px] font-medium opacity-80 truncate max-w-full">
                    {day.dayName.slice(0, 3)}
                  </span>
                  {hasOt && (
                    <span className={`text-[8px] font-bold px-1 rounded-full mt-0.5 ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-600 text-white'
                    }`}>
                      {day.overtimeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 📊 SUMMARY KPI BADGES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="panel-classic p-2.5 text-center bg-blue-50/80 border-2 border-blue-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-blue-900 block font-bold">
            {viewMode === 'daily' ? 'کارمەندانی خاوەن ئیزافەی ئەمڕۆ' : 'کارمەندانی خاوەن ئیزافەی مانگ'}
          </span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">
            {viewMode === 'daily' ? `${dailyRecords.length} کارمەند` : `${monthlySummary.length} کارمەند`}
          </p>
        </div>

        <div className="panel-classic p-2.5 text-center bg-amber-50/80 border-2 border-amber-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-amber-900 block font-bold">
            {viewMode === 'daily' ? 'کۆی کاتژمێری ئیزافەی ئەمڕۆ' : 'کۆی کاتژمێری ئیزافەی مانگ'}
          </span>
          <p className="text-base font-black text-amber-950 font-mono mt-0.5">
            {viewMode === 'daily' ? `${totalDailyHours.toFixed(1)} کاتژمێر` : `${totalMonthlyHours.toFixed(1)} کاتژمێر`}
          </p>
        </div>

        <div className="panel-classic p-2.5 text-center bg-emerald-50/80 border-2 border-emerald-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-emerald-900 block font-bold">
            {viewMode === 'daily' ? 'کۆی شایستەی پارەی ئەمڕۆ' : 'کۆی گشتی پارەی مانگ'}
          </span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">
            {viewMode === 'daily' ? `${totalDailyCost.toLocaleString()} IQD` : `${totalMonthlyCost.toLocaleString()} IQD`}
          </p>
        </div>

        <div className="panel-classic p-2.5 text-center bg-purple-50/80 border-2 border-purple-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-purple-900 block font-bold">دۆخی سیستەم</span>
          <p className="text-xs font-black text-purple-950 mt-1">
            ✅ سیستەمی زیندوو
          </p>
        </div>
      </div>

      {/* 📝 MANUAL OVERTIME ENTRY FORM */}
      <form onSubmit={handleAddManualOvertime} className="p-3 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border-2 border-amber-300 rounded-xl shadow-sm space-y-2">
        <div className="flex items-center justify-between border-b border-amber-300/80 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="p-1 bg-amber-600 text-white rounded">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-xs font-black text-amber-950">
              تۆمارکردنی کاتی زیادەی دەستی (Manual Overtime Entry)
            </h3>
          </div>
          <span className="text-[10px] bg-amber-200 text-amber-900 border border-amber-400 px-2 py-0.5 rounded font-mono font-bold">
            بەرواری تۆمار: {selectedDate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">ناوی کارمەند:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="input-classic w-full font-bold bg-white border-amber-300"
              required
            >
              <option value="">-- هەڵبژاردنی کارمەند --</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">ژمارەی کاتژمێر (Hours):</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              placeholder="بۆ نموونە: 2"
              className="input-classic w-full font-mono font-bold bg-white border-amber-300"
              required
            />
          </div>

          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">نرخی کاتژمێر (IQD):</label>
            <input
              type="number"
              step="500"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              className="input-classic w-full font-mono font-bold bg-white border-amber-300"
            />
          </div>

          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">تێبینی، جۆری ئیش و هۆکار:</label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="نقڵی ماڵان، چاککردنەوە، کارکردنی شەوان..."
              className="input-classic w-full font-bold bg-white border-amber-300"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-classic text-xs font-black flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white border-amber-900 shadow-sm cursor-pointer px-4 py-1 rounded">
            <Plus className="w-3.5 h-3.5" />
            <span>تۆمارکردنی ئەم ئیزافەیە</span>
          </button>
        </div>
      </form>

      {/* 📋 ANALYTICS & DATA TABLE CONTAINER */}
      <div className="border-2 border-slate-300 bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-slate-800 text-white p-2 px-3 flex items-center justify-between">
          <h3 className="text-xs font-black flex items-center gap-2">
            <span>
              📋 {viewMode === 'daily' 
                ? `خشتەی کاتی زیادەی ڕۆژی (${selectedDate}) - لەگەڵ تێبینی و وردەکارییەکان` 
                : `ئاماری مانگانەی کاتی زیادە (${selectedMonth}) - تەنها کاتی زیادە و بڕی پارە`}
            </span>
          </h3>
          <span className="text-[10px] font-mono text-slate-300">
            {viewMode === 'daily' ? `${dailyRecords.length} کارمەند` : `${monthlySummary.length} کارمەند`}
          </span>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'daily' ? (
            /* 📅 DAILY OVERTIME TABLE WITH DIRECT EDIT & NOTES */
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300">پۆست / ئەرک</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کاتی دەرچوون</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کاتی زیادەی کارکردن</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">بڕی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 border-l border-slate-300 bg-amber-50 text-amber-950">تێبینی و جۆری ئیش</th>
                  <th className="p-2.5 border-l border-slate-300 text-center w-24">سەرچاوە</th>
                  <th className="p-2.5 text-center w-24">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                      هیچ کاتێکی زیادە بۆ ئەم بەروارە ({selectedDate}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  <>
                    {dailyRecords.map((rec, idx) => {
                      const noteKey = `${rec.employeeId}_${rec.date}`;
                      const isEditingNote = editingNoteKey === noteKey;
                      const savedNote = adminNotes[noteKey] || rec.note;

                      return (
                        <tr key={rec.id} className="hover:bg-amber-50/40 font-bold transition-all">
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{rec.employeeName}</td>
                          <td className="p-2.5 border-l border-slate-200 text-slate-600">{rec.employeeRole}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">
                            {rec.checkOutTime ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-black">
                                📤 {formatTime12H(rec.checkOutTime)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-blue-900 font-black">
                            +{rec.hours} کاتژمێر
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-900 font-black">
                            +{rec.totalAmount.toLocaleString()} IQD
                          </td>
                          <td className="p-2.5 border-l border-slate-200 bg-amber-50/40">
                            {isEditingNote ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="نووسینی هۆکار / تێبینی..."
                                  value={tempNoteText}
                                  onChange={(e) => setTempNoteText(e.target.value)}
                                  className="input-classic flex-1 text-xs bg-white font-bold py-0.5"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveNote(noteKey)}
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
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-slate-800 text-[11px]">
                                  {savedNote || <span className="text-slate-400 italic">بێ تێبینی</span>}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingNoteKey(noteKey);
                                    setTempNoteText(savedNote || '');
                                  }}
                                  className="text-amber-900 hover:text-amber-950 p-0.5 rounded text-[10px] font-black border border-amber-300 bg-amber-100 hover:bg-amber-200"
                                >
                                  <Edit3 className="w-2.5 h-2.5 inline mr-0.5" />
                                  <span>{savedNote ? 'دەستکاری' : 'نووسین'}</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-center">
                            {rec.source === 'attendance' ? (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 text-[10px]">
                                ⚡ سیستەم
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 text-[10px]">
                                ✍️ دەستی
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditModal(rec)}
                                className="text-blue-700 hover:text-blue-950 p-1 hover:bg-blue-100 rounded transition-all"
                                title="دەستکاریکردنی ژمارەی کاتژمێر و نرخ و تێبینی"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              {rec.source === 'manual' && (
                                <button
                                  onClick={() => handleDelete(rec.id)}
                                  className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                                  title="سڕینەوە"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Grand Total Footer Row */}
                    <tr className="bg-slate-200 border-t-2 border-slate-400 text-slate-950 font-black">
                      <td colSpan={4} className="p-2.5 text-left border-l border-slate-300">
                        کۆی گشتی ئیزافەی ڕۆژی ({selectedDate}):
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-blue-950">
                        +{totalDailyHours.toFixed(1)} کاتژمێر
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-emerald-950">
                        +{totalDailyCost.toLocaleString()} IQD
                      </td>
                      <td colSpan={3} className="p-2.5 text-slate-600 font-normal">
                        ({dailyRecords.length} کارمەندی خاوەن ئیزافە)
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            /* 📊 MONTHLY OVERTIME SUMMARY TABLE (OVERTIME HOURS & PAYOUT ONLY) */
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300">پۆست / ئەرک</th>
                  <th className="p-2.5 border-l border-slate-300 text-center bg-amber-50 text-amber-950">کاتی زیادەی کارکردن</th>
                  <th className="p-2.5 border-l border-slate-300 text-center bg-emerald-50 text-emerald-950">کۆی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 text-center w-36">وردەکاری ڕۆژەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {monthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ کارمەندێک لە مانگی ({selectedMonth}) کاتی زیادەی نەبووە.
                    </td>
                  </tr>
                ) : (
                  <>
                    {monthlySummary.map((sum, idx) => {
                      const isExpanded = expandedEmpId === sum.empId;
                      return (
                        <React.Fragment key={sum.empId}>
                          <tr 
                            onClick={() => setExpandedEmpId(isExpanded ? null : sum.empId)}
                            className={`cursor-pointer transition-all ${isExpanded ? 'bg-orange-100/70' : 'hover:bg-slate-50'}`}
                          >
                            <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{sum.name}</td>
                            <td className="p-2.5 border-l border-slate-200 text-slate-600">{sum.role}</td>
                            <td className="p-2.5 border-l border-slate-200 text-center font-mono text-blue-900 font-black bg-amber-50/40">
                              +{sum.totalHours.toFixed(1)} کاتژمێر
                            </td>
                            <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-900 font-black bg-emerald-50/40">
                              +{sum.totalAmount.toLocaleString()} IQD
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black border transition-all inline-flex items-center gap-1 ${
                                isExpanded 
                                  ? 'bg-orange-800 text-white border-orange-950 shadow-sm' 
                                  : 'bg-orange-50 text-orange-900 border-orange-300 hover:bg-orange-100'
                              }`}>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                <span>{isExpanded ? 'داخستن' : 'ڕۆژەکان و نۆت'}</span>
                              </span>
                            </td>
                          </tr>

                          {/* 🔍 EXPANDED DAILY RECORDS FOR THIS EMPLOYEE */}
                          {isExpanded && (
                            <tr className="bg-orange-50/50 border-y-2 border-orange-300">
                              <td colSpan={6} className="p-3">
                                <div className="bg-white border border-orange-200 rounded-lg p-3 shadow-inner space-y-2">
                                  <h4 className="text-[11px] font-black text-orange-950 flex items-center gap-1.5 border-b border-orange-100 pb-1">
                                    <span>📅 وردەکاری ڕۆژانی ئیزافەی ({sum.name}) بۆ مانگی ({selectedMonth}):</span>
                                  </h4>
                                  <table className="w-full text-right text-xs border border-slate-200">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-800 font-black text-[11px]">
                                        <th className="p-1.5 border-l border-slate-200 text-center">بەروار</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">دەرچوون</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">کاتی زیادەی کارکردن</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">کۆی پارە</th>
                                        <th className="p-1.5 border-l border-slate-200">تێبینی و جۆری ئیش</th>
                                        <th className="p-1.5 text-center w-20">دەستکاری</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold">
                                      {sum.records.map((r) => (
                                        <tr key={r.id} className="hover:bg-orange-50/30">
                                          <td className="p-1.5 border-l border-slate-200 text-center font-mono text-slate-900">{r.date}</td>
                                          <td className="p-1.5 border-l border-slate-200 text-center font-mono text-rose-800">{formatTime12H(r.checkOutTime)}</td>
                                          <td className="p-1.5 border-l border-slate-200 text-center font-mono text-blue-900">+{r.hours} کاتژمێر</td>
                                          <td className="p-1.5 border-l border-slate-200 text-center font-mono text-emerald-900">
                                            +{r.totalAmount.toLocaleString()} IQD
                                          </td>
                                          <td className="p-1.5 border-l border-slate-200 text-slate-800">{r.note || '-'}</td>
                                          <td className="p-1.5 text-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenEditModal(r);
                                              }}
                                              className="text-blue-700 hover:text-blue-900 p-0.5 rounded hover:bg-blue-100"
                                              title="دەستکاری"
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Grand Total Footer Row */}
                    <tr className="bg-slate-200 border-t-2 border-slate-400 text-slate-950 font-black">
                      <td colSpan={3} className="p-2.5 text-left border-l border-slate-300">
                        کۆی گشتی مانگی ({selectedMonth}):
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-blue-950 bg-amber-100/50">
                        +{totalMonthlyHours.toFixed(1)} کاتژمێر
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-emerald-950 bg-emerald-100/50">
                        +{totalMonthlyCost.toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 text-center text-slate-500 font-normal">
                        ({monthlySummary.length} کارمەند)
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ✏️ MODAL: EDIT OVERTIME RECORD */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border-2 border-orange-400 shadow-2xl max-w-md w-full p-5 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-orange-600" />
                <span>دەستکاریکردنی تۆماری ئیزافە ({editingRecord.employeeName})</span>
              </h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-3">
              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">بەروار:</label>
                <input
                  type="text"
                  value={editingRecord.date}
                  disabled
                  className="input-classic w-full bg-slate-100 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">کاتی زیادەی کارکردن (Hours):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={editForm.hours}
                  onChange={(e) => setEditForm({ ...editForm, hours: e.target.value })}
                  className="input-classic w-full font-mono font-bold text-xs bg-white border-orange-300"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">نرخی کاتژمێر (IQD):</label>
                <input
                  type="number"
                  step="500"
                  value={editForm.rate}
                  onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                  className="input-classic w-full font-mono font-bold text-xs bg-white border-orange-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 text-xs font-bold mb-1">تێبینی و جۆری ئیش:</label>
                <input
                  type="text"
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="جۆری ئیش، هۆکار، وردەکاری..."
                  className="input-classic w-full text-xs font-bold bg-white border-orange-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="btn-classic text-xs px-3 py-1.5"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="btn-classic-primary text-xs px-4 py-1.5 flex items-center gap-1.5 bg-orange-700 hover:bg-orange-800 text-white"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>پاشەکەوتکردنی گۆڕانکاری</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
