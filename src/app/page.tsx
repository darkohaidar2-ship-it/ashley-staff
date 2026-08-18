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
  X,
  RefreshCw,
  User
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
  const [branchDistanceList, setBranchDistanceList] = useState<
    Array<{ id: string; name: string; distance: number; radiusMeters: number; isInside: boolean }>
  >([]);

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
      console.error('Failed to sync company locations:', err);
    }
  }, []);

  useEffect(() => {
    syncCompanyLocations();
  }, [syncCompanyLocations]);

  // Registered Face AI Profiles List (Synced with Database & LocalStorage)
  const [registeredFacesList, setRegisteredFacesList] = useState<Array<{ id: string; name: string; descriptor: number[] }>>([]);

  const syncRegisteredFaces = useCallback(async () => {
    try {
      // 1. First read from local database fallback
      const localMap: Record<string, { name: string; descriptor: number[] }> = {};
      try {
        const stored = localStorage.getItem('ashley_face_registry_local');
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.assign(localMap, parsed);
        }
      } catch {}

      // 2. Fetch from Supabase API
      const res = await fetch(`/api/attendance/face/all?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      const combined: Array<{ id: string; name: string; descriptor: number[] }> = [];

      if (res.ok) {
        const data = await res.json();
        if (data?.employees && Array.isArray(data.employees)) {
          data.employees.forEach((emp: any) => {
            if (emp.descriptor && Array.isArray(emp.descriptor) && emp.descriptor.length > 0) {
              combined.push({
                id: emp.id,
                name: emp.fullName3Part || emp.name,
                descriptor: emp.descriptor,
              });
            }
          });
        }
      }

      // Add local ones if not in remote
      Object.entries(localMap).forEach(([empId, item]) => {
        if (!combined.some((c) => c.id === empId)) {
          combined.push({
            id: empId,
            name: item.name,
            descriptor: item.descriptor,
          });
        }
      });

      setRegisteredFacesList(combined);
    } catch (err) {
      console.error('Failed to sync registered faces:', err);
    }
  }, []);

  useEffect(() => {
    syncRegisteredFaces();
    // Preload neural network models in background
    loadFaceModels();
  }, [syncRegisteredFaces]);

  // Camera & Face Terminal State
  const [cameraActive, setCameraActive] = useState(false);
  const [activeFaceAction, setActiveFaceAction] = useState<'Check In' | 'Check Out' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Biometric Detection Real-Time State
  const [isFaceScanning, setIsFaceScanning] = useState(false);
  const [faceInsideOval, setFaceInsideOval] = useState(false);
  const [faceScanMessage, setFaceScanMessage] = useState<string | null>(null);
  const [faceScanSuccess, setFaceScanSuccess] = useState<boolean | null>(null);
  const [recognizedEmployeeName, setRecognizedEmployeeName] = useState<string | null>(null);

  // General Attendance Message Banner
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingScanRef = useRef(false);

  // Check Geofence & Location Accuracy
  const checkCurrentLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
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

        // Calculate distance to each branch
        const distances = companyLocations.map((loc) => {
          const d = calculateDistanceMeters(userLat, userLng, loc.lat, loc.lng);
          return {
            id: loc.id,
            name: loc.name,
            distance: d,
            radiusMeters: loc.radiusMeters || 50,
            isInside: d <= (loc.radiusMeters || 50),
          };
        });

        setBranchDistanceList(distances);

        // Find closest branch inside radius
        const insideBranch = distances.find((d) => d.isInside);

        if (insideBranch) {
          const matched = companyLocations.find((l) => l.id === insideBranch.id) || null;
          setCurrentMatchedLocation(matched);
          setIsInsideGeofence(true);
          setDistanceMeters(insideBranch.distance);
          setGpsStatus(`لەناو سنووری: ${insideBranch.name} (${insideBranch.distance}m)`);
        } else {
          // Closest branch
          const sorted = [...distances].sort((a, b) => a.distance - b.distance);
          const closest = sorted[0];
          setCurrentMatchedLocation(null);
          setIsInsideGeofence(false);
          setDistanceMeters(closest ? closest.distance : null);
          setGpsStatus(
            closest
              ? `لە دەرەوەی کۆمپانیایت! نزیکترین لق (${closest.name}) بە دووری ${
                  closest.distance < 1000 ? `${closest.distance}m` : `${(closest.distance / 1000).toFixed(1)}km`
                }`
              : 'لە دەرەوەی سنووری دیاریکراویت'
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

  // Start Front Selfie Camera Stream - Optimized for iPhone Without Zoom
  const startCamera = async (overrideFacingMode?: 'user' | 'environment') => {
    const targetFacing = overrideFacingMode || facingMode || 'user';
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        // High quality un-cropped video stream on iOS Safari
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing === 'environment' ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('High resolution constraint fallback:', firstErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: targetFacing === 'environment' ? 'environment' : 'user',
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      streamRef.current = stream;
      setMediaStream(stream);
      setCameraActive(true);

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('نەتوانرا کامێرا بکرێتەوە. تکایە لە سێتینگی وێبگەڕ (Safari) ڕێگە بە کامێرای سێڵفی بدە.');
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
    setMediaStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsFaceScanning(false);
    setFaceInsideOval(false);
    setActiveFaceAction(null);
    setFaceScanMessage(null);
    setFaceScanSuccess(null);
    setRecognizedEmployeeName(null);
    isProcessingScanRef.current = false;
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

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
          log_type: actionType,
          type: actionType === 'Check In' ? 'Check In' : 'Check Out',
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

  // Open Camera for Face Check-In or Check-Out Instantly
  const handleOpenFaceTerminal = (action: 'Check In' | 'Check Out') => {
    if (isInsideGeofence === false) {
      alert(
        `⚠️ ناتوانیت چێک‌ئین یان چێک‌ئاوت بکەیت!\nتۆ لە دەرەوەی بازنەی ڕێگەپێدراوی لقەکانی کۆمپانیایت.\n\n${gpsStatus}`
      );
      return;
    }

    setActiveFaceAction(action);
    setFacingMode('user');
    setFaceScanMessage('سەیری کامێرای پێشەوە (سێڵفی) بکە...');
    setFaceScanSuccess(null);
    setFaceInsideOval(false);
    setRecognizedEmployeeName(null);
    setCameraActive(true);
    startCamera('user');
  };

  // Automated Facial Scanning Loop (Stable & Shaking-Free)
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
          isProcessingScanRef.current = false;
          setIsFaceScanning(false);
          return;
        }

        // Face is in frame
        setFaceInsideOval(true);

        // Match against database
        let matchedEmp: { id: string; name: string } | null = null;
        for (const registeredUser of registeredFacesList) {
          if (registeredUser.descriptor && registeredUser.descriptor.length > 0) {
            const match = matchFaceDescriptors(liveResult.descriptor, registeredUser.descriptor, 0.60);
            if (match.isMatch) {
              matchedEmp = registeredUser;
              break;
            }
          }
        }

        if (matchedEmp) {
          setFaceScanSuccess(true);
          setRecognizedEmployeeName(matchedEmp.name);
          setFaceScanMessage(`سەرکەوتوو بوو! بەخێربێیت ${matchedEmp.name}`);

          // Save Attendance immediately
          await saveAttendanceLog(matchedEmp.id, matchedEmp.name, activeFaceAction);

          // Automatically close full-screen camera smoothly after 1.2s
          setTimeout(() => {
            stopCamera();
          }, 1200);
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
    }, 600);

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

          {/* 📍 GEOFENCE STATUS PILL */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/90 shadow-xs max-w-full">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                {gpsLoading ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                ) : isInsideGeofence === true ? (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                ) : (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    gpsLoading
                      ? 'bg-amber-500'
                      : isInsideGeofence === true
                      ? 'bg-emerald-600'
                      : 'bg-rose-600'
                  }`}
                />
              </span>

              <span className="text-xs font-bold text-slate-700 truncate">
                {gpsStatus}
              </span>

              <button
                type="button"
                onClick={checkCurrentLocation}
                disabled={gpsLoading}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-transform active:rotate-180 cursor-pointer"
                title="نوێکردنەوەی لۆکەیشن"
              >
                <RefreshCw className={`w-3 h-3 ${gpsLoading ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* ATTENDANCE MESSAGE BANNER */}
          {attMessage && (
            <div className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 ${
              attMessage.success ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : 'bg-rose-50 text-rose-950 border-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {attMessage.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-700" />}
                <span>{attMessage.text}</span>
              </div>
              <button 
                onClick={() => setAttMessage(null)}
                className="p-1 hover:bg-black/10 rounded-lg text-slate-700"
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
              disabled={gpsLoading || isInsideGeofence !== true}
              className={`group relative p-4 sm:p-5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[115px] sm:min-h-[135px] shadow-md ${
                gpsLoading || isInsideGeofence !== true
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
                  {gpsLoading
                    ? '📍 لە پشکنینی لۆکەیشندایە...'
                    : isInsideGeofence !== true
                    ? '🔒 قوفڵە (لە دەرەوەی سنوور)'
                    : 'سەیری کامێرا بکە بۆ دەستپێکردن'}
                </span>
              </div>
            </button>

            {/* 📤 CHECK OUT BUTTON */}
            <button
              type="button"
              onClick={() => handleOpenFaceTerminal('Check Out')}
              disabled={gpsLoading || isInsideGeofence !== true}
              className={`group relative p-4 sm:p-5 rounded-2xl border text-right transition-all flex flex-col justify-between min-h-[115px] sm:min-h-[135px] shadow-md ${
                gpsLoading || isInsideGeofence !== true
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
                  {gpsLoading
                    ? '📍 لە پشکنینی لۆکەیشندایە...'
                    : isInsideGeofence !== true
                    ? '🔒 قوفڵە (لە دەرەوەی سنوور)'
                    : 'سەیری کامێرا بکە بۆ تەواوکردنی کار'}
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

      {/* 🌟 FOOTER */}
      <footer className="w-full max-w-4xl mx-auto flex-shrink-0 py-1 text-center text-[10px] font-bold text-slate-400">
        ASHLEY ENTERPRISE ERP SYSTEM © 2026 — هەموو مافەکان پارێزراون
      </footer>

      {/* ========================================================================= */}
      {/* 🎥 IMMERSIVE FULL-SCREEN AI FACE RECOGNITION CAMERA MODAL (IPHONE OPTIMIZED) */}
      {/* ========================================================================= */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none touch-none">
          
          {/* 🌟 TOP FLOATING MINIMAL CONTROLS BAR */}
          <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            
            {/* Action Title Badge */}
            <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-xs font-black flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>
                {activeFaceAction === 'Check In' ? '📥 هاتن (Check In)' : '📤 دەرچوون (Check Out)'}
              </span>
            </div>

            {/* Switch Camera & Close Buttons Only */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                title="گۆڕینی کامێرا"
              >
                <SwitchCamera className="w-5 h-5 text-white" />
              </button>

              <button
                type="button"
                onClick={stopCamera}
                className="w-11 h-11 rounded-full bg-rose-600/80 hover:bg-rose-600 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
                title="داخستن"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* 🌟 FULL SCREEN CAMERA FEED (NO ARTIFICIAL ZOOM OR SHAKE) */}
          <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              disablePictureInPicture
              className={`w-full h-full object-cover sm:object-contain transition-none will-change-transform ${
                facingMode === 'user' ? 'transform scale-x-[-1]' : ''
              }`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* 🟢 BIOMETRIC SCANNING OVAL GUIDE HUD */}
            <div
              className={`absolute w-64 h-80 sm:w-72 sm:h-96 rounded-[50%] border-4 transition-all duration-200 pointer-events-none flex flex-col items-center justify-between py-6 ${
                faceScanSuccess === true
                  ? 'border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.9)] bg-emerald-500/20 scale-105'
                  : faceScanSuccess === false
                  ? 'border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.8)] bg-rose-500/15'
                  : faceInsideOval
                  ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)]'
                  : 'border-dashed border-white/60 shadow-[0_0_30px_rgba(255,255,255,0.25)]'
              }`}
            >
              <span className="text-xs font-black text-white px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20">
                {faceScanSuccess === true
                  ? `✅ ناسراوە: ${recognizedEmployeeName}`
                  : faceInsideOval
                  ? '🟢 ڕوخسار لە ناو بازنەیە'
                  : 'ڕوخسارت بخەرە ناو بازنەکە'}
              </span>

              <div className="w-12 h-1 bg-white/40 rounded-full" />
            </div>

            {/* Success Overlay Flash */}
            {faceScanSuccess === true && (
              <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 pointer-events-none animate-in fade-in duration-200">
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/80 animate-bounce">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-black">{recognizedEmployeeName}</h2>
                  <p className="text-sm font-bold text-emerald-200 mt-0.5">
                    {activeFaceAction === 'Check In' ? 'هاتن بە سەرکەوتوویی تۆمارکرا!' : 'دەرچوون بە سەرکەوتوویی تۆمارکرا!'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 🌟 BOTTOM STATUS BAR */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-6 pb-8 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
            <div className={`px-5 py-2.5 rounded-full backdrop-blur-2xl border text-center shadow-xl transition-all ${
              faceScanSuccess === true
                ? 'bg-emerald-600/90 text-white border-emerald-400'
                : faceScanSuccess === false
                ? 'bg-rose-600/90 text-white border-rose-400'
                : 'bg-black/70 text-white border-white/20'
            }`}>
              <p className="text-xs sm:text-sm font-black">
                {faceScanMessage || 'سەیری کامێرای پێشەوە بکە بۆ پشکنینی ناسنامە...'}
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
