'use client';

import { logger } from '@/lib/logger';
import React, { useState, useMemo, useRef, useEffect, useCallback, Fragment } from 'react';
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
  Download,
  Sparkles,
  Check,
  Tag,
  Filter,
  Settings,
  RotateCcw,
  PieChart,
  TrendingUp,
  Zap,
  Award,
  GitBranch,
  Workflow,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Lock,
  Unlock,
  Building2
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';
import { 
  fetchCustomExpenseCategories, 
  saveCustomExpenseCategories, 
  fetchCustomPresetReasons, 
  saveCustomPresetReasons, 
  fetchCustomRoutes,
  saveCustomRoutes,
  type CustomRouteItem,
  DEFAULT_CUSTOM_ROUTES,
  DEFAULT_OVERTIME_REASONS,
  saveCustomOvertimeReasons,
  fetchArchivedVouchers, 
  saveArchivedVouchers 
} from '@/lib/supabase';
import { CategoryManagerModal, type ManagerTabType } from './expenses/CategoryManagerModal';
import { AuditLogModal } from './expenses/AuditLogModal';
import { PayrollSummarySlip } from './expenses/PayrollSummarySlip';
import { PendingExpensesTab } from './expenses/PendingExpensesTab';

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
  isLocked?: boolean; // 🔒 True if locked/closed, false/undefined if open
  lockedAt?: string;
  lockedBy?: string;
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
  return 'مەسروفاتی گشتی کۆگا';
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

// -------------------------------------------------------------
// ⚡ MANAGEABLE EXPENSE CATEGORIES & PRESET REASONS
// -------------------------------------------------------------
export interface CustomCategory {
  key: string;
  label: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: CustomCategory[] = [
  { key: 'taxi', label: 'کرێی تەکسی' },
  { key: 'fuel', label: 'بەنزین' },
  { key: 'food', label: 'خواردن' },
  { key: 'office', label: 'مەکتەب' },
  { key: 'other', label: 'تر' },
  { key: 'overtime', label: '⏰ کاتی زیادە و ئیزافە' },
];

export const DEFAULT_PRESET_EXPENSE_REASONS: Record<string, string[]> = {
  taxi: [
    'کرێ تەکسی بۆ چون لێدانی لەزگەی فرۆشراوە',
    'کرێ تەکسی کار باری کۆمپانیا',
    'کرێ تەکسی بۆ ڕێکخستنی کۆگا',
    'کرێ تەکسی بۆ نقڵ',
    'کرێ تەکسی هاتنەوە لە نقڵ',
  ],
  food: [
    'نان خواردن دەرەوەی شار',
    'نان خواردنی کارمەندان',
    'چای و قاوە و میوانداری',
  ],
  other: [
    'مەسروفاتی دەرەوەی شار',
    'مەسروفاتی کارگە و کۆگا',
    'مەسروفاتی پاککەرەوە و پێداویستی',
  ],
  fuel: [
    'بەنزینی ئۆتۆمبێلی کۆمپانیا',
    'بەنزینی مۆلیدەی کارگە',
  ],
  office: [
    'کەلوپەلی ئۆفیس و کارگێڕی',
    'چاپەمەنی و وەرەقە و مەرکەب',
  ],
  overtime: DEFAULT_OVERTIME_REASONS,
};

export const PRESET_EXPENSE_REASONS = DEFAULT_PRESET_EXPENSE_REASONS;

export const PRESET_BONUS_REASONS: string[] = [
  'پاداشتی دەستخۆشی کارکردن',
  'پاداشتی زیادەکارکردن (ئۆڤەرتایم)',
  'پاداشتی بەرهەمداری و چالاکی',
  'پاداشتی جەژن / بۆنە',
];

export const PRESET_WITHDRAWAL_REASONS: string[] = [
  'پێشینەی مووچەی مانگانە',
  'پێشینەی پێویستی کتوپڕ',
  'پێشینەی نەخۆشی / چارەسەر',
];

// -------------------------------------------------------------
// 🧠 SMART AUTOCOMPLETE & FREQUENCY-BASED TEXT PREDICTION
// -------------------------------------------------------------
export interface FieldFrequencyMap {
  from: Record<string, number>;
  to: Record<string, number>;
  trip: Record<string, number>;
  note: Record<string, number>;
}

export const FIELD_HISTORY_KEY = 'ashley_expenses_field_frequency_v1';

export const normalizeKurdish = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[\u0640]/g, '') // remove tatweel / kashida (ـ)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/[ي]/g, 'ی') // normalize arabic yeh to kurdish yeh
    .replace(/[ك]/g, 'ک') // normalize arabic kaf to kurdish kaf
    .replace(/[ھ]/g, 'ه') // normalize heh
    .trim()
    .toLowerCase();
};

export const getTopSuggestion = (value: string, historyMap: Record<string, number> = {}): string | null => {
  const query = normalizeKurdish(value);
  if (!query || query.length === 0) return null;

  const matches: { text: string; count: number }[] = [];

  for (const [text, count] of Object.entries(historyMap || {})) {
    const norm = normalizeKurdish(text);
    if (norm.startsWith(query) && norm !== query) {
      matches.push({ text, count });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.text.length - b.text.length;
  });

  return matches[0].text;
};

interface SmartSuggestInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  historyMap: Record<string, number>;
  placeholder?: string;
  className?: string;
  inputRef?: any;
  autoFocus?: boolean;
  subLabel?: React.ReactNode;
}

export function SmartSuggestInput({
  label,
  value,
  onChange,
  historyMap,
  placeholder,
  className = '',
  inputRef,
  autoFocus,
  subLabel,
}: SmartSuggestInputProps) {
  const topSuggestion = useMemo(() => getTopSuggestion(value, historyMap), [value, historyMap]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && topSuggestion) {
      e.preventDefault();
      onChange(topSuggestion);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 block">
          {label} {subLabel}
        </label>
        {topSuggestion && (
          <button
            type="button"
            onClick={() => onChange(topSuggestion)}
            className="text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-all flex items-center gap-1 cursor-pointer animate-in fade-in"
            title="کلیک بکە یان Tab دابگرە بۆ دانانی ئەم پێشنیارە"
          >
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            <span className="text-[10px] text-blue-500 font-mono">Tab ↹</span>
            <span className="opacity-75">پێشنیار:</span>
            <span className="underline font-black">{topSuggestion}</span>
          </button>
        )}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium ${className}`}
        />

        {topSuggestion && (
          <div
            onClick={() => onChange(topSuggestion)}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold cursor-pointer hover:bg-blue-100 transition-all shadow-2xs select-none"
            title="کلیک بکە یان Tab دابگرە بۆ قبوڵکردنی ئەم پێشنیارە"
          >
            <Sparkles className="w-2.5 h-2.5 text-blue-600 shrink-0" />
            <span className="font-black text-blue-800">{topSuggestion}</span>
            <kbd className="font-mono text-[9px] bg-white text-blue-600 px-1 py-0.2 rounded border border-blue-200 shadow-3xs">
              Tab ↹
            </kbd>
          </div>
        )}
      </div>
    </div>
  );
}

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
    overtime,
    activityLogs,
    setActivityLogs,
    settings 
  } = useAppContext();

  const employees = propEmployees || contextEmployees || [];

  // Active Tab: Expenses vs Bonuses vs Withdrawals vs Monthly Analytics vs Pending Requests
  const [activeTab, setActiveTab] = useState<'expenses' | 'bonuses' | 'withdrawals' | 'analytics' | 'pending'>('expenses');
  const [pendingCount, setPendingCount] = useState<number>(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses/pending');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        const count = data.requests.filter((r: any) => r.status === 'pending').length;
        setPendingCount(count);
      }
    } catch (e) {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 20000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  // View Mode: 'archive' (Initial Archived Lists) vs 'create' (Create/Edit List) vs 'view_voucher' (Inspect Specific List)
  const [viewMode, setViewMode] = useState<'archive' | 'create' | 'view_voucher'>('archive');

  // Calendar / Month Selection
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));

  // Search Filter in Archive
  const [archiveSearchQuery, setArchiveSearchQuery] = useState<string>('');

  // Selected Voucher to Inspect
  const [selectedVoucher, setSelectedVoucher] = useState<ArchivedVoucher | null>(null);

  // Sub-Tab for Monthly Financial Analytics: 'combined' vs 'expenses' vs 'bonuses' vs 'withdrawals' vs 'payroll'
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'combined' | 'expenses' | 'bonuses' | 'withdrawals' | 'payroll'>('combined');

  // Audit Log History Modal State
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  // Helper to record an audit action in Supabase
  const logAudit = useCallback((action: 'create' | 'update' | 'delete', entity: string, description: string, entityId?: string) => {
    const newLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: 'admin',
      username: 'بەڕێوەبەر',
      action,
      entity,
      entityId,
      description,
      timestamp: new Date().toISOString(),
    };
    if (setActivityLogs) {
      setActivityLogs((prev: any) => [newLog, ...(prev || [])]);
    }
  }, [setActivityLogs]);

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
      } catch (err) { logger.warn(err); }
    }
    return [];
  });

  // 🔘 Table Density Mode: 'cozy' (spacious) vs 'compact' (sleek and dense)
  const [tableDensity, setTableDensity] = useState<'cozy' | 'compact'>('cozy');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_table_density') as 'cozy' | 'compact';
      if (saved === 'cozy' || saved === 'compact') {
        setTableDensity(saved);
      }
    }
  }, []);

  // 🌟 Real-Time Cloud Sync on Mount: Pull custom categories, preset reasons, and vouchers from Supabase
  useEffect(() => {
    fetchCustomExpenseCategories().then(cloudCats => {
      if (cloudCats && cloudCats.length > 0) {
        setCategories(cloudCats as any);
        try {
          localStorage.setItem('ashley_custom_expense_categories_v2', JSON.stringify(cloudCats));
        } catch (err) { logger.warn(err); }
      }
    });

    fetchCustomPresetReasons().then(cloudReasons => {
      if (cloudReasons && Object.keys(cloudReasons).length > 0) {
        setPresetReasons(cloudReasons);
        try {
          localStorage.setItem('ashley_custom_preset_reasons_v2', JSON.stringify(cloudReasons));
        } catch (err) { logger.warn(err); }
      }
    });

    fetchArchivedVouchers().then(cloudVouchers => {
      if (cloudVouchers && cloudVouchers.length > 0) {
        setArchivedVouchers(cloudVouchers);
        try {
          localStorage.setItem('ashley_archived_vouchers_ledger_v3', JSON.stringify(cloudVouchers));
        } catch (err) { logger.warn(err); }
      }
    });
  }, []);

  const toggleTableDensity = () => {
    const next = tableDensity === 'cozy' ? 'compact' : 'cozy';
    setTableDensity(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_table_density', next);
    }
  };

  // Sync Archived Vouchers to LocalStorage & Supabase Cloud
  const saveVouchersToStorage = (updated: ArchivedVoucher[]) => {
    setArchivedVouchers(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ashley_archived_vouchers_ledger_v3', JSON.stringify(updated));
      } catch (err) {
        logger.error('Failed to save vouchers to localStorage:', err);
      }
    }
    // 🌟 Realtime Supabase Cloud Sync
    saveArchivedVouchers(updated).catch(err => {
      logger.error('Failed to sync vouchers to Supabase cloud:', err);
    });
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
  const [expenseType, setExpenseType] = useState<string>('taxi');
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [tripNo, setTripNo] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [note, setNote] = useState('');

  // 🔍 Selected Filters & Mode for Monthly Analytics Digital Studio
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [analyticsGraphMode, setAnalyticsGraphMode] = useState<'flowchart' | 'categories' | 'reasons' | 'daily' | 'distribution'>('flowchart');

  // 🧠 Field History & Frequency Storage for Smart Autocomplete
  const [fieldHistory, setFieldHistory] = useState<FieldFrequencyMap>(() => {
    const initial: FieldFrequencyMap = {
      from: {
        'کارگەی ئاشڵی': 20,
        'کۆگای ئاشڵی': 15,
        'کۆگا': 12,
        'سلێمانی': 10,
        'هوانە': 8,
        'نقڵ': 7,
      },
      to: {
        'هوانە': 25,
        'بازاڕی سلێمانی': 18,
        'کۆگای ئاشڵی': 15,
        'شوێنی کڕیار': 12,
        'کارگەی ئاشڵی': 10,
        'نقڵ': 8,
        'کۆگا': 7,
      },
      trip: {
        '1': 30,
        '2': 15,
        'چوون و گەڕانەوە': 10,
      },
      note: {
        'کرێ تەکسی بۆ چون لێدانی لەزگەی فرۆشراوە': 20,
        'کرێ تەکسی کار باری کۆمپانیا': 18,
        'کرێ تەکسی بۆ نقڵ': 15,
        'کرێ تەکسی هاتنەوە لە نقڵ': 15,
        'کرێ تەکسی بۆ ڕێکخستنی کۆگا': 12,
        'نان خواردن دەرەوەی شار': 12,
        'مەسروفاتی دەرەوەی شار': 10,
      },
    };

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(FIELD_HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            from: { ...initial.from, ...(parsed.from || {}) },
            to: { ...initial.to, ...(parsed.to || {}) },
            trip: { ...initial.trip, ...(parsed.trip || {}) },
            note: { ...initial.note, ...(parsed.note || {}) },
          };
        }
      } catch (err) {
        logger.error('Error loading field history:', err);
      }
    }
    return initial;
  });

  // Automatically index past entries from expenses and archived vouchers into fieldHistory
  useEffect(() => {
    const newFrom: Record<string, number> = {};
    const newTo: Record<string, number> = {};
    const newTrip: Record<string, number> = {};
    const newNote: Record<string, number> = {};

    const processItem = (item: any) => {
      if (item.from && typeof item.from === 'string' && item.from.trim()) {
        const f = item.from.trim();
        newFrom[f] = (newFrom[f] || 0) + 1;
      }
      if (item.to && typeof item.to === 'string' && item.to.trim()) {
        const t = item.to.trim();
        newTo[t] = (newTo[t] || 0) + 1;
      }
      if (item.trip && typeof item.trip === 'string' && item.trip.trim()) {
        const tr = item.trip.trim();
        newTrip[tr] = (newTrip[tr] || 0) + 1;
      }
      const n = (item.note || item.reason || '').trim();
      if (n) {
        newNote[n] = (newNote[n] || 0) + 1;
      }
    };

    (expenses || []).forEach(processItem);
    (archivedVouchers || []).forEach(v => {
      (v.items || []).forEach(processItem);
    });

    setFieldHistory(prev => {
      const merged: FieldFrequencyMap = {
        from: { ...prev.from },
        to: { ...prev.to },
        trip: { ...prev.trip },
        note: { ...prev.note },
      };

      for (const [k, v] of Object.entries(newFrom)) merged.from[k] = (merged.from[k] || 0) + v;
      for (const [k, v] of Object.entries(newTo)) merged.to[k] = (merged.to[k] || 0) + v;
      for (const [k, v] of Object.entries(newTrip)) merged.trip[k] = (merged.trip[k] || 0) + v;
      for (const [k, v] of Object.entries(newNote)) merged.note[k] = (merged.note[k] || 0) + v;

      return merged;
    });
  }, [expenses, archivedVouchers]);

  // 📁 Manageable Categories & Preset Reasons
  const [categories, setCategories] = useState<CustomCategory[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_custom_expense_categories_v2');
        if (stored) return JSON.parse(stored);
      } catch (err) { logger.warn(err); }
    }
    return DEFAULT_EXPENSE_CATEGORIES;
  });

  const [presetReasons, setPresetReasons] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_custom_preset_reasons_v2');
        if (stored) return JSON.parse(stored);
      } catch (err) { logger.warn(err); }
    }
    return DEFAULT_PRESET_EXPENSE_REASONS;
  });

  // Modal State for managing Categories, Reasons, and Routes
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [managerActiveTab, setManagerActiveTab] = useState<ManagerTabType>('reasons');
  const [managerSelectedCatKey, setManagerSelectedCatKey] = useState<string>('taxi');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('');

  const [newReasonText, setNewReasonText] = useState('');
  const [editingReasonIndex, setEditingReasonIndex] = useState<number | null>(null);
  const [editingReasonText, setEditingReasonText] = useState('');

  // Category Actions
  const handleAddCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCategoryName.trim()) return;
    const trimmed = newCategoryName.trim();
    if (categories.some(c => c.label === trimmed)) {
      alert('ئەم پۆلێنە پێشتر بوونی هەیە!');
      return;
    }
    const newKey = `cat_${Date.now()}`;
    const updated = [...categories, { key: newKey, label: trimmed }];
    setCategories(updated);
    try {
      localStorage.setItem('ashley_custom_expense_categories_v2', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    // 🌟 Supabase Cloud Sync
    saveCustomExpenseCategories(updated as any).catch(err => {
      logger.error('Failed to sync categories to Supabase:', err);
    });

    setPresetReasons(prev => {
      const next = { ...prev, [newKey]: [] };
      try {
        localStorage.setItem('ashley_custom_preset_reasons_v2', JSON.stringify(next));
      } catch (err) { logger.warn(err); }
      saveCustomPresetReasons(next).catch(err => {
        logger.error('Failed to sync preset reasons to Supabase:', err);
      });
      return next;
    });

    logAudit('create', 'category', `زیادکردنی پۆلێنی نوێی «${trimmed}» بۆ خەرجییەکان`);
    setNewCategoryName('');
    setExpenseType(newKey);
    setManagerSelectedCatKey(newKey);
  };

  const handleSaveEditCategory = (key: string) => {
    if (!editingCategoryLabel.trim()) return;
    const trimmed = editingCategoryLabel.trim();
    const updated = categories.map(c => c.key === key ? { ...c, label: trimmed } : c);
    setCategories(updated);
    try {
      localStorage.setItem('ashley_custom_expense_categories_v2', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    saveCustomExpenseCategories(updated as any).catch(err => {
      logger.error('Failed to sync updated categories to Supabase:', err);
    });
    logAudit('update', 'category', `دەستکاریکردنی ناوی پۆلێن بۆ «${trimmed}»`);
    setEditingCategoryKey(null);
    setEditingCategoryLabel('');
  };

  const handleDeleteCategory = (key: string) => {
    if (categories.length <= 1) {
      alert('ناتوانی هەموو پۆلێنەکان بسڕیتەوە! پێویستە لانیکەم یەک پۆلێن هەبێت.');
      return;
    }
    const cat = categories.find(c => c.key === key);
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی پۆلێنی «${cat?.label || key}»؟`)) return;
    const updated = categories.filter(c => c.key !== key);
    setCategories(updated);
    try {
      localStorage.setItem('ashley_custom_expense_categories_v2', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    saveCustomExpenseCategories(updated as any).catch(err => {
      logger.error('Failed to sync deleted category to Supabase:', err);
    });
    logAudit('delete', 'category', `سڕینەوەی پۆلێنی «${cat?.label || key}»`);
    if (expenseType === key) {
      setExpenseType(updated[0]?.key || 'taxi');
    }
    if (managerSelectedCatKey === key) {
      setManagerSelectedCatKey(updated[0]?.key || 'taxi');
    }
  };

  // Preset Reason Actions
  const handleAddReason = (catKey: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newReasonText.trim()) return;
    const trimmed = newReasonText.trim();
    const currentList = presetReasons[catKey] || [];
    if (currentList.includes(trimmed)) {
      alert('ئەم تێبینییە پێشتر بوونی هەیە لەم پۆلێنەدا!');
      return;
    }
    const updatedList = [...currentList, trimmed];
    const updatedMap = { ...presetReasons, [catKey]: updatedList };
    setPresetReasons(updatedMap);
    try {
      localStorage.setItem('ashley_custom_preset_reasons_v2', JSON.stringify(updatedMap));
    } catch (err) { logger.warn(err); }
    saveCustomPresetReasons(updatedMap).catch(err => {
      logger.error('Failed to sync preset reasons to Supabase:', err);
    });
    if (catKey === 'overtime') {
      saveCustomOvertimeReasons(updatedList).catch(() => {});
    }
    logAudit('create', 'preset_reason', `زیادکردنی تێبینی «${trimmed}» بۆ پۆلێنی ${catKey}`);
    setNewReasonText('');
  };

  const handleSaveEditReason = (catKey: string, index: number) => {
    if (!editingReasonText.trim()) return;
    const trimmed = editingReasonText.trim();
    const currentList = presetReasons[catKey] || [];
    const updatedList = currentList.map((r, i) => i === index ? trimmed : r);
    const updatedMap = { ...presetReasons, [catKey]: updatedList };
    setPresetReasons(updatedMap);
    try {
      localStorage.setItem('ashley_custom_preset_reasons_v2', JSON.stringify(updatedMap));
    } catch (err) { logger.warn(err); }
    saveCustomPresetReasons(updatedMap).catch(err => {
      logger.error('Failed to sync edited preset reason to Supabase:', err);
    });
    if (catKey === 'overtime') {
      saveCustomOvertimeReasons(updatedList).catch(() => {});
    }
    logAudit('update', 'preset_reason', `دەستکاریکردنی تێبینی بۆ «${trimmed}» لە پۆلێنی ${catKey}`);
    setEditingReasonIndex(null);
    setEditingReasonText('');
  };

  const handleDeleteReason = (catKey: string, index: number) => {
    const currentList = presetReasons[catKey] || [];
    const targetText = currentList[index];
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی تێبینی «${targetText}»؟`)) return;
    const updatedList = currentList.filter((_, i) => i !== index);
    const updatedMap = { ...presetReasons, [catKey]: updatedList };
    setPresetReasons(updatedMap);
    try {
      localStorage.setItem('ashley_custom_preset_reasons_v2', JSON.stringify(updatedMap));
    } catch (err) { logger.warn(err); }
    saveCustomPresetReasons(updatedMap).catch(err => {
      logger.error('Failed to sync deleted preset reason to Supabase:', err);
    });
    if (catKey === 'overtime') {
      saveCustomOvertimeReasons(updatedList).catch(() => {});
    }
    logAudit('delete', 'preset_reason', `سڕینەوەی تێبینی «${targetText}» لە پۆلێنی ${catKey}`);
  };

  const handleResetCategoryAndReasons = () => {
    if (!window.confirm('ئایا دڵنیایت لە گەڕاندنەوەی سەرجەم پۆلێن و تێبینییەکان بۆ باری بنەڕەتی سەرەتایی؟')) return;
    setCategories(DEFAULT_EXPENSE_CATEGORIES);
    setPresetReasons(DEFAULT_PRESET_EXPENSE_REASONS);
    try {
      localStorage.removeItem('ashley_custom_expense_categories_v2');
      localStorage.removeItem('ashley_custom_preset_reasons_v2');
    } catch (err) { logger.warn(err); }
    saveCustomExpenseCategories(DEFAULT_EXPENSE_CATEGORIES as any).catch(() => {});
    saveCustomPresetReasons(DEFAULT_PRESET_EXPENSE_REASONS).catch(() => {});
    saveCustomOvertimeReasons(DEFAULT_OVERTIME_REASONS).catch(() => {});
    logAudit('update', 'category', 'گەڕاندنەوەی پۆلێن و تێبینییەکان بۆ ڕێکخستنی بنەڕەتی');
    setExpenseType('taxi');
    setManagerSelectedCatKey('taxi');
    alert('سەرجەم پۆلێن و تێبینییەکان گەڕانەوە بۆ باری بنەڕەتی سەرەتایی.');
  };

  // 🚕 Manageable Custom Routes (Cloud & Telegram Synced)
  const [customRoutes, setCustomRoutes] = useState<CustomRouteItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ashley_custom_routes_v1');
        if (stored) return JSON.parse(stored);
      } catch (err) { logger.warn(err); }
    }
    return DEFAULT_CUSTOM_ROUTES;
  });

  // Load custom routes from Supabase on mount
  useEffect(() => {
    fetchCustomRoutes().then(routes => {
      if (routes && Array.isArray(routes) && routes.length > 0) {
        setCustomRoutes(routes);
        try {
          localStorage.setItem('ashley_custom_routes_v1', JSON.stringify(routes));
        } catch (err) { logger.warn(err); }
      }
    }).catch(err => logger.warn('Failed to load custom routes from Supabase:', err));
  }, []);

  const handleAddRoute = (from: string, to: string) => {
    const id = `r_${Date.now()}`;
    const newRoute: CustomRouteItem = {
      id,
      from,
      to,
      label: `${from} ⬅️ ${to}`,
    };
    const updated = [...customRoutes, newRoute];
    setCustomRoutes(updated);
    try {
      localStorage.setItem('ashley_custom_routes_v1', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    saveCustomRoutes(updated).catch(err => {
      logger.error('Failed to sync custom routes to Supabase:', err);
    });
    logAudit('create', 'category', `زیادکردنی هێڵی نوێی هاتوچۆ: ${from} بۆ ${to}`);
  };

  const handleSaveEditRoute = (id: string, from: string, to: string) => {
    const updated = customRoutes.map(r => r.id === id ? { ...r, from, to, label: `${from} ⬅️ ${to}` } : r);
    setCustomRoutes(updated);
    try {
      localStorage.setItem('ashley_custom_routes_v1', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    saveCustomRoutes(updated).catch(err => {
      logger.error('Failed to sync updated routes to Supabase:', err);
    });
    logAudit('update', 'category', `دەستکاریکردنی هێڵی هاتوچۆ: ${from} بۆ ${to}`);
  };

  const handleDeleteRoute = (id: string) => {
    const target = customRoutes.find(r => r.id === id);
    if (!window.confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم هێڵە: «${target?.from} ⬅️ ${target?.to}»؟`)) return;
    const updated = customRoutes.filter(r => r.id !== id);
    setCustomRoutes(updated);
    try {
      localStorage.setItem('ashley_custom_routes_v1', JSON.stringify(updated));
    } catch (err) { logger.warn(err); }
    saveCustomRoutes(updated).catch(err => {
      logger.error('Failed to sync deleted route to Supabase:', err);
    });
    logAudit('delete', 'category', `سڕینەوەی هێڵی هاتوچۆ: ${target?.from} بۆ ${target?.to}`);
  };

  const handleResetRoutes = () => {
    if (!window.confirm('ئایا دڵنیایت لە گەڕاندنەوەی سەرجەم هێڵەکانی هاتوچۆ بۆ باری بنەڕەتی سەرەتایی؟')) return;
    setCustomRoutes(DEFAULT_CUSTOM_ROUTES);
    try {
      localStorage.removeItem('ashley_custom_routes_v1');
    } catch (err) { logger.warn(err); }
    saveCustomRoutes(DEFAULT_CUSTOM_ROUTES).catch(() => {});
    logAudit('update', 'category', 'گەڕاندنەوەی هێڵەکانی هاتوچۆ بۆ ڕێکخستنی بنەڕەتی');
    alert('سەرجەم هێڵەکان گەڕانەوە بۆ باری بنەڕەتی سەرەتایی.');
  };

  const categoryPills = categories;

  const typeLabels: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {
      taxi: 'کرێی تەکسی',
      fuel: 'بەنزین',
      food: 'خواردن',
      office: 'مەکتەب',
      other: 'تر',
    };
    categories.forEach(c => {
      map[c.key] = c.label;
    });
    return map;
  }, [categories]);

  const defaultPalette = [
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  ];

  const typeColors = useMemo(() => {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      taxi: defaultPalette[0],
      fuel: defaultPalette[1],
      food: defaultPalette[2],
      office: defaultPalette[3],
      other: defaultPalette[9],
    };
    categories.forEach((c, idx) => {
      if (!map[c.key]) {
        map[c.key] = defaultPalette[(idx + 4) % defaultPalette.length];
      }
    });
    return map;
  }, [categories]);

  // ⚡ Preset reasons for current tab / category
  const currentPresetReasons = useMemo(() => {
    if (activeTab === 'expenses') {
      return presetReasons[expenseType] || [];
    }
    if (activeTab === 'bonuses') {
      return PRESET_BONUS_REASONS;
    }
    if (activeTab === 'withdrawals') {
      return PRESET_WITHDRAWAL_REASONS;
    }
    return [];
  }, [activeTab, expenseType, presetReasons]);

  const handleSelectPresetReason = (reasonText: string) => {
    setNote(reasonText);

    // Smart autofill for taxi routes & trip
    if (activeTab === 'expenses' && expenseType === 'taxi') {
      if (reasonText === 'کرێ تەکسی بۆ نقڵ') {
        if (!fromLoc) setFromLoc('کارگە / کۆگا');
        if (!toLoc) setToLoc('نقڵ');
        if (!tripNo) setTripNo('1');
      } else if (reasonText === 'کرێ تەکسی هاتنەوە لە نقڵ') {
        if (!fromLoc) setFromLoc('نقڵ');
        if (!toLoc) setToLoc('کارگە / کۆگا');
        if (!tripNo) setTripNo('1');
      } else if (reasonText === 'کرێ تەکسی بۆ چون لێدانی لەزگەی فرۆشراوە') {
        if (!fromLoc) setFromLoc('کارگە');
        if (!toLoc) setToLoc('شوێنی کڕیار');
        if (!tripNo) setTripNo('1');
      } else if (reasonText === 'کرێ تەکسی بۆ ڕێکخستنی کۆگا') {
        if (!toLoc) setToLoc('کۆگا');
        if (!tripNo) setTripNo('1');
      } else if (reasonText === 'کرێ تەکسی کار باری کۆمپانیا') {
        if (!tripNo) setTripNo('1');
      }
    }
  };

  // UX Feedback for fast entry
  const [lastAddedFeedback, setLastAddedFeedback] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

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
        color: 'text-blue-600',
        badgeBg: 'bg-blue-600',
      };
    } else if (activeTab === 'bonuses') {
      return {
        name: 'پاداشت',
        title: 'پاداشت و بەخشش',
        icon: Gift,
        color: 'text-emerald-600',
        badgeBg: 'bg-emerald-600',
      };
    } else if (activeTab === 'withdrawals') {
      return {
        name: 'ڕاکێشانی پارە',
        title: 'ڕاکێشانی پێشینە',
        icon: Banknote,
        color: 'text-amber-600',
        badgeBg: 'bg-amber-600',
      };
    } else {
      return {
        name: 'ئاماری مانگانە',
        title: 'ئاماری مانگانەی سێ بەشەکە',
        icon: BarChart3,
        color: 'text-purple-600',
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
    } catch (err) { logger.warn(err); }
  };

  const handleNextMonth = () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const next = addMonths(new Date(year, month - 1, 1), 1);
      setSelectedMonth(format(next, 'yyyy-MM'));
    } catch (err) { logger.warn(err); }
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
    const map: Record<string, { count: number; total: number; label: string }> = {};
    categories.forEach(c => {
      map[c.key] = { count: 0, total: 0, label: c.label };
    });

    monthlyExpensesList.forEach((e: any) => {
      const t = (e.type as string) || 'other';
      if (!map[t]) map[t] = { count: 0, total: 0, label: typeLabels[t] || 'تر' };
      map[t].count += 1;
      map[t].total += Number(e.amount || 0);
    });

    return map;
  }, [monthlyExpensesList, categories, typeLabels]);

  // Reason / Note breakdown for monthly expenses analytics
  const reasonBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number; label: string; category?: string }> = {};

    monthlyExpensesList.forEach((e: any) => {
      const rawReason = (e.note || e.reason || 'بێ تێبینی').trim();
      if (!map[rawReason]) {
        map[rawReason] = {
          count: 0,
          total: 0,
          label: rawReason,
          category: e.type || e.category,
        };
      }
      map[rawReason].count += 1;
      map[rawReason].total += Number(e.amount || 0);
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthlyExpensesList]);

  // Filtered monthly expenses by reason, category, and day if selected
  const filteredMonthlyExpenses = useMemo(() => {
    let list = monthlyExpensesList;
    if (selectedCategoryFilter) {
      list = list.filter((item: any) => {
        const cat = item.type || item.category || 'other';
        return cat === selectedCategoryFilter;
      });
    }
    if (selectedReasonFilter) {
      list = list.filter((item: any) => {
        const rawReason = (item.note || item.reason || 'بێ تێبینی').trim();
        return rawReason === selectedReasonFilter;
      });
    }
    if (selectedDayFilter !== null) {
      list = list.filter((item: any) => {
        if (!item.date) return false;
        return parseInt(item.date.split('-')[2] || '0', 10) === selectedDayFilter;
      });
    }
    return list;
  }, [monthlyExpensesList, selectedCategoryFilter, selectedReasonFilter, selectedDayFilter]);

  const filteredMonthlyTotalExp = useMemo(() => {
    return filteredMonthlyExpenses.reduce((sum, item: any) => sum + Number(item.amount || item.totalAmount || 0), 0);
  }, [filteredMonthlyExpenses]);

  // Executive KPI Badges:
  // 1. Top Category
  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryBreakdown);
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b[1].total - a[1].total);
    if (sorted[0] && sorted[0][1].total > 0) {
      const percentage = monthlyTotalExp > 0 ? Math.round((sorted[0][1].total / monthlyTotalExp) * 100) : 0;
      return { key: sorted[0][0], ...sorted[0][1], percentage };
    }
    return null;
  }, [categoryBreakdown, monthlyTotalExp]);

  // 2. Top Reason
  const topReason = useMemo(() => {
    if (reasonBreakdown.length === 0 || reasonBreakdown[0].total === 0) return null;
    const item = reasonBreakdown[0];
    const percentage = monthlyTotalExp > 0 ? Math.round((item.total / monthlyTotalExp) * 100) : 0;
    return { ...item, percentage };
  }, [reasonBreakdown, monthlyTotalExp]);

  // 3. Daily Expenses Breakdown & Peak Day
  const dailyStats = useMemo(() => {
    const parts = selectedMonth.split('-');
    const year = parseInt(parts[0], 10) || new Date().getFullYear();
    const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dailyMap: Record<number, { day: number; dateStr: string; total: number; count: number; items: any[] }> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = d < 10 ? `0${d}` : `${d}`;
      const fullDate = `${selectedMonth}-${dStr}`;
      dailyMap[d] = { day: d, dateStr: fullDate, total: 0, count: 0, items: [] };
    }

    monthlyExpensesList.forEach((e: any) => {
      if (!e.date) return;
      const dayNum = parseInt(e.date.split('-')[2] || '0', 10);
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        dailyMap[dayNum].total += Number(e.amount || e.totalAmount || 0);
        dailyMap[dayNum].count += 1;
        dailyMap[dayNum].items.push(e);
      }
    });

    const list = Object.values(dailyMap);
    const activeDays = list.filter(d => d.total > 0);
    const avgDaily = activeDays.length > 0 ? Math.round(monthlyTotalExp / activeDays.length) : 0;
    const peakDay = [...list].sort((a, b) => b.total - a.total)[0] || null;

    return {
      days: list,
      activeDaysCount: activeDays.length,
      avgDaily,
      peakDay: peakDay && peakDay.total > 0 ? peakDay : null,
      maxDayAmount: Math.max(...list.map(d => d.total), 1)
    };
  }, [selectedMonth, monthlyExpensesList, monthlyTotalExp]);

  // Category-Filtered Reasons Breakdown
  const categoryFilteredReasons = useMemo(() => {
    if (!selectedCategoryFilter) return reasonBreakdown;
    const map: Record<string, { count: number; total: number; label: string; category?: string }> = {};
    monthlyExpensesList.forEach((e: any) => {
      const cat = (e.type as string) || (e.category as string) || 'other';
      if (cat !== selectedCategoryFilter) return;
      const rawReason = (e.note || e.reason || 'بێ تێبینی').trim();
      if (!map[rawReason]) {
        map[rawReason] = { count: 0, total: 0, label: rawReason, category: cat };
      }
      map[rawReason].count += 1;
      map[rawReason].total += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthlyExpensesList, selectedCategoryFilter, reasonBreakdown]);

  // 🌳 Hierarchical Flowchart Data: Root -> Categories -> Preset Reasons
  const flowchartData = useMemo(() => {
    const nodes = categories.map((cat) => {
      const catExpenses = monthlyExpensesList.filter((e: any) => {
        const t = e.type || e.category || 'other';
        return t === cat.key;
      });

      const catTotal = catExpenses.reduce((sum, e: any) => sum + Number(e.amount || e.totalAmount || 0), 0);
      const catCount = catExpenses.length;
      const catPercentage = monthlyTotalExp > 0 ? Math.round((catTotal / monthlyTotalExp) * 100) : 0;

      // Group reasons under this category
      const reasonsMap: Record<string, { label: string; total: number; count: number }> = {};
      catExpenses.forEach((e: any) => {
        const raw = (e.note || e.reason || 'بێ تێبینی').trim();
        if (!reasonsMap[raw]) {
          reasonsMap[raw] = { label: raw, total: 0, count: 0 };
        }
        reasonsMap[raw].total += Number(e.amount || e.totalAmount || 0);
        reasonsMap[raw].count += 1;
      });

      const reasonsList = Object.values(reasonsMap)
        .sort((a, b) => b.total - a.total)
        .map((r) => ({
          ...r,
          percentOfCat: catTotal > 0 ? Math.round((r.total / catTotal) * 100) : 0,
          percentOfTotal: monthlyTotalExp > 0 ? Math.round((r.total / monthlyTotalExp) * 100) : 0,
        }));

      return {
        key: cat.key,
        label: cat.label,
        total: catTotal,
        count: catCount,
        percentage: catPercentage,
        reasons: reasonsList,
      };
    });

    return {
      rootTotal: monthlyTotalExp,
      rootCount: monthlyExpensesList.length,
      categories: nodes,
    };
  }, [categories, monthlyExpensesList, monthlyTotalExp]);


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
      const displayName = e.employeeName || (empObj ? (empObj.fullName3Part || empObj.name) : 'مەسروفاتی گشتی کۆگا');
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
      index: 'کۆ',
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
      { header: 'ڕێڕەو (لە ← بۆ)', key: 'route', align: 'right' },
      { header: 'ژ.سەفەر', key: 'trip', align: 'center', width: '55px' },
      { header: 'بڕی پارە (IQD)', key: 'amount', align: 'center' },
      { header: 'تێبینی', key: 'note', align: 'right' },
    ];

    const targetExpenses = selectedReasonFilter 
      ? monthlyExpensesList.filter((item: any) => (item.note || item.reason || 'بێ تێبینی').trim() === selectedReasonFilter)
      : monthlyExpensesList;
    const targetTotal = targetExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const groups = groupExpensesByEmployee(targetExpenses, employees);
    const data: Record<string, any>[] = [];
    let globalIdx = 0;

    groups.forEach(group => {
      group.items.forEach(item => {
        globalIdx += 1;
        const route = (item.from || item.to) ? `${item.from || '—'} ← ${item.to || '—'}` : (item.route || '—');
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
      index: 'کۆ',
      date: 'کۆی گشتی',
      empName: `${targetExpenses.length} پسوولە`,
      type: '—',
      route: '—',
      trip: '—',
      amount: `${targetTotal.toLocaleString()} IQD`,
      note: '',
    });

    exportToPDF({
      title: selectedReasonFilter ? `ڕاپۆرتی مەسروفات — هۆکاری (${selectedReasonFilter})` : 'ڕاپۆرتی مانگانەی مەسروفات و خەرجییەکان',
      subtitle: selectedReasonFilter 
        ? `کۆمپانیای مۆبیلیاتی ئاشڵی — لیستی خەرجییەکان فلتەرکراو بەپێی: ${selectedReasonFilter}`
        : 'کۆمپانیای مۆبیلیاتی ئاشڵی — لیستی وردەکاری سەرجەم مەسروفاتەکانی مانگ',
      period: `مانگی ${monthDisplayLabel}${selectedReasonFilter ? ` • ${selectedReasonFilter}` : ''}`,
      columns: cols,
      data,
      orientation: 'portrait',
      fileName: selectedReasonFilter 
        ? `Ashley_Expenses_${selectedMonth}_${selectedReasonFilter.replace(/\s+/g, '_')}`
        : `Ashley_Monthly_Expenses_${selectedMonth}`,
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
      index: 'کۆ',
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
      index: 'کۆ',
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

    const targetExpenses = selectedReasonFilter 
      ? monthlyExpensesList.filter((item: any) => (item.note || item.reason || 'بێ تێبینی').trim() === selectedReasonFilter)
      : monthlyExpensesList;
    const targetTotal = targetExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const groups = groupExpensesByEmployee(targetExpenses, employees);
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
      empName: `${targetExpenses.length} پسوولە`,
      type: 'گشتی',
      from: '',
      to: '',
      trip: '',
      amount: targetTotal,
      note: '',
    });

    exportToCSV(
      cols, 
      data, 
      selectedReasonFilter 
        ? `Ashley_Monthly_Expenses_${selectedMonth}_${selectedReasonFilter.replace(/\s+/g, '_')}`
        : `Ashley_Monthly_Expenses_${selectedMonth}`
    );
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

    // 🧠 Learn and store text entries in fieldHistory for future smart suggestions
    const recordText = (field: 'from' | 'to' | 'trip' | 'note', text: string) => {
      if (!text || !text.trim()) return;
      const t = text.trim();
      setFieldHistory(prev => {
        const next = {
          ...prev,
          [field]: {
            ...prev[field],
            [t]: (prev[field][t] || 0) + 1,
          },
        };
        try {
          localStorage.setItem(FIELD_HISTORY_KEY, JSON.stringify(next));
        } catch (err) { logger.warn(err); }
        return next;
      });
    };

    if (fromLoc) recordText('from', fromLoc);
    if (toLoc) recordText('to', toLoc);
    if (tripNo) recordText('trip', tripNo);
    if (note) recordText('note', note);

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
      alert(`هیچ پسوولەیەک لەم لیستەدا نییە.\nتکایە سەرەتا پسوولەکان زیاد بکە پاشان کلیک لەسەر خەزنکردن بکە.`);
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
      alert(`سەرکەوتوو بوو:\nگۆڕانکارییەکانی (${updatedName}) بە سەرکەوتوویی پاشەکەوت کران!\n• ژمارەی پسوولەکان: ${draftItems.length}\n• کۆی گشتی: ${totalAmt.toLocaleString()} IQD`);
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

    alert(`سەرکەوتوو بوو:\n${realTimeName} بە سەرکەوتوویی لە ئەرشیفدا خەزن کرا!\n• ژمارەی پسوولەکان: ${draftItems.length}\n• کۆی گشتی: ${totalAmt.toLocaleString()} IQD\n• مەودای بەروار: ${dateRange}`);
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
  // 🔒 LOCK / UNLOCK ARCHIVED VOUCHER (قوفڵکردن / کردنەوەی لیست)
  // -------------------------------------------------------------
  const handleToggleLockVoucher = (voucher: ArchivedVoucher) => {
    const willLock = !voucher.isLocked;
    const confirmMsg = willLock 
      ? `ئایا دڵنیایت لە قوفڵکردنی لیستی «${voucher.name}»؟\n\nتێبینی: کاتێک لیستێک قوفڵ دەکرێت، هیچ مەسروفاتێکی نوێ لە بۆتەوە ناچێتە نێوی و وەک ئەرشیفی داخراو دەمێنێتەوە.\nئەگەر کارمەندێک لە بۆت مەسروفات بنێرێت و پەسەند بکرێت، خۆکارانە لیستی نوێ دروست دەبێت.`
      : `ئایا دڵنیایت لە کردنەوەی لیستی «${voucher.name}»؟\n\nتێبینی: کاتێک دەکرێتەوە، خەرجییە نوێیە پەسەندکراوەکانی بۆت دەخرێنەوە نێو ئەم لیستە.`;

    if (!window.confirm(confirmMsg)) return;

    const updated = archivedVouchers.map(v => {
      if (v.id === voucher.id) {
        return {
          ...v,
          isLocked: willLock,
          lockedAt: willLock ? new Date().toISOString() : undefined,
          lockedBy: willLock ? 'بەڕێوەبەر' : undefined,
        };
      }
      return v;
    });

    setArchivedVouchers(updated);
    saveVouchersToStorage(updated);
    logAudit('update', 'voucher', `${willLock ? 'قوفڵکردنی' : 'کردنەوەی'} لیستی «${voucher.name}»`);

    if (selectedVoucher?.id === voucher.id) {
      setSelectedVoucher(prev => prev ? { ...prev, isLocked: willLock, lockedAt: willLock ? new Date().toISOString() : undefined } : null);
    }
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
        { header: 'لە', key: 'from', align: 'right' },
        { header: 'بۆ', key: 'to', align: 'right' },
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

  // 📐 Dynamic Table Density Padding Helper
  const cellPad = tableDensity === 'compact' ? 'py-1.5 px-2.5 text-[11px]' : 'p-3 text-xs';

  return (
    <div className="space-y-5 dir-rtl" dir="rtl">
      
      {/* 🧭 NAVIGATION TABS (Expenses / Bonuses / Withdrawals / Monthly Analytics) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Tab 1: Expenses */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('expenses');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-xs cursor-pointer active:scale-95 ${
              activeTab === 'expenses' 
                ? 'bg-white text-blue-700 shadow-xs font-black border border-blue-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
            }`}
          >
            <TrendingDown className={`w-4 h-4 ${activeTab === 'expenses' ? 'text-blue-600' : 'text-slate-400'}`} />
            <span>مەسروفات و خەرجی</span>
          </button>

          {/* Tab 2: Bonuses */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('bonuses');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-xs cursor-pointer active:scale-95 ${
              activeTab === 'bonuses' 
                ? 'bg-white text-emerald-700 shadow-xs font-black border border-emerald-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
            }`}
          >
            <Gift className={`w-4 h-4 ${activeTab === 'bonuses' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>پاداشت و بەخشش</span>
          </button>

          {/* Tab 3: Withdrawals */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('withdrawals');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-xs cursor-pointer active:scale-95 ${
              activeTab === 'withdrawals' 
                ? 'bg-white text-amber-700 shadow-xs font-black border border-amber-200/80' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
            }`}
          >
            <Banknote className={`w-4 h-4 ${activeTab === 'withdrawals' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>ڕاکێشانی پێشینە</span>
          </button>

          {/* Tab 4: COMPREHENSIVE MONTHLY FINANCIAL REPORT */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('analytics');
            }}
            className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-xs cursor-pointer active:scale-95 ${
              activeTab === 'analytics' 
                ? 'bg-white text-purple-700 shadow-xs font-black border border-purple-200/80' 
                : 'text-slate-600 hover:text-purple-700 hover:bg-white/60 font-bold'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-purple-600' : 'text-purple-400'}`} />
            <span>ڕاپۆرتی گشتگیری دارایی مانگانە</span>
          </button>

          {/* Tab 5: PENDING EXPENSES FROM TELEGRAM & WEB */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('pending');
              if (viewMode === 'view_voucher') setViewMode('archive');
            }}
            className={`px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-xs cursor-pointer relative active:scale-95 ${
              activeTab === 'pending' 
                ? 'bg-white text-amber-700 shadow-xs font-black border border-amber-200/80' 
                : 'text-slate-600 hover:text-amber-700 hover:bg-white/60 font-bold'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'pending' ? 'text-amber-600' : 'text-amber-500'}`} />
            <span>داواکارییە هەڵپەسێردراوەکان</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* View Indicator Badge & Sleek Density Toggle */}
        <div className="flex items-center gap-2">
          {/* 🔘 Sleek Table Density Toggle (Compact vs Cozy) */}
          <button
            type="button"
            onClick={toggleTableDensity}
            className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title={tableDensity === 'cozy' ? 'گۆڕینی دیمەن بۆ شێوازی ناسک و کۆکراوە (Compact Mode)' : 'گۆڕینی دیمەن بۆ شێوازی فراوان (Cozy Mode)'}
          >
            {tableDensity === 'cozy' ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="hidden sm:inline text-[11px]">شێوازی ناسک (کۆکراوە)</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="hidden sm:inline text-[11px]">شێوازی فراوان (Cozy)</span>
              </>
            )}
          </button>

          {/* 📜 Audit Trail History Button */}
          <button
            type="button"
            onClick={() => setIsAuditLogOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="بینینی مێژووی دەستکارییەکان و چاودێری دارایی (Audit Trail)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="hidden sm:inline text-[11px]">مێژووی چاودێری</span>
          </button>

          {/* ⚙️ Manage Notes & Routes Button (Telegram & Web Sync) */}
          <button
            type="button"
            onClick={() => {
              setManagerActiveTab('reasons');
              setIsCategoryManagerOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
            title="بەڕێوەبردنی تێبینی و هێڵەکان (تەلەگرام & وێبسایت)"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline text-[11px]">بەڕێوەبردنی تێبینی و هێڵەکان</span>
          </button>

          {activeTab === 'pending' ? (
            <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5" />
              <span>داواکارییە هەڵپەسێردراوەکان ({pendingCount})</span>
            </span>
          ) : activeTab === 'analytics' ? (
            <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ڕاپۆرتی دارایی مانگانە</span>
            </span>
          ) : viewMode === 'archive' ? (
            <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <FileText className="w-3.5 h-3.5" />
              <span>دۆخ: بینینی ئەرشیف</span>
            </span>
          ) : viewMode === 'create' ? (
            <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
              editingVoucherId 
                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {editingVoucherId ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{editingVoucherId ? 'دۆخ: دەستکاریکردنی لیست' : 'دۆخ: دروستکردنی لیستی نوێ'}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
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
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>ڕاپۆرتی گشتگیری دارایی مانگانە</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  شیکاری و کۆکراوەی مەسروفات، پاداشت و پێشینە بۆ مانگی ({monthDisplayLabel})
                </span>
              </div>

              {/* Month Picker Controls */}
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="مانگی پێشوو"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="relative px-2 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-purple-600 pointer-events-none" />
                  <span className="text-xs font-bold text-slate-900 pointer-events-none">
                    {monthDisplayLabel}
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="هەڵبژاردنی مانگ"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="مانگی داهاتوو"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                ئەم مانگە
              </button>
            </div>

            {/* Section-by-Section Direct Print and Excel Action Group */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-slate-400 ml-1" />

              {/* 1. Print Comprehensive Master Report */}
              <button
                type="button"
                onClick={handlePrintMonthlyAnalytics}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="چاپی تەواوی ڕاپۆرتی گشتگیری دارایی مانگانە"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپی گشتگیر</span>
              </button>

              {/* 2. Print Expenses Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyExpensesSection}
                className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی پسوولەکانی مەسروفاتی ئەم مانگە بە جیا"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>مەسروفات</span>
              </button>

              {/* 3. Print Bonuses Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyBonusesSection}
                className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی سەرجەم پاداشتەکانی ئەم مانگە بە جیا"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>پاداشت</span>
              </button>

              {/* 4. Print Withdrawals Section */}
              <button
                type="button"
                onClick={handlePrintMonthlyWithdrawalsSection}
                className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="چاپی سەرجەم پێشینەکانی ئەم مانگە بە جیا"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>پێشینە</span>
              </button>

              {/* Excel Export */}
              <button
                type="button"
                onClick={handleExportMonthlyAnalyticsCSV}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                title="داگرتنی ڕاپۆرتی گشتگیر وەک فایلی ئێکسڵ"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>ئێکسڵ</span>
              </button>
            </div>
          </div>

          {/* 4 Core Summary Cards for the Month with Modern Bento & Animated Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Expenses */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:rotate-3 transition-transform">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">کۆی مەسروفات</span>
                      <span className="text-[10px] text-blue-600 font-mono font-bold">{monthlyExpensesList.length} پسوولە</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePrintMonthlyExpensesSection(); }}
                    className="p-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer hover:shadow-xs active:scale-95"
                    title="چاپی پسوولەکانی مەسروفاتی ئەم مانگە بە جیا"
                  >
                    <Printer className="w-3 h-3" />
                    <span>چاپ</span>
                  </button>
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-1.5">
                    <span>{monthlyTotalExp.toLocaleString()}</span>
                    <span className="text-xs font-sans font-bold text-slate-400">IQD</span>
                  </p>
                </div>

                {/* Animated Ratio Bar */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>ڕێژەی لە کۆی گشتی</span>
                    <span className="font-mono font-bold text-blue-600">
                      {monthlyGrandTotal > 0 ? Math.round((monthlyTotalExp / monthlyGrandTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${monthlyGrandTotal > 0 ? Math.min(100, Math.round((monthlyTotalExp / monthlyGrandTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Bonuses */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">کۆی پاداشتەکان</span>
                      <span className="text-[10px] text-emerald-600 font-mono font-bold">{monthlyBonusesList.length} پاداشت</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePrintMonthlyBonusesSection(); }}
                    className="p-1.5 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer hover:shadow-xs active:scale-95"
                    title="چاپی سەرجەم پاداشتەکانی ئەم مانگە بە جیا"
                  >
                    <Printer className="w-3 h-3" />
                    <span>چاپ</span>
                  </button>
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-1.5">
                    <span>{monthlyTotalBon.toLocaleString()}</span>
                    <span className="text-xs font-sans font-bold text-slate-400">IQD</span>
                  </p>
                </div>

                {/* Animated Ratio Bar */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>ڕێژەی لە کۆی گشتی</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {monthlyGrandTotal > 0 ? Math.round((monthlyTotalBon / monthlyGrandTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${monthlyGrandTotal > 0 ? Math.min(100, Math.round((monthlyTotalBon / monthlyGrandTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Withdrawals */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:rotate-3 transition-transform">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">ڕاکێشانی پێشینە</span>
                      <span className="text-[10px] text-amber-600 font-mono font-bold">{monthlyWithdrawalsList.length} جار</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePrintMonthlyWithdrawalsSection(); }}
                    className="p-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer hover:shadow-xs active:scale-95"
                    title="چاپی سەرجەم پێشینەکانی ئەم مانگە بە جیا"
                  >
                    <Printer className="w-3 h-3" />
                    <span>چاپ</span>
                  </button>
                </div>

                <div>
                  <p className="text-2xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-1.5">
                    <span>{monthlyTotalWth.toLocaleString()}</span>
                    <span className="text-xs font-sans font-bold text-slate-400">IQD</span>
                  </p>
                </div>

                {/* Animated Ratio Bar */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>ڕێژەی لە کۆی گشتی</span>
                    <span className="font-mono font-bold text-amber-600">
                      {monthlyGrandTotal > 0 ? Math.round((monthlyTotalWth / monthlyGrandTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${monthlyGrandTotal > 0 ? Math.min(100, Math.round((monthlyTotalWth / monthlyGrandTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Grand Combined Total */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-purple-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2.5">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">کۆی گشتی دارایی</span>
                      <span className="text-[10px] text-purple-600 font-mono font-bold">
                        {monthlyExpensesList.length + monthlyBonusesList.length + monthlyWithdrawalsList.length} جووڵە
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handlePrintMonthlyAnalytics(); }}
                    className="p-1.5 px-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-700 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer hover:shadow-xs active:scale-95"
                    title="چاپی تەواوی ڕاپۆرتی گشتگیری دارایی مانگانە"
                  >
                    <Printer className="w-3 h-3" />
                    <span>چاپی گشتگیر</span>
                  </button>
                </div>

                <div>
                  <p className="text-2xl font-black text-purple-600 font-mono tracking-tight flex items-baseline gap-1.5">
                    <span>{monthlyGrandTotal.toLocaleString()}</span>
                    <span className="text-xs font-sans font-bold text-slate-400">IQD</span>
                  </p>
                </div>

                {/* Total Balance Activity Indicator */}
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>کۆی هاوسەنگی جووڵەکان</span>
                    <span className="font-mono font-bold text-purple-600">100%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex gap-0.5">
                    <div 
                      className="h-full bg-blue-500 rounded-s-full transition-all duration-700"
                      title="مەسروفات"
                      style={{ width: `${monthlyGrandTotal > 0 ? (monthlyTotalExp / monthlyGrandTotal) * 100 : 0}%` }}
                    />
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-700"
                      title="پاداشت"
                      style={{ width: `${monthlyGrandTotal > 0 ? (monthlyTotalBon / monthlyGrandTotal) * 100 : 0}%` }}
                    />
                    <div 
                      className="h-full bg-amber-500 rounded-e-full transition-all duration-700"
                      title="پێشینە"
                      style={{ width: `${monthlyGrandTotal > 0 ? (monthlyTotalWth / monthlyGrandTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 📊 INTERACTIVE DIGITAL ANALYTICS STUDIO & GRAPH TOOLKIT    */}
          {/* ========================================================= */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
            
            {/* Header Toolbar: Title, Active Filters & View Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>گرافی دیجیتاڵی و شیکاری مەسروفات</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-mono font-bold border border-purple-200/60">
                        مانگی {monthDisplayLabel}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      شیکاری ڕوون و بینراوی پۆلێنەکان، تێبینییەکان و دابەشبوونی ڕۆژانەی خەرجی
                    </p>
                  </div>
                </div>
              </div>

              {/* View Switcher Buttons (Flowchart, Categories, Reasons, Daily Curve, Distribution) */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAnalyticsGraphMode('flowchart')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    analyticsGraphMode === 'flowchart'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Workflow className="w-3.5 h-3.5" />
                  <span>فلۆو چارت</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyticsGraphMode('categories')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    analyticsGraphMode === 'categories'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>پۆلێنەکان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyticsGraphMode('reasons')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    analyticsGraphMode === 'reasons'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/25 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تێبینییەکان</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyticsGraphMode('daily')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    analyticsGraphMode === 'daily'
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/25 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>چەماوەی ڕۆژانە</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyticsGraphMode('distribution')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                    analyticsGraphMode === 'distribution'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 scale-[1.02]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5" />
                  <span>دابەشکاری (%)</span>
                </button>
              </div>
            </div>

            {/* Active Drill-Down Filter Chips Bar (Shows up when user clicks any element to filter) */}
            {(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) && (
              <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs">
                <span className="font-bold text-blue-900 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>فلتەری کارلێککار:</span>
                </span>

                {selectedCategoryFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 font-bold shadow-2xs">
                    <span>پۆلێن: {typeLabels[selectedCategoryFilter] || selectedCategoryFilter}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter(null)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {selectedReasonFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 font-bold shadow-2xs">
                    <span>تێبینی: {selectedReasonFilter}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedReasonFilter(null)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                    >
                      ✕
                    </button>
                  </span>
                )}

                {selectedDayFilter !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 font-bold shadow-2xs">
                    <span>ڕۆژی: {selectedDayFilter}ی مانگ</span>
                    <button
                      type="button"
                      onClick={() => setSelectedDayFilter(null)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                    >
                      ✕
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter(null);
                    setSelectedReasonFilter(null);
                    setSelectedDayFilter(null);
                  }}
                  className="mr-auto px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors cursor-pointer text-[11px]"
                >
                  پاککردنەوەی هەمووی ✕
                </button>
              </div>
            )}

            {/* Row of 4 Executive Micro-Metric Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Badge 1: Top Category */}
              <div 
                onClick={() => topCategory && setSelectedCategoryFilter(prev => prev === topCategory.key ? null : topCategory.key)}
                className={`group relative overflow-hidden p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between ${
                  selectedCategoryFilter === topCategory?.key
                    ? 'bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-500/20 -translate-y-0.5'
                    : 'bg-white/80 hover:bg-slate-50 border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                title="کلیک بکە بۆ فلتەرکردنی ئەم پۆلێنە"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-5 h-5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Award className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">باوترین پۆلێن</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {topCategory ? topCategory.label : 'هیچ خەرجییەک نییە'}
                  </p>
                  <p className="text-[11px] font-mono text-blue-600 font-extrabold">
                    {topCategory ? `${topCategory.total.toLocaleString()} IQD` : '—'}
                  </p>
                </div>
                {topCategory && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-blue-100/80 text-blue-700 font-mono font-black text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    %{topCategory.percentage}
                  </span>
                )}
              </div>

              {/* Badge 2: Top Reason */}
              <div 
                onClick={() => topReason && setSelectedReasonFilter(prev => prev === topReason.label ? null : topReason.label)}
                className={`group relative overflow-hidden p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between ${
                  selectedReasonFilter === topReason?.label
                    ? 'bg-amber-50/90 border-amber-500 shadow-md ring-2 ring-amber-500/20 -translate-y-0.5'
                    : 'bg-white/80 hover:bg-slate-50 border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                title="کلیک بکە بۆ فلتەرکردنی ئەم هۆکارە"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">باوترین تێبینی</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {topReason ? topReason.label : '—'}
                  </p>
                  <p className="text-[11px] font-mono text-amber-600 font-extrabold">
                    {topReason ? `${topReason.total.toLocaleString()} IQD` : '—'}
                  </p>
                </div>
                {topReason && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-amber-100/80 text-amber-700 font-mono font-black text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                    {topReason.count} پسوولە
                  </span>
                )}
              </div>

              {/* Badge 3: Daily Average */}
              <div className="group relative overflow-hidden p-3.5 rounded-2xl border bg-white/80 hover:bg-slate-50 border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 flex items-center justify-between">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">تێکڕای ڕۆژانە</span>
                  </div>
                  <p className="text-xs font-black text-slate-900 font-mono truncate">
                    {dailyStats.avgDaily.toLocaleString()} IQD
                  </p>
                  <p className="text-[10px] text-slate-400">
                    لە {dailyStats.activeDaysCount} ڕۆژی چالاکدا
                  </p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs group-hover:rotate-6 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>

              {/* Badge 4: Peak Spending Day */}
              <div 
                onClick={() => dailyStats.peakDay && setSelectedDayFilter(prev => prev === dailyStats.peakDay?.day ? null : dailyStats.peakDay!.day)}
                className={`group relative overflow-hidden p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between ${
                  selectedDayFilter === dailyStats.peakDay?.day
                    ? 'bg-purple-50/90 border-purple-500 shadow-md ring-2 ring-purple-500/20 -translate-y-0.5'
                    : 'bg-white/80 hover:bg-slate-50 border-slate-200/80 hover:-translate-y-0.5 hover:shadow-md'
                }`}
                title="کلیک بکە بۆ بینینی خەرجییەکانی ڕۆژی لوتکە"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                    <span className="w-5 h-5 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">ڕۆژی لوتکەی خەرجی</span>
                  </div>
                  <p className="text-xs font-black text-purple-700 font-mono truncate">
                    {dailyStats.peakDay ? dailyStats.peakDay.dateStr : '—'}
                  </p>
                  <p className="text-[11px] font-mono text-purple-600 font-extrabold">
                    {dailyStats.peakDay ? `${dailyStats.peakDay.total.toLocaleString()} IQD` : '—'}
                  </p>
                </div>
                {dailyStats.peakDay && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-purple-100/80 text-purple-700 font-mono font-bold text-xs shrink-0 shadow-2xs group-hover:scale-105 transition-transform flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>لوتکە</span>
                  </span>
                )}
              </div>
            </div>

            {/* ========================================================= */}
            {/* VIEW MODE: FLOWCHART TREE (فلۆو چارتی پەیوەندی مەسروفات)  */}
            {/* ========================================================= */}
            {analyticsGraphMode === 'flowchart' && (
              <div className="space-y-4 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Workflow className="w-4 h-4 text-purple-600 animate-pulse" />
                    <span>هێڵکاری فلۆو چارتی مەسروفات (کۆی گشتی ← پۆلێنەکان ← تێبینییەکان):</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    (کلیک لە هەر بەشێک یان هۆکارێک بکە بۆ بینینی پسوولەکانی لە خوارەوە)
                  </span>
                </div>

                {/* Flowchart Visual Surface */}
                <div className="p-4 sm:p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl overflow-x-auto shadow-inner">
                  <div className="min-w-[800px] flex flex-col items-center">
                    
                    {/* LEVEL 0: ROOT MASTER NODE */}
                    <div className="flex flex-col items-center">
                      <div 
                        onClick={() => {
                          setSelectedCategoryFilter(null);
                          setSelectedReasonFilter(null);
                          setSelectedDayFilter(null);
                        }}
                        className={`px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-700 text-white shadow-md border-2 border-white/20 flex items-center gap-3.5 cursor-pointer hover:scale-102 transition-all active:scale-98 relative group ${
                          !selectedCategoryFilter && !selectedReasonFilter && selectedDayFilter === null
                            ? 'ring-4 ring-purple-400/40'
                            : ''
                        }`}
                        title="کلیک بکە بۆ پیشاندانی سەرجەم خەرجییەکان"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-purple-200 block uppercase tracking-wider">
                            کۆی گشتی بودجەی مەسروفات
                          </span>
                          <span className="text-lg font-black font-mono tracking-tight">
                            {monthlyTotalExp.toLocaleString()} IQD
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-white/20 text-[11px] font-bold font-mono">
                          {monthlyExpensesList.length} پسوولە • 100%
                        </span>
                      </div>

                      {/* Stem Connector down to Trunk */}
                      <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-500 to-slate-400" />
                    </div>

                    {/* HORIZONTAL TRUNK LINE & CATEGORY COLUMNS */}
                    <div className="w-full relative">
                      {/* Horizontal connecting trunk bar */}
                      <div className="hidden md:block absolute top-0 left-12 right-12 h-0.5 bg-slate-300" />

                      {/* Columns Grid */}
                      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(categories.length, 5)} gap-4 pt-3`}>
                        {flowchartData.categories.map((cat) => {
                          const isSelectedCat = selectedCategoryFilter === cat.key;
                          const palette = typeColors[cat.key] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

                          return (
                            <div key={cat.key} className="flex flex-col items-center">
                              {/* Vertical Drop from Trunk to Category Card */}
                              <div className="w-0.5 h-3 bg-slate-300" />

                              {/* LEVEL 1: CATEGORY PROCESS NODE */}
                              <div
                                onClick={() => setSelectedCategoryFilter(prev => prev === cat.key ? null : cat.key)}
                                className={`w-full p-3 rounded-xl border-2 transition-all cursor-pointer relative shadow-xs hover:shadow-md ${
                                  isSelectedCat
                                    ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/30'
                                    : 'bg-white border-slate-200 hover:border-blue-400'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${palette.bg} ${palette.text} ${palette.border}`}>
                                    {cat.label}
                                  </span>
                                  <span className="text-[10px] font-mono font-black text-slate-500">
                                    %{cat.percentage}
                                  </span>
                                </div>

                                <div className="flex items-baseline justify-between text-xs font-mono font-black text-slate-900 mt-1.5">
                                  <span>{cat.total.toLocaleString()} IQD</span>
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    {cat.count} پسوولە
                                  </span>
                                </div>

                                {/* Mini Progress bar */}
                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
                                  <div
                                    className={`h-full rounded-full ${
                                      isSelectedCat ? 'bg-blue-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                    }`}
                                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Stem down to Reasons */}
                              <div className="w-0.5 h-3 bg-slate-300" />

                              {/* LEVEL 2: REASONS & NOTES SUB-TREE LEAVES */}
                              <div className="w-full space-y-1.5">
                                {cat.reasons.length === 0 ? (
                                  <div className="p-2 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                                    بێ پسوولە
                                  </div>
                                ) : (
                                  cat.reasons.map((r) => {
                                    const isSelectedReason = selectedReasonFilter === r.label;
                                    return (
                                      <div
                                        key={r.label}
                                        onClick={() => setSelectedReasonFilter(prev => prev === r.label ? null : r.label)}
                                        className={`p-2 rounded-lg border text-right transition-all cursor-pointer relative group text-xs ${
                                          isSelectedReason
                                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                                            : 'bg-white/90 border-slate-200/70 hover:border-amber-400'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                          <span className="truncate text-slate-800" title={r.label}>
                                            • {r.label}
                                          </span>
                                          <span className="text-[10px] font-mono text-amber-600 font-bold shrink-0">
                                            %{r.percentOfCat}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-slate-500">
                                          <span className="font-black text-slate-700">
                                            {r.total.toLocaleString()} IQD
                                          </span>
                                          <span>{r.count} پسوولە</span>
                                        </div>

                                        {/* Relative Bar */}
                                        <div className="w-full h-0.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                          <div
                                            className="h-full bg-amber-500 rounded-full"
                                            style={{ width: `${Math.min(r.percentOfCat, 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 1: CATEGORIES VIEW                             */}
            {/* ========================================================= */}
            {analyticsGraphMode === 'categories' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>دابەشبوونی مەسروفات بەپێی پۆلێنەکان ({categories.length} پۆلێن)</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((cat) => {
                    const data = categoryBreakdown[cat.key] || { count: 0, total: 0, label: cat.label };
                    const isSelected = selectedCategoryFilter === cat.key;
                    const percentage = monthlyTotalExp > 0 ? Math.round((data.total / monthlyTotalExp) * 100) : 0;
                    const palette = typeColors[cat.key] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

                    return (
                      <div
                        key={cat.key}
                        onClick={() => setSelectedCategoryFilter(prev => prev === cat.key ? null : cat.key)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${palette.bg} ${palette.text} ${palette.border}`}>
                              {cat.label}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md">
                                ✓ چالاکە
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 font-bold">
                            {data.count} پسوولە
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between mb-2">
                          <span className="text-base font-black font-mono text-slate-900">
                            {data.total.toLocaleString()} <span className="text-xs font-normal text-slate-400">IQD</span>
                          </span>
                          <span className="text-xs font-mono font-black text-slate-600">
                            %{percentage}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isSelected ? 'bg-blue-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>

                        {/* Drill-down prompt */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span className="group-hover:text-blue-600 transition-colors font-medium">
                            {isSelected ? 'فلتەرکراوە • کلیک بکە بۆ لابردن' : 'کلیک بکە بۆ فلتەرکردنی ئەم پۆلێنە'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategoryFilter(cat.key);
                              setAnalyticsGraphMode('reasons');
                            }}
                            className="text-blue-600 font-bold hover:underline cursor-pointer"
                          >
                            تێبینییەکان ⬅️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 2: REASONS & NOTES RANKING                      */}
            {/* ========================================================= */}
            {analyticsGraphMode === 'reasons' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">
                      ڕیزبەندی تێبینی و هۆکارەکان ({categoryFilteredReasons.length} هۆکار):
                    </span>
                    {selectedCategoryFilter && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-bold text-[11px]">
                        فلتەرکراو بۆ پۆلێنی: {typeLabels[selectedCategoryFilter] || selectedCategoryFilter}
                      </span>
                    )}
                  </div>
                  {selectedCategoryFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter(null)}
                      className="text-blue-600 text-xs font-bold hover:underline cursor-pointer"
                    >
                      پیشاندانی تێبینی سەرجەم پۆلێنەکان ✕
                    </button>
                  )}
                </div>

                {categoryFilteredReasons.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    هیچ تێبینییەک بۆ ئەم مانگە یاخود ئەم پۆلێنە نەدۆزرایەوە.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {categoryFilteredReasons.map((item, idx) => {
                      const isSelected = selectedReasonFilter === item.label;
                      const percentage = monthlyTotalExp > 0 ? Math.round((item.total / monthlyTotalExp) * 100) : 0;
                      const maxReasonTotal = categoryFilteredReasons[0]?.total || 1;
                      const relativeBar = Math.round((item.total / maxReasonTotal) * 100);

                      return (
                        <div
                          key={item.label}
                          onClick={() => setSelectedReasonFilter(prev => prev === item.label ? null : item.label)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/30 shadow-xs'
                              : 'bg-white border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate" title={item.label}>
                                {item.label}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              {item.count} پسوولە
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-mono font-black text-amber-600">
                              {item.total.toLocaleString()} IQD
                            </span>
                            <span className="text-[11px] font-mono font-bold text-slate-400">
                              %{percentage}
                            </span>
                          </div>

                          {/* Relative Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isSelected ? 'bg-amber-500' : 'bg-gradient-to-r from-amber-400 to-amber-600'
                              }`}
                              style={{ width: `${Math.min(relativeBar, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 3: DAILY SPENDING TIMELINE / HISTOGRAM          */}
            {/* ========================================================= */}
            {analyticsGraphMode === 'daily' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>چەماوە و بەرزی خەرجی لە ڕۆژانی مانگی ({selectedMonth}):</span>
                    <span className="text-[10px] text-slate-400 font-normal">(کلیک لە هەر ڕۆژێک بکە بۆ بینینی پسوولەکانی ئەو ڕۆژە)</span>
                  </span>
                  {selectedDayFilter !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedDayFilter(null)}
                      className="text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      پیشاندانی هەموو ڕۆژەکان ✕
                    </button>
                  )}
                </div>

                {/* Histogram Bars Container */}
                <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl overflow-x-auto">
                  <div className="min-w-[650px] flex items-end gap-1.5 h-44 pt-6 pb-2 px-1">
                    {dailyStats.days.map((day) => {
                      const heightPercent = dailyStats.maxDayAmount > 0 
                        ? Math.max(Math.round((day.total / dailyStats.maxDayAmount) * 100), 4)
                        : 4;
                      const hasSpend = day.total > 0;
                      const isPeak = dailyStats.peakDay?.day === day.day;
                      const isSelected = selectedDayFilter === day.day;

                      return (
                        <div
                          key={day.day}
                          onClick={() => hasSpend && setSelectedDayFilter(prev => prev === day.day ? null : day.day)}
                          className={`flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer ${
                            !hasSpend ? 'opacity-40 cursor-default' : ''
                          }`}
                        >
                          {/* Tooltip on Hover */}
                          {hasSpend && (
                            <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap">
                              <span className="font-bold">{day.dateStr}</span>
                              <span className="font-mono text-emerald-300 font-black">{day.total.toLocaleString()} IQD ({day.count} پسوولە)</span>
                              <div className="w-2 h-2 bg-slate-900 rotate-45 -mb-1 mt-0.5"></div>
                            </div>
                          )}

                          {/* Peak Indicator */}
                          {isPeak && (
                            <span className="mb-1 pointer-events-none">
                              <TrendingUp className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                            </span>
                          )}

                          {/* Bar */}
                          <div
                            style={{ height: `${hasSpend ? heightPercent : 4}%` }}
                            className={`w-full max-w-[20px] rounded-t-md transition-all duration-300 ${
                              isSelected
                                ? 'bg-purple-600 ring-2 ring-purple-400'
                                : isPeak
                                ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-xs'
                                : hasSpend
                                ? 'bg-gradient-to-t from-blue-600 to-indigo-400 hover:brightness-110'
                                : 'bg-slate-200'
                            }`}
                          />

                          {/* Day Number Label */}
                          <span className={`text-[10px] font-mono mt-1 font-bold ${
                            isSelected
                              ? 'text-purple-600 font-black'
                              : isPeak
                              ? 'text-amber-600 font-black'
                              : 'text-slate-500'
                          }`}>
                            {day.day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Day Inspector Card if a day is clicked */}
                {selectedDayFilter !== null && (
                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-purple-900">
                        پسوولەکانی ڕۆژی {selectedDayFilter}ی مانگ ({dailyStats.days.find(d => d.day === selectedDayFilter)?.dateStr}):
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-200/80 text-purple-800 font-mono font-bold">
                        {dailyStats.days.find(d => d.day === selectedDayFilter)?.total.toLocaleString()} IQD
                      </span>
                      <span className="text-slate-500">
                        ({dailyStats.days.find(d => d.day === selectedDayFilter)?.count} پسوولە)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDayFilter(null)}
                      className="text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      لابردنی فلتەری ئەم ڕۆژە ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW MODE 4: VISUAL DISTRIBUTION & SHARES                */}
            {/* ========================================================= */}
            {analyticsGraphMode === 'distribution' && (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-700 block mb-2">
                    دابەشبوونی سەدیی (Percentage Share) بودجەی مەسروفات لەم مانگەدا:
                  </span>

                  {/* Multi-segment Horizontal Stacked Bar */}
                  <div className="w-full h-6 bg-slate-100 rounded-xl overflow-hidden flex shadow-inner p-0.5 border border-slate-200">
                    {categories.map((cat) => {
                      const data = categoryBreakdown[cat.key];
                      if (!data || data.total <= 0) return null;
                      const percentage = monthlyTotalExp > 0 ? (data.total / monthlyTotalExp) * 100 : 0;
                      if (percentage <= 0) return null;
                      const palette = typeColors[cat.key] || { bg: 'bg-blue-500' };

                      return (
                        <div
                          key={cat.key}
                          style={{ width: `${percentage}%` }}
                          onClick={() => setSelectedCategoryFilter(prev => prev === cat.key ? null : cat.key)}
                          className={`h-full first:rounded-r-lg last:rounded-l-lg transition-all hover:opacity-85 cursor-pointer relative group flex items-center justify-center text-[10px] text-white font-bold font-mono overflow-hidden ${
                            palette.bg.replace('bg-', 'bg-').split(' ')[0].replace('50', '600')
                          }`}
                          title={`${cat.label}: ${data.total.toLocaleString()} IQD (${Math.round(percentage)}%)`}
                        >
                          {percentage >= 8 && `${Math.round(percentage)}%`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Matrix Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {categories.map((cat) => {
                    const data = categoryBreakdown[cat.key] || { count: 0, total: 0, label: cat.label };
                    const percentage = monthlyTotalExp > 0 ? Math.round((data.total / monthlyTotalExp) * 100) : 0;
                    const palette = typeColors[cat.key] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
                    const isSelected = selectedCategoryFilter === cat.key;

                    return (
                      <div
                        key={cat.key}
                        onClick={() => setSelectedCategoryFilter(prev => prev === cat.key ? null : cat.key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                            : `${palette.bg} ${palette.border} hover:brightness-95`
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={palette.text}>{cat.label}</span>
                          <span className="font-mono text-[11px] font-black">%{percentage}</span>
                        </div>
                        <p className="text-sm font-black font-mono mt-1 text-slate-900">
                          {data.total.toLocaleString()} IQD
                        </p>
                        <span className="text-[10px] opacity-75 font-mono block mt-0.5">
                          {data.count} پسوولە
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Sub-Tab Navigation Bar to inspect and print each section separately */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* SubTab 1: Combined */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('combined')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'combined'
                    ? 'bg-purple-600 text-white shadow-xs scale-102'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>پوختەی شایستەی کارمەندان ({employeeFinancialStats.length})</span>
              </button>

              {/* SubTab 2: Expenses */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('expenses')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'expenses'
                    ? 'bg-blue-600 text-white shadow-xs scale-102'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>وردەکاری مەسروفات ({monthlyExpensesList.length} پسوولە)</span>
              </button>

              {/* SubTab 3: Bonuses */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('bonuses')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'bonuses'
                    ? 'bg-emerald-600 text-white shadow-xs scale-102'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                <span>وردەکاری پاداشت ({monthlyBonusesList.length} پاداشت)</span>
              </button>

              {/* SubTab 4: Withdrawals */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('withdrawals')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'withdrawals'
                    ? 'bg-amber-600 text-white shadow-xs scale-102'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>وردەکاری پێشینە ({monthlyWithdrawalsList.length} جار)</span>
              </button>

              {/* SubTab 5: Payroll Summary Slip Bridge */}
              <button
                type="button"
                onClick={() => setAnalyticsSubTab('payroll')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  analyticsSubTab === 'payroll'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs scale-102'
                    : 'bg-white text-indigo-700 hover:bg-slate-100 border border-indigo-200/80'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>پوختەی مووچەی مانگانە (Payroll Slip)</span>
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
                  {analyticsSubTab === 'combined' && 'چاپی ڕاپۆرتی گشتگیر (PDF)'}
                  {analyticsSubTab === 'expenses' && 'چاپی بەشی مەسروفات (PDF)'}
                  {analyticsSubTab === 'bonuses' && 'چاپی بەشی پاداشت (PDF)'}
                  {analyticsSubTab === 'withdrawals' && 'چاپی بەشی پێشینە (PDF)'}
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
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    خشتەی شایستە و دارایی کارمەندان لە مانگی ({selectedMonth})
                  </h3>
                </div>

                <div className="text-xs font-bold text-slate-500">
                  <span>ژمارەی کارمەندانی خاوەن دارایی: <strong className="text-slate-900">{employeeFinancialStats.length}</strong></span>
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
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">مەسروفات (IQD)</th>
                        <th className="p-3 text-center">پاداشت (IQD)</th>
                        <th className="p-3 text-center">ڕاکێشانی پێشینە (IQD)</th>
                        <th className="p-3 text-center">کۆی گشتی دارایی (IQD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employeeFinancialStats.map((item, idx) => (
                        <tr key={item.empId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{item.empName}</td>
                          <td className="p-3 text-center text-slate-500">{item.role}</td>
                          
                          {/* Expenses */}
                          <td className="p-3 text-center font-mono font-bold text-blue-600">
                            {item.expensesTotal > 0 ? `${item.expensesTotal.toLocaleString()} IQD` : '—'}
                            {item.expenseCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.expenseCount} پسوولە)
                              </span>
                            )}
                          </td>

                          {/* Bonuses */}
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">
                            {item.bonusesTotal > 0 ? `${item.bonusesTotal.toLocaleString()} IQD` : '—'}
                            {item.bonusCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.bonusCount} جار)
                              </span>
                            )}
                          </td>

                          {/* Withdrawals */}
                          <td className="p-3 text-center font-mono font-bold text-amber-600">
                            {item.withdrawalsTotal > 0 ? `${item.withdrawalsTotal.toLocaleString()} IQD` : '—'}
                            {item.withdrawalCount > 0 && (
                              <span className="block text-[9px] font-sans text-slate-400 font-normal">
                                ({item.withdrawalCount} جار)
                              </span>
                            )}
                          </td>

                          {/* Grand Total */}
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-mono font-black text-xs">
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
            <div className="space-y-4">
              {/* 📊 Reason-based Breakdown Cards & Statistics for Expenses */}
              {monthlyExpensesList.length > 0 && reasonBreakdown.length > 0 && (
                <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-black text-slate-900">
                        ئاماری خەرجییەکان بەپێی هۆکار و تێبینییە جێگیرەکان لە مانگی ({selectedMonth}):
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-bold">
                        {reasonBreakdown.length} هۆکاری جیاواز
                      </span>
                      {selectedReasonFilter && (
                        <button
                          type="button"
                          onClick={() => setSelectedReasonFilter(null)}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
                        >
                          پیشاندانی هەموو هۆکارەکان ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {reasonBreakdown.map((item) => {
                      const isFilterActive = selectedReasonFilter === item.label;
                      const percentage = monthlyTotalExp > 0 ? Math.round((item.total / monthlyTotalExp) * 100) : 0;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setSelectedReasonFilter(prev => prev === item.label ? null : item.label)}
                          className={`p-3 rounded-xl border text-right transition-all cursor-pointer space-y-1.5 ${
                            isFilterActive
                              ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/30 shadow-xs'
                              : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 line-clamp-1" title={item.label}>
                              {item.label}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isFilterActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200/80 text-slate-700'
                            }`}>
                              {item.count} پسوولە
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-mono font-black text-blue-600">
                              {item.total.toLocaleString()} IQD
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono font-bold">
                              %{percentage}
                            </span>
                          </div>

                          <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>

                          <div className="text-[10px] text-slate-400 pt-0.5 flex items-center justify-between">
                            <span>{isFilterActive ? '✓ فلتەر کراوە' : 'کلیک بکە بۆ فلتەرکردنی خشتە'}</span>
                            {isFilterActive && <span className="text-rose-500 font-bold">لابردن ✕</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table Container */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900">
                      لیستی تەواوی پسوولەکانی مەسروفاتی مانگی ({selectedMonth})
                      {(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) && (
                        <span className="text-xs font-bold text-blue-600 mr-2">
                          (فلتەرکراو بەپێی: {[
                            selectedCategoryFilter ? `پۆلێنی ${typeLabels[selectedCategoryFilter] || selectedCategoryFilter}` : null,
                            selectedReasonFilter ? `تێبینی ${selectedReasonFilter}` : null,
                            selectedDayFilter !== null ? `ڕۆژی ${selectedDayFilter}` : null,
                          ].filter(Boolean).join(' • ')})
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="text-xs font-bold text-slate-500">
                    <span>
                      ژمارەی پسوولەکان: <strong className="text-slate-900">{filteredMonthlyExpenses.length}</strong>
                      {(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) && <span className="text-slate-400 font-normal"> لە کۆی {monthlyExpensesList.length}</span>}
                      {' • '}کۆی مەسروفات: <strong className="text-blue-600 font-mono">{filteredMonthlyTotalExp.toLocaleString()} IQD</strong>
                    </span>
                  </div>
                </div>

                {(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) && (
                  <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-blue-900">
                      <Filter className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>
                        خشتەکە فلتەرکراوە بەپێی: {[
                          selectedCategoryFilter ? `پۆلێنی «${typeLabels[selectedCategoryFilter] || selectedCategoryFilter}»` : null,
                          selectedReasonFilter ? `تێبینی «${selectedReasonFilter}»` : null,
                          selectedDayFilter !== null ? `ڕۆژی «${selectedDayFilter}»` : null,
                        ].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryFilter(null);
                        setSelectedReasonFilter(null);
                        setSelectedDayFilter(null);
                      }}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                    >
                      پیشاندانی هەموو مەسروفاتەکان ✕
                    </button>
                  </div>
                )}

                {filteredMonthlyExpenses.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                    <p>{(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) ? 'هیچ مەسروفاتێک بەپێی ئەم فلتەرانە لەم مانگەدا تۆمار نەکراوە.' : `هیچ مەسروفاتێک بۆ مانگی (${selectedMonth}) تۆمار نەکراوە.`}</p>
                    {(selectedCategoryFilter || selectedReasonFilter || selectedDayFilter !== null) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryFilter(null);
                          setSelectedReasonFilter(null);
                          setSelectedDayFilter(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer hover:bg-blue-700"
                      >
                        گەڕانەوە بۆ هەموو خەرجییەکان
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
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
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const groups = groupExpensesByEmployee(filteredMonthlyExpenses, employees);
                          let globalIdx = 0;
                          return groups.map((group) => {
                            return (
                              <Fragment key={group.employeeKey}>
                                {group.items.map((item: any) => {
                                  globalIdx += 1;
                                  const currentIdx = globalIdx;
                                  return (
                                    <tr key={item.id || currentIdx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="p-3 text-center font-mono text-slate-400 font-bold">{currentIdx}</td>
                                      <td className="p-3 text-center font-mono text-slate-600">{item.date}</td>
                                      <td className="p-3 font-bold text-slate-900">{group.employeeName}</td>
                                      <td className="p-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg || ''} ${typeColors[item.type as keyof typeof typeColors]?.text || ''} ${typeColors[item.type as keyof typeof typeColors]?.border || ''}`}>
                                          {typeLabels[item.type] || item.category || 'تەکسی'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-slate-600">
                                        {item.from || item.to ? `${item.from || '—'} ← ${item.to || '—'}` : (item.route || '—')}
                                      </td>
                                      <td className="p-3 text-center font-mono text-slate-500">{item.trip || '—'}</td>
                                      <td className="p-3 text-center font-mono font-bold text-blue-600">
                                        {Number(item.amount || 0).toLocaleString()} IQD
                                      </td>
                                      <td className="p-3 text-slate-500">{item.note || item.reason || '—'}</td>
                                    </tr>
                                  );
                                })}

                                {/* 🟡 Highlighted Subtotal Row for Employee */}
                                <tr className="bg-amber-100/90 text-amber-950 border-y-2 border-amber-300 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                                  <td colSpan={5} className="p-3 text-right">
                                    <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                                      <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>کۆی گشتی ({group.employeeName})</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-mono font-black text-amber-900 text-xs">
                                    {group.items.length} پسوولە
                                  </td>
                                  <td className="p-3 text-center font-mono font-black text-amber-900 text-xs">
                                    {group.totalAmount.toLocaleString()} IQD
                                  </td>
                                  <td className="p-3 text-amber-800 text-xs">
                                    —
                                  </td>
                                </tr>
                              </Fragment>
                            );
                          });
                        })()}
                        <tr className="bg-slate-900 text-white font-black">
                          <td colSpan={6} className="p-3 text-right">
                            {selectedReasonFilter ? `کۆی خەرجییە فلتەرکراوەکان (${selectedReasonFilter}):` : `کۆی گشتی مەسروفاتی مانگی (${selectedMonth}):`}
                          </td>
                          <td className="p-3 text-center font-mono text-blue-400 text-sm">
                            {filteredMonthlyTotalExp.toLocaleString()} IQD
                          </td>
                          <td className="p-3 text-slate-400 font-normal">
                            {filteredMonthlyExpenses.length} پسوولە
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SUBTAB 3 CONTENT: FULL MONTHLY BONUSES TABLE              */}
          {/* ========================================================= */}
          {analyticsSubTab === 'bonuses' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    لیستی تەواوی پاداشتەکانی مانگی ({selectedMonth})
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>ژمارەی پاداشتەکان: <strong className="text-slate-900">{monthlyBonusesList.length}</strong> • کۆی پاداشت: <strong className="text-emerald-600 font-mono">{monthlyTotalBon.toLocaleString()} IQD</strong></span>
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
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3 text-center">بەروار</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">بڕی پاداشت (IQD)</th>
                        <th className="p-3">هۆکار / تێبینی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyBonusesList.map((item: any, idx: number) => {
                        const emp = employees.find(e => e.id === item.employeeId);
                        const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
                        const role = emp?.role ? String(emp.role) : 'کارمەند';
                        const amt = Number(item.totalAmount || item.amount || 0);
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 text-center font-mono text-slate-600">{item.date}</td>
                            <td className="p-3 font-bold text-slate-900">{empName}</td>
                            <td className="p-3 text-center text-slate-500">{role}</td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-600">
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
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    لیستی تەواوی ڕاکێشانی پێشینەی مانگی ({selectedMonth})
                  </h3>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>جارەکانی ڕاکێشان: <strong className="text-slate-900">{monthlyWithdrawalsList.length}</strong> • کۆی پێشینە: <strong className="text-amber-600 font-mono">{monthlyTotalWth.toLocaleString()} IQD</strong></span>
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
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3 text-center">بەروار</th>
                        <th className="p-3">ناوی کارمەند</th>
                        <th className="p-3 text-center">پۆست / بەش</th>
                        <th className="p-3 text-center">بڕی پێشینە (IQD)</th>
                        <th className="p-3">تێبینی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyWithdrawalsList.map((item: any, idx: number) => {
                        const emp = employees.find(e => e.id === item.employeeId);
                        const empName = item.employeeName || (emp ? (emp.fullName3Part || emp.name) : 'کارمەند');
                        const role = emp?.role ? String(emp.role) : 'کارمەند';
                        const amt = Number(item.amount || 0);
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 text-center font-mono text-slate-600">{item.date}</td>
                            <td className="p-3 font-bold text-slate-900">{empName}</td>
                            <td className="p-3 text-center text-slate-500">{role}</td>
                            <td className="p-3 text-center font-mono font-bold text-amber-600">
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

          {/* ========================================================= */}
          {/* SUBTAB 5 CONTENT: MONTHLY PAYROLL SUMMARY SLIP            */}
          {/* ========================================================= */}
          {analyticsSubTab === 'payroll' && (
            <PayrollSummarySlip
              employees={employees}
              expenses={monthlyExpensesList}
              bonuses={monthlyBonusesList}
              overtime={(overtime || []).filter((o: any) => o.date && o.date.startsWith(selectedMonth))}
              withdrawals={monthlyWithdrawalsList}
              selectedMonth={selectedMonth}
              monthDisplayLabel={monthDisplayLabel}
              tableDensity={tableDensity}
              onLogAudit={logAudit}
            />
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 💰 VIEW 5: PENDING EXPENSES TAB (TELEGRAM & WEB WORKFLOW) */}
      {/* ========================================================= */}
      {activeTab === 'pending' && (
        <PendingExpensesTab 
          onExpenseApproved={() => {
            fetchPendingCount();
            fetchArchivedVouchers().then(v => {
              if (v) setArchivedVouchers(v);
            });
          }} 
        />
      )}

      {/* ========================================================= */}
      {/* 📁 VIEW 1: ARCHIVED LISTS (PRIMARY MAIN VIEW)             */}
      {/* ========================================================= */}
      {activeTab !== 'analytics' && activeTab !== 'pending' && viewMode === 'archive' && (
        <div className="space-y-4">
          
          {/* 🌟 3 Executive Bento Stat Cards for the Selected Month */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Bento Card 1: Total Lists */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-blue-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">لیستە تۆمارکراوەکان</span>
                      <span className="text-[10px] text-slate-400">مانگی {monthDisplayLabel}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs">
                    {activeTabMeta.name}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <p className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                    {archiveStats.listCount}
                  </p>
                  <span className="text-xs font-bold text-blue-600">
                    {currentMonthArchivedVouchers.filter(v => !v.isLocked).length} لیستی کراوە
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Total Items */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">کۆی پسوولەکان</span>
                      <span className="text-[10px] text-slate-400">سەرجەم لیستەکان</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs">
                    تۆمار
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <p className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                    {archiveStats.totalItems}
                  </p>
                  <span className="text-xs font-medium text-slate-400">
                    تێکڕا {archiveStats.listCount > 0 ? Math.round(archiveStats.totalItems / archiveStats.listCount) : 0} بۆ هەر لیستێک
                  </span>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Total Amount */}
            <div className="group relative overflow-hidden p-4 sm:p-5 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-400 group-hover:h-1.5 transition-all" />
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none group-hover:scale-150 transition-all duration-500" />
              
              <div className="relative space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                      <Banknote className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-slate-700 font-extrabold text-xs block">کۆی پارەی مانگ</span>
                      <span className="text-[10px] text-emerald-600 font-bold">بڕی خەرجکراو</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs font-mono">
                    IQD
                  </span>
                </div>

                <div className="pt-1">
                  <p className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight flex items-baseline gap-1.5">
                    <span>{archiveStats.totalAmount.toLocaleString()}</span>
                    <span className="text-xs font-sans font-bold text-slate-400">دینار</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Action Bar: Prominent 'Create New List' Button + Month Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs">
            
            {/* PROMINENT 'CREATE NEW LIST' BUTTON */}
            <button
              type="button"
              onClick={() => {
                setEditingVoucherId(null);
                setEditingVoucherName('');
                setEditingDraftItemId(null);
                setDraftItems([]);
                setViewMode('create');
              }}
              className="group relative overflow-hidden px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-black text-xs sm:text-sm flex items-center gap-2.5 shadow-md shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                <Plus className="w-4 h-4" />
              </div>
              <span>دروستکردنی لیستی نوێ</span>
            </button>

            {/* CALENDAR & MONTH SELECTOR */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">مانگی ئەرشیف:</span>
              
              <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="مانگی پێشوو"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="relative px-2 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 pointer-events-none" />
                  <span className="text-xs font-bold text-slate-900 pointer-events-none">
                    {monthDisplayLabel}
                  </span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="هەڵبژاردنی مانگ"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-all cursor-pointer"
                  title="مانگی داهاتوو"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
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
                placeholder="گەڕان لە لیستەکان..."
                className="w-full pr-8 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Archived Lists Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-900">
                  لیستە ئەرشیفکراوەکانی ({activeTabMeta.name}) — {monthDisplayLabel}
                </h2>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <span>ژمارەی لیستەکان: <strong className="text-slate-900">{archiveStats.listCount}</strong></span>
                <span>•</span>
                <span>کۆی پسوولەکان: <strong className="text-slate-900">{archiveStats.totalItems}</strong></span>
                <span>•</span>
                <span>کۆی پارە: <strong className="text-emerald-600 font-mono">{archiveStats.totalAmount.toLocaleString()} IQD</strong></span>
              </div>
            </div>

            {/* 🌟 Dynamic Active Open List Status Banner */}
            {activeTab === 'expenses' && (() => {
              const activeOpen = currentMonthArchivedVouchers.find(v => !v.isLocked);
              return activeOpen ? (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border border-emerald-300/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2.5 text-emerald-900 font-bold">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>لیستی کراوەی ئێستا (وەرگرتنی مەسروفاتی بۆت):</span>
                    <span className="font-mono bg-white px-2.5 py-1 rounded-xl border border-emerald-200 text-emerald-800 font-extrabold shadow-2xs">
                      {activeOpen.name} ({activeOpen.itemCount} پسوولە • {activeOpen.totalAmount.toLocaleString()} IQD)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLockVoucher(activeOpen)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
                    title="قوفڵکردنی ئەم لیستە تا هیچ مەسروفاتێکی تر نەچێتە ناوی و لە داهاتوودا لیستی نوێ دروست ببێت"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>قوفڵکردنی ئەم لیستە (داخستن)</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>سەرجەم لیستەکانی ئەم مانگە قوفڵکراون (داخراون). هەر مەسروفاتێکی نوێ لە بۆتەوە پەسەند بکرێت، بە شێوەیەکی خۆکارانە لیستی نوێ دروست دەبێت.</span>
                </div>
              );
            })()}

            {currentMonthArchivedVouchers.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
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
                  <span>دەستپێکردن و دروستکردنی لیستی نوێ</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className={`${cellPad} text-center w-12`}>#</th>
                      <th className={cellPad}>ناوی لیست / کاتی خەزنکردن (Real-Time)</th>
                      <th className={`${cellPad} text-center`}>ژمارەی پسوولەکان</th>
                      <th className={`${cellPad} text-center`}>مەودای بەرواری خەرجییەکان</th>
                      <th className={`${cellPad} text-center`}>کۆی گشتی (IQD)</th>
                      <th className={`${cellPad} text-center w-64`}>کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentMonthArchivedVouchers.map((voucher, idx) => (
                      <tr 
                        key={voucher.id} 
                        className={`transition-colors group ${
                          voucher.isLocked 
                            ? 'hover:bg-slate-50/70 opacity-90' 
                            : 'bg-emerald-50/20 hover:bg-emerald-50/50'
                        }`}
                      >
                        <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>
                          {idx + 1}
                        </td>

                        <td className={`${cellPad} font-bold text-slate-900`}>
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded-lg ${
                              voucher.isLocked
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {voucher.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="block text-xs font-bold text-slate-900">
                                  {voucher.name}
                                </span>
                                {voucher.isLocked ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 inline-flex items-center gap-0.5">
                                    <Lock className="w-2.5 h-2.5 text-rose-500" />
                                    <span>قوفڵکراو</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
                                    <Unlock className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>کراوە</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                تۆمارکراو: {format(new Date(voucher.createdAt), 'yyyy-MM-dd • hh:mm a')}
                                {voucher.lockedAt && ` • قوفڵکراوە: ${format(new Date(voucher.lockedAt), 'yyyy-MM-dd • hh:mm a')}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className={`${cellPad} text-center`}>
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {voucher.itemCount} پسوولە
                          </span>
                        </td>

                        <td className={`${cellPad} text-center font-mono text-slate-600 font-bold`}>
                          {voucher.dateRange}
                        </td>

                        <td className={`${cellPad} text-center`}>
                          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-xs">
                            {voucher.totalAmount.toLocaleString()} IQD
                          </span>
                        </td>

                        <td className={`${cellPad} text-center`}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View / Inspect */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher(voucher);
                                setViewMode('view_voucher');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="بینینی تەواوی پسوولەکانی ئەم لیستە"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>بینین</span>
                            </button>

                            {/* 🔒 LOCK / UNLOCK BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleToggleLockVoucher(voucher)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                voucher.isLocked
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                              }`}
                              title={voucher.isLocked ? 'کردنەوەی ئەم لیستە بۆ وەرگرتنی مەسروفاتی بۆت' : 'قوفڵکردنی ئەم لیستە تا هیچ مەسروفاتێکی تر نەچێتە ناوی'}
                            >
                              {voucher.isLocked ? <Unlock className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5 text-rose-600" />}
                              <span>{voucher.isLocked ? 'کردنەوە' : 'قوفڵکردن'}</span>
                            </button>

                            {/* ✏️ EDIT ARCHIVED LIST */}
                            <button
                              type="button"
                              onClick={() => handleStartEditVoucher(voucher)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="دەستکاریکردنی ئەم لیستە ئەرشیفکراوە (زیادکردن یان گۆڕینی پسوولەکان)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>دەستکاری</span>
                            </button>

                            {/* Direct Print */}
                            <button
                              type="button"
                              onClick={() => handlePrintVoucher(voucher)}
                              className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="چاپی ئەم لیستە بە شێوازی پۆرترەیت"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>پرێنت</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(voucher)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all cursor-pointer"
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
      {activeTab !== 'analytics' && activeTab !== 'pending' && viewMode === 'create' && (
        <div className="space-y-4">
          
          {/* Header Bar with Back and Save List buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
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
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>گەڕانەوە بۆ ئەرشیف</span>
              </button>

              <div>
                {editingVoucherId ? (
                  <div>
                    <h2 className="text-sm font-black text-amber-600 flex items-center gap-1.5">
                      <Edit3 className="w-4 h-4" />
                      <span>دەستکاریکردنی لیست:</span>
                    </h2>
                    <input
                      type="text"
                      value={editingVoucherName}
                      onChange={(e) => setEditingVoucherName(e.target.value)}
                      className="mt-1 px-3 py-1 text-xs font-bold bg-amber-50/50 border border-amber-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 w-72 max-w-full"
                      title="دەستکاریکردنی ناوی لیست"
                    />
                  </div>
                ) : (
                  <div>
                    <h2 className="text-sm font-black text-slate-900">
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
                  ? `پاشەکەوتکردنی دەستکارییەکان (${draftItems.length} پسوولە)` 
                  : `تەواوکردن و خەزنکردنی ئەم لیستە (${draftItems.length} پسوولە)`
                }
              </span>
            </button>
          </div>

          {/* Quick Feedback alert */}
          {lastAddedFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lastAddedFeedback}</span>
            </div>
          )}

          {/* Rapid Input Form for adding / editing items in this worksheet */}
          <div className={`p-4 bg-white border rounded-2xl shadow-xs space-y-4 ${
            editingDraftItemId ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                {editingDraftItemId ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-600">دەستکاریکردنی ئەم پسوولەیە:</span>
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
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
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
                  <label className="text-xs font-bold text-slate-700 block">
                    بڕی پارە (IQD) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="بۆ نموونە: 25000"
                    autoFocus
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 📅 Date (User can set any date for each item!) */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    بەرواری ئەم پسوولەیە <span className="text-blue-500">(هەر ڕۆژێک بێت)</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 👤 Employee Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    کارمەند {activeTab !== 'expenses' && <span className="text-rose-500">*</span>}
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {activeTab === 'expenses' ? 'مەسروفاتی گشتی کۆگا / کارگە' : 'تکایە کارمەند دیاری بکە'}
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">
                      پۆلێنی خەرجی:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setManagerActiveTab('categories');
                        setIsCategoryManagerOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>ڕێکخستنی پۆلێنەکان</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categoryPills.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setExpenseType(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          expenseType === p.key
                            ? 'bg-blue-600 text-white shadow-2xs scale-102'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setManagerActiveTab('categories');
                        setIsCategoryManagerOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 border border-dashed border-blue-300 hover:bg-blue-50 cursor-pointer flex items-center gap-1"
                      title="پۆلێنی نوێ زیادبکە"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>پۆلێنی نوێ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Row 3: Route Details (From, To, Trip) for Expenses with Smart Suggestion */}
              {activeTab === 'expenses' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SmartSuggestInput
                    label="لە (From)"
                    value={fromLoc}
                    onChange={setFromLoc}
                    historyMap={fieldHistory.from}
                    placeholder="بۆ نموونە: کارگەی ئاشڵی"
                  />

                  <SmartSuggestInput
                    label="بۆ (To)"
                    value={toLoc}
                    onChange={setToLoc}
                    historyMap={fieldHistory.to}
                    placeholder="بۆ نموونە: هوانە، بازاڕی سلێمانی"
                  />

                  <SmartSuggestInput
                    label="ژمارەی سەفەر"
                    value={tripNo}
                    onChange={setTripNo}
                    historyMap={fieldHistory.trip}
                    placeholder="1, 2, چوون و گەڕانەوە"
                  />
                </div>
              )}

              {/* Row 4: Preset Standard Reasons / Notes */}
              {(currentPresetReasons.length > 0 || activeTab === 'expenses') && (
                <div className="space-y-2 p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse shrink-0" />
                      <span>هۆکار و تێبینییە جێگیرەکان (کلیک بکە بۆ دیاریکردنی خێرا):</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {activeTab === 'expenses' && (
                        <button
                          type="button"
                          onClick={() => {
                            setManagerSelectedCatKey(expenseType);
                            setManagerActiveTab('reasons');
                            setIsCategoryManagerOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer bg-white/70 px-2 py-0.5 rounded-md border border-blue-200/60"
                        >
                          <Settings className="w-3 h-3" />
                          <span>دەستکاریکردنی تێبینییەکان</span>
                        </button>
                      )}
                      {note && (
                        <button
                          type="button"
                          onClick={() => setNote('')}
                          className="text-[11px] font-bold text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        >
                          پاککردنەوەی تێبینی ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentPresetReasons.map((reasonText) => {
                      const isSelected = note === reasonText;
                      return (
                        <button
                          key={reasonText}
                          type="button"
                          onClick={() => handleSelectPresetReason(reasonText)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border text-right ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-102 ring-2 ring-blue-400/30'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 text-white shrink-0" />
                          ) : (
                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <span>{reasonText}</span>
                        </button>
                      );
                    })}

                    {activeTab === 'expenses' && (
                      <button
                        type="button"
                        onClick={() => {
                          setManagerSelectedCatKey(expenseType);
                          setManagerActiveTab('reasons');
                          setIsCategoryManagerOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 border border-dashed border-blue-300 hover:bg-white cursor-pointer flex items-center gap-1"
                        title="تێبینی جێگیری نوێ زیادبکە"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>تێبینی نوێ</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Row 5: Note / Reason & Action Buttons */}
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full">
                  <SmartSuggestInput
                    label={activeTab === 'bonuses' ? 'هۆکاری پاداشت' : 'دەقی تێبینی'}
                    subLabel={
                      <span className="text-[10px] font-normal text-slate-400 mr-1.5 font-sans">
                        (دەتوانیت لە هۆکارە جێگیرەکانی سەرەوە هەڵبژێریت یان بنووسیت)
                      </span>
                    }
                    value={note}
                    onChange={setNote}
                    historyMap={fieldHistory.note}
                    placeholder={activeTab === 'bonuses' ? 'پاداشتی دەستخۆشی کارکردن' : 'تێبینی بنووسە یان لە سەرەوە هەڵبژێرە...'}
                    className="py-2"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mb-0.5">
                  <button
                    type="submit"
                    className={`w-full sm:w-auto shrink-0 px-6 py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer ${
                      editingDraftItemId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {editingDraftItemId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingDraftItemId ? 'نوێکردنەوەی ئەم پسوولەیە' : 'زیادکردن بۆ ئەم لیستە'}</span>
                  </button>

                  {editingDraftItemId && (
                    <button
                      type="button"
                      onClick={handleCancelEditDraftItem}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      هەڵوەشاندنەوە
                    </button>
                  )}
                </div>
              </div>

            </form>
          </div>

          {/* Draft Items Live Table with Row-Level Edit and Delete */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  پسوولە تۆمارکراوەکانی ناو ئەم لیستە ({draftItems.length} دانە)
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">کۆی گشتی ئەم لیستە:</span>
                <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-black text-sm border border-emerald-200">
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
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className={`${cellPad} text-center w-10`}>#</th>
                      <th className={cellPad}>ناوی کارمەند</th>
                      <th className={`${cellPad} text-center`}>بەروار</th>
                      {activeTab === 'expenses' && <th className={`${cellPad} text-center`}>جۆر</th>}
                      {activeTab === 'expenses' && <th className={cellPad}>لە / بۆ</th>}
                      {activeTab === 'expenses' && <th className={`${cellPad} text-center`}>ژ.سەفەر</th>}
                      <th className={`${cellPad} text-center`}>بڕی پارە (IQD)</th>
                      <th className={cellPad}>تێبینی</th>
                      <th className={`${cellPad} text-center w-24`}>دەستکاری / سڕینەوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
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
                                        ? 'bg-amber-50/80' 
                                        : 'hover:bg-slate-50/70'
                                    }`}
                                  >
                                    <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>{currentIdx}</td>
                                    <td className={`${cellPad} font-bold text-slate-900`}>{group.employeeName}</td>
                                    <td className={`${cellPad} text-center font-mono text-slate-600`}>{item.date}</td>
                                    <td className={`${cellPad} text-center`}>
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg} ${typeColors[item.type as keyof typeof typeColors]?.text} ${typeColors[item.type as keyof typeof typeColors]?.border}`}>
                                        {typeLabels[item.type] || item.category || 'تەکسی'}
                                      </span>
                                    </td>
                                    <td className={`${cellPad} text-slate-600`}>
                                      {item.from || item.to ? `${item.from || '—'} ← ${item.to || '—'}` : (item.route || '—')}
                                    </td>
                                    <td className={`${cellPad} text-center font-mono text-slate-500`}>{item.trip || '—'}</td>
                                    <td className={`${cellPad} text-center font-mono font-bold text-emerald-600`}>
                                      {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                                    </td>
                                    <td className={`${cellPad} text-slate-500`}>{item.note || item.reason || '—'}</td>
                                    <td className={`${cellPad} text-center`}>
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditDraftItem(item)}
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                            editingDraftItemId === item.id 
                                              ? 'bg-amber-500 text-white shadow-2xs' 
                                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                          }`}
                                          title="دەستکاریکردنی ئەم پسوولەیە"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveDraftItem(item.id)}
                                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
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
                              <tr className="bg-amber-100/90 text-amber-950 border-y-2 border-amber-300 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                                <td colSpan={5} className={`${cellPad} text-right`}>
                                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                                    <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                                    <span>کۆی گشتی ({group.employeeName})</span>
                                  </div>
                                </td>
                                <td className={`${cellPad} text-center font-mono font-bold text-amber-900 text-xs`}>
                                  {group.items.length} پسوولە
                                </td>
                                <td className={`${cellPad} text-center font-mono font-bold text-amber-900 text-xs`}>
                                  {group.totalAmount.toLocaleString()} IQD
                                </td>
                                <td className={`${cellPad} text-amber-800 text-xs`}>—</td>
                                <td className={`${cellPad} text-center text-amber-800 text-xs`}>—</td>
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
                              ? 'bg-amber-50/80' 
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>{idx + 1}</td>
                          <td className={`${cellPad} font-bold text-slate-900`}>{item.employeeName || 'گشتی'}</td>
                          <td className={`${cellPad} text-center font-mono text-slate-600`}>{item.date}</td>
                          <td className={`${cellPad} text-center font-mono font-bold text-emerald-600`}>
                            {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                          </td>
                          <td className={`${cellPad} text-slate-500`}>{item.note || item.reason || '—'}</td>
                          <td className={`${cellPad} text-center`}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditDraftItem(item)}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                  editingDraftItemId === item.id 
                                    ? 'bg-amber-500 text-white shadow-2xs' 
                                    : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                }`}
                                title="دەستکاریکردنی ئەم پسوولەیە"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
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
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-600">
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
                      ? 'پاشەکەوتکردنی گۆڕانکارییەکانی ئەم لیستە لە ئەرشیف' 
                      : 'خەزنکردنی لیست لە ئەرشیف بە ناوی کاتی ئێستا'
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
      {activeTab !== 'analytics' && activeTab !== 'pending' && viewMode === 'view_voucher' && selectedVoucher && (
        <div className="space-y-4">
          
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('archive')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>گەڕانەوە بۆ ئەرشیف</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>{selectedVoucher.name}</span>
                  </h2>
                  {selectedVoucher.isLocked ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3 text-rose-500" />
                      <span>قوفڵکراو (داخراو)</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <Unlock className="w-3 h-3 text-emerald-600" />
                      <span>کراوە (وەرگرتنی مەسروفات)</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500">
                  تۆمارکراو لە: {format(new Date(selectedVoucher.createdAt), 'yyyy-MM-dd • hh:mm a')} • مانگی: {selectedVoucher.month}
                  {selectedVoucher.lockedAt && ` • قوفڵکراوە لە: ${format(new Date(selectedVoucher.lockedAt), 'yyyy-MM-dd • hh:mm a')}`}
                </span>
              </div>
            </div>

            {/* Edit, Print, Lock & Delete Buttons */}
            <div className="flex items-center gap-2">
              {/* 🔒 LOCK / UNLOCK THIS VOUCHER */}
              <button
                type="button"
                onClick={() => handleToggleLockVoucher(selectedVoucher)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-2xs text-white ${
                  selectedVoucher.isLocked
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
                title={selectedVoucher.isLocked ? 'کردنەوەی ئەم لیستە بۆ وەرگرتنی مەسروفاتی بۆت' : 'قوفڵکردن و داخستنی ئەم لیستە تا هیچ مەسروفاتێکی تر نەچێتە ناوی'}
              >
                {selectedVoucher.isLocked ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4" />}
                <span>{selectedVoucher.isLocked ? 'کردنەوەی لیست' : 'قوفڵکردنی لیست'}</span>
              </button>

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
                <span>چاپی ئەم لیستە (PDF Portrait)</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteVoucher(selectedVoucher)}
                className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوە</span>
              </button>
            </div>
          </div>

          {/* Voucher Items Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                پێڕستی هەموو پسوولەکانی ئەم لیستە ({selectedVoucher.itemCount} پسوولە):
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-black text-sm border border-emerald-200">
                کۆی گشتی: {selectedVoucher.totalAmount.toLocaleString()} IQD
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <th className={`${cellPad} text-center w-10`}>#</th>
                    <th className={cellPad}>ناوی کارمەند</th>
                    <th className={`${cellPad} text-center`}>بەروار</th>
                    {selectedVoucher.type === 'expenses' && <th className={`${cellPad} text-center`}>جۆر</th>}
                    {selectedVoucher.type === 'expenses' && <th className={cellPad}>لە / بۆ</th>}
                    {selectedVoucher.type === 'expenses' && <th className={`${cellPad} text-center`}>ژ.سەفەر</th>}
                    <th className={`${cellPad} text-center`}>بڕی پارە (IQD)</th>
                    <th className={cellPad}>تێبینی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                                <tr key={item.id || currentIdx} className="hover:bg-slate-50/70">
                                  <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>{currentIdx}</td>
                                  <td className={`${cellPad} font-bold text-slate-900`}>{group.employeeName}</td>
                                  <td className={`${cellPad} text-center font-mono text-slate-600`}>{item.date}</td>
                                  <td className={`${cellPad} text-center`}>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeColors[item.type as keyof typeof typeColors]?.bg || ''} ${typeColors[item.type as keyof typeof typeColors]?.text || ''} ${typeColors[item.type as keyof typeof typeColors]?.border || ''}`}>
                                      {typeLabels[item.type] || item.category || 'تەکسی'}
                                    </span>
                                  </td>
                                  <td className={`${cellPad} text-slate-600`}>
                                    {item.from || item.to ? `${item.from || '—'} ← ${item.to || '—'}` : (item.route || '—')}
                                  </td>
                                  <td className={`${cellPad} text-center font-mono text-slate-500`}>{item.trip || '—'}</td>
                                  <td className={`${cellPad} text-center font-mono font-bold text-emerald-600`}>
                                    {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                                  </td>
                                  <td className={`${cellPad} text-slate-500`}>{item.note || item.reason || '—'}</td>
                                </tr>
                              );
                            })}

                            {/* 🟡 Highlighted Subtotal Row for Employee */}
                            <tr className="bg-amber-100/90 text-amber-950 border-y-2 border-amber-300 font-bold print:bg-[#fef9c3] print:text-[#713f12]">
                              <td colSpan={5} className={`${cellPad} text-right`}>
                                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                                  <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                                  <span>کۆی گشتی ({group.employeeName})</span>
                                </div>
                              </td>
                              <td className={`${cellPad} text-center font-mono font-bold text-amber-900 text-xs`}>
                                {group.items.length} پسوولە
                              </td>
                              <td className={`${cellPad} text-center font-mono font-bold text-amber-900 text-xs`}>
                                {group.totalAmount.toLocaleString()} IQD
                              </td>
                              <td className={`${cellPad} text-amber-800 text-xs`}>
                                —
                              </td>
                            </tr>
                          </Fragment>
                        );
                      });
                    })()
                  ) : (
                    selectedVoucher.items.map((item: any, idx: number) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70">
                        <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>{idx + 1}</td>
                        <td className={`${cellPad} font-bold text-slate-900`}>{item.employeeName || 'گشتی'}</td>
                        <td className={`${cellPad} text-center font-mono text-slate-600`}>{item.date}</td>
                        <td className={`${cellPad} text-center font-mono font-bold text-emerald-600`}>
                          {Number(item.amount || item.totalAmount || 0).toLocaleString()} IQD
                        </td>
                        <td className={`${cellPad} text-slate-500`}>{item.note || item.reason || '—'}</td>
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

      {/* ========================================================= */}
      {/* ⚙️ MODAL: MANAGE EXPENSE CATEGORIES & PRESET NOTES        */}
      {/* ========================================================= */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => {
          setIsCategoryManagerOpen(false);
          setEditingCategoryKey(null);
          setEditingReasonIndex(null);
        }}
        categories={categories}
        presetReasons={presetReasons}
        activeTab={managerActiveTab}
        setActiveTab={setManagerActiveTab}
        selectedCatKey={managerSelectedCatKey}
        setSelectedCatKey={setManagerSelectedCatKey}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        editingCategoryKey={editingCategoryKey}
        setEditingCategoryKey={setEditingCategoryKey}
        editingCategoryLabel={editingCategoryLabel}
        setEditingCategoryLabel={setEditingCategoryLabel}
        newReasonText={newReasonText}
        setNewReasonText={setNewReasonText}
        editingReasonIndex={editingReasonIndex}
        setEditingReasonIndex={setEditingReasonIndex}
        editingReasonText={editingReasonText}
        setEditingReasonText={setEditingReasonText}
        onAddCategory={handleAddCategory}
        onSaveEditCategory={handleSaveEditCategory}
        onDeleteCategory={handleDeleteCategory}
        onAddReason={(e) => handleAddReason(managerSelectedCatKey, e)}
        onSaveEditReason={handleSaveEditReason}
        onDeleteReason={handleDeleteReason}
        onResetDefaults={handleResetCategoryAndReasons}
        customRoutes={customRoutes}
        onAddRoute={handleAddRoute}
        onSaveEditRoute={handleSaveEditRoute}
        onDeleteRoute={handleDeleteRoute}
        onResetRoutes={handleResetRoutes}
      />

      {/* ========================================================= */}
      {/* 🛡️ MODAL: AUDIT TRAIL / ACTIVITY HISTORY LOG               */}
      {/* ========================================================= */}
      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
        logs={activityLogs || []}
        onClearLogs={setActivityLogs ? () => setActivityLogs([]) : undefined}
      />

    </div>
  );
}
