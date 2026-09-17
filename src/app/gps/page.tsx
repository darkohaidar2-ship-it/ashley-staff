'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  Map, 
  ArrowLeft, 
  Building2, 
  Warehouse, 
  Sparkles, 
  CheckCircle2, 
  Navigation,
  Compass,
  Layers,
  Save,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { FactoryMapPicker, type CompanyLocation } from '@/components/maps/FactoryMapPicker';
import { useAppContext } from '@/context/app-provider';
import withAuth from '@/hooks/withAuth';

const DEFAULT_TWO_BRANCHES: CompanyLocation[] = [
  {
    id: 'ashley-base-main',
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 100,
  },
  {
    id: 'huana-warehouse-main',
    name: 'کۆگای سەرەکی هوانە (Huana Warehouse)',
    lat: 35.6012,
    lng: 45.3850,
    radiusMeters: 120,
  },
];

function GpsLocationsPage() {
  const { settings } = useAppContext();
  const [locations, setLocations] = useState<CompanyLocation[]>(DEFAULT_TWO_BRANCHES);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/attendance/location?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.locations && Array.isArray(data.locations) && data.locations.length > 0) {
          setLocations(data.locations);
        } else if (data?.lat && data?.lng) {
          setLocations([data]);
        }
      }
    } catch (err) {
      console.error('Error fetching GPS locations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleSaveLocations = async (newLocations: CompanyLocation[]) => {
    try {
      await fetch('/api/attendance/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: newLocations })
      });
      setLocations(newLocations);
      setShowMapPicker(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (err) {
      console.error('Failed to save locations:', err);
      alert('⚠️ کێشەیەک لە پاشەکەوتکردن ڕوویدا!');
    }
  };

  return (
    <main className="min-h-screen bg-[#f2f2f7] dark:bg-[#1c1c1e] text-slate-900 dark:text-white p-3 sm:p-6 lg:p-8 dir-rtl font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white/80 dark:bg-[#2c2c2e]/80 border border-slate-200/80 dark:border-white/5 rounded-[24px] shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                <span>بەڕێوەبردنی لۆکەیشنەکانی GPS و بازنەی چێک‌ئین</span>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/40 text-[10px] font-mono font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Geofence 2.0</span>
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                دیاریکردنی شوێنی فەرمی کارگە و کۆگاکان لەسەر نەخشە و سنووری ڕێگەپێدراو بۆ دەوام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>داشبۆردی سەرەکی</span>
            </Link>
          </div>
        </header>

        {isSaved && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fade-in shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>🎉 هەردوو لۆکەیشنی فەرمی و بازنەی GPS بە سەرکەوتوویی لە سێرڤەر و دەاتابەیس پاشەکەوت کران!</span>
          </div>
        )}

        {/* Locations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc, index) => (
            <div 
              key={loc.id || index}
              className="bg-white/90 dark:bg-[#2c2c2e]/90 p-5 rounded-[24px] border border-slate-200/80 dark:border-white/5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold">
                    {index === 0 ? <Building2 className="w-4 h-4" /> : <Warehouse className="w-4 h-4" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">
                      {loc.name}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-medium">
                      لۆکەیشنی فەرمی ژمارە {index + 1}
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-black border border-cyan-200 dark:border-cyan-800/40">
                  مەودا: {loc.radiusMeters}m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی پانی (Latitude)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                    {loc.lat?.toFixed(6) || '35.557100'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی درێژی (Longitude)</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                    {loc.lng?.toFixed(6) || '45.435200'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>کارمەندان تەنها لەناو بازنەی {loc.radiusMeters} مەتریی ئەم شوێنەدا دەتوانن دەوام تۆمار بکەن.</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button to Open Map Picker */}
        <div className="bg-white/90 dark:bg-[#2c2c2e]/90 p-6 rounded-[28px] border border-slate-200/80 dark:border-white/5 shadow-sm text-center space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              دەستکاریکردن یان نوێکردنەوە لەسەر نەخشەی زیندوو
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              دەتوانیت بە دراگ و درۆپ شوێنی هەر لقێک بگۆڕیت و بازنەی ڕێگەپێدراوی GPS بە سانتیمەتر و مەتر فراوان یان تەسک بکەیتەوە.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-blue-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Map className="w-4 h-4" />
            <span>کردنەوەی نەخشەی زیندووی کۆمپانیا و دەستکاریکردن</span>
          </button>
        </div>

        {/* Active Geofence Information Card */}
        <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 p-5 rounded-[24px] flex items-start gap-3.5">
          <Smartphone className="w-5 h-5 text-[#007AFF] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-black text-blue-950 dark:text-blue-200">
              ئاگاداری گرنگ دەربارەی سیستەمی ئامادەبوونی مۆبایل:
            </h4>
            <p className="text-blue-800/90 dark:text-blue-300 leading-relaxed font-medium">
              ئەم پۆینتانە ڕاستەوخۆ دەگوازرێنەوە بۆ ئەپی مۆبایلی کارمەندان. هەرکاتێک کارمەندێک لە دەرەوەی ئەم دوو بازنەیە بێت، سیستەم ڕێگری لە چێک‌ئین دەکات و ئاگاداری دەکاتەوە کە لە شوێنی دیاریکراوی کار نییە.
            </p>
          </div>
        </div>

      </div>

      {/* Map Picker Modal */}
      {showMapPicker && (
        <FactoryMapPicker
          initialLocations={locations}
          isRTL={true}
          onSave={handleSaveLocations}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </main>
  );
}

export default withAuth(GpsLocationsPage);
