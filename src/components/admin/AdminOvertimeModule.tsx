'use client';

import React, { useState, useMemo } from 'react';
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
  Lock, 
  Unlock 
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminOvertimeModuleProps {
  employees: Employee[];
}

export function AdminOvertimeModule({ employees }: AdminOvertimeModuleProps) {
  const { overtime, setOvertime } = useAppContext();
  
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [hours, setHours] = useState<string>('');
  const [rate, setRate] = useState<string>('5000');
  const [note, setNote] = useState<string>('');

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Daily records
  const dailyRecords = useMemo(() => {
    return (overtime || []).filter((r: any) => r.date === selectedDate);
  }, [overtime, selectedDate]);

  // Monthly records
  const monthlyRecords = useMemo(() => {
    return (overtime || []).filter((r: any) => r.date && r.date.startsWith(selectedMonth));
  }, [overtime, selectedMonth]);

  // Monthly summary per employee
  const monthlySummary = useMemo(() => {
    const summaryMap: Record<string, { empId: string; name: string; totalHours: number; totalAmount: number; count: number }> = {};
    
    monthlyRecords.forEach((r: any) => {
      const id = r.employeeId || r.userId || 'unknown';
      const emp = employees.find(e => e.id === id);
      const name = r.employeeName || emp?.fullName3Part || emp?.name || 'کارمەند';
      
      if (!summaryMap[id]) {
        summaryMap[id] = { empId: id, name, totalHours: 0, totalAmount: 0, count: 0 };
      }
      summaryMap[id].totalHours += Number(r.hours || 0);
      summaryMap[id].totalAmount += Number(r.totalAmount || r.pay || (Number(r.hours || 0) * (Number(r.rate) || 5000)));
      summaryMap[id].count += 1;
    });

    return Object.values(summaryMap);
  }, [monthlyRecords, employees]);

  const handleAddOvertime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە');
    if (!hours || parseFloat(hours) <= 0) return alert('تکایە کاتژمێری دروست بنووسە');

    const emp = employees.find(e => e.id === selectedEmpId);
    const parsedHours = parseFloat(hours);
    const parsedRate = parseFloat(rate) || 5000;

    const newRecord = {
      id: 'ot_' + Date.now().toString(),
      employeeId: selectedEmpId,
      employeeName: emp?.fullName3Part || emp?.name || 'کارمەند',
      date: selectedDate,
      hours: parsedHours,
      rate: parsedRate,
      totalAmount: parsedHours * parsedRate,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    setOvertime((prev: any) => [newRecord, ...(prev || [])]);
    setHours('');
    setNote('');
    alert(`🎉 کاتی زیادە (${parsedHours} کاتژمێر) بۆ (${newRecord.employeeName}) تۆمارکرا!`);
  };

  const handleDelete = (id: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کاتە زیادەیە؟')) {
      setOvertime((prev: any) => (prev || []).filter((r: any) => r.id !== id));
    }
  };

  const totalMonthlyHours = monthlyRecords.reduce((acc: number, curr: any) => acc + Number(curr.hours || 0), 0);
  const totalMonthlyCost = monthlyRecords.reduce((acc: number, curr: any) => acc + Number(curr.totalAmount || (Number(curr.hours || 0) * 5000)), 0);

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300 rounded">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('daily')}
            className={`btn-classic ${viewMode === 'daily' ? 'bg-blue-900 text-white font-black' : ''}`}
          >
            📅 تۆمار و ئاماری ڕۆژانە
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`btn-classic ${viewMode === 'monthly' ? 'bg-blue-900 text-white font-black' : ''}`}
          >
            📊 کۆی گشتی مانگانە
          </button>
        </div>

        <div className="flex items-center gap-2 font-mono">
          {viewMode === 'daily' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-classic font-bold"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-classic font-bold"
            />
          )}
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2 text-center bg-blue-50 border-blue-200">
          <span className="text-[10px] text-blue-900 block font-bold">کۆی کاتژمێری مانگ</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{totalMonthlyHours.toFixed(1)} کاتژمێر</p>
        </div>
        <div className="panel-classic p-2 text-center bg-emerald-50 border-emerald-200">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی بڕی پارەی ئیزافە</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">{totalMonthlyCost.toLocaleString()} IQD</p>
        </div>
        <div className="panel-classic p-2 text-center bg-amber-50 border-amber-200">
          <span className="text-[10px] text-amber-900 block font-bold">تۆمارکراوەکانی ئەمڕۆ</span>
          <p className="text-base font-black text-amber-950 font-mono mt-0.5">{dailyRecords.length} کارمەند</p>
        </div>
        <div className="panel-classic p-2 text-center bg-purple-50 border-purple-200">
          <span className="text-[10px] text-purple-900 block font-bold">نرخی کاتژمێر (Rate)</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">5,000 IQD/hr</p>
        </div>
      </div>

      {/* Add Overtime Form (Classic Windows Frame) */}
      <form onSubmit={handleAddOvertime} className="panel-classic p-3 bg-white space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-blue-900" />
            <span>تۆمارکردنی کاتی زیادەی نوێ بۆ کارمەند (Add Overtime Record)</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">بەروار: {selectedDate}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-slate-700 mb-1 text-[11px]">کارمەند:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="input-classic w-full font-bold"
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
            <label className="block text-slate-700 mb-1 text-[11px]">ژمارەی کاتژمێر (Hours):</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="بۆ نموونە: 2.5"
              className="input-classic w-full font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 text-[11px]">نرخی کاتژمێر (IQD):</label>
            <input
              type="number"
              step="500"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="input-classic w-full font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-700 mb-1 text-[11px]">تێبینی / هۆکار:</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ئەرکی زیادە، پاککردنەوە..."
              className="input-classic w-full font-bold"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-classic-primary text-xs flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            <span>تۆمارکردنی ئیزافە</span>
          </button>
        </div>
      </form>

      {/* Table: Daily or Monthly */}
      <div className="border border-slate-400 bg-white rounded overflow-x-auto shadow-sm">
        {viewMode === 'daily' ? (
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-200 border-b border-slate-400 text-slate-900 font-black">
                <th className="p-2 border-l border-slate-300 w-10 text-center">#</th>
                <th className="p-2 border-l border-slate-300">ناوی کارمەند</th>
                <th className="p-2 border-l border-slate-300 text-center">کاتژمێر</th>
                <th className="p-2 border-l border-slate-300 text-center">بڕی پارە (IQD)</th>
                <th className="p-2 border-l border-slate-300">تێبینی</th>
                <th className="p-2 text-center w-16">کردار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {dailyRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 font-bold">
                    هیچ کاتێکی زیادە بۆ ئەم بەروارە ({selectedDate}) تۆمار نەکراوە.
                  </td>
                </tr>
              ) : (
                dailyRecords.map((rec: any, idx: number) => (
                  <tr key={rec.id} className="hover:bg-slate-50 font-bold">
                    <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-2 border-l border-slate-200 text-slate-900 font-black">{rec.employeeName}</td>
                    <td className="p-2 border-l border-slate-200 text-center font-mono text-blue-900 font-black">
                      {rec.hours} کاتژمێر
                    </td>
                    <td className="p-2 border-l border-slate-200 text-center font-mono text-emerald-900 font-black">
                      {(rec.totalAmount || (rec.hours * (rec.rate || 5000))).toLocaleString()} IQD
                    </td>
                    <td className="p-2 border-l border-slate-200 text-slate-700">{rec.note || '-'}</td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-50 rounded"
                        title="سڕینەوە"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-200 border-b border-slate-400 text-slate-900 font-black">
                <th className="p-2 border-l border-slate-300 w-10 text-center">#</th>
                <th className="p-2 border-l border-slate-300">ناوی کارمەند</th>
                <th className="p-2 border-l border-slate-300 text-center">ژمارەی ڕۆژەکان</th>
                <th className="p-2 border-l border-slate-300 text-center">کۆی کاتژمێر</th>
                <th className="p-2 text-center">کۆی شایستەی پارە (IQD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 font-bold">
              {monthlySummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 font-bold">
                    هیچ داتایەکی ئیزافە بۆ مانگی ({selectedMonth}) بوونی نییە.
                  </td>
                </tr>
              ) : (
                monthlySummary.map((sum, idx) => (
                  <tr key={sum.empId} className="hover:bg-slate-50">
                    <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-2 border-l border-slate-200 text-slate-900 font-black">{sum.name}</td>
                    <td className="p-2 border-l border-slate-200 text-center font-mono">{sum.count} جار</td>
                    <td className="p-2 border-l border-slate-200 text-center font-mono text-blue-900 font-black">{sum.totalHours.toFixed(1)} کاتژمێر</td>
                    <td className="p-2 text-center font-mono text-emerald-900 font-black">{sum.totalAmount.toLocaleString()} IQD</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
