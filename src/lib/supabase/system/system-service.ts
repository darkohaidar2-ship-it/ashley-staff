import { fetchSupabaseJson, saveSupabaseJson, supabase } from '@/lib/supabase/client';
import type { Role, ActivityLog, ExpenseReport, User } from '@/lib/types';
import { initialData } from '@/context/initial-data';

export const ROLES_KEY = 'ashley_system_roles';
export const ACTIVITY_LOGS_KEY = 'ashley_activity_logs';
export const EXPENSE_REPORTS_KEY = 'ashley_expense_reports';
export const USERS_LIST_KEY = 'ashley_system_users';

// ===================== ROLES =====================
export async function fetchRoles(): Promise<Role[]> {
  try {
    const list = await fetchSupabaseJson<Role[]>(ROLES_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.roles || [];
    if (fallback.length > 0) {
      await saveRoles(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[SystemService] Error fetching roles:', err);
    return initialData.roles || [];
  }
}

export async function saveRoles(records: Role[]): Promise<boolean> {
  return await saveSupabaseJson<Role[]>(
    ROLES_KEY,
    'Ashley System User Roles & Permissions',
    records
  );
}

// ===================== ACTIVITY LOGS =====================
export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  try {
    const list = await fetchSupabaseJson<ActivityLog[]>(ACTIVITY_LOGS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.activityLogs || [];
    if (fallback.length > 0) {
      await saveActivityLogs(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[SystemService] Error fetching activity logs:', err);
    return initialData.activityLogs || [];
  }
}

export async function saveActivityLogs(records: ActivityLog[]): Promise<boolean> {
  return await saveSupabaseJson<ActivityLog[]>(
    ACTIVITY_LOGS_KEY,
    'Ashley System Activity & Audit Trail Logs',
    records
  );
}

// ===================== EXPENSE REPORTS =====================
export async function fetchExpenseReports(): Promise<ExpenseReport[]> {
  try {
    const list = await fetchSupabaseJson<ExpenseReport[]>(EXPENSE_REPORTS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.expenseReports || [];
    if (fallback.length > 0) {
      await saveExpenseReports(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[SystemService] Error fetching expense reports:', err);
    return initialData.expenseReports || [];
  }
}

export async function saveExpenseReports(records: ExpenseReport[]): Promise<boolean> {
  return await saveSupabaseJson<ExpenseReport[]>(
    EXPENSE_REPORTS_KEY,
    'Ashley Accounting Expense Reports',
    records
  );
}

// ===================== USERS LIST =====================
export async function fetchUsersList(): Promise<User[]> {
  try {
    const list = await fetchSupabaseJson<User[]>(USERS_LIST_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.users || [];
    if (fallback.length > 0) {
      await saveUsersList(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[SystemService] Error fetching users list:', err);
    return initialData.users || [];
  }
}

export async function saveUsersList(records: User[]): Promise<boolean> {
  // 1. Save resilient JSON to warehouses store
  const saved = await saveSupabaseJson<User[]>(
    USERS_LIST_KEY,
    'Ashley System Registered Users',
    records
  );

  // 2. Also keep remote public.users table synchronized for valid columns (id, role)
  try {
    const validRows = records.map(u => ({
      id: u.id,
      role: u.role || 'user',
      updated_at: new Date().toISOString()
    }));
    await supabase.from('users').upsert(validRows);
  } catch (e) {
    console.warn('[SystemService] Non-critical: users table sync notice:', e);
  }

  return saved;
}
