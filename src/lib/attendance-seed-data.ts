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

export const GOOGLE_SHEET_OVERTIME_DATA: SheetOvertimeEntry[] = [
  // 1/8/2026
  { date: '2026-08-01', empName: 'ڕابەر محمود', hours: 4, amount: 20000, workType: 'چاککردنەوە', note: 'نقڵی پسوڵەی ژمارە AHS26-1530' },
  { date: '2026-08-01', empName: 'عیماد صباح', hours: 4, amount: 20000, workType: 'کارکردنی شەوان لەعرض', note: '' },
  { date: '2026-08-01', empName: 'شادیار وشیا', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: 'نقڵی پسوڵەی ژمارە AHS26-1530' },
  { date: '2026-08-01', empName: 'شادومان یادگار', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: 'نقڵی پسوڵەی ژمارە AHS26-1530' },

  // 2/8/2026
  { date: '2026-08-02', empName: 'ڕابەر محمود', hours: 3, amount: 15000, workType: 'چاککردنەوە', note: '' },
  { date: '2026-08-02', empName: 'عیماد صباح', hours: 6.5, amount: 32500, workType: 'کارکردنی شەوان لەعرض', note: '' },
  { date: '2026-08-02', empName: 'شادیار وشیا', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: '' },
  { date: '2026-08-02', empName: 'شادومان یادگار', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: '' },

  // 3/8/2026
  { date: '2026-08-03', empName: 'ڕابەر محمود', hours: 3, amount: 15000, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1337' },
  { date: '2026-08-03', empName: 'عیماد صباح', hours: 6, amount: 30000, workType: 'کارکردنی شەوان لەعرض', note: '' },
  { date: '2026-08-03', empName: 'شادیار وشیا', hours: 3, amount: 15000, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1337' },
  { date: '2026-08-03', empName: 'سەهەند مەریوان', hours: 3, amount: 15000, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1337' },

  // 4/8/2026
  { date: '2026-08-04', empName: 'ڕابەر محمود', hours: 2.5, amount: 12500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1472 - 1473' },
  { date: '2026-08-04', empName: 'عیماد صباح', hours: 6, amount: 30000, workType: 'کارکردنی شەوان لەعرض', note: '' },
  { date: '2026-08-04', empName: 'شادیار وشیا', hours: 2.5, amount: 12500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1472 - 1473' },
  { date: '2026-08-04', empName: 'شادومان یادگار', hours: 2.5, amount: 12500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1472 - 1473' },

  // 5/8/2026
  { date: '2026-08-05', empName: 'عیماد صباح', hours: 6, amount: 30000, workType: 'کارکردنی شەوان لەعرض', note: 'لە جیاتی بینەر' },

  // 8/8/2026
  { date: '2026-08-08', empName: 'شادیار وشیا', hours: 1.5, amount: 7500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1579' },
  { date: '2026-08-08', empName: 'شادومان یادگار', hours: 1.5, amount: 7500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1579' },
  { date: '2026-08-08', empName: 'ڕابەر محمود', hours: 2, amount: 10000, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1579' },

  // 9/8/2026
  { date: '2026-08-09', empName: 'ڕابەر محمود', hours: 3, amount: 15000, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1587' },
  { date: '2026-08-09', empName: 'شادومان یادگار', hours: 2.5, amount: 12500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1587' },
  { date: '2026-08-09', empName: 'شادیار وشیا', hours: 2.5, amount: 12500, workType: 'نقڵی ماڵان', note: 'پسوڵەی AHS26-1587' },

  // 10/8/2026
  { date: '2026-08-10', empName: 'ڕابەر محمود', hours: 5, amount: 25000, workType: 'چاککردنەوە', note: 'چاککردنی سەیارەی نقڵ' },
  { date: '2026-08-10', empName: 'شادومان یادگار', hours: 2, amount: 10000, workType: 'ڕوخاندنی سەقف', note: '' },
  { date: '2026-08-10', empName: 'شادیار وشیا', hours: 2, amount: 10000, workType: 'ڕوخاندنی سەقف', note: '' },
  { date: '2026-08-10', empName: 'هەڤاڵ حبیب', hours: 2, amount: 10000, workType: 'ڕوخاندنی سەقف', note: '' },
  { date: '2026-08-10', empName: 'بەهرەنگ ڕزگار', hours: 2, amount: 10000, workType: 'ڕوخاندنی سەقف', note: '' },

  // 11/8/2026
  { date: '2026-08-11', empName: 'ڕابەر محمود', hours: 7, amount: 35000, workType: 'شۆردنی سۆلار', note: '' },
  { date: '2026-08-11', empName: 'شادومان یادگار', hours: 7, amount: 35000, workType: 'شۆردنی سۆلار', note: '' },
  { date: '2026-08-11', empName: 'شادیار وشیا', hours: 7, amount: 35000, workType: 'شۆردنی سۆلار', note: '' },

  // 12/8/2026
  { date: '2026-08-12', empName: 'ڕابەر محمود', hours: 5, amount: 25000, workType: 'چاککردنەوە', note: 'چاککردنی قەنەفەی ماڵان' },
  { date: '2026-08-12', empName: 'شادومان یادگار', hours: 5, amount: 25000, workType: 'چاککردنەوە', note: 'چاککردنی قەنەفەی ماڵان' },
  { date: '2026-08-12', empName: 'شادیار وشیا', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: '' },

  // 13/8/2026
  { date: '2026-08-13', empName: 'ڕابەر محمود', hours: 5.5, amount: 27500, workType: 'نقڵی دەرەوەی شار', note: 'چون بۆ مزگەوتەکەی خورماڵ' },
  { date: '2026-08-13', empName: 'شادیار وشیا', hours: 5.5, amount: 27500, workType: 'نقڵی دەرەوەی شار', note: 'چون بۆ مزگەوتەکەی خورماڵ' },
  { date: '2026-08-13', empName: 'سەهەند مەریوان', hours: 5.5, amount: 27500, workType: 'نقڵی دەرەوەی شار', note: 'چون بۆ مزگەوتەکەی خورماڵ' },

  // 14/8/2026
  { date: '2026-08-14', empName: 'ڕابەر محمود', hours: 4, amount: 20000, workType: 'نقڵی دەرەوەی شار', note: 'گەڕانەوەی پارچەکان لە خورماڵ' },
  { date: '2026-08-14', empName: 'سەهەند مەریوان', hours: 6, amount: 30000, workType: 'نقڵی دەرەوەی شار', note: 'گەڕانەوەی پارچەکان لە خورماڵ' },
  { date: '2026-08-14', empName: 'سەروەت قادر', hours: 4, amount: 20000, workType: 'نقڵی دەرەوەی شار', note: 'گەڕانەوەی پارچەکان لە خورماڵ' },

  // 16/8/2026
  { date: '2026-08-16', empName: 'ڕابەر محمود', hours: 4.5, amount: 22500, workType: 'چاککردنەوە', note: '' },

  // 17/8/2026
  { date: '2026-08-17', empName: 'ڕابەر محمود', hours: 4, amount: 20000, workType: 'چاککردنەوە', note: '' },

  // 18/8/2026
  { date: '2026-08-18', empName: 'ڕابەر محمود', hours: 1, amount: 5000, workType: 'چاککردنەوە', note: '' },

  // 19/8/2026
  { date: '2026-08-19', empName: 'ڕابەر محمود', hours: 4, amount: 20000, workType: 'چاککردنەوە', note: '' },
  { date: '2026-08-19', empName: 'کامەران عمر', hours: 4, amount: 20000, workType: 'نقڵی ماڵان', note: '' },
  { date: '2026-08-19', empName: 'شادیار وشیا', hours: 1, amount: 5000, workType: 'نقڵی ماڵان', note: '' },
];

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
export function generateAugust2026AttendanceRecords(employees: any[] = initialData.employees): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const activeEmps = employees.filter(e => e.status !== 'resigned' && e.isActive !== false);

  // Up to 19-8-2026 as per Google Sheet data
  for (let day = 1; day <= 19; day++) {
    const dayStr = day.toString().padStart(2, '0');
    const dateStr = `2026-08-${dayStr}`;
    const dateObj = new Date(2026, 7, day);
    const dayOfWeek = dateObj.getDay(); // 5 is Friday

    activeEmps.forEach(emp => {
      // Find if this employee had overtime on this specific date in the Sheet
      const otMatch = GOOGLE_SHEET_OVERTIME_DATA.find(ot => {
        if (ot.date !== dateStr) return false;
        const matched = matchEmployeeByName(ot.empName, [emp]);
        return !!matched;
      });

      const isFriday = dayOfWeek === 5;
      // If Friday and NO overtime specified, employee was off
      if (isFriday && !otMatch) {
        return;
      }

      const checkInTime = '08:00:00';
      const checkOutTime = otMatch 
        ? calculateCheckOutTime(otMatch.hours)
        : '17:00:00';

      const fullNote = otMatch ? formatFullNote(otMatch.workType, otMatch.note) : undefined;

      // Check In Log (08:00 AM)
      records.push({
        id: `att-${emp.id}-${dateStr}-in`,
        employeeId: emp.id,
        userId: emp.id,
        userName: emp.fullName3Part || emp.name,
        name: emp.fullName3Part || emp.name,
        type: 'هاتن (Check In)',
        time: `${dateStr} ${checkInTime}`,
        date: dateStr,
        distance: 'داخل کۆمپانیا',
        status: 'verified',
        createdAt: `${dateStr}T${checkInTime}Z`,
      } as any);

      // Check Out Log (17:00 or overtime departure)
      records.push({
        id: `att-${emp.id}-${dateStr}-out`,
        employeeId: emp.id,
        userId: emp.id,
        userName: emp.fullName3Part || emp.name,
        name: emp.fullName3Part || emp.name,
        type: 'دەرچوون (Check Out)',
        time: `${dateStr} ${checkOutTime}`,
        date: dateStr,
        distance: 'داخل کۆمپانیا',
        status: 'verified',
        createdAt: `${dateStr}T${checkOutTime}Z`,
        notes: fullNote,
      } as any);
    });
  }

  return records;
}

/**
 * Generate Admin Notes dictionary for August 2026 (up to 15-8-2026)
 */
export function generateAugust2026AdminNotes(employees: any[] = initialData.employees): Record<string, string> {
  const notesMap: Record<string, string> = {};

  GOOGLE_SHEET_OVERTIME_DATA.forEach(ot => {
    const matched = matchEmployeeByName(ot.empName, employees);
    if (matched) {
      const key = `${matched.id}_${ot.date}`;
      notesMap[key] = formatFullNote(ot.workType, ot.note);
    }
  });

  return notesMap;
}

/**
 * Generate manual/system Overtime entities for August 2026 (up to 15-8-2026)
 */
export function generateAugust2026OvertimeList(employees: any[] = initialData.employees): Overtime[] {
  return GOOGLE_SHEET_OVERTIME_DATA.map((ot, idx) => {
    const matched = matchEmployeeByName(ot.empName, employees);
    const empId = matched?.id || `emp-sheet-${idx + 1}`;
    const empName = matched?.fullName3Part || matched?.name || ot.empName;
    const noteText = formatFullNote(ot.workType, ot.note);

    return {
      id: `ot_sheet_${idx + 1}_${ot.date}`,
      employeeId: empId,
      employeeName: empName,
      date: ot.date,
      hours: ot.hours,
      rate: 5000,
      totalAmount: ot.amount || (ot.hours * 5000),
      note: noteText,
      createdAt: `${ot.date}T17:00:00Z`,
    } as any;
  });
}
