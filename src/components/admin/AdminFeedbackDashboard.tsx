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
  Hash,
  Boxes,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
  MessageSquare,
  Flame,
  CheckCircle,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  CartesianGrid,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  FeedbackPin, 
  FeedbackSubmission, 
  TARGET_SALES_CASHIER_STAFF,
  TARGET_WAREHOUSE_STAFF,
  getSyncedFeedbackStaffList,
  PinScope,
  generatePinForScope,
  determinePinScope
} from '@/lib/feedback/feedback-service';
import { useAppContext } from '@/context/app-provider';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';

export interface AdminFeedbackDashboardProps {
  initialStaffCategory?: 'sales_cashier' | 'warehouse';
}

export function AdminFeedbackDashboard({ initialStaffCategory = 'sales_cashier' }: AdminFeedbackDashboardProps = {}) {
  const searchParams = useSearchParams();

  // 🎯 Category State: Sales & Cashiers (7500-9000) vs Warehouse Staff (5000-7500)
  const [staffCategory, setStaffCategory] = useState<'sales_cashier' | 'warehouse'>(() => {
    const cat = searchParams?.get('category');
    if (cat === 'warehouse' || cat === 'sales_cashier') return cat;
    return initialStaffCategory;
  });

  useEffect(() => {
    if (initialStaffCategory) {
      setStaffCategory(initialStaffCategory);
    }
  }, [initialStaffCategory]);

  const { employees } = useAppContext();
  const isWarehouse = staffCategory === 'warehouse';
  const currentTargetStaff = useMemo(() => {
    return getSyncedFeedbackStaffList(isWarehouse ? 'warehouse' : 'sales', employees);
  }, [isWarehouse, employees]);

  const [pins, setPins] = useState<Record<string, FeedbackPin>>({});
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view: 'dashboard' | 'annoying_qa' | 'suggestions' | 'submissions' | 'pins'
  // Defaults to 'dashboard' or URL searchParam 'tab'
  type FeedbackTab = 'dashboard' | 'annoying_qa' | 'suggestions' | 'submissions' | 'pins';
  const [activeTab, setActiveTab] = useState<FeedbackTab>('dashboard');

  // Synchronize activeTab with URL
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['dashboard', 'annoying_qa', 'suggestions', 'submissions', 'pins'].includes(tabParam)) {
      setActiveTab(tabParam as FeedbackTab);
    }
  }, [searchParams]);

  // Tab switch handler that updates browser URL without full page reload
  const handleTabChange = (newTab: FeedbackTab) => {
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
  const [annoyingEmpFilter, setAnnoyingEmpFilter] = useState<string>('all');
  const [annoyingSearch, setAnnoyingSearch] = useState<string>('');
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');

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
  const [managerEvalCount, setManagerEvalCount] = useState<number>(0);

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
        setManagerEvalCount(Array.isArray(data.managerEvaluations) ? data.managerEvaluations.length : 0);
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
          isSingleUse: batchScope === 'staff_feedback' || batchScope === 'manager_feedback',
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

  // Submissions filtered strictly by category (Warehouse vs Sales/Cashier)
  const categorySubmissions = useMemo(() => {
    const warehouseEmpIds = TARGET_WAREHOUSE_STAFF.map(e => e.employeeId);
    const salesEmpIds = TARGET_SALES_CASHIER_STAFF.map(e => e.employeeId);

    return submissions.filter((sub) => {
      const pinNum = parseInt(sub.pin || '0', 10);
      const ratingEmpIds = sub.employeeRatings ? Object.keys(sub.employeeRatings) : [];
      const hasWarehouseEmp = ratingEmpIds.some(id => warehouseEmpIds.includes(id));
      const hasSalesEmp = ratingEmpIds.some(id => salesEmpIds.includes(id));

      if (isWarehouse) {
        if (hasWarehouseEmp) return true;
        if (pinNum >= 5000 && pinNum <= 7500) return true;
        return false;
      } else {
        if (hasSalesEmp) return true;
        if (pinNum > 7500 && pinNum <= 9000) return true;
        if (!hasWarehouseEmp && !(pinNum >= 5000 && pinNum <= 7500)) return true;
        return false;
      }
    });
  }, [submissions, isWarehouse]);

  // PINs filtered by category
  const categoryPins = useMemo(() => {
    const res: Record<string, FeedbackPin> = {};
    Object.entries(pins).forEach(([pinKey, pinObj]) => {
      const pinNum = parseInt(pinKey, 10);
      const scope = pinObj.scope || determinePinScope(pinKey);
      if (isWarehouse) {
        if (scope === 'warehouse_staff_feedback' || (pinNum >= 5000 && pinNum <= 7500)) {
          res[pinKey] = pinObj;
        }
      } else {
        if (scope === 'sales_cashier_feedback' || scope === 'staff_feedback' || (pinNum > 7500 && pinNum <= 9000)) {
          res[pinKey] = pinObj;
        }
      }
    });
    return res;
  }, [pins, isWarehouse]);

  // 🎯 فرمولەی نوێی هەژمارکردنی خاڵەکان (بەپێی ڕێنمایی: کۆی گشتی بە ڕێژەی ٪ بەبێ ئەستێرە):
  // ٤ پرسیاری سەرەتا: ٥ بژاردەیە، هەر پرسیارێک ٢٠ خاڵ لەسەرە (کۆی ٤ پرسیارەکە = ٨٠ خاڵ)
  //   بژاردەی ٥ = ٢٠ خاڵ | ٤ = ١٦ خاڵ | ٣ = ١٢ خاڵ | ٢ = ٨ خاڵ | ١ = ٤ خاڵ (rating * 4)
  // ١ پرسیاری کۆتایی (پرسیاری ٥): ٢ بژاردەیە:
  //   نەخێر نییەتی = ٢٠ خاڵ
  //   بەڵێ هەیبوو = ١٠ خاڵ
  // کۆی گشتی = ٨٠ + ٢٠ = ١٠٠ خاڵ = ١٠٠٪
  const calculateEmployeeScoreBreakdown = useCallback((r: any) => {
    if (!r) {
      return { q1Pts: 0, q2Pts: 0, q3Pts: 0, q4Pts: 0, q5Pts: 0, totalPts: 0, percent: 0 };
    }
    const q1Pts = Math.min(20, Math.max(0, (r.serviceRating || 0) * 4));
    const q2Pts = Math.min(20, Math.max(0, (r.performanceRating || 0) * 4));
    const q3Pts = Math.min(20, Math.max(0, (r.disciplineRating || 0) * 4));
    const q4Pts = Math.min(20, Math.max(0, (r.overallRating || 0) * 4));

    let q5Pts = 0;
    if (r.hasAnnoyingBehavior === 'no') {
      q5Pts = 20;
    } else if (r.hasAnnoyingBehavior === 'yes') {
      q5Pts = 10;
    } else if (q1Pts > 0 || q2Pts > 0 || q3Pts > 0 || q4Pts > 0) {
      q5Pts = 20; // fallback if previously submitted without Q5
    }

    const totalPts = q1Pts + q2Pts + q3Pts + q4Pts + q5Pts;
    return {
      q1Pts,
      q2Pts,
      q3Pts,
      q4Pts,
      q5Pts,
      totalPts,
      percent: totalPts,
    };
  }, []);

  // Helper to calculate whole submission overall percentage
  const getSubmissionOverallPercent = useCallback((sub: FeedbackSubmission): number => {
    if (sub.employeeRatings && Object.keys(sub.employeeRatings).length > 0) {
      const scores = Object.values(sub.employeeRatings).map(r => calculateEmployeeScoreBreakdown(r).totalPts);
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    return Math.round(((sub.overallSatisfaction || 5) / 5) * 100);
  }, [calculateEmployeeScoreBreakdown]);

  // Filtered Submissions (with active search and percentage rating filter)
  const filteredSubmissions = useMemo(() => {
    return categorySubmissions.filter((s) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = 
        !q ||
        s.pin.toLowerCase().includes(q) ||
        (s.targetName && s.targetName.toLowerCase().includes(q)) ||
        (s.targetPhone && s.targetPhone.includes(q)) ||
        (s.suggestionsForManagement && s.suggestionsForManagement.toLowerCase().includes(q));

      const subScore = getSubmissionOverallPercent(s);

      let matchesRating = true;
      if (ratingFilter === '90-100') matchesRating = subScore >= 90;
      else if (ratingFilter === '80-89') matchesRating = subScore >= 80 && subScore < 90;
      else if (ratingFilter === '70-79') matchesRating = subScore >= 70 && subScore < 80;
      else if (ratingFilter === '60-69') matchesRating = subScore >= 60 && subScore < 70;
      else if (ratingFilter === 'below-60') matchesRating = subScore < 60;

      return matchesSearch && matchesRating;
    });
  }, [categorySubmissions, searchTerm, ratingFilter, getSubmissionOverallPercent]);

  // 🌟 LEADERBOARD STATS (Tailored to active category: Sales/Cashier or Warehouse Staff)
  const staffLeaderboard = useMemo(() => {
    const map: Record<string, {
      emp: typeof currentTargetStaff[0];
      count: number;
      sumTotalPts: number;
      sumQ1Pts: number;
      sumQ2Pts: number;
      sumQ3Pts: number;
      sumQ4Pts: number;
      sumQ5Pts: number;
    }> = {};

    currentTargetStaff.forEach((emp) => {
      map[emp.employeeId] = {
        emp,
        count: 0,
        sumTotalPts: 0,
        sumQ1Pts: 0,
        sumQ2Pts: 0,
        sumQ3Pts: 0,
        sumQ4Pts: 0,
        sumQ5Pts: 0,
      };
    });

    categorySubmissions.forEach((sub) => {
      if (sub.employeeRatings) {
        Object.entries(sub.employeeRatings).forEach(([empId, r]: [string, any]) => {
          if (map[empId] && r) {
            const sc = calculateEmployeeScoreBreakdown(r);
            map[empId].count++;
            map[empId].sumTotalPts += sc.totalPts;
            map[empId].sumQ1Pts += sc.q1Pts;
            map[empId].sumQ2Pts += sc.q2Pts;
            map[empId].sumQ3Pts += sc.q3Pts;
            map[empId].sumQ4Pts += sc.q4Pts;
            map[empId].sumQ5Pts += sc.q5Pts;
          }
        });
      }
    });

    return Object.values(map)
      .map((item) => {
        const count = item.count;
        const avgScorePercent = count > 0 ? Math.round(item.sumTotalPts / count) : 0;
        const avgQ1Pts = count > 0 ? Number((item.sumQ1Pts / count).toFixed(1)) : 0;
        const avgQ2Pts = count > 0 ? Number((item.sumQ2Pts / count).toFixed(1)) : 0;
        const avgQ3Pts = count > 0 ? Number((item.sumQ3Pts / count).toFixed(1)) : 0;
        const avgQ4Pts = count > 0 ? Number((item.sumQ4Pts / count).toFixed(1)) : 0;
        const avgQ5Pts = count > 0 ? Number((item.sumQ5Pts / count).toFixed(1)) : 0;

        return {
          ...item,
          avgOverall: avgScorePercent, // Directly percentage (0-100%)
          avgScorePercent,
          avgQ1Pts,
          avgQ2Pts,
          avgQ3Pts,
          avgQ4Pts,
          avgQ5Pts,
          avgQ1Percent: Math.round((avgQ1Pts / 20) * 100),
          avgQ2Percent: Math.round((avgQ2Pts / 20) * 100),
          avgQ3Percent: Math.round((avgQ3Pts / 20) * 100),
          avgQ4Percent: Math.round((avgQ4Pts / 20) * 100),
          avgQ5Percent: Math.round((avgQ5Pts / 20) * 100),
        };
      })
      .sort((a, b) => {
        if (b.avgScorePercent !== a.avgScorePercent) return b.avgScorePercent - a.avgScorePercent;
        if (b.count !== a.count) return b.count - a.count;
        return b.avgQ1Pts - a.avgQ1Pts;
      });
  }, [currentTargetStaff, categorySubmissions, calculateEmployeeScoreBreakdown]);

  // Top 3 Podium performers
  const topPerformer = staffLeaderboard[0] || null;
  const secondPerformer = staffLeaderboard[1] || null;
  const thirdPerformer = staffLeaderboard[2] || null;

  // Store-wide metrics & averages across category submissions
  const storeAnalytics = useMemo(() => {
    let totalScore = 0;
    let totalQ1 = 0;
    let totalQ2 = 0;
    let totalQ3 = 0;
    let totalQ4 = 0;
    let totalQ5 = 0;
    let totalStaffRatingsCount = 0;

    const distribution: Record<string, number> = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      'below-60': 0,
    };

    categorySubmissions.forEach((s) => {
      if (s.employeeRatings) {
        Object.values(s.employeeRatings).forEach((r: any) => {
          if (r) {
            const sc = calculateEmployeeScoreBreakdown(r);
            totalScore += sc.totalPts;
            totalQ1 += sc.q1Pts;
            totalQ2 += sc.q2Pts;
            totalQ3 += sc.q3Pts;
            totalQ4 += sc.q4Pts;
            totalQ5 += sc.q5Pts;
            totalStaffRatingsCount++;

            if (sc.totalPts >= 90) distribution['90-100']++;
            else if (sc.totalPts >= 80) distribution['80-89']++;
            else if (sc.totalPts >= 70) distribution['70-79']++;
            else if (sc.totalPts >= 60) distribution['60-69']++;
            else distribution['below-60']++;
          }
        });
      }
    });

    const avgOverallPercent = totalStaffRatingsCount > 0 ? Math.round(totalScore / totalStaffRatingsCount) : 0;
    const avgQ1 = totalStaffRatingsCount > 0 ? Number((totalQ1 / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgQ2 = totalStaffRatingsCount > 0 ? Number((totalQ2 / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgQ3 = totalStaffRatingsCount > 0 ? Number((totalQ3 / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgQ4 = totalStaffRatingsCount > 0 ? Number((totalQ4 / totalStaffRatingsCount).toFixed(1)) : 0;
    const avgQ5 = totalStaffRatingsCount > 0 ? Number((totalQ5 / totalStaffRatingsCount).toFixed(1)) : 0;

    return {
      avgOverallPercent,
      avgQ1,
      avgQ2,
      avgQ3,
      avgQ4,
      avgQ5,
      totalStaffRatingsCount,
      distribution,
    };
  }, [categorySubmissions, calculateEmployeeScoreBreakdown]);

  // Overall General Metrics
  const metrics = useMemo(() => {
    const total = categorySubmissions.length;
    const pinValues = Object.values(categoryPins);
    const totalPinsCount = pinValues.length;
    const usedPinsCount = pinValues.filter(p => p.isUsed).length;
    const effectiveUsed = Math.max(usedPinsCount, total);
    const activePinsCount = Math.max(0, totalPinsCount - effectiveUsed);
    const participationRate = totalPinsCount > 0 ? Math.min(100, Math.round((effectiveUsed / totalPinsCount) * 100)) : 0;

    if (total === 0) {
      return {
        totalSubmissions: 0,
        avgOverallPercent: 0,
        totalPins: totalPinsCount,
        usedPinsCount: 0,
        activePinsCount: totalPinsCount,
        participationRate: 0,
      };
    }

    return {
      totalSubmissions: total,
      avgOverallPercent: storeAnalytics.avgOverallPercent,
      totalPins: totalPinsCount,
      usedPinsCount: effectiveUsed,
      activePinsCount,
      participationRate,
    };
  }, [categorySubmissions, categoryPins, storeAnalytics]);

  // 🌟 RECHARTS DATA: 4-Pillars Competency Radar (Domain: 0 to 100%)
  const radarData = useMemo(() => {
    return [
      {
        subject: isWarehouse ? 'ئەدا و هەڵسوکەوت (ڕێز)' : 'کڕیار و فرۆشتن (ئەتەکیەت)',
        value: Math.round((storeAnalytics.avgQ1 / 20) * 100),
        rawPts: storeAnalytics.avgQ1,
        fullMark: 100,
      },
      {
        subject: isWarehouse ? 'هاوکاری بێ پێ وتن' : 'عەرز و ڕێکی پۆشین',
        value: Math.round((storeAnalytics.avgQ2 / 20) * 100),
        rawPts: storeAnalytics.avgQ2,
        fullMark: 100,
      },
      {
        subject: isWarehouse ? 'پابەندبوون (مۆبایل)' : 'هاوکاری و تەبایی (بێ تەداخل)',
        value: Math.round((storeAnalytics.avgQ3 / 20) * 100),
        rawPts: storeAnalytics.avgQ3,
        fullMark: 100,
      },
      {
        subject: isWarehouse ? 'پاک و خاوێنی' : 'کاتی دەوام و سنووری مۆبایل',
        value: Math.round((storeAnalytics.avgQ4 / 20) * 100),
        rawPts: storeAnalytics.avgQ4,
        fullMark: 100,
      },
    ];
  }, [storeAnalytics, isWarehouse]);

  // 🌟 RECHARTS DATA: Employee Leaderboard Bars (Domain: 0 to 100%)
  const employeeBarData = useMemo(() => {
    return staffLeaderboard.map((item) => ({
      name: item.emp.name,
      fullName: item.emp.fullName,
      score: item.avgScorePercent,
      q1: item.avgQ1Pts,
      q2: item.avgQ2Pts,
      q3: item.avgQ3Pts,
      q4: item.avgQ4Pts,
      q5: item.avgQ5Pts,
      count: item.count,
      role: item.emp.role,
      photoUrl: item.emp.photoUrl,
    }));
  }, [staffLeaderboard]);

  // 🌟 RECHARTS DATA: Score Distribution (Percentage Bands)
  const scoreDistributionData = useMemo(() => {
    return [
      { tier: '٩٠٪ - ١٠٠٪ (نایاب)', count: storeAnalytics.distribution['90-100'] || 0, fill: '#10b981' },
      { tier: '٨٠٪ - ٨٩٪ (زۆر باش)', count: storeAnalytics.distribution['80-89'] || 0, fill: '#3b82f6' },
      { tier: '٧٠٪ - ٧٩٪ (باش)', count: storeAnalytics.distribution['70-79'] || 0, fill: '#f59e0b' },
      { tier: '٦٠٪ - ٦٩٪ (مامناوەند)', count: storeAnalytics.distribution['60-69'] || 0, fill: '#f97316' },
      { tier: 'کەمتر لە ٦٠٪ (لاواز)', count: storeAnalytics.distribution['below-60'] || 0, fill: '#ef4444' },
    ];
  }, [storeAnalytics]);

  // ⚠️ QUESTION 5 STATS: Annoying Behavior Analysis & Points
  const annoyingBehaviorStats = useMemo(() => {
    let totalEvaluations = 0;
    let totalReported = 0;
    let totalClean = 0;

    const perEmployee: Record<string, {
      emp: typeof currentTargetStaff[0];
      total: number;
      reportedCount: number;
      cleanCount: number;
      reports: Array<{
        submissionId: string;
        pin: string;
        date: string;
        time: string;
        point1?: string;
        point2?: string;
        point3?: string;
      }>;
    }> = {};

    currentTargetStaff.forEach((emp) => {
      perEmployee[emp.employeeId] = {
        emp,
        total: 0,
        reportedCount: 0,
        cleanCount: 0,
        reports: [],
      };
    });

    categorySubmissions.forEach((sub) => {
      if (sub.employeeRatings) {
        Object.entries(sub.employeeRatings).forEach(([empId, r]: [string, any]) => {
          if (perEmployee[empId] && r) {
            perEmployee[empId].total++;
            totalEvaluations++;

            const hasReport = r.hasAnnoyingBehavior === 'yes' || Boolean(r.annoyingPoint1?.trim()) || Boolean(r.note5?.trim());
            if (hasReport) {
              perEmployee[empId].reportedCount++;
              totalReported++;
              perEmployee[empId].reports.push({
                submissionId: sub.id,
                pin: sub.pin,
                date: sub.baghdadDate,
                time: sub.baghdadTime,
                point1: r.annoyingPoint1 || r.note5,
                point2: r.annoyingPoint2,
                point3: r.annoyingPoint3,
              });
            } else {
              perEmployee[empId].cleanCount++;
              totalClean++;
            }
          }
        });
      }
    });

    const cleanPercent = totalEvaluations > 0 ? Math.round((totalClean / totalEvaluations) * 100) : 100;
    const reportedPercent = totalEvaluations > 0 ? Math.round((totalReported / totalEvaluations) * 100) : 0;

    return {
      totalEvaluations,
      totalReported,
      totalClean,
      cleanPercent,
      reportedPercent,
      perEmployee: Object.values(perEmployee),
    };
  }, [currentTargetStaff, categorySubmissions]);

  // 💡 IMPROVEMENT SUGGESTIONS: 3-Point Improvement Submissions
  const improvementSuggestionsList = useMemo(() => {
    const list: Array<{
      id: string;
      pin: string;
      respondentName?: string;
      date: string;
      time: string;
      point1?: string;
      point2?: string;
      point3?: string;
      general?: string;
    }> = [];

    categorySubmissions.forEach((sub) => {
      const p1 = sub.improvementPoint1?.trim();
      const p2 = sub.improvementPoint2?.trim();
      const p3 = sub.improvementPoint3?.trim();
      const gen = sub.suggestionsForManagement?.trim();

      if (p1 || p2 || p3 || gen) {
        list.push({
          id: sub.id,
          pin: sub.pin,
          respondentName: sub.respondentName,
          date: sub.baghdadDate,
          time: sub.baghdadTime,
          point1: p1,
          point2: p2,
          point3: p3,
          general: gen,
        });
      }
    });

    return list;
  }, [categorySubmissions]);

  // Export to Excel (.xlsx) with Lazy Loading
  const handleExportExcel = async () => {
    if (categorySubmissions.length === 0) {
      alert('هیچ فیدباکێک نییە بۆ داگرتن.');
      return;
    }

    const XLSX = await import('xlsx');

    const baseHeaders = [
      'کۆدی PIN',
      'ژمارەی مۆبایل',
      'ناوی کارمەند لە PIN',
      'بەشداربوو',
      'بەرواری ناردن',
      'کاتی ناردن',
      'کۆی گشتی خاڵەکان (٪)',
    ];

    const employeeHeaders: string[] = [];
    currentTargetStaff.forEach((emp) => {
      employeeHeaders.push(`${emp.name} (${emp.role}) - کۆی گشتی (٪)`);
      employeeHeaders.push(`${emp.name} - ١. ئەدا و ڕەفتار (٢٠)`);
      employeeHeaders.push(`${emp.name} - ٢. هاوکاری بێ پێ وتن (٢٠)`);
      employeeHeaders.push(`${emp.name} - ٣. مۆبایل و پابەندبوون (٢٠)`);
      employeeHeaders.push(`${emp.name} - ٤. پاک و خاوێنی (٢٠)`);
      employeeHeaders.push(`${emp.name} - ٥. خاڵی ڕەفتار (٢٠)`);
      employeeHeaders.push(`${emp.name} - بارودۆخی ڕەفتاری نەگونجاو`);
      employeeHeaders.push(`${emp.name} - خاڵی تێبینیکراو`);
      employeeHeaders.push(`${emp.name} - سەرنج`);
    });

    const headers = [
      ...baseHeaders, 
      ...employeeHeaders, 
      'پێشنیاری باشترکردن - خاڵی ١', 
      'پێشنیاری باشترکردن - خاڵی ٢', 
      'پێشنیاری باشترکردن - خاڵی ٣', 
      'پێشنیاری گشتی بۆ ئیدارە'
    ];

    const rows = categorySubmissions.map((s) => {
      const baseRow = [
        s.pin,
        s.targetPhone || '--',
        s.targetName || '--',
        'نهێنی (پارێزراو)',
        s.baghdadDate,
        s.baghdadTime,
        `٪${getSubmissionOverallPercent(s)}`,
      ];

      const empCols: any[] = [];
      currentTargetStaff.forEach((emp) => {
        const er = s.employeeRatings ? s.employeeRatings[emp.employeeId] : null;
        if (er) {
          const sc = calculateEmployeeScoreBreakdown(er);
          empCols.push(`٪${sc.totalPts}`);
          empCols.push(sc.q1Pts);
          empCols.push(sc.q2Pts);
          empCols.push(sc.q3Pts);
          empCols.push(sc.q4Pts);
          empCols.push(sc.q5Pts);
          empCols.push(er.hasAnnoyingBehavior === 'yes' ? 'بەڵێ هەیە (١٠ خاڵ)' : er.hasAnnoyingBehavior === 'no' ? 'نەخێر نییە (٢٠ خاڵ)' : '--');
          empCols.push(er.annoyingPoint1 || er.note5 || '--');
          empCols.push(er.comment || '--');
        } else {
          empCols.push('--', '--', '--', '--', '--', '--', '--', '--', '--');
        }
      });

      return [
        ...baseRow, 
        ...empCols, 
        s.improvementPoint1 || '--',
        s.improvementPoint2 || '--',
        s.improvementPoint3 || '--',
        s.suggestionsForManagement || '--'
      ];
    });

    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetTitle = isWarehouse ? 'فیدباکی کارمەندانی کۆگا' : 'فیدباکی فرۆشیار و کاشێر';
    const filePrefix = isWarehouse ? 'Ashley_Warehouse_Staff_Evaluation_' : 'Ashley_Sales_Cashier_Evaluation_';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    XLSX.writeFile(wb, `${filePrefix}${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5 text-slate-900 font-sans" dir="rtl">
      
      {/* 🎯 TOP CATEGORY SWITCHER (فرۆشیار و کاشێر بەرامبەر کۆگا) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setStaffCategory('sales_cashier')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
              !isWarehouse
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>فیدباکی فرۆشیار و کاشێر (٧٥٠٠ - ٩٠٠٠)</span>
            <span className="px-2 py-0.5 rounded-md bg-black/10 text-[10px] font-mono font-bold">
              {getSyncedFeedbackStaffList('sales', employees).length} کارمەند
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStaffCategory('warehouse')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
              isWarehouse
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Boxes className="w-4 h-4 text-blue-600" />
            <span>فیدباکی کارمەندانی کۆگا (٥٠٠٠ - ٧٥٠٠)</span>
            <span className="px-2 py-0.5 rounded-md bg-black/10 text-[10px] font-mono font-bold">
              {getSyncedFeedbackStaffList('warehouse', employees).length} کارمەند
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-bold px-2">
          {isWarehouse ? '📦 بەشی تایبەت بە کارمەندانی کۆگا' : '🛒 بەشی تایبەت بە فرۆشیار و کاشێرەکان'}
        </div>
      </div>

      {/* 🌟 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <h2 className="text-base font-black text-slate-900">
              {isWarehouse ? 'داشبۆردی فیدباک و هەڵسەنگاندنی کارمەندانی کۆگا' : 'داشبۆردی فیدباک و هەڵسەنگاندنی فرۆشیار و کاشێرەکان'}
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
          {/* Direct Link to Separated Manager Evaluation Studio */}
          <Link
            href="/adm1n_pan0l?view=manager_evaluation"
            className="h-10 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-900 font-black text-xs flex items-center gap-1.5 transition-all"
            title="چوون بۆ بەشی جیاکراوەی هەڵسەنگاندنی بەڕێوەبەر (بەشی سێیەم ٢٠-١٠٠)"
          >
            <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            <span>بەشی هەڵسەنگاندنی بەڕێوەبەر</span>
            {managerEvalCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-black">
                {managerEvalCount}
              </span>
            )}
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
        {/* Tile 1: ڕێژەی دەنگدان و بەشداری ستاف (Voting Turnout) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block mb-1">ڕێژەی دەنگدان (بەشداری ستاف)</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${metrics.participationRate >= 100 ? 'text-emerald-600' : 'text-amber-500'}`}>
              ٪{metrics.participationRate}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">
              ({metrics.usedPinsCount} لە {metrics.totalPins} کارمەند)
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block mt-1">
            {metrics.participationRate >= 100 ? '✓ ١٠٠٪ سەرجەم ستافەکە دەنگیان داوە' : `${metrics.activePinsCount} دەنگ ماوە`}
          </span>
        </div>

        {/* Tile 2: تێکڕای نمرەی هەڵسەنگاندن (Overall Evaluation Score) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block mb-1">تێکڕای نمرەی هەڵسەنگاندن</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-500">٪{metrics.avgOverallPercent}</span>
            <span className="text-[10px] text-slate-400 font-bold">لە ١٠٠٪</span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold block mt-1">
            ئاستی بەدەستهاتووی نێوان کارمەندان
          </span>
        </div>

        {/* Tile 3: کۆی فیدباکەکان */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block mb-1">کۆی فیدباکەکان (دەنگەکان)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900">{metrics.totalSubmissions}</span>
            <span className="text-[10px] text-slate-400 font-bold">فۆرمی وەڵامدراو</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold block mt-1">
            تەواوی دەنگە نێردراوەکان
          </span>
        </div>

        {/* Tile 4: دۆخی کۆدەکان */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-black text-slate-500 block mb-1">دۆخی کۆدەکانی PIN</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600">{metrics.usedPinsCount}</span>
            <span className="text-[10px] text-slate-400 font-bold">بەکارگیراو لە {metrics.totalPins}</span>
          </div>
          <span className="text-[10px] font-bold block mt-1 text-slate-500">
            {metrics.activePinsCount === 0 ? '✓ هەموو کۆدەکان بەکارهاتوون' : `${metrics.activePinsCount} کۆد بەردەستە`}
          </span>
        </div>
      </div>

      {/* 🧭 3. TABS NAVIGATION (URL Addressable Pages / Tabs) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 flex-wrap">
          
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
            <span>داشبۆرد و هێڵکارەکان</span>
          </button>

          {/* Tab 2: Question 5 Annoying Behaviors Link */}
          <button
            type="button"
            onClick={() => handleTabChange('annoying_qa')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'annoying_qa'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>ڕەفتارە بێزارکەرەکان (پرسیاری ٥)</span>
            {annoyingBehaviorStats.totalReported > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {annoyingBehaviorStats.totalReported}
              </span>
            )}
          </button>

          {/* Tab 3: Improvement Suggestions (3 Points) Link */}
          <button
            type="button"
            onClick={() => handleTabChange('suggestions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'suggestions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>پێشنیاری باشترکردن بە ٣ خاڵ ({improvementSuggestionsList.length})</span>
          </button>

          {/* Tab 4: Submissions Link */}
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
            <span>فیدباکە وەرگیراوەکان ({categorySubmissions.length})</span>
          </button>

          {/* Tab 5: PINs Link */}
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
            <span>کۆدەکانی PIN ({Object.keys(categoryPins).length})</span>
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
                            {topPerformer.count} جار لەلایەن هاوپیشەکانی هەڵسەنگێندراوە
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Big Score Card (Percentage, No Stars) */}
                    <div className="bg-white/95 backdrop-blur-xs border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm text-center min-w-[145px] shrink-0">
                      <span className="text-[11px] font-black text-amber-900 block mb-0.5">تێکڕای ڕێژەی زێڕین</span>
                      <div className="flex items-baseline justify-center gap-0.5 font-mono font-black text-amber-600 text-3xl">
                        <span>٪{topPerformer.avgScorePercent}</span>
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700 mt-1 bg-emerald-50 border border-emerald-200/80 rounded-lg py-0.5 px-2">
                        {topPerformer.avgScorePercent} / ١٠٠ خاڵ
                      </div>
                    </div>
                  </div>

                  {/* 4 Pillar Competency Progress Bars (Each out of 20 points = 80 total) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>١. ڕەفتار و ڕێز:</span>
                        <span className="font-mono text-emerald-700 font-black">{topPerformer.avgQ1Pts} / ٢٠</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${topPerformer.avgQ1Percent}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>٢. هاوکاری بێ پێ وتن:</span>
                        <span className="font-mono text-blue-700 font-black">{topPerformer.avgQ2Pts} / ٢٠</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${topPerformer.avgQ2Percent}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>٣. مۆبایل و دەوام:</span>
                        <span className="font-mono text-purple-700 font-black">{topPerformer.avgQ3Pts} / ٢٠</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${topPerformer.avgQ3Percent}%` }} />
                      </div>
                    </div>

                    <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                        <span>٤. پاک و خاوێنی:</span>
                        <span className="font-mono text-amber-700 font-black">{topPerformer.avgQ4Pts} / ٢٠</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" style={{ width: `${topPerformer.avgQ4Percent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* 🥈 & 🥉 RUNNERS-UP (SILVER & BRONZE CARDS - Percentages & Points) */}
            <div className="space-y-3 flex flex-col justify-between">
              
              {/* 🥈 2nd Place: Silver Performer */}
              {secondPerformer ? (
                <div className="flex-1 rounded-3xl p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/80 border border-slate-300 shadow-xs ring-2 ring-slate-300/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-black">
                      <Medal className="w-3.5 h-3.5 text-slate-600" />
                      <span>🥈 پلەی دووەم • خەڵاتی زیوین</span>
                    </span>
                    <span className="font-mono font-black text-slate-900 text-sm bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      ٪{secondPerformer.avgScorePercent}
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

                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                    <div className="bg-white/80 p-1 rounded-lg">ڕەفتار: <span className="font-mono text-emerald-600 font-black">{secondPerformer.avgQ1Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">هاوکاری: <span className="font-mono text-blue-600 font-black">{secondPerformer.avgQ2Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">دەوام: <span className="font-mono text-purple-600 font-black">{secondPerformer.avgQ3Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">خاوێنی: <span className="font-mono text-amber-600 font-black">{secondPerformer.avgQ4Pts}/20</span></div>
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
                    <span className="font-mono font-black text-amber-700 text-sm bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                      ٪{thirdPerformer.avgScorePercent}
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

                  <div className="mt-2.5 pt-2 border-t border-amber-200/50 grid grid-cols-4 gap-1 text-[10px] text-center font-bold">
                    <div className="bg-white/80 p-1 rounded-lg">ڕەفتار: <span className="font-mono text-emerald-600 font-black">{thirdPerformer.avgQ1Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">هاوکاری: <span className="font-mono text-blue-600 font-black">{thirdPerformer.avgQ2Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">دەوام: <span className="font-mono text-purple-600 font-black">{thirdPerformer.avgQ3Pts}/20</span></div>
                    <div className="bg-white/80 p-1 rounded-lg">خاوێنی: <span className="font-mono text-amber-600 font-black">{thirdPerformer.avgQ4Pts}/20</span></div>
                  </div>
                </div>
              ) : null}

            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📊 CHART SECTION 1: RECHARTS COMPARATIVE BAR CHART */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    هێڵکاری بەراوردکاری نمرەی گشتی {isWarehouse ? `سەرجەم ${currentTargetStaff.length} کارمەندی کۆگا` : `سەرجەم ${currentTargetStaff.length} کارمەندی فرۆشیار و کاشێر`}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  بەراوردی ڕاستەوخۆ بەپێی کۆی خاڵەکانی هەڵسەنگاندن (لە ١٠٠٪ بە ڕێژەی تەواو)
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
                  <span>تەواوی ستاف</span>
                </div>
              </div>
            </div>

            <div className="w-full h-80 pt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeBarData} margin={{ top: 20, right: 15, left: 0, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fontWeight: 800, fill: '#334155' }} 
                    angle={-20} 
                    textAnchor="end" 
                    interval={0} 
                  />
                  <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} unit="%" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs font-sans text-right" dir="rtl">
                            <div className="font-black text-amber-400 mb-1">{data.fullName}</div>
                            <div className="text-[11px] text-slate-300 font-bold mb-2">ڕۆڵ: {data.role}</div>
                            <div className="space-y-1 font-mono text-[11px]">
                              <div className="text-amber-400 font-black pb-1.5 mb-1 border-b border-slate-700">
                                کۆی گشتی: ٪{data.score} ({data.score} / ١٠٠ خاڵ)
                              </div>
                              <div>١. ڕەفتار و ڕێز: <span className="text-emerald-400">{data.q1} / ٢٠</span></div>
                              <div>٢. هاوکاری بێ پێ وتن: <span className="text-blue-400">{data.q2} / ٢٠</span></div>
                              <div>٣. مۆبایل و پابەندبوون: <span className="text-purple-400">{data.q3} / ٢٠</span></div>
                              <div>٤. پاک و خاوێنی: <span className="text-amber-400">{data.q4} / ٢٠</span></div>
                              <div>٥. ڕەفتاری شوێنەکە: <span className="text-sky-400">{data.q5} / ٢٠</span></div>
                              <div className="text-slate-400 pt-1 border-t border-slate-700 font-sans">ژمارەی دەنگ: {data.count} جار</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {employeeBarData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#3b82f6'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📊 CHART SECTION 2: 4 QUALITY PILLARS RADAR & PERCENTAGE DISTRIBUTION */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card A: 4 Core Pillars Competency Radar */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-black text-slate-900">
                    هێڵکاری ڕاداری ٤ تەوەرە سەرەکییەکە (بە ٪)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-2">
                  شیکاری چوارچێوەی توانست و دیسیپلینی ستاف لە ٤ ڕەهەنددا (لە ١٠٠٪)
                </p>

                <div className="w-full h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 10, fontWeight: 800 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Radar name="تێکڕای تیم" dataKey="value" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                      <Tooltip formatter={(val: any) => [`٪${val}`, 'ئاستی بەدەستهاتوو']} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] sm:text-[11px] font-bold">
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <span className="text-slate-500 block">ڕەفتار:</span>
                  <span className="font-mono text-emerald-600 font-black">{storeAnalytics.avgQ1}/20</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <span className="text-slate-500 block">هاوکاری:</span>
                  <span className="font-mono text-blue-600 font-black">{storeAnalytics.avgQ2}/20</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <span className="text-slate-500 block">پابەندبوون:</span>
                  <span className="font-mono text-purple-600 font-black">{storeAnalytics.avgQ3}/20</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <span className="text-slate-500 block">خاوێنی:</span>
                  <span className="font-mono text-amber-600 font-black">{storeAnalytics.avgQ4}/20</span>
                </div>
              </div>
            </div>

            {/* Card B: Percentage Distribution Area Curve (90-100% to <60%) */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm font-black text-slate-900">
                    هێڵکاری دابەشبوونی ڕێژەی فیدباکەکان (بە ٪)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-2">
                  ڕێژەی دەنگەکان بەپێی ئاستی ڕێژەی لەسەدا و پلەی ڕەزامەندی
                </p>

                <div className="w-full h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scoreDistributionData} margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="tier" tick={{ fontSize: 9.5, fontWeight: 700 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(val: any) => [`${val} دەنگ`, 'ژمارەی دەنگەکان']} />
                      <Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>کۆی دەنگەکانی کارمەندان: <span className="font-mono text-slate-900 font-black">{storeAnalytics.totalStaffRatingsCount}</span></span>
                <span className="font-mono text-emerald-600 font-black">
                  {metrics.totalSubmissions > 0 
                    ? `٪${Math.round(((storeAnalytics.distribution['90-100'] + storeAnalytics.distribution['80-89']) / Math.max(1, storeAnalytics.totalStaffRatingsCount)) * 100)} نایاب و زۆر باش`
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
                  خشتەی وردی شیکاری و خاڵەکانی سەرجەم {currentTargetStaff.length} کارمەندەکە
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                ڕیزکراوە بەپێی کۆی گشتی خاڵەکان (بە ڕێژەی ٪ لەسەدا)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <tr>
                    <th className="p-3.5 text-center">پلە</th>
                    <th className="p-3.5">کارمەند</th>
                    <th className="p-3.5">ڕۆڵ</th>
                    <th className="p-3.5 text-center">دەنگ</th>
                    <th className="p-3.5 text-center">{isWarehouse ? 'پ١: ڕەفتار (٢٠)' : 'پ١: کڕیار و فرۆشتن (٢٠)'}</th>
                    <th className="p-3.5 text-center">{isWarehouse ? 'پ٢: هاوکاری (٢٠)' : 'پ٢: عەرز و پۆشین (٢٠)'}</th>
                    <th className="p-3.5 text-center">{isWarehouse ? 'پ٣: مۆبایل (٢٠)' : 'پ٣: هاوکاری و تەبایی (٢٠)'}</th>
                    <th className="p-3.5 text-center">{isWarehouse ? 'پ٤: پاک و خاوێنی (٢٠)' : 'پ٤: دەوام و مۆبایل (٢٠)'}</th>
                    <th className="p-3.5 text-center">{isWarehouse ? 'پ٥: ڕەفتاری کۆگا (٢٠)' : 'پ٥: ڕەفتاری هۆڵ (٢٠)'}</th>
                    <th className="p-3.5 text-center">کۆی گشتی (٪)</th>
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
                          {item.count} دەنگ
                        </td>

                        {/* Question 1: Service / Behavior (out of 20) */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-emerald-600 text-xs">
                            {item.avgQ1Pts > 0 ? `${item.avgQ1Pts} / ٢٠` : '--'}
                          </span>
                        </td>

                        {/* Question 2: Helpfulness / Performance (out of 20) */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-blue-600 text-xs">
                            {item.avgQ2Pts > 0 ? `${item.avgQ2Pts} / ٢٠` : '--'}
                          </span>
                        </td>

                        {/* Question 3: Discipline / Mobile (out of 20) */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-purple-600 text-xs">
                            {item.avgQ3Pts > 0 ? `${item.avgQ3Pts} / ٢٠` : '--'}
                          </span>
                        </td>

                        {/* Question 4: Cleanliness (out of 20) */}
                        <td className="p-3.5 text-center">
                          <span className="font-mono font-black text-amber-600 text-xs">
                            {item.avgQ4Pts > 0 ? `${item.avgQ4Pts} / ٢٠` : '--'}
                          </span>
                        </td>

                        {/* Question 5: Annoying Behaviors Badge & Points (out of 20) */}
                        <td className="p-3.5 text-center">
                          {(() => {
                            const stat = annoyingBehaviorStats.perEmployee.find(p => p.emp.employeeId === item.emp.employeeId);
                            if (!stat || stat.total === 0) {
                              return <span className="text-[10px] text-slate-400 font-bold">چاوەڕوان</span>;
                            }
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-mono font-black text-sky-700 text-xs">
                                  {item.avgQ5Pts > 0 ? `${item.avgQ5Pts} / ٢٠` : '--'}
                                </span>
                                {stat.reportedCount > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnnoyingEmpFilter(item.emp.employeeId);
                                      handleTabChange('annoying_qa');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                    title="کلیک بکە بۆ بینینی خاڵەکانی پرسیاری ٥"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                    <span>{stat.reportedCount} سەرنج</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>خاوێن</span>
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Overall Rating (Total Score in Percentage 0-100%, No Stars) */}
                        <td className="p-3.5 text-center">
                          <div className={`inline-flex items-center gap-0.5 font-mono font-black px-2.5 py-1 rounded-xl text-xs ${
                            isFirst 
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-2 ring-amber-300' 
                              : item.avgScorePercent >= 90
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                              : item.avgScorePercent >= 80
                              ? 'bg-blue-50 text-blue-700 border border-blue-300'
                              : item.avgScorePercent > 0
                              ? 'bg-slate-100 text-slate-800 border border-slate-200'
                              : 'text-slate-400'
                          }`}>
                            <span>{item.avgScorePercent > 0 ? `٪${item.avgScorePercent}` : '--'}</span>
                          </div>
                        </td>

                        {/* Merit Badge */}
                        <td className="p-3.5 text-center">
                          {isFirst ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px]">
                              پێشەنگی زێڕین
                            </span>
                          ) : item.avgScorePercent >= 90 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              نایاب
                            </span>
                          ) : item.avgScorePercent >= 80 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                              زۆر باش
                            </span>
                          ) : item.avgScorePercent >= 70 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              باش
                            </span>
                          ) : item.avgScorePercent > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                              مامناوەند
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
      {/* ⚠️ VIEW: QUESTION 5 ANNOYING BEHAVIORS STUDIO (ڕەفتارە بێزارکەرەکان) */}
      {/* ========================================================================= */}
      {activeTab === 'annoying_qa' && (
        <div className="space-y-4">
          
          {/* Header Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">تەواوی هەڵسەنگاندنەکانی پ٥</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-slate-900">{annoyingBehaviorStats.totalEvaluations}</span>
                <span className="text-[10px] text-slate-400 font-bold">دەنگ</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">ڕێژەی خاوێن و بێ کێشە</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-emerald-600">٪{annoyingBehaviorStats.cleanPercent}</span>
                <span className="text-[10px] text-emerald-500 font-bold">بێ سەرنجی نەگونجاو</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">سەرنج و ڕەفتاری نەگونجاو</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-rose-600">{annoyingBehaviorStats.totalReported}</span>
                <span className="text-[10px] text-rose-500 font-bold">خاڵی تێبینیکراو</span>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-700">فلتەری کارمەند:</span>
              <button
                type="button"
                onClick={() => setAnnoyingEmpFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  annoyingEmpFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                هەموو کارمەندان
              </button>
              {currentTargetStaff.map((emp) => {
                const stat = annoyingBehaviorStats.perEmployee.find(p => p.emp.employeeId === emp.employeeId);
                const hasRep = stat && stat.reportedCount > 0;
                return (
                  <button
                    key={emp.employeeId}
                    type="button"
                    onClick={() => setAnnoyingEmpFilter(emp.employeeId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      annoyingEmpFilter === emp.employeeId
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : hasRep
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{emp.name}</span>
                    {hasRep && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {stat?.reportedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={annoyingSearch}
                onChange={(e) => setAnnoyingSearch(e.target.value)}
                placeholder="گەڕان لە خاڵەکانی پ٥..."
                className="w-full h-9 pr-9 pl-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {annoyingBehaviorStats.perEmployee
              .filter((item) => annoyingEmpFilter === 'all' || item.emp.employeeId === annoyingEmpFilter)
              .map((item) => {
                const filteredReports = item.reports.filter((r) => {
                  if (!annoyingSearch.trim()) return true;
                  const q = annoyingSearch.toLowerCase().trim();
                  return (
                    (r.point1 && r.point1.toLowerCase().includes(q)) ||
                    (r.point2 && r.point2.toLowerCase().includes(q)) ||
                    (r.point3 && r.point3.toLowerCase().includes(q))
                  );
                });

                return (
                  <div
                    key={item.emp.employeeId}
                    className={`bg-white rounded-3xl border p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all ${
                      item.reportedCount > 0 ? 'border-rose-300 ring-2 ring-rose-500/10' : 'border-slate-200/90'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-xs shrink-0">
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
                            <h4 className="text-sm font-black text-slate-900">{item.emp.fullName}</h4>
                            <span className="text-[10px] text-slate-400 font-bold">{item.emp.role}</span>
                          </div>
                        </div>

                        {item.reportedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{item.reportedCount} سەرنج</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>پاکە</span>
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      {filteredReports.length > 0 ? (
                        <div className="space-y-3">
                          {filteredReports.map((r, rIdx) => (
                            <div key={rIdx} className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1 border-b border-rose-200/50">
                                <span>کۆد: {r.pin}</span>
                                <span>{r.date} • {r.time}</span>
                              </div>
                              {r.point1 && (
                                <div className="text-slate-900 font-bold">
                                  <span className="text-rose-600 font-black">خاڵی ١: </span>
                                  <span>{r.point1}</span>
                                </div>
                              )}
                              {r.point2 && (
                                <div className="text-slate-800">
                                  <span className="text-rose-500 font-bold">خاڵی ٢: </span>
                                  <span>{r.point2}</span>
                                </div>
                              )}
                              {r.point3 && (
                                <div className="text-slate-800">
                                  <span className="text-rose-500 font-bold">خاڵی ٣: </span>
                                  <span>{r.point3}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-500 font-bold bg-slate-50 rounded-2xl border border-slate-100">
                          <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                          <span>هیچ ڕەفتارێکی نەگونجاو بۆ ئەم کارمەندە تۆمار نەکراوە.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💡 VIEW: 3 IMPROVEMENT SUGGESTIONS STUDIO (پێشنیارە ٣ خاڵییەکان) */}
      {/* ========================================================================= */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {/* Header Summary */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <Lightbulb className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  سەرجەم پێشنیارەکانی باشترکردن (بە ٣ خاڵ)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  کۆی {improvementSuggestionsList.length} بەشداری و پێشنیار بۆ پەرەپێدانی کار و شوێنەکە تۆمار کراوە
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = improvementSuggestionsList.map((s, idx) => {
                    const lines = [`[پێشنیاری #${idx + 1} - PIN: ${s.pin} - بەروار: ${s.date}]`];
                    if (s.respondentName) lines.push(`ناو: ${s.respondentName}`);
                    if (s.point1) lines.push(`خاڵی ١: ${s.point1}`);
                    if (s.point2) lines.push(`خاڵی ٢: ${s.point2}`);
                    if (s.point3) lines.push(`خاڵی ٣: ${s.point3}`);
                    if (s.general) lines.push(`سەرنجی تر: ${s.general}`);
                    return lines.join('\n');
                  }).join('\n\n---\n\n');
                  handleCopy(text, 'سەرجەم پێشنیارەکان');
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <Copy className="w-4 h-4" />
                <span>کۆپیکردنی هەموو پێشنیارەکان</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                placeholder="گەڕان لە پێشنیارەکان، ناوی هەڵسەنگێنەر، یان کۆدی PIN..."
                className="w-full h-10 pr-10 pl-4 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Suggestions Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {improvementSuggestionsList
              .filter((item) => {
                if (!suggestionSearch.trim()) return true;
                const q = suggestionSearch.toLowerCase().trim();
                return (
                  item.pin.includes(q) ||
                  (item.respondentName && item.respondentName.toLowerCase().includes(q)) ||
                  (item.point1 && item.point1.toLowerCase().includes(q)) ||
                  (item.point2 && item.point2.toLowerCase().includes(q)) ||
                  (item.point3 && item.point3.toLowerCase().includes(q)) ||
                  (item.general && item.general.toLowerCase().includes(q))
                );
              })
              .map((item, idx) => (
                <div key={item.id || idx} className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 font-mono font-black text-xs flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {item.respondentName || 'بەشداربووی نهێنی'}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">PIN: {item.pin}</span>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono font-bold">
                        {item.date} • {item.time}
                      </span>
                    </div>

                    {/* 3 Points */}
                    <div className="space-y-2 text-xs">
                      {item.point1 && (
                        <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70">
                          <span className="font-black text-amber-700 block mb-0.5">خاڵی ١ (پێشنیاری سەرەکی):</span>
                          <span className="text-slate-900 font-bold leading-relaxed">{item.point1}</span>
                        </div>
                      )}
                      {item.point2 && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                          <span className="font-bold text-slate-600 block mb-0.5">خاڵی ٢:</span>
                          <span className="text-slate-800 leading-relaxed">{item.point2}</span>
                        </div>
                      )}
                      {item.point3 && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                          <span className="font-bold text-slate-600 block mb-0.5">خاڵی ٣:</span>
                          <span className="text-slate-800 leading-relaxed">{item.point3}</span>
                        </div>
                      )}
                      {item.general && (
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/70 text-slate-800">
                          <span className="font-bold text-blue-700 block mb-0.5">سەرنجی گشتی:</span>
                          <span className="leading-relaxed">{item.general}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
                <option value="all">هەموو ڕێژەکان (٪)</option>
                <option value="90-100">٩٠٪ - ١٠٠٪ (نایاب)</option>
                <option value="80-89">٨٠٪ - ٨٩٪ (زۆر باش)</option>
                <option value="70-79">٧٠٪ - ٧٩٪ (باش)</option>
                <option value="60-69">٦٠٪ - ٦٩٪ (مامناوەند)</option>
                <option value="below-60">کەمتر لە ٦٠٪ (پێویستی بە چاککردنە)</option>
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
                      <th className="p-3.5">بەشداربوو</th>
                      <th className="p-3.5 text-center">کۆی خاڵەکان (٪)</th>
                      <th className="p-3.5 text-center">کارمەندانی هەڵسەنگێندراو</th>
                      <th className="p-3.5">پێشنیاری گشتی</th>
                      <th className="p-3.5">بەروار و کات</th>
                      <th className="p-3.5 text-center">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {filteredSubmissions.map((s) => {
                      const empEvaluationsCount = s.employeeRatings ? Object.keys(s.employeeRatings).length : 0;
                      const subScore = getSubmissionOverallPercent(s);

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 inline-block" dir="ltr">
                              {s.pin}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>نهێنی (پارێزراو)</span>
                            </div>
                          </td>

                          <td className="p-3.5 text-center">
                            <div className={`inline-flex items-center gap-0.5 font-mono font-black px-2.5 py-1 rounded-lg ${
                              subScore >= 90
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-300'
                                : subScore >= 80
                                ? 'text-blue-700 bg-blue-50 border border-blue-300'
                                : 'text-amber-700 bg-amber-50 border border-amber-300'
                            }`}>
                              <span>٪{subScore}</span>
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
                  <h4 className="text-xs font-black text-amber-900">فۆرمی هەڵسەنگاندنی بەڕێوەبەر</h4>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 font-mono text-[10px] font-bold" dir="ltr">
                    0000 - 5999
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  کۆدی ٤ ژمارەیی بۆ کردنەوەی فۆرمی نهێنی و بێ‌ناوی هەڵسەنگاندنی بەڕێوەبەر لە /feedback (ئەنجامەکان تەنها لە ئەدمین پانێڵە).
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
                            directUrl = `${window.location.origin}/feedback?pin=${p.pin}`;
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
                  title={isWarehouse ? "ڕاپۆرتی شیکاری فیدباک و هەڵسەنگاندنی کارمەندانی کۆگا" : "ڕاپۆرتی شیکاری فیدباک و هەڵسەنگاندنی کارمەندانی فرۆشیار و کاشێر"}
                  subtitle={isWarehouse ? "پوختەی هەڵسەنگاندنی هاوپیشەکان، تیمی کۆگا و پێشنیارەکانی بەڕێوەبردن" : "پوختەی هەڵسەنگاندنی کڕیاران، شیکاری پێوانەیی، و پێشنیارەکانی پەرەپێدان"}
                  documentCode={isWarehouse ? "ASH-WH-FB-2026" : "ASH-DGP-FB-2026"}
                />

                {/* 1.2 Executive KPI Summary Cards */}
                <div className="grid grid-cols-4 gap-3 break-inside-avoid">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">ڕێژەی دەنگدان (بەشداری)</span>
                    <span className="text-xl font-black font-mono text-emerald-600">٪{metrics.participationRate}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">کۆی فیدباکەکان</span>
                    <span className="text-xl font-black font-mono text-slate-900">{metrics.totalSubmissions}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">{isWarehouse ? "تێکڕای نمرەی کۆگا (لە ١٠٠٪)" : "تێکڕای نمرەی پێشانگا (لە ١٠٠٪)"}</span>
                    <span className="text-xl font-black font-mono text-amber-600">٪{metrics.avgOverallPercent}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 text-center">
                    <span className="text-[10px] font-bold text-amber-800 block">پێشەنگی زێڕینی ستاف</span>
                    <span className="text-xs font-black text-amber-950 truncate block mt-1">
                      👑 {topPerformer?.emp.fullName || 'دیاری نەکراوە'}
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
                            👑 پلەی یەکەم • خەڵاتی زێڕینی ئاشڵی
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-950 mt-1">{topPerformer.emp.fullName}</h4>
                        <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                          {topPerformer.emp.role} • خاوەنی بەرزترین ئاستی ڕەزامەندی ({topPerformer.count} دەنگ)
                        </p>
                      </div>
                    </div>

                    <div className="text-left font-mono font-black shrink-0">
                      <span className="text-2xl text-amber-600 block">٪{topPerformer.avgScorePercent}</span>
                      <span className="text-[9px] text-slate-500 font-sans font-bold">{topPerformer.avgScorePercent} لە ١٠٠ خاڵ</span>
                    </div>
                  </div>
                )}

                {/* 1.4 Comprehensive Staff Evaluation Table */}
                <div className="break-inside-avoid">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-900">
                      {isWarehouse ? `خشتەی نمرەی سەرجەم ${currentTargetStaff.length} کارمەندی بەڕێزی کۆگا:` : `خشتەی نمرەی سەرجەم ${currentTargetStaff.length} کارمەندی فرۆشیار و کاشێر:`}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-bold">پێوەری فەرمی خاڵەکان (٪)</span>
                  </div>

                  <table className="w-full text-right text-[10.5px] border-collapse border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-black">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center">پلە</th>
                        <th className="p-2 border border-slate-300">ناوی کارمەند</th>
                        <th className="p-2 border border-slate-300 text-center">ڕۆڵ</th>
                        <th className="p-2 border border-slate-300 text-center">دەنگ</th>
                        <th className="p-2 border border-slate-300 text-center">پ١: ڕەفتار (٢٠)</th>
                        <th className="p-2 border border-slate-300 text-center">پ٢: هاوکاری (٢٠)</th>
                        <th className="p-2 border border-slate-300 text-center">پ٣: دەوام (٢٠)</th>
                        <th className="p-2 border border-slate-300 text-center">پ٤: خاوێنی (٢٠)</th>
                        <th className="p-2 border border-slate-300 text-center">پ٥: شوێن (٢٠)</th>
                        <th className="p-2 border border-slate-300 text-center">کۆی گشتی (٪)</th>
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
                            {item.avgQ1Pts > 0 ? item.avgQ1Pts : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgQ2Pts > 0 ? item.avgQ2Pts : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgQ3Pts > 0 ? item.avgQ3Pts : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgQ4Pts > 0 ? item.avgQ4Pts : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono">
                            {item.avgQ5Pts > 0 ? item.avgQ5Pts : '--'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center font-mono font-black text-amber-700">
                            {item.avgScorePercent > 0 ? `٪${item.avgScorePercent}` : '--'}
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
                    {isWarehouse ? `بەراوردی نمرەی ${currentTargetStaff.length} کارمەندەکەی کۆگا لەسەر ئاستی پرسیارەکان` : `بەراوردی نمرەی ${currentTargetStaff.length} کارمەندەکە لەسەر ئاستی پرسیارەکان`}
                  </span>
                </div>

                {/* 2.1 Graph Question 1 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs">١</span>
                      <h4 className="text-xs font-black text-slate-900">
                        {isWarehouse ? "پرسیاری ١: ڕەفتار و مامەڵە لەگەڵ تیمی کۆگا و هاوپیشەکان (لە ٢٠ خاڵ)" : "پرسیاری ١: مامەڵە و ڕەفتار لەگەڵ کڕیار (لە ٢٠ خاڵ)"}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      تێکڕا: {storeAnalytics.avgQ1} / ٢٠ (٪{Math.round((storeAnalytics.avgQ1 / 20) * 100)})
                    </span>
                  </div>

                  {/* Dynamic Column Bar Chart for Question 1 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item) => {
                      const percent = (item.avgQ1Pts / 20) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-emerald-700">
                            {item.avgQ1Pts > 0 ? item.avgQ1Pts : '٠'}
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

                {/* 2.2 Graph Question 2 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">٢</span>
                      <h4 className="text-xs font-black text-slate-900">
                        {isWarehouse ? "پرسیاری ٢: چالاکی، لێهاتوویی و خێرایی لە کارەکانی کۆگا (لە ٢٠ خاڵ)" : "پرسیاری ٢: چالاکی، زانیاری و لێهاتوویی لە فرۆشتن (لە ٢٠ خاڵ)"}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      تێکڕا: {storeAnalytics.avgQ2} / ٢٠ (٪{Math.round((storeAnalytics.avgQ2 / 20) * 100)})
                    </span>
                  </div>

                  {/* Dynamic Column Bar Chart for Question 2 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item) => {
                      const percent = (item.avgQ2Pts / 20) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-blue-700">
                            {item.avgQ2Pts > 0 ? item.avgQ2Pts : '٠'}
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

                {/* 2.3 Graph Question 3 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs">٣</span>
                      <h4 className="text-xs font-black text-slate-900">
                        {isWarehouse ? "پرسیاری ٣: پابەندبوون بە دەوام و مۆبایل بەکارنەهێنان (لە ٢٠ خاڵ)" : "پرسیاری ٣: پابەندبوون بە دەوام و ڕێنماییەکان (لە ٢٠ خاڵ)"}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                      تێکڕا: {storeAnalytics.avgQ3} / ٢٠ (٪{Math.round((storeAnalytics.avgQ3 / 20) * 100)})
                    </span>
                  </div>

                  {/* Column Bar Chart for Question 3 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item) => {
                      const percent = (item.avgQ3Pts / 20) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className="text-[9px] font-mono font-black mb-1 text-purple-700">
                            {item.avgQ3Pts > 0 ? item.avgQ3Pts : '٠'}
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

                {/* 2.4 Graph Question 4: Cleanliness & Question 5 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 break-inside-avoid">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">٤</span>
                      <h4 className="text-xs font-black text-slate-900">
                        پرسیاری ٤: پاک و خاوێنی و گرنگیدان بە شوێنەکە (لە ٢٠ خاڵ)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md">
                      تێکڕا: {storeAnalytics.avgQ4} / ٢٠ (٪{Math.round((storeAnalytics.avgQ4 / 20) * 100)})
                    </span>
                  </div>

                  {/* Column Bar Chart for Question 4 */}
                  <div className="flex items-end justify-between gap-2 h-32 px-2 pb-1 border-b border-slate-300">
                    {staffLeaderboard.map((item, index) => {
                      const percent = (item.avgQ4Pts / 20) * 100;
                      const h = item.count === 0 ? 8 : Math.max(12, percent);
                      const isFirst = index === 0 && item.count > 0;
                      const isSecond = index === 1 && item.count > 0;
                      const isThird = index === 2 && item.count > 0;

                      return (
                        <div key={item.emp.employeeId} className="flex-1 flex flex-col items-center justify-end h-full">
                          <span className={`text-[9px] font-mono font-black mb-1 ${isFirst ? 'text-amber-600' : 'text-slate-800'}`}>
                            {item.avgQ4Pts > 0 ? item.avgQ4Pts : '٠'}
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

                {/* 2.5 General Store Dimensions & Percentage Distribution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 break-inside-avoid">
                  
                  {/* Store Dimensions */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <span className="font-black text-slate-900 block pb-1 border-b border-slate-200">
                      پوختەی خاڵەکانی تەوەرە سەرەکییەکان:
                    </span>
                    <div className="flex items-center justify-between">
                      <span>• ١. مامەڵە و ڕەفتار:</span>
                      <span className="font-mono text-emerald-700 font-black">{storeAnalytics.avgQ1} / ٢٠</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• ٢. چالاکی و هاوکاری:</span>
                      <span className="font-mono text-blue-700 font-black">{storeAnalytics.avgQ2} / ٢٠</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• ٣. دەوام و مۆبایل:</span>
                      <span className="font-mono text-purple-700 font-black">{storeAnalytics.avgQ3} / ٢٠</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• ٤. پاک و خاوێنی:</span>
                      <span className="font-mono text-amber-600 font-black">{storeAnalytics.avgQ4} / ٢٠</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• ٥. ڕەفتاری شوێنەکە:</span>
                      <span className="font-mono text-sky-700 font-black">{storeAnalytics.avgQ5} / ٢٠</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-black">
                      <span>• تێکڕای گشتی ستاف:</span>
                      <span className="font-mono text-emerald-600">٪{metrics.avgOverallPercent}</span>
                    </div>
                  </div>

                  {/* Distribution Percentage Tiers */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <span className="font-black text-slate-900 block pb-1 border-b border-slate-200">
                      دابەشبوونی هەڵسەنگاندنەکان (بە ڕێژەی ٪):
                    </span>
                    {[
                      { key: '90-100', label: '٩٠٪ - ١٠٠٪ (نایاب)' },
                      { key: '80-89', label: '٨٠٪ - ٨٩٪ (زۆر باش)' },
                      { key: '70-79', label: '٧٠٪ - ٧٩٪ (باش)' },
                      { key: '60-69', label: '٦٠٪ - ٦٩٪ (مامناوەند)' },
                      { key: 'below-60', label: 'کەمتر لە ٦٠٪ (لاواز)' }
                    ].map((tier) => {
                      const c = storeAnalytics.distribution[tier.key] || 0;
                      const p = storeAnalytics.totalStaffRatingsCount > 0 ? Math.round((c / storeAnalytics.totalStaffRatingsCount) * 100) : 0;
                      return (
                        <div key={tier.key} className="flex items-center justify-between text-[11px]">
                          <span>{tier.label}:</span>
                          <span className="font-mono font-bold text-slate-700">{c} دەنگ (٪{p})</span>
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
                          <th className="p-2 border border-slate-300">بەشداربوو</th>
                          <th className="p-2 border border-slate-300 text-center">بەروار و کات</th>
                          <th className="p-2 border border-slate-300 text-center">کۆی خاڵەکان (٪)</th>
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
                              <span className="font-bold text-slate-950 block">نهێنی (پارێزراو)</span>
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono text-[10px]" dir="ltr">
                              {s.baghdadDate} {s.baghdadTime}
                            </td>
                            <td className="p-2 border border-slate-300 text-center font-mono font-black text-emerald-700">
                              ٪{getSubmissionOverallPercent(s)}
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
              {/* Respondent info & Total percentage */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">بەشداربوو:</span>
                  <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>نهێنی (پارێزراو)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">کۆی گشتی خاڵەکان (٪):</span>
                  <span className="font-black font-mono text-emerald-600 text-sm">
                    ٪{getSubmissionOverallPercent(selectedSubmission)} (لە ١٠٠٪)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">کاتی تۆمارکردن:</span>
                  <span className="font-mono text-slate-700">{selectedSubmission.baghdadDate} {selectedSubmission.baghdadTime}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">بەش:</span>
                  <span className="font-bold text-slate-900">{selectedSubmission.department || (isWarehouse ? 'کۆگا و گواستنەوە' : 'فرۆشیار و کاشێر')}</span>
                </div>
              </div>

              {/* 🌟 EMPLOYEES DETAILED EVALUATION CARDS */}
              {selectedSubmission.employeeRatings && Object.keys(selectedSubmission.employeeRatings).length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>هەڵسەنگاندنی وردی سەرجەم کارمەندان (خاڵ لەسەر ٢٠ بۆ هەر پرسیارێک):</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(selectedSubmission.employeeRatings).map((er: any) => {
                      const sc = calculateEmployeeScoreBreakdown(er);
                      return (
                        <div key={er.employeeId} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                            <span className="font-black text-slate-900">{er.fullName || er.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                              {er.role}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-[11px] text-slate-700 font-semibold">
                            <div className="flex items-center justify-between">
                              <span>١. مامەڵە و ڕەفتار:</span>
                              <span className="font-mono text-emerald-600 font-black">{sc.q1Pts} / ٢٠</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>٢. هاوکاری بێ پێ وتن:</span>
                              <span className="font-mono text-blue-600 font-black">{sc.q2Pts} / ٢٠</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>٣. مۆبایل و پابەندبوون:</span>
                              <span className="font-mono text-purple-600 font-black">{sc.q3Pts} / ٢٠</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>٤. پاک و خاوێنی:</span>
                              <span className="font-mono text-amber-600 font-black">{sc.q4Pts} / ٢٠</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>٥. ڕەفتاری شوێنەکە:</span>
                              <span className="font-mono text-sky-700 font-black">
                                {sc.q5Pts} / ٢٠ {er.hasAnnoyingBehavior === 'yes' ? '(بەڵێ هەیەتی)' : '(نەخێر نییەتی)'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                              <span className="font-black text-slate-900">کۆی گشتی خاڵەکان:</span>
                              <span className="font-mono text-emerald-700 font-black text-xs px-2 py-0.5 bg-emerald-100 rounded-lg">
                                ٪{sc.totalPts} ({sc.totalPts} / ١٠٠ خاڵ)
                              </span>
                            </div>
                          </div>

                          {er.note5 && (
                            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 mt-1">
                              📝 <span className="font-bold">تێبینی پرسیاری ٥:</span> {er.note5}
                            </div>
                          )}

                          {er.comment && (
                            <div className="p-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-800 mt-1">
                              💬 <span className="font-bold">سەرنج:</span> {er.comment}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                        directLink = `${window.location.origin}/feedback?pin=${createPinResult.pin}`;
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
                        directUrl = `${window.location.origin}/feedback?pin=${p.pin}`;
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
