'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Zap, Clock, ShieldCheck, MapPin, 
  Trash2, UserMinus, Plus, Edit2, Calendar, 
  Download, RefreshCw, Eye, CheckCircle2, 
  XCircle, FileSpreadsheet, Lock, AlertTriangle,
  ChevronLeft, ChevronRight, BarChart3, Compass,
  Palmtree, Sun, UserCheck, AlertCircle, Check
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

  // Set manual cell status (Click or Drag)
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
    <div className="space-y-6 w-full pb-24 text-right" dir="rtl">
      
      {/* Page Title & Real-Time Indicator */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800">بەڕێوەبردنی ئامادەبوونی کارمەندان</h2>
            <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>ڕاستەوخۆ (Live 3s)</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase">داشبۆردی سەرپەرشتیاری خشتەی ٣١ ڕۆژە و کاتەکانی دەوام</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={() => loadReport()} disabled={loading} className="flex items-center gap-2 border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-bold rounded-xl cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>نوێکردنەوە</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        <TabsList className="bg-slate-200/40 backdrop-blur-md border border-white/50 p-1.5 rounded-2xl text-muted-foreground w-max shadow-inner mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="matrix" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">🗓️ خشتەی ٣١ ڕۆژەی وردەکاری</TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">📋 لیستی لۆگەکان</TabsTrigger>
          <TabsTrigger value="employees" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">👥 پێناسەی کارمەندان</TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">🏢 ڕێکخستنی کۆگاکان</TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">⏰ کاتەکانی دەوام</TabsTrigger>
          <TabsTrigger value="holidays" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">📅 پشووەکان</TabsTrigger>
        </TabsList>

        {/* TABS CONTENT 1: 31-DAY DETAILED MATRIX */}
        <TabsContent value="matrix" className="space-y-4">
          <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 bg-white/40 border-b border-white/60 flex flex-col md:flex-row items-center justify-between gap-4">
              
              {/* Month Navigation */}
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                  className="w-8 h-8 rounded-xl cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                
                <div className="text-center">
                  <h3 className="font-black text-sm text-slate-800 font-mono">
                    {format(selectedMonth, 'yyyy MMMM')} (مانگی {format(selectedMonth, 'M')})
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold">٣١ ڕۆژ بە جیاوازی هەینی و مۆڵەت</span>
                </div>

                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                  className="w-8 h-8 rounded-xl cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>

              {/* Status Quick Palette */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black text-slate-600">پالێتی گۆڕینی حاڵەت:</span>
                {[
                  { key: 'Present', label: '🟢 ئامادەبوو', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                  { key: 'Leave', label: '🟡 مۆڵەت', bg: 'bg-amber-100 text-amber-800 border-amber-300' },
                  { key: 'Absent', label: '🔴 غیاب', bg: 'bg-rose-100 text-rose-800 border-rose-300' },
                  { key: 'Holiday', label: '🌴 پشوو', bg: 'bg-blue-100 text-blue-800 border-blue-300' }
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPaletteStatus(p.key)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${p.bg} ${
                      selectedPaletteStatus === p.key ? 'ring-2 ring-primary ring-offset-1 scale-105 shadow-xs' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

            </CardHeader>

            <CardContent className="p-4">
              <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
                <table className="w-full text-xs font-semibold text-slate-700 text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200">
                      <th className="p-3 text-[11px] font-black text-slate-700 sticky right-0 bg-slate-100 z-10 min-w-[140px] text-right border-l border-slate-200">
                        کارمەند
                      </th>
                      {monthDays.map(d => (
                        <th 
                          key={d.dateStr} 
                          className={`p-2 text-[10px] font-black border-l border-slate-200 min-w-[42px] ${
                            d.isFriday ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600'
                          }`}
                        >
                          <div>{d.dayNum}</div>
                          <div className="text-[8px] font-normal">{d.isFriday ? '🌴 هەینی' : ''}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.filter(u => u.role !== 'admin').map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900 sticky right-0 bg-white z-10 text-right border-l border-slate-200 shadow-xs">
                          <div className="text-xs">{user.name}</div>
                          <div className="text-[9px] font-mono text-slate-400">{user.id}</div>
                        </td>
                        {monthDays.map(d => {
                          const rec = attendanceMap.get(`${user.id}_${d.dateStr}`);
                          const status = rec?.status;
                          const isFriday = d.isFriday;

                          let badgeColor = 'bg-slate-50 text-slate-400 border-slate-200';
                          let badgeText = '-';

                          if (status === 'Present' || rec?.checkInTime) {
                            badgeColor = 'bg-emerald-500 text-white border-emerald-600';
                            badgeText = rec?.checkInTime || 'ئامادە';
                          } else if (status === 'Leave' || status === 'مۆڵەت') {
                            badgeColor = 'bg-amber-400 text-amber-950 border-amber-500';
                            badgeText = 'مۆڵەت';
                          } else if (status === 'Absent' || status === 'غیاب') {
                            badgeColor = 'bg-rose-500 text-white border-rose-600';
                            badgeText = 'غیاب';
                          } else if (status === 'Holiday' || isFriday) {
                            badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                            badgeText = '🌴';
                          }

                          return (
                            <td 
                              key={d.dateStr} 
                              onClick={() => handleCellStatusChange(user.id, user.name, d.dateStr, selectedPaletteStatus)}
                              onDoubleClick={() => setSelectedDayDetail({ date: d.dateStr, user, records: rec ? [rec] : [] })}
                              title={`کلیک بکە بۆ دیاریکردنی ${selectedPaletteStatus} (دبل کلیک بۆ وردەکاری ٢٤ کاتژمێری)`}
                              className={`p-1 border-l border-slate-100 cursor-pointer hover:bg-blue-50/50 transition-all ${
                                isFriday ? 'bg-emerald-50/30' : ''
                              }`}
                            >
                              <div className={`w-full py-1 rounded-md text-[9px] font-black border shadow-2xs transition-all ${badgeColor}`}>
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
          <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">لیستی گشتی هاتن و ڕۆشتنی ستاف</CardTitle>
                <CardDescription className="text-[10px] text-slate-400 mt-1">پیشاندانی سەرجەم لۆگە تۆمارکراوەکان لەگەڵ توانای فلتەرکردن و وەرگرتنی ڕاپۆرت.</CardDescription>
              </div>
              <Button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-600/95 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm">
                <FileSpreadsheet className="w-4 h-4" />
                <span>داگرتنی Excel</span>
              </Button>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* 📊 TOP ATTENDANCE KPI STATS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-500">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>ئامادەبووانی ئەمڕۆ</span>
                  </div>
                  <div className="text-xl font-black font-mono text-slate-900">
                    {filteredAttendance.filter(r => r.status === 'Present').length} / {users.filter(u => u.role !== 'admin').length}
                  </div>
                </div>

                <div className="p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کۆی کاژێری دەوامی تۆمارکراو</span>
                  </div>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    {Math.round(filteredAttendance.reduce((acc, curr) => {
                      if (!curr.checkInTime) return acc;
                      const [inH, inM] = curr.checkInTime.split(':').map(Number);
                      const [outH, outM] = (curr.checkOutTime || '16:30').split(':').map(Number);
                      const diff = Math.max(0, ((outH * 60 + outM) - (inH * 60 + inM)) / 60);
                      return acc + diff;
                    }, 0))} کاژێر
                  </div>
                </div>

                <div className="p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-500">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>کۆی ئیزافە (Overtime)</span>
                  </div>
                  <div className="text-xl font-black font-mono text-amber-700">
                    {filteredAttendance.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)} خولەک
                  </div>
                </div>

                <div className="p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-rose-600" />
                    <span>کۆی دواکەوتن</span>
                  </div>
                  <div className="text-xl font-black font-mono text-rose-700">
                    {filteredAttendance.reduce((acc, curr) => acc + (curr.lateMinutes || 0), 0)} خولەک
                  </div>
                </div>
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-100/50 rounded-2xl border border-white/60">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">بەروار:</label>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کارمەند:</label>
                  <select 
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none"
                  >
                    <option value="">هەموو کارمەندەکان</option>
                    {users.filter(u => u.role !== 'admin').map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کۆگا:</label>
                  <select 
                    value={filterWarehouse}
                    onChange={(e) => setFilterWarehouse(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none"
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
                <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">بارکردنی لۆگەکان...</div>
              ) : filteredAttendance.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold text-slate-400">هیچ لۆگێکی ئامادەبوون نەدۆزرایەوە بۆ ئەم فلتەرە.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">ناو</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">بەروار</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">کاتی هاتن (In)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">کاتی ڕۆشتن (Out)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">کۆگا</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">دواکەوتن (خولەک)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">ئیزافە (خولەک)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">حاڵەت</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">وردەکاری ٢٤ کاتژمێری</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {filteredAttendance.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{row.userName}</td>
                          <td className="p-3 num-font">{row.date}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="num-font font-bold">{row.checkInTime || '-'}</span>
                              {row.checkInSelfie && (
                                <button onClick={() => setSelectedSelfie(row.checkInSelfie!)} className="text-[10px] text-primary hover:underline font-bold">🖼️ وێنە</button>
                              )}
                            </div>
                            {row.checkInAddress && <p className="text-[9px] text-slate-400 max-w-[150px] truncate mt-0.5" title={row.checkInAddress}>📍 {row.checkInAddress}</p>}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="num-font font-bold">{row.checkOutTime || '-'}</span>
                              {row.checkOutSelfie && (
                                <button onClick={() => setSelectedSelfie(row.checkOutSelfie!)} className="text-[10px] text-primary hover:underline font-bold">🖼️ وێنە</button>
                              )}
                            </div>
                            {row.checkOutAddress && <p className="text-[9px] text-slate-400 max-w-[150px] truncate mt-0.5" title={row.checkOutAddress}>📍 {row.checkOutAddress}</p>}
                          </td>
                          <td className="p-3 font-bold">{row.warehouseName}</td>
                          <td className="p-3 num-font text-rose-500 font-bold">{row.lateMinutes > 0 ? row.lateMinutes : '0'}</td>
                          <td className="p-3 num-font text-emerald-600 font-bold">{row.overtimeMinutes > 0 ? row.overtimeMinutes : '0'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md font-black text-[9px] ${
                              row.status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                              row.status.includes('Late') ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {row.status === 'Present' ? 'ئاسایی' :
                               row.status === 'Late' ? 'دواکەوتوو' :
                               row.status === 'Early Out' ? 'ڕوشتنی پێشوەختە' : row.status}
                            </span>
                          </td>
                          <td className="p-3 text-left">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedDayDetail({ date: row.date, user: users.find(u => u.id === row.userId), records: [row] })}
                              className="text-[10px] font-bold h-7 rounded-lg"
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">➕ زیادکردنی کارمەندی تۆمارکەر</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کۆدی ناسنامە (ID):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: dana" 
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ناوی تەواو (کوردی):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: دانا علی" 
                    value={newEmpName}
                    onChange={(e) => setNewEmpName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">پین کۆد (PIN):</label>
                  <input 
                    type="text" 
                    placeholder="کۆدی 4 ژمارەیی" 
                    value={newEmpPin}
                    onChange={(e) => setNewEmpPin(e.target.value.replace(/\D/g, ''))}
                    maxLength={4}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center tracking-widest"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">نرخی کاژێر (Hourly Rate - IQD):</label>
                  <input 
                    type="number" 
                    placeholder="نرخ بە پارە" 
                    value={newEmpRate}
                    onChange={(e) => setNewEmpRate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center"
                  />
                </div>

                <Button onClick={handleAddEmployee} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl mt-2 cursor-pointer">
                  تۆمارکردن لە سیستەم
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden lg:col-span-2">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">👥 لیستی ستاف و پێناسی ئامێرەکان</CardTitle>
                <span className="bg-primary/10 border border-primary/20 text-primary py-0.5 px-3 rounded-full text-[9px] font-black tracking-wide">کۆی گشتی: {users.length}</span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">کۆد (ID)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">ناو</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">پین کۆد</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">ئامێر (Device Status)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">کردارەکان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-800">{u.id}</td>
                          <td className="p-3 font-bold text-slate-800">{u.name}</td>
                          <td className="p-3 num-font tracking-widest">{u.pin}</td>
                          <td className="p-3">
                            {u.deviceToken ? (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[9px] bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max">
                                📲 بەستراوەتەوە
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md font-bold text-[9px] bg-slate-100 text-slate-500 flex items-center gap-1 w-max">
                                💤 بەتاڵ
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-left space-x-1" dir="ltr">
                            {u.id !== 'admin' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteUser(u.id)}
                                className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
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
                                className="h-7 w-7 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">🏢 زیادکردنی کۆگای نوێ</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ناوی کۆگا:</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: کۆگای سەرەکی سلێمانی" 
                    value={newWhName}
                    onChange={(e) => setNewWhName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">هێڵی پانی جوگرافی (Latitude):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: 35.5089" 
                    value={newWhLat}
                    onChange={(e) => setNewWhLat(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">هێڵی درێژی جوگرافی (Longitude):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: 45.4529" 
                    value={newWhLng}
                    onChange={(e) => setNewWhLng(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">مەودای ڕێگەپێدراو بە مەتر (Radius):</label>
                  <input 
                    type="number" 
                    value={newWhRadius}
                    onChange={(e) => setNewWhRadius(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center"
                  />
                </div>

                <Button onClick={handleAddWarehouse} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl mt-2 cursor-pointer">
                  تۆمارکردنی کۆگا
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden lg:col-span-2">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">🏢 کۆگاکان و مەودای ڕێگەپێدراوی جوگرافی (Geofences)</CardTitle>
                <span className="bg-primary/10 border border-primary/20 text-primary py-0.5 px-3 rounded-full text-[9px] font-black tracking-wide">کۆی گشتی: {warehouses.length}</span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">ناوی کۆگا</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">لۆکەیشن (Lat, Lng)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">مەودا (Radius)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {warehouses.map(w => (
                        <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{w.name}</td>
                          <td className="p-3 font-mono text-slate-600">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</td>
                          <td className="p-3 num-font font-bold text-primary">{w.radius} مەتر</td>
                          <td className="p-3 text-left">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteWarehouse(w.id)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">⏰ کاتی دەوامی فەرمی گشتی</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی دەستپێکی دەوام:</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkInTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkInTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی کۆتایی دەوام:</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkOutTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkOutTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveDefaultShift} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer">
                  پاشەکەوتکردنی کاتی دەوامی گشتی
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">🌟 دیاریکردنی دەوامی تایبەت بۆ ڕۆژێک</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">بەروار:</label>
                  <input 
                    type="date" 
                    value={overrideDate}
                    onChange={(e) => setOverrideDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی دەستپێک:</label>
                    <input 
                      type="time" 
                      value={overrideCheckIn}
                      onChange={(e) => setOverrideCheckIn(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی کۆتایی:</label>
                    <input 
                      type="time" 
                      value={overrideCheckOut}
                      onChange={(e) => setOverrideCheckOut(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                    />
                  </div>
                </div>
                <Button onClick={handleAddShiftOverride} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer">
                  تۆمارکردنی کاتی دەوامی ئەم ڕۆژە
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TABS CONTENT 6: HOLIDAYS */}
        <TabsContent value="holidays">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">📅 زیادکردنی پشووی فەرمی</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ناوی پشوو:</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: نەورۆز" 
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">بەروار:</label>
                  <input 
                    type="date" 
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                <Button onClick={handleAddHoliday} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer">
                  پاشەکەوتکردنی پشوو
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden lg:col-span-2">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">📅 پشووە فەرمییە تۆمارکراوەکان</CardTitle>
                <span className="bg-primary/10 border border-primary/20 text-primary py-0.5 px-3 rounded-full text-[9px] font-black tracking-wide">کۆی گشتی: {holidays.length}</span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">ناوی پشوو</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">بەروار</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {holidays.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{h.name}</td>
                          <td className="p-3 font-mono text-slate-600">{h.date}</td>
                          <td className="p-3 text-left">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
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

      {/* 🔍 MODAL: DAILY DRILL-DOWN 24-HOUR TIMELINE VIEW */}
      {selectedDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 text-right">
            
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    وردەکاری چالاکی ٢٤ کاتژمێری: {selectedDayDetail.user?.name || 'گشت کارمەندان'}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">{selectedDayDetail.date}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDayDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 24-Hour Timeline Bar */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-xs font-black text-slate-700 block">گرافی دەوامی ٢٤ کاتژمێری ئەم ڕۆژە:</span>
              <div className="relative w-full h-10 bg-slate-200 rounded-xl overflow-hidden border border-slate-300">
                <div className="absolute top-0 bottom-0 bg-blue-100/60 border-x border-blue-300 pointer-events-none" style={{ left: '35.4%', width: '33.3%' }} />
                {selectedDayDetail.records.map((r, i) => {
                  if (!r.checkInTime) return null;
                  const [inH, inM] = r.checkInTime.split(':').map(Number);
                  const [outH, outM] = (r.checkOutTime || '16:30').split(':').map(Number);
                  const startMin = (inH || 0) * 60 + (inM || 0);
                  const endMin = (outH || 0) * 60 + (outM || 0);
                  const leftPct = (startMin / 1440) * 100;
                  const widthPct = Math.max(1, ((endMin - startMin) / 1440) * 100);

                  return (
                    <div 
                      key={i} 
                      className="absolute top-1 bottom-1 bg-emerald-500 text-white rounded-md flex items-center justify-center text-[9px] font-mono font-bold shadow-xs"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      {r.checkInTime} - {r.checkOutTime || 'بەردەوام'}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                <span>00:00</span>
                <span>04:00</span>
                <span className="text-blue-600 font-bold">08:30</span>
                <span>12:00</span>
                <span className="text-blue-600 font-bold">16:30</span>
                <span>20:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* Records List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <span className="text-xs font-black text-slate-800 block">تۆمارەکان و لۆکەیشن:</span>
              {selectedDayDetail.records.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">هیچ لۆگێکی دەوام بۆ ئەم ڕۆژە نەدۆزرایەوە.</p>
              ) : (
                selectedDayDetail.records.map((r, i) => (
                  <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{r.userName}</span>
                      <p className="text-[10px] text-slate-400">📍 {r.warehouseName || 'کۆمپانیای سەرەکی ئاشڵی'}</p>
                    </div>
                    <div className="text-left font-mono">
                      <div className="font-bold text-emerald-700">هاتن: {r.checkInTime || '-'}</div>
                      <div className="text-slate-500">ڕۆشتن: {r.checkOutTime || '-'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setSelectedDayDetail(null)} className="rounded-xl px-5 text-xs font-bold">
                داخستن
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Preview Modal */}
      {selectedSelfie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-4 space-y-3 text-center">
            <h3 className="font-black text-xs text-slate-800">وێنەی تۆمارکراوی GPS / لۆگین</h3>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
              <img src={selectedSelfie} alt="Selfie" className="w-full h-full object-cover" />
            </div>
            <Button onClick={() => setSelectedSelfie(null)} className="w-full rounded-xl text-xs font-bold">داخستن</Button>
          </div>
        </div>
      )}

    </div>
  );
}
