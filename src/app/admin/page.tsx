'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';
import { AttendanceSheetGrid } from '@/components/attendance/AttendanceSheetGrid';
import { AdminFaceEnrollModal } from '@/components/attendance/AdminFaceEnrollModal';
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
  Receipt, 
  Calendar, 
  DollarSign, 
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
  RefreshCw
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  // Security Auth Guard: Redirect unauthenticated users immediately to /login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('ashley_admin_session') || localStorage.getItem('ashley_admin_session');
      if (!stored && !user && !authLoading) {
        router.replace('/login');
      } else {
        setAuthChecked(true);
      }
    }
  }, [user, authLoading, router]);

  const {
    employees,
    setEmployees,
    items,
    settings,
    setSettings,
    attendanceLogs,
    setAttendanceLogs,
    exportStateAsJson,
  } = useAppContext();

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

  // Employee Roster Management Modal & State
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [empFullName3, setEmpFullName3] = useState('');
  const [empShortName, setEmpShortName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState<any>('Employee');
  const [empStartDate, setEmpStartDate] = useState('');
  const [empResignDate, setEmpResignDate] = useState('');
  const [empRehireDate, setEmpRehireDate] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'all' | 'active' | 'resigned'>('active');

  // Factory Geofence Map Picker Modal State
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Admin Face Enrollment Modal State & Registered Face IDs
  const [faceEnrollEmp, setFaceEnrollEmp] = useState<Employee | null>(null);
  const [registeredFaceIds, setRegisteredFaceIds] = useState<string[]>([]);

  // Fetch list of employees who have already enrolled their faces
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

  // Restore JSON File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Factory Location Config (Synced with Supabase)
  const [syncedFactoryLocation, setSyncedFactoryLocation] = useState<{
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
        const loc = await res.json();
        if (loc?.lat && loc?.lng) {
          setSyncedFactoryLocation(loc);
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

  // Open Employee Modal (Add / Edit)
  const handleOpenEmpModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setEmpFullName3(emp.fullName3Part || emp.name || '');
      setEmpShortName(emp.name || '');
      setEmpPhone(emp.phone || '');
      setEmpRole(emp.role || 'Employee');
      setEmpStartDate(emp.startDate || emp.employmentStartDate || '');
      setEmpResignDate(emp.resignedDate || '');
      setEmpRehireDate(emp.rehiredDate || '');
    } else {
      setEditingEmp(null);
      setEmpFullName3('');
      setEmpShortName('');
      setEmpPhone('');
      setEmpRole('Employee');
      setEmpStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEmpResignDate('');
      setEmpRehireDate('');
    }
    setShowEmpModal(true);
  };

  // Save Employee (Add or Update)
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empShortName.trim()) {
      alert('تکایە ناوی کارمەند بنووسە');
      return;
    }

    if (editingEmp) {
      const updated = employees.map((emp) =>
        emp.id === editingEmp.id
          ? {
              ...emp,
              name: empShortName.trim(),
              fullName3Part: empFullName3.trim(),
              phone: empPhone.trim(),
              role: empRole,
              startDate: empStartDate,
              resignedDate: empResignDate,
              rehiredDate: empRehireDate,
            }
          : emp
      );
      setEmployees(updated);
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

  // Resignation Toggle
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
      setEmployees(updated);
    }
  };

  // Delete Employee
  const handleDeleteEmployee = (empId: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کارمەندە؟')) {
      setEmployees(employees.filter((e) => e.id !== empId));
    }
  };

  // Delete Attendance Log
  const handleDeleteAttendanceLog = async (logId: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم لۆگە؟')) {
      setAttendanceLogs(attendanceLogs.filter((l) => l.id !== logId));
      try {
        await fetch(`/api/attendance/logs/${logId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Error deleting attendance log:', err);
      }
    }
  };

  // Upload Custom UI Font File (.ttf, .woff, .woff2)
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Font = event.target?.result as string;
      if (setSettings && settings) {
        setSettings({
          ...settings,
          customFont: base64Font,
          fontFamily: file.name.replace(/\.[^/.]+$/, ""),
        });
        alert(`فۆنتی (${file.name}) بە سەرکەوتوویی بارکرا!`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload & Restore JSON Data
  const handleRestoreJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.employees) setEmployees(data.employees);
        if (data.settings && setSettings) setSettings(data.settings);
        alert('تێکڕای داتاکان بە سەرکەوتوویی هێنرانەوە!');
      } catch {
        alert('فایلی باکئەپ هەڵەیە!');
      }
    };
    reader.readAsText(file);
  };

  // Filter Active vs Resigned Employees
  const filteredEmployees = employees.filter((emp) => {
    if (empStatusFilter === 'active') return emp.status !== 'resigned' && emp.isActive !== false;
    if (empStatusFilter === 'resigned') return emp.status === 'resigned' || emp.isActive === false;
    return true;
  });

  return (
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-12 p-2 sm:p-4" dir="rtl">
      
      {/* 🌟 CLASSIC ENTERPRISE DESKTOP TOP TITLE BAR & ACTION TOOLBAR */}
      <div className="panel-classic p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span>🛡️ پەنەری بەڕێوەبەری سەرەکی ASHLEY ERP — Admin Master Hub</span>
          </h1>
          <p className="text-[11px] text-slate-600 font-bold mt-0.5">
            بەڕێوەبەری سەرەکی: <span className="text-blue-900 font-mono font-black">{user?.username || 'Darko'}</span> | هەموو بەشەکانی HR، کۆگا، گواستنەوە و سێتینگی فۆنت
          </p>
        </div>

        {/* TOP RIGHT TOOLS WITH EXPLICIT LOGOUT BUTTON */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <div className="statusbar-segment text-blue-900 font-bold bg-slate-100 hidden sm:block">
            ⏰ {currentTimeStr || '2026-08-13 | 15:50'}
          </div>

          <button onClick={() => setShowMapPicker(true)} className="btn-classic">
            <MapPin className="w-3.5 h-3.5 text-amber-700" />
            <span>نەخشە (Map)</span>
          </button>
          
          <button onClick={exportStateAsJson} className="btn-classic">
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>باکئەپ (JSON)</span>
          </button>

          <button onClick={() => fileInputRef.current?.click()} className="btn-classic">
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>هێنانەوە</span>
          </button>

          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreJson} className="hidden" />

          {/* EXPLICIT LOGOUT BUTTON */}
          <button
            onClick={async () => {
              if (confirm('ئایا دڵنیایت لە دەرچوون لە ئەکاونتی ئەدمین؟')) {
                await logout();
                router.replace('/login');
              }
            }}
            className="btn-classic-danger py-1 px-2.5 text-xs font-black flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-white" />
            <span>🚪 دەرچوون (Logout)</span>
          </button>
        </div>
      </div>

      {/* QUICK SYSTEM STATS BANNER (KPI CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="panel-classic p-2 text-center">
          <span className="text-[10px] font-bold text-slate-600 block">کۆی کارمەندان</span>
          <p className="text-lg font-black text-slate-900 font-mono mt-0.5">{employees.length}</p>
        </div>
        <div className="panel-classic p-2 text-center">
          <span className="text-[10px] font-bold text-emerald-800 block">کارمەندانی چالاک</span>
          <p className="text-lg font-black text-emerald-800 font-mono mt-0.5">
            {employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length}
          </p>
        </div>
        <div className="panel-classic p-2 text-center">
          <span className="text-[10px] font-bold text-rose-800 block">وازهێناو لە ئەرشیف</span>
          <p className="text-lg font-black text-rose-800 font-mono mt-0.5">
            {employees.filter((e) => e.status === 'resigned' || e.isActive === false).length}
          </p>
        </div>
        <div className="panel-classic p-2 text-center">
          <span className="text-[10px] font-bold text-amber-800 block">سنووری Geofence</span>
          <p className="text-xs font-black text-amber-900 font-mono mt-1">
            {factoryLocation.radiusMeters}m
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 👥 SECTION 1: HR & STAFF OPERATIONS CLASSIC PANEL */}
      {/* ========================================================================= */}
      <section className="panel-classic space-y-3">
        <div className="panel-header-classic flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-800" />
            <span>بەشی یەکەم: بەشی کارمەندان HR (Staff Operations & Attendance Logs)</span>
          </h2>
          <span className="text-[10px] font-mono bg-blue-900 text-white px-1.5 py-0.2">HR MODULE</span>
        </div>

        <div className="p-3.5 space-y-4">
          
          {/* Quick WinUI 3 Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/80 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEmpModal()}
                className="btn-fluent-primary text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>➕ زیادکردنی کارمەندی نوێ</span>
              </button>

              <button
                onClick={() => setEmpStatusFilter(empStatusFilter === 'active' ? 'resigned' : 'active')}
                className="btn-fluent text-xs"
              >
                <span>{empStatusFilter === 'resigned' ? 'نیشاندانی کارمەندە چالاکەکان' : '📜 ئەرشیفی وازهێناوەکان'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <Link href="/overtime" className="btn-fluent text-[11px]">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>سەعاتی زیاده (Overtime)</span>
              </Link>

              <Link href="/ashley-expenses" className="btn-fluent text-[11px]">
                <Receipt className="w-3.5 h-3.5 text-rose-600" />
                <span>مەسروفاتی HR</span>
              </Link>
            </div>
          </div>

          {/* Employee Roster Data Grid */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🔑 خشتەی ناوی کارمەندان و کۆدەکانی PIN (Employee Roster Grid):</span>
                <span className="text-[10px] font-mono text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                  PIN ACCESS ENABLED
                </span>
              </h3>

              <div className="flex items-center gap-1.5 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-950"
                  title="پرێنتکردنی ناوی کارمەندان"
                >
                  🖨️ پرێنت (Print)
                </button>

                <button
                  onClick={async () => {
                    const tableContainer = document.getElementById('admin-employee-table-wrapper');
                    const printDate = format(new Date(), 'yyyy-MM-dd');
                    const printTime = format(new Date(), 'HH:mm:ss');
                    const filename = `Ashley_Employees_Roster_${printDate}.pdf`;

                    if (!tableContainer) {
                      window.print();
                      return;
                    }

                    try {
                      const html2canvas = (await import('html2canvas')).default;
                      const jsPDF = (await import('jspdf')).default;

                      const canvas = await html2canvas(tableContainer, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                      });

                      const imgData = canvas.toDataURL('image/jpeg', 0.95);
                      const pdf = new jsPDF('portrait', 'mm', 'a4');
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight = pdf.internal.pageSize.getHeight();

                      pdf.setFontSize(10);
                      pdf.setTextColor(15, 23, 42);
                      pdf.text(`ASHLEY ERP - List: Employee Roster & PIN Codes`, 10, 8);
                      pdf.text(`Print Date: ${printDate} | Print Time: ${printTime}`, pdfWidth - 90, 8);

                      const imgWidth = pdfWidth - 20;
                      const imgHeight = (canvas.height * imgWidth) / canvas.width;

                      pdf.addImage(imgData, 'JPEG', 10, 12, imgWidth, Math.min(imgHeight, pdfHeight - 20));
                      pdf.save(filename);
                    } catch (err) {
                      console.error('PDF export fallback:', err);
                      window.print();
                    }
                  }}
                  className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-rose-700 hover:bg-rose-800 border border-red-700 text-white"
                  title="داگرتنی ڕاستەوخۆی فایلی PDF"
                >
                  📄 داگرتنی PDF
                </button>

                <button
                  onClick={() => {
                    const printDate = format(new Date(), 'yyyy-MM-dd');
                    const printTime = format(new Date(), 'HH:mm:ss');
                    let csvContent = `\uFEFFناوی لیست: خشتەی ناوی کارمەندان و کۆدەکان, بەرواری پرێنت: ${printDate}, کاتی پرێنت: ${printTime}\n\n`;
                    csvContent += 'کۆدی PIN,کۆدی ID,ناوی کارمەند,پلە/ئەرک,ژمارەی مۆبایل,دەست بەکاربوون,دۆخ\n';
                    filteredEmployees.forEach(emp => {
                      csvContent += `"${emp.password || '1234'}","EMP-${emp.employeeId || emp.id}","${emp.fullName3Part || emp.name}","${emp.role || 'Employee'}","${emp.phone || '---'}","${emp.startDate || '---'}","${emp.status || 'Active'}"\n`;
                    });
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `Ashley_Employees_${printDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="btn-classic-primary text-[11px] font-bold py-0.5 px-2 bg-blue-900 hover:bg-blue-950 border border-blue-950 text-white"
                  title="داگرتنی فایلی Excel/CSV"
                >
                  📊 داگرتنی CSV
                </button>
              </div>
            </div>

            <div id="admin-employee-table-wrapper" className="overflow-x-auto border border-slate-400 bg-white">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th>کۆدی PIN (پاسۆرد)</th>
                    <th>کۆدی ID</th>
                    <th>ناوی سیانی کارمەند</th>
                    <th>پلە / ئەرک</th>
                    <th>ژمارەی مۆبایل</th>
                    <th>دەست بەکاربوون</th>
                    <th>وازهێنان</th>
                    <th>دۆخی دەوام</th>
                    <th>کردارەکان</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className={emp.status === 'resigned' ? 'bg-rose-50' : ''}>
                        {/* PIN Code Highlighted Badge */}
                        <td className="font-mono font-black text-xs text-blue-950 bg-amber-100/90 text-center border border-amber-400 px-2 py-1 shadow-sm">
                          🔑 {emp.password || '1234'}
                        </td>
                        <td className="font-mono text-[11px] text-slate-600 font-bold">
                          {emp.employeeId ? `EMP-${emp.employeeId}` : `EMP-${emp.id.slice(-3)}`}
                        </td>
                        <td className="font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{emp.fullName3Part || emp.name}</span>
                            {registeredFaceIds.includes(emp.id) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-950 border border-emerald-400 shadow-xs">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>ڕوخسار ناسێنراوە ✅</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs px-1" title="ڕوخسار تۆمار نەکراوە">
                                👤
                              </span>
                            )}
                          </div>
                          {emp.name && emp.fullName3Part && emp.name !== emp.fullName3Part && (
                            <span className="text-[10px] text-slate-500 font-normal block">({emp.name})</span>
                          )}
                        </td>
                        <td className="font-mono text-[11px] text-indigo-900 font-bold">{emp.role || 'Employee'}</td>
                        <td className="font-mono text-[11px] text-slate-800 dir-ltr text-right">{emp.phone || '---'}</td>
                        <td className="font-mono text-[10px] text-slate-600">{emp.startDate || emp.employmentStartDate || '---'}</td>
                        <td className="font-mono text-[10px] text-rose-700">{emp.resignedDate || '---'}</td>
                        <td>
                          {emp.status === 'resigned' || emp.isActive === false ? (
                            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 font-bold border border-rose-400 text-[10px]">وازهێناو</span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 font-bold border border-emerald-400 text-[10px]">چالاک</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setFaceEnrollEmp(emp)}
                              className={`btn-classic text-[10px] font-bold border ${
                                registeredFaceIds.includes(emp.id)
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-400'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                              }`}
                              title="تۆمارکردن یان نوێکردنەوەی ڕوخساری ئەم کارمەندە بە کامێرا"
                            >
                              <Camera className={`w-3 h-3 ${registeredFaceIds.includes(emp.id) ? 'text-emerald-700' : 'text-indigo-600'}`} />
                              <span>{registeredFaceIds.includes(emp.id) ? '✅ نوێکردنەوەی ڕوخسار' : '📸 ناساندنی ڕوخسار'}</span>
                            </button>
                            <button
                              onClick={() => handleOpenEmpModal(emp)}
                              className="btn-classic text-[10px]"
                              title="دەستکاریکردنی زانیاریەکان"
                            >
                              <Edit className="w-3 h-3 text-blue-700" />
                              <span>دەستکاری</span>
                            </button>
                            <button
                              onClick={() => handleToggleResignation(emp)}
                              className="btn-classic text-[10px]"
                              title="تۆمارکردنی وازهێنان یان گەڕانەوە"
                            >
                              <span>{emp.status === 'resigned' ? '🔄 گەڕانەوە' : '📁 وازهێنان'}</span>
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="btn-classic text-[10px] text-rose-800"
                              title="سڕینەوەی یەکجاری"
                            >
                              <Trash2 className="w-3 h-3 text-rose-700" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-slate-500 font-bold">
                        هیچ کارمەندێک نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total-row">
                    <td colSpan={3}>کۆی گشتی کارمەندان لە خشتەکەدا:</td>
                    <td colSpan={6} className="font-mono">{filteredEmployees.length} Employee(s) Registered</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 31-Day Attendance Sheet Component */}
          <div className="pt-3 border-t border-slate-300">
            <AttendanceSheetGrid
              attendanceLogs={attendanceLogs}
              employees={employees}
              onDeleteLog={handleDeleteAttendanceLog}
            />
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 📦 SECTION 2: INVENTORY & WAREHOUSE CLASSIC PANEL */}
      {/* ========================================================================= */}
      <section className="panel-classic space-y-3">
        <div className="panel-header-classic flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-800" />
            <span>بەشی دووەم: بەشی کۆگا و عەمبار (Inventory & Warehouse Management)</span>
          </h2>
          <span className="text-[10px] font-mono bg-emerald-800 text-white px-1.5 py-0.2">STOCK MODULE</span>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <Link href="/items" className="btn-classic py-3 flex-col text-center">
              <Package className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">کاتالۆگی ئایتمەکان</span>
            </Link>

            <Link href="/warehouse-map" className="btn-classic py-3 flex-col text-center">
              <Layers className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">نەخشەی ڕەفەی کۆگا</span>
            </Link>

            <Link href="/import" className="btn-classic py-3 flex-col text-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">هێنانی اکسل</span>
            </Link>

            <Link href="/archive" className="btn-classic py-3 flex-col text-center">
              <Archive className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">ئەرشیفی جەردەکان</span>
            </Link>

            <Link href="/public-inventory" className="btn-classic py-3 flex-col text-center">
              <Eye className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">جەردی ڕاستەوخۆ</span>
            </Link>

            <Link href="/sold-items" className="btn-classic py-3 flex-col text-center">
              <Layers className="w-5 h-5 text-emerald-800 mb-1" />
              <span className="font-bold">کاڵا فرۆشراوەکان</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🚚 SECTION 3: LOGISTICS & TRANSMIT CLASSIC PANEL */}
      {/* ========================================================================= */}
      <section className="panel-classic space-y-3">
        <div className="panel-header-classic flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-amber-800" />
            <span>بەشی سێیەم: بەشی گواستنەوە و لۆجیستیک (Logistics & Transmit)</span>
          </h2>
          <span className="text-[10px] font-mono bg-amber-800 text-white px-1.5 py-0.2">LOGISTICS</span>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Link href="/public-transmit" className="btn-classic py-3 flex-col text-center">
              <Truck className="w-5 h-5 text-amber-800 mb-1" />
              <span className="font-bold">تۆمارکردنی باری نوێ</span>
            </Link>

            <Link href="/pdf-archive" className="btn-classic py-3 flex-col text-center">
              <FileText className="w-5 h-5 text-amber-800 mb-1" />
              <span className="font-bold">ئەرشیفی PDFی بارەکان</span>
            </Link>

            <Link href="/report-designer" className="btn-classic py-3 flex-col text-center">
              <FileSpreadsheet className="w-5 h-5 text-amber-800 mb-1" />
              <span className="font-bold">دروستکەری ڕاپۆرت</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ⚙️ SECTION 4: SETTINGS & UI FONT CUSTOMIZATION CLASSIC PANEL */}
      {/* ========================================================================= */}
      <section className="panel-classic space-y-3">
        <div className="panel-header-classic flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Settings className="w-4 h-4 text-purple-800" />
            <span>بەشی چوارەم: سێتینگ، ئەدمین پانێڵ و گۆڕینی فۆنت (Settings & Font Customization)</span>
          </h2>
          <span className="text-[10px] font-mono bg-purple-800 text-white px-1.5 py-0.2 font-bold">LIVE FONT ENGINE</span>
        </div>

        <div className="p-3 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Live UI Font Engine Panel */}
            <div className="lg:col-span-2 p-3 bg-slate-50 border border-slate-300 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-purple-800" />
                  <span>گۆڕینی فۆنتی UI ی بەرنامەکە و ئاپلۆدکردنی فۆنت</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold">
                <div>
                  <label className="block text-slate-700 mb-1">فۆنتی ئامادەکراو (Preset Font):</label>
                  <select
                    value={settings?.fontFamily || 'Inter'}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      if (setSettings && settings) {
                        setSettings({
                          ...settings,
                          fontFamily: newFont,
                          customFont: null,
                        });
                      }
                    }}
                    className="input-classic w-full font-bold"
                  >
                    <option value="Noto Kufi Arabic">Noto Kufi Arabic (کووفی نایاب)</option>
                    <option value="Vazirmatn">Vazirmatn (وەزیر مۆدێرن)</option>
                    <option value="Cairo">Cairo (قاهیرە)</option>
                    <option value="Inter">Inter (ERP Standard)</option>
                    <option value="Tahoma">Tahoma (کلاسیک)</option>
                    <option value="Arial">Arial (سادە)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">ئاپلۆدکردنی فۆنت (.ttf / .woff / .woff2):</label>
                  <button
                    type="button"
                    onClick={() => fontInputRef.current?.click()}
                    className="btn-classic w-full text-purple-900 font-bold"
                  >
                    <Upload className="w-3.5 h-3.5 text-purple-700" />
                    <span>{settings?.customFont ? 'فۆنتی تایبەت بارکراوە (گۆڕین)' : 'بارکردنی فۆنت لە کۆمپیوتەر'}</span>
                  </button>
                  <input
                    ref={fontInputRef}
                    type="file"
                    accept=".ttf,.woff,.woff2"
                    onChange={handleFontUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-white border border-slate-300 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  تاقیکردنەوەی فۆنت (Font Preview Box):
                </span>
                <p className="text-xs font-bold text-purple-950">
                  بەخێربێن بۆ سیستەمی بەڕێوەبردنی سەرەکی ئاشڵی ASHLEY ERP 2026. ئەمە ڕستەی تاقیکاری فۆنتەکەیە!
                </p>
              </div>
            </div>

            {/* Admin System Options */}
            <div className="space-y-2">
              <button
                onClick={() => setShowMapPicker(true)}
                className="btn-classic w-full justify-between py-2 text-[11px]"
              >
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-700" />
                  <span>شوێنی کۆمپانیا لەسەر نەخشە</span>
                </div>
                <span className="font-mono text-[9px] bg-slate-300 px-1 border border-slate-400">GEOFENCE</span>
              </button>

              <Link href="/account" className="btn-classic w-full justify-between py-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                  <span>ئەکاونتی ئەدمین</span>
                </div>
                <span className="font-mono text-[9px] bg-slate-300 px-1 border border-slate-400">SUPERADMIN</span>
              </Link>

              <Link href="/settings" className="btn-classic w-full justify-between py-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-purple-700" />
                  <span>دەسەڵاتەکان</span>
                </div>
                <span className="font-mono text-[9px] bg-slate-300 px-1 border border-slate-400">ROLES</span>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* EMPLOYEE ADD/EDIT MODAL (CLASSIC WIN32 DIALOG WINDOW) */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 max-w-md w-full shadow-2xl p-1 text-slate-900">
            
            <div className="bg-blue-900 text-white px-2 py-1 text-xs font-bold flex justify-between items-center border-b border-blue-950">
              <span>{editingEmp ? `دەستکاریکردنی کارمەند: ${editingEmp.name}` : '➕ زیادکردنی کارمەندی نوێ'}</span>
              <button
                type="button"
                onClick={() => setShowEmpModal(false)}
                className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-4 space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-800 mb-1">ناوی سیانی کارمەند:</label>
                <input
                  type="text"
                  required
                  value={empFullName3}
                  onChange={(e) => setEmpFullName3(e.target.value)}
                  placeholder="ناوی سیانی..."
                  className="input-classic w-full"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">ناوی کورت:</label>
                <input
                  type="text"
                  required
                  value={empShortName}
                  onChange={(e) => setEmpShortName(e.target.value)}
                  placeholder="ناوی کورت..."
                  className="input-classic w-full"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">ژمارەی مۆبایل:</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  placeholder="0770..."
                  className="input-classic w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-800 mb-1">پلە / ئەرک:</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="input-classic w-full font-bold"
                >
                  <option value="Manager">Manager (بەڕێوەبەر)</option>
                  <option value="Employee Supervisor">Employee Supervisor (سەرپەرشتیار)</option>
                  <option value="Transport Supervisor">Transport Supervisor (سەرپەرشتیاری گواستنەوە)</option>
                  <option value="Employee">Employee (کارمەند)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-800 mb-1">کەی دەست بەکار بووە:</label>
                  <input
                    type="date"
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                    className="input-classic w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-800 mb-1">کەی وازی هێناوە:</label>
                  <input
                    type="date"
                    value={empResignDate}
                    onChange={(e) => setEmpResignDate(e.target.value)}
                    className="input-classic w-full font-mono text-rose-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-300">
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
                  پاشەکەوتکردنی کارمەند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FACTORY LOCATION GEOFENCE MAP PICKER MODAL */}
      {showMapPicker && (
        <FactoryMapPicker
          initialLat={factoryLocation.lat}
          initialLng={factoryLocation.lng}
          initialRadius={factoryLocation.radiusMeters}
          factoryName={factoryLocation.name}
          isRTL={true}
          onSave={async (newLoc) => {
            setSyncedFactoryLocation(newLoc);
            if (setSettings) {
              setSettings({
                ...settings,
                factoryLocation: newLoc,
              });
            }

            try {
              // Sync globally to Supabase backend across all mobile devices
              await fetch(`/api/attendance/location?_t=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
                body: JSON.stringify(newLoc),
              });
            } catch (err) {
              console.error('Failed to sync location to Supabase:', err);
            }

            setShowMapPicker(false);
            alert('🎉 شوێنی کۆمپانیا بە سەرکەوتوویی لەسەر سێرڤەری سەرەکی پاشەکەوت کرا و بۆ هەموو مۆبایل و کۆمپیوتەرێک نوێ بووەوە!');
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      {/* ADMIN EMPLOYEE AI FACE ENROLLMENT MODAL */}
      {faceEnrollEmp && (
        <AdminFaceEnrollModal
          employee={faceEnrollEmp}
          isOpen={!!faceEnrollEmp}
          onClose={() => setFaceEnrollEmp(null)}
          onSuccess={() => {
            fetchRegisteredFaces();
            alert(`🎉 ڕوخساری (${faceEnrollEmp.fullName3Part || faceEnrollEmp.name}) بە سەرکەوتوویی وەک ناسنامەی AI لە سێرڤەر تۆمارکرا!`);
          }}
        />
      )}

    </div>
  );
}
