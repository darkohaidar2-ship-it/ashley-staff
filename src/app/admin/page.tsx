'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';
import { format } from 'date-fns';
import { 
  Users, 
  Package, 
  Truck, 
  Settings, 
  Plus, 
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
  Shield,
  Layers,
  FileText
} from 'lucide-react';

function AdminMasterHubPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    employees,
    setEmployees,
    attendanceLogs,
    setAttendanceLogs,
    settings,
    setSettings,
    exportStateAsJson,
  } = useAppContext();

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

  // Restore JSON File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Factory Location Config
  const factoryLocation = settings?.factoryLocation || {
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 500,
  };

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

  // Resignation Toggle (وازهێنان / گەڕانەوە بۆ کار)
  const handleToggleResignation = (emp: Employee) => {
    const isCurrentlyResigned = emp.status === 'resigned' || emp.isActive === false;
    const msg = isCurrentlyResigned
      ? `ئایا دڵنیایت لە گەڕانەوەی کارمەند (${emp.name}) بۆ ناو لیستی چالاکی دەوام؟`
      : `ئایا دڵنیایت لە تۆمارکردنی وازهێنانی کارمەند (${emp.name})؟ (ناوی لە ئامادەبوونی ڕۆژانە ناپێورێت، بەڵام لە ئەرشیفدا پارێزراو دەبێت)`;

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
        alert(`فۆنتی (${file.name}) بە سەرکەوتوویی بارکرا و خستراگەگەڕ!`);
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
        alert('تێکڕای داتاکان بە سەرکەوتوویی هێنرانەوە (Restore)!');
      } catch {
        alert('فایلی باکئەپ هەڵەیە یان تێکچووە!');
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
    <div className="space-y-8 bg-slate-950 min-h-screen p-4 md:p-8 text-white font-sans dir-rtl" dir="rtl">
      
      {/* 👑 MASTER GLASSMORPHISM TOP HEADER */}
      <header className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                پەنەری بەڕێوەبەری سەرەکی ASHLEY ERP
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black">
                2026 Bento Hub
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-1">
              بەڕێوەبەری سەرەکی: <span className="text-indigo-300 font-extrabold">{user?.username || 'Darko'}</span> | ٤ بەشی سەرەکی بێسنور
            </p>
          </div>
        </div>

        {/* Global Quick Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowMapPicker(true)}
            className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold rounded-xl text-xs border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <MapPin className="w-4 h-4" />
            <span>دیاریکردنی شوێنی کۆمپانیا (Base Geofence)</span>
          </button>

          <button
            onClick={exportStateAsJson}
            className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold rounded-xl text-xs border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>دابەزاندنی باکئەپ (Backup JSON)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-bold rounded-xl text-xs border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>هێنانەوەی باکئەپ (Restore JSON)</span>
          </button>

          <button
            onClick={async () => {
              if (confirm('ئایا دڵنیایت لە دەرچوون لە ئەکاونتی ئەدمین؟')) {
                await logout();
                router.replace('/login');
              }
            }}
            className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold rounded-xl text-xs border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>دەرچوون (Logout)</span>
          </button>

          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreJson} className="hidden" />
        </div>
      </header>

      {/* QUICK SYSTEM STATS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl text-center">
          <span className="text-xs font-bold text-slate-400">کۆی کارمەندان</span>
          <p className="text-2xl font-black text-white mt-1">{employees.length}</p>
        </div>
        <div className="bg-slate-900/60 border border-emerald-900/40 p-4 rounded-2xl text-center">
          <span className="text-xs font-bold text-emerald-400">کارمەندانی چالاک</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-rose-900/40 p-4 rounded-2xl text-center">
          <span className="text-xs font-bold text-rose-400">واژۆکراو لە ئەرشیفدا</span>
          <p className="text-2xl font-black text-rose-400 mt-1">
            {employees.filter((e) => e.status === 'resigned' || e.isActive === false).length}
          </p>
        </div>
        <div className="bg-slate-900/60 border border-amber-900/40 p-4 rounded-2xl text-center">
          <span className="text-xs font-bold text-amber-400">سنووری Geofence</span>
          <p className="text-xs font-black text-amber-300 mt-2 truncate">
            {factoryLocation.radiusMeters}m دیاریکراو
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 👥 SECTION 1: HR & EMPLOYEE MANAGEMENT BENTO ZONE */}
      {/* ========================================================================= */}
      <section className="bg-slate-900/40 border-2 border-blue-600/40 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                بەشی یەکەم: بەشی کارمەندان HR (Human Resources & Staff Operations)
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                ناوی کارمەندان، وازهێنان، ئامادەبوونی ڕۆژانە، کاتی زیاده‌، مەسروفات، مۆڵەت، مووچە، و کۆدی PIN
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenEmpModal()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs shadow-lg shadow-blue-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>زیادکردنی کارمەندی نوێ</span>
          </button>
        </div>

        {/* BENTO GRID LAYOUT FOR SECTION 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Bento Card 1 (Large - 2 Cols): Employee Roster & Resignations */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-400" />
                <span>لیستی گشتی کارمەندەکان و وازهێنان (Roster & Resignations)</span>
              </h3>
              
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setEmpStatusFilter('active')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    empStatusFilter === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  چالاک ({employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length})
                </button>
                <button
                  onClick={() => setEmpStatusFilter('resigned')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    empStatusFilter === 'resigned' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  وازهێناو ({employees.filter((e) => e.status === 'resigned' || e.isActive === false).length})
                </button>
                <button
                  onClick={() => setEmpStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    empStatusFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  تێکڕا ({employees.length})
                </button>
              </div>
            </div>

            {/* Employee Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3">کۆد / PIN</th>
                    <th className="p-3">ناوی سیانی کارمەند</th>
                    <th className="p-3">ژمارەی مۆبایل</th>
                    <th className="p-3">ئەرک</th>
                    <th className="p-3">دەستبەکاربوون</th>
                    <th className="p-3">وازهێنان</th>
                    <th className="p-3">بارودۆخ</th>
                    <th className="p-3 text-left">کردار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-bold bg-slate-900/60">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => {
                      const isResigned = emp.status === 'resigned' || emp.isActive === false;
                      return (
                        <tr key={emp.id} className="hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-indigo-300">{emp.password || '1234'}</td>
                          <td className="p-3 text-white font-black">{emp.fullName3Part || emp.name}</td>
                          <td className="p-3 font-mono dir-ltr text-right text-slate-300">{emp.phone || '---'}</td>
                          <td className="p-3 text-slate-300">{emp.role || 'Employee'}</td>
                          <td className="p-3 font-mono text-slate-400">{emp.startDate || emp.employmentStartDate || '---'}</td>
                          <td className="p-3 font-mono text-rose-400">{emp.resignedDate || '---'}</td>
                          <td className="p-3">
                            {isResigned ? (
                              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[11px]">
                                وازهێنراو
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[11px]">
                                چالاک
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-left space-x-1 space-x-reverse">
                            <button
                              onClick={() => handleOpenEmpModal(emp)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
                            >
                              دەستکاری
                            </button>
                            <button
                              onClick={() => handleToggleResignation(emp)}
                              className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer border ${
                                isResigned
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {isResigned ? '🔄 گەڕانەوە' : '📁 وازهێنان'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 font-bold">
                        هیچ کارمەندێک نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bento Card 2 (Small - 1 Col): Quick HR Sub-Modules */}
          <div className="space-y-4">
            <Link href="/attendance/qr" className="block bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl space-y-2 group transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">PIN & QR Terminal</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-blue-400">کۆدی ئامادەبوون و بارکۆدی QR</h4>
              <p className="text-[11px] text-slate-400">دروستکردنی بارکۆدی QR خولاوە و کۆدی PINی کارمەندان</p>
            </Link>

            <Link href="/overtime" className="block bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl space-y-2 group transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">Overtime 5,000 IQD</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-blue-400">کاتی زیاده (Overtime Hours)</h4>
              <p className="text-[11px] text-slate-400">ئەژماری سەعاتی زیاده × ٥,٠٠٠ IQD و مووچە</p>
            </Link>

            <Link href="/ashley-expenses" className="block bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 p-4 rounded-2xl space-y-2 group transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">HR Expenses</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-blue-400">مەسروفات و بەخشینەکان</h4>
              <p className="text-[11px] text-slate-400">تۆمارکردنی خەرجی کارمەندان و ڕاپۆرتی مانگانە</p>
            </Link>
          </div>
        </div>

        {/* Bento Card 3 (Full Width): Attendance Photo Verification Audit Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>ئامادەبوونی ڕۆژانە و فۆتۆ سێلفی (Daily Attendance Audit & Photo Log)</span>
            </h3>
            {attendanceLogs && attendanceLogs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('ئایا دڵنیایت لە سڕینەوەی تێکڕای داتاکانی ئامادەبوون؟')) {
                    setAttendanceLogs([]);
                  }
                }}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold rounded-xl text-xs border border-rose-500/30 cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>پاککردنەوەی تێکڕا</span>
              </button>
            )}
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                <tr>
                  <th className="p-3">ناوی کارمەند</th>
                  <th className="p-3">جۆری تۆمار</th>
                  <th className="p-3">کاتی تۆمارکردن</th>
                  <th className="p-3">دووری لە کۆپمانیا (مەتر)</th>
                  <th className="p-3">فۆتۆی سێلفی</th>
                  <th className="p-3 text-left">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-bold bg-slate-900/60">
                {attendanceLogs && attendanceLogs.length > 0 ? (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/50">
                      <td className="p-3 text-white font-extrabold">{log.name}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] border font-bold ${
                          log.type.includes('Check-In') || log.type.includes('هاتن')
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{log.time}</td>
                      <td className="p-3 font-mono text-amber-300">{log.distance || '---'}</td>
                      <td className="p-3">
                        {log.selfieUrl ? (
                          <img src={log.selfieUrl} alt="Selfie" className="w-9 h-9 rounded-full object-cover border border-slate-700 shadow-sm" />
                        ) : (
                          <span className="text-slate-500">بەبێ فۆتۆ</span>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <button
                          onClick={() => {
                            if (confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی ${log.name}؟`)) {
                              setAttendanceLogs(attendanceLogs.filter((item) => item.id !== log.id));
                            }
                          }}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-[11px] border border-rose-500/30 cursor-pointer"
                        >
                          سڕینەوە
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 font-bold">
                      هیچ تۆمارێکی ئامادەبوون تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 📦 SECTION 2: INVENTORY & WAREHOUSE BENTO ZONE */}
      {/* ========================================================================= */}
      <section className="bg-slate-900/40 border-2 border-emerald-600/40 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              بەشی دووەم: بەشی کۆگا و عەمبار (Inventory, Items & Warehouse Hub)
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              ئایتمەکان، شوێنەکانی ڕەفە، نەخشەی کۆگای ئاشڵی و هوئانا، جەرد، و ئەرشیف
            </p>
          </div>
        </div>

        {/* Bento Grid Layout for Section 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/items" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">کاتالۆگ و گەڕانی ئایتمەکان</h3>
            <p className="text-[11px] text-slate-400">گەڕانی گشتی بۆ مۆدێلەکان و بڕی عەمبار</p>
          </Link>

          <Link href="/locations" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">شوێنەکانی کۆگا (Locations)</h3>
            <p className="text-[11px] text-slate-400">ڕەفە و شوێنەکانی Ashley Store و Huana Store</p>
          </Link>

          <Link href="/import" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">هاوردەکردنی ئێکسڵ (Import)</h3>
            <p className="text-[11px] text-slate-400">هاوردەکردنی فایلی جەردی ئێکسڵ بە ٩ ستوونەکە</p>
          </Link>

          <Link href="/archive" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">ئەرشیفی فایلی کۆگا</h3>
            <p className="text-[11px] text-slate-400">ئەرشیف و قفڵکردنی فایلی جەردکراوەکان</p>
          </Link>

          <Link href="/ashley-map" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Map className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">نەخشەی کۆگای ئاشڵی</h3>
            <p className="text-[11px] text-slate-400">دیاریکردنی نهۆم و ڕەفەکانی ئاشڵی</p>
          </Link>

          <Link href="/huana-map" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Map className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">نەخشەی کۆگای هوئانا</h3>
            <p className="text-[11px] text-slate-400">دیاریکردنی شوێنی ڕەفەکانی هوئانا</p>
          </Link>

          <Link href="/public-inventory" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">جەردی ڕاستەوخۆ (Stock Audit)</h3>
            <p className="text-[11px] text-slate-400">تۆمارکردن و بینینی جەردی عەمبار لە ڕاستەوخۆدا</p>
          </Link>

          <Link href="/sold-items" className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-emerald-400">کاڵا فرۆشراوەکان</h3>
            <p className="text-[11px] text-slate-400">خشتەی مۆدێلە فرۆشراوەکان و ڕەوانەکردن</p>
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🚚 SECTION 3: LOGISTICS & TRANSMIT BENTO ZONE */}
      {/* ========================================================================= */}
      <section className="bg-slate-900/40 border-2 border-amber-600/40 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              بەشی سێیەم: بەشی گواستنەوە و لۆجیستیک (Logistics, Transmit & Freight)
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              تۆماری باری هەولێر، بەغداد، دهۆک، ئەرشیفی PDF و نەخشەی ڕێڕەوی گەیاندن
            </p>
          </div>
        </div>

        {/* Bento Grid Layout for Section 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/public-transmit" className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-amber-400">تۆمارکردنی باری نوێ (Transmit)</h3>
            <p className="text-[11px] text-slate-400">تێکردنی باری هەولێر، بەغداد و دهۆک بە تێبینی</p>
          </Link>

          <Link href="/pdf-archive" className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-amber-400">ئەرشیفی PDFی بارەکان</h3>
            <p className="text-[11px] text-slate-400">پاراستنی بەڵگەنامە و وێنەی ڕاگواستنەکانی گەیاندن</p>
          </Link>

          <Link href="/report-designer" className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl space-y-2 group transition-all">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-black text-white group-hover:text-amber-400">دروستکەری ڕاپۆرتی گواستنەوە</h3>
            <p className="text-[11px] text-slate-400">دیزاینکردنی فۆرمی تایبەتی ڕاپۆرتی باری شارەکان</p>
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ⚙️ SECTION 4: SETTINGS, ADMIN PANEL & UI FONT CUSTOMIZATION BENTO ZONE */}
      {/* ========================================================================= */}
      <section className="bg-slate-900/40 border-2 border-purple-600/40 rounded-3xl p-6 space-y-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-purple-500/20 pb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              بەشی چوارەم: سێتینگ، ئەدمین پانێڵ و گۆڕینی فۆنت (Settings, Admin & UI Font Control)
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              دەستکاریکردنی سیستەم، فۆنتی UI لەگەڵ ئەپلۆدی فۆنت، شوێنی کۆمپانیا، دەسەڵاتەکان و باکئەپ
            </p>
          </div>
        </div>

        {/* Bento Grid Layout for Section 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Bento Card 1 (Large - 2 Cols): UI Font Customization & Font Upload */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Type className="w-5 h-5 text-purple-400" />
                <span>گۆڕینی فۆنتی UI ی بەرنامەکە و ئاپلۆدکردنی فۆنت (UI Font Customization)</span>
              </h3>
              <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2.5 py-0.5 rounded border border-purple-500/20">
                Live Font Engine 2026
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Preset Font Family Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  هەڵبژاردنی فۆنتی ئامادەکراو (Preset Font):
                </label>
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
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Inter">Inter (فۆنتی بنەڕەتی ERP)</option>
                  <option value="Vazirmatn">Vazirmatn (فۆنتی مۆدێرنی کوردی/عەرەبی)</option>
                  <option value="Cairo">Cairo (فۆنتی قاهیرەی نایاب)</option>
                  <option value="Noto Kufi Arabic">Noto Kufi Arabic (فۆنتی کوفی نەرم)</option>
                  <option value="Outfit">Outfit (فۆنتی جیهانی مۆدێرن)</option>
                  <option value="Roboto">Roboto (فۆنتی ستاندارد)</option>
                  <option value="Tahoma">Tahoma (فۆنتی کلاسیک)</option>
                  <option value="Arial">Arial (فۆنتی سادە)</option>
                </select>
              </div>

              {/* Custom Font File Uploader */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  ئاپلۆدکردنی فۆنتی تایبەتی خۆت (.ttf / .woff / .woff2):
                </label>
                <button
                  type="button"
                  onClick={() => fontInputRef.current?.click()}
                  className="w-full p-3 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
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

            {/* Font Live Preview Box */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                تایبەتمەندی و تاقیکردنەوەی فۆنت لە ڕاستەوخۆدا (Live Font Preview):
              </span>
              <p className="text-sm font-bold text-purple-300 leading-relaxed">
                بەخێربێن بۆ سیستەمی بەڕێوەبردنی سەرەکی ئاشڵی Ashley ERP 2026. ئەمە ڕستەی تاقیکاری فۆنتەکەیە!
              </p>
              <p className="text-xs font-mono text-slate-400">
                Current Font: <span className="text-white font-bold">{settings?.customFont ? 'Custom Uploaded Font' : (settings?.fontFamily || 'Inter')}</span>
              </p>
            </div>
          </div>

          {/* Bento Card 2 (Small - 1 Col): Admin System Tools */}
          <div className="space-y-4">
            <button
              onClick={() => setShowMapPicker(true)}
              className="w-full text-right bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 p-4 rounded-2xl space-y-2 group transition-all cursor-pointer block"
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">Base Geofence</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-purple-400">شوێنی کۆمپانیا لەسەر نەخشە</h4>
              <p className="text-[11px] text-slate-400">دیاریکردنی سنوری مەترەکانی ئامادەبوونی دەوام</p>
            </button>

            <Link href="/account" className="block bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 p-4 rounded-2xl space-y-2 group transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">Super Admin Account</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-purple-400">ئەکاونت و تێپەڕەوشەی ئەدمین</h4>
              <p className="text-[11px] text-slate-400">دەستکاریکردنی وشەی نهێنی و ناوی بەرێوەبەر</p>
            </Link>

            <Link href="/settings" className="block bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 p-4 rounded-2xl space-y-2 group transition-all">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">System Permissions</span>
              </div>
              <h4 className="text-xs font-black text-white group-hover:text-purple-400">بەڕێوەبردنی دەسەڵاتەکان</h4>
              <p className="text-[11px] text-slate-400">دەسەڵاتی بەکارهێنەران و ڕۆڵەکانی سیستەم</p>
            </Link>
          </div>

        </div>
      </section>

      {/* EMPLOYEE ADD/EDIT MODAL */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white">
            <h3 className="text-base font-black text-white border-b border-slate-800 pb-3">
              {editingEmp ? `دەستکاریکردنی کارمەند: ${editingEmp.name}` : '➕ زیادکردنی کارمەندی نوێ'}
            </h3>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">ناوی سیانی کارمەند:</label>
                <input
                  type="text"
                  required
                  value={empFullName3}
                  onChange={(e) => setEmpFullName3(e.target.value)}
                  placeholder="ناوی دەربڕاو بە سیانی..."
                  className="w-full p-3 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">ناوی کورت (بۆ لیستەکان):</label>
                <input
                  type="text"
                  required
                  value={empShortName}
                  onChange={(e) => setEmpShortName(e.target.value)}
                  placeholder="ناوی کورت..."
                  className="w-full p-3 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">ژمارەی مۆبایل:</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  placeholder="0770..."
                  className="w-full p-3 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">پلە / ئەرک:</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="w-full p-3 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none"
                >
                  <option value="Manager">Manager (بەڕێوەبەر)</option>
                  <option value="Employee Supervisor">Employee Supervisor (سەرپەرشتیار)</option>
                  <option value="Transport Supervisor">Transport Supervisor (سەرپەرشتیاری گواستنەوە)</option>
                  <option value="Employee">Employee (کارمەند)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">کەی دەست بەکار بووە:</label>
                  <input
                    type="date"
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">کەی وازی هێناوە:</label>
                  <input
                    type="date"
                    value={empResignDate}
                    onChange={(e) => setEmpResignDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none font-mono text-rose-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl cursor-pointer"
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
          onSave={(newLoc) => {
            if (setSettings) {
              setSettings({
                ...settings,
                factoryLocation: newLoc,
              });
            }
            setShowMapPicker(false);
            alert('شوێنی کۆمپانیا لەسەر نەخشە بە سەرکەوتوویی پاشەکەوت کرا!');
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

    </div>
  );
}

export default withAuth(AdminMasterHubPage);
