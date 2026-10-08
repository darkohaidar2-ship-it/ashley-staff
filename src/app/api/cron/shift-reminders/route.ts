import { NextRequest, NextResponse } from 'next/server';
import { dispatchShiftReminders, getBaghdadShiftTime } from '@/lib/telegram/shift-reminder-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET: Invoked by Vercel Cron or browser diagnostic check
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
