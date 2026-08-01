'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';
import { format } from 'date-fns';

function AdminMasterHubPage() {
  const { user } = useAuth();
  const {
    employees,
    setEmployees,
    settings,
    setSettings,
    items,
    locations,
    expenses,
    overtime,
    withdrawals,
    exportStateAsJson,
  } = useAppContext();

  // Active Main Tab: 'dashboard' | 'employees' | 'placement' | 'transmit' | 'hr' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'placement' | 'transmit' | 'hr' | 'settings'>('dashboard');

  // --- Employee Roster Form State ---
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

  // --- Transmit Destination Filter ---
  const [transmitCityFilter, setTransmitCityFilter] = useState<'All' | 'Erbil' | 'Baghdad' | 'Dohuk'>('All');

  // --- Map Picker State ---
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Authoritative Factory Location
  const factoryLocation = settings.factoryLocation || {
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 500,
  };

  // Restore JSON File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open Employee Form Modal
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

  // Save Employee (Add/Edit)
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empShortName.trim()) {
      alert('تکایە ناوی کارمەند بنووسە');
      return;
    }

    if (editingEmp) {
      // Update
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
      // Add New
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

  // Toggle Resignation Status (وازهێنان / گەڕانەوە بۆ کار)
  const handleToggleResignation = (emp: Employee) => {
    const isCurrentlyResigned = emp.status === 'resigned';
    const actionText = isCurrentlyResigned
      ? `ئایا دڵنیایت لە گەڕانەوەی کارمەند (${emp.name}) بۆ ناو لیستی چالاکی کارمەندان؟`
      : `ئایا دڵنیایت لە تۆمارکردنی وازهێنانی کارمەند (${emp.name})؟ (ناوی لە لیستی گشتی ناپێورێت، بەڵام لە ئەرشیف پارێزراو دەبێت)`;

    if (confirm(actionText)) {
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

  // Restore Data JSON Upload
  const handleRestoreJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.employees) setEmployees(data.employees);
        if (data.settings && setSettings) setSettings(data.settings);
        alert('داتاکان بە سەرکەوتوویی هێنرانەوە لە فایلی باکئەپ!');
      } catch {
        alert('فایلی باکئەپ هەڵەیە یان تێکچووە!');
      }
    };
    reader.readAsText(file);
  };

  // Filter Employees List
  const filteredEmployees = employees.filter((emp) => {
    if (empStatusFilter === 'active') return emp.status !== 'resigned' && emp.isActive !== false;
    if (empStatusFilter === 'resigned') return emp.status === 'resigned' || emp.isActive === false;
    return true;
  });

  // Export current table to PDF/Printer
  const handlePrintPDF = (title: string) => {
    window.print();
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Windows 11 Glassmorphism Top Header */}
      <header className="bg-white/80 backdrop-blur-xl border border-slate-300 rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center text-2xl font-black shadow-sm">
            🏰
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide">
              پەنەری بەڕێوەبەری سەرەکی (Admin Control Panel)
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              ئەدمینی چالاک: <span className="text-slate-900 font-extrabold">{user?.username || 'Darko'}</span> | لۆگینی ڕێگەپێدراو
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
            }`}
          >
            📊 داشبۆردی سەرەکی
          </button>

          <button
            onClick={exportStateAsJson}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs border border-emerald-900 shadow-sm cursor-pointer"
          >
            💾 دابەزاندنی باکئەپ (Backup)
          </button>
        </div>
      </header>

      {/* WINDOWS 11 CENTERED GLASSMORPHISM MODULE TILES (DASHBOARD TAB) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <h2 className="text-lg font-black text-slate-900">
              بەشە سەرەکییەکانی بەڕێوەبردنی سیستەم
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              هەڵبژاردنی هەر کارتێک ڕاستەوخۆ دەتباتە ناو پەنەری تایبەتی ئەو بەشە
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            {/* 1. Employees Roster & HR */}
            <div
              onClick={() => setActiveTab('employees')}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-blue-200">
                👥
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-blue-900">
                بەڕێوەبردنی کارمەندەکان (Volunteers HR)
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                تۆماری کارمەندان، ناوی سیانی، مۆبایل، دەستبەکاربوون و وازهێنان (سڕینەوەی کاتی)
              </p>
            </div>

            {/* 2. Placement Management / Inventory */}
            <div
              onClick={() => setActiveTab('placement')}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-emerald-200">
                📦
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-900">
                بەڕێوەبردنی جەرد (Placement Inventory)
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                ٤ بەشەکە: فایلی دەستی، هاوردەکردنی ئێکسڵ، ئەرشیف و دیاریکردنی شوێنەکان
              </p>
            </div>

            {/* 3. Transmit / Internal Transfers */}
            <div
              onClick={() => setActiveTab('transmit')}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-purple-50 text-purple-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-purple-200">
                🚚
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-purple-900">
                بەڕێوەبردنی گواستنەوە (Transmit)
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                مێژووی باری شارەکان (تابی تایبەتی بەغداد، هەولێر، دهۆک)
              </p>
            </div>

            {/* 4. Company Location Geofence Map */}
            <div
              onClick={() => setShowMapPicker(true)}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-amber-200">
                🗺️
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-amber-900">
                دیاریکردنی بناغەی کۆمپانیا لەسەر نەخشە
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                دیاریکردنی شوێنی نەگۆڕی کۆمپانیا و سنووری ڕێگەپێدراو بۆ دەوام
              </p>
            </div>

            {/* 5. HR Expenses & Overtime */}
            <div
              onClick={() => setActiveTab('hr')}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-rose-200">
                💰
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-rose-900">
                خەرجییەکان، سەعاتی زیاده و پیشینە
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                ڕاپۆرتی دارایی، سەعاتی زیاده (5,000 IQD)، بارداگرتن و پیشینەکان
              </p>
            </div>

            {/* 6. System Settings & Data Restore */}
            <div
              onClick={() => setActiveTab('settings')}
              className="bg-white/80 backdrop-blur-xl border border-slate-300 hover:border-blue-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center space-y-3"
            >
              <div className="w-16 h-16 bg-slate-100 text-slate-800 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black group-hover:scale-105 transition-transform border border-slate-300">
                ⚙️
              </div>
              <h3 className="text-base font-black text-slate-900 group-hover:text-slate-900">
                ڕێکخستنەکان و داتا (Settings & Backup)
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                دابەزاندن و هێنانەوەی باکئەپ (Restore Upload)، و بەکارهێنەران
              </p>
            </div>

          </div>
        </div>
      )}

      {/* SUB-MODULE 1: EMPLOYEES ROSTER & RESIGNATION MANAGEMENT */}
      {activeTab === 'employees' && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
          
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                👥 بەڕێوەبردنی کارمەندەکان (Employee Roster & Resignations)
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                تۆماری کارمەندان، ناوی سیانی، مۆبایل، وازهێنان (شارستنەوە لە لیست بەبێ سڕینەوە لە ئەرشیف)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintPDF('لیستی کارمەندان')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer"
              >
                🖨️ PDF Export
              </button>
              <button
                onClick={() => handleOpenEmpModal()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs border border-slate-700 cursor-pointer"
              >
                ➕ زیاتکردنی کارمەندی نوێ
              </button>
            </div>
          </div>

          {/* Filter Status Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-300">
            <button
              onClick={() => setEmpStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                empStatusFilter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✅ کارمەندانی چالاک ({employees.filter((e) => e.status !== 'resigned' && e.isActive !== false).length})
            </button>
            <button
              onClick={() => setEmpStatusFilter('resigned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                empStatusFilter === 'resigned' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📁 وازهێنراوەکان (لە ئەرشیفدا) ({employees.filter((e) => e.status === 'resigned' || e.isActive === false).length})
            </button>
            <button
              onClick={() => setEmpStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                empStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تێکڕا ({employees.length})
            </button>
          </div>

          {/* Employees Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
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
              <tbody className="divide-y divide-slate-200 font-bold">
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
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded text-[11px] border border-rose-300">
                              وازهێنراو (لە ئەرشیف)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded text-[11px] border border-emerald-300">
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
                            className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                              isResigned
                                | 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
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

        </div>
      )}

      {/* SUB-MODULE 2: PLACEMENT MANAGEMENT / INVENTORY */}
      {activeTab === 'placement' && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                📦 بەڕێوەبردنی جەرد (Placement Management / Inventory)
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                فایلی دەستی، هاوردەکردنی ئێکسڵ، ئەرشیف و دیاریکردنی شوێنی کۆگاکان
              </p>
            </div>

            <button
              onClick={() => handlePrintPDF('جەردی کۆگا')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer"
            >
              🖨️ PDF Export
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/new-file" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">📝</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">بەشی A: فایلی دەستی نوێ</h3>
              <p className="text-[11px] text-slate-500">تێکردنی دەستی مۆدێل، بڕ و تێبینی بە 3 ستوون</p>
            </Link>

            <Link href="/import" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">📊</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">بەشی B: هاوردەکردنی ئێکسڵ</h3>
              <p className="text-[11px] text-slate-500">هاوردەکردنی ئۆتۆماتیکی فایلی ئێکسڵ بە 9 ستوونەکە</p>
            </Link>

            <Link href="/archive" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">📂</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">بەشی C: ئەرشیفی ئێکسڵ</h3>
              <p className="text-[11px] text-slate-500">کۆگا و ئەرشیفی فایلی جەردە پاشەکەوتکراوەکان</p>
            </Link>

            <Link href="/locations" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">🏢</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">بەشی D: لیستی شوێنەکان</h3>
              <p className="text-[11px] text-slate-500">دیاریکردنی شوێنەکانی Ashley Store و Huana Store</p>
            </Link>
          </div>
        </div>
      )}

      {/* SUB-MODULE 3: TRANSMIT / INTERNAL TRANSFERS */}
      {activeTab === 'transmit' && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                🚚 بەڕێوەبردنی گواستنەوە (Transmit / Internal Transfers)
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                تۆماری باری هەولێر، بەغداد، دهۆک لەگەڵ مێژووی بەتاڵکردن
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrintPDF('ڕاپۆرتی باری گواستنەوە')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer"
              >
                🖨️ PDF Export
              </button>
              <Link href="/public-transmit">
                <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs border border-slate-700 cursor-pointer">
                  ✍️ تۆمارکردنی باری نوێ
                </button>
              </Link>
            </div>
          </div>

          {/* City Destination Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-300">
            {['All', 'Erbil', 'Baghdad', 'Dohuk'].map((city) => (
              <button
                key={city}
                onClick={() => setTransmitCityFilter(city as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  transmitCityFilter === city ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {city === 'All' ? 'تێکڕا' : city === 'Erbil' ? 'باری هەولێر' : city === 'Baghdad' ? 'باری بەغداد' : 'باری دهۆک'}
              </button>
            ))}
          </div>

          <div className="border border-slate-300 rounded-xl p-8 text-center">
            <p className="text-xs font-bold text-slate-500">
              تێبینی: سەرجەم لیستەکان شیاوی دەستکاریکردن، سڕینەوە و قفڵکردنن بۆ بەدواداچوونی مێژووی بارەکان.
            </p>
          </div>
        </div>
      )}

      {/* SUB-MODULE 4: HR EXPENSES, OVERTIME & ADVANCES */}
      {activeTab === 'hr' && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                💰 بەشی HR، خەرجیییەکان و سەعاتی زیاده
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                ڕاپۆرتی مانگانە، نرخە جێگیرەکان (Overtime: 5,000 IQD) و پیشینەی مووچە
              </p>
            </div>

            <button
              onClick={() => handlePrintPDF('ڕاپۆرتی خەرجی و مووچە')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer"
            >
              🖨️ PDF Export
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/ashley-expenses" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">💳</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">داشبۆردی خەرجییەکان</h3>
              <p className="text-[11px] text-slate-500">تۆماری خەرجی کارمەندان، ڕاپۆرتی ئۆتۆماتیکی مانگانە و قفڵکردن</p>
            </Link>

            <Link href="/overtime" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">🕒</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">سەعاتی زیاده (Overtime)</h3>
              <p className="text-[11px] text-slate-500">ئەژمارکردنی کاتژمێر × ٥,٠٠٠ IQD و ئەرشیفی ڕۆژانە</p>
            </Link>

            <Link href="/inputs" className="p-5 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl space-y-2 group">
              <span className="text-2xl">✍️</span>
              <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-900">پیشینەی مووچە و بڕینەکان</h3>
              <p className="text-[11px] text-slate-500">تۆماری پیشینەی مووچە، بارداگرتن و داغڵکردنی زانیارییەکان</p>
            </Link>
          </div>
        </div>
      )}

      {/* SUB-MODULE 5: SETTINGS, BACKUP & RESTORE */}
      {activeTab === 'settings' && (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-300 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-black text-slate-900">
              ⚙️ ڕێکخستنەکان، پاشەکەوت و هێنانەوەی داتا (Backup & Restore)
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              پاشەکەوتکردن (Download) و هێنانەوەی داتاکان (Upload JSON Restore File) بۆ مۆبایل و کۆمپیوتەر
            </p>
          </div>

          <div className="p-6 bg-slate-50 border border-slate-300 rounded-xl space-y-4 max-w-xl">
            <h3 className="text-xs font-black text-slate-900 uppercase">
              پاشەکەوت و هێنانەوەی ئۆفلاین (Offline Data Storage & Backup):
            </h3>

            <div className="flex items-center gap-3">
              <button
                onClick={exportStateAsJson}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
              >
                💾 دابەزاندنی باکئەپ (Download Backup JSON)
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
              >
                📤 هێنانەوەی باکئەپ (Upload / Restore Data File)
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleRestoreJson}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYEE ADD/EDIT FORM MODAL */}
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

      {/* FACTORY LOCATION MAP PICKER MODAL */}
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
