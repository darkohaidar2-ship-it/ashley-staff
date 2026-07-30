'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/shared/theme-provider';

export function TopNavbar() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const isRTL = language === 'ku';

  const navLinks = [
    { href: '/', label: isRTL ? 'داشبۆرد' : 'Dashboard' },
    { href: '/items', label: isRTL ? 'کۆگا' : 'Inventory' },
    { href: '/employees', label: isRTL ? 'ستاف' : 'Employees' },
    { href: '/ashley-expenses', label: isRTL ? 'خەرجیییەکان' : 'Expenses' },
    { href: '/overtime', label: isRTL ? 'سەعاتی زیاده' : 'Overtime' },
    { href: '/inputs', label: isRTL ? 'داغڵکردنی زانیاری' : 'Inputs' },
    { href: '/settings', label: isRTL ? 'ڕێکخستنەکان' : 'Settings' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900 border-b border-slate-800 text-white z-50 flex items-center justify-between px-6 transition-all print:hidden">
      {/* Brand Title */}
      <div className="flex items-center gap-4">
        <Link href="/" className="font-extrabold text-base tracking-wide text-white hover:text-blue-400 transition-colors">
          ASHLEY Do27
        </Link>
        
        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
          2027
        </span>
      </div>

      {/* Classic Navigation Links (Text Buttons) */}
      <nav className="hidden md:flex items-center gap-1">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
          return (
            <Link key={link.href} href={link.href}>
              <button
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-xs font-bold transition-all border",
                  isActive
                    ? "bg-slate-800 text-white border-slate-700 shadow-sm"
                    : "text-slate-300 hover:text-white border-transparent hover:bg-slate-800/60"
                )}
              >
                {link.label}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLanguage(language === 'ku' ? 'en' : 'ku')}
          className="px-3 py-1 text-xs font-bold rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          {language === 'ku' ? 'English' : 'کوردی'}
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="px-3 py-1 text-xs font-bold rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
