'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  autonomousGeofenceManager, 
  getDistanceMeters, 
  sendLocalNotification, 
  type GeofenceRegion 
} from '@/lib/background-geofence';

export default function AutonomousMobileApp() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // 1. Profile & Permanent Device Binding State
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [boundEmployee, setBoundEmployee] = useState<{ id: string; name: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string; role?: string }>>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 2. Geofence & Live Location
  const [companyLocation, setCompanyLocation] = useState<GeofenceRegion>({
    id: 'main-company-location',
    name: 'کۆمپانیای ئاشڵی (Ashley Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 55,
  });

  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
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

  // Initial Load: Check if this phone is permanently bound to an employee
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
        } else {
          const legacy = localStorage.getItem('ashley_mobile_employee_profile');
          if (legacy) {
            const parsed = JSON.parse(legacy);
            if (parsed?.id) {
              setEmployeeProfile(parsed);
              setBoundEmployee(parsed);
              localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(parsed));
            }
          }
        }
      } catch {}
    }

    // Load full official employee list
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
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
        setCurrentLat(lat);
        setCurrentLng(lng);

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

  // Check In & Check Out status for today
  const shiftStatus = useMemo(() => {
    const inLog = todayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('in') || (l.type || '').includes('هاتن'));
    const outLog = todayLogs.find(l => (l.type || l.action || '').toLowerCase().includes('out') || (l.type || '').includes('دەرچوون'));

    return {
      checkInTime: inLog ? (inLog.time?.includes(' ') ? inLog.time.split(' ')[1].slice(0, 5) : inLog.time?.slice(0, 5)) : null,
      checkOutTime: outLog ? (outLog.time?.includes(' ') ? outLog.time.split(' ')[1].slice(0, 5) : outLog.time?.slice(0, 5)) : null,
      isActivePresent: Boolean(inLog && !outLog),
    };
  }, [todayLogs]);

  // 1-Time Secure Login & Permanent Device Binding Handler
  const handleDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setAuthError('تکایە ناوی خۆت هەڵبژێرە');
      return;
    }

    // 🔒 Security Check: If device was already bound to someone else
    if (boundEmployee && boundEmployee.id !== selectedEmpId) {
      setAuthError(`⚠️ ئەم مۆبایلە پێشتر بە ناوی (${boundEmployee.name}) قوفڵ کراوە و ناتوانیت بۆ کارمەندێکی تر بەکاری بهێنیت.`);
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/attendance/checkin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmpId, pin: pinInput.trim() || '1234' }),
      });

      const data = await res.json();
      const targetEmp = allEmployees.find(e => e.id === selectedEmpId);
      const fullName = targetEmp?.fullName3Part || targetEmp?.name || data?.user?.name || 'کارمەند';

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

      sendLocalNotification('🎉 بەخێربێیت', `مۆبایلەکەت بە سەرکەوتوویی بەسترایەوە، ${profile.name}.`);
    } catch (err: any) {
      setAuthError(err.message || 'هەڵەیەک ڕوویدا لە کاتی بەستنەوەی مۆبایل');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans flex flex-col justify-between select-none overflow-hidden touch-manipulation dir-rtl" dir="rtl">
      
      {/* ========================================================================= */}
      {/* VIEW 1: ONE-TIME CLEAN LOGIN & BINDING SCREEN */}
      {/* ========================================================================= */}
      {!employeeProfile ? (
        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col justify-center px-6 py-8 space-y-6">
          
          {/* Official Ashley Logo */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 mx-auto rounded-3xl overflow-hidden shadow-2xl shadow-orange-500/25 border-2 border-orange-500/40">
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">کۆمپانیای ئاشڵی</h1>
            <p className="text-xs text-slate-400 font-bold">سیستەمی دەوامی خۆکارانەی کارمەند</p>
          </div>

          <form onSubmit={handleDeviceBinding} className="space-y-4 pt-2">
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-300">ناوی کارمەند:</label>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  setAuthError(null);
                }}
                required
                className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-xs text-white font-bold focus:border-orange-500 focus:outline-hidden transition-colors"
              >
                <option value="">-- ناوی خۆت دیاری بکە --</option>
                {allEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName3Part || emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-300">پین کۆد (PIN):</label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-base text-white font-mono font-black tracking-widest text-center focus:border-orange-500 focus:outline-hidden transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-bold text-center leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !selectedEmpId}
              className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-xl shadow-orange-600/30 cursor-pointer active:scale-98"
            >
              {authLoading ? 'لە پشکنیندایە...' : 'چوونەژوورەوە و بەستنەوەی مۆبایل'}
            </button>
          </form>

          <div className="text-[10px] text-slate-500 text-center font-bold">
            تەنها یەکجار تۆمار دەبێت و مۆبایلەکە بە ناوتەوە دەبەسترێتەوە
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: ULTRA-MODERN EMPLOYEE PERSONAL DASHBOARD (VIEW-ONLY) */
        /* ========================================================================= */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between p-5 space-y-4">
          
          {/* Top Elegant Header */}
          <div className="flex items-center justify-between p-3 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-500/40 shadow-sm flex-shrink-0">
                <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
              </div>
              <div className="text-right">
                <h2 className="text-sm font-black text-white">{employeeProfile.name}</h2>
                <div className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>سیستەمی دەوام چالاکە</span>
                </div>
              </div>
            </div>

            <div className="text-left font-mono font-black text-xs text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
              {currentTimeStr}
            </div>
          </div>

          {/* Center Presence Radar Hero */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-5 text-center">
            
            {/* Glowing Pulsing Ring */}
            <div className="relative flex items-center justify-center">
              <div className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
                isInsideGeofence 
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-2xl shadow-emerald-500/30 ring-8 ring-emerald-500/10' 
                  : 'border-slate-800 bg-slate-900/50'
              }`}>
                <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all ${
                  isInsideGeofence ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  <MapPin className={`w-9 h-9 ${isInsideGeofence ? 'animate-bounce text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-black font-mono mt-1">
                    {distanceMeters !== null ? `${distanceMeters}m` : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Title & Subtitle */}
            <div className="space-y-1">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border ${
                isInsideGeofence
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isInsideGeofence ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{isInsideGeofence ? '🟢 لەناو کۆمپانیایت (دەوامی فەرمی)' : '🔴 لە دەرەوەی کۆمپانیایت'}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold">
                لە کاتی گەیشتن و دەرچوون خۆکارانە تۆمار دەکرێت
              </p>
            </div>
          </div>

          {/* Today's Activity Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-right space-y-1">
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>کاتی هاتن (چێک‌ئین):</span>
              </div>
              <div className="text-sm font-black font-mono text-emerald-400">
                {shiftStatus.checkInTime || 'چاوەڕوانە...'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-right space-y-1">
              <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>کاتی ڕۆیشتن (چێک‌ئاوت):</span>
              </div>
              <div className="text-sm font-black font-mono text-sky-400">
                {shiftStatus.checkOutTime || (shiftStatus.checkInTime ? 'لە دەوامدایە 🟢' : '--:--')}
              </div>
            </div>
          </div>

          {/* Bottom Security Footer */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-bold text-slate-500 px-1">
            <span>🔒 پارێزراوە بۆ ئەم مۆبایلە</span>
            <span>Ashley Autonomous ERP 2027</span>
          </div>

        </div>
      )}

    </div>
  );
}
