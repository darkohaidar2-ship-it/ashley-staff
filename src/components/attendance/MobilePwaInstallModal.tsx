'use client';

import React from 'react';
import { Smartphone, X } from 'lucide-react';

interface MobilePwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobilePwaInstallModal({ isOpen, onClose }: MobilePwaInstallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-900">
              دابەزاندنی بەرنامە لەسەر مۆبایل
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <p className="font-black text-emerald-900">🤖 مۆبایلی ئەندرۆید:</p>
            <p>١. لە سەرەوەی وێبگەڕەکە پەنجە بنێ بە سێ خاڵەکە <strong>(⋮)</strong>.</p>
            <p>٢. دوگمەی <strong>دابەزاندنی بەرنامە</strong> یان <strong>زیادکردن بۆ شاشەی سەرەکی</strong> دابگرە.</p>
          </div>

          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
            <p className="font-black text-blue-900">🍏 مۆبایلی ئایفۆن:</p>
            <p>١. لە خوارەوەی شاشەکە دوگمەی هاوبەشکردن <strong>(⬆️)</strong> دابگرە.</p>
            <p>٢. دوگمەی <strong>زیادکردن بۆ شاشەی سەرەکی</strong> هەڵبژێرە.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
        >
          تێگەیشتم
        </button>
      </div>
    </div>
  );
}
