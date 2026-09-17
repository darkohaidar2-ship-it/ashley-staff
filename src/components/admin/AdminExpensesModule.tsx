'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  Gift, 
  Banknote,
  Search,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { format } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface AdminExpensesModuleProps {
  employees?: Employee[];
}

export function AdminExpensesModule({ employees: propEmployees }: AdminExpensesModuleProps = {}) {
  const { employees: contextEmployees, expenses, setExpenses, bonuses, setBonuses, withdrawals, setWithdrawals } = useAppContext();
  const employees = propEmployees || contextEmployees || [];

  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [activeTab, setActiveTab] = useState<'expenses' | 'bonuses' | 'withdrawals'>('expenses');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterEmpId, setFilterEmpId] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Form States (matching screenshot)
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState<'taxi' | 'fuel' | 'food' | 'office' | 'other'>('taxi');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [tripNo, setTripNo] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');

  // UX Feedback states
  const [lastAddedFeedback, setLastAddedFeedback] = useState<string | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Input ref to automatically focus back on Amount for rapid consecutive entries
  const amountInputRef = useRef<HTMLInputElement>(null);

  const categoryPills = [
    { key: 'taxi' as const, label: 'کرێی تەکسی' },
    { key: 'fuel' as const, label: 'بەنزین' },
    { key: 'food' as const, label: 'خواردن' },
    { key: 'office' as const, label: 'مەکتەب' },
    { key: 'other' as const, label: 'تر' },
  ];

  const typeLabels: Record<string, string> = {
    taxi: 'کرێی تەکسی',
    fuel: 'بەنزین',
    food: 'خواردن',
    office: 'مەکتەب',
    other: 'تر'
  };

  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    taxi: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
    fuel: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
    food: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
    office: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
    other: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
  };

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Filtered by selected month, employee, type, and search query
  const monthlyExpenses = useMemo(() => {
    return (expenses || []).filter((e: any) => {
      if (!e.date || !e.date.startsWith(selectedMonth)) return false;
      if (filterEmpId !== 'all') {
        if (filterEmpId === 'company') {
          if (e.employeeId) return false;
        } else if (e.employeeId !== filterEmpId) {
          return false;
        }
      }
      if (filterType !== 'all') {
        if ((e.type || 'other') !== filterType) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchCategory = (e.category || '').toLowerCase().includes(q);
        const matchEmp = (e.employeeName || '').toLowerCase().includes(q);
        const matchNote = (e.note || '').toLowerCase().includes(q);
        const matchFrom = (e.from || '').toLowerCase().includes(q);
        const matchTo = (e.to || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCategory && !matchEmp && !matchNote && !matchFrom && !matchTo) return false;
      }
      return true;
    });
  }, [expenses, selectedMonth, filterEmpId, filterType, searchQuery]);

  // Grouping Expenses by Employee with Subtotals
  const groupedExpenses = useMemo(() => {
    const map: Record<string, { empKey: string; empName: string; empId?: string; role?: string; items: any[]; total: number }> = {};
    monthlyExpenses.forEach((exp: any) => {
      const key = exp.employeeId || exp.employeeName || 'company';
      const empObj = employees.find(e => e.id === exp.employeeId);
      const displayName = exp.employeeName || (empObj ? (empObj.fullName3Part || empObj.name) : '🏢 مەسروفاتی گشتی کارگەی ئاشڵی');
      if (!map[key]) {
        map[key] = {
          empKey: key,
          empName: displayName,
          empId: exp.employeeId,
          role: empObj?.role ? String(empObj.role) : undefined,
          items: [],
          total: 0
        };
      }
      map[key].items.push(exp);
      map[key].total += Number(exp.amount || 0);
    });
    return map;
  }, [monthlyExpenses, employees]);

  const monthlyBonuses = useMemo(() => {
    return (bonuses || []).filter((b: any) => {
      if (!b.date || !b.date.startsWith(selectedMonth)) return false;
      if (filterEmpId !== 'all' && b.employeeId !== filterEmpId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEmp = (b.employeeName || '').toLowerCase().includes(q);
        const matchReason = (b.reason || '').toLowerCase().includes(q);
        if (!matchEmp && !matchReason) return false;
      }
      return true;
    });
  }, [bonuses, selectedMonth, filterEmpId, searchQuery]);

  const monthlyWithdrawals = useMemo(() => {
    return (withdrawals || []).filter((w: any) => {
      if (!w.date || !w.date.startsWith(selectedMonth)) return false;
      if (filterEmpId !== 'all' && w.employeeId !== filterEmpId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEmp = (w.employeeName || '').toLowerCase().includes(q);
        const matchNote = (w.note || '').toLowerCase().includes(q);
        if (!matchEmp && !matchNote) return false;
      }
      return true;
    });
  }, [withdrawals, selectedMonth, filterEmpId, searchQuery]);

  // Totals
  const totalExp = monthlyExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const totalBon = monthlyBonuses.reduce((sum: number, b: any) => sum + Number(b.totalAmount || b.amount || 0), 0);
  const totalWth = monthlyWithdrawals.reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0);
  const grandTotal = totalExp + totalBon + totalWth;

  // Ultra-Fast Data Entry Handler
  const handleAddRecord = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      amountInputRef.current?.focus();
      return;
    }

    const numAmount = parseFloat(amount);
    const emp = employees.find(e => e.id === selectedEmpId);
    const empName = emp ? (emp.fullName3Part || emp.name) : 'مەسروفاتی گشتی کارگە';
    const newId = (activeTab === 'expenses' ? 'exp_' : activeTab === 'bonuses' ? 'bon_' : 'wth_') + Date.now();

    if (activeTab === 'expenses') {
      const newExp = {
        id: newId,
        title: typeLabels[expenseType] || 'مەسروفات',
        amount: numAmount,
        category: typeLabels[expenseType] || 'مەسروفات',
        type: expenseType,
        from: fromLoc.trim(),
        to: toLoc.trim(),
        trip: tripNo.trim(),
        employeeId: selectedEmpId || undefined,
        employeeName: selectedEmpId ? empName : undefined,
        date,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev: any) => [newExp, ...(prev || [])]);
      setLastAddedFeedback(`✓ خەرجی (${typeLabels[expenseType]}) بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) تۆمارکرا!`);
    } else if (activeTab === 'bonuses') {
      if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە بۆ پاداشت');
      const newBonus = {
        id: newId,
        employeeId: selectedEmpId,
        employeeName: empName,
        amount: numAmount,
        totalAmount: numAmount,
        date,
        reason: note.trim() || 'پاداشتی دەستخۆشی',
        createdAt: new Date().toISOString(),
      };
      setBonuses((prev: any) => [newBonus, ...(prev || [])]);
      setLastAddedFeedback(`✓ پاداشت بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) تۆمارکرا!`);
    } else if (activeTab === 'withdrawals') {
      if (!selectedEmpId) return alert('تکایە کارمەند دیاری بکە بۆ ڕاکێشانی پێشینە');
      const newWth = {
        id: newId,
        employeeId: selectedEmpId,
        employeeName: empName,
        amount: numAmount,
        date,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      setWithdrawals((prev: any) => [newWth, ...(prev || [])]);
      setLastAddedFeedback(`✓ ڕاکێشانی پێشینە بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) تۆمارکرا!`);
    }

    // Visual feedback on the new row
    setRecentlyAddedId(newId);
    setTimeout(() => setRecentlyAddedId(null), 3000);
    setTimeout(() => setLastAddedFeedback(null), 4000);

    // Fast Data Entry Ergonomics:
    // Reset specific fields but RETAIN selected employee and date!
    setAmount('');
    setFromLoc('');
    setToLoc('');
    setTripNo('');
    setNote('');

    // Immediately refocus on amount input so user can type next expense with zero clicks!
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRecord();
    }
  };

  const handleDeleteRecord = (id: string, type: 'expenses' | 'bonuses' | 'withdrawals') => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارە؟')) return;
    if (type === 'expenses') setExpenses((prev: any) => (prev || []).filter((e: any) => e.id !== id));
    if (type === 'bonuses') setBonuses((prev: any) => (prev || []).filter((b: any) => b.id !== id));
    if (type === 'withdrawals') setWithdrawals((prev: any) => (prev || []).filter((w: any) => w.id !== id));
  };

  const handleExportPDF = () => {
    if (activeTab === 'expenses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'جۆر', key: 'type', align: 'center' },
        { header: 'لە (From)', key: 'from', align: 'right' },
        { header: 'بۆ (To)', key: 'to', align: 'right' },
        { header: 'ژ.سەفەر', key: 'trip', align: 'center' },
        { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی', key: 'note', align: 'right' },
      ];
      const data: any[] = [];
      Object.values(groupedExpenses).forEach(grp => {
        grp.items.forEach(e => {
          data.push({
            empName: grp.empName,
            date: e.date,
            type: typeLabels[e.type] || e.category || 'تر',
            from: e.from || '-',
            to: e.to || '-',
            trip: e.trip || '-',
            amount: `${Number(e.amount || 0).toLocaleString()} IQD`,
            note: e.note || e.title || '-',
          });
        });
        data.push({
          empName: `📊 کۆی (${grp.empName})`,
          date: '—',
          type: '—',
          from: '—',
          to: '—',
          trip: '—',
          amount: `${Number(grp.total).toLocaleString()} IQD`,
          note: `کۆی مەسروفاتی ئەم کارمەندە`,
        });
      });
      exportToPDF({
        title: 'ڕاپۆرتی مەسروفات و خەرجییەکانی کارمەندان (Ashley Expenses Ledger)',
        subtitle: 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی',
        period: `مانگی ${selectedMonth}`,
        columns: cols,
        data,
        fileName: `Ashley_Expenses_${selectedMonth}`,
        summaryCards: [
          { label: 'کۆی خەرجی مەسروفات', value: `${totalExp.toLocaleString()} IQD`, color: '#007AFF' },
          { label: 'ژمارەی پسوولەکان', value: `${monthlyExpenses.length} دانە` },
          { label: 'ژمارەی کارمەندان', value: `${Object.keys(groupedExpenses).length} کەس` },
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
        { header: 'ناوی کارمەند', key: 'empName' },
        { header: 'بەروار', key: 'date' },
        { header: 'جۆر', key: 'type' },
        { header: 'لە (From)', key: 'from' },
        { header: 'بۆ (To)', key: 'to' },
        { header: 'ژمارەی سەفەر', key: 'trip' },
        { header: 'بڕی پارە (IQD)', key: 'amount' },
        { header: 'تێبینی', key: 'note' },
      ];
      const data: any[] = [];
      Object.values(groupedExpenses).forEach(grp => {
        grp.items.forEach(e => {
          data.push({
            empName: grp.empName,
            date: e.date,
            type: typeLabels[e.type] || e.category || 'تر',
            from: e.from || '-',
            to: e.to || '-',
            trip: e.trip || '-',
            amount: e.amount || 0,
            note: e.note || e.title || '-',
          });
        });
        data.push({
          empName: `کۆی (${grp.empName})`,
          date: '',
          type: '',
          from: '',
          to: '',
          trip: '',
          amount: grp.total,
          note: `کۆی مەسروفاتی کارمەند`,
        });
      });
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
    <div className="space-y-6 dir-rtl" dir="rtl">
      
      {/* 🧭 NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'expenses' 
                ? 'bg-[#007AFF] text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>💸 مەسروفات و خەرجی ({monthlyExpenses.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bonuses')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'bonuses' 
                ? 'bg-emerald-600 text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>🎁 پاداشت و بەخشش ({monthlyBonuses.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'withdrawals' 
                ? 'bg-amber-600 text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>🏧 ڕاکێشانی پێشینە ({monthlyWithdrawals.length})</span>
          </button>
        </div>

        {/* Quick Month Filter & Exports */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-bold">مانگ:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
          />

          <button
            onClick={handleExportPDF}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 shadow-2xs transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-rose-600" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 shadow-2xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* 📊 KPI SUMMARY ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">کۆی مەسروفات</span>
          <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
            {totalExp.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">IQD</span>
          </p>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">کۆی پاداشتەکان</span>
          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {totalBon.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">IQD</span>
          </p>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">کۆی پێشینە و سەحب</span>
          <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
            {totalWth.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">IQD</span>
          </p>
        </div>
        <div className="p-3.5 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-2xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">کۆی گشتی مانگ</span>
          <p className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 font-mono mt-0.5">
            {grandTotal.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">IQD</span>
          </p>
        </div>
      </div>

      {/* 📝 NEW EXPENSE FORM (MATCHING USER SCREENSHOT media_1789546965924.png) */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-sm p-6 sm:p-7 space-y-4">
        
        {/* Header & Category Pills (RTL layout) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {activeTab === 'expenses' && 'زیادکردنی خەرجی نوێ'}
              {activeTab === 'bonuses' && 'زیادکردنی پاداشتی نوێ'}
              {activeTab === 'withdrawals' && 'زیادکردنی ڕاکێشانی پێشینەی نوێ'}
            </h3>

            {/* Micro Success Toast */}
            {lastAddedFeedback && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800 animate-in fade-in duration-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lastAddedFeedback}</span>
              </div>
            )}
          </div>

          {/* Category Pills (Active = Apple Blue #007AFF) */}
          {activeTab === 'expenses' && (
            <div className="flex items-center gap-2 flex-wrap">
              {categoryPills.map(cat => {
                const isActive = expenseType === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setExpenseType(cat.key);
                      amountInputRef.current?.focus();
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#007AFF] text-white font-bold shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 🔲 Main Input Row 1: 6 inputs side by side in RTL order */}
        {activeTab === 'expenses' ? (
          <form onSubmit={handleAddRecord} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              
              {/* 1. کارمەند (Employee select dropdown) */}
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 pl-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] appearance-none cursor-pointer"
                >
                  <option value="">کارمەند</option>
                  <option value="company">🏢 مەسروفاتی گشتی کارگە</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName3Part || emp.name}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2.5 top-3 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* 2. بەروار (Date picker input) */}
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] cursor-pointer"
                />
              </div>

              {/* 3. بڕی پارە (Amount in IQD) */}
              <div>
                <input
                  type="number"
                  ref={amountInputRef}
                  placeholder="0"
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white text-xs font-mono font-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>

              {/* 4. لە (From location) */}
              <div>
                <input
                  type="text"
                  placeholder="لە"
                  value={fromLoc}
                  onChange={(e) => setFromLoc(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>

              {/* 5. بۆ (To location) */}
              <div>
                <input
                  type="text"
                  placeholder="بۆ"
                  value={toLoc}
                  onChange={(e) => setToLoc(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>

              {/* 6. ژ.سەفەر (Trip number / Reference) */}
              <div>
                <input
                  type="text"
                  placeholder="ژ.سەفەر"
                  value={tripNo}
                  onChange={(e) => setTripNo(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>
            </div>

            {/* 🔲 Row 2: تێبینی (Spanning right-side under employee and date) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="تێبینی"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>
            </div>

            {/* 🔲 Row 3: Blue Add Button [+ زیادکردن] */}
            <div className="pt-1 flex items-center justify-start">
              <button
                type="submit"
                className="h-10 px-6 rounded-xl bg-[#007AFF] hover:bg-[#0062cc] active:bg-[#0051a8] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>زیادکردن</span>
              </button>
            </div>
          </form>
        ) : (
          /* Bonus & Withdrawal Form in the same clean Apple style */
          <form onSubmit={handleAddRecord} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Employee */}
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  required
                  className="w-full h-10 px-3 pl-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] appearance-none cursor-pointer"
                >
                  <option value="">کارمەند هەڵبژێرە</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName3Part || emp.name}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2.5 top-3 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              {/* Date */}
              <div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>

              {/* Amount */}
              <div>
                <input
                  type="number"
                  ref={amountInputRef}
                  placeholder="0"
                  step="500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-10 px-3 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white text-xs font-mono font-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder={activeTab === 'bonuses' ? 'هۆکاری پاداشت...' : 'تێبینی ڕاکێشانی پێشینە...'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
              />
            </div>

            <div className="pt-1 flex items-center justify-start">
              <button
                type="submit"
                className={`h-10 px-6 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
                  activeTab === 'bonuses' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>زیادکردن</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 📊 LIVE PREVIEW TABLE (خشتەی پێشبینی ڕاستەوخۆ) */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-sm overflow-hidden space-y-0">
        
        {/* Table Toolbar / Filters */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>خشتەی پێشبینی ڕاستەوخۆ (Live Ledger Preview)</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeTab === 'expenses' && `مەسروفاتی مانگی (${selectedMonth}) - دەستبەجێ بە زیادکردنی نوێ نوێ دەبێتەوە`}
                {activeTab === 'bonuses' && `پاداشتەکانی مانگی (${selectedMonth})`}
                {activeTab === 'withdrawals' && `ڕاکێشانی پێشینەی مانگی (${selectedMonth})`}
              </p>
            </div>
          </div>

          {/* Quick Filter Inputs */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterEmpId}
              onChange={(e) => setFilterEmpId(e.target.value)}
              className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold focus:outline-none"
            >
              <option value="all">👥 هەموو کارمەندان</option>
              {activeTab === 'expenses' && (
                <option value="company">🏢 مەسروفاتی گشتی کۆمپانیا</option>
              )}
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName3Part || emp.name}
                </option>
              ))}
            </select>

            {activeTab === 'expenses' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold focus:outline-none"
              >
                <option value="all">🏷️ هەموو جۆرەکان</option>
                <option value="taxi">کرێی تەکسی</option>
                <option value="fuel">بەنزین</option>
                <option value="food">خواردن</option>
                <option value="office">مەکتەب</option>
                <option value="other">تر</option>
              </select>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان..."
                className="h-8 pr-8 pl-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#2c2c2e] text-slate-800 dark:text-white text-xs font-bold placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Crisp Table Layout with Gridlines */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              {activeTab === 'expenses' ? (
                <tr className="bg-slate-50/90 dark:bg-[#2c2c2e] border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-black">
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">بەروار</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">جۆری خەرجی</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80">لە (From)</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80">بۆ (To)</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">ژ.سەفەر</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80">تێبینی</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">بڕی پارە (IQD)</th>
                  <th className="py-2.5 px-3 text-center w-14">کردار</th>
                </tr>
              ) : (
                <tr className="bg-slate-50/90 dark:bg-[#2c2c2e] border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 font-black">
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80">ناوی کارمەند</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">بەروار</th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80 text-center">
                    {activeTab === 'bonuses' ? 'بڕی پاداشت (IQD)' : 'بڕی پارەی ڕاکێشراو (IQD)'}
                  </th>
                  <th className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700/80">
                    {activeTab === 'bonuses' ? 'هۆکار و تێبینی' : 'تێبینی'}
                  </th>
                  <th className="py-2.5 px-3 text-center w-14">کردار</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-700/80 font-bold">
              {activeTab === 'expenses' && (
                Object.keys(groupedExpenses).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                      هیچ خەرجییەک لە مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  <>
                    {Object.values(groupedExpenses).map((grp) => (
                      <React.Fragment key={grp.empKey}>
                        {/* 👤 Employee Header Divider */}
                        <tr className="bg-slate-100/70 dark:bg-white/5 border-t border-b border-slate-200 dark:border-slate-700">
                          <td colSpan={9} className="py-2 px-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-[#007AFF] text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                                  {grp.empName.charAt(0)}
                                </div>
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  {grp.empName}
                                </span>
                                {grp.role && (
                                  <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                                    {grp.role}
                                  </span>
                                )}
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full font-bold">
                                  {grp.items.length} پسوولە
                                </span>
                              </div>
                              <div className="text-xs font-mono font-black text-[#007AFF]">
                                کۆی کارمەند: {grp.total.toLocaleString()} IQD
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* 📋 Employee's Individual Expense Rows */}
                        {grp.items.map((exp: any, idx: number) => {
                          const isJustAdded = exp.id === recentlyAddedId;
                          const color = typeColors[exp.type] || typeColors.other;
                          return (
                            <tr 
                              key={exp.id} 
                              className={`transition-colors border-b border-slate-200/60 dark:border-slate-800 ${
                                isJustAdded 
                                  ? 'bg-blue-50/90 dark:bg-blue-950/50 ring-2 ring-[#007AFF] ring-inset animate-pulse' 
                                  : 'hover:bg-slate-50/60 dark:hover:bg-white/5'
                              }`}
                            >
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-slate-400 text-xs">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                {exp.date}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center">
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${color.bg} ${color.text} ${color.border}`}>
                                  {typeLabels[exp.type] || exp.category || 'تر'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                {exp.from || '—'}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                {exp.to || '—'}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                                {exp.trip || '—'}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                {exp.note || exp.title || '—'}
                              </td>
                              <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-[#007AFF] font-black text-xs">
                                {Number(exp.amount || 0).toLocaleString()} IQD
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button 
                                  onClick={() => handleDeleteRecord(exp.id, 'expenses')} 
                                  className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all cursor-pointer"
                                  title="سڕینەوە"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Subtotal Row */}
                        <tr className="bg-slate-50 dark:bg-white/5 font-black text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                          <td colSpan={7} className="py-2 px-4 text-right text-xs">
                            📊 کۆی مەسروفاتی ({grp.empName}):
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-black text-xs text-[#007AFF] border-x border-slate-200/60 dark:border-slate-700">
                            {grp.total.toLocaleString()} IQD
                          </td>
                          <td></td>
                        </tr>
                      </React.Fragment>
                    ))}

                    {/* Grand Total Row */}
                    <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                      <td colSpan={7} className="py-3 px-4 text-right text-slate-300">
                        💎 کۆی گشتی هەموو مەسروفاتەکان ({monthlyExpenses.length} پسوولە):
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-emerald-400 text-sm bg-slate-950 border-x border-slate-800">
                        {totalExp.toLocaleString()} IQD
                      </td>
                      <td></td>
                    </tr>
                  </>
                )
              )}

              {activeTab === 'bonuses' && (
                monthlyBonuses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      هیچ پاداشتێک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  <>
                    {monthlyBonuses.map((b: any, idx: number) => (
                      <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors border-b border-slate-200/60 dark:border-slate-800">
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-white font-bold">{b.employeeName}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{b.date}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-emerald-600 dark:text-emerald-400 font-black">
                          {Number(b.totalAmount || b.amount || 0).toLocaleString()} IQD
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">{b.reason || b.note || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button 
                            onClick={() => handleDeleteRecord(b.id, 'bonuses')} 
                            className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                            title="سڕینەوە"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                      <td colSpan={3} className="py-3 px-4 text-right text-slate-300">کۆی گشتی پاداشتەکان:</td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-400 font-black text-sm">{totalBon.toLocaleString()} IQD</td>
                      <td colSpan={2}></td>
                    </tr>
                  </>
                )
              )}

              {activeTab === 'withdrawals' && (
                monthlyWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      هیچ ڕاکێشانێکی پێشینە بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                    </td>
                  </tr>
                ) : (
                  <>
                    {monthlyWithdrawals.map((w: any, idx: number) => (
                      <tr key={w.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors border-b border-slate-200/60 dark:border-slate-800">
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-white font-bold">{w.employeeName}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{w.date}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-center font-mono text-amber-600 dark:text-amber-400 font-black">
                          {Number(w.amount || 0).toLocaleString()} IQD
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium">{w.note || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <button 
                            onClick={() => handleDeleteRecord(w.id, 'withdrawals')} 
                            className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all"
                            title="سڕینەوە"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-950">
                      <td colSpan={3} className="py-3 px-4 text-right text-slate-300">کۆی گشتی پێشینەی ڕاکێشراو:</td>
                      <td className="py-3 px-3 text-center font-mono text-amber-400 font-black text-sm">{totalWth.toLocaleString()} IQD</td>
                      <td colSpan={2}></td>
                    </tr>
                  </>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
