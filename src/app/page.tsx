'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AshleyMobileApp from '@/components/mobile-app/AshleyMobileApp';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { GoogleSheetsWarehouseAudit } from '@/components/admin/warehouse/GoogleSheetsWarehouseAudit';
import { Loader2, ArrowRight, Boxes, MapPin, MessageSquareHeart } from 'lucide-react';

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
        {/* Mobile Hub Top Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 sm:px-5 py-2.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('attendance')}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-amber-500" />
              <span>گەڕانەوە بۆ دەوام</span>
            </button>
            <span className="text-xs font-black text-slate-900 hidden sm:inline">| بەشی جەرد و بار داگرتن</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchPortal('feedback')}
              className="h-9 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <MessageSquareHeart className="w-4 h-4 text-amber-600" />
              <span>فیدباک</span>
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
