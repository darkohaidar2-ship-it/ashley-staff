'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { UnifiedAttendanceDayInfo } from '@/lib/attendance-helpers';

interface MobileDayDetailModalProps {
  selectedDayDetail: (UnifiedAttendanceDayInfo & { dateStr: string; dayNum?: number; dayNameKu: string }) | null;
  onClose: () => void;
}

export function MobileDayDetailModal({
  selectedDayDetail,
  onClose,
}: MobileDayDetailModalProps) {
  if (!selectedDayDetail) return null;

  const cleanStr = (s?: any) => String(s || '').replace(/[🛡️📡⚠️🌴🟢🔴🟡🟣⏱️🏁📝]\s*/gu, '').trim();
  const empInNote = cleanStr(selectedDayDetail.checkInNote || selectedDayDetail.note);
  const empOutNote = cleanStr(selectedDayDetail.checkOutNote);
  const admNote = cleanStr(selectedDayDetail.adminNote || selectedDayDetail.adminCheckInNote || selectedDayDetail.adminCheckOutNote);
  const hasSeparateEmpNote = (empInNote && empInNote !== admNote) || (empOutNote && empOutNote !== admNote);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 p-5 rounded-3xl max-w-sm w-full space-y-4 text-right shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-black text-slate-900">
              ڕۆژی {selectedDayDetail.dayNameKu} ({selectedDayDetail.dateStr})
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">وردەکاری تۆماری سیستەم</span>
          </div>
          <div className="flex items-center gap-1.5">
            {selectedDayDetail.status === 'Present' && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                ئامادەبوو
              </span>
            )}
            {(selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب') && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                غیاب
              </span>
            )}
            {(selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت') && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                مۆڵەت
              </span>
            )}
            {(selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو') && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-300">
                پشوو
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center p-3 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block font-sans font-bold">هاتن</span>
            <span className="font-black text-emerald-700">
              {selectedDayDetail.status === 'Present' && selectedDayDetail.checkInTime
                ? selectedDayDetail.checkInTime
                : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                ? 'غیاب'
                : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                ? 'مۆڵەت'
                : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                ? 'پشوو'
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-sans font-bold">دەرچوون</span>
            <span className="font-black text-rose-700">
              {selectedDayDetail.status === 'Present' && selectedDayDetail.checkOutTime
                ? selectedDayDetail.checkOutTime
                : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                ? 'غیاب'
                : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                ? 'مۆڵەت'
                : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                ? 'پشوو'
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-sans font-bold">کاتژمێر</span>
            <span className="font-black text-blue-800">
              {selectedDayDetail.status === 'Present' && selectedDayDetail.workedHours > 0
                ? `${selectedDayDetail.workedHours} ک`
                : selectedDayDetail.status === 'Absent' || selectedDayDetail.status === 'غیاب'
                ? '0 ک'
                : selectedDayDetail.status === 'Leave' || selectedDayDetail.status === 'مۆڵەت'
                ? 'مۆڵەت'
                : selectedDayDetail.status === 'Holiday' || selectedDayDetail.status === 'پشوو'
                ? 'پشوو'
                : '—'}
            </span>
          </div>
        </div>

        {selectedDayDetail.status === 'Present' && (selectedDayDetail.isWaived || selectedDayDetail.checkInStatus?.isWaived || selectedDayDetail.checkOutStatus?.isWaived) && (
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
            <span>لێخۆشبوونی فەرمی بەڕێوەبەری هەیە</span>
          </div>
        )}

        <div className="space-y-2">
          {hasSeparateEmpNote && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-black text-slate-600 block">تێبینی کارمەند:</span>
              {empInNote && empInNote !== admNote && (
                <p className="text-xs font-bold text-slate-800 leading-relaxed">{empInNote}</p>
              )}
              {empOutNote && empOutNote !== empInNote && empOutNote !== admNote && (
                <p className="text-xs font-bold text-slate-800 leading-relaxed">{empOutNote}</p>
              )}
            </div>
          )}
          {admNote && (
            <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
              <span className="text-[10px] font-black text-blue-700 block">تێبینی ئەدمین:</span>
              <p className="text-xs font-bold text-slate-900 leading-relaxed">{admNote}</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer shadow-xs"
        >
          داخستن
        </button>
      </div>
    </div>
  );
}
