/**
 * SR MVP — Login Page v6
 * src/pages/LoginPage.jsx
 *
 * Layout: split full-height — kiri 60% branding, kanan 40% form
 * Warna: token asli (dark #1A2332, teal #0D5C63, amber #F4A435)
 * Tidak ada card menonjol — form langsung di atas background panel
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { C, FONTS, FS } from '../styles/tokens';
import { Spinner } from '../components/shared/UI';

const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const EyeOn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [tcOpen, setTcOpen] = useState(false);

  const routeByRole = u => {
    if (u.role === 'admin') return navigate('/admin', { replace: true });
    if (u.role === 'guru') return navigate('/guru', { replace: true });
    if (u.is_first_login) return navigate('/aktivasi', { replace: true });
    navigate('/siswa', { replace: true });
  };

  const handleLogin = async () => {
    if (!email || !pass) { setError('Email/NIS dan password wajib diisi.'); return; }
    if (!agreed) { setError('Harap setujui Syarat & Ketentuan terlebih dahulu.'); return; }
    setLoading(true); setError('');
    try { routeByRole(await login(email, pass)); }
    catch { setError('Email/NIS atau password salah.'); }
    finally { setLoading(false); }
  };

  const handleForgot = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    try { await forgotPassword(forgotEmail); }
    catch { /* selalu tampil sukses */ }
    finally { setForgotSent(true); setForgotLoading(false); }
  };

  const openForgot = () => { setForgotOpen(true); setForgotSent(false); setForgotEmail(''); };

  /* ─── shared input style ─── */
  const inp = (extra = {}) => ({
    width: '100%',
    padding: '11px 14px',
    border: `1.5px solid ${C.tealXL}`,
    borderRadius: 10,
    fontSize: FS.base,
    outline: 'none',
    background: '#F7F9FA',
    color: C.dark,
    fontFamily: FONTS.sans,
    boxSizing: 'border-box',
    transition: 'border-color .2s, background .2s',
    ...extra,
  });

  /* ─── modal input style (on white bg) ─── */
  const minp = (extra = {}) => ({
    width: '100%',
    padding: '11px 14px',
    border: `1.5px solid ${C.tealXL}`,
    borderRadius: 10,
    fontSize: FS.base,
    outline: 'none',
    background: '#F7F9FA',
    color: C.dark,
    fontFamily: FONTS.sans,
    boxSizing: 'border-box',
    transition: 'border-color .2s',
    ...extra,
  });

  const LBL = {
    display: 'block', fontSize: FS.md, fontWeight: 700,
    color: C.darkL, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase'
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:wght@600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }

        /* ── layout ── */
        .lg-root  { display:flex; height:100vh; min-height:600px; font-family:'Plus Jakarta Sans',sans-serif; overflow:hidden; }
        .lg-left  { position:relative; flex:0 0 55%; background:linear-gradient(140deg,${C.dark} 0%,${C.darkM} 50%,#1D4E55 100%); display:flex; flex-direction:column; justify-content:space-between; padding:48px 56px; overflow:hidden; }
        .lg-right { flex:0 0 45%; background:${C.white}; display:flex; flex-direction:column; justify-content:center; padding:48px 52px; overflow-y:auto; }

        /* left decorations */
        .lg-orb1 { position:absolute; width:420px; height:420px; border-radius:50%; background:radial-gradient(circle,rgba(26,138,148,.18) 0%,transparent 65%); top:-100px; right:-80px; pointer-events:none; }
        .lg-orb2 { position:absolute; width:260px; height:260px; border-radius:50%; background:radial-gradient(circle,rgba(244,164,53,.10) 0%,transparent 65%); bottom:60px; left:-60px; pointer-events:none; }
        .lg-orb3 { position:absolute; width:140px; height:140px; border-radius:50%; background:radial-gradient(circle,rgba(26,138,148,.12) 0%,transparent 65%); top:45%; right:15%; pointer-events:none; }

        /* logo */
        .lg-logo { position:relative; z-index:1; display:flex; align-items:center; gap:12px; }
        .lg-logo-icon { 
          width:44px; height:44px; 
          border-radius:10px; 
          background:rgba(255,255,255,.10); 
          border:1px solid rgba(255,255,255,.15);
          display:flex; align-items:center; justify-content:center;
          font-size:24px; line-height:1; 
          flex-shrink:0;
        }
        .lg-logo-name { font-family:'Source Serif 4',serif; font-size:18px; font-weight:600; color:rgba(255,255,255,.92); letter-spacing:.01em; line-height:1; }

        /* hero text */
        .lg-hero { position:relative; z-index:1; }
        .lg-title { font-size:46px; font-weight:800; color:${C.white}; line-height:1.12; letter-spacing:-.04em; margin-bottom:16px; }
        .lg-title span { color:${C.amber}; }
        .lg-desc { font-size:14px; color:rgba(255,255,255,.5); line-height:1.7; max-width:340px; }
        .lg-pills { display:flex; flex-wrap:wrap; gap:8px; margin-top:24px; }
        .lg-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); border-radius:99px; padding:6px 14px; font-size:12px; font-weight:600; color:rgba(255,255,255,.72); }

        /* footer */
        .lg-foot { position:relative; z-index:1; font-size:11px; color:rgba(255,255,255,.22); line-height:1.65; }

        /* ── right panel ── */
        .lg-form-title { font-size:28px; font-weight:800; color:${C.dark}; letter-spacing:-.03em; margin-bottom:6px; }
        .lg-form-sub   { font-size:13px; color:${C.slate}; margin-bottom:36px; line-height:1.55; }

        /* input focus */
        .lg-inp::placeholder {color:#A0AEC0;}
        .lg-inp:focus { border-color:${C.teal} !important; background:#F7F9FA !important; outline:none; }

        /* primary button */
        .lg-btn {
          width:100%; padding:13px; border-radius:10px; border:none;
          background:${C.teal}; color:${C.white};
          font-size:14px; font-weight:700; cursor:pointer;
          font-family:inherit; letter-spacing:.01em;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:background .18s, transform .15s, box-shadow .15s;
        }
        .lg-btn:hover:not(:disabled) { background:${C.darkM}; transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,0,0,.35); }
        .lg-btn:active:not(:disabled) { transform:translateY(0); }
        .lg-btn:disabled { opacity:.5; cursor:not-allowed; }

        /* forgot link */
        .lg-forgot { background:none; border:none; color:${C.teal}; font-size:12px; font-weight:700; cursor:pointer; padding:0; font-family:inherit; transition:color .15s; }
        .lg-forgot:hover { color:${C.dark}; }

        /* pw toggle */
        .lg-eye { position:absolute; right:13px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#A0AEC0; display:flex; padding:0; transition:color .15s; }
        .lg-eye:hover { color:${C.dark}; }

        /* error */
        .lg-err { background:#FFF5F5; color:#C53030; border:1px solid #FC8181; border-radius:9px; padding:9px 13px; font-size:12px; font-weight:500; }

        /* checkbox */
        .lg-cb { width:17px; height:17px; border:2px solid ${C.tealXL}; border-radius:5px; flex-shrink:0; margin-top:1px; display:flex; align-items:center; justify-content:center; transition:background .15s,border-color .15s; cursor:pointer; }
        .lg-cb.on { background:${C.teal}; border-color:${C.teal}; }
        .lg-tc-link { background:none; border:none; color:${C.teal}; font-weight:700; text-decoration:underline; cursor:pointer; font-family:inherit; font-size:inherit; padding:0; }
        .lg-tc-link:hover { color:${C.dark}; }

        /* modal */
        .lg-bd { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px; }
        .lg-modal { background:${C.white}; border-radius:18px; padding:30px; width:100%; max-width:400px; box-shadow:0 24px 60px rgba(0,0,0,.3); animation:mIn .2s ease; }
        .lg-modal-wide { max-width:460px; }
        @keyframes mIn { from{opacity:0;transform:scale(.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)} }
        .lg-modal-inp::placeholder { color:#C0CDD8; }
        .lg-modal-inp:focus { border-color:${C.teal} !important; box-shadow:0 0 0 3px rgba(13,92,99,.08); outline:none; }
        .lg-modal-btn { width:100%; padding:12px; border-radius:10px; border:none; background:${C.teal}; color:${C.white}; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:7px; transition:background .15s; }
        .lg-modal-btn:hover:not(:disabled) { background:${C.dark}; }
        .lg-modal-btn:disabled { opacity:.5; cursor:not-allowed; }
        .lg-modal-cancel { width:100%; padding:11px; border:1.5px solid ${C.tealXL}; border-radius:10px; background:none; cursor:pointer; color:${C.darkL}; font-size:13px; font-family:inherit; font-weight:600; margin-top:9px; transition:background .15s; }
        .lg-modal-cancel:hover { background:${C.bg}; }
        .lg-tc-scroll { max-height:290px; overflow-y:auto; font-size:12px; color:${C.darkL}; line-height:1.7; border:1px solid ${C.tealXL}; border-radius:9px; padding:14px; margin-bottom:18px; }
        .lg-tc-scroll h4 { font-size:12px; font-weight:700; color:${C.dark}; margin:12px 0 4px; }
        .lg-tc-scroll h4:first-child { margin-top:0; }

        /* responsive */
        @media(max-width:700px){
          .lg-root { flex-direction:column; height:auto; min-height:100vh; }
          .lg-left  { flex:none; padding:28px 24px 32px; }
          .lg-right { flex:none; padding:36px 24px 48px; }
          .lg-title { font-size:32px; }
          .lg-hero  { margin-bottom:0; }
          .lg-desc,.lg-pills { display:none; }
        }
      `}</style>

      <div className="lg-root">

        {/* ══════════ LEFT 60% ══════════ */}
        <div className="lg-left">
          <div className="lg-orb1" /><div className="lg-orb2" /><div className="lg-orb3" />

          {/* Logo */}
          <div className="lg-logo">
            <div className="lg-logo-icon">🏫</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="lg-logo-name">Sekolah Rakyat</span>
            </div>
          </div>

          {/* Hero */}
          <div className="lg-hero">
            <div className="lg-title">
              Portal<br /><span>Pembelajaran</span><br />Digital
            </div>
          </div>

          {/* Footer */}
          <div className="lg-foot">
            © 2025 BPSDM Komdigi — AITF<br />
            Powered by Model AI Nusantara
          </div>
        </div>

        {/* ══════════ RIGHT 40% ══════════ */}
        <div className="lg-right">
          <div className="lg-form-title" style={{ textAlign: "center" }}>Masuk</div>
          <div className="lg-form-sub" style={{ textAlign: "center" }}>
            Selamat Datang! Silahkan masuk dengan akun mu.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email/NIS */}
            <div>
              <label style={LBL}>Email atau NIS</label>
              <input
                className="lg-inp"
                style={inp()}
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="email@sekolahrakyat.id atau NIS"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            {/* Password */}
            <div>
              <label style={LBL}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="lg-inp"
                  style={inp({ paddingRight: 42 })}
                  type={showPw ? 'text' : 'password'}
                  value={pass}
                  onChange={e => { setPass(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <button className="lg-eye" onClick={() => setShowPw(p => !p)}>
                  {showPw ? <EyeOff /> : <EyeOn />}
                </button>
              </div>

              {/* Forgot password */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 6 }}>
                <button className="lg-forgot" onClick={openForgot}>Lupa password?</button>
              </div>
            </div>

            {/* Error */}
            {error && <div className="lg-err">⚠ {error}</div>}

            {/* Button */}
            <button className="lg-btn" onClick={handleLogin} disabled={loading}>
              {loading ? <><Spinner size={15} color="#fff" /> Masuk...</> : 'Masuk →'}
            </button>

            {/* T&C */}
            <div
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}
              onClick={() => setAgreed(p => !p)}
            >
              <div className={`lg-cb${agreed ? ' on' : ''}`}>
                {agreed && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 12, color: C.slate, lineHeight: 1.55, userSelect: 'none' }}>
                Saya menyetujui{' '}
                <button className="lg-tc-link" onClick={e => { e.stopPropagation(); setTcOpen(true); }}>
                  Syarat &amp; Ketentuan
                </button>
                {' '}penggunaan platform Sekolah Rakyat.
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* ══ MODAL: LUPA PASSWORD ══ */}
      {forgotOpen && (
        <div className="lg-bd" onClick={() => setForgotOpen(false)}>
          <div className="lg-modal" onClick={e => e.stopPropagation()}>
            {!forgotSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 22 }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>🔒</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: C.dark, letterSpacing: '-.02em', marginBottom: 6 }}>Lupa Password?</div>
                  <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.55 }}>
                    Masukkan email terdaftar. Link reset akan dikirim ke email Anda.
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: C.darkL, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</label>
                  <input
                    className="lg-modal-inp"
                    style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${C.tealXL}`, borderRadius: 10, fontSize: 14, outline: 'none', background: '#F7F9FA', color: C.dark, fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color .2s' }}
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleForgot()}
                    placeholder="email@sekolahrakyat.id"
                    onFocus={e => e.target.style.borderColor = C.teal}
                    onBlur={e => e.target.style.borderColor = C.tealXL}
                  />
                </div>
                <button className="lg-modal-btn" onClick={handleForgot} disabled={forgotLoading || !forgotEmail}>
                  {forgotLoading ? <><Spinner size={14} color="#fff" /> Mengirim...</> : 'Kirim Link Reset'}
                </button>
                <button className="lg-modal-cancel" onClick={() => setForgotOpen(false)}>Batal</button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '4px 0 22px' }}>
                  <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: C.dark, letterSpacing: '-.02em', marginBottom: 8 }}>Email Terkirim!</div>
                  <div style={{ fontSize: 13, color: C.slate, lineHeight: 1.6 }}>
                    Jika <strong style={{ color: C.dark }}>{forgotEmail}</strong> terdaftar, link reset telah dikirim. Cek kotak masuk atau folder spam.
                  </div>
                </div>
                <button className="lg-modal-btn" onClick={() => setForgotOpen(false)}>Kembali ke Login</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL: SYARAT & KETENTUAN ══ */}
      {tcOpen && (
        <div className="lg-bd" onClick={() => setTcOpen(false)}>
          <div className="lg-modal lg-modal-wide" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, color: C.dark, letterSpacing: '-.02em', marginBottom: 16 }}>
              📋 Syarat &amp; Ketentuan
            </div>
            <div className="lg-tc-scroll">
              <h4>1. Penggunaan Platform</h4>
              Platform Sekolah Rakyat diperuntukkan bagi siswa, guru, dan admin yang terdaftar secara resmi melalui program BPSDM Komdigi — AITF. Akses diberikan oleh admin sekolah dan tidak dapat dipindahtangankan.
              <h4>2. Keamanan Akun</h4>
              Pengguna bertanggung jawab menjaga kerahasiaan kredensial (email/NIS dan password). Dilarang berbagi akun dengan pihak lain. Segera laporkan akses tidak sah kepada admin sekolah.
              <h4>3. Konten &amp; Perilaku</h4>
              Pengguna wajib menggunakan platform secara bertanggung jawab. Dilarang menyebarkan konten yang melanggar hukum, mengandung SARA, atau merugikan pihak lain. Pelanggaran dapat mengakibatkan penonaktifan akun.
              <h4>4. Privasi Data</h4>
              Data pribadi pengguna dikelola sesuai kebijakan privasi BPSDM Komdigi dan hanya digunakan untuk keperluan pembelajaran serta administrasi program Sekolah Rakyat.
              <h4>5. Perubahan Ketentuan</h4>
              BPSDM Komdigi berhak memperbarui syarat dan ketentuan ini sewaktu-waktu. Pengguna akan diberitahu melalui platform jika terdapat perubahan signifikan.
            </div>
            <button className="lg-modal-btn" onClick={() => { setAgreed(true); setTcOpen(false); }}>
              ✓ Saya Setuju &amp; Tutup
            </button>
            <button className="lg-modal-cancel" onClick={() => setTcOpen(false)}>Tutup</button>
          </div>
        </div>
      )}
    </>
  );
}
