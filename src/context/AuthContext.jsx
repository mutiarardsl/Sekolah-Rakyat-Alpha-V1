/**
 * SR MVP — Auth Context (REVISED v3 — Enroll Flow)
 * src/context/AuthContext.jsx
 *
 * v3:
 * - Expose changePassword() untuk forced first-login password change
 * - updateUser() tetap sama (dipakai ActivasiPage)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sr_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { localStorage.removeItem('sr_user'); }
    }
    setIsLoading(false);

    const onUnauth = () => setUser(null);
    window.addEventListener('sr:unauthorized', onUnauth);
    return () => window.removeEventListener('sr:unauthorized', onUnauth);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('sr_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const loginWithGoogle = useCallback(async (email) => {
    const res = await authApi.loginWithGoogle(email);
    localStorage.setItem('sr_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return await authApi.forgotPassword(email);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    localStorage.removeItem('sr_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('sr_user', JSON.stringify(next));
      return next;
    });
  }, []);

  // Dipakai oleh forced password change setelah first login
  const completeFirstLogin = useCallback(() => {
    updateUser({ is_first_login: false });
  }, [updateUser]);

  return (
    <AuthContext.Provider value={{
      user, role: user?.role ?? null, isLoading, isLoggedIn: !!user,
      login, loginWithGoogle, forgotPassword,
      logout, updateUser, completeFirstLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
};
