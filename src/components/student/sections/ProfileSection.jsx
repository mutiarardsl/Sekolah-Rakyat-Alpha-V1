/**
 * SR MVP — ProfileSection (Siswa)
 * src/components/student/sections/ProfileSection.jsx
 *
 * Perubahan:
 *  - Hapus header dark gradient, ganti judul page biasa
 *  - Card profil bersih di atas leaderboard
 *  - Upload foto profil (preview lokal via FileReader)
 *  - Edit nama & email dengan verifikasi password
 *  - Ganti password via modal existing
 */
import { useState, useRef, useEffect } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import ChangePasswordModal from '../../shared/ChangePasswordModal';
import {
    STUDENTS,
    ADMIN_SISWA_INIT,
    ADMIN_KELAS_INIT,
} from '../../../data/masterData';

const CURRENT_STUDENT_ID = 's9';

/* ── Helper ── */
const getTotalScore = (student) =>
    (student.riwayat || []).reduce((sum, r) => sum + (r.quiz || 0), 0);

const buildLeaderboard = () => {
    const kelasK1Students = STUDENTS.filter(s =>
        ADMIN_SISWA_INIT.find(a => a.id === s.id && a.kelasId === 'x1')
    );
    return kelasK1Students
        .map(s => ({ ...s, totalScore: getTotalScore(s) }))
        .sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            // poin sama → siapa yang lebih dulu di array (index lebih kecil = lebih dulu)
            return kelasK1Students.findIndex(s => s.id === a.id)
                - kelasK1Students.findIndex(s => s.id === b.id);
        })
        .map((s, idx) => ({ ...s, rank: idx + 1 }));
};

/* ── Podium config ── */
const PODIUM_CONFIG = [
    { rank: 2, medal: '🥈', height: 72, label: '2nd', labelColor: '#8899AA', bg: 'rgba(136,153,170,.15)', border: 'rgba(136,153,170,.3)' },
    { rank: 1, medal: '🥇', height: 90, label: '1st', labelColor: '#F4A435', bg: 'rgba(244,164,53,.12)', border: 'rgba(244,164,53,.4)' },
    { rank: 3, medal: '🥉', height: 58, label: '3rd', labelColor: '#CD7F32', bg: 'rgba(205,127,50,.12)', border: 'rgba(205,127,50,.3)' },
];

const AvatarCircle = ({ student, size = 44, showBorder = false, borderColor = C.teal }) => (
    <div style={{
        width: size, height: size, borderRadius: '50%',
        background: student.avatarBg || C.teal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: size * 0.28,
        border: showBorder ? `2.5px solid ${borderColor}` : 'none',
        flexShrink: 0,
        boxShadow: showBorder ? `0 0 0 3px ${borderColor}33` : 'none',
    }}>{student.avatar}</div>
);

const glowAnim = {
    1: 'sr-glowPulse1 1.8s ease-in-out infinite',
    2: 'sr-glowPulse2 2s ease-in-out infinite',
    3: 'sr-glowPulse3 2.2s ease-in-out infinite',
};

const PodiumCard = ({ entry, config, isCurrentUser }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: config.rank === 1 ? 1.1 : 1 }}>

        {/* Avatar area — tanpa medal emoji di sini */}
        <div style={{ position: 'relative' }}>

            {/* Crown khusus rank 1 */}
            {config.rank === 1 && (
                <div style={{
                    position: 'absolute', top: -18, left: '50%',
                    fontSize: FS.xl, lineHeight: 1,
                    animation: 'sr-crownFloat 2s ease-in-out infinite',
                    zIndex: 1,
                }}>👑</div>
            )}

            <div style={{ animation: glowAnim[config.rank], borderRadius: '50%' }}>
                <AvatarCircle
                    student={entry}
                    size={config.rank === 1 ? 56 : 46}
                    showBorder
                    borderColor={config.rank === 1 ? C.amber : config.border.replace('0.3)', '0.8)')}
                />
            </div>

            {isCurrentUser && (
                <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: C.teal, color: '#fff',
                    fontSize: FS.xs, fontWeight: 800,
                    padding: '2px 4px', borderRadius: 99,
                    border: '1.5px solid #fff',
                }}>Kamu</div>
            )}
        </div>

        {/* Nama + poin */}
        <div style={{ textAlign: 'center' }}>
            <div style={{
                fontSize: FS.sm, fontWeight: 700, color: C.white,
                lineHeight: 1.3, maxWidth: 80,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{entry.name.split(' ')[0]}</div>
            <div style={{ fontSize: FS.base, fontWeight: 800, color: config.labelColor }}>
                {entry.totalScore} poin
            </div>
        </div>

        {/* Blok podium — shimmer pakai translateX bukan background-position */}
        <div style={{
            width: '100%',
            height: config.height,
            background: config.bg,
            border: `1.5px solid ${config.border}`,
            borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FS.h2, fontWeight: 900, color: config.labelColor,
            position: 'relative',
            overflow: 'hidden',
        }}>
            {config.label}

            {/* Shimmer — pakai translateX agar benar-benar bergerak */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '50%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)',
                animation: 'sr-shimmerSlide 2.0s ease-in-out infinite',
                pointerEvents: 'none',
            }} />
        </div>
    </div>
);

/* ── Info Row ── */
const InfoRow = ({ icon, label, value, onEdit, last }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 0',
        borderBottom: last ? 'none' : `1px solid ${C.tealXL}`,
    }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.teal}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.xs, color: C.slate, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: FS.base, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        </div>
        {onEdit && (
            <button onClick={onEdit} style={{ background: 'none', border: `1px solid ${C.tealXL}`, borderRadius: 7, padding: '5px 10px', fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, transition: 'all .15s', flexShrink: 0, whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}10`; e.currentTarget.style.borderColor = C.teal; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.tealXL; }}>
                ✏️ Edit
            </button>
        )}
    </div>
);

/* ── Edit Email Modal — verifikasi password dulu ── */
const EditEmailModal = ({ currentEmail, onClose, onSave }) => {
    const [step, setStep] = useState('verify'); // 'verify' | 'edit'
    const [password, setPassword] = useState('');
    const [newEmail, setNewEmail] = useState(currentEmail);
    const [pwdError, setPwdError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = () => {
        if (!password.trim()) { setPwdError('Password wajib diisi.'); return; }
        setLoading(true);
        // Simulasi verifikasi (di produksi: hit API)
        setTimeout(() => {
            setLoading(false);
            if (password === '123456' || password.length >= 4) {
                setStep('edit');
                setPwdError('');
            } else {
                setPwdError('Password salah. Coba lagi.');
            }
        }, 800);
    };

    const handleSave = () => {
        if (!newEmail.includes('@')) { setEmailError('Format email tidak valid.'); return; }
        onSave(newEmail);
        onClose();
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 18, padding: 28, width: 400, boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
                <div style={{ fontSize: FS.xl, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                    {step === 'verify' ? '🔐 Verifikasi Password' : '✏️ Edit Email'}
                </div>
                <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 20 }}>
                    {step === 'verify' ? 'Masukkan password untuk mengkonfirmasi perubahan.' : 'Masukkan email baru kamu.'}
                </div>

                {step === 'verify' ? (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Password Saat Ini</label>
                            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                                placeholder="Masukkan password..."
                                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${pwdError ? C.red : C.tealXL}`, borderRadius: 9, fontSize: FS.base, outline: 'none', fontFamily: 'inherit' }}
                                onFocus={e => e.target.style.borderColor = pwdError ? C.red : C.teal}
                                onBlur={e => e.target.style.borderColor = pwdError ? C.red : C.tealXL}
                                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                            />
                            {pwdError && <div style={{ fontSize: FS.sm, color: C.red, marginTop: 4 }}>⚠ {pwdError}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${C.tealXL}`, background: 'none', color: C.slate, fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                            <button onClick={handleVerify} disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: C.teal, color: '#fff', fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {loading ? 'Memverifikasi...' : 'Lanjutkan →'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Email Baru</label>
                            <input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${emailError ? C.red : C.tealXL}`, borderRadius: 9, fontSize: FS.base, outline: 'none', fontFamily: 'inherit' }}
                                onFocus={e => e.target.style.borderColor = emailError ? C.red : C.teal}
                                onBlur={e => e.target.style.borderColor = emailError ? C.red : C.tealXL}
                            />
                            {emailError && <div style={{ fontSize: FS.sm, color: C.red, marginTop: 4 }}>⚠ {emailError}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${C.tealXL}`, background: 'none', color: C.slate, fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
                            <button onClick={handleSave} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: C.teal, color: '#fff', fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✅ Simpan</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/* ── Main ── */
const ProfileSection = ({ progressData, onChangePwd }) => {
    const adminData = ADMIN_SISWA_INIT.find(s => s.id === CURRENT_STUDENT_ID);
    const kelasData = ADMIN_KELAS_INIT.find(k =>
        k.id === adminData?.kelasId || k.nama === 'X-1'
    );

    /* ── Local state untuk avatar & email (simulasi edit lokal) ── */
    const [avatarSrc, setAvatarSrc] = useState(null); // URL foto upload
    const [email, setEmail] = useState(adminData?.email || 'budi@siswa.sr');
    const [showEditEmail, setShowEditEmail] = useState(false);
    const [showChangePwdLocal, setShowChangePwdLocal] = useState(false);
    const fileInputRef = useRef();
    const podiumRef = useRef();

    const makeConfetti = () => {
        const container = podiumRef.current;
        if (!container) return;
        const colors = ['#F4A435', '#5DCAA5', '#7F77DD', '#D85A30', '#378ADD', '#63C132', '#ED93B1'];
        Array.from({ length: 18 }).forEach((_, i) => {
            const el = document.createElement('div');
            const size = 5 + Math.random() * 5;
            el.style.cssText = `
            position:absolute;
            width:${size}px; height:${size}px;
            border-radius:${Math.random() > .5 ? '50%' : '2px'};
            background:${colors[i % colors.length]};
            left:${10 + Math.random() * 80}%;
            top:0;
            animation: confettiFall ${1 + Math.random() * .8}s ease-out ${Math.random() * 1.2}s both;
            pointer-events:none;
        `;
            container.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        });
    };

    useEffect(() => {
        const timer = setTimeout(makeConfetti, 400);
        return () => clearTimeout(timer);
    }, []);

    /* ── Leaderboard ── */
    const leaderboard = buildLeaderboard();
    const myRank = leaderboard.find(s => s.id === CURRENT_STUDENT_ID);

    /* ── Handle foto upload ── */
    const handleAvatarClick = () => fileInputRef.current?.click();
    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarSrc(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };
    const maxScore = leaderboard.length > 0 ? leaderboard[0].totalScore : 1;

    return (
        <div style={{ overflowY: 'auto', height: '100%', width: '100%', padding: '20px 22px', background: C.bg }}>

            {/* ── Page Title ── */}
            <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: FS.h1, fontWeight: 600, color: C.dark }}>👤 Profil & Leaderboard</div>
                <div style={{ fontSize: FS.md, color: C.slate, marginTop: 3 }}>Kelola informasi akunmu dan lihat peringkat kelas.</div>
            </div>

            {/* ── Leaderboard ── */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* ── Kolom kiri: Leaderboard ── */}
                <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 20, paddingRight: 20 }}>

                    {/* Podium */}
                    {leaderboard.length >= 3 && (
                        <div ref={podiumRef} style={{ position: 'relative', background: `linear-gradient(160deg, ${C.dark} 0%, ${C.darkM} 100%)`, borderRadius: 18, padding: '32px 20px 0', border: `1px solid rgba(244,164,53,.2)`, overflow: 'hidden' }}>
                            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                                <span style={{ fontSize: 20 }}>🏆</span>
                                <span style={{ color: C.amber, fontWeight: 800, fontSize: FS.lg, marginLeft: 6 }}>Papan Peringkat</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: 'center' }}>
                                {PODIUM_CONFIG.map(cfg => {
                                    const entry = leaderboard[cfg.rank - 1];
                                    if (!entry) return null;
                                    return <PodiumCard key={cfg.rank} entry={entry} config={cfg} isCurrentUser={entry.id === CURRENT_STUDENT_ID} />;
                                })}
                            </div>
                        </div>
                    )}
                    {/* Tabel peringkat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ background: C.white, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.tealXL}` }}>
                            <div style={{ padding: '14px 18px', background: C.tealXL, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14 }}>📋</span>
                                <span style={{ fontSize: FS.md, fontWeight: 800, color: C.dark }}>Tabel Peringkat</span>
                            </div>
                            <div>
                                {leaderboard.map((entry, idx) => {
                                    const isMe = entry.id === CURRENT_STUDENT_ID;
                                    const isTop3 = entry.rank <= 3;
                                    return (
                                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', background: isMe ? `${C.teal}12` : 'transparent', borderBottom: idx < leaderboard.length - 1 ? `1px solid ${C.tealXL}` : 'none', transition: 'background .15s' }}>
                                            <div style={{ width: 28, textAlign: 'center', flexShrink: 0, fontSize: isTop3 ? 16 : 12, fontWeight: 800, color: isTop3 ? [C.amber, '#8899AA', '#CD7F32'][entry.rank - 1] : C.slate }}>
                                                {isTop3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                                            </div>
                                            <AvatarCircle student={entry} size={34} showBorder={isMe} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: FS.md, fontWeight: isMe ? 800 : 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                                                    {isMe && <span style={{ background: C.teal, color: '#fff', fontSize: FS.xs, fontWeight: 700, padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>Kamu</span>}
                                                </div>
                                                <div style={{ marginTop: 3, height: 3, borderRadius: 99, background: `${C.tealXL}`, overflow: 'hidden', width: '100%' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        borderRadius: 99,
                                                        background: isMe ? C.teal : isTop3 ? [C.amber, '#8899AA', '#CD7F32'][entry.rank - 1] : `${C.teal}55`,
                                                        width: `${Math.round((entry.totalScore / maxScore) * 100)}%`,
                                                        transition: 'width .8s ease',
                                                    }} />
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: FS.lg, fontWeight: 800, color: isMe ? C.teal : C.darkM }}>{entry.totalScore}</div>
                                                <div style={{ fontSize: FS.xs, color: C.slate }}>poin</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Profile Card ── */}
                <div style={{ flex: 1, flexDirection: 'column' }}>
                    <div style={{
                        background: C.white, borderRadius: 18, padding: '24px 28px 12px',
                        border: `2px solid ${C.tealXL}`,
                        boxShadow: '0 2px 12px rgba(13,92,99,.06)',
                        marginBottom: 20,
                    }}>
                        {/* Top: avatar + identitas — layout vertikal centered */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingBottom: 20, borderBottom: `1px solid ${C.tealXL}`, marginBottom: 4 }}>

                            {/* Avatar dengan tombol upload */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                {avatarSrc ? (
                                    <img src={avatarSrc} alt="avatar"
                                        style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.teal}`, boxShadow: `0 0 0 3px ${C.teal}22` }} />
                                ) : (
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        background: adminData?.avatarBg || C.teal,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: 900, fontSize: 28,
                                        border: `3px solid ${C.teal}`,
                                        boxShadow: `0 0 0 3px ${C.teal}22`,
                                    }}>{adminData?.avatar || 'BS'}</div>
                                )}
                                <button onClick={handleAvatarClick}
                                    title="Ganti foto profil"
                                    style={{
                                        position: 'absolute', bottom: 0, right: 0,
                                        width: 26, height: 26, borderRadius: '50%',
                                        background: C.teal, border: '2px solid #fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: FS.md, cursor: 'pointer', color: '#fff',
                                        transition: 'background .15s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = C.tealL}
                                    onMouseLeave={e => e.currentTarget.style.background = C.teal}>
                                    📷
                                </button>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                            </div>

                            {/* Nama + NIS · Kelas */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: FS.h2, fontWeight: 800, color: C.dark, lineHeight: 1.2, marginBottom: 4 }}>
                                    {adminData?.nama || 'Budi Santoso'}
                                </div>
                            </div>

                            {/* Baris bawah: button ganti password sejajar */}
                            <div style={{ display: 'flex' }}>
                                <button
                                    onClick={() => setShowChangePwdLocal(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        padding: '5px 12px', borderRadius: 99,
                                        border: `1.5px solid ${C.tealXL}`,
                                        background: 'none', color: C.dark,
                                        fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                        transition: 'all .15s', whiteSpace: 'nowrap', flexShrink: 0,
                                        height: '100%',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}10`; e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.color = C.teal; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.tealXL; e.currentTarget.style.color = C.dark; }}
                                >
                                    🔐 Ganti Password
                                </button>
                            </div>

                        </div>

                        {/* Info rows */}
                        <InfoRow icon="🔢" label="NIS" value={adminData?.nis || '2025009'} />
                        <InfoRow icon="🎓" label="Kelas" value={kelasData?.nama || 'X-1'} />
                        <InfoRow icon="📅" label="Bergabung" value={adminData?.bergabung || 'Jul 2025'} />
                        <InfoRow
                            icon="✉️"
                            label="Email"
                            value={email}
                            onEdit={() => setShowEditEmail(true)}
                            last
                        />
                    </div>

                    {/* ── Modals ── */}
                    {showEditEmail && (
                        <EditEmailModal
                            currentEmail={email}
                            onClose={() => setShowEditEmail(false)}
                            onSave={(newEmail) => setEmail(newEmail)}
                        />
                    )}
                    {showChangePwdLocal && (
                        <ChangePasswordModal
                            role="siswa"
                            userName={adminData?.nama}
                            onClose={() => setShowChangePwdLocal(false)}
                        />
                    )}

                    {/* ── Status Posisimu ── */}
                    {myRank && (
                        <div style={{
                            background: `linear-gradient(135deg, ${C.teal}22, ${C.tealL}18)`,
                            borderRadius: 14, padding: '16px 20px',
                            border: `2px solid ${C.teal}40`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ fontSize: 32 }}>
                                    {myRank.rank === 1 ? '🥇' : myRank.rank === 2 ? '🥈' : myRank.rank === 3 ? '🥉' : '🎖️'}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: FS.sm, color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>📍 Posisimu Sekarang</div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: C.dark }}>
                                        Peringkat #{myRank.rank} dari {leaderboard.length} siswa
                                    </div>
                                    <div style={{ fontSize: FS.sm, color: C.darkL, marginTop: 2 }}>
                                        {myRank.rank === 1
                                            ? 'Kamu di puncak! Pertahankan terus. 🌟'
                                            : myRank.rank <= 3
                                                ? `Hanya ${leaderboard[0].totalScore - myRank.totalScore} poin dari peringkat 1!`
                                                : (() => {
                                                    const above = leaderboard[myRank.rank - 2]; // orang tepat di atas
                                                    const diff = above.totalScore - myRank.totalScore;
                                                    return diff === 0
                                                        ? `1 poin lagi untuk naik ke peringkat ${myRank.rank - 1}!`
                                                        : `${diff} poin lagi untuk naik ke peringkat ${myRank.rank - 1}!`;
                                                })()}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: C.teal }}>{myRank.totalScore}</div>
                                    <div style={{ fontSize: FS.xs, color: C.slate }}>total poin</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ProfileSection;