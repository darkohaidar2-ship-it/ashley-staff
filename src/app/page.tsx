'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AshleyMobileApp from '@/components/mobile-app/AshleyMobileApp';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { Building2, MessageSquareHeart, Loader2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/offline-sync-manager';

function RootPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const pinParam = searchParams.get('pin') || '';

  const [activePortal, setActivePortal] = useState<'attendance' | 'feedback'>(() => {
    if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      return 'feedback';
    }
    return 'attendance';
  });

  // Keep state synced with URL parameters if changed
  useEffect(() => {
    if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      setActivePortal('feedback');
    }
  }, [tabParam, pinParam]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center bg-slate-950 font-sans" dir="rtl">
      {/* 🍏 APPLE FLOATING SEGMENTED SWITCHER (Two Main Sections on First Page) */}
      <header className="sticky top-0 z-50 w-full max-w-[460px] px-3 pt-2.5 pb-2 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 transition-all">
        <div className="bg-slate-900/95 p-1 rounded-2xl border border-white/10 flex items-center gap-1 shadow-xl">
          {/* Section 1: Official Attendance */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActivePortal('attendance');
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              activePortal === 'attendance'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>دەوامی فەرمی</span>
          </button>

          {/* Section 2: Feedback & Survey (4-digit PIN Gate) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActivePortal('feedback');
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              activePortal === 'feedback'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5 text-amber-400" />
            <div className="flex items-center gap-1">
              <span>فیدباک و ڕاپرسی</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono font-bold ${
                activePortal === 'feedback' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'
              }`}>
                PIN
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="w-full flex-1 flex flex-col items-center">
        {activePortal === 'attendance' ? (
          <AshleyMobileApp onSwitchToFeedback={() => setActivePortal('feedback')} />
        ) : (
          <FeedbackPortal
            initialPin={pinParam}
            onBackToAttendance={() => setActivePortal('attendance')}
          />
        )}
      </main>
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-950 text-white" dir="rtl">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
          <span className="text-xs text-slate-400 font-bold">بارکردنی ئەپڵیکەیشنی ئاشڵی...</span>
        </div>
      }
    >
      <RootPageContent />
    </Suspense>
  );
}
