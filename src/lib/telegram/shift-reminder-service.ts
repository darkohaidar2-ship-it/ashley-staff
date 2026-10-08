import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { 
  getTelegramBindings, 
  sendTelegramMessage, 
  getDynamicEmployeeTelegramKeyboard 
} from '@/lib/telegram/telegram-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

export interface ShiftReminderTemplates {
  morningMessage: string;
  eveningMessage: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const SHIFT_REMINDER_TEMPLATES_KEY = 'ashley_shift_reminder_templates';

export const DEFAULT_SHIFT_REMINDER_TEMPLATES: ShiftReminderTemplates = {
  morningMessage: 
`☀️ <b>بەیانیت باش {name}ی خۆشەویست و بەڕێز!</b> 🌸

هیوای ڕۆژێکی پڕ لە بەرەکەت، تەندروستی و دەستکەوتی نوێ بۆ تۆ لە خێزانی ئاشڵی دەخوازین.

⏰ <b>تەنها ١٥ خولەکی ماوە</b> بۆ دەستپێکردنی دەوامی فەرمی (٠٨:٠٠).
📍 کاتێک گەیشتیتە دەوام، لەبیرت نەچێت دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b> لە خوارەوە دابگریت تاوەکو کاتەکەت بە دروستی و بەبێ دواکەوتن تۆمار بکرێت.

💪 <i>دەستت خۆش بێت بۆ دڵسۆزی و ماندووبوونی بەردەوامت!</i>
🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`,

  eveningMessage: 
`🌇 <b>ماندوو نەبیت و دەستت خۆش بێت {name} گیان!</b> 🌟

زۆر سوپاسی هەوڵ، دڵسۆزی و ماندووبوونی ئەمڕۆت دەکەین بۆ سەرخستنی کارەکان لە ئاشڵی.

⏰ <b>دەوامی ئەمڕۆ بەرەو کۆتایی دەچێت (٠٥:٠٠).</b>
📍 لە کاتی دەرچوون لە شوێنی دەوام، لەبیرت نەچێت دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b> لە خوارەوە دابگریت تاوەکو ماف و کاتەکانت پارێزراو بێت.

🏡 <i>هیوای ئێوارەیەکی شاد، ئارام و پڕ لە خۆشی بۆ تۆ و ماڵباتەکەت!</i>
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
    if (data && data.morningMessage && data.eveningMessage) {
      return {
        morningMessage: data.morningMessage,
        eveningMessage: data.eveningMessage,
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
export async function saveShiftReminderTemplates(templates: ShiftReminderTemplates): Promise<boolean> {
  try {
    const payload: ShiftReminderTemplates = {
      morningMessage: templates.morningMessage.trim(),
      eveningMessage: templates.eveningMessage.trim(),
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
  type: 'morning' | 'evening';
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

  // Accurate day of week for Baghdad timezone
  const baghdadDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
  const dayOfWeek = baghdadDateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
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
    // 1. Check in attendance table for holiday status
    const { data: holRows } = await supabase
      .from('attendance')
      .select('status, check_in_address, note')
      .eq('date', dateStr)
      .in('status', ['Holiday', 'پشوو'])
      .limit(1);

    if (holRows && holRows.length > 0) {
      const reason = holRows[0].check_in_address || holRows[0].note || 'پشووی فەرمی کۆمپانیا';
      return { isHoliday: true, reason };
    }

    // 2. Check in manual attendance overrides in warehouses table
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

    // 1. Check direct attendance status
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

    // 2. Check leave requests store in warehouses
    const { data: reqRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    if (reqRow?.qr_code) {
      const allReqs = typeof reqRow.qr_code === 'string' ? JSON.parse(reqRow.qr_code) : reqRow.qr_code;
      if (allReqs && typeof allReqs === 'object') {
        for (const req of Object.values<any>(allReqs)) {
          if (
            (req.employeeId === employeeId || req.employeeId === `emp-${cleanId}` || req.employeeId === cleanId) &&
            req.status === 'approved' &&
            req.targetDate === dateStr
          ) {
            return { onLeave: true, reason: req.leaveType || 'مۆڵەتی پەسەندکراو' };
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
 * Checks if the employee already has recorded attendance for today
 */
export async function checkEmployeeTodayPunches(employeeId: string, dateStr: string): Promise<{ hasIn: boolean; hasOut: boolean }> {
  try {
    const cleanId = employeeId.replace('emp-', '');

    // 1. Check attendance row
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

    // 2. Also check today's attendance_logs for high precision
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
  type: 'morning' | 'evening',
  employeeName: string,
  customTemplates?: ShiftReminderTemplates
): string {
  const templates = customTemplates || DEFAULT_SHIFT_REMINDER_TEMPLATES;
  const rawText = type === 'morning' ? templates.morningMessage : templates.eveningMessage;

  const validText = (rawText && rawText.trim()) 
    ? rawText 
    : (type === 'morning' ? DEFAULT_SHIFT_REMINDER_TEMPLATES.morningMessage : DEFAULT_SHIFT_REMINDER_TEMPLATES.eveningMessage);

  return validText.replace(/\{name\}/g, employeeName || 'کارمەندی بەڕێز');
}

/**
 * Main Orchestrator: Dispatches smart morale-boosting shift reminders
 */
export async function dispatchShiftReminders(
  forcedType?: 'morning' | 'evening',
  bypassScheduleChecks: boolean = false
): Promise<ShiftReminderResult> {
  const timeInfo = getBaghdadShiftTime();
  const dateStr = timeInfo.dateStr;
  const timeStr = timeInfo.timeStr;

  // Determine type automatically if not explicitly provided
  const reminderType: 'morning' | 'evening' = 
    forcedType || (timeInfo.hour < 12 ? 'morning' : 'evening');

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

  // 🚀 4. Evaluate each employee individually
  for (const chatId of chatIds) {
    const bindInfo = bindings[chatId];
    const empId = bindInfo.employeeId;
    const empName = bindInfo.employeeName;

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

    // Check punch status
    const punchCheck = await checkEmployeeTodayPunches(empId, dateStr);

    if (reminderType === 'morning' && punchCheck.hasIn && !bypassScheduleChecks) {
      result.skippedCount++;
      result.details.push({
        employeeId: empId,
        employeeName: empName,
        chatId,
        status: 'skipped',
        reason: 'پێشتر هاتنی تۆمارکردووە',
      });
      continue;
    }

    if (reminderType === 'evening') {
      if (punchCheck.hasOut && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'پێشتر دەرچوونی تۆمارکردووە',
        });
        continue;
      }
      if (!punchCheck.hasIn && !bypassScheduleChecks) {
        result.skippedCount++;
        result.details.push({
          employeeId: empId,
          employeeName: empName,
          chatId,
          status: 'skipped',
          reason: 'ئەمڕۆ دەوامی تۆمار نەکردووە (غایب یان پشوو)',
        });
        continue;
      }
    }

    // Compose personalized message & get employee's dynamic keyboard
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
        reason: sendErr.message || 'پەیوەندی لەگەڵ تەلەگرام نەبەسترا',
      });
    }

    // Slight delay to stay well within Telegram API rate limits
    await new Promise(r => setTimeout(r, 60));
  }

  // 📝 5. Record dispatch history into Supabase
  try {
    const logId = `reminder-${reminderType}-${dateStr}-${Date.now()}`;
    await supabase.from('warehouses').upsert({
      id: 'ashley_shift_reminders_log',
      name: 'SHIFT_REMINDERS_AUDIT_LOG',
      qr_code: JSON.stringify({
        lastRun: {
          id: logId,
          type: reminderType,
          dateStr,
          timeStr,
          sentCount: result.sentCount,
          skippedCount: result.skippedCount,
          total: result.totalBindings,
          details: result.details,
        }
      }),
    }, { onConflict: 'id' });
  } catch (logErr) {
    logger.warn('[ShiftReminder] Error saving reminder audit log:', logErr);
  }

  return result;
}
