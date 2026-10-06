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

export async function fetchArchivedVouchers(): Promise<any[] | null> {
  try {
    return await fetchSupabaseJson<any[] | null>(ARCHIVED_VOUCHERS_LEDGER_KEY, null);
  } catch (err) {
    logger.error('[ExpensesService] Error fetching archived vouchers from Supabase:', err);
    return null;
  }
}

export async function saveArchivedVouchers(vouchers: any[]): Promise<boolean> {
  try {
    return await saveSupabaseJson<any[]>(
      ARCHIVED_VOUCHERS_LEDGER_KEY,
      'Ashley Archived Vouchers Ledger',
      vouchers
    );
  } catch (err) {
    logger.error('[ExpensesService] Error saving archived vouchers to Supabase:', err);
    return false;
  }
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
): Promise<{ success: boolean; request?: PendingExpenseRequest; newExpense?: Expense }> {
  try {
    const all = await fetchPendingExpenseRequests();
    const reqIndex = all.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      return { success: false };
    }

    const req = all[reqIndex];
    req.status = 'approved';
    req.approvedBy = approverName;
    req.approvedAt = new Date().toISOString();

    // 1. Create official expense record
    const expenses = await fetchExpenses();
    const newExpense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      employeeId: req.employeeId,
      amount: req.amount,
      date: req.dateStr,
      notes: `[داواکراوە لە تەلەگرام]: ${req.category} - ${req.note}`,
      expenseReportId: '',
      expenseType: req.category,
    };

    expenses.unshift(newExpense);
    await saveExpenses(expenses);
    await savePendingExpenseRequests(all);

    return { success: true, request: req, newExpense };
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


