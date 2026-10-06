import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchPendingExpenseRequests, 
  approveExpenseRequest, 
  rejectExpenseRequest 
} from '@/lib/supabase/expenses/expenses-service';
import { getTelegramBindings, sendTelegramMessage } from '@/lib/telegram/telegram-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const requests = await fetchPendingExpenseRequests();
    return NextResponse.json({ success: true, requests });
  } catch (err: any) {
    logger.error('[API /expenses/pending GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, requestId, approverName = 'بەڕێوەبەر (وێبسایت)', reason } = body;

    if (!requestId || !action) {
      return NextResponse.json({ success: false, error: 'Missing requestId or action' }, { status: 400 });
    }

    const bindings = await getTelegramBindings();

    if (action === 'approve') {
      const res = await approveExpenseRequest(requestId, approverName);
      if (!res.success || !res.request) {
        return NextResponse.json({ success: false, error: 'Request not found or already processed' }, { status: 404 });
      }

      // Notify employee on Telegram
      const targetChatId = res.request.chatId || Object.entries(bindings).find(([_, info]) => info.employeeId === res.request!.employeeId)?.[0];
      if (targetChatId) {
        try {
          await sendTelegramMessage(
            targetChatId,
            `🎉 <b>سڵاو بەڕێز ${res.request.employeeName}</b>\n\n` +
            `داواکاری مەسروفاتەکەت بە بڕی <b>${res.request.amount.toLocaleString()} دینار</b> بۆ (<b>${res.request.category}</b>) لەلایەن <b>${approverName}</b> پەسەندکرا و خرایە نێو حساباتی فەرمی ئاشڵی ✨`
          );
        } catch (tgErr) {
          logger.warn('Failed to send Telegram notification to employee:', tgErr);
        }
      }

      return NextResponse.json({ 
        success: true, 
        request: res.request, 
        newExpense: res.newExpense,
        voucher: res.voucher,
        isNewVoucher: res.isNewVoucher 
      });
    }

    if (action === 'reject') {
      const res = await rejectExpenseRequest(requestId, approverName, reason);
      if (!res.success || !res.request) {
        return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
      }

      // Notify employee on Telegram
      const targetChatId = res.request.chatId || Object.entries(bindings).find(([_, info]) => info.employeeId === res.request!.employeeId)?.[0];
      if (targetChatId) {
        try {
          await sendTelegramMessage(
            targetChatId,
            `ℹ️ <b>ئاگاداری داواکاری مەسروفات:</b>\n\n` +
            `داواکاری مەسروفاتەکەت بە بڕی <b>${res.request.amount.toLocaleString()} دینار</b> بۆ (${res.request.category}) لەلایەن <b>${approverName}</b> پەسەند نەکرا.` +
            (reason ? `\n📝 هۆکار: ${reason}` : '')
          );
        } catch (tgErr) {
          logger.warn('Failed to send Telegram notification to employee:', tgErr);
        }
      }

      return NextResponse.json({ success: true, request: res.request });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    logger.error('[API /expenses/pending POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
