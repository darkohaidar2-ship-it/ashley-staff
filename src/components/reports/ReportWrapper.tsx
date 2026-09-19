
'use client';

import React from 'react';
import { useAppContext } from '@/context/app-provider';
import { format, isValid, parseISO } from 'date-fns';
import { OfficialPrintHeader, OfficialPrintSignatures } from './OfficialPrintHeader';

export const ReportWrapper = ({
  children,
  title,
  subtitle,
  date,
  period,
  showSignatures = true,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  date?: string | Date | null;
  period?: string;
  showSignatures?: boolean;
}) => {
  const { settings } = useAppContext();
  
  let formattedDate = "";
  if (date) {
    if (date instanceof Date) {
      if (isValid(date)) {
        formattedDate = format(date, 'yyyy-MM-dd');
      }
    } else {
      try {
        const parsed = parseISO(date);
        if (isValid(parsed)) {
          formattedDate = format(parsed, 'yyyy-MM-dd');
        } else {
          const fallbackParsed = new Date(date);
          if (isValid(fallbackParsed)) {
            formattedDate = format(fallbackParsed, 'yyyy-MM-dd');
          } else {
            formattedDate = date;
          }
        }
      } catch {
        formattedDate = date;
      }
    }
  }

  const effectivePeriod = period || (formattedDate ? `بەروار: ${formattedDate}` : undefined);

  return (
    <div className="p-4 sm:p-6 bg-white text-slate-900 font-sans min-h-screen flex flex-col w-full max-w-[297mm] mx-auto print:p-2 print:m-0 print:max-w-full" dir="rtl">
      {/* 🌟 Official 3-Part Ashley Letterhead Header */}
      <OfficialPrintHeader
        title={title}
        subtitle={subtitle}
        period={effectivePeriod}
        settings={settings}
      />
      
      {/* 📋 Main Content / Table */}
      <main className="flex-1 w-full my-3">
        {children}
      </main>

      {/* ✍️ Official 3-Role Signatures Strip */}
      {showSignatures && (
        <OfficialPrintSignatures />
      )}
    </div>
  );
};
