import { supabase } from '@/lib/supabase/client';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';
import { logger } from '@/lib/logger';
import { resolveEmployeeRole, UserRole, getActionRecipients } from '@/lib/workflow/workflow-service';

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

// Telegram API photo sender (supports base64 data URLs, Telegram file_id, and HTTP URLs)
export async function sendTelegramPhoto(
  chatId: number | string,
  photo: string,
  caption?: string,
  replyMarkup?: any
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    // 1. Handle base64 Data URLs via multipart/form-data
    if (photo && photo.startsWith('data:')) {
      const commaIdx = photo.indexOf(',');
      if (commaIdx > -1) {
        const header = photo.substring(0, commaIdx);
        const base64Data = photo.substring(commaIdx + 1);
        const mimeMatch = header.match(/^data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', blob, 'profile.jpg');
        if (caption) {
          formData.append('caption', caption);
          formData.append('parse_mode', 'HTML');
        }
        if (replyMarkup) {
          formData.append('reply_markup', JSON.stringify(replyMarkup));
        }

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        const result = await res.json();
        if (result?.ok) return result;
        logger.warn('[TelegramService] sendPhoto with base64 FormData failed:', result);
      }
    }

    // 2. Handle standard URL or Telegram file_id
    let resolvedPhoto = photo;
    if (resolvedPhoto && resolvedPhoto.startsWith('/')) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ashley-staff.vercel.app';
      resolvedPhoto = `${baseUrl.replace(/\/$/, '')}${resolvedPhoto}`;
    }

    const payload: any = {
      chat_id: chatId,
      photo: resolvedPhoto,
      parse_mode: 'HTML',
    };
    if (caption) payload.caption = caption;
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!result?.ok) {
      logger.warn('[TelegramService] sendTelegramPhoto returned not ok:', result);
      // Try fallback to Ashley company logo if photo URL failed
      if (resolvedPhoto && resolvedPhoto !== 'https://ashley-staff.vercel.app/logo.png') {
        try {
          const fallbackPayload: any = {
            chat_id: chatId,
            photo: 'https://ashley-staff.vercel.app/logo.png',
            parse_mode: 'HTML',
          };
          if (caption) fallbackPayload.caption = caption;
          if (replyMarkup) fallbackPayload.reply_markup = replyMarkup;
          const fbRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload),
          });
          const fbResult = await fbRes.json();
          if (fbResult?.ok) return fbResult;
        } catch (e) {
          logger.warn('[TelegramService] Fallback logo photo failed:', e);
        }
      }
      if (caption) {
        return await sendTelegramMessage(chatId, caption, replyMarkup);
      }
    }
    return result;
  } catch (err) {
    logger.error('[TelegramService] sendTelegramPhoto error:', err);
    if (caption) {
      return await sendTelegramMessage(chatId, caption, replyMarkup);
    }
    return null;
  }
}

// Fetch user's Telegram profile photo (returns file_id of largest resolution)
export async function getUserTelegramProfilePhoto(userId: number | string): Promise<string | null> {
  const token = getBotToken();
  if (!token) return null;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    const data = await res.json();
    if (data?.ok && data.result?.total_count > 0 && Array.isArray(data.result.photos) && data.result.photos.length > 0) {
      const photoVariants = data.result.photos[0];
      if (Array.isArray(photoVariants) && photoVariants.length > 0) {
        const largest = photoVariants[photoVariants.length - 1];
        return largest.file_id;
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error getting user profile photos:', err);
  }
  return null;
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

// Edit existing photo message caption & inline keyboard
export async function editTelegramCaption(
  chatId: number | string,
  messageId: number | string,
  caption: string,
  replyMarkup?: any
) {
  const token = getBotToken();
  if (!token) return null;

  try {
    const payload: any = {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: 'HTML',
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    logger.error('[TelegramService] editTelegramCaption error:', err);
    return null;
  }
}

// Unified card editor: works for both photo messages and text messages
export async function editTelegramCard(
  chatId: number | string,
  messageId: number | string,
  textOrCaption: string,
  replyMarkup?: any
) {
  const resCap = await editTelegramCaption(chatId, messageId, textOrCaption, replyMarkup);
  if (resCap && resCap.ok) return resCap;
  return await editTelegramMessage(chatId, messageId, textOrCaption, replyMarkup);
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
// -------------------------------------------------------------
// DYNAMIC ROLE-BASED KEYBOARDS
// -------------------------------------------------------------
export function getRoleBasedReplyKeyboard(role: UserRole = 'employee') {
  // 1. FOUNDER (کاک دارکۆ حەیدەر) - Full Super Admin Access
  if (role === 'founder') {
    return {
      keyboard: [
        [
          { text: '🟢 تۆمارکردنی هاتن' },
          { text: '🔴 تۆمارکردنی دەرچوون' },
        ],
        [
          { text: '📊 دۆخی دەوامی ئەمڕۆم' },
          { text: '📅 دۆخی دەوامی ئەم مانگەم' },
        ],
        [
          { text: '👤 پرۆفایلی من' },
          { text: '⚡ تۆمارکردنی خێرا (دامەزرێنەر)' },
        ],
        [
          { text: '📋 لیستی گشتی دەوام' },
          { text: '🏖️ داواکارییەکانی مۆڵەت' },
        ],
        [
          { text: '❌ تۆمارکردنی غیاب' },
          { text: '🌴 دیاریکردنی پشوو' },
        ],
        [
          { text: '📢 ناردنی ئاگاداری گشتی' },
          { text: '📱 بەستنەوەی ئامێرەکان' },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // 2. WAREHOUSE MANAGER (کاک کامەران عومەر) - Warehouse Authority
  if (role === 'warehouse_manager') {
    return {
      keyboard: [
        [
          { text: '🟢 تۆمارکردنی هاتن' },
          { text: '🔴 تۆمارکردنی دەرچوون' },
        ],
        [
          { text: '📊 دۆخی دەوامی ئەمڕۆم' },
          { text: '📅 دۆخی دەوامی ئەم مانگەم' },
        ],
        [
          { text: '👤 پرۆفایلی من' },
          { text: '📦 ئامادەبووانی کۆگا' },
        ],
        [
          { text: '🏖️ داواکارییەکانی مۆڵەت' },
          { text: '❌ تۆمارکردنی غیاب' },
        ],
        [
          { text: '🌴 دیاریکردنی پشوو' },
          { text: 'ℹ️ شوێنەکانی دەوام' },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // 3. GENERAL MANAGER (مامۆستا وەلید)
  if (role === 'general_manager') {
    return {
      keyboard: [
        [
          { text: '🟢 تۆمارکردنی هاتن' },
          { text: '🔴 تۆمارکردنی دەرچوون' },
        ],
        [
          { text: '📊 دۆخی دەوامی ئەمڕۆم' },
          { text: '📅 دۆخی دەوامی ئەم مانگەم' },
        ],
        [
          { text: '👤 پرۆفایلی من' },
          { text: '📋 لیستی گشتی دەوام' },
        ],
        [
          { text: '🏖️ داواکارییەکانی مۆڵەت' },
          { text: '📢 ناردنی ئاگاداری گشتی' },
        ],
        [
          { text: '🌴 دیاریکردنی پشوو' },
          { text: 'ℹ️ شوێنەکانی دەوام' },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // 4. IT SUPPORT (بەشی ئایتی)
  if (role === 'it_admin') {
    return {
      keyboard: [
        [
          { text: '🟢 تۆمارکردنی هاتن' },
          { text: '🔴 تۆمارکردنی دەرچوون' },
        ],
        [
          { text: '📊 دۆخی دەوامی ئەمڕۆم' },
          { text: '📅 دۆخی دەوامی ئەم مانگەم' },
        ],
        [
          { text: '👤 پرۆفایلی من' },
          { text: '📱 بەستنەوەی ئامێرەکان' },
        ],
        [
          { text: '🔍 پشکنینی سیستەم' },
          { text: 'ℹ️ شوێنەکانی دەوام' },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // 5. SUPERVISOR (سەرپەرشتیاری بەش)
  if (role === 'supervisor') {
    return {
      keyboard: [
        [
          { text: '🟢 تۆمارکردنی هاتن' },
          { text: '🔴 تۆمارکردنی دەرچوون' },
        ],
        [
          { text: '📊 دۆخی دەوامی ئەمڕۆم' },
          { text: '📅 دۆخی دەوامی ئەم مانگەم' },
        ],
        [
          { text: '👤 پرۆفایلی من' },
          { text: '📋 لیستی ئامادەبووانی ئەمڕۆ' },
        ],
        [
          { text: '🏖️ داواکردنی مۆڵەت' },
          { text: 'ℹ️ شوێنەکانی دەوام' },
        ],
      ],
      resize_keyboard: true,
      is_persistent: true,
    };
  }

  // 6. DEFAULT REGULAR EMPLOYEE (کارمەندی ئاسایی)
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
        { text: '👤 پرۆفایلی من' },
      ],
      [
        { text: '🏖️ داواکردنی مۆڵەت' },
        { text: 'ℹ️ شوێنەکانی دەوام' },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function getMainReplyKeyboard(roleOrManager: UserRole | boolean = 'employee') {
  const role: UserRole = typeof roleOrManager === 'boolean'
    ? (roleOrManager ? 'founder' : 'employee')
    : roleOrManager;
  return getRoleBasedReplyKeyboard(role);
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
// LEAVE REQUESTS, ABSENCE & HOLIDAY MANAGEMENT
// -------------------------------------------------------------
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  chatId: string | number;
  details: string;
  targetDate?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt: string;
}

// Convert Kurdish / Arabic numerals (۰-۹ / ٠-٩) to English digits
export function normalizeNumerals(str: string): string {
  const kurdishDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let res = str || '';
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(kurdishDigits[i], String(i)).replaceAll(persianDigits[i], String(i));
  }
  return res;
}

// Smart date parser from Kurdish text (supports 11-10-2026, 2026-10-11, 11/10/2026, سبەی, etc.)
export function parseTargetDateFromText(rawText: string): string {
  const text = normalizeNumerals(rawText || '').trim();
  const { dateStr } = getBaghdadNow();

  // 1. Check for DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (e.g. 11-10-2026)
  const dmyMatch = text.match(/\b([0-3]?\d)[-/.]([0-1]?\d)[-/.]((?:202|203)\d)\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 2. Check for YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-10-11)
  const ymdMatch = text.match(/\b((?:202|203)\d)[-/.]([0-1]?\d)[-/.]([0-3]?\d)\b/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 3. Kurdish relative dates
  if (text.includes('سبەی') || text.includes('سبەینێ') || text.includes('بەیانی')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (text.includes('دووسبەی')) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  return dateStr;
}

export async function saveLeaveRequest(
  employeeId: string,
  employeeName: string,
  chatId: string | number,
  details: string,
  customTargetDate?: string
): Promise<LeaveRequest> {
  const reqId = 'leave-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const nowIso = new Date().toISOString();
  const targetDate = customTargetDate || parseTargetDateFromText(details);

  const newReq: LeaveRequest = {
    id: reqId,
    employeeId,
    employeeName,
    chatId,
    details,
    targetDate,
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
  approverName: string = 'بەڕێوەبەر',
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
    req.approvedBy = approverName;
    allReqs[requestId] = req;

    await supabase.from('warehouses').upsert({
      id: 'ashley_leave_requests',
      name: 'EMPLOYEE_LEAVE_REQUESTS',
      qr_code: JSON.stringify(allReqs),
    }, { onConflict: 'id' });

    // If approved, synchronize BOTH manual attendance records AND supabase attendance table!
    if (status === 'approved') {
      const { dateStr } = getBaghdadNow();
      const dateToApply = targetDate || req.targetDate || parseTargetDateFromText(req.details) || dateStr;

      try {
        // 1. Update manual attendance overrides
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
          adminNote: `مۆڵەت پەسەندکرا لەلایەن: ${approverName}`,
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

        // 2. Direct Sync into Supabase attendance table (Crucial for Web ERP Matrix Table)
        const rowId = `${req.employeeId}-${dateToApply}`;
        await supabase.from('attendance').upsert({
          id: rowId,
          user_id: req.employeeId,
          user_name: req.employeeName,
          date: dateToApply,
          status: 'Leave',
          check_in: null,
          check_in_time: null,
          check_out: null,
          check_out_time: null,
          warehouse_name: 'مۆڵەتی فەرمی',
          check_in_address: `مۆڵەت: ${req.details}`,
        }, { onConflict: 'id' });

        // 3. Insert audit log in attendance_logs
        await supabase.from('attendance_logs').insert({
          id: `leave-log-${req.employeeId}-${dateToApply}-${Date.now()}`,
          employee_id: req.employeeId,
          employee_name: req.employeeName,
          log_type: 'Leave',
          log_date: dateToApply,
          log_time_str: '08:00',
          location_address: `مۆڵەتی فەرمی: ${req.details}`,
          created_at: new Date().toISOString(),
          edit_note: `مۆڵەت پەسەندکرا لەلایەن: ${approverName}`,
        });

        logger.info(`[TelegramService] Successfully recorded Leave for ${req.employeeName} on ${dateToApply}`);
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
// MARK ABSENCE (تۆمارکردنی غیاب - بۆ کاک کامەران و بەڕێوەبەر)
// -------------------------------------------------------------
export async function markEmployeeAbsent(
  employeeId: string,
  employeeName: string,
  targetDate: string,
  managerName: string = 'کاک کامەران'
): Promise<boolean> {
  try {
    const rowId = `${employeeId}-${targetDate}`;

    // 1. Supabase attendance table
    await supabase.from('attendance').upsert({
      id: rowId,
      user_id: employeeId,
      user_name: employeeName,
      date: targetDate,
      status: 'Absent',
      check_in: null,
      check_in_time: null,
      check_out: null,
      check_out_time: null,
      warehouse_name: 'غیاب',
      check_in_address: `غیاب تۆمارکرا لەلایەن: ${managerName}`,
    }, { onConflict: 'id' });

    // 2. Manual attendance overrides
    const { data: attRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_manual_attendance_records')
      .maybeSingle();

    let currentOverrides = {};
    if (attRow?.qr_code) {
      currentOverrides = typeof attRow.qr_code === 'string' ? JSON.parse(attRow.qr_code) : attRow.qr_code;
    }

    const cleanId = employeeId.replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
    const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;

    const keysToUpdate = [
      `${cleanId}_${targetDate}`,
      `${cleanPadded}_${targetDate}`,
      `emp-${cleanId}_${targetDate}`,
      `emp-${cleanPadded}_${targetDate}`,
      `${employeeId}_${targetDate}`,
      `${employeeName}_${targetDate}`,
    ];

    const absRecord = {
      userId: employeeId,
      userName: employeeName,
      date: targetDate,
      status: 'Absent',
      checkInTime: null,
      checkOutTime: null,
      note: `غیاب لەلایەن ${managerName} تۆمارکرا`,
      adminNote: `غیابی فەرمی لە تەلەگرام`,
      updatedAt: new Date().toISOString(),
      action: 'update',
    };

    for (const k of keysToUpdate) {
      (currentOverrides as any)[k] = absRecord;
    }

    await supabase.from('warehouses').upsert({
      id: 'ashley_manual_attendance_records',
      name: 'MANUAL_ATTENDANCE_OVERRIDES',
      qr_code: JSON.stringify(currentOverrides),
    }, { onConflict: 'id' });

    // 3. Attendance log
    await supabase.from('attendance_logs').insert({
      id: `abs-log-${employeeId}-${targetDate}-${Date.now()}`,
      employee_id: employeeId,
      employee_name: employeeName,
      log_type: 'Absent',
      log_date: targetDate,
      log_time_str: '08:00',
      location_address: `غیاب لەلایەن ${managerName} تۆمارکرا`,
      created_at: new Date().toISOString(),
      edit_note: `غیاب تۆمارکرا لەلایەن ${managerName}`,
    });

    return true;
  } catch (err) {
    logger.error('[TelegramService] Error marking employee absent:', err);
    return false;
  }
}

// -------------------------------------------------------------
// SET COMPANY HOLIDAY (دیاریکردنی پشووی فەرمی کۆمپانیا)
// -------------------------------------------------------------
export async function setCompanyHoliday(
  targetDate: string,
  holidayName: string = 'پشووی فەرمی',
  managerName: string = 'کاک کامەران'
): Promise<boolean> {
  try {
    const allEmps = await getAllEmployees();

    const { data: attRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_manual_attendance_records')
      .maybeSingle();

    let currentOverrides = {};
    if (attRow?.qr_code) {
      currentOverrides = typeof attRow.qr_code === 'string' ? JSON.parse(attRow.qr_code) : attRow.qr_code;
    }

    for (const emp of allEmps) {
      const rowId = `${emp.id}-${targetDate}`;

      await supabase.from('attendance').upsert({
        id: rowId,
        user_id: emp.id,
        user_name: emp.name,
        date: targetDate,
        status: 'Holiday',
        check_in: null,
        check_in_time: null,
        check_out: null,
        check_out_time: null,
        warehouse_name: 'پشوو',
        check_in_address: `${holidayName} (لەلایەن: ${managerName})`,
      }, { onConflict: 'id' });

      const cleanId = emp.id.replace(/^emp-0*/i, '') || emp.id.replace('emp-', '');
      const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;

      const keysToUpdate = [
        `${cleanId}_${targetDate}`,
        `${cleanPadded}_${targetDate}`,
        `emp-${cleanId}_${targetDate}`,
        `emp-${cleanPadded}_${targetDate}`,
        `${emp.id}_${targetDate}`,
        `${emp.name}_${targetDate}`,
      ];

      const holRecord = {
        userId: emp.id,
        userName: emp.name,
        date: targetDate,
        status: 'Holiday',
        checkInTime: null,
        checkOutTime: null,
        note: holidayName,
        adminNote: `پشووی فەرمی دیاریکرا لەلایەن: ${managerName}`,
        updatedAt: new Date().toISOString(),
        action: 'update',
      };

      for (const k of keysToUpdate) {
        (currentOverrides as any)[k] = holRecord;
      }
    }

    await supabase.from('warehouses').upsert({
      id: 'ashley_manual_attendance_records',
      name: 'MANUAL_ATTENDANCE_OVERRIDES',
      qr_code: JSON.stringify(currentOverrides),
    }, { onConflict: 'id' });

    return true;
  } catch (err) {
    logger.error('[TelegramService] Error setting holiday:', err);
    return false;
  }
}

// -------------------------------------------------------------
// GET WAREHOUSE ATTENDANCE SUMMARY (ئامادەبووانی کۆگا - کاک کامەران)
// -------------------------------------------------------------
export async function getWarehouseAttendanceSummary(): Promise<string> {
  const { dateStr } = getBaghdadNow();
  const summary = await getTodayAttendanceSummary();
  return `📦 <b>لیستی ئامادەبووانی بەشی کۆگا و کارگە (${dateStr}):</b>\n\n` + summary;
}

// -------------------------------------------------------------
// PROFILE & PHOTO MANAGEMENT
// -------------------------------------------------------------
export async function getEmployeeProfileDetails(employeeId: string) {
  const allEmps = await getAllEmployees();
  const rawNum = employeeId.replace('emp-', '');
  const emp = allEmps.find(e => 
    e.id === employeeId || 
    e.employeeId === employeeId || 
    e.id === `emp-${rawNum}` || 
    e.employeeId === rawNum ||
    e.id === `emp-0${rawNum}` ||
    e.employeeId === `0${rawNum}`
  );

  let profileData: any = {};
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();

    if (setRow?.qr_code) {
      const profiles = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
      profileData = profiles[employeeId] || profiles[rawNum] || profiles[`emp-${rawNum}`] || (emp?.employeeId ? profiles[emp.employeeId] : {}) || {};
    }
  } catch (err) {
    logger.warn('[TelegramService] Error fetching employee profile:', err);
  }

  const officialEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => 
    e.id === employeeId || 
    e.employeeId === employeeId || 
    e.id === `emp-${rawNum}` ||
    e.employeeId === rawNum
  );

  return {
    id: emp?.id || employeeId,
    employeeId: emp?.employeeId || rawNum,
    name: emp?.name || officialEmp?.name || profileData.name || 'کارمەندی ئاشڵی',
    role: emp?.role || profileData.role || officialEmp?.role || 'کارمەند',
    department: profileData.department || profileData.branch || 'کۆمپانیای سەرەکی ئاشڵی',
    photoUrl: (profileData.photoUrl || profileData.avatar || profileData.photo || null),
    shift: profileData.shift || '08:00 - 17:00 (١٥ خولەک لێخۆشبوون)',
    phone: profileData.phone || profileData.phoneNumber || officialEmp?.phone || '',
    address: profileData.address || profileData.location || '',
    bloodType: profileData.bloodType || profileData.bloodGroup || '',
    emergencyContact: profileData.emergencyContact || profileData.emergencyPhone || '',
  };
}

export function formatProfileCard(profile: {
  id: string;
  employeeId?: string;
  name: string;
  role: string;
  department: string;
  photoUrl?: string | null;
  shift: string;
  phone?: string;
  address?: string;
  bloodType?: string;
  emergencyContact?: string;
}) {
  const phoneText = profile.phone ? `<code>${profile.phone}</code>` : '<i>(دیاری نەکراوە)</i>';
  const addressText = profile.address ? `<b>${profile.address}</b>` : '<i>(دیاری نەکراوە)</i>';
  const bloodText = profile.bloodType ? `<b>${profile.bloodType}</b>` : '<i>(دیاری نەکراوە)</i>';
  const emergencyText = profile.emergencyContact ? `<code>${profile.emergencyContact}</code>` : '';

  let msg = `👤 <b>پرۆفایلی فەرمی کارمەند</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `• 👤 ناو: <b>${profile.name}</b> 🔒 <i>(نەگۆڕ)</i>\n`;
  msg += `• 🆔 کۆدی کارمەند: <b>${profile.id}</b> 🔒 <i>(نەگۆڕ)</i>\n`;
  msg += `• 💼 پلە و ڕۆڵ: <b>${profile.role}</b>\n`;
  msg += `• 🏢 بەش / لق: <b>${profile.department}</b>\n`;
  msg += `• 📞 ژمارەی مۆبایل: ${phoneText}\n`;
  msg += `• 📍 ناونیشان: ${addressText}\n`;
  msg += `• 🩸 گرووپی خوێن: ${bloodText}\n`;
  if (emergencyText) {
    msg += `• 🚨 پەیوەندی فریاگوزاری: ${emergencyText}\n`;
  }
  msg += `• ⏰ کاتژمێری دەوام: <b>${profile.shift}</b>\n`;
  msg += `• 🔒 دۆخی ئامێر: <b>قوفڵکراوە بۆ ئەم تەلەگرامە</b>\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💡 <i>دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە پرۆفایلەکەت دەستکاری بکەیت و تەواوی بکەیت:</i>`;

  return msg;
}

export function getProfileInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📸 گۆڕینی وێنە', callback_data: 'prof:photo' },
        { text: '📞 گۆڕینی مۆبایل', callback_data: 'prof:phone' },
      ],
      [
        { text: '📍 گۆڕینی ناونیشان', callback_data: 'prof:address' },
        { text: '🩸 گرووپی خوێن', callback_data: 'prof:blood' },
      ],
      [
        { text: '🏢 بەش / لق', callback_data: 'prof:dept' },
        { text: '🔄 نوێکردنەوەی پرۆفایل', callback_data: 'prof:refresh' },
      ],
    ],
  };
}

export function getBloodGroupKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🅰️ A+', callback_data: 'set_blood:A+' },
        { text: '🅰️ A-', callback_data: 'set_blood:A-' },
        { text: '🅱️ B+', callback_data: 'set_blood:B+' },
        { text: '🅱️ B-', callback_data: 'set_blood:B-' },
      ],
      [
        { text: '🆎 AB+', callback_data: 'set_blood:AB+' },
        { text: '🆎 AB-', callback_data: 'set_blood:AB-' },
        { text: '🅾️ O+', callback_data: 'set_blood:O+' },
        { text: '🅾️ O-', callback_data: 'set_blood:O-' },
      ],
      [
        { text: '🔙 گەڕانەوە بۆ پرۆفایل', callback_data: 'prof:refresh' },
      ],
    ],
  };
}

export function getDepartmentKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🏢 پێشانگای سەرەکی (Showroom)', callback_data: 'set_dept:پێشانگای سەرەکی' },
      ],
      [
        { text: '🏭 کارگە و دروستکردن', callback_data: 'set_dept:کارگە و دروستکردن' },
      ],
      [
        { text: '📦 کۆگای سەرەکی', callback_data: 'set_dept:کۆگای سەرەکی' },
      ],
      [
        { text: '🛠️ بەشی چاککردنەوە و ڕاگرتن', callback_data: 'set_dept:بەشی چاککردنەوە' },
      ],
      [
        { text: '💼 کارگێڕی و ژمێریاری', callback_data: 'set_dept:کارگێڕی و ژمێریاری' },
      ],
      [
        { text: '🔙 گەڕانەوە بۆ پرۆفایل', callback_data: 'prof:refresh' },
      ],
    ],
  };
}

// 🔒 STRICT SECURITY CONSTRAINT: IMMUTABLE IDENTITY FIELDS
const IMMUTABLE_PROFILE_FIELDS = ['name', 'fullName3Part', 'kurdishName', 'id', 'employeeId', 'pin', 'password'];

export async function updateEmployeeProfileField(
  employeeId: string,
  field: string,
  value: any
): Promise<{ success: boolean; error?: string }> {
  // 🔒 REJECT ANY ATTEMPT TO ALTER NAME OR ID
  if (IMMUTABLE_PROFILE_FIELDS.includes(field)) {
    logger.warn(`[TelegramService] BLOCKED attempt to edit immutable field "${field}" for employee ${employeeId}`);
    return {
      success: false,
      error: 'ببورە! ناوی کارمەند و کۆدی کارمەند نەگۆڕن و پارێزراون.',
    };
  }

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

    current[field] = value;
    if (field === 'photoUrl') {
      current.avatar = value;
      current.photo = value;
    }
    if (field === 'phone') {
      current.phoneNumber = value;
    }
    current.updatedAt = new Date().toISOString();

    profiles[employeeId] = current;
    profiles[`emp-${rawNum}`] = current;
    profiles[rawNum] = current;

    await supabase.from('warehouses').upsert({
      id: 'ashley_employee_profiles',
      name: 'EMPLOYEE_PROFILES',
      qr_code: JSON.stringify(profiles),
    }, { onConflict: 'id' });

    // Sync to users table if applicable
    try {
      const uPayload: any = {};
      if (field === 'phone') uPayload.phone = value;
      if (field === 'address') uPayload.address = value;
      if (field === 'photoUrl') uPayload.avatar = value;
      if (Object.keys(uPayload).length > 0) {
        await supabase.from('users').update(uPayload).eq('id', employeeId);
      }
    } catch (uErr) {
      logger.warn('[TelegramService] Users table sync note:', uErr);
    }

    return { success: true };
  } catch (err: any) {
    logger.error('[TelegramService] Error updating employee profile field:', err);
    return { success: false, error: err.message };
  }
}

export async function approveEmployeePhoto(employeeId: string, photoUrl: string): Promise<boolean> {
  const res = await updateEmployeeProfileField(employeeId, 'photoUrl', photoUrl);
  return res.success;
}

export async function getPendingProfileEdit(telegramId: string | number): Promise<'photo' | 'phone' | 'address' | null> {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_profile_edits')
      .maybeSingle();

    if (data?.qr_code) {
      const stateMap = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
      const entry = stateMap[String(telegramId)];
      if (entry && Date.now() < entry.expiresAt) {
        return entry.field;
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error reading pending profile edit:', err);
  }
  return null;
}

export async function setPendingProfileEdit(
  telegramId: string | number, 
  field: 'photo' | 'phone' | 'address'
) {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_profile_edits')
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
      field,
      expiresAt: now + 15 * 60 * 1000, // 15 min expiry
    };

    await supabase.from('warehouses').upsert({
      id: 'ashley_telegram_pending_profile_edits',
      name: 'TELEGRAM_PENDING_PROFILE_EDITS',
      qr_code: JSON.stringify(stateMap),
    }, { onConflict: 'id' });
  } catch (err) {
    logger.error('[TelegramService] Error saving pending profile edit:', err);
  }
}

export async function clearPendingProfileEdit(telegramId: string | number) {
  try {
    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_telegram_pending_profile_edits')
      .maybeSingle();

    if (data?.qr_code) {
      const stateMap = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
      if (stateMap[String(telegramId)]) {
        delete stateMap[String(telegramId)];
        await supabase.from('warehouses').upsert({
          id: 'ashley_telegram_pending_profile_edits',
          name: 'TELEGRAM_PENDING_PROFILE_EDITS',
          qr_code: JSON.stringify(stateMap),
        }, { onConflict: 'id' });
      }
    }
  } catch (err) {
    logger.warn('[TelegramService] Error clearing pending profile edit:', err);
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
