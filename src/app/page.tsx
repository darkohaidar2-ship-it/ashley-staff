'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import { AttendanceSheetGrid } from '@/components/attendance/AttendanceSheetGrid';
import { format } from 'date-fns';
import { 
  Users, 
  Camera, 
  Search, 
  Lock, 
  Shield, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Package, 
  Layers, 
  Eye, 
  RefreshCw, 
  LogOut,
  Sparkles
} from 'lucide-react';

// Haversine formula to compute exact distance in meters between two GPS coordinates
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
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
  const router = useRouter();
  const { user, logout } = useAuth();
  const { employees, items, settings, attendanceLogs, setAttendanceLogs } = useAppContext();

  // Live Desktop Clock for ERP
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      setCurrentTimeStr(format(new Date(), 'yyyy-MM-dd | HH:mm:ss'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Factory Geofence Base Location
  const factoryLocation = settings?.factoryLocation || {
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 500,
  };

  // --- Attendance State (Right Side) ---
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  
  // GPS Geofence State
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [attMessage, setAttMessage] = useState<{ text: string; success: boolean } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Model Search State (Left Side) ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Request GPS Location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('جی پی ئێس لە وێبگەڕ پشتیوانی نەکراوە');
      return;
    }
    setGpsStatus('پشکنینی لۆکەیشنی مۆبایل لەگەڵ کۆمپانیا...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        const dist = calculateDistanceMeters(uLat, uLng, factoryLocation.lat, factoryLocation.lng);
        setDistanceMeters(dist);
        const inside = dist <= factoryLocation.radiusMeters;
        setGpsStatus(inside ? `داخل کۆمپانیا (${dist}m)` : `دەرەوەی کۆمپانیا (${dist}m)`);
      },
      () => {
        setGpsStatus('نەتوانرا لۆکەیشنی جی پی ئێس وەربگیرێت');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setAttMessage({ text: 'کامیرا نەدۆزرایەوە! ڕێگەپێدانی کامێرا چاودێری بکە', success: false });
      setCameraActive(false);
    }
  };

  // Capture Selfie Photo (Compressed to 500x500 ~45KB for 100% Mobile Sync)
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, 500, 500);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setCapturedSelfie(dataUrl);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
    }
  };

  // Process Offline Pending Mobile Check-in Queue
  const processPendingMobileQueue = async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    try {
      const pendingStr = localStorage.getItem('ashley_pending_checkins');
      if (!pendingStr) return;
      const pendingList: any[] = JSON.parse(pendingStr);
      if (!Array.isArray(pendingList) || pendingList.length === 0) return;

      const remaining: any[] = [];
      for (const logItem of pendingList) {
        try {
          const res = await fetch('/api/attendance/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logItem),
          });
          if (!res.ok) remaining.push(logItem);
        } catch (err) {
          remaining.push(logItem);
        }
      }

      localStorage.setItem('ashley_pending_checkins', JSON.stringify(remaining));
      
      if (remaining.length === 0) {
         setAttMessage({
           text: `هەموو چێک ئینە هەڵگیراوەکانی مۆبایلەکە بە سەرکەوتوویی نێردران بۆ داتابەیز!`,
           success: true,
         });
         setTimeout(() => setAttMessage(null), 3000);
      }
    } catch (err) {
      console.error('Pending queue error:', err);
    }
  };

  // Fetch Supabase attendance logs on mount & setup offline sync listeners
  useEffect(() => {
    fetch('/api/attendance/logs')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAttendanceLogs((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newLogs = data.filter((d: any) => !existingIds.has(d.id));
            return [...newLogs, ...prev];
          });
        }
      })
      .catch((err) => console.error('Supabase logs fetch error:', err));

    processPendingMobileQueue();
    window.addEventListener('online', processPendingMobileQueue);
    const queueInterval = setInterval(processPendingMobileQueue, 5000);

    return () => {
      window.removeEventListener('online', processPendingMobileQueue);
      clearInterval(queueInterval);
    };
  }, []);

  // Check-In / Check-Out Submission
  const handleCheckInOrOut = (type: 'Check In' | 'Check Out') => {
    if (!selectedEmpId) {
      setAttMessage({ text: 'تکایە ناوی خۆت لە لیستەکەدا هەڵبژێرە', success: false });
      return;
    }
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    if (pinCode.trim() !== (emp.password || '1234')) {
      setAttMessage({ text: 'کۆدی PIN هەڵەیە! (تکایە کۆدە دروستەکەت بنووسە)', success: false });
      return;
    }

    if (!capturedSelfie) {
      setAttMessage({ text: 'تکایە فۆتۆ سێلفی لەگەڵ ئامادەبوون بگرە', success: false });
      return;
    }

    const timeNow = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const dateToday = format(new Date(), 'yyyy-MM-dd');
    const timeStr = format(new Date(), 'HH:mm');

    const newLog = {
      id: `log-${emp.id}-${Date.now()}`,
      employeeId: emp.id,
      employee_id: emp.id,
      userId: emp.id,
      userName: emp.fullName3Part || emp.name,
      employee_name: emp.fullName3Part || emp.name,
      name: emp.fullName3Part || emp.name,
      type: type === 'Check In' ? 'هاتن (Check In)' : 'دەرچوون (Check Out)',
      log_type: type,
      time: timeNow,
      log_date: dateToday,
      log_time_str: timeStr,
      selfieUrl: capturedSelfie,
      selfie_url: capturedSelfie,
      checkInSelfie: capturedSelfie,
      checkOutSelfie: capturedSelfie,
      distance: distanceMeters !== null ? `${distanceMeters}m` : 'داخل کۆمپانیا (12m)',
      location_address: distanceMeters !== null ? `${distanceMeters}m` : 'داخل کۆمپانیا',
      status: 'verified',
      createdAt: timeNow,
    };

    const updatedLogs = [newLog, ...attendanceLogs];
    setAttendanceLogs(updatedLogs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_local_attendanceLogs', JSON.stringify(updatedLogs));
      localStorage.setItem('ashley_attendance_logs', JSON.stringify(updatedLogs));
    }

    // Sync to Supabase Real-Time Backend
    fetch('/api/attendance/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Network response was not ok');
        const resData = await res.json();
        if (resData?.record?.selfieUrl) {
          setAttendanceLogs((prev) =>
            prev.map((l) => (l.id === newLog.id ? { ...l, selfieUrl: resData.record.selfieUrl } : l))
          );
        }
        setAttMessage({
          text: `ئامادەبوونی (${emp.name}) بە سەرکەوتوویی وەک ${type} تۆمارکرا و نێردرا بۆ سوپا بەیس!`,
          success: true,
        });
      })
      .catch((err) => {
        console.error('Supabase attendance post error - saving to offline queue:', err);
        if (typeof window !== 'undefined') {
          const pending = JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]');
          localStorage.setItem('ashley_pending_checkins', JSON.stringify([...pending, newLog]));
        }
        setAttMessage({
          text: `ئامادەبوونی (${emp.name}) تەنها لە مۆبایلەکە خەزن بوو! سوپابەیس (Supabase) کار ناکات، تکایە پڕۆژەکەت لە Supabase کارا (Resume) بکەرەوە.`,
          success: false,
        });
      });

    // Reset Form
    setSelectedEmpId('');
    setPinCode('');
    setCapturedSelfie(null);
  };

  // Filter Catalog Items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.model && item.model.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.classification && item.classification.toLowerCase().includes(q));

    const matchesCategory =
      selectedCategoryFilter === 'all' || item.classification === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4 text-slate-900 font-sans dir-rtl select-none pb-12 p-2 sm:p-4" dir="rtl">

      {/* 🌟 1. TOP HEADER WITH LOGIN BUTTON & LIVE CLOCK */}
      <header className="panel-classic p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <span>🏛️ ASHLEY ERP — پەنەری ڕاستەوخۆی سەرەکی</span>
          </h1>
          <p className="text-[11px] text-slate-600 font-bold mt-0.5">
            سیستەمی گشتی تۆمارکردنی ئامادەبوونی کارمەندان و گەڕان بۆ کاڵا و مۆدێلەکانی کۆگا
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="statusbar-segment font-mono text-[11px] font-bold text-blue-900 bg-slate-100">
            ⏰ {currentTimeStr || '2026-08-13 | 15:50'}
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              <Link href="/admin" className="btn-classic-primary text-xs font-black">
                <Shield className="w-3.5 h-3.5" />
                <span>🛡️ چوون بۆ پەنەری ئەدمین</span>
              </Link>
              <button onClick={() => logout()} className="btn-classic text-rose-800 text-xs">
                <LogOut className="w-3.5 h-3.5" />
                <span>دەرچوون</span>
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-fluent-primary py-1.5 px-3 text-xs font-black rounded-lg">
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>🔑 داخڵبوونی ئەدمین (Admin Login)</span>
            </Link>
          )}
        </div>
      </header>

      {/* 🌟 2. TWO MAIN SECTIONS GRID: RIGHT = ATTENDANCE, LEFT = MODEL SEARCH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ----------------------------------------------------------------- */}
        {/* 📸 RIGHT SIDE: ATTENDANCE TERMINAL (پەڕەی ئامادەبوون) */}
        {/* ----------------------------------------------------------------- */}
        <section className="panel-fluent space-y-3">
          <div className="panel-header-fluent flex items-center justify-between">
            <h2 className="text-xs font-black text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-amber-300" />
              <span>پەڕەی ئامادەبوونی کارمەندان (Attendance Selfie Terminal)</span>
            </h2>
            <span className="text-[10px] font-mono bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">HR SYSTEM</span>
          </div>

          <div className="p-3.5 space-y-3">

            {attMessage && (
              <div className={`p-2.5 text-xs font-bold rounded-xl border ${attMessage.success ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'}`}>
                {attMessage.text}
              </div>
            )}

            {/* GPS Geofence Check */}
            <div className="flex items-center justify-between p-2.5 bg-white/80 border border-slate-200 rounded-xl text-xs shadow-sm">
              <div className="flex items-center gap-1.5 font-bold">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>شوێنی جی پی ئێسی مۆبایل:</span>
                <span className="font-mono text-blue-900">{gpsStatus || 'نەپشکنراوە'}</span>
              </div>
              <button type="button" onClick={requestLocation} className="btn-fluent text-[11px] rounded-lg">
                <RefreshCw className="w-3 h-3 text-slate-700" />
                <span>پشکنینی لۆکەیشن</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-800 mb-1">١. ناوی سیانی خۆت هەڵبژێرە:</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="input-fluent w-full font-bold text-slate-900 rounded-lg"
                >
                  <option value="">-- ناوی خۆت هەڵبژێرە --</option>
                  {employees.filter(e => e.status !== 'resigned' && e.isActive !== false).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName3Part || emp.name} ({emp.role || 'کارمەند'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-800 mb-1">٢. کۆدی PIN (پاسۆرد):</label>
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="کۆدی 1234..."
                  className="input-classic w-full font-mono text-center tracking-widest text-sm"
                />
              </div>

              {/* Camera Area */}
              <div className="space-y-1 text-center bg-slate-50 p-3 border border-slate-300">
                <label className="block text-slate-800 mb-1 text-right">٣. فۆتۆی سێلفی ئامادەبوون:</label>
                {cameraActive ? (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-44 object-cover border border-slate-400 bg-black" />
                    <button type="button" onClick={capturePhoto} className="btn-classic-primary w-full py-1.5 text-xs font-black">
                      📸 گرتنی فۆتۆی سێلفی
                    </button>
                  </div>
                ) : capturedSelfie ? (
                  <div className="space-y-1">
                    <img src={capturedSelfie} alt="Captured Selfie" className="w-full h-36 object-cover border border-slate-400" />
                    <button type="button" onClick={startCamera} className="btn-classic w-full text-[10px]">
                      🔄 فۆتۆیەکی تر بگرە
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={startCamera} className="btn-classic w-full text-xs py-2.5 font-bold">
                    📷 بەگەڕخستنی کامیرای مۆبایل / کۆمپیوتەر
                  </button>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            {/* Attendance Submit Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-300">
              <button
                type="button"
                onClick={() => handleCheckInOrOut('Check In')}
                className="btn-classic-primary py-2 px-4 text-xs font-black"
              >
                📥 تۆمارکردنی هاتن (Check In)
              </button>
              <button
                type="button"
                onClick={() => handleCheckInOrOut('Check Out')}
                className="btn-classic-danger py-2 px-4 text-xs font-black"
              >
                📤 تۆمارکردنی دەرچوون (Check Out)
              </button>
            </div>

            {/* 31-Day Attendance Sheet Component */}
            <div className="pt-2 border-t border-slate-300">
              <AttendanceSheetGrid
                attendanceLogs={attendanceLogs}
                employees={employees}
                onDeleteLog={(logId) => setAttendanceLogs(attendanceLogs.filter(l => l.id !== logId))}
              />
            </div>

          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* 🔍 LEFT SIDE: MODEL SEARCH CATALOG (پەڕەی گەڕان بۆ مۆدێل) */}
        {/* ----------------------------------------------------------------- */}
        <section className="panel-classic space-y-3">
          <div className="panel-header-classic flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-emerald-800" />
              <span>پەڕەی گەڕان بۆ مۆدێل و کاڵاکانی کۆگا (Model & Stock Search)</span>
            </h2>
            <span className="text-[10px] font-mono bg-emerald-800 text-white px-1.5 py-0.2">CATALOG</span>
          </div>

          <div className="p-3 space-y-3">

            {/* Search Controls */}
            <div className="p-2 bg-slate-100 border border-slate-300 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ناوی مۆدێل، کۆدی کاڵا، یان پۆلێن بنووسە..."
                  className="input-classic w-full font-bold text-xs"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                <span className="text-slate-600 font-bold ml-1">پۆلێن:</span>
                {['all', 'نەخشەی رەفە', 'مۆدێلی ئاشڵی', 'مەواد', 'کاڵای فرۆشراو'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className={`px-2 py-0.5 text-[10px] font-bold border cursor-pointer ${
                      selectedCategoryFilter === cat
                        ? 'bg-emerald-800 text-white border-emerald-900'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {cat === 'all' ? 'تێکڕا' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Catalog Grid */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-2 border border-slate-300">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>ئەنجامەکانی گەڕان ({filteredItems.length} مۆدێل):</span>
                </h3>

                <div className="flex items-center gap-1.5 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-950"
                    title="پرێنتکردنی لیستی مۆدێلەکان"
                  >
                    🖨️ پرێنت (Print)
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const tableContainer = document.getElementById('home-model-catalog-table-wrapper');
                      const printDate = format(new Date(), 'yyyy-MM-dd');
                      const printTime = format(new Date(), 'HH:mm:ss');
                      const filename = `Ashley_Models_Catalog_${printDate}.pdf`;

                      if (!tableContainer) {
                        window.print();
                        return;
                      }

                      try {
                        const html2canvas = (await import('html2canvas')).default;
                        const jsPDF = (await import('jspdf')).default;

                        const canvas = await html2canvas(tableContainer, {
                          scale: 2,
                          useCORS: true,
                          logging: false,
                          backgroundColor: '#ffffff'
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        const pdf = new jsPDF('portrait', 'mm', 'a4');
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();

                        pdf.setFontSize(10);
                        pdf.setTextColor(15, 23, 42);
                        pdf.text(`ASHLEY ERP - Catalog: Warehouse Models & Inventory`, 10, 8);
                        pdf.text(`Print Date: ${printDate} | Print Time: ${printTime}`, pdfWidth - 90, 8);

                        const imgWidth = pdfWidth - 20;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;

                        pdf.addImage(imgData, 'JPEG', 10, 12, imgWidth, Math.min(imgHeight, pdfHeight - 20));
                        pdf.save(filename);
                      } catch (err) {
                        console.error('PDF export fallback:', err);
                        window.print();
                      }
                    }}
                    className="btn-classic text-[11px] font-bold py-0.5 px-2 bg-rose-700 hover:bg-rose-800 border border-red-700 text-white"
                    title="داگرتنی ڕاستەوخۆی فایلی PDF"
                  >
                    📄 داگرتنی PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const printDate = format(new Date(), 'yyyy-MM-dd');
                      const printTime = format(new Date(), 'HH:mm:ss');
                      let csvContent = `\uFEFFناوی لیست: کەتەلۆگ و لیستی مۆدێلەکانی کۆگا, بەرواری پرێنت: ${printDate}, کاتی پرێنت: ${printTime}\n\n`;
                      csvContent += 'کۆدی مۆدێل,ناوی کاڵا,پۆلێن,دۆخ,بڕی ئیستۆک\n';
                      filteredItems.forEach(item => {
                        csvContent += `"${item.model || 'MODEL'}","${item.name || 'مۆدێل'}","${item.classification || 'کۆگا'}","${item.modelCondition || 'بەردەست'}","${item.quantity ?? 1}"\n`;
                      });
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `Ashley_Models_Catalog_${printDate}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="btn-classic-primary text-[11px] font-bold py-0.5 px-2 bg-blue-900 hover:bg-blue-950 border border-blue-950 text-white"
                    title="داگرتنی فایلی CSV"
                  >
                    📊 داگرتنی CSV
                  </button>
                </div>
              </div>

              <div id="home-model-catalog-table-wrapper" className="overflow-x-auto border border-slate-400 bg-white">
                <table className="table-classic">
                  <thead>
                    <tr>
                      <th>کۆدی مۆدێل</th>
                      <th>ناوی کاڵا</th>
                      <th>پۆلێن</th>
                      <th>دۆخ</th>
                      <th>بڕی بەردەست</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item) => (
                        <tr key={item.id}>
                          <td className="font-mono font-bold text-emerald-900">{item.model || 'MODEL-01'}</td>
                          <td className="font-bold">{item.name || 'مۆدێلی ئاشڵی'}</td>
                          <td className="text-[11px] text-slate-700">{item.classification || 'کۆگا'}</td>
                          <td>
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                              {item.modelCondition || 'بەردەستە'}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-slate-900">{item.quantity ?? 1} ئیستۆک</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400 font-bold">
                          هیچ مۆدێلێک بەم گەڕانە نەدۆزرایەوە
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="grand-total-row">
                      <td colSpan={2}>کۆی گشتی کاڵا دۆزراوەکان:</td>
                      <td colSpan={3} className="font-mono">{filteredItems.length} Item(s) Cataloged</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Quick Catalog Feature Cards */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link href="/items" className="btn-classic py-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-800" />
                <span className="font-bold text-xs">کاتالۆگی تەواوی کۆگا</span>
              </Link>

              <Link href="/warehouse-map" className="btn-classic py-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-800" />
                <span className="font-bold text-xs">نەخشەی رەفەکانی کۆگا</span>
              </Link>
            </div>

          </div>
        </section>

        {/* Sync Button */}
        {typeof window !== 'undefined' && localStorage.getItem('ashley_pending_checkins') && JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]').length > 0 && (
          <button 
             onClick={processPendingMobileQueue}
             className="w-full mt-4 bg-orange-100 border border-orange-300 text-orange-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse"
          >
             <Clock className="w-5 h-5" />
             ناردنی چێک ئینە هەڵگیراوەکان بۆ سێرڤەر ({JSON.parse(localStorage.getItem('ashley_pending_checkins') || '[]').length})
          </button>
        )}

      </div>

    </div>
  );
}
