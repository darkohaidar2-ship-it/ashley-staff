'use client';

import { ThemeProvider } from "@/components/shared/theme-provider";
import { AppProvider, useAppContext } from '@/context/app-provider';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { LanguageProvider } from '@/context/language-provider';
import { useTranslation } from '@/hooks/use-translation';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase';
import { cn } from '@/lib/utils';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { BackupReminder } from '@/components/shared/backup-reminder';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from "@/components/ui/toaster";
import { Palette, Settings, X, Save, RefreshCw } from 'lucide-react';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

// Declare UI_Config globally
declare global {
  interface Window {
    UI_Config: {
      primaryColor: string;
      secondaryColor: string;
      cardBgColor: string;
      textColor: string;
      sidebarBgColor: string;
      buttonRadius: string;
      updateStyles: () => void;
    };
  }
}

// Convert Hex color to space-separated HSL values for Tailwind compatibility
function hexToHsl(hex: string): string {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (!result) return '210 100% 50%';
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function AppContent({ children }: { children: React.ReactNode }) {
    const { language } = useTranslation();
    const pathname = usePathname();
    const isPublicPage = pathname === '/login' || 
                         pathname === '/public-inventory' || 
                         pathname === '/public-transmit' ||
                         pathname?.startsWith('/attendance/checkin') ||
                         pathname?.startsWith('/attendance/qr') ||
                         pathname?.startsWith('/attendance/register');

    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = language === 'ku' ? 'rtl' : 'ltr';
    }, [language]);
    
    if (isPublicPage) {
        return (
            <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-zinc-950 overflow-auto selection:bg-primary/20 w-full">
                {children}
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100" dir={language === 'ku' ? 'rtl' : 'ltr'}>
            <TopNavbar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-14">
                <div className="w-full max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
            <BackupReminder />
        </div>
    );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <FirebaseClientProvider>
          <AppProvider>
            <AuthProvider>
              <LanguageProvider>
                <ThemeProvider>
                  <NextTopLoader color="#3b82f6" showSpinner={false} />
                  <AppContent>
                      {children}
                  </AppContent>
                  <Toaster />
                </ThemeProvider>
              </LanguageProvider>
            </AuthProvider>
          </AppProvider>
        </FirebaseClientProvider>
    );
}
