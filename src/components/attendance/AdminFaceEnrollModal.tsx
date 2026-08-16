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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
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

  // Start camera
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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
      setStatusMessage('پشکنین و کۆدکردنی ئەندازەی دەموچاو بە زیرەکی دەستکرد...');
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
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setAlreadyRegistered(true);
        setStatusMessage(`🎉 ڕوخساری (${employee.fullName3Part || employee.name}) بە سەرکەوتوویی تۆمارکرا! ✅`);
        
        // Stop camera and trigger success
        stopCamera();
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        isEnrollingRef.current = false;
        setIsSuccess(false);
        setStatusMessage('هەڵە لە پاشەکەوتکردنی داتاکان لە سێرڤەر');
      }
    } catch (err: any) {
      isEnrollingRef.current = false;
      setIsSuccess(false);
      setStatusMessage(err.message || 'هەڵە لە تۆمارکردنی ڕوخسار');
    } finally {
      setIsScanning(false);
    }
  }, [employee, onSuccess, onClose]);

  // Live Auto-Detection Loop: Automatically detects face in circle
  useEffect(() => {
    if (!isOpen) return;

    loadFaceModels().then(() => {
      startCamera(facingMode);

      // Start periodic auto-detection every 400ms
      autoDetectTimerRef.current = setInterval(async () => {
        if (!videoRef.current || isEnrollingRef.current || videoRef.current.readyState < 2) return;

        try {
          const liveFace = await extractFaceDescriptor(videoRef.current);
          if (liveFace && !isEnrollingRef.current) {
            setFaceInsideOval(true);
            // Automatically capture & enroll face!
            handleScanAndSave();
          } else {
            setFaceInsideOval(false);
          }
        } catch {
          // Silent catch in background scanner
        }
      }, 400);
    });

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
        <div className="relative rounded-3xl overflow-hidden bg-black aspect-square max-h-[340px] flex items-center justify-center border-2 border-indigo-500/50 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* 🌟 HUMAN FACE OVAL TARGET HUD */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4">
            
            {/* The Head Oval Guide Circle */}
            <div
              className={`w-52 h-64 rounded-[50%/60%] transition-all duration-300 flex flex-col items-center justify-center relative ${
                isSuccess
                  ? 'border-4 border-emerald-400 bg-emerald-500/20 shadow-[0_0_40px_rgba(52,211,153,0.9)] animate-pulse'
                  : faceInsideOval
                  ? 'border-4 border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.7)]'
                  : 'border-2 border-dashed border-indigo-300/80 shadow-[0_0_20px_rgba(99,102,241,0.4)] animate-pulse'
              }`}
            >
              {/* Corner brackets */}
              <div className="absolute top-2 left-6 w-4 h-4 border-t-2 border-l-2 border-white/60" />
              <div className="absolute top-2 right-6 w-4 h-4 border-t-2 border-r-2 border-white/60" />
              <div className="absolute bottom-2 left-6 w-4 h-4 border-b-2 border-l-2 border-white/60" />
              <div className="absolute bottom-2 right-6 w-4 h-4 border-b-2 border-r-2 border-white/60" />

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

          {/* Toggle Camera Button (Front vs Back) */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className="absolute top-3 left-3 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all z-10"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-amber-300" />
            <span>{facingMode === 'user' ? '🔄 کامێرای پشتەوە' : '🔄 کامێرای پێشەوە'}</span>
          </button>
        </div>

        {/* Status Message Display */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs font-black text-center border animate-in fade-in ${
              isSuccess === true
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500 shadow-lg shadow-emerald-900/50'
                : isSuccess === false
                ? 'bg-rose-950/90 text-rose-200 border-rose-600 shadow-lg shadow-rose-900/50'
                : 'bg-indigo-950/90 text-indigo-200 border-indigo-700'
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            disabled={isScanning || isSuccess === true}
            onClick={handleScanAndSave}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 text-white" />
            <span>سکان و تۆمارکردنی دەستی</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
