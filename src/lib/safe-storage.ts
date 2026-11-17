/**
 * 🛡️ Bulletproof LocalStorage wrapper for iOS Safari, WKWebView (WhatsApp, Instagram, etc.),
 * and Private Browsing modes where window.localStorage can throw SecurityError or QuotaExceededError.
 */

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      // QuotaExceededError or SecurityError in iOS Safari / WKWebView
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
