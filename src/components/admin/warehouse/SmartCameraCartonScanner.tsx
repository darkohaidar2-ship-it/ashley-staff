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
  AlertTriangle,
  Package,
  Layers,
  Search,
  Check,
  ScanLine,
  Loader2,
  Clock,
} from 'lucide-react';
import { SheetsAuditItem, SheetsAuditSession } from '@/app/api/warehouse/sheets-sync/route';
import { parseCartonLabel } from '@/lib/warehouse-label-parser';
import {
  formatKurdishSpokenScan,
  KurdishSpokenResult,
} from '@/lib/warehouse-code-intelligence';

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
  scannedAtIso: string;
  spoken: KurdishSpokenResult;
  scanCount: number;
}

// =============================================================================
// 🔊 SOUND, HAPTIC & KURDISH SORANI VOICE SYNTHESIZER
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
        osc.frequency.setValueAtTime(f, now + idx * 0.055);
        gain.gain.setValueAtTime(0.2, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.22);
      });
    } catch {}
  }

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
        const start = now + i * 0.065;
        gain.gain.setValueAtTime(0.22, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
        osc.start(start);
        osc.stop(start + 0.26);
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

  speakKurdishResult(spoken: KurdishSpokenResult) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices() || [];
      const kuVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ku') || v.lang.toLowerCase().startsWith('ckb'));
      const faVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fa'));
      const arVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));

      let textToSpeak = spoken.speechKurdish;
      let targetVoice = kuVoice;

      if (kuVoice) {
        textToSpeak = spoken.speechKurdish;
        targetVoice = kuVoice;
      } else if (faVoice) {
        textToSpeak = spoken.speechPersianPhonetic;
        targetVoice = faVoice;
      } else if (arVoice) {
        textToSpeak = spoken.speechArabicPhonetic;
        targetVoice = arVoice;
      } else if (enVoice) {
        textToSpeak = spoken.speechEnglish;
        targetVoice = enVoice;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.98;
      utterance.pitch = 1.0;
      if (targetVoice) {
        utterance.voice = targetVoice;
        utterance.lang = targetVoice.lang;
      }
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  speakRawNotice(textKu: string, fallbackEn: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices() || [];
      const kuOrAr = voices.find((v) => v.lang.startsWith('ku') || v.lang.startsWith('ckb') || v.lang.startsWith('ar') || v.lang.startsWith('fa'));
      const utterance = new SpeechSynthesisUtterance(kuOrAr ? textKu : fallbackEn);
      if (kuOrAr) {
        utterance.voice = kuOrAr;
        utterance.lang = kuOrAr.lang;
      }
      utterance.rate = 1.0;
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

function formatClockTime(isoOrMs?: string | number): string {
  if (!isoOrMs) return '';
  const d = new Date(isoOrMs);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toTimeString().slice(0, 8);
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
  scannedTime?: string;
  spokenDisplay?: string;
  onReplayVoice?: () => void;
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
  scannedTime,
  spokenDisplay,
  onReplayVoice,
  compact = false,
  sheenKey,
}: MetallicVerifiedStripProps) {
  return (
    <div
      key={sheenKey}
      className={`relative overflow-hidden rounded-2xl border-2 shadow-[0_12px_30px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.95)] ${
        isComplete ? 'border-emerald-300/95' : 'border-slate-300/95'
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
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
        style={{ animation: 'ashleyMetalSheen 950ms cubic-bezier(0.23,1,0.32,1) 1 forwards' }}
      />

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

        <div className="flex items-center gap-1.5 shrink-0">
          {scannedTime && (
            <span className="text-[10px] font-mono text-emerald-300 font-bold flex items-center gap-0.5" dir="ltr">
              <Clock className="w-2.5 h-2.5" />
              {scannedTime}
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-gradient-to-b from-slate-100 to-slate-300 text-slate-950 text-[9px] font-black font-mono border border-white/80">
            ITEM NO + QTY
          </span>
        </div>
      </div>

      {/* Engraved Name / Model & Quantity Metallic Strip Content */}
      <div className={`relative z-10 ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} text-slate-950`}>
        <div className="flex items-center justify-between gap-2.5">
          {/* Stamped Exact Item Code & Product Name */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="px-2.5 py-0.5 rounded-lg bg-slate-950 text-white text-xs sm:text-sm font-black font-mono tracking-wider shadow-xs border border-slate-600/60"
                dir="ltr"
              >
                {model}
              </span>
              {isComplete && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black shadow-2xs">
                  تەواو ✅
                </span>
              )}
            </div>
            {name && name !== model && (
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
                {caseQty} عەدەد
              </span>
            </div>
            <span className="text-[10px] font-black font-mono text-slate-800 mt-1">
              کۆ: {checkedQty} / {expectedQty}
              {cartonNumber && totalCartons ? ` • #${cartonNumber}/${totalCartons}` : ''}
            </span>
          </div>
        </div>

        {/* Exact Spoken Kurdish Reading Row + Tap to Replay */}
        {spokenDisplay && (
          <div className="mt-2 pt-1.5 border-t border-slate-400/60 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-slate-900 leading-snug">
              🔊 {spokenDisplay}
            </span>
            {onReplayVoice && (
              <button
                type="button"
                onClick={onReplayVoice}
                className="px-2 py-1 rounded-lg bg-slate-900 text-amber-300 text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 touch-manipulation"
              >
                <Volume2 className="w-3 h-3" />
                <span>بیخوێنەرەوە</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 🎥 MAIN SIMPLE & ACCURATE CAMERA CARTON SCANNER
// =============================================================================
export function SmartCameraCartonScanner({
  session,
  isOpen,
  onClose,
  onUpdateSession,
}: SmartCameraCartonScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ocrWorkerRef = useRef<any>(null);
  const ocrBusyRef = useRef<boolean>(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const onUpdateSessionRef = useRef(onUpdateSession);
  onUpdateSessionRef.current = onUpdateSession;

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  voiceEnabledRef.current = voiceEnabled;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ocrReady, setOcrReady] = useState(false);
  const [isScanningFrame, setIsScanningFrame] = useState(false);

  const [liveHud, setLiveHud] = useState<{
    lockedItem: SheetsAuditItem | null;
    lockedItemNo: string | null;
    lockedCaseQty: number | null;
    unmatchedCode: string | null;
  }>({ lockedItem: null, lockedItemNo: null, lockedCaseQty: null, unmatchedCode: null });

  const partialLockRef = useRef<{
    item: SheetsAuditItem | null;
    itemNo: string | null;
    caseQty: number | null;
    lockedAt: number;
  }>({ item: null, itemNo: null, caseQty: null, lockedAt: 0 });

  const lastCompletedScanRef = useRef<{ model: string; timestamp: number }>({ model: '', timestamp: 0 });

  const [focusedItemId, setFocusedItemId] = useState<string>(session.items[0]?.id || '');
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualInput, setManualInput] = useState('');

  const [verifiedLabelsById, setVerifiedLabelsById] = useState<Record<string, VerifiedLabelRecord>>({});

  const [lastScannedResult, setLastScannedResult] = useState<{
    type: 'success' | 'completed' | 'duplicate' | 'unknown';
    model: string;
    name?: string;
    caseQty: number;
    checkedQty: number;
    expectedQty: number;
    cartonNumber: number;
    totalCartons: number;
    message: string;
    scannedTime?: string;
    spoken?: KurdishSpokenResult;
    timestamp: number;
  } | null>(null);

  // Sync voice list pre-loading on iOS/Android
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Keep focused item valid on tab change
  useEffect(() => {
    if (!session.items.some((it) => it.id === focusedItemId)) {
      setFocusedItemId(session.items[0]?.id || '');
    }
  }, [session.id, session.items, focusedItemId]);

  // 1. Initialize Camera Stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraError(null);
    setHasTorch(false);
    setTorchEnabled(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const caps: any = track.getCapabilities();
        if (caps?.torch) setHasTorch(true);
      }
    } catch (err: any) {
      setCameraError('نەتوانرا کامێرای مۆبایل بکرێتەوە. دڵنیابە مۆڵەتی کامێرات پێداوە (HTTPS).');
      console.warn('[SmartCamera] Camera error:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, startCamera]);

  // 2. Initialize Offline Tesseract OCR Worker
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const initWorker = async () => {
      if (ocrWorkerRef.current) {
        setOcrReady(true);
        return;
      }
      try {
        const { createWorker, PSM } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, {
          workerPath: '/ocr/worker.min.js',
          workerBlobURL: false,
        });
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          preserve_interword_spaces: '1',
        });
        if (!cancelled) {
          ocrWorkerRef.current = worker;
          setOcrReady(true);
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.warn('[SmartCamera] OCR worker fallback:', err);
      }
    };

    initWorker();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current) {
        try {
          ocrWorkerRef.current.terminate();
        } catch {}
        ocrWorkerRef.current = null;
      }
    };
  }, []);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const next = !torchEnabled;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as any);
      setTorchEnabled(next);
    } catch {}
  };

  // 3. Record Verified Carton Scan (`ITEM NO` + `CASE QTY`) + Kurdish Speech + Exact Timestamp
  const recordVerifiedCartonScan = useCallback(
    (matchedItem: SheetsAuditItem, detectedCaseQty: number, explicitCartonNo?: number | null) => {
      const curSession = sessionRef.current;
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const nowClock = formatClockTime(nowIso);

      const latestItem = curSession.items.find((it) => it.id === matchedItem.id) || matchedItem;

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
        if (voiceEnabledRef.current) {
          audio.speakRawNotice(`ئەم کارتۆنە پێشتر تۆمار کراوە: ${targetCartonNumber}`, `Carton ${targetCartonNumber} already scanned`);
        }
        setLastScannedResult({
          type: 'duplicate',
          model: latestItem.model,
          name: latestItem.name,
          caseQty: effectivePcsPerCarton,
          checkedQty: latestItem.checkedQty || 0,
          expectedQty: latestItem.expectedQty,
          cartonNumber: targetCartonNumber,
          totalCartons,
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
          const prevHistory = Array.isArray(it.scannedHistory) ? it.scannedHistory : [];
          return {
            ...it,
            cartonCount: totalCartons,
            pcsPerCarton: effectivePcsPerCarton,
            checkedCartons: newCheckedCartons,
            scannedCartonNumbers: newScannedNumbers,
            scannedHistory: [
              ...prevHistory.slice(-24),
              { cartonNumber: targetCartonNumber!, qty: effectivePcsPerCarton, scannedAt: nowIso },
            ],
            checkedQty: newCheckedQty,
            variance,
            auditStatus,
            lastAuditedAt: nowIso,
          };
        }
        return it;
      });

      const isComplete = newCheckedQty >= latestItem.expectedQty;
      const remainingCartons = Math.max(0, totalCartons - newCheckedCartons);

      // Generate exact Sorani Kurdish phrase: e.g. "٢ عەدەد لە مۆدێلی بیست و یەک سێسەد و چل و پێنج داش سفر دوو"
      const spoken = formatKurdishSpokenScan(latestItem.model, effectivePcsPerCarton);

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
            scannedAtIso: nowIso,
            spoken,
            scanCount: (existing?.scanCount || 0) + 1,
          },
        };
      });

      if (isComplete) {
        audio.playComplete();
        vibrateMobile([50, 35, 90]);
      } else {
        audio.playSuccess();
        vibrateMobile([35, 20, 60]);
      }
      if (voiceEnabledRef.current) {
        audio.speakKurdishResult(spoken);
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
        message: isComplete
          ? `🎉 تەواو! هەموو ${latestItem.expectedQty} دانە وەرگیرا`
          : `✅ وەرگیرا • ${remainingCartons} کارتۆن ماوە`,
        scannedTime: nowClock,
        spoken,
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
        updatedAt: nowIso,
      };

      onUpdateSessionRef.current(updatedSession);
    },
    []
  );

  // 4. High-Accuracy Center Crop Frame Canvas for Carton Label OCR
  const captureCroppedLabelCanvas = useCallback((videoEl: HTMLVideoElement): HTMLCanvasElement | null => {
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return null;

    const cropW = Math.floor(vw * 0.82);
    const cropH = Math.floor(vh * 0.54);
    const cropX = Math.floor((vw - cropW) / 2);
    const cropY = Math.floor((vh - cropH) / 2);

    const targetW = Math.min(1080, Math.max(640, cropW));
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

    // High-contrast monochrome stretch keeping small hyphens & zeros razor-clear
    try {
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      const data = imgData.data;
      const contrast = 1.48;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const boosted = Math.max(0, Math.min(255, (lum - 126) * contrast + 128));
        data[i] = boosted;
        data[i + 1] = boosted;
        data[i + 2] = boosted;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {}

    return canvas;
  }, []);

  // 5. Run Single Hybrid Frame Scan (BarcodeDetector + Tesseract OCR + Package Affix Awareness)
  const runHybridFrameScan = useCallback(
    async (isManualShot: boolean) => {
      const videoEl = videoRef.current;
      if (!videoEl || videoEl.readyState < 2 || ocrBusyRef.current) return;

      ocrBusyRef.current = true;
      if (isManualShot) setIsScanningFrame(true);

      try {
        const curSession = sessionRef.current;
        const canvas = captureCroppedLabelCanvas(videoEl);
        if (!canvas) return;

        let barcodeCandidate: string | null = null;
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'qr_code', 'itf'],
            });
            const codes = await detector.detect(canvas);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              barcodeCandidate = String(codes[0].rawValue).trim();
            }
          } catch {}
        }

        let ocrText = '';
        if (ocrWorkerRef.current) {
          const ocrRes = await ocrWorkerRef.current.recognize(canvas);
          ocrText = ocrRes?.data?.text || '';
        }

        const parsed = parseCartonLabel(
          ocrText,
          curSession.items,
          barcodeCandidate,
          curSession.codeProfile
        );

        const now = Date.now();
        const prevLock = partialLockRef.current;
        const lockFresh = now - prevLock.lockedAt < 4000;

        const mergedItem = parsed.matchedItem || (lockFresh ? prevLock.item : null);
        const mergedItemNo = parsed.matchedItem?.model || (lockFresh ? prevLock.itemNo : null);
        let mergedCaseQty = parsed.caseQty ?? (lockFresh ? prevLock.caseQty : null);

        if (parsed.matchedItem && prevLock.item && parsed.matchedItem.id !== prevLock.item.id && !parsed.caseQty) {
          mergedCaseQty = null;
        }

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
            model: (parsed.itemNo || barcodeCandidate || '').slice(0, 26),
            caseQty: parsed.caseQty || 0,
            checkedQty: 0,
            expectedQty: 0,
            cartonNumber: 0,
            totalCartons: 0,
            message: 'ئەم مۆدێلە لەم بەشەدا نییە!',
            timestamp: now,
          });
        }
      } catch {
        // Ignore single frame OCR transient errors
      } finally {
        ocrBusyRef.current = false;
        if (isManualShot) setIsScanningFrame(false);
      }
    },
    [captureCroppedLabelCanvas, recordVerifiedCartonScan]
  );

  // Continuous background label OCR loop
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      if (!ocrBusyRef.current) {
        runHybridFrameScan(false);
      }
    }, 700);
    return () => clearInterval(timer);
  }, [isOpen, runHybridFrameScan]);

  // Manual Entry Handler
  const handleManualSubmit = () => {
    const raw = manualInput.trim();
    if (!raw) return;

    const curSession = sessionRef.current;
    const starMatch = raw.match(/^(.+?)\s*[*xX×]\s*(\d+)$/);
    const searchSeed = starMatch ? starMatch[1].trim() : raw;
    const explicitQty = starMatch ? Math.max(1, parseInt(starMatch[2], 10)) : null;

    const parsed = parseCartonLabel(searchSeed, curSession.items, searchSeed, curSession.codeProfile);
    if (parsed.matchedItem) {
      const qtyToApply = explicitQty || parsed.caseQty || parsed.matchedItem.pcsPerCarton || 1;
      recordVerifiedCartonScan(parsed.matchedItem, qtyToApply);
      setManualInput('');
      return;
    }

    audio.playError();
    vibrateMobile([90, 40, 90]);
    setLastScannedResult({
      type: 'unknown',
      model: raw,
      caseQty: 0,
      checkedQty: 0,
      expectedQty: 0,
      cartonNumber: 0,
      totalCartons: 0,
      message: 'کۆد نەدۆزرایەوە!',
      timestamp: Date.now(),
    });
  };

  // Manual Tap Box Number
  const handleToggleCartonManual = (itemId: string, cartonNumber: number) => {
    const item = session.items.find((it) => it.id === itemId);
    if (!item) return;

    const curScanned = Array.isArray(item.scannedCartonNumbers) ? [...item.scannedCartonNumbers] : [];
    const exists = curScanned.includes(cartonNumber);

    if (!exists) {
      recordVerifiedCartonScan(item, item.pcsPerCarton || 1, cartonNumber);
      return;
    }

    const nextScanned = curScanned.filter((n) => n !== cartonNumber);
    const pcs = item.pcsPerCarton || 1;
    const nextQty = nextScanned.length * pcs;
    const nowIso = new Date().toISOString();

    const updatedItems = session.items.map((it) => {
      if (it.id === itemId) {
        const variance = nextQty - it.expectedQty;
        let status: SheetsAuditItem['auditStatus'] = 'pending';
        if (nextQty > 0) status = variance === 0 ? 'verified' : variance < 0 ? 'deficit' : 'excess';
        return {
          ...it,
          scannedCartonNumbers: nextScanned,
          checkedCartons: nextScanned.length,
          checkedQty: nextQty,
          variance,
          auditStatus: status,
          lastAuditedAt: nowIso,
        };
      }
      return it;
    });

    onUpdateSession({
      ...session,
      items: updatedItems,
      totalAuditedUnits: updatedItems.reduce((acc, it) => acc + it.checkedQty, 0),
      totalAuditedCartons: updatedItems.reduce((acc, it) => acc + (it.checkedCartons || 0), 0),
      matchedCount: updatedItems.filter((it) => it.auditStatus === 'verified').length,
      discrepantCount: updatedItems.filter((it) => it.auditStatus === 'deficit' || it.auditStatus === 'excess').length,
      updatedAt: nowIso,
    });
  };

  if (!isOpen) return null;

  const focusedItem = session.items.find((it) => it.id === focusedItemId) || session.items[0];
  const focusedTotalCartons = focusedItem?.cartonCount || focusedItem?.expectedQty || 1;
  const focusedScannedList = focusedItem?.scannedCartonNumbers || [];
  const focusedVerifiedMeta = focusedItem ? verifiedLabelsById[focusedItem.id] : undefined;

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

  return (
    <div
      className="fixed inset-0 z-50 h-[100dvh] bg-black flex flex-col font-sans select-none [-webkit-tap-highlight-color:transparent]"
      dir="rtl"
    >
      {/* 🔝 ULTRA-CLEAN TOP BAR */}
      <div className="relative z-20 flex items-center justify-between px-3 pb-2 pt-[max(0.7rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/90 via-black/60 to-transparent text-white">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation"
          title="داخستن"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2 bg-black/55 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 max-w-[60vw]">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ocrReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-[11px] font-black text-white truncate">{session.sheetName || session.title}</span>
          <span className="text-[11px] font-black font-mono text-amber-300 shrink-0">
            {totalSessionAuditedCartons}/{totalSessionCartons}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVoiceEnabled((prev) => !prev)}
            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation ${
              voiceEnabled ? 'bg-blue-600 text-white' : 'bg-white/15 text-slate-300'
            }`}
            title={voiceEnabled ? 'خوێندنەوەی کوردی چالاکە' : 'دەنگ بێدەنگە'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation ${
                torchEnabled ? 'bg-amber-400 text-slate-950' : 'bg-white/15 text-white'
              }`}
              title="فلاش"
            >
              {torchEnabled ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform cursor-pointer touch-manipulation"
            title="گۆڕینی کامێرا"
          >
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* 📹 SPACIOUS CLEAN CAMERA VIEWFINDER */}
      <div className="relative flex-1 bg-black flex flex-col items-center justify-center overflow-hidden px-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Centered Sharp Reticle */}
        <div className="relative z-10 w-full max-w-sm">
          <div className="w-full h-48 sm:h-56 rounded-3xl border-2 border-white/65 bg-black/10 shadow-2xl flex flex-col justify-between p-3 pointer-events-none">
            <div className="flex items-start justify-between">
              <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
              <span className="px-3 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[10px] font-black text-amber-300 border border-amber-400/30 font-mono">
                ITEM NO + CASE QTY
              </span>
              <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
            </div>

            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />

            <div className="flex items-end justify-between gap-2">
              <div className="w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-1.5">
                <div
                  className={`px-2 py-1 rounded-xl border text-center backdrop-blur-md ${
                    liveHud.lockedItemNo
                      ? 'bg-emerald-500/90 border-emerald-200 text-slate-950 font-black'
                      : 'bg-black/65 border-white/25 text-slate-200 font-bold'
                  }`}
                >
                  <span className="block text-[9px] font-mono opacity-80">ITEM NO</span>
                  <span className="text-xs font-mono truncate block" dir="ltr">
                    {liveHud.lockedItemNo ? `✓ ${liveHud.lockedItemNo}` : 'دەگەڕێ...'}
                  </span>
                </div>

                <div
                  className={`px-2 py-1 rounded-xl border text-center backdrop-blur-md ${
                    liveHud.lockedCaseQty
                      ? 'bg-emerald-500/90 border-emerald-200 text-slate-950 font-black'
                      : 'bg-black/65 border-white/25 text-slate-200 font-bold'
                  }`}
                >
                  <span className="block text-[9px] font-mono opacity-80">CASE QTY</span>
                  <span className="text-xs font-mono truncate block">
                    {liveHud.lockedCaseQty ? `✓ ${liveHud.lockedCaseQty} عەدەد` : 'ژمارە...'}
                  </span>
                </div>
              </div>
              <div className="w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg shrink-0" />
            </div>
          </div>

          {/* Crisp Single Capture Action */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => runHybridFrameScan(true)}
              disabled={isScanningFrame}
              className="h-10 px-5 rounded-full bg-white text-slate-950 font-black text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-transform cursor-pointer touch-manipulation disabled:opacity-60"
            >
              {isScanningFrame ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <ScanLine className="w-4 h-4 text-blue-600" />
              )}
              <span>{isScanningFrame ? 'دەخوێندرێتەوە...' : 'پشکنینی دەستبەجێ'}</span>
            </button>

            {liveHud.lockedItem && !liveHud.lockedCaseQty && (
              <button
                type="button"
                onClick={() =>
                  recordVerifiedCartonScan(liveHud.lockedItem!, liveHud.lockedItem!.pcsPerCarton || 1)
                }
                className="h-10 px-4 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-xl active:scale-95 transition-transform cursor-pointer touch-manipulation"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span dir="ltr">+{liveHud.lockedItem.pcsPerCarton || 1} {liveHud.lockedItem.model}</span>
              </button>
            )}
          </div>

          {liveHud.unmatchedCode && !lastScannedResult && (
            <div className="mt-2 px-3 py-1 rounded-full bg-rose-950/85 border border-rose-400/50 text-rose-200 text-[11px] font-bold text-center backdrop-blur-md">
              کۆدی «<span dir="ltr" className="font-mono">{liveHud.unmatchedCode}</span>» لەم بەشەدا نەدۆزرایەوە
            </div>
          )}
        </div>

        {/* Camera Error Overlay */}
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

      {/* 🪩 CLEAN BOTTOM DOCK: METALLIC RESULT STRIP + ONE DRAWER TOGGLE */}
      <div className="relative z-20 bg-slate-950/95 border-t border-slate-800 px-3.5 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] text-white rounded-t-3xl shadow-2xl space-y-2.5">
        {lastScannedResult && (lastScannedResult.type === 'success' || lastScannedResult.type === 'completed') ? (
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
            scannedTime={lastScannedResult.scannedTime}
            spokenDisplay={lastScannedResult.spoken?.displayText}
            onReplayVoice={
              lastScannedResult.spoken
                ? () => audio.speakKurdishResult(lastScannedResult.spoken!)
                : undefined
            }
          />
        ) : lastScannedResult ? (
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
              lastScannedResult.type === 'duplicate'
                ? 'bg-amber-500/95 border-amber-300 text-slate-950 font-black'
                : 'bg-rose-600/95 border-rose-400 text-white'
            }`}
          >
            <div>
              <span className="text-xs font-black font-mono block" dir="ltr">{lastScannedResult.model}</span>
              <span className="text-xs font-bold block mt-0.5">{lastScannedResult.message}</span>
            </div>
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </div>
        ) : focusedItem ? (
          <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-black font-mono text-amber-300 block" dir="ltr">{focusedItem.model}</span>
              <span className="text-[11px] text-slate-400 truncate block">{focusedItem.name}</span>
            </div>
            <div className="text-left font-mono shrink-0">
              <span className="text-xs font-black text-white">{focusedItem.checkedQty} / {focusedItem.expectedQty}</span>
              <span className="block text-[10px] text-slate-400">دانە</span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowItemDrawer(true)}
          className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-transform touch-manipulation"
        >
          <Layers className="w-4 h-4 text-blue-400" />
          <span>لیستی کاڵاکان و دەستکاری دەستی ({session.items.length})</span>
        </button>
      </div>

      {/* 📋 DRAWER OVERLAY FOR ITEM LIST, BOX MATRIX & MANUAL ENTRY */}
      {showItemDrawer && (
        <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md flex flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              <span>{session.sheetName || session.title} ({session.items.length} کاڵا)</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowItemDrawer(false)}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4 text-slate-300" />
            </button>
          </div>

          {/* Manual Entry Inside Drawer (16px stops iOS Safari zoom) */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              enterKeyHint="done"
              placeholder="نموونە: EV 21345-02 * 2"
              className="flex-1 h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-[16px] sm:text-xs font-mono font-bold text-white placeholder-slate-500 outline-none focus:border-blue-500"
              dir="ltr"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualSubmit();
              }}
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer active:scale-95 transition-transform touch-manipulation shrink-0"
            >
              تۆمار
            </button>
          </div>

          {/* Focused Carton Number Selector Inside Drawer */}
          {focusedItem && (
            <div className="mb-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
                <span className="font-mono text-amber-300" dir="ltr">{focusedItem.model}</span>
                <span>کارتۆن: {focusedScannedList.length} / {focusedTotalCartons}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {Array.from({ length: Math.min(focusedTotalCartons, 50) }, (_, i) => i + 1).map((cNum) => {
                  const isScanned = focusedScannedList.includes(cNum);
                  return (
                    <button
                      key={cNum}
                      type="button"
                      onClick={() => handleToggleCartonManual(focusedItem.id, cNum)}
                      className={`min-w-8 h-8 px-2 rounded-xl text-xs font-black font-mono flex items-center justify-center gap-1 cursor-pointer active:scale-90 touch-manipulation ${
                        isScanned
                          ? 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-950 border border-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {isScanned && <Check className="w-3 h-3 stroke-[3] text-emerald-700" />}
                      <span>{cNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="گەڕان بەپێی مۆدێل یان ناو..."
              className="w-full h-10 pr-9 pl-3 rounded-xl bg-slate-900 border border-slate-800 text-[16px] sm:text-xs font-bold text-white outline-none focus:border-blue-500"
            />
          </div>

          {/* Scrollable Items */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pb-6">
            {filteredItems.map((item) => {
              const verifiedMeta = verifiedLabelsById[item.id];
              const hasFullVerification = Boolean(
                verifiedMeta || (item.checkedQty > 0 && item.scannedCartonNumbers?.length)
              );

              if (hasFullVerification) {
                const spokenItem = verifiedMeta?.spoken || formatKurdishSpokenScan(item.model, item.pcsPerCarton || 1);
                return (
                  <div
                    key={item.id}
                    onClick={() => setFocusedItemId(item.id)}
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
                      scannedTime={formatClockTime(verifiedMeta?.scannedAtIso || item.lastAuditedAt)}
                      spokenDisplay={spokenItem.displayText}
                      onReplayVoice={() => audio.speakKurdishResult(spokenItem)}
                    />
                  </div>
                );
              }

              const itemTotal = item.cartonCount || item.expectedQty || 1;
              const itemScanned = item.scannedCartonNumbers?.length || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => setFocusedItemId(item.id)}
                  className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between active:scale-[0.98] transition-transform ${
                    focusedItemId === item.id
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-white" dir="ltr">{item.model}</span>
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
