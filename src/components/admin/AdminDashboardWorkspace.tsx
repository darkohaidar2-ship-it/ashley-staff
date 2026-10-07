'use client';

import { logger } from '@/lib/logger';
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
import NotificationRoutingMatrix from '@/components/admin/NotificationRoutingMatrix';
import { format } from 'date-fns';
import { 
  Building2, 
  Table, 
  Calendar, 
  Wrench, 
  SlidersHorizontal, 
  KeyRound, 
  LogOut, 
  Trash2, 
  Download, 
  Settings, 
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';

export function AdminDashboardWorkspace() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Default directly to the weekly/monthly attendance matrix table per user preference
  const [adminView, setAdminView] = useState<'matrix' | 'daily' | 'tools' | 'workflow'>('matrix');

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
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
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
        } catch (err) { logger.warn(err); }
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
        alert('سێشنەکەت بەسەرچوو بەهۆی بێدەنگی بۆ ماوەی ٣٠ خولەک! تکایە دووبارە لۆگین بکەرەوە.');
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

  // Company Multi-Location Config
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
      logger.error('Error fetching global company location in admin:', err);
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
      } catch (err) { logger.warn(err); }

      const res = await fetch(`/api/attendance/face/all?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.employees) {
          const apiIds = data.employees.map((e: any) => e.id);
          setRegisteredFaceIds(Array.from(new Set([...localIds, ...apiIds])));
        }
      }
    } catch (err) {
      logger.error('Error fetching registered faces in admin:', err);
    }
  }, []);

  useEffect(() => {
    fetchRegisteredFaces();
  }, [fetchRegisteredFaces]);

  // Admin notes map for current month
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const handleUpdateAdminNote = (key: string, note: string) => {
    setAdminNotes(prev => {
      const updated = { ...prev, [key]: note };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updated));
        } catch (err) { logger.warn(err); }
      }
      return updated;
    });
  };

  // Active employees list
  const activeEmployees = useMemo(() => {
    return (employees || []).filter(e => e?.status !== 'resigned' && e?.isActive !== false);
  }, [employees]);

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
      } catch (err) { logger.warn(err); }
      alert('دەموچاوی کارمەند بە سەرکەوتوویی سڕایەوە.');
    } catch {
      alert('سڕینەوەی دەموچاو سەرکەوتوو نەبوو.');
    }
  };

  // Wipe All Attendance Records Handler
  const handleWipeAllAttendance = async () => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی سەرجەم داتاکانی ئامادەبوون و تۆماری دەوام؟ ئەم کارە تەواوی خشتەکان و سێرڤەر پاک دەکاتەوە.')) return;
    try {
      await fetch('/api/attendance/reset-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipeAll: true })
      });
    } catch (err) { logger.warn(err); }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ashley_local_attendanceLogs');
        localStorage.removeItem('ashley_live_checkins');
        localStorage.removeItem(`ashley_admin_notes_${selectedMonth}`);
        localStorage.removeItem(`ashley_ot_notes_${selectedMonth}`);
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
      } catch (err) { logger.warn(err); }
    }

    setAttendanceLogs([]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ashley_attendance_updated'));
    }
    alert('سەرجەم داتاکانی ئامادەبوون و تۆمارەکان بە سەرکەوتوویی لە داتابەیس و سیستم پاککرانەوە.');
  };

  if (authLoading || !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">پشکنینی ئاسایش و لۆدکردنی داشبۆرد...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-3 sm:p-5 lg:p-6 dir-rtl font-sans space-y-5 select-none transition-colors duration-300" dir="rtl">
      
      {/* 🧭 TOP COMMAND HEADER BAR (PURE LIGHT MODE • TACTILE APPLE BUTTONS) */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs transition-all duration-300">
        
        {/* Brand Identity & Server Telemetry */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shadow-xs shrink-0 transition-transform duration-200 hover:scale-105">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                کۆمپانیای گروپی دیوان | ئاشڵی
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>سێرڤەر چالاکە</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium font-mono mt-0.5">
              {currentTimeStr || format(new Date(), 'yyyy-MM-dd | HH:mm:ss')}
            </p>
          </div>
        </div>

        {/* View Switcher & Action Controls (Tactile Buttons) */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Segmented Tab Tray */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            
            <button
              type="button"
              onClick={() => setAdminView('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                adminView === 'matrix'
                  ? 'bg-white text-blue-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>خشتەی مانگانە</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                adminView === 'daily'
                  ? 'bg-white text-blue-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>ڕۆژانە</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('tools')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                adminView === 'tools'
                  ? 'bg-white text-blue-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="ئامرازەکان"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>ئامرازەکان</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminView('workflow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                adminView === 'workflow'
                  ? 'bg-white text-blue-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ئاگادارییەکان</span>
            </button>

          </div>

          {/* Password Modal Button */}
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-blue-600 shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            title="گۆڕینی وشەی تێپەڕ"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Logout Button */}
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
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            title="چوونەدەرەوە"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </header>

      {/* ========================================================================= */}
      {/* 📊 VIEW 1: 31-DAY GPS ATTENDANCE MATRIX (PRIMARY MASTER TABLE OPEN DIRECTLY) */}
      {/* ========================================================================= */}
      {adminView === 'matrix' && (
        <section className="w-full transition-opacity duration-300">
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
        <section className="w-full transition-opacity duration-300">
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
      {/* 🛠️ VIEW 3: ADMIN TOOLS (PURE LIGHT MODE • TACTILE BUTTONS) */}
      {/* ========================================================================= */}
      {adminView === 'tools' && (
        <section className="space-y-4 max-w-4xl mx-auto transition-opacity duration-300">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            
            <div className="flex items-center gap-2.5 text-slate-900 border-b border-slate-100 pb-3">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm sm:text-base font-black">ئامرازەکانی سیستەم و ئاسایش</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              
              {/* Reset All Attendance */}
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                  <Trash2 className="w-4 h-4" />
                  <span>سڕینەوەی تۆمارەکانی ئامادەبوون</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  سڕینەوەی سەرجەم داتاکانی دەوام و ئامادەبوون لە داتابەیس.
                </p>
                <button
                  type="button"
                  onClick={handleWipeAllAttendance}
                  className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>سڕینەوەی هەموو تۆمارەکان</span>
                </button>
              </div>

              {/* System Backup */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-black text-xs">
                  <Download className="w-4 h-4" />
                  <span>هەڵگرتنی داتای سیستەم (Backup)</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  داگرتنی کۆپییەکی یەدەگی هەموو داتاکان بە فایلی JSON.
                </p>
                <button
                  type="button"
                  onClick={exportStateAsJson}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>داگرتنی فایلی یەدەگ</span>
                </button>
              </div>

              {/* Password Change */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-black text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>وشەی تێپەڕی بەڕێوەبەر</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  نوێکردنەوەی وشەی نهێنی ئەکاونتی دەسەڵاتداری سەرەکی.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>گۆڕینی وشەی تێپەڕ</span>
                </button>
              </div>

              {/* Quick Jump to Corporate Settings */}
              <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-purple-700 font-black text-xs">
                  <Settings className="w-4 h-4" />
                  <span>ناسنامەی کۆمپانیا و لۆگۆکان</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  ڕێکخستنی ناوی براند، لۆگۆی فەرمی و پێناسەکانی سیستم.
                </p>
                <Link
                  href="/settings"
                  className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 text-center"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>ناسنامە و لۆگۆکان</span>
                </Link>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ⚡ VIEW 4: NOTIFICATION & PERMISSION ROUTING MATRIX */}
      {/* ========================================================================= */}
      {adminView === 'workflow' && (
        <section className="w-full transition-opacity duration-300">
          <NotificationRoutingMatrix />
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
            alert(`ڕوخساری (${faceEnrollEmp.fullName3Part || faceEnrollEmp.name}) بە سەرکەوتوویی تۆمارکرا!`);
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
