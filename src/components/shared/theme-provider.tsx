"use client"

import { createContext, useContext, useEffect, useState, useMemo, ReactNode, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useAppContext } from "@/context/app-provider"
import { useDoc, useFirestore, useMemoFirebase, setDocumentNonBlocking, doc } from "@/firebase"

type Theme = "dark" | "light"

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings: globalSettings, isLoading: isAppLoading } = useAppContext();
  const { user, loading: isAuthLoading } = useAuth();
  const db = useFirestore();

  // Get user-specific setting from Firestore
  const userSettingsRef = useMemoFirebase(() => {
    if (!db || !user?.id) return null;
    return doc(db, 'users', user.id, 'settings', 'main');
  }, [db, user]);

  const { data: userSettings } = useDoc<{ darkModeEnabled: boolean }>(userSettingsRef);
  
  // Force light theme always
  const theme = "light";

  // Apply theme class to HTML element
  useEffect(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.classList.add("light")
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    // Theme switching is disabled, force light theme only
  }, []);
  
  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
