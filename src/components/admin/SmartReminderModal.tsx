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
  Bot,
  Send,
  Users,
  Moon,
  ChevronLeft
} from 'lucide-react';
import type { ShiftReminderType, ShiftReminderTemplates } from '@/lib/telegram/shift-reminder-service';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartReminderModal({ isOpen, onClose }: SmartReminderModalProps) {
  // Navigation tabs: 'testing' | 'editor' | 'shifts'
  const [activeView, setActiveView] = useState<'testing' | 'editor' | 'shifts'>('testing');
  
  // Active message editor subtab: 'morning_start' | 'morning_end' | 'evening_start' | 'evening_end'
  const [activeMessageTab, setActiveMessageTab] = useState<'morning_start' | 'morning_end' | 'evening_start' | 'evening_end'>('morning_start');

  // Templates state
  const [morningStartText, setMorningStartText] = useState('');
  const [morningEndText, setMorningEndText] = useState('');
  const [eveningStartText, setEveningStartText] = useState('');
  const [eveningEndText, setEveningEndText] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Employee shifts state
  const [employeeShifts, setEmployeeShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [savingShiftEmpId, setSavingShiftEmpId] = useState<string | null>(null);

  // Testing & dispatch state
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [actionType, setActionType] = useState<ShiftReminderType>('morning_start');
  const [testBypass, setTestBypass] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Load templates & employees on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadData() {
      setLoadingTemplates(true);
      setLoadingShifts(true);
      setTemplateError(null);

      try {
        // 1. Load templates
        const tRes = await fetch('/api/cron/shift-reminders?action=templates');
        const tData = await tRes.json();
        if (isMounted && tData.success && tData.templates) {
          setMorningStartText(tData.templates.morningMessage || '');
          setMorningEndText(tData.templates.morningEndMessage || tData.templates.eveningMessage || '');
          setEveningStartText(tData.templates.eveningShiftStartMessage || '');
          setEveningEndText(tData.templates.eveningShiftEndMessage || '');
        }

        // 2. Load employee shifts
        const sRes = await fetch('/api/cron/shift-reminders?action=employee_shifts');
        const sData = await sRes.json();
        if (isMounted && sData.success && Array.isArray(sData.employees)) {
          setEmployeeShifts(sData.employees);
        }
      } catch (err: any) {
        if (isMounted) {
          setTemplateError('نەتوانرا زانیارییەکان لە سێرڤەر باربکرێت');
        }
      } finally {
        if (isMounted) {
          setLoadingTemplates(false);
          setLoadingShifts(false);
        }
      }
    }

    loadData();

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
            morningMessage: morningStartText,
            morningEndMessage: morningEndText,
            eveningMessage: morningEndText,
            eveningShiftStartMessage: eveningStartText,
            eveningShiftEndMessage: eveningEndText,
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
        setMorningStartText(data.templates.morningMessage || '');
        setMorningEndText(data.templates.morningEndMessage || data.templates.eveningMessage || '');
        setEveningStartText(data.templates.eveningShiftStartMessage || '');
        setEveningEndText(data.templates.eveningShiftEndMessage || '');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setTemplateError(err.message || 'هەڵە لە گەڕاندنەوە');
    } finally {
      setSavingTemplates(false);
    }
  };

  // Change employee shift assignment (Morning vs Evening)
  const handleToggleEmployeeShift = async (employeeId: string, targetShift: 'morning' | 'evening') => {
    setSavingShiftEmpId(employeeId);
    try {
      const res = await fetch('/api/cron/shift-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_employee_shift',
          employeeId,
          shiftType: targetShift,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmployeeShifts(prev => prev.map(emp => 
          emp.employeeId === employeeId ? { ...emp, shiftType: targetShift } : emp
        ));
      } else {
        alert(data.error || 'نەتوانرا شفتەکە بگۆڕدرێت');
      }
    } catch (err) {
      alert('هەڵە لە پەیوەندی');
    } finally {
      setSavingShiftEmpId(null);
    }
  };

  // Insert tag into active textarea
  const handleInsertTag = (tag: string) => {
    switch (activeMessageTab) {
      case 'morning_start': setMorningStartText(prev => prev + tag); break;
      case 'morning_end': setMorningEndText(prev => prev + tag); break;
      case 'evening_start': setEveningStartText(prev => prev + tag); break;
      case 'evening_end': setEveningEndText(prev => prev + tag); break;
    }
  };

  // Trigger test dispatch
  const handleTriggerTest = async (type: ShiftReminderType) => {
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

  // Current active text for the editor
  const getCurrentText = () => {
    switch (activeMessageTab) {
      case 'morning_start': return morningStartText;
      case 'morning_end': return morningEndText;
      case 'evening_start': return eveningStartText;
      case 'evening_end': return eveningEndText;
    }
  };

  const setCurrentText = (val: string) => {
    switch (activeMessageTab) {
      case 'morning_start': setMorningStartText(val); break;
      case 'morning_end': setMorningEndText(val); break;
      case 'evening_start': setEveningStartText(val); break;
      case 'evening_end': setEveningEndText(val); break;
    }
  };

  const currentText = getCurrentText();
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
                  دوو شفت (٨-٥ و ٣-١١)
                </span>
              </div>
              <p className="text-xs text-white/90 mt-0.5">
                ناردنی ئاگاداری ١٥ خولەک پێش دەوام و پێش تەواوبوون بەپێی شفتی کارمەند
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

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 sm:px-6 py-2.5 shrink-0 gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveView('testing')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'testing'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span>خشتە و تاقیکردنەوە</span>
            </button>

            <button
              onClick={() => setActiveView('editor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'editor'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-500" />
              <span>دەستکاریکردنی پەیامەکان (٤ پەیام)</span>
            </button>

            <button
              onClick={() => setActiveView('shifts')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === 'shifts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>شفتـی کارمەندان (دیاریکردن)</span>
            </button>
          </div>

          {/* Quick indicator */}
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>07:45 | 14:45 | 16:45 | 22:45</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          
          {/* ======================================================== */}
          {/* VIEW 1: TESTING, SCHEDULES & LIVE DISPATCH               */}
          {/* ======================================================== */}
          {activeView === 'testing' && (
            <div className="space-y-4">
              
              {/* 4 Shift Schedule Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* 1. Morning Shift Start */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>١. دەستپێکی بەیانیان (٠٧:٤٥ AM)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-mono">١٥ خولەک پێش ٠٨:٠٠</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        بۆ کارمەندانی شفتـی <b>(٨ بۆ ٥)</b>. پەیامی بەیانی باش و دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerTest('morning_start')}
                    disabled={dispatchLoading}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'morning_start' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>تاقیکردنەوەی ئەم ئاگادارییە</span>
                  </button>
                </div>

                {/* 2. Morning Shift End */}
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/30">
                      <Sunset className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>٢. کۆتایی بەیانیان (٠٤:٤٥ PM)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 font-mono">١٥ خولەک پێش ٠٥:٠٠</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        بۆ کارمەندانی شفتـی <b>(٨ بۆ ٥)</b>. پەیامی دەستخۆشی و بیرخستنەوەی دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerTest('morning_end')}
                    disabled={dispatchLoading}
                    className="w-full py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'morning_end' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>تاقیکردنەوەی ئەم ئاگادارییە</span>
                  </button>
                </div>

                {/* 3. Evening Shift Start (3-11) */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>٣. دەستپێکی ئێواران (٠٢:٤٥ PM / 14:45)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-200 text-indigo-900 font-mono">١٥ خولەک پێش ٠٣:٠٠</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        بۆ کارمەندانی شفتـی <b>(٣ بۆ ١١)</b>. بەخێرهاتنی شفتـی ئێوارە و دوگمەی <b>[🟢 تۆمارکردنی هاتن]</b>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerTest('evening_start')}
                    disabled={dispatchLoading}
                    className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'evening_start' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>تاقیکردنەوەی ئەم ئاگادارییە</span>
                  </button>
                </div>

                {/* 4. Evening Shift End (3-11) */}
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-col justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-600/30">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                        <span>٤. کۆتایی ئێواران (١٠:٤٥ PM / 22:45)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-200 text-purple-900 font-mono">١٥ خولەک پێش ١١:٠٠</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        بۆ کارمەندانی شفتـی <b>(٣ بۆ ١١)</b>. دەستخۆشی و بیرخستنەوەی دوگمەی <b>[🔴 تۆمارکردنی دەرچوون]</b>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTriggerTest('evening_end')}
                    disabled={dispatchLoading}
                    className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {dispatchLoading && actionType === 'evening_end' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>تاقیکردنەوەی ئەم ئاگادارییە</span>
                  </button>
                </div>

              </div>

              {/* Bypass Checkbox */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] font-bold text-slate-700">دۆخی تاقیکردنەوە (Test Mode):</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <input 
                    type="checkbox"
                    checked={testBypass}
                    onChange={(e) => setTestBypass(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>ناردن تەنانەت ئەگەر هەینی/پشووش بێت (بۆ تاقیکردنەوە)</span>
                </label>
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
                        ئاگاداری بە سەرکەوتوویی تاقیکرایەوە!
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

          {/* ======================================================== */}
          {/* VIEW 2: TEMPLATE MESSAGE EDITOR (4 MESSAGES)             */}
          {/* ======================================================== */}
          {activeView === 'editor' && (
            <div className="space-y-4">
              
              {/* Sub-tab: 4 Shift Message options */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={() => setActiveMessageTab('morning_start')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'morning_start'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>بەیانیان (07:45)</span>
                  </button>

                  <button
                    onClick={() => setActiveMessageTab('morning_end')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'morning_end'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sunset className="w-3.5 h-3.5" />
                    <span>دەرچوونی ٨-٥ (04:45)</span>
                  </button>

                  <button
                    onClick={() => setActiveMessageTab('evening_start')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'evening_start'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>هاتنی ٣-١١ (02:45)</span>
                  </button>

                  <button
                    onClick={() => setActiveMessageTab('evening_end')}
                    className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      activeMessageTab === 'evening_end'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>دەرچوونی ٣-١١ (10:45)</span>
                  </button>
                </div>

                {/* Reset button */}
                <button
                  onClick={handleResetToDefault}
                  disabled={savingTemplates || loadingTemplates}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-white cursor-pointer transition-all disabled:opacity-50"
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
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-amber-700 hover:bg-amber-50 font-mono text-[11px] font-bold cursor-pointer"
                >
                  + &#123;name&#125; (ناوی کارمەند)
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('<b>تۆخ</b>')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[11px] cursor-pointer"
                >
                  + &lt;b&gt;تۆخ&lt;/b&gt;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('<i>لار</i>')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 italic text-[11px] cursor-pointer"
                >
                  + &lt;i&gt;لار&lt;/i&gt;
                </button>

                <button
                  type="button"
                  onClick={() => handleInsertTag('🏢 کۆمپانیای ئاشڵی بۆ مۆبیلیات')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] cursor-pointer"
                >
                  + 🏢 ناوی کۆمپانیا
                </button>
              </div>

              {/* Textarea + Telegram Live Preview Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Textarea */}
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
                    onChange={(e) => setCurrentText(e.target.value)}
                    placeholder="دەقی ئاگادارییەکە لێرە بنووسە..."
                    className="w-full flex-1 p-3.5 rounded-2xl bg-white border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-xs font-sans leading-relaxed text-slate-900 transition-all resize-y min-h-[250px]"
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
                  <div className="flex-1 p-4 rounded-2xl bg-[#efeae2] border border-slate-300/80 shadow-inner flex flex-col justify-between min-h-[250px]">
                    
                    {/* Bot header */}
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b border-black/5">
                      <div className="w-7 h-7 rounded-full bg-[#3390ec] text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-800">Ashley Attendance Bot</div>
                        <div className="text-[9px] text-slate-500">
                          {activeMessageTab === 'morning_start' ? '07:45 AM' : 
                           activeMessageTab === 'morning_end' ? '04:45 PM' : 
                           activeMessageTab === 'evening_start' ? '02:45 PM' : '10:45 PM'}
                        </div>
                      </div>
                    </div>

                    {/* Chat Bubble Message */}
                    <div className="bg-white p-3 rounded-2xl rounded-tr-xs shadow-xs text-[11px] leading-relaxed text-slate-900 border border-black/5 max-w-[95%] self-start" dir="rtl">
                      <div 
                        dangerouslySetInnerHTML={{ __html: previewHtml || '<span class="text-slate-400">دەق دیاری نەکراوە...</span>' }} 
                      />
                      <div className="text-left text-[9px] font-mono text-slate-400 mt-1 flex items-center justify-end gap-1">
                        <span>✓✓</span>
                      </div>
                    </div>

                    {/* Bottom Dynamic Reply Keyboard */}
                    <div className="pt-3 mt-3 border-t border-black/10">
                      <div className="text-[9px] font-bold text-slate-500 mb-1.5 text-center">
                        دوگمەی خێرای تەلەگرام لەسەر مۆبایل:
                      </div>
                      {activeMessageTab === 'morning_start' || activeMessageTab === 'evening_start' ? (
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

              {/* Save Button */}
              <div className="pt-2 flex items-center justify-end">
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
                  <span>پاشەکەوتکردنی هەموو دەقەکان (Save Changes)</span>
                </button>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW 3: EMPLOYEE SHIFT ASSIGNMENT (8-5 vs 3-11)          */}
          {/* ======================================================== */}
          {activeView === 'shifts' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-slate-800 space-y-1">
                <h4 className="font-black text-xs flex items-center gap-1.5 text-indigo-950">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>دیاریکردنی شفتـی کارمەندان (بەیانیان ٨-٥ یان ئێواران ٣-١١)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  هەر کارمەندێک لێرە دیاری بکەیت، سیستەم تەنها لە کاتی تایبەت بە شفتەکەی خۆی ئاگاداری بۆ دەنێرێت (بەیانیان کاتژمێر 07:45 و 04:45، یان ئێواران کاتژمێر 02:45 و 10:45).
                </p>
              </div>

              {loadingShifts ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>خەریکی بارکردنی لیستی کارمەندانە...</span>
                </div>
              ) : employeeShifts.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  هیچ کارمەندێک بە تەلەگرام نەبەستراوەتەوە تا ئێستا
                </div>
              ) : (
                <div className="space-y-2">
                  {employeeShifts.map((emp) => {
                    const isEvening = emp.shiftType === 'evening';
                    const isSaving = savingShiftEmpId === emp.employeeId;

                    return (
                      <div
                        key={emp.employeeId}
                        className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white text-xs ${isEvening ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                            {isEvening ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                              <span>{emp.employeeName}</span>
                              <span className="text-[10px] font-mono text-slate-400">({emp.employeeId})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-mono">
                              <span>شفتـی ئێستا:</span>
                              <span className={`font-bold ${isEvening ? 'text-indigo-600' : 'text-amber-600'}`}>
                                {isEvening ? '🌙 ئێواران (٣ بۆ ١١)' : '☀️ بەیانیان (٨ بۆ ٥)'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Shift Toggle Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleToggleEmployeeShift(emp.employeeId, 'morning')}
                            disabled={isSaving || !isEvening}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                              !isEvening
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                          >
                            ☀️ بەیانیان (٨-٥)
                          </button>

                          <button
                            onClick={() => handleToggleEmployeeShift(emp.employeeId, 'evening')}
                            disabled={isSaving || isEvening}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                              isEvening
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                            }`}
                          >
                            🌙 ئێواران (٣-١١)
                          </button>

                          {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400 mr-1" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 sm:px-6 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>خشتە: 07:45 | 14:45 | 16:45 | 22:45 (Vercel Cron + GitHub Actions)</span>
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
