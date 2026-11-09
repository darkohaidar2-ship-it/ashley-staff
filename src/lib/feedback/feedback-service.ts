import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';

export interface FeedbackPin {
  pin: string; // 4 digits, e.g. "4920"
  targetPhone?: string; // e.g. "0770 123 4567"
  targetName?: string; // e.g. "کارمەند / ناوی لق"
  isSingleUse: boolean;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
  createdBy?: string;
  notes?: string;
}

export interface FeedbackSubmission {
  id: string;
  pin: string;
  targetPhone?: string;
  targetName?: string;
  respondentName?: string;
  department: string;
  submittedAt: string;
  baghdadDate: string;
  baghdadTime: string;

  // Ratings (1 to 5)
  overallSatisfaction: number;
  workEnvironmentRating: number;
  teamCooperationRating: number;
  managementFairnessRating: number;
  toolsAndEquipmentRating: number;

  // Multiple Choice Questions
  shiftHoursSuitability: string;
  departmentNeedingImprovement: string;
  appExperienceRating: string;

  // Open-ended Feedback
  positiveHighlights?: string;
  workplaceChallenges?: string;
  suggestionsForManagement?: string;
}

const PINS_STORE_ID = 'ashley_feedback_pins';
const SUBMISSIONS_STORE_ID = 'ashley_feedback_submissions';

/**
 * 🔒 Fetch all feedback PINs from Supabase
 */
export async function getAllFeedbackPins(): Promise<Record<string, FeedbackPin>> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', PINS_STORE_ID)
      .maybeSingle();

    if (error) {
      logger.warn('[FeedbackService] Error reading PINs from Supabase:', error);
      return {};
    }

    if (data?.qr_code) {
      return typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
    }
  } catch (err) {
    logger.error('[FeedbackService] Exception reading PINs:', err);
  }
  return {};
}

/**
 * 🔒 Save feedback PINs map to Supabase
 */
export async function saveFeedbackPins(pinsMap: Record<string, FeedbackPin>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: PINS_STORE_ID,
        name: 'Ashley Feedback PINs Store',
        qr_code: JSON.stringify(pinsMap),
      }, { onConflict: 'id' });

    if (error) {
      logger.error('[FeedbackService] Error saving PINs to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception saving PINs:', err);
    return false;
  }
}

/**
 * 🔒 Fetch all feedback submissions from Supabase
 */
export async function getAllFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', SUBMISSIONS_STORE_ID)
      .maybeSingle();

    if (error) {
      logger.warn('[FeedbackService] Error reading submissions from Supabase:', error);
      return [];
    }

    if (data?.qr_code) {
      const list = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
      return Array.isArray(list) ? list : [];
    }
  } catch (err) {
    logger.error('[FeedbackService] Exception reading submissions:', err);
  }
  return [];
}

/**
 * 🔒 Save feedback submissions list to Supabase
 */
export async function saveFeedbackSubmissions(submissions: FeedbackSubmission[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: SUBMISSIONS_STORE_ID,
        name: 'Ashley Feedback Submissions Store',
        qr_code: JSON.stringify(submissions),
      }, { onConflict: 'id' });

    if (error) {
      logger.error('[FeedbackService] Error saving submissions to Supabase:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception saving submissions:', err);
    return false;
  }
}

/**
 * 🎲 Generate a secure, non-colliding 4-digit PIN
 */
function generateRandom4DigitPin(existingPins: Set<string>): string {
  for (let i = 0; i < 500; i++) {
    const num = Math.floor(1000 + Math.random() * 9000); // 1000-9999
    const pinStr = num.toString();
    if (!existingPins.has(pinStr)) {
      return pinStr;
    }
  }
  // Fallback
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * ➕ Create a new Feedback PIN
 */
export async function createFeedbackPin(params: {
  customPin?: string;
  targetPhone?: string;
  targetName?: string;
  isSingleUse?: boolean;
  notes?: string;
  createdBy?: string;
}): Promise<{ success: boolean; pin?: FeedbackPin; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    const existingKeys = new Set(Object.keys(currentPins));

    let finalPin = params.customPin?.trim();
    if (finalPin) {
      if (!/^\d{4}$/.test(finalPin)) {
        return { success: false, error: 'کۆدی PIN دەبێت ڕێک ٤ ژمارە بێت.' };
      }
      if (existingKeys.has(finalPin)) {
        return { success: false, error: `کۆدی PIN (${finalPin}) پێشتر دروستکراوە.` };
      }
    } else {
      finalPin = generateRandom4DigitPin(existingKeys);
    }

    const newPinRecord: FeedbackPin = {
      pin: finalPin,
      targetPhone: params.targetPhone?.trim() || undefined,
      targetName: params.targetName?.trim() || undefined,
      isSingleUse: params.isSingleUse ?? true,
      isUsed: false,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy || 'Admin',
      notes: params.notes?.trim() || undefined,
    };

    currentPins[finalPin] = newPinRecord;
    const ok = await saveFeedbackPins(currentPins);

    if (!ok) {
      return { success: false, error: 'هەڵە ڕوویدا لە تۆمارکردنی PIN لە سێرڤەر.' };
    }

    return { success: true, pin: newPinRecord };
  } catch (err: any) {
    logger.error('[FeedbackService] Exception creating PIN:', err);
    return { success: false, error: err.message || 'هەڵەیەکی نەزانراو ڕوویدا.' };
  }
}

/**
 * ➕ Batch Create multiple Feedback PINs at once
 */
export async function createBatchFeedbackPins(count: number, params?: {
  isSingleUse?: boolean;
  notes?: string;
  createdBy?: string;
}): Promise<{ success: boolean; created: FeedbackPin[]; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    const existingKeys = new Set(Object.keys(currentPins));
    const createdList: FeedbackPin[] = [];

    const safeCount = Math.min(Math.max(1, count), 50);

    for (let i = 0; i < safeCount; i++) {
      const pinStr = generateRandom4DigitPin(existingKeys);
      existingKeys.add(pinStr);

      const record: FeedbackPin = {
        pin: pinStr,
        isSingleUse: params?.isSingleUse ?? true,
        isUsed: false,
        createdAt: new Date().toISOString(),
        createdBy: params?.createdBy || 'Admin',
        notes: params?.notes?.trim() || undefined,
      };

      currentPins[pinStr] = record;
      createdList.push(record);
    }

    const ok = await saveFeedbackPins(currentPins);
    if (!ok) {
      return { success: false, created: [], error: 'نەتوانرا PINەکان خەزن بکرێن.' };
    }

    return { success: true, created: createdList };
  } catch (err: any) {
    return { success: false, created: [], error: err.message };
  }
}

/**
 * 🔍 Verify a Feedback PIN for access
 */
export async function verifyFeedbackPin(pin: string): Promise<{
  valid: boolean;
  pinData?: FeedbackPin;
  error?: string;
}> {
  const cleanPin = (pin || '').trim();
  if (!/^\d{4}$/.test(cleanPin)) {
    return { valid: false, error: 'تکایە کۆدی ٤ ژمارەیی بنووسە.' };
  }

  const currentPins = await getAllFeedbackPins();
  const record = currentPins[cleanPin];

  if (!record) {
    return { valid: false, error: 'کۆدی PIN هەڵەیە یان ڕێگەی پێنەدراوە.' };
  }

  if (record.isSingleUse && record.isUsed) {
    return {
      valid: false,
      error: 'ئەم کۆدە پێشتر بەکارهێنراوە بۆ ناردنی فیدباک. ناتوانرێت دووبارە بەکاربهێنرێتەوە.',
      pinData: record,
    };
  }

  return { valid: true, pinData: record };
}

/**
 * 🗑️ Delete a Feedback PIN
 */
export async function deleteFeedbackPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    if (!currentPins[pin]) {
      return { success: true };
    }

    delete currentPins[pin];
    const ok = await saveFeedbackPins(currentPins);
    return { success: ok, error: ok ? undefined : 'هەڵە لە سڕینەوە' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 📝 Submit a Feedback Response
 */
export async function recordFeedbackSubmission(params: {
  pin: string;
  respondentName?: string;
  department: string;
  overallSatisfaction: number;
  workEnvironmentRating: number;
  teamCooperationRating: number;
  managementFairnessRating: number;
  toolsAndEquipmentRating: number;
  shiftHoursSuitability: string;
  departmentNeedingImprovement: string;
  appExperienceRating: string;
  positiveHighlights?: string;
  workplaceChallenges?: string;
  suggestionsForManagement?: string;
}): Promise<{ success: boolean; submission?: FeedbackSubmission; error?: string }> {
  try {
    // 1. Verify PIN validity
    const check = await verifyFeedbackPin(params.pin);
    if (!check.valid || !check.pinData) {
      return { success: false, error: check.error || 'کۆدی PIN نادروستە.' };
    }

    const { dateStr, timeStr } = getBaghdadNow();
    const submissionId = `fb_${Date.now()}_${params.pin}`;

    const submission: FeedbackSubmission = {
      id: submissionId,
      pin: params.pin,
      targetPhone: check.pinData.targetPhone,
      targetName: check.pinData.targetName,
      respondentName: params.respondentName?.trim() || undefined,
      department: params.department || 'گشتی',
      submittedAt: new Date().toISOString(),
      baghdadDate: dateStr,
      baghdadTime: timeStr,

      overallSatisfaction: Math.min(Math.max(1, params.overallSatisfaction || 5), 5),
      workEnvironmentRating: Math.min(Math.max(1, params.workEnvironmentRating || 5), 5),
      teamCooperationRating: Math.min(Math.max(1, params.teamCooperationRating || 5), 5),
      managementFairnessRating: Math.min(Math.max(1, params.managementFairnessRating || 5), 5),
      toolsAndEquipmentRating: Math.min(Math.max(1, params.toolsAndEquipmentRating || 5), 5),

      shiftHoursSuitability: params.shiftHoursSuitability || 'گونجاوە',
      departmentNeedingImprovement: params.departmentNeedingImprovement || 'هیچ',
      appExperienceRating: params.appExperienceRating || 'باشە',

      positiveHighlights: params.positiveHighlights?.trim() || undefined,
      workplaceChallenges: params.workplaceChallenges?.trim() || undefined,
      suggestionsForManagement: params.suggestionsForManagement?.trim() || undefined,
    };

    // 2. Append to submissions
    const currentSubmissions = await getAllFeedbackSubmissions();
    currentSubmissions.unshift(submission); // newest first
    const saveSubOk = await saveFeedbackSubmissions(currentSubmissions);

    if (!saveSubOk) {
      return { success: false, error: 'نەتوانرا فیدباکەکە لە سێرڤەر تۆمار بکرێت.' };
    }

    // 3. Mark PIN as used
    const currentPins = await getAllFeedbackPins();
    if (currentPins[params.pin]) {
      currentPins[params.pin].isUsed = true;
      currentPins[params.pin].usedAt = new Date().toISOString();
      await saveFeedbackPins(currentPins);
    }

    return { success: true, submission };
  } catch (err: any) {
    logger.error('[FeedbackService] Error submitting feedback:', err);
    return { success: false, error: err.message || 'هەڵەیەک ڕوویدا لە تۆمارکردنی فیدباک.' };
  }
}

/**
 * 🗑️ Delete a single submission (Admin)
 */
export async function deleteFeedbackSubmission(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const list = await getAllFeedbackSubmissions();
    const filtered = list.filter(s => s.id !== id);
    const ok = await saveFeedbackSubmissions(filtered);
    return { success: ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
