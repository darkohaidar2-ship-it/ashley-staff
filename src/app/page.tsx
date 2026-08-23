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
  User,
  FileText
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
      const localMap: Record<string, { name: string; descriptor: number[] }> = {};
      try {
        const stored = localStorage.getItem('ashley_face_registry_local');
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.assign(localMap, parsed);
        }
      } catch {}

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
    loadFaceModels();
  }, [syncRegisteredFaces]);

  // Camera & Face Terminal State
  const [cameraActive, setCameraActive] = useState(false);
  const [activeFaceAction, setActiveFaceAction] = useState<'Check In' | 'Check Out' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Biometric Detection 2-Second Hold State (Stable, Non-pulsing)
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100%
  const [faceScanMessage, setFaceScanMessage] = useState<string>('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
  const [faceScanSuccess, setFaceScanSuccess] = useState<boolean | null>(null);
  const [recognizedEmployeeName, setRecognizedEmployeeName] = useState<string | null>(null);

  // General Attendance Message Banner
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Employee Self-Note Modal State (for late arrival, early departure, or overtime)
  const [pendingNoteData, setPendingNoteData] = useState<{
    empId: string;
    empName: string;
    action: 'Check In' | 'Check Out';
    isLate: boolean;
    isEarly: boolean;
    isOvertime: boolean;
    timeStr: string;
  } | null>(null);
  const [customEmployeeNote, setCustomEmployeeNote] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingScanRef = useRef(false);
  const holdTimerRef = useRef<number>(0);
  const lastDetectedEmpIdRef = useRef<string | null>(null);

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
        const insideBranch = distances.find((d) => d.isInside);

        if (insideBranch) {
          const matched = companyLocations.find((l) => l.id === insideBranch.id) || null;
          setCurrentMatchedLocation(matched);
          setIsInsideGeofence(true);
          setDistanceMeters(insideBranch.distance);
          setGpsStatus(`لەناو سنووری: ${insideBranch.name} (${insideBranch.distance}m)`);
        } else {
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

  // Start Front Selfie Camera Stream
  const startCamera = async (overrideFacingMode?: 'user' | 'environment') => {
    const targetFacing = overrideFacingMode || facingMode || 'user';
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing === 'environment' ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('High resolution fallback:', firstErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing === 'environment' ? 'environment' : 'user' },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setMediaStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setActiveFaceAction(null);
    setFaceScanMessage('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
    setFaceScanSuccess(null);
    setRecognizedEmployeeName(null);
    setScanProgress(0);
    holdTimerRef.current = 0;
    isProcessingScanRef.current = false;
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Process Attendance Check-In / Check-Out
  const saveAttendanceLog = async (
    empId: string, 
    empName: string, 
    actionType: 'Check In' | 'Check Out',
    employeeNote?: string
  ) => {
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
          notes: employeeNote ? `تێبینی کارمەند: ${employeeNote}` : `Automatic Face Recognition at ${locName}`,
          employeeNote: employeeNote || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
      }

      // Store in local storage for instant sync across tabs & admin panel
      if (typeof window !== 'undefined') {
        try {
          const liveRecord = {
            id: data?.record?.id || `live-${empId}-${dateStr}-${actionType === 'Check In' ? 'in' : 'out'}-${Date.now()}`,
            employeeId: empId,
            userId: empId,
            userName: empName,
            name: empName,
            type: actionType === 'Check In' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
            action: actionType,
            date: dateStr,
            time: `${dateStr} ${timeStr.slice(0, 5)}`,
            distance: locName,
            status: 'verified',
            employeeNote: employeeNote || '',
            notes: employeeNote || '',
            createdAt: new Date().toISOString(),
          };

          const rawLive = localStorage.getItem('ashley_live_checkins');
          const liveList = rawLive ? JSON.parse(rawLive) : [];
          const filtered = liveList.filter((l: any) => !(l.employeeId === empId && l.date === dateStr && l.action === actionType));
          filtered.unshift(liveRecord);
          localStorage.setItem('ashley_live_checkins', JSON.stringify(filtered));

          // Also remove any deletion flag for this employee and date
          const month = dateStr.slice(0, 7);
          const delMap = JSON.parse(localStorage.getItem(`ashley_deleted_attendance_${month}`) || '{}');
          delete delMap[`${empId}_${dateStr}`];
          localStorage.setItem(`ashley_deleted_attendance_${month}`, JSON.stringify(delMap));

          window.dispatchEvent(new Event('ashley_attendance_updated'));
          window.dispatchEvent(new Event('storage'));
        } catch {}
      }

      setAttMessage({
        text:
          actionType === 'Check In'
            ? `✅ سوپاس بۆ چێک‌ئین! هاتنەکەت لە کاتژمێر (${format(new Date(), 'HH:mm')}) تۆمار کرا، ${empName}. ${employeeNote ? `(تێبینی: ${employeeNote})` : ''}`
            : `👋 سوپاس بۆ چێک‌ئاوت! دەرچوونەکەت لە کاتژمێر (${format(new Date(), 'HH:mm')}) تۆمار کرا، ${empName}. ${employeeNote ? `(تێبینی: ${employeeNote})` : ''}`,
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
    setFaceScanMessage('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
    setFaceScanSuccess(null);
    setScanProgress(0);
    holdTimerRef.current = 0;
    lastDetectedEmpIdRef.current = null;
    setRecognizedEmployeeName(null);
    setCameraActive(true);
    startCamera('user');
  };

  // 🌟 2-SECOND STEADY HOLD SCANNING LOOP (CALM, STEADY NOTIFICATIONS WITH GLOBAL BEST MATCH)
  useEffect(() => {
    if (!cameraActive || !activeFaceAction) return;

    let isFrameRunning = false;

    const interval = setInterval(async () => {
      if (isProcessingScanRef.current || !videoRef.current || videoRef.current.readyState < 2 || isFrameRunning) {
        return;
      }

      isFrameRunning = true;
      try {
        const liveResult = await extractFaceDescriptor(videoRef.current);

        if (liveResult && liveResult.descriptor) {
          // 🎯 Global Minimum Distance Best-Match across ALL registered faces
          let bestMatchedEmp: { id: string; name: string } | null = null;
          let minDistance = Infinity;
          const STRICT_THRESHOLD = 0.48; // High precision threshold

          for (const registeredUser of registeredFacesList) {
            if (registeredUser.descriptor && registeredUser.descriptor.length > 0) {
              const match = matchFaceDescriptors(liveResult.descriptor, registeredUser.descriptor, STRICT_THRESHOLD);
              if (match.isMatch && match.distance < minDistance) {
                minDistance = match.distance;
                bestMatchedEmp = registeredUser;
              }
            }
          }

          if (bestMatchedEmp) {
            // Track if it's the SAME continuous person
            if (lastDetectedEmpIdRef.current === bestMatchedEmp.id) {
              holdTimerRef.current += 150;
            } else {
              lastDetectedEmpIdRef.current = bestMatchedEmp.id;
              holdTimerRef.current = 150;
            }

            const pct = Math.min(100, Math.round((holdTimerRef.current / 2000) * 100));
            setScanProgress(pct);
            setFaceScanMessage(`ناسراوە: ${bestMatchedEmp.name} (بۆ ٢ چرکە جێگیربە...)`);

            if (pct >= 100 && !isProcessingScanRef.current) {
              isProcessingScanRef.current = true;
              clearInterval(interval);

              const now = new Date();
              const currentMins = now.getHours() * 60 + now.getMinutes();
              const isLate = activeFaceAction === 'Check In' && currentMins > 495; // > 08:15
              const isEarly = activeFaceAction === 'Check Out' && currentMins < 1005; // < 16:45
              const isOvertime = activeFaceAction === 'Check Out' && (currentMins > 1035 || currentMins <= 360); // > 17:15 or night

              if (isLate || isEarly || isOvertime) {
                stopCamera();
                setPendingNoteData({
                  empId: bestMatchedEmp.id,
                  empName: bestMatchedEmp.name,
                  action: activeFaceAction,
                  isLate,
                  isEarly,
                  isOvertime,
                  timeStr: format(now, 'HH:mm'),
                });
              } else {
                setFaceScanSuccess(true);
                setRecognizedEmployeeName(bestMatchedEmp.name);
                setFaceScanMessage(`سەرکەوتوو بوو! بەخێربێیت ${bestMatchedEmp.name}`);

                // Save Attendance immediately
                await saveAttendanceLog(bestMatchedEmp.id, bestMatchedEmp.name, activeFaceAction);

                // Automatically close smoothly after 1.2s
                setTimeout(() => {
                  stopCamera();
                }, 1200);
              }
            }
          } else {
            // Face in frame but does not match any registered employee closely
            lastDetectedEmpIdRef.current = null;
            if (holdTimerRef.current > 0) {
              holdTimerRef.current = Math.max(0, holdTimerRef.current - 200);
              setScanProgress(Math.round((holdTimerRef.current / 2000) * 100));
            }
            setFaceScanMessage('ڕوخسار لە کۆگای داتا نەدۆزرایەوە');
          }
        } else {
          // Face moved out of frame
          lastDetectedEmpIdRef.current = null;
          if (holdTimerRef.current > 0) {
            holdTimerRef.current = Math.max(0, holdTimerRef.current - 300);
            setScanProgress(Math.round((holdTimerRef.current / 2000) * 100));
          }
          setFaceScanMessage('سەیری ناو بازنەکە بکە...');
        }
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        isFrameRunning = false;
      }
    }, 150);

    return () => {
      clearInterval(interval);
    };
  }, [cameraActive, activeFaceAction, registeredFacesList]);

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 text-slate-900 font-sans flex flex-col justify-between p-3 sm:p-5 select-none touch-manipulation dir-rtl" dir="rtl">
      
      {/* 🌟 ULTRA-CLEAN LIGHT HEADER (FIXED TOP) */}
      <header className="w-full max-w-4xl mx-auto flex-shrink-0 flex items-center justify-between pb-1">
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

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 border border-slate-200 text-slate-700 text-xs font-mono font-black shadow-xs">
          <Clock className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
          <span>{currentTimeStr || '09:00:00'}</span>
        </div>
      </header>

      {/* 🌟 MAIN TERMINAL BODY */}
      <main className="flex-1 w-full max-w-3xl mx-auto my-auto flex flex-col items-center justify-center min-h-0 py-1">
        <div className="w-full bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xl shadow-slate-300/30 text-center space-y-3.5 sm:space-y-4 relative overflow-hidden flex flex-col justify-center">
          
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

          {/* TWO PROMINENT TILES: CHECK IN & CHECK OUT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
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

          <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{registeredFacesList.length} کارمەند بە ڕوخسار تۆمار کراون و ئامادەن</span>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-4xl mx-auto flex-shrink-0 py-1 text-center text-[10px] font-bold text-slate-400">
        ASHLEY ENTERPRISE ERP SYSTEM © 2026 — هەموو مافەکان پارێزراون
      </footer>

      {/* ========================================================================= */}
      {/* 🎥 IMMERSIVE FULL-SCREEN AI FACE TERMINAL WITH LARGE 2-SECOND RING */}
      {/* ========================================================================= */}
      {cameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none touch-none">
          
          {/* 🌟 TOP FLOATING CONTROLS */}
          <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
            <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-xs font-black flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>
                {activeFaceAction === 'Check In' ? '📥 هاتن (Check In)' : '📤 دەرچوون (Check Out)'}
              </span>
            </div>

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

          {/* 🌟 FULL SCREEN CAMERA FEED WITH EXPANDED LARGE OVAL HUD */}
          <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              disablePictureInPicture
              className={`w-full h-full object-cover sm:object-contain will-change-transform ${
                facingMode === 'user' ? 'transform scale-x-[-1]' : ''
              }`}
            />

            {/* 🟢 EXPANDED LARGE BIOMETRIC SVG OVAL HUD */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="relative w-[86vw] max-w-[360px] h-[64vh] max-h-[490px] flex items-center justify-center">
                
                {/* Large SVG Ellipse Progress Ring */}
                <svg className="w-full h-full drop-shadow-[0_0_25px_rgba(0,0,0,0.85)]" viewBox="0 0 340 460">
                  {/* Outer Dashed Track */}
                  <ellipse
                    cx="170"
                    cy="230"
                    rx="155"
                    ry="215"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="4.5"
                    strokeDasharray="10 7"
                  />

                  {/* Smooth 2-Second Progress Stroke */}
                  <ellipse
                    cx="170"
                    cy="230"
                    rx="155"
                    ry="215"
                    fill="none"
                    stroke={faceScanSuccess ? '#10b981' : scanProgress > 0 ? '#38bdf8' : 'transparent'}
                    strokeWidth="7"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: 1170,
                      strokeDashoffset: 1170 - (1170 * scanProgress) / 100,
                      transition: 'stroke-dashoffset 0.15s linear, stroke 0.3s ease',
                    }}
                  />
                </svg>

                {/* Center Badge Indicator */}
                <div className="absolute inset-x-0 bottom-6 text-center">
                  <span className={`text-xs font-black px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-colors ${
                    scanProgress >= 100
                      ? 'bg-emerald-500 text-white border-emerald-300'
                      : scanProgress > 0
                      ? 'bg-sky-600/90 text-white border-sky-400 font-mono'
                      : 'bg-black/75 text-white border-white/20'
                  }`}>
                    {scanProgress >= 100
                      ? `✅ ${recognizedEmployeeName || 'دڵنیابووەوە'}`
                      : scanProgress > 0
                      ? `⏳ ${scanProgress}% جێگیربە`
                      : 'ڕوخسارت بخەرە ناو بازنەکە'}
                  </span>
                </div>

              </div>
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

          {/* 🌟 BOTTOM STEADY NOTIFICATION STATUS */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-6 pb-8 flex flex-col items-center justify-center bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
            <div className={`px-6 py-2.5 rounded-full backdrop-blur-2xl border text-center shadow-xl transition-all ${
              faceScanSuccess === true
                ? 'bg-emerald-600/90 text-white border-emerald-400'
                : faceScanSuccess === false
                ? 'bg-rose-600/90 text-white border-rose-400'
                : 'bg-black/75 text-white border-white/20'
            }`}>
              <p className="text-xs sm:text-sm font-black">
                {faceScanMessage}
              </p>
            </div>
          </div>

        </div>
      )}

      {/* 🌟 EMPLOYEE SELF-NOTE MODAL (ON LATE, EARLY, OR OVERTIME) */}
      {pendingNoteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 dir-rtl" dir="rtl">
          <div className="bg-white rounded-3xl border-2 border-indigo-300 shadow-2xl max-w-md w-full p-5 space-y-4 text-right animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
                  pendingNoteData.isLate || pendingNoteData.isEarly ? 'bg-gradient-to-br from-rose-500 to-red-700' : 'bg-gradient-to-br from-purple-600 to-indigo-800'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    تێبینی و هۆکاری {pendingNoteData.action === 'Check In' ? 'هاتن' : 'دەرچوون'}
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    👤 {pendingNoteData.empName} — ⏰ {pendingNoteData.timeStr}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-slate-700 leading-relaxed">
              {pendingNoteData.isLate && '⚠️ کاتی هاتنەکەت دوای کاتژمێر 08:15 تۆمار کراوە (دواکەوتن). تکایە هۆکاری دواکەوتن بنووسە:'}
              {pendingNoteData.isEarly && '⚠️ کاتی ڕۆیشتنەکەت پێش کاتژمێر 16:45 تۆمار کراوە (ڕۆیشتنی پێشوەختە). تکایە هۆکار بنووسە:'}
              {pendingNoteData.isOvertime && '⚡ کاتی ئیزافە و مانەوە تۆمار کراوە. تکایە جۆری کار و هۆکاری ئیزافەکەت دیاری بکە:'}
            </p>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 block">هەڵبژاردنی خێرا:</span>
              <div className="flex flex-wrap gap-1.5">
                {(pendingNoteData.action === 'Check In'
                  ? ['قەرەباڵغی ڕێگا', 'نەخۆشی و تەندروستی', 'ئەرکی فەرمی کارگە', 'تێکچوونی سەیارە', 'سەردانی مەیدانی']
                  : pendingNoteData.isOvertime
                  ? ['مانەوە بۆ بارداگرتن', 'تەواوکردنی ئیشی فەرمی', 'کاری فریاگوزاری', 'ئیشی مەیدانی و نقڵ']
                  : ['مۆڵەتی تەندروستی', 'ئەرکی کارگێڕی دەرەوە', 'کێشەی خێزانی لەناکاو']
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCustomEmployeeNote(preset)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      customEmployeeNote === preset
                        ? 'bg-blue-900 text-white border-blue-900 shadow-sm scale-105'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">یان نووسینی تێبینی بە دەست:</label>
              <textarea
                value={customEmployeeNote}
                onChange={(e) => setCustomEmployeeNote(e.target.value)}
                placeholder="تێبینی یان هۆکار لێرە بنووسە..."
                rows={2}
                className="input-classic w-full text-xs font-bold p-2.5 rounded-xl"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={async () => {
                  const data = pendingNoteData;
                  setPendingNoteData(null);
                  setCustomEmployeeNote('');
                  await saveAttendanceLog(data.empId, data.empName, data.action, '');
                }}
                className="btn-classic text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                تێپەڕاندن (بێ تێبینی)
              </button>
              <button
                type="button"
                onClick={async () => {
                  const data = pendingNoteData;
                  const note = customEmployeeNote.trim();
                  setPendingNoteData(null);
                  setCustomEmployeeNote('');
                  await saveAttendanceLog(data.empId, data.empName, data.action, note);
                }}
                className="btn-classic-primary text-xs px-4 py-1.5 font-bold shadow-md rounded-xl cursor-pointer"
              >
                پاشەکەوت و چێک‌{pendingNoteData.action === 'Check In' ? 'ئین' : 'ئاوت'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
