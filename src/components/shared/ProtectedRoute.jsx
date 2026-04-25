/**
 * SR MVP — Protected Route
 * Tim 6 Fase 2 | src/components/shared/ProtectedRoute.jsx
 *
 * Guard route berdasarkan role.
 * Jika belum login → redirect ke /login
 * Jika role tidak sesuai → redirect ke halaman role yang benar
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { C } from '../../styles/tokens';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isLoggedIn, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.cream, flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48,
          border: `3px solid ${C.tealXL}`, borderTopColor: C.teal,
          borderRadius: '50%', animation: 'spin .8s linear infinite',
        }} />
        <div style={{ color: C.slate, fontSize: 13 }}>Memuat...</div>
      </div>
    );
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    const redirect = role === 'guru' ? '/guru' : role === 'admin' ? '/admin' : '/siswa';
    return <Navigate to={redirect} replace />;
  }

  return children;
}
