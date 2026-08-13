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
      const storedUser = sessionStorage.getItem('ashley_admin_session') || localStorage.getItem('ashley_admin_session');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; errorField?: 'username' | 'password' }> => {
    const validUsername = username.trim().toLowerCase();
    const validPassword = password.trim();

    // Check valid usernames: admin, darko
    const isAllowedUser = validUsername === 'admin' || validUsername === 'darko';
    if (!isAllowedUser) {
      return { success: false, errorField: 'username' };
    }

    // Check valid passwords: 001122, 123456, 0000, 1234, admin
    const isAllowedPass = validPassword === '001122' || validPassword === '123456' || validPassword === '0000' || validPassword === '1234' || validPassword === 'admin';
    if (!isAllowedPass) {
      return { success: false, errorField: 'password' };
    }

    const loggedUser: User = {
      id: 'admin-1',
      username: username.trim(),
      password: password.trim(),
      fullName: username ? `بەڕێوەبەر (${username})` : 'بەڕێوەبەری سەرەکی (Super Admin)',
      roleId: 'role-admin',
    };

    setCurrentUser(loggedUser);
    sessionStorage.setItem('ashley_admin_session', JSON.stringify(loggedUser));
    localStorage.setItem('ashley_admin_session', JSON.stringify(loggedUser));
    return { success: true };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setCurrentUser(null);
    sessionStorage.removeItem('ashley_admin_session');
    localStorage.removeItem('ashley_admin_session');
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
