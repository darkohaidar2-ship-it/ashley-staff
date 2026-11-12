'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Calendar,
  Users,
  Target,
  MessageSquareText,
  ArrowDownCircle,
  Check,
  KeyRound,
  EyeOff,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import {
  getClientSubmissionIds,
  recordSubmittedPinOnClient,
} from '@/lib/feedback/submitted-pins-client';
import {
  MANAGER_EVALUATION_ITEMS,
  MANAGER_OPEN_QUESTIONS,
  MANAGER_RATING_SCALE,
  ManagerOpenAnswers,
  toKurdishDigits,
} from '@/lib/feedback/manager-evaluation';

const QUICK_OPEN_PRESETS = [
  'دەست خۆش بێت هیچم نییە',
  'هەموو شتێک زۆر باشە و سپاس',
  'تێبینیم نییە، سەرکەوتوو بن',
];

export interface ManagerEvaluationFormProps {
  pin: string;
  isDark?: boolean;
  onResetToPinGate?: () => void;
  onBackToHub?: () => void;
  onSubmissionSuccess?: (pin: string) => void;
}

export function ManagerEvaluationForm({
  pin,
  isDark = false,
  onResetToPinGate,
  onBackToHub,
  onSubmissionSuccess,
}: ManagerEvaluationFormProps) {
  const todayIso = useMemo(() => {
    try {
      const now = new Date();
      const baghdad = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' }));
      const yyyy = baghdad.getFullYear();
      const mm = String(baghdad.getMonth() + 1).padStart(2, '0');
      const dd = String(baghdad.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '2026-01-01';
    }
  }, []);

  const [evaluationDate, setEvaluationDate] = useState<string>(todayIso);

  // All 20 criteria start UNSELECTED (0) so zero items are answered accidentally
  const [scores, setScores] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    MANAGER_EVALUATION_ITEMS.forEach((item) => {
      initial[item.id] = 0;
    });
    return initial;
  });

  const [openAnswers, setOpenAnswers] = useState<ManagerOpenAnswers>({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
  });

  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [highlightedOpenKey, setHighlightedOpenKey] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedMeta, setSubmittedMeta] = useState<{
    id: string;
    baghdadDate: string;
    baghdadTime: string;
  } | null>(null);

  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const openRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const answeredCount = useMemo(
    () => MANAGER_EVALUATION_ITEMS.filter((item) => (scores[item.id] || 0) >= 1 && (scores[item.id] || 0) <= 5).length,
    [scores]
  );
  const openAnsweredCount = useMemo(
    () => MANAGER_OPEN_QUESTIONS.filter((q) => (openAnswers[q.key] || '').trim().length >= 2).length,
    [openAnswers]
  );
  const totalCount = MANAGER_EVALUATION_ITEMS.length;
  const totalOpenCount = MANAGER_OPEN_QUESTIONS.length;
  const totalSteps = totalCount + totalOpenCount;
  const totalAnswered = answeredCount + openAnsweredCount;
  const isAllComplete = answeredCount === totalCount && openAnsweredCount === totalOpenCount;
  const progressPercent = Math.round((totalAnswered / totalSteps) * 100);

  const formattedDateDisplay = useMemo(() => {
    const parts = evaluationDate.split('-');
    if (parts.length === 3) {
      return `${toKurdishDigits(parts[2])} / ${toKurdishDigits(parts[1])} / ${toKurdishDigits(parts[0])}`;
    }
    return toKurdishDigits(evaluationDate);
  }, [evaluationDate]);

  const handleSelectScore = (itemId: number, value: number) => {
    triggerHaptic('light');
    setScores((prev) => ({
      ...prev,
      [itemId]: value,
    }));
    setSubmitError(null);
    if (highlightedId === itemId) {
      setHighlightedId(null);
    }
  };

  const handleSetOpenAnswer = (key: keyof ManagerOpenAnswers, value: string) => {
    setOpenAnswers((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSubmitError(null);
    if (highlightedOpenKey === key && value.trim().length >= 2) {
      setHighlightedOpenKey(null);
    }
  };

  const handleJumpNextUnanswered = () => {
    triggerHaptic('light');
    const nextMissing = MANAGER_EVALUATION_ITEMS.find((item) => !scores[item.id]);
    if (nextMissing) {
      setHighlightedId(nextMissing.id);
      const el = rowRefs.current[nextMissing.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightedId(null), 2400);
      return;
    }

    const nextMissingOpen = MANAGER_OPEN_QUESTIONS.find(
      (q) => (openAnswers[q.key] || '').trim().length < 2
    );
    if (nextMissingOpen) {
      setHighlightedOpenKey(nextMissingOpen.key);
      const el = openRowRefs.current[nextMissingOpen.key];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setHighlightedOpenKey(null), 2400);
    }
  };

  const handleSubmit = async () => {
    const firstMissing = MANAGER_EVALUATION_ITEMS.find((item) => !scores[item.id]);
    if (firstMissing) {
      triggerHaptic('error');
      setHighlightedId(firstMissing.id);
      const el = rowRefs.current[firstMissing.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setSubmitError(`تکایە سەرەتا وەڵامی بڕگەی ژمارە (${toKurdishDigits(firstMissing.id)}) و هەموو بڕگەکان هەڵبژێرە.`);
      setTimeout(() => setHighlightedId(null), 3000);
      return;
    }

    const firstMissingOpen = MANAGER_OPEN_QUESTIONS.find(
      (q) => (openAnswers[q.key] || '').trim().length < 2
    );
    if (firstMissingOpen) {
      triggerHaptic('error');
      setHighlightedOpenKey(firstMissingOpen.key);
      const el = openRowRefs.current[firstMissingOpen.key];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setSubmitError(
        `تکایە وەڵامی پرسیاری نووسینی ژمارە (${firstMissingOpen.num}) بنووسە یان دوگمەی «دەست خۆش بێت هیچم نییە» هەڵبژێرە.`
      );
      setTimeout(() => setHighlightedOpenKey(null), 3200);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'manager_evaluation',
          pin,
          evaluationDate,
          scores,
          openAnswers,
          clientSubmissionIds: getClientSubmissionIds(pin),
        }),
      });

      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        const createdId = data.submissionMeta?.id || '';
        recordSubmittedPinOnClient(pin, createdId);
        onSubmissionSuccess?.(pin);
        setSubmittedMeta({
          id: createdId,
          baghdadDate: data.submissionMeta?.baghdadDate || evaluationDate,
          baghdadTime: data.submissionMeta?.baghdadTime || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        triggerHaptic('error');
        setSubmitError(data.error || 'نەتوانرا فۆرمەکە تۆمار بکرێت.');
      }
    } catch {
      triggerHaptic('error');
      setSubmitError('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
    } finally {
      setSubmitting(false);
    }
  };

  // 🎉 Screen: Confidential Success Confirmation (Strictly NO scores or admin bands exposed!)
  if (submittedMeta) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 sm:py-12 px-3 sm:px-4" dir="rtl">
        <div
          className={`relative overflow-hidden rounded-[36px] border p-7 sm:p-11 text-center shadow-2xl transition-all duration-500 animate-in fade-in zoom-in-95 ${
            isDark
              ? 'bg-neutral-900/90 border-emerald-500/30 shadow-black/70 text-white'
              : 'bg-white border-emerald-200 shadow-emerald-950/5 text-slate-900'
          }`}
        >
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/25 mb-5">
              <div
                className={`w-full h-full rounded-full flex items-center justify-center ${
                  isDark ? 'bg-neutral-950' : 'bg-white'
                }`}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>تۆمارکرا بە شێوەی نهێنی - بێ ناو</span>
            </span>

            <h2 className="text-xl sm:text-3xl font-black tracking-tight mb-2">
              سوپاس بۆ هەڵسەنگاندنەکەت!
            </h2>

            <p
              className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-medium mb-6 ${
                isDark ? 'text-neutral-300' : 'text-slate-600'
              }`}
            >
              فۆرمی هەڵسەنگاندن و ڕاپرسی کارمەندان بۆ بەڕێوەبەر بە سەرکەوتوویی و بێ هیچ ناسنامەیەک تۆمار کرا و تەنها لە ئەدمین پانێڵ شیدەکرێتەوە.
            </p>

            <div
              className={`w-full max-w-sm p-4 rounded-2xl border text-xs font-mono font-bold space-y-1 mb-7 ${
                isDark
                  ? 'bg-neutral-950/70 border-neutral-800 text-neutral-400'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div>بەرواری تۆمار: {toKurdishDigits(submittedMeta.baghdadDate)}</div>
              {submittedMeta.baghdadTime && (
                <div>کات: {toKurdishDigits(submittedMeta.baghdadTime)}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              {onResetToPinGate && (
                <button
                  type="button"
                  onClick={onResetToPinGate}
                  className="h-12 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-md"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>فۆرمێکی نوێ بە PINی تر</span>
                </button>
              )}

              {onBackToHub && (
                <button
                  type="button"
                  onClick={onBackToHub}
                  className={`h-12 px-6 rounded-2xl font-bold text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer active:scale-95 transition-all border ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                  }`}
                >
                  <span>گەڕانەوە</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-4 space-y-5" dir="rtl">
      {/* ===================================================================== */}
      {/* 📋 EXECUTIVE FORM HEADER CARD */}
      {/* ===================================================================== */}
      <section
        className={`relative overflow-hidden rounded-[32px] border p-5 sm:p-7 shadow-xl transition-all ${
          isDark
            ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/20 border-amber-500/25 shadow-black/50 text-white'
            : 'bg-gradient-to-br from-white via-white to-amber-50/40 border-amber-200/80 shadow-slate-200/70 text-slate-900'
        }`}
      >
        <div className="absolute -left-16 -top-16 w-48 h-48 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Badges & Confidential Lock Seal */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-black">
              <EyeOff className="w-3.5 h-3.5" />
              <span>جۆری فۆرم: نهێنی - بێ ناو</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold">
              <span>Manager Evaluation Form</span>
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            </div>
          </div>

          {/* Form Main Title */}
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              فۆرمی هەڵسەنگاندن و ڕاپرسی کارمەندان بۆ بەڕێوەبەر
            </h2>
            <p
              className={`mt-2 text-xs sm:text-sm font-medium leading-relaxed flex items-start gap-2 ${
                isDark ? 'text-neutral-300' : 'text-slate-600'
              }`}
            >
              <Target className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong className={isDark ? 'text-white' : 'text-slate-900'}>ئامانج: </strong>
                زانینی ڕادەی ڕەزامەندیی فرۆشیاران و کارمەندان لە شێوازی بەڕێوەبردن و دیاریکردنی خاڵەکانی باشترکردن.
              </span>
            </p>
          </div>

          {/* 3 Metadata Pills: Evaluators, Date (2026), Anonymity guarantee */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50/90 border-slate-200/80'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className={`text-[11px] font-bold block ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  لایەنی هەڵسەنگێنەر
                </span>
                <span className="text-xs sm:text-sm font-black">کارمەندان و فرۆشیاران</span>
              </div>
            </div>

            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50/90 border-slate-200/80'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-bold block ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  بەروار ({formattedDateDisplay})
                </span>
                <input
                  type="date"
                  value={evaluationDate}
                  onChange={(e) => setEvaluationDate(e.target.value)}
                  className={`mt-0.5 w-full bg-transparent text-xs sm:text-sm font-mono font-bold outline-none cursor-pointer ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                  dir="ltr"
                />
              </div>
            </div>

            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDark ? 'bg-neutral-950/70 border-neutral-800' : 'bg-slate-50/90 border-slate-200/80'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className={`text-[11px] font-bold block ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  پاراستنی ناسنامە
                </span>
                <span className="text-xs sm:text-sm font-black">١٠٠٪ بێ ناو و نهێنی</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 🧭 STICKY PROGRESS & 1-5 SCALE LEGEND BAR */}
      {/* ===================================================================== */}
      <div
        className={`sticky top-2 z-30 rounded-3xl border p-3.5 sm:p-4 backdrop-blur-xl shadow-lg transition-all ${
          isDark
            ? 'bg-neutral-900/90 border-neutral-800 shadow-black/60'
            : 'bg-white/92 border-slate-200/90 shadow-slate-200/50'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black ${
                isAllComplete
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
              }`}
            >
              {toKurdishDigits(totalAnswered)} / {toKurdishDigits(totalSteps)}
            </span>
            <span className="text-xs sm:text-sm font-black">
              {isAllComplete
                ? 'سەرجەم ٢٠ بڕگە و ٥ پرسیار تەواون!'
                : `بڕگە (${toKurdishDigits(answeredCount)}/${toKurdishDigits(totalCount)}) • پرسیاری نووسین (${toKurdishDigits(openAnsweredCount)}/${toKurdishDigits(totalOpenCount)})`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isAllComplete && (
              <button
                type="button"
                onClick={handleJumpNextUnanswered}
                className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>وەڵامنەدراوی دواتر</span>
              </button>
            )}
            <span className="text-xs font-mono font-black text-amber-500">
              {toKurdishDigits(progressPercent)}٪
            </span>
          </div>
        </div>

        {/* Sleek Smooth Progress Fill */}
        <div className={`w-full h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-slate-100'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAllComplete
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400'
            }`}
            style={{ width: `${progressPercent}%`, transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
          />
        </div>

        {/* Scale Key Pill Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-black/5 dark:border-white/10 text-[11px] font-bold">
          {MANAGER_RATING_SCALE.map((opt) => (
            <div
              key={opt.value}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                isDark ? 'bg-neutral-950/70 text-neutral-300' : 'bg-slate-50 text-slate-700'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: opt.dotColor }}
              />
              <span className="font-mono font-black">{opt.kurdishDigit}</span>
              <span>=</span>
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 📊 PART 1: 20 EVALUATION CRITERIA (1 to 5 SCALE) */}
      {/* ===================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
              ١
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                بەشی یەکەم: بڕگەکانی هەڵسەنگاندن (نمرەدان لە ١ تا ٥)
              </h3>
              <p className={`text-[11px] font-medium ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                تکایە بەپێی پێوەرەکان نمرە بۆ هەر بڕگەیەک دابنێ (هەڵبژاردن لە ١ بۆ ٥)
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {MANAGER_EVALUATION_ITEMS.map((item) => {
            const currentScore = scores[item.id] || 0;
            const isHighlighted = highlightedId === item.id;
            const isAnswered = currentScore >= 1 && currentScore <= 5;
            const selectedScaleObj = MANAGER_RATING_SCALE.find((s) => s.value === currentScore);

            return (
              <div
                key={item.id}
                ref={(el) => {
                  rowRefs.current[item.id] = el;
                }}
                className={`rounded-3xl border p-4 sm:p-5 transition-all duration-300 ${
                  isHighlighted
                    ? 'ring-3 ring-amber-500 border-amber-500 scale-[1.01] shadow-xl'
                    : isAnswered
                    ? isDark
                      ? 'bg-neutral-900/90 border-emerald-500/30 shadow-sm'
                      : 'bg-white border-emerald-200 shadow-sm'
                    : isDark
                    ? 'bg-neutral-900/65 border-neutral-800 hover:border-neutral-700'
                    : 'bg-white/95 border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Question Number & Text */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-2xl font-mono font-black text-sm flex items-center justify-center shrink-0 transition-all ${
                        isAnswered
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : isDark
                          ? 'bg-neutral-800 text-amber-400 border border-neutral-700'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isAnswered ? <Check className="w-4 h-4" /> : toKurdishDigits(item.id)}
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-slate-400">
                          بڕگەی {toKurdishDigits(item.id)}
                        </span>
                        {selectedScaleObj && (
                          <span
                            className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                              isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
                            } ${selectedScaleObj.activeText}`}
                          >
                            {selectedScaleObj.kurdishDigit} — {selectedScaleObj.label}
                          </span>
                        )}
                      </div>
                      <p className="text-sm sm:text-[15px] font-bold leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  </div>

                  {/* Tactile 1..5 Interactive Rating Pills */}
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full lg:w-[410px] shrink-0" dir="rtl">
                    {MANAGER_RATING_SCALE.map((opt) => {
                      const active = currentScore === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectScore(item.id, opt.value)}
                          className={`min-h-[54px] sm:min-h-[56px] px-1 py-2 rounded-2xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none transition-all duration-200 active:scale-92 ${
                            active
                              ? `${opt.activeBg} ${opt.activeBorder} ring-3 ${opt.ringColor} scale-[1.03] font-black`
                              : isDark
                              ? 'bg-neutral-950/75 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                          aria-pressed={active}
                          aria-label={`${item.text} - ${opt.label}`}
                        >
                          <span className="text-base sm:text-lg font-mono font-black leading-none">
                            {opt.kurdishDigit}
                          </span>
                          <span className="text-[9.5px] sm:text-[10px] font-bold leading-tight text-center line-clamp-1">
                            {opt.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 💬 PART 2: 5 OPEN-ENDED QUESTIONS & SUGGESTIONS */}
      {/* ===================================================================== */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              ٢
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black">
                بەشی دووەم: پرسیارە کراوەکان و پێشنیارەکان
              </h3>
              <p className={`text-[11px] font-medium ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                بۆچوون و سەرنجە ڕاشکاوانەکانت دەبنە هۆی باشترکردنی کارەکان و ساڵی نوێی ٢٠٢٦
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
              openAnsweredCount === totalOpenCount
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>
              {toKurdishDigits(openAnsweredCount)} / {toKurdishDigits(totalOpenCount)} پرسیاری مەرجدار
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {MANAGER_OPEN_QUESTIONS.map((q) => {
            const val = openAnswers[q.key] || '';
            const isAnswered = val.trim().length >= 2;
            const isHighlighted = highlightedOpenKey === q.key;
            return (
              <div
                key={q.key}
                ref={(el) => {
                  openRowRefs.current[q.key] = el;
                }}
                className={`rounded-3xl border p-4 sm:p-5 transition-all ${
                  isHighlighted
                    ? 'border-rose-500 ring-2 ring-rose-500/35 bg-rose-500/5'
                    : isDark
                    ? isAnswered
                      ? 'bg-neutral-900/90 border-emerald-500/35 focus-within:border-blue-500/50'
                      : 'bg-neutral-900/80 border-neutral-800 focus-within:border-blue-500/50'
                    : isAnswered
                    ? 'bg-white border-emerald-300 shadow-xs focus-within:border-blue-400 focus-within:shadow-md'
                    : 'bg-white border-slate-200/90 shadow-xs focus-within:border-blue-400 focus-within:shadow-md'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <label className="flex items-start gap-2.5 text-sm font-black leading-relaxed flex-1 min-w-[200px]">
                    <span className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center font-mono text-xs shrink-0 mt-0.5">
                      {q.num}
                    </span>
                    <span>{q.label}</span>
                  </label>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                      isAnswered
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isAnswered ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>تەواوە</span>
                      </>
                    ) : (
                      <span>مەرجە / پێویستە</span>
                    )}
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={val}
                  onChange={(e) => handleSetOpenAnswer(q.key, e.target.value)}
                  placeholder={q.placeholder}
                  className={`w-full rounded-2xl border p-3.5 text-base sm:text-sm leading-relaxed outline-none resize-y transition-all ${
                    isDark
                      ? 'bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-blue-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500'
                  }`}
                />

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-[11px] font-bold ml-1 ${
                      isDark ? 'text-neutral-400' : 'text-slate-500'
                    }`}
                  >
                    وەڵامی خێرا:
                  </span>
                  {QUICK_OPEN_PRESETS.map((preset) => {
                    const isSelectedPreset = val.trim() === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          handleSetOpenAnswer(q.key, preset);
                        }}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                          isSelectedPreset
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                            : isDark
                            ? 'bg-neutral-950/80 border-neutral-800 text-neutral-300 hover:border-blue-500/50 hover:text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {isSelectedPreset && <Check className="w-3 h-3" />}
                        <span>{preset}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Error Message Pill */}
      {submitError && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs sm:text-sm flex items-center gap-2 font-black animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 🚀 STICKY BOTTOM SUBMIT CAPSULE */}
      {/* ===================================================================== */}
      <div className="sticky bottom-3 z-30 pt-2 pb-safe flex justify-center w-full">
        <div
          className={`w-full max-w-2xl p-2 rounded-3xl border backdrop-blur-xl shadow-2xl ${
            isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-slate-200/90'
          }`}
        >
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className={`w-full h-14 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-lg ${
              isAllComplete
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:to-teal-400 text-white ring-2 ring-emerald-400/40'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700'
            }`}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isAllComplete ? (
              <>
                <Sparkles className="w-5 h-5" />
                <span>ناردنی هەڵسەنگاندنی نهێنی (٢٥/٢٥ تەواوە)</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  ناردنی فۆرم ({toKurdishDigits(totalAnswered)} لە {toKurdishDigits(totalSteps)} هەنگاو تەواوە)
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
