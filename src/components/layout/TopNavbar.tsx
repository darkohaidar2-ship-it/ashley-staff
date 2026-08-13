'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAppContext } from '@/context/app-provider';
import { 
  Monitor, 
  Shield, 
  Home, 
  LogOut, 
  Lock, 
  Download, 
  Upload, 
  MapPin, 
  Users, 
  Package, 
  Truck, 
  Settings, 
  Minimize2, 
  Square, 
  X 
} from 'lucide-react';

export function TopNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { exportStateAsJson } = useAppContext();

  return (
    <div className="w-full font-sans select-none dir-rtl" dir="rtl">
      
      {/* 1. TOP WINDOW TITLE BAR (Classic Steel-Blue Windows Gradient Header) */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-700 px-3 py-1 text-xs font-bold flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-extrabold tracking-wide">ASHLEY ERP Enterprise Desktop 2026</span>
          <span className="text-[10px] bg-blue-900/80 text-blue-200 px-1.5 py-0.2 border border-blue-700 font-mono">
            v26.4 (RTL Kurdish Line-of-Business Edition)
          </span>
        </div>

        {/* Win32 Window Control Buttons (_ □ X) */}
        <div className="flex items-center gap-1 font-mono text-[11px] ltr" dir="ltr">
          <button title="Minimize" className="w-5 h-4 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600 cursor-pointer">_</button>
          <button title="Maximize" className="w-5 h-4 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600 cursor-pointer">□</button>
          <button title="Close" className="w-5 h-4 bg-rose-900 hover:bg-rose-700 text-white flex items-center justify-center border border-rose-800 cursor-pointer">✕</button>
        </div>
      </header>

      {/* 2. HORIZONTAL RIBBON / ACTION TOOLBAR (Classic Dynamics NAV Beveled Buttons) */}
      <nav className="bg-slate-200 border-b border-slate-400 p-1.5 flex flex-wrap items-center justify-between gap-2 shadow-inner text-xs font-bold">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`btn-classic ${pathname === '/' ? 'border-t-slate-600 border-l-slate-600 border-b-white border-r-white bg-slate-300 font-black' : ''}`}
          >
            <Home className="w-3.5 h-3.5 text-blue-700" />
            <span>پەڕەی سەرەکی (ئامادەبوون)</span>
          </Link>

          {user ? (
            <Link
              href="/admin"
              className={`btn-classic ${pathname.startsWith('/admin') ? 'border-t-slate-600 border-l-slate-600 border-b-white border-r-white bg-slate-300 font-black' : ''}`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-700" />
              <span>پەنەری ئەدمین (Admin Hub)</span>
            </Link>
          ) : (
            <Link href="/login" className="btn-classic">
              <Lock className="w-3.5 h-3.5 text-slate-700" />
              <span>داخڵبوون (Login)</span>
            </Link>
          )}

          <div className="h-5 w-px bg-slate-400 mx-1" />

          {/* Quick ERP Module Links */}
          <Link href="/items" className="btn-classic text-[11px]">
            <Package className="w-3.5 h-3.5 text-emerald-700" />
            <span>کۆگا</span>
          </Link>

          <Link href="/public-transmit" className="btn-classic text-[11px]">
            <Truck className="w-3.5 h-3.5 text-amber-700" />
            <span>گواستنەوە</span>
          </Link>

          <Link href="/settings" className="btn-classic text-[11px]">
            <Settings className="w-3.5 h-3.5 text-purple-700" />
            <span>سێتینگ</span>
          </Link>
        </div>

        {/* Action Toolbar Tools */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportStateAsJson}
            className="btn-classic"
            title="دابەزاندنی باکئەپی داتا"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>دابەزاندنی باکئەپ</span>
          </button>

          {user && (
            <button
              onClick={() => logout()}
              className="btn-classic text-rose-800"
              title="دەرچوون لە ئەکاونت"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-700" />
              <span>دەرچوون</span>
            </button>
          )}
        </div>

      </nav>

    </div>
  );
}
