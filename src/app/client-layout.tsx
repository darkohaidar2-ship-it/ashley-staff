'use client';

import React, { useEffect } from 'react';
import { AppProvider, useAppContext } from '@/context/app-provider';
import { LanguageProvider } from '@/context/language-provider';
import { ThemeProvider } from '@/context/theme-provider';
import { TopNavbar } from '@/components/layout/TopNavbar';

function DynamicFontInjector({ children }: { children: React.ReactNode }) {
  const { settings } = useAppContext();

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
  }, [settings?.fontFamily, settings?.customFont]);

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force light mode and Kurdish RTL layout
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ku');
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppProvider>
          <DynamicFontInjector>
            <div className="min-h-screen bg-slate-200 text-slate-900 font-sans antialiased flex flex-col dir-rtl" dir="rtl">
              
              {/* Classic ERP Enterprise Top Window Header & Ribbon Toolbar */}
              <TopNavbar />

              {/* Main Fluid Widescreen Content Area (Expands seamlessly on Ultrawide, 4K, 2K & Widescreen displays) */}
              <main className="flex-1 w-full max-w-[1920px] mx-auto px-3 md:px-6 py-3">
                {children}
              </main>

              {/* Classic Win32 Bottom Statusbar */}
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
          </DynamicFontInjector>
        </AppProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
