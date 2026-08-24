'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, X, Building2, Compass, AlertCircle } from 'lucide-react';
import { getDistanceMeters } from '@/lib/background-geofence';

interface MobileAttendanceMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyLocation: {
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  currentLat: number | null;
  currentLng: number | null;
}

export function MobileAttendanceMapModal({
  isOpen,
  onClose,
  companyLocation,
  currentLat,
  currentLng,
}: MobileAttendanceMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const distance = useMemoDistance(currentLat, currentLng, companyLocation.lat, companyLocation.lng);

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

      // Initial center between company and user
      const centerLat = currentLat ? (currentLat + companyLocation.lat) / 2 : companyLocation.lat;
      const centerLng = currentLng ? (currentLng + companyLocation.lng) / 2 : companyLocation.lng;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // 🏢 Company Base Marker & Geofence Circle
      const companyIcon = L.divIcon({
        className: 'custom-company-marker',
        html: `
          <div style="background-color: #ea580c; color: white; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(234,88,12,0.4); font-size: 16px;">
            🏢
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([companyLocation.lat, companyLocation.lng], { icon: companyIcon })
        .addTo(map)
        .bindPopup(`<b>🏢 ${companyLocation.name}</b><br>سنووری دەوام: ${companyLocation.radiusMeters} مەتر`);

      L.circle([companyLocation.lat, companyLocation.lng], {
        color: '#ea580c',
        fillColor: '#ea580c',
        fillOpacity: 0.15,
        radius: companyLocation.radiusMeters,
      }).addTo(map);

      // 📍 User's Live GPS Marker
      if (currentLat && currentLng) {
        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div style="background-color: #2563eb; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 14px rgba(37,99,235,0.5); font-size: 16px;">
              📍
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        L.marker([currentLat, currentLng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`<b>📍 شوێنی ئێستای مۆبایلەکەت</b><br>دووری لە کۆمپانیا: ${distance} مەتر`);

        // Connect both with dashed line
        L.polyline(
          [
            [companyLocation.lat, companyLocation.lng],
            [currentLat, currentLng],
          ],
          { color: '#f97316', dashArray: '6, 8', weight: 3 }
        ).addTo(map);

        // Fit map bounds to show both
        const bounds = L.latLngBounds([
          [companyLocation.lat, companyLocation.lng],
          [currentLat, currentLng],
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([companyLocation.lat, companyLocation.lng], 16);
      }

      mapInstanceRef.current = map;
      setMapLoaded(true);
    };

    loadLeaflet();
  }, [isOpen, companyLocation, currentLat, currentLng, distance]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] sm:h-[650px]">
        
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">بینینی نەخشەی لۆکەیشن و دووری</h3>
              <p className="text-[11px] text-slate-500 font-bold">پشکنینی مەودای نێوان مۆبایل و کۆمپانیا</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Distance & Coordinates Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-orange-600">🏢 کۆمپانیا:</span>
            <span className="font-mono text-[11px]">{companyLocation.lat.toFixed(4)}, {companyLocation.lng.toFixed(4)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-blue-600">📍 مۆبایل:</span>
            <span className="font-mono text-[11px]">
              {currentLat ? `${currentLat.toFixed(4)}, ${currentLng?.toFixed(4)}` : 'چاوەڕوانە...'}
            </span>
          </div>

          <div className="w-full flex items-center justify-between pt-1 border-t border-slate-200/80 font-black">
            <span>مەودای دووری:</span>
            <span className="text-orange-600 font-mono text-sm">
              {distance !== null ? `${distance.toLocaleString()} مەتر (${(distance / 1000).toFixed(2)} کم)` : '...'}
            </span>
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

function useMemoDistance(lat1: number | null, lon1: number | null, lat2: number, lon2: number) {
  if (!lat1 || !lon1) return null;
  return Math.round(getDistanceMeters(lat1, lon1, lat2, lon2));
}
