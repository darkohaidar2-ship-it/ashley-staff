'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; errorField?: 'username' | 'password' }>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const defaultAdminUser: User = {
  id: 'admin-1',
  username: 'admin',
  password: '000',
  fullName: 'بەڕێوەبەری سەرەکی (Super Admin)',
  roleId: 'role-admin'
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    try {
      // Clear persistent storage to prevent eternal logins
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ashley_admin_session');
        const storedUser = sessionStorage.getItem('ashley_admin_session');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Check if session token exists
          if (parsedUser && parsedUser.token) {
            setCurrentUser(parsedUser);
          } else {
            setCurrentUser(null);
            sessionStorage.removeItem('ashley_admin_session');
          }
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; errorField?: 'username' | 'password' }> => {
    const validUsername = username.trim();
    const validPassword = password.trim();

    if (!validUsername) {
      return { success: false, errorField: 'username' };
    }

    if (!validPassword) {
      return { success: false, errorField: 'password' };
    }

    const sessionToken = 'adm_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    const loggedUser = {
      id: 'admin-super',
      username: username.trim(),
      password: password.trim(),
      fullName: username ? `بەڕێوەبەر (${username})` : 'بەڕێوەبەری سەرەکی (Super Admin)',
      roleId: 'role-admin',
      token: sessionToken,
      loginTime: Date.now(),
    };

    setCurrentUser(loggedUser);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ashley_admin_session', JSON.stringify(loggedUser));
      localStorage.removeItem('ashley_admin_session');
    }
    return { success: true };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ashley_admin_session');
      localStorage.removeItem('ashley_admin_session');
    }
  }, []);

  const hasPermission = useCallback((permission: string): boolean => {
    return !!currentUser;
  }, [currentUser]);

  const value: AuthState = {
    user: currentUser,
    loading: authLoading,
    login,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      loading: false,
      login: async (): Promise<{ success: boolean; errorField?: 'username' | 'password' }> => ({ success: false }),
      logout: async () => {},
      hasPermission: () => false,
    };
  }
  return context;
}
