'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ErpTheme = 'classic-nav' | 'modern-bc' | 'ibm-carbon' | 'fluent-win11';

export interface ThemeOption {
  id: ErpTheme;
  nameKu: string;
  nameEn: string;
  descKu: string;
  primaryColor: string;
  headerColor: string;
  bgPreview: string;
  borderRadius: string;
}

export const ERP_THEMES: ThemeOption[] = [
  {
    id: 'classic-nav',
    nameKu: '1. کلاسیک ویندۆز (Dynamics NAV)',
    nameEn: 'Classic Win32 NAV',
    descKu: 'ستایلی تیژی Win32، دوگمەی Beveled، شینی دەریایی کلاسیک، خێرا و کەم ئەزموون',
    primaryColor: '#2563eb',
    headerColor: 'linear-gradient(180deg, #f1f5f9 0%, #cbd5e1 100%)',
    bgPreview: '#dbe2e9',
    borderRadius: '0px'
  },
  {
    id: 'modern-bc',
    nameKu: '2. مۆدێرن بیزنست سێنتڕاڵ (Dynamics 365)',
    nameEn: 'Modern Business Central',
    descKu: 'ستایلی 2px لاریی زۆر شیک، ناونیشانی شینی ژەنەڕاڵی، هێڵکارییەکانی تیژی مۆدێرن',
    primaryColor: '#1d4ed8',
    headerColor: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)',
    bgPreview: '#f1f5f9',
    borderRadius: '2px'
  },
  {
    id: 'ibm-carbon',
    nameKu: '3. ئای بی ئێم کاربۆن (IBM Carbon System)',
    nameEn: 'IBM Carbon Enterprise',
    descKu: 'کۆنتراستی زۆر بەرز، سەرپەڕەی تێڕی شینی تاریک، گواستنەوەی فۆنتی Mono، چڕی داتای بەرز',
    primaryColor: '#0284c7',
    headerColor: '#0f172a',
    bgPreview: '#e2e8f0',
    borderRadius: '0px'
  },
  {
    id: 'fluent-win11',
    nameKu: '4. ویندۆز 11 فلێوێنت (Windows 11 ERP)',
    nameEn: 'Windows 11 Fluent ERP',
    descKu: 'گۆشەی 4px خڕکراوی مۆدێرن، دوگمە و فۆرمی نەرمی 3D، وێنەی جوانکاریی ویندۆز 11',
    primaryColor: '#2563eb',
    headerColor: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    bgPreview: '#eef2f6',
    borderRadius: '4px'
  }
];

interface ThemeContextType {
  theme: ErpTheme;
  setTheme: (theme: ErpTheme) => void;
  themes: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'classic-nav',
  setTheme: () => {},
  themes: ERP_THEMES
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ErpTheme>('classic-nav');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('ashley_erp_theme') as ErpTheme;
    if (saved && ERP_THEMES.some(t => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', 'classic-nav');
    }
  }, []);

  const setTheme = (newTheme: ErpTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('ashley_erp_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: ERP_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useErpTheme() {
  return useContext(ThemeContext);
}
