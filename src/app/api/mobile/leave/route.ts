import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { saveLeaveRequest, getTelegramBindings, sendTelegramMessage, getBaghdadNow } from '@/lib/telegram/telegram-service';
import { getActionRecipients } from '@/lib/workflow/workflow-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId')?.trim();

    const { data } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_leave_requests')
      .maybeSingle();

    let allLeaves: Record<string, any> = {};
    if (data?.qr_code) {
      allLeaves = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
    }

    const leavesArray = Object.values(allLeaves);

    if (employeeId) {
      const filtered = leavesArray.filter((l: any) => l.employeeId === employeeId);
      return NextResponse.json({ success: true, leaves: filtered });
    }

    return NextResponse.json({ success: true, leaves: leavesArray });
  } catch (err: any) {
    logger.error('[MobileLeave API] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, employeeName, leaveType, targetDate, reason, notes } = body;

    if (!employeeId || !reason) {
      return NextResponse.json({ success: false, error: 'کۆدی کارمەند و هۆکاری مۆڵەت پێویستن' }, { status: 400 });
    }

    const { dateStr, timeStr } = getBaghdadNow();
    const effectiveTargetDate = targetDate || dateStr;
    const fullDetails = `${leaveType === 'hourly' ? 'مۆڵەتی کاتی' : 'مۆڵەتی ڕۆژانە'} - ${reason}${notes ? ` (${notes})` : ''}`;

    const newLeave = await saveLeaveRequest(
      employeeId,
      employeeName || employeeId,
      'mobile_app',
      fullDetails,
      effectiveTargetDate
    );

    // Notify Approvers on Telegram
    try {
      const bindings = await getTelegramBindings();
      const approvers = await getActionRecipients('leave_approval', bindings);

      const alertMsg = 
        `🌴 <b>داواکاری مۆڵەتی نوێ (لە ئەپی مۆبایلەوە):</b>\n\n` +
        `👤 <b>کارمەند:</b> <b>${employeeName}</b> (کۆد: <code>${employeeId}</code>)\n` +
        `📅 <b>بەرواری داواکراو:</b> <b>${effectiveTargetDate}</b>\n` +
        `📋 <b>جۆر و هۆکار:</b> ${fullDetails}\n` +
        `⏰ <b>کاتی داواکاری:</b> ${timeStr} | ${dateStr}\n\n` +
        `<i>داواکارییەکە لە سیستەمی مۆبایلی ئاشڵی تۆمارکرا.</i>`;

      for (const approver of approvers) {
        if (approver.chatId) {
          await sendTelegramMessage(approver.chatId, alertMsg, {
            inline_keyboard: [
              [
                { text: '✅ پەسەندکردنی مۆڵەت', callback_data: `leave_app:${newLeave.id}` },
                { text: '❌ ڕەتکردنەوە', callback_data: `leave_rej:${newLeave.id}` },
              ],
            ],
          });
        }
      }
    } catch (telegramErr) {
      logger.warn('[MobileLeave API] Telegram notify error:', telegramErr);
    }

    return NextResponse.json({
      success: true,
      message: 'داواکاری مۆڵەتەکەت بە سەرکەوتوویی تۆمارکرا و ڕەوانەی بەڕێوەبەرایەتی کرا.',
      leave: newLeave,
    });
  } catch (err: any) {
    logger.error('[MobileLeave API] POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
