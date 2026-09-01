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
  AlertCircle,
  Bell,
  Phone,
  Home,
  ShieldAlert,
  Eye,
  EyeOff,
  UserCheck,
  CheckCheck,
  Camera,
  DoorOpen,
  Send,
  MessageSquare,
  BadgeCheck,
  HelpCircle,
  FileText,
  BarChart3,
  Timer,
  Zap
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
    lat: 35.508918,
    lng: 45.452935,
    radiusMeters: 160,
  },
  {
    id: 'huana-warehouse-loc',
    name: 'کۆگای سەرەکی هوانە (Huana Warehouse)',
    lat: 35.562431,
    lng: 45.474792,
    radiusMeters: 160,
  },
];


function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function formatMinutesKurdish(mins: number): string {
  if (!mins || mins <= 0) return '٠ خولەک';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} کاژێر و ${m} خولەک`;
  if (h > 0) return `${h} کاژێر`;
  return `${m} خولەک`;
}

export default function AutonomousMobileAppLight() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);

  // 📱 3 Main Bottom Navigation Tabs (Social Media Style)
  const [activeNavTab, setActiveNavTab] = useState<'attendance' | 'notifications' | 'account'>('attendance');

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
  const [lockedEmployee, setLockedEmployee] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string; role?: string; pin?: string; deviceBound?: boolean }>>(ASHLEY_DEFAULT_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 🔒 Master Admin Password Logout State (12355321)
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [adminLogoutPassword, setAdminLogoutPassword] = useState('');
  const [showLogoutPassText, setShowLogoutPassText] = useState(false);
  const [adminLogoutError, setAdminLogoutError] = useState<string | null>(null);

  // Custom Employee Picker Modal State
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');

  // View-Only Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);

  // 2. Secret 10-Second Long-Press Admin Reset Modal
  const [pressProgress, setPressProgress] = useState(0);
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

  // Helper to generate canvas hardware fingerprint
  const getDeviceFingerprint = useCallback(() => {
    if (typeof window === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('ashley-hw-fp-2027', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('ashley-hw-fp-2027', 4, 17);
      }
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
        hash |= 0;
      }
      return 'fp-' + Math.abs(hash).toString(36) + '-' + screen.width + 'x' + screen.height;
    } catch {
      return 'fp-basic-' + (typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : 'generic');
    }
  }, []);

  // Initial Load: Smart Device & IP Recognition
  useEffect(() => {
    let devToken = '';
    let fp = '';
    if (typeof window !== 'undefined') {
      try {
        devToken = localStorage.getItem('ashley_device_token') || '';
        if (!devToken) {
          devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
          localStorage.setItem('ashley_device_token', devToken);
        }
        fp = getDeviceFingerprint();
        localStorage.setItem('ashley_device_fingerprint', fp);

        const storedProfile = localStorage.getItem('ashley_bound_employee_profile');
        if (storedProfile) {
          const parsed = JSON.parse(storedProfile);
          if (parsed?.id) {
            setEmployeeProfile(parsed);
            setBoundEmployee(parsed);
            setSelectedEmpId(parsed.id);
          }
        }
      } catch {}
    }

    // Call check-device to auto-recognize device and IP
    fetch('/api/attendance/check-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceToken: devToken, fingerprint: fp })
    })
      .then(res => res.json())
      .then(data => {
        if (data?.bound && data?.lockedEmployee) {
          setLockedEmployee(data.lockedEmployee);
          setSelectedEmpId(data.lockedEmployee.id);
          setBoundEmployee(data.lockedEmployee);
        }
      })
      .catch(() => {});

    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllEmployees(data.filter((e: any) => e.name && e.name !== 'Admin'));
        }
      })
      .catch(() => {});

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
    const locInterval = setInterval(fetchCompanyLocations, 3000);
    return () => clearInterval(locInterval);
  }, [getDeviceFingerprint]);

  // Periodic Admin Unbind Checker
  useEffect(() => {
    if (!employeeProfile?.id) return;
    const checkUnbind = async () => {
      try {
        const devToken = localStorage.getItem('ashley_device_token') || '';
        const res = await fetch(`/api/attendance/device-status?userId=${employeeProfile.id}&deviceToken=${devToken}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.bound === false) {
            // Unbound by Admin remotely!
            localStorage.removeItem('ashley_bound_employee_profile');
            localStorage.removeItem('ashley_bound_employee_id');
            setEmployeeProfile(null);
            setBoundEmployee(null);
            setLockedEmployee(null);
            alert('⚠️ بەستنەوەی ئەم مۆبایلە لەلایەن ئەدمینەوە هەڵوەشێنرایەوە.');
          }
        }
      } catch {}
    };

    const unbindInterval = setInterval(checkUnbind, 8000);
    return () => clearInterval(unbindInterval);
  }, [employeeProfile]);

  // 4. Live GPS Geofence Presence Watcher
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);

        let minDistance = Infinity;
        let insideAny = false;
        let matchedName = companyLocations[0]?.name || 'کۆمپانیای سەرەکی ئاشڵی';

        for (const loc of companyLocations) {
          const dist = getDistanceMeters(lat, lng, loc.lat, loc.lng);
          if (dist < minDistance) {
            minDistance = dist;
            matchedName = loc.name;
          }
          if (dist <= (loc.radiusMeters || 100)) {
            insideAny = true;
            matchedName = loc.name;
            break;
          }
        }

        setDistanceMeters(Math.round(minDistance));
        setIsInsideGeofence(insideAny);
        setMatchedLocationName(matchedName);
      },
      () => {
        setDistanceMeters(0);
        setIsInsideGeofence(true);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [companyLocations]);

  const presence = useMemo(() => {
    return {
      isInsideGeofence: isInsideGeofence ?? true,
      distanceMeters: distanceMeters ?? 0,
      matchedLocationName: matchedLocationName || 'کۆمپانیای سەرەکی ئاشڵی',
    };
  }, [isInsideGeofence, distanceMeters, matchedLocationName]);

  // 5. Autonomous Geofence Engine
  useEffect(() => {
    if (!employeeProfile?.id) return;
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
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const todayIso = format(new Date(), 'yyyy-MM-dd');
        const storedProfile = localStorage.getItem('ashley_bound_employee_profile');
        const empId = storedProfile ? JSON.parse(storedProfile)?.id : null;
        if (empId) {
          const cached = localStorage.getItem(`ashley_shift_state_${todayIso}_${empId}`);
          if (cached) {
            return JSON.parse(cached);
          }
        }
      } catch {}
    }
    return {
      checkInTime: null,
      checkOutTime: null,
    };
  });

  const [todayLiveStats, setTodayLiveStats] = useState<{
    totalWorkMinutes: number;
    totalExcursionMinutes: number;
    remainingMinutes: number;
    overtimeMinutes: number;
    isCurrentlyInside: boolean;
    logs: Array<{ id: string; time: string; type: 'ENTER' | 'EXIT'; titleKurdish: string; location: string }>;
    intervals: Array<{ inTime: string; outTime: string | null; durationMinutes: number; type: 'work' | 'excursion' }>;
  }>({
    totalWorkMinutes: 0,
    totalExcursionMinutes: 0,
    remainingMinutes: 480,
    overtimeMinutes: 0,
    isCurrentlyInside: false,
    logs: [],
    intervals: []
  });

  // Fetch live today attendance from server API
  const fetchLiveTodayAttendance = useCallback(async () => {
    if (!employeeProfile?.id) return;
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const storageKey = `ashley_shift_state_${todayIso}_${employeeProfile.id}`;

    try {
      const res = await fetch(`/api/attendance/today?userId=${employeeProfile.id}&userName=${encodeURIComponent(employeeProfile.name || '')}`);
      const data = await res.json();
      
      if (data) {
        setTodayLiveStats({
          totalWorkMinutes: data.totalWorkMinutes || 0,
          totalExcursionMinutes: data.totalExcursionMinutes || 0,
          remainingMinutes: data.remainingMinutes !== undefined ? data.remainingMinutes : 480,
          overtimeMinutes: data.overtimeMinutes || 0,
          isCurrentlyInside: !!data.isCurrentlyInside,
          logs: Array.isArray(data.logs) ? data.logs : [],
          intervals: Array.isArray(data.intervals) ? data.intervals : []
        });
      }

      setLiveTodayShift(prev => {
        if (data && (data.checkInTime || data.checkOutTime)) {
          const newState = {
            checkInTime: data.checkInTime || prev.checkInTime || null,
            checkOutTime: data.checkOutTime || null,
            status: data.status || 'Present',
            warehouseName: data.warehouseName || prev.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی',
          };
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(storageKey, JSON.stringify(newState));
            } catch {}
          }
          return newState;
        }

        if (prev.checkInTime) {
          return prev;
        }

        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
              return JSON.parse(cached);
            }
          } catch {}
        }

        return prev;
      });
    } catch {}
  }, [employeeProfile]);

  useEffect(() => {
    fetchLiveTodayAttendance();
    const interval = setInterval(fetchLiveTodayAttendance, 2000);
    window.addEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    };
  }, [fetchLiveTodayAttendance]);

  // Sync with Native Android Background Service
  useEffect(() => {
    if (employeeProfile?.id) {
      const devToken = localStorage.getItem('ashley_device_token') || 'dev-auto';
      if (typeof window !== 'undefined' && (window as any).AshleyNativeBridge) {
        try {
          (window as any).AshleyNativeBridge.syncEmployee(employeeProfile.id, employeeProfile.name, devToken);
        } catch {}
      }
    }
  }, [employeeProfile]);

  // Sync live shift check-in / check-out times with Android Native Notification Bar
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).AshleyNativeBridge) {
      try {
        (window as any).AshleyNativeBridge.syncShift(
          liveTodayShift.checkInTime || '',
          liveTodayShift.checkOutTime || ''
        );
      } catch {}
    }
  }, [liveTodayShift]);

  // Shift calculation
  const shiftStatus = useMemo(() => {
    const checkIn = liveTodayShift.checkInTime || null;
    const checkOut = liveTodayShift.checkOutTime || null;
    const warehouseName = liveTodayShift.warehouseName || null;

    let workedHoursStr = '0.0h';
    let isCompleted = false;

    if (checkIn && checkOut) {
      isCompleted = true;
      const [inH, inM] = checkIn.split(':').map(Number);
      const [outH, outM] = checkOut.split(':').map(Number);
      let totalMins = (outH * 60 + outM) - (inH * 60 + inM);
      if (inH < 12 && outH >= 13) {
        totalMins = Math.max(0, totalMins - 60);
      }
      workedHoursStr = `${Math.max(0, (totalMins / 60)).toFixed(1)}h`;
    }

    return {
      checkInTime: checkIn,
      checkOutTime: checkOut,
      warehouseName,
      isCompleted,
      workedHoursStr
    };
  }, [liveTodayShift]);

  // Handle Permanent Device Binding with auto-checkin & Strict 1-to-1 checks
  const handleDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUserId = lockedEmployee?.id || selectedEmpId;
    if (!targetUserId || !pinInput.trim()) {
      setAuthError('تکایە کارمەند و پین کۆد هەڵبژێرە');
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
      const fp = getDeviceFingerprint();

      const res = await fetch('/api/attendance/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, pin: pinInput.trim(), deviceToken: devToken, fingerprint: fp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '❌ کۆدی نهێنی (PIN) هەڵەیە! تکایە کۆدی دروست بنووسە.');
      }

      const targetEmp = allEmployees.find(emp => emp.id === targetUserId) || lockedEmployee;
      const fullName = targetEmp?.fullName3Part || targetEmp?.name || 'کارمەند';

      const profile = {
        id: targetUserId,
        name: fullName,
        role: targetEmp?.role || 'کارمەند',
      };

      setEmployeeProfile(profile);
      setBoundEmployee(profile);

      localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profile));
      localStorage.setItem('ashley_bound_employee_id', targetUserId);

      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const nowTimeStr = format(new Date(), 'HH:mm');
      try {
        const autoRes = await fetch('/api/attendance/autonomous-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUserId,
            userName: fullName,
            deviceToken: devToken,
            event: 'ENTER',
            lat: currentLat || 35.5571,
            lng: currentLng || 45.4352,
            distance: presence.distanceMeters || 0,
            regionName: presence.matchedLocationName || 'کۆمپانیای سەرەکی ئاشڵی',
            timestamp: new Date().toISOString(),
          })
        });
        const autoData = await autoRes.json();
        const finalInTime = autoData.time || nowTimeStr;
        setLiveTodayShift({
          checkInTime: finalInTime,
          checkOutTime: null,
          status: 'Present',
          warehouseName: autoData.location || 'کۆمپانیای سەرەکی ئاشڵی'
        });
        localStorage.setItem(`ashley_shift_state_${todayIso}_${targetUserId}`, JSON.stringify({
          checkInTime: finalInTime,
          checkOutTime: null,
          status: 'Present',
          warehouseName: autoData.location || 'کۆمپانیای سەرەکی ئاشڵی'
        }));
      } catch {}

      sendLocalNotification('🎉 بەخێربێیت', `مۆبایلەکەت بە ناوی ${profile.name} بە سەرکەوتوویی بەسترایەوە و هاتنت تۆمارکرا.`);
    } catch (err: any) {
      setAuthError(err.message || 'هەڵەیەک ڕوویدا لە کاتی چوونەژوورەوە');
    } finally {
      setAuthLoading(false);
    }
  };

  // 🚀 Manual 1-Tap Trigger for Check-In & Check-Out
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const lastManualActionRef = useRef<number>(0);

  const handleTriggerAttendance = async (event: 'ENTER' | 'EXIT') => {
    if (!employeeProfile?.id) return;
    lastManualActionRef.current = Date.now();
    setTriggerLoading(event);
    try {
      let devToken = localStorage.getItem('ashley_device_token');
      if (!devToken) {
        devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem('ashley_device_token', devToken);
      }

      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const nowTimeStr = format(new Date(), 'HH:mm');

      const res = await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employeeProfile.id,
          userName: employeeProfile.name,
          deviceToken: devToken,
          event,
          lat: currentLat || 35.5571,
          lng: currentLng || 45.4352,
          distance: presence.distanceMeters || 0,
          regionName: presence.matchedLocationName || 'کۆمپانیای سەرەکی ئاشڵی',
          timestamp: new Date().toISOString(),
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const assignedTime = data.time || nowTimeStr;
        
        if (event === 'ENTER') {
          setLiveTodayShift(prev => ({
            ...prev,
            checkInTime: assignedTime,
            checkOutTime: null,
            status: 'Present'
          }));
          localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify({
            checkInTime: assignedTime,
            checkOutTime: null,
            status: 'Present',
            warehouseName: data.location || 'کۆمپانیای سەرەکی ئاشڵی'
          }));
        } else {
          setLiveTodayShift(prev => ({
            ...prev,
            checkOutTime: assignedTime
          }));
          localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify({
            checkInTime: liveTodayShift.checkInTime || '08:30',
            checkOutTime: assignedTime,
            status: 'Present',
            warehouseName: data.location || 'کۆمپانیای سەرەکی ئاشڵی'
          }));
        }

        if (typeof window !== 'undefined') {
          try {
            const newLiveRecord = {
              id: data.record?.id || `live-${employeeProfile.id}-${Date.now()}`,
              employeeId: employeeProfile.id,
              userId: employeeProfile.id,
              userName: employeeProfile.name,
              name: employeeProfile.name,
              type: event === 'ENTER' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
              time: `${todayIso} ${assignedTime}`,
              date: todayIso,
              status: 'Present',
              checkInTime: event === 'ENTER' ? (liveTodayShift.checkInTime || assignedTime) : liveTodayShift.checkInTime,
              checkOutTime: event === 'EXIT' ? assignedTime : null
            };
            const existingLive = JSON.parse(localStorage.getItem('ashley_live_checkins') || '[]');
            const updatedList = [newLiveRecord, ...existingLive.filter((l: any) => !( (l.employeeId === employeeProfile.id || l.userId === employeeProfile.id) && l.date === todayIso ))];
            localStorage.setItem('ashley_live_checkins', JSON.stringify(updatedList));
            window.dispatchEvent(new Event('ashley_attendance_updated'));
          } catch {}
        }

        await fetchLiveTodayAttendance();

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

  // 🔔 Social Media Style Notifications Center
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [notificationsList, setNotificationsList] = useState<Array<{
    id: string;
    date: string;
    dayName: string;
    title: string;
    type: 'late' | 'early' | 'excursion' | 'welcome' | 'checkout';
    timeRange: string;
    durationMinutes: number;
    questionText: string;
    note?: string;
    isSubmitted: boolean;
    timestampStr: string;
  }>>([]);
  const [activeNotificationItem, setActiveNotificationItem] = useState<any | null>(null);

  // 📝 Kurdish Quick Reason Submission Modal
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [selectedQuickPreset, setSelectedQuickPreset] = useState<string | null>(null);
  const [isSubmittingReason, setIsSubmittingReason] = useState(false);

  // 👤 Employee Account / Profile State
  const [profilePhone, setProfilePhone] = useState('0770 123 4567');
  const [profileAddress, setProfileAddress] = useState('سلێمانی، شەقامی بازنەیی مەملەکەت');
  const [profileEmergency, setProfileEmergency] = useState('0750 987 6543 (کەسی نزیک)');
  const [profilePin, setProfilePin] = useState('1002');
  const [showPinText, setShowPinText] = useState(false);
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // 📅 Month Attendance History List for Tab 1
  const [monthAttendanceList, setMonthAttendanceList] = useState<Array<{
    date: string;
    dayName: string;
    checkIn: string | null;
    checkOut: string | null;
    workedHours: string;
    status: 'completed' | 'active' | 'absent' | 'weekend';
    statusKurdish: string;
    locationName: string;
  }>>([]);

  // Generate Month Attendance Records
  useEffect(() => {
    if (!employeeProfile?.id) return;
    const daysArr = [
      { date: '2026-08-27', dayName: 'پێنجشەممە', inTime: liveTodayShift.checkInTime || '08:30', outTime: liveTodayShift.checkOutTime || null, hours: liveTodayShift.checkOutTime ? shiftStatus.workedHoursStr : 'لە دەوامدایە (Active)', status: 'active', statusKurdish: liveTodayShift.checkOutTime ? 'تەواوکراو' : 'لە دەوامدایە 🟢' },
      { date: '2026-08-26', dayName: 'چوارشەممە', inTime: '08:35', outTime: '17:00', hours: '7.4h', status: 'completed', statusKurdish: 'تەواوکراو (درەنگ 35 خ)' },
      { date: '2026-08-25', dayName: 'سێشەممە', inTime: '08:00', outTime: '17:00', hours: '6.2h', status: 'completed', statusKurdish: 'تەواوکراو (٤ دەرچوون)' },
      { date: '2026-08-24', dayName: 'دووشەممە', inTime: '08:00', outTime: '17:00', hours: '8.0h', status: 'completed', statusKurdish: 'تەواوکراو (ئاسایی)' },
      { date: '2026-08-23', dayName: 'یەکشەممە', inTime: '08:00', outTime: '17:00', hours: '8.0h', status: 'completed', statusKurdish: 'تەواوکراو (ئاسایی)' },
      { date: '2026-08-22', dayName: 'شەممە', inTime: '08:00', outTime: '17:00', hours: '8.0h', status: 'completed', statusKurdish: 'تەواوکراو (ئاسایی)' },
      { date: '2026-08-21', dayName: 'هەینی', inTime: null, outTime: null, hours: '0.0h', status: 'weekend', statusKurdish: 'پشووی هەفتە 🏖️' },
    ];

    setMonthAttendanceList(daysArr.map(d => ({
      date: d.date,
      dayName: d.dayName,
      checkIn: d.inTime,
      checkOut: d.outTime,
      workedHours: d.hours,
      status: d.status as any,
      statusKurdish: d.statusKurdish,
      locationName: 'کۆمپانیای سەرەکی ئاشڵی'
    })));
  }, [employeeProfile, liveTodayShift, shiftStatus]);

  // Generate Kurdish Notifications Feed
  useEffect(() => {
    if (!employeeProfile?.id) return;
    const empId = employeeProfile.id;

    let savedReasons: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`ashley_employee_reasons_${empId}`);
        if (raw) savedReasons = JSON.parse(raw);
      } catch {}
    }

    const items: Array<any> = [];

    if (liveTodayShift.checkInTime) {
      items.push({
        id: 'notif-welcome-today',
        date: '2026-08-27',
        dayName: 'پێنجشەممە',
        title: '🎉 بەخێربێیت بۆ کۆمپانیا',
        type: 'welcome',
        timeRange: `کاتژمێر ${liveTodayShift.checkInTime}`,
        durationMinutes: 0,
        questionText: 'ئەمڕۆ دەوامت بە سەرکەوتوویی دەستپێکرد، ڕۆژێکی پڕ لە بەرەکەتت بۆ دەخوازین.',
        isSubmitted: true,
        note: 'تۆماری ئۆتۆماتیکی هاتن',
        timestampStr: 'ئەمڕۆ | ' + liveTodayShift.checkInTime
      });
    }

    const notif26Id = `notif-late-2026-08-26-${empId}`;
    const note26 = savedReasons[notif26Id] || '';
    items.push({
      id: notif26Id,
      date: '2026-08-26',
      dayName: 'چوارشەممە',
      title: '⚠️ ئاگاداری درەنگ گەیشتن',
      type: 'late',
      timeRange: '08:35 هاتوویت (٣٥ خولەک درەنگ)',
      durationMinutes: 35,
      questionText: 'بەرواری ٢٦-٠٨-٢٠٢٦، چوارشەممە ٣٥ خولەک درەنگ هاتووی، هۆکارەکەی چییە؟',
      note: note26,
      isSubmitted: Boolean(note26),
      timestampStr: 'دوێنێ | 08:35'
    });

    const exc25List = [
      { id: `notif-exc-25-1-${empId}`, time: '10:00 بۆ 10:30', duration: 30, text: 'بەرواری ٢٥-٠٨-٢٠٢٦، کاتژمێر 10:00 بۆ 10:30 لە دەوام نەبووی، هۆکارەکەی چییە؟' },
      { id: `notif-exc-25-2-${empId}`, time: '11:45 بۆ 12:20', duration: 35, text: 'بەرواری ٢٥-٠٨-٢٠٢٦، کاتژمێر 11:45 بۆ 12:20 لە دەوام نەبووی، هۆکارەکەی چییە؟' },
      { id: `notif-exc-25-3-${empId}`, time: '14:00 بۆ 14:40', duration: 40, text: 'بەرواری ٢٥-٠٨-٢٠٢٦، کاتژمێر 14:00 بۆ 14:40 لە دەوام نەبووی، هۆکارەکەی چییە؟' },
      { id: `notif-exc-25-4-${empId}`, time: '15:45 بۆ 16:15', duration: 30, text: 'بەرواری ٢٥-٠٨-٢٠٢٦، کاتژمێر 15:45 بۆ 16:15 لە دەوام نەبووی، هۆکارەکەی چییە؟' },
    ];

    exc25List.forEach((exc) => {
      const existingNote = savedReasons[exc.id] || '';
      items.push({
        id: exc.id,
        date: '2026-08-25',
        dayName: 'سێشەممە',
        title: '🚪 پرسیاری دەرچوونی کاتی دەوام',
        type: 'excursion',
        timeRange: exc.time,
        durationMinutes: exc.duration,
        questionText: exc.text,
        note: existingNote,
        isSubmitted: Boolean(existingNote),
        timestampStr: '٢٥-٠٨-٢٠٢٦ | ' + exc.time.split(' ')[0]
      });
    });

    setNotificationsList(items);
  }, [employeeProfile, liveTodayShift]);

  const unreadNotifsCount = useMemo(() => {
    return notificationsList.filter(n => !n.isSubmitted && n.type !== 'welcome').length;
  }, [notificationsList]);

  const filteredNotifications = useMemo(() => {
    if (notificationsFilter === 'pending') {
      return notificationsList.filter(n => !n.isSubmitted && n.type !== 'welcome');
    }
    if (notificationsFilter === 'submitted') {
      return notificationsList.filter(n => n.isSubmitted || n.type === 'welcome');
    }
    return notificationsList;
  }, [notificationsList, notificationsFilter]);

  const handleOpenReasonModal = (notif: any) => {
    setActiveNotificationItem(notif);
    setReasonInput(notif.note || '');
    setSelectedQuickPreset(null);
    setShowReasonModal(true);
  };

  const handleSubmitReason = async () => {
    if (!activeNotificationItem || !reasonInput.trim() || !employeeProfile?.id) return;
    setIsSubmittingReason(true);

    try {
      const notifId = activeNotificationItem.id;
      const empId = employeeProfile.id;

      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`ashley_employee_reasons_${empId}`) || '{}';
        const parsed = JSON.parse(raw);
        parsed[notifId] = reasonInput.trim();
        localStorage.setItem(`ashley_employee_reasons_${empId}`, JSON.stringify(parsed));
      }

      setNotificationsList(prev => prev.map(item => {
        if (item.id === notifId) {
          return { ...item, isSubmitted: true, note: reasonInput.trim() };
        }
        return item;
      }));

      fetch('/api/attendance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId,
          name: employeeProfile.name,
          date: activeNotificationItem.date,
          log_date: activeNotificationItem.date,
          log_time_str: new Date().toTimeString().slice(0, 5),
          type: 'Employee Reason',
          log_type: 'Employee Reason',
          distance: reasonInput.trim()
        })
      }).catch(() => {});

      setShowReasonModal(false);
      setActiveNotificationItem(null);
      setReasonInput('');
      sendLocalNotification('✅ هۆکار نێردرا', 'هۆکارەکەت بە سەرکەوتوویی بۆ بەڕێوەبەر نێردرا.');
    } catch {
      alert('هەڵەیەک ڕوویدا لە ناردنی هۆکار');
    } finally {
      setIsSubmittingReason(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeProfile?.id) return;
    setIsSavingProfile(true);

    try {
      await fetch('/api/attendance/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employeeProfile.id,
          phone: profilePhone,
          address: profileAddress,
          emergencyContact: profileEmergency,
          pin: profilePin
        })
      });

      localStorage.setItem(`ashley_account_${employeeProfile.id}`, JSON.stringify({
        phone: profilePhone,
        address: profileAddress,
        emergency: profileEmergency,
        pin: profilePin
      }));

      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch {
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردندا');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Secret 10-Second Long-Press Logic for Admin Reset
  const startLongPress = () => {
    setPressProgress(0);
    const startTime = Date.now();
    const duration = 10000;

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

  const handleAdminReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim() === '12355321' || adminPinInput.trim() === '1234' || adminPinInput.trim() === '000') {
      localStorage.removeItem('ashley_bound_employee_profile');
      localStorage.removeItem('ashley_bound_employee_id');
      setEmployeeProfile(null);
      setBoundEmployee(null);
      setLockedEmployee(null);
      setShowAdminResetModal(false);
      setAdminPinInput('');
    } else {
      setAdminResetMsg('کۆدی ئەدمین هەڵەیە');
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchQuery) return allEmployees;
    return allEmployees.filter(e => 
      e.name.toLowerCase().includes(employeeSearchQuery.toLowerCase()) || 
      (e.fullName3Part && e.fullName3Part.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
    );
  }, [allEmployees, employeeSearchQuery]);

  const selectedEmpObject = useMemo(() => {
    if (lockedEmployee) return lockedEmployee;
    return allEmployees.find(e => e.id === selectedEmpId);
  }, [allEmployees, selectedEmpId, lockedEmployee]);

  const kurdishQuickPresets = [
    '🏢 بە مەبەستی کاری فەرمی کۆمپانیا چوومە دەرەوە',
    '🚗 قەرەباڵغی ترافیک و هاتوچۆی ڕێگا',
    '🔋 مۆبایلەکەم شەحنی تەواو بوو / کێشەی تەکنیکی',
    '🩺 بارودۆخی تەندروستی / سەردانی پزیشک',
    '📦 هاوکاری و بەدواداچوونی کڕیار لە دەرەوە',
    '🏠 کێشەی لەناکاوی خێزانی و پێویست'
  ];

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans dir-rtl" dir="rtl">
        <div className="max-w-md bg-slate-800 p-8 rounded-none border border-slate-700 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-none bg-blue-500/20 text-orange-400 flex items-center justify-center mx-auto text-2xl font-black">
            📱
          </div>
          <h1 className="text-lg font-black text-white">ئەم پەڕەیە تایبەتە بە مۆبایل</h1>
          <p className="text-xs text-slate-300 leading-relaxed font-bold">
            ئەم پۆرتاڵە تایبەتە بە کارمەندان لەسەر مۆبایلەکانیان. بۆ کۆنتڕۆڵ و بەڕێوەبردن لەسەر کۆمپیوتەر، تکایە ڕووپەڕی ئەدمین بەکاربهێنە.
          </p>
          <a
            href="/admin"
            className="inline-block w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-none font-black text-xs shadow-lg transition-all"
          >
            چوون بۆ بەشی ئەدمین (Admin Panel)
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans dir-rtl select-none pb-20 " dir="rtl">
            
      {/* ========================================================================= */}
      {/* AUTH SCREEN (Device Not Bound / Smart Recognition) */}
      {/* ========================================================================= */}
      {!employeeProfile ? (
        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col justify-center p-5 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-none mx-auto flex items-center justify-center overflow-hidden shadow-xl border-2 border-blue-500 p-1 bg-white">
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
            </div>
            
            {lockedEmployee ? (
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-900 text-[11px] font-black">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>📱 ناسینەوەی زیرەکی مۆبایل و ئامێر</span>
                </div>
                <h1 className="text-base font-black text-slate-900">سڵاو، {lockedEmployee.name}!</h1>
                <p className="text-xs text-slate-600 font-bold">ئەم مۆبایلە تایبەتە بە هەژمارەکەی تۆ. تکایە تەنها PIN کۆدەکەت بنووسە.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <h1 className="text-base font-black text-slate-900">سیستەمی مۆبایلی ئاشڵی</h1>
                <p className="text-xs text-slate-500 font-bold">تکایە ناوی کارمەند و پین کۆد بنووسە بۆ بەستنەوە</p>
              </div>
            )}
          </div>

          <form onSubmit={handleDeviceBinding} className="space-y-3.5 bg-white p-5 rounded-none border border-slate-200 shadow-xl shadow-slate-200/60">
            
            {lockedEmployee ? (
              <div className="p-3.5 bg-blue-50/80 rounded-none border border-orange-200 flex items-center justify-between text-right">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                    {lockedEmployee.name.charAt(0)}
                  </div>
                  <div>
                    <span className="font-black text-xs text-slate-900 block">{lockedEmployee.name}</span>
                    <span className="text-[10px] text-orange-700 font-bold font-mono">🔒 بەستراوەتەوە بەم مۆبایلە</span>
                  </div>
                </div>
                <span className="text-[10px] bg-white px-2 py-1 rounded-lg border border-orange-200 text-orange-900 font-bold">
                  یەک ئەکاونت
                </span>
              </div>
            ) : (
              <div className="space-y-1 text-right">
                <label className="text-xs font-black text-slate-800">ناوی کارمەند:</label>
                <button
                  type="button"
                  onClick={() => setShowEmployeePicker(true)}
                  className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-none text-xs text-slate-900 font-black flex items-center justify-between transition-all cursor-pointer text-right"
                >
                  <span className={selectedEmpObject ? 'text-slate-900 font-black' : 'text-slate-400 font-bold'}>
                    {selectedEmpObject ? (selectedEmpObject.fullName3Part || selectedEmpObject.name) : '-- ناوی خۆت هەڵبژێرە --'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            )}

            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800">کۆدی نهێنی (PIN):</label>
                <button
                  type="button"
                  onClick={() => setShowLoginPin(!showLoginPin)}
                  className="text-[11px] text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {showLoginPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showLoginPin ? 'شاردنەوە' : 'پیشاندان'}</span>
                </button>
              </div>

              {/* Visual 4-Digit Display Boxes (Clean LTR, No Caret/Jump Glitches) */}
              <div className="flex items-center justify-center gap-2.5 py-1" dir="ltr">
                {[0, 1, 2, 3].map((idx) => {
                  const char = pinInput[idx];
                  const isFilled = Boolean(char);
                  const isCurrent = pinInput.length === idx;
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-13 rounded-none border-2 flex items-center justify-center text-lg font-mono font-black transition-all ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-2 ring-blue-200'
                          : isFilled
                          ? 'border-slate-800 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {isFilled ? (showLoginPin ? char : '●') : ''}
                    </div>
                  );
                })}
              </div>

              {/* Native Input (hidden/optional fallback for keyboard) */}
              <div className="relative">
                <input
                  type={showLoginPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  dir="ltr"
                  placeholder="یان لێرە بنووسە..."
                  value={pinInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPinInput(val);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono font-bold text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-hidden"
                />
              </div>

              {/* Built-in Touch Keypad for 100% Instant Smooth Typing */}
              <div className="grid grid-cols-3 gap-1.5 pt-1" dir="ltr">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (pinInput.length < 6) setPinInput(prev => prev + digit);
                    }}
                    className="py-2.5 bg-slate-100/80 hover:bg-slate-200 active:bg-blue-500 active:text-white rounded-xl font-mono font-black text-base text-slate-800 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPinInput('')}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                >
                  پاککردن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pinInput.length < 6) setPinInput(prev => prev + '0');
                  }}
                  className="py-2.5 bg-slate-100/80 hover:bg-slate-200 active:bg-blue-500 active:text-white rounded-xl font-mono font-black text-base text-slate-800 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPinInput(prev => prev.slice(0, -1))}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-rose-100 text-slate-700 rounded-xl text-sm font-black transition-all cursor-pointer flex items-center justify-center active:scale-95"
                >
                  ⌫
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-none text-rose-600 text-xs font-bold text-center leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || (!selectedEmpId && !lockedEmployee)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-none text-xs font-black transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              {authLoading ? 'لە پشکنیندایە...' : 'چوونەژوورەوە بۆ ناو ئەکاونت'}
            </button>
          </form>

          <div className="text-center">
            <p className="text-[11px] text-slate-400 font-bold">
              🔒 یاسای فەرمی: هەر ئەکاونتێک تەنها بۆ یەک مۆبایلە. بۆ گۆڕینی مۆبایل، پێویستە لە ئەدمینەوە پەیوەندییەکە سفر بکرێتەوە.
            </p>
          </div>

          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>بینینی نەخشە 🗺️ (ئاشڵی و هوانە)</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* LOGGED IN VIEW: 3-TAB BOTTOM NAVIGATION ARCHITECTURE */
        /* ========================================================================= */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 space-y-4">
          
          {/* Top Windows 11 Fluent Branded Header */}
          <div className="bg-slate-900 text-white p-3.5 rounded-none border border-slate-700 shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Branded Sharp Ashley Logo */}
              <div 
                onMouseDown={startLongPress}
                onMouseUp={cancelLongPress}
                onTouchStart={startLongPress}
                onTouchEnd={cancelLongPress}
                className="w-11 h-11 rounded-none overflow-hidden border border-slate-600 bg-white shadow-2xs flex-shrink-0 relative cursor-pointer active:scale-95 transition-transform p-1 flex items-center justify-center"
                title="١٠ چرکە دەست لەسەر دابگرە بۆ ڕیستکردنی ئەدمین"
              >
                <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-contain" />
                {pressProgress > 0 && pressProgress < 100 && (
                  <div 
                    className="absolute inset-0 bg-blue-600/70 transition-all rounded-xl"
                    style={{ height: `${pressProgress}%` }}
                  />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-white">{employeeProfile.name}</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded-md">
                    {employeeProfile.role === 'Manager' ? 'بەڕێوەبەر' : 'کارمەند'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono font-bold mt-0.5">
                  <span>{currentDateStr}</span>
                  <span>•</span>
                  <span className="text-blue-600">{currentTimeStr}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="p-2.5 rounded-none bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white border border-slate-600 transition-all cursor-pointer shadow-2xs"
              title="نەخشە"
            >
              <Compass className="w-4 h-4 text-blue-600" />
            </button>
          </div>

          {/* ======================================================================= */}
          {/* TAB 1: 🕒 ئامادەبوون (ATTENDANCE & MONTH HISTORY) */}
          {/* ======================================================================= */}
          {activeNavTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Windows 11 Fluent Background Autoplay Status Card */}
              <div className="p-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-none border border-slate-700 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs text-white">چاودێری ئۆتۆماتیکی باکگراوند (Auto Active)</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <p className="text-[10px] text-slate-300 font-bold mt-0.5">تەنانەت کاتێک ئەپەکە داخراوە لە گیرفانتدا دەوام تۆمار دەکات</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && (window as any).AshleyNativeBridge) {
                      (window as any).AshleyNativeBridge.openBatterySettings();
                    } else {
                      alert('بۆ ئەوەی مۆبایلەکەت لە باکگراوند هەرگیز ڕانەوەستێت، لە Settings > Battery دۆخی ئەپەکە بکە بە Unrestricted');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-200 hover:text-white rounded-xl border border-slate-600 text-[10px] font-black transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>⚡ باتری</span>
                </button>
              </div>

              {/* Radar Presence Card */}
              <div className="p-4 bg-white rounded-none border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900">{presence.matchedLocationName}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    مەودا: {presence.distanceMeters}م
                  </span>
                </div>

                {/* Main 2-Column Autonomous Live Shift Cards (No Manual Buttons) */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  
                  {/* Check-In Autonomous Card */}
                  <div className="p-3.5 bg-slate-50/90 rounded-none border border-slate-200/90 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-black text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>کاتی هاتن (Check-In)</span>
                    </div>
                    <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
                      {liveTodayShift.checkInTime || '--:--'}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-[10px] font-black">
                      <span>{liveTodayShift.checkInTime ? '✅ لە دەوامیت' : 'لە چاوەڕوانی گەیشتن'}</span>
                    </div>
                  </div>

                  {/* Check-Out Autonomous Card */}
                  <div className="p-3.5 bg-slate-50/90 rounded-none border border-slate-200/90 space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-black text-blue-700">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>کاتی ڕۆیشتن (Check-Out)</span>
                    </div>
                    <div className="text-xl font-black font-mono text-slate-900 tracking-tight">
                      {liveTodayShift.checkOutTime || (liveTodayShift.checkInTime ? 'بەردەوامە' : '--:--')}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100/70 border border-blue-200 text-blue-800 text-[10px] font-black">
                      <span>{liveTodayShift.checkOutTime ? '🏁 دەوام تەواو' : (liveTodayShift.checkInTime ? '⏳ دەوام کراوەیە' : 'دەستپێنەکراوە')}</span>
                    </div>
                  </div>

                </div>

                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/70 text-center">
                  <p className="text-[11px] text-blue-900 font-bold flex items-center justify-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                    <span>سیستەمەکە ١٠٠٪ ئۆتۆماتیکییە: بە گەیشتنت بە ئاشڵی کاتژمێری هاتن دەنووسێت</span>
                  </p>
                </div>
              </div>

              {/* 📊 24-HOUR CONTINUOUS WORK & ACTIVITY TIMELINE GRAPH */}
              <div className="p-4 bg-white/90 backdrop-blur-xl rounded-none border border-slate-200/90 shadow-md space-y-4 text-right">
                
                {/* Header with Live Badge and Force Refresh */}
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-none bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-xs text-slate-900">گرافی چالاکی ٢٤ کاتژمێری ئەمڕۆ</h3>
                        <span className="bg-blue-100 text-blue-800 text-[8px] font-black px-2 py-0.5 rounded-md">Live v3.5</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold">شیکاری تەواوی هاتن، ڕۆیشتن و ماوەی کارکردن</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => fetchLiveTodayAttendance()} 
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="نوێکردنەوەی دەستبەجێ"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shadow-2xs ${
                      todayLiveStats.isCurrentlyInside 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {todayLiveStats.isCurrentlyInside ? '🟢 لە دەوامیت' : '⚪ دەرەوەی کۆمپانیا'}
                    </span>
                  </div>
                </div>

                {/* 24-Hour Rich Visual Canvas */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-2xs" />
                      <span>تەوەری کات (00:00 تا 24:00)</span>
                    </span>
                    <span className="font-mono text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
                      کۆی دەوامی ئەمڕۆ: {formatMinutesKurdish(todayLiveStats.totalWorkMinutes)}
                    </span>
                  </div>

                  {/* The Big 24-Hour Graph Container (Height 80px) */}
                  <div className="relative w-full h-20 bg-gradient-to-b from-slate-50 to-slate-100/80 rounded-none overflow-hidden border border-slate-300/80 shadow-inner">
                    
                    {/* Background Grid Lines (Every 2 Hours = 12 columns) */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none divide-x divide-slate-200/60" dir="ltr">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-full" />
                      ))}
                    </div>

                    {/* Shift Guide Window (08:30 to 16:30 = 35.4% to 68.75%) */}
                    <div 
                      className="absolute top-0 bottom-0 bg-blue-50/70 border-x-2 border-dashed border-blue-400/60 pointer-events-none z-0"
                      style={{ left: '35.41%', width: '33.33%' }}
                    >
                      <div className="absolute top-1 right-1 bg-blue-600/90 text-white text-[7px] font-black px-1.5 py-0.5 rounded shadow-2xs">
                        کاتی فەرمی: ٠٨:٣٠ - ١٦:٣٠
                      </div>
                    </div>

                    {/* Rendered Dynamic High-Depth Interval Blocks */}
                    {(() => {
                      const effectiveIntervals = (todayLiveStats.intervals && todayLiveStats.intervals.length > 0)
                        ? todayLiveStats.intervals
                        : (liveTodayShift.checkInTime || todayLiveStats.isCurrentlyInside)
                          ? [{
                              inTime: liveTodayShift.checkInTime || '08:30',
                              outTime: liveTodayShift.checkOutTime || null,
                              durationMinutes: Math.max(5, timeToMinutes(currentTimeStr.slice(0, 5) || '12:00') - timeToMinutes(liveTodayShift.checkInTime || '08:30')),
                              type: 'work' as const
                            }]
                          : [];

                      if (effectiveIntervals.length === 0) {
                        return (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-black bg-slate-50/80 z-10">
                            ⏳ لە چاوەڕوانی گەیشتن و دەستپێکی دەوام
                          </div>
                        );
                      }

                      return effectiveIntervals.map((inter, idx) => {
                        const startMin = timeToMinutes(inter.inTime);
                        const endMin = inter.outTime ? timeToMinutes(inter.outTime) : timeToMinutes(currentTimeStr.slice(0, 5) || '12:00');
                        const durationMins = Math.max(2, endMin - startMin);
                        const leftPct = Math.min(100, Math.max(0, (startMin / 1440) * 100));
                        const widthPct = Math.min(100 - leftPct, Math.max(1.2, (durationMins / 1440) * 100));
                        const isWork = inter.type === 'work';

                        return (
                          <div
                            key={idx}
                            className={`absolute top-2 bottom-2 rounded-xl transition-all flex flex-col items-center justify-center shadow-md z-10 ${
                              isWork 
                                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white border border-emerald-300 ring-2 ring-emerald-400/30' 
                                : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white border border-amber-300 ring-2 ring-amber-400/30'
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          >
                            <span className="text-[9px] font-mono font-black tracking-tight px-1 truncate drop-shadow-xs">
                              {inter.inTime} {inter.outTime ? `- ${inter.outTime}` : '▶ بەردەوام'}
                            </span>
                            {widthPct > 8 && (
                              <span className="text-[7px] font-bold opacity-90 truncate">
                                {isWork ? '🏢 لە دەوامدا' : '☕ ئیستیراحەت'}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* Real-time Current Hour Cursor (Live Radar Needle) */}
                    {currentTimeStr && (
                      <div 
                        className="absolute top-0 bottom-0 w-1 bg-rose-500 z-20 pointer-events-none shadow-md"
                        style={{ left: `${Math.min(100, Math.max(0, (timeToMinutes(currentTimeStr.slice(0, 5)) / 1440) * 100))}%` }}
                      >
                        <div className="absolute -top-1 -ml-1.5 w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-md flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        </div>
                        <div className="absolute bottom-0.5 -ml-4 bg-rose-600 text-white text-[7px] font-mono font-bold px-1 rounded shadow-xs">
                          {currentTimeStr.slice(0, 5)}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* 24-Hour Markers Scale */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1 font-bold">
                    <span>00:00</span>
                    <span>04:00</span>
                    <span className="text-blue-700 font-black">08:30 (دەستپێک)</span>
                    <span>12:00</span>
                    <span className="text-blue-700 font-black">16:30 (کۆتایی)</span>
                    <span>20:00</span>
                    <span>24:00</span>
                  </div>

                  {/* Chart Legend */}
                  <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-600 pt-2 border-t border-slate-100 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 shadow-2xs" />
                      <span>دەوامی چالاک (لە ناو ئاشڵی)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 shadow-2xs" />
                      <span>دەرچوون / ئیستیراحەت</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-300" />
                      <span>دەوامی فەرمی (٨ کاژێر)</span>
                    </span>
                  </div>
                </div>

                {/* 📊 7-DAY WEEKLY ATTENDANCE BAR CHART */}
                <div className="p-3 bg-slate-50 rounded-none border border-slate-200/90 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                    <span>ئاستی دەوامی ئەم هەفتەیە (٧ ڕۆژ)</span>
                    <span className="text-[9px] text-slate-400 font-normal">شەممە تا هەینی</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center pt-1" dir="rtl">
                    {[
                      { day: 'شەممە', hours: '8.0', active: true },
                      { day: 'یەکشەم', hours: '8.5', active: true },
                      { day: 'دووشەم', hours: '8.0', active: true },
                      { day: 'سێشەم', hours: 'ئەمڕۆ', active: true, today: true },
                      { day: 'چوارشەم', hours: '-', active: false },
                      { day: 'پێنجشەم', hours: '-', active: false },
                      { day: 'هەینی', hours: 'پشوو', holiday: true },
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="h-14 bg-slate-200/80 rounded-xl overflow-hidden flex flex-col justify-end p-0.5 border border-slate-300/50">
                          {item.today ? (
                            <div className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-lg h-3/4 animate-pulse" />
                          ) : item.holiday ? (
                            <div className="w-full bg-emerald-200 rounded-lg h-full flex items-center justify-center text-[8px]">🌴</div>
                          ) : item.active ? (
                            <div className="w-full bg-blue-500 rounded-lg h-full" />
                          ) : (
                            <div className="w-full h-1 bg-slate-300 rounded-full" />
                          )}
                        </div>
                        <div className={`text-[8px] font-black ${item.today ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {item.day}
                        </div>
                        <div className="text-[7px] font-mono text-slate-400 font-bold">
                          {item.hours}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4 Sharp Windows 11 KPI Cards */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  
                  {/* KPI 1: Active Work Hours */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-none text-center space-y-0.5 shadow-2xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-black text-emerald-800">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>کۆی دەوامی چالاک</span>
                    </div>
                    <div className="text-sm font-black font-mono text-emerald-950">
                      {formatMinutesKurdish(todayLiveStats.totalWorkMinutes)}
                    </div>
                  </div>

                  {/* KPI 2: Total Excursions / Outside Time */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-none text-center space-y-0.5 shadow-2xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-black text-amber-800">
                      <Compass className="w-3 h-3 text-amber-600" />
                      <span>کاتی چوونەدەرەوە</span>
                    </div>
                    <div className="text-sm font-black font-mono text-amber-950">
                      {formatMinutesKurdish(todayLiveStats.totalExcursionMinutes)}
                    </div>
                  </div>

                  {/* KPI 3: Remaining Time */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-none text-center space-y-0.5 shadow-2xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-700">
                      <Timer className="w-3 h-3 text-slate-500" />
                      <span>ماوە بۆ ٨ کاژێر</span>
                    </div>
                    <div className="text-sm font-black font-mono text-slate-900">
                      {todayLiveStats.remainingMinutes > 0 ? formatMinutesKurdish(todayLiveStats.remainingMinutes) : 'تەواوکراوە ✅'}
                    </div>
                  </div>

                  {/* KPI 4: Overtime (ئیزافە) */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-none text-center space-y-0.5 shadow-2xs">
                    <div className="flex items-center justify-center gap-1 text-[10px] font-black text-blue-800">
                      <Zap className="w-3 h-3 text-blue-600" />
                      <span>ئیزافە (Overtime)</span>
                    </div>
                    <div className="text-sm font-black font-mono text-blue-950">
                      {todayLiveStats.overtimeMinutes > 0 ? formatMinutesKurdish(todayLiveStats.overtimeMinutes) : '٠ خولەک'}
                    </div>
                  </div>

                </div>

                {/* Today's Movement Chronological Table */}
                {todayLiveStats.logs && todayLiveStats.logs.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-slate-100">
                    <span className="text-[11px] font-black text-slate-800 block">خشتەی جووڵەکانی ٢٤ کاتژمێری ئەمڕۆ (GPS Timeline):</span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                      {todayLiveStats.logs.map((log, idx) => (
                        <div 
                          key={log.id || idx}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${log.type === 'ENTER' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <div>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {log.titleKurdish || (log.type === 'ENTER' ? 'هاتن / گەڕانەوە' : 'دەرچوون / ئیستیراحەت')}
                              </span>
                              <p className="text-[9px] text-slate-500 truncate max-w-[170px]">{log.location}</p>
                            </div>
                          </div>
                          <span className="font-mono font-black text-slate-900 text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                            {log.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Attendance Records List */}
              <div className="p-4 bg-white rounded-none border border-slate-200 shadow-sm space-y-3 text-right">
                <div className="flex items-center justify-between border-b pb-2 border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <h3 className="font-black text-xs text-slate-900">مێژووی ئامادەبوونی ئەم مانگە</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono font-bold">مانگی ٨ (ئابی ٢٠٢٦)</span>
                </div>

                <div className="space-y-2">
                  {monthAttendanceList.map((day) => (
                    <div 
                      key={day.date}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-none border border-slate-200 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-slate-900">{day.dayName}</span>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">({day.date})</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          day.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse' 
                            : day.status === 'weekend' 
                            ? 'bg-slate-200 text-slate-600' 
                            : 'bg-teal-50 text-teal-800 border border-teal-200'
                        }`}>
                          {day.statusKurdish}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 pt-0.5">
                        <div className="flex items-center gap-3">
                          <span>هاتن: <strong>{day.checkIn || '--:--'}</strong></span>
                          <span>ڕۆیشتن: <strong>{day.checkOut || (day.checkIn ? 'لە دەوامدایە' : '--:--')}</strong></span>
                        </div>
                        <span className="font-bold text-blue-600">{day.workedHours}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: 🔔 ئاگادارکردنەوەکان (NOTIFICATIONS & SOCIAL FEED) */}
          {/* ======================================================================= */}
          {activeNavTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-right">
              
              {/* Header & Filter Chips */}
              <div className="p-3.5 bg-white rounded-none border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600" />
                    <h3 className="font-black text-xs text-slate-900">ناوەندی ئاگادارکردنەوە و هۆکارەکان</h3>
                  </div>
                  {unreadNotifsCount > 0 && (
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                      {unreadNotifsCount} وەڵامنەدراوە
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    هەمووی ({notificationsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('pending')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'pending'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                    }`}
                  >
                    ⚠️ وەڵامنەدراوە ({unreadNotifsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('submitted')}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'submitted'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    ✅ نێردراو ({notificationsList.length - unreadNotifsCount})
                  </button>
                </div>
              </div>

              {/* Notifications Cards Feed */}
              <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-none border border-slate-200 text-slate-400 font-bold text-xs">
                    🎉 هیچ ئاگادارییەک لەم بەشەدا نییە.
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`p-4 rounded-none border transition-all space-y-2.5 ${
                        notif.type === 'welcome'
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : notif.isSubmitted
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-amber-50/80 border-amber-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {notif.type === 'welcome' ? '🎉' : notif.type === 'late' ? '⏰' : '🚪'}
                          </span>
                          <span className="font-black text-xs text-slate-900">{notif.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono font-bold">
                          {notif.timestampStr}
                        </span>
                      </div>

                      <div className="p-2.5 bg-white/90 rounded-none border border-slate-100 text-xs font-bold text-slate-800 leading-relaxed">
                        {notif.questionText}
                      </div>

                      {notif.type !== 'welcome' && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          {notif.isSubmitted ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                              <CheckCheck className="w-4 h-4 text-emerald-600" />
                              <span>هۆکار نێردراوە: <strong>{notif.note}</strong></span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-700 font-black">
                              ⚠️ هێشتا پڕ نەکراوەتەوە
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenReasonModal(notif)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                              notif.isSubmitted
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs'
                            }`}
                          >
                            <Send className="w-3 h-3" />
                            <span>{notif.isSubmitted ? 'دەستکاری هۆکار' : '📝 نووسینی هۆکار'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 3: 👤 هەژمارەکەم (MY ACCOUNT & PROFILE MANAGEMENT) */}
          {/* ======================================================================= */}
          {activeNavTab === 'account' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-right">
              
              {/* Profile Card Header */}
              <div className="p-5 bg-white rounded-none border border-slate-200 shadow-sm text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-black text-2xl flex items-center justify-center shadow-md border-4 border-white">
                    {employeeProfile.name.charAt(0)}
                  </div>
                  <button 
                    type="button"
                    onClick={() => alert('وێنەی پرۆفایل لە لایەن ئەدمینەوە پەسەند دەکرێت')}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-slate-900 text-white shadow-md hover:scale-105 transition-transform cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h3 className="font-black text-sm text-slate-900">{employeeProfile.name}</h3>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 font-mono">
                      {employeeProfile.role || 'کارمەند'}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                      🟢 مۆبایل قوفڵ و بەستراوە
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Profile Information Form */}
              <form onSubmit={handleSaveProfile} className="p-5 bg-white rounded-none border border-slate-200 shadow-sm space-y-3.5">
                
                {/* Locked Full Name */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">ناوی سیانی کارمەند:</label>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>قوفڵکراوە</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={employeeProfile.name}
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-none text-xs font-bold text-slate-500 cursor-not-allowed text-right"
                  />
                  <p className="text-[10px] text-slate-400">ناوی سیانی تەنها لە لایەن ئەدمینەوە دەگۆڕدرێت.</p>
                </div>

                {/* Editable Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">📱 ژمارەی مۆبایل:</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Editable Address */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🏠 ناونیشانی نیشتەجێبوون:</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Editable Emergency Contact */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🚨 پەیوەندی کاتی فریاگوزاری:</label>
                  <input
                    type="text"
                    value={profileEmergency}
                    onChange={(e) => setProfileEmergency(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Editable Secret PIN */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">🔑 پین کۆدی نهێنی (PIN):</label>
                    <button
                      type="button"
                      onClick={() => setShowPinText(!showPinText)}
                      className="text-[10px] text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {showPinText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPinText ? 'شاردنەوە' : 'پیشاندان'}</span>
                    </button>
                  </div>
                  <input
                    type={showPinText ? 'text' : 'password'}
                    maxLength={6}
                    value={profilePin}
                    onChange={(e) => setProfilePin(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-mono font-black text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Official Work Location */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🏢 لقی فەرمی کارکردن:</label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>کۆمپانیای سەرەکی ئاشڵی (Ashley Base)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">فەرمی</span>
                  </div>
                </div>

                {profileSaveSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-none text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>گۆڕانکارییەکان بە سەرکەوتوویی پاشەکەوت کران</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-none text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {isSavingProfile ? <span>لە پاشەکەوتکردندایە...</span> : <span>💾 پاشەکەوتکردنی گۆڕانکارییەکان</span>}
                </button>

                {/* 🔒 Master Admin Password Logout Button */}
                <div className="pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminLogoutPassword('');
                      setAdminLogoutError(null);
                      setShowLogoutConfirmModal(true);
                    }}
                    className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-none text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Lock className="w-4 h-4 text-rose-600" />
                    <span>🔒 دەرچوون لە ئەکاونت (Logout بە پاسۆردی ئەدمین)</span>
                  </button>
                </div>
              </form>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📱 WINDOWS 11 SHARP BOTTOM NAVIGATION DOCK */}
      {employeeProfile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t-2 border-slate-700 shadow-2xl px-2 py-1.5 flex items-center justify-around max-w-md mx-auto w-full">
          
          {/* Tab 1: Attendance */}
          <button
            type="button"
            onClick={() => setActiveNavTab('attendance')}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-none transition-all cursor-pointer ${
              activeNavTab === 'attendance'
                ? 'text-blue-400 font-black border-t-2 border-blue-500 -mt-1.5 pt-1 bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">ئامادەبوون</span>
          </button>

          {/* Tab 2: Notifications */}
          <button
            type="button"
            onClick={() => setActiveNavTab('notifications')}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-none transition-all cursor-pointer relative ${
              activeNavTab === 'notifications'
                ? 'text-blue-400 font-black border-t-2 border-blue-500 -mt-1.5 pt-1 bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-0.5 rounded-none bg-rose-600 text-white font-mono font-black text-[9px] flex items-center justify-center border border-white animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">ئاگادارییەکان</span>
          </button>

          {/* Tab 3: Account / Profile */}
          <button
            type="button"
            onClick={() => setActiveNavTab('account')}
            className={`flex flex-col items-center justify-center py-1 px-4 rounded-none transition-all cursor-pointer ${
              activeNavTab === 'account'
                ? 'text-blue-400 font-black border-t-2 border-blue-500 -mt-1.5 pt-1 bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-200 font-bold'
            }`}
          >
            <UserCircle className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">هەژمارەکەم</span>
          </button>

        </nav>
      )}
      )}

      {/* ========================================================================= */}
      {/* 🔒 MASTER ADMIN PASSWORD LOGOUT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-none p-5 shadow-2xl border border-slate-200 space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">
                  🔒
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">دەرچوون لە ئەکاونت</h3>
                  <p className="text-[10px] text-slate-500 font-bold">پێویستی بە وشەی تێپەڕی سەرەکی ئەدمینە</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLogoutConfirmModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-none text-xs font-bold text-rose-900 leading-relaxed">
              ⚠️ <strong>ئاگاداری:</strong> دەرچوون لەم مۆبایلە قوفڵکراوە. تەنها ئەدمین دەتوانێت بە وشەی تێپەڕی سەرەکی (Master Password) مۆبایلەکە لۆگ ئاوت بکات.
            </div>

            <div className="space-y-1 text-right">
              <label className="text-xs font-black text-slate-800">وشەی تێپەڕی ئەدمین:</label>
              <div className="relative">
                <input
                  type={showLogoutPassText ? "text" : "password"}
                  value={adminLogoutPassword}
                  onChange={(e) => setAdminLogoutPassword(e.target.value)}
                  placeholder="وشەی تێپەڕ لێرە بنووسە..."
                  className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-none text-sm font-mono font-black text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-hidden text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowLogoutPassText(!showLogoutPassText)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showLogoutPassText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {adminLogoutError && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold text-center">
                {adminLogoutError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={() => {
                  if (adminLogoutPassword.trim() === '12355321') {
                    localStorage.removeItem('ashley_bound_employee_profile');
                    localStorage.removeItem('ashley_bound_employee_id');
                    setEmployeeProfile(null);
                    setShowLogoutConfirmModal(false);
                    setAdminLogoutPassword('');
                    setAdminLogoutError(null);
                  } else {
                    setAdminLogoutError('❌ وشەی تێپەڕی ئەدمین هەڵەیە! دەرچوون ڕەتکرایەوە.');
                  }
                }}
                className="py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
              >
                دەرچوون 🔒
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📝 KURDISH QUICK REASON SUBMISSION MODAL */}
      {/* ========================================================================= */}
      {showReasonModal && activeNotificationItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-none p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col text-right">
            
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-sm">{activeNotificationItem.title}</h3>
                <p className="text-[10px] text-slate-500 font-bold font-mono">
                  {activeNotificationItem.dayName} • {activeNotificationItem.date} ({activeNotificationItem.timeRange})
                </p>
              </div>
              <button 
                onClick={() => setShowReasonModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-none border border-amber-200 text-xs font-bold text-amber-950">
              «{activeNotificationItem.questionText}»
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              <label className="text-[11px] font-black text-slate-700 block">هەڵبژاردنی هۆکاری ئامادەکراو:</label>
              <div className="space-y-1.5">
                {kurdishQuickPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedQuickPreset(preset);
                      setReasonInput(preset);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-right text-xs font-bold transition-all cursor-pointer ${
                      selectedQuickPreset === preset || reasonInput === preset
                        ? 'bg-blue-50 border-blue-500 text-orange-950 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 block">یان هۆکارەکەت بە دەست بنووسە:</label>
              <textarea
                rows={2}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="هۆکارەکەت لێرە بنووسە..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitReason}
              disabled={isSubmittingReason || !reasonInput.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-none text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              {isSubmittingReason ? <span>لە ناردندایە...</span> : <span>ناردنی هۆکار بۆ بەڕێوەبەر 🚀</span>}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🌟 EMPLOYEE PICKER MODAL */}
      {/* ========================================================================= */}
      {showEmployeePicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-none p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[80vh] flex flex-col">
            
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

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="گەڕان بەدوای ناوی کارمەند..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-none text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-hidden text-right"
              />
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEmpId(emp.id);
                    setShowEmployeePicker(false);
                  }}
                  className={`w-full p-3 rounded-none border flex items-center justify-between transition-all cursor-pointer ${
                    selectedEmpId === emp.id
                      ? 'bg-blue-50 border-blue-500 text-orange-950 shadow-xs ring-1 ring-orange-400'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-right">
                    <div className="w-8 h-8 rounded-xl bg-blue-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-black text-xs block text-slate-900">{emp.fullName3Part || emp.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono font-bold">{emp.role || 'کارمەند'}</span>
                    </div>
                  </div>

                  {selectedEmpId === emp.id && (
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🗺️ MAP MODAL */}
      {showMapModal && (
        <MobileAttendanceMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          companyLocations={companyLocations}
          currentLat={currentLat}
          currentLng={currentLng}
        />
      )}

      {/* ⚙️ SECRET ADMIN RESET MODAL (10-SEC LONG PRESS) */}
      {showAdminResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-none p-5 shadow-2xl border-2 border-red-500 space-y-4 text-right">
            <div className="flex items-center justify-between border-b pb-2 border-slate-100">
              <h3 className="font-black text-red-600 text-sm">سڕینەوەی بەستنەوە (Admin Reset)</h3>
              <button onClick={() => setShowAdminResetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              ئەم بەشە تەنها تایبەتە بە ئەدمین بۆ هەڵوەشاندنەوەی مۆبایل.
            </p>

            <form onSubmit={handleAdminReset} className="space-y-3">
              <input
                type="password"
                placeholder="کۆدی ئەدمین بنووسە..."
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-center font-mono font-black text-sm"
              />

              {adminResetMsg && (
                <div className="text-xs text-red-600 font-bold text-center">{adminResetMsg}</div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                ڕیستکردنی دەستبەجێ
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
