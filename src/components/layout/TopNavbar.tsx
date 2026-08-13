'use client';

import React from 'react';
import { Monitor } from 'lucide-react';

export function TopNavbar() {
  return (
    <div className="w-full font-sans select-none dir-rtl" dir="rtl">
      {/* CLASSIC WINDOW TITLE BAR (Clean Win32 Titlebar - No Top Nav Bar Clutter) */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-700 px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-extrabold tracking-wide">ASHLEY ERP Enterprise Desktop 2026 — پەنەری سەرەکی</span>
          <span className="text-[10px] bg-blue-900/80 text-blue-200 px-1.5 py-0.2 border border-blue-700 font-mono">
            v26.4 (RTL Kurdish Line-of-Business Edition)
          </span>
        </div>

        {/* Win32 Window Control Buttons (_ □ X) */}
        <div className="flex items-center gap-1 font-mono text-[11px] ltr" dir="ltr">
          <button title="Minimize" className="w-5 h-4 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600 cursor-pointer">_</button>
          <button title="Maximize" className="w-5 h-4 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600 cursor-pointer">□</button>
          <button title="Close" className="w-5 h-4 bg-rose-900 hover:bg-rose-700 text-white flex items-center justify-center border border-rose-800 cursor-pointer">✕</button>
        </div>
      </header>
    </div>
  );
}
