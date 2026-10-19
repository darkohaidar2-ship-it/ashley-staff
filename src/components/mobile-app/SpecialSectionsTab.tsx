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
}

export function SpecialSectionsTab({
  user,
  specialSections,
  onLogout,
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
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>⚙️</span> پڕۆفایل و بەشە تایبەتەکان
        </h2>
        <p className="text-[11px] text-slate-400">
          زانیاری هەژمار و دەسەڵاتەکانی بەشەکەت
        </p>
      </div>

      {/* User Profile Card */}
      <div className="bg-slate-800/90 border border-slate-700/70 rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl overflow-hidden shrink-0">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.employeeName} className="w-full h-full object-cover" />
            ) : (
              user.employeeName.charAt(0)
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{user.employeeName}</h3>
            <p className="text-xs text-amber-400 font-medium">{user.role}</p>
            <p className="text-[10px] text-slate-400 font-mono">کۆدی کارمەند: {user.employeeId}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Mail className="w-3.5 h-3.5" /> ئیمەیڵی بەستراو:
            </span>
            <span className="font-mono text-[11px] text-white" dir="ltr">
              {user.email}
            </span>
          </div>

          {user.phone && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Phone className="w-3.5 h-3.5" /> تەلەفۆن:
              </span>
              <span className="font-mono text-[11px] text-white" dir="ltr">
                {user.phone}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full h-11 mt-2 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 border border-rose-500/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>چوونەدەرەوە لە ئەپ (Sign Out)</span>
        </button>
      </div>

      {/* Role-Specific Sections: Warehouse Attendance */}
      {specialSections.canViewWarehouse && specialSections.warehouseSummary && (
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">ئامادەبووانی کۆگا ئەمڕۆ</h3>
          </div>
          <div 
            className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3 rounded-2xl border border-slate-700/40"
            dangerouslySetInnerHTML={{ __html: specialSections.warehouseSummary }}
          />
        </div>
      )}

      {/* Transport Staff Attendance */}
      {specialSections.canViewTransport && specialSections.transportSummary && (
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">ستافی نقڵ و گواستنەوە</h3>
          </div>
          <div 
            className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3 rounded-2xl border border-slate-700/40"
            dangerouslySetInnerHTML={{ __html: specialSections.transportSummary }}
          />
        </div>
      )}

      {/* General Attendance Summary (Managers) */}
      {specialSections.canViewAll && specialSections.generalSummary && (
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">لیستی گشتی دەوامی کۆمپانیا</h3>
          </div>
          <div 
            className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/60 p-3 rounded-2xl border border-slate-700/40 max-h-60 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: specialSections.generalSummary }}
          />
        </div>
      )}

      {/* Admin Google Bindings Management (Darko Only) */}
      {user.isFounder && (
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white">بەڕێوەبردنی ئەکاونتەکانی گووگڵ</h3>
            </div>
            <button
              onClick={loadBindings}
              disabled={loadingBindings}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBindings ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            لێرەوە دەتوانیت ببینی کام کارمەند کام گووگڵ ئەکاونتەی بەستووە، و دەتوانیت قوفڵەکەی بکەیتەوە ئەگەر مۆبایلی گۆڕی:
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {Object.keys(bindings).length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">هیچ ئەکاونتێکی بەستراو نییە</p>
            ) : (
              Object.entries(bindings).map(([email, info]) => (
                <div
                  key={email}
                  className="p-3 bg-slate-900/70 border border-slate-700/50 rounded-xl flex items-center justify-between gap-2"
                >
                  <div>
                    <h4 className="text-xs font-bold text-white">{info.employeeName}</h4>
                    <p className="text-[10px] text-amber-400 font-mono" dir="ltr">{email}</p>
                    <span className="text-[9px] text-slate-500 font-mono">کۆد: {info.employeeId}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnbind(email)}
                    disabled={unbindingEmail === email}
                    className="h-8 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
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
