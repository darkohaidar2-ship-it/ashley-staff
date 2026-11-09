'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ExternalLink, 
  RefreshCw, 
  Filter, 
  Star, 
  Building2, 
  Phone, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Table, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Eye, 
  X,
  Share2,
  Users,
  Award
} from 'lucide-react';
import { 
  FeedbackPin, 
  FeedbackSubmission, 
  TARGET_SALES_CASHIER_STAFF 
} from '@/lib/feedback/feedback-service';
import * as XLSX from 'xlsx';

export function AdminFeedbackDashboard() {
  const [pins, setPins] = useState<Record<string, FeedbackPin>>({});
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view: 'submissions' | 'pins' | 'analytics'
  const [activeTab, setActiveTab] = useState<'submissions' | 'pins' | 'analytics'>('submissions');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Selected Submission for Detailed View Modal
  const [selectedSubmission, setSelectedSubmission] = useState<FeedbackSubmission | null>(null);

  // Modals
  const [showCreatePinModal, setShowCreatePinModal] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_all' }),
      });

      const data = await res.json();
      if (data.success) {
        setPins(data.pins || {});
        setSubmissions(data.submissions || []);
      } else {
        setError(data.error || 'نەتوانرا داتاکان باربکرێن');
      }
    } catch (err: any) {
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
          isSingleUse: true,
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
    if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم کۆدە (${pinToDelete})؟`)) return;
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
      .sort((a, b) => b.avgOverall - a.avgOverall);
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

  // Export to Print / PDF
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-5 text-slate-900 font-sans" dir="rtl">
      
      {/* 🌟 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-black">
              <MessageSquareHeart className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-base font-black text-slate-900">
              داشبۆردی فیدباک و هەڵسەنگاندنی فرۆشیار و کاشێرەکان
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              {submissions.length} فیدباکی تۆمارکراو
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            بەڕێوەبردنی کۆدەکانی PIN، شیکاری نمرەی سەرجەم ٨ کارمەندانی فرۆشیار و کاشێر، داگرتنی Excel و PDF
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Print / PDF */}
          <button
            type="button"
            onClick={handlePrintReport}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="چاپکردن یان خەزنکردن بە شێوەی PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ڕاپۆرتی PDF</span>
          </button>

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
          <span className="text-[11px] font-bold text-slate-500 block mb-1">تێکڕای نمرەی کارمەندان</span>
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

      {/* 🧭 3. TABS NAVIGATION */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'submissions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="w-4 h-4 text-blue-600" />
            <span>وەرگیراوەکان ({submissions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-amber-500" />
            <span>نمرە و شیکاری ٨ کارمەندەکە</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pins')}
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

        {copiedText && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{copiedText} بە سەرکەوتوویی کۆپی کرا!</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📑 VIEW 1: SUBMISSIONS TABLE */}
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
                          {/* PIN */}
                          <td className="p-3.5">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 inline-block" dir="ltr">
                              {s.pin}
                            </span>
                          </td>

                          {/* Respondent / Phone */}
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

                          {/* Overall Rating */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-1 font-mono font-black text-amber-500 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                              <Star className="w-3.5 h-3.5 fill-amber-500" />
                              <span>{s.overallSatisfaction} / 5</span>
                            </div>
                          </td>

                          {/* Employee count badge */}
                          <td className="p-3.5 text-center">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                              {empEvaluationsCount > 0 ? `${empEvaluationsCount} کارمەند` : 'گشتی'}
                            </span>
                          </td>

                          {/* Snippet */}
                          <td className="p-3.5 max-w-[200px]">
                            <p className="text-[11px] text-slate-500 truncate">
                              {s.suggestionsForManagement || s.positiveHighlights || 'بێ تێبینی نووسراو'}
                            </p>
                          </td>

                          {/* Date & Time */}
                          <td className="p-3.5 text-[11px] font-mono text-slate-500" dir="ltr">
                            {s.baghdadDate} {s.baghdadTime}
                          </td>

                          {/* Actions */}
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
      {/* 🏆 VIEW 2: LEADERBOARD & EMPLOYEE ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          
          {/* Header Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900">
                ڕیزبەندی و تێکڕای نمرەی سەرجەم ٨ کارمەندانی فرۆشیار و کاشێر
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              ئەم خشتەیە بەپێی نمرەی گشتی فیدباکەکان ڕیزکراوە، تێیدا وردەکاری مامەڵە لەگەڵ کڕیار، چالاکی لە کار و پابەندبوون بە دەوام دەردەکەوێت.
            </p>
          </div>

          {/* Cards for each employee */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {staffLeaderboard.map((item, index) => {
              const rankIcon = index === 0 ? '🥇 یەکەم' : index === 1 ? '🥈 دووەم' : index === 2 ? '🥉 سێیەم' : `#${index + 1}`;
              return (
                <div 
                  key={item.emp.employeeId}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all"
                >
                  <div>
                    {/* Top line: photo, name, rank */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-700 shrink-0 overflow-hidden">
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
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{item.emp.fullName}</h4>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              {item.emp.role}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.count} جار هەڵسەنگێندراوە
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                          index === 0 
                            ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                            : 'bg-slate-100 text-slate-700 font-bold'
                        }`}>
                          {rankIcon}
                        </span>
                      </div>
                    </div>

                    {/* Overall score large */}
                    <div className="flex items-center justify-between bg-amber-50/60 border border-amber-200/80 p-2.5 rounded-xl mb-3">
                      <span className="text-xs font-black text-amber-900">تێکڕای نمرەی گشتی:</span>
                      <div className="flex items-baseline gap-1 font-mono font-black text-amber-600 text-lg">
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                        <span>{item.avgOverall}</span>
                        <span className="text-xs text-amber-800 font-normal">/ 5</span>
                      </div>
                    </div>

                    {/* Criteria progress bars */}
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-slate-600">• مامەڵە و ڕەفتار لەگەڵ کڕیار:</span>
                          <span className="font-mono text-emerald-600 font-black">{item.avgService} / 5</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(item.avgService / 5) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-slate-600">• چالاکی و لێهاتوویی لە کار:</span>
                          <span className="font-mono text-blue-600 font-black">{item.avgPerf} / 5</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.avgPerf / 5) * 100}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-slate-600">• پابەندبوون بە دەوام و کات:</span>
                          <span className="font-mono text-purple-600 font-black">{item.avgDisc} / 5</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.avgDisc / 5) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔑 VIEW 3: PIN MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'pins' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                بەڕێوەبردنی کۆدەکانی PIN بۆ چوونەژوورەوەی فیدباک
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                دەتوانیت PINی چوار ژمارەیی دروست بکەیت و لینکی ڕاستەوخۆ بنێریت بۆ هەر کەسێک کە پێت باشە فیدباک پڕبکاتەوە.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatePinResult(null);
                  setShowCreatePinModal(true);
                }}
                className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>PINی نوێ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBatchCreatedPins([]);
                  setShowBatchModal(true);
                }}
                className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
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
                      <th className="p-3.5">بۆ کێیە / مۆبایل</th>
                      <th className="p-3.5">جۆری بەکارهێنان</th>
                      <th className="p-3.5">دۆخ</th>
                      <th className="p-3.5">بەرواری دروستکردن</th>
                      <th className="p-3.5">بەرواری پڕکردنەوە</th>
                      <th className="p-3.5 text-center">کۆپیکردن</th>
                      <th className="p-3.5 text-center">سڕینەوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {Object.values(pins).map((p) => {
                      const directUrl = typeof window !== 'undefined'
                        ? `${window.location.origin}/feedback?pin=${p.pin}`
                        : `https://ashley-staff.vercel.app/feedback?pin=${p.pin}`;

                      return (
                        <tr key={p.pin} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-slate-900 text-amber-400 inline-block tracking-wider" dir="ltr">
                              {p.pin}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">
                              {p.targetName || 'گشتی'}
                            </div>
                            {p.targetPhone && (
                              <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                                {p.targetPhone}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                              {p.isSingleUse ? 'یەکجار بەکارهێنان' : 'فرە بەکارهێنان'}
                            </span>
                          </td>

                          <td className="p-3.5">
                            {p.isUsed ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>پڕکراوەتەوە</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-500" />
                                <span>چالاکە و چاوەڕوانە</span>
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
                                onClick={() => handleCopy(directUrl, `لینکی فیدباک`)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                title="کۆپیکردنی لینکی فیدباک"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>لینک</span>
                              </button>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePin(p.pin)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition-all active:scale-95"
                              title="سڕینەوەی ئەم PINە"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      {/* ➕ MODAL: CREATE NEW 4-DIGIT PIN */}
      {/* ========================================================================= */}
      {showCreatePinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  دروستکردنی PINی نوێ (٤ ژمارەیی)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePinModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
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
                    <span>کۆدی PIN دروستکرا!</span>
                  </span>
                  <span className="font-mono font-black text-lg bg-slate-900 text-amber-400 px-3 py-0.5 rounded-lg" dir="ltr">
                    {createPinResult.pin}
                  </span>
                </div>

                <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(createPinResult.pin, 'PIN')}
                    className="flex-1 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-center text-[11px] cursor-pointer active:scale-95"
                  >
                    کۆپیکردنی PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const link = `${window.location.origin}/feedback?pin=${createPinResult.pin}`;
                      handleCopy(link, 'لینکی ڕاستەوخۆ');
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-center text-[11px] cursor-pointer active:scale-95 shadow-xs"
                  >
                    کۆپیکردنی لینک
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreatePin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  کۆدی PIN (ئارەزوومەندانە - ئەگەر بەتاڵ بێت ٤ ژمارە بە ئۆتۆماتیک دروست دەبێت):
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={newCustomPin}
                  onChange={(e) => setNewCustomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="بۆ نموونە: 4821 (بەتاڵی جێبێڵە بۆ خۆکار)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-amber-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ژمارەی مۆبایلی کارمەند / وەرگر:
                </label>
                <input
                  type="text"
                  value={newTargetPhone}
                  onChange={(e) => setNewTargetPhone(e.target.value)}
                  placeholder="بۆ نموونە: 0770 123 4567"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold outline-none focus:border-amber-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ناوی کارمەند یان کەسی هەڵسەنگێنەر:
                </label>
                <input
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="بۆ نموونە: کڕیار یان کارمەند"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="singleUseCheck"
                  checked={isSingleUse}
                  onChange={(e) => setIsSingleUse(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 accent-amber-500"
                />
                <label htmlFor="singleUseCheck" className="text-slate-700 font-bold cursor-pointer">
                  تەنها بۆ یەکجار بەکارهێنان بێت (Single-Use)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={creatingPin}
                  className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                >
                  {creatingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>دروستکردنی PIN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreatePinModal(false)}
                  className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📦 MODAL: CREATE BATCH PINS */}
      {/* ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
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
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
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
                    {batchCreatedPins.map((p) => (
                      <div key={p.pin} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-emerald-200">
                        <span className="font-bold text-slate-900" dir="ltr">{p.pin}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(`${window.location.origin}/feedback?pin=${p.pin}`, `لینک (${p.pin})`)}
                          className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          کۆپی لینک
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allText = batchCreatedPins.map(p => `${p.pin}: ${window.location.origin}/feedback?pin=${p.pin}`).join('\n');
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
                    className="px-4 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    تەواو
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed font-semibold">
                  ژمارەی ئەو PINانە دیاریبکە کە دەتەوێت دروستبکرێن بە یەک کلیک:
                </p>

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
                      {num} کۆد
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={batchCreating}
                    onClick={handleCreateBatch}
                    className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                  >
                    {batchCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>دروستکردنی {batchCount} PIN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    داخستن
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
