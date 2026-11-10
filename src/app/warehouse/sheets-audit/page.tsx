'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { Loader2, ArrowRight, Boxes, Home, Sparkles, Lock, KeyRound, AlertCircle, Delete, Sun, Moon } from 'lucide-react';
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

  // 🌓 Theme State: Light / Dark Mode
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      return saved === 'dark';
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new CustomEvent('ashley-theme-change', { detail: { isDark: next } }));
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      if (saved === 'dark') {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else if (saved === 'light') {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }

      const handleTheme = (e: any) => {
        if (e?.detail?.isDark !== undefined) {
          setIsDark(e.detail.isDark);
        }
      };
      window.addEventListener('ashley-theme-change', handleTheme);
      return () => window.removeEventListener('ashley-theme-change', handleTheme);
    }
  }, []);

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
      <div className={`min-h-screen font-sans flex flex-col justify-between transition-colors duration-200 ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`} dir="rtl">
        <header className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
          isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <Link
            href="/"
            className={`h-9 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isDark ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Home className="w-4 h-4 text-amber-500" />
            <span>پەڕەی سەرەکی</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-500 font-mono">بەشی کۆگا</span>
            <button
              type="button"
              onClick={toggleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs shrink-0 ${
                isDark
                  ? 'bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800'
                  : 'bg-white border border-slate-200 text-amber-600 hover:bg-slate-50'
              }`}
              title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-sm mx-auto w-full">
          <div className={`w-full p-6 sm:p-8 rounded-3xl border transition-colors ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}>
            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-8 h-8 text-blue-500" />
            </div>

            <div className="text-center">
              <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-300 font-mono text-xs font-bold border border-blue-500/30 mb-2 inline-block" dir="ltr">
                ٥ ژمارە (10000 - 99999)
              </span>

              <h2 className={`text-xl font-black text-center mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                بەشی کۆگا و جەرد
              </h2>
              <p className={`text-xs text-center mb-5 max-w-xs mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                تکایە کۆدی نهێنی ٥ ژمارەیی ڕێگەپێدراوی کۆگا بنووسە:
              </p>
            </div>

            {/* 5 Dots Indicator */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    i < pinInput.length
                      ? 'bg-blue-500 border-blue-400 shadow-md shadow-blue-500/50 scale-110'
                      : isDark
                      ? 'border-slate-700 bg-slate-800'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              ))}
            </div>

            {verifying ? (
              <div className="h-6 flex items-center justify-center gap-1.5 text-xs text-blue-500 font-bold mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>پشکنینی کۆد...</span>
              </div>
            ) : errorMsg ? (
              <div className="h-6 flex items-center justify-center gap-1 text-[11px] text-rose-500 font-bold mb-3 text-center">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <div className={`h-6 text-[11px] font-medium mb-3 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {5 - pinInput.length > 0 ? `${5 - pinInput.length} ژمارە ماوە` : 'کۆد پڕکرایەوە'}
              </div>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] mx-auto text-lg font-mono font-bold select-none">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={verifying}
                  onClick={() => handleKeypadPress(digit)}
                  className={`h-14 rounded-2xl active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                    isDark
                      ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/80'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200'
                  }`}
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                disabled={verifying || pinInput.length === 0}
                onClick={() => setPinInput('')}
                className={`h-14 rounded-2xl text-xs font-bold font-sans border active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
                  isDark
                    ? 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 border-slate-700/60'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                پاککردن
              </button>

              <button
                type="button"
                disabled={verifying}
                onClick={() => handleKeypadPress('0')}
                className={`h-14 rounded-2xl active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm ${
                  isDark
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700/80'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200'
                }`}
              >
                0
              </button>

              <button
                type="button"
                disabled={verifying || pinInput.length === 0}
                onClick={() => setPinInput((prev) => prev.slice(0, -1))}
                className={`h-14 rounded-2xl border active:scale-95 transition-all flex items-center justify-center cursor-pointer ${
                  isDark
                    ? 'bg-slate-800/50 hover:bg-slate-700 text-rose-400 border-slate-700/60'
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                }`}
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>

        <footer className={`text-center pb-4 text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>
          کۆمپانیای مۆبیلیاتی ئاشڵی • گروپی دیوان ٢٠٢٦
        </footer>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans p-2 sm:p-4 lg:p-6 transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
    }`} dir="rtl">
      {/* Top Breadcrumb Header for Standalone Direct Access */}
      <div className={`max-w-[1920px] mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 border rounded-2xl p-3 sm:p-4 shadow-xs transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-black">
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                پشکنینی باری نوێ و جەردی کۆگا • Google Sheets
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                بەشی کۆگا (PINی ٥ ژمارە)
              </span>
            </div>
            <p className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              هاوکاتکردنی دوولایەنەی زەخیڕە و بار لەگەڵ Google Sheets • چێککردنی داگرتنی کۆنتێنەر و جەردی فیزیایی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs shrink-0 ${
              isDark
                ? 'bg-slate-800 border border-slate-700 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-100 border border-slate-200 text-amber-600 hover:bg-slate-200'
            }`}
            title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <button
            type="button"
            onClick={handleLock}
            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="دەرچوون و قفڵکردنی کۆگا"
          >
            <Lock className="w-3.5 h-3.5 text-rose-500" />
            <span>قفڵکردن</span>
          </button>

          <Link
            href="/"
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
            title="گەڕانەوە بۆ پەڕەی سەرەکی"
          >
            <Home className="w-3.5 h-3.5" />
            <span>پەڕەی سەرەکی</span>
          </Link>

          <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
            isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200/60 text-blue-800'
          }`}>
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>سیستەمی هۆشمەندی کۆگا</span>
          </div>
        </div>
      </div>

      {/* Main Google Sheets Warehouse Audit Component */}
      <div className="max-w-[1920px] mx-auto">
        <GoogleSheetsWarehouseAudit isMobileEmbedded={true} />
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
