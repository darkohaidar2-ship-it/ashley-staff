'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPanelRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login portal
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans dir-rtl" dir="rtl">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-300">گواستنەوە بۆ دەروازەی ئەدمین (Admin Portal)...</p>
      </div>
    </div>
  );
}
