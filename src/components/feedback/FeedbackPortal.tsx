'use client';

import { ManagerEvaluationForm } from '@/components/feedback/ManagerEvaluationForm';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  Building2, 
  Sparkles, 
  KeyRound, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Star, 
  Sun, 
  Moon, 
  MessageSquareHeart, 
  Send, 
  Lock, 
  Phone, 
  User, 
  Users,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  LayoutGrid,
  X,
  Delete,
  Monitor,
  Tablet,
  Smartphone,
  MapPin,
  Boxes,
  ArrowRight,
  Plus
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { 
  TARGET_SALES_CASHIER_STAFF, 
  TARGET_WAREHOUSE_STAFF, 
  getSyncedFeedbackStaffList,
  FeedbackTargetEmployee,
  determinePinScope,
  PinScope 
} from '@/lib/feedback/feedback-service';
import { useAppContext } from '@/context/app-provider';
import { useToast } from '@/hooks/use-toast';
import {
  getClientSubmissionIds,
  recordSubmittedPinOnClient,
  clearClientSubmissionIds,
} from '@/lib/feedback/submitted-pins-client';

export interface FeedbackPortalProps {
  initialPin?: string;
  initialScope?: PinScope;
  isDark?: boolean;
  onSwitchPortal?: (portal: 'attendance' | 'feedback' | 'warehouse' | 'feedback_admin') => void;
  onBackToMobileApp?: () => void;
}

// ============================================================================
// 🌟 TACTILE RATING SCALES & OPTIONS (Manager Evaluation Style • No Stars!)
// ============================================================================
interface FeedbackScaleOption {
  value: number; // 1 to 5
  kurdishDigit: string;
  label: string;
  shortLabel: string;
}

const SCALE_STYLES: Record<number, {
  activeBg: string;
  activeBorder: string;
  activeText: string;
  ringColor: string;
  badgeBg: string;
}> = {
  1: {
    activeBg: 'bg-rose-500 text-white shadow-md shadow-rose-500/25',
    activeBorder: 'border-rose-500',
    activeText: 'text-rose-600 dark:text-rose-400',
    ringColor: 'ring-2 ring-rose-500/30',
    badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  2: {
    activeBg: 'bg-orange-500 text-white shadow-md shadow-orange-500/25',
    activeBorder: 'border-orange-500',
    activeText: 'text-orange-600 dark:text-orange-400',
    ringColor: 'ring-2 ring-orange-500/30',
    badgeBg: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
  3: {
    activeBg: 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25',
    activeBorder: 'border-amber-500',
    activeText: 'text-amber-600 dark:text-amber-400',
    ringColor: 'ring-2 ring-amber-500/30',
    badgeBg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  4: {
    activeBg: 'bg-sky-500 text-white shadow-md shadow-sky-500/25',
    activeBorder: 'border-sky-500',
    activeText: 'text-sky-600 dark:text-sky-400',
    ringColor: 'ring-2 ring-sky-500/30',
    badgeBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  },
  5: {
    activeBg: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25',
    activeBorder: 'border-emerald-500',
    activeText: 'text-emerald-600 dark:text-emerald-400',
    ringColor: 'ring-2 ring-emerald-500/30',
    badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
};

// ١. تا چەند لە ئەدا و هەڵسوکەوتی ڕازیت؟ (ڕەفتار و ڕێز گرتن)
const Q1_OPTIONS: FeedbackScaleOption[] = [
  { value: 1, kurdishDigit: '١', label: 'زۆر ناڕازیم', shortLabel: 'زۆر ناڕازیم' },
  { value: 2, kurdishDigit: '٢', label: 'ناڕازیم', shortLabel: 'ناڕازیم' },
  { value: 3, kurdishDigit: '٣', label: 'مامناوەند', shortLabel: 'مامناوەند' },
  { value: 4, kurdishDigit: '٤', label: 'ڕازیم', shortLabel: 'ڕازیم' },
  { value: 5, kurdishDigit: '٥', label: 'زۆر ڕازیم', shortLabel: 'زۆر ڕازیم' },
];

// ٢. لە کاتی پێویست دا بە بێ پێ وتن هاوکاریتان دەکات؟
const Q2_OPTIONS: FeedbackScaleOption[] = [
  { value: 1, kurdishDigit: '١', label: 'هەرگیز', shortLabel: 'هەرگیز' },
  { value: 2, kurdishDigit: '٢', label: 'زۆر کەم', shortLabel: 'زۆر کەم' },
  { value: 3, kurdishDigit: '٣', label: 'هەندێک جار', shortLabel: 'هەندێک جار' },
  { value: 4, kurdishDigit: '٤', label: 'زۆربەی کات', shortLabel: 'زۆربەی کات' },
  { value: 5, kurdishDigit: '٥', label: 'هەمیشە هاوکارە', shortLabel: 'هەمیشە' },
];

// ٣. لە کاتی کارکردن مۆبایل بەکار دێنێت بۆ کار و باری خۆی؟
const Q3_OPTIONS: FeedbackScaleOption[] = [
  { value: 1, kurdishDigit: '١', label: 'بەردەوام', shortLabel: 'بەردەوام' },
  { value: 2, kurdishDigit: '٢', label: 'زۆربەی کات', shortLabel: 'زۆربەی کات' },
  { value: 3, kurdishDigit: '٣', label: 'مامناوەند', shortLabel: 'مامناوەند' },
  { value: 4, kurdishDigit: '٤', label: 'زۆر بە دەگمەن', shortLabel: 'زۆر دەگمەن' },
  { value: 5, kurdishDigit: '٥', label: 'هەرگیز بەکار ناهێنێت', shortLabel: 'هەرگیز' },
];

// ٤. تا چەند گرنگی دە دات بە پاک و خاوێنی خۆی و شوێنەکە؟
const Q4_OPTIONS: FeedbackScaleOption[] = [
  { value: 1, kurdishDigit: '١', label: 'گرنگی نادات', shortLabel: 'گرنگی نادات' },
  { value: 2, kurdishDigit: '٢', label: 'کەم', shortLabel: 'کەم' },
  { value: 3, kurdishDigit: '٣', label: 'مامناوەند', shortLabel: 'مامناوەند' },
  { value: 4, kurdishDigit: '٤', label: 'باشە', shortLabel: 'باشە' },
  { value: 5, kurdishDigit: '٥', label: 'زۆر نایابە', shortLabel: 'زۆر نایاب' },
];

// 🪄 PowerPoint Morph Transition Variants (Framer Motion)
const morphVariants: Variants = {
  enter: (custom: any) => {
    const dir = typeof custom === 'object' && custom !== null ? custom.dir : (Number(custom) || 1);
    const idx = typeof custom === 'object' && custom !== null ? custom.idx : 0;
    const angleVariant = Math.abs(idx) % 3;
    const yOffset = angleVariant === 1 ? 20 : angleVariant === 2 ? -20 : 0;
    const rot = angleVariant === 1 ? (dir > 0 ? 1 : -1) : angleVariant === 2 ? (dir > 0 ? -1 : 1) : 0;

    return {
      x: dir > 0 ? 90 : -90,
      y: yOffset,
      opacity: 0,
      scale: 0.94,
      rotate: rot,
      filter: 'blur(8px)',
    };
  },
  center: {
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    rotate: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 26,
      mass: 0.8,
    },
  },
  exit: (custom: any) => {
    const dir = typeof custom === 'object' && custom !== null ? custom.dir : (Number(custom) || 1);
    const idx = typeof custom === 'object' && custom !== null ? custom.idx : 0;
    const yOffset = (idx % 2 === 0 ? -12 : 12);
    return {
      x: dir > 0 ? -90 : 90,
      y: yOffset,
      opacity: 0,
      scale: 0.94,
      filter: 'blur(8px)',
      transition: {
        duration: 0.22,
        ease: [0.32, 0, 0.67, 0],
      },
    };
  },
};

export function FeedbackPortal({ 
  initialPin = '', 
  initialScope,
  isDark: initialDark = false,
  onSwitchPortal,
  onBackToMobileApp
}: FeedbackPortalProps) {
  const { toast } = useToast();
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      if (saved) return saved === 'dark';
    }
    return initialDark;
  });

  const toggleTheme = () => {
    triggerHaptic('light');
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('ashley-theme-change', { detail: { isDark: next } }));
    }
  };

  useEffect(() => {
    if (initialDark !== undefined) {
      setIsDark(initialDark);
    }
  }, [initialDark]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleTheme = (e: any) => {
        if (e?.detail?.isDark !== undefined) {
          setIsDark(e.detail.isDark);
        }
      };
      window.addEventListener('ashley-theme-change', handleTheme);
      return () => window.removeEventListener('ashley-theme-change', handleTheme);
    }
  }, []);

  // Step state: 'pin_gate' | 'questionnaire' | 'manager_evaluation' | 'success'
  const [step, setStep] = useState<'pin_gate' | 'questionnaire' | 'manager_evaluation' | 'success'>('pin_gate');
  const [managerPin, setManagerPin] = useState<string>('');

  // Active Scope ('warehouse_staff_feedback' vs 'sales_cashier_feedback')
  const [activeScope, setActiveScope] = useState<PinScope | null>(() => {
    if (initialScope) return initialScope;
    if (initialPin) return determinePinScope(initialPin);
    return null;
  });

  // PIN state
  const [pin, setPin] = useState<string>(initialPin);
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAlreadySubmitted, setPinAlreadySubmitted] = useState<boolean>(false);
  const [verifiedPinData, setVerifiedPinData] = useState<any | null>(null);

  // Evaluator Name (optional)
  const [respondentName, setRespondentName] = useState<string>('');

  // 🔄 LIVE SYNCHRONIZATION WITH EMPLOYEES SECTION (سایجیک بە بەشی کارمەندان)
  const { employees } = useAppContext();

  // Dynamic Staff Group Detection
  const isWarehouse = 
    activeScope === 'warehouse_staff_feedback' || 
    (Boolean(pin) && /^\d+$/.test(pin) && parseInt(pin, 10) >= 5000 && parseInt(pin, 10) <= 7500);

  const targetStaffList: FeedbackTargetEmployee[] = useMemo(() => {
    return getSyncedFeedbackStaffList(isWarehouse ? 'warehouse' : 'sales', employees);
  }, [isWarehouse, employees]);

  // 🌟 Employee Ratings: ALL 4 STARS START AT 0 (UNSELECTED) + Q5 BEHAVIOR CHECK
  // "پرسیاری پێنچەم لە وێنەکە کە ناردوومە نووسیوومە: ئایا هیچ ڕەفتارێکی بێزار کەر هەیە لەگەڵ شوێنەکە نەگونجێت؟"
  const [employeeRatings, setEmployeeRatings] = useState<Record<string, {
    serviceRating: number;      // 0 = unselected (1-5)
    performanceRating: number;  // 0 = unselected (1-5)
    disciplineRating: number;   // 0 = unselected (1-5)
    overallRating: number;      // 0 = unselected (1-5)
    hasAnnoyingBehavior: 'yes' | 'no' | null; // null = unselected, 'yes' | 'no'
    annoyingPoint1: string;     // خاڵی ١ (پێویستە ئەگەر بەڵێ بێت)
    annoyingPoint2: string;     // خاڵی ٢ (ئارەزوومەندانە)
    annoyingPoint3: string;     // خاڵی ٣ (ئارەزوومەندانە)
    comment: string;
    teamworkRating?: number;
    note5?: string;
  }>>(() => {
    const initial: any = {};
    const allKnown = [...getSyncedFeedbackStaffList('sales'), ...getSyncedFeedbackStaffList('warehouse')];
    allKnown.forEach(emp => {
      initial[emp.employeeId] = {
        serviceRating: 0,
        performanceRating: 0,
        disciplineRating: 0,
        overallRating: 0,
        hasAnnoyingBehavior: null,
        annoyingPoint1: '',
        annoyingPoint2: '',
        annoyingPoint3: '',
        comment: '',
        teamworkRating: 0,
        note5: '',
      };
    });
    return initial;
  });

  // Keep ratings record synchronized with any dynamic additions to targetStaffList
  useEffect(() => {
    setEmployeeRatings((prev) => {
      let changed = false;
      const next = { ...prev };
      targetStaffList.forEach((emp) => {
        if (!next[emp.employeeId]) {
          next[emp.employeeId] = {
            serviceRating: 0,
            performanceRating: 0,
            disciplineRating: 0,
            overallRating: 0,
            hasAnnoyingBehavior: null,
            annoyingPoint1: '',
            annoyingPoint2: '',
            annoyingPoint3: '',
            comment: '',
            teamworkRating: 0,
            note5: '',
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [targetStaffList]);

  // 💡 داوای پێشنیاری چی ئەکرێ بۆ باشتر کردن: بە سێ خاڵ
  const [improvementPoint1, setImprovementPoint1] = useState<string>('');
  const [improvementPoint2, setImprovementPoint2] = useState<string>('');
  const [improvementPoint3, setImprovementPoint3] = useState<string>('');

  // General store suggestions
  const [generalSuggestions, setGeneralSuggestions] = useState<string>('');

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [highlightedEmpId, setHighlightedEmpId] = useState<string | null>(null);

  // Helper: check if a specific employee is complete
  // (Questions 1-4 selected > 0, and Q5 answered: if 'no' complete; if 'yes' point 1 required)
  const isEmployeeComplete = (empId: string) => {
    const r = employeeRatings[empId];
    if (!r) return false;
    const starsDone = (
      r.serviceRating > 0 && 
      r.performanceRating > 0 && 
      r.disciplineRating > 0 && 
      r.overallRating > 0
    );
    if (!starsDone) return false;
    if (r.hasAnnoyingBehavior === 'no') return true;
    if (r.hasAnnoyingBehavior === 'yes') {
      return Boolean(r.annoyingPoint1 && r.annoyingPoint1.trim().length > 0);
    }
    return false;
  };

  // Helper: count remaining questions for an employee
  const getRemainingQuestionsCount = (empId: string) => {
    const r = employeeRatings[empId];
    if (!r) return 5;
    let count = 0;
    if (r.serviceRating === 0) count++;
    if (r.performanceRating === 0) count++;
    if (r.disciplineRating === 0) count++;
    if (r.overallRating === 0) count++;
    if (r.hasAnnoyingBehavior === null) {
      count++;
    } else if (r.hasAnnoyingBehavior === 'yes' && (!r.annoyingPoint1 || !r.annoyingPoint1.trim())) {
      count++;
    }
    return count;
  };

  // 🪄 PowerPoint Morph Slide Mode state
  const [currentEmpIndex, setCurrentEmpIndex] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<number>(1); // 1 = forward, -1 = backward
  const [viewMode, setViewMode] = useState<'slide' | 'grid'>('slide'); // 'slide' (PowerPoint Morph) vs 'grid' (all cards)

  // 🔒 هەنگاونان بۆ کارمەندی دواتر: "تا کارمەندێک تەواو نەکەن نەچنە سەر کارمەندی تر"
  const goToNextSlide = () => {
    if (currentEmpIndex < targetStaffList.length) {
      const currentEmp = targetStaffList[currentEmpIndex];
      if (!isEmployeeComplete(currentEmp.employeeId)) {
        triggerHaptic('error');
        playAudioChime(false);
        setHighlightedEmpId(currentEmp.employeeId);
        const rem = getRemainingQuestionsCount(currentEmp.employeeId);
        toast({
          variant: 'destructive',
          title: '⚠️ کارمەندەکە تەواو نەکراوە',
          description: `تکایە سەرەتا سەرجەم پرسیارەکانی ${currentEmp.name} وەڵام بدەوە (${rem} پرسیار ماوە) پێش ئەوەی بچیتە سەر کارمەندی دواتر.`
        });
        return;
      }
    }

    setHighlightedEmpId(null);
    triggerHaptic('light');
    playAudioChime(true);
    setSlideDirection(1);
    setCurrentEmpIndex((prev) => Math.min(prev + 1, targetStaffList.length));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  const goToPrevSlide = () => {
    setHighlightedEmpId(null);
    triggerHaptic('light');
    playAudioChime(true);
    setSlideDirection(-1);
    setCurrentEmpIndex((prev) => Math.max(prev - 1, 0));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  // 🔒 پشکنینی ڕێگری لە بازدانی کارمەند: ناچێتە سەر کارمەندی تر تاوەکو کارمەندی پێشوو تەواو نەبێت
  const goToSlideIndex = (index: number) => {
    if (index > currentEmpIndex) {
      // پشکنینی ئەوەی ئایا هیچ کارمەندێک لە پێش ئەم هەڵبژاردنەدا ماوەتەوە تەواو نەکرابێت
      const firstIncompleteIdx = targetStaffList.findIndex(
        (emp, i) => i < index && !isEmployeeComplete(emp.employeeId)
      );
      if (firstIncompleteIdx !== -1) {
        triggerHaptic('error');
        playAudioChime(false);
        const incEmp = targetStaffList[firstIncompleteIdx];
        setHighlightedEmpId(incEmp.employeeId);
        setSlideDirection(firstIncompleteIdx > currentEmpIndex ? 1 : -1);
        setCurrentEmpIndex(firstIncompleteIdx);
        const rem = getRemainingQuestionsCount(incEmp.employeeId);
        toast({
          variant: 'destructive',
          title: '⚠️ پێویستە ئەم کارمەندە تەواو بکرێت',
          description: `تا هەڵسەنگاندنی ${incEmp.name} بە تەواوی پڕنەکەیتەوە (${rem} پرسیار ماوە)، ناتوانیت باز بدەیتە سەر کارمەندانی تر.`
        });
        return;
      }
    }

    setHighlightedEmpId(null);
    triggerHaptic('light');
    playAudioChime(true);
    setSlideDirection(index > currentEmpIndex ? 1 : -1);
    setCurrentEmpIndex(index);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  // Auto-verify if initialPin is provided via URL
  useEffect(() => {
    if (initialPin && /^\d{4}$/.test(initialPin)) {
      handleVerifyPin(initialPin);
    }
  }, [initialPin]);

  // Physical Keyboard listener for PC / Tablet users
  useEffect(() => {
    if (step !== 'pin_gate') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          const next = pin + e.key;
          setPin(next);
          setPinError(null);
          if (next.length === 4) {
            setTimeout(() => handleVerifyPin(next), 120);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setPinError(null);
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleVerifyPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, pin]);

  // Audio Chime helper
  const playAudioChime = (success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioCtx gesture policy
    }
  };

  // 1. PIN Verification
  const handleVerifyPin = async (pinCandidate?: string) => {
    const pinToTest = (pinCandidate || pin).trim();
    if (!pinToTest || !/^\d{4}$/.test(pinToTest)) {
      setPinAlreadySubmitted(false);
      setPinError('تکایە کۆدی چوار ژمارەیی بنووسە.');
      triggerHaptic('error');
      playAudioChime(false);
      return;
    }

    setPinVerifying(true);
    setPinError(null);
    setPinAlreadySubmitted(false);

    try {
      const res = await fetch('/api/feedback/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinToTest,
          clientSubmissionIds: getClientSubmissionIds(pinToTest),
        }),
      });

      const data = await res.json();
      if (data.valid && data.pinData) {
        clearClientSubmissionIds(pinToTest);
        setPinAlreadySubmitted(false);
        const scopeFound = data.scope || data.pinData?.scope || determinePinScope(pinToTest);
        setActiveScope(scopeFound);

        // 📝 If this is a Manager Evaluation PIN (0000 - 4999), open confidential Manager Evaluation Form
        if (data.scope === 'manager_feedback' || scopeFound === 'manager_feedback') {
          triggerHaptic('success');
          playAudioChime(true);
          setManagerPin(pinToTest);
          setStep('manager_evaluation');
          return;
        }

        setVerifiedPinData(data.pinData);
        if (data.pinData.targetName) {
          setRespondentName(data.pinData.targetName);
        }
        triggerHaptic('success');
        playAudioChime(true);
        setStep('questionnaire');
      } else {
        const alreadyDone = Boolean(data.alreadySubmitted);
        setPinAlreadySubmitted(alreadyDone);
        setPinError(
          data.error ||
            (alreadyDone
              ? 'تۆ فیدباکت کردووە، دەست خۆش بێت!'
              : 'کۆدی PIN هەڵەیە یان ڕێگەی پێنەدراوە.')
        );
        triggerHaptic('error');
        playAudioChime(false);
        setPin('');
      }
    } catch (err: any) {
      setPinAlreadySubmitted(false);
      setPinError('هەڵە لە پەیوەندی کردن بە سێرڤەر.');
      triggerHaptic('error');
      playAudioChime(false);
    } finally {
      setPinVerifying(false);
    }
  };

  // Keypad press handler
  const handleKeypadPress = (digit: string) => {
    triggerHaptic('light');
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(null);
      setPinAlreadySubmitted(false);
      if (nextPin.length === 4) {
        setTimeout(() => handleVerifyPin(nextPin), 150);
      }
    }
  };

  const handleKeypadDelete = () => {
    triggerHaptic('light');
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
    setPinAlreadySubmitted(false);
  };

  // 2. Rating handler for a specific employee
  const handleRatingChange = (
    empId: string, 
    field: 'serviceRating' | 'performanceRating' | 'disciplineRating' | 'overallRating' | 'teamworkRating', 
    val: number
  ) => {
    triggerHaptic('light');
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: val,
      },
    }));
    setSubmitError(null);
  };

  const handleAnnoyingToggle = (empId: string, val: 'yes' | 'no') => {
    triggerHaptic('medium');
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        hasAnnoyingBehavior: val,
        // If switched to 'no', clear annoying points
        ...(val === 'no' ? { annoyingPoint1: '', annoyingPoint2: '', annoyingPoint3: '' } : {}),
      },
    }));
    setSubmitError(null);
  };

  const handleAnnoyingPointChange = (empId: string, pointIndex: 1 | 2 | 3, text: string) => {
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [`annoyingPoint${pointIndex}`]: text,
      },
    }));
    setSubmitError(null);
  };

  const handleCommentChange = (empId: string, text: string) => {
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        comment: text,
      },
    }));
  };

  const handleNote5Change = (empId: string, text: string) => {
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        note5: text,
      },
    }));
  };

  // Completion metrics
  const completedCount = targetStaffList.filter((e) => isEmployeeComplete(e.employeeId)).length;
  const totalEmployeesCount = targetStaffList.length;
  const areAllEmployeesComplete = completedCount === totalEmployeesCount;
  const isImprovementComplete = improvementPoint1.trim().length > 0;
  const isAllComplete = areAllEmployeesComplete && isImprovementComplete;
  const progressPercent = Math.round((completedCount / totalEmployeesCount) * 100);

  // 3. Submit Response Handler
  const handleSubmitFeedback = async () => {
    if (!areAllEmployeesComplete) {
      triggerHaptic('error');
      playAudioChime(false);
      const firstIncompleteIdx = targetStaffList.findIndex((e) => !isEmployeeComplete(e.employeeId));
      if (firstIncompleteIdx !== -1) {
        const firstIncomplete = targetStaffList[firstIncompleteIdx];
        if (viewMode === 'slide') {
          setSlideDirection(firstIncompleteIdx > currentEmpIndex ? 1 : -1);
          setCurrentEmpIndex(firstIncompleteIdx);
        }
        setHighlightedEmpId(firstIncomplete.employeeId);
        const el = document.getElementById(`emp-card-${firstIncomplete.employeeId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSubmitError(`تکایە سەرجەم پرسیارەکانی کارمەند (${firstIncomplete.name}) تەواو بکە.`);
        setTimeout(() => setHighlightedEmpId(null), 3500);
      }
      return;
    }

    if (!isImprovementComplete) {
      triggerHaptic('error');
      playAudioChime(false);
      if (viewMode === 'slide') {
        setSlideDirection(1);
        setCurrentEmpIndex(targetStaffList.length);
      }
      const el = document.getElementById('improvement-suggestions-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setSubmitError('تکایە خاڵی یەکەمی پێشنیاری باشترکردن بنووسە.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formattedRatings: Record<string, any> = {};
      targetStaffList.forEach((emp) => {
        const r = employeeRatings[emp.employeeId];
        formattedRatings[emp.employeeId] = {
          employeeId: emp.employeeId,
          name: emp.name,
          fullName: emp.fullName,
          role: emp.role,
          photoUrl: emp.photoUrl,
          serviceRating: r.serviceRating,
          performanceRating: r.performanceRating,
          disciplineRating: r.disciplineRating,
          overallRating: r.overallRating,
          hasAnnoyingBehavior: r.hasAnnoyingBehavior,
          annoyingPoint1: r.annoyingPoint1?.trim() || undefined,
          annoyingPoint2: r.annoyingPoint2?.trim() || undefined,
          annoyingPoint3: r.annoyingPoint3?.trim() || undefined,
          teamworkRating: r.overallRating, // fallback compatibility
          comment: r.comment?.trim() || undefined,
          note5: r.annoyingPoint1?.trim() || undefined,
        };
      });

      const combinedSuggestions = [
        improvementPoint1.trim() ? `خاڵی ١: ${improvementPoint1.trim()}` : '',
        improvementPoint2.trim() ? `خاڵی ٢: ${improvementPoint2.trim()}` : '',
        improvementPoint3.trim() ? `خاڵی ٣: ${improvementPoint3.trim()}` : '',
        generalSuggestions.trim() ? `سەرنجی گشتی: ${generalSuggestions.trim()}` : '',
      ].filter(Boolean).join('\n');

      const payload = {
        pin,
        respondentName: respondentName?.trim() || undefined,
        department: isWarehouse ? 'کۆگا و گواستنەوە' : 'فرۆشیار و کاشێر',
        employeeRatings: formattedRatings,
        improvementPoint1: improvementPoint1.trim() || undefined,
        improvementPoint2: improvementPoint2.trim() || undefined,
        improvementPoint3: improvementPoint3.trim() || undefined,
        suggestionsForManagement: combinedSuggestions || undefined,
        clientSubmissionIds: getClientSubmissionIds(pin),
      };

      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        playAudioChime(true);
        recordSubmittedPinOnClient(pin, data.submission?.id || '');
        setStep('success');
      } else {
        setSubmitError(data.error || 'نەتوانرا فیدباکەکە تۆمار بکرێت.');
        triggerHaptic('error');
        playAudioChime(false);
      }
    } catch (err: any) {
      setSubmitError('هەڵە لە پەیوەندی کردن بە سێرڤەر.');
      triggerHaptic('error');
      playAudioChime(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 🌟 Tactile Choice Selector Component (Manager Evaluation Style • No Stars!)
  const TactileChoiceSelector = ({ 
    questionNum,
    label, 
    value, 
    options,
    onChange 
  }: { 
    questionNum: string;
    label: string; 
    value: number; // 0 to 5
    options: FeedbackScaleOption[];
    onChange: (val: number) => void;
  }) => {
    const selectedOpt = options.find((o) => o.value === value);
    const selectedStyle = value > 0 ? SCALE_STYLES[value] : null;

    return (
      <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
        value === 0 
          ? isDark ? 'bg-neutral-900/50 border-amber-500/30 shadow-2xs' : 'bg-amber-50/40 border-amber-200/60 shadow-2xs'
          : isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-slate-50 border-slate-200/80'
      }`}>
        {/* Header with question number, label, and live status badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span
              className={`w-6 h-6 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                value > 0
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : isDark
                  ? 'bg-neutral-800 text-amber-400'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {value > 0 ? <Check className="w-3.5 h-3.5" /> : questionNum}
            </span>
            <span className={`text-xs sm:text-[13px] font-bold leading-snug ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
              {label}
            </span>
          </div>

          <div className="shrink-0 text-left">
            {selectedOpt && selectedStyle ? (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border ${selectedStyle.badgeBg}`}
              >
                <span className="font-mono">{selectedOpt.kurdishDigit}</span>
                <span>—</span>
                <span>{selectedOpt.shortLabel}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                وەڵام نەدراوە
              </span>
            )}
          </div>
        </div>

        {/* 5 Tactile Option Buttons (Manager Evaluation Style) */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full mt-2" dir="rtl">
          {options.map((opt) => {
            const active = value === opt.value;
            const style = SCALE_STYLES[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  playAudioChime(true);
                  onChange(opt.value);
                }}
                className={`min-h-[50px] sm:min-h-[54px] px-1 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none transition-all duration-150 active:scale-92 ${
                  active
                    ? `${style.activeBg} ${style.activeBorder} ring-2 ${style.ringColor} scale-[1.02] font-black shadow-sm`
                    : isDark
                    ? 'bg-neutral-950/75 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
                aria-pressed={active}
                title={`${opt.kurdishDigit}: ${opt.label}`}
              >
                <span className="text-sm sm:text-base font-mono font-black leading-none">
                  {opt.kurdishDigit}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold leading-tight text-center line-clamp-1">
                  {opt.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // 🌟 Render Individual Employee Card (Shared by Slide Mode and Grid Mode)
  const renderEmployeeCard = (emp: typeof targetStaffList[0], index: number, isSlide: boolean = false) => {
    const ratings = employeeRatings[emp.employeeId] || {
      serviceRating: 0,
      performanceRating: 0,
      disciplineRating: 0,
      overallRating: 0,
      hasAnnoyingBehavior: null,
      annoyingPoint1: '',
      annoyingPoint2: '',
      annoyingPoint3: '',
      comment: '',
      teamworkRating: 0,
      note5: '',
    };
    const complete = isEmployeeComplete(emp.employeeId);
    const remaining = getRemainingQuestionsCount(emp.employeeId);
    const isHighlighted = highlightedEmpId === emp.employeeId;

    return (
      <div
        key={emp.employeeId}
        id={`emp-card-${emp.employeeId}`}
        className={`rounded-3xl border transition-all duration-300 ${
          isSlide 
            ? `${isHighlighted ? 'ring-4 ring-amber-500/70 border-amber-500 shadow-amber-500/20' : ''} ${isDark ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white border-slate-200/95'} p-5 sm:p-7 shadow-2xl backdrop-blur-xl`
            : `p-4 sm:p-5 flex flex-col justify-between ${
                isHighlighted
                  ? 'ring-3 ring-amber-500 border-amber-500 scale-[1.01]'
                  : complete
                  ? isDark ? 'bg-neutral-900/90 border-emerald-500/30 shadow-md' : 'bg-white border-emerald-500/30 shadow-md'
                  : isDark ? 'bg-neutral-900/70 border-neutral-800 shadow-xs' : 'bg-white border-slate-200/90 shadow-xs'
              }`
        }`}
      >
        <div>
          {/* Employee Identity Header */}
          <div className={`flex items-center justify-between pb-4 mb-4 border-b ${
            isDark ? 'border-neutral-800' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className={`${isSlide ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-14 h-14 sm:w-16 sm:h-16'} rounded-2xl overflow-hidden bg-black border-2 border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm relative group`}>
                <img 
                  src={emp.photoUrl || '/ashley-icon.jpg'} 
                  alt={emp.name} 
                  loading="eager"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('ashley-icon.jpg')) {
                      target.src = '/ashley-icon.jpg';
                    }
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 shrink-0">
                    #{index + 1}
                  </span>
                  <h3 className={`${isSlide ? 'text-base sm:text-xl' : 'text-sm sm:text-base'} font-black text-slate-900 dark:text-white truncate`}>
                    {emp.fullName}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 shrink-0">
                    {emp.role}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono text-slate-400">
                    کۆد: {emp.employeeId}
                  </span>
                </div>
              </div>
            </div>

            {/* Card Completion Badge */}
            <div className="text-left shrink-0">
              {complete ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-xs font-black shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                  <span>تەواو بوو</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] sm:text-xs font-bold">
                  <span>{remaining} پرسیار ماوە</span>
                </span>
              )}
            </div>
          </div>

          {/* 🌟 4 Tactile Questions (Manager Evaluation Style • No Stars!) */}
          <div className="space-y-3.5">
            {/* ١. تا چەند لە ئەدا و هەڵسوکەوتی ڕازیت؟ (ڕەفتار و ڕێز گرتن) */}
            <TactileChoiceSelector
              questionNum="١"
              label="١. تا چەند لە ئەدا و هەڵسوکەوتی ڕازیت؟ (ڕەفتار و ڕێز گرتن)"
              value={ratings.serviceRating}
              options={Q1_OPTIONS}
              onChange={(val) => handleRatingChange(emp.employeeId, 'serviceRating', val)}
            />

            {/* ٢. لە کاتی پێویست دا بە بێ پێ وتن هاوکاریتان دەکات؟ */}
            <TactileChoiceSelector
              questionNum="٢"
              label="٢. لە کاتی پێویست دا بە بێ پێ وتن هاوکاریتان دەکات؟"
              value={ratings.performanceRating}
              options={Q2_OPTIONS}
              onChange={(val) => handleRatingChange(emp.employeeId, 'performanceRating', val)}
            />

            {/* ٣. لە کاتی کارکردن مۆبایل بەکار دێنێت بۆ کار و باری خۆی؟ */}
            <TactileChoiceSelector
              questionNum="٣"
              label="٣. لە کاتی کارکردن مۆبایل بەکار دێنێت بۆ کار و باری خۆی؟"
              value={ratings.disciplineRating}
              options={Q3_OPTIONS}
              onChange={(val) => handleRatingChange(emp.employeeId, 'disciplineRating', val)}
            />

            {/* ٤. تا چەند گرنگی دە دات بە پاک و خاوێنی خۆی و شوێنەکە؟ */}
            <TactileChoiceSelector
              questionNum="٤"
              label="٤. تا چەند گرنگی دە دات بە پاک و خاوێنی خۆی و شوێنەکە؟"
              value={ratings.overallRating}
              options={Q4_OPTIONS}
              onChange={(val) => handleRatingChange(emp.employeeId, 'overallRating', val)}
            />

            {/* ٥. پرسیاری پێنجەم: هیچ ڕەفتارێکی بێزارکەر یان نەگونجاو هەیە کە لەگەڵ شوێنەکە یەک ناگرێتەوە؟ */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              ratings.hasAnnoyingBehavior === null
                ? isDark ? 'bg-neutral-900/50 border-amber-500/30 shadow-2xs' : 'bg-amber-50/40 border-amber-200/60 shadow-2xs'
                : ratings.hasAnnoyingBehavior === 'yes'
                ? isDark ? 'bg-rose-950/20 border-rose-500/30' : 'bg-rose-50/50 border-rose-200'
                : isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-slate-50 border-slate-200/80'
            }`}>
              <div className="flex items-center justify-between mb-2.5">
                <span className={`text-xs sm:text-sm font-black ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                  ٥. هیچ ڕەفتارێکی بێزارکەر یان نەگونجاو هەیە کە لەگەڵ شوێنەکە یەک ناگرێتەوە؟
                </span>
                <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full transition-all ${
                  ratings.hasAnnoyingBehavior === null
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                    : ratings.hasAnnoyingBehavior === 'yes'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold'
                }`}>
                  {ratings.hasAnnoyingBehavior === null ? 'وەڵام نەدراوە' : ratings.hasAnnoyingBehavior === 'yes' ? 'بەڵێ، هەیەتی' : 'نەخێر، نییەتی'}
                </span>
              </div>

              {/* دوو دوگمەی نەخێر نییەتی / بەڵێ هەیەتی */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => handleAnnoyingToggle(emp.employeeId, 'no')}
                  className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                    ratings.hasAnnoyingBehavior === 'no'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                      : isDark
                      ? 'bg-neutral-950/70 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>نەخێر نییەتی</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAnnoyingToggle(emp.employeeId, 'yes')}
                  className={`h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
                    ratings.hasAnnoyingBehavior === 'yes'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-md ring-2 ring-rose-500/30'
                      : isDark
                      ? 'bg-neutral-950/70 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>بەڵێ هەیەتی</span>
                </button>
              </div>

              {/* ئەگەر نەخێر نییەتی: پێویست ناکات تێبینی بنووسێ */}
              {ratings.hasAnnoyingBehavior === 'no' && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>نەخێر نییەتی (پێویست ناکات تێبینی بنووسرێت).</span>
                </p>
              )}

              {/* ئەگەر بەڵێ هەیەتی: داوای نووسین بە ٣ خاڵ */}
              {ratings.hasAnnoyingBehavior === 'yes' && (
                <div className="mt-3 pt-2.5 border-t border-rose-500/20 space-y-2.5">
                  <label className="block text-xs font-black text-rose-600 dark:text-rose-400">
                    تکایە ڕەفتارە نەگونجاوەکە بە خاڵ بنووسە (تا ٣ خاڵ):
                  </label>

                  {/* خاڵی ١ (پێویستە) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-neutral-300">
                        خاڵی ١ <span className="text-rose-500 font-black">* پێویستە</span>
                      </span>
                      {ratings.annoyingPoint1?.trim() && (
                        <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> تەواوە
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={ratings.annoyingPoint1 || ''}
                      onChange={(e) => handleAnnoyingPointChange(emp.employeeId, 1, e.target.value)}
                      placeholder={`خاڵی یەکەمی ڕەفتاری نەگونجاوی ${emp.name}...`}
                      className={`w-full h-10 px-3 text-xs rounded-xl border outline-none transition-all ${
                        !ratings.annoyingPoint1?.trim()
                          ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30 text-slate-900 dark:text-white'
                          : isDark
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                  </div>

                  {/* خاڵی ٢ (ئارەزوومەندانە) */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 mb-1">
                      خاڵی ٢ (ئارەزوومەندانە)
                    </span>
                    <input
                      type="text"
                      value={ratings.annoyingPoint2 || ''}
                      onChange={(e) => handleAnnoyingPointChange(emp.employeeId, 2, e.target.value)}
                      placeholder="خاڵی دووەم (ئەگەر هەبێت)..."
                      className={`w-full h-10 px-3 text-xs rounded-xl border outline-none transition-all ${
                        isDark
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                  </div>

                  {/* خاڵی ٣ (ئارەزوومەندانە) */}
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-neutral-400 mb-1">
                      خاڵی ٣ (ئارەزوومەندانە)
                    </span>
                    <input
                      type="text"
                      value={ratings.annoyingPoint3 || ''}
                      onChange={(e) => handleAnnoyingPointChange(emp.employeeId, 3, e.target.value)}
                      placeholder="خاڵی سێیەم (ئەگەر هەبێت)..."
                      className={`w-full h-10 px-3 text-xs rounded-xl border outline-none transition-all ${
                        isDark
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-amber-500'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Optional Comment for this employee */}
            <div className="pt-1">
              <input
                type="text"
                value={ratings.comment || ''}
                onChange={(e) => handleCommentChange(emp.employeeId, e.target.value)}
                placeholder={`سەرنج یان تێبینی گشتی لەسەر ${emp.name} (ئارەزوومەندانە)...`}
                className={`w-full h-10 px-3.5 text-xs rounded-xl border outline-none transition-all ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none ${
      isDark ? 'bg-black text-white' : 'bg-[#f2f2f7] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱💻 FULL-SCREEN ADAPTIVE CONTAINER (Mobile, Tablet, Desktop) */}
      <div className="w-full min-h-[100dvh] flex flex-col justify-between p-3.5 sm:p-6 lg:p-8 xl:p-10 2xl:px-14 pt-safe pb-safe transition-all">

        {/* 1. TOP HEADER (Pure & Clean • Full-width) */}
        <header className="w-full pt-2 pb-3.5 flex items-center justify-between border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center ${isDark ? 'bg-black' : 'bg-white'}`}>
                <MessageSquareHeart className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              </div>
            </div>

            <div>
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                فیدباک و هەڵسەنگاندنی ئاشڵی
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 font-medium">
                هەڵسەنگاندنی فەرمی سەرجەم کارمەندانی فرۆشیار و کاشێر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Switch to Attendance or Warehouse */}
            {(onSwitchPortal || onBackToMobileApp) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    if (onBackToMobileApp) onBackToMobileApp();
                    else if (onSwitchPortal) onSwitchPortal('attendance');
                  }}
                  className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                    isDark 
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                  title="گەڕانەوە بۆ دەوامی مۆبایل"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden xs:inline">دەوام</span>
                </button>

                {onSwitchPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      onSwitchPortal('warehouse');
                    }}
                    className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                      isDark 
                        ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30' 
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                    title="چوون بۆ جەرد و بار داگرتن"
                  >
                    <Boxes className="w-3.5 h-3.5 text-blue-500" />
                    <span className="hidden xs:inline">جەردەکە</span>
                  </button>
                )}
              </div>
            )}

            {step === 'questionnaire' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-[11px] sm:text-xs font-mono font-bold shadow-2xs">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>PIN: {pin}</span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark 
                  ? 'bg-neutral-900 border border-neutral-800 text-amber-400 hover:bg-neutral-800' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="گۆڕینی ڕەنگ"
            >
              {isDark ? <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
            </button>
          </div>
        </header>

        {/* ===================================================================== */}
        {/* 🔒 SCREEN 1: 4-DIGIT PIN GATE (FULL-SCREEN ADAPTIVE) */}
        {/* ===================================================================== */}
        {step === 'manager_evaluation' && (
          <ManagerEvaluationForm
            pin={managerPin}
            isDark={isDark}
            onResetToPinGate={() => {
              setManagerPin('');
              setStep('pin_gate');
            }}
            onSubmissionSuccess={() => {
              setManagerPin('');
            }}
            onBackToHub={onBackToMobileApp}
          />
        )}

        {step === 'pin_gate' && (
          <div className="my-auto py-6 sm:py-10 flex flex-col items-center justify-center w-full">
            <div className={`w-full max-w-4xl lg:max-w-5xl p-6 sm:p-10 lg:p-12 rounded-[36px] border shadow-2xl backdrop-blur-2xl transition-all ${
              isDark 
                ? 'bg-neutral-900/80 border-neutral-800 shadow-black/60' 
                : 'bg-white/90 border-slate-200/90 shadow-slate-200/60'
            }`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
                
                {/* RIGHT COLUMN (RTL): BRANDING & INSTRUCTIONS */}
                <div className="flex flex-col items-center md:items-start text-center md:text-right space-y-4">
                  <div className="relative">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[30px] bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center">
                      <div className={`w-full h-full rounded-[28px] flex items-center justify-center ${
                        isDark ? 'bg-neutral-950' : 'bg-white'
                      }`}>
                        <MessageSquareHeart className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500" />
                      </div>
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <KeyRound className="w-4.5 h-4.5" />
                    </div>
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>فیدباکی فەرمی ئاشڵی هۆم ستۆر</span>
                    </span>
                    <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      داخڵبوونی فیدباک بە کۆدی PIN
                    </h2>
                    <p className={`text-xs sm:text-sm font-semibold leading-relaxed mt-2 ${
                      isDark ? 'text-neutral-400' : 'text-slate-600'
                    }`}>
                      تکایە کۆدی ٤ ژمارەیی بنووسە بۆ دەستپێکردنی هەڵسەنگاندنی سەرجەم کارمەندانی فرۆشیار و کاشێر.
                    </p>
                  </div>

                  {/* Feature Highlights */}
                  <div className="w-full space-y-2.5 pt-2">
                    <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300' : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}>
                      <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>هەڵسەنگاندنی سەرجەم ٨ کارمەندی فرۆشیار و کاشێر بە ٤ پێوەر</span>
                    </div>
                    <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300' : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}>
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>وەڵامەکان ١٠٠٪ نهێنین و تەنها بۆ باشترکردنی توانای کارمەندانە</span>
                    </div>
                    <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2.5 ${
                      isDark ? 'bg-neutral-950/60 border-neutral-800 text-neutral-300' : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}>
                      <Monitor className="w-4 h-4 text-blue-500 shrink-0" />
                      <span>لە کۆمپیوتەر دەتوانیت بە ژمارەکانی کیبۆرد (0-9) و Enter بنووسیت</span>
                    </div>
                  </div>
                </div>

                {/* LEFT COLUMN (LTR KEYPAD): PASSCODE DOTS & NUMPAD */}
                <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 rounded-3xl bg-slate-50/70 dark:bg-neutral-950/60 border border-black/5 dark:border-white/5">
                  
                  {/* Apple Passcode Dots Indicator */}
                  <div className="flex items-center justify-center gap-4 mb-6" dir="ltr">
                    {[0, 1, 2, 3].map((index) => {
                      const filled = index < pin.length;
                      return (
                        <div
                          key={index}
                          className={`w-5 h-5 rounded-full transition-all duration-200 ${
                            filled
                              ? 'bg-amber-500 scale-110 shadow-lg shadow-amber-500/50'
                              : isDark
                              ? 'border-2 border-neutral-700 bg-neutral-900'
                              : 'border-2 border-slate-300 bg-white shadow-inner'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Error / Already-Submitted Pill */}
                  {pinError && (
                    <div
                      className={`w-full max-w-sm mb-4 p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 justify-center font-black leading-relaxed text-center animate-shake ${
                        pinAlreadySubmitted
                          ? isDark
                            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pinAlreadySubmitted ? (
                        <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{pinError}</span>
                    </div>
                  )}

                  {pinVerifying && (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-500 mb-4 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>پشکنینی کۆدی PIN...</span>
                    </div>
                  )}

                  {/* Keypad */}
                  <div className="w-full max-w-xs sm:max-w-sm grid grid-cols-3 gap-2.5 sm:gap-3.5 my-2" dir="ltr">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleKeypadPress(digit)}
                        className={`h-14 sm:h-16 rounded-2xl text-xl sm:text-2xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 shadow-xs ${
                          isDark
                            ? 'bg-neutral-900/90 text-white hover:bg-neutral-800 border border-neutral-800'
                            : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                        }`}
                      >
                        {digit}
                      </button>
                    ))}

                    {/* Clear / Delete */}
                    <button
                      type="button"
                      onClick={handleKeypadDelete}
                      className={`h-14 sm:h-16 rounded-2xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-2xs ${
                        isDark
                          ? 'bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
                          : 'bg-white/60 text-slate-500 hover:bg-slate-100 border border-slate-200/70'
                      }`}
                      title="سڕینەوەی یەک ژمارە (یان Backspace لە کیبۆرد)"
                    >
                      <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>

                    {/* Digit 0 */}
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className={`h-14 sm:h-16 rounded-2xl text-xl sm:text-2xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 shadow-xs ${
                        isDark
                          ? 'bg-neutral-900/90 text-white hover:bg-neutral-800 border border-neutral-800'
                          : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/90'
                      }`}
                    >
                      0
                    </button>

                    {/* Submit / Check PIN */}
                    <button
                      type="button"
                      disabled={pinVerifying || pin.length !== 4}
                      onClick={() => handleVerifyPin()}
                      className="h-14 sm:h-16 rounded-2xl text-xs font-bold flex items-center justify-center bg-amber-500 text-slate-950 hover:bg-amber-600 transition-all cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                      title="داخڵبوون (یان Enter لە کیبۆرد)"
                    >
                      {pinVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                    </button>
                  </div>

                  <p className={`text-[11px] font-medium mt-4 text-center ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                    دەتوانیت بە ژمارەکانی کیبۆرد بنووسیت (Enter = داخڵبوون)
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 📝 SCREEN 2: SALES & CASHIERS QUESTIONNAIRE (FULL-SCREEN RESPONSIVE GRID) */}
        {/* ===================================================================== */}
        {step === 'questionnaire' && (
          <div className="flex-1 py-4 sm:py-6 space-y-5 w-full">
            
            {/* Top Progress & Info Banner (Full-Width) */}
            <div className={`w-full p-4 sm:p-6 rounded-3xl border shadow-xs transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200/90'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {isWarehouse 
                        ? 'هەڵسەنگاندنی سەرجەم ١١ کارمەندی کۆگا' 
                        : 'هەڵسەنگاندنی سەرجەم ٨ کارمەندی فرۆشیار و کاشێر'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {isWarehouse
                        ? 'فیدباکی کارمەند بۆ کارمەندی کۆگا بە ٥ پێوەر و تێبینی'
                        : 'فیدباکی کارمەند بۆ فرۆشیاران و کاشێر بە ٥ پێوەر و تێبینی'}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className={`text-sm sm:text-base font-mono font-black ${isAllComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {completedCount} لە {totalEmployeesCount} تەواوە
                  </span>
                  <span className="text-[11px] text-slate-400 block font-bold">
                    {progressPercent}٪ تەواوکراوە
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    isAllComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Status Notice */}
              <div className="mt-3 text-xs font-bold flex items-center gap-2">
                {isAllComplete ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>دەستت خۆش! سەرجەم کارمەندەکان وەڵام درانەوە، ئێستا دەتوانیت فیدباک بنێریت.</span>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>هێشتا {totalEmployeesCount - completedCount} کارمەند ماوە. تکایە هەڵبژاردنەکان دیاری بکە.</span>
                  </span>
                )}
              </div>

              {/* 🛡️ ڕوونکردنەوەی سەرەوە: ئەم فیدباکە ١٠٠٪ نهێنییە و بۆ باشترکردنی کارمەندەکانە */}
              <div className={`mt-3.5 pt-3.5 border-t flex items-center gap-3 ${
                isDark ? 'border-neutral-800 text-amber-300/90' : 'border-slate-100 text-amber-950'
              }`}>
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-500 shadow-2xs">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[11px] sm:text-xs leading-relaxed">
                  <span className="font-black block text-amber-700 dark:text-amber-300">
                    🔒 ئەم فیدباکە ١٠٠٪ نهێنی و پارێزراوە
                  </span>
                  <span className="opacity-90">
                    وەڵامەکانت بە تەواوی نهێنین و ناوت دەرناکەوێت، ئەم پڕۆسەیە تەنها بۆ باشترکردنی توانای کارمەندان، دروستکردنی کەشێکی لەبار و پێشخستنی کاروباری شوێنەکەیە.
                  </span>
                </div>
              </div>
            </div>

            {/* Mode Switcher + Step Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`p-1 rounded-2xl border flex items-center gap-1 shadow-2xs ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-200/70 border-slate-300/80'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setViewMode('slide');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'slide'
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>پەڕە بە پەڕە (Morph)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setViewMode('grid');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>هەموو کارتەکان (Grid)</span>
                </button>
              </div>

              {viewMode === 'slide' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-neutral-400">
                    {currentEmpIndex < targetStaffList.length 
                      ? `پەڕەی ${currentEmpIndex + 1} لە ${targetStaffList.length + 1}`
                      : `کۆتا قۆناغ: پێشنیارەکان (${targetStaffList.length + 1} لە ${targetStaffList.length + 1})`
                    }
                  </span>
                </div>
              )}
            </div>

            {/* In Slide Mode: Show Top Staff Morph Stepper */}
            {viewMode === 'slide' && (
              <div className={`w-full p-2.5 sm:p-3 rounded-3xl border overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 relative ${
                isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white border-slate-200/90 shadow-xs'
              }`}>
                {targetStaffList.map((emp, idx) => {
                  const isCurrent = currentEmpIndex === idx;
                  const complete = isEmployeeComplete(emp.employeeId);
                  const isLocked = targetStaffList.some((e, i) => i < idx && !isEmployeeComplete(e.employeeId));
                  return (
                    <button
                      key={emp.employeeId}
                      type="button"
                      onClick={() => goToSlideIndex(idx)}
                      className={`relative shrink-0 flex items-center gap-2 px-3 py-2 rounded-2xl transition-all cursor-pointer text-right group ${
                        isCurrent 
                          ? 'text-slate-950 dark:text-white font-black' 
                          : isLocked
                          ? 'text-slate-400 dark:text-neutral-500 opacity-60 hover:opacity-90 font-medium'
                          : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/60 font-bold'
                      }`}
                    >
                      {isCurrent && (
                        <motion.div
                          layoutId="active-staff-morph-pill"
                          className="absolute inset-0 bg-amber-500/20 border-2 border-amber-500 rounded-2xl shadow-sm -z-0"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <div className="w-8 h-8 rounded-xl overflow-hidden bg-black border border-amber-500/30 flex items-center justify-center shrink-0 relative z-10">
                        <img 
                          src={emp.photoUrl || '/ashley-icon.jpg'} 
                          alt={emp.name} 
                          loading="eager"
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('ashley-icon.jpg')) {
                              target.src = '/ashley-icon.jpg';
                            }
                          }}
                        />
                      </div>
                      <div className="relative z-10 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                          <span className="text-xs truncate max-w-[80px] sm:max-w-[100px]">{emp.name}</span>
                          {isLocked && !complete && <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1">
                          {complete ? (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> تەواوە
                            </span>
                          ) : isLocked ? (
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> قفڵە
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-500 font-bold">
                              {getRemainingQuestionsCount(emp.employeeId)} ماوە
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Final Step Tab: Improvement suggestions */}
                <button
                  type="button"
                  onClick={() => goToSlideIndex(targetStaffList.length)}
                  className={`relative shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all cursor-pointer text-right ${
                    currentEmpIndex === targetStaffList.length
                      ? 'text-slate-950 dark:text-white font-black'
                      : !areAllEmployeesComplete
                      ? 'text-slate-400 dark:text-neutral-500 opacity-60 hover:opacity-90 font-medium'
                      : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/60 font-bold'
                  }`}
                >
                  {currentEmpIndex === targetStaffList.length && (
                    <motion.div
                      layoutId="active-staff-morph-pill"
                      className="absolute inset-0 bg-amber-500/20 border-2 border-amber-500 rounded-2xl shadow-sm -z-0"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs relative z-10 ${
                    areAllEmployeesComplete 
                      ? 'bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950' 
                      : 'bg-slate-200 dark:bg-neutral-800 text-slate-400'
                  }`}>
                    {areAllEmployeesComplete ? <Sparkles className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="relative z-10">
                    <span className="text-xs font-black block">پێشنیارەکان</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {areAllEmployeesComplete ? 'تەواوکردن' : 'قفڵە'}
                    </span>
                  </div>
                </button>
              </div>
            )}

            {/* 🌟 VIEW MODE 1: POWERPOINT MORPH SLIDE MODE */}
            {viewMode === 'slide' && (
              <div className="w-full max-w-2xl sm:max-w-3xl mx-auto overflow-hidden min-h-[500px]">
                <AnimatePresence mode="wait" custom={{ dir: slideDirection, idx: currentEmpIndex }}>
                  {currentEmpIndex < targetStaffList.length ? (
                    <motion.div
                      key={targetStaffList[currentEmpIndex].employeeId}
                      custom={{ dir: slideDirection, idx: currentEmpIndex }}
                      variants={morphVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="w-full"
                    >
                      {renderEmployeeCard(targetStaffList[currentEmpIndex], currentEmpIndex, true)}

                      {/* Slide Navigation Bar */}
                      <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-neutral-800">
                        <button
                          type="button"
                          disabled={currentEmpIndex === 0}
                          onClick={goToPrevSlide}
                          className={`h-12 px-4 sm:px-6 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 border ${
                            currentEmpIndex === 0
                              ? 'opacity-35 cursor-not-allowed border-transparent text-slate-400'
                              : isDark 
                              ? 'bg-neutral-900 border-neutral-800 text-white hover:border-amber-500/50' 
                              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>کارمەندی پێشوو</span>
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            کارمەندی {currentEmpIndex + 1} لە {targetStaffList.length}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {isEmployeeComplete(targetStaffList[currentEmpIndex].employeeId) 
                              ? '✓ ئەم کارمەندە تەواوە' 
                              : `${getRemainingQuestionsCount(targetStaffList[currentEmpIndex].employeeId)} پرسیار ماوە`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={goToNextSlide}
                          className={`h-12 px-5 sm:px-7 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md ${
                            isEmployeeComplete(targetStaffList[currentEmpIndex].employeeId)
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                              : 'bg-amber-500/90 hover:bg-amber-400 text-slate-950 shadow-amber-500/10 ring-2 ring-amber-400/40'
                          }`}
                        >
                          {isEmployeeComplete(targetStaffList[currentEmpIndex].employeeId) ? (
                            <>
                              <span>{currentEmpIndex === targetStaffList.length - 1 ? 'پێشنیارەکان و کۆتایی ✦' : 'کارمەندی دواتر ✓'}</span>
                              <ChevronLeft className="w-4 h-4" />
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5 text-slate-950" />
                              <span>{`کارمەندی دواتر (${getRemainingQuestionsCount(targetStaffList[currentEmpIndex].employeeId)} ماوە)`}</span>
                              <ChevronLeft className="w-4 h-4 opacity-50" />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="final-improvement-slide"
                      custom={{ dir: slideDirection, idx: targetStaffList.length }}
                      variants={morphVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="w-full space-y-5"
                    >
                      {/* Card for Final Step Header & Submitter info */}
                      <div className={`p-5 sm:p-7 rounded-3xl border shadow-md transition-all ${
                        isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200/90'
                      }`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                              کۆتا قۆناغ: پێشنیارەکان و ناردنی فیدباک
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-neutral-400">
                              تکایە پێشنیارەکانت دیاری بکە بۆ باشترکردنی کار و ژینگەی شوێنەکە.
                            </p>
                          </div>
                        </div>

                        {/* Submitter Name (Optional) */}
                        <div className="mb-4">
                          <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1.5">
                            ناوی بەشداربوو / هەڵسەنگێنەر (ئارەزوومەندانە):
                          </label>
                          <input
                            type="text"
                            value={respondentName}
                            onChange={(e) => setRespondentName(e.target.value)}
                            placeholder="ناوت بنووسە ئەگەر پێت باشە لەگەڵ فیدباکەکەدا بێت..."
                            className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                              isDark 
                                ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                                : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                            }`}
                          />
                        </div>

                        {/* General Store Remarks (Optional) */}
                        <div>
                          <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1.5">
                            سەرنج یان پێشنیاری گشتی بۆ ئیدارەی ئاشڵی (ئارەزوومەندانە):
                          </label>
                          <input
                            type="text"
                            value={generalSuggestions}
                            onChange={(e) => setGeneralSuggestions(e.target.value)}
                            placeholder="هەر پێشنیارێک یان سەرنجێکی ترت هەیە لێرەدا دەتوانیت بنووسیت..."
                            className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                              isDark 
                                ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                                : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                            }`}
                          />
                        </div>
                      </div>

                      {/* 💡 3 Improvement Points */}
                      <div 
                        id="improvement-suggestions-section"
                        className={`w-full p-5 sm:p-7 rounded-3xl border shadow-md transition-all ${
                          isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                              تێبینیت چی هەیە بۆ باشترکردنی کاروبارەکان؟ (بە ٣ خاڵ)
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-neutral-400">
                              تکایە تێبینی و پێشنیارەکانت بۆ باشترکردنی کار و ژینگەی شوێنەکە لەم ٣ خاڵەدا بنووسە:
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3.5">
                          {/* خاڵی ١ (پێویستە) */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-black text-slate-800 dark:text-neutral-200 flex items-center gap-1.5">
                                <span>خاڵی ١: پێشنیاری یەکەم</span>
                                <span className="text-rose-500 text-[10px]">* پێویستە</span>
                              </label>
                              {improvementPoint1.trim() && (
                                <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5" /> تەواوە
                                </span>
                              )}
                            </div>
                            <input
                              type="text"
                              value={improvementPoint1}
                              onChange={(e) => {
                                setImprovementPoint1(e.target.value);
                                setSubmitError(null);
                              }}
                              placeholder="پێشنیاری یەکەم بۆ باشترکردنی کار و ئاسانکارییەکان بنووسە..."
                              className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                                !improvementPoint1.trim()
                                  ? 'border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20 text-slate-900 dark:text-white'
                                  : isDark
                                  ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                              }`}
                            />
                          </div>

                          {/* خاڵی ٢ (ئارەزوومەندانە) */}
                          <div>
                            <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1">
                              خاڵی ٢: پێشنیاری دووەم (ئارەزوومەندانە):
                            </label>
                            <input
                              type="text"
                              value={improvementPoint2}
                              onChange={(e) => setImprovementPoint2(e.target.value)}
                              placeholder="پێشنیاری دووەم (ئەگەر هەبێت)..."
                              className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                                isDark
                                  ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                              }`}
                            />
                          </div>

                          {/* خاڵی ٣ (ئارەزوومەندانە) */}
                          <div>
                            <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1">
                              خاڵی ٣: پێشنیاری سێیەم (ئارەزوومەندانە):
                            </label>
                            <input
                              type="text"
                              value={improvementPoint3}
                              onChange={(e) => setImprovementPoint3(e.target.value)}
                              placeholder="پێشنیاری سێیەم (ئەگەر هەبێت)..."
                              className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                                isDark
                                  ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                              }`}
                            />
                          </div>

                          {/* دوگمەی پێشنیارە ئامادەکراوەکان */}
                          <div className="pt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-400 ml-1">پێشنیاری خێرا:</span>
                            {[
                              'پەرەپێدانی کەلوپەل و ئامێرەکانی کارکردن',
                              'ڕێکخستنەوەی کاتی دەوام و پشوو',
                              'زیادکردنی هاوکاری و هەماهەنگی نێوان بەشەکان',
                              'هەموو شتێک بەباشی بەڕێوەدەچێت و دەستتان خۆش بێت',
                            ].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  triggerHaptic('light');
                                  if (!improvementPoint1.trim()) {
                                    setImprovementPoint1(preset);
                                  } else if (!improvementPoint2.trim()) {
                                    setImprovementPoint2(preset);
                                  } else if (!improvementPoint3.trim()) {
                                    setImprovementPoint3(preset);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                                  isDark
                                    ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-amber-500/50'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                                }`}
                              >
                                <Plus className="w-3 h-3 text-amber-500" />
                                <span>{preset}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Incomplete Employees Warning / Quick Jump List (if any incomplete) */}
                      {!areAllEmployeesComplete && (
                        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20">
                          <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>هێشتا وەڵامی {totalEmployeesCount - completedCount} کارمەند ماوە. دەتوانیت کلیک بکەیت بۆ چوونە سەر کارمەندەکە:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {targetStaffList.map((emp, idx) => {
                              if (isEmployeeComplete(emp.employeeId)) return null;
                              return (
                                <button
                                  key={emp.employeeId}
                                  type="button"
                                  onClick={() => goToSlideIndex(idx)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center gap-1 cursor-pointer hover:bg-amber-400 active:scale-95 shadow-xs"
                                >
                                  <span>#{idx + 1} {emp.name}</span>
                                  <span className="text-[10px] font-normal">({getRemainingQuestionsCount(emp.employeeId)} پرسیار)</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Error Message */}
                      {submitError && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-bold animate-shake">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="button"
                          disabled={!isAllComplete || submitting}
                          onClick={handleSubmitFeedback}
                          className={`w-full h-14 rounded-2xl font-black text-xs sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] shadow-lg ${
                            isAllComplete
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 ring-2 ring-amber-400/50'
                              : 'bg-slate-300 dark:bg-neutral-800 text-slate-500 dark:text-neutral-500 border border-slate-300 dark:border-neutral-700 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          {submitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isAllComplete ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-slate-950" />
                              <span>ناردنی فیدباک (سەرجەم پرسیارەکان و پێشنیارەکان تەواو بوون)</span>
                            </>
                          ) : !areAllEmployeesComplete ? (
                            <>
                              <Lock className="w-4 h-4" />
                              <span>تەواوکردنی پرسیارەکان ({completedCount} لە {totalEmployeesCount} کارمەند تەواوە)</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span>تکایە خاڵی یەکەمی پێشنیاری باشترکردن بنووسە بۆ ناردن</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Back button */}
                      <div className="flex justify-start pt-2">
                        <button
                          type="button"
                          onClick={goToPrevSlide}
                          className={`h-11 px-5 rounded-2xl text-xs font-black flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                            isDark ? 'bg-neutral-900 border-neutral-800 text-white hover:border-amber-500/50' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>گەڕانەوە بۆ کارمەندەکان</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* 🌟 VIEW MODE 2: CLASSIC RESPONSIVE GRID MODE */}
            {viewMode === 'grid' && (
              <>
                {/* Submitter Name & Suggestions (Adaptive 2-Column Grid on Large Screens) */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                  {/* Submitter Name (Optional) */}
                  <div className={`p-4 sm:p-5 rounded-3xl border ${
                    isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-slate-200/80 shadow-xs'
                  }`}>
                    <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1.5">
                      ناوی بەشداربوو / هەڵسەنگێنەر (ئارەزوومەندانە):
                    </label>
                    <input
                      type="text"
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      placeholder="ناوت بنووسە ئەگەر پێت باشە لەگەڵ فیدباکەکەدا بێت..."
                      className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                      }`}
                    />
                  </div>

                  {/* General Store Remarks (Optional) */}
                  <div className={`p-4 sm:p-5 rounded-3xl border ${
                    isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-slate-200/80 shadow-xs'
                  }`}>
                    <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1.5">
                      کۆتا خاڵ: سەرنج یان پێشنیاری گشتی بۆ ئیدارەی ئاشڵی (ئارەزوومەندانە):
                    </label>
                    <input
                      type="text"
                      value={generalSuggestions}
                      onChange={(e) => setGeneralSuggestions(e.target.value)}
                      placeholder="هەر پێشنیارێک یان سەرنجێکی ترت هەیە لێرەدا دەتوانیت بنووسیت..."
                      className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                      }`}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {['دەست خۆش بێت هیچم نییە', 'هەموو شتێک زۆر باشە و سپاس'].map((preset) => {
                        const activePreset = generalSuggestions.trim() === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setGeneralSuggestions(preset);
                            }}
                            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                              activePreset
                                ? 'bg-emerald-500 text-white border-emerald-500'
                                : isDark
                                ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-amber-500/50'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                            }`}
                          >
                            {activePreset && <Check className="w-3 h-3" />}
                            <span>{preset}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 🌟 4-COLUMN FULL-SCREEN GRID: 1 COL ON MOBILE, 2 COLS ON TABLET, 3-4 COLS ON DESKTOP */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
                  {targetStaffList.map((emp, index) => renderEmployeeCard(emp, index, false))}
                </div>

                {/* 💡 SECTION: 3 IMPROVEMENT SUGGESTIONS */}
                <div 
                  id="improvement-suggestions-section"
                  className={`w-full p-5 sm:p-7 rounded-3xl border shadow-md transition-all ${
                    isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200/90'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 shadow-xs">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        تێبینیت چی هەیە بۆ باشترکردنی کاروبارەکان؟ (بە ٣ خاڵ)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-neutral-400">
                        تکایە تێبینی و پێشنیارەکانت بۆ باشترکردنی کار و ژینگەی شوێنەکە لەم ٣ خاڵەدا دیاری بکە:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* خاڵی ١ (پێویستە) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-black text-slate-800 dark:text-neutral-200 flex items-center gap-1.5">
                          <span>خاڵی ١: پێشنیاری یەکەم</span>
                          <span className="text-rose-500 text-[10px]">* پێویستە</span>
                        </label>
                        {improvementPoint1.trim() && (
                          <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> تەواوە
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={improvementPoint1}
                        onChange={(e) => {
                          setImprovementPoint1(e.target.value);
                          setSubmitError(null);
                        }}
                        placeholder="پێشنیاری یەکەم بۆ باشترکردنی کار و ئاسانکارییەکان بنووسە..."
                        className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                          !improvementPoint1.trim()
                            ? 'border-amber-400/80 bg-amber-50/30 dark:bg-amber-950/20 text-slate-900 dark:text-white'
                            : isDark
                            ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                        }`}
                      />
                    </div>

                    {/* خاڵی ٢ (ئارەزوومەندانە) */}
                    <div>
                      <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1">
                        خاڵی ٢: پێشنیاری دووەم (ئارەزوومەندانە):
                      </label>
                      <input
                        type="text"
                        value={improvementPoint2}
                        onChange={(e) => setImprovementPoint2(e.target.value)}
                        placeholder="پێشنیاری دووەم (ئەگەر هەبێت)..."
                        className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                          isDark
                            ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                        }`}
                      />
                    </div>

                    {/* خاڵی ٣ (ئارەزوومەندانە) */}
                    <div>
                      <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1">
                        خاڵی ٣: پێشنیاری سێیەم (ئارەزوومەندانە):
                      </label>
                      <input
                        type="text"
                        value={improvementPoint3}
                        onChange={(e) => setImprovementPoint3(e.target.value)}
                        placeholder="پێشنیاری سێیەم (ئەگەر هەبێت)..."
                        className={`w-full h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                          isDark
                            ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                        }`}
                      />
                    </div>

                    {/* دوگمەی پێشنیارە ئامادەکراوەکان */}
                    <div className="pt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 ml-1">پێشنیاری خێرا:</span>
                      {[
                        'پەرەپێدانی کەلوپەل و ئامێرەکانی کارکردن',
                        'ڕێکخستنەوەی کاتی دەوام و پشوو',
                        'زیادکردنی هاوکاری و هەماهەنگی نێوان بەشەکان',
                        'هەموو شتێک بەباشی بەڕێوەدەچێت و دەستتان خۆش بێت',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            if (!improvementPoint1.trim()) {
                              setImprovementPoint1(preset);
                            } else if (!improvementPoint2.trim()) {
                              setImprovementPoint2(preset);
                            } else if (!improvementPoint3.trim()) {
                              setImprovementPoint3(preset);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                            isDark
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-amber-500/50'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                          }`}
                        >
                          <Plus className="w-3 h-3 text-amber-500" />
                          <span>{preset}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-bold animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Submit Button (Centered, Floating & Responsive) */}
                <div className="sticky bottom-4 z-30 pt-3 pb-1 flex justify-center w-full px-2">
                  <div className="w-full max-w-2xl bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl p-2 rounded-3xl border border-slate-200/90 dark:border-neutral-800 shadow-2xl flex items-center justify-center">
                    <button
                      type="button"
                      disabled={!isAllComplete || submitting}
                      onClick={handleSubmitFeedback}
                      className={`w-full h-14 rounded-2xl font-black text-xs sm:text-base flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.98] shadow-lg ${
                        isAllComplete
                          ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 ring-2 ring-amber-400/50'
                          : 'bg-slate-300 dark:bg-neutral-800 text-slate-500 dark:text-neutral-500 border border-slate-300 dark:border-neutral-700 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isAllComplete ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-slate-950" />
                          <span>ناردنی فیدباک (سەرجەم پرسیارەکان و پێشنیارەکان تەواو بوون)</span>
                        </>
                      ) : !areAllEmployeesComplete ? (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>تەواوکردنی پرسیارەکان ({completedCount} لە {totalEmployeesCount} کارمەند تەواوە)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>تکایە خاڵی یەکەمی پێشنیاری باشترکردن بنووسە بۆ ناردن</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

        {/* ===================================================================== */}
        {/* 🎉 SCREEN 3: SUCCESS CONFIRMATION (FULL-SCREEN RESPONSIVE) */}
        {/* ===================================================================== */}
        {step === 'success' && (
          <div className="my-auto py-10 flex flex-col items-center justify-center w-full">
            <div className={`w-full max-w-2xl p-8 sm:p-12 rounded-[36px] border text-center shadow-2xl backdrop-blur-2xl transition-all ${
              isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white/90 border-slate-200/90 shadow-slate-200/60'
            }`}>
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-xl animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
                🎉 فیدباکەکەت بە سەرکەوتوویی تۆمار کرا
              </span>

              <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">
                دەستت خۆش بێت بۆ هەڵسەنگاندنەکە!
              </h2>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed mb-6 font-medium">
                فیدباکەکەت بۆ سەرجەم {totalEmployeesCount} کارمەندەکە بە وردی لە سیستەمدا خەزن کرا و ڕاستەوخۆ دەگاتە دەستی بەڕێوەبەرایەتی.
              </p>

              <div className="w-full max-w-sm mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-400 mb-6 font-mono font-bold">
                کۆدی بەکارهاتوو: {pin} • بە سەرکەوتوویی بەکارهات
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('pin_gate');
                  setPin('');
                }}
                className="h-12 px-8 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                <span>پڕکردنەوەی فیدباک بە PINی تر</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
