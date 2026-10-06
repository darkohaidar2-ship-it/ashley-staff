import { NextRequest, NextResponse } from 'next/server';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { 
  getDynamicEmployeeTelegramKeyboard,
  getEmployeeProfileDetails,
  formatProfileCard,
  getProfileInlineKeyboard,
  getEmployeeTodayAttendanceStatus,
  getBaghdadNow,
} from '@/lib/telegram/telegram-service';
import { 
  getMonthlyAttendanceStats, 
  formatMonthlyReportMessage, 
  getMonthlyReportInlineKeyboard 
} from '@/lib/attendance/report-service';
import { hasActionPermission } from '@/lib/workflow/workflow-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, text = '', callbackData } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    const employee = ASHLEY_OFFICIAL_EMPLOYEES.find(e => 
      e.id === employeeId || 
      e.id === `emp-${employeeId}` || 
      e.id.replace('emp-', '') === employeeId
    ) || {
      id: employeeId,
      name: 'کارمەندی ئاشڵی',
      role: 'کارمەند',
      phone: '',
      photoUrl: null,
    };

    const cleanEmpId = employee.id;
    const employeeName = employee.name;

    // Fetch dynamic keyboard for this specific employee
    const keyboard = await getDynamicEmployeeTelegramKeyboard(cleanEmpId);

    // 1. SIMULATE CALLBACK QUERY
    if (callbackData) {
      if (callbackData.startsWith('month:')) {
        const targetMonth = callbackData.replace('month:', '');
        const stats = await getMonthlyAttendanceStats(cleanEmpId, employeeName, targetMonth);
        const reportMsg = formatMonthlyReportMessage(stats);
        const kb = getMonthlyReportInlineKeyboard(stats.monthStr, cleanEmpId);
        return NextResponse.json({
          reply: reportMsg,
          inlineKeyboard: kb.inline_keyboard,
          keyboard,
          hasPermission: true,
        });
      }

      if (callbackData.startsWith('pdf:')) {
        let targetMonth = callbackData.replace('pdf:', '');
        if (targetMonth === 'current' || !targetMonth) {
          targetMonth = getBaghdadNow().dateStr.slice(0, 7);
        }
        const stats = await getMonthlyAttendanceStats(cleanEmpId, employeeName, targetMonth);
        return NextResponse.json({
          reply: `📄 <b>پسوولەی فەرمی دەوامی مانگی (${targetMonth}):</b>\n\n👤 کارمەند: <b>${employeeName}</b>\n📈 ڕێژەی سەدی ئامادەبوون: <b>${stats.attendancePercent}%</b>\n⏱️ کۆی کاتژمێری کارکردن: <b>${stats.totalWorkHoursStr}</b>\n\n<i>فایلی PDF بە سەرکەوتوویی دروستکرا: Ashley_Report_${targetMonth}_${cleanEmpId}.pdf</i>`,
          documentName: `Ashley_Report_${targetMonth}_${cleanEmpId}.pdf`,
          keyboard,
          hasPermission: true,
        });
      }

      if (callbackData === 'prof:refresh' || callbackData === 'view_profile') {
        const profile = await getEmployeeProfileDetails(cleanEmpId);
        try {
          const stats = await getMonthlyAttendanceStats(cleanEmpId, employeeName);
          (profile as any).totalWorkHoursStr = stats.totalWorkHoursStr;
          (profile as any).attendancePercent = stats.attendancePercent;
          (profile as any).presentDays = stats.presentDays;
        } catch (e) {}
        const profileMsg = formatProfileCard(profile);
        const kb = getProfileInlineKeyboard();
        return NextResponse.json({
          reply: profileMsg,
          photoUrl: profile.photoUrl || employee.photoUrl,
          inlineKeyboard: kb.inline_keyboard,
          keyboard,
          hasPermission: true,
        });
      }

      return NextResponse.json({
        reply: `⚙️ فەرمانی کلیککراو لە تەلەگرام: <code>${callbackData}</code> ئەنجامدرا.`,
        keyboard,
        hasPermission: true,
      });
    }

    const command = (text || '').trim();

    // 2. /start or reset command
    if (command === '/start') {
      const welcome = 
        `👋 <b>بەخێربێیت بەڕێز ${employeeName}!</b>\n\n` +
        `🤖 ئەمە تێست بۆتی تەلەگرامی کۆمپانیای ئاشڵییە.\n` +
        `📌 کۆدی کارمەند: <b>${cleanEmpId}</b>\n` +
        `🔒 بەپێی ئەو ئەرکانەی لە وێبسایتەکە پێت دراوە، دوگمەکانت بۆ دیاری دەکرێت.\n\n` +
        `دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە هەموو کردارەکان تاقی بکەیتەوە:`;

      return NextResponse.json({
        reply: welcome,
        keyboard,
        hasPermission: true,
      });
    }

    // 3. ACTION: SELF CHECKIN & CHECKOUT
    if (command === '🟢 تۆمارکردنی هاتن' || command === '🔴 تۆمارکردنی دەرچوون' || command === '/in' || command === '/out') {
      const allowed = await hasActionPermission(cleanEmpId, 'self_checkin');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ تۆمارکردنی دەوام (هاتن / دەرچوون) ڕانەکێشراویت لە سیستەمی ئاگادارییەکاندا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const isCheckIn = command === '🟢 تۆمارکردنی هاتن' || command === '/in';
      const { timeStr, dateStr } = getBaghdadNow();

      return NextResponse.json({
        reply: isCheckIn 
          ? `✅ <b>هاتنەکەت بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${employeeName}</b>\n📅 بەروار: <b>${dateStr}</b>\n🕒 کاتژمێر: <b>${timeStr}</b>\n📍 شوێن: <b>کۆمپانیای سەرەکی ئاشڵی (تێست)</b>\n\nڕۆژێکی پڕ لە بەرەکەتت بۆ دەخوازین! ✨`
          : `🏁 <b>دەرچوونەکەت بە سەرکەوتوویی تۆمارکرا!</b>\n\n👤 کارمەند: <b>${employeeName}</b>\n📅 بەروار: <b>${dateStr}</b>\n🕒 کاتژمێر: <b>${timeStr}</b>\n\nماندوو نەبیت و کاتێکی خۆش! ✨`,
        keyboard,
        hasPermission: true,
      });
    }

    // 3b. ACTION: QUICK CHECK-IN WITHOUT GPS
    if (
      command === '⚡ تۆمارکردنی خێرا (بەبێ GPS)' ||
      command === '⚡ تۆمارکردنی خێرا (دامەزرێنەر)' ||
      command.startsWith('⚡ تۆمارکردنی خێرا') ||
      command === '/quick'
    ) {
      const allowed = await hasActionPermission(cleanEmpId, 'quick_checkin_no_gps');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ دەسەڵاتی تۆمارکردنی دەوامی خێرات بەبێ GPS پێ نەدراوە لەلایەن بەڕێوەبەرەوە.\nتکایە لە شوێنی کارەکەتەوە لۆکەیشنی GPS بنێرە.`,
          keyboard,
          hasPermission: false,
        });
      }

      const { timeStr, dateStr } = getBaghdadNow();
      return NextResponse.json({
        reply: `⚡ <b>دەوامی خێرا بە سەرکەوتوویی تۆمارکرا (بەبێ پێویستی بە GPS)!</b>\n\n👤 کارمەند: <b>${employeeName}</b>\n🆔 کۆدی کارمەند: <b>${cleanEmpId}</b>\n📅 بەروار: <b>${dateStr}</b>\n🕒 کاتژمێر: <b>${timeStr}</b>\n🛡️ جۆری تۆمار: <b>دەسەڵاتی دەوامی خێرا (Quick Bypass)</b>\n\nتۆمارەکەت لە سیستەمی سەرەکی ERP تۆمارکرا ✨`,
        keyboard,
        hasPermission: true,
      });
    }

    // 4. ACTION: TODAY ATTENDANCE STATUS
    if (command === '📊 دۆخی دەوامی ئەمڕۆم' || command === '/today') {
      const allowed = await hasActionPermission(cleanEmpId, 'today_status');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی دۆخی دەوامی ئەمڕۆ ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const statusMsg = await getEmployeeTodayAttendanceStatus(cleanEmpId, employeeName);
      return NextResponse.json({
        reply: statusMsg,
        keyboard,
        hasPermission: true,
      });
    }

    // 5. ACTION: MONTHLY REPORT
    if (command === '📅 دۆخی دەوامی ئەم مانگەم' || command === '/month' || command === '/report') {
      const allowed = await hasActionPermission(cleanEmpId, 'monthly_report');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی ڕاپۆرتی دەوامی مانگانە ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const stats = await getMonthlyAttendanceStats(cleanEmpId, employeeName);
      const reportMsg = formatMonthlyReportMessage(stats);
      const kb = getMonthlyReportInlineKeyboard(stats.monthStr, cleanEmpId);

      return NextResponse.json({
        reply: reportMsg,
        inlineKeyboard: kb.inline_keyboard,
        documentName: `Ashley_Report_${stats.monthStr}_${cleanEmpId}.pdf`,
        keyboard,
        hasPermission: true,
      });
    }

    // 6. ACTION: VIEW PROFILE
    if (command === '👤 پرۆفایلی من' || command === '/profile') {
      const allowed = await hasActionPermission(cleanEmpId, 'view_profile');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی پرۆفایلی فەرمی ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const profile = await getEmployeeProfileDetails(cleanEmpId);
      try {
        const stats = await getMonthlyAttendanceStats(cleanEmpId, employeeName);
        (profile as any).totalWorkHoursStr = stats.totalWorkHoursStr;
        (profile as any).attendancePercent = stats.attendancePercent;
        (profile as any).presentDays = stats.presentDays;
      } catch (e) {}

      const profileMsg = formatProfileCard(profile);
      const kb = getProfileInlineKeyboard();

      return NextResponse.json({
        reply: profileMsg,
        photoUrl: profile.photoUrl || employee.photoUrl,
        inlineKeyboard: kb.inline_keyboard,
        keyboard,
        hasPermission: true,
      });
    }

    // 7. ACTION: WORK LOCATIONS
    if (command === 'ℹ️ شوێنەکانی دەوام') {
      const allowed = await hasActionPermission(cleanEmpId, 'work_locations');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینینی شوێنەکانی دەوام ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const infoMsg = 
        `🏢 <b>شوێنە پەسەندکراوەکانی کۆمپانیای ئاشڵی بۆ تۆمارکردنی دەوام:</b>\n\n` +
        `1️⃣ <b>کۆمپانیای سەرەکی ئاشڵی (Ashley Base):</b>\n` +
        `   📍 سلێمانی - کارگە و کۆمپانیای سەرەکی\n` +
        `   🛡️ مەودای ڕێگەپێدراو: <b>400 مەتر</b>\n` +
        `   🌐 هێڵی پانی/درێژی: <code>35.562431, 45.474850</code>\n\n` +
        `2️⃣ <b>کۆگای سەرەکی هوانە (Huana Warehouse):</b>\n` +
        `   📍 سلێمانی - کۆگای سەرەکی هوانە\n` +
        `   🛡️ مەودای ڕێگەپێدراو: <b>400 مەتر</b>\n` +
        `   🌐 هێڵی پانی/درێژی: <code>35.508880, 45.453089</code>\n\n` +
        `🔒 تۆمارکردنی دەوام بەپێی GPS دەپشکنرێت تا دڵنیابین لە ئامادەبوونت لە یەکێک لەم دوو شوێنەی کار.`;

      return NextResponse.json({
        reply: infoMsg,
        keyboard,
        hasPermission: true,
      });
    }

    // 8. ACTION: SYSTEM DIAGNOSTICS
    if (command === '🔍 پشکنینی سیستەم') {
      const allowed = await hasActionPermission(cleanEmpId, 'system_diagnostics');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ پشکنینی سیستەم ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      const { dateStr, timeStr } = getBaghdadNow();
      const statusMsg = 
        `⚙️ <b>دۆخی سیستەمی ئاشڵی (System Diagnostics):</b>\n\n` +
        `✅ مەکینەی بنکەدراوە: <b>چالاکە (Supabase Live)</b>\n` +
        `✅ بۆتی تەلەگرام: <b>ئۆنلاین و ئامادەیە</b>\n` +
        `👥 کۆی کارمەندان: <b>${ASHLEY_OFFICIAL_EMPLOYEES.length} کارمەند</b>\n` +
        `🕒 کاتی بەغدا: <b>${dateStr} - ${timeStr}</b>\n` +
        `🛡️ پاراستنی دژە-تەزویر: <b>چالاکە (Single-Device Strict Lock)</b>`;

      return NextResponse.json({
        reply: statusMsg,
        keyboard,
        hasPermission: true,
      });
    }

    // 9. ACTION: VIEW LEAVE REQUESTS
    if (command === '🏖️ داواکارییەکانی مۆڵەت' || command === '/pending_leaves') {
      const allowed = await hasActionPermission(cleanEmpId, 'leave_approval');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ بینین و پەسەندکردنی داواکارییەکانی مۆڵەت ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      return NextResponse.json({
        reply: `🏖️ <b>داواکارییەکانی مۆڵەت:</b>\n\nتۆ وەک بەڕێوەبەری پەسەندکردنی مۆڵەت دەسەڵاتت هەیە. لە ئێستادا هیچ داواکارییەکی هەڵپەسێردراو نییە ✨`,
        keyboard,
        hasPermission: true,
      });
    }

    // 10. ACTION: REQUEST LEAVE
    if (command === '🏖️ داواکردنی مۆڵەت' || command === '/leave') {
      const allowed = await hasActionPermission(cleanEmpId, 'request_leave');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ داواکردنی مۆڵەت ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      return NextResponse.json({
        reply: `🏖️ <b>داواکردنی مۆڵەتی فەرمی:</b>\n\nبەڕێز <b>${employeeName}</b>، دەتوانیت ڕۆژی مۆڵەت و هۆکارەکەی دیاری بکەیت. داواکارییەکەت ڕاستەوخۆ دەگاتە دەستی ئەو بەڕێوەبەرانەی کە ئەرکی پەسەندکردنی مۆڵەتیان هەیە.`,
        keyboard,
        hasPermission: true,
      });
    }

    // 11. ACTION: BROADCAST ANNOUNCEMENT
    if (command === '📢 ناردنی ئاگاداری گشتی' || command === '/broadcast') {
      const allowed = await hasActionPermission(cleanEmpId, 'broadcast_msg');
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ ناردنی ئاگاداری گشتی ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      return NextResponse.json({
        reply: `📢 <b>ناردنی ئاگاداری گشتی بۆ سەرجەم کارمەندان:</b>\n\nبەڕێز <b>${employeeName}</b>، تۆ دەسەڵاتی ناردنی پەیامی گشتیت هەیە بۆ تەواوی کارمەندانی کۆمپانیا.`,
        keyboard,
        hasPermission: true,
      });
    }

    // 12. OTHER GENERAL ACTIONS
    const roleChecks: Record<string, string> = {
      '❌ تۆمارکردنی غیاب': 'mark_absence',
      '🌴 دیاریکردنی پشوو': 'set_holiday',
      '💰 تۆمارکردنی خەرجی کۆگا': 'record_expense',
      '📦 داواکردنی کەلوپەل': 'order_items',
      '💵 پێشینە و خەرجی ژمێریاری': 'accounting_expenses',
      '⏰ داواکردنی کاتی زیادە': 'request_overtime',
      '🔄 گۆڕینەوەی ڕۆژی پشوو': 'swap_dayoff',
      '👥 کاتی زیادەی بەکۆمەڵ': 'team_overtime',
      '📊 ڕاپۆرتی ڕۆژانەی ئامادەبوون': 'daily_report',
    };

    if (roleChecks[command]) {
      const actId = roleChecks[command];
      const allowed = await hasActionPermission(cleanEmpId, actId);
      if (!allowed) {
        return NextResponse.json({
          reply: `⛔ <b>دەسەڵاتت نییە</b>\nتۆ بۆ ئەم ئەرکە (<code>${command}</code>) ڕانەکێشراویت لە سیستەمدا.`,
          keyboard,
          hasPermission: false,
        });
      }

      return NextResponse.json({
        reply: `✅ <b>دەسەڵاتت هەیە:</b>\n\nئەرکی [${command}] بۆ بەڕێز <b>${employeeName}</b> کارایە و دەتوانیت جێبەجێی بکەیت.`,
        keyboard,
        hasPermission: true,
      });
    }

    // DEFAULT FALLBACK
    return NextResponse.json({
      reply: `💬 <b>پەیامەکەت گەیشت:</b> <i>"${command}"</i>\n\nسیستەم تەلەگرام بە سەرکەوتوویی پەیامەکەی لە بەڕێز <b>${employeeName}</b> وەرگرت. دەتوانیت یەکێک لە دوگمەکانی سەر شاشە بەکاربهێنیت.`,
      keyboard,
      hasPermission: true,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
