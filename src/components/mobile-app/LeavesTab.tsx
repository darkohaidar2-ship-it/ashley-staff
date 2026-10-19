'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X,
  Send,
  Sparkles
} from 'lucide-react';
import { MobileAuthUser } from './types';

interface LeavesTabProps {
  user: MobileAuthUser;
  isDark?: boolean;
}

interface LeaveItem {
  id: string;
  details: string;
  targetDate: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  adminNote?: string;
}

const LEAVE_REASONS = [
  '🏥 باری تەندروستی / نەخۆشی',
  '🏠 کاری بەپەلەی خێزانی',
  '🚗 تێکچوونی ئۆتۆمبێل / هاتوچۆ',
  '🏢 کاروباری کارگێڕی و فەرمی',
  '📝 هۆکاری کەسی',
];

export function LeavesTab({ user, isDark = false }: LeavesTabProps) {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form State
  const [leaveType, setLeaveType] = useState<'hourly' | 'daily'>('daily');
  const [dateChoice, setDateChoice] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [customDate, setCustomDate] = useState('');
  const [selectedReason, setSelectedReason] = useState(LEAVE_REASONS[0]);
  const [notesInput, setNotesInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mobile/leave?employeeId=${encodeURIComponent(user.employeeId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.leaves)) {
        setLeaves(data.leaves);
      }
    } catch (err) {
      console.error('[LeavesTab] Error loading leaves:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [user.employeeId]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetDate = '';
    const now = new Date();
    if (dateChoice === 'today') {
      targetDate = now.toISOString().slice(0, 10);
    } else if (dateChoice === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      targetDate = tomorrow.toISOString().slice(0, 10);
    } else {
      targetDate = customDate;
      if (!targetDate) {
        setFeedback({ type: 'error', message: 'تکایە بەرواری دیاریکراو بنووسە' });
        return;
      }
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/mobile/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.employeeId,
          employeeName: user.employeeName,
          leaveType,
          targetDate,
          reason: selectedReason,
          notes: notesInput.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: 'success', message: 'داواکاری مۆڵەتەکەت بە سەرکەوتوویی نێردرا بۆ بەڕێوەبەرایەتی.' });
        setNotesInput('');
        setShowCreateForm(false);
        loadLeaves();
      } else {
        setFeedback({ type: 'error', message: data.error || 'هەڵەیەک ڕوویدا لە تۆمارکردنی مۆڵەت' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'هەڵەی پەیوەندی بە سێرڤەر' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-black flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            <span>🌴</span> داواکردنی مۆڵەت
          </h2>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            تۆمارکردنی مۆڵەتی کاتژمێری یان ڕۆژانە
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setFeedback(null);
          }}
          className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>مۆڵەتی نوێ</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Leave Creation Form */}
      {showCreateForm && (
        <form onSubmit={handleSubmitLeave} className={`border rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5 ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200/80 dark:border-slate-800">
            <h3 className="text-xs font-black flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              داواکاری مۆڵەتی فەرمی
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Leave Type Selector */}
          <div>
            <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              جۆری مۆڵەت:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLeaveType('daily')}
                className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  leaveType === 'daily'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isDark 
                      ? 'bg-slate-950 text-slate-300 border-slate-700' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                📅 مۆڵەتی ڕۆژانە
              </button>
              <button
                type="button"
                onClick={() => setLeaveType('hourly')}
                className={`h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  leaveType === 'hourly'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : isDark 
                      ? 'bg-slate-950 text-slate-300 border-slate-700' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🕒 مۆڵەتی کاتی (کاتژمێری)
              </button>
            </div>
          </div>

          {/* Target Date Selector */}
          <div>
            <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              بەرواری مۆڵەت:
            </label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setDateChoice('today')}
                className={`h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  dateChoice === 'today'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    : isDark 
                      ? 'bg-slate-950 text-slate-300 border-slate-700' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ئەمڕۆ
              </button>
              <button
                type="button"
                onClick={() => setDateChoice('tomorrow')}
                className={`h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  dateChoice === 'tomorrow'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    : isDark 
                      ? 'bg-slate-950 text-slate-300 border-slate-700' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                بەیانی
              </button>
              <button
                type="button"
                onClick={() => setDateChoice('custom')}
                className={`h-9 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  dateChoice === 'custom'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    : isDark 
                      ? 'bg-slate-950 text-slate-300 border-slate-700' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                بەرواری تر
              </button>
            </div>

            {dateChoice === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className={`w-full h-11 border rounded-xl px-3 text-xs font-mono outline-none transition-colors ${
                  isDark 
                    ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-400' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                }`}
                required
              />
            )}
          </div>

          {/* Reason Chips */}
          <div>
            <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              هۆکاری سەرەکی:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LEAVE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    selectedReason === r
                      ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
                      : isDark 
                        ? 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className={`block text-[11px] font-bold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              تێبینی و ڕوونکردنەوەی زیاتر:
            </label>
            <textarea
              rows={2}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="بۆ نموونە: لە کاتژمێر ٢ تا ٤ پاشنیوەڕۆ بۆ سەردانی پزیشک..."
              className={`w-full border rounded-xl p-3 text-xs outline-none transition-colors ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-white focus:border-emerald-400 placeholder:text-slate-600' 
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ناردنی داواکاری مۆڵەت</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className={`px-4 h-11 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              داخستن
            </button>
          </div>
        </form>
      )}

      {/* Leaves History */}
      <div className="space-y-2">
        <h3 className={`text-xs font-bold px-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          مێژووی داواکارییەکانی مۆڵەت
        </h3>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-xs font-bold">بارکردنی داواکارییەکان...</span>
          </div>
        ) : leaves.length === 0 ? (
          <div className={`py-12 border rounded-3xl text-center text-xs ${
            isDark 
              ? 'bg-slate-900/40 border-slate-800 text-slate-500' 
              : 'bg-white border-slate-200 text-slate-400'
          }`}>
            هیچ مۆڵەتێک تۆمار نەکراوە تا ئێستا.
          </div>
        ) : (
          leaves.map((leave) => (
            <div
              key={leave.id}
              className={`p-3.5 border rounded-2xl shadow-xs flex items-start justify-between gap-3 ${
                isDark 
                  ? 'bg-slate-900/90 border-slate-800 text-white' 
                  : 'bg-white border-slate-200/90 text-slate-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-emerald-400' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black font-mono" dir="ltr">
                      📅 {leave.targetDate}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {leave.details}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                {leave.status === 'approved' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xl">
                    <CheckCircle2 className="w-3 h-3" />
                    پەسەندکراو
                  </span>
                ) : leave.status === 'rejected' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                    <X className="w-3 h-3" />
                    ڕەتکراوە
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-xl">
                    <Clock className="w-3 h-3" />
                    چاوەڕوان
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
