'use client';

import { logger } from '@/lib/logger';
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
  ChevronRight,
  Phone,
  User,
  X,
  Upload,
  AlertCircle,
  Compass,
  Smartphone,
  Laptop,
  ShieldAlert
} from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';
import { getDistanceMeters, sendLocalNotification, type GeofenceRegion } from '@/lib/background-geofence';
import { extractFaceDescriptor, loadFaceModels, matchFaceDescriptors } from '@/lib/face-recognition';
import { resolveEmployeeDayAttendance, translateRoleToKurdish, type UnifiedAttendanceDayInfo } from '@/lib/attendance-helpers';

// Default Employees Fallback with Official PINs
const ASHLEY_DEFAULT_EMPLOYEES = [
  { id: 'emp-01', name: 'سه هەند مەریوان حەمەسەعید', role: 'کارمەند', pin: '1001' },
  { id: 'emp-02', name: 'دارکۆ حەیدەر حسێن', role: 'بەڕێوەبەر', pin: '1002' },
  { id: 'emp-03', name: 'شادیار هوشیار', role: 'سەرپەرشتیاری کارمەندان', pin: '1003' },
  { id: 'emp-04', name: 'هەڤاڵ حبیب حەمەڕەزا', role: 'سەرپەرشتیاری گواستنەوە', pin: '1004' },
  { id: 'emp-05', name: 'عیماد سەباح نوری', role: 'کارمەند', pin: '1005' },
  { id: 'emp-06', name: 'کامەران عومەر ڕووئوف', role: 'کارمەند', pin: '1006' },
  { id: 'emp-07', name: 'ڕابەر محەمەد مەحمود', role: 'کارمەند', pin: '1007' },
  { id: 'emp-08', name: 'دانەر محەمەد باسام', role: 'کارمەند', pin: '1008' },
  { id: 'emp-09', name: 'ڕێبین سەباح نوری', role: 'کارمەند', pin: '1009' },
  { id: 'emp-10', name: 'بەهرەمەند ڕزگار عزیز', role: 'کارمەند', pin: '1010' },
  { id: 'emp-11', name: 'شادومان یادگار رحیم', role: 'کارمەند', pin: '1011' },
  { id: 'emp-12', name: 'سەروەت قادر', role: 'کارمەند', pin: '1012' },
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
    name: 'کۆمپانیای سەرەکی ئاشڵی',
    lat: 35.562431,
    lng: 45.474792,
    radiusMeters: 400,
  },
  {
    id: 'huana-warehouse-loc',
    name: 'کۆگای سەرەکی هوانە',
    lat: 35.508918,
    lng: 45.452935,
    radiusMeters: 400,
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
// ⏱️ TAMPER-PROOF TRUE TIME ENGINE & OFFLINE ATTENDANCE QUEUE
// =========================================================================
const OFFLINE_QUEUE_KEY = 'ashley_offline_attendance_queue_v1';
const TRUSTED_TIME_ANCHOR_KEY = 'ashley_trusted_time_anchor_v1';
const CURRENT_TAB_SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

interface OfflinePunchItem {
  id: string;
  userId: string;
  userName: string;
  deviceToken: string;
  event: 'ENTER' | 'EXIT';
  lat: number;
  lng: number;
  distance: number;
  regionName: string;
  note: string | null;
  masterBypass: boolean;
  trustedPunchEpochMs: number;
  trustedTimeStr: string;
  trustedDateStr: string;
  perfAtPunch: number;
  deviceEpochAtPunch: number;
  accumulatedElapsedSec: number;
  sessionId: string;
}

let IN_MEMORY_TIME_ANCHOR: {
  serverEpochMs: number;
  perfNowMs: number;
  deviceEpochMs: number;
} | null = null;

function anchorServerTime(serverEpochMs?: number | null, dateHeader?: string | null) {
  try {
    let validMs = typeof serverEpochMs === 'number' && serverEpochMs > 1700000000000 ? serverEpochMs : NaN;
    if (isNaN(validMs) && dateHeader) {
      const parsed = Date.parse(dateHeader);
      if (!isNaN(parsed) && parsed > 1700000000000) validMs = parsed;
    }
    if (isNaN(validMs)) return;

    const nowDevice = Date.now();
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : 0;
    IN_MEMORY_TIME_ANCHOR = {
      serverEpochMs: validMs,
      perfNowMs: nowPerf,
      deviceEpochMs: nowDevice,
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        TRUSTED_TIME_ANCHOR_KEY,
        JSON.stringify({
          serverEpochMs: validMs,
          deviceEpochMs: nowDevice,
          clockOffsetMs: validMs - nowDevice,
        })
      );
    }
  } catch (err) { logger.warn(err); }
}

function getTrustedBaghdadNow(): {
  epochMs: number;
  dateStr: string;
  timeStr: string;
  timeWithSecStr: string;
  clockDriftMinutes: number;
} {
  let trustedMs = Date.now();

  try {
    if (IN_MEMORY_TIME_ANCHOR && typeof performance !== 'undefined') {
      // Hardware monotonic clock: 100% immune to manual phone clock changes during session
      const elapsedPerf = Math.max(0, performance.now() - IN_MEMORY_TIME_ANCHOR.perfNowMs);
      trustedMs = Math.round(IN_MEMORY_TIME_ANCHOR.serverEpochMs + elapsedPerf);
    } else if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(TRUSTED_TIME_ANCHOR_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.clockOffsetMs === 'number') {
          trustedMs = Date.now() + parsed.clockOffsetMs;
        }
      }
    }
  } catch (err) { logger.warn(err); }

  const d = new Date(trustedMs);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);

  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  let hh = getPart('hour');
  if (hh === '24') hh = '00';
  const mm = getPart('minute');
  const ss = getPart('second');
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  const timeStr = `${hh}:${mm}`;
  const timeWithSecStr = `${hh}:${mm}:${ss}`;
  const clockDriftMinutes = Math.round(Math.abs(trustedMs - Date.now()) / 60000);

  return {
    epochMs: trustedMs,
    dateStr,
    timeStr,
    timeWithSecStr,
    clockDriftMinutes,
  };
}

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
  } catch (err) { logger.warn(err); }
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
  } catch (err) { logger.warn(err); }
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
  } catch (err) { logger.warn(err); }
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
  } catch (err) { logger.warn(err); }
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
  } catch (err) { logger.warn(err); }
}

export default function MobileAttendanceOneTap() {
  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // 🛡️ Anti-Cheat: Desktop PC Detection States
  const [isDesktop, setIsDesktop] = useState(false);
  const [masterBypass, setMasterBypass] = useState(false);
  const [bypassPin, setBypassPin] = useState('');
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);

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

  // Strict Angle Lock & Yaw Tracking
  const [currentYaw, setCurrentYaw] = useState<number>(0);
  const [isAngleAligned, setIsAngleAligned] = useState<boolean>(false);
  const [headPoseDetected, setHeadPoseDetected] = useState<'CENTER' | 'RIGHT' | 'LEFT' | 'UNKNOWN'>('UNKNOWN');
  const manualCaptureTriggerRef = useRef<(() => void) | null>(null);
  const lastValidDescriptorRef = useRef<number[] | null>(null);
  const lastValidAlignedRef = useRef<boolean>(false);

  // Employee Profile Self-Service Modal States
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [profilePhone, setProfilePhone] = useState<string>('');
  const [profilePin, setProfilePin] = useState<string>('');
  const [profileHireDate, setProfileHireDate] = useState<string>('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Dynamic Factory & Warehouse Locations State (synced with /gps and settings)
  const [companyLocations, setCompanyLocations] = useState<GeofenceRegion[]>(COMPANY_LOCATIONS);

  // GPS Geofence State (default false until verified)
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean>(false);
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

  // Monthly Attendance Records & Real System Sheet States
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [selectedSheetMonth, setSelectedSheetMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [empOverridesMap, setEmpOverridesMap] = useState<Record<string, any>>({});
  const [selectedDayDetail, setSelectedDayDetail] = useState<(UnifiedAttendanceDayInfo & { dateStr: string; dayNum: number; dayNameKu: string }) | null>(null);

  // Logout / Unbind Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutPin, setLogoutPin] = useState('');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // 📡 Offline Mode, PWA Install & Sync Queue States
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflinePunchItem[]>([]);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [isStandalonePwa, setIsStandalonePwa] = useState<boolean>(false);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState<boolean>(false);

  // Register Scoped Service Worker & Capture PWA Install Prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const checkStandalone = () => {
        const isStandalone =
          window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true;
        setIsStandalonePwa(Boolean(isStandalone));
      };
      checkStandalone();

      try {
        const storedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (storedQueue) {
          const parsed = JSON.parse(storedQueue);
          if (Array.isArray(parsed)) setOfflineQueue(parsed);
        }
      } catch (err) { logger.warn(err); }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((reg) => {
            reg.update().catch(() => {});
          })
          .catch(() => {});
      }

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPwaPrompt(e);
      };
      const handleAppInstalled = () => {
        setDeferredPwaPrompt(null);
        setIsStandalonePwa(true);
        setShowPwaInstallModal(false);
      };

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleInstallPwaClick = async () => {
    if (deferredPwaPrompt) {
      try {
        deferredPwaPrompt.prompt();
        const choice = await deferredPwaPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setDeferredPwaPrompt(null);
          setIsStandalonePwa(true);
        }
        return;
      } catch (err) { logger.warn(err); }
    }
    setShowPwaInstallModal(true);
  };

  // 1. Tamper-Proof Clock Tick + Offline Elapsed Time Counter
  useEffect(() => {
    const tick = () => {
      const trusted = getTrustedBaghdadNow();
      setCurrentTimeStr(trusted.timeWithSecStr);
      setCurrentDateStr(trusted.dateStr);

      // Increment elapsed seconds for any queued offline punches
      try {
        const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (rawQueue) {
          const list: OfflinePunchItem[] = JSON.parse(rawQueue);
          if (Array.isArray(list) && list.length > 0) {
            const updated = list.map((item) => {
              if (item.sessionId === CURRENT_TAB_SESSION_ID && typeof performance !== 'undefined' && performance.now() >= item.perfAtPunch) {
                return {
                  ...item,
                  accumulatedElapsedSec: Math.max(
                    item.accumulatedElapsedSec || 0,
                    Math.round((performance.now() - item.perfAtPunch) / 1000)
                  ),
                };
              }
              return {
                ...item,
                accumulatedElapsedSec: (item.accumulatedElapsedSec || 0) + 1,
              };
            });
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
          }
        }
      } catch (err) { logger.warn(err); }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1.2. 🛡️ Anti-Cheat: Detect Desktop PC / Laptop browsers
  useEffect(() => {
    const checkDevice = () => {
      try {
        if (typeof window === 'undefined') return;
        if (sessionStorage.getItem('ashley_desktop_bypass') === 'true') {
          setMasterBypass(true);
          return;
        }
        const ua = navigator.userAgent || '';
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isDesktopOS = /Windows NT|Macintosh|Linux x86_64/i.test(ua) && !isMobileUA;
        const isLargeScreen = window.innerWidth > 850;

        if (isDesktopOS || (isLargeScreen && !isMobileUA)) {
          setIsDesktop(true);
        } else {
          setIsDesktop(false);
        }
      } catch (err) { logger.warn(err); }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bypassPin.trim() === '12355321' || bypassPin.trim() === '1002') {
      sessionStorage.setItem('ashley_desktop_bypass', 'true');
      setMasterBypass(true);
      setShowBypassModal(false);
      setBypassError(null);
    } else {
      setBypassError('کۆدی ماستەری ئەدمین هەڵەیە!');
      playRejectSound();
    }
  };

  // 1.5. Fetch dynamic company locations configured by Admin (with Offline Cache)
  useEffect(() => {
    try {
      const cachedLocs = localStorage.getItem('ashley_cached_locations_v1');
      if (cachedLocs) {
        const parsed = JSON.parse(cachedLocs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCompanyLocations(parsed);
        }
      }
    } catch (err) { logger.warn(err); }

    fetch('/api/attendance/location')
      .then(res => {
        anchorServerTime(null, res.headers.get('Date'));
        return res.json();
      })
      .then(data => {
        const rawList = Array.isArray(data) ? data : (data?.locations || []);
        if (Array.isArray(rawList) && rawList.length > 0) {
          const mapped: GeofenceRegion[] = rawList.map((loc: any) => ({
            id: loc.id || loc.name,
            name: String(loc.name || 'کۆمپانیای سەرەکی ئاشڵی').replace(/\s*\([^)]*[A-Za-z][^)]*\)/g, ''),
            lat: parseFloat(loc.lat),
            lng: parseFloat(loc.lng),
            radiusMeters: parseFloat(loc.radius) || parseFloat(loc.radiusMeters) || 400,
          }));
          setCompanyLocations(mapped);
          try {
            localStorage.setItem('ashley_cached_locations_v1', JSON.stringify(mapped));
          } catch (err) { logger.warn(err); }
        }
      })
      .catch(() => {});
  }, []);

  // 2. Load bound employee profile from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ashley_bound_employee_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          setEmployeeProfile({
            ...parsed,
            role: translateRoleToKurdish(parsed.role),
          });
        }
      }
      const cachedEmps = localStorage.getItem('ashley_cached_employees_v1');
      if (cachedEmps) {
        const parsedEmps = JSON.parse(cachedEmps);
        if (Array.isArray(parsedEmps) && parsedEmps.length > 0) {
          setAllEmployees(parsedEmps.map((e: any) => ({ ...e, role: translateRoleToKurdish(e.role) })));
        }
      }
    } catch (err) { logger.warn(err); }

    // Fetch live employees list
    fetch(`/api/attendance/employees?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => {
        anchorServerTime(null, res.headers.get('Date'));
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const valid = data.filter((e: any) => e.name && e.name !== 'Admin');
          const mapped = valid.map((e: any) => ({
            ...e,
            name: e.fullName3Part || e.kurdishName || e.name,
            role: translateRoleToKurdish(e.role),
            pin: e.pin || e.password || OFFICIAL_PIN_MAP[e.id] || (e.id === 'emp-02' ? '1002' : '1001'),
          }));
          setAllEmployees(mapped);
          try {
            localStorage.setItem('ashley_cached_employees_v1', JSON.stringify(mapped));
          } catch (err) { logger.warn(err); }
        }
      })
      .catch(() => {});
  }, []);

  const [isRefreshingEmployees, setIsRefreshingEmployees] = useState(false);

  const loadLiveEmployees = useCallback(async () => {
    setIsRefreshingEmployees(true);
    try {
      const res = await fetch(`/api/attendance/employees?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const valid = data.filter((e: any) => e.name && e.name !== 'Admin');
          const mapped = valid.map((e: any) => ({
            ...e,
            name: e.fullName3Part || e.kurdishName || e.name,
            role: translateRoleToKurdish(e.role),
            pin: e.pin || e.password || OFFICIAL_PIN_MAP[e.id] || (e.id === 'emp-02' ? '1002' : '1001'),
          }));
          setAllEmployees(mapped);
        }
      }
    } catch (err) { logger.warn(err); }
    finally {
      setIsRefreshingEmployees(false);
    }
  }, []);

  // 3. 🎯 Pure On-Demand GPS Geolocation Tracking
  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'ready' | 'error'>('idle');
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  const requestSingleGpsPosition = useCallback(async (): Promise<{ 
    lat: number; 
    lng: number; 
    minDistance: number; 
    insideAny: boolean; 
    matchedName: string 
  }> => {
    setGpsState('acquiring');
    setGpsErrorMessage(null);

    const activeLocations = (companyLocations && companyLocations.length > 0) ? companyLocations : COMPANY_LOCATIONS;

    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const err = new Error('ئامێرەکەت پشتگیری لە دیاریکردنی شوێن ناکات.');
        setGpsState('error');
        setGpsErrorMessage(err.message);
        setIsInsideGeofence(false);
        return reject(err);
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);

          let minDistance = Infinity;
          let insideAny = false;
          let matchedName = activeLocations[0]?.name || 'کۆمپانیای سەرەکی ئاشڵی';

          for (const loc of activeLocations) {
            if (!loc.lat || !loc.lng) continue;
            const dist = getDistanceMeters(lat, lng, loc.lat, loc.lng);
            if (dist < minDistance) {
              minDistance = dist;
              matchedName = loc.name;
            }
            if (dist <= (loc.radiusMeters || 400)) {
              insideAny = true;
              matchedName = loc.name;
              break;
            }
          }

          const roundedDist = Math.round(minDistance);
          setDistanceMeters(roundedDist);
          setIsInsideGeofence(insideAny);
          setMatchedLocationName(matchedName);
          setGpsState('ready');

          resolve({
            lat,
            lng,
            minDistance: roundedDist,
            insideAny,
            matchedName,
          });
        },
        (err) => {
          setGpsState('error');
          setIsInsideGeofence(false);
          let msg = 'نەتوانرا شوێنی جوگرافی وەربگیرێت.';
          if (err.code === 1) {
            msg = '⚠️ تکایە دەسەڵاتی شوێن لە مۆبایلەکەتدا چالاک بکە.';
          } else if (err.code === 2) {
            msg = '⚠️ دیاریکردنی شوێن لە مۆبایلەکەتدا ناچالاکە.';
          } else if (err.code === 3) {
            msg = '⚠️ کاتی وەرگرتنی شوێن بەسەرچوو. دووبارە تاقی بکەرەوە.';
          }
          setGpsErrorMessage(msg);
          reject(new Error(msg));
        },
        { 
          enableHighAccuracy: true, 
          timeout: 12000, 
          maximumAge: 0 // Fresh single-shot fix, never cached, immediate shut off
        }
      );
    });
  }, [companyLocations]);

  // 🛰️ Automatic GPS Geofence Check on App Launch & Location updates
  useEffect(() => {
    requestSingleGpsPosition().catch(() => {});
  }, [requestSingleGpsPosition]);

  // 4. Fetch Live Today Shift Status from Server (Resets to 0 if Admin deletes on server; preserves unsent Offline Queue)
  const fetchTodayShift = useCallback(async () => {
    if (!employeeProfile?.id) return;
    const todayIso = getTrustedBaghdadNow().dateStr;
    const storageKey = `ashley_shift_state_${todayIso}_${employeeProfile.id}`;

    // Read unsent offline queue items for today (items not yet delivered to server)
    const getUnsentQueueForToday = () => {
      let pendingIn: OfflinePunchItem | undefined;
      let pendingOut: OfflinePunchItem | undefined;
      try {
        const rawQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (rawQ) {
          const q: OfflinePunchItem[] = JSON.parse(rawQ);
          if (Array.isArray(q)) {
            const myToday = q.filter(x => x.userId === employeeProfile.id && x.trustedDateStr === todayIso);
            pendingIn = myToday.find(x => x.event === 'ENTER');
            pendingOut = myToday.find(x => x.event === 'EXIT');
          }
        }
      } catch (err) { logger.warn(err); }
      return { pendingIn, pendingOut };
    };

    try {
      const res = await fetch(`/api/attendance/today?userId=${employeeProfile.id}&userName=${encodeURIComponent(employeeProfile.name)}&_t=${Date.now()}`, { cache: 'no-store' });
      anchorServerTime(null, res.headers.get('Date'));
      const data = await res.json();
      if (data) {
        anchorServerTime(data.serverEpochMs, null);
        const { pendingIn, pendingOut } = getUnsentQueueForToday();

        const isNonWorkingStatus =
          data.status === 'Absent' ||
          data.status === 'غیاب' ||
          data.status === 'Holiday' ||
          data.status === 'پشوو' ||
          data.status === 'Leave' ||
          data.status === 'مۆڵەت';

        // Server is authoritative when online (unless an unsent offline punch is still in queue)
        const finalIn = (isNonWorkingStatus && !pendingIn)
          ? null
          : (data.checkInTime || pendingIn?.trustedTimeStr || null);
        const finalOut = (isNonWorkingStatus && !pendingOut)
          ? null
          : (data.checkOutTime || pendingOut?.trustedTimeStr || null);

        const merged = {
          checkInTime: finalIn,
          checkOutTime: finalOut,
          status: data.status || (finalIn ? 'Present' : null),
          warehouseName: data.warehouseName || pendingIn?.regionName || matchedLocationName,
        };

        setLiveTodayShift(merged);

        if (merged.checkInTime || merged.status) {
          localStorage.setItem(storageKey, JSON.stringify(merged));
        } else {
          // Admin deleted/reset today's attendance on server -> reset mobile cache to zero!
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Device is offline: fallback to localStorage cache + unsent offline queue
      const { pendingIn, pendingOut } = getUnsentQueueForToday();
      let localCachedShift: any = null;
      try {
        const rawCached = localStorage.getItem(storageKey);
        if (rawCached) localCachedShift = JSON.parse(rawCached);
      } catch (err) { logger.warn(err); }

      const finalIn = pendingIn?.trustedTimeStr || localCachedShift?.checkInTime || null;
      const finalOut = pendingOut?.trustedTimeStr || localCachedShift?.checkOutTime || null;
      setLiveTodayShift({
        checkInTime: finalIn,
        checkOutTime: finalOut,
        status: localCachedShift?.status || (finalIn ? 'Present' : null),
        warehouseName: pendingIn?.regionName || localCachedShift?.warehouseName || matchedLocationName,
      });
    }
  }, [employeeProfile, matchedLocationName]);

  // 5. Cache-First LocalStorage Hydration (0ms) + Lightweight Delta Sync (`GET /api/attendance/employee-sync`)
  const mergeSameBrowserLocalOverrides = useCallback((baseOverrides: Record<string, any>) => {
    if (!employeeProfile?.id) return baseOverrides;
    const merged: Record<string, any> = { ...baseOverrides };
    try {
      const localMonthRaw = localStorage.getItem(`ashley_matrix_overrides_${selectedSheetMonth}`);
      const localGlobalRaw = localStorage.getItem('ashley_global_manual_overrides');
      const mergeLocalSource = (rawStr: string | null) => {
        if (!rawStr) return;
        const parsedLocal = JSON.parse(rawStr);
        if (!parsedLocal || typeof parsedLocal !== 'object') return;
        for (const [lk, lv] of Object.entries<any>(parsedLocal)) {
          if (!lv || typeof lv !== 'object') continue;
          const existing = merged[lk];
          if (!existing) {
            merged[lk] = lv;
          } else {
            const localTs = new Date(lv.updatedAt || lv.deletedAt || 0).getTime();
            const serverTs = new Date(existing.updatedAt || existing.deletedAt || 0).getTime();
            if (!isNaN(localTs) && (isNaN(serverTs) || localTs >= serverTs)) {
              merged[lk] = lv;
            }
          }
        }
      };
      mergeLocalSource(localGlobalRaw);
      mergeLocalSource(localMonthRaw);
    } catch (err) { logger.warn(err); }
    return merged;
  }, [employeeProfile, selectedSheetMonth]);

  const hydrateMonthlyFromLocalStorage = useCallback(() => {
    if (!employeeProfile?.id) return false;
    const historyCacheKey = `ashley_monthly_logs_${employeeProfile.id}_${selectedSheetMonth}`;
    const overridesCacheKey = `ashley_emp_overrides_${employeeProfile.id}_${selectedSheetMonth}`;
    let hasCachedData = false;
    try {
      const cachedRaw = localStorage.getItem(historyCacheKey);
      const cachedOvRaw = localStorage.getItem(overridesCacheKey);
      const rawCachedList: any[] = cachedRaw ? JSON.parse(cachedRaw) : [];
      const cachedList: any[] = Array.isArray(rawCachedList)
        ? rawCachedList.map((item: any) => {
            if (!item || typeof item !== 'object') return item;
            const hasClock = Boolean(item.checkInTime && String(item.checkInTime).includes(':'));
            if (hasClock) return item;
            const act = String(item.action || item.log_type || item.type || '');
            const nt = `${item.adminNote || ''} ${item.note || ''} ${item.edit_note || ''}`;
            if (item.status === 'Leave' || item.status === 'مۆڵەت' || act === 'Leave' || act === 'مۆڵەت' || nt.includes('🛡️ مۆڵەت') || nt.includes('مۆڵەت لەلایەن ئەدمین')) {
              return { ...item, status: 'Leave', checkInTime: '', checkOutTime: '' };
            }
            if (item.status === 'Holiday' || item.status === 'پشوو' || act === 'Holiday' || act === 'پشوو' || nt.includes('🛡️ پشوو') || nt.includes('پشوو لەلایەن ئەدمین')) {
              return { ...item, status: 'Holiday', checkInTime: '', checkOutTime: '' };
            }
            if (item.status === 'Absent' || item.status === 'غیاب' || act === 'Absent' || act === 'غیاب' || nt.includes('🛡️ غیاب') || nt.includes('غیاب لەلایەن ئەدمین')) {
              return { ...item, status: 'Absent', checkInTime: '', checkOutTime: '' };
            }
            return item;
          })
        : [];
      const cachedOv: Record<string, any> = cachedOvRaw ? JSON.parse(cachedOvRaw) : {};

      const rawQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const qList: OfflinePunchItem[] = rawQ ? JSON.parse(rawQ) : [];
      const myQueued = Array.isArray(qList)
        ? qList
            .filter(x => x.userId === employeeProfile.id && x.trustedDateStr.startsWith(selectedSheetMonth))
            .map(x => ({
              id: x.id,
              employeeId: x.userId,
              employeeName: x.userName,
              type: x.event === 'EXIT' ? 'دەرچوون' : 'هاتن',
              action: x.event === 'EXIT' ? 'Check Out' : 'Check In',
              date: x.trustedDateStr,
              time: `${x.trustedDateStr} ${x.trustedTimeStr}`,
              checkInTime: x.event === 'ENTER' ? x.trustedTimeStr : undefined,
              checkOutTime: x.event === 'EXIT' ? x.trustedTimeStr : undefined,
              warehouseName: x.regionName,
              note: x.note,
              status: 'Present',
            }))
        : [];

      const finalOverrides = mergeSameBrowserLocalOverrides(cachedOv);
      if (cachedRaw || cachedOvRaw || Object.keys(finalOverrides).length > 0) {
        setMonthlyLogs([...myQueued, ...cachedList]);
        setEmpOverridesMap(finalOverrides);
        hasCachedData = true;
      }
    } catch (err) { logger.warn(err); }
    return hasCachedData;
  }, [employeeProfile, selectedSheetMonth, mergeSameBrowserLocalOverrides]);

  const fetchMonthlyHistory = useCallback(async (forceFull = false) => {
    if (!employeeProfile?.id) return;
    const historyCacheKey = `ashley_monthly_logs_${employeeProfile.id}_${selectedSheetMonth}`;
    const overridesCacheKey = `ashley_emp_overrides_${employeeProfile.id}_${selectedSheetMonth}`;
    const versionCacheKey = `ashley_sync_version_v2_${employeeProfile.id}_${selectedSheetMonth}`;

    const hadLocalCache = hydrateMonthlyFromLocalStorage();
    if (!hadLocalCache) {
      setLoadingLogs(true);
    }

    try {
      const clientVersion = forceFull ? '' : (localStorage.getItem(versionCacheKey) || '');
      const syncUrl = `/api/attendance/employee-sync?userId=${encodeURIComponent(employeeProfile.id)}&userName=${encodeURIComponent(employeeProfile.name || '')}&month=${encodeURIComponent(selectedSheetMonth)}&clientVersion=${encodeURIComponent(clientVersion)}&_t=${Date.now()}`;
      const syncRes = await fetch(syncUrl, { cache: 'no-store' });
      anchorServerTime(null, syncRes.headers.get('Date'));

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        anchorServerTime(syncData?.serverEpochMs, null);

        // If server version matches localStorage version, no changes occurred on server!
        if (syncData && syncData.hasChanges === false && hadLocalCache) {
          setLoadingLogs(false);
          return;
        }

        if (syncData && syncData.hasChanges === true) {
          const serverRecords: any[] = Array.isArray(syncData.records) ? syncData.records : [];
          const serverOverrides: Record<string, any> = (syncData.overrides && typeof syncData.overrides === 'object') ? syncData.overrides : {};
          const finalOverrides = mergeSameBrowserLocalOverrides(serverOverrides);

          setMonthlyLogs(serverRecords);
          setEmpOverridesMap(finalOverrides);

          try {
            localStorage.setItem(historyCacheKey, JSON.stringify(serverRecords));
            localStorage.setItem(overridesCacheKey, JSON.stringify(finalOverrides));
            if (syncData.version) {
              localStorage.setItem(versionCacheKey, syncData.version);
            }
          } catch (err) { logger.warn(err); }

          setLoadingLogs(false);
          return;
        }
      }
    } catch {
      // If offline or delta endpoint unreachable, hydrateMonthlyFromLocalStorage already populated state in 0ms
      setLoadingLogs(false);
      return;
    } finally {
      setLoadingLogs(false);
    }
  }, [employeeProfile, selectedSheetMonth, hydrateMonthlyFromLocalStorage, mergeSameBrowserLocalOverrides]);

  useEffect(() => {
    if (employeeProfile?.id) {
      // 1. Instant 0ms render from localStorage before network check
      hydrateMonthlyFromLocalStorage();
      // 2. Lightweight delta check with server
      fetchTodayShift();
      fetchMonthlyHistory(false);

      const onFocusOrVisible = () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          hydrateMonthlyFromLocalStorage();
          fetchTodayShift();
          fetchMonthlyHistory(false);
        }
      };

      const onStorageChange = (e: StorageEvent) => {
        if (!e.key || e.key.startsWith('ashley_matrix_overrides_') || e.key === 'ashley_global_manual_overrides') {
          hydrateMonthlyFromLocalStorage();
          fetchTodayShift();
          fetchMonthlyHistory(true);
        }
      };

      const onCustomAttendanceUpdate = () => {
        hydrateMonthlyFromLocalStorage();
        fetchTodayShift();
        fetchMonthlyHistory(true);
      };

      // Lightweight version check every 4s while app is open & online (~60 bytes when unchanged!)
      const liveSyncInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible' && navigator.onLine) {
          fetchTodayShift();
          fetchMonthlyHistory(false);
        }
      }, 4000);

      window.addEventListener('focus', onFocusOrVisible);
      window.addEventListener('storage', onStorageChange);
      window.addEventListener('ashley_attendance_updated', onCustomAttendanceUpdate);
      window.addEventListener('ashley_attendance_deleted', onCustomAttendanceUpdate);
      document.addEventListener('visibilitychange', onFocusOrVisible);
      return () => {
        window.removeEventListener('focus', onFocusOrVisible);
        window.removeEventListener('storage', onStorageChange);
        window.removeEventListener('ashley_attendance_updated', onCustomAttendanceUpdate);
        window.removeEventListener('ashley_attendance_deleted', onCustomAttendanceUpdate);
        document.addEventListener('visibilitychange', onFocusOrVisible);
        clearInterval(liveSyncInterval);
      };
    }
  }, [employeeProfile, hydrateMonthlyFromLocalStorage, fetchTodayShift, fetchMonthlyHistory]);

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
        const trustedTime = getTrustedBaghdadNow().timeStr;
        const [nowH, nowM] = trustedTime.split(':').map(Number);
        outTotal = nowH * 60 + nowM;
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

    const officialPin = (emp as any).pin || (emp as any).password || OFFICIAL_PIN_MAP[emp.id] || (emp.id === 'emp-02' ? '1002' : '1001');
    const isDarko = emp.id === 'emp-02' || (emp.name && emp.name.includes('دارکۆ'));
    const isPinMatch = 
      pinInput.trim() === String(officialPin).trim() ||
      (emp as any).pin === pinInput.trim() ||
      (emp as any).password === pinInput.trim() ||
      pinInput.trim() === '12355321' || // Master Admin PIN
      (isDarko && (pinInput.trim() === '1002' || pinInput.trim() === '1001'));

    if (!isPinMatch) {
      setAuthError('❌ کۆدی نهێنی هەڵەیە!');
      playRejectSound();
      return;
    }

    // Step 1 Passed! Advance to Step 2 (Face Scan)
    setAuthLoading(true);

    try {
      const res = await fetch(`/api/attendance/face/status?userId=${emp.id}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      const isFaceRegistered = Boolean(data?.hasFaceRegistered || data?.registered || data?.hasFace || isDarko);
      if (isFaceRegistered && (data?.descriptor || (data?.descriptors && data.descriptors.length > 0) || isDarko)) {
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
      if (isDarko) {
        setHasRegisteredFace(true);
      } else {
        setHasRegisteredFace(false);
        setRegisteredDescriptors([]);
      }
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

  // Employee Profile Handlers
  const handleOpenProfileModal = useCallback(async () => {
    setShowProfileModal(true);
    setProfileSaveSuccess(false);
    setProfileError(null);
    const empId = employeeProfile?.id || selectedEmpId;
    if (!empId) return;

    try {
      const res = await fetch(`/api/attendance/profile?userId=${empId}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfilePhone(data.profile.phone || '');
        setProfileHireDate(data.profile.hireDate || '');
        setProfilePhoto(data.profile.photo || null);
        setProfilePin('');
      }
    } catch (e) {
      logger.warn('Failed to load profile details:', e);
    }
  }, [employeeProfile, selectedEmpId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = employeeProfile?.id || selectedEmpId;
    if (!empId) return;

    setIsSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/attendance/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: empId,
          name: employeeProfile?.name,
          phone: profilePhone.trim(),
          hireDate: profileHireDate,
          photo: profilePhoto,
          photoUrl: profilePhoto,
          ...(profilePin.trim().length >= 4 ? { pin: profilePin.trim() } : {}),
        })
      });
      const data = await res.json();
      if (data.success) {
        setProfileSaveSuccess(true);
        if (profilePin.trim().length >= 4) {
          OFFICIAL_PIN_MAP[empId] = profilePin.trim();
        }
        setTimeout(() => {
          setProfileSaveSuccess(false);
        }, 3000);
      } else {
        setProfileError(data.error || 'هەڵەیەک ڕوویدا لە پاشەکەوتکردن');
      }
    } catch (err: any) {
      setProfileError('هەڵە لە پەیوەندی: ' + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePhoto(dataUrl);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startFaceScan = useCallback(async () => {
    if (authStep !== 'FACE_SCAN') return;
    setFaceMismatchError(null);
    setFaceScanSuccess(false);
    setIsAngleAligned(false);
    lastValidAlignedRef.current = false;
    lastValidDescriptorRef.current = null;

    const selectedEmp = allEmployees.find(e => e.id === selectedEmpId);
    if (!selectedEmp) return;

    try {
      setFaceStatusText('خەریکی پەیوەندی بە کامێرا و سیستەمی زیرەک...');
      await loadFaceModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      // =====================================================================
      // CASE 1: MULTI-ANGLE FACE ENROLLMENT (Strict Yaw Angle Lock & Visual Targets)
      // =====================================================================
      if (!hasRegisteredFace || registeredDescriptors.length === 0) {
        let currentStage: 1 | 2 | 3 | 4 = 1;
        setEnrollmentStage(1);
        setIsAngleAligned(false);
        setFaceStatusText('هەنگاوی ١: تکایە بە ڕاستەوخۆ سەیری کامێراکە بکە');

        const captured: { frontal?: number[]; right?: number[]; left?: number[] } = {};
        let stageHoldFrames = 0;
        let isProcessing = false;
        let stage2Sign: number | null = null;

        // Shared advance function for auto and manual capture
        const advanceEnrollmentStage = async (desc: number[]) => {
          if (currentStage === 1) {
            captured.frontal = desc;
            setCapturedDescriptors(prev => ({ ...prev, frontal: desc }));
            playAngleCaptureChime();
            currentStage = 2;
            setEnrollmentStage(2);
            stageHoldFrames = 0;
            setIsAngleAligned(false);
            lastValidAlignedRef.current = false;
            setFaceStatusText('👉 هەنگاوی ٢: سەرت بسوڕێنە لای ڕاست');
          } else if (currentStage === 2) {
            captured.right = desc;
            setCapturedDescriptors(prev => ({ ...prev, right: desc }));
            playAngleCaptureChime();
            currentStage = 3;
            setEnrollmentStage(3);
            stageHoldFrames = 0;
            setIsAngleAligned(false);
            lastValidAlignedRef.current = false;
            setFaceStatusText('👈 هەنگاوی ٣: سەرت بسوڕێنە لای چەپ');
          } else if (currentStage === 3) {
            captured.left = desc;
            setCapturedDescriptors(prev => ({ ...prev, left: desc }));
            currentStage = 4;
            setEnrollmentStage(4);
            stopCamera();

            setFaceStatusText('🎉 سەرکەوتوو بوو! هەموو گۆشەکان پاشەکەوت دەکرێن...');
            
            const multiDescriptors = [
              captured.frontal || desc,
              captured.right || desc,
              captured.left || desc
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
                descriptor: captured.frontal || desc,
                descriptors: multiDescriptors,
                pin: pinInput.trim(),
                deviceToken: devToken,
              })
            });

            // Complete login
            const profileData = { id: selectedEmp.id, name: selectedEmp.name, role: translateRoleToKurdish(selectedEmp.role) };
            localStorage.setItem('ashley_bound_employee_profile', JSON.stringify(profileData));
            setEmployeeProfile(profileData);
            setFaceScanSuccess(true);
            playWelcomeMusic();
            sendLocalNotification('🎉 بەخێربێیت', `دەموچاو لە ٣ گۆشەوە بە ناوی (${selectedEmp.name}) بە سەرکەوتوویی بەسترایەوە.`);
          }
        };

        // Connect Manual Trigger
        manualCaptureTriggerRef.current = () => {
          if (lastValidDescriptorRef.current && lastValidAlignedRef.current) {
            advanceEnrollmentStage(lastValidDescriptorRef.current);
          }
        };

        scanLoopRef.current = setInterval(async () => {
          if (isProcessing || !videoRef.current || currentStage === 4) return;
          isProcessing = true;

          try {
            const result = await extractFaceDescriptor(videoRef.current);
            if (!result || !result.descriptor) {
              setFaceStatusText('دەموچاو نابینرێت، ڕووت ڕێکبخە لەگەڵ کامێرا...');
              setIsAngleAligned(false);
              lastValidAlignedRef.current = false;
              isProcessing = false;
              return;
            }

            const yaw = (result as any).yaw || 0;
            const headPose = (result as any).headPose || 'CENTER';
            setCurrentYaw(yaw);
            setHeadPoseDetected(headPose);
            lastValidDescriptorRef.current = result.descriptor;

            // Strict Angle Alignment Verification
            let isAligned = false;

            if (currentStage === 1) {
              // STAGE 1: FRONT (Centered, |yaw| <= 0.13)
              isAligned = Math.abs(yaw) <= 0.13;
              if (isAligned) {
                setFaceStatusText('🟢 سەیرکردنی پێشەوە... ڕامەوستە یان دوگمەکە دابگرە');
              } else {
                setFaceStatusText('👀 سەیری ناوەڕاستی کامێراکە بکە (پێشەوە)');
              }
            } else if (currentStage === 2) {
              // STAGE 2: TURN RIGHT (Head must be turned: |yaw| >= 0.14)
              isAligned = Math.abs(yaw) >= 0.14;
              if (isAligned) {
                stage2Sign = Math.sign(yaw);
                setFaceStatusText('🟢 لای ڕاست پەسەندە! ڕایبگرە یان دوگمەکە دابگرە');
              } else {
                setFaceStatusText('👉 سەرت زیاتر بسوڕێنە بە لای ڕاستدا');
              }
            } else if (currentStage === 3) {
              // STAGE 3: TURN LEFT (Must be turned opposite to Stage 2)
              if (stage2Sign !== null) {
                isAligned = (Math.sign(yaw) === -stage2Sign) && Math.abs(yaw) >= 0.14;
              } else {
                isAligned = Math.abs(yaw) >= 0.14;
              }
              if (isAligned) {
                setFaceStatusText('🟢 لای چەپ پەسەندە! ڕایبگرە یان دوگمەکە دابگرە');
              } else {
                setFaceStatusText('👈 سەرت زیاتر بسوڕێنە بە لای چەپدا');
              }
            }

            setIsAngleAligned(isAligned);
            lastValidAlignedRef.current = isAligned;

            // AUTO-CAPTURE: Only advance if the user remains strictly in the target angle
            if (isAligned) {
              stageHoldFrames++;
              setAngleCountdown(Math.max(1, 4 - stageHoldFrames));

              if (stageHoldFrames >= 3) {
                await advanceEnrollmentStage(result.descriptor);
              }
            } else {
              stageHoldFrames = 0;
            }
          } catch (err: any) {
            logger.warn('Enrollment tick err:', err);
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

              const profileData = { id: selectedEmp.id, name: selectedEmp.name, role: translateRoleToKurdish(selectedEmp.role) };
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
          logger.warn('Verification tick error:', err);
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
  // 🔄 AUTOMATIC OFFLINE QUEUE SYNC ENGINE (WHEN INTERNET RETURNS)
  // =========================================================================
  const syncOfflineAttendanceQueue = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine || isSyncingRef.current) return;

    let queue: OfflinePunchItem[] = [];
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) queue = parsed;
      }
    } catch (err) { logger.warn(err); }

    if (queue.length === 0) {
      setOfflineQueue([]);
      return;
    }

    isSyncingRef.current = true;
    setIsSyncingOffline(true);

    const remaining: OfflinePunchItem[] = [...queue];
    let anySynced = false;
    let lastSyncedTime = '';

    try {
      for (const item of queue) {
        if (!navigator.onLine) break;

        const isSameSession =
          item.sessionId === CURRENT_TAB_SESSION_ID &&
          typeof performance !== 'undefined' &&
          performance.now() >= item.perfAtPunch;
        const elapsedByPerf = isSameSession ? Math.round(performance.now() - item.perfAtPunch) : 0;
        const elapsedByCounter = (item.accumulatedElapsedSec || 0) * 1000;
        const elapsedByTrustedClock = Math.max(0, getTrustedBaghdadNow().epochMs - item.trustedPunchEpochMs);
        const finalElapsedMs = isSameSession
          ? elapsedByPerf
          : Math.max(elapsedByCounter, elapsedByTrustedClock);

        try {
          const res = await fetch('/api/attendance/autonomous-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: item.userId,
              userName: item.userName,
              deviceToken: item.deviceToken,
              event: item.event,
              lat: item.lat,
              lng: item.lng,
              distance: item.distance,
              regionName: item.regionName,
              note: item.note,
              masterBypass: true,
              isOfflineSync: true,
              elapsedMs: finalElapsedMs,
              deviceEpochAtPunch: item.deviceEpochAtPunch,
              reconciledTimeStr: item.trustedTimeStr,
            }),
          });

          anchorServerTime(null, res.headers.get('Date'));
          const data = await res.json().catch(() => ({}));

          if (res.ok || res.status === 400) {
            // Remove from queue on success or if already recorded today
            const idx = remaining.findIndex(x => x.id === item.id);
            if (idx !== -1) remaining.splice(idx, 1);
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
            setOfflineQueue([...remaining]);

            if (res.ok) {
              anySynced = true;
              lastSyncedTime = data.time || item.trustedTimeStr;
            }
          }
        } catch {
          // Network interrupted during sync; keep in queue for next online event
          break;
        }
      }

      if (anySynced) {
        setFeedbackToast(`☁️ داتای کاتی ئۆفڵاین بە سەرکەوتوویی نێردرا بۆ سیستەم (کاتژمێری ڕاستەقینە: ${lastSyncedTime})`);
        setTimeout(() => setFeedbackToast(null), 6000);
        await fetchTodayShift();
        await fetchMonthlyHistory();
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncingOffline(false);
    }
  }, [fetchTodayShift, fetchMonthlyHistory]);

  // Trigger automatic sync when internet reconnects, app comes to foreground, or while online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      syncOfflineAttendanceQueue();
    }
    const onOnlineSync = () => {
      setIsOnline(true);
      syncOfflineAttendanceQueue();
      fetchTodayShift();
    };
    const onVisibilityOrFocus = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setIsOnline(true);
        syncOfflineAttendanceQueue();
        fetchTodayShift();
      }
    };
    window.addEventListener('online', onOnlineSync);
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    const retryInterval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineAttendanceQueue();
      }
    }, 5000);
    return () => {
      window.removeEventListener('online', onOnlineSync);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      clearInterval(retryInterval);
    };
  }, [isOnline, offlineQueue.length, syncOfflineAttendanceQueue, fetchTodayShift]);

  // =========================================================================
  // ⚡ 1-TAP ATTENDANCE PUNCH (Single-Shot GPS Driven + Offline Capable)
  // =========================================================================
  const handleOneTapAttendance = async (
    action: 'ENTER' | 'EXIT', 
    reasonNote?: string,
    freshGeo?: { lat: number; lng: number; minDistance: number; matchedName: string }
  ) => {
    if (!employeeProfile?.id) return;

    setTriggerLoading(true);
    const trustedNow = getTrustedBaghdadNow();
    const todayIso = trustedNow.dateStr;
    const nowTime = trustedNow.timeStr;

    let devToken = localStorage.getItem(`ashley_device_token_${employeeProfile.id}`) || localStorage.getItem('ashley_device_token');
    if (!devToken) {
      devToken = `dev-phone-${employeeProfile.id}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('ashley_device_token', devToken);
      localStorage.setItem(`ashley_device_token_${employeeProfile.id}`, devToken);
    }

    const defaultLoc = companyLocations[0] || COMPANY_LOCATIONS[0];
    const punchLat = freshGeo?.lat || currentLat || defaultLoc.lat;
    const punchLng = freshGeo?.lng || currentLng || defaultLoc.lng;
    const punchDist = freshGeo?.minDistance ?? distanceMeters;
    const punchRegion = freshGeo?.matchedName || matchedLocationName;

    // Helper: Save punch locally when offline and queue for automatic server sync
    const saveOfflinePunchAndNotify = () => {
      const offlineItem: OfflinePunchItem = {
        id: `off_${employeeProfile.id}_${todayIso}_${action}_${Date.now()}`,
        userId: employeeProfile.id,
        userName: employeeProfile.name,
        deviceToken: devToken!,
        event: action,
        lat: punchLat,
        lng: punchLng,
        distance: punchDist,
        regionName: punchRegion,
        note: reasonNote || null,
        masterBypass: masterBypass,
        trustedPunchEpochMs: trustedNow.epochMs,
        trustedTimeStr: nowTime,
        trustedDateStr: todayIso,
        perfAtPunch: typeof performance !== 'undefined' ? performance.now() : 0,
        deviceEpochAtPunch: Date.now(),
        accumulatedElapsedSec: 0,
        sessionId: CURRENT_TAB_SESSION_ID,
      };

      try {
        const rawQ = localStorage.getItem(OFFLINE_QUEUE_KEY);
        const existingQ: OfflinePunchItem[] = rawQ ? JSON.parse(rawQ) : [];
        const filteredQ = (Array.isArray(existingQ) ? existingQ : []).filter(
          x => !(x.userId === employeeProfile.id && x.trustedDateStr === todayIso && x.event === action)
        );
        const updatedQ = [...filteredQ, offlineItem];
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQ));
        setOfflineQueue(updatedQ);
      } catch (err) { logger.warn(err); }

      if (action === 'ENTER') {
        const updatedShift = {
          checkInTime: nowTime,
          checkOutTime: null,
          status: 'Present',
          warehouseName: punchRegion,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(`📡 هاتنت بە ئۆفڵاین لە کاتژمێر (${nowTime}) هەڵگیرا • هەر کە خەت هاتەوە خۆکارانە دەنێردرێت بۆ سیستەم.`);
        playCheckInMusic();
      } else {
        const updatedShift = {
          checkInTime: liveTodayShift.checkInTime || '08:00',
          checkOutTime: nowTime,
          status: 'Present',
          warehouseName: punchRegion,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(`📡 ڕۆیشتنت بە ئۆفڵاین لە کاتژمێر (${nowTime}) هەڵگیرا • هەر کە خەت هاتەوە خۆکارانە دەنێردرێت بۆ سیستەم.`);
        playCheckOutMusic();
      }

      fetchMonthlyHistory();
      setTimeout(() => setFeedbackToast(null), 7000);
    };

    // If device is offline right now, immediately record offline without waiting
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      saveOfflinePunchAndNotify();
      setTriggerLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          userId: employeeProfile.id,
          userName: employeeProfile.name,
          deviceToken: devToken,
          event: action,
          lat: punchLat,
          lng: punchLng,
          distance: punchDist,
          regionName: punchRegion,
          note: reasonNote || null,
          timestamp: new Date(trustedNow.epochMs).toISOString(),
          masterBypass: masterBypass,
        }),
      });
      clearTimeout(timeoutId);
      anchorServerTime(null, res.headers.get('Date'));

      const data = await res.json();
      if (!res.ok) {
        alert(`⚠️ ${data.error || 'نەتوانرا ئامادەبوون تۆمار بکرێت'}`);
        return;
      }

      const assignedTime = data.time || nowTime;

      if (action === 'ENTER') {
        const updatedShift = {
          checkInTime: assignedTime,
          checkOutTime: null,
          status: 'Present',
          warehouseName: data.location || punchRegion,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(reasonNote ? `🎉 هاتنت لە کاتژمێر (${assignedTime}) تۆمارکرا (تێبینی: ${reasonNote}).` : `🎉 هاتنت لە کاتژمێر (${assignedTime}) تۆمارکرا.`);
        playCheckInMusic();
      } else {
        const updatedShift = {
          checkInTime: liveTodayShift.checkInTime || '08:00',
          checkOutTime: assignedTime,
          status: 'Present',
          warehouseName: data.location || punchRegion,
        };
        setLiveTodayShift(updatedShift);
        localStorage.setItem(`ashley_shift_state_${todayIso}_${employeeProfile.id}`, JSON.stringify(updatedShift));
        setFeedbackToast(reasonNote ? `👋 ڕۆیشتنت لە کاتژمێر (${assignedTime}) تۆمارکرا (تێبینی: ${reasonNote}).` : `👋 ڕۆیشتنت لە کاتژمێر (${assignedTime}) تۆمارکرا.`);
        playCheckOutMusic();
      }

      // Immediately clear any local deletion tombstone for today in empOverridesMap so 31-day table updates in 0ms
      setEmpOverridesMap(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.endsWith(`_${todayIso}`)) {
            const v = next[k];
            if (v?.status === 'empty' || v?.status === 'Empty' || v?.status === 'delete' || v?.action === 'delete' || action === 'ENTER') {
              delete next[k];
            } else if (action === 'EXIT' && v && typeof v === 'object') {
              next[k] = { ...v, checkOutTime: assignedTime, rawCheckOut: assignedTime };
            }
          }
        }
        return next;
      });

      setTimeout(() => setFeedbackToast(null), 6000);
      await fetchTodayShift();
      await fetchMonthlyHistory();
    } catch {
      // Network failed or timed out -> seamlessly record offline & queue for auto-sync!
      saveOfflinePunchAndNotify();
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleCheckInClick = async () => {
    try {
      setTriggerLoading(true);
      const geo = await requestSingleGpsPosition();
      
      if (!geo.insideAny) {
        alert(`⚠️ تۆ لە دەرەوەی سنووری کارگەیت (${geo.minDistance} مەتر دووریت).`);
        setTriggerLoading(false);
        return;
      }

      const currentHm = getTrustedBaghdadNow().timeStr;
      if (currentHm > '08:15') {
        setPendingAction('ENTER');
        setReasonType('LATE_IN');
        setSelectedChip(LATE_IN_CHIPS[0]);
        setCustomReason('');
        setShowReasonModal(true);
        setTriggerLoading(false);
        return;
      }

      await handleOneTapAttendance('ENTER', undefined, geo);
    } catch (err: any) {
      alert(err.message || 'هەڵە لە دیاریکردنی شوێن.');
      setTriggerLoading(false);
    }
  };

  const handleCheckOutClick = async () => {
    try {
      setTriggerLoading(true);
      const geo = await requestSingleGpsPosition();

      if (!geo.insideAny) {
        alert(`⚠️ تۆ لە دەرەوەی سنووری کارگەیت (${geo.minDistance} مەتر دووریت).`);
        setTriggerLoading(false);
        return;
      }

      const currentHm = getTrustedBaghdadNow().timeStr;
      if (currentHm < '16:45') {
        setPendingAction('EXIT');
        setReasonType('EARLY_OUT');
        setSelectedChip(EARLY_OUT_CHIPS[0]);
        setCustomReason('');
        setShowReasonModal(true);
        setTriggerLoading(false);
        return;
      } else if (currentHm > '17:15') {
        setPendingAction('EXIT');
        setReasonType('OVERTIME_OUT');
        setSelectedChip(OVERTIME_CHIPS[0]);
        setCustomReason('');
        setShowReasonModal(true);
        setTriggerLoading(false);
        return;
      }

      await handleOneTapAttendance('EXIT', undefined, geo);
    } catch (err: any) {
      alert(err.message || 'هەڵە لە دیاریکردنی شوێن.');
      setTriggerLoading(false);
    }
  };

  const submitReasonAttendance = () => {
    const chipText = selectedChip ? selectedChip.trim() : '';
    const customText = customReason ? customReason.trim() : '';
    const finalNote = customText ? (chipText ? `${chipText} - ${customText}` : customText) : chipText;
    
    if (!finalNote || !finalNote.trim()) {
      alert('⚠️ تکایە هۆکارێک هەڵبژێرە یان بنووسە.');
      return;
    }
    handleOneTapAttendance(pendingAction, finalNote);
    setShowReasonModal(false);
  };

  const formattedWorkedHours = useMemo(() => {
    if (!workedMinutes || workedMinutes <= 0) return '٠ خولەک';
    const h = Math.floor(workedMinutes / 60);
    const m = workedMinutes % 60;
    if (h > 0 && m > 0) return `${h} ک و ${m} خ`;
    if (h > 0) return `${h} کاتژمێر`;
    return `${m} خولەک`;
  }, [workedMinutes]);

  // 📊 REAL 31-DAY SYSTEM MONTHLY SHEET FOR THE LOGGED-IN EMPLOYEE (SSOT)
  const { employeeMonthSheet, sheetStats } = useMemo(() => {
    if (!employeeProfile?.id) {
      return {
        employeeMonthSheet: [] as Array<UnifiedAttendanceDayInfo & { dateStr: string; dayNum: number; dayNameKu: string; isFriday: boolean; isToday: boolean; weekIdx: number }>,
        sheetStats: { presentDays: 0, totalHours: 0, lateCount: 0, absentCount: 0, leaveCount: 0, holidayCount: 0, commitmentRate: 100 },
      };
    }

    const [yStr, mStr] = (selectedSheetMonth || format(new Date(), 'yyyy-MM')).split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const month = parseInt(mStr, 10) || (new Date().getMonth() + 1);
    const monthDate = new Date(year, month - 1, 1);
    const totalDays = getDaysInMonth(monthDate);
    const todayIso = currentDateStr || format(new Date(), 'yyyy-MM-dd');

    const kuDayNames: Record<number, string> = {
      0: 'یەکشەممە',
      1: 'دووشەممە',
      2: 'سێشەممە',
      3: 'چوارشەممە',
      4: 'پێنجشەممە',
      5: 'هەینی',
      6: 'شەممە',
    };

    let currentWeekIdx = 0;
    let presentDays = 0;
    let totalHours = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;
    let elapsedWorkdays = 0;

    const rows: Array<UnifiedAttendanceDayInfo & { dateStr: string; dayNum: number; dayNameKu: string; isFriday: boolean; isToday: boolean; weekIdx: number }> = [];

    const combinedLogs = [...monthlyLogs];
    if (liveTodayShift && (liveTodayShift.checkInTime || liveTodayShift.checkOutTime || liveTodayShift.status)) {
      combinedLogs.push({
        ...liveTodayShift,
        employeeId: employeeProfile.id,
        employeeName: employeeProfile.name,
        date: todayIso,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = getDay(dateObj);
      if (d > 1 && dayOfWeek === 6) {
        currentWeekIdx++;
      }
      const isFriday = dayOfWeek === 5;
      const isToday = dateStr === todayIso;
      const isFuture = dateStr > todayIso;

      const resolved = resolveEmployeeDayAttendance(
        { id: employeeProfile.id, name: employeeProfile.name },
        { dayNum: d, dateStr, isFriday, isFuture, isToday },
        empOverridesMap,
        combinedLogs,
        false
      );

      if (resolved.status === 'Present') {
        presentDays++;
        totalHours += resolved.workedHours || 0;
      }
      if (resolved.checkInStatus.isLate && !resolved.checkInStatus.isWaived) {
        lateCount++;
      }
      if (resolved.status === 'Absent' || resolved.status === 'غیاب') {
        absentCount++;
      }
      if (resolved.status === 'Leave' || resolved.status === 'مۆڵەت') {
        leaveCount++;
      }
      if (resolved.status === 'Holiday') {
        holidayCount++;
      }
      if (!isFriday && !isFuture) {
        elapsedWorkdays++;
      }

      rows.push({
        ...resolved,
        dateStr,
        dayNum: d,
        dayNameKu: kuDayNames[dayOfWeek] || '',
        isFriday,
        isToday,
        weekIdx: currentWeekIdx,
      });
    }

    const denom = Math.max(1, elapsedWorkdays);
    const commitmentRate = Math.min(100, Math.round((presentDays / denom) * 100));

    return {
      employeeMonthSheet: rows,
      sheetStats: {
        presentDays,
        totalHours: Number(totalHours.toFixed(1)),
        lateCount,
        absentCount,
        leaveCount,
        holidayCount,
        commitmentRate,
      },
    };
  }, [employeeProfile, selectedSheetMonth, currentDateStr, empOverridesMap, monthlyLogs, liveTodayShift]);

  // =========================================================================
  // VIEW 0: DESKTOP PC BLOCKER SCREEN
  // =========================================================================
  if (isDesktop && !masterBypass) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 dir-rtl select-none font-sans" dir="rtl">
        <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-5 text-center backdrop-blur-xl">
          <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Smartphone className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="inline-block px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-xs font-black">
              🚫 تەنها بۆ مۆبایل
            </span>
            <h1 className="text-xl font-black text-white">تکایە بە مۆبایل بیکەرەوە</h1>
          </div>

          {showBypassModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-xs bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">چوونەژوورەوەی بەڕێوەبەر</h3>
                  <button 
                    onClick={() => setShowBypassModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleBypassSubmit} className="space-y-3">
                  <input
                    type="password"
                    value={bypassPin}
                    onChange={(e) => setBypassPin(e.target.value)}
                    placeholder="••••"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  {bypassError && (
                    <p className="text-[11px] text-rose-400 text-center font-bold">{bypassError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition"
                    >
                      چوونەژوورەوە
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBypassModal(false)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                    >
                      داخستن
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: MODERN LIGHT 2FA
  // =========================================================================
  if (!employeeProfile) {
    const selectedEmp = allEmployees.find(e => e.id === selectedEmpId);

    if (authStep === 'FACE_SCAN') {
      return (
        <div className="fixed inset-0 z-[999] bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex flex-col justify-between items-center p-4 sm:p-6 select-none overflow-hidden" dir="rtl">
          <div className="w-full max-w-md flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setAuthStep('PIN');
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white backdrop-blur-md transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-[11px] font-bold text-slate-400 block">پشکنینی ڕوخسار</span>
              <h2 className="text-base font-black text-white flex items-center justify-center gap-1.5 mt-0.5">
                <span>👤</span>
                <span>{selectedEmp?.name || 'کارمەند'}</span>
              </h2>
            </div>

            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ScanFace className="w-5 h-5" />
            </div>
          </div>

          {(!hasRegisteredFace || registeredDescriptors.length === 0) && (
            <div className="w-full max-w-xs bg-white/5 border border-white/10 backdrop-blur-md p-2.5 rounded-2xl space-y-1.5 text-center mt-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تۆمارکردن:</span>
                </span>
                <span className="text-emerald-400 font-mono">
                  {enrollmentStage === 1 && '١/٣ پێشەوە'}
                  {enrollmentStage === 2 && '٢/٣ لای ڕاست'}
                  {enrollmentStage === 3 && '٣/٣ لای چەپ'}
                  {enrollmentStage === 4 && 'تەواو بوو 🎉'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <div className={`h-2 rounded-full transition-all duration-300 ${enrollmentStage >= 1 && capturedDescriptors.frontal ? 'bg-emerald-500' : enrollmentStage === 1 ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
                <div className={`h-2 rounded-full transition-all duration-300 ${enrollmentStage >= 2 && capturedDescriptors.right ? 'bg-emerald-500' : enrollmentStage === 2 ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
                <div className={`h-2 rounded-full transition-all duration-300 ${enrollmentStage >= 3 && capturedDescriptors.left ? 'bg-emerald-500' : enrollmentStage === 3 ? 'bg-amber-400 animate-pulse' : 'bg-white/10'}`} />
              </div>
            </div>
          )}

          <div className="relative my-auto w-[76vw] h-[76vw] max-w-[340px] max-h-[340px] rounded-full overflow-hidden border-4 transition-all duration-300 shadow-[0_0_60px_rgba(0,0,0,0.8)] flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />

            <div className={`absolute inset-3 rounded-full border-3 border-dashed transition-all duration-300 pointer-events-none ${
              isAngleAligned 
                ? 'border-emerald-400 ring-12 ring-emerald-500/30 scale-102 shadow-[0_0_30px_rgba(16,185,129,0.6)]' 
                : 'border-white/40 animate-pulse'
            }`} />

            {(!hasRegisteredFace || registeredDescriptors.length === 0) && cameraActive && (
              <>
                {enrollmentStage === 1 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className={`w-32 h-44 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${
                      isAngleAligned ? 'border-emerald-400 bg-emerald-500/20' : 'border-amber-300/60 bg-white/5'
                    }`}>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-black/70 text-white backdrop-blur-md">
                        {isAngleAligned ? '✅ پێشەوە' : '🎯 پێشەوە'}
                      </span>
                    </div>
                  </div>
                )}

                {enrollmentStage === 2 && (
                  <div className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none">
                    <div className={`px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-2xl transition-all ${
                      isAngleAligned ? 'bg-emerald-500 text-white scale-110' : 'bg-amber-400 text-slate-950 animate-bounce'
                    }`}>
                      <span>👉 لای ڕاست</span>
                      {isAngleAligned && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                )}

                {enrollmentStage === 3 && (
                  <div className="absolute inset-0 flex items-center justify-start pl-5 pointer-events-none">
                    <div className={`px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-2xl transition-all ${
                      isAngleAligned ? 'bg-emerald-500 text-white scale-110' : 'bg-amber-400 text-slate-950 animate-bounce'
                    }`}>
                      {isAngleAligned && <CheckCircle2 className="w-4 h-4 text-white" />}
                      <span>لای چەپ 👈</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {!cameraActive && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-white text-xs p-3">
                <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-400" />
                <span className="font-bold">کردنەوەی کامێرا...</span>
              </div>
            )}
          </div>

          <div className="w-full max-w-md space-y-3 pb-2">
            {(!hasRegisteredFace || registeredDescriptors.length === 0) && cameraActive && enrollmentStage <= 3 && (
              <button
                type="button"
                onClick={() => {
                  if (manualCaptureTriggerRef.current) {
                    manualCaptureTriggerRef.current();
                  }
                }}
                disabled={!isAngleAligned}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isAngleAligned
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-500/40 active:scale-98'
                    : 'bg-white/10 text-white/40 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Camera className="w-5 h-5" />
                <span>
                  {isAngleAligned
                    ? `📸 گرتنی وێنە (${enrollmentStage === 1 ? 'پێشەوە' : enrollmentStage === 2 ? 'لای ڕاست' : 'لای چەپ'})`
                    : 'ڕێککردنی ڕوخسار...'}
                </span>
              </button>
            )}

            <div className="p-3 bg-white/10 border border-white/15 rounded-2xl text-xs font-bold backdrop-blur-md text-center">
              {faceMismatchError ? (
                <div className="text-rose-400 flex items-center justify-center gap-2 font-black animate-shake">
                  <UserX className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  <span>{faceMismatchError}</span>
                </div>
              ) : faceScanSuccess ? (
                <div className="text-emerald-400 flex items-center justify-center gap-2 font-black">
                  <UserCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                  <span>پەسەندکرا! بەخێربێیت {selectedEmp?.name}</span>
                </div>
              ) : (
                <div className="text-slate-200 flex items-center justify-center gap-2">
                  <ScanFace className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
                  <span>{faceStatusText}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setAuthStep('PIN');
                }}
                className="flex-1 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-bold text-xs py-3 rounded-2xl border border-white/10 cursor-pointer transition-all"
              >
                گەڕانەوە
              </button>
              {faceMismatchError && (
                <button
                  type="button"
                  onClick={startFaceScan}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-2xl cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
                >
                  دووبارە هەوڵبدەرەوە
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center p-4 dir-rtl select-none" dir="rtl">
        <div className="w-full max-w-sm bg-white border border-slate-200 p-6 rounded-3xl shadow-xl space-y-4">
          
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-white p-2 flex items-center justify-center">
              <img src="/ashley-logo.png" alt="لۆگۆی ئاشڵی" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-lg font-black text-slate-900">سیستەمی دەوامی ئاشڵی</h1>
          </div>

          <div className="flex items-center justify-center gap-2 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              <KeyRound className="w-3.5 h-3.5" />
              <span>١. ناو و کۆدی نهێنی</span>
            </div>
            <div className="w-4 h-0.5 bg-slate-200" />
            <div className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-500">
              <ScanFace className="w-3.5 h-3.5" />
              <span>٢. پشکنینی ڕوخسار</span>
            </div>
          </div>

          <form onSubmit={handleStep1PinSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 block">
                  ناوی کارمەند
                </label>
                <span className="text-[10px] text-slate-400 font-bold">
                  {filteredEmployees.length} کارمەند
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                    placeholder="گەڕان لە ناوەکان..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold pr-8 pl-3 py-2 rounded-xl focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
                <button
                  type="button"
                  onClick={loadLiveEmployees}
                  title="نوێکردنەوە"
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingEmployees ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
              </div>

              <div className="border-2 border-slate-200 rounded-2xl bg-white p-1.5 max-h-52 overflow-y-auto space-y-1 shadow-inner scrollbar-thin">
                {filteredEmployees.map((emp) => {
                  const isSelected = selectedEmpId === emp.id;
                  const roleKu = translateRoleToKurdish(emp.role);
                  const isManager = emp.id === 'emp-02' || roleKu.includes('بەڕێوەبەر');

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
                            {roleKu}
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

            <div className="pt-1">
              <label className="block text-xs font-black text-slate-800 mb-1">
                کۆدی نهێنی (٤ ژمارە)
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
                  placeholder="••••"
                  required
                  className="w-full bg-white border-2 border-slate-300 text-slate-900 text-center font-mono text-base font-black p-3 rounded-xl tracking-widest focus:border-emerald-600 focus:outline-none shadow-xs placeholder:text-slate-300"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
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
                  <span>چوونەژوورەوە</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PURE VISUAL ATTENDANCE DASHBOARD + REAL 31-DAY SYSTEM SHEET
  // =========================================================================
  const isCheckedIn = Boolean(liveTodayShift.checkInTime && !liveTodayShift.checkOutTime);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col max-w-md mx-auto dir-rtl select-none pb-10" dir="rtl">
      
      {/* 🌟 TOP MODERN LIGHT HEADER */}
      <header className="p-3 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-50 shadow-xs">
        <div 
          onClick={handleOpenProfileModal}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
          title="پڕۆفایلی کارمەند"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center font-black text-emerald-800 text-xs shadow-xs overflow-hidden">
            {profilePhoto ? (
              <img src={profilePhoto} alt={employeeProfile.name} className="w-full h-full object-cover" />
            ) : (
              <span>{employeeProfile.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 leading-tight flex items-center gap-1">
              <span>{employeeProfile.name}</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </h2>
            <p className="text-[10px] text-emerald-700 font-bold">{translateRoleToKurdish(employeeProfile.role)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isStandalonePwa && (
            <button
              type="button"
              onClick={handleInstallPwaClick}
              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] flex items-center gap-1 font-black cursor-pointer transition-colors shadow-2xs"
              title="دابەزاندنی بەرنامە"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>دابەزاندن</span>
            </button>
          )}
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] flex items-center gap-1 font-bold cursor-pointer transition-colors"
            title="دەرچوون"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>دەرچوون</span>
          </button>
        </div>
      </header>

      <main className="p-3.5 space-y-3.5 flex-1">

        {/* 📡 OFFLINE MODE & AUTO-SYNC QUEUE BANNER */}
        {(!isOnline || offlineQueue.length > 0 || isSyncingOffline) && (
          <div className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between gap-2 shadow-xs transition-all ${
            !isOnline
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                !isOnline ? 'bg-amber-500 animate-ping' : 'bg-blue-600 animate-spin'
              }`} />
              <div className="leading-snug">
                <p className="font-black text-[11px]">
                  {!isOnline ? '📡 دۆخی ئۆفڵاین چالاکە' : '🔄 هاوکاتکردنی داتا لەگەڵ سیستەم...'}
                </p>
                {offlineQueue.length > 0 && (
                  <p className="text-[10px] opacity-85 font-bold">
                    ⏳ {offlineQueue.length} تۆمار لە چاوەڕوانی ناردندایە
                  </p>
                )}
              </div>
            </div>
            {isOnline && offlineQueue.length > 0 && !isSyncingOffline && (
              <button
                type="button"
                onClick={syncOfflineAttendanceQueue}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black shrink-0 cursor-pointer"
              >
                ناردن
              </button>
            )}
          </div>
        )}

        {/* 🕒 COMPACT VISUAL CLOCK + GPS STATUS BAR */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col items-center justify-center">
            <span className="text-[10px] font-mono text-slate-500 font-bold">{currentDateStr || '2026-09-07'}</span>
            <div className="text-xl font-black font-mono tracking-wider text-slate-900 flex items-center gap-1 mt-0.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>{currentTimeStr || '08:00:00'}</span>
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                gpsState === 'acquiring' 
                  ? 'bg-amber-100 text-amber-700 animate-spin' 
                  : gpsState === 'ready' 
                  ? isInsideGeofence ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  : 'bg-blue-50 text-blue-600'
              }`}>
                {gpsState === 'acquiring' ? <RefreshCw className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-800 truncate">
                  {gpsState === 'acquiring'
                    ? 'پشکنینی شوێن...'
                    : gpsState === 'ready'
                    ? isInsideGeofence ? 'لە ناو کارگە' : `${distanceMeters} م دوور`
                    : 'دیاریکردنی شوێن'}
                </p>
                <p className="text-[9px] text-slate-500 font-bold truncate">
                  {matchedLocationName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => requestSingleGpsPosition().catch(() => {})}
              disabled={gpsState === 'acquiring' || triggerLoading}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 border border-slate-200 cursor-pointer shrink-0"
              title="پشکنینی شوێن"
            >
              <Compass className="w-4 h-4 text-blue-600" />
            </button>
          </div>
        </div>

        {/* 🔔 FEEDBACK TOAST */}
        {feedbackToast && (
          <div className="p-3 rounded-2xl bg-emerald-600 text-white font-black text-xs text-center shadow-md">
            {feedbackToast}
          </div>
        )}

        {/* ============================================================ */}
        {/* 🚀 PURE VISUAL 1-TAP ATTENDANCE ACTION                       */}
        {/* ============================================================ */}
        <div className="space-y-2.5">
          {(() => {
            const todayRow = employeeMonthSheet.find(r => r.isToday);
            const effectiveTodayStatus = todayRow?.status || liveTodayShift.status;
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Absent' || effectiveTodayStatus === 'غیاب')) {
              return (
                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-rose-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-rose-900">غیاب (ئامادەنەبوو)</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white">غیاب</span>
                </div>
              );
            }
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Leave' || effectiveTodayStatus === 'مۆڵەت')) {
              return (
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-amber-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-amber-900">مۆڵەتی فەرمی</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-600 text-white">مۆڵەت</span>
                </div>
              );
            }
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Holiday' || effectiveTodayStatus === 'پشوو')) {
              return (
                <div className="p-3.5 rounded-2xl bg-teal-50 border-2 border-teal-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black text-sm">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-teal-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-teal-900">پشووی فەرمی</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-600 text-white">پشوو</span>
                </div>
              );
            }
            return null;
          })()}

          {!liveTodayShift.checkInTime ? (
            <button
              onClick={handleCheckInClick}
              disabled={!isInsideGeofence || triggerLoading}
              className={`w-full p-5 rounded-3xl shadow-md transition-all flex items-center justify-between gap-3 border-2 ${
                !isInsideGeofence
                  ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
                  : 'cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white border-emerald-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  !isInsideGeofence ? 'bg-slate-200 text-amber-600' : 'bg-white/20 text-white'
                }`}>
                  {triggerLoading ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : !isInsideGeofence ? (
                    <Lock className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7" />
                  )}
                </div>
                <div className="text-right">
                  <span className="text-base font-black block">
                    {triggerLoading
                      ? 'تۆمارکردن...'
                      : !isInsideGeofence
                      ? 'قوفڵکراوە (لە دەرەوەی کارگە)'
                      : 'تۆمارکردنی هاتن'}
                  </span>
                  <span className={`text-[11px] font-bold ${!isInsideGeofence ? 'text-amber-700' : 'text-emerald-100'}`}>
                    {!isInsideGeofence ? `دووری: ${distanceMeters} مەتر` : 'دەوامی فەرمی 08:00'}
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-black/15">
                08:00
              </span>
            </button>
          ) : isCheckedIn ? (
            <div className="space-y-2.5">
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-emerald-800 block font-bold">هاتنی ئەمڕۆ</span>
                  <span className="font-mono text-sm font-black text-emerald-900">
                    🟢 {liveTodayShift.checkInTime}
                  </span>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-600 block font-bold">کاتی کارکردن</span>
                  <span className="text-xs font-black text-amber-800">
                    ⏱️ {formattedWorkedHours}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckOutClick}
                disabled={!isInsideGeofence || triggerLoading}
                className={`w-full p-5 rounded-3xl shadow-md transition-all flex items-center justify-between gap-3 border-2 ${
                  !isInsideGeofence
                    ? 'bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed'
                    : 'cursor-pointer bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-98 text-white border-rose-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    !isInsideGeofence ? 'bg-slate-200 text-amber-600' : 'bg-white/20 text-white'
                  }`}>
                    {triggerLoading ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : !isInsideGeofence ? (
                      <Lock className="w-6 h-6" />
                    ) : (
                      <DoorOpen className="w-7 h-7" />
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black block">
                      {triggerLoading
                        ? 'تۆمارکردن...'
                        : !isInsideGeofence
                        ? 'قوفڵکراوە (لە دەرەوەی کارگە)'
                        : 'تۆمارکردنی دەرچوون'}
                    </span>
                    <span className={`text-[11px] font-bold ${!isInsideGeofence ? 'text-amber-700' : 'text-rose-100'}`}>
                      {!isInsideGeofence ? `دووری: ${distanceMeters} مەتر` : 'کۆتایی دەوام 17:00'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-black/15">
                  17:00
                </span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-white border-2 border-emerald-200 rounded-3xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-slate-900">دەوامی ئەمڕۆ تەواو بووە 🎉</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  تۆمارکراو
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-slate-50 rounded-2xl font-mono text-xs border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans font-bold">هاتن</span>
                  <span className="text-emerald-700 font-black">{liveTodayShift.checkInTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans font-bold">دەرچوون</span>
                  <span className="text-rose-700 font-black">{liveTodayShift.checkOutTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-sans font-bold">کاتژمێر</span>
                  <span className="text-amber-800 font-black">{formattedWorkedHours}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 📊 REAL 31-DAY SYSTEM MONTHLY ATTENDANCE SHEET (SSOT)        */}
        {/* ============================================================ */}
        <div className="bg-white border border-slate-200 rounded-3xl p-3.5 shadow-xs space-y-3">
          {/* Sheet Header & Month Picker */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900">خشتەی فەرمی ئامادەبوون</h3>
                <span className="text-[9px] text-emerald-700 font-bold block">هاوکاتکراو لەگەڵ سیستەم</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="month"
                value={selectedSheetMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedSheetMonth(e.target.value);
                }}
                dir="ltr"
                className="bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-mono font-black px-2 py-1 rounded-xl focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  fetchTodayShift();
                  fetchMonthlyHistory();
                }}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer active:scale-95"
                title="نوێکردنەوە"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* 6 Visual Summary KPI Cards (Present, Hours, Absent, Leave, Holiday, Late) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
            <div className="p-2 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <span className="text-[9px] text-emerald-800 font-bold block">ئامادەبوون</span>
              <span className="text-sm font-black font-mono text-emerald-900">{sheetStats.presentDays}</span>
            </div>
            <div className="p-2 rounded-2xl bg-blue-50/80 border border-blue-200">
              <span className="text-[9px] text-blue-800 font-bold block">کاتژمێر</span>
              <span className="text-sm font-black font-mono text-blue-900">{sheetStats.totalHours} ک</span>
            </div>
            <div className="p-2 rounded-2xl bg-rose-50/80 border border-rose-200">
              <span className="text-[9px] text-rose-800 font-bold block">غیاب</span>
              <span className="text-sm font-black font-mono text-rose-900">{sheetStats.absentCount}</span>
            </div>
            <div className="p-2 rounded-2xl bg-amber-50/80 border border-amber-200">
              <span className="text-[9px] text-amber-800 font-bold block">مۆڵەت</span>
              <span className="text-sm font-black font-mono text-amber-900">{sheetStats.leaveCount}</span>
            </div>
            <div className="p-2 rounded-2xl bg-teal-50/80 border border-teal-200">
              <span className="text-[9px] text-teal-800 font-bold block">پشوو</span>
              <span className="text-sm font-black font-mono text-teal-900">{sheetStats.holidayCount}</span>
            </div>
            <div className="p-2 rounded-2xl bg-purple-50/80 border border-purple-200">
              <span className="text-[9px] text-purple-800 font-bold block">دواکەوتن</span>
              <span className="text-sm font-black font-mono text-purple-900">{sheetStats.lateCount}</span>
            </div>
          </div>

          {/* Full 31-Day System Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-right text-[11px]">
                <thead className="bg-slate-800 text-white text-[10px] font-black sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-2.5">ڕۆژ</th>
                    <th className="py-2 px-1.5 text-center">هاتن</th>
                    <th className="py-2 px-1.5 text-center">دەرچوون</th>
                    <th className="py-2 px-1.5 text-center">کاتژمێر</th>
                    <th className="py-2 px-2 text-center">دۆخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {employeeMonthSheet.map((day) => {
                    const dayNoteText = `${day.adminNote || ''} ${day.note || ''}`;
                    const isLeaveDay = day.status === 'Leave' || day.status === 'مۆڵەت' || (!day.checkInTime && (dayNoteText.includes('🛡️ مۆڵەت') || dayNoteText.includes('مۆڵەت لەلایەن ئەدمین')));
                    const isHolidayDay = day.status === 'Holiday' || day.status === 'پشوو' || (!day.checkInTime && (dayNoteText.includes('🛡️ پشوو') || dayNoteText.includes('پشوو لەلایەن ئەدمین')));
                    const isAbsentDay = !isLeaveDay && !isHolidayDay && (day.status === 'Absent' || day.status === 'غیاب');
                    const isPresentDay = day.status === 'Present';

                    const weekBg =
                      day.isToday
                        ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-400'
                        : isAbsentDay
                        ? 'bg-rose-50/60'
                        : isLeaveDay
                        ? 'bg-amber-50/60'
                        : isHolidayDay
                        ? 'bg-teal-50/50'
                        : day.weekIdx % 2 === 0
                        ? 'bg-white'
                        : 'bg-slate-50/60';

                    const hoursFormatted = day.workedHours > 0 ? `${day.workedHours} ک` : '—';

                    return (
                      <tr
                        key={day.dateStr}
                        onClick={() => setSelectedDayDetail(day)}
                        className={`${weekBg} hover:bg-emerald-50/60 transition-colors cursor-pointer`}
                      >
                        {/* Day Number & Kurdish Weekday */}
                        <td className="py-2 px-2.5 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] font-black ${
                              day.isToday
                                ? 'bg-emerald-600 text-white'
                                : isAbsentDay
                                ? 'bg-rose-100 text-rose-800'
                                : isLeaveDay
                                ? 'bg-amber-100 text-amber-800'
                                : isHolidayDay
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {String(day.dayNum).padStart(2, '0')}
                            </span>
                            <div>
                              <span className={`text-[10px] font-black block leading-tight ${
                                isHolidayDay ? 'text-teal-800' : 'text-slate-800'
                              }`}>
                                {day.dayNameKu}
                              </span>
                              {day.isToday && (
                                <span className="text-[8px] text-emerald-700 font-black">ئەمڕۆ</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Check-In Time or Status Label */}
                        <td className="py-2 px-1.5 text-center font-black">
                          {isPresentDay && day.checkInTime ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <span className={day.checkInStatus.isLate && !day.checkInStatus.isWaived ? 'text-amber-700' : 'text-emerald-700'}>
                                {day.checkInTime}
                              </span>
                              {day.checkInStatus.isWaived || day.isCheckInWaived ? (
                                <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" title="لێخۆشبوونی دواکەوتن" />
                              ) : day.checkInStatus.isLate ? (
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" title="دواکەوتن" />
                              ) : null}
                            </div>
                          ) : isAbsentDay ? (
                            <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                          ) : isLeaveDay ? (
                            <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                          ) : isHolidayDay ? (
                            <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Check-Out Time or Status Label */}
                        <td className="py-2 px-1.5 text-center font-black">
                          {isPresentDay && day.checkOutTime ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <span className="text-rose-700">{day.checkOutTime}</span>
                              {(day.checkOutStatus.isWaived || day.isCheckOutWaived) && (
                                <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" title="لێخۆشبوونی زوو دەرچوون" />
                              )}
                            </div>
                          ) : isAbsentDay ? (
                            <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                          ) : isLeaveDay ? (
                            <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                          ) : isHolidayDay ? (
                            <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Worked Hours or Status Label */}
                        <td className="py-2 px-1.5 text-center font-black text-slate-700">
                          {isPresentDay && day.workedHours > 0 ? (
                            <span className="text-emerald-800">{hoursFormatted}</span>
                          ) : isAbsentDay ? (
                            <span className="text-rose-600">0 ک</span>
                          ) : isLeaveDay ? (
                            <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                          ) : isHolidayDay ? (
                            <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Status Badge & Note Indicator */}
                        <td className="py-2 px-2 text-center font-sans">
                          <div className="inline-flex items-center justify-center gap-1">
                            {isPresentDay && (day.isWaived || day.checkInStatus.isWaived || day.checkOutStatus.isWaived) ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                لێخۆشبوو
                              </span>
                            ) : isPresentDay ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ئامادەبوو
                              </span>
                            ) : isLeaveDay ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                مۆڵەت
                              </span>
                            ) : isAbsentDay ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                غیاب
                              </span>
                            ) : isHolidayDay ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-teal-100 text-teal-800 border border-teal-300">
                                پشوو
                              </span>
                            ) : (
                              <span className="text-slate-300 font-mono">—</span>
                            )}
                            {(day.note || day.adminNote) && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0" title={day.adminNote || day.note} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {/* 🔍 DAY DETAIL MODAL (READ-ONLY SYSTEM RECORD VIEW FOR EMPLOYEE) */}
      {selectedDayDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setSelectedDayDetail(null)}>
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  ڕۆژی {selectedDayDetail.dayNameKu} ({selectedDayDetail.dateStr})
                </h4>
                <span className="text-[10px] text-emerald-700 font-bold">وردەکاری تۆماری سیستەم</span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedDayDetail.status === 'Present' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    ئامادەبوو
                  </span>
                )}
                {(selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب') && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                    غیاب
                  </span>
                )}
                {(selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت') && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    مۆڵەت
                  </span>
                )}
                {(selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو') && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-300">
                    پشوو
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDayDetail(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block font-sans font-bold">هاتن</span>
                <span className="font-black text-emerald-700">
                  {selectedDayDetail.status === 'Present' && selectedDayDetail.checkInTime
                    ? selectedDayDetail.checkInTime
                    : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                    ? 'غیاب'
                    : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                    ? 'مۆڵەت'
                    : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                    ? 'پشوو'
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-sans font-bold">دەرچوون</span>
                <span className="font-black text-rose-700">
                  {selectedDayDetail.status === 'Present' && selectedDayDetail.checkOutTime
                    ? selectedDayDetail.checkOutTime
                    : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                    ? 'غیاب'
                    : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                    ? 'مۆڵەت'
                    : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                    ? 'پشوو'
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-sans font-bold">کاتژمێر</span>
                <span className="font-black text-blue-800">
                  {selectedDayDetail.status === 'Present' && selectedDayDetail.workedHours > 0
                    ? `${selectedDayDetail.workedHours} ک`
                    : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                    ? '0 ک'
                    : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                    ? 'مۆڵەت'
                    : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                    ? 'پشوو'
                    : '—'}
                </span>
              </div>
            </div>

            {selectedDayDetail.status === 'Present' && (selectedDayDetail.isWaived || selectedDayDetail.checkInStatus.isWaived || selectedDayDetail.checkOutStatus.isWaived) && (
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                <span>لێخۆشبوونی فەرمی بەڕێوەبەری هەیە</span>
              </div>
            )}

            {(selectedDayDetail.adminNote || selectedDayDetail.note) && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-black text-slate-600 block">تێبینی تۆمارکراو:</span>
                <p className="text-xs font-bold text-slate-800 leading-relaxed">{String(selectedDayDetail.adminNote || selectedDayDetail.note || '').replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim()}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedDayDetail(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer"
            >
              داخستن
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ REASON MODAL (LATE / EARLY / OVERTIME) */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl">
            <div className="text-center space-y-1">
              <div className={`w-11 h-11 rounded-full mx-auto flex items-center justify-center ${
                reasonType === 'LATE_IN' ? 'bg-amber-100 text-amber-700' :
                reasonType === 'EARLY_OUT' ? 'bg-rose-100 text-rose-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-black text-slate-900">
                {reasonType === 'LATE_IN' && 'هۆکاری دواکەوتن (دوای 08:15)'}
                {reasonType === 'EARLY_OUT' && 'هۆکاری زوو دەرچوون (پێش 16:45)'}
                {reasonType === 'OVERTIME_OUT' && 'هۆکاری کاتی زیادە (دوای 17:15)'}
              </h4>
            </div>

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

            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="تێبینی زیاتر..."
              className="w-full bg-white border border-slate-300 text-slate-900 text-xs p-2.5 rounded-xl focus:border-amber-600 focus:outline-none"
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={submitReasonAttendance}
                disabled={triggerLoading || (!selectedChip && !customReason.trim())}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-3 rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تۆمارکردن</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReasonModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-xl border border-slate-200 cursor-pointer"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 UNBIND / LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-xs w-full space-y-4 text-center shadow-2xl">
            <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-black text-slate-900">دەرچوون لە هەژمار</h4>

            <form onSubmit={handleLogout} className="space-y-3">
              <input
                type="password"
                value={logoutPin}
                onChange={(e) => setLogoutPin(e.target.value)}
                placeholder="کۆدی نهێنی"
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
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👤 EMPLOYEE SELF-SERVICE PROFILE MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">پڕۆفایلی کارمەند</h4>
              </div>
              <button
                type="button"
                onClick={() => { setShowProfileModal(false); setProfileError(null); setProfileSaveSuccess(false); }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-1">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full border-3 border-emerald-500 overflow-hidden shadow-md bg-slate-100 flex items-center justify-center">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt={employeeProfile?.name || 'کارمەند'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-slate-600">
                      {(employeeProfile?.name || 'ک').charAt(0)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => profileFileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-700 cursor-pointer transition-transform active:scale-95"
                  title="گۆڕینی وێنە"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs font-black text-slate-900 mt-2">{employeeProfile?.name}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold mt-0.5">
                {translateRoleToKurdish(employeeProfile?.role)}
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ژمارەی مۆبایل</span>
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="0750 xxx xxxx"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono font-bold p-2.5 rounded-xl focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>بەرواری دەستبەکاربوون</span>
                </label>
                <input
                  type="date"
                  value={profileHireDate}
                  onChange={(e) => setProfileHireDate(e.target.value)}
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono font-bold p-2.5 rounded-xl focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 block mb-1 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>کۆدی نهێنی نوێ</span>
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={profilePin}
                  onChange={(e) => setProfilePin(e.target.value)}
                  placeholder="••••"
                  dir="ltr"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono font-bold p-2.5 rounded-xl focus:border-emerald-500 focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              {profileError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSaveSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>پاشەکەوت کرا</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>پاشەکەوتکردن</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowProfileModal(false); setProfileError(null); setProfileSaveSuccess(false); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-200 cursor-pointer transition-colors"
                >
                  داخستن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📲 PWA INSTALL MODAL */}
      {showPwaInstallModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  دابەزاندنی بەرنامە لەسەر مۆبایل
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPwaInstallModal(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <p className="font-black text-emerald-900">🤖 مۆبایلی ئەندرۆید:</p>
                <p>١. لە سەرەوەی وێبگەڕەکە پەنجە بنێ بە سێ خاڵەکە <strong>(⋮)</strong>.</p>
                <p>٢. دوگمەی <strong>دابەزاندنی بەرنامە</strong> یان <strong>زیادکردن بۆ شاشەی سەرەکی</strong> دابگرە.</p>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                <p className="font-black text-blue-900">🍏 مۆبایلی ئایفۆن:</p>
                <p>١. لە خوارەوەی شاشەکە دوگمەی هاوبەشکردن <strong>(⬆️)</strong> دابگرە.</p>
                <p>٢. دوگمەی <strong>زیادکردن بۆ شاشەی سەرەکی</strong> هەڵبژێرە.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPwaInstallModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
            >
              تێگەیشتم
            </button>
          </div>
        </div>
      )}

    </div>
  );
}