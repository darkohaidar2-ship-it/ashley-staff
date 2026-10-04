import { NextRequest, NextResponse } from 'next/server';
import { 
  sendTelegramMessage, 
  getMainReplyKeyboard, 
  getLocationRequestKeyboard, 
  getTelegramBindings, 
  saveTelegramBinding, 
  recordAttendance, 
  getAllEmployees,
  getTodayAttendanceSummary,
  resetTodayAttendance,
  getBaghdadNow, 
  getDistanceMeters 
} from '@/lib/telegram/telegram-service';
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
    const allEmployees = await getAllEmployees();

    // -------------------------------------------------------------
    // 1. COMMAND: /start
    // -------------------------------------------------------------
    if (text === '/start') {
      if (currentBinding) {
        await sendTelegramMessage(
          chatId,
          `سڵاو بەڕێز <b>${currentBinding.employeeName}</b> ✨\nبەخێربێیت بۆ سیستەمی فەرمی دەوامی ئاشڵی 🏢\n\nتکایە لە دوگمەکانی خوارەوە هەڵبژێرە:`,
          getMainReplyKeyboard()
        );
        return NextResponse.json({ ok: true });
      }

      // If not bound: Show employee list to bind
      const empButtons: any[][] = [];
      for (let i = 0; i < allEmployees.length; i += 2) {
        const row = [{ text: `👤 ${allEmployees[i].name}` }];
        if (i + 1 < allEmployees.length) {
          row.push({ text: `👤 ${allEmployees[i + 1].name}` });
        }
        empButtons.push(row);
      }

      await sendTelegramMessage(
        chatId,
        `بەخێربێیت بۆ <b>بۆتی فەرمی دەوامی کۆمپانیای ئاشڵی</b> 🏢\n\nتکایە <b>ناوی خۆت</b> لە لیستەکەی خوارەوە هەڵبژێرە بۆ بەستنەوەی ئەم تەلەگرامە بە هەژمارەکەت:`,
        {
          keyboard: empButtons,
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 2. COMMAND: CHANGE ACCOUNT / SHOW EMPLOYEES LIST
    // -------------------------------------------------------------
    if (
      text === '🔄 گۆڕینی هەژمار / لیست' || 
      text === '🔄 نوێکردنەوە یان گۆڕینی هەژمار' || 
      text === '/change' || 
      text === '/register' ||
      text === '/employees'
    ) {
      const empButtons: any[][] = [];
      for (let i = 0; i < allEmployees.length; i += 2) {
        const row = [{ text: `👤 ${allEmployees[i].name}` }];
        if (i + 1 < allEmployees.length) {
          row.push({ text: `👤 ${allEmployees[i + 1].name}` });
        }
        empButtons.push(row);
      }
      empButtons.push([{ text: '❌ هەڵوەشاندنەوە' }]);

      const currentStatus = currentBinding 
        ? `\n<i>(هەژماری ئێستات: <b>${currentBinding.employeeName}</b>)</i>\n`
        : '';

      await sendTelegramMessage(
        chatId,
        `👥 <b>لیستی کارمەندانی تۆمارکراوی سیستەم:</b>${currentStatus}\nتکایە ناوی کارمەند لە دوگمەکانی خوارەوە هەڵبژێرە بۆ بەستنەوە:`,
        {
          keyboard: empButtons,
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 3. EMPLOYEE SELECTION (BINDING ACCOUNT)
    // -------------------------------------------------------------
    const cleanText = text.replace(/^👤\s*/, '').trim();
    const matchedEmp = allEmployees.find(emp => {
      const cleanEmpName = emp.name.trim().toLowerCase();
      const input = cleanText.toLowerCase();
      return (
        input === cleanEmpName ||
        input.includes(cleanEmpName) ||
        cleanEmpName.includes(input) ||
        (emp.employeeId && input === emp.employeeId.toLowerCase()) ||
        input === emp.id.toLowerCase()
      );
    });

    if (matchedEmp && (text.startsWith('👤') || !currentBinding)) {
      await saveTelegramBinding(chatId, matchedEmp.id, matchedEmp.name);
      await sendTelegramMessage(
        chatId,
        `✅ <b>پیرۆزە! هەژمارەکەت بەستراوەتەوە.</b>\n\n👤 ناوی کارمەند: <b>${matchedEmp.name}</b>\n🆔 کۆدی کارمەند: <b>${matchedEmp.employeeId}</b>\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە دەوام تۆمار بکەیت:`,
        getMainReplyKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // If still not bound, prompt to select
    if (!currentBinding) {
      await sendTelegramMessage(
        chatId,
        `تکایە سەرەتا ناوی خۆت لە دوگمەکانی خوارەوە هەڵبژێرە، یان بنووسە /start بۆ بینینی لیستەکە:`
      );
      return NextResponse.json({ ok: true });
    }

    const isManager = currentBinding.employeeId === 'emp-02' || currentBinding.employeeName.includes('دارکۆ');

    // -------------------------------------------------------------
    // 4. ACTION: TODAY'S ATTENDANCE SUMMARY LIST
    // -------------------------------------------------------------
    if (text === '📋 لیستی ئامادەبووانی ئەمڕۆ' || text === '/list' || text === '/today') {
      const summary = await getTodayAttendanceSummary();
      await sendTelegramMessage(chatId, summary, getMainReplyKeyboard());
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 5. ACTION: TODAY'S ATTENDANCE STATUS (FOR ME)
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
        const inStr = record.check_in_time ? `🟢 هاتن: <b>${record.check_in_time}</b>` : '⚪ هاتن: تۆمار نەکراوە';
        const outStr = record.check_out_time ? `🔴 دەرچوون: <b>${record.check_out_time}</b>` : '⚪ دەرچوون: تۆمار نەکراوە';
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
    // 6. ACTION: RESET TODAY ATTENDANCE (MANAGER / TEST COMMAND)
    // -------------------------------------------------------------
    if (text === '/reset_today' || text === '/delete_today') {
      const { dateStr } = getBaghdadNow();
      await resetTodayAttendance(currentBinding.employeeId, currentBinding.employeeName);
      await sendTelegramMessage(
        chatId,
        `🗑️ <b>تۆماری دەوامی ئەمڕۆت (${dateStr}) بە سەرکەوتوویی پاککرایەوە!</b>\nئێستا دەتوانیت سەرلەنوێ تاقی بکەیتەوە.`,
        getMainReplyKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 7. ACTION: CHECK-IN BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🟢 تۆمارکردنی هاتن') {
      const { dateStr } = getBaghdadNow();
      const { data: todayRec } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time')
        .eq('user_id', currentBinding.employeeId)
        .eq('date', dateStr)
        .maybeSingle();

      if (todayRec?.check_in_time) {
        const managerHint = isManager 
          ? `\n\n<i>(وەک بەڕێوەبەر بۆ تاقیکردنەوە دەتوانیت بنووسیت <b>/in</b> بۆ نوێکردنەوە یان <b>/reset_today</b> بۆ سڕینەوە)</i>`
          : '';
        await sendTelegramMessage(
          chatId,
          `⚠️ بەڕێز <b>${currentBinding.employeeName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${todayRec.check_in_time}</b> دەوامی هاتنت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار هاتن تۆمار دەکرێت. ئەگەر کاتی تەواوبوونی دەوامتە، تکایە دوگمەی [🔴 تۆمارکردنی دەرچوون] دابگرە.${managerHint}`,
          getMainReplyKeyboard()
        );
        return NextResponse.json({ ok: true });
      }

      PENDING_INTENTS[String(chatId)] = 'check_in';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی هاتن</b>:\n\n• دەتوانیت دوگمەی <b>[📍 ناردنی لۆکەیشن]</b> دابگریت.\n• یان ئەگەر لە کۆمپیوتەریت یاخود لۆکەیشنت کار ناکات، دوگمەی <b>[⚡ تۆمارکردنی خێرا]</b> دابگرە:`,
        getLocationRequestKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 8. ACTION: CHECK-OUT BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🔴 تۆمارکردنی دەرچوون') {
      const { dateStr } = getBaghdadNow();
      const { data: todayRec } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time')
        .eq('user_id', currentBinding.employeeId)
        .eq('date', dateStr)
        .maybeSingle();

      if (!todayRec?.check_in_time && !isManager) {
        await sendTelegramMessage(
          chatId,
          `⚠️ تۆ هێشتا ئەمڕۆ دەوامی هاتنت تۆمار نەکردووە!\n\nسەرەتا دەبێت دەوامی [🟢 تۆمارکردنی هاتن] ئەنجام بدەیت.`,
          getMainReplyKeyboard()
        );
        return NextResponse.json({ ok: true });
      }

      if (todayRec?.check_out_time) {
        const managerHint = isManager 
          ? `\n\n<i>(وەک بەڕێوەبەر بۆ تاقیکردنەوە دەتوانیت بنووسیت <b>/out</b> بۆ نوێکردنەوە یان <b>/reset_today</b> بۆ سڕینەوە)</i>`
          : '';
        await sendTelegramMessage(
          chatId,
          `⚠️ بەڕێز <b>${currentBinding.employeeName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${todayRec.check_out_time}</b> دەوامی دەرچوونت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار دەرچوون تۆمار دەکرێت.${managerHint}`,
          getMainReplyKeyboard()
        );
        return NextResponse.json({ ok: true });
      }

      PENDING_INTENTS[String(chatId)] = 'check_out';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی دەرچوون</b>:\n\n• دەتوانیت دوگمەی <b>[📍 ناردنی لۆکەیشن]</b> دابگریت.\n• یان ئەگەر لە کۆمپیوتەریت، دوگمەی <b>[⚡ تۆمارکردنی خێرا]</b> دابگرە:`,
        getLocationRequestKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. ACTION: QUICK ATTENDANCE (NO GPS REQUIRED)
    // -------------------------------------------------------------
    if (text === '⚡ تۆمارکردنی خێرا (بەبێ GPS)') {
      const { dateStr } = getBaghdadNow();
      const { data: todayRec } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time')
        .eq('user_id', currentBinding.employeeId)
        .eq('date', dateStr)
        .maybeSingle();

      let intent = PENDING_INTENTS[String(chatId)];
      if (!intent) {
        intent = (!todayRec?.check_in_time) ? 'check_in' : 'check_out';
      }
      delete PENDING_INTENTS[String(chatId)];

      const result = await recordAttendance(
        currentBinding.employeeId,
        currentBinding.employeeName,
        intent,
        'کۆمپانیای سەرەکی ئاشڵی (خێرا)'
      );

      if (result.success) {
        const typeLabel = intent === 'check_in' ? '🟢 دەوامی هاتن' : '🔴 دەوامی دەرچوون';
        await sendTelegramMessage(
          chatId,
          `✅ <b>${typeLabel} بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n⏱ کاتژمێر: <b>${result.timeStr}</b> (${result.dateStr})\n🏢 شێواز: <b>تۆمارکردنی خێرا</b>\n\nلە سیستەمی سەرەکی و خشتەکان دانرا! ✨`,
          getMainReplyKeyboard()
        );
      } else {
        await sendTelegramMessage(chatId, `❌ هەڵە لە تۆمارکردن: ${result.error}`, getMainReplyKeyboard());
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10. DIRECT COMMANDS (/in and /out)
    // -------------------------------------------------------------
    if (text === '/in' || text === '/checkin') {
      const result = await recordAttendance(
        currentBinding.employeeId,
        currentBinding.employeeName,
        'check_in',
        'کۆمپانیای سەرەکی ئاشڵی (تەلەگرام)'
      );
      if (result.success) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>🟢 دەوامی هاتن بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n⏱ کاتژمێر: <b>${result.timeStr}</b> (${result.dateStr})\n🏢 شوێن: <b>کۆمپانیای سەرەکی ئاشڵی</b>\n\nتۆمارەکەت لە خشتەی سەرەکی دانرا! ✨`,
          getMainReplyKeyboard()
        );
      } else {
        await sendTelegramMessage(chatId, `❌ هەڵە لە تۆمارکردن: ${result.error}`, getMainReplyKeyboard());
      }
      return NextResponse.json({ ok: true });
    }

    if (text === '/out' || text === '/checkout') {
      const result = await recordAttendance(
        currentBinding.employeeId,
        currentBinding.employeeName,
        'check_out',
        'کۆمپانیای سەرەکی ئاشڵی (تەلەگرام)'
      );
      if (result.success) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>🔴 دەوامی دەرچوون بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n⏱ کاتژمێر: <b>${result.timeStr}</b> (${result.dateStr})\n🏢 شوێن: <b>کۆمپانیای سەرەکی ئاشڵی</b>\n\nتۆمارەکەت لە خشتەی سەرەکی دانرا! ✨`,
          getMainReplyKeyboard()
        );
      } else {
        await sendTelegramMessage(chatId, `❌ هەڵە لە تۆمارکردن: ${result.error}`, getMainReplyKeyboard());
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 11. ACTION: CANCEL
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
    // 12. ACTION: COMPANY LOCATIONS INFO
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
    // 13. GPS LOCATION RECEIVED (ATTENDANCE PROCESSING)
    // -------------------------------------------------------------
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      const userLat = location.latitude;
      const userLng = location.longitude;

      let closestLoc = DEFAULT_COMPANY_LOCATIONS[0];
      let minDistance = getDistanceMeters(userLat, userLng, closestLoc.lat, closestLoc.lng);

      for (const loc of DEFAULT_COMPANY_LOCATIONS) {
        const dist = getDistanceMeters(userLat, userLng, loc.lat, loc.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestLoc = loc;
        }
      }

      const isInsideGeofence = minDistance <= closestLoc.radiusMeters;

      if (isInsideGeofence || isManager) {
        const { dateStr } = getBaghdadNow();
        const { data: todayRec } = await supabase
          .from('attendance')
          .select('check_in_time, check_out_time')
          .eq('user_id', currentBinding.employeeId)
          .eq('date', dateStr)
          .maybeSingle();

        let intent = PENDING_INTENTS[String(chatId)];
        if (!intent) {
          intent = (todayRec && todayRec.check_in_time && !todayRec.check_out_time) ? 'check_out' : 'check_in';
        }
        delete PENDING_INTENTS[String(chatId)];

        if (intent === 'check_in' && todayRec?.check_in_time && !isManager) {
          await sendTelegramMessage(
            chatId,
            `⚠️ بەڕێز <b>${currentBinding.employeeName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${todayRec.check_in_time}</b> دەوامی هاتنت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار هاتن تۆمار دەکرێت.`,
            getMainReplyKeyboard()
          );
          return NextResponse.json({ ok: true });
        }

        if (intent === 'check_out' && todayRec?.check_out_time && !isManager) {
          await sendTelegramMessage(
            chatId,
            `⚠️ بەڕێز <b>${currentBinding.employeeName}</b>، تۆ پێشتر ئەمڕۆ لە کاتژمێر <b>${todayRec.check_out_time}</b> دەوامی دەرچوونت تۆمار کردووە!\n\nڕۆژانە تەنها یەک جار دەرچوون تۆمار دەکرێت.`,
            getMainReplyKeyboard()
          );
          return NextResponse.json({ ok: true });
        }

        const locName = isInsideGeofence ? closestLoc.name : `${closestLoc.name} (بەڕێوەبەر - دەرەوەی سنور)`;

        const result = await recordAttendance(
          currentBinding.employeeId,
          currentBinding.employeeName,
          intent,
          locName
        );

        if (result.success) {
          const typeLabel = intent === 'check_in' ? '🟢 دەوامی هاتن' : '🔴 دەوامی دەرچوون';
          const distanceNote = isInsideGeofence
            ? `📍 مەودا لە سەنتەر: <b>${minDistance} مەتر</b>`
            : `📍 مەودا لە سەنتەر: <b>${minDistance} مەتر (ڕێگەپێدراوی بەڕێوەبەر)</b>`;

          await sendTelegramMessage(
            chatId,
            `✅ <b>${typeLabel} بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n🏢 شوێن: <b>${closestLoc.name}</b>\n${distanceNote}\n⏱ کاتژمێر: <b>${result.timeStr}</b> (${result.dateStr})\n\nدەستت خۆش بێت و لە سیستەم تۆمارکرا! ✨`,
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

    // -------------------------------------------------------------
    // 14. HELP COMMAND
    // -------------------------------------------------------------
    if (text === '/help') {
      await sendTelegramMessage(
        chatId,
        `ℹ️ <b>ڕێبەری فەرمانی بۆتی دەوامی ئاشڵی:</b>\n\n` +
        `• <b>🟢 تۆمارکردنی هاتن</b>: ناردنی لۆکەیشن و تۆمارکردنی کاتی هاتن\n` +
        `• <b>🔴 تۆمارکردنی دەرچوون</b>: تۆمارکردنی کاتی تەواوبوونی دەوام\n` +
        `• <b>📊 دۆخی دەوامی ئەمڕۆم</b>: پیشاندانی کاتی هاتن و دەرچوونی ئەمڕۆت\n` +
        `• <b>📋 لیستی ئامادەبووانی ئەمڕۆ</b>: پیشاندانی هەموو کارمەندانی ئامادەبوو\n` +
        `• <b>🔄 گۆڕینی هەژمار / لیست</b>: گۆڕینی کارمەند و بەستنەوەی سەرلەنوێ\n` +
        `• <b>/in</b>: تۆمارکردنی خێرای هاتن\n` +
        `• <b>/out</b>: تۆمارکردنی خێرای دەرچوون\n` +
        `• <b>/reset_today</b>: پاککردنەوەی دەوامی ئەمڕۆ (بۆ بەڕێوەبەر)`,
        getMainReplyKeyboard()
      );
      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `سڵاو بەڕێز <b>${currentBinding.employeeName}</b>، تکایە دوگمەیەکی خوارەوە هەڵبژێرە:`,
      getMainReplyKeyboard()
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
