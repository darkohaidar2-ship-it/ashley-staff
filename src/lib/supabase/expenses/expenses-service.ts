import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Expense, Bonus, CashWithdrawal, SalarySettings } from '@/lib/types';
import { initialData, initialSettings } from '@/context/initial-data';

const EXPENSES_KEY = 'ashley_expenses';
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
    console.error('[ExpensesService] Error fetching expenses:', err);
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
    console.error('[ExpensesService] Error fetching bonuses:', err);
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
    console.error('[ExpensesService] Error fetching withdrawals:', err);
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
    console.error('[ExpensesService] Error fetching salary settings:', err);
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
    console.error('[ExpensesService] Error fetching custom categories from Supabase:', err);
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
    console.error('[ExpensesService] Error saving custom categories to Supabase:', err);
    return false;
  }
}

export async function fetchCustomPresetReasons(): Promise<Record<string, string[]> | null> {
  try {
    return await fetchSupabaseJson<Record<string, string[]> | null>(CUSTOM_PRESET_REASONS_KEY, null);
  } catch (err) {
    console.error('[ExpensesService] Error fetching custom preset reasons from Supabase:', err);
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
    console.error('[ExpensesService] Error saving custom preset reasons to Supabase:', err);
    return false;
  }
}

export async function fetchArchivedVouchers(): Promise<any[] | null> {
  try {
    return await fetchSupabaseJson<any[] | null>(ARCHIVED_VOUCHERS_LEDGER_KEY, null);
  } catch (err) {
    console.error('[ExpensesService] Error fetching archived vouchers from Supabase:', err);
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
    console.error('[ExpensesService] Error saving archived vouchers to Supabase:', err);
    return false;
  }
}

