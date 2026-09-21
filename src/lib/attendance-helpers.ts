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
} as const;

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
  isPenalized: boolean = false
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

  const isLate = time > SHIFT_RULES.GRACE_TIME;

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
  isToday: boolean = false
): CheckOutStatusResult {
  const time = (outTime || '').slice(0, 5);

  if (!time || time === 'بەردەوام' || (isToday && (!time || time === '17:00'))) {
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

  const isEarly = time < SHIFT_RULES.EARLY_THRESHOLD;
  const isOvertime = time > '17:15';

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
  status: 'Present' | 'Leave' | 'Absent' | 'Holiday' | 'Empty' | 'Loading' | 'مۆڵەت' | 'غیاب';
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
  const empNum = empId.replace('emp-', '');
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
      logEmpId === empNum || 
      logEmpId === `emp-${empNum}` ||
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

  // 1. 🛡️ CHECK ADMIN MANUAL OVERRIDE
  const override = 
    overridesMap[`${emp.id}_${dateStr}`] || 
    overridesMap[`${empNum}_${dateStr}`] || 
    overridesMap[`emp-${empNum}_${dateStr}`] ||
    (empAlt ? overridesMap[`${empAlt}_${dateStr}`] : null);

  if (override) {
    const isOverrideEmpty = override.status === 'empty' || override.status === 'Empty' || override.status === 'delete';
    
    // If override is marked empty/deleted, but employee checked in again on mobile/live logs, do NOT block the new live checkin!
    const hasSubsequentLiveCheckIn = sortedDayRecords.some(r => {
      const inTime = r.checkInTime || r.check_in_time || r.checkIn;
      if (!inTime) return false;
      if (override.deletedAt || override.timestamp) {
        const rTime = new Date(r.created_at || r.createdAt || r.time || 0).getTime();
        const oTime = new Date(override.deletedAt || override.timestamp || 0).getTime();
        return rTime > oTime;
      }
      return true;
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
      const cIn = (override.checkInTime || '').slice(0, 5);
      const cOut = (override.checkOutTime || '').slice(0, 5);
      const adminDecision = (override.adminDecision as 'waived' | 'penalized') || (override.isWaived ? 'waived' : null);
      const isPenalized = adminDecision === 'penalized' || override.adminCheckInDecision === 'penalized' || override.adminCheckOutDecision === 'penalized';

      // Decouple Check-In waiver from Check-Out waiver
      const isCheckInWaived = Boolean(
        override.checkInWaived ?? 
        override.isCheckInWaived ?? 
        (override.adminCheckInDecision === 'waived') ?? 
        (adminDecision === 'waived') ?? 
        override.isWaived
      );
      const isCheckOutWaived = Boolean(
        override.checkOutWaived ?? 
        override.isCheckOutWaived ?? 
        (override.adminCheckOutDecision === 'waived') ?? 
        (adminDecision === 'waived' && cOut && cOut < SHIFT_RULES.EARLY_THRESHOLD) ?? 
        (override.isWaived && cOut && cOut < SHIFT_RULES.EARLY_THRESHOLD)
      );
      const isWaived = isCheckInWaived || isCheckOutWaived;

      let workedHours = 8;
      if (cIn && cOut && cIn.includes(':') && cOut.includes(':')) {
        const [inH, inM] = cIn.split(':').map(Number);
        const [outH, outM] = cOut.split(':').map(Number);
        const inTotal = inH * 60 + (inM || 0);
        const outTotal = outH * 60 + (outM || 0);
        if (outTotal > inTotal) {
          const gross = outTotal - inTotal;
          const breakStart = 12 * 60;
          const breakEnd = 13 * 60;
          const overlap = Math.max(0, Math.min(outTotal, breakEnd) - Math.max(inTotal, breakStart));
          workedHours = parseFloat((Math.max(0, gross - overlap) / 60).toFixed(1));
        }
      }

      const checkInStatus = getCheckInStatus(cIn, isCheckInWaived, isPenalized);
      const checkOutStatus = getCheckOutStatus(cOut, isCheckOutWaived, isPenalized, isToday);

      return {
        hasRecord: true,
        isFriday,
        isFuture,
        isToday,
        status: (override.status as any) || 'Present',
        checkInTime: cIn,
        checkOutTime: cOut,
        rawCheckIn: override.rawCheckIn || cIn,
        rawCheckOut: override.rawCheckOut || cOut,
        checkInNote: override.checkInNote || override.note || '',
        checkOutNote: override.checkOutNote || '',
        note: override.note || override.checkInNote || '',
        adminNote: override.adminNote || '',
        adminCheckInNote: override.adminCheckInNote || override.adminNote || '',
        adminCheckOutNote: override.adminCheckOutNote || '',
        adminDecision,
        adminCheckInDecision: override.adminCheckInDecision || (isCheckInWaived ? 'waived' : null),
        adminCheckOutDecision: override.adminCheckOutDecision || (isCheckOutWaived ? 'waived' : null),
        isWaived,
        isCheckInWaived,
        isCheckOutWaived,
        workedHours: override.status === 'Present' ? workedHours : 0,
        warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
        historyLogs: override.historyLogs || [],
        hasAdminOverride: true,
        checkInStatus,
        checkOutStatus
      };
    }
  }

  // 2. Friday Holiday
  if (isFriday) {
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
      checkOutStatus: getCheckOutStatus('', false, false, false)
    };
  }

  // 3. Future Days
  if (isFuture) {
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
      checkOutStatus: getCheckOutStatus('', false, false, false)
    };
  }

  // 4. Past or Today: Search actual GPS logs from server (sorted chronologically so latest wins - کۆتا داتا)
  let checkInTime = '';
  let checkOutTime = '';
  let rawCheckIn = '';
  let rawCheckOut = '';
  let checkInNote = '';
  let checkOutNote = '';
  let note = '';
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

  for (const r of (sortedDayRecords as any[])) {
    const inCandidate = r.checkInTime || r.check_in_time || (r.checkIn ? (r.checkIn.includes(' ') ? r.checkIn.split(' ')[1]?.slice(0, 5) : r.checkIn.includes('T') ? r.checkIn.split('T')[1]?.slice(0, 5) : r.checkIn.slice(0, 5)) : '');
    const outCandidate = r.checkOutTime || r.check_out_time || (r.checkOut ? (r.checkOut.includes(' ') ? r.checkOut.split(' ')[1]?.slice(0, 5) : r.checkOut.includes('T') ? r.checkOut.split('T')[1]?.slice(0, 5) : r.checkOut.slice(0, 5)) : '');

    // Latest candidates win (کۆتا داتا)
    if (inCandidate) checkInTime = inCandidate.slice(0, 5);
    if (outCandidate) checkOutTime = outCandidate.slice(0, 5);
    if (r.rawCheckInTime || r.raw_check_in_time) rawCheckIn = (r.rawCheckInTime || r.raw_check_in_time).slice(0, 5);
    if (r.rawCheckOutTime || r.raw_check_out_time) rawCheckOut = (r.rawCheckOutTime || r.raw_check_out_time).slice(0, 5);
    
    const inN = r.check_in_note || r.checkInNote || r.checkin_note;
    const outN = r.check_out_note || r.checkOutNote || r.checkout_note;
    const genN = r.note || r.notes || r.reason || r.employeeNote || r.employee_note;
    
    if (inN) checkInNote = inN;
    if (outN) checkOutNote = outN;
    if (genN) note = genN;

    const admInN = r.adminCheckInNote || r.admin_check_in_note;
    const admOutN = r.adminCheckOutNote || r.admin_check_out_note;
    const admN = r.adminNote || r.admin_note || r.editNote || r.edit_note;

    if (admInN) adminCheckInNote = admInN;
    if (admOutN) adminCheckOutNote = admOutN;
    if (admN) adminNote = admN;

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

  const hasRecord = Boolean(checkInTime || checkOutTime);

  // Determine working status
  let status: 'Present' | 'Leave' | 'Absent' | 'Holiday' | 'Empty' | 'Loading' | 'مۆڵەت' | 'غیاب' = 'Empty';
  if (isWaitingData) {
    status = 'Loading';
  } else if (hasRecord || checkInTime) {
    status = 'Present';
  } else if (!isFuture && !isFriday) {
    status = 'Absent';
  }

  let workedHours = 0;
  if (checkInTime && checkOutTime) {
    const [inH, inM] = checkInTime.split(':').map(Number);
    const [outH, outM] = checkOutTime.split(':').map(Number);
    const inTotal = inH * 60 + (inM || 0);
    const outTotal = outH * 60 + (outM || 0);
    if (outTotal > inTotal) {
      const gross = outTotal - inTotal;
      const breakStart = 12 * 60;
      const breakEnd = 13 * 60;
      const overlap = Math.max(0, Math.min(outTotal, breakEnd) - Math.max(inTotal, breakStart));
      workedHours = parseFloat((Math.max(0, gross - overlap) / 60).toFixed(1));
    }
  } else if (hasRecord) {
    workedHours = 8;
  }

  const isPenalized = adminDecision === 'penalized' || adminCheckInDecision === 'penalized' || adminCheckOutDecision === 'penalized';
  const resolvedCheckInWaived = Boolean(isCheckInWaived || adminCheckInDecision === 'waived' || (adminDecision === 'waived' && checkInTime > SHIFT_RULES.GRACE_TIME) || (isWaived && checkInTime > SHIFT_RULES.GRACE_TIME));
  const resolvedCheckOutWaived = Boolean(isCheckOutWaived || adminCheckOutDecision === 'waived' || (adminDecision === 'waived' && checkOutTime && checkOutTime < SHIFT_RULES.EARLY_THRESHOLD) || (isWaived && checkOutTime && checkOutTime < SHIFT_RULES.EARLY_THRESHOLD));
  const resolvedWaived = resolvedCheckInWaived || resolvedCheckOutWaived || isWaived || adminDecision === 'waived';

  const checkInStatus = getCheckInStatus(checkInTime, resolvedCheckInWaived, isPenalized);
  const checkOutStatus = getCheckOutStatus(checkOutTime, resolvedCheckOutWaived, isPenalized, isToday);

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
    checkInNote,
    checkOutNote,
    note,
    adminNote,
    adminCheckInNote,
    adminCheckOutNote,
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
    checkOutStatus
  };
}
