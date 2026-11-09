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
  ArrowRight, 
  ChevronLeft, 
  MessageSquareHeart, 
  Send, 
  Lock, 
  Phone, 
  User, 
  Building, 
  ThumbsUp, 
  HeartHandshake, 
  HelpCircle,
  Delete,
  X
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';

interface FeedbackPortalProps {
  initialPin?: string;
  onBackToAttendance?: () => void;
  isDark?: boolean;
}

export function FeedbackPortal({ initialPin = '', onBackToAttendance, isDark: initialDark = false }: FeedbackPortalProps) {
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

  // Questionnaire form states
  const [respondentName, setRespondentName] = useState<string>('');
  const [department, setDepartment] = useState<string>('شۆڕووم و پێشانگا');

  // Star ratings (1 to 5)
  const [overallSatisfaction, setOverallSatisfaction] = useState<number>(5);
  const [workEnvironmentRating, setWorkEnvironmentRating] = useState<number>(5);
  const [teamCooperationRating, setTeamCooperationRating] = useState<number>(5);
  const [managementFairnessRating, setManagementFairnessRating] = useState<number>(5);
  const [toolsAndEquipmentRating, setToolsAndEquipmentRating] = useState<number>(5);

  // Multiple Choice Questions
  const [shiftHoursSuitability, setShiftHoursSuitability] = useState<string>('بەڵێ زۆر گونجاوە');
  const [departmentNeedingImprovement, setDepartmentNeedingImprovement] = useState<string>('هیچ، هەمووی باشە');
  const [appExperienceRating, setAppExperienceRating] = useState<string>('نایاب و خێرایە');

  // Text inputs
  const [positiveHighlights, setPositiveHighlights] = useState<string>('');
  const [workplaceChallenges, setWorkplaceChallenges] = useState<string>('');
  const [suggestionsForManagement, setSuggestionsForManagement] = useState<string>('');

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-verify if initialPin is provided via URL
  useEffect(() => {
    if (initialPin && /^\d{4}$/.test(initialPin)) {
      handleVerifyPin(initialPin);
    }
  }, [initialPin]);

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
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  // Verify PIN
  const handleVerifyPin = async (pinToTest?: string) => {
    const finalPin = (pinToTest || pin).trim();
    if (!/^\d{4}$/.test(finalPin)) {
      setPinError('تکایە کۆدی نهێنی ٤ ژمارەیی بنووسە.');
      triggerHaptic('error');
      return;
    }

    setPinVerifying(true);
    setPinError(null);

    try {
      const res = await fetch('/api/feedback/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: finalPin }),
      });
      const data = await res.json();

      if (data.valid && data.pinData) {
        triggerHaptic('success');
        playAudioChime(true);
        setVerifiedPinData(data.pinData);
        if (data.pinData.targetName) {
          setRespondentName(data.pinData.targetName);
        }
        setStep('questionnaire');
      } else {
        triggerHaptic('error');
        playAudioChime(false);
        setPinError(data.error || 'کۆدی PIN نادروستە یان بەسەرچووە.');
        setPin('');
      }
    } catch (err: any) {
      triggerHaptic('error');
      setPinError('هەڵە لە پەیوەندی کردن بە سێرڤەر. تکایە دووبارە تاقی بکەرەوە.');
    } finally {
      setPinVerifying(false);
    }
  };

  // Keypad presses
  const handleKeypadPress = (digit: string) => {
    triggerHaptic('light');
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(null);
      if (nextPin.length === 4) {
        setTimeout(() => {
          handleVerifyPin(nextPin);
        }, 100);
      }
    }
  };

  const handleKeypadDelete = () => {
    triggerHaptic('light');
    setPin(prev => prev.slice(0, -1));
    setPinError(null);
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setSubmitError('کۆدی PIN بوونی نییە');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    triggerHaptic('medium');

    try {
      const payload = {
        pin: pin.trim(),
        respondentName: respondentName.trim() || undefined,
        department,
        overallSatisfaction,
        workEnvironmentRating,
        teamCooperationRating,
        managementFairnessRating,
        toolsAndEquipmentRating,
        shiftHoursSuitability,
        departmentNeedingImprovement,
        appExperienceRating,
        positiveHighlights: positiveHighlights.trim() || undefined,
        workplaceChallenges: workplaceChallenges.trim() || undefined,
        suggestionsForManagement: suggestionsForManagement.trim() || undefined,
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
        triggerHaptic('error');
        setSubmitError(data.error || 'نەتوانرا فیدباکەکە تۆمار بکرێت.');
      }
    } catch (err: any) {
      triggerHaptic('error');
      setSubmitError('هەڵەیەک ڕوویدا لە کاتی پەیوەندیکردن بە سێرڤەر.');
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
    value: number; 
    onChange: (val: number) => void;
  }) => {
    return (
      <div className={`p-4 rounded-2xl border transition-all ${
        isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-slate-50 border-slate-200/80 shadow-2xs'
      }`}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={`text-xs font-black ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
            {label}
          </span>
          <span className="text-xs font-black font-mono text-amber-500">
            {value} / 5
          </span>
        </div>
        <div className="flex items-center justify-center gap-2" dir="ltr">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onChange(star);
              }}
              className="p-1 cursor-pointer transition-transform hover:scale-115 active:scale-95"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  star <= value 
                    ? 'fill-amber-400 text-amber-400 drop-shadow-xs' 
                    : isDark ? 'text-neutral-700' : 'text-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none ${
      isDark ? 'bg-black text-white' : 'bg-[#f2f2f7] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱 APPLE CONTAINER (Max 520px) */}
      <div className={`w-full max-w-[500px] min-h-[100dvh] mx-auto flex flex-col justify-between p-4 sm:p-6 pt-safe pb-safe transition-colors ${
        isDark ? 'bg-black text-white sm:border-x sm:border-neutral-900 sm:shadow-2xl' : 'bg-[#f2f2f7] text-slate-900 sm:border-x sm:border-slate-200/80 sm:shadow-2xl'
      }`}>

        {/* 1. TOP HEADER & NAVIGATION */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBackToAttendance && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onBackToAttendance();
                }}
                className={`h-9 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  isDark ? 'bg-neutral-900 text-neutral-300 border border-neutral-800' : 'bg-white text-slate-700 border border-slate-200 shadow-2xs'
                }`}
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
                <span>دەوامی فەرمی</span>
              </button>
            )}

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-extrabold">
              <MessageSquareHeart className="w-3.5 h-3.5 text-amber-500" />
              <span>فیدباک و ڕاپرسی ئاشڵی</span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isDark 
                ? 'bg-neutral-900 border border-neutral-800 text-amber-400' 
                : 'bg-white border border-slate-200 text-slate-700 shadow-xs'
            }`}
            title="گۆڕینی ڕەنگ"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 🔒 SCREEN 1: 4-DIGIT PIN GATE */}
        {/* ===================================================================== */}
        {step === 'pin_gate' && (
          <div className="my-auto py-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Apple Icon Badge */}
            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-xl shadow-amber-500/20 mb-3 flex items-center justify-center">
              <div className={`w-full h-full rounded-[22px] flex items-center justify-center ${
                isDark ? 'bg-neutral-950' : 'bg-white'
              }`}>
                <MessageSquareHeart className="w-9 h-9 text-amber-500" />
              </div>
            </div>

            <h1 className={`text-2xl font-black tracking-tight mb-1 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              داخڵبوون بۆ بەشی فیدباک
            </h1>

            <p className={`text-xs max-w-xs font-semibold leading-relaxed mb-4 ${
              isDark ? 'text-neutral-400' : 'text-slate-500'
            }`}>
              تکایە کۆدی نهێنی چوار ژمارەیی (PIN) بنووسە کە لەلایەن ئیدارەوە بۆت دانراوە.
            </p>

            {/* Error Message */}
            {pinError && (
              <div className="w-full max-w-xs mb-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 text-right">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{pinError}</span>
              </div>
            )}

            {/* 4 Apple Passcode Indicator Dots */}
            <div className="my-4 flex items-center justify-center gap-4">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-150 ${
                      isFilled
                        ? 'bg-amber-500 scale-125 shadow-md shadow-amber-500/50'
                        : isDark
                        ? 'border-2 border-neutral-700 bg-transparent'
                        : 'border-2 border-slate-300 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>

            {/* Apple Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[280px] w-full mx-auto pt-2" dir="ltr">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={pinVerifying}
                  onClick={() => handleKeypadPress(digit)}
                  className={`h-13 rounded-2xl text-xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                    isDark 
                      ? 'bg-neutral-800/80 text-white hover:bg-neutral-700' 
                      : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs hover:bg-slate-50'
                  }`}
                >
                  {digit}
                </button>
              ))}

              {/* Clear / Delete */}
              <button
                type="button"
                disabled={pinVerifying}
                onClick={handleKeypadDelete}
                className={`h-13 rounded-2xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                  isDark ? 'bg-neutral-800/50 text-neutral-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="سڕینەوە"
              >
                <Delete className="w-5 h-5" />
              </button>

              {/* Digit 0 */}
              <button
                type="button"
                disabled={pinVerifying}
                onClick={() => handleKeypadPress('0')}
                className={`h-13 rounded-2xl text-xl font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                  isDark 
                    ? 'bg-neutral-800/80 text-white hover:bg-neutral-700' 
                    : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs hover:bg-slate-50'
                }`}
              >
                0
              </button>

              {/* Submit Button */}
              <button
                type="button"
                disabled={pinVerifying || pin.length !== 4}
                onClick={() => handleVerifyPin(pin)}
                className="h-13 rounded-2xl text-xs font-bold flex items-center justify-center bg-amber-500 text-slate-950 hover:bg-amber-600 transition-all cursor-pointer active:scale-90 disabled:opacity-40 shadow-xs"
                title="چوونەژوورەوە"
              >
                {pinVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              </button>
            </div>

            {/* Back to Attendance link */}
            {onBackToAttendance && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={onBackToAttendance}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 underline cursor-pointer"
                >
                  گەڕانەوە بۆ پەڕەی سەرەکی دەوام
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* 📝 SCREEN 2: FEEDBACK QUESTIONNAIRE */}
        {/* ===================================================================== */}
        {step === 'questionnaire' && (
          <form onSubmit={handleSubmitFeedback} className="my-auto py-4 space-y-4 animate-in fade-in duration-200">
            {/* Header info card */}
            <div className={`p-4 rounded-[24px] border flex items-center justify-between transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black">کۆدی فیدباک:</span>
                    <span className="font-mono text-xs font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md" dir="ltr">
                      {pin}
                    </span>
                  </div>
                  {verifiedPinData?.targetPhone && (
                    <span className="text-[11px] text-slate-400 font-mono block mt-0.5" dir="ltr">
                      {verifiedPinData.targetPhone}
                    </span>
                  )}
                </div>
              </div>

              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                ڕێگەپێدراوە
              </span>
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bold">{submitError}</span>
              </div>
            )}

            {/* SECTION 1: RESPONDENT & DEPARTMENT */}
            <div className={`p-4.5 rounded-[26px] border space-y-3 transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <h3 className="text-xs font-black flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-500" />
                <span>زانیاری سەرەتایی</span>
              </h3>

              <div>
                <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                  بەش / لقی کارکردن:
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={`w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none cursor-pointer ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="شۆڕووم و پێشانگا">شۆڕووم و پێشانگای سەرەکی (Showroom)</option>
                  <option value="کۆگاکان و گواستنەوە">کۆگاکان و گواستنەوە (Warehouse & Logistics)</option>
                  <option value="بەشی فرۆشتن">بەشی فرۆشتن و پەیوەندییەکان (Sales)</option>
                  <option value="بەشی ژمێریاری و ئیدارە">بەشی ژمێریاری و ئیدارە (Accounting)</option>
                  <option value="تەکنەلۆژیا و IT">تەکنەلۆژیا و پشتگیری تەکنیکی (IT)</option>
                  <option value="بەشەکانی تر">بەشەکانی تر</option>
                </select>
              </div>

              <div>
                <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-neutral-400' : 'text-slate-600'}`}>
                  ناوی بەشداربوو (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  value={respondentName}
                  onChange={(e) => setRespondentName(e.target.value)}
                  placeholder="دەتوانیت ناوت بنووسیت یان بە بەتاڵی جێیبهێڵیت..."
                  className={`w-full h-11 px-3 rounded-2xl border text-xs font-bold outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* SECTION 2: 5-STAR RATINGS */}
            <div className={`p-4.5 rounded-[26px] border space-y-3.5 transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <h3 className="text-xs font-black flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>هەڵسەنگاندنی ئەستێرەیی (١ بۆ ٥)</span>
              </h3>

              <StarRatingSelector
                label="١. ئاستی ڕازیبوونی گشتی لە کارەکەت لە کۆمپانیای ئاشڵی:"
                value={overallSatisfaction}
                onChange={setOverallSatisfaction}
              />

              <StarRatingSelector
                label="٢. ژینگەی کارکردن و کەشی گشتی کۆمپانیا:"
                value={workEnvironmentRating}
                onChange={setWorkEnvironmentRating}
              />

              <StarRatingSelector
                label="٣. هاوکاری و هەماهەنگی نێوان تیمەکان و کارمەندان:"
                value={teamCooperationRating}
                onChange={setTeamCooperationRating}
              />

              <StarRatingSelector
                label="٤. ڕێزگرتن، دادپەروەری و پشتیوانی لەلایەن بەڕێوەبەرایەتی:"
                value={managementFairnessRating}
                onChange={setManagementFairnessRating}
              />

              <StarRatingSelector
                label="٥. دابینکردنی پێداویستی، کەلوپەل و ئامرازەکانی کارکردن:"
                value={toolsAndEquipmentRating}
                onChange={setToolsAndEquipmentRating}
              />
            </div>

            {/* SECTION 3: MULTIPLE CHOICE QUESTIONS */}
            <div className={`p-4.5 rounded-[26px] border space-y-4 transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <h3 className="text-xs font-black flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span>پرسیارە سەرەکییەکان</span>
              </h3>

              {/* Question A */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-neutral-300' : 'text-slate-800'}`}>
                  • ئایا کاتەکانی دەوام و پشووەکان گونجاون؟
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {['بەڵێ زۆر گونجاوە', 'تا ڕادەیەک گونجاوە', 'گونجاو نییە و پێویستی بە چاککردنە'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShiftHoursSuitability(opt);
                      }}
                      className={`p-3 rounded-2xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        shiftHoursSuitability === opt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : isDark
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question B */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-neutral-300' : 'text-slate-800'}`}>
                  • کام بەشە زیاتر پێویستی بە گەشەپێدان و چاکسازی هەیە؟
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'شۆڕووم و پێشانگا',
                    'کۆگاکان و گەیاندن',
                    'سیستەمی IT و ئەپ',
                    'ژمێریاری و مووچە',
                    'هەماهەنگی تیمەکان',
                    'هیچ، هەمووی باشە'
                  ].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setDepartmentNeedingImprovement(opt);
                      }}
                      className={`p-2.5 rounded-2xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                        departmentNeedingImprovement === opt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : isDark
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question C */}
              <div>
                <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-neutral-300' : 'text-slate-800'}`}>
                  • ئەزموونت لەگەڵ ئەپی مۆبایل و تۆمارکردنی دەوام:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['نایاب و خێرایە', 'باشە', 'ئاساییە', 'کێشەی هەیە'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setAppExperienceRating(opt);
                      }}
                      className={`p-2.5 rounded-2xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                        appExperienceRating === opt
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                          : isDark
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 4: OPEN-ENDED FEEDBACK */}
            <div className={`p-4.5 rounded-[26px] border space-y-3.5 transition-all ${
              isDark ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <h3 className="text-xs font-black flex items-center gap-2">
                <ThumbsUp className="w-4 h-4 text-amber-500" />
                <span>سەرنج و پێشنیارەکانت (بە دەستی خۆت بنووسە)</span>
              </h3>

              <div>
                <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-neutral-300' : 'text-slate-700'}`}>
                  • ئەو خاڵە ئەرێنی و بەهێزانەی لە ئاشڵی سەرنجت ڕادەکێشن:
                </label>
                <textarea
                  rows={2}
                  value={positiveHighlights}
                  onChange={(e) => setPositiveHighlights(e.target.value)}
                  placeholder="بۆ نموونە: کەشی هاوڕێیانە، ڕێزگرتن، کەرەستەی باش..."
                  className={`w-full p-3 rounded-2xl border text-xs outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-neutral-300' : 'text-slate-700'}`}>
                  • ئایا هیچ ئاستەنگ یان کێشەیەک هەیە کە دەتەوێت ئیدارە ئاگاداری بێت؟
                </label>
                <textarea
                  rows={2}
                  value={workplaceChallenges}
                  onChange={(e) => setWorkplaceChallenges(e.target.value)}
                  placeholder="ئەگەر کێشەیەک یان بێزارییەک هەیە، بە دڵنیاییەوە لێرە بینووسە..."
                  className={`w-full p-3 rounded-2xl border text-xs outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-neutral-300' : 'text-slate-700'}`}>
                  • پێشنیار یان هەر پەیامێکی تر بۆ بەڕێوەبەرایەتی ئاشڵی:
                </label>
                <textarea
                  rows={2}
                  value={suggestionsForManagement}
                  onChange={(e) => setSuggestionsForManagement(e.target.value)}
                  placeholder="پێشنیارەکانت بۆ گەشەپێدان و داهاتوو..."
                  className={`w-full p-3 rounded-2xl border text-xs outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                ) : (
                  <>
                    <Send className="w-4.5 h-4.5 text-slate-950" />
                    <span>ناردنی فیدباکەکە بە سەرکەوتوویی</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================== */}
        {/* 🎉 SCREEN 3: SUCCESS CONFIRMATION */}
        {/* ===================================================================== */}
        {step === 'success' && (
          <div className="my-auto py-10 flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-300">
            {/* Success Checkmark Circle */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-500 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className={`text-2xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              سوپاس بۆ فیدباکەکەت!
            </h2>

            <p className={`text-xs max-w-sm leading-relaxed mb-6 font-semibold ${
              isDark ? 'text-neutral-300' : 'text-slate-600'
            }`}>
              ڕا و سەرنجەکانت بە سەرکەوتوویی و بە شێوەیەکی پارێزراو گەیشتە دەست بەڕێوەبەرایەتی کۆمپانیای ئاشڵی هۆم ستۆر. هەمیشە هەوڵ دەدەین ژینگەیەکی نموونەیی بۆ ئێوە دابین بکەین.
            </p>

            {onBackToAttendance ? (
              <button
                type="button"
                onClick={onBackToAttendance}
                className="h-12 px-6 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
              >
                <span>گەڕانەوە بۆ پەڕەی سەرەکی دەوام</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep('pin_gate');
                  setPin('');
                  setVerifiedPinData(null);
                }}
                className="h-12 px-6 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
              >
                <span>داخڵکردنی فیدباکێکی تر</span>
              </button>
            )}
          </div>
        )}

        {/* 3. FOOTER */}
        <div className="pb-2 text-center">
          <p className={`text-[11px] font-medium ${isDark ? 'text-neutral-500' : 'text-slate-400'}`}>
            کۆمپانیای ئاشڵی هۆم ستۆر • سیستەمی دیوان ٢٠٢٦
          </p>
        </div>

      </div>

    </div>
  );
}
