'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, Building2, Compass, AlertCircle, Warehouse } from 'lucide-react';
import { getDistanceMeters, type GeofenceRegion } from '@/lib/background-geofence';

interface MobileAttendanceMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyLocations: GeofenceRegion[];
  currentLat: number | null;
  currentLng: number | null;
}

export function MobileAttendanceMapModal({
  isOpen,
  onClose,
  companyLocations,
  currentLat,
  currentLng,
}: MobileAttendanceMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Filter out any invalid / zero coordinates or face registry rows
  const validLocations = companyLocations.filter(
    loc => loc.lat > 10 && loc.lng > 10 && !loc.name?.toLowerCase().includes('face') && !loc.id.includes('face')
  );

  // Fallback to default two branches if list is empty
  const activeCompanyLocations = validLocations.length > 0 ? validLocations : [
    { id: 'ashley-base-main', name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)', lat: 35.5571, lng: 45.4352, radiusMeters: 100 },
    { id: 'huana-warehouse-main', name: 'کۆگای سەرەکی هوانە (Huana Warehouse)', lat: 35.6012, lng: 45.3850, radiusMeters: 120 }
  ];

  // Compute distances to each location
  const locationsWithDistance = activeCompanyLocations.map(loc => {
    const dist = (currentLat && currentLng) 
      ? Math.round(getDistanceMeters(currentLat, currentLng, loc.lat, loc.lng)) 
      : null;
    return { ...loc, distance: dist };
  });

  // Find closest company location
  const closestLocation = locationsWithDistance.reduce((prev, curr) => {
    if (!prev) return curr;
    if (prev.distance === null) return curr;
    if (curr.distance === null) return prev;
    return curr.distance < prev.distance ? curr : prev;
  }, locationsWithDistance[0]);

  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
      return;
    }

    // Load Leaflet CDN script & stylesheet
    const loadLeaflet = async () => {
      if (typeof window === 'undefined') return;

      if (!(window as any).L) {
        if (!document.getElementById('leaflet-css-mobile')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css-mobile';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        await new Promise<void>((resolve) => {
          if (document.getElementById('leaflet-js-mobile')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.id = 'leaflet-js-mobile';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const primaryLoc = activeCompanyLocations[0] || { lat: 35.5571, lng: 45.4352 };

      const map = L.map(mapContainerRef.current, {
        center: [primaryLoc.lat, primaryLoc.lng],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const allLatLngs: [number, number][] = [];

      // 🏢 Plot ALL Company Locations (Ashley Main Showroom, Huana Warehouse)
      activeCompanyLocations.forEach((loc, idx) => {
        const isAshley = loc.name.includes('ئاشڵی') || loc.name.includes('Ashley');
        const color = isAshley ? '#ea580c' : '#7c3aed';
        const iconChar = isAshley ? '🏢' : '🏭';

        const compIcon = L.divIcon({
          className: `custom-comp-marker-${idx}`,
          html: `
            <div style="background-color: ${color}; color: white; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.3); font-size: 17px;">
              ${iconChar}
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        L.marker([loc.lat, loc.lng], { icon: compIcon })
          .addTo(map)
          .bindPopup(`<b>${iconChar} ${loc.name}</b><br>سنووری دەوام: ${loc.radiusMeters} مەتر`);

        L.circle([loc.lat, loc.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.15,
          radius: loc.radiusMeters,
        }).addTo(map);

        allLatLngs.push([loc.lat, loc.lng]);

        // Draw dashed line from user to this location
        if (currentLat && currentLng) {
          const d = Math.round(getDistanceMeters(currentLat, currentLng, loc.lat, loc.lng));
          L.polyline(
            [
              [loc.lat, loc.lng],
              [currentLat, currentLng],
            ],
            { color: color, dashArray: '5, 8', weight: 2.5, opacity: 0.8 }
          ).addTo(map);
        }
      });

      // 📍 User's Live GPS Marker
      if (currentLat && currentLng) {
        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div style="background-color: #2563eb; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 14px rgba(37,99,235,0.6); font-size: 17px;">
              📍
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        L.marker([currentLat, currentLng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`<b>📍 شوێنی ئێستای تۆ</b>`);

        allLatLngs.push([currentLat, currentLng]);

        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      mapInstanceRef.current = map;
      setMapLoaded(true);
    };

    loadLeaflet();
  }, [isOpen, companyLocations, currentLat, currentLng]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] sm:h-[680px]">
        
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">نەخشەی تەواوی لق و کۆگاکان</h3>
              <p className="text-[11px] text-slate-500 font-bold">پشکنینی دووری لە (ئاشڵی و هوانە)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Distance Cards for ALL locations */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 max-h-36 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {locationsWithDistance.map((loc, i) => {
              const isAshley = loc.name.includes('ئاشڵی') || loc.name.includes('Ashley');
              return (
                <div key={loc.id || i} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className={isAshley ? 'text-orange-600' : 'text-purple-600'}>
                      {isAshley ? '🏢 ' : '🏭 '}{loc.name}
                    </span>
                    <span className="font-mono text-slate-900">
                      {loc.distance !== null ? `${loc.distance.toLocaleString()}m` : '...'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                    <span>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                    <span className="font-bold text-slate-700">
                      {loc.distance !== null ? `(${(loc.distance / 1000).toFixed(2)} کم)` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full relative bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />

          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 text-slate-600 font-bold text-xs">
              لە لۆدکردنی نەخشەدایە...
            </div>
          )}
        </div>

        {/* View-Only Footer Notice */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-bold">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>ئەم نەخشەیە تەنها بۆ بینینە و دەستکاری ناکرێت</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-orange-500 text-white rounded-xl font-black text-xs hover:bg-orange-600 cursor-pointer"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
