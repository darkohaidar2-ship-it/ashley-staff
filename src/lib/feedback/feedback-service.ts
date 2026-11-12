import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';
import {
  MANAGER_EVALUATION_ITEMS,
  ManagerEvaluationSubmission,
  ManagerOpenAnswers,
  computeManagerTotalScore,
} from './manager-evaluation';

export type PinScope = 'manager_feedback' | 'staff_feedback' | 'warehouse';

export interface FeedbackPin {
  pin: string; // 4 digits for feedback (0000-5999 for manager, 6000-9999 for staff) or 5 digits for warehouse (10000-99999)
  scope: PinScope; // 'manager_feedback' | 'staff_feedback' | 'warehouse'
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
const MANAGER_EVAL_STORE_ID = 'ashley_manager_evaluations';

/**
 * 🎯 Determine PIN Scope according to system rules:
 * - Manager Feedback: 4 digits, range 0000 - 5999
 * - Staff Feedback: 4 digits, range 6000 - 9999
 * - Warehouse: 5 digits, range 10000 - 99999
 */
export function determinePinScope(pin: string): PinScope | null {
  const clean = (pin || '').trim();
  if (/^\d{5}$/.test(clean)) {
    return 'warehouse';
  }
  if (/^\d{4}$/.test(clean)) {
    const val = parseInt(clean, 10);
    if (val >= 0 && val <= 5999) return 'manager_feedback';
    if (val >= 6000 && val <= 9999) return 'staff_feedback';
  }
  return null;
}

/**
 * 🎲 Generate a valid random PIN within the exact scope range
 */
export function generatePinForScope(scope: PinScope): string {
  if (scope === 'manager_feedback') {
    // 0000 to 5999
    const val = Math.floor(Math.random() * 6000);
    return String(val).padStart(4, '0');
  }
  if (scope === 'staff_feedback') {
    // 6000 to 9999
    const val = Math.floor(6000 + Math.random() * 4000);
    return String(val);
  }
  // Warehouse: 5 digits (10000 to 99999)
  const val = Math.floor(10000 + Math.random() * 90000);
  return String(val);
}

/**
 * 🔒 System Default Seed PINs
 * Guarantees that the system is never locked out on initial setup
 */
export const DEFAULT_SYSTEM_PINS: Record<string, FeedbackPin> = {
  '2026': {
    pin: '2026',
    scope: 'manager_feedback',
    targetName: 'کۆدی سەرەکی بەڕێوەبەر',
    isSingleUse: false,
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'سیستەمی ئاشڵی',
    notes: 'کۆدی فیدباکی بەڕێوەبەر (0000 - 5999)',
  },
  '9595': {
    pin: '9595',
    scope: 'staff_feedback',
    targetName: 'فیدباکی گشتی کارمەندان',
    isSingleUse: false,
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'سیستەمی ئاشڵی',
    notes: 'کۆدی فیدباکی کارمەندان (6000 - 9999)',
  },
  '54321': {
    pin: '54321',
    scope: 'warehouse',
    targetName: 'تیمی کۆگا و جەرد',
    isSingleUse: false,
    isUsed: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'سیستەمی ئاشڵی',
    notes: 'کۆدی ٥ ژمارەیی بەشی کۆگا و بار داگرتن',
  },
};

/**
 * 🔒 Fetch all feedback PINs from Supabase with Scope normalization & default seed fallback
 */
export async function getAllFeedbackPins(): Promise<Record<string, FeedbackPin>> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', PINS_STORE_ID)
      .maybeSingle();

    let pinsMap: Record<string, FeedbackPin> = {};

    if (!error && data?.qr_code) {
      try {
        pinsMap = JSON.parse(data.qr_code);
      } catch {
        pinsMap = {};
      }
    }

    // Merge system defaults if missing
    let hasChanges = false;
    for (const [key, defaultPin] of Object.entries(DEFAULT_SYSTEM_PINS)) {
      if (!pinsMap[key]) {
        pinsMap[key] = defaultPin;
        hasChanges = true;
      }
    }

    // Ensure all stored pins have a valid scope
    for (const [key, pinObj] of Object.entries(pinsMap)) {
      if (!pinObj.scope) {
        pinObj.scope = determinePinScope(key) || 'staff_feedback';
        hasChanges = true;
      }
    }

    // If changes occurred, save silently in background
    if (hasChanges && Object.keys(pinsMap).length > 0) {
      saveFeedbackPins(pinsMap).catch(() => {});
    }

    return pinsMap;
  } catch (err) {
    logger.error('[FeedbackService] Exception reading pins:', err);
    return { ...DEFAULT_SYSTEM_PINS };
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
 * 🔑 Create a new PIN with strict scope validation
 */
export async function createFeedbackPin(params: {
  customPin?: string;
  scope?: PinScope;
  targetPhone?: string;
  targetName?: string;
  isSingleUse?: boolean;
  createdBy?: string;
  notes?: string;
}): Promise<{ success: boolean; pin?: FeedbackPin; error?: string }> {
  try {
    const currentPins = await getAllFeedbackPins();
    let requestedScope = params.scope;
    let pinToUse = params.customPin ? params.customPin.trim() : '';

    if (pinToUse) {
      const detectedScope = determinePinScope(pinToUse);
      if (!detectedScope) {
        return { 
          success: false, 
          error: 'کۆدی PIN نادروستە. دەبێت ٤ ژمارە بێت (0000-5999 بۆ بەڕێوەبەر، 6000-9999 بۆ کارمەندان) یان ٥ ژمارە بێت بۆ کۆگا.' 
        };
      }

      if (requestedScope && requestedScope !== detectedScope) {
        if (requestedScope === 'manager_feedback') {
          return { success: false, error: 'پێویستە کۆدی بەڕێوەبەر لە نێوان 0000 بۆ 5999 بێت.' };
        }
        if (requestedScope === 'staff_feedback') {
          return { success: false, error: 'پێویستە کۆدی فیدباکی کارمەندان لە نێوان 6000 بۆ 9999 بێت.' };
        }
        if (requestedScope === 'warehouse') {
          return { success: false, error: 'پێویستە کۆدی کۆگا بە تەواوی ٥ ژمارە بێت (10000 تا 99999).' };
        }
      }

      requestedScope = detectedScope;

      if (currentPins[pinToUse]) {
        return { success: false, error: 'ئەم کۆدە (PIN) پێشتر تۆمارکراوە، تکایە یەکێکی تر هەڵبژێرە.' };
      }
    } else {
      requestedScope = requestedScope || 'staff_feedback';
      let attempts = 0;
      do {
        pinToUse = generatePinForScope(requestedScope);
        attempts++;
      } while (currentPins[pinToUse] && attempts < 200);
    }

    const newPinRecord: FeedbackPin = {
      pin: pinToUse,
      scope: requestedScope,
      targetPhone: params.targetPhone?.trim() || undefined,
      targetName: params.targetName?.trim() || undefined,
      isSingleUse: params.isSingleUse ?? (requestedScope === 'staff_feedback'),
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
 * 📦 Create Batch PINs by Scope
 */
export async function createBatchFeedbackPins(
  count: number = 5, 
  optionsOrSingleUse: boolean | { scope?: PinScope; isSingleUse?: boolean; notes?: string; createdBy?: string } = true
): Promise<{ success: boolean; created: FeedbackPin[]; error?: string }> {
  try {
    const isSingleUse = typeof optionsOrSingleUse === 'boolean' 
      ? optionsOrSingleUse 
      : (optionsOrSingleUse.isSingleUse ?? true);
    const scope: PinScope = typeof optionsOrSingleUse === 'object' && optionsOrSingleUse.scope 
      ? optionsOrSingleUse.scope 
      : 'staff_feedback';
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
        pinToUse = generatePinForScope(scope);
        attempts++;
      } while ((currentPins[pinToUse] || created.some(p => p.pin === pinToUse)) && attempts < 200);

      const record: FeedbackPin = {
        pin: pinToUse,
        scope,
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
 * 🔍 Verify a PIN across all Scopes (Manager, Staff, Warehouse)
 */
export async function verifyFeedbackPin(
  pin: string, 
  expectedScope?: PinScope
): Promise<{ valid: boolean; scope?: PinScope; pinData?: FeedbackPin; error?: string }> {
  const cleanPin = pin ? pin.trim() : '';
  if (!cleanPin) {
    return { valid: false, error: 'تکایە کۆدی PIN بنووسە.' };
  }

  const detectedScope = determinePinScope(cleanPin);
  if (!detectedScope) {
    return { 
      valid: false, 
      error: 'کۆدی PIN نادروستە. دەبێت ٤ ژمارە بێت (0000-5999 بۆ بەڕێوەبەر، 6000-9999 بۆ کارمەندان) یان ٥ ژمارە بێت بۆ کۆگا.' 
    };
  }

  const currentPins = await getAllFeedbackPins();
  let record = currentPins[cleanPin];

  // Check fallback system pins if record missing
  if (!record && DEFAULT_SYSTEM_PINS[cleanPin]) {
    record = DEFAULT_SYSTEM_PINS[cleanPin];
  }

  if (!record) {
    return { valid: false, error: 'کۆدی PIN هەڵەیە یان ڕێگەی پێنەدراوە.' };
  }

  // Ensure record has scope
  const actualScope = record.scope || detectedScope;

  // Validate expected scope
  if (expectedScope && actualScope !== expectedScope) {
    if (expectedScope === 'manager_feedback') {
      return { 
        valid: false, 
        error: 'ئەم کۆدە بۆ بەڕێوەبەر نییە (پێویستە کۆدی ٤ ژمارەیی بێت لە نێوان 0000 بۆ 5999).' 
      };
    }
    if (expectedScope === 'staff_feedback') {
      return { 
        valid: false, 
        error: 'ئەم کۆدە بۆ فیدباکی کارمەندان نییە (پێویستە کۆدی ٤ ژمارەیی بێت لە نێوان 6000 بۆ 9999).' 
      };
    }
    if (expectedScope === 'warehouse') {
      return { 
        valid: false, 
        error: 'ئەم کۆدە بۆ بەشی کۆگا نییە (پێویستە کۆدێکی ٥ ژمارەیی بێت لە نێوان 10000 بۆ 99999).' 
      };
    }
  }

  // Check single-use
  if (record.isSingleUse && record.isUsed) {
    return {
      valid: false,
      error: 'ئەم کۆدە پێشتر بەکارهێنراوە و بەسەرچووە. ناتوانرێت دووبارە بەکاربهێنرێتەوە.',
      pinData: record,
      scope: actualScope,
    };
  }

  return { valid: true, scope: actualScope, pinData: { ...record, scope: actualScope } };
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

    // 2. Reset staff_feedback PINs to isUsed = false
    const currentPins = await getAllFeedbackPins();
    Object.keys(currentPins).forEach((k) => {
      const scope = currentPins[k].scope || determinePinScope(k);
      if (scope === 'staff_feedback') {
        currentPins[k].isUsed = false;
        delete currentPins[k].usedAt;
      }
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
    // 1. Verify PIN validity strictly for staff_feedback
    const check = await verifyFeedbackPin(params.pin, 'staff_feedback');
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

// ============================================================================
// 👑 SEPARATE MANAGER EVALUATION STORAGE & HELPERS (نهێنی - بێ ناو)
// Stored completely apart from staff feedback submissions so data never mixes
// ============================================================================

export async function getAllManagerEvaluations(): Promise<ManagerEvaluationSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', MANAGER_EVAL_STORE_ID)
      .maybeSingle();

    if (error) {
      logger.error('[FeedbackService] Error fetching manager evaluations:', error);
      return [];
    }

    if (!data?.qr_code) return [];
    const parsed = JSON.parse(data.qr_code);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.error('[FeedbackService] Exception reading manager evaluations:', err);
    return [];
  }
}

export async function saveManagerEvaluations(items: ManagerEvaluationSubmission[]): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(items);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: MANAGER_EVAL_STORE_ID,
        name: 'Ashley Manager Evaluation Storage',
        qr_code: jsonStr,
      });

    if (error) {
      logger.error('[FeedbackService] Error saving manager evaluations:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[FeedbackService] Exception saving manager evaluations:', err);
    return false;
  }
}

export async function recordManagerEvaluation(params: {
  pin: string;
  evaluationDate?: string;
  scores: Record<number | string, number>;
  openAnswers?: ManagerOpenAnswers;
}): Promise<{
  success: boolean;
  submissionMeta?: { id: string; submittedAt: string; baghdadDate: string; baghdadTime: string };
  error?: string;
}> {
  try {
    const check = await verifyFeedbackPin(params.pin, 'manager_feedback');
    if (!check.valid || !check.pinData) {
      return {
        success: false,
        error: check.error || 'کۆدی PIN نادروستە (دەبێت کۆدی فیدباکی بەڕێوەبەر 0000 - 5999 بێت).',
      };
    }

    const normalizedScores: Record<number, number> = {};
    for (const item of MANAGER_EVALUATION_ITEMS) {
      const rawVal = params.scores?.[item.id] ?? params.scores?.[String(item.id)];
      const numVal = Number(rawVal);
      if (!Number.isInteger(numVal) || numVal < 1 || numVal > 5) {
        return {
          success: false,
          error: `تکایە وەڵامی بڕگەی (${item.id}) هەڵبژێرە لە نێوان ١ بۆ ٥.`,
        };
      }
      normalizedScores[item.id] = numVal;
    }

    const { totalScore, averageScore, band } = computeManagerTotalScore(normalizedScores);
    const { dateStr, timeStr } = getBaghdadNow();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const submissionId = `mgr_eval_${Date.now()}_${randomSuffix}`;

    const cleanOpen: ManagerOpenAnswers = {
      q1: params.openAnswers?.q1?.trim() || undefined,
      q2: params.openAnswers?.q2?.trim() || undefined,
      q3: params.openAnswers?.q3?.trim() || undefined,
      q4: params.openAnswers?.q4?.trim() || undefined,
      q5: params.openAnswers?.q5?.trim() || undefined,
    };

    const record: ManagerEvaluationSubmission = {
      id: submissionId,
      formType: 'manager_evaluation',
      evaluatorRole: 'کارمەندان و فرۆشیاران',
      evaluationDate: (params.evaluationDate || dateStr).trim(),
      submittedAt: new Date().toISOString(),
      baghdadDate: dateStr,
      baghdadTime: timeStr,
      scores: normalizedScores,
      totalScore,
      averageScore,
      satisfactionBandKey: band.key,
      openAnswers: cleanOpen,
    };

    const current = await getAllManagerEvaluations();
    current.unshift(record);
    const ok = await saveManagerEvaluations(current);
    if (!ok) {
      return { success: false, error: 'نەتوانرا هەڵسەنگاندنەکە لە سێرڤەر تۆمار بکرێت.' };
    }

    // Mark single-use PIN consumption cleanly without storing identity on the evaluation record
    const currentPins = await getAllFeedbackPins();
    const cleanPin = params.pin.trim();
    if (currentPins[cleanPin] && currentPins[cleanPin].isSingleUse) {
      currentPins[cleanPin].isUsed = true;
      currentPins[cleanPin].usedAt = new Date().toISOString();
      await saveFeedbackPins(currentPins);
    }

    // Notice: Do NOT return totalScore or satisfactionBandKey to the respondent client!
    return {
      success: true,
      submissionMeta: {
        id: record.id,
        submittedAt: record.submittedAt,
        baghdadDate: record.baghdadDate,
        baghdadTime: record.baghdadTime,
      },
    };
  } catch (err: any) {
    logger.error('[FeedbackService] Error recording manager evaluation:', err);
    return { success: false, error: err.message || 'هەڵەیەک ڕوویدا لە تۆمارکردنی هەڵسەنگاندن.' };
  }
}

export async function deleteManagerEvaluation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const list = await getAllManagerEvaluations();
    const filtered = list.filter((e) => e.id !== id);
    const ok = await saveManagerEvaluations(filtered);
    return { success: ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function clearAllManagerEvaluations(): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await saveManagerEvaluations([]);
    if (!ok) return { success: false, error: 'نەتوانرا هەڵسەنگاندنەکان بسڕدرێنەوە.' };

    // Also re-activate any single-use manager_feedback PINs cleanly
    const currentPins = await getAllFeedbackPins();
    Object.keys(currentPins).forEach((k) => {
      const scope = currentPins[k].scope || determinePinScope(k);
      if (scope === 'manager_feedback') {
        currentPins[k].isUsed = false;
        delete currentPins[k].usedAt;
      }
    });
    await saveFeedbackPins(currentPins);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
