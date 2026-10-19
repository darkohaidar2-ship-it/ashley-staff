'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  Receipt, 
  Calendar, 
  BarChart3, 
  Settings, 
  User, 
  Download, 
  WifiOff, 
  Loader2, 
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Smartphone,
  ExternalLink,
  Check
} from 'lucide-react';
import { MobileAuthUser, TodayAttendanceInfo, MonthStatsInfo } from './types';
import { LoginScreen } from './LoginScreen';
import { AccountBindingScreen } from './AccountBindingScreen';
import { AttendanceTab } from './AttendanceTab';
import { ExpensesTab } from './ExpensesTab';
import { LeavesTab } from './LeavesTab';
import { MonthlyReportTab } from './MonthlyReportTab';
import { SpecialSectionsTab } from './SpecialSectionsTab';
import { supabaseAuth } from '@/lib/supabase/client';

export default function AshleyMobileApp() {
  // Theme state: default 'light' per user specification
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      return saved === 'dark';
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_theme', next ? 'dark' : 'light');
    }
  };

  // Authentication State
  const [user, setUser] = useState<MobileAuthUser | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [needsBindingProfile, setNeedsBindingProfile] = useState<{
    email: string;
    displayName?: string;
    photoUrl?: string;
    uid?: string;
  } | null>(null);

  // Desktop Screen Gate State («با بەکار هێنانی تەنها لەسەر مۆبایل بێت»)
  const [isDesktopDevice, setIsDesktopDevice] = useState(false);
  const [bypassDesktopBlock, setBypassDesktopBlock] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'expenses' | 'leaves' | 'reports' | 'profile'>('attendance');

  // App Data (Today & Month Stats)
  const [todayInfo, setTodayInfo] = useState<TodayAttendanceInfo | null>(null);
  const [monthStats, setMonthStats] = useState<MonthStatsInfo | null>(null);
  const [specialSectionsData, setSpecialSectionsData] = useState<any>({});
  const [isOnline, setIsOnline] = useState(true);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPill, setShowInstallPill] = useState(false);

  // Detect Desktop Screen on Mount
  useEffect(() => {
    const checkIsDesktop = () => {
      if (typeof window === 'undefined') return;
      setIsDesktopDevice(window.innerWidth > 820);
    };
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Check stored session on mount
  useEffect(() => {
    let isMounted = true;

    // Online / Offline listener
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    // PWA install prompt capture
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPill(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    try {
      const stored = localStorage.getItem('ashley_mobile_auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.employeeId && parsed?.email) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading stored session:', e);
    } finally {
      if (isMounted) setInitLoading(false);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Fetch status and attendance data whenever user is logged in
  const loadStatusData = useCallback(async () => {
    if (!user?.employeeId) return;
    try {
      const res = await fetch(`/api/mobile/status?employeeId=${encodeURIComponent(user.employeeId)}`);
      const data = await res.json();
      if (data.success) {
        if (data.today) setTodayInfo(data.today);
        if (data.monthStats) setMonthStats(data.monthStats);
        if (data.specialSections) setSpecialSectionsData(data.specialSections);
      }
    } catch (err) {
      console.error('[AshleyMobileApp] Error loading status data:', err);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    if (user?.employeeId) {
      loadStatusData();
      const interval = setInterval(loadStatusData, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.employeeId, loadStatusData]);

  // Handle Logout
  const handleLogout = async () => {
    if (confirm('ئایا دڵنیایت لە چوونەدەرەوە لە ئەپڵیکەیشنەکە؟')) {
      try {
        await supabaseAuth.auth.signOut();
      } catch (e) {}
      localStorage.removeItem('ashley_mobile_auth');
      setUser(null);
      setNeedsBindingProfile(null);
      setActiveTab('attendance');
    }
  };

  // Handle Cancel of Google Account Binding
  const handleCancelBinding = async () => {
    try {
      await supabaseAuth.auth.signOut();
    } catch (e) {
      console.warn('Error signing out on cancel binding:', e);
    }
    localStorage.removeItem('ashley_mobile_auth');
    setNeedsBindingProfile(null);
  };

  // Handle PWA Install
  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstallPill(false);
      }
      setDeferredPrompt(null);
    } else {
      alert('بۆ دابەزاندن لەسەر ئایفۆن: کلیک لەسەر دوگمەی Share (بڵاوکردنەوە) بکە و "Add to Home Screen" هەڵبژێرە.');
    }
  };

  // 1. Initial Loading Screen
  if (initLoading) {
    return (
      <div className={`min-h-[100dvh] flex flex-col items-center justify-center dir-rtl transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`} dir="rtl">
        <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-3xl p-1 shadow-2xl animate-pulse flex items-center justify-center mb-4">
          <div className={`w-full h-full rounded-[22px] flex items-center justify-center ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}>
            <Building2 className="w-8 h-8 text-amber-500" />
          </div>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-amber-500 mb-2" />
        <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بارکردنی سیستەمی ئاشڵی...</span>
      </div>
    );
  }

  // 1.5 Desktop Interceptor («با بەکار هێنانی تەنها لەسەر مۆبایل بێت»)
  if (isDesktopDevice && !bypassDesktopBlock) {
    return (
      <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none font-sans" dir="rtl">
        <div className="w-full max-w-lg bg-slate-800/95 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/30">
            <Smartphone className="w-8 h-8" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
            📱 تەنها بۆ سەر مۆبایل دیزاین کراوە
          </span>

          <h1 className="text-xl font-black text-white mb-2">
            سیستەمی تۆمارکردنی دەوامی ئاشڵی
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed mb-6 max-w-md">
            بۆ کۆنترۆڵکردنی ئاسان، دیاریکردنی وردی لۆکەیشن (GPS)، و تۆمارکردنی کاتی دەوام، ئەم پەرەیە بە تایبەتی بۆ ئامێری <b>مۆبایل</b> ڕێکخراوە. تکایە لە مۆبایلەکەتەوە بیکەرەوە یان کامێراکەت ئاراستەی ئەم کۆدە بکە:
          </p>

          {/* QR Code Container */}
          <div className="bg-white p-4 rounded-2xl shadow-xl mb-4 border border-slate-200">
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://ashley-staff.vercel.app&format=svg" 
              alt="Scan QR code with mobile" 
              className="w-44 h-44 object-contain"
            />
          </div>

          <p className="text-xs text-slate-400 font-mono mb-6" dir="ltr">
            https://ashley-staff.vercel.app
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('https://ashley-staff.vercel.app');
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex-1 h-12 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <ExternalLink className="w-4 h-4" />}
              <span>{copiedLink ? 'لینکەکە کۆپی کرا!' : 'کۆپیکردنی لینک'}</span>
            </button>

            <a
              href="/adm1n_pan0l"
              className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <span>داشبۆردی ئەدمین (کۆمپیوتەر)</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => setBypassDesktopBlock(true)}
            className="mt-5 text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            تاقیکردنەوە لەسەر کۆمپیوتەر (شێوازی پێشبینینی مۆبایل)
          </button>
        </div>
      </div>
    );
  }

  // 2. Needs Account Binding Screen (First-time Google user)
  if (needsBindingProfile) {
    return (
      <div className={`min-h-[100dvh] w-full transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-[#f8fafc]'
      }`}>
        <AccountBindingScreen
          googleProfile={needsBindingProfile}
          onBindingSuccess={(newUser) => {
            setNeedsBindingProfile(null);
            setUser(newUser);
          }}
          onCancel={handleCancelBinding}
        />
      </div>
    );
  }

  // 3. Not Logged In Screen
  if (!user) {
    return (
      <div className={`min-h-[100dvh] w-full transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-[#f8fafc]'
      }`}>
        <LoginScreen
          onLoginSuccess={(authedUser) => setUser(authedUser)}
          onNeedsBinding={(profile) => setNeedsBindingProfile(profile)}
        />
      </div>
    );
  }

  // 4. Main App Screen with Bottom Navigation (STRICT MOBILE PROPORTIONS)
  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none font-sans ${
      isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱 STRICT MOBILE FRAME (Edge-to-edge on phones, 440px centered frame on desktop preview) */}
      <div className={`w-full max-w-[440px] min-h-[100dvh] mx-auto relative flex flex-col justify-between overflow-x-hidden transition-colors duration-200 ${
        isDark 
          ? 'bg-slate-950 text-white sm:shadow-2xl sm:border-x sm:border-slate-800' 
          : 'bg-[#f8fafc] text-slate-900 sm:shadow-2xl sm:border-x sm:border-slate-200/90'
      }`}>
        
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>پەیوەندی ئینتەرنێت پچڕاوە. تکایە پەیوەندی بکە بە وایفای ئاشڵی.</span>
          </div>
        )}

        {/* Top App Header with Safe Area */}
        <header className={`sticky top-0 z-40 backdrop-blur-xl px-4 pt-safe pb-3 flex items-center justify-between border-b transition-colors ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-xs'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-md shadow-amber-500/10 flex items-center justify-center shrink-0">
              <div className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                isDark ? 'bg-slate-900' : 'bg-white'
              }`}>
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none mb-0.5">
                ئاشڵی دەوام
              </h1>
              <p className={`text-xs leading-none ${isDark ? 'text-slate-400' : 'text-slate-500 font-semibold'}`}>
                Ashley Staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showInstallPill && (
              <button
                type="button"
                onClick={triggerInstall}
                className={`h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isDark 
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' 
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>دابەزاندن</span>
              </button>
            )}

            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 border border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 shadow-xs'
              }`}
              title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
            >
              {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* User Profile Avatar Pill */}
            <div
              onClick={() => setActiveTab('profile')}
              className={`w-9 h-9 rounded-full border flex items-center justify-center text-sm font-black overflow-hidden cursor-pointer transition-colors ${
                isDark 
                  ? 'bg-slate-800 border-slate-700 text-amber-400' 
                  : 'bg-amber-100 border-amber-300 text-amber-800'
              }`}
              title={user.employeeName}
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.employeeName} className="w-full h-full object-cover" />
              ) : (
                user.employeeName.charAt(0)
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 p-4 pb-28 overflow-y-auto">
          {activeTab === 'attendance' && (
            <AttendanceTab
              user={user}
              todayInfo={todayInfo}
              onRefreshToday={loadStatusData}
              onNavigateTab={(tab) => setActiveTab(tab as any)}
              isDark={isDark}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesTab user={user} isDark={isDark} />
          )}

          {activeTab === 'leaves' && (
            <LeavesTab user={user} isDark={isDark} />
          )}

          {activeTab === 'reports' && (
            <MonthlyReportTab user={user} stats={monthStats} isDark={isDark} />
          )}

          {activeTab === 'profile' && (
            <SpecialSectionsTab
              user={user}
              specialSections={specialSectionsData}
              onLogout={handleLogout}
              isDark={isDark}
            />
          )}
        </main>

        {/* Floating Bottom Navigation Bar (iOS Tab Bar with Safe Area) */}
        <nav className={`fixed bottom-0 left-0 right-0 max-w-[440px] mx-auto z-40 backdrop-blur-2xl border-t px-2 pt-2 pb-safe flex items-center justify-around transition-colors ${
          isDark 
            ? 'bg-slate-900/95 border-slate-800 text-slate-400 shadow-2xl' 
            : 'bg-white/95 border-slate-200/90 text-slate-500 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? isDark 
                  ? 'text-amber-400 font-black bg-amber-500/15' 
                  : 'text-amber-800 font-black bg-amber-50 border border-amber-200 shadow-2xs'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <MapPin className={`w-5 h-5 ${activeTab === 'attendance' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[11px] font-bold">دەوام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? isDark 
                  ? 'text-amber-400 font-black bg-amber-500/15' 
                  : 'text-amber-800 font-black bg-amber-50 border border-amber-200 shadow-2xs'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Receipt className={`w-5 h-5 ${activeTab === 'expenses' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[11px] font-bold">مەسروفات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'leaves'
                ? isDark 
                  ? 'text-amber-400 font-black bg-amber-500/15' 
                  : 'text-amber-800 font-black bg-amber-50 border border-amber-200 shadow-2xs'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Calendar className={`w-5 h-5 ${activeTab === 'leaves' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[11px] font-bold">مۆڵەت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'reports'
                ? isDark 
                  ? 'text-amber-400 font-black bg-amber-500/15' 
                  : 'text-amber-800 font-black bg-amber-50 border border-amber-200 shadow-2xs'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <BarChart3 className={`w-5 h-5 ${activeTab === 'reports' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[11px] font-bold">ڕاپۆرت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'profile'
                ? isDark 
                  ? 'text-amber-400 font-black bg-amber-500/15' 
                  : 'text-amber-800 font-black bg-amber-50 border border-amber-200 shadow-2xs'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Settings className={`w-5 h-5 ${activeTab === 'profile' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[11px] font-bold">بەشەکان</span>
          </button>
        </nav>
      </div>

    </div>
  );
}
