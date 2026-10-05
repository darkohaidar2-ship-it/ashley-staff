import { supabase } from '@/lib/supabase/client';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';
import { logger } from '@/lib/logger';

// Bot token is strictly read from environment variable - no hardcoded fallback
function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error('[TelegramService] TELEGRAM_BOT_TOKEN environment variable is not defined!');
  }
  return token || '';
}

// Timezone: Asia/Baghdad (Kurdish Local Time)
export function getBaghdadNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());

  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  let hh = getPart('hour');
  if (hh === '24') hh = '00';
  const mm = getPart('minute');
  const ss = getPart('second');
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const timeStr = `${hh}:${mm}`;

  return { dateStr, timeStr, timeWithSecStr: `${hh}:${mm}:${ss}` };
}

// Haversine formula
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Telegram API message sender
export async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  const token = getBotToken();
  if (!token) {
    logger.error('[TelegramService] Cannot send telegram message: TELEGRAM_BOT_TOKEN is missing');
    return null;
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] sendTelegramMessage error:', err);
    return null;
  }
}

// Telegram API document sender (PDF files)
export async function sendTelegramDocument(
  chatId: number | string,
  docBuffer: Buffer,
  filename: string,
  caption?: string
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('document', new Blob([docBuffer], { type: 'application/pdf' }), filename);
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] sendTelegramDocument error:', err);
    return null;
  }
}

// Telegram API photo sender
export async function sendTelegramPhoto(
  chatId: number | string,
  photo: string,
  caption?: string,
  replyMarkup?: any
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const payload: any = {
      chat_id: chatId,
      photo,
      parse_mode: 'HTML',
    };
    if (caption) payload.caption = caption;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] sendTelegramPhoto error:', err);
    return null;
  }
}

// Edit existing message text & inline keyboard
export async function editTelegramMessage(
  chatId: number | string,
  messageId: number | string,
  text: string,
  replyMarkup?: any
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const payload: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] editTelegramMessage error:', err);
    return null;
  }
}

// Answer callback query to dismiss loading indicator
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const payload: any = { callback_query_id: callbackQueryId };
    if (text) {
      payload.text = text;
      payload.show_alert = showAlert;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] answerCallbackQuery error:', err);
    return null;
  }
}

// Get Telegram File direct URL
export async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  const token = getBotToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (data?.ok && data.result?.file_path) {
      return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    }
  } catch (err) {
    logger.error('[TelegramService] getTelegramFileUrl error:', err);
  }
  return null;
}

// Keyboards
export function getMainReplyKeyboard(isManager: boolean = false) {
  const rows: any[][] = [
    [
      { text: '🟢 تۆمارکردنی هاتن' },
      { text: '🔴 تۆمارکردنی دەرچوون' },
    ],
    [
      { text: '📊 دۆخی دەوامی ئەمڕۆم' },
      { text: '📋 لیستی ئامادەبووانی ئەمڕۆ' },
    ],
    [
      { text: '📅 دۆخی دەوامی ئەم مانگەم' },
      { text: '👤 پرۆفایلی من' },
    ],
    [
      { text: '🏖️ داواکردنی مۆڵەت' },
      { text: 'ℹ️ شوێنەکانی دەوام' },
    ],
  ];

  if (isManager) {
    rows.push([{ text: '⚡ تۆمارکردنی خێرا (بەڕێوەبەر)' }]);
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function getLocationRequestKeyboard(isManager: boolean = false) {
  const rows: any[][] = [
    [
      {
        text: '📍 ناردنی لۆکەیشنی دەوام (GPS)',
        request_location: true,
      },
    ],
  ];

  if (isManager) {
    rows.push([
      { text: '⚡ تۆمارکردنی خێرا (بەبێ GPS)' },
      { text: '❌ هەڵوەشاندنەوە' },
    ]);
  } else {
    rows.push([
      { text: '❌ هەڵوەشاندنەوە' },
    ]);
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

// Official PIN Map fallback
export const OFFICIAL_PIN_MAP: Record<string, string> = {
  'emp-01': '1001',
  'emp-02': '1002', // کاک دارکۆ حەیدەر
  'emp-03': '1003',
  'emp-04': '1004',
  'emp-05': '1005',
  'emp-06': '1006',
  'emp-07': '1007',
  'emp-08': '1008',
  'emp-09': '1009',
  'emp-10': '1010',
  'emp-11': '1011',
  'emp-12': '1012',
};

// PIN verification for employee binding
export async function verifyEmployeePin(employeeId: string, enteredPin: string): Promise<boolean> {
  const cleanPin = (enteredPin || '').trim();
  if (!cleanPin || cleanPin.length < 4) return false;

  const adminBypass = process.env.ADMIN_BYPASS_PIN || process.env.NEXT_PUBLIC_ADMIN_BYPASS_PIN;
  if (adminBypass && cleanPin === adminBypass) return true;

  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();

    if (setRow?.qr_code) {
      const profiles = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      const rawNum = employeeId.replace('emp-', '');
      const profile = profiles[employeeId] || profiles[rawNum] || profiles[`emp-${rawNum}`];
      if (profile && (profile.pin || profile.password)) {
        return String(profile.pin || profile.password).trim() === cleanPin;
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error reading employee profile for PIN:', err);
  }

  const expectedPin = OFFICIAL_PIN_MAP[employeeId] || OFFICIAL_PIN_MAP[`emp-${employeeId.replace('emp-', '')}`];
  if (expectedPin) {
    return expectedPin === cleanPin;
  }

  return false;
}

// Find employee directly by secret PIN (without exposing public employee list)
export async function findEmployeeByPin(enteredPin: string): Promise<{ id: string; employeeId: string; name: string } | null> {
  const cleanPin = (enteredPin || '').trim();
  if (!cleanPin || cleanPin.length < 4) return null;

  const allEmps = await getAllEmployees();

  // 1. Check custom profiles in Supabase
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();

    if (setRow?.qr_code) {
      const profiles = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      for (const emp of allEmps) {
        const rawNum = emp.id.replace('emp-', '');
        const profile = profiles[emp.id] || profiles[rawNum] || profiles[`emp-${rawNum}`];
        if (profile && (profile.pin || profile.password)) {
          if (String(profile.pin || profile.password).trim() === cleanPin) {
            return emp;
          }
        }
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error searching employee profile for PIN:', err);
  }

  // 2. Check OFFICIAL_PIN_MAP fallback
  for (const emp of allEmps) {
    const expected = OFFICIAL_PIN_MAP[emp.id] || OFFICIAL_PIN_MAP[`emp-${emp.id.replace('emp-', '')}`];
    if (expected && expected === cleanPin) {
      return emp;
    }
  }

  return null;
}

// Pending PIN Auth state in Supabase
export async function getPendingPinState(telegramId: string | number): Promise<{ employeeId: string; employeeName: string } | null> {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_pins')
      .maybeSingle();

    if (data?.qr_code) {
      const stateMap = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
      const entry = stateMap[String(telegramId)];
      if (entry && Date.now() < entry.expiresAt) {
        return { employeeId: entry.employeeId, employeeName: entry.employeeName };
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error reading pending PIN:', err);
  }
  return null;
}

export async function setPendingPinState(telegramId: string | number, employeeId: string, employeeName: string) {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_pins')
      .maybeSingle();

    let stateMap: Record<string, any> = {};
    if (data?.qr_code) {
      stateMap = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
    }

    const now = Date.now();
    for (const [k, v] of Object.entries(stateMap)) {
      if (!v?.expiresAt || v.expiresAt < now) {
        delete stateMap[k];
      }
    }

    stateMap[String(telegramId)] = {
      employeeId,
      employeeName,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes expiry
    };

    await supabase.from('warehouses').upsert({
      id: 'ashley_telegram_pending_pins',
      name: 'TELEGRAM_PENDING_PIN_VERIFICATIONS',
      qr_code: JSON.stringify(stateMap),
    }, { onConflict: 'id' });
  } catch (err) {
    logger.error('[TelegramService] Error saving pending PIN:', err);
  }
}

export async function clearPendingPinState(telegramId: string | number) {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_pins')
      .maybeSingle();

    if (data?.qr_code) {
      const stateMap = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
      if (stateMap[String(telegramId)]) {
        delete stateMap[String(telegramId)];
        await supabase.from('warehouses').upsert({
          id: 'ashley_telegram_pending_pins',
          name: 'TELEGRAM_PENDING_PIN_VERIFICATIONS',
          qr_code: JSON.stringify(stateMap),
        }, { onConflict: 'id' });
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error clearing pending PIN:', err);
  }
}

// Fetch all employees from Supabase ashley_employees
export async function getAllEmployees(): Promise<Array<{ id: string; employeeId: string; name: string; role?: string }>> {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employees')
      .maybeSingle();

    if (data?.qr_code) {
      const parsed = JSON.parse(data.qr_code);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          id: e.id,
          employeeId: e.employeeId || e.id.replace('emp-', ''),
          name: e.fullName3Part || e.kurdishName || e.name,
          role: e.role || 'کارمەند',
        }));
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error reading dynamic employees:', err);
  }

  return ASHLEY_OFFICIAL_EMPLOYEES.map(e => ({
    id: e.id,
    employeeId: e.employeeId || e.id.replace('emp-', ''),
    name: e.name,
    role: e.role || 'کارمەند',
  }));
}

// Get full summary of today's attendance for the company
export async function getTodayAttendanceSummary(): Promise<string> {
  const { dateStr } = getBaghdadNow();

  try {
    const { data: attList } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', dateStr)
      .order('check_in_time', { ascending: true });

    let manualMap: Record<string, any> = {};
    try {
      const { data: setRow } = await supabase
        .from('warehouses')
        .select('qr_code')
        .eq('id', 'ashley_manual_attendance_records')
        .maybeSingle();
      if (setRow?.qr_code) {
        manualMap = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      }
    } catch (err) { logger.warn(err); }

    const allEmps = await getAllEmployees();

    let inCount = 0;
    let outCount = 0;
    const rows: string[] = [];

    for (const emp of allEmps) {
      const cleanId = emp.id.replace(/^emp-0*/i, '') || emp.id.replace('emp-', '');
      const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;
      const ov = manualMap[`${emp.id}_${dateStr}`] || manualMap[`${cleanPadded}_${dateStr}`] || manualMap[`${emp.name}_${dateStr}`];
      const rec = (attList || []).find(a => a.user_id === emp.id || a.user_id === `emp-${cleanPadded}` || a.user_name === emp.name);

      const isDeleted = ov?.status === 'empty' || ov?.action === 'delete';
      if (isDeleted) continue;

      const inTime = ov?.checkInTime || rec?.check_in_time;
      const outTime = ov?.checkOutTime || rec?.check_out_time;

      if (inTime) inCount++;
      if (outTime) outCount++;

      if (inTime || outTime) {
        const inLabel = inTime ? `🟢 هاتن: <b>${inTime}</b>` : `⚪ هاتن: --:--`;
        const outLabel = outTime ? `🔴 دەرچوون: <b>${outTime}</b>` : `⚪ دەرچوون: --:--`;
        const loc = rec?.warehouse_name || 'کۆمپانیا';
        rows.push(`👤 <b>${emp.name}</b> (${emp.employeeId})\n   ${inLabel} | ${outLabel}\n   🏢 ${loc}`);
      }
    }

    let text = `📋 <b>لیستی ئامادەبووانی دەوامی ئەمڕۆ (${dateStr}):</b>\n\n`;
    text += `📊 کۆی گشتی هاتوو: <b>${inCount}</b> کارمەند\n`;
    text += `📊 کۆی گشتی دەرچوو: <b>${outCount}</b> کارمەند\n\n`;

    if (rows.length === 0) {
      text += `<i>تا ئێستا هیچ دەوامێک بۆ ئەمڕۆ تۆمار نەکراوە.</i>\n\n`;
    } else {
      text += rows.join('\n\n') + '\n\n';
    }

    text += `🏢 سیستەمی بەڕێوەبردنی دەوامی ئاشڵی`;
    return text;
  } catch (err: any) {
    logger.error('[TelegramService] Error generating summary:', err);
    return `❌ هەڵە ڕوویدا لە هێنانی لیست: ${err.message}`;
  }
}

// Reset today's attendance (for testing or manager correction)
export async function resetTodayAttendance(employeeId: string, employeeName?: string): Promise<boolean> {
  const { dateStr } = getBaghdadNow();
  try {
    await supabase.from('attendance').delete().eq('user_id', employeeId).eq('date', dateStr);
    await supabase.from('attendance_logs').delete().eq('employee_id', employeeId).eq('log_date', dateStr);

    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_manual_attendance_records')
      .maybeSingle();

    if (setRow?.qr_code) {
      let currentOverrides = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      const cleanId = employeeId.toString().replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
      const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;
      const keysToClear = [
        `${cleanId}_${dateStr}`,
        `${cleanPadded}_${dateStr}`,
        `emp-${cleanId}_${dateStr}`,
        `emp-${cleanPadded}_${dateStr}`,
        `${employeeId}_${dateStr}`,
      ];
      if (employeeName) {
        keysToClear.push(`${employeeName}_${dateStr}`);
        keysToClear.push(`${employeeName.trim().toLowerCase()}_${dateStr}`);
      }
      for (const k of keysToClear) {
        delete currentOverrides[k];
      }
      await supabase.from('warehouses').upsert({
        id: 'ashley_manual_attendance_records',
        name: 'MANUAL_ATTENDANCE_OVERRIDES',
        qr_code: JSON.stringify(currentOverrides),
      }, { onConflict: 'id' });
    }
    return true;
  } catch (err) {
    logger.error('[TelegramService] Error resetting today attendance:', err);
    return false;
  }
}

// Telegram Bindings (Mapping telegram_chat_id -> employee)
export async function getTelegramBindings(): Promise<Record<string, { employeeId: string; employeeName: string; linkedAt: string }>> {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_bindings')
      .maybeSingle();

    if (data?.qr_code) {
      return JSON.parse(data.qr_code);
    }
  } catch (err) {
    logger.warn('[TelegramService] Error reading bindings:', err);
  }
  return {};
}

// Save binding with 1-to-1 employee device lock
export async function saveTelegramBinding(
  telegramId: string | number, 
  employeeId: string, 
  employeeName: string,
  force: boolean = false
): Promise<{ success: boolean; error?: string; boundToTelegramId?: string }> {
  try {
    const current = await getTelegramBindings();
    const strTId = String(telegramId);

    // 🔒 Security Check: Check if this employee is already bound to ANOTHER Telegram ID
    for (const [existingTId, info] of Object.entries(current)) {
      if (info.employeeId === employeeId && existingTId !== strTId) {
        if (!force) {
          return {
            success: false,
            error: 'ALREADY_BOUND_TO_ANOTHER',
            boundToTelegramId: existingTId,
          };
        } else {
          // If manager forces unbind of previous device
          delete current[existingTId];
        }
      }
    }

    current[strTId] = {
      employeeId,
      employeeName,
      linkedAt: new Date().toISOString(),
    };

    await supabase.from('warehouses').upsert({
      id: 'ashley_telegram_bindings',
      name: 'TELEGRAM_USER_BINDINGS',
      qr_code: JSON.stringify(current),
    }, { onConflict: 'id' });

    return { success: true };
  } catch (err: any) {
    logger.error('[TelegramService] Error saving binding:', err);
    return { success: false, error: err.message };
  }
}

// Unbind / Unlock employee Telegram account
export async function unbindTelegramAccount(targetEmployeeIdOrChatId: string): Promise<boolean> {
  try {
    const current = await getTelegramBindings();
    let changed = false;

    for (const [chatId, info] of Object.entries(current)) {
      if (info.employeeId === targetEmployeeIdOrChatId || chatId === targetEmployeeIdOrChatId) {
        delete current[chatId];
        changed = true;
      }
    }

    if (changed) {
      await supabase.from('warehouses').upsert({
        id: 'ashley_telegram_bindings',
        name: 'TELEGRAM_USER_BINDINGS',
        qr_code: JSON.stringify(current),
      }, { onConflict: 'id' });
    }

    return changed;
  } catch (err) {
    logger.error('[TelegramService] Error unbinding:', err);
    return false;
  }
}

// Monthly Attendance Report for an employee
export async function getMonthlyAttendanceReport(employeeId: string, employeeName: string, targetMonth?: string): Promise<string> {
  const { dateStr } = getBaghdadNow();
  const monthStr = targetMonth || dateStr.slice(0, 7);

  try {
    const { data: monthRecords } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', employeeId)
      .ilike('date', `${monthStr}%`)
      .order('date', { ascending: true });

    let manualMap: Record<string, any> = {};
    try {
      const { data: setRow } = await supabase
        .from('warehouses')
        .select('qr_code')
        .eq('id', 'ashley_manual_attendance_records')
        .maybeSingle();
      if (setRow?.qr_code) {
        manualMap = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      }
    } catch (err) { logger.warn(err); }

    const cleanId = employeeId.replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
    const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    const dayRows: string[] = [];

    const recordsMap = new Map<string, any>();
    (monthRecords || []).forEach(r => recordsMap.set(r.date, r));

    for (const [key, val] of Object.entries<any>(manualMap)) {
      if (!key.includes(monthStr)) continue;
      if (
        key.startsWith(`${employeeId}_`) ||
        key.startsWith(`${cleanId}_`) ||
        key.startsWith(`${cleanPadded}_`) ||
        key.startsWith(`emp-${cleanPadded}_`) ||
        key.startsWith(`${employeeName}_`)
      ) {
        const d = val.date || key.split('_')[1];
        if (d) {
          recordsMap.set(d, { ...(recordsMap.get(d) || {}), ...val, date: d });
        }
      }
    }

    const sortedDates = Array.from(recordsMap.keys()).sort();

    for (const d of sortedDates) {
      const r = recordsMap.get(d);
      const isDel = r?.status === 'empty' || r?.action === 'delete';
      if (isDel) continue;

      const st = r.status || 'Present';
      const inT = r.checkInTime || r.check_in_time;
      const outT = r.checkOutTime || r.check_out_time;

      if (st === 'Absent' || st === 'غیاب') {
        absentDays++;
        dayRows.push(`❌ <b>${d.slice(5)}</b>: غیاب`);
      } else if (st === 'Leave' || st === 'مۆڵەت') {
        leaveDays++;
        dayRows.push(`🏖️ <b>${d.slice(5)}</b>: مۆڵەت`);
      } else if (st === 'Holiday' || st === 'پشوو') {
        dayRows.push(`🌴 <b>${d.slice(5)}</b>: پشووی فەرمی`);
      } else if (inT || outT) {
        presentDays++;
        const inStr = inT ? `🟢 ${inT}` : '⚪ --:--';
        const outStr = outT ? `🔴 ${outT}` : '⚪ --:--';
        dayRows.push(`📅 <b>${d.slice(5)}</b>: [${inStr} | ${outStr}]`);
      }
    }

    let report = `📅 <b>ڕاپۆرتی دەوامی مانگانە (${monthStr}):</b>\n\n`;
    report += `👤 کارمەند: <b>${employeeName}</b>\n`;
    report += `🏢 بەشی: کۆمپانیای سەرەکی ئاشڵی\n\n`;
    report += `📊 <b>ئاماری گشتی ئەم مانگە:</b>\n`;
    report += `• کۆی ڕۆژانی ئامادەبوو: <b>${presentDays}</b> ڕۆژ\n`;
    if (absentDays > 0) report += `• ڕۆژانی غیاب: <b>${absentDays}</b> ڕۆژ\n`;
    if (leaveDays > 0) report += `• ڕۆژانی مۆڵەت: <b>${leaveDays}</b> ڕۆژ\n`;
    report += `\n`;

    if (dayRows.length > 0) {
      report += `📋 <b>تۆماری ڕۆژەکان:</b>\n`;
      report += dayRows.join('\n') + `\n\n`;
    } else {
      report += `<i>تا ئێستا هیچ تۆمارێکی دەوام بۆ ئەم مانگە تۆمار نەکراوە.</i>\n\n`;
    }

    report += `✨ سیستەمی بەڕێوەبردنی دەوامی ئاشڵی`;
    return report;
  } catch (err: any) {
    logger.error('[TelegramService] Error getting monthly report:', err);
    return `❌ هەڵە لە هێنانی ڕاپۆرتی مانگانە: ${err.message}`;
  }
}

// Save attendance in Supabase
export async function recordAttendance(
  employeeId: string,
  employeeName: string,
  logType: 'check_in' | 'check_out',
  locationName: string
) {
  const { dateStr, timeStr } = getBaghdadNow();

  try {
    const formattedLogType = logType === 'check_in' ? 'Check In' : 'Check Out';
    const nowIso = new Date().toISOString();
    const logId = `telegram-${employeeId}-${dateStr}-${logType === 'check_in' ? 'in' : 'out'}-${Date.now()}`;
    const rowId = `${employeeId}-${dateStr}`;

    // 1. Insert into attendance_logs (with unique id and timestamptz created_at)
    const { error: logErr } = await supabase.from('attendance_logs').insert({
      id: logId,
      employee_id: employeeId,
      employee_name: employeeName,
      log_type: formattedLogType,
      log_date: dateStr,
      log_time_str: timeStr,
      location_address: `${locationName} (تەلەگرام)`,
      created_at: nowIso,
      edit_note: 'لەڕێگەی تەلەگرام',
    });
    if (logErr) {
      logger.error('[TelegramService] Error inserting attendance_logs:', logErr);
    }

    // 2. Fetch existing attendance row for today
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', employeeId)
      .eq('date', dateStr)
      .maybeSingle();

    let attUpsertPayload: any;
    const hasPriorCheckIn = Boolean(existing?.check_in_time);

    if (logType === 'check_in') {
      attUpsertPayload = {
        id: existing?.id || rowId,
        user_id: employeeId,
        user_name: employeeName,
        date: dateStr,
        status: 'Present',
        check_in: existing?.check_in || nowIso,
        check_in_time: existing?.check_in_time || timeStr,
        check_in_address: `${locationName} (تەلەگرام)`,
        check_out: existing?.check_out || null,
        check_out_time: existing?.check_out_time || null,
        warehouse_name: locationName,
      };
    } else {
      // check_out
      attUpsertPayload = {
        id: existing?.id || rowId,
        user_id: employeeId,
        user_name: employeeName,
        date: dateStr,
        status: 'Present',
        check_in: existing?.check_in || null,
        check_in_time: existing?.check_in_time || null,
        check_out: nowIso,
        check_out_time: timeStr,
        check_out_address: `${locationName} (تەلەگرام)`,
        warehouse_name: locationName,
      };
    }

    const { error: attErr } = await supabase
      .from('attendance')
      .upsert(attUpsertPayload, { onConflict: 'id' });

    if (attErr) {
      logger.error('[TelegramService] Error upserting attendance:', attErr);
      return { success: false, error: `هەڵەی داتابەیس: ${attErr.message}` };
    }

    // 3. Sync authoritative mobile & admin overrides store (ashley_manual_attendance_records)
    try {
      const { data: setRow } = await supabase
        .from('warehouses')
        .select('qr_code')
        .eq('id', 'ashley_manual_attendance_records')
        .maybeSingle();

      let currentOverrides: Record<string, any> = {};
      if (setRow?.qr_code) {
        currentOverrides = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      }

      const cleanId = employeeId.toString().replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
      const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;
      const allKeyVars = [
        `${cleanId}_${dateStr}`,
        `${cleanPadded}_${dateStr}`,
        `emp-${cleanId}_${dateStr}`,
        `emp-${cleanPadded}_${dateStr}`,
        `${employeeId}_${dateStr}`,
      ];
      if (employeeName) {
        allKeyVars.push(`${employeeName}_${dateStr}`);
        allKeyVars.push(`${employeeName.trim().toLowerCase()}_${dateStr}`);
      }

      const existingOv = currentOverrides[`${employeeId}_${dateStr}`] || currentOverrides[`${cleanPadded}_${dateStr}`] || {};
      const finalIn = logType === 'check_in' ? timeStr : (existing?.check_in_time || existingOv?.checkInTime || null);
      const finalOut = logType === 'check_out' ? timeStr : (existing?.check_out_time || existingOv?.checkOutTime || null);

      const liveOverride = {
        userId: employeeId,
        userName: employeeName,
        date: dateStr,
        status: 'Present',
        checkInTime: finalIn,
        checkOutTime: finalOut,
        rawCheckIn: finalIn,
        rawCheckOut: finalOut,
        note: 'لەڕێگەی تەلەگرام',
        adminNote: existingOv?.adminNote || '',
        warehouseName: locationName,
        updatedAt: nowIso,
        action: 'update',
      };

      for (const k of allKeyVars) {
        currentOverrides[k] = liveOverride;
      }

      await supabase.from('warehouses').upsert({
        id: 'ashley_manual_attendance_records',
        name: 'MANUAL_ATTENDANCE_OVERRIDES',
        qr_code: JSON.stringify(currentOverrides),
      }, { onConflict: 'id' });
    } catch (whErr) {
      logger.warn('[TelegramService] Error updating overrides:', whErr);
    }

    return { 
      success: true, 
      dateStr, 
      timeStr, 
      missingCheckIn: logType === 'check_out' && !hasPriorCheckIn 
    };
  } catch (err: any) {
    logger.error('[TelegramService] Error recording attendance:', err);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// LEAVE REQUESTS SERVICE
// -------------------------------------------------------------
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  chatId: string | number;
  details: string;
  targetDate?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export async function saveLeaveRequest(
  employeeId: string,
  employeeName: string,
  chatId: string | number,
  details: string
): Promise<LeaveRequest> {
  const reqId = 'leave-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();

  const newReq: LeaveRequest = {
    id: reqId,
    employeeId,
    employeeName,
    chatId,
    details,
    status: 'pending',
    createdAt: nowIso,
  };

  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    let allReqs: Record<string, LeaveRequest> = {};
    if (setRow?.qr_code) {
      allReqs = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
    }
    allReqs[reqId] = newReq;

    await supabase.from('warehouses').upsert({
      id: 'ashley_leave_requests',
      name: 'EMPLOYEE_LEAVE_REQUESTS',
      qr_code: JSON.stringify(allReqs),
    }, { onConflict: 'id' });
  } catch (err) {
    logger.error('[TelegramService] Error saving leave request:', err);
  }

  return newReq;
}

export async function getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    if (setRow?.qr_code) {
      const allReqs = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      return allReqs[requestId] || null;
    }
  } catch (err) {
    logger.error('[TelegramService] Error reading leave request:', err);
  }
  return null;
}

export async function updateLeaveRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected',
  targetDate?: string
): Promise<LeaveRequest | null> {
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    if (!setRow?.qr_code) return null;
    const allReqs = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
    const req = allReqs[requestId];
    if (!req) return null;

    req.status = status;
    allReqs[requestId] = req;

    await supabase.from('warehouses').upsert({
      id: 'ashley_leave_requests',
      name: 'EMPLOYEE_LEAVE_REQUESTS',
      qr_code: JSON.stringify(allReqs),
    }, { onConflict: 'id' });

    // If approved, automatically update manual attendance records as Leave!
    if (status === 'approved') {
      const { dateStr } = getBaghdadNow();
      const dateToApply = targetDate || dateStr;

      try {
        const { data: attRow } = await supabase
          .from('warehouses')
          .select('qr_code')
          .eq('id', 'ashley_manual_attendance_records')
          .maybeSingle();

        let currentOverrides = {};
        if (attRow?.qr_code) {
          currentOverrides = typeof attRow.qr_code === 'string' ? JSON.parse(attRow.qr_code) : attRow.qr_code;
        }

        const cleanId = req.employeeId.replace(/^emp-0*/i, '') || req.employeeId.replace('emp-', '');
        const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;

        const keysToUpdate = [
          `${cleanId}_${dateToApply}`,
          `${cleanPadded}_${dateToApply}`,
          `emp-${cleanId}_${dateToApply}`,
          `emp-${cleanPadded}_${dateToApply}`,
          `${req.employeeId}_${dateToApply}`,
          `${req.employeeName}_${dateToApply}`,
        ];

        const leaveRecord = {
          userId: req.employeeId,
          userName: req.employeeName,
          date: dateToApply,
          status: 'Leave',
          checkInTime: null,
          checkOutTime: null,
          note: `مۆڵەتی فەرمی: ${req.details}`,
          adminNote: 'مۆڵەت لە ڕێگەی تەلەگرامەوە پەسەندکرا',
          updatedAt: new Date().toISOString(),
          action: 'update',
        };

        for (const k of keysToUpdate) {
          (currentOverrides as any)[k] = leaveRecord;
        }

        await supabase.from('warehouses').upsert({
          id: 'ashley_manual_attendance_records',
          name: 'MANUAL_ATTENDANCE_OVERRIDES',
          qr_code: JSON.stringify(currentOverrides),
        }, { onConflict: 'id' });
      } catch (attErr) {
        logger.warn('[TelegramService] Error updating leave to attendance:', attErr);
      }
    }

    return req;
  } catch (err) {
    logger.error('[TelegramService] Error updating leave status:', err);
    return null;
  }
}

// -------------------------------------------------------------
// PROFILE & PHOTO MANAGEMENT
// -------------------------------------------------------------
export async function getEmployeeProfileDetails(employeeId: string) {
  const allEmps = await getAllEmployees();
  const emp = allEmps.find(e => e.id === employeeId || e.employeeId === employeeId);

  let profileData: any = {};
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();

    if (setRow?.qr_code) {
      const profiles = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      const rawNum = employeeId.replace('emp-', '');
      profileData = profiles[employeeId] || profiles[rawNum] || profiles[`emp-${rawNum}`] || {};
    }
  } catch (err) {
    logger.warn('[TelegramService] Error fetching employee profile:', err);
  }

  return {
    id: employeeId,
    name: emp?.name || profileData.name || 'کارمەندی ئاشڵی',
    role: emp?.role || profileData.role || 'کارمەند',
    department: profileData.department || 'کۆمپانیای سەرەکی ئاشڵی',
    photoUrl: profileData.photoUrl || profileData.avatar || null,
    shift: profileData.shift || '08:00 - 17:00 (١٥ خولەک لێخۆشبوون)',
    phone: profileData.phone || profileData.phoneNumber || null,
  };
}

export async function approveEmployeePhoto(employeeId: string, photoUrl: string): Promise<boolean> {
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();

    let profiles: Record<string, any> = {};
    if (setRow?.qr_code) {
      profiles = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
    }

    const rawNum = employeeId.replace('emp-', '');
    const current = profiles[employeeId] || profiles[rawNum] || profiles[`emp-${rawNum}`] || {};
    current.photoUrl = photoUrl;
    current.avatar = photoUrl;
    current.updatedAt = new Date().toISOString();

    profiles[employeeId] = current;
    profiles[`emp-${rawNum}`] = current;

    await supabase.from('warehouses').upsert({
      id: 'ashley_employee_profiles',
      name: 'EMPLOYEE_PROFILES',
      qr_code: JSON.stringify(profiles),
    }, { onConflict: 'id' });

    return true;
  } catch (err) {
    logger.error('[TelegramService] Error approving employee photo:', err);
    return false;
  }
}

// -------------------------------------------------------------
// BROADCAST ANNOUNCEMENT TO ALL BOUND TELEGRAM EMPLOYEES
// -------------------------------------------------------------
export async function broadcastAnnouncement(
  messageText: string,
  senderName: string = 'کاک دارکۆ'
): Promise<{ total: number; sent: number }> {
  const bindings = await getTelegramBindings();
  const chatIds = Object.keys(bindings);

  const formattedMsg =
    `📢 <b>ئاگاداری فەرمی لە بەڕێوەبەرایەتی کۆمپانیای ئاشڵی</b>\n` +
    `نێردراو لە لایەن: <b>${senderName}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${messageText}\n\n` +
    `🏢 <b>کۆمپانیای ئاشڵی بۆ مۆبیلیات</b>`;

  let sent = 0;
  for (const chatId of chatIds) {
    try {
      const res = await sendTelegramMessage(chatId, formattedMsg);
      if (res && res.ok) sent++;
    } catch (e) {
      logger.warn(`[TelegramService] Broadcast failed for chatId ${chatId}:`, e);
    }
  }

  return { total: chatIds.length, sent };
}
