'use client';

import React, { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import type { Employee } from '@/lib/types';
import { useAppContext } from '@/context/app-provider';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Printer, 
  TrendingDown, 
  Gift, 
  Banknote, 
  Search, 
  CheckCircle2, 
  Save, 
  Eye, 
  ArrowRight, 
  Clock, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Edit3, 
  X,
  BarChart3,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

export interface ArchivedVoucher {
  id: string;
  type: 'expenses' | 'bonuses' | 'withdrawals';
  name: string; // e.g. "لیستی مەسروفات • 2026-09-22 10:15:30"
  month: string; // e.g. "2026-09"
  createdAt: string; // ISO date
  dateRange: string; // e.g. "2026-09-16 تا 2026-09-20" or "2026-09-20"
  totalAmount: number;
  itemCount: number;
  items: any[];
}

export interface EmployeeExpenseGroup {
  employeeKey: string;
  employeeName: string;
  items: any[];
  totalAmount: number;
}

export const resolveExpenseEmployeeName = (item: any, employeesList: Employee[] = []): string => {
  if (item.employeeName && typeof item.employeeName === 'string' && item.employeeName.trim()) {
    return item.employeeName.trim();
  }
  if (item.employeeId) {
    const emp = employeesList.find(e => e.id === item.employeeId);
    if (emp) return emp.fullName3Part || emp.name;
    return item.employeeId;
  }
  return '🏢 مەسروفاتی گشتی کۆگا';
};

export const groupExpensesByEmployee = (items: any[] = [], employeesList: Employee[] = []): EmployeeExpenseGroup[] => {
  const groupMap = new Map<string, EmployeeExpenseGroup>();

  items.forEach(item => {
    const empName = resolveExpenseEmployeeName(item, employeesList);
    const key = item.employeeId || empName;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        employeeKey: key,
        employeeName: empName,
        items: [],
        totalAmount: 0,
      });
    }

    const group = groupMap.get(key)!;
    group.items.push(item);
    group.totalAmount += Number(item.amount || item.totalAmount || 0);
  });

  // Sort items inside each group by date ascending
  groupMap.forEach(group => {
    group.items.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  });

  return Array.from(groupMap.values());
};

interface AdminExpensesModuleProps {
  employees?: Employee[];
}

export function AdminExpensesModule({ employees: propEmployees }: AdminExpensesModuleProps = {}) {
  const { 
    employees: contextEmployees, 
    expenses, 
    setExpenses, 
    bonuses, 
    setBonuses, 
    withdrawals, 
    setWithdrawals, 
    settings 
  } = useAppContext();

  const employees = propEmployees || contextEmployees || [];

  // Active Tab: Expenses vs Bonuses vs Withdrawals vs Monthly Analytics
  const [activeTab, setActiveTab] = useState<'expenses' | 'bonuses' | 'withdrawals' | 'analytics'>('expenses');

  // View Mode: 'archive' (Initial Archived Lists) vs 'create' (Create/Edit List) vs 'view_voucher' (Inspect Specific List)
  const [viewMode, setViewMode] = useState<'archive' | 'create' | 'view_voucher'>('archive');

  // Calendar / Month Selection
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));

  // Search Filter in Archive
  const [archiveSearchQuery, setArchiveSearchQuery] = useState<string>('');

  // Selected Voucher to Inspect
  const [selectedVoucher, setSelectedVoucher] = useState<ArchivedVoucher | null>(null);

  // Sub-Tab for Monthly Financial Analytics: 'combined' vs 'expenses' vs 'bonuses' vs 'withdrawals'
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'combined' | 'expenses' | 'bonuses' | 'withdrawals'>('combined');

  // ✏️ EDITING STATE for Archived Lists and Draft Items
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [editingVoucherName, setEditingVoucherName] = useState<string>('');
  const [editingDraftItemId, setEditingDraftItemId] = useState<string | null>(null);

  // Storage of All Archived Vouchers
  const [archivedVouchers, setArchivedVouchers] = useState<ArchivedVoucher[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_archived_vouchers_ledger_v3');
        if (stored) return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    return [];
  });

  // Sync Archived Vouchers to LocalStorage
  const saveVouchersToStorage = (updated: ArchivedVoucher[]) => {
    setArchivedVouchers(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ashley_archived_vouchers_ledger_v3', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save vouchers to localStorage:', err);
      }
    }
  };

  // Auto-Group Existing Legacy Data into Archived Lists on First Load so NO user data is lost
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedVouchers: ArchivedVoucher[] = [];
    try {
      const stored = localStorage.getItem('ashley_archived_vouchers_ledger_v3');
      if (stored) storedVouchers = JSON.parse(stored);
    } catch {
      storedVouchers = [];
    }

    let modified = false;

    // 1. Check existing expenses
    if (expenses && expenses.length > 0) {
      const existingExpIds = new Set(
        storedVouchers
          .filter(v => v.type === 'expenses')
          .flatMap(v => (v.items || []).map((i: any) => i.id))
      );
      const unvoucheredExpenses = expenses.filter(e => !existingExpIds.has(e.id));

      if (unvoucheredExpenses.length > 0) {
        const expByMonth: Record<string, any[]> = {};
        unvoucheredExpenses.forEach(e => {
          const m = (e.date || '').substring(0, 7) || format(new Date(), 'yyyy-MM');
          if (!expByMonth[m]) expByMonth[m] = [];
          expByMonth[m].push(e);
        });

        Object.entries(expByMonth).forEach(([m, items]) => {
          const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const dates = Array.from(new Set(items.map(i => i.date))).filter(Boolean).sort();
          const dateRange = dates.length === 1 ? String(dates[0]) : dates.length > 1 ? `${dates[0]} تا ${dates[dates.length - 1]}` : m;
          const legacyVoucher: ArchivedVoucher = {
            id: `vch_legacy_exp_${m}_${Date.now()}`,
            type: 'expenses',
            name: `لیستی مەسروفات • ${m}-22 (ئەرشیفی پێشوو)`,
            month: m,
            createdAt: new Date().toISOString(),
            dateRange,
            itemCount: items.length,
            totalAmount: total,
            items: items,
          };
          storedVouchers.unshift(legacyVoucher);
          modified = true;
        });
      }
    }

    if (modified) {
      saveVouchersToStorage(storedVouchers);
    }
  }, [expenses]);

  // -------------------------------------------------------------
  // DRAFT LIST STATE (Worksheet while creating / editing a list)
  // -------------------------------------------------------------
  const [draftItems, setDraftItems] = useState<any[]>([]);

  // Form Fields for Item Input
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [expenseType, setExpenseType] = useState<'taxi' | 'fuel' | 'food' | 'office' | 'other'>('taxi');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [tripNo, setTripNo] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [note, setNote] = useState('');

  // UX Feedback for fast entry
  const [lastAddedFeedback, setLastAddedFeedback] = useState<string | null>(null);
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

  // Tab Labels
  const activeTabMeta = useMemo(() => {
    if (activeTab === 'expenses') {
      return {
        name: 'مەسروفات',
        title: 'مەسروفات و خەرجی',
        icon: TrendingDown,
        color: 'text-blue-600 dark:text-blue-400',
        badgeBg: 'bg-blue-600',
      };
    } else if (activeTab === 'bonuses') {
      return {
        name: 'پاداشت',
        title: 'پاداشت و بەخشش',
        icon: Gift,
        color: 'text-emerald-600 dark:text-emerald-400',
        badgeBg: 'bg-emerald-600',
      };
    } else if (activeTab === 'withdrawals') {
      return {
        name: 'ڕاکێشانی پارە',
        title: 'ڕاکێشانی پێشینە',
        icon: Banknote,
        color: 'text-amber-600 dark:text-amber-400',
        badgeBg: 'bg-amber-600',
      };
    } else {
      return {
        name: 'ئاماری مانگانە',
        title: 'ئاماری مانگانەی سێ بەشەکە',
        icon: BarChart3,
        color: 'text-purple-600 dark:text-purple-400',
        badgeBg: 'bg-purple-600',
      };
    }
  }, [activeTab]);

  // -------------------------------------------------------------
  // CALENDAR & MONTH FILTERING FOR ARCHIVED LISTS & ANALYTICS
  // -------------------------------------------------------------
  const handlePrevMonth = () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const prev = subMonths(new Date(year, month - 1, 1), 1);
      setSelectedMonth(format(prev, 'yyyy-MM'));
    } catch {
      // fallback
    }
  };

  const handleNextMonth = () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const next = addMonths(new Date(year, month - 1, 1), 1);
      setSelectedMonth(format(next, 'yyyy-MM'));
    } catch {
      // fallback
    }
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
  };

  // Filter archived vouchers by Active Tab and Selected Month
  const currentMonthArchivedVouchers = useMemo(() => {
    return archivedVouchers.filter(v => {
      if (v.type !== activeTab) return false;
      if (v.month !== selectedMonth) return false;
      if (archiveSearchQuery.trim()) {
        const q = archiveSearchQuery.toLowerCase().trim();
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchRange = (v.dateRange || '').toLowerCase().includes(q);
        if (!matchName && !matchRange) return false;
      }
      return true;
    });
  }, [archivedVouchers, activeTab, selectedMonth, archiveSearchQuery]);

  // Total Amount and Count of Archived Lists in this Month
  const archiveStats = useMemo(() => {
    const totalAmount = currentMonthArchivedVouchers.reduce((sum, v) => sum + Number(v.totalAmount || 0), 0);
    const totalItems = currentMonthArchivedVouchers.reduce((sum, v) => sum + Number(v.itemCount || 0), 0);
    return {
      listCount: currentMonthArchivedVouchers.length,
      totalAmount,
      totalItems
    };
  }, [currentMonthArchivedVouchers]);

  // -------------------------------------------------------------
  // 📊 MONTHLY ANALYTICS ENGINE (EXPENSES + BONUSES + WITHDRAWALS)
  // -------------------------------------------------------------
  const monthlyExpensesList = useMemo(() => {
    return (expenses || []).filter((e: any) => (e.date || '').startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const monthlyBonusesList = useMemo(() => {
    return (bonuses || []).filter((b: any) => (b.date || '').startsWith(selectedMonth));
  }, [bonuses, selectedMonth]);

  const monthlyWithdrawalsList = useMemo(() => {
    return (withdrawals || []).filter((w: any) => (w.date || '').startsWith(selectedMonth));
  }, [withdrawals, selectedMonth]);

  const monthlyTotalExp = useMemo(() => {
    return monthlyExpensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [monthlyExpensesList]);

  const monthlyTotalBon = useMemo(() => {
    return monthlyBonusesList.reduce((sum, b: any) => sum + Number(b.totalAmount || b.amount || 0), 0);
  }, [monthlyBonusesList]);

  const monthlyTotalWth = useMemo(() => {
    return monthlyWithdrawalsList.reduce((sum, w) => sum + Number(w.amount || 0), 0);
  }, [monthlyWithdrawalsList]);

  const monthlyGrandTotal = monthlyTotalExp + monthlyTotalBon + monthlyTotalWth;

  // Category breakdown for expenses
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number; label: string }> = {
      taxi: { count: 0, total: 0, label: 'کرێی تەکسی' },
      fuel: { count: 0, total: 0, label: 'بەنزین' },
      food: { count: 0, total: 0, label: 'خواردن' },
      office: { count: 0, total: 0, label: 'مەکتەب' },
      other: { count: 0, total: 0, label: 'تر' },
    };

    monthlyExpensesList.forEach((e: any) => {
      const t = (e.type as string) || 'other';
      if (!map[t]) map[t] = { count: 0, total: 0, label: typeLabels[t] || 'تر' };
      map[t].count += 1;
      map[t].total += Number(e.amount || 0);
    });

    return map;
  }, [monthlyExpensesList]);

  // Per-Employee Comprehensive Financial Aggregation for the Month
  const employeeFinancialStats = useMemo(() => {
    const map: Record<string, {
      empId: string;
      empName: string;
      role: string;
      expensesTotal: number;
      bonusesTotal: number;
      withdrawalsTotal: number;
      grandTotal: number;
      expenseCount: number;
      bonusCount: number;
      withdrawalCount: number;
    }> = {};

    // 1. Process Expenses
    monthlyExpensesList.forEach((e: any) => {
      const key = e.employeeId || 'company';
      const empObj = employees.find(emp => emp.id === e.employeeId);
      const displayName = e.employeeName || (empObj ? (empObj.fullName3Part || empObj.name) : '🏢 مەسروفاتی گشتی کۆگا');
      const roleName = empObj?.role ? String(empObj.role) : (key === 'company' ? 'مەسروفاتی کۆمپانیا' : 'کارمەند');

      if (!map[key]) {
        map[key] = {
          empId: key,
          empName: displayName,
          role: roleName,
          expensesTotal: 0,
          bonusesTotal: 0,
          withdrawalsTotal: 0,
          grandTotal: 0,
          expenseCount: 0,
          bonusCount: 0,
          withdrawalCount: 0,
        };
      }
      map[key].expensesTotal += Number(e.amount || 0);
      map[key].expenseCount += 1;
    });

    // 2. Process Bonuses
    monthlyBonusesList.forEach((b: any) => {
      const key = b.employeeId || 'unknown';
      const empObj = employees.find(emp => emp.id === b.employeeId);
      const displayName = b.employeeName || (empObj ? (empObj.fullName3Part || empObj.name) : 'کارمەند');
      const roleName = empObj?.role ? String(empObj.role) : 'کارمەند';

      if (!map[key]) {
        map[key] = {
          empId: key,
          empName: displayName,
          role: roleName,
          expensesTotal: 0,
          bonusesTotal: 0,
          withdrawalsTotal: 0,
          grandTotal: 0,
          expenseCount: 0,
          bonusCount: 0,
          withdrawalCount: 0,
        };
      }
      map[key].bonusesTotal += Number(b.totalAmount || b.amount || 0);
      map[key].bonusCount += 1;
    });

    // 3. Process Withdrawals
    monthlyWithdrawalsList.forEach((w: any) => {
      const key = w.employeeId || 'unknown';
      const empObj = employees.find(emp => emp.id === w.employeeId);
      const displayName = w.employeeName || (empObj ? (empObj.fullName3Part || empObj.name) : 'کارمەند');
      const roleName = empObj?.role ? String(empObj.role) : 'کارمەند';

      if (!map[key]) {
        map[key] = {
          empId: key,
          empName: displayName,
          role: roleName,
          expensesTotal: 0,
          bonusesTotal: 0,
          withdrawalsTotal: 0,
          grandTotal: 0,
          expenseCount: 0,
          bonusCount: 0,
          withdrawalCount: 0,
        };
      }
      map[key].withdrawalsTotal += Number(w.amount || 0);
      map[key].withdrawalCount += 1;
    });

    // Calculate Grand Total per employee
    Object.values(map).forEach(item => {
      item.grandTotal = item.expensesTotal + item.bonusesTotal + item.withdrawalsTotal;
    });

    // Sort by grandTotal descending
    return Object.values(map).sort((a, b) => b.grandTotal - a.grandTotal);
  }, [monthlyExpensesList, monthlyBonusesList, monthlyWithdrawalsList, employees]);

  // -------------------------------------------------------------
  // 🖨️ PRINT 1: COMPREHENSIVE MONTHLY FINANCIAL REPORT (PDF Portrait)
  // -------------------------------------------------------------
  const handlePrintMonthlyAnalytics = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index', align: 'center', width: '35px' },
      { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
      { header: 'پۆست / بەش', key: 'role', align: 'center' },
      { header: 'کۆی مەسروفات (IQD)', key: 'expenses', align: 'center' },
      { header: 'کۆی پاداشت (IQD)', key: 'bonuses', align: 'center' },
      { header: 'ڕاکێشانی پێشینە (IQD)', key: 'withdrawals', align: 'center' },
      { header: 'کۆی گشتی دارایی (IQD)', key: 'total', align: 'center' },
    ];

    const data: Record<string, any>[] = employeeFinancialStats.map((item, idx) => ({
      index: idx + 1,
      empName: item.empName,
      role: item.role || '—',
      expenses: `${item.expensesTotal.toLocaleString()} IQD`,
      bonuses: `${item.bonusesTotal.toLocaleString()} IQD`,
      withdrawals: `${item.withdrawalsTotal.toLocaleString()} IQD`,
      total: `${item.grandTotal.toLocaleString()} IQD`,
    }));

    // Add Final Grand Total Row
    data.push({
      isGrandTotal: true,
      index: '★',
      empName: 'کۆی گشتی تەواوی دارایی مانگ',
      role: 'گشتی',
      expenses: `${monthlyTotalExp.toLocaleString()} IQD`,
      bonuses: `${monthlyTotalBon.toLocaleString()} IQD`,
      withdrawals: `${monthlyTotalWth.toLocaleString()} IQD`,
      total: `${monthlyGrandTotal.toLocaleString()} IQD`,
    });

    exportToPDF({
      title: 'ڕاپۆرتی گشتگیری دارایی مانگانە',
      subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — پوختەی گشتی مەسروفات، پاداشت و پێشینە',
      period: `مانگی ${monthDisplayLabel}`,
      columns: cols,
      data,
      orientation: 'portrait',
      fileName: `Ashley_Monthly_Financial_Report_${selectedMonth}`,
      documentCode: `ASH-FIN-${selectedMonth.replace(/-/g, '')}`,
    });
  };

  // -------------------------------------------------------------
  // 🖨️ PRINT 2: MONTHLY EXPENSES SECTION (PDF Portrait)
  // -------------------------------------------------------------
  const handlePrintMonthlyExpensesSection = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index', align: 'center', width: '35px' },
      { header: 'بەروار', key: 'date', align: 'center', width: '90px' },
      { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
      { header: 'جۆری خەرجی', key: 'type', align: 'center' },
      { header: 'ڕێڕەو (لە ⬅️ بۆ)', key: 'route', align: 'right' },
      { header: 'ژ.سەفەر', key: 'trip', align: 'center', width: '55px' },
      { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
      { header: 'تێبینی', key: 'note', align: 'right' },
    ];

    const groups = groupExpensesByEmployee(monthlyExpensesList, employees);
    const data: Record<string, any>[] = [];
    let globalIdx = 0;

    groups.forEach(group => {
      group.items.forEach(item => {
        globalIdx += 1;
        const route = (item.from || item.to) ? `${item.from || '—'} ⬅️ ${item.to || '—'}` : '—';
        data.push({
          index: globalIdx,
          date: item.date || '—',
          empName: group.employeeName,
          type: typeLabels[item.type] || item.category || 'تەکسی',
          route,
          trip: item.trip || '—',
          amount: `${Number(item.amount || 0).toLocaleString()} IQD`,
          note: item.note || item.reason || '—',
        });
      });

      // 🟡 Highlighted Subtotal Row for Employee
      if (group.items.length > 0) {
        data.push({
          isSubtotal: true,
          index: '•',
          date: '—',
          empName: `کۆی گشتی (${group.employeeName})`,
          type: '—',
          route: '—',
          trip: `${group.items.length} پسوولە`,
          amount: `${group.totalAmount.toLocaleString()} IQD`,
          note: '—',
        });
      }
    });

    data.push({
      isGrandTotal: true,
      index: '★',
      date: 'کۆی گشتی',
      empName: `${monthlyExpensesList.length} پسوولە`,
      type: '—',
      route: '—',
      trip: '—',
      amount: `${monthlyTotalExp.toLocaleString()} IQD`,
      note: '',
    });

    exportToPDF({
      title: 'ڕاپۆرتی مانگانەی مەسروفات و خەرجییەکان',
      subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — لیستی وردەکاری سەرجەم مەسروفاتەکانی مانگ',
      period: `مانگی ${monthDisplayLabel}`,
      columns: cols,
      data,
      orientation: 'portrait',
      fileName: `Ashley_Monthly_Expenses_${selectedMonth}`,
      documentCode: `ASH-EXP-${selectedMonth.replace(/-/g, '')}`,
    });
  };

  // -------------------------------------------------------------
  // 🖨️ PRINT 3: MONTHLY BONUSES SECTION (PDF Portrait)
  // -------------------------------------------------------------
  const handlePrintMonthlyBonusesSection = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index', align: 'center', width: '35px' },
      { header: 'بەروار', key: 'date', align: 'center', width: '95px' },
      { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
      { header: 'پۆست / بەش', key: 'role', align: 'center' },
      { header: 'بڕی پاداشت (IQD)', key: 'amount', align: 'center' },
      { header: 'هۆکار و تێبینی', key: 'notes', align: 'right' },
    ];

    const sorted = [...monthlyBonusesList].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    const data: Record<string, any>[] = sorted.map((item: any, idx: number) => {
      const emp = employees.find(e => e.id === item.employeeId);
      const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
      const role = emp?.role ? String(emp.role) : 'کارمەند';
      const amt = Number(item.totalAmount || item.amount || 0);
      return {
        index: idx + 1,
        date: item.date || '—',
        empName,
        role,
        amount: `${amt.toLocaleString()} IQD`,
        notes: item.notes || item.reason || 'پاداشتی دەستخۆشی',
      };
    });

    data.push({
      isGrandTotal: true,
      index: '★',
      date: 'کۆی گشتی',
      empName: `${monthlyBonusesList.length} پاداشت`,
      role: '—',
      amount: `${monthlyTotalBon.toLocaleString()} IQD`,
      notes: '',
    });

    exportToPDF({
      title: 'ڕاپۆرتی مانگانەی پاداشت و بەخششەکان',
      subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — لیستی وردەکاری سەرجەم پاداشتەکانی مانگ',
      period: `مانگی ${monthDisplayLabel}`,
      columns: cols,
      data,
      orientation: 'portrait',
      fileName: `Ashley_Monthly_Bonuses_${selectedMonth}`,
      documentCode: `ASH-BON-${selectedMonth.replace(/-/g, '')}`,
    });
  };

  // -------------------------------------------------------------
  // 🖨️ PRINT 4: MONTHLY CASH WITHDRAWALS SECTION (PDF Portrait)
  // -------------------------------------------------------------
  const handlePrintMonthlyWithdrawalsSection = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index', align: 'center', width: '35px' },
      { header: 'بەروار', key: 'date', align: 'center', width: '95px' },
      { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
      { header: 'پۆست / بەش', key: 'role', align: 'center' },
      { header: 'بڕی پێشینە (IQD)', key: 'amount', align: 'center' },
      { header: 'تێبینی', key: 'notes', align: 'right' },
    ];

    const sorted = [...monthlyWithdrawalsList].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    const data: Record<string, any>[] = sorted.map((item: any, idx: number) => {
      const emp = employees.find(e => e.id === item.employeeId);
      const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
      const role = emp?.role ? String(emp.role) : 'کارمەند';
      const amt = Number(item.amount || 0);
      return {
        index: idx + 1,
        date: item.date || '—',
        empName,
        role,
        amount: `${amt.toLocaleString()} IQD`,
        notes: item.notes || item.reason || '—',
      };
    });

    data.push({
      isGrandTotal: true,
      index: '★',
      date: 'کۆی گشتی',
      empName: `${monthlyWithdrawalsList.length} جار`,
      role: '—',
      amount: `${monthlyTotalWth.toLocaleString()} IQD`,
      notes: '',
    });

    exportToPDF({
      title: 'ڕاپۆرتی مانگانەی ڕاکێشانی پێشینە',
      subtitle: 'کۆمپانیای مۆبیلیاتی ئاشڵی — لیستی وردەکاری سەرجەم پێشینەکانی مانگ',
      period: `مانگی ${monthDisplayLabel}`,
      columns: cols,
      data,
      orientation: 'portrait',
      fileName: `Ashley_Monthly_Withdrawals_${selectedMonth}`,
      documentCode: `ASH-WTH-${selectedMonth.replace(/-/g, '')}`,
    });
  };

  // -------------------------------------------------------------
  // 📊 EXPORT 1: COMPREHENSIVE FINANCIAL REPORT TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportMonthlyAnalyticsCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index' },
      { header: 'ناوی کارمەند', key: 'empName' },
      { header: 'پۆست / بەش', key: 'role' },
      { header: 'کۆی مەسروفات (IQD)', key: 'expenses' },
      { header: 'ژمارەی پسوولەی مەسروفات', key: 'expCount' },
      { header: 'کۆی پاداشت (IQD)', key: 'bonuses' },
      { header: 'ژمارەی پاداشت', key: 'bonCount' },
      { header: 'ڕاکێشانی پێشینە (IQD)', key: 'withdrawals' },
      { header: 'جارەکانی ڕاکێشان', key: 'wthCount' },
      { header: 'کۆی گشتی دارایی (IQD)', key: 'total' },
    ];

    const data = employeeFinancialStats.map((item, idx) => ({
      index: idx + 1,
      empName: item.empName,
      role: item.role || '—',
      expenses: item.expensesTotal,
      expCount: item.expenseCount,
      bonuses: item.bonusesTotal,
      bonCount: item.bonusCount,
      withdrawals: item.withdrawalsTotal,
      wthCount: item.withdrawalCount,
      total: item.grandTotal,
    }));

    // Add Summary Row
    data.push({
      index: 9999,
      empName: 'کۆی گشتی مانگ',
      role: 'گشتی',
      expenses: monthlyTotalExp,
      expCount: monthlyExpensesList.length,
      bonuses: monthlyTotalBon,
      bonCount: monthlyBonusesList.length,
      withdrawals: monthlyTotalWth,
      wthCount: monthlyWithdrawalsList.length,
      total: monthlyGrandTotal,
    });

    exportToCSV(cols, data, `Ashley_Monthly_Financial_Report_${selectedMonth}`);
  };

  // -------------------------------------------------------------
  // 📊 EXPORT 2: EXPENSES SECTION TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportMonthlyExpensesCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index' },
      { header: 'بەروار', key: 'date' },
      { header: 'ناوی کارمەند', key: 'empName' },
      { header: 'جۆری خەرجی', key: 'type' },
      { header: 'لە (From)', key: 'from' },
      { header: 'بۆ (To)', key: 'to' },
      { header: 'ژمارەی سەفەر', key: 'trip' },
      { header: 'بڕی پارە (IQD)', key: 'amount' },
      { header: 'تێبینی', key: 'note' },
    ];

    const groups = groupExpensesByEmployee(monthlyExpensesList, employees);
    const data: Record<string, any>[] = [];
    let globalIdx = 0;

    groups.forEach(group => {
      group.items.forEach(item => {
        globalIdx += 1;
        data.push({
          index: globalIdx,
          date: item.date || '—',
          empName: group.employeeName,
          type: typeLabels[item.type] || item.category || 'تەکسی',
          from: item.from || '—',
          to: item.to || '—',
          trip: item.trip || '—',
          amount: Number(item.amount || 0),
          note: item.note || item.reason || '—',
        });
      });

      // 🟡 Subtotal Row for Employee
      if (group.items.length > 0) {
        data.push({
          index: '',
          date: '—',
          empName: `کۆی گشتی (${group.employeeName})`,
          type: '—',
          from: '',
          to: '',
          trip: `${group.items.length} پسوولە`,
          amount: group.totalAmount,
          note: '',
        });
      }
    });

    data.push({
      index: 9999,
      date: 'کۆی گشتی',
      empName: `${monthlyExpensesList.length} پسوولە`,
      type: 'گشتی',
      from: '',
      to: '',
      trip: '',
      amount: monthlyTotalExp,
      note: '',
    });

    exportToCSV(cols, data, `Ashley_Monthly_Expenses_${selectedMonth}`);
  };

  // -------------------------------------------------------------
  // 📊 EXPORT 3: BONUSES SECTION TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportMonthlyBonusesCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index' },
      { header: 'بەروار', key: 'date' },
      { header: 'ناوی کارمەند', key: 'empName' },
      { header: 'پۆست / بەش', key: 'role' },
      { header: 'بڕی پاداشت (IQD)', key: 'amount' },
      { header: 'هۆکار و تێبینی', key: 'notes' },
    ];

    const sorted = [...monthlyBonusesList].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    const data = sorted.map((item: any, idx: number) => {
      const emp = employees.find(e => e.id === item.employeeId);
      const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
      const role = emp?.role ? String(emp.role) : 'کارمەند';
      return {
        index: idx + 1,
        date: item.date || '—',
        empName,
        role,
        amount: Number(item.totalAmount || item.amount || 0),
        notes: item.notes || item.reason || 'پاداشتی دەستخۆشی',
      };
    });

    data.push({
      index: 9999,
      date: 'کۆی گشتی',
      empName: `${monthlyBonusesList.length} پاداشت`,
      role: 'گشتی',
      amount: monthlyTotalBon,
      notes: '',
    });

    exportToCSV(cols, data, `Ashley_Monthly_Bonuses_${selectedMonth}`);
  };

  // -------------------------------------------------------------
  // 📊 EXPORT 4: WITHDRAWALS SECTION TO EXCEL / CSV
  // -------------------------------------------------------------
  const handleExportMonthlyWithdrawalsCSV = () => {
    const cols: ExportTableColumn[] = [
      { header: '#', key: 'index' },
      { header: 'بەروار', key: 'date' },
      { header: 'ناوی کارمەند', key: 'empName' },
      { header: 'پۆست / بەش', key: 'role' },
      { header: 'بڕی پێشینە (IQD)', key: 'amount' },
      { header: 'تێبینی', key: 'notes' },
    ];

    const sorted = [...monthlyWithdrawalsList].sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));
    const data = sorted.map((item: any, idx: number) => {
      const emp = employees.find(e => e.id === item.employeeId);
      const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
      const role = emp?.role ? String(emp.role) : 'کارمەند';
      return {
        index: idx + 1,
        date: item.date || '—',
        empName,
        role,
        amount: Number(item.amount || 0),
        notes: item.notes || item.reason || '—',
      };
    });

    data.push({
      index: 9999,
      date: 'کۆی گشتی',
      empName: `${monthlyWithdrawalsList.length} جار`,
      role: 'گشتی',
      amount: monthlyTotalWth,
      notes: '',
    });

    exportToCSV(cols, data, `Ashley_Monthly_Withdrawals_${selectedMonth}`);
  };

  // -------------------------------------------------------------
  // ✏️ EDIT ARCHIVED VOUCHER HANDLER
  // -------------------------------------------------------------
  const handleStartEditVoucher = (voucher: ArchivedVoucher) => {
    setEditingVoucherId(voucher.id);
    setEditingVoucherName(voucher.name);
    setDraftItems([...(voucher.items || [])]);
    setEditingDraftItemId(null);
    setAmount('');
    setFromLoc('');
    setToLoc('');
    setTripNo('');
    setNote('');
    setViewMode('create');
  };

  // -------------------------------------------------------------
  // ✏️ EDIT DRAFT ITEM HANDLER
  // -------------------------------------------------------------
  const handleStartEditDraftItem = (item: any) => {
    setEditingDraftItemId(item.id);
    setAmount(String(item.amount || item.totalAmount || ''));
    setDate(item.date || format(new Date(), 'yyyy-MM-dd'));
    setSelectedEmpId(item.employeeId || '');
    if (item.type) setExpenseType(item.type);
    setFromLoc(item.from || '');
    setToLoc(item.to || '');
    setTripNo(item.trip || '');
    setNote(item.note || item.reason || '');
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
  };

  const handleCancelEditDraftItem = () => {
    setEditingDraftItemId(null);
    setAmount('');
    setFromLoc('');
    setToLoc('');
    setTripNo('');
    setNote('');
  };

  // -------------------------------------------------------------
  // DRAFT LIST ACTIONS (Adding / Updating Items in Worksheet)
  // -------------------------------------------------------------
  const handleAddRecordToDraft = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      amountInputRef.current?.focus();
      return;
    }

    const numAmount = parseFloat(amount);
    const emp = employees.find(e => e.id === selectedEmpId);
    const empName = emp ? (emp.fullName3Part || emp.name) : 'مەسروفاتی گشتی کارگە';

    // Check if we are updating an existing draft item
    if (editingDraftItemId) {
      setDraftItems(prev => prev.map(item => {
        if (item.id !== editingDraftItemId) return item;
        if (activeTab === 'expenses') {
          return {
            ...item,
            title: typeLabels[expenseType] || 'مەسروفات',
            amount: numAmount,
            category: typeLabels[expenseType] || 'مەسروفات',
            type: expenseType,
            from: fromLoc.trim(),
            to: toLoc.trim(),
            trip: tripNo.trim(),
            employeeId: selectedEmpId || undefined,
            employeeName: selectedEmpId ? empName : 'مەسروفاتی گشتی کارگە',
            date,
            note: note.trim(),
          };
        } else if (activeTab === 'bonuses') {
          return {
            ...item,
            employeeId: selectedEmpId,
            employeeName: empName,
            amount: numAmount,
            totalAmount: numAmount,
            date,
            reason: note.trim() || 'پاداشتی دەستخۆشی',
          };
        } else {
          return {
            ...item,
            employeeId: selectedEmpId,
            employeeName: empName,
            amount: numAmount,
            date,
            note: note.trim(),
          };
        }
      }));

      setEditingDraftItemId(null);
      setLastAddedFeedback(`✓ پسوولەکە بە سەرکەوتوویی دەستکاریکرا و نوێکرایەوە!`);
    } else {
      // Create new draft item
      const newId = `${activeTab}_draft_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

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
          employeeName: selectedEmpId ? empName : 'مەسروفاتی گشتی کارگە',
          date, // Supports flexible dates per item!
          note: note.trim(),
          createdAt: new Date().toISOString(),
        };
        setDraftItems(prev => [newExp, ...prev]);
        setLastAddedFeedback(`✓ خەرجی (${typeLabels[expenseType]}) بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) زیادکرا!`);
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
        setDraftItems(prev => [newBonus, ...prev]);
        setLastAddedFeedback(`✓ پاداشت بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) زیادکرا!`);
      } else {
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
        setDraftItems(prev => [newWth, ...prev]);
        setLastAddedFeedback(`✓ ڕاکێشانی پێشینە بە بڕی ${numAmount.toLocaleString()} IQD بۆ (${empName}) زیادکرا!`);
      }
    }

    // Reset specific fields for rapid entry, but keep selected Employee and Date!
    setAmount('');
    setFromLoc('');
    setToLoc('');
    setTripNo('');
    setNote('');

    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);

    setTimeout(() => {
      setLastAddedFeedback(null);
    }, 3500);
  };

  const handleRemoveDraftItem = (id: string) => {
    if (editingDraftItemId === id) {
      handleCancelEditDraftItem();
    }
    setDraftItems(prev => prev.filter(i => i.id !== id));
  };

  // -------------------------------------------------------------
  // COMMIT & SAVE LIST (Supports both NEW and EDITED Vouchers)
  // -------------------------------------------------------------
  const handleSaveDraftList = () => {
    if (draftItems.length === 0) {
      alert(`⚠️ هیچ پسوولەیەک لەم لیستەدا نییە.\nتکایە سەرەتا پسوولەکان زیاد بکە پاشان کلیک لەسەر خەزنکردن بکە.`);
      return;
    }

    const totalAmt = draftItems.reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0);

    // Extract date range from items
    const allDates = Array.from(new Set(draftItems.map(i => i.date))).filter(Boolean).sort();
    const now = new Date();
    const realTimeDateStr = format(now, 'yyyy-MM-dd');
    let dateRange = realTimeDateStr;
    if (allDates.length === 1) {
      dateRange = String(allDates[0]);
    } else if (allDates.length > 1) {
      dateRange = `${allDates[0]} تا ${allDates[allDates.length - 1]}`;
    }

    // 🌟 CASE 1: Updating an Existing Archived Voucher
    if (editingVoucherId) {
      const existingVoucher = archivedVouchers.find(v => v.id === editingVoucherId);
      const updatedName = editingVoucherName.trim() || existingVoucher?.name || `لیستی ${activeTabMeta.name}`;

      const updatedVoucher: ArchivedVoucher = {
        ...(existingVoucher || {}),
        id: editingVoucherId,
        type: activeTab as any,
        name: updatedName,
        month: selectedMonth,
        createdAt: existingVoucher?.createdAt || now.toISOString(),
        dateRange,
        totalAmount: totalAmt,
        itemCount: draftItems.length,
        items: [...draftItems],
      };

      const updatedVouchers = archivedVouchers.map(v => v.id === editingVoucherId ? updatedVoucher : v);
      saveVouchersToStorage(updatedVouchers);

      // Clean old items from global context and replace with updated items
      const oldItemIds = new Set((existingVoucher?.items || []).map((i: any) => i.id));
      if (activeTab === 'expenses') {
        setExpenses((prev: any) => [
          ...draftItems,
          ...(prev || []).filter((e: any) => !oldItemIds.has(e.id))
        ]);
      } else if (activeTab === 'bonuses') {
        setBonuses((prev: any) => [
          ...draftItems,
          ...(prev || []).filter((b: any) => !oldItemIds.has(b.id))
        ]);
      } else if (activeTab === 'withdrawals') {
        setWithdrawals((prev: any) => [
          ...draftItems,
          ...(prev || []).filter((w: any) => !oldItemIds.has(w.id))
        ]);
      }

      setEditingVoucherId(null);
      setDraftItems([]);
      setViewMode('archive');
      alert(`🎉 سەرکەوتوو بوو:\nگۆڕانکارییەکانی (${updatedName}) بە سەرکەوتوویی پاشەکەوت کران!\n• ژمارەی پسوولەکان: ${draftItems.length}\n• کۆی گشتی: ${totalAmt.toLocaleString()} IQD`);
      return;
    }

    // 🌟 CASE 2: Saving a Fresh New Voucher with Real-Time Timestamp
    const realTimeClockStr = format(now, 'HH:mm:ss');
    const realTimeName = `لیستی ${activeTabMeta.name} • ${realTimeDateStr} (${realTimeClockStr})`;

    const newVoucher: ArchivedVoucher = {
      id: `vch_${activeTab}_${Date.now()}`,
      type: activeTab as any,
      name: realTimeName,
      month: selectedMonth,
      createdAt: now.toISOString(),
      dateRange,
      totalAmount: totalAmt,
      itemCount: draftItems.length,
      items: [...draftItems],
    };

    // Save into Archived Vouchers
    const updatedVouchers = [newVoucher, ...archivedVouchers];
    saveVouchersToStorage(updatedVouchers);

    // Push items to global context so employees statements & records stay synced
    if (activeTab === 'expenses') {
      setExpenses((prev: any) => [...draftItems, ...(prev || [])]);
    } else if (activeTab === 'bonuses') {
      setBonuses((prev: any) => [...draftItems, ...(prev || [])]);
    } else if (activeTab === 'withdrawals') {
      setWithdrawals((prev: any) => [...draftItems, ...(prev || [])]);
    }

    // Clear Draft
    setDraftItems([]);
    setAmount('');
    setFromLoc('');
    setToLoc('');
    setTripNo('');
    setNote('');

    // Automatically return to Archive View
    setViewMode('archive');

    alert(`🎉 پیرۆزە:\n${realTimeName} بە سەرکەوتوویی لە ئەرشیفدا خەزن کرا!\n• ژمارەی پسوولەکان: ${draftItems.length}\n• کۆی گشتی: ${totalAmt.toLocaleString()} IQD\n• مەودای بەروار: ${dateRange}`);
  };

  // -------------------------------------------------------------
  // DELETE ARCHIVED VOUCHER
  // -------------------------------------------------------------
  const handleDeleteVoucher = (voucher: ArchivedVoucher) => {
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم لیستە ئەرشیفکراوە؟\n«${voucher.name}»\nکۆی گشتی: ${voucher.totalAmount.toLocaleString()} IQD\nئەم کردارە سەرجەم پسوولەکانی ئەم لیستە دەسڕێتەوە.`)) {
      return;
    }

    const updated = archivedVouchers.filter(v => v.id !== voucher.id);
    saveVouchersToStorage(updated);

    // Remove underlying items from global context
    const itemIds = new Set(voucher.items.map((i: any) => i.id));
    if (voucher.type === 'expenses') {
      setExpenses((prev: any) => (prev || []).filter((e: any) => !itemIds.has(e.id)));
    } else if (voucher.type === 'bonuses') {
      setBonuses((prev: any) => (prev || []).filter((b: any) => !itemIds.has(b.id)));
    } else {
      setWithdrawals((prev: any) => (prev || []).filter((w: any) => !itemIds.has(w.id)));
    }

    if (selectedVoucher?.id === voucher.id) {
      setSelectedVoucher(null);
      setViewMode('archive');
    }

    alert(`✓ لیستی (${voucher.name}) بە سەرکەوتوویی سڕایەوە.`);
  };

  // -------------------------------------------------------------
  // PRINT ARCHIVED VOUCHER (Clean, Portrait, No KPI cards, No tiny footer)
  // -------------------------------------------------------------
  const handlePrintVoucher = (voucher: ArchivedVoucher) => {
    if (voucher.type === 'expenses') {
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

      const groups = groupExpensesByEmployee(voucher.items, employees);
      const data: Record<string, any>[] = [];

      groups.forEach(group => {
        group.items.forEach((e: any) => {
          data.push({
            empName: group.employeeName,
            date: e.date,
            type: typeLabels[e.type] || e.title || e.category || 'تەکسی',
            from: e.from || '—',
            to: e.to || '—',
            trip: e.trip || '—',
            amount: `${Number(e.amount || 0).toLocaleString()} IQD`,
            note: e.note || '—',
          });
        });

        // 🟡 Highlighted Subtotal Row for Employee
        if (group.items.length > 0) {
          data.push({
            isSubtotal: true,
            empName: `کۆی گشتی (${group.employeeName})`,
            date: '—',
            type: '—',
            from: '—',
            to: '—',
            trip: `${group.items.length} پسوولە`,
            amount: `${group.totalAmount.toLocaleString()} IQD`,
            note: '—',
          });
        }
      });

      // Single Grand Total Row at the bottom
      data.push({
        isGrandTotal: true,
        empName: 'کۆی گشتی مەسروفات',
        date: '—',
        type: '—',
        from: '—',
        to: '—',
        trip: '—',
        amount: `${voucher.totalAmount.toLocaleString()} IQD`,
        note: `کۆی تەواوی ${voucher.itemCount} پسوولەی ئەم لیستە`,
      });

      exportToPDF({
        title: 'ڕاپۆرتی مەسروفات و خەرجییەکانی کارمەندان',
        subtitle: voucher.name,
        period: `مانگی ${voucher.month} (${voucher.dateRange})`,
        columns: cols,
        data,
        orientation: 'portrait',
        fileName: `Ashley_Expenses_${voucher.name.replace(/[^\w\d-]/g, '_')}`,
        documentCode: `ASH-EXP-${voucher.month.replace(/-/g, '')}`,
      });
    } else if (voucher.type === 'bonuses') {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'بڕی پاداشت (IQD)', key: 'amount', align: 'center' },
        { header: 'هۆکار / تێبینی', key: 'reason', align: 'right' },
      ];

      const data: Record<string, any>[] = voucher.items.map((b: any) => ({
        empName: b.employeeName || employees.find(emp => emp.id === b.employeeId)?.fullName3Part || 'کارمەند',
        date: b.date,
        amount: `${Number(b.totalAmount || b.amount || 0).toLocaleString()} IQD`,
        reason: b.reason || b.note || 'پاداشتی دەستخۆشی',
      }));

      data.push({
        isGrandTotal: true,
        empName: 'کۆی گشتی پاداشتەکان',
        date: '—',
        amount: `${voucher.totalAmount.toLocaleString()} IQD`,
        reason: `کۆی تەواوی ${voucher.itemCount} پاداشتی ئەم لیستە`,
      });

      exportToPDF({
        title: 'ڕاپۆرتی پاداشت و دەستخۆشی کارمەندان',
        subtitle: voucher.name,
        period: `مانگی ${voucher.month} (${voucher.dateRange})`,
        columns: cols,
        data,
        orientation: 'portrait',
        fileName: `Ashley_Bonuses_${voucher.name.replace(/[^\w\d-]/g, '_')}`,
        documentCode: `ASH-BON-${voucher.month.replace(/-/g, '')}`,
      });
    } else {
      const cols: ExportTableColumn[] = [
        { header: 'ناوی کارمەند', key: 'empName', align: 'right' },
        { header: 'بەروار', key: 'date', align: 'center' },
        { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
        { header: 'تێبینی', key: 'note', align: 'right' },
      ];

      const data: Record<string, any>[] = voucher.items.map((w: any) => ({
        empName: w.employeeName || employees.find(emp => emp.id === w.employeeId)?.fullName3Part || 'کارمەند',
        date: w.date,
        amount: `${Number(w.amount || 0).toLocaleString()} IQD`,
        note: w.note || '—',
      }));

      data.push({
        isGrandTotal: true,
        empName: 'کۆی گشتی پارەی ڕاکێشراو',
        date: '—',
        amount: `${voucher.totalAmount.toLocaleString()} IQD`,
        note: `کۆی تەواوی ${voucher.itemCount} جاری ڕاکێشان لەم لیستەدا`,
      });

      exportToPDF({
        title: 'ڕاپۆرتی ڕاکێشانی پێشینە و پارەی کارمەندان',
        subtitle: voucher.name,
        period: `مانگی ${voucher.month} (${voucher.dateRange})`,
        columns: cols,
        data,
        orientation: 'portrait',
        fileName: `Ashley_Withdrawals_${voucher.name.replace(/[^\w\d-]/g, '_')}`,
        documentCode: `ASH-WTH-${voucher.month.replace(/-/g, '')}`,
      });
    }
  };

  // Format month for display in Kurdish
  const monthDisplayLabel = useMemo(() => {
    try {
      const [year, m] = selectedMonth.split('-').map(Number);
      const kurdishMonths = [
        'کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران',
        'تەممووز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'
      ];
      const mName = kurdishMonths[m - 1] || '';
      return `${mName}ی ${year} (${selectedMonth})`;
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  return (
    <div className="space-y-5 dir-rtl" dir="rtl">
      
      {/* 🧭 NAVIGATION TABS (Expenses / Bonuses / Withdrawals / Monthly Analytics) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-100/90 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab 1: Expenses */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('expenses');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'expenses' 
                ? 'bg-[#007AFF] text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>💸 مەسروفات و خەرجی</span>
          </button>

          {/* Tab 2: Bonuses */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('bonuses');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'bonuses' 
                ? 'bg-emerald-600 text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>🎁 پاداشت و بەخشش</span>
          </button>

          {/* Tab 3: Withdrawals */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('withdrawals');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-bold text-xs cursor-pointer ${
              activeTab === 'withdrawals' 
                ? 'bg-amber-600 text-white shadow-sm scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-white/5'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>🏧 ڕاکێشانی پێشینە</span>
          </button>

          {/* 🌟 Tab 4: COMPREHENSIVE MONTHLY FINANCIAL REPORT */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('analytics');
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 font-black text-xs cursor-pointer ${
              activeTab === 'analytics' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md scale-102' 
                : 'bg-white dark:bg-[#2c2c2e] text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/40'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>📊 ڕاپۆرتی گشتگیری دارایی مانگانە</span>
          </button>
        </div>

        {/* View Indicator Badge */}
        <div className="flex items-center gap-2">
          {activeTab === 'analytics' ? (
            <span className="px-3 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ڕاپۆرتی دارایی مانگانە</span>
            </span>
          ) : viewMode === 'archive' ? (
            <span className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>دۆخ: بینینی ئەرشیف</span>
            </span>
          ) : viewMode === 'create' ? (
            <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
              editingVoucherId 
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800' 
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-pulse'
            }`}>
              {editingVoucherId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingVoucherId ? 'دۆخ: دەستکاریکردنی لیست' : 'دۆخ: دروستکردنی لیستی نوێ'}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              <span>دۆخ: وردەکاری لیست</span>
            </span>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 📊 VIEW 4: MONTHLY ANALYTICS (EXPENSES, BONUSES, WITHDRAWALS) */}
      {/* ========================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          
          {/* Top Analytics Toolbar with Month Selector, Section-by-Section Print, and Excel Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>ڕاپۆرتی گشتگیری دارایی مانگانە</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  شیکاری و کۆکراوەی مەسروفات، پاداشت و پێشینە بۆ مانگی ({monthDisplayLabel})
                </span>
              </div>

              {/* Month Picker Controls */}
              <div className="flex items-center bg-slate-50 dark:bg-[#2c2c2e] p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  title="مانگی پێشوو"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="relative px-2 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 pointer-events-none" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white pointer-events-none">
                    {monthDisplayLabel}
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="هەڵبژاردنی مانگ لە کالێندەر"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  title="مانگی داهاتوو"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                ئەم مانگە
              </button>
            </div>

            {/* Section-by-Section Direct Print and Excel Action Group */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">🖨️ پرێنت:</span>

              {/* 1. Print Comprehensive Master Report */}
              <button
                type="button"
                onClick={handlePrintMonthlyAnalytics}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="چاپی تەواوی ڕاپۆرتی گشتگیری دارایی مانگانە (سێ بەشەکە پێکەوە)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپی گشتگیر</span>
              </button>

              {/* 2. Print Expenses Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyExpensesSection}
                className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی پسوولەکانی مەسروفاتی ئەم مانگە بە جیا"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>💸 مەسروفات</span>
              </button>

              {/* 3. Print Bonuses Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyBonusesSection}
                className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی سەرجەم پاداشتەکانی ئەم مانگە بە جیا"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>🎁 پاداشت</span>
              </button>

              {/* 4. Print Withdrawals Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyWithdrawalsSection}
                className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی سەرجەم پێشینەکانی ئەم مانگە بە جیا"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>🏧 پێشینە</span>
              </button>

              {/* Excel Export */}
              <button
                type="button"
                onClick={handleExportMonthlyAnalyticsCSV}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="داگرتنی ڕاپۆرتی گشتگیر وەک فایلی ئێکسڵ"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>📥 ئێکسڵ</span>
              </button>
            </div>
          </div>

          {/* 4 Core Summary Cards for the Month with Quick 1-Click Print Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Expenses */}
            <div className="p-4 bg-white dark:bg-[#1c1c1e] border-t-4 border-blue-500 rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/10 space-y-1">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span>💸 کۆی مەسروفات</span>
                  <span className="p-0.5 px-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 text-[10px]">{monthlyExpensesList.length} پسوولە</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePrintMonthlyExpensesSection(); }}
                  className="p-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="چاپی پسوولەکانی مەسروفاتی ئەم مانگە بە جیا"
                >
                  <Printer className="w-3 h-3" />
                  <span>چاپ</span>
                </button>
              </div>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {monthlyTotalExp.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">IQD</span>
              </p>
            </div>

            {/* Card 2: Bonuses */}
            <div className="p-4 bg-white dark:bg-[#1c1c1e] border-t-4 border-emerald-500 rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/10 space-y-1">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span>🎁 کۆی پاداشتەکان</span>
                  <span className="p-0.5 px-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-[10px]">{monthlyBonusesList.length} پاداشت</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePrintMonthlyBonusesSection(); }}
                  className="p-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="چاپی سەرجەم پاداشتەکانی ئەم مانگە بە جیا"
                >
                  <Printer className="w-3 h-3" />
                  <span>چاپ</span>
                </button>
              </div>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {monthlyTotalBon.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">IQD</span>
              </p>
            </div>

            {/* Card 3: Withdrawals */}
            <div className="p-4 bg-white dark:bg-[#1c1c1e] border-t-4 border-amber-500 rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/10 space-y-1">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span>🏧 ڕاکێشانی پێشینە</span>
                  <span className="p-0.5 px-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 text-[10px]">{monthlyWithdrawalsList.length} جار</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePrintMonthlyWithdrawalsSection(); }}
                  className="p-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="چاپی سەرجەم پێشینەکانی ئەم مانگە بە جیا"
                >
                  <Printer className="w-3 h-3" />
                  <span>چاپ</span>
                </button>
              </div>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {monthlyTotalWth.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">IQD</span>
              </p>
            </div>

            {/* Card 4: Grand Combined Total */}
            <div className="p-4 bg-white dark:bg-[#1c1c1e] border-t-4 border-purple-600 rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/10 space-y-1">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span>💰 کۆی گشتی دارایی مانگ</span>
                  <span className="p-0.5 px-1.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 text-[10px]">
                    {monthlyExpensesList.length + monthlyBonusesList.length + monthlyWithdrawalsList.length} جووڵە
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePrintMonthlyAnalytics(); }}
                  className="p-1 px-2 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="چاپی تەواوی ڕاپۆرتی گشتگیری دارایی مانگانە"
                >
                  <Printer className="w-3 h-3" />
                  <span>چاپی گشتگیر</span>
                </button>
              </div>
              <p className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono">
                {monthlyGrandTotal.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-400">IQD</span>
              </p>
            </div>
          </div>

          {/* Expenses Category Breakdown */}
          <div className="p-4 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>🏷️ وردەکاری جۆرەکانی مەسروفات لەم مانگەدا ({selectedMonth}):</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {Object.entries(categoryBreakdown).map(([k, v]) => (
                <div key={k} className={`p-2.5 rounded-xl border ${typeColors[k as keyof typeof typeColors]?.bg || 'bg-slate-50'} ${typeColors[k as keyof typeof typeColors]?.border || 'border-slate-200'}`}>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>{v.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">{v.count} پسوولە</span>
                  </div>
                  <p className="text-sm font-black font-mono mt-1 text-slate-900 dark:text-white">
                    {v.total.toLocaleString()} IQD
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-Tab Navigation Bar to inspect and print each section separately */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* SubTab 1: Combined */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('combined')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'combined'
                    ? 'bg-purple-600 text-white shadow-xs scale-102'
                    : 'bg-white dark:bg-[#1c1c1e] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/10'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>👥 پوختەی شایستەی کارمەندان ({employeeFinancialStats.length})</span>
              </button>

              {/* SubTab 2: Expenses */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('expenses')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'expenses'
                    ? 'bg-blue-600 text-white shadow-xs scale-102'
                    : 'bg-white dark:bg-[#1c1c1e] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/10'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>💸 وردەکاری مەسروفات ({monthlyExpensesList.length} پسوولە)</span>
              </button>

              {/* SubTab 3: Bonuses */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('bonuses')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'bonuses'
                    ? 'bg-emerald-600 text-white shadow-xs scale-102'
                    : 'bg-white dark:bg-[#1c1c1e] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/10'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>🎁 وردەکاری پاداشت ({monthlyBonusesList.length} پاداشت)</span>
              </button>

              {/* SubTab 4: Withdrawals */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('withdrawals')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'withdrawals'
                    ? 'bg-amber-600 text-white shadow-xs scale-102'
                    : 'bg-white dark:bg-[#1c1c1e] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/10'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>🏧 وردەکاری پێشینە ({monthlyWithdrawalsList.length} جار)</span>
              </button>
            </div>

            {/* Current SubTab Action Buttons (Print & Excel) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (analyticsSubTab === 'combined') handlePrintMonthlyAnalytics();
                  else if (analyticsSubTab === 'expenses') handlePrintMonthlyExpensesSection();
                  else if (analyticsSubTab === 'bonuses') handlePrintMonthlyBonusesSection();
                  else if (analyticsSubTab === 'withdrawals') handlePrintMonthlyWithdrawalsSection();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {analyticsSubTab === 'combined' && '🖨️ چاپی ڕاپۆرتی گشتگیر (PDF)'}
                  {analyticsSubTab === 'expenses' && '🖨️ چاپی بەشی مەسروفات (PDF)'}
                  {analyticsSubTab === 'bonuses' && '🖨️ چاپی بەشی پاداشت (PDF)'}
                  {analyticsSubTab === 'withdrawals' && '🖨️ چاپی بەشی پێشینە (PDF)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (analyticsSubTab === 'combined') handleExportMonthlyAnalyticsCSV();
                  else if (analyticsSubTab === 'expenses') handleExportMonthlyExpensesCSV();
                  else if (analyticsSubTab === 'bonuses') handleExportMonthlyBonusesCSV();
                  else if (analyticsSubTab === 'withdrawals') handleExportMonthlyWithdrawalsCSV();
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ئێکسڵ</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SUBTAB 1 CONTENT: MASTER PER-EMPLOYEE FINANCIAL TABLE     */}
          {/* ========================================================= */}
          {analyticsSubTab === 'combined' && (
            <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    خشتەی شایستە و دارایی کارمەندان لە مانگی ({selectedMonth})
                  </h3>
                </div>

                <div className="text-xs font-bold text-slate-500">
                  <span>ژمارەی کارمەندانی خاوەن دارایی: <strong className="text-slate-900 dark:text-white">{employeeFinancialStats.length}</strong></span>
                </div>
              </div>

              {employeeFinancialStats.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  هیچ جووڵەیەکی دارایی بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">مەسروفات (IQD)</th>
                        <th className="p-3 text-center">پاداشت (IQD)</th>
                        <th className="p-3 text-center">ڕاکێشانی پێشینە (IQD)</th>
                        <th className="p-3 text-center">کۆی گشتی دارایی (IQD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {employeeFinancialStats.map((item, idx) => (
                        <tr key={item.empId} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{item.empName}</td>
                          <td className="p-3 text-center text-slate-500">{item.role}</td>
                          
                          {/* Expenses */}
                          <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                            {item.expensesTotal > 0 ? `${item.expensesTotal.toLocaleString()} IQD` : '—'}
                            {item.expenseCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.expenseCount} پسوولە)
                              </span>
                            )}
                          </td>

                          {/* Bonuses */}
                          <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.bonusesTotal > 0 ? `${item.bonusesTotal.toLocaleString()} IQD` : '—'}
                            {item.bonusCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.bonusCount} جار)
                              </span>
                            )}
                          </td>

                          {/* Withdrawals */}
                          <td className="p-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                            {item.withdrawalsTotal > 0 ? `${item.withdrawalsTotal.toLocaleString()} IQD` : '—'}
                            {item.withdrawalCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.withdrawalCount} جار)
                              </span>
                            )}
                          </td>

                          {/* Grand Total */}
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono font-black text-xs">
                              {item.grandTotal.toLocaleString()} IQD
                            </span>
                          </td>
                        </tr>
                      ))}

                      {/* Master Grand Total Row */}
                      <tr className="bg-slate-900 text-white font-black">
                        <td colSpan={3} className="p-3 text-right">
                          کۆی گشتی تەواوی دارایی مانگی ({selectedMonth}):
                        </td>
                        <td className="p-3 text-center font-mono text-blue-400">
                          {monthlyTotalExp.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-center font-mono text-emerald-400">
                          {monthlyTotalBon.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-center font-mono text-amber-400">
                          {monthlyTotalWth.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-center font-mono text-purple-300 text-sm">
                          {monthlyGrandTotal.toLocaleString()} IQD
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBTAB 2 CONTENT: FULL MONTHLY EXPENSES TABLE             */}
          {/* ========================================================= */}
          {analyticsSubTab === 'expenses' && (
            <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    لیستی تەواوی پسوولەکانی مەسروفاتی مانگی ({selectedMonth})
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>ژمارەی پسوولەکان: <strong className="text-slate-900 dark:text-white">{monthlyExpensesList.length}</strong> • کۆی مەسروفات: <strong className="text-blue-600 dark:text-blue-400 font-mono">{monthlyTotalExp.toLocaleString()} IQD</strong></span>
                </div>
              </div>

              {monthlyExpensesList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  هیچ مەسروفاتێک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3 text-center">بەروار</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">جۆری خەرجی</th>
                        <th className="p-3">لە / بۆ</th>
                        <th className="p-3 text-center">ژ.سەفەر</th>
                        <th className="p-3 text-center">بڕی پارە (IQD)</th>
                        <th className="p-3">تێبینی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {(() => {
                        const groups = groupExpensesByEmployee(monthlyExpensesList, employees);
                        let globalIdx = 0;
                        return groups.map((group) => {
                          return (
                            <Fragment key={group.employeeKey}>
                              {group.items.map((item: any) => {
                                globalIdx += 1;
                                const currentIdx = globalIdx;
                                return (
                                  <tr key={item.id || currentIdx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-center font-mono text-slate-400 font-bold">{currentIdx}</td>
                                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                                    <td className="p-3 font-bold text-slate-900 dark:text-white">{group.employeeName}</td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg || ''} ${typeColors[item.type as keyof typeof typeColors]?.text || ''} ${typeColors[item.type as keyof typeof typeColors]?.border || ''}`}>
                                        {typeLabels[item.type] || item.category || 'تەکسی'}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">
                                      {item.from || item.to ? `${item.from || '—'} ⬅️ ${item.to || '—'}` : '—'}
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-500">{item.trip || '—'}</td>
                                    <td className="p-3 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                                      {Number(item.amount || 0).toLocaleString()} IQD
                                    </td>
                                    <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                                  </tr>
                                );
                              })}

                              {/* 🟡 Highlighted Subtotal Row for Employee */}
                              <tr className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-y-2 border-amber-300 dark:border-amber-700 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                                <td colSpan={5} className="p-3 text-right">
                                  <div className="flex items-center gap-2 font-black text-xs text-amber-900 dark:text-amber-200">
                                    <span className="text-amber-600 dark:text-amber-400 text-sm">📊</span>
                                    <span>کۆی گشتی ({group.employeeName})</span>
                                  </div>
                                </td>
                                <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-200 text-xs">
                                  {group.items.length} پسوولە
                                </td>
                                <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-100 text-xs">
                                  {group.totalAmount.toLocaleString()} IQD
                                </td>
                                <td className="p-3 text-amber-800 dark:text-amber-300 text-xs">
                                  —
                                </td>
                              </tr>
                            </Fragment>
                          );
                        });
                      })()}
                      <tr className="bg-slate-900 text-white font-black">
                        <td colSpan={6} className="p-3 text-right">
                          کۆی گشتی مەسروفاتی مانگی ({selectedMonth}):
                        </td>
                        <td className="p-3 text-center font-mono text-blue-400 text-sm">
                          {monthlyTotalExp.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-slate-400 font-normal">
                          {monthlyExpensesList.length} پسوولە
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBTAB 3 CONTENT: FULL MONTHLY BONUSES TABLE              */}
          {/* ========================================================= */}
          {analyticsSubTab === 'bonuses' && (
            <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    لیستی تەواوی پاداشتەکانی مانگی ({selectedMonth})
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>ژمارەی پاداشتەکان: <strong className="text-slate-900 dark:text-white">{monthlyBonusesList.length}</strong> • کۆی پاداشت: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{monthlyTotalBon.toLocaleString()} IQD</strong></span>
                </div>
              </div>

              {monthlyBonusesList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  هیچ پاداشتێک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3 text-center">بەروار</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">بڕی پاداشت (IQD)</th>
                        <th className="p-3">هۆکار / تێبینی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {monthlyBonusesList.map((item: any, idx: number) => {
                        const emp = employees.find(e => e.id === item.employeeId);
                        const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
                        const role = emp?.role ? String(emp.role) : 'کارمەند';
                        const amt = Number(item.totalAmount || item.amount || 0);
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{empName}</td>
                            <td className="p-3 text-center text-slate-500">{role}</td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {amt.toLocaleString()} IQD
                            </td>
                            <td className="p-3 text-slate-500">{item.notes || item.reason || 'پاداشتی دەستخۆشی'}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-900 text-white font-black">
                        <td colSpan={4} className="p-3 text-right">
                          کۆی گشتی پاداشتەکانی مانگی ({selectedMonth}):
                        </td>
                        <td className="p-3 text-center font-mono text-emerald-400 text-sm">
                          {monthlyTotalBon.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-slate-400 font-normal">
                          {monthlyBonusesList.length} پاداشت
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBTAB 4 CONTENT: FULL MONTHLY CASH WITHDRAWALS TABLE     */}
          {/* ========================================================= */}
          {analyticsSubTab === 'withdrawals' && (
            <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    لیستی تەواوی ڕاکێشانی پێشینەی مانگی ({selectedMonth})
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>جارەکانی ڕاکێشان: <strong className="text-slate-900 dark:text-white">{monthlyWithdrawalsList.length}</strong> • کۆی پێشینە: <strong className="text-amber-600 dark:text-amber-400 font-mono">{monthlyTotalWth.toLocaleString()} IQD</strong></span>
                </div>
              </div>

              {monthlyWithdrawalsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  هیچ پێشینەیەک بۆ مانگی ({selectedMonth}) تۆمار نەکراوە.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3 text-center">بەروار</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">بڕی پێشینە (IQD)</th>
                        <th className="p-3">تێبینی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {monthlyWithdrawalsList.map((item: any, idx: number) => {
                        const emp = employees.find(e => e.id === item.employeeId);
                        const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
                        const role = emp?.role ? String(emp.role) : 'کارمەند';
                        const amt = Number(item.amount || 0);
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{empName}</td>
                            <td className="p-3 text-center text-slate-500">{role}</td>
                            <td className="p-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                              {amt.toLocaleString()} IQD
                            </td>
                            <td className="p-3 text-slate-500">{item.notes || item.reason || '—'}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-900 text-white font-black">
                        <td colSpan={4} className="p-3 text-right">
                          کۆی گشتی پێشینەکانی مانگی ({selectedMonth}):
                        </td>
                        <td className="p-3 text-center font-mono text-amber-400 text-sm">
                          {monthlyTotalWth.toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-slate-400 font-normal">
                          {monthlyWithdrawalsList.length} جار
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 📁 VIEW 1: ARCHIVED LISTS (PRIMARY MAIN VIEW)             */}
      {/* ========================================================= */}
      {activeTab !== 'analytics' && viewMode === 'archive' && (
        <div className="space-y-4">
          
          {/* Top Action Bar: Prominent 'Create New List' Button + Month Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs">
            
            {/* 🌟 PROMINENT 'CREATE NEW LIST' BUTTON */}
            <button
              type="button"
              onClick={() => {
                setEditingVoucherId(null);
                setEditingVoucherName('');
                setEditingDraftItemId(null);
                setDraftItems([]);
                setViewMode('create');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>➕ دروستکردنی لیستی نوێ</span>
            </button>

            {/* 📅 CALENDAR & MONTH SELECTOR */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">مانگی ئەرشیف:</span>
              
              <div className="flex items-center bg-slate-50 dark:bg-[#2c2c2e] p-1 rounded-xl border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  title="مانگی پێشوو"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="relative px-2 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 pointer-events-none" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white pointer-events-none">
                    {monthDisplayLabel}
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="هەڵبژاردنی مانگ لە کالێندەر"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                  title="مانگی داهاتوو"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                ئەم مانگە
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={archiveSearchQuery}
                onChange={(e) => setArchiveSearchQuery(e.target.value)}
                placeholder="گەڕان لە لیستە ئەرشیفکراوەکان..."
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Archived Lists Table */}
          <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  لیستە ئەرشیفکراوەکانی ({activeTabMeta.name}) — {monthDisplayLabel}
                </h2>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span>ژمارەی لیستەکان: <strong className="text-slate-900 dark:text-white">{archiveStats.listCount}</strong></span>
                <span>•</span>
                <span>کۆی پسوولەکان: <strong className="text-slate-900 dark:text-white">{archiveStats.totalItems}</strong></span>
                <span>•</span>
                <span>کۆی پارە: <strong className="text-emerald-600 font-mono">{archiveStats.totalAmount.toLocaleString()} IQD</strong></span>
              </div>
            </div>

            {currentMonthArchivedVouchers.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  هیچ لیستێکی ئەرشیفکراو بۆ مانگی ({selectedMonth}) نەدۆزرایەوە
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  دەتوانیت مانگەکانی پێشوو بە کالێندەر سەیر بکەیت یان بە کلیک لەسەر دوگمەی خوارەوە دەست بکەیت بە دروستکردنی لیستی نوێ.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVoucherId(null);
                    setEditingVoucherName('');
                    setEditingDraftItemId(null);
                    setDraftItems([]);
                    setViewMode('create');
                  }}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>➕ دەستپێکردن و دروستکردنی لیستی نوێ</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3">ناوی لیست / کاتی خەزنکردن (Real-Time)</th>
                      <th className="p-3 text-center">ژمارەی پسوولەکان</th>
                      <th className="p-3 text-center">مەودای بەرواری خەرجییەکان</th>
                      <th className="p-3 text-center">کۆی گشتی (IQD)</th>
                      <th className="p-3 text-center w-52">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {currentMonthArchivedVouchers.map((voucher, idx) => (
                      <tr 
                        key={voucher.id} 
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors group"
                      >
                        <td className="p-3 text-center font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>

                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                              <Clock className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <span className="block text-xs font-black text-slate-900 dark:text-white">
                                {voucher.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                تۆمارکراو: {format(new Date(voucher.createdAt), 'yyyy-MM-dd • hh:mm a')}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                            {voucher.itemCount} پسوولە
                          </span>
                        </td>

                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400 font-bold">
                          📅 {voucher.dateRange}
                        </td>

                        <td className="p-3 text-center">
                          <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono font-black text-xs">
                            {voucher.totalAmount.toLocaleString()} IQD
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View / Inspect */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher(voucher);
                                setViewMode('view_voucher');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="بینینی تەواوی پسوولەکانی ئەم لیستە"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>بینین</span>
                            </button>

                            {/* ✏️ EDIT ARCHIVED LIST */}
                            <button
                              type="button"
                              onClick={() => handleStartEditVoucher(voucher)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="دەستکاریکردنی ئەم لیستە ئەرشیفکراوە (زیادکردن یان گۆڕینی پسوولەکان)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>دەستکاری</span>
                            </button>

                            {/* Direct Print */}
                            <button
                              type="button"
                              onClick={() => handlePrintVoucher(voucher)}
                              className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="چاپی ئەم لیستە بە شێوازی پۆرترەیت"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>پرێنت</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(voucher)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
                              title="سڕینەوەی ئەم لیستە"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 📝 VIEW 2: CREATE / EDIT LIST (WORKSHEET)                 */}
      {/* ========================================================= */}
      {activeTab !== 'analytics' && viewMode === 'create' && (
        <div className="space-y-4">
          
          {/* Header Bar with Back and Save List buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (draftItems.length > 0) {
                    if (!window.confirm('ئایا دڵنیایت لە گەڕانەوە؟ گۆڕانکارییەکان خەزن ناکرێن تا کلیک لەسەر پاشەکەوتکردن نەکەیت.')) return;
                  }
                  setEditingVoucherId(null);
                  setEditingDraftItemId(null);
                  setViewMode('archive');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>گەڕانەوە بۆ ئەرشیف</span>
              </button>

              <div>
                {editingVoucherId ? (
                  <div>
                    <h2 className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4" />
                      <span>دەستکاریکردنی لیست:</span>
                    </h2>
                    <input
                      type="text"
                      value={editingVoucherName}
                      onChange={(e) => setEditingVoucherName(e.target.value)}
                      className="mt-1 px-3 py-1 text-xs font-bold bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-72 max-w-full"
                      title="دەستکاریکردنی ناوی لیست"
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      دروستکردنی لیستی نوێی ({activeTabMeta.title})
                    </h2>
                    <span className="text-[11px] text-slate-500">
                      پسوولەکان بە هەر بەروارێک بێت زیاد بکە، پاشان کلیک لەسەر «خەزنکردن» بکە.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Prominent Save List Button */}
            <button
              type="button"
              onClick={handleSaveDraftList}
              className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer text-white ${
                editingVoucherId 
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' 
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {editingVoucherId 
                  ? `💾 پاشەکەوتکردنی دەستکارییەکان (${draftItems.length} پسوولە)` 
                  : `💾 تەواوکردن و خەزنکردنی ئەم لیستە (${draftItems.length} پسوولە)`
                }
              </span>
            </button>
          </div>

          {/* Quick Feedback alert */}
          {lastAddedFeedback && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lastAddedFeedback}</span>
            </div>
          )}

          {/* Rapid Input Form for adding / editing items in this worksheet */}
          <div className={`p-4 bg-white dark:bg-[#1c1c1e] border rounded-2xl shadow-xs space-y-4 ${
            editingDraftItemId ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/20' : 'border-slate-200/80 dark:border-white/10'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                {editingDraftItemId ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-600 dark:text-amber-400">دەستکاریکردنی ئەم پسوولەیە:</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>زیادکردنی پسوولەی نوێ بۆ ئەم لیستە (ئەکرێ چەند بەروارێکی تێدابێت):</span>
                  </>
                )}
              </h3>

              {editingDraftItemId && (
                <button
                  type="button"
                  onClick={handleCancelEditDraftItem}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>هەڵوەشاندنەوەی دەستکاری</span>
                </button>
              )}
            </div>

            <form onSubmit={handleAddRecordToDraft} className="space-y-4">
              
              {/* Row 1: Amount, Date (supports any date per item), Employee */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 💰 Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    بڕی پارە (IQD) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="بۆ نموونە: 25000"
                    autoFocus
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 📅 Date (User can set any date for each item!) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    بەرواری ئەم پسوولەیە <span className="text-blue-500">(هەر ڕۆژێک بێت)</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 👤 Employee Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    کارمەند {activeTab !== 'expenses' && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {activeTab === 'expenses' ? '🏢 مەسروفاتی گشتی کۆگا / کارگە' : 'تکایە کارمەند دیاری بکە'}
                    </option>
                    {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Category Pills (for expenses) */}
              {activeTab === 'expenses' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    پۆلێنی خەرجی:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categoryPills.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setExpenseType(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          expenseType === p.key
                            ? 'bg-blue-600 text-white shadow-2xs scale-102'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 3: Route Details (From, To, Trip) for Expenses */}
              {activeTab === 'expenses' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      لە (From)
                    </label>
                    <input
                      type="text"
                      value={fromLoc}
                      onChange={(e) => setFromLoc(e.target.value)}
                      placeholder="بۆ نموونە: کارگەی ئاشڵی"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      بۆ (To)
                    </label>
                    <input
                      type="text"
                      value={toLoc}
                      onChange={(e) => setToLoc(e.target.value)}
                      placeholder="بۆ نموونە: بازاڕی سلێمانی"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      ژمارەی سەفەر
                    </label>
                    <input
                      type="text"
                      value={tripNo}
                      onChange={(e) => setTripNo(e.target.value)}
                      placeholder="1, 2, چوون و گەڕانەوە"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Row 4: Note / Reason & Action Buttons */}
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {activeTab === 'bonuses' ? 'هۆکاری پاداشت' : 'تێبینی'}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={activeTab === 'bonuses' ? 'پاداشتی دەستخۆشی کارکردن' : 'تێبینی نووسین...'}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#2c2c2e] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="submit"
                    className={`w-full sm:w-auto shrink-0 px-6 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
                      editingDraftItemId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingDraftItemId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingDraftItemId ? '✓ نوێکردنەوەی ئەم پسوولەیە' : 'زیادکردن بۆ ئەم لیستە'}</span>
                  </button>

                  {editingDraftItemId && (
                    <button
                      type="button"
                      onClick={handleCancelEditDraftItem}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      هەڵوەشاندنەوە
                    </button>
                  )}
                </div>
              </div>

            </form>
          </div>

          {/* Draft Items Live Table with Row-Level Edit and Delete */}
          <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  پسوولە تۆمارکراوەکانی ناو ئەم لیستە ({draftItems.length} دانە)
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">کۆی گشتی ئەم لیستە:</span>
                <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-black text-sm border border-emerald-200 dark:border-emerald-800">
                  {draftItems.reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0).toLocaleString()} IQD
                </span>
              </div>
            </div>

            {draftItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                هێشتا هیچ پسوولەیەک بۆ ئەم لیستە زیاد نەکراوە. فۆڕمەکەی سەرەوە پڕبکەرەوە و کلیک لە «زیادکردن» بکە.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                      <th className="p-3 text-center w-10">#</th>
                      <th className="p-3">ناوی کارمەند</th>
                      <th className="p-3 text-center">بەروار</th>
                      {activeTab === 'expenses' && <th className="p-3 text-center">جۆر</th>}
                      {activeTab === 'expenses' && <th className="p-3">لە / بۆ</th>}
                      {activeTab === 'expenses' && <th className="p-3 text-center">ژ.سەفەر</th>}
                      <th className="p-3 text-center">بڕی پارە (IQD)</th>
                      <th className="p-3">تێبینی</th>
                      <th className="p-3 text-center w-24">دەستکاری / سڕینەوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {activeTab === 'expenses' ? (
                      (() => {
                        const groups = groupExpensesByEmployee(draftItems, employees);
                        let globalIdx = 0;
                        return groups.map((group) => {
                          return (
                            <Fragment key={group.employeeKey}>
                              {group.items.map((item: any) => {
                                globalIdx += 1;
                                const currentIdx = globalIdx;
                                return (
                                  <tr 
                                    key={item.id || currentIdx} 
                                    className={`transition-colors ${
                                      editingDraftItemId === item.id 
                                        ? 'bg-amber-50/80 dark:bg-amber-950/30' 
                                        : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <td className="p-3 text-center font-mono text-slate-400 font-bold">{currentIdx}</td>
                                    <td className="p-3 font-bold text-slate-900 dark:text-white">{group.employeeName}</td>
                                    <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                                    <td className="p-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg} ${typeColors[item.type as keyof typeof typeColors]?.text} ${typeColors[item.type as keyof typeof typeColors]?.border}`}>
                                        {typeLabels[item.type] || item.category || 'تەکسی'}
                                      </span>
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-300">
                                      {item.from || item.to ? `${item.from || '—'} ⬅️ ${item.to || '—'}` : '—'}
                                    </td>
                                    <td className="p-3 text-center font-mono text-slate-500">{item.trip || '—'}</td>
                                    <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                                    </td>
                                    <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                                    <td className="p-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditDraftItem(item)}
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                            editingDraftItemId === item.id 
                                              ? 'bg-amber-500 text-white shadow-2xs' 
                                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                          }`}
                                          title="دەستکاریکردنی ئەم پسوولەیە"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDraftItem(item.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                                          title="سڕینەوە لەم لیستەدا"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* 🟡 Highlighted Subtotal Row for Employee */}
                              <tr className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-y-2 border-amber-300 dark:border-amber-700 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                                <td colSpan={5} className="p-3 text-right">
                                  <div className="flex items-center gap-2 font-black text-xs text-amber-900 dark:text-amber-200">
                                    <span className="text-amber-600 dark:text-amber-400 text-sm">📊</span>
                                    <span>کۆی گشتی ({group.employeeName})</span>
                                  </div>
                                </td>
                                <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-200 text-xs">
                                  {group.items.length} پسوولە
                                </td>
                                <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-100 text-xs">
                                  {group.totalAmount.toLocaleString()} IQD
                                </td>
                                <td className="p-3 text-amber-800 dark:text-amber-300 text-xs">—</td>
                                <td className="p-3 text-center text-amber-800 dark:text-amber-300 text-xs">—</td>
                              </tr>
                            </Fragment>
                          );
                        });
                      })()
                    ) : (
                      draftItems.map((item, idx) => (
                        <tr 
                          key={item.id} 
                          className={`transition-colors ${
                            editingDraftItemId === item.id 
                              ? 'bg-amber-50/80 dark:bg-amber-950/30' 
                              : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
                          }`}
                        >
                          <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{item.employeeName || 'گشتی'}</td>
                          <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                          </td>
                          <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditDraftItem(item)}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                  editingDraftItemId === item.id 
                                    ? 'bg-amber-500 text-white shadow-2xs' 
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                }`}
                                title="دەستکاریکردنی ئەم پسوولەیە"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                                title="سڕینەوە لەم لیستەدا"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Save Action Bar */}
            {draftItems.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {editingVoucherId 
                    ? 'پاش تەواوبوونی دەستکارییەکانت، کلیک لەم دوگمەیە بکە بۆ پاشەکەوتکردن لە ئەرشیفدا.' 
                    : 'تەواو؟ کاتێک هەموو پسوولەکانت داخڵ کرد، کلیک لەم دوگمەیە بکە بۆ خەزنکردن بە ناوی کاتی ئێستا.'
                  }
                </span>

                <button
                  type="button"
                  onClick={handleSaveDraftList}
                  className={`px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer text-white ${
                    editingVoucherId 
                      ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800' 
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {editingVoucherId 
                      ? '💾 پاشەکەوتکردنی گۆڕانکارییەکانی ئەم لیستە لە ئەرشیف' 
                      : '💾 خەزنکردنی لیست لە ئەرشیف بە ناوی کاتی ئێستا'
                    }
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 👁️ VIEW 3: VIEW / INSPECT SPECIFIC ARCHIVED VOUCHER        */}
      {/* ========================================================= */}
      {activeTab !== 'analytics' && viewMode === 'view_voucher' && selectedVoucher && (
        <div className="space-y-4">
          
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('archive')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>گەڕانەوە بۆ ئەرشیف</span>
              </button>

              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedVoucher.name}</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  تۆمارکراو لە: {format(new Date(selectedVoucher.createdAt), 'yyyy-MM-dd • hh:mm a')} • مانگی: {selectedVoucher.month}
                </span>
              </div>
            </div>

            {/* Edit, Print & Delete Buttons */}
            <div className="flex items-center gap-2">
              {/* ✏️ EDIT THIS VOUCHER */}
              <button
                type="button"
                onClick={() => handleStartEditVoucher(selectedVoucher)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="دەستکاریکردنی ئەم لیستە (زیادکردن، گۆڕین یان سڕینەوەی پسوولەکان)"
              >
                <Edit3 className="w-4 h-4" />
                <span>دەستکاریکردنی ئەم لیستە</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintVoucher(selectedVoucher)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>🖨️ چاپی ئەم لیستە (PDF Portrait)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteVoucher(selectedVoucher)}
                className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوە</span>
              </button>
            </div>
          </div>

          {/* Voucher Items Table */}
          <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                پێڕستی هەموو پسوولەکانی ئەم لیستە ({selectedVoucher.itemCount} پسوولە):
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-black text-sm border border-emerald-200 dark:border-emerald-800">
                کۆی گشتی: {selectedVoucher.totalAmount.toLocaleString()} IQD
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                    <th className="p-3 text-center w-10">#</th>
                    <th className="p-3">ناوی کارمەند</th>
                    <th className="p-3 text-center">بەروار</th>
                    {selectedVoucher.type === 'expenses' && <th className="p-3 text-center">جۆر</th>}
                    {selectedVoucher.type === 'expenses' && <th className="p-3">لە / بۆ</th>}
                    {selectedVoucher.type === 'expenses' && <th className="p-3 text-center">ژ.سەفەر</th>}
                    <th className="p-3 text-center">بڕی پارە (IQD)</th>
                    <th className="p-3">تێبینی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {selectedVoucher.type === 'expenses' ? (
                    (() => {
                      const groups = groupExpensesByEmployee(selectedVoucher.items, employees);
                      let globalIdx = 0;
                      return groups.map((group) => {
                        return (
                          <Fragment key={group.employeeKey}>
                            {group.items.map((item: any) => {
                              globalIdx += 1;
                              const currentIdx = globalIdx;
                              return (
                                <tr key={item.id || currentIdx} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                                  <td className="p-3 text-center font-mono text-slate-400 font-bold">{currentIdx}</td>
                                  <td className="p-3 font-bold text-slate-900 dark:text-white">{group.employeeName}</td>
                                  <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg || ''} ${typeColors[item.type as keyof typeof typeColors]?.text || ''} ${typeColors[item.type as keyof typeof typeColors]?.border || ''}`}>
                                      {typeLabels[item.type] || item.category || 'تەکسی'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-600 dark:text-slate-300">
                                    {item.from || item.to ? `${item.from || '—'} ⬅️ ${item.to || '—'}` : '—'}
                                  </td>
                                  <td className="p-3 text-center font-mono text-slate-500">{item.trip || '—'}</td>
                                  <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                                  </td>
                                  <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                                </tr>
                              );
                            })}

                            {/* 🟡 Highlighted Subtotal Row for Employee */}
                            <tr className="bg-amber-100/90 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-y-2 border-amber-300 dark:border-amber-700 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                              <td colSpan={5} className="p-3 text-right">
                                <div className="flex items-center gap-2 font-black text-xs text-amber-900 dark:text-amber-200">
                                  <span className="text-amber-600 dark:text-amber-400 text-sm">📊</span>
                                  <span>کۆی گشتی ({group.employeeName})</span>
                                </div>
                              </td>
                              <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-200 text-xs">
                                {group.items.length} پسوولە
                              </td>
                              <td className="p-3 text-center font-mono font-black text-amber-900 dark:text-amber-100 text-xs">
                                {group.totalAmount.toLocaleString()} IQD
                              </td>
                              <td className="p-3 text-amber-800 dark:text-amber-300 text-xs">
                                —
                              </td>
                            </tr>
                          </Fragment>
                        );
                      });
                    })()
                  ) : (
                    selectedVoucher.items.map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                        <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{item.employeeName || 'گشتی'}</td>
                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-300">📅 {item.date}</td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                        </td>
                        <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                      </tr>
                    ))
                  )}
                  
                  {/* Final Grand Total Row */}
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={selectedVoucher.type === 'expenses' ? 6 : 3} className="p-3 text-right">
                      کۆی گشتی پسوولەکانی ئەم لیستە:
                    </td>
                    <td className="p-3 text-center font-mono text-emerald-400 text-sm">
                      {selectedVoucher.totalAmount.toLocaleString()} IQD
                    </td>
                    <td className="p-3 text-slate-400 font-normal">
                      {selectedVoucher.itemCount} پسوولە
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
