export interface CodeAffixStat {
  token: string;
  count: number;
  examples: string[];
}

export interface CodeFormatWarning {
  kind: 'duplicate' | 'missing_qty' | 'spaced_prefix' | 'leading_zero';
  message: string;
  models: string[];
}

export interface CodeIntelligenceProfile {
  totalCodes: number;
  uniqueCodes: number;
  prefixes: CodeAffixStat[];
  suffixes: CodeAffixStat[];
  patternStats: {
    numericOnly: number;
    dashVariant: number;
    prefixed: number;
    suffixed: number;
    withSpaces: number;
    leadingZeroSegments: number;
  };
  sampleFormats: string[];
  warnings: CodeFormatWarning[];
  kurdishSummary: string;
}

export interface KurdishSpokenResult {
  displayText: string;
  speechKurdish: string;
  speechPersianPhonetic: string;
  speechArabicPhonetic: string;
  speechKurdishLatin: string;
  speechEnglish: string;
}

export function normalizeDigitsUniversal(input: string): string {
  const eastern = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return String(input || '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const eIdx = eastern.indexOf(ch);
    if (eIdx !== -1) return String(eIdx);
    const pIdx = persian.indexOf(ch);
    if (pIdx !== -1) return String(pIdx);
    return ch;
  });
}

// =============================================================================
// 🧠 SMART PACKAGE / TAB CODE INTELLIGENCE ANALYZER
// =============================================================================
export interface MinimalCodeItem {
  model: string;
  name?: string;
  expectedQty?: number;
}

export function analyzeWarehouseCodes(
  items: MinimalCodeItem[],
  packageItems?: MinimalCodeItem[]
): CodeIntelligenceProfile {
  const sourceItems = items || [];
  const allItems = packageItems && packageItems.length > 0 ? packageItems : sourceItems;

  const prefixMap = new Map<string, { count: number; examples: Set<string> }>();
  const suffixMap = new Map<string, { count: number; examples: Set<string> }>();
  const seenModels = new Map<string, number>();
  const spacedModels: string[] = [];
  const leadingZeroModels: string[] = [];
  const missingQtyModels: string[] = [];
  const sampleFormats: string[] = [];
  const seenSignatures = new Set<string>();

  const patternStats = {
    numericOnly: 0,
    dashVariant: 0,
    prefixed: 0,
    suffixed: 0,
    withSpaces: 0,
    leadingZeroSegments: 0,
  };

  for (const item of sourceItems) {
    const raw = normalizeDigitsUniversal(item.model || '').trim();
    if (!raw) continue;

    const lowKey = raw.toLowerCase();
    seenModels.set(lowKey, (seenModels.get(lowKey) || 0) + 1);

    if (typeof item.expectedQty === 'number' && item.expectedQty <= 0) {
      missingQtyModels.push(raw);
    }

    const upper = raw.toUpperCase();
    const hasSpace = /\s/.test(upper);
    const hasDash = /[-/]/.test(upper);
    const hasLeadingZeroSeg = /(?:^|[-/\s])0[0-9]+/.test(upper);
    const prefixMatch = upper.match(/^([A-Z]{1,6})(?=[\s\-_/]*[0-9])/);
    const suffixMatch = upper.match(/[0-9][\s\-_/]*([A-Z]{2,8})$/) || upper.match(/[-_/\s]([A-Z]{2,8})$/);

    if (hasSpace) {
      patternStats.withSpaces++;
      spacedModels.push(raw);
    }
    if (hasDash) patternStats.dashVariant++;
    if (hasLeadingZeroSeg) {
      patternStats.leadingZeroSegments++;
      leadingZeroModels.push(raw);
    }
    if (/^[0-9]+$/.test(upper)) {
      patternStats.numericOnly++;
    }

    if (prefixMatch && prefixMatch[1]) {
      patternStats.prefixed++;
      const tok = prefixMatch[1];
      if (!prefixMap.has(tok)) prefixMap.set(tok, { count: 0, examples: new Set() });
      const entry = prefixMap.get(tok)!;
      entry.count++;
      if (entry.examples.size < 3) entry.examples.add(raw);
    }

    if (suffixMatch && suffixMatch[1]) {
      patternStats.suffixed++;
      const tok = suffixMatch[1];
      if (!suffixMap.has(tok)) suffixMap.set(tok, { count: 0, examples: new Set() });
      const entry = suffixMap.get(tok)!;
      entry.count++;
      if (entry.examples.size < 3) entry.examples.add(raw);
    }

    const sig = `${prefixMatch ? 'P' : ''}_${hasSpace ? 'S' : ''}_${hasDash ? 'D' : ''}_${suffixMatch ? 'X' : ''}_${/^[0-9]+$/.test(upper) ? 'N' : 'A'}`;
    if (!seenSignatures.has(sig) && sampleFormats.length < 6) {
      seenSignatures.add(sig);
      sampleFormats.push(raw);
    }
  }

  // Also scan package-wide affixes if different from sourceItems
  if (allItems !== sourceItems) {
    for (const item of allItems) {
      const upper = normalizeDigitsUniversal(item.model || '').trim().toUpperCase();
      if (!upper) continue;
      const prefixMatch = upper.match(/^([A-Z]{1,6})(?=[\s\-_/]*[0-9])/);
      const suffixMatch = upper.match(/[0-9][\s\-_/]*([A-Z]{2,8})$/) || upper.match(/[-_/\s]([A-Z]{2,8})$/);
      if (prefixMatch && prefixMatch[1] && !prefixMap.has(prefixMatch[1])) {
        prefixMap.set(prefixMatch[1], { count: 1, examples: new Set([upper]) });
      }
      if (suffixMatch && suffixMatch[1] && !suffixMap.has(suffixMatch[1])) {
        suffixMap.set(suffixMatch[1], { count: 1, examples: new Set([upper]) });
      }
    }
  }

  const prefixes: CodeAffixStat[] = Array.from(prefixMap.entries())
    .map(([token, info]) => ({ token, count: info.count, examples: Array.from(info.examples) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  const suffixes: CodeAffixStat[] = Array.from(suffixMap.entries())
    .map(([token, info]) => ({ token, count: info.count, examples: Array.from(info.examples) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);

  const duplicates = Array.from(seenModels.entries())
    .filter(([, count]) => count > 1)
    .map(([m]) => m.toUpperCase());

  const warnings: CodeFormatWarning[] = [];
  if (duplicates.length > 0) {
    warnings.push({
      kind: 'duplicate',
      message: `${duplicates.length} کۆدی دووبارە لەم خشتەیەدا هەیە (بۆ نموونە: ${duplicates.slice(0, 3).join(', ')})`,
      models: duplicates.slice(0, 8),
    });
  }
  if (spacedModels.length > 0) {
    warnings.push({
      kind: 'spaced_prefix',
      message: `${spacedModels.length} کۆد بۆشایی تێدایە (وەک «${spacedModels[0]}») — سکانەر بە زیرەکی لەگەڵ جۆری بێ بۆشایش هاوتای دەکات`,
      models: spacedModels.slice(0, 8),
    });
  }
  if (leadingZeroModels.length > 0) {
    warnings.push({
      kind: 'leading_zero',
      message: `${leadingZeroModels.length} کۆد سفری سەرەتایی تێدایە (وەک «${leadingZeroModels[0]}») وەک سفر دەپارێزرێت و دەخوێندرێتەوە`,
      models: leadingZeroModels.slice(0, 8),
    });
  }
  if (missingQtyModels.length > 0) {
    warnings.push({
      kind: 'missing_qty',
      message: `${missingQtyModels.length} کاڵا بڕی چاوەڕوانکراوی سفری تێدایە`,
      models: missingQtyModels.slice(0, 8),
    });
  }

  const parts: string[] = [];
  parts.push(`کۆی ${sourceItems.length} کۆد پشکێنران`);
  if (prefixes.length > 0) {
    parts.push(`پێشگرە ناسراوەکان: ${prefixes.slice(0, 5).map((p) => p.token).join('، ')}`);
  }
  if (suffixes.length > 0) {
    parts.push(`پاشگرە ناسراوەکان: ${suffixes.slice(0, 5).map((s) => `-${s.token}`).join('، ')}`);
  }
  if (patternStats.dashVariant > 0) {
    parts.push(`${patternStats.dashVariant} کۆدی داشدار (وەک 21345-02)`);
  }

  return {
    totalCodes: sourceItems.length,
    uniqueCodes: seenModels.size,
    prefixes,
    suffixes,
    patternStats,
    sampleFormats,
    warnings,
    kurdishSummary: parts.join(' • '),
  };
}

// =============================================================================
// 🗣️ KURDISH SORANI SPOKEN CODE & QUANTITY ENGINE
// =============================================================================
const KU_ONES = ['', 'یەک', 'دوو', 'سێ', 'چوار', 'پێنج', 'شەش', 'حەوت', 'هەشت', 'نۆ'];
const KU_TEENS = [
  'دە',
  'یازدە',
  'دوازدە',
  'سێزدە',
  'چواردە',
  'پازدە',
  'شازدە',
  'حەڤدە',
  'هەژدە',
  'نۆزدە',
];
const KU_TENS = ['', 'دە', 'بیست', 'سی', 'چل', 'پەنجا', 'شەست', 'حەفتا', 'هەشتا', 'نەود'];
const KU_HUNDREDS = [
  '',
  'سەد',
  'دووسەد',
  'سێسەد',
  'چوارسەد',
  'پێنجسەد',
  'شەشسەد',
  'حەوتسەد',
  'هەشتسەد',
  'نۆسەد',
];

const LETTER_PHONETICS_KU: Record<string, string> = {
  A: 'ئەی',
  B: 'بی',
  C: 'سی',
  D: 'دی',
  E: 'ئی',
  F: 'ئێف',
  G: 'جی',
  H: 'ئێچ',
  I: 'ئای',
  J: 'جەی',
  K: 'کەی',
  L: 'ئێڵ',
  M: 'ئێم',
  N: 'ئێن',
  O: 'ئۆ',
  P: 'پی',
  Q: 'کیو',
  R: 'ئار',
  S: 'ئێس',
  T: 'تی',
  U: 'یو',
  V: 'ڤی',
  W: 'دەبڵیو',
  X: 'ئێکس',
  Y: 'وای',
  Z: 'زێد',
};

const WAREHOUSE_TAG_WORDS_KU: Record<string, string> = {
  BALK: 'باڵک',
  BULK: 'باڵک',
  BLK: 'بڵاک',
  ASH: 'ئاش',
  OAK: 'ئۆک',
  KIT: 'کیت',
  SET: 'سێت',
  TOP: 'تۆپ',
  BASE: 'بەیس',
  LEG: 'لێگ',
  WHT: 'وایت',
  GRY: 'گڕەی',
  BRN: 'بڕاون',
  WAL: 'واڵنەت',
  CHR: 'چێری',
  CHERRY: 'چێری',
  WHITE: 'وایت',
  BLACK: 'بڵاک',
  BROWN: 'بڕاون',
  GRAY: 'گڕەی',
  GREY: 'گڕەی',
  GLASS: 'گڵاس',
  MIRROR: 'میرەر',
  RAIL: 'ڕێڵ',
  HEAD: 'هێد',
  FOOT: 'فووت',
  BOX: 'بۆکس',
  CASE: 'کەیس',
  KING: 'کینگ',
  QUEEN: 'کوین',
  FULL: 'فوول',
  TWIN: 'توین',
  SOFA: 'سۆفا',
  CHAIR: 'چەیر',
  TABLE: 'تەیبڵ',
};

export function numberToKurdish0To999(n: number): string {
  const num = Math.floor(Math.max(0, n));
  if (num === 0) return 'سفر';
  if (num < 10) return KU_ONES[num];
  if (num < 20) return KU_TEENS[num - 10];

  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const rem = num % 100;

  if (h > 0 && h < 10) {
    parts.push(KU_HUNDREDS[h]);
  }
  if (rem > 0) {
    if (rem < 10) {
      parts.push(KU_ONES[rem]);
    } else if (rem < 20) {
      parts.push(KU_TEENS[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const u = rem % 10;
      parts.push(KU_TENS[t]);
      if (u > 0) parts.push(KU_ONES[u]);
    }
  }
  return parts.join(' و ');
}

function numberToKurdishQuantity(qty: number): string {
  const n = Math.floor(Math.max(0, qty));
  if (n < 1000) return numberToKurdish0To999(n);
  const thousands = Math.floor(n / 1000);
  const rem = n % 1000;
  const thWord = thousands === 1 ? 'هەزار' : `${numberToKurdish0To999(thousands)} هەزار`;
  return rem > 0 ? `${thWord} و ${numberToKurdish0To999(rem)}` : thWord;
}

/**
 * Convert a digit string inside a SKU/model code into natural warehouse Kurdish speech.
 * Preserves leading zeros ("02" -> "سفر دوو") and reads 5-digit models as 2+3 groups
 * ("21345" -> "بیست و یەک سێسەد و چل و پێنج").
 */
export function speakDigitBlockKurdish(rawDigits: string): string {
  const digits = normalizeDigitsUniversal(rawDigits).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (/^0+$/.test(digits)) {
    return digits.split('').map(() => 'سفر').join(' ');
  }

  // Recursive chunker respecting leading zeros inside any chunk
  const speakGroup = (seg: string): string => {
    if (!seg) return '';
    if (/^0+$/.test(seg)) return seg.split('').map(() => 'سفر').join(' ');
    const leadZerosMatch = seg.match(/^(0+)(.+)$/);
    if (leadZerosMatch) {
      const zWords = leadZerosMatch[1].split('').map(() => 'سفر').join(' ');
      return `${zWords} ${numberToKurdish0To999(parseInt(leadZerosMatch[2], 10))}`;
    }
    return numberToKurdish0To999(parseInt(seg, 10));
  };

  if (digits.length <= 3) return speakGroup(digits);
  if (digits.length === 4) {
    return `${speakGroup(digits.slice(0, 2))} ${speakGroup(digits.slice(2))}`;
  }
  if (digits.length === 5) {
    return `${speakGroup(digits.slice(0, 2))} ${speakGroup(digits.slice(2))}`;
  }
  if (digits.length === 6) {
    return `${speakGroup(digits.slice(0, 3))} ${speakGroup(digits.slice(3))}`;
  }
  if (digits.length === 7) {
    return `${speakGroup(digits.slice(0, 3))} ${speakGroup(digits.slice(3, 5))} ${speakGroup(digits.slice(5))}`;
  }

  // 8+ digits: split into 2-digit / 3-digit groups cleanly
  const chunks: string[] = [];
  let idx = 0;
  while (idx < digits.length) {
    const remaining = digits.length - idx;
    const step = remaining === 3 ? 3 : 2;
    chunks.push(speakGroup(digits.slice(idx, idx + step)));
    idx += step;
  }
  return chunks.join(' ');
}

function speakAlphaBlockKurdish(rawLetters: string): string {
  const upper = rawLetters.toUpperCase().replace(/[^A-Z]/g, '');
  if (!upper) return '';
  if (WAREHOUSE_TAG_WORDS_KU[upper]) {
    return WAREHOUSE_TAG_WORDS_KU[upper];
  }
  // Spell short codes (like EV, B, SL, T, PK) letter-by-letter
  return upper
    .split('')
    .map((ch) => LETTER_PHONETICS_KU[ch] || ch)
    .join(' ');
}

function tokenizeModelCode(model: string): string[] {
  const clean = normalizeDigitsUniversal(model || '').trim().toUpperCase();
  if (!clean) return [];
  // Split around whitespace and dashes/slashes, keeping dashes/slashes
  const rawParts = clean.split(/(\s+|[-/])/).filter((p) => p && !/^\s+$/.test(p));
  const tokens: string[] = [];
  for (const part of rawParts) {
    if (part === '-' || part === '/') {
      tokens.push('-');
      continue;
    }
    // Split letter<->digit boundaries e.g. "EV21345" -> ["EV", "21345"]
    const subParts = part.match(/[A-Z]+|[0-9]+/g) || [part];
    tokens.push(...subParts);
  }
  return tokens;
}

/**
 * Convert Sorani Kurdish characters to Persian script (keeps پ، چ، گ، ژ since Persian TTS knows them).
 */
export function toPhoneticPersian(kuText: string): string {
  return kuText
    .replace(/ڤ/g, 'ف')
    .replace(/ە/g, 'ه')
    .replace(/ێ/g, 'ی')
    .replace(/ۆ/g, 'و')
    .replace(/ڵ/g, 'ل')
    .replace(/ڕ/g, 'ر')
    .replace(/عەدەد/g, 'عدد')
    .replace(/سفر/g, 'صفر');
}

/**
 * Convert Sorani Kurdish phrase to Arabic-script phonetics so iOS/Android `ar` voices
 * pronounce all Kurdish words clearly without silently skipping Sorani codepoints.
 */
export function toPhoneticArabic(kuText: string): string {
  return kuText
    .replace(/عەدەد/g, 'عدد')
    .replace(/مۆدێلی/g, 'موديلي')
    .replace(/لە/g, 'له')
    .replace(/وەرگیرا/g, 'ورغيرا')
    .replace(/تەواو/g, 'تواو')
    .replace(/سفر/g, 'صفر')
    .replace(/چ/g, 'تش')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب')
    .replace(/گ/g, 'ك')
    .replace(/ژ/g, 'ج')
    .replace(/ڵ/g, 'ل')
    .replace(/ڕ/g, 'ر')
    .replace(/ێ/g, 'ي')
    .replace(/ۆ/g, 'و')
    .replace(/ە/g, 'ه')
    .replace(/ی/g, 'ي')
    .replace(/ک/g, 'ك');
}

const KURDISH_TO_LATIN_MAP: Record<string, string> = {
  'یەک': 'Yak',
  'دوو': 'Doo',
  'سێ': 'Seh',
  'چوار': 'Chwar',
  'پێنج': 'Penj',
  'شەش': 'Shash',
  'حەوت': 'Hawt',
  'هەشت': 'Hasht',
  'نۆ': 'Noh',
  'دە': 'Dah',
  'یازدە': 'Yazdah',
  'دوازدە': 'Dwazdah',
  'سیانزە': 'Syanzah',
  'چواردە': 'Chwardah',
  'پانزە': 'Panzah',
  'شازدە': 'Shazdah',
  'حەڤدە': 'Hawdah',
  'هەژدە': 'Hazhdah',
  'نۆزدە': 'Nozdah',
  'بیست': 'Beest',
  'سی': 'See',
  'چل': 'Chl',
  'پەنجا': 'Panja',
  'شەست': 'Shest',
  'حەفتا': 'Hafta',
  'هەشتا': 'Hashta',
  'نەوەد': 'Nawad',
  'سەد': 'Sad',
  'دووسەد': 'Doosad',
  'سێسەد': 'Sehsad',
  'چوارسەد': 'Chwarsad',
  'پێنجسەد': 'Penjsad',
  'شەشسەد': 'Shashsad',
  'حەوتسەد': 'Hawtsad',
  'هەشتسەد': 'Hashtsad',
  'نۆسەد': 'Nohsad',
  'هەزار': 'Hazar',
  'سفر': 'Sefr',
  'داش': 'Dash',
  'عەدەد': 'adad',
  'لە': 'la',
  'مۆدێلی': 'modelee',
  'ئی': 'Ee',
  'ڤی': 'Vee',
  'و': 'oo',
};

export function toKurdishLatinPhonetic(kuText: string): string {
  const words = (kuText || '').split(/\s+/);
  return words
    .map((w) => KURDISH_TO_LATIN_MAP[w] || w)
    .join(' ');
}

function formatEnglishSpokenScan(model: string, qty: number): string {
  const tokens = tokenizeModelCode(model);
  const enParts = tokens.map((tok) => {
    if (tok === '-') return 'dash';
    if (/^[0-9]+$/.test(tok)) {
      if (tok.startsWith('0') && tok.length > 1) return tok.split('').join(' ');
      if (tok.length === 5) return `${tok.slice(0, 2)}, ${tok.slice(2)}`;
      return tok;
    }
    if (WAREHOUSE_TAG_WORDS_KU[tok]) return tok.toLowerCase();
    return tok.split('').join(' ');
  });
  return `${qty} ${qty === 1 ? 'piece' : 'pieces'}, model ${enParts.join(', ')}`;
}

/**
 * Generate crisp Sorani Kurdish spoken & display phrasing for a scanned model + quantity:
 * e.g. `21345-02`, `qty=2` ->
 * "2 عەدەد لە مۆدێلی بیست و یەک سێسەد و چل و پێنج داش سفر دوو"
 * e.g. `EV 21345-02`, `qty=2` ->
 * "2 عەدەد لە مۆدێلی ئی ڤی بیست و یەک سێسەد و چل و پێنج داش سفر دوو"
 */
export function formatKurdishSpokenScan(model: string, qty: number): KurdishSpokenResult {
  const cleanQty = Math.max(1, Math.round(qty || 1));
  const tokens = tokenizeModelCode(model);

  const spokenModelParts: string[] = [];
  for (const tok of tokens) {
    if (tok === '-') {
      spokenModelParts.push('داش');
    } else if (/^[0-9]+$/.test(tok)) {
      spokenModelParts.push(speakDigitBlockKurdish(tok));
    } else if (/^[A-Z]+$/.test(tok)) {
      spokenModelParts.push(speakAlphaBlockKurdish(tok));
    } else {
      spokenModelParts.push(tok);
    }
  }

  const modelPhrase = spokenModelParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || model;
  const qtyWord = numberToKurdishQuantity(cleanQty);

  const displayText = `${cleanQty} عەدەد لە مۆدێلی ${modelPhrase}`;
  const speechKurdish = `${qtyWord} عەدەد لە مۆدێلی ${modelPhrase}`;

  return {
    displayText,
    speechKurdish,
    speechPersianPhonetic: toPhoneticPersian(speechKurdish),
    speechArabicPhonetic: toPhoneticArabic(speechKurdish),
    speechKurdishLatin: toKurdishLatinPhonetic(speechKurdish),
    speechEnglish: formatEnglishSpokenScan(model, cleanQty),
  };
}
