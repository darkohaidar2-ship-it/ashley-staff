'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Lock, 
  Unlock, 
  Delete, 
  CheckCircle2, 
  AlertCircle, 
  Boxes, 
  Crown, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { safeSessionStorage } from '@/lib/safe-storage';

export interface PinKeypadProtectionProps {
  children: React.ReactNode;
  requiredPin?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  iconType?: 'warehouse' | 'manager';
  storageKey: string;
}

export function PinKeypadProtection({
  children,
  requiredPin = '0000',
  title,
  subtitle = 'تکایە کۆدی ٤ ژمارەیی بنووسە بۆ کردنەوەی ئەم بەشە',
  badgeText,
  iconType = 'warehouse',
  storageKey,
}: PinKeypadProtectionProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return safeSessionStorage.getItem(storageKey) === 'true';
  });

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Sync state if storage changes
  useEffect(() => {
    const unlocked = safeSessionStorage.getItem(storageKey) === 'true';
    if (unlocked !== isUnlocked) {
      setIsUnlocked(unlocked);
    }
  }, [storageKey, isUnlocked]);

  // Verify PIN whenever 4 digits are entered
  const verifyPin = useCallback((pinCandidate: string) => {
    if (pinCandidate.length !== 4) return;

    if (pinCandidate === requiredPin) {
      setIsSuccess(true);
      setError(null);
      setTimeout(() => {
        safeSessionStorage.setItem(storageKey, 'true');
        setIsUnlocked(true);
        setIsSuccess(false);
        setEnteredPin('');
      }, 400);
    } else {
      setIsShaking(true);
      setError('❌ کۆدی نهێنی هەڵەیە! تکایە دووبارە تاقی بکەرەوە.');
      setTimeout(() => {
        setIsShaking(false);
        setEnteredPin('');
      }, 700);
    }
  }, [requiredPin, storageKey]);

  // Keypad press handler
  const handleDigitPress = (digit: string) => {
    if (isSuccess || enteredPin.length >= 4) return;
    const next = enteredPin + digit;
    setEnteredPin(next);
    setError(null);
    if (next.length === 4) {
      verifyPin(next);
    }
  };

  // Clear handler
  const handleClear = () => {
    if (isSuccess) return;
    setEnteredPin('');
    setError(null);
  };

  // Backspace handler
  const handleDelete = () => {
    if (isSuccess || enteredPin.length === 0) return;
    setEnteredPin(prev => prev.slice(0, -1));
    setError(null);
  };

  // Physical keyboard listener
  useEffect(() => {
    if (isUnlocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Numbers 0-9 (standard and numpad)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked, enteredPin, isSuccess]);

  // If already unlocked, render children with a discrete "Lock again" control
  if (isUnlocked) {
    return (
      <div className="w-full">
        {/* Unlocked status bar */}
        <div className="w-full mb-3 px-3.5 py-2 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between text-xs font-bold" dir="rtl">
          <div className="flex items-center gap-2 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>ئەم بەشە پارێزراوە بە پاسوەردی ({requiredPin}) و ئێستا کراوەتەوە</span>
          </div>
          <button
            type="button"
            onClick={() => {
              safeSessionStorage.removeItem(storageKey);
              setIsUnlocked(false);
              setEnteredPin('');
              setError(null);
            }}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="قفڵکردنەوەی ئەم بەشە"
          >
            <Lock className="w-3 h-3 text-slate-500" />
            <span>قفڵکردنەوە</span>
          </button>
        </div>

        {children}
      </div>
    );
  }

  // Render on-screen keypad lock screen
  return (
    <div className="w-full min-h-[520px] flex items-center justify-center p-4" dir="rtl">
      <div className={`w-full max-w-sm bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 text-center transition-transform ${isShaking ? 'animate-shake' : ''}`}>
        
        {/* Top Icon */}
        <div className="mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-sm relative">
          {iconType === 'warehouse' ? (
            <div className="w-full h-full rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Boxes className="w-8 h-8 text-white" />
            </div>
          ) : (
            <div className="w-full h-full rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Crown className="w-8 h-8 text-slate-950" />
            </div>
          )}
          
          <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-amber-400">
            <Lock className="w-3 h-3" />
          </div>
        </div>

        {/* Badge */}
        {badgeText && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] mb-2 border border-slate-200">
            <span>{badgeText}</span>
          </div>
        )}

        {/* Title & Subtitle */}
        <h3 className="text-lg font-black text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 font-medium mb-5">{subtitle}</p>

        {/* 4 PIN Dots */}
        <div className="flex items-center justify-center gap-3.5 mb-4" dir="ltr">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = index < enteredPin.length;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  isSuccess
                    ? 'border-emerald-500 bg-emerald-500 scale-110 shadow-md shadow-emerald-500/30'
                    : isFilled
                    ? iconType === 'warehouse'
                      ? 'border-blue-600 bg-blue-600 scale-110 shadow-md shadow-blue-500/30'
                      : 'border-amber-500 bg-amber-500 scale-110 shadow-md shadow-amber-500/30'
                    : 'border-slate-300 bg-slate-100'
                }`}
              />
            );
          })}
        </div>

        {/* Status / Error Banner */}
        <div className="min-h-8 mb-4 flex items-center justify-center">
          {isSuccess ? (
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>کۆد دروستە، چوونەژوورەوە...</span>
            </div>
          ) : error ? (
            <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <span className="text-[11px] font-bold text-slate-400">
              {4 - enteredPin.length > 0 ? `${4 - enteredPin.length} ژمارە ماوە بنووسیت` : 'پشکنین...'}
            </span>
          )}
        </div>

        {/* ⌨️ On-Screen Numeric Keypad (وەک فیدباکی مۆبایل) */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto text-lg font-mono font-bold select-none" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="h-13 sm:h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200/90 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs font-mono font-black"
            >
              {digit}
            </button>
          ))}

          {/* Clear */}
          <button
            type="button"
            disabled={enteredPin.length === 0}
            onClick={handleClear}
            className="h-13 sm:h-14 rounded-2xl text-xs font-bold font-sans border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-500 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
          >
            پاککردن
          </button>

          {/* 0 */}
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="h-13 sm:h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 border border-slate-200/90 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-2xs font-mono font-black"
          >
            0
          </button>

          {/* Backspace / Delete */}
          <button
            type="button"
            disabled={enteredPin.length === 0}
            onClick={handleDelete}
            className="h-13 sm:h-14 rounded-2xl border border-rose-200/90 bg-rose-50/60 hover:bg-rose-100 text-rose-600 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-40"
            title="سڕینەوەی یەک ژمارە"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Hint text */}
        <div className="mt-5 text-[11px] text-slate-400 font-medium">
          دەتوانیت دوگمەکانی سەر شاشە یان تەختەکلیلی کۆمپیوتەرەکەت بەکاربهێنیت
        </div>

      </div>
    </div>
  );
}
