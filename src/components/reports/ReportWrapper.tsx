
'use client';

import { useAppContext } from '@/context/app-provider';
import { format, isValid, parseISO } from 'date-fns';

export const ReportWrapper = ({
  children,
  title,
  date,
}: {
  children: React.ReactNode;
  title?: string;
  date?: string | Date | null;
}) => {
  const { settings } = useAppContext();
  
  let formattedDate = "";
  if (date) {
    if (date instanceof Date) {
      if (isValid(date)) {
        formattedDate = format(date, 'dd/MM/yyyy');
      }
    } else {
      try {
        const parsed = parseISO(date);
        if (isValid(parsed)) {
          formattedDate = format(parsed, 'dd/MM/yyyy');
        } else {
          const fallbackParsed = new Date(date);
          if (isValid(fallbackParsed)) {
            formattedDate = format(fallbackParsed, 'dd/MM/yyyy');
          } else {
            formattedDate = date;
          }
        }
      } catch {
        formattedDate = date;
      }
    }
  }

  return (
    <div className="p-8 bg-white text-black font-sans min-h-screen flex flex-col w-full max-w-[210mm] mx-auto">
      {/* 1. Upper Image */}
      {settings?.printHeaderImage && (
        <header className="mb-8 text-center break-inside-avoid">
          <img
            src={settings.printHeaderImage}
            alt="Report Header"
            className="w-full h-auto max-h-32 object-contain mx-auto"
            crossOrigin="anonymous"
          />
        </header>
      )}

      {/* 2. Title and 3. Date */}
      <div className="text-center mb-10 break-after-avoid">
        {title && <h1 className="text-3xl font-black uppercase tracking-tight mb-2">{title}</h1>}
        {formattedDate && <p className="text-lg font-bold text-gray-600">{formattedDate}</p>}
      </div>
      
      {/* 4. List (Children) */}
      <main className="flex-1 w-full mb-12">
        {children}
      </main>

      {/* 5. Lower Image */}
      {settings?.printFooterImage && (
        <footer className="mt-auto pt-8 border-t-2 border-gray-100 break-before-avoid">
          <img
            src={settings.printFooterImage}
            alt="Report Footer"
            className="w-full h-auto max-h-32 object-contain mx-auto"
            crossOrigin="anonymous"
          />
        </footer>
      )}
    </div>
  );
};
