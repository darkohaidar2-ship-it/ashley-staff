import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { Overtime } from '@/lib/types';
import { initialData } from '@/context/initial-data';

const OVERTIME_KEY = 'ashley_overtime';

export async function fetchOvertime(): Promise<Overtime[]> {
  try {
    const list = await fetchSupabaseJson<Overtime[]>(OVERTIME_KEY, []);
    if (list && list.length > 0) {
      return list;
    }
    // Fallback seed
    const fallback = initialData.overtime || [];
    if (fallback.length > 0) {
      await saveOvertime(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[OvertimeService] Error fetching overtime:', err);
    return initialData.overtime || [];
  }
}

export async function saveOvertime(records: Overtime[]): Promise<boolean> {
  return await saveSupabaseJson<Overtime[]>(
    OVERTIME_KEY,
    'Ashley Overtime Records Database',
    records
  );
}

export async function addOvertimeRecord(record: Overtime): Promise<boolean> {
  try {
    const current = await fetchOvertime();
    const updated = [record, ...current.filter(r => r.id !== record.id)];
    return await saveOvertime(updated);
  } catch (err) {
    console.error('[OvertimeService] Error adding overtime:', err);
    return false;
  }
}

export async function deleteOvertimeRecord(id: string): Promise<boolean> {
  try {
    const current = await fetchOvertime();
    const updated = current.filter(r => r.id !== id);
    return await saveOvertime(updated);
  } catch (err) {
    console.error('[OvertimeService] Error deleting overtime:', err);
    return false;
  }
}
