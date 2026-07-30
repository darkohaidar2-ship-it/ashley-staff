'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';

function AdminMasterHubPage() {
  const { user } = useAuth();
  const { exportStateAsJson } = useAppContext();

  // 5 Master Security Control Zones (26 Sub-modules)
  const masterZones = [
    {
      title: '📦 ١. کۆگا، نەخشەکان و کەلوپەلەکان (Inventory & Warehouse Maps)',
      description: 'بەڕێوەبردنی جەردی گشتی، نەخشەکانی کۆگا و ئایتمە فرۆشراوەکان',
      items: [
        { name: 'جەردی کەلوپەلەکان', desc: 'گەڕان و جەردی سەرەکی کۆگا', href: '/items', icon: '📦' },
        { name: 'شوێنەکانی خەزنکردن', desc: 'بەڕێوەبردنی زۆن و شوێنەکان', href: '/locations', icon: '🏢' },
        { name: 'نەخشەی سەرەکی ئاشڵی', desc: 'نەخشەی کارلێککاری Showroom & Storage', href: '/ashley-map', icon: '🗺️' },
        { name: 'نەخشەی کۆگای هەوانە', desc: 'نەخشەی کارلێککاری Level 1 & 2', href: '/huana-map', icon: '🗺️' },
        { name: 'نەخشەی گشتی ڕاکەکان', desc: 'نەخشەی Visual Racks & Shelves', href: '/warehouse-map', icon: '📊' },
        { name: 'سەرپەرشتی نەخشەکان', desc: 'دەستکاریکردنی نەخشە و زۆنەکان', href: '/map-management', icon: '🛠️' },
        { name: 'کەلوپەلە فرۆشراوەکان', desc: 'تۆماری ئایتمە فڕۆشراوەکان', href: '/sold-items', icon: '🏷️' },
        { name: 'جەردی گشتی بڵاوکراوە', desc: 'بینینی جەردی سەرەکی', href: '/public-inventory', icon: '📋' },
      ],
    },
    {
      title: '📄 ٢. هاوردەکردن و ئەرشیفی فۆڵدەرەکان (Imports & Document Archives)',
      description: 'هاوردەکردنی فایلی ئێکسڵ، PDF و بەڕێوەبردنی فۆڵدەرە ئەرشیفکراوەکان',
      items: [
        { name: 'هاوردەکردنی ئێکسڵ', desc: 'هاوردەکردن و دابەشکردنی فایلی Excel', href: '/import', icon: '📊' },
        { name: 'هاوردەکردنی کاتالۆگ و PDF', desc: 'دەرهێنانی زانیاری فایلی PDF', href: '/import-pdf', icon: '📑' },
        { name: 'ئەرشیفی فایلی ئێکسڵ', desc: 'کۆگا و جەردە ئەرشیفکراوەکان', href: '/archive', icon: '📂' },
        { name: 'ئەرشیفی فایلی PDF', desc: 'ئەرشیفی تێکڕای فۆڵدەری PDF', href: '/pdf-archive', icon: '📁' },
        { name: 'فایلی جەردی نوێ', desc: 'فۆرمی داغڵکردنی جەردی نوێ', href: '/new-file', icon: '➕' },
        { name: 'گواستنەوەی باری کۆگا', desc: 'تۆماری بارکردن و سائقەکان', href: '/public-transmit', icon: '🚚' },
      ],
    },
    {
      title: '👥 ٣. ستاف، دەوام و سەعاتی زیاده (Staff Roster, Attendance & Overtime)',
      description: 'کۆنترۆڵی ئامادەبوونی کارمەندان، دیاریکردنی GPS، و ئەژمارکردنی سەعاتی زیاده',
      items: [
        { name: 'کۆنترۆڵی دەوام و لۆکەیشن', desc: 'لۆگی دەوام و سنووری GPS دیاریکراو', href: '/admin/attendance', icon: '📍' },
        { name: 'بەڕێوەبردنی ئامادەبوون', desc: 'مێژووی ئامادەبوون و QR Code', href: '/attendance', icon: '⏱️' },
        { name: 'دۆسیەی کارمەندان', desc: 'زانیاری ستاف و مووچەی بنەڕەتی', href: '/employees', icon: '👥' },
        { name: 'سەعاتی زیاده (Overtime)', desc: 'ئەژمارکردنی سەعاتی کارکردنی زیاده', href: '/overtime', icon: '🕒' },
        { name: 'سەنتەری داغڵکردن (Inputs)', desc: 'تۆماری خەرجی، بارکردن و بڕینەکان', href: '/inputs', icon: '✍️' },
      ],
    },
    {
      title: '💰 ٤. دارایی، خەرجی و ڕاپۆرتەکان (Finance, Expenses & Reports)',
      description: 'داشبۆردی دارایی، مووچە، پۆلێنی خەرجییەکان و دیزاینی ڕاپۆرتەکان',
      items: [
        { name: 'داشبۆردی دارایی و خەرجی', desc: 'شیکاری خەرجییەکانی ئاشڵی', href: '/ashley-expenses', icon: '💳' },
        { name: 'ڕێکخستنی خەرجییەکان', desc: 'پۆلێن و ڕەنگی خەرجییەکان', href: '/ashley-expenses-settings', icon: '⚙️' },
        { name: 'دیزاینەری ڕاپۆرتەکان', desc: 'دروستکردن و چاپکردنی ڕاپۆرت', href: '/report-designer', icon: '🖨️' },
      ],
    },
    {
      title: '🔒 ٥. ئاسایش، دەسەڵاتەکان و باکئەپ (System Security & Backups)',
      description: 'دیاریکردنی بناغەی کۆمپانیا لەسەر نەخشە، بەکارهێنەران و پاشەکەوتی داتابەیس',
      items: [
        { name: 'شوێنی کۆمپانیا (Factory Geofence)', desc: 'دیاریکردنی سنوری کۆمپانیا لەسەر نەخشە', href: '/settings', icon: '🗺️' },
        { name: 'بەکارهێنەران و دەسەڵاتەکان', desc: 'بەڕێوەبردنی ئەکاونت و رۆڵەکان', href: '/settings', icon: '🔑' },
        { name: 'هەژماری بەڕێوەبەری سەرەکی', desc: 'پڕۆفایلی بەکارهێنەر', href: '/account', icon: '👤' },
      ],
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Welcome Title */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-300">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-wide flex items-center gap-2">
            🔑 پەنەری سەرەکی بەڕێوەبەر (Admin Master Hub)
          </h1>
          <p className="text-xs text-slate-600 font-bold mt-1">
            بەکارهێنەری چالاک: <span className="text-slate-900 font-extrabold">{user?.username || 'Admin'}</span> | دەسەڵات: بەڕێوەبەری گشتی
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportStateAsJson}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs border border-emerald-900 shadow-sm transition-all cursor-pointer"
          >
            💾 دابەزاندنی باکئەپی گشتی (JSON Backup)
          </button>
        </div>
      </header>

      {/* 5 Master Control Sections */}
      <div className="space-y-6">
        {masterZones.map((zone, zIdx) => (
          <div key={zIdx} className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
            
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-black text-slate-900">
                {zone.title}
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">
                {zone.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zone.items.map((item, iIdx) => (
                <Link
                  key={iIdx}
                  href={item.href}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-all flex flex-col justify-between group hover:border-slate-400"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-xs font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                      {item.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-2">
                    {item.desc}
                  </p>
                </Link>
              ))}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

export default withAuth(AdminMasterHubPage);
