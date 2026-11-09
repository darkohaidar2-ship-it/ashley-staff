import { NextRequest, NextResponse } from 'next/server';
import { recordFeedbackSubmission } from '@/lib/feedback/feedback-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.pin) {
      return NextResponse.json({ success: false, error: 'کۆدی PIN پێویستە' }, { status: 400 });
    }

    const result = await recordFeedbackSubmission(body);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'هەڵە لە ناردنی فیدباک' }, { status: 500 });
  }
}
