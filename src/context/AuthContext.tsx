import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { authApi } from '../libs/endpoints';
import { clearSession, onSessionCleared, readToken, saveToken } from '../libs/session';
import type { AuthUser } from '../types/api';

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (token: string) => Promise<AuthUser>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Loads the real profile.
   *
   * This used to set `user` to `{ token }`, so `user.studioId` and
   * `user.workerProfile.id` were always undefined and every screen fetched
   * nothing. `/auth/me` returns the actual user.
   */
  const refresh = useCallback(async () => {
    const token = await readToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await authApi.me());
    } catch {
      // A 401 already cleared the token via the axios interceptor.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => onSessionCleared(() => setUser(null)), []);

  const login = useCallback(
    async (token: string) => {
      await saveToken(token);
      const profile = await authApi.me();
      setUser(profile);
      return profile;
    },
    [],
  );

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    router.replace('/auth/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, refresh, logout }),
    [user, loading, login, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
