'use client';

import React from 'react';
import { MapPin } from 'lucide-react';

interface MobileLocationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export function MobileLocationHelpModal({
  isOpen,
  onClose,
  onRetry,
}: MobileLocationHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 p-6 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 mx-auto flex items-center justify-center shadow-xs">
            <MapPin className="w-7 h-7" />
          </div>
          <h4 className="text-base font-black text-slate-900">
            چۆنیەتی چالاککردنی دەسەڵاتی شوێن
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            ئەگەر لۆکەیشنی مۆبایلەکەت کراوەتەوە بەڵام ئەم پەیامە دێت، دەبێت وێبگەڕەکەت (Safari / Chrome) دەسەڵاتی پێ بدرێت:
          </p>
        </div>

        <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
            <div>
              <span className="font-bold text-slate-800 block">دەست بنێ لە ئایکۆنی لای ناونیشان:</span>
              <span className="text-slate-500 text-[11px]">لە بەشی سەرەوەی وێبگەڕ لە تەنیشت ناونیشانەکە دەست لەسەر ئایکۆنی <b>aA</b> یان <b>قوفڵ 🔒</b> دابگرە.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
            <div>
              <span className="font-bold text-slate-800 block">بچۆ ناو ڕێکخستنی ماڵپەڕ:</span>
              <span className="text-slate-500 text-[11px]">کلیک لەسەر <b>Website Settings</b> بکە.</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
            <div>
              <span className="font-bold text-slate-800 block">دەسەڵاتی Location:</span>
              <span className="text-slate-500 text-[11px]">بیگۆڕە لە Deny بۆ <b>Allow (ڕێگەپێدان)</b> پاشان لاپەڕەکە نوێ بکەرەوە.</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            onRetry();
          }}
          className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs cursor-pointer shadow-md transition-all"
        >
          تێگەیشتم • دووبارە تاقی بکەرەوە
        </button>
      </div>
    </div>
  );
}
