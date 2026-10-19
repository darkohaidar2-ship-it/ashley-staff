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
  LogOut
} from 'lucide-react';
import { MobileAuthUser, TodayAttendanceInfo, MonthStatsInfo } from './types';
import { LoginScreen } from './LoginScreen';
import { AccountBindingScreen } from './AccountBindingScreen';
import { AttendanceTab } from './AttendanceTab';
import { ExpensesTab } from './ExpensesTab';
import { LeavesTab } from './LeavesTab';
import { MonthlyReportTab } from './MonthlyReportTab';
import { SpecialSectionsTab } from './SpecialSectionsTab';

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
  const handleLogout = () => {
    if (confirm('ئایا دڵنیایت لە چوونەدەرەوە لە ئەپڵیکەیشنەکە؟')) {
      localStorage.removeItem('ashley_mobile_auth');
      setUser(null);
      setNeedsBindingProfile(null);
      setActiveTab('attendance');
    }
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

  // 2. Needs Account Binding Screen (First-time Google user)
  if (needsBindingProfile) {
    return (
      <div className={`min-h-[100dvh] w-full transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-slate-100/70'
      }`}>
        <AccountBindingScreen
          googleProfile={needsBindingProfile}
          onBindingSuccess={(newUser) => {
            setNeedsBindingProfile(null);
            setUser(newUser);
          }}
          onCancel={() => setNeedsBindingProfile(null)}
        />
      </div>
    );
  }

  // 3. Not Logged In Screen
  if (!user) {
    return (
      <div className={`min-h-[100dvh] w-full transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-slate-100/70'
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
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-100/70 text-slate-900'
    }`} dir="rtl">
      
      {/* 📱 STRICT MOBILE FRAME (Centers neatly on desktop, 100% on phones) */}
      <div className={`w-full max-w-[430px] min-h-[100dvh] mx-auto relative flex flex-col justify-between overflow-x-hidden transition-colors duration-200 sm:shadow-2xl ${
        isDark 
          ? 'bg-slate-950 text-white sm:border-x sm:border-slate-800' 
          : 'bg-[#f8fafc] text-slate-900 sm:border-x sm:border-slate-200/90'
      }`}>
        
        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>پەیوەندی ئینتەرنێت پچڕاوە. تکایە پەیوەندی بکە بە وایفای ئاشڵی.</span>
          </div>
        )}

        {/* Top App Header */}
        <header className={`sticky top-0 z-40 backdrop-blur-xl px-4 py-3 flex items-center justify-between border-b transition-colors ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-xs'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-md shadow-amber-500/10 flex items-center justify-center">
              <div className={`w-full h-full rounded-[10px] flex items-center justify-center ${
                isDark ? 'bg-slate-900' : 'bg-white'
              }`}>
                <Building2 className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div>
              <h1 className="text-xs font-black tracking-tight leading-none mb-0.5">
                ئاشڵی دەوام
              </h1>
              <p className={`text-[10px] leading-none ${isDark ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
                Ashley Staff
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showInstallPill && (
              <button
                type="button"
                onClick={triggerInstall}
                className={`h-8 px-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all ${
                  isDark 
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300' 
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>دابەزاندن</span>
              </button>
            )}

            {/* Quick Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 border border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 shadow-2xs'
              }`}
              title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Profile Avatar Pill */}
            <div
              onClick={() => setActiveTab('profile')}
              className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold overflow-hidden cursor-pointer transition-colors ${
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
        <main className="flex-1 p-3.5 sm:p-4 overflow-y-auto">
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

        {/* Floating Bottom Navigation Bar (iOS Tab Bar Style) */}
        <nav className={`fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-40 backdrop-blur-xl border-t px-2 py-1.5 flex items-center justify-around transition-colors ${
          isDark 
            ? 'bg-slate-900/95 border-slate-800 text-slate-400' 
            : 'bg-white/95 border-slate-200/90 text-slate-500 shadow-lg'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? isDark 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-amber-700 font-black bg-amber-50 border border-amber-200/70'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <MapPin className={`w-4.5 h-4.5 ${activeTab === 'attendance' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[10px]">دەوام</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'expenses'
                ? isDark 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-amber-700 font-black bg-amber-50 border border-amber-200/70'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Receipt className={`w-4.5 h-4.5 ${activeTab === 'expenses' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[10px]">مەسروفات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaves')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'leaves'
                ? isDark 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-amber-700 font-black bg-amber-50 border border-amber-200/70'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Calendar className={`w-4.5 h-4.5 ${activeTab === 'leaves' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[10px]">مۆڵەت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'reports'
                ? isDark 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-amber-700 font-black bg-amber-50 border border-amber-200/70'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <BarChart3 className={`w-4.5 h-4.5 ${activeTab === 'reports' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[10px]">ڕاپۆرت</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'profile'
                ? isDark 
                  ? 'text-amber-400 font-bold bg-amber-500/10' 
                  : 'text-amber-700 font-black bg-amber-50 border border-amber-200/70'
                : isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'
            }`}
          >
            <Settings className={`w-4.5 h-4.5 ${activeTab === 'profile' ? (isDark ? 'text-amber-400' : 'text-amber-600') : ''}`} />
            <span className="text-[10px]">بەشەکان</span>
          </button>
        </nav>
      </div>

    </div>
  );
}
