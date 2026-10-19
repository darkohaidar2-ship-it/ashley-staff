'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Package, 
  Truck, 
  Lock, 
  Unlock, 
  LogOut, 
  User, 
  Mail, 
  Phone, 
  KeyRound, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import { MobileAuthUser } from './types';

interface SpecialSectionsTabProps {
  user: MobileAuthUser;
  specialSections: {
    canViewWarehouse?: boolean;
    canViewTransport?: boolean;
    canViewAll?: boolean;
    warehouseSummary?: string | null;
    transportSummary?: string | null;
    generalSummary?: string | null;
  };
  onLogout: () => void;
  isDark?: boolean;
}

export function SpecialSectionsTab({
  user,
  specialSections,
  onLogout,
  isDark = false,
}: SpecialSectionsTabProps) {
  // Google Bindings Manager (Admin Only)
  const [bindings, setBindings] = useState<Record<string, any>>({});
  const [loadingBindings, setLoadingBindings] = useState(false);
  const [unbindingEmail, setUnbindingEmail] = useState<string | null>(null);

  const loadBindings = async () => {
    if (!user.isFounder) return;
    setLoadingBindings(true);
    try {
      const res = await fetch('/api/auth/google-binding');
      const data = await res.json();
      if (data.success && data.allBindings) {
        setBindings(data.allBindings);
      }
    } catch (e) {
      console.error('[SpecialSectionsTab] Failed to load bindings:', e);
    } finally {
      setLoadingBindings(false);
    }
  };

  useEffect(() => {
    loadBindings();
  }, [user.isFounder]);

  const handleUnbind = async (email: string) => {
    if (!confirm(`ئایا دڵنیایت لە کردنەوەی قوفڵی ئەم ئەکاونتە؟\n${email}`)) return;

    setUnbindingEmail(email);
    try {
      const res = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        loadBindings();
      }
    } catch (e) {
      alert('هەڵەیەک ڕوویدا لە کردنەوەی قوفڵ');
    } finally {
      setUnbindingEmail(null);
    }
  };

  return (
    <div className="space-y-3.5 pb-20">
      {/* Header */}
      <div>
        <h2 className={`text-base font-black flex items-center gap-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          <span>⚙️</span> پڕۆفایل و بەشە تایبەتەکان
        </h2>
        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          زانیاری هەژمار و دەسەڵاتەکانی بەشەکەت
        </p>
      </div>

      {/* User Profile Card */}
      <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 text-white' 
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-13 h-13 rounded-2xl flex items-center justify-center font-bold text-xl overflow-hidden shrink-0 border ${
            isDark 
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.employeeName} className="w-full h-full object-cover" />
            ) : (
              user.employeeName.charAt(0)
            )}
          </div>
          <div>
            <h3 className="text-sm font-black">{user.employeeName}</h3>
            <p className="text-xs text-amber-600 font-bold">{user.role}</p>
            <p className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              کۆدی کارمەند: <span className="font-bold">{user.employeeId}</span>
            </p>
          </div>
        </div>

        <div className={`pt-3 border-t space-y-2 text-xs ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Mail className="w-3.5 h-3.5" /> ئیمەیڵی بەستراو:
            </span>
            <span className="font-mono text-[11px] font-bold text-amber-600" dir="ltr">
              {user.email}
            </span>
          </div>

          {user.phone && (
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Phone className="w-3.5 h-3.5" /> تەلەفۆن:
              </span>
              <span className={`font-mono text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} dir="ltr">
                {user.phone}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full h-11 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-rose-200 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>چوونەدەرەوە لە ئەپ (Sign Out)</span>
        </button>
      </div>

      {/* Role-Specific Sections: Warehouse Attendance */}
      {specialSections.canViewWarehouse && specialSections.warehouseSummary && (
        <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black">ئامادەبووانی کۆگا ئەمڕۆ</h3>
          </div>
          <div 
            className={`text-xs leading-relaxed whitespace-pre-line p-3 rounded-2xl border ${
              isDark 
                ? 'bg-slate-950/60 border-slate-800 text-slate-300' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
            dangerouslySetInnerHTML={{ __html: specialSections.warehouseSummary }}
          />
        </div>
      )}

      {/* Transport Staff Attendance */}
      {specialSections.canViewTransport && specialSections.transportSummary && (
        <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black">ستافی نقڵ و گواستنەوە</h3>
          </div>
          <div 
            className={`text-xs leading-relaxed whitespace-pre-line p-3 rounded-2xl border ${
              isDark 
                ? 'bg-slate-950/60 border-slate-800 text-slate-300' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
            dangerouslySetInnerHTML={{ __html: specialSections.transportSummary }}
          />
        </div>
      )}

      {/* General Attendance Summary (Managers) */}
      {specialSections.canViewAll && specialSections.generalSummary && (
        <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black">لیستی گشتی دەوامی کۆمپانیا</h3>
          </div>
          <div 
            className={`text-xs leading-relaxed whitespace-pre-line p-3 rounded-2xl border max-h-60 overflow-y-auto ${
              isDark 
                ? 'bg-slate-950/60 border-slate-800 text-slate-300' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
            dangerouslySetInnerHTML={{ __html: specialSections.generalSummary }}
          />
        </div>
      )}

      {/* Admin Google Bindings Management (Darko Only) */}
      {user.isFounder && (
        <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs ${
          isDark 
            ? 'bg-slate-900/90 border-slate-800 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black">بەڕێوەبردنی ئەکاونتەکانی گووگڵ</h3>
            </div>
            <button
              onClick={loadBindings}
              disabled={loadingBindings}
              className={`p-1.5 rounded-lg cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBindings ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>

          <p className={`text-[11px] mb-3 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            لێرەوە دەتوانیت ببینی کام کارمەند کام گووگڵ ئەکاونتەی بەستووە، و دەتوانیت قوفڵەکەی بکەیتەوە ئەگەر مۆبایلی گۆڕی:
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
            {Object.keys(bindings).length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">هیچ ئەکاونتێکی بەستراو نییە</p>
            ) : (
              Object.entries(bindings).map(([email, info]) => (
                <div
                  key={email}
                  className={`p-3 border rounded-xl flex items-center justify-between gap-2 ${
                    isDark 
                      ? 'bg-slate-950/70 border-slate-800' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-black">{info.employeeName}</h4>
                    <p className="text-[10px] text-amber-600 font-mono font-bold" dir="ltr">{email}</p>
                    <span className="text-[9px] text-slate-400 font-mono">کۆد: {info.employeeId}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnbind(email)}
                    disabled={unbindingEmail === email}
                    className="h-8 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {unbindingEmail === email ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Unlock className="w-3 h-3" />
                        <span>کردنەوەی قوفڵ</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
