'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, MapPin, Clock, Calendar, FileSpreadsheet, RefreshCw, 
  Trash2, UserMinus, Plus, Save, Compass, QrCode
} from 'lucide-react';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  pin: string;
  deviceToken: string | null;
  role: string;
  hourlyRate: number;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkInTime: string;
  checkInSelfie: string;
  checkInAddress: string;
  checkOutTime: string;
  checkOutSelfie: string;
  checkOutAddress: string;
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
}

export default function AdminAttendancePage() {
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Security Auth Guard & 30-Minute Inactivity Auto-Logout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ashley_admin_session');
      const stored = sessionStorage.getItem('ashley_admin_session');
      if (!stored) {
        setAuthChecked(false);
        window.location.href = '/adminpanel';
        return;
      } else {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.token) {
            setAuthChecked(true);
          } else {
            setAuthChecked(false);
            sessionStorage.removeItem('ashley_admin_session');
            window.location.href = '/adminpanel';
            return;
          }
        } catch {
          setAuthChecked(false);
          window.location.href = '/adminpanel';
          return;
        }
      }
    }

    let timeoutId: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert('⚠️ سێشنەکەت بەسەرچوو بەهۆی بێدەنگی بۆ ماوەی ٣٠ خولەک! تکایە دووبارە لۆگین بکەرەوە.');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('ashley_admin_session');
          localStorage.removeItem('ashley_admin_session');
          window.location.href = '/adminpanel';
        }
      }, 30 * 60 * 1000);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, []);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [defaultShift, setDefaultShift] = useState({ checkInTime: '08:30', checkOutTime: '16:30' });
  const [shiftOverrides, setShiftOverrides] = useState<Record<string, { checkInTime: string; checkOutTime: string }>>({});

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

  useEffect(() => {
    setMounted(true);
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attendance/admin/report');
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
      setLoading(false);
    }
  };

  if (!mounted) return null;

  // Handlers: Employees
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
        alert(err.error || 'نشست');
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

  // Handlers: Warehouses
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

  // Handlers: Shift Settings
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

  // Handlers: Holidays
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

  // Export to CSV helper
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

  // Strict Security Gate: Never render content if unauthenticated
  if (!authChecked) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-900 text-white font-sans dir-rtl" dir="rtl">
        <div className="text-center space-y-3 p-6 bg-slate-800/80 border border-slate-700 rounded-3xl shadow-2xl">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">پشکنینی دەسەڵاتی بەڕێوەبەر... (پارێزراو)</p>
          <p className="text-xs text-slate-500">تکایە لە ڕێگەی دەروازەی /adminpanel لۆگین بکە</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-24 text-right" dir="rtl">
      
      {/* Page Title */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">بەڕێوەبردنی ئامادەبوونی کارمەندان</h2>
          <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase">داشبۆردی سەرپەرشتیاری تۆماری کاتەکانی دەوام</p>
        </div>
        
        <Button onClick={loadReport} disabled={loading} className="flex items-center gap-2 border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 text-xs font-bold rounded-xl cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>نوێکردنەوەی داتا</span>
        </Button>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="bg-slate-200/40 backdrop-blur-md border border-white/50 p-1.5 rounded-2xl text-muted-foreground w-max shadow-inner mb-6 flex flex-wrap gap-1">
          <TabsTrigger value="logs" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">📋 تۆماری دەوام</TabsTrigger>
          <TabsTrigger value="employees" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">👥 پێناسەی کارمەندان</TabsTrigger>
          <TabsTrigger value="warehouses" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">🏢 ڕێکخستنی کۆگاکان</TabsTrigger>
          <TabsTrigger value="shifts" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">⏰ کاتەکانی دەوام</TabsTrigger>
          <TabsTrigger value="holidays" className="rounded-xl px-4 py-1.5 text-xs font-semibold tracking-wide data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">📅 پشووەکان</TabsTrigger>
        </TabsList>

        {/* TABS CONTENT 1: ATTENDANCE LOGS */}
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
                                <button onClick={() => setSelectedSelfie(row.checkInSelfie)} className="text-[10px] text-primary hover:underline font-bold">🖼️ وێنە</button>
                              )}
                            </div>
                            {row.checkInAddress && <p className="text-[9px] text-slate-400 max-w-[150px] truncate mt-0.5" title={row.checkInAddress}>📍 {row.checkInAddress}</p>}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="num-font font-bold">{row.checkOutTime || '-'}</span>
                              {row.checkOutSelfie && (
                                <button onClick={() => setSelectedSelfie(row.checkOutSelfie)} className="text-[10px] text-primary hover:underline font-bold">🖼️ وێنە</button>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TABS CONTENT 2: EMPLOYEES DETAILS */}
        <TabsContent value="employees">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Create Employee Form */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">➕ زیادکردنی کارمەندی تۆمارکەر</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">کۆدی ناسنامە (ID / کورتکراوەی ئینگلیزی):</label>
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
                  <label className="text-[10px] font-black text-slate-400">پین کۆد (PIN - بۆ لۆگین):</label>
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

            {/* List Employees */}
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
                        <th className="p-3 text-[10px] font-black text-slate-400">نرخی سەعات</th>
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
                          <td className="p-3 num-font font-bold text-primary">{u.hourlyRate.toLocaleString()} IQD</td>
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

        {/* TABS CONTENT 3: WAREHOUSES GEOLOCATION CONFIG */}
        <TabsContent value="warehouses">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Add Warehouse Form */}
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
                    placeholder="نموونە: 35.5560" 
                    value={newWhLat}
                    onChange={(e) => setNewWhLat(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">هێڵی درێژی جوگرافی (Longitude):</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: 45.4418" 
                    value={newWhLng}
                    onChange={(e) => setNewWhLng(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ڕادیۆسی بازنەی ڕێگەپێدراو (مەتر):</label>
                  <input 
                    type="number" 
                    value={newWhRadius}
                    onChange={(e) => setNewWhRadius(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center font-mono"
                  />
                </div>

                <Button onClick={handleAddWarehouse} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl mt-2 cursor-pointer">
                  تۆمارکردنی کۆگا
                </Button>
              </CardContent>
            </Card>

            {/* List Warehouses */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden lg:col-span-2">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">🏢 جوگرافیا و نەخشەی کۆگاکانی ئاشڵی</CardTitle>
                <span className="bg-primary/10 border border-primary/20 text-primary py-0.5 px-3 rounded-full text-[9px] font-black tracking-wide">کۆگاکان: {warehouses.length}</span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">ناوی کۆگا</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">مەودا جوگرافییەکان (GPS)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">بازنە (Radius)</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">سیستەمی بارکۆد</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {warehouses.map(w => (
                        <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{w.name}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 num-font font-mono text-[11px] text-slate-500">
                              <Compass className="w-3.5 h-3.5 text-slate-400" />
                              <span>{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</span>
                            </div>
                          </td>
                          <td className="p-3 num-font font-bold text-slate-700">{w.radius} مەتر</td>
                          <td className="p-3">
                            <Button 
                              variant="ghost" 
                              onClick={() => window.open(`/attendance/qr?wh=${w.id}`, '_blank')}
                              className="text-[11px] font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-1 cursor-pointer flex items-center gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>کۆدی شاشە (Live QR)</span>
                            </Button>
                          </td>
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

        {/* TABS CONTENT 4: SHIFTS RULES & OVERRIDES */}
        <TabsContent value="shifts">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Default Shift times */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">⏰ کاتی دەوامی ڕەسمی هەمیشەیی</CardTitle>
                <CardDescription className="text-[10px] text-slate-400 mt-1">دیاریکردنی کاتی هاتن و ڕۆشتنی فەرمی کۆمپانیا بۆ گشت ڕۆژەکان.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی هاتن (Check-In):</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkInTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkInTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی ڕۆشتن (Check-Out):</label>
                    <input 
                      type="time" 
                      value={defaultShift.checkOutTime}
                      onChange={(e) => setDefaultShift({ ...defaultShift, checkOutTime: e.target.value })}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none text-center"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveDefaultShift} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer">
                  <Save className="w-4 h-4" />
                  <span>پاشەکەوتکردنی کاتی گشتی</span>
                </Button>
              </CardContent>
            </Card>

            {/* Special Shift overrides */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">📅 دیاریکردنی دەوامی تایبەت (ڕۆژانی جیاواز)</CardTitle>
                <CardDescription className="text-[10px] text-slate-400 mt-1">تۆمارکردنی کاتی دەوامی جیاواز بۆ ڕۆژێکی دیاریکراو (مەثەلەن نیوە ڕۆژ).</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">ڕۆژ:</label>
                    <input 
                      type="date" 
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی هاتن:</label>
                    <input 
                      type="time" 
                      value={overrideCheckIn}
                      onChange={(e) => setOverrideCheckIn(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">کاتی ڕۆشتن:</label>
                    <input 
                      type="time" 
                      value={overrideCheckOut}
                      onChange={(e) => setOverrideCheckOut(e.target.value)}
                      className="w-full text-xs font-bold bg-white border border-slate-200 p-2 rounded-xl outline-none text-center"
                    />
                  </div>
                </div>

                <Button onClick={handleAddShiftOverride} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>تۆمارکردنی دەوامی تایبەت</span>
                </Button>

                <div className="border-t border-slate-200/50 pt-4 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase">دەوامە تایبەتییە تۆمارکراوەکان:</h4>
                  {Object.keys(shiftOverrides).length === 0 ? (
                    <p className="text-[11px] text-slate-400 font-bold">هیچ دەوامێکی تایبەت تۆمار نەکراوە.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(shiftOverrides).map(([date, times]) => (
                        <div key={date} className="flex items-center justify-between p-2.5 bg-slate-100/50 rounded-xl border border-white text-xs font-semibold">
                          <div>
                            <span className="font-bold text-slate-800">{date}</span>
                            <span className="text-[10px] text-slate-400 mr-2">({times.checkInTime} - {times.checkOutTime})</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleRemoveOverride(date)}
                            className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TABS CONTENT 5: HOLIDAYS MANAGEMENT */}
        <TabsContent value="holidays">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Add Holiday Form */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden h-max">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">📅 تۆمارکردنی ڕۆژی پشووی فەرمی</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ناوی پشوو:</label>
                  <input 
                    type="text" 
                    placeholder="نموونە: جەژنی ڕەمەزان" 
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400">ڕێککەوت (تاریخ):</label>
                  <input 
                    type="date" 
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full text-xs font-bold bg-white border border-slate-200 p-2.5 rounded-xl outline-none"
                  />
                </div>

                <Button onClick={handleAddHoliday} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl mt-2 cursor-pointer">
                  تۆمارکردنی پشوو
                </Button>
              </CardContent>
            </Card>

            {/* List Holidays */}
            <Card className="border border-white/60 bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl overflow-hidden lg:col-span-2">
              <CardHeader className="py-4 px-6 bg-white/20 border-b border-white/40 flex items-center justify-between">
                <CardTitle className="text-xs font-black uppercase text-slate-700 tracking-wider">📅 لیستی ڕۆژانی پشووی تۆمارکراوی کۆمپانیا</CardTitle>
                <span className="bg-primary/10 border border-primary/20 text-primary py-0.5 px-3 rounded-full text-[9px] font-black tracking-wide">پشووەکان: {holidays.length}</span>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white/50">
                  <table className="w-full text-xs font-semibold text-slate-600 text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3 text-[10px] font-black text-slate-400">ناوی پشوو</th>
                        <th className="p-3 text-[10px] font-black text-slate-400">ڕێککەوت</th>
                        <th className="p-3 text-[10px] font-black text-slate-400 text-left">کردار</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {holidays.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-bold text-slate-800">{h.name}</td>
                          <td className="p-3 num-font font-bold text-slate-700">{h.date}</td>
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

      {/* Dialog Modal: View Selfie */}
      <Dialog open={selectedSelfie !== null} onOpenChange={(open) => { if(!open) setSelectedSelfie(null); }}>
        <DialogContent className="border border-white/60 bg-white/75 backdrop-blur-2xl p-6 shadow-2xl rounded-2xl text-center max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-slate-700">وێنەی سێڵفی تۆمارکراو</DialogTitle>
          </DialogHeader>
          {selectedSelfie && (
            <img 
              src={selectedSelfie} 
              alt="Selfie log detail" 
              className="w-full h-80 object-cover rounded-xl mt-4 border border-white"
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
