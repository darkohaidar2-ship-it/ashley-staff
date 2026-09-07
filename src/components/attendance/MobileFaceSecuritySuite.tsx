'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Smartphone, ScanFace, RefreshCw, 
  Trash2, AlertCircle, CheckCircle2, Search, SmartphoneCharging,
  KeyRound, UserCheck, XCircle, Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export interface SecurityEmployee {
  id: string;
  name: string;
  pin: string;
  role: string;
  hourlyRate: number;
  isDeviceBound: boolean;
  deviceInfo: {
    ip: string;
    deviceToken: string;
    boundAt: string | null;
    fingerprint?: string | null;
  } | null;
  isFaceRegistered: boolean;
  faceInfo: {
    descriptorsCount: number;
    registeredAt: string | null;
    clientIp?: string | null;
  } | null;
}

export default function MobileFaceSecuritySuite() {
  const [employees, setEmployees] = useState<SecurityEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const loadStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(`/api/attendance/admin/security-status?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (e: any) {
      console.error('Failed to load security status:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Reset Device Handler
  const handleResetDevice = async (emp: SecurityEmployee) => {
    if (!confirm(`ئایا دڵنیایت لە سفرکردنەوەی بەستنەوەی مۆبایلی (${emp.name})؟\nدوای ئەمە کارمەندەکە دەتوانێت لە هەر مۆبایلێکی نوێوە لۆگین بکات و بیبەستێتەوە.`)) {
      return;
    }

    try {
      setActionInProgress(`${emp.id}-device`);
      const res = await fetch('/api/attendance/admin/users/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.id })
      });

      if (res.ok) {
        toast({
          title: "بەستنەوەی مۆبایل سفرکرایەوە",
          description: `مۆبایلی ${emp.name} بە سەرکەوتوویی لە ئەکاونتەکەی جیاکرایەوە.`,
        });
        await loadStatus(true);
      } else {
        const err = await res.json();
        alert(err.error || 'هەڵە لە سفرکردنەوەی مۆبایل ڕوویدا');
      }
    } catch (e: any) {
      alert('هەڵە لە پەیوەندی بە سێرڤەر: ' + e.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Reset Face Handler
  const handleResetFace = async (emp: SecurityEmployee) => {
    if (!confirm(`ئایا دڵنیایت لە سڕینەوە و سفرکردنەوەی دەموچاوی (${emp.name})؟\nدوای ئەمە لە لۆگینی داهاتوو دەبێت دووبارە ڕوخساری لە ٣ گۆشەوە تۆمار بکاتەوە.`)) {
      return;
    }

    try {
      setActionInProgress(`${emp.id}-face`);
      const res = await fetch('/api/attendance/admin/users/reset-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.id })
      });

      if (res.ok) {
        toast({
          title: "دەموچاو سفرکرایەوە",
          description: `ناسنامەی دەموچاوی ${emp.name} بە سەرکەوتوویی سڕایەوە.`,
        });
        await loadStatus(true);
      } else {
        const err = await res.json();
        alert(err.error || 'هەڵە لە سفرکردنەوەی دەموچاو ڕوویدا');
      }
    } catch (e: any) {
      alert('هەڵە لە پەیوەندی بە سێرڤەر: ' + e.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Reset Both Handler
  const handleResetAll = async (emp: SecurityEmployee) => {
    if (!confirm(`⚠️ ئاگاداری: ئایا دڵنیایت لە سفرکردنەوەی گشتی هەم مۆبایل و هەم دەموچاوی (${emp.name})؟`)) {
      return;
    }

    try {
      setActionInProgress(`${emp.id}-all`);
      const res = await fetch('/api/attendance/admin/users/reset-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: emp.id })
      });

      if (res.ok) {
        toast({
          title: "سفرکردنەوەی تەواوەتی ئەنجامدرا",
          description: `سەرجەم داتای مۆبایل و دەموچاوی ${emp.name} سفر کرایەوە.`,
        });
        await loadStatus(true);
      }
    } catch (e: any) {
      alert('هەڵە: ' + e.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtered employees
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(e => 
      e.name.toLowerCase().includes(q) || 
      e.id.toLowerCase().includes(q) || 
      e.pin.includes(q)
    );
  }, [employees, searchQuery]);

  const totalCount = employees.length;
  const boundCount = employees.filter(e => e.isDeviceBound).length;
  const faceCount = employees.filter(e => e.isFaceRegistered).length;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* 🛡️ Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl border border-slate-700 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-400">
              <SmartphoneCharging className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-wide text-white">
                بەڕێوەبردنی بەستنەوەی مۆبایل و دەموچاو (Mobile & Face ID Security)
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                چاودێری و کۆنترۆڵکردنی دۆخی مۆبایلی بەستراوە، ناونیشانی IP، و فەیس ئایدی کارمەندان بە توانای سفرکردنەوە لە وێبسایتەوە.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => loadStatus()} 
          disabled={loading}
          variant="outline"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold px-4 py-2 h-9 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>نوێکردنەوەی داتا</span>
        </Button>
      </div>

      {/* 📊 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider">کۆی گشتی کارمەندان</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount} کارمەند</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider">مۆبایلی بەستراوەتەوە</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{boundCount} مۆبایل</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{totalCount - boundCount} ئامادەی بەستنەوەن</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider">ڕوخساری ناسێنراو (Face ID)</p>
              <h3 className="text-2xl font-black text-purple-600 mt-1">{faceCount} کارمەند</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{totalCount - faceCount} تۆمار نەکراون</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <ScanFace className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 Search Filter */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <Search className="w-4 h-4 text-slate-400 mr-1" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="گەڕان بەپێی ناوی کارمەند یان پین کۆد..."
          className="border-none shadow-none focus-visible:ring-0 text-xs font-bold text-slate-900 bg-transparent h-8"
        />
        {searchQuery && (
          <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="h-7 text-xs text-slate-400 hover:text-slate-700">
            سڕینەوە
          </Button>
        )}
      </div>

      {/* 📋 Main Employee Security Cards List */}
      <div className="space-y-3">
        {filtered.map((emp) => {
          const isBusy = actionInProgress?.startsWith(emp.id);

          return (
            <Card key={emp.id} className="border border-slate-200 hover:border-slate-300 bg-white shadow-sm rounded-2xl transition-all overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  
                  {/* Employee Identity */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-800 text-sm shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{emp.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {emp.id}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <KeyRound className="w-2.5 h-2.5" /> PIN: {emp.pin}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {emp.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Binding Status */}
                  <div className="flex-1 min-w-[200px] bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-slate-600" />
                        <span>بەستنەوەی مۆبایل</span>
                      </span>
                      {emp.isDeviceBound ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>بەستراوەتەوە</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-slate-400" />
                          <span>بەتاڵ (نەبەستراوە)</span>
                        </Badge>
                      )}
                    </div>
                    {emp.isDeviceBound && emp.deviceInfo ? (
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <p className="font-mono text-slate-700 font-bold">IP: {emp.deviceInfo.ip}</p>
                        <p className="font-mono text-slate-400 truncate max-w-[220px]">ئامێر: {emp.deviceInfo.deviceToken}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">لە کاتی یەکەم لۆگیندا مۆبایلەکەی دەبەسترێتەوە.</p>
                    )}
                  </div>

                  {/* Face ID Status */}
                  <div className="flex-1 min-w-[200px] bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                        <ScanFace className="w-3 h-3 text-slate-600" />
                        <span>ناسینەوەی ڕوخسار</span>
                      </span>
                      {emp.isFaceRegistered ? (
                        <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>تۆمارکراوە (Apple 3D)</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 border-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>تۆمار نەکراوە</span>
                        </Badge>
                      )}
                    </div>
                    {emp.isFaceRegistered && emp.faceInfo ? (
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <p className="font-bold text-purple-700">
                          {emp.faceInfo.descriptorsCount >= 3 ? '٣ گۆشەی تەواو (ڕاستەوخۆ، ڕاست، چەپ)' : '١ گۆشەی ڕووبەڕوو'}
                        </p>
                        <p className="text-slate-400">بۆ دەوامی ڕۆژانە ١٠٠٪ چالاکە</p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">لە یەکەم لۆگیندا دەموچاوی لە ٣ لایەنەوە تۆمار دەکرێت.</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    
                    {/* Reset Mobile Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!emp.isDeviceBound || isBusy}
                      onClick={() => handleResetDevice(emp)}
                      className="border-amber-200 text-amber-800 hover:bg-amber-50 text-[11px] font-bold h-8 rounded-xl px-3 cursor-pointer flex items-center gap-1.5 disabled:opacity-30"
                      title="سفرکردنەوەی مۆبایل تا لە ئامێری نوێوە لۆگین بکات"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                      <span>سفرکردنەوەی مۆبایل</span>
                    </Button>

                    {/* Reset Face Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!emp.isFaceRegistered || isBusy}
                      onClick={() => handleResetFace(emp)}
                      className="border-purple-200 text-purple-800 hover:bg-purple-50 text-[11px] font-bold h-8 rounded-xl px-3 cursor-pointer flex items-center gap-1.5 disabled:opacity-30"
                      title="سڕینەوەی دەموچاو تا دووبارە سکانی بکاتەوە"
                    >
                      <ScanFace className="w-3.5 h-3.5 text-purple-600" />
                      <span>سفرکردنەوەی دەموچاو</span>
                    </Button>

                    {/* Reset Both Button */}
                    {(emp.isDeviceBound || emp.isFaceRegistered) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isBusy}
                        onClick={() => handleResetAll(emp)}
                        className="text-rose-600 hover:bg-rose-50 text-[11px] font-bold h-8 rounded-xl px-2.5 cursor-pointer"
                        title="سفرکردنەوەی هەردووکیان پێکەوە"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                  </div>

                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">هیچ کارمەندێک بەم ناوە نەدۆزرایەوە</p>
          </div>
        )}
      </div>

    </div>
  );
}
