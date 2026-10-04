import { NextRequest, NextResponse } from 'next/server';
import { evaluateAndRecordAttendance } from '@/lib/attendance/punch-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await evaluateAndRecordAttendance(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      message: `❌ هەڵە لە پڕۆسێسکردنی داواکاری: ${err.message}` 
    }, { status: 500 });
  }
}
