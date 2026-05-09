/**
 * SR MVP — ProfileSection (Siswa)
 * src/components/student/sections/ProfileSection.jsx
 *
 * Revisi:
 *  - Leaderboard dipindah ke LeaderboardSection (menu sendiri)
 *  - Tampilan full-page: banner header + 2-kolom form info
 *  - Edit nama & email tetap ada
 *  - Ganti password via modal
 */
import { useState, useRef } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import ChangePasswordModal from '../../shared/ChangePasswordModal';
import { ADMIN_KELAS_INIT } from '../../../data/masterData';
import { useAuth } from '../../../context/AuthContext';
import { uploadAvatar } from '../../../api/auth';

/* ── ReadonlyInput ── */
const ReadonlyInput = ({ value, onEdit }) => (
    <div style={{
        display: 'flex', alignItems: 'center',
        background: C.bg, borderRadius: 10,
        border: `1.5px solid ${C.tealXL}`,
        padding: '10px 14px', gap: 8,
    }}>
        <span style={{ flex: 1, fontSize: FS.base, color: C.dark, fontWeight: 500 }}>{value}</span>
    </div>
);

/* ── Field wrapper ── */
const Field = ({ label, children }) => (
    <div style={{ marginBottom: 20 }}>
        <label style={{
            display: 'block', fontSize: FS.sm, fontWeight: 700,
            color: C.slate, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6,
        }}>{label}</label>
        {children}
    </div>
);

/* ── Main ── */
const ProfileSection = ({ progressData, onChangePwd }) => {
    const { user: authUser } = useAuth();
    // Gunakan data dari AuthContext sebagai sumber kebenaran (bukan masterData)
    // AuthContext di-seed dari GET /auth/me saat login — selalu fresh per user
    const effectiveData = authUser || {};
    const kelasData = ADMIN_KELAS_INIT.find(k => k.id === effectiveData?.kelas_id) || null;
    const { isMobile } = useBreakpoint();

    const { updateUser } = useAuth();
    const [avatarSrc, setAvatarSrc] = useState(effectiveData?.avatar || null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState(null);
    const [email, setEmail] = useState(effectiveData?.email || '');
    const [namaEdit, setNamaEdit] = useState(effectiveData?.nama || authUser?.nama || 'Siswa');
    const [showEditNama, setShowEditNama] = useState(false);
    const [showEditEmail, setShowEditEmail] = useState(false);
    const [showChangePwdLocal, setShowChangePwdLocal] = useState(false);
    const fileInputRef = useRef();

    const handleAvatarClick = () => fileInputRef.current?.click();

    /**
     * Compress gambar menggunakan Canvas API sebelum upload.
     * Foto kamera HP bisa 3–8 MB — di-resize ke maks 512×512px dan kualitas 80%
     * sehingga hasil akhir < 200 KB, aman untuk contract 2 MB BE.
     *
     * @param {File} file - File gambar asli
     * @returns {Promise<Blob>} - Blob terkompresi
     */
    const compressImage = (file) => new Promise((resolve, reject) => {
        const MAX_PX = 512;
        const QUALITY = 0.8;
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const scale = Math.min(MAX_PX / img.width, MAX_PX / img.height, 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                'image/jpeg',
                QUALITY,
            );
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
        img.src = objectUrl;
    });

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        // Validasi tipe file — ukuran tidak diblokir karena akan dicompress
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setAvatarError('Hanya JPEG, PNG, atau WebP yang diizinkan');
            return;
        }
        // Hard limit 20 MB sebelum compress — tolak file yang memang tidak wajar
        if (file.size > 20 * 1024 * 1024) {
            setAvatarError('Ukuran file terlalu besar (maks 20 MB)');
            return;
        }

        setAvatarUploading(true);
        setAvatarError(null);

        try {
            // Compress dulu — foto kamera HP 5–8 MB jadi < 200 KB setelah resize 512px
            const compressed = await compressImage(file);

            // Tampilkan preview dari blob terkompresi (optimistic UI)
            const previewUrl = URL.createObjectURL(compressed);
            setAvatarSrc(previewUrl);

            // Upload blob terkompresi sebagai File agar FormData bisa kirim
            const uploadFile = new File([compressed], 'avatar.jpg', { type: 'image/jpeg' });
            const res = await uploadAvatar(uploadFile);

            URL.revokeObjectURL(previewUrl);

            if (res?.avatar) {
                setAvatarSrc(res.avatar);
                if (typeof updateUser === 'function') {
                    updateUser({ avatar: res.avatar });
                }
            }
        } catch {
            setAvatarError('Gagal mengupload foto. Coba lagi.');
            setAvatarSrc(effectiveData?.avatar || null);
        } finally {
            setAvatarUploading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: C.bg }}>

            {/* ── Banner header (gradient) ── */}
            <div style={{
                background: `linear-gradient(130deg, ${C.dark} 0%, ${C.darkM} 55%, #1D4E55 100%)`,
                padding: isMobile ? '20px 18px 24px' : '24px 32px 28px',
                position: 'relative', overflow: 'hidden', flexShrink: 0,
            }}>
                {/* Decorations */}
                <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -30, right: 80, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    {/* Avatar + nama */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,.3)', boxShadow: '0 4px 16px rgba(0,0,0,.3)', opacity: avatarUploading ? 0.6 : 1 }} />
                            ) : (
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    background: effectiveData?.avatarBg || `linear-gradient(135deg,${C.teal},${C.tealL})`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontWeight: 900, fontSize: 26,
                                    border: '3px solid rgba(255,255,255,.3)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                                }}>{namaEdit ? namaEdit.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}</div>
                            )}
                            <button onClick={handleAvatarClick} title="Ganti foto profil" disabled={avatarUploading}
                                style={{
                                    position: 'absolute', bottom: 1, right: 1,
                                    width: 26, height: 26, borderRadius: '50%',
                                    background: avatarUploading ? C.slate : C.amber, border: '2px solid rgba(255,255,255,.6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: FS.md, cursor: avatarUploading ? 'wait' : 'pointer', color: '#fff',
                                    boxShadow: '0 2px 6px rgba(0,0,0,.3)', transition: 'transform .15s',
                                }}
                                onMouseEnter={e => { if (!avatarUploading) e.currentTarget.style.transform = 'scale(1.12)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                            >{avatarUploading ? '⏳' : '📷'}</button>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                            {avatarError && (
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, background: '#fff', border: `1px solid #FEB2B2`, borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#9B2C2C', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
                                    {avatarError}
                                </div>
                            )}
                        </div>
                        <div>
                            <div style={{ color: C.white, fontWeight: 800, fontSize: FS.h2, marginBottom: 2 }}>{namaEdit}</div>
                            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: FS.base }}>{email}</div>
                            <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.sm, marginTop: 3 }}>
                                Kelas {kelasData?.nama || 'X-1'} · NIS {effectiveData?.nis || effectiveData?.NIS || '—'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 32px', background: C.bg }}>
                <div style={{
                    maxWidth: 860, margin: '0 auto',
                    background: C.white, borderRadius: 20,
                    border: `1px solid ${C.tealXL}`,
                    boxShadow: '0 4px 28px rgba(13,92,99,.07)',
                    overflow: 'hidden',
                }}>
                    {/* 2-column grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        padding: isMobile ? '20px 18px 24px' : '28px 32px',
                    }}>
                        {/* Kolom kiri */}
                        <div style={{ paddingRight: isMobile ? 0 : 32, borderRight: isMobile ? 'none' : `1px solid ${C.tealXL}`, paddingBottom: isMobile ? 20 : 0 }}>
                            <div style={{ fontSize: FS.sm, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${C.tealXL}` }}>
                                Informasi Pribadi
                            </div>
                            <Field label="Nama Lengkap">
                                <ReadonlyInput value={namaEdit} onEdit={() => setShowEditNama(true)} />
                            </Field>
                            <Field label="NIS">
                                <ReadonlyInput value={effectiveData?.nis || effectiveData?.NIS || '—'} />
                            </Field>
                            <Field label="Kelas">
                                <ReadonlyInput value={kelasData?.nama || 'X-1'} />
                            </Field>
                            <Field label="Bergabung Sejak">
                                <ReadonlyInput value={effectiveData?.bergabung || 'Jul 2025'} />
                            </Field>
                        </div>

                        {/* Kolom kanan */}
                        <div style={{ paddingLeft: isMobile ? 0 : 32, borderTop: isMobile ? `1px solid ${C.tealXL}` : 'none', paddingTop: isMobile ? 20 : 0 }}>
                            <div style={{ fontSize: FS.sm, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${C.tealXL}` }}>
                                Akun &amp; Keamanan
                            </div>
                            <Field label="Email">
                                <ReadonlyInput value={email} onEdit={() => setShowEditEmail(true)} />
                            </Field>
                            <Field label="Password">
                                <div style={{ display: 'flex', alignItems: 'center', background: C.bg, borderRadius: 10, border: `1.5px solid ${C.tealXL}`, padding: '10px 14px', gap: 8 }}>
                                    <span style={{ flex: 1, fontSize: FS.base, color: C.slate, letterSpacing: '.2em' }}>••••••••</span>
                                    <button onClick={() => setShowChangePwdLocal(true)} style={{
                                        background: 'none', border: `1px solid ${C.tealXL}`, borderRadius: 7,
                                        padding: '4px 10px', fontSize: FS.sm, color: C.teal, fontWeight: 700,
                                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all .15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}10`; e.currentTarget.style.borderColor = C.teal; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.tealXL; }}
                                    >🔐 Ganti</button>
                                </div>
                            </Field>
                            <Field label="Status Akun">
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `${C.green}14`, borderRadius: 99, border: `1.5px solid ${C.green}30`, padding: '7px 16px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 0 3px ${C.green}30` }} />
                                    <span style={{ fontSize: FS.md, fontWeight: 700, color: C.green }}>Aktif</span>
                                </div>
                            </Field>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modals ── */}
            {showChangePwdLocal && (
                <ChangePasswordModal role="siswa" userName={namaEdit || effectiveData?.nama} onClose={() => setShowChangePwdLocal(false)} />
            )}
        </div>
    );
};

export default ProfileSection;