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
  ChevronRight
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
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white dir-rtl" dir="rtl">
        <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-3xl p-1 shadow-2xl animate-pulse flex items-center justify-center mb-4">
          <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
            <Building2 className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-amber-500 mb-2" />
        <span className="text-xs text-slate-400 font-sans">بارکردنی سیستەمی ئاشڵی...</span>
      </div>
    );
  }

  // 2. Needs Account Binding Screen (First-time Google user)
  if (needsBindingProfile) {
    return (
      <AccountBindingScreen
        googleProfile={needsBindingProfile}
        onBindingSuccess={(newUser) => {
          setNeedsBindingProfile(null);
          setUser(newUser);
        }}
        onCancel={() => setNeedsBindingProfile(null)}
      />
    );
  }

  // 3. Not Logged In Screen
  if (!user) {
    return (
      <LoginScreen
        onLoginSuccess={(authedUser) => setUser(authedUser)}
        onNeedsBinding={(profile) => setNeedsBindingProfile(profile)}
      />
    );
  }

  // 4. Main App Screen with Bottom Navigation
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans dir-rtl max-w-md mx-auto shadow-2xl relative" dir="rtl">
      {/* Offline Warning Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>پەیوەندی ئینتەرنێت پچڕاوە. تکایە پەیوەندی بکە بە وایفای ئاشڵی.</span>
        </div>
      )}

      {/* Top App Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-md shadow-amber-500/10 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-tight leading-none mb-0.5">
              ئاشڵی دەوام
            </h1>
            <p className="text-[10px] text-slate-400 leading-none">
              Ashley Staff
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showInstallPill && (
            <button
              type="button"
              onClick={triggerInstall}
              className="h-8 px-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دابەزاندنی ئەپ</span>
            </button>
          )}

          <div
            onClick={() => setActiveTab('profile')}
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 overflow-hidden cursor-pointer"
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
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'attendance' && (
          <AttendanceTab
            user={user}
            todayInfo={todayInfo}
            onRefreshToday={loadStatusData}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesTab user={user} />
        )}

        {activeTab === 'leaves' && (
          <LeavesTab user={user} />
        )}

        {activeTab === 'reports' && (
          <MonthlyReportTab user={user} stats={monthStats} />
        )}

        {activeTab === 'profile' && (
          <SpecialSectionsTab
            user={user}
            specialSections={specialSectionsData}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Floating Bottom Navigation Bar (iOS Tab Bar Style) */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
            activeTab === 'attendance'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className={`w-5 h-5 ${activeTab === 'attendance' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">دەوام</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
            activeTab === 'expenses'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className={`w-5 h-5 ${activeTab === 'expenses' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">مەسروفات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
            activeTab === 'leaves'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className={`w-5 h-5 ${activeTab === 'leaves' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">مۆڵەت</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
            activeTab === 'reports'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className={`w-5 h-5 ${activeTab === 'reports' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">ڕاپۆرت</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-2xl transition-all ${
            activeTab === 'profile'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-400' : 'text-slate-400'}`} />
          <span className="text-[10px]">بەشەکان</span>
        </button>
      </nav>
    </div>
  );
}
