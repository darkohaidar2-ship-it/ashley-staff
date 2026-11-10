'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  MessageSquareHeart, 
  Sparkles, 
  KeyRound, 
  Search, 
  Plus, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  Star, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Table, 
  BarChart3, 
  Eye, 
  X, 
  Share2, 
  Users, 
  Award,
  RotateCcw,
  Trophy,
  Crown,
  Medal,
  Printer,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  ExternalLink,
  Layers,
  HelpCircle,
  Hash
} from 'lucide-react';
import { 
  FeedbackPin, 
  FeedbackSubmission, 
  TARGET_SALES_CASHIER_STAFF,
  PinScope,
  generatePinForScope,
  determinePinScope
} from '@/lib/feedback/feedback-service';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';
import * as XLSX from 'xlsx';

export function AdminFeedbackDashboard() {
  const searchParams = useSearchParams();

  const [pins, setPins] = useState<Record<string, FeedbackPin>>({});
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view: 'dashboard' | 'submissions' | 'pins'
  // Defaults to 'dashboard' or URL searchParam 'tab'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'submissions' | 'pins'>('dashboard');

  // Synchronize activeTab with URL (?tab=dashboard | ?tab=submissions | ?tab=pins)
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['dashboard', 'submissions', 'pins'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Tab switch handler that updates browser URL without full page reload
  const handleTabChange = (newTab: 'dashboard' | 'submissions' | 'pins') => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.pushState(null, '', url.toString());
    }
  };

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Selected Submission for Detailed View Modal
  const [selectedSubmission, setSelectedSubmission] = useState<FeedbackSubmission | null>(null);

  // Modals
  const [showCreatePinModal, setShowCreatePinModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // New PIN form state
  const [newCustomPin, setNewCustomPin] = useState<string>('');
  const [newTargetPhone, setNewTargetPhone] = useState<string>('');
  const [newTargetName, setNewTargetName] = useState<string>('');
  const [isSingleUse, setIsSingleUse] = useState<boolean>(true);
  const [creatingPin, setCreatingPin] = useState<boolean>(false);
  const [createPinResult, setCreatePinResult] = useState<FeedbackPin | null>(null);

  // Batch PIN state
  const [batchCount, setBatchCount] = useState<number>(5);
  const [batchCreating, setBatchCreating] = useState<boolean>(false);
  const [batchCreatedPins, setBatchCreatedPins] = useState<FeedbackPin[]>([]);

  // 🎯 PIN Scope filtering & creation states
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'all' | 'manager_feedback' | 'staff_feedback' | 'warehouse'>('all');
  const [newPinScope, setNewPinScope] = useState<PinScope>('staff_feedback');
  const [batchScope, setBatchScope] = useState<PinScope>('staff_feedback');

  // Copy notification state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Fetch all feedback data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });

      const data = await res.json();
      if (data.success) {
        setPins(data.pins || {});
        setSubmissions(data.submissions || []);
      } else {
        setError(data.error || 'نەتوانرا داتاکان باربکرێن');
      }
    } catch {
      setError('هەڵە لە پەیوەندی کردن بە سێرڤەر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create single PIN
  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPin(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_pin',
          customPin: newCustomPin,
          scope: newPinScope,
          targetPhone: newTargetPhone,
          targetName: newTargetName,
          isSingleUse,
        }),
      });

      const data = await res.json();
      if (data.success && data.pin) {
        setCreatePinResult(data.pin);
        setNewCustomPin('');
        setNewTargetPhone('');
        setNewTargetName('');
        fetchData();
      } else {
        alert(data.error || 'نەتوانرا دروستبکرێت');
      }
    } catch {
      alert('هەڵە لە دروستکردنی PIN');
    } finally {
      setCreatingPin(false);
    }
  };

  // Create Batch PINs
  const handleCreateBatch = async () => {
    setBatchCreating(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_pins',
          count: batchCount,
          scope: batchScope,
          isSingleUse: batchScope === 'staff_feedback',
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.created)) {
        setBatchCreatedPins(data.created);
        fetchData();
      } else {
        alert(data.error || 'نەتوانرا دروستبکرێت');
      }
    } catch {
      alert('هەڵە لە دروستکردنی بەکۆمەڵ');
    } finally {
      setBatchCreating(false);
    }
  };

  // Delete PIN
  const handleDeletePin = async (pinToDelete: string) => {
    if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم کۆدە (${pinToDelete})؟ ئەم کردارە کۆدەکە و وەڵامەکانی دەسڕێتەوە.`)) return;
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_pin', pin: pinToDelete }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'نەتوانرا بسڕدرێتەوە');
      }
    } catch {
      alert('هەڵە لە سڕینەوە');
    }
  };

  // 🔄 Reset PIN for re-testing
  const handleResetPin = async (pinToReset: string) => {
    if (!confirm(`ئایا دڵنیایت لە پاککردنەوەی داتای ئەم کۆدە (${pinToReset})؟\n\nئەم کردارە وەڵامەکانی تێستی ئەم کۆدە دەسڕێتەوە و کۆدەکە چالاک دەکاتەوە بۆ تێست یان بەکارهێنانی دووبارە.`)) return;
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_pin', pin: pinToReset }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        alert(`کۆدی PIN (${pinToReset}) پاککرایەوە و چالاک بووەوە بۆ تێست.`);
      } else {
        alert(data.error || 'نەتوانرا ڕیسێت بکرێت');
      }
    } catch {
      alert('هەڵە لە پەیوەندیکردن بە سێرڤەر');
    }
  };

  // 🧹 Clear All Test Submissions
  const handleClearAllSubmissions = async () => {
    if (!confirm('⚠️ ئایا دڵنیایت لە سڕینەوەی سەرجەم وەڵام و فیدباکەکانی تێست؟\n\nئەم کردارە هەموو فیدباکەکان پاک دەکاتەوە و هەموو کۆدەکانی PIN دەکاتەوە بە چالاک.')) return;
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all_submissions' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        alert('سەرجەم داتاکانی تێست بە سەرکەوتوویی سڕدرانەوە.');
      } else {
        alert(data.error || 'نەتوانرا پاکبکرێتەوە');
      }
    } catch {
      alert('هەڵە لە سڕینەوەی داتاکان');
    }
  };

  // Delete Submission
  const handleDeleteSubmission = async (id: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم فیدباکە لە سیستەم؟')) return;
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_submission', id }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedSubmission?.id === id) setSelectedSubmission(null);
        fetchData();
      } else {
        alert(data.error || 'نەتوانرا بسڕدرێتەوە');
      }
    } catch {
      alert('هەڵە لە سڕینەوە');
    }
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesSearch = 
        !searchTerm.trim() ||
        s.pin.includes(searchTerm.trim()) ||
        (s.targetPhone && s.targetPhone.includes(searchTerm.trim())) ||
        (s.targetName && s.targetName.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (s.respondentName && s.respondentName.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (s.suggestionsForManagement && s.suggestionsForManagement.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      const matchesRating = ratingFilter === 'all' || Math.round(s.overallSatisfaction).toString() === ratingFilter;

      return matchesSearch && matchesRating;
    });
  }, [submissions, searchTerm, ratingFilter]);

  // 🌟 SALES & CASHIERS LEADERBOARD STATS
  const staffLeaderboard = useMemo(() => {
    const map: Record<string, {
      emp: typeof TARGET_SALES_CASHIER_STAFF[0];
      count: number;
      sumService: number;
      sumPerf: number;
      sumDisc: number;
      sumOverall: number;
    }> = {};

    TARGET_SALES_CASHIER_STAFF.forEach((emp) => {
      map[emp.employeeId] = {
        emp,
        count: 0,
        sumService: 0,
        sumPerf: 0,
        sumDisc: 0,
        sumOverall: 0,
      };
    });

    submissions.forEach((sub) => {
      if (sub.employeeRatings) {
        Object.entries(sub.employeeRatings).forEach(([empId, r]: [string, any]) => {
          if (map[empId] && r) {
            map[empId].count++;
            map[empId].sumService += r.serviceRating || 0;
            map[empId].sumPerf += r.performanceRating || 0;
            map[empId].sumDisc += r.disciplineRating || 0;
            map[empId].sumOverall += r.overallRating || 0;
          }
        });
      }
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        avgOverall: item.count > 0 ? Number((item.sumOverall / item.count).toFixed(1)) : 0,
        avgService: item.count > 0 ? Number((item.sumService / item.count).toFixed(1)) : 0,
        avgPerf: item.count > 0 ? Number((item.sumPerf / item.count).toFixed(1)) : 0,
        avgDisc: item.count > 0 ? Number((item.sumDisc / item.count).toFixed(1)) : 0,
      }))
      .sort((a, b) => {
        // Sort primarily by avgOverall descending
        if (b.avgOverall !== a.avgOverall) return b.avgOverall - a.avgOverall;
        // Then by count descending
        if (b.count !== a.count) return b.count - a.count;
        // Then by avgService descending
        return b.avgService - a.avgService;
      });
  }, [submissions]);

  // Top 3 Podium performers
  const topPerformer = staffLeaderboard[0] || null;
  const secondPerformer = staffLeaderboard[1] || null;
  const thirdPerformer = staffLeaderboard[2] || null;

  // Store-wide metrics & averages across all submissions
  const storeAnalytics = useMemo(() => {
    let totalService = 0;
    let totalPerf = 0;
    let totalDisc = 0;
    let totalStaffRatingsCount = 0;

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    submissions.forEach((s) => {
      const overallRounded = Math.min(5, Math.max(1, Math.round(s.overallSatisfaction || 5)));
      if (distribution[overallRounded] !== undefined) {
        distribution[overallRounded]++;
      }

      if (s.employeeRatings) {
        Object.values(s.employeeRatings).forEach((r: any) => {
          if (r) {
            totalService += r.serviceRating || 0;
            totalPerf += r.performanceRating || 0;
            totalDisc += r.disciplineRating || 0;
            totalStaffRatingsCount++;
          }
        });
      }
    });

    const avgService = totalStaffRatingsCount > 0 ? Number((totalService / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgPerf = totalStaffRatingsCount > 0 ? Number((totalPerf / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgDisc = totalStaffRatingsCount > 0 ? Number((totalDisc / totalStaffRatingsCount).toFixed(1)) : 0;

    return {
      avgService,
      avgPerf,
      avgDisc,
      totalStaffRatingsCount,
      distribution,
    };
  }, [submissions]);

  // Overall General Metrics
  const metrics = useMemo(() => {
    const total = submissions.length;
    if (total === 0) {
      return {
        totalSubmissions: 0,
        avgOverall: 0,
        totalPins: Object.keys(pins).length,
        usedPinsCount: Object.values(pins).filter(p => p.isUsed).length,
        activePinsCount: Object.values(pins).filter(p => !p.isUsed).length,
      };
    }

    let sumOverall = 0;
    submissions.forEach((s) => {
      sumOverall += s.overallSatisfaction || 0;
    });

    const pinValues = Object.values(pins);
    return {
      totalSubmissions: total,
      avgOverall: Number((sumOverall / total).toFixed(1)),
      totalPins: pinValues.length,
      usedPinsCount: pinValues.filter(p => p.isUsed).length,
      activePinsCount: pinValues.filter(p => !p.isUsed).length,
    };
  }, [submissions, pins]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (submissions.length === 0) {
      alert('هیچ فیدباکێک نییە بۆ داگرتن.');
      return;
    }

    const baseHeaders = [
      'کۆدی PIN',
      'ژمارەی مۆبایل',
      'ناوی کارمەند لە PIN',
      'ناوی بەشداربوو',
      'بەرواری ناردن',
      'کاتی ناردن',
      'تێکڕای گشتی (1-5)',
    ];

    const employeeHeaders: string[] = [];
    TARGET_SALES_CASHIER_STAFF.forEach((emp) => {
      employeeHeaders.push(`${emp.name} (${emp.role}) - گشتی`);
      employeeHeaders.push(`${emp.name} - مامەڵە لەگەڵ کڕیار`);
      employeeHeaders.push(`${emp.name} - چالاکی و کار`);
      employeeHeaders.push(`${emp.name} - پابەندبوون بە دەوام`);
      employeeHeaders.push(`${emp.name} - تێبینی`);
    });

    const headers = [...baseHeaders, ...employeeHeaders, 'پێشنیاری گشتی بۆ ئیدارە'];

    const rows = submissions.map((s) => {
      const baseRow = [
        s.pin,
        s.targetPhone || '--',
        s.targetName || '--',
        s.respondentName || '--',
        s.baghdadDate,
        s.baghdadTime,
        s.overallSatisfaction,
      ];

      const empCols: any[] = [];
      TARGET_SALES_CASHIER_STAFF.forEach((emp) => {
        const er = s.employeeRatings ? s.employeeRatings[emp.employeeId] : null;
        if (er) {
          empCols.push(er.overallRating || '--');
          empCols.push(er.serviceRating || '--');
          empCols.push(er.performanceRating || '--');
          empCols.push(er.disciplineRating || '--');
          empCols.push(er.comment || '--');
        } else {
          empCols.push('--', '--', '--', '--', '--');
        }
      });

      return [...baseRow, ...empCols, s.suggestionsForManagement || '--'];
    });

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'هەڵسەنگاندنی فرۆشیار و کاشێر');
    XLSX.writeFile(wb, `Ashley_Sales_Cashier_Evaluation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5 text-slate-900 font-sans" dir="rtl">
      
      {/* 🌟 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <h2 className="text-base font-black text-slate-900">
              داشبۆردی فیدباک و هەڵسەنگاندنی فرۆشیار و کاشێرەکان
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              {submissions.length} فیدباکی تۆمارکراو
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            بەڕێوەبردنی تەواوی سیستەمی فیدباک لەڕێگەی بەستەری ناونیشانەکان (URL Links)، گرافە تایبەتەکان، و ڕاپۆرتی فەرمی PDF
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Direct Link to Standalone Feedback Admin Page */}
          <Link
            href="/feedback/admin"
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all"
            title="کردنەوەی ئەم بەشە لە پەڕەی سەربەخۆی /feedback/admin"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>پەڕەی /feedback/admin</span>
          </Link>

          {/* Official PDF Report button */}
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs transition-all"
            title="بینین و چاپکردنی ڕاپۆرتی فەرمی گشتگیر بە لۆگۆی دیوان و ئاشڵی"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>ڕاپۆرتی فەرمی PDF</span>
          </button>

          {/* New PIN button */}
          <button
            type="button"
            onClick={() => {
              setCreatePinResult(null);
              setShowCreatePinModal(true);
            }}
            className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>دروستکردنی PINی نوێ</span>
          </button>

          {/* Batch PIN button */}
          <button
            type="button"
            onClick={() => {
              setBatchCreatedPins([]);
              setShowBatchModal(true);
            }}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="دروستکردنی چەند PINێک بە یەک کلیک"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>دروستکردنی بەکۆمەڵ</span>
          </button>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-10 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="داگرتنی تەواوی داتاکان بە فۆرماتی Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>داگرتنی Excel</span>
          </button>

          {/* Wipe Test Data button */}
          {submissions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllSubmissions}
              className="h-10 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              title="سڕینەوەی گشت فیدباکەکانی تێست و چالاککردنەوەی هەموو PINەکان"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>سڕینەوەی داتای تێست</span>
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchData}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="نوێکردنەوەی داتاکان"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 📊 2. TOP METRIC TILES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">کۆی فیدباکەکان</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">{metrics.totalSubmissions}</span>
            <span className="text-[10px] text-slate-400 font-bold">وەڵام</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">تێکڕای نمرەی پێشانگا</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-500">⭐ {metrics.avgOverall}</span>
            <span className="text-[10px] text-slate-400 font-bold">لە ٥</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">کۆدە بەکارهاتووەکان</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600">{metrics.usedPinsCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">PIN</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block mb-1">PINە چالاکە بەردەستەکان</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-blue-600">{metrics.activePinsCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">چاوەڕوان</span>
          </div>
        </div>
      </div>

      {/* 🧭 3. TABS NAVIGATION (URL Addressable Pages / Tabs) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          
          {/* Tab 1: Dashboard Link */}
          <button
            type="button"
            onClick={() => handleTabChange('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-amber-500" />
            <span>داشبۆردی فیدباک (گرافەکان)</span>
          </button>

          {/* Tab 2: Submissions Link */}
          <button
            type="button"
            onClick={() => handleTabChange('submissions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'submissions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-blue-600" />
            <span>فیدباکە وەرگیراوەکان ({submissions.length})</span>
          </button>

          {/* Tab 3: PINs Link */}
          <button
            type="button"
            onClick={() => handleTabChange('pins')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pins'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>کۆدەکانی PIN ({Object.keys(pins).length})</span>
          </button>
        </div>

        {/* Copy current page link button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                handleCopy(window.location.href, 'لینکی ئەم بەشە');
              }
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
            title="کۆپیکردنی بەستەری ئەم پەیجە بۆ ئاسان دەستپێڕاگەیشتن"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>کۆپیکردنی لینکی بەشەکە</span>
          </button>

          {copiedText && (
            <div className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5" />
              <span>{copiedText} کۆپی کرا!</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🏆 VIEW 1: DASHBOARD (MAIN VIEW - CHARTS, GOLDEN WINNER, RANKINGS) */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          
          {/* 🌟 PODIUM: 1ST PLACE GOLDEN WINNER & TOP PERFORMERS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* 👑 #1 GOLDEN PERFORMER SPOTLIGHT CARD */}
            {topPerformer ? (
              <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-amber-500/15 via-yellow-400/25 to-amber-500/10 border-2 border-amber-400/90 shadow-xl shadow-amber-500/10 ring-4 ring-amber-400/30">
                {/* Background decorative watermark */}
                <div className="absolute -left-6 -bottom-6 opacity-10 pointer-events-none">
                  <Trophy className="w-56 h-56 text-amber-700" />
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
                  {/* Top Badge Banner */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-amber-300/60">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs shadow-xs">
                      <Crown className="w-4 h-4 fill-slate-950 text-slate-950" />
                      <span>👑 پلەی یەکەم • ئەستێرەی زێڕینی ئاشڵی</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-900 font-black text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                      <span>خاوەنی بەرزترین ڕەزامەندی کڕیاران</span>
                    </div>
                  </div>

                  {/* Winner Info & Avatar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Avatar with shining Golden Ring */}
                      <div className="relative">
                        <div className="w-20 h-20 rounded-3xl bg-amber-200 border-4 border-amber-400 ring-4 ring-yellow-300/60 shadow-lg overflow-hidden flex items-center justify-center text-amber-900 font-black text-xl">
                          {topPerformer.emp.photoUrl ? (
                            <img 
                              src={topPerformer.emp.photoUrl} 
                              alt={topPerformer.emp.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as any).style.display = 'none'; }}
                            />
                          ) : null}
                          <span>{topPerformer.emp.name.slice(0, 1)}</span>
                        </div>
                        {/* Floating Crown above avatar */}
                        <div className="absolute -top-3 -right-2 w-7 h-7 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-slate-950">
                          <Crown className="w-4 h-4 fill-slate-950" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            {topPerformer.emp.fullName}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/30 text-amber-950 border border-amber-400/70 text-xs font-black">
                            {topPerformer.emp.role}
                          </span>
                          <span className="text-xs text-amber-950 font-bold">
                            {topPerformer.count} جار لەلایەن کڕیاران هەڵسەنگێندراوە
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Big Score Card */}
                    <div className="bg-white/90 backdrop-blur-xs border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm text-center min-w-[140px] shrink-0">
                      <span className="text-[11px] font-bold text-amber-900 block mb-0.5">تێکڕای نمرەی زێڕین</span>
                      <div className="flex items-baseline justify-center gap-1 font-mono font-black text-amber-600 text-3xl">
                        <span>{topPerformer.avgOverall}</span>
                        <span className="text-sm text-slate-500 font-bold">/ 5</span>
                      </div>
                      <div className="flex items-center justify-center gap-0.5 mt-1 text-amber-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star 
                            key={s} 
                            className={`w-3.5 h-3.5 ${s <= Math.round(topPerformer.avgOverall) ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3 Golden Progress Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>مامەڵە لەگەڵ کڕیار:</span>
                        <span className="font-mono text-emerald-700 font-black">⭐ {topPerformer.avgService}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${(topPerformer.avgService / 5) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>چالاکی فرۆشتن:</span>
                        <span className="font-mono text-blue-700 font-black">⭐ {topPerformer.avgPerf}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${(topPerformer.avgPerf / 5) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>پابەندبوون بە دەوام:</span>
                        <span className="font-mono text-purple-700 font-black">⭐ {topPerformer.avgDisc}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${(topPerformer.avgDisc / 5) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 🥈 & 🥉 RUNNERS-UP (SILVER & BRONZE CARDS) */}
            <div className="space-y-3 flex flex-col justify-between">
              
              {/* 🥈 2nd Place: Silver Performer */}
              {secondPerformer ? (
                <div className="flex-1 rounded-3xl p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/80 border border-slate-300 shadow-xs ring-2 ring-slate-300/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-black">
                      <Medal className="w-3.5 h-3.5 text-slate-600" />
                      <span>🥈 پلەی دووەم • خەڵاتی زیوین</span>
                    </span>
                    <span className="font-mono font-black text-amber-500 text-sm">
                      ⭐ {secondPerformer.avgOverall} / 5
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200 border-2 border-slate-300 overflow-hidden shrink-0 flex items-center justify-center font-black text-slate-700">
                      {secondPerformer.emp.photoUrl ? (
                        <img 
                          src={secondPerformer.emp.photoUrl} 
                          alt={secondPerformer.emp.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as any).style.display = 'none'; }}
                        />
                      ) : null}
                      <span>{secondPerformer.emp.name.slice(0, 1)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-900 truncate">{secondPerformer.emp.fullName}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-bold">
                        <span>{secondPerformer.emp.role}</span>
                        <span>•</span>
                        <span>{secondPerformer.count} هەڵسەنگاندن</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 grid grid-cols-3 gap-1 text-[10px] text-center font-bold">
                    <div className="bg-white/80 p-1 rounded-lg">کڕیار: <span className="font-mono text-emerald-600 font-black">{secondPerformer.avgService}</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">فرۆشتن: <span className="font-mono text-blue-600 font-black">{secondPerformer.avgPerf}</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">دەوام: <span className="font-mono text-purple-600 font-black">{secondPerformer.avgDisc}</span></div>
                  </div>
                </div>
              ) : null}

              {/* 🥉 3rd Place: Bronze Performer */}
              {thirdPerformer ? (
                <div className="flex-1 rounded-3xl p-4 bg-gradient-to-br from-amber-950/5 via-amber-900/10 to-orange-950/10 border border-amber-700/30 shadow-xs ring-2 ring-amber-700/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-200/50">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black">
                      <Award className="w-3.5 h-3.5 text-amber-700" />
                      <span>🥉 پلەی سێیەم • خەڵاتی برۆنزی</span>
                    </span>
                    <span className="font-mono font-black text-amber-600 text-sm">
                      ⭐ {thirdPerformer.avgOverall} / 5
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 overflow-hidden shrink-0 flex items-center justify-center font-black text-amber-800">
                      {thirdPerformer.emp.photoUrl ? (
                        <img 
                          src={thirdPerformer.emp.photoUrl} 
                          alt={thirdPerformer.emp.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as any).style.display = 'none'; }}
                        />
                      ) : null}
                      <span>{thirdPerformer.emp.name.slice(0, 1)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-slate-900 truncate">{thirdPerformer.emp.fullName}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-bold">
                        <span>{thirdPerformer.emp.role}</span>
                        <span>•</span>
                        <span>{thirdPerformer.count} هەڵسەنگاندن</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-amber-200/50 grid grid-cols-3 gap-1 text-[10px] text-center font-bold">
                    <div className="bg-white/80 p-1 rounded-lg">کڕیار: <span className="font-mono text-emerald-600 font-black">{thirdPerformer.avgService}</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">فرۆشتن: <span className="font-mono text-blue-600 font-black">{thirdPerformer.avgPerf}</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">دەوام: <span className="font-mono text-purple-600 font-black">{thirdPerformer.avgDisc}</span></div>
                  </div>
                </div>
              ) : null}

            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📊 CHART SECTION 1: 8-STAFF COMPARATIVE VERTICAL BAR CHART */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    هێڵکاری بەراوردکاری نمرەی گشتی سەرجەم ٨ کارمەندەکە
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  بەراوردی ڕاستەوخۆ لەسەر تێکڕای ٥ ئەستێرە بەپێی دەنگ و هەڵسەنگاندنی کڕیاران
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-300" />
                  <span>پلەی ١ (زێڕین)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-slate-300" />
                  <span>پلەی ٢ (زیو)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-700" />
                  <span>پلەی ٣ (برۆنز)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>کارمەندانی تر</span>
                </div>
              </div>
            </div>

            {/* The Visual 8-Bar Columns */}
            <div className="relative pt-6">
              {/* Horizontal Reference Benchmark Lines */}
              <div className="absolute inset-x-0 top-6 bottom-16 flex flex-col justify-between pointer-events-none text-[10px] font-mono text-slate-300 select-none">
                <div className="border-b border-dashed border-slate-200 flex items-center justify-between">
                  <span>5.0 (نایاب)</span>
                </div>
                <div className="border-b border-dashed border-slate-200 flex items-center justify-between">
                  <span>4.0 (زۆر باش)</span>
                </div>
                <div className="border-b border-dashed border-slate-200 flex items-center justify-between">
                  <span>3.0 (باش)</span>
                </div>
                <div className="border-b border-dashed border-slate-200 flex items-center justify-between">
                  <span>2.0 (مامناوەند)</span>
                </div>
                <div className="border-b border-dashed border-slate-200 flex items-center justify-between">
                  <span>1.0 (لاواز)</span>
                </div>
              </div>

              {/* 8 Columns Grid */}
              <div className="relative z-10 flex items-end justify-between gap-2 sm:gap-4 h-64 px-2 sm:px-6 pb-2 border-b border-slate-200">
                {staffLeaderboard.map((item, index) => {
                  const scorePercent = (item.avgOverall / 5) * 100;
                  const displayHeight = item.count === 0 ? 12 : Math.max(14, scorePercent);
                  
                  // Specific styling per rank
                  const isFirst = index === 0 && item.count > 0;
                  const isSecond = index === 1 && item.count > 0;
                  const isThird = index === 2 && item.count > 0;

                  return (
                    <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center h-full justify-end group">
                      
                      {/* Score Tag Above the Bar */}
                      <div className="mb-2 text-center transition-transform group-hover:-translate-y-1">
                        {isFirst && (
                          <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs animate-bounce">
                            <Crown className="w-3 h-3 fill-slate-950" />
                          </div>
                        )}
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-black shadow-xs whitespace-nowrap block ${
                          isFirst 
                            ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' 
                            : isSecond 
                            ? 'bg-slate-200 text-slate-900 ring-1 ring-slate-300'
                            : isThird
                            ? 'bg-amber-800 text-white ring-1 ring-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.avgOverall > 0 ? `⭐ ${item.avgOverall}` : '٠'}
                        </span>
                      </div>

                      {/* The Vertical Bar */}
                      <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden flex flex-col justify-end">
                        <div 
                          className={`w-full rounded-t-xl transition-all duration-700 ease-out flex items-center justify-center ${
                            isFirst 
                              ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 ring-2 ring-amber-400 shadow-md shadow-amber-500/30' 
                              : isSecond 
                              ? 'bg-gradient-to-t from-slate-400 to-slate-200 ring-1 ring-slate-300' 
                              : isThird 
                              ? 'bg-gradient-to-t from-amber-800 to-amber-600 ring-1 ring-amber-700' 
                              : 'bg-gradient-to-t from-blue-600 to-sky-400 ring-1 ring-blue-300/60'
                          }`}
                          style={{ height: `${displayHeight}%` }}
                        >
                          <span className="text-[10px] font-bold text-white/90 drop-shadow-xs hidden sm:inline">
                            {item.count > 0 ? `#${index + 1}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Staff Info at X-Axis */}
                      <div className="mt-3 text-center flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden mb-1 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                          {item.emp.photoUrl ? (
                            <img 
                              src={item.emp.photoUrl} 
                              alt={item.emp.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as any).style.display = 'none'; }}
                            />
                          ) : null}
                          <span>{item.emp.name.slice(0, 1)}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900 truncate max-w-[70px] block" title={item.emp.name}>
                          {item.emp.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold hidden sm:block">
                          {item.emp.role}
                        </span>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📊 CHART SECTION 2: 4 QUALITY PILLARS & STAR DISTRIBUTION */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card A: 4 Core Store Dimensions */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    شیکاری ٤ تەوەرە سەرەکییەکەی کوالێتی و ئەدا
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  تێکڕای سەرجەم بەشداربووان لە ٤ لایەنی سەرەکی پێشانگادا
                </p>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-700">١. مامەڵە و ڕەفتار لەگەڵ کڕیار (خزمەتگوزاری):</span>
                      <span className="font-mono text-emerald-600 font-black">⭐ {storeAnalytics.avgService} / 5</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(storeAnalytics.avgService / 5) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-700">٢. چالاکی و لێهاتوویی فرۆشتن (ئەدا):</span>
                      <span className="font-mono text-blue-600 font-black">⭐ {storeAnalytics.avgPerf} / 5</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(storeAnalytics.avgPerf / 5) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-700">٣. پابەندبوون بە دەوام و کات (دیسیپلین):</span>
                      <span className="font-mono text-purple-600 font-black">⭐ {storeAnalytics.avgDisc} / 5</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(storeAnalytics.avgDisc / 5) * 100}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-slate-700">٤. ڕەزامەندی گشتی لە مۆبیلیاتی ئاشڵی:</span>
                      <span className="font-mono text-amber-500 font-black">⭐ {metrics.avgOverall} / 5</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(metrics.avgOverall / 5) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>کۆی دەنگەکانی کارمەندان:</span>
                <span className="font-mono text-slate-900 font-black">{storeAnalytics.totalStaffRatingsCount} دەنگ</span>
              </div>
            </div>

            {/* Card B: Star Distribution Curve (5★ to 1★) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-black text-slate-900">
                    دابەشبوونی نمرەی فیدباکەکان (١ بۆ ٥ ئەستێرە)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-4">
                  ڕێژەی دەنگەکان بەپێی ئاستی ڕەزامەندی بەشداربووان
                </p>

                <div className="space-y-2.5 text-xs">
                  {[5, 4, 3, 2, 1].map((starNum) => {
                    const count = storeAnalytics.distribution[starNum] || 0;
                    const percent = metrics.totalSubmissions > 0 
                      ? Math.round((count / metrics.totalSubmissions) * 100) 
                      : 0;

                    const colorClass = starNum === 5 
                      ? 'bg-emerald-500' 
                      : starNum === 4 
                      ? 'bg-blue-500' 
                      : starNum === 3 
                      ? 'bg-amber-400' 
                      : starNum === 2 
                      ? 'bg-orange-500' 
                      : 'bg-rose-500';

                    return (
                      <div key={starNum} className="flex items-center gap-3">
                        <div className="w-20 font-mono font-bold text-slate-700 flex items-center gap-1 shrink-0">
                          <span>{starNum}</span>
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span className="text-[10px] text-slate-400">
                            {starNum === 5 ? '(نایاب)' : starNum === 4 ? '(زۆرباش)' : starNum === 3 ? '(باش)' : starNum === 2 ? '(ناوەند)' : '(لاواز)'}
                          </span>
                        </div>

                        <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
                        </div>

                        <div className="w-16 text-left font-mono text-[11px] font-bold text-slate-600 shrink-0" dir="ltr">
                          <span>{count}</span>
                          <span className="text-slate-400 text-[10px]"> ({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>بەرزترین ئاست:</span>
                <span className="font-mono text-emerald-600 font-black">
                  {metrics.totalSubmissions > 0 
                    ? `${Math.round(((storeAnalytics.distribution[5] + storeAnalytics.distribution[4]) / metrics.totalSubmissions) * 100)}% ئەرێنی`
                    : '٠%'}
                </span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 📋 SECTION 3: COMPREHENSIVE 8-STAFF ANALYTICS TABLE */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900">
                  خشتەی وردی شیکاری و نمرەی سەرجەم ٨ کارمەندەکە
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                ڕیزکراوە بەپێی تێکڕای نمرەی بەدەستهاتوو
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <tr>
                    <th className="p-3.5 text-center">پلە</th>
                    <th className="p-3.5">کارمەند</th>
                    <th className="p-3.5">ڕۆڵ</th>
                    <th className="p-3.5 text-center">ژمارەی دەنگ</th>
                    <th className="p-3.5 text-center">مامەڵە لەگەڵ کڕیار</th>
                    <th className="p-3.5 text-center">چالاکی فرۆشتن</th>
                    <th className="p-3.5 text-center">پابەندبوون بە دەوام</th>
                    <th className="p-3.5 text-center">تێکڕای گشتی</th>
                    <th className="p-3.5 text-center">شایستەیی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {staffLeaderboard.map((item, index) => {
                    const isFirst = index === 0 && item.count > 0;
                    const isSecond = index === 1 && item.count > 0;
                    const isThird = index === 2 && item.count > 0;

                    return (
                      <tr 
                        key={item.emp.employeeId} 
                        className={`transition-colors ${isFirst ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'}`}
                      >
                        {/* Rank Badge */}
                        <td className="p-3.5 text-center">
                          {isFirst ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                              <Crown className="w-3.5 h-3.5 fill-slate-950" />
                              <span>١ زێڕین</span>
                            </span>
                          ) : isSecond ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-200 text-slate-800 font-black text-xs">
                              <Medal className="w-3.5 h-3.5 text-slate-600" />
                              <span>٢ زیو</span>
                            </span>
                          ) : isThird ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-xs">
                              <Award className="w-3.5 h-3.5 text-amber-700" />
                              <span>٣ برۆنز</span>
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-400">
                              #{index + 1}
                            </span>
                          )}
                        </td>

                        {/* Name and Avatar */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-xs shrink-0">
                              {item.emp.photoUrl ? (
                                <img 
                                  src={item.emp.photoUrl} 
                                  alt={item.emp.name} 
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as any).style.display = 'none'; }}
                                />
                              ) : null}
                              <span>{item.emp.name.slice(0, 1)}</span>
                            </div>
                            <div>
                              <div className="font-black text-slate-900">{item.emp.fullName}</div>
                              <span className="text-[10px] font-mono text-slate-400">ID: {item.emp.employeeId}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {item.emp.role}
                          </span>
                        </td>

                        {/* Count */}
                        <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                          {item.count} جار
                        </td>

                        {/* Service Rating */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-emerald-600 text-xs">
                            {item.avgService > 0 ? `⭐ ${item.avgService}` : '--'}
                          </span>
                        </td>

                        {/* Performance Rating */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-blue-600 text-xs">
                            {item.avgPerf > 0 ? `⭐ ${item.avgPerf}` : '--'}
                          </span>
                        </td>

                        {/* Discipline Rating */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-purple-600 text-xs">
                            {item.avgDisc > 0 ? `⭐ ${item.avgDisc}` : '--'}
                          </span>
                        </td>

                        {/* Overall Rating */}
                        <td className="p-3.5 text-center">
                          <div className={`inline-flex items-center gap-1 font-mono font-black px-2.5 py-1 rounded-xl text-xs ${
                            isFirst 
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <Star className={`w-3.5 h-3.5 ${isFirst ? 'fill-slate-950 text-slate-950' : 'fill-amber-500 text-amber-500'}`} />
                            <span>{item.avgOverall > 0 ? `${item.avgOverall} / 5` : '--'}</span>
                          </div>
                        </td>

                        {/* Merit Badge */}
                        <td className="p-3.5 text-center">
                          {isFirst ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                              ئەستێرەی زێڕین
                            </span>
                          ) : item.avgOverall >= 4.5 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              نایاب
                            </span>
                          ) : item.avgOverall >= 3.5 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                              زۆر باش
                            </span>
                          ) : item.avgOverall > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                              باش
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">چاوەڕوان</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📑 VIEW 2: SUBMISSIONS TABLE */}
      {/* ========================================================================= */}
      {activeTab === 'submissions' && (
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="گەڕان بەپێی PIN، ژمارەی مۆبایل، ناو، یان سەرنجەکان..."
                className="w-full h-10 pr-10 pl-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-blue-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="all">هەموو نمرەکان</option>
                <option value="5">⭐⭐⭐⭐⭐ (٥ ئەستێرە)</option>
                <option value="4">⭐⭐⭐⭐ (٤ ئەستێرە)</option>
                <option value="3">⭐⭐⭐ (٣ ئەستێرە)</option>
                <option value="2">⭐⭐ (٢ ئەستێرە)</option>
                <option value="1">⭐ (١ ئەستێرە)</option>
              </select>

              {submissions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSubmissions}
                  className="h-10 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="سڕینەوەی سەرجەم وەڵامەکانی تێست لە سیستەم"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>سڕینەوەی داتای تێست</span>
                </button>
              )}
            </div>
          </div>

          {/* Submissions List */}
          {loading ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">بارکردنی فیدباکەکان...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500">
              هیچ فیدباکێک نەدۆزرایەوە بەپێی ئەم فلتەرە.
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <tr>
                      <th className="p-3.5">کۆدی PIN</th>
                      <th className="p-3.5">بەشداربوو / مۆبایل</th>
                      <th className="p-3.5 text-center">تێکڕای نمرە</th>
                      <th className="p-3.5 text-center">کارمەندانی هەڵسەنگێندراو</th>
                      <th className="p-3.5">پێشنیاری گشتی</th>
                      <th className="p-3.5">بەروار و کات</th>
                      <th className="p-3.5 text-center">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {filteredSubmissions.map((s) => {
                      const empEvaluationsCount = s.employeeRatings ? Object.keys(s.employeeRatings).length : 0;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 inline-block" dir="ltr">
                              {s.pin}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">
                              {s.respondentName || s.targetName || 'نهێنی (ناونیشان نەکراو)'}
                            </div>
                            {s.targetPhone && (
                              <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                                {s.targetPhone}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-1 font-mono font-black text-amber-500 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                              <Star className="w-3.5 h-3.5 fill-amber-500" />
                              <span>{s.overallSatisfaction} / 5</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                              {empEvaluationsCount > 0 ? `${empEvaluationsCount} کارمەند` : 'گشتی'}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-[200px]">
                            <p className="text-[11px] text-slate-500 truncate">
                              {s.suggestionsForManagement || s.positiveHighlights || 'بێ تێبینی نووسراو'}
                            </p>
                          </td>

                          <td className="p-3.5 text-[11px] font-mono text-slate-500" dir="ltr">
                            {s.baghdadDate} {s.baghdadTime}
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedSubmission(s)}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                title="بینینی تەواوی هەڵسەنگاندنەکان"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>وردەکاری</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteSubmission(s.id)}
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition-all active:scale-95"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔑 VIEW 3: PIN MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'pins' && (
        <div className="space-y-4">
          
          {/* Top Scope Explanation Header Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Manager Feedback (0000 - 5999) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-amber-900">فیدباکی بەڕێوەبەر</h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 font-mono text-[10px] font-bold" dir="ltr">
                    0000 - 5999
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  کۆدی ٤ ژمارەیی تایبەت بۆ بەڕێوەبەر بۆ بینینی داشبۆرد، گراف و شیکاری ٨ کارمەندەکە و دەرهێنانی PDF.
                </p>
              </div>
            </div>

            {/* Card 2: Staff Feedback (6000 - 9999) */}
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black shrink-0">
                👥
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-rose-900">فیدباکی کارمەندان</h4>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 font-mono text-[10px] font-bold" dir="ltr">
                    6000 - 9999
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  کۆدی ٤ ژمارەیی بۆ پڕکردنەوەی هەڵسەنگاندنی ڕۆژانەی کارمەندانی فرۆش و کاشێر لەلایەن کڕیاران و ستاف.
                </p>
              </div>
            </div>

            {/* Card 3: Warehouse (5 digits) */}
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0">
                📦
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-blue-900">بەشی کۆگا و جەرد</h4>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 font-mono text-[10px] font-bold" dir="ltr">
                    ٥ ژمارە (10000 - 99999)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  کۆدی نهێنی ٥ ژمارەیی تایبەت بە کارمەندانی کۆگا بۆ بار داگرتن بە کامێرا و تۆمارکردنی جەرد لە Google Sheets.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar & Scope Filter Pills */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSelectedScopeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedScopeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هەمووی ({Object.keys(pins).length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedScopeFilter('manager_feedback')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedScopeFilter === 'manager_feedback'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <span>👑 بەڕێوەبەر</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/40">
                  {Object.values(pins).filter(p => (p.scope || determinePinScope(p.pin)) === 'manager_feedback').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedScopeFilter('staff_feedback')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedScopeFilter === 'staff_feedback'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <span>👥 کارمەندان</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/40">
                  {Object.values(pins).filter(p => (p.scope || determinePinScope(p.pin)) === 'staff_feedback').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedScopeFilter('warehouse')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedScopeFilter === 'warehouse'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:text-blue-900'
                }`}
              >
                <span>📦 کۆگا (٥ ژمارە)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/40">
                  {Object.values(pins).filter(p => (p.scope || determinePinScope(p.pin)) === 'warehouse').length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatePinResult(null);
                  setShowCreatePinModal(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>دروستکردنی PIN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBatchCreatedPins([]);
                  setShowBatchModal(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>دروستکردنی بەکۆمەڵ</span>
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">بارکردنی PINەکان...</p>
            </div>
          ) : Object.keys(pins).length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500">
              هیچ PINێک تۆمار نەکراوە. کلیک لە دوگمەی سەرەوە بکە بۆ دروستکردن.
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <tr>
                      <th className="p-3.5">کۆدی PIN</th>
                      <th className="p-3.5">بەش و دەسەڵات</th>
                      <th className="p-3.5">بۆ کێیە / مۆبایل</th>
                      <th className="p-3.5">جۆری بەکارهێنان</th>
                      <th className="p-3.5">دۆخ</th>
                      <th className="p-3.5">بەرواری دروستکردن</th>
                      <th className="p-3.5">بەرواری پڕکردنەوە</th>
                      <th className="p-3.5 text-center">کۆپیکردن</th>
                      <th className="p-3.5 text-center">کردارەکان (ڕیسێت / سڕینەوە)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {Object.values(pins)
                      .filter((p) => {
                        const scope = p.scope || determinePinScope(p.pin) || 'staff_feedback';
                        if (selectedScopeFilter === 'all') return true;
                        return scope === selectedScopeFilter;
                      })
                      .map((p) => {
                        const scope = p.scope || determinePinScope(p.pin) || 'staff_feedback';
                        let directUrl = '';
                        if (typeof window !== 'undefined') {
                          if (scope === 'manager_feedback') {
                            directUrl = `${window.location.origin}/feedback/admin?pin=${p.pin}`;
                          } else if (scope === 'warehouse') {
                            directUrl = `${window.location.origin}/?tab=warehouse&pin=${p.pin}`;
                          } else {
                            directUrl = `${window.location.origin}/feedback?pin=${p.pin}`;
                          }
                        }

                        return (
                          <tr key={p.pin} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5">
                              <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-slate-900 text-amber-400 inline-block tracking-wider" dir="ltr">
                                {p.pin}
                              </span>
                            </td>

                            <td className="p-3.5">
                              {scope === 'manager_feedback' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 border border-amber-500/30 font-bold text-[10.5px]">
                                  <span>👑 فیدباکی بەڕێوەبەر</span>
                                  <span className="font-mono text-[9px]">(0000-5999)</span>
                                </span>
                              )}
                              {scope === 'staff_feedback' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-800 border border-rose-500/30 font-bold text-[10.5px]">
                                  <span>👥 فیدباکی کارمەندان</span>
                                  <span className="font-mono text-[9px]">(6000-9999)</span>
                                </span>
                              )}
                              {scope === 'warehouse' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-800 border border-blue-500/30 font-bold text-[10.5px]">
                                  <span>📦 بەشی کۆگا</span>
                                  <span className="font-mono text-[9px]">(٥ ژمارە)</span>
                                </span>
                              )}
                            </td>

                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">
                                {p.targetName || (scope === 'manager_feedback' ? 'بەڕێوەبەری پێشانگا' : scope === 'warehouse' ? 'ستافی کۆگا' : 'کڕیار / گشتی')}
                              </div>
                              {p.targetPhone && (
                                <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                                  {p.targetPhone}
                                </div>
                              )}
                            </td>

                            <td className="p-3.5">
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                                {p.isSingleUse ? 'یەکجار بەکارهێنان' : 'هەمیشەیی / فرەجار'}
                              </span>
                            </td>

                            <td className="p-3.5">
                              {p.isUsed ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>بەکارهێنراوە</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  <span>چالاکە و ئامادەیە</span>
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 font-mono text-[11px] text-slate-500" dir="ltr">
                              {p.createdAt ? p.createdAt.slice(0, 10) : '--'}
                            </td>

                            <td className="p-3.5 font-mono text-[11px] text-slate-500" dir="ltr">
                              {p.usedAt ? p.usedAt.replace('T', ' ').slice(0, 16) : '--'}
                            </td>

                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(p.pin, `PIN (${p.pin})`)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="کۆپیکردنی PIN"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>کۆد</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleCopy(directUrl, `لینکی چوونەژوورەوە`)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                  title="کۆپیکردنی لینکی ڕاستەوخۆ"
                                >
                                  <Share2 className="w-3 h-3" />
                                  <span>لینک</span>
                                </button>
                              </div>
                            </td>

                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Reset for Testing */}
                                <button
                                  type="button"
                                  onClick={() => handleResetPin(p.pin)}
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                                  title="پاککردنەوەی داتای تێستی ئەم کۆدە و چالاککردنەوەی بۆ بەکارهێنانی دووبارە"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>ڕیسێت</span>
                                </button>

                                {/* Delete PIN */}
                                <button
                                  type="button"
                                  onClick={() => handleDeletePin(p.pin)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 cursor-pointer transition-all active:scale-95"
                                  title="سڕینەوەی ئەم PINە"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ MODAL: OFFICIAL PDF PRINT REPORT (Diwan & Ashley Letterhead) */}
      {/* 1. کورتەی گشتگیر • 2. بۆ هەر پرسیارێک گرافێک • 3. فیدباکەکان و PIN ەکانیان */}
      {/* ========================================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl max-h-[94vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Top Modal Controls Bar (Hidden during Print) */}
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white shrink-0 no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Printer className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    پێشبینینی ڕاپۆرتی فەرمی گشتگیر (PDF و چاپکردن)
                  </h3>
                  <span className="text-[11px] text-slate-300">
                    بەشی ١: کورتەی گشتگیر • بەشی ٢: گراف بۆ هەر پرسیارێک • بەشی ٣: فیدباکەکان و PINەکان
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپکردن یان داگرتن وەک PDF (Ctrl+P)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-8 text-slate-900 font-sans" id="official-feedback-print-area">
              
              {/* ========================================================================= */}
              {/* 📑 PART 1: COMPREHENSIVE EXECUTIVE OVERVIEW (بەشی ١: ڕاپۆرتی گشتگیر) */}
              {/* ========================================================================= */}
              <div className="space-y-5">
                
                {/* 1.1 Official Letterhead Header */}
                <OfficialPrintHeader
                  title="ڕاپۆرتی شیکاری فیدباک و هەڵسەنگاندنی کارمەندانی فرۆشیار و کاشێر"
                  subtitle="پوختەی هەڵسەنگاندنی کڕیاران، شیکاری پێوانەیی، و پێشنیارەکانی پەرەپێدان"
                  documentCode="ASH-DGP-FB-2026"
                />

                {/* 1.2 Executive KPI Summary Cards */}
                <div className="grid grid-cols-4 gap-3 break-inside-avoid">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">کۆی فیدباکەکان</span>
                    <span className="text-xl font-black font-mono text-slate-900">{metrics.totalSubmissions}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">تێکڕای نمرەی پێشانگا</span>
                    <span className="text-xl font-black font-mono text-amber-600">⭐ {metrics.avgOverall} / 5</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 text-center">
                    <span className="text-[10px] font-bold text-amber-800 block">ئەستێرەی زێڕینی مانگ</span>
                    <span className="text-xs font-black text-amber-950 truncate block mt-1">
                      👑 {topPerformer?.emp.fullName || 'دیاری نەکراوە'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">ڕێژەی بەشداری PIN</span>
                    <span className="text-xl font-black font-mono text-blue-700">
                      {metrics.usedPinsCount} / {metrics.totalPins}
                    </span>
                  </div>
                </div>

                {/* 1.3 Golden Top Performer Box (Printable Version) */}
                {topPerformer && (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border-2 border-amber-400 flex items-center justify-between gap-4 break-inside-avoid">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-amber-200 border-2 border-amber-400 overflow-hidden flex items-center justify-center font-black text-amber-900 shrink-0">
                        {topPerformer.emp.photoUrl ? (
                          <img 
                            src={topPerformer.emp.photoUrl} 
                            alt={topPerformer.emp.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as any).style.display = 'none'; }}
                          />
                        ) : null}
                        <span>{topPerformer.emp.name.slice(0, 1)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px]">
                            👑 پلەی یەکەم • ئەستێرەی زێڕینی ئاشڵی
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-950 mt-1">{topPerformer.emp.fullName}</h4>
                        <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                          {topPerformer.emp.role} • خاوەنی بەرزترین ئاستی ڕەزامەندی کڕیاران ({topPerformer.count} دەنگ)
                        </p>
                      </div>
                    </div>

                    <div className="text-left font-mono font-black shrink-0">
                      <span className="text-2xl text-amber-600 block">⭐ {topPerformer.avgOverall} / 5</span>
                      <span className="text-[9px] text-slate-500 font-sans font-bold">تێکڕای خاڵی بەدەستهاتوو</span>
                    </div>
                  </div>
                )}

                {/* 1.4 Comprehensive 8-Staff Evaluation Table */}
                <div className="break-inside-avoid">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-900">
                      خشتەی نمرەی سەرجەم ٨ کارمەندی فرۆشیار و کاشێر:
                    </h4>
                    <span className="text-[10px] text-slate-500 font-bold">پێوەری فەرمی ٥ ئەستێرە</span>
                  </div>

                  <table className="w-full text-right text-[11px] border-collapse border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-black">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center">پلە</th>
                        <th className="p-2 border border-slate-300">ناوی کارمەند</th>
                        <th className="p-2 border border-slate-300 text-center">ڕۆڵ</th>
                        <th className="p-2 border border-slate-300 text-center">ژمارەی دەنگ</th>
                        <th className="p-2 border border-slate-300 text-center">مامەڵە لەگەڵ کڕیار</th>
                        <th className="p-2 border border-slate-300 text-center">چالاکی فرۆشتن</th>
                        <th className="p-2 border border-slate-300 text-center">پابەندبوون بە دەوام</th>
                        <th className="p-2 border border-slate-300 text-center">تێکڕای گشتی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-semibold">
                      {staffLeaderboard.map((item, index) => (
                        <tr key={item.emp.employeeId} className={index === 0 && item.count > 0 ? 'bg-amber-50/60 font-bold' : ''}>
                          <td className="p-2 border border-slate-300 text-center font-black">
                            {index === 0 && item.count > 0 ? '🥇 ١' : index === 1 && item.count > 0 ? '🥈 ٢' : index === 2 && item.count > 0 ? '🥉 ٣' : `#${index + 1}`}
                          </td>
                          <td className="p-2 border border-slate-300 font-black text-slate-950">
                            {item.emp.fullName}
                          </td>
                          <td className="p-2 border border-slate-300 text-center">
                            {item.emp.role}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-bold">
                            {item.count}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgService > 0 ? `⭐ ${item.avgService}` : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgPerf > 0 ? `⭐ ${item.avgPerf}` : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgDisc > 0 ? `⭐ ${item.avgDisc}` : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-black text-amber-700">
                            {item.avgOverall > 0 ? `⭐ ${item.avgOverall} / 5` : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* ========================================================================= */}
              {/* 📊 PART 2: DEDICATED GRAPHS FOR EACH QUESTION (بۆ هەر پرسیارێک گرافێک) */}
              {/* ========================================================================= */}
              <div className="space-y-6 pt-4 border-t-2 border-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-500" />
                    <h3 className="text-sm font-black text-slate-900">
                      بەشی دووەم: هێڵکاری و شیکاری گرافیکی بۆ هەر پرسیارێک
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    بەراوردی نمرەی ٨ کارمەندەکە لەسەر ئاستی پرسیارەکان
                  </span>
                </div>

                {/* 2.1 Graph Question 1: Customer Service (مامەڵە و ڕەفتار لەگەڵ کڕیار) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs">١</span>
                      <h4 className="text-xs font-black text-slate-900">
                        پرسیاری ١: مامەڵە و ڕەفتار لەگەڵ کڕیار (خزمەتگوزاری و پێشوازی)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      تێکڕا: ⭐ {storeAnalytics.avgService} / 5
                    </span>
                  </div>

                  {/* 8-Column Bar Chart for Question 1 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item, index) => {
                      const percent = (item.avgService / 5) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-emerald-700">
                            {item.avgService > 0 ? item.avgService : '٠'}
                          </span>
                          <div 
                            className="w-full max-w-[34px] rounded-t-md bg-emerald-500"
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[9px] font-black text-slate-900 mt-1 truncate max-w-[48px] block">
                            {item.emp.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2.2 Graph Question 2: Sales Performance & Agility (چالاکی و لێهاتوویی فرۆشتن و کاش) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">٢</span>
                      <h4 className="text-xs font-black text-slate-900">
                        پرسیاری ٢: چالاکی، زانیاری و لێهاتوویی لە فرۆشتن و کاش
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      تێکڕا: ⭐ {storeAnalytics.avgPerf} / 5
                    </span>
                  </div>

                  {/* 8-Column Bar Chart for Question 2 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item) => {
                      const percent = (item.avgPerf / 5) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-blue-700">
                            {item.avgPerf > 0 ? item.avgPerf : '٠'}
                          </span>
                          <div 
                            className="w-full max-w-[34px] rounded-t-md bg-blue-600"
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[9px] font-black text-slate-900 mt-1 truncate max-w-[48px] block">
                            {item.emp.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2.3 Graph Question 3: Discipline & Punctuality (پابەندبوون بە دەوام و کات) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs">٣</span>
                      <h4 className="text-xs font-black text-slate-900">
                        پرسیاری ٣: پابەندبوون بە دەوام، کات، و ڕێنماییەکانی پێشانگا
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                      تێکڕا: ⭐ {storeAnalytics.avgDisc} / 5
                    </span>
                  </div>

                  {/* 8-Column Bar Chart for Question 3 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item) => {
                      const percent = (item.avgDisc / 5) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-purple-700">
                            {item.avgDisc > 0 ? item.avgDisc : '٠'}
                          </span>
                          <div 
                            className="w-full max-w-[34px] rounded-t-md bg-purple-600"
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[9px] font-black text-slate-900 mt-1 truncate max-w-[48px] block">
                            {item.emp.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2.4 Graph Question 4: Overall Rating & Winner Podium (تێکڕای نمرەی گشتی) */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">٤</span>
                      <h4 className="text-xs font-black text-slate-900">
                        پرسیاری ٤: نمرەی گشتی و بەراوردی کۆتایی سەرجەم کارمەندان
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
                      تێکڕا: ⭐ {metrics.avgOverall} / 5
                    </span>
                  </div>

                  {/* 8-Column Bar Chart for Question 4 (Gold, Silver, Bronze highlights) */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item, index) => {
                      const percent = (item.avgOverall / 5) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);
                      const isFirst = index === 0 && item.count > 0;
                      const isSecond = index === 1 && item.count > 0;
                      const isThird = index === 2 && item.count > 0;

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className={`text-[9px] font-mono font-black mb-1 ${isFirst ? 'text-amber-600' : 'text-slate-800'}`}>
                            {item.avgOverall > 0 ? item.avgOverall : '٠'}
                          </span>
                          <div 
                            className={`w-full max-w-[34px] rounded-t-md ${
                              isFirst ? 'bg-amber-400' : isSecond ? 'bg-slate-400' : isThird ? 'bg-amber-700' : 'bg-blue-600'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[9px] font-black text-slate-900 mt-1 truncate max-w-[48px] block">
                            {item.emp.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2.5 General Store Dimensions & Rating Distribution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
                  
                  {/* Store Dimensions */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <span className="font-black text-slate-900 block pb-1 border-b border-slate-200">
                      پوختەی ڕەزامەندی لەسەر تەوەرە سەرەکییەکان:
                    </span>
                    <div className="flex items-center justify-between">
                      <span>• خزمەتگوزاری کڕیار:</span>
                      <span className="font-mono text-emerald-700 font-black">⭐ {storeAnalytics.avgService} / 5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• لێهاتوویی فرۆشتن:</span>
                      <span className="font-mono text-blue-700 font-black">⭐ {storeAnalytics.avgPerf} / 5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• دەوام و دیسیپلین:</span>
                      <span className="font-mono text-purple-700 font-black">⭐ {storeAnalytics.avgDisc} / 5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• ڕەزامەندی گشتی:</span>
                      <span className="font-mono text-amber-600 font-black">⭐ {metrics.avgOverall} / 5</span>
                    </div>
                  </div>

                  {/* Distribution 5-Star to 1-Star */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <span className="font-black text-slate-900 block pb-1 border-b border-slate-200">
                      دابەشبوونی نمرەکان (١ بۆ ٥ ئەستێرە):
                    </span>
                    {[5, 4, 3, 2, 1].map((s) => {
                      const c = storeAnalytics.distribution[s] || 0;
                      const p = metrics.totalSubmissions > 0 ? Math.round((c / metrics.totalSubmissions) * 100) : 0;
                      return (
                        <div key={s} className="flex items-center justify-between text-[11px]">
                          <span>{s} ئەستێرە:</span>
                          <span className="font-mono font-bold text-slate-700">{c} جار ({p}%)</span>
                        </div>
                      );
                    })}
                  </div>

                </div>

              </div>

              {/* ========================================================================= */}
              {/* 📑 PART 3: SUBMISSIONS & PINS REGISTRY (فیدباکەکان و PIN ەکانیان) */}
              {/* ========================================================================= */}
              <div className="space-y-6 pt-4 border-t-2 border-slate-300">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900">
                      بەشی سێیەم: تۆماری تەواوی فیدباکە وەرگیراوەکان و کۆدەکانی PIN
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {submissions.length} فیدباکی نێردراو • {Object.keys(pins).length} کۆدی PIN
                  </span>
                </div>

                {/* 3.1 All Feedback Submissions Table */}
                <div className="break-inside-avoid">
                  <h4 className="text-xs font-black text-slate-900 mb-2">
                    خشتەی فیدباکە وەرگیراوەکان ({submissions.length} فیدباک):
                  </h4>

                  {submissions.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                      هیچ فیدباکێک تۆمار نەکراوە.
                    </div>
                  ) : (
                    <table className="w-full text-right text-[10.5px] border-collapse border border-slate-300">
                      <thead className="bg-slate-100 text-slate-800 font-black">
                        <tr>
                          <th className="p-2 border border-slate-300 text-center">کۆدی PIN</th>
                          <th className="p-2 border border-slate-300">بەشداربوو / مۆبایل</th>
                          <th className="p-2 border border-slate-300 text-center">بەروار و کات</th>
                          <th className="p-2 border border-slate-300 text-center">تێکڕای نمرە</th>
                          <th className="p-2 border border-slate-300">سەرنج و پێشنیار بۆ بەڕێوەبەرایەتی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold">
                        {submissions.map((s) => (
                          <tr key={s.id}>
                            <td className="p-2 border border-slate-300 text-center font-mono font-black text-slate-900" dir="ltr">
                              {s.pin}
                            </td>
                            <td className="p-2 border border-slate-300">
                              <span className="font-bold text-slate-950 block">{s.respondentName || s.targetName || 'نهێنی'}</span>
                              {s.targetPhone && <span className="font-mono text-[9.5px] text-slate-500" dir="ltr">{s.targetPhone}</span>}
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono text-[10px]" dir="ltr">
                              {s.baghdadDate} {s.baghdadTime}
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono font-black text-amber-600">
                              ⭐ {s.overallSatisfaction} / 5
                            </td>
                            <td className="p-2 border border-slate-300 text-[10px] text-slate-700">
                              {s.suggestionsForManagement || s.positiveHighlights || '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 3.2 All Generated PINs Table */}
                <div className="break-inside-avoid">
                  <h4 className="text-xs font-black text-slate-900 mb-2">
                    خشتەی تۆماری سەرجەم کۆدەکانی PIN ({Object.keys(pins).length} کۆد):
                  </h4>

                  {Object.keys(pins).length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                      هیچ PINێک تۆمار نەکراوە.
                    </div>
                  ) : (
                    <table className="w-full text-right text-[10.5px] border-collapse border border-slate-300">
                      <thead className="bg-slate-100 text-slate-800 font-black">
                        <tr>
                          <th className="p-2 border border-slate-300 text-center">کۆدی PIN</th>
                          <th className="p-2 border border-slate-300">ناوی وەرگر / مۆبایل</th>
                          <th className="p-2 border border-slate-300 text-center">جۆری بەکارهێنان</th>
                          <th className="p-2 border border-slate-300 text-center">دۆخی ئێستا</th>
                          <th className="p-2 border border-slate-300 text-center">بەرواری دروستکردن</th>
                          <th className="p-2 border border-slate-300 text-center">کاتی پڕکردنەوە</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-semibold">
                        {Object.values(pins).map((p) => (
                          <tr key={p.pin}>
                            <td className="p-2 border border-slate-300 text-center font-mono font-black text-slate-900" dir="ltr">
                              {p.pin}
                            </td>
                            <td className="p-2 border border-slate-300">
                              <span className="font-bold text-slate-950 block">{p.targetName || 'گشتی'}</span>
                              {p.targetPhone && <span className="font-mono text-[9.5px] text-slate-500" dir="ltr">{p.targetPhone}</span>}
                            </td>
                            <td className="p-2 border border-slate-300 text-center">
                              {p.isSingleUse ? 'یەکجار' : 'فرە جار'}
                            </td>
                            <td className="p-2 border border-slate-300 text-center">
                              {p.isUsed ? (
                                <span className="text-emerald-700 font-bold">پڕکراوەتەوە ✅</span>
                              ) : (
                                <span className="text-amber-600 font-bold">چالاک و چاوەڕوان ⏳</span>
                              )}
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono text-[10px]" dir="ltr">
                              {p.createdAt ? p.createdAt.slice(0, 10) : '--'}
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono text-[10px]" dir="ltr">
                              {p.usedAt ? p.usedAt.replace('T', ' ').slice(0, 16) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* 3.3 Official Signatures Section */}
                <OfficialPrintSignatures
                  roles={[
                    'سەرپەرشتیاری تیمی فرۆش و کاشێر',
                    'بەڕێوەبەری سەرچاوە مرۆییەکان',
                    'بەڕێوەبەری گشتی مۆبیلیاتی ئاشڵی'
                  ]}
                />

              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔍 MODAL: FULL SUBMISSION DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 font-black flex items-center justify-center font-mono text-sm" dir="ltr">
                  {selectedSubmission.pin}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    وردەکاری فیدباکی PIN ({selectedSubmission.pin})
                  </h3>
                  <span className="text-xs text-slate-500 font-mono" dir="ltr">
                    {selectedSubmission.baghdadDate} | {selectedSubmission.baghdadTime}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-medium">
              {/* Respondent info */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">بەشداربوو / ناو:</span>
                  <span className="font-bold text-slate-900">
                    {selectedSubmission.respondentName || selectedSubmission.targetName || 'نهێنی'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">ژمارەی مۆبایل:</span>
                  <span className="font-bold text-slate-900 font-mono" dir="ltr">
                    {selectedSubmission.targetPhone || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">تێکڕای گشتی:</span>
                  <span className="font-black font-mono text-amber-500">⭐ {selectedSubmission.overallSatisfaction} / 5</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">کاتی تۆمارکردن:</span>
                  <span className="font-mono text-slate-700">{selectedSubmission.baghdadDate} {selectedSubmission.baghdadTime}</span>
                </div>
              </div>

              {/* 🌟 8 EMPLOYEES DETAILED EVALUATION CARDS */}
              {selectedSubmission.employeeRatings && Object.keys(selectedSubmission.employeeRatings).length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>هەڵسەنگاندنی کارمەندانی فرۆشیار و کاشێر:</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(selectedSubmission.employeeRatings).map((er: any) => (
                      <div key={er.employeeId} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                          <span className="font-black text-slate-900">{er.fullName || er.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                            {er.role}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-700 font-semibold">
                          <div className="flex items-center justify-between">
                            <span>• مامەڵە لەگەڵ کڕیار:</span>
                            <span className="font-mono text-emerald-600 font-bold">⭐ {er.serviceRating} / 5</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>• چالاکی و کار:</span>
                            <span className="font-mono text-blue-600 font-bold">⭐ {er.performanceRating} / 5</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>• پابەندبوون بە دەوام:</span>
                            <span className="font-mono text-purple-600 font-bold">⭐ {er.disciplineRating} / 5</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="font-black">نمرەی گشتی:</span>
                            <span className="font-mono text-amber-600 font-black text-xs">⭐ {er.overallRating} / 5</span>
                          </div>
                        </div>

                        {er.comment && (
                          <div className="p-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-800 mt-1">
                            💬 <span className="font-bold">سەرنج:</span> {er.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* General Suggestions */}
              {selectedSubmission.suggestionsForManagement && (
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
                  <span className="font-black text-blue-900 block">پێشنیاری گشتی بۆ بەڕێوەبەرایەتی:</span>
                  <p className="text-slate-800 leading-relaxed font-semibold">
                    {selectedSubmission.suggestionsForManagement}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteSubmission(selectedSubmission.id)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوەی ئەم فیدباکە</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer active:scale-95"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ➕ MODAL: CREATE NEW PIN (BY SCOPE: MANAGER, STAFF, WAREHOUSE) */}
      {/* ========================================================================= */}
      {showCreatePinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  دروستکردنی کۆدی نهێنی (PIN)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePinModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-all"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Created PIN Success Pill */}
            {createPinResult && (
              <div className="mb-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>کۆدی PIN بە سەرکەوتوویی دروستکرا!</span>
                  </span>
                  <span className="font-mono font-black text-lg bg-slate-900 text-amber-400 px-3 py-0.5 rounded-lg tracking-wider" dir="ltr">
                    {createPinResult.pin}
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(createPinResult.pin, 'PIN')}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-center text-[11px] cursor-pointer active:scale-95"
                  >
                    کۆپیکردنی کۆد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      let directLink = `${window.location.origin}/feedback?pin=${createPinResult.pin}`;
                      if (createPinResult.scope === 'manager_feedback') {
                        directLink = `${window.location.origin}/feedback/admin?pin=${createPinResult.pin}`;
                      } else if (createPinResult.scope === 'warehouse') {
                        directLink = `${window.location.origin}/?tab=warehouse&pin=${createPinResult.pin}`;
                      }
                      handleCopy(directLink, 'لینکی ڕاستەوخۆ');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-center text-[11px] cursor-pointer active:scale-95 shadow-xs"
                  >
                    کۆپیکردنی لینک
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreatePin} className="space-y-4 text-xs">
              
              {/* 1. Scope Selector */}
              <div>
                <label className="block text-slate-800 font-black mb-1.5">
                  جۆری کۆدەکە هەڵبژێرە:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPinScope('manager_feedback');
                      setNewCustomPin(generatePinForScope('manager_feedback'));
                      setIsSingleUse(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPinScope === 'manager_feedback'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-950 font-black ring-2 ring-amber-400/40'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <div className="text-base mb-0.5">👑</div>
                    <div className="text-[11px]">بەڕێوەبەر</div>
                    <div className="text-[9.5px] font-mono text-amber-700" dir="ltr">0000 - 5999</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPinScope('staff_feedback');
                      setNewCustomPin(generatePinForScope('staff_feedback'));
                      setIsSingleUse(true);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPinScope === 'staff_feedback'
                        ? 'bg-rose-500/15 border-rose-500 text-rose-950 font-black ring-2 ring-rose-400/40'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <div className="text-base mb-0.5">👥</div>
                    <div className="text-[11px]">کارمەندان</div>
                    <div className="text-[9.5px] font-mono text-rose-700" dir="ltr">6000 - 9999</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewPinScope('warehouse');
                      setNewCustomPin(generatePinForScope('warehouse'));
                      setIsSingleUse(false);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPinScope === 'warehouse'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-950 font-black ring-2 ring-blue-400/40'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <div className="text-base mb-0.5">📦</div>
                    <div className="text-[11px]">کۆگا</div>
                    <div className="text-[9.5px] font-mono text-blue-700" dir="ltr">٥ ژمارە</div>
                  </button>
                </div>
              </div>

              {/* Scope Helper Box */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <span>
                  {newPinScope === 'manager_feedback' && '👑 ڕێگەپێدراوە: ٤ ژمارە لە نێوان 0000 بۆ 5999 (فیدباکی بەڕێوەبەر)'}
                  {newPinScope === 'staff_feedback' && '👥 ڕێگەپێدراوە: ٤ ژمارە لە نێوان 6000 بۆ 9999 (فیدباکی کارمەندان)'}
                  {newPinScope === 'warehouse' && '📦 ڕێگەپێدراوە: ٥ ژمارە لە نێوان 10000 بۆ 99999 (بەشی کۆگا و بار داگرتن)'}
                </span>
                <button
                  type="button"
                  onClick={() => setNewCustomPin(generatePinForScope(newPinScope))}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-bold text-[10px] cursor-pointer"
                  title="دروستکردنی ژمارەیەکی هەڕەمەکی گونجاو"
                >
                  🎲 کۆدی نوێ
                </button>
              </div>

              {/* 2. PIN Input */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  کۆدی PIN ({newPinScope === 'warehouse' ? '٥ ژمارە' : '٤ ژمارە'}):
                </label>
                <input
                  type="text"
                  maxLength={newPinScope === 'warehouse' ? 5 : 4}
                  value={newCustomPin}
                  onChange={(e) => setNewCustomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder={
                    newPinScope === 'manager_feedback'
                      ? 'بۆ نموونە: 2026 (لە نێوان 0000 بۆ 5999)'
                      : newPinScope === 'staff_feedback'
                      ? 'بۆ نموونە: 7540 (لە نێوان 6000 بۆ 9999)'
                      : 'بۆ نموونە: 54321 (پێنج ژمارە)'
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-amber-500 bg-white"
                  dir="ltr"
                />
              </div>

              {/* 3. Target Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  بۆ کێیە یان مەبەستی کۆدەکە:
                </label>
                <input
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder={
                    newPinScope === 'manager_feedback'
                      ? 'بۆ نموونە: بەڕێوەبەری پێشانگا'
                      : newPinScope === 'warehouse'
                      ? 'بۆ نموونە: تیمی کۆگا و دابەزاندنی بار'
                      : 'بۆ نموونە: کڕیار یان کارمەند'
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-amber-500 bg-white"
                />
              </div>

              {/* 4. Target Phone */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ژمارەی مۆبایل (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  value={newTargetPhone}
                  onChange={(e) => setNewTargetPhone(e.target.value)}
                  placeholder="0770 123 4567"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-amber-500 bg-white"
                  dir="ltr"
                />
              </div>

              {/* 5. Single Use Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="singleUseCheck"
                  checked={isSingleUse}
                  onChange={(e) => setIsSingleUse(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="singleUseCheck" className="text-slate-700 font-bold cursor-pointer">
                  تەنها بۆ یەکجار بەکارهێنان بێت (Single-Use)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={creatingPin}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50 transition-all"
                >
                  {creatingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>دروستکردنی PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreatePinModal(false)}
                  className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer hover:bg-slate-200 transition-all"
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 MODAL: CREATE BATCH PINS BY SCOPE */}
      {/* ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <KeyRound className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  دروستکردنی بەکۆمەڵی PIN
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-all"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {batchCreatedPins.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                  <span className="font-bold block mb-1">
                    ✅ {batchCreatedPins.length} کۆدی PIN بە سەرکەوتوویی دروستکران:
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs pt-1">
                    {batchCreatedPins.map((p) => {
                      let directUrl = `${window.location.origin}/feedback?pin=${p.pin}`;
                      if (p.scope === 'manager_feedback') {
                        directUrl = `${window.location.origin}/feedback/admin?pin=${p.pin}`;
                      } else if (p.scope === 'warehouse') {
                        directUrl = `${window.location.origin}/?tab=warehouse&pin=${p.pin}`;
                      }

                      return (
                        <div key={p.pin} className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-200">
                          <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md bg-slate-100 font-mono" dir="ltr">
                            {p.pin}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {p.scope === 'manager_feedback' ? '👑 بەڕێوەبەر' : p.scope === 'warehouse' ? '📦 کۆگا' : '👥 کارمەندان'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(directUrl, `لینک (${p.pin})`)}
                            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            کۆپی لینک
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allText = batchCreatedPins.map(p => `${p.pin}`).join('\n');
                      handleCopy(allText, 'سەرجەم PINەکان');
                    }}
                    className="flex-1 h-10 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>کۆپیکردنی هەموو کۆدەکان</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-200"
                  >
                    تەواو
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    جۆری کۆدەکان دیاریبکە:
                  </label>
                  <select
                    value={batchScope}
                    onChange={(e) => setBatchScope(e.target.value as PinScope)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-amber-500 bg-white"
                  >
                    <option value="manager_feedback">👑 فیدباکی بەڕێوەبەر (0000 - 5999)</option>
                    <option value="staff_feedback">👥 فیدباکی کارمەندان (6000 - 9999)</option>
                    <option value="warehouse">📦 بەشی کۆگا و بار داگرتن (٥ ژمارەیی 10000 - 99999)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    ژمارەی ئەو PINانەی دەتەوێت دروستبکرێن:
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBatchCount(num)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          batchCount === num
                            ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {num} دانە
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={batchCreating}
                    onClick={handleCreateBatch}
                    className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50 transition-all"
                  >
                    {batchCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>دروستکردنی {batchCount} PIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer hover:bg-slate-200"
                  >
                    داخستن
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📄 Global Print Stylesheet for Official PDF / Window Print */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #official-feedback-print-area, #official-feedback-print-area * {
            visibility: visible !important;
          }
          #official-feedback-print-area {
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
