import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';
import { getWarehouseAttendanceSummary, getTodayAttendanceSummary } from '@/lib/telegram/telegram-service';
import { resolveEmployeeRole, hasActionPermission } from '@/lib/workflow/workflow-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { getMonthlyAttendanceStats } from '@/lib/attendance/report-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId')?.trim();

    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee ID required' }, { status: 400 });
    }

    const { dateStr, timeStr } = getBaghdadNow();
    const currentMonth = dateStr.slice(0, 7); // YYYY-MM

    // 1. Fetch Today's Attendance Record from Supabase
    const { data: todayRecords } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', employeeId)
      .eq('date', dateStr)
      .order('created_at', { ascending: false })
      .limit(1);

    const todayRecord = todayRecords && todayRecords.length > 0 ? todayRecords[0] : null;

    // 2. Fetch Overrides from ashley_manual_attendance_records
    let overrideToday = null;
    try {
      const { data: overRow } = await supabase
        .from('warehouses')
        .select('qr_code')
        .eq('id', 'ashley_manual_attendance_records')
        .maybeSingle();

      if (overRow?.qr_code) {
        const overrides = JSON.parse(overRow.qr_code);
        const cleanId = employeeId.replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
        const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;
        const keys = [
          `${employeeId}_${dateStr}`,
          `${cleanId}_${dateStr}`,
          `${cleanPadded}_${dateStr}`,
          `emp-${cleanId}_${dateStr}`,
          `emp-${cleanPadded}_${dateStr}`,
        ];
        for (const k of keys) {
          if (overrides[k]) {
            overrideToday = overrides[k];
            break;
          }
        }
      }
    } catch (e) {
      logger.warn('[MobileStatus API] Error reading overrides:', e);
    }

    const effectiveCheckIn = overrideToday?.checkInTime || todayRecord?.check_in_time || null;
    const effectiveCheckOut = overrideToday?.checkOutTime || todayRecord?.check_out_time || null;
    const effectiveStatus = overrideToday?.status || (effectiveCheckIn ? 'Present' : 'NotCheckedIn');
    const overtimeNote = overrideToday?.checkOutNote || overrideToday?.note || todayRecord?.check_out_note || null;

    // 3. Resolve Employee Info
    const matchedEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === employeeId);
    const empName = matchedEmp?.fullName3Part || matchedEmp?.name || employeeId;
    const role = resolveEmployeeRole(employeeId, empName);

    // 4. Fetch Full Authoritative Month Records using report-service (Includes ashley_manual_attendance_records & attendance)
    let monthlyStatsData = null;
    try {
      monthlyStatsData = await getMonthlyAttendanceStats(employeeId, empName, currentMonth);
    } catch (statErr) {
      logger.warn('[MobileStatus API] Error getting monthly stats:', statErr);
    }

    const totalDaysPresent = monthlyStatsData?.presentDays ?? 0;
    const totalOvertimeMins = monthlyStatsData?.totalOvertimeMinutes ?? 0;
    const totalLateMins = monthlyStatsData?.totalLateMinutes ?? 0;
    const formattedRecords = (monthlyStatsData?.records || []).map(r => ({
      date: r.date,
      dayName: r.dayName,
      check_in_time: r.checkIn,
      check_out_time: r.checkOut,
      status: r.status,
      duration_minutes: r.durationMinutes,
      duration_str: r.durationStr,
      overtime_minutes: r.overtimeMinutes,
      late_minutes: r.lateMinutes,
      location_name: r.locationName,
    }));

    // 5. Role & Permissions for Special Tabs

    const canViewWarehouse = await hasActionPermission(employeeId, 'warehouse_attendance');
    const canViewTransport = await hasActionPermission(employeeId, 'transport_attendance');
    const canViewAll = await hasActionPermission(employeeId, 'view_attendance');

    let warehouseSummary = null;
    let transportSummary = null;
    let generalSummary = null;

    if (canViewWarehouse) {
      try { warehouseSummary = await getWarehouseAttendanceSummary(); } catch {}
    }
    if (canViewTransport) {
      try { transportSummary = await getTodayAttendanceSummary(); } catch {}
    }
    if (canViewAll) {
      try { generalSummary = await getTodayAttendanceSummary(); } catch {}
    }

    return NextResponse.json({
      success: true,
      baghdadDate: dateStr,
      baghdadTime: timeStr,
      employee: {
        id: employeeId,
        name: empName,
        role,
        photoUrl: matchedEmp?.photoUrl || null,
        phone: matchedEmp?.phone || null,
      },
      today: {
        checkInTime: effectiveCheckIn,
        checkOutTime: effectiveCheckOut,
        status: effectiveStatus,
        overtimeNote,
        date: dateStr,
      },
      monthStats: {
        month: currentMonth,
        presentDays: totalDaysPresent,
        absentDays: monthlyStatsData?.absentDays ?? 0,
        leaveDays: monthlyStatsData?.leaveDays ?? 0,
        holidayDays: monthlyStatsData?.holidayDays ?? 0,
        totalWorkMinutes: monthlyStatsData?.totalWorkMinutes ?? 0,
        totalWorkHoursStr: monthlyStatsData?.totalWorkHoursStr ?? '',
        totalOvertimeMinutes: totalOvertimeMins,
        totalOvertimeStr: monthlyStatsData?.totalOvertimeStr ?? '',
        totalLateMinutes: totalLateMins,
        totalLateStr: monthlyStatsData?.totalLateStr ?? '',
        targetWorkingDays: monthlyStatsData?.targetWorkingDays ?? 0,
        attendancePercent: monthlyStatsData?.attendancePercent ?? 0,
        records: formattedRecords,
      },
      specialSections: {
        canViewWarehouse,
        canViewTransport,
        canViewAll,
        warehouseSummary,
        transportSummary,
        generalSummary,
      },
    });
  } catch (err: any) {
    logger.error('[MobileStatus API] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
