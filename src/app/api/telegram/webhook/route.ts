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
  findEmployeeByPin,
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

    // 🔒 2. Anti-Fraud: STRICTLY BLOCK ALL FORWARDED MESSAGES
    const isForwarded = Boolean(
      message.forward_date ||
      message.forward_origin ||
      message.forward_from ||
      message.forward_from_chat ||
      message.forward_sender_name ||
      (message as any).is_automatic_forward
    );

    if (isForwarded) {
      logger.warn(`[Telegram Webhook] Blocked forwarded message from chatId ${chatId}, fromId ${message.from?.id}`);
      await sendTelegramMessage(
        chatId,
        `⛔ <b>ناردنی نامەی دەستاودەست (Forward) قەدەغەیە!</b>\n\n🔒 بۆ پاراستنی دروستی دەوام و ڕێگری لە ساختەکاری، دەبێت هەر فەرمانێک، نامەیەک یان لۆکەیشنێک <b>ڕاستەوخۆ بە دەستی خۆت</b> لە ناو ئەم چاتەدا بنێریت.`
      );
      return NextResponse.json({ ok: true });
    }

    // 🔒 3. Restrict to 1-to-1 private chat only
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

      // If not bound: Do NOT expose employee list publicly. Show their Telegram ID for Admin.
      await sendTelegramMessage(
        chatId,
        `بەخێربێیت بۆ <b>بۆتی فەرمی دەوامی کۆمپانیای ئاشڵی</b> 🏢\n\n` +
        `🔒 ئەم هەژمارەی تەلەگرامە هێشتا نەبەستراوەتەوە بە هیچ کارمەندێکەوە.\n\n` +
        `🆔 <b>ئایدی تەلەگرامی تۆ (Telegram ID):</b>\n<code>${fromId}</code>\n\n` +
        `📌 <b>ڕێنمایی بۆ بەستنەوە:</b>\n` +
        `تکایە ئەم ژمارەی ئایدییەی سەرەوە (<code>${fromId}</code>) بنێرە بۆ بەڕێوەبەر (کاک دارکۆ) تا بە شێوەیەکی فەرمی و دەستی هەژمارەکەت پێوە ببەستێتەوە.\n\n` +
        `🔐 <i>ئەگەر کۆدی تایبەتی نهێنی (PIN)ت لە بەڕێوەبەر وەرگرتووە، دەتوانیت ڕاستەوخۆ ٤ ژمارەکە لێرە بنووسیت بۆ بەستنەوە.</i>`,
        { remove_keyboard: true }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 6. COMMAND: CHANGE ACCOUNT / LIST PROTECTION (NO LOGOUT FOR EMPLOYEES)
    // -------------------------------------------------------------
    if (
      text === '🔄 گۆڕینی هەژمار / لیست' || 
      text === '🔄 نوێکردنەوە یان گۆڕینی هەژمار' || 
      text === '/change' || 
      text === '/register' ||
      text === '/employees' ||
      text === '/logout' ||
      text === '/exit'
    ) {
      if (currentBinding && !isManager) {
        await sendTelegramMessage(
          chatId,
          `🔒 <b>لۆگ‌ئاوت و گۆڕینی هەژمار قوفڵ کراوە!</b>\n\n` +
          `ئەم تەلەگرامە بە شێوەی هەمیشەیی بەستراوەتەوە بە ناوی: <b>${currentBinding.employeeName}</b>.\n` +
          `ڕێگە نادرێت کارمەند لۆگ‌ئاوت بکات یان هەژمارەکەی بگۆڕێت.\n\n` +
          `ئەگەر مۆبایلت گۆڕیوە یان کێشەیەک هەیە، تەنها بەڕێوەبەر (کاک دارکۆ) دەتوانێت لە سیستەمەوە قوفڵەکەت بکاتەوە.`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      if (isManager) {
        const empButtons: any[][] = [];
        for (let i = 0; i < allEmployees.length; i += 2) {
          const row = [{ text: `👤 ${allEmployees[i].name}` }];
          if (i + 1 < allEmployees.length) {
            row.push({ text: `👤 ${allEmployees[i + 1].name}` });
          }
          empButtons.push(row);
        }
        empButtons.push([{ text: '❌ هەڵوەشاندنەوە' }]);

        await sendTelegramMessage(
          chatId,
          `👥 <b>لیستی کارمەندانی تۆمارکراوی سیستەم (تایبەت بە بەڕێوەبەر):</b>\nتکایە ناوی کارمەند هەڵبژێرە:`,
          {
            keyboard: empButtons,
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // -------------------------------------------------------------
    // 7. DIRECT PIN VERIFICATION (FOR UNBOUND USERS WITHOUT PUBLIC LIST)
    // -------------------------------------------------------------
    if (!currentBinding && /^\d{4}$/.test(text)) {
      const matchedEmp = await findEmployeeByPin(text);
      if (matchedEmp) {
        // Check if employee is already bound to another Telegram user
        for (const [boundUid, info] of Object.entries(bindings)) {
          if (info.employeeId === matchedEmp.id && boundUid !== fromId) {
            await sendTelegramMessage(
              chatId,
              `⛔ <b>ئەم کارمەندە پێشتر قوفڵکراوە!</b>\n\nکارمەند <b>${matchedEmp.name}</b> پێشتر لەسەر مۆبایل و تەلەگرامێکی تر قوفڵ کراوە.\n\n🔒 بۆ پاراستنی دروستی دەوام، ڕێگە نادرێت دوو مۆبایل لەسەر یەک کارمەند دەوام بکەن.\nئەگەر مۆبایلت گۆڕیوە، تکایە پەیوەندی بە بەڕێوەبەر (کاک دارکۆ) بکە تا قوفڵی هەژمارەکەت بکاتەوە.`,
              { remove_keyboard: true }
            );
            return NextResponse.json({ ok: true });
          }
        }

        const saveRes = await saveTelegramBinding(fromId, matchedEmp.id, matchedEmp.name);
        if (saveRes.success) {
          const isMgr = matchedEmp.id === 'emp-02';
          await sendTelegramMessage(
            chatId,
            `✅ <b>پیرۆزە! هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n` +
            `👤 ناوی کارمەند: <b>${matchedEmp.name}</b>\n` +
            `🆔 کۆدی کارمەند: <b>${matchedEmp.id}</b>\n` +
            `🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم مۆبایل و ئەکاونتەی تەلەگرام قوفڵکرا.\n\n` +
            `ئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی دەوام تۆمار بکەیت:`,
            getMainReplyKeyboard(isMgr)
          );
          return NextResponse.json({ ok: true });
        }
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ <b>کۆدی نهێنی (PIN) هەڵەیە!</b>\n\n` +
          `ئەگەر کۆدەکەت بیرچووە، تکایە ئایدی تەلەگرامەکەت: <code>${fromId}</code> بنێرە بۆ بەڕێوەبەر تا بە دەستی هەژمارەکەت بۆ ببەستێتەوە.`,
          { remove_keyboard: true }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // -------------------------------------------------------------
    // 8. MANAGER COMMAND: /bind [telegram_id] [emp_id_or_name]
    // -------------------------------------------------------------
    if (text.startsWith('/bind')) {
      if (!isManager) {
        await sendTelegramMessage(
          chatId, 
          `⛔ بەستنەوەی دەستی تەنها بۆ بەڕێوەبەر (کاک دارکۆ) ڕێگەپێدراوە.`, 
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      const targetTelegramId = parts[1]?.trim();
      const targetEmp = parts.slice(2).join(' ').trim();

      if (!targetTelegramId || !targetEmp) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>شێوازی بەستنەوەی دەستی لەلایەن بەڕێوەبەر:</b>\n\n` +
          `<code>/bind [Telegram_ID] [کۆد یان ناوی کارمەند]</code>\n\n` +
          `نموونە:\n` +
          `• <code>/bind 123456789 emp-05</code>\n` +
          `• <code>/bind 123456789 ئالان</code>`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      const matchedEmp = allEmployees.find(emp => {
        const cName = emp.name.toLowerCase();
        const cTarget = targetEmp.toLowerCase();
        return (
          emp.id.toLowerCase() === cTarget ||
          emp.employeeId.toLowerCase() === cTarget ||
          cName.includes(cTarget) ||
          cTarget.includes(cName)
        );
      });

      if (!matchedEmp) {
        await sendTelegramMessage(
          chatId,
          `❌ هیچ کارمەندێک نەدۆزرایەوە بە ناونیشانی: <b>${targetEmp}</b>`,
          getMainReplyKeyboard(isManager)
        );
        return NextResponse.json({ ok: true });
      }

      const saveRes = await saveTelegramBinding(targetTelegramId, matchedEmp.id, matchedEmp.name, true);
      if (saveRes.success) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>هەژمار بە سەرکەوتوویی بەستراوەتەوە!</b>\n\n👤 کارمەند: <b>${matchedEmp.name}</b> (${matchedEmp.id})\n🆔 تەلەگرام ئایدی: <code>${targetTelegramId}</code>`,
          getMainReplyKeyboard(isManager)
        );

        // Notify the employee directly in their Telegram chat
        await sendTelegramMessage(
          targetTelegramId,
          `🎉 <b>سڵاو بەڕێز ${matchedEmp.name}</b>\n\nهەژمارەکەت لەلایەن بەڕێوەبەرەوە بە سەرکەوتوویی بەستراوەتەوە بە سیستەمی دەوامی ئاشڵی 🏢\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی هاتن و دەرچوون تۆمار بکەیت:`,
          getMainReplyKeyboard(matchedEmp.id === 'emp-02')
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هەڵە لە بەستنەوە: ${saveRes.error}`,
          getMainReplyKeyboard(isManager)
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. MANAGER COMMAND: /bindings (View all linked Telegram accounts)
    // -------------------------------------------------------------
    if (text === '/bindings' || text === '/telegram_users') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە ئەم لیستە ببینێت.`, getMainReplyKeyboard(isManager));
        return NextResponse.json({ ok: true });
      }

      let msg = `📱 <b>لیستی بەستنەوەی تەلەگرامی کارمەندان:</b>\n\n`;
      let boundCount = 0;
      for (const emp of allEmployees) {
        const boundEntry = Object.entries(bindings).find(([_, info]) => info.employeeId === emp.id);
        if (boundEntry) {
          boundCount++;
          msg += `✅ <b>${emp.name}</b> (${emp.employeeId})\n   🆔 تەلەگرام: <code>${boundEntry[0]}</code>\n\n`;
        } else {
          msg += `⚪ <b>${emp.name}</b> (${emp.employeeId}): <i>(نەبەستراوە)</i>\n\n`;
        }
      }
      msg += `📊 کۆی بەستراوەکان: <b>${boundCount}</b> لە <b>${allEmployees.length}</b> کارمەند\n\n`;
      msg += `💡 <i>بۆ بەستنەوە: <code>/bind [Telegram_ID] [کۆدی کارمەند]</code></i>\n`;
      msg += `💡 <i>بۆ کردنەوە: <code>/unbind [کۆدی کارمەند]</code></i>`;

      await sendTelegramMessage(chatId, msg, getMainReplyKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // If still not bound, prompt to contact Admin
    if (!currentBinding) {
      await sendTelegramMessage(
        chatId,
        `🔒 ئەم هەژمارەی تەلەگرامە هێشتا نەبەستراوەتەوە بە هیچ کارمەندێکەوە.\n\n` +
        `🆔 <b>ئایدی تەلەگرامی تۆ (Telegram ID):</b>\n<code>${fromId}</code>\n\n` +
        `📌 تکایە ئەم ژمارەی ئایدییە بدە بە بەڕێوەبەر (کاک دارکۆ) تاوەکو بە شێوەی فەرمی و دەستی هەژمارەکەت پێوە ببەستێتەوە.\n\n` +
        `🔐 <i>ئەگەر کۆدی تایبەتی (PIN)ت هەیە، دەتوانیت ٤ ژمارەکە بنووسیت.</i>`,
        { remove_keyboard: true }
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
        `• <b>/in</b>: تۆمارکردنی دەوامی هاتن\n` +
        `• <b>/out</b>: تۆمارکردنی دەوامی دەرچوون`;

      if (isManager) {
        helpText += `\n\n<b>🔧 فەرمانەکانی بەڕێوەبەر:</b>\n` +
          `• <b>/bind [Telegram_ID] [کۆد یان ناو]</b>: بەستنەوەی دەستی هەژماری کارمەند\n` +
          `• <b>/bindings</b>: پیشاندانی لیستی کارمەندە بەستراوەکان و نەبەستراوەکان\n` +
          `• <b>/unbind [کۆدی کارمەند]</b>: کردنەوەی قوفڵی هەژمار لەسەر تەلەگرام\n` +
          `• <b>/reset_today</b>: پاککردنەوەی دەوامی ئەمڕۆی خۆت بۆ تاقیکردنەوە`;
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
