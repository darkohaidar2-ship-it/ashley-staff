'use client';

import React from 'react';
import { useAppContext } from '@/context/app-provider';
import type { AppSettings } from '@/lib/types';
import { format } from 'date-fns';

interface OfficialPrintHeaderProps {
  title?: string;
  subtitle?: string;
  period?: string;
  documentCode?: string;
  settings?: Partial<AppSettings> | null;
}

export const OfficialPrintHeader: React.FC<OfficialPrintHeaderProps> = ({
  title,
  subtitle,
  period,
  documentCode,
  settings: propSettings,
}) => {
  const { settings: ctxSettings } = useAppContext();
  const settings = propSettings || ctxSettings;

  const motherCompany = settings?.motherCompanyName || 'کۆمپانیای گروپی دیوان';
  const motherCompanySubtitle = settings?.motherCompanySubtitle || 'ناسنامەی مۆبیلیات';
  const brandName = settings?.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی';
  const brandSubtitle = settings?.brandSubtitle || settings?.brandSlogan || 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)';
  const diwanLogo = settings?.diwanLogo || '/diwan-logo.svg';
  const reportLogo = settings?.reportLogo || settings?.ashleyLogo || settings?.appLogo || '/ashley-logo.png';
  const docTitle = title || settings?.letterheadDocumentTitle || 'خشتەی تۆماری فەرمی';
  const primaryColor = settings?.letterheadPrimaryColor || '#0f172a';
  const accentColor = settings?.letterheadAccentColor || '#d97706';
  const titleColor = settings?.letterheadTitleColor || primaryColor;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const code = documentCode || 'ASH-DGP-2026';

  return (
    <div 
      className="w-full pb-2 mb-3 select-none"
      style={{ borderBottom: `2.5px solid ${primaryColor}` }}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3">
        {/* 1. لای ڕاست: لۆگۆی گروپی دیوان و ناوەکەی */}
        <div className="flex items-center gap-2.5 flex-1 justify-start">
          <div className="relative w-12 h-10 sm:w-14 sm:h-11 shrink-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diwanLogo}
              alt="Diwan Logo"
              className="max-h-11 max-w-[130px] object-contain"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
          </div>
          <div className="text-right">
            <div 
              className="text-xs sm:text-sm font-black leading-tight"
              style={{ color: primaryColor }}
            >
              {motherCompany}
            </div>
            <div 
              className="text-[9px] sm:text-[10px] font-bold mt-0.5"
              style={{ color: accentColor }}
            >
              {motherCompanySubtitle}
            </div>
          </div>
        </div>

        {/* 2. ناوەڕاست: تەنها تایتڵی فەرمی بابەتەکە */}
        <div className="text-center flex-[1.6] px-2">
          <h1 
            className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-snug"
            style={{ color: titleColor }}
          >
            {docTitle}
          </h1>
          {period && (
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              ماوە: {period}
            </div>
          )}
          {subtitle && !period && (
            <div className="text-[9.5px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </div>
          )}
        </div>

        {/* 3. لای چەپ: ناوی ئاشڵی، بەروار، کۆد و لۆگۆی ئاشڵی */}
        <div className="flex items-center gap-2.5 flex-1 justify-end">
          <div className="text-left">
            <div 
              className="text-xs sm:text-sm font-black leading-tight"
              style={{ color: primaryColor }}
            >
              {brandName}
            </div>
            <div 
              className="text-[8.5px] sm:text-[9.5px] font-bold mt-0.5"
              style={{ color: accentColor }}
            >
              {brandSubtitle}
            </div>
            <div className="text-[7.5px] sm:text-[8px] font-mono text-slate-500 mt-0.5">
              {todayStr} • کۆدی فەرمی: {code}
            </div>
          </div>
          <div className="relative w-12 h-10 sm:w-14 sm:h-11 shrink-0 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reportLogo}
              alt="Ashley Logo"
              className="max-h-10 max-w-[120px] object-contain"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const OfficialPrintSignatures: React.FC<{
  roles?: string[];
}> = ({
  roles = ['سەرپەرشتیاری ئایتی', 'بەڕێوەبەری ژمێریاری و کۆگا', 'بەڕێوەبەری گشتی'],
}) => {
  return (
    <div 
      className="mt-6 pt-2 grid grid-cols-3 gap-4 text-right break-inside-avoid"
      dir="rtl"
    >
      {roles.map((role) => (
        <div 
          key={role}
          className="bg-slate-50/70 border border-slate-300 rounded-lg p-2.5 text-right"
        >
          <div className="text-[10.5px] font-black text-slate-900 text-center pb-1.5 mb-2 border-b border-slate-200">
            {role}
          </div>
          <div className="text-[9px] font-bold text-slate-600 mb-2">
            ناو: ................................................................
          </div>
          <div className="text-[9px] font-bold text-slate-600">
            واژوو: ..............................................................
          </div>
        </div>
      ))}
    </div>
  );
};
