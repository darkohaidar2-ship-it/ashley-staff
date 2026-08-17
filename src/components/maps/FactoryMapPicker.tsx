'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, MapPin, Check, Search, Navigation } from 'lucide-react';

export interface CompanyLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

interface FactoryMapPickerProps {
  initialLocations?: CompanyLocation[];
  initialLat?: number;
  initialLng?: number;
  initialRadius?: number;
  factoryName?: string;
  isRTL: boolean;
  onSave: (locations: CompanyLocation[]) => void;
  onClose: () => void;
}

export function FactoryMapPicker({
  initialLocations,
  initialLat = 35.5571,
  initialLng = 45.4352,
  initialRadius = 50,
  factoryName = 'کۆمپانیای سەرەکی ئاشڵی',
  isRTL,
  onSave,
  onClose,
}: FactoryMapPickerProps) {
  // Array of multiple company branches
  const [locations, setLocations] = useState<CompanyLocation[]>(() => {
    if (initialLocations && initialLocations.length > 0) {
      return initialLocations;
    }
    return [
      {
        id: 'main-company-location',
        name: factoryName || 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
        lat: initialLat || 35.5571,
        lng: initialLng || 45.4352,
        radiusMeters: initialRadius || 50,
      },
    ];
  });

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const activeLoc = locations[selectedIdx] || locations[0];

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);

  // Load Leaflet CSS & JS
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const loadLeafletScript = () => {
      if ((window as any).L) {
        initMap((window as any).L);
        return;
      }

      if (!document.getElementById('leaflet-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          if ((window as any).L) {
            initMap((window as any).L);
          }
        };
        document.body.appendChild(script);
      }
    };

    loadLeafletScript();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = (L: any) => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const startLat = activeLoc?.lat || 35.5571;
    const startLng = activeLoc?.lng || 45.4352;

    const map = L.map(mapContainerRef.current).setView([startLat, startLng], 15);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Map click moves currently selected location
    map.on('click', (e: any) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));
      updateActiveLocation({ lat: clickLat, lng: clickLng });
    });

    renderAllMarkersAndCircles(L);
  };

  const renderAllMarkersAndCircles = (L: any = (window as any).L) => {
    if (!L || !mapInstanceRef.current) return;

    // Clear old markers & circles
    markersRef.current.forEach((m) => m.remove());
    circlesRef.current.forEach((c) => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    locations.forEach((loc, idx) => {
      const isSelected = idx === selectedIdx;

      // Marker
      const marker = L.marker([loc.lat, loc.lng], { draggable: isSelected }).addTo(mapInstanceRef.current);
      marker.bindPopup(`<b>${loc.name}</b><br/>مەودا: ${loc.radiusMeters}m`);
      if (isSelected) marker.openPopup();

      if (isSelected) {
        marker.on('dragend', (e: any) => {
          const newPos = e.target.getLatLng();
          updateActiveLocation({
            lat: Number(newPos.lat.toFixed(6)),
            lng: Number(newPos.lng.toFixed(6)),
          });
        });
      }

      markersRef.current.push(marker);

      // Circle
      const circle = L.circle([loc.lat, loc.lng], {
        color: isSelected ? '#10b981' : '#6366f1',
        fillColor: isSelected ? '#10b981' : '#6366f1',
        fillOpacity: isSelected ? 0.25 : 0.12,
        radius: loc.radiusMeters || 50,
      }).addTo(mapInstanceRef.current);

      circlesRef.current.push(circle);
    });
  };

  // Re-render markers and pan whenever locations or selected location changes
  useEffect(() => {
    if ((window as any).L && mapInstanceRef.current) {
      renderAllMarkersAndCircles((window as any).L);
      if (activeLoc) {
        mapInstanceRef.current.panTo([activeLoc.lat, activeLoc.lng]);
      }
    }
  }, [locations, selectedIdx]);

  const updateActiveLocation = (fields: Partial<CompanyLocation>) => {
    setLocations((prev) =>
      prev.map((loc, idx) => (idx === selectedIdx ? { ...loc, ...fields } : loc))
    );
  };

  const handleAddNewBranch = () => {
    const newId = `loc-${Date.now().toString().slice(-6)}`;
    const newBranchNum = locations.length + 1;
    const offsetLat = (activeLoc?.lat || 35.5571) + (Math.random() - 0.5) * 0.005;
    const offsetLng = (activeLoc?.lng || 45.4352) + (Math.random() - 0.5) * 0.005;

    const newLoc: CompanyLocation = {
      id: newId,
      name: `لقی نوێی ${newBranchNum} (Branch ${newBranchNum})`,
      lat: Number(offsetLat.toFixed(6)),
      lng: Number(offsetLng.toFixed(6)),
      radiusMeters: 50,
    };

    setLocations((prev) => [...prev, newLoc]);
    setSelectedIdx(locations.length);
  };

  const handleDeleteLocation = (idxToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (locations.length <= 1) {
      alert('نابێت هەموو لۆکەیشنەکان بسڕیتەوە! بەلایەنی کەمەوە دەبێت ١ لۆکەیشن هەبێت.');
      return;
    }
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم شوێنە؟')) return;

    setLocations((prev) => prev.filter((_, i) => i !== idxToDelete));
    if (selectedIdx >= idxToDelete) {
      setSelectedIdx(Math.max(0, selectedIdx - 1));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const foundLat = Number(parseFloat(data[0].lat).toFixed(6));
        const foundLng = Number(parseFloat(data[0].lon).toFixed(6));
        updateActiveLocation({ lat: foundLat, lng: foundLng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([foundLat, foundLng], 15);
        }
      } else {
        setSearchError('شوێنەکە نەدۆزرایەوە');
      }
    } catch {
      setSearchError('هەڵەیەک لە گەڕاندا ڕوویدا');
    } finally {
      setSearching(false);
    }
  };

  const setCurrentGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const curLat = Number(pos.coords.latitude.toFixed(6));
      const curLng = Number(pos.coords.longitude.toFixed(6));
      updateActiveLocation({ lat: curLat, lng: curLng });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([curLat, curLng], 16);
      }
    });
  };

  const handleSaveAll = () => {
    onSave(locations);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 font-sans dir-rtl" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black">
                دیاریکردنی فرە-لۆکەیشن و بازنەی ڕێگەپێدراوی لقەکان (Multi-Geofence)
              </h2>
              <p className="text-[11px] text-slate-400 font-semibold">
                دەتوانیت ٢ شوێن یان زیاتر دیاری بکەیت تا کارمەندان لە هەر لقێک بن بتوانن چێک‌ئین بکەن
              </p>
            </div>
          </div>

          <button onClick={onClose} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all">
            ✕ داخستن
          </button>
        </div>

        {/* Top Controls & Search Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-2 text-xs font-bold">
          <form onSubmit={handleSearch} className="md:col-span-8 flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان لەسەر نەخشە (بۆ نموونە: سلێمانی، تاسڵوجە، هەولێر)..."
                className="w-full pl-3 pr-8 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none text-xs font-bold"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm"
            >
              {searching ? '...' : 'گەڕان'}
            </button>
          </form>

          <button
            type="button"
            onClick={setCurrentGps}
            className="md:col-span-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>📍 دانانی شوێنی ئێستای GPSی من</span>
          </button>

          {searchError && (
            <p className="col-span-12 text-rose-500 text-xs font-semibold">{searchError}</p>
          )}
        </div>

        {/* Main Body: Left Locations List + Right Map */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[360px] overflow-hidden">
          
          {/* Left Panel: Locations Sidebar List */}
          <div className="md:col-span-4 border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-2.5 overflow-y-auto max-h-[380px] md:max-h-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                لیستی لقەکان ({locations.length}):
              </span>
              <button
                type="button"
                onClick={handleAddNewBranch}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>زیادکردنی لقی نوێ</span>
              </button>
            </div>

            <div className="space-y-2">
              {locations.map((loc, idx) => {
                const isSel = idx === selectedIdx;
                return (
                  <div
                    key={loc.id || idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer select-none space-y-1.5 ${
                      isSel
                        ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-white/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isSel ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {loc.name}
                        </span>
                      </div>
                      {locations.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLocation(idx, e)}
                          className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="سڕینەوەی ئەم لۆکەیشنە"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span>مەودا: {loc.radiusMeters}m</span>
                      <span>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Interactive Map */}
          <div className="md:col-span-8 relative bg-slate-200 dark:bg-slate-800 min-h-[300px]">
            <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-10" />
          </div>

        </div>

        {/* Selected Location Form Controls */}
        {activeLoc && (
          <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">ناوی ئەم لقە/کۆگایە:</label>
              <input
                type="text"
                value={activeLoc.name}
                onChange={(e) => updateActiveLocation({ name: e.target.value })}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">Latitude:</label>
              <input
                type="number"
                step="any"
                value={activeLoc.lat}
                onChange={(e) => updateActiveLocation({ lat: Number(e.target.value) })}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">Longitude:</label>
              <input
                type="number"
                step="any"
                value={activeLoc.lng}
                onChange={(e) => updateActiveLocation({ lng: Number(e.target.value) })}
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1">
                مەودای بازنە: ({activeLoc.radiusMeters} مەتر)
              </label>
              <input
                type="range"
                min="20"
                max="2000"
                step="10"
                value={activeLoc.radiusMeters || 50}
                onChange={(e) => updateActiveLocation({ radiusMeters: Number(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            کارمەندان لە هەر یەک لەم {locations.length} لقەدا بن، چێک‌ئینیان بۆ ئەنجام دەدرێت
          </span>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl"
            >
              پاشگەزبوونەوە
            </button>

            <button
              onClick={handleSaveAll}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>💾 پاشەکەوتکردنی هەموو لۆکەیشنەکان</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
