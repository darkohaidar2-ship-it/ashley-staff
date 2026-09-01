'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { 
  Calendar, 
  MapPin, 
  Search, 
  Download, 
  FileText, 
  Smartphone, 
  RefreshCw, 
  Sparkles,
  ShieldCheck,
  Building2,
  ChevronRight,
  ChevronLeft,
  Utensils,
  DoorOpen,
  Check,
  AlertCircle,
  AlertTriangle,
  Move,
  BarChart3,
  X,
  Crown,
  Award,
  Printer,
  FileSpreadsheet,
  Clock,
  UserCheck,
  CheckCircle2,
  Trash2,
  Camera,
  Filter
} from 'lucide-react';
import { getDaysInMonth, format, getDay, addMonths, subMonths } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface NewGpsAttendanceMatrixTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

export function NewGpsAttendanceMatrixTable({ employees = [], attendanceLogs = [] }: NewGpsAttendanceMatrixTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Cell Click Modal State for In-depth Editing & 24h Visual Graph
  const [selectedDayModal, setSelectedDayModal] = useState<{
    emp: Employee;
    dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean };
    info: any;
  } | null>(null);

  // Modal Form States
  const [modalStatus, setModalStatus] = useState<string>('Present');
  const [modalCheckIn, setModalCheckIn] = useState<string>('08:30');
  const [modalCheckOut, setModalCheckOut] = useState<string>('16:30');
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  // Status Drag & Drop Quick Palette
  const [selectedPaletteStatus, setSelectedPaletteStatus] = useState<string>('Present');
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null);

  // Dynamic Manual Overrides Map for cell statuses
  const [manualStatusMap, setManualStatusMap] = useState<Record<string, { status: string; checkInTime?: string; checkOutTime?: string }>>({});

  // 🖨️ Custom Range Print / Google Sheets Export Modal State
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printStartDay, setPrintStartDay] = useState<number>(1);
  const [printEndDay, setPrintEndDay] = useState<number>(31);
  const [printEmployeeFilter, setPrintEmployeeFilter] = useState<'all' | 'managers' | 'custom'>('all');
  const [selectedPrintEmpIds, setSelectedPrintEmpIds] = useState<string[]>([]);

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
      const isFriday = getDay(dateObj) === 5;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      return { dayNum, dateStr, isFriday, isFuture, isToday };
    });
  }, [totalDays, year, month, selectedMonth, todayStr]);

  // Adjust printEndDay if month days change
  useEffect(() => {
    setPrintEndDay(totalDays);
  }, [totalDays]);

  // Fetch saved manual records from server
  const loadSavedRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        (data.attendance || []).forEach((r: any) => {
          map[`${r.userId}_${r.date}`] = {
            status: r.status,
            checkInTime: r.checkInTime,
            checkOutTime: r.checkOutTime
          };
        });
        setManualStatusMap(map);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadSavedRecords();
    const interval = setInterval(loadSavedRecords, 4000);
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

  // Lookup record function for any employee & day
  const getGpsLogsForEmpAndDay = useCallback((emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean }) => {
    const { dateStr, isFriday, isFuture, isToday } = dayItem;
    const empId = (emp.id || '').toString().trim().toLowerCase();
    const empNum = empId.replace('emp-', '');
    const empName = (emp.name || emp.fullName3Part || '').trim().toLowerCase();

    // 1. Check manual override first
    const override = manualStatusMap[`${emp.id}_${dateStr}`] || manualStatusMap[`${empNum}_${dateStr}`] || manualStatusMap[`emp-${empNum}_${dateStr}`];
    if (override) {
      return {
        hasRecord: true,
        isFriday,
        isFuture,
        isToday,
        checkInTime: override.checkInTime || '',
        checkOutTime: override.checkOutTime || '',
        status: override.status,
        warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
        workedHours: override.status === 'Present' ? 8 : 0,
      };
    }

    // 2. Friday Holiday
    if (isFriday) {
      return {
        hasRecord: false,
        isFriday: true,
        isFuture,
        isToday,
        checkInTime: '',
        checkOutTime: '',
        status: 'Holiday',
        warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
        workedHours: 0,
      };
    }

    // 3. Future Days
    if (isFuture) {
      return {
        hasRecord: false,
        isFriday: false,
        isFuture: true,
        isToday: false,
        checkInTime: '',
        checkOutTime: '',
        status: 'Future',
        warehouseName: '',
        workedHours: 0,
      };
    }

    // 4. Past or Today: Search actual GPS logs from server
    const dayRecords = attendanceLogs.filter(log => {
      const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
      if (logDate !== dateStr) return false;

      const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
      const logName = (log.name || log.userName || (log as any).employeeName || '').trim().toLowerCase();

      return (
        logEmpId === empId || 
        logEmpId === empNum || 
        logEmpId === `emp-${empNum}` ||
        (logName && (logName === empName || logName.includes(empName) || empName.includes(logName)))
      );
    });

    let checkInTime = '';
    let checkOutTime = '';
    let warehouseName = 'کۆمپانیای سەرەکی ئاشڵی';

    dayRecords.forEach((r: any) => {
      const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '');
      const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '');

      if (inCandidate && !checkInTime) checkInTime = inCandidate.slice(0, 5);
      if (outCandidate) checkOutTime = outCandidate.slice(0, 5);
      if (r.warehouseName || r.warehouse_name) warehouseName = r.warehouseName || r.warehouse_name;
    });

    const hasRecord = Boolean(checkInTime || checkOutTime);
    let status = 'Absent';

    if (hasRecord) {
      status = 'Present';
    } else if (isToday) {
      status = 'Pending';
    }

    return {
      hasRecord,
      isFriday: false,
      isFuture: false,
      isToday,
      checkInTime,
      checkOutTime,
      status,
      warehouseName,
      workedHours: hasRecord ? 8 : 0,
    };
  }, [manualStatusMap, attendanceLogs]);

  // Open Cell Click Modal
  const handleCellClick = (emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean }) => {
    const info = getGpsLogsForEmpAndDay(emp, dayItem);
    setSelectedDayModal({ emp, dayItem, info });
    setModalStatus(info.status === 'Future' || info.status === 'Pending' ? 'Present' : info.status);
    setModalCheckIn(info.checkInTime || '08:30');
    setModalCheckOut(info.checkOutTime || '16:30');
  };

  // Save Modal Changes
  const handleSaveModal = async () => {
    if (!selectedDayModal) return;
    setIsSavingModal(true);
    const { emp, dayItem } = selectedDayModal;
    const key = `${emp.id}_${dayItem.dateStr}`;

    try {
      // Optimistic Update
      setManualStatusMap(prev => ({
        ...prev,
        [key]: {
          status: modalStatus,
          checkInTime: modalStatus === 'Present' ? modalCheckIn : modalStatus === 'Leave' ? 'مۆڵەت' : undefined,
          checkOutTime: modalStatus === 'Present' ? modalCheckOut : modalStatus === 'Leave' ? 'مۆڵەت' : undefined
        }
      }));

      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: emp.id,
          userName: emp.fullName3Part || emp.name,
          date: dayItem.dateStr,
          status: modalStatus,
          checkInTime: modalStatus === 'Present' ? modalCheckIn : undefined,
          checkOutTime: modalStatus === 'Present' ? modalCheckOut : undefined
        })
      });

      loadSavedRecords();
      setSelectedDayModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingModal(false);
    }
  };

  // Delete / Reset this day's record
  const handleDeleteDayRecord = async () => {
    if (!selectedDayModal) return;
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی تۆماری ئەم ڕۆژە؟')) return;
    const { emp, dayItem } = selectedDayModal;
    const key = `${emp.id}_${dayItem.dateStr}`;

    setManualStatusMap(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    try {
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: emp.id,
          userName: emp.fullName3Part || emp.name,
          date: dayItem.dateStr,
          status: 'Absent'
        })
      });
      loadSavedRecords();
      setSelectedDayModal(null);
    } catch (e) {}
  };

  // Drag & Drop Instant Drop
  const handleDirectDrop = async (userId: string, userName: string, dateStr: string, status: string) => {
    const key = `${userId}_${dateStr}`;
    setManualStatusMap(prev => ({
      ...prev,
      [key]: {
        status,
        checkInTime: status === 'Present' ? '08:30' : status === 'Leave' ? 'مۆڵەت' : undefined,
        checkOutTime: status === 'Present' ? '16:30' : status === 'Leave' ? 'مۆڵەت' : undefined
      }
    }));

    try {
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, date: dateStr, status })
      });
      loadSavedRecords();
    } catch (e) {}
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

  // Trigger Native Browser Print Window
  const handlePrintWindow = () => {
    window.print();
  };

  return (
    <div className="space-y-3 font-sans select-none" dir="rtl">
      
      {/* 🪟 Windows 11 Sharp Matrix Header Container */}
      <div className="bg-slate-900 border-2 border-slate-700 rounded-none p-4 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-blue-600 border border-blue-400 flex items-center justify-center text-white shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-wide text-white">
                  خشتەی ۳۱ ڕۆژەی ئامادەبوونی کارمەندان (31-Day GPS Matrix)
                </h2>
                <span className="px-2 py-0.5 rounded-none text-[9px] font-black bg-blue-950 text-blue-300 border border-blue-500 font-mono">
                  شێفتی فەرمی: 8:30 بۆ 16:30
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                کلیک لەسەر هەر خانەیەک بکە بۆ بینینی هێڵکاری ٢٤ کاتژمێری و وێنە و گۆڕینی فەرمانی کات.
              </p>
            </div>
          </div>

          {/* Month Navigator & Print Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 border border-slate-600 rounded-none">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-bold font-mono focus:outline-none cursor-pointer text-xs"
              />
            </div>
            
            {/* 🖨️ Prominent Print & Custom Range Button */}
            <button 
              onClick={() => setShowPrintModal(true)} 
              className="px-3.5 py-1.5 rounded-none bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer border border-blue-400 transition-transform active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-white" />
              <span>🖨️ چاپکردنی تایبەت (وەک Google Sheet)</span>
            </button>
          </div>
        </div>

        {/* Status Drag & Drop Quick Palette Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
              <Move className="w-3.5 h-3.5" />
              <span>پالێتی Drag & Drop (ڕایبکێشە بۆ سەر هەر خانەیەک):</span>
            </span>
            {[
              { key: 'Present', label: '🟢 ئامادەبوو', bg: 'bg-emerald-600 text-white border-emerald-700' },
              { key: 'Leave', label: '🟡 مۆڵەت', bg: 'bg-amber-400 text-amber-950 border-amber-500' },
              { key: 'Absent', label: '🔴 غیاب', bg: 'bg-rose-600 text-white border-rose-700' },
              { key: 'Holiday', label: '🌴 پشوو (هەینی)', bg: 'bg-teal-600 text-white border-teal-700' }
            ].map(p => (
              <div
                key={p.key}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', p.key);
                  setDraggedStatus(p.key);
                }}
                onDragEnd={() => setDraggedStatus(null)}
                className={`px-3 py-1 rounded-none text-[10px] font-black border transition-all cursor-grab active:cursor-grabbing select-none flex items-center gap-1 shadow-2xs ${p.bg} opacity-90 hover:opacity-100`}
              >
                <span>{p.label}</span>
              </div>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="گەڕان بەدوای کارمەند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-2 pr-7 py-1 rounded-none bg-slate-800 border border-slate-600 text-xs font-bold text-white focus:outline-none placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 🪟 Windows 11 Sharp Matrix Table */}
      <div className="w-full overflow-x-auto border-2 border-slate-300 rounded-none shadow-sm bg-white max-h-[72vh] overflow-y-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 z-20">
            <tr>
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black px-3 py-2.5 border-l border-slate-300 z-30 min-w-[190px]">
                👤 ناوی کارمەند (ڕیزبەندی گرنگی)
              </th>
              {daysArray.map((d) => (
                <th 
                  key={d.dateStr} 
                  className={`text-center font-black p-1 border-l border-slate-300 min-w-[42px] ${
                    d.isToday ? 'bg-amber-100 text-amber-950 border-b-2 border-b-amber-500 font-black' :
                    d.isFriday ? 'bg-emerald-100 text-emerald-950 font-black' : 'text-slate-800'
                  }`}
                >
                  <div className="text-[10px]">{d.dayNum}</div>
                  <div className="text-[8px] font-bold">
                    {d.isToday ? '⚡ ئەمڕۆ' : d.isFriday ? '🌴 هەینی' : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeEmployees.map((emp, index) => {
              const isDarko = emp.id === 'emp-02' || (emp.fullName3Part || emp.name || '').includes('دارکۆ');
              const isManager = emp.role === 'Manager' || isDarko;

              return (
                <tr key={emp.id} className={`hover:bg-blue-50/40 transition-colors ${isDarko ? 'bg-amber-50/30' : ''}`}>
                  <td className="sticky right-0 bg-white z-10 px-3 py-2 border-l border-slate-300 font-bold shadow-xs">
                    <div className="flex items-center gap-1.5">
                      {isDarko ? (
                        <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      ) : isManager ? (
                        <Award className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400 font-normal">{index + 1}.</span>
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-900">{emp.fullName3Part || emp.name}</div>
                        <div className="text-[9px] font-mono text-slate-400">
                          {isDarko ? 'بەڕێوەبەری سەرەکی' : emp.role || 'Staff'} ({emp.id})
                        </div>
                      </div>
                    </div>
                  </td>
                  {daysArray.map((d) => {
                    const info = getGpsLogsForEmpAndDay(emp, d);
                    const isFriday = d.isFriday;
                    const isFuture = d.isFuture;

                    let badgeColor = 'bg-slate-50 text-slate-400 border-slate-200';
                    let badgeText = '-';

                    // 1. Future Day: clean neutral empty slot
                    if (isFuture && info.status === 'Future') {
                      badgeColor = 'bg-slate-50/60 text-slate-300 border-dashed border-slate-200 font-normal';
                      badgeText = '-';
                    }
                    // 2. Friday Holiday
                    else if (info.status === 'Holiday' || isFriday) {
                      badgeColor = 'bg-teal-50 text-teal-800 border-teal-200 font-black';
                      badgeText = '🌴';
                    }
                    // 3. Present / Check-in
                    else if (info.status === 'Present' || info.checkInTime) {
                      badgeColor = 'bg-emerald-600 text-white border-emerald-700 font-black';
                      badgeText = info.checkInTime || 'ئامادە';
                    }
                    // 4. Leave / مۆڵەت
                    else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
                      badgeColor = 'bg-amber-400 text-amber-950 border-amber-500 font-black';
                      badgeText = 'مۆڵەت';
                    }
                    // 5. Absent / غیاب
                    else if (info.status === 'Absent' || info.status === 'غیاب') {
                      badgeColor = 'bg-rose-600 text-white border-rose-700 font-black';
                      badgeText = 'غیاب';
                    }
                    // 6. Today Pending
                    else if (info.status === 'Pending') {
                      badgeColor = 'bg-slate-100 text-slate-500 border-slate-300 font-bold';
                      badgeText = '-';
                    }

                    return (
                      <td 
                        key={d.dateStr}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dropped = e.dataTransfer.getData('text/plain') || draggedStatus;
                          if (dropped) {
                            handleDirectDrop(emp.id, emp.name, d.dateStr, dropped);
                          }
                        }}
                        onClick={() => handleCellClick(emp, d)}
                        title="کلیک بکە بۆ کردنەوەی وردەکاری ٢٤ کاتژمێری و وێنە و دەستکاریکردنی کات"
                        className={`p-1 text-center border-l border-slate-200 cursor-pointer hover:bg-blue-100/70 hover:scale-[1.02] transition-all ${
                          d.isToday ? 'bg-amber-50/40' : isFriday ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <div className={`w-full py-1 rounded-none text-[9px] border shadow-2xs transition-all ${badgeColor}`}>
                          {badgeText}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 🪟 WINDOWS 11 SHARP MODAL: CELL CLICK IN-DEPTH 24-HOUR DETAILS & EDITOR */}
      {/* ========================================================================= */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-2xl w-full p-0 text-right font-sans">
            
            {/* Title Bar */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-xs text-white">
                  پەنجەرەی وردەکاری و گرافی ٢٤ کاتژمێری: {selectedDayModal.emp.fullName3Part || selectedDayModal.emp.name}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-amber-300 font-bold">{selectedDayModal.dayItem.dateStr}</span>
                <button 
                  onClick={() => setSelectedDayModal(null)}
                  className="w-6 h-6 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs font-mono transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              
              {/* Employee Info Header */}
              <div className="p-3 bg-slate-50 border border-slate-300 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-slate-900 text-white font-black flex items-center justify-center text-sm border border-slate-700 shadow-xs">
                    {(selectedDayModal.emp.name || '').slice(0, 2)}
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">{selectedDayModal.emp.fullName3Part || selectedDayModal.emp.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                      <span>کۆد: {selectedDayModal.emp.id}</span>
                      <span>•</span>
                      <span>پلە: {selectedDayModal.emp.role || 'Staff'}</span>
                      <span>•</span>
                      <span>مۆبایل: {selectedDayModal.emp.phone || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-left text-xs">
                  <span className="text-[10px] text-slate-400 block font-bold">📍 لۆکەیشنی GPS:</span>
                  <span className="font-bold text-slate-800">{selectedDayModal.info.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی'}</span>
                </div>
              </div>

              {/* Status Selector Palette */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-700 block">حاڵەتی فەرمانی ئەم ڕۆژە:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'Present', label: '🟢 ئامادەبوو', bg: 'bg-emerald-600 text-white border-emerald-700' },
                    { key: 'Leave', label: '🟡 مۆڵەت', bg: 'bg-amber-400 text-amber-950 border-amber-500' },
                    { key: 'Absent', label: '🔴 غیاب', bg: 'bg-rose-600 text-white border-rose-700' },
                    { key: 'Holiday', label: '🌴 پشوو', bg: 'bg-teal-600 text-white border-teal-700' }
                  ].map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setModalStatus(s.key)}
                      className={`py-2 px-3 rounded-none text-xs font-black border transition-all cursor-pointer ${s.bg} ${
                        modalStatus === s.key ? 'ring-2 ring-blue-600 shadow-md scale-105' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Inputs (Only active if Present) */}
              {modalStatus === 'Present' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/60 border border-blue-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>کاتی هاتن (Check-in):</span>
                    </label>
                    <input 
                      type="time" 
                      value={modalCheckIn}
                      onChange={(e) => setModalCheckIn(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none font-mono text-center"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>کاتی دەرچوون (Check-out):</span>
                    </label>
                    <input 
                      type="time" 
                      value={modalCheckOut}
                      onChange={(e) => setModalCheckOut(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none font-mono text-center"
                    />
                  </div>
                </div>
              )}

              {/* 24-Hour Interactive Timeline Visual Graph */}
              <div className="space-y-2 p-3 bg-slate-100 rounded-none border border-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">📊 گرافی ٢٤ کاتژمێری چالاکی دەوامی ئەم ڕۆژە:</span>
                  <span className="text-[10px] font-bold text-blue-700">دەوامی فەرمی: 08:30 بۆ 16:30</span>
                </div>

                <div className="relative w-full h-12 bg-white rounded-none overflow-hidden border border-slate-300">
                  {/* Official Shift Guide Window */}
                  <div className="absolute top-0 bottom-0 bg-blue-100/70 border-x-2 border-dashed border-blue-400/80 pointer-events-none" style={{ left: '35.4%', width: '33.3%' }} />
                  
                  {modalStatus === 'Present' && (
                    <div 
                      className="absolute top-1 bottom-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-none flex items-center justify-center text-[10px] font-mono font-bold shadow-xs border border-emerald-700"
                      style={{ left: '35.4%', width: '33.3%' }}
                    >
                      {modalCheckIn} - {modalCheckOut} (٨ کاتژمێر)
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 font-bold">
                  <span>00:00</span>
                  <span>04:00</span>
                  <span className="text-blue-700 font-black">08:30 (دەستپێک)</span>
                  <span>12:00</span>
                  <span className="text-blue-700 font-black">16:30 (تەواو)</span>
                  <span>20:00</span>
                  <span>24:00</span>
                </div>
              </div>

              {/* Modal Bottom Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDeleteDayRecord}
                  className="px-3 py-2 rounded-none bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>سڕینەوەی ئەم ڕۆژە</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDayModal(null)}
                    className="px-4 py-2 rounded-none bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    داخستن
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModal}
                    disabled={isSavingModal}
                    className="px-6 py-2 rounded-none bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isSavingModal ? 'لە پاشەکەوتکردندایە...' : '💾 پاشەکەوتکردنی گۆڕانکاری'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ WINDOWS 11 SHARP MODAL: CUSTOM RANGE PRINT & GOOGLE SHEETS EXPORT */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-4xl w-full p-0 text-right font-sans">
            
            {/* Title Bar */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-xs text-white">
                  🖨️ چاپکردنی تایبەت و هەناردەکردنی خشتە وەک Google Sheets
                </h3>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="w-6 h-6 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs font-mono transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              
              {/* Range Filters Box */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-300">
                {/* Date Range Start */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700">لە ڕۆژی (Start Day):</label>
                  <select 
                    value={printStartDay}
                    onChange={(e) => setPrintStartDay(Number(e.target.value))}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none font-mono"
                  >
                    {daysArray.map(d => (
                      <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range End */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700">بۆ ڕۆژی (End Day):</label>
                  <select 
                    value={printEndDay}
                    onChange={(e) => setPrintEndDay(Number(e.target.value))}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none font-mono"
                  >
                    {daysArray.map(d => (
                      <option key={d.dayNum} value={d.dayNum}>ڕۆژی {d.dayNum}</option>
                    ))}
                  </select>
                </div>

                {/* Employee Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700">دەستەی کارمەندان:</label>
                  <select 
                    value={printEmployeeFilter}
                    onChange={(e) => setPrintEmployeeFilter(e.target.value as any)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none"
                  >
                    <option value="all">👥 هەموو ستاف و کارمەندان ({activeEmployees.length})</option>
                    <option value="managers">👑 تەنها بەڕێوەبەر و لێپرسراوان</option>
                  </select>
                </div>
              </div>

              {/* Printable Live Preview Table (Styled as Google Sheet) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">📄 پێشبینینی خشتەی چاپکراو (Google Sheets Preview):</span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    {printDays.length} ڕۆژ هەڵبژێردراوە ({printStartDay} تا {printEndDay})
                  </span>
                </div>

                <div className="overflow-x-auto border-2 border-slate-400 bg-white max-h-60 overflow-y-auto">
                  <table className="w-full text-[10px] text-right border-collapse">
                    <thead className="bg-slate-200 border-b-2 border-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2 font-black border-l border-slate-300 min-w-[140px]">ناوی کارمەند</th>
                        {printDays.map(d => (
                          <th key={d.dateStr} className="p-1 text-center font-black border-l border-slate-300 min-w-[32px]">
                            {d.dayNum}
                          </th>
                        ))}
                        <th className="p-2 text-center font-black border-l border-slate-300">کۆی ئامادەبوون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {printEmployees.map((emp, i) => {
                        let presentDaysCount = 0;
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-1.5 font-bold border-l border-slate-300">
                              {i + 1}. {emp.fullName3Part || emp.name}
                            </td>
                            {printDays.map(d => {
                              const info = getGpsLogsForEmpAndDay(emp, d);
                              if (info.hasRecord) presentDaysCount++;
                              return (
                                <td key={d.dateStr} className="p-1 text-center border-l border-slate-300 font-mono">
                                  {info.hasRecord ? (info.checkInTime || 'ئامادە') : info.status === 'Leave' ? 'مۆڵەت' : info.isFriday ? '🌴' : '-'}
                                </td>
                              );
                            })}
                            <td className="p-1 text-center font-black border-l border-slate-300 font-mono text-emerald-700">
                              {presentDaysCount} ڕۆژ
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 rounded-none bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  داخستن
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintWindow}
                    className="px-6 py-2 rounded-none bg-blue-700 hover:bg-blue-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>🖨️ چاپکردن دەستبەجێ (Print Now)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
