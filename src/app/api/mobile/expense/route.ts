import { NextRequest, NextResponse } from 'next/server';
import { fetchPendingExpenseRequests, createPendingExpenseRequest } from '@/lib/supabase/expenses/expenses-service';
import { sendTelegramMessage, getTelegramBindings, getBaghdadNow } from '@/lib/telegram/telegram-service';
import { getActionRecipients } from '@/lib/workflow/workflow-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId')?.trim();

    const all = await fetchPendingExpenseRequests();

    if (employeeId) {
      const userExpenses = all.filter(e => e.employeeId === employeeId);
      return NextResponse.json({ success: true, expenses: userExpenses });
    }

    return NextResponse.json({ success: true, expenses: all });
  } catch (err: any) {
    logger.error('[MobileExpense API] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, employeeName, amount, category, note, receiptPhotoUrl } = body;

    if (!employeeId || !amount) {
      return NextResponse.json({ success: false, error: 'کۆدی کارمەند و بڕی پارە پێویستن' }, { status: 400 });
    }

    const { dateStr, timeStr } = getBaghdadNow();

    const newReq = await createPendingExpenseRequest({
      employeeId,
      employeeName: employeeName || employeeId,
      amount: Number(amount),
      category: category || 'گشتی',
      note: note || '',
      receiptPhotoUrl: receiptPhotoUrl || undefined,
      dateStr,
    });

    // Notify Admin / Managers via Telegram
    try {
      const bindings = await getTelegramBindings();
      const approvers = await getActionRecipients('expense_approval', bindings);
      const formattedAmount = Number(amount).toLocaleString('en-US');

      const alertMsg = 
        `💸 <b>داواکاری مەسروفاتی نوێ (لە ئەپی مۆبایلەوە):</b>\n\n` +
        `👤 <b>کارمەند:</b> <b>${employeeName}</b> (کۆد: <code>${employeeId}</code>)\n` +
        `💰 <b>بڕی پارە:</b> <b>${formattedAmount} دینار</b>\n` +
        `📁 <b>جۆر:</b> ${category || 'گشتی'}\n` +
        `📝 <b>تێبینی:</b> <i>${note || 'هیچ'}</i>\n` +
        `⏰ <b>کات:</b> ${timeStr} | ${dateStr}\n\n` +
        `<i>داواکارییەکە لە سیستەمی مۆبایل و بەشی مەسروفاتی ئاشڵی تۆمارکرا.</i>`;

      for (const approver of approvers) {
        if (approver.chatId) {
          await sendTelegramMessage(approver.chatId, alertMsg);
        }
      }
    } catch (telegramErr) {
      logger.warn('[MobileExpense API] Failed to send Telegram notification:', telegramErr);
    }

    return NextResponse.json({
      success: true,
      message: 'داواکاری مەسروفاتەکەت بە سەرکەوتوویی تۆمارکرا و ڕەوانەی بەڕێوەبەرایەتی کرا.',
      expense: newReq,
    });
  } catch (err: any) {
    logger.error('[MobileExpense API] POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
