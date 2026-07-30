'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, LogOut, Calendar, UserCheck, Clock, ShieldAlert } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn: string;
  checkInTime: string;
  checkInSelfie: string;
  checkOut: string;
  checkOutTime: string;
  checkOutSelfie: string;
  warehouseName: string;
  lateMinutes: number;
  earlyOutMinutes: number;
  overtimeMinutes: number;
  status: string;
  checkInAddress?: string;
  checkOutAddress?: string;
}

export default function AttendancePortal() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ present: 0, late: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [selectedAbsentDate, setSelectedAbsentDate] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedId = localStorage.getItem('user_id');
    const storedName = localStorage.getItem('user_name');
    const storedToken = localStorage.getItem('device_token');

    if (!storedId || !storedToken) {
      router.replace('/attendance/checkin');
    } else {
      setUserId(storedId);
      setUserName(storedName);
      setDeviceToken(storedToken);
    }
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/attendance/employee/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
        }
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (records.length === 0 && !loading) {
      setStats({ present: 0, late: 0, absent: 0 });
      return;
    }

    const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthlyLogs = records.filter(r => r.date.startsWith(currentMonthStr));
    
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    monthlyLogs.forEach(log => {
      if (log.status === 'Present' || log.status === 'Early Out') {
        presentCount++;
      } else if (log.status.includes('Late')) {
        lateCount++;
      }
    });

    // Calculate absent days (in the past, excluding Fridays)
    const today = new Date();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const endDay = (currentYear === today.getFullYear() && currentMonth === today.getMonth()) ? today.getDate() - 1 : daysInMonth;

    for (let d = 1; d <= endDay; d++) {
      const checkDate = new Date(currentYear, currentMonth, d);
      if (checkDate.getDay() === 5) continue; // Skip Fridays
      
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const attended = records.some(r => r.date === dateStr);
      if (!attended) {
        absentCount++;
      }
    }

    setStats({ present: presentCount, late: lateCount, absent: absentCount });
  }, [records, currentMonth, currentYear, loading]);

  if (!mounted || !userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-400 animate-pulse">پشکنینی پێناسی ئامێر...</p>
      </div>
    );
  }

  const handleDisconnect = () => {
    if (confirm('ئایا دڵنیایت لە جیاکردنەوەی مۆبایلەکەت؟ بۆ بەستنەوەی دووبارە دەبێت پین کۆد بنووسیت.')) {
      localStorage.clear();
      router.replace('/attendance/checkin');
    }
  };

  const changeMonth = (direction: number) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  // Calendar rendering helper
  const monthNames = [
    "کانوونی دووەم (January)", "شوبات (February)", "ئازار (March)", "نیسان (April)", 
    "مایس (May)", "حوزەیران (June)", "تەممووز (July)", "ئاب (August)", 
    "ئەیلوول (September)", "تشرینی یەکەم (October)", "تشرینی دووەم (November)", "کانوونی یەکەم (December)"
  ];

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  // Saturday offset adjustment
  let offset = firstDayIndex + 1;
  if (offset === 7) offset = 0;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = [];

  // Empty slots
  for (let i = 0; i < offset; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square bg-transparent border-none" />);
  }

  // Days in month
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const checkDate = new Date(currentYear, currentMonth, day);
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = records.find(r => r.date === dateStr);
    const isFriday = checkDate.getDay() === 5;
    const isPast = checkDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

    let dayClass = "border border-white/60 bg-white/40 hover:bg-white/80 transition-all cursor-pointer relative flex flex-col justify-between p-2 rounded-xl aspect-square shadow-sm";
    let statusDot = null;
    let labelText = "";

    if (isFriday) {
      dayClass = "border border-slate-100 bg-slate-50/50 opacity-40 relative flex flex-col justify-between p-2 rounded-xl aspect-square pointer-events-none";
      labelText = "هەینی";
    } else if (record) {
      if (record.status.includes('Late')) {
        dayClass += " border-amber-300 bg-amber-50/20";
        statusDot = <span className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />;
      } else {
        dayClass += " border-emerald-300 bg-emerald-50/20";
        statusDot = <span className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />;
      }
    } else if (isPast) {
      dayClass += " border-rose-300 bg-rose-50/10";
      statusDot = <span className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-rose-500" />;
    }

    if (isToday) {
      dayClass += " ring-2 ring-primary border-primary/40 shadow-md scale-105";
    }

    calendarDays.push(
      <div 
        key={day} 
        className={dayClass}
        onClick={() => {
          if (isFriday) return;
          if (record) {
            setSelectedRecord(record);
          } else if (isPast) {
            setSelectedAbsentDate(dateStr);
          }
        }}
      >
        <span className="text-xs font-black text-slate-700">{day}</span>
        {labelText && <span className="text-[9px] font-bold text-slate-400 self-center">{labelText}</span>}
        {statusDot}
      </div>
    );
  }

  const weekdays = ["شەممە", "یەکشەممە", "دووشەممە", "سێشەممە", "چوارشەممە", "پێنجشەممە", "هەینی"];

  return (
    <div className="w-full max-w-[800px] mx-auto space-y-6 pb-24 text-right" dir="rtl">
      
      {/* Header Info Panel */}
      <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden transition-all duration-300">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تۆماری ئامادەبوونی فەرمی</p>
              <h2 className="text-lg font-black text-slate-800">{userName}</h2>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleDisconnect} 
            className="flex items-center gap-2 border-rose-200/50 bg-rose-50/10 text-rose-600 hover:bg-rose-50/30 text-xs font-bold rounded-xl cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>جیاکردنەوەی مۆبایل</span>
          </Button>
        </CardContent>
      </Card>

      {/* Monthly Summary Statistics */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-md rounded-2xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ئامادەبوو</span>
            <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">{stats.present}</p>
          </CardContent>
        </Card>
        
        <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-md rounded-2xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">دواکەوتوو</span>
            <p className="text-xl md:text-2xl font-black text-amber-500 mt-1">{stats.late}</p>
          </CardContent>
        </Card>
        
        <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-md rounded-2xl">
          <CardContent className="p-4 text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">غیابات</span>
            <p className="text-xl md:text-2xl font-black text-rose-500 mt-1">{stats.absent}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar log view card */}
      <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span>ڕۆژژمێری فەرمی کارمەند</span>
          </CardTitle>
          <div className="flex items-center gap-2" dir="ltr">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-8 w-8 hover:bg-white/50 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-black text-slate-700 min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-8 w-8 hover:bg-white/50 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center">
            {weekdays.map(day => (
              <span key={day} className="text-[10px] font-black text-slate-400 uppercase">{day}</span>
            ))}
          </div>
          
          {loading ? (
            <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">
              بارکردنی تۆمارەکانی دەوام...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {calendarDays}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today Checkin Shortcut */}
      <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-700">تۆمارکردنی هاتن و ڕۆشتن</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">بە سکانکردنی کۆدی سەر شاشەی کۆگا دەوامەکەت تۆمار بکە.</p>
            </div>
          </div>
          <Button onClick={() => router.push('/attendance/checkin')} className="bg-primary hover:bg-primary/95 text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer">
            📍 سکانکردن و تۆمارکردن
          </Button>
        </CardContent>
      </Card>

      {/* Dialog Modal: Log Details */}
      <Dialog open={selectedRecord !== null} onOpenChange={(open) => { if(!open) setSelectedRecord(null); }}>
        <DialogContent className="border border-white/60 bg-white/75 backdrop-blur-2xl p-6 shadow-2xl rounded-2xl text-right">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-slate-700 text-right">وردەکاری ڕۆژی {selectedRecord?.date}</DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4 text-xs font-semibold text-slate-600 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-100/50 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">📥 دەستبەکاربوون (In)</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedRecord.checkInTime || '-'}</p>
                  {selectedRecord.checkInSelfie && (
                    <img 
                      src={selectedRecord.checkInSelfie} 
                      alt="Selfie Check-In" 
                      className="mt-2 w-full h-28 object-cover rounded-lg border border-white/60"
                    />
                  )}
                  {selectedRecord.checkInAddress && (
                    <p className="text-[9px] text-slate-400 mt-2 font-bold leading-tight">📍 {selectedRecord.checkInAddress}</p>
                  )}
                </div>

                <div className="p-3 bg-slate-100/50 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">📤 ڕۆشتن (Out)</span>
                  <p className="font-bold text-slate-800 text-sm">{selectedRecord.checkOutTime || '-'}</p>
                  {selectedRecord.checkOutSelfie && (
                    <img 
                      src={selectedRecord.checkOutSelfie} 
                      alt="Selfie Check-Out" 
                      className="mt-2 w-full h-28 object-cover rounded-lg border border-white/60"
                    />
                  )}
                  {selectedRecord.checkOutAddress && (
                    <p className="text-[9px] text-slate-400 mt-2 font-bold leading-tight">📍 {selectedRecord.checkOutAddress}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200/50 pt-3 space-y-1.5">
                <p>📍 <b>کۆگای چالاک:</b> {selectedRecord.warehouseName}</p>
                <p>⏳ <b>دواکەوتن:</b> {selectedRecord.lateMinutes > 0 ? <span className="text-rose-500 font-bold">{selectedRecord.lateMinutes} خولەک</span> : <span className="text-emerald-600 font-bold">بێ دواکەوتن</span>}</p>
                {selectedRecord.earlyOutMinutes > 0 && <p>⏳ <b>ڕۆشتنی پێشوەختە:</b> <span className="text-rose-500 font-bold">{selectedRecord.earlyOutMinutes} خولەک</span></p>}
                {selectedRecord.overtimeMinutes > 0 && <p>➕ <b>ئیزافە (Overtime):</b> <span className="text-primary font-bold">{selectedRecord.overtimeMinutes} خولەک</span></p>}
                <p className="pt-1">
                  <b>حاڵەت:</b>{' '}
                  <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                    selectedRecord.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                    selectedRecord.status.includes('Late') ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {selectedRecord.status === 'Present' ? 'حازر' :
                     selectedRecord.status === 'Late' ? 'دواکەوتوو' :
                     selectedRecord.status === 'Early Out' ? 'ڕۆشتنی پێشوەختە' : selectedRecord.status}
                  </span>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Modal: Absent Details */}
      <Dialog open={selectedAbsentDate !== null} onOpenChange={(open) => { if(!open) setSelectedAbsentDate(null); }}>
        <DialogContent className="border border-white/60 bg-white/75 backdrop-blur-2xl p-6 shadow-2xl rounded-2xl text-right max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-rose-600 text-right flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>نەهاتووە (غیاب)</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 text-xs font-semibold text-slate-600 mt-2 leading-relaxed">
            <p>تۆماری ئامادەبوون نییە بۆ ڕۆژی <b>{selectedAbsentDate}</b>.</p>
            <p className="text-[10px] text-slate-400">ئەم ڕۆژە بەسەرچووە و کارمەند بە نەهاتوو حیساب کراوە لە خشتەی کۆتایی مانگدا.</p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
