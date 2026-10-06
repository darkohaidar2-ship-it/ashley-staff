import { NextRequest, NextResponse } from 'next/server';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { getMonthlyAttendanceStats } from '@/lib/attendance/report-service';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empParam = searchParams.get('emp') || 'emp-02';
    const monthParam = searchParams.get('month') || getBaghdadNow().dateStr.slice(0, 7);

    // Resolve employee
    const cleanId = empParam.trim();
    const rawNum = cleanId.replace(/^emp-0*/i, '') || cleanId.replace('emp-', '');
    const cleanEmpId = cleanId.startsWith('emp-') ? cleanId : `emp-${cleanId}`;

    const employee = ASHLEY_OFFICIAL_EMPLOYEES.find(e => 
      e.id === cleanId || 
      e.id === cleanEmpId || 
      e.id.replace('emp-', '') === rawNum ||
      (e.employeeId && (e.employeeId === cleanId || e.employeeId === rawNum))
    ) || {
      id: cleanEmpId,
      name: 'کارمەندی ئاشڵی',
      kurdishName: 'کارمەندی ئاشڵی',
      role: 'کارمەند',
      department: 'کۆمپانیای سەرەکی ئاشڵی',
      phone: '',
      photoUrl: `/employees/${cleanEmpId}.jpg`,
    };

    const stats = await getMonthlyAttendanceStats(
      employee.id,
      employee.name,
      monthParam
    );

    return NextResponse.json({
      success: true,
      employee,
      stats,
    });
  } catch (err: any) {
    logger.error('[MonthlyStatsAPI] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch monthly stats' },
      { status: 500 }
    );
  }
}
