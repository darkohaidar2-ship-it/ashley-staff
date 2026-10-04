import { NextRequest, NextResponse } from 'next/server';
import { 
  sendTelegramMessage, 
  getMainReplyKeyboard, 
  getLocationRequestKeyboard, 
  getTelegramBindings, 
  saveTelegramBinding, 
  unbindTelegramAccount,
  getMonthlyAttendanceReport,
  getAllEmployees,
  getTodayAttendanceSummary,
  resetTodayAttendance,
  getBaghdadNow,
  verifyEmployeePin,
  getPendingPinState,
  setPendingPinState,
  clearPendingPinState
} from '@/lib/telegram/telegram-service';
import { evaluateAndRecordAttendance } from '@/lib/attendance/punch-service';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Temporary in-memory cache for user intents (check_in vs check_out)
const PENDING_INTENTS: Record<string, 'check_in' | 'check_out'> = {};

export async function POST(req: NextRequest) {
  try {
    // 🔒 1. Webhook Secret Token Verification
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 'ashley_secure_webhook_secret_key_2027';
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (incomingSecret && incomingSecret !== expectedSecret) {
      logger.warn('[Telegram Webhook] Unauthorized request: secret token mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update = await req.json();

    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat?.id;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    // 🔒 2. Restrict to 1-to-1 private chat only
    if (message.chat?.type && message.chat.type !== 'private') {
      return NextResponse.json({ ok: true });
    }

    // 🔒 3. Identify user strictly by Telegram User ID (from.id)
    const fromId = String(message.from?.id || chatId);
    const text = (message.text || '').trim();
    const location = message.location;

    // -------------------------------------------------------------
    // 4. CHECK PENDING PIN VERIFICATION STATE
    // -------------------------------------------------------------
    const pendingPin = await getPendingPinState(fromId);
    if (pendingPin && text && !text.startsWith('/')) {
      if (text === '❌ هەڵوەشاندنەوە' || text === 'cancel') {
        await clearPendingPinState(fromId);
        await sendTelegramMessage(chatId, `کرداری بەستنەوە هەڵوەشێندرایەوە. بنووسە /start بۆ دەستپێکردنەوە.`, { remove_keyboard: true });
        return NextResponse.json({ ok: true });
      }

      const isPinValid = await verifyEmployeePin(pendingPin.employeeId, text);
      if (isPinValid) {
        await clearPendingPinState(fromId);
        const saveRes = await saveTelegramBinding(fromId, pendingPin.employeeId, pendingPin.employeeName);
        
        if (!saveRes.success && saveRes.error === 'ALREADY_BOUND_TO_ANOTHER') {
          await sendTelegramMessage(
            chatId,
            `⛔ <b>ئەم هەژمارە قوفڵ کراوە!</b>\n\nکارمەند <b>${pendingPin.employeeName}</b> پێشتر لەسەر مۆبایل و ئەکاونتێکی تری تەلەگرام قوفڵ کراوە.\n\n🔒 بۆ پاراستنی دروستی دەوام، ڕێگە نادرێت دوو کەس لە دوو مۆبایلی جیاوازەوە دەوام بکەن.\nئەگەر مۆبایلت گۆڕیوە، تکایە پەیوەندی بە بەڕێوەبەر (کاک دارکۆ) بکە تا قوفڵی هەژمارەکەت لەسەر مۆبایلە کۆنەکە بکاتەوە.`,
            getMainReplyKeyboard(false)
          );
          return NextResponse.json({ ok: true });
        }

        const isMgr = pendingPin.employeeId === 'emp-02';
        await sendTelegramMessage(
          chatId,
          `✅ <b>پیرۆزە! کۆدی نهێنی پەسەندکرا و هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n👤 ناوی کارمەند: <b>${pendingPin.employeeName}</b>\n🆔 کۆدی کارمەند: <b>${pendingPin.employeeId}</b>\n🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم ئەکاونت و ئامێرەی تەلەگرامە قوفڵکرا.\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە دەوام تۆمار بکەیت:`,
          getMainReplyKeyboard(isMgr)
        );
        return NextResponse.json({ ok: true });
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ <b>کۆدی نهێنی (PIN) هەڵەیە!</b>\n\nتکایە کۆدی نهێنی ٤ ژمارەیی ڕاست بنووسە، یان دوگمەی <b>[❌ هەڵوەشاندنەوە]</b> دابگرە:`,
          {
            keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }
    }

    const bindings = await getTelegramBindings();
    const currentBinding = bindings[fromId];
    const allEmployees = await getAllEmployees();
    const isManager = Boolean(currentBinding && (currentBinding.employeeId === 'emp-02' || currentBinding.employeeName.includes('دارکۆ')));

    // -------------------------------------------------------------
    // 5. COMMAND: /start
    // -------------------------------------------------------------
    if (text === '/start') {
      if (currentBinding) {
        await sendTelegramMessage(
          chatId,
          `سڵاو بەڕێز <b>${currentBinding.employeeName}</b> ✨\nبەخێربێیت بۆ سیستەمی فەرمی دەوامی ئاشڵی 🏢\n\nتکایە لە دوگمەکانی خوارەوە هەڵبژێرە:`,
          getMainReplyKeyboard(isManager)
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
    // 6. COMMAND: CHANGE ACCOUNT / SHOW EMPLOYEES LIST
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
    // 7. EMPLOYEE SELECTION (PROMPT FOR PIN)
    // -------------------------------------------------------------
    const cleanText = text.replace(/^👤\s*/, '').trim();
    if (cleanText.length >= 2 && (!currentBinding || text.startsWith('👤'))) {
      const matchedEmp = allEmployees.find(emp => {
        const cleanEmpName = emp.name.trim().toLowerCase();
        const input = cleanText.toLowerCase();
        return (
          input === cleanEmpName ||
          input === `👤 ${cleanEmpName}` ||
          (emp.employeeId && input === emp.employeeId.toLowerCase()) ||
          input === emp.id.toLowerCase()
        );
      });

      if (matchedEmp) {
        // 🔒 Check if employee is already bound to another Telegram user
        for (const [boundUid, info] of Object.entries(bindings)) {
          if (info.employeeId === matchedEmp.id && boundUid !== fromId) {
            await sendTelegramMessage(
              chatId,
              `⛔ <b>ئەم هەژمارە قوفڵ کراوە!</b>\n\nکارمەند <b>${matchedEmp.name}</b> پێشتر لەسەر مۆبایل و تەلەگرامێکی تر قوفڵ کراوە.\n\n🔒 بۆ پاراستنی دروستی دەوام، ڕێگە نادرێت دوو مۆبایل لەسەر یەک کارمەند دەوام بکەن.\nئەگەر مۆبایلت گۆڕیوە، پەیوەندی بە بەڕێوەبەر (کاک دارکۆ) بکە تا قوفڵی هەژمارەکەت بکاتەوە.`,
              getMainReplyKeyboard(isManager)
            );
            return NextResponse.json({ ok: true });
          }
        }

        // Set pending PIN state
        await setPendingPinState(fromId, matchedEmp.id, matchedEmp.name);
        await sendTelegramMessage(
          chatId,
          `🔐 <b>سەلماندنی ناسنامە پێویستە:</b>\n\nتۆ ناوی <b>${matchedEmp.name}</b>ت هەڵبژارد.\nتکایە <b>کۆدی نهێنی (PIN)ی ٤ ژمارەیی</b> تایبەت بە خۆت بنووسە بۆ بەستنەوە:\n\n<i>(ئەگەر پەشیمان بوویتەوە بنووسە: ❌ هەڵوەشاندنەوە)</i>`,
          {
            keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // If still not bound, prompt to select
    if (!currentBinding) {
      await sendTelegramMessage(
        chatId,
        `تکایە سەرەتا ناوی خۆت لە دوگمەکانی خوارەوە هەڵبژێرە، یان بنووسە /start بۆ بینینی لیستەکە:`
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 8. MANAGER COMMAND: UNBIND / UNLOCK EMPLOYEE TELEGRAM ACCOUNT
    // -------------------------------------------------------------
    if (text.startsWith('/unbind') || text.startsWith('/unlock')) {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە قوفڵی هەژمارەکان بکاتەوە.`, getMainReplyKeyboard(isManager));
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      const target = parts[1]?.trim();
      if (!target) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>شێوازی کردنەوەی قوفڵی هەژمار:</b>\n<code>/unbind [کۆدی کارمەند]</code>\nنموونە: <code>/unbind emp-05</code>`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      const unbindSuccess = await unbindTelegramAccount(target);
      if (unbindSuccess) {
        await sendTelegramMessage(
          chatId,
          `🔓 <b>هەژماری (${target}) بە سەرکەوتوویی لە تەلەگرام کرایەوە!</b>\nئێستا دەتوانێت لە مۆبایلێکی نوێوە ببەسترێتەوە.`,
          getMainReplyKeyboard(isManager)
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هیچ تۆمارێکی تەلەگرام نەدۆزرایەوە بە کۆدی: <b>${target}</b>`,
          getMainReplyKeyboard(isManager)
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. ACTION: TODAY'S ATTENDANCE SUMMARY LIST
    // -------------------------------------------------------------
    if (text === '📋 لیستی ئامادەبووانی ئەمڕۆ' || text === '/list' || text === '/today') {
      const summary = await getTodayAttendanceSummary();
      await sendTelegramMessage(chatId, summary, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10. ACTION: MONTHLY ATTENDANCE REPORT (FOR ME)
    // -------------------------------------------------------------
    if (text === '📅 دۆخی دەوامی ئەم مانگەم' || text === '/month' || text === '/report') {
      const reportMsg = await getMonthlyAttendanceReport(currentBinding.employeeId, currentBinding.employeeName);
      await sendTelegramMessage(chatId, reportMsg, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 11. ACTION: TODAY'S ATTENDANCE STATUS (FOR ME)
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
          getMainReplyKeyboard(isManager)
        );
      } else {
        const inStr = record.check_in_time ? `🟢 هاتن: <b>${record.check_in_time}</b>` : '⚪ هاتن: تۆمار نەکراوە';
        const outStr = record.check_out_time ? `🔴 دەرچوون: <b>${record.check_out_time}</b>` : '⚪ دەرچوون: تۆمار نەکراوە';
        const locStr = record.warehouse_name || record.check_in_address || 'کۆمپانیا';

        await sendTelegramMessage(
          chatId,
          `📊 <b>دۆخی دەوامی ئەمڕۆ (${dateStr}):</b>\n\n👤 کارمەند: <b>${currentBinding.employeeName}</b>\n${inStr}\n${outStr}\n🏢 شوێن: <b>${locStr}</b>`,
          getMainReplyKeyboard(isManager)
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 12. ACTION: RESET TODAY ATTENDANCE (MANAGER ONLY!)
    // -------------------------------------------------------------
    if (text === '/reset_today' || text === '/delete_today') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ ئەم فەرمانە تەنها بۆ بەڕێوەبەر ڕێگەپێدراوە.`, getMainReplyKeyboard(false));
        return NextResponse.json({ ok: true });
      }

      const { dateStr } = getBaghdadNow();
      await resetTodayAttendance(currentBinding.employeeId, currentBinding.employeeName);
      await sendTelegramMessage(
        chatId,
        `🗑️ <b>تۆماری دەوامی ئەمڕۆت (${dateStr}) بە سەرکەوتوویی پاککرایەوە!</b>\nئێستا دەتوانیت سەرلەنوێ تاقی بکەیتەوە.`,
        getMainReplyKeyboard(true)
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 13. ACTION: CHECK-IN BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🟢 تۆمارکردنی هاتن') {
      PENDING_INTENTS[fromId] = 'check_in';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی هاتن</b>:\n\nتکایە دوگمەی <b>[📍 ناردنی لۆکەیشنی دەوام (GPS)]</b> لە خوارەوە دابگرە تا شوێنەکەت لەلایەن سیستەمەوە بپشکنرێت:`,
        getLocationRequestKeyboard(isManager)
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 14. ACTION: CHECK-OUT BUTTON CLICKED
    // -------------------------------------------------------------
    if (text === '🔴 تۆمارکردنی دەرچوون') {
      PENDING_INTENTS[fromId] = 'check_out';
      await sendTelegramMessage(
        chatId,
        `📍 بۆ تۆمارکردنی <b>دەوامی دەرچوون</b>:\n\nتکایە دوگمەی <b>[📍 ناردنی لۆکەیشنی دەوام (GPS)]</b> لە خوارەوە دابگرە تا شوێنەکەت لەلایەن سیستەمەوە بپشکنرێت:`,
        getLocationRequestKeyboard(isManager)
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 15. ACTION: QUICK ATTENDANCE (MANAGER ONLY!)
    // -------------------------------------------------------------
    if (text === '⚡ تۆمارکردنی خێرا (بەبێ GPS)' || text === '⚡ تۆمارکردنی خێرا (بەڕێوەبەر)') {
      let intent = PENDING_INTENTS[fromId];
      delete PENDING_INTENTS[fromId];

      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: intent || 'auto',
        forceBypassLocation: true,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 16. DIRECT COMMANDS (/in and /out)
    // -------------------------------------------------------------
    if (text === '/in' || text === '/checkin') {
      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: 'check_in',
        forceBypassLocation: true,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    if (text === '/out' || text === '/checkout') {
      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: 'check_out',
        forceBypassLocation: true,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 17. ACTION: CANCEL
    // -------------------------------------------------------------
    if (text === '❌ هەڵوەشاندنەوە') {
      delete PENDING_INTENTS[fromId];
      await clearPendingPinState(fromId);
      await sendTelegramMessage(
        chatId,
        `کردارەکە هەڵوەشێندرایەوە. دەتوانیت لە خوارەوە هەڵبژێریت:`,
        getMainReplyKeyboard(isManager)
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 18. GPS LOCATION RECEIVED (ATTENDANCE PROCESSING THROUGH ENGINE)
    // -------------------------------------------------------------
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      // 🔒 Reject forwarded locations
      if ((message as any).forward_date || (message as any).forward_origin || (message as any).forward_from) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>لۆکەیشنی نێردراوە (Forwarded) قبوڵ ناکرێت!</b>\n\nتکایە بە شێوەی ڕاستەوخۆ لۆکەیشنی ئێستای خۆت بنێرە لە شوێنی دەوام.`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      // 🔒 Check message timestamp freshness (within 180 seconds)
      const nowUnix = Math.floor(Date.now() / 1000);
      if (message.date && Math.abs(nowUnix - message.date) > 180) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>ئەم لۆکەیشنە کۆنە یان درەنگ گەیشتووە!</b>\n\nتکایە دووبارە لۆکەیشنی نوێ بنێرەوە.`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      let intent = PENDING_INTENTS[fromId];
      delete PENDING_INTENTS[fromId];

      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: intent || 'auto',
        lat: location.latitude,
        lng: location.longitude,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 19. HELP COMMAND
    // -------------------------------------------------------------
    if (text === '/help') {
      let helpText = `ℹ️ <b>ڕێبەری فەرمانی بۆتی دەوامی ئاشڵی:</b>\n\n` +
        `• <b>🟢 تۆمارکردنی هاتن</b>: ناردنی لۆکەیشن و تۆمارکردنی کاتی هاتن\n` +
        `• <b>🔴 تۆمارکردنی دەرچوون</b>: ناردنی لۆکەیشن و تۆمارکردنی کاتی دەرچوون\n` +
        `• <b>📊 دۆخی دەوامی ئەمڕۆم</b>: پیشاندانی کاتی هاتن و دەرچوونی ئەمڕۆت\n` +
        `• <b>📅 دۆخی دەوامی ئەم مانگەم (/month)</b>: ڕاپۆرت و ئاماری دەوامی مانگانەت\n` +
        `• <b>📋 لیستی ئامادەبووانی ئەمڕۆ</b>: پیشاندانی هەموو کارمەندانی ئامادەبوو\n` +
        `• <b>🔄 گۆڕینی هەژمار / لیست</b>: گۆڕینی کارمەند و بەستنەوەی سەرلەنوێ\n` +
        `• <b>/in</b>: تۆمارکردنی دەوامی هاتن\n` +
        `• <b>/out</b>: تۆمارکردنی دەوامی دەرچوون`;

      if (isManager) {
        helpText += `\n\n<b>🔧 فەرمانەکانی بەڕێوەبەر:</b>\n` +
          `• <b>/reset_today</b>: پاککردنەوەی دەوامی ئەمڕۆی خۆت بۆ تاقیکردنەوە\n` +
          `• <b>/unbind [کۆدی کارمەند]</b>: کردنەوەی قوفڵی هەژمار لەسەر تەلەگرام`;
      }

      await sendTelegramMessage(chatId, helpText, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `سڵاو بەڕێز <b>${currentBinding.employeeName}</b>، تکایە دوگمەیەکی خوارەوە هەڵبژێرە:`,
      getMainReplyKeyboard(isManager)
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
