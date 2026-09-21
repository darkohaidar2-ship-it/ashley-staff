'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { NewGpsAttendanceMatrixTable } from '@/components/attendance/NewGpsAttendanceMatrixTable';
import { AdminDailyAttendanceTable } from '@/components/admin/AdminDailyAttendanceTable';
import { AdminFaceEnrollModal } from '@/components/attendance/AdminFaceEnrollModal';
import { AdminEmployeeDetailsModal } from '@/components/admin/AdminEmployeeDetailsModal';
import { AdminPasswordChangeModal } from '@/components/admin/AdminPasswordChangeModal';
import { format } from 'date-fns';
import { 
  Users, 
  Settings, 
  MapPin, 
  Download, 
  LogOut, 
  Clock, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Sparkles, 
  KeyRound, 
  BarChart3, 
  Award, 
  TrendingUp, 
  RefreshCw, 
  Table, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Building2, 
  Smartphone, 
  ExternalLink, 
  ShieldCheck, 
  Wrench 
} from 'lucide-react';

export function AdminDashboardWorkspace() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminView, setAdminView] = useState<'matrix' | 'daily' | 'tools'>('matrix');

  // Live Desktop Clock for ERP Admin
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(format(new Date(), 'yyyy-MM-dd | HH:mm:ss'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Selected Employee for Detailed 360° Monthly Modal
  const [selectedEmp360, setSelectedEmp360] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [faceEnrollEmp, setFaceEnrollEmp] = useState<Employee | null>(null);

  // Security Auth Guard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ashley_admin_session') || localStorage.getItem('ashley_admin_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.token || parsed.username || parsed.id)) {
            setSessionUser(parsed);
            setAuthChecked(true);
            return;
          }
        } catch {}
      }

      setAuthChecked(false);
      setSessionUser(null);
      router.replace('/adm1n_pan0l');
    }
  }, [router]);

  // Inactivity Auto-Logout (30 mins)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        alert('⚠️ سێشنەکەت بەسەرچوو بەهۆی بێدەنگی بۆ ماوەی ٣٠ خولەک! تکایە دووبارە لۆگین بکەرەوە.');
        await logout();
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('ashley_admin_session');
          localStorage.removeItem('ashley_admin_session');
        }
        router.replace('/adm1n_pan0l');
      }, 30 * 60 * 1000);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, [logout, router]);

  const {
    employees,
    settings,
    attendanceLogs,
    setAttendanceLogs,
    exportStateAsJson
  } = useAppContext();

  // Company Multi-Location Config for Quick Stats
  const [companyLocations, setCompanyLocations] = useState<any[]>([]);

  const fetchGlobalLocation = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/location?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setCompanyLocations(data.locations);
        } else if (data?.lat && data?.lng) {
          setCompanyLocations([data]);
        }
      }
    } catch (err) {
      console.error('Error fetching global company location in admin:', err);
    }
  }, []);

  useEffect(() => {
    fetchGlobalLocation();
  }, [fetchGlobalLocation]);

  // Registered Face IDs
  const [registeredFaceIds, setRegisteredFaceIds] = useState<string[]>([]);
  const fetchRegisteredFaces = useCallback(async () => {
    try {
      let localIds: string[] = [];
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        localIds = Object.keys(localDb);
        if (localIds.length > 0) {
          setRegisteredFaceIds((prev) => Array.from(new Set([...prev, ...localIds])));
        }
      } catch {}

      const res = await fetch(`/api/attendance/face/all?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.employees) {
          const apiIds = data.employees.map((e: any) => e.id);
          setRegisteredFaceIds(Array.from(new Set([...localIds, ...apiIds])));
        }
      }
    } catch (err) {
      console.error('Error fetching registered faces in admin:', err);
    }
  }, []);

  useEffect(() => {
    fetchRegisteredFaces();
  }, [fetchRegisteredFaces]);

  // Admin notes map for August 2026
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const handleUpdateAdminNote = (key: string, note: string) => {
    setAdminNotes(prev => {
      const updated = { ...prev, [key]: note };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ashley_admin_notes_2026-08', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  // Active employees list
  const activeEmployees = useMemo(() => {
    return (employees || []).filter(e => e?.status !== 'resigned' && e?.isActive !== false);
  }, [employees]);

  // Aggregated KPIs
  const dashboardKpis = useMemo(() => {
    const totalStaff = employees.length;
    const activeStaff = activeEmployees.length;
    const resignedStaff = employees.filter(e => e.status === 'resigned' || e?.isActive === false).length;

    let totalOtHours = 0;
    let totalOtCost = 0;

    return {
      totalStaff,
      activeStaff,
      resignedStaff,
      totalOtHours: totalOtHours.toFixed(1),
      totalOtCost: totalOtCost.toLocaleString(),
      totalLocations: companyLocations.length || 2,
    };
  }, [employees, activeEmployees, companyLocations]);

  const handleDeleteFace = async (empId: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی دەموچاوی ئەم کارمەندە؟')) return;
    try {
      await fetch('/api/attendance/face/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: empId })
      });
      setRegisteredFaceIds(prev => prev.filter(id => id !== empId));
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        delete localDb[empId];
        localStorage.setItem('ashley_face_registry_local', JSON.stringify(localDb));
      } catch {}
      alert('دەموچاوی کارمەند بە سەرکەوتوویی سڕایەوە.');
    } catch {
      alert('سڕینەوەی دەموچاو سەرکەوتوو نەبوو.');
    }
  };

  // Wipe All Attendance Records Handler
  const handleWipeAllAttendance = async () => {
    if (!confirm('⚠️ ئایا دڵنیایت لە سڕینەوەی سەرجەم داتاکانی ئامادەبوون و تۆماری دەوام؟ ئەم کارە تەواوی خشتەکان و سێرڤەر پاک دەکاتەوە.')) return;
    try {
      await fetch('/api/attendance/reset-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipeAll: true })
      });
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ashley_local_attendanceLogs');
        localStorage.removeItem('ashley_live_checkins');
        localStorage.removeItem('ashley_local_overtime');
        localStorage.removeItem('ashley_admin_notes_2026-08');
        localStorage.removeItem('ashley_ot_notes_2026-08');
        Object.keys(localStorage).forEach(k => {
          if (
            k.startsWith('ashley_leaves_') ||
            k.startsWith('ashley_holidays_') ||
            k.startsWith('ashley_deleted_attendance_') ||
            k.startsWith('ashley_time_override_')
          ) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
    }

    setAttendanceLogs([]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    alert('✅ سەرجەم داتاکانی ئامادەبوون و تۆمارەکان بە سەرکەوتوویی لە داتابەیس و سیستم پاککرانەوە.');
  };

  if (authLoading || !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f2f2f7] dark:bg-[#1c1c1e]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#007AFF]" />
          <p className="text-xs font-bold text-slate-500">پشکنینی ئاسایش و بارکردنی سیستەم...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-3 sm:p-5 lg:p-6 dir-rtl font-sans space-y-5" dir="rtl">
      
      {/* 🧭 TOP COMMAND HEADER BAR */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white/80 dark:bg-[#2c2c2e]/80 border border-slate-200/80 dark:border-white/5 rounded-[24px] shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                کۆمپانیای گروپی دیوان | ئاشڵی
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>سێرڤەر چالاکە</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium font-mono">
              {currentTimeStr || '2026-09-16'}
            </p>
          </div>
        </div>

        {/* Top Right Quick Actions & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/10 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setAdminView('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminView === 'matrix'
                  ? 'bg-white dark:bg-[#1c1c1e] text-[#007AFF] shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>خشتەی مانگانە (Matrix)</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminView === 'daily'
                  ? 'bg-white dark:bg-[#1c1c1e] text-[#007AFF] shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>ڕۆژانە (Daily)</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('tools')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                adminView === 'tools'
                  ? 'bg-white dark:bg-[#1c1c1e] text-[#007AFF] shadow-2xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="ئامرازەکانی ئەدمین"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ئامرازەکان</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
            title="گۆڕینی وشەی تێپەڕ"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={async () => {
              if (confirm('ئایا دڵنیایت لە چوونەدەرەوە؟')) {
                await logout();
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('ashley_admin_session');
                  localStorage.removeItem('ashley_admin_session');
                }
                router.replace('/adm1n_pan0l');
              }
            }}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 transition-all cursor-pointer"
            title="چوونەدەرەوە"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 📊 4 LIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 p-3.5 rounded-[20px] border border-slate-200/80 dark:border-white/5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">کارمەندانی چالاک</span>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {dashboardKpis.activeStaff} <span className="text-[10px] font-normal text-slate-500">کارمەند</span>
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 p-3.5 rounded-[20px] border border-slate-200/80 dark:border-white/5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">کاتی زیادەی مانگ</span>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              +{dashboardKpis.totalOtHours} <span className="text-[10px] font-normal text-slate-500">کاتژمێر</span>
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 p-3.5 rounded-[20px] border border-slate-200/80 dark:border-white/5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">شایستەی ئیزافە</span>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {dashboardKpis.totalOtCost} <span className="text-[10px] font-normal text-slate-500">IQD</span>
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-[#2c2c2e]/80 p-3.5 rounded-[20px] border border-slate-200/80 dark:border-white/5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">لۆکەیشنەکانی GPS</span>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {dashboardKpis.totalLocations} <span className="text-[10px] font-normal text-slate-500">شوێن</span>
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📊 VIEW 1: 31-DAY GPS ATTENDANCE MATRIX (PRIMARY MASTER TABLE) */}
      {/* ========================================================================= */}
      {adminView === 'matrix' && (
        <section className="w-full">
          <NewGpsAttendanceMatrixTable 
            employees={activeEmployees} 
            attendanceLogs={attendanceLogs} 
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* 📅 VIEW 2: DAILY SEQUENTIAL ATTENDANCE TABLE */}
      {/* ========================================================================= */}
      {adminView === 'daily' && (
        <section className="w-full">
          <AdminDailyAttendanceTable
            employees={employees}
            attendanceLogs={attendanceLogs}
            adminNotes={adminNotes}
            onUpdateAdminNote={handleUpdateAdminNote}
            selectedMonth={selectedMonth}
          />
        </section>
      )}

      {/* ========================================================================= */}
      {/* 🛠️ VIEW 3: ADMIN TOOLS (WIPE, RESET, BACKUP & SECURITY) */}
      {/* ========================================================================= */}
      {adminView === 'tools' && (
        <section className="space-y-4 animate-fade-in max-w-4xl mx-auto">
          <div className="bg-white/80 dark:bg-[#2c2c2e]/80 p-5 rounded-[24px] border border-slate-200/80 dark:border-white/5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 pb-3">
              <Wrench className="w-5 h-5 text-[#007AFF]" />
              <h2 className="text-sm sm:text-base font-black">ئامرازە باڵاکانی سەرپەرشتیاری سیستم (Admin Tools)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              
              {/* Reset All Attendance */}
              <div className="p-4 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-xs">
                  <Trash2 className="w-4 h-4" />
                  <span>سڕینەوە و ڕیسێتی سەرجەم تۆمارەکانی ئامادەبوون</span>
                </div>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-300 leading-relaxed font-medium">
                  سەرجەم لۆگە تۆمارکراوەکانی چێک‌ئین و چێک‌ئاوت، مۆڵەت و غیابەکان لە سێرڤەر و کاشی مۆبایل پاکدەکاتەوە.
                </p>
                <button
                  type="button"
                  onClick={handleWipeAllAttendance}
                  className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>سڕینەوەی هەموو تۆمارەکانی دەوام (Wipe Attendance)</span>
                </button>
              </div>

              {/* JSON System Backup */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-[#007AFF] dark:text-blue-400 font-black text-xs">
                  <Download className="w-4 h-4" />
                  <span>داگرتنی باکئەپی گشتی (JSON Backup)</span>
                </div>
                <p className="text-[11px] text-blue-800/80 dark:text-blue-300 leading-relaxed font-medium">
                  هەناردەکردنی سەرجەم داتاکانی سیستەم، کارمەندان، ڕێکخستنەکان و ئامادەبوون وەک فایلی پارێزراوی JSON.
                </p>
                <button
                  type="button"
                  onClick={exportStateAsJson}
                  className="w-full py-2.5 px-3 bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>داگرتنی فایلی باکئەپ (Export JSON)</span>
                </button>
              </div>

              {/* Password Change */}
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>وشەی نهێنی بەڕێوەبەر (Admin Password)</span>
                </div>
                <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300 leading-relaxed font-medium">
                  گۆڕینی تێپەڕەوشەی چوونەژوورەوەی ئەدمین بۆ سیستەم و بەشە هەستیارەکان.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>گۆڕینی وشەی تێپەڕ</span>
                </button>
              </div>

              {/* Quick Jump to Corporate Settings */}
              <div className="p-4 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-black text-xs">
                  <Settings className="w-4 h-4" />
                  <span>ناسنامەی فەرمی کۆمپانیا و لۆگۆکان</span>
                </div>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300 leading-relaxed font-medium">
                  دەستکاریکردنی ناوی گروپی دیوان، بریکاری ئاشڵی، دروشم و لۆگۆکانی وێبسایت و ڕاپۆرت.
                </p>
                <Link
                  href="/settings"
                  className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-center"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>چوون بۆ پەڕەی ناسنامە و لۆگۆکان</span>
                </Link>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* 🔍 DEEP EMPLOYEE 360° MONTHLY PROFILE MODAL */}
      {selectedEmp360 && (
        <AdminEmployeeDetailsModal
          employee={selectedEmp360}
          selectedMonth={selectedMonth}
          attendanceLogs={attendanceLogs}
          adminNotes={adminNotes}
          onClose={() => setSelectedEmp360(null)}
          onEnrollFace={(emp) => setFaceEnrollEmp(emp)}
          onDeleteFace={(emp) => handleDeleteFace(emp.id)}
          hasFaceRegistered={registeredFaceIds.includes(selectedEmp360.id)}
        />
      )}

      {/* FACE ENROLL MODAL */}
      {faceEnrollEmp && (
        <AdminFaceEnrollModal
          employee={faceEnrollEmp}
          isOpen={!!faceEnrollEmp}
          onClose={() => setFaceEnrollEmp(null)}
          onSuccess={() => {
            fetchRegisteredFaces();
            alert(`🎉 ڕوخساری (${faceEnrollEmp.fullName3Part || faceEnrollEmp.name}) بە سەرکەوتوویی تۆمارکرا!`);
          }}
        />
      )}

      {/* ADMIN PASSWORD CHANGE MODAL */}
      <AdminPasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

    </div>
  );
}

export default AdminDashboardWorkspace;
