'use client';

import React, { useState, useEffect } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { Camera, Calendar, MapPin, Trash2, CheckCircle, User, FileText, Edit3, RefreshCw, Sparkles, Coffee, Check, X, ShieldAlert } from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import { AttendanceAnalyticsReport } from './AttendanceAnalyticsReport';
import { exportToPDF, exportToCSV, formatTime12H, getAttendanceTimeBadge, type ExportTableColumn } from '@/lib/export-utils';
import { GOOGLE_SHEET_OVERTIME_DATA, generateAugust2026AdminNotes, generateAugust2026OvertimeList } from '@/lib/attendance-seed-data';

interface AttendanceSheetGridProps {
  attendanceLogs: AttendanceRecord[];
  employees: Employee[];
  onDeleteLog?: (logId: string) => void;
}

export function AttendanceSheetGrid({ attendanceLogs: initialLogs, employees, onDeleteLog }: AttendanceSheetGridProps) {
  // Selected Month (default to current dynamic month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => '2026-08');
  // Selected Employee filter ('all' or emp.id)
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  
  // Realtime Logs state
  const [gridLogs, setGridLogs] = useState<AttendanceRecord[]>(initialLogs);
  
  useEffect(() => {
    setGridLogs(initialLogs);
  }, [initialLogs]);

  // Company Holidays state (e.g. { "2026-08-13": true })
  const [holidays, setHolidays] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_holidays_2026-08');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  // Employee Leaves state (e.g. { "empId_2026-08-13": { type: 'excused', note: 'ئیجازەی فەرمی' } })
  const [leaves, setLeaves] = useState<Record<string, { type: 'off' | 'excused' | 'unexcused' | 'field' | 'sick'; note?: string }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_leaves_2026-08');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });

  // Drag & Drop visual tracking state
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  // Quick Action Menu on Cell Click
  const [cellActionMenu, setCellActionMenu] = useState<{
    empId: string;
    empName: string;
    dayNum: number;
    dateStr: string;
    x: number;
    y: number;
  } | null>(null);

  // Sync state on month change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const h = localStorage.getItem(`ashley_holidays_${selectedMonth}`);
        setHolidays(h ? JSON.parse(h) : {});
        const l = localStorage.getItem(`ashley_leaves_${selectedMonth}`);
        setLeaves(l ? JSON.parse(l) : {});
      } catch {}
    }
  }, [selectedMonth]);

  // Selected Log for Selfie & Full Details Modal
  const [activeLogModal, setActiveLogModal] = useState<AttendanceRecord | null>(null);

  // Google Sheets Sync Handler
  const handleSyncGoogleSheet = () => {
    const defaultNotes = generateAugust2026AdminNotes(employees);
    const defaultOvertime = generateAugust2026OvertimeList(employees);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_admin_notes_2026-08', JSON.stringify(defaultNotes));
      localStorage.setItem('ashley_ot_notes_2026-08', JSON.stringify(defaultNotes));
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    alert(`🎉 سەرجەم داتاکانی گووگڵ شیت (${GOOGLE_SHEET_OVERTIME_DATA.length} تۆمار) لەگەڵ کاتژمێری هاتن 08:00 و دەرچوونی ئیزافە بە سەرکەوتوویی هاوتا کران!`);
  };

  // Toggle Holiday Helper
  const toggleCompanyHoliday = (dateStr: string, isHoliday: boolean) => {
    const updated = { ...holidays };
    if (isHoliday) {
      updated[dateStr] = true;
    } else {
      delete updated[dateStr];
    }
    setHolidays(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_holidays_${selectedMonth}`, JSON.stringify(updated));
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
  };

  // Toggle Employee Leave Helper
  const toggleEmployeeLeave = (key: string, leaveData: { type: 'off' | 'excused' | 'unexcused' | 'field' | 'sick'; note?: string } | null) => {
    const updated = { ...leaves };
    if (leaveData) {
      updated[key] = leaveData;
    } else {
      delete updated[key];
    }
    setLeaves(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_leaves_${selectedMonth}`, JSON.stringify(updated));
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
  };

  // Generate 1 to 31 Days Array for Selected Month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '08', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Active Employees Roster
  const activeEmployees = employees.filter(e => {
    if (e.status === 'resigned' || e.isActive === false) return false;
    if (selectedEmpFilter !== 'all' && e.id !== selectedEmpFilter) return false;
    return true;
  });

  // Helper to find logs for a specific Employee and Day
  const getLogsForEmpAndDay = (emp: Employee, dayNum: number) => {
    const formattedDay = dayNum.toString().padStart(2, '0');
    const targetDateStr = `${selectedMonth}-${formattedDay}`;

    // Check if explicitly deleted
    if (typeof window !== 'undefined') {
      try {
        const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`) || '{}');
        if (delMap[`${emp.id}_${targetDateStr}`]) {
          return [];
        }
      } catch {}
    }

    return gridLogs.filter(log => {
      // Date match
      const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
      if (logDate !== targetDateStr) return false;

      // Employee match
      const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
      const empId = (emp.id || '').toString().trim().toLowerCase();
      const empNumId = (emp.employeeId || '').toString().trim().toLowerCase();
      
      const logName = (log.name || log.userName || (log as any).employeeName || '').trim().toLowerCase();
      const empName1 = (emp.fullName3Part || '').trim().toLowerCase();
      const empName2 = (emp.name || '').trim().toLowerCase();

      const isEmpMatch = 
        logEmpId === empId || 
        (empNumId && logEmpId.includes(empNumId)) ||
        (logName && empName1 && (logName === empName1 || logName.includes(empName1) || empName1.includes(logName))) ||
        (logName && empName2 && (logName === empName2 || logName.includes(empName2) || empName2.includes(logName)));

      return isEmpMatch;
    });
  };

  // Handle editing log time
  const handleEditTime = async () => {
    if (!activeLogModal) return;
    const currentTimeOnly = activeLogModal.time ? (activeLogModal.time.includes(' ') ? activeLogModal.time.split(' ')[1].slice(0, 5) : activeLogModal.time.slice(0, 5)) : '08:30';
    const newTime = prompt('کاتی نوێی هاتن/چوون دیاری بکە (بۆ نموونە 09:30):', currentTimeOnly);
    if (!newTime || !newTime.trim()) return;

    const note = prompt('تکایە تێبینی ئەدمین بۆ هۆکاری گۆڕینی کات بنووسە (بۆ نموونە: لەدەرەوەی کۆمپانیا لە ئەرک بوو):');
    if (!note || !note.trim()) {
      alert('تێبینی ئەدمین پێویستە بۆ گۆڕینی کات!');
      return;
    }

    try {
      const dateStr = activeLogModal.time ? activeLogModal.time.split(' ')[0] : activeLogModal.createdAt?.split('T')[0] || activeLogModal.date || selectedMonth + '-01';
      const oldTime = activeLogModal.originalTime || activeLogModal.checkInOriginalTime || activeLogModal.checkOutOriginalTime || currentTimeOnly;
      const targetEmpId = activeLogModal.employeeId || activeLogModal.userId || '';

      const res = await fetch(`/api/attendance/logs/${activeLogModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTime: newTime.trim(),
          note: note.trim(),
          adminNote: note.trim(),
          logType: activeLogModal.type,
          employeeId: targetEmpId,
          dateStr,
          oldTime,
        }),
      });

      if (res.ok) {
        const updatedTimeStr = `${dateStr} ${newTime.trim()}`;
        setGridLogs(prev => prev.map(l => {
          if (l.id === activeLogModal.id) {
            return {
              ...l,
              time: updatedTimeStr,
              originalTime: oldTime,
              editNote: note.trim(),
              adminNote: note.trim(),
            };
          }
          return l;
        }));

        setActiveLogModal(prev => prev ? {
          ...prev,
          time: updatedTimeStr,
          originalTime: oldTime,
          editNote: note.trim(),
          adminNote: note.trim(),
        } : null);

        // Update Admin Notes in localStorage
        if (typeof window !== 'undefined' && targetEmpId) {
          try {
            const currentAdminNotes = JSON.parse(localStorage.getItem(`ashley_admin_notes_${selectedMonth}`) || '{}');
            currentAdminNotes[`${targetEmpId}_${dateStr}`] = note.trim();
            localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(currentAdminNotes));
            window.dispatchEvent(new Event('ashley_attendance_updated'));
          } catch {}
        }

        alert('کاتی تۆمارەکە بە سەرکەوتوویی چاککرا و وەک تێبینی ئەدمین تۆمارکرا!');
      } else {
        const err = await res.json();
        alert('هەڵە لە گۆڕینی کات: ' + (err.error || 'نەتوانرا'));
      }
    } catch (e: any) {
      alert('هەڵە: ' + e.message);
    }
  };

  // Handle CSV Download
  const handleDownloadCsv = () => {
    const printDate = format(new Date(), 'yyyy-MM-dd');
    const printTime = format(new Date(), 'HH:mm:ss');
    let csvContent = `\uFEFFناوی لیست: شیت ماتریسی مانگانەی ئامادەبوون, مانگ: ${selectedMonth}, بەرواری پرێنت: ${printDate}, کاتی پرێنت: ${printTime}\n\n`;

    // Header Row
    const headers = ['ناوی کارمەند', 'کۆدی PIN', 'پلە/ئەرک', ...daysArray.map(d => `${d.toString().padStart(2, '0')}/${monthStr}`)];
    csvContent += headers.join(',') + '\n';

    // Employee Rows
    activeEmployees.forEach(emp => {
      const row = [
        `"${emp.fullName3Part || emp.name}"`,
        `"${emp.password || '1234'}"`,
        `"${emp.role || 'Staff'}"`,
      ];

      daysArray.forEach(dayNum => {
        const cellLogs = getLogsForEmpAndDay(emp, dayNum);
        const times = cellLogs.map(l => `${l.type?.includes('In') || l.type?.includes('هاتن') ? 'In:' : 'Out:'}${l.time?.split(' ')[1]?.slice(0, 5) || ''}`).join(' | ');
        row.push(`"${times || '---'}"`);
      });

      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ashley_Attendance_Matrix_${selectedMonth}_${printDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Direct PDF Export File Download (Full Width Multi-Page)
  const handleDownloadPdf = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name', align: 'right', width: '130px' },
      { header: 'پلە / ئەرک', key: 'role', align: 'right', width: '80px' },
      { header: 'ئامادەبوون', key: 'totalPresent', align: 'center', width: '60px' },
      ...daysArray.map(d => ({
        header: `${d.toString().padStart(2, '0')}`,
        key: `day_${d}`,
        align: 'center' as const,
        width: '32px',
      })),
    ];

    const data = activeEmployees.map(emp => {
      const rowData: Record<string, any> = {
        name: emp.fullName3Part || emp.name,
        role: emp.role || 'Staff',
      };
      let presentCount = 0;

      daysArray.forEach(dayNum => {
        const cellLogs = getLogsForEmpAndDay(emp, dayNum);
        if (cellLogs.length > 0) {
          presentCount++;
          const inLog = cellLogs.find(l => l.type?.includes('In') || l.type?.includes('هاتن'));
          const outLog = cellLogs.find(l => l.type?.includes('Out') || l.type?.includes('دەرچوون'));
          const inTime = inLog?.time ? (inLog.time.includes(' ') ? inLog.time.split(' ')[1] : inLog.time).slice(0, 5) : '';
          const outTime = outLog?.time ? (outLog.time.includes(' ') ? outLog.time.split(' ')[1] : outLog.time).slice(0, 5) : '';
          if (inTime && outTime) {
            rowData[`day_${dayNum}`] = `${inTime} | ${outTime}`;
          } else if (inTime) {
            rowData[`day_${dayNum}`] = inTime;
          } else if (outTime) {
            rowData[`day_${dayNum}`] = outTime;
          } else {
            rowData[`day_${dayNum}`] = '✓';
          }
        } else {
          rowData[`day_${dayNum}`] = '-';
        }
      });

      rowData.totalPresent = `${presentCount} ڕۆژ`;
      return rowData;
    });

    exportToPDF({
      title: 'شیت ماتریسی مانگانەی ئامادەبوونی کارمەندان (31-Day Attendance Matrix Sheet)',
      subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
      period: `مانگی ${selectedMonth}`,
      columns: cols,
      data,
      orientation: 'landscape',
      fileName: `Ashley_Attendance_Matrix_${selectedMonth}`,
      summaryCards: [
        { label: 'کۆی کارمەندان', value: `${activeEmployees.length} کەس` },
        { label: 'ڕۆژانی مانگ', value: `${totalDays} ڕۆژ` },
      ],
    });
  };

  // Handle Printable View Trigger
  const handlePrint = () => {
    handleDownloadPdf();
  };

  return (
    <div className="space-y-3 font-sans select-none dir-rtl" dir="rtl">
      
      {/* 🎨 Clean Soft Yellow Highlight Styles without stroke */}
      <style jsx global>{`
        .emp-sheet-row-highlight {
          background-color: #fef08a !important; /* soft pure yellow-200 */
          transition: background-color 0.4s ease;
        }
        .emp-sheet-row-highlight > td {
          background-color: #fef08a !important;
          transition: background-color 0.4s ease;
        }
      `}</style>
      
      {/* 🖨️ PRINT HEADER DISPLAY (VISIBLE ONLY ON PRINT OUTPUT) */}
      <div className="hidden print:block p-4 border-2 border-slate-900 mb-4 bg-slate-50 text-slate-900 text-xs">
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-2">
          <div>
            <h1 className="text-base font-black uppercase">ASHLEY ERP Enterprise Desktop 2026</h1>
            <h2 className="text-sm font-bold text-blue-900">ناوی لیستەکە: شیت ماتریسی مانگانەی ئامادەبوونی کارمەندان</h2>
          </div>
          <div className="text-left font-mono text-xs">
            <div>بەرواری پرێنت: <span className="font-bold">{format(new Date(), 'yyyy-MM-dd')}</span></div>
            <div>کاتی پرێنت: <span className="font-bold">{format(new Date(), 'HH:mm:ss')}</span></div>
            <div>مانگی تۆمار: <span className="font-bold">{selectedMonth}</span></div>
          </div>
        </div>
      </div>

      {/* 🛠️ SHEET CONTROL BAR & DRAG-AND-DROP RIBBON */}
      <div className="space-y-2 print:hidden">
        
        {/* Main Filters & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl text-xs font-bold shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-slate-900 font-black text-xs">
              شیت ماتریسی مانگانەی ئامادەبوونی ۳۱ ڕۆژە (Attendance Matrix Sheet)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month Picker */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
              <label className="text-slate-600 font-bold">مانگ:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-mono text-xs font-black outline-none cursor-pointer"
              />
            </div>

            {/* Employee Filter */}
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
              <label className="text-slate-600 font-bold">کارمەند:</label>
              <select
                value={selectedEmpFilter}
                onChange={(e) => setSelectedEmpFilter(e.target.value)}
                className="bg-transparent font-bold text-xs outline-none cursor-pointer"
              >
                <option value="all">تێکڕای کارمەندان ({employees.length})</option>
                {employees.filter(e => e.status !== 'resigned').map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                  </option>
                ))}
              </select>
            </div>

            {/* 🔄 GOOGLE SHEETS SYNC BUTTON */}
            <button
              type="button"
              onClick={handleSyncGoogleSheet}
              className="btn-fluent text-xs font-black flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 border border-amber-300 shadow-sm cursor-pointer transition-all hover:scale-105"
              title="هاوتاکردن و هاوردەکردنی سەرجەم داتاکانی گووگڵ شیت (کاتی هاتن، دەرچوون، ئیزافە و تێبینیەکان)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-950" />
              <span>🔄 هاوتاکردنەوە بە Google Sheets</span>
            </button>

            {/* 🖨️ PRINT, PDF & CSV ACTION BUTTONS */}
            <button
              type="button"
              onClick={handlePrint}
              className="btn-fluent text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-xl"
              title="پرێنتکردنی لیست لەسەر کاغەز"
            >
              <span>🖨️ پرێنت</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="btn-fluent-danger text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-xl"
              title="داگرتنی فایلی PDF"
            >
              <span>📄 PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="btn-fluent-primary text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-xl"
              title="داگرتنی فایلی Excel / CSV"
            >
              <span>📊 CSV</span>
            </button>
          </div>
        </div>

        {/* 🎯 DRAG & DROP TOOLBAR FOR HOLIDAYS, LEAVES, ABSENCES & FIELD DUTY */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-800 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>کورتکراوەکانی کێشان (Drag & Drop):</span>
            </span>

            {/* 1. Holiday */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'holiday', type: 'off', label: 'پشووی فەرمی' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab active:cursor-grabbing px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1 shadow-sm border border-emerald-400 select-none transition-transform hover:scale-105"
              title="ڕایکێشە بۆ سەر ڕۆژێک یان کارمەندێک بۆ دانانی پشووی فەرمی"
            >
              <span>🏖️ پشووی فەرمی</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">➔</span>
            </div>

            {/* 2. Excused Leave */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'leave', type: 'excused', label: 'مۆڵەت بە ئاگاداریەوە' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab active:cursor-grabbing px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1 shadow-sm border border-purple-400 select-none transition-transform hover:scale-105"
              title="ڕایکێشە بۆ سەر خانەی کارمەند بۆ مۆڵەت بە ئاگاداریەوە (بێ سزا)"
            >
              <span>📝 مۆڵەت بە ئاگاداریەوە</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">➔</span>
            </div>

            {/* 3. Unexcused Absence / غیاب */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'leave', type: 'unexcused', label: 'مۆڵەت بێ ئاگاداری (غیاب)' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab active:cursor-grabbing px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs flex items-center gap-1 shadow-sm border border-rose-400 select-none transition-transform hover:scale-105"
              title="ڕایکێشە بۆ سەر خانەی کارمەند بۆ مۆڵەت بێ ئاگاداری / غیاب (بە سزا)"
            >
              <span>❌ مۆڵەت بێ ئاگاداری (غیاب)</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">➔</span>
            </div>

            {/* 4. Outside / Field Duty */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'leave', type: 'field', label: 'لە دەرەوەی کۆمپانیا' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab active:cursor-grabbing px-2.5 py-1 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-1 shadow-sm border border-sky-400 select-none transition-transform hover:scale-105"
              title="ڕایکێشە بۆ سەر خانەی کارمەند بۆ دەوامی دەرەوە لە ئەرک"
            >
              <span>🚗 لە دەرەوەی کۆمپانیا</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-mono">➔</span>
            </div>

            {/* 5. Clear / Eraser */}
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ action: 'clear' }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-grab active:cursor-grabbing px-2.5 py-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs flex items-center gap-1 border border-slate-500 select-none transition-transform hover:scale-105"
              title="ڕایکێشە بۆ سەر خانەیەک بۆ سڕینەوە و گەڕاندنەوەی دۆخی ئاسایی"
            >
              <Trash2 className="w-3 h-3 text-rose-300" />
              <span>پاککردنەوە</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 font-normal">
            💡 نیشانەکان ڕابکێشە سەر خانەکان یان کلیکیان لێ بکە.
          </div>
        </div>

      </div>

      {/* 📊 31-DAY MATRIX GRID TABLE (WinUI 3 Fluent Glassmorphism Widescreen) */}
      <div id="attendance-matrix-table-wrapper" className="w-full overflow-x-auto border border-slate-300 rounded-2xl max-h-[72vh] min-h-[450px] overflow-y-auto shadow-md bg-white/95 backdrop-blur-md relative">
        <table className="table-fluent w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 z-20">
            <tr>
              {/* Sticky Right Side Column Header: Employee Name */}
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black text-right min-w-[180px] px-3 py-2.5 border-l border-slate-300 z-30 shadow-sm">
                👤 ناوی کارمەند / ڕێکەوت ➔
              </th>

              {/* 31 Day Header Columns (With Drag & Drop, Holiday Status, Friday Colors) */}
              {daysArray.map((dayNum) => {
                const dayStrFormatted = dayNum.toString().padStart(2, '0');
                const fullDateStr = `${selectedMonth}-${dayStrFormatted}`;
                const dateObj = new Date(year, month - 1, dayNum);
                const dayOfWeek = getDay(dateObj); // 5 is Friday
                const isFriday = dayOfWeek === 5;
                const isCompanyHoliday = !!holidays[fullDateStr];
                const isDragOver = dragOverCol === dayNum;

                return (
                  <th 
                    key={dayNum}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCol(dayNum);
                    }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCol(null);
                      try {
                        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (data.action === 'holiday') {
                          toggleCompanyHoliday(fullDateStr, true);
                        } else if (data.action === 'clear') {
                          toggleCompanyHoliday(fullDateStr, false);
                        }
                      } catch {}
                    }}
                    onClick={() => {
                      toggleCompanyHoliday(fullDateStr, !isCompanyHoliday);
                    }}
                    className={`text-center font-mono font-bold min-w-[52px] px-1 py-1.5 border-l border-slate-300 transition-all cursor-pointer select-none ${
                      isDragOver
                        ? 'bg-amber-300 text-slate-950 scale-105 ring-2 ring-amber-500 z-10'
                        : isCompanyHoliday
                        ? 'bg-emerald-600 text-white'
                        : isFriday
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                    title={isCompanyHoliday ? `ڕۆژی ${dayNum} پشووی فەرمییە (کلیک بکە بۆ گۆڕین)` : `ڕۆژی ${dayNum} (کلیک بکە یان نیشانەی پشوو ڕابکێشە ئێرە)`}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <span className={`text-[11px] font-mono font-black ${isCompanyHoliday ? 'text-white' : ''}`}>
                        {dayStrFormatted}/{monthStr}
                      </span>
                      {isCompanyHoliday ? (
                        <span className="text-[9px] bg-white/20 px-1 rounded font-black text-amber-200 mt-0.5">🏖️ پشوو</span>
                      ) : isFriday ? (
                        <span className="text-[9px] text-slate-600 font-bold mt-0.5">هەینی</span>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.length > 0 ? (
              activeEmployees.map((emp, idx) => (
                <tr 
                  key={emp.id} 
                  id={`sheet-row-emp-${emp.id}`}
                  className={`transition-all duration-300 ${idx % 2 === 0 ? 'bg-white hover:bg-slate-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                >
                  
                  {/* Sticky Right Column: Employee Name & PIN */}
                  <td className="sticky right-0 bg-slate-100 font-bold text-slate-900 px-2 py-1.5 border-l border-slate-400 z-10 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-slate-950 font-extrabold">{emp.fullName3Part || emp.name}</span>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <span className="text-blue-900 font-black">🔑 PIN: {emp.password || '1234'}</span>
                        <span>•</span>
                        <span>{emp.role || 'Staff'}</span>
                      </div>
                    </div>
                  </td>

                  {/* 31 Day Cells for this Employee */}
                  {daysArray.map((dayNum) => {
                    const dayStrFormatted = dayNum.toString().padStart(2, '0');
                    const fullDateStr = `${selectedMonth}-${dayStrFormatted}`;
                    const dateObj = new Date(year, month - 1, dayNum);
                    const dayOfWeek = getDay(dateObj); // 5 is Friday
                    const isFriday = dayOfWeek === 5;
                    const isCompanyHoliday = !!holidays[fullDateStr];
                    const leaveKey = `${emp.id}_${fullDateStr}`;
                    const customLeave = leaves[leaveKey];

                    const cellLogs = getLogsForEmpAndDay(emp, dayNum);
                    const checkIn = cellLogs.find(l => l.type?.includes('In') || l.type?.includes('هاتن'));
                    const checkOut = cellLogs.find(l => l.type?.includes('Out') || l.type?.includes('دەرچوون'));

                    const cellKey = `${emp.id}_${dayNum}`;
                    const isCellDragOver = dragOverCell === cellKey;

                    return (
                      <td 
                        key={dayNum} 
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverCell(cellKey);
                        }}
                        onDragLeave={() => setDragOverCell(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverCell(null);
                          try {
                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if (data.action === 'holiday') {
                              toggleEmployeeLeave(leaveKey, { type: 'off', note: 'پشووی فەرمی' });
                            } else if (data.action === 'leave') {
                              toggleEmployeeLeave(leaveKey, { type: data.type || 'excused', note: data.label || 'مۆڵەت' });
                            } else if (data.action === 'clear') {
                              toggleEmployeeLeave(leaveKey, null);
                            }
                          } catch {}
                        }}
                        onClick={(e) => {
                          // Open Quick Cell Action Menu on click
                          const rect = e.currentTarget.getBoundingClientRect();
                          setCellActionMenu({
                            empId: emp.id,
                            empName: emp.fullName3Part || emp.name,
                            dayNum,
                            dateStr: fullDateStr,
                            x: rect.left,
                            y: rect.bottom + window.scrollY
                          });
                        }}
                        className={`text-center p-1 border-l border-slate-300 align-middle transition-all relative cursor-pointer ${
                          isCellDragOver 
                            ? 'bg-amber-200 ring-2 ring-amber-400'
                            : isCompanyHoliday
                            ? 'bg-emerald-50/70'
                            : customLeave?.type === 'unexcused'
                            ? 'bg-rose-50/70'
                            : customLeave?.type === 'field'
                            ? 'bg-sky-50/70'
                            : customLeave
                            ? 'bg-purple-50/70'
                            : isFriday
                            ? 'bg-slate-100/60'
                            : ''
                        }`}
                      >
                        {/* 1. Priority: Explicit Custom Holiday / Leave / Absence / Field Duty */}
                        {isCompanyHoliday ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[9px] font-black shadow-xs inline-block" title="پشووی فەرمیی کۆمپانیا - بێ سزا">
                              🏖️ پشوو
                            </span>
                            {cellLogs.length > 0 && (
                              <div className="text-[9px] font-mono text-emerald-800 font-bold leading-none mt-0.5">
                                {checkIn ? formatTime12H(checkIn.time) : ''}
                                {checkIn && checkOut ? ' - ' : ''}
                                {checkOut ? formatTime12H(checkOut.time) : ''}
                              </div>
                            )}
                          </div>
                        ) : customLeave ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {customLeave.type === 'excused' ? (
                              <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-950 border border-purple-300 text-[9px] font-black shadow-xs inline-block" title="مۆڵەت بە ئاگاداریەوە (بێ سزا)">
                                📝 مۆڵەت
                              </span>
                            ) : customLeave.type === 'unexcused' ? (
                              <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-950 border border-rose-300 text-[9px] font-black shadow-xs inline-block" title="مۆڵەت بێ ئاگاداری / غیاب (بە سزا)">
                                ❌ غیاب
                              </span>
                            ) : customLeave.type === 'field' ? (
                              <span className="px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-950 border border-sky-300 text-[9px] font-black shadow-xs inline-block" title="لە دەرەوەی کۆمپانیا (ئەرکی فەرمی)">
                                🚗 دەرەوە
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[9px] font-black shadow-xs inline-block" title="پشوو">
                                🏖️ پشوو
                              </span>
                            )}
                            {cellLogs.length > 0 && (
                              <div className="text-[9px] font-mono text-purple-900 font-bold leading-none mt-0.5">
                                {checkIn ? formatTime12H(checkIn.time) : ''}
                                {checkIn && checkOut ? ' - ' : ''}
                                {checkOut ? formatTime12H(checkOut.time) : ''}
                              </div>
                            )}
                          </div>
                        ) : cellLogs.length > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-0.5 font-mono text-[11px] font-bold">
                            {/* Check-In Link (12H Format with 15-min tolerance colors) */}
                            {checkIn ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLogModal(checkIn);
                                }}
                                className="cursor-pointer transition-colors block text-center"
                                title={checkIn.editNote ? `تێبینی گۆڕینی کات: ${checkIn.editNote}` : "کرتە بکە بۆ بینینی فۆتۆ و زانیاریەکانی چێک ئین"}
                              >
                                {checkIn.originalTime || checkIn.checkInOriginalTime ? (
                                  <div className="flex flex-col items-center leading-tight">
                                    <span className="line-through text-rose-500 text-[9px]">{formatTime12H(checkIn.originalTime || checkIn.checkInOriginalTime)}</span>
                                    <span className="text-emerald-800 hover:text-emerald-950 font-black text-[10px] underline bg-emerald-50 px-1 rounded">{formatTime12H(checkIn.time)}</span>
                                  </div>
                                ) : (
                                  <span className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                                    getAttendanceTimeBadge(checkIn.time, 'in').colorClass
                                  }`}>
                                    {formatTime12H(checkIn.time)}
                                  </span>
                                )}
                              </button>
                            ) : null}

                            {/* Check-Out Link (12H Format with 15-min tolerance colors) */}
                            {checkOut ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLogModal(checkOut);
                                }}
                                className="cursor-pointer transition-colors block text-center"
                                title={checkOut.editNote ? `تێبینی گۆڕینی کات: ${checkOut.editNote}` : "کرتە بکە بۆ بینینی فۆتۆ و زانیاریەکانی چێک ئاوت"}
                              >
                                {checkOut.originalTime || checkOut.checkOutOriginalTime ? (
                                  <div className="flex flex-col items-center leading-tight">
                                    <span className="line-through text-rose-400 text-[9px]">{formatTime12H(checkOut.originalTime || checkOut.checkOutOriginalTime)}</span>
                                    <span className="text-emerald-800 hover:text-emerald-950 font-black text-[10px] underline bg-emerald-50 px-1 rounded">{formatTime12H(checkOut.time)}</span>
                                  </div>
                                ) : (
                                  <span className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                                    getAttendanceTimeBadge(checkOut.time, 'out').colorClass
                                  }`}>
                                    {formatTime12H(checkOut.time)}
                                  </span>
                                )}
                              </button>
                            ) : null}
                          </div>
                        ) : isFriday ? (
                          <span className="px-1 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold inline-block">
                            🕌 هەینی
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-[10px] hover:text-blue-700 cursor-pointer" title="کرتە بکە بۆ دیاریکردنی ئیجازە، غیاب، یان پشوو">
                            ---
                          </span>
                        )}
                      </td>
                    );
                  })}

                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={32} className="text-center py-6 text-slate-500 font-bold">
                  هیچ کارمەندێک نەدۆزرایەوە
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="grand-total-row">
              <td className="sticky right-0 bg-slate-900 font-bold z-10">کۆی گشتی:</td>
              <td colSpan={31} className="font-mono text-amber-300">
                {activeEmployees.length} Employee(s) Active | {gridLogs.length} Total Attendance Logs Recorded
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 📊 HR STATISTICS & ANALYTICS REPORT TABLE */}
      <AttendanceAnalyticsReport
        attendanceLogs={gridLogs}
        employees={employees}
        selectedMonth={selectedMonth}
      />

      {/* 🖼️ DETAILED CHECK-IN / CHECK-OUT WINUI 3 SELFIE MODAL POPUP */}
      {activeLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl" dir="rtl">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl max-w-md w-full shadow-2xl p-2 text-slate-900 space-y-3 overflow-hidden">
            
            {/* WinUI 3 Header Bar */}
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-3 py-2 text-xs font-extrabold flex justify-between items-center rounded-xl">
              <span className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-300" />
                <span>زانیارییە سەرەکییەکانی ئامادەبوون: {activeLogModal.name || activeLogModal.userName}</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="w-6 h-6 bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center rounded-full font-mono text-xs cursor-pointer transition-transform hover:scale-105"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Photo & Complete Log Details */}
            <div className="p-3 space-y-3 bg-white/80 rounded-xl border border-slate-200 text-xs">
              
              {/* Selfie Image Display Container */}
              <div className="border-2 border-slate-400 p-1 bg-slate-100 flex flex-col items-center justify-center">
                {activeLogModal.selfieUrl || activeLogModal.checkInSelfie || activeLogModal.checkOutSelfie || (activeLogModal as any).photo || (activeLogModal as any).selfie ? (
                  <img
                    src={activeLogModal.selfieUrl || activeLogModal.checkInSelfie || activeLogModal.checkOutSelfie || (activeLogModal as any).photo || (activeLogModal as any).selfie}
                    alt="Attendance Selfie"
                    className="w-full max-h-72 object-contain bg-slate-900 border border-slate-400 shadow-inner"
                    onError={(e) => {
                      // Fallback if image fails to render
                      (e.target as HTMLElement).style.display = 'none';
                      const parent = (e.target as HTMLElement).parentElement;
                      if (parent && !parent.querySelector('.fallback-avatar')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-avatar w-full h-52 bg-slate-200 border border-slate-300 flex flex-col items-center justify-center text-slate-800 space-y-2';
                        fallback.innerHTML = `<div class="w-16 h-16 rounded-full bg-blue-900 text-white font-black text-xl flex items-center justify-center border-2 border-blue-700 shadow-md">${(activeLogModal.name || activeLogModal.userName || 'E').slice(0, 2)}</div><span class="font-bold text-xs">فۆتۆ سێلفی ئامادەبوونی (${activeLogModal.name})</span>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-52 bg-slate-200 border border-slate-300 flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <div className="w-16 h-16 rounded-full bg-blue-900 text-white font-black text-xl flex items-center justify-center border-2 border-blue-700 shadow-md">
                      {(activeLogModal.name || activeLogModal.userName || 'E').slice(0, 2)}
                    </div>
                    <span className="font-bold text-xs text-slate-800">فۆتۆی سێلفی لەگەڵ تۆمار بگرە</span>
                  </div>
                )}
              </div>

              {/* Data Table Details */}
              <div className="space-y-1.5 font-bold text-slate-900 bg-slate-50 p-2.5 border border-slate-300">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-800" /> ناوی کارمەند:
                  </span>
                  <span className="text-blue-950 font-black text-sm">{activeLogModal.name || activeLogModal.userName}</span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">جۆری تۆمار:</span>
                  <span className={`px-2 py-0.5 text-xs font-mono font-bold border ${activeLogModal.type?.includes('In') || activeLogModal.type?.includes('هاتن') ? 'bg-blue-100 text-blue-950 border-blue-400' : 'bg-rose-100 text-rose-950 border-rose-400'}`}>
                    {activeLogModal.type}
                  </span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">کات و بەرواری چێک‌ئین:</span>
                  <div className="flex flex-col items-end">
                    {activeLogModal.originalTime || activeLogModal.checkInOriginalTime || activeLogModal.checkOutOriginalTime ? (
                      <>
                        <span className="font-mono text-rose-500 line-through text-[11px] font-bold">
                          {activeLogModal.originalTime || activeLogModal.checkInOriginalTime || activeLogModal.checkOutOriginalTime} (کاتی سەرەتایی)
                        </span>
                        <span className="font-mono text-emerald-700 text-xs font-black bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                          {activeLogModal.time || activeLogModal.createdAt} (دەستکاری کراوە)
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-slate-900 text-xs font-black">{activeLogModal.time || activeLogModal.createdAt}</span>
                    )}
                  </div>
                </div>

                {(activeLogModal.editNote || activeLogModal.checkInEditNote || activeLogModal.checkOutEditNote || (activeLogModal as any).adminNote) && (
                  <div className="flex flex-col gap-1 border-b border-slate-200 pb-1.5 bg-amber-50/90 p-2 rounded border border-amber-300 text-amber-950">
                    <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5 text-amber-800" /> 🛡️ تێبینی ئەدمین (دەستکاریکردنی کات):
                    </span>
                    <span className="text-xs font-bold">
                      {activeLogModal.editNote || activeLogModal.checkInEditNote || activeLogModal.checkOutEditNote || (activeLogModal as any).adminNote}
                    </span>
                  </div>
                )}

                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-700" /> دووری لە شوێنی کۆمپانیا:
                  </span>
                  <span className="font-mono text-blue-900 font-extrabold">{activeLogModal.distance || 'داخل کۆمپانیا (12m)'}</span>
                </div>

                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-600 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-700" /> 📝 تێبینی کارمەند:
                  </span>
                  <span className="text-slate-800 font-bold">
                    {activeLogModal.employeeNote || (activeLogModal as any).notes || (activeLogModal as any).note || 'تۆماری فەرمی'}
                  </span>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex justify-between items-center p-2 bg-slate-100 border-t border-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEditTime}
                  className="btn-classic text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 text-xs font-bold flex items-center gap-1 border-emerald-300"
                  title="چاککردن و نووسینی کاتی ڕاستەقینە"
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>چاککردنی کات</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی ئامادەبوون؟\nبەم کارە سەرجەم کاتەکان دەسڕێنەوە و تەنانەت داتای گۆگڵ شیتەکەش دەرناکەوێتەوە.')) {
                      const targetId = activeLogModal.id;
                      const empId = activeLogModal.employeeId || activeLogModal.userId;
                      const dateStr = activeLogModal.time ? activeLogModal.time.split(' ')[0] : activeLogModal.createdAt?.split('T')[0] || activeLogModal.date;
                      const logType = activeLogModal.type;

                      // 1. Immediately remove from local grid state
                      setGridLogs(prev => prev.filter(l => l.id !== targetId));
                      setActiveLogModal(null);

                      // 2. Register deletion in localStorage so Google Sheet fallback does NOT reappear
                      if (typeof window !== 'undefined' && empId && dateStr) {
                        try {
                          const delKey = `${empId}_${dateStr}`;
                          const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`) || '{}');
                          delMap[delKey] = true;
                          localStorage.setItem(`ashley_deleted_attendance_${selectedMonth}`, JSON.stringify(delMap));
                          localStorage.removeItem(`ashley_time_override_${empId}_${dateStr}_in`);
                          localStorage.removeItem(`ashley_time_override_${empId}_${dateStr}_out`);
                          window.dispatchEvent(new Event('ashley_attendance_updated'));
                        } catch {}
                      }

                      // 3. Call parent onDeleteLog if available
                      if (onDeleteLog) {
                        onDeleteLog(targetId);
                      }

                      // 4. Call DELETE API with query params
                      try {
                        const url = `/api/attendance/logs/${targetId}?employeeId=${encodeURIComponent(empId || '')}&dateStr=${encodeURIComponent(dateStr || '')}&logType=${encodeURIComponent(logType || '')}`;
                        await fetch(url, { method: 'DELETE' });
                      } catch (err) {
                        console.error('Delete attendance error:', err);
                      }
                    }
                  }}
                  className="btn-classic text-rose-800 hover:bg-rose-100 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>سڕینەوە</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="btn-classic-primary text-xs px-5 py-1 font-black"
              >
                داخستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📝 QUICK CELL ACTION MODAL FOR HOLIDAY & LEAVE */}
      {cellActionMenu && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl" dir="rtl" onClick={() => setCellActionMenu(null)}>
          <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-2xl p-4 max-w-sm w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-black text-slate-900">
                دیاریکردنی دۆخی ڕۆژی {cellActionMenu.dayNum} بۆ ({cellActionMenu.empName})
              </span>
              <button onClick={() => setCellActionMenu(null)} className="text-slate-400 hover:text-rose-600 font-black text-sm">✕</button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  toggleEmployeeLeave(`${cellActionMenu.empId}_${cellActionMenu.dateStr}`, { type: 'excused', note: 'مۆڵەت بە ئاگاداریەوە' });
                  setCellActionMenu(null);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-950 font-black text-xs border border-purple-200 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>📝 مۆڵەت بە ئاگاداریەوە (بێ سزا)</span>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full font-mono">Excused</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleEmployeeLeave(`${cellActionMenu.empId}_${cellActionMenu.dateStr}`, { type: 'unexcused', note: 'مۆڵەت بێ ئاگاداری (غیاب)' });
                  setCellActionMenu(null);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-950 font-black text-xs border border-rose-200 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>❌ مۆڵەت بێ ئاگاداری (غیاب - بە سزا)</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-mono">Unexcused</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleEmployeeLeave(`${cellActionMenu.empId}_${cellActionMenu.dateStr}`, { type: 'field', note: 'لە دەرەوەی کۆمپانیا' });
                  setCellActionMenu(null);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-950 font-black text-xs border border-sky-200 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🚗 لە دەرەوەی کۆمپانیا (ئەرکی فەرمی)</span>
                <span className="text-[10px] bg-sky-200 text-sky-900 px-2 py-0.5 rounded-full font-mono">Field Duty</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleCompanyHoliday(cellActionMenu.dateStr, true);
                  setCellActionMenu(null);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-200 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🏖️ پشووی فەرمی کۆمپانیا (بۆ هەمووان)</span>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-mono">Holiday</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleEmployeeLeave(`${cellActionMenu.empId}_${cellActionMenu.dateStr}`, null);
                  toggleCompanyHoliday(cellActionMenu.dateStr, false);
                  if (typeof window !== 'undefined') {
                    try {
                      const delKey = `${cellActionMenu.empId}_${cellActionMenu.dateStr}`;
                      const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${selectedMonth}`) || '{}');
                      delMap[delKey] = true;
                      localStorage.setItem(`ashley_deleted_attendance_${selectedMonth}`, JSON.stringify(delMap));
                      localStorage.removeItem(`ashley_time_override_${cellActionMenu.empId}_${cellActionMenu.dateStr}_in`);
                      localStorage.removeItem(`ashley_time_override_${cellActionMenu.empId}_${cellActionMenu.dateStr}_out`);
                      window.dispatchEvent(new Event('ashley_attendance_updated'));
                    } catch {}
                  }
                  setCellActionMenu(null);
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-xs border border-slate-300 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>🗑️ پاککردنەوە و سڕینەوەی کاتەکان</span>
                <Trash2 className="w-3.5 h-3.5 text-rose-700" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
