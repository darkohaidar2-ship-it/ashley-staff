import { NextRequest, NextResponse } from 'next/server';
import { verifyFeedbackPin } from '@/lib/feedback/feedback-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = (body?.pin || '').toString().trim();

    if (!pin) {
      return NextResponse.json({ valid: false, error: 'تکایە کۆدی PIN بنووسە' }, { status: 400 });
    }

    const result = await verifyFeedbackPin(pin);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message || 'هەڵە لە پشکنینی PIN' }, { status: 500 });
  }
}
