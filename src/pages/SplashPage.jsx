/**
 * SR MVP — Splash Page
 * Tim 6 Fase 2 | src/pages/SplashPage.jsx
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { C, FONTS, FS } from '../styles/tokens';

export default function SplashPage() {
  const navigate = useNavigate();
  const { isLoggedIn, role } = useAuth();

  useEffect(() => {
    const t = setTimeout(() => {
      if (isLoggedIn) {
        if (role === 'guru') navigate('/guru', { replace: true });
        else if (role === 'admin') navigate('/admin', { replace: true });
        else navigate('/siswa', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [isLoggedIn, role, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${C.dark} 0%, ${C.teal} 60%, ${C.tealL} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 24, position: 'relative', overflow: 'hidden',
    }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,.08)',
          width: 120 + i * 100, height: 120 + i * 100,
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        }} />
      ))}
      <div className="bounce-in" style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🏫</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 42, fontWeight: 600, color: C.white, letterSpacing: '-1px' }}>
          Sekolah Rakyat
        </div>
        <div style={{ color: 'rgba(255,255,255,.65)', fontSize: FS.xl, marginTop: 4, fontStyle: 'italic' }}>
          Model AI Pendidikan Nusantara
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 6, justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: C.amber, animation: `pulse 1.2s ${i * .3}s infinite` }} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
        BPSDM Komdigi · AITF
      </div>
    </div>
  );
}
