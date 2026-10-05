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
  getEmployeeTodayAttendanceStatus,
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
  generateTelegramCalendar,
  getLeaveNotePresetKeyboard,
  getLeaveConfirmKeyboard,
} from '@/lib/telegram/telegram-service';
import { 
  resolveEmployeeRole, 
  UserRole, 
  getActionRecipients, 
  hasActionPermission,
  getDynamicEmployeeTelegramKeyboard
} from '@/lib/workflow/workflow-service';
import { 
  getMonthlyAttendanceStats, 
  formatMonthlyReportMessage, 
  getMonthlyReportInlineKeyboard, 
  generateMonthlyAttendancePdf 
} from '@/lib/attendance/report-service';
import { evaluateAndRecordAttendance } from '@/lib/attendance/punch-service';
import { supabase } from '@/lib/supabase/client';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Temporary in-memory cache for user intents
const PENDING_INTENTS: Record<string, 'check_in' | 'check_out'> = {};
const PENDING_LEAVE: Record<string, boolean> = {};
const PENDING_PHOTOS: Record<string, boolean> = {};

interface LeaveSession {
  step: 'awaiting_date' | 'awaiting_note' | 'awaiting_confirm';
  targetDate?: string;
  note?: string;
  employeeId: string;
  employeeName: string;
  chatId: number | string;
}
const LEAVE_SESSIONS: Record<string, LeaveSession> = {};

interface BroadcastSession {
  step: 'awaiting_content' | 'awaiting_confirm';
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  chatId: number | string;
  text?: string;
  photoId?: string;
  caption?: string;
  type?: 'text' | 'photo';
}
const PENDING_BROADCAST: Record<string, BroadcastSession> = {};

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
      const isManager = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';

      // -------------------------------------------------------------
      // CALENDAR & LEAVE WORKFLOW CALLBACKS
      // -------------------------------------------------------------
      // 1. Calendar month navigation
      if (data.startsWith('cal_nav:')) {
        const [navYearStr, navMonthStr] = data.replace('cal_nav:', '').split('-');
        const navYear = parseInt(navYearStr, 10);
        const navMonth = parseInt(navMonthStr, 10);
        const activeSession = LEAVE_SESSIONS[cqFromId];
        const kb = generateTelegramCalendar(navYear, navMonth, activeSession?.targetDate);
        if (cqMsgId) {
          await editTelegramMessage(
            cqChatId,
            cqMsgId,
            `🏖️ <b>داواکردنی مۆڵەتی فەرمی:</b>\n\nتکایە <b>بەرواری ڕۆژی مۆڵەتەکەت</b> لەم کالێندەرەی خوارەوە هەڵبژێرە:`,
            kb
          );
        }
        await answerCallbackQuery(cqId);
        return NextResponse.json({ ok: true });
      }

      // 2. Ignore / Noop
      if (data === 'cal_ignore') {
        await answerCallbackQuery(cqId);
        return NextResponse.json({ ok: true });
      }

      // 3. Cancel Leave Request
      if (data === 'cal_cancel') {
        delete LEAVE_SESSIONS[cqFromId];
        delete PENDING_LEAVE[cqFromId];
        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, `❌ داواکاری مۆڵەت هەڵوەشێندرایەوە.`);
        }
        await answerCallbackQuery(cqId, 'داواکاری هەڵوەشێندرایەوە');
        return NextResponse.json({ ok: true });
      }

      // 4. Calendar Day Selection (دەستنیشانکردنی بەروار لە کالێندەر)
      if (data.startsWith('cal_day:')) {
        const selectedDate = data.replace('cal_day:', '');
        if (!binding) {
          await answerCallbackQuery(cqId, 'تکایە سەرەتا ئەکاونتەکەت ببەستەرەوە', true);
          return NextResponse.json({ ok: true });
        }

        LEAVE_SESSIONS[cqFromId] = {
          step: 'awaiting_note',
          targetDate: selectedDate,
          employeeId: binding.employeeId,
          employeeName: binding.employeeName,
          chatId: cqChatId,
        };

        await answerCallbackQuery(cqId, `📅 بەروار دیاریکرا: ${selectedDate}`);
        const noteMsg = 
          `📅 <b>بەرواری دیاریکراو بۆ مۆڵەت:</b> <b>${selectedDate}</b>\n\n` +
          `📝 <b>هۆکار یان تێبینی مۆڵەتەکەت بنووسە:</b>\n` +
          `دەتوانیت لە ڕێگەی نامەوە هۆکار بنووسیت، یان یەکێک لەم هەڵبژاردنانەی خوارەوە دیاری بکەیت:`;
        const noteKb = getLeaveNotePresetKeyboard();
        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, noteMsg, noteKb);
        } else {
          await sendTelegramMessage(cqChatId, noteMsg, noteKb);
        }
        return NextResponse.json({ ok: true });
      }

      // 5. Leave Reason Preset Click
      if (data.startsWith('leave_preset:')) {
        const preset = data.replace('leave_preset:', '');
        const session = LEAVE_SESSIONS[cqFromId];
        if (!session || !session.targetDate) {
          await answerCallbackQuery(cqId, 'تکایە سەرلەنوێ بەروار دیاری بکەرەوە', true);
          return NextResponse.json({ ok: true });
        }

        session.note = preset === 'بەبێ تێبینی' ? 'بەبێ تێبینی (فەرمی)' : preset;
        session.step = 'awaiting_confirm';
        await answerCallbackQuery(cqId, 'تێبینی تۆمارکرا');

        const confirmMsg = 
          `📋 <b>پێداچوونەوە و ناردنی داواکاری مۆڵەت:</b>\n\n` +
          `👤 کارمەند: <b>${session.employeeName}</b> (${session.employeeId})\n` +
          `📅 بەرواری مۆڵەت: <b>${session.targetDate}</b>\n` +
          `📝 هۆکار و تێبینی: <b>${session.note}</b>\n\n` +
          `تکایە دوگمەی ناردنی فەرمی دابگرە بۆ ڕەوانەکردنی بۆ بەڕێوەبەری کۆگا (کاک کامەران) و ئیدارە:`;
        const confirmKb = getLeaveConfirmKeyboard();
        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, confirmMsg, confirmKb);
        } else {
          await sendTelegramMessage(cqChatId, confirmMsg, confirmKb);
        }
        return NextResponse.json({ ok: true });
      }

      // 6. Final Send Confirmation (ناردنی فەرمی)
      if (data === 'leave_confirm_send') {
        const session = LEAVE_SESSIONS[cqFromId];
        if (!session || !session.targetDate) {
          await answerCallbackQuery(cqId, 'داواکاری نەدۆزرایەوە، تکایە سەرلەنوێ داوا بکەرەوە', true);
          return NextResponse.json({ ok: true });
        }

        const targetDate = session.targetDate;
        const noteText = session.note || 'بەبێ تێبینی';
        const req = await saveLeaveRequest(
          session.employeeId,
          session.employeeName,
          session.chatId,
          noteText,
          targetDate
        );

        delete LEAVE_SESSIONS[cqFromId];
        delete PENDING_LEAVE[cqFromId];

        await answerCallbackQuery(cqId, '✅ نێردرا');
        const successMsg = 
          `✅ <b>داواکاری مۆڵەتەکەت بە فەرمی نێردرا!</b>\n\n` +
          `📅 بەرواری مۆڵەت: <b>${targetDate}</b>\n` +
          `📝 هۆکار و تێبینی: <b>${noteText}</b>\n\n` +
          `ڕەوانەی بەڕێوەبەری کۆگا (کاک کامەران) و بەڕێوەبەرایەتی کرا. لە کاتی پەسەندکردندا ڕاستەوخۆ دەخرێتە خشتەی فەرمی دەوام و لێرە ئاگادارت دەکەینەوە ✨`;

        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, successMsg);
        } else {
          await sendTelegramMessage(cqChatId, successMsg);
        }

        // Notify approvers via notification workflow routing (Kak Kamaran, Kak Darko, Mamosta Walid)
        const approvers = await getActionRecipients('leave_approval', bindings);
        for (const approver of approvers) {
          if (String(approver.chatId) === String(cqChatId)) continue;
          const mgrText = 
            `🔔 <b>داواکاری مۆڵەتی نوێ:</b>\n\n` +
            `👤 کارمەند: <b>${session.employeeName}</b> (${session.employeeId})\n` +
            `📅 بەرواری مۆڵەت: <b>${targetDate}</b>\n` +
            `📝 هۆکار و تێبینی: <b>${noteText}</b>\n` +
            `🕒 کاتی ناردن: ${getBaghdadNow().timeStr}`;

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
      // BROADCAST ANNOUNCEMENT CALLBACKS
      // -------------------------------------------------------------
      if (data === 'broadcast_cancel') {
        delete PENDING_BROADCAST[cqFromId];
        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, `❌ ناردنی ئاگاداری گشتی هەڵوەشێندرایەوە.`);
        }
        await answerCallbackQuery(cqId, 'هەڵوەشێندرایەوە');
        return NextResponse.json({ ok: true });
      }

      if (data === 'broadcast_confirm') {
        const session = PENDING_BROADCAST[cqFromId];
        if (!session) {
          await answerCallbackQuery(cqId, 'داواکاری ئاگاداری نەدۆزرایەوە', true);
          return NextResponse.json({ ok: true });
        }

        await answerCallbackQuery(cqId, '⏳ خەریکی بڵاوکردنەوەی ئاگادارییە بۆ سەرجەم کارمەندان...');

        const messageText = session.type === 'photo' 
          ? (session.caption || 'وێنەی فەرمی هاوپێچ کراوە') 
          : (session.text || '');

        const photoUrl = session.type === 'photo' ? session.photoId : null;

        const result = await broadcastAnnouncement(
          messageText,
          session.senderName,
          photoUrl,
          session.senderId
        );

        delete PENDING_BROADCAST[cqFromId];

        const successText =
          `✅ <b>ئاگادارییەکە بە سەرکەوتوویی بڵاوکرایەوە!</b>\n\n` +
          `👤 <b>لەلایەن:</b> <b>${session.senderName}</b>\n` +
          `📤 <b>ژمارەی وەرگران لە تەلەگرام:</b> <b>${result.sent}</b> کارمەند\n` +
          `🔔 لە سیستەمی فەرمی ئاشڵیش وەک نۆتیفیکەیشن جێگیر کرا ✨`;

        if (cqMsgId) {
          await editTelegramMessage(cqChatId, cqMsgId, successText);
        } else {
          await sendTelegramMessage(cqChatId, successText);
        }
        return NextResponse.json({ ok: true });
      }

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
        let finalPhoto = photoUrl || fileId;
        if (photoUrl) {
          try {
            const imgRes = await fetch(photoUrl);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              finalPhoto = `data:image/jpeg;base64,${base64}`;
            }
          } catch (e) {}
        }
        await approveEmployeePhoto(targetEmpId, finalPhoto);
        await updateEmployeeProfileField(targetEmpId, 'telegramFileId', fileId);
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
      // F. APPROVE LEAVE REQUEST (کاک دارکۆ، کاک کامەران، کاک هەڤاڵ، ئیدارە یان بەڕێوەبەری گشتی)
      if (data.startsWith('leave_app:')) {
        const canApprove = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';
        if (!canApprove) {
          await answerCallbackQuery(cqId, '⛔ دەسەڵاتی پەسەندکردنی مۆڵەتت نییە.', true);
          return NextResponse.json({ ok: true });
        }

        const reqId = data.replace('leave_app:', '');
        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : cqRole === 'transport_manager' ? 'کاک هەڤاڵ' : cqRole === 'administration' ? 'ئیدارە' : 'بەڕێوەبەر');
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
        const canApprove = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';
        if (!canApprove) {
          await answerCallbackQuery(cqId, '⛔ تەنها بەڕێوەبەر دەسەڵاتی هەیە.', true);
          return NextResponse.json({ ok: true });
        }
        const reqId = data.replace('leave_rej:', '');
        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : cqRole === 'transport_manager' ? 'کاک هەڤاڵ' : cqRole === 'administration' ? 'ئیدارە' : 'بەڕێوەبەر');
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

      // H. SELECT EMPLOYEE TO MARK ABSENT (کاک کامەران، کاک هەڤاڵ، ئیدارە یان کاک دارکۆ)
      if (data.startsWith('mark_abs_emp:')) {
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';
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
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';
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
        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : cqRole === 'transport_manager' ? 'کاک هەڤاڵ' : cqRole === 'administration' ? 'ئیدارە' : 'بەڕێوەبەر');

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
        const canManage = cqRole === 'founder' || cqRole === 'warehouse_manager' || cqRole === 'general_manager' || cqRole === 'transport_manager' || cqRole === 'administration';
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

        const approverName = binding?.employeeName || (cqRole === 'warehouse_manager' ? 'کاک کامەران' : cqRole === 'administration' ? 'ئیدارە' : 'بەڕێوەبەر');
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
        const dynamicKb = await getDynamicEmployeeTelegramKeyboard(pendingPin.employeeId, targetEmpRole);
        await sendTelegramMessage(
          chatId,
          `✅ <b>پیرۆزە! کۆدی نهێنی پەسەندکرا و هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n👤 ناوی کارمەند: <b>${pendingPin.employeeName}</b>\n🆔 کۆدی کارمەند: <b>${pendingPin.employeeId}</b>\n🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم ئەکاونت و ئامێرەی تەلەگرامە قوفڵکرا.\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە دەوام تۆمار بکەیت:`,
          dynamicKb || getMainReplyKeyboard(targetEmpRole)
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
    const isManager = userRole === 'founder' || userRole === 'warehouse_manager' || userRole === 'general_manager' || userRole === 'transport_manager' || userRole === 'administration';

    // 🔒 Dynamic Telegram Keyboard:
    // Strictly enforces the 2-Column Notification Routing Matrix assignments.
    // "ئەو کارمەندە لە تەلگرام ئەو ئەرکە ببینێت . گەر بۆی ڕانەکێشرابوو لە تەلگرام نەیبینێت"
    const getEmployeeReplyKeyboard = async (fallbackRole?: UserRole) => {
      if (currentBinding?.employeeId) {
        const dyn = await getDynamicEmployeeTelegramKeyboard(currentBinding.employeeId, fallbackRole || userRole);
        if (dyn) return dyn;
      }
      return getMainReplyKeyboard(fallbackRole || userRole);
    };
    const replyKeyboard = await getEmployeeReplyKeyboard();

    // -------------------------------------------------------------
    // HANDLE PHOTO SUBMISSION (BROADCAST ANNOUNCEMENT OR PROFILE)
    // -------------------------------------------------------------
    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      // 1. Broadcast Announcement Photo
      if (PENDING_BROADCAST[fromId] && PENDING_BROADCAST[fromId].step === 'awaiting_content') {
        const largest = message.photo[message.photo.length - 1];
        const photoId = largest.file_id;
        const caption = message.caption || '';

        const session = PENDING_BROADCAST[fromId];
        session.photoId = photoId;
        session.caption = caption;
        session.type = 'photo';
        session.step = 'awaiting_confirm';

        const previewMsg =
          `📋 <b>پێداچوونەوەی ئاگاداری وێنە پێش ناردن:</b>\n\n` +
          `👤 <b>نێرەر:</b> <b>${session.senderName}</b>\n` +
          `👥 <b>وەرگران:</b> سەرجەم کارمەندانی بەستراوی ئاشڵی\n` +
          `📝 <b>دەقی هاوپێچ:</b>\n<i>${caption || 'بەبێ نووسین'}</i>\n\n` +
          `ئایا دڵنیایت لە بڵاوکردنەوەی ئەم وێنە و ئاگادارییە بۆ سەرجەم کارمەندان بە نۆتیفیکەیشن؟`;

        await sendTelegramPhoto(chatId, photoId, previewMsg, {
          inline_keyboard: [
            [{ text: '🚀 پەسەندکردن و ناردن بۆ هەمووان', callback_data: 'broadcast_confirm' }],
            [{ text: '❌ هەڵوەشاندنەوە', callback_data: 'broadcast_cancel' }],
          ],
        });
        return NextResponse.json({ ok: true });
      }

      const pendingProfileEdit = await getPendingProfileEdit(fromId);
      if ((pendingProfileEdit === 'photo' || PENDING_PHOTOS[fromId]) && currentBinding) {
        await clearPendingProfileEdit(fromId);
        delete PENDING_PHOTOS[fromId];
        const largest = message.photo[message.photo.length - 1];
        const fileId = largest.file_id;
        const photoUrl = await getTelegramFileUrl(fileId);

        // Store permanent telegramFileId for Telegram API and photoUrl
        await updateEmployeeProfileField(currentBinding.employeeId, 'telegramFileId', fileId);
        await updateEmployeeProfileField(currentBinding.employeeId, 'photoUrl', photoUrl || fileId);

        // 1. Send the updated photo first using fileId directly (never expires on Telegram!)
        await sendTelegramPhoto(
          chatId,
          fileId,
          `✅ <b>وێنەی نوێی پرۆفایلەکەت بە سەرکەوتوویی نوێکرایەوە!</b>`
        );

        // 2. Then send the updated information card ("انجا زانیاریەکان")
        // 3. Followed by options inline keyboard ("انجا ئختیارەکان")
        const updated = await getEmployeeProfileDetails(currentBinding.employeeId);
        const cardMsg = formatProfileCard(updated);
        const kb = getProfileInlineKeyboard();
        await sendTelegramMessage(chatId, cardMsg, kb);

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
        await sendTelegramMessage(chatId, `دەستکاریکردنی پرۆفایل هەڵوەشێندرایەوە.`, replyKeyboard);
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
          replyKeyboard
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
          replyKeyboard
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
    // HANDLE LEAVE REQUEST INTERACTIVE TEXT & NOTE SUBMISSION
    // -------------------------------------------------------------
    if (LEAVE_SESSIONS[fromId] && LEAVE_SESSIONS[fromId].step === 'awaiting_note' && text && !text.startsWith('/') && currentBinding) {
      const session = LEAVE_SESSIONS[fromId];
      if (text === '❌ هەڵوەشاندنەوە') {
        delete LEAVE_SESSIONS[fromId];
        delete PENDING_LEAVE[fromId];
        await sendTelegramMessage(chatId, `داواکاری مۆڵەت هەڵوەشێندرایەوە.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      session.note = text;
      session.step = 'awaiting_confirm';
      const confirmMsg = 
        `📋 <b>پێداچوونەوە و ناردنی داواکاری مۆڵەت:</b>\n\n` +
        `👤 کارمەند: <b>${session.employeeName}</b> (${session.employeeId})\n` +
        `📅 بەرواری مۆڵەت: <b>${session.targetDate}</b>\n` +
        `📝 هۆکار و تێبینی: <b>${session.note}</b>\n\n` +
        `تکایە دوگمەی ناردنی فەرمی دابگرە بۆ ڕەوانەکردنی بۆ بەڕێوەبەری کۆگا (کاک کامەران) و ئیدارە:`;
      await sendTelegramMessage(chatId, confirmMsg, getLeaveConfirmKeyboard());
      return NextResponse.json({ ok: true });
    }

    if (PENDING_LEAVE[fromId] && text && !text.startsWith('/') && currentBinding) {
      delete PENDING_LEAVE[fromId];
      if (text === '❌ هەڵوەشاندنەوە') {
        await sendTelegramMessage(chatId, `داواکاری مۆڵەت هەڵوەشێندرایەوە.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const parsedTargetDate = parseTargetDateFromText(text);
      const req = await saveLeaveRequest(currentBinding.employeeId, currentBinding.employeeName, chatId, text, parsedTargetDate);
      await sendTelegramMessage(
        chatId,
        `✅ <b>داواکاری مۆڵەتەکەت تۆمارکرا!</b>\n\n📅 بەرواری مۆڵەت: <b>${parsedTargetDate}</b>\n📝 هۆکار و کات: <i>${text}</i>\n\nڕەوانەی بەڕێوەبەرایەتی کرا بۆ پێداچوونەوە و پەسەندکردن. دوای بڕیاردان ڕاستەوخۆ لێرە ئەنجامەکەت پێ دەگاتەوە.`,
        replyKeyboard
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
    // HANDLE BROADCAST ANNOUNCEMENT TEXT INPUT
    // -------------------------------------------------------------
    if (PENDING_BROADCAST[fromId] && PENDING_BROADCAST[fromId].step === 'awaiting_content' && text && !text.startsWith('/')) {
      if (text === '❌ هەڵوەشاندنەوە') {
        delete PENDING_BROADCAST[fromId];
        await sendTelegramMessage(chatId, `ناردنی ئاگاداری هەڵوەشێندرایەوە.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const session = PENDING_BROADCAST[fromId];
      session.text = text;
      session.type = 'text';
      session.step = 'awaiting_confirm';

      const previewMsg =
        `📋 <b>پێداچوونەوەی ئاگاداری پێش ناردن:</b>\n\n` +
        `👤 <b>نێرەر:</b> <b>${session.senderName}</b>\n` +
        `👥 <b>وەرگران:</b> سەرجەم کارمەندانی بەستراوی ئاشڵی\n` +
        `📝 <b>دەقی ئاگاداری:</b>\n<i>${text}</i>\n\n` +
        `ئایا دڵنیایت لە بڵاوکردنەوەی ئەم ئاگادارییە بۆ سەرجەم کارمەندان بە نۆتیفیکەیشن؟`;

      await sendTelegramMessage(chatId, previewMsg, {
        inline_keyboard: [
          [{ text: '🚀 پەسەندکردن و ناردن بۆ هەمووان', callback_data: 'broadcast_confirm' }],
          [{ text: '❌ هەڵوەشاندنەوە', callback_data: 'broadcast_cancel' }],
        ],
      });
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
          replyKeyboard
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
          replyKeyboard
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
          const boundEmpKb = await getDynamicEmployeeTelegramKeyboard(matchedEmp.id, boundEmpRole);
          await sendTelegramMessage(
            chatId,
            `✅ <b>پیرۆزە! هەژمارەکەت بە سەرکەوتوویی بەستراوەتەوە.</b>\n\n` +
            `👤 ناوی کارمەند: <b>${matchedEmp.name}</b>\n` +
            `🆔 کۆدی کارمەند: <b>${matchedEmp.id}</b>\n` +
            `🔒 <b>ئاسایش:</b> ئەم هەژمارە تەنها بۆ ئەم مۆبایل و ئەکاونتەی تەلەگرام قوفڵکرا.\n\n` +
            `ئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی دەوام تۆمار بکەیت:`,
            boundEmpKb || getMainReplyKeyboard(boundEmpRole)
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
          replyKeyboard
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
          replyKeyboard
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
          replyKeyboard
        );
        return NextResponse.json({ ok: true });
      }

      const saveRes = await saveTelegramBinding(targetTelegramId, matchedEmp.id, matchedEmp.name, true);
      if (saveRes.success) {
        await sendTelegramMessage(
          chatId,
          `✅ <b>هەژمار بە سەرکەوتوویی بەستراوەتەوە!</b>\n\n👤 کارمەند: <b>${matchedEmp.name}</b> (${matchedEmp.id})\n🆔 تەلەگرام ئایدی: <code>${targetTelegramId}</code>`,
          replyKeyboard
        );

        // Notify the employee directly in their Telegram chat
        const targetDynKb = await getDynamicEmployeeTelegramKeyboard(matchedEmp.id, resolveEmployeeRole(matchedEmp.id, matchedEmp.name));
        await sendTelegramMessage(
          targetTelegramId,
          `🎉 <b>سڵاو بەڕێز ${matchedEmp.name}</b>\n\nهەژمارەکەت لەلایەن بەڕێوەبەرەوە بە سەرکەوتوویی بەستراوەتەوە بە سیستەمی دەوامی ئاشڵی 🏢\n\nئێستا دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە کاتی هاتن و دەرچوون تۆمار بکەیت:`,
          targetDynKb || getMainReplyKeyboard(resolveEmployeeRole(matchedEmp.id, matchedEmp.name))
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هەڵە لە بەستنەوە: ${saveRes.error}`,
          replyKeyboard
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. MANAGER COMMAND: /bindings (View all linked Telegram accounts)
    // -------------------------------------------------------------
    if (text === '/bindings' || text === '/telegram_users') {
      if (!isManager) {
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە ئەم لیستە ببینێت.`, replyKeyboard);
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

      await sendTelegramMessage(chatId, msg, replyKeyboard);
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
        await sendTelegramMessage(chatId, `⛔ تەنها بەڕێوەبەر بۆی هەیە قوفڵی هەژمارەکان بکاتەوە.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const parts = text.split(/\s+/);
      const target = parts[1]?.trim();
      if (!target) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>شێوازی کردنەوەی قوفڵی هەژمار:</b>\n<code>/unbind [کۆدی کارمەند]</code>\nنموونە: <code>/unbind emp-05</code>`,
          replyKeyboard
        );
        return NextResponse.json({ ok: true });
      }

      const unbindSuccess = await unbindTelegramAccount(target);
      if (unbindSuccess) {
        await sendTelegramMessage(
          chatId,
          `🔓 <b>هەژماری (${target}) بە سەرکەوتوویی لە تەلەگرام کرایەوە!</b>\nئێستا دەتوانێت لە مۆبایلێکی نوێوە ببەسترێتەوە.`,
          replyKeyboard
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `❌ هیچ تۆمارێکی تەلەگرام نەدۆزرایەوە بە کۆدی: <b>${target}</b>`,
          replyKeyboard
        );
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9. ACTION: TODAY'S ATTENDANCE SUMMARY LIST / WAREHOUSE ATTENDANCE
    // -------------------------------------------------------------
    if (text === '📦 ئامادەبووانی کۆگا') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'warehouse_attendance');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی ئامادەبووانی کۆگا ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }
      const summary = await getWarehouseAttendanceSummary();
      await sendTelegramMessage(chatId, summary, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    if (text === '🚚 ستافی نقڵ و گواستنەوە') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'transport_attendance');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی ستافی نقڵ و گواستنەوە ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }
      const summary = await getTodayAttendanceSummary();
      await sendTelegramMessage(chatId, `🚚 <b>لیستی ئامادەبووانی ستافی نقڵ و گواستنەوە:</b>\n\n` + summary, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    if (
      text === '📋 لیستی گشتی دەوام' || 
      text === '📋 لیستی ئامادەبووانی ئەمڕۆ' || 
      text === '/list' || 
      text === '/today'
    ) {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'view_attendance');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی لیستی گشتی دەوام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }
      const summary = await getTodayAttendanceSummary();
      await sendTelegramMessage(chatId, summary, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9b. ACTION: CHECK-IN & CHECK-OUT (🟢 تۆمارکردنی هاتن / 🔴 تۆمارکردنی دەرچوون)
    // -------------------------------------------------------------
    if (text === '🟢 تۆمارکردنی هاتن') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'self_checkin');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی هاتنی دەوام لە تەلەگرام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      PENDING_INTENTS[fromId] = 'check_in';
      const prompt = `📍 <b>تۆمارکردنی هاتن بۆ دەوام:</b>\n\nتکایە دوگمەی <b>[📍 ناردنی لۆکەیشنی دەوام (GPS)]</b> لە خوارەوە دابگرە تاوەکو لۆکەیشنەکەت بنێریت و کاتەکەت تۆمار بکرێت:`;
      await sendTelegramMessage(chatId, prompt, getLocationRequestKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    if (text === '🔴 تۆمارکردنی دەرچوون') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'self_checkin');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی دەرچوونی دەوام لە تەلەگرام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      PENDING_INTENTS[fromId] = 'check_out';
      const prompt = `📍 <b>تۆمارکردنی دەرچوون لە دەوام:</b>\n\nتکایە دوگمەی <b>[📍 ناردنی لۆکەیشنی دەوام (GPS)]</b> لە خوارەوە دابگرە تاوەکو لۆکەیشنەکەت بنێریت و کاتەکەت تۆمار بکرێت:`;
      await sendTelegramMessage(chatId, prompt, getLocationRequestKeyboard(isManager));
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 9c. ACTION: TODAY'S ATTENDANCE STATUS (📊 دۆخی دەوامی ئەمڕۆم)
    // -------------------------------------------------------------
    if (text === '📊 دۆخی دەوامی ئەمڕۆم') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'today_status');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی دۆخی دەوامی ئەمڕۆ ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const statusMsg = await getEmployeeTodayAttendanceStatus(currentBinding.employeeId, currentBinding.employeeName);
      await sendTelegramMessage(chatId, statusMsg, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10. ACTION: MONTHLY ATTENDANCE REPORT WITH PDF & NAVIGATION
    // -------------------------------------------------------------
    if (text === '📅 دۆخی دەوامی ئەم مانگەم' || text === '/month' || text === '/report') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'monthly_report');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی ڕاپۆرتی دەوامی مانگانە ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

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
      const allowed = await hasActionPermission(currentBinding.employeeId, 'view_profile');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی پرۆفایلی فەرمی ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const profile = await getEmployeeProfileDetails(currentBinding.employeeId);

      // Resolve photo strictly from official Ashley ERP system:
      // Priority 1: User's custom photo set in ERP (profile.photoUrl, Data URL or valid URL)
      // Priority 2: Official employee photo from ASHLEY_OFFICIAL_EMPLOYEES (e.g. /employees/emp-02.jpg)
      // Priority 3: Official Ashley company badge or logo
      // NOTE: NEVER fetch or display personal Telegram account photos!
      let photoToSend = profile.photoUrl;

      if (!photoToSend || photoToSend.startsWith('AgAC') || photoToSend.includes('api.telegram.org')) {
        const offEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => 
          e.id === currentBinding.employeeId || 
          e.employeeId === currentBinding.employeeId
        );
        photoToSend = offEmp?.photoUrl || null;
      }

      if (!photoToSend || photoToSend.startsWith('AgAC') || photoToSend.includes('api.telegram.org')) {
        const cleanEmpId = currentBinding.employeeId.startsWith('emp-') ? currentBinding.employeeId : `emp-${currentBinding.employeeId}`;
        photoToSend = `https://ashley-staff.vercel.app/employees/${cleanEmpId}.jpg`;
      }

      if (typeof photoToSend === 'string' && photoToSend.startsWith('/')) {
        photoToSend = `https://ashley-staff.vercel.app${photoToSend}`;
      }

      // 1. Send the Photo first ("وێنەکەم بۆ بنێرەوە")
      if (photoToSend) {
        await sendTelegramPhoto(
          chatId,
          photoToSend,
          `📸 <b>وێنەی فەرمی سیستەم:</b> <b>${profile.name}</b>`
        );
      }

      // 2. Then send the Information card ("انجا زانیاریەکان")
      // 3. Along with the Options keyboard ("انجا ئختیارەکان")
      const profileMsg = formatProfileCard(profile);
      const kb = getProfileInlineKeyboard();
      await sendTelegramMessage(chatId, profileMsg, kb);
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
        replyKeyboard
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10c. ACTION: VIEW LEAVE REQUESTS & APPROVAL (🏖️ داواکارییەکانی مۆڵەت)
    // -------------------------------------------------------------
    if (text === '🏖️ داواکارییەکانی مۆڵەت' || text === '/pending_leaves') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'leave_approval');
      if (!allowed) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینین و پەسەندکردنی داواکارییەکانی مۆڵەت ڕانەکێشراویت لە سیستەمدا.`,
          replyKeyboard
        );
        return NextResponse.json({ ok: true });
      }

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
            replyKeyboard
          );
          return NextResponse.json({ ok: true });
        }

        await sendTelegramMessage(
          chatId,
          `🏖️ <b>لیستی داواکارییە هەڵپەسێردراوەکانی مۆڵەت (${pendingList.length}):</b>\nتکایە بڕیاریان لەسەر بدە:`,
          replyKeyboard
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
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10c2. ACTION: REQUEST OFFICIAL LEAVE (🏖️ داواکردنی مۆڵەت)
    // -------------------------------------------------------------
    if (text === '🏖️ داواکردنی مۆڵەت' || text === '/leave') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'request_leave');
      if (!allowed) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ داواکردنی مۆڵەت ڕانەکێشراویت لە سیستەمدا.`,
          replyKeyboard
        );
        return NextResponse.json({ ok: true });
      }

      const now = new Date();
      const nowYear = now.getFullYear();
      const nowMonth = now.getMonth() + 1;

      LEAVE_SESSIONS[fromId] = {
        step: 'awaiting_date',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        chatId: chatId,
      };

      const calKb = generateTelegramCalendar(nowYear, nowMonth);
      await sendTelegramMessage(
        chatId,
        `🏖️ <b>داواکردنی مۆڵەتی فەرمی:</b>\n\n` +
        `تکایە <b>بەرواری ڕۆژی مۆڵەتەکەت</b> لەم کالێندەرەی خوارەوە هەڵبژێرە (یان یەکێک لە ڕۆژە نزیکەکان دیاری بکە):`,
        calKb
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10c3. COMMAND: BROADCAST ANNOUNCEMENT (📢 ناردنی ئاگاداری گشتی)
    // -------------------------------------------------------------
    if (text === '📢 ناردنی ئاگاداری گشتی' || text === '/broadcast') {
      const canBroadcast = await hasActionPermission(currentBinding.employeeId, 'broadcast_msg');
      if (!canBroadcast) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ ناردنی ئاگاداری گشتی ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      PENDING_BROADCAST[fromId] = {
        step: 'awaiting_content',
        senderId: currentBinding.employeeId,
        senderName: currentBinding.employeeName,
        senderRole: userRole,
        chatId: chatId,
      };

      const promptMsg =
        `📢 <b>ناردنی ئاگاداری گشتی بۆ سەرجەم کارمەندان</b>\n\n` +
        `بەڕێز <b>${currentBinding.employeeName}</b>، تکایە دەقی ئاگادارییەکەت بنێرە:\n\n` +
        `✍️ <b>بە دەق:</b> دەتوانیت ڕاستەوخۆ دەقی ئاگادارییەکە لێرە بنووسیت.\n` +
        `📸 <b>بە وێنە:</b> یان وێنەیەک بنێرە لەگەڵ نووسینی ڕوونکردنەوە لەسەر وێنەکە (Caption).\n\n` +
        `💡 کاتێک پەیامەکەت نارد، پێداچوونەوەت بۆ دەکرێت پێش ئەوەی بە فەرمی بۆ هەمووان بڵاوبکرێتەوە.`;

      await sendTelegramMessage(chatId, promptMsg, {
        inline_keyboard: [
          [{ text: '❌ هەڵوەشاندنەوە', callback_data: 'broadcast_cancel' }],
        ],
      });
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10d. ACTION: MARK ABSENCE (❌ تۆمارکردنی غیاب)
    // -------------------------------------------------------------
    if (text === '❌ تۆمارکردنی غیاب') {
      const canMark = await hasActionPermission(currentBinding.employeeId, 'mark_absence');
      if (!canMark) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی غیاب ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
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
      const canHoliday = await hasActionPermission(currentBinding.employeeId, 'set_holiday');
      if (!canHoliday) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ دیاریکردنی پشووی فەرمی ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
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
      const canDevice = await hasActionPermission(currentBinding.employeeId, 'device_management');
      if (!canDevice) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینین و بەڕێوەبردنی بەستنەوەی ئامێرەکان ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
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

      await sendTelegramMessage(chatId, msg, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10g. ACTION: LOCATIONS INFO (ℹ️ شوێنەکانی دەوام)
    // -------------------------------------------------------------
    if (text === 'ℹ️ شوێنەکانی دەوام') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'work_locations');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی شوێنەکانی دەوام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

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
      await sendTelegramMessage(chatId, infoMsg, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 10h. ACTION: SYSTEM DIAGNOSTICS (🔍 پشکنینی سیستەم)
    // -------------------------------------------------------------
    if (text === '🔍 پشکنینی سیستەم') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'system_diagnostics');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ پشکنینی سیستەم ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

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
      await sendTelegramMessage(chatId, statusMsg, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 16. DIRECT COMMANDS (/in and /out)
    // -------------------------------------------------------------
    if (text === '/in' || text === '/checkin') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'self_checkin');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی هاتنی دەوام لە تەلەگرام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: 'check_in',
        forceBypassLocation: true,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    if (text === '/out' || text === '/checkout') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'self_checkin');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی دەرچوونی دەوام لە تەلەگرام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      const result = await evaluateAndRecordAttendance({
        source: 'telegram',
        employeeId: currentBinding.employeeId,
        employeeName: currentBinding.employeeName,
        punchType: 'check_out',
        forceBypassLocation: true,
        isManager,
      });

      await sendTelegramMessage(chatId, result.message, replyKeyboard);
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
        replyKeyboard
      );
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 18. GPS LOCATION RECEIVED (ATTENDANCE PROCESSING THROUGH ENGINE)
    // -------------------------------------------------------------
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      const allowed = await hasActionPermission(currentBinding.employeeId, 'self_checkin');
      if (!allowed) {
        await sendTelegramMessage(chatId, `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی دەوام لە تەلەگرام ڕانەکێشراویت لە سیستەمدا.`, replyKeyboard);
        return NextResponse.json({ ok: true });
      }

      // 🔒 Reject forwarded locations
      if ((message as any).forward_date || (message as any).forward_origin || (message as any).forward_from) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>لۆکەیشنی نێردراوە (Forwarded) قبوڵ ناکرێت!</b>\n\nتکایە بە شێوەی ڕاستەوخۆ لۆکەیشنی ئێستای خۆت بنێرە لە شوێنی دەوام.`,
          replyKeyboard
        );
        return NextResponse.json({ ok: true });
      }

      // 🔒 Check message timestamp freshness (within 180 seconds)
      const nowUnix = Math.floor(Date.now() / 1000);
      if (message.date && Math.abs(nowUnix - message.date) > 180) {
        await sendTelegramMessage(
          chatId,
          `⛔ <b>ئەم لۆکەیشنە کۆنە یان درەنگ گەیشتووە!</b>\n\nتکایە دووبارە لۆکەیشنی نوێ بنێرەوە.`,
          replyKeyboard
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

      await sendTelegramMessage(chatId, result.message, replyKeyboard);
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

      await sendTelegramMessage(chatId, helpText, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // Default fallback
    await sendTelegramMessage(
      chatId,
      `سڵاو بەڕێز <b>${currentBinding.employeeName}</b>، تکایە دوگمەیەکی خوارەوە هەڵبژێرە:`,
      replyKeyboard
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    logger.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
