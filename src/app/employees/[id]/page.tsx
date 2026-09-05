'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import withAuth from '@/hooks/withAuth';
import { 
  ArrowRight, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Upload, 
  Mail, 
  Phone, 
  Cake, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Clock, 
  Gift, 
  Banknote, 
  FileDown, 
  Printer, 
  UserX, 
  UserCheck, 
  User, 
  Loader2,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Camera,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { format, parseISO, getDaysInMonth, getDay } from 'date-fns';
import { useAppContext } from '@/context/app-provider';
import type { Employee, AttendanceRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AdminFaceEnrollModal } from '@/components/attendance/AdminFaceEnrollModal';
import * as XLSX from 'xlsx';

const ASHLEY_DEFAULT_EMPLOYEES = [
  { id: 'emp-01', name: 'سه هەند مەریوان حەمەسەعید', fullName3Part: 'سه هەند مەریوان حەمەسەعید', role: 'Employee', phone: '0770 123 4567', startDate: '2025-01-01', pin: '1001', password: '1001', deviceBound: false },
  { id: 'emp-02', name: 'دارکۆ حەیدەر حسێن', fullName3Part: 'دارکۆ حەیدەر حسێن', role: 'Manager', phone: '0770 765 4321', startDate: '2024-01-01', pin: '1002', password: '1002', deviceBound: true },
  { id: 'emp-03', name: 'شادیار هوشیار', fullName3Part: 'شادیار هوشیار', role: 'Employee Supervisor', phone: '0750 111 2233', startDate: '2025-02-01', pin: '1003', password: '1003', deviceBound: false },
  { id: 'emp-04', name: 'هەڤاڵ حبیب حەمەڕەزا', fullName3Part: 'هەڤاڵ حبیب حەمەڕەزا', role: 'Transport Supervisor', phone: '0750 222 3344', startDate: '2025-02-15', pin: '1004', password: '1004', deviceBound: false },
  { id: 'emp-05', name: 'عیماد سەباح نوری', fullName3Part: 'عیماد سەباح نوری', role: 'Employee', phone: '0770 333 4455', startDate: '2025-03-01', pin: '1005', password: '1005', deviceBound: false },
  { id: 'emp-06', name: 'کامەران عومەر ڕووئوف', fullName3Part: 'کامەران عومەر ڕووئوف', role: 'Employee', phone: '0770 444 5566', startDate: '2025-03-10', pin: '1006', password: '1006', deviceBound: false },
  { id: 'emp-07', name: 'ڕابەر محەمەد مەحمود', fullName3Part: 'ڕابەر محەمەد مەحمود', role: 'Employee', phone: '0770 555 6677', startDate: '2025-04-01', pin: '1007', password: '1007', deviceBound: false },
  { id: 'emp-08', name: 'دانەر محەمەد باسام', fullName3Part: 'دانەر محەمەد باسام', role: 'Employee', phone: '0770 666 7788', startDate: '2025-04-15', pin: '1008', password: '1008', deviceBound: false },
  { id: 'emp-09', name: 'ڕێبین سەباح نوری', fullName3Part: 'ڕێبین سەباح نوری', role: 'Employee', phone: '0770 777 8899', startDate: '2025-05-01', pin: '1009', password: '1009', deviceBound: false },
  { id: 'emp-10', name: 'بەهرەمەند ڕزگار عزیز', fullName3Part: 'بەهرەمەند ڕزگار عزیز', role: 'Employee', phone: '0770 888 9900', startDate: '2025-05-15', pin: '1010', password: '1010', deviceBound: false },
  { id: 'emp-11', name: 'شادومان یادگار رحیم', fullName3Part: 'شادومان یادگار رحیم', role: 'Employee', phone: '0750 999 0011', startDate: '2025-06-01', pin: '1011', password: '1011', deviceBound: false },
  { id: 'emp-12', name: 'سەروەت قادر', fullName3Part: 'سەروەت قادر', role: 'Employee', phone: '0750 000 1122', startDate: '2025-06-15', pin: '1012', password: '1012', deviceBound: false },
];

function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const employeeId = (params?.id as string) || '';

  const {
    employees = [],
    setEmployees,
    attendanceLogs = [],
    expenses = [],
    overtime = [],
    bonuses = [],
    withdrawals = []
  } = useAppContext();

  // Find Employee from Context or fallback list
  const selectedEmployee = useMemo(() => {
    const found = employees.find(e => e.id === employeeId);
    if (found) return found;
    const fallback = ASHLEY_DEFAULT_EMPLOYEES.find(e => e.id === employeeId);
    if (fallback) return fallback as any as Employee;
    return null;
  }, [employees, employeeId]);

  // Active Tab: 'overview' | 'device' | 'attendance' | 'finance'
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'finance'>('overview');

  // Month selection for attendance matrix
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));

  // Mobile Device State
  const [isDeviceBound, setIsDeviceBound] = useState<boolean>(() => {
    if (employeeId === 'emp-02') return true;
    return Boolean((selectedEmployee as any)?.deviceBound);
  });
  const [empPin, setEmpPin] = useState<string>(() => {
    return (selectedEmployee as any)?.password || (selectedEmployee as any)?.pin || '1234';
  });
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);
  const [isUnbinding, setIsUnbinding] = useState(false);

  // AI Face ID State
  const [hasFace, setHasFace] = useState<boolean>(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [isDeletingFace, setIsDeletingFace] = useState(false);

  // Edit Mode for basic info
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFullName3Part, setEditFullName3Part] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');

  // Sync basic info for editing
  useEffect(() => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name || '');
      setEditFullName3Part((selectedEmployee as any).fullName3Part || selectedEmployee.name || '');
      setEditRole(selectedEmployee.role || 'Staff');
      setEditPhone(selectedEmployee.phone || '');
      setEditStartDate((selectedEmployee as any).startDate || selectedEmployee.employmentStartDate?.slice(0, 10) || '');
      setEditPhotoUrl(selectedEmployee.photoUrl || '');
      setEmpPin((selectedEmployee as any).password || (selectedEmployee as any).pin || '1234');
      setIsDeviceBound(employeeId === 'emp-02' ? true : Boolean((selectedEmployee as any)?.deviceBound));
    }
  }, [selectedEmployee, employeeId]);

  // Check Face ID status from server
  const checkFaceStatus = useCallback(async () => {
    if (!employeeId) return;
    try {
      const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
      if (localDb[employeeId]) {
        setHasFace(true);
      }
      const res = await fetch(`/api/attendance/face/status?userId=${employeeId}&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setHasFace(Boolean(data.registered));
      }
    } catch {}
  }, [employeeId]);

  useEffect(() => {
    checkFaceStatus();
  }, [checkFaceStatus]);

  // Unbind Mobile Device
  const handleUnbindDevice = async () => {
    if (!selectedEmployee) return;
    if (!confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوە و ڕیستکردنی مۆبایلی (${selectedEmployee.name})؟ دەستبەجێ لە مۆبایلی کارمەند لۆگ-ئاوت دەبێت.`)) {
      return;
    }

    setIsUnbinding(true);
    try {
      await fetch('/api/attendance/unbind-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmployee.id })
      });

      setIsDeviceBound(false);
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, deviceBound: false } as any : e));

      toast({
        title: '✅ مۆبایل هەڵوەشێنرایەوە',
        description: 'مۆبایلی کارمەند بە سەرکەوتوویی لە ئەکاونتەکە کرایەوە و لۆگ-ئاوت کرا.'
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'هەڵەیەک ڕوویدا',
        description: 'نەتوانرا پەیوەندی مۆبایلەکە هەڵبوەشێنرێتەوە.'
      });
    } finally {
      setIsUnbinding(false);
    }
  };

  // Update PIN code
  const handleSavePin = async () => {
    if (!empPin.trim() || empPin.length < 4) {
      alert('تکایە کۆدی PIN لانیکەم ٤ ژمارە بێت.');
      return;
    }

    setIsUpdatingPin(true);
    try {
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, pin: empPin, password: empPin } as any : e));
      toast({
        title: '✅ کۆدی PIN نوێکرایەوە',
        description: `کۆدی نوێی چوونەژوورەوەی مۆبایل: ${empPin}`
      });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // Delete Face ID
  const handleDeleteFace = async () => {
    if (!confirm(`ئایا دڵنیایت لە سڕینەوەی ناسنامەی دەموچاوی (${selectedEmployee?.name})؟`)) return;
    setIsDeletingFace(true);
    try {
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        delete localDb[employeeId];
        localStorage.setItem('ashley_face_registry_local', JSON.stringify(localDb));
      } catch {}

      await fetch('/api/attendance/face/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employeeId })
      });

      setHasFace(false);
      toast({
        title: '✅ ڕوخسار سڕایەوە',
        description: 'ناسنامەی دەموچاوی کارمەند بە سەرکەوتوویی سڕایەوە.'
      });
    } catch {
      toast({ variant: 'destructive', title: 'هەڵە', description: 'نەتوانرا ڕوخسار بسڕدرێتەوە.' });
    } finally {
      setIsDeletingFace(false);
    }
  };

  // Save Profile Edits
  const handleSaveProfile = () => {
    if (!selectedEmployee) return;
    const updated = {
      ...selectedEmployee,
      name: editName,
      fullName3Part: editFullName3Part,
      role: editRole,
      phone: editPhone,
      startDate: editStartDate,
      photoUrl: editPhotoUrl,
    };
    setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? (updated as any) : e));
    setIsEditing(false);
    toast({
      title: '✅ زانیارییەکان نوێکرانەوە',
      description: 'گۆڕانکارییەکان لە پرۆفایلی کارمەند بە سەرکەوتوویی پاشەکەوت کران.'
    });
  };

  // Toggle Resigned / Active
  const handleToggleResigned = () => {
    if (!selectedEmployee) return;
    const nextStatus = selectedEmployee.status === 'resigned' ? 'active' : 'resigned';
    setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, status: nextStatus, isActive: nextStatus === 'active' } as any : e));
    toast({
      title: nextStatus === 'active' ? '👤 کارمەند کارا کرایەوە' : '🛑 کارمەند وازهێنراو کرا',
      description: `دۆخی کارمەند گۆڕدرا بۆ: ${nextStatus === 'active' ? 'چالاک' : 'وازهێناو'}`
    });
  };

  // Attendance breakdown for the selected month
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '09', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const attendanceData = useMemo(() => {
    let presentCount = 0;
    let totalWorkedHours = 0;

    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const dateStr = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(year, month - 1, dayNum);
      const isFriday = getDay(dateObj) === 5;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      const dayRecords = attendanceLogs.filter(log => {
        const logDate = log.date || (log.time ? log.time.split(' ')[0] : log.createdAt?.split('T')[0] || '');
        if (logDate !== dateStr) return false;
        const logEmpId = (log.employeeId || log.userId || '').toString().trim().toLowerCase();
        return logEmpId === employeeId.toLowerCase();
      });

      let checkInTime = '';
      let checkOutTime = '';
      dayRecords.forEach((r: any) => {
        if (r.checkInTime && !checkInTime) checkInTime = r.checkInTime.slice(0, 5);
        if (r.checkOutTime) checkOutTime = r.checkOutTime.slice(0, 5);
      });

      const isPresent = Boolean(checkInTime || checkOutTime);
      if (isPresent) {
        presentCount++;
        totalWorkedHours += 8;
      }

      return {
        dayNum,
        dateStr,
        isFriday,
        isFuture,
        isToday,
        checkInTime,
        checkOutTime,
        isPresent,
        status: isFriday ? 'Holiday' : isPresent ? 'Present' : isFuture ? 'Empty' : 'Absent'
      };
    });

    return {
      days,
      presentCount,
      totalWorkedHours,
      absentCount: Math.max(0, days.filter(d => !d.isFuture && !d.isFriday && !d.isPresent).length)
    };
  }, [totalDays, selectedMonth, year, month, todayStr, attendanceLogs, employeeId]);

  if (!selectedEmployee) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mb-4 border border-rose-300">
          ⚠️
        </div>
        <h2 className="text-lg font-black text-slate-900 mb-2">کارمەند نەدۆزرایەوە</h2>
        <p className="text-xs text-slate-500 font-bold mb-4">ئەم کۆدە (${employeeId}) لە سیستەمدا بوونی نییە.</p>
        <Link href="/admin" className="px-4 py-2 bg-slate-900 text-white text-xs font-black hover:bg-slate-800">
          ← گەڕانەوە بۆ پانێڵی سەرەکی
        </Link>
      </div>
    );
  }

  const isDarko = selectedEmployee.id === 'emp-02' || (selectedEmployee.name || '').includes('دارکۆ');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans p-3 sm:p-6 select-none space-y-4" dir="rtl">
      
      {/* 🧭 WINDOWS 11 TOP COMMAND BAR & NAVIGATION BREADCRUMB */}
      <div className="bg-white border-2 border-slate-300 p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="گەڕانەوە بۆ پانێڵی فەرمی ئەدمین"
          >
            <ArrowRight className="w-4 h-4" />
            <span>گەڕانەوە بۆ ئەدمین</span>
          </Link>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <span className="text-slate-400">پانێڵ</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
            <span className="text-slate-400">کارمەندان و مۆبایلەکان</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
            <span className="text-blue-700 font-black">{selectedEmployee.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>پرێنت</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 border text-xs font-black flex items-center gap-1 cursor-pointer transition-colors ${
              isEditing ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
            }`}
          >
            <Edit className="w-3.5 h-3.5 text-blue-600" />
            <span>{isEditing ? 'داخستنی دەستکاری' : 'دەستکاری زانیاری'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleResigned}
            className={`px-3 py-1.5 text-xs font-black flex items-center gap-1 border cursor-pointer ${
              selectedEmployee.status === 'resigned' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {selectedEmployee.status === 'resigned' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            <span>{selectedEmployee.status === 'resigned' ? 'گەڕاندنەوە بۆ دەوام' : 'تۆمارکردنی وازهێنان'}</span>
          </button>
        </div>
      </div>

      {/* 👤 HERO PROFILE & HARDWARE STATUS BANNER */}
      <div className="bg-slate-900 text-white border-2 border-slate-700 p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-slate-800 border-2 border-slate-600 overflow-hidden flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-md relative group">
              {selectedEmployee.photoUrl ? (
                <img src={selectedEmployee.photoUrl} alt={selectedEmployee.name} className="w-full h-full object-cover" />
              ) : (
                <span>{(selectedEmployee.name || '').slice(0, 2)}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-wide text-white">
                  {(selectedEmployee as any).fullName3Part || selectedEmployee.name}
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-black bg-blue-600 text-white font-mono">
                  {selectedEmployee.id}
                </span>
                <span className="px-2.5 py-0.5 text-[10px] font-black bg-slate-800 text-amber-300 border border-slate-700">
                  {isDarko ? '👑 بەڕێوەبەری سەرەکی' : selectedEmployee.role || 'کارمەند'}
                </span>
                {selectedEmployee.status === 'resigned' ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-black bg-rose-900 text-rose-200 border border-rose-700">
                    🛑 وازهێناو
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-700">
                    🟢 دەوامی چالاک
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono pt-1">
                <span>📞 {selectedEmployee.phone || '0770 000 0000'}</span>
                <span>•</span>
                <span>📅 دەستپێک: {(selectedEmployee as any).startDate || selectedEmployee.employmentStartDate?.slice(0, 10) || '2025-01-01'}</span>
                <span>•</span>
                <span>📍 لۆکەیشن: کۆمپانیای سەرەکی ئاشڵی</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-800/80 p-3 border border-slate-700">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">مۆبایلی ئەپ (Device):</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Smartphone className={`w-3.5 h-3.5 ${isDeviceBound ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className={`text-xs font-black ${isDeviceBound ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {isDeviceBound ? 'بەستراوەتەوە' : 'نەبەستراوە'}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">ناسنامەی دەموچاو (Face ID):</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Camera className={`w-3.5 h-3.5 ${hasFace ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className={`text-xs font-black ${hasFace ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {hasFace ? 'ناسراوە (AI Ready)' : 'تۆمارنەکراوە'}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700" />

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block">کۆدی پین (PIN):</span>
              <span className="text-xs font-mono font-black text-amber-300 block mt-0.5">{empPin}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ✏️ INLINE EDIT PROFILE FORM */}
      {isEditing && (
        <div className="bg-amber-50/70 border-2 border-amber-300 p-4 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
              <Edit className="w-4 h-4 text-amber-700" />
              <span>دەستکاریکردنی پرۆفایل و زانیارییە سەرەکییەکان:</span>
            </span>
            <button onClick={() => setIsEditing(false)} className="text-xs text-slate-500 font-bold hover:text-black">✕ داخستن</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-700">ناوی سێ قۆڵی:</label>
              <input
                type="text"
                value={editFullName3Part}
                onChange={e => setEditFullName3Part(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-white border border-slate-300 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-700">پۆست / ڕۆڵ:</label>
              <input
                type="text"
                value={editRole}
                onChange={e => setEditRole(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-white border border-slate-300 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-700">ژمارەی مۆبایل:</label>
              <input
                type="text"
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-white border border-slate-300 outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-1.5 bg-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-300"
            >
              پاشگەزبوونەوە
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="px-5 py-1.5 bg-slate-900 text-white text-xs font-black hover:bg-slate-800 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>پاشەکەوتکردنی گۆڕانکاری</span>
            </button>
          </div>
        </div>
      )}

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-slate-300 pb-1">
        {[
          { key: 'overview', label: '📱 مۆبایل، ئامێر و ناسنامەی ڕوخسار', icon: Smartphone },
          { key: 'attendance', label: '📅 خشتە و کاتەکانی دەوام (۳۱ ڕۆژە)', icon: Calendar },
          { key: 'finance', label: '💰 کاتی زیادە و شایستە داراییەکان', icon: DollarSign },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2 text-xs font-black flex items-center gap-2 border-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-blue-900 border-slate-700 border-b-white -mb-[3px] shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 border-transparent hover:bg-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: 📱 MOBILE DEVICE & AI FACE ID */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
          
          <div className="bg-white border-2 border-slate-300 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-orange-100 text-orange-700 flex items-center justify-center border border-orange-300">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">بەڕێوەبردنی مۆبایلی ئەم کارمەندە</h3>
                  <p className="text-[11px] text-slate-500 font-bold">بەستنەوە و هەڵوەشاندنەوەی مۆبایلی کەسی بۆ چێک-ئین</p>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 border ${
                isDeviceBound ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                {isDeviceBound ? '🟢 مۆبایل چالاکە' : '⚪ نەبەستراوە'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">ناسنامەی ئەکاونت:</span>
                  <span className="font-mono font-black text-slate-900">{selectedEmployee.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">یاسای ئاسایش:</span>
                  <span className="font-bold text-blue-700">تەنها ١ مۆبایل ڕێگەپێدراوە</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">دۆخی پەیوەندی لەگەڵ سێرڤەر:</span>
                  <span className="font-black text-emerald-700">پەیوەستە بە Supabase DB</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-blue-950 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                    <span>کۆدی PIN بۆ چوونەژوورەوە لە ئەپ:</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">٤ ژمارەیی</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={empPin}
                    onChange={e => setEmpPin(e.target.value.replace(/\D/g, ''))}
                    className="p-2 bg-white border border-slate-300 font-mono text-base font-black text-center w-32 tracking-widest outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSavePin}
                    disabled={isUpdatingPin}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-black cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isUpdatingPin ? 'پاشەکەوت دەکرێت...' : 'نوێکردنەوەی PIN'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleUnbindDevice}
                  disabled={isUnbinding}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-300 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4 text-rose-600" />
                  <span>{isUnbinding ? 'لە هەڵوەشاندنەوەدایە...' : '🔓 هەڵوەشاندنەوە و ڕیستکردنی دەستبەجێی مۆبایلی کارمەند (Remote Logout)'}</span>
                </button>
                <p className="text-[10px] text-slate-400 font-bold mt-1 text-center">
                  * کاتێک ئەم دوگمەیە دەکەیت، دەستبەجێ ئەپی مۆبایلەکەی دادەخرێت و کارمەند ناچار دەبێت دووبارە پین داخڵ بکاتەوە.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-300 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-300">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">سیستەمی ناسینەوەی ڕوخسار (AI Face ID)</h3>
                  <p className="text-[11px] text-slate-500 font-bold">ئاسایشی دەموچاو بۆ ڕێگریکردن لە گزیکاری و ئامادەبوونی خەیاڵی</p>
                </div>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 border ${
                hasFace ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {hasFace ? '✅ ناسراوە' : '⚠️ تۆمارنەکراوە'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">مۆدێلی ژیریی دەستکرد:</span>
                  <span className="font-mono font-black text-slate-900">Face-API SSD MobileNet v1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">پشکنینی زیندوویی (Liveness):</span>
                  <span className="font-bold text-purple-700">بازنەی ٢ چرکەیی سەوز</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">مۆڵەتی چێک-ئین لە مۆبایل:</span>
                  <span className={`font-black ${hasFace ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {hasFace ? 'چالاکە و ڕێگەپێدراوە' : 'قوفڵکراوە تا دەموچاو تۆمار دەکات'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFaceModal(true)}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{hasFace ? '📸 دووبارە ناساندنەوە و نوێکردنەوەی دەموچاو' : '📸 ناساندنی سەرەتایی دەموچاو لە ڕێگەی کامێراوە'}</span>
                </button>

                {hasFace && (
                  <button
                    type="button"
                    onClick={handleDeleteFace}
                    disabled={isDeletingFace}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeletingFace ? 'لە سڕینەوەدایە...' : 'سڕینەوەی دەموچاوی تۆمارکراوی ئەم کارمەندە'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: 📅 31-DAY ATTENDANCE MATRIX */}
      {activeTab === 'attendance' && (
        <div className="bg-white border-2 border-slate-300 p-5 space-y-4 shadow-sm animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-100 text-teal-800 flex items-center justify-center border border-teal-300">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">
                  خشتەی ئامادەبوون و کاتەکانی دەوام — {selectedEmployee.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">تەواوی وردەکاری هاتن و چوونەکان بە ڕەنگی سەوز</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 border border-slate-300">
              <Calendar className="w-4 h-4 text-blue-700" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono text-slate-900 outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[10px] text-emerald-800 font-black block">ڕۆژانی ئامادەبوو:</span>
              <span className="text-xl font-black font-mono text-emerald-700">{attendanceData.presentCount} ڕۆژ</span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 text-center">
              <span className="text-[10px] text-blue-800 font-black block">کۆی کاتژمێری ئیشکردن:</span>
              <span className="text-xl font-black font-mono text-blue-700">{attendanceData.totalWorkedHours} کاتژمێر</span>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 text-center">
              <span className="text-[10px] text-rose-800 font-black block">غیاب / نەهاتوو:</span>
              <span className="text-xl font-black font-mono text-rose-700">{attendanceData.absentCount} ڕۆژ</span>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 text-center">
              <span className="text-[10px] text-purple-800 font-black block">شێفتی فەرمی:</span>
              <span className="text-xl font-black font-mono text-purple-700">8:30 - 16:30</span>
            </div>
          </div>

          <div className="border border-slate-300 overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                  <th className="p-2 border-l border-slate-300 text-center w-12">ڕۆژ</th>
                  <th className="p-2 border-l border-slate-300 text-center w-28">بەروار</th>
                  <th className="p-2 border-l border-slate-300 text-center">هاتن (Check-In)</th>
                  <th className="p-2 border-l border-slate-300 text-center">ڕۆیشتن (Check-Out)</th>
                  <th className="p-2 border-l border-slate-300 text-center">ماوەی ئیشکردن</th>
                  <th className="p-2 text-center w-24">حاڵەت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {attendanceData.days.map((d) => {
                  return (
                    <tr 
                      key={d.dateStr}
                      className={`hover:bg-blue-50/50 ${
                        d.isToday ? 'bg-amber-50/70 font-black' : d.isFriday ? 'bg-emerald-50/40 text-teal-800' : ''
                      }`}
                    >
                      <td className="p-2 border-l border-slate-200 text-center font-mono">{d.dayNum}</td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono text-slate-600">
                        {d.dateStr} {d.isFriday ? '(هەینی)' : ''}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center">
                        {d.isPresent ? (
                          <span className="px-2.5 py-1 bg-emerald-600 text-white font-mono font-black text-xs shadow-2xs">
                            🟢 هاتن: {d.checkInTime || '08:30'}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center">
                        {d.isPresent ? (
                          <span className="px-2.5 py-1 bg-emerald-700 text-emerald-50 font-mono font-black text-xs shadow-2xs">
                            🏁 ڕۆیشتن: {d.checkOutTime || (d.isToday ? 'بەردەوام' : '16:30')}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="p-2 border-l border-slate-200 text-center font-mono">
                        {d.isPresent ? '٨ کاتژمێر' : d.isFriday ? 'پشوو' : '-'}
                      </td>
                      <td className="p-2 text-center">
                        {d.isFriday ? (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-900 border border-teal-300 text-[10px]">🌴 پشوو</span>
                        ) : d.isPresent ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px]">🟢 ئامادە</span>
                        ) : d.isFuture ? (
                          <span className="text-slate-300 text-[10px]">-</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 text-[10px]">🔴 غیاب</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 💰 FINANCIALS */}
      {activeTab === 'finance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
          <div className="bg-white border-2 border-slate-300 p-5 space-y-3 shadow-sm">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5 border-b pb-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>کاتی زیادە (Overtime Records)</span>
            </h3>
            <div className="p-3 bg-orange-50/70 border border-orange-200 text-center">
              <span className="text-xs text-orange-950 font-bold block">کۆی کاتی زیادەی ئەم کارمەندە:</span>
              <span className="text-xl font-black font-mono text-orange-700">0 کاتژمێر</span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold text-center">هیچ کاتێکی زیادەی زیادکراو تۆمار نەکراوە بۆ ئەم مانگە.</p>
          </div>

          <div className="bg-white border-2 border-slate-300 p-5 space-y-3 shadow-sm">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5 border-b pb-2">
              <Gift className="w-4 h-4 text-emerald-600" />
              <span>پاداشت و شایستەی دارایی (Bonuses)</span>
            </h3>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 text-center">
              <span className="text-xs text-emerald-950 font-bold block">کۆی پاداشتەکان:</span>
              <span className="text-xl font-black font-mono text-emerald-700">0 IQD</span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold text-center">هیچ پاداشتێک بۆ ئەم کارمەندە تۆمار نەکراوە.</p>
          </div>
        </div>
      )}

      {/* 📸 CAMERA FACE ENROLLMENT MODAL */}
      {showFaceModal && (
        <AdminFaceEnrollModal
          employee={selectedEmployee}
          isOpen={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          onSuccess={() => {
            setShowFaceModal(false);
            setHasFace(true);
            toast({
              title: '🎉 سەرکەوتوو بوو',
              description: `ناسنامەی دەموچاوی (${selectedEmployee.name}) بە سەرکەوتوویی تۆمارکرا.`
            });
          }}
        />
      )}

    </div>
  );
}

export default withAuth(EmployeeDetailPage);
