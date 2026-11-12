'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import AshleyMobileApp from '@/components/mobile-app/AshleyMobileApp';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { ManagerEvaluationForm } from '@/components/feedback/ManagerEvaluationForm';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { 
  Loader2, 
  ArrowRight, 
  Boxes, 
  MessageSquareHeart, 
  Building2, 
  Fingerprint, 
  ShieldCheck, 
  Home, 
  Sparkles,
  ChevronLeft, 
  Lock,
  Unlock,
  KeyRound,
  Delete,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sun,
  Moon
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';
import { PinScope } from '@/lib/feedback/feedback-service';
import {
  getClientSubmissionIds,
  clearClientSubmissionIds,
} from '@/lib/feedback/submitted-pins-client';

export type ActivePortal = 'home' | 'attendance' | 'feedback_hub' | 'feedback' | 'feedback_admin' | 'warehouse';

function playAudioChime(success: boolean) {
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
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {}
}

/** Custom metallic-gold Boss emblem SVG */
function BossMetalLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bossGoldGrad" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="48%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="bossTieGrad" x1="32" y1="38" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78350F" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
      </defs>
      {/* Executive Crown */}
      <path
        d="M19 17.5L22 10L27 14L32 8L37 14L42 10L45 17.5H19Z"
        fill="url(#bossGoldGrad)"
      />
      <rect x="20" y="18.5" width="24" height="2.6" rx="1.3" fill="url(#bossGoldGrad)" />
      {/* Boss Head */}
      <circle cx="32" cy="29" r="7.5" fill="url(#bossGoldGrad)" />
      {/* Suit Shoulders & Collar */}
      <path
        d="M14 53C14 43.8 21.8 39 32 39C42.2 39 50 43.8 50 53C50 54.6 48.7 56 47 56H17C15.3 56 14 54.6 14 53Z"
        fill="url(#bossGoldGrad)"
      />
      {/* Suit Tie */}
      <path d="M29.2 39.2L32 43.5L34.8 39.2L33.5 52.8L32 55L30.5 52.8L29.2 39.2Z" fill="url(#bossTieGrad)" />
    </svg>
  );
}

/** Custom brushed-silver multi-person team emblem SVG */
function TeamMetalLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="teamSilverGrad" x1="8" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F1F5F9" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      {/* Left Person */}
      <circle cx="17" cy="24" r="5.2" fill="url(#teamSilverGrad)" opacity="0.88" />
      <path
        d="M7.5 46C7.5 39.2 11.7 35 17.5 35C20 35 22.1 35.8 23.8 37.2C21.2 39.6 19.8 43.2 19.6 47.5H9.2C8.2 47.5 7.5 46.8 7.5 46Z"
        fill="url(#teamSilverGrad)"
        opacity="0.88"
      />
      {/* Right Person */}
      <circle cx="47" cy="24" r="5.2" fill="url(#teamSilverGrad)" opacity="0.88" />
      <path
        d="M56.5 46C56.5 39.2 52.3 35 46.5 35C44 35 41.9 35.8 40.2 37.2C42.8 39.6 44.2 43.2 44.4 47.5H54.8C55.8 47.5 56.5 46.8 56.5 46Z"
        fill="url(#teamSilverGrad)"
        opacity="0.88"
      />
      {/* Center Lead Person */}
      <circle cx="32" cy="21" r="6.5" fill="url(#teamSilverGrad)" />
      <path
        d="M19.5 48.5C19.5 40.4 24.8 35.5 32 35.5C39.2 35.5 44.5 40.4 44.5 48.5C44.5 49.9 43.4 51 42 51H22C20.6 51 19.5 49.9 19.5 48.5Z"
        fill="url(#teamSilverGrad)"
      />
    </svg>
  );
}

function RootPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const pinParam = searchParams.get('pin') || '';

  const [activePortal, setActivePortal] = useState<ActivePortal>(() => {
    if (tabParam === 'feedback_admin' || tabParam === 'manager_feedback' || tabParam === 'manager_evaluation') {
      return 'feedback_admin';
    }
    if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      return 'feedback';
    }
    if (tabParam === 'feedback_hub') {
      return 'feedback_hub';
    }
    if (tabParam === 'warehouse' || tabParam === 'audit' || tabParam === 'sheets_warehouse' || tabParam === 'inventory') {
      return 'warehouse';
    }
    if (tabParam === 'attendance' || tabParam === 'checkin' || tabParam === 'punch') {
      return 'attendance';
    }
    return 'home';
  });

  // 🔐 Authentication States for PIN Protected Sections
  const [managerAuthed, setManagerAuthed] = useState<boolean>(false);
  const [managerPin, setManagerPin] = useState<string>('');
  const [warehouseAuthed, setWarehouseAuthed] = useState<boolean>(false);

  // 🔑 PIN Gate Modal State
  const [pinModalScope, setPinModalScope] = useState<PinScope | null>(null);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAlreadySubmitted, setPinAlreadySubmitted] = useState<boolean>(false);
  const [shakeDots, setShakeDots] = useState<boolean>(false);

  // 🌓 Theme State: Light / Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      return saved === 'dark';
    }
    return false;
  });

  const toggleTheme = useCallback(() => {
    triggerHaptic('light');
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ashley_theme', next ? 'dark' : 'light');
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        window.dispatchEvent(new CustomEvent('ashley-theme-change', { detail: { isDark: next } }));
      }
      return next;
    });
  }, []);

  // Sync theme with system and other tabs/components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      const darkActive = saved === 'dark';
      setIsDark(darkActive);
      if (darkActive) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      const handleThemeChange = (e: any) => {
        if (e?.detail?.isDark !== undefined) {
          setIsDark(e.detail.isDark);
          if (e.detail.isDark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      };
      window.addEventListener('ashley-theme-change', handleThemeChange);
      return () => window.removeEventListener('ashley-theme-change', handleThemeChange);
    }
  }, []);

  const renderThemeButton = (size: 'sm' | 'md' = 'md') => (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${size === 'sm' ? 'w-8 h-8 rounded-xl' : 'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl'} flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs shrink-0 ${
        isDark
          ? 'bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-amber-400/40 shadow-slate-950/60'
          : 'bg-white border border-slate-200 text-amber-600 hover:bg-slate-50 hover:border-amber-300 shadow-slate-200/80'
      }`}
      title={isDark ? 'گۆڕین بۆ لایت مۆد (ڕۆشن)' : 'گۆڕین بۆ دارک مۆد (تاریک)'}
      aria-label="گۆڕینی ڕەنگ (Light / Dark Mode)"
    >
      {isDark ? (
        <Sun className={`${size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5 sm:w-5 sm:h-5'} text-amber-400 transition-transform hover:rotate-45`} />
      ) : (
        <Moon className={`${size === 'sm' ? 'w-4 h-4' : 'w-4.5 h-4.5 sm:w-5 sm:h-5'} text-slate-700 transition-transform hover:-rotate-12`} />
      )}
    </button>
  );

  // Check stored sessions on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedWarehouse = sessionStorage.getItem('ashley_warehouse_auth_pin');
      if (savedWarehouse && /^\d{5}$/.test(savedWarehouse)) {
        setWarehouseAuthed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (tabParam === 'feedback_admin' || tabParam === 'manager_feedback' || tabParam === 'manager_evaluation') {
      setActivePortal('feedback_admin');
    } else if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      setActivePortal('feedback');
    } else if (tabParam === 'feedback_hub') {
      setActivePortal('feedback_hub');
    } else if (tabParam === 'warehouse' || tabParam === 'audit' || tabParam === 'sheets_warehouse' || tabParam === 'inventory') {
      setActivePortal('warehouse');
    } else if (tabParam === 'attendance' || tabParam === 'checkin' || tabParam === 'punch') {
      setActivePortal('attendance');
    } else if (tabParam === 'home') {
      setActivePortal('home');
    }
  }, [tabParam, pinParam]);

  const handleSwitchPortal = (portal: ActivePortal) => {
    triggerHaptic('medium');
    setActivePortal(portal);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (portal === 'home') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', portal);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // 🔑 Open PIN Gate Modal for specific scope
  const openPinModal = (scope: PinScope) => {
    triggerHaptic('medium');
    setPinModalScope(scope);
    setEnteredPin('');
    setPinError(null);
    setPinAlreadySubmitted(false);
    setShakeDots(false);
  };

  const closePinModal = () => {
    setPinModalScope(null);
    setEnteredPin('');
    setPinError(null);
    setPinAlreadySubmitted(false);
    setShakeDots(false);
  };

  // 🔓 Open Warehouse with 5-digit PIN check
  const handleOpenWarehouse = () => {
    if (warehouseAuthed) {
      handleSwitchPortal('warehouse');
      return;
    }
    openPinModal('warehouse');
  };

  // 🔓 Open Manager Evaluation Form with 0000-5999 PIN check
  const handleOpenManagerFeedback = () => {
    if (managerAuthed && managerPin) {
      handleSwitchPortal('feedback_admin');
      return;
    }
    openPinModal('manager_feedback');
  };

  // 🔓 Open Staff Feedback with 6000-9999 PIN check
  const handleOpenStaffFeedback = () => {
    openPinModal('staff_feedback');
  };

  // 🔒 Lock / Logout Handlers
  const handleLockWarehouse = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ashley_warehouse_auth_pin');
    }
    setWarehouseAuthed(false);
    handleSwitchPortal('home');
  };

  const handleLockManager = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ashley_manager_auth_pin');
    }
    setManagerPin('');
    setManagerAuthed(false);
    handleSwitchPortal('feedback_hub');
  };

  // 🔢 Verify PIN through API
  const submitPinCandidate = useCallback(async (pinToTest: string, scopeToTest: PinScope) => {
    const requiredLen = scopeToTest === 'warehouse' ? 5 : 4;
    if (pinToTest.length !== requiredLen) {
      setPinAlreadySubmitted(false);
      setPinError(`تکایە بە تەواوی ${requiredLen} ژمارە بنووسە.`);
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
          expectedScope: scopeToTest,
          clientSubmissionIds: getClientSubmissionIds(pinToTest),
        }),
      });

      const data = await res.json();
      if (data.valid && data.pinData) {
        clearClientSubmissionIds(pinToTest);
        setPinAlreadySubmitted(false);
        triggerHaptic('success');
        playAudioChime(true);
        closePinModal();

        if (scopeToTest === 'manager_feedback') {
          setManagerPin(pinToTest);
          setManagerAuthed(true);
          handleSwitchPortal('feedback_admin');
        } else if (scopeToTest === 'warehouse') {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('ashley_warehouse_auth_pin', pinToTest);
          }
          setWarehouseAuthed(true);
          handleSwitchPortal('warehouse');
        } else if (scopeToTest === 'staff_feedback') {
          handleSwitchPortal('feedback');
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'feedback');
            url.searchParams.set('pin', pinToTest);
            window.history.replaceState({}, '', url.toString());
          }
        }
      } else {
        const alreadyDone = Boolean(data.alreadySubmitted);
        triggerHaptic('error');
        playAudioChime(false);
        setPinAlreadySubmitted(alreadyDone);
        setPinError(
          data.error ||
            (alreadyDone
              ? 'تۆ فیدباکت کردووە، دەست خۆش بێت!'
              : 'کۆدی PIN هەڵەیە یان ڕێگەی پێنەدراوە.')
        );
        setShakeDots(true);
        setTimeout(() => {
          setShakeDots(false);
          setEnteredPin('');
        }, 600);
      }
    } catch {
      triggerHaptic('error');
      playAudioChime(false);
      setPinAlreadySubmitted(false);
      setPinError('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
      setEnteredPin('');
    } finally {
      setPinVerifying(false);
    }
  }, []);

  // ⌨️ Keypad Press Handler
  const handleKeypadPress = (digit: string) => {
    if (!pinModalScope || pinVerifying) return;
    const requiredLen = pinModalScope === 'warehouse' ? 5 : 4;
    if (enteredPin.length >= requiredLen) return;

    triggerHaptic('light');
    playAudioChime(true);
    const nextPin = enteredPin + digit;
    setEnteredPin(nextPin);
    setPinError(null);
    setPinAlreadySubmitted(false);

    if (nextPin.length === requiredLen) {
      setTimeout(() => {
        submitPinCandidate(nextPin, pinModalScope);
      }, 100);
    }
  };

  const handleKeypadDelete = () => {
    if (pinVerifying || enteredPin.length === 0) return;
    triggerHaptic('light');
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(null);
    setPinAlreadySubmitted(false);
  };

  const handleKeypadClear = () => {
    if (pinVerifying) return;
    triggerHaptic('light');
    setEnteredPin('');
    setPinError(null);
  };

  // ===========================================================================
  // 🔘 VIEW 1: MAIN HOME SCREEN WITH 3 MODERN LIQUID-GLASS & METAL CIRCLES
  // ===========================================================================
  if (activePortal === 'home') {
    return (
      <div
        className={`min-h-[100dvh] w-full select-none font-sans flex flex-col justify-between transition-colors duration-300 relative overflow-hidden ${
          isDark
            ? 'bg-gradient-to-b from-slate-950 via-[#090d16] to-slate-950 text-white'
            : 'bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-900'
        }`}
        dir="rtl"
      >
        {/* Ambient Soft Motion Mesh Lights */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className={`absolute -top-28 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full blur-3xl animate-ambient-breathe ${
              isDark ? 'bg-rose-500/12' : 'bg-rose-400/18'
            }`}
          />
          <div
            className={`absolute bottom-12 right-6 w-80 h-80 rounded-full blur-3xl animate-ambient-breathe ${
              isDark ? 'bg-amber-500/10' : 'bg-amber-400/16'
            }`}
          />
          <div
            className={`absolute bottom-12 left-6 w-80 h-80 rounded-full blur-3xl animate-ambient-breathe ${
              isDark ? 'bg-blue-500/10' : 'bg-blue-400/16'
            }`}
          />
        </div>

        {/* Minimal Floating Glass App Bar */}
        <header className="relative z-10 w-full max-w-lg md:max-w-2xl mx-auto px-4 pt-safe pt-3 pb-2 flex items-center justify-between">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-xl shadow-xs transition-colors ${
              isDark ? 'bg-slate-900/65 border-white/10' : 'bg-white/75 border-white/80'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-[11px] font-bold font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Ashley 2026
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              گروپی دیوان
            </span>
            {renderThemeButton('md')}
          </div>
        </header>

        {/* 📱 3-CIRCLE LIQUID-GLASS & METAL HERO HUB */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-md sm:max-w-xl md:max-w-2xl mx-auto w-full my-auto">
          {/* Clean Minimal Brand Header */}
          <div className="text-center mb-7 sm:mb-9">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-[20px] mx-auto mb-3 p-[1.5px] metal-ring-amber shadow-xl shadow-amber-500/20 overflow-hidden">
              <div
                className={`relative w-full h-full rounded-[19px] flex items-center justify-center overflow-hidden ${
                  isDark ? 'bg-slate-950/90 text-amber-400' : 'bg-white/95 text-amber-500'
                }`}
              >
                <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-glass-sheen pointer-events-none" />
                <Building2 className="w-7 h-7 sm:w-8 sm:h-8 relative z-10" />
              </div>
            </div>

            <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ئاشڵی هۆم ستۆر
            </h1>
          </div>

          {/* =================================================================== */}
          {/* 🔘 THE THREE MODERN GLASS-METAL CIRCLES (فیدباک لە سەرەوە) */}
          {/* =================================================================== */}
          <div className="w-full flex flex-col items-center gap-7 sm:gap-9 my-auto">
            {/* ⭕ بازنەی ١ (سەرەوە - سەرەکی): فیدباک */}
            <div className="relative flex flex-col items-center animate-float-gentle">
              {/* Soft Breathing Halo */}
              <div
                className={`absolute -inset-3 rounded-full blur-2xl pointer-events-none animate-ambient-breathe ${
                  isDark ? 'bg-rose-500/25' : 'bg-rose-400/30'
                }`}
              />

              <button
                type="button"
                onClick={() => handleSwitchPortal('feedback_hub')}
                className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full p-[2px] cursor-pointer active:scale-[0.94] hover:-translate-y-1 transition-all duration-200 group shadow-2xl shadow-rose-500/25"
              >
                {/* Rotating Metallic Conic Rim */}
                <span className="absolute inset-0 rounded-full metal-ring-rose animate-orbit-slow opacity-90 group-hover:opacity-100" />

                {/* Frosted Liquid Glass Core */}
                <div
                  className={`relative w-full h-full rounded-full liquid-glass-sphere flex flex-col items-center justify-center p-3 text-center overflow-hidden transition-colors ${
                    isDark
                      ? 'bg-slate-950/80 group-hover:bg-slate-900/75'
                      : 'bg-white/80 group-hover:bg-white/90'
                  }`}
                >
                  {/* Diagonal Glass Sheen Sweep */}
                  <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-glass-sheen pointer-events-none" />

                  <div
                    className={`relative z-10 w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 ${
                      isDark
                        ? 'bg-rose-500/15 border-rose-400/30 text-rose-300 shadow-inner'
                        : 'bg-gradient-to-br from-rose-50 to-white border-rose-200/80 text-rose-500 shadow-sm'
                    }`}
                  >
                    <MessageSquareHeart className="w-7 h-7" />
                  </div>

                  <span className={`relative z-10 text-lg sm:text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    فیدباک
                  </span>

                  <span
                    className={`relative z-10 mt-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold flex items-center gap-1 ${
                      isDark
                        ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>چالاکە</span>
                  </span>
                </div>
              </button>
            </div>

            {/* ⭕⭕ بازنەی ٢ و ٣ (خوارەوە: ئامادەبوون • کۆگا) */}
            <div className="w-full flex items-center justify-center gap-7 sm:gap-14">
              {/* ⭕ بازنەی دەستە ڕاست: ئامادەبوون */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`absolute -inset-2 rounded-full blur-xl pointer-events-none ${
                    isDark ? 'bg-amber-500/15' : 'bg-amber-400/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleSwitchPortal('attendance')}
                  className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full p-[2px] cursor-pointer active:scale-[0.94] hover:-translate-y-1 transition-all duration-200 group shadow-xl shadow-amber-500/20"
                >
                  <span className="absolute inset-0 rounded-full metal-ring-amber animate-orbit-reverse opacity-85 group-hover:opacity-100" />
                  <div
                    className={`relative w-full h-full rounded-full liquid-glass-sphere flex flex-col items-center justify-center p-2.5 text-center overflow-hidden ${
                      isDark
                        ? 'bg-slate-950/80 group-hover:bg-slate-900/75'
                        : 'bg-white/80 group-hover:bg-white/90'
                    }`}
                  >
                    <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-glass-sheen pointer-events-none" />
                    <div
                      className={`relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform duration-200 ${
                        isDark
                          ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                          : 'bg-gradient-to-br from-amber-50 to-white border-amber-200/80 text-amber-600 shadow-xs'
                      }`}
                    >
                      <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className={`relative z-10 text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ئامادەبوون
                    </span>
                    <span
                      className={`relative z-10 mt-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold flex items-center gap-1 ${
                        isDark
                          ? 'bg-amber-500/10 border-amber-400/25 text-amber-300'
                          : 'bg-amber-50/90 border-amber-200 text-amber-700'
                      }`}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>دەوام</span>
                    </span>
                  </div>
                </button>
              </div>

              {/* ⭕ بازنەی دەستە چەپ: کۆگا */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`absolute -inset-2 rounded-full blur-xl pointer-events-none ${
                    isDark ? 'bg-blue-500/15' : 'bg-blue-400/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleOpenWarehouse}
                  className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full p-[2px] cursor-pointer active:scale-[0.94] hover:-translate-y-1 transition-all duration-200 group shadow-xl shadow-blue-500/20"
                >
                  <span className="absolute inset-0 rounded-full metal-ring-blue animate-orbit-slow opacity-85 group-hover:opacity-100" />
                  <div
                    className={`relative w-full h-full rounded-full liquid-glass-sphere flex flex-col items-center justify-center p-2.5 text-center overflow-hidden ${
                      isDark
                        ? 'bg-slate-950/80 group-hover:bg-slate-900/75'
                        : 'bg-white/80 group-hover:bg-white/90'
                    }`}
                  >
                    <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-glass-sheen pointer-events-none" />
                    <div
                      className={`relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform duration-200 ${
                        isDark
                          ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                          : 'bg-gradient-to-br from-blue-50 to-white border-blue-200/80 text-blue-600 shadow-xs'
                      }`}
                    >
                      <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className={`relative z-10 text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      کۆگا
                    </span>
                    <span
                      className={`relative z-10 mt-1 px-2 py-0.5 rounded-full border text-[9.5px] font-bold flex items-center gap-1 ${
                        isDark
                          ? 'bg-blue-500/10 border-blue-400/25 text-blue-300'
                          : 'bg-blue-50/90 border-blue-200 text-blue-700'
                      }`}
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>جەرد</span>
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Minimal Footer */}
        <footer
          className={`relative z-10 w-full text-center pb-safe pb-4 pt-2 text-[11px] font-medium ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          ئاشڵی هۆم ستۆر • ٢٠٢٦
        </footer>

        {/* 🔐 PIN GATE MODAL POPUP */}
        {renderPinModal()}
      </div>
    );
  }

  // ===========================================================================
  // 💬 VIEW 2: FEEDBACK HUB (بەڕێوەبەر لە سەرەوە ئەکتیف + کارمەندان چاوەڕوانی)
  // ===========================================================================
  if (activePortal === 'feedback_hub') {
    return (
      <div
        className={`min-h-[100dvh] w-full select-none font-sans flex flex-col justify-between transition-colors duration-300 relative overflow-hidden ${
          isDark
            ? 'bg-gradient-to-b from-slate-950 via-[#0b0f19] to-slate-950 text-white'
            : 'bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-900'
        }`}
        dir="rtl"
      >
        {/* Ambient Liquid Background Glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className={`absolute top-12 left-1/2 -translate-x-1/2 w-[380px] h-[380px] rounded-full blur-3xl animate-ambient-breathe ${
              isDark ? 'bg-amber-500/12' : 'bg-amber-400/18'
            }`}
          />
          <div
            className={`absolute bottom-10 right-1/3 w-72 h-72 rounded-full blur-3xl ${
              isDark ? 'bg-slate-600/10' : 'bg-slate-300/25'
            }`}
          />
        </div>

        {/* Clean Top Header */}
        <header
          className={`sticky top-0 z-40 backdrop-blur-xl border-b px-4 py-3 flex items-center justify-between transition-colors ${
            isDark ? 'bg-slate-900/75 border-white/10 text-white' : 'bg-white/80 border-slate-200/80 text-slate-900 shadow-2xs'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSwitchPortal('home')}
            className={`h-9 px-3.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-white border-white/10'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
            }`}
          >
            <Home className="w-4 h-4 text-amber-500" />
            <span>سەرەکی</span>
          </button>

          <div className="flex items-center gap-3">
            <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              بەشی فیدباک
            </h2>
            {renderThemeButton('sm')}
          </div>
        </header>

        {/* Minimal Glass & Metallic Feedback Cards */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-md sm:max-w-lg mx-auto w-full my-auto space-y-5">
          <div className="w-full space-y-4">
            {/* 🏆 Card 1 (TOP — ACTIVE): هەڵسەنگاندنی بەڕێوەبەر */}
            <button
              type="button"
              onClick={handleOpenManagerFeedback}
              className={`w-full p-5 sm:p-6 rounded-[30px] border text-right transition-all duration-200 cursor-pointer active:scale-[0.97] hover:-translate-y-0.5 group relative overflow-hidden metal-card-gold ${
                isDark
                  ? 'bg-gradient-to-br from-slate-900/85 via-slate-900/75 to-amber-950/35 border-amber-400/35 hover:border-amber-400/65'
                  : 'bg-gradient-to-br from-white/90 via-white/80 to-amber-50/75 border-amber-300/70 hover:border-amber-400'
              }`}
            >
              {/* Diagonal Liquid Glass Sheen */}
              <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent animate-glass-sheen pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Metallic Gold Boss Medallion */}
                  <div className="relative w-16 h-16 rounded-2xl p-[1.5px] metal-ring-amber shadow-lg shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform duration-200">
                    <div
                      className={`w-full h-full rounded-[15px] flex items-center justify-center ${
                        isDark ? 'bg-slate-950/90' : 'bg-gradient-to-br from-amber-50 to-white'
                      }`}
                    >
                      <BossMetalLogo className="w-11 h-11" />
                    </div>
                  </div>

                  {/* Strictly Minimal Title + Code Range */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        هەڵسەنگاندنی بەڕێوەبەر
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          isDark
                            ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ئەکتیفە</span>
                      </span>
                    </div>

                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-mono font-black ${
                        isDark
                          ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                          : 'bg-amber-100/80 border-amber-300/80 text-amber-900'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                      <span>کۆد: 0 تا 5999</span>
                    </div>
                  </div>
                </div>

                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0 group-hover:-translate-x-1 transition-transform">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>
            </button>

            {/* ⏳ Card 2 (BOTTOM — PENDING / چاوەڕوانی): فیدباکی کارمەندان */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={`w-full p-5 sm:p-6 rounded-[30px] border text-right relative overflow-hidden cursor-not-allowed opacity-75 metal-card-silver ${
                isDark
                  ? 'bg-slate-900/55 border-slate-700/60'
                  : 'bg-white/65 border-slate-200/90'
              }`}
            >
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Frosted Brushed-Silver Multi-Person Medallion */}
                  <div
                    className={`w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0 ${
                      isDark
                        ? 'bg-slate-950/75 border-slate-700/70'
                        : 'bg-gradient-to-br from-slate-100 to-white border-slate-200'
                    }`}
                  >
                    <TeamMetalLogo className="w-11 h-11" />
                  </div>

                  {/* Strictly Minimal Title + Pending Status */}
                  <div className="space-y-2">
                    <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      فیدباکی کارمەندان
                    </h3>

                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-black ${
                        isDark
                          ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>چاوەڕوانی</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${
                    isDark
                      ? 'bg-slate-800/70 border-slate-700 text-slate-500'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </button>
          </div>
        </main>

        <footer className={`relative z-10 w-full text-center pb-safe pb-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          ئاشڵی هۆم ستۆر • ٢٠٢٦
        </footer>

        {/* 🔐 PIN GATE MODAL POPUP */}
        {renderPinModal()}
      </div>
    );
  }

  // ===========================================================================
  // 📝 VIEW 3: STAFF FEEDBACK PORTAL (فیدباکی کارمەندان لە ڕێی PIN)
  // ===========================================================================
  if (activePortal === 'feedback') {
    return (
      <div className={`min-h-[100dvh] font-sans flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`} dir="rtl">
        {/* Navigation Bar back to Hub or Home */}
        <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-rose-500" />
              <span>گەڕانەوە بۆ فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
              title="پەڕەی سەرەکی"
            >
              <Home className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">سەرەکی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenManagerFeedback}
              className={`h-9 px-3.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>فیدباکی بەڕێوەبەر</span>
            </button>

            {renderThemeButton('sm')}
          </div>
        </header>

        <main className="flex-1">
          <FeedbackPortal 
            initialPin={pinParam} 
            isDark={isDark}
            onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)} 
            onBackToMobileApp={() => handleSwitchPortal('home')} 
          />
        </main>

        {renderPinModal()}
      </div>
    );
  }

  // ===========================================================================
  // 📝 VIEW 4: CONFIDENTIAL MANAGER EVALUATION FORM (0000 - 5999)
  // ===========================================================================
  if (activePortal === 'feedback_admin') {
    // If PIN is not yet verified, prompt for 0000 - 5999 form access PIN
    if (!managerAuthed || !managerPin) {
      return (
        <div className={`min-h-[100dvh] font-sans flex flex-col justify-between transition-colors duration-200 ${
          isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
        }`} dir="rtl">
          <header className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-amber-500" />
              <span>گەڕانەوە</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500">فۆرمی هەڵسەنگاندنی بەڕێوەبەر</span>
              {renderThemeButton('sm')}
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`w-full max-w-sm text-center p-6 rounded-3xl border transition-colors ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xl'
            }`}>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className={`text-xl font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                فۆرمی نهێنی هەڵسەنگاندنی بەڕێوەبەر
              </h2>
              <p className={`text-xs mb-6 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                پێویستە کۆدی PINی ٤ ژمارەیی (0000 بۆ 5999) بنووسیت بۆ کردنەوەی فۆرمە بێ‌ناوەکە.
              </p>
              <button
                type="button"
                onClick={() => openPinModal('manager_feedback')}
                className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <KeyRound className="w-5 h-5" />
                <span>لێدانی کۆدی چوونەژوورەوە</span>
              </button>
            </div>
          </main>

          <footer className={`text-center pb-4 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
            گروپی دیوان • کۆمپانیای ئاشڵی
          </footer>
          {renderPinModal()}
        </div>
      );
    }

    return (
      <div className={`min-h-[100dvh] font-sans flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`} dir="rtl">
        <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs transition-colors ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-amber-500" />
              <span>گەڕانەوە بۆ فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
              title="پەڕەی سەرەکی"
            >
              <Home className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">سەرەکی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLockManager}
              className="h-9 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="دەرچوون و گۆڕینی کۆدی PIN"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>گۆڕینی PIN</span>
            </button>

            <button
              type="button"
              onClick={handleOpenStaffFeedback}
              className={`h-9 px-3.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isDark
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  : 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100'
              }`}
            >
              <MessageSquareHeart className="w-4 h-4 text-rose-500" />
              <span>فیدباکی کارمەندان</span>
            </button>

            {renderThemeButton('sm')}
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 max-w-5xl mx-auto w-full">
          <ManagerEvaluationForm
            pin={managerPin}
            isDark={isDark}
            onResetToPinGate={() => {
              setManagerPin('');
              setManagerAuthed(false);
              openPinModal('manager_feedback');
            }}
            onSubmissionSuccess={() => {
              setManagerAuthed(false);
            }}
            onBackToHub={() => handleSwitchPortal('feedback_hub')}
          />
        </main>

        {renderPinModal()}
      </div>
    );
  }

  // ===========================================================================
  // 📦 VIEW 5: WAREHOUSE & STOCKTAKE (بەشی جەرد و بار داگرتن بە PINی ٥ ژمارە)
  // ===========================================================================
  if (activePortal === 'warehouse') {
    // If not authenticated, force 5-digit PIN gate view
    if (!warehouseAuthed) {
      return (
        <div className={`min-h-[100dvh] font-sans flex flex-col justify-between transition-colors duration-200 ${
          isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
        }`} dir="rtl">
          <header className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              <Home className="w-4 h-4 text-amber-500" />
              <span>پەڕەی سەرەکی</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-500">بەشی کۆگا و جەرد</span>
              {renderThemeButton('sm')}
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`w-full max-w-sm text-center p-6 rounded-3xl border transition-colors ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xl'
            }`}>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className={`text-xl font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                بەشی کۆگا پارێزراوە
              </h2>
              <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                پێویستە کۆدی نهێنی ٥ ژمارەیی ڕێگەپێدراوی کۆگا بنووسیت (10000 تا 99999).
              </p>
              <button
                type="button"
                onClick={() => openPinModal('warehouse')}
                className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <KeyRound className="w-5 h-5" />
                <span>لێدانی کۆدی ٥ ژمارەیی کۆگا</span>
              </button>
            </div>
          </main>

          <footer className={`text-center pb-4 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
            گروپی دیوان • کۆمپانیای ئاشڵی
          </footer>
          {renderPinModal()}
        </div>
      );
    }

    return (
      <div className={`min-h-[100dvh] font-sans flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`} dir="rtl">
        {/* Navigation Bar back to Home */}
        <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs transition-colors ${
          isDark ? 'bg-slate-900/95 border-slate-800 text-white' : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className={`h-9 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span>پەڕەی سەرەکی</span>
            </button>

            <span className={`text-xs font-black hidden sm:inline ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
              | بەشی کۆگا: داگرتنی بار و جەرد
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLockWarehouse}
              className="h-9 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="دەرچوون و قفڵکردنی کۆگا"
            >
              <Lock className="w-3.5 h-3.5 text-rose-500" />
              <span>قفڵکردن</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className={`h-9 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-rose-500" />
              <span>فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('attendance')}
              className={`h-9 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
              <span>ئامادەبوون</span>
            </button>

            {renderThemeButton('sm')}
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto w-full">
          <GoogleSheetsWarehouseAudit 
            onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)}
            onBackToMobileApp={() => handleSwitchPortal('home')}
            isMobileEmbedded={true}
          />
        </main>

        {renderPinModal()}
      </div>
    );
  }

  // ===========================================================================
  // 🕒 VIEW 6: ATTENDANCE & CHECK-IN (ئامادەبوون - پێویستە داخڵ بن)
  // ===========================================================================
  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between" dir="rtl">
      {/* Return to Home Floater button */}
      <div className="sticky top-2 z-50 px-4 flex justify-between pointer-events-none">
        <button
          type="button"
          onClick={() => handleSwitchPortal('home')}
          className="pointer-events-auto h-9 px-3 rounded-full bg-slate-900/90 text-white border border-slate-700/80 shadow-xl backdrop-blur-md text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Home className="w-3.5 h-3.5 text-amber-400" />
          <span>سەرەکی (٣ بازنەکە)</span>
        </button>

        <div className="pointer-events-auto">
          {renderThemeButton('sm')}
        </div>
      </div>

      <main className="flex-1">
        <AshleyMobileApp 
          onSwitchToFeedback={() => handleSwitchPortal('feedback_hub')} 
          onSwitchToWarehouse={handleOpenWarehouse}
          onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)}
        />
      </main>

      {renderPinModal()}
    </div>
  );

  // ===========================================================================
  // 🔐 PIN GATE MODAL COMPONENT (Rendered conditionally)
  // ===========================================================================
  function renderPinModal() {
    if (!pinModalScope) return null;

    const isWarehouse = pinModalScope === 'warehouse';
    const isManager = pinModalScope === 'manager_feedback';
    const requiredLength = isWarehouse ? 5 : 4;

    const theme = isManager 
      ? { border: 'border-amber-500/40', badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30', dotActive: 'bg-amber-500 border-amber-400 shadow-amber-500/50', title: '📝 فۆرمی هەڵسەنگاندنی بەڕێوەبەر', range: '0000 - 5999', desc: 'کۆدی ٤ ژمارەیی (0000 - 5999) بنووسە بۆ کردنەوەی فۆرمە نهێنییەکە' }
      : isWarehouse
      ? { border: 'border-blue-500/40', badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30', dotActive: 'bg-blue-500 border-blue-400 shadow-blue-500/50', title: '📦 بەشی کۆگا و جەرد', range: '٥ ژمارە (10000 - 99999)', desc: 'تکایە کۆدی نهێنی ٥ ژمارەیی ڕێگەپێدراوی کۆگا بنووسە' }
      : { border: 'border-rose-500/40', badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30', dotActive: 'bg-rose-500 border-rose-400 shadow-rose-500/50', title: '👥 فیدباکی کارمەندان', range: '6000 - 9999', desc: 'تکایە کۆدی ٤ ژمارەیی هەڵسەنگاندن بنووسە' };

    return (
      <div className={`fixed inset-0 z-50 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 ${
        isDark ? 'bg-black/80' : 'bg-slate-900/60'
      }`}>
        <div className={`w-full max-w-sm border ${theme.border} rounded-3xl p-6 shadow-2xl text-center relative overflow-hidden transition-colors ${
          isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
        }`}>
          
          {/* Top Close Button */}
          <button
            type="button"
            onClick={closePinModal}
            className={`absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="mb-4">
            <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold font-mono border mb-2 ${theme.badge}`} dir="ltr">
              {theme.range}
            </span>
            <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{theme.title}</h3>
            <p className={`text-xs mt-1 max-w-xs mx-auto leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {theme.desc}
            </p>
          </div>

          {/* 🔘 PIN Dots Indicator */}
          <div className={`flex items-center justify-center gap-3 my-5 ${shakeDots ? 'animate-shake' : ''}`}>
            {Array.from({ length: requiredLength }).map((_, i) => {
              const isFilled = i < enteredPin.length;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-200 ${
                    isFilled
                      ? `${theme.dotActive} scale-110 shadow-lg`
                      : isDark
                      ? 'border-slate-700 bg-slate-800'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              );
            })}
          </div>

          {/* Error / Already-Submitted / Verifying Banner */}
          {pinVerifying ? (
            <div className="min-h-8 flex items-center justify-center gap-1.5 text-xs text-amber-500 font-bold mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>پشکنینی کۆد...</span>
            </div>
          ) : pinError ? (
            <div
              className={`min-h-8 px-3 py-2 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black leading-relaxed text-center mb-3 ${
                pinAlreadySubmitted
                  ? isDark
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isDark
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}
            >
              {pinAlreadySubmitted ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{pinError}</span>
            </div>
          ) : (
            <div className={`min-h-8 flex items-center justify-center text-[11px] font-medium mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {requiredLength - enteredPin.length > 0
                ? `${requiredLength - enteredPin.length} ژمارەی تر ماوە`
                : 'کۆد پڕکرایەوە'}
            </div>
          )}

          {/* ⌨️ Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto text-lg font-mono font-bold select-none">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={pinVerifying}
                onClick={() => handleKeypadPress(digit)}
                className={`h-14 rounded-2xl active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50 ${
                  isDark
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/80'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200'
                }`}
              >
                {digit}
              </button>
            ))}

            {/* Clear */}
            <button
              type="button"
              disabled={pinVerifying || enteredPin.length === 0}
              onClick={handleKeypadClear}
              className={`h-14 rounded-2xl text-xs font-bold font-sans border active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 ${
                isDark
                  ? 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 border-slate-700/60'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              پاککردن
            </button>

            {/* 0 */}
            <button
              type="button"
              disabled={pinVerifying}
              onClick={() => handleKeypadPress('0')}
              className={`h-14 rounded-2xl active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/80'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200'
              }`}
            >
              0
            </button>

            {/* Delete Backspace */}
            <button
              type="button"
              disabled={pinVerifying || enteredPin.length === 0}
              onClick={handleKeypadDelete}
              className={`h-14 rounded-2xl border active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 ${
                isDark
                  ? 'bg-slate-800/50 hover:bg-slate-700 text-rose-400 border-slate-700/60'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
              }`}
              title="سڕینەوەی یەک ژمارە"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    );
  }
}

export default function RootPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 text-white" dir="rtl">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
          <span className="text-xs text-slate-400 font-bold">بارکردنی ئەپڵیکەیشنی ئاشڵی...</span>
        </div>
      }
    >
      <RootPageContent />
    </Suspense>
  );
}
