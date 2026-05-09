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
import { useStudentStore } from '../stores/studentStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const resetForUser = useStudentStore(s => s.resetForUser);

  useEffect(() => {
    const saved = localStorage.getItem('sr_user');
    if (saved) {
      try {
        const restoredUser = JSON.parse(saved);
        setUser(restoredUser);
        resetForUser(restoredUser?.id ?? null); // load selectedMapels user ini saat reload
      } catch { localStorage.removeItem('sr_user'); }
    }
    setIsLoading(false);

    const onUnauth = () => { resetForUser(null); setUser(null); };
    window.addEventListener('sr:unauthorized', onUnauth);
    return () => window.removeEventListener('sr:unauthorized', onUnauth);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX ③a: authApi.login() sudah memanggil _saveSession() → simpan sr_access_token + sr_user
  //  AuthContext cukup update state React, tidak perlu setItem ulang.
  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    resetForUser(res.user?.id ?? null);
    setUser(res.user);
    return res.user;
  }, [resetForUser]);

  // Google login dihapus — semua akun diatur admin, tidak ada self-register.

  const forgotPassword = useCallback(async (email) => {
    return await authApi.forgotPassword(email);
  }, []);

  // FIX ③c: logout harus hapus sr_access_token + sr_refresh_token agar interceptor tidak kirim token basi
  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* abaikan error network saat logout */ }
    localStorage.removeItem('sr_access_token');
    localStorage.removeItem('sr_refresh_token');
    localStorage.removeItem('sr_user');
    resetForUser(null); // wipe seluruh store — data tidak bocor ke user berikutnya
    setUser(null);
  }, [resetForUser]);

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
      login, forgotPassword,
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