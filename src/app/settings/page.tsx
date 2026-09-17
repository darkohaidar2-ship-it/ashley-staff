'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { 
  Building2, 
  Save, 
  Sparkles, 
  Globe, 
  Printer, 
  ImageIcon as ImageIconLucide, 
  Link as LinkIcon, 
  Plus, 
  Check, 
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AppSettings } from '@/lib/types';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import Image from 'next/image';

function ImageControl({ 
  label, 
  description, 
  value, 
  onValueChange, 
  onFileUpload 
}: { 
  label: string; 
  description: string; 
  value: string | null; 
  onValueChange: (val: string) => void; 
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; 
}) {
  return (
    <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
        <CardTitle className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span>{label}</span>
          {value && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        </CardTitle>
        <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <div className="relative w-full h-28 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-2 flex items-center justify-center bg-slate-50/50 dark:bg-white/5 overflow-hidden">
          {value ? (
            <Image src={value} alt={label} fill className="object-contain p-1.5" unoptimized />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
              <ImageIconLucide className="w-8 h-8 opacity-40" />
              <span className="text-[10px]">هیچ وێنەیەک دانەنراوە</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <LinkIcon className="w-3 h-3" />
              <span>بەستەری وێنە (URL)</span>
            </div>
            <Input 
              value={value || ''} 
              onChange={e => onValueChange(e.target.value)} 
              placeholder="https://example.com/logo.png"
              className="h-8 text-xs font-mono rounded-lg bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
              <Plus className="w-3 h-3" />
              <span>بەرزکردنەوەی فایل (Upload File)</span>
            </div>
            <Input 
              type="file" 
              accept="image/*" 
              onChange={onFileUpload} 
              className="h-8 text-xs cursor-pointer file:cursor-pointer file:rounded-md file:border-0 file:bg-[#007AFF] file:text-white file:text-[10px] file:font-bold" 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const { settings, setSettings } = useAppContext();
  const { toast } = useToast();

  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const updateSetting = (key: string, value: any) => {
    setDraftSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateShiftSetting = (key: string, value: any) => {
    setDraftSettings(prev => ({
      ...prev,
      shiftSettings: {
        checkInTime: prev.shiftSettings?.checkInTime || '08:00',
        checkOutTime: prev.shiftSettings?.checkOutTime || '17:00',
        graceMinutes: prev.shiftSettings?.graceMinutes ?? 15,
        [key]: value
      }
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        updateSetting(fieldKey, base64);
        toast({
          title: "وێنەکە بارکرا",
          description: "تکایە کلیك لە پاشەکەوتکردن بکە بۆ جێگیرکردنی لۆگۆکە."
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    setSettings(draftSettings);

    // Sync default shift to attendance backend
    try {
      const shiftData = draftSettings.shiftSettings || { checkInTime: '08:00', checkOutTime: '17:00', graceMinutes: 15 };
      await fetch('/api/attendance/admin/shifts/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
      });
    } catch (err) {
      console.warn('Shift sync warning:', err);
    }

    setIsSaved(true);
    toast({
      title: "ڕێکخستنەکان پاشەکەوت کران",
      description: "ناسنامەی فەرمی کۆمپانیا و کاتەکانی دەوام بە سەرکەوتوویی نوێکرانەوە."
    });
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleResetDefaults = () => {
    if (!confirm('ئایا دڵنیایت لە گەڕانەوە بۆ زانیارییە سەرەتاییەکان؟')) return;
    setDraftSettings(prev => ({
      ...prev,
      motherCompanyName: 'کۆمپانیای گروپی دیوان',
      motherCompanySubtitle: 'ناسنامەی مۆبیلیات',
      brandName: 'کۆمپانیای مۆبیلیاتی ئاشڵی',
      brandSubtitle: 'Official Document',
      agencyTitle: 'بریکاری سەرەکی مۆبیلیاتی ئاشڵین لە هەموو عێراق',
      brandSlogan: 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)',
      letterheadDocumentTitle: 'خشتەی تۆماری ئامادەبوونی فەرمی',
      letterheadDocumentSubtitle: 'کۆمپانیای گروپی دیوان • بریکاری سەرەکی مۆبیلیاتی ئاشڵی',
      letterheadPrimaryColor: '#0f172a',
      letterheadAccentColor: '#d97706',
      letterheadTitleColor: '#0f172a',
      websiteLogo: '/ashley-logo.svg',
      reportLogo: '/ashley-logo.svg',
      diwanLogo: '/diwan-logo.svg',
      ashleyLogo: '/ashley-logo.svg',
      shiftSettings: {
        checkInTime: '08:00',
        checkOutTime: '17:00',
        graceMinutes: 15
      }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-[#121212] text-slate-900 dark:text-white p-4 sm:p-6 lg:p-8 dir-rtl" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 🏛️ Top Header Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-emerald-500/10 p-6 rounded-3xl border border-amber-500/20 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                ناسنامەی فەرمی کۆمپانیا و ڕێکخستنی لۆگۆکان
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ڕێکخستنی کۆمپانیای دایک (گروپی دیوان)، بریکاری سەرەکی مۆبیلیاتی ئاشڵی، دروشم، و جیاکردنەوەی لۆگۆی وێبسایت لە ڕاپۆرتەکان.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 px-3.5 py-1.5 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 ml-1.5 text-amber-600 dark:text-amber-400" /> 
              گروپی دیوان • مۆبیلیاتی ئاشڵی
            </Badge>
          </div>
        </div>

        {/* 🏢 Form 1: Official Corporate Details */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Building2 className="w-4 h-4 text-amber-500" />
              <span>زانیارییە فەرمییەکان، ناو و کورتەی کۆمپانیاکان</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              دەتوانیت ناو و کورتە (Subtitle)ی هەر کۆمپانیایەک بە ئارەزووی خۆت بنووسیت، بۆ نموونە لەبری 'کۆمپانیای دایک' بنووسیت 'ناسنامەی مۆبیلیات'.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Mother Company Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ناوی کۆمپانیا (گروپی دیوان)
                </Label>
                <Input 
                  value={draftSettings.motherCompanyName || ''}
                  onChange={e => updateSetting('motherCompanyName', e.target.value)}
                  placeholder="کۆمپانیای گروپی دیوان"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">ناوی فەرمی کۆمپانیا.</p>
              </div>

              {/* Mother Company Subtitle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  کورتە و ناسناوی کۆمپانیا (Subtitle)
                </Label>
                <Input 
                  value={draftSettings.motherCompanySubtitle ?? 'ناسنامەی مۆبیلیات'}
                  onChange={e => updateSetting('motherCompanySubtitle', e.target.value)}
                  placeholder="ناسنامەی مۆبیلیات"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">دەقی ژێر ناوی دیوان (وەک: ناسنامەی مۆبیلیات).</p>
              </div>

              {/* Agency Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ناونیشانی بریکاری سەرەکی (Agency Title)
                </Label>
                <Input 
                  value={draftSettings.agencyTitle || ''}
                  onChange={e => updateSetting('agencyTitle', e.target.value)}
                  placeholder="بریکاری سەرەکی مۆبیلیاتی ئاشڵین لە هەموو عێراق"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">پێگەی فەرمی کۆمپانیا لە عێراقدا.</p>
              </div>

              {/* Brand Name (Ashley Furniture) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ناوی براند (مۆبیلیاتی ئاشڵی)
                </Label>
                <Input 
                  value={draftSettings.brandName || ''}
                  onChange={e => updateSetting('brandName', e.target.value)}
                  placeholder="کۆمپانیای مۆبیلیاتی ئاشڵی"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">ناوی فەرمی براند.</p>
              </div>

              {/* Brand Subtitle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  کورتە و ناسناوی براند (Brand Subtitle)
                </Label>
                <Input 
                  value={draftSettings.brandSubtitle || ''}
                  onChange={e => updateSetting('brandSubtitle', e.target.value)}
                  placeholder="Official Document یان بەڵگەنامەی فەرمی"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">دەقی ژێر ناوی ئاشڵی لەسەر ڕاپۆرتەکان.</p>
              </div>

              {/* Brand Slogan */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  دروشم و کورتەی براند (Brand Slogan)
                </Label>
                <Input 
                  value={draftSettings.brandSlogan || ''}
                  onChange={e => updateSetting('brandSlogan', e.target.value)}
                  placeholder="Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">دروشمی فەرمی براند لە سەر ڕاپۆرت و پەڕەکان.</p>
              </div>

              {/* Center Document Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  تایتڵی فەرمی بابەت لە ناوەڕاست (Document Title)
                </Label>
                <Input 
                  value={draftSettings.letterheadDocumentTitle ?? 'خشتەی تۆماری ئامادەبوونی فەرمی'}
                  onChange={e => updateSetting('letterheadDocumentTitle', e.target.value)}
                  placeholder="خشتەی تۆماری ئامادەبوونی فەرمی"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">تایتڵی گەورەی بابەت لە ناوەڕاستی وەرەقەی فەرمی.</p>
              </div>

              {/* Center Document Subtitle / Code */}
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  ژێرنووسی بابەت یان کۆدی بەڵگەنامە (Subtitle / Code)
                </Label>
                <Input 
                  value={draftSettings.letterheadDocumentSubtitle ?? 'کۆمپانیای گروپی دیوان • بریکاری سەرەکی مۆبیلیاتی ئاشڵی'}
                  onChange={e => updateSetting('letterheadDocumentSubtitle', e.target.value)}
                  placeholder="کۆمپانیای گروپی دیوان • بریکاری سەرەکی مۆبیلیاتی ئاشڵی"
                  className="h-10 text-xs font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">دەقی ژێر تایتڵی سەرەکی یان کورتەی بابەت.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🎨 Form 1.2: Official Letterhead Colors Customizer */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Palette className="w-4 h-4 text-purple-500" />
                <span>دەستکاریکردنی ڕەنگەکانی وەرەقەی فەرمی (Letterhead Colors)</span>
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">
                ڕەنگی دەستی
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              دەتوانیت ڕەنگی دەقەکان، تایتڵی ناوەڕاست، دروشم، و هێڵە فەرمییەکان بە خواستی خۆت دیاری بکەیت.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Quick Color Presets */}
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <span className="text-[11px] font-bold text-slate-500 ml-2">کۆنسێپتە خێراکان:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateSetting('letterheadPrimaryColor', '#0f172a');
                  updateSetting('letterheadTitleColor', '#0f172a');
                  updateSetting('letterheadAccentColor', '#d97706');
                }}
                className="text-xs rounded-xl h-8 gap-1.5"
              >
                <span className="w-3 h-3 rounded-full bg-[#0f172a] border border-white/40 inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#d97706] inline-block -mr-1" />
                <span>فەرمی ئاڵتونی و ڕەش</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateSetting('letterheadPrimaryColor', '#065f46');
                  updateSetting('letterheadTitleColor', '#047857');
                  updateSetting('letterheadAccentColor', '#0284c7');
                }}
                className="text-xs rounded-xl h-8 gap-1.5"
              >
                <span className="w-3 h-3 rounded-full bg-[#065f46] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#0284c7] inline-block -mr-1" />
                <span>سەوزی ئاشڵی و شین</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateSetting('letterheadPrimaryColor', '#1e3a8a');
                  updateSetting('letterheadTitleColor', '#172554');
                  updateSetting('letterheadAccentColor', '#b45309');
                }}
                className="text-xs rounded-xl h-8 gap-1.5"
              >
                <span className="w-3 h-3 rounded-full bg-[#1e3a8a] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#b45309] inline-block -mr-1" />
                <span>شینی دیوان و ئاڵتونی</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateSetting('letterheadPrimaryColor', '#18181b');
                  updateSetting('letterheadTitleColor', '#09090b');
                  updateSetting('letterheadAccentColor', '#71717a');
                }}
                className="text-xs rounded-xl h-8 gap-1.5"
              >
                <span className="w-3 h-3 rounded-full bg-[#18181b] inline-block" />
                <span className="w-3 h-3 rounded-full bg-[#71717a] inline-block -mr-1" />
                <span>مۆدێرن مۆنۆکرۆم</span>
              </Button>
            </div>

            {/* Custom Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Primary & Border Color */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>ڕەنگی سەرەکی و هێڵەکان</span>
                  <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: draftSettings.letterheadPrimaryColor || '#0f172a' }} />
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={draftSettings.letterheadPrimaryColor || '#0f172a'} 
                    onChange={e => updateSetting('letterheadPrimaryColor', e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 bg-white"
                  />
                  <Input 
                    value={draftSettings.letterheadPrimaryColor || '#0f172a'}
                    onChange={e => updateSetting('letterheadPrimaryColor', e.target.value)}
                    className="h-9 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-400">ڕەنگی هێڵی جیاکەرەوە و ناوی سەرەکی کۆمپانیاکان.</p>
              </div>

              {/* Title Color */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>ڕەنگی تایتڵی ناوەڕاست</span>
                  <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: draftSettings.letterheadTitleColor || '#0f172a' }} />
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={draftSettings.letterheadTitleColor || '#0f172a'} 
                    onChange={e => updateSetting('letterheadTitleColor', e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 bg-white"
                  />
                  <Input 
                    value={draftSettings.letterheadTitleColor || '#0f172a'}
                    onChange={e => updateSetting('letterheadTitleColor', e.target.value)}
                    className="h-9 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-400">ڕەنگی دەقی تایتڵی بابەت لە ناوەڕاستدا.</p>
              </div>

              {/* Accent & Subtitle Color */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>ڕەنگی دروشم و کورتەکان (Accent)</span>
                  <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: draftSettings.letterheadAccentColor || '#d97706' }} />
                </Label>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={draftSettings.letterheadAccentColor || '#d97706'} 
                    onChange={e => updateSetting('letterheadAccentColor', e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-600 cursor-pointer p-0.5 bg-white"
                  />
                  <Input 
                    value={draftSettings.letterheadAccentColor || '#d97706'}
                    onChange={e => updateSetting('letterheadAccentColor', e.target.value)}
                    className="h-9 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-400">ڕەنگی دەقی ناسنامەی مۆبیلیات و کورتەی براند.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ⏰ Form 1.5: Official Shift Times & Grace Period */}
        <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-white/5">
            <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-[#007AFF]" />
              <span>کاتەکانی دەوامی فەرمی و ماوەی لێخۆشبوون (Official Shift & Attendance Rules)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              ئەم کاتانە بنەمای ئەژمارکردنی هاتن لە کاتی خۆیدا، درەنگکەوتن، ڕۆیشتنی پێشوەختە، و ئۆڤەرتایمن لە هەموو بەشەکانی سیستەمدا.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Check-In Time */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>کاتی دەستپێکی دەوام (هاتن)</span>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-[#007AFF] border-blue-500/30">دەستپێک</Badge>
                </Label>
                <Input 
                  type="time"
                  value={draftSettings.shiftSettings?.checkInTime || '08:00'}
                  onChange={e => updateShiftSetting('checkInTime', e.target.value)}
                  className="h-10 text-sm font-mono font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">کاتی فەرمی هاتن (پێشگریمانە: 08:00 بەیانی).</p>
              </div>

              {/* Check-Out Time */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>کاتی کۆتایی دەوام (ڕۆیشتن)</span>
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/30">کۆتایی</Badge>
                </Label>
                <Input 
                  type="time"
                  value={draftSettings.shiftSettings?.checkOutTime || '17:00'}
                  onChange={e => updateShiftSetting('checkOutTime', e.target.value)}
                  className="h-10 text-sm font-mono font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">کاتی فەرمی دەرچوون (پێشگریمانە: 17:00 ئێوارە).</p>
              </div>

              {/* Grace Period */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>ماوەی لێخۆشبوون (خولەک)</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Grace</Badge>
                </Label>
                <Input 
                  type="number"
                  min={0}
                  max={60}
                  value={draftSettings.shiftSettings?.graceMinutes ?? 15}
                  onChange={e => updateShiftSetting('graceMinutes', parseInt(e.target.value) || 0)}
                  className="h-10 text-sm font-mono font-bold bg-slate-50 dark:bg-[#2c2c2e] border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <p className="text-[10px] text-slate-400">ماوەی ڕێگەپێدراو پێش ئەوەی درەنگکەوتن ئەژمار بکرێت (15 خولەک).</p>
              </div>

            </div>

            {/* Quick Rules Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-[11px] space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  ☕ کاتی پشووی نیوەڕۆ (12:00 - 13:00)
                </span>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[10px]">
                  یەک کاتژمێری تەواو بۆ نانخواردن و پشوو بە شێوەی ئۆتۆماتیکی لە کاتژمێرەکانی کار لێدەردەکرێت.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] space-y-1">
                <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  ⚠️ مەرجی تێبینی درەنگکەوتن
                </span>
                <p className="text-amber-700 dark:text-amber-400 leading-relaxed text-[10px]">
                  هاتن پاش کاتژمێر 08:15 وەک درەنگکەوتوو (Late) تۆمار دەبێت و پێویستی بە نووسینی هۆکار هەیە لە مۆبایل.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  ⏱️ ئۆڤەرتایم و غائیب
                </span>
                <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed text-[10px]">
                  پاش 17:15 وەک کاتی زیادە دادەنرێت. ڕۆژانی ڕابردووش بەبێ دەوام ئۆتۆماتیکی بە &ldquo;غائیب&rdquo; دەنووسرێت لە خشتەدا.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🖼️ Form 2: 4 Separate Logos */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">جیاکردنەوەی لۆگۆکان (Website Logo vs Report Logo)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">دەتوانیت لۆگۆی جیاواز بۆ وێبسایت دیاری بکەیت بە بەراورد بە لۆگۆی ڕاپۆرت و چاپ.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Website & App Logo */}
            <ImageControl 
              label="🌐 لۆگۆی وێبسایت و داشبۆرد" 
              description="ئەم لۆگۆیە لە هێدەری وێبسایت، مینیو، و لاپەڕەی چوونەژوورەوە نیشان دەدرێت." 
              value={draftSettings.websiteLogo || draftSettings.appLogo} 
              onValueChange={v => {
                updateSetting('websiteLogo', v);
                updateSetting('appLogo', v);
              }}
              onFileUpload={e => {
                handleFileUpload(e, 'websiteLogo');
                handleFileUpload(e, 'appLogo');
              }}
            />

            {/* 2. Official Report Logo */}
            <ImageControl 
              label="📄 لۆگۆی ڕاپۆرتە فەرمییەکان" 
              description="ئەم لۆگۆیە لەسەر وەرەقەی فەرمی، خشتەی ئامادەبوونی چاپکراو، و فایلی PDF نیشان دەدرێت." 
              value={draftSettings.reportLogo || draftSettings.ashleyLogo || draftSettings.appLogo} 
              onValueChange={v => updateSetting('reportLogo', v)}
              onFileUpload={e => handleFileUpload(e, 'reportLogo')}
            />

            {/* 3. Diwan Group Logo */}
            <ImageControl 
              label="🏛️ لۆگۆی گروپی دیوان (کۆمپانیای دایک)" 
              description="لۆگۆی فەرمی کۆمپانیای دایک بۆ دانان لە هێدەری ڕاپۆرتەکان شانبەشانی ئاشڵی." 
              value={draftSettings.diwanLogo} 
              onValueChange={v => updateSetting('diwanLogo', v)}
              onFileUpload={e => handleFileUpload(e, 'diwanLogo')}
            />

            {/* 4. Ashley Furniture Logo */}
            <ImageControl 
              label="🛋️ لۆگۆی مۆبیلیاتی ئاشڵی" 
              description="لۆگۆی تایبەت بە براندی نێودەوڵەتی مۆبیلیاتی ئاشڵی." 
              value={draftSettings.ashleyLogo || draftSettings.appLogo} 
              onValueChange={v => updateSetting('ashleyLogo', v)}
              onFileUpload={e => handleFileUpload(e, 'ashleyLogo')}
            />
          </div>
        </div>

        {/* 👁️ Live Interactive Dual-Preview */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>پێشبینی ڕاستەوخۆ: جیاوازی نێوان وێبسایت و ڕاپۆرتی چاپکراو (Live Dual Preview)</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Preview 1: Website Header */}
            <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-white/5 py-3 px-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-xs font-bold text-slate-900 dark:text-white">پێشبینی هێدەری وێبسایت و داشبۆرد</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20">
                    وێبسایت (Web UI)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#2c2c2e] p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative w-28 h-10 bg-white dark:bg-black/20 rounded-lg p-1 flex items-center justify-center overflow-hidden border border-slate-200/50 dark:border-white/5">
                      <Image 
                        src={draftSettings.websiteLogo || draftSettings.appLogo || '/ashley-logo.png'} 
                        alt="Website Logo Preview" 
                        fill 
                        className="object-contain p-1" 
                        unoptimized 
                      />
                    </div>
                    <div className="border-r border-slate-200 dark:border-slate-700 pr-3">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        {draftSettings.motherCompanyName || 'کۆمپانیای گروپی دیوان'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {draftSettings.motherCompanySubtitle || 'ناسنامەی مۆبیلیات'} • {draftSettings.agencyTitle || 'بریکاری سەرەکی مۆبیلیاتی ئاشڵین لە هەموو عێراق'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 bg-white dark:bg-white/10 px-2 py-1 rounded-md border border-slate-200/60 dark:border-white/5">
                    {draftSettings.shiftSettings?.checkInTime || '08:00'} - {draftSettings.shiftSettings?.checkOutTime || '17:00'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preview 2: Official Printable Letterhead */}
            <Card className="border border-slate-200/80 dark:border-white/10 shadow-xs bg-white dark:bg-[#1c1c1e] rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-white/5 py-3 px-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-500" />
                    <CardTitle className="text-xs font-bold text-slate-900 dark:text-white">پێشبینی وەرەقەی فەرمی ڕاپۆرت و چاپ (Letterhead)</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    چاپ و PDF (Print Letterhead)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 bg-white text-slate-900">
                <div className="rounded-xl border border-slate-200 p-3 bg-white space-y-2.5">
                  <div 
                    className="flex items-center justify-between pb-2.5"
                    style={{ borderBottom: `2px solid ${draftSettings.letterheadPrimaryColor || '#0f172a'}` }}
                  >
                    {/* 1. لە ڕاستەوە: لۆگۆی دیوان پاشان ناوی دیوان و کورتەی بازرگانی */}
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-14 h-9 flex items-center justify-center flex-shrink-0">
                        <Image 
                          src={draftSettings.diwanLogo || '/diwan-logo.svg'} 
                          alt="Diwan Logo" 
                          fill 
                          className="object-contain" 
                          unoptimized 
                        />
                      </div>
                      <div className="text-right">
                        <div 
                          className="text-[11px] font-black leading-tight"
                          style={{ color: draftSettings.letterheadPrimaryColor || '#0f172a' }}
                        >
                          {draftSettings.motherCompanyName || 'کۆمپانیای گروپی دیوان'}
                        </div>
                        <div 
                          className="text-[9px] font-bold mt-0.5"
                          style={{ color: draftSettings.letterheadAccentColor || '#d97706' }}
                        >
                          {draftSettings.motherCompanySubtitle || 'ناسنامەی مۆبیلیات'}
                        </div>
                      </div>
                    </div>

                    {/* 2. ناوەڕاست: تەنها تایتڵی بابەتەکە (هیچ لەژێریا نانووسرێت) */}
                    <div className="text-center px-3 flex-1 max-w-[42%]">
                      <div 
                        className="text-xs sm:text-sm font-black leading-tight"
                        style={{ color: draftSettings.letterheadTitleColor || draftSettings.letterheadPrimaryColor || '#0f172a' }}
                      >
                        {draftSettings.letterheadDocumentTitle || 'خشتەی تۆماری ئامادەبوونی فەرمی'}
                      </div>
                    </div>

                    {/* 3. لە چەپەوە: ناوی ئاشڵی و کورتەی بازرگانی پاشان لۆگۆکەی */}
                    <div className="flex items-center gap-2.5">
                      <div className="text-left">
                        <div 
                          className="text-[11px] font-black leading-tight"
                          style={{ color: draftSettings.letterheadPrimaryColor || '#0f172a' }}
                        >
                          {draftSettings.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی'}
                        </div>
                        <div 
                          className="text-[9px] font-bold mt-0.5"
                          style={{ color: draftSettings.letterheadAccentColor || '#d97706' }}
                        >
                          {draftSettings.brandSubtitle || draftSettings.brandSlogan || 'Official Document'}
                        </div>
                      </div>
                      <div className="relative w-14 h-9 flex items-center justify-center flex-shrink-0">
                        <Image 
                          src={draftSettings.reportLogo || draftSettings.ashleyLogo || draftSettings.appLogo || '/ashley-logo.png'} 
                          alt="Ashley Logo" 
                          fill 
                          className="object-contain" 
                          unoptimized 
                        />
                      </div>
                    </div>
                  </div>

                  {/* شریتی ڕوونکردنەوەی خشتەکە لەسەر خشتەکە */}
                  <div 
                    className="h-6 rounded-lg flex items-center justify-between px-3 text-[9px] font-bold"
                    style={{ 
                      backgroundColor: `${draftSettings.letterheadPrimaryColor || '#0f172a'}0A`,
                      border: `1px solid ${draftSettings.letterheadPrimaryColor || '#0f172a'}18`,
                      color: draftSettings.letterheadPrimaryColor || '#0f172a'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: draftSettings.letterheadAccentColor || '#d97706' }} />
                      <span>📋 ڕوونکردنەوەی خشتە: تۆماری فەرمی ئامادەبوونی ۳۱ ڕۆژەیی • دەوامی 08:00 هاتن - 17:00 دەرچوون</span>
                    </div>
                    <span className="font-mono text-[8.5px] opacity-80">کۆدی فەرمی: ASH-DGP-2026</span>
                  </div>

                  {/* واژووەکانی خوارەوە بەپێی ئەرکەکان بەبێ مۆر و ناوی پێشوەختە */}
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-right">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[9px]">
                      <div className="font-bold text-slate-800 text-center pb-1 border-b border-slate-200">سەرپەرشتیاری ئایتی</div>
                      <div className="text-slate-500 font-medium pt-1">ناو: ....................</div>
                      <div className="text-slate-500 font-medium pt-0.5">واژوو: ....................</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[9px]">
                      <div className="font-bold text-slate-800 text-center pb-1 border-b border-slate-200">بەڕێوەبەری کۆگا</div>
                      <div className="text-slate-500 font-medium pt-1">ناو: ....................</div>
                      <div className="text-slate-500 font-medium pt-0.5">واژوو: ....................</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70 text-[9px]">
                      <div className="font-bold text-slate-800 text-center pb-1 border-b border-slate-200">بەڕێوەبەر</div>
                      <div className="text-slate-500 font-medium pt-1">ناو: ....................</div>
                      <div className="text-slate-500 font-medium pt-0.5">واژوو: ....................</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 💾 Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>گەڕانەوە بۆ پێشگریمانە (Defaults)</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            className={`px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer ${
              isSaved ? 'bg-emerald-600' : 'bg-[#007AFF] hover:bg-[#0062cc]'
            }`}
          >
            {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{isSaved ? 'پاشەکەوتکرا!' : 'پاشەکەوتکردنی هەموو ڕێکخستنەکان'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default withAuth(SettingsPage);
