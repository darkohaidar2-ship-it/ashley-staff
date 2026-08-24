'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Building2, 
  Calendar, 
  AlertTriangle,
  Radio,
  User,
  History,
  Sparkles,
  Smartphone,
  Check,
  RefreshCw,
  KeyRound,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  autonomousGeofenceManager, 
  getDistanceMeters, 
  sendLocalNotification, 
  type GeofenceRegion 
} from '@/lib/background-geofence';

const ASHLEY_DEFAULT_EMPLOYEES = [
  { id: 'emp-01', name: 'سه هەند مەریوان حەمەسەعید', fullName3Part: 'سه هەند مەریوان حەمەسەعید', role: 'Employee' },
  { id: 'emp-02', name: 'دارکۆ حەیدەر حسێن', fullName3Part: 'دارکۆ حەیدەر حسێن', role: 'Manager' },
  { id: 'emp-03', name: 'شادیار هوشیار', fullName3Part: 'شادیار هوشیار', role: 'Employee Supervisor' },
  { id: 'emp-04', name: 'هەڤاڵ حبیب حەمەڕەزا', fullName3Part: 'هەڤاڵ حبیب حەمەڕەزا', role: 'Transport Supervisor' },
  { id: 'emp-05', name: 'عیماد سەباح نوری', fullName3Part: 'عیماد سەباح نوری', role: 'Employee' },
  { id: 'emp-06', name: 'کامەران عومەر ڕووئوف', fullName3Part: 'کامەران عومەر ڕووئوف', role: 'Employee' },
  { id: 'emp-07', name: 'ڕابەر محەمەد مەحمود', fullName3Part: 'ڕابەر محەمەد مەحمود', role: 'Employee' },
  { id: 'emp-08', name: 'دانەر محەمەد باسام', fullName3Part: 'دانەر محەمەد باسام', role: 'Employee' },
  { id: 'emp-09', name: 'ڕێبین سەباح نوری', fullName3Part: 'ڕێبین سەباح نوری', role: 'Employee' },
  { id: 'emp-10', name: 'بەهرەمەند ڕزگار عزیز', fullName3Part: 'بەهرەمەند ڕزگار عزیز', role: 'Employee' },
  { id: 'emp-11', name: 'شادومان یادگار رحیم', fullName3Part: 'شادومان یادگار رحیم', role: 'Employee' },
  { id: 'emp-12', name: 'سەروەت قادر', fullName3Part: 'سەروەت قادر', role: 'Employee' },
];

export default function AutonomousMobileAppLight() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // 1. Profile & Permanent Device Binding State
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [boundEmployee, setBoundEmployee] = useState<{ id: string; name: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string; role?: string }>>(ASHLEY_DEFAULT_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. Secret 10-Second Long-Press Admin Reset Modal
  const [pressProgress, setPressProgress] = useState(0); // 0 to 100
  const [showAdminResetModal, setShowAdminResetModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminResetMsg, setAdminResetMsg] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // 3. Geofence & Live Location
  const [companyLocation, setCompanyLocation] = useState<GeofenceRegion>({
    id: 'main-company-location',
    name: 'کۆمپانیای ئاشڵی (Ashley Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 55,
  });

  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // Live Clock
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

  // Initial Load: Check if this phone is permanently bound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedProfile = localStorage.getItem('ashley_bound_employee_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.id) {
            setEmployeeProfile(parsed);
            setBoundEmployee(parsed);
          }
        }
      } catch {}
    }

    // Load full official employee list
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllEmployees(data.filter((e: any) => e.name && e.name !== 'Admin'));
        }
      })
      .catch(() => {});

    // Load company base location
    fetch('/api/attendance/location')
      .then(res => res.json())
      .then(data => {
        if (data?.locations && data.locations.length > 0) {
          setCompanyLocation({
            id: data.locations[0].id || 'main-loc',
            name: data.locations[0].name || 'کۆمپانیای ئاشڵی',
            lat: data.locations[0].lat,
            lng: data.locations[0].lng,
            radiusMeters: data.locations[0].radiusMeters || 55,
          });
        }
      })
      .catch(() => {});
  }, []);

  // 4. Remote Unbind Polling (Checks every 5 seconds if Admin unlinked this device)
  useEffect(() => {
    if (!employeeProfile?.id) return;

    const checkRemoteBinding = async () => {
      try {
        const devToken = localStorage.getItem('ashley_device_token') || '';
        const res = await fetch(`/api/attendance/device-status?userId=${employeeProfile.id}&deviceToken=${devToken}`);
        const data = await res.json();
        
        if (data && data.bound === false) {
          // Admin requested remote unbind!
          localStorage.removeItem('ashley_bound_employee_profile');
          localStorage.removeItem('ashley_bound_employee_id');
          setEmployeeProfile(null);
          setBoundEmployee(null);
          alert('⚠️ بەستنەوەی ئەم مۆبایلە لەلایەن بەڕێوەبەر (Admin)ـەوە هەڵوەشێنرایەوە.');
        }
      } catch {}
    };

    const interval = setInterval(checkRemoteBinding, 6000);
    return () => clearInterval(interval);
  }, [employeeProfile]);

  // Autonomous Geofencing Engine Listener
  useEffect(() => {
    if (!employeeProfile) {
      autonomousGeofenceManager.stop();
      return;
    }

    let devToken = localStorage.getItem('ashley_device_token');
    if (!devToken) {
      devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('ashley_device_token', devToken);
    }

    autonomousGeofenceManager.start({
      userId: employeeProfile.id,
      userName: employeeProfile.name,
      deviceToken: devToken,
      region: companyLocation,
      onStatusChange: (status) => {
        setIsInsideGeofence(status.isInside);
        setDistanceMeters(status.distance);
      },
    });

    return () => {
      autonomousGeofenceManager.stop();
    };
  }, [employeeProfile, companyLocation]);

  // Track GPS updates
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dist = getDistanceMeters(lat, lng, companyLocation.lat, companyLocation.lng);
        setDistanceMeters(dist);
        setIsInsideGeofence(dist <= companyLocation.radiusMeters + 30);
      },
      (err) => console.warn('GPS update:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(wId);
  }, [companyLocation]);

  // Load employee's own activity logs for today
  const refreshMyLogs = useCallback(() => {
    if (!employeeProfile) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      const rawLive = localStorage.getItem('ashley_live_checkins');
      const liveList = rawLive ? JSON.parse(rawLive) : [];
      const myLogs = liveList.filter(
        (l: any) =>
          (l.employeeId === employeeProfile.id || l.userId === employeeProfile.id) &&
          (l.date === today || (l.time && l.time.startsWith(today)))
      );
      setTodayLogs(myLogs);
    } catch {}
  }, [employeeProfile]);

  useEffect(() => {
    refreshMyLogs();
    window.addEventListener('ashley_attendance_updated', refreshMyLogs);
    return () => window.removeEventListener('ashley_attendance_updated', refreshMyLogs);
  }, [refreshMyLogs]);

  // Shift calculation
  const shiftStatus = useMemo(() => {
    const inLog = todayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('in') || (l.type || '').includes('هاتن'));
    const outLog = todayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('out') || (l.type || '').includes('دەرچوون'));

    return {
      checkInTime: inLog ? (inLog.time?.includes(' ') ? inLog.time.split(' ')[1].slice(0, 5) : inLog.time?.slice(0, 5)) : null,
      checkOutTime: outLog ? (outLog.time?.includes(' ') ? outLog.time.split(' ')[1].slice(0, 5) : outLog.time?.slice(0, 5)) : null,
    };
  }, [todayLogs]);

  // 1-Time Secure Login & Permanent Device Binding Handler
  const handleDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setAuthError('تکایە ناوی خۆت هەڵبژێرە');
      return;
    }

    // 🔒 Security Guard: Device already locked to someone else
    if (boundEmployee && boundEmployee.id !== selectedEmpId) {
      setAuthError(`⚠️ ئەم مۆبایلە پێشتر بە ناوی (${boundEmployee.name}) قوفڵ کراوە و ناتوانیت بۆ کارمەندێکی تر بەکاری بهێنیت.`);
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      let devToken = localStorage.getItem('ashley_device_token');
      if (!devToken) {
        devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('ashley_device_token', devToken);
      }

      await fetch('/api/attendance/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmpId, pin: pinInput.trim() || '1234', deviceToken: devToken }),
      });

      const targetEmp = allEmployees.find(e => e.id === selectedEmpId);
      const fullName = targetEmp?.fullName3Part || targetEmp?.name || 'کارمەند';

      const profile = {
        id: selectedEmpId,
        name: fullName,
        role: targetEmp?.role || 'کارمەند',
      };

      setEmployeeProfile(profile);
      setBoundEmployee(profile);

      // Permanently lock device to this employee
      localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profile));
      localStorage.setItem('ashley_bound_employee_id', selectedEmpId);

      sendLocalNotification('🎉 بەخێربێیت', `مۆبایلەکەت بە ناوی ${profile.name} بە سەرکەوتوویی بەسترایەوە.`);
    } catch (err: any) {
      setAuthError(err.message || 'هەڵەیەک ڕوویدا لە کاتی بەستنەوەی مۆبایل');
    } finally {
      setAuthLoading(false);
    }
  };

  // =========================================================================
  // SECRET 10-SECOND LOGO LONG-PRESS LOGIC
  // =========================================================================
  const startLongPress = () => {
    setPressProgress(0);
    const startTime = Date.now();
    const duration = 10000; // 10 seconds

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setPressProgress(pct);
    }, 100);

    longPressTimerRef.current = setTimeout(() => {
      clearInterval(progressIntervalRef.current);
      setPressProgress(100);
      setShowAdminResetModal(true);
      setAdminResetMsg(null);
    }, duration);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setPressProgress(0);
  };

  // Admin Manual Override / Reset from Secret Prompt
  const handleAdminReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim() === '12355321' || adminPinInput.trim() === '1234') {
      localStorage.removeItem('ashley_bound_employee_profile');
      localStorage.removeItem('ashley_bound_employee_id');
      setEmployeeProfile(null);
      setBoundEmployee(null);
      setShowAdminResetModal(false);
      setAdminPinInput('');
      alert('✅ بەستنەوەی مۆبایلەکە بە سەرکەوتوویی کرایەوە.');
    } else {
      setAdminResetMsg('کۆدی ئەدمین هەڵەیە');
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] w-full bg-slate-50 text-slate-900 font-sans flex flex-col justify-between select-none overflow-hidden touch-manipulation dir-rtl" dir="rtl">
      
      {/* ========================================================================= */}
      {/* VIEW 1: ONE-TIME CLEAN LIGHT LOGIN & BINDING SCREEN */}
      {/* ========================================================================= */}
      {!employeeProfile ? (
        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col justify-center px-6 py-6 space-y-5">
          
          {/* Ashley Logo with 10s Secret Touch Indicator */}
          <div className="text-center space-y-2 relative">
            <div 
              onMouseDown={startLongPress}
              onMouseUp={cancelLongPress}
              onTouchStart={startLongPress}
              onTouchEnd={cancelLongPress}
              className="w-20 h-20 mx-auto rounded-3xl overflow-hidden shadow-xl shadow-orange-500/20 border-2 border-orange-500/40 relative cursor-pointer active:scale-95 transition-transform"
            >
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover pointer-events-none" />
              
              {/* Live Long-press circle timer */}
              {pressProgress > 0 && (
                <div 
                  className="absolute inset-0 bg-orange-600/60 flex items-center justify-center text-white font-black text-xs font-mono"
                >
                  {Math.ceil((100 - pressProgress) / 10)}s
                </div>
              )}
            </div>
            
            <h1 className="text-xl font-black text-slate-900 tracking-tight">کۆمپانیای ئاشڵی</h1>
            <p className="text-xs text-slate-500 font-bold">سیستەمی دەوامی خۆکارانەی کارمەند</p>
          </div>

          <form onSubmit={handleDeviceBinding} className="space-y-3.5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
            <div className="space-y-1 text-right">
              <label className="text-xs font-black text-slate-800">ناوی کارمەند:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  setAuthError(null);
                }}
                required
                className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs text-slate-900 font-black focus:border-orange-500 focus:bg-white focus:outline-hidden transition-all"
              >
                <option value="" className="text-slate-500">-- ناوی خۆت هەڵبژێرە --</option>
                {allEmployees.map(emp => (
                  <option key={emp.id} value={emp.id} className="text-slate-900 font-bold">
                    {emp.fullName3Part || emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-right">
              <label className="text-xs font-black text-slate-800">پین کۆد (PIN):</label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base text-slate-900 font-mono font-black tracking-widest text-center focus:border-orange-500 focus:bg-white focus:outline-hidden transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-xs font-bold text-center leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !selectedEmpId}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-orange-500/30 cursor-pointer"
            >
              {authLoading ? 'لە پشکنیندایە...' : 'چوونەژوورەوە و بەستنەوەی مۆبایل'}
            </button>
          </form>

          <div className="text-[10px] text-slate-400 text-center font-bold">
            تەنها یەکجار تۆمار دەبێت و مۆبایلەکە بە ناوتەوە دەبەسترێتەوە
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: ULTRA-CLEAN LIGHT EMPLOYEE PERSONAL DASHBOARD (VIEW-ONLY) */
        /* ========================================================================= */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 space-y-4">
          
          {/* Top Elegant Light Header with Secret Long Press on Logo */}
          <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div 
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onTouchStart={startLongPress}
                onTouchEnd={cancelLongPress}
                className="w-11 h-11 rounded-xl overflow-hidden border border-orange-400 shadow-xs flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform"
                title="١٠ چرکە دەست لەسەر دابگرە بۆ ڕیستکردنی ئەدمین"
              >
                <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover pointer-events-none" />
                
                {/* Visual Ring Timer */}
                {pressProgress > 0 && (
                  <div className="absolute inset-0 bg-orange-600/70 flex items-center justify-center text-white font-black text-[10px] font-mono">
                    {Math.ceil((100 - pressProgress) / 10)}s
                  </div>
                )}
              </div>

              <div className="text-right">
                <h2 className="text-sm font-black text-slate-900">{employeeProfile.name}</h2>
                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>سیستەمی دەوام چالاکە</span>
                </div>
              </div>
            </div>

            <div className="text-left font-mono font-black text-xs text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200">
              {currentTimeStr}
            </div>
          </div>

          {/* Center Presence Radar Hero */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-5 text-center">
            
            {/* Glowing Presence Circle */}
            <div className="relative flex items-center justify-center">
              <div className={`w-44 h-44 rounded-full border-4 flex items-center justify-center transition-all duration-700 ${
                isInsideGeofence 
                  ? 'border-emerald-500 bg-emerald-50 shadow-2xl shadow-emerald-500/20 ring-8 ring-emerald-500/10' 
                  : 'border-slate-200 bg-white shadow-lg'
              }`}>
                <div className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all ${
                  isInsideGeofence ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <MapPin className={`w-10 h-10 ${isInsideGeofence ? 'animate-bounce text-white' : 'text-slate-400'}`} />
                  <span className="text-xs font-black font-mono mt-1">
                    {distanceMeters !== null ? `${distanceMeters}m` : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Title */}
            <div className="space-y-1.5">
              <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-black border ${
                isInsideGeofence
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                  : 'bg-slate-200/80 text-slate-700 border-slate-300'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isInsideGeofence ? 'bg-emerald-600 animate-ping' : 'bg-slate-500'}`} />
                <span>{isInsideGeofence ? '🟢 لەناو کۆمپانیایت (دەوامی فەرمی)' : '🔴 لە دەرەوەی کۆمپانیایت'}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold">
                لە کاتی گەیشتن و دەرچوون خۆکارانە تۆمار دەکرێت
              </p>
            </div>
          </div>

          {/* Today's Activity Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 text-right space-y-1 shadow-sm">
              <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>کاتی هاتن:</span>
              </div>
              <div className="text-base font-black font-mono text-emerald-600">
                {shiftStatus.checkInTime || 'چاوەڕوانە...'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 text-right space-y-1 shadow-sm">
              <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>کاتی ڕۆیشتن:</span>
              </div>
              <div className="text-base font-black font-mono text-sky-600">
                {shiftStatus.checkOutTime || (shiftStatus.checkInTime ? 'لە دەوامدایە 🟢' : '--:--')}
              </div>
            </div>
          </div>

          {/* Bottom Clean Footer */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
            <span>🔒 پارێزراوە بۆ ئەم مۆبایلە</span>
            <span>Ashley Autonomous ERP</span>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 SECRET ADMIN OVERRIDE MODAL (Triggered by 10s Long-Press on Logo) */}
      {/* ========================================================================= */}
      {showAdminResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">ڕیستکردنی نهێنی ئەدمین</h3>
              <p className="text-xs text-slate-500 font-bold">کۆدی نهێنی لێبدە بۆ هەڵوەشاندنەوەی ئەم مۆبایلە</p>
            </div>

            <form onSubmit={handleAdminReset} className="space-y-3">
              <input
                type="password"
                placeholder="کۆدی ئەدمین"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-mono font-bold text-sm text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />

              {adminResetMsg && (
                <div className="text-xs text-rose-500 font-bold">{adminResetMsg}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminResetModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30"
                >
                  ڕیستکردن 🔓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
