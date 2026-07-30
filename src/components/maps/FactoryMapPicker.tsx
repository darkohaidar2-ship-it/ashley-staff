'use client';

import React, { useEffect, useRef, useState } from 'react';

interface FactoryMapPickerProps {
  initialLat: number;
  initialLng: number;
  initialRadius: number;
  factoryName: string;
  isRTL: boolean;
  onSave: (location: { name: string; lat: number; lng: number; radiusMeters: number }) => void;
  onClose: () => void;
}

export function FactoryMapPicker({
  initialLat,
  initialLng,
  initialRadius,
  factoryName: initName,
  isRTL,
  onSave,
  onClose,
}: FactoryMapPickerProps) {
  const [lat, setLat] = useState<number>(initialLat || 35.5571);
  const [lng, setLng] = useState<number>(initialLng || 45.4352);
  const [radius, setRadius] = useState<number>(initialRadius || 500);
  const [name, setName] = useState<string>(initName || 'کارگەی ئاشڵی (Ashley Factory)');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const circleInstanceRef = useRef<any>(null);

  // Load Leaflet CSS and JS dynamically
  useEffect(() => {
    // Check if Leaflet CSS exists
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

    const startLat = lat || 35.5571;
    const startLng = lng || 45.4352;

    const map = L.map(mapContainerRef.current).setView([startLat, startLng], 15);
    mapInstanceRef.current = map;

    // OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Draggable Marker for Factory Location
    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    markerInstanceRef.current = marker;
    marker.bindPopup(name).openPopup();

    // Circle Overlay for Allowed Radius
    const circle = L.circle([startLat, startLng], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.2,
      radius: radius,
    }).addTo(map);
    circleInstanceRef.current = circle;

    // Handle Marker Drag End
    marker.on('dragend', (e: any) => {
      const newPos = e.target.getLatLng();
      setLat(Number(newPos.lat.toFixed(6)));
      setLng(Number(newPos.lng.toFixed(6)));
      circle.setLatLng(newPos);
    });

    // Handle Map Click to Move Marker
    map.on('click', (e: any) => {
      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));
      setLat(clickLat);
      setLng(clickLng);
      marker.setLatLng([clickLat, clickLng]);
      circle.setLatLng([clickLat, clickLng]);
    });
  };

  // Update map marker & circle when lat, lng, or radius state changes
  useEffect(() => {
    if (markerInstanceRef.current && circleInstanceRef.current && mapInstanceRef.current) {
      const newPos = [lat, lng];
      markerInstanceRef.current.setLatLng(newPos);
      circleInstanceRef.current.setLatLng(newPos);
      circleInstanceRef.current.setRadius(radius);
      mapInstanceRef.current.panTo(newPos);
    }
  }, [lat, lng, radius]);

  // Geocoding Search using OpenStreetMap Nominatim
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
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        setLat(foundLat);
        setLng(foundLng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([foundLat, foundLng], 15);
        }
      } else {
        setSearchError(isRTL ? 'شوێنەکە نەدۆزرایەوە' : 'Location not found');
      }
    } catch {
      setSearchError(isRTL ? 'هەڵەیەک لە گەڕاندا ڕوویدا' : 'Error searching location');
    } finally {
      setSearching(false);
    }
  };

  // Get current device GPS location
  const setCurrentGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const curLat = Number(pos.coords.latitude.toFixed(6));
      const curLng = Number(pos.coords.longitude.toFixed(6));
      setLat(curLat);
      setLng(curLng);
    });
  };

  const handleSave = () => {
    onSave({
      name,
      lat,
      lng,
      radiusMeters: radius,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div>
            <h2 className="text-base font-black">
              🗺️ {isRTL ? 'نەخشەی سەرەکی و دیاریکردنی شوێنی کۆمپانیا (Admin Map Geofence)' : 'Interactive Factory Map & Radius Picker'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRTL ? 'نیشانەکە ڕابکێشە یان کلیک لەسەر نەخشەکە بکە بۆ دیاریکردنی تەمامی لۆکەیشن' : 'Click on map or drag marker to set exact location'}
            </p>
          </div>

          <button onClick={onClose} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold">
            ✕
          </button>
        </div>

        {/* Top Controls & Search Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs font-bold">
          
          {/* Search Box */}
          <form onSubmit={handleSearch} className="md:col-span-6 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'گەڕان لە سەر گووگڵ/نەخشە (وەک: سلێمانی، هەولێر)...' : 'Search map location...'}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg cursor-pointer"
            >
              {searching ? '...' : (isRTL ? 'گەڕان' : 'Search')}
            </button>
          </form>

          {/* Current GPS Button */}
          <button
            type="button"
            onClick={setCurrentGps}
            className="md:col-span-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
          >
            📍 {isRTL ? 'دانانی شوێنی ئێستای GPS ی من' : 'Set My Current GPS Position'}
          </button>

          {searchError && (
            <p className="col-span-12 text-rose-500 text-xs font-semibold">{searchError}</p>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full min-h-[350px] relative bg-slate-200 dark:bg-slate-800">
          <div ref={mapContainerRef} className="w-full h-full min-h-[350px] z-10" />
        </div>

        {/* Bottom Coordinates & Radius Form */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">{isRTL ? 'ناوی کۆمپانیا/کارگە:' : 'Company Name:'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">Latitude:</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">Longitude:</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1">
              {isRTL ? `مەودای ڕێگەپێدراو (${radius} مەتر):` : `Allowed Radius (${radius}m):`}
            </label>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
            />
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-lg cursor-pointer"
          >
            {isRTL ? 'پاشگەزبوونەوە' : 'Cancel'}
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-lg cursor-pointer shadow-md"
          >
            💾 {isRTL ? 'پاشەکەوتکردنی شوێنی کۆمپانیا' : 'Save Company Location'}
          </button>
        </div>

      </div>
    </div>
  );
}
