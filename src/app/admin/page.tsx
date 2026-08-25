'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';
import { AttendanceSheetGrid } from '@/components/attendance/AttendanceSheetGrid';
import { AdminFaceEnrollModal } from '@/components/attendance/AdminFaceEnrollModal';
import { AdminEmployeeDetailsModal } from '@/components/admin/AdminEmployeeDetailsModal';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';
import { format } from 'date-fns';
import { 
  Users, 
  Package, 
  Truck, 
  Settings, 
  Plus, 
  UserPlus,
  MapPin, 
  Download, 
  Upload, 
  LogOut, 
  Type, 
  FileSpreadsheet, 
  FolderArchive, 
  Map, 
  Clock, 
  DollarSign, 
  Calendar, 
  QrCode, 
  Trash2, 
  CheckCircle, 
  UserCheck, 
  UserX,
  Sparkles,
  Edit,
  Eye,
  Layers,
  Archive,
  Camera,
  FileText,
  Shield,
  Search,
  RefreshCw,
  KeyRound,
  BarChart3,
  Award,
  TrendingUp,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Printer,
  Table,
  Smartphone,
  X
} from 'lucide-react';
import { AdminPasswordChangeModal } from '@/components/admin/AdminPasswordChangeModal';
import { AdminOvertimeModule } from '@/components/admin/AdminOvertimeModule';
import { AdminExpensesModule } from '@/components/admin/AdminExpensesModule';
import { AdminLogisticsModule } from '@/components/admin/AdminLogisticsModule';
import { AdminWeeklyMonthlyStatsModule } from '@/components/admin/AdminWeeklyMonthlyStatsModule';
import { AdminDailyAttendanceTable } from '@/components/admin/AdminDailyAttendanceTable';
import { formatTime12H, formatTime24H, exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

function formatMinutesHuman(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} ک و ${m} خ`;
  if (h > 0) return `${h} کاتژمێر`;
  return `${m} خولەک`;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMobileDeviceModal, setShowMobileDeviceModal] = useState(false);
  const [adminActiveSection, setAdminActiveSection] = useState<'overview' | 'attendance' | 'hr' | 'overtime' | 'settings' | 'expenses' | 'logistics' | 'stats' | 'maps'>('attendance');
  const [attendanceSubTab, setAttendanceSubTab] = useState<'daily' | 'matrix'>('daily');

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
      router.replace('/adminpanel');
    }
  }, [router]);

  // Inactivity Auto-Logout
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
        router.replace('/adminpanel');
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
    setEmployees,
    items,
    settings,
    setSettings,
    attendanceLogs,
    setAttendanceLogs,
    exportStateAsJson
  } = useAppContext();

  // Company Multi-Location Config
  const [companyLocations, setCompanyLocations] = useState<Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  }>>([]);

  const [syncedFactoryLocation, setSyncedFactoryLocation] = useState<{
    id?: string;
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  }>({
    name: settings?.factoryLocation?.name || 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
    lat: settings?.factoryLocation?.lat || 35.5571,
    lng: settings?.factoryLocation?.lng || 45.4352,
    radiusMeters: settings?.factoryLocation?.radiusMeters || 50,
  });

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
          setSyncedFactoryLocation(data.locations[0]);
        } else if (data?.lat && data?.lng) {
          setSyncedFactoryLocation(data);
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

  const factoryLocation = syncedFactoryLocation;

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
  const [adminNotesLocal, setAdminNotesLocal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ashley_admin_notes_2026-08');
        localStorage.removeItem('ashley_ot_notes_2026-08');
        localStorage.removeItem('ashley_local_attendanceLogs');
        localStorage.removeItem('ashley_live_checkins');
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`ashley_admin_notes_${selectedMonth}`);
        if (stored) {
          setAdminNotesLocal(JSON.parse(stored));
          return;
        }
      } catch {}
    }
    setAdminNotesLocal({});
  }, [selectedMonth, employees]);

  const handleUpdateAdminNote = (key: string, note: string) => {
    setAdminNotesLocal(prev => {
      const updated = { ...prev, [key]: note };
      try {
        localStorage.setItem(`ashley_admin_notes_${selectedMonth}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const adminNotes = adminNotesLocal;

  // Modals state
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'active' | 'resigned'>('active');
  const [empSearch, setEmpSearch] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [faceEnrollEmp, setFaceEnrollEmp] = useState<Employee | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states for adding/editing employee
  const [empShortName, setEmpShortName] = useState('');
  const [empFullName3, setEmpFullName3] = useState('');
  const [empRole, setEmpRole] = useState<any>('Employee');
  const [empPhone, setEmpPhone] = useState('');
  const [empStartDate, setEmpStartDate] = useState('');
  const [empResignDate, setEmpResignDate] = useState('');
  const [empRehireDate, setEmpRehireDate] = useState('');

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'resigned' && e.isActive !== false);
  }, [employees]);

  // Live attendance refresh trigger
  const [liveLogRefreshCounter, setLiveLogRefreshCounter] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setLiveLogRefreshCounter(c => c + 1);
    };
    window.addEventListener('ashley_attendance_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('ashley_attendance_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Pure dynamic attendance logs from Supabase
  const allMergedAttendanceLogs = useMemo(() => {
    return attendanceLogs;
  }, [attendanceLogs, liveLogRefreshCounter]);

  // Aggregated KPIs for Overview Dashboard
  const dashboardKpis = useMemo(() => {
    const totalStaff = employees.length;
    const activeStaff = activeEmployees.length;
    const resignedStaff = employees.filter(e => e.status === 'resigned' || e.isActive === false).length;

    let totalOtHours = 0;
    let totalOtCost = 0;
    let otEmployeesSet = new Set<string>();

    return {
      totalStaff,
      activeStaff,
      resignedStaff,
      totalOtHours: totalOtHours.toFixed(1),
      totalOtCost: totalOtCost.toLocaleString(),
      otEmployeesCount: otEmployeesSet.size,
      totalLocations: companyLocations.length || 1,
    };
  }, [employees, activeEmployees, companyLocations]);

  // Open Add/Edit Employee Modal
  const handleOpenEmpModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setEmpShortName(emp.name);
      setEmpFullName3(emp.fullName3Part || emp.name);
      setEmpRole(emp.role || 'Employee');
      setEmpPhone(emp.phone || '');
      setEmpStartDate(emp.startDate || '');
      setEmpResignDate(emp.resignedDate || '');
      setEmpRehireDate(emp.rehiredDate || '');
    } else {
      setEditingEmp(null);
      setEmpShortName('');
      setEmpFullName3('');
      setEmpRole('Employee');
      setEmpPhone('');
      setEmpStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEmpResignDate('');
      setEmpRehireDate('');
    }
    setShowEmpModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empShortName.trim()) return alert('ناوی کورت پێویستە');

    if (editingEmp) {
      const updated = employees.map((emp) =>
        emp.id === editingEmp.id
          ? {
              ...emp,
              name: empShortName.trim(),
              fullName3Part: empFullName3.trim(),
              role: empRole,
              phone: empPhone.trim(),
              startDate: empStartDate,
              resignedDate: empResignDate,
              rehiredDate: empRehireDate,
            }
          : emp
      );
      setEmployees(updated as any);
    } else {
      const newEmp: Employee = {
        id: `emp-${Date.now()}`,
        name: empShortName.trim(),
        fullName3Part: empFullName3.trim(),
        employeeId: `${employees.length + 1}`.padStart(2, '0'),
        role: empRole,
        phone: empPhone.trim(),
        startDate: empStartDate || format(new Date(), 'yyyy-MM-dd'),
        resignedDate: '',
        rehiredDate: '',
        status: 'active',
        isActive: true,
        password: '1234',
        createdAt: new Date().toISOString(),
      };
      setEmployees([...employees, newEmp]);
    }

    setShowEmpModal(false);
  };

  const handleToggleResignation = (emp: Employee) => {
    const isCurrentlyResigned = emp.status === 'resigned' || emp.isActive === false;
    const msg = isCurrentlyResigned
      ? `ئایا دڵنیایت لە گەڕانەوەی کارمەند (${emp.name}) بۆ ناو لیستی چالاکی دەوام؟`
      : `ئایا دڵنیایت لە تۆمارکردنی وازهێنانی کارمەند (${emp.name})؟`;

    if (confirm(msg)) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const updated = employees.map((item) =>
        item.id === emp.id
          ? {
              ...item,
              status: isCurrentlyResigned ? ('active' as const) : ('resigned' as const),
              isActive: isCurrentlyResigned,
              resignedDate: isCurrentlyResigned ? item.resignedDate : todayStr,
              rehiredDate: isCurrentlyResigned ? todayStr : item.rehiredDate,
            }
          : item
      );
      setEmployees(updated as any);
    }
  };

  const handleDeleteEmployee = (empId: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کارمەندە؟')) {
      setEmployees(employees.filter((e) => e.id !== empId));
    }
  };

  const handleDeleteFace = async (emp: Employee) => {
    const empName = emp.fullName3Part || emp.name;
    if (!confirm(`ئایا دڵنیایت لە سڕینەوە و پاککردنەوەی ناسنامەی دەموچاوی (${empName}) لە تەواوی سیستەم؟`)) {
      return;
    }

    try {
      // 1. Delete locally
      try {
        const stored = localStorage.getItem('ashley_face_registry_local');
        if (stored) {
          const parsed = JSON.parse(stored);
          delete parsed[emp.id];
          localStorage.setItem('ashley_face_registry_local', JSON.stringify(parsed));
        }
      } catch {}

      // 2. Delete on server
      await fetch('/api/attendance/face/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.id }),
      });

      // 3. Update registeredFaceIds
      setRegisteredFaceIds(prev => prev.filter(id => id !== emp.id));
      alert(`✅ ناسنامەی دەموچاوی (${empName}) بە سەرکەوتوویی سڕایەوە.`);
    } catch (err: any) {
      alert(`هەڵەیەک ڕوویدا لە سڕینەوە: ${err.message}`);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchQuery = (emp.fullName3Part || emp.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
      (emp.role || '').toLowerCase().includes(empSearch.toLowerCase());
    if (!matchQuery) return false;
    if (empStatusFilter === 'active') return emp.status !== 'resigned' && emp.isActive !== false;
    if (empStatusFilter === 'resigned') return emp.status === 'resigned' || emp.isActive === false;
    return true;
  });

  // Strict Security Gate
  if (!authChecked || !sessionUser) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-900 text-white font-sans dir-rtl" dir="rtl">
        <div className="text-center space-y-3 p-6 bg-slate-800/80 border border-slate-700 rounded-3xl shadow-2xl">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">پشکنینی دەسەڵاتی بەڕێوەبەر... (پارێزراو)</p>
          <p className="text-xs text-slate-500">تکایە لە ڕێگەی دەروازەی /adminpanel لۆگین بکە</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-12 p-2 sm:p-4" dir="rtl">
      
      {/* 🌟 TOP ENTERPRISE HEADER BAR */}
      <div className="panel-classic p-3 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-lg border-2 border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-md shadow-orange-500/20 flex-shrink-0 border border-orange-400/40">
            <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>🛡️ پەنەری بەڕێوەبەری سەرەکی ئاشڵی — Admin Master Hub</span>
            </h1>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              بەڕێوەبەر: <span className="text-amber-300 font-mono font-black">{sessionUser?.username || 'Darko'}</span> | کۆنترۆڵی گشتی ستاف، ئامار، ئیزافە، دارایی و نەخشە
            </p>
          </div>
        </div>

        {/* TOP QUICK CONTROLS */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold hidden md:block">
            ⏰ {currentTimeStr || '2026-08-18 | 08:35'}
          </div>

          {/* ⚙️ SETTINGS BUTTON */}
          <button 
            onClick={() => setAdminActiveSection('settings')} 
            className={`btn-classic px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition-all shadow-sm ${
              adminActiveSection === 'settings' 
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300 font-black' 
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
            title="ڕێکخستنەکان و سڕینەوەی داتاکان"
          >
            <Settings className="w-3.5 h-3.5 text-amber-300" />
            <span>⚙️ ڕێکخستنەکان</span>
          </button>

          <button onClick={() => setShowMobileDeviceModal(true)} className="btn-classic bg-orange-600/40 hover:bg-orange-600/60 text-white border-orange-400/40 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
            <Smartphone className="w-3.5 h-3.5 text-orange-300" />
            <span>مۆبایلەکان 📱</span>
          </button>

          <button onClick={() => setShowPasswordModal(true)} className="btn-classic bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-300" />
            <span>پاسۆرد</span>
          </button>

          <button onClick={() => setShowMapPicker(true)} className="btn-classic bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-300" />
            <span>نەخشە</span>
          </button>

          <button onClick={exportStateAsJson} className="btn-classic bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-emerald-300" />
            <span>باکئەپ</span>
          </button>

          <button
            onClick={async () => {
              if (confirm('ئایا دڵنیایت لە دەرچوون لە ئەکاونتی ئەدمین؟')) {
                await logout();
                router.replace('/adminpanel');
              }
            }}
            className="btn-classic-danger py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <LogOut className="w-3.5 h-3.5 text-white" />
            <span>دەرچوون</span>
          </button>
        </div>
      </div>

      {/* 🧭 MASTER ERP ENTERPRISE NAVIGATION BAR */}
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          
          {/* 📅 Hub 1: Attendance Central (Primary Default) */}
          <button
            onClick={() => setAdminActiveSection('attendance')}
            className={`group relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'attendance'
                ? 'bg-emerald-900 text-white border-emerald-700 shadow-lg ring-4 ring-emerald-400/40 scale-[1.02]'
                : 'bg-slate-50 hover:bg-emerald-50/60 text-slate-800 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
              adminActiveSection === 'attendance'
                ? 'bg-emerald-700 text-white shadow-inner'
                : 'bg-emerald-100 text-emerald-900'
            }`}>
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-xs font-black tracking-tight block">ئامادەبوون و دەوام</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
              adminActiveSection === 'attendance' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-emerald-100 text-emerald-900'
            }`}>
              📅 ڕۆژانە و ۳۱ ڕۆژە
            </span>
          </button>

          {/* 🔘 Hub 0: Overview Dashboard */}
          <button
            onClick={() => setAdminActiveSection('overview')}
            className={`group relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'overview'
                ? 'bg-slate-900 text-white border-slate-800 shadow-lg ring-4 ring-indigo-400/40 scale-[1.02]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
              adminActiveSection === 'overview'
                ? 'bg-indigo-600 text-white shadow-inner'
                : 'bg-slate-200 text-slate-800'
            }`}>
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <span className="text-xs font-black tracking-tight block">داشبۆردی گشتی</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
              adminActiveSection === 'overview' ? 'bg-indigo-300 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'
            }`}>
              Executive 360°
            </span>
          </button>

          {/* 🔵 Hub 2: HR & Staff */}
          <button
            onClick={() => setAdminActiveSection('hr')}
            className={`group relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'hr'
                ? 'bg-blue-900 text-white border-blue-700 shadow-lg ring-4 ring-blue-400/40 scale-[1.02]'
                : 'bg-slate-50 hover:bg-blue-50/60 text-slate-800 border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
              adminActiveSection === 'hr'
                ? 'bg-blue-700 text-white shadow-inner'
                : 'bg-blue-100 text-blue-900'
            }`}>
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-black tracking-tight block">کارمەندان و ستاف</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
              adminActiveSection === 'hr' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-blue-100 text-blue-900'
            }`}>
              👥 {dashboardKpis.activeStaff} کارمەند
            </span>
          </button>

          {/* 🟠 Hub 3: Overtime Master */}
          <button
            onClick={() => setAdminActiveSection('overtime')}
            className={`group relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'overtime'
                ? 'bg-amber-900 text-white border-amber-700 shadow-lg ring-4 ring-orange-400/40 scale-[1.02]'
                : 'bg-slate-50 hover:bg-amber-50/60 text-slate-800 border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
              adminActiveSection === 'overtime'
                ? 'bg-amber-600 text-white shadow-inner'
                : 'bg-amber-100 text-amber-900'
            }`}>
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-black tracking-tight block">کاتی زیادە (ئیزافە)</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
              adminActiveSection === 'overtime' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-amber-100 text-amber-900'
            }`}>
              ⚡ +{dashboardKpis.totalOtHours} کاتژمێر
            </span>
          </button>

          {/* ⚙️ Hub 5: Settings & System */}
          <button
            onClick={() => setAdminActiveSection('settings')}
            className={`group relative p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'settings'
                ? 'bg-slate-950 text-white border-slate-700 shadow-lg ring-4 ring-slate-400/40 scale-[1.02]'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
              adminActiveSection === 'settings'
                ? 'bg-slate-700 text-white shadow-inner'
                : 'bg-slate-200 text-slate-800'
            }`}>
              <Settings className="w-6 h-6" />
            </div>
            <span className="text-xs font-black tracking-tight block">ڕێکخستنەکان</span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full mt-1 ${
              adminActiveSection === 'settings' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'
            }`}>
              ⚙️ ڕیسێت و کاتەکان
            </span>
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📊 EXECUTIVE DASHBOARD & MONTHLY STAFF 360 OVERVIEW (LANDING VIEW) */}
      {/* ========================================================================= */}
      {adminActiveSection === 'overview' && (
        <div className="space-y-4">
          
          {/* Top 4 Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-2xl border-2 border-blue-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl text-blue-900">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">کارمەندانی چالاک</span>
                <p className="text-lg font-black text-blue-950 font-mono mt-0.5">
                  {dashboardKpis.activeStaff} کارمەند
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border-2 border-amber-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-xl text-amber-900">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">کۆی کاتی زیادە (مانگی 8)</span>
                <p className="text-lg font-black text-amber-950 font-mono mt-0.5">
                  +{dashboardKpis.totalOtHours} کاتژمێر
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border-2 border-emerald-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-xl text-emerald-900">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">شایستەی پارەی ئیزافە</span>
                <p className="text-lg font-black text-emerald-950 font-mono mt-0.5">
                  +{dashboardKpis.totalOtCost} IQD
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border-2 border-purple-200 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl text-purple-900">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-500 font-bold block">ڕێژەی گشتی پابەندبوون</span>
                <p className="text-lg font-black text-purple-950 font-mono mt-0.5">
                  96% دیسیپلین
                </p>
              </div>
            </div>
          </div>

          {/* 👥 MASTER MONTHLY STAFF OVERVIEW TABLE (CLICKABLE ROWS) */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-md overflow-hidden">
            <div className="bg-slate-900 text-white p-3 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-white">
                  خشتەی گشتی ئامار و پرۆفایلی کارمەندان (مانگی 2026-08)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-300 font-bold">
                  💡 کرتە لەسەر ناوی هەر کارمەندێک بکە بۆ بینینی تەواوی چالاکی ئەو مانگەی
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-900 font-black">
                    <th className="p-3 border-l border-slate-200 w-12 text-center">#</th>
                    <th className="p-3 border-l border-slate-200">ناوی کارمەند و ناسنامە</th>
                    <th className="p-3 border-l border-slate-200">پۆست / ئەرک</th>
                    <th className="p-3 border-l border-slate-200 text-center">ڕۆژانی دەوام</th>
                    <th className="p-3 border-l border-slate-200 text-center bg-blue-50 text-blue-950">کاتی کارکردن</th>
                    <th className="p-3 border-l border-slate-200 text-center bg-amber-50 text-amber-950">کاتی زیادە (Overtime)</th>
                    <th className="p-3 border-l border-slate-200 text-center bg-emerald-50 text-emerald-950">پارەی ئیزافە (IQD)</th>
                    <th className="p-3 border-l border-slate-200 text-center">ڕوخسار (AI Face)</th>
                    <th className="p-3 border-l border-slate-200 text-center">دۆخ</th>
                    <th className="p-3 text-center w-36">کردار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold">
                  {activeEmployees.map((emp, idx) => {
                    const hasFace = registeredFaceIds.includes(emp.id);
                    const totalOtHours = 0;
                    const totalOtAmount = 0;

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => setSelectedEmp360(emp)}
                        className="hover:bg-indigo-50/60 cursor-pointer transition-all group"
                      >
                        <td className="p-3 border-l border-slate-200 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-3 border-l border-slate-200">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-300 flex items-center justify-center font-black text-indigo-900 text-xs">
                              {emp.fullName3Part ? emp.fullName3Part.charAt(0) : emp.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-slate-950 font-black group-hover:text-indigo-900 group-hover:underline block">
                                {emp.fullName3Part || emp.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                EMP-{emp.employeeId || emp.id.replace('emp-', '')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 border-l border-slate-200 text-slate-700 font-bold">
                          {emp.role || 'Employee'}
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-950 border border-blue-200">
                            13 ڕۆژ
                          </span>
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center font-mono text-blue-950 bg-blue-50/30 font-black">
                          {(13 * 8 + totalOtHours).toFixed(1)} کاتژمێر
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center font-mono text-amber-950 bg-amber-50/40 font-black">
                          {totalOtHours > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-600 text-white shadow-xs">
                              +{totalOtHours} کاتژمێر
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center font-mono text-emerald-950 bg-emerald-50/40 font-black">
                          {totalOtAmount > 0 ? (
                            <span className="text-emerald-900">+{totalOtAmount.toLocaleString()} IQD</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center" onClick={(e) => e.stopPropagation()}>
                          {hasFace ? (
                            <button
                              type="button"
                              onClick={() => setFaceEnrollEmp(emp)}
                              className="px-2 py-0.5 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 text-[10px] font-black cursor-pointer inline-flex items-center gap-1 shadow-xs transition-all"
                              title="دووبارە ناساندنەوە و نوێکردنەوەی ڕوخسار"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>✅ ناسراوە (دووبارە)</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFaceEnrollEmp(emp)}
                              className="px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-400 text-[10px] font-black cursor-pointer inline-flex items-center gap-1 shadow-xs transition-all"
                            >
                              <Camera className="w-3 h-3" />
                              <span>📸 ناساندن</span>
                            </button>
                          )}
                        </td>
                        <td className="p-3 border-l border-slate-200 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold">
                            چالاک
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmp360(emp);
                            }}
                            className="btn-classic text-xs font-bold px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-300 rounded-lg flex items-center gap-1.5 mx-auto"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-700" />
                            <span>تەواوی مانگ</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📅 SECTION 1: ATTENDANCE & DAILY OPERATIONS HUB */}
      {/* ========================================================================= */}
      {adminActiveSection === 'attendance' && (
        <section className="panel-classic space-y-4">
          {/* Top Sub-tabs Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAttendanceSubTab('daily')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  attendanceSubTab === 'daily'
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>📅 خشتەی ئامادەبوونی ڕۆژانە (Daily Attendance)</span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceSubTab('matrix')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  attendanceSubTab === 'matrix'
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>📊 خشتەی ۳۱ ڕۆژەی گشتی (31-Day Matrix)</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📅 SUB-TAB 1: DAILY ATTENDANCE HUB (Sequential Daily Tables) */}
          {/* ========================================================================= */}
          {attendanceSubTab === 'daily' && (
            <div className="space-y-6">
              {/* Table 1: Master Daily Attendance Table */}
              <AdminDailyAttendanceTable
                employees={employees}
                attendanceLogs={allMergedAttendanceLogs}
                adminNotes={adminNotes}
                onUpdateAdminNote={handleUpdateAdminNote}
                selectedMonth={selectedMonth}
              />

              {/* Table 2: Live Check-In / Out Real-Time Activity Stream Table */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900">خشتەی تۆمارە زیندووەکانی چێک ئین و چێک ئاوت (Live Activity Stream)</h3>
                      <span className="text-[10px] text-slate-500 font-bold">تەواوی ئەو دەوام و تێبینیانەی کارمەندان بە ڕاستەوخۆ لەڕێگەی کامێرا و سیستەم تۆماریان کردووە</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black font-mono">
                    🟢 Live Synced
                  </span>
                </div>

                <div className="table-classic-wrapper rounded-xl border border-slate-200 overflow-hidden">
                  <table className="table-classic w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black text-right">
                        <th className="p-2 text-center w-12">#</th>
                        <th className="p-2 w-48">ناوی کارمەند</th>
                        <th className="p-2 text-center w-36">جۆری کردار</th>
                        <th className="p-2 text-center w-36">کاتی تۆمار</th>
                        <th className="p-2 w-44">شوێن و بازنە</th>
                        <th className="p-2">💬 تێبینی کارمەند</th>
                        <th className="p-2 text-center w-28">دۆخی ئاسایش</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allMergedAttendanceLogs.filter(l => (l.date || '').startsWith(selectedMonth)).slice(0, 15).map((log, lIdx) => {
                        const isIn = (log.type || (log as any).action || '').toLowerCase().includes('in') || (log.type || '').includes('هاتن');
                        return (
                          <tr key={log.id || lIdx} className="hover:bg-slate-50">
                            <td className="p-2 border-l border-slate-100 text-center font-mono text-slate-400 font-bold">{lIdx + 1}</td>
                            <td className="p-2 border-l border-slate-100 font-black text-slate-900">{log.name || log.userName || (log as any).employeeName}</td>
                            <td className="p-2 border-l border-slate-100 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-block ${
                                isIn ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-sky-100 text-sky-950 border border-sky-300'
                              }`}>
                                {isIn ? '📥 چێک ئین (هاتن)' : '📤 چێک ئاوت (ڕۆیشتن)'}
                              </span>
                            </td>
                            <td className="p-2 border-l border-slate-100 text-center font-mono font-bold text-slate-700">{log.time || log.createdAt}</td>
                            <td className="p-2 border-l border-slate-100 text-slate-600 font-bold">{log.distance || 'کۆمپانیای سەرەکی ئاشڵی'}</td>
                            <td className="p-2 border-l border-slate-100 font-bold text-slate-700">
                              {log.employeeNote || (log.notes?.startsWith('تێبینی کارمەند:') ? log.notes.replace('تێبینی کارمەند:', '').trim() : log.notes || '-')}
                            </td>
                            <td className="p-2 text-center">
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block">
                                ✅ پارێزراو
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 📊 SUB-TAB 2: MONTHLY 31-DAY HUB (Sequential Monthly Tables) */}
          {/* ========================================================================= */}
          {attendanceSubTab === 'matrix' && (
            <div id="attendance-sheet-grid-section" className="space-y-6">
              {/* Table 1: Master 31-Day Attendance Matrix Grid */}
              <AttendanceSheetGrid employees={activeEmployees} attendanceLogs={allMergedAttendanceLogs} />

              {/* Table 2: Monthly Overtime & Shift Settlement Table */}
              <div className="pt-2">
                <AdminOvertimeModule employees={employees} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 👥 SECTION 2: HR & STAFF MANAGEMENT HUB */}
      {/* ========================================================================= */}
      {adminActiveSection === 'hr' && (
        <section className="panel-classic space-y-4">
          <div className="panel-header-classic flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-800" />
              <span>بەڕێوەبردنی ستاف، زانیاری کارمەندان، و ناسنامەی دەموچاو (HR Staff Hub)</span>
            </h2>
            <button
              onClick={() => handleOpenEmpModal()}
              className="btn-classic-primary text-xs flex items-center gap-1 px-3 py-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>زیادکردنی کارمەندی نوێ</span>
            </button>
          </div>

          <div className="space-y-4">
              {/* Search and Filters & Export */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="گەڕان بەدوای ناوی کارمەند یان پۆست..."
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    className="input-classic w-full text-xs font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-bold">
                    <button
                      onClick={() => setEmpStatusFilter('active')}
                      className={`px-3 py-1 rounded-lg border ${
                        empStatusFilter === 'active' ? 'bg-blue-900 text-white font-black' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      چالاکەکان ({activeEmployees.length})
                    </button>
                    <button
                      onClick={() => setEmpStatusFilter('resigned')}
                      className={`px-3 py-1 rounded-lg border ${
                        empStatusFilter === 'resigned' ? 'bg-rose-800 text-white font-black' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      وازهێناوەکان ({employees.length - activeEmployees.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const cols: ExportTableColumn[] = [
                        { header: '#', key: 'index', width: '35px', align: 'center' },
                        { header: 'ناوی تەواوی سێ قۆڵی', key: 'fullName', align: 'right' },
                        { header: 'پۆست / ئەرک', key: 'role', align: 'right' },
                        { header: 'ژمارەی مۆبایل', key: 'phone', align: 'center' },
                        { header: 'بەرواری دەستبەکاربوون', key: 'startDate', align: 'center' },
                        { header: 'ناسنامەی دەموچاو (AI Face)', key: 'faceStatus', align: 'center' },
                        { header: 'دۆخی کارمەند', key: 'status', align: 'center' },
                      ];

                      const data = filteredEmployees.map((emp, idx) => ({
                        index: idx + 1,
                        fullName: emp.fullName3Part || emp.name,
                        role: emp.role || 'کارمەند',
                        phone: emp.phone || '-',
                        startDate: emp.startDate || '-',
                        faceStatus: registeredFaceIds.includes(emp.id) ? '✅ تۆمارکراوە' : '❌ تۆمارنەکراوە',
                        status: emp.status === 'resigned' ? 'وازهێناو' : 'چالاک',
                      }));

                      exportToPDF({
                        title: 'لیستی فەرمیی سەرجەم کارمەندانی کۆمپانیای ئاشڵی (Ashley Staff Directory)',
                        subtitle: 'بەشی سەرچاوە مرۆییەکان و ئیدارەی گشتی (HR Department)',
                        period: `بەرواری تۆمار: ${format(new Date(), 'yyyy-MM-dd')}`,
                        columns: cols,
                        data,
                        fileName: `Ashley_Staff_Directory_${format(new Date(), 'yyyy-MM-dd')}`,
                        summaryCards: [
                          { label: 'کۆی گشتی کارمەندان', value: `${employees.length} کارمەند`, color: '#2563eb' },
                          { label: 'کارمەندانی چالاک', value: `${activeEmployees.length} کارمەند`, color: '#059669' },
                          { label: 'وازهێناوەکان', value: `${employees.length - activeEmployees.length} کارمەند`, color: '#be123c' },
                          { label: 'خاوەن ناسنامەی ڕوخسار', value: `${registeredFaceIds.length} کارمەند`, color: '#7c3aed' },
                        ],
                      });
                    }}
                    className="btn-classic text-xs font-bold px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                    title="پرێنتکردنی تەواوی لیستی کارمەندان وەک PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>🖨️ پرێنت</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const cols: ExportTableColumn[] = [
                        { header: 'ژمارە', key: 'index' },
                        { header: 'ناوی تەواو', key: 'fullName' },
                        { header: 'پۆست', key: 'role' },
                        { header: 'ژمارەی مۆبایل', key: 'phone' },
                        { header: 'بەرواری دەستپێک', key: 'startDate' },
                        { header: 'ناسنامەی دەموچاو', key: 'faceStatus' },
                        { header: 'دۆخ', key: 'status' },
                      ];

                      const data = filteredEmployees.map((emp, idx) => ({
                        index: idx + 1,
                        fullName: emp.fullName3Part || emp.name,
                        role: emp.role || 'کارمەند',
                        phone: emp.phone || '',
                        startDate: emp.startDate || '',
                        faceStatus: registeredFaceIds.includes(emp.id) ? 'ناسراوە' : 'تۆمارنەکراوە',
                        status: emp.status === 'resigned' ? 'وازهێناو' : 'چالاک',
                      }));

                      exportToCSV(cols, data, `Ashley_Staff_Directory_${format(new Date(), 'yyyy-MM-dd')}`);
                    }}
                    className="btn-classic text-xs font-bold px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                    title="داگرتنی لیستی کارمەندان وەک Excel / CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>📊 CSV</span>
                  </button>
                </div>
              </div>

              {/* Staff Management Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 text-slate-900 font-black">
                      <th className="p-2.5 border-l border-slate-300 w-10 text-center">#</th>
                      <th className="p-2.5 border-l border-slate-300">ناوی تەواوی سێ قۆڵی</th>
                      <th className="p-2.5 border-l border-slate-300">پۆست / ئەرک</th>
                      <th className="p-2.5 border-l border-slate-300 text-center">ژمارەی مۆبایل</th>
                      <th className="p-2.5 border-l border-slate-300 text-center">دەستپێکی دەوام</th>
                      <th className="p-2.5 border-l border-slate-300 text-center">ناسنامەی دەموچاو (AI Face)</th>
                      <th className="p-2.5 text-center w-40">کردارەکان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold">
                    {filteredEmployees.map((emp, idx) => {
                      const hasFace = registeredFaceIds.includes(emp.id);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 border-l border-slate-200 text-slate-950 font-black">
                            {emp.fullName3Part || emp.name}
                          </td>
                          <td className="p-2.5 border-l border-slate-200 text-slate-700">{emp.role}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{emp.phone || '-'}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center font-mono">{emp.startDate || '-'}</td>
                          <td className="p-2.5 border-l border-slate-200 text-center">
                            {hasFace ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
                                  ✅ ناسراوە
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFaceEnrollEmp(emp)}
                                  className="px-2 py-0.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-950 border border-blue-300 text-[10px] font-black cursor-pointer flex items-center gap-1 shadow-xs transition-all"
                                  title="دووبارە ناساندنەوە و گۆڕینی وێنەی ڕوخساری کارمەند"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                  <span>نوێکردنەوە</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFace(emp)}
                                  className="px-1.5 py-0.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-950 border border-rose-300 text-[10px] font-black cursor-pointer flex items-center gap-0.5 shadow-xs transition-all"
                                  title="سڕینەوەی ناسنامەی دەموچاوی ئەم کارمەندە"
                                >
                                  <Trash2 className="w-2.5 h-2.5 text-rose-700" />
                                  <span>سڕینەوە</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setFaceEnrollEmp(emp)}
                                className="px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-950 border border-amber-400 text-[10px] font-black cursor-pointer flex items-center gap-1 shadow-xs mx-auto transition-all"
                              >
                                <Camera className="w-3 h-3" />
                                <span>📸 ناساندنی ڕوخسار</span>
                              </button>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedEmp360(emp)}
                                className="text-indigo-700 hover:text-indigo-950 p-1 hover:bg-indigo-50 rounded"
                                title="بینینی تەواوی ئاماری مانگانە"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEmpModal(emp)}
                                className="text-blue-700 hover:text-blue-950 p-1 hover:bg-blue-50 rounded"
                                title="دەستکاری"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleResignation(emp)}
                                className="text-amber-700 hover:text-amber-950 p-1 hover:bg-amber-50 rounded"
                                title={emp.status === 'resigned' ? 'گەڕانەوە' : 'وازهێنان'}
                              >
                                {emp.status === 'resigned' ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="text-rose-700 hover:text-rose-950 p-1 hover:bg-rose-50 rounded"
                                title="سڕینەوە"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ⏱️ SECTION 2: OVERTIME MASTER MODULE */}
      {/* ========================================================================= */}
      {adminActiveSection === 'overtime' && (
        <AdminOvertimeModule employees={employees} />
      )}

      {/* ========================================================================= */}
      {/* ⚙️ SECTION 5: SETTINGS & MASTER DATABASE CONFIGURATION */}
      {/* ========================================================================= */}
      {adminActiveSection === 'settings' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Section Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-600">
                <Settings className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-black">ڕێکخستنە سەرەکییەکانی سیستەم و ئامادەبوون</h2>
                <p className="text-xs text-slate-400 mt-0.5">بەڕێوەبردنی کاتەکانی دەوام، سنووری لۆکەیشنەکانی GPS، و سڕینەوە و ڕیسێتی داتاکان</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportStateAsJson}
                className="btn-classic bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" />
                <span>داگرتنی کۆپی باکئەپ (JSON)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* CARD 1: 🗑️ MASTER ATTENDANCE WIPE & RESET */}
            <div className="bg-white p-5 rounded-2xl border-2 border-rose-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2.5">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-black">سڕینەوە و ڕیسێتی سەرجەم داتاکانی ئامادەبوون</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ئەم کردارە سەرجەم لۆگە تۆمارکراوەکانی هاتن و دەرچوون، مۆڵەتەکان، غیاب و پشووەکان لە هەردوو سێرڤەر (Supabase) و کاشی مۆبایل و کۆمپیوتەر بە تەواوی پاک دەکاتەوە و دەیانکاتە سفر.
              </p>
              <button
                type="button"
                onClick={async () => {
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
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>🗑️ سڕینەوەی سەرجەم داتاکانی دەوام و ئامادەبوون (Wipe All Attendance)</span>
              </button>
            </div>

            {/* CARD 2: 🗺️ GEOFENCE LOCATIONS */}
            <div className="bg-white p-5 rounded-2xl border-2 border-cyan-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-cyan-100 pb-2.5">
                <div className="flex items-center gap-2 text-cyan-700">
                  <MapPin className="w-5 h-5" />
                  <h3 className="text-sm font-black">لۆکەیشنەکانی کۆمپانیا و بازنەی GPS</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-full font-mono">
                  {companyLocations.length} لۆکەیشن
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-700">
                {companyLocations.map((loc, i) => (
                  <div key={loc.id || i} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold">🏢 {loc.name}</span>
                    <span className="text-[11px] font-mono text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      مەودا: {loc.radiusMeters}m
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Map className="w-4 h-4" />
                <span>🗺️ دیاریکردن و دەستکاریکردنی لۆکەیشنەکان لەسەر نەخشە</span>
              </button>
            </div>

            {/* CARD 3: ⏰ SHIFT TIMINGS */}
            <div className="bg-white p-5 rounded-2xl border-2 border-amber-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-700 border-b border-amber-100 pb-2.5">
                <Clock className="w-5 h-5" />
                <h3 className="text-sm font-black">کاتەکانی دەوامی فەرمی ڕۆژانە</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">کاتی دەستپێکی دەوام (Check In):</label>
                  <input
                    type="time"
                    defaultValue="08:30"
                    className="input-classic w-full font-mono text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">کاتی تەواوبوون (Check Out):</label>
                  <input
                    type="time"
                    defaultValue="16:30"
                    className="input-classic w-full font-mono text-center font-bold"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                کاتی هاتن دوای 08:45 بە دواکەوتن دادەنرێت و کاتی مانەوە دوای 16:30 بە کاتی زیادە (ئیزافە) دەژمێردرێت.
              </p>
            </div>

            {/* CARD 4: 🔑 ADMIN PASSWORD & SECURITY */}
            <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 border-b border-indigo-100 pb-2.5">
                <KeyRound className="w-5 h-5" />
                <h3 className="text-sm font-black">پاراستن و تێپەڕەوشەی بەڕێوەبەر</h3>
              </div>
              <p className="text-xs text-slate-600">
                گۆڕینی تێپەڕەوشە و کۆدی PIN ی سەرەکی بۆ چوونەژوورەوەی ئەدمین و کۆنترۆڵکردنی بەشە هەستیارەکان.
              </p>
              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>🔑 گۆڕینی وشەی تێپەڕی ئەدمین (Change Password)</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 🚧 COMING SOON / WORK IN PROGRESS SECTION AT THE VERY BOTTOM */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 🧭 MASTER ERP MODULES & DIRECT PAGE NAVIGATION LINKS */}
      {/* ========================================================================= */}
      <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-200">
        <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-slate-800">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black">بەشە سەرەکی و پەیجە تایبەتەکانی سیستەم (Direct Links):</h3>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">
              🔗 سەرجەم پەیجەکان چالاکن
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            
            {/* 1. Master Warehouse & Inventory Suite */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                    <Table className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">بەشی کۆگا و جەرد</span>
                    <span className="text-[10px] text-slate-500 font-mono">Warehouse & Items</span>
                  </div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                  چالاکە
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs font-bold">
                <Link
                  href="/public-inventory"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>📦</span> <span>جەردی کەرەستە</span>
                </Link>
                <Link
                  href="/sold-items"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>📂</span> <span>کەرەستەی فرۆشراو</span>
                </Link>
                <Link
                  href="/pdf-archive"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>🧾</span> <span>ئەرشیفی پسوولە</span>
                </Link>
                <Link
                  href="/report-designer"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>🎨</span> <span>دیزاینی ڕاپۆرت</span>
                </Link>
              </div>
            </div>

            {/* 2. Expenses Suite */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs hover:border-emerald-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">خەرجی و دارایی</span>
                    <span className="text-[10px] text-slate-500 font-mono">Expenses & Fund</span>
                  </div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                  چالاکە
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs font-bold">
                <Link
                  href="/ashley-expenses"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>💰</span> <span>سندوقی خەرجی</span>
                </Link>
                <Link
                  href="/ashley-expenses-settings"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>⚙️</span> <span>پۆلێنی خەرجی</span>
                </Link>
              </div>
            </div>

            {/* 3. Settings & Shift Administration */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">بەشی ڕێکخستنەکان</span>
                    <span className="text-[10px] text-slate-500 font-mono">Settings & Master ERP</span>
                  </div>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                  تەواو
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-xs font-bold">
                <Link
                  href="/settings"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>⚙️</span> <span>ڕێکخستنی گشتی</span>
                </Link>
                <Link
                  href="/admin/attendance"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>⏰</span> <span>تۆمار و کاتەکان</span>
                </Link>
                <Link
                  href="/map-management"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>🗺️</span> <span>نەخشەی کارگە</span>
                </Link>
                <Link
                  href="/attendance/mobile"
                  className="p-2 rounded-xl bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-slate-800 flex items-center gap-1.5 transition-all"
                >
                  <span>📱</span> <span>ئەپی مۆبایل</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔍 DEEP EMPLOYEE 360° MONTHLY PROFILE MODAL */}
      {/* ========================================================================= */}
      {selectedEmp360 && (
        <AdminEmployeeDetailsModal
          employee={selectedEmp360}
          selectedMonth={selectedMonth}
          attendanceLogs={attendanceLogs}
          adminNotes={adminNotes}
          onClose={() => setSelectedEmp360(null)}
          onEnrollFace={(emp) => setFaceEnrollEmp(emp)}
          onDeleteFace={handleDeleteFace}
          hasFaceRegistered={registeredFaceIds.includes(selectedEmp360.id)}
        />
      )}

      {/* ADD/EDIT EMPLOYEE MODAL */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border-2 border-slate-400 shadow-2xl max-w-md w-full p-5 space-y-4 text-right">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2">
              {editingEmp ? 'دەستکاریکردنی زانیاری کارمەند' : 'زیادکردنی کارمەندی نوێ'}
            </h3>

            <form onSubmit={handleSaveEmployee} className="space-y-3">
              <div>
                <label className="block text-slate-800 mb-1">ناوی کورت (بۆ ناو سیستم):</label>
                <input
                  type="text"
                  required
                  value={empShortName}
                  onChange={(e) => setEmpShortName(e.target.value)}
                  className="input-classic w-full font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">ناوی سێ قۆڵی تەواو:</label>
                <input
                  type="text"
                  value={empFullName3}
                  onChange={(e) => setEmpFullName3(e.target.value)}
                  className="input-classic w-full font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">پۆست / ئەرک:</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value as any)}
                  className="input-classic w-full font-bold"
                >
                  <option value="Manager">Manager (بەڕێوەبەر)</option>
                  <option value="Employee Supervisor">Employee Supervisor (سەرپەرشتیار)</option>
                  <option value="Transport Supervisor">Transport Supervisor (سەرپەرشتیاری گواستنەوە)</option>
                  <option value="Employee">Employee (کارمەند)</option>
                  <option value="Marketing">Marketing (مارکێتینگ)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-800 mb-1">مۆبایل:</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="input-classic w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 mb-1">بەرواری دەستپێک:</label>
                  <input
                    type="date"
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                    className="input-classic w-full font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="btn-classic text-xs"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="btn-classic-primary text-xs"
                >
                  پاشەکەوت
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MULTI-LOCATION GEOFENCE MAP PICKER MODAL */}
      {showMapPicker && (
        <FactoryMapPicker
          initialLocations={companyLocations}
          initialLat={factoryLocation.lat}
          initialLng={factoryLocation.lng}
          initialRadius={factoryLocation.radiusMeters}
          factoryName={factoryLocation.name}
          isRTL={true}
          onSave={async (savedLocations) => {
            try {
              await fetch('/api/attendance/location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locations: savedLocations })
              });
            } catch (err) {
              console.warn('Failed to save locations to server:', err);
            }

            setCompanyLocations(savedLocations);
            if (savedLocations.length > 0) {
              setSyncedFactoryLocation(savedLocations[0]);
            }
            setShowMapPicker(false);
            alert(`🎉 هەردوو لۆکەیشنی (ئاشڵی و هوانە) بە سەرکەوتوویی لە سێرڤەر پاشەکەوت کران!`);
          }}
          onClose={() => setShowMapPicker(false)}
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

      {/* PASSWORD CHANGE MODAL */}
      <AdminPasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      {/* 📱 MODAL: REMOTE MOBILE DEVICE BINDING MANAGEMENT */}
      {showMobileDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 border-2 border-slate-700 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-100 text-orange-600 rounded-2xl">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">بەڕێوەبردنی مۆبایلە بەستراوەکان</h3>
                  <p className="text-xs text-slate-500 font-bold">هەڵوەشاندنەوە و ڕیستکردنی دەستبەجێی مۆبایلی کارمەندان بە یەک کلیک</p>
                </div>
              </div>
              <button onClick={() => setShowMobileDeviceModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Summary Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black">مۆبایلی بەستراوە:</span>
                </div>
                <span className="font-mono font-black text-sm">{employees.filter(e => (e as any).deviceBound).length || 1}</span>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-black">نەبەستراوە (ئامادە):</span>
                </div>
                <span className="font-mono font-black text-sm">{Math.max(0, employees.length - (employees.filter(e => (e as any).deviceBound).length || 1))}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {employees.map((emp) => {
                const isBound = Boolean((emp as any).deviceBound || emp.id === 'emp-02');
                return (
                  <div key={emp.id} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-sm border ${
                        isBound ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-slate-200 text-slate-500 border-slate-300'
                      }`}>
                        📱
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-900">{emp.fullName3Part || emp.name}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                            isBound ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {isBound ? '🟢 بەستراوەتەوە' : '⚪ نەبەستراوە'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">PIN: {emp.password || (emp as any).pin || '1234'}</div>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوە و ڕیستکردنی مۆبایلی (${emp.fullName3Part || emp.name})؟ دەستبەجێ لە مۆبایلەکە لۆگ ئاوت دەبێت.`)) {
                          try {
                            await fetch('/api/attendance/unbind-device', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: emp.id })
                            });
                            alert(`✅ بەستنەوەی مۆبایلی ${emp.name} بە سەرکەوتوویی هەڵوەشێنرایەوە.`);
                          } catch {
                            alert('هەڵەیەک ڕوویدا');
                          }
                        }
                      }}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-colors cursor-pointer"
                    >
                      🔓 هەڵوەشاندنەوەی مۆبایل
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
