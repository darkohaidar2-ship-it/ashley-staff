'use client';

import React from 'react';
import { useErpTheme, ERP_THEMES, ErpTheme } from '@/context/theme-provider';
import { Palette, Check, Sparkles, Monitor } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useErpTheme();

  return (
    <div className="space-y-3 font-sans dir-rtl" dir="rtl">
      
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 bg-slate-100 border border-slate-300">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-900" />
          <span className="text-xs font-black text-slate-900 uppercase">
            🎨 دیزاین و ستایلی سیستەم (ERP GUI Design Paradigms & Themes):
          </span>
        </div>
        <span className="text-[10px] font-mono bg-blue-900 text-white px-2 py-0.5 font-bold">
          ACTIVE THEME: {theme.toUpperCase()}
        </span>
      </div>

      {/* 4 Theme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ERP_THEMES.map((item) => {
          const isSelected = theme === item.id;

          return (
            <div
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={`p-3 border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-sm ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50'
              }`}
              style={{ borderRadius: item.borderRadius }}
            >
              {/* Top Banner & Status */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-950">{item.nameKu}</span>
                  {isSelected && (
                    <span className="bg-blue-600 text-white p-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-bold">{item.descKu}</p>
              </div>

              {/* Live Preview Sample Card */}
              <div
                className="p-2 border space-y-1.5 text-[10px]"
                style={{
                  backgroundColor: item.bgPreview,
                  borderColor: '#cbd5e1',
                  borderRadius: item.borderRadius
                }}
              >
                {/* Panel Header Sample */}
                <div
                  className="px-2 py-1 text-white font-bold flex items-center justify-between"
                  style={{
                    background: item.headerColor,
                    borderRadius: item.borderRadius
                  }}
                >
                  <span>📋 {item.nameEn}</span>
                  <span className="font-mono text-[9px]">v2026</span>
                </div>

                {/* Grid Rows Sample */}
                <div className="bg-white border border-slate-300 p-1 space-y-1 text-slate-800 font-mono">
                  <div className="flex justify-between border-b pb-0.5">
                    <span>STATUS:</span>
                    <span className="text-emerald-700 font-bold">ONLINE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CORNER:</span>
                    <span className="font-bold">{item.borderRadius}</span>
                  </div>
                </div>

                {/* Primary Button Sample */}
                <button
                  type="button"
                  className="w-full text-center py-1 text-white font-bold text-[10px]"
                  style={{
                    backgroundColor: item.primaryColor,
                    borderRadius: item.borderRadius
                  }}
                >
                  {isSelected ? '✓ جێبەجێکراوە (Active)' : 'تاقیکردنەوە (Apply)'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
