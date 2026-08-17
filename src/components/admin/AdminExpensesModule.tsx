'use client';

import React, { useState, useMemo } from 'react';
import type { Employee } from '@/lib/types';
import { useAppContext } from '@/context/app-provider';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Calendar, 
  FileSpreadsheet, 
  Printer, 
  TrendingDown, 
  TrendingUp, 
  Gift, 
  Banknote,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface AdminExpensesModuleProps {
  employees: Employee[];
}

export function AdminExpensesModule({ employees }: AdminExpensesModuleProps) {
  const { expenses, setExpenses, bonuses, setBonuses, withdrawals, setWithdrawals } = useAppContext();

  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState<'expenses' | 'bonuses' | 'withdrawals'>('expenses');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form States
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('مەسروفاتی گشتی');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Filtered by selected month
  const monthlyExpenses = useMemo(() => {
    return (expenses || []).filter((e: any) => e.date && e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const monthlyBonuses = useMemo(() => {
    return (bonuses || []).filter((b: any) => b.date && b.date.startsWith(selectedMonth));
  }, [bonuses, selectedMonth]);

  const monthlyWithdrawals = useMemo(() => {
    return (withdrawals || []).filter((w: any) => w.date && w.date.startsWith(selectedMonth));
  }, [withdrawals, selectedMonth]);

  // Totals
  const totalExp = monthlyExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const totalBon = monthlyBonuses.reduce((sum: number, b: any) => sum + Number(b.totalAmount || b.amount || 0), 0);
  const totalWth = monthlyWithdrawals.reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
  const grandTotal = totalExp + totalBon + totalWth;

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return alert('تکایە بڕی پارەی دروست بنووسە');

    const numAmount = parseFloat(amount);
    const emp = employees.find(e => e.id === selectedEmpId);
    const empName = emp?.fullName3Part || emp?.name || 'کارمەند';

    if (activeTab === 'expenses') {
      const newExp = {
        id: 'exp_' + Date.now(),
        title: title.trim() || category,
        amount: numAmount,
        category,
        date,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev: any) => [newExp, ...(prev || [])]);
      alert(`🎉 مەسروفاتی (${newExp.title}) بە بڕی ${numAmount.toLocaleString()} IQD تۆمارکرا!`);
    } else if (activeTab === 'bonuses') {
      if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە بۆ پاداشت');
      const newBonus = {
        id: 'bon_' + Date.now(),
        employeeId: selectedEmpId,
        employeeName: empName,
        amount: numAmount,
        totalAmount: numAmount,
        date,
        reason: note.trim() || 'پاداشتی دەستخۆشی',
        createdAt: new Date().toISOString(),
      };
      setBonuses((prev: any) => [newBonus, ...(prev || [])]);
      alert(`🎉 پاداشت بۆ (${empName}) بە بڕی ${numAmount.toLocaleString()} IQD تۆمارکرا!`);
    } else if (activeTab === 'withdrawals') {
      if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە بۆ ڕاکێشانی پارە');
      const newWth = {
        id: 'wth_' + Date.now(),
        employeeId: selectedEmpId,
        employeeName: empName,
        amount: numAmount,
        date,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      setWithdrawals((prev: any) => [newWth, ...(prev || [])]);
      alert(`🎉 ڕاکێشانی پارە بۆ (${empName}) تۆمارکرا!`);
    }

    setTitle('');
    setAmount('');
    setNote('');
  };

  const handleDeleteRecord = (id: string, type: 'expenses' | 'bonuses' | 'withdrawals') => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوە؟')) return;
    if (type === 'expenses') setExpenses((prev: any) => (prev || []).filter((e: any) => e.id !== id));
    if (type === 'bonuses') setBonuses((prev: any) => (prev || []).filter((b: any) => b.id !== id));
    if (type === 'withdrawals') setWithdrawals((prev: any) => (prev || []).filter((w: any) => w.id !== id));
  };

  const handleExportPDF = () => {
    if (activeTab === 'expenses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناونیشانی مەسروفات', key: 'title', align: 'right' },
        { header: 'پۆلێن (Category)', key: 'category', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی', key: 'note', align: 'right' },
      ];
      const data = monthlyExpenses.map((e: any) => ({
        title: e.title || e.expenseType || 'مەسروفات',
        category: e.category || e.expenseSubType || 'گشتی',
        date: e.date,
        amount: `${Number(e.amount || 0).toLocaleString()} IQD`,
        note: e.note || e.notes || '-',
      }));
      exportToPDF({
        title: 'ڕاپۆرتی مەسروفات و خەرجییەکانی کارگە (Ashley Expenses Ledger)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Expenses_${selectedMonth}`,
        summaryCards: [
          { label: 'کۆی خەرجی مەسروفات', value: `${totalExp.toLocaleString()} IQD`, color: '#be123c' },
          { label: 'ژمارەی پسوولەکان', value: `${monthlyExpenses.length} دانە` },
        ],
      });
    } else if (activeTab === 'bonuses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'بڕی پاداشت (IQD)', key: 'amount', align: 'center' },
        { header: 'هۆکار و تێبینی', key: 'reason', align: 'right' },
      ];
      const data = monthlyBonuses.map((b: any) => ({
        empName: b.employeeName || employees.find(e => e.id === b.employeeId)?.fullName3Part || 'کارمەند',
        date: b.date,
        amount: `${Number(b.totalAmount || b.amount || 0).toLocaleString()} IQD`,
        reason: b.reason || b.note || b.notes || '-',
      }));
      exportToPDF({
        title: 'ڕاپۆرتی پاداشت و بەخششی کارمەندان (Employee Bonuses Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Bonuses_${selectedMonth}`,
        summaryCards: [
          { label: 'کۆی پاداشتەکان', value: `${totalBon.toLocaleString()} IQD`, color: '#047857' },
          { label: 'کارمەندانی وەرگر', value: `${monthlyBonuses.length} کەس` },
        ],
      });
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'بڕی پارەی ڕاکێشراو (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی', key: 'note', align: 'right' },
      ];
      const data = monthlyWithdrawals.map((w: any) => ({
        empName: w.employeeName || employees.find(e => e.id === w.employeeId)?.fullName3Part || 'کارمەند',
        date: w.date,
        amount: `${Number(w.amount || 0).toLocaleString()} IQD`,
        note: w.note || w.notes || '-',
      }));
      exportToPDF({
        title: 'ڕاپۆرتی ڕاکێشانی پێشینەی کارمەندان (Cash Withdrawals Report)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Withdrawals_${selectedMonth}`,
        summaryCards: [
          { label: 'کۆی ڕاکێشانی پێشینە', value: `${totalWth.toLocaleString()} IQD`, color: '#b45309' },
          { label: 'تۆمارەکان', value: `${monthlyWithdrawals.length} جار` },
        ],
      });
    }
  };

  const handleExportCSV = () => {
    if (activeTab === 'expenses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناونیشانی مەسروفات', key: 'title' },
        { header: 'پۆلێن', key: 'category' },
        { header: 'بەروار', key: 'date' },
        { header: 'بڕی پارە (IQD)', key: 'amount' },
        { header: 'تێبینی', key: 'note' },
      ];
      const data = monthlyExpenses.map((e: any) => ({
        title: e.title || e.expenseType || 'مەسروفات',
        category: e.category || e.expenseSubType || 'گشتی',
        date: e.date,
        amount: e.amount || 0,
        note: e.note || e.notes || '-',
      }));
      exportToCSV(cols, data, `Ashley_Expenses_${selectedMonth}`);
    } else if (activeTab === 'bonuses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName' },
        { header: 'بەروار', key: 'date' },
        { header: 'بڕی پاداشت (IQD)', key: 'amount' },
        { header: 'هۆکار', key: 'reason' },
      ];
      const data = monthlyBonuses.map((b: any) => ({
        empName: b.employeeName || employees.find(e => e.id === b.employeeId)?.fullName3Part || 'کارمەند',
        date: b.date,
        amount: b.totalAmount || b.amount || 0,
        reason: b.reason || b.note || b.notes || '-',
      }));
      exportToCSV(cols, data, `Ashley_Bonuses_${selectedMonth}`);
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName' },
        { header: 'بەروار', key: 'date' },
        { header: 'بڕی پارە (IQD)', key: 'amount' },
        { header: 'تێبینی', key: 'note' },
      ];
      const data = monthlyWithdrawals.map((w: any) => ({
        empName: w.employeeName || employees.find(e => e.id === w.employeeId)?.fullName3Part || 'کارمەند',
        date: w.date,
        amount: w.amount || 0,
        note: w.note || w.notes || '-',
      }));
      exportToCSV(cols, data, `Ashley_Withdrawals_${selectedMonth}`);
    }
  };

  return (
    <div className="space-y-4 text-xs font-bold text-slate-900 dir-rtl" dir="rtl">
      
      {/* 🏷️ LARGE PROMINENT SECTION TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white rounded-xl shadow-md border border-emerald-700">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-800/80 rounded-lg border border-emerald-600 shadow-inner">
            <DollarSign className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-wide text-emerald-50">
              لیستی مەسروفات، پاداشت و پێشینەی دارایی (Expenses & Finance Ledger)
            </h2>
            <p className="text-[11px] text-emerald-200/90 font-medium">
              تۆمارکردنی پسوولەکانی کارگە، بەخششی کارمەندان و ڕاکێشانی پێشینە لەگەڵ ئاماری گشتی
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-black bg-rose-600 text-white border-2 border-white px-3 py-1 rounded-full shadow-md animate-pulse">
            🔴 بەم زووانە (Coming Soon)
          </span>
        </div>
      </div>

      {/* 🛠️ TOP CONTROLS & TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 border-2 border-slate-300 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              activeTab === 'expenses' 
                ? 'bg-rose-800 text-white shadow-md border border-rose-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>💸 مەسروفاتی کارگە ({monthlyExpenses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bonuses')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              activeTab === 'bonuses' 
                ? 'bg-emerald-800 text-white shadow-md border border-emerald-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>🎁 پاداشت و بەخشش ({monthlyBonuses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer font-black ${
              activeTab === 'withdrawals' 
                ? 'bg-amber-800 text-white shadow-md border border-amber-950 scale-102' 
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>🏧 ڕاکێشانی پێشینە ({monthlyWithdrawals.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono">
          <span className="text-slate-600 font-bold text-xs">مانگ:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-classic font-bold bg-white"
          />

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

      {/* 📊 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2.5 text-center bg-rose-50/80 border-2 border-rose-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-rose-900 block font-bold">کۆی مەسروفات</span>
          <p className="text-base font-black text-rose-950 font-mono mt-0.5">{totalExp.toLocaleString()} IQD</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-emerald-50/80 border-2 border-emerald-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-emerald-900 block font-bold">کۆی پاداشتەکان</span>
          <p className="text-base font-black text-emerald-950 font-mono mt-0.5">{totalBon.toLocaleString()} IQD</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-amber-50/80 border-2 border-amber-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-amber-900 block font-bold">کۆی پێشینە و سەحب</span>
          <p className="text-base font-black text-amber-950 font-mono mt-0.5">{totalWth.toLocaleString()} IQD</p>
        </div>
        <div className="panel-classic p-2.5 text-center bg-purple-50/80 border-2 border-purple-200 shadow-sm rounded-xl">
          <span className="text-[10px] text-purple-900 block font-bold">کۆی گشتی خەرجی مانگ</span>
          <p className="text-base font-black text-purple-950 font-mono mt-0.5">{grandTotal.toLocaleString()} IQD</p>
        </div>
      </div>

      {/* 📝 DISTINCT FORM / DATA ENTRY PANEL (COLOR THEMED PER TAB) */}
      <form 
        onSubmit={handleAddRecord} 
        className={`p-3.5 border-2 rounded-xl shadow-md space-y-3 ${
          activeTab === 'expenses'
            ? 'bg-gradient-to-r from-rose-50/90 via-red-50/70 to-rose-50/90 border-rose-300'
            : activeTab === 'bonuses'
            ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border-emerald-300'
            : 'bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between border-b pb-2 border-slate-300/80">
          <div className="flex items-center gap-2">
            <span className={`p-1 text-white rounded-md ${
              activeTab === 'expenses' ? 'bg-rose-600' : activeTab === 'bonuses' ? 'bg-emerald-600' : 'bg-amber-600'
            }`}>
              <Plus className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-xs font-black text-slate-900">
              {activeTab === 'expenses' && 'فۆرمی تۆمارکردنی مەسروفاتی نوێ (New Expense Form)'}
              {activeTab === 'bonuses' && 'فۆرمی تۆمارکردنی پاداشتی کارمەند (New Bonus Form)'}
              {activeTab === 'withdrawals' && 'فۆرمی تۆمارکردنی ڕاکێشانی پێشینە (New Cash Withdrawal Form)'}
            </h3>
          </div>
          <span className="text-[10px] bg-white/90 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-slate-800">
            تۆمار لە: {date}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {activeTab === 'expenses' ? (
            <>
              <div>
                <label className="block text-slate-800 mb-1 text-[11px] font-bold">ناونیشانی مەسروفات:</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="بۆ نموونە: کڕینی پێداویستی کارگە"
                  className="input-classic w-full font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1 text-[11px] font-bold">پۆلێن (Category):</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-classic w-full font-bold bg-white"
                >
                  <option value="مەسروفاتی گشتی">مەسروفاتی گشتی</option>
                  <option value="خواردن و میوانداری">خواردن و میوانداری</option>
                  <option value="سووتەمەنی و سەیارە">سووتەمەنی و سەیارە</option>
                  <option value="کەرەستە و چاککردنەوە">کەرەستە و چاککردنەوە</option>
                  <option value="کرێ و گواستنەوە">کرێ و گواستنەوە</option>
                  <option value="هیتر">هیتر</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-slate-800 mb-1 text-[11px] font-bold">کارمەند:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="input-classic w-full font-bold bg-white"
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
          )}

          <div>
            <label className="block text-slate-800 mb-1 text-[11px] font-bold">بڕی پارە (IQD):</label>
            <input
              type="number"
              required
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50,000"
              className="input-classic w-full font-mono font-bold bg-white"
            />
          </div>

          <div>
            <label className="block text-slate-800 mb-1 text-[11px] font-bold">بەرواری پسوولە/تۆمار:</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-classic w-full font-mono font-bold bg-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="تێبینی و هۆکاری پسوولەکە یان وردەکاری زیادە..."
              className="input-classic w-full font-bold bg-white"
            />
          </div>
          <button 
            type="submit" 
            className={`btn-classic text-xs font-black flex items-center gap-1.5 text-white shadow-sm cursor-pointer px-4 py-1.5 rounded flex-shrink-0 ${
              activeTab === 'expenses' ? 'bg-rose-700 hover:bg-rose-800 border-rose-900' :
              activeTab === 'bonuses' ? 'bg-emerald-700 hover:bg-emerald-800 border-emerald-900' :
              'bg-amber-700 hover:bg-amber-800 border-amber-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>پاشەکەوتکردنی ئەم تۆمارە</span>
          </button>
        </div>
      </form>

      {/* 📊 ANALYTICS & DATA TABLE CONTAINER */}
      <div className="border-2 border-slate-300 bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-slate-800 text-white p-2 px-3 flex items-center justify-between">
          <h3 className="text-xs font-black flex items-center gap-2">
            <span>
              📋 {activeTab === 'expenses' && `لیستی تەواوی مەسروفاتەکانی مانگی (${selectedMonth})`}
              {activeTab === 'bonuses' && `لیستی پاداشتەکانی مانگی (${selectedMonth})`}
              {activeTab === 'withdrawals' && `لیستی پێشینەی ڕاکێشراوی مانگی (${selectedMonth})`}
            </span>
          </h3>
          <span className="text-[10px] font-mono text-slate-300">
            {activeTab === 'expenses' ? `${monthlyExpenses.length} پسوولە` :
             activeTab === 'bonuses' ? `${monthlyBonuses.length} کارمەند` :
             `${monthlyWithdrawals.length} تۆمار`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-200 border-b-2 border-slate-300 text-slate-900 font-black">
                <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                <th className="p-2.5 border-l border-slate-300">
                  {activeTab === 'expenses' ? 'ناونیشانی خەرجی / پۆلێن' : 'ناوی کارمەند'}
                </th>
                <th className="p-2.5 border-l border-slate-300 text-center">بەروار</th>
                <th className="p-2.5 border-l border-slate-300 text-center">بڕی پارە (IQD)</th>
                <th className="p-2.5 border-l border-slate-300">تێبینی / هۆکار</th>
                <th className="p-2.5 text-center w-16">کردار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-bold">
              {activeTab === 'expenses' && (
                monthlyExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ مەسروفاتێک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  monthlyExpenses.map((e: any, idx: number) => (
                    <tr key={e.id} className="hover:bg-rose-50/40 transition-all">
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">
                        {e.title} <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-1.5 py-0.5 rounded mr-1">({e.category || 'گشتی'})</span>
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono font-bold text-slate-800">{e.date}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-rose-900 font-black">
                        {Number(e.amount || 0).toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-700 font-medium">{e.note || '-'}</td>
                      <td className="p-2.5 text-center">
                        <button 
                          onClick={() => handleDeleteRecord(e.id, 'expenses')} 
                          className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                          title="سڕینەوە"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {activeTab === 'bonuses' && (
                monthlyBonuses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ پاداشتێک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  monthlyBonuses.map((b: any, idx: number) => (
                    <tr key={b.id} className="hover:bg-emerald-50/40 transition-all">
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{b.employeeName}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono font-bold text-slate-800">{b.date}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-emerald-900 font-black">
                        {Number(b.totalAmount || b.amount || 0).toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-700 font-medium">{b.reason || b.note || '-'}</td>
                      <td className="p-2.5 text-center">
                        <button 
                          onClick={() => handleDeleteRecord(b.id, 'bonuses')} 
                          className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                          title="سڕینەوە"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}

              {activeTab === 'withdrawals' && (
                monthlyWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                      هیچ ڕاکێشانێکی پێشینە بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  monthlyWithdrawals.map((w: any, idx: number) => (
                    <tr key={w.id} className="hover:bg-amber-50/40 transition-all">
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">{w.employeeName}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono font-bold text-slate-800">{w.date}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-amber-900 font-black">
                        {Number(w.amount || 0).toLocaleString()} IQD
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-slate-700 font-medium">{w.note || '-'}</td>
                      <td className="p-2.5 text-center">
                        <button 
                          onClick={() => handleDeleteRecord(w.id, 'withdrawals')} 
                          className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-100 rounded transition-all"
                          title="سڕینەوە"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
