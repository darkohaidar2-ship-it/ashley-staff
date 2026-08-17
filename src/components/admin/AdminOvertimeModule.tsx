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
import { exportToPDF, exportToCSV } from '@/lib/export-utils';

interface AdminOvertimeModuleProps {
  employees: Employee[];
}

export function AdminOvertimeModule({ employees }: AdminOvertimeModuleProps) {
  const { overtime, setOvertime } = useAppContext();
  
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

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
    const summaryMap: Record<string, { empId: string; name: string; totalHours: number; totalAmount: number; count: number; records: any[] }> = {};
    
    monthlyRecords.forEach((r: any) => {
      const id = r.employeeId || r.userId || 'unknown';
      const emp = employees.find(e => e.id === id);
      const name = r.employeeName || emp?.fullName3Part || emp?.name || 'کارمەند';
      
      if (!summaryMap[id]) {
        summaryMap[id] = { empId: id, name, totalHours: 0, totalAmount: 0, count: 0, records: [] };
      }
      summaryMap[id].totalHours += Number(r.hours || 0);
      summaryMap[id].totalAmount += Number(r.totalAmount || r.pay || (Number(r.hours || 0) * (Number(r.rate) || 5000)));
      summaryMap[id].count += 1;
      summaryMap[id].records.push(r);
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

  // PDF & CSV Export Handlers
  const handleExportPDF = () => {
    if (viewMode === 'daily') {
      const cols = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' as const },
        { header: 'ژمارەی کاتژمێر', key: 'hours', align: 'center' as const },
        { header: 'بڕی شایستەی پارە (IQD)', key: 'amount', align: 'center' as const },
        { header: 'تێبینی / هۆکار', key: 'note', align: 'right' as const },
      ];
      const data = dailyRecords.map((r: any) => ({
        name: r.employeeName || employees.find(e => e.id === r.employeeId)?.fullName3Part || 'کارمەند',
        hours: `${r.hours} کاتژمێر`,
        amount: `${(r.totalAmount || (r.hours * (r.rate || 5000))).toLocaleString()} IQD`,
        note: r.note || r.notes || '-',
      }));
      exportToPDF({
        title: 'ڕاپۆرتی کاتی زیادەی ڕۆژانەی کارمەندان (Daily Overtime Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: selectedDate,
        columns: cols,
        data,
        fileName: `Ashley_Daily_Overtime_${selectedDate}`,
        summaryCards: [
          { label: 'کۆی کارمەندان', value: `${dailyRecords.length} کارمەند` },
          { label: 'کۆی کاتژمێر', value: `${dailyRecords.reduce((s: number, c: any) => s + (c.hours || 0), 0)} کاتژمێر`, color: '#1e40af' },
          { label: 'کۆی پارەی شایستە', value: `${dailyRecords.reduce((s: number, c: any) => s + (c.totalAmount || (c.hours * 5000)), 0).toLocaleString()} IQD`, color: '#047857' },
        ],
      });
    } else {
      const cols = [
        { header: 'ناوی کارمەند', key: 'name', align: 'right' as const },
        { header: 'ژمارەی ڕۆژەکان', key: 'count', align: 'center' as const },
        { header: 'کۆی کاتژمێر', key: 'hours', align: 'center' as const },
        { header: 'کۆی شایستەی پارە (IQD)', key: 'amount', align: 'center' as const },
      ];
      const data = monthlySummary.map(s => ({
        name: s.name,
        count: `${s.count} جار`,
        hours: `${s.totalHours.toFixed(1)} کاتژمێر`,
        amount: `${s.totalAmount.toLocaleString()} IQD`,
      }));
      exportToPDF({
        title: 'ڕاپۆرتی کاتی زیادەی مانگانەی کارمەندان (Monthly Overtime Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Monthly_Overtime_${selectedMonth}`,
        summaryCards: [
          { label: 'کۆی کاتژمێری مانگ', value: `${totalMonthlyHours.toFixed(1)} کاتژمێر`, color: '#1e40af' },
          { label: 'کۆی بڕی پارەی ئیزافە', value: `${totalMonthlyCost.toLocaleString()} IQD`, color: '#047857' },
          { label: 'کارمەندانی بەشداربوو', value: `${monthlySummary.length} کارمەند` },
        ],
      });
    }
  };

  const handleExportCSV = () => {
    if (viewMode === 'daily') {
      const cols = [
        { header: 'ناوی کارمەند', key: 'name' },
        { header: 'ژمارەی کاتژمێر', key: 'hours' },
        { header: 'بڕی شایستەی پارە (IQD)', key: 'amount' },
        { header: 'تێبینی', key: 'note' },
      ];
      const data = dailyRecords.map((r: any) => ({
        name: r.employeeName || employees.find(e => e.id === r.employeeId)?.fullName3Part || 'کارمەند',
        hours: `${r.hours}`,
        amount: `${r.totalAmount || (r.hours * (r.rate || 5000))}`,
        note: r.note || r.notes || '-',
      }));
      exportToCSV(cols, data, `Ashley_Daily_Overtime_${selectedDate}`);
    } else {
      const cols = [
        { header: 'ناوی کارمەند', key: 'name' },
        { header: 'ژمارەی ڕۆژەکان', key: 'count' },
        { header: 'کۆی کاتژمێر', key: 'hours' },
        { header: 'کۆی شایستەی پارە (IQD)', key: 'amount' },
      ];
      const data = monthlySummary.map(s => ({
        name: s.name,
        count: `${s.count}`,
        hours: `${s.totalHours.toFixed(1)}`,
        amount: `${s.totalAmount}`,
      }));
      exportToCSV(cols, data, `Ashley_Monthly_Overtime_${selectedMonth}`);
    }
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-orange-950 via-orange-900 to-amber-900 text-white rounded-xl shadow-md border border-orange-700">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-orange-800/80 rounded-lg border border-orange-600 shadow-inner">
            <Clock className="w-5 h-5 text-orange-200" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-orange-50">
              لیستی کاتی زیادەی کارمەندان (Overtime Master Hub)
            </h2>
            <p className="text-[11px] text-orange-200/90 font-medium">
              تۆمارکردن، بەدواداچوونی ڕۆژانە و مانگانە لەگەڵ کۆکردنەوەی وردەکارییەکان و تێبینی
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-black bg-orange-500/30 text-orange-100 border border-orange-400 px-3 py-1 rounded-full">
          OVERTIME SYSTEM
        </span>
      </div>

      {/* 🛠️ TOP CONTROLS BAR */}
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
            <span>📅 تۆمار و ئاماری ڕۆژانە</span>
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
            <span>📊 کۆی گشتی مانگانە (لەگەڵ وردەکارییەکان)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="text-slate-600 text-xs font-bold">هەڵبژاردنی کات:</span>
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
            <span>📄 PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-classic text-xs font-black flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>📊 CSV</span>
          </button>
        </div>
      </div>

      {/* 📊 SUMMARY KPI BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2.5 text-center bg-blue-50/80 border-2 border-blue-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-blue-900 block font-bold">کۆی کاتژمێری مانگ</span>
          <p className="text-base font-black text-blue-950 font-mono mt-0.5">{totalMonthlyHours.toFixed(1)} کاتژمێر</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-emerald-50/80 border-2 border-emerald-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی بڕی پارەی ئیزافە</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">{totalMonthlyCost.toLocaleString()} IQD</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-amber-50/80 border-2 border-amber-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-amber-900 block font-bold">تۆمارکراوەکانی ئەمڕۆ</span>
          <p className="text-base font-black text-amber-950 font-mono mt-0.5">{dailyRecords.length} کارمەند</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-purple-50/80 border-2 border-purple-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-purple-900 block font-bold">نرخی بنەڕەتی کاتژمێر</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">5,000 IQD/hr</p>
        </div>
      </div>

      {/* 📝 DISTINCT FORM / DATA ENTRY PANEL (WARM COLOR CODED) */}
      <form onSubmit={handleAddOvertime} className="p-3.5 bg-gradient-to-r from-amber-50/90 via-orange-50/80 to-amber-50/90 border-2 border-amber-300/90 rounded-xl shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-amber-300/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-amber-500 text-white rounded-md">
              <Plus className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-xs font-black text-amber-950">
              فۆرمی تۆمارکردنی کاتی زیادەی نوێ (New Overtime Entry Form)
            </h3>
          </div>
          <span className="text-[10px] bg-amber-200/80 text-amber-900 border border-amber-400 px-2 py-0.5 rounded font-mono font-bold">
            بەرواری هەڵبژێردراو: {selectedDate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">کارمەند:</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="input-classic w-full font-bold bg-white border-amber-300 focus:border-amber-500"
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
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="بۆ نموونە: 2.5"
              className="input-classic w-full font-mono font-bold bg-white border-amber-300 focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">نرخی کاتژمێر (IQD):</label>
            <input
              type="number"
              step="500"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="input-classic w-full font-mono font-bold bg-white border-amber-300 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-amber-950 mb-1 text-[11px] font-bold">تێبینی و هۆکار (Notes):</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ئەرکی زیادە، داگرتنی بار، پاککردنەوە..."
              className="input-classic w-full font-bold bg-white border-amber-300 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="btn-classic text-xs font-black flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white border-amber-800 shadow-sm cursor-pointer px-4 py-1.5 rounded">
            <Plus className="w-4 h-4" />
            <span>تۆمارکردنی ئەم ئیزافەیە</span>
          </button>
        </div>
      </form>

      {/* 📊 ANALYTICS & DATA TABLE CONTAINER */}
      <div className="border-2 border-slate-300 bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-slate-800 text-white p-2 px-3 flex items-center justify-between">
          <h3 className="text-xs font-black flex items-center gap-2">
            <span>📋 {viewMode === 'daily' ? `خشتەی کاتی زیادەی ڕۆژی (${selectedDate})` : `خشتەی کۆی گشتی مانگانە (${selectedMonth}) - کلیک بکە بۆ بینینی هەموو ڕۆژەکان و تێبینی`}</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-300">
            {viewMode === 'daily' ? `${dailyRecords.length} تۆمار` : `${monthlySummary.length} کارمەند`}
          </span>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'daily' ? (
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کاتژمێر</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">بڕی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 border-l border-slate-300">تێبینی / هۆکار</th>
                  <th className="p-2.5 text-center w-16">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ کاتێکی زیادە بۆ ئەم بەروارە ({selectedDate}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((rec: any, idx: number) => (
                    <tr key={rec.id} className="hover:bg-amber-50/40 font-bold transition-all">
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{rec.employeeName}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-blue-900 font-black">
                        {rec.hours} کاتژمێر
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-900 font-black">
                        {(rec.totalAmount || (rec.hours * (rec.rate || 5000))).toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-700 font-medium">{rec.note || '-'}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                          title="سڕینەوە"
                        >
                          <Trash2 className="w-4 h-4" />
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
                <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                  <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                  <th className="p-2.5 border-l border-slate-300">ناوی کارمەند</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">ژمارەی ڕۆژەکان</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کۆی کاتژمێر</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">کۆی شایستەی پارە (IQD)</th>
                  <th className="p-2.5 text-center">وردەکاری ڕۆژانە و تێبینیەکان (Drilldown)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {monthlySummary.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ داتایەکی ئیزافە بۆ مانگی ({selectedMonth}) بوونی نییە.
                    </td>
                  </tr>
                ) : (
                  monthlySummary.map((sum, idx) => {
                    const isExpanded = expandedEmpId === sum.empId;
                    return (
                      <React.Fragment key={sum.empId}>
                        <tr 
                          onClick={() => setExpandedEmpId(isExpanded ? null : sum.empId)}
                          className={`cursor-pointer transition-all ${isExpanded ? 'bg-orange-100/70' : 'hover:bg-slate-50'}`}
                        >
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{sum.name}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{sum.count} ڕۆژ</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-blue-900 font-black">{sum.totalHours.toFixed(1)} کاتژمێر</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-900 font-black">{sum.totalAmount.toLocaleString()} IQD</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border transition-all ${
                              isExpanded 
                                ? 'bg-orange-800 text-white border-orange-950 shadow-sm' 
                                : 'bg-orange-50 text-orange-900 border-orange-300 hover:bg-orange-100'
                            }`}>
                              {isExpanded ? '▲ داخستنی وردەکاری' : '▼ هەموو ڕۆژەکان و تێبینیەکان'}
                            </span>
                          </td>
                        </tr>

                        {/* 🔍 EXPANDED DAILY RECORDS FOR THIS EMPLOYEE */}
                        {isExpanded && (
                          <tr className="bg-orange-50/50 border-y-2 border-orange-300">
                            <td colSpan={6} className="p-3">
                              <div className="bg-white border border-orange-200 rounded-lg p-3 shadow-inner space-y-2">
                                <h4 className="text-[11px] font-black text-orange-950 flex items-center gap-1.5 border-b border-orange-100 pb-1">
                                  <span>📅 وردەکاری ڕۆژانەی ئیزافەی ({sum.name}) بۆ مانگی ({selectedMonth}):</span>
                                </h4>
                                <table className="w-full text-right text-xs border border-slate-200">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-800 font-black text-[11px]">
                                      <th className="p-1.5 border-l border-slate-200 text-center">بەروار</th>
                                      <th className="p-1.5 border-l border-slate-200 text-center">کاتژمێر</th>
                                      <th className="p-1.5 border-l border-slate-200 text-center">نرخ/کاتژمێر</th>
                                      <th className="p-1.5 border-l border-slate-200 text-center">کۆی پارە</th>
                                      <th className="p-1.5 border-l border-slate-200">تێبینی و هۆکار</th>
                                      <th className="p-1.5 text-center w-12">سڕینەوە</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {sum.records.map((r: any) => (
                                      <tr key={r.id} className="hover:bg-orange-50/30">
                                        <td className="p-1.5 border-l border-slate-200 text-center font-mono font-bold text-slate-900">{r.date}</td>
                                        <td className="p-1.5 border-l border-slate-200 text-center font-mono font-black text-blue-900">{r.hours} کاتژمێر</td>
                                        <td className="p-1.5 border-l border-slate-200 text-center font-mono text-slate-600">{(r.rate || 5000).toLocaleString()} IQD</td>
                                        <td className="p-1.5 border-l border-slate-200 text-center font-mono font-black text-emerald-900">
                                          {(r.totalAmount || (r.hours * (r.rate || 5000))).toLocaleString()} IQD
                                        </td>
                                        <td className="p-1.5 border-l border-slate-200 text-slate-800">{r.note || r.notes || '-'}</td>
                                        <td className="p-1.5 text-center">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDelete(r.id);
                                            }}
                                            className="text-rose-700 hover:text-rose-950 p-0.5 rounded hover:bg-rose-50"
                                            title="سڕینەوە"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
