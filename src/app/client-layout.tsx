'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppProvider, useAppContext } from '@/context/app-provider';
import { LanguageProvider } from '@/context/language-provider';
import { ThemeProvider } from '@/context/theme-provider';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { SystemBroadcastBanner } from '@/components/layout/SystemBroadcastBanner';

function DynamicFontInjector({ children }: { children: React.ReactNode }) {
  const { settings } = useAppContext();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (settings?.customFont) {
        let styleEl = document.getElementById('custom-ui-font-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-ui-font-style';
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
          @font-face {
            font-family: 'CustomUploadedFont';
            src: url('${settings.customFont}');
          }
          * {
            font-family: 'CustomUploadedFont', system-ui, sans-serif !important;
          }
        `;
      } else if (settings?.fontFamily && !settings.fontFamily.includes('Inter')) {
        const existingStyle = document.getElementById('custom-ui-font-style');
        if (existingStyle) existingStyle.remove();
        document.body.style.fontFamily = settings.fontFamily;
      } else {
        const existingStyle = document.getElementById('custom-ui-font-style');
        if (existingStyle) existingStyle.remove();
        document.body.style.fontFamily = "'NRT', 'Vazirmatn', system-ui, sans-serif";
      }
    }
  }, [settings?.fontFamily, settings?.customFont]);

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isStandalonePage = 
    pathname === '/' || 
    pathname === '/login' || 
    pathname?.startsWith('/attendance') || 
    pathname?.startsWith('/adm1n_pan0l') ||
    pathname?.startsWith('/notifications-matrix') ||
    pathname?.includes('mobile');

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ku');
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppProvider>
          <DynamicFontInjector>
            <SystemBroadcastBanner />
            <TopNavbar />
            {isStandalonePage ? (
              // STANDALONE CLEAN IMMERSIVE FULLSCREEN SHELL
              <div className="min-h-screen w-full bg-white text-slate-900 font-sans antialiased dir-rtl p-0 m-0" dir="rtl">
                {children}
              </div>
            ) : (
              // FULL ERP DESKTOP WORKSPACE (FOR MAIN ADMIN DESKTOP)
              <div className="min-h-[calc(100vh-48px)] bg-[#f8fafc] text-slate-900 font-sans antialiased flex flex-col dir-rtl" dir="rtl">
                <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 md:px-6 py-4">
                  {children}
                </main>
                <footer className="w-full bg-white/80 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-sans text-slate-500 select-none print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>سیستەمی دەوامی ئاشڵی</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-slate-400 text-[11px]">
                    <span>Ashley ERP 2027</span>
                  </div>
                </footer>
              </div>
            )}
          </DynamicFontInjector>
        </AppProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
