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
  const { items, locations, employees, expenses } = useAppContext();
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

  // System Modules (ALL 26 System Pages Categorized)
  const systemModules = [
    {
      categoryName: isRTL ? '📦 سیستەمی کۆگا & جەرد' : 'Warehouse & Inventory System',
      description: isRTL ? 'گەڕان لە کاڵاکان، شوێنەکانی خەزنکردن، نەخشەی کۆگا و ئەرشیف' : 'Search inventory, storage zones, maps, and imports',
      color: 'border-blue-200 bg-blue-50/40 text-blue-900',
      badgeColor: 'bg-blue-600 text-white',
      items: [
        { title: isRTL ? 'جەرد و کاڵاکان' : 'Inventory Items Search', href: '/items', icon: Box, desc: isRTL ? 'گەڕانی خێرا بەپێی مۆدێل و کۆد' : 'Search items by model & location' },
        { title: isRTL ? 'شوێنەکانی کۆگا' : 'Storage Locations', href: '/locations', icon: MapPin, desc: isRTL ? 'بەڕێوەبردنی شوێن و بەشەکان' : 'Manage storage zones & floors' },
        { title: isRTL ? 'نەخشەی سەرەکی کۆگا' : 'Visual Layout Map', href: '/warehouse-map', icon: LayoutGrid, desc: isRTL ? 'سەیرکردنی نەخشەی گرافیکی 2D' : 'Interactive 2D warehouse map' },
        { title: isRTL ? 'نەخشەی هوانە' : 'Huana Warehouse Map', href: '/huana-map', icon: Map, desc: isRTL ? 'نەخشەی کۆگای هوانە' : 'Huana storage map layout' },
        { title: isRTL ? 'نەخشەی بینای ئاشڵی' : 'Ashley Building Map', href: '/ashley-map', icon: Layers, desc: isRTL ? 'نەخشەی قاتی ٣ و ٤ی ئاشڵی' : 'Ashley floor 3 & 4 layout' },
        { title: isRTL ? 'بەڕێوەبردنی نەخشەكان' : 'Map Configuration', href: '/map-management', icon: Settings, desc: isRTL ? 'دروستکردنی کۆدی نەخشەکان' : 'Configure warehouse maps' },
        { title: isRTL ? 'هاوردەکردنی ئێکسڵ' : 'Excel Import', href: '/import', icon: Upload, desc: isRTL ? 'داغڵکردنی فایلی Excel' : 'Import items from Excel' },
        { title: isRTL ? 'هاوردەکردنی PDF' : 'PDF Import', href: '/import-pdf', icon: FileCheck, desc: isRTL ? 'خوێندنەوەی فایلی PDF' : 'Import data from PDF' },
        { title: isRTL ? 'ئەرشیفی جەردەکان' : 'Inventory Archive', href: '/archive', icon: Archive, desc: isRTL ? 'بینینی فایلی جەردە کۆنەکان' : 'Archived inventory list' },
        { title: isRTL ? 'ئەرشیفی PDF' : 'PDF Archive', href: '/pdf-archive', icon: FileText, desc: isRTL ? 'فایلە ئەرشیفکراوەکانی PDF' : 'Archived PDF documents' },
        { title: isRTL ? 'جەردی گشتی (Public)' : 'Public Inventory View', href: '/public-inventory', icon: ExternalLink, desc: isRTL ? 'لاپەڕەی گشتی سەیرکردنی جەرد' : 'Public read-only view' },
        { title: isRTL ? 'گواستنەوەی بار (Public)' : 'Cargo Transport', href: '/public-transmit', icon: TrendingUp, desc: isRTL ? 'تۆماری گواستنەوەی بار' : 'Cargo transmit page' },
      ]
    },
    {
      categoryName: isRTL ? '👥 سیستەمی ستاف & ئامادەبوونی کارمەندان' : 'Staff & Attendance System',
      description: isRTL ? 'تۆمارکردنی دەوام بە کامێرا و GPS، ڕۆژژمێری مانگانە و ڕاپۆرتەکان' : 'Geofenced check-in, attendance calendar, and staff logs',
      color: 'border-emerald-200 bg-emerald-50/40 text-emerald-900',
      badgeColor: 'bg-emerald-600 text-white',
      items: [
        { title: isRTL ? 'تۆمارکردنی دەوام (Check-In)' : 'Camera Check-In', href: '/attendance/checkin', icon: Camera, desc: isRTL ? 'سێڵفی + GPS لۆکەیشن' : 'Selfie check-in with GPS' },
        { title: isRTL ? 'ئامادەبوونی من' : 'My Attendance Calendar', href: '/attendance', icon: Calendar, desc: isRTL ? 'خشتە و ڕۆژژمێری مانگانەم' : 'Personal attendance log' },
        { title: isRTL ? 'بارکۆدی تابلێتی کۆگا' : 'Tablet Live QR Code', href: '/attendance/qr?wh=warehouse_1', icon: MonitorPlay, desc: isRTL ? 'پیشاندانی بارکۆد لەسەر تابلێت' : 'Display dynamic QR code' },
        { title: isRTL ? 'بەڕێوەبردنی ئامادەبووان' : 'Attendance Admin Control', href: '/admin/attendance', icon: ClipboardList, desc: isRTL ? 'کاتەکان، پشووەکان و کۆگاکان' : 'Shifts, holidays & Geofence' },
        { title: isRTL ? 'ناوی کارمەندان' : 'Employees Directory', href: '/employees', icon: Users, desc: isRTL ? 'لیستی ستافی کۆمپانیا' : 'Company staff directory' },
      ]
    },
    {
      categoryName: isRTL ? '💳 سیستەمی دارایی & خەرجییەکان' : 'Finance & Expenses System',
      description: isRTL ? 'بەڕێوەبردنی خەرجی ڕۆژانە، مووچە، پاداشتەکان و ڕاپۆرتەکان' : 'Daily expenses, payroll, bonuses, and reports',
      color: 'border-rose-200 bg-rose-50/40 text-rose-900',
      badgeColor: 'bg-rose-600 text-white',
      items: [
        { title: isRTL ? 'خەرجی و مووچەی ئاشڵی' : 'Expenses & Payroll', href: '/ashley-expenses', icon: CreditCard, desc: isRTL ? 'تۆماری خەرجی و کێشاوەکان' : 'Ashley expenses & payroll' },
        { title: isRTL ? 'ڕێکخستنی خەرجییەکان' : 'Expense Settings', href: '/ashley-expenses-settings', icon: Settings, desc: isRTL ? 'پۆلێنکردنی خەرجییەکان' : 'Expense category settings' },
        { title: isRTL ? 'کاڵا فڕۆشراوەکان' : 'Sold Items History', href: '/sold-items', icon: DollarSign, desc: isRTL ? 'تۆماری فرۆشتنی کاڵاکان' : 'History of sold items' },
        { title: isRTL ? 'دیزاینەری ڕاپۆرت' : 'Report Designer', href: '/report-designer', icon: FileSpreadsheet, desc: isRTL ? 'دیزاینکردنی ڕاپۆرتی تایبەت' : 'Custom PDF report builder' },
        { title: isRTL ? 'دروستکردنی فایلی نوێ' : 'Create New Document', href: '/new-file', icon: FilePlus, desc: isRTL ? 'تۆمارکردنی بەڵگەنامەی نوێ' : 'Create new ERP file' },
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
        
        {/* KPI 1: Warehouse Inventory */}
        <Link href="/items" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-blue-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">کۆی کاڵاکانی کۆگا</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors">{items?.length || 0}</p>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                  📦 جەردی کاڵاکان
                </span>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 group-hover:scale-105 transition-transform">
                <Box className="w-6 h-6" />
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

        {/* KPI 3: Storage Locations */}
        <Link href="/locations" className="block group">
          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl hover:border-amber-400 hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">شوێنەکانی خەزنکردن</span>
                <p className="text-2xl font-black text-slate-800 group-hover:text-amber-600 transition-colors">{locations?.length || 0}</p>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
                  📍 بەشەکان & قاتەکان
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 group-hover:scale-105 transition-transform">
                <MapPin className="w-6 h-6" />
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
