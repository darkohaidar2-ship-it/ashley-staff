import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';

export interface FeedbackPin {
  pin: string; // 4 digits, e.g. "4920"
  targetPhone?: string; // e.g. "0770 123 4567"
  targetName?: string; // e.g. "ناوی بەشداربوو / لق"
  isSingleUse: boolean;
  isUsed: boolean;
  usedAt?: string;
  createdAt: string;
  createdBy?: string;
  notes?: string;
}

export interface EmployeeFeedbackRating {
  employeeId: string;
  name: string;
  fullName: string;
  role: 'فرۆشیار' | 'کاشێر' | 'ئیدارە و کاشێر';
  photoUrl: string;
  serviceRating: number;      // مامەڵە و ڕەفتار لەگەڵ کڕیار (1-5)
  performanceRating: number;  // چالاکی و لێهاتوویی لە فرۆشتن/کاش (1-5)
  disciplineRating: number;   // پابەندبوون بە دەوام و ڕێنماییەکان (1-5)
  overallRating: number;      // نمرەی گشتی بۆ ئەم کارمەندە (1-5)
  comment?: string;           // سەرنج یان تێبینی
}

// 🎯 The official list of Salespersons and Cashiers to be evaluated
export const TARGET_SALES_CASHIER_STAFF = [
  {
    employeeId: '3743',
    id: 'emp-3743',
    name: 'ئارجان',
    fullName: 'ئارجان عەلی ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-3743.jpg',
  },
  {
    employeeId: '5908',
    id: 'emp-5908',
    name: 'ئەڤین',
    fullName: 'ئەڤین ئەحمەد ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-5908.jpg',
  },
  {
    employeeId: '4997',
    id: 'emp-4997',
    name: 'بڕوا',
    fullName: 'بڕوا عوسمان ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-4997.jpg',
  },
  {
    employeeId: '7347',
    id: 'emp-7347',
    name: 'شاکار',
    fullName: 'شاکار جەمال ( کاشێر )',
    role: 'کاشێر' as const,
    photoUrl: '/employees/emp-7347.jpg',
  },
  {
    employeeId: '7037',
    id: 'emp-7037',
    name: 'شنیا',
    fullName: 'شنیا کامیل ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-7037.jpg',
  },
  {
    employeeId: '4973',
    id: 'emp-4973',
    name: 'مامۆستا بنار',
    fullName: 'مامۆستا بنار ( کاشێر و ئیدارە )',
    role: 'کاشێر' as const,
    photoUrl: '/employees/emp-4973.jpg',
  },
  {
    employeeId: '4150',
    id: 'emp-4150',
    name: 'نگین',
    fullName: 'نگین مەحمود ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-4150.jpg',
  },
  {
    employeeId: '6312',
    id: 'emp-6312',
    name: 'پەیڤی',
    fullName: 'پەیڤی سەردار ( فرۆشیار )',
    role: 'فرۆشیار' as const,
    photoUrl: '/employees/emp-6312.jpg',
  },
];

export interface FeedbackSubmission {
  id: string;
  pin: string;
  targetPhone?: string;
  targetName?: string;
  respondentName?: string;
  department?: string;
  submittedAt: string;
  baghdadDate: string;
  baghdadTime: string;

  // 🌟 Detailed evaluations for each Salesperson & Cashier
  employeeRatings?: Record<string, EmployeeFeedbackRating>;

  // Overall store summary
  overallSatisfaction: number;
  workEnvironmentRating?: number;
  teamCooperationRating?: number;
  managementFairnessRating?: number;
  toolsAndEquipmentRating?: number;

  // General questions & Open-ended Feedback
  shiftHoursSuitability?: string;
  departmentNeedingImprovement?: string;
  appExperienceRating?: string;
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
      logger.error('[FeedbackService] Error fetching pins:', error);
      return {};
    }

    if (!data?.qr_code) return {};
    return JSON.parse(data.qr_code);
  } catch (err) {
    logger.error('[FeedbackService] Exception reading pins:', err);
    return {};
  }
}

/**
 * 💾 Save all feedback PINs to Supabase
 */
export async function saveFeedbackPins(pins: Record<string, FeedbackPin>): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(pins);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: PINS_STORE_ID,
        name: 'Ashley Feedback PINs Storage',
        qr_code: jsonStr,
      });

    if (error) {
      logger.error('[FeedbackService] Error saving pins:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception saving pins:', err);
    return false;
  }
}

/**
 * 📥 Fetch all feedback submissions from Supabase
 */
export async function getAllFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', SUBMISSIONS_STORE_ID)
      .maybeSingle();

    if (error) {
      logger.error('[FeedbackService] Error fetching submissions:', error);
      return [];
    }

    if (!data?.qr_code) return [];
    return JSON.parse(data.qr_code);
  } catch (err) {
    logger.error('[FeedbackService] Exception reading submissions:', err);
    return [];
  }
}

/**
 * 💾 Save all feedback submissions to Supabase
 */
export async function saveFeedbackSubmissions(submissions: FeedbackSubmission[]): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(submissions);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: SUBMISSIONS_STORE_ID,
        name: 'Ashley Feedback Submissions Storage',
        qr_code: jsonStr,
      });

    if (error) {
      logger.error('[FeedbackService] Error saving submissions:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception saving submissions:', err);
    return false;
  }
}

/**
 * 🎲 Generate a cryptographically secure random 4-digit PIN
 */
export function generateRandom4DigitPin(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return num.toString();
}

/**
 * 🔑 Create a new Feedback PIN
 */
export async function createFeedbackPin(params: {
  customPin?: string;
  targetPhone?: string;
  targetName?: string;
  isSingleUse?: boolean;
  createdBy?: string;
  notes?: string;
}): Promise<{ success: boolean; pin?: FeedbackPin; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();

    let pinToUse = params.customPin ? params.customPin.trim() : '';
    if (!pinToUse) {
      let attempts = 0;
      do {
        pinToUse = generateRandom4DigitPin();
        attempts++;
      } while (currentPins[pinToUse] && attempts < 100);
    } else {
      if (!/^\d{4}$/.test(pinToUse)) {
        return { success: false, error: 'پێویستە کۆدەکە بە تەواوی ٤ ژمارە بێت.' };
      }
      if (currentPins[pinToUse]) {
        return { success: false, error: 'ئەم کۆدە (PIN) پێشتر تۆمارکراوە، تکایە یەکێکی تر هەڵبژێرە.' };
      }
    }

    const newPinRecord: FeedbackPin = {
      pin: pinToUse,
      targetPhone: params.targetPhone?.trim() || undefined,
      targetName: params.targetName?.trim() || undefined,
      isSingleUse: params.isSingleUse ?? true,
      isUsed: false,
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy || 'Admin',
      notes: params.notes?.trim() || undefined,
    };

    currentPins[pinToUse] = newPinRecord;
    const ok = await saveFeedbackPins(currentPins);

    if (!ok) {
      return { success: false, error: 'نەتوانرا لە داتابەیس تۆمار بکرێت.' };
    }

    return { success: true, pin: newPinRecord };
  } catch (err: any) {
    return { success: false, error: err.message || 'هەڵەیەک ڕوویدا لە دروستکردنی PIN' };
  }
}

/**
 * 📦 Create Batch Feedback PINs
 */
export async function createBatchFeedbackPins(
  count: number = 5, 
  optionsOrSingleUse: boolean | { isSingleUse?: boolean; notes?: string; createdBy?: string } = true
): Promise<{ success: boolean; created: FeedbackPin[]; error?: string }> {
  try {
    const isSingleUse = typeof optionsOrSingleUse === 'boolean' 
      ? optionsOrSingleUse 
      : (optionsOrSingleUse.isSingleUse ?? true);
    const createdBy = typeof optionsOrSingleUse === 'object' 
      ? (optionsOrSingleUse.createdBy || 'Admin Batch') 
      : 'Admin Batch';
    const notes = typeof optionsOrSingleUse === 'object' 
      ? optionsOrSingleUse.notes 
      : undefined;

    const currentPins = await getAllFeedbackPins();
    const created: FeedbackPin[] = [];

    for (let i = 0; i < count; i++) {
      let pinToUse = '';
      let attempts = 0;
      do {
        pinToUse = generateRandom4DigitPin();
        attempts++;
      } while ((currentPins[pinToUse] || created.some(p => p.pin === pinToUse)) && attempts < 100);

      const record: FeedbackPin = {
        pin: pinToUse,
        isSingleUse,
        isUsed: false,
        createdAt: new Date().toISOString(),
        createdBy,
        notes,
      };

      currentPins[pinToUse] = record;
      created.push(record);
    }

    const ok = await saveFeedbackPins(currentPins);
    if (!ok) {
      return { success: false, created: [], error: 'نەتوانرا کۆدەکان پاشەکەوت بکرێن.' };
    }

    return { success: true, created };
  } catch (err: any) {
    return { success: false, created: [], error: err.message };
  }
}

/**
 * 🔍 Verify a Feedback PIN
 */
export async function verifyFeedbackPin(pin: string): Promise<{ valid: boolean; pinData?: FeedbackPin; error?: string }> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin || !/^\d{4}$/.test(cleanPin)) {
    return { valid: false, error: 'تکایە کۆدی ٤ ژمارەیی بە دروستی بنووسە.' };
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
 * 🗑️ Delete a Feedback PIN & its associated submissions
 */
export async function deleteFeedbackPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    if (currentPins[pin]) {
      delete currentPins[pin];
      await saveFeedbackPins(currentPins);
    }

    // Also remove any submissions associated with this deleted PIN
    const submissions = await getAllFeedbackSubmissions();
    const filtered = submissions.filter(s => s.pin !== pin);
    if (filtered.length !== submissions.length) {
      await saveFeedbackSubmissions(filtered);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 🔄 Reset a Feedback PIN and delete its test submissions
 * Allows the admin to test again with the exact same PIN!
 */
export async function resetFeedbackPin(pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    if (currentPins[pin]) {
      currentPins[pin].isUsed = false;
      delete currentPins[pin].usedAt;
      await saveFeedbackPins(currentPins);
    }

    // Delete any test submissions made by this PIN
    const submissions = await getAllFeedbackSubmissions();
    const filtered = submissions.filter(s => s.pin !== pin);
    if (filtered.length !== submissions.length) {
      await saveFeedbackSubmissions(filtered);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 🧹 Clear all test feedback submissions and reset all PINs to unused
 */
export async function clearAllFeedbackSubmissions(): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Wipe submissions array
    await saveFeedbackSubmissions([]);

    // 2. Reset all PINs to isUsed = false
    const currentPins = await getAllFeedbackPins();
    Object.keys(currentPins).forEach((k) => {
      currentPins[k].isUsed = false;
      delete currentPins[k].usedAt;
    });
    await saveFeedbackPins(currentPins);

    return { success: true };
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
  department?: string;
  employeeRatings?: Record<string, EmployeeFeedbackRating>;
  overallSatisfaction?: number;
  workEnvironmentRating?: number;
  teamCooperationRating?: number;
  managementFairnessRating?: number;
  toolsAndEquipmentRating?: number;
  shiftHoursSuitability?: string;
  departmentNeedingImprovement?: string;
  appExperienceRating?: string;
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

    // Calculate overall average from employeeRatings if provided
    let calculatedOverall = params.overallSatisfaction;
    if (!calculatedOverall && params.employeeRatings) {
      const empValues = Object.values(params.employeeRatings);
      if (empValues.length > 0) {
        const sum = empValues.reduce((acc, curr) => acc + (curr.overallRating || 0), 0);
        calculatedOverall = Math.round((sum / empValues.length) * 10) / 10;
      }
    }

    const submission: FeedbackSubmission = {
      id: submissionId,
      pin: params.pin,
      targetPhone: check.pinData.targetPhone,
      targetName: check.pinData.targetName,
      respondentName: params.respondentName?.trim() || undefined,
      department: params.department || 'فرۆشتن و کاشێر',
      submittedAt: new Date().toISOString(),
      baghdadDate: dateStr,
      baghdadTime: timeStr,

      employeeRatings: params.employeeRatings || {},

      overallSatisfaction: Math.min(Math.max(1, calculatedOverall || 5), 5),
      workEnvironmentRating: params.workEnvironmentRating,
      teamCooperationRating: params.teamCooperationRating,
      managementFairnessRating: params.managementFairnessRating,
      toolsAndEquipmentRating: params.toolsAndEquipmentRating,

      shiftHoursSuitability: params.shiftHoursSuitability,
      departmentNeedingImprovement: params.departmentNeedingImprovement,
      appExperienceRating: params.appExperienceRating,

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
