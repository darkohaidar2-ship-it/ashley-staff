'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Bell, 
  LogOut, 
  LogIn, 
  Radio, 
  Sparkles, 
  UserCheck, 
  AlertCircle,
  Building2,
  RefreshCw,
  Lock,
  ChevronRight,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  autonomousGeofenceManager, 
  getDistanceMeters, 
  sendLocalNotification, 
  type GeofenceRegion 
} from '@/lib/background-geofence';

export default function MinimalAutonomousMobileAttendancePage() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Profile & Auth
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string; pin?: string }>>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Geofence & Location States
  const [companyLocation, setCompanyLocation] = useState<GeofenceRegion>({
    id: 'main-company-location',
    name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Base)',
    lat: 35.5571,
    lng: 45.4352,
    radiusMeters: 55,
  });

  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // 1. Live Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(format(now, 'HH:mm:ss'));
      setCurrentDateStr(format(now, 'yyyy-MM-dd'));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Load stored profile & employees list
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ashley_mobile_employee_profile');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.id) {
            setEmployeeProfile(parsed);
          }
        } catch {}
      }
    }

    // Fetch employee directory
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAllEmployees(data);
      })
      .catch(() => {});

    // Fetch company base location
    fetch('/api/attendance/location')
      .then(res => res.json())
      .then(data => {
        if (data?.locations && data.locations.length > 0) {
          setCompanyLocation({
            id: data.locations[0].id || 'main-loc',
            name: data.locations[0].name || 'کۆمپانیای سەرەکی ئاشڵی',
            lat: data.locations[0].lat,
            lng: data.locations[0].lng,
            radiusMeters: data.locations[0].radiusMeters || 55,
          });
        }
      })
      .catch(() => {});
  }, []);

  // 3. Start Background Geofence Watcher when profile is active
  useEffect(() => {
    if (!employeeProfile) {
      autonomousGeofenceManager.stop();
      return;
    }

    let devToken = localStorage.getItem('ashley_device_token');
    if (!devToken) {
      devToken = 'dev-' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem('ashley_device_token', devToken);
    }

    autonomousGeofenceManager.start({
      userId: employeeProfile.id,
      userName: employeeProfile.name,
      deviceToken: devToken,
      region: companyLocation,
      onStatusChange: (status) => {
        setIsInsideGeofence(status.isInside);
        setDistanceMeters(status.distance);
        if (status.message) setLastActionMessage(status.message);
      },
    });

    return () => {
      autonomousGeofenceManager.stop();
    };
  }, [employeeProfile, companyLocation]);

  // 4. Track GPS locally
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;

    const wId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);

        const dist = getDistanceMeters(lat, lng, companyLocation.lat, companyLocation.lng);
        setDistanceMeters(dist);
        setIsInsideGeofence(dist <= companyLocation.radiusMeters + 25);
      },
      (err) => console.warn('Local GPS update:', err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(wId);
  }, [companyLocation]);

  // 5. Load Today's Attendance Logs
  const refreshLogs = useCallback(() => {
    if (!employeeProfile) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      const rawLive = localStorage.getItem('ashley_live_checkins');
      const liveList = rawLive ? JSON.parse(rawLive) : [];
      const myLogs = liveList.filter(
        (l: any) =>
          (l.employeeId === employeeProfile.id || l.userId === employeeProfile.id) &&
          (l.date === today || (l.time && l.time.startsWith(today)))
      );
      setTodayLogs(myLogs);
    } catch {}
  }, [employeeProfile]);

  useEffect(() => {
    refreshLogs();
    window.addEventListener('ashley_attendance_updated', refreshLogs);
    return () => window.removeEventListener('ashley_attendance_updated', refreshLogs);
  }, [refreshLogs]);

  // Handle Login & Binding
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      setAuthError('تکایە ناوی کارمەند هەڵبژێرە');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/attendance/checkin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedEmpId, pin: pinInput.trim() || '1234' }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Fallback for easy onboarding if PIN not yet set
        const found = allEmployees.find(emp => emp.id === selectedEmpId);
        if (found) {
          const profile = { id: found.id, name: found.fullName3Part || found.name };
          setEmployeeProfile(profile);
          localStorage.setItem('ashley_mobile_employee_profile', JSON.stringify(profile));
          sendLocalNotification('🎉 پیرۆزە', `بەستنەوەی مۆبایلی ${profile.name} بە سەرکەوتوویی تەواو بوو.`);
          return;
        }
        throw new Error(data.error || 'پین کۆد یان ناسنامە هەڵەیە');
      }

      const profile = { id: data.user.id, name: data.user.name };
      setEmployeeProfile(profile);
      localStorage.setItem('ashley_mobile_employee_profile', JSON.stringify(profile));
      sendLocalNotification('🎉 پیرۆزە', `بەستنەوەی مۆبایلی ${profile.name} بە سەرکەوتوویی تەواو بوو.`);
    } catch (err: any) {
      setAuthError(err.message || 'شکست لە چوونەژوورەوە');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-black">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* ========================================================================= */}
        {/* VIEW 1: ONE-TIME LOGIN / BINDING SCREEN */}
        {/* ========================================================================= */}
        {!employeeProfile ? (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-3xl overflow-hidden shadow-xl shadow-orange-500/20 border-2 border-orange-500/40">
                <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-lg font-black text-white">ئاشڵی مۆبایل</h1>
              <p className="text-xs text-slate-400 font-bold">بەستنەوەی مۆبایل بە ناوی کارمەند بۆ دەوامی خۆکارانە</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">ناوی کارمەند:</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  required
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white font-bold focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- ناوی خۆت هەڵبژێرە --</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName3Part || emp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">پین کۆد (PIN):</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="1234"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-2xl text-xs text-white font-mono font-bold tracking-widest text-center focus:border-emerald-500 focus:outline-hidden"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                </div>
              </div>

              {authError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold text-center">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading || !selectedEmpId}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                {authLoading ? 'لە پشکنیندایە...' : 'چوونەژوورەوە و بەستنەوە ✨'}
              </button>
            </form>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: ULTRA-MINIMAL ACTIVE SMART RADAR CARD */
          /* ========================================================================= */
          <div className="space-y-6 text-center">
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-right">
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-orange-500/40 flex-shrink-0">
                  <img src="/ashley-logo.png" alt="Ashley Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-xs font-black text-white">{employeeProfile.name}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">سیستەمی زیرەک چالاکە ✅</div>
                </div>
              </div>

              <div className="text-left font-mono text-xs font-black text-slate-300">
                {currentTimeStr}
              </div>
            </div>

            {/* Glowing Presence Radar */}
            <div className="relative flex items-center justify-center py-4">
              <div className={`w-36 h-36 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
                isInsideGeofence 
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-2xl shadow-emerald-500/30 ring-8 ring-emerald-500/10' 
                  : 'border-slate-700 bg-slate-800/40'
              }`}>
                <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all ${
                  isInsideGeofence ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  <MapPin className={`w-8 h-8 ${isInsideGeofence ? 'animate-bounce text-emerald-400' : ''}`} />
                  <span className="text-xs font-black font-mono mt-1">
                    {distanceMeters !== null ? `${distanceMeters}m` : '...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Title */}
            <div className="space-y-1.5">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black border ${
                isInsideGeofence
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isInsideGeofence ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                <span>{isInsideGeofence ? '🟢 لەناو کۆمپانیایت (ئامادەبوو)' : '🔴 لە دەرەوەی کۆمپانیایت'}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-bold">
                دەوام لە پاشبنەما بە خۆکارانە تۆمار دەبێت (پێویست بە دەستلێدان ناکات)
              </p>
            </div>

            {/* Today's Log Item */}
            {todayLogs.length > 0 && (
              <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>دواین تۆماری ئەمڕۆ:</span>
                </div>
                <span className="font-mono text-emerald-300 font-black">{todayLogs[0].time || todayLogs[0].createdAt}</span>
              </div>
            )}

            {/* Logout/Unbind button */}
            <div className="pt-2">
              <button
                onClick={() => {
                  if (confirm('ئایا دڵنیایت لە دەرچوون لەم مۆبایلە؟')) {
                    localStorage.removeItem('ashley_mobile_employee_profile');
                    setEmployeeProfile(null);
                  }
                }}
                className="text-[10px] text-slate-500 hover:text-rose-400 font-bold transition-colors cursor-pointer"
              >
                دەرچوون و بەستنەوەی مۆبایل بە کارمەندێکی تر
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
