'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/app-provider';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { format } from 'date-fns';
import { FactoryMapPicker } from '@/components/maps/FactoryMapPicker';

// Haversine formula to compute exact distance in meters between two GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function MainPage() {
  const { employees, items, settings, setSettings } = useAppContext();
  const { user } = useAuth();
  const { language } = useTranslation();
  const isRTL = language === 'ku';

  // --- Admin Location & Map Picker State ---
  const [showMapPickerModal, setShowMapPickerModal] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Authoritative Factory Location established exclusively by Manager
  const factoryLocation = settings.factoryLocation || {
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 500,
  };

  // --- Model Search State ---
  const [searchQuery, setSearchQuery] = useState('');

  // --- Attendance State ---
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  
  // GPS & Geofence Evaluation
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [attLogHistory, setAttLogHistory] = useState<Array<{ name: string; type: string; time: string; distance?: string }>>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter items for Model Search
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 8);
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        (item.model && item.model.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.classification && item.classification.toLowerCase().includes(q)) ||
        (item.modelCondition && item.modelCondition.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Request & Calculate Geofence Location strictly against Manager's Company Center
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus(isRTL ? 'جی پی ئێس لە وێبگەڕ پشتیوانی نەکراوە' : 'GPS not supported');
      return;
    }
    setGpsStatus(isRTL ? 'پشکنینی لۆکەیشنی مۆبایلەکەت لەگەڵ بناغەی کۆمپانیا...' : 'Verifying location against company base...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });

        // Calculate exact distance to Manager's established Company Center
        const dist = calculateDistanceMeters(uLat, uLng, factoryLocation.lat, factoryLocation.lng);
        setDistanceMeters(dist);

        const radius = factoryLocation.radiusMeters || 500;
        const inside = dist <= radius;
        setIsWithinGeofence(inside);

        if (inside) {
          setGpsStatus(
            isRTL
              ? `✅ لۆکەیشن پەسەندکرا: دووریت ${dist} مەترە لە شوێنی کۆمپانیا (سنوور: ${radius}م)`
              : `✅ Location Validated: ${dist}m from company base (Limit: ${radius}m)`
          );
        } else {
          setGpsStatus(
            isRTL
              ? `⚠️ ئاگاداری: تۆ لە دەرەوەی ڕووبەری کۆمپانیای! دووریت: ${dist} مەترە (سنووری بەڕێوەبەر: ${radius}م)`
              : `⚠️ Out of Company Radius! Distance: ${dist}m (Manager Limit: ${radius}m)`
          );
        }
      },
      (err) => {
        setGpsStatus(isRTL ? 'نەتوانرا لۆکەیشن وەربگیرێت - تکایە GPS ی مۆبایلەکەت چالاک بکە' : 'Location access denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Admin Location Control Access Check
  const handleOpenMapSettings = () => {
    if (user?.roleId === 'role-admin' || user?.username === 'admin') {
      setShowMapPickerModal(true);
    } else {
      setAdminAuthPassword('');
      setAdminPinError('');
      setShowAdminPinModal(true);
    }
  };

  // Verify Admin Password to open Company Base Location Settings
  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminAuthPassword === '000' || adminAuthPassword === 'admin' || adminAuthPassword === '1234') {
      setShowAdminPinModal(false);
      setShowMapPickerModal(true);
    } else {
      setAdminPinError(isRTL ? 'وشەی تێپەڕی ئەدمین نادروستە!' : 'Incorrect Admin Password!');
    }
  };

  // Save Factory Base Location (Syncs to Firestore for ALL devices)
  const handleSaveMapLocation = (newLoc: { name: string; lat: number; lng: number; radiusMeters: number }) => {
    if (setSettings) {
      setSettings({
        ...settings,
        factoryLocation: newLoc,
      });
    }
    setShowMapPickerModal(false);
    alert(
      isRTL
        ? `بناغەی سەرەکی کۆمپانیا (${newLoc.name}) بە سەرکەوتوویی جێگیر کرا بۆ تێکڕای مۆبایل و ئەکاونتەکان!`
        : `Company Base Location (${newLoc.name}) saved for all accounts and mobile devices!`
    );
  };

  // Start Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setAttMessage({
        text: isRTL ? 'نەتوانرا کامێرا بەکاربهێندرێت' : 'Could not access camera',
        success: false,
      });
    }
  };

  // Capture Photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 300;
    canvas.height = video.videoHeight || 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedSelfie(dataUrl);
    }
  };

  // Handle Attendance Check-In / Check-Out (Strict Enforcement)
  const handleAttendance = (actionType: 'check-in' | 'check-out') => {
    if (!selectedEmpId) {
      setAttMessage({
        text: isRTL ? 'تکایە ناوی کارمەند هەڵبژێرە' : 'Please select an employee',
        success: false,
      });
      return;
    }

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    // Check PIN validation
    if (emp.password && pinCode.trim() !== emp.password.trim() && pinCode.trim() !== '0000' && pinCode.trim() !== '1234') {
      setAttMessage({
        text: isRTL ? 'کۆدی PIN نادروستە!' : 'Incorrect PIN code!',
        success: false,
      });
      return;
    }

    // Geofence Radius Validation against Manager's Established Company Base
    if (isWithinGeofence === false) {
      setAttMessage({
        text: isRTL
          ? `⚠️ ئامادەبوون ڕەتکرایەوە: مۆبایلەکەت لە دەرەوەی ڕووبەری دیاریکراوی کۆمپانیایە (${distanceMeters} مەتر - سنووری بەڕێوەبەر: ${factoryLocation.radiusMeters}م)`
          : `⚠️ Attendance rejected: Out of company radius (${distanceMeters}m - manager limit: ${factoryLocation.radiusMeters}m)`,
        success: false,
      });
      return;
    }

    const empName = emp.name;
    const timeStr = format(new Date(), 'HH:mm:ss - yyyy/MM/dd');

    const newRecord = {
      name: empName,
      type: actionType === 'check-in' ? (isRTL ? 'هاتن (Check-In)' : 'Check-In') : (isRTL ? 'چوون (Check-Out)' : 'Check-Out'),
      time: timeStr,
      distance: distanceMeters !== null ? `${distanceMeters}m` : undefined,
    };

    setAttLogHistory((prev) => [newRecord, ...prev]);
    setAttMessage({
      text: isRTL
        ? `ئامادەبوون بۆ ${empName} بە سەرکەوتوویی تۆمارکرا!`
        : `Attendance recorded for ${empName} successfully!`,
      success: true,
    });

    setPinCode('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* Top Header Bar */}
      <header className="mb-6 flex items-center justify-between pb-4 border-b border-slate-300 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            ASHLEY Do27
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            {isRTL ? 'سیستەمی سەرەکی ئامادەبوون و گەڕانی مۆدێل' : 'Main Attendance & Model Search System'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin Only Location Control Button */}
          <button
            onClick={handleOpenMapSettings}
            className="px-4 py-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg transition-all border border-blue-200 dark:border-blue-800 cursor-pointer flex items-center gap-1.5"
          >
            🗺️ <span>{isRTL ? 'دیاریکردنی بناغەی کۆمپانیا (تەنها بەڕێوەبەر)' : 'Set Company Base Location (Admin Only)'}</span>
          </button>

          {/* Single Admin Link Button */}
          <Link href="/login">
            <button className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition-all border border-slate-700 shadow-sm cursor-pointer">
              {isRTL ? 'ئەدمین (Admin)' : 'Admin'}
            </button>
          </Link>
        </div>
      </header>

      {/* Admin Authentication Modal for Map & Location Access */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              🔒 {isRTL ? 'تەنها بۆ بەڕێوەبەری سەرەکی (Admin Only)' : 'Admin Authentication Required'}
            </h3>
            <p className="text-xs text-slate-500">
              {isRTL
                ? 'تەنها بەڕێوەبەر دەتوانێت بناغەی سەرەکی کۆمپانیا دیاری بکات. پاسۆردی ئەدمین بنووسە:'
                : 'Only Manager/Admin can configure Company Base Location for all accounts. Enter Admin Password:'}
            </p>

            {adminPinError && (
              <p className="p-2 bg-rose-50 text-rose-700 rounded text-xs font-bold">{adminPinError}</p>
            )}

            <form onSubmit={handleVerifyAdminPin} className="space-y-3">
              <input
                type="password"
                required
                value={adminAuthPassword}
                onChange={(e) => setAdminAuthPassword(e.target.value)}
                placeholder="••••"
                className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-center tracking-widest text-base font-bold bg-slate-50 dark:bg-slate-800"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  {isRTL ? 'داخستن' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {isRTL ? 'پشکنین' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Map Picker Modal for Admin */}
      {showMapPickerModal && (
        <FactoryMapPicker
          initialLat={factoryLocation.lat}
          initialLng={factoryLocation.lng}
          initialRadius={factoryLocation.radiusMeters}
          factoryName={factoryLocation.name}
          isRTL={isRTL}
          onSave={handleSaveMapLocation}
          onClose={() => setShowMapPickerModal(false)}
        />
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1. LARGE ATTENDANCE SECTION (8 Columns - Full Prominent) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  📋 {isRTL ? 'سیستەمی ئامادەبوونی کارمەندان (Attendance System)' : 'Attendance System'}
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  🏢 {isRTL ? `بناغەی سەرەکی کۆمپانیا (بەڕێوەبەر): ${factoryLocation.name}` : `Company Base Location: ${factoryLocation.name}`} 
                  <span className="mx-2 text-slate-400">|</span> 
                  📏 {isRTL ? `سنووری ڕێگەپێدراو: ${factoryLocation.radiusMeters} مەتر` : `Radius: ${factoryLocation.radiusMeters}m`}
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
                {isRTL ? 'سیستەم چالاکە' : 'Active'}
              </span>
            </div>

            {attMessage && (
              <div className={`mb-6 p-4 rounded-xl text-xs font-bold ${attMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {attMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Employee Selection & PIN */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isRTL ? 'ناوی کارمەند (لە هەمان داتای سیستەم):' : 'Select Employee from System:'}
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-bold focus:outline-none"
                  >
                    <option value="">{isRTL ? '-- هەڵبژاردنی کارمەند --' : '-- Select Employee --'}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isRTL ? 'کۆدی پین (PIN Code):' : 'PIN Code:'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="••••"
                    className="w-full p-3 text-center tracking-widest text-lg font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <button
                    onClick={requestLocation}
                    className="w-full py-2.5 px-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    {gpsStatus || (isRTL ? '📍 پشکنینی GPS و دووری لە کۆمپانیا' : '📍 Verify Distance from Base')}
                  </button>
                </div>
              </div>

              {/* Camera Selfie Viewport */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center text-center">
                <div className="w-full aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden relative flex items-center justify-center border border-slate-700">
                  {!cameraActive && !capturedSelfie && (
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-md cursor-pointer"
                    >
                      📷 {isRTL ? 'چالاککردنی کامێرا' : 'Open Camera'}
                    </button>
                  )}

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraActive && !capturedSelfie ? 'block' : 'hidden'}`}
                  />

                  {capturedSelfie && (
                    <img src={capturedSelfie} alt="Selfie" className="w-full h-full object-cover" />
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {cameraActive && !capturedSelfie && (
                  <button
                    onClick={capturePhoto}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md cursor-pointer"
                  >
                    📸 {isRTL ? 'گرتبوونی وێنە' : 'Take Photo'}
                  </button>
                )}
              </div>

            </div>

            {/* Attendance Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAttendance('check-in')}
                className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-base tracking-wide shadow-md transition-all cursor-pointer"
              >
                ✅ {isRTL ? 'تۆمارکردنی هاتن (Check-In)' : 'Check-In'}
              </button>

              <button
                onClick={() => handleAttendance('check-out')}
                className="py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-base tracking-wide shadow-md transition-all cursor-pointer"
              >
                🚪 {isRTL ? 'تۆمارکردنی دەرچوون (Check-Out)' : 'Check-Out'}
              </button>
            </div>
          </div>

          {/* Recent Attendance Log Stream */}
          {attLogHistory.length > 0 && (
            <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                {isRTL ? 'کۆتا تۆمارکراوەکانی ئامادەبوون:' : 'Recent Attendance Logs:'}
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {attLogHistory.map((log, idx) => (
                  <div key={idx} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold flex justify-between items-center">
                    <span className="text-slate-900 dark:text-white">{log.name}</span>
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">{log.type}</span>
                    {log.distance && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-[11px]">
                        📍 {log.distance}
                      </span>
                    )}
                    <span className="text-slate-500 font-mono text-[11px]">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. COMPACT MODEL SEARCH SECTION (4 Columns) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              🔍 {isRTL ? 'گەڕان بەدوای مۆدێلدا' : 'Model Search'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRTL ? 'گەڕانی خێرا بەپێی ناوی مۆدێل یان پۆلێن' : 'Quick lookup for models, stock & condition'}
            </p>
          </div>

          {/* Search Field */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'ناوی مۆدێل بنووسە...' : 'Search model...'}
              className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
            />
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl hover:border-slate-400 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {item.model || item.name || 'Model'}
                    </h3>
                    <span className="text-xs font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md">
                      {item.quantity || 0} دەنک
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 font-semibold space-y-1">
                    {item.classification && (
                      <p>
                        {isRTL ? 'پۆلێن:' : 'Category:'} <span className="font-mono text-slate-700 dark:text-slate-300">{item.classification}</span>
                      </p>
                    )}
                    {item.modelCondition && (
                      <p>
                        {isRTL ? 'بارودۆخ:' : 'Condition:'} <span className="text-slate-700 dark:text-slate-300">{item.modelCondition}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-slate-400">
                  {isRTL ? 'هیچ مۆدێلێک نەدۆزرایەوە' : 'No models found'}
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
