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
  Bot
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';
import { SheetsAuditItem, SheetsAuditSession } from '@/app/api/warehouse/sheets-sync/route';
import { SmartCameraCartonScanner } from '@/components/admin/warehouse/SmartCameraCartonScanner';
import * as XLSX from 'xlsx';

export function GoogleSheetsWarehouseAudit() {
  // All Sessions
  const [sessions, setSessions] = useState<SheetsAuditSession[]>([]);
  const [currentSession, setCurrentSession] = useState<SheetsAuditSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [syncingGoogle, setSyncingGoogle] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);

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
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);

  // Connect Google Sheet Form State
  const [importTab, setImportTab] = useState<'url' | 'file' | 'paste' | 'ai'>('url');
  const [inputSheetUrl, setInputSheetUrl] = useState<string>('');
  const [inputRawPaste, setInputRawPaste] = useState<string>('');
  const [inputSessionTitle, setInputSessionTitle] = useState<string>('');
  const [inputMode, setInputMode] = useState<'shipment_receiving' | 'inventory_stocktake'>('shipment_receiving');
  const [inputWebhookUrl, setInputWebhookUrl] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Notification Copy
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 1. Fetch all stored sessions on load
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/sheets-sync', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        if (!currentSession && data.sessions.length > 0) {
          setCurrentSession(data.sessions[0]);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 2. Connect and Import Google Sheet
  const handleConnectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSheetUrl.trim()) return;

    setConnecting(true);
    setConnectError(null);

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fetch_sheet',
          sheetUrl: inputSheetUrl.trim(),
          mode: inputMode,
          title: inputSessionTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.session) {
        // If user also provided a webhook URL, attach it
        const finalSession = {
          ...data.session,
          webhookUrl: inputWebhookUrl.trim() || undefined,
        };

        // Save session with webhook if exists
        if (inputWebhookUrl.trim()) {
          await fetch('/api/warehouse/sheets-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_session', session: finalSession }),
          });
        }

        setCurrentSession(finalSession);
        setSessions(prev => [finalSession, ...prev.filter(s => s.id !== finalSession.id)]);
        setShowConnectModal(false);
        setInputSheetUrl('');
        setInputSessionTitle('');
        setInputWebhookUrl('');
        triggerHaptic('success');
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
        const finalSession = {
          ...data.session,
          webhookUrl: inputWebhookUrl.trim() || undefined,
        };
        if (inputWebhookUrl.trim()) {
          await fetch('/api/warehouse/sheets-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_session', session: finalSession }),
          });
        }
        setCurrentSession(finalSession);
        setSessions(prev => [finalSession, ...prev.filter(s => s.id !== finalSession.id)]);
        setShowConnectModal(false);
        setInputRawPaste('');
        triggerHaptic('success');
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

  // 2b. Import via File Upload (.xlsx, .xls, .csv)
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
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(ws);

        const res = await fetch('/api/warehouse/sheets-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'parse_raw',
            rawText: csvText,
            mode: inputMode,
            title: inputSessionTitle.trim() || file.name.replace(/\.[^/.]+$/, ''),
          }),
        });

        const data = await res.json();
        if (data.success && data.session) {
          const finalSession = {
            ...data.session,
            webhookUrl: inputWebhookUrl.trim() || undefined,
          };
          if (inputWebhookUrl.trim()) {
            await fetch('/api/warehouse/sheets-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'save_session', session: finalSession }),
            });
          }
          setCurrentSession(finalSession);
          setSessions(prev => [finalSession, ...prev.filter(s => s.id !== finalSession.id)]);
          setShowConnectModal(false);
          triggerHaptic('success');
        } else {
          setConnectError(data.error || 'نەتوانرا فایلی ئێکسڵەکە بخوێندرێتەوە.');
        }
      } catch (err: any) {
        setConnectError('هەڵە لە خوێندنەوەی فایلی ئێکسڵ: ' + (err.message || ''));
      } finally {
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
        const finalSession = {
          ...data.session,
          webhookUrl: inputWebhookUrl.trim() || undefined,
        };
        if (inputWebhookUrl.trim()) {
          await fetch('/api/warehouse/sheets-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_session', session: finalSession }),
          });
        }
        setCurrentSession(finalSession);
        setSessions(prev => [finalSession, ...prev.filter(s => s.id !== finalSession.id)]);
        setShowConnectModal(false);
        setInputRawPaste('');
        triggerHaptic('success');
      } else {
        setConnectError(data.error || 'نەتوانرا داتاکە لۆد بکرێت.');
      }
    } catch {
      setConnectError('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setConnecting(false);
    }
  };

  // 3. Save / Auto-sync session to Cloud & Webhook
  const persistSession = useCallback(async (sessionToSave: SheetsAuditSession, isManualSync = false) => {
    if (isManualSync) setSyncingGoogle(true);
    else setSaving(true);

    try {
      const res = await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_session', session: sessionToSave }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        setCurrentSession(data.session);
        setSessions(prev => prev.map(s => s.id === data.session.id ? data.session : s));
        if (isManualSync) {
          setSyncSuccess(true);
          setTimeout(() => setSyncSuccess(false), 3000);
          triggerHaptic('success');
        }
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
      setSyncingGoogle(false);
    }
  }, []);

  // 4. Update an Item Quantity
  const handleUpdateItemQty = (itemId: string, delta: number) => {
    if (!currentSession) return;
    triggerHaptic('light');

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        const nextQty = Math.max(0, (item.checkedQty || 0) + delta);
        const variance = nextQty - item.expectedQty;
        
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
          variance,
          auditStatus,
          lastAuditedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
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
    const qty = parseFloat(newQtyStr) || 0;

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        const variance = qty - item.expectedQty;
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
          variance,
          auditStatus,
          lastAuditedAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
        };
      }
      return item;
    });

    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  // Change Item Condition
  const handleUpdateCondition = (itemId: string, condition: SheetsAuditItem['condition']) => {
    if (!currentSession) return;
    triggerHaptic('light');

    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) {
        let auditStatus = item.auditStatus;
        if (condition === 'Damaged') auditStatus = 'damaged';
        else if (item.checkedQty > 0) {
          auditStatus = item.variance === 0 ? 'verified' : item.variance < 0 ? 'deficit' : 'excess';
        }
        return { ...item, condition, auditStatus };
      }
      return item;
    });

    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

  // Change Item Notes
  const handleUpdateNotes = (itemId: string, notes: string) => {
    if (!currentSession) return;
    const updatedItems = currentSession.items.map(item => {
      if (item.id === itemId) return { ...item, notes };
      return item;
    });
    const updatedSession = { ...currentSession, items: updatedItems };
    setCurrentSession(updatedSession);
    persistSession(updatedSession);
  };

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

  // 6. Delete a session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم سێشنەی پشکنین؟')) return;
    try {
      await fetch('/api/warehouse/sheets-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_session', sessionId }),
      });
      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);
      if (currentSession?.id === sessionId) {
        setCurrentSession(remaining[0] || null);
      }
    } catch {
      alert('هەڵە لە سڕینەوە');
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
        pendingCount: 0,
      };
    }

    const items = currentSession.items;
    let expected = 0;
    let audited = 0;
    let matched = 0;
    let discrepant = 0;
    let damaged = 0;
    let pending = 0;

    items.forEach(i => {
      expected += i.expectedQty || 0;
      audited += i.checkedQty || 0;

      if (i.condition === 'Damaged' || i.auditStatus === 'damaged') damaged++;
      else if (i.checkedQty === 0) pending++;
      else if (i.variance === 0) matched++;
      else discrepant++;
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
      pendingCount: pending,
    };
  }, [currentSession]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!currentSession || currentSession.items.length === 0) {
      alert('هیچ کاڵایەک نییە بۆ هەناردەکردن.');
      return;
    }

    const headers = [
      'کۆدی مۆدێل (Model)',
      'ناوی کاڵا (Item Description)',
      'بڕی تۆمارکراو / بارکراو (Expected Qty)',
      'بڕی ژمێردراو / داگیراو (Audited Qty)',
      'جیاوازی (Variance)',
      'دۆخی کارتۆن و کاڵا (Condition)',
      'دۆخی پشکنین (Audit Status)',
      'شوێن لە کۆگا (Rack Location)',
      'تێبینی (Notes)',
      'کاتی چێککردن'
    ];

    const rows = currentSession.items.map(i => [
      i.model,
      i.name,
      i.expectedQty,
      i.checkedQty,
      i.variance,
      i.condition,
      i.auditStatus === 'verified' ? 'هاوتا و تەواو' : i.auditStatus === 'deficit' ? 'کەمی هەیە' : i.auditStatus === 'excess' ? 'زیادەیە' : i.auditStatus === 'damaged' ? 'زیانلێکەوتوو' : 'چاوەڕوان',
      i.rackLocation || '--',
      i.notes || '--',
      i.lastAuditedAt || '--'
    ]);

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentSession.mode === 'shipment_receiving' ? 'پشکنینی باری نوێ' : 'جەردی کۆگا');
    XLSX.writeFile(wb, `Ashley_${currentSession.mode}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5 text-slate-900 font-sans" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 🌟 1. TOP HEADER & WORKSPACE COMMAND BAR */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  چێککردنەوەی باری نوێ و جەردی کۆگا بە Google Sheets
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  2-Way Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                بەستنەوە بە گۆگڵ شیت، چێککردنەوەی کانتینەر و باری داگیراو، یان جەردکردنی دەوری ڕەفەکانی کۆگا
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* 🎥 Smart Mobile Camera Carton Scanner Button */}
          {currentSession && (
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-amber-500/25 transition-all border border-amber-400/50"
              title="کردنەوەی کامێرای مۆبایل بۆ ژماردنی هۆشمەندی کارتۆنەکان بە دەنگ و ئاگادارکردنەوە"
            >
              <Camera className="w-4 h-4 text-slate-950" />
              <span>ژماردنی زیرەک بە کامێرا</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-mono font-bold">
                {currentSession.items.reduce((acc, it) => acc + (it.checkedCartons || it.scannedCartonNumbers?.length || 0), 0)} / {currentSession.totalCartonsCount || currentSession.items.reduce((acc, it) => acc + (it.cartonCount || it.expectedQty || 1), 0)}
              </span>
            </button>
          )}

          {/* Connect New Google Sheet */}
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-blue-500/15 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>بەستنەوە بە Google Sheet</span>
          </button>

          {/* Sync Now / Google Push */}
          {currentSession && (
            <button
              type="button"
              onClick={() => persistSession(currentSession, true)}
              disabled={syncingGoogle}
              className={`h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                syncSuccess 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="هاوکاتکردنی ڕاستەوخۆ و ناردنی گۆڕانکارییەکان بۆ گۆگڵ شیت"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogle ? 'animate-spin text-blue-600' : ''}`} />
              <span>{syncingGoogle ? 'هاوکات دەکرێت...' : syncSuccess ? 'هاوکاتکرا! ✅' : 'هاوکاتکردنی شیت'}</span>
            </button>
          )}

          {/* Switch Sessions */}
          <button
            type="button"
            onClick={() => setShowSessionsModal(true)}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="بینین و گۆڕینی سێشنەکانی تر"
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>سێشنەکان ({sessions.length})</span>
          </button>

          {/* Export to Excel */}
          {currentSession && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-10 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              title="داگرتنی داتاکان بە فۆرماتی Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          )}

          {/* Print / Official PDF */}
          {currentSession && (
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs transition-all"
              title="ڕاپۆرتی فەرمی PDF بۆ واژوو و چێککردن"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>ڕاپۆرتی PDF</span>
            </button>
          )}

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
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                  <span>بەروار: {currentSession.createdAt.slice(0, 10)}</span>
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
                  persistSession(updated);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
                  persistSession(updated);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono text-rose-700">{sessionKPIs.damagedCount}</span>
                <span className="text-[10px] text-rose-600 font-bold">دانە ❌</span>
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
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">
              هیچ خشتەیەکی چالاک بارنەکراوە
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              کلیک لە دوگمەی خوارەوە بکە و لینکی گۆگڵ شیتی کانتینەر یان جەردی کۆگا دابنێ بۆ دەستپێکردنی پشکنین.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>بەستنەوە بە Google Sheet</span>
          </button>
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

          {/* Audit Matrix Table */}
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <tr>
                    <th className="p-3.5 text-center w-12">#</th>
                    <th className="p-3.5 min-w-[140px]">کۆدی مۆدێل</th>
                    <th className="p-3.5 min-w-[180px]">ناوی کاڵا</th>
                    <th className="p-3.5 text-center min-w-[130px]">کارتۆن (داگیراو / گشتی)</th>
                    <th className="p-3.5 text-center">شوێن لە کۆگا</th>
                    <th className="p-3.5 text-center">
                      {currentSession.mode === 'shipment_receiving' ? 'بڕی بارکراو' : 'بڕی تۆمارکراو'}
                    </th>
                    <th className="p-3.5 text-center min-w-[160px]">
                      {currentSession.mode === 'shipment_receiving' ? 'بڕی وەرگیراو (داگیراو)' : 'بڕی ژمێردراو (جەرد)'}
                    </th>
                    <th className="p-3.5 text-center">جیاوازی</th>
                    <th className="p-3.5 text-center">دۆخی کارتۆن</th>
                    <th className="p-3.5 text-center">دۆخی چێک</th>
                    <th className="p-3.5 min-w-[180px]">تێبینی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-16 text-center text-slate-400 font-bold">
                        هیچ کاڵایەک نەدۆزرایەوە بەپێی ئەم فلتەرە.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isDamaged = item.condition === 'Damaged' || item.auditStatus === 'damaged';
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
                          {/* Row Number */}
                          <td className="p-3.5 text-center font-mono text-[11px] text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Model Code */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-900 text-amber-400 inline-block tracking-wide" dir="ltr">
                                {item.model}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.model, item.model)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                title="کۆپیکردنی کۆد"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Item Name */}
                          <td className="p-3.5 font-bold text-slate-900 max-w-[240px]">
                            <span className="truncate block" title={item.name}>
                              {item.name || '--'}
                            </span>
                          </td>

                          {/* Cartons Count & Progress */}
                          <td className="p-3.5 text-center">
                            {item.cartonCount ? (
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono border ${
                                  (item.checkedCartons || (item.scannedCartonNumbers?.length || 0)) >= item.cartonCount
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : (item.checkedCartons || (item.scannedCartonNumbers?.length || 0)) > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  {item.checkedCartons || (item.scannedCartonNumbers?.length || 0)} / {item.cartonCount} ctn
                                </span>
                                {item.pcsPerCarton && item.pcsPerCarton > 1 && (
                                  <span className="text-[10px] text-slate-400 font-bold">
                                    ({item.pcsPerCarton} دانە/کارتۆن)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">--</span>
                            )}
                          </td>

                          {/* Rack Location */}
                          <td className="p-3.5 text-center">
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
                              {item.rackLocation || '--'}
                            </span>
                          </td>

                          {/* Expected Qty */}
                          <td className="p-3.5 text-center font-mono font-black text-slate-700 text-sm">
                            {item.expectedQty}
                          </td>

                          {/* Checked / Audited Qty with Tactile +/- Controls */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, -1)}
                                className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-800 flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-95"
                                title="کەمکردنەوە بە ١"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <input
                                type="number"
                                value={item.checkedQty}
                                onChange={(e) => handleSetDirectQty(item.id, e.target.value)}
                                className="w-12 text-center font-mono font-black text-sm bg-transparent outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, 1)}
                                className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-black cursor-pointer shadow-xs active:scale-95"
                                title="زیادکردن بە ١"
                              >
                                <Plus className="w-3 h-3" />
                              </button>

                              {/* Fast +5 */}
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.id, 5)}
                                className="px-1.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-mono font-bold cursor-pointer active:scale-95"
                                title="زیادکردنی ٥ دانە"
                              >
                                +5
                              </button>
                            </div>
                          </td>

                          {/* Variance */}
                          <td className="p-3.5 text-center font-mono font-black text-sm">
                            {item.variance === 0 ? (
                              <span className="text-emerald-600">٠</span>
                            ) : item.variance < 0 ? (
                              <span className="text-rose-600" dir="ltr">{item.variance}</span>
                            ) : (
                              <span className="text-blue-600" dir="ltr">+{item.variance}</span>
                            )}
                          </td>

                          {/* Condition Dropdown */}
                          <td className="p-3.5 text-center">
                            <select
                              value={item.condition}
                              onChange={(e) => handleUpdateCondition(item.id, e.target.value as any)}
                              className={`h-8 px-2 rounded-xl text-xs font-bold outline-none cursor-pointer border ${
                                item.condition === 'Damaged'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                                  : item.condition === 'Wrapped'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <option value="Packaged">کارتۆنی ساغ</option>
                              <option value="Wrapped">لەفکراو</option>
                              <option value="Need Wrapped">پێویست بە لەفە</option>
                              <option value="Damaged">تێکچوو / شکاو</option>
                              <option value="Normal">ئاسایی</option>
                            </select>
                          </td>

                          {/* Audit Status Badge */}
                          <td className="p-3.5 text-center">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>هاوتا ✅</span>
                              </span>
                            ) : isDamaged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                <span>شکاو ❌</span>
                              </span>
                            ) : isDeficit ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                <span>کەمە ({item.variance})</span>
                              </span>
                            ) : isExcess ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                <span>زیادە (+{item.variance})</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-bold">
                                چاوەڕوان ⏳
                              </span>
                            )}
                          </td>

                          {/* Notes Inline Input */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateNotes(item.id, e.target.value)}
                              placeholder="تێبینی بنووسە..."
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium outline-none focus:bg-white focus:border-blue-400"
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
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    بەستنەوە بە Google Sheet
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    لینکی شیتەکەت دابنێ بۆ ئەوەی ڕاستەوخۆ داتاکانی بار یان جەرد لۆد بێت
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Import Source Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/90 rounded-2xl mb-4 border border-slate-200/70">
              <button
                type="button"
                onClick={() => { setImportTab('url'); setConnectError(null); }}
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
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    لینکی Google Sheet (بەستەری ئاسایی یان Publish to web):
                  </label>
                  <input
                    type="url"
                    required
                    value={inputSheetUrl}
                    onChange={(e) => setInputSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-blue-500"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    پشتیوانی بەستەری بڵاوکراوە لە وێب (pubhtml) و بەستەری هاوبەشکراو (Anyone with the link) دەکات.
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
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:border-blue-500"
                    dir="ltr"
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
                    <span>لۆدکردن و دەستپێکردنی پشکنین</span>
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

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="w-full h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  سێشنەکانی پشکنین و جەرد ({sessions.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2.5">
              {sessions.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 font-bold">
                  هیچ سێشنێک تۆمار نەکراوە.
                </div>
              ) : (
                sessions.map(s => (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      currentSession?.id === s.id
                        ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-300/40'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-xs truncate">{s.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold">
                          {s.mode === 'shipment_receiving' ? 'باری نوێ' : 'جەرد'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1 flex items-center gap-2">
                        <span>{s.createdAt.slice(0, 10)}</span>
                        <span>•</span>
                        <span>{s.items?.length || 0} کاڵا</span>
                        <span>•</span>
                        <span>{s.totalAuditedUnits || 0} / {s.totalExpectedUnits || 0} دانە</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentSession(s);
                          setShowSessionsModal(false);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer active:scale-95"
                      >
                        کردنەوە
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer active:scale-95"
                        title="سڕینەوە"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
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
                  <li>تەواوی ئەو کۆدە بسڕەوە و ئەم کۆدەی خوارەوە لە شوێنی کۆپی-پەیست بکە:</li>
                  <li>لە سەرەوەی پەڕەکە کلیک لە <strong>Deploy &gt; New deployment</strong> بکە.</li>
                  <li>جۆرەکە هەڵبژێرە: <strong>Web app</strong>، و لە بەشی <strong>Who has access</strong> بیکە بە <strong>Anyone</strong>.</li>
                  <li>کلیک لە <strong>Deploy</strong> بکە و لینکی بەدەستهاتوو وەک <strong>Webhook URL</strong> لێرە دابنێ!</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-slate-900">کۆدی Google Apps Script بۆ کۆپیکردن:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const scriptCode = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    if (data.headers && data.rows) {
      sheet.clear();
      var output = [data.headers];
      data.rows.forEach(function(r) { output.push(r); });
      sheet.getRange(1, 1, output.length, data.headers.length).setValues(output);
      sheet.getRange(1, 1, 1, data.headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.autoResizeColumns(1, data.headers.length);
      return ContentService.createTextOutput(JSON.stringify({success: true, count: data.rows.length})).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({success: false, error: "No data"})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                      handleCopy(scriptCode, 'کۆدی سکریپت');
                    }}
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs cursor-pointer active:scale-95"
                  >
                    کۆپیکردنی سکریپت
                  </button>
                </div>

                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto" dir="ltr">
{`function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    if (data.headers && data.rows) {
      sheet.clear();
      var output = [data.headers];
      data.rows.forEach(function(r) { output.push(r); });
      sheet.getRange(1, 1, output.length, data.headers.length).setValues(output);
      sheet.getRange(1, 1, 1, data.headers.length).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.autoResizeColumns(1, data.headers.length);
      return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`}
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
                      <th className="p-2 border border-slate-300 text-center">شوێن لە کۆگا</th>
                      <th className="p-2 border border-slate-300 text-center">بڕی بارکراو</th>
                      <th className="p-2 border border-slate-300 text-center">بڕی داگیراو</th>
                      <th className="p-2 border border-slate-300 text-center">جیاوازی</th>
                      <th className="p-2 border border-slate-300 text-center">دۆخ</th>
                      <th className="p-2 border border-slate-300">تێبینی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold">
                    {currentSession.items.map((i, idx) => (
                      <tr key={i.id} className={i.variance !== 0 ? 'bg-amber-50/50' : i.condition === 'Damaged' ? 'bg-rose-50/50' : ''}>
                        <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-black" dir="ltr">{i.model}</td>
                        <td className="p-2 border border-slate-300 font-black">{i.name}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono">{i.rackLocation || '--'}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono">{i.expectedQty}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-black">{i.checkedQty}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-black" dir="ltr">
                          {i.variance === 0 ? '0' : i.variance > 0 ? `+${i.variance}` : i.variance}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          {i.condition === 'Damaged' ? 'شکاو ❌' : i.condition === 'Wrapped' ? 'لەفکراو' : 'ساغ ✅'}
                        </td>
                        <td className="p-2 border border-slate-300 text-[10px] text-slate-600">{i.notes || '--'}</td>
                      </tr>
                    ))}
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
      {/* 🎥 SMART MOBILE CAMERA CARTON SCANNER (FULL SCREEN) */}
      {/* ========================================================================= */}
      {currentSession && (
        <SmartCameraCartonScanner
          session={currentSession}
          isOpen={showCameraScanner}
          onClose={() => setShowCameraScanner(false)}
          onUpdateSession={async (upd) => persistSession(upd)}
        />
      )}

      {/* Global Print Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
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
