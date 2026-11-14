// =============================================================================
// 🎙️ ASHLEY KURDISH OFFLINE AUDIO ENGINE (IndexedDB + Supabase + Fallback)
// =============================================================================
'use client';

import { KurdishSpokenResult, formatKurdishSpokenScan } from '@/lib/warehouse-code-intelligence';

const DB_NAME = 'AshleyKurdishAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_clips';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getAudioDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export function buildAudioCacheKey(model: string, qty: number): string {
  const cleanModel = (model || '').trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '_');
  return `ckb_${cleanModel}_q${qty}`;
}

/**
 * Retrieve cached audio Blob from mobile IndexedDB (100% offline)
 */
export async function getCachedAudioBlob(key: string): Promise<Blob | null> {
  try {
    const db = await getAudioDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.blob) {
            resolve(req.result.blob);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Save audio Blob to mobile IndexedDB for permanent offline access
 */
export async function saveAudioBlobToCache(key: string, blob: Blob, text?: string): Promise<void> {
  try {
    const db = await getAudioDB();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          key,
          blob,
          text: text || '',
          savedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

let activeAudioEl: HTMLAudioElement | null = null;

/**
 * Play an audio Blob instantly with zero network
 */
export function playAudioBlob(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (activeAudioEl) {
        activeAudioEl.pause();
        activeAudioEl.currentTime = 0;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudioEl = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(url);
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Fallback synthesizer using device SpeechSynthesis (Arabic/Persian phonetic or Kurdish-Latin phonetic)
 * NEVER speaks English words.
 */
export function playSpeechSynthesisFallback(spoken: KurdishSpokenResult) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices() || [];
    const kuVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ku') || v.lang.toLowerCase().startsWith('ckb'));
    const faVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fa'));
    const arVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
    const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));

    let textToSpeak = spoken.speechKurdish;
    let targetVoice: SpeechSynthesisVoice | undefined = kuVoice;
    let targetLang = 'ku-IQ';
    let rate = 0.95;

    if (kuVoice) {
      textToSpeak = spoken.speechKurdish;
      targetVoice = kuVoice;
      targetLang = kuVoice.lang;
    } else if (faVoice) {
      textToSpeak = spoken.speechPersianPhonetic;
      targetVoice = faVoice;
      targetLang = faVoice.lang;
    } else if (arVoice) {
      textToSpeak = spoken.speechArabicPhonetic;
      targetVoice = arVoice;
      targetLang = arVoice.lang;
    } else if (enVoice) {
      // NEVER speak English words! Use Kurdish-Latin phonetics so the English voice pronounces Kurdish words!
      textToSpeak = spoken.speechKurdishLatin || spoken.speechKurdish;
      targetVoice = enVoice;
      targetLang = enVoice.lang;
      rate = 0.88;
    } else {
      // Universal fallback
      textToSpeak = spoken.speechArabicPhonetic;
      targetLang = 'ar-SA';
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    if (targetVoice) {
      utterance.voice = targetVoice;
    }
    utterance.lang = targetLang;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

/**
 * Fetch voice audio from API (checks Supabase cache, ElevenLabs, or free Google TTS), and stores locally
 */
export async function fetchAndCacheAudio(
  model: string,
  qty: number,
  spokenText: string,
  arabicPhoneticText?: string
): Promise<Blob | null> {
  const key = buildAudioCacheKey(model, qty);
  try {
    const res = await fetch('/api/warehouse/kurdish-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        qty,
        spokenText,
        arabicPhoneticText: arabicPhoneticText || spokenText,
        cacheKey: key,
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 100) {
        await saveAudioBlobToCache(key, blob, spokenText);
        return blob;
      }
    }
  } catch {
    // Offline or network error
  }
  return null;
}

/**
 * Main function: Play crystal-clear Kurdish audio
 * 1. Check offline IndexedDB cache (0ms instant playback)
 * 2. If not cached, attempt fetch from Supabase/API (ElevenLabs or Free Google TTS)
 * 3. Fallback to Device Speech Synthesis (strictly Kurdish/Arabic/Latin phonetics)
 */
export async function playKurdishScanAudio(
  model: string,
  qty: number,
  spoken?: KurdishSpokenResult
): Promise<void> {
  const resolvedSpoken = spoken || formatKurdishSpokenScan(model, qty);
  const cacheKey = buildAudioCacheKey(model, qty);

  // 1. Instant Offline Playback from device cache
  const cachedBlob = await getCachedAudioBlob(cacheKey);
  if (cachedBlob) {
    const played = await playAudioBlob(cachedBlob);
    if (played) return;
  }

  // 2. Not cached locally: fetch from API (cached to Supabase + IndexedDB)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const freshBlob = await fetchAndCacheAudio(
        model,
        qty,
        resolvedSpoken.speechKurdish,
        resolvedSpoken.speechArabicPhonetic
      );
      if (freshBlob) {
        const played = await playAudioBlob(freshBlob);
        if (played) return;
      }
    } catch {}
  }

  // 3. Fallback to Device Speech Synthesis
  playSpeechSynthesisFallback(resolvedSpoken);
}

/**
 * Pre-cache all items of a session into mobile phone's IndexedDB
 * (Called when scanner or session opens so everything is ready offline)
 */
export async function precacheSessionAudioClips(
  items: Array<{ model: string; pcsPerCarton?: number; expectedQty?: number }>
): Promise<{ cachedCount: number; totalCount: number }> {
  if (!items || items.length === 0 || !navigator.onLine) {
    return { cachedCount: 0, totalCount: 0 };
  }

  let cachedCount = 0;
  const uniqueKeys = new Map<string, { model: string; qty: number; text: string; arabicPhonetic: string }>();

  for (const it of items) {
    if (!it.model) continue;
    const qty = it.pcsPerCarton || 1;
    const key = buildAudioCacheKey(it.model, qty);
    if (!uniqueKeys.has(key)) {
      const spoken = formatKurdishSpokenScan(it.model, qty);
      uniqueKeys.set(key, {
        model: it.model,
        qty,
        text: spoken.speechKurdish,
        arabicPhonetic: spoken.speechArabicPhonetic,
      });
    }
  }

  const entries = Array.from(uniqueKeys.entries());

  for (const [key, meta] of entries) {
    const existing = await getCachedAudioBlob(key);
    if (existing) {
      cachedCount++;
      continue;
    }

    try {
      const blob = await fetchAndCacheAudio(meta.model, meta.qty, meta.text, meta.arabicPhonetic);
      if (blob) cachedCount++;
    } catch {
      // Continue next
    }
  }

  return { cachedCount, totalCount: entries.length };
}
