'use client';

import React, { useState } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { Camera, Calendar, MapPin, Trash2, CheckCircle, User, FileText } from 'lucide-react';
import { getDaysInMonth, format } from 'date-fns';

interface AttendanceSheetGridProps {
  attendanceLogs: AttendanceRecord[];
  employees: Employee[];
  onDeleteLog?: (logId: string) => void;
}

export function AttendanceSheetGrid({ attendanceLogs: initialLogs, employees, onDeleteLog }: AttendanceSheetGridProps) {
  // Selected Month (default '2026-08')
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  // Selected Employee filter ('all' or emp.id)
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  
  // Realtime Logs state
  const [gridLogs, setGridLogs] = useState<AttendanceRecord[]>(initialLogs);
  
  React.useEffect(() => {
    setGridLogs(initialLogs);
  }, [initialLogs]);

  // Selected Log for Selfie & Full Details Modal
  const [activeLogModal, setActiveLogModal] = useState<AttendanceRecord | null>(null);

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

    return gridLogs.filter(log => {
      // Date match
      const logDate = log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '';
      if (logDate !== targetDateStr) return false;

      // Employee match
      const isEmpMatch = 
        log.employeeId === emp.id || 
        log.userId === emp.id || 
        log.name === emp.fullName3Part || 
        log.name === emp.name ||
        log.userName === emp.name;

      return isEmpMatch;
    });
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

  // Handle Direct PDF Export File Download
  const handleDownloadPdf = async () => {
    const tableContainer = document.getElementById('attendance-matrix-table-wrapper');
    const printDate = format(new Date(), 'yyyy-MM-dd');
    const printTime = format(new Date(), 'HH:mm:ss');
    const filename = `Ashley_Attendance_Matrix_${selectedMonth}_${printDate}.pdf`;

    if (!tableContainer) {
      window.print();
      return;
    }

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const canvas = await html2canvas(tableContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Top Document Info Header
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`ASHLEY ERP - List: Attendance 31-Day Matrix (${selectedMonth})`, 10, 8);
      pdf.text(`Print Date: ${printDate} | Print Time: ${printTime}`, pdfWidth - 90, 8);

      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 10, 12, imgWidth, Math.min(imgHeight, pdfHeight - 20));
      pdf.save(filename);
    } catch (err) {
      console.error('PDF export fallback:', err);
      window.print();
    }
  };

  // Handle Printable View Trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3 font-sans select-none dir-rtl" dir="rtl">
      
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

      {/* 🛠️ SHEET CONTROL BAR (WinUI 3 Fluent Acrylic) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl text-xs font-bold shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-800 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-slate-900 font-extrabold text-xs">
            شیت ماتریسی مانگانەی ئامادەبوونی کارمەندان (31-Day Attendance Matrix Sheet):
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Picker */}
          <div className="flex items-center gap-1">
            <label className="text-slate-600 font-bold">مانگ:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-fluent font-mono text-xs font-bold rounded-lg"
            />
          </div>

          {/* Employee Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-600 font-bold">کارمەند:</label>
            <select
              value={selectedEmpFilter}
              onChange={(e) => setSelectedEmpFilter(e.target.value)}
              className="input-fluent font-bold text-xs rounded-lg"
            >
              <option value="all">تێکڕای کارمەندان ({employees.length})</option>
              {employees.filter(e => e.status !== 'resigned').map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                </option>
              ))}
            </select>
          </div>

          {/* 🔄 SUPABASE REAL-TIME REFRESH BUTTON */}
          <button
            type="button"
            onClick={() => {
              fetch('/api/attendance/logs')
                .then((res) => res.json())
                .then((supabaseLogs) => {
                  if (Array.isArray(supabaseLogs) && supabaseLogs.length > 0) {
                    setGridLogs((prevLogs: AttendanceRecord[]) => {
                      const logsMap = new Map((prevLogs || []).map((l: AttendanceRecord) => [l.id, l]));
                      supabaseLogs.forEach((sbLog: any) => {
                        logsMap.set(sbLog.id, sbLog);
                      });
                      return Array.from(logsMap.values());
                    });
                  }
                })
                .catch((err) => console.error('Manual Supabase sync error:', err));
            }}
            className="btn-fluent text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-lg border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            title="ڕاکێشان و نوێکردنەوەی ڕاستەوخۆی داتاکانی ئامادەبوون لە سوپا بەیسەوە"
          >
            <span>🔄 ڕاکێشانی داتای سوپا بەیس</span>
          </button>

          {/* 🖨️ PRINT, PDF & CSV ACTION BUTTONS */}
          <button
            type="button"
            onClick={handlePrint}
            className="btn-fluent text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-lg"
            title="پرێنتکردنی ناوی لیست و کاتی پرێنت لەسەر کاغەز"
          >
            <span>🖨️ پرێنت (Print)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="btn-fluent-danger text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-lg"
            title="داگرتنی ڕاستەوخۆی فایلی PDF"
          >
            <span>📄 داگرتنی PDF</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="btn-fluent-primary text-xs font-bold flex items-center gap-1 py-1.5 px-3 rounded-lg"
            title="داگرتنی فایلی Excel / CSV"
          >
            <span>📊 داگرتنی CSV</span>
          </button>
        </div>
      </div>

      {/* 📊 31-DAY MATRIX GRID TABLE (WinUI 3 Fluent Glassmorphism Widescreen) */}
      <div id="attendance-matrix-table-wrapper" className="w-full overflow-x-auto border border-slate-300 rounded-xl max-h-[72vh] min-h-[450px] overflow-y-auto shadow-sm bg-white/90 backdrop-blur-md">
        <table className="table-fluent w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 border-b-2 border-slate-300 z-20">
            <tr>
              {/* Sticky Right Side Column Header: Employee Name */}
              <th className="sticky right-0 bg-slate-200 text-slate-950 font-black text-right min-w-[180px] px-3 py-2.5 border-l border-slate-300 z-30 shadow-sm">
                👤 ناوی کارمەند / ڕێکەوت ➔
              </th>

              {/* 31 Day Header Columns (Simplified Date Only) */}
              {daysArray.map((dayNum) => (
                <th key={dayNum} className="text-center font-mono font-bold min-w-[50px] px-1 py-1 border-l border-slate-400 bg-slate-200">
                  <span className="text-slate-600 text-[11px] font-mono font-bold">
                    {dayNum.toString().padStart(2, '0')}/{monthStr}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.length > 0 ? (
              activeEmployees.map((emp, idx) => (
                <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-100' : 'bg-slate-50 hover:bg-slate-100'}>
                  
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
                    const cellLogs = getLogsForEmpAndDay(emp, dayNum);
                    const checkIn = cellLogs.find(l => l.type?.includes('In') || l.type?.includes('هاتن'));
                    const checkOut = cellLogs.find(l => l.type?.includes('Out') || l.type?.includes('دەرچوون'));

                    return (
                      <td key={dayNum} className="text-center p-1 border-l border-slate-300 align-middle">
                        {cellLogs.length > 0 ? (
                          <div className="flex flex-col items-center justify-center gap-0.5 font-mono text-[11px] font-bold">
                            {/* Check-In Link in BLUE */}
                            {checkIn ? (
                              <button
                                type="button"
                                onClick={() => setActiveLogModal(checkIn)}
                                className="text-blue-700 hover:text-blue-950 underline font-mono font-bold cursor-pointer transition-colors block text-center"
                                title="کرتە بکە بۆ بینینی فۆتۆ و زانیاریەکانی چێک ئین"
                              >
                                {checkIn.time?.split(' ')[1]?.slice(0, 5) || '08:00'}
                              </button>
                            ) : null}

                            {/* Check-Out Link in RED */}
                            {checkOut ? (
                              <button
                                type="button"
                                onClick={() => setActiveLogModal(checkOut)}
                                className="text-rose-700 hover:text-rose-950 underline font-mono font-bold cursor-pointer transition-colors block text-center"
                                title="کرتە بکە بۆ بینینی فۆتۆ و زانیاریەکانی چێک ئاوت"
                              >
                                {checkOut.time?.split(' ')[1]?.slice(0, 5) || '16:30'}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-[10px]">---</span>
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
                  <span className="font-mono text-slate-900 text-xs font-black">{activeLogModal.time || activeLogModal.createdAt}</span>
                </div>

                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-700" /> دووری لە شوێنی کۆمپانیا:
                  </span>
                  <span className="font-mono text-blue-900 font-extrabold">{activeLogModal.distance || 'داخل کۆمپانیا (12m)'}</span>
                </div>

                <div className="flex justify-between pt-0.5">
                  <span className="text-slate-600 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-700" /> تێبینی / ئەرک:
                  </span>
                  <span className="text-slate-800 font-normal">
                    {(activeLogModal as any).notes || (activeLogModal as any).note || 'تۆماری ئامادەبوونی ئۆتۆماتیکی جی پی ئێس'}
                  </span>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex justify-between items-center p-2 bg-slate-100 border-t border-slate-300">
              {onDeleteLog && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی ئامادەبوون؟')) {
                      onDeleteLog(activeLogModal.id);
                      setActiveLogModal(null);
                    }
                  }}
                  className="btn-classic text-rose-800 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                  <span>سڕینەوەی تێپەڕە</span>
                </button>
              )}

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

    </div>
  );
}
