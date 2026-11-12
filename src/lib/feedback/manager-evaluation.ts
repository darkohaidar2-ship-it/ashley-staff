export type ManagerEvaluationPillar = 'respect' | 'execution' | 'fairness' | 'support';

export interface ManagerEvaluationItem {
  id: number;
  text: string;
  pillar: ManagerEvaluationPillar;
}

export interface ManagerRatingScaleOption {
  value: 1 | 2 | 3 | 4 | 5;
  kurdishDigit: string;
  label: string;
  shortLabel: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  ringColor: string;
  dotColor: string;
}

export interface ManagerOpenQuestion {
  key: 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
  num: string;
  label: string;
  placeholder: string;
}

export type ManagerScoreBandKey = 'very_high' | 'high' | 'medium' | 'weak' | 'very_weak';

export interface ManagerScoreBand {
  key: ManagerScoreBandKey;
  min: number;
  max: number;
  rangeLabel: string;
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  darkBadgeBg: string;
  barBg: string;
  glowBg: string;
}

export interface ManagerOpenAnswers {
  q1?: string;
  q2?: string;
  q3?: string;
  q4?: string;
  q5?: string;
}

export interface ManagerEvaluationSubmission {
  id: string;
  formType: 'manager_evaluation';
  /** Stored only for audit tracking in Admin; strictly no identity (نهێنی - بێ ناو) */
  pinUsedMask?: string;
  evaluatorRole: 'کارمەندان و فرۆشیاران';
  evaluationDate: string; // e.g., 2026-11-12
  submittedAt: string;
  baghdadDate: string;
  baghdadTime: string;
  /** Scores for criteria 1..20 (each 1..5) */
  scores: Record<number, number>;
  /** Sum of 20 scores (range 20..100) */
  totalScore: number;
  /** Average across 20 scores (range 1.0..5.0) */
  averageScore: number;
  satisfactionBandKey: ManagerScoreBandKey;
  openAnswers: ManagerOpenAnswers;
}

export const MANAGER_PILLAR_META: Record<
  ManagerEvaluationPillar,
  { label: string; shortLabel: string; color: string; bg: string }
> = {
  respect: {
    label: 'ڕەفتار، ڕێز و پەیوەندی تیم',
    shortLabel: 'ڕەفتار و تیم',
    color: '#10b981',
    bg: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  },
  execution: {
    label: 'ڕێکخستن، بەدواداچوون و ئامانج',
    shortLabel: 'ڕێکخستن و کار',
    color: '#3b82f6',
    bg: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  },
  fairness: {
    label: 'دادپەروەری، گەشەپێدان و ڕێنمایی',
    shortLabel: 'دادپەروەری و فێربوون',
    color: '#8b5cf6',
    bg: 'bg-violet-500/15 text-violet-700 border-violet-500/30',
  },
  support: {
    label: 'هاوکاری، خێرایی چارەسەر و هاندان',
    shortLabel: 'هاوکاری و هاندان',
    color: '#f59e0b',
    bg: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  },
};

export const MANAGER_RATING_SCALE: ManagerRatingScaleOption[] = [
  {
    value: 1,
    kurdishDigit: '١',
    label: 'زۆر ناڕازیم',
    shortLabel: 'زۆر ناڕازیم',
    activeBg: 'bg-rose-500 text-white shadow-lg shadow-rose-500/30',
    activeBorder: 'border-rose-500',
    activeText: 'text-rose-600 dark:text-rose-400',
    ringColor: 'ring-rose-500/30',
    dotColor: '#ef4444',
  },
  {
    value: 2,
    kurdishDigit: '٢',
    label: 'ناڕازیم',
    shortLabel: 'ناڕازیم',
    activeBg: 'bg-orange-500 text-white shadow-lg shadow-orange-500/30',
    activeBorder: 'border-orange-500',
    activeText: 'text-orange-600 dark:text-orange-400',
    ringColor: 'ring-orange-500/30',
    dotColor: '#f97316',
  },
  {
    value: 3,
    kurdishDigit: '٣',
    label: 'مامناوەند',
    shortLabel: 'مامناوەند',
    activeBg: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30',
    activeBorder: 'border-amber-500',
    activeText: 'text-amber-600 dark:text-amber-400',
    ringColor: 'ring-amber-500/30',
    dotColor: '#f59e0b',
  },
  {
    value: 4,
    kurdishDigit: '٤',
    label: 'ڕازیم',
    shortLabel: 'ڕازیم',
    activeBg: 'bg-sky-500 text-white shadow-lg shadow-sky-500/30',
    activeBorder: 'border-sky-500',
    activeText: 'text-sky-600 dark:text-sky-400',
    ringColor: 'ring-sky-500/30',
    dotColor: '#0ea5e9',
  },
  {
    value: 5,
    kurdishDigit: '٥',
    label: 'زۆر ڕازیم',
    shortLabel: 'زۆر ڕازیم',
    activeBg: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
    activeBorder: 'border-emerald-500',
    activeText: 'text-emerald-600 dark:text-emerald-400',
    ringColor: 'ring-emerald-500/30',
    dotColor: '#10b981',
  },
];

export const MANAGER_EVALUATION_ITEMS: ManagerEvaluationItem[] = [
  { id: 1, text: 'ڕەفتار و قسەکردنی بەڕێوەبەر لەگەڵ کارمەندان ڕێزدارانەیە.', pillar: 'respect' },
  { id: 2, text: 'ئەرک و بەرپرسیارێتییەکان بە ڕوونی دیاری دەکات.', pillar: 'execution' },
  { id: 3, text: 'کارەکان بە ڕێکوپێکی ڕێکدەخات و لە کاتی خۆیدا جێبەجێیان دەکات.', pillar: 'execution' },
  { id: 4, text: 'بەدواداچوونی بەردەوام بۆ ئیش و کارەکان دەکات.', pillar: 'execution' },
  { id: 5, text: 'لە کاتی خۆیدا وەڵامی تەلەفۆن و نامەکان دەداتەوە.', pillar: 'execution' },
  { id: 6, text: 'گوێ لە ڕا و بۆچوونی کارمەندان دەگرێت.', pillar: 'respect' },
  { id: 7, text: 'ئەگەر بەڵێنێک بدات بۆ کارێک، جێبەجێی دەکات.', pillar: 'execution' },
  { id: 8, text: 'جلوبەرگ و ڕواڵەتی لەگەڵ شوێنی کارەکەدا گونجاوە.', pillar: 'respect' },
  { id: 9, text: 'بڕیارەکانی ڕوون و دادپەروەرانەن و جیاوازی لە نێوان کارمەنداندا ناکات.', pillar: 'fairness' },
  { id: 10, text: 'هەلی گەشەکردن و فێربوونمان بۆ دابین دەکات و سوود لە ئەزموونەکانی وەردەگرین.', pillar: 'fairness' },
  { id: 11, text: 'هەوڵ و ماندووبوونی کارمەندان بەبەهادار دەزانێت.', pillar: 'fairness' },
  { id: 12, text: 'لە کاتی هەڵەدا بە شێوەیەکی دروست ڕێنماییمان دەکات.', pillar: 'fairness' },
  { id: 13, text: 'ڕەخنە بە شێوەیەکی ڕێزدارانە دەگرێت.', pillar: 'respect' },
  { id: 14, text: 'لەگەڵ تیمەکەدا پەیوەندییەکی باشی هەیە.', pillar: 'respect' },
  { id: 15, text: 'پێوانەی فرۆشتن و ئامانجەکان بە ڕوونی دیاری دەکات.', pillar: 'execution' },
  { id: 16, text: 'لە کاتی قەرەباڵغی و زۆریی کاردا هاوکاریمان دەکات.', pillar: 'support' },
  { id: 17, text: 'کات و ماندووبوونی کارمەندان ڕەچاو دەکات.', pillar: 'support' },
  { id: 18, text: 'بۆ چارەسەرکردنی کێشەکان خێرا هەنگاو دەنێت.', pillar: 'support' },
  { id: 19, text: 'زانیاریی پێویست لە کاتی خۆیدا پێمان دەدات.', pillar: 'support' },
  { id: 20, text: 'هانی فرۆشیاران دەدات بۆ باشترکردنی فرۆشتن و بە گشتی لە شێوازی بەڕێوەبردنی ڕازیم.', pillar: 'support' },
];

export const MANAGER_OPEN_QUESTIONS: ManagerOpenQuestion[] = [
  {
    key: 'q1',
    num: '١',
    label: 'بەڕێوەبەر زیاتر دڵنیایی و جەخت لە چ شتێک دەکاتەوە و چ کارێک زۆر دووبارە دەکاتەوە؟',
    placeholder: 'ئەو خاڵ یان کارانە بنووسە کە بەڕێوەبەر زۆرترین جەختیان لەسەر دەکاتەوە...',
  },
  {
    key: 'q2',
    num: '٢',
    label: 'لە ساڵی ڕابردوودا (٢٠٢٥)، باشترین کار کە کرابێت بۆ زیادکردنی فرۆش چییە؟',
    placeholder: 'باشترین هەنگاو یان چالاکی ساڵی ٢٠٢٥ بنووسە بۆ زیادکردنی فرۆش...',
  },
  {
    key: 'q3',
    num: '٣',
    label: 'باشترین پلان بۆ ساڵی ٢٠٢٦ چییە بە مەبەستی زیادکردنی فرۆش؟',
    placeholder: 'پێشنیار و بیرۆکەی پلانەکانت بۆ گەشەی فرۆش لە ساڵی ٢٠٢٦ بنووسە...',
  },
  {
    key: 'q4',
    num: '٤',
    label: 'چ شتێک هەیە خۆشحاڵ دەبیت لە بەڕێوەبەرەکەدا هەبێت، و چ شتێک هەیە حەزی پێ ناکەیت یان لەگەڵ شوێنی کارەکەدا ناگونجێت؟',
    placeholder: 'بە ڕاشکاوانە و بە شێوەی نهێنی ئەو خاڵە ئەرێنی و نەرێنییانە بنووسە...',
  },
  {
    key: 'q5',
    num: '٥',
    label: 'تێبینی و پێشنیار: بۆ باشترکردنی کارەکان پێشنیاری چی دەکەیت بکرێت؟',
    placeholder: 'هەر تێبینی یان پێشنیارێکی تر بۆ پەرەپێدانی ژینگەی کار و پێشانگا...',
  },
];

/** Exact Official Admin-Only Satisfaction Tiers (بەشی سێیەم: شیکردنەوەی ئەنجام) */
export const MANAGER_SCORE_BANDS: ManagerScoreBand[] = [
  {
    key: 'very_high',
    min: 90,
    max: 100,
    rangeLabel: '٩٠ - ١٠٠',
    label: 'زۆر بەرز',
    description: 'سەرکردایەتی نموونەیی و ڕەزامەندی باڵای تیم و فرۆشیاران',
    color: '#10b981',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    darkBadgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barBg: 'bg-gradient-to-r from-emerald-500 to-teal-400',
    glowBg: 'from-emerald-500/15 to-teal-500/5 border-emerald-300',
  },
  {
    key: 'high',
    min: 80,
    max: 89,
    rangeLabel: '٨٠ - ٨٩',
    label: 'بەرز',
    description: 'شێوازی بەڕێوەبردنی سەرکەوتوو و متمانەی باش لەگەڵ تیم',
    color: '#3b82f6',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-300',
    darkBadgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    barBg: 'bg-gradient-to-r from-blue-600 to-sky-400',
    glowBg: 'from-blue-500/15 to-sky-500/5 border-blue-300',
  },
  {
    key: 'medium',
    min: 60,
    max: 79,
    rangeLabel: '٦٠ - ٧٩',
    label: 'مامناوەند',
    description: 'ئاستی جێگیر بەڵام پێویستی بە چاکسازی لە چەند بوارێکدا هەیە',
    color: '#f59e0b',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
    darkBadgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barBg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    glowBg: 'from-amber-500/15 to-yellow-500/5 border-amber-300',
  },
  {
    key: 'weak',
    min: 40,
    max: 59,
    rangeLabel: '٤٠ - ٥٩',
    label: 'لاواز',
    description: 'ناڕەزایی بەرچاو هەیە و پێویستە پلانی خێرای چاکسازی دابنرێت',
    color: '#f97316',
    badgeBg: 'bg-orange-50 text-orange-800 border-orange-300',
    darkBadgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    barBg: 'bg-gradient-to-r from-orange-500 to-amber-500',
    glowBg: 'from-orange-500/15 to-amber-500/5 border-orange-300',
  },
  {
    key: 'very_weak',
    min: 20,
    max: 39,
    rangeLabel: '٢٠ - ٣٩',
    label: 'زۆر لاواز',
    description: 'دۆخی هەستیار و پێویستی بە دەستێوەردانی بەپەلەی ئیدارە هەیە',
    color: '#ef4444',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
    darkBadgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    barBg: 'bg-gradient-to-r from-rose-600 to-red-400',
    glowBg: 'from-rose-500/15 to-red-500/5 border-rose-300',
  },
];

export function computeManagerTotalScore(scores: Record<number, number>): {
  totalScore: number;
  averageScore: number;
  band: ManagerScoreBand;
} {
  let sum = 0;
  for (const item of MANAGER_EVALUATION_ITEMS) {
    const val = Number(scores[item.id] || 0);
    const clamped = Math.min(5, Math.max(1, Math.round(val)));
    sum += clamped;
  }
  const avg = Math.round((sum / MANAGER_EVALUATION_ITEMS.length) * 100) / 100;
  return {
    totalScore: sum,
    averageScore: avg,
    band: getManagerScoreBand(sum),
  };
}

export function getManagerScoreBand(scoreOutOf100: number): ManagerScoreBand {
  if (scoreOutOf100 >= 90) return MANAGER_SCORE_BANDS[0];
  if (scoreOutOf100 >= 80) return MANAGER_SCORE_BANDS[1];
  if (scoreOutOf100 >= 60) return MANAGER_SCORE_BANDS[2];
  if (scoreOutOf100 >= 40) return MANAGER_SCORE_BANDS[3];
  return MANAGER_SCORE_BANDS[4];
}

export function toKurdishDigits(input: string | number): string {
  const map: Record<string, string> = {
    '0': '٠',
    '1': '١',
    '2': '٢',
    '3': '٣',
    '4': '٤',
    '5': '٥',
    '6': '٦',
    '7': '٧',
    '8': '٨',
    '9': '٩',
  };
  return String(input).replace(/\d/g, (d) => map[d] || d);
}
