import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import type { Employee } from '@/lib/types';

export interface EmployeeShiftConfig {
  shiftType: 'morning' | 'evening' | 'custom';
  shiftLabel: string;
  startTime: string;        // '08:00'
  endTime: string;          // '17:00'
  targetWorkHours: number;  // 8 or 7
  hasBreak: boolean;        // true (warehouse/regular) or false (continuous)
  breakStart: string;       // '12:00'
  breakEnd: string;         // '13:00'
  breakMinutes: number;     // 60
  worksOnFriday: boolean;
}

const SHIFT_SETTINGS_KEY = 'ashley_employee_shift_settings';

// In-memory cache for fast lookup
let shiftSettingsCache: Record<string, Partial<EmployeeShiftConfig>> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30s

export function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const clean = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr;
  const parts = clean.split(':').map(Number);
  if (isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

export function minutesToTimeStr(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get shift settings map from Supabase or localStorage
 */
export async function fetchAllShiftSettings(): Promise<Record<string, Partial<EmployeeShiftConfig>>> {
  const now = Date.now();
  if (shiftSettingsCache && now - lastCacheTime < CACHE_TTL_MS) {
    return shiftSettingsCache;
  }

  try {
    const data = await fetchSupabaseJson<Record<string, Partial<EmployeeShiftConfig>>>(SHIFT_SETTINGS_KEY, {});
    if (data && typeof data === 'object') {
      shiftSettingsCache = data;
      lastCacheTime = now;
      return data;
    }
  } catch (err) {
    logger.warn('[ShiftService] Failed to load shift settings from Supabase:', err);
  }

  // Fallback to localStorage on client
  if (typeof window !== 'undefined') {
    try {
      const local = localStorage.getItem('ashley_employee_shifts_map');
      if (local) {
        const parsed = JSON.parse(local);
        shiftSettingsCache = parsed;
        return parsed;
      }
    } catch (e) {
      logger.warn('[ShiftService] LocalStorage read error:', e);
    }
  }

  return {};
}

/**
 * Save shift settings for a specific employee
 */
export async function saveEmployeeShiftSettings(
  empId: string, 
  settings: Partial<EmployeeShiftConfig>
): Promise<boolean> {
  try {
    const cleanId = String(empId).trim();
    const all = await fetchAllShiftSettings();
    all[cleanId] = {
      ...(all[cleanId] || {}),
      ...settings,
    };

    // Also mirror clean variations
    const rawNum = cleanId.replace(/^emp-0*/i, '') || cleanId.replace('emp-', '');
    all[`emp-${rawNum}`] = all[cleanId];
    all[`emp-0${rawNum}`] = all[cleanId];

    shiftSettingsCache = all;
    lastCacheTime = Date.now();

    // Save to Supabase
    await saveSupabaseJson(SHIFT_SETTINGS_KEY, 'Ashley Staff Shift & Break Configurations', all);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_employee_shifts_map', JSON.stringify(all));
    }

    return true;
  } catch (err) {
    logger.error('[ShiftService] Error saving employee shift settings:', err);
    return false;
  }
}

/**
 * Resolves the authoritative shift configuration for an employee
 */
export function getEmployeeShiftConfig(
  employee: Employee | string | null | undefined,
  allSettingsMap?: Record<string, Partial<EmployeeShiftConfig>>
): EmployeeShiftConfig {
  let empId = typeof employee === 'string' ? employee : employee?.id || '';
  const cleanId = empId.trim();
  const rawNum = cleanId.replace(/^emp-0*/i, '') || cleanId.replace('emp-', '');

  const override = allSettingsMap 
    ? (allSettingsMap[cleanId] || allSettingsMap[`emp-${rawNum}`] || allSettingsMap[`emp-0${rawNum}`] || allSettingsMap[rawNum])
    : (shiftSettingsCache ? (shiftSettingsCache[cleanId] || shiftSettingsCache[`emp-${rawNum}`] || shiftSettingsCache[rawNum]) : null);

  // If passed an Employee object, check its direct fields
  const empObj = typeof employee === 'object' && employee !== null ? employee : ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === cleanId || e.id === `emp-${rawNum}`);

  const role = ((empObj as any)?.role || '').toLowerCase();
  const name = (empObj?.name || '').toLowerCase();
  const isWarehouse = role.includes('warehouse') || role.includes('کۆگا') || name.includes('کامەران') || name.includes('شادیار') || cleanId === 'emp-06' || cleanId === 'emp-03';

  // Base Defaults:
  // Warehouse Staff: 8:00 - 17:00 (9 hours total) with 12:00-13:00 break (60 min), net work = 8 hours
  // Regular Staff: Default 8 hours with break
  const defaultStartTime = empObj?.customShiftStart || override?.startTime || '08:00';
  const defaultEndTime = empObj?.customShiftEnd || override?.endTime || '17:00';
  const defaultHasBreak = override?.hasBreak !== undefined ? override.hasBreak : (empObj?.hasBreak !== undefined ? Boolean(empObj.hasBreak) : true);
  const defaultBreakMinutes = override?.breakMinutes !== undefined ? override.breakMinutes : (empObj?.breakMinutes !== undefined ? empObj.breakMinutes : 60);
  const defaultTargetHours = override?.targetWorkHours !== undefined ? override.targetWorkHours : (empObj?.targetWorkHours !== undefined && empObj.targetWorkHours !== null ? empObj.targetWorkHours : 8);

  const startTime = (override?.startTime || empObj?.customShiftStart || defaultStartTime).slice(0, 5);
  const endTime = (override?.endTime || empObj?.customShiftEnd || defaultEndTime).slice(0, 5);
  const hasBreak = override?.hasBreak !== undefined ? override.hasBreak : defaultHasBreak;
  const breakStart = (override?.breakStart || empObj?.breakStart || '12:00').slice(0, 5);
  const breakEnd = (override?.breakEnd || empObj?.breakEnd || '13:00').slice(0, 5);
  const breakMinutes = hasBreak ? (override?.breakMinutes ?? defaultBreakMinutes ?? 60) : 0;
  const targetWorkHours = override?.targetWorkHours ?? defaultTargetHours ?? (hasBreak ? 8 : 7);
  const shiftType = (override?.shiftType || empObj?.shiftType || (targetWorkHours === 7 ? 'custom' : 'morning')) as 'morning' | 'evening' | 'custom';
  const worksOnFriday = Boolean(override?.worksOnFriday ?? empObj?.worksOnFriday ?? false);

  const shiftLabel = targetWorkHours === 7 && !hasBreak
    ? `٧ کاتژمێری بێ پشوو (${startTime}-${endTime})`
    : `٨ کاتژمێری بە پشوو (${startTime}-${endTime} | پشوو: ${breakStart}-${breakEnd})`;

  return {
    shiftType,
    shiftLabel,
    startTime,
    endTime,
    targetWorkHours,
    hasBreak,
    breakStart,
    breakEnd,
    breakMinutes,
    worksOnFriday,
  };
}

/**
 * 🧮 CALCULATE NET WORKING TIME & OVERTIME
 * Pure net working time rule:
 * Net Work Time = Total Punch Duration - Lunch Break Overlap
 * Overtime is calculated only when Net Work Time > Target Work Hours or check-out is past shift end.
 */
export function calculateNetWorkedAndOvertime(
  inTimeStr: string | null | undefined,
  outTimeStr: string | null | undefined,
  config: EmployeeShiftConfig
): {
  rawMinutes: number;
  breakDeductedMinutes: number;
  netWorkedMinutes: number;
  netWorkedHours: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isOvertime: boolean;
  isLate: boolean;
} {
  const inM = timeToMinutes(inTimeStr);
  let outM = timeToMinutes(outTimeStr);

  if (inM === null || outM === null) {
    return {
      rawMinutes: 0,
      breakDeductedMinutes: 0,
      netWorkedMinutes: 0,
      netWorkedHours: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      isOvertime: false,
      isLate: false,
    };
  }

  // Handle midnight wrap (e.g. out at 01:00 AM -> 1440 + 60 = 1500)
  if (outM <= 360 && outM < inM) {
    outM += 1440;
  }

  if (outM <= inM) {
    return {
      rawMinutes: 0,
      breakDeductedMinutes: 0,
      netWorkedMinutes: 0,
      netWorkedHours: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      isOvertime: false,
      isLate: false,
    };
  }

  const rawMinutes = outM - inM;

  // 1. Calculate Break Deduction
  let breakDeductedMinutes = 0;
  if (config.hasBreak && config.breakMinutes > 0) {
    const breakStartM = timeToMinutes(config.breakStart) ?? (12 * 60);
    const breakEndM = timeToMinutes(config.breakEnd) ?? (13 * 60);

    // Precise overlap between [inM, outM] and [breakStartM, breakEndM]
    if (outM > breakStartM && inM < breakEndM) {
      const overlapStart = Math.max(inM, breakStartM);
      const overlapEnd = Math.min(outM, breakEndM);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      breakDeductedMinutes = Math.min(config.breakMinutes, overlap);
    } else if (rawMinutes >= 360 && inM <= breakStartM && outM >= breakEndM) {
      // Fallback for long full day punch spanning midday
      breakDeductedMinutes = config.breakMinutes;
    }
  }

  // Pure net worked time
  const netWorkedMinutes = Math.max(0, rawMinutes - breakDeductedMinutes);
  const netWorkedHours = Math.round((netWorkedMinutes / 60) * 10) / 10;

  // 2. Late Minutes Calculation (Shift start + 15 min grace)
  const shiftStartM = timeToMinutes(config.startTime) ?? (8 * 60);
  let lateMinutes = 0;
  let isLate = false;
  if (inM > shiftStartM + 15) {
    lateMinutes = inM - shiftStartM;
    isLate = true;
  }

  // 3. Early Leave & Overtime Calculation
  const shiftEndM = timeToMinutes(config.endTime) ?? (17 * 60);
  const targetWorkMinutes = config.targetWorkHours * 60; // e.g. 480 mins for 8h, 420 mins for 7h

  let earlyLeaveMinutes = 0;
  if (outM < shiftEndM - 15) {
    earlyLeaveMinutes = shiftEndM - outM;
  }

  let overtimeMinutes = 0;
  let isOvertime = false;

  // Overtime occurs when check-out is after shift end (+15 min tolerance)
  // OR when net worked time exceeds target work minutes (+15 min tolerance)
  if (outM > shiftEndM + 15 || netWorkedMinutes > targetWorkMinutes + 15) {
    const otByClock = Math.max(0, outM - shiftEndM);
    const otByDuration = Math.max(0, netWorkedMinutes - targetWorkMinutes);
    overtimeMinutes = Math.max(otByClock, otByDuration);
    if (overtimeMinutes >= 15) {
      isOvertime = true;
    } else {
      overtimeMinutes = 0;
    }
  }

  return {
    rawMinutes,
    breakDeductedMinutes,
    netWorkedMinutes,
    netWorkedHours,
    overtimeMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    isOvertime,
    isLate,
  };
}
