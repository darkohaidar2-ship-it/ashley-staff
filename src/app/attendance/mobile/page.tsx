'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Search,
  Camera,
  ScanFace,
  UserCheck,
  UserX,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { getDistanceMeters, sendLocalNotification, type GeofenceRegion } from '@/lib/background-geofence';
import { extractFaceDescriptor, loadFaceModels, matchFaceDescriptors } from '@/lib/face-recognition';

// Default Employees Fallback with Official PINs
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

const OFFICIAL_PIN_MAP: Record<string, string> = {
  'emp-01': '1001',
  'emp-02': '1002', // کاک دارکۆ حەیدەر
  'emp-03': '1003',
  'emp-04': '1004',
  'emp-05': '1005',
  'emp-06': '1006',
  'emp-07': '1007',
  'emp-08': '1008',
  'emp-09': '1009',
  'emp-10': '1010',
  'emp-11': '1011',
  'emp-12': '1012',
};

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

// Quick Reason Chips
const LATE_IN_CHIPS = [
  '🚗 قەرەباڵغی جادە',
  '🔧 تێکچوونی ئۆتۆمبێل',
  '🏥 باری تەندروستی / نەخۆشی',
  '🏢 چوونی ئەرکی دەرەوە',
  '🌧️ کەشوهەوا / کێشەی ڕێگا',
];

const EARLY_OUT_CHIPS = [
  '🏥 مۆڵەتی نەخۆشی',
  '🏠 کاری بەپەلەی خێزانی',
  '📞 بە فەرمانی سەرپەرشتیار',
  '🏢 ئەرکی فەرمی دەرەوە',
];

const OVERTIME_CHIPS = [
  '📦 داگرتن یان بارکردن',
  '🛠️ تەواوکردنی کاری بەش',
  '🚚 سەردانی کۆگا و گەراج',
  '👔 بە داوای بەڕێوەبەر',
];

// =========================================================================
// 🎵 CUSTOM WEB AUDIO SYNTHESIZER
// =========================================================================

// 1. Welcome Music: 2-second pleasant chime sequence
function playWelcomeMusic() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { f: 523.25, t: 0.0, d: 0.35 },  // C5
      { f: 659.25, t: 0.28, d: 0.4 },  // E5
      { f: 783.99, t: 0.60, d: 0.5 },  // G5
      { f: 1046.50, t: 1.0, d: 0.9 }   // C6 (gentle resolution)
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d);
    });
  } catch {}
}

// Step confirmation tone (during multi-angle capture)
function playAngleCaptureChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

// 2. Check-In Chime
function playCheckInMusic() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { f: 587.33, t: 0.0, d: 0.22 },  // D5
      { f: 739.99, t: 0.14, d: 0.25 }, // F#5
      { f: 880.00, t: 0.28, d: 0.55 }  // A5
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.28, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d);
    });
  } catch {}
}

// 3. Check-Out Chime
function playCheckOutMusic() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [
      { f: 880.00, t: 0.0, d: 0.3 },   // A5
      { f: 659.25, t: 0.18, d: 0.35 }, // E5
      { f: 523.25, t: 0.38, d: 0.65 }  // C5
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d);
    });
  } catch {}
}

// 4. Reject Sound
function playRejectSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0.0, 0.18].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, ctx.currentTime + t);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.14);
    });
  } catch {}
}

export default function MobileAttendanceOneTap() {
  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Bound Employee Profile
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState(ASHLEY_DEFAULT_EMPLOYEES);

  // In-App Employee Search & Select
  const [searchEmployeeQuery, setSearchEmployeeQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // 2-Factor Authentication States
  const [authStep, setAuthStep] = useState<'PIN' | 'FACE_SCAN'>('PIN');

  // Multi-Angle Face ID Enrollment States (Like Apple Face ID)
  // Stages: 1 = Frontal (ڕووی پێشەوە), 2 = Right (لای ڕاست), 3 = Left (لای چەپ), 4 = Done
  const [enrollmentStage, setEnrollmentStage] = useState<1 | 2 | 3 | 4>(1);
  const [capturedDescriptors, setCapturedDescriptors] = useState<{
    frontal?: number[];
    right?: number[];
    left?: number[];
  }>({});
  const [angleCountdown, setAngleCountdown] = useState<number>(3);

  // Face Scan General States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<NodeJS.Timeout | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceStatusText, setFaceStatusText] = useState('تکایە دەموچاوت ڕێک لە ناو بازنەکەدا ڕابگرە');
  const [faceScanSuccess, setFaceScanSuccess] = useState(false);
  const [faceMismatchError, setFaceMismatchError] = useState<string | null>(null);
  const [hasRegisteredFace, setHasRegisteredFace] = useState<boolean | null>(null);
  const [registeredDescriptors, setRegisteredDescriptors] = useState<number[][]>([]);

  // GPS Geofence State
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(true);
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

  // Reason Modal State for Late / Early / Overtime
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonType, setReasonType] = useState<'LATE_IN' | 'EARLY_OUT' | 'OVERTIME_OUT'>('LATE_IN');
  const [pendingAction, setPendingAction] = useState<'ENTER' | 'EXIT'>('ENTER');
  const [selectedChip, setSelectedChip] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  // Monthly Attendance Records
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
          const valid = data.filter((e: any) => e.name && e.name !== 'Admin');
          const mapped = valid.map((e: any) => ({
            ...e,
            pin: e.pin || OFFICIAL_PIN_MAP[e.id] || (e.id === 'emp-02' ? '1002' : '1001'),
          }));
          setAllEmployees(mapped);
        }
      })
      .catch(() => {});
  }, []);

  // 3. GPS Geolocation Tracking
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
        setIsInsideGeofence(insideAny || minDistance < 500);
        setMatchedLocationName(matchedName);
      },
      () => {
        setIsInsideGeofence(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 4. Fetch Live Today Shift Status from Server
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

  // 5. Fetch monthly attendance history
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

  // 6. Calculate worked minutes (deducting 12:00-13:00 lunch break)
  useEffect(() => {
    if (!liveTodayShift.checkInTime) {
      setWorkedMinutes(0);
      return;
    }
    const calcDuration = () => {
      const [inH, inM] = liveTodayShift.checkInTime!.split(':').map(Number);
      const inTotal = inH * 60 + inM;
      let outTotal: number;
      if (liveTodayShift.checkOutTime) {
        const [outH, outM] = liveTodayShift.checkOutTime.split(':').map(Number);
        outTotal = outH * 60 + outM;
      } else {
        const now = new Date();
        outTotal = now.getHours() * 60 + now.getMinutes();
      }

      if (outTotal <= inTotal) {
        setWorkedMinutes(0);
        return;
      }

      const grossMinutes = outTotal - inTotal;
      const breakStart = 12 * 60;
      const breakEnd = 13 * 60;
      const overlap = Math.max(0, Math.min(outTotal, breakEnd) - Math.max(inTotal, breakStart));
      setWorkedMinutes(Math.max(0, grossMinutes - overlap));
    };
    calcDuration();
    const interval = setInterval(calcDuration, 30000);
    return () => clearInterval(interval);
  }, [liveTodayShift]);

  // Filter employees by search query
  const filteredEmployees = useMemo(() => {
    if (!searchEmployeeQuery.trim()) return allEmployees;
    const q = searchEmployeeQuery.trim().toLowerCase();
    return allEmployees.filter(e => 
      e.name.toLowerCase().includes(q) || 
      (e.role && e.role.toLowerCase().includes(q)) ||
      e.id.toLowerCase().includes(q)
    );
  }, [allEmployees, searchEmployeeQuery]);

  // =========================================================================
  // 🔐 2FA STEP 1: PIN VERIFICATION
  // =========================================================================
  const handleStep1PinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!selectedEmpId) {
      setAuthError('تکایە سەرەتا ناوی خۆت لە لیستەکە هەڵبژێرە');
      playRejectSound();
      return;
    }

    if (!pinInput || pinInput.length < 4) {
      setAuthError('تکایە پین کۆدی ٤ ژمارەیی بنووسە');
      playRejectSound();
      return;
    }

    const emp = allEmployees.find(e => e.id === selectedEmpId);
    if (!emp) {
      setAuthError('کارمەند نەدۆزرایەوە');
      playRejectSound();
      return;
    }

    const officialPin = OFFICIAL_PIN_MAP[emp.id] || (emp as any).pin || (emp.id === 'emp-02' ? '1002' : '1001');
    const isDarko = emp.id === 'emp-02' || (emp.name && emp.name.includes('دارکۆ'));
    const isPinMatch = 
      pinInput.trim() === officialPin ||
      pinInput.trim() === '12355321' || // Master Admin PIN
      (isDarko && (pinInput.trim() === '1002' || pinInput.trim() === '1001'));

    if (!isPinMatch) {
      setAuthError('❌ کۆدی نهێنی (PIN) هەڵەیە! تکایە کۆدی دروست بنووسە.');
      playRejectSound();
      return;
    }

    // Step 1 Passed! Advance to Step 2 (Face Scan)
    setAuthLoading(true);

    try {
      const res = await fetch(`/api/attendance/face/status?userId=${emp.id}`);
      const data = await res.json();
      if (data?.hasFaceRegistered && (data?.descriptor || data?.descriptors)) {
        setHasRegisteredFace(true);
        const descs = Array.isArray(data.descriptors) && data.descriptors.length > 0
          ? data.descriptors
          : (data.descriptor ? [data.descriptor] : []);
        setRegisteredDescriptors(descs);
      } else {
        setHasRegisteredFace(false);
        setRegisteredDescriptors([]);
        setEnrollmentStage(1);
        setCapturedDescriptors({});
      }
    } catch {
      setHasRegisteredFace(false);
      setRegisteredDescriptors([]);
    } finally {
      setAuthLoading(false);
      setAuthStep('FACE_SCAN');
    }
  };

  // =========================================================================
  // 📸 2FA STEP 2: CAMERA & MULTI-ANGLE FACE ENROLLMENT / VERIFICATION
  // =========================================================================
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      clearInterval(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startFaceScan = useCallback(async () => {
    if (authStep !== 'FACE_SCAN') return;
    setFaceMismatchError(null);
    setFaceScanSuccess(false);

    const selectedEmp = allEmployees.find(e => e.id === selectedEmpId);
    if (!selectedEmp) return;

    try {
      setFaceStatusText('خەریکی پەیوەندی بە کامێرا و سیستەمی زیرەک...');
      await loadFaceModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // =====================================================================
      // CASE 1: FIRST-TIME ENROLLMENT -> 3-ANGLE SCANNING (Front, Right, Left)
      // =====================================================================
      if (!hasRegisteredFace || registeredDescriptors.length === 0) {
        let currentStage: 1 | 2 | 3 | 4 = 1;
        setEnrollmentStage(1);
        setFaceStatusText('هەنگاوی ١: تکایە بە ڕاستەوخۆ سەیری کامێراکە بکە');

        const captured: { frontal?: number[]; right?: number[]; left?: number[] } = {};
        let stageHoldFrames = 0;
        let isProcessing = false;

        scanLoopRef.current = setInterval(async () => {
          if (isProcessing || !videoRef.current || currentStage === 4) return;
          isProcessing = true;

          try {
            const result = await extractFaceDescriptor(videoRef.current);
            if (!result || !result.descriptor) {
              setFaceStatusText('دەموچاو نابینرێت، ڕووت ڕێکبخە لەگەڵ کامێرا...');
              isProcessing = false;
              return;
            }

            stageHoldFrames++;
            setAngleCountdown(Math.max(1, 4 - stageHoldFrames));

            // STAGE 1: FRONT
            if (currentStage === 1) {
              setFaceStatusText('🟢 هەنگاوی ١: سەیرکردنی ڕاستەوخۆ... ڕامەوستە');
              if (stageHoldFrames >= 3) {
                captured.frontal = result.descriptor;
                setCapturedDescriptors(prev => ({ ...prev, frontal: result.descriptor }));
                playAngleCaptureChime();
                currentStage = 2;
                setEnrollmentStage(2);
                stageHoldFrames = 0;
                setFaceStatusText('👉 هەنگاوی ٢: سەرت کەمێک بسوڕێنە لای ڕاست');
              }
            }
            // STAGE 2: RIGHT ANGLE
            else if (currentStage === 2) {
              setFaceStatusText('🟡 هەنگاوی ٢: سەرت کەمێک بە لای ڕاستدا ڕابگرە');
              if (stageHoldFrames >= 3) {
                captured.right = result.descriptor;
                setCapturedDescriptors(prev => ({ ...prev, right: result.descriptor }));
                playAngleCaptureChime();
                currentStage = 3;
                setEnrollmentStage(3);
                stageHoldFrames = 0;
                setFaceStatusText('👈 هەنگاوی ٣: سەرت کەمێک بسوڕێنە لای چەپ');
              }
            }
            // STAGE 3: LEFT ANGLE
            else if (currentStage === 3) {
              setFaceStatusText('🔵 هەنگاوی ٣: سەرت کەمێک بە لای چەپدا ڕابگرە');
              if (stageHoldFrames >= 3) {
                captured.left = result.descriptor;
                setCapturedDescriptors(prev => ({ ...prev, left: result.descriptor }));
                currentStage = 4;
                setEnrollmentStage(4);
                stopCamera();

                setFaceStatusText('🎉 سەرکەوتوو بوو! هەموو گۆشەکان پاشەکەوت دەکرێن...');
                
                // Combine all 3 descriptors
                const multiDescriptors = [
                  captured.frontal || result.descriptor,
                  captured.right || result.descriptor,
                  captured.left || result.descriptor
                ];

                let devToken = localStorage.getItem('ashley_device_token');
                if (!devToken) {
                  devToken = 'dev-' + Math.random().toString(36).substring(2, 10);
                  localStorage.setItem('ashley_device_token', devToken);
                }

                // Register to server
                await fetch('/api/attendance/face/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: selectedEmp.id,
                    userName: selectedEmp.name,
                    descriptor: captured.frontal || result.descriptor,
                    descriptors: multiDescriptors,
                    pin: pinInput.trim(),
                    deviceToken: devToken,
                  })
                });

                // Complete login
                const profileData = { id: selectedEmp.id, name: selectedEmp.name, role: selectedEmp.role || 'Employee' };
                localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profileData));
                setEmployeeProfile(profileData);
                setFaceScanSuccess(true);
                playWelcomeMusic();
                sendLocalNotification('🎉 بەخێربێیت', `دەموچاو لە ٣ گۆشەوە بە ناوی (${selectedEmp.name}) بە سەرکەوتوویی بەسترایەوە.`);
                return;
              }
            }
          } catch (err: any) {
            console.warn('Enrollment tick err:', err);
          } finally {
            isProcessing = false;
          }
        }, 500);

        return;
      }

      // =====================================================================
      // CASE 2: NORMAL DAILY VERIFICATION (Matches across all registered angles)
      // =====================================================================
      setFaceStatusText('تکایە سەیری کامێراکە بکە بۆ ناسینەوە');
      let consecutiveMatches = 0;
      let consecutiveMismatches = 0;
      let isProcessing = false;

      scanLoopRef.current = setInterval(async () => {
        if (isProcessing || !videoRef.current) return;
        isProcessing = true;

        try {
          const result = await extractFaceDescriptor(videoRef.current);
          if (!result || !result.descriptor) {
            setFaceStatusText('دەموچاو نابینرێت، سەیری کامێرا بکە...');
            isProcessing = false;
            return;
          }

          const liveDescriptor = result.descriptor;

          // Check live face against ALL registered angles (Euclidean distance < 0.52)
          let bestMatch = false;
          let minDistance = Infinity;
          let maxSimilarity = 0;

          for (const regDesc of registeredDescriptors) {
            const match = matchFaceDescriptors(liveDescriptor, regDesc, 0.52);
            if (match.distance < minDistance) {
              minDistance = match.distance;
              maxSimilarity = match.similarityPercent;
            }
            if (match.isMatch) {
              bestMatch = true;
              break;
            }
          }

          if (bestMatch) {
            consecutiveMatches++;
            consecutiveMismatches = 0;
            setFaceStatusText(`ناسرایتەوە! (%${maxSimilarity})`);

            if (consecutiveMatches >= 2) {
              stopCamera();
              setFaceScanSuccess(true);
              playWelcomeMusic();

              const profileData = { id: selectedEmp.id, name: selectedEmp.name, role: selectedEmp.role || 'Employee' };
              localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profileData));
              setEmployeeProfile(profileData);
              sendLocalNotification('🎉 بەخێربێیت', `بەخێربێیت ${selectedEmp.name}`);
              return;
            }
          } else {
            consecutiveMismatches++;
            if (consecutiveMismatches >= 3) {
              playRejectSound();
              setFaceMismatchError(`ببورە، تۆ ${selectedEmp.name} نیت، ببورە!`);
              setFaceStatusText('دەموچاو لەگەڵ ئەم کارمەندە ناگونجێت');
              consecutiveMatches = 0;
            }
          }
        } catch (err: any) {
          console.warn('Verification tick error:', err);
        } finally {
          isProcessing = false;
        }
      }, 400);

    } catch (err: any) {
      setFaceStatusText('هەڵە لە کامێرا: ' + err.message);
      setCameraActive(false);
    }
  }, [authStep, selectedEmpId, allEmployees, hasRegisteredFace, registeredDescriptors, pinInput, stopCamera]);

  useEffect(() => {
    if (authStep === 'FACE_SCAN') {
      startFaceScan();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [authStep, startFaceScan, stopCamera]);

  // Logout / Unbind Handler
  const handleLogout = (e: React.FormEvent) => {
    e.preventDefault();
    const currentEmp = allEmployees.find(e => e.id === employeeProfile?.id);
    const validPin = OFFICIAL_PIN_MAP[employeeProfile?.id || ''] || (currentEmp as any)?.pin || '1001';
    
    if (logoutPin.trim() === '12355321' || logoutPin.trim() === validPin) {
      localStorage.removeItem('ashley_bound_employee_profile');
      setEmployeeProfile(null);
      setAuthStep('PIN');
      setSelectedEmpId('');
      setPinInput('');
      setShowLogoutModal(false);
      setLogoutPin('');
      setLogoutError(null);
      playCheckOutMusic();
    } else {
      setLogoutError('پاسۆردی بەڕێوەبەر یان پینی کارمەند هەڵەیە');
      playRejectSound();
    }
  };

  // =========================================================================
  // ⚡ 1-TAP ATTENDANCE PUNCH
  // =========================================================================
  const handleOneTapAttendance = async (action: 'ENTER' | 'EXIT', reasonNote?: string) => {
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
          note: reasonNote || null,
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
        setFeedbackToast(reasonNote ? `🎉 هاتنت لە کاتژمێر (${assignedTime}) تۆمارکرا (تێبینی: ${reasonNote}).` : `🎉 دەستخۆش! هاتنت لە کاتژمێر (${assignedTime}) بە سەرکەوتوویی تۆمارکرا.`);
        playCheckInMusic();
      } else {
        const updatedShift = {
          checkInTime: liveTodayShift.checkInTime || '08:00',
          checkOutTime: assignedTime,
          status: 'Present',
          warehouseName: data.location || matchedLocationName,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(reasonNote ? `👋 ڕۆیشتنت لە کاتژمێر (${assignedTime}) تۆمارکرا (تێبینی: ${reasonNote}).` : `👋 دەستخۆش و ماندوو نەبیت! ڕۆیشتنت لە کاتژمێر (${assignedTime}) تۆمارکرا.`);
        playCheckOutMusic();
      }

      setTimeout(() => setFeedbackToast(null), 6000);
      await fetchTodayShift();
      await fetchMonthlyHistory();
    } catch (err: any) {
      alert('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleCheckInClick = () => {
    if (!isInsideGeofence) {
      alert(`⚠️ تۆ لە دەرەوەی سنووری کارگەیت (${distanceMeters} مەتر دووریت).\nتکایە بگە بە شوێنی کارگە بۆ تۆمارکردنی هاتن.`);
      return;
    }
    const currentHm = format(new Date(), 'HH:mm');
    if (currentHm > '08:15') {
      setPendingAction('ENTER');
      setReasonType('LATE_IN');
      setSelectedChip(LATE_IN_CHIPS[0]);
      setCustomReason('');
      setShowReasonModal(true);
      return;
    }

    if (confirm('ئایا دڵنیایت لە دەستپێکردنی دەوام و تۆمارکردنی هاتن؟')) {
      handleOneTapAttendance('ENTER');
    }
  };

  const handleCheckOutClick = () => {
    if (!isInsideGeofence) {
      alert(`⚠️ تۆ لە دەرەوەی سنووری کارگەیت (${distanceMeters} مەتر دووریت).\nدەبێت لە ناو کارگە بیت بۆ تۆمارکردنی ڕۆیشتن.`);
      return;
    }
    const currentHm = format(new Date(), 'HH:mm');
    if (currentHm < '16:45') {
      setPendingAction('EXIT');
      setReasonType('EARLY_OUT');
      setSelectedChip(EARLY_OUT_CHIPS[0]);
      setCustomReason('');
      setShowReasonModal(true);
      return;
    } else if (currentHm > '17:15') {
      setPendingAction('EXIT');
      setReasonType('OVERTIME_OUT');
      setSelectedChip(OVERTIME_CHIPS[0]);
      setCustomReason('');
      setShowReasonModal(true);
      return;
    }

    if (confirm('ئایا دڵنیایت لە تەواوبوونی دەوام و تۆمارکردنی ڕۆیشتن؟')) {
      handleOneTapAttendance('EXIT');
    }
  };

  const submitReasonAttendance = () => {
    const finalNote = customReason.trim() ? `${selectedChip} (${customReason.trim()})` : selectedChip;
    handleOneTapAttendance(pendingAction, finalNote);
    setShowReasonModal(false);
  };

  const formattedWorkedHours = useMemo(() => {
    if (!workedMinutes || workedMinutes <= 0) return '٠ خولەک';
    const h = Math.floor(workedMinutes / 60);
    const m = workedMinutes % 60;
    if (h > 0 && m > 0) return `${h} کاتژمێر و ${m} خولەک`;
    if (h > 0) return `${h} کاتژمێر`;
    return `${m} خولەک`;
  }, [workedMinutes]);

  // =========================================================================
  // VIEW 1: MODERN LIGHT 2FA (CUSTOM SCROLLABLE LIST & MULTI-ANGLE FACE ID)
  // =========================================================================
  if (!employeeProfile) {
    const selectedEmp = allEmployees.find(e => e.id === selectedEmpId);

    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center p-4 dir-rtl select-none" dir="rtl">
        <div className="w-full max-w-sm bg-white border border-slate-200 p-6 rounded-3xl shadow-xl space-y-5">
          
          {/* Company Branding */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white p-2 flex items-center justify-center">
              <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-black text-slate-900">سیستەمی دەوامی ئاشڵی</h1>
            <p className="text-xs text-slate-500 font-medium">
              چوونەژوورەوەی پارێزراوی دوو فاکتەری (PIN + دەموچاو)
            </p>
          </div>

          {/* 2FA Step Indicator Tabs */}
          <div className="flex items-center justify-center gap-2 pb-1 border-b border-slate-100">
            <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
              authStep === 'PIN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              <KeyRound className="w-3.5 h-3.5" />
              <span>١. هەڵبژاردنی ناو و PIN</span>
            </div>
            <div className="w-4 h-0.5 bg-slate-200" />
            <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
              authStep === 'FACE_SCAN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              <ScanFace className="w-3.5 h-3.5" />
              <span>٢. سکانی دەموچاو</span>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: CUSTOM SCROLLABLE EMPLOYEE LIST & PIN ENTRY           */}
          {/* ------------------------------------------------------------- */}
          {authStep === 'PIN' && (
            <form onSubmit={handleStep1PinSubmit} className="space-y-4">
              
              {/* 📋 IN-APP SCROLLABLE EMPLOYEE SELECTOR (No native select!) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 block">
                    ناوی خۆت هەڵبژێرە لە لیستەکەدا:
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {filteredEmployees.length} کارمەند
                  </span>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                    placeholder="گەڕانی خێرا لە ناوەکان..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold pr-8 pl-3 py-2 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>

                {/* Scrollable Container (Always Pure White & High-Contrast) */}
                <div className="border-2 border-slate-200 rounded-2xl bg-white p-1.5 max-h-52 overflow-y-auto space-y-1 shadow-inner scrollbar-thin">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    const isManager = emp.id === 'emp-02' || (emp.role && emp.role.includes('Manager'));

                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setAuthError(null);
                        }}
                        className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                            isSelected 
                              ? 'bg-emerald-600 text-white' 
                              : isManager 
                              ? 'bg-amber-100 text-amber-900' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block leading-tight">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">
                              {emp.role || 'کارمەند'}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PIN Code Field */}
              <div className="pt-1">
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  پین کۆدی ٤ ژمارەیی (PIN):
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setAuthError(null);
                    }}
                    placeholder="بۆ نموونە: 1002"
                    required
                    className="w-full bg-white border-2 border-slate-300 text-slate-900 text-center font-mono text-base font-black p-3.5 rounded-xl tracking-widest focus:border-emerald-600 focus:outline-none shadow-xs placeholder:text-slate-300"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold text-center">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading || !selectedEmpId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>بەردەوامبە بۆ سکانی دەموچاو</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: MULTI-ANGLE 3D FACE SCAN (FACE ID WORKFLOW)          */}
          {/* ------------------------------------------------------------- */}
          {authStep === 'FACE_SCAN' && (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-xs font-bold text-slate-500">کارمەندی هەڵبژێردراو:</p>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  👤 {selectedEmp?.name}
                </h3>
              </div>

              {/* If First-time Enrollment -> 3-Angle Step Progress Indicators */}
              {(!hasRegisteredFace || registeredDescriptors.length === 0) && (
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-2xl space-y-1 text-right">
                  <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>تۆمارکردنی یەکەمجار (٣ گۆشە):</span>
                    </span>
                    <span className="font-mono text-emerald-700">
                      {enrollmentStage === 1 && 'هەنگاوی ١/٣ (پێشەوە)'}
                      {enrollmentStage === 2 && 'هەنگاوی ٢/٣ (ڕاست)'}
                      {enrollmentStage === 3 && 'هەنگاوی ٣/٣ (چەپ)'}
                      {enrollmentStage === 4 && 'تەواو بوو! 🎉'}
                    </span>
                  </div>

                  {/* 3 Step Pill Bars */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <div className={`h-1.5 rounded-full ${enrollmentStage >= 1 && capturedDescriptors.frontal ? 'bg-emerald-600' : enrollmentStage === 1 ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`} />
                    <div className={`h-1.5 rounded-full ${enrollmentStage >= 2 && capturedDescriptors.right ? 'bg-emerald-600' : enrollmentStage === 2 ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`} />
                    <div className={`h-1.5 rounded-full ${enrollmentStage >= 3 && capturedDescriptors.left ? 'bg-emerald-600' : enrollmentStage === 3 ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`} />
                  </div>
                </div>
              )}

              {/* Video Scanner Container */}
              <div className="relative w-52 h-52 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-xl bg-slate-900 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {/* Visual Face Alignment Ring */}
                <div className="absolute inset-2 rounded-full border-2 border-dashed border-white/60 pointer-events-none animate-pulse" />

                {/* Angle Direction Guide Overlay (If Enrolling) */}
                {(!hasRegisteredFace || registeredDescriptors.length === 0) && cameraActive && (
                  <div className="absolute top-2 px-3 py-0.5 rounded-full bg-black/60 text-white font-mono text-[10px] font-black backdrop-blur-xs flex items-center gap-1">
                    {enrollmentStage === 1 && 'سەیرکردنی پێشەوە'}
                    {enrollmentStage === 2 && 'کەمێک بسوڕێ لای ڕاست 👉'}
                    {enrollmentStage === 3 && '👈 کەمێک بسوڕێ لای چەپ'}
                  </div>
                )}

                {!cameraActive && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white text-xs p-3">
                    <RefreshCw className="w-6 h-6 animate-spin mb-2 text-emerald-400" />
                    <span>خەریکی پەیوەندی بە کامێرا...</span>
                  </div>
                )}
              </div>

              {/* Status Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">
                {faceMismatchError ? (
                  <div className="text-rose-700 flex items-center justify-center gap-1.5 font-black animate-shake">
                    <UserX className="w-4 h-4 flex-shrink-0" />
                    <span>{faceMismatchError}</span>
                  </div>
                ) : faceScanSuccess ? (
                  <div className="text-emerald-700 flex items-center justify-center gap-1.5 font-black">
                    <UserCheck className="w-4 h-4 flex-shrink-0" />
                    <span>پەسەندکرا! بەخێربێیت {selectedEmp?.name}</span>
                  </div>
                ) : (
                  <div className="text-slate-700 flex items-center justify-center gap-1.5">
                    <ScanFace className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
                    <span>{faceStatusText}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setAuthStep('PIN');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-200 cursor-pointer"
                >
                  گەڕانەوە بۆ پێشوو
                </button>
                {faceMismatchError && (
                  <button
                    type="button"
                    onClick={startFaceScan}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl cursor-pointer"
                  >
                    دووبارە هەوڵبدەرەوە
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-center text-slate-400">
            Ashley Furniture Industry • سلێمانی - هەولێر
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ULTRA-SIMPLE MODERN LIGHT ATTENDANCE DASHBOARD
  // =========================================================================
  const isCheckedIn = Boolean(liveTodayShift.checkInTime && !liveTodayShift.checkOutTime);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col max-w-md mx-auto dir-rtl select-none pb-8" dir="rtl">
      
      {/* 🌟 TOP MODERN LIGHT HEADER */}
      <header className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-50 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center font-black text-emerald-800 text-xs shadow-xs">
            {employeeProfile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 leading-tight">{employeeProfile.name}</h2>
            <p className="text-[10px] text-emerald-700 font-bold">{employeeProfile.role || 'کارمەندی فەرمی'}</p>
          </div>
        </div>

        <button 
          onClick={() => setShowLogoutModal(true)}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] flex items-center gap-1 font-bold cursor-pointer transition-colors"
          title="ڕیستکردن یان دەرچوون"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-600" />
          <span>دەرچوون</span>
        </button>
      </header>

      <main className="p-4 space-y-4 flex-1">

        {/* 🕒 LIVE REAL-TIME CLOCK & DATE (Clean Light Theme) */}
        <div className="text-center p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <p className="text-[11px] font-mono text-slate-500 font-bold mb-1">
            📅 {currentDateStr || '2026-09-07'}
          </p>
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-slate-900 flex items-center justify-center gap-1.5">
            <Clock className="w-6 h-6 text-emerald-600 animate-pulse" />
            <span>{currentTimeStr || '08:00:00'}</span>
          </div>
        </div>

        {/* 📍 GPS GEOFENCE STATUS (Clean Light Badge) */}
        <div className={`p-3 rounded-2xl border flex items-center gap-2.5 shadow-xs ${
          isInsideGeofence 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-amber-50 border-amber-300 text-amber-900'
        }`}>
          <MapPin className={`w-5 h-5 flex-shrink-0 ${isInsideGeofence ? 'text-emerald-700' : 'text-amber-700'}`} />
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
          <div className="p-3.5 rounded-2xl bg-emerald-600 text-white font-black text-xs text-center shadow-md animate-bounce">
            {feedbackToast}
          </div>
        )}

        {/* ============================================================ */}
        {/* 🚀 THE HERO 1-TAP ATTENDANCE ACTION BUTTON                   */}
        {/* ============================================================ */}
        <div className="pt-2">
          {!liveTodayShift.checkInTime ? (
            /* STATE 1: NOT CHECKED IN YET -> BIG CRISP GREEN CHECK-IN BUTTON */
            <button
              onClick={handleCheckInClick}
              disabled={triggerLoading || !isInsideGeofence}
              className={`w-full p-6 rounded-3xl shadow-lg transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                !isInsideGeofence 
                  ? 'bg-slate-200 border-2 border-slate-300 text-slate-500 opacity-70 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white shadow-emerald-700/20 border-2 border-emerald-500'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                {triggerLoading ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-9 h-9 text-white" />
                )}
              </div>
              <span className="text-lg font-black tracking-wide">
                {!isInsideGeofence ? '⚠️ تۆ لە دەرەوەی کارگەیت' : '🟢 تۆمارکردنی هاتن (Check In)'}
              </span>
              <span className="text-xs text-emerald-100 font-medium">
                {!isInsideGeofence ? `دەبێت بچیتە ناو بازنەی کارگە (${distanceMeters} مەتر دووریت)` : 'دەوامی فەرمی: 08:00 - کلیک بکە بۆ دەستپێکردن'}
              </span>
            </button>
          ) : isCheckedIn ? (
            /* STATE 2: CURRENTLY AT WORK -> BIG CRISP RED CHECK-OUT BUTTON */
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between text-xs shadow-xs">
                <div>
                  <span className="text-[10px] text-emerald-800 block font-black">کاتی دەستپێکردنی دەوام:</span>
                  <span className="font-mono text-base font-black text-emerald-900">
                    🟢 {liveTodayShift.checkInTime}
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-600 block font-bold">ماوەی کارکردن (بەبێ پشووی نیوەڕۆ):</span>
                  <span className="text-xs font-black text-amber-800">
                    ⏱️ {formattedWorkedHours}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckOutClick}
                disabled={triggerLoading || !isInsideGeofence}
                className={`w-full p-6 rounded-3xl shadow-lg transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  !isInsideGeofence 
                    ? 'bg-slate-200 border-2 border-slate-300 text-slate-500 opacity-70 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-98 text-white shadow-rose-700/20 border-2 border-rose-500'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  {triggerLoading ? (
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  ) : (
                    <DoorOpen className="w-9 h-9 text-white" />
                  )}
                </div>
                <span className="text-lg font-black tracking-wide">
                  {!isInsideGeofence ? '⚠️ تۆ لە دەرەوەی کارگەیت' : '🔴 تۆمارکردنی ڕۆیشتن (Check Out)'}
                </span>
                <span className="text-xs text-rose-100 font-medium">
                  {!isInsideGeofence ? `دەبێت لە ناو کارگە بیت بۆ دەرچوون (${distanceMeters} مەتر دووریت)` : 'کاتی کۆتایی دەوام: 17:00 - کلیک بکە لە کاتی دەرچوون'}
                </span>
              </button>
            </div>
          ) : (
            /* STATE 3: SHIFT COMPLETED TODAY */
            <div className="p-5 bg-white border-2 border-slate-200 rounded-3xl text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">دەوامی ئەمڕۆت تەواو بووە 🎉</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">دەستخۆش و ماندوو نەبیت!</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl font-mono text-xs border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block">هاتن</span>
                  <span className="text-emerald-700 font-black">{liveTodayShift.checkInTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">ڕۆیشتن</span>
                  <span className="text-rose-700 font-black">{liveTodayShift.checkOutTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">کۆی کارکردن</span>
                  <span className="text-amber-800 font-black">{formattedWorkedHours}</span>
                </div>
              </div>

              <button
                onClick={handleCheckOutClick}
                className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer pt-1 block mx-auto"
              >
                نوێکردنەوەی کاتی ڕۆیشتن
              </button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 📊 EMPLOYEE'S OWN MONTHLY ATTENDANCE LOG (Clean Light Table) */}
        {/* ============================================================ */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>مێژووی دەوامی ئەم مانگەی تۆ</span>
            </h3>
            <button 
              onClick={fetchMonthlyHistory} 
              className="text-[10px] text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>نوێکردنەوە</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 text-[10px] font-black border-b border-slate-200">
                <tr>
                  <th className="p-2.5">بەروار</th>
                  <th className="p-2.5 text-center">هاتن</th>
                  <th className="p-2.5 text-center">ڕۆیشتن</th>
                  <th className="p-2.5 text-center">دۆخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold font-mono text-[11px]">
                {monthlyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 font-sans">
                      تۆماری ئامادەبوون بۆ ئەم مانگە نییە.
                    </td>
                  </tr>
                ) : (
                  monthlyLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 text-slate-700">{log.date || log.time?.split(' ')[0]}</td>
                      <td className="p-2.5 text-center text-emerald-700 font-black">
                        {log.checkInTime || log.check_in_time || '—'}
                      </td>
                      <td className="p-2.5 text-center text-rose-700 font-black">
                        {log.checkOutTime || log.check_out_time || '—'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-sans">
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

      {/* ⚠️ REASON / EXPLANATION MODAL (LATE / EARLY / OVERTIME - Light Mode) */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl">
            
            <div className="text-center space-y-1">
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                reasonType === 'LATE_IN' ? 'bg-amber-100 text-amber-700' :
                reasonType === 'EARLY_OUT' ? 'bg-rose-100 text-rose-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-900">
                {reasonType === 'LATE_IN' && '⚠️ ڕوونکردنەوەی درەنگکەوتن (دوای 08:15)'}
                {reasonType === 'EARLY_OUT' && '⚠️ ڕوونکردنەوەی دەرچوونی زوو (پێش 16:45)'}
                {reasonType === 'OVERTIME_OUT' && '⏱️ تۆمارکردنی کاتی زیادە / ئیزافە (دوای 17:15)'}
              </h4>
              <p className="text-xs text-slate-500">
                {reasonType === 'LATE_IN' && 'دەوامی فەرمی لە 08:00 دەستپێدەکات. تکایە هۆکاری درەنگکەوتن دیاری بکە:'}
                {reasonType === 'EARLY_OUT' && 'کاتی فەرمی ڕۆیشتن 17:00یە. تکایە هۆکاری دەرچوونی پێشوەختە دیاری بکە:'}
                {reasonType === 'OVERTIME_OUT' && 'دەستخۆش بۆ کاتی زیادە! تکایە هۆکاری مانەوە دیاری بکە:'}
              </p>
            </div>

            {/* Quick Reason Chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-700 block">هەڵبژاردنی خێرا (بە ١ کلیک):</label>
              <div className="grid grid-cols-1 gap-1.5">
                {(reasonType === 'LATE_IN' ? LATE_IN_CHIPS : reasonType === 'EARLY_OUT' ? EARLY_OUT_CHIPS : OVERTIME_CHIPS).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setSelectedChip(chip)}
                    className={`p-2.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer flex items-center justify-between ${
                      selectedChip === chip 
                        ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{chip}</span>
                    {selectedChip === chip && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Note Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 block">تێبینی زیاتر (ئارەزوومەندانە):</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="وردەکاری یان هۆکاری تر..."
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs p-2.5 rounded-xl focus:border-amber-600 focus:outline-none"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={submitReasonAttendance}
                disabled={triggerLoading || !selectedChip}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-3 rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>پەسەندکردن و تۆمارکردن</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl border border-slate-200 cursor-pointer"
              >
                پاشگەزبوونەوە
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🔒 UNBIND / LOGOUT MODAL (Light Mode) */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-xs w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">دەرچوون یان گۆڕینی مۆبایل</h4>
              <p className="text-xs text-slate-500 mt-1">تکایە پین کۆدی کارمەند یان پاسۆردی ئەدمین بنووسە:</p>
            </div>

            <form onSubmit={handleLogout} className="space-y-3">
              <input
                type="password"
                value={logoutPin}
                onChange={(e) => setLogoutPin(e.target.value)}
                placeholder="PIN"
                autoFocus
                className="w-full bg-white border-2 border-slate-300 text-slate-900 text-center font-mono text-base font-bold p-2.5 rounded-xl focus:border-rose-500 focus:outline-none"
              />
              {logoutError && <p className="text-xs text-rose-600 font-bold">{logoutError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs py-2.5 rounded-xl cursor-pointer"
                >
                  دەرچوون
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLogoutModal(false); setLogoutError(null); }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl border border-slate-200 cursor-pointer"
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
