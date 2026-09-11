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
