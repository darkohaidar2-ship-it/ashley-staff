import { NextRequest, NextResponse } from 'next/server';
import { 
  dispatchShiftReminders, 
  getBaghdadShiftTime,
  fetchShiftReminderTemplates,
  saveShiftReminderTemplates,
  DEFAULT_SHIFT_REMINDER_TEMPLATES
} from '@/lib/telegram/shift-reminder-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET: Invoked by Vercel Cron, browser diagnostic check, or template fetching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 1. Fetch current reminder templates
    if (action === 'templates') {
      const templates = await fetchShiftReminderTemplates();
      return NextResponse.json({
        success: true,
        templates,
        defaultTemplates: DEFAULT_SHIFT_REMINDER_TEMPLATES,
      });
    }

    const typeParam = searchParams.get('type') as 'morning' | 'evening' | null;
    const testMode = searchParams.get('test') === 'true';

    // Optional Vercel Cron Secret authorization verification
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}` && !testMode) {
      return NextResponse.json({ error: 'Unauthorized cron execution' }, { status: 401 });
    }

    logger.info(`[Cron:ShiftReminder] Triggered with type: ${typeParam || 'auto'}, testMode: ${testMode}`);

    const result = await dispatchShiftReminders(
      typeParam || undefined,
      testMode
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    logger.error('[Cron:ShiftReminder] Execution error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal reminder dispatch error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Invoked from Admin Dashboard to manually dispatch or test notifications
 */
export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // 1. Save custom templates
    if (body.action === 'save_templates') {
      if (!body.templates || !body.templates.morningMessage || !body.templates.eveningMessage) {
        return NextResponse.json({ success: false, error: 'تکایە هەردوو دەقی بەیانیان و ئێواران دیاری بکە' }, { status: 400 });
      }
      const ok = await saveShiftReminderTemplates(body.templates);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'هەڵە لە پاشەکەوتکردنی دەقەکان' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: 'دەقەکانی ئاگاداری بە سەرکەوتوویی لە داتابەیس پاشەکەوت کران ✅',
      });
    }

    // 2. Reset templates to system defaults
    if (body.action === 'reset_templates') {
      const ok = await saveShiftReminderTemplates(DEFAULT_SHIFT_REMINDER_TEMPLATES);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'هەڵە لە گەڕاندنەوەی دەقەکان' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: 'دەقەکان گەڕێنرانەوە بۆ شێوازی فەرمی سەرەتایی ✅',
        templates: DEFAULT_SHIFT_REMINDER_TEMPLATES,
      });
    }

    // 3. Dispatch reminders (manual / test)
    const reminderType = body.type === 'evening' ? 'evening' : 'morning';
    const testMode = Boolean(body.testMode || body.bypassSchedule);

    logger.info(`[Admin:ShiftReminder] Manual trigger: ${reminderType}, testMode: ${testMode}`);

    const result = await dispatchShiftReminders(reminderType, testMode);

    return NextResponse.json({
      success: true,
      message: `ئاگاداری بە سەرکەوتوویی جێبەجێ کرا (${result.sentCount} نێردرا، ${result.skippedCount} لادرا)`,
      result,
    });
  } catch (err: any) {
    logger.error('[Admin:ShiftReminder] Execution error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to dispatch reminders' },
      { status: 500 }
    );
  }
}
