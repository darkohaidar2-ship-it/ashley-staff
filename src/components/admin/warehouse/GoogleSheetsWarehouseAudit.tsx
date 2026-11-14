'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Building2, 
  Sparkles, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Download, 
  Check, 
  RefreshCw, 
  Printer, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Boxes, 
  Barcode, 
  Scan, 
  Truck, 
  ClipboardCheck, 
  Layers, 
  Share2, 
  Copy, 
  X, 
  SlidersHorizontal, 
  AlertTriangle, 
  RotateCcw, 
  ArrowUpDown, 
  HelpCircle, 
  FileSpreadsheet, 
  ShieldCheck, 
  Save, 
  Link as LinkIcon,
  Upload,
  Clipboard,
  Camera,
  Bot,
  MapPin,
  MessageSquareHeart,
  ArrowRight,
  Clock,
  Package,
  Volume2,
  VolumeX
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';
import {
  GoogleSheetDeleteAction,
  GoogleSheetSyncDiffRow,
  GoogleSheetSyncDiffSummary,
  SheetsAuditItem,
  SheetsAuditSession,
} from '@/app/api/warehouse/sheets-sync/route';
import {
  analyzeWarehouseCodes,
  CodeIntelligenceProfile,
  formatKurdishSpokenScan,
} from '@/lib/warehouse-code-intelligence';
import {
  playKurdishScanAudio,
  precacheSessionAudioClips,
} from '@/lib/kurdish-audio-engine';
import { SmartCameraCartonScanner } from '@/components/admin/warehouse/SmartCameraCartonScanner';
import * as XLSX from 'xlsx';

// 💾 Local Storage Keys for 100% Persistent Data Guarantee
const LOCAL_STORAGE_KEY = 'ashley_warehouse_saved_sessions_v2';
const ACTIVE_SESSION_ID_KEY = 'ashley_warehouse_active_session_id';
const DELETED_IDS_STORAGE_KEY = 'ashley_warehouse_deleted_ids_v1';
const RESET_BEFORE_STORAGE_KEY = 'ashley_warehouse_reset_before_v1';

// 📜 Unified Multi-Tab Google Apps Script (Supports ALL Tabs Package Import + Isolated Per-Tab Write-Back + Timestamps + Clear/Delete!)
const ASHLEY_APPS_SCRIPT_CODE = `function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var allSheets = ss.getSheets();
    var result = [];
    for (var i = 0; i < allSheets.length; i++) {
      var sh = allSheets[i];
      var lastRow = sh.getLastRow();
      var lastCol = sh.getLastColumn();
      var rows = [];
      if (lastRow > 0 && lastCol > 0) {
        rows = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
      }
      result.push({
        sheetName: sh.getName(),
        sheetId: sh.getSheetId(),
        tabIndex: i,
        rows: rows
      });
    }
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      sheets: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function resolveTargetSheet_(ss, data) {
  var sheet = null;
  if (data.targetSheetName) {
    sheet = ss.getSheetByName(String(data.targetSheetName));
  }
  if (!sheet && data.targetSheetGid) {
    var allSheets = ss.getSheets();
    for (var si = 0; si < allSheets.length; si++) {
      if (String(allSheets[si].getSheetId()) === String(data.targetSheetGid)) {
        sheet = allSheets[si];
        break;
      }
    }
  }
  if (!sheet && !data.targetSheetName && !data.targetSheetGid) {
    sheet = ss.getActiveSheet();
  }
  return sheet;
}

function normalizeSku_(val) {
  return String(val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isAshleyProgramHeader_(hdr) {
  var h = String(hdr || '').trim();
  if (!h) return false;
  var exactList = [
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
    'بڕی وەرگیراو',
    'بڕی ژمێردراو',
    'دواین گۆڕانکاری'
  ];
  if (exactList.indexOf(h) !== -1) return true;
  var markers = [
    '(Audited', '(Scanned', '(Qty Variance', '(Checked Cartons',
    '(Audit Status', '(Condition)', '(Rack/Location)', '(Audit Notes)',
    'کاتی سکان', 'کارتۆنی داگیراو', 'کارتۆنە لێدراوەکان',
    'دۆخی پشکنین', 'دۆخی فیزیکی', 'جیاوازی دانە'
  ];
  for (var m = 0; m < markers.length; m++) {
    if (h.indexOf(markers[m]) !== -1) return true;
  }
  return false;
}

function isAshleyGeneratedCoreHeader_(hdr) {
  var h = String(hdr || '').trim();
  var coreList = [
    'کۆدی مۆدێل (Model)',
    'ناوی کاڵا (Item Description)',
    'بڕی بارکراو / خشتە (Expected Qty)',
    'کۆی کارتۆن (Total Cartons)',
    'دانە لە کارتۆن (Pcs/Carton)'
  ];
  return coreList.indexOf(h) !== -1;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var sheet = resolveTargetSheet_(ss, data);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'بەش / تەب لە Google Sheet نەدۆزرایەوە: ' + (data.targetSheetName || '')
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var auditHeaders = data.auditColumnHeaders || [
      'بڕی ژمێردراو / داگیراو (Audited Qty)',
      'جیاوازی دانە (Qty Variance)',
      'کارتۆنی داگیراو (Checked Cartons)',
      'کارتۆنە لێدراوەکان (Scanned Box #)',
      'دۆخی پشکنین (Audit Status)',
      'دۆخی فیزیکی (Condition)',
      'شوێن لە کۆگا (Rack/Location)',
      'کاتی سکان / داخڵکردن (Scanned At)',
      'پشکێنەر (Audited By)',
      'تێبینی (Audit Notes)'
    ];

    // 1. CLEAR ALL PROGRAM COLUMNS & ARTIFACTS ON TARGET TAB (LEAVE ZERO TRACE OF APP)
    if (data.action === 'clear_audit_columns') {
      var lastRowC = sheet.getLastRow();
      var lastColC = sheet.getLastColumn();
      var removedCols = 0;
      if (lastRowC >= 1 && lastColC >= 1) {
        var maxHr = Math.min(8, lastRowC);
        var topR = sheet.getRange(1, 1, maxHr, lastColC).getValues();
        var hrRow = 1;
        for (var rIdx = 0; rIdx < topR.length; rIdx++) {
          if (topR[rIdx].filter(function(c) { return String(c || '').trim() !== ''; }).length >= 2) { hrRow = rIdx + 1; break; }
        }
        var curHdrs = sheet.getRange(hrRow, 1, 1, lastColC).getValues()[0].map(function(h) { return String(h || '').trim(); });
        var allManagedByApp = curHdrs.length > 0 && curHdrs.every(function(ch) {
          return !ch || isAshleyProgramHeader_(ch) || isAshleyGeneratedCoreHeader_(ch);
        });

        if (allManagedByApp && data.wipeProgramArtifacts) {
          sheet.clear();
          removedCols = curHdrs.length;
        } else {
          for (var col = curHdrs.length - 1; col >= 0; col--) {
            if (auditHeaders.indexOf(curHdrs[col]) !== -1 || isAshleyProgramHeader_(curHdrs[col])) {
              sheet.deleteColumn(col + 1);
              removedCols++;
            }
          }
          // Trim trailing blank formatting columns left behind
          var remLastCol = sheet.getLastColumn();
          if (remLastCol >= 1) {
            sheet.getRange(1, 1, sheet.getLastRow() || 1, remLastCol).clearNote();
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        mode: 'audit_columns_cleared',
        sheetName: sheet.getName(),
        removedCols: removedCols
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. DELETE OR CLEAR ENTIRE TAB
    if (data.action === 'delete_tab') {
      var tabName = sheet.getName();
      if (ss.getSheets().length > 1) {
        ss.deleteSheet(sheet);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          mode: 'tab_deleted',
          sheetName: tabName
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        sheet.clear();
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          mode: 'single_tab_cleared',
          sheetName: tabName
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 3. SYNC ONLY TARGET TAB WITH ROW-VERIFIED ISOLATION & SCANNED AT TIMESTAMP
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow >= 2 && lastCol >= 1 && data.itemRecords && data.itemRecords.length > 0) {
      var maxCheckRows = Math.min(8, lastRow);
      var topRows = sheet.getRange(1, 1, maxCheckRows, lastCol).getValues();
      var headerRowNum = 1;
      for (var hr = 0; hr < topRows.length; hr++) {
        var nonEmpty = topRows[hr].filter(function(c) { return String(c || '').trim() !== ''; }).length;
        if (nonEmpty >= 2) { headerRowNum = hr + 1; break; }
      }

      var sheetHeaders = sheet.getRange(headerRowNum, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
      var modelColIdx = -1;
      for (var c = 0; c < sheetHeaders.length; c++) {
        var hLow = sheetHeaders[c].toLowerCase();
        var isItemNoHdr = (hLow.indexOf('item') !== -1 && hLow.indexOf('desc') === -1 && hLow.indexOf('name') === -1);
        if (isItemNoHdr || hLow.indexOf('model') !== -1 || hLow.indexOf('sku') !== -1 || hLow.indexOf('code') !== -1 || hLow.indexOf('مۆدێل') !== -1 || hLow.indexOf('کۆد') !== -1 || hLow.indexOf('رمز') !== -1) {
          modelColIdx = c;
          break;
        }
      }
      if (modelColIdx === -1) modelColIdx = 0;

      var dataStartRow = headerRowNum + 1;
      var numDataRows = Math.max(0, lastRow - headerRowNum);
      var exactRowMap = {};
      var normRowMap = {};
      var rowNormBySheetRow = {};
      if (numDataRows > 0) {
        var existingRows = sheet.getRange(dataStartRow, 1, numDataRows, lastCol).getValues();
        for (var r = 0; r < existingRows.length; r++) {
          var sRowNum = dataStartRow + r;
          var rawVal = String(existingRows[r][modelColIdx] || '').trim();
          var mLow = rawVal.toLowerCase();
          var mNorm = normalizeSku_(rawVal);
          rowNormBySheetRow[sRowNum] = mNorm;
          if (mLow) {
            if (!exactRowMap[mLow]) exactRowMap[mLow] = [];
            exactRowMap[mLow].push(sRowNum);
          }
          if (mNorm) {
            if (!normRowMap[mNorm]) normRowMap[mNorm] = [];
            normRowMap[mNorm].push(sRowNum);
          }
        }
      }

      var matchedCount = 0;
      data.itemRecords.forEach(function(rec) {
        var key = String(rec.model || '').trim().toLowerCase();
        var nKey = normalizeSku_(rec.model);
        if ((key && exactRowMap[key]) || (nKey && normRowMap[nKey])) matchedCount++;
      });

      if (matchedCount >= 1) {
        var colMap = {};
        auditHeaders.forEach(function(hdr) {
          var idx = sheetHeaders.indexOf(hdr);
          if (idx === -1) {
            lastCol++;
            sheet.getRange(headerRowNum, lastCol).setValue(hdr)
                 .setFontWeight('bold')
                 .setBackground('#0f172a')
                 .setFontColor('#ffffff')
                 .setHorizontalAlignment('center');
            sheetHeaders.push(hdr);
            colMap[hdr] = lastCol;
          } else {
            colMap[hdr] = idx + 1;
          }
        });

        var usedRows = {};
        var updatedCount = 0;
        data.itemRecords.forEach(function(rec) {
          var key = String(rec.model || '').trim().toLowerCase();
          var nKey = normalizeSku_(rec.model);
          var targetRow = -1;

          // 1. Prefer verified rowIndex (rec.rowIndex + 1 in 1-based sheet coords) if SKU still matches that row!
          if (typeof rec.rowIndex === 'number' && rec.rowIndex >= 0) {
            var directSheetRow = rec.rowIndex + 1;
            if (rowNormBySheetRow[directSheetRow] && rowNormBySheetRow[directSheetRow] === nKey && !usedRows[directSheetRow]) {
              targetRow = directSheetRow;
            }
          }

          // 2. Otherwise pick next unused matching row from exactRowMap or normRowMap (handles duplicate SKUs cleanly!)
          if (targetRow === -1 && key && exactRowMap[key]) {
            for (var ei = 0; ei < exactRowMap[key].length; ei++) {
              if (!usedRows[exactRowMap[key][ei]]) { targetRow = exactRowMap[key][ei]; break; }
            }
          }
          if (targetRow === -1 && nKey && normRowMap[nKey]) {
            for (var ni = 0; ni < normRowMap[nKey].length; ni++) {
              if (!usedRows[normRowMap[nKey][ni]]) { targetRow = normRowMap[nKey][ni]; break; }
            }
          }

          if (targetRow !== -1 && rec.auditValues) {
            usedRows[targetRow] = true;
            auditHeaders.forEach(function(hdr) {
              if (colMap[hdr] && rec.auditValues[hdr] !== undefined) {
                sheet.getRange(targetRow, colMap[hdr]).setValue(rec.auditValues[hdr]);
              }
            });
            updatedCount++;
          }
        });

        sheet.autoResizeColumns(1, lastCol);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          mode: 'columns_added_updated',
          sheetName: sheet.getName(),
          updatedRows: updatedCount
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (data.headers && data.rows) {
      sheet.clear();
      var output = [data.headers];
      data.rows.forEach(function(r) { output.push(r); });
      var numRows = output.length;
      var numCols = data.headers.length;
      sheet.getRange(1, 1, numRows, numCols).setValues(output);
      sheet.getRange(1, 1, 1, numCols)
           .setFontWeight('bold')
           .setBackground('#0f172a')
           .setFontColor('#ffffff')
           .setHorizontalAlignment('center');
      if (numRows > 1) {
        sheet.getRange(2, 1, numRows - 1, numCols)
             .setFontFamily('Arial')
             .setFontSize(10)
             .setHorizontalAlignment('center');
      }
      sheet.autoResizeColumns(1, numCols);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        mode: 'full_table',
        sheetName: sheet.getName(),
        updatedRows: data.rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'No data' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}`;

function isDemoSeedSessionId(id?: string): boolean {
  if (!id) return false;
  return id === 'ashley-shipment-receiving-seed-01' || id === 'ashley-stocktake-seed-01' || id === 'ashley-inventory-stocktake-seed-02';
}

function getLocalResetBefore(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESET_BEFORE_STORAGE_KEY);
    if (!raw || isNaN(Date.parse(raw))) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveLocalResetBefore(isoTimestamp: string) {
  if (typeof window === 'undefined' || !isoTimestamp || isNaN(Date.parse(isoTimestamp))) return;
  try {
    localStorage.setItem(RESET_BEFORE_STORAGE_KEY, isoTimestamp);
  } catch {}
}

function isBeforeResetEpoch(session: SheetsAuditSession | null | undefined, resetBefore?: string | null): boolean {
  if (!session || !resetBefore) return false;
  const resetMs = Date.parse(resetBefore);
  if (isNaN(resetMs)) return false;
  const sessionMs = Date.parse(session.updatedAt || session.createdAt || '');
  return !isNaN(sessionMs) && sessionMs <= resetMs;
}

function getLocalWarehouseSessions(): SheetsAuditSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const resetBefore = getLocalResetBefore();
    return Array.isArray(parsed)
      ? parsed.filter((s: SheetsAuditSession) => s && s.id && !isDemoSeedSessionId(s.id) && !isBeforeResetEpoch(s, resetBefore))
      : [];
  } catch {
    return [];
  }
}

function saveLocalWarehouseSessions(sessionsList: SheetsAuditSession[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionsList));
  } catch (e) {
    console.warn('[Warehouse] Error saving local sessions:', e);
  }
}

function getLocalDeletedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalDeletedIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, 300)));
  } catch {}
}

function mergeClientSessionsItemWise(loc: SheetsAuditSession, srv: SheetsAuditSession): SheetsAuditSession {
  const locMs = Date.parse(loc.updatedAt || '') || 0;
  const srvMs = Date.parse(srv.updatedAt || '') || 0;
  const srvById = new Map<string, SheetsAuditItem>();
  (srv.items || []).forEach((it) => srvById.set(it.id, it));

  const seenIds = new Set<string>();
  const preferLocByDefault = locMs > srvMs + 1500;
  const mergedItems: SheetsAuditItem[] = (loc.items || []).map((lItem) => {
    seenIds.add(lItem.id);
    const sItem = srvById.get(lItem.id);
    if (!sItem) return lItem;
    const lTouch = Date.parse(lItem.lastAuditedAt || '') || 0;
    const sTouch = Date.parse(sItem.lastAuditedAt || '') || 0;
    if (lTouch > sTouch) return lItem;
    if (sTouch > lTouch) return sItem;
    return preferLocByDefault ? lItem : sItem;
  });

  for (const sItem of srv.items || []) {
    if (!seenIds.has(sItem.id)) mergedItems.push(sItem);
  }

  return {
    ...(preferLocByDefault ? { ...srv, ...loc } : { ...loc, ...srv }),
    webhookUrl: loc.webhookUrl || srv.webhookUrl,
    googleSheetUrl: loc.googleSheetUrl || srv.googleSheetUrl,
    items: mergedItems,
    totalItemsCount: mergedItems.length,
    totalAuditedUnits: mergedItems.reduce((a, it) => a + (it.checkedQty || 0), 0),
    totalAuditedCartons: mergedItems.reduce((a, it) => a + (it.checkedCartons || 0), 0),
    matchedCount: mergedItems.filter((it) => it.auditStatus === 'verified').length,
    discrepantCount: mergedItems.filter((it) => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
    damagedCount: mergedItems.filter((it) => it.auditStatus === 'damaged').length,
  };
}

function DeferredNoteInput({
  itemId,
  value,
  onCommit,
  onEditingChange,
}: {
  itemId: string;
  value: string;
  onCommit: (itemId: string, nextValue: string) => void;
  onEditingChange?: (itemId: string, isEditing: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const draftRef = useRef(draft);
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  draftRef.current = draft;

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
    }
  }, [value, isEditing, itemId]);

  const commitIfDirty = useCallback(
    (forceBlur = false) => {
      setIsEditing(false);
      onEditingChange?.(itemId, false);
      const trimmedDraft = (draftRef.current || '').trim();
      const trimmedVal = (value || '').trim();
      if (trimmedDraft !== trimmedVal) {
        onCommit(itemId, trimmedDraft);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2400);
      }
      if (forceBlur && textareaRef.current) {
        textareaRef.current.blur();
      }
    },
    [itemId, onCommit, onEditingChange, value]
  );

  const isDirty = (draft || '').trim() !== (value || '').trim();

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        rows={2}
        dir="rtl"
        lang="ku"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onFocus={() => {
          setIsEditing(true);
          onEditingChange?.(itemId, true);
        }}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          isComposingRef.current = false;
          setDraft((e.target as HTMLTextAreaElement).value);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={() => {
          if (!isComposingRef.current) {
            commitIfDirty(false);
          }
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            commitIfDirty(true);
          }
        }}
        placeholder="تێبینی بنووسە..."
        style={{ direction: 'rtl', textAlign: 'right', unicodeBidi: 'isolate' }}
        className={`w-full h-[52px] p-2 rounded-xl border text-[11px] font-medium outline-none resize-none overflow-y-auto ashley-cell-scroll leading-snug transition-all ${
          isEditing
            ? 'bg-white border-blue-500 ring-2 ring-blue-100 pb-5 text-slate-900 shadow-sm'
            : isDirty
            ? 'bg-amber-50/70 border-amber-300 text-slate-900'
            : justSaved
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
            : 'bg-slate-50/70 border-slate-200 focus:bg-white focus:border-blue-400 text-slate-800'
        }`}
      />
      {(isEditing || isDirty) && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            commitIfDirty(true);
          }}
          className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[9.5px] font-black shadow-sm flex items-center gap-1 cursor-pointer transition-all z-10"
        >
          <Check className="w-2.5 h-2.5 stroke-[3]" />
          <span>تەواو • خەزنکردن</span>
        </button>
      )}
      {justSaved && !isEditing && (
        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9.5px] font-black shadow-xs flex items-center gap-1 pointer-events-none z-10 animate-in fade-in duration-200">
          <Check className="w-2.5 h-2.5 stroke-[3]" />
          <span>خەزنکرا ✅</span>
        </span>
      )}
    </div>
  );
}

export interface GoogleSheetsWarehouseAuditProps {
  onBackToMobileApp?: () => void;
  onSwitchPortal?: (portal: 'attendance' | 'feedback' | 'warehouse') => void;
  isMobileEmbedded?: boolean;
}

export function GoogleSheetsWarehouseAudit({
  onBackToMobileApp,
  onSwitchPortal,
  isMobileEmbedded = false
}: GoogleSheetsWarehouseAuditProps = {}) {
  // All Sessions
  const [sessions, setSessions] = useState<SheetsAuditSession[]>([]);
  const [currentSession, setCurrentSession] = useState<SheetsAuditSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncingGoogle, setSyncingGoogle] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

  // 🚛 📋 DUAL WAREHOUSE SECTIONS (داگرتنی باری نوێ و کانتینەر vs تۆمارکردنی جەرد)
  const [warehouseSection, setWarehouseSection] = useState<'shipment_receiving' | 'inventory_stocktake'>('shipment_receiving');
  const [lastSavedNotice, setLastSavedNotice] = useState<string | null>(null);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'deficit' | 'excess' | 'damaged'>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  // Barcode quick scan input
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scannedAlert, setScannedAlert] = useState<{ message: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [showSessionsModal, setShowSessionsModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showHelpScriptModal, setShowHelpScriptModal] = useState<boolean>(false);
  const [showAudioSettingsModal, setShowAudioSettingsModal] = useState<boolean>(false);
  const [testAudioCode, setTestAudioCode] = useState<string>('EV 21068-02');
  const [testAudioQty, setTestAudioQty] = useState<number>(1);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState<boolean>(false);
  const [precachingAudio, setPrecachingAudio] = useState<boolean>(false);
  const [precacheAudioStatus, setPrecacheAudioStatus] = useState<string | null>(null);
  const [elevenLabsKeyInput, setElevenLabsKeyInput] = useState<string>('');
  const [savingAudioSettings, setSavingAudioSettings] = useState<boolean>(false);
  const [audioSettingsSavedNotice, setAudioSettingsSavedNotice] = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const [showGooglePushModal, setShowGooglePushModal] = useState<boolean>(false);
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);
  const [deleteDialog, setDeleteDialog] = useState<
    | { kind: 'tab'; session: SheetsAuditSession }
    | { kind: 'package'; packageId: string; packageTitle: string; tabs: SheetsAuditSession[] }
    | null
  >(null);
  const [deletingAction, setDeletingAction] = useState<boolean>(false);
  const [codeBriefingModal, setCodeBriefingModal] = useState<{
    title: string;
    tabsCount: number;
    tabNames: string[];
    profile: CodeIntelligenceProfile;
  } | null>(null);
  const [showWipeAllModal, setShowWipeAllModal] = useState<boolean>(false);
  const [wipingAll, setWipingAll] = useState<boolean>(false);
  const [showSyncControlModal, setShowSyncControlModal] = useState<boolean>(false);
  const [syncInspecting, setSyncInspecting] = useState<boolean>(false);
  const [syncApplying, setSyncApplying] = useState<boolean>(false);
  const [syncInspectionResult, setSyncInspectionResult] = useState<{
    tabMatched: string;
    summary: GoogleSheetSyncDiffSummary;
    diffs: GoogleSheetSyncDiffRow[];
  } | null>(null);
  const [pendingGoogleSyncIds, setPendingGoogleSyncIds] = useState<Record<string, boolean>>({});

  // Google Push & Supabase Save States
  const [tempWebhookUrl, setTempWebhookUrl] = useState<string>('');
  const [isPushingGoogle, setIsPushingGoogle] = useState<boolean>(false);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);
  const [pushErrorMsg, setPushErrorMsg] = useState<string | null>(null);
  const [webhookWarningMsg, setWebhookWarningMsg] = useState<string | null>(null);
  const [supabaseSaveSuccess, setSupabaseSaveSuccess] = useState<boolean>(false);
  const [lastSupabaseSavedTime, setLastSupabaseSavedTime] = useState<string | null>(null);
  const [refreshingCloud, setRefreshingCloud] = useState<boolean>(false);

  // Connect Google Sheet Form State
  const [importTab, setImportTab] = useState<'url' | 'file' | 'paste' | 'ai'>('url');
  const [inputSheetUrl, setInputSheetUrl] = useState<string>('');
  const [inputRawPaste, setInputRawPaste] = useState<string>('');
  const [inputSessionTitle, setInputSessionTitle] = useState<string>('');
  const [inputMode, setInputMode] = useState<'shipment_receiving' | 'inventory_stocktake'>('shipment_receiving');
  const [inputWebhookUrl, setInputWebhookUrl] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [inspectingTabs, setInspectingTabs] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [targetPackageIdForConnect, setTargetPackageIdForConnect] = useState<string | null>(null);
  const [previewedTabs, setPreviewedTabs] = useState<
    Array<{
      sheetName: string;
      tabGid?: string;
      tabIndex: number;
      itemCount: number;
      totalUnits: number;
      alreadyImported?: boolean;
      existingAuditedUnits?: number;
      rawData?: any[][];
    }>
  >([]);
  const [selectedPreviewTabNames, setSelectedPreviewTabNames] = useState<string[]>([]);
  const [pendingExcelTitle, setPendingExcelTitle] = useState<string | null>(null);
  const [packageTabFilter, setPackageTabFilter] = useState<string>('');
  const [sessionsModalSearch, setSessionsModalSearch] = useState<string>('');
  const [sessionsModalModeFilter, setSessionsModalModeFilter] = useState<'all' | 'shipment_receiving' | 'inventory_stocktake'>('all');

  // Notification Copy
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 📱 Mobile Screen Detection & Strict Operational Mode (No file upload / No question editing on mobile)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 768 || isMobileEmbedded);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isMobileEmbedded]);

  const isMobileOperational = isMobileEmbedded || isMobileScreen;

  // Refs to keep cloud sync stable & race-free
  const currentSessionRef = useRef<SheetsAuditSession | null>(null);
  const isMobileOperationalRef = useRef<boolean>(isMobileOperational);
  const lastLocalMutationAtRef = useRef<number>(0);
  const localMutationSeqRef = useRef<number>(0);
  const activeNoteEditingIdsRef = useRef<Set<string>>(new Set());
  const googleSyncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latestSessionForPushRef = useRef<Record<string, SheetsAuditSession>>({});

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useEffect(() => {
    isMobileOperationalRef.current = isMobileOperational;
  }, [isMobileOperational]);

  // 1. Initial Local Cache Hydration (filters out old demo seed sessions automatically)
  useEffect(() => {
    const local = getLocalWarehouseSessions();
    if (local.length > 0) {
      setSessions(local);
      const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_SESSION_ID_KEY) : null;
      const matchedActive = (savedActiveId ? local.find(s => s.id === savedActiveId) : null) || local[0];
      if (matchedActive) {
        setCurrentSession(matchedActive);
        if (matchedActive.mode) {
          setWarehouseSection(matchedActive.mode);
          setInputMode(matchedActive.mode);
        }
      }
    } else {
      saveLocalWarehouseSessions([]);
    }
  }, []);

  // 1b. Fetch authoritative sessions from Supabase (No zombie deleted sheets, no demo phantom sheets!)
  const loadSessions = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshingCloud(true);
    try {
      const fetchStartedAt = Date.now();
      const res = await fetch('/api/warehouse/sheets-sync', { cache: 'no-store' });
      const data = await res.json();

      // Skip overwriting state if user just edited an item while this background GET was in flight
      if (!isManualRefresh && lastLocalMutationAtRef.current > fetchStartedAt) {
        return;
      }

      if (data.success && Array.isArray(data.sessions)) {
        const deletedIds: string[] = Array.isArray(data.deletedIds) ? data.deletedIds : [];
        const deletedSet = new Set<string>([...getLocalDeletedIds(), ...deletedIds]);
        saveLocalDeletedIds(Array.from(deletedSet));

        const serverResetBefore =
          typeof data.resetBefore === 'string' && !isNaN(Date.parse(data.resetBefore))
            ? data.resetBefore
            : getLocalResetBefore();
        if (typeof data.resetBefore === 'string' && !isNaN(Date.parse(data.resetBefore))) {
          saveLocalResetBefore(data.resetBefore);
        }

        const local = getLocalWarehouseSessions().filter(
          s => !deletedSet.has(s.id) && !isDemoSeedSessionId(s.id) && !isBeforeResetEpoch(s, serverResetBefore)
        );
        const localById = new Map<string, SheetsAuditSession>();
        local.forEach(s => localById.set(s.id, s));

        const finalMap = new Map<string, SheetsAuditSession>();
        const serverList: SheetsAuditSession[] = data.sessions.filter(
          (s: SheetsAuditSession) =>
            s && s.id && !deletedSet.has(s.id) && !isDemoSeedSessionId(s.id) && !isBeforeResetEpoch(s, serverResetBefore)
        );

        serverList.forEach((srv: SheetsAuditSession) => {
          const loc = localById.get(srv.id);
          if (loc) {
            finalMap.set(srv.id, mergeClientSessionsItemWise(loc, srv));
          } else {
            finalMap.set(srv.id, srv);
          }
        });

        // Desktop Admin Rescue Sync: if Desktop created a post-reset sheet locally (audit_*), push it to Supabase now!
        if (!isMobileOperationalRef.current) {
          for (const loc of local) {
            if (
              !finalMap.has(loc.id) &&
              loc.id.startsWith('audit_') &&
              !deletedSet.has(loc.id) &&
              !isBeforeResetEpoch(loc, serverResetBefore)
            ) {
              finalMap.set(loc.id, loc);
              fetch('/api/warehouse/sheets-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_session', session: loc }),
              }).catch(() => {});
            }
          }
        }

        const merged = Array.from(finalMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setSessions(merged);
        saveLocalWarehouseSessions(merged);

        if (merged.length === 0 && typeof window !== 'undefined') {
          localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
        }

        // Keep active currentSession strictly synchronized with authoritative cloud list
        const cur = currentSessionRef.current;
        if (
          !cur ||
          !finalMap.has(cur.id) ||
          deletedSet.has(cur.id) ||
          isDemoSeedSessionId(cur.id) ||
          isBeforeResetEpoch(cur, serverResetBefore)
        ) {
          const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_SESSION_ID_KEY) : null;
          const matched = (savedActiveId ? merged.find(s => s.id === savedActiveId) : null) || merged[0] || null;
          setCurrentSession(matched);
          if (matched?.mode) {
            setWarehouseSection(matched.mode);
            setInputMode(matched.mode);
          }
        } else {
          const updatedCur = finalMap.get(cur.id);
          if (
            updatedCur &&
            (updatedCur.updatedAt !== cur.updatedAt ||
              updatedCur.totalAuditedUnits !== cur.totalAuditedUnits ||
              updatedCur.items.length !== cur.items.length)
          ) {
            const mergedCur = mergeClientSessionsItemWise(cur, updatedCur);
            if (activeNoteEditingIdsRef.current.size > 0) {
              const curNotesById = new Map(cur.items.map((it) => [it.id, it.notes]));
              mergedCur.items = mergedCur.items.map((it) =>
                activeNoteEditingIdsRef.current.has(it.id)
                  ? { ...it, notes: curNotesById.get(it.id) ?? it.notes }
                  : it
              );
            }
            setCurrentSession(mergedCur);
          }
        }
      }
    } catch {
      // Offline fallback: retain cached localStorage
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshingCloud(false);
    }
  }, []);

  useEffect(() => {
    loadSessions(false);

    const onFocusOrVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadSessions(false);
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadSessions(false);
      }
    }, 25000);

    return () => {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      clearInterval(interval);
    };
  }, [loadSessions]);

  // Switch between the Two Primary Warehouse Sections (بار داگرتن vs جەرد)
  const handleSwitchWarehouseSection = (mode: 'shipment_receiving' | 'inventory_stocktake') => {
    triggerHaptic('medium');
    setWarehouseSection(mode);
    setInputMode(mode);

    // If active session belongs to this mode, keep it; otherwise find latest for this mode (or null if empty)
    if (currentSession && (currentSession.mode || 'shipment_receiving') === mode) {
      return;
    }
    const matchingSession = sessions.find(s => (s.mode || 'shipment_receiving') === mode) || null;
    setCurrentSession(matchingSession);
    if (typeof window !== 'undefined') {
      if (matchingSession) localStorage.setItem(ACTIVE_SESSION_ID_KEY, matchingSession.id);
      else localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
    }
  };

  // Filtered Sessions for the active section
  const sectionSessions = useMemo(() => {
    return sessions.filter(s => (s.mode || 'shipment_receiving') === warehouseSection);
  }, [sessions, warehouseSection]);

  // Group sessions into Spreadsheet Packages (باکێچەکان: هەر فایلێکی گۆگڵ شیت بەیەکەوە و بە تەبە جیاوازەکانی ناویەوە)
  const groupedPackages = useMemo(() => {
    const pkgMap = new Map<
      string,
      {
        packageId: string;
        packageTitle: string;
        tabs: SheetsAuditSession[];
        totalUnits: number;
        auditedUnits: number;
        hasWebhook: boolean;
        googleSheetUrl?: string;
        newestTs: number;
      }
    >();

    for (const s of sectionSessions) {
      const pid = s.packageId || s.id;
      const ts = Date.parse(s.updatedAt || s.createdAt || '') || 0;
      if (!pkgMap.has(pid)) {
        pkgMap.set(pid, {
          packageId: pid,
          packageTitle: s.packageTitle || s.title,
          tabs: [],
          totalUnits: 0,
          auditedUnits: 0,
          hasWebhook: false,
          googleSheetUrl: s.googleSheetUrl,
          newestTs: ts,
        });
      }
      const pkg = pkgMap.get(pid)!;
      pkg.tabs.push(s);
      pkg.totalUnits += s.totalExpectedUnits || 0;
      pkg.auditedUnits += s.totalAuditedUnits || 0;
      if (s.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(s.webhookUrl.trim())) {
        pkg.hasWebhook = true;
      }
      if (!pkg.googleSheetUrl && s.googleSheetUrl) pkg.googleSheetUrl = s.googleSheetUrl;
      if (ts > pkg.newestTs) pkg.newestTs = ts;
    }

    const result = Array.from(pkgMap.values());
    result.forEach((pkg) => {
      pkg.tabs.sort((a, b) => (a.tabIndex ?? 0) - (b.tabIndex ?? 0));
    });
    return result.sort((a, b) => b.newestTs - a.newestTs);
  }, [sectionSessions]);

  // Open Code Intelligence Briefing for any Package or Single Sheet
  const openPackageCodeBriefing = (tabs: SheetsAuditSession[], customTitle?: string) => {
    const allItems = tabs.flatMap((t) => t.items || []);
    const profile = analyzeWarehouseCodes(allItems);
    setCodeBriefingModal({
      title: customTitle || tabs[0]?.packageTitle || tabs[0]?.title || 'بەرچاوڕوونی کۆدەکان',
      tabsCount: tabs.length,
      tabNames: tabs.map((t) => t.sheetName || t.title),
      profile,
    });
  };

  // Shared helper to finalize 1 or Multi-Tab Package imported from Google Sheets / Excel / Paste / AI
  const finalizeImportedPackage = async (
    importedList: SheetsAuditSession[],
    serverProfile?: CodeIntelligenceProfile,
    pkgTitle?: string
  ) => {
    if (!importedList || importedList.length === 0) return;
    lastLocalMutationAtRef.current = Date.now();

    const rawWebhook = inputWebhookUrl.trim();
    const isSpreadsheetLinkInWebhook = rawWebhook.includes('docs.google.com/spreadsheets');
    const validWebhook = rawWebhook && !isSpreadsheetLinkInWebhook ? rawWebhook : undefined;

    if (isSpreadsheetLinkInWebhook) {
      setWebhookWarningMsg(
        'لینکی ئاسایی شیت لە خانەی Webhook دانرابوو بۆیە پشتگوێ خرا؛ شیتەکان بارکران بەڵام بۆ نووسینی ڕاستەوخۆ پێویستە لینکی Apps Script (script.google.com) دابنێیت.'
      );
    } else {
      setWebhookWarningMsg(null);
    }

    const finalList = importedList.map((s) => ({
      ...s,
      webhookUrl: validWebhook || s.webhookUrl,
    }));

    if (validWebhook) {
      try {
        await fetch('/api/warehouse/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_package_webhook',
            packageId: finalList[0].packageId,
            sessionId: finalList[0].id,
            webhookUrl: validWebhook,
          }),
        });
      } catch {}
    }

    const importedIds = new Set(finalList.map((s) => s.id));
    setSessions((prev) => {
      const next = [...finalList, ...prev.filter((s) => !importedIds.has(s.id))];
      saveLocalWarehouseSessions(next);
      return next;
    });

    const primary = finalList[0];
    setCurrentSession(primary);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, primary.id);
    }
    if (primary.mode) setWarehouseSection(primary.mode);
    setLastSavedNotice(
      `باکێچی ${finalList.length} بەش خەزنکرا • ${new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}`
    );

    const allItems = finalList.flatMap((t) => t.items || []);
    setCodeBriefingModal({
      title: pkgTitle || primary.packageTitle || primary.title,
      tabsCount: finalList.length,
      tabNames: finalList.map((t) => t.sheetName || t.title),
      profile: serverProfile || analyzeWarehouseCodes(allItems),
    });

    setShowConnectModal(false);
    setInputSheetUrl('');
    setInputSessionTitle('');
    setInputWebhookUrl('');
    setInputRawPaste('');
    triggerHaptic('success');
  };

  // Backwards alias
  const finalizeImportedSession = async (rawSession: SheetsAuditSession) =>
    finalizeImportedPackage([rawSession]);

  const resetPreviewSelection = useCallback(() => {
    setPreviewedTabs([]);
    setSelectedPreviewTabNames([]);
    setPendingExcelTitle(null);
    setTargetPackageIdForConnect(null);
  }, []);

  // 1.5 Inspect All Available Tabs in a Google Sheet Before Choosing Which Ones to Import
  const handleInspectSheetTabs = async (
    overrideUrl?: string,
    overrideWebhook?: string,
    overrideMode?: 'shipment_receiving' | 'inventory_stocktake',
    overridePkgId?: string | null
  ) => {
    const targetUrl = (overrideUrl ?? inputSheetUrl).trim();
    if (!targetUrl) {
      setConnectError('سەرەتا لینکی Google Sheet یان Apps Script بنووسە.');
      return;
    }

    setInspectingTabs(true);
    setConnectError(null);

    try {
      const rawWebhook = (overrideWebhook ?? inputWebhookUrl).trim();
      const validWebhook =
        rawWebhook && /^https:\/\/script\.google(usercontent)?\.com\//.test(rawWebhook) ? rawWebhook : undefined;

      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'inspect_sheet',
          sheetUrl: targetUrl,
          webhookUrl: validWebhook,
          mode: overrideMode || inputMode,
          targetPackageId: overridePkgId ?? (targetPackageIdForConnect || undefined),
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.tabs) && data.tabs.length > 0) {
        setPreviewedTabs(data.tabs);
        // Auto-select new tabs first if updating an existing package; otherwise select all
        const newTabs = data.tabs.filter((t: any) => !t.alreadyImported);
        const defaultSelected =
          newTabs.length > 0 && newTabs.length < data.tabs.length
            ? newTabs.map((t: any) => t.sheetName)
            : data.tabs.map((t: any) => t.sheetName);
        setSelectedPreviewTabNames(defaultSelected);
        if (!inputSessionTitle.trim() && data.spreadsheetTitle) {
          setInputSessionTitle(data.spreadsheetTitle);
        }
      } else {
        setConnectError(data.error || 'نەتوانرا لیستی تابەکان بخوێندرێتەوە.');
      }
    } catch {
      setConnectError('هەڵە لە پەیوەندیکردن بە سێرڤەر بۆ پشکنینی تابەکان.');
    } finally {
      setInspectingTabs(false);
    }
  };

  // 2. Connect and Import All or Selected Tabs of Google Sheet into Package
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSheetUrl.trim()) return;

    if (previewedTabs.length > 0 && selectedPreviewTabNames.length === 0) {
      setConnectError('تکایە لانیکەم یەک تاب (بەش) هەڵبژێرە بۆ داخڵکردن.');
      return;
    }

    setConnecting(true);
    setConnectError(null);

    try {
      const rawWebhook = inputWebhookUrl.trim();
      const validWebhook =
        rawWebhook && /^https:\/\/script\.google(usercontent)?\.com\//.test(rawWebhook) ? rawWebhook : undefined;

      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_sheet',
          sheetUrl: inputSheetUrl.trim(),
          webhookUrl: validWebhook,
          mode: inputMode,
          title: inputSessionTitle.trim() || undefined,
          selectedTabNames:
            previewedTabs.length > 0 && selectedPreviewTabNames.length > 0
              ? selectedPreviewTabNames
              : undefined,
          targetPackageId: targetPackageIdForConnect || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && (Array.isArray(data.sessions) ? data.sessions.length > 0 : data.session)) {
        const list: SheetsAuditSession[] = Array.isArray(data.sessions) ? data.sessions : [data.session];
        await finalizeImportedPackage(list, data.packageCodeProfile, data.packageTitle);
        resetPreviewSelection();
      } else {
        setConnectError(data.error || 'نەتوانرا گۆگڵ شیتەکە لۆد بکرێت.');
      }
    } catch {
      setConnectError('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setConnecting(false);
    }
  };

  // 2d. Import via AI Smart Manifest & Packing List Extraction
  const handleAiSmartParseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRawPaste.trim()) return;

    setIsAiParsing(true);
    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/warehouse/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputRawPaste.trim(),
          mode: inputMode,
          title: inputSessionTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        await finalizeImportedSession(data.session);
      } else {
        setConnectError(data.error || 'نەتوانرا داتاکە بە زیرەکی دەستکرد شیبکرێتەوە.');
      }
    } catch {
      setConnectError('هەڵە لە پەیوەندیکردن بە سێرڤەری زیرەکی دەستکرد.');
    } finally {
      setIsAiParsing(false);
      setConnecting(false);
    }
  };

  // 2b. Import ALL or Selected Tabs via Excel File Upload (.xlsx, .xls, .csv) as 1 Package
  const submitExcelSheetsPackage = async (
    sheetsPayload: Array<{ sheetName: string; rawData: any[][] }>,
    fallbackTitle: string,
    selectedNames?: string[]
  ) => {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse_workbook',
          sheets: sheetsPayload,
          selectedTabNames: selectedNames && selectedNames.length > 0 ? selectedNames : undefined,
          mode: inputMode,
          title: inputSessionTitle.trim() || fallbackTitle,
          webhookUrl: inputWebhookUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && (Array.isArray(data.sessions) ? data.sessions.length > 0 : data.session)) {
        const list: SheetsAuditSession[] = Array.isArray(data.sessions) ? data.sessions : [data.session];
        await finalizeImportedPackage(list, data.packageCodeProfile, data.packageTitle);
        resetPreviewSelection();
      } else {
        setConnectError(data.error || 'نەتوانرا فایلی ئێکسڵەکە بخوێندرێتەوە.');
      }
    } catch (err: any) {
      setConnectError('هەڵە لە ناردنی فایلی ئێکسڵ: ' + (err.message || ''));
    } finally {
      setConnecting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConnecting(true);
    setConnectError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const sheetsPayload = wb.SheetNames.map((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: false });
          return { sheetName, rawData };
        });
        const fallbackTitle = file.name.replace(/\.[^/.]+$/, '');

        if (sheetsPayload.length > 1) {
          // Preview all Excel tabs so the user can choose all or specific tabs!
          setPreviewedTabs(
            sheetsPayload.map((sp, idx) => ({
              sheetName: sp.sheetName,
              tabIndex: idx,
              itemCount: Math.max(0, sp.rawData.length - 1),
              totalUnits: 0,
              rawData: sp.rawData,
            }))
          );
          setSelectedPreviewTabNames(sheetsPayload.map((sp) => sp.sheetName));
          setPendingExcelTitle(fallbackTitle);
          if (!inputSessionTitle.trim()) setInputSessionTitle(fallbackTitle);
          setConnecting(false);
          return;
        }

        await submitExcelSheetsPackage(sheetsPayload, fallbackTitle);
      } catch (err: any) {
        setConnectError('هەڵە لە خوێندنەوەی فایلی ئێکسڵ: ' + (err.message || ''));
        setConnecting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 2c. Import via Direct Copy & Paste
  const handleDirectPasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRawPaste.trim()) return;

    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse_raw',
          rawText: inputRawPaste.trim(),
          mode: inputMode,
          title: inputSessionTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        await finalizeImportedSession(data.session);
      } else {
        setConnectError(data.error || 'نەتوانرا داتاکە لۆد بکرێت.');
      }
    } catch {
      setConnectError('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setConnecting(false);
    }
  };

  // 3a. Debounced Sequential Google Sheet Push (Prevents race conditions on rapid scans/taps)
  const flushGoogleWebhookPush = useCallback(async (sessionToPush: SheetsAuditSession) => {
    const webhook = sessionToPush.webhookUrl?.trim() || '';
    if (!webhook || !/^https:\/\/script\.google(usercontent)?\.com\//.test(webhook)) {
      setPendingGoogleSyncIds((prev) => ({ ...prev, [sessionToPush.id]: false }));
      return;
    }

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_to_google',
          webhookUrl: webhook,
          session: sessionToPush,
        }),
      });
      const data = await res.json();
      setPendingGoogleSyncIds((prev) => ({ ...prev, [sessionToPush.id]: false }));
      if (data.success) {
        const syncedIso = data.lastGoogleSyncedAt || new Date().toISOString();
        setWebhookWarningMsg(null);
        setCurrentSession((cur) =>
          cur && cur.id === sessionToPush.id
            ? { ...cur, lastGoogleSyncedAt: syncedIso, lastSyncDirection: 'push' }
            : cur
        );
        setSessions((prev) => {
          const next = prev.map((s) =>
            s.id === sessionToPush.id ? { ...s, lastGoogleSyncedAt: syncedIso, lastSyncDirection: 'push' as const } : s
          );
          saveLocalWarehouseSessions(next);
          return next;
        });
        const tStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSavedNotice(`خەزنکرا لە سیستەم + Google Sheet ✅ • ${tStr}`);
      } else if (data.error) {
        setWebhookWarningMsg(data.error);
      }
    } catch {
      setPendingGoogleSyncIds((prev) => ({ ...prev, [sessionToPush.id]: true }));
    }
  }, []);

  // 3. Save / Auto-sync session to Local Storage, Cloud (Item-Merged) & Debounced Google Webhook
  const persistSession = useCallback(async (sessionToSave: SheetsAuditSession, isManualSync = false) => {
    if (isManualSync) setSyncingGoogle(true);
    else setSaving(true);

    const mutationSeq = ++localMutationSeqRef.current;
    lastLocalMutationAtRef.current = Date.now();
    latestSessionForPushRef.current[sessionToSave.id] = sessionToSave;

    const hasWebhook = Boolean(
      sessionToSave.webhookUrl &&
        /^https:\/\/script\.google(usercontent)?\.com\//.test(sessionToSave.webhookUrl.trim())
    );
    if (hasWebhook) {
      setPendingGoogleSyncIds((prev) => ({ ...prev, [sessionToSave.id]: true }));
    }

    // 1. Immediately persist locally (Guaranteed zero loss)
    setSessions(prev => {
      const exists = prev.some(s => s.id === sessionToSave.id);
      const next = exists 
        ? prev.map(s => s.id === sessionToSave.id ? sessionToSave : s) 
        : [sessionToSave, ...prev];
      saveLocalWarehouseSessions(next);
      return next;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, sessionToSave.id);
    }

    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSavedNotice(`خەزنکراوە لە سیستەمدا • ${timeStr}`);

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_session',
          session: sessionToSave,
          skipWebhookPush: !isManualSync,
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        lastLocalMutationAtRef.current = Date.now();
        const latestFromServer: SheetsAuditSession = data.session;
        if (localMutationSeqRef.current === mutationSeq) {
          latestSessionForPushRef.current[latestFromServer.id] = latestFromServer;
          setCurrentSession(latestFromServer);
          setSessions(prev => {
            const exists = prev.some(s => s.id === latestFromServer.id);
            const next = exists
              ? prev.map(s => s.id === latestFromServer.id ? latestFromServer : s)
              : [latestFromServer, ...prev];
            saveLocalWarehouseSessions(next);
            return next;
          });
        }

        if (isManualSync) {
          if (googleSyncTimersRef.current[latestFromServer.id]) {
            clearTimeout(googleSyncTimersRef.current[latestFromServer.id]);
            delete googleSyncTimersRef.current[latestFromServer.id];
          }
          if (data.webhookSyncResult?.ok) {
            setPendingGoogleSyncIds((prev) => ({ ...prev, [latestFromServer.id]: false }));
            setWebhookWarningMsg(null);
            setLastSavedNotice(`خەزنکرا لە سیستەم + Google Sheet ✅ • ${timeStr}`);
          } else if (data.webhookSyncResult && !data.webhookSyncResult.ok) {
            setWebhookWarningMsg(
              data.webhookSyncResult.error ||
                'داتاکان لە سیستەم خەزنکران، بەڵام نەتوانرا ڕاستەوخۆ بنێردرێن بۆ ناو Google Sheet.'
            );
          }
          setSyncSuccess(true);
          setTimeout(() => setSyncSuccess(false), 3000);
          triggerHaptic('success');
        } else if (hasWebhook) {
          // Schedule crisp trailing 700ms debounced push so rapid +1/+5 taps collapse into ONE clean write!
          if (googleSyncTimersRef.current[latestFromServer.id]) {
            clearTimeout(googleSyncTimersRef.current[latestFromServer.id]);
          }
          const targetId = latestFromServer.id;
          googleSyncTimersRef.current[targetId] = setTimeout(() => {
            const latestSnap = latestSessionForPushRef.current[targetId] || latestFromServer;
            flushGoogleWebhookPush(latestSnap);
          }, 700);
        }
      } else {
        setWebhookWarningMsg(data.error || 'خەزنکردن لە سێرڤەر سەرکەوتوو نەبوو — تکایە دووبارە هەوڵبدەرەوە.');
      }
    } catch {
      if (isManualSync) {
        setWebhookWarningMsg('پەیوەندی بە سێرڤەر پچڕا — گۆڕانکارییەکان کاتی لەم ئامێرە پارێزران.');
      }
    } finally {
      setSaving(false);
      setSyncingGoogle(false);
    }
  }, [flushGoogleWebhookPush]);

  // 4. Update an Item Quantity
  const handleUpdateItemQty = (itemId: string, delta: number) => {
    if (!currentSession) return;
    triggerHaptic('light');

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        const nextQty = Math.max(0, (item.checkedQty || 0) + delta);
        const variance = nextQty - item.expectedQty;
        const pcs = item.pcsPerCarton || 1;
        const nextCartons = Math.floor(nextQty / pcs);
        const scannedCartonNumbers = Array.from({ length: nextCartons }, (_, i) => i + 1);
        
        let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
        if (nextQty > 0) {
          if (variance === 0) auditStatus = 'verified';
          else if (variance < 0) auditStatus = 'deficit';
          else if (variance > 0) auditStatus = 'excess';
        }
        if (item.condition === 'Damaged') auditStatus = 'damaged';

        return {
          ...item,
          checkedQty: nextQty,
          checkedCartons: nextCartons,
          scannedCartonNumbers,
          variance,
          auditStatus,
          auditedBy: currentSession.auditedBy || 'Admin',
          lastAuditedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  // Set Direct Quantity
  const handleSetDirectQty = (itemId: string, newQtyStr: string) => {
    if (!currentSession) return;
    const qty = Math.max(0, parseFloat(newQtyStr) || 0);

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        const variance = qty - item.expectedQty;
        const pcs = item.pcsPerCarton || 1;
        const nextCartons = Math.floor(qty / pcs);
        const scannedCartonNumbers = Array.from({ length: nextCartons }, (_, i) => i + 1);

        let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
        if (qty > 0) {
          if (variance === 0) auditStatus = 'verified';
          else if (variance < 0) auditStatus = 'deficit';
          else if (variance > 0) auditStatus = 'excess';
        }
        if (item.condition === 'Damaged') auditStatus = 'damaged';

        return {
          ...item,
          checkedQty: qty,
          checkedCartons: nextCartons,
          scannedCartonNumbers,
          variance,
          auditStatus,
          auditedBy: currentSession.auditedBy || 'Admin',
          lastAuditedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  // Change Item Condition (Damaged / Need Wrapped / Wrapped / Packaged / Normal)
  const handleUpdateCondition = (itemId: string, condition: SheetsAuditItem['condition']) => {
    if (!currentSession) return;
    triggerHaptic('light');

    const needsIssueQty = condition === 'Damaged' || condition === 'Need Wrapped' || condition === 'Wrapped';

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        let auditStatus = item.auditStatus;
        if (condition === 'Damaged') auditStatus = 'damaged';
        else if (item.checkedQty > 0) {
          auditStatus = item.variance === 0 ? 'verified' : item.variance < 0 ? 'deficit' : 'excess';
        }
        const nextIssueQty = needsIssueQty ? Math.max(1, item.issueQty || 1) : undefined;
        return { 
          ...item, 
          condition,
          issueQty: nextIssueQty,
          auditStatus, 
          auditedBy: currentSession.auditedBy || 'Admin',
          lastAuditedAt: new Date().toISOString() 
        };
      }
      return item;
    });

    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  // Change Exact Broken / Damaged / Need-Wrapped Unit Count (چەنێکی شکاو یان تەغلیفە)
  const handleUpdateIssueQty = (itemId: string, rawQty: number) => {
    const cur = currentSessionRef.current;
    if (!cur) return;
    const cleanQty = Math.max(0, Math.min(9999, Math.round(Number.isFinite(rawQty) ? rawQty : 0)));

    const updatedItems = cur.items.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          issueQty: cleanQty,
          auditedBy: cur.auditedBy || 'Admin',
          lastAuditedAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const updatedSession = { ...cur, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  const handleNoteEditingChange = useCallback((itemId: string, isEditing: boolean) => {
    if (isEditing) {
      activeNoteEditingIdsRef.current.add(itemId);
    } else {
      activeNoteEditingIdsRef.current.delete(itemId);
    }
  }, []);

  // Commit Item Notes ONLY when user finishes typing (blur / "تەواو ✓" button)
  const handleUpdateNotes = useCallback((itemId: string, notes: string) => {
    const cur = currentSessionRef.current;
    if (!cur) return;
    const updatedItems = cur.items.map(item => {
      if (item.id === itemId) return { 
        ...item, 
        notes, 
        auditedBy: cur.auditedBy || 'Admin',
        lastAuditedAt: new Date().toISOString() 
      };
      return item;
    });
    const updatedSession = { ...cur, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  }, [persistSession]);

  // 5. Barcode Scanner Input Handling
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !barcodeInput.trim()) return;

    const code = barcodeInput.trim().toLowerCase();
    const matched = currentSession.items.find(
      i => i.model.toLowerCase() === code || 
           i.name.toLowerCase().includes(code) ||
           (i.rackLocation && i.rackLocation.toLowerCase() === code)
    );

    if (matched) {
      handleUpdateItemQty(matched.id, 1);
      playKurdishScanAudio(matched.model, matched.pcsPerCarton || 1).catch(() => {});
      setScannedAlert({
        message: `کاڵا دۆزرایەوە: ${matched.model} - ژمارەی چێککراو بوو بە ${matched.checkedQty + 1}`,
        type: 'success',
      });
      triggerHaptic('success');
    } else {
      setScannedAlert({
        message: `ئەم کۆدە (${barcodeInput}) لەناو خشتەی ئەم بارە / جەردەدا نەدۆزرایەوە!`,
        type: 'warn',
      });
      triggerHaptic('error');
    }

    setBarcodeInput('');
    setTimeout(() => setScannedAlert(null), 3500);
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  // 6. Execute Section (Tab) OR Whole Package Deletion With Explicit Google Sheet Choice
  const handleExecuteDeleteDialog = async (googleSheetAction: GoogleSheetDeleteAction) => {
    if (!deleteDialog) return;
    setDeletingAction(true);
    lastLocalMutationAtRef.current = Date.now();

    try {
      if (deleteDialog.kind === 'tab') {
        const target = deleteDialog.session;
        saveLocalDeletedIds([target.id, ...getLocalDeletedIds()]);
        const remaining = sessions.filter((s) => s.id !== target.id);
        setSessions(remaining);
        saveLocalWarehouseSessions(remaining);

        if (currentSession?.id === target.id) {
          const nextMatch =
            remaining.find((s) => (s.packageId || s.id) === (target.packageId || target.id)) ||
            remaining.find((s) => (s.mode || 'shipment_receiving') === warehouseSection) ||
            remaining[0] ||
            null;
          setCurrentSession(nextMatch);
          if (typeof window !== 'undefined') {
            if (nextMatch) localStorage.setItem(ACTIVE_SESSION_ID_KEY, nextMatch.id);
            else localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
          }
        }

        const res = await fetch('/api/warehouse/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_session',
            sessionId: target.id,
            googleSheetAction,
            webhookUrl: target.webhookUrl,
            targetSheetName: target.sheetName,
            targetSheetGid: target.tabGid,
          }),
        });
        const data = await res.json();
        if (Array.isArray(data?.deletedIds)) saveLocalDeletedIds(data.deletedIds);

        if (googleSheetAction !== 'none' && data?.googleResult && !data.googleResult.ok) {
          setWebhookWarningMsg(
            `بەشەکە لە سیستەم سڕدرایەوە، بەڵام گۆگڵ شیت گەڕاندیەوە: ${data.googleResult.error || 'هەڵەیەک ڕوویدا'}`
          );
        } else if (googleSheetAction !== 'none') {
          setLastSavedNotice(`بەشی «${target.sheetName || target.title}» و هەموو شوێنەوارەکانی لە گۆگڵ شیت پاککرانەوە ✅`);
        } else {
          setLastSavedNotice(`بەشی «${target.sheetName || target.title}» تەنها لە سیستەم سڕدرایەوە`);
        }
      } else {
        const { packageId, packageTitle, tabs } = deleteDialog;
        const tabIds = tabs.map((t) => t.id);
        const idSet = new Set(tabIds);
        saveLocalDeletedIds([...tabIds, ...getLocalDeletedIds()]);
        const remaining = sessions.filter((s) => !idSet.has(s.id));
        setSessions(remaining);
        saveLocalWarehouseSessions(remaining);

        if (currentSession && idSet.has(currentSession.id)) {
          const nextMatch =
            remaining.find((s) => (s.mode || 'shipment_receiving') === warehouseSection) || remaining[0] || null;
          setCurrentSession(nextMatch);
          if (typeof window !== 'undefined') {
            if (nextMatch) localStorage.setItem(ACTIVE_SESSION_ID_KEY, nextMatch.id);
            else localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
          }
        }

        const res = await fetch('/api/warehouse/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_package',
            packageId,
            sessionIds: tabIds,
            googleSheetAction,
            tabs: tabs.map((t) => ({
              webhookUrl: t.webhookUrl,
              sheetName: t.sheetName,
              title: t.title,
              tabGid: t.tabGid,
            })),
          }),
        });
        const data = await res.json();
        if (Array.isArray(data?.deletedIds)) saveLocalDeletedIds(data.deletedIds);

        setLastSavedNotice(
          googleSheetAction === 'none'
            ? `باکێچی «${packageTitle}» تەنها لە سیستەم سڕدرایەوە (گۆگڵ شیت پارێزراو ماوەتەوە)`
            : `باکێچی «${packageTitle}» و هەموو داتای پەیوەندیدار بە پرۆگرام لە Google Sheet پاککرانەوە ✅`
        );
      }
      triggerHaptic('success');
      setDeleteDialog(null);
    } catch {
      setDeleteDialog(null);
    } finally {
      setDeletingAction(false);
    }
  };

  // 6b. Open Wipe ALL Modal (Offers choice between System Only vs Stripping All Program Data from Google Sheets)
  const handleWipeAllSessions = () => {
    setShowWipeAllModal(true);
  };

  const handleExecuteWipeAll = async (googleSheetAction: GoogleSheetDeleteAction) => {
    setWipingAll(true);
    lastLocalMutationAtRef.current = Date.now();

    const localTargets = sessions.map((s) => ({
      webhookUrl: s.webhookUrl,
      sheetName: s.sheetName,
      title: s.title,
      tabGid: s.tabGid,
    }));

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'wipe_all_sessions',
          googleSheetAction,
          localTargets,
        }),
      });
      const data = await res.json();

      const nowIso = data?.resetBefore || new Date().toISOString();
      saveLocalResetBefore(nowIso);
      const allIds = sessions.map((s) => s.id);
      if (allIds.length > 0) {
        saveLocalDeletedIds([...allIds, ...getLocalDeletedIds()]);
      }

      setSessions([]);
      setCurrentSession(null);
      saveLocalWarehouseSessions([]);
      setPushSuccessMsg(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
      }

      const failedSheets = Array.isArray(data?.googleResults)
        ? data.googleResults.filter((g: any) => !g.ok)
        : [];
      if (googleSheetAction !== 'none' && failedSheets.length > 0) {
        setWebhookWarningMsg(
          `هەموو داتای پرۆگرام سفر بوونەوە، بەڵام ${failedSheets.length} بەشی Google Sheet وەڵامی نەدایەوە (${failedSheets[0]?.error || ''})`
        );
      } else {
        setWebhookWarningMsg(null);
      }

      setLastSavedNotice(
        googleSheetAction === 'none'
          ? 'هەموو شیتەکان تەنها لە پرۆگرام سفر کرانەوە 🧹'
          : 'هەموو داتای پرۆگرام لە سیستەم و لە ناو هەموو گۆگڵ شیتەکان بە تەواوی پاککرانەوە ✅🧹'
      );
      triggerHaptic('success');
      setShowWipeAllModal(false);
    } catch {
      setShowWipeAllModal(false);
    } finally {
      setWipingAll(false);
    }
  };

  // 6c. Smart Sync Control Center: Inspect & Reconcile (Program <-> Google Sheet)
  const handleInspectGoogleDiff = async () => {
    if (!currentSession) return;
    setShowSyncControlModal(true);
    setSyncInspecting(true);
    setSyncInspectionResult(null);
    setPushErrorMsg(null);

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_with_google',
          mode: 'inspect',
          session: currentSession,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncInspectionResult({
          tabMatched: data.tabMatched || currentSession.sheetName || currentSession.title,
          summary: data.summary,
          diffs: data.diffs || [],
        });
      } else {
        setPushErrorMsg(data.error || 'نەتوانرا جیاوازییەکان بپشکنرێن.');
      }
    } catch (err: any) {
      setPushErrorMsg(err?.message || 'هەڵەی پەیوەندی لە پشکنینی هاوکاتکردندا.');
    } finally {
      setSyncInspecting(false);
    }
  };

  const handleReconcileWithGoogle = async (
    mode: 'smart_merge' | 'push_program_to_google' | 'pull_google_overwrite'
  ) => {
    if (!currentSession) return;
    setSyncApplying(true);
    setPushErrorMsg(null);
    lastLocalMutationAtRef.current = Date.now();

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reconcile_with_google',
          mode,
          session: currentSession,
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        const nextSess: SheetsAuditSession = data.session;
        setCurrentSession(nextSess);
        setSessions((prev) => {
          const next = prev.map((s) => (s.id === nextSess.id ? nextSess : s));
          saveLocalWarehouseSessions(next);
          return next;
        });
        setPendingGoogleSyncIds((prev) => ({ ...prev, [nextSess.id]: false }));
        setWebhookWarningMsg(null);

        if (mode === 'smart_merge') {
          setPushSuccessMsg('✅ تێکەڵکردنی زیرەکانە ئەنجامدرا: داتای شیت نوێکرایەوە + هەموو سکانەکانی پرۆگرام پارێزران!');
        } else if (mode === 'push_program_to_google') {
          setPushSuccessMsg('✅ تەواوی داتاکانی پرۆگرام ڕاستەوخۆ بۆ تەبی ناو Google Sheet نێردران!');
        } else {
          setPushSuccessMsg('✅ لیستەکە بە تەواوی لە Google Sheetـەوە نوێکرایەوە!');
        }
        setShowSyncControlModal(false);
        setTimeout(() => setPushSuccessMsg(null), 6500);
        triggerHaptic('success');
      } else {
        setPushErrorMsg(data.error || 'نەتوانرا هاوکاتکردنەکە تەواو بکرێت.');
      }
    } catch (err: any) {
      setPushErrorMsg(err?.message || 'هەڵە لە کاتی هاوکاتکردن.');
    } finally {
      setSyncApplying(false);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (!currentSession) return [];

    return currentSession.items.filter(item => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = 
        !q ||
        item.model.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.rackLocation && item.rackLocation.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      const matchesStatus = 
        statusFilter === 'all' || item.auditStatus === statusFilter;

      const matchesCondition = 
        conditionFilter === 'all' || item.condition === conditionFilter;

      return matchesSearch && matchesStatus && matchesCondition;
    });
  }, [currentSession, searchTerm, statusFilter, conditionFilter]);

  // Overall Calculation for Current Session
  const sessionKPIs = useMemo(() => {
    if (!currentSession) {
      return {
        totalItems: 0,
        expectedUnits: 0,
        auditedUnits: 0,
        progressPercent: 0,
        matchedCount: 0,
        discrepantCount: 0,
        damagedCount: 0,
        damagedUnits: 0,
        repackUnits: 0,
        pendingCount: 0,
      };
    }

    const items = currentSession.items;
    let expected = 0;
    let audited = 0;
    let matched = 0;
    let discrepant = 0;
    let damaged = 0;
    let damagedUnits = 0;
    let repackUnits = 0;
    let pending = 0;

    items.forEach(i => {
      expected += i.expectedQty || 0;
      audited += i.checkedQty || 0;

      if (i.condition === 'Damaged' || i.auditStatus === 'damaged') {
        damaged++;
        damagedUnits += i.issueQty || 1;
      } else {
        if (i.condition === 'Need Wrapped' || i.condition === 'Wrapped') {
          repackUnits += i.issueQty || 1;
        }
        if (i.checkedQty === 0) pending++;
        else if (i.variance === 0) matched++;
        else discrepant++;
      }
    });

    const progressPercent = items.length > 0 
      ? Math.round(((items.length - pending) / items.length) * 100) 
      : 0;

    return {
      totalItems: items.length,
      expectedUnits: expected,
      auditedUnits: audited,
      progressPercent,
      matchedCount: matched,
      discrepantCount: discrepant,
      damagedCount: damaged,
      damagedUnits,
      repackUnits,
      pendingCount: pending,
    };
  }, [currentSession]);

  // Export to Excel (All 15 Detailed Audit & Change Tracking Columns)
  const handleExportExcel = () => {
    if (!currentSession || currentSession.items.length === 0) {
      alert('هیچ کاڵایەک نییە بۆ هەناردەکردن.');
      return;
    }

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

    const rows = currentSession.items.map(i => {
      const totalCtn = i.cartonCount || (i.pcsPerCarton && i.expectedQty ? Math.ceil(i.expectedQty / i.pcsPerCarton) : i.expectedQty) || 1;
      const checkedCtn = i.checkedCartons ?? (i.scannedCartonNumbers?.length ?? (i.pcsPerCarton ? Math.floor(i.checkedQty / i.pcsPerCarton) : i.checkedQty));
      const scannedBoxesStr = Array.isArray(i.scannedCartonNumbers) && i.scannedCartonNumbers.length > 0 
        ? i.scannedCartonNumbers.join(', ') 
        : checkedCtn > 0 ? `1-${checkedCtn}` : '-';
      
      const issueSuffix = typeof i.issueQty === 'number' && i.issueQty > 0 ? ` (${i.issueQty} دانە)` : '';
      let statusKurdish = 'چاوەڕوان';
      if (i.auditStatus === 'verified') statusKurdish = '✅ هاوتا و تەواو';
      else if (i.auditStatus === 'deficit') statusKurdish = `⚠️ کەمی هەیە (${i.variance})`;
      else if (i.auditStatus === 'excess') statusKurdish = `➕ زیادەیە (+${i.variance})`;
      else if (i.auditStatus === 'damaged') statusKurdish = `❌ شکاو / زیانلێکەوتوو${issueSuffix}`;

      let conditionKurdish = 'پاکەتکراو';
      if (i.condition === 'Wrapped') conditionKurdish = `لەفکراو / تەغلیف${issueSuffix}`;
      else if (i.condition === 'Damaged') conditionKurdish = `تێکچوو/شکاو${issueSuffix}`;
      else if (i.condition === 'Need Wrapped') conditionKurdish = `پێویستی بە لەفە / تەغلیف${issueSuffix}`;
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
        i.auditedBy || currentSession.auditedBy || 'Admin',
        lastModifiedStr,
        i.notes || ''
      ];
    });

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentSession.mode === 'shipment_receiving' ? 'پشکنینی باری نوێ' : 'جەردی کۆگا');
    XLSX.writeFile(wb, `Ashley_${currentSession.mode === 'shipment_receiving' ? 'Bar-Dagirtn' : 'Jard'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 💾 دوگمەی ١: خەزنکردنی ڕاستەوخۆ لە سیستەم (Supabase)
  const handleSaveToSupabase = async () => {
    if (!currentSession) return;
    triggerHaptic('success');
    await persistSession(currentSession, false);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSupabaseSavedTime(timeStr);
    setSupabaseSaveSuccess(true);
    setTimeout(() => setSupabaseSaveSuccess(false), 5000);
  };

  // 🔄 دوگمەی ٢: گواستنەوە بۆ شیت (زیادکردنی کۆڵۆمەکان)
  const handlePushToGoogleSheet = async () => {
    if (!currentSession) return;

    const webhook = currentSession.webhookUrl?.trim() || '';
    if (!webhook || !webhook.startsWith('http')) {
      setTempWebhookUrl('');
      setPushErrorMsg(null);
      setShowGooglePushModal(true);
      return;
    }

    if (webhook.includes('docs.google.com/spreadsheets')) {
      setTempWebhookUrl(webhook);
      setPushErrorMsg('ئەمە لینکی Google Sheetەکە خۆیەتی نەک Webhook URL! تکایە بەستەری Apps Script (https://script.google.com/macros/s/.../exec) لێرە دابنێ.');
      setShowGooglePushModal(true);
      return;
    }

    setIsPushingGoogle(true);
    setPushErrorMsg(null);
    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_to_google',
          webhookUrl: webhook,
          session: currentSession,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        setWebhookWarningMsg(null);
        const rowsCount = data.updatedRows ?? currentSession.items.length;
        setPushSuccessMsg(`✅ ${rowsCount} ڕیز و کۆڵۆمەکانی پشکنین بە سەرکەوتوویی ڕاستەوخۆ لە Google Sheet نوێکرانەوە!`);
        setTimeout(() => setPushSuccessMsg(null), 7000);
        return;
      } else {
        const errText = data.error || 'هەڵە لە پەیوەندیکردن بە Google Apps Script Webhook.';
        setWebhookWarningMsg(errText);
        setPushErrorMsg(errText);
        setTempWebhookUrl(webhook);
        setShowGooglePushModal(true);
      }
    } catch (err: any) {
      const errText = err.message || 'هەڵەی پەیوەندی لەگەڵ Webhook.';
      setWebhookWarningMsg(errText);
      setPushErrorMsg(errText);
      setTempWebhookUrl(webhook);
      setShowGooglePushModal(true);
    } finally {
      setIsPushingGoogle(false);
    }
  };

  // Save Webhook URL & Push directly to Google Sheet
  const handleSaveWebhookAndPush = async () => {
    if (!currentSession || !tempWebhookUrl.trim()) return;
    const cleanedWebhook = tempWebhookUrl.trim();
    if (cleanedWebhook.includes('docs.google.com/spreadsheets')) {
      setPushErrorMsg('ئەمە لینکی خوێندنەوەی Google Sheetە! بۆ نووسینی ڕاستەوخۆ پێویستە لینکی Deployی Apps Script دابنێیت کە بە https://script.google.com/macros/s/ دەستپێدەکات.');
      return;
    }
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cleanedWebhook)) {
      setPushErrorMsg('لینکەکە دەبێت بەستەری دروستی Google Apps Script Web App بێت (https://script.google.com/macros/s/.../exec).');
      return;
    }

    setIsPushingGoogle(true);
    setPushErrorMsg(null);
    lastLocalMutationAtRef.current = Date.now();

    const updated = { ...currentSession, webhookUrl: cleanedWebhook };
    setCurrentSession(updated);

    // Propagate Webhook URL across ALL tabs of the same spreadsheet Package!
    setSessions((prev) => {
      const next = prev.map((s) =>
        (updated.packageId && s.packageId === updated.packageId) || s.id === updated.id
          ? { ...s, webhookUrl: cleanedWebhook }
          : s
      );
      saveLocalWarehouseSessions(next);
      return next;
    });

    try {
      await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_package_webhook',
          packageId: updated.packageId,
          sessionId: updated.id,
          webhookUrl: cleanedWebhook,
        }),
      });
    } catch {}

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_to_google',
          webhookUrl: cleanedWebhook,
          session: updated,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        setWebhookWarningMsg(null);
        const rowsCount = data.updatedRows ?? updated.items.length;
        const tabLabel = data.targetSheetName || updated.sheetName || updated.title;
        setPushSuccessMsg(`✅ پیرۆزە! باکێچەکە بەستراوە و تەنها بەشی «${tabLabel}» (${rowsCount} ڕیز) لە Google Sheet نوێکرایەوە!`);
        setShowGooglePushModal(false);
        setTimeout(() => setPushSuccessMsg(null), 7000);
      } else {
        const errText = data.error || 'نەتوانرا پەیوەندی بە بەستەری Apps Script بکرێت. دڵنیابە لە بەشی Deploy جۆرەکەی Web appە و Who has access کراوەتە Anyone.';
        setWebhookWarningMsg(errText);
        setPushErrorMsg(errText);
      }
    } catch (err: any) {
      const errText = err.message || 'هەڵە لە پەیوەندی بە Webhook.';
      setWebhookWarningMsg(errText);
      setPushErrorMsg(errText);
    } finally {
      setIsPushingGoogle(false);
    }
  };

  return (
    <div className="space-y-4 text-slate-900 font-sans" dir="rtl">
      
      {/* 📱 Mobile Portal Quick Switcher (When opened inside Mobile App) */}
      {(isMobileEmbedded || onBackToMobileApp || onSwitchPortal) && (
        <div className="bg-slate-900 text-white rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-md border border-slate-800">
          <div className="flex items-center gap-2">
            {onBackToMobileApp && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onBackToMobileApp();
                }}
                className="h-8 sm:h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span>گەڕانەوە بۆ دەوام</span>
              </button>
            )}
            <span className="text-xs font-bold text-slate-300 hidden xs:inline">
              📦 پشکنینی باری کۆگا و کانتینەر
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onSwitchPortal && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onSwitchPortal('attendance');
                  }}
                  className="h-8 px-2.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="چوون بۆ تۆمارکردنی دەوام"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>دەوام</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onSwitchPortal('feedback');
                  }}
                  className="h-8 px-2.5 rounded-xl bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="چوون بۆ فیدباک"
                >
                  <MessageSquareHeart className="w-3.5 h-3.5" />
                  <span>فیدباک</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚛 📋 1. PRIMARY DUAL SECTIONS (دوو بەشە سەرەکییەکەی کۆگا: بار داگرتن & جەرد) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        
        {/* Title & Status Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  بەشی کۆگا و پشکنینی خشتەکان
                </h2>
                {lastSavedNotice && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{lastSavedNotice}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                بێ پێویستی بە لۆگ ئین • خەزنکردنی هەمیشەیی شیتەکان لە سیستەم
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Add Sheet Button (Hidden on Mobile to ensure operational purity) */}
            {!isMobileOperational ? (
              <button
                type="button"
                onClick={() => {
                  setInputMode(warehouseSection);
                  setShowConnectModal(true);
                }}
                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-blue-500/15 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {warehouseSection === 'shipment_receiving' ? '+ داخڵکردنی باری نوێ' : '+ داخڵکردنی جەردی نوێ'}
                </span>
              </button>
            ) : (
              <div className="h-10 px-3.5 rounded-xl bg-blue-50/90 border border-blue-200/90 text-blue-900 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                <Boxes className="w-4 h-4 text-blue-600" />
                <span>دۆخی مۆبایل: تۆمارکردن، ژماردن و سکان</span>
              </div>
            )}

            {/* Switch Sessions Button */}
            <button
              type="button"
              onClick={() => setShowSessionsModal(true)}
              className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              title="بینینی هەموو شیتە خەزنکراوەکان"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>هەموو شیتەکان ({sessions.length})</span>
            </button>

            {/* Full Reset Button (Desktop Admin Only) */}
            {!isMobileOperational && sessions.length > 0 && (
              <button
                type="button"
                onClick={handleWipeAllSessions}
                className="h-10 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="سڕینەوە و سفرکردنەوەی هەموو شیتەکان لە سیستەم و مۆبایلەکان"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>سفرکردنەوەی هەمووی</span>
              </button>
            )}
          </div>
        </div>

        {/* 🚛 📋 DUAL MODE SECTIONS TOGGLE (Large & Clear) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Section 1: بار داگرتن */}
          <button
            type="button"
            onClick={() => handleSwitchWarehouseSection('shipment_receiving')}
            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer relative overflow-hidden active:scale-[0.99] ${
              warehouseSection === 'shipment_receiving'
                ? 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                  warehouseSection === 'shipment_receiving'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      ١. بەشی بار داگرتن
                    </h3>
                    {warehouseSection === 'shipment_receiving' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                        بەشی چالاک
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    داگرتنی کانتینەر، ژماردنی پاکەت بە کامێرا و باڕکۆد
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono font-black text-slate-700 shrink-0">
                {sessions.filter(s => (s.mode || 'shipment_receiving') === 'shipment_receiving').length} شیت
              </span>
            </div>
          </button>

          {/* Section 2: تۆمارکردنی جەرد */}
          <button
            type="button"
            onClick={() => handleSwitchWarehouseSection('inventory_stocktake')}
            className={`p-4 rounded-2xl border text-right transition-all cursor-pointer relative overflow-hidden active:scale-[0.99] ${
              warehouseSection === 'inventory_stocktake'
                ? 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/5 border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                  warehouseSection === 'inventory_stocktake'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}>
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      ٢. بەشی تۆمارکردنی جەرد
                    </h3>
                    {warehouseSection === 'inventory_stocktake' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black">
                        بەشی چالاک
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    جەردی دەوری کۆگا، ڕەفەکان، دۆخی پاکەت، جیاوازی کەمی و زیادی
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-mono font-black text-slate-700 shrink-0">
                {sessions.filter(s => s.mode === 'inventory_stocktake').length} شیت
              </span>
            </div>
          </button>
        </div>

        {/* 📁 SAVED PACKAGES & SECTION TABS SHELF (شیت و باکێچە خەزنکراوەکانی سیستەم) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600" />
              <span>
                باکێچ و بەشەکانی ئەم فایلە ({groupedPackages.length} باکێچ • {sectionSessions.length} بەش):
              </span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {sectionSessions.length >= 6 && (
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                  <input
                    type="text"
                    value={packageTabFilter}
                    onChange={(e) => setPackageTabFilter(e.target.value)}
                    placeholder="گەڕان لە تابەکان..."
                    className="h-7 pr-7 pl-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 w-36 sm:w-44"
                  />
                </div>
              )}

              {currentSession && (
                <button
                  type="button"
                  onClick={() => {
                    const siblingTabs = sectionSessions.filter(
                      (s) => (s.packageId || s.id) === (currentSession.packageId || currentSession.id)
                    );
                    openPackageCodeBriefing(
                      siblingTabs.length > 0 ? siblingTabs : [currentSession],
                      currentSession.packageTitle || currentSession.title
                    );
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer active:scale-95"
                  title="بەرچاوڕوونی زیرەکی کۆدەکان (پێشگر، پاشگر، دووبارە)"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>بەرچاوڕوونی کۆدەکان</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => loadSessions(true)}
                disabled={refreshingCloud}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                title="نوێکردنەوەی لیستی باکێچەکان لە Supabase"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingCloud ? 'animate-spin' : ''}`} />
                <span>🔄 نوێکردنەوە</span>
              </button>
            </div>
          </div>

          {groupedPackages.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span>هیچ باکێچ یان شیتێک لە سیستەمدا خەزن نەکراوە بۆ ئەم بەشە.</span>
              {!isMobileOperational ? (
                <button
                  type="button"
                  onClick={() => {
                    resetPreviewSelection();
                    setInputMode(warehouseSection);
                    setShowConnectModal(true);
                  }}
                  className="text-blue-600 hover:underline font-bold"
                >
                  + داخڵکردنی باکێچی گۆگڵ شیت
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  (شیتەکان لە ئەدمین پانێڵەوە لە کۆمپیوتەر زیاد دەکرێن، و لە مۆبایل کار لەسەر ژماردنیان دەکەیت)
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {groupedPackages.map((pkg) => {
                const pkgPercent = pkg.totalUnits > 0 ? Math.round((pkg.auditedUnits / pkg.totalUnits) * 100) : 0;
                const isPkgActive = pkg.tabs.some((t) => t.id === currentSession?.id);
                const pkgWebhook = pkg.tabs.find((t) => t.webhookUrl)?.webhookUrl || '';
                const pkgSheetSource = pkg.googleSheetUrl || pkgWebhook;
                const tabQ = packageTabFilter.trim().toLowerCase();
                const visibleTabs = tabQ
                  ? pkg.tabs.filter(
                      (s) =>
                        (s.sheetName || s.title).toLowerCase().includes(tabQ) ||
                        (pkg.packageTitle || '').toLowerCase().includes(tabQ)
                    )
                  : pkg.tabs;

                if (tabQ && visibleTabs.length === 0) return null;

                return (
                  <div
                    key={pkg.packageId}
                    className={`rounded-2xl border p-3 transition-all space-y-2.5 ${
                      isPkgActive
                        ? 'bg-slate-50/90 border-blue-200 shadow-xs'
                        : 'bg-white border-slate-200/90'
                    }`}
                  >
                    {/* Package Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 truncate max-w-[220px]">
                              {pkg.packageTitle}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-800 text-[10px] font-black font-mono">
                              {pkg.tabs.length} تاب / بەش
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold">
                              {pkg.auditedUnits} / {pkg.totalUnits} ({pkgPercent}%)
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isMobileOperational && (
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {pkgSheetSource && (
                            <button
                              type="button"
                              onClick={() => {
                                resetPreviewSelection();
                                setImportTab('url');
                                setInputMode(warehouseSection);
                                setInputSheetUrl(pkgSheetSource);
                                setInputWebhookUrl(pkgWebhook);
                                setInputSessionTitle(pkg.packageTitle);
                                setTargetPackageIdForConnect(pkg.packageId);
                                setShowConnectModal(true);
                                handleInspectSheetTabs(pkgSheetSource, pkgWebhook, warehouseSection, pkg.packageId);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
                              title="بینین و هێنانی تابە نوێیەکان لەم گۆگڵ شیتە"
                            >
                              <Plus className="w-3 h-3" />
                              <span>تابی نوێ بهێنە</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openPackageCodeBriefing(pkg.tabs, pkg.packageTitle)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                            title="شیکاری و بەرچاوڕوونی کۆدەکانی ناو ئەم باکێچە"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>کۆدەکان</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteDialog({
                                kind: 'package',
                                packageId: pkg.packageId,
                                packageTitle: pkg.packageTitle,
                                tabs: pkg.tabs,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                            title="سڕینەوەی تەواوی ئەم باکێچە بە یەکجار"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>سڕینەوەی هەمووی</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Responsive Wrapped Grid of ALL Tabs inside Package (Visible without horizontal hiding!) */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2 max-h-56 overflow-y-auto ashley-cell-scroll p-0.5">
                      {visibleTabs.map((s) => {
                        const isSelected = currentSession?.id === s.id;
                        const totalUnits = s.totalExpectedUnits || 0;
                        const auditedUnits = s.totalAuditedUnits || 0;
                        const percent = totalUnits > 0 ? Math.round((auditedUnits / totalUnits) * 100) : 0;

                        return (
                          <div
                            key={s.id}
                            className={`rounded-xl border flex items-center justify-between transition-all min-w-[130px] ${
                              isSelected
                                ? warehouseSection === 'shipment_receiving'
                                  ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300/60 shadow-xs'
                                  : 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/60 shadow-xs'
                                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setCurrentSession(s);
                                if (typeof window !== 'undefined') {
                                  localStorage.setItem(ACTIVE_SESSION_ID_KEY, s.id);
                                }
                              }}
                              className="flex-1 px-2.5 py-2 text-right cursor-pointer flex items-center justify-between gap-2 active:scale-95 touch-manipulation min-w-0"
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black text-slate-900 truncate max-w-[160px]">
                                  {s.sheetName || s.title}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {s.items?.length || 0} کاڵا • {auditedUnits}/{totalUnits} ({percent}%)
                                </span>
                              </div>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-ping" />
                              )}
                            </button>

                            {!isMobileOperational && (
                              <button
                                type="button"
                                onClick={() => setDeleteDialog({ kind: 'tab', session: s })}
                                className="pl-2 pr-1.5 py-2 text-slate-400 hover:text-rose-600 cursor-pointer border-r border-slate-200/80 shrink-0"
                                title={`سڕینەوەی بەشی «${s.sheetName || s.title}»`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Controls for Current Session */}
        {currentSession && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* 🎥 Smart Mobile Camera Carton Scanner Button */}
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-amber-500/20 transition-all border border-amber-400/50"
              title="کردنەوەی کامێرای مۆبایل بۆ ژماردنی هۆشمەندی کارتۆنەکان بە دەنگ و ئاگادارکردنەوە"
            >
              <Camera className="w-4 h-4 text-slate-950" />
              <span>ژماردنی زیرەک بە کامێرا</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-mono font-bold">
                {currentSession.items.reduce((acc, it) => acc + (it.checkedCartons || it.scannedCartonNumbers?.length || 0), 0)} / {currentSession.totalCartonsCount || currentSession.items.reduce((acc, it) => acc + (it.cartonCount || it.expectedQty || 1), 0)}
              </span>
            </button>

            {/* 💾 دوگمەی ١: خەزنکردنی داتاکە لە سیستەم (Supabase) */}
            <button
              type="button"
              onClick={handleSaveToSupabase}
              disabled={saving}
              className={`h-10 px-4 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-xs ${
                supabaseSaveSuccess 
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
              title="خەزنکردنی ڕاستەوخۆی سەرجەم ژماردن و گۆڕانکارییەکان لە داتابەیسی ناوەندی سیستەم (Supabase)"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
              ) : supabaseSaveSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Save className="w-4 h-4 text-emerald-700" />
              )}
              <span>
                {saving 
                  ? 'خەزن دەکرێت...' 
                  : supabaseSaveSuccess 
                    ? 'خەزنکرا لە Supabase! ✅' 
                    : '💾 خەزنکردن لە سیستەم (Supabase)'}
              </span>
            </button>

            {/* 🔄 دوگمەی ٢: گواستنەوەی گۆڕانکارییەکان بۆ شیتەکە (لەگەڵ زیادکردنی کۆڵۆمەکان) */}
            <button
              type="button"
              onClick={handlePushToGoogleSheet}
              disabled={isPushingGoogle}
              className={`h-10 px-4 rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-xs ${
                pushSuccessMsg 
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'
              }`}
              title="گواستنەوەی هەموو گۆڕانکارییەکان بۆ Google Sheet و زیادکردنی کۆڵۆمە پێویستەکان"
            >
              {isPushingGoogle ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : pushSuccessMsg ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-white" />
              )}
              <span>
                {isPushingGoogle 
                  ? 'ڕەوانەی شیت دەکرێت...' 
                  : pushSuccessMsg 
                    ? 'نێردرا بۆ شیت! ✅' 
                    : '🔄 گواستنەوە بۆ شیت (زیادکردنی کۆڵۆمەکان)'}
              </span>
            </button>

            {/* Export to Excel */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              title="داگرتنی داتاکان بە فۆرماتی Excel لەگەڵ هەموو کۆڵۆمەکان"
            >
              <Download className="w-3.5 h-3.5" />
              <span>داگرتنی Excel</span>
            </button>

            {/* Print / Official PDF */}
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs transition-all"
              title="ڕاپۆرتی فەرمی PDF بۆ واژوو و چێککردن"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>ڕاپۆرتی PDF</span>
            </button>

            {/* 🛡️ Smart Two-Way Sync Control Center */}
            <button
              type="button"
              onClick={handleInspectGoogleDiff}
              className={`h-10 px-3.5 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all border ${
                pendingGoogleSyncIds[currentSession.id]
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
              }`}
              title="بەراوردکردن و کۆنترۆڵکردنی جیاوازی داتاکان نێوان پرۆگرام و Google Sheet"
            >
              <ShieldCheck className={`w-4 h-4 ${pendingGoogleSyncIds[currentSession.id] ? 'text-amber-600 animate-pulse' : 'text-indigo-600'}`} />
              <span>
                {pendingGoogleSyncIds[currentSession.id]
                  ? 'چاوەڕوانی هاوکاتکردن...'
                  : 'کۆنترۆڵی هاوکاتکردن'}
              </span>
            </button>

            {/* Kurdish Voice & Offline Audio Button */}
            <button
              type="button"
              onClick={() => setShowAudioSettingsModal(true)}
              className="h-10 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all mr-auto"
              title="ڕێکخستن و تاقیکردنەوەی دەنگی کوردی و خەزنی ئۆفلاین"
            >
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span>دەنگی کوردی</span>
            </button>

            {/* Help & Script Info */}
            <button
              type="button"
              onClick={() => setShowHelpScriptModal(true)}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
              title="ڕێنمایی بەستنەوە و سکریپتی ئۆتۆماتیکی گۆگڵ"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 📢 Dynamic Live Success Feedback Banners */}
        {supabaseSaveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              ✅ بە سەرکەوتوویی لە داتابەیسی سیستەم (Supabase) خەزنکرا! سەرجەم گۆڕانکاری و کارتۆنەکان لە هەموو مۆبایل و بەشەکاندا دەستبەجێ بەردەستن.
            </span>
            {lastSupabaseSavedTime && (
              <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2.5 py-0.5 rounded-full mr-auto font-mono">
                {lastSupabaseSavedTime}
              </span>
            )}
          </div>
        )}

        {pushSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-300 text-blue-950 text-xs font-bold flex items-center gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{pushSuccessMsg}</span>
          </div>
        )}

        {webhookWarningMsg && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{webhookWarningMsg}</span>
            </div>
            <div className="flex items-center gap-1.5 mr-auto">
              <button
                type="button"
                onClick={() => {
                  setTempWebhookUrl(currentSession?.webhookUrl || '');
                  setPushErrorMsg(webhookWarningMsg);
                  setShowGooglePushModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black cursor-pointer active:scale-95"
              >
                چاککردنی Webhook
              </button>
              <button
                type="button"
                onClick={() => setWebhookWarningMsg(null)}
                className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 flex items-center justify-center cursor-pointer"
                aria-label="داخستنی ئاگادارکردنەوە"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 📦 2. ACTIVE SESSION INFO & DUAL MODE SELECTOR */}
      {/* ========================================================================= */}
      {currentSession ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-2xl ${
                currentSession.mode === 'shipment_receiving'
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-blue-50 text-blue-600 border border-blue-200'
              }`}>
                {currentSession.mode === 'shipment_receiving' ? <Truck className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {currentSession.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    currentSession.mode === 'shipment_receiving'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {currentSession.mode === 'shipment_receiving' ? 'داگرتنی باری نوێ' : 'جەردی کۆگا'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                  <span>بەروار: {currentSession.createdAt.slice(0, 10)}</span>
                  {currentSession.googleSheetUrl && (
                    <>
                      <span>•</span>
                      <a 
                        href={currentSession.googleSheetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
                      >
                        <span>کردنەوەی شیتەکە لە Google</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTempWebhookUrl(currentSession.webhookUrl || '');
                      setPushErrorMsg(null);
                      setShowGooglePushModal(true);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all ${
                      currentSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(currentSession.webhookUrl.trim())
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <span>
                      {currentSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(currentSession.webhookUrl.trim())
                        ? '🟢 نووسینی ڕاستەوخۆ بۆ شیت: چالاکە'
                        : '⚠️ نووسینی ڕاستەوخۆ بۆ شیت نەبەستراوە (کلیک بکە)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const updated = { ...currentSession, mode: 'shipment_receiving' as const };
                  setCurrentSession(updated);
                  setWarehouseSection('shipment_receiving');
                  persistSession(updated);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  currentSession.mode === 'shipment_receiving'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                <span>داگرتنی باری نوێ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const updated = { ...currentSession, mode: 'inventory_stocktake' as const };
                  setCurrentSession(updated);
                  setWarehouseSection('inventory_stocktake');
                  persistSession(updated);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  currentSession.mode === 'inventory_stocktake'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>جەردی کۆگا</span>
              </button>
            </div>
          </div>

          {/* 📊 KPI Metrics Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            
            {/* Total Items in Sheet */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block mb-1">کۆی کاڵاکان لە شیت</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-slate-900">{sessionKPIs.totalItems}</span>
                <span className="text-[10px] text-slate-400 font-bold">مۆدێل</span>
              </div>
            </div>

            {/* Total Units (Audited vs Expected) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block mb-1">
                {currentSession.mode === 'shipment_receiving' ? 'دانەی چێککراو / بارکراو' : 'دانەی ژمێردراو / تۆمارکراو'}
              </span>
              <div className="flex items-baseline gap-1 font-mono font-black text-slate-900">
                <span className="text-xl text-blue-600">{sessionKPIs.auditedUnits}</span>
                <span className="text-xs text-slate-400">/ {sessionKPIs.expectedUnits}</span>
              </div>
            </div>

            {/* Matched (هاوتا و بێ کێشە) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 block mb-1">هاوتا و تەواو (ڕێکە)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-emerald-700">{sessionKPIs.matchedCount}</span>
                <span className="text-[10px] text-emerald-600 font-bold">مۆدێل ✅</span>
              </div>
            </div>

            {/* Discrepant (جیاوازی و کەمی) */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 block mb-1">جیاوازی (کەمی یان زیادی)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-amber-700">{sessionKPIs.discrepantCount}</span>
                <span className="text-[10px] text-amber-600 font-bold">کێشەدار ⚠️</span>
              </div>
            </div>

            {/* Damaged (تێکچوو یان شکاو) */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
              <span className="text-[10px] font-bold text-rose-800 block mb-1">زیانلێکەوتوو / شکاو</span>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xl font-black font-mono text-rose-700">{sessionKPIs.damagedCount}</span>
                <span className="text-[10px] text-rose-600 font-bold">
                  جۆر{sessionKPIs.damagedUnits > 0 ? ` (${sessionKPIs.damagedUnits} دانە)` : ''} ❌
                </span>
              </div>
            </div>

          </div>

          {/* Progress Bar */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
              <span>ڕێژەی ئەنجامدراوی پشکنین:</span>
              <span className="font-mono text-blue-600 font-black">{sessionKPIs.progressPercent}% تەواو بووە</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${sessionKPIs.progressPercent}%` }} 
              />
            </div>
          </div>

        </div>
      ) : (
        /* Empty State: No Session loaded yet */
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 sm:p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">
              {isMobileOperational ? 'شیتێکی خەزنکراو لە سەرەوە هەڵبژێرە' : 'هیچ خشتەیەکی چالاک بارنەکراوە'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isMobileOperational
                ? 'کلیک لە یەکێک لە شیتەکانی خەزنکراوی سەرەوە بکە بۆ دەستپێکردنی ژماردن بە کامێرا و جەردکردن لە مۆبایل.'
                : 'کلیک لە دوگمەی خوارەوە بکە و لینکی گۆگڵ شیتی کانتینەر یان جەردی کۆگا دابنێ بۆ دەستپێکردنی پشکنین.'}
            </p>
          </div>
          {!isMobileOperational && (
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>بەستنەوە بە Google Sheet</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔍 3. BARCODE SCANNER & QUICK AUDIT ENTRY */}
      {/* ========================================================================= */}
      {currentSession && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
          <form onSubmit={handleBarcodeSubmit} className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[260px]">
              <Barcode className="w-5 h-5 absolute right-3.5 top-2.5 text-slate-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="سکانی بارکۆد بکە یان کۆدی مۆدێل بنووسە و Enter داگرە..."
                className="w-full h-11 pr-11 pl-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs transition-all shrink-0"
            >
              <Scan className="w-4 h-4 text-amber-400" />
              <span>چێککردن (+١)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-amber-500/20 transition-all shrink-0"
              title="کردنەوەی کامێرای مۆبایل بۆ لێدانی لیبڵ و بارکۆد بە دەنگ و ئاگادارکردنەوە"
            >
              <Camera className="w-4 h-4" />
              <span>کامێرا</span>
            </button>
          </form>

          {/* Scanned Notification Alert */}
          {scannedAlert && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              scannedAlert.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {scannedAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              <span>{scannedAlert.message}</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📑 4. SEARCH, FILTERS & MAIN AUDIT TABLE */}
      {/* ========================================================================= */}
      {currentSession && (
        <div className="space-y-3">
          
          {/* Search & Status Filters Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            
            {/* Live Search */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="گەڕان بەپێی کۆد، ناوی مۆدێل، شوێنی کۆگا، تێبینی..."
                className="w-full h-10 pr-10 pl-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-blue-400"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'هەموو' },
                { id: 'pending', label: 'چاوەڕوان ⏳' },
                { id: 'verified', label: 'هاوتا ✅' },
                { id: 'deficit', label: 'کەمی ⚠️' },
                { id: 'excess', label: 'زیادە 🔵' },
                { id: 'damaged', label: 'شکاو ❌' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                    statusFilter === f.id
                      ? 'bg-slate-900 text-white shadow-xs font-black'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Matrix Table (Fixed Column Bounds + Smart Inner-Cell Scroll) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
            <div className="max-h-[68vh] overflow-auto ashley-cell-scroll">
              <table className="w-[1800px] table-fixed border-collapse text-right text-xs">
                <colgroup>
                  <col className="w-[46px]" />
                  <col className="w-[170px]" />
                  <col className="w-[215px]" />
                  <col className="w-[136px]" />
                  <col className="w-[156px]" />
                  <col className="w-[120px]" />
                  <col className="w-[96px]" />
                  <col className="w-[172px]" />
                  <col className="w-[80px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                  <col className="w-[144px]" />
                  <col className="w-[215px]" />
                </colgroup>
                <thead className="bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-slate-700 font-black sticky top-0 z-10 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="p-3 text-center border-l border-slate-200/75">#</th>
                    <th className="p-3 border-l border-slate-200/75">کۆدی مۆدێل</th>
                    <th className="p-3 border-l border-slate-200/75">ناوی کاڵا</th>
                    <th className="p-3 text-center border-l border-slate-200/75">کارتۆن (داگیراو / گشتی)</th>
                    <th className="p-3 text-center border-l border-slate-200/75">کارتۆنە لێدراوەکان</th>
                    <th className="p-3 text-center border-l border-slate-200/75">شوێن لە کۆگا</th>
                    <th className="p-3 text-center border-l border-slate-200/75">
                      {currentSession.mode === 'shipment_receiving' ? 'بڕی بارکراو' : 'بڕی تۆمارکراو'}
                    </th>
                    <th className="p-3 text-center border-l border-slate-200/75">
                      {currentSession.mode === 'shipment_receiving' ? 'بڕی وەرگیراو (داگیراو)' : 'بڕی ژمێردراو (جەرد)'}
                    </th>
                    <th className="p-3 text-center border-l border-slate-200/75">جیاوازی</th>
                    <th className="p-3 text-center border-l border-slate-200/75">دۆخی کارتۆن</th>
                    <th className="p-3 text-center border-l border-slate-200/75">دۆخی چێک</th>
                    <th className="p-3 text-center border-l border-slate-200/75">دواین گۆڕانکاری</th>
                    <th className="p-3">تێبینی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-16 text-center text-slate-400 font-bold">
                        هیچ کاڵایەک نەدۆزرایەوە بەپێی ئەم فلتەرە.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isDamaged = item.condition === 'Damaged' || item.condition === 'Defective' || item.auditStatus === 'damaged';
                      const isDeficit = item.variance < 0 && item.checkedQty > 0;
                      const isExcess = item.variance > 0;
                      const isVerified = item.checkedQty > 0 && item.variance === 0 && !isDamaged;

                      return (
                        <tr 
                          key={item.id} 
                          className={`transition-colors hover:bg-slate-50/80 ${
                            isDamaged ? 'bg-rose-50/40' : isDeficit ? 'bg-amber-50/30' : isVerified ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          {/* 1. Row Number */}
                          <td className="p-2.5 text-center font-mono text-[11px] text-slate-400 border-l border-slate-100 overflow-hidden">
                            {idx + 1}
                          </td>

                          {/* 2. Model Code (Fixed bound + horizontal smart inner scroll) */}
                          <td className="p-2.5 border-l border-slate-100 overflow-hidden">
                            <div className="flex items-center gap-1.5 w-full">
                              <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden ashley-cell-scroll pb-0.5" dir="ltr">
                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-900 text-amber-400 inline-block whitespace-nowrap tracking-wide">
                                  {item.model}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.model, item.model)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 shrink-0 rounded-md hover:bg-slate-100"
                                title="کۆپیکردنی کۆد"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* 3. Item Name (Fixed bound + vertical smart inner scroll) */}
                          <td className="p-2.5 font-bold text-slate-900 border-l border-slate-100 overflow-hidden">
                            <div
                              className="max-h-[54px] overflow-y-auto ashley-cell-scroll leading-snug text-xs pl-1 break-words"
                              title={item.name}
                            >
                              {item.name || '--'}
                            </div>
                          </td>

                          {/* 4. Cartons Count & Progress */}
                          <td className="p-2.5 text-center border-l border-slate-100 overflow-hidden">
                            {item.cartonCount ? (
                              <div className="inline-flex flex-col items-center gap-1 max-h-[54px] overflow-y-auto ashley-cell-scroll">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono border whitespace-nowrap ${
                                  (item.checkedCartons || (item.scannedCartonNumbers?.length || 0)) >= item.cartonCount
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : (item.checkedCartons || (item.scannedCartonNumbers?.length || 0)) > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.checkedCartons || (item.scannedCartonNumbers?.length || 0)} / {item.cartonCount} ctn
                                </span>
                                {item.pcsPerCarton && item.pcsPerCarton > 1 && (
                                  <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                    ({item.pcsPerCarton} دانە/کارتۆن)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">--</span>
                            )}
                          </td>

                          {/* 5. Scanned Cartons Badges (Fixed height + smart inner vertical scroll for 100+ boxes!) */}
                          <td className="p-2.5 text-center border-l border-slate-100 overflow-hidden">
                            {Array.isArray(item.scannedCartonNumbers) && item.scannedCartonNumbers.length > 0 ? (
                              <div className="max-h-[54px] overflow-y-auto ashley-cell-scroll flex flex-wrap items-center justify-center gap-1 px-0.5">
                                {item.scannedCartonNumbers.map(n => (
                                  <span key={n} className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-black shrink-0" title={`کارتۆنی ژمارە ${n} داگیراوە`}>
                                    #{n}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[10px]">--</span>
                            )}
                          </td>

                          {/* 6. Rack Location (Smart inner scroll) */}
                          <td className="p-2.5 text-center border-l border-slate-100 overflow-hidden">
                            <div className="max-h-[52px] overflow-y-auto overflow-x-auto ashley-cell-scroll">
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold inline-block break-all">
                                {item.rackLocation || '--'}
                              </span>
                            </div>
                          </td>

                          {/* 7. Expected Qty */}
                          <td className="p-2.5 text-center font-mono font-black text-slate-700 text-sm border-l border-slate-100 overflow-hidden">
                            {item.expectedQty}
                          </td>

                          {/* 8. Checked / Audited Qty with Tactile +/- Controls */}
                          <td className="p-2 text-center border-l border-slate-100 overflow-hidden">
                            <div className="inline-flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, -1)}
                                className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-800 flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-95 shrink-0"
                                title="کەمکردنەوە بە ١"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <input
                                type="number"
                                value={item.checkedQty}
                                onChange={(e) => handleSetDirectQty(item.id, e.target.value)}
                                className="w-11 text-center font-mono font-black text-sm bg-transparent outline-none shrink-0"
                              />

                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-95 shrink-0"
                                title="زیادکردن بە ١"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              {/* Fast +5 */}
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, 5)}
                                className="px-1.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-mono font-bold cursor-pointer active:scale-95 shrink-0"
                                title="زیادکردنی ٥ دانە"
                              >
                                +5
                              </button>
                            </div>
                          </td>

                          {/* 9. Variance */}
                          <td className="p-2.5 text-center font-mono font-black text-sm border-l border-slate-100 overflow-hidden">
                            {item.variance === 0 ? (
                              <span className="text-emerald-600">٠</span>
                            ) : item.variance < 0 ? (
                              <span className="text-rose-600" dir="ltr">{item.variance}</span>
                            ) : (
                              <span className="text-blue-600" dir="ltr">+{item.variance}</span>
                            )}
                          </td>

                          {/* 10. Condition Dropdown + Exact Damaged / Repack Quantity (چەنێکی وایە) */}
                          <td className="p-2 text-center border-l border-slate-100 overflow-hidden">
                            <div className="space-y-1">
                              <select
                                value={item.condition}
                                onChange={(e) => handleUpdateCondition(item.id, e.target.value as any)}
                                className={`w-full h-8 px-1.5 rounded-xl text-[11px] font-bold outline-none cursor-pointer border ${
                                  item.condition === 'Damaged'
                                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                                    : item.condition === 'Defective'
                                    ? 'bg-orange-50 text-orange-800 border-orange-300'
                                    : item.condition === 'Need Wrapped'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : item.condition === 'Wrapped'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                <option value="Packaged">کارتۆنی ساغ</option>
                                <option value="Wrapped">لەفکراو / تەغلیف</option>
                                <option value="Need Wrapped">پێویست بە تەغلیف</option>
                                <option value="Damaged">شکاو / زیانلێکەوتوو</option>
                                <option value="Defective">عەیبدار / کێشەی کارگە</option>
                                <option value="Normal">ئاسایی</option>
                              </select>

                              {(item.condition === 'Damaged' || item.condition === 'Defective' || item.condition === 'Need Wrapped' || item.condition === 'Wrapped') && (
                                <div
                                  className={`p-1.5 rounded-xl border text-[10.5px] font-bold space-y-1 ${
                                    item.condition === 'Damaged'
                                      ? 'bg-rose-50/90 border-rose-200 text-rose-800'
                                      : item.condition === 'Defective'
                                      ? 'bg-orange-50/90 border-orange-200 text-orange-800'
                                      : item.condition === 'Need Wrapped'
                                      ? 'bg-amber-50/90 border-amber-200 text-amber-800'
                                      : 'bg-purple-50/90 border-purple-200 text-purple-800'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate font-black">
                                      {item.condition === 'Damaged'
                                        ? 'بڕی شکاو:'
                                        : item.condition === 'Defective'
                                        ? 'بڕی عەیبدار:'
                                        : item.condition === 'Need Wrapped'
                                        ? 'بێ تەغلیف:'
                                        : 'تەغلیفکراو:'}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0" dir="ltr">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateIssueQty(item.id, (item.issueQty || 1) - 1)}
                                        className="w-5 h-5 rounded-md bg-white hover:bg-slate-100 border border-current/30 flex items-center justify-center font-black text-xs leading-none cursor-pointer active:scale-95 transition-transform"
                                        title="کەمکردنەوە"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min={0}
                                        max={9999}
                                        value={item.issueQty ?? 1}
                                        onChange={(e) => handleUpdateIssueQty(item.id, parseInt(e.target.value || '0', 10))}
                                        className="w-9 h-5 text-center bg-white border border-current/30 rounded-md font-mono text-[11px] font-black outline-none focus:ring-1 focus:ring-current"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateIssueQty(item.id, (item.issueQty || 0) + 1)}
                                        className="w-5 h-5 rounded-md bg-white hover:bg-slate-100 border border-current/30 flex items-center justify-center font-black text-xs leading-none cursor-pointer active:scale-95 transition-transform"
                                        title="زیادکردن"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Quick preset buttons: [1 دانە], [2 دانە], [هەمووی] */}
                                  <div className="flex items-center justify-end gap-1 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIssueQty(item.id, 1)}
                                      className="px-1.5 py-0.5 rounded bg-white/80 hover:bg-white border border-current/20 text-[9px] font-black cursor-pointer active:scale-95"
                                    >
                                      ١ دانە
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIssueQty(item.id, 2)}
                                      className="px-1.5 py-0.5 rounded bg-white/80 hover:bg-white border border-current/20 text-[9px] font-black cursor-pointer active:scale-95"
                                    >
                                      ٢ دانە
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIssueQty(item.id, item.checkedQty || item.pcsPerCarton || item.expectedQty || 1)}
                                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-50 border border-current/30 text-[9px] font-black cursor-pointer active:scale-95 text-rose-700"
                                    >
                                      هەمووی ({item.checkedQty || item.pcsPerCarton || item.expectedQty || 1})
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 11. Audit Status Badge */}
                          <td className="p-2 text-center border-l border-slate-100 overflow-hidden">
                            <div className="max-h-[52px] overflow-y-auto ashley-cell-scroll flex items-center justify-center">
                              {isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  <span>هاوتا ✅</span>
                                </span>
                              ) : isDamaged ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold whitespace-nowrap">
                                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                                  <span>
                                    {item.condition === 'Defective' ? 'عەیبدار' : 'شکاو'}
                                    {item.issueQty ? ` (${item.issueQty} دانە)` : ''} {item.condition === 'Defective' ? '⚠️' : '❌'}
                                  </span>
                                </span>
                              ) : isDeficit ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
                                  <AlertCircle className="w-3 h-3 text-amber-500" />
                                  <span>کەمە ({item.variance})</span>
                                </span>
                              ) : isExcess ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold whitespace-nowrap">
                                  <span>زیادە (+{item.variance})</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px] font-bold whitespace-nowrap">
                                  چاوەڕوان ⏳
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 12. Last Modified (Baghdad Exact Clock + Date) & Audited By */}
                          <td className="p-2 text-center border-l border-slate-100 overflow-hidden">
                            {item.lastAuditedAt ? (
                              <div className="font-mono text-[10.5px] max-h-[52px] overflow-y-auto ashley-cell-scroll">
                                <span className="text-slate-800 font-black flex items-center justify-center gap-1 whitespace-nowrap" dir="ltr">
                                  <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                  {new Date(item.lastAuditedAt).toLocaleTimeString('en-GB', {
                                    timeZone: 'Asia/Baghdad',
                                    hour12: false,
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </span>
                                <span className="text-[9.5px] text-slate-500 font-bold block truncate">
                                  {new Date(item.lastAuditedAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Baghdad' })} • {item.auditedBy || currentSession.auditedBy || 'Admin'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">--</span>
                            )}
                          </td>

                          {/* 13. Notes Deferred Scrollable Textbox (Fixed bounds + commits cleanly on blur / "تەواو ✓") */}
                          <td className="p-2 overflow-hidden">
                            <DeferredNoteInput
                              key={item.id}
                              itemId={item.id}
                              value={item.notes || ''}
                              onCommit={handleUpdateNotes}
                              onEditingChange={handleNoteEditingChange}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚀 MODAL 1: CONNECT GOOGLE SHEET */}
      {/* ========================================================================= */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto ashley-cell-scroll bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {targetPackageIdForConnect ? 'هێنان و هەڵبژاردنی تابەکان لە گۆگڵ شیت' : 'بەستنەوە بە Google Sheet'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    دەتوانیت هەموو تابەکان یان تەنها چەند تابێکی دیاریکراو هەڵبژێریت و داخڵی بکەیت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPreviewSelection();
                  setShowConnectModal(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Import Source Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 rounded-2xl mb-4 border border-slate-200/70">
              <button
                type="button"
                onClick={() => { setImportTab('url'); setConnectError(null); resetPreviewSelection(); }}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  importTab === 'url'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>بەستەر</span>
              </button>

              <button
                type="button"
                onClick={() => { setImportTab('file'); setConnectError(null); }}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  importTab === 'file'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>ئێکسڵ</span>
              </button>

              <button
                type="button"
                onClick={() => { setImportTab('paste'); setConnectError(null); }}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  importTab === 'paste'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>پێستکردن</span>
              </button>

              <button
                type="button"
                onClick={() => { setImportTab('ai'); setConnectError(null); }}
                className={`py-2 px-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  importTab === 'ai'
                    ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                    : 'text-amber-800 hover:text-amber-950 bg-amber-500/10'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-amber-600" />
                <span>شرۆڤەی AI</span>
              </button>
            </div>

            {connectError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="whitespace-pre-line leading-relaxed font-sans">{connectError}</div>
              </div>
            )}

            {/* TAB 1: GOOGLE SHEETS LINK */}
            {importTab === 'url' && (
              <form onSubmit={handleConnectSheet} className="space-y-4 text-xs">
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 space-y-1">
                  <span className="font-black text-[11px] block">📦 هێنانی هەموو شیتەکان و بەشەکان وەک یەک باکێچ:</span>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-blue-900">
                    <li>لە Google Sheet کلیک لە <strong>Share</strong> بکە → <strong>General access</strong> بکە بە <strong>Anyone with the link</strong> (بۆ هێنانی هەموو تەبەکان بەیەکجار).</li>
                    <li>بەستەری Google Sheet لە خانەی یەکەم دابنێ؛ یان ئەگەر تایبەتە بەستەری Apps Script دابنێ.</li>
                    <li>سیستەم خۆکار <strong>هەموو بەشەکان (Tabs)</strong> دەخوێنێتەوە، کۆدەکان دەپشکنێت و دەیانکات بە ١ باکێچ!</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    لینکی Google Sheet یان Apps Script Web App:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={inputSheetUrl}
                      onChange={(e) => {
                        setInputSheetUrl(e.target.value);
                        if (previewedTabs.length > 0) resetPreviewSelection();
                      }}
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                      className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-blue-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => handleInspectSheetTabs()}
                      disabled={inspectingTabs || !inputSheetUrl.trim()}
                      className="h-11 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                      title="پیشاندانی هەموو تابەکان بۆ هەڵبژاردن"
                    >
                      {inspectingTabs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>بینینی تابەکان</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    کلیک لە «بینینی تابەکان» بکە بۆ هەڵبژاردنی تابی دیاریکراو، یان ڕاستەوخۆ هەمووی لۆد بکە.
                  </p>
                </div>

                {/* Interactive Tab Picker Preview (when user clicked "بینینی تابەکان") */}
                {previewedTabs.length > 0 && importTab === 'url' && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>تابە دۆزراوەکان ({selectedPreviewTabNames.length} / {previewedTabs.length} هەڵبژێردراوە):</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewTabNames(previewedTabs.map((t) => t.sheetName))}
                          className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                        >
                          هەمووی
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewTabNames([])}
                          className="text-[10px] font-black text-slate-500 hover:underline cursor-pointer"
                        >
                          لابردن
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto ashley-cell-scroll p-0.5">
                      {previewedTabs.map((t) => {
                        const checked = selectedPreviewTabNames.includes(t.sheetName);
                        return (
                          <button
                            key={`${t.tabIndex}_${t.sheetName}`}
                            type="button"
                            onClick={() =>
                              setSelectedPreviewTabNames((prev) =>
                                prev.includes(t.sheetName)
                                  ? prev.filter((n) => n !== t.sheetName)
                                  : [...prev, t.sheetName]
                              )
                            }
                            className={`p-2 rounded-xl border text-right flex items-center justify-between gap-2 cursor-pointer transition-all ${
                              checked
                                ? 'bg-blue-50 border-blue-400 text-slate-900 ring-1 ring-blue-300'
                                : 'bg-white border-slate-200 text-slate-600 opacity-75'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  checked
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-white border-slate-300'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[11px] font-black block truncate">{t.sheetName}</span>
                                <span className="text-[9.5px] font-mono text-slate-500 block">
                                  {t.itemCount} کاڵا • {t.totalUnits} دانە
                                </span>
                              </div>
                            </div>
                            {t.alreadyImported ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black shrink-0">
                                هەیە
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black shrink-0">
                                نوێ
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mode Selection */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    جۆری پشکنین (کردارەکە):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('shipment_receiving')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'shipment_receiving'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>داگرتنی باری نوێ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputMode('inventory_stocktake')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'inventory_stocktake'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>جەردی کۆگا</span>
                    </button>
                  </div>
                </div>

                {/* Session Title */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ناوی بار / سێشن (ئارەزوومەندانە):
                  </label>
                  <input
                    type="text"
                    value={inputSessionTitle}
                    onChange={(e) => setInputSessionTitle(e.target.value)}
                    placeholder="بۆ نموونە: کانتینەری ژمارە ٤٨ - تورکیا یان جەردی هۆڵی ١"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* Optional Webhook URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">
                      لینکی Google Apps Script Webhook (بۆ هاوکاتکردنەوەی خۆکار):
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowHelpScriptModal(true)}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      سکریپتەکە چۆن دابنێم؟
                    </button>
                  </div>
                  <input
                    type="url"
                    value={inputWebhookUrl}
                    onChange={(e) => setInputWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec (ئارەزوومەندانە)"
                    className={`w-full h-11 px-3.5 rounded-xl border text-xs font-mono outline-none ${
                      inputWebhookUrl.trim().includes('docs.google.com/spreadsheets')
                        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                    dir="ltr"
                  />
                  {inputWebhookUrl.trim().includes('docs.google.com/spreadsheets') && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1">
                      ⚠️ ئەمە لینکی Google Sheetە نەک Webhook! لینکی Webhook دەبێت بە https://script.google.com/macros/s/ دەستپێبکات.
                    </p>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={connecting}
                    className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>
                      {previewedTabs.length > 0
                        ? `داخڵکردنی تابە هەڵبژێردراوەکان (${selectedPreviewTabNames.length})`
                        : 'لۆدکردنی هەموو تابەکان و دەستپێکردن'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetPreviewSelection();
                      setShowConnectModal(false);
                    }}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    داخستن
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: EXCEL FILE UPLOAD */}
            {importTab === 'file' && (
              <div className="space-y-4 text-xs">
                {/* File Drop Area */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    فایلی ئێکسڵ دیاری بکە (.xlsx, .xls, .csv):
                  </label>
                  <label className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-blue-50/70">
                    <Upload className="w-8 h-8 text-blue-600 mb-2 animate-bounce" />
                    <span className="text-xs font-black text-slate-800">کلیک بکە بۆ دیاریکردنی فایلی ئێکسڵ</span>
                    <span className="text-[11px] text-slate-500 mt-1">یان فایلەکە ڕابکێشە ئێرە (Drag & Drop)</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={connecting}
                    />
                  </label>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    جۆری پشکنین (کردارەکە):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('shipment_receiving')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'shipment_receiving'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>داگرتنی باری نوێ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputMode('inventory_stocktake')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'inventory_stocktake'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>جەردی کۆگا</span>
                    </button>
                  </div>
                </div>

                {/* Session Title */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ناوی سێشن (ئارەزوومەندانە):
                  </label>
                  <input
                    type="text"
                    value={inputSessionTitle}
                    onChange={(e) => setInputSessionTitle(e.target.value)}
                    placeholder="بۆ نموونە: باری گەیشتووی ئەمڕۆ"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {previewedTabs.length > 0 && pendingExcelTitle && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-800">
                        تابەکانی ئێکسڵ ({selectedPreviewTabNames.length}/{previewedTabs.length}):
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewTabNames(previewedTabs.map((t) => t.sheetName))}
                          className="text-[10px] font-black text-blue-600 hover:underline cursor-pointer"
                        >
                          هەمووی
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPreviewTabNames([])}
                          className="text-[10px] font-black text-slate-500 hover:underline cursor-pointer"
                        >
                          لابردن
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto ashley-cell-scroll">
                      {previewedTabs.map((t) => {
                        const checked = selectedPreviewTabNames.includes(t.sheetName);
                        return (
                          <button
                            key={t.sheetName}
                            type="button"
                            onClick={() =>
                              setSelectedPreviewTabNames((prev) =>
                                prev.includes(t.sheetName)
                                  ? prev.filter((n) => n !== t.sheetName)
                                  : [...prev, t.sheetName]
                              )
                            }
                            className={`p-2 rounded-xl border text-right flex items-center gap-2 cursor-pointer ${
                              checked
                                ? 'bg-blue-50 border-blue-400 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-500'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span className="text-[11px] font-black truncate">{t.sheetName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {previewedTabs.length > 0 && pendingExcelTitle && (
                    <button
                      type="button"
                      disabled={connecting || selectedPreviewTabNames.length === 0}
                      onClick={() =>
                        submitExcelSheetsPackage(
                          previewedTabs
                            .filter((t) => selectedPreviewTabNames.includes(t.sheetName))
                            .map((t) => ({ sheetName: t.sheetName, rawData: t.rawData || [] })),
                          pendingExcelTitle,
                          selectedPreviewTabNames
                        )
                      }
                      className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>داخڵکردنی ({selectedPreviewTabNames.length}) تاب</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      resetPreviewSelection();
                      setShowConnectModal(false);
                    }}
                    className={`${previewedTabs.length > 0 && pendingExcelTitle ? 'px-4' : 'w-full'} h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer`}
                  >
                    داخستن
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: DIRECT COPY-PASTE */}
            {importTab === 'paste' && (
              <form onSubmit={handleDirectPasteSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    خانەکانی خشتەکە لە Google Sheet کۆپی بکە (Ctrl+C) و لێرە Paste (Ctrl+V)ی بکە:
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={inputRawPaste}
                    onChange={(e) => setInputRawPaste(e.target.value)}
                    placeholder="مۆدێل	ناو	بڕ	شوێنی ڕەفە&#10;KB-901	مێزی نانخواردن	12	A-04&#10;SOF-200	قەنەفەی سێ نەفەری	6	B-12"
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono font-medium outline-none focus:border-blue-500"
                    dir="auto"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    دەتوانیت هەر خشتەیەک لە ئێکسڵ یان گۆگڵ شیت ڕاستەوخۆ دەستنیشان بکەیت و بیهێنیتە ئێرە.
                  </p>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    جۆری پشکنین (کردارەکە):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('shipment_receiving')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'shipment_receiving'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>داگرتنی باری نوێ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputMode('inventory_stocktake')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'inventory_stocktake'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>جەردی کۆگا</span>
                    </button>
                  </div>
                </div>

                {/* Session Title */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ناوی سێشن (ئارەزوومەندانە):
                  </label>
                  <input
                    type="text"
                    value={inputSessionTitle}
                    onChange={(e) => setInputSessionTitle(e.target.value)}
                    placeholder="بۆ نموونە: باری پێستکراوی کۆنتێنەر"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={connecting}
                    className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>لۆدکردنی داتای پێستکراو</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    داخستن
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: AI SMART EXTRACTION */}
            {importTab === 'ai' && (
              <form onSubmit={handleAiSmartParseSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <label className="text-slate-800 font-black">
                      شیکردنەوەی دەقی بار و مانیفێست بە زیرەکی دەستکرد:
                    </label>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={inputRawPaste}
                    onChange={(e) => setInputRawPaste(e.target.value)}
                    placeholder="دەقی بارنامە، پکینگ لیست یان وەسڵ لێرە دابنێ (تەنانەت ئەگەر ستوونی زۆر و بە زمانی تورکی، عەرەبی یان ئینگلیزیش بێت)... زیرەکی دەستکرد تەنها کۆدی مۆدێل، ژمارەی کارتۆن، و پارچەی ناو کارتۆن دەردەهێنێت."
                    className="w-full p-3 rounded-xl border border-amber-300 bg-amber-50/20 text-xs font-mono font-medium outline-none focus:border-amber-500"
                    dir="auto"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                    💡 زیرەکی دەستکرد هەموو زانیارییە ناپێویستەکان فڕێ دەدات و تەنها ٤ شت وەردەگرێت: مۆدێل، ناو، ژمارەی کارتۆن، و بڕی گشتی.
                  </p>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    جۆری پشکنین (کردارەکە):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('shipment_receiving')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'shipment_receiving'
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Truck className="w-4 h-4" />
                      <span>داگرتنی باری نوێ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputMode('inventory_stocktake')}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        inputMode === 'inventory_stocktake'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      <span>جەردی کۆگا</span>
                    </button>
                  </div>
                </div>

                {/* Session Title */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ناوی سێشن (ئارەزوومەندانە):
                  </label>
                  <input
                    type="text"
                    value={inputSessionTitle}
                    onChange={(e) => setInputSessionTitle(e.target.value)}
                    placeholder="بۆ نموونە: کانتینەری ژمارە ٥٠ (شرۆڤەی AI)"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={connecting || isAiParsing}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Bot className="w-4 h-4 text-slate-950" />}
                    <span>{isAiParsing ? 'زیرەکی دەستکرد شییدەکاتەوە...' : 'شیکردنەوە و دروستکردنی بار بە AI'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    داخستن
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 MODAL 2: SWITCH SESSIONS MODAL */}
      {/* ========================================================================= */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  هەموو شیت و تابەکان ({sessions.length})
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadSessions(true)}
                  disabled={refreshingCloud}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingCloud ? 'animate-spin' : ''}`} />
                  <span>نوێکردنەوە</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSessionsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Search & Section Filter inside All Sheets Modal */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={sessionsModalSearch}
                  onChange={(e) => setSessionsModalSearch(e.target.value)}
                  placeholder="گەڕان بەپێی ناوی فایل یان تاب..."
                  className="w-full h-9 pr-9 pl-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-blue-400"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                {(
                  [
                    { id: 'all', label: 'هەمووی' },
                    { id: 'shipment_receiving', label: 'بار داگرتن' },
                    { id: 'inventory_stocktake', label: 'جەرد' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSessionsModalModeFilter(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                      sessionsModalModeFilter === m.id
                        ? 'bg-white text-blue-600 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 ashley-cell-scroll pr-0.5">
              {(() => {
                const q = sessionsModalSearch.trim().toLowerCase();
                const filtered = sessions.filter((s) => {
                  const sMode = s.mode || 'shipment_receiving';
                  if (sessionsModalModeFilter !== 'all' && sMode !== sessionsModalModeFilter) return false;
                  if (!q) return true;
                  return (
                    (s.packageTitle || '').toLowerCase().includes(q) ||
                    (s.sheetName || '').toLowerCase().includes(q) ||
                    (s.title || '').toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-10 text-center text-xs text-slate-400 font-bold">
                      هیچ شیت یان تابێک نەدۆزرایەوە.
                    </div>
                  );
                }

                const groups = new Map<
                  string,
                  { packageId: string; packageTitle: string; mode: 'shipment_receiving' | 'inventory_stocktake'; tabs: SheetsAuditSession[] }
                >();
                for (const s of filtered) {
                  const pid = `${s.packageId || s.id}__${s.mode || 'shipment_receiving'}`;
                  if (!groups.has(pid)) {
                    groups.set(pid, {
                      packageId: s.packageId || s.id,
                      packageTitle: s.packageTitle || s.title,
                      mode: s.mode || 'shipment_receiving',
                      tabs: [],
                    });
                  }
                  groups.get(pid)!.tabs.push(s);
                }

                const groupList = Array.from(groups.values());
                groupList.forEach((g) => g.tabs.sort((a, b) => (a.tabIndex ?? 0) - (b.tabIndex ?? 0)));

                return groupList.map((grp) => (
                  <div key={`${grp.mode}_${grp.packageId}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-black text-slate-900 truncate">{grp.packageTitle}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold">
                          {grp.mode === 'shipment_receiving' ? 'باری نوێ' : 'جەرد'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono font-black">
                          {grp.tabs.length} تاب
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {grp.tabs.map((s) => {
                        const isCur = currentSession?.id === s.id;
                        return (
                          <div
                            key={s.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                              isCur
                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300/50'
                                : 'bg-white border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                setWarehouseSection(s.mode || 'shipment_receiving');
                                setInputMode(s.mode || 'shipment_receiving');
                                setCurrentSession(s);
                                if (typeof window !== 'undefined') {
                                  localStorage.setItem(ACTIVE_SESSION_ID_KEY, s.id);
                                }
                                setShowSessionsModal(false);
                              }}
                              className="flex-1 min-w-0 text-right cursor-pointer"
                            >
                              <span className="font-black text-slate-900 text-xs truncate block">
                                {s.sheetName || s.title}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                {s.items?.length || 0} کاڵا • {s.totalAuditedUnits || 0} / {s.totalExpectedUnits || 0} دانە
                              </span>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setWarehouseSection(s.mode || 'shipment_receiving');
                                  setInputMode(s.mode || 'shipment_receiving');
                                  setCurrentSession(s);
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem(ACTIVE_SESSION_ID_KEY, s.id);
                                  }
                                  setShowSessionsModal(false);
                                }}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer active:scale-95 ${
                                  isCur ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                                }`}
                              >
                                {isCur ? 'چالاکە' : 'کردنەوە'}
                              </button>

                              {!isMobileOperational && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowSessionsModal(false);
                                    setDeleteDialog({ kind: 'tab', session: s });
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer active:scale-95"
                                  title="سڕینەوەی ئەم تابە"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎙️ MODAL 2.5: KURDISH OFFLINE AUDIO SETTINGS & TEST */}
      {/* ========================================================================= */}
      {showAudioSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  ڕێکخستن و تاقیکردنەوەی دەنگی کوردی (Kurdish Audio)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAudioSettingsModal(false);
                  setAudioSettingsSavedNotice(null);
                  setPrecacheAudioStatus(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700 ashley-cell-scroll">
              {/* Architecture Info Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 text-blue-950 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-black text-xs">سیستەمی دەنگی ئۆفلاین (100% Offline & Supabase Cache)</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed font-normal">
                  دەنگەکان بۆ یەکەم جار لە سێرڤەر وەردەگیرێن و لە داتابەیسی Supabase و ناو مۆبایلەکەتدا خەزن دەکرێن. کاتی سکانکردن لە کۆگادا <strong>بەبێ ئینتەرنێت</strong> و لە <strong>٠ چرکەدا</strong> ڕاستەوخۆ دەخوێندرێنەوە.
                </p>
              </div>

              {/* Section 1: Live Voice Test */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="font-black text-slate-900 text-xs block">
                  ١. تاقیکردنەوەی خوێندنەوەی دەنگی مۆدێل:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">کۆدی نموونە:</label>
                    <input
                      type="text"
                      value={testAudioCode}
                      onChange={(e) => setTestAudioCode(e.target.value)}
                      placeholder="EV 21068-02"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-black"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">عەدەد:</label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={testAudioQty}
                      onChange={(e) => setTestAudioQty(parseInt(e.target.value || '1', 10))}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-black text-center"
                    />
                  </div>
                </div>

                {/* Kurdish text preview */}
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-900">
                  <span className="text-[10px] text-slate-400 block mb-0.5">دەقی خوێندنەوە بە کوردی:</span>
                  <span className="text-xs font-bold text-blue-700 block">
                    «{formatKurdishSpokenScan(testAudioCode, testAudioQty).displayText}»
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isPlayingTestAudio || !testAudioCode.trim()}
                  onClick={async () => {
                    setIsPlayingTestAudio(true);
                    try {
                      await playKurdishScanAudio(testAudioCode, testAudioQty);
                    } finally {
                      setIsPlayingTestAudio(false);
                    }
                  }}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isPlayingTestAudio ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                  <span>{isPlayingTestAudio ? 'دەخوێندرێتەوە...' : '🔊 گوێگرتن لە دەنگەکە ئێستا'}</span>
                </button>
              </div>

              {/* Section 2: Session Pre-cache for 100% Offline Scanning */}
              {currentSession && currentSession.items && currentSession.items.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <span className="font-black text-slate-900 text-xs block">
                    ٢. داگرتنی دەنگەکانی ئەم شیتە بۆ ناو مۆبایل (Pre-cache):
                  </span>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    ئەم بەشە خاوەنی <strong>{currentSession.items.length}</strong> کاڵایە. دەتوانیت بە یەک کلیک هەموو دەنگەکان دابگریت بۆ ئەوەی پێش چوونە کۆگا هەمووی ئۆفلاین بێت:
                  </p>

                  <button
                    type="button"
                    disabled={precachingAudio}
                    onClick={async () => {
                      setPrecachingAudio(true);
                      setPrecacheAudioStatus('خەریکی دابەزاندنی دەنگەکانە بۆ ناو مۆبایل...');
                      try {
                        const res = await precacheSessionAudioClips(currentSession.items);
                        setPrecacheAudioStatus(
                          `✅ بە سەرکەوتوویی هەموو (${res.cachedCount} لە ${res.totalCount}) دەنگەکان لە ناو مۆبایلەکەت خەزنکران بۆ ئۆفلاین!`
                        );
                      } catch {
                        setPrecacheAudioStatus('هەڵەیەک ڕوویدا لە دابەزاندن.');
                      } finally {
                        setPrecachingAudio(false);
                      }
                    }}
                    className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm"
                  >
                    {precachingAudio ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-950" />
                    )}
                    <span>
                      {precachingAudio ? 'خەریکی داگرتنە...' : `📥 داگرتنی دەنگی (${currentSession.items.length}) کاڵاکە بۆ ئۆفلاین`}
                    </span>
                  </button>

                  {precacheAudioStatus && (
                    <div className="p-2 rounded-xl bg-white border border-amber-300 text-[11px] font-bold text-amber-900 text-center">
                      {precacheAudioStatus}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: ElevenLabs Studio Voice API (Optional) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <span className="font-black text-slate-900 text-xs block">
                  ٣. بەستنەوەی زیرەکی دەستکردی ElevenLabs (ئارەزوومەندانە):
                </span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  سیستەمەکە خۆی بەخۆڕایی بە دەنگی ئۆفلاین دەخوێنێتەوە. ئەگەر پێت باشە دەنگەکە وەک مرۆڤی ستۆدیۆ بێت لە ڕێگەی دەنگی کوردی ElevenLabs، دەتوانیت کلیلی بەخۆڕایی (Free API Key) لێرە دابنێیت:
                </p>

                <div className="flex gap-2">
                  <input
                    type="password"
                    value={elevenLabsKeyInput}
                    onChange={(e) => setElevenLabsKeyInput(e.target.value)}
                    placeholder="sk_xxxxxxxxxxxxxxxxxxxx (ElevenLabs API Key)"
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={savingAudioSettings || !elevenLabsKeyInput.trim()}
                    onClick={async () => {
                      setSavingAudioSettings(true);
                      setAudioSettingsSavedNotice(null);
                      try {
                        const res = await fetch('/api/warehouse/sheets-sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'save_audio_settings',
                            elevenLabsApiKey: elevenLabsKeyInput.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAudioSettingsSavedNotice('✅ کلیلەکە بە سەرکەوتوویی لە Supabase خەزنکرا!');
                          setElevenLabsKeyInput('');
                        } else {
                          setAudioSettingsSavedNotice('هەڵە لە پاشەکەوتکردن.');
                        }
                      } catch {
                        setAudioSettingsSavedNotice('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
                      } finally {
                        setSavingAudioSettings(false);
                      }
                    }}
                    className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingAudioSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>خەزنکردن</span>
                  </button>
                </div>

                {audioSettingsSavedNotice && (
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] font-bold text-emerald-800 text-center">
                    {audioSettingsSavedNotice}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAudioSettingsModal(false);
                  setAudioSettingsSavedNotice(null);
                  setPrecacheAudioStatus(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs cursor-pointer active:scale-95"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💡 MODAL 3: GOOGLE APPS SCRIPT TUTORIAL & CODE */}
      {/* ========================================================================= */}
      {showHelpScriptModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  چۆن گۆگڵ شیتەکە دەبەستیتەوە بە هاوکاتکردنی ڕاستەوخۆ؟
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpScriptModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700">
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 space-y-2">
                <span className="font-black text-sm block">📌 هەنگاوەکان:</span>
                <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                  <li>لە Google Sheet بچۆ بەشی سەرەوە کلیک لە <strong>Extensions</strong> بکە و پاشان <strong>Apps Script</strong>.</li>
                  <li>تەواوی کۆدە کۆنەکەی ناو Apps Script بسڕەوە و ئەم کۆدە نوێیەی خوارەوە لە شوێنی دابنێ و پاشەکەوتی بکە (Save):</li>
                  <li>لە سەرەوەی پەڕەکە کلیک لە <strong>Deploy &gt; New deployment</strong> بکە (ئەگەر پێشتر کردووتە <strong>Manage deployments &gt; Edit &gt; New version</strong>).</li>
                  <li>جۆرەکە هەڵبژێرە: <strong>Web app</strong> • بەشی <strong>Execute as</strong> بکە <strong>Me</strong> • و زۆر گرنگە بەشی <strong>Who has access</strong> بکەیتە <strong>Anyone</strong> (بۆ ئەوەی گوگڵ داوای لۆگین نەکات).</li>
                  <li>کلیک لە <strong>Deploy</strong> بکە و مۆڵەت بدە (Authorize)، پاشان ئەو لینکەی بەدەست دێت کە بە <code className="font-mono bg-blue-100 px-1 rounded">https://script.google.com/macros/s/.../exec</code> دەستپێدەکات لێرە وەک <strong>Webhook URL</strong> دابنێ!</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">کۆدی نوێی Google Apps Script (نووسینی ڕاستەوخۆ بەبێ تێکدانی کۆڵۆمە ئەسڵییەکان):</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ASHLEY_APPS_SCRIPT_CODE, 'کۆدی سکریپت')}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer active:scale-95"
                  >
                    کۆپیکردنی سکریپت
                  </button>
                </div>

                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto" dir="ltr">
{ASHLEY_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ MODAL 4: OFFICIAL PRINT & PDF REPORT */}
      {/* ========================================================================= */}
      {showPrintModal && currentSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Controls */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  پێشبینینی ڕاپۆرتی فەرمی (چاپکردن و PDF)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپکردن یان داگرتن وەک PDF (Ctrl+P)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 font-sans" id="official-warehouse-print-area">
              
              {/* Official Header */}
              <OfficialPrintHeader
                title={currentSession.mode === 'shipment_receiving' 
                  ? 'ڕاپۆرتی فەرمی پشکنین و داگرتنی باری نوێ' 
                  : 'ڕاپۆرتی فەرمی جەردی دەوری کۆگای ئاشڵی'}
                subtitle={`سێشن: ${currentSession.title} • ڕێکەوت: ${currentSession.createdAt.slice(0, 10)}`}
                documentCode="ASH-DGP-WH-2026"
              />

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-4 gap-3 break-inside-avoid">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">کۆی مۆدێلەکان</span>
                  <span className="text-xl font-black font-mono text-slate-900">{sessionKPIs.totalItems}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">کۆی دانە (چێککراو / پێشبینیکراو)</span>
                  <span className="text-xl font-black font-mono text-blue-700">{sessionKPIs.auditedUnits} / {sessionKPIs.expectedUnits}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">هاوتا و تەواو</span>
                  <span className="text-xl font-black font-mono text-emerald-700">{sessionKPIs.matchedCount} مۆدێل</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">کێشەدار یان شکاو</span>
                  <span className="text-xl font-black font-mono text-rose-700">{sessionKPIs.discrepantCount + sessionKPIs.damagedCount}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="break-inside-avoid">
                <table className="w-full text-right text-[10.5px] border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-black">
                    <tr>
                      <th className="p-2 border border-slate-300 text-center">#</th>
                      <th className="p-2 border border-slate-300">کۆدی مۆدێل</th>
                      <th className="p-2 border border-slate-300">ناوی کاڵا</th>
                      <th className="p-2 border border-slate-300 text-center">کارتۆن (داگیراو/گشتی)</th>
                      <th className="p-2 border border-slate-300 text-center">کارتۆنەکان</th>
                      <th className="p-2 border border-slate-300 text-center">شوێن</th>
                      <th className="p-2 border border-slate-300 text-center">بڕی بارکراو</th>
                      <th className="p-2 border border-slate-300 text-center">بڕی داگیراو</th>
                      <th className="p-2 border border-slate-300 text-center">جیاوازی</th>
                      <th className="p-2 border border-slate-300 text-center">دۆخ</th>
                      <th className="p-2 border border-slate-300 text-center">دواین گۆڕانکاری</th>
                      <th className="p-2 border border-slate-300">تێبینی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold">
                    {currentSession.items.map((i, idx) => {
                      const pcs = i.pcsPerCarton || 1;
                      const expCartons = Math.ceil(i.expectedQty / pcs);
                      const chkCartons = i.checkedCartons !== undefined ? i.checkedCartons : Math.floor(i.checkedQty / pcs);
                      const scannedBoxesStr = Array.isArray(i.scannedCartonNumbers) && i.scannedCartonNumbers.length > 0
                        ? i.scannedCartonNumbers.map(n => `#${n}`).join(', ')
                        : '--';
                      const lastAuditStr = i.lastAuditedAt
                        ? `${new Date(i.lastAuditedAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })} (${i.auditedBy || 'Admin'})`
                        : '--';

                      return (
                        <tr key={i.id} className={i.variance !== 0 ? 'bg-amber-50/50' : i.condition === 'Damaged' ? 'bg-rose-50/50' : ''}>
                          <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border border-slate-300 font-mono font-black" dir="ltr">{i.model}</td>
                          <td className="p-2 border border-slate-300 font-black">{i.name}</td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-bold" dir="ltr">
                            {chkCartons} / {expCartons}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono text-[9px]">
                            {scannedBoxesStr}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">{i.rackLocation || '--'}</td>
                          <td className="p-2 border border-slate-300 text-center font-mono">{i.expectedQty}</td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-black">{i.checkedQty}</td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-black" dir="ltr">
                            {i.variance === 0 ? '0' : i.variance > 0 ? `+${i.variance}` : i.variance}
                          </td>
                          <td className="p-2 border border-slate-300 text-center">
                            {i.condition === 'Damaged'
                              ? `شکاو${i.issueQty ? ` (${i.issueQty} دانە)` : ''} ❌`
                              : i.condition === 'Need Wrapped'
                              ? `پێویست بە تەغلیف${i.issueQty ? ` (${i.issueQty} دانە)` : ''}`
                              : i.condition === 'Wrapped'
                              ? `لەفکراو / تەغلیف${i.issueQty ? ` (${i.issueQty} دانە)` : ''}`
                              : 'ساغ ✅'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono text-[9.5px]">
                            {lastAuditStr}
                          </td>
                          <td className="p-2 border border-slate-300 text-[10px] text-slate-600">{i.notes || '--'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures */}
              <OfficialPrintSignatures
                roles={[
                  'سەرپەرشتیاری پشکنین و داگرتن',
                  'بەڕێوەبەری کۆگا و جەرد',
                  'بەڕێوەبەری گشتی مۆبیلیاتی ئاشڵی'
                ]}
              />

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔄 MODAL 5: GOOGLE SHEETS LIVE SYNC & ADDED COLUMNS */}
      {/* ========================================================================= */}
      {showGooglePushModal && currentSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    گواستنەوەی گۆڕانکارییەکان و زیادکردنی کۆڵۆمەکان بۆ شیت
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium">
                    {currentSession.title}
                    {currentSession.sheetName ? ` — تەنها تەبی «${currentSession.sheetName}»` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGooglePushModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium text-slate-700">
              
              {/* Connection Status Banner */}
              <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
                currentSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(currentSession.webhookUrl.trim())
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                {currentSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(currentSession.webhookUrl.trim()) ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-black text-xs block">
                    {currentSession.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(currentSession.webhookUrl.trim())
                      ? '🟢 بەستەری Apps Script بەستراوە — دەتوانیت گۆڕانکاری بکەیت یان دووبارە تاقی بکەیتەوە'
                      : '⚠️ بۆ نووسینی ڕاستەوخۆ لە ناو Google Sheet، بەستەری Apps Script Web App پێویستە'}
                  </span>
                  <span className="text-[11px] opacity-90">
                    هەروەها هەر کاتێک بتەوێت دەتوانیت لە خوارەوە بە شێوازی Excel (.xlsx) فایلەکە لەگەڵ هەموو کۆڵۆمە زیادکراوەکان دابگریت.
                  </span>
                </div>
              </div>

              {/* Added Columns Highlight */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>کۆڵۆمە زیادکراوەکانی پشکنین و جەرد کە ڕاستەوخۆ لە شیتدا زیاد دەکرێن یان نوێ دەکرێنەوە:</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ١</span>
                    <span className="text-xs font-bold text-slate-800">کارتۆنی داگیراو</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٢</span>
                    <span className="text-xs font-bold text-slate-800">بڕی ژمێردراو</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٣</span>
                    <span className="text-xs font-bold text-slate-800">جیاوازی و ماوە</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٤</span>
                    <span className="text-xs font-bold text-slate-800">دۆخی پشکنین</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٥</span>
                    <span className="text-xs font-bold text-slate-800">دۆخی فیزیکی</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٦</span>
                    <span className="text-xs font-bold text-slate-800">شوێن لە کۆگا</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٧</span>
                    <span className="text-xs font-bold text-slate-800">ناوی پشکێنەر</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center">
                    <span className="text-[10px] text-slate-400 block">کۆڵۆمی ٨</span>
                    <span className="text-xs font-bold text-slate-800">کاتی پشکنین / Scanned At</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-center col-span-2 sm:col-span-4">
                    <span className="text-[10px] text-emerald-700 font-bold">
                      ⏱️ هەموو گۆڕانکارییەک تەنها تەبی «{currentSession.sheetName || currentSession.title}» دەستکاری دەکات و کاتی سکان بە کاتی کوردستان/بەغدا دەنووسرێت
                    </span>
                  </div>
                </div>
              </div>

              {/* Why Google Sheet didn't change automatically */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                <span className="font-black text-xs flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>بۆچی پێویستە لینکی Apps Script Web App دابنێیت و Who has access بکەیتە Anyone؟</span>
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  لینکی ئاسایی شیت (<code className="font-mono bg-amber-100 px-1 rounded">docs.google.com/spreadsheets</code>) تەنها بۆ خوێندنەوەیە. Google بۆ نووسینی ڕاستەوخۆ پێویستی بە <strong>Apps Script Web App</strong> هەیە کە لە بەشی Deploy <strong>Who has access = Anyone</strong> بێت (ئەگەرنا گوگڵ پەڕەی Sign-In دەنێرێتەوە و داتاکان نانووسرێن).
                </p>
              </div>

              {/* Direct Webhook Setup Box */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                <span className="font-black text-xs text-blue-950 block">
                  ⚡ ڕێکخستنی هاوکاتکردنی ڕاستەوخۆ لەگەڵ Google Sheet (بەبێ تێکدانی کۆڵۆمە ئەسڵییەکان):
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-blue-900 leading-relaxed">
                  <li>لە ناو Google Sheetەکەت، کلیک لە <strong>Extensions</strong> بکە و پاشان <strong>Apps Script</strong>.</li>
                  <li>تەواوی کۆدی ئەوێ بسڕەوە و ئەم کۆدە نوێیەی خوارەوە کۆپی بکە و پەیستی بکە پاشان پاشەکەوتی (Save) بکە:</li>
                </ol>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-bold text-slate-700">کۆدی ئۆتۆماتیکی Apps Script:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ASHLEY_APPS_SCRIPT_CODE, 'کۆدی سکریپت')}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>کۆپیکردنی کۆد بە یەک کلیک</span>
                  </button>
                </div>

                <ol start={3} className="list-decimal list-inside space-y-1.5 text-[11px] text-blue-900 leading-relaxed">
                  <li>کلیک لە <strong>Deploy &gt; New deployment</strong> بکە (یاخود <strong>Manage deployments &gt; Edit &gt; New version</strong>)، جۆرەکە بکە <strong>Web app</strong> و <strong>Execute as = Me</strong> و زۆر گرنگە <strong>Who has access = Anyone</strong> هەڵبژێریت.</li>
                  <li>تەنها ئەو لینکە دابنێ کە بە <code className="font-mono bg-blue-100 px-1 rounded">https://script.google.com/macros/s/.../exec</code> دەستپێدەکات و کلیک لە دوگمەی سەوز بکە:</li>
                </ol>

                {/* Webhook Input Field */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-800">
                    بەستەری Webhook URLی گۆگڵ شیت:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={tempWebhookUrl}
                      onChange={(e) => setTempWebhookUrl(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="flex-1 h-10 px-3 rounded-xl border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs bg-white"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={handleSaveWebhookAndPush}
                      disabled={isPushingGoogle || !tempWebhookUrl.trim()}
                      className="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 transition-all shrink-0 shadow-md"
                    >
                      {isPushingGoogle ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>پاشەکەوتکردن و ناردن</span>
                    </button>
                  </div>
                  {pushErrorMsg && (
                    <p className="text-[11px] font-bold text-rose-600 mt-1">
                      {pushErrorMsg}
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-emerald-700 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>داگرتنەوەی فایلی Excel بە هەموو کۆڵۆمەکان</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGooglePushModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer active:scale-95"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗑️ MODAL 6: DELETE CHOICE (SYSTEM ONLY vs GOOGLE SHEET) */}
      {/* ========================================================================= */}
      {deleteDialog && (() => {
        const hasWebhook =
          deleteDialog.kind === 'tab'
            ? Boolean(
                deleteDialog.session.webhookUrl &&
                  /^https:\/\/script\.google(usercontent)?\.com\//.test(
                    deleteDialog.session.webhookUrl.trim()
                  )
              )
            : deleteDialog.tabs.some((t) =>
                Boolean(
                  t.webhookUrl &&
                    /^https:\/\/script\.google(usercontent)?\.com\//.test(t.webhookUrl.trim())
                )
              );

        return (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-rose-950 to-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {deleteDialog.kind === 'tab'
                        ? 'سڕینەوەی بەش'
                        : 'سڕینەوەی تەواوی باکێچی گۆگڵ شیت'}
                    </h3>
                    <p className="text-[11px] text-rose-200 font-medium">
                      {deleteDialog.kind === 'tab'
                        ? deleteDialog.session.sheetName || deleteDialog.session.title
                        : `${deleteDialog.packageTitle} (${deleteDialog.tabs.length} بەش)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deletingAction}
                  onClick={() => setDeleteDialog(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 text-xs text-slate-700">
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 font-bold leading-relaxed">
                  تکایە دیاری بکە داتاکانی گۆگڵ شیتیش بسڕدرێنەوە یان تەنها لە سیستەمەکەی خۆت لاببرێن:
                </div>

                {!hasWebhook && (
                  <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      بۆ سڕینەوەی داتای ناو Google Sheet، پێویستە لینکی Webhook پێشتر بەم فایلەوە بەسترابێتەوە.
                    </span>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  {/* Option 1: System Only */}
                  <button
                    type="button"
                    disabled={deletingAction}
                    onClick={() => handleExecuteDeleteDialog('none')}
                    className="w-full p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-black text-slate-900 block">
                        ١. تەنها لە سیستەمی خۆم بیسڕەوە (داتاکانی گۆگڵ شیت دەستکاری مەکە)
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        فایلی ئەسڵی Google Sheet بە هیچ جۆرێک دەستکاری ناکرێت و وەک خۆی دەمێنێتەوە.
                      </span>
                    </div>
                  </button>

                  {/* Option 2: Clear Audit Columns */}
                  <button
                    type="button"
                    disabled={!hasWebhook || deletingAction}
                    onClick={() => handleExecuteDeleteDialog('clear_audit_columns')}
                    className="w-full p-3.5 rounded-2xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="font-black text-amber-950 block">
                        ٢. لە سیستەم بیسڕەوە + هەموو داتا و کۆڵۆمەکانی پەیوەندیدار بە پرۆگرام لە گۆگڵ شیت لاببە
                      </span>
                      <span className="text-[11px] text-amber-800/80 block mt-0.5">
                        تەواوی کۆڵۆمە زیادکراوەکانی پرۆگرام، کاتی سکان، دۆخ و تێبینی لە Google Sheet دەسڕدرێنەوە تا شیتەکە ببێتەوە بە فۆرمە ئەسڵییەکەی خۆی.
                      </span>
                    </div>
                  </button>

                  {/* Option 3: Delete Tab / Rows in Google Sheet */}
                  <button
                    type="button"
                    disabled={!hasWebhook || deletingAction}
                    onClick={() => handleExecuteDeleteDialog('delete_tab')}
                    className="w-full p-3.5 rounded-2xl border-2 border-rose-200 hover:border-rose-500 hover:bg-rose-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="font-black text-rose-950 block">
                        ٣. لە سیستەم بیسڕەوە + تەواوی بەش/ڕیزەکە لە گۆگڵ شیت بسڕەوە
                      </span>
                      <span className="text-[11px] text-rose-800/80 block mt-0.5">
                        {deleteDialog.kind === 'tab'
                          ? 'ئەو تەبە (یاخود ڕیزەکانی) لە ناو Google Sheet دەسڕدرێتەوە (ئەگەر تاقە تەب بێت ناوەڕۆکەکەی پاک دەکرێتەوە).'
                          : 'هەموو تەبەکانی ئەم فایلە لە سیستەم و لە ناو Google Sheet پاک دەکرێنەوە.'}
                      </span>
                    </div>
                  </button>
                </div>

                {deletingAction && (
                  <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 font-bold flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>تکایە چاوەڕێ بە، خەریکی سڕینەوەی داتاکانین...</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  disabled={deletingAction}
                  onClick={() => setDeleteDialog(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  پەشیمانبوونەوە
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 🧠 MODAL 7: SMART CODE INTELLIGENCE BRIEFING */}
      {/* ========================================================================= */}
      {codeBriefingModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    بەرچاوڕوونی زیرەکی کۆدەکان
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-medium">
                    {codeBriefingModal.title} • {codeBriefingModal.tabsCount} بەش
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCodeBriefingModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              {/* Executive Summary */}
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-1.5">
                <span className="font-black text-xs flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>پوختەی شیکاری زیرەکانە:</span>
                </span>
                <p className="text-xs font-bold leading-relaxed">
                  {codeBriefingModal.profile.kurdishSummary}
                </p>
              </div>

              {/* Tabs Included */}
              {codeBriefingModal.tabNames.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-slate-600 block">
                    بەشە هێنراوەکان ({codeBriefingModal.tabsCount}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {codeBriefingModal.tabNames.map((tName, idx) => (
                      <span
                        key={`${tName}-${idx}`}
                        className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold text-[11px]"
                      >
                        {tName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">کۆی کۆدەکان</span>
                  <span className="text-lg font-black text-slate-900">
                    {codeBriefingModal.profile.totalCodes}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">مۆدێلی جیاواز</span>
                  <span className="text-lg font-black text-blue-700">
                    {codeBriefingModal.profile.uniqueCodes}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">داش (-) و سفر</span>
                  <span className="text-lg font-black text-emerald-700">
                    {codeBriefingModal.profile.patternStats.dashVariant}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 block">پێشگر / پاشگر</span>
                  <span className="text-lg font-black text-indigo-700">
                    {codeBriefingModal.profile.patternStats.prefixed + codeBriefingModal.profile.patternStats.suffixed}
                  </span>
                </div>
              </div>

              {/* Prefixes */}
              {codeBriefingModal.profile.prefixes.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <span className="font-black text-xs text-blue-950 block">
                    پێشگرە دۆزراوەکان (وەک EV یان کدە ئینگلیزییەکانی سەرەتا):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {codeBriefingModal.profile.prefixes.map((p) => (
                      <div
                        key={p.token}
                        className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 flex items-center gap-2"
                      >
                        <span className="font-mono font-black text-blue-700" dir="ltr">
                          {p.token}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          {p.count}×
                        </span>
                        {p.examples[0] && (
                          <span className="font-mono text-[10px] text-slate-500" dir="ltr">
                            ({p.examples[0]})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suffixes */}
              {codeBriefingModal.profile.suffixes.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <span className="font-black text-xs text-purple-950 block">
                    پاشگرە دۆزراوەکان (وەک -BALK یان ڕەنگ و جۆری کۆتایی):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {codeBriefingModal.profile.suffixes.map((s) => (
                      <div
                        key={s.token}
                        className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 flex items-center gap-2"
                      >
                        <span className="font-mono font-black text-purple-700" dir="ltr">
                          -{s.token}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                          {s.count}×
                        </span>
                        {s.examples[0] && (
                          <span className="font-mono text-[10px] text-slate-500" dir="ltr">
                            ({s.examples[0]})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Formats */}
              {codeBriefingModal.profile.sampleFormats.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-black text-xs text-slate-800 block">
                    نموونەی فۆرماتی کۆدە خوێندراوەکان:
                  </span>
                  <div className="flex flex-wrap gap-1.5" dir="ltr">
                    {codeBriefingModal.profile.sampleFormats.map((fmt, idx) => (
                      <span
                        key={`${fmt}-${idx}`}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-mono font-bold text-[11px] text-slate-800"
                      >
                        {fmt}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {codeBriefingModal.profile.warnings.length > 0 && (
                <div className="space-y-2">
                  <span className="font-black text-xs text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تێبینی گرنگ بۆ سکانکردن:</span>
                  </span>
                  {codeBriefingModal.profile.warnings.map((w, idx) => (
                    <div
                      key={`${w.kind}-${idx}`}
                      className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1"
                    >
                      <p className="font-bold text-xs">{w.message}</p>
                      {w.models.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5" dir="ltr">
                          {w.models.slice(0, 6).map((m, mIdx) => (
                            <span
                              key={`${m}-${mIdx}`}
                              className="px-2 py-0.5 rounded bg-white/80 border border-amber-300 font-mono text-[10px]"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setCodeBriefingModal(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer active:scale-95"
              >
                باشە، دەستپێبکە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🧹 MODAL 8: FULL RESET & GOOGLE SHEETS PROGRAM ARTIFACT CLEANUP */}
      {/* ========================================================================= */}
      {showWipeAllModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-rose-950 to-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/25 border border-rose-400/35 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">سفرکردنەوە و پاککردنەوەی هەموو داتاکان</h3>
                  <p className="text-[11px] text-rose-200 font-medium">
                    هەموو شیتەکان ({sessions.length} بەش) لە هەموو مۆبایل و کۆمپیوتەرەکان سفر دەبنەوە
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={wipingAll}
                onClick={() => setShowWipeAllModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 font-bold leading-relaxed">
                دیاری بکە لە کاتی سفرکردنەوەی پرۆگرام، چۆن مامەڵە لەگەڵ فایلەکانی Google Sheet بکەیت:
              </div>

              {(() => {
                const hasAnyWebhook = sessions.some(
                  (s) => s.webhookUrl && /^https:\/\/script\.google(usercontent)?\.com\//.test(s.webhookUrl.trim())
                );
                return (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      disabled={wipingAll || !hasAnyWebhook}
                      onClick={() => handleExecuteWipeAll('clear_audit_columns')}
                      className="w-full p-3.5 rounded-2xl border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="font-black text-emerald-950 block">
                          ١. سفرکردنەوەی تەواوی پرۆگرام + لابردنی هەموو شوێنەوارێکی پرۆگرام لە گۆگڵ شیت (پێشنیازکراو)
                        </span>
                        <span className="text-[11px] text-emerald-800/90 block mt-0.5">
                          هەموو شیتەکانی سیستەم دەسڕدرێنەوە و لە ناو هەموو گۆگڵ شیتە بەستراوەکاندا تەواوی کۆڵۆم و داتاکانی پرۆگرام دەسڕدرێنەوە تا داتای شیتە ئەسڵییەکانت بە پاکژی بمێننەوە.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={wipingAll || !hasAnyWebhook}
                      onClick={() => handleExecuteWipeAll('delete_tab')}
                      className="w-full p-3.5 rounded-2xl border-2 border-rose-200 hover:border-rose-500 hover:bg-rose-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <span className="font-black text-rose-950 block">
                          ٢. سفرکردنەوەی پرۆگرام + بەتاڵکردنەوەی ناوەڕۆکی هەموو گۆگڵ شیتەکان
                        </span>
                        <span className="text-[11px] text-rose-800/80 block mt-0.5">
                          لە پرۆگرام و لە ناو Google Sheetیشدا بەش و ڕیزەکان سفر و پاک دەکرێنەوە.
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={wipingAll}
                      onClick={() => handleExecuteWipeAll('none')}
                      className="w-full p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <span className="font-black text-slate-900 block">
                          ٣. تەنها پرۆگرام سفر بکەرەوە (دەستکاری گۆگڵ شیت مەکە)
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          هەموو شیتەکانی سیستەم سفر دەبنەوە و فایلەکانی Google Sheet وەک خۆیان دەمێننەوە.
                        </span>
                      </div>
                    </button>

                    {!hasAnyWebhook && (
                      <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-medium">
                        تێبینی: هیچ بەستەرێکی Webhook بە شیتەکانەوە نەبەستراوەتەوە، بۆیە بژاردەکانی پاککردنەوەی گۆگڵ شیت ناچالاکن.
                      </div>
                    )}
                  </div>
                );
              })()}

              {wipingAll && (
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 font-bold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>تکایە چاوەڕێ بە، خەریکی سفرکردنەوەی تەواوی داتاکانین...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                disabled={wipingAll}
                onClick={() => setShowWipeAllModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                پەشیمانبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🛡️ MODAL 9: SMART TWO-WAY SYNC CONTROL CENTER (PROGRAM <-> GOOGLE SHEET) */}
      {/* ========================================================================= */}
      {showSyncControlModal && currentSession && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/25 border border-indigo-400/35 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    ناوەندی زیرەکی کۆنترۆڵی داتاکان (پرۆگرام ↔ گۆگڵ شیت)
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-medium">
                    بەشی «{currentSession.sheetName || currentSession.title}» • بەراوردکردن، تێکەڵنەبوون و هاوکاتکردنی ورد
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={syncApplying}
                onClick={() => setShowSyncControlModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 ashley-cell-scroll">
              {/* Current Sync Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-bold">دواین هاوکاتکردن لەگەڵ گۆگڵ شیت</span>
                  <span className="text-xs font-black font-mono text-slate-900 mt-0.5 block" dir="ltr">
                    {currentSession.lastGoogleSyncedAt
                      ? new Date(currentSession.lastGoogleSyncedAt).toLocaleString('en-GB', {
                          timeZone: 'Asia/Baghdad',
                          hour12: false,
                        })
                      : 'هێشتا تۆمار نەکراوە'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block font-bold">پشکنینی جیاوازی زیندوو</span>
                  <span className="text-xs font-black text-indigo-700 mt-0.5 block">
                    {syncInspecting
                      ? 'خەریکی خوێندنەوەی گۆگڵ شیتە...'
                      : syncInspectionResult
                      ? syncInspectionResult.summary.isInSync
                        ? '🟢 ١٠٠٪ هاوتایە لەگەڵ گۆگڵ شیت'
                        : `⚠️ ${
                            syncInspectionResult.summary.newInGoogle +
                            syncInspectionResult.summary.masterChanged +
                            syncInspectionResult.summary.scanDiff +
                            syncInspectionResult.summary.removedInGoogle
                          } جیاوازی دۆزرایەوە`
                      : 'بۆ پشکنین دوگمەکە دابگرە'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">نوێکردنەوەی بەراورد</span>
                    <span className="text-[11px] font-bold text-slate-800">خوێندنەوەی گۆگڵ شیت</span>
                  </div>
                  <button
                    type="button"
                    disabled={syncInspecting || syncApplying}
                    onClick={handleInspectGoogleDiff}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncInspecting ? 'animate-spin' : ''}`} />
                    <span>بەراورد بکە</span>
                  </button>
                </div>
              </div>

              {pushErrorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{pushErrorMsg}</span>
                </div>
              )}

              {/* Diff Inspection Summary */}
              {syncInspecting && (
                <div className="p-6 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 font-bold flex items-center justify-center gap-2.5">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>خەریکی خوێندنەوە و بەراوردکردنی تەبی «{currentSession.sheetName || currentSession.title}» لە Google Sheet...</span>
                </div>
              )}

              {syncInspectionResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 block font-bold">هاوتا</span>
                      <span className="text-base font-black text-emerald-900">{syncInspectionResult.summary.identical}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[10px] text-blue-700 block font-bold">نوێ لە شیت</span>
                      <span className="text-base font-black text-blue-900">{syncInspectionResult.summary.newInGoogle}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-[10px] text-amber-700 block font-bold">بڕ/ناو گۆڕاوە</span>
                      <span className="text-base font-black text-amber-900">{syncInspectionResult.summary.masterChanged}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                      <span className="text-[10px] text-purple-700 block font-bold">جیاوازی سکان</span>
                      <span className="text-base font-black text-purple-900">{syncInspectionResult.summary.scanDiff}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] text-rose-700 block font-bold">لابراو لە شیت</span>
                      <span className="text-base font-black text-rose-900">{syncInspectionResult.summary.removedInGoogle}</span>
                    </div>
                  </div>

                  {syncInspectionResult.diffs.length > 0 && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="max-h-52 overflow-y-auto ashley-cell-scroll">
                        <table className="w-full table-fixed text-right text-[11px] border-collapse">
                          <thead className="bg-slate-100 text-slate-700 font-black sticky top-0">
                            <tr>
                              <th className="p-2.5 w-[135px]">مۆدێل</th>
                              <th className="p-2.5 w-[125px]">جۆری جیاوازی</th>
                              <th className="p-2.5">وردەکاری جیاوازی نێوان پرۆگرام و گۆگڵ شیت</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {syncInspectionResult.diffs.map((d, idx) => (
                              <tr key={`${d.model}-${idx}`} className="hover:bg-slate-50">
                                <td className="p-2 font-mono font-bold truncate" dir="ltr">{d.model}</td>
                                <td className="p-2 font-bold">
                                  {d.kind === 'new_in_google'
                                    ? '🔵 نوێ لە شیت'
                                    : d.kind === 'master_changed'
                                    ? '🟡 گۆڕانی خشتە'
                                    : d.kind === 'scan_diff'
                                    ? '🟣 جیاوازی ژماردن'
                                    : '🔴 لابراو لە شیت'}
                                </td>
                                <td className="p-2 text-slate-700 font-medium">{d.noteKu}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Controlled Reconciliation Actions */}
              <div className="space-y-2 pt-1">
                <span className="font-black text-xs text-slate-900 block">
                  بڕیاری کۆنترۆڵکراو هەڵبژێرە (بەبێ تێکەڵبوونی داتاکان):
                </span>

                <button
                  type="button"
                  disabled={syncApplying || syncInspecting}
                  onClick={() => handleReconcileWithGoogle('smart_merge')}
                  className="w-full p-3.5 rounded-2xl border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-black text-emerald-950 block">
                      ١. تێکەڵکردنی زیرەکانە: نوێکارییەکانی Google Sheet بهێنە + سکانەکانی پرۆگرام بپارێزە (پێشنیازکراو)
                    </span>
                    <span className="text-[11px] text-emerald-800/90 block mt-0.5">
                      کاڵا نوێکان و گۆڕانکارییەکانی «بڕی بارکراو» لە گۆگڵ شیتەوە وەردەگرێت، هەموو ژماردن و سکانەکانی ناو مۆبایل و پرۆگرام بە تەواوی دەپارێزێت، و دواتر بە یەکجار دەیاننێرێتەوە بۆ Google Sheet.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={syncApplying || syncInspecting}
                  onClick={() => handleReconcileWithGoogle('push_program_to_google')}
                  className="w-full p-3.5 rounded-2xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-black text-blue-950 block">
                      ٢. ناردنی داتای ناو پرۆگرام بۆ گۆگڵ شیت (Program ← Google Sheet)
                    </span>
                    <span className="text-[11px] text-blue-800/80 block mt-0.5">
                      ئەوەی لە سیستەمەکەدایە وەک سەرچاوەی سەرەکی دادەنێت و تەنها تەبی «{currentSession.sheetName || currentSession.title}» لە Google Sheet پێی نوێ دەکاتەوە.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={syncApplying || syncInspecting}
                  onClick={() => handleReconcileWithGoogle('pull_google_overwrite')}
                  className="w-full p-3.5 rounded-2xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50/70 text-right transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="font-black text-amber-950 block">
                      ٣. هێنانەوەی سەرلەنوێ لە گۆگڵ شیتەوە (Google Sheet ← Program)
                    </span>
                    <span className="text-[11px] text-amber-800/80 block mt-0.5">
                      ئەگەر گۆڕانکاری گرنگت لە ناو Google Sheetدا کردووە و دەتەوێت تەواوی ئەم تەبە لە سیستەمدا لە شیتەکەوە بخوێندرێتەوە.
                    </span>
                  </div>
                </button>
              </div>

              {syncApplying && (
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>خەریکی هاوکاتکردن و ڕێکخستنی داتاکانین...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                disabled={syncApplying}
                onClick={() => setShowSyncControlModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer disabled:opacity-50"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎥 SMART MOBILE CAMERA CARTON SCANNER (FULL SCREEN) */}
      {/* ========================================================================= */}
      {currentSession && (
        <SmartCameraCartonScanner
          session={currentSession}
          allSessions={sessions}
          onSelectSession={(nextSession) => {
            triggerHaptic('light');
            setWarehouseSection(nextSession.mode || 'shipment_receiving');
            setInputMode(nextSession.mode || 'shipment_receiving');
            setCurrentSession(nextSession);
            if (typeof window !== 'undefined') {
              localStorage.setItem(ACTIVE_SESSION_ID_KEY, nextSession.id);
            }
          }}
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onUpdateSession={async (upd) => persistSession(upd)}
        />
      )}

      {/* Smart Inner-Cell Scrollbars & Global Print Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        .ashley-cell-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(100, 116, 139, 0.42) rgba(241, 245, 249, 0.55);
          overscroll-behavior: contain;
        }
        .ashley-cell-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .ashley-cell-scroll::-webkit-scrollbar-track {
          background: rgba(241, 245, 249, 0.65);
          border-radius: 9999px;
        }
        .ashley-cell-scroll::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.38);
          border-radius: 9999px;
        }
        .ashley-cell-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.65);
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-warehouse-print-area, #official-warehouse-print-area * {
            visibility: visible !important;
          }
          #official-warehouse-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8mm !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 999999 !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
        }
      `}} />

    </div>
  );
}
