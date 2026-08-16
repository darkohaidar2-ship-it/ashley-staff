'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Sparkles, CheckCircle, AlertTriangle, SwitchCamera, X } from 'lucide-react';
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if employee already has face registered
  useEffect(() => {
    if (!employee?.id || !isOpen) return;
    setStatusMessage(null);
    setIsSuccess(null);

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFaceModels().catch((e) => console.log('Preloading face models:', e));
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Switch between Front and Back camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Capture face descriptor and save to Supabase
  const handleScanAndSave = async () => {
    if (!videoRef.current) return;

    try {
      setIsScanning(true);
      setStatusMessage('پشکنین و کۆدکردنی ئەندازەی دەموچاو بە زیرەکی دەستکرد...');
      setIsSuccess(null);

      const faceResult = await extractFaceDescriptor(videoRef.current);
      if (!faceResult) {
        setIsSuccess(false);
        setStatusMessage('❌ هیچ دەموچاوێک نەدۆزرایەوە! کامێراکە ڕاستەوخۆ بەرامبەر دەموچاوی کارمەندەکە ڕابگرە.');
        setIsScanning(false);
        return;
      }

      // Save purely the 128-D vector descriptor without storing heavy photo files
      const res = await fetch('/api/attendance/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: employee.id,
          descriptor: faceResult.descriptor,
        }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setAlreadyRegistered(true);
        setStatusMessage(`🎉 ناسنامەی ڕوخساری (${employee.fullName3Part || employee.name}) بە سەرکەوتوویی لە داتابەیز تۆمارکرا!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2200);
      } else {
        setIsSuccess(false);
        setStatusMessage('هەڵە لە پاشەکەوتکردنی داتاکان لە سێرڤەر');
      }
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMessage(err.message || 'هەڵە لە تۆمارکردنی ڕوخسار');
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 dir-rtl" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 text-white animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                تۆمارکردنی ڕوخساری: {employee.fullName3Part || employee.name}
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">
                ناسینەوەی ئەندازەیی بە زیرەکی دەستکرد (AI Face ID)
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
          <span className="text-slate-300">دۆخی ڕوخسار لە داتابەیز:</span>
          <span className={alreadyRegistered ? 'text-emerald-400' : 'text-amber-400'}>
            {alreadyRegistered ? '✅ پێشتر تۆمارکراوە (دەتوانیت نوێی بکەیتەوە)' : '⚠️ هێشتا تۆمار نەکراوە'}
          </span>
        </div>

        {/* Camera Viewfinder with Switch Button */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-indigo-500/50 shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Futuristic Face Targeting Box */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-44 h-44 rounded-3xl border-2 border-dashed border-indigo-400/90 animate-pulse flex items-center justify-center">
              <div className="w-40 h-40 rounded-2xl border border-emerald-400/60" />
            </div>
          </div>

          {/* Toggle Camera Button (Front vs Back) */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className="absolute top-3 left-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-[11px] font-black px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-amber-300" />
            <span>{facingMode === 'user' ? '🔄 کامێرای پشتەوە' : '🔄 کامێرای پێشەوە'}</span>
          </button>

          {isScanning && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 text-amber-300 animate-spin" />
              <span className="text-xs font-black text-white">پشکنینی ئەندازەی ڕوخسار...</span>
            </div>
          )}
        </div>

        {/* Status Message Display */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-black text-center border animate-in fade-in ${
              isSuccess === true
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600'
                : isSuccess === false
                ? 'bg-rose-950/90 text-rose-200 border-rose-600'
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
            disabled={isScanning}
            onClick={handleScanAndSave}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 text-white" />
            <span>سکان و تۆمارکردنی ڕوخساری کارمەند</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-all"
          >
            پەشیمانبوونەوە
          </button>
        </div>

      </div>
    </div>
  );
}
