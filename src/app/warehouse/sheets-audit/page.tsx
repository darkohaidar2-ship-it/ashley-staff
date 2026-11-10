'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { Loader2, ArrowRight, Boxes, Home, Sparkles, Lock, KeyRound, AlertCircle, Delete } from 'lucide-react';
import Link from 'next/link';

function WarehouseSheetsAuditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pinParam = searchParams.get('pin') || '';

  const [authed, setAuthed] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check stored session or URL pin
  useEffect(() => {
    async function checkAuth() {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('ashley_warehouse_auth_pin');
        if (stored && /^\d{5}$/.test(stored)) {
          setAuthed(true);
          setChecking(false);
          return;
        }
      }

      if (pinParam && /^\d{5}$/.test(pinParam)) {
        try {
          const res = await fetch('/api/feedback/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinParam, expectedScope: 'warehouse' }),
          });
          const data = await res.json();
          if (data.valid) {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('ashley_warehouse_auth_pin', pinParam);
            }
            setAuthed(true);
            setChecking(false);
            return;
          }
        } catch {}
      }

      setChecking(false);
    }

    checkAuth();
  }, [pinParam]);

  const handleVerify = async (pinCandidate: string) => {
    if (pinCandidate.length !== 5) return;
    setVerifying(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/feedback/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinCandidate, expectedScope: 'warehouse' }),
      });
      const data = await res.json();
      if (data.valid) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('ashley_warehouse_auth_pin', pinCandidate);
        }
        setAuthed(true);
      } else {
        setErrorMsg(data.error || 'کۆدی نهێنی کۆگا هەڵەیە (دەبێت ٥ ژمارە بێت).');
        setPinInput('');
      }
    } catch {
      setErrorMsg('هەڵە لە پەیوەندیکردن بە سێرڤەر.');
      setPinInput('');
    } finally {
      setVerifying(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (verifying || pinInput.length >= 5) return;
    const next = pinInput + digit;
    setPinInput(next);
    setErrorMsg(null);
    if (next.length === 5) {
      setTimeout(() => handleVerify(next), 120);
    }
  };

  const handleLock = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ashley_warehouse_auth_pin');
    }
    setAuthed(false);
    setPinInput('');
    router.replace('/');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
      </div>
    );
  }

  // 🔒 5-Digit PIN Gate Screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between" dir="rtl">
        <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <Link
            href="/"
            className="h-9 px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Home className="w-4 h-4 text-amber-400" />
            <span>پەڕەی سەرەکی</span>
          </Link>
          <span className="text-xs font-bold text-blue-400 font-mono">بەشی کۆگا</span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>

          <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/30 mb-2" dir="ltr">
            ٥ ژمارە (10000 - 99999)
          </span>

          <h2 className="text-xl font-black text-white text-center mb-1">
            بەشی کۆگا و جەرد
          </h2>
          <p className="text-xs text-slate-400 text-center mb-5 max-w-xs">
            تکایە کۆدی نهێنی ٥ ژمارەیی ڕێگەپێدراوی کۆگا بنووسە:
          </p>

          {/* 5 Dots Indicator */}
          <div className="flex items-center justify-center gap-3 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  i < pinInput.length
                    ? 'bg-blue-500 border-blue-400 shadow-md shadow-blue-500/50 scale-110'
                    : 'border-slate-700 bg-slate-800'
                }`}
              />
            ))}
          </div>

          {verifying ? (
            <div className="h-6 flex items-center justify-center gap-1.5 text-xs text-blue-400 font-bold mb-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>پشکنینی کۆد...</span>
            </div>
          ) : errorMsg ? (
            <div className="h-6 flex items-center justify-center gap-1 text-[11px] text-rose-400 font-bold mb-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <div className="h-6 text-[11px] text-slate-500 font-medium mb-3">
              {5 - pinInput.length > 0 ? `${5 - pinInput.length} ژمارە ماوە` : 'کۆد پڕکرایەوە'}
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] text-lg font-mono font-bold select-none">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={verifying}
                onClick={() => handleKeypadPress(digit)}
                className="h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              disabled={verifying || pinInput.length === 0}
              onClick={() => setPinInput('')}
              className="h-14 rounded-2xl bg-slate-900/50 hover:bg-slate-800 text-slate-400 text-xs font-bold font-sans border border-slate-800/80 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              پاککردن
            </button>

            <button
              type="button"
              disabled={verifying}
              onClick={() => handleKeypadPress('0')}
              className="h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm"
            >
              0
            </button>

            <button
              type="button"
              disabled={verifying || pinInput.length === 0}
              onClick={() => setPinInput((prev) => prev.slice(0, -1))}
              className="h-14 rounded-2xl bg-slate-900/50 hover:bg-slate-800 text-rose-400 border border-slate-800/80 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </main>

        <footer className="text-center pb-4 text-[11px] text-slate-600">
          کۆمپانیای مۆبیلیاتی ئاشڵی • گروپی دیوان ٢٠٢٦
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans p-2 sm:p-4 lg:p-6" dir="rtl">
      {/* Top Breadcrumb Header for Standalone Direct Access */}
      <div className="max-w-[1920px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-black">
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900">
                پشکنینی باری نوێ و جەردی کۆگا • Google Sheets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">
                بەشی کۆگا (PINی ٥ ژمارە)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              هاوکاتکردنی دوولایەنەی زەخیڕە و بار لەگەڵ Google Sheets • چێککردنی داگرتنی کۆنتێنەر و جەردی فیزیایی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLock}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="دەرچوون و قفڵکردنی کۆگا"
          >
            <Lock className="w-3.5 h-3.5 text-rose-600" />
            <span>قفڵکردن</span>
          </button>

          <Link
            href="/"
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="گەڕانەوە بۆ پەڕەی سەرەکی"
          >
            <Home className="w-3.5 h-3.5" />
            <span>پەڕەی سەرەکی</span>
          </Link>

          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-800 text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>سیستەمی هۆشمەندی کۆگا</span>
          </div>
        </div>
      </div>

      {/* Main Google Sheets Warehouse Audit Component */}
      <div className="max-w-[1920px] mx-auto">
        <GoogleSheetsWarehouseAudit />
      </div>
    </div>
  );
}

export default function WarehouseSheetsAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-600 font-bold text-sm">تکایە چاوەڕوان بن... پشکنینی باری کۆگا باردەکرێت</p>
        </div>
      }
    >
      <WarehouseSheetsAuditContent />
    </Suspense>
  );
}
