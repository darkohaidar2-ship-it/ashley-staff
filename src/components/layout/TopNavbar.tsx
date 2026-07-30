'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export function TopNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="w-full bg-white border-b border-slate-300 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Brand & Main Title */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-wider text-slate-900 bg-slate-100 px-3 py-1 rounded border border-slate-300">
              ASHLEY Do27
            </span>
            <span className="text-xs font-bold text-slate-500 hidden sm:inline-block border-r border-slate-300 pr-3">
              سیستەمی گشتی ئامادەبوون و کۆگا
            </span>
          </Link>
        </div>

        {/* Public Header Navigation */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={`px-3.5 py-1.5 rounded text-xs font-bold transition-all border ${
              pathname === '/'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
            }`}
          >
            پەڕەی سەرەکی (ئامادەبوون و مۆدێل)
          </Link>

          {/* Admin Entry or Logout */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className={`px-3.5 py-1.5 rounded text-xs font-bold transition-all border ${
                  pathname.startsWith('/admin')
                    ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-300'
                }`}
              >
                پەنەری سەرەکی بەڕێوەبەر (Admin Hub)
              </Link>
              <button
                onClick={() => logout()}
                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded text-xs border border-rose-300 cursor-pointer"
              >
                دەرچوون
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs border border-slate-700 shadow-sm cursor-pointer"
            >
              ئەدمین (Admin)
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
