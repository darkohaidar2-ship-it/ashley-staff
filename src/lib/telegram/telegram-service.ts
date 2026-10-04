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
        { text: 'ℹ️ شوێنەکانی دەوام' },
      ],
      [
        { text: '🔄 نوێکردنەوە یان گۆڕینی هەژمار' },
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
        { text: '❌ هەڵوەشاندنەوە' },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
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

export async function saveTelegramBinding(telegramId: string | number, employeeId: string, employeeName: string) {
  try {
    const current = await getTelegramBindings();
    current[String(telegramId)] = {
      employeeId,
      employeeName,
      linkedAt: new Date().toISOString(),
    };

    await supabase.from('warehouses').upsert({
      id: 'ashley_telegram_bindings',
      name: 'TELEGRAM_USER_BINDINGS',
      qr_code: JSON.stringify(current),
    }, { onConflict: 'id' });

    return true;
  } catch (err) {
    logger.error('[TelegramService] Error saving binding:', err);
    return false;
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
    // 1. Insert into attendance_logs
    await supabase.from('attendance_logs').insert({
      employee_id: employeeId,
      employee_name: employeeName,
      log_type: logType,
      log_date: dateStr,
      log_time_str: timeStr,
      location_address: `${locationName} (تەلەگرام)`,
      created_at: new Date().toISOString(),
    });

    // 2. Check if row exists in attendance for today
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', employeeId)
      .eq('date', dateStr)
      .maybeSingle();

    if (logType === 'check_in') {
      if (existing) {
        await supabase
          .from('attendance')
          .update({
            check_in_time: timeStr,
            check_in_address: locationName,
            status: 'present',
            warehouse_name: locationName,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('attendance')
          .insert({
            user_id: employeeId,
            user_name: employeeName,
            date: dateStr,
            status: 'present',
            check_in_time: timeStr,
            check_in_address: locationName,
            warehouse_name: locationName,
          });
      }
    } else {
      // check_out
      if (existing) {
        await supabase
          .from('attendance')
          .update({
            check_out_time: timeStr,
            check_out_address: locationName,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('attendance')
          .insert({
            user_id: employeeId,
            user_name: employeeName,
            date: dateStr,
            status: 'present',
            check_out_time: timeStr,
            check_out_address: locationName,
            warehouse_name: locationName,
          });
      }
    }

    return { success: true, dateStr, timeStr };
  } catch (err: any) {
    logger.error('[TelegramService] Error recording attendance:', err);
    return { success: false, error: err.message };
  }
}
