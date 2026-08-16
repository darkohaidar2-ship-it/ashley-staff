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
    <div className="min-h-screen bg-slate-950 p-2 sm:p-5 dir-rtl flex flex-col justify-between font-sans selection:bg-indigo-500 selection:text-white" dir="rtl">
      
      {/* 🌟 1. LUXURIOUS ERP HEADER */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-2xl border border-slate-200/80 px-4 sm:px-6 py-3.5 rounded-3xl shadow-xl shadow-slate-200/50 mb-5 transition-all">
        
        {/* Brand & Factory Location Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center text-amber-400 font-black text-base shadow-lg shadow-slate-900/20 border border-slate-700">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                سیستەمی کارمەندانی ئاشڵی
              </h1>
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                AI SMART
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{syncedLocation.name || 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)'}</span>
            </p>
          </div>
        </div>

        {/* Live Baghdad Clock & Admin Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100/90 border border-slate-200/80 px-3 py-1.5 rounded-2xl shadow-inner">
            <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span className="font-mono text-xs font-black text-slate-800 tracking-wider">
              {currentTimeStr || '--:--'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link
                href="/admin"
                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black py-2 px-3.5 rounded-xl shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Shield className="w-3.5 h-3.5 text-amber-300" />
                <span>پەنەری ئەدمین</span>
              </Link>
              <button
                onClick={() => logout()}
                className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold py-2 px-3 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>دەرچوون</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2 px-4 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all border border-slate-800"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>🔑 چوونەژوورەوەی ئەدمین</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🌟 2. TWO MAIN SECTIONS GRID: RIGHT = ATTENDANCE, LEFT = MODEL SEARCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ----------------------------------------------------------------- */}
        {/* 📸 RIGHT SIDE: ATTENDANCE TERMINAL (AI Face & Biometrics Card) */}
        {/* ----------------------------------------------------------------- */}
        <section className="lg:col-span-6 bg-white/85 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/60 space-y-4 relative overflow-hidden">
          
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-400/10 via-teal-400/5 to-transparent rounded-full pointer-events-none blur-2xl" />

          {/* Section Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  تێرمیناڵی ناسینەوەی ڕوخسار (AI Face Terminal)
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold">
                  ناسنامەی ڕوخساری تایبەت + پشکنینی دووری {syncedLocation.radiusMeters || 50} مەتر
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
              GEOFENCE {syncedLocation.radiusMeters || 50}M
            </span>
          </div>

          {attMessage && (
            <div
              className={`p-3 text-xs font-black rounded-2xl border shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
                attMessage.success
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-emerald-100'
                  : 'bg-rose-50 text-rose-900 border-rose-300 shadow-rose-100'
              }`}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>{attMessage.text}</span>
            </div>
          )}

          {/* 📍 GPS GEOFENCE RADAR PILL (SYNCED METERS) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 shadow-sm ${
              distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border-emerald-300 text-emerald-950'
                : distanceMeters !== null
                ? 'bg-gradient-to-r from-rose-50 via-red-50 to-rose-100/60 border-rose-300 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
                    ? 'bg-emerald-500 animate-ping'
                    : 'bg-rose-500'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>دۆخی لۆکەیشن لە کۆمپانیا:</span>
                  <span className="font-mono">
                    {distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
                      ? `🟢 لەناو سنووری ڕێگەپێدراو (${distanceMeters}m)`
                      : distanceMeters !== null
                      ? `🔴 دەرەوەی بازنە (${distanceMeters}m > ${syncedLocation.radiusMeters || 50}m)`
                      : gpsStatus || 'نەپشکنراوە'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  {distanceMeters !== null && distanceMeters <= (syncedLocation.radiusMeters || 50)
                    ? 'چێک‌ئین کراوەیە و ئامادەیە بۆ تۆمارکردن'
                    : `دوگمەکان قوفڵکراون تا دەگەیتە ناو بازنەی ${syncedLocation.radiusMeters || 50} مەتری کۆمپانیا`}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={gpsLoading}
              onClick={requestLocation}
              className="px-3 py-1.5 bg-white/90 hover:bg-white border border-slate-300/80 rounded-xl text-[11px] font-bold text-slate-800 shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1 flex-shrink-0"
            >
              <RefreshCw className={`w-3 h-3 text-slate-600 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{gpsLoading ? 'چاوەڕێ...' : 'نوێکردنەوە'}</span>
            </button>
          </div>

          {/* 🌟 1. HERO UNIVERSAL ZERO-TOUCH AI FACE TERMINAL */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-5 rounded-3xl text-white shadow-2xl border border-indigo-500/30 space-y-4 relative overflow-hidden">
            
            {/* Ambient Background Lights */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-white">ئامادەبوونی خۆکار بە ناسینەوەی ڕوخسار</h3>
                  <p className="text-[10px] text-indigo-200">دەموچاو بخەرە ناو بازنەکەوە، خۆی دەیناسێتەوە</p>
                </div>
              </div>

              <span className="text-[10px] font-black bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2.5 py-1 rounded-full">
                {registeredFacesList.length} کارمەند تۆمارکراوە
              </span>
            </div>

            {/* 📷 ACTIVE AI FACE SCANNER MODAL / VIEWFINDER */}
            {activeFaceAction ? (
              <div className="p-3 bg-black/60 backdrop-blur-md rounded-2xl border border-indigo-500/40 space-y-3 animate-in fade-in zoom-in-95 duration-200">
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
                      <span>{facingMode === 'user' ? 'کامێرای پشتەوە' : 'کامێرای پێشەوە'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setActiveFaceAction(null);
                      }}
                      className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-slate-300"
                    >
                      داخستن ✕
                    </button>
                  </div>
                </div>

                {/* Video Box with Human Face Oval Frame */}
                <div className="relative rounded-3xl overflow-hidden bg-black aspect-square max-h-[320px] flex items-center justify-center border-2 border-indigo-500/50 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* 🌟 HUMAN FACE OVAL TARGET HUD (Silky smooth, no flickering) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-3">
                    
                    {/* The Head Oval Guide Circle */}
                    <div
                      className="w-48 h-60 rounded-[50%/60%] transition-colors duration-300 flex flex-col items-center justify-center relative border-2 border-dashed border-indigo-300/80 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                    >
                      {/* Corner brackets */}
                      <div className="absolute top-2 left-5 w-3.5 h-3.5 border-t-2 border-l-2 border-white/60" />
                      <div className="absolute top-2 right-5 w-3.5 h-3.5 border-t-2 border-r-2 border-white/60" />
                      <div className="absolute bottom-2 left-5 w-3.5 h-3.5 border-b-2 border-l-2 border-white/60" />
                      <div className="absolute bottom-2 right-5 w-3.5 h-3.5 border-b-2 border-r-2 border-white/60" />

                      {/* Center Silhouette Hint */}
                      <div className="text-center space-y-1">
                        <User className="w-10 h-10 text-white/40 mx-auto" />
                        <span className="text-[9px] font-bold text-white/80 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                          دەموچاو لەم بازنەیە دابنێ
                        </span>
                      </div>
                    </div>

                    {/* Bottom guide text */}
                    <div className="mt-2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-amber-200 shadow-md">
                      ⚡ دەموچاو بخەرە ناو بازنەکە، خۆکارانە تۆمار دەبێت
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* HUGE ZERO-TOUCH ACTION BUTTONS */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                
                {/* HUGE CHECK IN BUTTON */}
                <button
                  type="button"
                  disabled={isFaceScanning || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                  onClick={() => handleStartUniversalFaceAuth('Check In')}
                  className={`relative group overflow-hidden py-4 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-white transition-all duration-300 shadow-xl ${
                    distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-blue-600 shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-95 border border-indigo-400/30'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-black tracking-wide">
                    📥 چێک‌ئین بە ڕوخسار (Check In)
                  </span>
                  <span className="text-[10px] text-indigo-200 font-bold">
                    {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'قوفڵە بەهۆی دووری لە کۆمپانیا'
                      : 'سەیری کامێرا بکە بۆ هاتنەژوور'}
                  </span>
                </button>

                {/* HUGE CHECK OUT BUTTON */}
                <button
                  type="button"
                  disabled={isFaceScanning || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                  onClick={() => handleStartUniversalFaceAuth('Check Out')}
                  className={`relative group overflow-hidden py-4 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-white transition-all duration-300 shadow-xl ${
                    distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-br from-rose-600 via-red-600 to-pink-700 hover:from-rose-500 hover:to-red-600 shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-95 border border-rose-400/30'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-black tracking-wide">
                    📤 چێک‌ئاوت بە ڕوخسار (Check Out)
                  </span>
                  <span className="text-[10px] text-rose-200 font-bold">
                    {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                      ? 'قوفڵە بەهۆی دووری لە کۆمپانیا'
                      : 'سەیری کامێرا بکە بۆ دەرچوون'}
                  </span>
                </button>

              </div>
            )}
          </div>

          {/* 👆 2. OPTIONAL MANUAL / PIN / BIOMETRIC FALLBACK ACCORDION */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowManualFallback(!showManualFallback)}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 flex items-center justify-between transition-colors border border-slate-200 shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600" />
                <span>شێوازی هەڵبژاردنی دەستی، پەنجەمۆر یان کۆدی PIN</span>
              </span>
              <span className="text-xs font-mono">{showManualFallback ? '▲ داخستن' : '▼ کردنەوە'}</span>
            </button>

            {showManualFallback && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-3xl space-y-3.5 animate-in fade-in">
                
                {/* Employee Selection */}
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    ناوی خۆت هەڵبژێرە:
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 outline-none"
                  >
                    <option value="">-- ناوی خۆت لەم لیستە هەڵبژێرە --</option>
                    {employees
                      .filter((e) => e.status !== 'resigned' && e.isActive !== false)
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* PIN Code */}
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">کۆدی PIN:</label>
                  <input
                    type="password"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="کۆدی 1234..."
                    className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl font-mono text-center text-xs tracking-widest outline-none font-bold"
                  />
                </div>

                {/* Fingerprint & PIN Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCheckInOrOut('Check In')}
                    className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md"
                  >
                    📥 هاتن بە PIN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckInOrOut('Check Out')}
                    className="py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shadow-md"
                  >
                    📤 دەرچوون بە PIN
                  </button>
                </div>

              </div>
            )}
          </div>

        </section>

        {/* ----------------------------------------------------------------- */}
        {/* 🔍 LEFT SIDE: MODEL SEARCH CATALOG (Windows 11 Catalog Panel) */}
        {/* ----------------------------------------------------------------- */}
        <section className="lg:col-span-6 bg-white/85 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/60 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  گەڕان بۆ مۆدێل و کاڵاکانی کۆگا
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold">
                  بەردەستبوونی مۆدێلەکان و کۆگای سەرەکی
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
              {filteredItems.length} دانە
            </span>
          </div>

          <div className="space-y-3">

            {/* Search Controls */}
            <div className="p-3 bg-slate-50/90 border border-slate-200/90 rounded-2xl space-y-2.5 shadow-inner">
              <div className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-300/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 shadow-sm transition-all">
                <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ناوی مۆدێل، کۆدی کاڵا، یان پۆلێن بنووسە..."
                  className="w-full text-xs font-bold text-slate-900 bg-transparent outline-none"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-bold ml-1 text-[11px]">پۆلێن:</span>
                {['all', 'نەخشەی رەفە', 'مۆدێلی ئاشڵی', 'مەواد', 'کاڵای فرۆشراو'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-[11px] font-black rounded-xl border transition-all ${
                      selectedCategoryFilter === cat
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat === 'all' ? 'تێکڕا' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Catalog Grid */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2 border border-slate-300">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>ئەنجامەکانی گەڕان ({filteredItems.length} مۆدێل):</span>
                </h3>

                <div className="flex items-center gap-1.5 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-950"
                    title="پرێنتکردنی لیستی مۆدێلەکان"
                  >
                    🖨️ پرێنت (Print)
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
                          backgroundColor: '#ffffff'
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
                    className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-rose-700 hover:bg-rose-800 border border-red-700 text-white"
                    title="داگرتنی ڕاستەوخۆی فایلی PDF"
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
                    className="btn-classic-primary text-[11px] font-bold py-0.5 px-2 bg-blue-900 hover:bg-blue-950 border border-blue-950 text-white"
                    title="داگرتنی فایلی CSV"
                  >
                    📊 داگرتنی CSV
                  </button>
                </div>
              </div>

              <div id="home-model-catalog-table-wrapper" className="overflow-x-auto border border-slate-400 bg-white">
                <table className="table-classic">
                  <thead>
                    <tr>
                      <th>کۆدی مۆدێل</th>
                      <th>ناوی کاڵا</th>
                      <th>پۆلێن</th>
                      <th>دۆخ</th>
                      <th>بڕی بەردەست</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <tr key={item.id}>
                          <td className="font-mono font-bold text-emerald-900">{item.model || 'MODEL-01'}</td>
                          <td className="font-bold">{item.name || 'مۆدێلی ئاشڵی'}</td>
                          <td className="text-[11px] text-slate-700">{item.classification || 'کۆگا'}</td>
                          <td>
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                              {item.modelCondition || 'بەردەستە'}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-slate-900">{item.quantity ?? 1} ئیستۆک</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400 font-bold">
                          هیچ مۆدێلێک بەم گەڕانە نەدۆزرایەوە
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="grand-total-row">
                      <td colSpan={2}>کۆی گشتی کاڵا دۆزراوەکان:</td>
                      <td colSpan={3} className="font-mono">{filteredItems.length} Item(s) Cataloged</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick Catalog Feature Cards */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link href="/items" className="btn-classic py-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-800" />
                <span className="font-bold text-xs">کاتالۆگی تەواوی کۆگا</span>
              </Link>

              <Link href="/warehouse-map" className="btn-classic py-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-800" />
                <span className="font-bold text-xs">نەخشەی رەفەکانی کۆگا</span>
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
