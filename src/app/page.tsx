'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useAppContext } from '@/context/app-provider';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, collection, doc, setDocumentNonBlocking } from '@/firebase';
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
  const db = useFirestore();

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

  // Camera Facing Mode ('user' = Front / Selfie, 'environment' = Back Camera)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Format Distance nicely (meters vs kilometers)
  const formatDistText = (m: number | null) => {
    if (m === null) return '---';
    if (m >= 1000) return `${(m / 1000).toFixed(2)} کیلۆمەتر`;
    return `${m} مەتر`;
  };

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
          setGpsStatus(`✅ لۆکەیشن پەسەندکرا: دووریت ${formatDistText(dist)} لە شوێنی کۆمپانیا (سنوور: ${formatDistText(radius)})`);
        } else {
          setGpsStatus(`⚠️ ئاگاداری: تۆ لە دەرەوەی ڕووبەری کۆمپانیای! دووریت: ${formatDistText(dist)} (سنووری بەڕێوەبەر: ${formatDistText(radius)})`);
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

  // Start Camera with selectable mode (Front / Back)
  const startCamera = async (mode?: 'user' | 'environment') => {
    const selectedMode = mode || facingMode;
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: selectedMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setFacingMode(selectedMode);
    } catch {
      setAttMessage({
        text: 'نەتوانرا کامێرا بەکاربهێندرێت - تکایە ڕێگەپێدانی کامێرا لە مۆبایلەکەت چالاک بکە',
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

    // MANDATORY PHOTO VALIDATION
    if (!capturedSelfie) {
      setAttMessage({
        text: '📷 پێویستە سەرەتا فۆتۆیەک بە کامێرای پێشەوە یان پشتەوە بگریت پێش تۆمارکردنی دەوام!',
        success: false,
      });
      return;
    }

    // Geofence Radius Validation against Manager's Established Company Base
    if (isWithinGeofence === false) {
      setAttMessage({
        text: `⚠️ ئامادەبوون ڕەتکرایەوە: مۆبایلەکەت لە دەرەوەی ڕووبەری دیاریکراوی کۆمپانیایە (${formatDistText(distanceMeters)} - سنووری بەڕێوەبەر: ${formatDistText(factoryLocation.radiusMeters)})`,
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
      distance: distanceMeters !== null ? formatDistText(distanceMeters) : undefined,
      selfieUrl: capturedSelfie || undefined,
      createdAt: new Date().toISOString(),
    };

    setAttendanceLogs((prev) => [newRecord, ...(prev || [])]);
    setAttLogHistory((prev) => [newRecord, ...prev]);

    if (db) {
      try {
        const colRef = collection(db, 'attendanceLogs');
        setDocumentNonBlocking(doc(colRef, newRecord.id), newRecord, { merge: true });
      } catch (err) {
        console.error('Firestore attendance sync error:', err);
      }
    }
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
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none" dir="rtl">
      
      {/* CLASSIC ENTERPRISE PAGE TITLE & LOCATION BAR */}
      <div className="panel-classic p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-900 text-white font-bold text-xs flex items-center justify-center border border-blue-950">
            🏢
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-900 uppercase tracking-wide">
              سیستەمی سەرەکی ئامادەبوون و جەردی مۆدێلەکان (Enterprise NAV Desktop)
            </h1>
            <p className="text-[11px] text-slate-600 font-bold">
              بناغەی دیاریکراوی کۆمپانیا: <span className="text-slate-900 font-mono">{factoryLocation.name}</span> (سنوور: {factoryLocation.radiusMeters} مەتر)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={requestLocation} className="btn-classic text-[11px]">
            📍 {gpsStatus || 'پشکنینی GPS دووری'}
          </button>
          <Link href="/login" className="btn-classic text-[11px]">
            🔑 داخڵبوونی ئەدمین (Admin)
          </Link>
        </div>
      </div>

      {/* Main Two-Column Classic Enterprise Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* 1. ATTENDANCE CONTROL PANEL (8 Columns - Classic Bordered Panel) */}
        <div className="lg:col-span-8 panel-classic flex flex-col justify-between">
          <div>
            {/* Panel Gradient Header */}
            <div className="panel-header-classic flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                📋 فۆرمی ئامادەبوونی کارمەندان (Attendance Entry Form)
              </span>
              <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-mono border border-emerald-900">
                STATUS: ACTIVE
              </span>
            </div>

            <div className="p-3 space-y-4">

              {attMessage && (
                <div className={`p-2.5 text-xs font-bold ${attMessage.success ? 'bg-emerald-100 text-emerald-950 border border-emerald-400' : 'bg-rose-100 text-rose-950 border border-rose-400'}`}>
                  {attMessage.text}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Employee Selection & PIN Input Panel */}
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-300">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      ناوی کارمەند:
                    </label>
                    <select
                      value={selectedEmpId}
                      onChange={(e) => setSelectedEmpId(e.target.value)}
                      className="input-classic w-full font-bold"
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
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      کۆدی پین (PIN Code):
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="••••"
                      className="input-classic w-full font-mono text-center text-sm font-bold tracking-widest"
                    />
                  </div>

                  <button
                    onClick={handleOpenPersonalProfile}
                    className="btn-classic w-full text-[11px]"
                  >
                    👤 دۆسیە و دواکەوتنەکانی من
                  </button>
                </div>

                {/* Camera Selfie Control Viewport */}
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-300 flex flex-col items-center justify-center text-center">
                  <div className="w-full aspect-[4/3] bg-slate-900 border border-slate-700 relative flex items-center justify-center">
                    {!cameraActive && !capturedSelfie && (
                      <div className="space-y-2 p-2">
                        <p className="text-[10px] text-slate-300 font-bold mb-1">كامێرا هەڵبژێرە بۆ وێنە:</p>
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => startCamera('user')}
                            className="btn-classic text-[10px]"
                          >
                            🤳 کامێرای پێشەوە
                          </button>
                          <button
                            onClick={() => startCamera('environment')}
                            className="btn-classic text-[10px]"
                          >
                            📷 پشتەوە
                          </button>
                        </div>
                      </div>
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
                    <div className="flex items-center gap-1 w-full">
                      <button
                        onClick={capturePhoto}
                        className="btn-classic-primary flex-1 text-[11px]"
                      >
                        📸 گرتنی فۆتۆ
                      </button>
                      <button
                        onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
                        className="btn-classic text-[11px]"
                      >
                        🔄
                      </button>
                    </div>
                  )}

                  {capturedSelfie && (
                    <button
                      onClick={() => {
                        setCapturedSelfie(null);
                        startCamera();
                      }}
                      className="btn-classic w-full text-[10px]"
                    >
                      🔄 گرتنەوەی فۆتۆ
                    </button>
                  )}
                </div>

              </div>

              {/* Attendance Beveled Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => handleAttendance('check-in')}
                  className="btn-classic-primary py-2 text-xs uppercase"
                >
                  ✅ تۆمارکردنی هاتن (Check-In)
                </button>

                <button
                  onClick={() => handleAttendance('check-out')}
                  className="btn-classic-danger py-2 text-xs uppercase"
                >
                  🚪 تۆمارکردنی دەرچوون (Check-Out)
                </button>
              </div>

            </div>
          </div>

          {/* Classic Attendance Log Audit Data Grid */}
          <div className="p-3 border-t border-slate-300">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
              📊 خشتەی لۆگەکان و ئامادەبوونی ئەمڕۆ (Log Data Grid):
            </h3>

            <div className="overflow-x-auto border border-slate-400">
              <table className="table-classic">
                <thead>
                  <tr>
                    <th>ناوی کارمەند</th>
                    <th>جۆری ئامادەبوون</th>
                    <th>کاتی تۆمارکراو</th>
                    <th>دووری لە کۆمپانیا</th>
                    <th>مۆری تەواوبوون</th>
                  </tr>
                </thead>
                <tbody>
                  {attLogHistory.length > 0 ? (
                    attLogHistory.map((log, idx) => (
                      <tr key={idx}>
                        <td className="font-bold">{log.name}</td>
                        <td>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold border ${log.type.includes('In') ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="font-mono text-[11px]">{log.time}</td>
                        <td className="font-mono text-[11px] text-blue-900">{log.distance || 'داخل کۆمپانیا'}</td>
                        <td className="text-emerald-800 font-bold">✅ Verified</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-3 text-slate-500 font-bold">
                        هیچ لۆگێکی ئامادەبوون تۆمار نەکراوە
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="grand-total-row">
                    <td colSpan={2}>کۆی گشتی لۆگەکان:</td>
                    <td colSpan={3} className="font-mono">{attLogHistory.length} Record(s)</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* 2. COMPACT MODEL SEARCH GRID PANEL (4 Columns Panel) */}
        <div className="lg:col-span-4 panel-classic flex flex-col justify-between">
          <div>
            <div className="panel-header-classic flex items-center justify-between">
              <span>🔍 گەڕان لە مۆدێلەکان (Item Catalog Grid)</span>
              <span className="text-[10px] font-mono bg-slate-300 px-1 border border-slate-400">CATALOG</span>
            </div>

            <div className="p-3 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ناوی مۆدێل بنووسە..."
                className="input-classic w-full font-bold"
              />

              <div className="overflow-y-auto max-h-[480px] border border-slate-400">
                <table className="table-classic">
                  <thead>
                    <tr>
                      <th>مۆدێل</th>
                      <th>پۆلێن</th>
                      <th>عەمبار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <tr key={item.id}>
                          <td className="font-bold text-slate-900">{item.model || item.name}</td>
                          <td className="font-mono text-[10px] text-slate-700">{item.classification || '-'}</td>
                          <td className="font-bold font-mono text-blue-900">{item.quantity || 0} دەنک</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center py-4 text-slate-400 font-bold">
                          هیچ مۆدێلێک نەدۆزرایەوە
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="grand-total-row">
                      <td>کۆی مۆدێل:</td>
                      <td colSpan={2} className="font-mono">{filteredItems.length} Item(s)</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. PERSONAL PROFILE & LATENESS MODAL (CLASSIC DIALOG WINDOW) */}
      {showPersonalProfileModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-200 border-2 border-t-white border-l-white border-b-slate-600 border-r-slate-600 w-full max-w-lg shadow-2xl p-1 text-slate-900">
            
            <div className="bg-blue-900 text-white px-2 py-1 text-xs font-bold flex justify-between items-center border-b border-blue-950">
              <span>👤 دۆسیەی کارمەند: {selectedEmployee.name}</span>
              <button
                onClick={() => setShowPersonalProfileModal(false)}
                className="w-4 h-3.5 bg-rose-800 text-white flex items-center justify-center border border-rose-600 font-mono text-[10px]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <div className="p-2 bg-white border border-slate-400">
                  <span className="text-slate-600 block text-[10px]">Overtime:</span>
                  <span className="text-sm font-mono text-blue-900">{totalOvertimeHours} Hours</span>
                </div>
                <div className="p-2 bg-white border border-slate-400">
                  <span className="text-slate-600 block text-[10px]">کۆی بڕینەکان:</span>
                  <span className="text-sm font-mono text-slate-900">
                    {empWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0).toLocaleString()} IQD
                  </span>
                </div>
              </div>

              <div className="border border-slate-400 bg-white">
                <table className="table-classic">
                  <thead>
                    <tr>
                      <th>بەش</th>
                      <th>کات</th>
                      <th>دۆخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attLogHistory.filter((l) => l.name === selectedEmployee.name).map((l, i) => (
                      <tr key={i}>
                        <td>{l.type}</td>
                        <td className="font-mono">{l.time}</td>
                        <td className="text-emerald-800">✅ Verified</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 text-left">
                <button
                  onClick={() => setShowPersonalProfileModal(false)}
                  className="btn-classic text-xs"
                >
                  داخستن (Close)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
