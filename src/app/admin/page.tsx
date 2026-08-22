'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
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
  Table
} from 'lucide-react';
import { AdminPasswordChangeModal } from '@/components/admin/AdminPasswordChangeModal';
import { AdminOvertimeModule } from '@/components/admin/AdminOvertimeModule';
import { AdminExpensesModule } from '@/components/admin/AdminExpensesModule';
import { AdminLogisticsModule } from '@/components/admin/AdminLogisticsModule';
import { AdminWeeklyMonthlyStatsModule } from '@/components/admin/AdminWeeklyMonthlyStatsModule';
import { AdminDailyAttendanceTable } from '@/components/admin/AdminDailyAttendanceTable';
import { 
  generateAugust2026AdminNotes, 
  generateAugust2026AttendanceRecords,
  GOOGLE_SHEET_OVERTIME_DATA 
} from '@/lib/attendance-seed-data';
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
  const [adminActiveSection, setAdminActiveSection] = useState<'overview' | 'attendance' | 'hr' | 'overtime' | 'expenses' | 'logistics' | 'stats' | 'maps'>('attendance');
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
        const stored = localStorage.getItem(`ashley_admin_notes_${selectedMonth}`);
        if (stored) {
          setAdminNotesLocal(JSON.parse(stored));
          return;
        }
      } catch {}
    }
    setAdminNotesLocal(generateAugust2026AdminNotes(employees));
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

  // Merge live attendance logs with August 2026 seed records so check-in / check-out are always fully populated
  const allMergedAttendanceLogs = useMemo(() => {
    const seedRecords = generateAugust2026AttendanceRecords(employees);
    const existingKeys = new Set(attendanceLogs.map(l => {
      const d = l.date || (l.time ? l.time.split(' ')[0] : '');
      const e = (l.employeeId || l.userId || '').toString().toLowerCase();
      const t = (l.type || (l as any).action || '').toLowerCase();
      return `${e}_${d}_${t.includes('in') ? 'in' : 'out'}`;
    }));

    const nonOverlappingSeed = seedRecords.filter(s => {
      const d = s.date || '';
      const e = (s.employeeId || '').toString().toLowerCase();
      const t = (s.type || '').toLowerCase();
      return !existingKeys.has(`${e}_${d}_${t.includes('in') ? 'in' : 'out'}`);
    });

    return [...attendanceLogs, ...nonOverlappingSeed];
  }, [attendanceLogs, employees]);

  // Aggregated KPIs for Overview Dashboard
  const dashboardKpis = useMemo(() => {
    const totalStaff = employees.length;
    const activeStaff = activeEmployees.length;
    const resignedStaff = employees.filter(e => e.status === 'resigned' || e.isActive === false).length;

    // August 2026 Overtime Hours & Payout from live data
    let totalOtHours = 0;
    let totalOtCost = 0;
    let otEmployeesSet = new Set<string>();

    GOOGLE_SHEET_OVERTIME_DATA.forEach(ot => {
      totalOtHours += ot.hours;
      totalOtCost += ot.amount || (ot.hours * 5000);
      otEmployeesSet.add(ot.empName);
    });

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
          <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-500/50 shadow-inner">
            <Shield className="w-7 h-7 text-indigo-300" />
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          
          {/* 📅 Hub 1: Attendance Central (Primary Default) */}
          <button
            onClick={() => setAdminActiveSection('attendance')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'attendance'
                ? 'bg-emerald-900 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/40'
                : 'bg-slate-50 hover:bg-emerald-50/60 text-slate-800 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'attendance'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-100 text-emerald-900'
            }`}>
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">ئامادەبوون و دەوام</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'attendance' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-emerald-100 text-emerald-900'
            }`}>
              📅 ڕۆژانە و ۳۱ ڕۆژە
            </span>
          </button>

          {/* 🔘 Hub 0: Overview Dashboard */}
          <button
            onClick={() => setAdminActiveSection('overview')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'overview'
                ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-indigo-400/40'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-800'
            }`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">داشبۆردی گشتی</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'overview' ? 'bg-indigo-300 text-slate-950 font-black' : 'bg-slate-200 text-slate-700'
            }`}>
              Executive 360°
            </span>
          </button>

          {/* 🔵 Hub 2: HR & Staff */}
          <button
            onClick={() => setAdminActiveSection('hr')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'hr'
                ? 'bg-blue-900 text-white border-blue-700 shadow-md ring-2 ring-blue-400/40'
                : 'bg-slate-50 hover:bg-blue-50/60 text-slate-800 border-slate-200 hover:border-blue-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'hr'
                ? 'bg-blue-700 text-white'
                : 'bg-blue-100 text-blue-900'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">کارمەندان و ستاف</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'hr' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-blue-100 text-blue-900'
            }`}>
              👥 {dashboardKpis.activeStaff} کارمەند
            </span>
          </button>

          {/* 🟠 Hub 3: Overtime Master */}
          <button
            onClick={() => setAdminActiveSection('overtime')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'overtime'
                ? 'bg-amber-900 text-white border-amber-700 shadow-md ring-2 ring-orange-400/40'
                : 'bg-slate-50 hover:bg-amber-50/60 text-slate-800 border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'overtime'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-100 text-amber-900'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">کاتی زیادە (ئیزافە)</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'overtime' ? 'bg-amber-300 text-slate-950 font-black' : 'bg-amber-100 text-amber-900'
            }`}>
              ⚡ +{dashboardKpis.totalOtHours} کاتژمێر
            </span>
          </button>

          {/* 🟢 Hub 4: Expenses */}
          <button
            onClick={() => setAdminActiveSection('expenses')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'expenses'
                ? 'bg-teal-900 text-white border-teal-700 shadow-md ring-2 ring-teal-400/40'
                : 'bg-slate-50 hover:bg-teal-50/60 text-slate-800 border-slate-200 hover:border-teal-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'expenses'
                ? 'bg-teal-700 text-white'
                : 'bg-teal-100 text-teal-900'
            }`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">خەرجی و دارایی</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'expenses' ? 'bg-emerald-300 text-slate-950 font-black' : 'bg-teal-100 text-teal-900'
            }`}>
              💰 سندوق
            </span>
          </button>

          {/* 🔴 Hub 5: Logistics & Unloading */}
          <button
            onClick={() => setAdminActiveSection('logistics')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'logistics'
                ? 'bg-rose-900 text-white border-rose-700 shadow-md ring-2 ring-rose-400/40'
                : 'bg-slate-50 hover:bg-rose-50/60 text-slate-800 border-slate-200 hover:border-rose-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'logistics'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-100 text-rose-900'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">بارداگرتن و نقڵ</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'logistics' ? 'bg-rose-300 text-slate-950 font-black' : 'bg-rose-100 text-rose-900'
            }`}>
              🚛 لۆجستیک
            </span>
          </button>

          {/* 🟣 Hub 6: HR Analytics & Stats */}
          <button
            onClick={() => setAdminActiveSection('stats')}
            className={`group relative p-2.5 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              adminActiveSection === 'stats'
                ? 'bg-purple-900 text-white border-purple-700 shadow-md ring-2 ring-purple-400/40'
                : 'bg-slate-50 hover:bg-purple-50/60 text-slate-800 border-slate-200 hover:border-purple-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105 ${
              adminActiveSection === 'stats'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-100 text-purple-900'
            }`}>
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-tight block">ئامار و ڕاپۆرتەکان</span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md mt-1 ${
              adminActiveSection === 'stats' ? 'bg-purple-300 text-slate-950 font-black' : 'bg-purple-100 text-purple-900'
            }`}>
              📊 مانگانە
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
                    // Compute employee's overtime in Sheet data
                    const empOts = GOOGLE_SHEET_OVERTIME_DATA.filter(ot => {
                      const clean = ot.empName.trim();
                      const eName = (emp.fullName3Part || emp.name).trim();
                      return clean === eName || eName.includes(clean) || clean.includes(emp.name);
                    });
                    const totalOtHours = empOts.reduce((sum, o) => sum + o.hours, 0);
                    const totalOtAmount = empOts.reduce((sum, o) => sum + (o.amount || o.hours * 5000), 0);

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

          {/* Sub-Tab 1: Daily Attendance Table */}
          {attendanceSubTab === 'daily' && (
            <AdminDailyAttendanceTable
              employees={employees}
              attendanceLogs={allMergedAttendanceLogs}
              adminNotes={adminNotes}
              onUpdateAdminNote={handleUpdateAdminNote}
              selectedMonth={selectedMonth}
            />
          )}

          {/* Sub-Tab 2: 31-Day Matrix Grid */}
          {attendanceSubTab === 'matrix' && (
            <div id="attendance-sheet-grid-section" className="space-y-2">
              <AttendanceSheetGrid employees={activeEmployees} attendanceLogs={allMergedAttendanceLogs} />
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
      {/* 💰 SECTION 3: EXPENSES MODULE */}
      {/* ========================================================================= */}
      {adminActiveSection === 'expenses' && (
        <AdminExpensesModule employees={employees} />
      )}

      {/* ========================================================================= */}
      {/* 🚛 SECTION 4: LOGISTICS MODULE */}
      {/* ========================================================================= */}
      {adminActiveSection === 'logistics' && (
        <AdminLogisticsModule employees={employees} />
      )}

      {/* ========================================================================= */}
      {/* 📊 SECTION 5: HR STATS & ANALYTICS REPORT */}
      {/* ========================================================================= */}
      {adminActiveSection === 'stats' && (
        <AdminWeeklyMonthlyStatsModule employees={employees} attendanceLogs={attendanceLogs} />
      )}

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
            setCompanyLocations(savedLocations);
            if (savedLocations.length > 0) {
              setSyncedFactoryLocation(savedLocations[0]);
            }
            setShowMapPicker(false);
            alert(`🎉 ${savedLocations.length} لۆکەیشنی کۆمپانیا بە سەرکەوتوویی پاشەکەوت کران!`);
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

    </div>
  );
}
