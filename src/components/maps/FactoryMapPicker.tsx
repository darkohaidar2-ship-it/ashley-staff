'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, MapPin, Check, Search, Navigation, Building2, Warehouse, Compass, X, AlertCircle } from 'lucide-react';

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

export function FactoryMapPicker({
  initialLocations,
  isRTL,
  onSave,
  onClose,
}: FactoryMapPickerProps) {
  // Always ensure precisely the 2 branches exist
  const [locations, setLocations] = useState<CompanyLocation[]>(() => {
    if (initialLocations && initialLocations.length > 0) {
      // If user had locations, keep up to 2
      const mapped = initialLocations.slice(0, 2);
      if (mapped.length === 1) {
        mapped.push(DEFAULT_TWO_BRANCHES[1]);
      }
      return mapped;
    }
    return DEFAULT_TWO_BRANCHES;
  });

  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const selectedIdxRef = useRef<number>(0);
  selectedIdxRef.current = selectedIdx;

  const activeLoc = locations[selectedIdx] || locations[0];

  const locationsRef = useRef<CompanyLocation[]>(locations);
  locationsRef.current = locations;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);

  // Update a single location's properties
  const updateLocationAt = useCallback((index: number, updates: Partial<CompanyLocation>) => {
    setLocations(prev => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  }, []);

  // Update currently selected active branch
  const updateActiveLocation = useCallback((updates: Partial<CompanyLocation>) => {
    updateLocationAt(selectedIdxRef.current, updates);
  }, [updateLocationAt]);

  // Load Leaflet
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

    const startLoc = locationsRef.current[selectedIdxRef.current] || locationsRef.current[0];
    const map = L.map(mapContainerRef.current).setView([startLoc.lat, startLoc.lng], 14);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Map click moves ONLY the currently selected active branch!
    map.on('click', (e: any) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));
      const currIdx = selectedIdxRef.current;
      updateLocationAt(currIdx, { lat: clickLat, lng: clickLng });
    });

    renderMarkersAndCircles();
  };

  // Sync Markers on Map whenever locations change
  const renderMarkersAndCircles = useCallback(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old markers & circles
    markersRef.current.forEach(m => m.remove());
    circlesRef.current.forEach(c => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    locations.forEach((loc, idx) => {
      const isSelected = idx === selectedIdx;
      const isAshley = idx === 0;
      const themeColor = isAshley ? '#ea580c' : '#7c3aed';
      const iconEmoji = isAshley ? '🏢' : '🏭';

      const customIcon = L.divIcon({
        className: `custom-pin-${idx}`,
        html: `
          <div style="background-color: ${themeColor}; color: white; width: ${isSelected ? 44 : 36}px; height: ${isSelected ? 44 : 36}px; border-radius: 14px; display: flex; align-items: center; justify-content: center; border: ${isSelected ? '4px solid #ffffff' : '2px solid #ffffff'}; box-shadow: 0 6px 18px rgba(0,0,0,0.35); font-size: ${isSelected ? 20 : 16}px; transform: scale(${isSelected ? 1.1 : 1}); transition: all 0.2s ease;">
            ${iconEmoji}
          </div>
        `,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      });

      // Draggable Marker
      const marker = L.marker([loc.lat, loc.lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);

      marker.on('click', () => {
        setSelectedIdx(idx);
      });

      marker.on('dragend', (e: any) => {
        const newLat = Number(e.target.getLatLng().lat.toFixed(6));
        const newLng = Number(e.target.getLatLng().lng.toFixed(6));
        updateLocationAt(idx, { lat: newLat, lng: newLng });
      });

      // Geofence Circle
      const circle = L.circle([loc.lat, loc.lng], {
        color: themeColor,
        fillColor: themeColor,
        fillOpacity: isSelected ? 0.22 : 0.12,
        radius: loc.radiusMeters || 100,
        weight: isSelected ? 3 : 1.5,
      }).addTo(map);

      markersRef.current.push(marker);
      circlesRef.current.push(circle);
    });
  }, [locations, selectedIdx, updateLocationAt]);

  useEffect(() => {
    renderMarkersAndCircles();
  }, [locations, selectedIdx, renderMarkersAndCircles]);

  // When clicking a tab, center map on that branch
  const selectBranch = (idx: number) => {
    setSelectedIdx(idx);
    selectedIdxRef.current = idx;
    const target = locations[idx];
    if (target && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
    }
  };

  // Search Address / Coordinates
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if user typed coordinates like "35.5571, 45.4352"
    const coordMatch = searchQuery.match(/(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      updateActiveLocation({ lat, lng });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([lat, lng], 16);
      }
      setSearchError('');
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ' Iraq Sulaymaniyah')}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = Number(parseFloat(data[0].lat).toFixed(6));
        const lng = Number(parseFloat(data[0].lon).toFixed(6));
        updateActiveLocation({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16);
        }
      } else {
        setSearchError('هیچ شوێنێک نەدۆزرایەوە');
      }
    } catch {
      setSearchError('هەڵەیەک ڕوویدا لە گەڕان');
    } finally {
      setSearching(false);
    }
  };

  // Set Current Device GPS to active branch
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('جی پی ئێس لەسەر ئەم وێبگەڕە بەردەست نییە');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        updateActiveLocation({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16);
        }
      },
      (err) => alert('نەتوانرا لۆکەیشنی ئێستات وەربگیرێت: ' + err.message),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 dir-rtl" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] shadow-2xl border border-slate-300 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center text-white">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black">دیاریکردنی لۆکەیشنی فەرمیی دەوام (GPS)</h2>
              <p className="text-xs text-slate-300 font-bold">هەڵبژاردنی شوێنی دەقیقی (کۆمپانیای ئاشڵی و کۆگای هوانە)</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2 Clear Selectable Branch Tabs */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {locations.map((loc, idx) => {
            const isSelected = idx === selectedIdx;
            const isAshley = idx === 0;

            return (
              <div
                key={loc.id}
                onClick={() => selectBranch(idx)}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? isAshley
                      ? 'bg-orange-50 border-orange-500 shadow-md ring-4 ring-orange-500/10'
                      : 'bg-purple-50 border-purple-600 shadow-md ring-4 ring-purple-600/10'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
                    isAshley ? 'bg-orange-500 text-white' : 'bg-purple-600 text-white'
                  }`}>
                    {isAshley ? '🏢' : '🏭'}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-xs text-slate-900">{loc.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isSelected
                      ? isAshley ? 'bg-orange-500 text-white' : 'bg-purple-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {isSelected ? 'دەستنیشانکراوە 🎯' : 'کلیک بکە بۆ گۆڕین'}
                  </span>
                  <div className="text-[10px] font-bold text-slate-500">
                    سنوور: {loc.radiusMeters}م
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls Bar: Search, Radius Slider & GPS Auto-Detect */}
        <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="flex-1 min-w-[220px] flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان بەدوای گەڕەک، شەقام یان کۆردینەیت (35.55, 45.43)..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {searching ? '...' : 'گەڕان'}
            </button>
          </form>

          {/* Interactive Radius Adjuster for Selected Branch */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-black text-slate-700">تیرەی بازنە (سنوور):</span>
            <input
              type="range"
              min={30}
              max={300}
              step={10}
              value={activeLoc?.radiusMeters || 100}
              onChange={(e) => updateActiveLocation({ radiusMeters: Number(e.target.value) })}
              className="w-24 accent-orange-600 cursor-pointer"
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={20}
                max={500}
                value={activeLoc?.radiusMeters || 100}
                onChange={(e) => updateActiveLocation({ radiusMeters: Number(e.target.value) || 50 })}
                className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-center text-orange-600 font-mono focus:outline-hidden"
              />
              <span className="text-[11px] font-bold text-slate-500">مەتر</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>📍 دانانی شوێنی ئێستای من</span>
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full relative bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />
          
          <div className="absolute top-3 right-3 z-40 bg-white/90 backdrop-blur-xs p-2.5 rounded-2xl shadow-lg border border-slate-200 text-xs font-bold space-y-1">
            <div className="text-slate-800 font-black flex items-center gap-1">
              <span>🎯 لقێک لە سەرەوە هەڵبژێرە، پاشان لەسەر نەخشە کلیک بکە.</span>
            </div>
            <div className="text-[11px] text-slate-500">دەتوانیت مارکەرەکە بە دەستیش ڕابکێشیت.</div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              داخستن
            </button>
          </div>

          <button
            onClick={() => onSave(locations)}
            className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>پاشەکەوتکردنی هەردوو لۆکەیشن</span>
          </button>
        </div>

      </div>
    </div>
  );
}
