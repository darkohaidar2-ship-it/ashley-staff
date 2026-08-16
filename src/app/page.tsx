'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import { format } from 'date-fns';
import { 
  Users, 
  Camera, 
  Search, 
  Lock, 
  Shield, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Package, 
  Layers, 
  Eye, 
  RefreshCw, 
  LogOut,
  Sparkles,
  AlertTriangle,
  Fingerprint,
  Smartphone,
  SwitchCamera,
  User
} from 'lucide-react';
import { isBiometricSupported, registerBiometric, verifyBiometric } from '@/lib/webauthn';
import { extractFaceDescriptor, matchFaceDescriptors, loadFaceModels } from '@/lib/face-recognition';

// Haversine formula to compute exact distance in meters between two GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function PublicTerminalPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    employees,
    attendanceLogs,
    setAttendanceLogs,
    items,
    settings,
  } = useAppContext();

  // Live Desktop Clock for ERP
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(format(new Date(), 'yyyy-MM-dd | HH:mm:ss'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Factory Geofence Base Location (Synced from Supabase)
  const [syncedLocation, setSyncedLocation] = useState<{
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  }>({
    name: settings?.factoryLocation?.name || 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
    lat: settings?.factoryLocation?.lat || 35.5571,
    lng: settings?.factoryLocation?.lng || 45.4352,
    radiusMeters: settings?.factoryLocation?.radiusMeters || 50,
  });

  // Global Realtime Location Sync from Supabase (Live polling & anti-cache)
  const syncCompanyLocation = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/location?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const loc = await res.json();
        if (loc?.lat && loc?.lng) {
          setSyncedLocation(loc);
        }
      }
    } catch (err) {
      console.error('Error fetching company location:', err);
    }
  }, []);

  useEffect(() => {
    syncCompanyLocation();
    const interval = setInterval(syncCompanyLocation, 3000);
    window.addEventListener('focus', syncCompanyLocation);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncCompanyLocation);
    };
  }, [syncCompanyLocation]);

  // --- Attendance State (Right Side) ---
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // Biometric (Fingerprint / Face ID) State
  const [bioSupported, setBioSupported] = useState<boolean>(false);
  const [hasBiometric, setHasBiometric] = useState<boolean>(false);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);

  // AI Face Recognition State
  const [hasFaceRegistered, setHasFaceRegistered] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [facePhotoUrl, setFacePhotoUrl] = useState<string | null>(null);
  const [registeredFacesList, setRegisteredFacesList] = useState<Array<{ id: string; name: string; descriptor: number[] }>>([]);
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [faceInsideOval, setFaceInsideOval] = useState(false);
  const [faceScanMessage, setFaceScanMessage] = useState<string | null>(null);
  const [faceScanSuccess, setFaceScanSuccess] = useState<boolean | null>(null);
  const [activeFaceAction, setActiveFaceAction] = useState<'Check In' | 'Check Out' | 'Register' | null>(null);

  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingScanRef = useRef(false);

  // Pre-load AI Face models on mount
  useEffect(() => {
    loadFaceModels().catch((e) => console.log('Preloading face models:', e));
  }, []);

  // Fetch all registered employees with face descriptors for Instant Zero-Selection Auto-Identification
  const fetchAllFaces = useCallback(async () => {
    try {
      let combinedMap: Record<string, any> = {};

      // 1. Read local cache first
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        Object.values(localDb).forEach((u: any) => {
          if (u?.id && u?.descriptor) combinedMap[u.id] = u;
        });
      } catch {}

      // 2. Fetch from Supabase
      const res = await fetch(`/api/attendance/face/all?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.employees) {
          data.employees.forEach((u: any) => {
            if (u?.id && u?.descriptor) combinedMap[u.id] = u;
          });
        }
      }

      const list = Object.values(combinedMap);
      setRegisteredFacesList(list);
    } catch (err) {
      console.error('Error loading face database:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllFaces();
  }, [fetchAllFaces]);

  // GPS Geofence State
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Model Search State (Left Side) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  useEffect(() => {
    setBioSupported(isBiometricSupported());
  }, []);

  // Check biometric & AI Face pairing status when employee is selected
  useEffect(() => {
    if (!selectedEmpId) {
      setHasBiometric(false);
      setHasFaceRegistered(false);
      setFaceDescriptor(null);
      return;
    }

    // 1. Biometrics status
    const localBio = typeof window !== 'undefined' ? localStorage.getItem(`ashley_bio_${selectedEmpId}`) : null;
    if (localBio) {
      setHasBiometric(true);
    } else {
      fetch(`/api/attendance/biometrics/status?userId=${selectedEmpId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.hasBiometrics) {
            setHasBiometric(true);
            if (data.credentialId && typeof window !== 'undefined') {
              localStorage.setItem(`ashley_bio_${selectedEmpId}`, data.credentialId);
            }
          } else {
            setHasBiometric(false);
          }
        })
        .catch(() => setHasBiometric(false));
    }

    // 2. AI Face status for selected user
    const matched = registeredFacesList.find((f) => f.id === selectedEmpId);
    if (matched && matched.descriptor) {
      setHasFaceRegistered(true);
      setFaceDescriptor(matched.descriptor);
    } else {
      fetch(`/api/attendance/face/status?userId=${selectedEmpId}&_t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.hasFaceRegistered && data.descriptor) {
            setHasFaceRegistered(true);
            setFaceDescriptor(data.descriptor);
            setFacePhotoUrl(data.photoUrl);
          } else {
            setHasFaceRegistered(false);
            setFaceDescriptor(null);
            setFacePhotoUrl(null);
          }
        })
        .catch(() => setHasFaceRegistered(false));
    }
  }, [selectedEmpId, registeredFacesList]);

  // Request GPS Location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('جی پی ئێس لە وێبگەڕ پشتیوانی نەکراوە');
      return;
    }
    setGpsLoading(true);
    setGpsStatus('پشکنینی دووری لە کۆمپانیا...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        const targetLat = syncedLocation.lat || 35.5571;
        const targetLng = syncedLocation.lng || 45.4352;
        const radius = syncedLocation.radiusMeters || 50;

        const dist = calculateDistanceMeters(uLat, uLng, targetLat, targetLng);
        setDistanceMeters(dist);
        const inside = dist <= radius;
        setGpsStatus(inside ? `ناو سنووری کۆمپانیا (${dist}m)` : `دەرەوەی کۆمپانیا (${dist}m)`);
        setGpsLoading(false);
      },
      () => {
        setGpsStatus('تکایە ڕێگەپێدانی لۆکەیشن (GPS) لە مۆبایل کارا بکە');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, [syncedLocation]);

  // Start Camera with Front / Back selection
  const startCamera = async (mode = facingMode) => {
    try {
      setCameraActive(true);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 640 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setAttMessage({ text: 'کامیرا نەدۆزرایەوە! ڕێگەپێدانی کامێرا کارا بکە', success: false });
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isProcessingScanRef.current = false;
    setFaceInsideOval(false);
    setCameraActive(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  // Capture Selfie Photo (Compressed to 500x500 ~45KB for 100% Mobile Sync)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, 500, 500);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setCapturedSelfie(dataUrl);
      stopCamera();
    }
  };

  // Process Offline Pending Mobile Check-in Queue
  const processPendingMobileQueue = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const pendingStr = localStorage.getItem('ashley_pending_checkins');
      if (!pendingStr) return;
      const pendingList: any[] = JSON.parse(pendingStr);
      if (!Array.isArray(pendingList) || pendingList.length === 0) return;

      const remaining: any[] = [];
      for (const logItem of pendingList) {
        try {
          const res = await fetch('/api/attendance/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logItem),
          });
          if (!res.ok) remaining.push(logItem);
        } catch (err) {
          remaining.push(logItem);
        }
      }

      localStorage.setItem('ashley_pending_checkins', JSON.stringify(remaining));
      
      if (remaining.length === 0) {
         setAttMessage({
           text: `هەموو چێک ئینە هەڵگیراوەکانی مۆبایلەکە بە سەرکەوتوویی نێردران بۆ داتابەیز!`,
           success: true,
         });
         setTimeout(() => setAttMessage(null), 3000);
      }
    } catch (err) {
      console.error('Pending queue error:', err);
    }
  };

  // Fetch Supabase attendance logs on mount & setup offline sync listeners
  useEffect(() => {
    fetch('/api/attendance/logs')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAttendanceLogs((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newLogs = data.filter((d: any) => !existingIds.has(d.id));
            return [...newLogs, ...prev];
          });
        }
      })
      .catch((err) => console.error('Supabase logs fetch error:', err));

    processPendingMobileQueue();
    window.addEventListener('online', processPendingMobileQueue);
    const queueInterval = setInterval(processPendingMobileQueue, 5000);

    return () => {
      window.removeEventListener('online', processPendingMobileQueue);
      clearInterval(queueInterval);
    };
  }, []);

  // Submit Attendance Log to Local + Central Supabase Server
  const submitAttendanceLog = (
    type: 'Check In' | 'Check Out',
    emp: { id: string; name: string },
    verificationMethod: string
  ) => {
    const timeNow = format(new Date(), 'HH:mm');
    const dateNow = format(new Date(), 'yyyy-MM-dd');

    const thankMsg =
      type === 'Check In'
        ? `🎉 سوپاس بۆ چێک ئین! (هاتنی ${emp.name} بە سەرکەوتوویی لە سیستەم تۆمارکرا ✅)`
        : `🎉 سوپاس بۆ چێک ئاوت! (دەرچوونی ${emp.name} بە سەرکەوتوویی لە سیستەم تۆمارکرا ✅)`;

    const newLog: any = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      employeeId: emp.id,
      employeeName: emp.name,
      name: emp.name,
      userName: emp.name,
      date: dateNow,
      log_date: dateNow,
      time: timeNow,
      log_time_str: timeNow,
      type: type,
      log_type: type,
      status: verificationMethod,
      distance: distanceMeters !== null ? `${distanceMeters}m لە کۆمپانیا` : 'ناو کۆمپانیا',
      createdAt: timeNow,
    };

    const updatedLogs = [newLog, ...attendanceLogs];
    setAttendanceLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_local_attendanceLogs', JSON.stringify(updatedLogs));
    }

    setAttMessage({
      text: thankMsg,
      success: true,
    });

    // Sync to Supabase Real-Time Backend
    fetch('/api/attendance/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setAttMessage({
            text: data.message || data.error || '⚠️ ناتوانرێت ئەم ئامادەبوونە دووبارە تۆمار بکرێت',
            success: false,
          });
          return;
        }
        setAttMessage({
          text: thankMsg,
          success: true,
        });
      })
      .catch((err) => {
        console.error('Supabase attendance post error - saving to offline queue:', err);
        if (typeof window !== 'undefined') {
          const pending = JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]');
          localStorage.setItem('ashley_pending_checkins', JSON.stringify([...pending, newLog]));
        }
      });

    setCapturedSelfie(null);

    setTimeout(() => {
      setAttMessage((prev) => (prev?.text === thankMsg ? null : prev));
    }, 6000);
  };

  // Handle Biometric Device Registration (Pair Fingerprint to Employee)
  const handleRegisterBiometric = async () => {
    if (!selectedEmpId) {
      setAttMessage({ text: 'تکایە سەرەتا ناوی خۆت لە لیستەکەدا هەڵبژێرە', success: false });
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    if (!pinCode.trim() || pinCode.trim() !== (emp.password || '1234')) {
      setAttMessage({ text: 'تکایە کۆدی PINـی دروست بنووسە بۆ دڵنیابوونەوەی سەرەتایی ناسنامە', success: false });
      return;
    }

    try {
      setBiometricLoading(true);
      const credentialId = await registerBiometric(emp.id, emp.fullName3Part || emp.name);

      await fetch('/api/attendance/biometrics/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.id, credentialId }),
      });

      setHasBiometric(true);
      setAttMessage({
        text: `🎉 پەنجەمۆر / Face IDـی ئەم مۆبایلە بە سەرکەوتوویی بۆ (${emp.name}) چالاککرا! لەمەودوا بە پەنجەمۆر دەتوانیت چێک‌ئین بکەیت.`,
        success: true,
      });
    } catch (err: any) {
      setAttMessage({ text: err.message || 'هەڵە لە تۆمارکردنی پەنجەمۆر', success: false });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Handle Fast Biometric Check-In / Check-Out
  const handleBiometricAuth = async (type: 'Check In' | 'Check Out') => {
    if (!selectedEmpId) {
      setAttMessage({ text: 'تکایە ناوی خۆت لە لیستەکەدا هەڵبژێرە', success: false });
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    const radius = syncedLocation.radiusMeters || 50;
    if (distanceMeters !== null && distanceMeters > radius) {
      setAttMessage({
        text: `⚠️ ناتوانیت چێک ئین بکەیت! دووریت لە کۆمپانیا (${distanceMeters} مەتر)ە و دەبێت کەمتر لە ${radius} مەتر بێت.`,
        success: false,
      });
      return;
    }

    try {
      setBiometricLoading(true);

      let credId = typeof window !== 'undefined' ? localStorage.getItem(`ashley_bio_${emp.id}`) : null;
      if (!credId) {
        const res = await fetch(`/api/attendance/biometrics/status?userId=${emp.id}`);
        const data = await res.json();
        credId = data?.credentialId || null;
      }

      if (!credId) {
        setAttMessage({
          text: `⚠️ تۆ هێشتا پەنجەمۆری ئەم مۆبایلەت بۆ (${emp.name}) نەبەستووەتەوە!`,
          success: false,
        });
        return;
      }

      const verified = await verifyBiometric(emp.id, credId);
      if (verified) {
        submitAttendanceLog(type, emp, 'پەنجەمۆری مۆبایل');
      }
    } catch (err: any) {
      setAttMessage({
        text: err.message || '❌ پەنجەمۆر نەناسرا!',
        success: false,
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  // Universal Instant AI Face Check-In & Check-Out (Identifies Employee Automatically)
  const handleStartUniversalFaceAuth = async (type: 'Check In' | 'Check Out') => {
    fetchAllFaces(); // Ensure latest registered face database is loaded
    const radius = syncedLocation.radiusMeters || 50;
    if (distanceMeters !== null && distanceMeters > radius) {
      setAttMessage({
        text: `⚠️ ناتوانیت چێک‌ئین بکەیت! دووریت لە کۆمپانیا (${distanceMeters}m)ە و دەبێت کەمتر لە ${radius}m بێت.`,
        success: false,
      });
      return;
    }

    setActiveFaceAction(type);
    setFaceScanMessage('دەموچاو بخەرە ناو بازنەکەوە بۆ ناسینەوەی خۆکار...');
    setFaceScanSuccess(null);
    setFaceInsideOval(false);
    isProcessingScanRef.current = false;
    await startCamera();
  };

  const handleVerifyUniversalFace = useCallback(async () => {
    if (!videoRef.current || !activeFaceAction) return;
    if (activeFaceAction !== 'Check In' && activeFaceAction !== 'Check Out') return;
    const actionType: 'Check In' | 'Check Out' = activeFaceAction;

    try {
      const liveResult = await extractFaceDescriptor(videoRef.current);
      if (!liveResult) {
        isProcessingScanRef.current = false;
        return;
      }

      // If specific employee selected -> match that employee directly
      if (selectedEmpId && faceDescriptor) {
        const emp = employees.find((e) => e.id === selectedEmpId);
        const match = matchFaceDescriptors(liveResult.descriptor, faceDescriptor);
        if (match.isMatch && emp) {
          // Immediately close camera tab!
          stopCamera();
          setActiveFaceAction(null);
          submitAttendanceLog(actionType, emp, `ڕوخسارناسینەوەی AI (${match.similarityPercent}٪)`);
          return;
        } else {
          isProcessingScanRef.current = false;
          return;
        }
      }

      // Zero-Selection Auto-Identification across ALL employees in database
      let bestMatch: { emp: any; score: number; similarity: number } | null = null;
      let lowestDist = 999;

      for (const reg of registeredFacesList) {
        const match = matchFaceDescriptors(liveResult.descriptor, reg.descriptor);
        if (match.isMatch && match.distance < lowestDist) {
          lowestDist = match.distance;
          bestMatch = {
            emp: reg,
            score: match.distance,
            similarity: match.similarityPercent,
          };
        }
      }

      if (bestMatch && bestMatch.emp) {
        const matchedEmp = employees.find((e) => e.id === bestMatch.emp.id) || {
          id: bestMatch.emp.id,
          name: bestMatch.emp.name,
        };

        // Immediately stop camera and close camera viewfinder tab!
        stopCamera();
        setActiveFaceAction(null);

        // Submit log to Supabase system database and show Thank You banner!
        submitAttendanceLog(actionType, matchedEmp, `ڕوخسارناسینەوەی AI (${bestMatch.similarity}٪)`);
      } else {
        isProcessingScanRef.current = false;
      }
    } catch {
      isProcessingScanRef.current = false;
    }
  }, [activeFaceAction, selectedEmpId, faceDescriptor, employees, registeredFacesList, submitAttendanceLog]);

  // Live Auto-Scanning loop for Zero-Selection Face Check-In (silky smooth, non-blocking)
  useEffect(() => {
    if (!activeFaceAction || !cameraActive) {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
      return;
    }

    autoScanTimerRef.current = setInterval(async () => {
      if (!videoRef.current || isProcessingScanRef.current || videoRef.current.readyState < 2) return;

      try {
        const liveResult = await extractFaceDescriptor(videoRef.current);
        if (liveResult && !isProcessingScanRef.current) {
          setFaceInsideOval(true);
          // Auto trigger verify & attendance registration!
          handleVerifyUniversalFace();
        } else {
          setFaceInsideOval(false);
        }
      } catch {}
    }, 400);

    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [activeFaceAction, cameraActive, handleVerifyUniversalFace]);

  // Manual Check-In / Check-Out Submission (PIN + Selfie)
  const handleCheckInOrOut = (type: 'Check In' | 'Check Out') => {
    if (!selectedEmpId) {
      setAttMessage({ text: 'تکایە ناوی خۆت لە لیستەکەدا هەڵبژێرە', success: false });
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    if (pinCode.trim() !== (emp.password || '1234')) {
      setAttMessage({ text: 'کۆدی PIN هەڵەیە! (تکایە کۆدە دروستەکەت بنووسە)', success: false });
      return;
    }

    const radius = syncedLocation.radiusMeters || 50;
    // Location Geofence check
    if (distanceMeters !== null && distanceMeters > radius) {
      setAttMessage({
        text: `⚠️ ناتوانیت چێک ئین بکەیت! دووریت لە کۆمپانیا (${distanceMeters} مەتر)ە و دەبێت کەمتر لە ${radius} مەتر بێت.`,
        success: false,
      });
      return;
    }

    submitAttendanceLog(type, emp, 'کۆدی PIN');
  };

  // Filter Catalog Items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.model && item.model.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.classification && item.classification.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategoryFilter === 'all' || item.classification === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white p-3 sm:p-6 lg:p-8 space-y-5 dir-rtl relative overflow-x-hidden" dir="rtl">
      
      {/* 🌌 iOS Control Center Ambient Background Blurs */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-[40%] left-[30%] w-[400px] h-[400px] bg-rose-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* ========================================================================= */}
      {/* 🍎 1. iOS CONTROL CENTER TOP STATUS BAR */}
      {/* ========================================================================= */}
      <header className="w-full bg-slate-900/70 border border-white/10 backdrop-blur-2xl rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 sticky top-3 z-40 transition-all">
        
        {/* Brand & Factory Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
                سیستەمی کارمەندانی ئاشڵی
              </h1>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                CONTROL CENTER
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span>{syncedLocation.name || 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)'}</span>
            </p>
          </div>
        </div>

        {/* 📍 ULTRA-COMPACT SLEEK LOCATION STATUS PILL (Zero Layout Shift) */}
        <div 
          onClick={requestLocation}
          title="کرتە بکە بۆ نوێکردنەوەی دەستی لۆکەیشن"
          className={`h-8 px-3 rounded-full border backdrop-blur-xl flex items-center gap-2 text-[11px] font-black transition-all cursor-pointer select-none shadow-sm ${
            distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25'
              : distanceMeters !== null
              ? 'bg-rose-500/15 border-rose-400/30 text-rose-300 hover:bg-rose-500/25'
              : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/15'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse'
                : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
            }`}
          />
          <span className="font-mono">
            {distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
              ? `لە کۆمپانیا (${distanceMeters}m)`
              : distanceMeters !== null
              ? `دەرەوەی سنوور (${distanceMeters}m)`
              : gpsStatus || 'لۆکەیشن پشکنراو'}
          </span>
          <RefreshCw className={`w-3 h-3 opacity-60 ${gpsLoading ? 'animate-spin opacity-100' : ''}`} />
        </div>

        {/* Live Clock & Admin Control */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-xs font-bold text-slate-200">
              {currentTimeStr || '--:--'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black py-1.5 px-3.5 rounded-2xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>ئەدمین</span>
              </Link>
              <button
                onClick={() => logout()}
                className="bg-white/10 hover:bg-rose-500/20 text-rose-300 border border-white/15 text-xs font-bold py-1.5 px-3 rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black py-1.5 px-3.5 rounded-2xl shadow-md border border-white/15 hover:scale-105 active:scale-95 transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>چوونەژوورەوە</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🚀 DYNAMIC ISLAND NOTIFICATION TOAST */}
      {attMessage && (
        <div
          className={`p-4 text-xs sm:text-sm font-black rounded-3xl border shadow-2xl flex items-center gap-3 backdrop-blur-2xl animate-in slide-in-from-top-4 duration-300 ${
            attMessage.success
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/50 shadow-emerald-950/50'
              : 'bg-rose-950/80 text-rose-200 border-rose-500/50 shadow-rose-950/50'
          }`}
        >
          <Sparkles className="w-5 h-5 flex-shrink-0 text-amber-300 animate-pulse" />
          <span>{attMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📱 2. iOS CONTROL CENTER RESPONSIVE BENTO GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* ----------------------------------------------------------------- */}
        {/* 📸 RIGHT TILE: iOS AI FACE ATTENDANCE CONTROLLER */}
        {/* ----------------------------------------------------------------- */}
        <section className="lg:col-span-5 bg-slate-900/80 border border-white/15 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
          
          {/* Ambient Corner Flare */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Widget Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs font-black text-white">ئامادەبوونی خۆکار بە دەموچاو</h2>
                <p className="text-[10px] text-slate-400 font-semibold">بێ دەستلێدان (Zero-Touch AI Scan)</p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-white/10 border border-white/15 text-indigo-200 px-2.5 py-1 rounded-full">
              {registeredFacesList.length} کارمەند تۆمارە
            </span>
          </div>

          {/* 📷 ACTIVE CAMERA VIEWFINDER */}
          {activeFaceAction ? (
            <div className="p-3 bg-black/70 backdrop-blur-2xl rounded-3xl border border-white/15 space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1.5 text-amber-300">
                  <Camera className="w-4 h-4" />
                  <span>ناسینەوەی دەموچاو بۆ ({activeFaceAction})</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl text-[10px] font-bold text-amber-200 flex items-center gap-1 transition-all"
                  >
                    <SwitchCamera className="w-3 h-3" />
                    <span>{facingMode === 'user' ? 'پشتەوە' : 'پێشەوە'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setActiveFaceAction(null);
                    }}
                    className="text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl text-slate-300"
                  >
                    داخستن ✕
                  </button>
                </div>
              </div>

              {/* Video Viewport with Smooth Human Oval Bezel */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-[300px] flex items-center justify-center border border-white/15 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Smooth Oval HUD Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-3">
                  <div className="w-44 h-56 rounded-[50%/60%] transition-colors duration-300 flex flex-col items-center justify-center relative border-2 border-dashed border-indigo-300/80 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                    <div className="absolute top-2 left-4 w-3.5 h-3.5 border-t-2 border-l-2 border-white/70" />
                    <div className="absolute top-2 right-4 w-3.5 h-3.5 border-t-2 border-r-2 border-white/70" />
                    <div className="absolute bottom-2 left-4 w-3.5 h-3.5 border-b-2 border-l-2 border-white/70" />
                    <div className="absolute bottom-2 right-4 w-3.5 h-3.5 border-b-2 border-r-2 border-white/70" />
                    
                    <div className="text-center space-y-1">
                      <User className="w-9 h-9 text-white/40 mx-auto" />
                      <span className="text-[9px] font-bold text-white/80 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                        دەموچاو لێرە دابنێ
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-amber-200 shadow-md">
                    ⚡ دەموچاو بخەرە ناو بازنەکە، خۆکارانە دەیناسێتەوە
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 📱 TWO LARGE iOS CONTROL CENTER ACTION TILES */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              
              {/* 📥 iOS Check In Tile */}
              <button
                type="button"
                disabled={isFaceScanning || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                onClick={() => handleStartUniversalFaceAuth('Check In')}
                className={`relative group overflow-hidden py-5 px-4 rounded-3xl flex flex-col items-center justify-center gap-2 text-white transition-all duration-300 shadow-xl ${
                  distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                    ? 'bg-slate-800/60 border border-white/5 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-br from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-95 border border-white/20'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black tracking-wide block">
                    📥 چێک‌ئین (Check In)
                  </span>
                  <span className="text-[10px] text-teal-100/90 font-bold block mt-0.5">
                    {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'قوفڵە (لەدەرەوەی سنوور)'
                      : 'سەیری کامێرا بکە بۆ هاتن'}
                  </span>
                </div>
              </button>

              {/* 📤 iOS Check Out Tile */}
              <button
                type="button"
                disabled={isFaceScanning || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                onClick={() => handleStartUniversalFaceAuth('Check Out')}
                className={`relative group overflow-hidden py-5 px-4 rounded-3xl flex flex-col items-center justify-center gap-2 text-white transition-all duration-300 shadow-xl ${
                  distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                    ? 'bg-slate-800/60 border border-white/5 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 shadow-rose-500/20 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-95 border border-white/20'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black tracking-wide block">
                    📤 چێک‌ئاوت (Check Out)
                  </span>
                  <span className="text-[10px] text-rose-100/90 font-bold block mt-0.5">
                    {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'قوفڵە (لەدەرەوەی سنوور)'
                      : 'سەیری کامێرا بکە بۆ دەرچوون'}
                  </span>
                </div>
              </button>

            </div>
          )}

          {/* 👆 iOS Collapsible PIN / Biometrics Accordion */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowManualFallback(!showManualFallback)}
              className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-slate-300 flex items-center justify-between transition-colors border border-white/10"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>شێوازی دەستی یان کۆدی PIN</span>
              </span>
              <span className="text-xs font-mono text-slate-400">{showManualFallback ? '▲' : '▼'}</span>
            </button>

            {showManualFallback && (
              <div className="mt-3 p-4 bg-black/40 border border-white/10 rounded-3xl space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">
                    ناوی کارمەند هەڵبژێرە:
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full py-2.5 px-3 bg-slate-900 border border-white/20 rounded-xl text-xs font-black text-white outline-none"
                  >
                    <option value="">-- ناوی خۆت هەڵبژێرە --</option>
                    {employees
                      .filter((e) => e.status !== 'resigned' && e.isActive !== false)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">کۆدی PIN:</label>
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="کۆدی 1234..."
                    className="w-full py-2.5 px-3 bg-slate-900 border border-white/20 rounded-xl font-mono text-center text-xs tracking-widest text-white outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCheckInOrOut('Check In')}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
                  >
                    📥 هاتن بە PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckInOrOut('Check Out')}
                    className="py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
                  >
                    📤 دەرچوون بە PIN
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* 🔍 LEFT TILE: PROMINENT MASSIVE iOS SEARCH & CATALOG ENGINE */}
        {/* ----------------------------------------------------------------- */}
        <section className="lg:col-span-7 bg-slate-900/80 border border-white/15 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white">
                  گەڕانی مۆدێل و کاڵاکانی کۆگا (iOS Inventory Search)
                </h2>
                <p className="text-[10px] text-slate-400 font-semibold">
                  بەردەستبوونی مۆدێلەکان و پشکنینی خێرای ئیستۆک
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full">
              {filteredItems.length} مۆدێل دۆزراوەتەوە
            </span>
          </div>

          <div className="space-y-4">

            {/* 🌟 PROMINENT EXPANSIVE iOS SEARCH BAR (سێرچی گەورە) */}
            <div className="space-y-3">
              <div className="relative flex items-center bg-white/10 hover:bg-white/15 focus-within:bg-white/15 border border-white/20 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/20 rounded-2xl px-4 py-3.5 shadow-xl transition-all">
                <Search className="w-5 h-5 text-indigo-300 flex-shrink-0 ml-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ناوی مۆدێل، کۆدی کاڵا، یان ناوی پۆلێن لێرە بنووسە..."
                  className="w-full text-sm font-bold text-white bg-transparent outline-none placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* iOS Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-bold ml-1 text-[11px]">پۆلێن:</span>
                {['all', 'نەخشەی رەفە', 'مۆدێلی ئاشڵی', 'مەواد', 'کاڵای فرۆشراو'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-3 py-1 text-[11px] font-black rounded-full border transition-all ${
                      selectedCategoryFilter === cat
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/15'
                    }`}
                  >
                    {cat === 'all' ? 'تێکڕا' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Header & Export Tools */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white/5 p-2.5 rounded-2xl border border-white/10">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>ئەنجامەکان ({filteredItems.length} دانە):</span>
              </h3>

              <div className="flex items-center gap-1.5 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="text-[11px] font-bold py-1 px-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-slate-200 transition-all"
                  title="پرێنتکردنی لیست"
                >
                  🖨️ پرێنت
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const tableContainer = document.getElementById('home-model-catalog-table-wrapper');
                    const printDate = format(new Date(), 'yyyy-MM-dd');
                    const printTime = format(new Date(), 'HH:mm:ss');
                    const filename = `Ashley_Models_Catalog_${printDate}.pdf`;

                    if (!tableContainer) {
                      window.print();
                      return;
                    }

                    try {
                      const html2canvas = (await import('html2canvas')).default;
                      const jsPDF = (await import('jspdf')).default;

                      const canvas = await html2canvas(tableContainer, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#0f172a'
                      });

                      const imgData = canvas.toDataURL('image/jpeg', 0.95);
                      const pdf = new jsPDF('portrait', 'mm', 'a4');
                      const pdfWidth = pdf.internal.pageSize.getWidth();
                      const pdfHeight = pdf.internal.pageSize.getHeight();

                      pdf.setFontSize(10);
                      pdf.setTextColor(15, 23, 42);
                      pdf.text(`ASHLEY ERP - Catalog: Warehouse Models & Inventory`, 10, 8);
                      pdf.text(`Print Date: ${printDate} | Print Time: ${printTime}`, pdfWidth - 90, 8);

                      const imgWidth = pdfWidth - 20;
                      const imgHeight = (canvas.height * imgWidth) / canvas.width;

                      pdf.addImage(imgData, 'JPEG', 10, 12, imgWidth, Math.min(imgHeight, pdfHeight - 20));
                      pdf.save(filename);
                    } catch (err) {
                      console.error('PDF export fallback:', err);
                      window.print();
                    }
                  }}
                  className="text-[11px] font-bold py-1 px-2.5 bg-rose-600/80 hover:bg-rose-600 border border-rose-400/30 rounded-xl text-white transition-all"
                  title="داگرتنی PDF"
                >
                  📄 داگرتنی PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const printDate = format(new Date(), 'yyyy-MM-dd');
                    const printTime = format(new Date(), 'HH:mm:ss');
                    let csvContent = `\uFEFFناوی لیست: کەتەلۆگ و لیستی مۆدێلەکانی کۆگا, بەرواری پرێنت: ${printDate}, کاتی پرێنت: ${printTime}\n\n`;
                    csvContent += 'کۆدی مۆدێل,ناوی کاڵا,پۆلێن,دۆخ,بڕی ئیستۆک\n';
                    filteredItems.forEach(item => {
                      csvContent += `"${item.model || 'MODEL'}","${item.name || 'مۆدێل'}","${item.classification || 'کۆگا'}","${item.modelCondition || 'بەردەست'}","${item.quantity ?? 1}"\n`;
                    });
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `Ashley_Models_Catalog_${printDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="text-[11px] font-bold py-1 px-2.5 bg-blue-600/80 hover:bg-blue-600 border border-blue-400/30 rounded-xl text-white transition-all"
                  title="داگرتنی CSV"
                >
                  📊 داگرتنی CSV
                </button>
              </div>
            </div>

            {/* Model Catalog Table Wrapper */}
            <div id="home-model-catalog-table-wrapper" className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60 max-h-[380px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-white/5 border-b border-white/10 text-slate-300 font-black sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3">کۆدی مۆدێل</th>
                    <th className="py-2.5 px-3">ناوی کاڵا</th>
                    <th className="py-2.5 px-3">پۆلێن</th>
                    <th className="py-2.5 px-3">دۆخ</th>
                    <th className="py-2.5 px-3">ئیستۆک</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-black text-indigo-300">{item.model || 'MODEL-01'}</td>
                        <td className="py-2.5 px-3 font-bold text-white">{item.name || 'مۆدێلی ئاشڵی'}</td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">{item.classification || 'کۆگا'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black">
                            {item.modelCondition || 'بەردەستە'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-amber-300">{item.quantity ?? 1} دانە</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">
                        هیچ مۆدێلێک بەم گەڕانە نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-white/5 text-slate-300 font-bold border-t border-white/10">
                    <td colSpan={2} className="py-2.5 px-3">کۆی گشتی کاڵا دۆزراوەکان:</td>
                    <td colSpan={3} className="py-2.5 px-3 font-mono text-left">{filteredItems.length} Item(s) Cataloged</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* iOS Quick Action Tiles */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Link
                href="/items"
                className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
              >
                <Package className="w-4 h-4 text-emerald-400" />
                <span>کاتالۆگی تەواوی کۆگا</span>
              </Link>

              <Link
                href="/warehouse-map"
                className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>نەخشەی رەفەکانی کۆگا</span>
              </Link>
            </div>

          </div>
        </section>

        {/* Sync Button */}
        {typeof window !== 'undefined' && localStorage.getItem('ashley_pending_checkins') && JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]').length > 0 && (
          <button 
             onClick={processPendingMobileQueue}
             className="w-full mt-4 bg-orange-100 border border-orange-300 text-orange-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse"
          >
             <Clock className="w-5 h-5" />
             ناردنی چێک ئینە هەڵگیراوەکان بۆ سێرڤەر ({JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]').length})
          </button>
        )}

      </div>

    </div>
  );
}
