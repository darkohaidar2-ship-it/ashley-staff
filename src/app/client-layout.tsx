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

  const isStandalonePage = 
    pathname === '/' || 
    pathname === '/adminpanel' || 
    pathname === '/login' || 
    pathname?.startsWith('/attendance') || 
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/adm1n_pan0l') ||
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
            {isStandalonePage ? (
              // 📱 STANDALONE CLEAN IMMERSIVE FULLSCREEN SHELL
              <div className="min-h-screen w-full bg-white dark:bg-[#1c1c1e] text-slate-900 dark:text-white font-sans antialiased dir-rtl p-0 m-0" dir="rtl">
                {children}
              </div>
            ) : (
              // 🖥️ FULL ERP DESKTOP WORKSPACE (FOR MAIN ADMIN DESKTOP)
              <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white font-sans antialiased flex flex-col dir-rtl" dir="rtl">
                <TopNavbar />
                <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 md:px-6 py-4">
                  {children}
                </main>
                <footer className="w-full bg-white/70 dark:bg-[#2c2c2e]/70 backdrop-blur-md border-t border-slate-200/80 dark:border-white/5 p-2 flex flex-wrap items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 select-none">
                  <div className="flex items-center gap-2">
                    <span className="statusbar-segment text-emerald-700 dark:text-emerald-400 font-bold">● SUPABASE ONLINE</span>
                    <span className="statusbar-segment font-bold">ASHLEY ERP iOS ENGINE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="statusbar-segment">v2026.4 PRO</span>
                    <span className="statusbar-segment">SUPER ADMIN</span>
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
