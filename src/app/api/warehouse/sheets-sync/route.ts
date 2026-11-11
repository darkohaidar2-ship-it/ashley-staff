import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import * as XLSX from 'xlsx';
import {
  analyzeWarehouseCodes,
  CodeIntelligenceProfile,
  normalizeDigitsUniversal,
} from '@/lib/warehouse-code-intelligence';

export const dynamic = 'force-dynamic';

const SESSIONS_STORE_ID = 'ashley_sheets_audit_sessions';
const DELETED_IDS_STORE_ID = 'ashley_sheets_deleted_ids';
const RESET_EPOCH_STORE_ID = 'ashley_sheets_reset_epoch';

export interface SheetsAuditItem {
  id: string;
  rowIndex: number;
  model: string;
  name: string;
  expectedQty: number; // total units / pieces
  checkedQty: number; // total checked units / pieces
  variance: number; // checkedQty - expectedQty
  condition: 'Packaged' | 'Wrapped' | 'Damaged' | 'Need Wrapped' | 'Normal';
  auditStatus: 'pending' | 'verified' | 'deficit' | 'excess' | 'damaged';
  rackLocation?: string;
  notes?: string;
  lastAuditedAt?: string;
  auditedBy?: string;
  rawColumns?: Record<string, any>;

  // 📦 Smart Container & Carton Unloading
  cartonCount?: number; // Total expected cartons (ژمارەی کارتۆن / پاکەت)
  pcsPerCarton?: number; // Pieces per carton (دانە لە هەر کارتۆنێکدا / CASE QTY)
  checkedCartons?: number; // Checked cartons so far (کارتۆنە داگیراوەکان)
  scannedCartonNumbers?: number[]; // Exact box numbers scanned so far
  scannedHistory?: Array<{ cartonNumber?: number; qty: number; scannedAt: string }>;
}

export interface SheetsAuditSession {
  id: string;
  title: string;
  mode: 'shipment_receiving' | 'inventory_stocktake';
  googleSheetUrl?: string;
  spreadsheetId?: string;
  webhookUrl?: string;
  sheetName?: string;
  packageId?: string;
  packageTitle?: string;
  tabIndex?: number;
  tabGid?: string;
  codeProfile?: CodeIntelligenceProfile;
  createdAt: string;
  updatedAt: string;
  auditedBy: string;
  totalItemsCount: number;
  totalExpectedUnits: number;
  totalAuditedUnits: number;
  totalCartonsCount?: number;
  totalAuditedCartons?: number;
  matchedCount: number;
  discrepantCount: number;
  damagedCount: number;
  status: 'active' | 'completed' | 'archived';
  items: SheetsAuditItem[];
}

export type GoogleSheetDeleteAction = 'none' | 'clear_audit_columns' | 'delete_tab';

/**
 * 🕒 Format ISO timestamp cleanly in Iraq/Kurdistan local time (Asia/Baghdad)
 */
function formatBaghdadTimestamp(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
}

/**
 * 🔍 Extracts Google Spreadsheet candidate export URLs from any Google Sheets link
 */
function extractSheetCandidates(url: string): {
  xlsxUrl: string | null;
  candidateCsvUrls: string[];
  spreadsheetId: string | null;
  gid: string;
  isAppsScriptUrl: boolean;
} {
  const cleanUrl = url.trim();
  const isAppsScriptUrl = /^https:\/\/script\.google(usercontent)?\.com\//.test(cleanUrl);

  if (isAppsScriptUrl) {
    return {
      xlsxUrl: null,
      candidateCsvUrls: [],
      spreadsheetId: null,
      gid: '0',
      isAppsScriptUrl: true,
    };
  }

  // 1. Published to Web links (/spreadsheets/d/e/2PACX-...)
  if (cleanUrl.includes('/spreadsheets/d/e/2PACX-') || cleanUrl.includes('/2PACX-')) {
    const pubMatch = cleanUrl.match(/(2PACX-[a-zA-Z0-9-_]+)/);
    const pubId = pubMatch ? pubMatch[1] : '';
    const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    let base = cleanUrl.split('?')[0].split('#')[0];
    if (base.endsWith('/pubhtml') || base.endsWith('/pub')) {
      base = base.replace(/\/pub(html)?$/, '/pub');
    }

    return {
      xlsxUrl: `${base}?output=xlsx`,
      candidateCsvUrls: [
        `${base}?output=csv${gid !== '0' ? `&gid=${gid}` : ''}`,
        `${base}?output=tsv${gid !== '0' ? `&gid=${gid}` : ''}`,
        `${base}?output=csv`,
      ],
      spreadsheetId: pubId || null,
      gid,
      isAppsScriptUrl: false,
    };
  }

  // 2. Direct CSV / TSV / Export links
  if (cleanUrl.includes('/pub?output=csv') || cleanUrl.includes('/export?format=csv') || cleanUrl.includes('/gviz/tq?tqx=out:csv')) {
    return { xlsxUrl: null, candidateCsvUrls: [cleanUrl], spreadsheetId: null, gid: '0', isAppsScriptUrl: false };
  }

  // 3. Standard Google Sheets ID (/spreadsheets/d/{ID} or /file/d/{ID} or ?id={ID})
  let spreadsheetId: string | null = null;
  const dMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  if (dMatch) spreadsheetId = dMatch[1];

  if (!spreadsheetId) {
    const fileMatch = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9-_]{15,})/);
    if (fileMatch) spreadsheetId = fileMatch[1];
  }

  if (!spreadsheetId) {
    const idParam = cleanUrl.match(/[?&]id=([a-zA-Z0-9-_]{15,})/);
    if (idParam) spreadsheetId = idParam[1];
  }

  const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  if (spreadsheetId) {
    return {
      // Full multi-tab workbook export! Returns ALL sheets/tabs in exact order
      xlsxUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
      candidateCsvUrls: [
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&gid=${gid}`,
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`,
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`,
      ],
      spreadsheetId,
      gid,
      isAppsScriptUrl: false,
    };
  }

  return { xlsxUrl: null, candidateCsvUrls: [cleanUrl], spreadsheetId: null, gid: '0', isAppsScriptUrl: false };
}

/**
 * 🧠 Intelligent Column Header Detection for Kurdish, English, and Arabic
 * Recognizes `ITEM NO` accurately as Model Code and `CASE QTY` as Pcs/Carton!
 */
function identifyColumns(headerRow: string[]) {
  const cols = {
    modelIdx: -1,
    nameIdx: -1,
    expectedQtyIdx: -1,
    checkedQtyIdx: -1,
    conditionIdx: -1,
    locationIdx: -1,
    notesIdx: -1,
    cartonCountIdx: -1,
    pcsPerCartonIdx: -1,
  };

  headerRow.forEach((h, idx) => {
    const text = normalizeDigitsUniversal(String(h || '')).trim().toLowerCase();
    if (!text) return;

    const isItemNoHeader =
      /\bitem\s*(?:no\.?|#|code|num|number|id)?\b/.test(text) && !text.includes('name') && !text.includes('desc');

    // Model / SKU / ITEM NO
    if (
      cols.modelIdx === -1 &&
      (isItemNoHeader ||
        text.includes('model') ||
        text.includes('sku') ||
        text.includes('code') ||
        text.includes('barcode') ||
        text.includes('part no') ||
        text.includes('part #') ||
        text.includes('مۆدێل') ||
        text.includes('کۆد') ||
        text.includes('کود') ||
        text.includes('رمز') ||
        text.includes('art'))
    ) {
      cols.modelIdx = idx;
      return;
    }

    // Name / Description (never hijack "ITEM NO" as name!)
    if (
      cols.nameIdx === -1 &&
      !isItemNoHeader &&
      (text.includes('name') ||
        text.includes('desc') ||
        text.includes('title') ||
        text.includes('product') ||
        (text.includes('item') && !text.includes('qty')) ||
        text.includes('ناو') ||
        text.includes('وەسف') ||
        text.includes('المادة') ||
        text.includes('کاڵا') ||
        text.includes('tanım'))
    ) {
      cols.nameIdx = idx;
    }

    // Pieces Per Carton / CASE QTY
    if (
      cols.pcsPerCartonIdx === -1 &&
      (text.includes('case qty') ||
        text.includes('case q\'ty') ||
        text.includes('ctn qty') ||
        text.includes('pack qty') ||
        text.includes('pcs/ctn') ||
        text.includes('qty/ctn') ||
        text.includes('pcs/box') ||
        text.includes('pcs/koli') ||
        text.includes('per carton') ||
        text.includes('per box') ||
        text.includes('دانە لە کارتۆن') ||
        text.includes('قطع بالكرتون'))
    ) {
      cols.pcsPerCartonIdx = idx;
      return;
    }

    // Carton Count / Boxes (ژمارەی کارتۆن)
    if (
      cols.cartonCountIdx === -1 &&
      (text.includes('carton') ||
        text.includes('ctn') ||
        text.includes('box') ||
        text.includes('boxes') ||
        text.includes('کارتۆن') ||
        text.includes('پاکەت') ||
        text.includes('صندوق') ||
        text.includes('طرد') ||
        text.includes('koli') ||
        text.includes('paket')) &&
      !text.includes('pcs') &&
      !text.includes('/') &&
      !text.includes('per') &&
      !text.includes('دۆخ') &&
      !text.includes('حالة') &&
      !text.includes('داگیراو')
    ) {
      cols.cartonCountIdx = idx;
    }

    // Checked / Actual Qty (avoid matching expected/case/carton headers)
    if (
      cols.checkedQtyIdx === -1 &&
      !text.includes('case') &&
      (text.includes('checked') ||
        text.includes('counted') ||
        text.includes('actual') ||
        text.includes('received') ||
        text.includes('چێک') ||
        text.includes('ژمێردراو') ||
        text.includes('داگیراو') ||
        text.includes('وەرگیراو'))
    ) {
      cols.checkedQtyIdx = idx;
    }

    // Expected / Book Qty (Total pieces)
    if (
      cols.expectedQtyIdx === -1 &&
      idx !== cols.pcsPerCartonIdx &&
      idx !== cols.checkedQtyIdx &&
      (text.includes('expected') ||
        text.includes('book') ||
        text.includes('system') ||
        text.includes('shipment') ||
        text.includes('بارکراو') ||
        text.includes('چاوەڕوان') ||
        text.includes('تۆمارکراو') ||
        text.includes('کۆگا') ||
        text.includes('total qty') ||
        text.includes('total pcs') ||
        text.includes('کۆی گشتی') ||
        text.includes('مجموع') ||
        text === 'qty' ||
        text === 'quantity' ||
        text === 'بڕ' ||
        text === 'عدد' ||
        text === 'ژمارە' ||
        text === 'adet')
    ) {
      cols.expectedQtyIdx = idx;
    }

    // Condition
    if (
      cols.conditionIdx === -1 &&
      (text.includes('condition') || text.includes('status') || text.includes('state') || text.includes('دۆخ') || text.includes('حالة'))
    ) {
      cols.conditionIdx = idx;
    }

    // Rack / Location
    if (
      cols.locationIdx === -1 &&
      (text.includes('rack') ||
        text.includes('location') ||
        text.includes('shelf') ||
        text.includes('zone') ||
        text.includes('شوێن') ||
        text.includes('ڕەفە') ||
        text.includes('الموقع') ||
        text.includes('مەغزەن'))
    ) {
      cols.locationIdx = idx;
    }

    // Notes
    if (
      cols.notesIdx === -1 &&
      (text.includes('note') ||
        text.includes('comment') ||
        text.includes('remark') ||
        text.includes('تێبینی') ||
        text.includes('ملاحظ') ||
        text.includes('سەرنج'))
    ) {
      cols.notesIdx = idx;
    }
  });

  // Fallbacks if not detected by keywords
  if (cols.modelIdx === -1 && headerRow.length > 0) cols.modelIdx = 0;
  if (cols.nameIdx === -1 && headerRow.length > 1) {
    cols.nameIdx = cols.modelIdx === 1 ? 0 : 1;
  }
  if (cols.expectedQtyIdx === -1 && headerRow.length > 2) {
    const qtyCandidate = headerRow.findIndex((_, i) => i !== cols.modelIdx && i !== cols.nameIdx && i !== cols.pcsPerCartonIdx);
    if (qtyCandidate !== -1) cols.expectedQtyIdx = qtyCandidate;
  }

  return cols;
}

/**
 * 📦 Converts parsed matrix rows into structured audit items with Carton Intelligence
 */
function convertRowsToAuditItems(rawData: any[][], tabSalt = '0'): {
  items: SheetsAuditItem[];
  totalExpected: number;
  totalAudited: number;
  totalCartons: number;
  totalAuditedCartons: number;
  headerRow: string[];
} {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(8, rawData.length); i++) {
    const nonEmp = (rawData[i] || []).filter((v: any) => String(v).trim().length > 0).length;
    if (nonEmp >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = (rawData[headerRowIndex] || []).map((v: any) => String(v || '').trim());
  const colMap = identifyColumns(headerRow);

  const items: SheetsAuditItem[] = [];
  let totalExpected = 0;
  let totalAudited = 0;
  let totalCartons = 0;
  let totalAuditedCartons = 0;

  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length === 0) continue;

    // Preserve exact model string (e.g. "EV 21345-02-BALK") with digits normalized
    const modelRaw = normalizeDigitsUniversal(String(row[colMap.modelIdx] || '').replace(/\s+/g, ' ').trim());
    const nameRaw = colMap.nameIdx !== -1 ? normalizeDigitsUniversal(String(row[colMap.nameIdx] || '').trim()) : '';

    // Skip empty or total/summary footer rows
    if (!modelRaw && !nameRaw) continue;
    const lowModel = modelRaw.toLowerCase();
    if (lowModel === 'total' || lowModel === 'sum' || lowModel === 'کۆی گشتی') continue;

    // Parse cartons & pieces per carton
    let cartonCount = 0;
    if (colMap.cartonCountIdx !== -1) {
      const rawCtn = normalizeDigitsUniversal(String(row[colMap.cartonCountIdx] || '')).replace(/[^\d.-]/g, '');
      cartonCount = parseFloat(rawCtn) || 0;
    }

    let pcsPerCarton = 1;
    if (colMap.pcsPerCartonIdx !== -1) {
      const rawPcs = normalizeDigitsUniversal(String(row[colMap.pcsPerCartonIdx] || '')).replace(/[^\d.-]/g, '');
      pcsPerCarton = Math.max(1, parseFloat(rawPcs) || 1);
    }

    // Parse expected total qty
    let expectedQty = 0;
    if (colMap.expectedQtyIdx !== -1) {
      const rawExp = normalizeDigitsUniversal(String(row[colMap.expectedQtyIdx] || '')).replace(/[^\d.-]/g, '');
      expectedQty = parseFloat(rawExp) || 0;
    }

    // Cross-compute cartons and quantities intelligently
    if (expectedQty === 0 && cartonCount > 0) {
      expectedQty = cartonCount * (pcsPerCarton || 1);
    } else if (expectedQty > 0 && cartonCount === 0) {
      cartonCount = pcsPerCarton > 1 ? Math.ceil(expectedQty / pcsPerCarton) : expectedQty;
    } else if (cartonCount > 0 && expectedQty > 0 && colMap.pcsPerCartonIdx === -1) {
      pcsPerCarton = Math.max(1, Math.round(expectedQty / cartonCount));
    }

    if (cartonCount === 0 && expectedQty === 0) {
      expectedQty = 1;
      cartonCount = 1;
      pcsPerCarton = 1;
    }

    // Parse checked qty
    let checkedQty = 0;
    if (colMap.checkedQtyIdx !== -1 && colMap.checkedQtyIdx !== colMap.expectedQtyIdx) {
      const rawChk = normalizeDigitsUniversal(String(row[colMap.checkedQtyIdx] || '')).replace(/[^\d.-]/g, '');
      checkedQty = parseFloat(rawChk) || 0;
    }

    const checkedCartons = Math.floor(checkedQty / (pcsPerCarton || 1));

    const conditionRaw = colMap.conditionIdx !== -1 ? String(row[colMap.conditionIdx] || '').trim() : '';
    let condition: SheetsAuditItem['condition'] = 'Packaged';
    if (conditionRaw.includes('تێکچوو') || conditionRaw.includes('شکاو') || conditionRaw.toLowerCase().includes('damage')) {
      condition = 'Damaged';
    } else if (conditionRaw.includes('لەف') || conditionRaw.toLowerCase().includes('wrap')) {
      condition = 'Wrapped';
    }

    const rackLocation = colMap.locationIdx !== -1 ? String(row[colMap.locationIdx] || '').trim() : '';
    const notes = colMap.notesIdx !== -1 ? String(row[colMap.notesIdx] || '').trim() : '';

    const variance = checkedQty - expectedQty;
    let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
    if (checkedQty > 0) {
      if (variance === 0) auditStatus = 'verified';
      else if (variance < 0) auditStatus = 'deficit';
      else if (variance > 0) auditStatus = 'excess';
    }
    if (condition === 'Damaged') auditStatus = 'damaged';

    totalExpected += expectedQty;
    totalAudited += checkedQty;
    totalCartons += cartonCount;
    totalAuditedCartons += checkedCartons;

    const model = modelRaw || `ROW-${r}`;
    const name = nameRaw || model;

    items.push({
      id: `item_${tabSalt}_${r}_${model.replace(/\s+/g, '_') || Math.random().toString(36).slice(2, 7)}`,
      rowIndex: r,
      model,
      name,
      expectedQty,
      checkedQty,
      cartonCount,
      pcsPerCarton,
      checkedCartons,
      scannedCartonNumbers: [],
      variance,
      condition,
      auditStatus,
      rackLocation,
      notes,
      lastAuditedAt: checkedQty > 0 ? new Date().toISOString() : undefined,
    });
  }

  return { items, totalExpected, totalAudited, totalCartons, totalAuditedCartons, headerRow };
}

/**
 * Helper to create Package of Sessions from multiple parsed tabs & attach Smart Code Intelligence
 */
function buildSessionsPackage(params: {
  tabs: Array<{ sheetName: string; tabGid?: string; rawData: any[][] }>;
  mode: 'shipment_receiving' | 'inventory_stocktake';
  packageTitle?: string;
  googleSheetUrl?: string;
  spreadsheetId?: string | null;
  webhookUrl?: string;
}): {
  sessions: SheetsAuditSession[];
  packageId: string;
  packageTitle: string;
  packageCodeProfile: CodeIntelligenceProfile;
} {
  const { tabs, mode, googleSheetUrl, spreadsheetId, webhookUrl } = params;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const packageId = `pkg_${spreadsheetId || nowMs}_${nowMs.toString(36)}`;
  const validWebhook =
    webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(webhookUrl.trim())
      ? webhookUrl.trim()
      : undefined;

  const parsedTabs: Array<{
    sheetName: string;
    tabGid?: string;
    tabIndex: number;
    parsed: ReturnType<typeof convertRowsToAuditItems>;
  }> = [];

  tabs.forEach((t, idx) => {
    const parsed = convertRowsToAuditItems(t.rawData, String(idx));
    if (parsed.items.length > 0) {
      parsedTabs.push({
        sheetName: t.sheetName || `Sheet${idx + 1}`,
        tabGid: t.tabGid,
        tabIndex: idx,
        parsed,
      });
    }
  });

  const allPackageItems = parsedTabs.flatMap((t) => t.parsed.items);
  const packageCodeProfile = analyzeWarehouseCodes(allPackageItems);
  const resolvedPkgTitle =
    (params.packageTitle || '').trim() ||
    (parsedTabs.length > 1
      ? mode === 'shipment_receiving'
        ? `پاکێجی باری نوێ (${parsedTabs.length} بەش)`
        : `پاکێجی جەردی کۆگا (${parsedTabs.length} بەش)`
      : parsedTabs[0]?.sheetName && parsedTabs[0].sheetName !== 'Sheet1'
      ? parsedTabs[0].sheetName
      : mode === 'shipment_receiving'
      ? `پشکنینی باری نوێ (${allPackageItems.length} کاڵا)`
      : `جەردی کۆگا (${allPackageItems.length} کاڵا)`);

  const sessions: SheetsAuditSession[] = parsedTabs.map((pt, i) => {
    const { items, totalExpected, totalAudited, totalCartons, totalAuditedCartons } = pt.parsed;
    const tabCodeProfile = analyzeWarehouseCodes(items, allPackageItems);
    const sessionTitle =
      parsedTabs.length > 1
        ? pt.sheetName
        : (params.packageTitle || '').trim() || pt.sheetName || resolvedPkgTitle;

    return {
      id: `audit_${nowMs}_${i}`,
      title: sessionTitle,
      mode,
      googleSheetUrl: googleSheetUrl || undefined,
      spreadsheetId: spreadsheetId || undefined,
      webhookUrl: validWebhook,
      sheetName: pt.sheetName,
      packageId,
      packageTitle: resolvedPkgTitle,
      tabIndex: i,
      tabGid: pt.tabGid,
      codeProfile: tabCodeProfile,
      createdAt: nowIso,
      updatedAt: nowIso,
      auditedBy: 'Admin',
      totalItemsCount: items.length,
      totalExpectedUnits: totalExpected,
      totalAuditedUnits: totalAudited,
      totalCartonsCount: totalCartons,
      totalAuditedCartons,
      matchedCount: items.filter((it) => it.auditStatus === 'verified').length,
      discrepantCount: items.filter((it) => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
      damagedCount: items.filter((it) => it.auditStatus === 'damaged').length,
      status: 'active',
      items,
    };
  });

  return {
    sessions,
    packageId,
    packageTitle: resolvedPkgTitle,
    packageCodeProfile,
  };
}

/**
 * 📥 Fetch All Sessions from Supabase
 */
async function getStoredSessions(): Promise<Record<string, SheetsAuditSession>> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', SESSIONS_STORE_ID)
      .maybeSingle();

    if (error || !data?.qr_code) return {};
    return typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
  } catch (err) {
    logger.error('[SheetsSync API] Error loading sessions:', err);
    return {};
  }
}

/**
 * 💾 Save All Sessions to Supabase
 */
async function saveStoredSessions(sessions: Record<string, SheetsAuditSession>): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(sessions);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: SESSIONS_STORE_ID,
        name: 'Ashley Google Sheets Warehouse Sessions',
        qr_code: jsonStr,
      });

    if (error) {
      logger.error('[SheetsSync API] Error saving sessions:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[SheetsSync API] Exception saving sessions:', err);
    return false;
  }
}

/**
 * 🗑️ Fetch Deleted Session IDs from Supabase
 */
async function getDeletedSessionIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', DELETED_IDS_STORE_ID)
      .maybeSingle();

    if (error || !data?.qr_code) return [];
    const parsed = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function markSessionsDeleted(sessionIds: string[]): Promise<string[]> {
  const existing = await getDeletedSessionIds();
  const next = Array.from(new Set([...sessionIds, ...existing])).slice(0, 500);
  try {
    await supabase
      .from('warehouses')
      .upsert({
        id: DELETED_IDS_STORE_ID,
        name: 'Ashley Deleted Warehouse Sheet IDs',
        qr_code: JSON.stringify(next),
      });
  } catch (err) {
    logger.warn('[SheetsSync API] Failed storing deleted ids:', err);
  }
  return next;
}

/**
 * 🧹 Global reset timestamp
 */
async function getResetEpoch(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', RESET_EPOCH_STORE_ID)
      .maybeSingle();

    if (error || !data?.qr_code) return null;
    const raw = typeof data.qr_code === 'string' ? data.qr_code.trim() : String(data.qr_code);
    if (!raw || isNaN(Date.parse(raw))) return null;
    return raw;
  } catch {
    return null;
  }
}

async function setResetEpoch(isoTimestamp: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: RESET_EPOCH_STORE_ID,
        name: 'Ashley Sheets Global Reset Timestamp',
        qr_code: isoTimestamp,
      });
    return !error;
  } catch {
    return false;
  }
}

/**
 * 📊 Build Tab-Isolated Google Sheet Write-Back Payload (Includes Dedicated Baghdad Scanned At Column)
 */
function buildAuditSheetPayload(session: SheetsAuditSession) {
  const items: SheetsAuditItem[] = session.items || [];
  const headers = [
    'کۆدی مۆدێل (Model)',
    'ناوی کاڵا (Item Description)',
    'بڕی بارکراو / خشتە (Expected Qty)',
    'بڕی ژمێردراو / داگیراو (Audited Qty)',
    'جیاوازی دانە (Qty Variance)',
    'کۆی کارتۆن (Total Cartons)',
    'کارتۆنی داگیراو (Checked Cartons)',
    'کارتۆنە لێدراوەکان (Scanned Box #)',
    'دانە لە کارتۆن (Pcs/Carton)',
    'دۆخی پشکنین (Audit Status)',
    'دۆخی فیزیکی (Condition)',
    'شوێن لە کۆگا (Rack/Location)',
    'پشکێنەر (Audited By)',
    'کاتی سکان / داخڵکردن (Scanned At)',
    'تێبینی (Audit Notes)',
  ];

  const auditColumnHeaders = [
    'بڕی ژمێردراو / داگیراو (Audited Qty)',
    'جیاوازی دانە (Qty Variance)',
    'کارتۆنی داگیراو (Checked Cartons)',
    'کارتۆنە لێدراوەکان (Scanned Box #)',
    'دۆخی پشکنین (Audit Status)',
    'دۆخی فیزیکی (Condition)',
    'شوێن لە کۆگا (Rack/Location)',
    'کاتی سکان / داخڵکردن (Scanned At)',
    'پشکێنەر (Audited By)',
    'تێبینی (Audit Notes)',
  ];

  const rows: any[][] = [];
  const itemRecords: Array<{ rowIndex: number; model: string; auditValues: Record<string, any> }> = [];

  items.forEach((i) => {
    const totalCtn = i.cartonCount || (i.pcsPerCarton && i.expectedQty ? Math.ceil(i.expectedQty / i.pcsPerCarton) : i.expectedQty) || 1;
    const checkedCtn = i.checkedCartons ?? (i.scannedCartonNumbers?.length ?? (i.pcsPerCarton ? Math.floor(i.checkedQty / i.pcsPerCarton) : i.checkedQty));
    const scannedBoxesStr =
      Array.isArray(i.scannedCartonNumbers) && i.scannedCartonNumbers.length > 0
        ? i.scannedCartonNumbers.join(', ')
        : checkedCtn > 0
        ? `1-${checkedCtn}`
        : '-';

    let statusKurdish = 'چاوەڕوان';
    if (i.auditStatus === 'verified') statusKurdish = '✅ هاوتا و تەواو';
    else if (i.auditStatus === 'deficit') statusKurdish = `⚠️ کەمی هەیە (${i.variance})`;
    else if (i.auditStatus === 'excess') statusKurdish = `➕ زیادەیە (+${i.variance})`;
    else if (i.auditStatus === 'damaged') statusKurdish = '❌ شکاو / زیانلێکەوتوو';

    let conditionKurdish = 'پاکەتکراو';
    if (i.condition === 'Wrapped') conditionKurdish = 'لەفکراو';
    else if (i.condition === 'Damaged') conditionKurdish = 'تێکچوو/شکاو';
    else if (i.condition === 'Need Wrapped') conditionKurdish = 'پێویستی بە لەفە';
    else if (i.condition === 'Normal') conditionKurdish = 'ئاسایی';

    const scannedAtStr = formatBaghdadTimestamp(i.lastAuditedAt);
    const auditorName = i.auditedBy || session.auditedBy || 'Admin';

    rows.push([
      i.model,
      i.name,
      i.expectedQty,
      i.checkedQty,
      i.variance,
      totalCtn,
      checkedCtn,
      scannedBoxesStr,
      i.pcsPerCarton || 1,
      statusKurdish,
      conditionKurdish,
      i.rackLocation || '',
      auditorName,
      scannedAtStr,
      i.notes || '',
    ]);

    itemRecords.push({
      rowIndex: i.rowIndex,
      model: i.model,
      auditValues: {
        'بڕی ژمێردراو / داگیراو (Audited Qty)': i.checkedQty,
        'جیاوازی دانە (Qty Variance)': i.variance,
        'کارتۆنی داگیراو (Checked Cartons)': `${checkedCtn} / ${totalCtn}`,
        'کارتۆنە لێدراوەکان (Scanned Box #)': scannedBoxesStr,
        'دۆخی پشکنین (Audit Status)': statusKurdish,
        'دۆخی فیزیکی (Condition)': conditionKurdish,
        'شوێن لە کۆگا (Rack/Location)': i.rackLocation || '',
        'کاتی سکان / داخڵکردن (Scanned At)': scannedAtStr,
        'پشکێنەر (Audited By)': auditorName,
        'تێبینی (Audit Notes)': i.notes || '',
      },
    });
  });

  return {
    action: 'sync_audit_columns',
    sessionId: session.id,
    packageId: session.packageId,
    targetSheetName: session.sheetName || undefined,
    targetSheetGid: session.tabGid || undefined,
    title: session.title,
    mode: session.mode,
    updatedAt: formatBaghdadTimestamp(new Date().toISOString()),
    headers,
    auditColumnHeaders,
    rows,
    itemRecords,
  };
}

/**
 * 🚀 Generic Google Apps Script Webhook caller (handles sync + tab-level clear/delete)
 */
async function callGoogleAppsScriptWebhook(
  webhookUrl: string,
  payload: Record<string, any>
): Promise<{
  ok: boolean;
  status?: number;
  updatedRows?: number;
  mode?: string;
  targetSheetName?: string;
  message?: string;
  error?: string;
}> {
  const cleanUrl = (webhookUrl || '').trim();
  if (!cleanUrl.startsWith('http')) {
    return { ok: false, error: 'لینکی Webhook دروست نییە.' };
  }
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    return {
      ok: false,
      error:
        'ئەم بەستەرە لینکی ئاسایی شیتەکەیە! بۆ نووسینی ڕاستەوخۆ، پێویستە لینکی Google Apps Script Web App دابنێیت کە بە https://script.google.com/macros/s/.../exec دەستپێدەکات.',
    };
  }

  try {
    const postRes = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      cache: 'no-store',
    });

    const responseText = await postRes.text();

    if (
      responseText.includes('accounts.google.com') ||
      responseText.includes('ServiceLogin') ||
      responseText.trim().startsWith('<!DOCTYPE') ||
      responseText.trim().startsWith('<html')
    ) {
      return {
        ok: false,
        status: postRes.status,
        error:
          'گۆگڵ داوای داخڵبوون (Sign in) دەکات و ڕێگەی بە Webhook نەدا! لە Google Apps Script بڕۆ Deploy > Manage deployments و بەشی "Who has access" بگۆڕە بۆ "Anyone".',
      };
    }

    if (!postRes.ok) {
      return { ok: false, status: postRes.status, error: `سێرڤەری گۆگڵ کۆدی هەڵەی ${postRes.status} گەڕاندەوە.` };
    }

    try {
      const parsed = JSON.parse(responseText);
      if (parsed && parsed.success === false) {
        return { ok: false, status: postRes.status, error: parsed.error || 'سکریپتی Google Sheet هەڵەیەکی گەڕاندەوە.' };
      }
      if (parsed && parsed.success === true) {
        return {
          ok: true,
          status: postRes.status,
          updatedRows: parsed.updatedRows ?? parsed.count,
          mode: parsed.mode,
          targetSheetName: parsed.sheetName || payload.targetSheetName,
          message: parsed.message,
        };
      }
    } catch {
      return {
        ok: false,
        status: postRes.status,
        error:
          'وەڵامی Google Apps Script فۆرماتی JSONی دروستی نەبوو. دڵنیابە کۆدە نوێیەکەی Apps Scriptت بە تەواوی کۆپی کردووە و وەشانی نوێت Deploy کردووە.',
      };
    }

    return { ok: true, status: postRes.status };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'نەتوانرا پەیوەندی بە Google Webhook بکرێت.' };
  }
}

async function pushSessionToAppsScript(webhookUrl: string, session: SheetsAuditSession) {
  const payload = buildAuditSheetPayload(session);
  return callGoogleAppsScriptWebhook(webhookUrl, payload);
}

/**
 * 📥 Fetch Multi-Tab Google Spreadsheet via Apps Script `doGet` OR `/export?format=xlsx` OR CSV fallback
 */
async function fetchSpreadsheetTabsFromGoogle(params: {
  sheetUrl: string;
  webhookUrl?: string;
}): Promise<{
  ok: boolean;
  tabs?: Array<{ sheetName: string; tabGid?: string; rawData: any[][] }>;
  spreadsheetTitle?: string;
  spreadsheetId?: string | null;
  error?: string;
}> {
  const { sheetUrl, webhookUrl } = params;
  const { xlsxUrl, candidateCsvUrls, spreadsheetId, gid, isAppsScriptUrl } = extractSheetCandidates(sheetUrl);

  const scriptEndpoint = isAppsScriptUrl
    ? sheetUrl.trim()
    : webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(webhookUrl.trim())
    ? webhookUrl.trim()
    : null;

  // Path 1: Apps Script doGet (reads ALL tabs cleanly, even on private Google Sheets!)
  if (scriptEndpoint) {
    try {
      const getRes = await fetch(scriptEndpoint, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
      });
      const text = await getRes.text();
      if (
        !text.includes('accounts.google.com') &&
        !text.trim().startsWith('<!DOCTYPE') &&
        !text.trim().startsWith('<html')
      ) {
        const parsed = JSON.parse(text);
        if (parsed && parsed.success && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          return {
            ok: true,
            tabs: parsed.sheets.map((s: any, idx: number) => ({
              sheetName: String(s.sheetName || `Sheet${idx + 1}`),
              tabGid: s.sheetId !== undefined ? String(s.sheetId) : undefined,
              rawData: Array.isArray(s.rows) ? s.rows : [],
            })),
            spreadsheetTitle: parsed.spreadsheetName || undefined,
            spreadsheetId: spreadsheetId || parsed.spreadsheetId || null,
          };
        }
      }
    } catch {
      // Fall through to public XLSX / CSV methods
    }

    if (isAppsScriptUrl) {
      return {
        ok: false,
        error:
          'نەتوانرا شیتەکان لە ڕێگەی ئەم Apps Script URL بخوێندرێنەوە.\nدڵنیابە کۆدی نوێی Apps Script (کە function doGet(e) تێدایە) پاشەکەوت کراوە و وەک New version بە Who has access = Anyone بڵاوکراوەتەوە.',
      };
    }
  }

  let fetchErrorDetails = '';
  let isHtmlLogin = false;

  // Path 2: Google Sheets Full Multi-Tab `.xlsx` Export (Retrieves ALL tabs at once!)
  if (xlsxUrl) {
    try {
      const xlsxRes = await fetch(xlsxUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
        redirect: 'follow',
      });

      if (xlsxRes.ok) {
        const buf = await xlsxRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const isZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK" header for real .xlsx
        if (isZip) {
          const wb = XLSX.read(bytes, { type: 'array' });
          const disp = xlsxRes.headers.get('content-disposition') || '';
          const fnameMatch = disp.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
          const decodedTitle = fnameMatch ? decodeURIComponent(fnameMatch[1].replace(/["']/g, '')).replace(/\.xlsx$/i, '') : undefined;

          const tabs = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
            return { sheetName: name, rawData };
          });

          return {
            ok: true,
            tabs,
            spreadsheetTitle: decodedTitle,
            spreadsheetId,
          };
        } else {
          const preview = new TextDecoder().decode(bytes.slice(0, 1500));
          if (preview.includes('accounts.google.com') || preview.includes('ServiceLogin')) {
            isHtmlLogin = true;
          }
        }
      } else {
        fetchErrorDetails = `XLSX Export HTTP ${xlsxRes.status}`;
      }
    } catch (e: any) {
      fetchErrorDetails = e?.message || '';
    }
  }

  // Path 3: Single-tab CSV / TSV fallback
  for (const targetUrl of candidateCsvUrls) {
    try {
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/csv,text/tab-separated-values,text/plain,*/*',
        },
        cache: 'no-store',
        redirect: 'follow',
      });

      if (!fetchRes.ok) {
        fetchErrorDetails = `Google Sheets returned HTTP ${fetchRes.status}`;
        continue;
      }

      const text = await fetchRes.text();
      if (
        text.includes('accounts.google.com') ||
        text.includes('Sign in - Google Accounts') ||
        (text.includes('<html') && (text.includes('password') || text.includes('ServiceLogin')))
      ) {
        isHtmlLogin = true;
        continue;
      }
      if (text.trim().startsWith('<!DOCTYPE html>') || (text.trim().startsWith('<html') && !text.includes(',') && !text.includes('\t'))) {
        continue;
      }

      if (text.trim().length > 0) {
        const wb = XLSX.read(text, { type: 'string' });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
        return {
          ok: true,
          tabs: [{ sheetName: firstSheet || 'Sheet1', tabGid: gid, rawData }],
          spreadsheetId,
        };
      }
    } catch (err: any) {
      fetchErrorDetails = err.message;
    }
  }

  if (isHtmlLogin) {
    return {
      ok: false,
      error:
        'ئەم شیتە تایبەتە و پێویستی بە داخڵبوونی ئەکاونتی گۆگڵ هەیە (Google Sign-in).\n\nچۆن چارەسەری دەکەیت:\n١. لە ناو Google Sheet کلیک لە Share بکە → General Access بکە بە "Anyone with the link" (بۆ خوێندنەوەی هەموو تەبەکان).\n٢. یان کۆدی نوێی Apps Script (کە doGet و doPost تێدایە) دابنێ و بەستەری Webhook لێرە بنووسە — ئەو کاتە بێ Share ـیش هەموو بەشەکان دەهێنێت!',
    };
  }

  return {
    ok: false,
    error: `نەتوانرا گۆگڵ شیتەکە بخوێندرێتەوە: ${fetchErrorDetails || 'تکایە دڵنیابە لە دروستی بەستەرەکە'}`,
  };
}

// =============================================================================
// GET HANDLER
// =============================================================================
export async function GET() {
  try {
    const [sessions, deletedIds, resetBefore] = await Promise.all([
      getStoredSessions(),
      getDeletedSessionIds(),
      getResetEpoch(),
    ]);
    const deletedSet = new Set(deletedIds);
    const resetMs = resetBefore ? Date.parse(resetBefore) : 0;
    const activeSessions = Object.values(sessions)
      .filter((s) => {
        if (!s || !s.id || deletedSet.has(s.id)) return false;
        if (resetMs > 0) {
          const ts = Date.parse(s.updatedAt || s.createdAt || '');
          if (!isNaN(ts) && ts <= resetMs) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({
      success: true,
      sessions: activeSessions,
      deletedIds,
      resetBefore,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}

// =============================================================================
// POST HANDLER
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // -------------------------------------------------------------------------
    // ACTION 1: FETCH & PARSE GOOGLE SHEET (FULL MULTI-TAB PACKAGE!)
    // -------------------------------------------------------------------------
    if (action === 'fetch_sheet') {
      const { sheetUrl, webhookUrl, mode = 'shipment_receiving', title } = body;
      const effectiveSheetUrl = typeof sheetUrl === 'string' && sheetUrl.trim() ? sheetUrl.trim() : typeof webhookUrl === 'string' ? webhookUrl.trim() : '';

      if (!effectiveSheetUrl) {
        return NextResponse.json({ success: false, error: 'تکایە لینکی Google Sheet یان Apps Script Webhook بنووسە' }, { status: 400 });
      }

      const fetched = await fetchSpreadsheetTabsFromGoogle({
        sheetUrl: effectiveSheetUrl,
        webhookUrl: typeof webhookUrl === 'string' ? webhookUrl : undefined,
      });

      if (!fetched.ok || !fetched.tabs || fetched.tabs.length === 0) {
        return NextResponse.json({ success: false, error: fetched.error || 'نەتوانرا خشتەکە بخوێندرێتەوە' }, { status: 400 });
      }

      const pkg = buildSessionsPackage({
        tabs: fetched.tabs,
        mode,
        packageTitle: (title || '').trim() || fetched.spreadsheetTitle,
        googleSheetUrl: /^https:\/\/docs\.google\.com\/spreadsheets/.test(effectiveSheetUrl) ? effectiveSheetUrl : undefined,
        spreadsheetId: fetched.spreadsheetId,
        webhookUrl: /^https:\/\/script\.google(usercontent)?\.com\//.test(effectiveSheetUrl)
          ? effectiveSheetUrl
          : typeof webhookUrl === 'string'
          ? webhookUrl
          : undefined,
      });

      if (pkg.sessions.length === 0) {
        return NextResponse.json(
          { success: false, error: 'هیچ کاڵایەک لە تەبەکانی ناو خشتەکەدا نەدۆزرایەوە. دڵنیابە ستوونی مۆدێل و بڕ لە خشتەکەدا هەیە.' },
          { status: 400 }
        );
      }

      const allSessions = await getStoredSessions();
      for (const s of pkg.sessions) {
        allSessions[s.id] = s;
      }
      const saved = await saveStoredSessions(allSessions);
      if (!saved) {
        return NextResponse.json({ success: false, error: 'شیتەکان خوێندرانەوە بەڵام خەزنکردنیان لە Supabase سەرکەوتوو نەبوو.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        session: pkg.sessions[0],
        sessions: pkg.sessions,
        packageId: pkg.packageId,
        packageTitle: pkg.packageTitle,
        packageCodeProfile: pkg.packageCodeProfile,
        tabsCount: pkg.sessions.length,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 1.25: PARSE MULTI-TAB EXCEL WORKBOOK AS ONE PACKAGE
    // -------------------------------------------------------------------------
    if (action === 'parse_workbook') {
      const { sheets, mode = 'shipment_receiving', title, webhookUrl } = body;
      if (!Array.isArray(sheets) || sheets.length === 0) {
        return NextResponse.json({ success: false, error: 'هیچ پەڕەیەک (Tab) لە فایلی ئێکسڵەکەدا نەبوو.' }, { status: 400 });
      }

      const tabs: Array<{ sheetName: string; rawData: any[][] }> = sheets.map((s: any, idx: number) => {
        if (Array.isArray(s.rawData)) {
          return { sheetName: String(s.sheetName || `Sheet${idx + 1}`), rawData: s.rawData };
        }
        const wb = XLSX.read(String(s.csvText || ''), { type: 'string' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = ws ? XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false }) : [];
        return { sheetName: String(s.sheetName || `Sheet${idx + 1}`), rawData };
      });

      const pkg = buildSessionsPackage({
        tabs,
        mode,
        packageTitle: title,
        webhookUrl,
      });

      if (pkg.sessions.length === 0) {
        return NextResponse.json({ success: false, error: 'هیچ کاڵایەک لە تەبەکانی ناو ئەم فایلەدا نەدۆزرایەوە.' }, { status: 400 });
      }

      const allSessions = await getStoredSessions();
      for (const s of pkg.sessions) {
        allSessions[s.id] = s;
      }
      const saved = await saveStoredSessions(allSessions);
      if (!saved) {
        return NextResponse.json({ success: false, error: 'خەزنکردنی باکێچەکە لە Supabase سەرکەوتوو نەبوو.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        session: pkg.sessions[0],
        sessions: pkg.sessions,
        packageId: pkg.packageId,
        packageTitle: pkg.packageTitle,
        packageCodeProfile: pkg.packageCodeProfile,
        tabsCount: pkg.sessions.length,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 1.5: PARSE RAW TEXT / TSV / CSV (DIRECT COPY-PASTE)
    // -------------------------------------------------------------------------
    if (action === 'parse_raw') {
      const { rawText, mode = 'shipment_receiving', title } = body;
      if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
        return NextResponse.json({ success: false, error: 'تکایە داتای خشتەکە پێست بکە' }, { status: 400 });
      }

      let rawData: any[][] = [];
      try {
        const wb = XLSX.read(rawText, { type: 'string' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
      } catch {
        return NextResponse.json({ success: false, error: 'هەڵە لە شرۆڤەکردنی داتای پێستکراو' }, { status: 400 });
      }

      if (!rawData || rawData.length === 0) {
        return NextResponse.json({ success: false, error: 'داتای پێستکراو بەتاڵە' }, { status: 400 });
      }

      const pkg = buildSessionsPackage({
        tabs: [{ sheetName: title || 'Sheet1', rawData }],
        mode,
        packageTitle: title,
      });

      if (pkg.sessions.length === 0) {
        return NextResponse.json(
          { success: false, error: 'هیچ کاڵایەک لە ناو خشتەکە نەدۆزرایەوە. دڵنیابە ستوونی مۆدێل و بڕ لە دەقەکەدا هەیە.' },
          { status: 400 }
        );
      }

      const allSessions = await getStoredSessions();
      const session = pkg.sessions[0];
      allSessions[session.id] = session;
      const saved = await saveStoredSessions(allSessions);
      if (!saved) {
        return NextResponse.json({ success: false, error: 'فایلەکە خوێندرایەوە بەڵام خەزنکردنی لە Supabase سەرکەوتوو نەبوو.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        session,
        sessions: [session],
        packageId: pkg.packageId,
        packageTitle: pkg.packageTitle,
        packageCodeProfile: pkg.packageCodeProfile,
        tabsCount: 1,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: SAVE OR UPDATE SINGLE AUDIT SESSION (ISOLATED BY TAB!)
    // -------------------------------------------------------------------------
    if (action === 'save_session') {
      const { session } = body;
      if (!session || !session.id) {
        return NextResponse.json({ success: false, error: 'داتای سێشن نادروستە' }, { status: 400 });
      }

      const items: SheetsAuditItem[] = session.items || [];
      let totalExpected = 0;
      let totalAudited = 0;
      let totalCartons = 0;
      let totalAuditedCartons = 0;
      let matchedCount = 0;
      let discrepantCount = 0;
      let damagedCount = 0;

      items.forEach((i) => {
        totalExpected += i.expectedQty || 0;
        totalAudited += i.checkedQty || 0;
        totalCartons += i.cartonCount || i.expectedQty || 0;
        totalAuditedCartons += i.checkedCartons ?? (i.scannedCartonNumbers?.length || 0);
        if (i.condition === 'Damaged' || i.auditStatus === 'damaged') damagedCount++;
        else if (i.checkedQty > 0 && i.variance === 0) matchedCount++;
        else if (i.checkedQty > 0 && i.variance !== 0) discrepantCount++;
      });

      const updatedSession: SheetsAuditSession = {
        ...session,
        totalItemsCount: items.length,
        totalExpectedUnits: totalExpected,
        totalAuditedUnits: totalAudited,
        totalCartonsCount: totalCartons,
        totalAuditedCartons,
        matchedCount,
        discrepantCount,
        damagedCount,
        updatedAt: new Date().toISOString(),
      };

      const allSessions = await getStoredSessions();
      allSessions[session.id] = updatedSession;
      const saved = await saveStoredSessions(allSessions);

      // Targeted auto-sync back ONLY to this session's Google Sheet tab
      let webhookSyncResult = null;
      if (updatedSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(updatedSession.webhookUrl)) {
        webhookSyncResult = await pushSessionToAppsScript(updatedSession.webhookUrl, updatedSession);
        if (!webhookSyncResult.ok) {
          logger.warn('[SheetsSync API] Webhook push warning:', webhookSyncResult.error);
        }
      }

      return NextResponse.json({
        success: saved,
        session: updatedSession,
        webhookSyncResult,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2.5: APPLY WEBHOOK URL TO ENTIRE PACKAGE
    // -------------------------------------------------------------------------
    if (action === 'save_package_webhook') {
      const { sessionId, packageId, webhookUrl } = body;
      const cleanWebhook = (webhookUrl || '').trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cleanWebhook)) {
        return NextResponse.json(
          { success: false, error: 'لینکی Webhook دەبێت بە https://script.google.com/macros/s/ دەستپێبکات.' },
          { status: 400 }
        );
      }

      const allSessions = await getStoredSessions();
      const updatedList: SheetsAuditSession[] = [];
      for (const id of Object.keys(allSessions)) {
        const s = allSessions[id];
        if (!s) continue;
        if ((packageId && s.packageId === packageId) || s.id === sessionId) {
          allSessions[id] = { ...s, webhookUrl: cleanWebhook, updatedAt: new Date().toISOString() };
          updatedList.push(allSessions[id]);
        }
      }
      const saved = await saveStoredSessions(allSessions);
      return NextResponse.json({ success: saved, updatedSessions: updatedList });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: DELETE ONE SECTION/TAB (WITH OPTIONAL GOOGLE SHEET CLEANUP/DELETE)
    // -------------------------------------------------------------------------
    if (action === 'delete_session') {
      const { sessionId, googleSheetAction = 'none' as GoogleSheetDeleteAction } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'کۆدی سێشن دیاری نەکراوە' }, { status: 400 });
      }

      const allSessions = await getStoredSessions();
      const target = allSessions[sessionId];
      let googleResult = null;

      if (target && googleSheetAction !== 'none' && target.webhookUrl) {
        googleResult = await callGoogleAppsScriptWebhook(target.webhookUrl, {
          action: googleSheetAction,
          targetSheetName: target.sheetName,
          targetSheetGid: target.tabGid,
        });
      }

      if (allSessions[sessionId]) {
        delete allSessions[sessionId];
        await saveStoredSessions(allSessions);
      }
      const deletedIds = await markSessionsDeleted([sessionId]);

      return NextResponse.json({ success: true, deletedId: sessionId, deletedIds, googleResult });
    }

    // -------------------------------------------------------------------------
    // ACTION 3.25: DELETE ENTIRE PACKAGE (ALL TABS OF ONE GOOGLE SHEET AT ONCE)
    // -------------------------------------------------------------------------
    if (action === 'delete_package') {
      const { packageId, sessionIds = [], googleSheetAction = 'none' as GoogleSheetDeleteAction } = body;
      if (!packageId && (!Array.isArray(sessionIds) || sessionIds.length === 0)) {
        return NextResponse.json({ success: false, error: 'ناسنامەی باکێچ دیاری نەکراوە' }, { status: 400 });
      }

      const allSessions = await getStoredSessions();
      const idSet = new Set<string>(Array.isArray(sessionIds) ? sessionIds : []);
      const targets: SheetsAuditSession[] = [];

      Object.values(allSessions).forEach((s) => {
        if (!s || !s.id) return;
        if ((packageId && s.packageId === packageId) || idSet.has(s.id)) {
          targets.push(s);
          idSet.add(s.id);
        }
      });

      const googleResults: any[] = [];
      if (googleSheetAction !== 'none') {
        for (const t of targets) {
          if (t.webhookUrl) {
            const gRes = await callGoogleAppsScriptWebhook(t.webhookUrl, {
              action: googleSheetAction,
              targetSheetName: t.sheetName,
              targetSheetGid: t.tabGid,
            });
            googleResults.push({ tab: t.sheetName || t.title, ...gRes });
          }
        }
      }

      Array.from(idSet).forEach((id) => {
        if (allSessions[id]) delete allSessions[id];
      });
      await saveStoredSessions(allSessions);
      const deletedIds = await markSessionsDeleted(Array.from(idSet));

      return NextResponse.json({
        success: true,
        deletedCount: idSet.size,
        deletedIds,
        googleResults,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3.5: WIPE ALL AUDIT SESSIONS (FULL RESET ACROSS ALL DEVICES)
    // -------------------------------------------------------------------------
    if (action === 'wipe_all_sessions') {
      const existing = await getStoredSessions();
      const prevIds = Object.keys(existing);
      const resetBefore = new Date().toISOString();
      const [wiped, epochSaved] = await Promise.all([saveStoredSessions({}), setResetEpoch(resetBefore)]);

      if (!wiped || !epochSaved) {
        return NextResponse.json({ success: false, error: 'نەتوانرا هەموو شیتەکان لە Supabase بسڕدرێنەوە.' }, { status: 500 });
      }

      if (prevIds.length > 0) {
        await markSessionsDeleted(prevIds);
      }

      return NextResponse.json({
        success: true,
        clearedCount: prevIds.length,
        resetBefore,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 4: DIRECT SYNC PUSH TO GOOGLE APPS SCRIPT WEBHOOK (SINGLE TAB)
    // -------------------------------------------------------------------------
    if (action === 'sync_to_google') {
      const { webhookUrl, session } = body;
      if (!webhookUrl || !session) {
        return NextResponse.json({ success: false, error: 'لینکی Webhook یان داتای سێشن بەردەست نییە' }, { status: 400 });
      }

      const result = await pushSessionToAppsScript(webhookUrl, session);
      if (!result.ok) {
        return NextResponse.json({
          success: false,
          status: result.status || 400,
          error: result.error || 'نەتوانرا داتاکان بنێردرێن بۆ Google Sheet.',
        });
      }

      return NextResponse.json({
        success: true,
        status: result.status || 200,
        updatedRows: result.updatedRows,
        mode: result.mode,
        targetSheetName: result.targetSheetName || session.sheetName,
      });
    }

    return NextResponse.json({ success: false, error: 'کرداری نەناسراو' }, { status: 400 });
  } catch (err: any) {
    logger.error('[SheetsSync API] POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
