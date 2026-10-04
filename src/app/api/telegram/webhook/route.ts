import { NextRequest, NextResponse } from 'next/server';
import { 
  sendTelegramMessage, 
  getMainReplyKeyboard, 
  getLocationRequestKeyboard, 
  getTelegramBindings, 
  saveTelegramBinding, 
  recordAttendance, 
  getBaghdadNow, 
  getDistanceMeters 
} from '@/lib/telegram/telegram-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Temporary in-memory cache for user intents (check_in vs check_out)
const PENDING_INTENTS: Record<string, 'check_in' | 'check_out'> = {};

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat?.id;
    const text = (message.text || '').trim();
    const location = message.location;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const bindings = await getTelegramBindings();
    const currentBinding = bindings[String(chatId)];

    // -------------------------------------------------------------
    // 1. COMMAND: /start or Account Setup
    // -------------------------------------------------------------
    if (text === '/start' || text === '🔄 نوێکردنەوە یان گۆڕینی هەژمار') {
      if (currentBinding) {
        await sendTelegramMessage(
          chatId,
          `سڵاو بەڕێز <b>${currentBinding.employeeName}</b> ✨\nبەخێربێیت بۆ سیستەمی فەرمی دەوامی ئاشڵی 🏢\n\nتکایە لە دوگمەکانی خوارەوە هەڵبژێرە:`,
          getMainReplyKeyboard()
        );
      } else {
        // Not bound yet: Prompt to select employee
        const empButtons = ASHLEY_OFFICIAL_EMPLOYEES.map(emp => ([
          { text: `👤 ${emp.name} (${emp.employeeId})` }
        ]));

        await sendTelegramMessage(
          chatId,
          `بەخێربێیت بۆ <b>بۆتی فەرمی دەوامی کۆمپانیای ئاشڵی</b> 🏢\n\nتکایە <b>ناوی خۆت</b> لە لیستەکەی خوارەوە هەڵبژێرە بۆ بەستنەوەی ئەم تەلەگرامە بە هەژمارەکەت:`,
          {
            keyboard: empButtons,
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 2. BINDING EMPLOYEE ACCOUNT
    // -------------------------------------------------------------
    if (!currentBinding) {
      // Find matching employee by name or ID
      const matchedEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(emp => {
        return text.includes(emp.name) || text.includes(emp.employeeId) || text === emp.id;
      });

      if (matchedEmp) {
        await saveTelegramBinding(chatId, matchedEmp.id, matchedEmp.name);
        await sendTelegramMessage(
          chatId,
          `✅ <b>پیرۆزە! هەژمارەکەت بەستراوەتەوە.</b>\n\n👤 ناوی کارمەند: <b>${matchedEmp.name}</b>\n🆔 کۆدی کارمەند: <b>${matchedEmp.employeeId}</b>\n\nئێستا دەتوانیت ڕۆژانە بە دوگمەکانی خوارەوە دەوام بکەیت:`,
          getMainReplyKeyboard()
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `تکایە ناوی خۆت لە دوگمەکانی خوارەوە هەڵبژێرە، یان ژمارەی کارمەندی خۆت بنووسە (وەک: 01، 02، 03...):`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 3. ACTION: CHECK-IN BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🟢 تۆمارکردنی هاتن') {
      PENDING_INTENTS[String(chatId)] = 'check_in';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی هاتن</b>، تکایە دوگمەی خوارەوە دابگرە بۆ ناردنی شوێنەکەت:\n\n<i>(تێبینی: پێویستە لۆکەیشنی مۆبایلەکەت کراوە بێت)</i>`,
        getLocationRequestKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 4. ACTION: CHECK-OUT BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🔴 تۆمارکردنی دەرچوون') {
      PENDING_INTENTS[String(chatId)] = 'check_out';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی دەرچوون</b>، تکایە دوگمەی خوارەوە دابگرە بۆ ناردنی شوێنەکەت:`,
        getLocationRequestKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 5. ACTION: CANCEL
    // -------------------------------------------------------------
    if (text === '❌ هەڵوەشاندنەوە') {
      delete PENDING_INTENTS[String(chatId)];
      await sendTelegramMessage(
        chatId,
        `کردارەکە هەڵوەشێندرایەوە. دەتوانیت لە خوارەوە هەڵبژێریت:`,
        getMainReplyKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 6. ACTION: TODAY'S ATTENDANCE STATUS
    // -------------------------------------------------------------
    if (text === '📊 دۆخی دەوامی ئەمڕۆم') {
      const { dateStr } = getBaghdadNow();
      const { data: record } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', currentBinding.employeeId)
        .eq('date', dateStr)
        .maybeSingle();

      if (!record || (!record.check_in_time && !record.check_out_time)) {
        await sendTelegramMessage(
          chatId,
          `📊 <b>دۆخی دەوامی ئەمڕۆ (${dateStr}):</b>\n\nتۆ تا ئێستا ئەمڕۆ هیچ دەوامێکت تۆمار نەکردووە.\nبۆ تۆمارکردنی هاتن، دوگمەی [🟢 تۆمارکردنی هاتن] دابگرە.`,
          getMainReplyKeyboard()
        );
      } else {
        const inStr = record.check_in_time ? `🟢 هاتن: ${record.check_in_time}` : '⚪ هاتن: تۆمار نەکراوە';
        const outStr = record.check_out_time ? `🔴 دەرچوون: ${record.check_out_time}` : '⚪ دەرچوون: تۆمار نەکراوە';
        const locStr = record.warehouse_name || record.check_in_address || 'کۆمپانیا';

        await sendTelegramMessage(
          chatId,
          `📊 <b>دۆخی دەوامی ئەمڕۆ (${dateStr}):</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n${inStr}\n${outStr}\n🏢 شوێن: <b>${locStr}</b>`,
          getMainReplyKeyboard()
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 7. ACTION: COMPANY LOCATIONS INFO
    // -------------------------------------------------------------
    if (text === 'ℹ️ شوێنەکانی دەوام') {
      const locList = DEFAULT_COMPANY_LOCATIONS.map(
        l => `• <b>${l.name}</b> (مەودای ڕێگەپێدراو: ${l.radiusMeters} مەتر)`
      ).join('\n');

      await sendTelegramMessage(
        chatId,
        `🏢 <b>شوێنە دیاریکراوەکانی دەوامی ئاشڵی:</b>\n\n${locList}\n\nدەتوانیت لەم شوێنانە دەوام تۆمار بکەیت کاتێک لە شوێنەکە ئامادە دەبیت.`,
        getMainReplyKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 8. GPS LOCATION RECEIVED (ATTENDANCE PROCESSING)
    // -------------------------------------------------------------
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      const userLat = location.latitude;
      const userLng = location.longitude;

      // Find distances to allowed locations
      let closestLoc = DEFAULT_COMPANY_LOCATIONS[0];
      let minDistance = getDistanceMeters(userLat, userLng, closestLoc.lat, closestLoc.lng);

      for (const loc of DEFAULT_COMPANY_LOCATIONS) {
        const dist = getDistanceMeters(userLat, userLng, loc.lat, loc.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestLoc = loc;
        }
      }

      // Check geofence radius
      if (minDistance <= closestLoc.radiusMeters) {
        // Determine log type: check_in or check_out
        let intent = PENDING_INTENTS[String(chatId)];
        if (!intent) {
          // Check if already checked in today
          const { dateStr } = getBaghdadNow();
          const { data: todayRec } = await supabase
            .from('attendance')
            .select('check_in_time, check_out_time')
            .eq('user_id', currentBinding.employeeId)
            .eq('date', dateStr)
            .maybeSingle();

          intent = (todayRec && todayRec.check_in_time && !todayRec.check_out_time) ? 'check_out' : 'check_in';
        }

        // Clean up intent
        delete PENDING_INTENTS[String(chatId)];

        const result = await recordAttendance(
          currentBinding.employeeId,
          currentBinding.employeeName,
          intent,
          closestLoc.name
        );

        if (result.success) {
          const typeLabel = intent === 'check_in' ? '🟢 دەوامی هاتن' : '🔴 دەوامی دەرچوون';
          await sendTelegramMessage(
            chatId,
            `✅ <b>${typeLabel} بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n🏢 شوێن: <b>${closestLoc.name}</b>\n📍 مەودا لە سەنتەر: <b>${minDistance} مەتر</b>\n⏱ کاتژمێر: <b>${result.timeStr}</b> (${result.dateStr})\n\nدەستت خۆش بێت و ڕۆژێکی پڕ لە سەرکەوتن! ✨`,
            getMainReplyKeyboard()
          );
        } else {
          await sendTelegramMessage(
            chatId,
            `❌ هەڵەیەک ڕوویدا لە تۆمارکردنی داتا: ${result.error}`,
            getMainReplyKeyboard()
          );
        }
      } else {
        // Outside Geofence
        await sendTelegramMessage(
          chatId,
          `⛔ <b>تۆ لە دەرەوەی سنوری دەوامیت!</b>\n\n🏢 نزیکترین شوێن: <b>${closestLoc.name}</b>\n📍 مەودای ئێستات: <b>${minDistance} مەتر</b>\n📏 مەودای ڕێگەپێدراو: <b>${closestLoc.radiusMeters} مەتر</b>\n\nتکایە کاتێک گەیشتیتە ناو کۆمپانیا یان کۆگا، دووبارە تاقی بکەرەوە.`,
          getMainReplyKeyboard()
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `تکایە دوگمەیەکی خوارەوە هەڵبژێرە بۆ دەوامکردن:`,
      getMainReplyKeyboard()
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
