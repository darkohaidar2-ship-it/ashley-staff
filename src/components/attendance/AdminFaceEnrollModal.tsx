'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Sparkles, CheckCircle, AlertTriangle, SwitchCamera, X, User } from 'lucide-react';
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
  const streamRef = useRef<MediaStream | null>(null);
  const autoDetectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEnrollingRef = useRef(false);

  // Check if employee already has face registered
  useEffect(() => {
    if (!employee?.id || !isOpen) return;
    setStatusMessage(null);
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

  // Start camera (Natural Un-zoomed Resolution for iPhone)
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
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
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setStatusMessage('هەڵە لە کردنەوەی کامێرا: ' + (err.message || 'تکایە ڕێگەپێدانی کامێرا بدە'));
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
  };

  // Perform face extraction & save
  const handleScanAndSave = useCallback(async () => {
    if (!videoRef.current || isEnrollingRef.current) return;

    try {
      isEnrollingRef.current = true;
      setIsScanning(true);
      setStatusMessage('پشکنین و کۆدکردنی دەموچاو بە زیرەکی دەستکرد...');
      setIsSuccess(null);

      const faceResult = await extractFaceDescriptor(videoRef.current);
      if (!faceResult) {
        isEnrollingRef.current = false;
        setIsScanning(false);
        setFaceInsideOval(false);
        setStatusMessage('❌ دەموچاو لە ناو بازنەکە نەدۆزرایەوە! دەموچاوەکە بخەرە ناو بازنەکە.');
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
      setStatusMessage(`✅ ڕوخساری (${employee.fullName3Part || employee.name}) بە سەرکەوتوویی تۆمار کرا!`);
      setAlreadyRegistered(true);

      setTimeout(() => {
        stopCamera();
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Face registration error:', err);
      setIsSuccess(false);
      setStatusMessage('هەڵە لە تۆمارکردن: ' + (err.message || 'شکستی هێڵ'));
      isEnrollingRef.current = false;
    } finally {
      setIsScanning(false);
    }
  }, [employee, onSuccess, onClose]);

  // Lifecycle: open & start camera
  useEffect(() => {
    if (isOpen) {
      loadFaceModels();
      startCamera(facingMode);

      // Auto-scan continuously
      const timer = setInterval(async () => {
        if (!isEnrollingRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          try {
            const liveResult = await extractFaceDescriptor(videoRef.current);
            if (liveResult && liveResult.descriptor) {
              setFaceInsideOval(true);
              clearInterval(timer);
              handleScanAndSave();
            } else {
              setFaceInsideOval(false);
            }
          } catch {}
        }
      }, 700);

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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 dir-rtl" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 text-white animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                ناساندنی ڕوخسار: {employee.fullName3Part || employee.name}
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">
                دەموچاو بخەرە ناو بازنەکەوە بۆ تۆمارکردنی خۆکار
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Status Badge */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 rounded-xl text-xs font-black">
          <span className="text-slate-300">دۆخی لە داتابەیز:</span>
          <span className={alreadyRegistered ? 'text-emerald-400' : 'text-amber-400'}>
            {alreadyRegistered ? '✅ ڕوخسار پێشتر تۆمارکراوە' : '⏳ لە چاوەڕوانی ناساندن'}
          </span>
        </div>

        {/* Camera Viewfinder with Face Oval Frame */}
        <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] max-h-[380px] flex items-center justify-center border-2 border-indigo-500/50 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''}`}
          />

          {/* 🌟 HUMAN FACE OVAL TARGET HUD */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
            
            {/* The Head Oval Guide Circle */}
            <div
              className={`w-52 h-68 rounded-[50%] transition-all duration-300 flex flex-col items-center justify-center relative ${
                isSuccess
                  ? 'border-4 border-emerald-400 bg-emerald-500/20 shadow-[0_0_40px_rgba(52,211,153,0.9)] animate-pulse'
                  : faceInsideOval
                  ? 'border-4 border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.7)]'
                  : 'border-2 border-dashed border-indigo-300/80 shadow-[0_0_20px_rgba(99,102,241,0.4)] animate-pulse'
              }`}
            >
              {/* Center Silhouette Hint */}
              {!faceInsideOval && !isSuccess && (
                <div className="text-center space-y-1">
                  <User className="w-12 h-12 text-white/30 mx-auto animate-bounce" />
                  <span className="text-[10px] font-bold text-white/70 bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs">
                    دەموچاو لەم بازنەیە دابنێ
                  </span>
                </div>
              )}

              {/* Success Badge Inside Oval */}
              {isSuccess && (
                <div className="text-center space-y-1 animate-in zoom-in-75 duration-200">
                  <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
                  <span className="text-xs font-black text-emerald-300 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                    ✅ تۆمار کرا!
                  </span>
                </div>
              )}
            </div>

            {/* Bottom guide text */}
            <div className="mt-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-amber-200 shadow-md">
              {faceInsideOval ? '🟢 دەموچاو ناسرایەوە - چاوەڕێبە...' : '⚡ دەموچاو بخەرە ناو بازنەکە، خۆکارانە تۆمار دەبێت'}
            </div>
          </div>
        </div>

        {/* Live Status Message Feedback */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs font-black text-center flex items-center justify-center gap-2 border ${
              isSuccess === true
                ? 'bg-emerald-900/60 text-emerald-200 border-emerald-500/50'
                : isSuccess === false
                ? 'bg-rose-900/60 text-rose-200 border-rose-500/50'
                : 'bg-indigo-900/60 text-indigo-200 border-indigo-500/50'
            }`}
          >
            {isScanning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {isSuccess === true && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {isSuccess === false && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={handleToggleCamera}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="گۆڕینی کامێرا"
          >
            <SwitchCamera className="w-4 h-4" />
            <span>گۆڕینی کامێرا</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              داخستن
            </button>

            <button
              type="button"
              disabled={isScanning || isSuccess === true}
              onClick={handleScanAndSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>لە تۆمارکردندایە...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>📸 تۆمارکردنی ئێستا</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
