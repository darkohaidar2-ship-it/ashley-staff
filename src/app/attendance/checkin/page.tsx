'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, CheckCircle2, Clock, RefreshCw, 
  ShieldCheck, User, Users, AlertCircle, Volume2, 
  Sparkles, KeyRound, X, ArrowRightLeft, Building2
} from 'lucide-react';
import { extractFaceDescriptor, loadFaceModels, matchFaceDescriptors } from '@/lib/face-recognition';

interface RegisteredFace {
  id: string;
  name: string;
  descriptor: number[];
}

export default function FaceKioskPage() {
  const [mode, setMode] = useState<'AUTO' | 'ENTER' | 'EXIT'>('AUTO');
  const [modelsReady, setModelsReady] = useState(false);
  const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);
  const [isLoadingFaces, setIsLoadingFaces] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Scanning & Detection State
  const [statusText, setStatusText] = useState('لە چاوەڕوانی وەستان لە پێش کامێرا...');
  const [scanState, setScanState] = useState<'idle' | 'detecting' | 'matched' | 'cooldown'>('idle');
  const [matchedEmployee, setMatchedEmployee] = useState<{
    id: string;
    name: string;
    action: 'ENTER' | 'EXIT';
    timeStr: string;
    distance?: number;
  } | null>(null);

  // Manual PIN Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Time & Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedUserRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Update real-time clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setCurrentDateStr(now.toLocaleDateString('ku-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Play audio chime using Web Audio API
  const playChime = useCallback((success: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {}
  }, []);

  // Kurdish voice announcement
  const speakGreeting = useCallback((name: string, actionText: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`سڵاو ${name}، ${actionText}`);
        utterance.rate = 0.95;
        utterance.lang = 'ckb';
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  }, []);

  // Fetch all registered faces from Supabase
  const loadRegisteredFaces = useCallback(async () => {
    setIsLoadingFaces(true);
    try {
      const res = await fetch(`/api/attendance/face/all?_t=${Date.now()}`);
      const data = await res.json();
      if (data && typeof data === 'object') {
        const list: RegisteredFace[] = [];
        Object.values(data).forEach((item: any) => {
          if (item?.id && Array.isArray(item.descriptor) && item.descriptor.length > 0) {
            list.push({
              id: item.id,
              name: item.name || 'کارمەند',
              descriptor: item.descriptor,
            });
          }
        });
        setRegisteredFaces(list);
      }
    } catch (err) {
      console.error('Failed to load registered faces:', err);
    } finally {
      setIsLoadingFaces(false);
    }
  }, []);

  // Load AI Models
  useEffect(() => {
    loadFaceModels().then((ready) => {
      setModelsReady(ready);
    });
    loadRegisteredFaces();
  }, [loadRegisteredFaces]);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Camera access error in Kiosk:', err);
      setIsCameraActive(false);
      setStatusText('تکایە ڕێگە بە بەکارهێنانی کامێرا بدە لە برۆوسەرەکەتدا');
    }
  }, [facingMode]);

  useEffect(() => {
    if (modelsReady) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [modelsReady, startCamera]);

  // Submit attendance event to backend
  const recordAttendance = async (userId: string, userName: string, forcedAction?: 'ENTER' | 'EXIT') => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    let action: 'ENTER' | 'EXIT' = 'ENTER';
    if (forcedAction) {
      action = forcedAction;
    } else if (mode === 'ENTER') {
      action = 'ENTER';
    } else if (mode === 'EXIT') {
      action = 'EXIT';
    } else {
      try {
        const res = await fetch(`/api/attendance/today?userId=${userId}&userName=${encodeURIComponent(userName)}`);
        const todayData = await res.json();
        if (todayData?.checkInTime && !todayData?.checkOutTime) {
          action = 'EXIT';
        } else {
          action = 'ENTER';
        }
      } catch {
        action = 'ENTER';
      }
    }

    try {
      await fetch('/api/attendance/autonomous-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          deviceToken: 'kiosk-main',
          event: action,
          lat: 35.508918,
          lng: 45.452935,
          distance: 10,
          regionName: 'کۆمپانیای سەرەکی ئاشڵی (کیۆسک)',
        }),
      });

      const actionTextKurdish = action === 'ENTER' ? 'هاتنت تۆمارکرا' : 'ڕۆیشتنت تۆمارکرا';
      playChime(true);
      speakGreeting(userName, actionTextKurdish);

      setMatchedEmployee({
        id: userId,
        name: userName,
        action,
        timeStr,
      });
      setScanState('matched');

      setTimeout(() => {
        setMatchedEmployee(null);
        setScanState('idle');
        setStatusText('لە چاوەڕوانی کارمەندی دواتر...');
        isProcessingRef.current = false;
      }, 4000);
    } catch (err) {
      console.error('Error logging kiosk attendance:', err);
      isProcessingRef.current = false;
    }
  };

  // Main Detection Loop
  useEffect(() => {
    if (!isCameraActive || !modelsReady || registeredFaces.length === 0) return;

    scanIntervalRef.current = setInterval(async () => {
      if (isProcessingRef.current || !videoRef.current || scanState === 'matched') return;

      try {
        const result = await extractFaceDescriptor(videoRef.current);
        if (!result || !result.descriptor) {
          if (scanState !== 'idle') {
            setScanState('idle');
            setStatusText('لە چاوەڕوانی وەستان لە پێش کامێرا...');
          }
          return;
        }

        setScanState('detecting');
        setStatusText('دەموچاو دۆزرایەوە... لە پشکنینی ناسنامەداین');

        const candidateDesc = result.descriptor;
        let bestMatch: RegisteredFace | null = null;
        let bestDistance = 999;

        for (const emp of registeredFaces) {
          const match = matchFaceDescriptors(candidateDesc, emp.descriptor, 0.46);
          if (match.isMatch && match.distance < bestDistance) {
            bestDistance = match.distance;
            bestMatch = emp;
          }
        }

        if (bestMatch) {
          const now = Date.now();
          if (lastScannedUserRef.current.id === bestMatch.id && (now - lastScannedUserRef.current.time) < 15000) {
            setStatusText(`سڵاو ${bestMatch.name}، کەمێک پێش ئێستا تۆمارکراویت`);
            return;
          }

          isProcessingRef.current = true;
          lastScannedUserRef.current = { id: bestMatch.id, time: now };
          setStatusText(`ناسنامە پەسەندکرا: ${bestMatch.name}`);
          recordAttendance(bestMatch.id, bestMatch.name);
        } else {
          setStatusText('⚠️ دەموچاو نەناسرا! تکایە لە ئەدمینەوە ڕوخسارت تۆمار بکە');
        }
      } catch (err) {
        console.warn('Scan frame error:', err);
      }
    }, 600);

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isCameraActive, modelsReady, registeredFaces, scanState, mode]);

  // Handle Manual PIN
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setPinLoading(true);
    setPinError(null);

    try {
      const res = await fetch('/api/attendance/checkin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data?.user) {
        throw new Error(data.error || 'پین کۆدەکە هەڵەیە!');
      }

      setShowPinModal(false);
      setPinInput('');
      recordAttendance(data.user.id, data.user.name);
    } catch (err: any) {
      setPinError(err.message || 'ئیرۆر لە دڵنیابوونەوەی پین کۆد');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between select-none relative overflow-hidden">
      
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. TOP HEADER BAR */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-none bg-white p-1 shadow-md border border-slate-700 flex items-center justify-center">
            <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-white tracking-wide">سیستەمی ناسینەوەی دەموچاو (Ashley AI Kiosk)</h1>
              <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/40 font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Biometric AI 4.0</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              تۆمارکردنی خێرای هاتن و چوون بۆ هەموو ستافی ئاشڵی
            </p>
          </div>
        </div>

        <div className="text-left font-mono">
          <div className="text-2xl font-black text-white tracking-widest text-emerald-400">
            {currentTimeStr || '00:00:00'}
          </div>
          <div className="text-[11px] text-slate-400 font-sans font-bold">
            {currentDateStr}
          </div>
        </div>
      </header>

      {/* 2. MAIN CENTER VIEWPORT */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 max-w-4xl mx-auto w-full">
        
        <div className="relative w-full max-w-2xl aspect-4/3 rounded-none overflow-hidden bg-slate-900 border-2 border-slate-800 shadow-2xl flex items-center justify-center">
          
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

          {!modelsReady && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4 text-center p-6">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-black text-white">لە بارکردنی مۆدێلی ژیریی دەستکردی دەموچاو...</p>
                <p className="text-xs text-slate-400">AI Face Neural Networks Loading</p>
              </div>
            </div>
          )}

          {modelsReady && scanState !== 'matched' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 sm:w-80 sm:h-80 relative border-2 border-dashed border-blue-400/40 rounded-3xl flex items-center justify-center">
                
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-bounce shadow-lg shadow-blue-500" />
                
                <div className={`w-48 h-48 sm:w-60 sm:h-60 rounded-full border-2 transition-all duration-300 ${
                  scanState === 'detecting' 
                    ? 'border-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse' 
                    : 'border-blue-400/60'
                }`} />

                <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700 text-xs font-black shadow-md flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    scanState === 'detecting' ? 'bg-emerald-400 animate-ping' : 'bg-blue-400 animate-pulse'
                  }`} />
                  <span className={scanState === 'detecting' ? 'text-emerald-400' : 'text-slate-200'}>
                    {statusText}
                  </span>
                </div>
              </div>
            </div>
          )}

          {scanState === 'matched' && matchedEmployee && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in zoom-in-95 duration-200 z-30">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-widest">
                  {matchedEmployee.action === 'ENTER' ? '🎉 بەخێربێیت (CHECK-IN)' : '🏁 کاتی ڕۆیشتن (CHECK-OUT)'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {matchedEmployee.name}
                </h2>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 font-mono font-bold text-sm text-emerald-300 mt-1">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>کاتژمێر: {matchedEmployee.timeStr}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-200 max-w-sm">
                دەوامی تۆ بە سەرکەوتوویی لە داتابەیسی سەرەکی ئاشڵی تۆمارکرا.
              </div>
            </div>
          )}

        </div>

        {/* 3. BOTTOM CONTROL DOCK */}
        <div className="mt-4 w-full max-w-2xl bg-slate-900/90 border border-slate-800 p-3 rounded-none shadow-xl flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-none border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('AUTO')}
              className={`px-3 py-1.5 rounded-none text-xs font-black transition-all cursor-pointer ${
                mode === 'AUTO' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔄 دۆخی خۆکار (Auto)
            </button>
            <button
              type="button"
              onClick={() => setMode('ENTER')}
              className={`px-3 py-1.5 rounded-none text-xs font-black transition-all cursor-pointer ${
                mode === 'ENTER' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              🟢 هاتن (Check-In)
            </button>
            <button
              type="button"
              onClick={() => setMode('EXIT')}
              className={`px-3 py-1.5 rounded-none text-xs font-black transition-all cursor-pointer ${
                mode === 'EXIT' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔴 ڕۆیشتن (Check-Out)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-bold px-3 py-1.5 bg-slate-800/80 rounded-none border border-slate-700">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>{isLoadingFaces ? '...' : `${registeredFaces.length} کارمەندی ناسراو`}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowPinModal(true)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-none border border-slate-700 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>پین کۆد</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-none border border-slate-700 cursor-pointer"
              title="گۆڕینی کامێرا"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </main>

      {/* 4. FOOTER INFO */}
      <footer className="px-6 py-3 bg-slate-900/60 border-t border-slate-800 text-center text-xs text-slate-500 font-bold flex items-center justify-between">
        <span>سیستەمی فەرمی ئامادەبوونی بیۆمەتری ئاشڵی (Ashley Furniture ERP)</span>
        <span className="font-mono text-[11px] text-slate-400">HQ Ashley & Huana Gateways</span>
      </footer>

      {/* MANUAL PIN MODAL FALLBACK */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-none p-5 max-w-sm w-full space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>تۆمارکردنی دەوام بە پین کۆد (PIN Code)</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">پین کۆدی تایبەتی کارمەند (PIN):</label>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-none text-center font-mono font-black text-lg text-white focus:border-blue-500 outline-none tracking-widest"
                />
              </div>

              {pinError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold text-center">
                  {pinError}
                </div>
              )}

              <button
                type="submit"
                disabled={pinLoading || !pinInput.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-none text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {pinLoading ? 'لە پشکنیندایە...' : 'تۆمارکردنی دەوام'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
