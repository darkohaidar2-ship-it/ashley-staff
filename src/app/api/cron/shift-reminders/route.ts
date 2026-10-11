import { NextRequest, NextResponse } from 'next/server';
import { 
  dispatchShiftReminders, 
  getBaghdadShiftTime,
  fetchShiftReminderTemplates,
  saveShiftReminderTemplates,
  DEFAULT_SHIFT_REMINDER_TEMPLATES,
  type ShiftReminderType
} from '@/lib/telegram/shift-reminder-service';
import { 
  fetchAllShiftSettings, 
  getEmployeeShiftConfig, 
  saveEmployeeShiftSettings 
} from '@/lib/attendance/shift-service';
import { getTelegramBindings } from '@/lib/telegram/telegram-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET: Invoked by Vercel Cron, GitHub Actions, or admin dashboard for templates/employee shifts
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

    // 2. Fetch employee shift assignments (for admin modal)
    if (action === 'employee_shifts') {
      const bindings = await getTelegramBindings();
      const shiftMap = await fetchAllShiftSettings();
      
      const employeeList = Object.entries(bindings).map(([chatId, info]) => {
        const empId = info.employeeId;
        const cfg = getEmployeeShiftConfig(empId, shiftMap);
        const official = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === empId || e.id === `emp-${empId.replace('emp-', '')}`);
        return {
          employeeId: empId,
          employeeName: info.employeeName || official?.name || empId,
          chatId,
          shiftType: cfg.shiftType || 'morning',
          startTime: cfg.startTime || '08:00',
          endTime: cfg.endTime || '17:00',
        };
      });

      return NextResponse.json({
        success: true,
        employees: employeeList,
      });
    }

    const typeParam = searchParams.get('type') as ShiftReminderType | null;
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
 * POST: Invoked from Admin Dashboard to manually dispatch, edit templates, or update employee shift
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
      if (!body.templates) {
        return NextResponse.json({ success: false, error: 'تکایە دەقەکان دیاری بکە' }, { status: 400 });
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

    // 3. Update employee shift (Morning 8-5 vs Evening 3-11)
    if (body.action === 'set_employee_shift') {
      const { employeeId, shiftType } = body;
      if (!employeeId || !shiftType) {
        return NextResponse.json({ success: false, error: 'کارمەند و جۆری شفت پێویستە' }, { status: 400 });
      }

      const isEvening = shiftType === 'evening';
      const ok = await saveEmployeeShiftSettings(employeeId, {
        shiftType: isEvening ? 'evening' : 'morning',
        startTime: isEvening ? '15:00' : '08:00',
        endTime: isEvening ? '23:00' : '17:00',
        targetWorkHours: 8,
        hasBreak: !isEvening,
      });

      if (!ok) {
        return NextResponse.json({ success: false, error: 'هەڵە لە پاشەکەوتکردنی شفتی کارمەند' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `شفتی کارمەند بە سەرکەوتوویی کرا بە ${isEvening ? 'ئێواران (٣ بۆ ١١)' : 'بەیانیان (٨ بۆ ٥)'} ✅`,
      });
    }

    // 4. Dispatch reminders (manual / test)
    const reminderType = (body.type || 'morning_start') as ShiftReminderType;
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
