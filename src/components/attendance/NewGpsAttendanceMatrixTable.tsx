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
  AlertTriangle
} from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface NewGpsAttendanceMatrixTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

export function NewGpsAttendanceMatrixTable({ employees = [], attendanceLogs = [] }: NewGpsAttendanceMatrixTableProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);

  const [excursionsMap, setExcursionsMap] = useState<{ [dateStr: string]: any[] }>({});
  const [localDecisions, setLocalDecisions] = useState<{ [key: string]: 'work' | 'deduct' }>({});
  const [savingDecisionId, setSavingDecisionId] = useState<string | null>(null);

  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '08', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const fetchMonthExcursions = useCallback(async () => {
    try {
      const datesToFetch = [
        `${selectedMonth}-25`,
        `${selectedMonth}-26`,
        `${selectedMonth}-27`,
        format(new Date(), 'yyyy-MM-dd')
      ];

      const results = await Promise.all(
        datesToFetch.map(d =>
          fetch(`/api/attendance/excursions?date=${d}`)
            .then(res => res.json())
            .then(data => ({ date: d, items: data.excursions || [] }))
            .catch(() => ({ date: d, items: [] }))
        )
      );

      const map: { [key: string]: any[] } = {};
      results.forEach(r => {
        if (r.items.length > 0) {
          map[r.date] = r.items;
        }
      });
      setExcursionsMap(map);
    } catch {}
  }, [selectedMonth]);

  useEffect(() => {
    fetchMonthExcursions();
  }, [fetchMonthExcursions, selectedMonth]);

  const handleInlineExcursionDecision = async (excId: string, dateStr: string, empId: string, decision: 'work' | 'deduct') => {
    setSavingDecisionId(excId);

    // Instant local state update for real-time UI refresh
    const decisionKey = `${dateStr}_${empId}`;
    setLocalDecisions(prev => ({
      ...prev,
      [decisionKey]: decision,
      [excId]: decision
    }));

    setExcursionsMap(prev => {
      const list = prev[dateStr] || [];
      const idx = list.findIndex(x => x.id === excId || (x.userId && (x.userId === empId || excId.includes(x.userId))));
      let updated: any[];
      if (idx >= 0) {
        updated = list.map((x, i) => i === idx ? { ...x, decision } : x);
      } else {
        updated = [...list, { id: excId, userId: empId, date: dateStr, decision }];
      }
      return { ...prev, [dateStr]: updated };
    });

    if (selectedLogDetail && selectedLogDetail.info) {
      const newWorkedMins = decision === 'work' ? 480 : Math.max(0, 480 - (selectedLogDetail.info.excursion?.durationMinutes || 35));
      const newWorkedHours = Math.round((newWorkedMins / 60) * 10) / 10;
      setSelectedLogDetail((prev: any) => ({
        ...prev,
        info: {
          ...prev.info,
          workedMinutes: newWorkedMins,
          workedHours: newWorkedHours,
          dotColor: decision === 'work' ? 'green' : 'red',
          excursion: {
            ...(prev.info.excursion || {}),
            id: excId,
            decision
          }
        }
      }));
    }

    try {
      await fetch('/api/attendance/excursion-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excursionId: excId, date: dateStr, decision, userId: empId })
      });
    } catch {} finally {
      setSavingDecisionId(null);
    }
  };

  const activeEmployees = useMemo(() => {
    return (employees || []).filter(e => {
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
  }, [employees, searchQuery]);

  const timeToMinutes = (t: string): number => {
    if (!t || !t.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const getGpsLogsForEmpAndDay = (emp: Employee, dayNum: number) => {
    const formattedDay = dayNum.toString().padStart(2, '0');
    const targetDateStr = `${selectedMonth}-${formattedDay}`;

    const empId = (emp.id || '').toString().trim().toLowerCase();
    const empNum = empId.replace('emp-', '');
    const empName = (emp.name || emp.fullName3Part || '').trim().toLowerCase();

    const dayRecords = attendanceLogs.filter(log => {
      const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
      if (logDate !== targetDateStr) return false;

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
    let warehouseName = '';
    let status = 'Present';
    let rawLog: any = null;

    dayRecords.forEach((r: any) => {
      rawLog = r;
      const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '');
      const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '');

      if (inCandidate && !checkInTime) checkInTime = inCandidate.slice(0, 5);
      if (outCandidate) checkOutTime = outCandidate.slice(0, 5);
      if (r.warehouseName || r.warehouse_name) warehouseName = r.warehouseName || r.warehouse_name;
      if (r.status) status = r.status;

      if (r.type?.includes('In') || r.type?.includes('هاتن') || r.action === 'Check In' || r.log_type?.includes('In')) {
        const t = inCandidate || r.log_time_str || (r.time ? (r.time.includes(' ') ? r.time.split(' ')[1]?.slice(0, 5) : r.time.slice(0, 5)) : '');
        if (t && !checkInTime) checkInTime = t.slice(0, 5);
      }
      if (r.type?.includes('Out') || r.type?.includes('دەرچوون') || r.action === 'Check Out' || r.log_type?.includes('Out')) {
        const t = outCandidate || r.log_time_str || (r.time ? (r.time.includes(' ') ? r.time.split(' ')[1]?.slice(0, 5) : r.time.slice(0, 5)) : '');
        if (t) checkOutTime = t.slice(0, 5);
      }
    });

    const dayExcursions = excursionsMap[targetDateStr] || [];
    const empExcursion = dayExcursions.find(x => {
      const xId = (x.userId || '').toString().toLowerCase();
      const xName = (x.userName || '').trim().toLowerCase();
      return xId === empId || xId === empNum || (xName && (xName === empName || xName.includes(empName) || empName.includes(xName)));
    });

    const hasRecord = Boolean(checkInTime || checkOutTime);
    
    let workedMinutes = 0;
    let expectedMinutes = 480;
    let dotColor: 'green' | 'orange' | 'red' | null = null;
    let dotTooltip = '';
    let finalExcursion: any = empExcursion || null;

    if (hasRecord) {
      const inMins = timeToMinutes(checkInTime || '08:00');
      const outMins = timeToMinutes(checkOutTime || '17:00');
      
      let rawDiff = Math.max(0, outMins - inMins);
      if (inMins < 12 * 60 && outMins > 13 * 60) {
        rawDiff = Math.max(0, rawDiff - 60);
      }

      workedMinutes = rawDiff;

      if (!finalExcursion && rawLog) {
        const embeddedNote = rawLog.check_out_edit_note || rawLog.check_in_edit_note || rawLog.notes || rawLog.edit_note;
        if (embeddedNote) {
          finalExcursion = {
            id: `exc-${empId}-${targetDateStr}`,
            userId: empId,
            userName: empName,
            date: targetDateStr,
            note: embeddedNote,
            durationMinutes: Math.max(20, expectedMinutes - workedMinutes),
            decision: 'pending'
          };
        }
      }

      if (!finalExcursion && workedMinutes < expectedMinutes) {
        finalExcursion = {
          id: `exc-${empId}-${targetDateStr}`,
          userId: empId,
          userName: empName,
          date: targetDateStr,
          note: 'درەنگ کەوتن یان کەمی کاتی دەوام',
          durationMinutes: expectedMinutes - workedMinutes,
          decision: 'pending'
        };
      }

      if (finalExcursion) {
        const activeDecision = localDecisions[`${targetDateStr}_${empId}`] || localDecisions[finalExcursion.id] || finalExcursion.decision || 'pending';
        finalExcursion = { ...finalExcursion, decision: activeDecision };

        const excMins = finalExcursion.durationMinutes || 35;
        if (activeDecision === 'deduct') {
          workedMinutes = Math.max(0, Math.min(workedMinutes, expectedMinutes - excMins));
          dotColor = 'red';
          dotTooltip = `🔴 سزا / لێبڕین: ${excMins} خولەک لە دەوام لێبڕدراوە (${finalExcursion.note || 'مۆڵەت'})`;
        } else if (activeDecision === 'work') {
          // 🟢 لێخۆشبوون / بەخشین: دەگەڕێتەوە سەر ٨ کاتژمێری تەواو بۆ کارمەند!
          workedMinutes = expectedMinutes; // 480 mins = 8.0h
          dotColor = 'green';
          dotTooltip = `🟢 ئیشی کۆمپانیا / بەخشین: ٨ کاتژمێری تەواو پەسەندکراوە (${finalExcursion.note || 'کار'})`;
        } else {
          dotColor = 'orange';
          dotTooltip = `🟠 کاتی کەمە / تێبینی: ${excMins} خولەک • چاوەڕوانی بڕیاری ئەدمین (${finalExcursion.note || 'تێبینی'})`;
        }
      } else {
        if (workedMinutes >= expectedMinutes) {
          dotColor = null; // 🟢 Clean! No dot for normal completed days
          dotTooltip = 'دەوامی ئاسایی (٨ کاتژمێری تەواو)';
        } else {
          dotColor = 'orange';
          const deficitMins = expectedMinutes - workedMinutes;
          dotTooltip = `🟠 کاتی کەمە: ${deficitMins} خولەک کەمی هەیە • چاوەڕوانی تێبینی و بڕیاری ئەدمین`;
        }
      }
    }

    const workedHours = Math.round((workedMinutes / 60) * 10) / 10;

    return {
      hasRecord,
      checkInTime,
      checkOutTime,
      warehouseName,
      status,
      rawLog,
      dateStr: targetDateStr,
      excursion: finalExcursion || null,
      workedMinutes,
      workedHours,
      dotColor,
      dotTooltip
    };
  };

  const monthKpis = useMemo(() => {
    let totalCheckIns = 0;
    let lateCount = 0;
    let totalWorkedHoursSum = 0;

    let totalWorkingDaysInMonth = 0;
    daysArray.forEach(d => {
      const dateObj = new Date(year, month - 1, d);
      if (getDay(dateObj) !== 5) totalWorkingDaysInMonth++;
    });

    activeEmployees.forEach(emp => {
      daysArray.forEach(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          totalCheckIns++;
          totalWorkedHoursSum += info.workedHours;
          if (info.status === 'Late') lateCount++;
        }
      });
    });

    return {
      totalStaff: activeEmployees.length,
      totalCheckIns,
      lateCount,
      totalWorkedHoursSum: Math.round(totalWorkedHoursSum * 10) / 10,
      totalWorkingDaysInMonth,
      onTimeRate: totalCheckIns > 0 ? Math.round(((totalCheckIns - lateCount) / totalCheckIns) * 100) : 100
    };
  }, [activeEmployees, attendanceLogs, daysArray, selectedMonth, excursionsMap]);

  const handleExportCsv = () => {
    let csv = `\uFEFFناوی لیست: خشتەی تۆماری GPS نوێ (31-Day GPS Attendance Matrix), مانگ: ${selectedMonth}\n\n`;
    const headers = ['ناوی کارمەند', 'پلە/ئەرک', 'مۆبایل', ...daysArray.map(d => `${d}/${monthStr}`), 'کۆی دەوام (ڕۆژ)', 'کۆی کاتژمێر (Actual)', 'پێویست (Target)', 'جیاوازی (Balance)'];
    csv += headers.join(',') + '\n';

    activeEmployees.forEach(emp => {
      let daysCount = 0;
      let totalHours = 0;

      const dayCols = daysArray.map(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          daysCount++;
          totalHours += info.workedHours;
          return `${info.checkInTime || ''} - ${info.checkOutTime || ''} (${info.workedHours}h)`;
        }
        return '---';
      });

      const targetHours = daysCount * 8;
      const balance = Math.round((totalHours - targetHours) * 10) / 10;
      const balanceStr = balance >= 0 ? `+${balance}h` : `${balance}h`;

      const row = [
        `"${emp.fullName3Part || emp.name}"`,
        `"${emp.role || 'Staff'}"`,
        `"${emp.phone || ''}"`,
        ...dayCols,
        daysCount,
        `${totalHours}h`,
        `${targetHours}h`,
        `"${balanceStr}"`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ashley_GPS_Matrix_${selectedMonth}.csv`;
    link.click();
  };

  const handleExportPdf = () => {
    const columns: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name', align: 'right', width: '130px' },
      { header: 'دەوام (ڕۆژ)', key: 'days', align: 'center', width: '80px' },
      { header: 'کۆی کاتژمێر', key: 'hours', align: 'center', width: '80px' },
      { header: 'پێویست', key: 'target', align: 'center', width: '80px' },
      { header: 'جیاوازی', key: 'balance', align: 'center', width: '80px' }
    ];

    const data = activeEmployees.map(emp => {
      let daysCount = 0;
      let totalHours = 0;
      daysArray.forEach(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          daysCount++;
          totalHours += info.workedHours;
        }
      });
      const targetHours = daysCount * 8;
      const balance = Math.round((totalHours - targetHours) * 10) / 10;
      return {
        name: emp.fullName3Part || emp.name,
        days: `${daysCount}`,
        hours: `${totalHours}`,
        target: `${targetHours}`,
        balance: balance >= 0 ? `+${balance}` : `${balance}`
      };
    });

    exportToPDF({
      title: `خشتەی ئامادەبوونی کارمەندان (GPS Matrix) - ${selectedMonth}`,
      subtitle: 'Ashley Industrial Company',
      period: `مانگی ${selectedMonth}`,
      columns,
      data,
      orientation: 'landscape',
      fileName: `Ashley_GPS_Attendance_${selectedMonth}`
    });
  };

  return (
    <div className="space-y-4 font-sans" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  خشتەی ۳۱ ڕۆژەی ئامادەبوونی کارمەندان (31-Day GPS Matrix)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/30 font-mono">
                  شێفتی فەرمی: 8:00 بۆ 17:00
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تەواوی داتاکان ڕاستەوخۆ لە مۆبایلی کارمەندان و داتابەیسی سێرڤەرەوە دەخوێندرێنەوە.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-teal-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-bold font-mono focus:outline-none cursor-pointer text-xs"
              />
            </div>
            <button onClick={handleExportPdf} className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer">
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button onClick={handleExportCsv} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-800">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی کارمەندان</span>
            <span className="text-sm font-black text-white font-mono">{monthKpis.totalStaff}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی کاتژمێری کارکردنی مانگ</span>
            <span className="text-sm font-black text-teal-300 font-mono">{monthKpis.totalWorkedHoursSum}h</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی دەوامی دواکەوتوو</span>
            <span className="text-sm font-black text-amber-300 font-mono">{monthKpis.lateCount}</span>
          </div>
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">ڕێژەی پابەندبوون</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{monthKpis.onTimeRate}%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="گەڕان بەدوای کارمەند..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> <span>٨ کاتژمێری تەواو</span></div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> <span>کەمی</span></div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> <span>سزا</span></div>
        </div>
      </div>

      <div className="w-full overflow-x-auto border-2 border-slate-300 rounded-2xl shadow-md bg-white max-h-[72vh] overflow-y-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 z-20">
            <tr>
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black px-3 py-2.5 border-l border-slate-300 z-30 min-w-[200px]">👤 ناوی کارمەند</th>
              {daysArray.map((dayNum) => {
                const dateObj = new Date(year, month - 1, dayNum);
                const dayOfWeek = getDay(dateObj);
                const isFriday = dayOfWeek === 5;
                return (
                  <th key={dayNum} className={`text-center font-mono font-black p-2 border-l border-slate-300 min-w-[60px] ${isFriday ? 'bg-amber-100 text-amber-950' : 'text-slate-800'}`}>
                    <div className="text-xs">{dayNum}</div>
                  </th>
                );
              })}
              <th className="bg-teal-100 text-teal-950 font-black text-center px-2 py-2 border-l border-slate-300 min-w-[65px]">ڕۆژ</th>
              <th className="bg-emerald-100 text-emerald-950 font-black text-center px-2 py-2 border-l border-slate-300 min-w-[80px]">کۆ (Actual)</th>
              <th className="bg-slate-200 text-slate-950 font-black text-center px-2 py-2 border-l border-slate-300 min-w-[80px]">پێویست</th>
              <th className="bg-indigo-100 text-indigo-950 font-black text-center px-2 py-2 border-l border-slate-300 min-w-[80px]">جیاوازی</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {activeEmployees.map((emp, idx) => {
              let empDays = 0;
              let empHours = 0;
              return (
                <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="sticky right-0 bg-white p-2.5 border-l border-slate-300 z-10 font-sans">
                    <span className="font-black text-xs text-slate-900">{emp.fullName3Part || emp.name}</span>
                  </td>
                  {daysArray.map((dayNum) => {
                    const info = getGpsLogsForEmpAndDay(emp, dayNum);
                    if (info.hasRecord) { empDays++; empHours += info.workedHours; }
                    return (
                      <td key={dayNum} onClick={() => info.hasRecord && setSelectedLogDetail({ emp, info, dayNum })} className="p-1 border-l border-slate-200 text-center cursor-pointer hover:bg-teal-50">
                        {info.hasRecord ? (
                          <div className="relative">
                            {info.dotColor && <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${info.dotColor === 'green' ? 'bg-emerald-500' : info.dotColor === 'red' ? 'bg-rose-500' : 'bg-amber-500'}`} />}
                            <div className="text-[9px] font-black">{info.checkInTime}</div>
                            <div className="text-[9px] font-black">{info.workedHours}h</div>
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    );
                  })}
                  <td className="p-2 border-l text-center font-black">{empDays}</td>
                  <td className="p-2 border-l text-center font-black">{Math.round(empHours * 10) / 10}h</td>
                  <td className="p-2 border-l text-center font-black text-slate-700 bg-slate-100">{empDays * 8}h</td>
                  <td className={`p-2 border-l text-center font-black ${
                    empHours >= (empDays * 8) ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                  }`}>
                    {Math.round((empHours - (empDays * 8)) * 10) / 10 >= 0 ? `+${Math.round((empHours - (empDays * 8)) * 10) / 10}` : Math.round((empHours - (empDays * 8)) * 10) / 10}h
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* 🏁 BOTTOM SUMMARY FOOTER ROW */}
          <tfoot className="sticky bottom-0 bg-slate-900 text-white font-mono font-black text-xs border-t-2 border-slate-700 z-20">
            <tr>
              <td className="sticky right-0 bg-slate-950 p-2.5 border-l border-slate-800 text-amber-300 font-sans z-30">
                📊 کۆی گشتی هەموو کارمەندان
              </td>

              {daysArray.map((dayNum) => {
                let dayStaffCount = 0;
                let dayHoursSum = 0;

                activeEmployees.forEach(emp => {
                  const info = getGpsLogsForEmpAndDay(emp, dayNum);
                  if (info.hasRecord) {
                    dayStaffCount++;
                    dayHoursSum += info.workedHours;
                  }
                });

                return (
                  <td key={dayNum} className="p-1 border-l border-slate-800 text-center text-[10px]">
                    {dayStaffCount > 0 ? (
                      <div>
                        <div className="text-teal-300 font-bold">{dayStaffCount} ستاف</div>
                        <div className="text-slate-400 text-[9px]">{Math.round(dayHoursSum)}h</div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                );
              })}

              <td className="p-2 border-l border-slate-800 text-center text-teal-300">
                {monthKpis.totalCheckIns} دەوام
              </td>

              <td className="p-2 border-l border-slate-800 text-center text-emerald-300">
                {monthKpis.totalWorkedHoursSum}h
              </td>

              <td className="p-2 border-l border-slate-800 text-center text-slate-300">
                {monthKpis.totalCheckIns * 8}h
              </td>

              <td className="p-2 border-l border-slate-800 text-center text-amber-300">
                {Math.round((monthKpis.totalWorkedHoursSum - (monthKpis.totalCheckIns * 8)) * 10) / 10}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 🔍 LOG DETAILS & EXCURSION DECISION MODAL */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-300 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-black">
                  {(selectedLogDetail.emp.name || '').charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">وردەکاری دەوامی ڕۆژ و کاتژمێری کارکردن</h3>
                  <span className="text-xs text-slate-500 font-bold">{selectedLogDetail.emp.fullName3Part || selectedLogDetail.emp.name}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-black text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">📅 بەروار:</span>
                <span className="font-mono font-black text-slate-900">{selectedLogDetail.info.dateStr}</span>
              </div>

              {/* Shift Times Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-800 font-bold block text-[11px]">🟢 کاتی هاتن (Check-In):</span>
                  <span className="font-mono font-black text-sm text-emerald-950">
                    {selectedLogDetail.info.checkInTime || 'تۆمار نەکراوە'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                  <span className="text-orange-800 font-bold block text-[11px]">🟠 کاتی ڕۆیشتن (Check-Out):</span>
                  <span className="font-mono font-black text-sm text-orange-950">
                    {selectedLogDetail.info.checkOutTime || 'تۆمار نەکراوە'}
                  </span>
                </div>
              </div>

              {/* Lunch Break Note */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-900 font-bold">
                <div className="flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-amber-600" />
                  <span>پشووی نانخواردن و فەرمی (12:00 بۆ 13:00):</span>
                </div>
                <span className="font-mono text-xs font-black">١ کاتژمێر پشوو (لێدەرکراوە)</span>
              </div>

              {/* Net Worked Hours */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 text-white">
                <div>
                  <span className="text-xs text-slate-300 font-bold block">کۆی کاتژمێری کارکردنی ئەنجامدراو:</span>
                  <span className="text-[10px] text-teal-300">پێویست بۆ دەوامی تەواو: ٨ کاتژمێر</span>
                </div>
                <span className="font-mono font-black text-base text-teal-300">
                  {selectedLogDetail.info.workedHours} کاتژمێر
                </span>
              </div>

              {/* 🚪 EXCURSION & MID-DAY ABSENCE CARD (If exists) */}
              {selectedLogDetail.info.excursion ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center gap-1.5 text-amber-900 font-black">
                      <DoorOpen className="w-4 h-4 text-amber-600" />
                      <span>دەرچوونی کاتی لە کاتی دەوامدا (Excursion)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-mono font-black text-[10px]">
                      ⏰ {selectedLogDetail.info.excursion.exitTime} ➔ {selectedLogDetail.info.excursion.returnTime} ({selectedLogDetail.info.excursion.durationMinutes || 40} خولەک)
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1">
                    <span className="text-slate-500 font-bold text-[11px] block">📝 تێبینی و هۆکاری نووسراوی کارمەند لە مۆبایلەوە:</span>
                    <p className="font-bold text-slate-900 text-xs">
                      «{selectedLogDetail.info.excursion.note || 'هیچ تێبینییەک نەنووسراوە'}»
                    </p>
                  </div>

                  {/* Admin Decision Toggle */}
                  <div className="pt-1">
                    <span className="text-[11px] font-black text-slate-700 block mb-1.5">
                      ⚖️ بڕیاری بەڕێوەبەر (ئازادیت لە سزادان یان قبوڵکردنی وەک کاری فەرمی):
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleInlineExcursionDecision(selectedLogDetail.info.excursion.id, selectedLogDetail.info.dateStr, selectedLogDetail.emp.id, 'work')}
                        disabled={savingDecisionId === selectedLogDetail.info.excursion.id}
                        className={`p-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          (localDecisions[`${selectedLogDetail.info.dateStr}_${selectedLogDetail.emp.id}`] || selectedLogDetail.info.excursion.decision) === 'work'
                            ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>🟢 ئاساییە / بەخشین (٨ کاتژمێر)</span>
                      </button>

                      <button
                        onClick={() => handleInlineExcursionDecision(selectedLogDetail.info.excursion.id, selectedLogDetail.info.dateStr, selectedLogDetail.emp.id, 'deduct')}
                        disabled={savingDecisionId === selectedLogDetail.info.excursion.id}
                        className={`p-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          (localDecisions[`${selectedLogDetail.info.dateStr}_${selectedLogDetail.emp.id}`] || selectedLogDetail.info.excursion.decision) === 'deduct'
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                            : 'bg-white hover:bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>🔴 سزا / لێبڕین لە دەوام</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedLogDetail.info.workedMinutes < 480 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center gap-1.5 text-amber-900 font-black">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>کاتی کەمی دەوام ({480 - selectedLogDetail.info.workedMinutes} خولەک کەمی هەیە)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-mono font-black text-[10px]">
                      درەنگ هاتن یان زوو ڕۆیشتن
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className="text-[11px] font-black text-slate-700 block mb-1.5">
                      ⚖️ بڕیاری بەڕێوەبەر لەسەر ئەم کەمییە:
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleInlineExcursionDecision(`exc-${selectedLogDetail.emp.id}-${selectedLogDetail.info.dateStr}`, selectedLogDetail.info.dateStr, selectedLogDetail.emp.id, 'work')}
                        className={`p-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          localDecisions[`${selectedLogDetail.info.dateStr}_${selectedLogDetail.emp.id}`] === 'work'
                            ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>🟢 ئاساییە / بەخشین (٨ کاتژمێر)</span>
                      </button>

                      <button
                        onClick={() => handleInlineExcursionDecision(`exc-${selectedLogDetail.emp.id}-${selectedLogDetail.info.dateStr}`, selectedLogDetail.info.dateStr, selectedLogDetail.emp.id, 'deduct')}
                        className={`p-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          localDecisions[`${selectedLogDetail.info.dateStr}_${selectedLogDetail.emp.id}`] === 'deduct'
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                            : 'bg-white hover:bg-rose-50 text-rose-800 border border-rose-300'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>🔴 سزا / لێبڕین لە دەوام</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-bold text-[11px] flex items-center gap-1.5">
                  <span>✅ هیچ چوونە دەرەوەیەک یان کەمییەک لە دەوامدا تۆمار نەکراوە (٨ کاتژمێری تەواو).</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedLogDetail(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs cursor-pointer shadow-md transition-colors"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
