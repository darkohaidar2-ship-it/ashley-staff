'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, SwitchCamera, X, User } from 'lucide-react';
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
  const [isScanning, setIsScanning] = useState(false);
  const [faceInsideOval, setFaceInsideOval] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoDetectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEnrollingRef = useRef(false);

  // Check if employee already has face registered
  useEffect(() => {
    if (!employee?.id || !isOpen) return;
    setStatusMessage('سەیری کامێرای پێشەوە بکە...');
    setIsSuccess(null);
    setFaceInsideOval(false);
    isEnrollingRef.current = false;

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
  }, [employee, isOpen]);

  // Start camera (Natural Un-zoomed Resolution for iPhone - Hardware Accelerated)
  const startCamera = async (mode: 'user' | 'environment') => {
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
  };

  const stopCamera = () => {
    if (autoDetectTimerRef.current) {
      clearInterval(autoDetectTimerRef.current);
      autoDetectTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isEnrollingRef.current = false;
    setIsScanning(false);
    setFaceInsideOval(false);
  };

  // Perform face extraction & save
  const handleScanAndSave = useCallback(async () => {
    if (!videoRef.current || isEnrollingRef.current) return;

    try {
      isEnrollingRef.current = true;
      setIsScanning(true);
      setStatusMessage('پشکنین و کۆدکردنی ئەندازەی دەموچاو...');

      const faceResult = await extractFaceDescriptor(videoRef.current);
      if (!faceResult || !faceResult.descriptor) {
        isEnrollingRef.current = false;
        setIsScanning(false);
        setFaceInsideOval(false);
        setStatusMessage('سەیری ناو بازنەکە بکە...');
        return;
      }

      setFaceInsideOval(true);

      // Save locally immediately
      try {
        const localDb = JSON.parse(localStorage.getItem('ashley_face_registry_local') || '{}');
        localDb[employee.id] = {
          id: employee.id,
          name: employee.fullName3Part || employee.name,
          descriptor: faceResult.descriptor,
        };
        localStorage.setItem('ashley_face_registry_local', JSON.stringify(localDb));
      } catch {}

      // Save purely the 128-D vector descriptor to Supabase
      const res = await fetch('/api/attendance/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employee.id,
          userName: employee.fullName3Part || employee.name,
          descriptor: faceResult.descriptor,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error('کێشەیەک لە پاشەکەوتکردنی سێرڤەر هەیە');
      }

      setIsSuccess(true);
      setStatusMessage(`✅ ڕوخساری (${employee.fullName3Part || employee.name}) بە سەرکەوتوویی ناسێندرا!`);
      setAlreadyRegistered(true);

      // Smooth auto-close after 1.2s
      setTimeout(() => {
        stopCamera();
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Face registration error:', err);
      setIsSuccess(false);
      setStatusMessage('هەڵە لە تۆمارکردن: ' + (err.message || 'شکستی هێڵ'));
      isEnrollingRef.current = false;
    } finally {
      setIsScanning(false);
    }
  }, [employee, onSuccess, onClose]);

  // Lifecycle: open & start camera with stable loop
  useEffect(() => {
    if (isOpen) {
      loadFaceModels();
      startCamera(facingMode);

      const timer = setInterval(async () => {
        if (!isEnrollingRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          try {
            const liveResult = await extractFaceDescriptor(videoRef.current);
            if (liveResult && liveResult.descriptor) {
              setFaceInsideOval(true);
              clearInterval(timer);
              handleScanAndSave();
            }
          } catch {}
        }
      }, 600);

      autoDetectTimerRef.current = timer;
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, handleScanAndSave]);

  // Switch between Front and Back camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none touch-none dir-rtl" dir="rtl">
      
      {/* 🌟 TOP FLOATING MINIMAL CONTROLS BAR */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        
        {/* Action Title Badge */}
        <div className="px-3.5 py-1.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/20 text-white text-xs font-black flex items-center gap-2">
          <Camera className="w-4 h-4 text-amber-400" />
          <span>
            ناساندنی ڕوخسار: <strong className="text-amber-300">{employee.fullName3Part || employee.name}</strong>
          </span>
          {alreadyRegistered && (
            <span className="px-2 py-0.2 bg-emerald-500/40 text-emerald-200 rounded-full text-[10px] font-mono font-bold">
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
              stopCamera();
              onClose();
            }}
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
            isSuccess === true
              ? 'border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.9)] bg-emerald-500/20 scale-105'
              : isSuccess === false
              ? 'border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.8)] bg-rose-500/15'
              : faceInsideOval
              ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.6)]'
              : 'border-dashed border-white/60 shadow-[0_0_30px_rgba(255,255,255,0.25)]'
          }`}
        >
          <span className="text-xs font-black text-white px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20">
            {isSuccess === true
              ? `✅ ڕوخسار بە سەرکەوتوویی تۆمارکرا!`
              : faceInsideOval
              ? '🟢 ڕوخسار لە ناو بازنەیە'
              : 'ڕوخسارت بخەرە ناو بازنەکە'}
          </span>

          <div className="w-12 h-1 bg-white/40 rounded-full" />
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

      {/* 🌟 BOTTOM STATUS BAR & MANUAL SNAP BUTTON */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-6 pb-8 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <div className={`px-5 py-2.5 rounded-full backdrop-blur-2xl border text-center shadow-xl transition-all ${
          isSuccess === true
            ? 'bg-emerald-600/90 text-white border-emerald-400'
            : isSuccess === false
            ? 'bg-rose-600/90 text-white border-rose-400'
            : 'bg-black/70 text-white border-white/20'
        }`}>
          <p className="text-xs sm:text-sm font-black flex items-center gap-2">
            {isScanning && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />}
            <span>{statusMessage || 'سەیری کامێرای پێشەوە بکە بۆ ناساندنی دەموچاو...'}</span>
          </p>
        </div>

        {/* Manual Snap Button Fallback */}
        <button
          type="button"
          disabled={isScanning || isSuccess === true}
          onClick={handleScanAndSave}
          className="btn-classic px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white border border-white/30 font-black text-xs flex items-center gap-2 backdrop-blur-md cursor-pointer transition-transform active:scale-95 disabled:opacity-50"
        >
          <Camera className="w-4 h-4 text-amber-300" />
          <span>📸 تۆمارکردنی دەستبەجێ</span>
        </button>
      </div>

    </div>
  );
}
