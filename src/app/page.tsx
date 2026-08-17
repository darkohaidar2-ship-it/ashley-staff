'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  SwitchCamera,
  UserCheck,
  ShieldCheck,
  Building2,
  Sparkles,
  UserX,
  X
} from 'lucide-react';
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

interface CompanyLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export default function PublicTerminalLightPage() {
  // Live Desktop Clock for ERP
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(format(now, 'HH:mm:ss'));
      setCurrentDateStr(format(now, 'yyyy-MM-dd (EEEE)'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Multi-Company Locations (Synced from Supabase)
  const [companyLocations, setCompanyLocations] = useState<CompanyLocation[]>([
    {
      id: 'main-company-location',
      name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
      lat: 35.5571,
      lng: 45.4352,
      radiusMeters: 50,
    },
  ]);

  const [currentMatchedLocation, setCurrentMatchedLocation] = useState<CompanyLocation | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('پشکنینی لۆکەیشن...');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Sync Locations from Supabase
  const syncCompanyLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/location?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setCompanyLocations(data.locations);
        } else if (data?.lat && data?.lng) {
          setCompanyLocations([
            {
              id: 'main-company-location',
              name: data.name || 'کۆمپانیای سەرەکی ئاشڵی',
              lat: data.lat,
              lng: data.lng,
              radiusMeters: data.radiusMeters || 50,
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Error fetching company locations:', err);
    }
  }, []);

  useEffect(() => {
    syncCompanyLocations();
    const interval = setInterval(syncCompanyLocations, 15000);
    window.addEventListener('focus', syncCompanyLocations);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', syncCompanyLocations);
    };
  }, [syncCompanyLocations]);

  // AI Face Recognition State
  const [registeredFacesList, setRegisteredFacesList] = useState<Array<{ id: string; name: string; descriptor: number[] }>>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [activeFaceAction, setActiveFaceAction] = useState<'Check In' | 'Check Out' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [faceInsideOval, setFaceInsideOval] = useState(false);
  const [faceScanMessage, setFaceScanMessage] = useState<string | null>(null);
  const [faceScanSuccess, setFaceScanSuccess] = useState<boolean | null>(null);
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingScanRef = useRef(false);

  // Pre-load AI Face models on mount
  useEffect(() => {
    loadFaceModels().catch((e) => console.log('Preloading face models:', e));
  }, []);

  // Fetch all registered employees with face descriptors
  const fetchAllFaces = useCallback(async () => {
    try {
      const combinedMap: Record<string, any> = {};

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

  // Check Geofence Distance against ALL active company branches
  const checkCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS لەم وێبگەڕەدا بەردەست نییە');
      setIsInsideGeofence(false);
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        if (companyLocations.length === 0) {
          setIsInsideGeofence(true);
          setGpsStatus('لۆکەیشن دیاری نەکراوە');
          setGpsLoading(false);
          return;
        }

        // Calculate distance to each defined location
        const distanceResults = companyLocations.map((loc) => {
          const d = calculateDistanceMeters(userLat, userLng, loc.lat, loc.lng);
          return {
            ...loc,
            distance: d,
            isInside: d <= (loc.radiusMeters || 50),
          };
        });

        // Check if inside ANY location
        const matched = distanceResults.find((r) => r.isInside);
        const closest = [...distanceResults].sort((a, b) => a.distance - b.distance)[0];

        if (matched) {
          setIsInsideGeofence(true);
          setCurrentMatchedLocation(matched);
          setDistanceMeters(matched.distance);
          setGpsStatus(`🟢 لە سنووری (${matched.name})یت (${matched.distance}m)`);
        } else if (closest) {
          setIsInsideGeofence(false);
          setCurrentMatchedLocation(closest);
          setDistanceMeters(closest.distance);
          setGpsStatus(
            `🔴 دەرەوەی بازنەی لقەکان (${closest.distance}m > ${closest.radiusMeters}m لە ${closest.name})`
          );
        }

        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS position error:', err);
        setGpsStatus('تکایە ڕێگە بدە بە GPS ی مۆبایلەکەت');
        setIsInsideGeofence(false);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [companyLocations]);

  useEffect(() => {
    checkCurrentLocation();
    const interval = setInterval(checkCurrentLocation, 30000);
    return () => clearInterval(interval);
  }, [checkCurrentLocation]);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera error:', err);
      alert('نەتوانرا کامێرا بکرێتەوە. تکایە لە سێتینگی وێبگەڕ ڕێگە بە کامێرا بدە.');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsFaceScanning(false);
    setFaceInsideOval(false);
    setActiveFaceAction(null);
    setFaceScanMessage(null);
    setFaceScanSuccess(null);
    isProcessingScanRef.current = false;
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
  }, [facingMode]);

  // Process Attendance Check-In / Check-Out
  const saveAttendanceLog = async (empId: string, empName: string, actionType: 'Check In' | 'Check Out') => {
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm:ss');
    const locName = currentMatchedLocation?.name || 'کۆمپانیای ئاشڵی';

    try {
      const res = await fetch('/api/attendance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: empId,
          name: empName,
          action: actionType,
          type: actionType === 'Check In' ? 'in' : 'out',
          date: dateStr,
          time: timeStr,
          address: locName,
          coords: {
            lat: currentMatchedLocation?.lat || 35.5571,
            lng: currentMatchedLocation?.lng || 45.4352,
          },
          status: 'success',
          notes: `Automatic Face Recognition at ${locName}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
      }

      setAttMessage({
        text:
          actionType === 'Check In'
            ? `✅ سوپاس بۆ چێک‌ئین! هاتنەکەت لە کاتژمێر (${format(new Date(), 'HH:mm')}) تۆمار کرا، ${empName}.`
            : `👋 سوپاس بۆ چێک‌ئاوت! دەرچوونەکەت لە کاتژمێر (${format(new Date(), 'HH:mm')}) تۆمار کرا، ${empName}.`,
        success: true,
      });
    } catch (err: any) {
      setAttMessage({
        text: err.message || 'هەڵەیەک ڕوویدا لە تۆمارکردنی ئامادەبوون',
        success: false,
      });
    }
  };

  // Open Camera for Face Check-In or Check-Out
  const handleOpenFaceTerminal = (action: 'Check In' | 'Check Out') => {
    if (isInsideGeofence === false) {
      alert(
        `⚠️ ناتوانیت چێک‌ئین یان چێک‌ئاوت بکەیت!\nتۆ لە دەرەوەی بازنەی ڕێگەپێدراوی لقەکانی کۆمپانیایت.\n\n${gpsStatus}`
      );
      return;
    }

    setActiveFaceAction(action);
    setFaceScanMessage('سەیری کامێرا بکە... ڕوخسارت بخەرە ناو بازنەکە');
    setFaceScanSuccess(null);
    setFaceInsideOval(false);
    startCamera();
  };

  // Automated Facial Scanning Loop
  useEffect(() => {
    if (!cameraActive || !activeFaceAction || !videoRef.current) return;

    const interval = setInterval(async () => {
      if (isProcessingScanRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      isProcessingScanRef.current = true;
      setIsFaceScanning(true);

      try {
        const liveResult = await extractFaceDescriptor(videoRef.current);

        if (!liveResult || !liveResult.descriptor) {
          setFaceInsideOval(false);
          setFaceScanMessage('سەیری ناو بازنەکە بکە...');
          isProcessingScanRef.current = false;
          setIsFaceScanning(false);
          return;
        }

        // Face is inside oval!
        setFaceInsideOval(true);
        setFaceScanMessage('ڕوخسار لەناو بازنەیە... پشکنینی ناسینەوە');

        // Match against database
        let matchedEmp: { id: string; name: string } | null = null;
        for (const registeredUser of registeredFacesList) {
          if (registeredUser.descriptor && registeredUser.descriptor.length > 0) {
            const match = matchFaceDescriptors(liveResult.descriptor, registeredUser.descriptor, 0.58);
            if (match.isMatch) {
              matchedEmp = registeredUser;
              break;
            }
          }
        }

        if (matchedEmp) {
          setFaceScanSuccess(true);
          setFaceScanMessage(`سەرکەوتوو بوو! بەخێربێیت ${matchedEmp.name}`);

          // Save Attendance
          await saveAttendanceLog(matchedEmp.id, matchedEmp.name, activeFaceAction);

          // Close modal smoothly after 2.5s
          setTimeout(() => {
            stopCamera();
          }, 2500);
        } else {
          setFaceScanSuccess(false);
          setFaceScanMessage('ڕوخسار نەناسرایەوە! دەتوانیت لە ڕێگەی ئەدمین تۆماری بکەیت.');
          isProcessingScanRef.current = false;
          setIsFaceScanning(false);
        }
      } catch (err) {
        console.error('Scan error:', err);
        isProcessingScanRef.current = false;
        setIsFaceScanning(false);
      }
    }, 650);

    autoScanTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [cameraActive, activeFaceAction, registeredFacesList]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 text-slate-900 font-sans flex flex-col justify-between p-3 sm:p-5 select-none touch-manipulation dir-rtl" dir="rtl">
      
      {/* 🌟 ULTRA-CLEAN LIGHT HEADER (FIXED TOP) */}
      <header className="w-full max-w-4xl mx-auto flex-shrink-0 flex items-center justify-between pb-1">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-900 flex items-center justify-center text-white shadow-md shadow-slate-900/10 flex-shrink-0">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                ASHLEY ENTERPRISE
              </h1>
              <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                AI Face Terminal
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold">
              سیستەمی فەرمیی چێک‌ئین و ئامادەبوونی کارمەندان
            </p>
          </div>
        </div>

        {/* Header Live Clock Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-slate-200 text-slate-700 text-xs font-mono font-black shadow-xs">
          <Clock className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
          <span>{currentTimeStr || '09:00:00'}</span>
        </div>

      </header>

      {/* 🌟 MAIN TERMINAL BODY (PERFECT VIEWPORT FIT - NO SCROLL) */}
      <main className="flex-1 w-full max-w-3xl mx-auto my-auto flex flex-col items-center justify-center min-h-0 py-1">
        
        {/* Center Crystal Card */}
        <div className="w-full bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-300/30 text-center space-y-3.5 sm:space-y-4 relative overflow-hidden flex flex-col justify-center">
          
          {/* Subtle Ambient Light Glow */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* 📍 GEOFENCE STATUS PILL INSIDE CARD (STABLE & NEVER JUMPS) */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={checkCurrentLocation}
              className={`h-8 sm:h-9 px-3.5 max-w-full rounded-full border shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 ${
                isInsideGeofence === true
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : isInsideGeofence === false
                  ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="کلیک بکە بۆ دووبارە پشکنینی لۆکەیشن"
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isInsideGeofence === true
                  ? 'bg-emerald-500 animate-pulse'
                  : isInsideGeofence === false
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`} />
              
              <span className="text-[11px] sm:text-xs font-bold truncate max-w-[260px] sm:max-w-[420px]">
                {gpsLoading ? 'پشکنینی لۆکەیشن...' : gpsStatus}
              </span>

              <span className="text-[10px] text-slate-400 font-normal">🔄 نوێکردنەوە</span>
            </button>
          </div>

          {/* Clock & Date Badge */}
          <div className="space-y-1">
            <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-slate-900">
              {currentTimeStr || '09:00:00'}
            </div>
            
            <div className="text-[11px] sm:text-xs font-black text-indigo-700 font-mono">
              📅 {currentDateStr || '2026-08-17'}
            </div>

            <p className="text-[10px] sm:text-xs font-bold text-slate-500 max-w-md mx-auto pt-0.5">
              تەنها سەیری کامێرا بکە، سیستەمەکە ڕاستەوخۆ دەتبینێت و کاتی هاتن و دەرچوونت تۆمار دەکات.
            </p>
          </div>

          {/* Notification Alert Message Banner */}
          {attMessage && (
            <div className={`p-3 rounded-xl border text-xs font-black flex items-center justify-between gap-2 shadow-md animate-in fade-in slide-in-from-top-2 ${
              attMessage.success 
                ? 'bg-emerald-500 text-white border-emerald-600' 
                : 'bg-rose-500 text-white border-rose-600'
            }`}>
              <div className="flex items-center gap-2">
                {attMessage.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <span>{attMessage.text}</span>
              </div>
              <button 
                onClick={() => setAttMessage(null)}
                className="p-1 hover:bg-white/20 rounded-lg text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 🌟 TWO PROMINENT ACTION TILES: CHECK IN & CHECK OUT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
            
            {/* 📥 CHECK IN BUTTON */}
            <button
              type="button"
              onClick={() => handleOpenFaceTerminal('Check In')}
              disabled={isInsideGeofence === false}
              className={`group relative p-4 sm:p-5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[115px] sm:min-h-[135px] shadow-md ${
                isInsideGeofence === false
                  ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-emerald-400/40 shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-98 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 border border-white/20 text-white">
                  چێک‌ئین
                </span>
              </div>

              <div>
                <span className="text-base sm:text-xl font-black block text-white tracking-tight">
                  📥 تۆمارکردنی هاتن
                </span>
                <span className="text-[11px] font-bold text-emerald-100/90 block mt-0.5">
                  {isInsideGeofence === false ? 'قوفڵە (لە دەرەوەی سنوور)' : 'سەیری کامێرا بکە بۆ دەستپێکردن'}
                </span>
              </div>
            </button>

            {/* 📤 CHECK OUT BUTTON */}
            <button
              type="button"
              onClick={() => handleOpenFaceTerminal('Check Out')}
              disabled={isInsideGeofence === false}
              className={`group relative p-4 sm:p-5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[115px] sm:min-h-[135px] shadow-md ${
                isInsideGeofence === false
                  ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white border-rose-400/40 shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-98 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <Clock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-white/20 border border-white/20 text-white">
                  چێک‌ئاوت
                </span>
              </div>

              <div>
                <span className="text-base sm:text-xl font-black block text-white tracking-tight">
                  📤 تۆمارکردنی دەرچوون
                </span>
                <span className="text-[11px] font-bold text-rose-100/90 block mt-0.5">
                  {isInsideGeofence === false ? 'قوفڵە (لە دەرەوەی سنوور)' : 'سەیری کامێرا بکە بۆ تەواوکردنی کار'}
                </span>
              </div>
            </button>

          </div>

          {/* Active Registered Faces Info */}
          <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{registeredFacesList.length} کارمەند بە ڕوخسار تۆمار کراون و ئامادەن</span>
          </div>

        </div>

      </main>

      {/* 🌟 FOOTER (FIXED BOTTOM) */}
      <footer className="w-full max-w-4xl mx-auto flex-shrink-0 py-1 text-center text-[10px] font-bold text-slate-400">
        ASHLEY ENTERPRISE ERP SYSTEM © 2026 — هەموو مافەکان پارێزراون
      </footer>

      {/* ========================================================================= */}
      {/* 🎥 AI FACE RECOGNITION CAMERA MODAL OVERLAY */}
      {/* ========================================================================= */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black">
                  {activeFaceAction === 'Check In' ? '📥 چێک‌ئین بە ڕوخسار (Check In)' : '📤 چێک‌ئاوت بە ڕوخسار (Check Out)'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                  title="گۆڕینی کامێرای پێشەوە/پشتەوە"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Camera Viewport with Biometric Oval HUD */}
            <div className="relative aspect-[3/4] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* 🟢 Apple Biometric Scanning Oval Guide HUD */}
              <div
                className={`absolute w-52 h-72 rounded-[50%] border-4 transition-all duration-300 pointer-events-none flex flex-col items-center justify-between py-4 ${
                  faceScanSuccess === true
                    ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.8)] bg-emerald-500/10'
                    : faceScanSuccess === false
                    ? 'border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.8)] bg-rose-500/10'
                    : faceInsideOval
                    ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)] animate-pulse'
                    : 'border-dashed border-white/70 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                }`}
              >
                <span className="text-[11px] font-black text-white px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md">
                  {faceInsideOval ? '🟢 ڕوخسار لە ناو بازنەیە' : 'ڕوخسارت لێرە دابنێ'}
                </span>

                {faceScanSuccess === true && (
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                )}

                {faceScanSuccess === false && (
                  <UserX className="w-12 h-12 text-rose-400 animate-pulse" />
                )}

                <span className="text-[10px] font-black text-white/90 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
                  {activeFaceAction === 'Check In' ? 'چێک‌ئین' : 'چێک‌ئاوت'}
                </span>
              </div>
            </div>

            {/* Status Message Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center space-y-2">
              <p
                className={`text-xs font-black transition-colors ${
                  faceScanSuccess === true
                    ? 'text-emerald-700 text-sm'
                    : faceScanSuccess === false
                    ? 'text-rose-700'
                    : 'text-slate-800'
                }`}
              >
                {faceScanMessage || 'سەیری کامێرا بکە...'}
              </p>
              
              <button
                type="button"
                onClick={stopCamera}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl"
              >
                پاشگەزبوونەوە و داخستن
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
