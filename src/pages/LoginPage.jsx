/**
 * SR MVP — Login Page (REVISED v3 — Enroll Flow)
 * src/pages/LoginPage.jsx
 *
 * Perubahan v3:
 * - Hapus "Daftar sekarang" umum untuk guru
 * - Ganti link ke /aktivasi (bukan /daftar) untuk siswa
 * - Tambah demo accounts hint untuk simulasi alpha
 * - Backend menentukan role dari email
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { C, FONTS, FS } from '../styles/tokens';
import { Btn, Card, Spinner } from '../components/shared/UI';
import { DUMMY_ACCOUNTS } from '../data/masterData';

const GOOGLE_ACCOUNTS = DUMMY_ACCOUNTS.filter(a => a.googleOnly);
const roleBadge = { siswa: '🎒 Siswa', guru: '👨‍🏫 Guru', admin: '🔑 Admin' };

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleModal, setGoogleModal] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const routeByRole = (user) => {
    if (user.role === 'guru') navigate('/guru', { replace: true });
    else if (user.role === 'admin') navigate('/admin', { replace: true });
    else if (user.is_first_login) navigate('/aktivasi', { replace: true }); // ← siswa belum aktivasi
    else navigate('/siswa', { replace: true });
  };

  const handleLogin = async () => {
    if (!email || !pass) { setError('Email/NIS dan password wajib diisi.'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(email, pass);
      routeByRole(user);
    } catch {
      setError('Email/NIS atau password salah.');
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = (acc) => {
    setLoading(true);
    loginWithGoogle(acc.email)
      .then(user => routeByRole(user))
      .catch(() => { setError('Akun Google tidak terdaftar.'); setLoading(false); })
      .finally(() => setGoogleModal(false));
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try { await forgotPassword(forgotEmail); setForgotSent(true); }
    catch { setForgotSent(true); }
    finally { setForgotLoading(false); }
  };

  const inp = {
    width: '100%', padding: '10px 14px', border: `1.5px solid ${C.tealXL}`, borderRadius: 9,
    fontSize: FS.lg, outline: 'none', background: C.white, transition: 'border-color .2s', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: `linear-gradient(135deg,${C.dark} 0%,${C.teal} 100%)`,
      display: 'flex', overflowY: 'auto', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 20px 80px', position: 'relative', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%,rgba(244,164,53,.12) 0%,transparent 50%)` }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: 420, position: 'relative', padding: '0 4px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🏫</div>
          <div style={{ fontFamily: FONTS.serif, color: C.white, fontSize: 28, fontWeight: 600, marginTop: 8 }}>Sekolah Rakyat</div>
          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: FS.base, marginTop: 4 }}>Portal Pembelajaran Digital</div>
        </div>

        <Card style={{ padding: 20 }}>
          {/* Google login */}
          <button onClick={() => setGoogleModal(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
            borderRadius: 10, border: `1.5px solid ${C.tealXL}`, background: C.white,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14, transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.background = C.tealXL; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.tealXL; e.currentTarget.style.background = C.white; }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xl, color: '#fff', fontWeight: 800, flexShrink: 0 }}>G</div>
            <div style={{ textAlign: 'left', flex: 1 }}><div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>Masuk dengan Google</div></div>
            <span style={{ fontSize: FS.lg, color: C.tealL }}>→</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: C.tealXL }} />
            <span style={{ fontSize: FS.sm, color: C.slate, fontWeight: 600 }}>atau masuk dengan email</span>
            <div style={{ flex: 1, height: 1, background: C.tealXL }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: FS.md, fontWeight: 600, color: C.darkL, display: 'block', marginBottom: 6 }}>Email atau NIS</label>
              <input value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="email@sekolahrakyat.id atau NIS" style={inp}
                onFocus={e => e.target.style.borderColor = C.teal}
                onBlur={e => e.target.style.borderColor = C.tealXL} />
            </div>
            <div>
              <label style={{ fontSize: FS.md, fontWeight: 600, color: C.darkL, display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={pass}
                  onChange={e => { setPass(e.target.value); setError(''); }}
                  placeholder="••••••••" style={{ ...inp, paddingRight: 40 }}
                  onFocus={e => e.target.style.borderColor = C.teal}
                  onBlur={e => e.target.style.borderColor = C.tealXL}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: C.slate }}>
                  {showPass ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { setForgotModal(true); setForgotSent(false); setForgotEmail(''); }}
                  style={{ background: 'none', border: 'none', color: C.teal, fontSize: FS.md, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  Lupa password?
                </button>
              </div>
            </div>

            {error && <div style={{ background: '#FFF5F5', color: C.red, border: '1px solid #FEB2B2', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>⚠ {error}</div>}

            <Btn variant="primary" onClick={handleLogin} disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: 12, marginTop: 4 }}>
              {loading ? <><Spinner size={16} color={C.white} /> Masuk...</> : 'Masuk →'}
            </Btn>
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,.35)', fontSize: 11 }}>
          © 2025 BPSDM Komdigi — AITF · Powered by Model AI Nusantara
        </div>
      </div>

      {/* Google Picker Modal */}
      {googleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="bounce-in" style={{ background: C.white, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#4285F4,#34A853)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 800, margin: '0 auto 10px' }}>G</div>
              <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark }}>Masuk dengan Google</div>
              <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 4 }}>Pilih akun yang ingin digunakan</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {GOOGLE_ACCOUNTS.map((acc, i) => (
                <button key={i} onClick={() => handleGoogleLogin(acc)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderRadius: 11, border: `1.5px solid ${C.tealXL}`, background: C.white,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.tealXL; e.currentTarget.style.borderColor = C.tealL; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.tealXL; }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: acc.avatarBg || C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.base, color: C.white, fontWeight: 700, flexShrink: 0 }}>{acc.avatar}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: FS.base, color: C.dark }}>{acc.nama}</div>
                    <div style={{ fontSize: FS.sm, color: C.slate }}>{acc.email}</div>
                  </div>
                  <span style={{ fontSize: FS.xs, background: C.tealXL, color: C.teal, padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>{roleBadge[acc.role] || acc.role}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setGoogleModal(false)} style={{ width: '100%', padding: 10, border: `1px solid ${C.tealXL}`, borderRadius: 9, background: 'teal', cursor: 'pointer', color: C.white, fontSize: 13 }}>Batal</button>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="bounce-in" style={{ background: C.white, borderRadius: 20, padding: 28, width: '100%', maxWidth: 360, boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
            {!forgotSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
                  <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark }}>Lupa Password?</div>
                  <div style={{ fontSize: FS.md, color: C.slate, marginTop: 6, lineHeight: 1.5 }}>Masukkan email yang terdaftar.</div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: FS.md, fontWeight: 600, color: C.darkL, display: 'block', marginBottom: 6 }}>Email</label>
                  <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                    placeholder="email@sekolahrakyat.id"
                    style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${C.tealXL}`, borderRadius: 9, fontSize: FS.lg, outline: 'none', background: C.white, boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.teal}
                    onBlur={e => e.target.style.borderColor = C.tealXL} />
                </div>
                <Btn variant="primary" onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail}
                  style={{ width: '100%', justifyContent: 'center', padding: 11, marginBottom: 10 }}>
                  {forgotLoading ? <><Spinner size={15} color={C.white} /> Mengirim...</> : 'Kirim Link Reset'}
                </Btn>
                <button onClick={() => setForgotModal(false)} style={{ width: '100%', padding: 10, border: `1px solid ${C.tealXL}`, borderRadius: 9, background: 'none', cursor: 'pointer', color: C.slate, fontSize: 13 }}>Batal</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                  <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark, marginBottom: 8 }}>Email Terkirim!</div>
                  <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.6 }}>Jika <strong>{forgotEmail}</strong> terdaftar, link reset dikirimkan.</div>
                </div>
                <Btn variant="primary" onClick={() => setForgotModal(false)} style={{ width: '100%', justifyContent: 'center', padding: 11 }}>Kembali ke Login</Btn>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}