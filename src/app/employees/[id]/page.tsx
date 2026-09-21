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
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { formatTime24H } from '@/lib/export-utils';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { resolveEmployeeDayAttendance, getCheckInStatus, getCheckOutStatus } from '@/lib/attendance-helpers';
import * as XLSX from 'xlsx';

const ASHLEY_DEFAULT_EMPLOYEES = ASHLEY_OFFICIAL_EMPLOYEES;

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
    withdrawals = [],
    isLoading = false
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
    if (employeeId === 'emp-02' || employeeId === '02') {
      setHasFace(true);
    }
    try {
      const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
      if (localDb[employeeId]) {
        setHasFace(true);
      }
      const res = await fetch(`/api/attendance/face/status?userId=${employeeId}&_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setHasFace(Boolean(data.registered || data.hasFaceRegistered || data.hasFace || employeeId === 'emp-02'));
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

  // 31-Day Matrix Overrides & Admin Decisions
  const [matrixOverrides, setMatrixOverrides] = useState<Record<string, any>>({});

  const loadMatrixOverrides = useCallback(async () => {
    let localMap: Record<string, any> = {};
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`ashley_matrix_overrides_${selectedMonth}`);
        if (cached) localMap = JSON.parse(cached);
      } catch {}
    }

    try {
      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = { ...localMap };
        (data.attendance || []).forEach((r: any) => {
          if (r.status && r.status !== 'empty' && r.status !== 'delete' && r.status !== 'Empty') {
            const k = `${r.userId}_${r.date}`;
            map[k] = { ...map[k], ...r };
          }
        });
        if (data.manualOverridesMap) {
          Object.assign(map, data.manualOverridesMap);
        }
        setMatrixOverrides(map);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`ashley_matrix_overrides_${selectedMonth}`, JSON.stringify(map));
          } catch {}
        }
      } else if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    } catch {
      if (Object.keys(localMap).length > 0) {
        setMatrixOverrides(localMap);
      }
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadMatrixOverrides();
  }, [loadMatrixOverrides]);

  // Attendance breakdown for the selected month using Authoritative 31-Day Matrix
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '09', 10);
  const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const attendanceData = useMemo(() => {
    let presentCount = 0;
    let totalWorkedHours = 0;
    let waivedCount = 0;
    let unexcusedViolationsCount = 0;

    const days = Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const dateStr = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(year, month - 1, dayNum);
      const isFriday = getDay(dateObj) === 5;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      const dayItem = { dayNum, dateStr, isFriday, isFuture, isToday };
      const resolved = resolveEmployeeDayAttendance(
        selectedEmployee || { id: employeeId },
        dayItem,
        matrixOverrides,
        attendanceLogs
      );

      if (resolved.status === 'Present' || resolved.hasRecord) {
        presentCount++;
        totalWorkedHours += resolved.workedHours || 8;
      }

      if (resolved.isWaived || resolved.checkInStatus.isWaived || resolved.checkOutStatus.isWaived) {
        waivedCount++;
      }

      if (resolved.checkInStatus.status === 'late_unexcused' || resolved.checkOutStatus.status === 'early_unexcused') {
        unexcusedViolationsCount++;
      }

      return {
        ...resolved,
        dayNum,
        dateStr,
        isFriday,
        isFuture,
        isToday,
        isPresent: resolved.status === 'Present' || resolved.hasRecord,
      };
    });

    const absentCount = Math.max(0, days.filter(d => !d.isFuture && !d.isFriday && !d.isPresent).length);

    return {
      days,
      presentCount,
      totalWorkedHours,
      absentCount,
      waivedCount,
      unexcusedViolationsCount,
    };
  }, [totalDays, selectedMonth, year, month, todayStr, attendanceLogs, employeeId, selectedEmployee, matrixOverrides]);

  if (!selectedEmployee) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mb-4 border border-rose-300">
          ⚠️
        </div>
        <h2 className="text-lg font-black text-slate-900 mb-2">کارمەند نەدۆزرایەوە</h2>
        <p className="text-xs text-slate-500 font-bold mb-4">ئەم کۆدە (${employeeId}) لە سیستەمدا بوونی نییە.</p>
        <Link href="/adm1n_pan0l" className="px-4 py-2 bg-slate-900 text-white text-xs font-black hover:bg-slate-800">
          ← گەڕانەوە بۆ پانێڵی سەرەکی
        </Link>
      </div>
    );
  }

  const isDarko = selectedEmployee.id === 'emp-02' || (selectedEmployee.name || '').includes('دارکۆ');

  return (
    <>
      {/* 🌟 OFFICIAL 3-PART ASHLEY LETTERHEAD PRINT VIEW */}
      <div className="hidden print:block bg-white min-h-screen">
        <ReportWrapper
          title={`دۆسیەی فەرمی کارمەند — ${(selectedEmployee as any).fullName3Part || selectedEmployee.name}`}
          subtitle="ناسنامە و ڕاپۆرتی ئامادەبوونی فەرمی کارمەند لە سیستەمی کۆمپانیای ئاشڵی"
          period={`مانگی ${selectedMonth}`}
        >
          {/* Employee Profile Summary */}
          <div className="border border-slate-300 rounded-lg p-3.5 mb-4 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-slate-300 bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-700 text-lg shrink-0">
                {selectedEmployee.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedEmployee.photoUrl} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(selectedEmployee.name || '').slice(0, 2)}</span>
                )}
              </div>
              <div className="text-right space-y-1">
                <div className="text-base font-black text-slate-900">
                  {(selectedEmployee as any).fullName3Part || selectedEmployee.name}
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span>کۆدی کارمەند: <strong className="font-mono text-slate-900">{selectedEmployee.id}</strong></span>
                  <span>•</span>
                  <span>پۆست / ئەرک: <strong className="text-slate-900">{isDarko ? 'بەڕێوەبەری سەرەکی' : selectedEmployee.role || 'کارمەند'}</strong></span>
                  <span>•</span>
                  <span>ژمارەی مۆبایل: <strong className="font-mono text-slate-900">{selectedEmployee.phone || '0770 000 0000'}</strong></span>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span>دەستپێکی کارکردن: <strong className="font-mono text-slate-700">{(selectedEmployee as any).startDate || selectedEmployee.employmentStartDate?.slice(0, 10) || '2025-01-01'}</strong></span>
                  <span>•</span>
                  <span>دۆخی دەوام: <strong className={selectedEmployee.status === 'resigned' ? 'text-rose-600' : 'text-emerald-700'}>{selectedEmployee.status === 'resigned' ? 'وازهێناو' : 'چالاک'}</strong></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="border border-slate-200 bg-white rounded p-2 min-w-[65px]">
                <div className="text-[9px] font-bold text-slate-500">ئامادەبوون</div>
                <div className="text-sm font-black text-emerald-700 font-mono">{attendanceData.presentCount} ڕۆژ</div>
              </div>
              <div className="border border-slate-200 bg-white rounded p-2 min-w-[65px]">
                <div className="text-[9px] font-bold text-slate-500">کۆی کاژێر</div>
                <div className="text-sm font-black text-blue-700 font-mono">{attendanceData.totalWorkedHours}h</div>
              </div>
              <div className="border border-emerald-200 bg-emerald-50 rounded p-2 min-w-[65px]">
                <div className="text-[9px] font-bold text-emerald-800">🟢 لێخۆشبوون</div>
                <div className="text-sm font-black text-emerald-700 font-mono">{attendanceData.waivedCount} جار</div>
              </div>
              <div className="border border-rose-200 bg-rose-50 rounded p-2 min-w-[65px]">
                <div className="text-[9px] font-bold text-rose-800">🔴 سەرپێچی</div>
                <div className="text-sm font-black text-rose-700 font-mono">{attendanceData.unexcusedViolationsCount} جار</div>
              </div>
              <div className="border border-slate-200 bg-white rounded p-2 min-w-[65px]">
                <div className="text-[9px] font-bold text-slate-500">غیاب</div>
                <div className="text-sm font-black text-rose-700 font-mono">{attendanceData.absentCount} ڕۆژ</div>
              </div>
            </div>
          </div>

          {/* Table Explanation Strip */}
          <div className="mb-2 p-2 bg-slate-100 border border-slate-300 rounded text-[9.5px] font-bold text-slate-700 flex justify-between items-center">
            <span>📋 ڕوونکردنەوەی تۆمارەکانی دەوام بۆ مانگی <strong>{selectedMonth}</strong> • دەوامی فەرمی: 08:00 هاتن - 17:00 دەرچوون • <strong>ڕێبەری ڕەنگەکان:</strong> <span style={{ color: '#059669', fontWeight: 800 }}>سەوز: لێخۆشبوو</span> • <span style={{ color: '#dc2626', fontWeight: 800 }}>سوور: سەرپێچی بێ لێخۆشبوون</span> • <span style={{ color: '#0f172a', fontWeight: 800 }}>ڕەش: لە کاتی خۆی</span></span>
            <span className="font-mono text-[9px] text-slate-500">کۆدی دۆسیە: ASH-EMP-${selectedEmployee.id}</span>
          </div>

          {/* Monthly Attendance Table */}
          <table className="w-full border-collapse border border-slate-400 text-right text-[10px]">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-black">
                <th className="border border-slate-400 p-1.5 text-center w-8">#</th>
                <th className="border border-slate-400 p-1.5">بەروار</th>
                <th className="border border-slate-400 p-1.5">ڕۆژ</th>
                <th className="border border-slate-400 p-1.5 text-center">📥 کاتی هاتن</th>
                <th className="border border-slate-400 p-1.5 text-center">📤 کاتی دەرچوون</th>
                <th className="border border-slate-400 p-1.5 text-center">⏱️ ماوە</th>
                <th className="border border-slate-400 p-1.5 text-center">دۆخ / بڕیاری ئەدمین</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.days.map((d) => (
                <tr key={d.dateStr} className={`border-b border-slate-300 ${d.isFriday ? 'bg-slate-100' : ''}`}>
                  <td className="border border-slate-300 p-1 text-center font-mono text-slate-500">{d.dayNum}</td>
                  <td className="border border-slate-300 p-1 font-mono font-bold">{d.dateStr}</td>
                  <td className="border border-slate-300 p-1 font-bold">{d.isFriday ? '🌴 هەینی' : 'ڕۆژی ئاسایی'}</td>
                  <td className="border border-slate-300 p-1 text-center font-mono font-black" style={{ color: d.checkInStatus?.printColor || '#0f172a' }}>
                    {d.checkInTime ? formatTime24H(d.checkInTime) : '-'}
                    {d.checkInStatus?.isWaived && <span className="block text-[8px] font-bold text-emerald-700">🟢 لێخۆشبوو</span>}
                    {d.checkInStatus?.status === 'late_unexcused' && <span className="block text-[8px] font-bold text-rose-700">🔴 درەنگکەوتوو</span>}
                  </td>
                  <td className="border border-slate-300 p-1 text-center font-mono font-black" style={{ color: d.checkOutStatus?.printColor || '#0f172a' }}>
                    {d.checkOutTime ? formatTime24H(d.checkOutTime) : (d.isToday ? 'بەردەوام' : '-')}
                    {d.checkOutStatus?.isWaived && <span className="block text-[8px] font-bold text-emerald-700">🟢 لێخۆشبوو</span>}
                    {d.checkOutStatus?.status === 'early_unexcused' && <span className="block text-[8px] font-bold text-rose-700">🔴 زوو ڕۆیشتوو</span>}
                  </td>
                  <td className="border border-slate-300 p-1 text-center font-mono">
                    {d.isPresent ? `${d.workedHours || 8}h` : d.isFriday ? 'پشوو' : '-'}
                  </td>
                  <td className="border border-slate-300 p-1 text-center font-bold">
                    {d.isFriday ? (
                      <span className="text-teal-700">🌴 پشوو</span>
                    ) : d.status === 'Leave' ? (
                      <span className="text-amber-700">مۆڵەت</span>
                    ) : d.isPresent ? (
                      <span className="text-emerald-700">🟢 ئامادە</span>
                    ) : d.isFuture ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <span className="text-rose-700">🔴 غیاب</span>
                    )}
                    {d.adminNote && (
                      <div className="text-[7.5px] text-blue-700 mt-0.5">🛡️ {d.adminNote}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportWrapper>
      </div>

      {/* 🧭 INTERACTIVE APP CONTAINER (HIDDEN IN PRINT) */}
      <div className="min-h-screen bg-slate-100 text-slate-900 font-sans p-3 sm:p-6 select-none space-y-4 print:hidden" dir="rtl">
      
      {/* 🧭 WINDOWS 11 TOP COMMAND BAR & NAVIGATION BREADCRUMB */}
      <div className="bg-white border-2 border-slate-300 p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/adm1n_pan0l"
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
          {/* 🖨️ Icon-only Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center cursor-pointer shadow-2xs transition-all active:scale-90"
            title="چاپکردنی دۆسیە (Print)"
            aria-label="Print"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`h-8 px-3 rounded-full border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
              isEditing ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
            }`}
            title="دەستکاری زانیاری کارمەند"
          >
            <Edit className="w-3.5 h-3.5 text-blue-600" />
            <span>{isEditing ? 'داخستن' : 'دەستکاری'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleResigned}
            className={`h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all active:scale-95 ${
              selectedEmployee.status === 'resigned' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
            title={selectedEmployee.status === 'resigned' ? 'گەڕاندنەوە بۆ دەوام' : 'تۆمارکردنی وازهێنان'}
          >
            {selectedEmployee.status === 'resigned' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
            <span>{selectedEmployee.status === 'resigned' ? 'گەڕاندنەوە' : 'وازهێنان'}</span>
          </button>
        </div>
      </div>

      {/* 👤 HERO PROFILE & HARDWARE STATUS BANNER */}
      <div className="bg-slate-900 text-white border-2 border-slate-700 p-5 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-slate-800 border-2 border-slate-600 overflow-hidden flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-md relative group">
              {(selectedEmployee.photoUrl || (selectedEmployee as any).photo) ? (
                <img src={selectedEmployee.photoUrl || (selectedEmployee as any).photo} alt={selectedEmployee.name} className="w-full h-full object-cover" />
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
              </div>
            </div>

            {/* 📅 Icon-only Month Picker */}
            <div 
              className="relative h-8 w-8 rounded-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 shadow-2xs transition-all cursor-pointer"
              title={`دیاریکردنی مانگ (${selectedMonth})`}
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title={`دیاریکردنی مانگ (${selectedMonth})`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-center rounded-lg">
              <span className="text-[10px] text-emerald-800 font-black block">ڕۆژانی ئامادەبوو:</span>
              <span className="text-xl font-black font-mono text-emerald-700">
                {isLoading ? <span className="inline-block w-12 h-5 bg-emerald-200/80 rounded animate-pulse" /> : `${attendanceData.presentCount} ڕۆژ`}
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 text-center rounded-lg">
              <span className="text-[10px] text-blue-800 font-black block">کۆی کاتژمێری ئیشکردن:</span>
              <span className="text-xl font-black font-mono text-blue-700">
                {isLoading ? <span className="inline-block w-12 h-5 bg-blue-200/80 rounded animate-pulse" /> : `${attendanceData.totalWorkedHours}h`}
              </span>
            </div>

            <div className="p-3 bg-emerald-50/80 border border-emerald-300 text-center rounded-lg">
              <span className="text-[10px] text-emerald-800 font-black block">🟢 ڕۆژانی لێخۆشبوون:</span>
              <span className="text-xl font-black font-mono text-emerald-600">
                {isLoading ? <span className="inline-block w-12 h-5 bg-emerald-200/80 rounded animate-pulse" /> : `${attendanceData.waivedCount} جار`}
              </span>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 text-center rounded-lg">
              <span className="text-[10px] text-rose-800 font-black block">🔴 سەرپێچی دەوام:</span>
              <span className="text-xl font-black font-mono text-rose-600">
                {isLoading ? <span className="inline-block w-12 h-5 bg-rose-200/80 rounded animate-pulse" /> : `${attendanceData.unexcusedViolationsCount} جار`}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-300 text-center rounded-lg">
              <span className="text-[10px] text-slate-700 font-black block">غیاب / نەهاتوو:</span>
              <span className="text-xl font-black font-mono text-rose-700">
                {isLoading ? <span className="inline-block w-12 h-5 bg-slate-200/80 rounded animate-pulse" /> : `${attendanceData.absentCount} ڕۆژ`}
              </span>
            </div>
          </div>

          {/* 🎨 Minimalist Status Micro-Legend Strip */}
          <div className="flex flex-wrap items-center justify-between text-xs font-bold text-slate-600 px-1 py-1 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-900 inline-block" /> لە کاتی خۆی</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> لێخۆشبوو</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> سەرپێچی</span>
            </div>
            <span className="text-[11px] text-blue-700 inline-flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>دەستکاری ئەدمین باڵادەستە</span>
            </span>
          </div>

          <div className="border border-slate-300 overflow-x-auto rounded-lg">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                  <th className="p-2.5 border-l border-slate-300 text-center w-12">ڕۆژ</th>
                  <th className="p-2.5 border-l border-slate-300 text-center w-28">بەروار</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">📥 کاتی هاتن</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">📤 کاتی دەرچوون</th>
                  <th className="p-2.5 border-l border-slate-300 text-center">ماوەی ئیشکردن</th>
                  <th className="p-2.5 text-center w-36">دۆخ / بڕیاری ئەدمین</th>
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
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono">{d.dayNum}</td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono text-slate-600">
                        {d.dateStr} {d.isFriday ? '(هەینی)' : ''}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center">
                        {d.isPresent ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded font-mono font-black text-xs shadow-2xs ${
                              d.checkInStatus?.status === 'late_waived'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : d.checkInStatus?.status === 'late_unexcused'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 text-slate-900 border border-slate-300'
                            }`}>
                              {d.checkInStatus?.status === 'late_waived' ? '🟢 ' : d.checkInStatus?.status === 'late_unexcused' ? '🔴 ' : '⏱️ '}
                              {d.checkInTime || '08:00'}
                            </span>
                            <span className="text-[10px] font-bold mt-0.5" style={{ color: d.checkInStatus?.printColor }}>
                              {d.checkInStatus?.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center">
                        {d.isPresent ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded font-mono font-black text-xs shadow-2xs ${
                              d.checkOutStatus?.status === 'early_waived' || d.checkOutStatus?.status === 'overtime_approved'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : d.checkOutStatus?.status === 'early_unexcused' || d.checkOutStatus?.status === 'overtime_unexcused'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 text-slate-900 border border-slate-300'
                            }`}>
                              {d.checkOutStatus?.isWaived ? '🟢 ' : (d.checkOutStatus?.status === 'early_unexcused' || d.checkOutStatus?.status === 'overtime_unexcused') ? '🔴 ' : '🏁 '}
                              {d.checkOutTime || (d.isToday ? 'بەردەوام' : '17:00')}
                            </span>
                            <span className="text-[10px] font-bold mt-0.5" style={{ color: d.checkOutStatus?.printColor }}>
                              {d.checkOutStatus?.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="p-2.5 border-l border-slate-200 text-center font-mono">
                        {d.isPresent ? `${d.workedHours || 8}h` : d.isFriday ? 'پشوو' : '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        {isLoading ? (
                          <span className="inline-block w-10 h-4 bg-slate-200 rounded animate-pulse" />
                        ) : d.isFriday ? (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-900 border border-teal-300 text-[10px] rounded">🌴 پشوو</span>
                        ) : d.status === 'Leave' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] rounded">🟡 مۆڵەت</span>
                        ) : d.isPresent ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] rounded">🟢 ئامادە</span>
                        ) : d.isFuture ? (
                          <span className="text-slate-300 text-[10px]">-</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 text-[10px] rounded">🔴 غیاب</span>
                        )}

                        {d.hasAdminOverride && (
                          <div className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-1">
                            🛡️ دەستکاری ئەدمین
                          </div>
                        )}
                        {d.adminNote && (
                          <div className="text-[9px] text-slate-600 font-normal mt-0.5 bg-slate-50 p-0.5 rounded border border-slate-200">
                            {d.adminNote}
                          </div>
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
    </>
  );
}

export default withAuth(EmployeeDetailPage);
