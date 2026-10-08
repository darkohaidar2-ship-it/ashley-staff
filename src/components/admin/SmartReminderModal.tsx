'use client';

import React, { useState } from 'react';
import { 
  X, 
  Sun, 
  Sunset, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  Sparkles, 
  CalendarOff, 
  Palmtree, 
  Clock, 
  Check, 
  Users,
  ShieldCheck
} from 'lucide-react';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartReminderModal({ isOpen, onClose }: SmartReminderModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'morning' | 'evening'>('morning');
  const [testBypass, setTestBypass] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTrigger = async (type: 'morning' | 'evening') => {
    setLoading(true);
    setError(null);
    setResult(null);
    setActionType(type);

    try {
      const res = await fetch('/api/cron/shift-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          testMode: testBypass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'هەڵە لە ناردنی ئاگاداری');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'پەیوەندی لەگەڵ سێرڤەر نەبەسترا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xs">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">ئاگاداری زیرەکی دەوام (تەلەگرام)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 border border-white/30 font-bold">
                  ئۆتۆماتیک
                </span>
              </div>
              <p className="text-xs text-white/90 mt-0.5">
                ناردنی پەیامی هاندان و ورەبەرزکردنەوە پێش دەوام بەبێ هەینی و پشووەکان
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Schedule Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Morning Card */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <span>بەیانیان (٠٧:٤٥ AM)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-mono">١٥ خولەک پێش دەوام</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  پەیامی بەیانی باش و بەرزکردنەوەی ورە لەگەڵ دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b>. ئەگەر پێشتر دەوامی کردبێت ناڕوات.
                </p>
              </div>
            </div>

            {/* Evening Card */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
                <Sunset className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <span>ئێواران (٠٤:٤٥ PM)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-200/80 text-indigo-900 font-mono">١٥ خولەک پێش تەواوبوون</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  پەیامی دەستخۆشی ماندووبوون و بیرخستنەوەی دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b> پێش بەجێهێشتنی کارگە.
                </p>
              </div>
            </div>
          </div>

          {/* 4 Smart Rules */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <h4 className="font-black text-slate-800 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>٤ مەرجە زیرەکەکە کە سیستەم پێش ناردن دەیپشکنێت:</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span><b>هەینی ناڕوات:</b> پشووی فەرمیی هەفتانەیە.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span><b>پشووی کۆمپانیا:</b> ئەگەر کرابێت بە پشوو ناڕوات.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span><b>ئەوانەی لە مۆڵەتدان:</b> نامەیان بۆ ناڕوات.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span><b>تۆماری پێشوەختە:</b> کەسێک هاتنی تۆمارکردبێت بێزار ناکرێت.</span>
              </div>
            </div>
          </div>

          {/* Test Controls */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>تاقیکردنەوەی دەستبەجێ لەسەر تەلەگرام (Live Test)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  دەتوانیت هەر ئێستا بە یەک کلیک تاقی بکەیتەوە و پەیامی هاندان بنێریت بۆ کارمەندان
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-sky-200 shadow-2xs">
                <input 
                  type="checkbox"
                  checked={testBypass}
                  onChange={(e) => setTestBypass(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
                />
                <span>تێستی ڕاستەوخۆ (تەنانەت ئەگەر هەینی/پشووش بێت)</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => handleTrigger('morning')}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && actionType === 'morning' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <span>تاقیکردنەوەی ئاگاداری بەیانیان (07:45 AM)</span>
              </button>

              <button
                onClick={() => handleTrigger('evening')}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && actionType === 'evening' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sunset className="w-4 h-4" />
                )}
                <span>تاقیکردنەوەی ئاگاداری ئێواران (04:45 PM)</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Test Results Display */}
          {result && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-black text-emerald-900 text-xs">
                    ئاگاداری بە سەرکەوتوویی نێردرا!
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono font-bold text-xs">
                  <span className="text-emerald-700">نێردرا: {result.sentCount}</span>
                  <span className="text-slate-500">لادرا: {result.skippedCount}</span>
                </div>
              </div>

              {/* Details table */}
              {result.details && result.details.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-xl border border-emerald-200/60">
                  {result.details.map((d: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${d.status === 'sent' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="font-bold text-slate-800">{d.employeeName}</span>
                      </div>
                      <span className={`text-[10px] font-mono ${d.status === 'sent' ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                        {d.status === 'sent' ? '✅ نێردرا' : `لادرا (${d.reason || ''})`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>خشتە: ڕۆژانە 07:45 AM و 04:45 PM (Vercel Cron)</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer transition-all"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
