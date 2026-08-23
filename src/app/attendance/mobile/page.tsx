'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Sliders,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  autonomousGeofenceManager, 
  getDistanceMeters, 
  sendLocalNotification, 
  type GeofenceRegion 
} from '@/lib/background-geofence';

export default function AutonomousMobileAttendancePage() {
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  // Selected or Stored Employee
  const [employeeProfile, setEmployeeProfile] = useState<{ id: string; name: string } | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; fullName3Part?: string }>>([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');

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
  const [autoTrackingActive, setAutoTrackingActive] = useState<boolean>(true);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const [loadingAction, setLoadingAction] = useState<boolean>(false);
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  // 1. Live Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setCurrentTimeStr(format(now, 'HH:mm:ss'));
      setCurrentDateStr(format(now, 'yyyy-MM-dd (EEEE)'));
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
            setSelectedEmpId(parsed.id);
          }
        } catch {}
      }

      if ('Notification' in window) {
        setNotifPermission(Notification.permission);
      }
    }

    // Fetch employee directory
    fetch('/api/attendance/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllEmployees(data);
        }
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
        } else if (data?.lat && data?.lng) {
          setCompanyLocation({
            id: 'main-loc',
            name: data.name || 'کۆمپانیای سەرەکی ئاشڵی',
            lat: data.lat,
            lng: data.lng,
            radiusMeters: data.radiusMeters || 55,
          });
        }
      })
      .catch(() => {});
  }, []);

  // 3. Start Background Geofence Watcher when profile is active
  useEffect(() => {
    if (!employeeProfile || !autoTrackingActive) {
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
        if (status.message) {
          setLastActionMessage(status.message);
        }
      },
    });

    return () => {
      autonomousGeofenceManager.stop();
    };
  }, [employeeProfile, autoTrackingActive, companyLocation]);

  // 4. Track GPS locally for UI rendering
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

  // 5. Load Today's Attendance Logs for this employee
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

  // Handle Profile Selection
  const handleSaveProfile = () => {
    const found = allEmployees.find(e => e.id === selectedEmpId);
    if (found) {
      const profile = { id: found.id, name: found.fullName3Part || found.name };
      setEmployeeProfile(profile);
      localStorage.setItem('ashley_mobile_employee_profile', JSON.stringify(profile));
      sendLocalNotification('🎉 پرۆفایلی کارمەند بەستراوە', `بەخێربێیت ${profile.name}! سیستەمی ئۆتۆماتیکی دەوام چالاکە.`);
    }
  };

  // Request Notification Permissions
  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        sendLocalNotification('🔔 ئاگادارییەکان چالاک کران', 'لەمەودوا لە کاتی هاتن و ڕۆیشتن پەیامت بۆ دێت.');
      }
    }
  };

  // Manual Instant Action (Fallback)
  const handleManualAction = async (action: 'ENTER' | 'EXIT') => {
    if (!employeeProfile || currentLat === null || currentLng === null) {
      alert('تکایە چاوەڕێ بکە تا لۆکەیشنی GPS دەدۆزرێتەوە.');
      return;
    }

    setLoadingAction(true);
    try {
      await autonomousGeofenceManager.triggerGeofenceEvent(
        action,
        currentLat,
        currentLng,
        distanceMeters || 0
      );
    } finally {
      setLoadingAction(false);
      refreshLogs();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-start p-4 selection:bg-emerald-500 selection:text-black">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-5">
        
        {/* Top Header & Live Clock */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>ئاشڵی مۆبایل</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                  AUTO
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold">تۆماری ئۆتۆماتیکی دەوام لە پاشبنەما</p>
            </div>
          </div>

          <div className="text-left font-mono">
            <div className="text-xs font-black text-emerald-400">{currentTimeStr}</div>
            <div className="text-[9px] text-slate-500 font-bold">{currentDateStr.split(' ')[0]}</div>
          </div>
        </div>

        {/* Profile Card / Setup */}
        {!employeeProfile ? (
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-400">
              <UserCheck className="w-4 h-4" />
              <span>دەستنیشانکردنی ناسنامەی کارمەند لەم مۆبایلەدا</span>
            </div>
            <p className="text-[11px] text-slate-300">
              تەنها یەکجار ناوی خۆت هەڵبژێرە، لەمەودوا بە شێوەی خۆکارانە لەم مۆبایلەوە دەوامت بۆ تۆمار دەکرێت:
            </p>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white font-bold"
            >
              <option value="">-- ناوی خۆت لە لیستەکە هەڵبژێرە --</option>
              {allEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName3Part || emp.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveProfile}
              disabled={!selectedEmpId}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
            >
              تۆمارکردن و بەستنەوەی ئەم مۆبایلە ✨
            </button>
          </div>
        ) : (
          <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-700/50 flex items-center justify-center font-black text-xs">
                👤
              </div>
              <div>
                <div className="text-xs font-black text-white">{employeeProfile.name}</div>
                <div className="text-[10px] text-emerald-400 font-mono font-bold">ئامێری بەستراوە ✅</div>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm('ئایا دڵنیایت لە گۆڕینی کارمەند لەسەر ئەم مۆبایلە؟')) {
                  localStorage.removeItem('ashley_mobile_employee_profile');
                  setEmployeeProfile(null);
                }
              }}
              className="text-[10px] text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg border border-slate-700"
            >
              گۆڕین
            </button>
          </div>
        )}

        {/* Live Radar & Geofence Status Card */}
        <div className="p-5 bg-gradient-to-b from-slate-800/80 to-slate-900 rounded-2xl border border-slate-700/80 space-y-4 text-center relative overflow-hidden">
          
          {/* Pulsing Radar Ring */}
          <div className="relative flex items-center justify-center py-2">
            <div className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all duration-700 ${
              isInsideGeofence 
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' 
                : 'border-slate-700 bg-slate-800/50'
            }`}>
              <div className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all ${
                isInsideGeofence ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
              }`}>
                <MapPin className={`w-7 h-7 ${isInsideGeofence ? 'animate-bounce text-emerald-400' : ''}`} />
                <span className="text-[10px] font-black font-mono mt-0.5">
                  {distanceMeters !== null ? `${distanceMeters}m` : '...'}
                </span>
              </div>
            </div>
          </div>

          {/* Status Text Badge */}
          <div className="space-y-1">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${
              isInsideGeofence
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isInsideGeofence ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>{isInsideGeofence ? '🟢 تۆ لە ناو بازنەی کۆمپانیایت' : '🔴 تۆ لە دەرەوەی بازنەی کۆمپانیایت'}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold">
              {companyLocation.name} (بازنەی {companyLocation.radiusMeters} مەتر)
            </p>
          </div>

          {/* Autonomous Mode Toggle Switch */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between px-2">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-200">چاودێری خۆکارانەی هاتن/ڕۆیشتن</div>
              <div className="text-[10px] text-slate-500">بەردەوام دەوام لە پاشبنەما تۆمار دەکات</div>
            </div>
            <button
              onClick={() => setAutoTrackingActive(!autoTrackingActive)}
              className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                autoTrackingActive ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Notifications & Permissions Info */}
        {notifPermission !== 'granted' && (
          <button
            onClick={handleEnableNotifications}
            className="w-full p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-amber-300 text-xs font-black cursor-pointer hover:bg-amber-500/20"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>چالاککردنی ئاگاداری دەنگ لە کاتی هاتن و دەرچوون</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Manual Instant Fallback Buttons */}
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 font-bold text-center">
            ئەگەر کاتی دەوام لۆکەیشنت هێواش بوو، دەتوانیت بە دەستی لێرە پەنجە دابگریت:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleManualAction('ENTER')}
              disabled={loadingAction || !employeeProfile}
              className="py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 text-emerald-400" />
              <span>چێک‌ئین (هاتن)</span>
            </button>

            <button
              onClick={() => handleManualAction('EXIT')}
              disabled={loadingAction || !employeeProfile}
              className="py-2.5 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-sky-400" />
              <span>چێک‌ئاوت (ڕۆیشتن)</span>
            </button>
          </div>
        </div>

        {/* Today's Activity Logs */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-black text-slate-300">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>تۆمارەکانی دەوامی ئەمڕۆت ({todayLogs.length})</span>
            </div>
            <button onClick={refreshLogs} className="text-slate-500 hover:text-white">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {todayLogs.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center text-slate-500 text-xs font-bold">
              هیچ تۆمارێک بۆ ئەمڕۆ نەدۆزرایەوە
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {todayLogs.map((log, idx) => {
                const isIn = (log.type || log.action || '').toLowerCase().includes('in') || (log.type || '').includes('هاتن');
                return (
                  <div
                    key={log.id || idx}
                    className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isIn ? 'bg-emerald-400' : 'bg-sky-400'}`} />
                      <span className="font-black text-white">{isIn ? '📥 چێک‌ئین (هاتن)' : '📤 چێک‌ئاوت (ڕۆیشتن)'}</span>
                    </div>
                    <span className="font-mono text-emerald-300 font-bold text-[11px]">{log.time || log.createdAt}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-[10px] text-slate-600 text-center font-bold">
          Ashley Smart Autonomous ERP • 2027
        </div>
      </div>
    </div>
  );
}
