'use client';

import React, { useState, useEffect } from 'react';
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
  X,
  Delete,
  Monitor,
  Tablet,
  Smartphone
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { TARGET_SALES_CASHIER_STAFF } from '@/lib/feedback/feedback-service';

interface FeedbackPortalProps {
  initialPin?: string;
  isDark?: boolean;
}

export function FeedbackPortal({ initialPin = '', isDark: initialDark = false }: FeedbackPortalProps) {
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
    }
  };

  // Step state: 'pin_gate' | 'questionnaire' | 'success'
  const [step, setStep] = useState<'pin_gate' | 'questionnaire' | 'success'>('pin_gate');

  // PIN state
  const [pin, setPin] = useState<string>(initialPin);
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifiedPinData, setVerifiedPinData] = useState<any | null>(null);

  // Evaluator Name (optional)
  const [respondentName, setRespondentName] = useState<string>('');

  // 🌟 Employee Ratings: ALL 4 CRITERIA START AT 0 (UNSELECTED)
  // "با ئەستێرەکان لەسەر هەڵنەبژێراوە بێت بۆ ئەوەی هیچی بیر نەجێط"
  const [employeeRatings, setEmployeeRatings] = useState<Record<string, {
    serviceRating: number;      // 0 = unselected
    performanceRating: number;  // 0 = unselected
    disciplineRating: number;   // 0 = unselected
    overallRating: number;      // 0 = unselected
    comment: string;
  }>>(() => {
    const initial: any = {};
    TARGET_SALES_CASHIER_STAFF.forEach(emp => {
      initial[emp.employeeId] = {
        serviceRating: 0,
        performanceRating: 0,
        disciplineRating: 0,
        overallRating: 0,
        comment: '',
      };
    });
    return initial;
  });

  // General store suggestions
  const [generalSuggestions, setGeneralSuggestions] = useState<string>('');

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [highlightedEmpId, setHighlightedEmpId] = useState<string | null>(null);

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
      setPinError('تکایە کۆدی چوار ژمارەیی بنووسە.');
      triggerHaptic('error');
      playAudioChime(false);
      return;
    }

    setPinVerifying(true);
    setPinError(null);

    try {
      const res = await fetch('/api/feedback/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToTest }),
      });

      const data = await res.json();
      if (data.valid && data.pinData) {
        setVerifiedPinData(data.pinData);
        if (data.pinData.targetName) {
          setRespondentName(data.pinData.targetName);
        }
        triggerHaptic('success');
        playAudioChime(true);
        setStep('questionnaire');
      } else {
        setPinError(data.error || 'کۆدی PIN هەڵەیە یان ڕێگەی پێنەدراوە.');
        triggerHaptic('error');
        playAudioChime(false);
        setPin('');
      }
    } catch (err: any) {
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
      if (nextPin.length === 4) {
        setTimeout(() => handleVerifyPin(nextPin), 150);
      }
    }
  };

  const handleKeypadDelete = () => {
    triggerHaptic('light');
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  // 2. Rating handler for a specific employee
  const handleRatingChange = (
    empId: string, 
    field: 'serviceRating' | 'performanceRating' | 'disciplineRating' | 'overallRating', 
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

  const handleCommentChange = (empId: string, text: string) => {
    setEmployeeRatings((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        comment: text,
      },
    }));
  };

  // Helper: check if a specific employee is complete
  const isEmployeeComplete = (empId: string) => {
    const r = employeeRatings[empId];
    if (!r) return false;
    return r.serviceRating > 0 && r.performanceRating > 0 && r.disciplineRating > 0 && r.overallRating > 0;
  };

  // Helper: count remaining questions for an employee
  const getRemainingQuestionsCount = (empId: string) => {
    const r = employeeRatings[empId];
    if (!r) return 4;
    let count = 0;
    if (r.serviceRating === 0) count++;
    if (r.performanceRating === 0) count++;
    if (r.disciplineRating === 0) count++;
    if (r.overallRating === 0) count++;
    return count;
  };

  // Completion metrics
  const completedCount = TARGET_SALES_CASHIER_STAFF.filter((e) => isEmployeeComplete(e.employeeId)).length;
  const totalEmployeesCount = TARGET_SALES_CASHIER_STAFF.length;
  const isAllComplete = completedCount === totalEmployeesCount;
  const progressPercent = Math.round((completedCount / totalEmployeesCount) * 100);

  // 3. Submit Response Handler
  const handleSubmitFeedback = async () => {
    if (!isAllComplete) {
      triggerHaptic('error');
      playAudioChime(false);
      const firstIncomplete = TARGET_SALES_CASHIER_STAFF.find((e) => !isEmployeeComplete(e.employeeId));
      if (firstIncomplete) {
        setHighlightedEmpId(firstIncomplete.employeeId);
        const el = document.getElementById(`emp-card-${firstIncomplete.employeeId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setSubmitError(`تکایە سەرجەم پرسیارەکانی کارمەند (${firstIncomplete.name}) و هەموو کارمەندەکان هەڵبژێرە.`);
        setTimeout(() => setHighlightedEmpId(null), 3000);
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formattedRatings: Record<string, any> = {};
      TARGET_SALES_CASHIER_STAFF.forEach((emp) => {
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
          comment: r.comment?.trim() || undefined,
        };
      });

      const payload = {
        pin,
        respondentName: respondentName?.trim() || undefined,
        department: 'فرۆشیار و کاشێر',
        employeeRatings: formattedRatings,
        suggestionsForManagement: generalSuggestions?.trim() || undefined,
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

  // Star Rating Component
  const StarRatingSelector = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: number; // 0 to 5
    onChange: (val: number) => void;
  }) => {
    const getRatingLabel = (val: number) => {
      switch (val) {
        case 1: return 'لاوازە (١/٥)';
        case 2: return 'مامناوەندە (٢/٥)';
        case 3: return 'باشە (٣/٥)';
        case 4: return 'زۆر باشە (٤/٥)';
        case 5: return 'نایابە (٥/٥)';
        default: return 'هەڵنەبژێردراوە';
      }
    };

    return (
      <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
        value === 0 
          ? isDark ? 'bg-neutral-900/50 border-amber-500/30 shadow-2xs' : 'bg-amber-50/40 border-amber-200/60 shadow-2xs'
          : isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-slate-50 border-slate-200/80'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-black ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
            {label}
          </span>
          <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full transition-all ${
            value === 0
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse'
              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-bold'
          }`}>
            {getRatingLabel(value)}
          </span>
        </div>

        <div className="flex items-center justify-between px-1 sm:px-2 py-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= value;
            return (
              <button
                key={star}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onChange(star);
                }}
                className="p-1 sm:p-1.5 cursor-pointer transition-transform hover:scale-120 active:scale-90"
                title={`${star} ئەستێرە`}
              >
                <Star
                  className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                    isFilled 
                      ? 'fill-amber-400 text-amber-400 drop-shadow-sm' 
                      : isDark ? 'text-neutral-700 hover:text-neutral-500' : 'text-slate-300 hover:text-slate-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none ${
      isDark ? 'bg-black text-white' : 'bg-[#f2f2f7] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱💻 FULLY RESPONSIVE CONTAINER (Mobile, Tablet, Computer) */}
      <div className="w-full max-w-5xl min-h-[100dvh] mx-auto flex flex-col justify-between p-3.5 sm:p-6 lg:p-8 pt-safe pb-safe transition-all">

        {/* 1. TOP HEADER (Pure & Clean • NO admin strips, NO section bars) */}
        <header className="pt-2 pb-3 flex items-center justify-between border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center ${isDark ? 'bg-black' : 'bg-white'}`}>
                <MessageSquareHeart className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                فیدباک و هەڵسەنگاندنی ئاشڵی
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-neutral-400 font-medium">
                هەڵسەنگاندنی کارمەندانی فرۆشیار و کاشێر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === 'questionnaire' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 text-[11px] font-mono font-bold shadow-2xs">
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
        {/* 🔒 SCREEN 1: 4-DIGIT PIN GATE (Mobile, Tablet, Computer) */}
        {/* ===================================================================== */}
        {step === 'pin_gate' && (
          <div className="my-auto py-8 flex flex-col items-center text-center">
            
            {/* Apple Icon */}
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-[28px] bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center">
                <div className={`w-full h-full rounded-[26px] flex items-center justify-center ${
                  isDark ? 'bg-neutral-950' : 'bg-white'
                }`}>
                  <MessageSquareHeart className="w-10 h-10 text-amber-500" />
                </div>
              </div>
              <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>

            <h2 className={`text-xl sm:text-2xl font-black tracking-tight mb-1.5 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              داخڵبوونی فیدباک بە کۆدی PIN
            </h2>
            <p className={`text-xs sm:text-sm max-w-sm font-semibold leading-relaxed mb-6 ${
              isDark ? 'text-neutral-400' : 'text-slate-500'
            }`}>
              تکایە کۆدی ٤ ژمارەیی بنووسە یان لەسەر کیبۆردەکەت لێیبدە بۆ دەستپێکردنی هەڵسەنگاندن
            </p>

            {/* Apple Passcode Dots Indicator */}
            <div className="flex items-center justify-center gap-3.5 mb-6" dir="ltr">
              {[0, 1, 2, 3].map((index) => {
                const filled = index < pin.length;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      filled
                        ? 'bg-amber-500 scale-110 shadow-md shadow-amber-500/40'
                        : isDark
                        ? 'border-2 border-neutral-700 bg-neutral-900'
                        : 'border-2 border-slate-300 bg-white'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message Pill */}
            {pinError && (
              <div className="w-full max-w-xs mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 justify-center font-bold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {pinVerifying && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-500 mb-4 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>پشکنینی کۆدی PIN...</span>
              </div>
            )}

            {/* iOS Keypad (Touch on Mobile/Tablet • Mouse on Desktop) */}
            <div className="w-full max-w-xs grid grid-cols-3 gap-2.5 sm:gap-3 my-2" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className={`h-14 rounded-2xl text-xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                    isDark
                      ? 'bg-neutral-900/90 text-white hover:bg-neutral-800 border border-neutral-800'
                      : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/80 shadow-xs'
                  }`}
                >
                  {digit}
                </button>
              ))}

              {/* Clear / Delete */}
              <button
                type="button"
                onClick={handleKeypadDelete}
                className={`h-14 rounded-2xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                  isDark
                    ? 'bg-neutral-900/40 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
                    : 'bg-white/60 text-slate-500 hover:bg-slate-100 border border-slate-200/60 shadow-2xs'
                }`}
                title="سڕینەوەی یەک ژمارە (یان Backspace لە کیبۆرد)"
              >
                <Delete className="w-5 h-5" />
              </button>

              {/* Digit 0 */}
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className={`h-14 rounded-2xl text-xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                  isDark
                    ? 'bg-neutral-900/90 text-white hover:bg-neutral-800 border border-neutral-800'
                    : 'bg-white text-slate-800 hover:bg-slate-100 border border-slate-200/80 shadow-xs'
                }`}
              >
                0
              </button>

              {/* Submit / Check PIN */}
              <button
                type="button"
                disabled={pinVerifying || pin.length !== 4}
                onClick={() => handleVerifyPin()}
                className="h-14 rounded-2xl text-xs font-bold flex items-center justify-center bg-amber-500 text-slate-950 hover:bg-amber-600 transition-all cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                title="داخڵبوون (یان Enter لە کیبۆرد)"
              >
                {pinVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              </button>
            </div>

            <p className={`text-[11px] font-medium mt-6 max-w-xs ${isDark ? 'text-neutral-500' : 'text-slate-400'}`}>
              دەتوانیت بە پەنجە لێیبدەیت لە مۆبایل و تابلێت، یان بە ژمارەکانی کیبۆرد بنووسیت لەسەر کۆمپیوتەر
            </p>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 📝 SCREEN 2: SALES & CASHIERS QUESTIONNAIRE (RESPONSIVE GRID) */}
        {/* ===================================================================== */}
        {step === 'questionnaire' && (
          <div className="flex-1 py-4 sm:py-6 space-y-5">
            
            {/* Top Progress & Info Banner (NO section strip) */}
            <div className={`p-4 sm:p-5 rounded-3xl border shadow-xs transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200/90'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      هەڵسەنگاندنی سەرجەم ٨ کارمەندانی فرۆشیار و کاشێر
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                      پێویستە هەموو کارمەندەکان هەڵبسەنگێندرێن پێش ناردن
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className={`text-xs sm:text-sm font-mono font-black ${isAllComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {completedCount} لە {totalEmployeesCount} تەواوە
                  </span>
                  <span className="text-[10px] text-slate-400 block font-bold">
                    {progressPercent}٪ تەواوکراوە
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    isAllComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Status Notice */}
              <div className="mt-2.5 text-[11px] font-bold flex items-center gap-1.5">
                {isAllComplete ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>دەستت خۆش! سەرجەم کارمەندەکان وەڵام درانەوە، ئێستا دەتوانیت فیدباک بنێریت.</span>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>هێشتا {totalEmployeesCount - completedCount} کارمەند ماوە. دەست بنێ بە ئەستێرەکاندا بۆ هەڵبژاردن.</span>
                  </span>
                )}
              </div>
            </div>

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
                className={`w-full max-w-md h-11 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* 🌟 RESPONSIVE GRID: 1 COL ON MOBILE, 2 COLS ON TABLET & COMPUTER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {TARGET_SALES_CASHIER_STAFF.map((emp, index) => {
                const ratings = employeeRatings[emp.employeeId] || {
                  serviceRating: 0,
                  performanceRating: 0,
                  disciplineRating: 0,
                  overallRating: 0,
                  comment: '',
                };

                const complete = isEmployeeComplete(emp.employeeId);
                const remaining = getRemainingQuestionsCount(emp.employeeId);
                const isHighlighted = highlightedEmpId === emp.employeeId;

                return (
                  <div
                    key={emp.employeeId}
                    id={`emp-card-${emp.employeeId}`}
                    className={`rounded-3xl border p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 ${
                      isHighlighted
                        ? 'ring-3 ring-amber-500 border-amber-500 scale-[1.01]'
                        : complete
                        ? isDark ? 'bg-neutral-900/90 border-emerald-500/30' : 'bg-white border-emerald-500/30 shadow-xs'
                        : isDark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200/90 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Employee Identity Header */}
                      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-neutral-800">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-600 shrink-0 shadow-2xs">
                            {emp.photoUrl ? (
                              <img 
                                src={emp.photoUrl} 
                                alt={emp.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as any).style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className="text-base">{emp.name.slice(0, 1)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                #{index + 1}
                              </span>
                              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                {emp.fullName}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {emp.role}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                کۆد: {emp.employeeId}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Completion Badge */}
                        <div className="text-left shrink-0">
                          {complete ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-black">
                              <Check className="w-3.5 h-3.5" />
                              <span>تەواو بوو</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[10px] font-bold">
                              <span>{remaining} پرسیار ماوە</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4 Star Rating Questions (Start at 0 / Unselected) */}
                      <div className="space-y-3">
                        <StarRatingSelector
                          label="١. ڕەفتار و مامەڵە لەگەڵ کڕیار (ڕێز و پێشوازی)"
                          value={ratings.serviceRating}
                          onChange={(val) => handleRatingChange(emp.employeeId, 'serviceRating', val)}
                        />

                        <StarRatingSelector
                          label={`٢. چالاکی و لێهاتوویی لە کار (${emp.role.includes('کاشێر') ? 'کاش و حیسابات' : 'فرۆشتن'})`}
                          value={ratings.performanceRating}
                          onChange={(val) => handleRatingChange(emp.employeeId, 'performanceRating', val)}
                        />

                        <StarRatingSelector
                          label="٣. پابەندبوون بە کاتی دەوام و ڕێنماییەکان"
                          value={ratings.disciplineRating}
                          onChange={(val) => handleRatingChange(emp.employeeId, 'disciplineRating', val)}
                        />

                        <StarRatingSelector
                          label={`٤. نمرەی گشتی هەڵسەنگاندن بۆ ${emp.name}`}
                          value={ratings.overallRating}
                          onChange={(val) => handleRatingChange(emp.employeeId, 'overallRating', val)}
                        />

                        {/* Optional Comment for this employee */}
                        <div className="pt-1">
                          <input
                            type="text"
                            value={ratings.comment}
                            onChange={(e) => handleCommentChange(emp.employeeId, e.target.value)}
                            placeholder={`سەرنج یان تێبینی لەسەر ${emp.name} (ئارەزوومەندانە)...`}
                            className={`w-full h-10 px-3.5 text-xs rounded-2xl border outline-none transition-all ${
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
              })}
            </div>

            {/* General Store Remarks (Optional) */}
            <div className={`p-4 sm:p-5 rounded-3xl border ${
              isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <label className="block text-xs font-black text-slate-800 dark:text-neutral-200 mb-1.5">
                سەرنج یان پێشنیاری گشتی بۆ ئیدارەی ئاشڵی (ئارەزوومەندانە):
              </label>
              <textarea
                value={generalSuggestions}
                onChange={(e) => setGeneralSuggestions(e.target.value)}
                rows={3}
                placeholder="هەر پێشنیارێک یان سەرنجێکی ترت هەیە لێرەدا دەتوانیت بنووسیت..."
                className={`w-full p-3.5 text-xs rounded-2xl border outline-none resize-none transition-all ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-800 text-white focus:border-amber-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-bold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button (Centered, Floating & Responsive) */}
            <div className="sticky bottom-4 z-30 pt-3 pb-1 flex justify-center">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitFeedback}
                className={`w-full max-w-md h-14 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-xl ${
                  isAllComplete
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 ring-2 ring-amber-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 opacity-90'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isAllComplete ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-slate-950" />
                    <span>ناردنی فیدباک (سەرجەم ٨ کارمەندەکە تەواو بوو)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>تەواوکردنی وەڵامەکان ({completedCount} لە {totalEmployeesCount} کارمەند)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* 🎉 SCREEN 3: SUCCESS CONFIRMATION (RESPONSIVE) */}
        {/* ===================================================================== */}
        {step === 'success' && (
          <div className="my-auto py-10 flex flex-col items-center text-center">
            
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mb-4 shadow-xl animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
              🎉 فیدباکەکەت بە سەرکەوتوویی تۆمار کرا
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">
              دەستت خۆش بێت بۆ هەڵسەنگاندنەکە!
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-neutral-400 max-w-md leading-relaxed mb-6 font-medium">
              فیدباکەکەت بۆ سەرجەم ٨ کارمەندانی فرۆشیار و کاشێری ئاشڵی بە وردی لە سیستەمدا خەزن کرا و ڕاستەوخۆ دەگاتە دەستی ئیدارە.
            </p>

            <div className="w-full max-w-xs p-4 rounded-3xl bg-slate-50 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-xs text-slate-500 dark:text-neutral-400 mb-6 font-mono">
              کۆدی بەکارهاتوو: {pin} • بە سەرکەوتوویی بەکارهات
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('pin_gate');
                setPin('');
              }}
              className="h-12 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
            >
              <KeyRound className="w-4 h-4" />
              <span>پڕکردنەوەی فیدباک بە PINی تر</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
