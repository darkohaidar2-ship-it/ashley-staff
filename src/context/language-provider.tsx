
'use client';

import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAppContext } from './app-provider';
import { Translations, Language } from '@/lib/types';

export type { Language };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, any>) => string;
  translations: Record<Language, Translations>;
  setTranslations: (lang: Language, newTranslations: Translations) => void;
}

// Create the context with a default value
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// The provider component
export function LanguageProvider({ children }: { children: ReactNode }) {
  const { settings, setSettings, isLoading } = useAppContext();
  
  // Force Kurdish as the sole active language
  const language: Language = 'ku';
  const enTranslations = settings?.translations?.en || {};
  const kuTranslations = settings?.translations?.ku || {};

  const setLanguage = (lang: Language) => {
    // Locked to Kurdish, no-op for language changes
  };
  
  const translations = {
    en: enTranslations,
    ku: kuTranslations,
  };

  const t = useCallback((key: string, variables?: Record<string, any>): string => {
    // Fallback logic: If a key is not found in the current language, try English. If still not found, return the key itself.
    const lang = translations[language];
    const enLang = translations['en'];
    let str = (lang && lang[key]) || (enLang && enLang[key]) || key;
    
    if (variables) {
      Object.keys(variables).forEach(k => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(variables[k]));
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(variables[k]));
      });
    }
    
    return str;
  }, [language, translations]);

  const setTranslations = useCallback((lang: Language, newTranslations: Translations) => {
    setSettings(prevSettings => {
        // Guard against settings not being ready
        if (!prevSettings) return prevSettings;
        return {
            ...prevSettings,
            translations: {
                ...prevSettings.translations,
                [lang]: newTranslations,
            },
        }
    });
  }, [setSettings]);

  const value = {
    language,
    setLanguage,
    t,
    translations,
    setTranslations,
  };
  
    // Removed early return null because it causes a blank screen for the entire app.
    // The context values already handle default values (e.g. settings || {}).

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
