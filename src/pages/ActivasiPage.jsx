/**
 * SR MVP — Halaman Aktivasi Akun Siswa — FASE 3 REVISED v4
 * src/pages/ActivasiPage.jsx
 *
 * Alur (enroll key dihapus — admin sudah menetapkan identitas & kelas):
 *   Siswa login dengan NIS + password sementara
 *   → Sistem deteksi is_first_login: true → redirect ke sini
 *
 *   Step 1: Ganti password (min 8 karakter)
 *     - Tidak bisa skip
 *     - Setelah berhasil → status: "Aktif", is_first_login: false
 *
 *   Step 2: Pilih mata pelajaran (3 mapel)
 *     → Masuk dashboard siswa
 *
 * Catatan: enroll key dihapus karena admin sudah memverifikasi
 * identitas, email/NIS, dan kelas siswa saat bulk upload.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { aktivasiAkun } from '../api/auth'; // FIX ⑤: import aktivasiAkun
import { C, FONTS, FS } from '../styles/tokens';
import { Btn, Spinner } from '../components/shared/UI';
import { ADMIN_MAPEL_LIST, KURIKULUM_ELEMEN } from '../data/masterData';
import { useStudentStore } from '../stores/studentStore';

/* ── Password strength ─────────────────────────────────────────────── */
const calcStr = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
};
const STR_LABEL = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
const STR_COLOR = ['', '#E53E3E', '#B7791F', '#1A8A94', '#276749'];

const TOTAL_STEPS = 2;

export default function ActivasiPage() {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();

    const [step, setStep] = useState(1);
    const [pass, setPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [selectedMapelsDraft, setSelectedMapelsDraft] = useState([]);
    const { setSelectedMapels } = useStudentStore();

    const MAPEL_LIST = ADMIN_MAPEL_LIST.filter(m => KURIKULUM_ELEMEN[m.id]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});

    const str = calcStr(pass);
    const siswaName = user?.nama || 'Siswa';
    const siswaInitials = siswaName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const siswaKelas = user?.kelasId || 'Kelas';
    const siswaEmail = user?.email || user?.nis || '—';

    const inp = (err) => ({
        width: '100%', padding: '10px 14px', boxSizing: 'border-box',
        border: `1.5px solid ${err ? '#E53E3E' : C.tealXL}`, borderRadius: 9,
        fontSize: FS.lg, outline: 'none', background: C.white, transition: 'border-color .2s',
        fontFamily: 'inherit',
    });

    /* ── Step 1: Set Password ──────────────────────────────────── */
    // FIX ⑤: implementasi aktivasiAkun() via POST /auth/aktivasi
    //  - user_id diambil dari sesi login (user.id)
    //  - setelah sukses baru update local state dan lanjut ke step 2
    const handleSetPassword = async () => {
        const e = {};
        if (pass.length < 8) e.pass = 'Password minimal 8 karakter';
        else if (calcStr(pass) < 2) e.pass = 'Password terlalu lemah — tambahkan huruf kapital atau angka';
        if (pass !== confirmPass) e.confirm = 'Password tidak cocok';
        if (Object.keys(e).length) { setErrors(e); return; }

        setLoading(true); setError('');
        try {
            await aktivasiAkun({ password: pass, user_id: user?.id });
            updateUser({ is_first_login: false, status: 'Aktif' });
            setStep(2);
        } catch (err) {
            setError(err?.response?.data?.message || 'Gagal mengaktifkan akun. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    /* ── Step 2: Pilih Mapel ───────────────────────────────────── */
    const handlePilihMapel = () => {
        if (selectedMapelsDraft.length === 3) {
            setSelectedMapels(selectedMapelsDraft, user?.id);
            navigate('/siswa', { replace: true });
        }
    };

    const stepLabels = ['Buat Password', 'Pilih Mapel'];

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(135deg,${C.dark} 0%,${C.teal} 100%)`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '20px 20px', boxSizing: 'border-box',
            position: 'relative', overflowY: 'auto',
        }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%,rgba(244,164,53,.12) 0%,transparent 50%)`, pointerEvents: 'none' }} />

            <div className="fade-in" style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>

                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: 30 }}>🔑</div>
                    <div style={{ fontFamily: FONTS.serif, color: C.white, fontSize: FS.h2, fontWeight: 600 }}>
                        Aktivasi Akun
                    </div>
                    <div style={{ color: 'rgba(255,255,255,.6)', fontSize: FS.md, marginTop: 4 }}>
                        {step === 1 && `Halo, ${siswaName.split(' ')[0]}! Buat password baru untuk masuk`}
                        {step === 2 && 'Satu langkah lagi — pilih mapelmu'}
                    </div>

                    {/* Step indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
                        {stepLabels.map((label, i) => {
                            const idx = i + 1;
                            const done = step > idx;
                            const active = step === idx;
                            return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%',
                                            background: done ? '#276749' : active ? '#B7791F' : 'rgba(255,255,255,.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: FS.sm, fontWeight: 600,
                                            color: done || active ? C.white : 'rgba(255,255,255,.4)',
                                            transition: 'all .3s',
                                        }}>
                                            {done ? '✓' : idx}
                                        </div>
                                        <span style={{ fontSize: FS.xs, color: active ? C.amberL : done ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>
                                            {label}
                                        </span>
                                    </div>
                                    {idx < TOTAL_STEPS && (
                                        <div style={{ width: 40, height: 2, background: step > idx ? '#276749' : 'rgba(255,255,255,.15)', margin: '0 6px', marginBottom: 18, transition: 'background .3s' }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ background: C.white, borderRadius: 18, padding: '20px 20px', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>

                    {/* ── STEP 1: Set Password ── */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Info siswa dari sesi login */}
                            <div style={{ background: `${C.teal}0A`, border: `1px solid ${C.tealXL}`, borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.lg, color: C.white, fontWeight: 800, flexShrink: 0 }}>
                                    {siswaInitials}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>{siswaName}</div>
                                    <div style={{ fontSize: FS.sm, color: C.slate }}>{siswaEmail}. {siswaKelas}</div>
                                </div>
                                <span style={{ fontSize: FS.xs, padding: '3px 9px', borderRadius: 99, background: '#FFF8EE', color: '#B7791F', fontWeight: 700, border: '1px solid #F6AD55', flexShrink: 0 }}>
                                    ⏳ Belum Aktif
                                </span>
                            </div>

                            <div style={{ background: '#FFFBF0', border: '1px solid #F6AD55', borderRadius: 10, padding: '4px 14px', fontSize: FS.sm, color: '#744210', lineHeight: 1.7 }}>
                                🔒 Buat password baru yang kuat untuk login selanjutnya.<br />
                                <b>Jangan bagikan password kepada siapapun.</b>
                            </div>

                            <div>
                                <label style={{ fontSize: FS.md, fontWeight: 700, color: C.darkL, display: 'block', marginBottom: 6 }}>Password Baru</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showPass ? 'text' : 'password'} value={pass}
                                        onChange={e => { setPass(e.target.value); setErrors(p => ({ ...p, pass: null })); }}
                                        placeholder="Min 8 karakter"
                                        style={{ ...inp(errors.pass), paddingRight: 44 }}
                                        onFocus={e => e.target.style.borderColor = C.teal}
                                        onBlur={e => e.target.style.borderColor = errors.pass ? '#E53E3E' : C.tealXL}
                                    />
                                    <button onClick={() => setShowPass(p => !p)}
                                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: C.slate }}>
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
                                {pass && (
                                    <div style={{ marginTop: 4 }}>
                                        <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= str ? STR_COLOR[str] : C.tealXL, transition: 'background .3s' }} />
                                            ))}
                                        </div>
                                        <div style={{ fontSize: FS.xs, color: STR_COLOR[str], fontWeight: 700 }}>{STR_LABEL[str]}</div>
                                    </div>
                                )}
                                {errors.pass && <div style={{ fontSize: FS.sm, color: '#E53E3E', marginTop: 4 }}>⚠ {errors.pass}</div>}
                            </div>

                            <div>
                                <label style={{ fontSize: FS.md, fontWeight: 700, color: C.darkL, display: 'block', marginBottom: 6 }}>Konfirmasi Password</label>
                                <input type="password" value={confirmPass}
                                    onChange={e => { setConfirmPass(e.target.value); setErrors(p => ({ ...p, confirm: null })); }}
                                    placeholder="Ulangi password baru"
                                    style={{ ...inp(errors.confirm), borderColor: errors.confirm ? '#E53E3E' : confirmPass && confirmPass === pass ? '#276749' : C.tealXL }}
                                    onFocus={e => e.target.style.borderColor = C.teal}
                                    onBlur={e => e.target.style.borderColor = confirmPass === pass ? '#276749' : C.tealXL}
                                    onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                                />
                                {confirmPass && confirmPass === pass && <div style={{ fontSize: FS.sm, color: '#276749', marginTop: 4 }}>✓ Password cocok</div>}
                                {errors.confirm && <div style={{ fontSize: FS.sm, color: '#E53E3E', marginTop: 4 }}>⚠ {errors.confirm}</div>}
                            </div>

                            {error && (
                                <div style={{ background: '#FFF5F5', color: '#E53E3E', border: '1px solid #FEB2B2', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>⚠ {error}</div>
                            )}

                            <Btn variant="primary" onClick={handleSetPassword} disabled={loading || !pass || !confirmPass}
                                style={{ width: '100%', justifyContent: 'center', padding: 8, fontSize: 13 }}>
                                {loading ? <><Spinner size={11} color={C.white} /> Mengaktifkan…</> : 'Aktifkan Akun →'}
                            </Btn>

                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: FS.md, color: C.darkL }}>Bukan akun kamu? </span>
                                <button onClick={() => navigate('/login')}
                                    style={{ background: 'none', border: 'none', color: C.teal, fontWeight: 700, fontSize: FS.md, cursor: 'pointer' }}>
                                    Kembali ke Login
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Pilih Mapel ── */}
                    {step === 2 && (
                        <div className="bounce-in">
                            <div style={{ textAlign: 'center', marginBottom: 18, marginTop: -6 }}>
                                <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
                                <div style={{ fontWeight: 700, fontSize: FS.lg, color: '#276749', marginBottom: 4 }}>Akun berhasil diaktifkan!</div>
                                <div style={{ fontSize: FS.md, color: C.darkL, lineHeight: 1 }}>
                                    Pilih <strong style={{ color: C.teal }}>3 mata pelajaran</strong> untuk memulai belajarmu.
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 14 }}>
                                {MAPEL_LIST.map(m => {
                                    const selected = selectedMapelsDraft.includes(m.id);
                                    const maxReached = selectedMapelsDraft.length >= 3 && !selected;
                                    return (
                                        <button key={m.id} onClick={() => {
                                            if (maxReached) return;
                                            setSelectedMapelsDraft(prev =>
                                                prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
                                            );
                                        }} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '7px 13px', borderRadius: 99,
                                            border: `1.5px solid ${selected ? m.color : C.tealXL}`,
                                            background: selected ? `${m.color}15` : C.white,
                                            cursor: maxReached ? 'not-allowed' : 'pointer',
                                            opacity: maxReached ? 0.4 : 1,
                                            fontFamily: 'inherit', transition: 'all .2s', whiteSpace: 'nowrap',
                                            color: selected ? m.color : C.darkL,
                                            fontWeight: selected ? 700 : 500, fontSize: FS.sm,
                                        }}>
                                            <span style={{ fontSize: 14 }}>{m.icon}</span>
                                            {m.label}
                                            {selected && <span style={{ width: 14, height: 14, borderRadius: '50%', background: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xs, color: C.white, fontWeight: 800 }}>✓</span>}
                                        </button>
                                    );
                                })}
                            </div>

                            <Btn variant="primary" onClick={handlePilihMapel}
                                disabled={selectedMapelsDraft.length < 3}
                                style={{ width: '100%', justifyContent: 'center', padding: 10, fontSize: FS.base, opacity: selectedMapelsDraft.length < 3 ? 0.5 : 1 }}>
                                {selectedMapelsDraft.length < 3
                                    ? `Pilih ${3 - selectedMapelsDraft.length} mapel lagi`
                                    : 'Mulai Belajar →'}
                            </Btn>
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 14, color: 'rgba(255,255,255,.35)', fontSize: 11 }}>
                    © 2025 BPSDM Komdigi — AITF · Powered by Model AI Nusantara
                </div>
            </div>
        </div>
    );
}