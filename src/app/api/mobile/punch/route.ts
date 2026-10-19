import { NextRequest, NextResponse } from 'next/server';
import { evaluateAndRecordAttendance } from '@/lib/attendance/punch-service';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, employeeName, punchType, lat, lng, forceBypassLocation, isManager, offlineRecordedAt } = body;

    if (!employeeId) {
      return NextResponse.json({ success: false, message: 'کۆدی کارمەند دیاری نەکراوە' }, { status: 400 });
    }

    const matchedEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === employeeId);
    const resolvedName = employeeName || matchedEmp?.fullName3Part || matchedEmp?.name || employeeId;

    const result = await evaluateAndRecordAttendance({
      source: 'mobile_app',
      employeeId,
      employeeName: resolvedName,
      punchType: punchType || 'auto',
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      forceBypassLocation: Boolean(forceBypassLocation),
      isManager: Boolean(isManager),
      offlineRecordedAt: typeof offlineRecordedAt === 'string' ? offlineRecordedAt : undefined,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    logger.error('[MobilePunch API] Error:', err);
    return NextResponse.json({
      success: false,
      message: 'هەڵەیەکی چاوەڕواننەکراو ڕوویدا لە تۆمارکردنی دەوامدا.',
      error: err.message,
    }, { status: 500 });
  }
}
