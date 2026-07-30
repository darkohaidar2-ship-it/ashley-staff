'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, MonitorPlay, AlertTriangle } from 'lucide-react';

export default function QrCodeDisplay() {
  const searchParams = useSearchParams();
  const whId = searchParams.get('wh');

  const [mounted, setMounted] = useState(false);
  const [warehouse, setWarehouse] = useState<{ id: string; name: string } | null>(null);
  const [dailyToken, setDailyToken] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Clock
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Warehouse Details
  useEffect(() => {
    if (!whId) {
      setError('تکایە ناسنامەی کۆگا (wh) بنووسە لە بەستەری لاپەڕەکەدا.');
      return;
    }

    async function loadWarehouse() {
      try {
        const res = await fetch('/api/attendance/warehouses');
        if (res.ok) {
          const data = await res.json();
          const found = data.find((w: any) => w.id === whId);
          if (found) {
            setWarehouse(found);
          } else {
            setError('کۆگای دیاریکراو نەدۆزرایەوە.');
          }
        } else {
          setError('نشست لە بارکردنی زانیاری کۆگاکان.');
        }
      } catch (err) {
        setError('کێشەی هێڵ هەیە لەگەڵ سێرڤەردا.');
      }
    }
    loadWarehouse();
  }, [whId]);

  // Fetch Token and update QR
  useEffect(() => {
    if (!whId || !warehouse) return;

    async function fetchToken() {
      try {
        const res = await fetch('/api/attendance/daily-token');
        if (res.ok) {
          const data = await res.json();
          setDailyToken(data.token);

          // Build dynamic check-in URL with rotating daily token
          const protocol = window.location.protocol;
          const host = window.location.host;
          const checkinLink = `${protocol}//${host}/attendance/checkin?wh=${whId}&token=${data.token}`;
          
          // Generate QR code link
          const encodedLink = encodeURIComponent(checkinLink);
          setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedLink}`);
        }
      } catch (err) {
        console.error('Failed to fetch daily token:', err);
      }
    }

    fetchToken();
    // Refresh token every 30 seconds
    const interval = setInterval(fetchToken, 30000);
    return () => clearInterval(interval);
  }, [whId, warehouse]);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-[#f3f7fa] items-center justify-center p-4 text-center">
      <Card className="w-full max-w-[480px] border border-white/60 bg-white/60 backdrop-blur-xl shadow-2xl rounded-3xl p-8 relative overflow-hidden">
        
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="logo-icon text-4xl mb-2">📦</div>
        <h1 className="text-xl font-black text-slate-800">تۆمارکردنی ئامادەبوونی کارمەندانی ئاشڵی</h1>
        <p className="text-xs text-slate-400 font-bold mt-1 max-w-[320px] mx-auto leading-relaxed">
          بۆ تۆمارکردنی کاتی دەستبەکاربوون یان چوونە دەرەوە، ئەم کۆدە بە کامێرای مۆبایلەکەت سکان بکە.
        </p>

        {error ? (
          <div className="my-8 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : qrUrl ? (
          <div className="space-y-4">
            <div className="my-6 p-4 bg-white border border-white/80 rounded-2xl inline-block shadow-md">
              <img src={qrUrl} alt="Secure Attendance QR" className="w-[240px] h-[240px] object-contain mx-auto" />
            </div>
            
            <div>
              <span className="inline-block bg-primary/10 border border-primary/20 text-primary py-1.5 px-6 rounded-full text-xs font-black tracking-wide">
                📍 کۆگا: {warehouse?.name}
              </span>
            </div>
          </div>
        ) : (
          <div className="my-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-400">ئامادەکردنی بارکۆدی پارێزراو...</p>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-200/50 flex items-center justify-center gap-2 text-slate-700 text-lg font-black tracking-widest num-font">
          <MonitorPlay className="w-5 h-5 text-slate-400" />
          <span>{timeStr || '00:00:00'}</span>
        </div>

      </Card>
    </div>
  );
}
