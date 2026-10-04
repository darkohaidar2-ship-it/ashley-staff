import { supabase } from '@/lib/supabase/client';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';
import { logger } from '@/lib/logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8898240606:AAGKTldXKyJEIfGL8ggU42MlvJclgZVIa1c';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
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

// Keyboards
export function getMainReplyKeyboard() {
  return {
    keyboard: [
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
        { text: 'ℹ️ شوێنەکانی دەوام' },
      ],
      [
        { text: '🔄 گۆڕینی هەژمار / لیست' },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function getLocationRequestKeyboard() {
  return {
    keyboard: [
      [
        {
          text: '📍 ناردنی لۆکەیشنی دەوام (GPS)',
          request_location: true,
        },
      ],
      [
        { text: '⚡ تۆمارکردنی خێرا (بەبێ GPS)' },
        { text: '❌ هەڵوەشاندنەوە' },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
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
    await supabase.from('attendance_logs').insert({
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

    // 2. Fetch existing attendance row for today
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', employeeId)
      .eq('date', dateStr)
      .maybeSingle();

    if (logType === 'check_in') {
      await supabase
        .from('attendance')
        .upsert({
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
        });
    } else {
      // check_out
      await supabase
        .from('attendance')
        .upsert({
          id: existing?.id || rowId,
          user_id: employeeId,
          user_name: employeeName,
          date: dateStr,
          status: 'Present',
          check_in: existing?.check_in || nowIso,
          check_in_time: existing?.check_in_time || '08:00',
          check_out: nowIso,
          check_out_time: timeStr,
          check_out_address: `${locationName} (تەلەگرام)`,
          warehouse_name: locationName,
        });
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
      const finalIn = logType === 'check_in' ? timeStr : (existing?.check_in_time || existingOv?.checkInTime || '08:00');
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
        adminNote: '',
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
      logger.warn('[TelegramService] Error syncing to manual overrides:', whErr);
    }

    return { success: true, dateStr, timeStr };
  } catch (err: any) {
    logger.error('[TelegramService] Error recording attendance:', err);
    return { success: false, error: err.message };
  }
}
