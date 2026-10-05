import { NextRequest, NextResponse } from 'next/server';
import { 
  sendTelegramMessage, 
  sendTelegramDocument,
  sendTelegramPhoto,
  editTelegramMessage,
  editTelegramCaption,
  editTelegramCard,
  answerCallbackQuery,
  getTelegramFileUrl,
  getMainReplyKeyboard, 
  getRoleBasedReplyKeyboard,
  getLocationRequestKeyboard, 
  getTelegramBindings, 
  saveTelegramBinding, 
  unbindTelegramAccount,
  getAllEmployees,
  getTodayAttendanceSummary,
  getWarehouseAttendanceSummary,
  resetTodayAttendance,
  getBaghdadNow,
  verifyEmployeePin,
  findEmployeeByPin,
  getPendingPinState,
  setPendingPinState,
  clearPendingPinState,
  saveLeaveRequest,
  updateLeaveRequestStatus,
  markEmployeeAbsent,
  setCompanyHoliday,
  parseTargetDateFromText,
  getEmployeeProfileDetails,
  formatProfileCard,
  getProfileInlineKeyboard,
  getBloodGroupKeyboard,
  getDepartmentKeyboard,
  updateEmployeeProfileField,
  getPendingProfileEdit,
  setPendingProfileEdit,
  clearPendingProfileEdit,
  approveEmployeePhoto,
  broadcastAnnouncement,
} from '@/lib/telegram/telegram-service';
import { 
  resolveEmployeeRole, 
  UserRole, 
  getActionRecipients, 
  hasActionPermission 
} from '@/lib/workflow/workflow-service';
import { 
  getMonthlyAttendanceStats, 
  formatMonthlyReportMessage, 
  getMonthlyReportInlineKeyboard, 
  generateMonthlyAttendancePdf 
} from '@/lib/attendance/report-service';
import { evaluateAndRecordAttendance } from '@/lib/attendance/punch-service';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Temporary in-memory cache for user intents
const PENDING_INTENTS: Record<string, 'check_in' | 'check_out'> = {};
const PENDING_LEAVE: Record<string, boolean> = {};
const PENDING_PHOTOS: Record<string, boolean> = {};

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

    if (!update) {
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 🔔 HANDLE INLINE KEYBOARD CALLBACK QUERIES
    // -------------------------------------------------------------
    if (update.callback_query) {
      const cq = update.callback_query;
      const cqId = cq.id;
      const data: string = cq.data || '';
      const cqFromId = String(cq.from?.id || '');
      const cqChatId = cq.message?.chat?.id || cqFromId;
      const cqMsgId = cq.message?.message_id;

      const bindings = await getTelegramBindings();
      const binding = bindings[cqFromId];
      const cqRole: UserRole = binding ? resolveEmployeeRole(binding.employeeId, binding.employeeName) : 'employee';
      const isManager = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';

      // A. MONTH NAVIGATION (◀️ مانگی پێشوو / مانگی دواتر ▶️)
      if (data.startsWith('month:')) {
        const targetMonth = data.replace('month:', '');
        if (binding) {
          const stats = await getMonthlyAttendanceStats(binding.employeeId, binding.employeeName, targetMonth);
          const text = formatMonthlyReportMessage(stats);
          const kb = getMonthlyReportInlineKeyboard(targetMonth);
          if (cqMsgId) {
            await editTelegramMessage(cqChatId, cqMsgId, text, kb);
          }
          await answerCallbackQuery(cqId);
        } else {
          await answerCallbackQuery(cqId, 'هەژمار نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // B. OFFICIAL PDF DOWNLOAD (📥 داگرتنی پسوولەی فەرمی دەوام)
      if (data.startsWith('pdf:')) {
        const targetMonth = data.replace('pdf:', '');
        if (binding) {
          await answerCallbackQuery(cqId, '⏳ خەریکی ئامادەکردنی فایلی فەرمی PDF ین...');
          const stats = await getMonthlyAttendanceStats(binding.employeeId, binding.employeeName, targetMonth);
          const pdfBuf = await generateMonthlyAttendancePdf(stats);
          const filename = `Ashley_Report_${targetMonth}_${binding.employeeId}.pdf`;
          const caption = `📄 <b>پسوولەی فەرمی دەوامی مانگی (${targetMonth})</b>\n\n👤 کارمەند: <b>${binding.employeeName}</b>\n🏢 کۆمپانیای ئاشڵی بۆ مۆبیلیات`;
          await sendTelegramDocument(cqChatId, pdfBuf, filename, caption);
        } else {
          await answerCallbackQuery(cqId, 'هەژمار نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // C. EDIT PROFILE: CHANGE PHOTO (📸 گۆڕینی وێنە)
      if (data === 'prof:photo' || data === 'req_photo') {
        await setPendingProfileEdit(cqFromId, 'photo');
        PENDING_PHOTOS[cqFromId] = true;
        await answerCallbackQuery(cqId);
        await sendTelegramMessage(
          cqChatId,
          `📸 <b>گۆڕینی وێنەی پرۆفایل:</b>\n\nتکایە ئێستا <b>وێنەیەکی نوێی خۆت</b> وەک فایلی وێنە بنێرە.\nسیستەم دەستبەجێ لە پرۆفایلەکەتدا جێگیری دەکات.\n\n<i>(یان بنووسە: ❌ هەڵوەشاندنەوە)</i>`,
          {
            keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }

      // D. EDIT PROFILE: CHANGE PHONE (📞 گۆڕینی ژمارەی مۆبایل)
      if (data === 'prof:phone') {
        await setPendingProfileEdit(cqFromId, 'phone');
        await answerCallbackQuery(cqId);
        await sendTelegramMessage(
          cqChatId,
          `📞 <b>گۆڕینی ژمارەی مۆبایل:</b>\n\nتکایە <b>ژمارە مۆبایلی نوێت</b> بنووسە:\n<i>(نموونە: 07701234567 یان 07501234567)</i>\n\n<i>(یان بنووسە: ❌ هەڵوەشاندنەوە)</i>`,
          {
            keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }

      // E. EDIT PROFILE: CHANGE ADDRESS (📍 گۆڕینی ناونیشان)
      if (data === 'prof:address') {
        await setPendingProfileEdit(cqFromId, 'address');
        await answerCallbackQuery(cqId);
        await sendTelegramMessage(
          cqChatId,
          `📍 <b>گۆڕینی ناونیشان / شوێنی نیشتەجێبوون:</b>\n\nتکایە <b>ناونیشانی نوێت</b> بنووسە:\n<i>(نموونە: سلێمانی - ڕاپەڕین یان هەولێر - بەختیاری)</i>\n\n<i>(یان بنووسە: ❌ هەڵوەشاندنەوە)</i>`,
          {
            keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return NextResponse.json({ ok: true });
      }

      // F. EDIT PROFILE: SELECT BLOOD GROUP (🩸 گرووپی خوێن)
      if (data === 'prof:blood') {
        await answerCallbackQuery(cqId);
        if (cqMsgId) {
          const bloodKb = getBloodGroupKeyboard();
          await editTelegramCard(
            cqChatId,
            cqMsgId,
            `🩸 <b>دیاریکردنی گرووپی خوێن:</b>\n\nتکایە گرووپی خوێنی خۆت لە دوگمەکانی خوارەوە هەڵبژێرە:`,
            bloodKb
          );
        }
        return NextResponse.json({ ok: true });
      }

      // G. SAVE BLOOD GROUP
      if (data.startsWith('set_blood:')) {
        const blood = data.replace('set_blood:', '');
        if (binding) {
          await updateEmployeeProfileField(binding.employeeId, 'bloodType', blood);
          await answerCallbackQuery(cqId, `✅ گرووپی خوێن دیاریکرا: ${blood}`);
          if (cqMsgId) {
            const updated = await getEmployeeProfileDetails(binding.employeeId);
            await editTelegramCard(
              cqChatId,
              cqMsgId,
              formatProfileCard(updated),
              getProfileInlineKeyboard()
            );
          }
        } else {
          await answerCallbackQuery(cqId, 'هەژمار نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // H. EDIT PROFILE: SELECT DEPARTMENT (🏢 بەش / لق)
      if (data === 'prof:dept') {
        await answerCallbackQuery(cqId);
        if (cqMsgId) {
          const deptKb = getDepartmentKeyboard();
          await editTelegramCard(
            cqChatId,
            cqMsgId,
            `🏢 <b>دیاریکردنی بەش / لقی کارکردن:</b>\n\nتکایە بەشەکەت لە خوارەوە هەڵبژێرە:`,
            deptKb
          );
        }
        return NextResponse.json({ ok: true });
      }

      // I. SAVE DEPARTMENT
      if (data.startsWith('set_dept:')) {
        const dept = data.replace('set_dept:', '');
        if (binding) {
          await updateEmployeeProfileField(binding.employeeId, 'department', dept);
          await answerCallbackQuery(cqId, `✅ بەش نوێکرایەوە: ${dept}`);
          if (cqMsgId) {
            const updated = await getEmployeeProfileDetails(binding.employeeId);
            await editTelegramCard(
              cqChatId,
              cqMsgId,
              formatProfileCard(updated),
              getProfileInlineKeyboard()
            );
          }
        } else {
          await answerCallbackQuery(cqId, 'هەژمار نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // J. REFRESH PROFILE (🔄 نوێکردنەوەی پرۆفایل)
      if (data === 'prof:refresh') {
        if (binding) {
          await answerCallbackQuery(cqId, '🔄 پرۆفایل نوێکرایەوە');
          if (cqMsgId) {
            const updated = await getEmployeeProfileDetails(binding.employeeId);
            await editTelegramCard(
              cqChatId,
              cqMsgId,
              formatProfileCard(updated),
              getProfileInlineKeyboard()
            );
          }
        } else {
          await answerCallbackQuery(cqId, 'هەژمار نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // D. ADMIN APPROVES PHOTO
      if (data.startsWith('photo_app:')) {
        if (!isManager) {
          await answerCallbackQuery(cqId, '⛔ تەنها بەڕێوەبەر دەسەڵاتی پەسەندکردنی هەیە.', true);
          return NextResponse.json({ ok: true });
        }
        const parts = data.split(':');
        const targetEmpId = parts[1];
        const fileId = parts[2];
        const photoUrl = await getTelegramFileUrl(fileId);
        if (photoUrl) {
          await approveEmployeePhoto(targetEmpId, photoUrl);
          await answerCallbackQuery(cqId, '✅ وێنەکە پەسەندکرا');
          if (cqMsgId) {
            await editTelegramMessage(cqChatId, cqMsgId, `✅ وێنەی نوێ بۆ کارمەند (${targetEmpId}) بە سەرکەوتوویی پەسەندکرا.`);
          }
          const empEntry = Object.entries(bindings).find(([_, info]) => info.employeeId === targetEmpId);
          if (empEntry) {
            await sendTelegramMessage(
              empEntry[0],
              `🎉 <b>پیرۆزە!</b> وێنەی نوێی پرۆفایلەکەت لەلایەن بەڕێوەبەرەوە پەسەندکرا و لە سیستەمی فەرمیدا جێگیر کرا.`
            );
          }
        }
        return NextResponse.json({ ok: true });
      }

      // E. ADMIN REJECTS PHOTO
      if (data.startsWith('photo_rej:')) {
        const targetEmpId = data.replace('photo_rej:', '');
        await answerCallbackQuery(cqId, '❌ ڕەتکرایەوە');
        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, `❌ داواکاری وێنەی کارمەند (${targetEmpId}) ڕەتکرایەوە.`);
        }
        return NextResponse.json({ ok: true });
      }

      // F. ADMIN APPROVES LEAVE REQUEST
      // F. APPROVE LEAVE REQUEST (کاک دارکۆ، کاک کامەران، یان بەڕێوەبەری گشتی)
      if (data.startsWith('leave_app:')) {
        const canApprove = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';
        if (!canApprove) {
          await answerCallbackQuery(cqId, '⛔ دەسەڵاتی پەسەندکردنی مۆڵەتت نییە.', true);
          return NextResponse.json({ ok: true });
        }

        const reqId = data.replace('leave_app:', '');
        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : 'بەڕێوەبەر');
        const updated = await updateLeaveRequestStatus(reqId, 'approved', approverName);

        if (updated) {
          const appliedDate = updated.targetDate || parseTargetDateFromText(updated.details) || getBaghdadNow().dateStr;
          await answerCallbackQuery(cqId, '✅ مۆڵەتەکە پەسەندکرا');
          if (cqMsgId) {
            await editTelegramMessage(
              cqChatId,
              cqMsgId,
              `✅ <b>داواکاری مۆڵەت پەسەندکرا:</b>\n\n👤 کارمەند: <b>${updated.employeeName}</b> (${updated.employeeId})\n📅 بەروار: <b>${appliedDate}</b>\n📝 هۆکار: ${updated.details}\n✍️ پەسەندکرا لەلایەن: <b>${approverName}</b>\n🕒 دۆخ: لە خشتەی فەرمی دەوام و مۆڵەتەکاندا بە سەرکەوتوویی جێگیر کرا.`
            );
          }
          await sendTelegramMessage(
            updated.chatId,
            `🎉 <b>پیرۆزە بەڕێز ${updated.employeeName}!</b>\n\nداواکاری مۆڵەتەکەت بۆ بەرواری <b>${appliedDate}</b> (${updated.details}) لەلایەن <b>${approverName}</b> پەسەندکرا و لە خشتەی فەرمی دەوامدا تۆمارکرا.`
          );
        } else {
          await answerCallbackQuery(cqId, '❌ ئەم داواکارییە نەدۆزرایەوە', true);
        }
        return NextResponse.json({ ok: true });
      }

      // G. REJECT LEAVE REQUEST
      if (data.startsWith('leave_rej:')) {
        const canApprove = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';
        if (!canApprove) {
          await answerCallbackQuery(cqId, '⛔ تەنها بەڕێوەبەر دەسەڵاتی هەیە.', true);
          return NextResponse.json({ ok: true });
        }
        const reqId = data.replace('leave_rej:', '');
        const approverName = binding?.employeeName || 'بەڕێوەبەر';
        const updated = await updateLeaveRequestStatus(reqId, 'rejected', approverName);
        if (updated) {
          await answerCallbackQuery(cqId, '❌ ڕەتکرایەوە');
          if (cqMsgId) {
            await editTelegramMessage(
              cqChatId,
              cqMsgId,
              `❌ <b>داواکاری مۆڵەت ڕەتکرایەوە:</b>\n\n👤 کارمەند: <b>${updated.employeeName}</b> (${updated.employeeId})\n📝 هۆکار: ${updated.details}\n✍️ لەلایەن: <b>${approverName}</b>`
            );
          }
          await sendTelegramMessage(
            updated.chatId,
            `ℹ️ <b>ئاگاداری داواکاری مۆڵەت:</b>\n\nداواکاری مۆڵەتەکەت (${updated.details}) لەلایەن ${approverName} پەسەند نەکرا.`
          );
        }
        return NextResponse.json({ ok: true });
      }

      // H. SELECT EMPLOYEE TO MARK ABSENT (کاک کامەران یان کاک دارکۆ)
      if (data.startsWith('mark_abs_emp:')) {
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';
        if (!canManage) {
          await answerCallbackQuery(cqId, '⛔ دەسەڵاتت نییە.', true);
          return NextResponse.json({ ok: true });
        }
        const targetEmpId = data.replace('mark_abs_emp:', '');
        const allEmps = await getAllEmployees();
        const targetEmp = allEmps.find(e => e.id === targetEmpId || e.employeeId === targetEmpId);
        const name = targetEmp?.name || targetEmpId;

        await answerCallbackQuery(cqId);
        if (cqMsgId) {
          await editTelegramMessage(
            cqChatId,
            cqMsgId,
            `❌ <b>دیاریکردنی بەرواری غیاب بۆ: ${name}</b>\n\nتکایە بەروارەکەی دیاری بکە:`,
            {
              inline_keyboard: [
                [
                  { text: '📅 بۆ ئەمڕۆ', callback_data: `mark_abs_date:${targetEmpId}:today` },
                  { text: '📅 بۆ دوێنێ', callback_data: `mark_abs_date:${targetEmpId}:yesterday` },
                ],
                [
                  { text: '❌ هەڵوەشاندنەوە', callback_data: 'prof:refresh' },
                ],
              ],
            }
          );
        }
        return NextResponse.json({ ok: true });
      }

      // I. EXECUTE MARK ABSENT
      if (data.startsWith('mark_abs_date:')) {
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';
        if (!canManage) {
          await answerCallbackQuery(cqId, '⛔ دەسەڵاتت نییە.', true);
          return NextResponse.json({ ok: true });
        }
        const parts = data.split(':');
        const targetEmpId = parts[1];
        const when = parts[2];

        const { dateStr } = getBaghdadNow();
        let targetDate = dateStr;
        if (when === 'yesterday') {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          targetDate = d.toISOString().slice(0, 10);
        }

        const allEmps = await getAllEmployees();
        const targetEmp = allEmps.find(e => e.id === targetEmpId || e.employeeId === targetEmpId);
        const name = targetEmp?.name || targetEmpId;
        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : 'بەڕێوەبەر');

        await markEmployeeAbsent(targetEmpId, name, targetDate, approverName);
        await answerCallbackQuery(cqId, `✅ غیاب بۆ ${name} تۆمارکرا`);
        if (cqMsgId) {
          await editTelegramMessage(
            cqChatId,
            cqMsgId,
            `✅ <b>تۆمارکردنی غیاب سەرکەوتوو بوو:</b>\n\n👤 کارمەند: <b>${name}</b> (${targetEmpId})\n📅 بەروار: <b>${targetDate}</b>\n✍️ تۆمارکرا لەلایەن: <b>${approverName}</b>\n🕒 دۆخ: غیاب لە سیستەمی دەوام و ڕاپۆرتەکاندا جێگیر کرا.`
          );
        }
        return NextResponse.json({ ok: true });
      }

      // J. SET COMPANY HOLIDAY
      if (data.startsWith('set_hol:')) {
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager';
        if (!canManage) {
          await answerCallbackQuery(cqId, '⛔ دەسەڵاتت نییە.', true);
          return NextResponse.json({ ok: true });
        }
        const when = data.replace('set_hol:', '');
        const { dateStr } = getBaghdadNow();
        let targetDate = dateStr;
        if (when === 'tomorrow') {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          targetDate = d.toISOString().slice(0, 10);
        }

        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : 'بەڕێوەبەر');
        await setCompanyHoliday(targetDate, 'پشووی فەرمی کۆمپانیا', approverName);
        await answerCallbackQuery(cqId, '🌴 پشووی فەرمی دیاریکرا');
        if (cqMsgId) {
          await editTelegramMessage(
            cqChatId,
            cqMsgId,
            `🌴 <b>پشووی فەرمی دیاریکرا:</b>\n\n📅 بەروار: <b>${targetDate}</b>\n✍️ دیاریکرا لەلایەن: <b>${approverName}</b>\n🏢 ئەم ڕۆژە لە تەواوی خشتەی دەوامی کارمەندانی ئاشڵی بە پشوو تۆمارکرا.`
          );
        }
        return NextResponse.json({ ok: true });
      }

      await answerCallbackQuery(cqId);
      return NextResponse.json({ ok: true });
    }

    if (!update.message) {
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

        const targetEmpRole = resolveEmployeeRole(pendingPin.employeeId, pendingPin.employeeName);
        await sendTelegramMessage(
          chatId,
          `✅ <b>پیرۆزە! کۆدی نهێنی پەسەندکرا و هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n👤 ناوی کارمەند: <b>${pendingPin.employeeName}</b>\n🆔 کۆدی کارمەند: <b>${pendingPin.employeeId}</b>\n🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم ئەکاونت و ئامێرەی تەلەگرامە قوفڵکرا.\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە دەوام تۆمار بکەیت:`,
          getMainReplyKeyboard(targetEmpRole)
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
    const userRole: UserRole = currentBinding ? resolveEmployeeRole(currentBinding.employeeId, currentBinding.employeeName) : 'employee';
    const isManager = userRole === 'founder' || userRole === 'warehouse_manager' || userRole === 'general_manager';

    // -------------------------------------------------------------
    // HANDLE PROFILE PHOTO SUBMISSION
    // -------------------------------------------------------------
    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      const pendingProfileEdit = await getPendingProfileEdit(fromId);
      if ((pendingProfileEdit === 'photo' || PENDING_PHOTOS[fromId]) && currentBinding) {
        await clearPendingProfileEdit(fromId);
        delete PENDING_PHOTOS[fromId];
        const largest = message.photo[message.photo.length - 1];
        const fileId = largest.file_id;
        const photoUrl = await getTelegramFileUrl(fileId);

        if (photoUrl) {
          await updateEmployeeProfileField(currentBinding.employeeId, 'photoUrl', photoUrl);
        }

        await sendTelegramMessage(
          chatId,
          `✅ <b>وێنەی نوێی پرۆفایلەکەت بە سەرکەوتوویی نوێکرایەوە!</b>`,
          getMainReplyKeyboard(userRole)
        );

        // Send the updated profile card with the new photo!
        const updated = await getEmployeeProfileDetails(currentBinding.employeeId);
        const cardMsg = formatProfileCard(updated);
        const kb = getProfileInlineKeyboard();
        if (updated.photoUrl) {
          await sendTelegramPhoto(chatId, updated.photoUrl, cardMsg, kb);
        } else {
          await sendTelegramMessage(chatId, cardMsg, kb);
        }

        // Notify manager as a notice (non-blocking)
        const mgrChatId = Object.entries(bindings).find(([_, info]) => info.employeeId === 'emp-02')?.[0];
        if (mgrChatId && mgrChatId !== chatId) {
          const caption =
            `📸 <b>نوێکردنەوەی وێنەی کارمەند:</b>\n\n` +
            `👤 کارمەند: <b>${currentBinding.employeeName}</b>\n` +
            `🆔 کۆد: <b>${currentBinding.employeeId}</b>\n` +
            `🕒 کات: ${getBaghdadNow().dateStr} ${getBaghdadNow().timeStr}\n\n` +
            `<i>وێنەکە لە سیستەمی فەرمیدا جێگیر کرا.</i>`;
          await sendTelegramPhoto(mgrChatId, fileId, caption);
        }
        return NextResponse.json({ ok: true });
      }
    }

    // -------------------------------------------------------------
    // HANDLE PROFILE TEXT EDITS (PHONE & ADDRESS)
    // -------------------------------------------------------------
    const pendingProfileEdit = await getPendingProfileEdit(fromId);
    if (pendingProfileEdit && text && !text.startsWith('/') && currentBinding) {
      if (text === '❌ هەڵوەشاندنەوە') {
        await clearPendingProfileEdit(fromId);
        await sendTelegramMessage(chatId, `دەستکاریکردنی پرۆفایل هەڵوەشێندرایەوە.`, getMainReplyKeyboard(userRole));
        return NextResponse.json({ ok: true });
      }

      if (pendingProfileEdit === 'phone') {
        const cleanDigits = text.replace(/[^\d+]/g, '');
        if (cleanDigits.length < 7) {
          await sendTelegramMessage(
            chatId,
            `❌ <b>ژمارەی مۆبایل دروست نییە!</b>\n\nتکایە ژمارەیەکی دروست بنووسە (کەمترین ٧ ژمارە)، یان دوگمەی [❌ هەڵوەشاندنەوە] دابگرە:`,
            {
              keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            }
          );
          return NextResponse.json({ ok: true });
        }

        await updateEmployeeProfileField(currentBinding.employeeId, 'phone', cleanDigits);
        await clearPendingProfileEdit(fromId);

        await sendTelegramMessage(
          chatId,
          `✅ <b>ژمارەی مۆبایل بە سەرکەوتوویی نوێکرایەوە!</b>`,
          getMainReplyKeyboard(userRole)
        );

        const updated = await getEmployeeProfileDetails(currentBinding.employeeId);
        const cardMsg = formatProfileCard(updated);
        const kb = getProfileInlineKeyboard();
        if (updated.photoUrl) {
          await sendTelegramPhoto(chatId, updated.photoUrl, cardMsg, kb);
        } else {
          await sendTelegramMessage(chatId, cardMsg, kb);
        }
        return NextResponse.json({ ok: true });
      }

      if (pendingProfileEdit === 'address') {
        await updateEmployeeProfileField(currentBinding.employeeId, 'address', text);
        await clearPendingProfileEdit(fromId);

        await sendTelegramMessage(
          chatId,
          `✅ <b>ناونیشان بە سەرکەوتوویی نوێکرایەوە!</b>`,
          getMainReplyKeyboard(userRole)
        );

        const updated = await getEmployeeProfileDetails(currentBinding.employeeId);
        const cardMsg = formatProfileCard(updated);
        const kb = getProfileInlineKeyboard();
        if (updated.photoUrl) {
          await sendTelegramPhoto(chatId, updated.photoUrl, cardMsg, kb);
        } else {
          await sendTelegramMessage(chatId, cardMsg, kb);
        }
        return NextResponse.json({ ok: true });
      }
    }

    // -------------------------------------------------------------
    // HANDLE LEAVE REQUEST TEXT SUBMISSION
    // -------------------------------------------------------------
    if (PENDING_LEAVE[fromId] && text && !text.startsWith('/') && currentBinding) {
      delete PENDING_LEAVE[fromId];
      if (text === '❌ هەڵوەشاندنەوە') {
        await sendTelegramMessage(chatId, `داواکاری مۆڵەت هەڵوەشێندرایەوە.`, getMainReplyKeyboard(userRole));
        return NextResponse.json({ ok: true });
      }

      const parsedTargetDate = parseTargetDateFromText(text);
      const req = await saveLeaveRequest(currentBinding.employeeId, currentBinding.employeeName, chatId, text, parsedTargetDate);
      await sendTelegramMessage(
        chatId,
        `✅ <b>داواکاری مۆڵەتەکەت تۆمارکرا!</b>\n\n📅 بەرواری مۆڵەت: <b>${parsedTargetDate}</b>\n📝 هۆکار و کات: <i>${text}</i>\n\nڕەوانەی بەڕێوەبەرایەتی کرا بۆ پێداچوونەوە و پەسەندکردن. دوای بڕیاردان ڕاستەوخۆ لێرە ئەنجامەکەت پێ دەگاتەوە.`,
        getMainReplyKeyboard(userRole)
      );

      const approvers = await getActionRecipients('leave_approval', bindings);
      for (const approver of approvers) {
        if (String(approver.chatId) === String(chatId)) continue;
        const mgrText =
          `🔔 <b>داواکاری مۆڵەتی نوێ:</b>\n\n` +
          `👤 کارمەند: <b>${currentBinding.employeeName}</b> (${currentBinding.employeeId})\n` +
          `📅 بەرواری دیاریکراو: <b>${parsedTargetDate}</b>\n` +
          `📝 هۆکار و تێبینی: <b>${text}</b>\n` +
          `🕒 کاتی داواکاری: ${getBaghdadNow().timeStr}`;

        await sendTelegramMessage(approver.chatId, mgrText, {
          inline_keyboard: [
            [
              { text: '✅ پەسەندکردنی مۆڵەت', callback_data: `leave_app:${req.id}` },
              { text: '❌ ڕەتکردنەوە', callback_data: `leave_rej:${req.id}` },
            ],
          ],
        });
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 5. COMMAND: /start
    // -------------------------------------------------------------
    if (text === '/start') {
      if (currentBinding) {
        await sendTelegramMessage(
          chatId,
          `سڵاو بەڕێز <b>${currentBinding.employeeName}</b> ✨\nبەخێربێیت بۆ سیستەمی فەرمی دەوامی ئاشڵی 🏢\n\nتکایە لە دوگمەکانی خوارەوە هەڵبژێرە:`,
          getMainReplyKeyboard(userRole)
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
          getMainReplyKeyboard(userRole)
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
          const boundEmpRole = resolveEmployeeRole(matchedEmp.id, matchedEmp.name);
          await sendTelegramMessage(
            chatId,
            `✅ <b>پیرۆزە! هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n` +
            `👤 ناوی کارمەند: <b>${matchedEmp.name}</b>\n` +
            `🆔 کۆدی کارمەند: <b>${matchedEmp.id}</b>\n` +
            `🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم مۆبایل و ئەکاونتەی تەلەگرام قوفڵکرا.\n\n` +
            `ئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی دەوام تۆمار بکەیت:`,
            getMainReplyKeyboard(boundEmpRole)
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
          getMainReplyKeyboard(userRole)
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
          getMainReplyKeyboard(userRole)
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
          getMainReplyKeyboard(userRole)
        );
        return NextResponse.json({ ok: true });
      }

      const saveRes = await saveTelegramBinding(targetTelegramId, matchedEmp.id, matchedEmp.name, true);
      if (saveRes.success) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>هەژمار بە سەرکەوتوویی بەستراوەتەوە!</b>\n\n👤 کارمەند: <b>${matchedEmp.name}</b> (${matchedEmp.id})\n🆔 تەلەگرام ئایدی: <code>${targetTelegramId}</code>`,
          getMainReplyKeyboard(userRole)
        );

        // Notify the employee directly in their Telegram chat
        await sendTelegramMessage(
          targetTelegramId,
          `🎉 <b>سڵاو بەڕێز ${matchedEmp.name}</b>\n\nهەژمارەکەت لەلایەن بەڕێوەبەرەوە بە سەرکەوتوویی بەستراوەتەوە بە سیستەمی دەوامی ئاشڵی 🏢\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی هاتن و دەرچوون تۆمار بکەیت:`,
          getMainReplyKeyboard(resolveEmployeeRole(matchedEmp.id, matchedEmp.name))
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هەڵە لە بەستنەوە: ${saveRes.error}`,
          getMainReplyKeyboard(userRole)
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. MANAGER COMMAND: /bindings (View all linked Telegram accounts)
    // -------------------------------------------------------------
    if (text === '/bindings' || text === '/telegram_users') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە ئەم لیستە ببینێت.`, getMainReplyKeyboard(userRole));
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

      await sendTelegramMessage(chatId, msg, getMainReplyKeyboard(userRole));
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
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە قوفڵی هەژمارەکان بکاتەوە.`, getMainReplyKeyboard(userRole));
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      const target = parts[1]?.trim();
      if (!target) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>شێوازی کردنەوەی قوفڵی هەژمار:</b>\n<code>/unbind [کۆدی کارمەند]</code>\nنموونە: <code>/unbind emp-05</code>`,
          getMainReplyKeyboard(userRole)
        );
        return NextResponse.json({ ok: true });
      }

      const unbindSuccess = await unbindTelegramAccount(target);
      if (unbindSuccess) {
        await sendTelegramMessage(
          chatId,
          `🔓 <b>هەژماری (${target}) بە سەرکەوتوویی لە تەلەگرام کرایەوە!</b>\nئێستا دەتوانێت لە مۆبایلێکی نوێوە ببەسترێتەوە.`,
          getMainReplyKeyboard(userRole)
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هیچ تۆمارێکی تەلەگرام نەدۆزرایەوە بە کۆدی: <b>${target}</b>`,
          getMainReplyKeyboard(userRole)
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. ACTION: TODAY'S ATTENDANCE SUMMARY LIST / WAREHOUSE ATTENDANCE
    // -------------------------------------------------------------
    if (text === '📦 ئامادەبووانی کۆگا') {
      const summary = await getWarehouseAttendanceSummary();
      await sendTelegramMessage(chatId, summary, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    if (
      text === '📋 لیستی گشتی دەوام' || 
      text === '📋 لیستی ئامادەبووانی ئەمڕۆ' || 
      text === '/list' || 
      text === '/today'
    ) {
      const summary = await getTodayAttendanceSummary();
      await sendTelegramMessage(chatId, summary, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10. ACTION: MONTHLY ATTENDANCE REPORT WITH PDF & NAVIGATION
    // -------------------------------------------------------------
    if (text === '📅 دۆخی دەوامی ئەم مانگەم' || text === '/month' || text === '/report') {
      const stats = await getMonthlyAttendanceStats(currentBinding.employeeId, currentBinding.employeeName);
      const reportMsg = formatMonthlyReportMessage(stats);
      const kb = getMonthlyReportInlineKeyboard(stats.monthStr);
      await sendTelegramMessage(chatId, reportMsg, kb);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10b. ACTION: MY OFFICIAL PROFILE CARD
    // -------------------------------------------------------------
    if (text === '👤 پرۆفایلی من' || text === '/profile') {
      const profile = await getEmployeeProfileDetails(currentBinding.employeeId);
      const profileMsg = formatProfileCard(profile);
      const kb = getProfileInlineKeyboard();

      if (profile.photoUrl) {
        await sendTelegramPhoto(chatId, profile.photoUrl, profileMsg, kb);
      } else {
        await sendTelegramMessage(chatId, profileMsg, kb);
      }
      return NextResponse.json({ ok: true });
    }

    // 🔒 STRICT IMMUTABILITY GUARD: EMPLOYEES CANNOT ALTER THEIR NAME UNDER ANY CIRCUMSTANCES
    if (
      text.startsWith('/name') || 
      text.startsWith('/edit_name') || 
      text.startsWith('/change_name') || 
      text.startsWith('/set_name')
    ) {
      await sendTelegramMessage(
        chatId,
        `⛔ <b>دەستکاریکردنی ناو بە هیچ شێوەیەک ڕێگەپێدراو نییە!</b>\n\n🔒 ناوی فەرمی کارمەند لە سیستەمی کۆمپانیای ئاشڵی قوفڵ کراوە و پارێزراوە بۆ ڕێگری لە هەر چەشنە ساختەکاری و تەزویرێک.\nگۆڕینی ناو تەنها و تەنها لە دەسەڵاتی بەڕێوەبەردایە لە سیستەمی سەرەکی ERP.`,
        getMainReplyKeyboard(userRole)
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10c. ACTION: REQUEST OFFICIAL LEAVE / VIEW LEAVE REQUESTS
    // -------------------------------------------------------------
    if (text === '🏖️ داواکارییەکانی مۆڵەت' || text === '/pending_leaves') {
      if (isManager) {
        try {
          const { data: setRow } = await supabase
            .from('warehouses')
            .select('qr_code')
            .eq('id', 'ashley_leave_requests')
            .maybeSingle();

          let allReqs: Record<string, any> = {};
          if (setRow?.qr_code) {
            allReqs = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
          }

          const pendingList = Object.values(allReqs).filter((r: any) => r.status === 'pending');
          if (pendingList.length === 0) {
            await sendTelegramMessage(
              chatId,
              `🏖️ <b>داواکارییەکانی مۆڵەت:</b>\n\nلە ئێستادا هیچ داواکارییەکی هەڵپەسێردراو نییە ✨`,
              getMainReplyKeyboard(userRole)
            );
            return NextResponse.json({ ok: true });
          }

          await sendTelegramMessage(
            chatId,
            `🏖️ <b>لیستی داواکارییە هەڵپەسێردراوەکانی مۆڵەت (${pendingList.length}):</b>\nتکایە بڕیاریان لەسەر بدە:`,
            getMainReplyKeyboard(userRole)
          );

          for (const req of pendingList.slice(0, 5)) {
            const reqDate = req.targetDate || parseTargetDateFromText(req.details) || 'ئەمڕۆ';
            await sendTelegramMessage(
              chatId,
              `👤 کارمەند: <b>${req.employeeName}</b> (${req.employeeId})\n📅 بەروار: <b>${reqDate}</b>\n📝 هۆکار: ${req.details}`,
              {
                inline_keyboard: [
                  [
                    { text: '✅ پەسەندکردنی مۆڵەت', callback_data: `leave_app:${req.id}` },
                    { text: '❌ ڕەتکردنەوە', callback_data: `leave_rej:${req.id}` },
                  ],
                ],
              }
            );
          }
          return NextResponse.json({ ok: true });
        } catch (err: any) {
          logger.error('Error fetching pending leaves:', err);
        }
      }

      // If regular employee clicks it, treat as requesting leave
      PENDING_LEAVE[fromId] = true;
      await sendTelegramMessage(
        chatId,
        `🏖️ <b>داواکردنی مۆڵەتی فەرمی:</b>\n\n` +
        `تکایە <b>ڕۆژ و هۆکاری مۆڵەتەکەت</b> بنووسە:\n` +
        `<i>نموونە: سبەی ١١-١٠-٢٠٢٦ بەهۆی سەردانی پزیشک</i>\n\n` +
        `(یان بنووسە: ❌ هەڵوەشاندنەوە)`,
        {
          keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '🏖️ داواکردنی مۆڵەت' || text === '/leave') {
      PENDING_LEAVE[fromId] = true;
      await sendTelegramMessage(
        chatId,
        `🏖️ <b>داواکردنی مۆڵەتی فەرمی:</b>\n\n` +
        `تکایە <b>ڕۆژ و هۆکاری مۆڵەتەکەت</b> بنووسە:\n` +
        `<i>نموونە: سبەی ١١-١٠-٢٠٢٦ بەهۆی سەردانی پزیشک</i>\n\n` +
        `(یان بنووسە: ❌ هەڵوەشاندنەوە)`,
        {
          keyboard: [[{ text: '❌ هەڵوەشاندنەوە' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10d. ACTION: MARK ABSENCE (❌ تۆمارکردنی غیاب - کاک کامەران و بەڕێوەبەر)
    // -------------------------------------------------------------
    if (text === '❌ تۆمارکردنی غیاب') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ دەسەڵاتی تۆمارکردنی غیابت نییە.`, getMainReplyKeyboard(userRole));
        return NextResponse.json({ ok: true });
      }

      const inlineRows: any[][] = [];
      for (let i = 0; i < allEmployees.length; i += 2) {
        const row = [
          { text: `👤 ${allEmployees[i].name}`, callback_data: `mark_abs_emp:${allEmployees[i].id}` },
        ];
        if (i + 1 < allEmployees.length) {
          row.push({ text: `👤 ${allEmployees[i + 1].name}`, callback_data: `mark_abs_emp:${allEmployees[i + 1].id}` });
        }
        inlineRows.push(row);
      }

      await sendTelegramMessage(
        chatId,
        `❌ <b>تۆمارکردنی غیابی فەرمی بۆ کارمەند:</b>\n\nتکایە ناوی ئەو کارمەندە هەڵبژێرە کە دەتەوێت غیابی بۆ تۆمار بکەیت:`,
        { inline_keyboard: inlineRows }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10e. ACTION: DEFINE COMPANY HOLIDAY (🌴 دیاریکردنی پشوو)
    // -------------------------------------------------------------
    if (text === '🌴 دیاریکردنی پشوو') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ دەسەڵاتی دیاریکردنی پشووت نییە.`, getMainReplyKeyboard(userRole));
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(
        chatId,
        `🌴 <b>دیاریکردنی پشووی فەرمی کۆمپانیا:</b>\n\nتکایە ئەو ڕۆژە هەڵبژێرە کە دەبێتە پشووی فەرمی بۆ هەموو کارمەندانی ئاشڵی:`,
        {
          inline_keyboard: [
            [
              { text: '🌴 پشووی ئەمڕۆ', callback_data: 'set_hol:today' },
              { text: '🌴 پشووی سبەینێ', callback_data: 'set_hol:tomorrow' },
            ],
          ],
        }
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10f. ACTION: VIEW BINDINGS (📱 بەستنەوەی ئامێرەکان)
    // -------------------------------------------------------------
    if (text === '📱 بەستنەوەی ئامێرەکان') {
      if (userRole !== 'founder' && userRole !== 'it_admin' && !isManager) {
        await sendTelegramMessage(chatId, `⛔ دەسەڵاتی بینینی بەستنەوەی ئامێرەکانت نییە.`, getMainReplyKeyboard(userRole));
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

      await sendTelegramMessage(chatId, msg, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10g. ACTION: LOCATIONS INFO (ℹ️ شوێنەکانی دەوام)
    // -------------------------------------------------------------
    if (text === 'ℹ️ شوێنەکانی دەوام') {
      const infoMsg = 
        `🏢 <b>شوێنە پەسەندکراوەکانی کۆمپانیای ئاشڵی بۆ تۆمارکردنی دەوام:</b>\n\n` +
        `1️⃣ <b>کۆگای سەرەکی و کارگە:</b>\n` +
        `   📍 سلێمانی - ڕاپەڕین (مەودای ڕێگەپێدراو: 150m)\n` +
        `   👤 بەرپرسی کۆگا: <b>کاک کامەران عومەر</b>\n\n` +
        `2️⃣ <b>پێشانگای ئاشڵی سەرەکی:</b>\n` +
        `   📍 سلێمانی - شەقامی سەرەکی بازنەیی مەلیک مەحمود\n\n` +
        `3️⃣ <b>دیوانی بەڕێوەبەرایەتی سەرەکی:</b>\n` +
        `   📍 ئۆفیسی سەرەکی ئاشڵی\n\n` +
        `4️⃣ <b>لقی هەولێر و دهۆک:</b>\n` +
        `   📍 پێشانگاکان و ئۆفیسی هەرێمی\n\n` +
        `🔒 تۆمارکردنی دەوام بەپێی GPS دەپشکنرێت تا دڵنیابین لە ئامادەبوونت لە شوێنی کار.`;
      await sendTelegramMessage(chatId, infoMsg, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10h. ACTION: SYSTEM DIAGNOSTICS (🔍 پشکنینی سیستەم)
    // -------------------------------------------------------------
    if (text === '🔍 پشکنینی سیستەم') {
      const boundCount = Object.keys(bindings).length;
      const { dateStr, timeStr } = getBaghdadNow();
      const statusMsg = 
        `⚙️ <b>دۆخی سیستەمی ئاشڵی (System Diagnostics):</b>\n\n` +
        `✅ مەکینەی بنکەدراوە: <b>چالاکە (Supabase Connected)</b>\n` +
        `✅ بۆتی تەلەگرام: <b>ئۆنلاین و ڕاستەوخۆ</b>\n` +
        `📱 ئامێرە قوفڵکراوەکان: <b>${boundCount} مۆبایل</b>\n` +
        `👥 کۆی کارمەندان: <b>${allEmployees.length} کارمەند</b>\n` +
        `🕒 کاتی بەغدا: <b>${dateStr} - ${timeStr}</b>\n` +
        `🛡️ پاراستنی دژە-تەزویر: <b>چالاکە (Single-Device Strict Lock)</b>`;
      await sendTelegramMessage(chatId, statusMsg, getMainReplyKeyboard(userRole));
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

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(userRole));
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

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 17. ACTION: CANCEL
    // -------------------------------------------------------------
    if (text === '❌ هەڵوەشاندنەوە') {
      delete PENDING_INTENTS[fromId];
      delete PENDING_LEAVE[fromId];
      delete PENDING_PHOTOS[fromId];
      await clearPendingPinState(fromId);
      await clearPendingProfileEdit(fromId);
      await sendTelegramMessage(
        chatId,
        `کردارەکە هەڵوەشێندرایەوە. دەتوانیت لە خوارەوە هەڵبژێریت:`,
        getMainReplyKeyboard(userRole)
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
          getMainReplyKeyboard(userRole)
        );
        return NextResponse.json({ ok: true });
      }

      // 🔒 Check message timestamp freshness (within 180 seconds)
      const nowUnix = Math.floor(Date.now() / 1000);
      if (message.date && Math.abs(nowUnix - message.date) > 180) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>ئەم لۆکەیشنە کۆنە یان درەنگ گەیشتووە!</b>\n\nتکایە دووبارە لۆکەیشنی نوێ بنێرەوە.`,
          getMainReplyKeyboard(userRole)
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

      await sendTelegramMessage(chatId, result.message, getMainReplyKeyboard(userRole));
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

      await sendTelegramMessage(chatId, helpText, getMainReplyKeyboard(userRole));
      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `سڵاو بەڕێز <b>${currentBinding.employeeName}</b>، تکایە دوگمەیەکی خوارەوە هەڵبژێرە:`,
      getMainReplyKeyboard(userRole)
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
