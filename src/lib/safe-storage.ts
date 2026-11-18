/**
 * 🛡️ Bulletproof Storage wrappers for iOS Safari, WKWebView (WhatsApp, Instagram, Telegram),
 * Private Browsing, and restricted iframe sandboxes where window.localStorage or window.sessionStorage
 * can throw SecurityError or QuotaExceededError.
 * 
 * Provides transparent in-memory fallback so that operations never throw and state persists in-memory.
 */

const memoryLocalStorage = new Map<string, string>();
const memorySessionStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
      return memoryLocalStorage.get(key) ?? null;
    } catch {
      return memoryLocalStorage.get(key) ?? null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(key, value);
      memoryLocalStorage.set(key, value);
      return true;
    } catch {
      // QuotaExceededError or SecurityError in iOS Safari / WKWebView
      memoryLocalStorage.set(key, value);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.removeItem(key);
      memoryLocalStorage.delete(key);
      return true;
    } catch {
      memoryLocalStorage.delete(key);
      return false;
    }
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      const val = window.sessionStorage.getItem(key);
      if (val !== null) return val;
      return memorySessionStorage.get(key) ?? null;
    } catch {
      return memorySessionStorage.get(key) ?? null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.sessionStorage.setItem(key, value);
      memorySessionStorage.set(key, value);
      return true;
    } catch {
      memorySessionStorage.set(key, value);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.sessionStorage.removeItem(key);
      memorySessionStorage.delete(key);
      return true;
    } catch {
      memorySessionStorage.delete(key);
      return false;
    }
  },
};
