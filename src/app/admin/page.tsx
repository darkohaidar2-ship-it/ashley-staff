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
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-8" dir="rtl">
      
      {/* 🌟 CLASSIC ENTERPRISE DESKTOP TOP TITLE BAR */}
      <div className="panel-classic p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span>🛡️ پەنەری سەرەکی بەڕێوەبەری سەرەکی (Admin Master Hub Desktop)</span>
          </h1>
          <p className="text-[11px] text-slate-600 font-bold mt-0.5">
            سیستەمی گشتی بەڕێوەبردنی کارمەندان، کۆگا، لۆجیستیک، ڕێکخستن و گۆڕینی فۆنتی UI
          </p>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="statusbar-segment text-blue-900 font-bold">ADMIN: SUPERUSER</span>
          <button onClick={() => fontInputRef.current?.click()} className="btn-classic">
            <Upload className="w-3.5 h-3.5 text-purple-700" />
            <span>ئاپلۆدی فۆنت</span>
          </button>
        </div>
      </div>

      {/* QUICK SYSTEM STATS BANNER */}
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

        <div className="p-3 space-y-4">
          
          {/* Quick Beveled Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEmpModal()}
                className="btn-classic-primary"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>➕ زیادکردنی کارمەندی نوێ</span>
              </button>
            </div>
            
            <div className="flex items-center gap-1 bg-slate-200 p-0.5 border border-slate-400">
                {['all', 'active', 'resigned'].map((f) => (
                    <button key={f} onClick={() => setEmpStatusFilter(f as any)} className={`px-2 py-0.5 text-[10px] font-bold ${empStatusFilter === f ? 'bg-white border border-slate-400' : ''}`}>
                        {f === 'all' ? 'هەموو' : f === 'active' ? 'چالاک' : 'وازهێناو'}
                    </button>
                ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-400">
            <table className="table-classic w-full text-xs">
              <thead>
                <tr className="bg-slate-300">
                  <th className="p-2">ناو</th>
                  <th className="p-2">مۆبایل</th>
                  <th className="p-2">ئەرک</th>
                  <th className="p-2">دۆخ</th>
                  <th className="p-2 text-left">کردار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="p-2 font-bold">{emp.fullName3Part || emp.name}</td>
                    <td className="p-2">{emp.phone}</td>
                    <td className="p-2">{emp.role}</td>
                    <td className="p-2">
                        <span className={`text-[10px] px-1 font-bold ${emp.status === 'resigned' ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}`}>
                            {emp.status === 'resigned' ? 'وازهێناو' : 'چالاک'}
                        </span>
                    </td>
                    <td className="p-2 text-left space-x-1">
                      <button onClick={() => handleOpenEmpModal(emp)} className="btn-classic">دەستکاری</button>
                      <button onClick={() => handleToggleResignation(emp)} className="btn-classic">🔄 گۆڕین</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
