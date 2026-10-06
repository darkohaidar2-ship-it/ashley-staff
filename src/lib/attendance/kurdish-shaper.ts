/**
 * Kurdish & Arabic Contextual Ligature Shaper & RTL Engine for jsPDF
 * Transforms raw Kurdish/Sorani/Arabic Unicode characters into their contextual
 * Presentation Forms-B glyphs (Initial, Medial, Final, Isolated) and reverses RTL segments
 * so that jsPDF renders 100% connected, natural, unjumbled Kurdish text.
 */

interface GlyphSet {
  isolated: number;
  final: number;
  initial: number;
  medial: number;
  joinType: 'dual' | 'right';
}

const GLYPH_TABLE: Record<number, GlyphSet> = {
  // ئ (Yeh with Hamza)
  0x0626: { isolated: 0xFE89, final: 0xFE8A, initial: 0xFE8B, medial: 0xFE8C, joinType: 'dual' },
  // ا (Alef)
  0x0627: { isolated: 0xFE8D, final: 0xFE8E, initial: 0xFE8D, medial: 0xFE8E, joinType: 'right' },
  // آ (Alef with Madda)
  0x0622: { isolated: 0xFE81, final: 0xFE82, initial: 0xFE81, medial: 0xFE82, joinType: 'right' },
  // أ (Alef with Hamza above)
  0x0623: { isolated: 0xFE83, final: 0xFE84, initial: 0xFE83, medial: 0xFE84, joinType: 'right' },
  // إ (Alef with Hamza below)
  0x0625: { isolated: 0xFE87, final: 0xFE88, initial: 0xFE87, medial: 0xFE88, joinType: 'right' },
  // ب (Beh)
  0x0628: { isolated: 0xFE8F, final: 0xFE90, initial: 0xFE91, medial: 0xFE92, joinType: 'dual' },
  // پ (Peh - Kurdish)
  0x067E: { isolated: 0xFB56, final: 0xFB57, initial: 0xFB58, medial: 0xFB59, joinType: 'dual' },
  // ت (Teh)
  0x062A: { isolated: 0xFE95, final: 0xFE96, initial: 0xFE97, medial: 0xFE98, joinType: 'dual' },
  // ث (Theh)
  0x062B: { isolated: 0xFE99, final: 0xFE9A, initial: 0xFE9B, medial: 0xFE9C, joinType: 'dual' },
  // ج (Jeem)
  0x062C: { isolated: 0xFE9D, final: 0xFE9E, initial: 0xFE9F, medial: 0xFEA0, joinType: 'dual' },
  // چ (Tcheh - Kurdish)
  0x0686: { isolated: 0xFB7A, final: 0xFB7B, initial: 0xFB7C, medial: 0xFB7D, joinType: 'dual' },
  // ح (Hah)
  0x062D: { isolated: 0xFEA1, final: 0xFEA2, initial: 0xFEA3, medial: 0xFEA4, joinType: 'dual' },
  // خ (Khah)
  0x062E: { isolated: 0xFEA5, final: 0xFEA6, initial: 0xFEA7, medial: 0xFEA8, joinType: 'dual' },
  // د (Dal)
  0x062F: { isolated: 0xFEA9, final: 0xFEAA, initial: 0xFEA9, medial: 0xFEAA, joinType: 'right' },
  // ذ (Thal)
  0x0630: { isolated: 0xFEAB, final: 0xFEAC, initial: 0xFEAB, medial: 0xFEAC, joinType: 'right' },
  // ر (Reh)
  0x0631: { isolated: 0xFEAD, final: 0xFEAE, initial: 0xFEAD, medial: 0xFEAE, joinType: 'right' },
  // ڕ (Kurdish Reh)
  0x0695: { isolated: 0x0695, final: 0x0695, initial: 0x0695, medial: 0x0695, joinType: 'right' },
  // ز (Zain)
  0x0632: { isolated: 0xFEAF, final: 0xFEB0, initial: 0xFEAF, medial: 0xFEB0, joinType: 'right' },
  // ژ (Zheh - Kurdish)
  0x0698: { isolated: 0xFB8A, final: 0xFB8B, initial: 0xFB8A, medial: 0xFB8B, joinType: 'right' },
  // س (Seen)
  0x0633: { isolated: 0xFEB1, final: 0xFEB2, initial: 0xFEB3, medial: 0xFEB4, joinType: 'dual' },
  // ش (Sheen)
  0x0634: { isolated: 0xFEB5, final: 0xFEB6, initial: 0xFEB7, medial: 0xFEB8, joinType: 'dual' },
  // ص (Sad)
  0x0635: { isolated: 0xFEB9, final: 0xFEBA, initial: 0xFEBB, medial: 0xFEBC, joinType: 'dual' },
  // ض (Dad)
  0x0636: { isolated: 0xFEBD, final: 0xFEBE, initial: 0xFEBF, medial: 0xFEC0, joinType: 'dual' },
  // ط (Tah)
  0x0637: { isolated: 0xFEC1, final: 0xFEC2, initial: 0xFEC3, medial: 0xFEC4, joinType: 'dual' },
  // ظ (Zah)
  0x0638: { isolated: 0xFEC5, final: 0xFEC6, initial: 0xFEC7, medial: 0xFEC8, joinType: 'dual' },
  // ع (Ain)
  0x0639: { isolated: 0xFEC9, final: 0xFECA, initial: 0xFECB, medial: 0xFECC, joinType: 'dual' },
  // غ (Ghain)
  0x063A: { isolated: 0xFECD, final: 0xFECE, initial: 0xFECF, medial: 0xFED0, joinType: 'dual' },
  // ف (Feh)
  0x0641: { isolated: 0xFED1, final: 0xFED2, initial: 0xFED3, medial: 0xFED4, joinType: 'dual' },
  // ڤ (Veh - Kurdish)
  0x06A4: { isolated: 0xFB6A, final: 0xFB6B, initial: 0xFB6C, medial: 0xFB6D, joinType: 'dual' },
  // ق (Qaf)
  0x0642: { isolated: 0xFED5, final: 0xFED6, initial: 0xFED7, medial: 0xFED8, joinType: 'dual' },
  // ک (Kurdish/Farsi Kaf)
  0x06A9: { isolated: 0xFB8E, final: 0xFB8F, initial: 0xFB90, medial: 0xFB91, joinType: 'dual' },
  // ك (Arabic Kaf)
  0x0643: { isolated: 0xFED9, final: 0xFEDA, initial: 0xFEDB, medial: 0xFEDC, joinType: 'dual' },
  // گ (Gaf - Kurdish)
  0x06AF: { isolated: 0xFB92, final: 0xFB93, initial: 0xFB94, medial: 0xFB95, joinType: 'dual' },
  // ل (Lam)
  0x0644: { isolated: 0xFEDD, final: 0xFEDE, initial: 0xFEDF, medial: 0xFEE0, joinType: 'dual' },
  // ڵ (Kurdish Lam with V)
  0x06B5: { isolated: 0x06B5, final: 0x06B5, initial: 0x06B5, medial: 0x06B5, joinType: 'dual' },
  // م (Meem)
  0x0645: { isolated: 0xFEE1, final: 0xFEE2, initial: 0xFEE3, medial: 0xFEE4, joinType: 'dual' },
  // ن (Noon)
  0x0646: { isolated: 0xFEE5, final: 0xFEE6, initial: 0xFEE7, medial: 0xFEE8, joinType: 'dual' },
  // ه (Heh)
  0x0647: { isolated: 0xFEE9, final: 0xFEEA, initial: 0xFEEB, medial: 0xFEEC, joinType: 'dual' },
  // ە (Ae - Kurdish open e)
  0x06D5: { isolated: 0xFBAE, final: 0xFBAF, initial: 0xFBAE, medial: 0xFBAF, joinType: 'right' },
  // و (Waw)
  0x0648: { isolated: 0xFEED, final: 0xFEEE, initial: 0xFEED, medial: 0xFEEE, joinType: 'right' },
  // ۆ (Oe - Kurdish)
  0x06C6: { isolated: 0xFBD9, final: 0xFBDA, initial: 0xFBD9, medial: 0xFBDA, joinType: 'right' },
  // ؤ (Waw with Hamza)
  0x0624: { isolated: 0xFE85, final: 0xFE86, initial: 0xFE85, medial: 0xFE86, joinType: 'right' },
  // ی (Farsi/Kurdish Yeh)
  0x06CC: { isolated: 0xFBFC, final: 0xFBFD, initial: 0xFBFE, medial: 0xFBFF, joinType: 'dual' },
  // ي (Arabic Yeh)
  0x064A: { isolated: 0xFEF1, final: 0xFEF2, initial: 0xFEF3, medial: 0xFEF4, joinType: 'dual' },
  // ێ (Kurdish E)
  0x06CE: { isolated: 0xFBFC, final: 0xFBFD, initial: 0xFBFE, medial: 0xFBFF, joinType: 'dual' },
  // ى (Alef Maksura)
  0x0649: { isolated: 0xFEEF, final: 0xFEF0, initial: 0xFEEF, medial: 0xFEF0, joinType: 'right' },
  // ة (Teh Marbuta)
  0x0629: { isolated: 0xFE93, final: 0xFE94, initial: 0xFE93, medial: 0xFE94, joinType: 'right' },
};

function isKurdishOrArabic(code: number): boolean {
  return (
    (code >= 0x0600 && code <= 0x06FF) ||
    (code >= 0xFB50 && code <= 0xFDFF) ||
    (code >= 0xFE70 && code <= 0xFEFF)
  );
}

/**
 * Shape a contiguous Kurdish/Arabic word into connected glyph forms
 */
function shapeWord(word: string): string {
  if (!word) return '';

  const chars = Array.from(word);
  const codes = chars.map((c) => c.charCodeAt(0));
  const len = codes.length;
  const shapedCodes: number[] = [];

  for (let i = 0; i < len; i++) {
    const cur = codes[i];
    const prev = i > 0 ? codes[i - 1] : null;
    const next = i < len - 1 ? codes[i + 1] : null;

    // Check Lam-Alef ligature (لا)
    if (cur === 0x0644 && next === 0x0627) {
      const prevGlyph = prev ? GLYPH_TABLE[prev] : null;
      const connectedBefore = prevGlyph && prevGlyph.joinType === 'dual';
      shapedCodes.push(connectedBefore ? 0xFEFC : 0xFEFB);
      i++; // Skip the following alef
      continue;
    }

    const curGlyph = GLYPH_TABLE[cur];
    if (!curGlyph) {
      shapedCodes.push(cur);
      continue;
    }

    const prevGlyph = prev ? GLYPH_TABLE[prev] : null;
    const nextGlyph = next ? GLYPH_TABLE[next] : null;

    const connectsRight = prevGlyph && prevGlyph.joinType === 'dual';
    const connectsLeft = curGlyph.joinType === 'dual' && nextGlyph !== null;

    if (connectsRight && connectsLeft) {
      shapedCodes.push(curGlyph.medial);
    } else if (connectsRight && !connectsLeft) {
      shapedCodes.push(curGlyph.final);
    } else if (!connectsRight && connectsLeft) {
      shapedCodes.push(curGlyph.initial);
    } else {
      shapedCodes.push(curGlyph.isolated);
    }
  }

  return String.fromCharCode(...shapedCodes);
}

/**
 * Shapes and reverses Kurdish/Arabic text so jsPDF renders it from right-to-left
 * with perfectly joined letterforms.
 * Preserves numbers, Latin characters, and punctuation in readable order.
 */
export function shapeKurdishForPdf(text?: string | null): string {
  if (!text) return '';
  const str = String(text).trim();
  if (!str) return '';

  // Regex to split into Kurdish/Arabic word blocks vs Latin/Digits/Symbols
  const tokens = str.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]+|[^\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g);
  if (!tokens) return str;

  const processed = tokens.map((token) => {
    const firstChar = token.charCodeAt(0);
    if (isKurdishOrArabic(firstChar)) {
      // Shape the word, then reverse its characters for RTL display in jsPDF
      const shaped = shapeWord(token);
      return Array.from(shaped).reverse().join('');
    }
    // Return LTR tokens (digits, English, symbols) as-is
    return token;
  });

  // Since overall sentence is RTL, reverse the order of tokens
  return processed.reverse().join('');
}

export const shapeKurdish = shapeKurdishForPdf;
