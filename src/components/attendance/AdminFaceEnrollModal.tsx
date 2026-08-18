'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, SwitchCamera, X } from 'lucide-react';
import { extractFaceDescriptor, loadFaceModels } from '@/lib/face-recognition';
import type { Employee } from '@/lib/types';

interface AdminFaceEnrollModalProps {
  employee: Employee;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminFaceEnrollModal({
  employee,
  isOpen,
  onClose,
  onSuccess,
}: AdminFaceEnrollModalProps) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100%
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isEnrollingRef = useRef(false);
  const holdTimerRef = useRef<number>(0);
  const lastDescriptorRef = useRef<number[] | null>(null);

  // Store stable refs for props to prevent re-renders from restarting the camera
  const employeeRef = useRef(employee);
  employeeRef.current = employee;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Check if employee already has face registered on modal open
  useEffect(() => {
    if (!employee?.id || !isOpen) return;
    setStatusMessage('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
    setIsSuccess(null);
    setScanProgress(0);
    isEnrollingRef.current = false;
    holdTimerRef.current = 0;
    lastDescriptorRef.current = null;

    // Check localStorage cache first
    try {
      const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
      if (localDb[employee.id]) {
        setAlreadyRegistered(true);
      }
    } catch {}

    fetch(`/api/attendance/face/status?userId=${employee.id}&_t=${Date.now()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.hasFaceRegistered) {
          setAlreadyRegistered(true);
        } else {
          setAlreadyRegistered(false);
        }
      })
      .catch(() => setAlreadyRegistered(false));
  }, [employee?.id, isOpen]);

  // Start camera (Hardware-accelerated, zero-shake, natural wide resolution)
  const startCameraStream = useCallback(async (mode: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode === 'environment' ? 'environment' : 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        console.warn('High-res camera fallback in enroll modal:', err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
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
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error('Camera open error:', err);
      setStatusMessage('هەڵە لە کردنەوەی کامێرا: ' + (err.message || 'تکایە لە Safari ڕێگە بدە'));
      setIsSuccess(false);
    }
  }, []);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isEnrollingRef.current = false;
    setIsScanning(false);
    setStatusMessage('سەیری کامێرای پێشەوە بکە و بۆ ٢ چرکە جێگیربە...');
    setScanProgress(0);
    holdTimerRef.current = 0;
  }, []);

  // Perform Final Face Save to Supabase and LocalStorage
  const saveFaceDescriptor = useCallback(async (descriptor: number[]) => {
    if (isEnrollingRef.current) return;
    isEnrollingRef.current = true;
    setIsScanning(true);
    setStatusMessage('تۆمارکردنی ئەندازەی دەموچاو...');

    const currentEmp = employeeRef.current;

    try {
      // 1. Save locally immediately
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        localDb[currentEmp.id] = {
          id: currentEmp.id,
          name: currentEmp.fullName3Part || currentEmp.name,
          descriptor,
        };
        localStorage.setItem('ashley_face_registry_local', JSON.stringify(localDb));
      } catch {}

      // 2. Save 128-D vector descriptor to Supabase
      const res = await fetch('/api/attendance/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentEmp.id,
          userName: currentEmp.fullName3Part || currentEmp.name,
          descriptor,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error('کێشەیەک لە پاشەکەوتکردنی سێرڤەر هەیە');
      }

      setIsSuccess(true);
      setScanProgress(100);
      setStatusMessage(`✅ ڕوخساری (${currentEmp.fullName3Part || currentEmp.name}) بە سەرکەوتوویی تۆمارکرا!`);
      setAlreadyRegistered(true);

      // Smooth auto-close after 1.2s
      setTimeout(() => {
        stopCameraStream();
        onSuccessRef.current();
        onCloseRef.current();
      }, 1200);
    } catch (err: any) {
      console.error('Face registration error:', err);
      setIsSuccess(false);
      setStatusMessage('هەڵە لە تۆمارکردن: ' + (err.message || 'شکستی هێڵ'));
      isEnrollingRef.current = false;
      holdTimerRef.current = 0;
      setScanProgress(0);
    } finally {
      setIsScanning(false);
    }
  }, [stopCameraStream]);

  // 🌟 CAMERA LIFECYCLE: Starts ONLY on Modal Open, Never Re-triggers on Re-renders
  useEffect(() => {
    if (!isOpen) return;

    loadFaceModels();
    startCameraStream(facingMode);

    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, startCameraStream, stopCameraStream]);

  // 🌟 2-SECOND STEADY HOLD SCANNING INTERVAL (Completely independent of render cycles)
  useEffect(() => {
    if (!isOpen) return;

    let isDetecting = false;

    const interval = setInterval(async () => {
      if (isEnrollingRef.current || !videoRef.current || videoRef.current.readyState < 2 || isDetecting) {
        return;
      }

      isDetecting = true;
      try {
        const liveResult = await extractFaceDescriptor(videoRef.current);

        if (liveResult && liveResult.descriptor) {
          lastDescriptorRef.current = liveResult.descriptor;
          holdTimerRef.current += 150;

          const pct = Math.min(100, Math.round((holdTimerRef.current / 2000) * 100));
          setScanProgress(pct);

          if (pct >= 100 && !isEnrollingRef.current) {
            clearInterval(interval);
            await saveFaceDescriptor(lastDescriptorRef.current);
          }
        } else {
          // Face moved away: gently decrease progress
          if (holdTimerRef.current > 0) {
            holdTimerRef.current = Math.max(0, holdTimerRef.current - 300);
            setScanProgress(Math.round((holdTimerRef.current / 2000) * 100));
          }
        }
      } catch (err) {
        console.error('Detection frame error:', err);
      } finally {
        isDetecting = false;
      }
    }, 150);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, saveFaceDescriptor]);

  // Switch camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCameraStream(nextMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none touch-none dir-rtl" dir="rtl">
      
      {/* 🌟 TOP FLOATING MINIMAL CONTROLS BAR */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        
        {/* Action Title Badge */}
        <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-xs font-black flex items-center gap-2">
          <Camera className="w-4 h-4 text-amber-400" />
          <span>
            ناساندنی ڕوخسار: <strong className="text-amber-300">{employee.fullName3Part || employee.name}</strong>
          </span>
          {alreadyRegistered && (
            <span className="px-2 py-0.5 bg-emerald-500/40 text-emerald-200 rounded-full text-[10px] font-mono font-bold">
              دووبارە
            </span>
          )}
        </div>

        {/* Switch Camera & Close Buttons Only */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleCamera}
            className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer"
            title="گۆڕینی کامێرا"
          >
            <SwitchCamera className="w-5 h-5 text-white" />
          </button>

          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
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

        {/* 🌟 EXPANDED LARGE 2-SECOND BIOMETRIC SVG OVAL HUD */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-[86vw] max-w-[360px] h-[64vh] max-h-[490px] flex items-center justify-center">
            
            {/* SVG Ellipse Progress Ring */}
            <svg className="w-full h-full drop-shadow-[0_0_25px_rgba(0,0,0,0.85)]" viewBox="0 0 340 460">
              {/* Background Track */}
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

              {/* Glowing Smooth Progress Stroke (Fills in 2 Seconds) */}
              <ellipse
                cx="170"
                cy="230"
                rx="155"
                ry="215"
                fill="none"
                stroke={isSuccess ? '#10b981' : scanProgress > 0 ? '#38bdf8' : 'transparent'}
                strokeWidth="7"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 1170,
                  strokeDashoffset: 1170 - (1170 * scanProgress) / 100,
                  transition: 'stroke-dashoffset 0.15s linear, stroke 0.3s ease',
                }}
              />
            </svg>

            {/* Center Live Percentage / Guidance */}
            <div className="absolute inset-x-0 bottom-6 text-center">
              <span className={`text-xs font-black px-4 py-1.5 rounded-full backdrop-blur-md border shadow-lg transition-colors ${
                scanProgress >= 100
                  ? 'bg-emerald-500 text-white border-emerald-300'
                  : scanProgress > 0
                  ? 'bg-sky-600/90 text-white border-sky-400 font-mono'
                  : 'bg-black/75 text-white border-white/20'
              }`}>
                {scanProgress >= 100
                  ? '✅ تەواو بوو'
                  : scanProgress > 0
                  ? `⏳ ${scanProgress}% جێگیربە`
                  : 'ڕوخسارت بخەرە ناو بازنەکە'}
              </span>
            </div>

          </div>
        </div>

        {/* Success Overlay Flash */}
        {isSuccess === true && (
          <div className="absolute inset-0 bg-emerald-950/40 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 pointer-events-none animate-in fade-in duration-200">
            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/80 animate-bounce">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black">{employee.fullName3Part || employee.name}</h2>
              <p className="text-sm font-bold text-emerald-200 mt-0.5">
                ناساندنی ڕوخسار بە سەرکەوتوویی تەواو بوو!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 BOTTOM STEADY STATUS BAR & INSTANT SNAP FALLBACK */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-6 pb-8 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto">
        <div className={`px-6 py-2.5 rounded-full backdrop-blur-2xl border text-center shadow-xl transition-all ${
          isSuccess === true
            ? 'bg-emerald-600/90 text-white border-emerald-400'
            : isSuccess === false
            ? 'bg-rose-600/90 text-white border-rose-400'
            : 'bg-black/75 text-white border-white/20'
        }`}>
          <p className="text-xs sm:text-sm font-black flex items-center gap-2">
            {isScanning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />}
            <span>{statusMessage}</span>
          </p>
        </div>

        {/* Manual Instant Snap Button */}
        <button
          type="button"
          disabled={isScanning || isSuccess === true}
          onClick={() => {
            if (lastDescriptorRef.current) {
              saveFaceDescriptor(lastDescriptorRef.current);
            } else if (videoRef.current) {
              extractFaceDescriptor(videoRef.current).then((res) => {
                if (res?.descriptor) saveFaceDescriptor(res.descriptor);
                else alert('ڕوخسار نەدۆزرایەوە! سەیری ناو بازنەکە بکە.');
              });
            }
          }}
          className="btn-classic px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 font-black text-xs flex items-center gap-2 backdrop-blur-md cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
        >
          <Camera className="w-4 h-4 text-amber-300" />
          <span>📸 تۆمارکردنی خێرا</span>
        </button>
      </div>

    </div>
  );
}
