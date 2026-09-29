'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  Map, 
  ArrowLeft, 
  Building2, 
  Warehouse, 
  CheckCircle2, 
  ShieldCheck,
} from 'lucide-react';
import { FactoryMapPicker, type CompanyLocation } from '@/components/maps/FactoryMapPicker';
import { DEFAULT_COMPANY_LOCATIONS, ASHLEY_BASE_LOCATION } from '@/lib/geo-constants';
import { logger } from '@/lib/logger';
import withAuth from '@/hooks/withAuth';

function GpsLocationsPage() {
  const [locations, setLocations] = useState<CompanyLocation[]>(DEFAULT_COMPANY_LOCATIONS);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
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
      logger.error('Error fetching locations:', err);
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
      logger.error('Failed to save locations:', err);
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
                <span>شوێنی لق و کۆگاکان</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/adm1n_pan0l"
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>گەڕانەوە</span>
            </Link>
          </div>
        </header>

        {isSaved && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fade-in shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>🎉 شوێنی لقەکان بە سەرکەوتوویی پاشەکەوت کرا!</span>
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
                      لقی ژمارە {index + 1}
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-black border border-cyan-200 dark:border-cyan-800/40">
                  سنوور: {loc.radiusMeters} م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی پانی</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                    {loc.lat?.toFixed(6) || ASHLEY_BASE_LOCATION.lat.toFixed(6)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی درێژی</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold mt-0.5 block">
                    {loc.lng?.toFixed(6) || ASHLEY_BASE_LOCATION.lng.toFixed(6)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>مەودای ڕێگەپێدراو: {loc.radiusMeters} مەتر</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button to Open Map Picker */}
        <div className="bg-white/90 dark:bg-[#2c2c2e]/90 p-6 rounded-[28px] border border-slate-200/80 dark:border-white/5 shadow-sm text-center">
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="px-6 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 active:scale-95 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-blue-500/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Map className="w-4 h-4" />
            <span>نەخشە و دەستکاریکردنی شوێن</span>
          </button>
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
