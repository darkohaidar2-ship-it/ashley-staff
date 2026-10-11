import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { 
  getTelegramBindings, 
  sendTelegramMessage, 
  getDynamicEmployeeTelegramKeyboard 
} from '@/lib/telegram/telegram-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { 
  fetchAllShiftSettings, 
  getEmployeeShiftConfig, 
  saveEmployeeShiftSettings, 
  type EmployeeShiftConfig 
} from '@/lib/attendance/shift-service';

export type ShiftReminderType = 
  | 'morning_start'       // 07:45 AM (Morning 8-5 Shift Check-in)
  | 'morning_end'         // 04:45 PM (Morning 8-5 Shift Check-out)
  | 'evening_start'       // 02:45 PM (Evening 3-11 Shift Check-in)
  | 'evening_end'         // 10:45 PM (Evening 3-11 Shift Check-out)
  | 'morning'             // Alias for morning_start
  | 'evening';            // Alias for morning_end

export interface ShiftReminderTemplates {
  morningMessage: string;            // 07:45 AM (8-5 Shift Start)
  morningEndMessage: string;         // 04:45 PM (8-5 Shift End)
  eveningMessage: string;            // Alias for morningEndMessage (Backward compat)
  eveningShiftStartMessage: string;  // 02:45 PM (3-11 Evening Shift Welcome/Start)
  eveningShiftEndMessage: string;    // 10:45 PM (3-11 Evening Shift End)
  updatedAt?: string;
  updatedBy?: string;
}

export const SHIFT_REMINDER_TEMPLATES_KEY = 'ashley_shift_reminder_templates';

export const DEFAULT_SHIFT_REMINDER_TEMPLATES: ShiftReminderTemplates = {
  // 1. Morning Shift (8-5) - Start at 07:45 AM
  morningMessage: 
`☀️ <b>بەیانیت باش {name}ی خۆشەویست و بەڕێز!</b> 🌸

هیوای ڕۆژێکی پڕ لە بەرەکەت، تەندروستی و دەستکەوتی نوێ بۆ تۆ لە خێزانی ئاشڵی دەخوازین.

⏰ <b>تەنها ١٥ خولەکی ماوە</b> بۆ دەستپێکردنی دەوامی بەیانیان (٠٨:٠٠).
📍 کاتێک گەیشتیتە دەوام، لەبیرت نەچێت دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b> لە خوارەوە دابگریت تاوەکو کاتەکەت بە دروستی و بەبێ دواکەوتن تۆمار بکرێت.

💪 <i>دەستت خۆش بێت بۆ دڵسۆزی و ماندووبوونی بەردەوامت!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,

  // 2. Morning Shift (8-5) - End at 04:45 PM
  morningEndMessage: 
`🌇 <b>ماندوو نەبیت و دەستت خۆش بێت {name} گیان!</b> 🌟

زۆر سوپاسی هەوڵ، دڵسۆزی و ماندووبوونی ئەمڕۆت دەکەین بۆ سەرخستنی کارەکان لە ئاشڵی.

⏰ <b>دەوامی بەیانیان بەرەو کۆتایی دەچێت (٠٥:٠٠).</b>
📍 لە کاتی دەرچوون لە شوێنی دەوام، لەبیرت نەچێت دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b> لە خوارەوە دابگریت تاوەکو ماف و کاتەکانت پارێزراو بێت.

🏡 <i>هیوای ئێوارەیەکی شاد، ئارام و پڕ لە خۆشی بۆ تۆ و ماڵباتەکەت!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,

  eveningMessage: 
`🌇 <b>ماندوو نەبیت و دەستت خۆش بێت {name} گیان!</b> 🌟

زۆر سوپاسی هەوڵ، دڵسۆزی و ماندووبوونی ئەمڕۆت دەکەین بۆ سەرخستنی کارەکان لە ئاشڵی.

⏰ <b>دەوامی بەیانیان بەرەو کۆتایی دەچێت (٠٥:٠٠).</b>
📍 لە کاتی دەرچوون لە شوێنی دەوام، لەبیرت نەچێت دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b> لە خوارەوە دابگریت تاوەکو ماف و کاتەکانت پارێزراو بێت.

🏡 <i>هیوای ئێوارەیەکی شاد، ئارام و پڕ لە خۆشی بۆ تۆ و ماڵباتەکەت!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,

  // 3. Evening Shift (3-11) - Start at 02:45 PM (14:45)
  eveningShiftStartMessage: 
`☀️ <b>نیوەڕۆت باش و بەخێربێیت {name} گیان!</b> 🌸

هیوای دەوامێکی پڕ لە سەرکەوتن و ئاسودەییت بۆ دەخوازین لە شفتـی ئێوارانی ئاشڵی (٣ بۆ ١١).

⏰ <b>تەنها ١٥ خولەکی ماوە</b> بۆ دەستپێکردنی دەوامی ئێواران (٠٣:٠٠ پ.ن).
📍 کاتێک گەیشتیتە شوێنی کار، لەبیرت نەچێت دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b> لە خوارەوە دابگریت تاوەکو کاتەکەت بە ڕێکی تۆمار بکرێت.

💪 <i>دەستخۆشیت لێ دەکەین بۆ هەوڵ و دڵسۆزیی بەردەوامت!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,

  // 4. Evening Shift (3-11) - End at 10:45 PM (22:45)
  eveningShiftEndMessage: 
`🌙 <b>دەستت خۆش بێت و ماندوو نەبیت {name} گیان!</b> 🌟

زۆر سوپاس بۆ ماندووبوون و دڵسۆزیت لە شفتـی ئێواراندا بۆ پێشخستنی پرۆژەکانی ئاشڵی.

⏰ <b>دەوامی شفتـی ئێواران بەرەو کۆتایی دەچێت (١١:٠٠ شه‌و).</b>
📍 پێش بەجێهێشتنی کار، لەبیرت نەچێت دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b> لە خوارەوە دابگریت تا ماف و کاتەکانت پارێزراو بێت.

🏡 <i>شەوێکی ئارام و پڕ لە خۆشیت بۆ دەخوازین!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,
};

/**
 * Fetch active reminder templates from Supabase with fallback to defaults
 */
export async function fetchShiftReminderTemplates(): Promise<ShiftReminderTemplates> {
  try {
    const data = await fetchSupabaseJson<ShiftReminderTemplates | null>(
      SHIFT_REMINDER_TEMPLATES_KEY,
      null
    );
    if (data) {
      return {
        morningMessage: data.morningMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.morningMessage,
        morningEndMessage: data.morningEndMessage || data.eveningMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.morningEndMessage,
        eveningMessage: data.morningEndMessage || data.eveningMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningMessage,
        eveningShiftStartMessage: data.eveningShiftStartMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningShiftStartMessage,
        eveningShiftEndMessage: data.eveningShiftEndMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningShiftEndMessage,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    }
  } catch (err) {
    logger.warn('[ShiftReminder] Error fetching reminder templates:', err);
  }
  return { ...DEFAULT_SHIFT_REMINDER_TEMPLATES };
}

/**
 * Save customized reminder templates to Supabase
 */
export async function saveShiftReminderTemplates(templates: Partial<ShiftReminderTemplates>): Promise<boolean> {
  try {
    const current = await fetchShiftReminderTemplates();
    const payload: ShiftReminderTemplates = {
      morningMessage: (templates.morningMessage ?? current.morningMessage).trim(),
      morningEndMessage: (templates.morningEndMessage ?? templates.eveningMessage ?? current.morningEndMessage).trim(),
      eveningMessage: (templates.morningEndMessage ?? templates.eveningMessage ?? current.eveningMessage).trim(),
      eveningShiftStartMessage: (templates.eveningShiftStartMessage ?? current.eveningShiftStartMessage).trim(),
      eveningShiftEndMessage: (templates.eveningShiftEndMessage ?? current.eveningShiftEndMessage).trim(),
      updatedAt: new Date().toISOString(),
    };
    return await saveSupabaseJson(
      SHIFT_REMINDER_TEMPLATES_KEY,
      'Ashley Shift Reminder Templates',
      payload
    );
  } catch (err) {
    logger.error('[ShiftReminder] Error saving reminder templates:', err);
    return false;
  }
}

export interface ShiftReminderResult {
  success: boolean;
  type: ShiftReminderType;
  dateStr: string;
  timeStr: string;
  isFriday: boolean;
  isHoliday: boolean;
  holidayReason?: string;
  totalBindings: number;
  sentCount: number;
  skippedCount: number;
  details: Array<{
    employeeId: string;
    employeeName: string;
    chatId: string;
    status: 'sent' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

/**
 * Returns Baghdad / Erbil / Sulaymaniyah local date, time, and day of week (UTC+3)
 */
export function getBaghdadShiftTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(now);

  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  let hh = getPart('hour');
  if (hh === '24') hh = '00';
  const mm = getPart('minute');
  const ss = getPart('second');
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const timeStr = `${hh}:${mm}`;

  const baghdadDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
  const dayOfWeek = baghdadDateObj.getDay();
  const isFriday = dayOfWeek === 5;

  return {
    dateStr,
    timeStr,
    timeWithSecStr: `${hh}:${mm}:${ss}`,
    hour: parseInt(hh, 10),
    minute: parseInt(mm, 10),
    dayOfWeek,
    isFriday,
  };
}

/**
 * Checks if today is an official company holiday in database
 */
export async function checkIsCompanyHoliday(dateStr: string): Promise<{ isHoliday: boolean; reason?: string }> {
  try {
    const { data: holRows } = await supabase
      .from('attendance')
      .select('status, note')
      .eq('date', dateStr)
      .eq('status', 'Holiday')
      .limit(1);

    if (holRows && holRows.length > 0) {
      return { isHoliday: true, reason: holRows[0].note || 'پشووی فەرمی کۆمپانیا' };
    }

    const { data: whRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_manual_attendance_records')
      .maybeSingle();

    if (whRow?.qr_code) {
      const overrides = typeof whRow.qr_code === 'string' ? JSON.parse(whRow.qr_code) : whRow.qr_code;
      if (overrides && typeof overrides === 'object') {
        for (const [key, val] of Object.entries<any>(overrides)) {
          if (key.includes(dateStr) && (val?.status === 'Holiday' || val?.status === 'پشوو')) {
            return { isHoliday: true, reason: val?.note || val?.adminNote || 'پشووی فەرمی دیاریکراو' };
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[ShiftReminder] Error checking company holiday:', err);
  }

  return { isHoliday: false };
}

/**
 * Checks if a specific employee has an approved leave for the target date
 */
export async function checkIsEmployeeOnLeave(employeeId: string, dateStr: string): Promise<{ onLeave: boolean; reason?: string }> {
  try {
    const cleanId = employeeId.replace('emp-', '');

    const { data: attRows } = await supabase
      .from('attendance')
      .select('status, note')
      .eq('date', dateStr)
      .or(`user_id.eq.${employeeId},user_id.eq.emp-${cleanId},user_id.eq.${cleanId}`)
      .limit(1);

    if (attRows && attRows.length > 0) {
      const st = attRows[0].status;
      if (st === 'Leave' || st === 'مۆڵەت') {
        return { onLeave: true, reason: attRows[0].note || 'لە مۆڵەتی فەرمیدایە' };
      }
    }

    const { data: reqRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    if (reqRow?.qr_code) {
      const requests = typeof reqRow.qr_code === 'string' ? JSON.parse(reqRow.qr_code) : reqRow.qr_code;
      if (Array.isArray(requests)) {
        for (const r of requests) {
          const rId = String(r.employeeId || r.userId || '');
          if ((rId === employeeId || rId.includes(cleanId)) && (r.status === 'Approved' || r.status === 'پەسەندکراو')) {
            const start = String(r.startDate || r.date || '').slice(0, 10);
            const end = String(r.endDate || r.date || start).slice(0, 10);
            if (dateStr >= start && dateStr <= end) {
              return { onLeave: true, reason: r.reason || 'مۆڵەتی پەسەندکراو' };
            }
          }
        }
      }
    }
  } catch (err) {
    logger.warn(`[ShiftReminder] Error checking leave for ${employeeId}:`, err);
  }

  return { onLeave: false };
}

/**
 * Checks if employee has already punched in or out today
 */
export async function checkEmployeeTodayPunches(
  employeeId: string, 
  dateStr: string
): Promise<{ hasIn: boolean; hasOut: boolean }> {
  try {
    const cleanId = employeeId.replace('emp-', '');

    const { data: att } = await supabase
      .from('attendance')
      .select('check_in, check_in_time, check_out, check_out_time, status')
      .eq('date', dateStr)
      .or(`user_id.eq.${employeeId},user_id.eq.emp-${cleanId},user_id.eq.${cleanId}`)
      .maybeSingle();

    let hasIn = false;
    let hasOut = false;

    if (att) {
      hasIn = Boolean(att.check_in || att.check_in_time);
      hasOut = Boolean(att.check_out || att.check_out_time);
    }

    if (!hasIn || !hasOut) {
      const { data: logs } = await supabase
        .from('attendance_logs')
        .select('log_type')
        .eq('log_date', dateStr)
        .or(`employee_id.eq.${employeeId},employee_id.eq.emp-${cleanId},employee_id.eq.${cleanId}`);

      if (logs && logs.length > 0) {
        for (const l of logs) {
          const lt = (l.log_type || '').toLowerCase();
          if (lt.includes('in') || lt.includes('هاتن')) hasIn = true;
          if (lt.includes('out') || lt.includes('دەرچوون')) hasOut = true;
        }
      }
    }

    return { hasIn, hasOut };
  } catch (err) {
    logger.warn(`[ShiftReminder] Error checking punches for ${employeeId}:`, err);
    return { hasIn: false, hasOut: false };
  }
}

/**
 * Generates an inspiring, warm Kurdish reminder message using configured templates
 */
export function buildReminderMessage(
  type: ShiftReminderType,
  employeeName: string,
  customTemplates?: ShiftReminderTemplates
): string {
  const templates = customTemplates || DEFAULT_SHIFT_REMINDER_TEMPLATES;
  let rawText = '';

  switch (type) {
    case 'morning_start':
    case 'morning':
      rawText = templates.morningMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.morningMessage;
      break;

    case 'morning_end':
    case 'evening':
      rawText = templates.morningEndMessage || templates.eveningMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.morningEndMessage;
      break;

    case 'evening_start':
      rawText = templates.eveningShiftStartMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningShiftStartMessage;
      break;

    case 'evening_end':
      rawText = templates.eveningShiftEndMessage || DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningShiftEndMessage;
      break;

    default:
      rawText = templates.morningMessage;
  }

  const validText = (rawText && rawText.trim()) ? rawText : DEFAULT_SHIFT_REMINDER_TEMPLATES.morningMessage;
  return validText.replace(/\{name\}/g, employeeName || 'کارمەندی بەڕێز');
}

/**
 * Main Orchestrator: Dispatches smart morale-boosting shift reminders
 * Handles:
 * 1. Morning Shift (8-5): 07:45 AM start reminder & 04:45 PM end reminder
 * 2. Evening Shift (3-11): 02:45 PM start reminder & 10:45 PM end reminder
 */
export async function dispatchShiftReminders(
  forcedType?: ShiftReminderType,
  bypassScheduleChecks: boolean = false
): Promise<ShiftReminderResult> {
  const timeInfo = getBaghdadShiftTime();
  const dateStr = timeInfo.dateStr;
  const timeStr = timeInfo.timeStr;

  const h = timeInfo.hour;
  const m = timeInfo.minute;

  // Strict minute windows for automated cron dispatches (target is xx:45, valid: 40 <= m <= 58)
  const isMorningStartWindow = h === 7 && m >= 40 && m <= 58;
  const isEveningStartWindow = h === 14 && m >= 40 && m <= 58;
  const isMorningEndWindow = h === 16 && m >= 40 && m <= 58;
  const isEveningEndWindow = h === 22 && m >= 40 && m <= 58;

  // Determine type automatically based on Baghdad local time if not forced
  let reminderType: ShiftReminderType = forcedType || 'morning_start';

  if (!forcedType) {
    if (isMorningStartWindow) {
      reminderType = 'morning_start'; // ~07:45 AM
    } else if (isEveningStartWindow) {
      reminderType = 'evening_start'; // ~02:45 PM (14:45)
    } else if (isMorningEndWindow) {
      reminderType = 'morning_end';   // ~04:45 PM (16:45)
    } else if (isEveningEndWindow) {
      reminderType = 'evening_end';   // ~10:45 PM (22:45)
    } else {
      if (!bypassScheduleChecks) {
        logger.info(`[ShiftReminder] Ping at ${timeStr} is outside reminder windows (07:45, 14:45, 16:45, 22:45). Skipped.`);
        return {
          success: true,
          type: 'morning_start',
          dateStr,
          timeStr,
          isFriday: timeInfo.isFriday,
          isHoliday: false,
          holidayReason: `کاتژمێری ئێستا (${timeStr}) کاتی ئاگاداری فەرمی نییە (پێویستە لە دەوروبەری ٠٧:٤٥، ١٤:٤٥، ١٦:٤٥، یان ٢٢:٤٥ بێت).`,
          totalBindings: 0,
          sentCount: 0,
          skippedCount: 0,
          details: [],
        };
      }
      reminderType = h < 14 ? 'morning_start' : 'morning_end';
    }
  } else {
    // If forcedType is provided by automated cron, enforce the minute window unless bypassScheduleChecks is true
    if (!bypassScheduleChecks) {
      let isWithinWindow = false;
      let expectedWindowDesc = '';

      if (forcedType === 'morning_start' || forcedType === 'morning') {
        isWithinWindow = isMorningStartWindow;
        expectedWindowDesc = '٠٧:٤٥ بەیانی';
      } else if (forcedType === 'evening_start') {
        isWithinWindow = isEveningStartWindow;
        expectedWindowDesc = '٠٢:٤٥ پاشنیوەڕۆ (١٤:٤٥)';
      } else if (forcedType === 'morning_end' || forcedType === 'evening') {
        isWithinWindow = isMorningEndWindow;
        expectedWindowDesc = '٠٤:٤٥ ئێوارە (١٦:٤٥)';
      } else if (forcedType === 'evening_end') {
        isWithinWindow = isEveningEndWindow;
        expectedWindowDesc = '١٠:٤٥ شەو (٢٢:٤٥)';
      }

      if (!isWithinWindow) {
        logger.info(`[ShiftReminder] Type '${forcedType}' invoked at ${timeStr}, but expected window is ${expectedWindowDesc}. Ignored.`);
        return {
          success: true,
          type: forcedType,
          dateStr,
          timeStr,
          isFriday: timeInfo.isFriday,
          isHoliday: false,
          holidayReason: `ئاگاداری '${forcedType}' تەنها لە دەوروبەری ${expectedWindowDesc} دەنێردرێت. کاتژمێری ئێستا: ${timeStr}.`,
          totalBindings: 0,
          sentCount: 0,
          skippedCount: 0,
          details: [],
        };
      }
    }
  }

  // 🛑 0. Check duplicate automated execution on the same date for this checkpoint
  if (!bypassScheduleChecks) {
    try {
      const logData = await fetchSupabaseJson<any>('ashley_shift_reminders_log', null);
      const lastRun = logData?.lastRun;
      if (
        lastRun &&
        lastRun.dateStr === dateStr &&
        lastRun.type === reminderType &&
        (lastRun.sentCount || 0) > 0
      ) {
        logger.info(`[ShiftReminder] ${reminderType} already dispatched today at ${lastRun.timeStr} (${lastRun.sentCount} sent). Skipping duplicate run.`);
        return {
          success: true,
          type: reminderType,
          dateStr,
          timeStr,
          isFriday: timeInfo.isFriday,
          isHoliday: false,
          holidayReason: `ئەم ئاگادارییە پێشتر ئەمڕۆ لە کاتژمێر ${lastRun.timeStr} بە سەرکەوتوویی بۆ کارمەندان نێردراوە (${lastRun.sentCount} نامە). دووبارە ناکرێتەوە.`,
          totalBindings: lastRun.total || 0,
          sentCount: 0,
          skippedCount: 0,
          details: [],
        };
      }
    } catch (err) {
      logger.warn('[ShiftReminder] Error checking previous run log:', err);
    }
  }

  const result: ShiftReminderResult = {
    success: true,
    type: reminderType,
    dateStr,
    timeStr,
    isFriday: timeInfo.isFriday,
    isHoliday: false,
    totalBindings: 0,
    sentCount: 0,
    skippedCount: 0,
    details: [],
  };

  // 🛑 1. Check Friday Weekend (unless admin bypassed for testing)
  if (timeInfo.isFriday && !bypassScheduleChecks) {
    result.success = true;
    result.holidayReason = 'ئەمڕۆ هەینییە (پشووی فەرمیی هەفتانە)';
    logger.info(`[ShiftReminder] Skipped: Today is Friday (${dateStr})`);
    return result;
  }

  // 🛑 2. Check Company Holiday
  const holidayCheck = await checkIsCompanyHoliday(dateStr);
  result.isHoliday = holidayCheck.isHoliday;
  if (holidayCheck.isHoliday) {
    result.holidayReason = holidayCheck.reason || 'پشووی فەرمی کۆمپانیا';
    if (!bypassScheduleChecks) {
      result.success = true;
      logger.info(`[ShiftReminder] Skipped: Company holiday today (${dateStr}) - ${holidayCheck.reason}`);
      return result;
    }
  }

  // 👥 3. Fetch all Telegram bound employees
  const bindings = await getTelegramBindings();
  const chatIds = Object.keys(bindings);
  result.totalBindings = chatIds.length;

  if (chatIds.length === 0) {
    logger.warn('[ShiftReminder] No bound Telegram employees found.');
    return result;
  }

  // 📝 4. Fetch active customized reminder templates
  const templates = await fetchShiftReminderTemplates();

  // 🕒 5. Fetch all shift configurations to differentiate 8-5 from 3-11 employees
  const shiftSettingsMap = await fetchAllShiftSettings();

  // 🚀 6. Evaluate each employee individually
  for (const chatId of chatIds) {
    const bindInfo = bindings[chatId];
    const empId = bindInfo.employeeId;
    const empName = bindInfo.employeeName;

    // Determine employee's shift (Morning 8-5 vs Evening 3-11)
    const shiftCfg = getEmployeeShiftConfig(empId, shiftSettingsMap);
    const isEveningShiftEmp = shiftCfg.shiftType === 'evening' || shiftCfg.startTime === '15:00';

    // Filter A: Morning Shift Start (07:45 AM)
    if (reminderType === 'morning_start' || reminderType === 'morning') {
      if (isEveningShiftEmp && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'شفتـی ئێوارانە (٣ بۆ ١١) - پەیام لە کاتژمێر ٢:٤٥ بۆی دەچێت',
        });
        continue;
      }
    }

    // Filter B: Evening Shift Start (02:45 PM / 14:45)
    if (reminderType === 'evening_start') {
      if (!isEveningShiftEmp && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'شفتـی بەیانیانە (٨ بۆ ٥)',
        });
        continue;
      }
    }

    // Filter C: Morning Shift End (04:45 PM / 16:45)
    if (reminderType === 'morning_end' || reminderType === 'evening') {
      if (isEveningShiftEmp && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'شفتـی ئێوارانە (٣ بۆ ١١) - دەوامی لە ١١:٠٠ کۆتایی دێت',
        });
        continue;
      }
    }

    // Filter D: Evening Shift End (10:45 PM / 22:45)
    if (reminderType === 'evening_end') {
      if (!isEveningShiftEmp && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'شفتـی بەیانیانە (٨ بۆ ٥)',
        });
        continue;
      }
    }

    // Check if on approved leave
    const leaveCheck = await checkIsEmployeeOnLeave(empId, dateStr);
    if (leaveCheck.onLeave && !bypassScheduleChecks) {
      result.skippedCount++;
      result.details.push({
        employeeId: empId,
        employeeName: empName,
        chatId,
        status: 'skipped',
        reason: `مۆڵەت: ${leaveCheck.reason || 'لە مۆڵەتی فەرمیدایە'}`,
      });
      continue;
    }

    // Fetch punch status for context logging, but do NOT skip employees:
    // Both morning and evening reminders are sent to ALL employees on the shift
    // to maintain high morale and remind everyone to register their attendance.
    const punchCheck = await checkEmployeeTodayPunches(empId, dateStr);
    logger.info(`[ShiftReminder] Punch status for ${empName} (${empId}): in=${punchCheck.hasIn}, out=${punchCheck.hasOut}`);

    // Compose personalized message & attach employee dynamic reply keyboard
    const msgText = buildReminderMessage(reminderType, empName, templates);
    const keyboard = await getDynamicEmployeeTelegramKeyboard(empId);

    try {
      const sendRes = await sendTelegramMessage(chatId, msgText, keyboard);
      if (sendRes && sendRes.ok) {
        result.sentCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'sent',
        });
      } else {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'failed',
          reason: sendRes?.description || 'هەڵە لە ناردن بۆ تەلەگرام',
        });
      }
    } catch (sendErr: any) {
      result.skippedCount++;
      result.details.push({
        employeeId: empId,
        employeeName: empName,
        chatId,
        status: 'failed',
        reason: sendErr.message || 'شکستی پەیوەندی لەگەڵ تەلەگرام',
      });
    }

    // Anti-flood throttle (60ms between calls)
    await new Promise((r) => setTimeout(r, 60));
  }

  // Persist run log in Supabase
  try {
    await saveSupabaseJson('ashley_shift_reminders_log', 'Shift Reminders Execution Log', {
      lastRun: {
        id: `reminder-${reminderType}-${dateStr}-${Date.now()}`,
        type: reminderType,
        dateStr,
        timeStr,
        sentCount: result.sentCount,
        skippedCount: result.skippedCount,
        total: result.totalBindings,
        details: result.details,
      },
    });
  } catch (logErr) {
    logger.warn('[ShiftReminder] Failed to write run log:', logErr);
  }

  return result;
}
