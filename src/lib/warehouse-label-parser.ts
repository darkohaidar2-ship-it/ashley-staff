import { SheetsAuditItem } from '@/app/api/warehouse/sheets-sync/route';

export interface ParsedCartonLabel {
  itemNo: string | null;
  caseQty: number | null;
  matchedItem: SheetsAuditItem | null;
  matchConfidence: 'exact' | 'normalized' | 'fuzzy' | 'none';
  isCompleteRead: boolean;
  rawText: string;
}

/**
 * Convert Eastern Arabic / Persian numerals to ASCII digits.
 */
export function normalizeDigits(input: string): string {
  const eastern = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const eIdx = eastern.indexOf(ch);
    if (eIdx !== -1) return String(eIdx);
    const pIdx = persian.indexOf(ch);
    if (pIdx !== -1) return String(pIdx);
    return ch;
  });
}

/**
 * Strip punctuation and spaces for resilient SKU/model matching.
 */
export function normalizeModelCode(code: string): string {
  return normalizeDigits(code)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Compute bounded Levenshtein distance for short OCR-fuzz tolerance (e.g. O vs 0, I vs 1).
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[b.length];
}

const IGNORED_CODE_WORDS = new Set([
  'ITEM', 'NO', 'NUMBER', 'CASE', 'QTY', 'QUANTITY', 'OTY', 'PCS', 'CTN', 'CARTON',
  'BOX', 'MODEL', 'SKU', 'PART', 'MADE', 'IN', 'CHINA', 'VIETNAM', 'MALAYSIA',
  'ASHLEY', 'FURNITURE', 'GROSS', 'NET', 'WEIGHT', 'CBM', 'COLOR', 'SIZE', 'PACK',
]);

/**
 * Extract `ITEM NO` (model/SKU) from warehouse carton label text.
 */
export function extractItemNoFromText(text: string): string | null {
  const clean = normalizeDigits(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Same-line match: ITEM NO: XXX / MODEL: XXX / SKU: XXX
  const sameLinePatterns = [
    /(?:item|1tem|iten|i\s*tem)\s*(?:no\.?|n[o0]|number|#|code)?\s*[:.\-=]?\s*([A-Z0-9][A-Z0-9\-/_]{1,24})/i,
    /(?:model|mod\.?|sku|art\.?\s*no|part\s*(?:no|#))\s*[:.\-=]?\s*([A-Z0-9][A-Z0-9\-/_]{1,24})/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Stacked format: line has only header "ITEM NO" and next line holds the model code
    if (
      /^(?:item|1tem|iten)\s*(?:no\.?|n[o0]|number|#)?\s*[:.\-=]?$/i.test(line) ||
      /^(?:model|sku)\s*(?:no\.?|#)?\s*[:.\-=]?$/i.test(line)
    ) {
      const nextLine = lines[i + 1] || '';
      if (nextLine && !/case|qty|q['’]?ty|pcs/i.test(nextLine)) {
        const nextToken = nextLine.match(/^([A-Z0-9][A-Z0-9\-/_]{1,24})/i);
        if (nextToken && !IGNORED_CODE_WORDS.has(nextToken[1].toUpperCase())) {
          return nextToken[1].toUpperCase();
        }
      }
    }

    for (const pat of sameLinePatterns) {
      const m = line.match(pat);
      if (m && m[1]) {
        const candidate = m[1].toUpperCase();
        if (!IGNORED_CODE_WORDS.has(candidate) && candidate.length >= 2) {
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

  // Fix common OCR digit slips inside standalone qty tokens (e.g. "Q"->"0", "O"->"0", "I"->"1")
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

  // Priority 1: Explicit "CASE QTY" / "CTN QTY" / "PACK QTY" (same line or line directly below)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const caseSameLine = line.match(
      /(?:case|c['’]?ase|ctn|carton|pack|pk|box|inner)\s*(?:q['’]?ty|0ty|oty|gty|quantity)\s*[:.\-=]?\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|units|ea|set))?\b/i
    );
    if (caseSameLine && caseSameLine[1]) {
      const parsed = parseNumericToken(caseSameLine[1]);
      if (parsed !== null) return parsed;
    }

    // Stacked format: "CASE QTY" on line i, digits on line i + 1
    if (/(?:case|ctn|carton|pack|box)\s*(?:q['’]?ty|0ty|oty|gty|quantity)\s*[:.\-=]?$/i.test(line)) {
      const nextLine = lines[i + 1] || '';
      const stackedMatch = nextLine.match(/^\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|units|ea))?\b/i);
      if (stackedMatch && stackedMatch[1]) {
        const parsed = parseNumericToken(stackedMatch[1]);
        if (parsed !== null) return parsed;
      }
    }
  }

  // Priority 2: Generic "QTY: N" or "N PCS" (ignoring weights/dimensions lines)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\b(?:gw|nw|weight|lbs|kg|cbm|mm|cm|inch|gross|net)\b/i.test(line)) continue;

    const qtyMatch = line.match(/(?:^|\s)(?:q['’]?ty|0ty|oty|quantity)\s*[:.\-=]?\s*([0-9OQIL]{1,5})(?:\s*(?:pcs|pc|ea))?\b/i);
    if (qtyMatch && qtyMatch[1]) {
      const parsed = parseNumericToken(qtyMatch[1]);
      if (parsed !== null) return parsed;
    }

    // Line directly below standalone "QTY"
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
 * Match extracted itemNo / barcode / free OCR tokens against active session items.
 */
export function matchSessionItemByCandidates(
  candidates: string[],
  sessionItems: SheetsAuditItem[]
): { item: SheetsAuditItem | null; confidence: ParsedCartonLabel['matchConfidence']; matchedCandidate: string | null } {
  const validCandidates = candidates
    .map((c) => c.trim())
    .filter((c) => c.length >= 2 && !IGNORED_CODE_WORDS.has(c.toUpperCase()));

  if (validCandidates.length === 0 || sessionItems.length === 0) {
    return { item: null, confidence: 'none', matchedCandidate: null };
  }

  // Tier 1: Exact case-insensitive string match
  for (const cand of validCandidates) {
    const candLow = cand.toLowerCase();
    const found = sessionItems.find((it) => it.model.trim().toLowerCase() === candLow);
    if (found) return { item: found, confidence: 'exact', matchedCandidate: found.model };
  }

  // Tier 2: Normalized match (ignoring hyphens/spaces/slashes)
  for (const cand of validCandidates) {
    const candNorm = normalizeModelCode(cand);
    if (candNorm.length < 3) continue;
    const found = sessionItems.find((it) => {
      const mNorm = normalizeModelCode(it.model);
      return mNorm === candNorm || (mNorm.length >= 4 && (candNorm.includes(mNorm) || mNorm.includes(candNorm)));
    });
    if (found) return { item: found, confidence: 'normalized', matchedCandidate: found.model };
  }

  // Tier 3: Fuzzy tolerance (1 char OCR slip on models >= 5 chars)
  for (const cand of validCandidates) {
    const candNorm = normalizeModelCode(cand);
    if (candNorm.length < 5) continue;
    let bestItem: SheetsAuditItem | null = null;
    let bestDist = 2;
    for (const it of sessionItems) {
      const mNorm = normalizeModelCode(it.model);
      if (mNorm.length < 5) continue;
      const dist = editDistance(candNorm, mNorm);
      if (dist <= 1 && dist < bestDist) {
        bestDist = dist;
        bestItem = it;
      }
    }
    if (bestItem) return { item: bestItem, confidence: 'fuzzy', matchedCandidate: bestItem.model };
  }

  return { item: null, confidence: 'none', matchedCandidate: null };
}

/**
 * Full carton label parser combining `ITEM NO`, `CASE QTY`, barcode value, and sheet matching.
 */
export function parseCartonLabel(
  rawOcrText: string,
  sessionItems: SheetsAuditItem[],
  barcodeCandidate?: string | null
): ParsedCartonLabel {
  const cleanText = normalizeDigits(rawOcrText || '');
  const extractedItemNo = extractItemNoFromText(cleanText);
  const extractedCaseQty = extractCaseQtyFromText(cleanText);

  // Collect all plausible model tokens from OCR text as fallback candidates
  const tokenMatches = cleanText.match(/\b[A-Z0-9][A-Z0-9\-_/]{2,22}\b/gi) || [];
  const candidates: string[] = [];
  if (extractedItemNo) candidates.push(extractedItemNo);
  if (barcodeCandidate) candidates.push(barcodeCandidate);
  for (const tok of tokenMatches) {
    if (!candidates.includes(tok)) candidates.push(tok);
  }

  const matched = matchSessionItemByCandidates(candidates, sessionItems);
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
