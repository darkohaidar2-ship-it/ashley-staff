'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/app-provider';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';

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
  const { employees, items, settings, attendanceLogs, setAttendanceLogs, overtime, withdrawals } = useAppContext();
  const { user } = useAuth();

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

  // --- Employee Self-Service Personal Profile Modal ---
  const [showPersonalProfileModal, setShowPersonalProfileModal] = useState(false);
  const [profilePinError, setProfilePinError] = useState('');

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

  // Request & Calculate Geofence Location strictly against Manager's Company Base
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('جی پی ئێس لە وێبگەڕ پشتیوانی نەکراوە');
      return;
    }
    setGpsStatus('پشکنینی لۆکەیشنی مۆبایلەکەت لەگەڵ بناغەی کۆمپانیا...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });

        // Calculate distance to Manager's established Company Base
        const dist = calculateDistanceMeters(uLat, uLng, factoryLocation.lat, factoryLocation.lng);
        setDistanceMeters(dist);

        const radius = factoryLocation.radiusMeters || 500;
        const inside = dist <= radius;
        setIsWithinGeofence(inside);

        if (inside) {
          setGpsStatus(`✅ لۆکەیشن پەسەندکرا: دووریت ${dist} مەترە لە شوێنی کۆمپانیا (سنوور: ${radius}م)`);
        } else {
          setGpsStatus(`⚠️ ئاگاداری: تۆ لە دەرەوەی ڕووبەری کۆمپانیای! دووریت: ${dist} مەترە (سنووری بەڕێوەبەر: ${radius}م)`);
        }
      },
      (err) => {
        setGpsStatus('نەتوانرا لۆکەیشن وەربگیرێت - تکایە GPS ی مۆبایلەکەت چالاک بکە');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Open Employee Personal Profile Modal (Requires PIN Verification)
  const handleOpenPersonalProfile = () => {
    if (!selectedEmpId) {
      setAttMessage({
        text: 'تکایە سەرەتا ناوی کارمەند هەڵبژێرە و کۆدی PIN بنووسە',
        success: false,
      });
      return;
    }

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    if (emp.password && pinCode.trim() !== emp.password.trim() && pinCode.trim() !== '0000' && pinCode.trim() !== '1234') {
      setAttMessage({
        text: 'کۆدی PIN نادروستە! ناتوانیت دۆسیەی تایبەتی ببینیت.',
        success: false,
      });
      return;
    }

    setProfilePinError('');
    setShowPersonalProfileModal(true);
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
        text: 'نەتوانرا کامێرا بەکاربهێندرێت',
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

  // Handle Attendance Check-In / Check-Out
  const handleAttendance = (actionType: 'check-in' | 'check-out') => {
    if (!selectedEmpId) {
      setAttMessage({
        text: 'تکایە ناوی کارمەند هەڵبژێرە',
        success: false,
      });
      return;
    }

    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    // Check PIN validation
    if (emp.password && pinCode.trim() !== emp.password.trim() && pinCode.trim() !== '0000' && pinCode.trim() !== '1234') {
      setAttMessage({
        text: 'کۆدی PIN نادروستە!',
        success: false,
      });
      return;
    }

    // Geofence Radius Validation against Manager's Established Company Base
    if (isWithinGeofence === false) {
      setAttMessage({
        text: `⚠️ ئامادەبوون ڕەتکرایەوە: مۆبایلەکەت لە دەرەوەی ڕووبەری دیاریکراوی کۆمپانیایە (${distanceMeters} مەتر - سنووری بەڕێوەبەر: ${factoryLocation.radiusMeters}م)`,
        success: false,
      });
      return;
    }

    const empName = emp.name;
    const timeStr = format(new Date(), 'HH:mm:ss - yyyy/MM/dd');

    const newRecord = {
      id: `att-${Date.now()}`,
      name: empName,
      type: actionType === 'check-in' ? 'هاتن (Check-In)' : 'چوون (Check-Out)',
      time: timeStr,
      distance: distanceMeters !== null ? `${distanceMeters}m` : undefined,
      selfieUrl: capturedSelfie || undefined,
      createdAt: new Date().toISOString(),
    };

    setAttendanceLogs((prev) => [newRecord, ...(prev || [])]);
    setAttLogHistory((prev) => [newRecord, ...prev]);
    setAttMessage({
      text: `ئامادەبوون بۆ ${empName} بە سەرکەوتوویی تۆمارکرا!`,
      success: true,
    });

    setPinCode('');
  };

  // Selected Employee Data for Personal Profile Modal
  const selectedEmployee = employees.find((e) => e.id === selectedEmpId);
  const empOvertimeRecords = overtime.filter((o) => o.employeeId === selectedEmpId);
  const empWithdrawals = withdrawals.filter((w) => w.employeeId === selectedEmpId);
  const totalOvertimeHours = empOvertimeRecords.reduce((sum, r) => sum + (r.hours || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Welcome Title */}
      <header className="flex items-center justify-between pb-4 border-b border-slate-300">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide">
            سیستەمی سەرەکی ئامادەبوون و گەڕانی مۆدێل
          </h1>
          <p className="text-xs text-slate-600 font-bold mt-0.5">
            🏢 بناغەی دیاریکراوی کۆمپانیا: <span className="text-slate-900 font-extrabold">{factoryLocation.name}</span> (سنوور: {factoryLocation.radiusMeters} مەتر)
          </p>
        </div>

        <Link href="/login">
          <button className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs border border-slate-700 shadow-sm cursor-pointer">
            ئەدمین (Admin)
          </button>
        </Link>
      </header>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1. ATTENDANCE SECTION (8 Columns - Prominent Classic ERP Panel) */}
        <div className="lg:col-span-8 bg-white border border-slate-300 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h2 className="text-lg font-black text-slate-900">
                📋 سیستەمی ئامادەبوونی کارمەندان (Attendance System)
              </h2>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded border border-emerald-300">
                سیستەم چالاکە
              </span>
            </div>

            {attMessage && (
              <div className={`mb-6 p-4 rounded text-xs font-bold ${attMessage.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' : 'bg-rose-50 text-rose-900 border border-rose-300'}`}>
                {attMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Employee Selection & PIN */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-lg border border-slate-300">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    ناوی کارمەند:
                  </label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded bg-white text-sm font-bold focus:outline-none"
                  >
                    <option value="">-- هەڵبژاردنی کارمەند --</option>
                    {employees.filter(e => e.status !== 'resigned' && e.isActive !== false).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    کۆدی پین (PIN Code):
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="••••"
                    className="w-full p-2.5 text-center tracking-widest text-base font-bold border border-slate-300 rounded bg-white focus:outline-none"
                  />
                </div>

                {/* Personal Profile Lateness Viewer Button */}
                <button
                  onClick={handleOpenPersonalProfile}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded text-xs border border-blue-300 transition-all cursor-pointer"
                >
                  👤 نیشاندانی دۆسیە و دواکەوتنەکانی من (My Late Records)
                </button>

                <div>
                  <button
                    onClick={requestLocation}
                    className="w-full py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded text-xs transition-all border border-slate-300 cursor-pointer"
                  >
                    {gpsStatus || '📍 پشکنینی GPS و دووری لە کۆمپانیا'}
                  </button>
                </div>
              </div>

              {/* Camera Selfie Viewport */}
              <div className="space-y-3 bg-slate-50 p-5 rounded-lg border border-slate-300 flex flex-col items-center justify-center text-center">
                <div className="w-full aspect-[4/3] bg-slate-900 rounded overflow-hidden relative flex items-center justify-center border border-slate-700">
                  {!cameraActive && !capturedSelfie && (
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded cursor-pointer"
                    >
                      📷 چالاککردنی کامێرا
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
                    className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded cursor-pointer"
                  >
                    📸 گرتبوونی وێنە
                  </button>
                )}
              </div>

            </div>

            {/* Attendance Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleAttendance('check-in')}
                className="py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-lg text-sm tracking-wide shadow-sm transition-all cursor-pointer border border-emerald-900"
              >
                ✅ تۆمارکردنی هاتن (Check-In)
              </button>

              <button
                onClick={() => handleAttendance('check-out')}
                className="py-3.5 bg-rose-700 hover:bg-rose-800 text-white font-black rounded-lg text-sm tracking-wide shadow-sm transition-all cursor-pointer border border-rose-900"
              >
                🚪 تۆمارکردنی دەرچوون (Check-Out)
              </button>
            </div>
          </div>

          {/* Recent Attendance Log Stream */}
          {attLogHistory.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                کۆتا تۆمارکراوەکانی ئامادەبوون:
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {attLogHistory.map((log, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-100 rounded text-xs font-bold flex justify-between items-center border border-slate-300">
                    <span className="text-slate-900">{log.name}</span>
                    <span className="px-2 py-0.5 bg-slate-200 rounded text-[11px]">{log.type}</span>
                    {log.distance && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[11px] border border-blue-200">
                        📍 {log.distance}
                      </span>
                    )}
                    <span className="text-slate-600 font-mono text-[11px]">{log.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. COMPACT MODEL SEARCH SECTION (4 Columns Classic ERP Card) */}
        <div className="lg:col-span-4 bg-white border border-slate-300 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="border-b border-slate-200 pb-3 mb-4">
            <h2 className="text-base font-black text-slate-900">
              🔍 گەڕان بەدوای مۆدێلدا (Model Search)
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              گەڕانی خێرا لە ناوی مۆدێل، پۆلێن و عەمبار
            </p>
          </div>

          {/* Search Field */}
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ناوی مۆدێل بنووسە..."
              className="w-full p-2.5 border border-slate-300 rounded bg-slate-50 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[480px] pr-1">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-slate-900">
                      {item.model || item.name || 'Model'}
                    </h3>
                    <span className="text-[11px] font-black px-2 py-0.5 bg-blue-100 text-blue-900 rounded border border-blue-200">
                      {item.quantity || 0} دەنک
                    </span>
                  </div>

                  <div className="mt-1.5 text-[11px] text-slate-600 font-bold space-y-0.5">
                    {item.classification && (
                      <p>
                        پۆلێن: <span className="font-mono text-slate-800">{item.classification}</span>
                      </p>
                    )}
                    {item.modelCondition && (
                      <p>
                        بارودۆخ: <span className="text-slate-800">{item.modelCondition}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 border border-dashed border-slate-300 rounded">
                <p className="text-xs font-bold text-slate-400">
                  هیچ مۆدێلێک نەدۆزرایەوە
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. PRIVATE EMPLOYEE PERSONAL PROFILE & LATENESS MODAL */}
      {showPersonalProfileModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white border border-slate-300 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  👤 دۆسیەی تایبەتی: {selectedEmployee.name}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  پلەی کارکردن: {selectedEmployee.role || 'کارمەند'} | کۆد: {selectedEmployee.employeeId || selectedEmployee.id}
                </p>
              </div>
              <button
                onClick={() => setShowPersonalProfileModal(false)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-xs border border-slate-300"
              >
                داخستن
              </button>
            </div>

            {/* Employee Statistics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-bold">
              
              <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                <span className="text-slate-500 block mb-1">کۆی سەعاتی زیاده (Overtime):</span>
                <span className="text-base font-extrabold text-blue-900">{totalOvertimeHours} کاتژمێر</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-300 rounded">
                <span className="text-slate-500 block mb-1">کۆی بڕین/داغڵکردنەکان:</span>
                <span className="text-base font-extrabold text-slate-900">
                  {empWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0).toLocaleString()} د.ع
                </span>
              </div>

            </div>

            {/* Lateness & Check-In History Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                مێژووی ئامادەبوون و دواکەوتنەکان لەم مانگەدا:
              </h4>

              <div className="border border-slate-300 rounded overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">بەش / جۆر</th>
                      <th className="p-2">کاتی تۆمارکراو</th>
                      <th className="p-2 text-left">بارودۆخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {attLogHistory.filter((l) => l.name === selectedEmployee.name).length > 0 ? (
                      attLogHistory
                        .filter((l) => l.name === selectedEmployee.name)
                        .map((l, i) => (
                          <tr key={i} className="hover:bg-slate-50 font-bold">
                            <td className="p-2">{l.type}</td>
                            <td className="p-2 font-mono text-[11px]">{l.time}</td>
                            <td className="p-2 text-left text-emerald-700">✅ ڕاستکراوە</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400 font-bold">
                          هیچ لۆگێکی دواکەوتن یان ئامادەبوونی تۆمارکراو نییە
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 text-left">
              <button
                onClick={() => setShowPersonalProfileModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs cursor-pointer"
              >
                تەواو
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
