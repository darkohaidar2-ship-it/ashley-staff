'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { 
  Calendar, 
  MapPin, 
  Search, 
  Download, 
  FileText, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles,
  ShieldCheck,
  Building2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { getDaysInMonth, format, getDay } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface NewGpsAttendanceMatrixTableProps {
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
}

export function NewGpsAttendanceMatrixTable({ employees = [], attendanceLogs = [] }: NewGpsAttendanceMatrixTableProps) {
  // Current Selected Month (Default to 2026-08 or active month)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');
  const [selectedLogDetail, setSelectedLogDetail] = useState<any | null>(null);

  // Month Days calculation
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '08', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Filtered Employees
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

  // Helper to extract log for employee and specific day from Supabase logs
  const getGpsLogsForEmpAndDay = (emp: Employee, dayNum: number) => {
    const formattedDay = dayNum.toString().padStart(2, '0');
    const targetDateStr = `${selectedMonth}-${formattedDay}`;

    const empId = (emp.id || '').toString().trim().toLowerCase();
    const empNum = empId.replace('emp-', '');
    const empName = (emp.name || emp.fullName3Part || '').trim().toLowerCase();

    // Match in attendanceLogs
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

    dayRecords.forEach(r => {
      rawLog = r;
      if (r.checkInTime) checkInTime = r.checkInTime;
      if (r.checkOutTime) checkOutTime = r.checkOutTime;
      if (r.warehouseName) warehouseName = r.warehouseName;
      if (r.status) status = r.status;

      // Type-based detection if explicit logs
      if (r.type?.includes('In') || r.type?.includes('هاتن') || r.action === 'Check In') {
        const t = r.checkInTime || (r.time ? r.time.split(' ')[1]?.slice(0, 5) : '');
        if (t && !checkInTime) checkInTime = t;
      }
      if (r.type?.includes('Out') || r.type?.includes('دەرچوون') || r.action === 'Check Out') {
        const t = r.checkOutTime || (r.time ? r.time.split(' ')[1]?.slice(0, 5) : '');
        if (t) checkOutTime = t;
      }
    });

    return {
      hasRecord: Boolean(checkInTime || checkOutTime),
      checkInTime,
      checkOutTime,
      warehouseName,
      status,
      rawLog,
      dateStr: targetDateStr
    };
  };

  // Month Statistics
  const monthKpis = useMemo(() => {
    let totalCheckIns = 0;
    let lateCount = 0;

    activeEmployees.forEach(emp => {
      daysArray.forEach(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          totalCheckIns++;
          if (info.status === 'Late') lateCount++;
        }
      });
    });

    return {
      totalStaff: activeEmployees.length,
      totalCheckIns,
      lateCount,
      onTimeRate: totalCheckIns > 0 ? Math.round(((totalCheckIns - lateCount) / totalCheckIns) * 100) : 100
    };
  }, [activeEmployees, attendanceLogs, daysArray, selectedMonth]);

  // Export to CSV
  const handleExportCsv = () => {
    let csv = `\uFEFFناوی لیست: خشتەی تۆماری GPS نوێ (31-Day GPS Attendance Matrix), مانگ: ${selectedMonth}\n\n`;
    const headers = ['ناوی کارمەند', 'پلە/ئەرک', 'مۆبایل', ...daysArray.map(d => `${d}/${monthStr}`), 'کۆی ڕۆژانی ئامادەبوو'];
    csv += headers.join(',') + '\n';

    activeEmployees.forEach(emp => {
      let daysPresent = 0;
      const row = [
        `"${emp.fullName3Part || emp.name}"`,
        `"${emp.role || 'Staff'}"`,
        `"${emp.phone || '-'}"`,
      ];

      daysArray.forEach(dayNum => {
        const info = getGpsLogsForEmpAndDay(emp, dayNum);
        if (info.hasRecord) {
          daysPresent++;
          const inPart = info.checkInTime ? `In:${info.checkInTime}` : '';
          const outPart = info.checkOutTime ? `Out:${info.checkOutTime}` : '';
          row.push(`"${[inPart, outPart].filter(Boolean).join(' | ')}"`);
        } else {
          row.push(`"---"`);
        }
      });

      row.push(`"${daysPresent}"`);
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ashley_GPS_Matrix_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPdf = () => {
    const cols: ExportTableColumn[] = [
      { header: 'ناوی کارمەند', key: 'name', align: 'right', width: '130px' },
      { header: 'پلە/ئەرک', key: 'role', align: 'right', width: '80px' },
      { header: 'ئامادەبوون', key: 'totalPresent', align: 'center', width: '55px' },
      ...daysArray.map(d => ({
        header: `${d}`,
        key: `day_${d}`,
        align: 'center' as const,
        width: '32px',
      })),
    ];

    const data = activeEmployees.map(emp => {
      let presentCount = 0;
      const rowData: Record<string, any> = {
        name: emp.fullName3Part || emp.name,
        role: emp.role || 'Staff',
      };

      daysArray.forEach(d => {
        const info = getGpsLogsForEmpAndDay(emp, d);
        if (info.hasRecord) {
          presentCount++;
          rowData[`day_${d}`] = info.checkInTime ? info.checkInTime.slice(0, 5) : '✓';
        } else {
          rowData[`day_${d}`] = '-';
        }
      });

      rowData['totalPresent'] = `${presentCount}`;
      return rowData;
    });

    exportToPDF({
      title: 'خشتەی تۆماری GPS نوێی کارمەندان (31-Day GPS Attendance Matrix)',
      subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی — بەستراوە بە ئەپڵیکەیشنی مۆبایل و سوپابەیس',
      period: `مانگی ${selectedMonth}`,
      columns: cols,
      data,
      orientation: 'landscape',
      fileName: `Ashley_GPS_Matrix_${selectedMonth}`,
      summaryCards: [
        { label: 'کۆی کارمەندان', value: `${activeEmployees.length} کەس` },
        { label: 'ڕۆژانی مانگ', value: `${totalDays} ڕۆژ` },
        { label: 'ڕێژەی پابەندبوون', value: `${monthKpis.onTimeRate}%` },
      ],
    });
  };

  return (
    <div className="space-y-4 font-sans dir-rtl select-none" dir="rtl">
      
      {/* 🧭 TOP HEADER & CONTROL BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-4 rounded-2xl border border-teal-800 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400 flex items-center justify-center text-teal-300 shadow-inner">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white">
                  خشتەی تۆماری GPS نوێ (31-Day Mobile Attendance Matrix)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400 text-teal-300 text-[10px] font-black font-mono animate-pulse">
                  ● Live Supabase Synced
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تەواوی داتاکانی ئەم خشتەیە بە شێوەیەکی ڕاستەوخۆ لە ئەپڵیکەیشنی مۆبایل و داتابەیسی سوپابەیسەوە وەردەگیرێن.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Picker */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
              <Calendar className="w-3.5 h-3.5 text-teal-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-bold font-mono focus:outline-none cursor-pointer"
              />
            </div>

            {/* Export PDF */}
            <button
              onClick={handleExportPdf}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>داگرتنی PDF</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>داگرتنی Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* 📊 SUMMARY METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی کارمەندانی تۆمارکراو</span>
            <span className="text-sm font-black text-white font-mono">{monthKpis.totalStaff} کارمەند</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی هاتنەکانی مانگ (Check-Ins)</span>
            <span className="text-sm font-black text-teal-300 font-mono">{monthKpis.totalCheckIns} دەوام</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">کۆی دەوامی دواکەوتوو (Late)</span>
            <span className="text-sm font-black text-amber-300 font-mono">{monthKpis.lateCount} جار</span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold block">ڕێژەی پابەندبوون بە دەوام</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{monthKpis.onTimeRate}%</span>
          </div>
        </div>
      </div>

      {/* 🔍 SEARCH & QUICK FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="گەڕان بەدوای ناوی کارمەند یان مۆبایل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-bold">
          💡 نیشانەکان: <span className="text-emerald-700 font-black">🟢 In (کاتی هاتن)</span> • <span className="text-amber-700 font-black">🟠 Out (کاتی ڕۆیشتن)</span> • کلیک لە هەر خانەیەک بکە بۆ بینینی وردەکاری لۆکەیشن
        </div>
      </div>

      {/* 📊 31-DAY MATRIX GRID TABLE */}
      <div className="w-full overflow-x-auto border-2 border-slate-300 rounded-2xl shadow-md bg-white max-h-[70vh] overflow-y-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 z-20 shadow-xs">
            <tr>
              {/* Sticky Column: Employee Info */}
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black px-3 py-2.5 border-l border-slate-300 z-30 min-w-[200px]">
                👤 ناوی کارمەند / ڕێکەوت ➔
              </th>

              {/* 31 Day Columns */}
              {daysArray.map((dayNum) => {
                const dateObj = new Date(year, month - 1, dayNum);
                const dayOfWeek = getDay(dateObj);
                const isFriday = dayOfWeek === 5;

                return (
                  <th 
                    key={dayNum}
                    className={`text-center font-mono font-black p-2 border-l border-slate-300 min-w-[55px] ${
                      isFriday ? 'bg-amber-100 text-amber-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="text-xs">{dayNum}</div>
                    <div className="text-[9px] font-bold text-slate-500">
                      {['یەک', 'دوو', 'سێ', 'چوار', 'پێنج', 'هەینی', 'شەم'][dayOfWeek]}
                    </div>
                  </th>
                );
              })}

              {/* Total Present Summary */}
              <th className="bg-teal-100 text-teal-950 font-black text-center px-3 py-2 border-l border-slate-300 min-w-[70px]">
                کۆی دەوام
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 font-mono">
            {activeEmployees.map((emp, idx) => {
              let employeeTotalPresent = 0;

              return (
                <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-100'}>
                  
                  {/* Sticky Employee Name & Role */}
                  <td className="sticky right-0 bg-slate-100 p-2.5 border-l border-slate-300 z-10 shadow-xs font-sans">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-black text-xs flex items-center justify-center">
                        {(emp.name || '').charAt(0)}
                      </div>
                      <div>
                        <span className="font-black text-xs text-slate-900 block leading-tight">
                          {emp.fullName3Part || emp.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                          {emp.role || 'Staff'} • PIN: {emp.password || '1001'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 31 Day Cells */}
                  {daysArray.map((dayNum) => {
                    const info = getGpsLogsForEmpAndDay(emp, dayNum);
                    const dateObj = new Date(year, month - 1, dayNum);
                    const isFriday = getDay(dateObj) === 5;

                    if (info.hasRecord) {
                      employeeTotalPresent++;
                    }

                    return (
                      <td
                        key={dayNum}
                        onClick={() => {
                          if (info.hasRecord) {
                            setSelectedLogDetail({ emp, info, dayNum });
                          }
                        }}
                        className={`p-1 border-l border-slate-200 text-center cursor-pointer transition-colors ${
                          isFriday ? 'bg-amber-50/50' : ''
                        } ${info.hasRecord ? 'hover:bg-teal-50' : ''}`}
                      >
                        {info.hasRecord ? (
                          <div className="space-y-0.5">
                            {info.checkInTime ? (
                              <div className={`px-1 py-0.5 rounded text-[10px] font-black ${
                                info.status === 'Late' 
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}>
                                {info.checkInTime.slice(0, 5)}
                              </div>
                            ) : null}

                            {info.checkOutTime ? (
                              <div className="px-1 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-900 border border-orange-300">
                                {info.checkOutTime.slice(0, 5)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs select-none">---</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Summary Total */}
                  <td className="p-2 border-l border-slate-300 text-center font-black text-xs text-teal-900 bg-teal-50">
                    {employeeTotalPresent} ڕۆژ
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 🔍 LOG DETAILS MODAL */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-md w-full p-5 space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 rounded-xl text-teal-800">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">وردەکاری دەوامی GPS</h3>
                  <span className="text-xs text-slate-500 font-bold">{selectedLogDetail.emp.name}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">ڕێکەوت:</span>
                <span className="font-mono font-black text-slate-900">{selectedLogDetail.info.dateStr}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 font-bold">کاتی هاتن (Check-In):</span>
                <span className="font-mono font-black text-emerald-900">
                  {selectedLogDetail.info.checkInTime || 'تۆمار نەکراوە'}
                </span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-orange-50 border border-orange-200">
                <span className="text-orange-800 font-bold">کاتی ڕۆیشتن (Check-Out):</span>
                <span className="font-mono font-black text-orange-900">
                  {selectedLogDetail.info.checkOutTime || 'تۆمار نەکراوە'}
                </span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">لۆکەیشنی تۆمارکراو:</span>
                <span className="font-bold text-slate-900">
                  {selectedLogDetail.info.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی'}
                </span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-bold">دۆخی ئامادەبوون:</span>
                <span className={`font-bold px-2 py-0.5 rounded ${
                  selectedLogDetail.info.status === 'Late' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                }`}>
                  {selectedLogDetail.info.status === 'Late' ? 'دواکەوتوو' : 'لە کاتی خۆیدا (Present)'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedLogDetail(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
