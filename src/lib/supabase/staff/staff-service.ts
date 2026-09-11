import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Employee } from '@/lib/types';
import { initialData } from '@/context/initial-data';

const EMPLOYEES_KEY = 'ashley_employees';
const PROFILES_KEY = 'ashley_employee_profiles';

export async function fetchEmployees(): Promise<Employee[]> {
  try {
    // 1. Fetch main employees list from Supabase
    const employees = await fetchSupabaseJson<Employee[]>(EMPLOYEES_KEY, []);
    
    // 2. Fetch any updated profiles (phones, photos, dates, pins)
    const profiles = await fetchSupabaseJson<Record<string, Partial<Employee>>>(PROFILES_KEY, {});

    if (employees && employees.length > 0) {
      return employees.map((emp) => {
        const extra = profiles[emp.id] || {};
        return { ...emp, ...extra };
      });
    }

    // If first time, seed from initialData and save to Supabase
    const fallback = initialData.employees || [];
    if (fallback.length > 0) {
      await saveEmployees(fallback);
      return fallback;
    }

    return [];
  } catch (err) {
    console.error('[StaffService] Error fetching employees:', err);
    return initialData.employees || [];
  }
}

export async function saveEmployees(employees: Employee[]): Promise<boolean> {
  return await saveSupabaseJson<Employee[]>(
    EMPLOYEES_KEY,
    'Ashley Official Employees Directory',
    employees
  );
}

export async function updateEmployee(updated: Partial<Employee> & { id: string }): Promise<boolean> {
  try {
    const current = await fetchEmployees();
    const index = current.findIndex(e => e.id === updated.id);
    let newList: Employee[];
    if (index >= 0) {
      newList = [...current];
      newList[index] = { ...newList[index], ...updated };
    } else {
      newList = [...current, updated as Employee];
    }
    return await saveEmployees(newList);
  } catch (err) {
    console.error('[StaffService] Error updating employee:', err);
    return false;
  }
}
