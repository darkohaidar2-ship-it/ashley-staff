'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sun, 
  Sunset, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  Clock, 
  Check, 
  ShieldCheck,
  Edit3,
  Save,
  RotateCcw,
  Eye,
  MessageSquare,
  Bot,
  Send,
  SlidersHorizontal,
  ChevronLeft
} from 'lucide-react';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartReminderModal({ isOpen, onClose }: SmartReminderModalProps) {
  // Navigation tabs
  const [activeView, setActiveView] = useState<'editor' | 'testing'>('editor');
  const [activeMessageTab, setActiveMessageTab] = useState<'morning' | 'evening'>('morning');

  // Templates state
  const [morningText, setMorningText] = useState('');
  const [eveningText, setEveningText] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Testing & dispatch state
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [actionType, setActionType] = useState<'morning' | 'evening'>('morning');
  const [testBypass, setTestBypass] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Load templates whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadTemplates() {
      setLoadingTemplates(true);
      setTemplateError(null);
      try {
        const res = await fetch('/api/cron/shift-reminders?action=templates');
        const data = await res.json();
        if (isMounted && data.success && data.templates) {
          setMorningText(data.templates.morningMessage || '');
          setEveningText(data.templates.eveningMessage || '');
        }
      } catch (err: any) {
        if (isMounted) {
          setTemplateError('نەتوانرا دەقەکانی ئێستا لە سێرڤەر باربکرێت');
        }
      } finally {
        if (isMounted) setLoadingTemplates(false);
      }
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Save current template edits
  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    setTemplateError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/cron/shift-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_templates',
          templates: {
            morningMessage: morningText,
            eveningMessage: eveningText,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'پاشەکەوتکردن سەرکەوتوو نەبوو');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setTemplateError(err.message || 'هەڵە لە پاشەکەوتکردنی دەقەکان');
    } finally {
      setSavingTemplates(false);
    }
  };

  // Reset to system default templates
  const handleResetToDefault = async () => {
    if (!window.confirm('ئایا دڵنیایت لە گەڕاندنەوەی دەقەکان بۆ دەقی فەرمی و بنەڕەتی سیستەم؟')) {
      return;
    }

    setSavingTemplates(true);
    setTemplateError(null);

    try {
      const res = await fetch('/api/cron/shift-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_templates' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'هەڵە لە گەڕاندنەوەی دەقەکان');
      }

      if (data.templates) {
        setMorningText(data.templates.morningMessage || '');
        setEveningText(data.templates.eveningMessage || '');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setTemplateError(err.message || 'هەڵە لە گەڕاندنەوە');
    } finally {
      setSavingTemplates(false);
    }
  };

  // Insert tag into active textarea
  const handleInsertTag = (tag: string) => {
    if (activeMessageTab === 'morning') {
      setMorningText(prev => prev + tag);
    } else {
      setEveningText(prev => prev + tag);
    }
  };

  // Trigger test dispatch
  const handleTriggerTest = async (type: 'morning' | 'evening') => {
    setDispatchLoading(true);
    setDispatchError(null);
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
      setDispatchError(err.message || 'پەیوەندی لەگەڵ سێرڤەر نەبەسترا');
    } finally {
      setDispatchLoading(false);
    }
  };

  // Convert HTML markup to preview safe text
  const currentText = activeMessageTab === 'morning' ? morningText : eveningText;
  const previewHtml = currentText
    ? currentText
        .replace(/\{name\}/g, '<b>کاک ئارام (نموونە)</b>')
        .replace(/\n/g, '<br/>')
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-4 sm:px-6 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xs">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">ئاگاداری زیرەکی دەوام (تەلەگرام)</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 border border-white/30 font-bold">
                  خۆکار + دەستکاریکردن
                </span>
              </div>
              <p className="text-xs text-white/90 mt-0.5">
                ناردنی پەیامی هاندان و ورەبەرزکردنەوە پێش دەوام بە کاتی هەولێر و بەغدا
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer"
            title="داخستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Editor vs Testing) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-2.5 shrink-0 gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl">
            <button
              onClick={() => setActiveView('editor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'editor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-500" />
              <span>دەستکاریکردنی دەقی پەیامەکان</span>
            </button>

            <button
              onClick={() => setActiveView('testing')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'testing'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>تاقیکردنەوە و خشتەی کاتەکان</span>
            </button>
          </div>

          {/* Status badge */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>بەیانیان 07:45 AM • ئێواران 04:45 PM</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* ======================================================== */}
          {/* VIEW 1: TEMPLATE MESSAGE EDITOR                         */}
          {/* ======================================================== */}
          {activeView === 'editor' && (
            <div className="space-y-4">
              
              {/* Sub-tab: Morning vs Evening Message selector */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveMessageTab('morning')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'morning'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>پەیامی بەیانیان (07:45 AM)</span>
                  </button>

                  <button
                    onClick={() => setActiveMessageTab('evening')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'evening'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25 ring-2 ring-indigo-200'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sunset className="w-4 h-4" />
                    <span>پەیامی ئێواران (04:45 PM)</span>
                  </button>
                </div>

                {/* Reset to defaults button */}
                <button
                  onClick={handleResetToDefault}
                  disabled={savingTemplates || loadingTemplates}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-white cursor-pointer transition-all disabled:opacity-50"
                  title="گەڕاندنەوە بۆ دەقی بنەڕەتی سیستم"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>گەڕاندنەوە بۆ دەقی بنەڕەتی</span>
                </button>
              </div>

              {/* Tag Quick Insert Bar */}
              <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-600 ml-1">کۆدی خێرا:</span>
                
                <button
                  type="button"
                  onClick={() => handleInsertTag(' {name} ')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                  title="ناوی کارمەند بە شێوەی خۆکار دادەنێت"
                >
                  + &#123;name&#125; (ناوی کارمەند)
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('<b>تۆخ</b>')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[11px] cursor-pointer transition-colors shadow-2xs"
                >
                  + &lt;b&gt;تۆخ&lt;/b&gt;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('<i>لار</i>')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 italic text-[11px] cursor-pointer transition-colors shadow-2xs"
                >
                  + &lt;i&gt;لار&lt;/i&gt;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('🏢 کۆمپانیای ئاشڵی بۆ مۆبیلیات')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] cursor-pointer transition-colors shadow-2xs"
                >
                  + 🏢 ناوی کۆمپانیا
                </button>
              </div>

              {/* Editor + Live Telegram Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Textarea Editor */}
                <div className="space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>دەقی نامەکە بنووسە:</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {currentText.length} پیت
                    </span>
                  </div>

                  <textarea
                    rows={12}
                    value={currentText}
                    onChange={(e) => {
                      if (activeMessageTab === 'morning') {
                        setMorningText(e.target.value);
                      } else {
                        setEveningText(e.target.value);
                      }
                    }}
                    placeholder="دەقی ئاگادارییەکە لێرە بنووسە..."
                    className="w-full flex-1 p-3.5 rounded-2xl bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-xs font-sans leading-relaxed text-slate-900 transition-all resize-y min-h-[260px]"
                    dir="rtl"
                  />
                  <p className="text-[10px] text-slate-500 leading-normal">
                    💡 تێبینی: بەکارهێنانی <b>&#123;name&#125;</b> وادەکات سیستەم ناوی ڕاستەقینەی هەموو کارمەندێک بە جیا بنێرێت بۆ تەلەگرامەکەی.
                  </p>
                </div>

                {/* Telegram Live Preview */}
                <div className="space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                      <span>شێوازی دەرکەوتن لە تەلەگرامی کارمەند:</span>
                    </label>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-bold">
                      پێشبینینی ڕاستەوخۆ
                    </span>
                  </div>

                  {/* Telegram Bubble Mockup */}
                  <div className="flex-1 p-4 rounded-2xl bg-[#efeae2] border border-slate-300/80 shadow-inner flex flex-col justify-between min-h-[260px]">
                    
                    {/* Bot header inside telegram */}
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-black/5">
                      <div className="w-7 h-7 rounded-full bg-[#3390ec] text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-800">Ashley Attendance Bot</div>
                        <div className="text-[9px] text-slate-500">
                          {activeMessageTab === 'morning' ? '07:45 AM' : '04:45 PM'}
                        </div>
                      </div>
                    </div>

                    {/* Chat Bubble Message */}
                    <div className="bg-white p-3 rounded-2xl rounded-tr-xs shadow-xs text-[11px] leading-relaxed text-slate-900 border border-black/5 max-w-[95%] self-start" dir="rtl">
                      <div 
                        dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="text-slate-400">دەق دیاری نەکراوە...</span>' }} 
                      />
                      <div className="text-left text-[9px] font-mono text-slate-400 mt-1 flex items-center justify-end gap-1">
                        <span>{activeMessageTab === 'morning' ? '07:45' : '16:45'}</span>
                        <span>✓✓</span>
                      </div>
                    </div>

                    {/* Bottom Dynamic Telegram Keyboard Mockup */}
                    <div className="pt-3 mt-3 border-t border-black/10">
                      <div className="text-[9px] font-bold text-slate-500 mb-1.5 text-center">
                        دوگمەی خێرای تەلەگرام لەسەر مۆبایل:
                      </div>
                      {activeMessageTab === 'morning' ? (
                        <div className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-center text-[11px] shadow-sm">
                          🟢 تۆمارکردنی هاتن
                        </div>
                      ) : (
                        <div className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-black text-center text-[11px] shadow-sm">
                          🔴 تۆمارکردنی دەرچوون
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Feedback messages */}
              {saveSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-bold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>دەستکارییەکان بە سەرکەوتوویی لە داتابەیس پاشەکەوت کران! لەمەودوا ئەم دەقە نوێیە بۆ کارمەندان دەڕوات.</span>
                </div>
              )}

              {templateError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{templateError}</span>
                </div>
              )}

              {/* Action Save Bar */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                <button
                  onClick={() => {
                    setActiveView('testing');
                    setActionType(activeMessageTab);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>تاقیکردنەوەی ناردنی ئەم پەیامە ئێستا</span>
                </button>

                <button
                  onClick={handleSaveTemplates}
                  disabled={savingTemplates || loadingTemplates}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingTemplates ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>پاشەکەوتکردنی دەقەکان (Save Changes)</span>
                </button>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 2: TESTING, SCHEDULE & MONITORING                   */}
          {/* ======================================================== */}
          {activeView === 'testing' && (
            <div className="space-y-4">
              
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
                    onClick={() => handleTriggerTest('morning')}
                    disabled={dispatchLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'morning' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                    <span>تاقیکردنەوەی ئاگاداری بەیانیان (07:45 AM)</span>
                  </button>

                  <button
                    onClick={() => handleTriggerTest('evening')}
                    disabled={dispatchLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'evening' ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sunset className="w-4 h-4" />
                    )}
                    <span>تاقیکردنەوەی ئاگاداری ئێواران (04:45 PM)</span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {dispatchError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{dispatchError}</span>
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
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 sm:px-6 text-xs text-slate-500 shrink-0">
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
