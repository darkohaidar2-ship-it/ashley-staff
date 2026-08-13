'use client';

import React, { useEffect } from 'react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { AppProvider } from '@/context/app-provider';
import { LanguageProvider } from '@/context/language-provider';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force light mode and Kurdish RTL layout
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ku');
  }, []);

  return (
    <LanguageProvider>
      <AppProvider>
        <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col" dir="rtl">
          {/* Main Full Width Classic Content Container */}
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </AppProvider>
    </LanguageProvider>
  );
}
