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
  Sparkles,
  Layers,
  ChevronLeft
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
      alert('کێشەیەک لە پاشەکەوتکردن ڕوویدا!');
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 p-3 sm:p-6 lg:p-8 dir-rtl font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-200/80 text-cyan-600 flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <span>شوێنی لق و کۆگاکان (GPS)</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                دیاریکردنی سنووری ڕێگەپێدراوی جوگرافی بۆ تۆمارکردنی کاتەکانی دەوام
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/adm1n_pan0l"
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>گەڕانەوە بۆ داشبۆرد</span>
            </Link>
          </div>
        </header>

        {isSaved && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold animate-fade-in shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>شوێنی لقەکان بە سەرکەوتوویی پاشەکەوت کرا!</span>
          </div>
        )}

        {/* Locations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc, index) => (
            <div 
              key={loc.id || index}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4 transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200/60 text-cyan-600 flex items-center justify-center font-bold">
                    {index === 0 ? <Building2 className="w-4 h-4" /> : <Warehouse className="w-4 h-4" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">
                      {loc.name}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-medium">
                      لقی ژمارە {index + 1}
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-mono font-bold border border-cyan-200/80">
                  سنوور: {loc.radiusMeters} م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی پانی (Latitude)</span>
                  <span className="text-slate-800 font-mono font-bold mt-0.5 block">
                    {loc.lat?.toFixed(6) || ASHLEY_BASE_LOCATION.lat.toFixed(6)}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-slate-400 text-[10px] block font-medium">هێڵی درێژی (Longitude)</span>
                  <span className="text-slate-800 font-mono font-bold mt-0.5 block">
                    {loc.lng?.toFixed(6) || ASHLEY_BASE_LOCATION.lng.toFixed(6)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>مەودای ڕێگەپێدراوی دەوام: {loc.radiusMeters} مەتر لە چەقی شوێنەکە</span>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button to Open Map Picker */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs text-center">
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Map className="w-4 h-4 text-cyan-400" />
            <span>کردنەوەی نەخشەی ئەلیکترۆنی و دەستکاریکردنی شوێنەکان</span>
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
