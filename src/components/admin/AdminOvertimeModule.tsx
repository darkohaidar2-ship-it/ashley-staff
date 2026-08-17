'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToPDF, exportToCSV, formatTime12H, type ExportTableColumn } from '@/lib/export-utils';

interface AdminOvertimeModuleProps {
  employees: Employee[];
}

export function AdminOvertimeModule({ employees }: AdminOvertimeModuleProps) {
  const { overtime, setOvertime, attendanceLogs } = useAppContext();
  
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Shift and Rate Settings
  const [shiftEndTime, setShiftEndTime] = useState('17:00');
  const [hourlyRate, setHourlyRate] = useState<number>(5000);

  // Admin Notes stored in localStorage
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');

  useEffect(() => {
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
  }, [selectedMonth]);

  const handleSaveNote = (key: string) => {
    const updated = { ...adminNotes, [key]: tempNoteText.trim() };
    setAdminNotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updated));
    }
    setEditingNoteKey(null);
  };

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

  // Generate combined overtime records dynamically from Attendance Logs + Manual Entries
  const allOvertimeRecords = useMemo(() => {
    const records: Array<{
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
      source: 'attendance' | 'manual';
    }> = [];

    // 1. Process Attendance Logs
    // Group logs by date and employee
    const dateEmpGroups: Record<string, typeof attendanceLogs> = {};
    (attendanceLogs || []).forEach(log => {
      const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
      if (!logDate) return;

      const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
      const logName = (log.name || log.userName || (log as any).employeeName || '').toString().trim().toLowerCase();

      // Find matching employee
      const matchedEmp = activeEmployees.find(emp => {
        const targetEmpId = (emp.id || '').toString().trim().toLowerCase();
        const empCode = emp.employeeId ? `emp-${emp.employeeId}`.toLowerCase() : '';
        const empName1 = (emp.fullName3Part || '').toString().trim().toLowerCase();
        const empName2 = (emp.name || '').toString().trim().toLowerCase();

        return (
          (logEmpId && logEmpId === targetEmpId) ||
          (empCode && logEmpId === empCode) ||
          (logName && empName1 && (logName === empName1 || logName.includes(empName1) || empName1.includes(logName))) ||
          (logName && empName2 && (logName === empName2 || logName.includes(empName2) || empName2.includes(logName)))
        );
      });

      if (matchedEmp) {
        const groupKey = `${matchedEmp.id}_${logDate}`;
        if (!dateEmpGroups[groupKey]) dateEmpGroups[groupKey] = [];
        dateEmpGroups[groupKey].push(log);
      }
    });

    // Check each employee-date group for overtime after shiftEnd
    Object.entries(dateEmpGroups).forEach(([groupKey, logs]) => {
      const [empId, dateStr] = groupKey.split('_');
      const emp = activeEmployees.find(e => e.id === empId);
      if (!emp) return;

      const checkInLog = logs.find(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('in') || t.includes('هاتن') || !!(l as any).checkInTime;
      });
      const checkOutLog = logs.find(l => {
        const t = (l.type || '').toLowerCase();
        return t.includes('out') || t.includes('دەرچوون') || t.includes('ڕۆشتن') || !!(l as any).checkOutTime;
      });

      const checkInTimeStr = checkInLog?.time 
        ? (checkInLog.time.includes(' ') ? checkInLog.time.split(' ')[1]?.slice(0, 5) : checkInLog.time.slice(0, 5))
        : (checkInLog as any)?.checkInTime?.slice(0, 5) || null;

      const checkOutTimeStr = checkOutLog?.time 
        ? (checkOutLog.time.includes(' ') ? checkOutLog.time.split(' ')[1]?.slice(0, 5) : checkOutLog.time.slice(0, 5))
        : (checkOutLog as any)?.checkOutTime?.slice(0, 5) || null;

      if (checkOutTimeStr) {
        const checkOutMins = timeToMinutes(checkOutTimeStr);
        if (checkOutMins > shiftEndMins) {
          const overtimeMins = checkOutMins - shiftEndMins;
          const otHours = Math.round((overtimeMins / 60) * 10) / 10;
          const noteKey = `${emp.id}_${dateStr}`;
          const savedNote = adminNotes[noteKey] || (logs[0] as any)?.notes || '';

          records.push({
            id: `att_${emp.id}_${dateStr}`,
            employeeId: emp.id,
            employeeName: emp.fullName3Part || emp.name || 'کارمەند',
            employeeRole: emp.role || 'کارمەند',
            date: dateStr,
            checkInTime: checkInTimeStr,
            checkOutTime: checkOutTimeStr,
            hours: otHours,
            rate: hourlyRate,
            totalAmount: Math.round(otHours * hourlyRate),
            note: savedNote,
            source: 'attendance',
          });
        }
      }
    });

    // 2. Process Manual Overtime Entries
    (overtime || []).forEach((r: any) => {
      if (!r.date) return;
      const emp = employees.find(e => e.id === (r.employeeId || r.userId));
      
      // Avoid exact duplicate if already captured by attendance
      const alreadyCaptured = records.some(rec => rec.employeeId === (r.employeeId || r.userId) && rec.date === r.date);
      if (!alreadyCaptured) {
        const hoursNum = parseFloat(r.hours || 0);
        const rateNum = parseFloat(r.rate || hourlyRate);
        records.push({
          id: r.id || `manual_${Date.now()}_${Math.random()}`,
          employeeId: r.employeeId || r.userId || 'manual',
          employeeName: r.employeeName || emp?.fullName3Part || emp?.name || 'کارمەند',
          employeeRole: emp?.role || 'کارمەند',
          date: r.date,
          hours: hoursNum,
          rate: rateNum,
          totalAmount: Number(r.totalAmount || (hoursNum * rateNum)),
          note: r.note || r.notes || '',
          source: 'manual',
        });
      }
    });

    return records.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceLogs, activeEmployees, overtime, shiftEndMins, hourlyRate, adminNotes, employees]);

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
      count: number; 
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
          count: 0, 
          records: [] 
        };
      }
      summaryMap[id].totalHours += Number(r.hours || 0);
      summaryMap[id].totalAmount += Number(r.totalAmount || 0);
      summaryMap[id].count += 1;
      summaryMap[id].records.push(r);
    });

    // Filter to ONLY employees with overtime > 0
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
    setManualHours('');
    setManualNote('');
    alert(`🎉 کاتی زیادە (${parsedHours} کاتژمێر) بۆ (${newRecord.employeeName}) تۆمارکرا!`);
  };

  const handleDelete = (id: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کاتە زیادەیە؟')) {
      setOvertime((prev: any) => (prev || []).filter((r: any) => r.id !== id));
    }
  };

  // PDF & CSV Export Handlers
  const handleExportPDF = () => {
    if (viewMode === 'daily') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' },
        { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
        { header: 'کاتی دەرچوون', key: 'checkOutTime', align: 'center' },
        { header: 'ژمارەی کاتژمێر', key: 'hours', align: 'center' },
        { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی / هۆکار و وردەکاری', key: 'note', align: 'right' },
      ];
      const data = dailyRecords.map(r => ({
        name: r.employeeName,
        role: r.employeeRole,
        checkOutTime: formatTime12H(r.checkOutTime),
        hours: `${r.hours} کاتژمێر`,
        amount: `${r.totalAmount.toLocaleString()} IQD`,
        note: r.note || '-',
      }));
      exportToPDF({
        title: 'ڕاپۆرتی کاتی زیادەی ڕۆژانەی کارمەندان (Daily Overtime Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی - پەیوەستکراو بە ئامادەبوون',
        period: selectedDate,
        columns: cols,
        data,
        fileName: `Ashley_Daily_Overtime_${selectedDate}`,
        summaryCards: [
          { label: 'کۆی کارمەندانی خاوەن ئیزافە', value: `${dailyRecords.length} کارمەند`, color: '#1e40af' },
          { label: 'کۆی کاتژمێری ئیزافە', value: `${totalDailyHours.toFixed(1)} کاتژمێر`, color: '#047857' },
          { label: 'کۆی گشتی پارەی شایستە', value: `${totalDailyCost.toLocaleString()} IQD`, color: '#065f46' },
        ],
      });
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' },
        { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
        { header: 'ژمارەی ڕۆژەکان', key: 'count', align: 'center' },
        { header: 'کۆی کاتژمێری ئیزافە', key: 'hours', align: 'center' },
        { header: 'کۆی گشتی پارە (IQD)', key: 'amount', align: 'center' },
      ];
      const data = monthlySummary.map(s => ({
        name: s.name,
        role: s.role,
        count: `${s.count} ڕۆژ`,
        hours: `${s.totalHours.toFixed(1)} کاتژمێر`,
        amount: `${s.totalAmount.toLocaleString()} IQD`,
      }));
      exportToPDF({
        title: 'ڕاپۆرتی ئاماری مانگانەی کاتی زیادەی کارمەندان (Monthly Overtime Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی - تەنها کارمەندانی خاوەن ئیزافە',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Monthly_Overtime_${selectedMonth}`,
        summaryCards: [
          { label: 'کارمەندانی خاوەن ئیزافە', value: `${monthlySummary.length} کارمەند`, color: '#1e40af' },
          { label: 'کۆی کاتژمێری مانگ', value: `${totalMonthlyHours.toFixed(1)} کاتژمێر`, color: '#047857' },
          { label: 'کۆی گشتی پارەی ئیزافە', value: `${totalMonthlyCost.toLocaleString()} IQD`, color: '#065f46' },
        ],
      });
    }
  };

  const handleExportCSV = () => {
    if (viewMode === 'daily') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'name' },
        { header: 'پۆست', key: 'role' },
        { header: 'کاتی دەرچوون', key: 'checkOutTime' },
        { header: 'ژمارەی کاتژمێر', key: 'hours' },
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
        { header: 'ژمارەی ڕۆژەکان', key: 'count' },
        { header: 'کۆی کاتژمێر', key: 'hours' },
        { header: 'کۆی پارە (IQD)', key: 'amount' },
      ];
      const data = monthlySummary.map(s => ({
        name: s.name,
        role: s.role,
        count: s.count,
        hours: s.totalHours.toFixed(1),
        amount: s.totalAmount,
      }));
      exportToCSV(cols, data, `Ashley_Monthly_Overtime_${selectedMonth}`);
    }
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE (ACTIVE & SYNCED) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-gradient-to-r from-orange-950 via-amber-950 to-slate-950 text-white rounded-xl shadow-lg border border-orange-700">
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
            <p className="text-[11px] text-orange-200/90 font-medium mt-0.5">
              ئاماری ڕۆژانە و مانگانەی کاتی زیادەی کارمەندان، هەژمارکراو لە چێک‌ئاوت و تۆماری دەستی، حازر بۆ چاپکردن (PDF/CSV)
            </p>
          </div>
        </div>

        {/* ⚙️ DYNAMIC SHIFT & RATE SETTINGS */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/90 p-2 px-3 rounded-xl border border-slate-700 shadow-inner">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-slate-300 font-bold">کۆتایی دەوام:</span>
            <input
              type="time"
              value={shiftEndTime}
              onChange={(e) => setShiftEndTime(e.target.value)}
              className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs font-mono font-bold text-center"
            />
          </div>

          <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300 font-bold">نرخی کاتژمێر:</span>
            <input
              type="number"
              step="500"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseInt(e.target.value, 10) || 5000)}
              className="bg-slate-950 border border-slate-600 rounded px-2 py-1 text-white text-xs font-mono font-bold w-20 text-center"
            />
            <span className="text-[11px] text-slate-400">IQD</span>
          </div>
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
            <span>📅 تۆمار و ئاماری ڕۆژانە (Daily List)</span>
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
            <span>📊 ئاماری مانگانەی کاتی زیادە (تەنها خاوەن ئیزافەکان)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="text-slate-600 text-xs font-bold">دیاریکردنی کات:</span>
          {viewMode === 'daily' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-classic font-bold bg-white"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-classic font-bold bg-white"
            />
          )}

          <button
            onClick={handleExportPDF}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-900 border-red-300 shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-red-700" />
            <span>📄 هەناردەی PDF (چاپکردن)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>📊 هەناردەی CSV (Excel)</span>
          </button>
        </div>
      </div>

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
          <span className="text-[10px] text-purple-900 block font-bold">سەرچاوەی داتاکان</span>
          <p className="text-xs font-black text-purple-950 mt-1">
            ⚡ ئۆتۆماتیک لە چێک‌ئاوت + دەستی
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
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">تێبینی و هۆکار (Notes):</label>
            <input
              type="text"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="ئەرکی زیادە، داگرتنی بار، چاککردنەوە..."
              className="input-classic w-full font-bold bg-white border-amber-300"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-classic text-xs font-black flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white border-amber-900 shadow-sm cursor-pointer px-4 py-1 rounded">
            <Plus className="w-3.5 h-3.5" />
            <span>تۆمارکردنی ئیزافە</span>
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
                : `ئاماری مانگانەی کاتی زیادە (${selectedMonth}) - تەنها کارمەندانی خاوەن ئیزافە`}
            </span>
          </h3>
          <span className="text-[10px] font-mono text-slate-300">
            {viewMode === 'daily' ? `${dailyRecords.length} کارمەند` : `${monthlySummary.length} کارمەند`}
          </span>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'daily' ? (
            /* 📅 DAILY OVERTIME TABLE WITH NOTES & DETAILS */
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300">پۆست / ئەرک</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کاتی دەرچوون</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">ژمارەی کاتژمێر</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">بڕی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 border-l border-slate-300 bg-amber-50 text-amber-950">تێبینی و وردەکاری</th>
                  <th className="p-2.5 border-l border-slate-300 text-center w-24">سەرچاوە</th>
                  <th className="p-2.5 text-center w-16">کردار</th>
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
                            {rec.source === 'manual' ? (
                              <button
                                onClick={() => handleDelete(rec.id)}
                                className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                                title="سڕینەوە"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
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
                        ({dailyRecords.length} کارمەندی بەشداربوو)
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            /* 📊 MONTHLY OVERTIME SUMMARY TABLE (ONLY EMPLOYEES WITH OVERTIME) */
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300">پۆست / ئەرک</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">ژمارەی ڕۆژەکانی ئیزافە</th>
                  <th className="p-2.5 border-l border-slate-300 text-center bg-amber-50 text-amber-950">کۆی کاتژمێری ئیزافە</th>
                  <th className="p-2.5 border-l border-slate-300 text-center bg-emerald-50 text-emerald-950">کۆی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 text-center w-36">وردەکاری ڕۆژەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {monthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
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
                            <td className="p-2.5 border-l border-slate-200 text-center font-mono">{sum.count} ڕۆژ</td>
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
                              <td colSpan={7} className="p-3">
                                <div className="bg-white border border-orange-200 rounded-lg p-3 shadow-inner space-y-2">
                                  <h4 className="text-[11px] font-black text-orange-950 flex items-center gap-1.5 border-b border-orange-100 pb-1">
                                    <span>📅 وردەکاری ڕۆژانی ئیزافەی ({sum.name}) بۆ مانگی ({selectedMonth}):</span>
                                  </h4>
                                  <table className="w-full text-right text-xs border border-slate-200">
                                    <thead>
                                      <tr className="bg-slate-100 text-slate-800 font-black text-[11px]">
                                        <th className="p-1.5 border-l border-slate-200 text-center">بەروار</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">دەرچوون</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">کاتژمێر</th>
                                        <th className="p-1.5 border-l border-slate-200 text-center">کۆی پارە</th>
                                        <th className="p-1.5 border-l border-slate-200">تێبینی و هۆکار</th>
                                        <th className="p-1.5 text-center w-20">سەرچاوە</th>
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
                                          <td className="p-1.5 text-center text-[10px]">
                                            {r.source === 'attendance' ? '⚡ سیستەم' : '✍️ دەستی'}
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
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono">
                        {monthlySummary.length} کارمەند
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-blue-950 bg-amber-100/50">
                        +{totalMonthlyHours.toFixed(1)} کاتژمێر
                      </td>
                      <td className="p-2.5 border-l border-slate-300 text-center font-mono text-emerald-950 bg-emerald-100/50">
                        +{totalMonthlyCost.toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 text-center text-slate-500 font-normal">
                        تەواو
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
