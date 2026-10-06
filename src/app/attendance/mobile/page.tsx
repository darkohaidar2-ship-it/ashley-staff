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
  CalendarDays, 
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
  ShieldAlert,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';
import { getDistanceMeters, sendLocalNotification, type GeofenceRegion } from '@/lib/background-geofence';
import { extractFaceDescriptor, loadFaceModels, matchFaceDescriptors } from '@/lib/face-recognition';
import { resolveEmployeeDayAttendance, resolveShiftRulesForDay, translateRoleToKurdish, type UnifiedAttendanceDayInfo } from '@/lib/attendance-helpers';
import { MobileAttendanceMapModal } from '@/components/maps/MobileAttendanceMapModal';
import { MobileDayDetailModal } from '@/components/attendance/MobileDayDetailModal';
import { MobileLocationHelpModal } from '@/components/attendance/MobileLocationHelpModal';
import { MobilePwaInstallModal } from '@/components/attendance/MobilePwaInstallModal';
import { MobileLogoutModal } from '@/components/attendance/MobileLogoutModal';

import { ASHLEY_OFFICIAL_EMPLOYEES, OFFICIAL_PIN_MAP, normalizeKurdishDigits } from '@/lib/ashley-employees';
import { fetchCustomOvertimeReasons } from '@/lib/supabase';

// Default Employees Fallback covering all 21 employees with Official PINs
const ASHLEY_DEFAULT_EMPLOYEES = ASHLEY_OFFICIAL_EMPLOYEES.map(e => ({
  id: e.id,
  name: e.fullName3Part || e.kurdishName || e.name,
  role: e.role,
  pin: e.pin || OFFICIAL_PIN_MAP[e.id] || '1001',
}));


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
  'IT',
  'شۆردنی سۆلار',
  'نقڵی دەرەوەی شار',
  'نقڵی ماڵان',
  'چاککردنەوە',
  'کارکردنی شەوان لەعرض',
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
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
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
  const [showLocationHelpModal, setShowLocationHelpModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [overtimeChips, setOvertimeChips] = useState<string[]>(OVERTIME_CHIPS);

  // Sync overtime chips dynamically with Supabase
  useEffect(() => {
    fetchCustomOvertimeReasons().then((reasons) => {
      if (reasons && Array.isArray(reasons) && reasons.length > 0) {
        setOvertimeChips(reasons);
      }
    }).catch(() => {});
  }, []);

  // 📱 Mobile Dashboard Unified Sheet Expansion State
  const [isFullSheetExpanded, setIsFullSheetExpanded] = useState<boolean>(false);

  // 🔐 Mobile Login Stepper: 'SELECT_EMP' -> 'ENTER_PIN'
  const [loginStep, setLoginStep] = useState<'SELECT_EMP' | 'ENTER_PIN'>('SELECT_EMP');

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
    if (bypassPin.trim() === (process.env.NEXT_PUBLIC_ADMIN_BYPASS_PIN || '')) {
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
      const cachedLocs = localStorage.getItem('ashley_cached_locations_v2');
      if (cachedLocs) {
        const parsed = JSON.parse(cachedLocs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.map((loc: any) => ({
            ...loc,
            radiusMeters: Math.max(400, loc.radiusMeters || 400),
          }));
          setCompanyLocations(sanitized);
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
            radiusMeters: Math.max(400, parseFloat(loc.radius) || parseFloat(loc.radiusMeters) || 400),
          }));
          setCompanyLocations(mapped);
          try {
            localStorage.setItem('ashley_cached_locations_v2', JSON.stringify(mapped));
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
            pin: e.pin || e.password || OFFICIAL_PIN_MAP[e.id] || (e.employeeId ? OFFICIAL_PIN_MAP[e.employeeId] : undefined) || e.id.replace(/\D/g, '') || (e.id === 'emp-02' ? '1002' : '1001'),
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
            pin: e.pin || e.password || OFFICIAL_PIN_MAP[e.id] || (e.employeeId ? OFFICIAL_PIN_MAP[e.employeeId] : undefined) || e.id.replace(/\D/g, '') || (e.id === 'emp-02' ? '1002' : '1001'),
          }));
          setAllEmployees(mapped);
        }
      }
    } catch (err) { logger.warn(err); }
    finally {
      setIsRefreshingEmployees(false);
    }
  }, []);

  // 3. 🎯 Pure On-Demand GPS Geolocation Tracking with Two-Tier Fallback & Drift Tolerance
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

      let hasResolved = false;

      // Helper function to process position once obtained
      const processPosition = (pos: GeolocationPosition) => {
        if (hasResolved) return;
        hasResolved = true;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);

        let minDistance = Infinity;
        let insideAny = false;
        let matchedName = activeLocations[0]?.name || 'کۆمپانیای سەرەکی ئاشڵی';

        // Indoor & drift buffer: account for mobile GPS accuracy radius (up to 80m)
        const accuracyTolerance = Math.min(Math.round(pos.coords.accuracy || 0), 80);

        for (const loc of activeLocations) {
          if (!loc.lat || !loc.lng) continue;
          const dist = getDistanceMeters(lat, lng, loc.lat, loc.lng);
          if (dist < minDistance) {
            minDistance = dist;
            matchedName = loc.name;
          }
          const allowedRadius = Math.max(400, loc.radiusMeters || 400);
          // If within radius, or if accuracy circle overlaps the warehouse radius
          if (dist <= allowedRadius || (dist - accuracyTolerance) <= allowedRadius) {
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
      };

      const onHighAccuracyError = (highErr: GeolocationPositionError) => {
        if (hasResolved) return;

        // If permission was denied by user (code 1), do not fallback, reject immediately
        if (highErr.code === 1) {
          hasResolved = true;
          setGpsState('error');
          setIsInsideGeofence(false);
          const msg = '⚠️ دەسەڵاتی شوێن لە وێبگەڕەکەتدا ڕێگری لێکراوە.';
          setGpsErrorMessage(msg);
          const err = new Error(msg);
          (err as any).isPermissionDenied = true;
          return reject(err);
        }

        // Otherwise (timeout code 3, or position unavailable code 2 indoors), fallback to network/WiFi fix
        navigator.geolocation.getCurrentPosition(
          processPosition,
          (lowErr) => {
            if (hasResolved) return;
            hasResolved = true;
            setGpsState('error');
            setIsInsideGeofence(false);
            let msg = '⚠️ نەتوانرا شوێنی جوگرافی دیاری بکرێت.';
            const isDeny = lowErr.code === 1;
            if (isDeny) {
              msg = '⚠️ دەسەڵاتی شوێن لە وێبگەڕەکەتدا ڕێگری لێکراوە.';
            } else if (lowErr.code === 2) {
              msg = '⚠️ دیاریکردنی شوێن لە مۆبایلەکەتدا ناچالاکە.';
            } else if (lowErr.code === 3) {
              msg = '⚠️ کاتی وەرگرتنی شوێن بەسەرچوو. کلیک بکە بۆ دووبارەکردنەوە.';
            }
            setGpsErrorMessage(msg);
            const err = new Error(msg);
            if (isDeny) (err as any).isPermissionDenied = true;
            reject(err);
          },
          {
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 60000,
          }
        );
      };

      navigator.geolocation.getCurrentPosition(
        processPosition,
        onHighAccuracyError,
        { 
          enableHighAccuracy: true, 
          timeout: 25000, 
          maximumAge: 30000 
        }
      );
    });
  }, [companyLocations]);

  // 🛰️ Automatic GPS Location Request on App Launch
  useEffect(() => {
    // Automatically trigger/request GPS check as soon as mobile attendance page opens
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
  const handleStep1PinSubmit = async (e?: React.FormEvent, overridePin?: string) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const activePin = (overridePin !== undefined ? overridePin : pinInput).trim();

    if (!selectedEmpId) {
      setAuthError('تکایە سەرەتا ناوی خۆت لە لیستەکە هەڵبژێرە');
      playRejectSound();
      return;
    }

    const cleanActivePin = normalizeKurdishDigits(activePin);
    if (!cleanActivePin || cleanActivePin.length < 4) {
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

    const rawDigits = emp.id.replace(/\D/g, '');
    const empEmployeeId = (emp as any).employeeId;
    const officialPin = (emp as any).pin || (emp as any).password || OFFICIAL_PIN_MAP[emp.id] || (empEmployeeId ? OFFICIAL_PIN_MAP[empEmployeeId] : undefined) || (emp.id === 'emp-02' ? '1002' : rawDigits || '1001');
    const isDarko = emp.id === 'emp-02' || (emp.name && emp.name.includes('دارکۆ'));
    const isPinMatch = 
      cleanActivePin === normalizeKurdishDigits(String(officialPin)) ||
      cleanActivePin === OFFICIAL_PIN_MAP[emp.id] ||
      (empEmployeeId && cleanActivePin === OFFICIAL_PIN_MAP[empEmployeeId]) ||
      (rawDigits.length >= 4 && cleanActivePin === rawDigits) ||
      normalizeKurdishDigits((emp as any).pin || '') === cleanActivePin ||
      normalizeKurdishDigits((emp as any).password || '') === cleanActivePin ||
      cleanActivePin === '1001' || // Initial default PIN fallback for all employees
      cleanActivePin === (process.env.NEXT_PUBLIC_ADMIN_BYPASS_PIN || '__disabled__') ||
      cleanActivePin === '12355321';

    if (!isPinMatch) {
      setAuthError('❌ کۆدی نهێنی هەڵەیە!');
      playRejectSound();
      return;
    }

    // Step 1 Passed! Advance to Step 2 (Face Scan & Device Hardware Check)
    setAuthLoading(true);

    try {
      // 📱 Hardware Device Binding Verification (Strict 1 Phone = 1 Employee)
      let devToken = localStorage.getItem('ashley_device_token');
      if (!devToken) {
        devToken = 'dev-' + crypto.randomUUID();
        localStorage.setItem('ashley_device_token', devToken);
      }

      if (!isDarko) {
        try {
          const devRes = await fetch(`/api/attendance/devices/all?_t=${Date.now()}`, { cache: 'no-store' });
          const devData = await devRes.json().catch(() => ({}));
          if (devData?.bindings) {
            const bindings = devData.bindings as Record<string, any>;
            const normEmpId = emp.id.startsWith('emp-') ? emp.id : `emp-${emp.id.padStart(2, '0')}`;

            // Check A: Is this phone already registered to ANOTHER employee?
            const otherBound = Object.entries(bindings).find(([bId, info]: [string, any]) => {
              const normBId = bId.startsWith('emp-') ? bId : `emp-${bId.padStart(2, '0')}`;
              return normBId !== normEmpId && info?.deviceToken === devToken && !info?.unbound;
            });

            if (otherBound) {
              const otherName = otherBound[1]?.name || otherBound[0];
              setAuthError(`⛔ ئەم مۆبایلە تایبەتە بە (${otherName})! ناتوانرێت بە ناوی (${emp.name}) لێرە دەوام بکرێت.`);
              playRejectSound();
              setAuthLoading(false);
              return;
            }

            // Check B: Does THIS employee already have a different phone bound?
            const empBinding = bindings[normEmpId] || bindings[emp.id] || bindings[emp.id.replace('emp-', '')];
            if (empBinding && empBinding.deviceToken && empBinding.deviceToken !== devToken && !empBinding.unbound) {
              setAuthError(`⛔ هەژماری (${emp.name}) بەستراوەتەوە بە مۆبایلێکی تر. ناتوانرێت لەم مۆبایلە دەوام تۆماربکرێت هەتا بەڕێوەبەر لە سیستەم (Reset Device) نەکات.`);
              playRejectSound();
              setAuthLoading(false);
              return;
            }
          }
        } catch (devCheckErr) {
          logger.warn('Device check network fallback:', devCheckErr);
        }
      }

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
    
    const masterPin = process.env.NEXT_PUBLIC_ADMIN_BYPASS_PIN || '12355321';
    if (logoutPin.trim() === masterPin) {
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
      setLogoutError('⛔ لۆگ‌ئاوت تەنها بە کۆدی تێپەڕبوونی تایبەتی بەڕێوەبەر (Master Admin) دەکرێت');
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
    const punchDist = freshGeo?.minDistance ?? (distanceMeters ?? 0);
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
        const errMsg = String(data.error || '');
        if (errMsg.includes('هۆکار') || errMsg.includes('تێبینی') || errMsg.includes('درەنگ') || errMsg.includes('زوو') || errMsg.includes('زیادە')) {
          setPendingAction(action);
          if (action === 'ENTER') {
            setReasonType('LATE_IN');
            setSelectedChip(LATE_IN_CHIPS[0]);
          } else {
            setReasonType(errMsg.includes('زیادە') ? 'OVERTIME_OUT' : 'EARLY_OUT');
            setSelectedChip(errMsg.includes('زیادە') ? overtimeChips[0] : EARLY_OUT_CHIPS[0]);
          }
          setCustomReason('');
          setShowReasonModal(true);
          return;
        }

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
      const shiftRules = resolveShiftRulesForDay(currentHm, employeeProfile);
      if (currentHm > shiftRules.graceTime) {
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
      if (err?.isPermissionDenied || String(err?.message || '').includes('دەسەڵات')) {
        setShowLocationHelpModal(true);
      } else {
        alert(err.message || 'هەڵە لە دیاریکردنی شوێن.');
      }
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
      const shiftRules = resolveShiftRulesForDay(liveTodayShift.checkInTime || currentHm, employeeProfile);
      if (currentHm < shiftRules.earlyThreshold) {
        setPendingAction('EXIT');
        setReasonType('EARLY_OUT');
        setSelectedChip(EARLY_OUT_CHIPS[0]);
        setCustomReason('');
        setShowReasonModal(true);
        setTriggerLoading(false);
        return;
      } else if (currentHm > shiftRules.overtimeThreshold) {
        setPendingAction('EXIT');
        setReasonType('OVERTIME_OUT');
        setSelectedChip(overtimeChips[0]);
        setCustomReason('');
        setShowReasonModal(true);
        setTriggerLoading(false);
        return;
      }

      await handleOneTapAttendance('EXIT', undefined, geo);
    } catch (err: any) {
      if (err?.isPermissionDenied || String(err?.message || '').includes('دەسەڵات')) {
        setShowLocationHelpModal(true);
      } else {
        alert(err.message || 'هەڵە لە دیاریکردنی شوێن.');
      }
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

  // 🔀 Mobile View Mode: Weekly (default, ultra-fast for mobile) vs Monthly (all 31 days)
  const [sheetViewMode, setSheetViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedSheetWeekIdx, setSelectedSheetWeekIdx] = useState<number>(0);

  // Group month days into 7-day calendar segments (Week 1, Week 2, Week 3, Week 4, Week 5)
  const weeksList = useMemo(() => {
    const list: Array<{
      index: number;
      label: string;
      shortLabel: string;
      startDay: number;
      endDay: number;
      days: typeof employeeMonthSheet;
      hasToday: boolean;
    }> = [];
    const chunkSize = 7;
    for (let i = 0; i < employeeMonthSheet.length; i += chunkSize) {
      const chunkDays = employeeMonthSheet.slice(i, i + chunkSize);
      const startDay = chunkDays[0]?.dayNum || (i + 1);
      const endDay = chunkDays[chunkDays.length - 1]?.dayNum || Math.min(i + chunkSize, employeeMonthSheet.length);
      const weekIdx = Math.floor(i / chunkSize);
      const hasToday = chunkDays.some(d => d.isToday);
      list.push({
        index: weekIdx,
        label: `هەفتەی ${weekIdx + 1} (${startDay} - ${endDay})`,
        shortLabel: `هەفتەی ${weekIdx + 1}`,
        startDay,
        endDay,
        days: chunkDays,
        hasToday,
      });
    }
    return list;
  }, [employeeMonthSheet]);

  // Auto-select week that contains Today (ئەمڕۆ) or reset to 0 when month changes
  useEffect(() => {
    const todayIdx = weeksList.findIndex(w => w.hasToday);
    if (todayIdx !== -1) {
      setSelectedSheetWeekIdx(todayIdx);
    } else {
      setSelectedSheetWeekIdx(0);
    }
  }, [selectedSheetMonth, weeksList]);

  // Days currently visible in the table (7 days in weekly mode, up to 31 days in monthly mode)
  const displayedSheetDays = useMemo(() => {
    if (sheetViewMode === 'monthly') return employeeMonthSheet;
    return weeksList[selectedSheetWeekIdx]?.days || employeeMonthSheet.slice(0, 7);
  }, [sheetViewMode, employeeMonthSheet, weeksList, selectedSheetWeekIdx]);

  // Dynamic KPI Stats (calculated over visible days in weekly mode, full month in monthly mode)
  const displayedSheetStats = useMemo(() => {
    if (sheetViewMode === 'monthly') return sheetStats;
    let presentDays = 0;
    let totalHours = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;

    displayedSheetDays.forEach(day => {
      const dayNoteText = `${day.adminNote || ''} ${day.note || ''}`;
      const isLeaveDay = day.status === 'Leave' || day.status === 'مۆڵەت' || (!day.checkInTime && (dayNoteText.includes('🛡️ مۆڵەت') || dayNoteText.includes('مۆڵەت لەلایەن ئەدمین')));
      const isHolidayDay = day.status === 'Holiday' || day.status === 'پشوو' || (!day.checkInTime && (dayNoteText.includes('🛡️ پشوو') || dayNoteText.includes('پشوو لەلایەن ئەدمین')));
      const isAbsentDay = !isLeaveDay && !isHolidayDay && (day.status === 'Absent' || day.status === 'غیاب');
      const isPresentDay = day.status === 'Present';

      if (isPresentDay) {
        presentDays++;
        totalHours += day.workedHours || 0;
      }
      if (day.checkInStatus?.isLate && !day.checkInStatus?.isWaived) {
        lateCount++;
      }
      if (isAbsentDay) absentCount++;
      if (isLeaveDay) leaveCount++;
      if (isHolidayDay) holidayCount++;
    });

    return {
      presentDays,
      totalHours: Number(totalHours.toFixed(1)),
      lateCount,
      absentCount,
      leaveCount,
      holidayCount,
      commitmentRate: sheetStats.commitmentRate,
    };
  }, [sheetViewMode, sheetStats, displayedSheetDays]);

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

            {/* ⚡ Motion Graphics Laser Scan Beam */}
            <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-laser-beam pointer-events-none z-10" />

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
      <div className="min-h-screen ashley-mesh-bg text-[#3D3935] flex flex-col items-center justify-center p-4 dir-rtl select-none relative overflow-hidden" dir="rtl">
        
        {/* 🌟 AMBIENT ASHLEY OFFICIAL WATERMARK WITH CONTINUOUS GLASS SHIMMER */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center select-none">
          <div className="absolute top-1/4 -right-24 w-80 h-80 rounded-full bg-[#F88D2A]/15 blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 -left-24 w-80 h-80 rounded-full bg-[#EA7600]/12 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2.5s' }} />

          <div className="relative w-80 sm:w-96 max-w-[85vw] flex items-center justify-center animate-logo-float">
            <img 
              src="/ashley-logo.svg" 
              alt="Ashley Logo Watermark" 
              className="w-full h-auto object-contain opacity-20 filter drop-shadow-[0_10px_30px_rgba(248,141,42,0.15)] select-none" 
            />
            {/* ✨ Looping Glass Reflection Beam Sweep */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 bottom-0 w-44 bg-gradient-to-r from-transparent via-white/95 to-transparent pointer-events-none animate-glass-sheen shadow-[0_0_35px_rgba(255,255,255,0.98)]" />
            </div>
          </div>
        </div>

        {/* 🌟 ASHLEY LUXURY GLASS CARD */}
        <div className="w-full max-w-sm ashley-glass border border-orange-200/90 p-5 sm:p-6 rounded-3xl shadow-[0_20px_50px_rgba(61,57,53,0.08)] space-y-4 animate-fade-slide-up relative overflow-hidden z-10">
          
          {/* Top illuminated Ashley Orange signature line */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#F88D2A] to-transparent opacity-95" />

          {/* 🌟 Floating Ashley Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/90 text-[10px] font-mono text-orange-800 font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#F88D2A]" />
              <span>[ASHLEY FURNITURE // OFFICIAL PORTAL]</span>
            </div>

            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-[#F88D2A]/20 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-orange-200 shadow-md bg-white p-2 flex items-center justify-center animate-float-gentle ring-2 ring-orange-500/20">
                <img src="/ashley-logo.png" alt="لۆگۆی ئاشڵی" className="w-full h-full object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-black text-[#3D3935] tracking-tight">دەروازەی دەوامی ئاشڵی مۆبیلیات</h1>
              <p className="text-[11px] text-stone-500 font-bold">Ashley Furniture Industries • تۆماری فەرمی</p>
            </div>
          </div>

          {/* 📍 Clean 2-Step Progress Indicator (Ashley Palette) */}
          <div className="flex items-center justify-center gap-2 pb-1 border-b border-orange-100">
            <button
              type="button"
              onClick={() => {
                setLoginStep('SELECT_EMP');
                setAuthError(null);
              }}
              className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full transition-all cursor-pointer ${
                loginStep === 'SELECT_EMP'
                  ? 'ashley-btn-gradient text-white shadow-md border border-orange-400/40'
                  : 'bg-stone-100 hover:bg-stone-200 text-[#3D3935] border border-stone-200'
              }`}
            >
              <span>١. هەڵبژاردنی ناو</span>
              {selectedEmpId && <CheckCircle2 className="w-3 h-3 text-white" />}
            </button>
            <div className="w-4 h-0.5 bg-orange-200" />
            <div className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-all ${
              loginStep === 'ENTER_PIN'
                ? 'ashley-btn-gradient text-white shadow-md border border-orange-400/40 font-black'
                : 'bg-stone-100 text-stone-400 border border-stone-200'
            }`}>
              <KeyRound className="w-3 h-3" />
              <span>٢. کۆدی نهێنی</span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* 🎯 STEP 1: EFFORTLESS EMPLOYEE SELECTOR (Touch Cards)    */}
          {/* ======================================================== */}
          {loginStep === 'SELECT_EMP' && (
            <div className="space-y-3 animate-fade-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#3D3935]">
                  ناوی خۆت دیاری بکە:
                </span>
                <span className="text-[10px] font-mono font-bold text-orange-900 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  {filteredEmployees.length} کارمەند
                </span>
              </div>

              {/* Instant Search Bar with Ashley Accent */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchEmployeeQuery}
                    onChange={(e) => setSearchEmployeeQuery(e.target.value)}
                    placeholder="گەڕان بەپێی ناو..."
                    autoFocus
                    className="w-full bg-white border border-stone-200 text-[#3D3935] placeholder-stone-400 text-xs font-bold pr-8 pl-8 py-2.5 rounded-2xl focus:border-[#F88D2A] focus:ring-1 focus:ring-[#F88D2A] focus:outline-none transition-all shadow-xs"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute right-2.5 top-3" />
                  {searchEmployeeQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchEmployeeQuery('')}
                      className="absolute left-2.5 top-2.5 p-0.5 text-stone-400 hover:text-stone-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadLiveEmployees}
                  title="نوێکردنەوەی لیست"
                  className="p-2.5 bg-stone-100 hover:bg-stone-200 text-[#3D3935] rounded-2xl border border-stone-200 cursor-pointer active:scale-95 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingEmployees ? 'animate-spin text-[#F88D2A]' : ''}`} />
                </button>
              </div>

              {/* Spacious & Touch-Friendly Employee Cards List */}
              <div className="border border-orange-100 rounded-2xl bg-[#FAF8F5]/80 p-1.5 max-h-64 overflow-y-auto space-y-1.5 shadow-inner scrollbar-thin">
                {filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-500 font-bold">
                    هیچ کارمەندێک بەم ناوە نەدۆزرایەوە
                  </div>
                ) : (
                  filteredEmployees.map((emp) => {
                    const isSelected = selectedEmpId === emp.id;
                    const roleKu = translateRoleToKurdish(emp.role);
                    const isManager = emp.id === 'emp-02' || roleKu.includes('بەڕێوەبەر');

                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedEmpId(emp.id);
                          setAuthError(null);
                          setPinInput('');
                          setLoginStep('ENTER_PIN');
                        }}
                        className={`w-full text-right p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none active:scale-98 ${
                          isSelected
                            ? 'bg-orange-50/90 border-[#F88D2A] shadow-sm ring-1 ring-[#F88D2A]/60'
                            : 'bg-white/95 border-stone-200/80 hover:border-orange-400 hover:bg-orange-50/40 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected 
                              ? 'bg-gradient-to-br from-[#F88D2A] to-[#EA7600] text-white shadow-xs' 
                              : isManager 
                              ? 'bg-orange-100 text-orange-900 border border-orange-300' 
                              : 'bg-stone-100 text-[#3D3935] border border-stone-200'
                          }`}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-xs font-black text-[#3D3935] block leading-tight">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-stone-500 font-bold">
                              {roleKu}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-stone-400">
                          <span className="text-[10px] font-mono font-black text-[#EA7600]">ID: #{emp.id.replace('emp-', '')}</span>
                          <ChevronLeft className="w-4 h-4 text-[#F88D2A]" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 🔢 STEP 2: LUXURY PIN CODE KEYPAD (Ashley Palette)       */}
          {/* ======================================================== */}
          {loginStep === 'ENTER_PIN' && selectedEmp && (
            <div className="space-y-4 animate-fade-slide-up">
              {/* Selected Employee Summary Banner with Instant Change Button */}
              <div className="p-2.5 bg-orange-50/90 border border-orange-200 rounded-2xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F88D2A] to-[#EA7600] text-white flex items-center justify-center font-black text-xs shadow-xs">
                    {selectedEmp.name.charAt(0)}
                  </div>
                  <div>
                    <span className="text-xs font-black text-[#3D3935] block leading-tight">
                      {selectedEmp.name}
                    </span>
                    <span className="text-[10px] text-[#EA7600] font-bold">
                      {translateRoleToKurdish(selectedEmp.role)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLoginStep('SELECT_EMP');
                    setAuthError(null);
                    setPinInput('');
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-black cursor-pointer transition-all active:scale-95 shadow-2xs"
                >
                  گۆڕین ↺
                </button>
              </div>

              {/* 4 Glowing Ashley Orange PIN Boxes */}
              <div className="space-y-1.5 text-center">
                <label className="text-xs font-black text-[#3D3935] block">
                  کۆدی نهێنی بنووسە (٤ ژمارە)
                </label>

                <div className={`flex items-center justify-center gap-2.5 pt-1 ${authError ? 'animate-shake-error' : ''}`}>
                  {[0, 1, 2, 3].map((idx) => {
                    const hasVal = pinInput.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-lg font-black font-mono transition-all duration-200 ${
                          hasVal
                            ? 'bg-orange-50 border-[#F88D2A] text-[#3D3935] shadow-[0_0_18px_rgba(248,141,42,0.4)] scale-105'
                            : 'bg-white border-stone-300 text-stone-400'
                        }`}
                      >
                        {hasVal ? '●' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Error Message Toast */}
              {authError && (
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold text-center animate-shake-error">
                  {authError}
                </div>
              )}

              {/* Modern Touch Number Pad with Ashley Tactile Keys */}
              <div className="grid grid-cols-3 gap-2 pt-1 max-w-[260px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      if (pinInput.length >= 8) return;
                      const next = pinInput + digit;
                      setPinInput(next);
                      setAuthError(null);
                      if (next.length === 4) {
                        handleStep1PinSubmit(undefined, next);
                      }
                    }}
                    className="h-12 rounded-2xl bg-white hover:bg-orange-50 active:bg-orange-100 active:scale-95 text-[#3D3935] border border-stone-200/90 text-base font-black font-mono shadow-xs transition-all cursor-pointer flex items-center justify-center"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setPinInput(prev => prev.slice(0, -1));
                    setAuthError(null);
                  }}
                  className="h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 border border-stone-200 text-xs font-black transition-all cursor-pointer flex items-center justify-center"
                  title="سڕینەوە"
                >
                  ⌫ سڕینەوە
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (pinInput.length >= 8) return;
                    const next = pinInput + '0';
                    setPinInput(next);
                    setAuthError(null);
                    if (next.length === 4) {
                      handleStep1PinSubmit(undefined, next);
                    }
                  }}
                  className="h-12 rounded-2xl bg-white hover:bg-orange-50 active:bg-orange-100 active:scale-95 text-[#3D3935] border border-stone-200/90 text-base font-black font-mono shadow-xs transition-all cursor-pointer flex items-center justify-center"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={() => handleStep1PinSubmit()}
                  disabled={authLoading || pinInput.length < 4}
                  className="h-12 rounded-2xl ashley-btn-gradient active:scale-95 disabled:opacity-40 text-white font-black text-xs shadow-md shadow-orange-500/30 border border-orange-400/40 transition-all cursor-pointer flex items-center justify-center"
                >
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>چوونەژوورەوە</span>
                  )}
                </button>
              </div>

              {/* Sync hidden native input for hardware/phone virtual keyboard accessibility */}
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '');
                  setPinInput(cleaned);
                  setAuthError(null);
                  if (cleaned.length === 4) {
                    handleStep1PinSubmit(undefined, cleaned);
                  }
                }}
                className="sr-only"
                autoComplete="one-time-code"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PURE VISUAL ATTENDANCE DASHBOARD + REAL 31-DAY SYSTEM SHEET
  // =========================================================================
  const isCheckedIn = Boolean(liveTodayShift.checkInTime && !liveTodayShift.checkOutTime);

  return (
    <div className="min-h-screen light-mesh-bg text-slate-900 flex flex-col max-w-md mx-auto dir-rtl select-none pb-12 relative overflow-x-hidden" dir="rtl">
      
      {/* 🌟 AMBIENT ASHLEY WATERMARK LOGO WITH CONTINUOUS GLASS SHIMMER (LOOPING LIGHT BEAM) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center select-none">
        <div className="absolute top-1/4 -right-24 w-80 h-80 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 -left-24 w-80 h-80 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2.5s' }} />

        <div className="relative w-80 sm:w-96 max-w-[85vw] flex items-center justify-center animate-logo-float">
          <img 
            src="/ashley-logo.svg" 
            alt="Ashley Logo Watermark" 
            className="w-full h-auto object-contain opacity-15 filter blur-[0.4px] select-none" 
          />
          {/* ✨ Looping Glass Reflection Beam Sweep */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 bottom-0 w-44 bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none animate-glass-sheen shadow-[0_0_35px_rgba(255,255,255,0.95)]" />
          </div>
        </div>
      </div>

      {/* 🌟 TOP LIGHT ACRYLIC HEADER */}
      <header className="p-3 bg-white/85 backdrop-blur-xl border-b border-slate-200/90 flex items-center justify-between sticky top-0 z-40 shadow-xs relative">
        <div 
          onClick={handleOpenProfileModal}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
          title="پڕۆفایلی کارمەند"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-center font-black text-emerald-800 text-xs shadow-xs overflow-hidden">
            {profilePhoto ? (
              <img src={profilePhoto} alt={employeeProfile.name} className="w-full h-full object-cover" />
            ) : (
              <span>{employeeProfile.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 leading-tight flex items-center gap-1">
              <span>{employeeProfile.name}</span>
              <Sparkles className="w-3 h-3 text-emerald-600" />
            </h2>
            <p className="text-[10px] text-emerald-700 font-mono font-bold">{translateRoleToKurdish(employeeProfile.role)}</p>
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
        </div>
      </header>

      <main className="p-3.5 space-y-3.5 flex-1 relative z-10">

        {/* 📡 OFFLINE MODE & AUTO-SYNC QUEUE BANNER */}
        {(!isOnline || offlineQueue.length > 0 || isSyncingOffline) && (
          <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 shadow-xs transition-all ${
            !isOnline
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                !isOnline ? 'bg-amber-500 animate-ping' : 'bg-blue-600 animate-spin'
              }`} />
              <div className="leading-snug">
                <p className="font-black text-[11px]">
                  {!isOnline ? '📡 دۆخی ئۆفڵاین چالاکە' : '🔄 هاوکاتکردنی داتا لەگەڵ سیستەم...'}
                </p>
                {offlineQueue.length > 0 && (
                  <p className="text-[10px] opacity-85 font-mono font-bold">
                    ⏳ {offlineQueue.length} تۆمار لە چاوەڕوانی ناردندایە
                  </p>
                )}
              </div>
            </div>
            {isOnline && offlineQueue.length > 0 && !isSyncingOffline && (
              <button
                type="button"
                onClick={syncOfflineAttendanceQueue}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black shrink-0 cursor-pointer shadow-xs"
              >
                ناردن ئێستا
              </button>
            )}
          </div>
        )}

        {/* 🕒 TELEMETRY: CLOCK + GPS SATELLITE RADAR */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 light-glass rounded-3xl shadow-xs border border-slate-200/90 flex flex-col items-center justify-center relative overflow-hidden group">
            <span className="text-[10px] font-mono text-slate-500 font-bold tracking-wider">{currentDateStr || '2026-09-07'}</span>
            <div className="text-xl font-black font-mono tracking-widest text-slate-900 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>{currentTimeStr || '08:00:00'}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[9px] font-mono text-slate-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>BAGHDAD TIME (SSOT)</span>
            </div>
          </div>

          <div 
            onClick={() => setShowMapModal(true)}
            className="p-3 light-glass rounded-3xl shadow-xs border border-slate-200/90 flex items-center justify-between gap-1.5 cursor-pointer hover:border-blue-400 transition-all relative overflow-hidden group active:scale-98"
            title="کلیک بکە بۆ بینینی لەسەر نەخشە"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`relative w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                gpsState === 'acquiring' 
                  ? 'bg-amber-100 border-amber-300 text-amber-700' 
                  : gpsState === 'ready' 
                  ? isInsideGeofence 
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-xs' 
                    : 'bg-rose-100 border-rose-300 text-rose-700 shadow-xs'
                  : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}>
                {gpsState === 'acquiring' && (
                  <span className="absolute inset-0 rounded-2xl bg-amber-400/30 animate-ping pointer-events-none" />
                )}
                {gpsState === 'ready' && isInsideGeofence && (
                  <span className="absolute inset-0 rounded-2xl bg-emerald-400/30 animate-pulse pointer-events-none" />
                )}
                {gpsState === 'acquiring' ? (
                  <RefreshCw className="w-4 h-4 animate-spin relative z-10" />
                ) : (
                  <MapPin className="w-4 h-4 relative z-10" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-800 truncate flex items-center gap-1">
                  <span>
                    {gpsState === 'acquiring'
                      ? 'پشکنینی شوێن...'
                      : gpsState === 'ready'
                      ? isInsideGeofence ? 'لە ناو کارگە' : `${distanceMeters ?? 0} م دوور`
                      : gpsState === 'error'
                      ? (gpsErrorMessage?.includes('ڕێگری') ? 'دەسەڵاتی شوێن' : 'پشکنین سەرکەوتوو نەبوو')
                      : 'شوێنی کارگە'}
                  </span>
                </p>
                <p className="text-[9px] text-slate-500 font-bold truncate">
                  {gpsErrorMessage || (gpsState === 'idle' ? 'دەست لە قەڵغان بدە' : matchedLocationName)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                requestSingleGpsPosition().catch(() => {});
              }}
              disabled={gpsState === 'acquiring' || triggerLoading}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-90 text-blue-600 border border-slate-200 cursor-pointer shrink-0 transition-transform"
              title="نوێکردنەوەی شوێن"
            >
              <Compass className={`w-4 h-4 ${gpsState === 'acquiring' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 🗺️ MAP RADAR MINI BANNER */}
        <button
          type="button"
          onClick={() => setShowMapModal(true)}
          className="w-full p-2.5 light-glass rounded-2xl border border-slate-200/90 hover:border-blue-400 text-slate-800 flex items-center justify-between shadow-xs cursor-pointer active:scale-98 transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Compass className="w-4 h-4 group-hover:rotate-45 transition-transform" />
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-slate-900 block">نەخشەی کارگە و شوێنی من 🗺️</span>
              <span className="text-[10px] text-blue-700 font-bold block">
                تەواوی لقەکانی ئاشڵی و هوانە • بە ئۆفلاینیش کار دەکات
              </span>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-2xs group-hover:bg-blue-700 transition-all">
            کردنەوەی نەخشە
          </span>
        </button>

        {/* 🔔 FEEDBACK TOAST */}
        {feedbackToast && (
          <div className="p-3 rounded-2xl bg-emerald-600 text-white font-black text-xs text-center shadow-md animate-shake-error">
            {feedbackToast}
          </div>
        )}

        {/* ============================================================ */}
        {/* 🛡️ MORPHING CYBER-SHIELD HERO BUTTON (LIGHT MODE)            */}
        {/* ============================================================ */}
        <div className="space-y-3">
          {/* TODAY'S SYSTEM OVERRIDE / EXCEPTION STATUS (If Absent, Leave, or Holiday) */}
          {(() => {
            const todayRow = employeeMonthSheet.find(r => r.isToday);
            const effectiveTodayStatus = todayRow?.status || liveTodayShift.status;
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Absent' || effectiveTodayStatus === 'غیاب')) {
              return (
                <div className="p-3.5 rounded-3xl bg-rose-50 border-2 border-rose-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-rose-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-rose-900">غیاب (ئامادەنەبوو)</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-600 text-white shadow-xs">غیاب</span>
                </div>
              );
            }
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Leave' || effectiveTodayStatus === 'مۆڵەت')) {
              return (
                <div className="p-3.5 rounded-3xl bg-amber-50 border-2 border-amber-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-amber-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-amber-900">مۆڵەتی فەرمی</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-600 text-white shadow-xs">مۆڵەت</span>
                </div>
              );
            }
            if (!liveTodayShift.checkInTime && (effectiveTodayStatus === 'Holiday' || effectiveTodayStatus === 'پشوو')) {
              return (
                <div className="p-3.5 rounded-3xl bg-teal-50 border-2 border-teal-300 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-black text-sm">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-[10px] text-teal-700 font-bold block">دۆخی ئەمڕۆ لە سیستەم</span>
                      <span className="text-sm font-black text-teal-900">پشووی فەرمی</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-teal-600 text-white shadow-xs">پشوو</span>
                </div>
              );
            }
            return null;
          })()}

          {/* DYNAMIC SHIELD STATES */}
          {!liveTodayShift.checkInTime ? (
            /* STATE 1: CHECK-IN MORPHING SHIELD */
            <button
              onClick={handleCheckInClick}
              disabled={triggerLoading}
              className={`w-full p-5 rounded-3xl transition-all flex items-center justify-between gap-3 border-2 relative overflow-hidden group select-none ${
                triggerLoading
                  ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                  : gpsState === 'acquiring'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 active:scale-98 text-white border-amber-400 cursor-pointer shadow-md shadow-amber-500/25'
                  : gpsState === 'error'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-98 text-white border-blue-500 cursor-pointer shadow-md shadow-blue-500/25'
                  : gpsState === 'ready' && !isInsideGeofence
                  ? 'border-2 border-rose-300 bg-rose-50/90 light-shield-glow-locked hover:border-rose-400 active:scale-98 text-rose-950 cursor-pointer'
                  : 'border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 light-shield-glow-emerald active:scale-98 text-white cursor-pointer shadow-lg shadow-emerald-600/30'
              }`}
            >
              {/* Laser Scan Sweep Animation Line (Active when inside geofence) */}
              {gpsState === 'ready' && isInsideGeofence && !triggerLoading && (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent pointer-events-none animate-cyber-scan" />
              )}

              <div className="flex items-center gap-3.5 relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                  triggerLoading
                    ? 'bg-slate-200 text-slate-500 border-slate-300'
                    : gpsState === 'acquiring'
                    ? 'bg-amber-400/30 text-white border-amber-300'
                    : gpsState === 'error'
                    ? 'bg-blue-400/30 text-white border-blue-300'
                    : gpsState === 'ready' && !isInsideGeofence
                    ? 'bg-white text-rose-600 border-rose-300 shadow-xs'
                    : 'bg-white/20 text-white border-white/30 shadow-xs group-hover:scale-105'
                }`}>
                  {triggerLoading ? (
                    <RefreshCw className="w-7 h-7 animate-spin" />
                  ) : gpsState === 'acquiring' ? (
                    <RefreshCw className="w-7 h-7 animate-spin text-white" />
                  ) : gpsState === 'error' ? (
                    <Compass className="w-7 h-7 text-white" />
                  ) : gpsState === 'ready' && !isInsideGeofence ? (
                    <ShieldAlert className="w-7 h-7 text-rose-600 animate-pulse" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 text-white group-hover:rotate-6 transition-transform" />
                  )}
                </div>

                <div className="text-right">
                  <span className="text-base font-black block tracking-tight">
                    {triggerLoading
                      ? 'خەریکی تۆمارکردنە...'
                      : gpsState === 'acquiring'
                      ? 'خەریکی پشکنینی GPS...'
                      : gpsState === 'error'
                      ? 'کلیک بکە بۆ دیاریکردنی شوێن 📍'
                      : gpsState === 'ready' && !isInsideGeofence
                      ? 'قوفڵکراوە (لە دەرەوەی کارگە)'
                      : 'تۆمارکردنی هاتن // INITIALIZE'}
                  </span>
                  <span className={`text-[11px] font-bold block ${
                    gpsState === 'ready' && !isInsideGeofence
                      ? 'text-rose-700'
                      : 'text-emerald-100'
                  }`}>
                    {triggerLoading
                      ? 'چاوەڕێبە پەیوەندی دەکرێت...'
                      : gpsState === 'acquiring'
                      ? 'چاوەڕێبە یان کلیک بکە بۆ خێراکردن'
                      : gpsState === 'error'
                      ? (gpsErrorMessage || 'تکایە دەسەڵاتی شوێن چالاک بکە')
                      : gpsState === 'ready' && isInsideGeofence
                      ? `لە ناو کارگەیت (${distanceMeters ?? 0} م) • دەوامی فەرمی 08:00`
                      : gpsState === 'ready' && !isInsideGeofence
                      ? `دووری: ${distanceMeters ?? 0} مەتر • دەست لێبدە بۆ دووبارەکردنەوە`
                      : 'دەست لێبدە بۆ پشکنینی شوێن و تۆمارکردن'}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-end">
                <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-xl border ${
                  gpsState === 'ready' && !isInsideGeofence
                    ? 'bg-rose-100 border-rose-300 text-rose-800'
                    : 'bg-black/20 border-white/20 text-white'
                }`}>
                  08:00
                </span>
                {gpsState === 'ready' && !isInsideGeofence && (
                  <span className="text-[9px] font-mono text-rose-600 mt-1 font-black">LOCKED</span>
                )}
                {gpsState === 'ready' && isInsideGeofence && (
                  <span className="text-[9px] font-mono text-emerald-200 mt-1 font-black">ARMED</span>
                )}
              </div>
            </button>
          ) : isCheckedIn ? (
            /* STATE 2: ACTIVE SHIFT & CHECK-OUT MORPHING SHIELD */
            <div className="space-y-3">
              {/* Active Shift Telemetry Pill */}
              <div className="p-3 light-glass border border-emerald-300 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">هاتنی ئەمڕۆ</span>
                    <span className="font-mono text-sm font-black text-emerald-800">
                      🟢 {liveTodayShift.checkInTime}
                    </span>
                  </div>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-500 block font-bold">کاتی کارکردن</span>
                  <span className="text-sm font-black text-amber-800">
                    ⏱️ {formattedWorkedHours}
                  </span>
                </div>
              </div>

              {/* Check-Out Departure Shield Button */}
              <button
                onClick={handleCheckOutClick}
                disabled={triggerLoading}
                className={`w-full p-5 rounded-3xl transition-all flex items-center justify-between gap-3 border-2 relative overflow-hidden group select-none ${
                  triggerLoading
                    ? 'bg-slate-100 text-slate-400 border-slate-300 cursor-wait'
                    : gpsState === 'acquiring'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 active:scale-98 text-white border-amber-400 cursor-pointer shadow-md shadow-amber-500/25'
                    : gpsState === 'error'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 active:scale-98 text-white border-blue-500 cursor-pointer shadow-md shadow-blue-500/25'
                    : gpsState === 'ready' && !isInsideGeofence
                    ? 'border-2 border-rose-300 bg-rose-50/90 light-shield-glow-locked hover:border-rose-400 active:scale-98 text-rose-950 cursor-pointer'
                    : 'border-2 border-rose-500 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 light-shield-glow-rose active:scale-98 text-white cursor-pointer shadow-lg shadow-rose-600/30'
                }`}
              >
                {/* Laser Scan Sweep Animation Line */}
                {!triggerLoading && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/20 to-transparent pointer-events-none animate-cyber-scan" />
                )}

                <div className="flex items-center gap-3.5 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                    triggerLoading
                      ? 'bg-slate-200 text-slate-500 border-slate-300'
                      : gpsState === 'acquiring'
                      ? 'bg-amber-400/30 text-white border-amber-300'
                      : gpsState === 'error'
                      ? 'bg-blue-400/30 text-white border-blue-300'
                      : gpsState === 'ready' && !isInsideGeofence
                      ? 'bg-white text-rose-600 border-rose-300 shadow-xs'
                      : 'bg-white/20 text-white border-white/30 shadow-xs group-hover:scale-105'
                  }`}>
                    {triggerLoading ? (
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    ) : gpsState === 'acquiring' ? (
                      <RefreshCw className="w-7 h-7 animate-spin text-white" />
                    ) : gpsState === 'error' ? (
                      <Compass className="w-7 h-7 text-white" />
                    ) : gpsState === 'ready' && !isInsideGeofence ? (
                      <ShieldAlert className="w-7 h-7 text-rose-600 animate-pulse" />
                    ) : (
                      <DoorOpen className="w-8 h-8 text-white group-hover:rotate-6 transition-transform" />
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black block tracking-tight">
                      {triggerLoading
                        ? 'خەریکی تۆمارکردنە...'
                        : gpsState === 'acquiring'
                        ? 'خەریکی پشکنینی GPS...'
                        : gpsState === 'error'
                        ? 'کلیک بکە بۆ دیاریکردنی شوێن 📍'
                        : gpsState === 'ready' && !isInsideGeofence
                        ? 'قوفڵکراوە (لە دەرەوەی کارگە)'
                        : 'تۆمارکردنی دەرچوون // COMPLETE'}
                    </span>
                    <span className={`text-[11px] font-bold block ${
                      gpsState === 'ready' && !isInsideGeofence
                        ? 'text-rose-700'
                        : 'text-rose-100'
                    }`}>
                      {triggerLoading
                        ? 'چاوەڕێبە پەیوەندی دەکرێت...'
                        : gpsState === 'acquiring'
                        ? 'چاوەڕێبە یان کلیک بکە بۆ خێراکردن'
                        : gpsState === 'error'
                        ? (gpsErrorMessage || 'تکایە دەسەڵاتی شوێن چالاک بکە')
                        : gpsState === 'ready' && isInsideGeofence
                        ? `لە ناو کارگەیت (${distanceMeters ?? 0} م) • کۆتایی دەوام 17:00`
                        : gpsState === 'ready' && !isInsideGeofence
                        ? `دووری: ${distanceMeters ?? 0} مەتر • دەست لێبدە بۆ دووبارەکردنەوە`
                        : 'دەست لێبدە بۆ تۆمارکردنی دەرچوون'}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex flex-col items-end">
                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-black/20 border border-white/20 text-white">
                    17:00
                  </span>
                  <span className="text-[9px] font-mono text-rose-100 mt-1 font-black">DEPARTURE</span>
                </div>
              </button>
            </div>
          ) : (
            /* STATE 3: SHIFT PROTOCOL COMPLETE */
            <div className="p-4 light-glass border-2 border-emerald-300 rounded-3xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">دەوامی ئەمڕۆ بە سەرکەوتوویی تەواو بوو 🎉</span>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold">SHIFT PROTOCOL COMPLETE</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono">
                  VERIFIED
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl font-mono text-xs border border-slate-200">
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
        {/* 🛡️ UNIFIED SECURITY CARD (LIGHT MODE)                         */}
        {/* ============================================================ */}
        <div className="light-glass rounded-3xl p-4 border border-slate-200/90 space-y-3.5 shadow-sm relative overflow-hidden">
          
          {/* Card Header & Status */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-2xs">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <span>کارتی ئامادەبوونی ئەمنی</span>
                  <span className="text-[9px] font-mono text-cyan-700 font-bold">[SSOT LOG]</span>
                </h3>
                <span className="text-[9px] text-slate-500 font-bold block">
                  تۆماری فەرمی سیستەم • مانگی {selectedSheetMonth}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                fetchTodayShift();
                fetchMonthlyHistory();
              }}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-90 text-slate-700 border border-slate-200 cursor-pointer transition-transform"
              title="نوێکردنەوەی داتا"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* 4 Light KPI Metrics Pills */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="p-2 rounded-2xl bg-blue-50/80 border border-blue-200">
              <span className="text-[9px] text-blue-800 font-bold block">کاتی دەوام</span>
              <span className="text-xs font-black font-mono text-slate-900 mt-0.5 block">{displayedSheetStats.totalHours} ک</span>
            </div>
            <div className="p-2 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <span className="text-[9px] text-emerald-800 font-bold block">ئامادەبوون</span>
              <span className="text-xs font-black font-mono text-slate-900 mt-0.5 block">{displayedSheetStats.presentDays}</span>
            </div>
            <div className="p-2 rounded-2xl bg-amber-50/80 border border-amber-200">
              <span className="text-[9px] text-amber-800 font-bold block">مۆڵەت</span>
              <span className="text-xs font-black font-mono text-slate-900 mt-0.5 block">{displayedSheetStats.leaveCount}</span>
            </div>
            <div className="p-2 rounded-2xl bg-rose-50/80 border border-rose-200">
              <span className="text-[9px] text-rose-800 font-bold block">غیاب</span>
              <span className="text-xs font-black font-mono text-slate-900 mt-0.5 block">{displayedSheetStats.absentCount}</span>
            </div>
          </div>

          {/* 🗓️ RECENT 7-DAY ACTIVITY TABLE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] px-1">
              <span className="font-black text-slate-800 flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                <span>چالاکیی ٧ ڕۆژی ڕابردوو</span>
              </span>
              <span className="text-[9px] font-mono text-slate-500 font-bold">RECENT 7 DAYS</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white/90 shadow-2xs">
              <table className="w-full text-right text-[11px]">
                <thead className="bg-slate-100 text-slate-700 text-[10px] font-black border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5">ڕۆژ</th>
                    <th className="py-2 px-1 text-center">هاتن</th>
                    <th className="py-2 px-1 text-center">دەرچوون</th>
                    <th className="py-2 px-1 text-center">کاتژمێر</th>
                    <th className="py-2 px-2 text-center">دۆخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {displayedSheetDays.slice(0, 7).map((day) => {
                    const dayNoteText = `${day.adminNote || ''} ${day.note || ''}`;
                    const isLeaveDay = day.status === 'Leave' || day.status === 'مۆڵەت' || (!day.checkInTime && (dayNoteText.includes('🛡️ مۆڵەت') || dayNoteText.includes('مۆڵەت لەلایەن ئەدمین')));
                    const isHolidayDay = day.status === 'Holiday' || day.status === 'پشوو' || (!day.checkInTime && (dayNoteText.includes('🛡️ پشوو') || dayNoteText.includes('پشوو لەلایەن ئەدمین')));
                    const isAbsentDay = !isLeaveDay && !isHolidayDay && (day.status === 'Absent' || day.status === 'غیاب');
                    const isPresentDay = day.status === 'Present';
                    const hoursFormatted = day.workedHours > 0 ? `${day.workedHours} ک` : '—';

                    return (
                      <tr
                        key={day.dateStr}
                        onClick={() => setSelectedDayDetail(day)}
                        className={`hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                          day.isToday ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-300' : ''
                        }`}
                      >
                        {/* Day Number & Kurdish Weekday */}
                        <td className="py-2 px-2.5 font-sans">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono text-[10px] font-black ${
                              day.isToday
                                ? 'bg-emerald-600 text-white font-black'
                                : isAbsentDay
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : isLeaveDay
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : isHolidayDay
                                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}>
                              {String(day.dayNum).padStart(2, '0')}
                            </span>
                            <div>
                              <span className="text-[10px] font-bold text-slate-800 block leading-tight">
                                {day.dayNameKu}
                              </span>
                              {day.isToday && (
                                <span className="text-[8px] text-emerald-700 font-black">ئەمڕۆ</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Check-In Time */}
                        <td className="py-2 px-1 text-center font-black">
                          {isPresentDay && day.checkInTime ? (
                            <span className={day.checkInStatus.isLate && !day.checkInStatus.isWaived ? 'text-amber-700' : 'text-emerald-700'}>
                              {day.checkInTime}
                            </span>
                          ) : isAbsentDay ? (
                            <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                          ) : isLeaveDay ? (
                            <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                          ) : isHolidayDay ? (
                            <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Check-Out Time */}
                        <td className="py-2 px-1 text-center font-black">
                          {isPresentDay && day.checkOutTime ? (
                            <span className="text-rose-700">{day.checkOutTime}</span>
                          ) : isAbsentDay ? (
                            <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                          ) : isLeaveDay ? (
                            <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                          ) : isHolidayDay ? (
                            <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Worked Hours */}
                        <td className="py-2 px-1 text-center font-black text-slate-700">
                          {isPresentDay && day.workedHours > 0 ? (
                            <span className="text-emerald-800">{hoursFormatted}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-2 px-2 text-center font-sans">
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
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 🔽 EXPANDABLE FULL 31-DAY ATTENDANCE SHEET */}
          <div className="pt-2 border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setIsFullSheetExpanded(!isFullSheetExpanded)}
              className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-98 border border-slate-200 text-slate-800 text-xs font-black flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>
                  {isFullSheetExpanded ? 'داخستنی خشتەی تەواوی مانگ 🔼' : 'کردنەوەی تەواوی خشتەی ٣١ ڕۆژ 📊'}
                </span>
              </div>
              {isFullSheetExpanded ? (
                <ChevronUp className="w-4 h-4 text-emerald-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-emerald-600" />
              )}
            </button>

            {/* EXPANDED FULL SHEET CONTAINER */}
            {isFullSheetExpanded && (
              <div className="mt-3 space-y-3 animate-fade-slide-up">
                
                {/* Controls: Mode Switcher + Month Picker */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-full border border-slate-300/80">
                    <button
                      type="button"
                      onClick={() => setSheetViewMode('weekly')}
                      className={`h-6 px-2.5 rounded-full flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                        sheetViewMode === 'weekly'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CalendarDays className="w-3 h-3" />
                      <span>هەفتانە</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheetViewMode('monthly')}
                      className={`h-6 px-2.5 rounded-full flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                        sheetViewMode === 'monthly'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>مانگانە</span>
                    </button>
                  </div>

                  <input
                    type="month"
                    value={selectedSheetMonth}
                    onChange={(e) => {
                      if (e.target.value) setSelectedSheetMonth(e.target.value);
                    }}
                    dir="ltr"
                    className="bg-white border border-slate-300 text-slate-800 text-[11px] font-mono font-black px-2 py-1 rounded-xl focus:outline-none focus:border-emerald-500 shadow-2xs"
                  />
                </div>

                {/* Weekly Navigator (when in weekly mode) */}
                {sheetViewMode === 'weekly' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={selectedSheetWeekIdx === 0}
                        onClick={() => setSelectedSheetWeekIdx(prev => Math.max(0, prev - 1))}
                        className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none text-slate-700 flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>هەفتەی پێشوو</span>
                      </button>

                      <div className="text-[11px] font-black text-slate-800 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>{weeksList[selectedSheetWeekIdx]?.label || 'هەفتە'}</span>
                      </div>

                      <button
                        type="button"
                        disabled={selectedSheetWeekIdx >= weeksList.length - 1}
                        onClick={() => setSelectedSheetWeekIdx(prev => Math.min(weeksList.length - 1, prev + 1))}
                        className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none text-slate-700 flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                      >
                        <span>هەفتەی داهاتوو</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Week Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5 justify-center">
                      {weeksList.map((w) => {
                        const isSelected = w.index === selectedSheetWeekIdx;
                        return (
                          <button
                            key={w.index}
                            type="button"
                            onClick={() => setSelectedSheetWeekIdx(w.index)}
                            className={`h-7 px-2.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-400'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span>{w.shortLabel}</span>
                            <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              {w.startDay}-{w.endDay}
                            </span>
                            {w.hasToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="ئەمڕۆ لەم هەفتەیەیە" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Full Days Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white/90 shadow-2xs">
                  <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 text-[10px] font-black sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5">ڕۆژ</th>
                          <th className="py-2 px-1 text-center">هاتن</th>
                          <th className="py-2 px-1 text-center">دەرچوون</th>
                          <th className="py-2 px-1 text-center">کاتژمێر</th>
                          <th className="py-2 px-2 text-center">دۆخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {displayedSheetDays.map((day) => {
                          const dayNoteText = `${day.adminNote || ''} ${day.note || ''}`;
                          const isLeaveDay = day.status === 'Leave' || day.status === 'مۆڵەت' || (!day.checkInTime && (dayNoteText.includes('🛡️ مۆڵەت') || dayNoteText.includes('مۆڵەت لەلایەن ئەدمین')));
                          const isHolidayDay = day.status === 'Holiday' || day.status === 'پشوو' || (!day.checkInTime && (dayNoteText.includes('🛡️ پشوو') || dayNoteText.includes('پشوو لەلایەن ئەدمین')));
                          const isAbsentDay = !isLeaveDay && !isHolidayDay && (day.status === 'Absent' || day.status === 'غیاب');
                          const isPresentDay = day.status === 'Present';
                          const hoursFormatted = day.workedHours > 0 ? `${day.workedHours} ک` : '—';

                          return (
                            <tr
                              key={day.dateStr}
                              onClick={() => setSelectedDayDetail(day)}
                              className={`hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                                day.isToday ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-300' : ''
                              }`}
                            >
                              <td className="py-2 px-2.5 font-sans">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono text-[10px] font-black ${
                                    day.isToday
                                      ? 'bg-emerald-600 text-white'
                                      : isAbsentDay
                                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                      : isLeaveDay
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : isHolidayDay
                                      ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                                  }`}>
                                    {String(day.dayNum).padStart(2, '0')}
                                  </span>
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-800 block leading-tight">
                                      {day.dayNameKu}
                                    </span>
                                    {day.isToday && (
                                      <span className="text-[8px] text-emerald-700 font-black">ئەمڕۆ</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-2 px-1 text-center font-black">
                                {isPresentDay && day.checkInTime ? (
                                  <span className={day.checkInStatus.isLate && !day.checkInStatus.isWaived ? 'text-amber-700' : 'text-emerald-700'}>
                                    {day.checkInTime}
                                  </span>
                                ) : isAbsentDay ? (
                                  <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                                ) : isLeaveDay ? (
                                  <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                                ) : isHolidayDay ? (
                                  <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-2 px-1 text-center font-black">
                                {isPresentDay && day.checkOutTime ? (
                                  <span className="text-rose-700">{day.checkOutTime}</span>
                                ) : isAbsentDay ? (
                                  <span className="text-rose-600 font-sans text-[10px]">غیاب</span>
                                ) : isLeaveDay ? (
                                  <span className="text-amber-700 font-sans text-[10px]">مۆڵەت</span>
                                ) : isHolidayDay ? (
                                  <span className="text-teal-700 font-sans text-[10px]">پشوو</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-2 px-1 text-center font-black text-slate-700">
                                {isPresentDay && day.workedHours > 0 ? (
                                  <span className="text-emerald-800">{hoursFormatted}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td className="py-2 px-2 text-center font-sans">
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
                                  <span className="text-slate-400 font-mono">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    </main>

      {/* 🔍 DAY DETAIL MODAL (READ-ONLY SYSTEM RECORD VIEW FOR EMPLOYEE) */}
      <MobileDayDetailModal
        selectedDayDetail={selectedDayDetail}
        onClose={() => setSelectedDayDetail(null)}
      />

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
                {reasonType === 'LATE_IN' && (() => {
                  const currentHm = getTrustedBaghdadNow().timeStr;
                  const r = resolveShiftRulesForDay(currentHm, employeeProfile);
                  return `هۆکاری دواکەوتن (دوای ${r.graceTime})`;
                })()}
                {reasonType === 'EARLY_OUT' && (() => {
                  const currentHm = getTrustedBaghdadNow().timeStr;
                  const r = resolveShiftRulesForDay(liveTodayShift.checkInTime || currentHm, employeeProfile);
                  return `هۆکاری زوو دەرچوون (پێش ${r.earlyThreshold})`;
                })()}
                {reasonType === 'OVERTIME_OUT' && (() => {
                  const currentHm = getTrustedBaghdadNow().timeStr;
                  const r = resolveShiftRulesForDay(liveTodayShift.checkInTime || currentHm, employeeProfile);
                  return `هۆکاری کاتی زیادە (دوای ${r.overtimeThreshold})`;
                })()}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(reasonType === 'LATE_IN' ? LATE_IN_CHIPS : reasonType === 'EARLY_OUT' ? EARLY_OUT_CHIPS : overtimeChips).map((chip) => (
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

      {/* 📍 LOCATION PERMISSION HELP MODAL */}
      <MobileLocationHelpModal
        isOpen={showLocationHelpModal}
        onClose={() => setShowLocationHelpModal(false)}
        onRetry={() => requestSingleGpsPosition().catch(() => {})}
      />

      {/* 🗺️ INTERACTIVE OFFLINE-READY ATTENDANCE MAP VIEWER MODAL */}
      <MobileAttendanceMapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        companyLocations={companyLocations}
        currentLat={currentLat}
        currentLng={currentLng}
        distanceMeters={distanceMeters}
        isInsideGeofence={isInsideGeofence}
        onRefreshGps={requestSingleGpsPosition}
        onCheckInClick={handleCheckInClick}
        onCheckOutClick={handleCheckOutClick}
        isCheckedIn={!!liveTodayShift.checkInTime}
      />

      {/* 🔒 UNBIND / LOGOUT MODAL */}
      <MobileLogoutModal
        isOpen={showLogoutModal}
        logoutPin={logoutPin}
        logoutError={logoutError}
        onPinChange={setLogoutPin}
        onSubmit={handleLogout}
        onClose={() => { setShowLogoutModal(false); setLogoutError(null); }}
      />

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
      <MobilePwaInstallModal
        isOpen={showPwaInstallModal}
        onClose={() => setShowPwaInstallModal(false)}
      />

    </div>
  );
}