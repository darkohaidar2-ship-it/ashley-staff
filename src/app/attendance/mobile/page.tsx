'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Calendar, 
  RefreshCw, 
  KeyRound, 
  DoorOpen, 
  LogOut, 
  ChevronDown 
} from 'lucide-react';
import { format } from 'date-fns';
import { getDistanceMeters, sendLocalNotification, type GeofenceRegion } from '@/lib/background-geofence';

// Default Employees Fallback
const ASHLEY_DEFAULT_EMPLOYEES = [
  { id: 'emp-01', name: 'سه هەند مەریوان حەمەسەعید', role: 'Employee', pin: '1001' },
  { id: 'emp-02', name: 'دارکۆ حەیدەر حسێن', role: 'Manager', pin: '1002' },
  { id: 'emp-03', name: 'شادیار هوشیار', role: 'Employee Supervisor', pin: '1003' },
  { id: 'emp-04', name: 'هەڤاڵ حبیب حەمەڕەزا', role: 'Transport Supervisor', pin: '1004' },
  { id: 'emp-05', name: 'عیماد سەباح نوری', role: 'Employee', pin: '1005' },
  { id: 'emp-06', name: 'کامەران عومەر ڕووئوف', role: 'Employee', pin: '1006' },
  { id: 'emp-07', name: 'ڕابەر محەمەد مەحمود', role: 'Employee', pin: '1007' },
  { id: 'emp-08', name: 'دانەر محەمەد باسام', role: 'Employee', pin: '1008' },
  { id: 'emp-09', name: 'ڕێبین سەباح نوری', role: 'Employee', pin: '1009' },
  { id: 'emp-10', name: 'بەهرەمەند ڕزگار عزیز', role: 'Employee', pin: '1010' },
  { id: 'emp-11', name: 'شادومان یادگار رحیم', role: 'Employee', pin: '1011' },
  { id: 'emp-12', name: 'سەروەت قادر', role: 'Employee', pin: '1012' },
];

// Factory & Warehouse Geofence Regions
const COMPANY_LOCATIONS: GeofenceRegion[] = [
  {
    id: 'ashley-base-main',
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
    lat: 35.508918,
    lng: 45.452935,
    radiusMeters: 350,
  },
  {
    id: 'huana-warehouse-loc',
    name: 'کۆگای سەرەکی هوانە (Huana Warehouse)',
    lat: 35.562431,
    lng: 45.474792,
    radiusMeters: 350,
  },
];

export default function MobileAttendanceOneTap() {
  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Employee Profile & Device Binding
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState(ASHLEY_DEFAULT_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // GPS Geofence State
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true); // Default true to prevent false blocking
  const [matchedLocationName, setMatchedLocationName] = useState<string>('کۆمپانیای سەرەکی ئاشڵی');

  // Today's Live Shift State
  const [liveTodayShift, setLiveTodayShift] = useState<{
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string | null;
    warehouseName: string | null;
  }>({
    checkInTime: null,
    checkOutTime: null,
    status: null,
    warehouseName: null,
  });

  // Shift Duration Counter
  const [workedMinutes, setWorkedMinutes] = useState<number>(0);
  const [triggerLoading, setTriggerLoading] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Monthly Attendance Records for this employee
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Logout / Unbind Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPin, setLogoutPin] = useState('');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // 1. Clock Tick
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(format(now, 'HH:mm:ss'));
      setCurrentDateStr(format(now, 'yyyy-MM-dd'));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Load bound employee profile from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ashley_bound_employee_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setEmployeeProfile(parsed);
        }
      }
    } catch {}

    // Fetch live employees list
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllEmployees(data.filter((e: any) => e.name && e.name !== 'Admin'));
        }
      })
      .catch(() => {});
  }, []);

  // 3. Audio Chime Helper
  const playSoundChime = (success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  };

  // 4. GPS Geolocation Tracking
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);

        let minDistance = Infinity;
        let insideAny = false;
        let matchedName = COMPANY_LOCATIONS[0].name;

        for (const loc of COMPANY_LOCATIONS) {
          const dist = getDistanceMeters(lat, lng, loc.lat, loc.lng);
          if (dist < minDistance) {
            minDistance = dist;
            matchedName = loc.name;
          }
          if (dist <= loc.radiusMeters) {
            insideAny = true;
            matchedName = loc.name;
            break;
          }
        }

        setDistanceMeters(Math.round(minDistance));
        setIsInsideGeofence(insideAny || minDistance < 500); // 500m tolerance
        setMatchedLocationName(matchedName);
      },
      () => {
        // Fall back to safe true on indoor or restricted permissions
        setIsInsideGeofence(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 5. Fetch Live Today Shift Status from Server
  const fetchTodayShift = useCallback(async () => {
    if (!employeeProfile?.id) return;
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const storageKey = `ashley_shift_state_${todayIso}_${employeeProfile.id}`;

    try {
      const res = await fetch(`/api/attendance/today?userId=${employeeProfile.id}&userName=${encodeURIComponent(employeeProfile.name)}`);
      const data = await res.json();
      if (data) {
        setLiveTodayShift({
          checkInTime: data.checkInTime || null,
          checkOutTime: data.checkOutTime || null,
          status: data.status || (data.checkInTime ? 'Present' : null),
          warehouseName: data.warehouseName || matchedLocationName,
        });
        if (data.checkInTime) {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      }
    } catch {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        try { setLiveTodayShift(JSON.parse(cached)); } catch {}
      }
    }
  }, [employeeProfile, matchedLocationName]);

  // 6. Fetch monthly attendance history for this employee
  const fetchMonthlyHistory = useCallback(async () => {
    if (!employeeProfile?.id) return;
    setLoadingLogs(true);
    try {
      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = todayIso.slice(0, 7);
      const res = await fetch(`/api/attendance/logs?t=${Date.now()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const empLogs = data.filter((l: any) => {
          const lDate = l.date || (l.time ? l.time.split(' ')[0] : '');
          if (!lDate.startsWith(currentMonth)) return false;
          const lId = (l.employeeId || l.userId || '').toString().toLowerCase();
          const target = employeeProfile.id.toLowerCase();
          return lId === target || lId === target.replace('emp-', '');
        });
        setMonthlyLogs(empLogs.slice(0, 31));
      }
    } catch {}
    finally {
      setLoadingLogs(false);
    }
  }, [employeeProfile]);

  useEffect(() => {
    if (employeeProfile?.id) {
      fetchTodayShift();
      fetchMonthlyHistory();
      const interval = setInterval(fetchTodayShift, 10000);
      return () => clearInterval(interval);
    }
  }, [employeeProfile, fetchTodayShift, fetchMonthlyHistory]);

  // 7. Calculate elapsed work minutes if checked in
  useEffect(() => {
    if (!liveTodayShift.checkInTime) {
      setWorkedMinutes(0);
      return;
    }
    const calcDuration = () => {
      const [inH, inM] = liveTodayShift.checkInTime!.split(':').map(Number);
      const inTotal = inH * 60 + inM;
      if (liveTodayShift.checkOutTime) {
        const [outH, outM] = liveTodayShift.checkOutTime.split(':').map(Number);
        setWorkedMinutes(Math.max(0, (outH * 60 + outM) - inTotal));
      } else {
        const now = new Date();
        const nowTotal = now.getHours() * 60 + now.getMinutes();
        setWorkedMinutes(Math.max(0, nowTotal - inTotal));
      }
    };
    calcDuration();
    const interval = setInterval(calcDuration, 30000);
    return () => clearInterval(interval);
  }, [liveTodayShift]);

  // 8. Device Binding Handler (One-time PIN)
  const handleBindDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setAuthError('تکایە ناوی خۆت هەڵبژێرە');
      return;
    }
    if (!pinInput || pinInput.length < 4) {
      setAuthError('تکایە پین کۆدی ٤ ژمارەیی بنووسە');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    const emp = allEmployees.find(e => e.id === selectedEmpId);
    if (!emp) {
      setAuthError('کارمەند نەدۆزرایەوە');
      setAuthLoading(false);
      return;
    }

    const validPin = (emp as any).pin || (emp as any).password || '1001';
    if (pinInput.trim() !== validPin && pinInput.trim() !== '12355321') {
      setAuthError('❌ کۆدی نهێنی (PIN) هەڵەیە! تکایە کۆدی دروست بنووسە.');
      setAuthLoading(false);
      return;
    }

    const profileData = { id: emp.id, name: emp.name, role: emp.role || 'Employee' };
    localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profileData));
    setEmployeeProfile(profileData);
    setAuthLoading(false);
    playSoundChime(true);
    sendLocalNotification('🎉 بەخێربێیت', `مۆبایلەکەت بە ناوی (${emp.name}) بەستراوەتەوە.`);
  };

  // 9. Unbind / Logout Handler
  const handleLogout = (e: React.FormEvent) => {
    e.preventDefault();
    if (logoutPin.trim() === '12355321' || (employeeProfile && logoutPin.trim() === (allEmployees.find(e => e.id === employeeProfile.id) as any)?.pin)) {
      localStorage.removeItem('ashley_bound_employee_profile');
      setEmployeeProfile(null);
      setShowLogoutModal(false);
      setLogoutPin('');
      setLogoutError(null);
      playSoundChime(true);
    } else {
      setLogoutError('پاسۆردی بەڕێوەبەر یان پینی کارمەند هەڵەیە');
    }
  };

  // 10. THE HERO 1-TAP ATTENDANCE PUNCH (Check-In & Check-Out)
  const handleOneTapAttendance = async (action: 'ENTER' | 'EXIT') => {
    if (!employeeProfile?.id) return;

    setTriggerLoading(true);
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const nowTime = format(new Date(), 'HH:mm');

    try {
      let devToken = localStorage.getItem('ashley_device_token');
      if (!devToken) {
        devToken = 'dev-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('ashley_device_token', devToken);
      }

      const res = await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employeeProfile.id,
          userName: employeeProfile.name,
          deviceToken: devToken,
          event: action,
          lat: currentLat || 35.508918,
          lng: currentLng || 45.452935,
          distance: distanceMeters,
          regionName: matchedLocationName,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      const assignedTime = data.time || nowTime;

      if (action === 'ENTER') {
        const updatedShift = {
          checkInTime: assignedTime,
          checkOutTime: null,
          status: 'Present',
          warehouseName: data.location || matchedLocationName,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(`🎉 دەستخۆش! هاتنت لە کاتژمێر (${assignedTime}) بە سەرکەوتوویی تۆمارکرا.`);
      } else {
        const updatedShift = {
          checkInTime: liveTodayShift.checkInTime || '08:15',
          checkOutTime: assignedTime,
          status: 'Present',
          warehouseName: data.location || matchedLocationName,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(`👋 دەستخۆش و ماندوو نەبیت! ڕۆیشتنت لە کاتژمێر (${assignedTime}) تۆمارکرا.`);
      }

      playSoundChime(true);
      setTimeout(() => setFeedbackToast(null), 5000);
      await fetchTodayShift();
      await fetchMonthlyHistory();
    } catch (err: any) {
      alert('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setTriggerLoading(false);
    }
  };

  // Format Worked Hours
  const formattedWorkedHours = useMemo(() => {
    if (!workedMinutes || workedMinutes <= 0) return '٠ خولەک';
    const h = Math.floor(workedMinutes / 60);
    const m = workedMinutes % 60;
    if (h > 0 && m > 0) return `${h} کاتژمێر و ${m} خولەک`;
    if (h > 0) return `${h} کاتژمێر`;
    return `${m} خولەک`;
  }, [workedMinutes]);

  // ==========================================
  // VIEW 1: ONE-TIME BINDING SCREEN
  // ==========================================
  if (!employeeProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 dir-rtl select-none" dir="rtl">
        <div className="w-full max-w-sm bg-slate-900 border-2 border-slate-700 p-6 rounded-2xl shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden border-2 border-orange-500/50 shadow-lg shadow-orange-500/20 bg-black p-1">
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-base font-black text-white">سیستەمی دەوامی ئاشڵی</h1>
            <p className="text-xs text-slate-400">بەستنەوەی مۆبایل بە ناوی کارمەند (تەنها یەکجار)</p>
          </div>

          <form onSubmit={handleBindDevice} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">ناوی کارمەند:</label>
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  required
                  className="w-full bg-slate-800 border-2 border-slate-600 text-white text-xs font-bold p-3 rounded-xl focus:border-emerald-500 focus:outline-none appearance-none"
                >
                  <option value="">-- هەڵبژاردنی ناوەکەت --</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      👤 {emp.name} ({emp.role || 'کارمەند'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">پین کۆدی ٤ ژمارەیی (PIN):</label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="بۆ نموونە: 1002"
                  required
                  className="w-full bg-slate-800 border-2 border-slate-600 text-white text-center font-mono text-base font-bold p-3 rounded-xl tracking-widest focus:border-emerald-500 focus:outline-none"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-bold text-center">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3.5 rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>بەستنەوە و چوونەژوورەوە</span>
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-center text-slate-500">
            Ashley Furniture Industry • سلێمانی - هەولێر
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ULTRA-SIMPLE 1-TAP ATTENDANCE
  // ==========================================
  const isCheckedIn = Boolean(liveTodayShift.checkInTime && !liveTodayShift.checkOutTime);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col max-w-md mx-auto dir-rtl select-none pb-8" dir="rtl">
      
      {/* 🌟 TOP COMPACT HEADER */}
      <header className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center font-black text-orange-400 text-xs shadow-sm">
            {employeeProfile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xs font-black text-white leading-tight">{employeeProfile.name}</h2>
            <p className="text-[10px] text-emerald-400 font-bold">{employeeProfile.role || 'کارمەندی فەرمی'}</p>
          </div>
        </div>

        <button 
          onClick={() => setShowLogoutModal(true)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] flex items-center gap-1 font-bold cursor-pointer"
          title="ڕیستکردن یان دەرچوون"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>دەرچوون</span>
        </button>
      </header>

      <main className="p-4 space-y-4 flex-1">

        {/* 🕒 LIVE REAL-TIME CLOCK & DATE */}
        <div className="text-center p-4 bg-gradient-to-b from-slate-900 to-slate-900/60 border border-slate-800 rounded-2xl shadow-md">
          <p className="text-[11px] font-mono text-slate-400 font-bold mb-1">
            📅 {currentDateStr || '2026-09-06'}
          </p>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-amber-300 flex items-center justify-center gap-1.5">
            <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
            <span>{currentTimeStr || '08:30:00'}</span>
          </div>
        </div>

        {/* 📍 GPS GEOFENCE STATUS */}
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
          isInsideGeofence 
            ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200' 
            : 'bg-amber-950/50 border-amber-500/50 text-amber-200'
        }`}>
          <MapPin className={`w-5 h-5 flex-shrink-0 ${isInsideGeofence ? 'text-emerald-400' : 'text-amber-400'}`} />
          <div className="text-xs leading-tight">
            <p className="font-black">
              {isInsideGeofence 
                ? `🟢 تۆ لە ناو کارگەیت (${matchedLocationName})` 
                : `⚠️ لە دەرەوەی کارگەیت (${distanceMeters} مەتر دووریت)`}
            </p>
            <p className="text-[10px] opacity-80 mt-0.5">
              سیستەمی شوێنکەوتنی GPS کارگەی ئاشڵی
            </p>
          </div>
        </div>

        {/* 🔔 FEEDBACK TOAST */}
        {feedbackToast && (
          <div className="p-3 rounded-xl bg-emerald-600 text-white font-black text-xs text-center shadow-lg animate-bounce">
            {feedbackToast}
          </div>
        )}

        {/* ============================================================ */}
        {/* 🚀 THE HERO 1-TAP ATTENDANCE ACTION BUTTON */}
        {/* ============================================================ */}
        <div className="pt-2">
          {!liveTodayShift.checkInTime ? (
            /* STATE 1: NOT CHECKED IN YET -> BIG GREEN CHECK-IN BUTTON */
            <button
              onClick={() => handleOneTapAttendance('ENTER')}
              disabled={triggerLoading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white p-6 rounded-2xl shadow-xl shadow-emerald-950/60 border-2 border-emerald-400/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                {triggerLoading ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-9 h-9 text-white" />
                )}
              </div>
              <span className="text-lg font-black tracking-wide">
                🟢 تۆمارکردنی هاتن (Check In)
              </span>
              <span className="text-xs text-emerald-100 font-medium">
                کلیک بکە بۆ دەستپێکردنی دەوامی ئەمڕۆت
              </span>
            </button>
          ) : isCheckedIn ? (
            /* STATE 2: CURRENTLY AT WORK -> BIG RED CHECK-OUT BUTTON */
            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-950/60 border-2 border-emerald-500/50 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-emerald-400 block font-bold">کاتی دەستپێکردنی دەوام:</span>
                  <span className="font-mono text-base font-black text-emerald-300">
                    🟢 {liveTodayShift.checkInTime}
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-400 block font-bold">ماوەی کارکردن:</span>
                  <span className="text-xs font-black text-amber-300">
                    ⏱️ {formattedWorkedHours}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (confirm('ئایا دڵنیایت لە تەواوبوونی دەوام و تۆمارکردنی ڕۆیشتن؟')) {
                    handleOneTapAttendance('EXIT');
                  }
                }}
                disabled={triggerLoading}
                className="w-full bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 active:scale-98 text-white p-6 rounded-2xl shadow-xl shadow-rose-950/60 border-2 border-rose-400/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  {triggerLoading ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <DoorOpen className="w-9 h-9 text-white" />
                  )}
                </div>
                <span className="text-lg font-black tracking-wide">
                  🔴 تۆمارکردنی ڕۆیشتن (Check Out)
                </span>
                <span className="text-xs text-rose-100 font-medium">
                  کلیک بکە لە کاتی تەواوبوونی دەوام و چوونەدەرەوە
                </span>
              </button>
            </div>
          ) : (
            /* STATE 3: SHIFT COMPLETED TODAY */
            <div className="p-5 bg-gradient-to-b from-slate-900 to-slate-900/80 border-2 border-slate-700 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">دەوامی ئەمڕۆت تەواو بووە 🎉</h3>
                <p className="text-xs text-slate-400 mt-0.5">دەستخۆش و ماندوو نەبیت!</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-slate-950 rounded-xl font-mono text-xs border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">هاتن</span>
                  <span className="text-emerald-400 font-bold">{liveTodayShift.checkInTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">ڕۆیشتن</span>
                  <span className="text-rose-400 font-bold">{liveTodayShift.checkOutTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">کۆی کارکردن</span>
                  <span className="text-amber-300 font-bold">{formattedWorkedHours}</span>
                </div>
              </div>

              <button
                onClick={() => handleOneTapAttendance('EXIT')}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer pt-1 block mx-auto"
              >
                نوێکردنەوەی کاتی ڕۆیشتن
              </button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 📊 EMPLOYEE'S OWN MONTHLY ATTENDANCE LOG */}
        {/* ============================================================ */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>مێژووی دەوامی ئەم مانگەی تۆ</span>
            </h3>
            <button 
              onClick={fetchMonthlyHistory} 
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>نوێکردنەوە</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-800/80 text-slate-400 text-[10px] font-black border-b border-slate-800">
                <tr>
                  <th className="p-2.5">بەروار</th>
                  <th className="p-2.5 text-center">هاتن</th>
                  <th className="p-2.5 text-center">ڕۆیشتن</th>
                  <th className="p-2.5 text-center">دۆخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-bold font-mono text-[11px]">
                {monthlyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 font-sans">
                      تۆماری ئامادەبوون بۆ ئەم مانگە نییە.
                    </td>
                  </tr>
                ) : (
                  monthlyLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-slate-300">{log.date || log.time?.split(' ')[0]}</td>
                      <td className="p-2.5 text-center text-emerald-400 font-bold">
                        {log.checkInTime || log.check_in_time || '—'}
                      </td>
                      <td className="p-2.5 text-center text-rose-400 font-bold">
                        {log.checkOutTime || log.check_out_time || '—'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-600 text-emerald-300 font-sans">
                          ئامادەبوو
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* 🔒 UNBIND / LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 p-5 rounded-2xl max-w-xs w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">دەرچوون یان گۆڕینی مۆبایل</h4>
              <p className="text-xs text-slate-400 mt-1">تکایە پین کۆدی کارمەند یان پاسۆردی ئەدمین بنووسە:</p>
            </div>

            <form onSubmit={handleLogout} className="space-y-3">
              <input
                type="password"
                value={logoutPin}
                onChange={(e) => setLogoutPin(e.target.value)}
                placeholder="PIN"
                autoFocus
                className="w-full bg-slate-800 border-2 border-slate-600 text-white text-center font-mono text-base p-2.5 rounded-xl focus:border-rose-500 focus:outline-none"
              />
              {logoutError && <p className="text-xs text-rose-400 font-bold">{logoutError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                >
                  دەرچوون
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLogoutModal(false); setLogoutError(null); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
