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
  expectedQty: number;
  checkedQty: number;
  variance: number; // checkedQty - expectedQty
  condition: 'Packaged' | 'Wrapped' | 'Damaged' | 'Need Wrapped' | 'Normal';
  auditStatus: 'pending' | 'verified' | 'deficit' | 'excess' | 'damaged';
  rackLocation?: string;
  notes?: string;
  lastAuditedAt?: string;
  auditedBy?: string;
  rawColumns?: Record<string, any>;
}

export interface SheetsAuditSession {
  id: string;
  title: string;
  mode: 'shipment_receiving' | 'inventory_stocktake';
  googleSheetUrl: string;
  spreadsheetId?: string;
  webhookUrl?: string;
  sheetName?: string;
  createdAt: string;
  updatedAt: string;
  auditedBy: string;
  totalItemsCount: number;
  totalExpectedUnits: number;
  totalAuditedUnits: number;
  matchedCount: number;
  discrepantCount: number;
  damagedCount: number;
  status: 'active' | 'completed' | 'archived';
  items: SheetsAuditItem[];
}

/**
 * 🔍 Extracts Google Spreadsheet ID and GID from any Google Sheets link
 */
function extractSheetDetails(url: string) {
  const cleanUrl = url.trim();
  
  // Direct CSV export URL or published link
  if (cleanUrl.includes('/pub?output=csv') || cleanUrl.includes('/export?format=csv')) {
    return { csvUrl: cleanUrl, spreadsheetId: null, gid: '0' };
  }

  // Matches /spreadsheets/d/([a-zA-Z0-9-_]+)
  const idMatch = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const spreadsheetId = idMatch ? idMatch[1] : (cleanUrl.length > 20 && !cleanUrl.includes('/') ? cleanUrl : null);

  // Matches gid=([0-9]+)
  const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  if (!spreadsheetId) {
    return { csvUrl: cleanUrl, spreadsheetId: null, gid: '0' };
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  return { csvUrl, spreadsheetId, gid };
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
  };

  headerRow.forEach((h, idx) => {
    const text = String(h || '').trim().toLowerCase();

    // Model / Code
    if (cols.modelIdx === -1 && (
      text.includes('model') || text.includes('code') || text.includes('barcode') || 
      text.includes('مۆدێل') || text.includes('کۆد') || text.includes('کود') || text.includes('رمز')
    )) {
      cols.modelIdx = idx;
    }

    // Name / Description
    if (cols.nameIdx === -1 && (
      text.includes('name') || text.includes('desc') || text.includes('item') || text.includes('title') ||
      text.includes('ناو') || text.includes('وەسف') || text.includes('المادة') || text.includes('کاڵا')
    )) {
      cols.nameIdx = idx;
    }

    // Expected / Book Qty
    if (cols.expectedQtyIdx === -1 && (
      text.includes('expected') || text.includes('book') || text.includes('system') || text.includes('shipment') ||
      text.includes('بارکراو') || text.includes('چاوەڕوان') || text.includes('تۆمارکراو') || text.includes('کۆگا') ||
      text === 'qty' || text === 'quantity' || text === 'بڕ' || text === 'عدد' || text === 'ژمارە'
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

      const { csvUrl, spreadsheetId, gid } = extractSheetDetails(sheetUrl);

      // Fetch the CSV export
      let csvContent = '';
      try {
        const fetchRes = await fetch(csvUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/csv,text/plain,*/*',
          },
          cache: 'no-store',
        });

        if (!fetchRes.ok) {
          throw new Error(`Google Sheets returned status ${fetchRes.status}. Make sure the sheet is shared with 'Anyone with the link' or published to web.`);
        }

        csvContent = await fetchRes.text();
      } catch (fetchErr: any) {
        return NextResponse.json({ 
          success: false, 
          error: `نەتوانرا گۆگڵ شیتەکە بخوێندرێتەوە: دڵنیابە لینکی گۆگڵ شیتەکە گشتییە (Anyone with the link can view) یان وەک CSV بڵاوکراوەتەوە.\nوردەکاری: ${fetchErr.message}` 
        }, { status: 400 });
      }

      // Parse with XLSX
      let rawData: any[][] = [];
      try {
        const wb = XLSX.read(csvContent, { type: 'string' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      } catch (parseErr: any) {
        return NextResponse.json({ success: false, error: 'هەڵە لە شرۆڤەکردنی خشتەی گۆگڵ شیت' }, { status: 400 });
      }

      if (!rawData || rawData.length === 0) {
        return NextResponse.json({ success: false, error: 'خشتەی گۆگڵ شیتەکە بەتاڵە' }, { status: 400 });
      }

      // Identify header row (first row with at least 2 non-empty values)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const nonEmp = rawData[i].filter((v: any) => String(v).trim().length > 0).length;
        if (nonEmp >= 2) {
          headerRowIndex = i;
          break;
        }
      }

      const headerRow = rawData[headerRowIndex].map((v: any) => String(v || '').trim());
      const colMap = identifyColumns(headerRow);

      const items: SheetsAuditItem[] = [];
      let totalExpected = 0;
      let totalAudited = 0;

      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        const model = String(row[colMap.modelIdx] || '').trim();
        const name = colMap.nameIdx !== -1 ? String(row[colMap.nameIdx] || '').trim() : '';

        // Skip completely empty rows
        if (!model && !name) continue;

        // Parse expected qty
        let expectedQty = 0;
        if (colMap.expectedQtyIdx !== -1) {
          const rawExp = String(row[colMap.expectedQtyIdx] || '').replace(/[^\d.-]/g, '');
          expectedQty = parseFloat(rawExp) || 0;
        }

        // Parse checked qty if sheet already has it
        let checkedQty = 0;
        if (colMap.checkedQtyIdx !== -1 && colMap.checkedQtyIdx !== colMap.expectedQtyIdx) {
          const rawChk = String(row[colMap.checkedQtyIdx] || '').replace(/[^\d.-]/g, '');
          checkedQty = parseFloat(rawChk) || 0;
        }

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

        items.push({
          id: `item_${r}_${model || Math.random().toString(36).slice(2, 7)}`,
          rowIndex: r,
          model: model || `ROW-${r}`,
          name: name || model,
          expectedQty,
          checkedQty,
          variance,
          condition,
          auditStatus,
          rackLocation,
          notes,
          lastAuditedAt: checkedQty > 0 ? new Date().toISOString() : undefined,
        });
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
        'ناوی کاڵا (Item Name)',
        'بڕی تۆمارکراو / بارکراو (Expected Qty)',
        'بڕی ژمێردراو / داگیراو (Audited Qty)',
        'جیاوازی (Variance)',
        'دۆخی کاڵا (Condition)',
        'دۆخی چێک (Audit Status)',
        'شوێن لە کۆگا (Rack/Location)',
        'تێبینی (Notes)',
        'کاتی چێککردن (Audit Timestamp)'
      ];

      const rows = items.map(i => [
        i.model,
        i.name,
        i.expectedQty,
        i.checkedQty,
        i.variance,
        i.condition,
        i.auditStatus === 'verified' ? 'هاوتا و تەواو' : i.auditStatus === 'deficit' ? 'کەمی هەیە' : i.auditStatus === 'excess' ? 'زیادەیە' : i.auditStatus === 'damaged' ? 'زیانلێکەوتوو' : 'چاوەڕوان',
        i.rackLocation || '',
        i.notes || '',
        i.lastAuditedAt || ''
      ]);

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
