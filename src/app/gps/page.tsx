'use client';

import React from 'react';
import { useAppContext } from '@/context/app-provider';
import { NewGpsAttendanceMatrixTable } from '@/components/attendance/NewGpsAttendanceMatrixTable';
import Link from 'next/link';
import { ArrowRight, Smartphone, ShieldCheck, Home } from 'lucide-react';

export default function StandaloneGpsAttendancePage() {
  const { employees, allMergedAttendanceLogs } = useAppContext();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 dir-rtl font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navbar */}
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>📡 خشتەی تۆماری GPS نوێی ئامادەبوون</span>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[11px] font-mono font-bold">
                  ڤێرژنی ۲.۰
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                سیستەمی هەمیشەیی ئۆتۆماتیکی ئامادەبوونی ئەپی مۆبایل و Supabase Database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center gap-2 border border-slate-700 transition-all shadow-sm"
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span>گەڕانەوە بۆ داشبۆردی سەرەکی</span>
            </Link>
          </div>
        </header>

        {/* 📊 Standalone 31-Day GPS Attendance Matrix Component */}
        <section className="bg-slate-900/60 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl">
          <NewGpsAttendanceMatrixTable 
            employees={employees.filter(e => e.status !== 'resigned' && e.isActive !== false)} 
            attendanceLogs={allMergedAttendanceLogs} 
          />
        </section>

      </div>
    </main>
  );
}
