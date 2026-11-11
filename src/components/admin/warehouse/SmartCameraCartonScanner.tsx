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
  Search,
  Check,
  ChevronUp,
  ChevronDown,
  ScanLine,
  Loader2,
  ShieldCheck,
  Pause,
  Play,
} from 'lucide-react';
import { SheetsAuditItem, SheetsAuditSession } from '@/app/api/warehouse/sheets-sync/route';
import { parseCartonLabel } from '@/lib/warehouse-label-parser';

interface SmartCameraCartonScannerProps {
  session: SheetsAuditSession;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSession: (updatedSession: SheetsAuditSession) => Promise<void>;
}

interface VerifiedLabelRecord {
  itemNo: string;
  itemName: string;
  caseQty: number;
  lastCapturedAt: number;
  scanCount: number;
}

// =============================================================================
// 🔊 SOUND, HAPTIC & KURDISH VOICE SYNTHESIZER
// =============================================================================
class WarehouseAudioFeedback {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playLockTick() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  // Crisp metallic chime (E5 -> A5 -> C#6)
  playSuccess() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const freqs = [659.25, 880, 1108.73];
      freqs.forEach((f, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.06);
        gain.gain.setValueAtTime(0.22, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    } catch {}
  }

  // Model Completely Unloaded (Celebratory 4-note chord)
  playComplete() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((f, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        const start = now + i * 0.07;
        gain.gain.setValueAtTime(0.24, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch {}
  }

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
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

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

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.startsWith('ar') || v.lang.startsWith('ku') || v.lang.startsWith('en'));
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }
}

const audio = new WarehouseAudioFeedback();

function vibrateMobile(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

// =============================================================================
// 🪩 BRUSHED METALLIC VERIFICATION RIBBON COMPONENT (شریتی میتاڵی)
// =============================================================================
interface MetallicVerifiedStripProps {
  model: string;
  name?: string;
  caseQty: number;
  checkedQty: number;
  expectedQty: number;
  cartonNumber?: number;
  totalCartons?: number;
  isComplete?: boolean;
  subtitle?: string;
  compact?: boolean;
  sheenKey?: number;
}

function MetallicVerifiedStrip({
  model,
  name,
  caseQty,
  checkedQty,
  expectedQty,
  cartonNumber,
  totalCartons,
  isComplete,
  subtitle,
  compact = false,
  sheenKey,
}: MetallicVerifiedStripProps) {
  return (
    <div
      key={sheenKey}
      className={`relative overflow-hidden rounded-2xl border-2 shadow-[0_12px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.95)] ${
        isComplete
          ? 'border-emerald-300/90'
          : 'border-slate-300/90'
      }`}
      style={{
        background:
          'linear-gradient(125deg, #94a3b8 0%, #e2e8f0 18%, #ffffff 36%, #cbd5e1 52%, #f8fafc 74%, #94a3b8 100%)',
      }}
    >
      {/* Brushed horizontal steel grain texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'repeating-linear-gradient(100deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* One-shot metallic specular sheen sweep on capture */}
      <div
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/75 to-transparent"
        style={{ animation: 'ashleyMetalSheen 950ms cubic-bezier(0.23,1,0.32,1) 1 forwards' }}
      />

      {/* Corner chrome rivets */}
      <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-500/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]" />
      <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-500/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-500/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-500/75 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]" />

      {/* Top Steel Security Band over Name & Count */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 py-1 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/60 text-white">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
              isComplete ? 'bg-emerald-400 text-slate-950' : 'bg-amber-300 text-slate-950'
            }`}
          >
            <Check className="w-2.5 h-2.5 stroke-[3.2]" />
          </span>
          <span className="text-[10px] sm:text-[11px] font-black tracking-wide truncate">
            وەرگیرا • کۆدی تەواو سکانکرا
          </span>
        </div>

        <span className="px-2 py-0.5 rounded-md bg-gradient-to-b from-slate-100 to-slate-300 text-slate-950 text-[10px] font-black font-mono shrink-0 border border-white/80 shadow-2xs">
          ITEM NO + CASE QTY
        </span>
      </div>

      {/* Engraved Name / Model & Quantity Metallic Strip Content */}
      <div className={`relative z-10 ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} text-slate-950`}>
        <div className="flex items-center justify-between gap-2.5">
          {/* Stamped Item Code & Product Name */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-lg bg-slate-900/90 text-white text-xs sm:text-sm font-black font-mono tracking-wider shadow-xs border border-slate-600/60">
                {model}
              </span>
              {isComplete && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black shadow-2xs">
                  تەواو ✅
                </span>
              )}
            </div>
            {name && (
              <p className="text-xs font-black text-slate-900 truncate mt-1 drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
                {name}
              </p>
            )}
          </div>

          {/* Stamped Case Qty / Count Metallic Plate */}
          <div className="shrink-0 flex flex-col items-end">
            <div className="px-2.5 py-1 rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 text-white border border-slate-400/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(0,0,0,0.3)] text-center">
              <span className="block text-[9px] text-slate-300 font-bold leading-none">
                CASE QTY
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-300 leading-tight">
                {caseQty} دانە
              </span>
            </div>
            <span className="text-[10px] font-black font-mono text-slate-800 mt-1">
              کۆ: {checkedQty} / {expectedQty}
              {cartonNumber && totalCartons ? ` • کارتۆن ${cartonNumber}/${totalCartons}` : ''}
            </span>
          </div>
        </div>

        {subtitle && (
          <div className="mt-1.5 pt-1 border-t border-slate-500/30 flex items-center justify-between text-[11px] font-extrabold text-slate-900">
            <span>{subtitle}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 📸 MAIN SMART CAMERA CARTON SCANNER (OCR + BARCODE + METALLIC VERIFICATION)
// =============================================================================
export function SmartCameraCartonScanner({
  session,
  isOpen,
  onClose,
  onUpdateSession,
}: SmartCameraCartonScannerProps) {
  // Refs synced to latest props so background OCR loop never captures stale closures
  const sessionRef = useRef(session);
  const onUpdateSessionRef = useRef(onUpdateSession);
  const voiceEnabledRef = useRef(true);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    onUpdateSessionRef.current = onUpdateSession;
  }, [onUpdateSession]);

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrWorkerRef = useRef<any>(null);
  const ocrBusyRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Sound, Voice & OCR state
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const [ocrReady, setOcrReady] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [isScanningFrame, setIsScanningFrame] = useState(false);

  // Dual-part real-time label lock-on state (`ITEM NO` + `CASE QTY`)
  const partialLockRef = useRef<{
    item: SheetsAuditItem | null;
    itemNo: string | null;
    caseQty: number | null;
    lockedAt: number;
  }>({ item: null, itemNo: null, caseQty: null, lockedAt: 0 });

  const [liveHud, setLiveHud] = useState<{
    lockedItem: SheetsAuditItem | null;
    lockedItemNo: string | null;
    lockedCaseQty: number | null;
    unmatchedCode: string | null;
  }>({
    lockedItem: null,
    lockedItemNo: null,
    lockedCaseQty: null,
    unmatchedCode: null,
  });

  // Track items verified with full Code + Case Qty during this session
  const [verifiedLabelsById, setVerifiedLabelsById] = useState<Record<string, VerifiedLabelRecord>>({});

  // Scanned Banner State
  const [lastScannedResult, setLastScannedResult] = useState<{
    type: 'success' | 'duplicate' | 'completed' | 'unknown';
    model: string;
    name?: string;
    caseQty: number;
    checkedQty: number;
    expectedQty: number;
    cartonNumber: number;
    totalCartons: number;
    remaining: number;
    message: string;
    timestamp: number;
  } | null>(null);

  // Bottom drawer state
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Cooldown guard
  const lastCompletedScanRef = useRef<{ model: string; timestamp: number }>({ model: '', timestamp: 0 });

  // 1. Start / Stop Camera Stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
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
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setTorchEnabled(false);
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, startCamera]);

  // 2. Initialize Persistent Tesseract.js OCR Worker when Scanner Opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    let cancelled = false;

    const initWorker = async () => {
      try {
        setOcrReady(false);
        setOcrError(null);
        const { createWorker, PSM } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, {
          workerPath: '/ocr/worker.min.js',
          workerBlobURL: false,
        });
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        });
        if (cancelled) {
          await worker.terminate();
          return;
        }
        ocrWorkerRef.current = worker;
        setOcrReady(true);
      } catch (err: any) {
        if (!cancelled) {
          setOcrError('خوێندنەوەی نووسین (OCR) بارنەبوو — دەتوانیت مۆدێل و عدد بە دەست بنووسیت.');
        }
      }
    };

    initWorker();

    return () => {
      cancelled = true;
      if (ocrWorkerRef.current) {
        try {
          ocrWorkerRef.current.terminate();
        } catch {}
        ocrWorkerRef.current = null;
      }
      setOcrReady(false);
    };
  }, [isOpen]);

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

  // 3. Record a Verified Complete Carton Scan (`ITEM NO` + `CASE QTY`)
  const recordVerifiedCartonScan = useCallback(
    (matchedItem: SheetsAuditItem, detectedCaseQty: number, explicitCartonNo?: number | null) => {
      const curSession = sessionRef.current;
      const now = Date.now();

      // Re-lookup latest item snapshot inside current session
      const latestItem = curSession.items.find((it) => it.id === matchedItem.id) || matchedItem;

      // Dynamically calibrate pcsPerCarton / cartonCount when imported sheet lacked a Cartons column
      const wasDefaultUnitPerBox =
        (latestItem.pcsPerCarton || 1) === 1 &&
        (latestItem.cartonCount || latestItem.expectedQty) === latestItem.expectedQty &&
        detectedCaseQty > 1 &&
        latestItem.expectedQty >= detectedCaseQty &&
        (latestItem.checkedCartons || 0) === 0;

      const effectivePcsPerCarton = detectedCaseQty > 0 ? detectedCaseQty : latestItem.pcsPerCarton || 1;
      const totalCartons = wasDefaultUnitPerBox
        ? Math.max(1, Math.ceil(latestItem.expectedQty / effectivePcsPerCarton))
        : latestItem.cartonCount || latestItem.expectedQty || 1;

      const currentScannedNumbers = Array.isArray(latestItem.scannedCartonNumbers)
        ? [...latestItem.scannedCartonNumbers]
        : [];

      let targetCartonNumber = explicitCartonNo || null;
      if (!targetCartonNumber || targetCartonNumber < 1 || targetCartonNumber > totalCartons) {
        for (let i = 1; i <= totalCartons; i++) {
          if (!currentScannedNumbers.includes(i)) {
            targetCartonNumber = i;
            break;
          }
        }
        if (!targetCartonNumber) targetCartonNumber = currentScannedNumbers.length + 1;
      }

      if (explicitCartonNo && currentScannedNumbers.includes(targetCartonNumber)) {
        audio.playDuplicate();
        vibrateMobile([60, 40, 60]);
        if (voiceEnabledRef.current) audio.speak(`ئەم کارتۆنە پێشتر لێدراوە: ${targetCartonNumber}`);
        setLastScannedResult({
          type: 'duplicate',
          model: latestItem.model,
          name: latestItem.name,
          caseQty: effectivePcsPerCarton,
          checkedQty: latestItem.checkedQty || 0,
          expectedQty: latestItem.expectedQty,
          cartonNumber: targetCartonNumber,
          totalCartons,
          remaining: Math.max(0, totalCartons - currentScannedNumbers.length),
          message: `⚠️ کارتۆنی ${targetCartonNumber} پێشتر تۆمارکراوە!`,
          timestamp: now,
        });
        return;
      }

      const newScannedNumbers = [...currentScannedNumbers, targetCartonNumber].sort((a, b) => a - b);
      const newCheckedCartons = newScannedNumbers.length;
      const newCheckedQty = (latestItem.checkedQty || 0) + effectivePcsPerCarton;
      const variance = newCheckedQty - latestItem.expectedQty;

      let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
      if (newCheckedQty >= latestItem.expectedQty) {
        auditStatus = variance === 0 ? 'verified' : 'excess';
      } else {
        auditStatus = 'deficit';
      }

      const updatedItems = curSession.items.map((it) => {
        if (it.id === latestItem.id) {
          return {
            ...it,
            cartonCount: totalCartons,
            pcsPerCarton: effectivePcsPerCarton,
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

      const isComplete = newCheckedQty >= latestItem.expectedQty;
      const remainingCartons = Math.max(0, totalCartons - newCheckedCartons);

      lastCompletedScanRef.current = { model: latestItem.model, timestamp: now };
      partialLockRef.current = { item: null, itemNo: null, caseQty: null, lockedAt: 0 };
      setLiveHud({ lockedItem: null, lockedItemNo: null, lockedCaseQty: null, unmatchedCode: null });
      setFocusedItemId(latestItem.id);

      setVerifiedLabelsById((prev) => {
        const existing = prev[latestItem.id];
        return {
          ...prev,
          [latestItem.id]: {
            itemNo: latestItem.model,
            itemName: latestItem.name,
            caseQty: effectivePcsPerCarton,
            lastCapturedAt: now,
            scanCount: (existing?.scanCount || 0) + 1,
          },
        };
      });

      if (isComplete) {
        audio.playComplete();
        vibrateMobile([50, 35, 90]);
        if (voiceEnabledRef.current) audio.speak(`تەواو وەرگیرا: ${latestItem.model}، عدد ${effectivePcsPerCarton}`);
      } else {
        audio.playSuccess();
        vibrateMobile([35, 20, 60]);
        if (voiceEnabledRef.current) audio.speak(`وەرگیرا: ${latestItem.model}، عدد ${effectivePcsPerCarton}`);
      }

      setLastScannedResult({
        type: isComplete ? 'completed' : 'success',
        model: latestItem.model,
        name: latestItem.name,
        caseQty: effectivePcsPerCarton,
        checkedQty: newCheckedQty,
        expectedQty: latestItem.expectedQty,
        cartonNumber: targetCartonNumber,
        totalCartons,
        remaining: remainingCartons,
        message: isComplete
          ? `🎉 تەواو! هەموو ${latestItem.expectedQty} دانە وەرگیرا`
          : `✅ کۆد و عدد وەرگیرا • +${effectivePcsPerCarton} دانە (${remainingCartons} کارتۆن ماوە)`,
        timestamp: now,
      });

      const updatedSession: SheetsAuditSession = {
        ...curSession,
        items: updatedItems,
        totalAuditedUnits: updatedItems.reduce((acc, it) => acc + it.checkedQty, 0),
        totalCartonsCount: updatedItems.reduce((acc, it) => acc + (it.cartonCount || it.expectedQty || 1), 0),
        totalAuditedCartons: updatedItems.reduce((acc, it) => acc + (it.checkedCartons || 0), 0),
        matchedCount: updatedItems.filter((it) => it.auditStatus === 'verified').length,
        discrepantCount: updatedItems.filter((it) => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
        updatedAt: new Date().toISOString(),
      };

      onUpdateSessionRef.current(updatedSession);
    },
    []
  );

  // 4. Preprocess Center Crop from Live Video -> Contrast-Enhanced Canvas for Fast Label OCR
  const captureCroppedLabelCanvas = useCallback((videoEl: HTMLVideoElement): HTMLCanvasElement | null => {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return null;

    // Crop center 78% width x 52% height aligning with the viewfinder target frame
    const cropW = Math.floor(vw * 0.78);
    const cropH = Math.floor(vh * 0.52);
    const cropX = Math.floor((vw - cropW) / 2);
    const cropY = Math.floor((vh - cropH) / 2);

    const targetW = Math.min(820, Math.max(520, cropW));
    const targetH = Math.round((cropH / cropW) * targetW);

    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }
    const canvas = cropCanvasRef.current;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    // Fast grayscale + high-contrast stretch so black carton print pops against brown cardboard
    try {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const contrast = 1.55;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const boosted = Math.max(0, Math.min(255, (lum - 128) * contrast + 128));
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {}

    return canvas;
  }, []);

  // 5. Run Single Hybrid Frame Scan (BarcodeDetector + Tesseract OCR Label Parser + Lock-On Fusion)
  const runHybridFrameScan = useCallback(
    async (isManualShot = false) => {
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.readyState < 2 || ocrBusyRef.current) return;

      const curSession = sessionRef.current;
      if (!curSession || curSession.items.length === 0) return;

      ocrBusyRef.current = true;
      if (isManualShot) setIsScanningFrame(true);

      try {
        let barcodeCandidate: string | null = null;

        // Try native BarcodeDetector first if browser supports it
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'data_matrix'],
            });
            const codes = await detector.detect(videoEl);
            if (codes && codes.length > 0 && codes[0]?.rawValue) {
              barcodeCandidate = String(codes[0].rawValue).trim();
            }
          } catch {}
        }

        // Run Tesseract OCR on cropped label zone
        let ocrText = '';
        if (ocrWorkerRef.current) {
          const canvas = captureCroppedLabelCanvas(videoEl);
          if (canvas) {
            const result = await ocrWorkerRef.current.recognize(canvas);
            ocrText = result?.data?.text || '';
          }
        }

        const parsed = parseCartonLabel(ocrText, curSession.items, barcodeCandidate);
        const now = Date.now();

        // Expire partial half-lock after 4 seconds so two unrelated cartons don't mix
        const prevLock = partialLockRef.current;
        const lockFresh = now - prevLock.lockedAt < 4000;

        let mergedItem = parsed.matchedItem || (lockFresh ? prevLock.item : null);
        let mergedItemNo = parsed.matchedItem?.model || (lockFresh ? prevLock.itemNo : null);
        let mergedCaseQty = parsed.caseQty ?? (lockFresh ? prevLock.caseQty : null);

        // If a *new* itemNo replaces the buffered item, reset old caseQty unless also in this frame
        if (parsed.matchedItem && prevLock.item && parsed.matchedItem.id !== prevLock.item.id && !parsed.caseQty) {
          mergedCaseQty = null;
        }

        // Update partial lock buffer & subtle tick sound on fresh half-lock
        const gainedItem = Boolean(parsed.matchedItem && parsed.matchedItem.id !== prevLock.item?.id);
        const gainedQty = Boolean(parsed.caseQty && parsed.caseQty !== prevLock.caseQty);
        if ((gainedItem || gainedQty) && !(mergedItem && mergedCaseQty)) {
          audio.playLockTick();
        }

        if (parsed.matchedItem || parsed.caseQty) {
          partialLockRef.current = {
            item: mergedItem,
            itemNo: mergedItemNo,
            caseQty: mergedCaseQty,
            lockedAt: now,
          };
        } else if (!lockFresh) {
          partialLockRef.current = { item: null, itemNo: null, caseQty: null, lockedAt: 0 };
        }

        setLiveHud({
          lockedItem: mergedItem,
          lockedItemNo: mergedItemNo,
          lockedCaseQty: mergedCaseQty,
          unmatchedCode: !mergedItem && parsed.itemNo ? parsed.itemNo : null,
        });

        // COMPLETE CAPTURE: BOTH ITEM NO (Code) AND CASE QTY (Count) verified!
        if (mergedItem && mergedCaseQty !== null && mergedCaseQty > 0) {
          const sameModelCooldown =
            lastCompletedScanRef.current.model === mergedItem.model &&
            now - lastCompletedScanRef.current.timestamp < 2600;

          if (!sameModelCooldown || isManualShot) {
            recordVerifiedCartonScan(mergedItem, mergedCaseQty);
          }
        } else if (isManualShot && !mergedItem && (parsed.itemNo || barcodeCandidate)) {
          audio.playError();
          setLastScannedResult({
            type: 'unknown',
            model: (parsed.itemNo || barcodeCandidate || '').slice(0, 22),
            caseQty: parsed.caseQty || 0,
            checkedQty: 0,
            expectedQty: 0,
            cartonNumber: 0,
            totalCartons: 0,
            remaining: 0,
            message: 'ئەم مۆدێلە لە لیستی ئەم بارەدا نییە!',
            timestamp: now,
          });
        }
      } catch {
        // Ignore single frame OCR failure
      } finally {
        ocrBusyRef.current = false;
        if (isManualShot) setIsScanningFrame(false);
      }
    },
    [captureCroppedLabelCanvas, recordVerifiedCartonScan]
  );

  // Continuous background label OCR loop when scanner is open & autoScanEnabled
  useEffect(() => {
    if (!isOpen || !autoScanEnabled) return;

    const timer = setInterval(() => {
      if (!ocrBusyRef.current) {
        runHybridFrameScan(false);
      }
    }, 700);

    return () => clearInterval(timer);
  }, [isOpen, autoScanEnabled, runHybridFrameScan]);

  // Manual Entry Handler (supports "B555-31", "B555-31 * 4", or full OCR text paste)
  const handleManualSubmit = () => {
    const clean = manualInput.trim();
    if (!clean) return;

    const curSession = sessionRef.current;
    // Allow explicit "CODE * QTY" or "CODE x QTY" format from manual entry
    const mulMatch = clean.match(/^(.+?)\s*[*x×]\s*(\d+)$/i);
    let parsedQty: number | null = null;
    let searchSeed = clean;
    if (mulMatch) {
      searchSeed = mulMatch[1].trim();
      parsedQty = parseInt(mulMatch[2], 10);
    }

    const parsed = parseCartonLabel(searchSeed, curSession.items, searchSeed);
    const matched = parsed.matchedItem;
    if (!matched) {
      audio.playError();
      setLastScannedResult({
        type: 'unknown',
        model: clean.slice(0, 22),
        caseQty: 0,
        checkedQty: 0,
        expectedQty: 0,
        cartonNumber: 0,
        totalCartons: 0,
        remaining: 0,
        message: 'ئەم مۆدێلە لە لیستی ئەم شیتەدا نەدۆزرایەوە!',
        timestamp: Date.now(),
      });
      return;
    }

    const finalQty = parsedQty || parsed.caseQty || matched.pcsPerCarton || 1;
    recordVerifiedCartonScan(matched, finalQty);
    setManualInput('');
  };

  // Toggle Individual Carton Number Manually (Badges 1, 2, 3...)
  const handleToggleCartonManual = (itemId: string, cartonNum: number) => {
    const item = session.items.find((it) => it.id === itemId);
    if (!item) return;

    const totalCartons = item.cartonCount || item.expectedQty || 1;
    let currentScanned = Array.isArray(item.scannedCartonNumbers) ? [...item.scannedCartonNumbers] : [];

    if (currentScanned.includes(cartonNum)) {
      currentScanned = currentScanned.filter((n) => n !== cartonNum);
      audio.playDuplicate();
    } else {
      currentScanned = [...currentScanned, cartonNum].sort((a, b) => a - b);
      if (currentScanned.length >= totalCartons) audio.playComplete();
      else audio.playSuccess();
    }

    const effectivePcs = item.pcsPerCarton || 1;
    const newCheckedCartons = currentScanned.length;
    const newCheckedQty = newCheckedCartons * effectivePcs;
    const variance = newCheckedQty - item.expectedQty;

    let auditStatus: SheetsAuditItem['auditStatus'] = 'pending';
    if (newCheckedQty >= item.expectedQty) {
      auditStatus = variance === 0 ? 'verified' : 'excess';
    } else {
      auditStatus = newCheckedCartons > 0 ? 'deficit' : 'pending';
    }

    const updatedItems = session.items.map((it) => {
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

    const isComplete = newCheckedQty >= item.expectedQty;
    const remaining = Math.max(0, totalCartons - newCheckedCartons);

    setLastScannedResult({
      type: isComplete ? 'completed' : 'success',
      model: item.model,
      name: item.name,
      caseQty: effectivePcs,
      checkedQty: newCheckedQty,
      expectedQty: item.expectedQty,
      cartonNumber: cartonNum,
      totalCartons,
      remaining,
      message: isComplete
        ? `🎉 تەواوبوو! هەموو ${item.expectedQty} دانە تۆمارکرا!`
        : `کارتۆنی ${cartonNum} لە ${totalCartons} • ${remaining} ماوە`,
      timestamp: Date.now(),
    });

    const updatedSession: SheetsAuditSession = {
      ...session,
      items: updatedItems,
      totalAuditedUnits: updatedItems.reduce((acc, it) => acc + it.checkedQty, 0),
      totalAuditedCartons: updatedItems.reduce((acc, it) => acc + (it.checkedCartons || 0), 0),
      matchedCount: updatedItems.filter((it) => it.auditStatus === 'verified').length,
      discrepantCount: updatedItems.filter((it) => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
      updatedAt: new Date().toISOString(),
    };

    onUpdateSession(updatedSession);
  };

  if (!isOpen) return null;

  const focusedItem = session.items.find((it) => it.id === focusedItemId) || session.items[0];
  const focusedTotalCartons = focusedItem?.cartonCount || focusedItem?.expectedQty || 1;
  const focusedScannedList = focusedItem?.scannedCartonNumbers || [];
  const focusedVerifiedMeta = focusedItem ? verifiedLabelsById[focusedItem.id] : undefined;
  const isFocusedVerifiedByScan = Boolean(
    focusedItem && (focusedVerifiedMeta || (focusedItem.checkedQty > 0 && focusedItem.scannedCartonNumbers?.length))
  );

  const filteredItems = session.items.filter(
    (it) =>
      it.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSessionCartons =
    session.totalCartonsCount ||
    session.items.reduce((acc, it) => acc + (it.cartonCount || it.expectedQty || 1), 0);
  const totalSessionAuditedCartons = session.items.reduce(
    (acc, it) => acc + (it.checkedCartons || it.scannedCartonNumbers?.length || 0),
    0
  );
  const overallPercentage =
    totalSessionCartons > 0 ? Math.round((totalSessionAuditedCartons / totalSessionCartons) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 h-[100dvh] bg-black flex flex-col font-sans select-none [-webkit-tap-highlight-color:transparent]"
      dir="rtl"
    >
      {/* ===================================================================== */}
      {/* 🔝 TOP CONTROLS BAR (Safe-area aware) */}
      {/* ===================================================================== */}
      <div className="relative z-20 flex items-center justify-between px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/95 via-black/75 to-transparent text-white">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation"
          title="داخستن"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15">
            <Package className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black font-mono">
              {totalSessionAuditedCartons} / {totalSessionCartons} کارتۆن ({overallPercentage}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                ocrReady ? 'bg-emerald-400' : ocrError ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-slate-300">
              {ocrReady ? 'خوێندنەوەی ITEM NO + CASE QTY چالاکە' : ocrError ? 'تەنها باڕکۆد / دەست' : 'چالاککردنی خوێنەری کارتۆن...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Auto/Pause OCR */}
          <button
            type="button"
            onClick={() => setAutoScanEnabled((prev) => !prev)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation ${
              autoScanEnabled ? 'bg-emerald-600 text-white' : 'bg-white/15 text-slate-300'
            }`}
            title={autoScanEnabled ? 'سکانی خۆکار چالاکە' : 'سکانی خۆکار وەستێنراوە'}
          >
            {autoScanEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Voice Toggle */}
          <button
            type="button"
            onClick={() => setVoiceEnabled((prev) => !prev)}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation ${
              voiceEnabled ? 'bg-blue-600 text-white' : 'bg-white/15 text-slate-400'
            }`}
            title={voiceEnabled ? 'دەنگ چالاکە' : 'دەنگ بێدەنگە'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Torch Toggle */}
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation ${
                torchEnabled ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/50' : 'bg-white/15 text-white'
              }`}
              title="تۆڕچ / ڕووناکی"
            >
              {torchEnabled ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Switch Camera */}
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation"
            title="گۆڕینی کامێرا"
          >
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 📹 CAMERA VIEWFINDER + LIVE ITEM NO / CASE QTY LOCK-ON HUD */}
      {/* ===================================================================== */}
      <div className="relative flex-1 bg-black flex flex-col items-center justify-center overflow-hidden px-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Target Carton Label Reticle */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="w-full h-44 sm:h-52 rounded-3xl border-2 border-white/60 bg-black/15 shadow-2xl flex flex-col justify-between p-3 pointer-events-none">
            {/* Corner Guides + Top Hint */}
            <div className="flex items-start justify-between">
              <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <span className="px-2.5 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-black text-amber-300 border border-amber-400/30 font-mono">
                ITEM NO + CASE QTY لێرە بگرە
              </span>
              <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            </div>

            {/* Laser Sweep Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse shadow-lg shadow-amber-400/80" />

            {/* Dual Live Lock-On Readout Inside Frame */}
            <div className="flex items-end justify-between gap-2">
              <div className="w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg shrink-0" />

              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <div
                  className={`px-2 py-1 rounded-xl border text-center backdrop-blur-md transition-colors ${
                    liveHud.lockedItemNo
                      ? 'bg-emerald-500/85 border-emerald-200 text-slate-950 font-black'
                      : 'bg-black/65 border-white/25 text-slate-300 font-bold'
                  }`}
                >
                  <span className="block text-[9px] uppercase opacity-80 font-mono">ITEM NO</span>
                  <span className="text-[11px] font-mono truncate block">
                    {liveHud.lockedItemNo ? `✓ ${liveHud.lockedItemNo}` : 'دەگەڕێ...'}
                  </span>
                </div>

                <div
                  className={`px-2 py-1 rounded-xl border text-center backdrop-blur-md transition-colors ${
                    liveHud.lockedCaseQty
                      ? 'bg-emerald-500/85 border-emerald-200 text-slate-950 font-black'
                      : 'bg-black/65 border-white/25 text-slate-300 font-bold'
                  }`}
                >
                  <span className="block text-[9px] uppercase opacity-80 font-mono">CASE QTY</span>
                  <span className="text-[11px] font-mono truncate block">
                    {liveHud.lockedCaseQty ? `✓ ${liveHud.lockedCaseQty} دانە` : 'ژمارە...'}
                  </span>
                </div>
              </div>

              <div className="w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg shrink-0" />
            </div>
          </div>

          {/* Manual Instant Capture Button + Partial Fallback */}
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => runHybridFrameScan(true)}
              disabled={isScanningFrame}
              className="h-9 px-4 rounded-full bg-white/90 hover:bg-white text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer touch-manipulation disabled:opacity-60"
            >
              {isScanningFrame ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <ScanLine className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>{isScanningFrame ? 'دەخوێندرێتەوە...' : 'پشکنینی دەستبەجێ'}</span>
            </button>

            {liveHud.lockedItem && !liveHud.lockedCaseQty && (
              <button
                type="button"
                onClick={() =>
                  recordVerifiedCartonScan(liveHud.lockedItem!, liveHud.lockedItem!.pcsPerCarton || 1)
                }
                className="h-9 px-3.5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-lg active:scale-95 transition-transform cursor-pointer touch-manipulation"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>
                  وەرگرتنی {liveHud.lockedItem.model} ({liveHud.lockedItem.pcsPerCarton || 1} دانە)
                </span>
              </button>
            )}
          </div>

          {liveHud.unmatchedCode && !lastScannedResult && (
            <div className="mt-2 px-3 py-1 rounded-full bg-rose-950/85 border border-rose-400/50 text-rose-200 text-[10px] font-bold text-center backdrop-blur-md">
              کۆدی «{liveHud.unmatchedCode}» خوێندرایەوە بەڵام لەم شیتەدا نییە
            </div>
          )}
        </div>

        {/* Floating Capture Result Banner (Uses Brushed Metallic Strip when Verified!) */}
        {lastScannedResult && (
          <div className="absolute top-3 left-3 right-3 z-20 animate-in slide-in-from-top-3 duration-200">
            {lastScannedResult.type === 'success' || lastScannedResult.type === 'completed' ? (
              <MetallicVerifiedStrip
                sheenKey={lastScannedResult.timestamp}
                model={lastScannedResult.model}
                name={lastScannedResult.name}
                caseQty={lastScannedResult.caseQty}
                checkedQty={lastScannedResult.checkedQty}
                expectedQty={lastScannedResult.expectedQty}
                cartonNumber={lastScannedResult.cartonNumber}
                totalCartons={lastScannedResult.totalCartons}
                isComplete={lastScannedResult.type === 'completed'}
                subtitle={lastScannedResult.message}
              />
            ) : (
              <div
                className={`p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-center justify-between gap-2 ${
                  lastScannedResult.type === 'duplicate'
                    ? 'bg-amber-500/95 border-amber-300 text-slate-950 font-black'
                    : 'bg-rose-600/95 border-rose-400 text-white'
                }`}
              >
                <div>
                  <span className="text-xs font-black font-mono block">{lastScannedResult.model}</span>
                  <span className="text-xs font-bold block mt-0.5">{lastScannedResult.message}</span>
                </div>
                <AlertTriangle className="w-5 h-5 shrink-0" />
              </div>
            )}
          </div>
        )}

        {/* Camera Permission / Error Overlay */}
        {cameraError && (
          <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center text-white">
            <Camera className="w-12 h-12 text-rose-500 mb-3" />
            <p className="text-xs font-bold text-rose-300 mb-4">{cameraError}</p>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs active:scale-95 transition-transform"
            >
              دووبارە هەوڵبدەرەوە
            </button>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 📦 BOTTOM VERIFIED METALLIC HEADER & CARTON MATRIX DRAWER */}
      {/* ===================================================================== */}
      <div className="relative z-20 bg-slate-900 border-t border-slate-800 px-4 pt-3.5 pb-[max(0.9rem,env(safe-area-inset-bottom))] text-white rounded-t-3xl shadow-2xl">
        {focusedItem ? (
          <div className="space-y-3">
            {/* If Item Verified via Full Code + Qty Scan, Show Gleaming Metallic Ribbon Across Name & Count */}
            {isFocusedVerifiedByScan ? (
              <div className="space-y-2">
                <MetallicVerifiedStrip
                  compact
                  sheenKey={focusedVerifiedMeta?.lastCapturedAt}
                  model={focusedItem.model}
                  name={focusedItem.name}
                  caseQty={focusedVerifiedMeta?.caseQty || focusedItem.pcsPerCarton || 1}
                  checkedQty={focusedItem.checkedQty}
                  expectedQty={focusedItem.expectedQty}
                  isComplete={focusedItem.checkedQty >= focusedItem.expectedQty}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowItemDrawer((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform touch-manipulation"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>هەموو کاڵاکان ({session.items.length})</span>
                    {showItemDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-mono font-black text-xs shrink-0">
                    {focusedItem.model.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-black font-mono text-white truncate">
                        {focusedItem.model}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-bold font-mono shrink-0">
                        {focusedItem.checkedQty} / {focusedItem.expectedQty} دانە
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium truncate">
                      {focusedItem.name}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowItemDrawer((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform touch-manipulation shrink-0"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>هەموو کاڵاکان</span>
                  {showItemDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {/* Carton Badges Matrix (Tap 1, 2, 3...) */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold mb-1.5">
                <span>ژمارەی کارتۆنەکان ({focusedScannedList.length} / {focusedTotalCartons}):</span>
                <span className="text-amber-400 font-mono">
                  {Math.max(0, focusedTotalCartons - focusedScannedList.length)} ماوە
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-slate-950/60 rounded-2xl border border-slate-800">
                {Array.from({ length: Math.min(focusedTotalCartons, 50) }, (_, i) => i + 1).map((cNum) => {
                  const isScanned = focusedScannedList.includes(cNum);
                  return (
                    <button
                      key={cNum}
                      type="button"
                      onClick={() => handleToggleCartonManual(focusedItem.id, cNum)}
                      className={`min-w-8 h-8 px-2 rounded-xl text-xs font-black font-mono transition-transform flex items-center justify-center gap-1 cursor-pointer active:scale-90 touch-manipulation ${
                        isScanned
                          ? 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-950 border border-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                      title={`کارتۆنی ${cNum}`}
                    >
                      {isScanned && <Check className="w-3 h-3 stroke-[3] text-emerald-700" />}
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

        {/* Quick Manual Model + Qty Bar (16px font stops iOS Safari zoom!) */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            enterKeyHint="done"
            placeholder="نموونە: B555-31 * 4"
            className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-[16px] sm:text-xs font-mono font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500"
            dir="ltr"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit();
            }}
          />
          <button
            type="button"
            onClick={handleManualSubmit}
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer active:scale-95 transition-transform shadow-md touch-manipulation shrink-0"
          >
            تۆمار
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 📋 EXPANDABLE ALL ITEMS DRAWER (With Metallic Strip on Verified Rows) */}
      {/* ===================================================================== */}
      {showItemDrawer && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>هەموو کاڵاکانی ناو بارەکە ({session.items.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowItemDrawer(false)}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="گەڕان بەپێی مۆدێل یان ناو..."
              className="w-full h-10 pr-9 pl-3 rounded-xl bg-slate-900 border border-slate-800 text-[16px] sm:text-xs font-bold text-white outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pb-6">
            {filteredItems.map((item) => {
              const verifiedMeta = verifiedLabelsById[item.id];
              const hasFullVerification = Boolean(
                verifiedMeta || (item.checkedQty > 0 && item.scannedCartonNumbers?.length)
              );

              if (hasFullVerification) {
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setFocusedItemId(item.id);
                      setShowItemDrawer(false);
                    }}
                    className="cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <MetallicVerifiedStrip
                      compact
                      model={item.model}
                      name={item.name}
                      caseQty={verifiedMeta?.caseQty || item.pcsPerCarton || 1}
                      checkedQty={item.checkedQty}
                      expectedQty={item.expectedQty}
                      isComplete={item.checkedQty >= item.expectedQty}
                    />
                  </div>
                );
              }

              const itemTotal = item.cartonCount || item.expectedQty || 1;
              const itemScanned = item.scannedCartonNumbers?.length || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setFocusedItemId(item.id);
                    setShowItemDrawer(false);
                  }}
                  className={`p-3 rounded-2xl border transition-transform cursor-pointer flex items-center justify-between active:scale-[0.98] ${
                    focusedItemId === item.id
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-white">{item.model}</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold">
                        {Math.max(0, itemTotal - itemScanned)} ماوە
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[210px] mt-0.5">
                      {item.name}
                    </p>
                  </div>

                  <div className="text-left font-mono shrink-0">
                    <span className="text-xs font-black text-white">
                      {item.checkedQty} / {item.expectedQty}
                    </span>
                    <span className="block text-[10px] text-slate-400">دانە</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metallic Sheen Sweep Keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ashleyMetalSheen {
          0% { transform: translateX(-140%) skewX(-20deg); opacity: 0.9; }
          100% { transform: translateX(340%) skewX(-20deg); opacity: 0; }
        }
      `}} />
    </div>
  );
}
