'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  KeyRound,
  Layers,
  Lock,
  MessageSquareQuote,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
} from 'recharts';
import {
  MANAGER_EVALUATION_ITEMS,
  MANAGER_OPEN_QUESTIONS,
  MANAGER_PILLAR_META,
  MANAGER_RATING_SCALE,
  MANAGER_SCORE_BANDS,
  getManagerScoreBand,
  toKurdishDigits,
  type ManagerEvaluationPillar,
  type ManagerEvaluationSubmission,
} from '@/lib/feedback/manager-evaluation';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';

interface ManagerPinSummary {
  pin: string;
  isSingleUse?: boolean;
  isUsed?: boolean;
  usedAt?: string;
  targetName?: string;
  scope?: string;
  notes?: string;
  createdAt?: string;
}

type StudioTab = 'overview' | 'criteria' | 'open_qa' | 'submissions';
type DateRangeFilter = 'all' | '7d' | '30d' | '2026';
type CriteriaSort = 'order' | 'highest' | 'lowest';

function useAnimatedNumber(target: number, duration = 750): number {
  const [value, setValue] = useState<number>(target);
  const previousRef = useRef<number>(target);

  useEffect(() => {
    const startVal = previousRef.current;
    const endVal = Number.isFinite(target) ? target : 0;
    if (Math.abs(startVal - endVal) < 0.01) {
      setValue(endVal);
      previousRef.current = endVal;
      return;
    }

    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(endVal);
      previousRef.current = endVal;
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // ease-out quint
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = startVal + (endVal - startVal) * eased;
      setValue(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        previousRef.current = endVal;
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}

export function AdminManagerEvaluationDashboard() {
  const [evaluations, setEvaluations] = useState<ManagerEvaluationSubmission[]>([]);
  const [managerPins, setManagerPins] = useState<ManagerPinSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [pillarFilter, setPillarFilter] = useState<'all' | ManagerEvaluationPillar>('all');
  const [criteriaSort, setCriteriaSort] = useState<CriteriaSort>('order');
  const [openQuestionTab, setOpenQuestionTab] = useState<'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'q5'>('all');
  const [qaSearch, setQaSearch] = useState<string>('');

  // Modals
  const [selectedSubmission, setSelectedSubmission] = useState<ManagerEvaluationSubmission | null>(null);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState<boolean>(false);

  // Quick PIN creator state (0000 - 5999)
  const [customPin, setCustomPin] = useState<string>('');
  const [pinSingleUse, setPinSingleUse] = useState<boolean>(true);
  const [pinNotes, setPinNotes] = useState<string>('فۆرمی نهێنی هەڵسەنگاندنی بەڕێوەبەر ٢٠٢٦');
  const [batchCount, setBatchCount] = useState<number>(5);
  const [pinActionLoading, setPinActionLoading] = useState<boolean>(false);
  const [copiedPin, setCopiedPin] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? '' : prev));
    }, 3200);
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/feedback/admin', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'شکستی هێنا لە وەرگرتنی داتای هەڵسەنگاندنی بەڕێوەبەر');
      }

      const rawEvaluations: ManagerEvaluationSubmission[] = Array.isArray(data.managerEvaluations)
        ? data.managerEvaluations
        : [];
      setEvaluations(
        [...rawEvaluations].sort(
          (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
        )
      );

      const allPins: ManagerPinSummary[] = Object.values(data.pins || {});
      setManagerPins(
        allPins
          .filter((p) => p && p.scope === 'manager_feedback')
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'هەڵەی پەیوەندی ڕوویدا');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Filtered submissions by date window
  const filteredEvaluations = useMemo(() => {
    if (dateFilter === 'all') return evaluations;
    const now = Date.now();
    return evaluations.filter((sub) => {
      if (dateFilter === '2026') {
        return (sub.evaluationDate || sub.baghdadDate || sub.submittedAt || '').startsWith('2026');
      }
      const ts = new Date(sub.submittedAt || sub.evaluationDate || 0).getTime();
      if (!ts) return false;
      const days = dateFilter === '7d' ? 7 : 30;
      return now - ts <= days * 24 * 60 * 60 * 1000;
    });
  }, [evaluations, dateFilter]);

  // Core aggregate statistics (20..100 & 1..5 & 4 Pillars & 5 Bands)
  const analytics = useMemo(() => {
    const count = filteredEvaluations.length;
    if (count === 0) {
      return {
        count: 0,
        overallTotalScore: 0,
        overallAverage: 0,
        activeBand: null as ReturnType<typeof getManagerScoreBand> | null,
        bandCounts: MANAGER_SCORE_BANDS.map((b) => ({ ...b, count: 0, percent: 0 })),
        pillarStats: Object.entries(MANAGER_PILLAR_META).map(([key, meta]) => ({
          pillar: key as ManagerEvaluationPillar,
          label: meta.label,
          shortLabel: meta.shortLabel,
          color: meta.color,
          avg5: 0,
          score100: 0,
        })),
        bestPillar: null as null | { pillar: ManagerEvaluationPillar; shortLabel: string; avg5: number; score100: number },
        weakestPillar: null as null | { pillar: ManagerEvaluationPillar; shortLabel: string; avg5: number; score100: number },
        itemStats: MANAGER_EVALUATION_ITEMS.map((item) => ({
          ...item,
          avg5: 0,
          score100: 0,
          counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>,
        })),
        top3Strengths: [] as Array<{ id: number; text: string; avg5: number; score100: number }>,
        bottom3Improvements: [] as Array<{ id: number; text: string; avg5: number; score100: number }>,
        trendData: [] as Array<{ indexLabel: string; date: string; totalScore: number; bandLabel: string }>,
        openAnswersCount: 0,
      };
    }

    let totalSum = 0;
    const bandCountMap: Record<string, number> = {
      very_high: 0,
      high: 0,
      medium: 0,
      weak: 0,
      very_weak: 0,
    };

    const itemSums: Record<number, number> = {};
    const itemDist: Record<number, Record<1 | 2 | 3 | 4 | 5, number>> = {};
    for (const item of MANAGER_EVALUATION_ITEMS) {
      itemSums[item.id] = 0;
      itemDist[item.id] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }

    let openAnswersCount = 0;

    for (const sub of filteredEvaluations) {
      totalSum += sub.totalScore;
      bandCountMap[sub.satisfactionBandKey] = (bandCountMap[sub.satisfactionBandKey] || 0) + 1;

      for (const item of MANAGER_EVALUATION_ITEMS) {
        const val = Math.min(5, Math.max(1, Math.round(Number(sub.scores?.[item.id] || 0)))) as 1 | 2 | 3 | 4 | 5;
        itemSums[item.id] += val;
        itemDist[item.id][val] = (itemDist[item.id][val] || 0) + 1;
      }

      const oa = sub.openAnswers || {};
      if (oa.q1?.trim() || oa.q2?.trim() || oa.q3?.trim() || oa.q4?.trim() || oa.q5?.trim()) {
        openAnswersCount += 1;
      }
    }

    const overallTotalScore = Math.round((totalSum / count) * 10) / 10;
    const overallAverage = Math.round((overallTotalScore / 20) * 100) / 100;
    const activeBand = getManagerScoreBand(Math.round(overallTotalScore));

    const bandCounts = MANAGER_SCORE_BANDS.map((b) => {
      const c = bandCountMap[b.key] || 0;
      return {
        ...b,
        count: c,
        percent: Math.round((c / count) * 100),
      };
    });

    const itemStats = MANAGER_EVALUATION_ITEMS.map((item) => {
      const avg5 = Math.round((itemSums[item.id] / count) * 100) / 100;
      return {
        ...item,
        avg5,
        score100: Math.round(avg5 * 20),
        counts: itemDist[item.id],
      };
    });

    const pillarBuckets: Record<ManagerEvaluationPillar, number[]> = {
      respect: [],
      execution: [],
      fairness: [],
      support: [],
    };
    for (const it of itemStats) {
      pillarBuckets[it.pillar].push(it.avg5);
    }

    const pillarStats = (Object.keys(MANAGER_PILLAR_META) as ManagerEvaluationPillar[]).map((pillar) => {
      const arr = pillarBuckets[pillar];
      const avg5 = arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
      return {
        pillar,
        label: MANAGER_PILLAR_META[pillar].label,
        shortLabel: MANAGER_PILLAR_META[pillar].shortLabel,
        color: MANAGER_PILLAR_META[pillar].color,
        avg5,
        score100: Math.round(avg5 * 20),
      };
    });

    const sortedPillars = [...pillarStats].sort((a, b) => b.avg5 - a.avg5);
    const bestPillar = sortedPillars[0] || null;
    const weakestPillar = sortedPillars[sortedPillars.length - 1] || null;

    const sortedItemsDesc = [...itemStats].sort((a, b) => b.avg5 - a.avg5 || a.id - b.id);
    const top3Strengths = sortedItemsDesc.slice(0, 3);
    const bottom3Improvements = [...sortedItemsDesc].reverse().slice(0, 3);

    const chronological = [...filteredEvaluations].sort(
      (a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
    );
    const trendData = chronological.map((sub, idx) => ({
      indexLabel: `#${idx + 1}`,
      date: sub.baghdadDate || sub.evaluationDate || '',
      totalScore: sub.totalScore,
      bandLabel: getManagerScoreBand(sub.totalScore).label,
    }));

    return {
      count,
      overallTotalScore,
      overallAverage,
      activeBand,
      bandCounts,
      pillarStats,
      bestPillar,
      weakestPillar,
      itemStats,
      top3Strengths,
      bottom3Improvements,
      trendData,
      openAnswersCount,
    };
  }, [filteredEvaluations]);

  // Animated KPI values
  const animTotalScore = useAnimatedNumber(analytics.overallTotalScore, 850);
  const animAverage = useAnimatedNumber(analytics.overallAverage, 850);
  const animCount = useAnimatedNumber(analytics.count, 650);

  // Filtered & sorted 20-item breakdown list
  const displayedCriteria = useMemo(() => {
    let list = [...analytics.itemStats];
    if (pillarFilter !== 'all') {
      list = list.filter((it) => it.pillar === pillarFilter);
    }
    if (criteriaSort === 'highest') {
      list.sort((a, b) => b.avg5 - a.avg5 || a.id - b.id);
    } else if (criteriaSort === 'lowest') {
      list.sort((a, b) => a.avg5 - b.avg5 || a.id - b.id);
    } else {
      list.sort((a, b) => a.id - b.id);
    }
    return list;
  }, [analytics.itemStats, pillarFilter, criteriaSort]);

  // Open Q&A cards derived from filteredEvaluations
  const openQaEntries = useMemo(() => {
    const query = qaSearch.trim().toLowerCase();
    const list: Array<{
      submissionId: string;
      questionKey: 'q1' | 'q2' | 'q3' | 'q4' | 'q5';
      questionNum: string;
      questionLabel: string;
      answer: string;
      date: string;
      time: string;
      totalScore: number;
      band: ReturnType<typeof getManagerScoreBand>;
    }> = [];

    for (const sub of filteredEvaluations) {
      for (const q of MANAGER_OPEN_QUESTIONS) {
        if (openQuestionTab !== 'all' && openQuestionTab !== q.key) continue;
        const ans = (sub.openAnswers?.[q.key] || '').trim();
        if (!ans) continue;
        if (query && !ans.toLowerCase().includes(query) && !q.label.toLowerCase().includes(query)) continue;
        list.push({
          submissionId: sub.id,
          questionKey: q.key,
          questionNum: q.num,
          questionLabel: q.label,
          answer: ans,
          date: sub.baghdadDate || sub.evaluationDate,
          time: sub.baghdadTime || '',
          totalScore: sub.totalScore,
          band: getManagerScoreBand(sub.totalScore),
        });
      }
    }
    return list;
  }, [filteredEvaluations, openQuestionTab, qaSearch]);

  // Delete single anonymous evaluation
  const handleDeleteEvaluation = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_manager_evaluation', id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'سڕینەوە سەرکەوتوو نەبوو');
      }
      setEvaluations((prev) => prev.filter((item) => item.id !== id));
      if (selectedSubmission?.id === id) setSelectedSubmission(null);
      showToast('فۆرمە هەڵبژێردراوەکە بە سەرکەوتوویی سڕایەوە');
    } catch (err: any) {
      showToast(err?.message || 'هەڵە لە سڕینەوە ڕوویدا');
    } finally {
      setDeletingId(null);
    }
  };

  // Clear all manager evaluations
  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all_manager_evaluations' }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'سڕینەوەی گشتی سەرکەوتوو نەبوو');
      }
      setEvaluations([]);
      setConfirmClearAll(false);
      setSelectedSubmission(null);
      showToast('هەموو تۆمارەکانی هەڵسەنگاندنی بەڕێوەبەر سفر کرانەوە');
    } catch (err: any) {
      showToast(err?.message || 'هەڵە لە سڕینەوەی گشتی ڕوویدا');
    } finally {
      setClearingAll(false);
    }
  };

  // Create custom 0000-5999 Manager Evaluation PIN
  const handleCreateCustomPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customPin.trim();
    if (cleaned) {
      const num = parseInt(cleaned, 10);
      if (!/^\d{4}$/.test(cleaned) || Number.isNaN(num) || num < 0 || num > 5999) {
        showToast('کۆدی PINی هەڵسەنگاندنی بەڕێوەبەر دەبێت ٤ ژمارە بێت لە نێوان 0000 تا 5999');
        return;
      }
    }

    setPinActionLoading(true);
    try {
      const pinToUse = cleaned || String(Math.floor(Math.random() * 5000) + 1000).padStart(4, '0');
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_pin',
          customPin: pinToUse,
          scope: 'manager_feedback',
          targetName: 'فۆرمی هەڵسەنگاندنی بەڕێوەبەر',
          isSingleUse: pinSingleUse,
          notes: pinNotes.trim() || 'فۆرمی نهێنی بەڕێوەبەر',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'دروستکردنی PIN سەرکەوتوو نەبوو');
      }
      setCustomPin('');
      await fetchData(true);
      showToast(`کۆدی PIN (${pinToUse}) بۆ فۆرمی هەڵسەنگاندنی بەڕێوەبەر دروستکرا`);
    } catch (err: any) {
      showToast(err?.message || 'هەڵە لە دروستکردنی PIN');
    } finally {
      setPinActionLoading(false);
    }
  };

  // Batch create 0000-5999 PINs
  const handleBatchPins = async () => {
    setPinActionLoading(true);
    try {
      const res = await fetch('/api/feedback/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_pins',
          count: Math.min(30, Math.max(1, batchCount)),
          scope: 'manager_feedback',
          isSingleUse: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'دروستکردنی کۆمەڵە کۆد سەرکەوتوو نەبوو');
      }
      await fetchData(true);
      showToast(`${batchCount} کۆدی PINی یەکجار بەکارهێنان (0000-5999) دروستکرا`);
    } catch (err: any) {
      showToast(err?.message || 'هەڵە لە دروستکردنی کۆمەڵە کۆد');
    } finally {
      setPinActionLoading(false);
    }
  };

  const handleCopyLink = (pinCode: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ashley-staff.vercel.app';
    const url = `${origin}/feedback?pin=${pinCode}`;
    navigator.clipboard?.writeText(url);
    setCopiedPin(pinCode);
    showToast(`لینکی فۆرم بە PINی ${pinCode} کۆپی کرا`);
    setTimeout(() => setCopiedPin(null), 2000);
  };

  // Export clean Excel workbook with 4 structured sheets
  const handleExportExcel = () => {
    if (filteredEvaluations.length === 0) {
      showToast('هیچ داتایەک نییە بۆ دەرکردنی Excel');
      return;
    }

    const wb = XLSX.utils.book_new();

    const summaryRows = [
      { بەش: 'کۆی گشتی فۆرمەکان (نهێنی - بێ ناو)', نمرە_یان_ژمارە: analytics.count },
      { بەش: 'تێکڕای کۆی نمرە (لە ٢٠ تا ١٠٠)', نمرە_یان_ژمارە: analytics.overallTotalScore },
      { بەش: 'تێکڕای گشتی (لە ١ تا ٥)', نمرە_یان_ژمارە: analytics.overallAverage },
      { بەش: 'ئاستی ڕەزامەندی (بەشی سێیەم)', نمرە_یان_ژمارە: analytics.activeBand?.label || '—' },
      ...analytics.bandCounts.map((b) => ({
        بەش: `دابەشبوون: ${b.label} (${b.rangeLabel})`,
        نمرە_یان_ژمارە: `${b.count} فۆرم (${b.percent}%)`,
      })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'پوختەی شیکاری');

    const criteriaRows = analytics.itemStats.map((it) => ({
      ژمارە: it.id,
      تەوەر: MANAGER_PILLAR_META[it.pillar].shortLabel,
      بڕگەی_هەڵسەنگاندن: it.text,
      تێکڕا_لە_٥: it.avg5,
      هاوتا_لە_١٠٠: it.score100,
      '٥_زۆر_ڕازیم': it.counts[5],
      '٤_ڕازیم': it.counts[4],
      '٣_مامناوەند': it.counts[3],
      '٢_ناڕازیم': it.counts[2],
      '١_زۆر_ناڕازیم': it.counts[1],
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(criteriaRows), '٢٠ بڕگەکە');

    const submissionsRows = filteredEvaluations.map((sub, idx) => {
      const band = getManagerScoreBand(sub.totalScore);
      const row: Record<string, string | number> = {
        زنجیرە: idx + 1,
        ناسنامە: 'نهێنی - بێ ناو',
        بەرواری_فۆرم: sub.evaluationDate || sub.baghdadDate,
        کاتی_تۆمار: sub.baghdadTime || '',
        کۆی_نمرە_لە_١٠٠: sub.totalScore,
        تێکڕا_لە_٥: sub.averageScore,
        ئاستی_ڕەزامەندی: band.label,
      };
      for (const item of MANAGER_EVALUATION_ITEMS) {
        row[`بڕگە_${item.id}`] = sub.scores?.[item.id] ?? 0;
      }
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(submissionsRows), 'تۆمارەکان');

    const openQaRows = filteredEvaluations.map((sub, idx) => ({
      زنجیرە: idx + 1,
      بەروار: sub.baghdadDate || sub.evaluationDate,
      کۆی_نمرە: sub.totalScore,
      '١_جەختکردنەوە_و_دووبارەبوونەوە': sub.openAnswers?.q1 || '',
      '٢_باشترین_کاری_٢٠٢٥_بۆ_فرۆش': sub.openAnswers?.q2 || '',
      '٣_باشترین_پلانی_٢٠٢٦': sub.openAnswers?.q3 || '',
      '٤_ئەرێنی_و_نەگونجاو_لە_بەڕێوەبەر': sub.openAnswers?.q4 || '',
      '٥_تێبینی_و_پێشنیار': sub.openAnswers?.q5 || '',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(openQaRows), 'پرسیارە کراوەکان');

    XLSX.writeFile(wb, `Manager_Evaluation_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('فایلی Excel بە سەرکەوتوویی دابەزێنرا');
  };

  // SVG Gauge math (r=74, C≈465)
  const gaugeRadius = 74;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const normalizedScoreRatio = analytics.count > 0 ? Math.min(1, Math.max(0, animTotalScore / 100)) : 0;
  const gaugeDashOffset = gaugeCircumference * (1 - normalizedScoreRatio);
  const gaugeStrokeColor = analytics.activeBand?.color || '#475569';

  const activePinsCount = managerPins.filter((p) => !p.isSingleUse || !p.isUsed).length;

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 space-y-5" dir="rtl">
      <style>{`
        @keyframes mgrStudioEnter {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mgrPulseGlow {
          0%, 100% { opacity: 0.42; transform: scale(1); }
          50% { opacity: 0.68; transform: scale(1.06); }
        }
        .mgr-enter {
          animation: mgrStudioEnter 0.42s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        .mgr-stagger-1 { animation-delay: 40ms; }
        .mgr-stagger-2 { animation-delay: 90ms; }
        .mgr-stagger-3 { animation-delay: 140ms; }
        .mgr-stagger-4 { animation-delay: 190ms; }
        .mgr-orb {
          animation: mgrPulseGlow 6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mgr-enter, .mgr-orb { animation: none !important; }
        }
        @media print {
          body * { visibility: hidden !important; }
          #mgr-print-report-sheet, #mgr-print-report-sheet * {
            visibility: visible !important;
          }
          #mgr-print-report-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 12mm !important;
            background: white !important;
            color: #0f172a !important;
            box-shadow: none !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl border border-slate-700/80 flex items-center gap-2 mgr-enter">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. HERO MOTION STUDIO BANNER */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white border border-slate-800/90 shadow-2xl p-5 sm:p-7 mgr-enter">
        {/* Ambient motion orbs */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl mgr-orb" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl mgr-orb" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Top header bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-400/30">
                  <Lock className="w-3.5 h-3.5" />
                  تایبەت بە بەشی هەڵسەنگاندن — ئەدمین پانێڵ بە تەنها
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  جیاواز و سەربەخۆ لە فیدباکی کارمەندان
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                  <Award className="w-5 h-5" />
                </span>
                <span>داشبۆردی شیکردنەوە و هەڵسەنگاندنی بەڕێوەبەر (٢٠٢٦)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                بەشی سێیەم: شیکردنەوەی ئەنجامەکانی فۆرمی نهێنی و بێ‌ناوی فرۆشیاران و کارمەندان (٢٠ بڕگە لەسەر پێوەری ٢٠ تا ١٠٠ + ٥ پرسیاری کراوە و پێشنیار).
              </p>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-1">
                {(
                  [
                    { id: 'all', label: 'هەموو کاتەکان' },
                    { id: '30d', label: '٣٠ ڕۆژ' },
                    { id: '7d', label: '٧ ڕۆژ' },
                    { id: '2026', label: '٢٠٢٦' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDateFilter(opt.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      dateFilter === opt.id
                        ? 'bg-amber-400 text-slate-950 shadow-sm font-black'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="نوێکردنەوەی داتا"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-300' : ''}`} />
                <span className="hidden sm:inline">نوێکردنەوە</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                <span>کۆدی فۆرم (PIN)</span>
                <span className="px-1.5 py-0.5 rounded-md bg-white/15 text-[10px] font-mono">
                  {toKurdishDigits(activePinsCount)}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ / PDF</span>
              </button>
            </div>
          </div>

          {/* Gauge + KPI Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Animated Radial Gauge Card */}
            <div className="lg:col-span-5 rounded-2xl bg-white/[0.06] backdrop-blur-md border border-white/10 p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 180 180">
                  <circle
                    cx="90"
                    cy="90"
                    r={gaugeRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.09)"
                    strokeWidth="14"
                  />
                  <circle
                    cx="90"
                    cy="90"
                    r={gaugeRadius}
                    fill="none"
                    stroke={gaugeStrokeColor}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={gaugeCircumference}
                    strokeDashoffset={gaugeDashOffset}
                    style={{
                      transition: 'stroke-dashoffset 850ms cubic-bezier(0.23, 1, 0.32, 1), stroke 400ms ease',
                      filter: `drop-shadow(0 0 10px ${gaugeStrokeColor}66)`,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] font-bold text-slate-300">کۆی نمرە</span>
                  <span className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-white leading-none my-1">
                    {analytics.count > 0 ? toKurdishDigits(animTotalScore.toFixed(1)) : '—'}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">لە ١٠٠ (کەمترین ٢٠)</span>
                </div>
              </div>

              <div className="flex-1 text-center sm:text-right space-y-2.5">
                <div className="text-xs font-bold text-slate-400">ئاستی ڕەزامەندی گشتی (بەشی سێیەم)</div>
                {analytics.activeBand ? (
                  <>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span
                        className="px-3.5 py-1.5 rounded-xl text-sm font-black shadow-lg"
                        style={{
                          backgroundColor: `${analytics.activeBand.color}26`,
                          color: '#ffffff',
                          border: `1px solid ${analytics.activeBand.color}88`,
                        }}
                      >
                        {analytics.activeBand.label} ({analytics.activeBand.rangeLabel})
                      </span>
                      <span className="text-xs font-bold text-slate-300 tabular-nums">
                        تێکڕا: {toKurdishDigits(animAverage.toFixed(2))} / ٥
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {analytics.activeBand.description}
                    </p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm font-black text-slate-200">هێشتا هیچ فۆرمێک پڕ نەکراوەتەوە</div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      کۆدێکی PIN (0000 تا 5999) بدە بە فرۆشیاران و کارمەندان تا ڕاپرسییە نهێنییەکە پڕ بکەنەوە.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 4 KPI Mini Cards */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-3.5">
              {/* KPI 1 */}
              <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 flex flex-col justify-between mgr-enter mgr-stagger-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">کۆی فۆرمە وەرگیراوەکان</span>
                  <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-2xl sm:text-3xl font-black tabular-nums text-white">
                    {toKurdishDigits(Math.round(animCount))}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    فۆرمی نهێنی و بێ ناو ({toKurdishDigits(analytics.openAnswersCount)} تێبینی کراوەی هەیە)
                  </div>
                </div>
              </div>

              {/* KPI 2 */}
              <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 flex flex-col justify-between mgr-enter mgr-stagger-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">بەهێزترین تەوەر</span>
                  <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-lg font-black text-emerald-300 truncate">
                    {analytics.bestPillar && analytics.count > 0 ? analytics.bestPillar.shortLabel : '—'}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 tabular-nums">
                    {analytics.bestPillar && analytics.count > 0
                      ? `تێکڕا: ${toKurdishDigits(analytics.bestPillar.avg5.toFixed(2))} / ٥ (${toKurdishDigits(analytics.bestPillar.score100)}٪)`
                      : 'لە چاوەڕوانی داتا'}
                  </div>
                </div>
              </div>

              {/* KPI 3 */}
              <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 flex flex-col justify-between mgr-enter mgr-stagger-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">خاڵی پێویست بە سەرنج</span>
                  <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-base sm:text-lg font-black text-amber-300 truncate">
                    {analytics.weakestPillar && analytics.count > 0 ? analytics.weakestPillar.shortLabel : '—'}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-1 tabular-nums">
                    {analytics.weakestPillar && analytics.count > 0
                      ? `تێکڕا: ${toKurdishDigits(analytics.weakestPillar.avg5.toFixed(2))} / ٥ (${toKurdishDigits(analytics.weakestPillar.score100)}٪)`
                      : 'لە چاوەڕوانی داتا'}
                  </div>
                </div>
              </div>

              {/* KPI 4 */}
              <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4 flex flex-col justify-between mgr-enter mgr-stagger-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">بەرزترین / کەمترین فۆرم</span>
                  <span className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  {analytics.count > 0 ? (
                    <>
                      <div className="text-xl sm:text-2xl font-black tabular-nums text-white">
                        {toKurdishDigits(Math.max(...filteredEvaluations.map((e) => e.totalScore)))}
                        <span className="text-slate-500 mx-1.5 text-base">/</span>
                        <span className="text-amber-300">
                          {toKurdishDigits(Math.min(...filteredEvaluations.map((e) => e.totalScore)))}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">بەرزترین و نزمترین نمرەی تۆمارکراو</div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-black text-slate-400">—</div>
                      <div className="text-[11px] text-slate-500 mt-1">هیچ تۆمارێک نییە</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error Alert */}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-center justify-between gap-3 text-rose-800 text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData(false)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
          >
            دووبارە هەوڵبدەوە
          </button>
        </div>
      )}

      {/* 2. STUDIO NAVIGATION SUB-TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'overview', label: 'داشبۆرد و شیکاری ئەنجام', icon: BarChart3 },
              { id: 'criteria', label: '٢٠ بڕگەی هەڵسەنگاندن', icon: Layers },
              { id: 'open_qa', label: 'پرسیارە کراوەکان و پێشنیار', icon: MessageSquareQuote, badge: openQaEntries.length },
              { id: 'submissions', label: 'تۆمارە نهێنییەکان', icon: Users, badge: filteredEvaluations.length },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                  active
                    ? 'bg-slate-900 text-white shadow-md font-black'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{t.label}</span>
                {'badge' in t && typeof t.badge === 'number' && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      active ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {toKurdishDigits(t.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {evaluations.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-3 py-2 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>سڕینەوەی هەموو تۆمارەکان</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                <span className="text-[11px] font-black text-rose-700">دڵنیایت؟</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black cursor-pointer"
                >
                  {clearingAll ? '...' : 'بەڵێ بسڕەوە'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2 py-1 rounded-lg bg-white text-slate-700 text-[11px] font-bold border border-slate-200 cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LOADING SKELETON */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-3xl bg-white border border-slate-200 p-5 animate-pulse space-y-3">
              <div className="h-5 w-44 rounded-lg bg-slate-200" />
              <div className="h-36 rounded-2xl bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE CALLOUT */}
      {!loading && filteredEvaluations.length === 0 && (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-8 sm:p-12 text-center space-y-4 mgr-enter">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Award className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-lg font-black text-slate-900">هێشتا هیچ فۆرمێکی هەڵسەنگاندنی بەڕێوەبەر نییە</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              کاتێک فرۆشیاران و کارمەندان بە کۆدی نهێنی <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-900">0000 - 5999</code> فۆرمەکە پڕ دەکەنەوە، هەموو شیکارییەکانی بەشی سێیەم (٢٠ تا ١٠٠)، گرافە جوڵاوەکان و پرسیارە کراوەکان لێرە دەردەکەون.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleCopyLink('2026')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Copy className="w-4 h-4 text-amber-400" />
              <span>کۆپیکردنی لینکی گشتی فۆرم (PIN: 2026)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>دروستکردنی PINی یەکجار بەکارهێنان</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 1: OVERVIEW & MOTION CHARTS ==================== */}
      {!loading && activeTab === 'overview' && (
        <div className="space-y-5 mgr-enter">
          {/* Official Part 3 Satisfaction Tiers Matrix + Radar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Official Part 3 Result Analysis Matrix (٢٠ تا ١٠٠) */}
            <div className="lg:col-span-6 rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-black text-amber-600 uppercase">بەشی سێیەم (تایبەت بە ئەدمین پانێڵ)</span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900">خشتەی پێوەری شیکردنەوەی ئەنجام (٢٠ تا ١٠٠)</h2>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-bold">
                  ٥ ئاستی فەرمی
                </span>
              </div>

              <div className="space-y-2.5">
                {analytics.bandCounts.map((band) => {
                  const isActiveOverall = analytics.activeBand?.key === band.key && analytics.count > 0;
                  return (
                    <div
                      key={band.key}
                      className={`rounded-2xl border p-3.5 transition-all duration-300 ${
                        isActiveOverall
                          ? `bg-gradient-to-l ${band.glowBg} shadow-md scale-[1.01]`
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: band.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{band.label}</span>
                              <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-700">
                                {band.rangeLabel}
                              </span>
                              {isActiveOverall && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-black">
                                  ئاستی ئێستا
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{band.description}</p>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <div className="text-sm font-black text-slate-900 tabular-nums">
                            {toKurdishDigits(band.count)} فۆرم
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 tabular-nums">
                            {toKurdishDigits(band.percent)}٪
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${band.barBg}`}
                          style={{ width: `${Math.max(band.percent, band.count > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4 Pillars Motion Radar Chart + Donut */}
            <div className="lg:col-span-6 grid grid-cols-1 gap-5">
              {/* Radar Chart for the 4 Leadership Pillars */}
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900">تەوەرەکانی سەرکردایەتی و بەڕێوەبردن</h3>
                    <p className="text-xs text-slate-500">تێکڕای ٤ تەوەرە سەرەکییەکە لەسەر پێوەری ١٠٠</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-7 h-64" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="74%" data={analytics.pillarStats}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis
                          dataKey="shortLabel"
                          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Radar
                          name="نمرە"
                          dataKey="score100"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          fill="#f59e0b"
                          fillOpacity={0.28}
                          isAnimationActive
                          animationDuration={900}
                        />
                        <Tooltip
                          formatter={(val: any) => [`${val} / 100`, 'ئەنجام']}
                          contentStyle={{
                            borderRadius: '14px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            direction: 'rtl',
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="sm:col-span-5 space-y-2.5">
                    {analytics.pillarStats.map((p) => (
                      <div key={p.pillar} className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                          <span>{p.shortLabel}</span>
                          <span className="tabular-nums font-black" style={{ color: p.color }}>
                            {analytics.count > 0 ? `${toKurdishDigits(p.avg5.toFixed(2))} / ٥` : '—'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${p.score100}%`, backgroundColor: p.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pie + Trend Mini Charts when data exists */}
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">ڕەوتی نمرەی فۆرمە وەرگیراوەکان</h3>
                    <p className="text-xs text-slate-500">هێڵی سەوز: ئاستی زۆر بەرز (٩٠+) • هێڵی زەرد: سنووری مامناوەند (٦٠)</p>
                  </div>
                </div>

                {analytics.trendData.length > 0 ? (
                  <div className="h-48" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.trendData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mgrTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="indexLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis domain={[20, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" />
                        <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" />
                        <Tooltip
                          formatter={(val: any) => [`${val} / 100`, 'کۆی نمرە']}
                          labelFormatter={(lbl) => `فۆرمی ${lbl}`}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalScore"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fill="url(#mgrTrendFill)"
                          isAnimationActive
                          animationDuration={950}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-36 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
                    بۆ بینینی هێڵی جوڵاو پێویستە لایەنی کەم فۆرمێک تۆمار کرابێت
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top 3 Strengths vs Top 3 Priority Areas */}
          {analytics.count > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-3xl bg-gradient-to-br from-emerald-50/90 to-white border border-emerald-200/80 p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-emerald-950 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <span>٣ بەهێزترین خاڵی بەڕێوەبەر</span>
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    بەرزترین نمرە
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analytics.top3Strengths.map((item, idx) => (
                    <div key={item.id} className="rounded-2xl bg-white border border-emerald-200/70 p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {toKurdishDigits(idx + 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{item.text}</div>
                          <div className="text-[10.5px] text-slate-500">بڕگەی ژمارە {toKurdishDigits(item.id)}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black tabular-nums shrink-0">
                        {toKurdishDigits(item.avg5.toFixed(2))} / ٥
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-amber-50/90 to-white border border-amber-200/80 p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-amber-950 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-amber-600" />
                    <span>٣ خاڵی پێویست بە باشترکردن</span>
                  </h3>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    ئەولەویەتی باشترکردن
                  </span>
                </div>
                <div className="space-y-2.5">
                  {analytics.bottom3Improvements.map((item, idx) => (
                    <div key={item.id} className="rounded-2xl bg-white border border-amber-200/70 p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {toKurdishDigits(idx + 1)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{item.text}</div>
                          <div className="text-[10.5px] text-slate-500">بڕگەی ژمارە {toKurdishDigits(item.id)}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-black tabular-nums shrink-0">
                        {toKurdishDigits(item.avg5.toFixed(2))} / ٥
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 20-Item Motion BarChart */}
          {analytics.count > 0 && (
            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">گرافیکی گشتی هەموو ٢٠ بڕگەکەی هەڵسەنگاندن</h3>
                  <p className="text-xs text-slate-500">نمرەی تێکڕای هەر بڕگەیەک لە ١ تا ٥ بە شێوەی بەراوردکاری</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('criteria')}
                  className="text-xs font-black text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-auto"
                >
                  وردەکاری هەموو ٢٠ بڕگەکە ببینە ←
                </button>
              </div>
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.itemStats.map((it) => ({
                      label: `#${it.id}`,
                      fullText: it.text,
                      avg5: it.avg5,
                      color: MANAGER_PILLAR_META[it.pillar].color,
                    }))}
                    margin={{ top: 10, right: 8, left: -16, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} />
                    <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} / 5`, 'تێکڕا']}
                      labelFormatter={(lbl, payload) => payload?.[0]?.payload?.fullText || `بڕگە ${lbl}`}
                      contentStyle={{ borderRadius: '14px', border: '1px solid #e2e8f0', fontSize: '12px', direction: 'rtl' }}
                    />
                    <Bar dataKey="avg5" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900}>
                      {analytics.itemStats.map((it) => (
                        <Cell key={it.id} fill={MANAGER_PILLAR_META[it.pillar].color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: ALL 20 CRITERIA BREAKDOWN ==================== */}
      {!loading && activeTab === 'criteria' && (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5 mgr-enter">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">خشتەی وردی هەموو ٢٠ بڕگەکەی هەڵسەنگاندن</h2>
              <p className="text-xs text-slate-500">دابەشبوونی دەنگەکان لە ١ (زۆر ناڕازیم) تا ٥ (زۆر ڕازیم) بۆ هەر بڕگەیەک</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setPillarFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                    pillarFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600'
                  }`}
                >
                  هەموو ({toKurdishDigits(20)})
                </button>
                {(Object.keys(MANAGER_PILLAR_META) as ManagerEvaluationPillar[]).map((pKey) => (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setPillarFilter(pKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      pillarFilter === pKey ? 'bg-white text-slate-900 shadow-xs font-black' : 'text-slate-600'
                    }`}
                  >
                    {MANAGER_PILLAR_META[pKey].shortLabel}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                {(
                  [
                    { id: 'order', label: '١-٢٠' },
                    { id: 'highest', label: 'بەرزترین' },
                    { id: 'lowest', label: 'نزمترین' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCriteriaSort(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      criteriaSort === s.id ? 'bg-slate-900 text-white font-black' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {displayedCriteria.map((it) => {
              const pMeta = MANAGER_PILLAR_META[it.pillar];
              const totalVotes = analytics.count || 0;
              return (
                <div
                  key={it.id}
                  className="rounded-2xl border border-slate-200/90 hover:border-slate-300 bg-slate-50/50 hover:bg-white p-4 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 text-amber-300 text-xs font-black flex items-center justify-center shrink-0">
                        {toKurdishDigits(it.id)}
                      </span>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">{it.text}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${pMeta.bg}`}>
                          {pMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-900 tabular-nums">
                        {totalVotes > 0 ? `${toKurdishDigits(it.avg5.toFixed(2))} / ٥` : '—'}
                      </span>
                      <span
                        className="px-2.5 py-1.5 rounded-xl text-xs font-black tabular-nums text-white"
                        style={{ backgroundColor: totalVotes > 0 ? pMeta.color : '#94a3b8' }}
                      >
                        {totalVotes > 0 ? `${toKurdishDigits(it.score100)}٪` : '٠٪'}
                      </span>
                    </div>
                  </div>

                  {/* 5-segment stacked distribution bar */}
                  {totalVotes > 0 && (
                    <div className="space-y-1.5">
                      <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-200">
                        {([5, 4, 3, 2, 1] as const).map((ratingVal) => {
                          const cnt = it.counts[ratingVal] || 0;
                          const pct = (cnt / totalVotes) * 100;
                          if (pct <= 0) return null;
                          const scaleItem = MANAGER_RATING_SCALE.find((s) => s.value === ratingVal);
                          return (
                            <div
                              key={ratingVal}
                              title={`${scaleItem?.label}: ${cnt} (${Math.round(pct)}%)`}
                              className="h-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: scaleItem?.dotColor || '#64748b',
                              }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10.5px] font-bold text-slate-600">
                        {([5, 4, 3, 2, 1] as const).map((ratingVal) => {
                          const scaleItem = MANAGER_RATING_SCALE.find((s) => s.value === ratingVal);
                          const cnt = it.counts[ratingVal] || 0;
                          return (
                            <span key={ratingVal} className="inline-flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: scaleItem?.dotColor }}
                              />
                              <span>{scaleItem?.shortLabel}:</span>
                              <span className="font-black text-slate-900 tabular-nums">{toKurdishDigits(cnt)}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: PART 2 OPEN QUESTIONS & SUGGESTIONS STUDIO ==================== */}
      {!loading && activeTab === 'open_qa' && (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5 mgr-enter">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">بەشی دووەم: وەڵامی پرسیارە کراوەکان و پێشنیارەکان</h2>
              <p className="text-xs text-slate-500">هەموو وەڵامە نووسراوەکان بە شێوەی بێ‌ناو و نهێنی ڕێکخراون</p>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={qaSearch}
                onChange={(e) => setQaSearch(e.target.value)}
                placeholder="گەڕان لە ناو پێشنیارەکاندا..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-base sm:text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
          </div>

          {/* 5 Question Filter Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpenQuestionTab('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                openQuestionTab === 'all'
                  ? 'bg-slate-900 text-white font-black'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              هەموو ٥ پرسیارەکە
            </button>
            {MANAGER_OPEN_QUESTIONS.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={() => setOpenQuestionTab(q.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all max-w-xs truncate ${
                  openQuestionTab === q.key
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={q.label}
              >
                پ{q.num}: {q.label}
              </button>
            ))}
          </div>

          {openQaEntries.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-xs font-bold text-slate-500">
              هیچ وەڵامێکی نووسراو بۆ ئەم فلتەرە نەدۆزرایەوە.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openQaEntries.map((entry, idx) => (
                <div
                  key={`${entry.submissionId}-${entry.questionKey}`}
                  className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 text-[11px] font-black shrink-0">
                      پرسیاری {entry.questionNum}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{entry.date}</span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${entry.band.badgeBg}`}>
                        {toKurdishDigits(entry.totalScore)}/١٠٠
                      </span>
                    </div>
                  </div>
                  <div className="text-[11.5px] font-bold text-slate-500 leading-relaxed">
                    {entry.questionLabel}
                  </div>
                  <div className="rounded-xl bg-white border border-slate-200/80 p-3 text-xs sm:text-sm font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                    “{entry.answer}”
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>پێشکەشکار: نهێنی - بێ ناو (#{toKurdishDigits(idx + 1)})</span>
                    <span>{entry.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 4: INDIVIDUAL ANONYMOUS SUBMISSIONS ==================== */}
      {!loading && activeTab === 'submissions' && (
        <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4 mgr-enter">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">تۆماری فۆرمە پڕکراوەکان (نهێنی - بێ ناو)</h2>
              <p className="text-xs text-slate-500">هیچ ناو یان ناسنامەیەکی کەسی تۆمار ناکرێت؛ دەتوانیت هەر فۆرمێک بە تەواوی بکەیتەوە یان بیسڕیتەوە.</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-3 px-4 font-black">#</th>
                  <th className="py-3 px-4 font-black">لایەنی هەڵسەنگێنەر</th>
                  <th className="py-3 px-4 font-black">بەروار و کات</th>
                  <th className="py-3 px-4 font-black">کۆی نمرە (٢٠-١٠٠)</th>
                  <th className="py-3 px-4 font-black">ئاستی ڕەزامەندی</th>
                  <th className="py-3 px-4 font-black">تێبینی کراوە</th>
                  <th className="py-3 px-4 font-black text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvaluations.map((sub, idx) => {
                  const band = getManagerScoreBand(sub.totalScore);
                  const answeredOpen = MANAGER_OPEN_QUESTIONS.filter(
                    (q) => (sub.openAnswers?.[q.key] || '').trim().length > 0
                  ).length;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-700">{toKurdishDigits(idx + 1)}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>نهێنی - بێ ناو</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500">{sub.evaluatorRole}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{sub.evaluationDate || sub.baghdadDate}</div>
                        <div className="text-[10.5px] text-slate-500 font-mono">{sub.baghdadTime}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-black text-slate-900 tabular-nums">
                          {toKurdishDigits(sub.totalScore)} / ١٠٠
                        </span>
                        <span className="block text-[10.5px] text-slate-500">
                          تێکڕا: {toKurdishDigits(sub.averageScore.toFixed(2))} / ٥
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-xl border text-[11px] font-black ${band.badgeBg}`}>
                          {band.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {toKurdishDigits(answeredOpen)} لە ٥ پرسیار
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-300" />
                            <span>وردەکاری</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvaluation(sub.id)}
                            disabled={deletingId === sub.id}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer"
                            title="سڕینەوەی تۆمار"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ==================== MODAL 1: SINGLE SUBMISSION DETAIL ==================== */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-5 mgr-enter">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                    فۆرمی نهێنی - بێ ناو
                  </span>
                  <span className="text-xs font-mono text-slate-500">{selectedSubmission.baghdadDate} • {selectedSubmission.baghdadTime}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1.5">
                  ئەنجامی تەواوی هەڵسەنگاندن: {toKurdishDigits(selectedSubmission.totalScore)} / ١٠٠ ({getManagerScoreBand(selectedSubmission.totalScore).label})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-700">بەشی یەکەم: ٢٠ بڕگەکە (١ تا ٥)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MANAGER_EVALUATION_ITEMS.map((item) => {
                  const score = selectedSubmission.scores?.[item.id] ?? 0;
                  const scaleInfo = MANAGER_RATING_SCALE.find((s) => s.value === score);
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-2.5 flex items-center justify-between gap-2 bg-slate-50/70">
                      <span className="text-[11.5px] font-bold text-slate-800 leading-snug">
                        {toKurdishDigits(item.id)}. {item.text}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-lg text-[11px] font-black text-white shrink-0"
                        style={{ backgroundColor: scaleInfo?.dotColor || '#64748b' }}
                      >
                        {toKurdishDigits(score)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-slate-700">بەشی دووەم: پرسیارە کراوەکان و پێشنیارەکان</h4>
              {MANAGER_OPEN_QUESTIONS.map((q) => {
                const ans = (selectedSubmission.openAnswers?.[q.key] || '').trim();
                return (
                  <div key={q.key} className="rounded-2xl border border-slate-200 p-3 bg-slate-50/60 space-y-1">
                    <div className="text-[11px] font-bold text-slate-600">
                      {q.num}. {q.label}
                    </div>
                    <div className="text-xs font-medium text-slate-900 whitespace-pre-wrap">
                      {ans || <span className="text-slate-400 italic">وەڵام نەدراوەتەوە</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: QUICK PIN GENERATOR (0000 - 5999) ==================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-5 mgr-enter">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" />
                  <span>کۆدەکانی PINی فۆرمی هەڵسەنگاندنی بەڕێوەبەر (0000 - 5999)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  ئەم کۆدانە تەنها فۆرمی نهێنی هەڵسەنگاندنی بەڕێوەبەر بۆ فرۆشیاران و کارمەندان دەکەنەوە (ئەنجامەکان لە لای ئەدمین بە نهێنی دەمێننەوە).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Single PIN Form */}
            <form onSubmit={handleCreateCustomPin} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-black text-slate-800">دروستکردنی PINی نوێ (٠ تا ٥٩٩٩)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  maxLength={4}
                  value={customPin}
                  onChange={(e) => setCustomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="بۆ نموونە 2026 یان بەتاڵ=ئۆتۆ"
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-amber-400"
                  dir="ltr"
                />
                <input
                  type="text"
                  value={pinNotes}
                  onChange={(e) => setPinNotes(e.target.value)}
                  placeholder="تێبینی..."
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-medium outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  disabled={pinActionLoading}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>دروستکردن</span>
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinSingleUse}
                  onChange={(e) => setPinSingleUse(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500"
                />
                <span>یەکجار بەکارهێنان (بۆ ئەوەی هەر کارمەندێک تەنها یەک جار دەنگ بدات)</span>
              </label>
            </form>

            {/* Batch Generator */}
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-indigo-950">دروستکردنی کۆمەڵە کۆدی یەکجار بەکارهێنان</div>
                <div className="text-[11px] text-indigo-700">گونجاوە بۆ دابەشکردن بەسەر هەموو فرۆشیاراندا</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-16 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-white text-center text-xs font-black"
                />
                <button
                  type="button"
                  onClick={handleBatchPins}
                  disabled={pinActionLoading}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer"
                >
                  دروستکردنی کۆمەڵە
                </button>
              </div>
            </div>

            {/* Active Pins List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {managerPins.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-4">هیچ PINێکی تایبەت تۆمار نەکراوە</div>
              ) : (
                managerPins.map((p) => {
                  const used = Boolean(p.isSingleUse && p.isUsed);
                  return (
                    <div
                      key={p.pin}
                      className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                        used ? 'bg-slate-50 border-slate-200 opacity-65' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono text-sm font-black" dir="ltr">
                          {p.pin}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {p.isSingleUse ? 'یەکجار بەکارهێنان' : 'گشتی / چەند جار'} •{' '}
                            <span className={used ? 'text-rose-600' : 'text-emerald-600'}>
                              {used ? 'بەکارهاتووە' : 'چالاکە'}
                            </span>
                          </div>
                          {p.notes && <div className="text-[10.5px] text-slate-500">{p.notes}</div>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(p.pin)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedPin === p.pin ? 'کۆپی کرا' : 'کۆپی لینک'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: OFFICIAL PRINT / PDF REPORT ==================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[110] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200 no-print">
              <span className="text-sm font-black text-slate-900">پێشبینینی ڕاپۆرتی فەرمی A4 — هەڵسەنگاندنی بەڕێوەبەر</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>چاپکردن / خەزنکردن وەک PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div id="mgr-print-report-sheet" className="space-y-5 text-slate-900" dir="rtl">
              <OfficialPrintHeader
                title="ڕاپۆرتی فەرمی هەڵسەنگاندن و ڕاپرسی کارمەندان بۆ بەڕێوەبەر"
                subtitle="بەشی سێیەم: شیکردنەوەی ئەنجامە نهێنییەکان (تایبەت بە بەشی هەڵسەنگاندن)"
                documentCode="ASH-MGR-EVAL-2026"
              />

              {/* Executive Summary Band */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-xl border border-slate-300 p-2.5 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-600">کۆی نمرە (٢٠-١٠٠)</div>
                  <div className="text-xl font-black text-slate-900">
                    {analytics.count > 0 ? toKurdishDigits(analytics.overallTotalScore.toFixed(1)) : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-300 p-2.5 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-600">ئاستی ڕەزامەندی</div>
                  <div className="text-lg font-black text-slate-900">{analytics.activeBand?.label || '—'}</div>
                </div>
                <div className="rounded-xl border border-slate-300 p-2.5 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-600">تێکڕای گشتی (١-٥)</div>
                  <div className="text-xl font-black text-slate-900">
                    {analytics.count > 0 ? toKurdishDigits(analytics.overallAverage.toFixed(2)) : '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-300 p-2.5 bg-slate-50">
                  <div className="text-[10px] font-bold text-slate-600">ژمارەی بەشداربووان</div>
                  <div className="text-xl font-black text-slate-900">{toKurdishDigits(analytics.count)}</div>
                </div>
              </div>

              {/* Official Part 3 Scale Table */}
              <div>
                <h4 className="text-xs font-black mb-1.5">بەشی سێیەم: پێوەری ئاستی ڕەزامەندی (٢٠ تا ١٠٠)</h4>
                <table className="w-full text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 py-1.5 px-2.5 text-right">کۆی نمرە (لە ٢٠ تا ١٠٠)</th>
                      <th className="border border-slate-300 py-1.5 px-2.5 text-right">ئاستی ڕەزامەندی</th>
                      <th className="border border-slate-300 py-1.5 px-2.5 text-center">ژمارەی فۆرم</th>
                      <th className="border border-slate-300 py-1.5 px-2.5 text-center">ڕێژە</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.bandCounts.map((b) => (
                      <tr key={b.key} className={analytics.activeBand?.key === b.key && analytics.count > 0 ? 'bg-amber-50 font-black' : ''}>
                        <td className="border border-slate-300 py-1.5 px-2.5">{b.rangeLabel}</td>
                        <td className="border border-slate-300 py-1.5 px-2.5">{b.label}</td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center">{toKurdishDigits(b.count)}</td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center">{toKurdishDigits(b.percent)}٪</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 20 Criteria Compact Table */}
              <div>
                <h4 className="text-xs font-black mb-1.5">ئەنجامی وردی ٢٠ بڕگەکەی هەڵسەنگاندن</h4>
                <table className="w-full text-[10.5px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 py-1 px-2 text-center w-8">ژ</th>
                      <th className="border border-slate-300 py-1 px-2 text-right">بڕگەکانی هەڵسەنگاندن</th>
                      <th className="border border-slate-300 py-1 px-2 text-center w-16">تێکڕا (٥)</th>
                      <th className="border border-slate-300 py-1 px-2 text-center w-16">هاوتا (١٠٠)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.itemStats.map((it) => (
                      <tr key={it.id}>
                        <td className="border border-slate-300 py-1 px-2 text-center font-bold">{toKurdishDigits(it.id)}</td>
                        <td className="border border-slate-300 py-1 px-2">{it.text}</td>
                        <td className="border border-slate-300 py-1 px-2 text-center font-bold">
                          {analytics.count > 0 ? toKurdishDigits(it.avg5.toFixed(2)) : '—'}
                        </td>
                        <td className="border border-slate-300 py-1 px-2 text-center font-bold">
                          {analytics.count > 0 ? `${toKurdishDigits(it.score100)}٪` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Part 2 Selected Open Answers */}
              {openQaEntries.length > 0 && (
                <div className="break-inside-avoid">
                  <h4 className="text-xs font-black mb-1.5">پوختەی وەڵامە نووسراوەکانی پرسیارە کراوەکان (بێ ناو)</h4>
                  <div className="space-y-1.5">
                    {openQaEntries.slice(0, 15).map((e, idx) => (
                      <div key={`${e.submissionId}-${e.questionKey}-${idx}`} className="border border-slate-300 rounded-lg p-2 text-[10.5px]">
                        <span className="font-black">پ{e.questionNum}: </span>
                        <span>{e.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <OfficialPrintSignatures
                roles={['بەڕێوەبەری سەرچاوە مرۆییەکان (HR)', 'سەرپەرشتیاری ئایتی و شیکاری داتا', 'بەڕێوەبەری گشتی']}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
