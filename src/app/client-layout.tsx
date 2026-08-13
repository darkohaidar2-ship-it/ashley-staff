'use client';

import React, { useEffect } from 'react';
import { AppProvider, useAppContext } from '@/context/app-provider';
import { LanguageProvider } from '@/context/language-provider';

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
    <LanguageProvider>
      <AppProvider>
        <DynamicFontInjector>
          <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col" dir="rtl">
            {/* Main Full Width Classic Content Container */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </DynamicFontInjector>
      </AppProvider>
    </LanguageProvider>
  );
}
