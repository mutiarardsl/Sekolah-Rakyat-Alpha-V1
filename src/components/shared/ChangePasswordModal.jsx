/**
 * SR MVP — Change Password Modal
 * Tim 6 Fase 2 | src/components/shared/ChangePasswordModal.jsx
 */

import { useState } from 'react';
import { C, FONTS, FS } from '../../styles/tokens';
import { Btn } from './UI';
import { changePassword } from '../../api/auth'; // FIX: sambungkan ke PUT /auth/change-password

/* ── Field diangkat ke level modul agar tidak di-recreate tiap render ── */
const Field = ({ k, label, placeholder, value, showPwd, error, onChange, onToggleShow }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: "block", marginBottom: 5 }}>{label}</label>
    <div style={{ position: "relative" }}>
      <input type={showPwd ? "text" : "password"} value={value} onChange={e => onChange(k, e.target.value)}
        placeholder={placeholder} style={{
          width: "100%", padding: "10px 38px 10px 12px",
          border: `1.5px solid ${error ? C.red : C.tealXL}`, borderRadius: 9, fontSize: FS.base, outline: "none"
        }}
        onFocus={e => e.target.style.borderColor = error ? C.red : C.teal}
        onBlur={e => e.target.style.borderColor = error ? C.red : C.tealXL} />
      <button onClick={() => onToggleShow(k)}
        style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
          display: "flex", alignItems: "center", color: C.slate
        }}>
        {showPwd ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
    {error && <div style={{ fontSize: FS.sm, color: C.red, marginTop: 4 }}>⚠ {error}</div>}
  </div>
);

const ChangePasswordModal = ({ role = "siswa", userName = "", onClose, onSuccess }) => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [strength, setStrength] = useState(0);
  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => { const n = { ...p }; delete n[k]; return n; }); if (k === "next") setStrength(calcStr(v)); };
  const calcStr = (p) => { let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[!@#$%]/.test(p)) s++; return s; };
  const strLabel = ["", "Lemah", "Cukup", "Kuat", "Sangat Kuat"];
  const strColor = ["", C.red, C.amber, C.tealL, C.green];
  const validate = () => {
    const e = {};
    if (!form.current.trim()) e.current = "Password lama wajib diisi.";
    if (!form.next) e.next = "Password baru wajib diisi.";
    else if (form.next.length < 8) e.next = "Minimal 8 karakter.";
    else if (!/[A-Z]/.test(form.next)) e.next = "Harus ada huruf kapital.";
    else if (!/[0-9]/.test(form.next)) e.next = "Harus ada angka.";
    else if (form.next === form.current) e.next = "Tidak boleh sama dengan password lama.";
    if (!form.confirm) e.confirm = "Konfirmasi wajib diisi.";
    else if (form.confirm !== form.next) e.confirm = "Tidak cocok.";
    return e;
  };
  const submit = async () => {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      // FIX: panggil PUT /auth/change-password — bukan setTimeout dummy
      await changePassword({ old_password: form.current, new_password: form.next });
      setSuccess(true);
      setTimeout(() => { onSuccess?.(); onClose(); }, 1500);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Gagal mengganti password. Periksa password lama Anda.';
      setErrors(p => ({ ...p, current: msg }));
    } finally {
      setLoading(false);
    }
  };
  const toggleShow = (k) => setShow(p => ({ ...p, [k]: !p[k] }));
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(26,35,50,.55)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 1200, backdropFilter: "blur(4px)"
    }} onClick={onClose}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 18, padding: 28, width: 420, boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: FS.h3, color: C.dark }}>Password berhasil diubah!</div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>🔐 Ganti Password</div>
            <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 18 }}>{role === "guru" ? "Portal Guru" : "Portal Siswa"} · {userName}</div>
            <Field k="current" label="Password Lama" placeholder="Masukkan password lama"
              value={form.current} showPwd={show.current} error={errors.current}
              onChange={set} onToggleShow={toggleShow} />
            <Field k="next" label="Password Baru" placeholder="Minimal 8 karakter, huruf kapital, angka"
              value={form.next} showPwd={show.next} error={errors.next}
              onChange={set} onToggleShow={toggleShow} />
            {form.next && <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: strength >= i ? strColor[strength] : "#E8EFF5", transition: "background .3s" }} />)}
              </div>
              <div style={{ fontSize: FS.sm, color: strColor[strength], fontWeight: 700 }}>{strLabel[strength]}</div>
            </div>}
            <Field k="confirm" label="Konfirmasi Password Baru" placeholder="Ulangi password baru"
              value={form.confirm} showPwd={show.confirm} error={errors.confirm}
              onChange={set} onToggleShow={toggleShow} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: "center" }}>Batal</Btn>
              <Btn variant="primary" onClick={submit} disabled={loading} style={{ flex: 2, justifyContent: "center" }}>
                {loading ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} /> Menyimpan...</> : "💾 Simpan Password"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── AUTH SCREENS (format asli, tanpa webcam) ─────────────────────
const SplashScreen = ({ onNavigate }) => {
  // FIX: Alih-alih menyimpan state mode di dalam SplashScreen dan
  // me-render <LoginScreen> dari sini (yang menyebabkan konflik DOM tree
  // saat React mencoba remove node dari container yang salah),
  // kita delegasikan navigasi ke parent (App) via onNavigate("login").
  // Parent yang mengontrol screen mana yang di-render — React bisa
  // reconcile dengan benar karena hanya satu komponen yang mount sekaligus.
  useEffect(() => {
    const t = setTimeout(() => onNavigate("login"), 2200);
    return () => clearTimeout(t);
  }, [onNavigate]);

  return (
    <div style={{
      minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark} 0%, ${C.teal} 60%, ${C.tealL} 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, position: "relative", overflow: "hidden"
    }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", borderRadius: "50%", border: `1px solid rgba(255,255,255,.08)`,
          width: 120 + i * 100, height: 120 + i * 100, top: "50%", left: "50%", transform: "translate(-50%,-50%)"
        }} />
      ))}
      <div className="bounce-in" style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🏫</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: 42, fontWeight: 600, color: C.white, letterSpacing: "-1px" }}>Sekolah Rakyat</div>
        <div style={{ color: "rgba(255,255,255,.65)", fontSize: FS.xl, marginTop: 4, fontStyle: "italic" }}>Model AI Pendidikan Nusantara</div>
        <div style={{ marginTop: 32, display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map(i => (<div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber, animation: `pulse 1.2s ${i * .3}s infinite` }} />))}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 32, color: "rgba(255,255,255,.4)", fontSize: 12 }}>BPSDM Komdigi · AITF</div>
    </div>
  );
};

const LoginScreen = ({ onNavigate }) => {
  const [role, setRole] = useState("siswa");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const handleLogin = () => {
    if (!email || !pass) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === "siswa") onNavigate("student");
      else if (role === "guru") onNavigate("teacher");
      else onNavigate("admin");
    }, 1200);
  };
  const roleConfig = {
    siswa: { label: "🎒 Siswa", placeholder: "nis@sekolahrakyat.id" },
    guru: { label: "👨‍🏫 Guru", placeholder: "guru@sekolahrakyat.id" },
    admin: { label: "🔑 Admin", placeholder: "admin@sekolahrakyat.id" },
  };
  return (
    <div style={{
      minHeight: "100vh", background: `linear-gradient(135deg, ${C.dark} 0%, ${C.teal} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative"
    }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(244,164,53,.12) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,.04) 0%, transparent 40%)` }} />
      <div className="fade-in" style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🏫</div>
          <div style={{ fontFamily: FONTS.serif, color: C.white, fontSize: 28, fontWeight: 600, marginTop: 8 }}>Sekolah Rakyat</div>
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: FS.base, marginTop: 4 }}>Portal Pembelajaran Digital</div>
        </div>
        <Card style={{ padding: 32 }}>
          <div style={{ display: "flex", background: C.cream, borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
            {["siswa", "guru", "admin"].map(r => (
              <button key={r} onClick={() => setRole(r)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, border: "none", fontFamily: "inherit",
                  fontWeight: 600, fontSize: FS.md, cursor: "pointer", transition: "all .2s",
                  background: role === r ? C.teal : "transparent",
                  color: role === r ? C.white : C.darkL
                }}>
                {roleConfig[r].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: FS.md, fontWeight: 600, color: C.darkL, display: "block", marginBottom: 6 }}>Email {role === "siswa" ? "/ NIS" : ""}</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                placeholder={roleConfig[role].placeholder}
                style={{
                  width: "100%", padding: "10px 14px", border: `1.5px solid ${C.tealXL}`,
                  borderRadius: 9, fontSize: FS.lg, outline: "none", background: C.cream
                }}
                onFocus={e => e.target.style.borderColor = C.teal}
                onBlur={e => e.target.style.borderColor = C.tealXL} />
            </div>
            <div>
              <label style={{ fontSize: FS.md, fontWeight: 600, color: C.darkL, display: "block", marginBottom: 6 }}>Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••"
                style={{
                  width: "100%", padding: "10px 14px", border: `1.5px solid ${C.tealXL}`,
                  borderRadius: 9, fontSize: FS.lg, outline: "none", background: C.cream
                }}
                onFocus={e => e.target.style.borderColor = C.teal}
                onBlur={e => e.target.style.borderColor = C.tealXL}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <Btn variant="primary" onClick={handleLogin} disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: 4 }}>
              {loading ? <><span style={{
                width: 16, height: 16, border: "2px solid rgba(255,255,255,.3)",
                borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite", display: "inline-block"
              }} /> Masuk...</> : "Masuk →"}
            </Btn>
          </div>
          {role !== "admin" && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span style={{ fontSize: FS.base, color: C.darkL }}>Belum punya akun? </span>
              <button onClick={() => onNavigate("register")} style={{ background: "none", border: "none", color: C.teal, fontWeight: 600, fontSize: FS.base, cursor: "pointer" }}>Daftar sekarang</button>
            </div>
          )}
        </Card>
        <div style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,.35)", fontSize: 11 }}>
          © 2025 BPSDM Komdigi — AITF · Powered by Model AI Nusantara
        </div>
      </div>
    </div>
  );
};


export default ChangePasswordModal;