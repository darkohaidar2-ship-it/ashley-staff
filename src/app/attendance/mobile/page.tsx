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
  FileText
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
  }, []);

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

  // Fetch live today attendance from server API
  const fetchLiveTodayAttendance = useCallback(async () => {
    if (!employeeProfile?.id) return;
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    const storageKey = `ashley_shift_state_${todayIso}_${employeeProfile.id}`;

    try {
      const res = await fetch(`/api/attendance/today?userId=${employeeProfile.id}`);
      const data = await res.json();
      
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
    const interval = setInterval(fetchLiveTodayAttendance, 4000);
    window.addEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ashley_attendance_updated', fetchLiveTodayAttendance);
    };
  }, [fetchLiveTodayAttendance]);

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

  // Handle Permanent Device Binding with auto-checkin
  const handleDeviceBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !pinInput.trim()) {
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

      localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profile));
      localStorage.setItem('ashley_bound_employee_id', selectedEmpId);

      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const nowTimeStr = format(new Date(), 'HH:mm');
      try {
        const autoRes = await fetch('/api/attendance/autonomous-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedEmpId,
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
        localStorage.setItem(`ashley_shift_state_${todayIso}_${selectedEmpId}`, JSON.stringify({
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // 📅 Month Attendance History List for Tab 1
  const [monthAttendanceList, setMonthAttendanceList] = useState<Array<{
    dateStr: string;
    dayName: string;
    checkIn: string;
    checkOut: string;
    workedHours: string;
    status: 'completed' | 'active' | 'anomaly';
    statusLabel: string;
  }>>([]);

  // Load Seed Notifications and Historical Attendance for Logged In Employee
  useEffect(() => {
    if (!employeeProfile?.id) return;
    const empId = employeeProfile.id;
    const isDarko = empId === 'emp-02' || (employeeProfile.name || '').includes('دارکۆ');

    let defaultNotifs: any[] = [];
    if (isDarko) {
      defaultNotifs = [
        {
          id: 'notif-welcome-27',
          date: '2026-08-27',
          dayName: 'پێنجشەممە',
          title: 'بەخێربێیت دارکۆ گیان (هاتن)',
          type: 'welcome',
          timeRange: '08:30',
          durationMinutes: 0,
          questionText: 'هاتنی ئەمڕۆت بە سەرکەوتوویی لە کاتژمێر 08:30 تۆمارکرا.',
          note: 'سیستەمی ئۆتۆنۆمەس ئاشڵی',
          isSubmitted: true,
          timestampStr: 'ئەمڕۆ • 08:30'
        },
        {
          id: 'notif-darko-26-1',
          date: '2026-08-26',
          dayName: 'چوارشەممە',
          title: 'درەنگ هاتن بۆ دەوام',
          type: 'late',
          timeRange: '08:00 ➔ 08:35',
          durationMinutes: 35,
          questionText: 'بەرواری ٢٦-٠٨-٢٠٢٦، چوارشەممە: ٣٥ خولەک درەنگ هاتووی، هۆکارەکەی چییە؟',
          note: '🚗 قەرەباڵغی ڕێگا و ترافیک',
          isSubmitted: true,
          timestampStr: '٢٦ مانگ • 08:35'
        },
        {
          id: 'notif-darko-25-1',
          date: '2026-08-25',
          dayName: 'سێشەممە',
          title: 'دەرچوونی کاتی لە دەوام',
          type: 'excursion',
          timeRange: '10:00 ➔ 10:30',
          durationMinutes: 30,
          questionText: 'بەرواری ٢٥-٠٨-٢٠٢٦، سێشەممە: کاتژمێر 10:00 بۆ 10:30 لە دەوام نەبووی، هۆکارەکەی چییە؟',
          note: '',
          isSubmitted: false,
          timestampStr: '٢٥ مانگ • 10:00'
        },
        {
          id: 'notif-darko-25-2',
          date: '2026-08-25',
          dayName: 'سێشەممە',
          title: 'دەرچوونی کاتی لە دەوام',
          type: 'excursion',
          timeRange: '11:45 ➔ 12:20',
          durationMinutes: 35,
          questionText: 'بەرواری ٢٥-٠٨-٢٠٢٦، سێشەممە: کاتژمێر 11:45 بۆ 12:20 لە دەوام نەبووی، هۆکارەکەی چییە؟',
          note: '',
          isSubmitted: false,
          timestampStr: '٢٥ مانگ • 11:45'
        },
        {
          id: 'notif-darko-25-3',
          date: '2026-08-25',
          dayName: 'سێشەممە',
          title: 'دەرچوونی کاتی لە دەوام',
          type: 'excursion',
          timeRange: '14:00 ➔ 14:40',
          durationMinutes: 40,
          questionText: 'بەرواری ٢٥-٠٨-٢٠٢٦، سێشەممە: کاتژمێر 14:00 بۆ 14:40 لە دەوام نەبووی، هۆکارەکەی چییە؟',
          note: '',
          isSubmitted: false,
          timestampStr: '٢٥ مانگ • 14:00'
        },
        {
          id: 'notif-darko-25-4',
          date: '2026-08-25',
          dayName: 'سێشەممە',
          title: 'دەرچوونی کاتی لە دەوام',
          type: 'excursion',
          timeRange: '15:45 ➔ 16:15',
          durationMinutes: 30,
          questionText: 'بەرواری ٢٥-٠٨-٢٠٢٦، سێشەممە: کاتژمێر 15:45 بۆ 16:15 لە دەوام نەبووی، هۆکارەکەی چییە؟',
          note: '',
          isSubmitted: false,
          timestampStr: '٢٥ مانگ • 15:45'
        }
      ];
    } else {
      defaultNotifs = [
        {
          id: `notif-welcome-${empId}`,
          date: '2026-08-27',
          dayName: 'پێنجشەممە',
          title: `بەخێربێیت ${employeeProfile.name}`,
          type: 'welcome',
          timeRange: '08:30',
          durationMinutes: 0,
          questionText: 'هاتنی ئەمڕۆت بە سەرکەوتوویی تۆمارکرا.',
          note: 'سیستەمی ئۆتۆنۆمەس ئاشڵی',
          isSubmitted: true,
          timestampStr: 'ئەمڕۆ • 08:30'
        }
      ];
    }

    try {
      const saved = localStorage.getItem(`ashley_notifs_${empId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          defaultNotifs = parsed;
        }
      }
    } catch {}

    setNotificationsList(defaultNotifs);

    const defaultHistory: any[] = [
      {
        dateStr: '2026-08-27',
        dayName: 'پێنجشەممە',
        checkIn: liveTodayShift.checkInTime || '08:30',
        checkOut: liveTodayShift.checkOutTime || 'لە دەوامدایە',
        workedHours: liveTodayShift.checkOutTime ? '8.0h' : 'لە دەوامدایە',
        status: liveTodayShift.checkOutTime ? 'completed' : 'active',
        statusLabel: liveTodayShift.checkOutTime ? '✅ تەواوکراو' : '🟢 لە دەوامدایە'
      },
      {
        dateStr: '2026-08-26',
        dayName: 'چوارشەممە',
        checkIn: '08:35',
        checkOut: '17:00',
        workedHours: '8.0h',
        status: 'completed',
        statusLabel: '✅ ٨ کاتژمێری تەواو (بەخشراو)'
      },
      {
        dateStr: '2026-08-25',
        dayName: 'سێشەممە',
        checkIn: '08:00',
        checkOut: '17:00',
        workedHours: '6.5h',
        status: 'anomaly',
        statusLabel: '⚠️ ٤ دەرچوون (چاوەڕوانی تێبینی)'
      },
      {
        dateStr: '2026-08-24',
        dayName: 'دووشەممە',
        checkIn: '08:00',
        checkOut: '17:00',
        workedHours: '8.0h',
        status: 'completed',
        statusLabel: '✅ ٨ کاتژمێری تەواو'
      }
    ];

    setMonthAttendanceList(defaultHistory);

    try {
      const targetEmp = allEmployees.find(e => e.id === empId);
      if (targetEmp?.pin) setProfilePin(targetEmp.pin);

      const savedProf = localStorage.getItem(`ashley_account_${empId}`);
      if (savedProf) {
        const parsed = JSON.parse(savedProf);
        if (parsed.phone) setProfilePhone(parsed.phone);
        if (parsed.address) setProfileAddress(parsed.address);
        if (parsed.emergency) setProfileEmergency(parsed.emergency);
        if (parsed.pin) setProfilePin(parsed.pin);
      }
    } catch {}
  }, [employeeProfile, allEmployees, liveTodayShift.checkInTime, liveTodayShift.checkOutTime]);

  const unreadNotifsCount = useMemo(() => {
    return notificationsList.filter(n => !n.isSubmitted).length;
  }, [notificationsList]);

  // Open note reason modal
  const handleOpenReasonModal = (item: any) => {
    setActiveNotificationItem(item);
    setReasonInput(item.note || '');
    setSelectedQuickPreset(null);
    setShowReasonModal(true);
  };

  // Submit Note Reason
  const handleSubmitReason = async () => {
    if (!activeNotificationItem || !reasonInput.trim()) return;
    setIsSubmittingReason(true);

    try {
      const finalNote = reasonInput.trim();

      const updated = notificationsList.map(n => {
        if (n.id === activeNotificationItem.id) {
          return { ...n, note: finalNote, isSubmitted: true };
        }
        return n;
      });

      setNotificationsList(updated);
      localStorage.setItem(`ashley_notifs_${employeeProfile?.id}`, JSON.stringify(updated));

      await fetch('/api/attendance/excursion-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employeeProfile?.id,
          userName: employeeProfile?.name,
          date: activeNotificationItem.date,
          type: activeNotificationItem.type,
          note: finalNote,
          durationMinutes: activeNotificationItem.durationMinutes,
          exitTime: activeNotificationItem.timeRange.split('➔')[0]?.trim() || '08:35',
          returnTime: activeNotificationItem.timeRange.split('➔')[1]?.trim() || '09:00',
        })
      });

      setShowReasonModal(false);
      setActiveNotificationItem(null);
      setReasonInput('');
      sendLocalNotification('✅ تێبینی نێردرا', 'هۆکارەکەت بە سەرکەوتوویی بۆ بەڕێوەبەر نێردرا.');
    } catch {
      setShowReasonModal(false);
    } finally {
      setIsSubmittingReason(false);
    }
  };

  // Save Employee Profile
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
    return allEmployees.find(e => e.id === selectedEmpId);
  }, [allEmployees, selectedEmpId]);

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
        <div className="max-w-md bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mx-auto text-2xl font-black">
            📱
          </div>
          <h1 className="text-lg font-black text-white">ئەم پەڕەیە تایبەتە بە مۆبایل</h1>
          <p className="text-xs text-slate-300 leading-relaxed font-bold">
            ئەم پۆرتاڵە تایبەتە بە کارمەندان لەسەر مۆبایلەکانیان. بۆ کۆنتڕۆڵ و بەڕێوەبردن لەسەر کۆمپیوتەر، تکایە ڕووپەڕی ئەدمین بەکاربهێنە.
          </p>
          <a
            href="/admin"
            className="inline-block w-full py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-2xl font-black text-xs shadow-lg transition-all"
          >
            چوون بۆ بەشی ئەدمین (Admin Panel)
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans dir-rtl select-none pb-20" dir="rtl">
      
      {/* ========================================================================= */}
      {/* AUTH SCREEN (Device Not Bound) */}
      {/* ========================================================================= */}
      {!employeeProfile ? (
        <div className="flex-1 w-full max-w-sm mx-auto flex flex-col justify-center p-5 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center overflow-hidden shadow-xl border-2 border-orange-400 p-1 bg-white">
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-base font-black text-slate-900">سیستەمی مۆبایلی ئاشڵی</h1>
            <p className="text-xs text-slate-500 font-bold">تکایە ناوی کارمەند و پین کۆد بنووسە بۆ بەستنەوە</p>
          </div>

          <form onSubmit={handleDeviceBinding} className="space-y-3.5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/60">
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
        </div>
      ) : (
        /* ========================================================================= */
        /* LOGGED IN VIEW: 3-TAB BOTTOM NAVIGATION ARCHITECTURE */
        /* ========================================================================= */
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 space-y-4">
          
          {/* Top Universal Clean Header */}
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
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
                <h2 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">{employeeProfile.name}</h2>
                <span className="text-[10px] text-slate-400 font-bold block">ئاشڵی • دەوامی فەرمی</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="p-2 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all cursor-pointer"
                title="نەخشەی لقی کۆمپانیا"
              >
                <MapPin className="w-4 h-4" />
              </button>

              <div className="font-mono font-black text-xs text-orange-700 bg-orange-50 px-2.5 py-1.5 rounded-xl border border-orange-200">
                {currentTimeStr}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: 🕒 ئامادەبوون (Attendance Dashboard & Monthly History) */}
          {/* ========================================================================= */}
          {activeNavTab === 'attendance' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Presence Radar Circle Hero */}
              <div className="flex flex-col items-center justify-center py-2 space-y-3 text-center">
                <div className="relative flex items-center justify-center">
                  <div className={`w-36 h-36 rounded-full border-4 flex items-center justify-center transition-all duration-700 ${
                    presence.isInsideGeofence 
                      ? 'border-emerald-500 bg-emerald-50 shadow-2xl shadow-emerald-500/20 ring-8 ring-emerald-500/10' 
                      : 'border-slate-200 bg-white shadow-lg'
                  }`}>
                    <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all ${
                      presence.isInsideGeofence ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <MapPin className={`w-8 h-8 ${presence.isInsideGeofence ? 'animate-bounce text-white' : 'text-slate-400'}`} />
                      <span className="text-[11px] font-black font-mono mt-0.5">
                        {presence.distanceMeters !== null ? `${presence.distanceMeters.toLocaleString()}m` : '...'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black border ${
                  presence.isInsideGeofence
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
                    : 'bg-slate-200/80 text-slate-700 border-slate-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${presence.isInsideGeofence ? 'bg-emerald-600 animate-ping' : 'bg-slate-500'}`} />
                  <span>{presence.isInsideGeofence ? `🟢 لەناو (${presence.matchedLocationName})` : `🔴 لە دەرەوە (${presence.distanceMeters?.toLocaleString()}m)`}</span>
                </div>
              </div>

              {/* Today's Action Cards (Side-by-Side: Check-In & Check-Out) */}
              <div className="grid grid-cols-2 gap-2.5">
                
                {/* Card 1: Check In */}
                <div className={`p-3 rounded-2xl border text-right space-y-2 transition-all shadow-2xs ${
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

                  <div className={`text-xl font-black font-mono pt-0.5 ${
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
                <div className={`p-3 rounded-2xl border text-right space-y-2 transition-all shadow-2xs ${
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

                  <div className={`text-xl font-black font-mono pt-0.5 ${
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

              {/* Monthly Attendance Records List Section */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <History className="w-4 h-4 text-orange-500" />
                    <span>مێژووی ئامادەبوونی ئەم مانگە (٨-٢٠٢٦)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">ڕۆژەکانی کارکردن</span>
                </div>

                <div className="space-y-2">
                  {monthAttendanceList.map((item) => (
                    <div 
                      key={item.dateStr}
                      className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-xs font-black text-slate-900">{item.dayName}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">({item.dateStr})</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          item.status === 'completed' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : item.status === 'active'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-100 text-amber-900'
                        }`}>
                          {item.statusLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">هاتن</span>
                          <span className="font-mono font-black text-emerald-700">{item.checkIn}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">ڕۆیشتن</span>
                          <span className="font-mono font-black text-slate-800">{item.checkOut}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 block font-bold">کۆی کاتژمێر</span>
                          <span className="font-mono font-black text-orange-600">{item.workedHours}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: 🔔 ئاگادارکردنەوەکان (Notifications & Social Feed) */}
          {/* ========================================================================= */}
          {activeNavTab === 'notifications' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              
              {/* Header & Filter Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                    <Bell className="w-4 h-4 text-orange-500" />
                    <span>ناوەندی ئاگادارکردنەوە و هۆکارەکان</span>
                  </div>
                  {unreadNotifsCount > 0 && (
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                      {unreadNotifsCount} پێویست بە وەڵامە
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('all')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    هەمووی ({notificationsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('pending')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ⚠️ وەڵامنەدراوە ({notificationsList.filter(n => !n.isSubmitted).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsFilter('submitted')}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      notificationsFilter === 'submitted' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✅ نێردراو ({notificationsList.filter(n => n.isSubmitted).length})
                  </button>
                </div>
              </div>

              {/* Feed List */}
              <div className="space-y-3">
                {notificationsList
                  .filter(n => {
                    if (notificationsFilter === 'pending') return !n.isSubmitted;
                    if (notificationsFilter === 'submitted') return n.isSubmitted;
                    return true;
                  })
                  .map((item) => (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-3xl border-2 transition-all space-y-3 text-right shadow-xs ${
                        !item.isSubmitted 
                          ? 'bg-amber-50/90 border-amber-300 shadow-amber-500/10' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {/* Top Row: Type and Time Badge */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          {item.type === 'welcome' ? (
                            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs">🟢</span>
                          ) : item.type === 'late' ? (
                            <span className="p-1.5 bg-amber-100 text-amber-800 rounded-xl text-xs">⏰</span>
                          ) : (
                            <span className="p-1.5 bg-orange-100 text-orange-800 rounded-xl text-xs">🚪</span>
                          )}
                          <span className="text-xs font-black text-slate-900">{item.title}</span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          {item.timestampStr}
                        </span>
                      </div>

                      {/* Question / Prompt Text */}
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          «{item.questionText}»
                        </p>
                        {item.durationMinutes > 0 && (
                          <div className="text-[10px] text-amber-800 font-mono font-bold">
                            ماوەی نەبوون لە دەوام: {item.durationMinutes} خولەک ({item.timeRange})
                          </div>
                        )}
                      </div>

                      {/* Status / Answer Box */}
                      {item.isSubmitted ? (
                        <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
                          <div className="space-y-0.5 text-right">
                            <span className="text-[10px] text-emerald-800 font-black flex items-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>هۆکار نێردراوە بۆ بەڕێوەبەر:</span>
                            </span>
                            <p className="text-xs font-bold text-emerald-950">
                              «{item.note || 'کاری فەرمی'}»
                            </p>
                          </div>

                          {item.type !== 'welcome' && (
                            <button
                              type="button"
                              onClick={() => handleOpenReasonModal(item)}
                              className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl transition-all cursor-pointer"
                            >
                              دەستکاریکردن
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>⚠️ هێشتا پڕ نەکراوەتەوە</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">پێویستە هۆکارەکەی بنووسیت</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenReasonModal(item)}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-2xl text-xs font-black shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>📝 نووسینی هۆکار بۆ بەڕێوەبەر</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: 👤 هەژمارەکەم (Employee Profile & Info) */}
          {/* ========================================================================= */}
          {activeNavTab === 'account' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Profile Top Avatar Header */}
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs text-center space-y-3">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 p-1 shadow-lg shadow-orange-500/20">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-3xl font-black text-slate-800 overflow-hidden">
                      👤
                    </div>
                  </div>
                  <div className="absolute bottom-0 right-0 p-1.5 bg-orange-500 text-white rounded-full shadow-md border-2 border-white cursor-pointer hover:bg-orange-600 transition-all">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">{employeeProfile.name}</h3>
                  <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold">
                    <BadgeCheck className="w-3 h-3 text-orange-600" />
                    <span>{employeeProfile.role || 'کارمەندی فەرمی ئاشڵی'}</span>
                  </div>
                </div>
              </div>

              {/* Editable Info Form */}
              <form onSubmit={handleSaveProfile} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3.5 text-right">
                
                {/* Full Name (Locked) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">ناوی سیانی:</label>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>قوفڵکراوە</span>
                    </span>
                  </div>
                  <input
                    type="text"
                    disabled
                    value={employeeProfile.name}
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-black text-slate-500 cursor-not-allowed text-right"
                  />
                  <span className="text-[9px] text-slate-400 block">ناوی سیانی تەنها لە لایەن ئەدمینەوە دەگۆڕدرێت</span>
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">📱 ژمارەی مۆبایل:</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="0770 000 0000"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold font-mono text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Home Address */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🏠 ناونیشانی نیشتەجێبوون:</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="شار، گەڕەک..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Emergency Contact */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🚨 پەیوەندی کاتی فریاگوزاری:</label>
                  <input
                    type="text"
                    value={profileEmergency}
                    onChange={(e) => setProfileEmergency(e.target.value)}
                    placeholder="ژمارەی کەسی نزیک"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* PIN Code */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">🔑 پین کۆدی نهێنی (PIN):</label>
                    <button
                      type="button"
                      onClick={() => setShowPinText(!showPinText)}
                      className="text-[10px] text-orange-600 font-bold flex items-center gap-1 cursor-pointer"
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
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-black text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden text-right"
                  />
                </div>

                {/* Official Work Location */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🏢 لقی فەرمی کارکردن:</label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>کۆمپانیای سەرەکی ئاشڵی (Ashley Base)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">فەرمی</span>
                  </div>
                </div>

                {profileSaveSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>گۆڕانکارییەکان بە سەرکەوتوویی پاشەکەوت کران</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {isSavingProfile ? <span>لە پاشەکەوتکردندایە...</span> : <span>💾 پاشەکەوتکردنی گۆڕانکارییەکان</span>}
                </button>
              </form>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 📱 SOCIAL MEDIA STYLE BOTTOM NAVIGATION DOCK (STICKY BAR) */}
      {/* ========================================================================= */}
      {employeeProfile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-4 py-2 flex items-center justify-around max-w-md mx-auto w-full">
          
          {/* Tab 1: Attendance */}
          <button
            type="button"
            onClick={() => setActiveNavTab('attendance')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeNavTab === 'attendance'
                ? 'text-orange-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <div className="relative">
              <Clock className={`w-6 h-6 transition-transform ${activeNavTab === 'attendance' ? 'scale-110 text-orange-500' : ''}`} />
            </div>
            <span className="text-[11px] mt-0.5">ئامادەبوون</span>
            {activeNavTab === 'attendance' && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5" />
            )}
          </button>

          {/* Tab 2: Notifications */}
          <button
            type="button"
            onClick={() => setActiveNavTab('notifications')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer relative ${
              activeNavTab === 'notifications'
                ? 'text-orange-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <div className="relative">
              <Bell className={`w-6 h-6 transition-transform ${activeNavTab === 'notifications' ? 'scale-110 text-orange-500' : ''}`} />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-mono font-black text-[10px] flex items-center justify-center border-2 border-white animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-0.5">ئاگادارییەکان</span>
            {activeNavTab === 'notifications' && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5" />
            )}
          </button>

          {/* Tab 3: Account / Profile */}
          <button
            type="button"
            onClick={() => setActiveNavTab('account')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeNavTab === 'account'
                ? 'text-orange-600 font-black'
                : 'text-slate-400 hover:text-slate-600 font-bold'
            }`}
          >
            <div className="relative">
              <User className={`w-6 h-6 transition-transform ${activeNavTab === 'account' ? 'scale-110 text-orange-500' : ''}`} />
            </div>
            <span className="text-[11px] mt-0.5">هەژمارەکەم</span>
            {activeNavTab === 'account' && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5" />
            )}
          </button>
        </nav>
      )}

      {/* ========================================================================= */}
      {/* 📝 KURDISH QUICK REASON SUBMISSION MODAL */}
      {/* ========================================================================= */}
      {showReasonModal && activeNotificationItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col text-right">
            
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

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs font-bold text-amber-950">
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
                        ? 'bg-orange-50 border-orange-400 text-orange-950 shadow-xs'
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden text-right"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitReason}
              disabled={isSubmittingReason || !reasonInput.trim()}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
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
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[80vh] flex flex-col">
            
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
              <input
                type="text"
                placeholder="گەڕان بەدوای ناوی کارمەند..."
                value={employeeSearchQuery}
                onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                className="w-full p-3 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>

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

                    <div className="text-slate-400 text-xs">➔</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🔐 SECRET ADMIN RESET MODAL */}
      {/* ========================================================================= */}
      {showAdminResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-sm">کردنەوەی بەستنەوەی مۆبایل</h3>
              <p className="text-[11px] text-slate-500 font-bold">تکایە کۆدی ئەدمین بنووسە بۆ ڕیستکردن</p>
            </div>

            <form onSubmit={handleAdminReset} className="space-y-3">
              <input
                type="password"
                placeholder="کۆدی ئەدمین"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono font-black text-sm text-slate-900 focus:border-rose-500 focus:bg-white focus:outline-hidden"
              />

              {adminResetMsg && (
                <div className="text-xs text-rose-600 font-bold">{adminResetMsg}</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all"
                >
                  ڕیستکردن
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminResetModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗺️ MAP MODAL */}
      {/* ========================================================================= */}
      {showMapModal && (
        <MobileAttendanceMapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          companyLocations={companyLocations}
          currentLat={currentLat}
          currentLng={currentLng}
          isInsideGeofence={presence.isInsideGeofence}
          distanceMeters={presence.distanceMeters}
          matchedLocationName={presence.matchedLocationName}
        />
      )}

    </div>
  );
}
