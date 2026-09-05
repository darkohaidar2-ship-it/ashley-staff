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
  ExternalLink
} from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import Link from 'next/link';
import { AdminEmployeeDetailsModal } from '@/components/admin/AdminEmployeeDetailsModal';

interface NewGpsAttendanceMatrixTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

export function NewGpsAttendanceMatrixTable({ employees = [], attendanceLogs = [] }: NewGpsAttendanceMatrixTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 🌟 Employee 360 HR Dossier Modal State
  const [selectedEmp360, setSelectedEmp360] = useState<Employee | null>(null);

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

  // Fetch saved manual records from server & Supabase
  const loadSavedRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        (data.attendance || []).forEach((r: any) => {
          if (r.status && r.status !== 'empty' && r.status !== 'delete' && r.status !== 'Empty') {
            map[`${r.userId}_${r.date}`] = {
              status: r.status,
              checkInTime: r.checkInTime,
              checkOutTime: r.checkOutTime
            };
          }
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
      if (override.status === 'empty' || override.status === 'Empty' || override.status === 'delete') {
        return {
          hasRecord: false,
          isFriday,
          isFuture,
          isToday,
          checkInTime: '',
          checkOutTime: '',
          status: 'Empty',
          warehouseName: '',
          workedHours: 0,
        };
      }

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

    // 3. Future Days -> Clean neutral empty slot
    if (isFuture) {
      return {
        hasRecord: false,
        isFriday: false,
        isFuture: true,
        isToday: false,
        checkInTime: '',
        checkOutTime: '',
        status: 'Empty',
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
    let status = 'Empty';

    if (hasRecord) {
      status = 'Present';
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

  // Open Cell Click Modal (Does NOT overwrite arbitrarily)
  const handleCellClick = (emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean }) => {
    const info = getGpsLogsForEmpAndDay(emp, dayItem);
    setSelectedDayModal({ emp, dayItem, info });
    setModalStatus(info.status === 'Empty' ? 'Present' : info.status);
    setModalCheckIn(info.checkInTime || '08:30');
    setModalCheckOut(info.checkOutTime || '16:30');
  };

  // Save Modal Changes to Supabase
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

  // 🗑️ Delete / Clear Record -> Sets to Empty '-' and Deletes from Supabase
  const handleDeleteDayRecord = async () => {
    if (!selectedDayModal) return;
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم داتایە بە تەواوی؟ خانەکە بەتاڵ دەبێتەوە.')) return;
    const { emp, dayItem } = selectedDayModal;
    const key = `${emp.id}_${dayItem.dateStr}`;

    // Optimistic Clean Blank Update
    setManualStatusMap(prev => ({
      ...prev,
      [key]: {
        status: 'Empty',
        checkInTime: undefined,
        checkOutTime: undefined
      }
    }));

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

  // 🖨️ OPEN PURE CLEAN PRINT IN SEPARATED NEW TAB
  const handleOpenCleanPrintNewTab = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('تکایە ڕێگە بدە بە کردنەوەی پەنجەرەی نوێ (Pop-up blocker) لە برۆوسەرەکەتدا.');
      return;
    }

    const rowsHtml = printEmployees.map((emp, idx) => {
      let presentCount = 0;
      let leaveCount = 0;
      let totalWorkedHours = 0;

      const dayCells = printDays.map(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        let cellText = '-';
        let cellStyle = 'color: #888; font-weight: normal;';

        if (info.hasRecord || info.status === 'Present') {
          presentCount++;
          totalWorkedHours += 8;
          const inT = info.checkInTime || '08:30';
          const outT = info.checkOutTime || (d.isToday ? 'بەردەوام' : '16:30');
          cellText = `
            <div style="background: #059669; color: #ffffff; padding: 1px 2px; font-weight: 800; font-size: 7.5px; border-radius: 1px; margin-bottom: 1px; white-space: nowrap;">هاتن ${inT}</div>
            <div style="background: #047857; color: #ecfdf5; padding: 1px 2px; font-weight: 800; font-size: 7.5px; border-radius: 1px; white-space: nowrap;">چوون ${outT}</div>
          `;
          cellStyle = 'background-color: #ecfdf5; padding: 2px 1px; border: 1px solid #6ee7b7; text-align: center;';
        } else if (info.status === 'Leave') {
          leaveCount++;
          cellText = 'مۆڵەت';
          cellStyle = 'color: #d97706; font-weight: bold; background-color: #fffbeb;';
        } else if (info.status === 'Absent') {
          cellText = 'غیاب';
          cellStyle = 'color: #dc2626; font-weight: bold; background-color: #fef2f2;';
        } else if (info.isFriday || info.status === 'Holiday') {
          cellText = 'پشوو';
          cellStyle = 'color: #0d9488; font-weight: bold; background-color: #f0fdfa;';
        }

        return `<td style="border: 1px solid #94a3b8; padding: 3px 2px; text-align: center; font-size: 9px; ${cellStyle}">${cellText}</td>`;
      }).join('');

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #94a3b8; padding: 6px 8px; font-weight: bold; text-align: right; font-size: 11px; white-space: nowrap;">
            ${idx + 1}. ${emp.fullName3Part || emp.name}
            <span style="font-size: 9px; color: #64748b; font-family: monospace; display: block;">${emp.role || 'Staff'} (${emp.id})</span>
          </td>
          ${dayCells}
          <td style="border: 1px solid #94a3b8; padding: 5px; text-align: center; font-weight: bold; font-family: monospace; color: #047857; background-color: #f0fdf4;">${presentCount} ڕۆژ</td>
          <td style="border: 1px solid #94a3b8; padding: 5px; text-align: center; font-weight: bold; font-family: monospace; color: #b45309; background-color: #fffbeb;">${leaveCount}</td>
          <td style="border: 1px solid #94a3b8; padding: 5px; text-align: center; font-weight: bold; font-family: monospace; color: #1e3a8a; background-color: #eff6ff;">${totalWorkedHours}h</td>
        </tr>
      `;
    }).join('');

    const headersHtml = printDays.map(d => `
      <th style="border: 1px solid #64748b; padding: 4px 2px; text-align: center; background-color: ${d.isFriday ? '#d1fae5' : '#e2e8f0'}; font-size: 10px; min-width: 48px;">
        <div>${d.dayNum}</div>
        <div style="font-size: 7px; font-weight: normal; color: #475569;">${d.isFriday ? 'هەینی' : ''}</div>
      </th>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ckb">
      <head>
        <meta charset="UTF-8">
        <title>Ashley Attendance Sheet - ${selectedMonth} (Days ${printStartDay}-${printEndDay})</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 10px;
            color: #0f172a;
            background-color: #ffffff;
            direction: rtl;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 10px;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        
        <div class="no-print" style="margin-bottom: 12px; padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong style="font-size: 13px;">🖨️ پەڕەی فەرمی ئامادەبوونی کارمەندان (Ashley Google Sheet Print View)</strong>
            <span style="font-size: 11px; color: #64748b; margin-right: 8px;">ئەم پەڕەیە بە تەواوی ڕێکخراوە و شتی زیادەی تێدا نییە.</span>
          </div>
          <button onclick="window.print()" style="background: #1e3a8a; color: white; border: none; padding: 8px 18px; font-weight: bold; font-size: 12px; cursor: pointer; border-radius: 2px;">
            🖨️ دەستبەجێ پرێنت بکە (Print)
          </button>
        </div>

        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 16px; font-weight: 900; color: #0f172a;">کۆمپانیای ئاشڵی (Ashley Industrial Company)</h1>
            <h2 style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #334155;">
              ڕاپۆرتی ئامادەبوونی کارمەندان — مانگی ${selectedMonth} (ڕۆژانی ${printStartDay} تا ${printEndDay})
            </h2>
          </div>
          <div style="text-align: left; font-size: 10px; font-family: monospace; color: #475569;">
            <div>بەرواری چاپ: ${todayStr}</div>
            <div>دەوامی فەرمی: 08:30 بۆ 16:30</div>
          </div>
        </div>

        <table>
          <thead>
            <tr style="background-color: #cbd5e1;">
              <th style="border: 1px solid #64748b; padding: 6px 8px; text-align: right; font-size: 11px; min-width: 140px;">ناوی کارمەند</th>
              ${headersHtml}
              <th style="border: 1px solid #64748b; padding: 4px; text-align: center; font-size: 10px;">ئامادە</th>
              <th style="border: 1px solid #64748b; padding: 4px; text-align: center; font-size: 10px;">مۆڵەت</th>
              <th style="border: 1px solid #64748b; padding: 4px; text-align: center; font-size: 10px;">کۆی کاژێر</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-around; text-align: center; font-size: 11px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 15px;">
          <div>
            <div>ئامادەکاری ئامادەبوون (HR):</div>
            <div style="margin-top: 25px; border-bottom: 1px dotted #94a3b8; width: 140px; margin-left: auto; margin-right: auto;"></div>
          </div>
          <div>
            <div>بەڕێوەبەری ژمێریاری و وردبینی:</div>
            <div style="margin-top: 25px; border-bottom: 1px dotted #94a3b8; width: 140px; margin-left: auto; margin-right: auto;"></div>
          </div>
          <div>
            <div>پەسەندکردنی بەڕێوەبەری سەرەکی (دارکۆ حەیدەر):</div>
            <div style="margin-top: 25px; border-bottom: 1px dotted #94a3b8; width: 160px; margin-left: auto; margin-right: auto;"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
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
                کلیک لەسەر ناوی کارمەند بکە بۆ کردنەوەی پەڕەی HR و وێنە — کلیک لەسەر خانەکان بکە بۆ دەستکاری.
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
              <span>🖨️ چاپکردنی تایبەت (Google Sheets)</span>
            </button>
          </div>
        </div>

        {/* Status Drag & Drop Quick Palette Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
              <Move className="w-3.5 h-3.5" />
              <span>پالێتی Drag & Drop:</span>
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
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black px-3 py-2.5 border-l border-slate-300 z-30 min-w-[200px]">
                👤 ناوی کارمەند (فایلی HR)
              </th>
              {daysArray.map((d) => (
                <th 
                  key={d.dateStr} 
                  className={`text-center font-black p-1 border-l border-slate-300 min-w-[54px] sm:min-w-[62px] ${
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
                    <Link
                      href={`/employees/${emp.id}`}
                      className="flex items-center gap-2 text-right hover:text-blue-700 cursor-pointer group transition-colors w-full"
                      title="کلیک بکە بۆ کردنەوەی پەیجی فەرمی ئەم کارمەندە و ئامێر و مۆبایلەکەی"
                    >
                      <div className="w-8 h-8 rounded-none bg-slate-800 border border-slate-600 overflow-hidden flex items-center justify-center text-white text-xs font-black flex-shrink-0 group-hover:border-blue-600">
                        {emp.photoUrl ? (
                          <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{emp.name.slice(0, 1)}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-blue-700 flex items-center gap-1">
                          <span>{emp.fullName3Part || emp.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">
                          {isDarko ? 'بەڕێوەبەری سەرەکی' : emp.role || 'Staff'} ({emp.id})
                        </div>
                      </div>
                    </Link>
                  </td>
                  {daysArray.map((d) => {
                    const info = getGpsLogsForEmpAndDay(emp, d);
                    const isFriday = d.isFriday;
                    const isPresent = info.status === 'Present' || Boolean(info.checkInTime);
                    const inTime = info.checkInTime || '08:30';
                    const outTime = info.checkOutTime || (d.isToday ? 'بەردەوام' : '16:30');

                    let badgeColor = 'bg-slate-50 text-slate-300 border-dashed border-slate-200 font-normal';
                    let badgeText = '-';

                    // 1. Friday Holiday
                    if (info.status === 'Holiday' || isFriday) {
                      badgeColor = 'bg-teal-50 text-teal-800 border-teal-200 font-black';
                      badgeText = '🌴';
                    }
                    // 2. Present / Check-in
                    else if (isPresent) {
                      badgeColor = 'bg-emerald-600 text-white border-emerald-700 font-black';
                      badgeText = inTime;
                    }
                    // 3. Leave / مۆڵەت
                    else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
                      badgeColor = 'bg-amber-400 text-amber-950 border-amber-500 font-black';
                      badgeText = 'مۆڵەت';
                    }
                    // 4. Absent / غیاب
                    else if (info.status === 'Absent' || info.status === 'غیاب') {
                      badgeColor = 'bg-rose-600 text-white border-rose-700 font-black';
                      badgeText = 'غیاب';
                    }
                    // 5. Empty / Clean Blank / Future
                    else {
                      badgeColor = 'bg-slate-50 text-slate-300 border-dashed border-slate-200 font-normal';
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
                        title={`کلیک بکە بۆ بینینی وردەکاری و دەستکاری\nهاتن: ${info.checkInTime || '08:30'}\nڕۆیشتن: ${info.checkOutTime || (d.isToday ? 'بەردەوام' : '16:30')}`}
                        className={`p-0.5 text-center border-l border-slate-200 cursor-pointer hover:bg-emerald-100/60 transition-all ${
                          d.isToday ? 'bg-amber-50/50 ring-1 ring-inset ring-amber-400' : isFriday ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        {isPresent ? (
                          <div className="w-full flex flex-col gap-0.5 p-0.5 rounded-none border border-emerald-500 bg-emerald-50 shadow-2xs hover:shadow-xs transition-all">
                            {/* هاتن - سەوز */}
                            <div className="bg-emerald-600 text-white text-[8px] font-black py-0.5 px-1 rounded-none flex items-center justify-between leading-none shadow-2xs">
                              <span className="font-bold opacity-90">هاتن</span>
                              <span className="font-mono font-black text-[9px] tracking-tight">{inTime}</span>
                            </div>
                            {/* ڕۆیشتن - سەوز */}
                            <div className="bg-emerald-700 text-emerald-50 text-[8px] font-black py-0.5 px-1 rounded-none flex items-center justify-between leading-none shadow-2xs">
                              <span className="font-bold opacity-90">ڕۆیشتن</span>
                              <span className="font-mono font-black text-[9px] tracking-tight">{outTime}</span>
                            </div>
                          </div>
                        ) : (
                          <div className={`w-full py-2 rounded-none text-[9px] border shadow-2xs transition-all ${badgeColor}`}>
                            {badgeText}
                          </div>
                        )}
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
                  <span>سڕینەوەی ئەم داتایە (بەتاڵکردن)</span>
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
                    <span>{isSavingModal ? 'لە پاشەکەوتکردندایە...' : '💾 پاشەکەوتکردن لە سوپابەیس'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ WINDOWS 11 SHARP MODAL: CUSTOM RANGE PRINT (SEPARATED NEW TAB) */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-xl w-full p-0 text-right font-sans">
            
            {/* Title Bar */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-xs text-white">
                  🖨️ چاپکردنی تایبەت لە تابی نوێ (Clean Google Sheets View)
                </h3>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="w-6 h-6 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs font-mono transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              {/* Range Filters Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-300">
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
                <div className="space-y-1 sm:col-span-2">
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

              <div className="p-3 bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 leading-relaxed">
                ℹ️ کاتێک کلیک لەسەر دوگمەی خوارەوە دەکەیت، پەڕەکە بە **شێوازی فەرمی Google Sheets لە پەنجەرەیەکی تەواو جیاواز (Separated New Tab)** دەکرێتەوە بە بێ هیچ دوگمە و شتێکی زیادە بۆ ئەوەی چاپەکە لەسەر کاغەز زۆر خاوێن بێت.
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

                <button
                  type="button"
                  onClick={handleOpenCleanPrintNewTab}
                  className="px-6 py-2.5 rounded-none bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-black flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>🖨️ کردنەوە لە تابی نوێ و چاپکردن</span>
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
