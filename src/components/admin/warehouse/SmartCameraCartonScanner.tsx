'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  SwitchCamera, 
  Zap, 
  ZapOff, 
  Volume2, 
  VolumeX, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Sparkles, 
  Layers, 
  RotateCcw,
  Search,
  Plus,
  Minus,
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { SheetsAuditItem, SheetsAuditSession } from '@/app/api/warehouse/sheets-sync/route';

interface SmartCameraCartonScannerProps {
  session: SheetsAuditSession;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSession: (updatedSession: SheetsAuditSession) => Promise<void>;
}

// =============================================================================
// 🔊 SOUND & KURDISH VOICE SYNTHESIZER
// =============================================================================
class WarehouseAudioFeedback {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  // Success Chime (Two ascending pleasant tones: E5 -> A5)
  playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  // Model Completely Unloaded (Celebratory 4-note chord)
  playComplete() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        const start = now + i * 0.08;
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {}
  }

  // Duplicate Warning (Double buzz: 300Hz -> 250Hz)
  playDuplicate() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(260, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch {}
  }

  // Error Buzz (Low 180Hz square)
  playError() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 180;
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  // Kurdish Voice Synthesizer
  speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith('ar') || v.lang.startsWith('ku') || v.lang.startsWith('en'));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }
}

const audio = new WarehouseAudioFeedback();

export function SmartCameraCartonScanner({
  session,
  isOpen,
  onClose,
  onUpdateSession,
}: SmartCameraCartonScannerProps) {
  // Video Stream State
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Sound & Voice Settings
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Active Scanned Feedback State
  const [lastScannedResult, setLastScannedResult] = useState<{
    type: 'success' | 'duplicate' | 'completed' | 'unknown';
    model: string;
    name?: string;
    cartonNumber: number;
    totalCartons: number;
    remaining: number;
    message: string;
    timestamp: number;
  } | null>(null);

  // Active Selected Item for Focus
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDrawer, setShowItemDrawer] = useState(false);

  // Scanner Throttle
  const isScanningRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  // 1. Start / Stop Camera Stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: mode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Check if torch is supported
      const track = stream?.getVideoTracks()[0];
      const capabilities = (track as any)?.getCapabilities?.();
      setHasTorch(Boolean(capabilities?.torch));
    } catch (err: any) {
      setCameraError('نەتوانرا کامێرا بکرێتەوە: ' + (err.message || 'تکایە لە وێبگەڕ ڕێگە بە کامێرا بدە'));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, startCamera]);

  // 2. Toggle Torch (Flashlight inside dark container)
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const next = !torchEnabled;
        await (track as any).applyConstraints({ advanced: [{ torch: next }] });
        setTorchEnabled(next);
      } catch {}
    }
  };

  // 3. Scan & Process Carton Logic
  const processScannedInput = useCallback((rawInput: string) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1200) return; // Prevent duplicate reads within 1.2s

    const clean = rawInput.trim();
    if (!clean) return;

    // A. Parse Carton Number from input (e.g., "2/8", "2 of 8", "BOX-2", "CTN: 2", "-02-")
    let detectedCartonNo: number | null = null;
    let detectedTotalCartons: number | null = null;

    const fractionMatch = clean.match(/(\d+)\s*(?:\/|of|لە)\s*(\d+)/i);
    if (fractionMatch) {
      detectedCartonNo = parseInt(fractionMatch[1], 10);
      detectedTotalCartons = parseInt(fractionMatch[2], 10);
    } else {
      const ctnMatch = clean.match(/(?:ctn|carton|box|پاکەت|کارتۆن|no|#)[.:\s-]*(\d+)/i);
      if (ctnMatch) {
        detectedCartonNo = parseInt(ctnMatch[1], 10);
      }
    }

    // B. Match Model against session items
    const normalizedInput = clean.toLowerCase();
    const matchedItem = session.items.find(item => {
      const m = item.model.toLowerCase();
      return normalizedInput.includes(m) || m.includes(normalizedInput);
    });

    if (!matchedItem) {
      lastScanTimeRef.current = now;
      audio.playError();
      if (voiceEnabled) audio.speak('کاڵای نەناسراو');
      setLastScannedResult({
        type: 'unknown',
        model: clean.slice(0, 20),
        cartonNumber: 0,
        totalCartons: 0,
        remaining: 0,
        message: 'ئەم مۆدێلە لە لیستی ئەم بارەدا نییە!',
        timestamp: now,
      });
      return;
    }

    // Update Focused Item
    setFocusedItemId(matchedItem.id);

    const totalCartons = matchedItem.cartonCount || matchedItem.expectedQty || 1;
    const currentScannedNumbers = Array.isArray(matchedItem.scannedCartonNumbers) ? [...matchedItem.scannedCartonNumbers] : [];

    // If no carton number detected, automatically take the next available un-scanned carton number
    let targetCartonNumber = detectedCartonNo;
    if (!targetCartonNumber || targetCartonNumber < 1 || targetCartonNumber > totalCartons) {
      for (let i = 1; i <= totalCartons; i++) {
        if (!currentScannedNumbers.includes(i)) {
          targetCartonNumber = i;
          break;
        }
      }
      if (!targetCartonNumber) targetCartonNumber = currentScannedNumbers.length + 1;
    }

    // Check for duplicate carton scan
    if (currentScannedNumbers.includes(targetCartonNumber)) {
      lastScanTimeRef.current = now;
      audio.playDuplicate();
      if (voiceEnabled) audio.speak(`ئەم کارتۆنە پێشتر لێدراوە: کارتۆنی ${targetCartonNumber}`);
      setLastScannedResult({
        type: 'duplicate',
        model: matchedItem.model,
        name: matchedItem.name,
        cartonNumber: targetCartonNumber,
        totalCartons,
        remaining: Math.max(0, totalCartons - currentScannedNumbers.length),
        message: `⚠️ کارتۆنی ${targetCartonNumber} پێشتر ژمێردراوە!`,
        timestamp: now,
      });
      return;
    }

    // Record the new carton!
    lastScanTimeRef.current = now;
    const newScannedNumbers = [...currentScannedNumbers, targetCartonNumber].sort((a, b) => a - b);
    const newCheckedCartons = newScannedNumbers.length;
    const newCheckedQty = newCheckedCartons * (matchedItem.pcsPerCarton || 1);
    const variance = newCheckedQty - matchedItem.expectedQty;

    let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
    if (newCheckedCartons >= totalCartons) {
      auditStatus = variance === 0 ? 'verified' : variance > 0 ? 'excess' : 'deficit';
    } else {
      auditStatus = 'deficit';
    }

    const updatedItems = session.items.map(it => {
      if (it.id === matchedItem.id) {
        return {
          ...it,
          checkedCartons: newCheckedCartons,
          scannedCartonNumbers: newScannedNumbers,
          checkedQty: newCheckedQty,
          variance,
          auditStatus,
          lastAuditedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    const isComplete = newCheckedCartons >= totalCartons;
    const remainingCartons = Math.max(0, totalCartons - newCheckedCartons);

    if (isComplete) {
      audio.playComplete();
      if (voiceEnabled) audio.speak(`پیرۆزە! هەموو ${totalCartons} کارتۆنی ${matchedItem.model} تەواوبوو`);
    } else {
      audio.playSuccess();
      if (voiceEnabled) audio.speak(`تۆمارکرا: ${targetCartonNumber} لە ${totalCartons}. ${remainingCartons} ماوە`);
    }

    setLastScannedResult({
      type: isComplete ? 'completed' : 'success',
      model: matchedItem.model,
      name: matchedItem.name,
      cartonNumber: targetCartonNumber,
      totalCartons,
      remaining: remainingCartons,
      message: isComplete 
        ? `🎉 پڕکراوە! هەموو ${totalCartons} کارتۆن تەواو بوو!`
        : `✅ تۆمارکرا: کارتۆنی ${targetCartonNumber} لە ${totalCartons} • ${remainingCartons} ماوە`,
      timestamp: now,
    });

    // Update parent session and persist
    const updatedSession: SheetsAuditSession = {
      ...session,
      items: updatedItems,
      totalAuditedUnits: updatedItems.reduce((acc, it) => acc + it.checkedQty, 0),
      totalAuditedCartons: updatedItems.reduce((acc, it) => acc + (it.checkedCartons || 0), 0),
      matchedCount: updatedItems.filter(it => it.auditStatus === 'verified').length,
      discrepantCount: updatedItems.filter(it => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
      updatedAt: new Date().toISOString(),
    };

    onUpdateSession(updatedSession);

  }, [session, voiceEnabled, onUpdateSession]);

  // 4. Continuous Barcode Scanning Loop
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    let animationFrameId: number;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix'],
        });
      } catch {}
    }

    const scanFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === 4 && detector && !isScanningRef.current) {
        try {
          isScanningRef.current = true;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              processScannedInput(rawValue);
            }
          }
        } catch {}
        finally {
          isScanningRef.current = false;
        }
      }
      animationFrameId = requestAnimationFrame(scanFrame);
    };

    animationFrameId = requestAnimationFrame(scanFrame);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, processScannedInput]);

  // 5. Toggle Individual Carton Number Manually (Click on Badge 1, 2, 3...)
  const handleToggleCartonManual = (itemId: string, cartonNum: number) => {
    const item = session.items.find(it => it.id === itemId);
    if (!item) return;

    const totalCartons = item.cartonCount || item.expectedQty || 1;
    let currentScanned = Array.isArray(item.scannedCartonNumbers) ? [...item.scannedCartonNumbers] : [];

    if (currentScanned.includes(cartonNum)) {
      // Remove carton
      currentScanned = currentScanned.filter(n => n !== cartonNum);
      audio.playDuplicate();
    } else {
      // Add carton
      currentScanned = [...currentScanned, cartonNum].sort((a, b) => a - b);
      if (currentScanned.length >= totalCartons) audio.playComplete();
      else audio.playSuccess();
    }

    const newCheckedCartons = currentScanned.length;
    const newCheckedQty = newCheckedCartons * (item.pcsPerCarton || 1);
    const variance = newCheckedQty - item.expectedQty;

    let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
    if (newCheckedCartons >= totalCartons) {
      auditStatus = variance === 0 ? 'verified' : variance > 0 ? 'excess' : 'deficit';
    } else {
      auditStatus = newCheckedCartons > 0 ? 'deficit' : 'pending';
    }

    const updatedItems = session.items.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          checkedCartons: newCheckedCartons,
          scannedCartonNumbers: currentScanned,
          checkedQty: newCheckedQty,
          variance,
          auditStatus,
          lastAuditedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    const isComplete = newCheckedCartons >= totalCartons;
    const remaining = Math.max(0, totalCartons - newCheckedCartons);

    setLastScannedResult({
      type: isComplete ? 'completed' : 'success',
      model: item.model,
      name: item.name,
      cartonNumber: cartonNum,
      totalCartons,
      remaining,
      message: isComplete
        ? `🎉 تەواوبوو! هەموو ${totalCartons} کارتۆن تۆمارکرا!`
        : `کارتۆنی ${cartonNum} لە ${totalCartons} • ${remaining} ماوە`,
      timestamp: Date.now(),
    });

    const updatedSession: SheetsAuditSession = {
      ...session,
      items: updatedItems,
      totalAuditedUnits: updatedItems.reduce((acc, it) => acc + it.checkedQty, 0),
      totalAuditedCartons: updatedItems.reduce((acc, it) => acc + (it.checkedCartons || 0), 0),
      matchedCount: updatedItems.filter(it => it.auditStatus === 'verified').length,
      discrepantCount: updatedItems.filter(it => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
      updatedAt: new Date().toISOString(),
    };

    onUpdateSession(updatedSession);
  };

  if (!isOpen) return null;

  // Active focused item details
  const focusedItem = session.items.find(it => it.id === focusedItemId) || session.items[0];
  const focusedTotalCartons = focusedItem?.cartonCount || focusedItem?.expectedQty || 1;
  const focusedScannedList = focusedItem?.scannedCartonNumbers || [];

  // Filter items for drawer
  const filteredItems = session.items.filter(it => 
    it.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
    it.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Overall session cartons progress
  const totalSessionCartons = session.totalCartonsCount || session.items.reduce((acc, it) => acc + (it.cartonCount || it.expectedQty || 1), 0);
  const totalSessionAuditedCartons = session.items.reduce((acc, it) => acc + (it.checkedCartons || (it.scannedCartonNumbers?.length || 0)), 0);
  const overallPercentage = totalSessionCartons > 0 ? Math.round((totalSessionAuditedCartons / totalSessionCartons) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans select-none" dir="rtl">
      
      {/* ===================================================================== */}
      {/* 🔝 TOP CONTROLS BAR (Mobile optimized) */}
      {/* ===================================================================== */}
      <div className="relative z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent text-white">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          title="داخستن"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Overall Unloading Progress Pill */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black font-mono">
              {totalSessionAuditedCartons} / {totalSessionCartons} کارتۆن ({overallPercentage}%)
            </span>
          </div>
        </div>

        {/* Camera Tools (Torch, Flip, Voice) */}
        <div className="flex items-center gap-2">
          {/* Voice Toggle */}
          <button
            type="button"
            onClick={() => setVoiceEnabled(prev => !prev)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
              voiceEnabled ? 'bg-blue-600 text-white' : 'bg-white/15 text-slate-400'
            }`}
            title={voiceEnabled ? 'دەنگ چالاکە' : 'دەنگ بێدەنگە'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Torch Toggle (Flashlight) */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer ${
                torchEnabled ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/50' : 'bg-white/15 text-white'
              }`}
              title="تۆڕچ / پڕۆژێکتۆر"
            >
              {torchEnabled ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Switch Camera */}
          <button
            type="button"
            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
            className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all cursor-pointer"
            title="گۆڕینی کامێرا"
          >
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 📹 CAMERA VIEWFINDER & TARGET OVERLAY */}
      {/* ===================================================================== */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Viewfinder Target Frame */}
        <div className="relative z-10 w-72 h-48 sm:w-88 sm:h-56 rounded-3xl border-2 border-white/50 shadow-2xl flex flex-col justify-between p-3 pointer-events-none">
          {/* Corner Guides */}
          <div className="flex justify-between">
            <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
          </div>

          {/* Animated Laser Scan Line */}
          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse shadow-lg shadow-amber-400/80" />

          <div className="flex justify-between">
            <div className="w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
            <div className="w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
          </div>
        </div>

        {/* Scanned Feedback Notification Card (Float Above Video) */}
        {lastScannedResult && (
          <div 
            className={`absolute top-4 left-4 right-4 z-20 p-4 rounded-3xl backdrop-blur-xl border shadow-2xl animate-in slide-in-from-top-4 duration-200 ${
              lastScannedResult.type === 'completed'
                ? 'bg-emerald-600/95 border-emerald-400 text-white'
                : lastScannedResult.type === 'success'
                ? 'bg-blue-600/95 border-blue-400 text-white'
                : lastScannedResult.type === 'duplicate'
                ? 'bg-amber-500/95 border-amber-300 text-slate-950 font-black'
                : 'bg-rose-600/95 border-rose-400 text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-wide font-mono">
                    {lastScannedResult.model}
                  </span>
                  {lastScannedResult.name && (
                    <span className="text-xs opacity-90 truncate max-w-[180px]">
                      • {lastScannedResult.name}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold mt-1">
                  {lastScannedResult.message}
                </div>
              </div>

              {lastScannedResult.type === 'completed' ? (
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black">
                  <Sparkles className="w-6 h-6 text-amber-300 animate-spin" />
                </div>
              ) : lastScannedResult.type === 'duplicate' ? (
                <div className="w-10 h-10 rounded-2xl bg-black/15 flex items-center justify-center font-black">
                  <AlertTriangle className="w-6 h-6 text-slate-950" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              )}
            </div>

            {/* Quick Progress Bar for Scanned Model */}
            {lastScannedResult.totalCartons > 0 && (
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full bg-white transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, (lastScannedResult.cartonNumber / lastScannedResult.totalCartons) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center text-white">
            <Camera className="w-12 h-12 text-rose-500 mb-3" />
            <p className="text-xs font-bold text-rose-300 mb-4">{cameraError}</p>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
            >
              دووبارە هەوڵبدەرەوە
            </button>
          </div>
        )}

      </div>

      {/* ===================================================================== */}
      {/* 📦 BOTTOM CARTON MATRIX & MANUAL CONTROL DRAWER */}
      {/* ===================================================================== */}
      <div className="relative z-20 bg-slate-900 border-t border-slate-800 p-4 text-white rounded-t-3xl shadow-2xl">
        
        {/* Focused Item Header */}
        {focusedItem ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-mono font-black text-xs">
                  {focusedItem.model.slice(0, 3)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black font-mono text-white">
                      {focusedItem.model}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold font-mono">
                      {focusedScannedList.length} / {focusedTotalCartons} کارتۆن
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">
                    {focusedItem.name}
                  </p>
                </div>
              </div>

              {/* Item Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowItemDrawer(prev => !prev)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>هەموو کاڵاکان</span>
                {showItemDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Carton Badges Matrix (Tap 1, 2, 3... to toggle) */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-1.5">
                <span>ژمارەی کارتۆنەکانی ئەم مۆدێلە (کلیک لە ژمارەکە بکە):</span>
                <span className="text-amber-400 font-mono">
                  {Math.max(0, focusedTotalCartons - focusedScannedList.length)} ماوە
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                {Array.from({ length: Math.min(focusedTotalCartons, 50) }, (_, i) => i + 1).map(cNum => {
                  const isScanned = focusedScannedList.includes(cNum);
                  return (
                    <button
                      key={cNum}
                      type="button"
                      onClick={() => handleToggleCartonManual(focusedItem.id, cNum)}
                      className={`min-w-9 h-9 px-2 rounded-xl text-xs font-black font-mono transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-90 ${
                        isScanned
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                      title={`کارتۆنی ${cNum}`}
                    >
                      {isScanned && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{cNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="text-center py-4 text-xs text-slate-400">
            هیچ کاڵایەک لەم سێشنەدا نییە.
          </div>
        )}

        {/* Quick Manual Model / Barcode Input Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            placeholder="مۆدێل بنووسە یان لێبدە (بۆ نموونە KB-901 یان 2/8)..."
            className="flex-1 h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                processScannedInput((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
              if (input && input.value) {
                processScannedInput(input.value);
                input.value = '';
              }
            }}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer active:scale-95 shadow-md"
          >
            تۆمار
          </button>
        </div>

      </div>

      {/* ===================================================================== */}
      {/* 📋 EXPANDABLE ALL ITEMS DRAWER */}
      {/* ===================================================================== */}
      {showItemDrawer && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>هەموو کاڵاکانی ناو بارەکە ({session.items.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowItemDrawer(false)}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="گەڕان بەپێی مۆدێل یان ناو..."
              className="w-full h-10 pr-9 pl-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredItems.map(item => {
              const itemTotal = item.cartonCount || item.expectedQty || 1;
              const itemScanned = item.scannedCartonNumbers?.length || 0;
              const isDone = itemScanned >= itemTotal;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setFocusedItemId(item.id);
                    setShowItemDrawer(false);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    focusedItemId === item.id
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-white">{item.model}</span>
                      {isDone ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold">
                          تەواوبوو ✅
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold">
                          {itemTotal - itemScanned} ماوە
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                      {item.name}
                    </p>
                  </div>

                  <div className="text-left font-mono">
                    <span className="text-xs font-black text-white">
                      {itemScanned} / {itemTotal}
                    </span>
                    <span className="block text-[10px] text-slate-400">کارتۆن</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
