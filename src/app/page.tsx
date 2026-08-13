'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import type { Employee } from '@/lib/types';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';
import { useFirestore, collection, doc, setDocumentNonBlocking } from '@/firebase';
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
  Search
} from 'lucide-react';

// Haversine formula to compute exact distance in meters between two GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function MainPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
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
  const db = useFirestore();

  // Authoritative Factory Location
  const factoryLocation = settings?.factoryLocation || {
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 500,
  };

  // --- Attendance State ---
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  
  // GPS Geofence State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Employee Roster Management Modal & State ---
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

  // --- Search Catalog State ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Geofence Map & Font Modals ---
  const [showMapPicker, setShowMapPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Request GPS Location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('جی پی ئێس لە وێبگەڕ پشتیوانی نەکراوە');
      return;
    }
    setGpsStatus('پشکنینی لۆکەیشنی مۆبایل لەگەڵ کۆمپانیا...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });
        const dist = calculateDistanceMeters(uLat, uLng, factoryLocation.lat, factoryLocation.lng);
        setDistanceMeters(dist);
        const inside = dist <= factoryLocation.radiusMeters;
        setIsWithinGeofence(inside);
        setGpsStatus(inside ? `داخل کۆمپانیا (${dist}m)` : `دەرەوەی کۆمپانیا (${dist}m)`);
      },
      (err) => {
        setGpsStatus('نەتوانرا لۆکەیشنی جی پی ئێس وەربگیرێت');
        setIsWithinGeofence(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Camera Control
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setAttMessage({ text: 'کامیرا لە مۆبایل یان کۆمپیوتەرەکەتدا نەدۆزرایەوە', success: false });
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, 300, 300);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedSelfie(dataUrl);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
    }
  };

  // Check-In / Check-Out Submission
  const handleCheckInOrOut = async (type: 'Check In' | 'Check Out') => {
    if (!selectedEmpId) {
      setAttMessage({ text: 'تکایە ناوی خۆت لە لیستەکەدا هەڵبژێرە', success: false });
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    if (pinCode.trim() !== (emp.password || '1234')) {
      setAttMessage({ text: 'کۆدی PIN هەڵەیە! تکایە کۆدە دروستەکەت بنووسە', success: false });
      return;
    }

    if (!capturedSelfie) {
      setAttMessage({ text: 'تکایە فۆتۆ سێلفی لەگەڵ ئامادەبوون بگرە', success: false });
      return;
    }

    const timeNow = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const newLog = {
      id: `log-${Date.now()}`,
      employeeId: emp.id,
      name: emp.fullName3Part || emp.name,
      type: type === 'Check In' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
      time: timeNow,
      selfieUrl: capturedSelfie,
      distance: distanceMeters !== null ? `${distanceMeters}m` : 'داخل کۆمپانیا',
      status: 'verified',
    };

    setAttendanceLogs([newLog, ...attendanceLogs]);
    setAttMessage({
      text: `ئامادەبوونی (${emp.name}) بە سەرکەوتوویی وەک ${type} تۆمارکرا!`,
      success: true,
    });

    // Reset Form
    setSelectedEmpId('');
    setPinCode('');
    setCapturedSelfie(null);
  };

  // Open Employee Add/Edit Modal
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
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کارمەندە بە یەکجاری؟')) {
      setEmployees(employees.filter((e) => e.id !== empId));
    }
  };

  // Delete Attendance Log
  const handleDeleteAttendanceLog = (logId: string) => {
    if (confirm('ئایا دڵنیایت لە سڕینەوەی ئەم فۆتۆ و لۆگە؟')) {
      setAttendanceLogs(attendanceLogs.filter((l) => l.id !== logId));
    }
  };

  // Upload Custom UI Font
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

  // Restore JSON Data
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

  // Filter Employees
  const filteredEmployees = employees.filter((emp) => {
    if (empStatusFilter === 'active') return emp.status !== 'resigned' && emp.isActive !== false;
    if (empStatusFilter === 'resigned') return emp.status === 'resigned' || emp.isActive === false;
    return true;
  });

  // Filter Items
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.model && item.model.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.classification && item.classification.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-12 p-2 sm:p-4" dir="rtl">

      {/* 🌟 CLASSIC ENTERPRISE DESKTOP TITLE BAR & ACTION RIBBON */}
      <div className="panel-classic p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span>🖥️ DASHBOARD MAIN PAGE — ASHLEY ERP ENTERPRISE DESKTOP 2026</span>
          </h1>
          <p className="text-[11px] text-slate-600 font-bold mt-0.5">
            سیستەمی گشتی بەڕێوەبردنی کارمەندان، ئامادەبوونی فۆتۆ، کۆگا، لۆجیستیک و سێتینگی فۆنت
          </p>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <button onClick={() => setShowMapPicker(true)} className="btn-classic">
            <MapPin className="w-3.5 h-3.5 text-amber-700" />
            <span>شوێنی کۆمپانیا (Map)</span>
          </button>
          <button onClick={exportStateAsJson} className="btn-classic">
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>باکئەپ (JSON)</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-classic">
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>هێنانەوەی باکئەپ</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreJson} className="hidden" />
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
      {/* 👥 SECTION 1: HR & ATTENDANCE TERMINAL CLASSIC PANEL */}
      {/* ========================================================================= */}
      <section className="panel-classic space-y-3">
        <div className="panel-header-classic flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-800" />
            <span>بەشی یەکەم: بەشی کارمەندان HR (Staff Operations & Photo Attendance Terminal)</span>
          </h2>
          <span className="text-[10px] font-mono bg-blue-900 text-white px-1.5 py-0.2">HR MODULE</span>
        </div>

        <div className="p-3 space-y-4">

          {/* ATTENDANCE CHECK-IN / CHECK-OUT TERMINAL */}
          <div className="p-3 bg-slate-100 border border-slate-300 space-y-3">
            <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-blue-800" />
              <span>تۆمارکردنی ئامادەبوونی ڕۆژانە بە فۆتۆ سێلفی و کۆدی PIN</span>
            </h3>

            {attMessage && (
              <div className={`p-2 text-xs font-bold border ${attMessage.success ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'}`}>
                {attMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold">
              
              {/* Step 1: Select Employee */}
              <div>
                <label className="block text-slate-800 mb-1">١. ناوی کارمەند هەڵبژێرە:</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="input-classic w-full font-bold"
                >
                  <option value="">-- ناوی خۆت هەڵبژێرە --</option>
                  {employees.filter(e => e.status !== 'resigned' && e.isActive !== false).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: PIN Code */}
              <div>
                <label className="block text-slate-800 mb-1">٢. کۆدی PIN (پاسۆرد):</label>
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="کۆدی 1234 بنووسە..."
                  className="input-classic w-full font-mono text-center tracking-widest text-sm"
                />
              </div>

              {/* Step 3: Camera Selfie */}
              <div className="space-y-1 text-center">
                <label className="block text-slate-800 mb-1 text-right">٣. فۆتۆی سێلفی ئامادەبوون:</label>
                {cameraActive ? (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-32 object-cover border border-slate-400 bg-black" />
                    <button type="button" onClick={capturePhoto} className="btn-classic-primary w-full text-xs">
                      📸 گرتنی فۆتۆ
                    </button>
                  </div>
                ) : capturedSelfie ? (
                  <div className="space-y-1">
                    <img src={capturedSelfie} alt="Captured Selfie" className="w-full h-24 object-cover border border-slate-400" />
                    <button type="button" onClick={startCamera} className="btn-classic w-full text-[10px]">
                      🔄 فۆتۆیەکی تر بگرە
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startCamera} className="btn-classic w-full text-xs py-2">
                    📷 بەگەڕخستنی کامیرای مۆبایل
                  </button>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

            </div>

            {/* Attendance Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300">
              <button
                type="button"
                onClick={() => handleCheckInOrOut('Check In')}
                className="btn-classic-primary py-2 px-4 text-xs font-black"
              >
                📥 تۆمارکردنی هاتن (Check In)
              </button>
              <button
                type="button"
                onClick={() => handleCheckInOrOut('Check Out')}
                className="btn-classic-danger py-2 px-4 text-xs font-black"
              >
                📤 تۆمارکردنی دەرچوون (Check Out)
              </button>
            </div>
          </div>

          {/* Quick Beveled Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-100 border border-slate-300">
            <div className="flex items-center gap-2">
              <button onClick={() => handleOpenEmpModal()} className="btn-classic-primary">
                <UserPlus className="w-3.5 h-3.5" />
                <span>➕ زیادکردنی کارمەندی نوێ</span>
              </button>

              <button
                onClick={() => setEmpStatusFilter(empStatusFilter === 'active' ? 'resigned' : 'active')}
                className="btn-classic"
              >
                <span>{empStatusFilter === 'resigned' ? 'نیشاندانی کارمەندە چالاکەکان' : '📜 ئەرشیفی وازهێناوەکان'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <Link href="/overtime" className="btn-classic text-[11px]">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>سەعاتی زیاده (Overtime)</span>
              </Link>
              <Link href="/ashley-expenses" className="btn-classic text-[11px]">
                <Receipt className="w-3.5 h-3.5 text-rose-700" />
                <span>مەسروفاتی HR</span>
              </Link>
            </div>
          </div>

          {/* Employee Roster Data Grid */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              خشتەی ناوی کارمەندان و کۆدەکانی ئامادەبوون (Employee Roster Grid):
            </h3>

            <div className="overflow-x-auto border border-slate-400">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th>کۆدی PIN</th>
                    <th>ناوی سیانی / کورت</th>
                    <th>پلە / ئەرک</th>
                    <th>ژمارەی مۆبایل</th>
                    <th>دۆخ</th>
                    <th>کردارەکان</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.id} className={emp.status === 'resigned' ? 'bg-rose-50' : ''}>
                        <td className="font-mono font-bold text-blue-900">{emp.password || '1234'}</td>
                        <td className="font-bold">{emp.fullName3Part || emp.name}</td>
                        <td className="font-mono text-[11px] text-slate-700">{emp.role || 'Staff'}</td>
                        <td className="font-mono text-[11px]">{emp.phone || '-'}</td>
                        <td>
                          {emp.status === 'resigned' ? (
                            <span className="px-1.5 py-0.2 bg-rose-200 text-rose-900 font-bold border border-rose-400 text-[10px]">وازهێناو</span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-900 font-bold border border-emerald-400 text-[10px]">چالاک</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleOpenEmpModal(emp)} className="btn-classic text-[10px]">
                              <Edit className="w-3 h-3 text-blue-700" />
                              <span>دەستکاری</span>
                            </button>
                            <button onClick={() => handleToggleResignation(emp)} className="btn-classic text-[10px]">
                              <span>🔄 وازهێنان</span>
                            </button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="btn-classic text-[10px] text-rose-800">
                              <Trash2 className="w-3 h-3 text-rose-700" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-slate-500 font-bold">
                        هیچ کارمەندێک نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total-row">
                    <td colSpan={2}>کۆی گشتی کارمەندان:</td>
                    <td colSpan={4} className="font-mono">{filteredEmployees.length} Employee(s)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Attendance Photo Selfie Audit Data Grid */}
          <div className="space-y-1.5 pt-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-blue-800" />
              <span>ئەرشیفی فۆتۆی سێلفی و لۆگەکانی ئامادەبوون (Attendance Selfie Audit Grid):</span>
            </h3>

            <div className="overflow-x-auto border border-slate-400">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th>فۆتۆ</th>
                    <th>ناوی کارمەند</th>
                    <th>جۆری ئامادەبوون</th>
                    <th>کاتی تۆمارکراو</th>
                    <th>دووری لە کۆمپانیا</th>
                    <th>سڕینەوە</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLogs.length > 0 ? (
                    attendanceLogs.slice(0, 10).map((log) => (
                      <tr key={log.id}>
                        <td>
                          {log.selfieUrl ? (
                            <img src={log.selfieUrl} alt="Selfie" className="w-8 h-8 object-cover border border-slate-400" />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">No Photo</span>
                          )}
                        </td>
                        <td className="font-bold">{log.name}</td>
                        <td>
                          <span className={`px-1.5 py-0.2 text-[10px] font-bold border ${log.type.includes('In') || log.type.includes('هاتن') ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="font-mono text-[11px]">{log.time}</td>
                        <td className="font-mono text-[11px] text-blue-900">{log.distance || 'داخل کۆمپانیا'}</td>
                        <td>
                          <button onClick={() => handleDeleteAttendanceLog(log.id)} className="btn-classic text-[10px] text-rose-800">
                            <Trash2 className="w-3 h-3 text-rose-700" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-3 text-slate-400 font-bold">
                        هیچ لۆگێکی فۆتۆ نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total-row">
                    <td colSpan={2}>کۆی لۆگەکانی سێلفی:</td>
                    <td colSpan={4} className="font-mono">{attendanceLogs.length} Log Record(s)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
            <span>بەشی دووەم: بەشی کۆگا و عەمبار (Inventory & Stock Management)</span>
          </h2>
          <span className="text-[10px] font-mono bg-emerald-800 text-white px-1.5 py-0.2">STOCK MODULE</span>
        </div>

        <div className="p-3 space-y-3">
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

          {/* Quick Model Search Box */}
          <div className="p-2 bg-slate-100 border border-slate-300 space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان بۆ مۆدێل یان کاڵای کۆگا..."
                className="input-classic w-full font-bold"
              />
            </div>

            <div className="overflow-x-auto border border-slate-400">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th>کۆد / مۆدێل</th>
                    <th>ناوی کاڵا</th>
                    <th>پۆلێن</th>
                    <th>دۆخ</th>
                    <th>چوونە ژوورەوە</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono font-bold text-emerald-900">{item.model || 'MODEL-01'}</td>
                      <td className="font-bold">{item.name || 'مۆدێلی ئاشڵی'}</td>
                      <td>{item.classification || 'کۆگا'}</td>
                      <td>{item.modelCondition || 'نوێ'}</td>
                      <td>
                        <Link href="/items" className="btn-classic text-[10px]">بینین</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <button onClick={() => setShowMapPicker(true)} className="btn-classic w-full justify-between py-2 text-[11px]">
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
                <button type="button" onClick={() => setShowEmpModal(false)} className="btn-classic text-xs">
                  پاشگەزبوونەوە
                </button>
                <button type="submit" className="btn-classic-primary text-xs">
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
