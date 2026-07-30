'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-slate-100 p-6 text-center" dir="rtl">
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-2xl font-black text-slate-900 mb-2">
        پەڕەکە نەدۆزرایەوە (404 Page Not Found)
      </h1>
      <p className="text-xs text-slate-600 font-bold mb-6">
        داوای پەڕەیەک دەکەیت کە شتی وا لە سیستەمەکەدا بوونی نییە یان گوێزراوەتەوە.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded border border-slate-700 transition-all"
      >
        گەڕانەوە بۆ پەڕەی سەرەکی
      </Link>
    </div>
  );
}
