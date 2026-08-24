'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppProvider, useAppContext } from '@/context/app-provider';
import { LanguageProvider } from '@/context/language-provider';
import { ThemeProvider } from '@/context/theme-provider';
import { TopNavbar } from '@/components/layout/TopNavbar';

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
      } else if (settings?.fontFamily) {
        const existingStyle = document.getElementById('custom-ui-font-style');
        if (existingStyle) existingStyle.remove();
        document.body.style.fontFamily = settings.fontFamily;
      }
    }
  }, [settings?.fontFamily, settings?.customFont]);

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isMobileOrTerminal = 
    pathname === '/' || 
    pathname?.startsWith('/attendance') || 
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
            {isMobileOrTerminal ? (
              // 📱 100% IMMERSIVE FULL-SCREEN FOR MOBILE APP & TERMINAL (NO DESKTOP BORDERS)
              <div className="min-h-[100dvh] h-[100dvh] w-full bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden p-0 m-0 dir-rtl" dir="rtl">
                {children}
              </div>
            ) : (
              // 🖥️ CLASSIC ERP DESKTOP WORKSPACE
              <div className="min-h-screen bg-slate-200 text-slate-900 font-sans antialiased flex flex-col dir-rtl" dir="rtl">
                <TopNavbar />
                <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 md:px-6 py-3">
                  {children}
                </main>
                <footer className="w-full bg-slate-200 border-t border-slate-400 p-1 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-700 select-none">
                  <div className="flex items-center gap-2">
                    <span className="statusbar-segment text-emerald-800 font-bold">● SYSTEM READY (FIRESTORE ONLINE)</span>
                    <span className="statusbar-segment font-bold">RTL MODE: KURDISH (SORANI)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="statusbar-segment">ERP CORE: v2026.4</span>
                    <span className="statusbar-segment">USER: SUPER ADMIN</span>
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
