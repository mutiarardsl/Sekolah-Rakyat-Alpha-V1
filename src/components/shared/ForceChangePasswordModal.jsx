/**
 * SR MVP — Forced Change Password Modal (First Login)
 * src/components/shared/ForceChangePasswordModal.jsx
 *
 * Muncul otomatis saat guru login pertama kali (is_first_login: true).
 * Tidak bisa ditutup / diabaikan — wajib ganti password dulu.
 */

import { useState } from 'react';
import { C, FONTS, FS } from '../../styles/tokens';
import { Btn } from './UI';
import { changePassword } from '../../api/auth'; // CONTRACT V3.6 §8 PATCH /auth/password

const calcStr = (p) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[!@#$%^&*]/.test(p)) s++;
    return s;
};

const STR_LABEL = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
const STR_COLOR = ['', C.red, C.amber, C.tealL, C.green];

const Field = ({ label, type, value, show, error, onChange, onToggle, placeholder }) => (
    <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>{label}</label>
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    width: '100%', padding: '10px 38px 10px 12px', boxSizing: 'border-box',
                    border: `1.5px solid ${error ? C.red : C.tealXL}`, borderRadius: 9, fontSize: FS.base, outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = error ? C.red : C.teal}
                onBlur={e => e.target.style.borderColor = error ? C.red : C.tealXL}
            />
            <button onClick={onToggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: FS.lg, color: C.slate, cursor: 'pointer' }}>
                {show ? '🙈' : '👁'}
            </button>
        </div>
        {error && <div style={{ fontSize: FS.sm, color: C.red, marginTop: 4 }}>⚠ {error}</div>}
    </div>
);

export default function ForceChangePasswordModal({ userName = '', role = 'guru', userId, onSuccess }) {
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const str = calcStr(newPass);

    const validate = () => {
        const e = {};
        if (!newPass) e.new = 'Password baru wajib diisi.';
        else if (newPass.length < 8) e.new = 'Minimal 8 karakter.';
        else if (!/[A-Z]/.test(newPass)) e.new = 'Harus ada huruf kapital.';
        else if (!/[0-9]/.test(newPass)) e.new = 'Harus ada angka.';
        if (!confirmPass) e.confirm = 'Konfirmasi wajib diisi.';
        else if (confirmPass !== newPass) e.confirm = 'Password tidak cocok.';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setLoading(true);
        try {
            // CONTRACT V3.6 §8: first-login — old_password kosong (diizinkan oleh BE).
            // Backend menerima empty string sebagai sinyal first-login change.
            await changePassword({ old_password: '', new_password: newPass });
            setDone(true);
            setTimeout(() => onSuccess?.(), 1400);
        } catch (err) {
            const msg = err?.response?.data?.message || 'Gagal mengganti password. Silakan coba lagi.';
            setErrors(p => ({ ...p, new: msg }));
        } finally {
            setLoading(false);
        }
    };

    return (
        // Modal tidak punya backdrop yang bisa diklik — WAJIB isi
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(13,26,38,.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1500, backdropFilter: 'blur(6px)',
        }}>
            <div className="bounce-in" style={{
                background: C.white, borderRadius: 20, padding: 32,
                width: '100%', maxWidth: 420,
                boxShadow: '0 32px 80px rgba(0,0,0,.35)',
                margin: '0 16px',
            }}>
                {done ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
                        <div style={{ fontWeight: 700, fontSize: FS.h2, color: C.dark, marginBottom: 6 }}>Password Berhasil Diubah!</div>
                        <div style={{ fontSize: FS.base, color: C.slate }}>Mengalihkan ke dashboard...</div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${C.amber},${C.orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h2, flexShrink: 0 }}>🔐</div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark }}>Ganti Password — Wajib</div>
                                    <div style={{ fontSize: FS.sm, color: C.slate }}>First Login · {userName}</div>
                                </div>
                            </div>
                            <div style={{ background: '#FFFBEB', border: '1px solid #F6E05E', borderRadius: 8, padding: '10px 14px', fontSize: FS.md, color: '#744210', lineHeight: 1.6 }}>
                                ⚠️ Demi keamanan, kamu <strong>wajib mengganti password</strong> sebelum menggunakan portal. Password lama bersifat sementara dari admin.
                            </div>
                        </div>

                        <Field
                            label="Password Baru"
                            type="password"
                            value={newPass}
                            show={showNew}
                            error={errors.new}
                            onChange={v => { setNewPass(v); setErrors(p => ({ ...p, new: null })); }}
                            onToggle={() => setShowNew(s => !s)}
                            placeholder="Min 8 karakter, huruf kapital, angka"
                        />

                        {/* Strength bar */}
                        {newPass && (
                            <div style={{ marginTop: -8, marginBottom: 14 }}>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: str >= i ? STR_COLOR[str] : C.tealXL, transition: 'background .3s' }} />
                                    ))}
                                </div>
                                <div style={{ fontSize: FS.sm, color: STR_COLOR[str], fontWeight: 600 }}>{STR_LABEL[str]}</div>
                            </div>
                        )}

                        <Field
                            label="Konfirmasi Password Baru"
                            type="password"
                            value={confirmPass}
                            show={showConfirm}
                            error={errors.confirm}
                            onChange={v => { setConfirmPass(v); setErrors(p => ({ ...p, confirm: null })); }}
                            onToggle={() => setShowConfirm(s => !s)}
                            placeholder="Ulangi password baru"
                        />
                        {confirmPass && confirmPass === newPass && (
                            <div style={{ fontSize: FS.sm, color: C.green, marginTop: -10, marginBottom: 14 }}>✓ Password cocok</div>
                        )}

                        <Btn variant="primary" onClick={handleSubmit} disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: 13 }}>
                            {loading ? (
                                <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /> Menyimpan...</>
                            ) : '💾 Simpan & Lanjutkan'}
                        </Btn>
                    </>
                )}
            </div>
        </div>
    );
}
