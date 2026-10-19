'use client';

import React from 'react';
import { 
  Users, 
  Package, 
  Truck, 
  LogOut, 
  Mail, 
  Phone 
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

  return (
    <div className="space-y-4 pb-28">
      {/* Header */}
      <div>
        <h2 className={`text-base font-black flex items-center gap-2 ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          <span>⚙️</span> پڕۆفایل و بەشە تایبەتەکان
        </h2>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500 font-semibold'}`}>
          زانیاری هەژمار و دەسەڵاتەکانی بەشەکەت
        </p>
      </div>

      {/* User Profile Card */}
      <div className={`border rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5 ${
        isDark 
          ? 'bg-slate-900/90 border-slate-800 text-white' 
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl overflow-hidden shrink-0 border ${
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
            <h3 className="text-base font-black">{user.employeeName}</h3>
            <p className="text-xs text-amber-600 font-bold">{user.role}</p>
            <p className={`text-xs font-mono mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              کۆدی کارمەند: <span className="font-bold">{user.employeeId}</span>
            </p>
          </div>
        </div>

        <div className={`pt-3 border-t space-y-2 text-xs ${
          isDark ? 'border-slate-800' : 'border-slate-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
              <Mail className="w-4 h-4" /> ئیمەیڵی بەستراو:
            </span>
            <span className="font-mono text-xs font-bold text-amber-600" dir="ltr">
              {user.email}
            </span>
          </div>

          {user.phone && (
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500 font-medium'}`}>
                <Phone className="w-4 h-4" /> تەلەفۆن:
              </span>
              <span className={`font-mono text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} dir="ltr">
                {user.phone}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full h-13 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black rounded-2xl text-xs flex items-center justify-center gap-2 border border-rose-200 transition-all cursor-pointer"
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
    </div>
  );
}
