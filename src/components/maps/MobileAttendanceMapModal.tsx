'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, X, Building2, Compass, AlertCircle, Warehouse, RefreshCw, CheckCircle2, Lock, Wifi, WifiOff } from 'lucide-react';
import { getDistanceMeters, type GeofenceRegion } from '@/lib/background-geofence';
import { DEFAULT_COMPANY_LOCATIONS, ASHLEY_BASE_LOCATION } from '@/lib/geo-constants';

interface MobileAttendanceMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyLocations: GeofenceRegion[];
  currentLat: number | null;
  currentLng: number | null;
  distanceMeters?: number | null;
  isInsideGeofence?: boolean;
  onRefreshGps?: () => Promise<any>;
  onCheckInClick?: () => void;
  onCheckOutClick?: () => void;
  isCheckedIn?: boolean;
}

export function MobileAttendanceMapModal({
  isOpen,
  onClose,
  companyLocations,
  currentLat,
  currentLng,
  distanceMeters,
  isInsideGeofence = false,
  onRefreshGps,
  onCheckInClick,
  onCheckOutClick,
  isCheckedIn = false,
}: MobileAttendanceMapModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Online / Offline listener
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filter out any invalid / zero coordinates or face registry rows
  const validLocations = companyLocations.filter(
    loc => loc.lat > 10 && loc.lng > 10 && !loc.name?.toLowerCase().includes('face') && !loc.id.includes('face')
  );

  // Fallback to default two branches if list is empty, ensuring min 400m radius
  const activeCompanyLocations = (validLocations.length > 0 ? validLocations : DEFAULT_COMPANY_LOCATIONS).map(loc => ({
    ...loc,
    radiusMeters: Math.max(400, loc.radiusMeters || 400),
  }));

  // Compute distances to each location
  const locationsWithDistance = activeCompanyLocations.map(loc => {
    const dist = (currentLat && currentLng) 
      ? Math.round(getDistanceMeters(currentLat, currentLng, loc.lat, loc.lng)) 
      : null;
    const isInside = dist !== null ? dist <= (loc.radiusMeters || 400) : false;
    return { ...loc, distance: dist, isInside };
  });

  // Find closest company location
  const closestLocation = locationsWithDistance.reduce((prev, curr) => {
    if (!prev) return curr;
    if (prev.distance === null) return curr;
    if (curr.distance === null) return prev;
    return curr.distance < prev.distance ? curr : prev;
  }, locationsWithDistance[0]);

  // Load and Render Leaflet Map
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapLoaded(false);
      return;
    }

    let isSubscribed = true;

    const loadLeaflet = async () => {
      if (typeof window === 'undefined') return;

      if (!(window as any).L) {
        // Load CSS (offline first, fallback to CDN)
        if (!document.getElementById('leaflet-css-mobile')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css-mobile';
          link.rel = 'stylesheet';
          link.href = '/leaflet/leaflet.css';
          link.onerror = () => {
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          };
          document.head.appendChild(link);
        }

        // Load JS (offline first, fallback to CDN)
        await new Promise<void>((resolve) => {
          if (document.getElementById('leaflet-js-mobile')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.id = 'leaflet-js-mobile';
          script.src = '/leaflet/leaflet.js';
          script.onload = () => resolve();
          script.onerror = () => {
            const cdnScript = document.createElement('script');
            cdnScript.id = 'leaflet-js-mobile-cdn';
            cdnScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            cdnScript.onload = () => resolve();
            document.body.appendChild(cdnScript);
          };
          document.body.appendChild(script);
        });
      }

      if (!isSubscribed) return;

      const L = (window as any).L;
      if (!L || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const primaryLoc = activeCompanyLocations[0] || ASHLEY_BASE_LOCATION;
      const initialCenter: [number, number] = currentLat && currentLng 
        ? [currentLat, currentLng] 
        : [primaryLoc.lat, primaryLoc.lng];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: currentLat && currentLng ? 15 : 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // OpenStreetMap Tiles (Works online, gracefully shows styled radar grid when offline)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const allLatLngs: [number, number][] = [];

      // 🏢 Plot ALL Company Locations (Ashley Main Base, Huana Warehouse)
      activeCompanyLocations.forEach((loc, idx) => {
        const isAshley = loc.name.includes('ئاشڵی') || loc.name.includes('Ashley');
        const color = isAshley ? '#ea580c' : '#7c3aed';
        const iconChar = isAshley ? '🏢' : '🏭';

        const compIcon = L.divIcon({
          className: `custom-comp-marker-${idx}`,
          html: `
            <div style="background-color: ${color}; color: white; width: 42px; height: 42px; border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 6px 18px rgba(0,0,0,0.35); font-size: 19px; cursor: pointer;">
              ${iconChar}
            </div>
          `,
          iconSize: [42, 42],
          iconAnchor: [21, 21],
        });

        const radius = loc.radiusMeters || 400;

        L.marker([loc.lat, loc.lng], { icon: compIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: right; direction: rtl; font-family: system-ui;">
              <b style="font-size: 13px; color: ${color};">${iconChar} ${loc.name}</b><br>
              <span style="font-size: 11px; color: #475569;">سنووری ڕێگەپێدراو: <b>${radius} مەتر</b></span>
            </div>
          `);

        // Geofence Circle
        L.circle([loc.lat, loc.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.18,
          weight: 2.5,
          radius: radius,
        }).addTo(map);

        allLatLngs.push([loc.lat, loc.lng]);

        // Draw connecting line to user with distance label
        if (currentLat && currentLng) {
          const d = Math.round(getDistanceMeters(currentLat, currentLng, loc.lat, loc.lng));
          const isInsideThis = d <= radius;

          L.polyline(
            [
              [loc.lat, loc.lng],
              [currentLat, currentLng],
            ],
            { 
              color: isInsideThis ? '#10b981' : color, 
              dashArray: isInsideThis ? '6, 6' : '4, 8', 
              weight: isInsideThis ? 3.5 : 2, 
              opacity: 0.85 
            }
          ).addTo(map);
        }
      });

      // 📍 Plot User's Live GPS Marker
      if (currentLat && currentLng) {
        const userInside = isInsideGeofence || (closestLocation?.isInside ?? false);
        const userColor = userInside ? '#10b981' : '#2563eb';

        const userIcon = L.divIcon({
          className: 'custom-user-marker',
          html: `
            <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${userColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="background-color: ${userColor}; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 14px rgba(0,0,0,0.4); font-size: 16px; position: relative; z-index: 2;">
                📍
              </div>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        L.marker([currentLat, currentLng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: right; direction: rtl; font-family: system-ui;">
              <b style="font-size: 13px; color: ${userColor};">📍 شوێنی ئێستای تۆ</b><br>
              <span style="font-size: 11px; color: #475569;">
                ${userInside ? '🟢 لە ناو سنووری کۆمپانیایت' : `⚠️ دووری لە نزیکترین لق: ${closestLocation?.distance ?? 0} مەتر`}
              </span>
            </div>
          `)
          .openPopup();

        // Accuracy/Presence ring around user
        L.circle([currentLat, currentLng], {
          color: userColor,
          fillColor: userColor,
          fillOpacity: 0.15,
          weight: 1.5,
          radius: 35,
        }).addTo(map);

        allLatLngs.push([currentLat, currentLng]);

        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      } else if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      mapInstanceRef.current = map;
      setMapLoaded(true);
    };

    loadLeaflet();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, companyLocations, currentLat, currentLng, isInsideGeofence]);

  // Handle Refresh GPS
  const handleTriggerRefresh = useCallback(async () => {
    if (!onRefreshGps) return;
    try {
      setIsRefreshing(true);
      const res = await onRefreshGps();
      if (res?.lat && res?.lng && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([res.lat, res.lng], 16, { duration: 1.2 });
      }
    } catch (err) {
      console.warn('Refresh GPS from map failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshGps]);

  // 🚀 Automatically request GPS location as soon as map modal opens
  useEffect(() => {
    if (isOpen) {
      handleTriggerRefresh();
    }
  }, [isOpen, handleTriggerRefresh]);

  if (!isOpen) return null;

  const userInside = isInsideGeofence || (closestLocation?.isInside ?? false);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 text-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col h-[92vh] sm:h-[720px]">
        
        {/* Header */}
        <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">نەخشەی لقی کۆمپانیا و شوێنی من</h3>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  <span>{isOnline ? 'ئۆنلاین' : 'ئۆفلاین'}</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold">بینین و پشکنینی ڕاستەوخۆی دووری (ئاشڵی و هوانە)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            title="داخستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Distance Status Cards */}
        <div className="p-2.5 bg-slate-950/80 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            {locationsWithDistance.map((loc, i) => {
              const isAshley = loc.name.includes('ئاشڵی') || loc.name.includes('Ashley');
              const isInside = loc.isInside;

              return (
                <div 
                  key={loc.id || i} 
                  className={`p-2.5 rounded-2xl border transition-all ${
                    isInside 
                      ? 'bg-emerald-950/40 border-emerald-500/50 shadow-xs' 
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="flex items-center gap-1 text-[11px] text-slate-200 truncate">
                      <span>{isAshley ? '🏢' : '🏭'}</span>
                      <span className="truncate">{isAshley ? 'ئاشڵی سەرەکی' : 'کۆگای هوانە'}</span>
                    </span>
                    <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md ${
                      isInside ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {loc.distance !== null ? `${loc.distance.toLocaleString()}م` : '...'}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    <span className={`font-bold ${isInside ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isInside ? '🟢 لە ناو سنور' : 'لە دەرەوە'}
                    </span>
                    <span className="font-mono text-slate-500">
                      سنور: {loc.radiusMeters}م
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 w-full relative bg-slate-950 overflow-hidden">
          {/* Radar background grid for offline mode */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(90deg, #38bdf8 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />

          <div ref={mapContainerRef} className="w-full h-full relative z-10" />

          {!mapLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-slate-300 font-bold text-xs gap-2 z-20">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
              <span>لە ئامادەکردنی نەخشەدایە...</span>
            </div>
          )}

          {/* Floating Live GPS Refresh Button on Map */}
          {onRefreshGps && (
            <div className="absolute top-3 left-3 z-20">
              <button
                type="button"
                onClick={handleTriggerRefresh}
                disabled={isRefreshing}
                className="px-3 py-2 bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg border border-slate-700 flex items-center gap-1.5 cursor-pointer backdrop-blur-md transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'پشکنین...' : 'نوێکردنەوەی شوێن'}</span>
              </button>
            </div>
          )}

          {/* 🎯 Floating Google Maps Style "Locate Me" Icon Button */}
          {onRefreshGps && (
            <div className="absolute bottom-24 right-3.5 z-20 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (currentLat && currentLng && mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([currentLat, currentLng], 16, { duration: 1.2 });
                  }
                  handleTriggerRefresh();
                }}
                disabled={isRefreshing}
                className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-100 active:scale-90 text-blue-600 shadow-2xl border-2 border-slate-200/90 flex items-center justify-center cursor-pointer transition-all duration-200 group"
                title="دیاریکردنی شوێنی ئێستام"
                aria-label="دیاریکردنی شوێنی ئێستام"
              >
                {isRefreshing ? (
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <Navigation className="w-5 h-5 fill-blue-600 text-blue-600 transition-transform group-hover:scale-110" />
                )}
              </button>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-900/85 text-white border border-slate-700 shadow-sm pointer-events-none">
                شوێنم 📍
              </span>
            </div>
          )}

          {/* Floating Status Banner */}
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <div className={`p-3 rounded-2xl shadow-xl border backdrop-blur-md flex items-center justify-between gap-2 ${
              userInside
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  userInside ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {userInside ? <CheckCircle2 className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">
                    {userInside 
                      ? '🟢 تۆ لە ناو سنووری کۆمپانیایت' 
                      : (currentLat && currentLng)
                      ? `⚠️ لە دەرەوەی سنوریت (${closestLocation?.distance ?? 0} مەتر دوور)`
                      : '📍 شوێنی تۆ نەدۆزراوەتەوە'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold truncate">
                    {currentLat && currentLng 
                      ? `پۆوتان: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`
                      : 'تکایە کلیک لە «نوێکردنەوەی شوێنم» بکە'}
                  </p>
                </div>
              </div>

              {/* Instant Check-In/Out Button right inside Map if inside geofence */}
              {userInside && (onCheckInClick || onCheckOutClick) && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (!isCheckedIn && onCheckInClick) onCheckInClick();
                    if (isCheckedIn && onCheckOutClick) onCheckOutClick();
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer shrink-0 active:scale-95 transition-all text-white ${
                    !isCheckedIn 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {!isCheckedIn ? 'تۆمارکردنی هاتن' : 'تۆمارکردنی دەرچوون'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-bold">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
            <span>نەخشەی بینەر (View-Only) • بە ئۆفلاینیش کار دەکات</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs cursor-pointer border border-slate-700 transition-colors"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
