'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Camera, RefreshCw, Smartphone, CheckCircle, XCircle } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  deviceBound: boolean;
}

interface Warehouse {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const whId = searchParams.get('wh');
  const token = searchParams.get('token');
  const bindUser = searchParams.get('bind_user');

  const [mounted, setMounted] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<Warehouse | null>(null);
  
  // Geolocation states
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // App States: 'loading' | 'register' | 'attendance' | 'success'
  const [viewState, setViewState] = useState<'loading' | 'register' | 'attendance' | 'success'>('loading');
  const [statusMessage, setStatusMessage] = useState('ئامادەکردنی لۆکەیشن و پێناسە...');

  // Registration States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [pin, setPin] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Camera & Log States
  const [currentEmployee, setCurrentEmployee] = useState<{ id: string; name: string } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logResult, setLogResult] = useState<{ type: string; employeeName: string; time: string; message: string; address?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Initialize
  useEffect(() => {
    setMounted(true);
    let tokenVal = localStorage.getItem('device_token');
    if (!tokenVal) {
      tokenVal = 'dev-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('device_token', tokenVal);
    }
    setDeviceToken(tokenVal);

    async function init() {
      try {
        const res = await fetch('/api/attendance/warehouses');
        if (res.ok) {
          const data = await res.json();
          setWarehouses(data);
          const active = data.find((w: Warehouse) => w.id === whId);
          if (active) setActiveWarehouse(active);
        }
      } catch (e) {
        console.error('Failed to load warehouses:', e);
      }
    }
    init();
    watchGps();

    return () => {
      // Stop webcam stream on unmount
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [whId]);

  // 2. Watch Geolocation
  const watchGps = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      setGpsError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          setGpsLocked(true);
        },
        (err) => {
          console.error('GPS Error:', err);
          setGpsError('تکایە لۆکەیشن (GPS)ی مۆبایلەکەت چالاک بکە بۆ تۆمارکردنی دەوام!');
          setGpsLocked(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsError('مۆبایلەکەت پشتگیری GPS ناکات.');
    }
  };

  // 3. Check device binding once token & GPS is ready
  useEffect(() => {
    if (!deviceToken) return;

    // Check automatic admin binding request
    if (bindUser) {
      setStatusMessage('بەستنەوەی خۆکارانەی ئامێر بە کارمەند...');
      async function autoBind() {
        try {
          const res = await fetch('/api/attendance/register-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: bindUser, pin: 'Bypass-QR-Pin', deviceToken })
          });
          if (res.ok) {
            setStatusMessage('ئامێرەکە سەرکەوتووانە بەسترایەوە! دەگوازرێتەوە...');
            setTimeout(() => {
              router.replace(`/attendance/checkin?wh=${whId || ''}`);
            }, 1500);
          } else {
            const err = await res.json();
            setStatusMessage(`هەڵەی بەستنەوە: ${err.error || 'نشست'}`);
            setViewState('register');
            loadEmployees();
          }
        } catch (e) {
          setStatusMessage('کێشەی هێڵی ئینتەرنێت هەیە.');
        }
      }
      autoBind();
      return;
    }

    // Normal Check Auth
    async function checkAuth() {
      try {
        const res = await fetch('/api/attendance/check-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken })
        });
        const data = await res.json();
        if (data.authenticated) {
          setCurrentEmployee(data.user);
          setViewState('attendance');
        } else {
          setViewState('register');
          loadEmployees();
        }
      } catch (err) {
        setStatusMessage('نشست لە پەیوەندی بە سێرڤەرەوە.');
      }
    }
    checkAuth();
  }, [deviceToken, bindUser]);

  // Load employees list for device binding
  async function loadEmployees() {
    try {
      const res = await fetch('/api/attendance/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 4. Start Camera Stream for check-in
  useEffect(() => {
    if (viewState === 'attendance') {
      let activeStream: MediaStream | null = null;
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      }).then(s => {
        activeStream = s;
        setCameraStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      }).catch(err => {
        console.error('Camera Access Error:', err);
        alert('پێویستە ڕێگە بە کامێرا بدەیت بۆ ئەوەی بتوانیت دەوامەکەت تۆمار بکەیت!');
      });

      return () => {
        if (activeStream) {
          activeStream.getTracks().forEach(t => t.stop());
        }
      };
    }
  }, [viewState]);

  if (!mounted) return null;

  // Handle device registration submit
  const handleRegisterDevice = async () => {
    if (!selectedEmployee || !pin) {
      alert('تکایە ناوێک هەڵبژێرە و پین کۆدەکەت بنووسە.');
      return;
    }
    try {
      setRegLoading(true);
      const res = await fetch('/api/attendance/register-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmployee, pin, deviceToken })
      });
      const data = await res.json();
      if (res.ok) {
        alert('مۆبایلەکەت بە سەرکەوتوویی بەسترایەوە!');
        window.location.reload();
      } else {
        alert(data.error || 'شکست لە پەیوەستکردنی ئامێر');
      }
    } catch (err) {
      alert('شکستی هێڵ هەیە.');
    } finally {
      setRegLoading(false);
    }
  };

  // Capture image snapshot & Submit Unified Check-in
  const handleLogAttendance = async () => {
    if (!gpsLocked || lat === null || lng === null) {
      alert('تکایە چاوەڕێ بکە تا لۆکەیشن (GPS) چالاک دەبێت.');
      watchGps();
      return;
    }

    if (!videoRef.current) return;
    
    // Capture from video
    const video = videoRef.current;
    const canvas = canvasRef.current!;
    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.drawImage(video, 0, 0, width, height);
    
    const base64Selfie = canvas.toDataURL('image/jpeg');
    setSelfieBase64(base64Selfie);

    // Stop camera
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/attendance/check-in-out-unified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentEmployee?.id,
          deviceToken,
          warehouseId: activeWarehouse ? activeWarehouse.id : null,
          lat,
          lng,
          selfie: base64Selfie,
          token
        })
      });
      const data = await res.json();
      if (res.ok) {
        setLogResult(data);
        setViewState('success');
      } else {
        alert(data.error || 'نشست لە تۆمارکردنی دەستبەکاربوون');
        // Restart Camera
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        }).then(s => {
          setCameraStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        });
        setSelfieBase64(null);
      }
    } catch (err) {
      alert('شکستی هێڵ هەیە لە تۆمارکردنی دەوامدا.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f7fa] py-8 px-4 text-right" dir="rtl">
      <Card className="w-full max-w-[480px] mx-auto border border-white/60 bg-white/60 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
        
        {/* Top Header */}
        <div className="p-6 text-center border-b border-white/40 bg-white/10">
          <div className="text-3xl mb-1">📍</div>
          <h2 className="text-lg font-black text-slate-800">تۆمارکردنی کاتی دەوام</h2>
          <p className="text-[10px] font-black text-slate-400 tracking-wider mt-1 uppercase">ناوچەی چاودێری کۆگاکانی ئاشڵی</p>
          
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.push('/attendance')} className="border-primary/20 text-primary text-[11px] font-bold py-1 px-4 rounded-xl cursor-pointer">
              📋 بینینی دەوامەکانم
            </Button>
          </div>
        </div>

        {/* Warehouse banner */}
        <div className="py-2.5 px-4 bg-primary text-white text-center font-bold text-xs tracking-wide">
          {activeWarehouse ? `📍 کۆگای چالاک: ${activeWarehouse.name}` : '📍 دەروازەی سەرەکی دەوام (سەرانسەری)'}
        </div>

        <div className="p-6">
          
          {/* STATE 1: LOADING */}
          {viewState === 'loading' && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">{statusMessage}</p>
            </div>
          )}

          {/* STATE 2: DEVICE REGISTRATION */}
          {viewState === 'register' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-black text-slate-700">📲 بەستنەوەی مۆبایلەکەت</h3>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">ئەم مۆبایلە هێشتا بە ناوی هیچ کارمەندێکەوە نەبەستراوەتەوە. تکایە ناوت هەڵبژێرە و پین کۆد بنووسە بۆ چالاککردنی ئامێرەکەت:</p>
              
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کارمەند:</label>
                  <select 
                    value={selectedEmployee} 
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full text-xs font-bold bg-white/80 border border-white/60 p-2.5 rounded-xl outline-none"
                  >
                    <option value="" disabled>ناوی خۆت هەڵبژێرە...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} {emp.deviceBound ? '(📲 بەستراوەتەوە)' : '(ئامادەیە)'}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کۆدی PIN:</label>
                  <input 
                    type="password" 
                    placeholder="پینی چوار ژمارەیی" 
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    pattern="[0-9]{4}" 
                    inputMode="numeric" 
                    className="w-full text-center text-sm font-black tracking-widest bg-white/80 border border-white/60 p-2.5 rounded-xl outline-none"
                  />
                </div>

                <Button 
                  onClick={handleRegisterDevice} 
                  disabled={regLoading}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-3 px-4 rounded-xl mt-4 cursor-pointer"
                >
                  {regLoading ? 'بەستنەوە...' : '📲 مۆبایلەکەم ببەستەوە (Register)'}
                </Button>
              </div>
            </div>
          )}

          {/* STATE 3: ATTENDANCE SCAN & SELFIE AREA */}
          {viewState === 'attendance' && (
            <div className="space-y-5 text-center">
              <div className="bg-slate-50/70 border border-white/50 p-4 rounded-2xl text-right flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">کارمەندی بەستراو:</span>
                  <h4 className="text-sm font-black text-slate-800 mt-0.5">{currentEmployee?.name}</h4>
                </div>
                
                <div className="text-left">
                  {gpsLocked ? (
                    <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      📍 لۆکەیشن چالاکە
                    </span>
                  ) : (
                    <Button variant="ghost" onClick={watchGps} className="text-[10px] font-black text-rose-500 hover:bg-rose-50/20 p-1.5 h-auto rounded-lg">
                      ⚠️ GPS چالاک بکە
                    </Button>
                  )}
                </div>
              </div>

              {gpsError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold leading-relaxed">
                  {gpsError}
                </div>
              )}

              {/* Webcam viewport */}
              <div className="relative mx-auto w-full max-w-[280px] aspect-[3/4] border-2 border-white/80 bg-slate-900 rounded-2xl overflow-hidden shadow-lg">
                {!selfieBase64 ? (
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src={selfieBase64} 
                    alt="Captured Selfie" 
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Visual Camera target guide */}
                <div className="absolute inset-4 border border-dashed border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white/25" />
                </div>
              </div>

              {/* Action trigger button */}
              <Button 
                onClick={handleLogAttendance} 
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-600/95 text-white font-black py-4 px-6 rounded-xl text-sm shadow-md cursor-pointer"
              >
                {submitting ? 'ناردنی داتا...' : '📷 تۆمارکردنی دەوام (تۆمار/سێڵفی)'}
              </Button>
            </div>
          )}

          {/* STATE 4: SUCCESS VIEW */}
          {viewState === 'success' && logResult && (
            <div className="text-center space-y-6">
              <div className="py-8 px-4 border border-emerald-100 bg-emerald-50/40 rounded-3xl space-y-4">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
                
                <h3 className="text-sm font-black text-slate-800 leading-tight">
                  سوپاس بەرێز {logResult.employeeName}
                </h3>
                
                <p className="text-xs font-black text-slate-500 leading-relaxed">
                  {logResult.message} <br/> (کاتی تۆمارکردن: <span className="text-slate-800">{logResult.time}</span>)
                </p>
                
                {logResult.address && (
                  <p className="text-[10px] text-slate-400 font-bold leading-tight pt-2 border-t border-slate-200/50">
                    📍 ناونیشان: {logResult.address}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => router.push('/attendance')} 
                  className="flex-1 bg-primary text-white font-bold py-3 px-4 rounded-xl cursor-pointer"
                >
                  📋 بینینی دەوامەکانم
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()} 
                  className="flex-1 border-slate-300 font-bold py-3 px-4 rounded-xl cursor-pointer"
                >
                  🔄 تۆمارکردنی نوێ
                </Button>
              </div>
            </div>
          )}

        </div>
      </Card>
      
      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
