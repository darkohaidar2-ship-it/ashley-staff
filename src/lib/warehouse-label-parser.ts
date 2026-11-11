import { SheetsAuditItem } from '@/app/api/warehouse/sheets-sync/route';
import { CodeIntelligenceProfile, normalizeDigitsUniversal } from '@/lib/warehouse-code-intelligence';

export interface ParsedCartonLabel {
  itemNo: string | null;
  caseQty: number | null;
  matchedItem: SheetsAuditItem | null;
  matchConfidence: 'exact' | 'normalized' | 'affix' | 'fuzzy' | 'none';
  isCompleteRead: boolean;
  rawText: string;
}

export interface CodeMatchContext {
  prefixes?: string[];
  suffixes?: string[];
}

export function normalizeDigits(input: string): string {
  return normalizeDigitsUniversal(input);
}

/**
 * Strip punctuation and whitespace for resilient SKU/model comparison.
 */
export function normalizeModelCode(code: string): string {
  return normalizeDigits(code)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Strip known letter prefixes (e.g. EV) and letter suffixes (e.g. -BALK, BLK)
 * while keeping the numeric/dash core intact (e.g. "21345-02").
 */
function stripAffixesToCore(
  code: string,
  extraPrefixes: string[] = [],
  extraSuffixes: string[] = []
): string {
  let clean = normalizeDigits(code).toUpperCase().trim();
  const sortedPrefixes = [...extraPrefixes]
    .map((p) => p.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const pre of sortedPrefixes) {
    const re = new RegExp(`^${pre}[\\s\\-_/]*(?=[0-9])`);
    if (re.test(clean)) {
      clean = clean.replace(re, '');
      break;
    }
  }

  const sortedSuffixes = [...extraSuffixes]
    .map((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const suf of sortedSuffixes) {
    const re = new RegExp(`[\\s\\-_/]*${suf}$`);
    if (re.test(clean) && clean.replace(re, '').length >= 4) {
      clean = clean.replace(re, '');
      break;
    }
  }

  // Fallback generic short alpha prefix before digits & alpha tag suffix after digits/dash
  clean = clean.replace(/^[A-Z]{1,4}[\s\-_/]*(?=[0-9]{4,})/, '');
  clean = clean.replace(/(?<=[0-9])[\s\-_/]+[A-Z]{2,8}$/, '');
  return normalizeModelCode(clean);
}

/**
 * Extract trailing numeric dash segments (e.g. "02" from "EV 21345-02-BALK")
 * so "-01" is never confused with "-02".
 */
function extractNumericTailSegment(code: string): string | null {
  const clean = normalizeDigits(code).toUpperCase().trim();
  const match = clean.match(/[-/]([0-9]{1,3})(?:[\s\-_/]+[A-Z]{2,8})?$/);
  return match ? match[1] : null;
}

const OCR_CONFUSION_PAIRS = new Set([
  '0O', 'O0', '0Q', 'Q0', '1I', 'I1', '1L', 'L1', 'IL', 'LI',
  '5S', 'S5', '8B', 'B8', '2Z', 'Z2', '6G', 'G6',
]);

function isLikelyOcrConfusion(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (!OCR_CONFUSION_PAIRS.has(`${a[i]}${b[i]}`)) return false;
        diffs++;
        if (diffs > 1) return false;
      }
    }
    return diffs === 1;
  }
  // 1 missing/extra punctuation-like char distance <= 1 for long >= 7 char SKUs
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length < 7) return false;
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i++;
      j++;
    } else if (!skipped) {
      skipped = true;
      i++;
    } else {
      return false;
    }
  }
  return true;
}

const IGNORED_CODE_WORDS = new Set([
  'ITEM', 'NO', 'NUMBER', 'CASE', 'QTY', 'QUANTITY', 'OTY', 'PCS', 'CTN', 'CARTON',
  'BOX', 'MODEL', 'SKU', 'PART', 'MADE', 'IN', 'CHINA', 'VIETNAM', 'MALAYSIA',
  'INDONESIA', 'TURKEY', 'ASHLEY', 'FURNITURE', 'GROSS', 'NET', 'WEIGHT', 'CBM',
  'COLOR', 'SIZE', 'PACK', 'PO', 'LOT', 'OF',
]);

function cleanCapturedCodeCandidate(raw: string): string {
  // Trim trailing CASE / QTY words if OCR fused two columns onto one line
  const cut = raw
    .replace(/\s+(?:CASE|CTN|QTY|Q['’]?TY|PCS|QUANTITY)\b.*$/i, '')
    .replace(/[:;,.\s]+$/, '')
    .trim();
  return cut.toUpperCase();
}

/**
 * Extract `ITEM NO` (model/SKU) from warehouse carton label text.
 * Supports same-line (`ITEM NO: EV 21345-02-BALK`) and stacked lines (`ITEM NO\nEV 21345-02`).
 */
export function extractItemNoFromText(text: string): string | null {
  const clean = normalizeDigits(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Supports optional short prefix + space + main code + optional suffix word
  // e.g. "EV 21345-02", "EV 21345-02-BALK", "21345-02 BALK", "B555-31", "1050438"
  const codeCapture =
    '((?:[A-Z]{1,6}\\s+)?[A-Z0-9][A-Z0-9\\-/_]{1,26}(?:\\s+[A-Z]{2,8})?)';

  const sameLinePatterns = [
    new RegExp(
      `(?:item|1tem|iten|i\\s*tem)\\s*(?:no\\.?|n[o0]|number|#|code)?\\s*[:.\\-=]?\\s*${codeCapture}`,
      'i'
    ),
    new RegExp(
      `(?:model|mod\\.?|sku|art\\.?\\s*no|part\\s*(?:no|#))\\s*[:.\\-=]?\\s*${codeCapture}`,
      'i'
    ),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stacked format: line has only header "ITEM NO" and next line holds the model code
    if (
      /^(?:item|1tem|iten)\s*(?:no\.?|n[o0]|number|#)?\s*[:.\-=]?$/i.test(line) ||
      /^(?:model|sku|part\s*(?:no|#))\s*(?:no\.?|#)?\s*[:.\-=]?$/i.test(line)
    ) {
      const nextLine = lines[i + 1] || '';
      if (nextLine && !/^(?:case|qty|q['’]?ty|pcs)\b/i.test(nextLine)) {
        const nextMatch = nextLine.match(new RegExp(`^${codeCapture}`, 'i'));
        if (nextMatch && nextMatch[1]) {
          const candidate = cleanCapturedCodeCandidate(nextMatch[1]);
          if (candidate && !IGNORED_CODE_WORDS.has(candidate)) {
            return candidate;
          }
        }
      }
    }

    for (const pat of sameLinePatterns) {
      const m = line.match(pat);
      if (m && m[1]) {
        const candidate = cleanCapturedCodeCandidate(m[1]);
        if (
          candidate &&
          !IGNORED_CODE_WORDS.has(candidate) &&
          normalizeModelCode(candidate).length >= 2
        ) {
          return candidate;
        }
      }
    }
  }

  return null;
}

/**
 * Extract `CASE QTY` (unit count per carton) from carton label text.
 */
export function extractCaseQtyFromText(text: string): number | null {
  const clean = normalizeDigits(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parseNumericToken = (raw: string): number | null => {
    const fixed = raw
      .toUpperCase()
      .replace(/[OQ]/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/[^0-9]/g, '');
    if (!fixed) return null;
    const n = parseInt(fixed, 10);
    return Number.isFinite(n) && n >= 1 && n <= 9999 ? n : null;
  };

  // Priority 1: Explicit "CASE QTY" / "CTN QTY" / "PACK QTY"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const caseSameLine = line.match(
      /(?:case|c['’]?ase|ctn|carton|pack|pk|box|inner)\s*(?:q['’]?ty|0ty|oty|gty|quantity)\s*[:.\-=]?\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|units|ea|set))?\b/i
    );
    if (caseSameLine && caseSameLine[1]) {
      const parsed = parseNumericToken(caseSameLine[1]);
      if (parsed !== null) return parsed;
    }

    if (/(?:case|ctn|carton|pack|box)\s*(?:q['’]?ty|0ty|oty|gty|quantity)\s*[:.\-=]?$/i.test(line)) {
      const nextLine = lines[i + 1] || '';
      const stackedMatch = nextLine.match(/^\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|units|ea))?\b/i);
      if (stackedMatch && stackedMatch[1]) {
        const parsed = parseNumericToken(stackedMatch[1]);
        if (parsed !== null) return parsed;
      }
    }
  }

  // Priority 2: Generic "QTY: N" or "QUANTITY: N" (skipping weights/dimensions/carton X of Y lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(?:gw|nw|weight|lbs|kg|cbm|mm|cm|inch|gross|net|of)\b/i.test(line)) continue;

    const qtyMatch = line.match(/(?:^|\s)(?:q['’]?ty|0ty|oty|quantity)\s*[:.\-=]?\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|ea))?\b/i);
    if (qtyMatch && qtyMatch[1]) {
      const parsed = parseNumericToken(qtyMatch[1]);
      if (parsed !== null) return parsed;
    }

    if (/^(?:q['’]?ty|0ty|oty|quantity)\s*[:.\-=]?$/i.test(line)) {
      const nextLine = lines[i + 1] || '';
      const stackedMatch = nextLine.match(/^\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|ea))?\b/i);
      if (stackedMatch && stackedMatch[1]) {
        const parsed = parseNumericToken(stackedMatch[1]);
        if (parsed !== null) return parsed;
      }
    }
  }

  return null;
}

/**
 * Match extracted itemNo / barcode / free OCR tokens against active session items,
 * honoring prefixes (e.g. EV), suffixes (e.g. -BALK), spaced tokens, and strict OCR confusion checks.
 */
export function matchSessionItemByCandidates(
  candidates: string[],
  sessionItems: SheetsAuditItem[],
  codeContext?: CodeMatchContext | CodeIntelligenceProfile
): { item: SheetsAuditItem | null; confidence: ParsedCartonLabel['matchConfidence']; matchedCandidate: string | null } {
  const validCandidates = candidates
    .map((c) => normalizeDigits(c).trim())
    .filter((c) => c.length >= 2 && !IGNORED_CODE_WORDS.has(c.toUpperCase()));

  if (validCandidates.length === 0 || sessionItems.length === 0) {
    return { item: null, confidence: 'none', matchedCandidate: null };
  }

  const safeModel = (it: SheetsAuditItem) => normalizeDigits(it?.model || '').trim();

  // Extract affix lists from optional CodeIntelligenceProfile or plain strings
  const rawPrefixes = Array.isArray(codeContext?.prefixes)
    ? codeContext!.prefixes.map((p: any) => (typeof p === 'string' ? p : p?.token || '')).filter(Boolean)
    : [];
  const rawSuffixes = Array.isArray(codeContext?.suffixes)
    ? codeContext!.suffixes.map((s: any) => (typeof s === 'string' ? s : s?.token || '')).filter(Boolean)
    : [];

  // Tier 1: Exact case-insensitive string match (collapsing multi-spaces)
  for (const cand of validCandidates) {
    const candLow = cand.replace(/\s+/g, ' ').toLowerCase();
    const found = sessionItems.find((it) => safeModel(it).replace(/\s+/g, ' ').toLowerCase() === candLow);
    if (found) return { item: found, confidence: 'exact', matchedCandidate: found.model };
  }

  // Tier 2: Normalized punctuation/space-insensitive match ("EV 21345-02" <-> "EV21345-02")
  for (const cand of validCandidates) {
    const candNorm = normalizeModelCode(cand);
    if (candNorm.length < 3) continue;
    const found = sessionItems.find((it) => normalizeModelCode(safeModel(it)) === candNorm);
    if (found) return { item: found, confidence: 'normalized', matchedCandidate: found.model };
  }

  // Tier 3: Known Prefix / Suffix Aware Core Match
  // e.g. carton prints "21345-02" when sheet has "EV 21345-02" or "21345-02-BALK", OR vice versa.
  // Only accepts when core >= 4 chars, numeric dash variant matches if present, and match is unique!
  for (const cand of validCandidates) {
    const candCore = stripAffixesToCore(cand, rawPrefixes, rawSuffixes);
    if (candCore.length < 4) continue;
    const candTail = extractNumericTailSegment(cand);

    const coreMatches = sessionItems.filter((it) => {
      const mStr = safeModel(it);
      if (!mStr) return false;
      const mCore = stripAffixesToCore(mStr, rawPrefixes, rawSuffixes);
      if (mCore !== candCore) {
        // Also allow containment only if numeric/full model is enclosed with affixes (e.g. EV + 21345-02 + BALK)
        const candNorm = normalizeModelCode(cand);
        const mNorm = normalizeModelCode(mStr);
        if (mNorm.length < 5 || candNorm.length < 5) return false;
        if (!candNorm.includes(mNorm) && !mNorm.includes(candNorm)) return false;
      }
      const mTail = extractNumericTailSegment(mStr);
      if (candTail && mTail && candTail !== mTail) return false;
      return true;
    });

    if (coreMatches.length === 1) {
      return { item: coreMatches[0], confidence: 'affix', matchedCandidate: coreMatches[0].model };
    }
  }

  // Tier 4: Strict OCR lookalike tolerance (e.g. O<->0, I<->1, S<->5), preserving variant digits
  for (const cand of validCandidates) {
    const candNorm = normalizeModelCode(cand);
    if (candNorm.length < 5) continue;
    const candTail = extractNumericTailSegment(cand);

    const fuzzyHits = sessionItems.filter((it) => {
      const mStr = safeModel(it);
      const mNorm = normalizeModelCode(mStr);
      if (mNorm.length < 5) return false;
      const mTail = extractNumericTailSegment(mStr);
      if (candTail && mTail && candTail !== mTail) return false;
      return isLikelyOcrConfusion(candNorm, mNorm);
    });

    if (fuzzyHits.length === 1) {
      return { item: fuzzyHits[0], confidence: 'fuzzy', matchedCandidate: fuzzyHits[0].model };
    }
  }

  return { item: null, confidence: 'none', matchedCandidate: null };
}

/**
 * Full carton label parser combining `ITEM NO`, `CASE QTY`, barcode value, and sheet matching.
 */
export function parseCartonLabel(
  rawOcrText: string,
  sessionItems: SheetsAuditItem[],
  barcodeCandidate?: string | null,
  codeContext?: CodeMatchContext | CodeIntelligenceProfile
): ParsedCartonLabel {
  const cleanText = normalizeDigits(rawOcrText || '');
  const extractedItemNo = extractItemNoFromText(cleanText);
  const extractedCaseQty = extractCaseQtyFromText(cleanText);

  // Collect single tokens AND adjacent multi-token pairs like "EV 21345-02" or "21345-02 BALK"
  const tokenMatches = cleanText.match(/\b[A-Z0-9][A-Z0-9\-_/]{1,26}\b/gi) || [];
  const spacedCodeMatches =
    cleanText.match(/\b[A-Z]{1,6}\s+[0-9][A-Z0-9\-_/]{2,22}(?:[\s\-_/]+[A-Z]{2,8})?\b/gi) || [];

  const candidates: string[] = [];
  const pushUnique = (val?: string | null) => {
    const trimmed = (val || '').trim();
    if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
  };

  pushUnique(extractedItemNo);
  pushUnique(barcodeCandidate);
  for (const sc of spacedCodeMatches) pushUnique(sc);
  for (const tok of tokenMatches) pushUnique(tok);

  const matched = matchSessionItemByCandidates(candidates, sessionItems, codeContext);
  const finalItemNo = matched.matchedCandidate || extractedItemNo || barcodeCandidate || null;
  const isCompleteRead = Boolean(matched.item && extractedCaseQty !== null && extractedCaseQty > 0);

  return {
    itemNo: finalItemNo,
    caseQty: extractedCaseQty,
    matchedItem: matched.item,
    matchConfidence: matched.confidence,
    isCompleteRead,
    rawText: rawOcrText,
  };
}
