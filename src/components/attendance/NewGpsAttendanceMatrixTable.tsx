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
  X
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
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);

  // Status Drag & Drop Quick Palette
  const [selectedPaletteStatus, setSelectedPaletteStatus] = useState<string>('Present');
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null);

  // Dynamic Manual Overrides Map for cell statuses: Map<empId_dateStr, { status: string; checkInTime?: string; checkOutTime?: string }>
  const [manualStatusMap, setManualStatusMap] = useState<Record<string, { status: string; checkInTime?: string; checkOutTime?: string }>>({});

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
      return { dayNum, dateStr, isFriday };
    });
  }, [totalDays, year, month, selectedMonth]);

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

  // Handle Drag & Drop / Click Cell Status Change
  const handleCellStatusChange = async (userId: string, userName: string, dateStr: string, status: string) => {
    const key = `${userId}_${dateStr}`;
    
    // Optimistic Update
    setManualStatusMap(prev => ({
      ...prev,
      [key]: {
        status,
        checkInTime: status === 'Present' ? '08:30' : (status === 'Leave' || status === 'مۆڵەت') ? 'مۆڵەت' : undefined,
        checkOutTime: status === 'Present' ? '16:30' : (status === 'Leave' || status === 'مۆڵەت') ? 'مۆڵەت' : undefined
      }
    }));

    try {
      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, date: dateStr, status })
      });
      loadSavedRecords();
    } catch (e) {
      console.error(e);
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

  const getGpsLogsForEmpAndDay = (emp: Employee, dayItem: { dayNum: number; dateStr: string; isFriday: boolean }) => {
    const { dateStr, isFriday } = dayItem;
    const empId = (emp.id || '').toString().trim().toLowerCase();
    const empNum = empId.replace('emp-', '');
    const empName = (emp.name || emp.fullName3Part || '').trim().toLowerCase();

    // Check manual override first
    const override = manualStatusMap[`${emp.id}_${dateStr}`] || manualStatusMap[`${empNum}_${dateStr}`] || manualStatusMap[`emp-${empNum}_${dateStr}`];
    if (override) {
      return {
        hasRecord: true,
        isFriday,
        checkInTime: override.checkInTime || '',
        checkOutTime: override.checkOutTime || '',
        status: override.status,
        warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
        workedHours: override.status === 'Present' ? 8 : 0,
      };
    }

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
    let status = isFriday ? 'Holiday' : 'Absent';

    dayRecords.forEach((r: any) => {
      const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '');
      const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '');

      if (inCandidate && !checkInTime) checkInTime = inCandidate.slice(0, 5);
      if (outCandidate) checkOutTime = outCandidate.slice(0, 5);
      if (r.warehouseName || r.warehouse_name) warehouseName = r.warehouseName || r.warehouse_name;
      if (r.status) status = r.status;
    });

    const hasRecord = Boolean(checkInTime || checkOutTime);
    if (hasRecord) status = 'Present';

    return {
      hasRecord,
      isFriday,
      checkInTime,
      checkOutTime,
      status,
      warehouseName,
      workedHours: hasRecord ? 8 : 0,
    };
  };

  const handleExportCsv = () => {
    let csv = '\uFEFF';
    const dayHeaders = daysArray.map(d => `"ڕۆژی ${d.dayNum}"`).join(',');
    csv += `"ناوی کارمەند","پلە","ژمارەی مۆبایل",${dayHeaders},"کۆی ئامادەبوون","کۆی کاژێر"\n`;

    activeEmployees.forEach(emp => {
      let daysCount = 0;
      let totalHours = 0;
      const dayCols = daysArray.map(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          daysCount++;
          totalHours += info.workedHours;
          return `"${info.checkInTime || 'ئامادە'}"`;
        } else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
          return '"مۆڵەت"';
        } else if (info.status === 'Absent' || info.status === 'غیاب') {
          return '"غیاب"';
        } else if (info.isFriday || info.status === 'Holiday') {
          return '"پشوو (هەینی)"';
        }
        return '"-"';
      });

      const row = [
        `"${emp.fullName3Part || emp.name}"`,
        `"${emp.role || 'Staff'}"`,
        `"${emp.phone || ''}"`,
        ...dayCols,
        daysCount,
        `${totalHours}h`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Ashley_GPS_Matrix_${selectedMonth}.csv`;
    link.click();
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
                سیستەمی Drag & Drop بۆ دیاریکردنی مۆڵەت و غیاب لەگەڵ چاودێری ڕاستەوخۆی GPS.
              </p>
            </div>
          </div>

          {/* Month Navigator & Export */}
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
            <button onClick={handleExportCsv} className="px-3 py-1.5 rounded-none bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Status Drag & Drop Quick Palette Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
              <Move className="w-3.5 h-3.5" />
              <span>پالێتی Drag & Drop (ڕایبکێشە بۆ سەر هەر ڕۆژێک یان کلیک بکە):</span>
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
                onClick={() => setSelectedPaletteStatus(p.key)}
                className={`px-3 py-1 rounded-none text-[10px] font-black border transition-all cursor-grab active:cursor-grabbing select-none flex items-center gap-1 shadow-2xs ${p.bg} ${
                  selectedPaletteStatus === p.key ? 'ring-2 ring-blue-400 scale-105 shadow-md' : 'opacity-85 hover:opacity-100'
                }`}
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
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black px-3 py-2.5 border-l border-slate-300 z-30 min-w-[180px]">
                👤 ناوی کارمەند
              </th>
              {daysArray.map((d) => (
                <th 
                  key={d.dateStr} 
                  className={`text-center font-black p-1 border-l border-slate-300 min-w-[42px] ${
                    d.isFriday ? 'bg-emerald-100 text-emerald-950 font-black' : 'text-slate-800'
                  }`}
                >
                  <div className="text-[10px]">{d.dayNum}</div>
                  <div className="text-[8px] font-bold">{d.isFriday ? '🌴 هەینی' : ''}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {activeEmployees.map((emp) => (
              <tr key={emp.id} className="hover:bg-blue-50/40 transition-colors">
                <td className="sticky right-0 bg-white z-10 px-3 py-2 border-l border-slate-300 font-bold shadow-xs">
                  <div className="text-xs font-black text-slate-900">{emp.fullName3Part || emp.name}</div>
                  <div className="text-[9px] font-mono text-slate-400">{emp.id}</div>
                </td>
                {daysArray.map((d) => {
                  const info = getGpsLogsForEmpAndDay(emp, d);
                  const isFriday = d.isFriday;

                  let badgeColor = 'bg-slate-50 text-slate-400 border-slate-200';
                  let badgeText = '-';

                  if (info.status === 'Present' || info.checkInTime) {
                    badgeColor = 'bg-emerald-600 text-white border-emerald-700 font-black';
                    badgeText = info.checkInTime || 'ئامادە';
                  } else if (info.status === 'Leave' || info.status === 'مۆڵەت') {
                    badgeColor = 'bg-amber-400 text-amber-950 border-amber-500 font-black';
                    badgeText = 'مۆڵەت';
                  } else if (info.status === 'Absent' || info.status === 'غیاب') {
                    badgeColor = 'bg-rose-600 text-white border-rose-700 font-black';
                    badgeText = 'غیاب';
                  } else if (info.status === 'Holiday' || isFriday) {
                    badgeColor = 'bg-teal-100 text-teal-900 border-teal-300 font-black';
                    badgeText = '🌴';
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
                          handleCellStatusChange(emp.id, emp.name, d.dateStr, dropped);
                        }
                      }}
                      onClick={() => handleCellStatusChange(emp.id, emp.name, d.dateStr, selectedPaletteStatus)}
                      onDoubleClick={() => setSelectedLogDetail({ date: d.dateStr, emp, info })}
                      title={`Drag & Drop بکە یان کلیک بکە بۆ دیاریکردنی ${selectedPaletteStatus} (دبل کلیک بۆ گرافی ٢٤ کاتژمێری)`}
                      className={`p-1 text-center border-l border-slate-200 cursor-pointer hover:bg-amber-100/60 transition-all ${
                        isFriday ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <div className={`w-full py-1 rounded-none text-[9px] border shadow-2xs transition-all ${badgeColor}`}>
                        {badgeText}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🪟 WINDOWS 11 SHARP MODAL: 24-HOUR TIMELINE VIEW */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-xl w-full p-0 text-right">
            
            {/* Title Bar */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-xs text-white">
                  پەنجەرەی چالاکی ٢٤ کاتژمێری: {selectedLogDetail.emp?.name}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">{selectedLogDetail.date}</span>
                <button 
                  onClick={() => setSelectedLogDetail(null)}
                  className="w-6 h-6 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs font-mono transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* 24-Hour Timeline Bar */}
              <div className="space-y-2 p-3 bg-slate-100 rounded-none border border-slate-300">
                <span className="text-xs font-black text-slate-800 block">گرافی دەوامی ٢٤ کاتژمێری ئەم ڕۆژە:</span>
                <div className="relative w-full h-12 bg-white rounded-none overflow-hidden border border-slate-300">
                  <div className="absolute top-0 bottom-0 bg-blue-100/60 border-x-2 border-dashed border-blue-400/80 pointer-events-none" style={{ left: '35.4%', width: '33.3%' }} />
                  {selectedLogDetail.info?.checkInTime && (
                    <div 
                      className="absolute top-1 bottom-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-none flex items-center justify-center text-[9px] font-mono font-bold shadow-xs border border-emerald-700"
                      style={{ left: '35.4%', width: '33.3%' }}
                    >
                      {selectedLogDetail.info.checkInTime} - {selectedLogDetail.info.checkOutTime || '16:30'}
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

              <div className="p-3 bg-slate-50 border border-slate-300 flex items-center justify-between text-xs">
                <div>
                  <span className="font-black text-slate-900">{selectedLogDetail.emp?.name}</span>
                  <p className="text-[10px] text-slate-500">📍 {selectedLogDetail.info?.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی'}</p>
                </div>
                <div className="text-left font-mono">
                  <div className="font-bold text-emerald-800">هاتن: {selectedLogDetail.info?.checkInTime || '-'}</div>
                  <div className="text-slate-600">ڕۆشتن: {selectedLogDetail.info?.checkOutTime || '-'}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => setSelectedLogDetail(null)} 
                  className="rounded-none px-6 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                >
                  داخستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
