'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { useAppContext } from '@/context/app-provider';
import { cn } from '@/lib/utils';
import { 
  Box, Users, CreditCard, LayoutGrid, MapPin, Upload, 
  Archive, Clock, Calendar, ShieldAlert, CheckCircle, 
  Smartphone, LogOut, ClipboardList, TrendingUp, MonitorPlay,
  Search, ShieldCheck, Building2, RefreshCw, Camera, ChevronLeft,
  FileSpreadsheet, BarChart3, Settings, ArrowUpRight, FileText,
  FileCheck, Shield, Map, Layers, FilePlus, Download, DollarSign,
  UserCheck, ExternalLink, Activity
} from 'lucide-react';

export function DashboardClient() {
  const router = useRouter();
  const { employees, expenses, overtime, attendanceLogs } = useAppContext();
  const { language } = useTranslation();
  const isRTL = language === 'ku';

  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [activeUser, setActiveUser] = useState<string>('بەڕێوەبەری سەرەکی (Admin)');

  // Clock Timer
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } as const;
      setDateStr(now.toLocaleDateString('ku-IQ', options));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    const savedName = localStorage.getItem('user_name');
    if (savedName) setActiveUser(savedName);

    return () => clearInterval(interval);
  }, []);

  // Quick Action Handler
  const handleAction = (href: string) => {
    router.push(href);
  };

  // System Modules (ALL 26 System Pages Categorized)
  const systemModules = [
    {
      categoryName: isRTL ? '👥 سیستەمی ئامادەبوونی کارمەندان' : 'Staff Attendance System',
      description: isRTL ? 'تۆمارکردنی دەوام بە کامێرا و GPS، ڕۆژژمێری مانگانە و ناسینەوەی دەموچاو' : 'Geofenced check-in, attendance calendar, and face recognition',
      color: 'border-emerald-200 bg-emerald-50/40 text-emerald-900',
      badgeColor: 'bg-emerald-600 text-white',
      items: [
        { title: isRTL ? 'تۆمارکردنی دەوام (Check-In)' : 'Camera Check-In', href: '/attendance/checkin', icon: Camera, desc: isRTL ? 'سێڵفی + GPS لۆکەیشن' : 'Selfie check-in with GPS' },
        { title: isRTL ? 'ئامادەبوونی مۆبایل و دەموچاو' : 'Mobile Face Attendance', href: '/attendance/mobile', icon: Smartphone, desc: isRTL ? 'ناسینی ڕوخسار لە مۆبایلەوە' : 'Mobile face verification & check-in' },
        { title: isRTL ? 'بەڕێوەبردنی ئامادەبووان' : 'Attendance Admin Control', href: '/admin/attendance', icon: ClipboardList, desc: isRTL ? 'کاتەکان، پشووەکان و کۆگاکان' : 'Shifts, holidays & Geofence' },
        { title: isRTL ? 'ناوی کارمەندان' : 'Employees Directory', href: '/employees', icon: Users, desc: isRTL ? 'لیستی ستافی کۆمپانیا' : 'Company staff directory' },
        { title: isRTL ? 'نەخشەی شوێنەکان (GPS)' : 'GPS Geofence', href: '/gps', icon: MapPin, desc: isRTL ? 'دیاریکردنی سنوری جوگرافی کۆگاکان' : 'Warehouse GPS Geofence setup' },
      ]
    },
    {
      categoryName: isRTL ? '⏱️ سیستەمی کاتی زیادە' : 'Overtime Management System',
      description: isRTL ? 'تۆمارکردن، ئەژمارکردنی خۆکار و بەڕێوەبردنی سەعاتەکانی کاتی زیادە' : 'Daily and monthly overtime logs, calculation, and rates',
      color: 'border-amber-200 bg-amber-50/40 text-amber-900',
      badgeColor: 'bg-amber-600 text-white',
      items: [
        { title: isRTL ? 'بەڕێوەبردنی کاتی زیادە' : 'Overtime Management', href: '/overtime', icon: Clock, desc: isRTL ? 'تۆمار و ئاماری کاتی زیادەی کارمەندان' : 'Employee overtime logs & auto calculation' },
      ]
    },
    {
      categoryName: isRTL ? '💳 سیستەمی دارایی & خەرجییەکان' : 'Finance & Expenses System',
      description: isRTL ? 'بەڕێوەبردنی خەرجی ڕۆژانە، مووچە، پاداشتەکان و ڕاپۆرتەکان' : 'Daily expenses, payroll, bonuses, and reports',
      color: 'border-rose-200 bg-rose-50/40 text-rose-900',
      badgeColor: 'bg-rose-600 text-white',
      items: [
        { title: isRTL ? 'خەرجی و مووچەی ئاشڵی' : 'Expenses & Payroll', href: '/ashley-expenses', icon: CreditCard, desc: isRTL ? 'تۆماری خەرجی، پاداشت و نرخی کاتژمێری' : 'Ashley expenses, rates & payroll' },
      ]
    },
    {
      categoryName: isRTL ? '⚙️ بەڕێوەبردنی سیستەم & ئەدمین' : 'System Administration & Settings',
      description: isRTL ? 'پەناڵی سەرەکی ئەدمین، هەژماری بەکاربهێنەر و ڕێکخستنی گشتی' : 'Admin panel, account profile, and app settings',
      color: 'border-purple-200 bg-purple-50/40 text-purple-900',
      badgeColor: 'bg-purple-600 text-white',
      items: [
        { title: isRTL ? 'پەناڵی ئەدمین (Admin Panel)' : 'Admin Dashboard', href: '/admin', icon: Shield, desc: isRTL ? 'پەناڵی سەرەکی بەڕێوەبەر' : 'Main administrator panel' },
        { title: isRTL ? 'هەژماری من' : 'My Profile Account', href: '/account', icon: UserCheck, desc: isRTL ? 'زانیاری هەژماری سەرەکی' : 'User account details' },
        { title: isRTL ? 'ڕێکخستنی گشتی' : 'System Configuration', href: '/settings', icon: Settings, desc: isRTL ? 'ڕێکخستنی سیستەم و زمان' : 'App configuration' },
      ]
    }
  ];

  return (
    <div className="space-y-6 w-full pb-16 text-right font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* ========================================================================= */}
      {/* 1. CLASSIC ERP HEADER RIBBON                                             */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/20 text-primary border border-primary/30 rounded-xl shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">
                ● OPEN SYSTEM ERP
              </span>
              <span className="text-xs text-slate-400 font-mono">{dateStr}</span>
            </div>
            <h1 className="text-xl font-black text-white mt-1">
              سیستەمی گشتی بەڕێوەبردنی ئاشڵی - <span className="text-primary font-bold">{activeUser}</span>
            </h1>
          </div>
        </div>

        {/* Live Clock & Action shortcuts */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center font-mono bg-slate-800 border border-slate-700 py-1.5 px-4 rounded-xl">
            <span className="text-[10px] text-slate-400 font-sans font-bold block">{isRTL ? 'کاتی فەرمی BAGHDAD' : 'Official Time'}</span>
            <span className="text-base font-black text-amber-400">{timeStr || '00:00:00'}</span>
          </div>

          <Button 
            onClick={() => router.push('/attendance/checkin')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer shadow-sm flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>{isRTL ? 'تۆمارکردنی دەوام' : 'Check-In Terminal'}</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. INSTANT EXECUTIVE SUMMARY KPI CARDS                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Staff Attendance Logs */}
        <Link href="/admin" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-emerald-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ئامادەبووانی دەوام</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors">{attendanceLogs?.length || 0}</p>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                  📷 تۆماری ئامادەبوون
                </span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 group-hover:scale-105 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 2: Active Staff */}
        <Link href="/employees" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-indigo-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">کۆی ستافی تۆمارکراو</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{employees?.length || 0}</p>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full inline-block">
                  👥 ستافی کۆمپانیا
                </span>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 3: Overtime Records */}
        <Link href="/overtime" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-amber-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تۆماری کاتی زیادە</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-amber-600 transition-colors">{overtime?.length || 0}</p>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
                  ⏱️ کاتژمێری زیادە
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 group-hover:scale-105 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPI 4: Financial Expenses */}
        <Link href="/ashley-expenses" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-rose-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تۆماری خەرجی کۆگا</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-rose-600 transition-colors">{expenses?.length || 0}</p>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full inline-block">
                  💳 دارایی & مووچە
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 group-hover:scale-105 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

      </div>

      {/* ========================================================================= */}
      {/* 3. CLASSIC ERP MODULES WORKSTATION (ALL 26 SYSTEM PAGES)                  */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        {systemModules.map((mod, idx) => (
          <Card key={idx} className={cn("border bg-white shadow-sm rounded-2xl overflow-hidden", mod.color)}>
            <CardHeader className="py-3 px-6 bg-white/70 border-b border-slate-200/80 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs", mod.badgeColor)}>
                    MODULE {idx + 1}
                  </span>
                  <CardTitle className="text-sm font-black text-slate-800 tracking-wide">{mod.categoryName}</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 font-bold mt-0.5">{mod.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {mod.items.map((item, i) => (
                  <Link key={i} href={item.href} className="group block">
                    <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl hover:border-primary hover:shadow-md transition-all duration-150 h-full flex flex-col justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-slate-50 text-slate-700 group-hover:bg-primary group-hover:text-white rounded-xl border border-slate-100 transition-colors shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 group-hover:text-primary transition-colors truncate">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold leading-tight line-clamp-2">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 group-hover:text-primary">
                        <span>کراوەیە</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
