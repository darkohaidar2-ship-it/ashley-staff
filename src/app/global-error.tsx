'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Client Exception]:', error);
  }, [error]);

  return (
    <html lang="ku" dir="rtl">
      <body className="min-h-screen bg-[#f2f2f7] flex items-center justify-center p-4 antialiased font-sans" dir="rtl">
        <div className="w-full max-w-md p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shadow-sm text-2xl font-bold">
            !
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-900">
              سیستەمی دەوامی ئاشڵی
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              پەڕەکە لە مۆبایل نوێ دەکرێتەوە، تکایە کلیک لە دووبارەکردنەوە بکە.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-md"
          >
            دووبارە کردنەوە
          </button>
        </div>
      </body>
    </html>
  );
}
