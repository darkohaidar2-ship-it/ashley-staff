'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendancePortalRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-sans p-4">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-400">سیستەمی تۆمارکردنی دەوام تەنها لە ڕێگەی GPS مۆبایلەوە کار دەکات...</p>
      </div>
    </div>
  );
}

