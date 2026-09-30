/**
 * 🏢 Ashley Attendance & Shift Rule Helper
 * Standardized rules for 31-day Matrix Table, Employee Dossier & Master Directory.
 *
 * Rules:
 * 1. Official Shift Start: 08:00 (Grace period until 08:15).
 *    - In <= 08:15: On-Time -> BLACK (text-slate-900 / #0f172a)
 *    - In > 08:15 with waiver/excuse: Waived -> GREEN (text-emerald-600 / #059669)
 *    - In > 08:15 without waiver: Unexcused -> RED (text-rose-600 / #dc2626)
 *
 * 2. Official Shift End: 17:00.
 *    - Out >= 17:00 (or normal ~17:00): On-Time -> BLACK (text-slate-700 / #0f172a)
 *    - Out < 17:00 (Early Out) with waiver: Waived -> GREEN (text-emerald-600 / #059669)
 *    - Out < 17:00 (Early Out) without waiver: Unexcused -> RED (text-rose-600 / #dc2626)
 *    - Out > 17:00 (Overtime / Delay) with waiver/approval: Approved -> GREEN (text-emerald-600 / #059669)
 *
 * 3. Admin Override has ABSOLUTE priority over raw GPS or automated device logs.
 */

export const SHIFT_RULES = {
  START_TIME: '08:00',
  GRACE_TIME: '08:15',
  END_TIME: '17:00',
  EARLY_THRESHOLD: '16:55',
  EVENING_START_TIME: '15:00',
  EVENING_GRACE_TIME: '15:15',
  EVENING_END_TIME: '23:00',
  EVENING_EARLY_THRESHOLD: '22:55',
} as const;

export interface ShiftRuleConfig {
  shiftType: 'morning' | 'evening' | 'custom';
  shiftLabel: string;
  startTime: string;
  graceTime: string;
  endTime: string;
  earlyThreshold: string;
  overtimeThreshold: string;
  hasLunchBreak: boolean;
  worksOnFriday: boolean;
}

function addMinutesToTimeStr(hm: string, deltaMinutes: number): string {
  const parts = (hm || '08:00').slice(0, 5).split(':').map(Number);
  const h = isNaN(parts[0]) ? 8 : parts[0];
  const m = isNaN(parts[1]) ? 0 : parts[1];
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  const outH = Math.floor(total / 60);
  const outM = total % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
}

export function getSavedEmployeeShiftOverride(empId?: string | null): {
  shiftType?: 'auto' | 'morning' | 'evening' | 'custom';
  customShiftStart?: string;
  customShiftEnd?: string;
  worksOnFriday?: boolean;
} | null {
  if (!empId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ashley_employee_shifts_map');
    if (!raw) return null;
    const map = JSON.parse(raw);
    const cleanId = String(empId).trim();
    const rawNum = cleanId.replace(/^emp-0*/i, '') || cleanId.replace('emp-', '');
    return map[cleanId] || map[`emp-${rawNum}`] || map[`emp-0${rawNum}`] || null;
  } catch {
    return null;
  }
}

/**
 * 🧠 Smart Shift Detection Engine:
 * - If employee is on 'auto' (default):
 *   - Check-in before 12:30 -> Morning Shift (08:00 - 17:00, Grace 08:15)
 *   - Check-in at or after 12:30 -> Evening Shift (15:00 - 23:00, Grace 15:15)
 * - Also supports fixed 'morning' (8-5), 'evening' (3-11), or 'custom' shifts per employee.
 */
export function resolveShiftRulesForDay(
  inTime?: string | null,
  emp?: { id?: string; shiftType?: string | null; customShiftStart?: string | null; customShiftEnd?: string | null; worksOnFriday?: boolean | null; [key: string]: any } | null
): ShiftRuleConfig {
  const localCfg = getSavedEmployeeShiftOverride(emp?.id);
  const configuredMode = (localCfg?.shiftType || emp?.shiftType || 'auto') as 'auto' | 'morning' | 'evening' | 'custom';
  const worksOnFriday = Boolean(localCfg?.worksOnFriday ?? emp?.worksOnFriday ?? false);

  if (configuredMode === 'custom') {
    const startTime = (localCfg?.customShiftStart || emp?.customShiftStart || '08:00').slice(0, 5);
    const endTime = (localCfg?.customShiftEnd || emp?.customShiftEnd || '17:00').slice(0, 5);
    return {
      shiftType: 'custom',
      shiftLabel: `تایبەت (${startTime}-${endTime})`,
      startTime,
      graceTime: addMinutesToTimeStr(startTime, 15),
      endTime,
      earlyThreshold: addMinutesToTimeStr(endTime, -5),
      overtimeThreshold: addMinutesToTimeStr(endTime, 15),
      hasLunchBreak: false,
      worksOnFriday,
    };
  }

  const cleanIn = (inTime || '').slice(0, 5);
  const isEveningByClock = cleanIn.includes(':') && cleanIn >= '12:30';

  if (configuredMode === 'evening' || (configuredMode === 'auto' && isEveningByClock)) {
    return {
      shiftType: 'evening',
      shiftLabel: 'ئێواران (3-11)',
      startTime: '15:00',
      graceTime: '15:15',
      endTime: '23:00',
      earlyThreshold: '22:55',
      overtimeThreshold: '23:15',
      hasLunchBreak: false,
      worksOnFriday,
    };
  }

  return {
    shiftType: 'morning',
    shiftLabel: 'بەیانیان (8-5)',
    startTime: '08:00',
    graceTime: '08:15',
    endTime: '17:00',
    earlyThreshold: '16:55',
    overtimeThreshold: '17:15',
    hasLunchBreak: true,
    worksOnFriday,
  };
}

export function translateRoleToKurdish(role?: string | null): string {
  if (!role) return 'کارمەند';
  const r = role.trim();
  const low = r.toLowerCase();
  if (low === 'manager' || low === 'general manager' || low === 'admin') return 'بەڕێوەبەر';
  if (low === 'employee supervisor' || low === 'supervisor') return 'سەرپەرشتیار';
  if (low === 'transport supervisor') return 'سەرپەرشتیاری گواستنەوە';
  if (low === 'accountant') return 'ژمێریار';
  if (low === 'warehouse' || low === 'warehouse supervisor') return 'سەرپەرشتیاری کۆگا';
  if (low === 'employee' || low === 'staff' || low === 'worker') return 'کارمەند';
  return r
    .replace(/Employee Supervisor/gi, 'سەرپەرشتیاری کارمەندان')
    .replace(/Transport Supervisor/gi, 'سەرپەرشتیاری گواستنەوە')
    .replace(/General Manager/gi, 'بەڕێوەبەری گشتی')
    .replace(/Manager/gi, 'بەڕێوەبەر')
    .replace(/Supervisor/gi, 'سەرپەرشتیار')
    .replace(/Employee/gi, 'کارمەند')
    .replace(/Staff/gi, 'کارمەند');
}

export interface CheckInStatusResult {
  isLate: boolean;
  isWaived: boolean;
  status: 'on_time' | 'late_waived' | 'late_unexcused';
  colorCls: string;
  printColor: string;
  label: string;
}

export interface CheckOutStatusResult {
  isEarly: boolean;
  isOvertime: boolean;
  isWaived: boolean;
  status: 'ongoing' | 'on_time' | 'early_waived' | 'early_unexcused' | 'overtime_approved' | 'overtime_unexcused';
  colorCls: string;
  printColor: string;
  label: string;
}

export function getCheckInStatus(
  inTime: string | null | undefined,
  isWaived: boolean = false,
  isPenalized: boolean = false,
  graceTime?: string
): CheckInStatusResult {
  const time = (inTime || '').slice(0, 5);
  if (!time || !time.includes(':')) {
    return {
      isLate: false,
      isWaived: false,
      status: 'on_time',
      colorCls: 'text-slate-900 dark:text-slate-100 font-extrabold',
      printColor: '#0f172a',
      label: 'ئاسایی'
    };
  }

  // Auto-detect grace time if not explicitly passed: >= 12:30 is Evening Shift (15:15), otherwise Morning Shift (08:15)
  const effectiveGrace = graceTime || (time >= '12:30' ? SHIFT_RULES.EVENING_GRACE_TIME : SHIFT_RULES.GRACE_TIME);
  const isLate = time > effectiveGrace;

  if (!isLate) {
    return {
      isLate: false,
      isWaived: false,
      status: 'on_time',
      colorCls: 'text-slate-900 dark:text-slate-100 font-extrabold',
      printColor: '#0f172a',
      label: 'لە کاتی خۆی'
    };
  }

  // It's late. Check if forgiven/excused by admin
  const excused = isWaived && !isPenalized;
  if (excused) {
    return {
      isLate: true,
      isWaived: true,
      status: 'late_waived',
      colorCls: 'text-purple-600 dark:text-purple-400 font-black',
      printColor: '#9333ea',
      label: 'لێخۆشبوو'
    };
  }

  return {
    isLate: true,
    isWaived: false,
    status: 'late_unexcused',
    colorCls: 'text-rose-600 dark:text-rose-400 font-extrabold',
    printColor: '#dc2626',
    label: 'درەنگکەوتوو'
  };
}

export function getCheckOutStatus(
  outTime: string | null | undefined,
  isWaived: boolean = false,
  isPenalized: boolean = false,
  isToday: boolean = false,
  earlyThreshold?: string,
  overtimeThreshold?: string,
  endTime?: string
): CheckOutStatusResult {
  const time = (outTime || '').slice(0, 5);
  const targetEnd = endTime || SHIFT_RULES.END_TIME;
  const targetEarly = earlyThreshold || SHIFT_RULES.EARLY_THRESHOLD;
  const targetOvertime = overtimeThreshold || '17:15';

  if (!time || time === 'بەردەوام' || (isToday && (!time || time === targetEnd))) {
    return {
      isEarly: false,
      isOvertime: false,
      isWaived: false,
      status: 'ongoing',
      colorCls: 'text-slate-500 dark:text-slate-400 font-semibold',
      printColor: '#64748b',
      label: 'بەردەوام'
    };
  }

  const isEarly = time < targetEarly;
  const isOvertime = time > targetOvertime;

  if (isEarly) {
    const excused = isWaived && !isPenalized;
    if (excused) {
      return {
        isEarly: true,
        isOvertime: false,
        isWaived: true,
        status: 'early_waived',
        colorCls: 'text-purple-600 dark:text-purple-400 font-black',
        printColor: '#9333ea',
        label: 'لێخۆشبوو (زوو چوونەوە)'
      };
    }
    return {
      isEarly: true,
      isOvertime: false,
      isWaived: false,
      status: 'early_unexcused',
      colorCls: 'text-rose-600 dark:text-rose-400 font-extrabold',
      printColor: '#dc2626',
      label: 'زوو ڕۆیشتوو'
    };
  }

  if (isOvertime) {
    if (isPenalized) {
      return {
        isEarly: false,
        isOvertime: true,
        isWaived: false,
        status: 'overtime_unexcused',
        colorCls: 'text-rose-600 dark:text-rose-400 font-extrabold',
        printColor: '#dc2626',
        label: 'مانەوەی بێ مۆڵەت'
      };
    }
    // Overtime / late departure with approval or waiver
    return {
      isEarly: false,
      isOvertime: true,
      isWaived: Boolean(isWaived),
      status: 'overtime_approved',
      colorCls: isWaived ? 'text-purple-600 dark:text-purple-400 font-black' : 'text-slate-700 dark:text-slate-300 font-semibold',
      printColor: isWaived ? '#9333ea' : '#334155',
      label: isWaived ? 'ئیزافەی پەسەندکراو' : 'درەنگ چوونەوە'
    };
  }

  // Normal on-time departure
  return {
    isEarly: false,
    isOvertime: false,
    isWaived: false,
    status: 'on_time',
    colorCls: 'text-slate-700 dark:text-slate-300 font-semibold',
    printColor: '#0f172a',
    label: 'لە کاتی خۆی'
  };
}

export interface UnifiedAttendanceDayInfo {
  hasRecord: boolean;
  isFriday: boolean;
  isFuture: boolean;
  isToday: boolean;
  status: 'Present' | 'Leave' | 'Absent' | 'Holiday' | 'Empty' | 'Loading' | 'مۆڵەت' | 'غیاب' | 'پشوو';
  checkInTime: string;
  checkOutTime: string;
  rawCheckIn: string;
  rawCheckOut: string;
  checkInNote: string;
  checkOutNote: string;
  note: string;
  adminNote: string;
  adminCheckInNote: string;
  adminCheckOutNote: string;
  adminDecision: 'waived' | 'penalized' | null;
  adminCheckInDecision?: 'waived' | 'penalized' | null;
  adminCheckOutDecision?: 'waived' | 'penalized' | null;
  isWaived: boolean;
  isCheckInWaived?: boolean;
  isCheckOutWaived?: boolean;
  workedHours: number;
  warehouseName: string;
  historyLogs: any[];
  hasAdminOverride: boolean;
  checkInStatus: CheckInStatusResult;
  checkOutStatus: CheckOutStatusResult;
  shiftType?: 'morning' | 'evening' | 'custom';
  shiftLabel?: string;
}

/**
 * Resolves attendance record with absolute priority for Admin Overrides
 * and guarantees LATEST live data (کۆتا داتا) is displayed.
 */
export function resolveEmployeeDayAttendance(
  emp: { id: string; name?: string | null; fullName3Part?: string | null; employeeId?: string | null; [key: string]: any },
  dayItem: { dayNum: number; dateStr: string; isFriday: boolean; isFuture: boolean; isToday: boolean },
  overridesMap: Record<string, any> = {},
  attendanceLogs: any[] = [],
  isWaitingData: boolean = false
): UnifiedAttendanceDayInfo {
  const { dateStr, isFriday, isFuture, isToday } = dayItem;
  const empId = (emp.id || '').toString().trim().toLowerCase();
  const empNumRaw = empId.replace(/^emp-0*/i, '') || empId.replace('emp-', '');
  const empNumPadded = empNumRaw.length === 1 ? `0${empNumRaw}` : empNumRaw;
  const empAlt = (emp.employeeId || '').toString().trim().toLowerCase();
  const empName = (emp.name || emp.fullName3Part || '').trim().toLowerCase();

  // Find all actual logs from attendanceLogs for this employee on this date
  const dayRecords = (attendanceLogs || []).filter(log => {
    const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || log.created_at?.split('T')[0] || '');
    if (logDate !== dateStr) return false;

    const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
    const logName = (log.name || log.userName || log.employeeName || '').trim().toLowerCase();

    return (
      logEmpId === empId || 
      logEmpId === empNumRaw || 
      logEmpId === empNumPadded ||
      logEmpId === `emp-${empNumRaw}` ||
      logEmpId === `emp-${empNumPadded}` ||
      (empAlt && logEmpId === empAlt) ||
      (logName && (logName === empName || logName.includes(empName) || empName.includes(logName)))
    );
  });

  // Sort dayRecords chronologically so latest log wins (کۆتا داتا)
  const sortedDayRecords = [...dayRecords].sort((a, b) => {
    const timeA = a.created_at || a.createdAt || a.timestamp || a.time || '';
    const timeB = b.created_at || b.createdAt || b.timestamp || b.time || '';
    return timeA.localeCompare(timeB);
  });

  // Pre-calculate live times and notes from actual attendance logs for this employee & day
  let liveCheckIn = '';
  let liveCheckOut = '';
  let liveCheckInNote = '';
  let liveCheckOutNote = '';
  let liveNote = '';

  for (const r of (sortedDayRecords as any[])) {
    const isEnterLog = r.log_type === 'Check In' || r.action === 'Check In' || r.type?.includes('In') || r.type?.includes('هاتن');
    const isExitLog = r.log_type === 'Check Out' || r.action === 'Check Out' || r.type?.includes('Out') || r.type?.includes('دەرچوون') || r.type?.includes('ڕۆیشتن');

    const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '') || (isEnterLog ? (r.log_time_str || (r.time && r.time.includes(' ') ? r.time.split(' ')[1]?.slice(0, 5) : r.time?.slice(0, 5)) || '') : '');
    const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '') || (isExitLog ? (r.log_time_str || (r.time && r.time.includes(' ') ? r.time.split(' ')[1]?.slice(0, 5) : r.time?.slice(0, 5)) || '') : '');

    if (inCandidate && inCandidate.includes(':')) liveCheckIn = inCandidate.slice(0, 5);
    if (outCandidate && outCandidate.includes(':')) liveCheckOut = outCandidate.slice(0, 5);

    const inN = r.check_in_note || r.checkInNote || r.checkin_note || r.check_in_edit_note;
    const outN = r.check_out_note || r.checkOutNote || r.checkout_note || r.check_out_edit_note;
    const rawN = r.note || r.notes || r.reason || r.employeeNote || r.employee_note || r.edit_note || r.editNote || '';

    let cleanN = typeof rawN === 'string' ? rawN.replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim() : '';
    if (cleanN.includes('): ')) {
      cleanN = cleanN.split('): ')[1]?.trim() || cleanN;
    } else if (cleanN.startsWith('لەڕێگەی مۆبایل') || cleanN === 'مۆبایل') {
      cleanN = '';
    }

    if (inN) liveCheckInNote = String(inN).replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim();
    else if (isEnterLog && cleanN) liveCheckInNote = cleanN;

    if (outN) liveCheckOutNote = String(outN).replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim();
    else if (isExitLog && cleanN) liveCheckOutNote = cleanN;

    if (cleanN) liveNote = cleanN;
  }
  if (!liveCheckInNote && liveNote) liveCheckInNote = liveNote;

  const stripNoteEmojis = (val?: any): string => {
    if (typeof val !== 'string') return '';
    const cleaned = val.replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim();
    if (
      cleaned === 'پەسەندکراو لەلایەن ئەدمین' ||
      cleaned === 'غیاب لەلایەن ئەدمین' ||
      cleaned === 'پشوو لەلایەن ئەدمین' ||
      cleaned === 'مۆڵەت لەلایەن ئەدمین'
    ) {
      return '';
    }
    return cleaned;
  };

  // 1. CHECK ADMIN MANUAL OVERRIDE
  let override = 
    overridesMap[`${emp.id}_${dateStr}`] || 
    overridesMap[`${empId}_${dateStr}`] || 
    overridesMap[`${empNumRaw}_${dateStr}`] || 
    overridesMap[`${empNumPadded}_${dateStr}`] || 
    overridesMap[`emp-${empNumRaw}_${dateStr}`] ||
    overridesMap[`emp-${empNumPadded}_${dateStr}`] ||
    (empAlt ? overridesMap[`${empAlt}_${dateStr}`] : null) ||
    (empName ? overridesMap[`${empName}_${dateStr}`] : null);

  if (!override && overridesMap && typeof overridesMap === 'object') {
    const suffix = `_${dateStr}`;
    for (const [k, v] of Object.entries<any>(overridesMap)) {
      if (!v || typeof v !== 'object') continue;
      if (k.endsWith(suffix) || v.date === dateStr) {
        const vId = (v.userId || '').toString().trim().toLowerCase();
        const vRaw = vId.replace(/^emp-0*/i, '') || vId.replace('emp-', '');
        const vName = (v.userName || '').toString().trim().toLowerCase();
        if (
          (vId && (vId === empId || vRaw === empNumRaw || vId === `emp-${empNumPadded}`)) ||
          (empName && vName && (vName === empName || vName.includes(empName) || empName.includes(vName)))
        ) {
          override = v;
          break;
        }
      }
    }
  }

  if (override) {
    const isOverrideEmpty = 
      override.status === 'empty' || 
      override.status === 'Empty' || 
      override.status === 'delete' || 
      override.status === 'deleted' ||
      override.action === 'delete';
    
    const overrideTs = override.deletedAt || override.updatedAt || override.timestamp;
    const oTime = overrideTs ? new Date(overrideTs).getTime() : NaN;

    // Latest Data Wins (کۆتا داتا = دروستترین داتا):
    // If an employee recorded a live punch strictly AFTER the admin deleted or edited the record,
    // the newer live punch takes precedence.
    const hasSubsequentLiveCheckIn = sortedDayRecords.some(r => {
      if (String(r.id || '').startsWith('manual-')) return false;
      const inTime = r.checkInTime || r.check_in_time || r.checkIn || ((r.type === 'هاتن' || r.action === 'Check In' || r.log_type === 'Check In') ? (r.log_time_str || r.time) : '');
      if (!inTime || !String(inTime).includes(':')) return false;
      if (r.isLiveMobilePunch) return true;
      const logTs = r.updatedAt || r.created_at || r.createdAt || r.timestamp;
      if (logTs && !isNaN(oTime)) {
        const rTime = new Date(logTs).getTime();
        if (!isNaN(rTime)) {
          return rTime > oTime + 1000;
        }
      }
      return false;
    });

    const hasSubsequentLiveCheckOut = sortedDayRecords.some(r => {
      if (String(r.id || '').startsWith('manual-')) return false;
      const outTime = r.checkOutTime || r.check_out_time || r.checkOut || ((r.type === 'دەرچوون' || r.action === 'Check Out' || r.log_type === 'Check Out') ? (r.log_time_str || r.time) : '');
      if (!outTime || !String(outTime).includes(':')) return false;
      if (r.isLiveMobilePunch) return true;
      const logTs = r.updatedAt || r.created_at || r.createdAt || r.timestamp;
      if (logTs && !isNaN(oTime)) {
        const rTime = new Date(logTs).getTime();
        if (!isNaN(rTime)) {
          return rTime > oTime + 1000;
        }
      }
      return false;
    });

    if (isOverrideEmpty && !hasSubsequentLiveCheckIn) {
      return {
        hasRecord: false,
        isFriday,
        isFuture,
        isToday,
        status: 'Empty',
        checkInTime: '',
        checkOutTime: '',
        rawCheckIn: '',
        rawCheckOut: '',
        checkInNote: '',
        checkOutNote: '',
        note: '',
        adminNote: '',
        adminCheckInNote: '',
        adminCheckOutNote: '',
        adminDecision: null,
        adminCheckInDecision: null,
        adminCheckOutDecision: null,
        isWaived: false,
        isCheckInWaived: false,
        isCheckOutWaived: false,
        workedHours: 0,
        warehouseName: '',
        historyLogs: [],
        hasAdminOverride: true,
        checkInStatus: getCheckInStatus('', false),
        checkOutStatus: getCheckOutStatus('', false, false, isToday)
      };
    }

    if (!isOverrideEmpty) {
      const rawOvStatus = String(override.status || override.log_type || override.action || 'Present');
      const ovNoteText = `${override.adminNote || ''} ${override.note || ''} ${liveNote || ''}`;
      const hasOvClockTime = Boolean(override.checkInTime && String(override.checkInTime).includes(':'));
      const normalizedOvStatus: UnifiedAttendanceDayInfo['status'] =
        (rawOvStatus === 'Absent' || rawOvStatus === 'غیاب' || (!hasOvClockTime && (ovNoteText.includes('🛡️ غیاب') || ovNoteText.includes('غیاب لەلایەن ئەدمین'))))
          ? 'Absent'
          : (rawOvStatus === 'Holiday' || rawOvStatus === 'پشوو' || (!hasOvClockTime && (ovNoteText.includes('🛡️ پشوو') || ovNoteText.includes('پشوو لەلایەن ئەدمین'))))
          ? 'Holiday'
          : (rawOvStatus === 'Leave' || rawOvStatus === 'مۆڵەت' || (!hasOvClockTime && (ovNoteText.includes('🛡️ مۆڵەت') || ovNoteText.includes('مۆڵەت لەلایەن ئەدمین'))))
          ? 'Leave'
          : 'Present';

      const isNonWorkingOverride =
        normalizedOvStatus === 'Absent' ||
        normalizedOvStatus === 'Holiday' ||
        normalizedOvStatus === 'Leave';

      const effectiveStatus: UnifiedAttendanceDayInfo['status'] =
        (isNonWorkingOverride && hasSubsequentLiveCheckIn) ? 'Present' : normalizedOvStatus;

      const ovInClean = (override.checkInTime && String(override.checkInTime).includes(':')) ? String(override.checkInTime) : '';
      const ovOutClean = (override.checkOutTime && String(override.checkOutTime).includes(':')) ? String(override.checkOutTime) : '';

      const cIn = effectiveStatus === 'Present'
        ? ((hasSubsequentLiveCheckIn && liveCheckIn) ? liveCheckIn : (ovInClean || liveCheckIn || '')).slice(0, 5)
        : '';
      const cOut = effectiveStatus === 'Present'
        ? ((hasSubsequentLiveCheckOut && liveCheckOut) ? liveCheckOut : (ovOutClean || liveCheckOut || '')).slice(0, 5)
        : '';

      const shiftRules = resolveShiftRulesForDay(cIn, emp);

      const adminDecision = effectiveStatus === 'Present'
        ? ((override.adminDecision as 'waived' | 'penalized') || (override.isWaived ? 'waived' : null))
        : null;
      const isPenalized = effectiveStatus === 'Present' && (
        adminDecision === 'penalized' ||
        override.adminCheckInDecision === 'penalized' ||
        override.adminCheckOutDecision === 'penalized'
      );

      // Decouple Check-In waiver from Check-Out waiver (only for Present status)
      const isCheckInWaived = effectiveStatus === 'Present' && Boolean(
        override.checkInWaived ?? 
        override.isCheckInWaived ?? 
        (override.adminCheckInDecision === 'waived' ? true : undefined) ?? 
        (adminDecision === 'waived' ? true : undefined) ?? 
        override.isWaived
      );
      const isCheckOutWaived = effectiveStatus === 'Present' && Boolean(
        override.checkOutWaived ?? 
        override.isCheckOutWaived ?? 
        (override.adminCheckOutDecision === 'waived' ? true : undefined) ?? 
        ((adminDecision === 'waived' && cOut && cOut < shiftRules.earlyThreshold) ? true : undefined) ?? 
        ((override.isWaived && cOut && cOut < shiftRules.earlyThreshold) ? true : undefined)
      );
      const isWaived = isCheckInWaived || isCheckOutWaived;

      let workedHours = 0;
      if (effectiveStatus === 'Present') {
        if (cIn && cOut && cIn.includes(':') && cOut.includes(':') && cOut !== 'بەردەوام') {
          const [inH, inM] = cIn.split(':').map(Number);
          const [outH, outM] = cOut.split(':').map(Number);
          const inTotal = inH * 60 + (inM || 0);
          let outTotal = outH * 60 + (outM || 0);
          if (outTotal < inTotal) outTotal += 1440;
          if (outTotal > inTotal) {
            const gross = outTotal - inTotal;
            let overlap = 0;
            if (shiftRules.hasLunchBreak) {
              const breakStart = 12 * 60;
              const breakEnd = 13 * 60;
              overlap = Math.max(0, Math.min(outTotal, breakEnd) - Math.max(inTotal, breakStart));
            }
            workedHours = parseFloat((Math.max(0, gross - overlap) / 60).toFixed(1));
          }
        } else if (cIn && (!cOut || cOut === 'بەردەوام') && isToday) {
          workedHours = 0;
        } else if (cIn && !cOut && !isToday) {
          workedHours = 8;
        }
      }

      const checkInStatus = getCheckInStatus(cIn, isCheckInWaived, isPenalized, shiftRules.graceTime);
      const checkOutStatus = getCheckOutStatus(cOut, isCheckOutWaived, isPenalized, isToday, shiftRules.earlyThreshold, shiftRules.overtimeThreshold, shiftRules.endTime);

      return {
        hasRecord: true,
        isFriday,
        isFuture,
        isToday,
        status: effectiveStatus,
        checkInTime: cIn,
        checkOutTime: cOut,
        rawCheckIn: effectiveStatus === 'Present' ? ((override.rawCheckIn && String(override.rawCheckIn).includes(':')) ? override.rawCheckIn : cIn) : '',
        rawCheckOut: effectiveStatus === 'Present' ? ((override.rawCheckOut && String(override.rawCheckOut).includes(':')) ? override.rawCheckOut : cOut) : '',
        checkInNote: stripNoteEmojis(override.checkInNote || override.note || liveCheckInNote || ''),
        checkOutNote: stripNoteEmojis(override.checkOutNote || liveCheckOutNote || ''),
        note: stripNoteEmojis(override.note || override.checkInNote || liveNote || ''),
        adminNote: stripNoteEmojis(override.adminNote || ''),
        adminCheckInNote: stripNoteEmojis(override.adminCheckInNote || override.adminNote || ''),
        adminCheckOutNote: stripNoteEmojis(override.adminCheckOutNote || ''),
        adminDecision,
        adminCheckInDecision: effectiveStatus === 'Present' ? (override.adminCheckInDecision || (isCheckInWaived ? 'waived' : null)) : null,
        adminCheckOutDecision: effectiveStatus === 'Present' ? (override.adminCheckOutDecision || (isCheckOutWaived ? 'waived' : null)) : null,
        isWaived,
        isCheckInWaived,
        isCheckOutWaived,
        workedHours,
        warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
        historyLogs: override.historyLogs || [],
        hasAdminOverride: true,
        checkInStatus,
        checkOutStatus,
        shiftType: shiftRules.shiftType,
        shiftLabel: shiftRules.shiftLabel,
      };
    }
  }

  const baseShiftRules = resolveShiftRulesForDay('', emp);

  // 2. Friday Holiday (unless employee works on Fridays)
  if (isFriday && !baseShiftRules.worksOnFriday && sortedDayRecords.length === 0) {
    return {
      hasRecord: false,
      isFriday: true,
      isFuture,
      isToday,
      status: 'Holiday',
      checkInTime: '',
      checkOutTime: '',
      rawCheckIn: '',
      rawCheckOut: '',
      checkInNote: '',
      checkOutNote: '',
      note: '',
      adminNote: '',
      adminCheckInNote: '',
      adminCheckOutNote: '',
      adminDecision: null,
      isWaived: false,
      workedHours: 0,
      warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
      historyLogs: [],
      hasAdminOverride: false,
      checkInStatus: getCheckInStatus('', false),
      checkOutStatus: getCheckOutStatus('', false, false, false),
      shiftType: baseShiftRules.shiftType,
      shiftLabel: baseShiftRules.shiftLabel,
    };
  }

  // 3. Future Days (when no record exists)
  if (isFuture && sortedDayRecords.length === 0) {
    return {
      hasRecord: false,
      isFriday: false,
      isFuture: true,
      isToday: false,
      status: 'Empty',
      checkInTime: '',
      checkOutTime: '',
      rawCheckIn: '',
      rawCheckOut: '',
      checkInNote: '',
      checkOutNote: '',
      note: '',
      adminNote: '',
      adminCheckInNote: '',
      adminCheckOutNote: '',
      adminDecision: null,
      isWaived: false,
      workedHours: 0,
      warehouseName: '',
      historyLogs: [],
      hasAdminOverride: false,
      checkInStatus: getCheckInStatus('', false),
      checkOutStatus: getCheckOutStatus('', false, false, false),
      shiftType: baseShiftRules.shiftType,
      shiftLabel: baseShiftRules.shiftLabel,
    };
  }

  // 4. Past or Today (or Future with logs): Search actual GPS logs from server (sorted chronologically so latest wins - کۆتا داتا)
  let checkInTime = '';
  let checkOutTime = '';
  let rawCheckIn = '';
  let rawCheckOut = '';
  let checkInNote = liveCheckInNote;
  let checkOutNote = liveCheckOutNote;
  let note = liveNote;
  let adminNote = '';
  let adminCheckInNote = '';
  let adminCheckOutNote = '';
  let adminDecision: 'waived' | 'penalized' | null = null;
  let adminCheckInDecision: 'waived' | 'penalized' | null = null;
  let adminCheckOutDecision: 'waived' | 'penalized' | null = null;
  let isWaived = false;
  let isCheckInWaived = false;
  let isCheckOutWaived = false;
  let warehouseName = 'کۆمپانیای سەرەکی ئاشڵی';
  let historyLogs: any[] = [];
  let explicitNonWorkingStatus: 'Absent' | 'Holiday' | 'Leave' | null = null;

  for (const r of (sortedDayRecords as any[])) {
    const rStatus = String(r.status || '');
    const rLogType = String(r.log_type || r.action || r.type || '');
    const rTimeStr = String(r.log_time_str || r.checkInTime || r.time || '').trim();
    const rNoteStr = `${r.adminNote || ''} ${r.admin_note || ''} ${r.editNote || ''} ${r.edit_note || ''} ${r.note || ''} ${r.notes || ''}`;
    const hasValidClockTime = Boolean(
      (r.checkInTime && String(r.checkInTime).includes(':')) ||
      (r.check_in_time && String(r.check_in_time).includes(':')) ||
      (r.log_time_str && String(r.log_time_str).includes(':'))
    );
    if (
      rStatus === 'Absent' || rStatus === 'غیاب' ||
      rLogType === 'Absent' || rLogType === 'غیاب' ||
      rTimeStr === 'غیاب' || rTimeStr === 'Absent' || rTimeStr.endsWith(' غیاب') ||
      (!hasValidClockTime && (rNoteStr.includes('🛡️ غیاب') || rNoteStr.includes('غیاب لەلایەن ئەدمین')))
    ) {
      explicitNonWorkingStatus = 'Absent';
      checkInTime = '';
      checkOutTime = '';
    } else if (
      rStatus === 'Holiday' || rStatus === 'پشوو' ||
      rLogType === 'Holiday' || rLogType === 'پشوو' ||
      rTimeStr === 'پشوو' || rTimeStr === 'Holiday' || rTimeStr.endsWith(' پشوو') ||
      (!hasValidClockTime && (rNoteStr.includes('🛡️ پشوو') || rNoteStr.includes('پشوو لەلایەن ئەدمین')))
    ) {
      explicitNonWorkingStatus = 'Holiday';
      checkInTime = '';
      checkOutTime = '';
    } else if (
      rStatus === 'Leave' || rStatus === 'مۆڵەت' ||
      rLogType === 'Leave' || rLogType === 'مۆڵەت' ||
      rTimeStr === 'مۆڵەت' || rTimeStr === 'Leave' || rTimeStr.endsWith(' مۆڵەت') ||
      (!hasValidClockTime && (rNoteStr.includes('🛡️ مۆڵەت') || rNoteStr.includes('مۆڵەت لەلایەن ئەدمین')))
    ) {
      explicitNonWorkingStatus = 'Leave';
      checkInTime = '';
      checkOutTime = '';
    } else {
      const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '');
      const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '');

      // Latest candidates win (کۆتا داتا)
      if (inCandidate && String(inCandidate).includes(':')) {
        checkInTime = String(inCandidate).slice(0, 5);
        explicitNonWorkingStatus = null;
      }
      if (outCandidate && String(outCandidate).includes(':')) {
        checkOutTime = String(outCandidate).slice(0, 5);
      }
      if ((r.rawCheckInTime || r.raw_check_in_time) && String(r.rawCheckInTime || r.raw_check_in_time).includes(':')) {
        rawCheckIn = String(r.rawCheckInTime || r.raw_check_in_time).slice(0, 5);
      }
      if ((r.rawCheckOutTime || r.raw_check_out_time) && String(r.rawCheckOutTime || r.raw_check_out_time).includes(':')) {
        rawCheckOut = String(r.rawCheckOutTime || r.raw_check_out_time).slice(0, 5);
      }
    }
    
    const inN = r.check_in_note || r.checkInNote || r.checkin_note;
    const outN = r.check_out_note || r.checkOutNote || r.checkout_note;
    const genN = r.note || r.notes || r.reason || r.employeeNote || r.employee_note;
    
    if (inN) checkInNote = stripNoteEmojis(inN);
    if (outN) checkOutNote = stripNoteEmojis(outN);
    if (genN) note = stripNoteEmojis(genN);

    const admInN = r.adminCheckInNote || r.admin_check_in_note;
    const admOutN = r.adminCheckOutNote || r.admin_check_out_note;
    const admN = r.adminNote || r.admin_note || r.editNote || r.edit_note;

    if (admInN) adminCheckInNote = stripNoteEmojis(admInN);
    if (admOutN) adminCheckOutNote = stripNoteEmojis(admOutN);
    if (admN) adminNote = stripNoteEmojis(admN);

    if (r.adminCheckInDecision) adminCheckInDecision = r.adminCheckInDecision as 'waived' | 'penalized';
    if (r.adminCheckOutDecision) adminCheckOutDecision = r.adminCheckOutDecision as 'waived' | 'penalized';
    if (r.adminDecision) adminDecision = r.adminDecision as 'waived' | 'penalized';
    if (r.checkInWaived !== undefined) isCheckInWaived = Boolean(r.checkInWaived);
    if (r.checkOutWaived !== undefined) isCheckOutWaived = Boolean(r.checkOutWaived);
    if (r.isWaived !== undefined) isWaived = Boolean(r.isWaived);

    if (r.historyLogs && Array.isArray(r.historyLogs) && r.historyLogs.length > 0) {
      historyLogs = r.historyLogs;
    }
    
    if (r.warehouseName || r.warehouse_name) warehouseName = r.warehouseName || r.warehouse_name;
  }

  if (!checkInNote && note) checkInNote = note;
  if (!rawCheckIn && checkInTime) rawCheckIn = checkInTime;
  if (!rawCheckOut && checkOutTime) rawCheckOut = checkOutTime;

  const shiftRules = resolveShiftRulesForDay(checkInTime, emp);
  const hasRecord = Boolean(checkInTime || checkOutTime || explicitNonWorkingStatus);
  const empStart = (emp.startDate || emp.employmentStartDate || '').slice(0, 10);
  const isBeforeHire = Boolean(empStart && empStart.length === 10 && dateStr < empStart);

  // Determine working status:
  // 🌙 Midnight 00:00 Rule:
  // - While isToday is true (before 12:00 midnight), an employee who hasn't checked in yet remains 'Empty' ('-')
  //   because they may be on the 3:00-11:00 evening shift.
  // - Once 12:00 midnight passes (!isToday && !isFuture), if there is no check-in/holiday/leave, it automatically becomes 'Absent' ('غیاب').
  let status: 'Present' | 'Leave' | 'Absent' | 'Holiday' | 'Empty' | 'Loading' | 'مۆڵەت' | 'غیاب' = 'Empty';
  if (isWaitingData) {
    status = 'Loading';
  } else if (explicitNonWorkingStatus) {
    status = explicitNonWorkingStatus;
  } else if (checkInTime || checkOutTime) {
    status = 'Present';
  } else if (isFriday && !shiftRules.worksOnFriday) {
    status = 'Holiday';
  } else if (isToday || isFuture || isBeforeHire) {
    status = 'Empty';
  } else {
    status = 'Absent';
  }

  let workedHours = 0;
  if (checkInTime && checkOutTime && checkInTime.includes(':') && checkOutTime.includes(':') && checkOutTime !== 'بەردەوام') {
    const [inH, inM] = checkInTime.split(':').map(Number);
    const [outH, outM] = checkOutTime.split(':').map(Number);
    const inTotal = inH * 60 + (inM || 0);
    let outTotal = outH * 60 + (outM || 0);
    if (outTotal < inTotal) outTotal += 1440;
    if (outTotal > inTotal) {
      const gross = outTotal - inTotal;
      let overlap = 0;
      if (shiftRules.hasLunchBreak) {
        const breakStart = 12 * 60;
        const breakEnd = 13 * 60;
        overlap = Math.max(0, Math.min(outTotal, breakEnd) - Math.max(inTotal, breakStart));
      }
      workedHours = parseFloat((Math.max(0, gross - overlap) / 60).toFixed(1));
    }
  } else if (hasRecord && isToday && (!checkOutTime || checkOutTime === 'بەردەوام')) {
    workedHours = 0;
  } else if (hasRecord && !isToday) {
    workedHours = 8;
  }

  const isPenalized = adminDecision === 'penalized' || adminCheckInDecision === 'penalized' || adminCheckOutDecision === 'penalized';
  const resolvedCheckInWaived = Boolean(isCheckInWaived || adminCheckInDecision === 'waived' || (adminDecision === 'waived' && checkInTime > shiftRules.graceTime) || (isWaived && checkInTime > shiftRules.graceTime));
  const resolvedCheckOutWaived = Boolean(isCheckOutWaived || adminCheckOutDecision === 'waived' || (adminDecision === 'waived' && checkOutTime && checkOutTime < shiftRules.earlyThreshold) || (isWaived && checkOutTime && checkOutTime < shiftRules.earlyThreshold));
  const resolvedWaived = resolvedCheckInWaived || resolvedCheckOutWaived || isWaived || adminDecision === 'waived';

  const checkInStatus = getCheckInStatus(checkInTime, resolvedCheckInWaived, isPenalized, shiftRules.graceTime);
  const checkOutStatus = getCheckOutStatus(checkOutTime, resolvedCheckOutWaived, isPenalized, isToday, shiftRules.earlyThreshold, shiftRules.overtimeThreshold, shiftRules.endTime);

  return {
    hasRecord,
    isFriday: false,
    isFuture: false,
    isToday,
    status,
    checkInTime,
    checkOutTime,
    rawCheckIn,
    rawCheckOut,
    checkInNote: stripNoteEmojis(checkInNote),
    checkOutNote: stripNoteEmojis(checkOutNote),
    note: stripNoteEmojis(note),
    adminNote: stripNoteEmojis(adminNote),
    adminCheckInNote: stripNoteEmojis(adminCheckInNote),
    adminCheckOutNote: stripNoteEmojis(adminCheckOutNote),
    historyLogs,
    adminDecision: adminDecision || (resolvedWaived ? 'waived' : null),
    adminCheckInDecision: adminCheckInDecision || (resolvedCheckInWaived ? 'waived' : null),
    adminCheckOutDecision: adminCheckOutDecision || (resolvedCheckOutWaived ? 'waived' : null),
    isWaived: resolvedWaived,
    isCheckInWaived: resolvedCheckInWaived,
    isCheckOutWaived: resolvedCheckOutWaived,
    warehouseName,
    workedHours,
    hasAdminOverride: false,
    checkInStatus,
    checkOutStatus,
    shiftType: shiftRules.shiftType,
    shiftLabel: shiftRules.shiftLabel,
  };
}
