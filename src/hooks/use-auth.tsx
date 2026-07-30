'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
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
  const [currentUser, setCurrentUser] = useState<User | null>(defaultAdminUser);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
      } catch {
        // Fallback to default admin
        setCurrentUser(defaultAdminUser);
      }
    } else {
      setCurrentUser(defaultAdminUser);
    }
    setAuthLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const loggedUser: User = {
      id: 'admin-1',
      username: username || 'admin',
      password: password || '',
      fullName: username ? `بەکاربهێنەر (${username})` : 'بەڕێوەبەری سەرەکی (Super Admin)',
      roleId: 'role-admin'
    };
    setCurrentUser(loggedUser);
    sessionStorage.setItem('currentUser', JSON.stringify(loggedUser));
    return true;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setCurrentUser(defaultAdminUser);
    sessionStorage.removeItem('currentUser');
  }, []);
  
  const hasPermission = useCallback((permission: string): boolean => {
    // Open Source & Full Access: Always allow all permissions
    return true;
  }, []);

  const value: AuthState = {
    user: currentUser || defaultAdminUser,
    loading: false,
    login,
    logout,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Provide safe default if used outside context
    return {
      user: defaultAdminUser,
      loading: false,
      login: async () => true,
      logout: async () => {},
      hasPermission: () => true
    };
  }
  return context;
}
