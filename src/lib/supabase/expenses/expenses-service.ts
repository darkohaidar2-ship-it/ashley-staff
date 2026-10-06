import { logger } from '@/lib/logger';
import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Expense, Bonus, CashWithdrawal, SalarySettings, PendingExpenseRequest } from '@/lib/types';
import { initialData, initialSettings } from '@/context/initial-data';

const EXPENSES_KEY = 'ashley_expenses';
const PENDING_EXPENSES_KEY = 'ashley_pending_expenses';
const BONUSES_KEY = 'ashley_bonuses';
const WITHDRAWALS_KEY = 'ashley_withdrawals';
const SALARY_SETTINGS_KEY = 'ashley_salary_settings';

// ===================== EXPENSES =====================
export async function fetchExpenses(): Promise<Expense[]> {
  try {
    const list = await fetchSupabaseJson<Expense[]>(EXPENSES_KEY, []);
    if (list && list.length > 0) {
      return list;
    }
    const fallback = initialData.expenses || [];
    if (fallback.length > 0) {
      await saveExpenses(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    logger.error('[ExpensesService] Error fetching expenses:', err);
    return initialData.expenses || [];
  }
}

export async function saveExpenses(records: Expense[]): Promise<boolean> {
  return await saveSupabaseJson<Expense[]>(
    EXPENSES_KEY,
    'Ashley Daily Expenses Database',
    records
  );
}

// ===================== BONUSES =====================
export async function fetchBonuses(): Promise<Bonus[]> {
  try {
    const list = await fetchSupabaseJson<Bonus[]>(BONUSES_KEY, []);
    if (list && list.length > 0) {
      return list;
    }
    const fallback = initialData.bonuses || [];
    if (fallback.length > 0) {
      await saveBonuses(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    logger.error('[ExpensesService] Error fetching bonuses:', err);
    return initialData.bonuses || [];
  }
}

export async function saveBonuses(records: Bonus[]): Promise<boolean> {
  return await saveSupabaseJson<Bonus[]>(
    BONUSES_KEY,
    'Ashley Staff Bonuses Database',
    records
  );
}

// ===================== WITHDRAWALS =====================
export async function fetchWithdrawals(): Promise<CashWithdrawal[]> {
  try {
    const list = await fetchSupabaseJson<CashWithdrawal[]>(WITHDRAWALS_KEY, []);
    if (list && list.length > 0) {
      return list;
    }
    const fallback = initialData.withdrawals || [];
    if (fallback.length > 0) {
      await saveWithdrawals(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    logger.error('[ExpensesService] Error fetching withdrawals:', err);
    return initialData.withdrawals || [];
  }
}

export async function saveWithdrawals(records: CashWithdrawal[]): Promise<boolean> {
  return await saveSupabaseJson<CashWithdrawal[]>(
    WITHDRAWALS_KEY,
    'Ashley Cash Withdrawals Database',
    records
  );
}

// ===================== SALARY SETTINGS =====================
export async function fetchSalarySettings(): Promise<SalarySettings> {
  try {
    const fallback = initialSettings.salarySettings || { overtimeRate: 5000, bonusRate: 5000 };
    return await fetchSupabaseJson<SalarySettings>(SALARY_SETTINGS_KEY, fallback);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching salary settings:', err);
    return initialSettings.salarySettings || { overtimeRate: 5000, bonusRate: 5000 };
  }
}

export async function saveSalarySettings(settings: SalarySettings): Promise<boolean> {
  return await saveSupabaseJson<SalarySettings>(
    SALARY_SETTINGS_KEY,
    'Ashley Salary & Rate Settings',
    settings
  );
}

// ===================== CUSTOM EXPENSE CATEGORIES & PRESET REASONS (CLOUD SYNC) =====================
const CUSTOM_EXPENSE_CATEGORIES_KEY = 'ashley_custom_expense_categories_v2';
const CUSTOM_PRESET_REASONS_KEY = 'ashley_custom_preset_reasons_v2';
const ARCHIVED_VOUCHERS_LEDGER_KEY = 'ashley_archived_vouchers_ledger_v3';

export interface CustomExpenseCategory {
  id: string;
  label: string;
  color: string;
}

export async function fetchCustomExpenseCategories(): Promise<CustomExpenseCategory[] | null> {
  try {
    return await fetchSupabaseJson<CustomExpenseCategory[] | null>(CUSTOM_EXPENSE_CATEGORIES_KEY, null);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching custom categories from Supabase:', err);
    return null;
  }
}

export async function saveCustomExpenseCategories(categories: CustomExpenseCategory[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<CustomExpenseCategory[]>(
      CUSTOM_EXPENSE_CATEGORIES_KEY,
      'Ashley Custom Expense Categories',
      categories
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving custom categories to Supabase:', err);
    return false;
  }
}

export async function fetchCustomPresetReasons(): Promise<Record<string, string[]> | null> {
  try {
    return await fetchSupabaseJson<Record<string, string[]> | null>(CUSTOM_PRESET_REASONS_KEY, null);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching custom preset reasons from Supabase:', err);
    return null;
  }
}

export async function saveCustomPresetReasons(reasonsMap: Record<string, string[]>): Promise<boolean> {
  try {
    return await saveSupabaseJson<Record<string, string[]>>(
      CUSTOM_PRESET_REASONS_KEY,
      'Ashley Custom Preset Reasons',
      reasonsMap
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving custom preset reasons to Supabase:', err);
    return false;
  }
}

// ===================== CUSTOM TRANSPORT ROUTES (CLOUD SYNC) =====================
const CUSTOM_ROUTES_KEY = 'ashley_custom_routes_v1';
const CUSTOM_OVERTIME_REASONS_KEY = 'ashley_custom_overtime_reasons_v1';

export interface CustomRouteItem {
  id: string;
  from: string; // لە
  to: string;   // بۆ
  label?: string; // e.g. "🏢 سەرەکی ⬅️ هوانە"
}

export const DEFAULT_CUSTOM_ROUTES: CustomRouteItem[] = [
  { id: 'r1', from: 'کۆمپانیای سەرەکی', to: 'هوانە', label: '🏢 سەرەکی ⬅️ هوانە' },
  { id: 'r2', from: 'کۆگای سەرەکی', to: 'پێشانگا', label: '📦 کۆگا ⬅️ پێشانگا' },
  { id: 'r3', from: 'پێشانگا', to: 'بازاڕ', label: '🏬 پێشانگا ⬅️ بازاڕ' },
  { id: 'r4', from: 'کۆگا', to: 'ماڵان', label: '🚚 کۆگا ⬅️ ماڵان' },
  { id: 'r5', from: 'کارگە', to: 'کۆگا', label: '🏭 کارگە ⬅️ کۆگا' },
  { id: 'r6', from: 'ناوەوەی شار', to: 'دەرەوەی شار', label: '🛣️ دەرەوەی شار' },
];

export const DEFAULT_OVERTIME_REASONS: string[] = [
  'IT',
  'شۆردنی سۆلار',
  'نقڵی دەرەوەی شار',
  'نقڵی ماڵان',
  'چاککردنەوە',
  'کارکردنی شەوان لەعرض',
];

export async function fetchCustomRoutes(): Promise<CustomRouteItem[] | null> {
  try {
    return await fetchSupabaseJson<CustomRouteItem[] | null>(CUSTOM_ROUTES_KEY, null);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching custom routes from Supabase:', err);
    return null;
  }
}

export async function saveCustomRoutes(routes: CustomRouteItem[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<CustomRouteItem[]>(
      CUSTOM_ROUTES_KEY,
      'Ashley Custom Transport Routes',
      routes
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving custom routes to Supabase:', err);
    return false;
  }
}

export async function fetchCustomOvertimeReasons(): Promise<string[] | null> {
  try {
    // 1. Check dedicated overtime key
    const list = await fetchSupabaseJson<string[] | null>(CUSTOM_OVERTIME_REASONS_KEY, null);
    if (list && Array.isArray(list) && list.length > 0) return list;

    // 2. Check preset reasons map 'overtime' key
    const presetMap = await fetchCustomPresetReasons();
    if (presetMap && Array.isArray(presetMap['overtime']) && presetMap['overtime'].length > 0) {
      return presetMap['overtime'];
    }

    return null;
  } catch (err) {
    logger.error('[ExpensesService] Error fetching custom overtime reasons from Supabase:', err);
    return null;
  }
}

export async function saveCustomOvertimeReasons(reasons: string[]): Promise<boolean> {
  try {
    const ok = await saveSupabaseJson<string[]>(
      CUSTOM_OVERTIME_REASONS_KEY,
      'Ashley Custom Overtime Reasons',
      reasons
    );
    // Also sync to preset reasons map
    const presetMap = (await fetchCustomPresetReasons()) || {};
    presetMap['overtime'] = reasons;
    await saveCustomPresetReasons(presetMap);
    return ok;
  } catch (err) {
    logger.error('[ExpensesService] Error saving custom overtime reasons to Supabase:', err);
    return false;
  }
}

export interface ArchivedVoucher {
  id: string;
  type: 'expenses' | 'bonuses' | 'withdrawals';
  name: string;
  month: string;
  createdAt: string;
  dateRange: string;
  totalAmount: number;
  itemCount: number;
  items: any[];
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
}

export async function fetchArchivedVouchers(): Promise<ArchivedVoucher[] | null> {
  try {
    return await fetchSupabaseJson<ArchivedVoucher[] | null>(ARCHIVED_VOUCHERS_LEDGER_KEY, null);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching archived vouchers from Supabase:', err);
    return null;
  }
}

export async function saveArchivedVouchers(vouchers: ArchivedVoucher[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<ArchivedVoucher[]>(
      ARCHIVED_VOUCHERS_LEDGER_KEY,
      'Ashley Archived Vouchers Ledger',
      vouchers
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving archived vouchers to Supabase:', err);
    return false;
  }
}

export async function toggleVoucherLock(
  voucherId: string, 
  lockState?: boolean,
  lockedBy?: string
): Promise<{ success: boolean; isLocked: boolean; voucher?: ArchivedVoucher }> {
  try {
    const vouchers: ArchivedVoucher[] = (await fetchArchivedVouchers()) || [];
    const index = vouchers.findIndex(v => v.id === voucherId);
    if (index === -1) {
      return { success: false, isLocked: false };
    }

    const current = vouchers[index];
    const newLock = typeof lockState === 'boolean' ? lockState : !current.isLocked;

    vouchers[index] = {
      ...current,
      isLocked: newLock,
      lockedAt: newLock ? new Date().toISOString() : undefined,
      lockedBy: newLock ? (lockedBy || 'بەڕێوەبەر') : undefined,
    };

    await saveArchivedVouchers(vouchers);
    return { success: true, isLocked: newLock, voucher: vouchers[index] };
  } catch (err) {
    logger.error('[ExpensesService] Error toggling voucher lock:', err);
    return { success: false, isLocked: false };
  }
}

export async function getActiveOpenVoucher(
  type: 'expenses' | 'bonuses' | 'withdrawals' = 'expenses',
  month?: string
): Promise<ArchivedVoucher | null> {
  const vouchers = (await fetchArchivedVouchers()) || [];
  if (month) {
    const exact = vouchers.find(v => v.type === type && !v.isLocked && v.month === month);
    if (exact) return exact;
  }
  return vouchers.find(v => v.type === type && !v.isLocked) || null;
}

export async function addApprovedExpenseToVoucherLedger(
  req: PendingExpenseRequest,
  approverName: string
): Promise<{ voucher: ArchivedVoucher; isNewVoucher: boolean; item: any }> {
  const allVouchers: ArchivedVoucher[] = (await fetchArchivedVouchers()) || [];

  // 1. Precise Asia/Baghdad timezone timestamp
  const now = new Date();
  const baghdadParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const getP = (t: string) => baghdadParts.find(p => p.type === t)?.value || '00';
  let hh = getP('hour');
  if (hh === '24') hh = '00';
  const baghdadDateStr = `${getP('year')}-${getP('month')}-${getP('day')}`;
  const baghdadTimeStr = `${hh}:${getP('minute')}:${getP('second')}`;

  const effectiveDate = req.dateStr || baghdadDateStr;
  const effectiveMonth = effectiveDate.slice(0, 7);

  // 2. Parse category and route
  const catLower = (req.category || '').toLowerCase();
  const itemType = 
    catLower.includes('تەکسی') || catLower.includes('هاتوچۆ') ? 'taxi' :
    catLower.includes('خواردن') ? 'food' :
    catLower.includes('بەنزین') || catLower.includes('سووتەمەنی') ? 'fuel' :
    catLower.includes('ئۆفیس') || catLower.includes('مەکتەب') ? 'office' : 'other';

  let fromLoc = req.from;
  let toLoc = req.to;
  if (!fromLoc && req.route) {
    if (req.route.includes(' بۆ ')) {
      const parts = req.route.split(' بۆ ');
      fromLoc = parts[0]?.trim();
      toLoc = parts[1]?.trim();
    } else if (req.route.includes(' ⬅️ ')) {
      const parts = req.route.split(' ⬅️ ');
      fromLoc = parts[0]?.trim();
      toLoc = parts[1]?.trim();
    }
  }

  // Create rich item with all notes and details
  const voucherItem = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    employeeId: req.employeeId,
    employeeName: req.employeeName,
    date: effectiveDate,
    amount: Number(req.amount || 0),
    totalAmount: Number(req.amount || 0),
    category: req.category,
    type: itemType,
    from: fromLoc || undefined,
    to: toLoc || undefined,
    route: req.route || (fromLoc && toLoc ? `${fromLoc} ⬅️ ${toLoc}` : undefined),
    trip: itemType === 'taxi' ? 1 : undefined,
    note: req.note,
    reason: req.note,
    receiptPhotoUrl: req.receiptPhotoUrl || undefined,
    receiptTelegramFileId: req.receiptTelegramFileId || undefined,
    source: 'telegram_bot',
    approvedBy: approverName,
    approvedAt: req.approvedAt || now.toISOString(),
    createdAt: now.toISOString(),
  };

  // 3. Find an OPEN (unlocked) voucher for expenses in this month (or most recent open voucher)
  let openVoucherIndex = allVouchers.findIndex(
    v => v.type === 'expenses' && v.isLocked !== true && v.month === effectiveMonth
  );

  if (openVoucherIndex === -1) {
    openVoucherIndex = allVouchers.findIndex(
      v => v.type === 'expenses' && v.isLocked !== true
    );
  }

  let finalVoucher: ArchivedVoucher;
  let isNewVoucher = false;

  if (openVoucherIndex !== -1) {
    // 🌟 Found Open Voucher: Append to it!
    const targetVoucher = allVouchers[openVoucherIndex];
    targetVoucher.items = [voucherItem, ...(targetVoucher.items || [])];
    targetVoucher.itemCount = targetVoucher.items.length;
    targetVoucher.totalAmount = targetVoucher.items.reduce(
      (sum, item) => sum + Number(item.amount || item.totalAmount || 0),
      0
    );

    // Update date range
    const allDates = Array.from(new Set(targetVoucher.items.map(i => i.date).filter(Boolean))).sort();
    if (allDates.length === 1) {
      targetVoucher.dateRange = String(allDates[0]);
    } else if (allDates.length > 1) {
      targetVoucher.dateRange = `${allDates[0]} تا ${allDates[allDates.length - 1]}`;
    }

    finalVoucher = targetVoucher;
    allVouchers[openVoucherIndex] = targetVoucher;
  } else {
    // 🌟 No Open Voucher: Create Brand New Voucher with Exact Date & Metadata!
    isNewVoucher = true;
    const realTimeName = `لیستی خەرجییەکان • ${effectiveDate} (${baghdadTimeStr})`;

    const newVoucher: ArchivedVoucher = {
      id: `vch_expenses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'expenses',
      name: realTimeName,
      month: effectiveMonth,
      createdAt: now.toISOString(),
      dateRange: effectiveDate,
      totalAmount: Number(req.amount || 0),
      itemCount: 1,
      items: [voucherItem],
      isLocked: false, // OPEN by default!
    };

    allVouchers.unshift(newVoucher);
    finalVoucher = newVoucher;
  }

  await saveArchivedVouchers(allVouchers);

  return {
    voucher: finalVoucher,
    isNewVoucher,
    item: voucherItem,
  };
}

// ===================== PENDING EXPENSES WORKFLOW =====================

export async function fetchPendingExpenseRequests(): Promise<PendingExpenseRequest[]> {
  try {
    const list = await fetchSupabaseJson<PendingExpenseRequest[]>(PENDING_EXPENSES_KEY, []);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    logger.error('[ExpensesService] Error fetching pending expense requests:', err);
    return [];
  }
}

export async function savePendingExpenseRequests(requests: PendingExpenseRequest[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<PendingExpenseRequest[]>(
      PENDING_EXPENSES_KEY,
      'Ashley Pending Expense Submissions Database',
      requests
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving pending expense requests:', err);
    return false;
  }
}

export async function createPendingExpenseRequest(
  data: Omit<PendingExpenseRequest, 'id' | 'createdAt' | 'status'>
): Promise<PendingExpenseRequest> {
  const all = await fetchPendingExpenseRequests();
  const id = `exp_req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newReq: PendingExpenseRequest = {
    ...data,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  all.unshift(newReq);
  await savePendingExpenseRequests(all);
  return newReq;
}

export async function approveExpenseRequest(
  id: string, 
  approverName: string
): Promise<{ success: boolean; request?: PendingExpenseRequest; newExpense?: Expense; voucher?: ArchivedVoucher; isNewVoucher?: boolean }> {
  try {
    const all = await fetchPendingExpenseRequests();
    const reqIndex = all.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return { success: false };
    }

    const req = all[reqIndex];
    if (req.status === 'approved') {
      return { success: false };
    }

    req.status = 'approved';
    req.approvedBy = approverName;
    req.approvedAt = new Date().toISOString();

    // 1. Create official individual expense record
    const expenses = await fetchExpenses();
    const newExpense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      employeeId: req.employeeId,
      amount: req.amount,
      date: req.dateStr,
      notes: req.route ? `[${req.category}] (${req.route}): ${req.note}` : `[${req.category}]: ${req.note}`,
      expenseReportId: '',
      expenseType: req.category,
    };

    expenses.unshift(newExpense);
    await saveExpenses(expenses);

    // 2. 🌟 Record into the active Open Voucher or create a New Voucher!
    const { voucher, isNewVoucher } = await addApprovedExpenseToVoucherLedger(req, approverName);

    // 3. Save pending requests
    await savePendingExpenseRequests(all);

    return { success: true, request: req, newExpense, voucher, isNewVoucher };
  } catch (err) {
    logger.error('[ExpensesService] Error approving expense request:', err);
    return { success: false };
  }
}

export async function rejectExpenseRequest(
  id: string, 
  approverName: string,
  reason?: string
): Promise<{ success: boolean; request?: PendingExpenseRequest }> {
  try {
    const all = await fetchPendingExpenseRequests();
    const reqIndex = all.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return { success: false };
    }

    const req = all[reqIndex];
    req.status = 'rejected';
    req.approvedBy = approverName;
    req.approvedAt = new Date().toISOString();
    if (reason) req.rejectionReason = reason;

    await savePendingExpenseRequests(all);
    return { success: true, request: req };
  } catch (err) {
    logger.error('[ExpensesService] Error rejecting expense request:', err);
    return { success: false };
  }
}


