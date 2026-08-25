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
  X,
  ChevronDown,
  Search,
  Map,
  Compass,
  Link2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  autonomousGeofenceManager, 
  getDistanceMeters, 
  sendLocalNotification, 
  type GeofenceRegion 
} from '@/lib/background-geofence';
import { MobileAttendanceMapModal } from '@/components/maps/MobileAttendanceMapModal';

const ASHLEY_DEFAULT_EMPLOYEES = [
  { id: 'emp-01', name: 'سه هەند مەریوان حەمەسەعید', fullName3Part: 'سه هەند مەریوان حەمەسەعید', role: 'Employee', pin: '1001', deviceBound: false },
  { id: 'emp-02', name: 'دارکۆ حەیدەر حسێن', fullName3Part: 'دارکۆ حەیدەر حسێن', role: 'Manager', pin: '1002', deviceBound: false },
  { id: 'emp-03', name: 'شادیار هوشیار', fullName3Part: 'شادیار هوشیار', role: 'Employee Supervisor', pin: '1003', deviceBound: false },
  { id: 'emp-04', name: 'هەڤاڵ حبیب حەمەڕەزا', fullName3Part: 'هەڤاڵ حبیب حەمەڕەزا', role: 'Transport Supervisor', pin: '1004', deviceBound: false },
  { id: 'emp-05', name: 'عیماد سەباح نوری', fullName3Part: 'عیماد سەباح نوری', role: 'Employee', pin: '1005', deviceBound: false },
  { id: 'emp-06', name: 'کامەران عومەر ڕووئوف', fullName3Part: 'کامەران عومەر ڕووئوف', role: 'Employee', pin: '1006', deviceBound: false },
  { id: 'emp-07', name: 'ڕابەر محەمەد مەحمود', fullName3Part: 'ڕابەر محەمەد مەحمود', role: 'Employee', pin: '1007', deviceBound: false },
  { id: 'emp-08', name: 'دانەر محەمەد باسام', fullName3Part: 'دانەر محەمەد باسام', role: 'Employee', pin: '1008', deviceBound: false },
  { id: 'emp-09', name: 'ڕێبین سەباح نوری', fullName3Part: 'ڕێبین سەباح نوری', role: 'Employee', pin: '1009', deviceBound: false },
  { id: 'emp-10', name: 'بەهرەمەند ڕزگار عزیز', fullName3Part: 'بەهرەمەند ڕزگار عزیز', role: 'Employee', pin: '1010', deviceBound: false },
  { id: 'emp-11', name: 'شادومان یادگار رحیم', fullName3Part: 'شادومان یادگار رحیم', role: 'Employee', pin: '1011', deviceBound: false },
  { id: 'emp-12', name: 'سەروەت قادر', fullName3Part: 'سەروەت قادر', role: 'Employee', pin: '1012', deviceBound: false },
];

const DEFAULT_COMPANY_LOCATIONS: GeofenceRegion[] = [
  {
    id: 'ashley-base-main',
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 100,
  },
  {
    id: 'huana-warehouse-loc',
    name: 'کۆگای هوانە (Huana Warehouse)',
    lat: 35.6012,
    lng: 45.3850,
    radiusMeters: 120,
  },
];

export default function AutonomousMobileAppLight() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      if (typeof window !== 'undefined') {
        const isWide = window.innerWidth > 820;
        const isDesktopAgent = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsDesktop(isWide && isDesktopAgent);
      }
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 1. Profile & Permanent Device Binding State
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [boundEmployee, setBoundEmployee] = useState<{ id: string; name: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string; role?: string; pin?: string; deviceBound?: boolean }>>(ASHLEY_DEFAULT_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Custom Employee Picker Modal State
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // View-Only Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 2. Secret 10-Second Long-Press Admin Reset Modal
  const [pressProgress, setPressProgress] = useState(0); // 0 to 100
  const [showAdminResetModal, setShowAdminResetModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminResetMsg, setAdminResetMsg] = useState<string | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // 3. Geofence & Multiple Company Locations (Ashley + Huana)
  const [companyLocations, setCompanyLocations] = useState<GeofenceRegion[]>(DEFAULT_COMPANY_LOCATIONS);
  const [matchedLocationName, setMatchedLocationName] = useState<string>('کۆمپانیای سەرەکی ئاشڵی');
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

  // Initial Load: Check if this phone is permanently bound & fetch live website data
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

    // Load live employee list from website API
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllEmployees(data.filter((e: any) => e.name && e.name !== 'Admin'));
        }
      })
      .catch(() => {});

    // Load ALL company base locations dynamically from website API (Ashley Base, Huana) with 2s live polling
    const fetchCompanyLocations = () => {
      fetch(`/api/attendance/location?t=${Date.now()}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (data?.locations && data.locations.length > 0) {
            const valid = data.locations.filter(
              (l: any) => l.lat > 10 && l.lng > 10 && !l.name?.toLowerCase().includes('face') && !l.id?.includes('face')
            );
            if (valid.length > 0) {
              setCompanyLocations(prev => {
                const prevStr = JSON.stringify(prev);
                const newStr = JSON.stringify(valid);
                return prevStr !== newStr ? valid : prev;
              });
            }
          }
        })
        .catch(() => {});
    };

    fetchCompanyLocations();
    const locInterval = setInterval(fetchCompanyLocations, 2000);
    return () => clearInterval(locInterval);
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
          localStorage.removeItem('ashley_bound_employee_profile');
          localStorage.removeItem('ashley_bound_employee_id');
          localStorage.removeItem('ashley_device_token');
          setEmployeeProfile(null);
          setBoundEmployee(null);
          alert('⚠️ بەڕێوەبەر (ئەدمین) ئەم مۆبایلەی سڕییەوە، تکایە سەرلەنوێ خۆت تۆمار بکەرەوە.');
          window.location.reload();
        }
      } catch {}
    };

    const interval = setInterval(checkRemoteBinding, 5000);
    return () => clearInterval(interval);
  }, [employeeProfile]);

  // Track GPS updates continuously
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLat(pos.coords.latitude);
        setCurrentLng(pos.coords.longitude);
      },
      (err) => console.warn('GPS update:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );

    return () => navigator.geolocation.clearWatch(wId);
  }, []);

  // Reactive Live Presence calculations based on current GPS + live updated company locations
  const presence = useMemo(() => {
    if (currentLat === null || currentLng === null || companyLocations.length === 0) {
      return {
        distanceMeters: null,
        isInsideGeofence: false,
        matchedLocationName: companyLocations[0]?.name || 'کۆمپانیای سەرەکی ئاشڵی',
      };
    }

    let minD = Infinity;
    let isInsideAny = false;
    let matchedName = companyLocations[0]?.name || 'کۆمپانیای سەرەکی ئاشڵی';

    for (const loc of companyLocations) {
      const dist = getDistanceMeters(currentLat, currentLng, loc.lat, loc.lng);
      if (dist < minD) {
        minD = dist;
        matchedName = loc.name;
      }
      if (dist <= loc.radiusMeters + 35) {
        isInsideAny = true;
        matchedName = loc.name;
      }
    }

    return {
      distanceMeters: Math.round(minD),
      isInsideGeofence: isInsideAny,
      matchedLocationName: matchedName,
    };
  }, [currentLat, currentLng, companyLocations]);

  // Autonomous Geofencing Engine Listener across ALL company locations
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
      regions: companyLocations,
    });

    return () => {
      autonomousGeofenceManager.stop();
    };
  }, [employeeProfile, companyLocations]);

  const [liveTodayShift, setLiveTodayShift] = useState<{
    checkInTime: string | null;
    checkOutTime: string | null;
    status?: string | null;
    warehouseName?: string | null;
  }>({
    checkInTime: null,
    checkOutTime: null,
  });

  // Fetch live today attendance from server API every 4 seconds
  const fetchLiveTodayAttendance = useCallback(async () => {
    if (!employeeProfile?.id) return;
    try {
      const res = await fetch(`/api/attendance/today?userId=${employeeProfile.id}`);
      const data = await res.json();
      if (data) {
        setLiveTodayShift({
          checkInTime: data.checkInTime || null,
          checkOutTime: data.checkOutTime || null,
          status: data.status,
          warehouseName: data.warehouseName,
        });
      }
    } catch {}
  }, [employeeProfile]);

  useEffect(() => {
    fetchLiveTodayAttendance();
    const interval = setInterval(fetchLiveTodayAttendance, 4000);
    window.addEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    };
  }, [fetchLiveTodayAttendance]);

  // Shift calculation (100% Pure Live Server State from Supabase)
  const shiftStatus = useMemo(() => {
    const checkIn = liveTodayShift.checkInTime || null;
    const checkOut = liveTodayShift.checkOutTime || null;
    const warehouseName = liveTodayShift.warehouseName || null;

    return {
      checkInTime: checkIn ? (checkIn.includes(' ') ? checkIn.split(' ')[1].slice(0, 5) : checkIn.slice(0, 5)) : null,
      checkOutTime: checkOut ? (checkOut.includes(' ') ? checkOut.split(' ')[1].slice(0, 5) : checkOut.slice(0, 5)) : null,
      warehouseName,
    };
  }, [liveTodayShift]);

  // Selected Employee display label
  const selectedEmpObject = useMemo(() => {
    return allEmployees.find(e => e.id === selectedEmpId);
  }, [allEmployees, selectedEmpId]);

  // Filtered employees for custom picker search
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return allEmployees;
    const q = employeeSearchQuery.toLowerCase().trim();
    return allEmployees.filter(e => 
      (e.fullName3Part || e.name || '').toLowerCase().includes(q)
    );
  }, [allEmployees, employeeSearchQuery]);

  // 1-Time Secure Login & Permanent Device Binding Handler with Strict PIN Check
  const handleDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setAuthError('تکایە ناوی خۆت هەڵبژێرە');
      return;
    }

    if (!pinInput.trim()) {
      setAuthError('❌ داخڵکردنی پین کۆد (PIN) مەرجی سەرەکییە بۆ چوونەژوورەوە!');
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

      const res = await fetch('/api/attendance/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmpId, pin: pinInput.trim(), deviceToken: devToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '❌ کۆدی نهێنی (PIN) هەڵەیە! تکایە کۆدی دروست بنووسە.');
      }

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
      setAuthError(err.message || 'هەڵەیەک ڕوویدا لە کاتی چوونەژوورەوە');
    } finally {
      setAuthLoading(false);
    }
  };

  // 🚀 Manual 1-Tap Trigger for Check-In & Check-Out with Instant Feedback
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);

  const handleTriggerAttendance = async (event: 'ENTER' | 'EXIT') => {
    if (!employeeProfile?.id) return;
    setTriggerLoading(event);
    try {
      let devToken = localStorage.getItem('ashley_device_token');
      if (!devToken) {
        devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('ashley_device_token', devToken);
      }

      const payload = {
        userId: employeeProfile.id,
        userName: employeeProfile.name,
        deviceToken: devToken,
        event,
        lat: currentLat || 35.5571,
        lng: currentLng || 45.4352,
        distance: presence.distanceMeters || 0,
        regionName: presence.matchedLocationName || 'کۆمپانیای سەرەکی ئاشڵی',
        timestamp: new Date().toISOString(),
      };

      const res = await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await fetchLiveTodayAttendance();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ashley_attendance_updated'));
        }
        sendLocalNotification(
          event === 'ENTER' ? '🟢 تۆمارکردنی هاتن' : '👋 تۆمارکردنی ڕۆیشتن',
          data.message || (event === 'ENTER' ? 'هاتنەکەت بە سەرکەوتوویی تۆمارکرا' : 'ڕۆیشتنەکەت بە سەرکەوتوویی تۆمارکرا')
        );
      } else {
        alert(data.error || 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردندا');
      }
    } catch (err: any) {
      alert('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setTriggerLoading(null);
    }
  };

  // ⚡ Autonomous Instant Check-In upon Presence Detection
  useEffect(() => {
    if (!employeeProfile?.id) return;
    if (presence.isInsideGeofence === true && !liveTodayShift.checkInTime && !triggerLoading) {
      handleTriggerAttendance('ENTER');
    }
  }, [presence.isInsideGeofence, liveTodayShift.checkInTime, employeeProfile]);

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
    if (adminPinInput.trim() === '12355321' || adminPinInput.trim() === '1234' || adminPinInput.trim() === '000') {
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

  // 🖥️ Desktop Gate: If opened on PC / Large screen, guide to /admin
  if (isDesktop) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans dir-rtl" dir="rtl">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl space-y-5">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white">ئەم بەشە تایبەتە بە مۆبایل 📱</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            ئەپڵەکەیشنی ئامادەبوونی کارمەندان بە تایبەتی بۆ مۆبایل و بە سیستەمی GPS دیزاین کراوە بۆ چێک ئین و چێک ئاوت.
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <a
              href="/admin"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md transition-all block text-center cursor-pointer"
            >
              💻 چوون بۆ داشبۆردی بەڕێوەبەری کۆمپیوتەر (/admin)
            </a>
            <button
              onClick={() => setIsDesktop(false)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer pt-1"
            >
              (تێستکردنی شێوازی مۆبایل لەسەر کۆمپیوتەر)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] h-[100dvh] w-full bg-slate-100 text-slate-900 font-sans flex flex-col justify-between select-none overflow-hidden touch-manipulation dir-rtl" dir="rtl">
      
      {/* ========================================================================= */}
      {/* VIEW 1: ONE-TIME CLEAN LIGHT LOGIN & BINDING SCREEN */}
      {/* ========================================================================= */}
      {!employeeProfile ? (
        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col justify-center px-5 py-6 space-y-4">
          
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
                <div className="absolute inset-0 bg-orange-600/70 flex items-center justify-center text-white font-black text-xs font-mono">
                  {Math.ceil((100 - pressProgress) / 10)}s
                </div>
              )}
            </div>
            
            <h1 className="text-xl font-black text-slate-900 tracking-tight">کۆمپانیای ئاشڵی</h1>
            <p className="text-xs text-slate-500 font-bold">سیستەمی دەوامی خۆکارانەی کارمەند</p>
          </div>

          <form onSubmit={handleDeviceBinding} className="space-y-3.5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60">
            
            {/* Custom Light Employee Selector Button */}
            <div className="space-y-1 text-right">
              <label className="text-xs font-black text-slate-800">ناوی کارمەند:</label>
              
              <button
                type="button"
                onClick={() => setShowEmployeePicker(true)}
                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl text-xs text-slate-900 font-black flex items-center justify-between transition-all cursor-pointer text-right"
              >
                <span className={selectedEmpObject ? 'text-slate-900 font-black' : 'text-slate-400 font-bold'}>
                  {selectedEmpObject ? (selectedEmpObject.fullName3Part || selectedEmpObject.name) : '-- ناوی خۆت هەڵبژێرە --'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Mandatory PIN Input */}
            <div className="space-y-1 text-right">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800">پین کۆد (PIN):</label>
                <span className="text-[10px] text-orange-600 font-bold">* مەرجی سەرەکی</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  required
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

          {/* Quick Map Check Button */}
          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-orange-500" />
              <span>بینینی نەخشە 🗺️ (ئاشڵی و هوانە)</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-400 text-center font-bold">
            تەنها یەکجار تۆمار دەبێت و مۆبایلەکە بە ناوتەوە دەبەسترێتەوە
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: ULTRA-CLEAN LIGHT EMPLOYEE PERSONAL DASHBOARD (VIEW-ONLY) */
        /* ========================================================================= */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 space-y-4">
          
          {/* Top Clean Header with Secret Long Press on Logo */}
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div 
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onTouchStart={startLongPress}
                onTouchEnd={cancelLongPress}
                className="w-10 h-10 rounded-xl overflow-hidden border border-orange-400 shadow-2xs flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform"
                title="١٠ چرکە دەست لەسەر دابگرە بۆ ڕیستکردنی ئەدمین"
              >
                <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover pointer-events-none" />
                
                {pressProgress > 0 && (
                  <div className="absolute inset-0 bg-orange-600/70 flex items-center justify-center text-white font-black text-[10px] font-mono">
                    {Math.ceil((100 - pressProgress) / 10)}s
                  </div>
                )}
              </div>

              <div className="text-right">
                <h2 className="text-sm font-black text-slate-900">{employeeProfile.name}</h2>
              </div>
            </div>

            <div className="text-left font-mono font-black text-xs text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200">
              {currentTimeStr}
            </div>
          </div>

          {/* Center Presence Radar Hero */}
          <div className="flex-1 flex flex-col items-center justify-center py-2 space-y-4 text-center">
            
            {/* Glowing Presence Circle */}
            <div className="relative flex items-center justify-center">
              <div className={`w-40 h-40 rounded-full border-4 flex items-center justify-center transition-all duration-700 ${
                presence.isInsideGeofence 
                  ? 'border-emerald-500 bg-emerald-50 shadow-2xl shadow-emerald-500/20 ring-8 ring-emerald-500/10' 
                  : 'border-slate-200 bg-white shadow-lg'
              }`}>
                <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all ${
                  presence.isInsideGeofence ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  <MapPin className={`w-9 h-9 ${presence.isInsideGeofence ? 'animate-bounce text-white' : 'text-slate-400'}`} />
                  <span className="text-xs font-black font-mono mt-1">
                    {presence.distanceMeters !== null ? `${presence.distanceMeters.toLocaleString()}m` : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Title with Matched Company Location */}
            <div className="space-y-1">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border ${
                presence.isInsideGeofence
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                  : 'bg-slate-200/80 text-slate-700 border-slate-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${presence.isInsideGeofence ? 'bg-emerald-600 animate-ping' : 'bg-slate-500'}`} />
                <span>{presence.isInsideGeofence ? `🟢 لەناو (${presence.matchedLocationName})` : `🔴 لە دەرەوە (${presence.distanceMeters?.toLocaleString()}m)`}</span>
              </div>
            </div>

            {/* View Map Button */}
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-orange-600" />
              <span>بینینی نەخشە 🗺️ (ئاشڵی و هوانە)</span>
            </button>
          </div>

          {/* Today's Activity Summary Cards: Side-by-Side (Right: Check-In, Left: Check-Out) */}
          <div className="grid grid-cols-2 gap-2.5">
            
            {/* Card 1: Check In */}
            <div className={`p-3.5 rounded-2xl border text-right space-y-2 transition-all shadow-2xs ${
              shiftStatus.checkInTime 
                ? 'bg-emerald-50/80 border-emerald-300' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  shiftStatus.checkInTime 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {shiftStatus.checkInTime ? '✅ تۆمارکراوە' : '⏳ چاوەڕوانە'}
                </span>
                <span className="text-xs font-black text-slate-700">کاتی هاتن</span>
              </div>

              <div className={`text-xl font-black font-mono pt-1 ${
                shiftStatus.checkInTime ? 'text-emerald-700' : 'text-slate-400'
              }`}>
                {shiftStatus.checkInTime || '--:--'}
              </div>

              <button
                type="button"
                onClick={() => handleTriggerAttendance('ENTER')}
                disabled={!!triggerLoading}
                className={`w-full py-2 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1 ${
                  shiftStatus.checkInTime 
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                }`}
              >
                {triggerLoading === 'ENTER' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>{shiftStatus.checkInTime ? 'نوێکردنەوە 🔄' : '🟢 تۆمارکردنی هاتن'}</span>
                )}
              </button>
            </div>

            {/* Card 2: Check Out */}
            <div className={`p-3.5 rounded-2xl border text-right space-y-2 transition-all shadow-2xs ${
              shiftStatus.checkOutTime 
                ? 'bg-sky-50/80 border-sky-300' 
                : (shiftStatus.checkInTime ? 'bg-amber-50/60 border-amber-200' : 'bg-white border-slate-200')
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  shiftStatus.checkOutTime 
                    ? 'bg-sky-600 text-white' 
                    : (shiftStatus.checkInTime ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500')
                }`}>
                  {shiftStatus.checkOutTime ? '✅ دەرچوو' : (shiftStatus.checkInTime ? '🟢 لە دەوامدایە' : '--')}
                </span>
                <span className="text-xs font-black text-slate-700">کاتی ڕۆیشتن</span>
              </div>

              <div className={`text-xl font-black font-mono pt-1 ${
                shiftStatus.checkOutTime ? 'text-sky-700' : (shiftStatus.checkInTime ? 'text-amber-600 text-sm font-sans' : 'text-slate-400')
              }`}>
                {shiftStatus.checkOutTime || (shiftStatus.checkInTime ? 'لە دەوامدایە' : '--:--')}
              </div>

              <button
                type="button"
                onClick={() => handleTriggerAttendance('EXIT')}
                disabled={!!triggerLoading}
                className={`w-full py-2 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1 ${
                  shiftStatus.checkOutTime 
                    ? 'bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300' 
                    : (shiftStatus.checkInTime 
                        ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200')
                }`}
              >
                {triggerLoading === 'EXIT' ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <span>{shiftStatus.checkOutTime ? 'نوێکردنەوە 🔄' : '👋 تۆمارکردنی ڕۆیشتن'}</span>
                )}
              </button>
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
      {/* 🌟 CUSTOM IN-APP LIGHT EMPLOYEE PICKER MODAL WITH BOUND/UNBOUND BADGES */}
      {/* ========================================================================= */}
      {showEmployeePicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[80vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="text-right">
                <h3 className="font-black text-slate-900 text-sm">ناوی کارمەند هەڵبژێرە</h3>
                <p className="text-[10px] text-slate-500 font-bold">دۆخی بەستنەوەی مۆبایل بۆ هەر کارمەندێک</p>
              </div>
              <button 
                onClick={() => setShowEmployeePicker(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="گەڕان بەدوای ناوی کارمەند..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full p-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>

            {/* Employee List with Bound / Unbound Badges */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmpId === emp.id;
                const isBound = Boolean(emp.deviceBound);

                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmpId(emp.id);
                      setShowEmployeePicker(false);
                      setAuthError(null);
                    }}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between text-right transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-orange-50 border-orange-400 text-orange-950 font-black shadow-xs' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                        isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        👤
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900">{emp.fullName3Part || emp.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">{emp.role || 'کارمەند'}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                            isBound 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isBound ? '🔒 بەستراوەتەوە' : '🟢 بەردەستە'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗺️ VIEW-ONLY INTERACTIVE MAP MODAL WITH ALL LOCATIONS */}
      {/* ========================================================================= */}
      <MobileAttendanceMapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        companyLocations={companyLocations}
        currentLat={currentLat}
        currentLng={currentLng}
      />

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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 cursor-pointer"
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
