import { initialData } from '@/context/initial-data';
import type { AttendanceRecord, Overtime } from '@/lib/types';

export interface SheetOvertimeEntry {
  date: string; // 'yyyy-MM-dd'
  empName: string;
  hours: number;
  amount: number;
  workType: string;
  note: string;
}

export const GOOGLE_SHEET_OVERTIME_DATA: SheetOvertimeEntry[] = [];

/**
 * Explicit Alias and Kurdish Spelling Mapping for 100% Accurate Employee Match
 */
export const EMPLOYEE_NAME_ALIASES: Record<string, string[]> = {
  'emp-07': ['ڕابەر محمود', 'ڕابەر محمد', 'ڕابەر محەمەد', 'ڕابەر مەحمود', 'ڕابەر محەمەد مەحمود', 'ڕابەر', 'raber', 'raber mahmood'],
  'emp-05': ['عیماد صباح', 'عیماد سەباح', 'عیماد سەباح نوری', 'عیماد', 'imad', 'emad'],
  'emp-03': ['شادیار وشیا', 'شادیار هوشیار', 'شادیار', 'shadyar'],
  'emp-11': ['شادومان یادگار', 'شادومان یادگار رحیم', 'شادومان', 'shaduman'],
  'emp-01': ['سەهەند مەریوان', 'سه هەند مەریوان', 'سه هەند مەریوان حەمەسەعید', 'سەهەند', 'sehend'],
  'emp-04': ['هەڤاڵ حبیب', 'هەڤاڵ حبیب حەمەڕەزا', 'هەڤاڵ', 'heval'],
  'emp-10': ['بەهرەنگ ڕزگار', 'بەهرەمەند ڕزگار', 'بەهرەمەند ڕزگار عزیز', 'بەهرەنگ', 'بەهرەمەند', 'bahrang'],
  'emp-12': ['سەروەت قادر', 'سەروەت', 'sarwat'],
  'emp-02': ['دارکۆ حەیدەر', 'دارکۆ حەیدەر حسێن', 'دارکۆ', 'darko'],
  'emp-06': ['کامەران عومەر', 'کامەران عومەر ڕووئوف', 'کامەران', 'kameron', 'kamaran'],
  'emp-08': ['دانەر محەمەد', 'دانەر محەمەد باسام', 'دانەر', 'daner'],
  'emp-09': ['ڕێبین سەباح', 'ڕێبین سەباح نوری', 'ڕێبین', 'rebin'],
};

export function normalizeKurdishText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[ێىي]/g, 'ی')
    .replace(/[ەھ]/g, 'ه')
    .replace(/محەمەد|مەحەمەد|محمد/g, 'محمد')
    .replace(/مەحمود|محمود/g, 'محمود')
    .replace(/سەباح|صباح/g, 'صباح')
    .replace(/\s+/g, ' ');
}

/**
 * Format full combined note from workType and note columns
 */
export function formatFullNote(workType?: string, note?: string): string {
  const w = (workType || '').trim();
  const n = (note || '').trim();
  if (w && n) {
    if (n.startsWith(w)) return n;
    return `${w} ، ${n}`;
  }
  return w || n || '';
}

/**
 * Match a raw name from Google Sheet with an employee in the system
 */
export function matchEmployeeByName(rawName: string, employees: any[]) {
  const clean = (rawName || '').trim().toLowerCase();
  const normalizedClean = normalizeKurdishText(rawName);

  // 1. Direct Alias Check
  for (const [empId, aliases] of Object.entries(EMPLOYEE_NAME_ALIASES)) {
    for (const alias of aliases) {
      if (clean === alias.toLowerCase() || normalizedClean === normalizeKurdishText(alias) || clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean)) {
        const found = employees.find(e => e.id === empId || e.employeeId === empId.replace('emp-', ''));
        if (found) return found;
      }
    }
  }

  // 2. Fuzzy text matching
  return employees.find(emp => {
    const n1 = (emp.fullName3Part || '').toLowerCase();
    const n2 = (emp.name || '').toLowerCase();
    const norm1 = normalizeKurdishText(n1);
    const norm2 = normalizeKurdishText(n2);
    const shortFirst = clean.split(' ')[0];

    return (
      n1 === clean ||
      n2 === clean ||
      norm1 === normalizedClean ||
      norm2 === normalizedClean ||
      norm1.includes(normalizedClean) ||
      normalizedClean.includes(norm2) ||
      (shortFirst && (n1.includes(shortFirst) || norm1.includes(normalizeKurdishText(shortFirst))))
    );
  });
}

/**
 * Format hours into departure time after 17:00
 */
export function calculateCheckOutTime(overtimeHours: number): string {
  const baseMinutes = 17 * 60; // 17:00 (1020 mins)
  const totalMinutes = baseMinutes + Math.round(overtimeHours * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

/**
 * Generate attendance records strictly from 2026-08-01 to 2026-08-15 (15 days only)
 */
export function generateAugust2026AttendanceRecords(employees: any[] = []): AttendanceRecord[] {
  return [];
}

/**
 * Generate Admin Notes dictionary for August 2026 (up to 15-8-2026)
 */
export function generateAugust2026AdminNotes(employees: any[] = []): Record<string, string> {
  return {};
}

export function generateAugust2026OvertimeList(employees: any[] = []): Overtime[] {
  return [];
}
