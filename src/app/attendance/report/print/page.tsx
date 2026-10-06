'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Printer, 
  ArrowRight, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Download,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { OfficialPrintHeader, OfficialPrintSignatures } from '@/components/reports/OfficialPrintHeader';
import { formatKurdishMonthName, getPreviousMonthStr, getNextMonthStr, MonthlyAttendanceStats } from '@/lib/attendance/report-helpers';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';
import { useAppContext } from '@/context/app-provider';

function AttendancePrintReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { settings } = useAppContext();

  const empParam = searchParams.get('emp') || 'emp-02';
  const monthParam = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const autoPrint = searchParams.get('auto') === '1' || searchParams.get('auto') === 'true';

  const [stats, setStats] = useState<MonthlyAttendanceStats | null>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/attendance/monthly-stats?emp=${encodeURIComponent(empParam)}&month=${encodeURIComponent(monthParam)}`);
        const json = await res.json();
        if (isMounted) {
          if (json.success) {
            setStats(json.stats);
            setEmployee(json.employee);
          } else {
            setError(json.error || 'نەتوانرا داتاکان باربکرێن');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'هەڵە لە پەیوەندی کردن بە سێرڤەر');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [empParam, monthParam]);

  useEffect(() => {
    if (!loading && stats && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [loading, stats, autoPrint]);

  const handleMonthChange = (newMonth: string) => {
    router.push(`/attendance/report/print?emp=${encodeURIComponent(empParam)}&month=${encodeURIComponent(newMonth)}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const kurdishMonthTitle = formatKurdishMonthName(monthParam);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900" dir="rtl">
      
      {/* 🌟 1. ACTION & CONTROL BAR (HIDDEN IN PRINT) */}
      <header className="no-print sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition flex items-center gap-1.5 text-xs font-bold"
              title="گەڕانەوە"
            >
              <ArrowRight className="w-4 h-4" />
              <span>گەڕانەوە</span>
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>چاپکردنی فەرمی ڕاپۆرتی دەوامی مانگانە</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                  {monthParam}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تایبەت بە چاپکردن (Print) و داگرتن بە شێوەی PDF بە فۆنتی کوردی و لۆگۆی فەرمی
              </p>
            </div>
          </div>

          {/* Month Selector & Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                onClick={() => handleMonthChange(getPreviousMonthStr(monthParam))}
                className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="مانگی پێشوو"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="px-3 font-bold text-slate-800 dark:text-slate-200">
                {kurdishMonthTitle}
              </span>
              <button
                onClick={() => handleMonthChange(getNextMonthStr(monthParam))}
                className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="مانگی دواتر"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-black text-xs shadow-md transition transform active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>چاپکردن (Print / Save PDF)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 🌟 2. REPORT CONTENT WRAPPER */}
      <main className="max-w-[210mm] mx-auto my-4 sm:my-8 bg-white text-slate-900 p-6 sm:p-10 shadow-xl border border-slate-200 rounded-xl print:m-0 print:p-4 print:border-none print:shadow-none print:rounded-none print:max-w-full">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-600">لە بارکردنی زانیارییەکانی دەوام و پسوولەی فەرمی...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-red-600">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p className="font-bold">{error}</p>
          </div>
        ) : stats ? (
          <>
            {/* 🌟 Official 3-Part Upper Letterhead Header (Diwan Logo on Right, Title in Center, Ashley Logo on Left) */}
            <OfficialPrintHeader
              title="کۆمپانیای مۆبیلیاتی ئاشڵی — ڕاپۆرتی فەرمی دەوامی مانگانە"
              period={`مانگی ${kurdishMonthTitle}`}
              documentCode={`ASH-ATT-${monthParam}`}
              settings={settings}
            />

            {/* 👤 EMPLOYEE INFO STRIP */}
            <div className="my-3 p-3 bg-slate-50 border border-slate-300 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {employee?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={employee.photoUrl}
                    alt={stats.employeeName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-300 shadow-sm"
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-black">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="text-sm sm:text-base font-black text-slate-900">
                    {employee?.fullName3Part || stats.employeeName}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                    کۆدی کارمەند: <span className="font-mono text-slate-800 font-bold">{stats.employeeId}</span> • بەش: {employee?.department || 'کۆگای سەرەکی و کارگە'}
                  </div>
                </div>
              </div>

              <div className="text-left font-mono text-[11px] text-slate-600">
                <div>کاتی دەرچوواندن: {new Date().toLocaleDateString('ku-IQ')}</div>
                <div className="text-emerald-700 font-black font-sans text-xs mt-0.5">
                  ڕێژەی ئامادەبوون: {stats.attendancePercent}%
                </div>
              </div>
            </div>

            {/* 📊 5 KPI SUMMARY BOXES */}
            <div className="grid grid-cols-5 gap-2 my-3 text-center">
              {/* Box 1: Hours & Percentage */}
              <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg">
                <span className="text-[10px] text-emerald-800 font-bold block">کۆی کاتژمێری کارکردن</span>
                <span className="text-sm sm:text-base font-black text-emerald-950 font-mono block mt-0.5">
                  {stats.totalWorkHoursStr}
                </span>
                <span className="text-[9.5px] font-bold text-emerald-700 mt-0.5 block">
                  ڕێژە: {stats.attendancePercent}%
                </span>
              </div>

              {/* Box 2: Present Days */}
              <div className="p-2 bg-blue-50 border border-blue-300 rounded-lg">
                <span className="text-[10px] text-blue-800 font-bold block">ڕۆژانی دەوام</span>
                <span className="text-sm sm:text-base font-black text-blue-950 font-mono block mt-0.5">
                  {stats.presentDays} <span className="text-xs text-blue-700">لە {stats.targetWorkingDays}</span>
                </span>
                <span className="text-[9.5px] font-bold text-blue-700 mt-0.5 block">
                  ئامادەبوونی فەرمی
                </span>
              </div>

              {/* Box 3: Overtime */}
              <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg">
                <span className="text-[10px] text-amber-800 font-bold block">ئۆڤەرتایم (ئیزافە)</span>
                <span className="text-sm sm:text-base font-black text-amber-950 font-mono block mt-0.5">
                  {stats.totalOvertimeStr}
                </span>
                <span className="text-[9.5px] font-bold text-amber-700 mt-0.5 block">
                  زیادە لە دەوام
                </span>
              </div>

              {/* Box 4: Late Minutes */}
              <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg">
                <span className="text-[10px] text-rose-800 font-bold block">کۆی دواکەوتن</span>
                <span className="text-sm sm:text-base font-black text-rose-950 font-mono block mt-0.5">
                  {stats.totalLateStr}
                </span>
                <span className="text-[9.5px] font-bold text-rose-700 mt-0.5 block">
                  درەنگ گەیشتن
                </span>
              </div>

              {/* Box 5: Leaves & Holidays */}
              <div className="p-2 bg-purple-50 border border-purple-300 rounded-lg">
                <span className="text-[10px] text-purple-800 font-bold block">مۆڵەت و پشوو</span>
                <span className="text-sm sm:text-base font-black text-purple-950 font-mono block mt-0.5">
                  {stats.leaveDays + stats.holidayDays} <span className="text-xs text-purple-700">ڕۆژ</span>
                </span>
                <span className="text-[9.5px] font-bold text-purple-700 mt-0.5 block">
                  مۆڵەت: {stats.leaveDays} | پشوو: {stats.holidayDays}
                </span>
              </div>
            </div>

            {/* 📋 COMPLETE DAILY ATTENDANCE TABLE */}
            <div className="my-3 overflow-hidden border border-slate-300 rounded-lg">
              <table className="w-full text-right text-[10.5px] border-collapse leading-tight">
                <thead>
                  <tr className="bg-slate-900 text-white font-black text-[11px]">
                    <th className="p-2 text-center w-8 border-l border-slate-700">#</th>
                    <th className="p-2 text-center w-24 border-l border-slate-700">ڕێکەوت</th>
                    <th className="p-2 text-center w-20 border-l border-slate-700">ڕۆژ</th>
                    <th className="p-2 text-center w-20 border-l border-slate-700">🟢 هاتن</th>
                    <th className="p-2 text-center w-20 border-l border-slate-700">🔴 دەرچوون</th>
                    <th className="p-2 text-center w-20 border-l border-slate-700">ماوەی کار</th>
                    <th className="p-2 text-center w-20 border-l border-slate-700">ئیزافە</th>
                    <th className="p-2 text-center w-16 border-l border-slate-700">دواکەوتن</th>
                    <th className="p-2 text-center w-20">دۆخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {stats.records.length > 0 ? (
                    stats.records.map((r, idx) => {
                      const isPresent = r.status === 'Present';
                      const isAbsent = r.status === 'Absent';
                      const isLeave = r.status === 'Leave';
                      const isHoliday = r.status === 'Holiday';

                      let rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80';
                      if (isHoliday) rowBg = 'bg-amber-50/40';
                      if (isLeave) rowBg = 'bg-blue-50/40';
                      if (isAbsent) rowBg = 'bg-rose-50/40';

                      return (
                        <tr key={r.date} className={`${rowBg} hover:bg-blue-50/50 transition`}>
                          <td className="p-1.5 text-center font-mono text-slate-500 border-l border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-slate-900 border-l border-slate-200">
                            {r.date}
                          </td>
                          <td className="p-1.5 text-center font-bold text-slate-700 border-l border-slate-200">
                            {r.dayName}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-emerald-700 border-l border-slate-200">
                            {r.checkIn ? r.checkIn : '—'}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-blue-700 border-l border-slate-200">
                            {r.checkOut ? r.checkOut : '—'}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-slate-800 border-l border-slate-200">
                            {r.durationStr || '—'}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-amber-700 border-l border-slate-200">
                            {r.overtimeMinutes > 0 ? `+${r.overtimeMinutes}خ` : '—'}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-rose-700 border-l border-slate-200">
                            {r.lateMinutes > 0 ? `${r.lateMinutes}خ` : '—'}
                          </td>
                          <td className="p-1.5 text-center">
                            {isPresent && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ئامادەبوو
                              </span>
                            )}
                            {isLeave && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                مۆڵەت
                              </span>
                            )}
                            {isHoliday && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                پشوو
                              </span>
                            )}
                            {isAbsent && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                غایب
                              </span>
                            )}
                            {!isPresent && !isLeave && !isHoliday && !isAbsent && (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                دەوام نەکراو
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                        هیچ تۆمارێکی دەوام لەم مانگەدا نەدۆزرایەوە
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ✍️ Official 3-Role Lower Signatures Strip (Ashley Official Footer) */}
            <OfficialPrintSignatures
              roles={['سەرپەرشتیاری ئایتی', 'بەڕێوەبەری ژمێریاری و کۆگا', 'بەڕێوەبەری گشتی']}
            />

            {/* 🔒 Official System Verification Bar */}
            <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[9px] text-slate-500 flex items-center justify-between">
              <span>سیستەمی فەرمی بەڕێوەبردنی دەوامی ئاشڵی — Ashley Furniture ERP System</span>
              <span className="font-mono">کۆدی دڵنیایی: ASH-{stats.employeeId}-{monthParam}</span>
            </div>
          </>
        ) : null}
      </main>

      {/* 📄 Print Styling */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          main {
            box-shadow: none !important;
            border: none !important;
            padding: 4mm 6mm !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 8mm 6mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function AttendancePrintReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-100" dir="rtl">
        <p className="font-bold text-slate-600">لە بارکردنی پەڕەی چاپکردن...</p>
      </div>
    }>
      <AttendancePrintReportContent />
    </Suspense>
  );
}
