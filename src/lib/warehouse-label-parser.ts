import { SheetsAuditItem } from '@/app/api/warehouse/sheets-sync/route';
import { CodeIntelligenceProfile, normalizeDigitsUniversal } from '@/lib/warehouse-code-intelligence';

export interface ParsedCartonLabel {
  itemNo: string | null;
  caseQty: number | null;
  cartonNumber: number | null;
  totalCartons: number | null;
  description: string | null;
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
  'ITEM', 'NO', 'NUMBER', 'CASE', 'QTY', 'QNTY', 'QUANTITY', 'OTY', 'PCS', 'PC', 'SET', 'SETS',
  'CTN', 'CARTON', 'BOX', 'MODEL', 'SKU', 'PART', 'MADE', 'IN', 'CHINA', 'VIETNAM', 'MALAYSIA',
  'INDONESIA', 'TURKEY', 'INDIA', 'ASHLEY', 'FURNITURE', 'ELEVARRE', 'GROSS', 'NET', 'WEIGHT',
  'CBM', 'COLOR', 'SIZE', 'PACK', 'PO', 'LOT', 'OF', 'DESC', 'DESCRIPTION', 'MASTER', 'INNER',
  'DIMENSIONS', 'DIMENSION', 'CUBE', 'COUNTRY', 'ORIGIN',
]);

function cleanCapturedCodeCandidate(raw: string): string {
  // Trim trailing label headers if OCR fused two columns onto one line
  const cut = raw
    .replace(/\s+(?:CASE|CTN|QTY|Q['’]?TY|QNTY|PCS|PC|SET|SETS|QUANTITY|DESC|DESCRIPTION|MASTER|INNER|DIMENSIONS|MADE|ORIGIN)\b.*$/i, '')
    .replace(/[:;,.\s]+$/, '')
    .trim();
  return cut.toUpperCase();
}

/**
 * Extract `ITEM NO` (model/SKU) from warehouse carton label text.
 * Supports `ITEM NO.: EV21068-02`, `ITEM NO. : EV21165-03`, `ITEM NO: EV 51422-02`,
 * and stacked lines (`ITEM NO\nEV 21345-02`).
 */
export function extractItemNoFromText(text: string): string | null {
  const clean = normalizeDigits(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Supports optional short prefix + space + main code + optional suffix word
  // e.g. "EV21068-02", "EV 51422-02", "EV 21345-02-BALK", "23575-02", "51402-01"
  const codeCapture =
    '((?:[A-Z]{1,6}\\s+)?[A-Z0-9][A-Z0-9\\-/_]{1,26}(?:\\s+[A-Z]{2,8})?)';

  const sameLinePatterns = [
    new RegExp(
      `(?:item|1tem|iten|i\\s*tem)\\s*(?:no\\.?|n[o0]|number|#|code)?\\s*[:.;\\-=\\s]*${codeCapture}`,
      'i'
    ),
    new RegExp(
      `(?:model|mod\\.?|sku|art\\.?\\s*no|part\\s*(?:no|#))\\s*[:.;\\-=\\s]*${codeCapture}`,
      'i'
    ),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stacked format: line has only header "ITEM NO" and next line holds the model code
    if (
      /^(?:item|1tem|iten)\s*(?:no\.?|n[o0]|number|#)?\s*[:.;\-=]*$/i.test(line) ||
      /^(?:model|sku|part\s*(?:no|#))\s*(?:no\.?|#)?\s*[:.;\-=]*$/i.test(line)
    ) {
      const nextLine = lines[i + 1] || '';
      if (nextLine && !/^(?:case|qty|q['’]?ty|qnty|quantity|pcs|desc|description|master)\b/i.test(nextLine)) {
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
 * Extract `DESCRIPTION:` / `DESC:` item name from warehouse carton labels.
 */
export function extractDescriptionFromText(text: string): string | null {
  const clean = normalizeDigits(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isStopLine = (line: string) =>
    /^(?:master|case|c['’]?ase|ctn|qty|q['’]?ty|qnty|quantity|inner|dimensions?|made\s+in|country\s+of|p\.?\s*o\.?|carton|cube|item\s*no)\b/i.test(
      line
    );

  const trimTrailingMeta = (val: string) =>
    val
      .replace(/\s+(?:MASTER|CASE\s*QTY|QUANTITY|INNER\s*Q(?:NT)?Y|DIMENSIONS?|MADE\s+IN)\b.*$/i, '')
      .replace(/^[:.;\-=\s]+|[:;\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /(?:description|descripton|desc\.?|item\s*name|product)\s*[:.;\-=\s]+(.*)$/i
    );
    if (!match) continue;

    let desc = trimTrailingMeta(match[1] || '');

    // Stacked format: `DESCRIPTION:` followed by next line
    if (!desc && lines[i + 1] && !isStopLine(lines[i + 1])) {
      desc = trimTrailingMeta(lines[i + 1]);
      if (desc && lines[i + 2] && !isStopLine(lines[i + 2]) && lines[i + 2].length <= 36) {
        desc = trimTrailingMeta(`${desc} ${lines[i + 2]}`);
      }
    } else if (desc && lines[i + 1] && !isStopLine(lines[i + 1]) && lines[i + 1].length <= 28) {
      // Single wrapped continuation word like `... LARGE COCKTAIL\nTABLE`
      desc = trimTrailingMeta(`${desc} ${lines[i + 1]}`);
    }

    if (desc.length >= 2) {
      return desc;
    }
  }

  return null;
}

/**
 * Extract carton sequence (e.g. `CARTON NO.: 175 OF 250`, `Carton Number: 16 OF 100`, `CARTON NO. 52 OF 200`).
 */
export function extractCartonProgressFromText(text: string): {
  cartonNumber: number | null;
  totalCartons: number | null;
} {
  const clean = normalizeDigits(text);
  const m = clean.match(
    /(?:carton|ctn)\s*(?:no\.?|number|#)?\s*[:.;\-=\s]*([0-9]{1,5})\s*(?:of|\/)\s*([0-9]{1,5})/i
  );
  if (m && m[1] && m[2]) {
    const cur = parseInt(m[1], 10);
    const tot = parseInt(m[2], 10);
    if (Number.isFinite(cur) && Number.isFinite(tot) && cur >= 1 && tot >= 1) {
      return { cartonNumber: cur, totalCartons: tot };
    }
  }
  return { cartonNumber: null, totalCartons: null };
}

/**
 * Extract Master/Case Unit Quantity (`MASTER QUANTITY`, `MASTER QTY`, `CASE QTY`, `Case Quantity`, `1 SET`, `2 PCS`)
 * while strictly ignoring `INNER QNTY` / `INNER QTY`, weights, dimensions, and `CARTON NO: X OF Y`.
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

  const UNIT_SUFFIX = '(?:pcs?|sets?|units?|ea|ctn|box)?\\.?';
  const NUM_CAPTURE = `([0-9OQIL]{1,4})(?!\\.[0-9])\\s*${UNIT_SUFFIX}(?=$|[\\s.,;/|)])`;
  const BAD_QTY_LINE =
    /\b(?:gw|nw|weight|lbs|kg|cbm|cu\.?\s*ft|cube|mm|cm|inch|dimensions?|gross|net|carton\s*no|p\.?\s*o\.?|of)\b/i;

  const stripInnerSection = (lineStr: string) =>
    lineStr.replace(/\b(?:inner|inr)\s*(?:q['’]?ty\.?|qnty\.?|qty|quantity|set|sets|pc|pcs)?\b.*$/i, '').trim();

  // Priority 0: Explicit MASTER QTY / MASTER QUANTITY or stacked `MASTER` + `QUANTITY: N`
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const sanitizedLine = stripInnerSection(rawLine);

    const masterSameLine = sanitizedLine.match(
      new RegExp(
        `\\bmaster\\s*(?:carton|ctn|case|pack)?\\s*(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\\s*[:.;\\-=\\s]*${NUM_CAPTURE}`,
        'i'
      )
    );
    if (masterSameLine && masterSameLine[1]) {
      const parsed = parseNumericToken(masterSameLine[1]);
      if (parsed !== null) return parsed;
    }

    if (/^master(?:\s+(?:carton|ctn|pack|case))?\s*[:.;\-=]*$/i.test(rawLine)) {
      const nextLine = lines[i + 1] || '';
      const sanitizedNext = stripInnerSection(nextLine);
      if (sanitizedNext) {
        const nextQty = sanitizedNext.match(
          new RegExp(`^(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)?\\s*[:.;\\-=\\s]*${NUM_CAPTURE}`, 'i')
        );
        if (nextQty && nextQty[1]) {
          const parsed = parseNumericToken(nextQty[1]);
          if (parsed !== null) return parsed;
        }
        if (/^(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\s*[:.;\-=]*$/i.test(sanitizedNext)) {
          const thirdLine = lines[i + 2] || '';
          const sanitizedThird = stripInnerSection(thirdLine);
          const thirdMatch = sanitizedThird.match(new RegExp(`^\\s*${NUM_CAPTURE}`, 'i'));
          if (thirdMatch && thirdMatch[1]) {
            const parsed = parseNumericToken(thirdMatch[1]);
            if (parsed !== null) return parsed;
          }
        }
      }
    }
  }

  // Priority 1: Explicit "CASE QTY" / "CASEQTY" / "Case Quantity" / "CTN QTY" (never INNER)
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const sanitizedLine = stripInnerSection(rawLine);

    const caseSameLine = sanitizedLine.match(
      new RegExp(
        `(?:case|c['’]?ase|ctn|carton|pack|pk|box)\\s*(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\\s*[:.;\\-=\\s]*${NUM_CAPTURE}`,
        'i'
      )
    );
    if (caseSameLine && caseSameLine[1]) {
      const parsed = parseNumericToken(caseSameLine[1]);
      if (parsed !== null) return parsed;
    }

    if (
      /(?:case|c['’]?ase|ctn|carton|pack|pk|box)\s*(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\s*[:.;\-=]*$/i.test(
        sanitizedLine
      )
    ) {
      const nextLine = lines[i + 1] || '';
      const sanitizedNext = stripInnerSection(nextLine);
      if (sanitizedNext && !/\bof\b/i.test(sanitizedNext)) {
        const stackedMatch = sanitizedNext.match(new RegExp(`^\\s*${NUM_CAPTURE}`, 'i'));
        if (stackedMatch && stackedMatch[1]) {
          const parsed = parseNumericToken(stackedMatch[1]);
          if (parsed !== null) return parsed;
        }
      }
    }
  }

  // Priority 2: Generic "QTY: N" or "QUANTITY: N" (strictly excluding weights, dimensions, carton X of Y)
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const sanitizedLine = stripInnerSection(rawLine);
    if (BAD_QTY_LINE.test(sanitizedLine)) continue;

    const qtyMatch = sanitizedLine.match(
      new RegExp(`(?:^|\\s)(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\\s*[:.;\\-=\\s]*${NUM_CAPTURE}`, 'i')
    );
    if (qtyMatch && qtyMatch[1]) {
      const parsed = parseNumericToken(qtyMatch[1]);
      if (parsed !== null) return parsed;
    }

    if (/^(?:q['’]?ty\\.?|qnty\\.?|0ty\\.?|oty\\.?|gty\\.?|quantity)\s*[:.;\-=]*$/i.test(sanitizedLine)) {
      const nextLine = lines[i + 1] || '';
      const sanitizedNext = stripInnerSection(nextLine);
      if (sanitizedNext && !BAD_QTY_LINE.test(sanitizedNext)) {
        const stackedMatch = sanitizedNext.match(new RegExp(`^\\s*${NUM_CAPTURE}`, 'i'));
        if (stackedMatch && stackedMatch[1]) {
          const parsed = parseNumericToken(stackedMatch[1]);
          if (parsed !== null) return parsed;
        }
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
  let extractedCaseQty = extractCaseQtyFromText(cleanText);
  const extractedDescription = extractDescriptionFromText(cleanText);
  const { cartonNumber, totalCartons } = extractCartonProgressFromText(cleanText);

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
  const finalDescription = matched.item?.name || extractedDescription || null;

  // Resilient fallback: If carton quantity wasn't stamped or legible, use manifest pcsPerCarton
  if (extractedCaseQty === null && matched.item?.pcsPerCarton && matched.item.pcsPerCarton > 0) {
    extractedCaseQty = matched.item.pcsPerCarton;
  }

  const isCompleteRead = Boolean(matched.item && extractedCaseQty !== null && extractedCaseQty > 0);

  return {
    itemNo: finalItemNo,
    caseQty: extractedCaseQty,
    cartonNumber,
    totalCartons,
    description: finalDescription,
    matchedItem: matched.item,
    matchConfidence: matched.confidence,
    isCompleteRead,
    rawText: rawOcrText,
  };
}
