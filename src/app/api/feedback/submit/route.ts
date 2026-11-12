import { NextRequest, NextResponse } from 'next/server';
import { recordFeedbackSubmission, recordManagerEvaluation } from '@/lib/feedback/feedback-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.pin) {
      return NextResponse.json({ success: false, error: 'کۆدی PIN پێویستە' }, { status: 400 });
    }

    if (body?.formType === 'manager_evaluation') {
      const result = await recordManagerEvaluation({
        pin: body.pin,
        evaluationDate: body.evaluationDate,
        scores: body.scores || {},
        openAnswers: body.openAnswers || {},
      });
      if (!result.success) {
        return NextResponse.json(result, { status: 400 });
      }
      return NextResponse.json(result);
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
