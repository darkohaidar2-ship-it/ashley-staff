'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from '@/context/app-provider';
import { 
  Smartphone, 
  Camera, 
  ShieldCheck, 
  Users, 
  Clock, 
  DollarSign, 
  MapPin, 
  Settings,
  Sparkles,
  Building2
} from 'lucide-react';

interface NavSection {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  matches: string[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'دەوامی مۆبایل',
    href: '/',
    icon: Smartphone,
    matches: ['/', '/attendance/mobile'],
  },
  {
    title: 'کیۆسکی دەموچاو',
    href: '/attendance/checkin',
    icon: Camera,
    matches: ['/attendance/checkin'],
  },
  {
    title: 'داشبۆردی ئەدمین',
    href: '/adm1n_pan0l',
    icon: ShieldCheck,
    matches: ['/adm1n_pan0l'],
  },
  {
    title: 'کارمەندان',
    href: '/employees',
    icon: Users,
    matches: ['/employees'],
  },
  {
    title: 'کاتی زیادە',
    href: '/overtime',
    icon: Clock,
    matches: ['/overtime'],
  },
  {
    title: 'مەسروفات و دارایی',
    href: '/ashley-expenses',
    icon: DollarSign,
    matches: ['/ashley-expenses'],
  },
  {
    title: 'نەخشەی شوێنەکان (GPS)',
    href: '/gps',
    icon: MapPin,
    matches: ['/gps'],
  },
  {
    title: 'ڕێکخستنەکان',
    href: '/settings',
    icon: Settings,
    matches: ['/settings'],
  },
];

export function TopNavbar() {
  const pathname = usePathname();
  const { settings } = useAppContext();

  const brandName = settings?.brandName || 'ئاشڵی';
  const appLogo = settings?.appLogo || settings?.websiteLogo;

  return (
    <header 
      className="sticky top-0 z-[100] w-full bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 shadow-2xs select-none print:hidden transition-colors"
      dir="rtl"
    >
      <div className="max-w-[1920px] mx-auto px-2 sm:px-4 h-11 sm:h-12 flex items-center justify-between gap-2">
        
        {/* Right Brand Badge (RTL First) */}
        <Link 
          href="/"
          className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shrink-0"
          title="گەڕانەوە بۆ پەڕەی سەرەکی دەوام"
        >
          {appLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={appLogo} 
              alt={brandName} 
              className="h-6 w-auto max-w-[90px] object-contain" 
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-black tracking-tight text-slate-900 dark:text-white hidden min-[400px]:inline-block">
            {brandName}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block" title="سێرڤەر کارایە"></span>
        </Link>

        {/* Center / Navigation Pills (Scrollable on small screens) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1 px-1">
          {NAV_SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = item.matches.some(m => {
              if (m === '/') return pathname === '/' || pathname === '/attendance/mobile';
              return pathname?.startsWith(m);
            });

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Left Live Status indicator */}
        <div className="hidden lg:flex items-center gap-1.5 pl-1 text-[10px] font-mono text-slate-400 font-bold shrink-0">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>v2026.4</span>
        </div>

      </div>
    </header>
  );
}

export default TopNavbar;
