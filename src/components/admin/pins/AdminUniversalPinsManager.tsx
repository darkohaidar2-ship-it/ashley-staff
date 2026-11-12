'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
  KeyRound, 
  ShieldCheck, 
  MessageSquareHeart, 
  Boxes, 
  Fingerprint, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  RotateCcw, 
  ExternalLink, 
  Sparkles, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Dices, 
  Users, 
  User, 
  Clock, 
  Info,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { 
  FeedbackPin, 
  PinScope, 
  generatePinForScope, 
  determinePinScope 
} from '@/lib/feedback/feedback-service';
import { ASHLEY_OFFICIAL_EMPLOYEES, OFFICIAL_PIN_MAP } from '@/lib/ashley-employees';

type SectionFilter = 'all' | 'manager' | 'staff' | 'warehouse' | 'attendance';

export function AdminUniversalPinsManager() {
  const [activeFilter, setActiveFilter] = useState<SectionFilter>('all');
  const [pins, setPins] = useState<Record<string, FeedbackPin>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Search filter for employees
  const [empSearch, setEmpSearch] = useState<string>('');
  const [showEmpPins, setShowEmpPins] = useState<boolean>(true);

  // Forms state for quick PIN creation
  const [createScope, setCreateScope] = useState<PinScope>('manager_feedback');
  const [customPinInput, setCustomPinInput] = useState<string>('');
  const [targetNameInput, setTargetNameInput] = useState<string>('');
  const [targetPhoneInput, setTargetPhoneInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSingleUse, setIsSingleUse] = useState<boolean>(false);

  // Batch modal / controls
  const [batchCount, setBatchCount] = useState<number>(5);

  // 1. Fetch all PINs
  const fetchAllPins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/feedback/admin?_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.pins) {
          setPins(data.pins);
        }
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'هەڵە لە وەرگرتنی کۆدەکان لە سێرڤەر.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPins();
  }, [fetchAllPins]);

  // Show status toast
  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 2. Copy helper
  const handleCopy = (text: string, key: string, label: string = 'کۆدی PIN') => {
    triggerHaptic('success');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast('success', `${label} (${text}) بە سەرکەوتوویی کۆپی کرا!`);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  // 3. Generate random PIN for form
  const handleRollDice = (scope: PinScope) => {
    triggerHaptic('light');
    const rolled = generatePinForScope(scope);
    setCustomPinInput(rolled);
  };

  // 4. Create Single PIN Handler
  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPinInput.trim()) {
      showToast('error', 'تکایە ژمارەی PIN بنووسە یان دوگمەی 🎲 بەکاربهێنە.');
      return;
    }

    const expectedLen = createScope === 'warehouse' ? 5 : 4;
    if (customPinInput.trim().length !== expectedLen) {
      showToast('error', `دەبێت PIN بۆ ئەم بەشە بە تەواوی ${expectedLen} ژمارە بێت.`);
      return;
    }

    // Verify scope math
    if (createScope === 'manager_feedback') {
      const val = parseInt(customPinInput.trim(), 10);
      if (val < 0 || val > 5999) {
        showToast('error', 'کۆدی بەڕێوەبەر دەبێت لە نێوان 0000 بۆ 5999 بێت.');
        return;
      }
    } else if (createScope === 'staff_feedback') {
      const val = parseInt(customPinInput.trim(), 10);
      if (val < 6000 || val > 9999) {
        showToast('error', 'کۆدی فیدباکی کارمەندان دەبێت لە نێوان 6000 بۆ 9999 بێت.');
        return;
      }
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_pin',
          customPin: customPinInput.trim(),
          scope: createScope,
          targetName: targetNameInput.trim() || undefined,
          targetPhone: targetPhoneInput.trim() || undefined,
          notes: notesInput.trim() || undefined,
          isSingleUse: isSingleUse,
          createdBy: 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success && data.pin) {
        triggerHaptic('success');
        showToast('success', `کۆدی PIN (${data.pin.pin}) بە سەرکەوتوویی دروستکرا!`);
        setPins((prev) => ({ ...prev, [data.pin.pin]: data.pin }));
        setCustomPinInput('');
        setTargetNameInput('');
        setTargetPhoneInput('');
        setNotesInput('');
      } else {
        triggerHaptic('error');
        showToast('error', data.error || 'دروستکردنی کۆد سەرکەوتوو نەبوو.');
      }
    } catch {
      triggerHaptic('error');
      showToast('error', 'هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Batch create PINs
  const handleBatchCreate = async (scope: PinScope) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_pins',
          scope,
          count: batchCount,
          isSingleUse: true,
          notes: `Batch generation (${scope})`,
          createdBy: 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success && data.pins) {
        triggerHaptic('success');
        showToast('success', `${data.pins.length} کۆدی نوێی PIN بە سەرکەوتوویی دروستکران!`);
        fetchAllPins();
      } else {
        triggerHaptic('error');
        showToast('error', data.error || 'دروستکردنی بەکۆمەڵ سەرکەوتوو نەبوو.');
      }
    } catch {
      triggerHaptic('error');
      showToast('error', 'هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Delete PIN
  const handleDeletePin = async (pinToDelete: string) => {
    if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم کۆدەی PIN (${pinToDelete})؟`)) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_pin', pin: pinToDelete }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        showToast('success', `کۆدی PIN (${pinToDelete}) بە سەرکەوتوویی سڕایەوە.`);
        setPins((prev) => {
          const next = { ...prev };
          delete next[pinToDelete];
          return next;
        });
      } else {
        triggerHaptic('error');
        showToast('error', data.error || 'سڕینەوە سەرکەوتوو نەبوو.');
      }
    } catch {
      triggerHaptic('error');
      showToast('error', 'هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Reset PIN
  const handleResetPin = async (pinToReset: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_pin', pin: pinToReset }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        showToast('success', `کۆدی PIN (${pinToReset}) کارا کرایەوە و بەکارهێنانی سڕایەوە.`);
        fetchAllPins();
      } else {
        triggerHaptic('error');
        showToast('error', data.error || 'نوێکردنەوە سەرکەوتوو نەبوو.');
      }
    } catch {
      triggerHaptic('error');
      showToast('error', 'هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered lists of PINs by scope
  const managerPins = useMemo(() => {
    return Object.values(pins).filter(p => p.scope === 'manager_feedback');
  }, [pins]);

  const staffPins = useMemo(() => {
    return Object.values(pins).filter(p => p.scope === 'staff_feedback');
  }, [pins]);

  const warehousePins = useMemo(() => {
    return Object.values(pins).filter(p => p.scope === 'warehouse');
  }, [pins]);

  // Filtered employee attendance PINs
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return ASHLEY_OFFICIAL_EMPLOYEES;
    return ASHLEY_OFFICIAL_EMPLOYEES.filter(e => 
      e.name.toLowerCase().includes(q) ||
      (e.fullName3Part && e.fullName3Part.toLowerCase().includes(q)) ||
      (OFFICIAL_PIN_MAP[e.id] && OFFICIAL_PIN_MAP[e.id].includes(q))
    );
  }, [empSearch]);

  return (
    <div className="space-y-6 text-slate-900 font-sans" dir="rtl">
      
      {/* 🌟 1. HERO TOP BAR & STATS SUMMARY */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              <KeyRound className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900">
                  بەڕێوەبردنی گشتگیری کۆدەکانی PIN بۆ هەموو بەشەکان
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  چالاک و ئۆتۆماتیک
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                لێرە دەتوانیت کۆدی نهێنی (PIN)ی تایبەت بە هەر بەشێک داخڵ بکەیت، بگۆڕیت، دروستی بکەیت و کۆپی بکەیت.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAllPins}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="نوێکردنەوەی داتاکان"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>نوێکردنەوە</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <span>تاقیکردنەوە لە پەڕەی سەرەکی</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Box 1: Manager */}
          <div 
            onClick={() => setActiveFilter('manager')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-98 ${
              activeFilter === 'manager' 
                ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30' 
                : 'bg-amber-50/50 hover:bg-amber-50 border-amber-200/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-900">👑 فیدباکی بەڕێوەبەر</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 font-mono text-[10px] font-black" dir="ltr">
                0000 - 5999
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-950 font-mono">{managerPins.length}</span>
              <span className="text-[11px] text-amber-800 font-bold">کۆدی تۆمارکراو</span>
            </div>
          </div>

          {/* Box 2: Staff Feedback */}
          <div 
            onClick={() => setActiveFilter('staff')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-98 ${
              activeFilter === 'staff' 
                ? 'bg-rose-500/15 border-rose-500 ring-2 ring-rose-500/30' 
                : 'bg-rose-50/50 hover:bg-rose-50 border-rose-200/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-rose-900">👥 فیدباکی کارمەندان</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 font-mono text-[10px] font-black" dir="ltr">
                6000 - 9999
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-950 font-mono">{staffPins.length}</span>
              <span className="text-[11px] text-rose-800 font-bold">کۆدی تۆمارکراو</span>
            </div>
          </div>

          {/* Box 3: Warehouse */}
          <div 
            onClick={() => setActiveFilter('warehouse')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-98 ${
              activeFilter === 'warehouse' 
                ? 'bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/30' 
                : 'bg-blue-50/50 hover:bg-blue-50 border-blue-200/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-blue-900">📦 بەشی کۆگا و جەرد</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 font-mono text-[10px] font-black" dir="ltr">
                ٥ ژمارە
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-blue-950 font-mono">{warehousePins.length}</span>
              <span className="text-[11px] text-blue-800 font-bold">کۆدی تۆمارکراو</span>
            </div>
          </div>

          {/* Box 4: Attendance Login */}
          <div 
            onClick={() => setActiveFilter('attendance')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-98 ${
              activeFilter === 'attendance' 
                ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30' 
                : 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-900">🆔 دەوامی کارمەندان</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 font-mono text-[10px] font-black">
                سەرجەم ستاف
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-950 font-mono">{ASHLEY_OFFICIAL_EMPLOYEES.length}</span>
              <span className="text-[11px] text-emerald-800 font-bold">فەرمانبەری تۆمارکراو</span>
            </div>
          </div>

        </div>
      </div>

      {/* Toast Notification Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top duration-200 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="text-xs font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* 🧭 2. SCOPE SELECTOR TABS TRAY */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            هەموو بەشەکان ({Object.keys(pins).length + ASHLEY_OFFICIAL_EMPLOYEES.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('manager')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              activeFilter === 'manager'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <span>👑 فیدباکی بەڕێوەبەر (0000 - 5999)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('staff')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              activeFilter === 'staff'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-rose-50 text-rose-900 hover:bg-rose-100'
            }`}
          >
            <span>👥 فیدباکی کارمەندان (6000 - 9999)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('warehouse')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              activeFilter === 'warehouse'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-900 hover:bg-blue-100'
            }`}
          >
            <span>📦 بەشی کۆگا (٥ ژمارە)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('attendance')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
              activeFilter === 'attendance'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            }`}
          >
            <span>🆔 دەوامی فەرمانبەران (Attendance)</span>
          </button>
        </div>

        {/* Quick Instructions Pill */}
        <div className="text-[11px] text-slate-500 font-bold px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
          💡 هەموو کۆدەکان ڕاستەوخۆ لەگەڵ ئەپەکە هاوکات دەبن
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 👑 SECTION 1: MANAGER FEEDBACK PINs (0000 - 5999) */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'manager') && (
        <div className="bg-white border-2 border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />

          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-700 flex items-center justify-center font-black">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    ١. کۆدەکانی فۆرمی هەڵسەنگاندنی بەڕێوەبەر (Manager Evaluation)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 text-xs font-mono font-black" dir="ltr">
                    مەودا: 0000 - 5999
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  <strong>شوێنی داخڵکردن:</strong> ئەم کۆدانە فۆرمی نهێنی و بێ‌ناوی هەڵسەنگاندنی بەڕێوەبەر لە <code>/feedback</code> دەکەنەوە (شیکاری ئەنجامەکان تەنها لە ئەدمین پانێڵە).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/feedback"
                target="_blank"
                className="h-9 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>کردنەوەی فۆرم</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              </Link>
            </div>
          </div>

          {/* Quick Creation Form for Manager */}
          <form onSubmit={handleCreatePin} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-600" />
                <span>دروستکردنی PINی نوێ بۆ بەڕێوەبەر (0000 - 5999)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreateScope('manager_feedback');
                  handleRollDice('manager_feedback');
                }}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5 text-amber-600" />
                <span>🎲 ژمارەی هەرەمەکی ئامادە</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">کۆدی ٤ ژمارەیی (0000 - 5999):</label>
                <input
                  type="text"
                  maxLength={4}
                  value={createScope === 'manager_feedback' ? customPinInput : ''}
                  onChange={(e) => {
                    setCreateScope('manager_feedback');
                    setCustomPinInput(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="بۆ نموونە: 2026"
                  className="w-full h-10 px-3 rounded-xl border border-amber-300 bg-white text-slate-900 font-mono font-bold text-center text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ناوی بەڕێوەبەر / لێپرسراو:</label>
                <input
                  type="text"
                  value={createScope === 'manager_feedback' ? targetNameInput : ''}
                  onChange={(e) => {
                    setCreateScope('manager_feedback');
                    setTargetNameInput(e.target.value);
                  }}
                  placeholder="بۆ نموونە: بەڕێوەبەری گشتی"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تێبینی یان بەش:</label>
                <input
                  type="text"
                  value={createScope === 'manager_feedback' ? notesInput : ''}
                  onChange={(e) => {
                    setCreateScope('manager_feedback');
                    setNotesInput(e.target.value);
                  }}
                  placeholder="تێبینی..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  onClick={() => setCreateScope('manager_feedback')}
                  className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {actionLoading && createScope === 'manager_feedback' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>تۆمارکردنی کۆدی بەڕێوەبەر</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Table of Manager PINs */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90">
            <table className="w-full text-right text-xs">
              <thead className="bg-amber-50/80 text-amber-950 font-black border-b border-amber-200/80">
                <tr>
                  <th className="p-3">کۆدی PIN</th>
                  <th className="p-3">ناوی لێپرسراو</th>
                  <th className="p-3">تێبینی</th>
                  <th className="p-3">بەستەری ڕاستەوخۆ (Direct URL)</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {managerPins.map((item) => {
                  const directUrl = `https://ashley-staff.vercel.app/feedback?pin=${item.pin}`;
                  const isCopied = copiedKey === `mgr-${item.pin}`;
                  return (
                    <tr key={item.pin} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 font-mono font-black text-sm inline-block" dir="ltr">
                          {item.pin}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.targetName || 'بەڕێوەبەری ئاشڵی'}
                      </td>
                      <td className="p-3 text-slate-500">
                        {item.notes || 'کۆدی سەرەکی بەڕێوەبەر'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600" dir="ltr">
                        <button
                          type="button"
                          onClick={() => handleCopy(directUrl, `url-${item.pin}`, 'بەستەری ڕاستەوخۆ')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-amber-600" />
                          <span>کۆپیکردنی لینک</span>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.pin, `mgr-${item.pin}`, 'کۆدی بەڕێوەبەر')}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            title="کۆپیکردنی کۆد"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePin(item.pin)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                            title="سڕینەوە"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👥 SECTION 2: STAFF FEEDBACK PINs (6000 - 9999) */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'staff') && (
        <div className="bg-white border-2 border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />

          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 flex items-center justify-center font-black">
                <MessageSquareHeart className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    ٢. کۆدەکانی فیدباکی کارمەندان (Staff Evaluation)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-800 text-xs font-mono font-black" dir="ltr">
                    مەودا: 6000 - 9999
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  <strong>شوێنی داخڵکردن:</strong> لە پەڕەی سەرەکی کلیک لەسەر بازنەی فیدباک -&gt; فیدباکی کارمەندان، یان بەستەری <code>/feedback</code> بۆ هەڵسەنگاندنی ٨ فرۆشیار و کاشێرەکە.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/feedback"
                target="_blank"
                className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>کردنەوەی پۆرتاڵ</span>
                <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
              </Link>
            </div>
          </div>

          {/* Quick Creation & Batch for Staff */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Single Creation */}
            <form onSubmit={handleCreatePin} className="lg:col-span-2 p-4 rounded-2xl bg-rose-50/50 border border-rose-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-rose-600" />
                  <span>دروستکردنی PINی تاک (6000 - 9999)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCreateScope('staff_feedback');
                    handleRollDice('staff_feedback');
                  }}
                  className="text-xs font-bold text-rose-800 hover:text-rose-950 flex items-center gap-1 cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5 text-rose-600" />
                  <span>🎲 ژمارەی هەرەمەکی ئامادە</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">کۆدی ٤ ژمارەیی (6000-9999):</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={createScope === 'staff_feedback' ? customPinInput : ''}
                    onChange={(e) => {
                      setCreateScope('staff_feedback');
                      setCustomPinInput(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="بۆ نموونە: 9595"
                    className="w-full h-10 px-3 rounded-xl border border-rose-300 bg-white text-slate-900 font-mono font-bold text-center text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">ناوی موشتەری / لق:</label>
                  <input
                    type="text"
                    value={createScope === 'staff_feedback' ? targetNameInput : ''}
                    onChange={(e) => {
                      setCreateScope('staff_feedback');
                      setTargetNameInput(e.target.value);
                    }}
                    placeholder="ناوی بەشداربوو..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    onClick={() => setCreateScope('staff_feedback')}
                    className="w-full h-10 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {actionLoading && createScope === 'staff_feedback' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>تۆمارکردنی کۆد</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Batch Generator */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>دروستکردنی بەکۆمەڵ (Batch)</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  بە یەک کلیک چەند کۆدێکی ٤ ژمارەیی ڕاستەوخۆ لە مەودای 6000 تا 9999 دروست بکە بۆ پێشانگا.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {[5, 10, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleBatchCreate('staff_feedback')}
                    disabled={actionLoading}
                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    +{num} کۆد
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Table of Staff PINs */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 max-h-72 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-rose-50/80 text-rose-950 font-black border-b border-rose-200/80 sticky top-0">
                <tr>
                  <th className="p-3">کۆدی PIN</th>
                  <th className="p-3">موشتەری / لق</th>
                  <th className="p-3">دۆخ</th>
                  <th className="p-3">بەستەری دەنگدان</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffPins.map((item) => {
                  const voteUrl = `https://ashley-staff.vercel.app/?tab=feedback&pin=${item.pin}`;
                  const isCopied = copiedKey === `staff-${item.pin}`;
                  return (
                    <tr key={item.pin} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className="px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-900 font-mono font-black text-sm inline-block" dir="ltr">
                          {item.pin}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.targetName || 'هەڵسەنگاندنی ئاشڵی'}
                      </td>
                      <td className="p-3">
                        {item.isUsed ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            بەکارهاتووە
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            ئامادەیە بۆ دەنگدان
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600" dir="ltr">
                        <button
                          type="button"
                          onClick={() => handleCopy(voteUrl, `url-${item.pin}`, 'بەستەری دەنگدان')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-rose-600" />
                          <span>کۆپیکردنی لینک</span>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.pin, `staff-${item.pin}`, 'کۆدی دەنگدان')}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            title="کۆپیکردنی کۆد"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPin(item.pin)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all cursor-pointer"
                            title="نوێکردنەوە و کاراکردنەوە"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePin(item.pin)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                            title="سڕینەوە"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 SECTION 3: WAREHOUSE & STOCKTAKE PINs (10000 - 99999) */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'warehouse') && (
        <div className="bg-white border-2 border-blue-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-600" />

          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-700 flex items-center justify-center font-black">
                <Boxes className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    ٣. کۆدەکانی بەشی کۆگا و بار داگرتن (Warehouse Cargo & Inventory)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-800 text-xs font-mono font-black" dir="ltr">
                    مەودا: ٥ ژمارە (10000 - 99999)
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  <strong>شوێنی داخڵکردن:</strong> لە پەڕەی سەرەکی کلیک لەسەر بازنەی چەپ «کۆگا»، یان لەڕێگەی ناونیشانی ڕاستەوخۆی <code>/warehouse/sheets-audit</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/warehouse/sheets-audit"
                target="_blank"
                className="h-9 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>کردنەوەی پۆرتاڵ</span>
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              </Link>
            </div>
          </div>

          {/* Quick Creation Form for Warehouse */}
          <form onSubmit={handleCreatePin} className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>دروستکردنی کۆدی ٥ ژمارەیی نوێ بۆ کۆگا (10000 - 99999)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCreateScope('warehouse');
                  handleRollDice('warehouse');
                }}
                className="text-xs font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5 text-blue-600" />
                <span>🎲 ژمارەی هەرەمەکی ئامادە</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">کۆدی ٥ ژمارەیی:</label>
                <input
                  type="text"
                  maxLength={5}
                  value={createScope === 'warehouse' ? customPinInput : ''}
                  onChange={(e) => {
                    setCreateScope('warehouse');
                    setCustomPinInput(e.target.value.replace(/\D/g, ''));
                  }}
                  placeholder="بۆ نموونە: 54321"
                  className="w-full h-10 px-3 rounded-xl border border-blue-300 bg-white text-slate-900 font-mono font-bold text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">ناوی کارمەند / تیمی کۆگا:</label>
                <input
                  type="text"
                  value={createScope === 'warehouse' ? targetNameInput : ''}
                  onChange={(e) => {
                    setCreateScope('warehouse');
                    setTargetNameInput(e.target.value);
                  }}
                  placeholder="بۆ نموونە: تیمی جەرد"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تێبینی:</label>
                <input
                  type="text"
                  value={createScope === 'warehouse' ? notesInput : ''}
                  onChange={(e) => {
                    setCreateScope('warehouse');
                    setNotesInput(e.target.value);
                  }}
                  placeholder="تێبینی بار یان جەرد..."
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={actionLoading}
                  onClick={() => setCreateScope('warehouse')}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                >
                  {actionLoading && createScope === 'warehouse' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>تۆمارکردنی کۆدی کۆگا</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Table of Warehouse PINs */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90">
            <table className="w-full text-right text-xs">
              <thead className="bg-blue-50/80 text-blue-950 font-black border-b border-blue-200/80">
                <tr>
                  <th className="p-3">کۆدی ٥ ژمارەیی</th>
                  <th className="p-3">ناوی تیمی کۆگا</th>
                  <th className="p-3">تێبینی</th>
                  <th className="p-3">بەستەری ڕاستەوخۆ (Direct URL)</th>
                  <th className="p-3 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehousePins.map((item) => {
                  const warehouseUrl = `https://ashley-staff.vercel.app/?tab=warehouse&pin=${item.pin}`;
                  const isCopied = copiedKey === `wh-${item.pin}`;
                  return (
                    <tr key={item.pin} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className="px-3 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-900 font-mono font-black text-sm inline-block" dir="ltr">
                          {item.pin}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.targetName || 'تیمی کۆگا و جەرد'}
                      </td>
                      <td className="p-3 text-slate-500">
                        {item.notes || 'کۆدی ٥ ژمارەیی بەشی کۆگا'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600" dir="ltr">
                        <button
                          type="button"
                          onClick={() => handleCopy(warehouseUrl, `url-${item.pin}`, 'بەستەری کۆگا')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-blue-600" />
                          <span>کۆپیکردنی لینک</span>
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.pin, `wh-${item.pin}`, 'کۆدی کۆگا')}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            title="کۆپیکردنی کۆد"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePin(item.pin)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all cursor-pointer"
                            title="سڕینەوە"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🆔 SECTION 4: EMPLOYEE ATTENDANCE PINs (سەرجەم کارمەندانی دەوام) */}
      {/* ========================================================================= */}
      {(activeFilter === 'all' || activeFilter === 'attendance') && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-600" />

          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 flex items-center justify-center font-black">
                <Fingerprint className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">
                    ٤. کۆدەکانی دەوامی فەرمی کارمەندان (Attendance Login PINs)
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-mono font-black">
                    {ASHLEY_OFFICIAL_EMPLOYEES.length} کارمەند
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  <strong>شوێنی داخڵکردن:</strong> کارمەند کاتێک کلیک لە بازنەی سەرەوە «ئامادەبوون» یان <code>/attendance/mobile</code> دەکات، بەم کۆدە ٤ ژمارەییە لۆگ ئین دەکات بۆ تۆمارکردنی کاتی دەوام.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmpPins(!showEmpPins)}
                className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {showEmpPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showEmpPins ? 'شاردنەوەی PIN' : 'نیشاندانی PIN'}</span>
              </button>

              <Link
                href="/attendance/mobile"
                target="_blank"
                className="h-9 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>کردنەوەی پۆرتاڵ</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="گەڕان بەپێی ناوی کارمەند یان PIN..."
              className="w-full h-10 pr-10 pl-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>

          {/* Employee PIN Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredEmployees.map((emp) => {
              const officialPin = OFFICIAL_PIN_MAP[emp.id] || emp.pin || '1001';
              const isCopied = copiedKey === `emp-${emp.id}`;
              return (
                <div
                  key={emp.id}
                  className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition-all shadow-2xs flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                      {emp.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 truncate">
                        {emp.name}
                      </h4>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {emp.role || 'کارمەند'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span 
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 font-mono font-black text-xs" 
                      dir="ltr"
                    >
                      {showEmpPins ? officialPin : '••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(officialPin, `emp-${emp.id}`, `کۆدی دەوامی ${emp.name}`)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer active:scale-95"
                      title="کۆپیکردنی PIN"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
