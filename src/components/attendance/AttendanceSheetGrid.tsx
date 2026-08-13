'use client';

import React, { useState } from 'react';
import type { AttendanceRecord, Employee } from '@/lib/types';
import { Camera, Calendar, Clock, MapPin, X, CheckCircle, User, Trash2 } from 'lucide-react';
import { format, getDaysInMonth, parseISO } from 'date-fns';

interface AttendanceSheetGridProps {
  attendanceLogs: AttendanceRecord[];
  employees: Employee[];
  onDeleteLog?: (logId: string) => void;
}

export function AttendanceSheetGrid({ attendanceLogs, employees, onDeleteLog }: AttendanceSheetGridProps) {
  // Selected Month (default '2026-08')
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  // Selected Employee filter ('all' or emp.id)
  const [selectedEmpFilter, setSelectedEmpFilter] = useState<string>('all');
  
  // Selected Log for Selfie Modal
  const [activeLogModal, setActiveLogModal] = useState<AttendanceRecord | null>(null);

  // Generate 1 to 31 Days for Selected Month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '08', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Filter employees for sheet
  const activeEmployees = employees.filter(e => e.status !== 'resigned' && e.isActive !== false);

  // Helper to get logs for a specific day and employee
  const getLogsForDayAndEmp = (dayNum: number, empId?: string) => {
    const formattedDay = dayNum.toString().padStart(2, '0');
    const targetDateStr = `${selectedMonth}-${formattedDay}`;

    return attendanceLogs.filter(log => {
      // Check if log date matches target date
      const logDate = log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '';
      const matchesDate = logDate === targetDateStr;

      if (!matchesDate) return false;

      // Check if log employee matches filter
      if (empId) {
        return log.employeeId === empId || log.userId === empId || log.userName === empId || log.name === empId;
      }
      if (selectedEmpFilter !== 'all') {
        return log.employeeId === selectedEmpFilter || log.name === selectedEmpFilter;
      }
      return true;
    });
  };

  return (
    <div className="space-y-3 font-sans select-none dir-rtl" dir="rtl">
      
      {/* SHEET CONTROLS HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300 text-xs font-bold">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-900" />
          <span className="text-slate-900">شیت ئەرشیفی مانگانەی ئامادەبوون (Monthly 31-Day Attendance Sheet):</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1">
            <label className="text-slate-700">مانگ:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-classic font-mono text-xs"
            />
          </div>

          {/* Employee Selector Filter */}
          <div className="flex items-center gap-1">
            <label className="text-slate-700">کارمەند:</label>
            <select
              value={selectedEmpFilter}
              onChange={(e) => setSelectedEmpFilter(e.target.value)}
              className="input-classic font-bold text-xs"
            >
              <option value="all">تێکڕای کارمەندان</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName3Part || emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 31-DAY SHEET GRID TABLE */}
      <div className="overflow-x-auto border border-slate-400 max-h-[500px] overflow-y-auto">
        <table className="table-classic w-full text-xs">
          <thead className="sticky top-0 bg-slate-300 border-b border-slate-400 z-10">
            <tr>
              <th className="w-24 text-center bg-slate-400 text-slate-950 font-black">ڕێکەوتی ڕۆژ (1 تا {totalDays})</th>
              <th>ناوی کارمەند</th>
              <th>کاتی هاتن (Check-In) + فۆتۆ</th>
              <th>کاتی دەرچوون (Check-Out) + فۆتۆ</th>
              <th>دووری لە کۆمپانیا</th>
              <th>دۆخی پشکنین</th>
            </tr>
          </thead>
          <tbody>
            {daysArray.map((dayNum) => {
              const dayStr = dayNum.toString().padStart(2, '0');
              const fullDateStr = `${selectedMonth}-${dayStr}`;
              const dayLogs = getLogsForDayAndEmp(dayNum);

              const checkInLogs = dayLogs.filter(l => l.type?.includes('Check In') || l.type?.includes('هاتن'));
              const checkOutLogs = dayLogs.filter(l => l.type?.includes('Check Out') || l.type?.includes('دەرچوون'));

              const hasLogs = dayLogs.length > 0;

              return (
                <tr key={dayNum} className={hasLogs ? 'bg-blue-50/40 hover:bg-blue-100/50' : 'hover:bg-slate-50'}>
                  
                  {/* Right Side Date Column (Day 1 to Day 31) */}
                  <td className="font-mono font-black text-center text-slate-900 bg-slate-100 border-l border-slate-400 text-[11px] whitespace-nowrap">
                    ڕۆژی {dayNum} <span className="text-[10px] text-slate-500 font-mono block">({fullDateStr})</span>
                  </td>

                  {/* Employee Name */}
                  <td className="font-bold text-slate-900">
                    {hasLogs ? (
                      Array.from(new Set(dayLogs.map(l => l.name || l.userName))).join(', ')
                    ) : (
                      <span className="text-slate-400 text-[10px] font-normal">دیارینەکراوە</span>
                    )}
                  </td>

                  {/* Check-In Timestamp Buttons (Clickable to open Selfie Modal) */}
                  <td>
                    {checkInLogs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {checkInLogs.map(log => (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => setActiveLogModal(log)}
                            className="btn-classic-primary text-[10px] py-0.5 px-2 flex items-center gap-1 font-mono cursor-pointer active:scale-95 shadow-sm"
                            title="کرتە بکە بۆ بینینی فۆتۆ سێلفی ئامادەبوون"
                          >
                            <Camera className="w-3 h-3 text-amber-300" />
                            <span>📥 {log.time?.split(' ')[1] || log.time || 'Check-In'}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">---</span>
                    )}
                  </td>

                  {/* Check-Out Timestamp Buttons (Clickable to open Selfie Modal) */}
                  <td>
                    {checkOutLogs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {checkOutLogs.map(log => (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => setActiveLogModal(log)}
                            className="btn-classic-danger text-[10px] py-0.5 px-2 flex items-center gap-1 font-mono cursor-pointer active:scale-95 shadow-sm"
                            title="کرتە بکە بۆ بینینی فۆتۆ سێلفی ئامادەبوون"
                          >
                            <Camera className="w-3 h-3 text-white" />
                            <span>📤 {log.time?.split(' ')[1] || log.time || 'Check-Out'}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">---</span>
                    )}
                  </td>

                  {/* Geofence Distance */}
                  <td className="font-mono text-[11px] text-blue-900 font-bold">
                    {hasLogs ? (
                      dayLogs.map(l => l.distance || 'داخل کۆمپانیا').join(' | ')
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px]">---</span>
                    )}
                  </td>

                  {/* Verified Badge */}
                  <td>
                    {hasLogs ? (
                      <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-950 font-bold border border-emerald-400 text-[10px] flex items-center w-fit gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-800" />
                        <span>تۆمارکراوە</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">نەکراوە</span>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="grand-total-row">
              <td colSpan={2}>کۆی لۆگەکانی تۆمارکراو لەم مانگەدا:</td>
              <td colSpan={4} className="font-mono text-amber-300">
                {attendanceLogs.filter(l => (l.time || '').startsWith(selectedMonth)).length} Record(s) Logged
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 🖼️ HIGH-RES SELFIE PHOTO VERIFICATION MODAL WINDOW */}
      {activeLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 max-w-sm w-full shadow-2xl p-1 text-slate-900 space-y-3">
            
            {/* Win32 Modal Title Bar */}
            <div className="bg-blue-900 text-white px-2 py-1 text-xs font-bold flex justify-between items-center border-b border-blue-950">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-amber-300" />
                <span>فۆتۆ سێلفی ئامادەبوونی: {activeLogModal.name || activeLogModal.userName}</span>
              </span>
              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="w-4 h-4 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Photo & Details Body */}
            <div className="p-3 space-y-3 bg-white border border-slate-300 text-xs">
              {/* Photo Display */}
              <div className="border-2 border-slate-400 p-1 bg-slate-100 flex justify-center">
                {activeLogModal.selfieUrl || activeLogModal.checkInSelfie || activeLogModal.checkOutSelfie ? (
                  <img
                    src={activeLogModal.selfieUrl || activeLogModal.checkInSelfie || activeLogModal.checkOutSelfie}
                    alt="Selfie Attendance"
                    className="w-full h-56 object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-full h-48 bg-slate-200 flex flex-col items-center justify-center text-slate-500 space-y-1">
                    <Camera className="w-8 h-8 text-slate-400" />
                    <span>فۆتۆ ئامادە نییە</span>
                  </div>
                )}
              </div>

              {/* Attendance Details Table */}
              <div className="space-y-1 font-bold text-slate-900">
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">ناوی کارمەند:</span>
                  <span className="text-blue-900 font-black">{activeLogModal.name || activeLogModal.userName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">جۆری تۆمار:</span>
                  <span className={`px-1.5 py-0.2 text-[10px] border font-mono ${activeLogModal.type?.includes('In') || activeLogModal.type?.includes('هاتن') ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'}`}>
                    {activeLogModal.type}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1">
                  <span className="text-slate-600">کاتی دروست:</span>
                  <span className="font-mono text-slate-900">{activeLogModal.time || activeLogModal.createdAt}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-600">دووری لە کۆمپانیا:</span>
                  <span className="font-mono text-blue-900">{activeLogModal.distance || 'داخل کۆمپانیا (12m)'}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center p-2 bg-slate-100 border-t border-slate-300">
              {onDeleteLog && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم فۆتۆ لۆگە؟')) {
                      onDeleteLog(activeLogModal.id);
                      setActiveLogModal(null);
                    }
                  }}
                  className="btn-classic text-rose-800 text-xs"
                >
                  <Trash2 className="w-3 h-3 text-rose-700" />
                  <span>سڕینەوەی لۆگ</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveLogModal(null)}
                className="btn-classic-primary text-xs px-4 py-1"
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
