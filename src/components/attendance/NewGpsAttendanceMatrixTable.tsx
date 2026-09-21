'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { 
  Calendar, 
  MapPin, 
  Search, 
  Smartphone, 
  Move, 
  BarChart3, 
  X, 
  Crown, 
  Award, 
  Printer, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Camera, 
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Download,
  TrendingUp,
  MessageSquare,
  MessageSquareText,
  User,
  ShieldCheck,
  Sparkles,
  CheckSquare,
  Square,
  Layers,
  SlidersHorizontal,
  CalendarRange,
  MousePointerClick
} from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { AdminEmployeeDetailsModal } from '@/components/admin/AdminEmployeeDetailsModal';
import { exportAshleyOfficialLetterheadPDF, type AshleyOfficialReportRow } from '@/lib/export-utils';
import { useAppContext } from '@/context/app-provider';
import { resolveEmployeeDayAttendance, getCheckInStatus, getCheckOutStatus } from '@/lib/attendance-helpers';

interface NewGpsAttendanceMatrixTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

// 🎨 6 Distinct Day-of-Week Color Themes (+ Friday Holiday) for Effortless Daily Visual Tracking
const DAY_THEMES: Record<number, {
  name: string;
  shortName: string;
  headerCls: string;
  cellCls: string;
}> = {
  6: { // 1. Saturday / شەممە (Sky Blue)
    name: 'شەممە',
    shortName: 'شەممە',
    headerCls: 'bg-sky-100/80 text-sky-950 dark:bg-sky-950/50 dark:text-sky-200 border-t-2 border-t-sky-500',
    cellCls: 'bg-sky-50/40 dark:bg-sky-950/15',
  },
  0: { // 2. Sunday / یەکشەممە (Indigo)
    name: 'یەکشەممە',
    shortName: 'یەکشەم',
    headerCls: 'bg-indigo-100/80 text-indigo-950 dark:bg-indigo-950/50 dark:text-indigo-200 border-t-2 border-t-indigo-500',
    cellCls: 'bg-indigo-50/40 dark:bg-indigo-950/15',
  },
  1: { // 3. Monday / دووشەممە (Amber)
    name: 'دووشەممە',
    shortName: 'دووشەم',
    headerCls: 'bg-amber-100/80 text-amber-950 dark:bg-amber-950/50 dark:text-amber-200 border-t-2 border-t-amber-500',
    cellCls: 'bg-amber-50/40 dark:bg-amber-950/15',
  },
  2: { // 4. Tuesday / سێشەممە (Violet)
    name: 'سێشەممە',
    shortName: 'سێشەم',
    headerCls: 'bg-purple-100/80 text-purple-950 dark:bg-purple-950/50 dark:text-purple-200 border-t-2 border-t-purple-500',
    cellCls: 'bg-purple-50/40 dark:bg-purple-950/15',
  },
  3: { // 5. Wednesday / چوارشەممە (Emerald)
    name: 'چوارشەممە',
    shortName: 'چوارشەم',
    headerCls: 'bg-teal-100/80 text-teal-950 dark:bg-teal-950/50 dark:text-teal-200 border-t-2 border-t-teal-500',
    cellCls: 'bg-teal-50/40 dark:bg-teal-950/15',
  },
  4: { // 6. Thursday / پێنجشەممە (Rose)
    name: 'پێنجشەممە',
    shortName: 'پێنجشەم',
    headerCls: 'bg-rose-100/80 text-rose-950 dark:bg-rose-950/50 dark:text-rose-200 border-t-2 border-t-rose-500',
    cellCls: 'bg-rose-50/40 dark:bg-rose-950/15',
  },
  5: { // 7. Friday / هەینی (Holiday - Emerald)
    name: 'هەینی',
    shortName: 'هەینی',
    headerCls: 'bg-emerald-200/90 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-200 border-t-2 border-t-emerald-600',
    cellCls: 'bg-emerald-100/50 dark:bg-emerald-950/25',
  },
};

export function NewGpsAttendanceMatrixTable({ employees = [], attendanceLogs = [] }: NewGpsAttendanceMatrixTableProps) {
  const { settings, isLoading: isGlobalLoading } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 🌟 Employee 360 HR Dossier Modal State
  const [selectedEmp360, setSelectedEmp360] = useState<Employee | null>(null);

  // Cell Click Modal State for In-depth Editing & 24h Visual Graph
  const [selectedDayModal, setSelectedDayModal] = useState<{
    emp: Employee;
    dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean; dayOfWeek: number };
    info: any;
  } | null>(null);

  // Modal Form States
  const [modalStatus, setModalStatus] = useState<string>('Present');
  const [modalCheckIn, setModalCheckIn] = useState<string>('08:00');
  const [modalCheckOut, setModalCheckOut] = useState<string>('17:00');
  const [modalAdminNote, setModalAdminNote] = useState<string>('');
  const [modalAdminCheckInNote, setModalAdminCheckInNote] = useState<string>('');
  const [modalAdminCheckOutNote, setModalAdminCheckOutNote] = useState<string>('');
  const [modalAdminDecision, setModalAdminDecision] = useState<'waived' | 'penalized' | null>(null);
  const [modalCheckInDecision, setModalCheckInDecision] = useState<'waived' | 'penalized' | null>(null);
  const [modalCheckOutDecision, setModalCheckOutDecision] = useState<'waived' | 'penalized' | null>(null);
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  // Dynamic Manual Overrides Map for cell statuses (Initialized with instant cache if available)
  const [manualStatusMap, setManualStatusMap] = useState<Record<string, { 
    status: string; 
    checkInTime?: string; 
    checkOutTime?: string; 
    rawCheckIn?: string; 
    rawCheckOut?: string; 
    checkInNote?: string;
    checkOutNote?: string; 
    note?: string; 
    adminNote?: string;
    adminCheckInNote?: string;
    adminCheckOutNote?: string;
    historyLogs?: any[];
    adminDecision?: 'waived' | 'penalized' | null;
    adminCheckInDecision?: 'waived' | 'penalized' | null;
    adminCheckOutDecision?: 'waived' | 'penalized' | null;
    isWaived?: boolean;
    isCheckInWaived?: boolean;
    isCheckOutWaived?: boolean;
    deletedAt?: number;
  }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const curMonth = format(new Date(), 'yyyy-MM');
        const cached = localStorage.getItem(`ashley_matrix_overrides_${curMonth}`);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {};
  });

  // Track whether saved records have loaded from server
  const [isRecordsLoaded, setIsRecordsLoaded] = useState<boolean>(false);
  const isWaitingData = !isRecordsLoaded || isGlobalLoading;

  // 🖥️ Fit to Screen / Density View Mode ('fit' = 100% on screen, 'normal' = wide expanded)
  const [tableFitMode, setTableFitMode] = useState<'fit' | 'normal'>('fit');

  // 🖨️ Custom Range Print / Google Sheets Export Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printStartDay, setPrintStartDay] = useState<number>(1);
  const [printEndDay, setPrintEndDay] = useState<number>(31);
  const [printEmployeeFilter, setPrintEmployeeFilter] = useState<'all' | 'managers' | 'custom'>('all');
  const [selectedPrintEmpIds, setSelectedPrintEmpIds] = useState<string[]>([]);

  // 🎯 Multi-Select & Batch Edit States
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedCells, setSelectedCells] = useState<Record<string, { empId: string; empName: string; dateStr: string; dayNum: number }>>({});
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);

  // Batch Form State
  const [batchStatus, setBatchStatus] = useState<string>('Present');
  const [batchCheckIn, setBatchCheckIn] = useState<string>('08:00');
  const [batchCheckOut, setBatchCheckOut] = useState<string>('17:00');
  const [batchNote, setBatchNote] = useState<string>('');
  const [isApplyingBatch, setIsApplyingBatch] = useState<boolean>(false);

  // Range Selector Modal State
  const [rangeTargetEmp, setRangeTargetEmp] = useState<string>('all'); // 'all', 'managers', or specific emp.id
  const [rangeStartDay, setRangeStartDay] = useState<number>(1);
  const [rangeEndDay, setRangeEndDay] = useState<number>(31);
  const [rangeDayType, setRangeDayType] = useState<'all' | 'workdays' | 'fridays'>('all');

  // 🖱️ Spreadsheet-Style Drag-To-Select (Google Sheets / Excel)
  const [isDraggingCells, setIsDraggingCells] = useState<boolean>(false);
  const [lastFocusedCell, setLastFocusedCell] = useState<{ r: number; c: number } | null>(null);
  const dragSelectionRef = React.useRef<{
    isDragging: boolean;
    start: { r: number; c: number } | null;
    hasMoved: boolean;
    baseSelected: Record<string, { empId: string; empName: string; dateStr: string; dayNum: number }>;
  }>({
    isDragging: false,
    start: null,
    hasMoved: false,
    baseSelected: {},
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '09', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  
  const daysArray = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const dateStr = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(year, month - 1, dayNum);
      const dayOfWeek = getDay(dateObj); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
      const isFriday = dayOfWeek === 5;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      return { dayNum, dateStr, isFriday, isFuture, isToday, dayOfWeek };
    });
  }, [totalDays, year, month, selectedMonth, todayStr]);

  // Adjust printEndDay & rangeEndDay if month days change
  useEffect(() => {
    setPrintEndDay(totalDays);
    setRangeEndDay(totalDays);
    setSelectedCells({});
  }, [totalDays, selectedMonth]);

  // Fetch saved manual records from server & Supabase
  const loadSavedRecords = useCallback(async () => {
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
            const historyLogs = (r.historyLogs && Array.isArray(r.historyLogs) && r.historyLogs.length > 0)
              ? r.historyLogs
              : (existing.historyLogs || []);
            const adminDecision = r.adminDecision || existing.adminDecision || null;
            const adminCheckInDecision = r.adminCheckInDecision || existing.adminCheckInDecision || null;
            const adminCheckOutDecision = r.adminCheckOutDecision || existing.adminCheckOutDecision || null;
            const isCheckInWaived = Boolean(r.isCheckInWaived ?? (adminCheckInDecision === 'waived') ?? existing.isCheckInWaived);
            const isCheckOutWaived = Boolean(r.isCheckOutWaived ?? (adminCheckOutDecision === 'waived') ?? existing.isCheckOutWaived);
            const isWaived = Boolean(r.isWaived ?? (adminDecision === 'waived') ?? (isCheckInWaived || isCheckOutWaived) ?? existing.isWaived);

            map[k] = {
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
              historyLogs,
              adminDecision,
              adminCheckInDecision,
              adminCheckOutDecision,
              isWaived,
              isCheckInWaived,
              isCheckOutWaived,
            };
          }
        });

        setManualStatusMap(map);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(map));
          } catch {}
        }
      } else if (Object.keys(localMap).length > 0) {
        setManualStatusMap(prev => ({ ...prev, ...localMap }));
      }
    } catch {
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(`ashley_matrix_overrides_${selectedMonth}`);
          if (cached) setManualStatusMap(prev => ({ ...prev, ...JSON.parse(cached) }));
        } catch {}
      }
    } finally {
      setIsRecordsLoaded(true);
    }
  }, [selectedMonth]);

  // Reset loading state whenever month switches
  useEffect(() => {
    setIsRecordsLoaded(false);
  }, [selectedMonth]);

  useEffect(() => {
    loadSavedRecords();
    const interval = setInterval(loadSavedRecords, 5000);
    return () => clearInterval(interval);
  }, [loadSavedRecords]);

  // 👑 Hierarchy Sorting: Highest importance (Darko / Manager) to least importance (Staff / Workers)
  const activeEmployees = useMemo(() => {
    const list = (employees || []).filter(e => {
      if (!e || e.status === 'resigned' || e.isActive === false) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const n1 = (e.name || '').toLowerCase();
        const n2 = (e.fullName3Part || '').toLowerCase();
        const p = (e.phone || '').toLowerCase();
        if (!n1.includes(q) && !n2.includes(q) && !p.includes(q)) return false;
      }
      return true;
    });

    const getRank = (emp: Employee): number => {
      const id = (emp.id || '').toLowerCase();
      const role = (emp.role || '').toLowerCase();
      const name = (emp.fullName3Part || emp.name || '').toLowerCase();

      // Top 1: Darko / General Manager / Executive
      if (id === 'emp-02' || name.includes('دارکۆ') || name.includes('darko') || role === 'manager') return 1;
      
      // Top 2: Branch Managers / Officers / Supervisors
      if (role.includes('manager') || role.includes('بەڕێوەبەر') || role.includes('لێپرسراو') || role.includes('admin')) return 2;
      
      // Top 3: Accountants & Warehouse Supervisors
      if (role.includes('ژمێریار') || role.includes('accountant') || role.includes('کۆگا') || role.includes('warehouse')) return 3;
      
      // Top 4: Technical & Field Specialists
      if (role.includes('ئەندازیار') || role.includes('engineer') || role.includes('سەرپەرشتیار') || role.includes('supervisor')) return 4;
      
      // Top 5: Staff / Regular Workers
      return 5;
    };

    return [...list].sort((a, b) => {
      const rankA = getRank(a);
      const rankB = getRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (a.fullName3Part || a.name || '').localeCompare(b.fullName3Part || b.name || '', 'ckb');
    });
  }, [employees, searchQuery]);

  // ==========================================
  // 🎯 MULTI-SELECT & BATCH EDITING SYSTEM
  // ==========================================
  const selectedCount = useMemo(() => Object.keys(selectedCells).length, [selectedCells]);

  // 🖱️ Calculate rectangular box selection between start cell (startR, startC) and current cell (currentR, currentC)
  const updateDragSelection = useCallback((
    startR: number, 
    startC: number, 
    currentR: number, 
    currentC: number, 
    base: Record<string, { empId: string; empName: string; dateStr: string; dayNum: number }>
  ) => {
    const minR = Math.min(startR, currentR);
    const maxR = Math.max(startR, currentR);
    const minC = Math.min(startC, currentC);
    const maxC = Math.max(startC, currentC);

    const next = { ...base };
    for (let r = minR; r <= maxR; r++) {
      const targetEmp = activeEmployees[r];
      if (!targetEmp) continue;
      const empName = targetEmp.fullName3Part || targetEmp.name;
      for (let c = minC; c <= maxC; c++) {
        const targetDay = daysArray[c];
        if (!targetDay) continue;
        const key = `${targetEmp.id}_${targetDay.dateStr}`;
        next[key] = {
          empId: targetEmp.id,
          empName,
          dateStr: targetDay.dateStr,
          dayNum: targetDay.dayNum,
        };
      }
    }
    setSelectedCells(next);
  }, [activeEmployees, daysArray]);

  // Global mouseup listener so dragging ends cleanly even if released outside the table
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragSelectionRef.current.isDragging) {
        dragSelectionRef.current.isDragging = false;
        setIsDraggingCells(false);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 1. Toggle single cell selection
  const toggleCellSelection = useCallback((empId: string, empName: string, dateStr: string, dayNum: number) => {
    const key = `${empId}_${dateStr}`;
    setSelectedCells(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { empId, empName, dateStr, dayNum };
      }
      return next;
    });
  }, []);

  // 2. Select / Deselect entire Day Column (for all active employees)
  const toggleDayColumn = useCallback((dayNum: number, dateStr: string) => {
    setSelectedCells(prev => {
      const next = { ...prev };
      const allSelected = activeEmployees.length > 0 && activeEmployees.every(emp => Boolean(next[`${emp.id}_${dateStr}`]));
      activeEmployees.forEach(emp => {
        const k = `${emp.id}_${dateStr}`;
        if (allSelected) {
          delete next[k];
        } else {
          next[k] = { empId: emp.id, empName: emp.fullName3Part || emp.name, dateStr, dayNum };
        }
      });
      return next;
    });
  }, [activeEmployees]);

  // 3. Select / Deselect entire Employee Row (all days of month)
  const toggleEmployeeRow = useCallback((empId: string, empName: string) => {
    setSelectedCells(prev => {
      const next = { ...prev };
      const allSelected = daysArray.length > 0 && daysArray.every(d => Boolean(next[`${empId}_${d.dateStr}`]));
      daysArray.forEach(d => {
        const k = `${empId}_${d.dateStr}`;
        if (allSelected) {
          delete next[k];
        } else {
          next[k] = { empId, empName, dateStr: d.dateStr, dayNum: d.dayNum };
        }
      });
      return next;
    });
  }, [daysArray]);

  // 4. Select Entire Matrix (All employees, all days)
  const selectAllMatrix = useCallback(() => {
    const next: Record<string, { empId: string; empName: string; dateStr: string; dayNum: number }> = {};
    activeEmployees.forEach(emp => {
      daysArray.forEach(d => {
        next[`${emp.id}_${d.dateStr}`] = {
          empId: emp.id,
          empName: emp.fullName3Part || emp.name,
          dateStr: d.dateStr,
          dayNum: d.dayNum
        };
      });
    });
    setSelectedCells(next);
  }, [activeEmployees, daysArray]);

  // 5. Clear All Selection
  const clearAllSelection = useCallback(() => {
    setSelectedCells({});
  }, []);

  // 6. Compute cells matching range criteria
  const computeRangeCells = useCallback(() => {
    const empsToSelect = rangeTargetEmp === 'all'
      ? activeEmployees
      : rangeTargetEmp === 'managers'
      ? activeEmployees.filter(e => e.role === 'Manager' || e.id === 'emp-02' || (e.fullName3Part || '').includes('دارکۆ'))
      : activeEmployees.filter(e => e.id === rangeTargetEmp);

    const cells: Array<{ empId: string; empName: string; dateStr: string; dayNum: number }> = [];
    empsToSelect.forEach(emp => {
      daysArray.forEach(d => {
        if (d.dayNum >= rangeStartDay && d.dayNum <= rangeEndDay) {
          if (rangeDayType === 'workdays' && d.isFriday) return;
          if (rangeDayType === 'fridays' && !d.isFriday) return;
          cells.push({
            empId: emp.id,
            empName: emp.fullName3Part || emp.name,
            dateStr: d.dateStr,
            dayNum: d.dayNum
          });
        }
      });
    });
    return cells;
  }, [rangeTargetEmp, rangeStartDay, rangeEndDay, rangeDayType, activeEmployees, daysArray]);

  // Select by Range criteria
  const selectByRange = useCallback(() => {
    const cells = computeRangeCells();
    setSelectedCells(prev => {
      const next = { ...prev };
      cells.forEach(c => {
        next[`${c.empId}_${c.dateStr}`] = c;
      });
      return next;
    });
    setIsMultiSelectMode(true);
    setShowBatchModal(false);
  }, [computeRangeCells]);

  // 7. Apply Batch Data and Persist to Supabase
  const handleApplyBatchData = useCallback(async (
    overrideStatus?: string, 
    overrideIn?: string, 
    overrideOut?: string,
    overrideNote?: string,
    customCells?: Array<{ empId: string; empName: string; dateStr: string; dayNum: number }>
  ) => {
    const targetStatus = overrideStatus || batchStatus;
    const targetIn = overrideIn || batchCheckIn;
    const targetOut = overrideOut || batchCheckOut;
    const targetNote = overrideNote !== undefined ? overrideNote : batchNote;

    const selectedList = customCells && customCells.length > 0 ? customCells : Object.values(selectedCells);
    if (selectedList.length === 0) return;

    setIsApplyingBatch(true);

    // Optimistic instant UI update
    setManualStatusMap(prev => {
      const next = { ...prev };
      selectedList.forEach(item => {
        const key = `${item.empId}_${item.dateStr}`;
        if (targetStatus === 'Empty') {
          delete next[key];
        } else {
          next[key] = {
            status: targetStatus,
            checkInTime: targetStatus === 'Present' ? targetIn : targetStatus === 'Leave' ? 'مۆڵەت' : undefined,
            checkOutTime: targetStatus === 'Present' ? targetOut : targetStatus === 'Leave' ? 'مۆڵەت' : undefined,
            rawCheckIn: targetIn,
            rawCheckOut: targetOut,
            adminNote: targetNote || undefined,
            adminCheckInNote: targetNote || undefined,
            isWaived: false,
            adminDecision: null,
          };
        }
      });
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    // Close modal and clear selection immediately (0ms UI feedback)
    setSelectedCells({});
    setShowBatchModal(false);

    // Persistent server & Supabase batch sync
    try {
      const recordsPayload = selectedList.map(item => ({
        userId: item.empId,
        userName: item.empName,
        date: item.dateStr,
        status: targetStatus,
        action: targetStatus === 'Empty' ? 'delete' : undefined,
        checkInTime: targetStatus === 'Present' ? targetIn : undefined,
        checkOutTime: targetStatus === 'Present' ? targetOut : undefined,
        adminNote: targetNote || undefined,
        adminCheckInNote: targetNote || undefined,
      }));

      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: recordsPayload })
      });

      loadSavedRecords();
    } catch (err) {
      console.error('Batch save error:', err);
    } finally {
      setIsApplyingBatch(false);
    }
  }, [batchStatus, batchCheckIn, batchCheckOut, batchNote, selectedCells, selectedMonth, loadSavedRecords]);


  // Lookup record function for any employee & day with absolute Admin Override priority
  const getGpsLogsForEmpAndDay = useCallback((emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean }) => {
    return resolveEmployeeDayAttendance(emp, dayItem, manualStatusMap, attendanceLogs, isWaitingData);
  }, [manualStatusMap, attendanceLogs, isWaitingData]);

  // Open Cell Click Modal (Does NOT overwrite arbitrarily)
  const handleCellClick = (emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean; dayOfWeek: number }) => {
    const info = getGpsLogsForEmpAndDay(emp, dayItem);
    setSelectedDayModal({ emp, dayItem, info });
    setModalStatus(info.status === 'Empty' ? 'Present' : info.status);
    setModalCheckIn(info.checkInTime || '08:00');
    // Keep checkOutTime empty if not yet recorded, never force 17:00 when employee is still working
    setModalCheckOut(info.checkOutTime || '');
    setModalAdminNote(info.adminNote || '');
    setModalAdminCheckInNote(info.adminCheckInNote || info.adminNote || '');
    setModalAdminCheckOutNote(info.adminCheckOutNote || '');
    
    // Decoupled decisions
    const checkInDec = info.adminCheckInDecision || (info.isCheckInWaived ? 'waived' : (info.adminDecision as 'waived' | 'penalized' | null) || (info.isWaived ? 'waived' : null));
    const checkOutDec = info.adminCheckOutDecision || (info.isCheckOutWaived ? 'waived' : null);
    setModalCheckInDecision(checkInDec);
    setModalCheckOutDecision(checkOutDec);
    setModalAdminDecision(checkInDec || checkOutDec || null);
  };

  // Save Modal Changes to Supabase
  const handleSaveModal = async () => {
    if (!selectedDayModal) return;
    setIsSavingModal(true);
    const { emp, dayItem, info } = selectedDayModal;
    const key = `${emp.id}_${dayItem.dateStr}`;

    const combinedAdminNote = [modalAdminCheckInNote, modalAdminCheckOutNote].filter(Boolean).join(' | ') || modalAdminNote;

    const prevCheckIn = info.checkInTime || info.rawCheckIn || '08:00';
    const prevCheckOut = info.checkOutTime || info.rawCheckOut || '';
    const isCheckInChanged = modalStatus === 'Present' && modalCheckIn !== prevCheckIn;
    const isCheckOutChanged = modalStatus === 'Present' && modalCheckOut !== prevCheckOut;
    const isStatusChanged = modalStatus !== info.status;
    const isNoteAdded = Boolean(modalAdminCheckInNote || modalAdminCheckOutNote || modalAdminNote);
    const isCheckInWaived = modalCheckInDecision === 'waived';
    const isCheckOutWaived = modalCheckOutDecision === 'waived';
    const isWaived = isCheckInWaived || isCheckOutWaived;
    const resolvedAdminDecision = modalCheckInDecision || modalCheckOutDecision || null;

    const nowFormatted = format(new Date(), 'yyyy/MM/dd - hh:mm a');
    const existingLogs = Array.isArray(info.historyLogs) ? [...info.historyLogs] : [];

    if (isCheckInChanged || isCheckOutChanged || isStatusChanged || isNoteAdded || modalCheckInDecision || modalCheckOutDecision) {
      existingLogs.unshift({
        id: `log-${Date.now()}`,
        time: nowFormatted,
        adminName: 'ئەدمین',
        checkInFrom: isCheckInChanged ? prevCheckIn : undefined,
        checkInTo: isCheckInChanged ? modalCheckIn : undefined,
        checkOutFrom: isCheckOutChanged ? prevCheckOut : undefined,
        checkOutTo: isCheckOutChanged ? (modalCheckOut || undefined) : undefined,
        statusFrom: isStatusChanged ? info.status : undefined,
        statusTo: isStatusChanged ? modalStatus : undefined,
        adminCheckInNote: modalAdminCheckInNote || undefined,
        adminCheckOutNote: modalAdminCheckOutNote || undefined,
        adminNote: combinedAdminNote || undefined,
        adminDecision: resolvedAdminDecision || undefined,
        decisionLabel: isWaived 
          ? 'چاوپۆشیکردن (لێخۆشبوون لە سەرپێچی)' 
          : resolvedAdminDecision === 'penalized' 
          ? 'حسابکردن لەسەر کارمەند (سزا)' 
          : undefined,
      });
    }

    const newRecord = {
      status: modalStatus,
      checkInTime: modalStatus === 'Present' ? modalCheckIn : modalStatus === 'Leave' ? 'مۆڵەت' : undefined,
      checkOutTime: modalStatus === 'Present' ? (modalCheckOut || undefined) : modalStatus === 'Leave' ? 'مۆڵەت' : undefined,
      adminNote: combinedAdminNote,
      adminCheckInNote: modalAdminCheckInNote,
      adminCheckOutNote: modalAdminCheckOutNote,
      checkInNote: info.checkInNote || info.note,
      checkOutNote: info.checkOutNote,
      note: info.note || info.checkInNote,
      rawCheckIn: info.rawCheckIn || info.checkInTime || '08:00',
      rawCheckOut: info.rawCheckOut || info.checkOutTime || '',
      historyLogs: existingLogs,
      adminDecision: resolvedAdminDecision,
      adminCheckInDecision: modalCheckInDecision,
      adminCheckOutDecision: modalCheckOutDecision,
      isWaived,
      isCheckInWaived,
      isCheckOutWaived,
    };

    try {
      // 1. Immediate UI update and persistent local store (0ms reaction)
      setManualStatusMap(prev => {
        const next = { ...prev, [key]: newRecord };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(next));
          } catch {}
        }
        return next;
      });

      // Close modal IMMEDIATELY (0ms instant user feedback)
      setSelectedDayModal(null);
      setIsSavingModal(false);

      // 2. Persistent server sync in background
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: emp.id,
          userName: emp.fullName3Part || emp.name,
          date: dayItem.dateStr,
          status: modalStatus,
          checkInTime: modalStatus === 'Present' ? modalCheckIn : undefined,
          checkOutTime: modalStatus === 'Present' ? (modalCheckOut || undefined) : undefined,
          adminNote: combinedAdminNote || undefined,
          adminCheckInNote: modalAdminCheckInNote || undefined,
          adminCheckOutNote: modalAdminCheckOutNote || undefined,
          note: info.note || info.checkInNote || undefined,
          checkInNote: info.checkInNote || undefined,
          checkOutNote: info.checkOutNote || undefined,
          historyLogs: existingLogs,
          adminDecision: resolvedAdminDecision,
          adminCheckInDecision: modalCheckInDecision,
          adminCheckOutDecision: modalCheckOutDecision,
          isWaived,
          isCheckInWaived,
          isCheckOutWaived,
        })
      });

      loadSavedRecords();
    } catch (e) {
      console.error('Error saving modal attendance edit:', e);
    } finally {
      setIsSavingModal(false);
    }
  };

  // 🗑️ Delete / Clear Record -> Removes overrides so subsequent live check-ins show immediately
  const handleDeleteDayRecord = async () => {
    if (!selectedDayModal) return;
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم داتایە بە تەواوی؟ خانەکە بەتاڵ دەبێتەوە.')) return;
    const { emp, dayItem } = selectedDayModal;
    const key = `${emp.id}_${dayItem.dateStr}`;
    const rawNum = emp.id.replace('emp-', '');

    // 1. Close modal IMMEDIATELY (0ms reaction)
    setSelectedDayModal(null);

    // 2. Cleanly remove key from override map so it doesn't block future live check-ins
    setManualStatusMap(prev => {
      const next = { ...prev };
      delete next[key];
      delete next[`${rawNum}_${dayItem.dateStr}`];
      delete next[`emp-${rawNum}_${dayItem.dateStr}`];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    // 3. Persistent server sync in background (deletes from attendance and attendance_logs in Supabase)
    try {
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: emp.id,
          userName: emp.fullName3Part || emp.name,
          date: dayItem.dateStr,
          action: 'delete',
          status: 'empty'
        })
      });
      loadSavedRecords();
    } catch (e) {
      console.error('Error deleting record:', e);
    }
  };


  // 🖨️ Filtered Employees for Print
  const printEmployees = useMemo(() => {
    if (printEmployeeFilter === 'managers') {
      return activeEmployees.filter(e => e.role === 'Manager' || e.id === 'emp-02' || (e.fullName3Part || e.name || '').includes('دارکۆ'));
    }
    if (printEmployeeFilter === 'custom' && selectedPrintEmpIds.length > 0) {
      return activeEmployees.filter(e => selectedPrintEmpIds.includes(e.id));
    }
    return activeEmployees;
  }, [activeEmployees, printEmployeeFilter, selectedPrintEmpIds]);

  // 🖨️ Filtered Days for Print
  const printDays = useMemo(() => {
    return daysArray.filter(d => d.dayNum >= printStartDay && d.dayNum <= printEndDay);
  }, [daysArray, printStartDay, printEndDay]);

  // 🌟 Company Wide Monthly Attendance KPIs
  const companyStats = useMemo(() => {
    let presentToday = 0;
    let totalHours = 0;
    let totalLate = 0;
    let totalWorkableOpportunities = 0;
    let totalPresentOpportunities = 0;

    activeEmployees.forEach(emp => {
      daysArray.forEach(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        const isPresent = info.status === 'Present' || Boolean(info.checkInTime);
        if (d.isToday && isPresent) {
          presentToday++;
        }
        if (isPresent) {
          totalHours += (info.workedHours !== undefined ? info.workedHours : 8);
          totalPresentOpportunities++;
          const inT = (info.checkInTime || '08:00').slice(0, 5);
          if (inT > '08:15') totalLate++;
        }
        if (!d.isFuture && !d.isFriday) {
          totalWorkableOpportunities++;
        }
      });
    });

    const rate = totalWorkableOpportunities > 0 
      ? Math.min(100, Math.round((totalPresentOpportunities / totalWorkableOpportunities) * 100)) 
      : 100;

    return {
      presentToday,
      totalHours,
      totalLate,
      rate
    };
  }, [activeEmployees, daysArray, getGpsLogsForEmpAndDay]);

  // 📊 EXPORT MATRIX TO EXCEL (.XLSX)
  const handleExportExcelMatrix = () => {
    try {
      const headerRow = [
        '#',
        'ناوی کارمەند',
        'پۆست',
        'ناسنامە (ID)',
        ...daysArray.map(d => `${d.dayNum} ${d.isFriday ? '(هەینی)' : ''}`),
        'ڕۆژانی دەوام',
        'کۆی کاژێر',
        'درەنگکەوتن',
        'غیاب',
        'ڕێژەی دەوام'
      ];

      const dataRows = activeEmployees.map((emp, idx) => {
        let presentCount = 0;
        let totalHours = 0;
        let absentCount = 0;
        let lateCount = 0;

        const dayValues = daysArray.map(d => {
          const info = getGpsLogsForEmpAndDay(emp, d);
          const isPresent = info.status === 'Present' || Boolean(info.checkInTime);
          if (isPresent) {
            presentCount++;
            totalHours += (info.workedHours !== undefined ? info.workedHours : 8);
            const inT = (info.checkInTime || '08:00').slice(0, 5);
            if (inT > '08:15') lateCount++;
            return `هاتن: ${info.checkInTime || '08:00'} | ڕۆیشتن: ${info.checkOutTime || '17:00'}`;
          }
          if (d.isFriday || info.status === 'Holiday') return 'پشوو (هەینی)';
          if (info.status === 'Leave' || info.status === 'مۆڵەت') return 'مۆڵەت';
          if (!d.isFuture) {
            absentCount++;
            return 'غیاب';
          }
          return '-';
        });

        const workableDays = Math.max(1, daysArray.filter(d => !d.isFuture && !d.isFriday).length);
        const rate = Math.min(100, Math.round((presentCount / workableDays) * 100));

        return [
          idx + 1,
          emp.fullName3Part || emp.name,
          emp.role || 'کارمەند',
          emp.id,
          ...dayValues,
          `${presentCount} ڕۆژ`,
          `${totalHours}h`,
          lateCount,
          absentCount,
          `%${rate}`
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([
        [`کۆمپانیای ئاشڵی (Ashley Company) - خشتەی ئامادەبوونی ۳۱ ڕۆژەی کارمەندان مانگی ${selectedMonth}`],
        [`بەرواری دەرکردنی ڕاپۆرت: ${todayStr} | شێفتی فەرمی: 08:00 بۆ 17:00 (پشووی نیوەڕۆ: 12:00 - 13:00)`],
        [],
        headerRow,
        ...dataRows
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Attendance_${selectedMonth}`);
      XLSX.writeFile(wb, `Ashley_Attendance_${selectedMonth}.xlsx`);
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا لە دروستکردنی فایلی ئێکسڵ: ' + err.message);
    }
  };

  // 📄 EXPORT OFFICIAL ASHLEY LETTERHEAD PDF (31-DAY MATRIX + KPI SUMMARY)
  const handleExportOfficialLetterheadPDF = () => {
    handleOpenCleanPrintNewTab();
  };

  // 🖨️ OPEN PURE CLEAN PRINT IN SEPARATED NEW TAB (AUTO-FIT LANDSCAPE A4/A3)
  const handleOpenCleanPrintNewTab = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('تکایە ڕێگە بدە بە کردنەوەی پەنجەرەی نوێ (Pop-up blocker) لە برۆوسەرەکەتدا.');
      return;
    }

    const motherCompany = settings?.motherCompanyName || 'کۆمپانیای گروپی دیوان';
    const motherCompanySubtitle = settings?.motherCompanySubtitle || 'ناسنامەی مۆبیلیات';
    const brandName = settings?.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی';
    const brandSubtitle = settings?.brandSubtitle || 'Official Document';
    const agencyTitle = settings?.agencyTitle || 'بریکاری سەرەکی مۆبیلیاتی ئاشڵین لە هەموو عێراق';
    const slogan = settings?.brandSlogan || 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)';
    const diwanLogo = settings?.diwanLogo || '/diwan-logo.svg';
    const reportLogo = settings?.reportLogo || settings?.ashleyLogo || settings?.appLogo || '/ashley-logo.png';
    const docTitle = settings?.letterheadDocumentTitle || 'خشتەی تۆماری ئامادەبوونی فەرمی';
    const docSubtitle = settings?.letterheadDocumentSubtitle || agencyTitle;
    const primaryColor = settings?.letterheadPrimaryColor || '#0f172a';
    const accentColor = settings?.letterheadAccentColor || '#d97706';
    const titleColor = settings?.letterheadTitleColor || primaryColor;

    const isFullRange = printDays.length > 18;

    let globalPresentDays = 0;
    let globalWorkedHours = 0;
    let globalLateCount = 0;
    let globalAbsentCount = 0;
    let globalLeaveCount = 0;

    const rowsHtml = printEmployees.map((emp, idx) => {
      let presentCount = 0;
      let leaveCount = 0;
      let absentCount = 0;
      let totalWorkedHours = 0;

      const dayCells = printDays.map(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        let cellContent = '<span style="color: #cbd5e1; font-weight: 500;">-</span>';
        let cellBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        if (info.hasRecord || info.status === 'Present') {
          presentCount++;
          globalPresentDays++;
          const hrs = (info.workedHours !== undefined ? info.workedHours : 8);
          totalWorkedHours += hrs;
          globalWorkedHours += hrs;
          const inT = (info.checkInTime || '08:00').slice(0, 5);
          const outT = (info.checkOutTime || (d.isToday ? 'بەردەوام' : '17:00')).slice(0, 5);
          const isCheckInWaived = Boolean(info.isCheckInWaived || info.checkInStatus?.isWaived || (info.isWaived && inT > '08:15') || info.adminCheckInDecision === 'waived');
          const isCheckOutWaived = Boolean(info.isCheckOutWaived || info.checkOutStatus?.isWaived || info.adminCheckOutDecision === 'waived');
          const isCellWaived = isCheckInWaived || isCheckOutWaived || info.isWaived;
          const inPrintColor = info.checkInStatus?.printColor || (isCheckInWaived ? '#9333ea' : inT > '08:15' ? '#dc2626' : '#0f172a');
          const outPrintColor = info.checkOutStatus?.printColor || (isCheckOutWaived ? '#9333ea' : '#64748b');
          const isLate = inT > '08:15' && !isCheckInWaived;
          if (isLate) globalLateCount++;
          
          cellContent = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1;">
              <span style="font-weight: 800; font-size: ${isFullRange ? '7px' : '8px'}; color: ${inPrintColor}; font-family: monospace; white-space: nowrap; display: flex; align-items: center; justify-content: center; gap: 1px;">
                ${isCellWaived ? '<span style="display:inline-block; width:4px; height:4px; border-radius:50%; background-color:#9333ea; margin-left:1px;" title="لێخۆشبوو (بازنەی مۆر)"></span>' : ''}
                <span>${inT}</span>
              </span>
              <span style="font-weight: 700; font-size: ${isFullRange ? '6px' : '7px'}; color: ${outPrintColor}; font-family: monospace; white-space: nowrap;">
                ${outT}
              </span>
            </div>
          `;
          cellBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        } else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
          leaveCount++;
          globalLeaveCount++;
          cellContent = `<span style="color: #b45309; font-weight: 800; font-size: ${isFullRange ? '6.5px' : '7.5px'};">مۆڵەت</span>`;
          cellBg = '#fffdf7';
        } else if (info.status === 'Absent' || (!d.isFuture && !d.isFriday && !info.hasRecord && !info.status)) {
          absentCount++;
          globalAbsentCount++;
          cellContent = `<span style="color: #b91c1c; font-weight: 800; font-size: ${isFullRange ? '6.5px' : '7.5px'};">غیاب</span>`;
          cellBg = '#fefafa';
        } else if (info.isFriday || info.status === 'Holiday') {
          cellContent = `<span style="color: #0f766e; font-weight: 800; font-size: ${isFullRange ? '6.5px' : '7.5px'};">پشوو</span>`;
          cellBg = '#f4fbf9';
        }

        return `<td style="border: 0.5px solid #cbd5e1; padding: ${isFullRange ? '1.5px 0.5px' : '3px 2px'}; text-align: center; background-color: ${cellBg};">${cellContent}</td>`;
      }).join('');

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'}; page-break-inside: avoid;">
          <td style="border: 0.5px solid #cbd5e1; padding: ${isFullRange ? '3px 4px' : '6px 8px'}; font-weight: 800; text-align: right; white-space: nowrap; width: ${isFullRange ? '105px' : '135px'};">
            <div style="color: #0f172a; font-weight: 800; font-size: ${isFullRange ? '8px' : '9.5px'}; overflow: hidden; text-overflow: ellipsis;">${idx + 1}. ${emp.fullName3Part || emp.name}</div>
            <div style="font-size: ${isFullRange ? '6.5px' : '8px'}; color: #64748b; font-family: monospace; font-weight: 500; margin-top: 0.5px;">${emp.role || 'Staff'} <span style="opacity: 0.6;">(${emp.id})</span></div>
          </td>
          ${dayCells}
          <td style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; width: ${isFullRange ? '30px' : '45px'};">
            <span style="display: inline-block; background: rgba(16, 185, 129, 0.12); color: #047857; border: 0.5px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 1px 2px; font-weight: 800; font-family: monospace; font-size: ${isFullRange ? '7px' : '8.5px'};">${presentCount}</span>
          </td>
          <td style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; width: ${isFullRange ? '30px' : '45px'};">
            <span style="display: inline-block; background: rgba(0, 122, 255, 0.10); color: #007AFF; border: 0.5px solid rgba(0, 122, 255, 0.25); border-radius: 4px; padding: 1px 2px; font-weight: 800; font-family: monospace; font-size: ${isFullRange ? '7px' : '8.5px'};">${totalWorkedHours}h</span>
          </td>
          <td style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; width: ${isFullRange ? '26px' : '38px'};">
            <span style="display: inline-block; ${absentCount > 0 ? 'background: rgba(239, 68, 68, 0.12); color: #b91c1c; border: 0.5px solid rgba(239, 68, 68, 0.3);' : 'color: #94a3b8;'} border-radius: 4px; padding: 1px 2px; font-weight: 800; font-family: monospace; font-size: ${isFullRange ? '7px' : '8.5px'};">${absentCount > 0 ? absentCount : '-'}</span>
          </td>
          <td style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; width: ${isFullRange ? '26px' : '38px'};">
            <span style="display: inline-block; ${leaveCount > 0 ? 'background: rgba(245, 158, 11, 0.12); color: #b45309; border: 0.5px solid rgba(245, 158, 11, 0.3);' : 'color: #94a3b8;'} border-radius: 4px; padding: 1px 2px; font-weight: 800; font-family: monospace; font-size: ${isFullRange ? '7px' : '8.5px'};">${leaveCount > 0 ? leaveCount : '-'}</span>
          </td>
        </tr>
      `;
    }).join('');

    const totalWorkingSlots = Math.max(1, printEmployees.length * printDays.filter(d => !d.isFuture && !d.isFriday).length);
    const overallRate = Math.min(100, Math.round((globalPresentDays / totalWorkingSlots) * 100));

    const headersHtml = printDays.map(d => `
      <th style="border: 0.5px solid #cbd5e1; padding: 2px 1px; text-align: center; background-color: ${d.isFriday ? 'rgba(16, 185, 129, 0.12)' : '#f8fafc'}; color: ${d.isFriday ? '#047857' : '#334155'};">
        <div style="font-weight: 800; font-family: monospace; font-size: ${isFullRange ? '7.5px' : '9px'};">${d.dayNum}</div>
        <div style="font-size: ${isFullRange ? '6px' : '7px'}; font-weight: 700; color: ${d.isFriday ? '#059669' : '#64748b'};">${d.isFriday ? 'هەینی' : ''}</div>
      </th>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
      <head>
        <meta charset="UTF-8">
        <title>Ashley Attendance Sheet - ${selectedMonth} (Days ${printStartDay}-${printEndDay})</title>
        <style>
          @font-face {
            font-family: 'NRT';
            src: url('/fonts/NRT-Reg.woff') format('woff'),
                 url('/fonts/NRT-Reg.ttf') format('truetype');
            font-weight: 400 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'NRT';
            src: url('/fonts/NRT-Bd.woff') format('woff'),
                 url('/fonts/NRT-Bd.ttf') format('truetype');
            font-weight: 600 900;
            font-style: normal;
          }
          @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap');
          
          @page {
            size: A4 landscape;
            margin: 4mm 4mm 4mm 4mm;
          }
          * { box-sizing: border-box; }
          html, body {
            font-family: 'NRT', 'Vazirmatn', -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
            margin: 0;
            padding: 6px;
            color: #1c1c1e;
            background-color: #ffffff;
            direction: rtl;
            -webkit-font-smoothing: antialiased;
            width: 100%;
          }
          #print-wrapper {
            width: 100%;
            margin: 0 auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
            font-size: ${isFullRange ? '7px' : '8.5px'};
            table-layout: fixed;
            border: 1px solid #cbd5e1;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          @media print {
            .no-print { display: none !important; }
            html, body { 
              padding: 0 !important; 
              margin: 0 !important; 
              background: #ffffff !important;
            }
            #print-wrapper {
              width: 100% !important;
            }
            table {
              width: 100% !important;
              table-layout: fixed !important;
            }
          }
        </style>
      </head>
      <body>
        <div id="print-wrapper">
          <!-- 1. هێدەری فەرمی: ڕاست (دیوان)، ناوەڕاست (تەنها تایتڵی فەرمی)، چەپ (ئاشڵی و لۆگۆ) -->
          <div style="border-bottom: 2.5px solid ${primaryColor}; padding-bottom: 8px; margin-bottom: 7px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <!-- Right: Diwan Logo, Name & Subtitle -->
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-start;">
              <img src="${diwanLogo}" alt="Diwan Logo" style="height: 44px; max-width: 130px; object-fit: contain;" onerror="this.style.display='none'" />
              <div style="text-align: right;">
                <div style="margin: 0; font-size: 13px; font-weight: 900; color: ${primaryColor}; line-height: 1.2;">
                  ${motherCompany}
                </div>
                <div style="font-size: 8.5px; font-weight: 800; color: ${accentColor}; margin-top: 1px;">
                  ${motherCompanySubtitle}
                </div>
              </div>
            </div>

            <!-- Center: Clean Subject Title (هیچ دەقێک لەژێر ئەم تایتڵە نانووسرێت) -->
            <div style="text-align: center; flex: 1.6; padding: 0 6px;">
              <h1 style="margin: 0; font-size: 15.5px; font-weight: 900; color: ${titleColor}; line-height: 1.2; letter-spacing: -0.2px;">
                ${docTitle}
              </h1>
            </div>

            <!-- Left: Ashley Name, Subtitle & Logo -->
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; justify-content: flex-end;">
              <div style="text-align: left;">
                <div style="font-size: 12px; font-weight: 900; color: ${primaryColor}; line-height: 1.2;">
                  ${brandName}
                </div>
                <div style="font-size: 8.5px; font-weight: 800; color: ${accentColor}; margin-top: 1px;">
                  ${brandSubtitle || slogan}
                </div>
                <div style="font-size: 7.5px; font-family: monospace; color: #64748b; margin-top: 1px;">
                  ${todayStr} • کۆدی فەرمی: ASH-DGP-2026
                </div>
              </div>
              <img src="${reportLogo}" alt="Ashley Logo" style="height: 40px; max-width: 120px; object-fit: contain;" onerror="this.style.display='none'" />
            </div>
          </div>

          <!-- 2. کورتەی گشتی دەوام (Executive KPI Cards Strip) -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 6px; page-break-inside: avoid;">
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; text-align: center; background: #ffffff; border-top: 2.5px solid #007AFF;">
              <div style="font-size: 7.5px; font-weight: 700; color: #64748b;">کۆی گشتی کارمەندان</div>
              <div style="font-size: 11px; font-weight: 900; color: #007AFF; font-family: monospace;">${printEmployees.length} کەس</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; text-align: center; background: #ffffff; border-top: 2.5px solid #059669;">
              <div style="font-size: 7.5px; font-weight: 700; color: #64748b;">کۆی کاژێرەکانی دەوام</div>
              <div style="font-size: 11px; font-weight: 900; color: #059669; font-family: monospace;">${globalWorkedHours}h</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; text-align: center; background: #ffffff; border-top: 2.5px solid #d97706;">
              <div style="font-size: 7.5px; font-weight: 700; color: #64748b;">حاڵەتەکانی دواکەوتن</div>
              <div style="font-size: 11px; font-weight: 900; color: #d97706; font-family: monospace;">${globalLateCount} جار</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; text-align: center; background: #ffffff; border-top: 2.5px solid #b91c1c;">
              <div style="font-size: 7.5px; font-weight: 700; color: #64748b;">کۆی ڕۆژانی غیاب</div>
              <div style="font-size: 11px; font-weight: 900; color: #b91c1c; font-family: monospace;">${globalAbsentCount} ڕۆژ</div>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 6px; text-align: center; background: #ffffff; border-top: 2.5px solid #0f172a;">
              <div style="font-size: 7.5px; font-weight: 700; color: #64748b;">تێکڕای پابەندبوون</div>
              <div style="font-size: 11px; font-weight: 900; color: #0f172a; font-family: monospace;">%${overallRate}</div>
            </div>
          </div>

          <!-- 3. ڕوونکردنەوەی خشتەکە لەسەر خشتەکە (Table Explanation Strip) -->
          <div style="margin-bottom: 5px; padding: 4px 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 700; color: #334155; page-break-inside: avoid;">
            <div>
              <span>📋 <strong>ڕوونکردنەوەی خشتە:</strong> تۆماری دەوامی فەرمی ۳۱ ڕۆژەیی کارمەندان بۆ مانگی <strong>${selectedMonth}</strong> • دەوامی فەرمی: 08:00 هاتن - 17:00 دەرچوون • <strong>ڕێبەری ڕەنگەکان:</strong> <span style="color:#059669; font-weight:800;">سەوز: لێخۆشبوو</span> • <span style="color:#dc2626; font-weight:800;">سوور: سەرپێچی بێ لێخۆشبوون</span> • <span style="color:#0f172a; font-weight:800;">ڕەش: لە کاتی خۆی</span></span>
            </div>
            <div style="font-family: monospace; color: #64748b; font-size: 7.5px;">
              <span>بەرواری دەرچوون: ${todayStr} • کۆدی بەڵگەنامە: ASH-DGP-${selectedMonth}</span>
            </div>
          </div>

          <!-- 4. خشتەی ۳۱ ڕۆژەیی ئامادەبوون (Attendance 31-Day Table) -->
          <table>
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="border: 0.5px solid #cbd5e1; padding: 4px; text-align: right; font-size: 9px; width: ${isFullRange ? '105px' : '135px'}; color: #1e293b; font-weight: 800;">ناوی کارمەند</th>
                ${headersHtml}
                <th style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; font-size: 8px; width: ${isFullRange ? '30px' : '45px'}; background-color: rgba(16, 185, 129, 0.12); color: #065f46; font-weight: 800;">ئامادە</th>
                <th style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; font-size: 8px; width: ${isFullRange ? '30px' : '45px'}; background-color: rgba(0, 122, 255, 0.10); color: #007AFF; font-weight: 800;">کاژێر</th>
                <th style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; font-size: 8px; width: ${isFullRange ? '26px' : '38px'}; background-color: rgba(239, 68, 68, 0.10); color: #b91c1c; font-weight: 800;">غیاب</th>
                <th style="border: 0.5px solid #cbd5e1; padding: 2px; text-align: center; font-size: 8px; width: ${isFullRange ? '26px' : '38px'}; background-color: rgba(245, 158, 11, 0.10); color: #92400e; font-weight: 800;">مۆڵەت</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- 5. واژووەکان لە خوارەوە بەپێی ئەرکەکان (Signatures without pre-printed names or seals) -->
          <div style="margin-top: 18px; display: flex; justify-content: space-between; gap: 14px; text-align: right; page-break-inside: avoid; break-inside: avoid; direction: rtl;">
            <!-- Right: سەرپەرشتیاری ئایتی -->
            <div style="flex: 1; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
              <div style="font-size: 9.5px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
                سەرپەرشتیاری ئایتی
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569; margin-bottom: 8px;">
                ناو: ................................................................
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569;">
                واژوو: ..............................................................
              </div>
            </div>

            <!-- Center: بەڕێوەبەری ژمێریاری و کۆگا -->
            <div style="flex: 1; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
              <div style="font-size: 9.5px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
                بەڕێوەبەری ژمێریاری و کۆگا
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569; margin-bottom: 8px;">
                ناو: ................................................................
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569;">
                واژوو: ..............................................................
              </div>
            </div>

            <!-- Left: بەڕێوەبەری گشتی -->
            <div style="flex: 1; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1;">
              <div style="font-size: 9.5px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
                بەڕێوەبەری گشتی
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569; margin-bottom: 8px;">
                ناو: ................................................................
              </div>
              <div style="font-size: 8px; font-weight: 700; color: #475569;">
                واژوو: ..............................................................
              </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setShowPrintModal(false);
  };

  return (
    <div className="w-full space-y-2 font-sans select-none" dir="rtl">
      
      {/* 🍏 Apple iOS Matrix Header Container (Edge-to-Edge Fullscreen) */}
      <div className="w-full bg-white dark:bg-[#2c2c2e] border border-slate-200/80 dark:border-white/10 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                  خشتەی مانگانەی ئامادەبوونی کارمەندان
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 font-mono">
                  08:30 - 16:30
                </span>
                {isWaitingData && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    <span>بارکردنی داتاکان...</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Icon-Only Action Controls & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 📅 Icon-only Month Calendar Picker */}
            <div 
              className="relative h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-2xs shrink-0" 
              title={`دیاریکردنی مانگ (${selectedMonth})`}
            >
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title={`دیاریکردنی مانگ (${selectedMonth})`}
              />
            </div>
            
            {/* 🎯 Icon-only Multi-Select Toggle Button */}
            <button 
              type="button"
              onClick={() => {
                setIsMultiSelectMode(prev => !prev);
                if (isMultiSelectMode) setSelectedCells({});
              }} 
              className={`relative h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer border shadow-2xs shrink-0 ${
                isMultiSelectMode 
                  ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-sm ring-2 ring-blue-400/40' 
                  : 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-[#007AFF] dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40'
              }`}
              title="دەستکاری فرە-ڕۆژ (Multi-Select)"
              aria-label="دەستکاری فرە-ڕۆژ"
            >
              <CheckSquare className="w-4 h-4" />
              {selectedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-mono w-4 h-4 rounded-full flex items-center justify-center font-black">
                  {selectedCount}
                </span>
              )}
            </button>

            {/* 🖨️ Icon-only Print Button */}
            <button 
              onClick={() => setShowPrintModal(true)} 
              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white flex items-center justify-center transition-all active:scale-90 border border-slate-200/80 dark:border-white/10 cursor-pointer shadow-2xs"
              title="چاپکردنی تایبەت (Print)"
              aria-label="چاپکردن"
            >
              <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>

            {/* 📊 Icon-only Excel (.xlsx) Instant Export Button */}
            <button
              onClick={handleExportExcelMatrix}
              className="h-8 w-8 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-emerald-200/80 dark:border-emerald-800/40 shadow-2xs"
              title="داگرتنی خشتە بە شێوازی ئێکسڵ (.xlsx)"
              aria-label="ئێکسڵ"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>

            {/* 📄 Icon-only Official Ashley Letterhead PDF Button */}
            <button
              onClick={handleExportOfficialLetterheadPDF}
              className="h-8 w-8 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white flex items-center justify-center shadow-xs transition-all active:scale-90 cursor-pointer"
              title="ڕاپۆرتی فەرمی بە وەرەقەی سەری ئاشڵی (PDF)"
              aria-label="ڕاپۆرتی فەرمی"
            >
              <FileText className="w-4 h-4 text-white" />
            </button>

            {/* Quick Search */}
            <div className="relative w-36 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="گەڕان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-2.5 pr-8 py-1.5 rounded-full bg-slate-100 dark:bg-[#3a3a3c] border border-slate-200/60 dark:border-white/5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 placeholder-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 🍏 Apple iOS Clean Matrix Table Card with Crisp Grid Borders & Fluid Viewport Height */}
      <div className="w-full overflow-x-auto border border-slate-300 dark:border-white/15 rounded-xl shadow-xs bg-white dark:bg-[#2c2c2e] max-h-[calc(100vh-140px)] min-h-[580px] overflow-y-auto">
        <table className={`w-full text-right border-collapse border border-slate-300 dark:border-white/15 ${tableFitMode === 'fit' ? 'table-fixed text-[11px]' : 'text-xs'}`}>
          <thead className="sticky top-0 bg-slate-50/98 dark:bg-[#2c2c2e]/98 backdrop-blur-md z-20">
            <tr className="border-b-2 border-slate-300 dark:border-slate-700">
              <th className={`sticky right-0 bg-slate-100/98 dark:bg-[#3a3a3c]/98 text-slate-900 dark:text-white font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l-2 border-l-slate-300 dark:border-l-slate-600 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] ${
                tableFitMode === 'fit' ? 'w-[145px] min-w-[145px] px-2 py-2 text-[11px]' : 'min-w-[200px] px-3 py-3 text-xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span>کارمەند (دۆسیەی HR)</span>
                  {isMultiSelectMode && (
                    <button
                      type="button"
                      onClick={selectAllMatrix}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#007AFF] text-white hover:bg-blue-600 transition-colors cursor-pointer"
                      title="دیاریکردنی هەموو خشتەکە"
                    >
                      هەمووی
                    </button>
                  )}
                </div>
              </th>
              {daysArray.map((d) => {
                const isFriday = d.isFriday;
                const theme = DAY_THEMES[d.dayOfWeek] || DAY_THEMES[6];
                const isColFullySelected = activeEmployees.length > 0 && activeEmployees.every(emp => Boolean(selectedCells[`${emp.id}_${d.dateStr}`]));
                const isColPartiallySelected = !isColFullySelected && activeEmployees.some(emp => Boolean(selectedCells[`${emp.id}_${d.dateStr}`]));

                return (
                  <th 
                    key={d.dateStr}
                    onClick={() => toggleDayColumn(d.dayNum, d.dateStr)}
                    title={`کرتە بکە بۆ دیاریکردنی هەموو کارمەندان لە ڕۆژی ${d.dayNum}`}
                    className={`relative text-center font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 cursor-pointer transition-all hover:brightness-95 ${
                      isColFullySelected 
                        ? 'bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-100 ring-2 ring-[#007AFF] ring-inset shadow-xs' 
                        : isColPartiallySelected 
                        ? 'bg-blue-100/70 dark:bg-blue-950/70 ring-1 ring-blue-400 ring-inset' 
                        : theme.headerCls
                    } ${
                      isFriday 
                        ? 'border-l-2 border-l-slate-400 dark:border-l-slate-500' 
                        : ''
                    } ${
                      d.isToday 
                        ? 'ring-2 ring-amber-400 ring-inset' 
                        : ''
                    } ${
                      tableFitMode === 'fit' ? 'p-0.5 min-w-[26px] sm:min-w-[32px]' : 'p-1 min-w-[54px] sm:min-w-[60px]'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-0.5 leading-tight">
                      <span className={`${tableFitMode === 'fit' ? 'text-[10px]' : 'text-[11px]'} font-mono`}>{d.dayNum}</span>
                      {isColFullySelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                      )}
                    </div>
                    <div className={`${tableFitMode === 'fit' ? 'text-[7.5px]' : 'text-[8px]'} font-bold leading-none mt-0.5`}>
                      {d.isToday ? '⚡' : isFriday ? '🌴' : theme.shortName}
                    </div>
                  </th>
                );
              })}
              {/* 📊 Monthly Totals / KPI Summary Columns with Authoritative Divider */}
              <th className={`bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 border-r-2 border-r-slate-400 dark:border-r-slate-500 text-center ${
                tableFitMode === 'fit' ? 'w-[40px] min-w-[40px] px-0.5 py-1 text-[9px]' : 'min-w-[76px] px-2.5 py-2'
              }`}>
                <div>ئامادەبوو</div>
                <div className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400">ڕۆژ</div>
              </th>
              <th className={`bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 text-center ${
                tableFitMode === 'fit' ? 'w-[40px] min-w-[40px] px-0.5 py-1 text-[9px]' : 'min-w-[76px] px-2.5 py-2'
              }`}>
                <div>کۆی کاژێر</div>
                <div className="text-[8px] font-medium text-blue-700 dark:text-blue-400">Hours</div>
              </th>
              <th className={`bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 text-center ${
                tableFitMode === 'fit' ? 'w-[32px] min-w-[32px] px-0.5 py-1 text-[9px]' : 'min-w-[62px] px-2 py-2'
              }`}>
                <div>درەنگ</div>
                <div className="text-[8px] font-medium text-amber-700 dark:text-amber-400">جار</div>
              </th>
              <th className={`bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 font-bold border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 text-center ${
                tableFitMode === 'fit' ? 'w-[32px] min-w-[32px] px-0.5 py-1 text-[9px]' : 'min-w-[60px] px-2 py-2'
              }`}>
                <div>غیاب</div>
                <div className="text-[8px] font-medium text-rose-700 dark:text-rose-400">ڕۆژ</div>
              </th>
              <th className={`bg-slate-200 text-slate-900 font-black border-b-2 border-slate-300 dark:border-slate-700 border-l border-slate-300 dark:border-slate-700 text-center ${
                tableFitMode === 'fit' ? 'w-[36px] min-w-[36px] px-0.5 py-1 text-[9px]' : 'min-w-[65px] px-2 py-2'
              }`}>
                <div>ڕێژە ٪</div>
                <div className="text-[7.5px] font-bold text-slate-600 font-mono">Rate</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300/80 dark:divide-slate-700">
            {activeEmployees.map((emp, empIndex) => {
              const isDarko = emp.id === 'emp-02' || (emp.fullName3Part || emp.name || '').includes('دارکۆ');
              const isManager = emp.role === 'Manager' || isDarko;

              // Calculate monthly attendance stats for this employee:
              let empPresentDays = 0;
              let empTotalHours = 0;
              let empAbsentDays = 0;
              let empLeaveDays = 0;
              let empLateDays = 0;

              daysArray.forEach(d => {
                const info = getGpsLogsForEmpAndDay(emp, d);
                const isPresent = info.status === 'Present' || Boolean(info.checkInTime);
                if (isPresent) {
                  empPresentDays++;
                  empTotalHours += (info.workedHours !== undefined ? info.workedHours : 8);
                  const inT = (info.checkInTime || '08:00').slice(0, 5);
                  if (inT > '08:15') {
                    empLateDays++;
                  }
                } else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
                  empLeaveDays++;
                } else if (info.status === 'Absent' || (!d.isFuture && !d.isFriday && info.status !== 'Empty' && info.status !== 'Holiday')) {
                  empAbsentDays++;
                }
              });

              const workableDays = Math.max(1, daysArray.filter(d => !d.isFuture && !d.isFriday).length);
              const attendanceRate = Math.min(100, Math.round((empPresentDays / workableDays) * 100));

              return (
                <tr key={emp.id} className={`hover:bg-blue-50/60 dark:hover:bg-white/10 transition-colors border-b border-slate-300/80 dark:border-slate-700/80 ${isDarko ? 'bg-amber-50/20 dark:bg-amber-950/10' : empIndex % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.02]' : 'bg-white dark:bg-transparent'}`}>
                  <td className={`sticky right-0 bg-white/98 dark:bg-[#2c2c2e]/98 backdrop-blur-md z-10 border-b border-slate-300/80 dark:border-slate-700/80 border-l-2 border-l-slate-400 dark:border-l-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] ${
                    tableFitMode === 'fit' ? 'w-[145px] min-w-[145px] px-1.5 py-1.5' : 'px-3 py-2.5'
                  }`}>
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {/* 🔘 Employee Row Multi-Select Checkbox */}
                      {isMultiSelectMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleEmployeeRow(emp.id, emp.fullName3Part || emp.name);
                          }}
                          className={`p-1 rounded-md transition-colors shrink-0 ${
                            daysArray.length > 0 && daysArray.every(d => Boolean(selectedCells[`${emp.id}_${d.dateStr}`]))
                              ? 'bg-[#007AFF] text-white shadow-xs'
                              : 'text-slate-300 hover:text-[#007AFF] dark:text-slate-600 dark:hover:text-blue-400'
                          }`}
                          title="دیاریکردنی هەموو ڕۆژەکانی ئەم کارمەندە لەم مانگەدا"
                        >
                          {daysArray.length > 0 && daysArray.every(d => Boolean(selectedCells[`${emp.id}_${d.dateStr}`])) ? (
                            <CheckSquare className="w-3.5 h-3.5" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      <Link
                        href={`/employees/${emp.id}`}
                        className="flex items-center gap-1.5 sm:gap-2 text-right hover:text-[#007AFF] cursor-pointer group transition-colors w-full overflow-hidden"
                        title="کلیک بکە بۆ کردنەوەی پەیجی فەرمی ئەم کارمەندە و ئامێر و مۆبایلەکەی"
                      >
                        <div className={`${tableFitMode === 'fit' ? 'w-6 h-6 rounded-lg text-[10px]' : 'w-8 h-8 rounded-xl text-xs'} bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-200/60 dark:border-white/10 overflow-hidden flex items-center justify-center text-white font-bold shrink-0 group-hover:border-[#007AFF] shadow-xs`}>
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{emp.name.slice(0, 1)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className={`${tableFitMode === 'fit' ? 'text-[11px]' : 'text-xs'} font-bold text-slate-900 dark:text-white group-hover:text-[#007AFF] flex items-center gap-1 truncate`}>
                            <span className="truncate">{emp.fullName3Part || emp.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <div className={`${tableFitMode === 'fit' ? 'text-[8.5px]' : 'text-[10px]'} font-mono text-slate-400 dark:text-slate-500 truncate`}>
                            {isDarko ? 'بەڕێوەبەر' : emp.role || 'Staff'} ({emp.id})
                          </div>
                        </div>
                      </Link>
                    </div>
                  </td>
                  {daysArray.map((d, dayIndex) => {
                    const info = getGpsLogsForEmpAndDay(emp, d);
                    const isFriday = d.isFriday;
                    const theme = DAY_THEMES[d.dayOfWeek] || DAY_THEMES[6];
                    const isPresent = info.status === 'Present' || Boolean(info.checkInTime);
                    const inTime = (info.checkInTime || '08:00').slice(0, 5);
                    const outTime = info.checkOutTime ? info.checkOutTime.slice(0, 5) : (d.isToday ? 'بەردەوام' : '17:00');

                    const cellKey = `${emp.id}_${d.dateStr}`;
                    const isCellSelected = Boolean(selectedCells[cellKey]);

                    let badgeColor = 'text-slate-300 dark:text-slate-600 font-normal';
                    let badgeText = '-';

                    // 1. Friday Holiday
                    if (info.status === 'Holiday' || isFriday) {
                      badgeColor = 'text-teal-700 dark:text-teal-400 font-bold';
                      badgeText = '🌴';
                    }
                    // 2. Present / Check-in
                    else if (isPresent) {
                      badgeColor = 'text-emerald-800 dark:text-emerald-300 font-bold';
                      badgeText = inTime;
                    }
                    // 3. Leave / مۆڵەت
                    else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
                      badgeColor = 'text-amber-800 dark:text-amber-300 font-bold';
                      badgeText = tableFitMode === 'fit' ? 'مۆڵەت' : 'مۆڵەت';
                    }
                    // 4. Absent / غیاب
                    else if (info.status === 'Absent' || info.status === 'غیاب') {
                      badgeColor = 'text-rose-700 dark:text-rose-400 font-bold';
                      badgeText = tableFitMode === 'fit' ? 'غ' : 'غیاب';
                    }
                    // 5. Loading / چاوەڕوانی (Quiet clean state while loading server data)
                    else if (info.status === 'Loading' || isWaitingData) {
                      badgeColor = 'text-slate-400 dark:text-slate-500 font-normal';
                      badgeText = '-';
                    }
                    // 6. Empty / Clean Blank / Future
                    else {
                      badgeColor = 'text-slate-300 dark:text-slate-600 font-normal';
                      badgeText = '-';
                    }

                    const isLateRaw = isPresent && inTime > '08:15';
                    const isCheckInWaived = Boolean(info.isCheckInWaived || (info.isWaived && isLateRaw) || info.adminCheckInDecision === 'waived' || (info.adminDecision === 'waived' && isLateRaw));
                    const isCheckOutWaived = Boolean(info.isCheckOutWaived || info.adminCheckOutDecision === 'waived');
                    const isWaived = Boolean(isCheckInWaived || isCheckOutWaived || info.isWaived || info.adminDecision === 'waived');
                    const isLate = isLateRaw && !isCheckInWaived;

                    return (
                      <td 
                        key={d.dateStr}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return; // Left mouse button only

                          // If Shift is held and there is a previous anchor cell, instant range-select
                          if (e.shiftKey && lastFocusedCell) {
                            setIsMultiSelectMode(true);
                            updateDragSelection(lastFocusedCell.r, lastFocusedCell.c, empIndex, dayIndex, selectedCells);
                            return;
                          }

                          const isShiftOrCtrl = e.shiftKey || e.ctrlKey || e.metaKey;
                          const base = isShiftOrCtrl ? { ...selectedCells } : {};

                          dragSelectionRef.current = {
                            isDragging: true,
                            start: { r: empIndex, c: dayIndex },
                            hasMoved: false,
                            baseSelected: base,
                          };
                          setLastFocusedCell({ r: empIndex, c: dayIndex });
                          setIsDraggingCells(true);
                        }}
                        onMouseEnter={() => {
                          if (!dragSelectionRef.current.isDragging || !dragSelectionRef.current.start) return;
                          dragSelectionRef.current.hasMoved = true;
                          if (!isMultiSelectMode) {
                            setIsMultiSelectMode(true);
                          }
                          updateDragSelection(
                            dragSelectionRef.current.start.r,
                            dragSelectionRef.current.start.c,
                            empIndex,
                            dayIndex,
                            dragSelectionRef.current.baseSelected
                          );
                        }}
                        onClick={(e) => {
                          // If mouse was dragged across multiple cells, don't trigger normal click
                          if (dragSelectionRef.current.hasMoved) {
                            return;
                          }
                          setLastFocusedCell({ r: empIndex, c: dayIndex });
                          if (isMultiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
                            toggleCellSelection(emp.id, emp.fullName3Part || emp.name, d.dateStr, d.dayNum);
                          } else {
                            handleCellClick(emp, d);
                          }
                        }}
                        title={`هاتن: ${info.checkInTime || '08:00'} (${info.checkInStatus?.label || ''})\nڕۆیشتن: ${info.checkOutTime || (d.isToday ? 'بەردەوام' : '17:00')} (${info.checkOutStatus?.label || ''})${info.checkInNote ? `\n📝 تێبینی هاتن: ${info.checkInNote}` : ''}${info.checkOutNote ? `\n⏱️ تێبینی ڕۆیشتن / ئیزافە: ${info.checkOutNote}` : ''}${info.note && info.note !== info.checkInNote && info.note !== info.checkOutNote ? `\n📝 تێبینی: ${info.note}` : ''}${info.adminNote ? `\n🛡️ تێبینی ئەدمین: ${info.adminNote}` : ''}`}
                        className={`relative text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 select-none transition-all ${
                          isCellSelected 
                            ? 'ring-2 ring-[#007AFF] bg-blue-100 dark:bg-blue-900/90 font-black shadow-md z-20 scale-[1.03]' 
                            : theme.cellCls
                        } ${
                          isMultiSelectMode || isDraggingCells ? 'cursor-cell' : 'cursor-pointer'
                        } hover:bg-[#007AFF]/20 ${
                          isFriday ? 'border-l-2 border-l-slate-400 dark:border-l-slate-500' : ''
                        } ${
                          d.isToday ? 'ring-1 ring-amber-400 ring-inset bg-amber-100/50 dark:bg-amber-950/40' : ''
                        } ${
                          tableFitMode === 'fit' ? 'p-0.5 min-w-[26px] sm:min-w-[32px]' : 'p-1 min-w-[54px]'
                        }`}
                      >
                        {/* 🔵 Selected Cell Dot Indicator */}
                        {isCellSelected && (
                          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#007AFF] ring-1 ring-white shadow-xs z-30" />
                        )}

                        {/* 🔴 Red Dot Indicator for Late Check-in or Early Departure (Unexcused) */}
                        {isLate && (
                          <span 
                            className="absolute top-0.5 left-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-500 shadow-xs z-10 animate-pulse" 
                            title="سەرپێچی دەوام (بێ لێخۆشبوون)"
                          />
                        )}

                        {/* 🟣 Purple Circle Indicator for Excused / Waived by Admin (بازنەی مۆر) */}
                        {(info.checkInStatus?.isWaived || info.checkOutStatus?.isWaived || isWaived) && (
                          <span 
                            className="absolute top-0.5 left-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-purple-600 ring-2 ring-purple-300 dark:ring-purple-900 shadow-xs z-10" 
                            title="لێخۆشبوو (بازنەی مۆر - لێخۆشبوونی ئەدمین)"
                          />
                        )}

                        {/* 📝 Note Indicator Dot (Employee Note / Overtime Note) */}
                        {(info.checkInNote || info.checkOutNote || info.note) && (
                          <span 
                            className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 ring-1 ring-blue-200 dark:ring-blue-900 shadow-xs z-10" 
                            title={`تێبینی کارمەند:\n${[info.checkInNote, info.checkOutNote].filter(Boolean).join('\n') || info.note}`}
                          />
                        )}

                        {isPresent ? (
                          <div className={`w-full flex flex-col items-center justify-center ${tableFitMode === 'fit' ? 'py-0.5' : 'py-1'} leading-none select-none`}>
                            <span className={`font-mono font-extrabold ${tableFitMode === 'fit' ? 'text-[9.5px]' : 'text-xs'} ${info.checkInStatus?.colorCls || 'text-slate-900 dark:text-slate-100'} leading-tight tracking-tight`}>
                              {inTime}
                            </span>
                            <span className={`font-mono font-semibold ${tableFitMode === 'fit' ? 'text-[8px] mt-0.5' : 'text-[10px] mt-1'} ${info.checkOutStatus?.colorCls || 'text-slate-500 dark:text-slate-400'} leading-tight tracking-tight`}>
                              {outTime === 'بەردەوام' ? (tableFitMode === 'fit' ? '••' : 'بەردەوام') : outTime}
                            </span>
                          </div>
                        ) : info.status === 'Loading' ? (
                          <div className={`w-full ${tableFitMode === 'fit' ? 'py-1' : 'py-2'} flex items-center justify-center`}>
                            <span className="inline-block w-3.5 h-1.5 bg-slate-200/90 dark:bg-slate-700/90 rounded-full animate-pulse" />
                          </div>
                        ) : (
                          <div className={`w-full ${tableFitMode === 'fit' ? 'py-1 text-[8.5px]' : 'py-2 text-[10px]'} font-bold flex items-center justify-center ${badgeColor}`}>
                            {badgeText}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* 📊 Apple Summary Pills for this employee with Authoritative Divider */}
                  <td className={`text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 border-r-2 border-r-slate-400 dark:border-r-slate-500 bg-slate-50/40 dark:bg-white/[0.01] ${tableFitMode === 'fit' ? 'p-0.5' : 'p-2'}`}>
                    {isWaitingData ? (
                      <span className="inline-block w-8 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-md animate-pulse" />
                    ) : (
                      <span className={`inline-block font-mono font-bold ${
                        tableFitMode === 'fit' ? 'px-1 py-0.5 rounded-md text-[9px]' : 'px-2.5 py-1 rounded-xl text-xs'
                      } bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20`}>
                        {empPresentDays}{tableFitMode === 'fit' ? 'd' : ' ڕۆژ'}
                      </span>
                    )}
                  </td>
                  <td className={`text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-white/[0.01] ${tableFitMode === 'fit' ? 'p-0.5' : 'p-2'}`}>
                    {isWaitingData ? (
                      <span className="inline-block w-8 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-md animate-pulse" />
                    ) : (
                      <span className={`inline-block font-mono font-bold ${
                        tableFitMode === 'fit' ? 'px-1 py-0.5 rounded-md text-[9px]' : 'px-2.5 py-1 rounded-xl text-xs'
                      } bg-blue-500/15 text-blue-800 dark:text-blue-300 border border-blue-500/20`}>
                        {empTotalHours}h
                      </span>
                    )}
                  </td>
                  <td className={`text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-white/[0.01] ${tableFitMode === 'fit' ? 'p-0.5' : 'p-2'}`}>
                    {isWaitingData ? (
                      <span className="inline-block w-6 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-md animate-pulse" />
                    ) : (
                      <span className={`inline-block font-mono font-bold ${
                        tableFitMode === 'fit' ? 'px-1 py-0.5 rounded-md text-[9px]' : 'px-2 py-0.5 rounded-lg text-xs'
                      } ${
                        empLateDays > 0 ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30' : 'text-slate-400 dark:text-slate-600'
                      }`}>
                        {empLateDays > 0 ? (tableFitMode === 'fit' ? empLateDays : `${empLateDays} جار`) : '٠'}
                      </span>
                    )}
                  </td>
                  <td className={`text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-white/[0.01] ${tableFitMode === 'fit' ? 'p-0.5' : 'p-2'}`}>
                    {isWaitingData ? (
                      <span className="inline-block w-6 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-md animate-pulse" />
                    ) : (
                      <span className={`inline-block font-mono font-bold ${
                        tableFitMode === 'fit' ? 'px-1 py-0.5 rounded-md text-[9px]' : 'px-2 py-0.5 rounded-lg text-xs'
                      } ${
                        empAbsentDays > 0 ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/20' : 'text-slate-400 dark:text-slate-600'
                      }`}>
                        {empAbsentDays > 0 ? (tableFitMode === 'fit' ? empAbsentDays : `${empAbsentDays} ڕۆژ`) : '٠'}
                      </span>
                    )}
                  </td>
                  <td className={`text-center border-b border-slate-300/80 dark:border-slate-700/80 border-l border-slate-300/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-white/[0.01] ${tableFitMode === 'fit' ? 'p-0.5' : 'p-2'}`}>
                    {isWaitingData ? (
                      <span className="inline-block w-7 h-4 bg-slate-200/80 dark:bg-slate-700/80 rounded-md animate-pulse" />
                    ) : (
                      <span className={`inline-block font-mono font-bold ${
                        tableFitMode === 'fit' ? 'px-1 py-0.5 rounded-md text-[9px]' : 'px-2 py-0.5 rounded-lg text-xs'
                      } ${
                        attendanceRate >= 90 ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' : 
                        attendanceRate >= 75 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-rose-500/15 text-rose-800 dark:text-rose-300'
                      }`}>
                        %{attendanceRate}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 🍏 ULTRA-CLEAN APPLE iOS STYLE DAY DETAILS, ADMIN EDIT & AUDIT HISTORY SHEET */}
      {/* ========================================================================= */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 font-sans" dir="rtl">
          <div className="bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white rounded-[28px] border border-white/60 dark:border-white/10 shadow-2xl max-w-xl w-full p-0 overflow-hidden transition-all flex flex-col max-h-[92vh]">
            
            {/* iOS Header */}
            <div className="px-6 pt-5 pb-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-indigo-500/20">
                  {(selectedDayModal.emp.name || '').slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                      {selectedDayModal.emp.fullName3Part || selectedDayModal.emp.name}
                    </h3>
                    <span className="text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-200/50 dark:border-white/5">
                      {selectedDayModal.emp.role || 'کارمەند'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    <span className="font-mono text-[11px]">#{selectedDayModal.emp.id}</span>
                    <span>•</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{selectedDayModal.dayItem.dateStr}</span>
                  </div>
                </div>
              </div>

              {/* iOS Close Button */}
              <button 
                onClick={() => setSelectedDayModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                title="داخستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* iOS Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              
              {/* ------------------------------------------------------------- */}
              {/* 📱 بەشی ١: داتای تۆمارکراوی کارمەند (Employee Mobile Record) */}
              {/* ------------------------------------------------------------- */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>داتای تۆمارکراوی مۆبایلی کارمەند:</span>
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">GPS Auto-Tracked</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* داتای هاتنی مۆبایل */}
                  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-3.5 border border-slate-200/70 dark:border-white/5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300">کاتی هاتن (مۆبایل):</span>
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                        {selectedDayModal.info.rawCheckIn || selectedDayModal.info.checkInTime || '08:00'}
                      </span>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block">
                        ( تێبینی هاتنی کارمەند ) :
                      </span>
                      <div className="p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] font-medium">
                        {selectedDayModal.info.checkInNote || selectedDayModal.info.note ? (
                          <span className="text-indigo-950 dark:text-indigo-100 font-bold">
                            {selectedDayModal.info.checkInNote || selectedDayModal.info.note}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">تێبینی نەنوسراوە</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* داتای ڕۆیشتنی مۆبایل */}
                  <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-3.5 border border-slate-200/70 dark:border-white/5 shadow-xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300">کاتی چوون (مۆبایل):</span>
                      <span className="font-black font-mono text-blue-600 dark:text-blue-400 text-sm">
                        {selectedDayModal.info.rawCheckOut || selectedDayModal.info.checkOutTime || '17:00'}
                      </span>
                    </div>
                    <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 block">
                        ( تێبینی ڕۆیشتن / ئیزافەی کارمەند ) :
                      </span>
                      <div className="p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] font-medium">
                        {selectedDayModal.info.checkOutNote ? (
                          <span className="text-indigo-950 dark:text-indigo-100 font-bold">
                            {selectedDayModal.info.checkOutNote}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">تێبینی نەنوسراوە</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 🛡️ بەشی ٢: دەستکاری و دەستنیشانکردنی ئەدمین (Admin Edit Section) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 border border-slate-200/70 dark:border-white/5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>دەستکاری و پەسەندکردنی ئەدمین:</span>
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200/40">
                    Admin Adjust
                  </span>
                </div>

                {/* Status Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 block">حاڵەتی ڕۆژەکە:</label>
                  <div className="p-1 bg-slate-100 dark:bg-[#3a3a3c] rounded-2xl grid grid-cols-4 gap-1">
                    {[
                      { key: 'Present', label: 'ئامادەبوو', dot: 'bg-emerald-500' },
                      { key: 'Leave', label: 'مۆڵەت', dot: 'bg-amber-500' },
                      { key: 'Absent', label: 'غیاب', dot: 'bg-rose-500' },
                      { key: 'Holiday', label: 'پشوو', dot: 'bg-blue-500' },
                    ].map(s => {
                      const isSelected = modalStatus === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setModalStatus(s.key)}
                          className={`py-1.5 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            isSelected 
                              ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-black' 
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                          <span>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Admin Notes Inputs */}
                {modalStatus === 'Present' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {/* کاتی ئیدتکراوی هاتن + تێبینی ئەدمین */}
                    <div className="space-y-2 bg-slate-50 dark:bg-[#1c1c1e] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">کاتی دەستکاریکراوی هاتن:</label>
                        <input 
                          type="time" 
                          value={modalCheckIn}
                          onChange={(e) => setModalCheckIn(e.target.value)}
                          className="text-xs font-bold font-mono bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 outline-none focus:border-[#007AFF]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block">
                          ( تێبینی ئەدمین ) - هاتن:
                        </label>
                        <input
                          type="text"
                          value={modalAdminCheckInNote}
                          onChange={(e) => setModalAdminCheckInNote(e.target.value)}
                          placeholder="هۆکاری گۆڕانکاری بنووسە..."
                          className="w-full text-xs bg-white dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 p-2 rounded-xl outline-none focus:border-[#007AFF] text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    {/* کاتی ئیدتکراوی ڕۆیشتن + تێبینی ئەدمین */}
                    <div className="space-y-2 bg-slate-50 dark:bg-[#1c1c1e] p-3 rounded-xl border border-slate-200/60 dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">کاتی دەستکاریکراوی ڕۆیشتن:</label>
                        <input 
                          type="time" 
                          value={modalCheckOut}
                          onChange={(e) => setModalCheckOut(e.target.value)}
                          className="text-xs font-bold font-mono bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 outline-none focus:border-[#007AFF]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block">
                          ( تێبینی ئەدمین ) - ڕۆیشتن:
                        </label>
                        <input
                          type="text"
                          value={modalAdminCheckOutNote}
                          onChange={(e) => setModalAdminCheckOutNote(e.target.value)}
                          placeholder="هۆکاری گۆڕانکاری بنووسە..."
                          className="w-full text-xs bg-white dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 p-2 rounded-xl outline-none focus:border-[#007AFF] text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ⚖️ سەرپشکی و بڕیاری ئەدمین بۆ کاتی هاتن و ڕۆیشتن بە جیاکراوەیی */}
                <div className="space-y-3 bg-slate-50 dark:bg-[#1c1c1e] p-3.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/50 dark:border-white/5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span>⚖️ بڕیاری سەرپشکی و لێخۆشبوونی ئەدمین (Waivers):</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">Admin Authority</span>
                  </div>

                  {/* ١. لێخۆشبوون لە درەنگ هاتن */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <span>• لێخۆشبوون لە درەنگ هاتن (بەیانی):</span>
                      <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400">کاتی هاتن: {modalCheckIn}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModalCheckInDecision(prev => prev === 'waived' ? null : 'waived');
                          setModalAdminDecision(prev => prev === 'waived' ? null : 'waived');
                        }}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          modalCheckInDecision === 'waived'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm font-black ring-2 ring-purple-400'
                            : 'bg-white dark:bg-[#2c2c2e] text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/40 hover:bg-purple-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs">
                          <span>🟣</span>
                          <span>لێخۆشبوون (بازنەی مۆر)</span>
                        </span>
                        <span className={`text-[9px] font-medium ${modalCheckInDecision === 'waived' ? 'text-purple-100' : 'text-slate-400'}`}>
                          سزا نادرێت و بازنەی مۆر دەردەکەوێت
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setModalCheckInDecision(prev => prev === 'penalized' ? null : 'penalized');
                          setModalAdminDecision(prev => prev === 'penalized' ? null : 'penalized');
                        }}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          modalCheckInDecision === 'penalized'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-black ring-2 ring-rose-400'
                            : 'bg-white dark:bg-[#2c2c2e] text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/40 hover:bg-rose-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs">
                          <span>🔴</span>
                          <span>حسابکردن (سزا)</span>
                        </span>
                        <span className={`text-[9px] font-medium ${modalCheckInDecision === 'penalized' ? 'text-rose-100' : 'text-slate-400'}`}>
                          وەک سەرپێچی دەوام حساب دەکرێت
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* ٢. لێخۆشبوون لە زوو ڕۆیشتن */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-200/50 dark:border-white/5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <span>• لێخۆشبوون لە زوو ڕۆیشتن (چوونەوە):</span>
                      <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400">کاتی ڕۆیشتن: {modalCheckOut || 'بەردەوام'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setModalCheckOutDecision(prev => prev === 'waived' ? null : 'waived');
                          setModalAdminDecision(prev => prev === 'waived' ? null : 'waived');
                        }}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          modalCheckOutDecision === 'waived'
                            ? 'bg-purple-600 text-white border-purple-700 shadow-sm font-black ring-2 ring-purple-400'
                            : 'bg-white dark:bg-[#2c2c2e] text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/40 hover:bg-purple-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs">
                          <span>🟣</span>
                          <span>لێخۆشبوون (بازنەی مۆر)</span>
                        </span>
                        <span className={`text-[9px] font-medium ${modalCheckOutDecision === 'waived' ? 'text-purple-100' : 'text-slate-400'}`}>
                          سزا نادرێت و بازنەی مۆر دەردەکەوێت
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setModalCheckOutDecision(prev => prev === 'penalized' ? null : 'penalized');
                          setModalAdminDecision(prev => prev === 'penalized' ? null : 'penalized');
                        }}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          modalCheckOutDecision === 'penalized'
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm font-black ring-2 ring-rose-400'
                            : 'bg-white dark:bg-[#2c2c2e] text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800/40 hover:bg-rose-50'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs">
                          <span>🔴</span>
                          <span>حسابکردن (سزا)</span>
                        </span>
                        <span className={`text-[9px] font-medium ${modalCheckOutDecision === 'penalized' ? 'text-rose-100' : 'text-slate-400'}`}>
                          وەک سەرپێچی دەوام حساب دەکرێت
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* 📜 بەشی ٣: تۆماری تەواوی مێژووی گۆڕانکارییەکان (Change History Log) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white dark:bg-[#2c2c2e] rounded-2xl p-4 border border-slate-200/70 dark:border-white/5 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>مێژووی دەستکاری و گۆڕانکارییەکان (Change History Log):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Audit Trail</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* تێبینی یان گۆڕانکاری کاتی هاتن و چوون لەلایەن ئەدمینەوە */}
                  {(
                    Boolean(selectedDayModal.info.adminNote) || 
                    Boolean(selectedDayModal.info.adminCheckInNote) || 
                    Boolean(selectedDayModal.info.adminCheckOutNote) || 
                    (Boolean(selectedDayModal.info.checkInTime) && Boolean(selectedDayModal.info.rawCheckIn) && selectedDayModal.info.checkInTime !== selectedDayModal.info.rawCheckIn) ||
                    (Boolean(selectedDayModal.info.checkOutTime) && Boolean(selectedDayModal.info.rawCheckOut) && selectedDayModal.info.checkOutTime !== selectedDayModal.info.rawCheckOut) ||
                    (Array.isArray(selectedDayModal.info.historyLogs) && selectedDayModal.info.historyLogs.length > 0)
                  ) ? (
                    <div className="space-y-2.5">
                      {/* 🔄 ١. ڕیزبەندی گۆڕانکاری کاتی هاتن لەلایەن ئەدمین */}
                      {selectedDayModal.info.checkInTime && selectedDayModal.info.rawCheckIn && selectedDayModal.info.checkInTime !== selectedDayModal.info.rawCheckIn && (
                        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 dark:text-emerald-200 flex flex-col gap-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-xs text-emerald-900 dark:text-emerald-300">
                              <span>🔄 گۆڕانکاری کاتی هاتن لەلایەن ئەدمینەوە:</span>
                            </span>
                            <span className="font-mono text-xs font-bold">
                              <span className="line-through text-slate-400 dark:text-slate-500 ml-1.5">{selectedDayModal.info.rawCheckIn}</span>
                              <span className="text-slate-400">➡️</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-black mr-1.5 text-sm">{selectedDayModal.info.checkInTime}</span>
                            </span>
                          </div>
                          {selectedDayModal.info.adminCheckInNote && (
                            <div className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                              <span className="font-bold">تێبینی هاتنی ئەدمین: </span>
                              <span>{selectedDayModal.info.adminCheckInNote}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 🔄 ٢. ڕیزبەندی گۆڕانکاری کاتی چوون لەلایەن ئەدمین */}
                      {selectedDayModal.info.checkOutTime && selectedDayModal.info.rawCheckOut && selectedDayModal.info.checkOutTime !== selectedDayModal.info.rawCheckOut && (
                        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-950 dark:text-blue-200 flex flex-col gap-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-xs text-blue-900 dark:text-blue-300">
                              <span>🔄 گۆڕانکاری کاتی چوون لەلایەن ئەدمینەوە:</span>
                            </span>
                            <span className="font-mono text-xs font-bold">
                              <span className="line-through text-slate-400 dark:text-slate-500 ml-1.5">{selectedDayModal.info.rawCheckOut}</span>
                              <span className="text-slate-400">➡️</span>
                              <span className="text-blue-600 dark:text-blue-400 font-black mr-1.5 text-sm">{selectedDayModal.info.checkOutTime}</span>
                            </span>
                          </div>
                          {selectedDayModal.info.adminCheckOutNote && (
                            <div className="text-[11px] font-medium text-blue-800 dark:text-blue-300 bg-blue-500/10 p-2 rounded-xl border border-blue-500/20">
                              <span className="font-bold">تێبینی چوونى ئەدمین: </span>
                              <span>{selectedDayModal.info.adminCheckOutNote}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 📜 ٣. مێژووی تەواوی گۆڕانکارییە پێشووەکان (Detailed Audit Trail Timeline) */}
                      {Array.isArray(selectedDayModal.info.historyLogs) && selectedDayModal.info.historyLogs.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-white/5">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block px-1">
                            مێژووی دەستکارییە بەردەستەکان (Timeline):
                          </span>
                          {selectedDayModal.info.historyLogs.map((log: any, idx: number) => (
                            <div key={log.id || idx} className="p-3 rounded-2xl bg-slate-50 dark:bg-[#1c1c1e] border border-slate-200/70 dark:border-white/5 space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-200/50 dark:border-white/5">
                                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  <span>دەستکاری لەلایەن: {log.adminName || 'ئەدمین'}</span>
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{log.formattedDate || log.time}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                {log.checkInFrom && log.checkInTo && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40 font-mono text-xs font-bold">
                                    <span>هاتن:</span>
                                    <span className="line-through opacity-70">{log.checkInFrom}</span>
                                    <span>➡️</span>
                                    <span className="font-black">{log.checkInTo}</span>
                                  </span>
                                )}
                                {log.checkOutFrom && log.checkOutTo && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 font-mono text-xs font-bold">
                                    <span>چوون:</span>
                                    <span className="line-through opacity-70">{log.checkOutFrom}</span>
                                    <span>➡️</span>
                                    <span className="font-black">{log.checkOutTo}</span>
                                  </span>
                                )}
                                {log.statusFrom && log.statusTo && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 text-[11px] font-bold">
                                    <span>حاڵەت: {log.statusFrom} ➡️ {log.statusTo}</span>
                                  </span>
                                )}
                              </div>
                              {(log.adminCheckInNote || log.adminCheckOutNote || log.adminNote) && (
                                <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-black/20 p-2 rounded-xl space-y-0.5 border border-slate-100 dark:border-white/5">
                                  {log.adminCheckInNote && <div>• تێبینی هاتنی ئەدمین: <span className="font-semibold text-slate-800 dark:text-slate-200">{log.adminCheckInNote}</span></div>}
                                  {log.adminCheckOutNote && <div>• تێبینی چوونى ئەدمین: <span className="font-semibold text-slate-800 dark:text-slate-200">{log.adminCheckOutNote}</span></div>}
                                  {log.adminNote && !log.adminCheckInNote && !log.adminCheckOutNote && <div>• تێبینی ئەدمین: <span className="font-semibold text-slate-800 dark:text-slate-200">{log.adminNote}</span></div>}
                                </div>
                              )}
                              {log.decisionLabel && (
                                <div className={`text-[11px] font-bold p-2 rounded-xl border ${
                                  log.adminDecision === 'waived'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                                }`}>
                                  <span>• بڕیاری ئەدمین: </span>
                                  <span>{log.decisionLabel}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* نووسراوی تێبینیەکانی دیکەی ئەدمین */}
                      {selectedDayModal.info.adminNote && 
                       !selectedDayModal.info.adminNote.includes(selectedDayModal.info.adminCheckInNote || '___') && 
                       !selectedDayModal.info.adminNote.includes(selectedDayModal.info.adminCheckOutNote || '___') && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1c1c1e] border border-slate-200/60 dark:border-white/5 flex items-start gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <span className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {selectedDayModal.info.adminNote}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#1c1c1e] border border-slate-100 dark:border-white/5 text-center text-slate-400 dark:text-slate-500 text-[11px] italic">
                      تۆماری مێژوو: تا ئێستا هیچ دەستکارییەکی پێشوو لەلایەن ئەدمینەوە بۆ ئەم ڕۆژە ئەنجام نەدراوە.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* iOS Bottom Action Bar */}
            <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleDeleteDayRecord}
                className="px-3 py-2 rounded-full text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوەی تۆمار</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDayModal(null)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  داخستن
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={isSavingModal}
                  className="px-6 py-2 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingModal ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردن'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ WINDOWS 11 SHARP MODAL: CUSTOM RANGE PRINT (SEPARATED NEW TAB) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 🍏 APPLE iOS STYLE MODAL: CUSTOM RANGE PRINT */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 font-sans" dir="rtl">
          <div className="bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white rounded-[28px] border border-white/60 dark:border-white/10 shadow-2xl max-w-lg w-full p-0 overflow-hidden transition-all flex flex-col">
            
            {/* Title Bar */}
            <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-blue-400 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    چاپکردنی تایبەت (Google Sheets View)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">ڕێکخستنی مەودای چاپ لە تابی نوێ</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer text-xs font-bold transition-all active:scale-90"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              
              {/* Preset Segmented Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">شێوازی خێرای چاپ:</label>
                <div className="p-1 bg-slate-200/70 dark:bg-[#2c2c2e] rounded-2xl grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => { setPrintStartDay(1); setPrintEndDay(daysArray.length); }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      printStartDay === 1 && printEndDay === daysArray.length 
                        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white shadow-sm font-black' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    یەک لاپەڕە (١-{daysArray.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPrintStartDay(1); setPrintEndDay(15); }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      printStartDay === 1 && printEndDay === 15 
                        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white shadow-sm font-black' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    پەڕەی ١ (١-١٥)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPrintStartDay(16); setPrintEndDay(daysArray.length); }}
                    className={`py-2 px-1 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      printStartDay === 16 && printEndDay === daysArray.length 
                        ? 'bg-white dark:bg-[#3a3a3c] text-slate-900 dark:text-white shadow-sm font-black' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    پەڕەی ٢ (١٦-{daysArray.length})
                  </button>
                </div>
              </div>

              {/* Range Inputs Card */}
              <div className="bg-white dark:bg-[#2c2c2e] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">لە ڕۆژی:</label>
                    <select 
                      value={printStartDay}
                      onChange={(e) => setPrintStartDay(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2 rounded-xl outline-none font-mono border border-slate-200/60 dark:border-white/5"
                    >
                      {daysArray.map(d => (
                        <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">بۆ ڕۆژی:</label>
                    <select 
                      value={printEndDay}
                      onChange={(e) => setPrintEndDay(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2 rounded-xl outline-none font-mono border border-slate-200/60 dark:border-white/5"
                    >
                      {daysArray.map(d => (
                        <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">دەستەی کارمەندان:</label>
                  <select 
                    value={printEmployeeFilter}
                    onChange={(e) => setPrintEmployeeFilter(e.target.value as any)}
                    className="w-full text-xs font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2 rounded-xl outline-none border border-slate-200/60 dark:border-white/5"
                  >
                    <option value="all">👥 هەموو ستاف و کارمەندان ({activeEmployees.length})</option>
                    <option value="managers">👑 تەنها بەڕێوەبەر و لێپرسراوان</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  داخستن
                </button>

                <button
                  type="button"
                  onClick={handleOpenCleanPrintNewTab}
                  className="px-6 py-2 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>کردنەوە و چاپکردن</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 FLOATING BATCH ACTION BAR (Apple iOS Liquid Glass Dock) */}
      {/* ========================================================================= */}
      {selectedCount > 0 && (
        <aside 
          aria-label="کردارە خێراکانی دەستکاری فرە-ڕۆژ"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-4xl w-[95%] sm:w-auto animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto select-none font-sans"
          dir="rtl"
        >
          <div className="bg-slate-900/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl text-white px-3 py-2.5 sm:px-5 sm:py-3 rounded-[26px] border border-white/20 shadow-2xl shadow-black/50 flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs">
            
            {/* 1. Counter Badge & Status */}
            <div className="flex items-center gap-2 pr-1 sm:pr-2 border-l border-white/15 pl-2 sm:pl-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#007AFF] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#007AFF]"></span>
              </span>
              <span className="font-black text-xs sm:text-sm text-blue-300 font-mono">
                {selectedCount}
              </span>
              <span className="text-slate-300 font-bold hidden sm:inline">
                {isDraggingCells ? 'خانە لە کاتی ڕاکێشاندان (ڕاکێشە)...' : 'خانە دیاریکراوە'}
              </span>
            </div>

            {/* 2. Quick 1-Click Status Chips */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {/* Present (Default 08:00 - 17:00) */}
              <button
                type="button"
                disabled={isApplyingBatch}
                onClick={() => handleApplyBatchData('Present', '08:00', '17:00')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="دانانی هەموو خانە دیاریکراوەکان وەک ئامادەبوو (08:00 تا 17:00)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                <span>ئامادەبوو</span>
              </button>

              {/* Leave (مۆڵەت) */}
              <button
                type="button"
                disabled={isApplyingBatch}
                onClick={() => handleApplyBatchData('Leave')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="دانانی هەموو خانە دیاریکراوەکان وەک مۆڵەت"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                <span>مۆڵەت</span>
              </button>

              {/* Holiday (پشوو) */}
              <button
                type="button"
                disabled={isApplyingBatch}
                onClick={() => handleApplyBatchData('Holiday')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="دانانی هەموو خانە دیاریکراوەکان وەک پشوو"
              >
                <span>🌴 پشوو</span>
              </button>

              {/* Absent (غیاب) */}
              <button
                type="button"
                disabled={isApplyingBatch}
                onClick={() => handleApplyBatchData('Absent')}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="دانانی هەموو خانە دیاریکراوەکان وەک غیاب"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                <span>غیاب</span>
              </button>

              {/* Clear/Delete */}
              <button
                type="button"
                disabled={isApplyingBatch}
                onClick={() => handleApplyBatchData('Empty')}
                className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 hover:text-white font-bold text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="سڕینەوەی داتای ئەم خانانە و بەتاڵکردنەوەیان"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">سڕینەوە</span>
              </button>
            </div>

            {/* 3. Custom Time & Details Modal Opener */}
            <div className="flex items-center gap-1 sm:gap-1.5 border-r border-white/15 pr-2 sm:pr-3">
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="کردنەوەی فۆڕمی دەستکاری بۆ دیاریکردنی کات و تێبینی تایبەت"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>کات و تێبینی...</span>
              </button>

              {/* Select All Matrix Button */}
              <button
                type="button"
                onClick={selectAllMatrix}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 text-[11px] sm:text-xs font-bold transition-all cursor-pointer"
                title="دیاریکردنی سەرجەم خانەکانی ئەم مانگە بۆ هەموو کارمەندان"
              >
                <span>هەموو خشتە</span>
              </button>

              {/* Cancel Selection */}
              <button
                type="button"
                onClick={clearAllSelection}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-600 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="لابردنی دیاریکردن (Cancel)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isApplyingBatch && (
              <span className="text-xs font-bold text-amber-300 animate-pulse mr-1 font-mono">
                پاشەکەوت دەکرێت...
              </span>
            )}

          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 🎯 BATCH & RANGE ATTENDANCE ENTRY MODAL (Apple iOS Liquid Retina) */}
      {/* ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 font-sans" dir="rtl">
          <div className="bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white rounded-[28px] border border-white/60 dark:border-white/10 shadow-2xl max-w-xl w-full p-0 overflow-hidden transition-all flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    داخڵکردن و دەستکاری فرە-ڕۆژ (Bulk Entry)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    دیاریکردنی چەند ڕۆژێک یان مەودا و تۆمارکردنی یەک داتا بە یەک کلیک
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-all active:scale-90"
                title="داخستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              
              {/* Selected Cells Indicator Banner */}
              {selectedCount > 0 && (
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between text-xs">
                  <span className="text-blue-900 dark:text-blue-200 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#007AFF]" />
                    <span>ئێستا {selectedCount} خانە لە خشتەکەدا دیاریکراوە و ئامادەیە</span>
                  </span>
                  <button
                    type="button"
                    onClick={clearAllSelection}
                    className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    پاککردنەوە
                  </button>
                </div>
              )}

              {/* 1. مەودای ڕۆژەکان و کارمەندان (Range & Target) */}
              <div className="bg-white dark:bg-[#2c2c2e] p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>١. دیاریکردنی کارمەندان و مەودای ڕۆژەکان:</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Target & Range</span>
                </div>

                {/* Employee Target */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">کێ دەگرێتەوە؟</label>
                  <select
                    value={rangeTargetEmp}
                    onChange={(e) => setRangeTargetEmp(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2.5 rounded-xl outline-none border border-slate-200/60 dark:border-white/5 focus:border-[#007AFF]"
                  >
                    <option value="all">👥 هەموو ستاف و کارمەندان ({activeEmployees.length} کارمەند)</option>
                    <option value="managers">👑 تەنها بەڕێوەبەر و سەرپەرشتیاران</option>
                    <optgroup label="دیاریکردنی تاکە کارمەند:">
                      {activeEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName3Part || emp.name} ({emp.id})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Days Range (From Day -> To Day) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">لە ڕۆژی مانگ:</label>
                    <select
                      value={rangeStartDay}
                      onChange={(e) => setRangeStartDay(Number(e.target.value))}
                      className="w-full text-xs font-bold font-mono bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2 rounded-xl outline-none border border-slate-200/60 dark:border-white/5"
                    >
                      {daysArray.map(d => (
                        <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">تا ڕۆژی مانگ:</label>
                    <select
                      value={rangeEndDay}
                      onChange={(e) => setRangeEndDay(Number(e.target.value))}
                      className="w-full text-xs font-bold font-mono bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2 rounded-xl outline-none border border-slate-200/60 dark:border-white/5"
                    >
                      {daysArray.map(d => (
                        <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Day Type Filter Presets */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">فلتەری جۆری ڕۆژەکان لەم مەودایە:</label>
                  <div className="p-1 bg-slate-100 dark:bg-[#1c1c1e] rounded-xl grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setRangeDayType('all')}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        rangeDayType === 'all'
                          ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      هەموو ڕۆژەکان
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeDayType('workdays')}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        rangeDayType === 'workdays'
                          ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      دەوام (بێ هەینی)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeDayType('fridays')}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        rangeDayType === 'fridays'
                          ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-black'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      تەنها هەینییەکان
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. داتای نوێ بۆ جێبەجێکردن (New Attendance Data) */}
              <div className="bg-white dark:bg-[#2c2c2e] p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>٢. داتای نوێ بۆ داخڵکردن بە یەکجار:</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Values to Apply</span>
                </div>

                {/* Status Choice */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">حاڵەت:</label>
                  <div className="p-1 bg-slate-100 dark:bg-[#1c1c1e] rounded-2xl grid grid-cols-5 gap-1">
                    {[
                      { key: 'Present', label: 'ئامادەبوو', dot: 'bg-emerald-500' },
                      { key: 'Leave', label: 'مۆڵەت', dot: 'bg-amber-500' },
                      { key: 'Holiday', label: 'پشوو', dot: 'bg-blue-500' },
                      { key: 'Absent', label: 'غیاب', dot: 'bg-rose-500' },
                      { key: 'Empty', label: 'سڕینەوە', dot: 'bg-slate-400' },
                    ].map(s => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setBatchStatus(s.key)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          batchStatus === s.key
                            ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className="text-[11px]">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Check-In / Check-Out Times if Present */}
                {batchStatus === 'Present' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">کاتی هاتن:</label>
                      <input
                        type="time"
                        value={batchCheckIn}
                        onChange={(e) => setBatchCheckIn(e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 outline-none focus:border-[#007AFF]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">کاتی چوون:</label>
                      <input
                        type="time"
                        value={batchCheckOut}
                        onChange={(e) => setBatchCheckOut(e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 outline-none focus:border-[#007AFF]"
                      />
                    </div>
                  </div>
                )}

                {/* Admin Note */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    تێبینی ئەدمین (ئارەزوومەندانە):
                  </label>
                  <input
                    type="text"
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    placeholder="هۆکاری گۆڕانکاری، بۆ نموونە: پشووی فەرمی، ئامادەبوونی دەوامی تەواو..."
                    className="w-full text-xs bg-slate-100 dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 outline-none focus:border-[#007AFF] font-medium"
                  />
                </div>
              </div>

            </div>

            {/* Footer / Actions */}
            <div className="px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                داخستن
              </button>

              <div className="flex items-center gap-2">
                {/* Button 1: Just Select Range in Matrix */}
                <button
                  type="button"
                  onClick={selectByRange}
                  className="px-4 py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-indigo-200/50"
                  title="تەنها ئەم ڕۆژانە لە خشتەکەدا دەستنیشان بکە بێ ئەوەی یەکسەر دەستکاری بکرێت"
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>دیاریکردن لە خشتەدا</span>
                </button>

                {/* Button 2: Apply & Save Directly */}
                <button
                  type="button"
                  disabled={isApplyingBatch}
                  onClick={async () => {
                    const cells = selectedCount > 0 ? Object.values(selectedCells) : computeRangeCells();
                    await handleApplyBatchData(batchStatus, batchCheckIn, batchCheckOut, batchNote, cells);
                  }}
                  className="px-6 py-2 rounded-full bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isApplyingBatch ? 'پاشەکەوت دەکرێت...' : 'جێبەجێکردنی ڕاستەوخۆ'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌟 EMPLOYEE 360 HR DOSSIER MODAL */}
      {/* ========================================================================= */}
      {selectedEmp360 && (
        <AdminEmployeeDetailsModal
          employee={selectedEmp360}
          selectedMonth={selectedMonth}
          attendanceLogs={attendanceLogs}
          adminNotes={{}}
          onClose={() => setSelectedEmp360(null)}
        />
      )}

    </div>
  );
}
