import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllFeedbackPins, 
  getAllFeedbackSubmissions, 
  createFeedbackPin, 
  createBatchFeedbackPins, 
  deleteFeedbackPin,
  resetFeedbackPin,
  clearAllFeedbackSubmissions,
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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body?.action || 'get_all';

    // 0. Get all feedback & PINs
    if (action === 'get_all') {
      const [pins, submissions] = await Promise.all([
        getAllFeedbackPins(),
        getAllFeedbackSubmissions(),
      ]);

      return NextResponse.json({
        success: true,
        pins,
        submissions,
      });
    }

    // 1. Create single PIN
    if (action === 'create_pin') {
      const result = await createFeedbackPin({
        customPin: body.customPin,
        scope: body.scope,
        targetPhone: body.targetPhone,
        targetName: body.targetName,
        isSingleUse: body.isSingleUse,
        notes: body.notes,
        createdBy: body.createdBy || 'Admin',
      });
      return NextResponse.json(result);
    }

    // 2. Batch create PINs
    if (action === 'batch_pins') {
      const count = Number(body.count || 5);
      const result = await createBatchFeedbackPins(count, {
        scope: body.scope,
        isSingleUse: body.isSingleUse,
        notes: body.notes,
        createdBy: body.createdBy || 'Admin',
      });
      return NextResponse.json(result);
    }

    // 3. Delete PIN
    if (action === 'delete_pin') {
      const pin = body.pin;
      if (!pin) {
        return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
      }
      const result = await deleteFeedbackPin(pin);
      return NextResponse.json(result);
    }

    // 4. Reset PIN (Clear its test data and make it unused again)
    if (action === 'reset_pin') {
      const pin = body.pin;
      if (!pin) {
        return NextResponse.json({ success: false, error: 'PIN is required' }, { status: 400 });
      }
      const result = await resetFeedbackPin(pin);
      return NextResponse.json(result);
    }

    // 5. Delete specific submission
    if (action === 'delete_submission') {
      const id = body.id;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Submission ID is required' }, { status: 400 });
      }
      const result = await deleteFeedbackSubmission(id);
      return NextResponse.json(result);
    }

    // 6. Clear all test submissions
    if (action === 'clear_all_submissions') {
      const result = await clearAllFeedbackSubmissions();
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
