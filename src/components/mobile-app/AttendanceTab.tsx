'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Navigation, 
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Building,
  UserCheck
} from 'lucide-react';
import { MobileAuthUser, TodayAttendanceInfo, GeofenceStatus } from './types';
import { DEFAULT_COMPANY_LOCATIONS } from '@/lib/geo-constants';

interface AttendanceTabProps {
  user: MobileAuthUser;
  todayInfo: TodayAttendanceInfo | null;
  onRefreshToday: () => void;
  onNavigateTab: (tabId: string) => void;
  isDark?: boolean;
}

// Distance helper
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function AttendanceTab({
  user,
  todayInfo,
  onRefreshToday,
  onNavigateTab,
  isDark = false,
}: AttendanceTabProps) {
  // Live Clock
  const [clockStr, setClockStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  // Geofence Radar State
  const [geoStatus, setGeoStatus] = useState<GeofenceStatus>({
    isChecking: true,
    isInside: false,
    distanceMeters: 0,
    closestLocationName: DEFAULT_COMPANY_LOCATIONS[0].name,
    allowedRadiusMeters: 400,
  });

  // Punch Action State
  const [punching, setPunching] = useState<'check_in' | 'check_out' | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{
    show: boolean;
    type: 'success' | 'outside' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Overtime Note Modal
  const [overtimeModal, setOvertimeModal] = useState<{
    show: boolean;
    overtimeMinutes: number;
    selectedReason: string;
    customNote: string;
    saving: boolean;
  }>({
    show: false,
    overtimeMinutes: 0,
    selectedReason: '',
    customNote: '',
    saving: false,
  });

  // Clock Ticker
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClockStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setDateStr(now.toLocaleDateString('ku-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check Current Geolocation
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus(prev => ({
        ...prev,
        isChecking: false,
        error: 'مۆبایلەکەت پشتگیری لۆکەیشن (GPS) ناکات.',
      }));
      return;
    }

    setGeoStatus(prev => ({ ...prev, isChecking: true, error: undefined }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        let closest = DEFAULT_COMPANY_LOCATIONS[0];
        let minDist = calculateDistance(userLat, userLng, closest.lat, closest.lng);

        for (const loc of DEFAULT_COMPANY_LOCATIONS) {
          const d = calculateDistance(userLat, userLng, loc.lat, loc.lng);
          if (d < minDist) {
            minDist = d;
            closest = loc;
          }
        }

        const isInside = minDist <= closest.radiusMeters;

        setGeoStatus({
          isChecking: false,
          isInside,
          distanceMeters: Math.round(minDist),
          closestLocationName: closest.name,
          allowedRadiusMeters: closest.radiusMeters,
          lat: userLat,
          lng: userLng,
        });
      },
      (err) => {
        console.warn('[AttendanceTab] Geolocation error:', err);
        setGeoStatus(prev => ({
          ...prev,
          isChecking: false,
          error: 'تکایە دەسەڵاتی لۆکەیشن (Location Permission) لە مۆبایلەکەت کارا بکە.',
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Initial Location Check
  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  // Audio Chime
  const playChime = useCallback((success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  }, []);

  // Perform Punch Check-In / Check-Out
  const handlePunch = async (punchType: 'check_in' | 'check_out') => {
    setPunching(punchType);

    // Get fresh position
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          const res = await fetch('/api/mobile/punch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId: user.employeeId,
              employeeName: user.employeeName,
              punchType,
              lat,
              lng,
              isManager: user.isFounder,
            }),
          });

          const data = await res.json();

          if (data.success) {
            playChime(true);
            onRefreshToday();

            setModalFeedback({
              show: true,
              type: 'success',
              title: punchType === 'check_in' ? '✅ هاتن تۆمارکرا' : '✅ دەرچوون تۆمارکرا',
              message: data.message || `دەوامەکەت لە کاتژمێر ${data.timeStr} بە سەرکەوتوویی تۆمارکرا.`,
            });

            // If check out and overtime detected:
            if (punchType === 'check_out' && data.hasOvertime && (data.overtimeMinutes || 0) > 0) {
              setOvertimeModal({
                show: true,
                overtimeMinutes: data.overtimeMinutes,
                selectedReason: 'کارکردنی شەوان لەعرض',
                customNote: '',
                saving: false,
              });
            }
          } else {
            playChime(false);
            if (data.reason === 'OUTSIDE_GEOFENCE') {
              setModalFeedback({
                show: true,
                type: 'outside',
                title: '⛔ تۆمار نەکرا (دەرەوەی سنوور)',
                message: data.message || 'تۆ لە دەرەوەی سنوری کۆمپانیایت! ڕێگری لە تۆمارکردن کرا و ئاگاداری درا بە بەڕێوەبەر.',
              });
            } else {
              setModalFeedback({
                show: true,
                type: 'error',
                title: '⚠️ کێشەیەک ڕوویدا',
                message: data.message || 'نەتوانرا دەوام تۆمار بکرێت.',
              });
            }
          }
        } catch (err: any) {
          playChime(false);
          setModalFeedback({
            show: true,
            type: 'error',
            title: 'هەڵەی پەیوەندی',
            message: 'کێشە لە پەیوەندی سێرڤەردا هەیە. تکایە پشکنینی خەتەکەت بکە.',
          });
        } finally {
          setPunching(null);
          refreshLocation();
        }
      },
      (geoErr) => {
        setPunching(null);
        playChime(false);
        setModalFeedback({
          show: true,
          type: 'error',
          title: 'لۆکەیشن وەرنەگیرا',
          message: 'تکایە دڵنیابەرەوە لە کارابوونی GPSی مۆبایلەکەت پێش داگرتنی دوگمەکە.',
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Submit Overtime Reason
  const handleSubmitOvertime = async () => {
    const finalReason = overtimeModal.customNote.trim() || overtimeModal.selectedReason;
    if (!finalReason) return;

    setOvertimeModal(prev => ({ ...prev, saving: true }));

    try {
      // Save to note endpoint or telegram overrides
      await fetch('/api/mobile/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.employeeId,
          employeeName: user.employeeName,
          punchType: 'check_out',
          reason: finalReason,
        }),
      });

      setOvertimeModal(prev => ({ ...prev, show: false, saving: false }));
      onRefreshToday();
    } catch (e) {
      setOvertimeModal(prev => ({ ...prev, saving: false, show: false }));
    }
  };

  const OVERTIME_PRESET_CHIPS = [
    'کارکردنی شەوان لەعرض',
    'شۆردنی سۆلار',
    'نقڵی دەرەوەی شار',
    'نقڵی ماڵان',
    'IT',
    'چاککردنەوە',
    'ڕێکخستنی کۆگا',
  ];

  return (
    <div className="space-y-4 pb-28">
      {/* Employee Greeting & Live Time */}
      <div className={`border rounded-3xl p-4 sm:p-5 transition-all shadow-xs ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 text-white' 
          : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50'
      }`}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg overflow-hidden border shrink-0 ${
              isDark 
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.employeeName} className="w-full h-full object-cover" />
              ) : (
                user.employeeName.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black">
                  {user.employeeName}
                </h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  isDark 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {user.role}
                </span>
              </div>
              <p className={`text-xs mt-0.5 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                کۆد: <span className="font-mono font-bold" dir="ltr">{user.employeeId}</span>
              </p>
            </div>
          </div>

          <div className="text-left font-mono shrink-0">
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white" dir="ltr">
              {clockStr || '00:00:00'}
            </div>
            <div className={`text-xs font-bold text-left ${isDark ? 'text-slate-400' : 'text-amber-600'}`}>
              کاتی هەولێر
            </div>
          </div>
        </div>

        {/* GPS Radar Strip */}
        <div className={`pt-3 border-t flex items-center justify-between text-xs ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className={`w-3 h-3 rounded-full block ${geoStatus.isInside ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`w-3 h-3 rounded-full block absolute inset-0 animate-ping opacity-75 ${geoStatus.isInside ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>

            {geoStatus.isChecking ? (
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>پشکنینی مەودای GPS...</span>
            ) : geoStatus.error ? (
              <span className="text-rose-600 text-xs font-bold">{geoStatus.error}</span>
            ) : geoStatus.isInside ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                لە ناو سنووریت: <b>{geoStatus.distanceMeters} مەتر</b> لە {geoStatus.closestLocationName}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-400 font-bold text-xs">
                دەرەوەی سنوور: <b>{geoStatus.distanceMeters} مەتر</b> لە {geoStatus.closestLocationName}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={refreshLocation}
            disabled={geoStatus.isChecking}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
            title="نوێکردنەوەی لۆکەیشن"
          >
            <RefreshCw className={`w-4 h-4 ${geoStatus.isChecking ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Punch Big Tactile Buttons */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Check In Button */}
        <button
          type="button"
          onClick={() => handlePunch('check_in')}
          disabled={Boolean(punching)}
          className="relative overflow-hidden group bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] text-white rounded-3xl h-28 sm:h-32 p-4 flex flex-col items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs">
            {punching === 'check_in' ? (
              <Loader2 className="w-7 h-7 animate-spin text-white" />
            ) : (
              <UserCheck className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="text-center">
            <span className="text-base font-black block leading-tight">تۆمارکردنی هاتن</span>
            <span className="text-xs text-emerald-100 font-medium">چێک ئینی دەوام</span>
          </div>
        </button>

        {/* Check Out Button */}
        <button
          type="button"
          onClick={() => handlePunch('check_out')}
          disabled={Boolean(punching)}
          className="relative overflow-hidden group bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:scale-[0.98] text-white rounded-3xl h-28 sm:h-32 p-4 flex flex-col items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all disabled:opacity-50 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xs">
            {punching === 'check_out' ? (
              <Loader2 className="w-7 h-7 animate-spin text-white" />
            ) : (
              <Clock className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="text-center">
            <span className="text-base font-black block leading-tight">تۆمارکردنی دەرچوون</span>
            <span className="text-xs text-rose-100 font-medium">چێک ئاوتی دەوام</span>
          </div>
        </button>
      </div>

      {/* Today Attendance Summary Card */}
      <div className={`border rounded-3xl p-4 sm:p-5 transition-all shadow-xs ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 text-white' 
          : 'bg-white border-slate-200/90 text-slate-900 shadow-slate-200/50'
      }`}>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h3 className="text-sm font-black">دۆخی دەوامی ئەمڕۆ</h3>
          </div>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {todayInfo?.date || dateStr}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2.5">
          <div className={`p-3.5 rounded-2xl border ${
            isDark 
              ? 'bg-slate-950/60 border-slate-800' 
              : 'bg-slate-50 border-slate-200/70'
          }`}>
            <span className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کاتی هاتن</span>
            <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 block" dir="ltr">
              {todayInfo?.checkInTime || 'تۆمار نەکراوە'}
            </span>
          </div>

          <div className={`p-3.5 rounded-2xl border ${
            isDark 
              ? 'bg-slate-950/60 border-slate-800' 
              : 'bg-slate-50 border-slate-200/70'
          }`}>
            <span className={`text-xs font-bold block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کاتی دەرچوون</span>
            <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 block" dir="ltr">
              {todayInfo?.checkOutTime || 'تۆمار نەکراوە'}
            </span>
          </div>
        </div>

        {todayInfo?.overtimeNote && (
          <div className={`p-3.5 rounded-2xl text-xs border ${
            isDark 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <span className="font-bold block mb-0.5">هۆکاری کاتی زیادە:</span>
            <span>{todayInfo.overtimeNote}</span>
          </div>
        )}
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigateTab('expenses')}
          className={`p-3.5 rounded-2xl text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
            isDark 
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-white' 
              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 shadow-xs'
          }`}
        >
          <span className="text-2xl">💸</span>
          <span className="text-xs font-bold">مەسروفات</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('leaves')}
          className={`p-3.5 rounded-2xl text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
            isDark 
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-white' 
              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 shadow-xs'
          }`}
        >
          <span className="text-2xl">🌴</span>
          <span className="text-xs font-bold">مۆڵەت</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('reports')}
          className={`p-3.5 rounded-2xl text-center flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
            isDark 
              ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-white' 
              : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 shadow-xs'
          }`}
        >
          <span className="text-2xl">📊</span>
          <span className="text-xs font-bold">ئاماری مانگ</span>
        </button>
      </div>

      {/* Feedback Modal (Outside Geofence / Success) */}
      {modalFeedback?.show && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center border animate-in fade-in zoom-in-95 duration-150 ${
            isDark 
              ? 'bg-slate-900 border-slate-800 text-white' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              modalFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                : modalFeedback.type === 'outside' 
                ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {modalFeedback.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> :
               modalFeedback.type === 'outside' ? <ShieldAlert className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
            </div>

            <h3 className="text-base font-black mb-2">
              {modalFeedback.title}
            </h3>
            <p className={`text-xs leading-relaxed mb-6 whitespace-pre-line ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`} dangerouslySetInnerHTML={{ __html: modalFeedback.message }} />

            <button
              type="button"
              onClick={() => setModalFeedback(null)}
              className={`w-full h-11 active:scale-95 font-bold rounded-xl text-xs transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              داخستن
            </button>
          </div>
        </div>
      )}

      {/* Overtime Reason Prompt Modal */}
      {overtimeModal.show && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
            isDark 
              ? 'bg-slate-900 border-slate-800 text-white' 
              : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="text-center mb-4">
              <span className="text-3xl mb-1 block">⏰</span>
              <h3 className="text-sm font-black mb-1">
                تۆمارکردنی هۆکاری کاتی زیادە
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                تۆ ئەمڕۆ <b>{overtimeModal.overtimeMinutes} خولەک</b> کاتی زیادەت هەیە. تکایە هۆکارەکەی دیاریبکە:
              </p>
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {OVERTIME_PRESET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setOvertimeModal(prev => ({ ...prev, selectedReason: chip, customNote: '' }))}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    overtimeModal.selectedReason === chip && !overtimeModal.customNote
                      ? 'bg-amber-500 text-slate-950 font-black border-amber-500 shadow-xs'
                      : isDark 
                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Custom Input */}
            <div className="mb-4">
              <input
                type="text"
                value={overtimeModal.customNote}
                onChange={(e) => setOvertimeModal(prev => ({ ...prev, customNote: e.target.value }))}
                placeholder="یان هۆکارێکی تر بە دەست بنووسە..."
                className={`w-full h-10 rounded-xl px-3 text-xs outline-none border transition-colors ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-400' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-500'
                }`}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSubmitOvertime}
                disabled={overtimeModal.saving}
                className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {overtimeModal.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>تۆمارکردنی هۆکار</span>}
              </button>
              <button
                type="button"
                onClick={() => setOvertimeModal(prev => ({ ...prev, show: false }))}
                className={`px-4 h-11 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                دواتر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
