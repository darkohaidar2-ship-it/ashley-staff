'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Smartphone
} from 'lucide-react';
import { isBiometricSupported, registerBiometric, verifyBiometric } from '@/lib/webauthn';

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

export default function MainPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { employees, items, settings, attendanceLogs, setAttendanceLogs } = useAppContext();

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

  // Global Realtime Location Sync from Supabase
  useEffect(() => {
    fetch('/api/attendance/location')
      .then((res) => res.json())
      .then((loc) => {
        if (loc?.lat && loc?.lng) {
          setSyncedLocation(loc);
        }
      })
      .catch((err) => console.error('Error fetching company location:', err));
  }, []);

  // --- Attendance State (Right Side) ---
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  
  // Biometric (Fingerprint / Face ID) State
  const [bioSupported, setBioSupported] = useState<boolean>(false);
  const [hasBiometric, setHasBiometric] = useState<boolean>(false);
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);

  // GPS Geofence State
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Model Search State (Left Side) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  useEffect(() => {
    setBioSupported(isBiometricSupported());
  }, []);

  // Check biometric pairing status when employee is selected
  useEffect(() => {
    if (!selectedEmpId) {
      setHasBiometric(false);
      return;
    }
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
  }, [selectedEmpId]);

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

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setAttMessage({ text: 'کامیرا نەدۆزرایەوە! ڕێگەپێدانی کامێرا چاودێری بکە', success: false });
      setCameraActive(false);
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
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
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

  // Reusable Attendance Submission Helper
  const submitAttendanceLog = (type: 'Check In' | 'Check Out', emp: any, verificationMethod: string, selfieDataUrl?: string | null) => {
    const timeNow = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const dateToday = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm');

    const newLog = {
      id: `log-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employee_id: emp.id,
      userId: emp.id,
      userName: emp.fullName3Part || emp.name,
      employee_name: emp.fullName3Part || emp.name,
      name: emp.fullName3Part || emp.name,
      type: type === 'Check In' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
      log_type: type,
      time: timeNow,
      log_date: dateToday,
      log_time_str: timeStr,
      selfieUrl: selfieDataUrl || undefined,
      selfie_url: selfieDataUrl || undefined,
      checkInSelfie: selfieDataUrl || undefined,
      checkOutSelfie: selfieDataUrl || undefined,
      distance: distanceMeters !== null ? `${distanceMeters}m` : 'داخل کۆمپانیا (12m)',
      location_address: distanceMeters !== null ? `${distanceMeters}m` : 'داخل کۆمپانیا',
      status: verificationMethod,
      createdAt: timeNow,
    };

    const updatedLogs = [newLog, ...attendanceLogs];
    setAttendanceLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_local_attendanceLogs', JSON.stringify(updatedLogs));
      localStorage.setItem('ashley_attendance_logs', JSON.stringify(updatedLogs));
    }

    // Sync to Supabase Real-Time Backend
    fetch('/api/attendance/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        const resData = await res.json();
        if (resData?.record?.selfieUrl) {
          setAttendanceLogs((prev) =>
            prev.map((l) => (l.id === newLog.id ? { ...l, selfieUrl: resData.record.selfieUrl } : l))
          );
        }
        setAttMessage({
          text: `🎉 ئامادەبوونی (${emp.name}) بە سەرکەوتوویی وەک ${type} تۆمارکرا (${verificationMethod})!`,
          success: true,
        });
      })
      .catch((err) => {
        console.error('Supabase attendance post error - saving to offline queue:', err);
        if (typeof window !== 'undefined') {
          const pending = JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]');
          localStorage.setItem('ashley_pending_checkins', JSON.stringify([...pending, newLog]));
        }
        setAttMessage({
          text: `ئامادەبوونی (${emp.name}) بە سەرکەوتوویی لە مۆبایلەکە خەزن کرا و کاتی پەیوەستبوون دەنێردرێت.`,
          success: true,
        });
      });

    setCapturedSelfie(null);
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

    // Strict 1 Phone = 1 Employee Check
    if (typeof window !== 'undefined') {
      const registeredUser = localStorage.getItem('ashley_bio_registered_user');
      if (registeredUser && registeredUser !== emp.id) {
        setAttMessage({
          text: `❌ ناتوانیت بۆ کارمەندێکی تر چێک‌ئین بکەیت! ئەم مۆبایلە تەنها تایبەتە بە هەژماری ئەو کارمەندەی پەنجەمۆری لەسەر چالاککراوە.`,
          success: false,
        });
        return;
      }
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
          text: `⚠️ تۆ هێشتا پەنجەمۆری ئەم مۆبایلەت بۆ (${emp.name}) نەبەستووەتەوە! تکایە سەرەتا بەستنەوەی پەنجەمۆر بکە.`,
          success: false,
        });
        return;
      }

      // Strict Biometric Hardware Verification
      const verified = await verifyBiometric(emp.id, credId);
      if (verified) {
        submitAttendanceLog(type, emp, 'پەنجەمۆری تایبەتی مۆبایل (Hardware Biometrics)');
      }
    } catch (err: any) {
      setAttMessage({
        text: err.message || '❌ پەنجەمۆر نەناسرا یان ئەم پەنجەمۆرە هی ئەم کارمەندە نییە!',
        success: false,
      });
    } finally {
      setBiometricLoading(false);
    }
  };

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

    if (!capturedSelfie) {
      setAttMessage({ text: '⚠️ تکایە فۆتۆی سێلفی لەگەڵ ئامادەبوون بگرە بۆ سەلماندن', success: false });
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

    submitAttendanceLog(type, emp, 'سێلفی و PIN', capturedSelfie);
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
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-12 p-2 sm:p-4" dir="rtl">

      {/* 🌟 1. TOP WINDOWS 11 MICA HEADER WITH LOGIN BUTTON & LIVE CLOCK */}
      <header className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md shadow-slate-200/50 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-md overflow-hidden relative group">
            <img src="/icon.png" alt="Ashley Logo" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>ASHLEY NEXUS — سیستەمی ئامادەبوونی زیرەک</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Win11 Fluent</span>
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
              تۆمارکردنی دەستبەجێ بە پەنجەمۆر / Face ID و چاودێری دووری ٥٠ مەتر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 border border-slate-200/90 rounded-xl font-mono text-xs font-bold text-slate-800 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
            <span>{currentTimeStr || '2026-08-16 | 14:30:00'}</span>
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
        {/* 📸 RIGHT SIDE: ATTENDANCE TERMINAL (Windows 11 Biometric Card) */}
        {/* ----------------------------------------------------------------- */}
        <section className="lg:col-span-6 bg-white/85 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/60 space-y-4 relative overflow-hidden">
          
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-400/10 via-teal-400/5 to-transparent rounded-full pointer-events-none blur-2xl" />

          {/* Section Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Fingerprint className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  تێرمیناڵی ئامادەبوونی کارمەندان
                </h2>
                <p className="text-[11px] text-slate-500 font-semibold">
                  ناسنامەی پەنجەمۆر + پشکنینی ڕاستەوخۆی ٥٠ مەتر
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
              GEOFENCE 50M
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

          {/* 📍 GPS GEOFENCE RADAR PILL (50 METERS) */}
          <div
            className={`p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 shadow-sm ${
              distanceMeters !== null && distanceMeters <= 50
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border-emerald-300 text-emerald-950'
                : distanceMeters !== null
                ? 'bg-gradient-to-r from-rose-50 via-red-50 to-rose-100/60 border-rose-300 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  distanceMeters !== null && distanceMeters <= 50
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
                    {distanceMeters !== null && distanceMeters <= 50
                      ? `🟢 لەناو سنووری ڕێگەپێدراو (${distanceMeters}m)`
                      : distanceMeters !== null
                      ? `🔴 دەرەوەی بازنە (${distanceMeters}m > 50m)`
                      : gpsStatus || 'نەپشکنراوە'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  {distanceMeters !== null && distanceMeters <= 50
                    ? 'چێک‌ئین کراوەیە و ئامادەیە بۆ تۆمارکردن'
                    : 'دوگمەکان قوفڵکراون تا دەگەیتە ناو بازنەی ٥٠ مەتری کۆمپانیا'}
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

          {/* 👤 STEP 1: EMPLOYEE SELECTION */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800">
              ١. ناوی سیانی خۆت هەڵبژێرە:
            </label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full py-3 px-3.5 bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl text-xs font-black text-slate-900 shadow-inner transition-all outline-none"
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

          {/* 👆 STEP 2: HERO BIOMETRIC (FINGERPRINT / FACE ID) ACTIONS */}
          {selectedEmpId && (
            <div className="space-y-3 pt-1">
              
              {/* Biometric Status Header Pill */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100/80 rounded-xl border border-slate-200">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  <span>ناسنامەی پەنجەمۆری مۆبایل:</span>
                </span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-sm ${
                    hasBiometric
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border-amber-300'
                  }`}
                >
                  {hasBiometric ? '✅ پەنجەمۆر بەستراوە' : '⚠️ پەنجەمۆر نەبەستراوە'}
                </span>
              </div>

              {/* ACTION A: IF BIOMETRICS PAIRED -> SHOW HUGE WINDOWS 11 TOUCH BUTTONS */}
              {hasBiometric ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* HUGE CHECK IN BUTTON */}
                    <button
                      type="button"
                      disabled={biometricLoading || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                      onClick={() => handleBiometricAuth('Check In')}
                      className={`relative group overflow-hidden py-4 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-white transition-all duration-300 shadow-xl ${
                        distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                          ? 'bg-slate-300 border border-slate-400 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-[1.02] active:scale-95'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <Fingerprint className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-black tracking-wide">
                        {biometricLoading ? 'چاوەڕێی پەنجەمۆر...' : '📥 چێک‌ئین (Check In)'}
                      </span>
                      <span className="text-[10px] text-emerald-100/90 font-bold">
                        {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                          ? 'قوفڵە بەهۆی دووری لە کۆمپانیا'
                          : 'تەنها پەنجە دابنێ لەسەر مۆبایل'}
                      </span>
                    </button>

                    {/* HUGE CHECK OUT BUTTON */}
                    <button
                      type="button"
                      disabled={biometricLoading || (distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50))}
                      onClick={() => handleBiometricAuth('Check Out')}
                      className={`relative group overflow-hidden py-4 px-5 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-white transition-all duration-300 shadow-xl ${
                        distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                          ? 'bg-slate-300 border border-slate-400 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-gradient-to-br from-rose-600 via-red-600 to-pink-700 hover:from-rose-500 hover:to-red-600 shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-95'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                        <Fingerprint className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-black tracking-wide">
                        {biometricLoading ? 'چاوەڕێی پەنجەمۆر...' : '📤 چێک‌ئاوت (Check Out)'}
                      </span>
                      <span className="text-[10px] text-rose-100/90 font-bold">
                        {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50)
                          ? 'قوفڵە بەهۆی دووری لە کۆمپانیا'
                          : 'تۆمارکردنی کاتی دەرچوون'}
                      </span>
                    </button>

                  </div>

                  {distanceMeters !== null && distanceMeters > (syncedLocation.radiusMeters || 50) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-black flex items-center gap-2">
                      <Lock className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>
                        ⚠️ ناتوانیت چێک‌ئین بکەیت چونكە ({distanceMeters}m) لە چەقی کۆمپانیا دووریت. تکایە وەرە ناو بازنەی {syncedLocation.radiusMeters || 50} مەتر.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* ACTION B: IF NOT PAIRED -> SHOW PAIRING REGISTRATION CARD */
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 border-2 border-dashed border-emerald-300 p-4 rounded-2xl space-y-3 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>بەستنەوەی پەنجەمۆری ئەم مۆبایلە بۆ یەکەمجار</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 font-bold mt-1 leading-relaxed">
                      بۆ ئەوەی مۆبایلەکەت وەک ناسنامەی تایبەتی خۆت بناسرێت، کۆدی PIN بنووسە و پەنجەمۆر یان Face ID لەسەر شاشەکە چالاک بکە:
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="password"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="کۆدی نهێنی PINـەکەت لێرە بنووسە..."
                      className="w-full py-2.5 px-3.5 bg-white border border-emerald-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-mono text-center tracking-widest text-slate-900 shadow-inner outline-none font-black"
                    />

                    <button
                      type="button"
                      disabled={biometricLoading}
                      onClick={handleRegisterBiometric}
                      className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-700/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Smartphone className="w-4 h-4 text-amber-300" />
                      <span>
                        {biometricLoading ? 'تکایە پەنجە دابنێ لەسەر مۆبایل...' : '🔗 بەستنەوە و تۆمارکردنی پەنجەمۆر'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* 📷 COLLAPSIBLE ACCORDION FOR MANUAL FALLBACK (PIN + SELFIE) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualFallback(!showManualFallback)}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-[11px] font-bold text-slate-700 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    <span>شێوازی پێشووی ئامادەبوون (کۆدی PIN و کامێرای سێلفی)</span>
                  </span>
                  <span>{showManualFallback ? '▲ داشخستن' : '▼ کردنەوە'}</span>
                </button>

                {showManualFallback && (
                  <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-slate-800 mb-1 text-xs font-black">کۆدی PIN:</label>
                      <input
                        type="password"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="کۆدی 1234..."
                        className="w-full py-2 px-3 bg-white border border-slate-300 rounded-xl font-mono text-center text-xs tracking-widest outline-none font-bold"
                      />
                    </div>

                    {/* Camera Area */}
                    <div className="space-y-1.5 text-center bg-white p-3 rounded-xl border border-slate-200">
                      <label className="block text-slate-800 text-xs font-black text-right">فۆتۆی سێلفی:</label>
                      {cameraActive ? (
                        <div className="space-y-2">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-40 object-cover rounded-xl border border-slate-300 bg-black" />
                          <button type="button" onClick={capturePhoto} className="w-full py-2 bg-emerald-700 text-white rounded-xl text-xs font-black">
                            📸 گرتنی فۆتۆی سێلفی
                          </button>
                        </div>
                      ) : capturedSelfie ? (
                        <div className="space-y-1.5">
                          <img src={capturedSelfie} alt="Captured Selfie" className="w-full h-32 object-cover rounded-xl border border-slate-300" />
                          <button type="button" onClick={startCamera} className="w-full py-1.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold">
                            🔄 فۆتۆیەکی تر بگرە
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={startCamera} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold">
                          📷 بەگەڕخستنی کامێرا
                        </button>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Fallback Submit Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCheckInOrOut('Check In')}
                        className="py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md"
                      >
                        📥 هاتن بە سێلفی
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCheckInOrOut('Check Out')}
                        className="py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black shadow-md"
                      >
                        📤 دەرچوون بە سێلفی
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

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
