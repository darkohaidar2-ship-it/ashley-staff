'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AshleyMobileApp from '@/components/mobile-app/AshleyMobileApp';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { AdminFeedbackDashboard } from '@/components/admin/AdminFeedbackDashboard';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { 
  Loader2, 
  ArrowRight, 
  Boxes, 
  MapPin, 
  MessageSquareHeart, 
  Clock, 
  Building2, 
  Sparkles, 
  Fingerprint, 
  ShieldCheck, 
  BarChart3, 
  Home, 
  ChevronLeft, 
  Truck, 
  ClipboardCheck, 
  Users, 
  Award, 
  Star,
  Lock,
  ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';

export type ActivePortal = 'home' | 'attendance' | 'feedback_hub' | 'feedback' | 'feedback_admin' | 'warehouse';

function RootPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const pinParam = searchParams.get('pin') || '';

  const [activePortal, setActivePortal] = useState<ActivePortal>(() => {
    if (tabParam === 'feedback_admin' || tabParam === 'manager_feedback') {
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
    // Default is the 3-Circle Mobile Home Screen
    return 'home';
  });

  useEffect(() => {
    if (tabParam === 'feedback_admin' || tabParam === 'manager_feedback') {
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

  // ===========================================================================
  // 🔘 VIEW 1: MAIN HOME SCREEN WITH 3 CIRCLES (سێ بازنەی پەرەی سەرەکی)
  // ===========================================================================
  if (activePortal === 'home') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 text-white select-none font-sans flex flex-col justify-between" dir="rtl">
        
        {/* Ambient Luxury Background Lights */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        {/* Top Floating App Bar */}
        <header className="relative z-10 w-full max-w-lg md:max-w-2xl mx-auto px-4 pt-safe pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-300">Ashley Staff 2026</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 font-mono">گروپی دیوان</span>
          </div>
        </header>

        {/* 📱 3-CIRCLE HERO HUB */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-md sm:max-w-xl md:max-w-2xl mx-auto w-full my-auto">
          
          {/* Header Title */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[24px] bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-2xl shadow-amber-500/30 flex items-center justify-center mx-auto mb-3">
              <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center">
                <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
              ئاشڵی هۆم ستۆر
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xs sm:max-w-sm mx-auto">
              سیستەمی یەکگرتووی دەوام، فیدباک، و جەردی کۆگا
            </p>
          </div>

          {/* =================================================================== */}
          {/* 🔘 THE THREE CIRCLES TRIANGLE LAYOUT (سێ بازنەکەی سەرەکی) */}
          {/* =================================================================== */}
          <div className="w-full flex flex-col items-center gap-6 sm:gap-8 my-auto">
            
            {/* ⭕ بازنەی ١ (سەرەوە): ئامادەبوون (کە پێویست ئەکا داخڵ بن) */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => handleSwitchPortal('attendance')}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-1 shadow-2xl shadow-amber-500/35 ring-4 ring-amber-400/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 group hover:ring-amber-400/50"
              >
                <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-3 text-center transition-all group-hover:bg-slate-900/90">
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                    <Fingerprint className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
                  </div>
                  <span className="text-base sm:text-lg font-black text-white">
                    ئامادەبوون
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 mt-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>پێویستە داخڵ بن</span>
                  </span>
                </div>
              </button>

              <span className="text-[11px] sm:text-xs font-bold text-slate-400 mt-2 text-center">
                تۆمارکردنی کاتی دەوام بە GPS و لۆگ ئین
              </span>
            </div>

            {/* ⭕⭕ بازنەی ٢ و ٣ (لای ڕاست: فیدباک • دەستە چەپ: کۆگا) */}
            <div className="w-full flex items-start justify-center gap-6 sm:gap-14">
              
              {/* ⭕ بازنەی لاری ڕاست: فیدباک (فیدباکی کارمەندان و فیدباکی بەڕێوەبەر) */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleSwitchPortal('feedback_hub')}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-rose-500 via-pink-500 to-rose-400 p-1 shadow-2xl shadow-rose-500/35 ring-4 ring-rose-400/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 group hover:ring-rose-400/50"
                >
                  <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-2.5 text-center transition-all group-hover:bg-slate-900/90">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <MessageSquareHeart className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />
                    </div>
                    <span className="text-sm sm:text-base font-black text-white">
                      فیدباک
                    </span>
                    <span className="text-[9.5px] sm:text-[10.5px] font-bold text-rose-300 mt-1 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
                      ٢ بەش
                    </span>
                  </div>
                </button>

                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-2 text-center max-w-[130px] sm:max-w-[160px]">
                  فیدباکی کارمەندان & بەڕێوەبەر
                </span>
              </div>

              {/* ⭕ بازنەی دەستە چەپ: کۆگا (کە لەوێوە بچینە بەشی جەرد) */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleSwitchPortal('warehouse')}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-1 shadow-2xl shadow-blue-500/35 ring-4 ring-blue-400/25 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 group hover:ring-blue-400/50"
                >
                  <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center p-2.5 text-center transition-all group-hover:bg-slate-900/90">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                      <Boxes className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                    </div>
                    <span className="text-sm sm:text-base font-black text-white">
                      کۆگا
                    </span>
                    <span className="text-[9.5px] sm:text-[10.5px] font-bold text-blue-300 mt-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30">
                      جەرد & بار
                    </span>
                  </div>
                </button>

                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-2 text-center max-w-[130px] sm:max-w-[160px]">
                  بەشی جەرد و بار داگرتن
                </span>
              </div>

            </div>

          </div>

        </main>

        {/* Footer Brand Info */}
        <footer className="relative z-10 w-full text-center pb-safe pb-4 pt-2 text-[11px] text-slate-500 font-medium">
          کۆمپانیای مۆبیلیاتی ئاشڵی • گروپی دیوان ٢٠٢٦
        </footer>

      </div>
    );
  }

  // ===========================================================================
  // 💬 VIEW 2: FEEDBACK HUB (کە دوای ئەوە دوو فیدباکمان هەبێ: کارمەندان و بەڕێوبەر)
  // ===========================================================================
  if (activePortal === 'feedback_hub') {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-950 text-white select-none font-sans flex flex-col justify-between" dir="rtl">
        
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleSwitchPortal('home')}
            className="h-9 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-slate-700"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>پەڕەی سەرەکی</span>
          </button>

          <div className="flex items-center gap-2">
            <MessageSquareHeart className="w-5 h-5 text-rose-400" />
            <h2 className="text-sm font-black text-white">بەشی فیدباک و هەڵسەنگاندن</h2>
          </div>
        </header>

        {/* Dual Feedback Cards Selection */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-lg md:max-w-2xl mx-auto w-full my-auto space-y-4">
          
          <div className="text-center mb-2">
            <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold inline-block mb-2">
              هەڵبژاردنی جۆری فیدباک
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              کام فیدباکە دەتەوێت بکەیتەوە؟
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              سیستەمەکە دوو بەشی فیدباکی جیاوازی هەیە: یەکەم بۆ هەڵسەنگاندنی کارمەندان لە ڕێی PIN، دووەم بۆ شیتاڵی و داتای بەڕێوەبەر.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 w-full">
            
            {/* Card 1: فیدباکی کارمەندان */}
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback')}
              className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-rose-500/50 shadow-xl text-right transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                    <MessageSquareHeart className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      <span>١. فیدباکی کارمەندان</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                        PIN
                      </span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      پڕکردنەوەی فیدباک لەسەر کارمەندانی فرۆش و کاشێر
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                پەڕەی هەڵسەنگاندنی کڕیاران و کارمەندان لە ڕێی ٤ ژمارەی PIN. تێیدا نمرە بە ڕەفتار، زانیاری و خزمەتگوزاری دەدرێت.
              </p>
            </button>

            {/* Card 2: فیدباکی بەڕێوەبەر */}
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_admin')}
              className="p-5 rounded-3xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 shadow-xl text-right transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white flex items-center gap-2">
                      <span>٢. فیدباکی بەڕێوەبەر</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        Dashboard & PDF
                      </span>
                    </h4>
                    <span className="text-xs text-slate-400">
                      داشبۆردی شیکاری، ڕیزبەندی کارمەندان و ڕاپۆرتی PDF
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                  <ChevronLeft className="w-5 h-5" />
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                بینینی هەموو فیدباکە تۆمارکراوەکان، دۆزینەوەی کارمەندی زێڕین، گرافی پرسیارەکان، و هەناردەکردنی ڕاپۆرتی فەرمی بە واژووی دیوان و ئاشڵی.
              </p>
            </button>

          </div>

          <button
            type="button"
            onClick={() => handleSwitchPortal('home')}
            className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>گەڕانەوە بۆ پەڕەی سەرەکی (سێ بازنەکە)</span>
          </button>

        </main>

        <footer className="w-full text-center pb-safe pb-4 text-[11px] text-slate-500">
          بەشی فیدباک • سیستەمی ئاشڵی ٢٠٢٦
        </footer>

      </div>
    );
  }

  // ===========================================================================
  // 📝 VIEW 3: STAFF FEEDBACK PORTAL (فیدباکی کارمەندان لە ڕێی PIN)
  // ===========================================================================
  if (activePortal === 'feedback') {
    return (
      <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-between" dir="rtl">
        {/* Navigation Bar back to Hub or Home */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-rose-500" />
              <span>گەڕانەوە بۆ فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="پەڕەی سەرەکی"
            >
              <Home className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">سەرەکی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_admin')}
              className="h-9 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>فیدباکی بەڕێوەبەر</span>
            </button>
          </div>
        </header>

        <main className="flex-1">
          <FeedbackPortal 
            initialPin={pinParam} 
            onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)} 
            onBackToMobileApp={() => handleSwitchPortal('home')} 
          />
        </main>
      </div>
    );
  }

  // ===========================================================================
  // 📊 VIEW 4: MANAGER FEEDBACK DASHBOARD (فیدباکی بەڕێوەبەر)
  // ===========================================================================
  if (activePortal === 'feedback_admin') {
    return (
      <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-between" dir="rtl">
        {/* Navigation Bar back to Hub or Home */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-amber-500" />
              <span>گەڕانەوە بۆ فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="پەڕەی سەرەکی"
            >
              <Home className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">سەرەکی</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback')}
              className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquareHeart className="w-4 h-4 text-rose-600" />
              <span>فیدباکی کارمەندان (PIN)</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 max-w-[1920px] mx-auto w-full">
          <AdminFeedbackDashboard />
        </main>
      </div>
    );
  }

  // ===========================================================================
  // 📦 VIEW 5: WAREHOUSE & STOCKTAKE (بەشی جەرد و بار داگرتن)
  // ===========================================================================
  if (activePortal === 'warehouse') {
    return (
      <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-between" dir="rtl">
        {/* Navigation Bar back to Home */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSwitchPortal('home')}
              className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span>پەڕەی سەرەکی</span>
            </button>

            <span className="text-xs font-black text-slate-900 hidden sm:inline">
              | بەشی کۆگا: داگرتنی بار و جەرد
            </span>
          </div>

          {/* Quick links to other portals */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback_hub')}
              className="h-9 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-rose-600" />
              <span>فیدباک</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('attendance')}
              className="h-9 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Fingerprint className="w-3.5 h-3.5 text-amber-600" />
              <span>ئامادەبوون</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto w-full">
          <GoogleSheetsWarehouseAudit 
            onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)}
            onBackToMobileApp={() => handleSwitchPortal('home')}
            isMobileEmbedded={true}
          />
        </main>
      </div>
    );
  }

  // ===========================================================================
  // 🕒 VIEW 6: ATTENDANCE & CHECK-IN (ئامادەبوون - پێویستە داخڵ بن)
  // ===========================================================================
  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between" dir="rtl">
      {/* Return to Home Floater button */}
      <div className="sticky top-2 z-50 px-4 flex justify-start pointer-events-none">
        <button
          type="button"
          onClick={() => handleSwitchPortal('home')}
          className="pointer-events-auto h-9 px-3 rounded-full bg-slate-900/90 text-white border border-slate-700/80 shadow-xl backdrop-blur-md text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <Home className="w-3.5 h-3.5 text-amber-400" />
          <span>سەرەکی (٣ بازنەکە)</span>
        </button>
      </div>

      <main className="flex-1">
        <AshleyMobileApp 
          onSwitchToFeedback={() => handleSwitchPortal('feedback_hub')} 
          onSwitchToWarehouse={() => handleSwitchPortal('warehouse')}
          onSwitchPortal={(p) => handleSwitchPortal(p as ActivePortal)}
        />
      </main>
    </div>
  );
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
