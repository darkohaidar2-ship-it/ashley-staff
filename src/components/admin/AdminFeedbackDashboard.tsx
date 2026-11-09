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
  Share2
} from 'lucide-react';
import { FeedbackPin, FeedbackSubmission } from '@/lib/feedback/feedback-service';
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
  const [deptFilter, setDeptFilter] = useState<string>('all');
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
  const [newNotes, setNewNotes] = useState<string>('');
  const [isSingleUse, setIsSingleUse] = useState<boolean>(true);
  const [creatingPin, setCreatingPin] = useState<boolean>(false);
  const [createPinResult, setCreatePinResult] = useState<FeedbackPin | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Batch form state
  const [batchCount, setBatchCount] = useState<number>(5);
  const [batchCreating, setBatchCreating] = useState<boolean>(false);
  const [batchCreatedPins, setBatchCreatedPins] = useState<FeedbackPin[]>([]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback/admin');
      const data = await res.json();
      if (data.success) {
        setPins(data.pins || {});
        setSubmissions(data.submissions || []);
      } else {
        setError(data.error || 'نەتوانرا داتاکان باربکرێن');
      }
    } catch (err: any) {
      setError('هەڵە لە پەیوەندیکردن بە سێرڤەر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2500);
    }
  };

  // Create PIN
  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPin(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_pin',
          customPin: newCustomPin.trim() || undefined,
          targetPhone: newTargetPhone.trim() || undefined,
          targetName: newTargetName.trim() || undefined,
          notes: newNotes.trim() || undefined,
          isSingleUse,
        }),
      });

      const data = await res.json();
      if (data.success && data.pin) {
        setCreatePinResult(data.pin);
        setNewCustomPin('');
        setNewTargetPhone('');
        setNewTargetName('');
        setNewNotes('');
        fetchData();
      } else {
        alert(data.error || 'نەتوانرا PIN دروستبکرێت');
      }
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا لە دروستکردنی PIN');
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
        (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (s.positiveHighlights && s.positiveHighlights.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (s.workplaceChallenges && s.workplaceChallenges.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
        (s.suggestionsForManagement && s.suggestionsForManagement.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      const matchesDept = deptFilter === 'all' || s.department === deptFilter;
      const matchesRating = ratingFilter === 'all' || s.overallSatisfaction.toString() === ratingFilter;

      return matchesSearch && matchesDept && matchesRating;
    });
  }, [submissions, searchTerm, deptFilter, ratingFilter]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const total = submissions.length;
    if (total === 0) {
      return {
        totalSubmissions: 0,
        avgOverall: 0,
        avgWorkEnv: 0,
        avgTeamCoop: 0,
        avgManagement: 0,
        avgTools: 0,
        totalPins: Object.keys(pins).length,
        usedPinsCount: Object.values(pins).filter(p => p.isUsed).length,
        activePinsCount: Object.values(pins).filter(p => !p.isUsed).length,
        deptBreakdown: {},
        satisfactionBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    let sumOverall = 0;
    let sumWorkEnv = 0;
    let sumTeam = 0;
    let sumMgmt = 0;
    let sumTools = 0;
    const depts: Record<string, number> = {};
    const satCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    submissions.forEach((s) => {
      sumOverall += s.overallSatisfaction || 0;
      sumWorkEnv += s.workEnvironmentRating || 0;
      sumTeam += s.teamCooperationRating || 0;
      sumMgmt += s.managementFairnessRating || 0;
      sumTools += s.toolsAndEquipmentRating || 0;

      depts[s.department] = (depts[s.department] || 0) + 1;
      const rounded = Math.round(s.overallSatisfaction);
      if (satCounts[rounded] !== undefined) satCounts[rounded]++;
    });

    const pinValues = Object.values(pins);
    return {
      totalSubmissions: total,
      avgOverall: Number((sumOverall / total).toFixed(1)),
      avgWorkEnv: Number((sumWorkEnv / total).toFixed(1)),
      avgTeamCoop: Number((sumTeam / total).toFixed(1)),
      avgManagement: Number((sumMgmt / total).toFixed(1)),
      avgTools: Number((sumTools / total).toFixed(1)),
      totalPins: pinValues.length,
      usedPinsCount: pinValues.filter(p => p.isUsed).length,
      activePinsCount: pinValues.filter(p => !p.isUsed).length,
      deptBreakdown: depts,
      satisfactionBreakdown: satCounts,
    };
  }, [submissions, pins]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (submissions.length === 0) {
      alert('هیچ فیدباکێک نییە بۆ داگرتن.');
      return;
    }

    const headers = [
      'کۆدی PIN',
      'ژمارەی مۆبایل',
      'ناوی کارمەند لە PIN',
      'ناوی نووسراوی بەشداربوو',
      'بەش',
      'بەرواری ناردن',
      'کاتی ناردن',
      'نمرەی گشتی (1-5)',
      'ژینگەی کار (1-5)',
      'هاوکاری تیم (1-5)',
      'دادپەروەری ئیدارە (1-5)',
      'کەرەستە و کەلوپەل (1-5)',
      'گونجاوی دەوام',
      'بەشی پێویست بە چاکسازی',
      'ئەزموونی ئەپڵیکەیشن',
      'خاڵە ئەرێنییەکان',
      'کێشە و ئاستەنگەکان',
      'پێشنیار بۆ ئیدارە',
    ];

    const rows = submissions.map((s) => [
      s.pin,
      s.targetPhone || '--',
      s.targetName || '--',
      s.respondentName || '--',
      s.department,
      s.baghdadDate,
      s.baghdadTime,
      s.overallSatisfaction,
      s.workEnvironmentRating,
      s.teamCooperationRating,
      s.managementFairnessRating,
      s.toolsAndEquipmentRating,
      s.shiftHoursSuitability,
      s.departmentNeedingImprovement,
      s.appExperienceRating,
      s.positiveHighlights || '--',
      s.workplaceChallenges || '--',
      s.suggestionsForManagement || '--',
    ]);

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 24 },
      { wch: 18 },
      { wch: 35 },
      { wch: 35 },
      { wch: 35 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'فیدباکی کارمەندان');
    XLSX.writeFile(wb, `Ashley_Staff_Feedback_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
              داشبۆردی فیدباک و ڕاپرسییەکانی ئاشڵی
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
              {submissions.length} فیدباکی تۆمارکراو
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            بەڕێوەبردنی کۆدەکانی PIN، شیکاری سەرنج و پێشنیاری کارمەندان، و ڕاپۆرتی ئێکسڵ و PDF
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

          {/* Excel Export */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="h-10 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
            title="داگرتنی داتاکان بە فۆرماتی ئێکسڵ"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>داگرتنی ئێکسڵ (.xlsx)</span>
          </button>

          {/* PDF / Print */}
          <button
            type="button"
            onClick={handlePrintReport}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
            title="چاپکردن یان داگرتنی PDF"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>چاپکردن / PDF</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🌟 2. 4-METRIC STATS OVERVIEW TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">کۆی فیدباکەکان</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquareHeart className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-900">{metrics.totalSubmissions}</span>
            <span className="text-xs text-slate-400 font-bold">وەڵام</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">تەواوی فیدباکە نێردراوەکان</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">تێکڕای ڕازیبوون</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-500">{metrics.avgOverall}</span>
            <span className="text-xs text-slate-400 font-bold">لە ٥</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">ڕێژەی ڕازیبوونی گشتی کارمەندان</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">PINە بەکارهێنراوەکان</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-600">{metrics.usedPinsCount}</span>
            <span className="text-xs text-slate-400 font-bold">لە {metrics.totalPins}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">ئەو کارمەندانەی فۆڕمەکەیان پڕکردۆتەوە</span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">PINە چالاکەکان</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-purple-600">{metrics.activePinsCount}</span>
            <span className="text-xs text-slate-400 font-bold">کۆد</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 block">ئامادەن بۆ ناردن و پڕکردنەوە</span>
        </div>
      </div>

      {/* 🌟 3. SEGMENTED TABS: SUBMISSIONS | PINS | ANALYTICS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
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
            onClick={() => setActiveTab('pins')}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'pins'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>بەڕێوەبردنی PINەکان ({Object.keys(pins).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>شیکاری ورد و چارتەکان</span>
          </button>
        </div>

        {/* Quick link status banner */}
        {copiedText && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{copiedText} بە سەرکەوتوویی لەبەرگیرایەوە!</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📑 VIEW 1: SUBMISSIONS TABLE (کە ئەدمین ئەزانێت چ PIN چی پڕکردۆتەوە) */}
      {/* ========================================================================= */}
      {activeTab === 'submissions' && (
        <div className="space-y-3">
          {/* Search & Filters Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="گەڕان بەپێی PIN، ژمارەی مۆبایل، ناو، بەش، یان پێشنیارەکان..."
                className="w-full h-10 pr-10 pl-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:bg-white focus:border-blue-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="all">هەموو بەشەکان</option>
                <option value="شۆڕووم و پێشانگا">شۆڕووم و پێشانگا</option>
                <option value="کۆگاکان و گواستنەوە">کۆگاکان و گواستنەوە</option>
                <option value="بەشی فرۆشتن">بەشی فرۆشتن</option>
                <option value="بەشی ژمێریاری و ئیدارە">بەشی ژمێریاری و ئیدارە</option>
                <option value="تەکنەلۆژیا و IT">تەکنەلۆژیا و IT</option>
                <option value="بەشەکانی تر">بەشەکانی تر</option>
              </select>

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
                      <th className="p-3.5">بەش</th>
                      <th className="p-3.5 text-center">ڕازیبوونی گشتی</th>
                      <th className="p-3.5">گونجاوی دەوام</th>
                      <th className="p-3.5">پوختەی سەرنجەکان</th>
                      <th className="p-3.5">بەروار و کات</th>
                      <th className="p-3.5 text-center">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {filteredSubmissions.map((s) => (
                      <tr 
                        key={s.id} 
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* PIN */}
                        <td className="p-3.5">
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 inline-block" dir="ltr">
                            {s.pin}
                          </span>
                        </td>

                        {/* Respondent / Phone */}
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">
                            {s.respondentName || s.targetName || 'نەناسراو (نهێنی)'}
                          </div>
                          {s.targetPhone && (
                            <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                              {s.targetPhone}
                            </div>
                          )}
                        </td>

                        {/* Department */}
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                            {s.department}
                          </span>
                        </td>

                        {/* Overall Rating */}
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1 font-mono font-black text-amber-500 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{s.overallSatisfaction} / 5</span>
                          </div>
                        </td>

                        {/* Shift hours */}
                        <td className="p-3.5 text-slate-600">
                          {s.shiftHoursSuitability}
                        </td>

                        {/* Snippet */}
                        <td className="p-3.5 max-w-[200px]">
                          <p className="text-[11px] text-slate-500 truncate">
                            {s.positiveHighlights || s.workplaceChallenges || s.suggestionsForManagement || 'بێ تێبینی نووسراو'}
                          </p>
                        </td>

                        {/* Date & Time */}
                        <td className="p-3.5 text-[11px] font-mono text-slate-500" dir="ltr">
                          {s.baghdadDate} {s.baghdadTime}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(s)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                              title="بینینی تەواوی وەڵامەکان"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>وردەکاری</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteSubmission(s.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition-all active:scale-95"
                              title="سڕینەوە"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔑 VIEW 2: PIN MANAGEMENT (لیستی تەواوی PINەکان و دروستکردنی نوێ) */}
      {/* ========================================================================= */}
      {activeTab === 'pins' && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                بەڕێوەبردنی کۆدەکانی PIN بۆ چوونەژوورەوەی فیدباک
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                دەتوانیت PINی چوار ژمارەیی تایبەت بە هەر ژمارەیەک دروست بکەیت، یان بەکۆمەڵ دروستیان بکەیت و بیاندەیت بە کارمەندان.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatePinResult(null);
                  setShowCreatePinModal(true);
                }}
                className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>دروستکردنی PINی نوێ</span>
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

          {/* PINs Table */}
          {Object.keys(pins).length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500">
              هیچ PINێک دروست نەکراوە. کلیک لە [ دروستکردنی PINی نوێ ] بکە تا دەستپێبکەیت.
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                    <tr>
                      <th className="p-3.5">کۆدی PIN</th>
                      <th className="p-3.5">ژمارەی مۆبایل / ناوی پەیوەستکراو</th>
                      <th className="p-3.5">جۆری PIN</th>
                      <th className="p-3.5">دۆخی بەکارهێنان</th>
                      <th className="p-3.5">بەرواری دروستکردن</th>
                      <th className="p-3.5">کاتی پڕکردنەوە</th>
                      <th className="p-3.5 text-center">لینکی ڕاستەوخۆ و کۆپی</th>
                      <th className="p-3.5 text-center">سڕینەوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {Object.values(pins).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((p) => {
                      const directUrl = typeof window !== 'undefined'
                        ? `${window.location.origin}/feedback?pin=${p.pin}`
                        : `https://ashley-staff.vercel.app/feedback?pin=${p.pin}`;

                      return (
                        <tr key={p.pin} className="hover:bg-slate-50/80 transition-colors">
                          {/* PIN */}
                          <td className="p-3.5">
                            <span className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-slate-900 text-amber-400 inline-block tracking-wider" dir="ltr">
                              {p.pin}
                            </span>
                          </td>

                          {/* Target Phone / Name */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900">
                              {p.targetName || 'گشتی (هەمووان)'}
                            </div>
                            {p.targetPhone && (
                              <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                                {p.targetPhone}
                              </div>
                            )}
                            {p.notes && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {p.notes}
                              </div>
                            )}
                          </td>

                          {/* Type */}
                          <td className="p-3.5">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                              {p.isSingleUse ? 'یەکجار بەکارهێنان' : 'فرە بەکارهێنان'}
                            </span>
                          </td>

                          {/* Status */}
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

                          {/* Created At */}
                          <td className="p-3.5 font-mono text-[11px] text-slate-500" dir="ltr">
                            {p.createdAt ? p.createdAt.slice(0, 10) : '--'}
                          </td>

                          {/* Used At */}
                          <td className="p-3.5 font-mono text-[11px] text-slate-500" dir="ltr">
                            {p.usedAt ? p.usedAt.replace('T', ' ').slice(0, 16) : '--'}
                          </td>

                          {/* Copy PIN & Link */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Copy PIN */}
                              <button
                                type="button"
                                onClick={() => handleCopy(p.pin, `PIN (${p.pin})`)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                title="کۆپیکردنی PIN"
                              >
                                <Copy className="w-3 h-3" />
                                <span>کۆدی PIN</span>
                              </button>

                              {/* Copy Direct Link */}
                              <button
                                type="button"
                                onClick={() => handleCopy(directUrl, `لینکی PIN (${p.pin})`)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer active:scale-95"
                                title="کۆپیکردنی لینکی ڕاستەوخۆ بۆ بەشداربوو"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>کۆپی لینک</span>
                              </button>
                            </div>
                          </td>

                          {/* Delete */}
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
      {/* 📊 VIEW 3: COMPREHENSIVE ANALYTICS & INSIGHTS */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Detailed 5-criteria breakdown */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>ئاستی پێوەرەکانی هەڵسەنگاندن (تێکڕای نمرە لە ٥)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { title: 'ڕازیبوونی گشتی', score: metrics.avgOverall, color: 'bg-amber-500' },
                { title: 'ژینگەی کارکردن', score: metrics.avgWorkEnv, color: 'bg-emerald-500' },
                { title: 'هاوکاری تیمەکان', score: metrics.avgTeamCoop, color: 'bg-blue-500' },
                { title: 'دادپەروەری ئیدارە', score: metrics.avgManagement, color: 'bg-purple-500' },
                { title: 'کەرەستە و کەلوپەل', score: metrics.avgTools, color: 'bg-indigo-500' },
              ].map((item) => (
                <div key={item.title} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 block mb-1.5">{item.title}</span>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-2xl font-black font-mono text-slate-900">{item.score}</span>
                    <span className="text-xs text-slate-400 font-bold">/ 5</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Department breakdown & Star distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Department stats */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>دابەشبوونی بەشداربووان بەپێی بەشەکان</span>
              </h3>
              <div className="space-y-2">
                {Object.entries(metrics.deptBreakdown).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">هیچ داتایەک بەردەست نییە</p>
                ) : (
                  Object.entries(metrics.deptBreakdown).map(([dept, count]) => {
                    const pct = metrics.totalSubmissions > 0 ? Math.round((count / metrics.totalSubmissions) * 100) : 0;
                    return (
                      <div key={dept} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700">{dept}</span>
                          <span className="font-mono text-slate-500">{count} بەشداربوو ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Star satisfaction breakdown */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>دابەشبوونی ئەستێرەکانی ڕازیبوون</span>
              </h3>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = metrics.satisfactionBreakdown[stars as keyof typeof metrics.satisfactionBreakdown] || 0;
                  const pct = metrics.totalSubmissions > 0 ? Math.round((count / metrics.totalSubmissions) * 100) : 0;
                  return (
                    <div key={stars} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center gap-1 text-amber-500">
                          <span>{stars} ئەستێرە</span>
                          <span>{'⭐'.repeat(stars)}</span>
                        </div>
                        <span className="font-mono text-slate-500">{count} دەنگ ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
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
          <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
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
                    {selectedSubmission.respondentName || selectedSubmission.targetName || 'نهێنی (ناونیشان نەکراو)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">ژمارەی مۆبایل:</span>
                  <span className="font-bold text-slate-900 font-mono" dir="ltr">
                    {selectedSubmission.targetPhone || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">بەش:</span>
                  <span className="font-bold text-slate-900">
                    {selectedSubmission.department}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">کۆدی ناسنامە:</span>
                  <span className="font-mono text-slate-700">{selectedSubmission.id}</span>
                </div>
              </div>

              {/* 5-Criteria Ratings */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <h4 className="font-black text-slate-900">هەڵسەنگاندنەکان (لە ٥):</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                    <span>ڕازیبوونی گشتی:</span>
                    <span className="font-black font-mono text-amber-500">⭐ {selectedSubmission.overallSatisfaction} / 5</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                    <span>ژینگەی کارکردن:</span>
                    <span className="font-black font-mono text-emerald-600">⭐ {selectedSubmission.workEnvironmentRating} / 5</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                    <span>هاوکاری تیمەکان:</span>
                    <span className="font-black font-mono text-blue-600">⭐ {selectedSubmission.teamCooperationRating} / 5</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                    <span>دادپەروەری ئیدارە:</span>
                    <span className="font-black font-mono text-purple-600">⭐ {selectedSubmission.managementFairnessRating} / 5</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 col-span-1 sm:col-span-2">
                    <span>کەرەستە و کەلوپەل:</span>
                    <span className="font-black font-mono text-indigo-600">⭐ {selectedSubmission.toolsAndEquipmentRating} / 5</span>
                  </div>
                </div>
              </div>

              {/* Multiple Choice Answers */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-black text-slate-900">وەڵامی پرسیارەکان:</h4>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500 font-bold block">• ئایا کاتەکانی دەوام گونجاون؟</span>
                    <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5">
                      {selectedSubmission.shiftHoursSuitability}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">• کام بەشە پێویستی بە چاکسازی هەیە؟</span>
                    <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5">
                      {selectedSubmission.departmentNeedingImprovement}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block">• ئەزموونی ئەپڵیکەیشن:</span>
                    <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 inline-block mt-0.5">
                      {selectedSubmission.appExperienceRating}
                    </span>
                  </div>
                </div>
              </div>

              {/* Written Feedback Comments */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                  <span className="font-black text-emerald-800 block">خاڵە ئەرێنی و بەهێزەکان:</span>
                  <p className="text-slate-800 leading-relaxed">
                    {selectedSubmission.positiveHighlights || 'هیچ نەنووسراوە'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <span className="font-black text-rose-800 block">کێشە و ئاستەنگەکان:</span>
                  <p className="text-slate-800 leading-relaxed">
                    {selectedSubmission.workplaceChallenges || 'هیچ نەنووسراوە'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-1">
                  <span className="font-black text-blue-800 block">پێشنیار بۆ بەڕێوەبەرایەتی:</span>
                  <p className="text-slate-800 leading-relaxed">
                    {selectedSubmission.suggestionsForManagement || 'هیچ نەنووسراوە'}
                  </p>
                </div>
              </div>
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
                    <span>کۆدی PIN بە سەرکەوتوویی دروستکرا!</span>
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
                    کۆپیکردنی لینکی فیدباک
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreatePin} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  کۆدی PIN (ئارەزوومەندانە - ئەگەر بەتاڵ بێت بە ئۆتۆماتیک ٤ ژمارە دروست دەبێت):
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={newCustomPin}
                  onChange={(e) => setNewCustomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="بۆ نموونە: 4821 (بەتاڵی جێبێڵە بۆ دروستبوونی خۆکار)"
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
                  ناوی کارمەند یان تێبینی بۆ کێیە:
                </label>
                <input
                  type="text"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  placeholder="بۆ نموونە: کارمەندی شۆڕووم / محەمەد"
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
      {/* 🎲 MODAL: BATCH CREATE PINS */}
      {/* ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                  <KeyRound className="w-4 h-4 text-purple-500" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  دروستکردنی بەکۆمەڵی PINەکان
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
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                  <span>{batchCreatedPins.length} کۆدی نوێ دروستکرا:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const all = batchCreatedPins.map(p => `${p.pin}: https://ashley-staff.vercel.app/feedback?pin=${p.pin}`).join('\n');
                      handleCopy(all, 'سەرجەم PINەکان لەگەڵ لینک');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer active:scale-95"
                  >
                    کۆپیکردنی هەمووی پێکەوە
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs" dir="ltr">
                  {batchCreatedPins.map((p) => (
                    <div key={p.pin} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-black text-amber-600">{p.pin}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(`https://ashley-staff.vercel.app/feedback?pin=${p.pin}`, `لینک ${p.pin}`)}
                        className="text-[11px] text-blue-600 hover:underline cursor-pointer font-sans"
                      >
                        کۆپی لینک
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer mt-2"
                >
                  تەواو بوو
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 font-medium">
                  ژمارەی ئەو PINانە هەڵبژێرە کە دەتەوێت لە یەک کاتدا دروست بکرێن (هەریەکەیان ٤ ژمارەی جیاواز دەبێت):
                </p>

                <div className="flex items-center gap-2">
                  {[3, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setBatchCount(num)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-black cursor-pointer transition-all ${
                        batchCount === num
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {num} دانە
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={batchCreating}
                    onClick={handleCreateBatch}
                    className="flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-xs disabled:opacity-50"
                  >
                    {batchCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    <span>دروستکردنی {batchCount} PIN پێکەوە</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 h-11 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    پاشگەزبوونەوە
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
