import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllFeedbackPins, 
  getAllFeedbackSubmissions, 
  createFeedbackPin, 
  createBatchFeedbackPins, 
  deleteFeedbackPin,
  deleteFeedbackSubmission
} from '@/lib/feedback/feedback-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const [pins, submissions] = await Promise.all([
      getAllFeedbackPins(),
      getAllFeedbackSubmissions(),
    ]);

    return NextResponse.json({
      success: true,
      pins,
      submissions,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'create_pin') {
      const result = await createFeedbackPin({
        customPin: body.customPin,
        targetPhone: body.targetPhone,
        targetName: body.targetName,
        isSingleUse: body.isSingleUse,
        notes: body.notes,
        createdBy: body.createdBy || 'Admin',
      });
      return NextResponse.json(result);
    }

    if (action === 'batch_pins') {
      const count = Number(body.count || 5);
      const result = await createBatchFeedbackPins(count, {
        isSingleUse: body.isSingleUse,
        notes: body.notes,
        createdBy: body.createdBy || 'Admin',
      });
      return NextResponse.json(result);
    }

    if (action === 'delete_pin') {
      const pin = body.pin;
      if (!pin) {
        return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
      }
      const result = await deleteFeedbackPin(pin);
      return NextResponse.json(result);
    }

    if (action === 'delete_submission') {
      const id = body.id;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Submission ID is required' }, { status: 400 });
      }
      const result = await deleteFeedbackSubmission(id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
