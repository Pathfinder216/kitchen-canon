import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  type AuthUser,
  getCurrentUser,
  loginRequest,
  registerRequest,
  logoutRequest,
  fetchCsrfToken,
} from '../api/auth';
import { queryClient } from '../queryClient';
import { AuthContext, type AuthStatus } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Bootstrap: ask the server who we are.
  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setStatus('authed');
        void fetchCsrfToken();
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('anon');
      });
    return () => {
      active = false;
    };
  }, []);

  // Any 401 from the API client signals the session is gone — drop to anon and clear cache.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anon');
      queryClient.clear();
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await loginRequest(email, password);
    queryClient.clear(); // don't carry a previous session's cache
    await fetchCsrfToken();
    setUser(u);
    setStatus('authed');
  }, []);

  const register = useCallback(async (email: string, password: string, inviteCode?: string) => {
    const u = await registerRequest(email, password, inviteCode);
    queryClient.clear();
    await fetchCsrfToken();
    setUser(u);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      queryClient.clear();
      setUser(null);
      setStatus('anon');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
