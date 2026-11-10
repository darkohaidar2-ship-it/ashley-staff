'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AshleyMobileApp from '@/components/mobile-app/AshleyMobileApp';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { Loader2, ArrowRight, Boxes, MapPin, MessageSquareHeart, Clock, Building2 } from 'lucide-react';

function RootPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const pinParam = searchParams.get('pin') || '';

  const [activePortal, setActivePortal] = useState<'attendance' | 'feedback' | 'warehouse'>(() => {
    if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      return 'feedback';
    }
    if (tabParam === 'warehouse' || tabParam === 'audit' || tabParam === 'sheets_warehouse' || tabParam === 'inventory') {
      return 'warehouse';
    }
    return 'attendance';
  });

  useEffect(() => {
    if (tabParam === 'feedback' || (pinParam && /^\d{4}$/.test(pinParam))) {
      setActivePortal('feedback');
    } else if (tabParam === 'warehouse' || tabParam === 'audit' || tabParam === 'sheets_warehouse' || tabParam === 'inventory') {
      setActivePortal('warehouse');
    }
  }, [tabParam, pinParam]);

  const handleSwitchPortal = (portal: 'attendance' | 'feedback' | 'warehouse') => {
    setActivePortal(portal);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (portal === 'attendance') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', portal);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  if (activePortal === 'feedback') {
    return (
      <FeedbackPortal 
        initialPin={pinParam} 
        onSwitchPortal={handleSwitchPortal} 
        onBackToMobileApp={() => handleSwitchPortal('attendance')} 
      />
    );
  }

  if (activePortal === 'warehouse') {
    return (
      <div className="min-h-[100dvh] bg-[#f8fafc] text-slate-900 font-sans" dir="rtl">
        {/* 🌟 3-SECTION APP NAVIGATION HEADER (No Login Required) */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-sm flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                <Boxes className="w-4.5 h-4.5 text-amber-400" />
              </div>
            </div>
            <div>
              <span className="text-sm font-black text-slate-900 block leading-tight">
                ئاشڵی • بەشی کۆگا
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                بار داگرتن و تۆمارکردنی جەرد • Google Sheets
              </span>
            </div>
          </div>

          {/* 3 Main Sections Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200/90 shadow-inner">
            <button
              type="button"
              onClick={() => handleSwitchPortal('attendance')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>١. بەشی تۆمارکردن</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-rose-500" />
              <span>٢. بەشی فیدباک</span>
            </button>

            <button
              type="button"
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-blue-600 text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5"
            >
              <Boxes className="w-3.5 h-3.5 text-white" />
              <span>٣. بەشی کۆگا</span>
            </button>
          </div>
        </header>

        <main className="p-2 sm:p-4 lg:p-6 max-w-[1920px] mx-auto">
          <GoogleSheetsWarehouseAudit 
            onSwitchPortal={handleSwitchPortal}
            onBackToMobileApp={() => handleSwitchPortal('attendance')}
            isMobileEmbedded={true}
          />
        </main>
      </div>
    );
  }

  return (
    <AshleyMobileApp 
      onSwitchToFeedback={() => handleSwitchPortal('feedback')} 
      onSwitchToWarehouse={() => handleSwitchPortal('warehouse')}
      onSwitchPortal={handleSwitchPortal}
    />
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
