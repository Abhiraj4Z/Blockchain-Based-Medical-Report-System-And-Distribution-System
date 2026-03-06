'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  getCurrentUser,
  setCurrentUser as saveCurrentUser,
  clearCurrentUser,
  getUserById,
} from '@/lib/supabase/storage';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const cachedUser = getCurrentUser();
    if (!cachedUser) {
      setUser(null);
      return;
    }
    // Always restore from cache first so no flash-to-login
    setUser(cachedUser);
    try {
      const freshUser = await getUserById(cachedUser.id);
      if (freshUser) {
        setUser(freshUser);
        saveCurrentUser(freshUser);
      }
      // If freshUser is null (transient error / RLS), keep the cached user
      // Only real logout clears the cache
    } catch {
      // Network error — keep cached user, do not log out
    }
  }, []);

  useEffect(() => {
    // Load user from localStorage on mount, then refresh from Supabase in background
    const cachedUser = getCurrentUser();
    if (cachedUser) {
      setUser(cachedUser); // set immediately so dashboard doesn't see null
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const login = (user: User) => {
    setUser(user);
    saveCurrentUser(user);
  };

  const logout = () => {
    setUser(null);
    clearCurrentUser();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
