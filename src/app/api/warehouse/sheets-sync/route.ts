import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

const SESSIONS_STORE_ID = 'ashley_sheets_audit_sessions';

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
  cartonCount?: number;          // Total expected cartons (ژمارەی کارتۆن / پاکەت)
  pcsPerCarton?: number;         // Pieces per carton (دانە لە هەر کارتۆنێکدا)
  checkedCartons?: number;       // Checked cartons so far (کارتۆنە داگیراوەکان)
  scannedCartonNumbers?: number[]; // Exact box numbers scanned so far, e.g. [1, 2, 4]
}

export interface SheetsAuditSession {
  id: string;
  title: string;
  mode: 'shipment_receiving' | 'inventory_stocktake';
  googleSheetUrl?: string;
  spreadsheetId?: string;
  webhookUrl?: string;
  sheetName?: string;
  createdAt: string;
  updatedAt: string;
  auditedBy: string;
  totalItemsCount: number;
  totalExpectedUnits: number;
  totalAuditedUnits: number;
  totalCartonsCount?: number;    // Total cartons across all items
  totalAuditedCartons?: number;  // Audited cartons so far
  matchedCount: number;
  discrepantCount: number;
  damagedCount: number;
  status: 'active' | 'completed' | 'archived';
  items: SheetsAuditItem[];
}

/**
 * 🔍 Extracts Google Spreadsheet candidate export URLs from any Google Sheets link
 */
function extractSheetCandidates(url: string): { candidateUrls: string[]; spreadsheetId: string | null; gid: string } {
  const cleanUrl = url.trim();

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
    
    const candidateUrls = [
      `${base}?output=csv${gid !== '0' ? `&gid=${gid}` : ''}`,
      `${base}?output=tsv${gid !== '0' ? `&gid=${gid}` : ''}`,
      `${base}?output=csv`,
    ];
    return { candidateUrls, spreadsheetId: pubId || null, gid };
  }

  // 2. Direct CSV / TSV / Export links
  if (cleanUrl.includes('/pub?output=csv') || cleanUrl.includes('/export?format=csv') || cleanUrl.includes('/gviz/tq?tqx=out:csv')) {
    return { candidateUrls: [cleanUrl], spreadsheetId: null, gid: '0' };
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
    const candidateUrls = [
      // Primary: Google Visualization API (Direct, bypasses cookie redirect)
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
      // Secondary: Standard Export CSV
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
      // Tertiary: Export TSV
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&gid=${gid}`,
      // Fallback without GID
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`,
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`,
    ];
    return { candidateUrls, spreadsheetId, gid };
  }

  return { candidateUrls: [cleanUrl], spreadsheetId: null, gid: '0' };
}

/**
 * 🧠 Intelligent Column Header Detection for Kurdish, English, and Arabic
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
    const text = String(h || '').trim().toLowerCase();

    // Model / Code
    if (cols.modelIdx === -1 && (
      text.includes('model') || text.includes('code') || text.includes('barcode') || 
      text.includes('مۆدێل') || text.includes('کۆد') || text.includes('کود') || text.includes('رمز') || text.includes('art')
    )) {
      cols.modelIdx = idx;
    }

    // Name / Description
    if (cols.nameIdx === -1 && (
      text.includes('name') || text.includes('desc') || text.includes('item') || text.includes('title') ||
      text.includes('ناو') || text.includes('وەسف') || text.includes('المادة') || text.includes('کاڵا') || text.includes('tanım')
    )) {
      cols.nameIdx = idx;
    }

    // Carton Count / Boxes (ژمارەی کارتۆن)
    if (cols.cartonCountIdx === -1 && (
      text.includes('carton') || text.includes('ctn') || text.includes('box') || text.includes('boxes') ||
      text.includes('کارتۆن') || text.includes('پاکەت') || text.includes('صندوق') || text.includes('طرد') ||
      text.includes('koli') || text.includes('paket')
    ) && !text.includes('pcs') && !text.includes('/') && !text.includes('per')) {
      cols.cartonCountIdx = idx;
    }

    // Pieces Per Carton (دانە لە هەر کارتۆنێکدا)
    if (cols.pcsPerCartonIdx === -1 && (
      text.includes('pcs/ctn') || text.includes('qty/ctn') || text.includes('pcs/box') || text.includes('pcs/koli') ||
      text.includes('per carton') || text.includes('per box') || text.includes('دانە لە کارتۆن') || text.includes('قطع بالكرتون')
    )) {
      cols.pcsPerCartonIdx = idx;
    }

    // Expected / Book Qty (Total pieces)
    if (cols.expectedQtyIdx === -1 && (
      text.includes('expected') || text.includes('book') || text.includes('system') || text.includes('shipment') ||
      text.includes('بارکراو') || text.includes('چاوەڕوان') || text.includes('تۆمارکراو') || text.includes('کۆگا') ||
      text.includes('total qty') || text.includes('total pcs') || text.includes('کۆی گشتی') || text.includes('مجموع') ||
      text === 'qty' || text === 'quantity' || text === 'بڕ' || text === 'عدد' || text === 'ژمارە' || text === 'adet'
    )) {
      cols.expectedQtyIdx = idx;
    }

    // Checked / Actual Qty
    if (cols.checkedQtyIdx === -1 && (
      text.includes('checked') || text.includes('counted') || text.includes('actual') || text.includes('received') ||
      text.includes('چێک') || text.includes('ژمێردراو') || text.includes('داگیراو') || text.includes('وەرگیراو')
    )) {
      cols.checkedQtyIdx = idx;
    }

    // Condition
    if (cols.conditionIdx === -1 && (
      text.includes('condition') || text.includes('status') || text.includes('state') ||
      text.includes('دۆخ') || text.includes('حالة') || text.includes('کارتۆن')
    )) {
      cols.conditionIdx = idx;
    }

    // Rack / Location
    if (cols.locationIdx === -1 && (
      text.includes('rack') || text.includes('location') || text.includes('shelf') || text.includes('zone') ||
      text.includes('شوێن') || text.includes('ڕەفە') || text.includes('الموقع') || text.includes('مەغزەن')
    )) {
      cols.locationIdx = idx;
    }

    // Notes
    if (cols.notesIdx === -1 && (
      text.includes('note') || text.includes('comment') || text.includes('remark') ||
      text.includes('تێبینی') || text.includes('ملاحظ') || text.includes('سەرنج')
    )) {
      cols.notesIdx = idx;
    }
  });

  // Fallbacks if not detected by keywords
  if (cols.modelIdx === -1 && headerRow.length > 0) cols.modelIdx = 0;
  if (cols.nameIdx === -1 && headerRow.length > 1) cols.nameIdx = 1;
  if (cols.expectedQtyIdx === -1 && headerRow.length > 2) cols.expectedQtyIdx = 2;

  return cols;
}

/**
 * 📦 Converts parsed matrix rows into structured audit items with Carton Intelligence
 */
function convertRowsToAuditItems(rawData: any[][]): { 
  items: SheetsAuditItem[]; 
  totalExpected: number; 
  totalAudited: number; 
  totalCartons: number;
  totalAuditedCartons: number;
  headerRow: string[] 
} {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
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

    const model = String(row[colMap.modelIdx] || '').trim();
    const name = colMap.nameIdx !== -1 ? String(row[colMap.nameIdx] || '').trim() : '';

    // Skip empty rows
    if (!model && !name) continue;

    // Parse cartons & pieces per carton
    let cartonCount = 0;
    if (colMap.cartonCountIdx !== -1) {
      const rawCtn = String(row[colMap.cartonCountIdx] || '').replace(/[^\d.-]/g, '');
      cartonCount = parseFloat(rawCtn) || 0;
    }

    let pcsPerCarton = 1;
    if (colMap.pcsPerCartonIdx !== -1) {
      const rawPcs = String(row[colMap.pcsPerCartonIdx] || '').replace(/[^\d.-]/g, '');
      pcsPerCarton = parseFloat(rawPcs) || 1;
    }

    // Parse expected total qty
    let expectedQty = 0;
    if (colMap.expectedQtyIdx !== -1) {
      const rawExp = String(row[colMap.expectedQtyIdx] || '').replace(/[^\d.-]/g, '');
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
      const rawChk = String(row[colMap.checkedQtyIdx] || '').replace(/[^\d.-]/g, '');
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

    items.push({
      id: `item_${r}_${model || Math.random().toString(36).slice(2, 7)}`,
      rowIndex: r,
      model: model || `ROW-${r}`,
      name: name || model,
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
        qr_code: jsonStr,
        warehouse_name: 'Ashley Google Sheets Warehouse Sessions',
        location: 'Cloud DB',
        updated_at: new Date().toISOString(),
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

// =============================================================================
// GET HANDLER
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    const sessions = await getStoredSessions();
    return NextResponse.json({
      success: true,
      sessions: Object.values(sessions).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
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
    // ACTION 1: FETCH & PARSE GOOGLE SHEET
    // -------------------------------------------------------------------------
    if (action === 'fetch_sheet') {
      const { sheetUrl, mode = 'shipment_receiving', title } = body;
      if (!sheetUrl || typeof sheetUrl !== 'string') {
        return NextResponse.json({ success: false, error: 'تکایە لینکی دروستی Google Sheet بنووسە' }, { status: 400 });
      }

      const { candidateUrls, spreadsheetId } = extractSheetCandidates(sheetUrl);

      let csvContent = '';
      let fetchErrorDetails = '';
      let isHtmlLogin = false;

      for (const targetUrl of candidateUrls) {
        try {
          const fetchRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/csv,text/tab-separated-values,text/plain,*/*',
            },
            cache: 'no-store',
            redirect: 'follow',
          });

          if (!fetchRes.ok) {
            fetchErrorDetails = `Google Sheets returned HTTP ${fetchRes.status}: ${fetchRes.statusText}`;
            continue;
          }

          const text = await fetchRes.text();
          // Check if Google returned an HTML login page or consent screen
          if (text.includes('accounts.google.com') || text.includes('Sign in - Google Accounts') || (text.includes('<html') && (text.includes('password') || text.includes('ServiceLogin')))) {
            isHtmlLogin = true;
            fetchErrorDetails = 'Google requires authentication (Sign in). General Access must be set to "Anyone with the link".';
            continue;
          }

          // If text is suspiciously pure HTML without tabular content
          if (text.trim().startsWith('<!DOCTYPE html>') || (text.trim().startsWith('<html') && !text.includes(',') && !text.includes('\t'))) {
            fetchErrorDetails = 'Google returned HTML page instead of tabular data.';
            continue;
          }

          if (text.trim().length > 0) {
            csvContent = text;
            break;
          }
        } catch (fetchErr: any) {
          fetchErrorDetails = fetchErr.message;
        }
      }

      if (!csvContent) {
        if (isHtmlLogin) {
          return NextResponse.json({ 
            success: false, 
            error: 'ئەم شیتە تایبەتە و پێویستی بە داخڵبوونی ئەکاونتی گۆگڵ هەیە (Google Sign-in).\n\nچۆن چارەسەری دەکەیت:\n١. لە ناو Google Sheet کلیک لەسەر دوگمەی سەوزی Share بکە.\n٢. لە بەشی General Access بپشکنە کە "Anyone with the link" (هەر کەسێک بەم بەستەرە) هەڵبژێردراوە نەک تەنها دۆمەینێکی تایبەت.\n٣. دەتوانیت بە ئاسانی هەمان داتا لێرە بە فایل (.xlsx) دابنێیت یان ڕیزەکان ڕاستەوخۆ Copy & Paste بکەیت.' 
          }, { status: 400 });
        }

        return NextResponse.json({ 
          success: false, 
          error: `نەتوانرا گۆگڵ شیتەکە بخوێندرێتەوە: ${fetchErrorDetails || 'تکایە دڵنیابە لە دروستی بەستەرەکە'}\n\nتێبینی: دەتوانیت بە ئاسانی هەمان فایل وەک Excel (.xlsx) داببەزێنیت و لێرە بەرزبکەیتەوە، یان ڕیزەکان کۆپی و پێست بکەیت.` 
        }, { status: 400 });
      }

      // Parse with XLSX
      let rawData: any[][] = [];
      try {
        const wb = XLSX.read(csvContent, { type: 'string' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      } catch {
        return NextResponse.json({ success: false, error: 'هەڵە لە شرۆڤەکردنی خشتەی گۆگڵ شیت' }, { status: 400 });
      }

      if (!rawData || rawData.length === 0) {
        return NextResponse.json({ success: false, error: 'خشتەی گۆگڵ شیتەکە بەتاڵە' }, { status: 400 });
      }

      const { items, totalExpected, totalAudited, totalCartons, totalAuditedCartons, headerRow } = convertRowsToAuditItems(rawData);

      if (items.length === 0) {
        return NextResponse.json({ success: false, error: 'هیچ کاڵایەک لە ناو خشتەکە نەدۆزرایەوە. دڵنیابە ناوی مۆدێل و بڕ لە خشتەکەدا هەیە.' }, { status: 400 });
      }

      // Create new audit session
      const nowIso = new Date().toISOString();
      const sessionId = `audit_${Date.now()}`;
      const defaultTitle = title || (mode === 'shipment_receiving' 
        ? `پشکنینی باری نوێ (${items.length} کاڵا)` 
        : `جەردی کۆگا (${items.length} کاڵا)`);

      const session: SheetsAuditSession = {
        id: sessionId,
        title: defaultTitle,
        mode,
        googleSheetUrl: sheetUrl,
        spreadsheetId: spreadsheetId || undefined,
        sheetName: `Sheet1`,
        createdAt: nowIso,
        updatedAt: nowIso,
        auditedBy: 'Admin',
        totalItemsCount: items.length,
        totalExpectedUnits: totalExpected,
        totalAuditedUnits: totalAudited,
        totalCartonsCount: totalCartons,
        totalAuditedCartons: totalAuditedCartons,
        matchedCount: items.filter(i => i.auditStatus === 'verified').length,
        discrepantCount: items.filter(i => i.auditStatus === 'deficit' || i.auditStatus === 'excess').length,
        damagedCount: items.filter(i => i.auditStatus === 'damaged').length,
        status: 'active',
        items,
      };

      // Save to Supabase
      const allSessions = await getStoredSessions();
      allSessions[sessionId] = session;
      await saveStoredSessions(allSessions);

      return NextResponse.json({
        success: true,
        session,
        headersDetected: headerRow,
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
        rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      } catch {
        return NextResponse.json({ success: false, error: 'هەڵە لە شرۆڤەکردنی داتای پێستکراو' }, { status: 400 });
      }

      if (!rawData || rawData.length === 0) {
        return NextResponse.json({ success: false, error: 'داتای پێستکراو بەتاڵە' }, { status: 400 });
      }

      const { items, totalExpected, totalAudited, totalCartons, totalAuditedCartons, headerRow } = convertRowsToAuditItems(rawData);

      if (items.length === 0) {
        return NextResponse.json({ success: false, error: 'هیچ کاڵایەک لە ناو خشتەکە نەدۆزرایەوە. دڵنیابە ستوونی مۆدێل و بڕ لە دەقەکەدا هەیە.' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const sessionId = `audit_${Date.now()}`;
      const defaultTitle = title || (mode === 'shipment_receiving' 
        ? `پشکنینی باری نوێ (${items.length} کاڵا)` 
        : `جەردی کۆگا (${items.length} کاڵا)`);

      const session: SheetsAuditSession = {
        id: sessionId,
        title: defaultTitle,
        mode,
        createdAt: nowIso,
        updatedAt: nowIso,
        auditedBy: 'Admin',
        totalItemsCount: items.length,
        totalExpectedUnits: totalExpected,
        totalAuditedUnits: totalAudited,
        totalCartonsCount: totalCartons,
        totalAuditedCartons: totalAuditedCartons,
        matchedCount: items.filter(i => i.auditStatus === 'verified').length,
        discrepantCount: items.filter(i => i.auditStatus === 'deficit' || i.auditStatus === 'excess').length,
        damagedCount: items.filter(i => i.auditStatus === 'damaged').length,
        status: 'active',
        items,
      };

      const allSessions = await getStoredSessions();
      allSessions[sessionId] = session;
      await saveStoredSessions(allSessions);

      return NextResponse.json({
        success: true,
        session,
        headersDetected: headerRow,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 2: SAVE OR UPDATE AUDIT SESSION
    // -------------------------------------------------------------------------
    if (action === 'save_session') {
      const { session } = body;
      if (!session || !session.id) {
        return NextResponse.json({ success: false, error: 'داتای سێشن نادروستە' }, { status: 400 });
      }

      // Recalculate summary metrics
      const items: SheetsAuditItem[] = session.items || [];
      let totalExpected = 0;
      let totalAudited = 0;
      let matchedCount = 0;
      let discrepantCount = 0;
      let damagedCount = 0;

      items.forEach(i => {
        totalExpected += i.expectedQty || 0;
        totalAudited += i.checkedQty || 0;
        if (i.condition === 'Damaged' || i.auditStatus === 'damaged') damagedCount++;
        else if (i.checkedQty > 0 && i.variance === 0) matchedCount++;
        else if (i.checkedQty > 0 && i.variance !== 0) discrepantCount++;
      });

      const updatedSession: SheetsAuditSession = {
        ...session,
        totalItemsCount: items.length,
        totalExpectedUnits: totalExpected,
        totalAuditedUnits: totalAudited,
        matchedCount,
        discrepantCount,
        damagedCount,
        updatedAt: new Date().toISOString(),
      };

      const allSessions = await getStoredSessions();
      allSessions[session.id] = updatedSession;
      const saved = await saveStoredSessions(allSessions);

      // Auto-sync back to Google Sheet if Webhook URL is configured
      let webhookSyncResult = null;
      if (session.webhookUrl && typeof session.webhookUrl === 'string' && session.webhookUrl.startsWith('http')) {
        try {
          const syncRes = await fetch(session.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_audit',
              sessionId: session.id,
              title: session.title,
              mode: session.mode,
              updatedAt: new Date().toISOString(),
              summary: {
                totalItems: items.length,
                totalExpected,
                totalAudited,
                matchedCount,
                discrepantCount,
                damagedCount,
              },
              rows: items.map(i => ({
                model: i.model,
                name: i.name,
                expectedQty: i.expectedQty,
                checkedQty: i.checkedQty,
                variance: i.variance,
                condition: i.condition,
                auditStatus: i.auditStatus,
                rackLocation: i.rackLocation || '',
                notes: i.notes || '',
                lastAuditedAt: i.lastAuditedAt || '',
              })),
            }),
          });
          webhookSyncResult = { status: syncRes.status, ok: syncRes.ok };
        } catch (webhookErr: any) {
          logger.warn('[SheetsSync API] Webhook push warning:', webhookErr);
          webhookSyncResult = { ok: false, error: webhookErr.message };
        }
      }

      return NextResponse.json({
        success: saved,
        session: updatedSession,
        webhookSyncResult,
      });
    }

    // -------------------------------------------------------------------------
    // ACTION 3: DELETE AUDIT SESSION
    // -------------------------------------------------------------------------
    if (action === 'delete_session') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'کۆدی سێشن دیاری نەکراوە' }, { status: 400 });
      }

      const allSessions = await getStoredSessions();
      if (allSessions[sessionId]) {
        delete allSessions[sessionId];
        await saveStoredSessions(allSessions);
      }

      return NextResponse.json({ success: true, deletedId: sessionId });
    }

    // -------------------------------------------------------------------------
    // ACTION 4: DIRECT SYNC PUSH TO GOOGLE APPS SCRIPT WEBHOOK
    // -------------------------------------------------------------------------
    if (action === 'sync_to_google') {
      const { webhookUrl, session } = body;
      if (!webhookUrl || !session) {
        return NextResponse.json({ success: false, error: 'لینکی Webhook یان داتای سێشن بەردەست نییە' }, { status: 400 });
      }

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
        'دواین کاتی گۆڕانکاری (Last Modified)',
        'تێبینی (Audit Notes)'
      ];

      const rows = items.map(i => {
        const totalCtn = i.cartonCount || (i.pcsPerCarton && i.expectedQty ? Math.ceil(i.expectedQty / i.pcsPerCarton) : i.expectedQty) || 1;
        const checkedCtn = i.checkedCartons ?? (i.scannedCartonNumbers?.length ?? (i.pcsPerCarton ? Math.floor(i.checkedQty / i.pcsPerCarton) : i.checkedQty));
        const scannedBoxesStr = Array.isArray(i.scannedCartonNumbers) && i.scannedCartonNumbers.length > 0 
          ? i.scannedCartonNumbers.join(', ') 
          : checkedCtn > 0 ? `1-${checkedCtn}` : '-';
        
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

        const lastModifiedStr = i.lastAuditedAt 
          ? new Date(i.lastAuditedAt).toLocaleString('en-GB', { hour12: false }) 
          : '-';

        return [
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
          i.auditedBy || session.auditedBy || 'Admin',
          lastModifiedStr,
          i.notes || ''
        ];
      });

      const postRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_table',
          title: session.title,
          updatedAt: new Date().toISOString(),
          headers,
          rows,
        }),
      });

      return NextResponse.json({
        success: postRes.ok,
        status: postRes.status,
      });
    }

    return NextResponse.json({ success: false, error: 'کرداری نەناسراو' }, { status: 400 });
  } catch (err: any) {
    logger.error('[SheetsSync API] POST error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
