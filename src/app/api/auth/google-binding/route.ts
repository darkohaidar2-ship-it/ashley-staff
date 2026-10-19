import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBindings, saveGoogleBinding, unbindGoogleBinding } from '@/lib/auth/google-bindings';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    const allBindings = await getGoogleBindings();

    // Map which employee IDs are already bound to what email
    const boundEmployeeMap: Record<string, string> = {};
    for (const [boundEmail, info] of Object.entries(allBindings)) {
      boundEmployeeMap[info.employeeId] = boundEmail;
    }

    if (email) {
      const userBinding = allBindings[email] || null;
      let matchedEmployee = null;
      if (userBinding) {
        matchedEmployee = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === userBinding.employeeId) || null;
      }
      return NextResponse.json({
        success: true,
        bound: Boolean(userBinding),
        binding: userBinding,
        employee: matchedEmployee,
        boundEmployeeMap,
      });
    }

    return NextResponse.json({
      success: true,
      allBindings,
      boundEmployeeMap,
    });
  } catch (err: any) {
    logger.error('[GoogleBinding API] GET error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, employeeId, pin, googleUid, photoUrl, force } = body;

    if (!email || !employeeId) {
      return NextResponse.json({ success: false, error: 'Email and Employee ID are required' }, { status: 400 });
    }

    const targetEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === employeeId);
    if (!targetEmp) {
      return NextResponse.json({ success: false, error: 'EMPLOYEE_NOT_FOUND' }, { status: 404 });
    }

    const result = await saveGoogleBinding({
      email,
      employeeId,
      employeeName: targetEmp.fullName3Part || targetEmp.name,
      pin,
      googleUid,
      photoUrl,
      force: Boolean(force),
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      binding: result.binding,
      employee: targetEmp,
    });
  } catch (err: any) {
    logger.error('[GoogleBinding API] POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email required' }, { status: 400 });
    }

    const res = await unbindGoogleBinding(email);
    return NextResponse.json(res);
  } catch (err: any) {
    logger.error('[GoogleBinding API] DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
