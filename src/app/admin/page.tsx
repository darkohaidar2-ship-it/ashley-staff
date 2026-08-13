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

  // Factory Location Config
  const factoryLocation = settings.factoryLocation || {
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
    <div className="space-y-8 bg-slate-100 min-h-screen p-4 md:p-8" dir="rtl">
      
      {/* WINDOWS 11 GLASSMORPHISM TOP NAVBAR HEADER */}
      <header className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-md">
            🏰
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              پەنەری بەڕێوەبەری سەرەکی ASHLEY Do27 ERP
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-1">
              ئەدمینی دەسەڵاتدار: <span className="text-slate-900 font-extrabold">{user?.username || 'Darko'}</span> | لۆگینی ڕێگەپێدراو
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowMapPicker(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer border border-amber-600 transition-all"
          >
            📍 دیاریکردنی شوێنی کۆمپانیا (Base Geofence)
          </button>

          <button
            onClick={exportStateAsJson}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer border border-emerald-900 transition-all"
          >
            💾 دابەزاندنی باکئەپ (Backup JSON)
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer border border-blue-900 transition-all"
          >
            📤 هێنانەوەی باکئەپ (Restore JSON)
          </button>

          <button
            onClick={async () => {
              if (confirm('ئایا دڵنیایت لە دەرچوون لە ئەکاونتی ئەدمین؟')) {
                await logout();
                router.replace('/login');
              }
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-sm cursor-pointer border border-rose-800 transition-all"
          >
            🔒 دەرچوون (Logout)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleRestoreJson}
            className="hidden"
          />
        </div>
      </header>

      {/* QUICK SYSTEM STATS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-300 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-bold text-slate-500">کۆی کارمەندان</span>
          <p className="text-xl font-black text-slate-900 mt-1">{employees.length}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-slate-300 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-bold text-slate-500">کارمەندانی چالاک</span>
          <p className="text-xl font-black text-emerald-800 mt-1">
            {employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-slate-300 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-bold text-slate-500">واژۆکراو لە ئەرشیفدا</span>
          <p className="text-xl font-black text-rose-800 mt-1">
            {employees.filter((e) => e.status === 'resigned' || e.isActive === false).length}
          </p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-slate-300 p-4 rounded-xl shadow-sm text-center">
          <span className="text-xs font-bold text-slate-500">شوێنی دیاریکراو (Geofence)</span>
          <p className="text-xs font-black text-amber-800 mt-2 truncate">
            {factoryLocation.radiusMeters}m سنوور
          </p>
        </div>
      </div>

      {/* SECTION 1: EMPLOYEE ROSTER & RESIGNATION MANAGEMENT */}
      <section className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              👥 بەڕێوەبردنی کارمەندەکان و وازهێنان (Employee Roster & Resignation Management)
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              تۆماری ناوی سیانی، مۆبایل، بەشی وازهێنان (شارستنەوە لە ئامادەبوون بەبێ سڕینەوە لە ئەرشیف)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEmpModal()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
            >
              ➕ زیادکردنی کارمەندی نوێ
            </button>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-300">
          <button
            onClick={() => setEmpStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              empStatusFilter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✅ کارمەندانی چالاک ({employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length})
          </button>
          <button
            onClick={() => setEmpStatusFilter('resigned')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              empStatusFilter === 'resigned' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📁 وازهێنراوەکان (ئەرشیف) ({employees.filter((e) => e.status === 'resigned' || e.isActive === false).length})
          </button>
          <button
            onClick={() => setEmpStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              empStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تێکڕا ({employees.length})
          </button>
        </div>

        {/* Employees Table */}
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-inner">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
              <tr>
                <th className="p-3">کۆد</th>
                <th className="p-3">ناوی سیانی کارمەند</th>
                <th className="p-3">ژمارەی مۆبایل</th>
                <th className="p-3">پلە / ئەرک</th>
                <th className="p-3">کەی دەست بەکار بووە</th>
                <th className="p-3">کەی وازی هێناوە</th>
                <th className="p-3">بارودۆخ</th>
                <th className="p-3 text-left">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-bold bg-white">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const isResigned = emp.status === 'resigned' || emp.isActive === false;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono">{emp.employeeId || '00'}</td>
                      <td className="p-3 text-slate-900 font-extrabold">
                        {emp.fullName3Part || emp.name}
                      </td>
                      <td className="p-3 font-mono dir-ltr text-right">{emp.phone || '---'}</td>
                      <td className="p-3">{emp.role || 'Employee'}</td>
                      <td className="p-3 font-mono">{emp.startDate || emp.employmentStartDate || '---'}</td>
                      <td className="p-3 font-mono text-rose-700">{emp.resignedDate || '---'}</td>
                      <td className="p-3">
                        {isResigned ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded text-[11px] border border-rose-300 font-bold">
                            وازهێنراو (لە ئەرشیف)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded text-[11px] border border-emerald-300 font-bold">
                            چالاک
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-left space-x-2 space-x-reverse">
                        <button
                          onClick={() => handleOpenEmpModal(emp)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] cursor-pointer"
                        >
                          دەستکاریکردن
                        </button>

                        <button
                          onClick={() => handleToggleResignation(emp)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer border ${
                            isResigned
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          }`}
                        >
                          {isResigned ? '🔄 گەڕانەوە بۆ کار' : '📁 وازهێنان (ئەرشیف)'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    هیچ کارمەندێک نەدۆزرایەوە
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ALL 26 ERP SYSTEM SUB-MODULE CARDS ORGANIZED IN 5 MASTER ZONES */}

      {/* ZONE 1: INVENTORY & PLACEMENT MANAGEMENT */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
          <h2 className="text-base font-black text-slate-900">
            📦 ۱. بەڕێوەبردنی کۆگا و جەرد (Inventory & Placement Management)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/new-file" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">📝</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">بەشی A: فایلی دەستی نوێ</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">تێکردنی دەستی مۆدێل، بڕ و تێبینی بە ٣ ستوون</p>
          </Link>

          <Link href="/import" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">📊</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">بەشی B: هاوردەکردنی ئێکسڵ</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">هاوردەکردنی ئۆتۆماتیکی ئێکسڵ بە ٩ ستوونەکە</p>
          </Link>

          <Link href="/archive" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">📂</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">بەشی C: ئەرشیفی ئێکسڵ</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">ئەرشیف و قفڵکردنی فایلە جەردکراوەکان</p>
          </Link>

          <Link href="/locations" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">🏢</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">بەشی D: لیستی شوێنەکان</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">شوێنەکانی Ashley Store و Huana Store</p>
          </Link>

          <Link href="/items" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">🔍</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">گەڕانی خێرای کاڵاکان</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">گەڕانی گشتی بۆ مۆدێلەکان و نەخشەی کۆگا</p>
          </Link>

          <Link href="/sold-items" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">🏷️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">کاڵا فرۆشراوەکان</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">تۆماری مۆدێلە فرۆشراوەکان بە خشتە</p>
          </Link>

          <Link href="/huana-map" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">🗺️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">نەخشەی کۆگای هوئانا</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دیاریکردنی شوێنی ڕەفەکانی هوئانا</p>
          </Link>

          <Link href="/ashley-map" className="bg-white p-5 border border-slate-300 hover:border-emerald-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-xl font-bold">🗺️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-emerald-900">نەخشەی کۆگای ئاشڵی</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دیاریکردنی نهۆم و ڕەفەکانی ئاشڵی</p>
          </Link>
        </div>
      </section>

      {/* ZONE 2: TRANSMIT & FREIGHT ARCHIVES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-purple-600 pr-3">
          <h2 className="text-base font-black text-slate-900">
            🚚 ۲. بەشی گواستنەوە و باری شارەکان (Transmit & Freight Archives)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/public-transmit" className="bg-white p-5 border border-slate-300 hover:border-purple-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-purple-50 text-purple-800 rounded-xl flex items-center justify-center text-xl font-bold">🚛</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-purple-900">تۆمارکردنی باری نوێ</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">تێکردنی باری هەولێر، بەغداد و دهۆک</p>
          </Link>

          <Link href="/pdf-archive" className="bg-white p-5 border border-slate-300 hover:border-purple-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-purple-50 text-purple-800 rounded-xl flex items-center justify-center text-xl font-bold">📄</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-purple-900">ئەرشیفی PDF جەرد</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">پاراستنی بەڵگەنامە و وێنەی بارەکان</p>
          </Link>

          <Link href="/report-designer" className="bg-white p-5 border border-slate-300 hover:border-purple-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-purple-50 text-purple-800 rounded-xl flex items-center justify-center text-xl font-bold">📑</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-purple-900">دروستکەری ڕاپۆرت</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دیزاینکردنی ڕاپۆرتی باری شارەکان</p>
          </Link>
        </div>
      </section>

      {/* ZONE 3: ATTENDANCE & QR TERMINALS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-blue-600 pr-3">
          <h2 className="text-base font-black text-slate-900">
            📋 ۳. بەڕێوەبردنی ئامادەبوون و سکیوریتی (Attendance Audits & QR)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/attendance" className="bg-white p-5 border border-slate-300 hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-blue-50 text-blue-800 rounded-xl flex items-center justify-center text-xl font-bold">📋</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">تۆماری ئامادەبوونی ڕۆژانە</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">بینینی مێژووی هاتن، چوون و لۆکەیشن</p>
          </Link>

          <Link href="/attendance/qr" className="bg-white p-5 border border-slate-300 hover:border-blue-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-blue-50 text-blue-800 rounded-xl flex items-center justify-center text-xl font-bold">📷</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">پەنەری سکانی QR بۆ دەوام</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دروستکردنی بارکۆدی خولاوەی ئامادەبوون</p>
          </Link>
        </div>

        {/* ATTENDANCE RECORDS MANAGEMENT & DELETE TABLE */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                📊 خشتەی گشتی ئامادەبوونی کارمەندان (Attendance Log Audit & Delete)
              </h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                سەرجەم تۆمارەکانی ئامادەبوونی ڕۆژانە لێرە پاشەکەوت دەبن و ئەدمین دەتوانێت فۆتۆ، دووری و کات ببینێت و سڕینەوە بکان
              </p>
            </div>
            {attendanceLogs && attendanceLogs.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('ئایا دڵنیایت لە سڕینەوەی تێکڕای داتاکانی ئامادەبوون؟')) {
                    setAttendanceLogs([]);
                  }
                }}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg text-xs border border-rose-300 cursor-pointer"
              >
                🗑️ پاککردنەوەی تێکڕای لیست
              </button>
            )}
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                <tr>
                  <th className="p-3">ناوی کارمەند</th>
                  <th className="p-3">جۆری تۆمار</th>
                  <th className="p-3">کاتی تۆمارکردن</th>
                  <th className="p-3">دووری لە کۆپمانیا (مەتر)</th>
                  <th className="p-3">فۆتۆی سێلفی</th>
                  <th className="p-3 text-left">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold bg-white">
                {attendanceLogs && attendanceLogs.length > 0 ? (
                  attendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-900 font-extrabold">{log.name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] border font-bold ${
                          log.type.includes('Check-In') || log.type.includes('هاتن')
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{log.time}</td>
                      <td className="p-3 font-mono">{log.distance || '---'}</td>
                      <td className="p-3">
                        {log.selfieUrl ? (
                          <img src={log.selfieUrl} alt="Selfie" className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-sm" />
                        ) : (
                          <span className="text-slate-400">بەبێ فۆتۆ</span>
                        )}
                      </td>
                      <td className="p-3 text-left">
                        <button
                          onClick={() => {
                            if (confirm(`ئایا دڵنیایت لە سڕینەوەی ئەم تۆمارەی ${log.name}؟`)) {
                              setAttendanceLogs(attendanceLogs.filter((item) => item.id !== log.id));
                            }
                          }}
                          className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[11px] font-bold border border-rose-300 cursor-pointer"
                        >
                          🗑️ سڕینەوە
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                      هیچ تۆمارێکی ئامادەبوون تۆمار نەکراوە
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ZONE 4: FINANCE, HR & OVERTIME */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-rose-600 pr-3">
          <h2 className="text-base font-black text-slate-900">
            💰 ٤. بەشی دارایی، HR، خەرجیییەکان و سەعاتی زیاده (Finance & HR)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/ashley-expenses" className="bg-white p-5 border border-slate-300 hover:border-rose-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center text-xl font-bold">💳</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-rose-900">خەرجیییەکان و ڕاپۆرتی مانگانە</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">ڕاپۆرتی ئۆتۆماتیکی و قفڵکردنی خەرجی</p>
          </Link>

          <Link href="/overtime" className="bg-white p-5 border border-slate-300 hover:border-rose-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center text-xl font-bold">🕒</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-rose-900">سەعاتی زیاده (5,000 IQD)</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">ئەژماری کاتژمێر × ٥,٠٠٠ IQD و ئەرشیف</p>
          </Link>

          <Link href="/inputs" className="bg-white p-5 border border-slate-300 hover:border-rose-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center text-xl font-bold">✍️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-rose-900">پیشینەی مووچە و بارداگرتن</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">داغڵکردن و تۆماری پیشینەی مووچە</p>
          </Link>

          <Link href="/ashley-expenses-settings" className="bg-white p-5 border border-slate-300 hover:border-rose-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center text-xl font-bold">⚙️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-rose-900">ڕێکخستنی خەرجیییەکان</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دیاریکردنی بڕی خەرجییە جێگیرەکان</p>
          </Link>
        </div>
      </section>

      {/* ZONE 5: SYSTEM SECURITY & SETTINGS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-r-4 border-slate-700 pr-3">
          <h2 className="text-base font-black text-slate-900">
            ⚙️ ٥. بەشی بەڕێوەبەرایەتی، ئاسایش و داتا (Security & System Settings)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/warehouse-map" className="bg-white p-5 border border-slate-300 hover:border-slate-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center text-xl font-bold">🗺️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-slate-900">نەخشەی گشتی کۆگا</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">ڕێکخستن و نەخشەی تێکڕای شوێنەکان</p>
          </Link>

          <Link href="/account" className="bg-white p-5 border border-slate-300 hover:border-slate-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center text-xl font-bold">🔑</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-slate-900">ئەکاونت و تێپەڕەوشە</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دەستکاریکردنی وشەی نهێنی و ناوی ئادمی</p>
          </Link>

          <Link href="/settings" className="bg-white p-5 border border-slate-300 hover:border-slate-500 rounded-2xl shadow-sm hover:shadow-md transition-all group space-y-2">
            <div className="w-10 h-10 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center text-xl font-bold">🛠️</div>
            <h3 className="text-xs font-black text-slate-900 group-hover:text-slate-900">بەڕێوەبردنی دەسەڵاتەکان</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">دەسەڵاتی بەکارهێنەران و ڕۆڵەکان</p>
          </Link>
        </div>
      </section>

      {/* EMPLOYEE ADD/EDIT MODAL */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white border border-slate-300 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-3">
              {editingEmp ? `دەستکاریکردنی کارمەند: ${editingEmp.name}` : '➕ زیادکردنی کارمەندی نوێ'}
            </h3>

            <form onSubmit={handleSaveEmployee} className="space-y-3.5 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">ناوی سیانی کارمەند:</label>
                <input
                  type="text"
                  required
                  value={empFullName3}
                  onChange={(e) => setEmpFullName3(e.target.value)}
                  placeholder="ناوی دەربڕاو بە سیانی..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">ناوی کورت (بۆ لیستەکان):</label>
                <input
                  type="text"
                  required
                  value={empShortName}
                  onChange={(e) => setEmpShortName(e.target.value)}
                  placeholder="ناوی کورت..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">ژمارەی مۆبایل:</label>
                <input
                  type="text"
                  value={empPhone}
                  onChange={(e) => setEmpPhone(e.target.value)}
                  placeholder="0770..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">پلە / ئەرک:</label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none"
                >
                  <option value="Manager">Manager (بەڕێوەبەر)</option>
                  <option value="Employee Supervisor">Employee Supervisor (سەرپەرشتیار)</option>
                  <option value="Transport Supervisor">Transport Supervisor (سەرپەرشتیاری گواستنەوە)</option>
                  <option value="Employee">Employee (کارمەند)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1">کەی دەست بەکار بووە:</label>
                  <input
                    type="date"
                    value={empStartDate}
                    onChange={(e) => setEmpStartDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1">کەی وازی هێناوە:</label>
                  <input
                    type="date"
                    value={empResignDate}
                    onChange={(e) => setEmpResignDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
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
