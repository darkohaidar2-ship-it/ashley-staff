'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Zap, Clock, ShieldCheck, MapPin, 
  Trash2, UserMinus, Plus, Edit2, Calendar, 
  Download, RefreshCw, Eye, CheckCircle2, 
  XCircle, FileSpreadsheet, Lock, AlertTriangle,
  ChevronLeft, ChevronRight, BarChart3, Compass,
  Palmtree, Sun, UserCheck, AlertCircle, Check,
  Move, Layers, Sparkles
} from 'lucide-react';
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, getDaysInMonth, startOfMonth, addMonths, subMonths, getDay } from 'date-fns';

interface User {
  id: string;
  name: string;
  pin: string;
  role: string;
  hourlyRate: number;
  deviceToken?: string | null;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn?: string;
  checkInTime?: string;
  checkInSelfie?: string;
  checkInAddress?: string;
  checkOut?: string;
  checkOutTime?: string;
  checkOutSelfie?: string;
  checkOutAddress?: string;
  warehouseId?: string;
  warehouseName: string;
  lateMinutes: number;
  earlyOutMinutes: number;
  overtimeMinutes: number;
  status: string;
}

interface Warehouse {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  qr_code?: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
}

export default function AdminAttendancePage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Security Gate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('admin_authenticated');
      if (isAuth !== 'true') {
        window.location.href = '/adminpanel';
        return;
      }
      setAuthChecked(true);
    }
  }, []);

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [defaultShift, setDefaultShift] = useState({ checkInTime: '08:30', checkOutTime: '16:30' });
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, { checkInTime: string; checkOutTime: string }>>({});

  // 31-Day Calendar Date State
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedDayDetail, setSelectedDayDetail] = useState<{ date: string; user?: User; records: AttendanceRecord[] } | null>(null);

  // Status Quick Palette for 31-Day Drag/Click
  const [selectedPaletteStatus, setSelectedPaletteStatus] = useState<string>('Present');
  const [draggedStatus, setDraggedStatus] = useState<string | null>(null);

  // Filter States
  const [filterDate, setFilterDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');

  // Dialog Modals State
  const [selectedSelfie, setSelectedSelfie] = useState<string | null>(null);
  
  // Form States for CRUD
  const [newWhName, setNewWhName] = useState('');
  const [newWhLat, setNewWhLat] = useState('');
  const [newWhLng, setNewWhLng] = useState('');
  const [newWhRadius, setNewWhRadius] = useState('100');

  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPin, setNewEmpPin] = useState('');
  const [newEmpRate, setNewEmpRate] = useState('0');

  const [overrideDate, setOverrideDate] = useState('');
  const [overrideCheckIn, setOverrideCheckIn] = useState('08:30');
  const [overrideCheckOut, setOverrideCheckOut] = useState('16:30');

  const loadReport = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/attendance/admin/report?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setAttendance(data.attendance || []);
        setWarehouses(data.warehouses || []);
        setHolidays(data.holidays || []);
        if (data.shifts) {
          setDefaultShift(data.shifts.default || { checkInTime: '08:30', checkOutTime: '16:30' });
          setShiftOverrides(data.shifts.overrides || {});
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadReport();

    // ⚡ Real-Time Auto-Polling every 3 seconds
    const interval = setInterval(() => {
      loadReport(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [loadReport]);

  // Generate 31 Days Array for the selected month
  const monthDays = useMemo(() => {
    const daysCount = getDaysInMonth(selectedMonth);
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth() + 1;
    const monthStr = month < 10 ? `0${month}` : `${month}`;

    const days = [];
    for (let i = 1; i <= daysCount; i++) {
      const dayStr = i < 10 ? `0${i}` : `${i}`;
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const dateObj = new Date(year, month - 1, i);
      const dayOfWeek = getDay(dateObj); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const isFriday = dayOfWeek === 5;

      days.push({
        dayNum: i,
        dateStr,
        isFriday,
        dayOfWeek
      });
    }
    return days;
  }, [selectedMonth]);

  // 31-Day Attendance Lookup Map: Map<empId_dateStr, AttendanceRecord>
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach(rec => {
      map.set(`${rec.userId}_${rec.date}`, rec);
    });
    return map;
  }, [attendance]);

  // Set manual cell status (Click or Drag and Drop)
  const handleCellStatusChange = async (userId: string, userName: string, dateStr: string, status: string) => {
    try {
      // Optimistic update
      setAttendance(prev => {
        const key = `${userId}_${dateStr}`;
        const exists = prev.find(r => r.userId === userId && r.date === dateStr);
        if (exists) {
          return prev.map(r => r.userId === userId && r.date === dateStr ? { ...r, status } : r);
        } else {
          return [...prev, {
            id: `manual-${key}`,
            userId,
            userName,
            date: dateStr,
            warehouseName: 'کۆمپانیای سەرەکی ئاشڵی',
            status,
            lateMinutes: 0,
            earlyOutMinutes: 0,
            overtimeMinutes: 0,
          }];
        }
      });

      await fetch('/api/attendance/admin/manual-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, date: dateStr, status })
      });
      loadReport(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (!mounted || !authChecked) return null;

  // Filtered Attendance for Logs Tab
  const filteredAttendance = attendance.filter((r) => {
    const matchesDate = !filterDate || r.date === filterDate;
    const matchesEmployee = !filterEmployee || r.userId === filterEmployee;
    const matchesWarehouse = !filterWarehouse || r.warehouseName.includes(filterWarehouse);
    return matchesDate && matchesEmployee && matchesWarehouse;
  });

  // Handlers
  const handleResetDevice = async (userId: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی مۆبایلی ئەم کارمەندە؟ دەتوانێت دووبارە مۆبایلەکەی پەیوەست بکاتەوە.')) return;
    try {
      const res = await fetch('/api/attendance/admin/users/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        alert('پێناسەی مۆبایل سڕایەوە!');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmpId || !newEmpName || !newEmpPin) {
      alert('تکایە هەموو خانەکان پڕ بکەرەوە.');
      return;
    }
    try {
      const res = await fetch('/api/attendance/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newEmpId, name: newEmpName, pin: newEmpPin, hourlyRate: newEmpRate })
      });
      if (res.ok) {
        alert('کارمەندی نوێ زیادکرا!');
        setNewEmpId('');
        setNewEmpName('');
        setNewEmpPin('');
        setNewEmpRate('0');
        loadReport();
      } else {
        const err = await res.json();
        alert(err.error || 'هەڵە ڕوویدا');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم بەکارهێنەرە بە تەواوی؟')) return;
    try {
      const res = await fetch(`/api/attendance/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        alert('بەکارهێنەرەکە سڕایەوە!');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWarehouse = async () => {
    if (!newWhName || !newWhLat || !newWhLng) {
      alert('تکایە خانەکانی کۆگا پڕ بکەرەوە.');
      return;
    }
    try {
      const res = await fetch('/api/attendance/admin/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWhName, lat: newWhLat, lng: newWhLng, radius: newWhRadius })
      });
      if (res.ok) {
        alert('کۆگای نوێ زیادکرا!');
        setNewWhName('');
        setNewWhLat('');
        setNewWhLng('');
        setNewWhRadius('100');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!confirm('ئایا دڵنیایت لە سڕینەوەی ئەم کۆگایە؟')) return;
    try {
      const res = await fetch(`/api/attendance/admin/warehouses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('کۆگاکە سڕایەوە!');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDefaultShift = async () => {
    try {
      const res = await fetch('/api/attendance/admin/shifts/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultShift)
      });
      if (res.ok) alert('ڕێکخستنی دەوامی گشتی پاشەکەوت کرا!');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddShiftOverride = async () => {
    if (!overrideDate) return;
    try {
      const res = await fetch('/api/attendance/admin/shifts/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: overrideDate, checkInTime: overrideCheckIn, checkOutTime: overrideCheckOut })
      });
      if (res.ok) {
        alert('دەوامی تایبەتی ڕۆژەکە تۆمارکرا!');
        setOverrideDate('');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveOverride = async (date: string) => {
    try {
      const res = await fetch('/api/attendance/admin/shifts/remove-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      if (res.ok) {
        alert('دەوامی ڕۆژەکە گەڕایەوە سەر حاڵەتی ئاسایی!');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayName || !newHolidayDate) return;
    try {
      const res = await fetch('/api/attendance/admin/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHolidayName, date: newHolidayDate })
      });
      if (res.ok) {
        alert('پشووی فەرمی زیادکرا!');
        setNewHolidayName('');
        setNewHolidayDate('');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res = await fetch(`/api/attendance/admin/holidays/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('پشووی فەرمی سڕایەوە!');
        loadReport();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = () => {
    const headers = 'کۆد,ناو,بەروار,هاتن,ڕۆشتن,کۆگا,دواکەوتن (خولەک),ئیزافە (خولەک),حاڵەت\n';
    const rows = filteredAttendance.map(r => 
      `"${r.userId}","${r.userName}","${r.date}","${r.checkInTime || '-'}","${r.checkOutTime || '-'}","${r.warehouseName}","${r.lateMinutes}","${r.overtimeMinutes}","${r.status}"`
    ).join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 w-full pb-20 text-right font-sans" dir="rtl">
      
      {/* 🪟 Windows 11 Sharp Header Title Bar */}
      <div className="bg-slate-900 text-white p-4 border border-slate-700 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black tracking-wide text-white">بەڕێوەبردنی ئامادەبوونی کارمەندان (Ashley Staff Matrix)</h2>
            <span className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/80 text-emerald-400 text-[10px] font-black px-2 py-0.5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-400" />
              <span>ڕاستەوخۆ (Real-Time 3s)</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">خشتەی ٣١ ڕۆژەی مۆڵەت و غیابات بە Drag & Drop و چاودێری ٢٤ کاتژمێری GPS</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => loadReport()} 
            disabled={loading} 
            className="rounded-none border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 h-8 cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>نوێکردنەوە</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        {/* 🪟 Windows 11 Sharp Top Tabs */}
        <TabsList className="bg-slate-100 p-0 border border-slate-300 text-slate-600 w-full shadow-xs mb-4 flex flex-wrap gap-0 h-auto rounded-none justify-start">
          <TabsTrigger value="matrix" className="rounded-none px-5 py-2.5 text-xs font-black border-l border-slate-300 tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            🗓️ خشتەی ٣١ ڕۆژەی وردەکاری (Drag & Drop)
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-none px-5 py-2.5 text-xs font-black border-l border-slate-300 tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            📋 لیستی لۆگەکان
          </TabsTrigger>
          <TabsTrigger value="employees" className="rounded-none px-5 py-2.5 text-xs font-black border-l border-slate-300 tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            👥 پێناسەی کارمەندان
          </TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-none px-5 py-2.5 text-xs font-black border-l border-slate-300 tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            🏢 ڕێکخستنی کۆگاکان
          </TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-none px-5 py-2.5 text-xs font-black border-l border-slate-300 tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            ⏰ کاتەکانی دەوام
          </TabsTrigger>
          <TabsTrigger value="holidays" className="rounded-none px-5 py-2.5 text-xs font-black tracking-wide data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-b-blue-600 data-[state=active]:shadow-xs">
            📅 پشووەکان
          </TabsTrigger>
        </TabsList>

        {/* TABS CONTENT 1: 31-DAY DETAILED MATRIX WITH SHARP DRAG & DROP */}
        <TabsContent value="matrix" className="space-y-3">
          <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300 flex flex-col md:flex-row items-center justify-between gap-3">
              
              {/* Month Navigation */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                  className="w-7 h-7 rounded-none border-slate-400 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                
                <div className="text-center px-3 py-1 bg-white border border-slate-300 min-w-[170px]">
                  <h3 className="font-black text-xs text-slate-900 font-mono">
                    {format(selectedMonth, 'yyyy MMMM')} (مانگی {format(selectedMonth, 'M')})
                  </h3>
                </div>

                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                  className="w-7 h-7 rounded-none border-slate-400 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>

              {/* Status Drag & Drop Quick Palette */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Move className="w-3.5 h-3.5 text-blue-600" />
                  <span>پالێتی Drag & Drop (ڕایبکێشە یان کلیک بکە):</span>
                </span>
                {[
                  { key: 'Present', label: '🟢 ئامادەبوو', bg: 'bg-emerald-600 text-white border-emerald-700' },
                  { key: 'Leave', label: '🟡 مۆڵەت', bg: 'bg-amber-400 text-amber-950 border-amber-500' },
                  { key: 'Absent', label: '🔴 غیاب', bg: 'bg-rose-600 text-white border-rose-700' },
                  { key: 'Holiday', label: '🌴 پشوو', bg: 'bg-teal-600 text-white border-teal-700' }
                ].map(p => (
                  <div
                    key={p.key}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', p.key);
                      setDraggedStatus(p.key);
                    }}
                    onDragEnd={() => setDraggedStatus(null)}
                    onClick={() => setSelectedPaletteStatus(p.key)}
                    className={`px-3 py-1 rounded-none text-[10px] font-black border transition-all cursor-grab active:cursor-grabbing select-none flex items-center gap-1 shadow-2xs ${p.bg} ${
                      selectedPaletteStatus === p.key ? 'ring-2 ring-blue-600 scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <span>{p.label}</span>
                  </div>
                ))}
              </div>

            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto border-t border-slate-300 bg-white">
                <table className="w-full text-xs font-semibold text-slate-800 text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-2.5 text-[11px] font-black text-slate-800 sticky right-0 bg-slate-100 z-10 min-w-[150px] text-right border-l border-slate-300">
                        کارمەند
                      </th>
                      {monthDays.map(d => (
                        <th 
                          key={d.dateStr} 
                          className={`p-1.5 text-[10px] font-black border-l border-slate-300 min-w-[40px] ${
                            d.isFriday ? 'bg-emerald-100 text-emerald-950 font-black' : 'text-slate-700'
                          }`}
                        >
                          <div>{d.dayNum}</div>
                          <div className="text-[8px] font-bold">{d.isFriday ? '🌴 هەینی' : ''}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.filter(u => u.role !== 'admin').map(user => (
                      <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-2 font-bold text-slate-900 sticky right-0 bg-white z-10 text-right border-l border-slate-300 shadow-xs">
                          <div className="text-xs font-black">{user.name}</div>
                          <div className="text-[9px] font-mono text-slate-400">{user.id}</div>
                        </td>
                        {monthDays.map(d => {
                          const rec = attendanceMap.get(`${user.id}_${d.dateStr}`);
                          const status = rec?.status;
                          const isFriday = d.isFriday;

                          let badgeColor = 'bg-slate-50 text-slate-400 border-slate-200';
                          let badgeText = '-';

                          if (status === 'Present' || rec?.checkInTime) {
                            badgeColor = 'bg-emerald-600 text-white border-emerald-700 font-black';
                            badgeText = rec?.checkInTime || 'ئامادە';
                          } else if (status === 'Leave' || status === 'مۆڵەت') {
                            badgeColor = 'bg-amber-400 text-amber-950 border-amber-500 font-black';
                            badgeText = 'مۆڵەت';
                          } else if (status === 'Absent' || status === 'غیاب') {
                            badgeColor = 'bg-rose-600 text-white border-rose-700 font-black';
                            badgeText = 'غیاب';
                          } else if (status === 'Holiday' || isFriday) {
                            badgeColor = 'bg-teal-100 text-teal-900 border-teal-300 font-black';
                            badgeText = '🌴';
                          }

                          return (
                            <td 
                              key={d.dateStr}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'copy';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const dropped = e.dataTransfer.getData('text/plain') || draggedStatus;
                                if (dropped) {
                                  handleCellStatusChange(user.id, user.name, d.dateStr, dropped);
                                }
                              }}
                              onClick={() => handleCellStatusChange(user.id, user.name, d.dateStr, selectedPaletteStatus)}
                              onDoubleClick={() => setSelectedDayDetail({ date: d.dateStr, user, records: rec ? [rec] : [] })}
                              title={`Drag & Drop بکە بۆ ئێرە یان کلیک بکە بۆ ${selectedPaletteStatus} (دبل کلیک بۆ گرافی ٢٤ کاتژمێری)`}
                              className={`p-1 border-l border-slate-200 cursor-pointer hover:bg-amber-100/60 transition-all ${
                                isFriday ? 'bg-emerald-50/50' : ''
                              }`}
                            >
                              <div className={`w-full py-1 rounded-none text-[9px] border shadow-2xs transition-all ${badgeColor}`}>
                                {badgeText}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TABS CONTENT 2: ATTENDANCE LOGS */}
        <TabsContent value="logs">
          <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300 flex flex-col md:flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">لیستی گشتی هاتن و ڕۆشتنی ستاف</CardTitle>
                <CardDescription className="text-[10px] text-slate-400 mt-0.5">پیشاندانی سەرجەم لۆگە تۆمارکراوەکان لەگەڵ توانای فلتەرکردن و وەرگرتنی ڕاپۆرت.</CardDescription>
              </div>
              <Button onClick={handleExportCSV} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>داگرتنی Excel</span>
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              
              {/* 📊 TOP ATTENDANCE KPI STATS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="p-3 bg-white rounded-none border border-slate-300 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-500">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>ئامادەبووانی ئەمڕۆ</span>
                  </div>
                  <div className="text-lg font-black font-mono text-slate-900">
                    {filteredAttendance.filter(r => r.status === 'Present').length} / {users.filter(u => u.role !== 'admin').length}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-none border border-slate-300 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کۆی کاژێری دەوامی تۆمارکراو</span>
                  </div>
                  <div className="text-lg font-black font-mono text-emerald-700">
                    {Math.round(filteredAttendance.reduce((acc, curr) => {
                      if (!curr.checkInTime) return acc;
                      const [inH, inM] = curr.checkInTime.split(':').map(Number);
                      const [outH, outM] = (curr.checkOutTime || '16:30').split(':').map(Number);
                      const diff = Math.max(0, ((outH * 60 + outM) - (inH * 60 + inM)) / 60);
                      return acc + diff;
                    }, 0))} کاژێر
                  </div>
                </div>

                <div className="p-3 bg-white rounded-none border border-slate-300 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-500">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>کۆی ئیزافە (Overtime)</span>
                  </div>
                  <div className="text-lg font-black font-mono text-amber-700">
                    {filteredAttendance.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)} خولەک
                  </div>
                </div>

                <div className="p-3 bg-white rounded-none border border-slate-300 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-rose-600" />
                    <span>کۆی دواکەوتن</span>
                  </div>
                  <div className="text-lg font-black font-mono text-rose-700">
                    {filteredAttendance.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0)} خولەک
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-300">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600">بەروار:</label>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600">کارمەند:</label>
                  <select 
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none outline-none"
                  >
                    <option value="">هەموو کارمەندەکان</option>
                    {users.filter(u => u.role !== 'admin').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600">کۆگا:</label>
                  <select 
                    value={filterWarehouse}
                    onChange={(e) => setFilterWarehouse(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-1.5 rounded-none outline-none"
                  >
                    <option value="">هەموو کۆگاکان</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Logs Table */}
              {loading ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">بارکردنی لۆگەکان...</div>
              ) : filteredAttendance.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">هیچ لۆگێکی ئامادەبوون نەدۆزرایەوە بۆ ئەم فلتەرە.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-300 bg-white">
                  <table className="w-full text-xs font-semibold text-slate-700 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ناو</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">بەروار</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">کاتی هاتن (In)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">کاتی ڕۆشتن (Out)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">کۆگا</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">دواکەوتن</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ئیزافە</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">حاڵەت</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600 text-left">وردەکاری ٢٤ کاتژمێری</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredAttendance.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">{row.userName}</td>
                          <td className="p-2.5 num-font">{row.date}</td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <span className="num-font font-bold">{row.checkInTime || '-'}</span>
                              {row.checkInSelfie && (
                                <button onClick={() => setSelectedSelfie(row.checkInSelfie!)} className="text-[10px] text-blue-600 hover:underline font-bold">🖼️ وێنە</button>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <span className="num-font font-bold">{row.checkOutTime || '-'}</span>
                              {row.checkOutSelfie && (
                                <button onClick={() => setSelectedSelfie(row.checkOutSelfie!)} className="text-[10px] text-blue-600 hover:underline font-bold">🖼️ وێنە</button>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-bold">{row.warehouseName}</td>
                          <td className="p-2.5 num-font text-rose-600 font-bold">{row.lateMinutes > 0 ? `${row.lateMinutes} خولەک` : '0'}</td>
                          <td className="p-2.5 num-font text-emerald-600 font-bold">{row.overtimeMinutes > 0 ? `${row.overtimeMinutes} خولەک` : '0'}</td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-none font-black text-[9px] border ${
                              row.status === 'Present' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              row.status.includes('Late') ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              {row.status === 'Present' ? 'ئاسایی' :
                               row.status === 'Late' ? 'دواکەوتوو' :
                               row.status === 'Early Out' ? 'ڕۆشتنی پێشوەختە' : row.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-left">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedDayDetail({ date: row.date, user: users.find(u => u.id === row.userId), records: [row] })}
                              className="rounded-none text-[10px] font-bold h-7 px-2 border-slate-300"
                            >
                              🔍 بینینی چالاکی
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TABS CONTENT 3: EMPLOYEES */}
        <TabsContent value="employees">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden h-max">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">➕ زیادکردنی کارمەندی تۆمارکەر</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">کۆدی ناسنامە (ID):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: dana" 
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">ناوی تەواو (کوردی):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: دانا علی" 
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">پین کۆد (PIN):</label>
                  <input 
                    type="text" 
                    placeholder="کۆدی 4 ژمارەیی" 
                    value={newEmpPin}
                    onChange={(e) => setNewEmpPin(e.target.value.replace(/\D/g, ''))}
                    maxLength={4}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">نرخی کاژێر (Hourly Rate - IQD):</label>
                  <input 
                    type="number" 
                    placeholder="نرخ بە پارە" 
                    value={newEmpRate}
                    onChange={(e) => setNewEmpRate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center"
                  />
                </div>

                <Button onClick={handleAddEmployee} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-none mt-2 cursor-pointer">
                  تۆمارکردن لە سیستەم
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden lg:col-span-2">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">👥 لیستی ستاف و پێناسی ئامێرەکان</CardTitle>
                <span className="bg-slate-200 border border-slate-300 text-slate-800 py-0.5 px-2 rounded-none text-[9px] font-black tracking-wide">کۆی گشتی: {users.length}</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-slate-300 bg-white">
                  <table className="w-full text-xs font-semibold text-slate-700 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="p-2.5 text-[10px] font-black text-slate-600">کۆد (ID)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ناو</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">پین کۆد</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ئامێر (Device Status)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600 text-left">کردارەکان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-mono font-bold text-slate-900">{u.id}</td>
                          <td className="p-2.5 font-bold text-slate-900">{u.name}</td>
                          <td className="p-2.5 num-font tracking-widest">{u.pin}</td>
                          <td className="p-2.5">
                            {u.deviceToken ? (
                              <span className="px-2 py-0.5 rounded-none font-bold text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-max">
                                📲 بەستراوەتەوە
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-none font-bold text-[9px] bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1 w-max">
                                💤 بەتاڵ
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-left space-x-1" dir="ltr">
                            {u.id !== 'admin' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteUser(u.id)}
                                className="h-7 w-7 rounded-none text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {u.deviceToken && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleResetDevice(u.id)}
                                title="سڕینەوەی ئامێر"
                                className="h-7 w-7 rounded-none text-amber-600 hover:bg-amber-50 cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TABS CONTENT 4: WAREHOUSES */}
        <TabsContent value="warehouses">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden h-max">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">🏢 زیادکردنی کۆگای نوێ</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">ناوی کۆگا:</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: کۆگای سەرەکی سلێمانی" 
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">هێڵی پانی جوگرافی (Latitude):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: 35.5089" 
                    value={newWhLat}
                    onChange={(e) => setNewWhLat(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">هێڵی درێژی جوگرافی (Longitude):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: 45.4529" 
                    value={newWhLng}
                    onChange={(e) => setNewWhLng(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">مەودای ڕێگەپێدراو بە مەتر (Radius):</label>
                  <input 
                    type="number" 
                    value={newWhRadius}
                    onChange={(e) => setNewWhRadius(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center"
                  />
                </div>

                <Button onClick={handleAddWarehouse} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-none mt-2 cursor-pointer">
                  تۆمارکردنی کۆگا
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden lg:col-span-2">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">🏢 کۆگاکان و مەودای ڕێگەپێدراوی جوگرافی (Geofences)</CardTitle>
                <span className="bg-slate-200 border border-slate-300 text-slate-800 py-0.5 px-2 rounded-none text-[9px] font-black tracking-wide">کۆی گشتی: {warehouses.length}</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-slate-300 bg-white">
                  <table className="w-full text-xs font-semibold text-slate-700 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ناوی کۆگا</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">لۆکەیشن (Lat, Lng)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">مەودا (Radius)</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {warehouses.map(w => (
                        <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">{w.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</td>
                          <td className="p-2.5 num-font font-bold text-blue-700">{w.radius} مەتر</td>
                          <td className="p-2.5 text-left">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteWarehouse(w.id)}
                              className="h-7 w-7 rounded-none text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TABS CONTENT 5: SHIFTS */}
        <TabsContent value="shifts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">⏰ کاتی دەوامی فەرمی گشتی</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">کاتی دەستپێکی دەوام:</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkInTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkInTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">کاتی کۆتایی دەوام:</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkOutTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkOutTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveDefaultShift} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-none cursor-pointer">
                  پاشەکەوتکردنی کاتی دەوامی گشتی
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">🌟 دیاریکردنی دەوامی تایبەت بۆ ڕۆژێک</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">بەروار:</label>
                  <input 
                    type="date" 
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">کاتی دەستپێک:</label>
                    <input 
                      type="time" 
                      value={overrideCheckIn}
                      onChange={(e) => setOverrideCheckIn(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500">کاتی کۆتایی:</label>
                    <input 
                      type="time" 
                      value={overrideCheckOut}
                      onChange={(e) => setOverrideCheckOut(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none text-center font-mono"
                    />
                  </div>
                </div>
                <Button onClick={handleAddShiftOverride} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-none cursor-pointer">
                  تۆمارکردنی کاتی دەوامی ئەم ڕۆژە
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TABS CONTENT 6: HOLIDAYS */}
        <TabsContent value="holidays">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden h-max">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">📅 زیادکردنی پشووی فەرمی</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">ناوی پشوو:</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: نەورۆز" 
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500">بەروار:</label>
                  <input 
                    type="date" 
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-300 p-2 rounded-none outline-none"
                  />
                </div>
                <Button onClick={handleAddHoliday} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded-none cursor-pointer">
                  پاشەکەوتکردنی پشوو
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-slate-300 bg-white shadow-xs rounded-none overflow-hidden lg:col-span-2">
              <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-800 tracking-wider">📅 پشووە فەرمییە تۆمارکراوەکان</CardTitle>
                <span className="bg-slate-200 border border-slate-300 text-slate-800 py-0.5 px-2 rounded-none text-[9px] font-black tracking-wide">کۆی گشتی: {holidays.length}</span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-slate-300 bg-white">
                  <table className="w-full text-xs font-semibold text-slate-700 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300">
                        <th className="p-2.5 text-[10px] font-black text-slate-600">ناوی پشوو</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600">بەروار</th>
                        <th className="p-2.5 text-[10px] font-black text-slate-600 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {holidays.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900">{h.name}</td>
                          <td className="p-2.5 font-mono text-slate-600">{h.date}</td>
                          <td className="p-2.5 text-left">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="h-7 w-7 rounded-none text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 🪟 WINDOWS 11 SHARP MODAL: DAILY DRILL-DOWN 24-HOUR TIMELINE VIEW */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-2xl w-full p-0 space-y-0 text-right">
            
            {/* Sharp Window Title Bar */}
            <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <h3 className="font-black text-xs text-white">
                  پەنجەرەی وردەکاری ٢٤ کاتژمێری: {selectedDayDetail.user?.name || 'گشت کارمەندان'}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">{selectedDayDetail.date}</span>
                <button 
                  onClick={() => setSelectedDayDetail(null)}
                  className="w-6 h-6 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs font-mono transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* 24-Hour Timeline Bar */}
              <div className="space-y-2 p-3 bg-slate-100 rounded-none border border-slate-300">
                <span className="text-xs font-black text-slate-800 block">گرافی دەوامی ٢٤ کاتژمێری ئەم ڕۆژە:</span>
                <div className="relative w-full h-12 bg-white rounded-none overflow-hidden border border-slate-300">
                  <div className="absolute top-0 bottom-0 bg-blue-100/60 border-x-2 border-dashed border-blue-400/80 pointer-events-none" style={{ left: '35.4%', width: '33.3%' }} />
                  {selectedDayDetail.records.map((r, i) => {
                    if (!r.checkInTime) return null;
                    const [inH, inM] = r.checkInTime.split(':').map(Number);
                    const [outH, outM] = (r.checkOutTime || '16:30').split(':').map(Number);
                    const startMin = (inH || 0) * 60 + (inM || 0);
                    const endMin = (outH || 0) * 60 + (outM || 0);
                    const leftPct = (startMin / 1440) * 100;
                    const widthPct = Math.max(1.5, ((endMin - startMin) / 1440) * 100);

                    return (
                      <div 
                        key={i} 
                        className="absolute top-1 bottom-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-none flex items-center justify-center text-[9px] font-mono font-bold shadow-xs border border-emerald-700"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        {r.checkInTime} {r.checkOutTime ? `- ${r.checkOutTime}` : '▶ بەردەوام'}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 font-bold">
                  <span>00:00</span>
                  <span>04:00</span>
                  <span className="text-blue-700 font-black">08:30 (دەستپێک)</span>
                  <span>12:00</span>
                  <span className="text-blue-700 font-black">16:30 (تەواو)</span>
                  <span>20:00</span>
                  <span>24:00</span>
                </div>
              </div>

              {/* Records List */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <span className="text-xs font-black text-slate-800 block">تۆمارەکان و لۆکەیشن:</span>
                {selectedDayDetail.records.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200">هیچ لۆگێکی دەوام بۆ ئەم ڕۆژە نەدۆزرایەوە.</p>
                ) : (
                  selectedDayDetail.records.map((r, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 border border-slate-300 rounded-none flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-slate-900">{r.userName}</span>
                        <p className="text-[10px] text-slate-500">📍 {r.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی'}</p>
                      </div>
                      <div className="text-left font-mono">
                        <div className="font-bold text-emerald-800">هاتن: {r.checkInTime || '-'}</div>
                        <div className="text-slate-600">ڕۆشتن: {r.checkOutTime || '-'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end">
                <Button onClick={() => setSelectedDayDetail(null)} className="rounded-none px-6 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white">
                  داخستن
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🪟 WINDOWS 11 SHARP SELFIE MODAL */}
      {selectedSelfie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-none border-2 border-slate-700 shadow-2xl max-w-sm w-full p-0 text-center">
            <div className="flex items-center justify-between bg-slate-900 text-white px-3 py-2 border-b border-slate-700">
              <h3 className="font-black text-xs text-white">وێنەی GPS / لۆگین</h3>
              <button 
                onClick={() => setSelectedSelfie(null)}
                className="w-5 h-5 bg-slate-800 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative aspect-square rounded-none overflow-hidden bg-slate-100 border border-slate-300">
                <img src={selectedSelfie} alt="Selfie" className="w-full h-full object-cover" />
              </div>
              <Button onClick={() => setSelectedSelfie(null)} className="w-full rounded-none text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white">داخستن</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
