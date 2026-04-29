/**
 * SR MVP — LeaderboardSection (Siswa)
 * src/components/student/sections/LeaderboardSection.jsx
 *
 * Menu leaderboard terpisah dari profil.
 * Fitur:
 *  - Podium top 3 (rank 1 di tengah)
 *  - Tabel semua siswa
 *  - Tab Daily / Monthly
 *  - Banner posisi siswa saat ini
 */
import { useState, useRef, useEffect } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
    STUDENTS,
    ADMIN_SISWA_INIT,
} from '../../../data/masterData';

const CURRENT_STUDENT_ID = 's9';

/* ── Helpers ── */
const getTotalScore = (student) =>
    (student.riwayat || []).reduce((sum, r) => {
        const score = r.quizTotal > 0 ? Math.round((r.quiz / r.quizTotal) * 100) : 0;
        return sum + score;
    }, 0);

// Daily: score hanya dari riwayat 24 jam terakhir (simulasi: ambil 30% random seed per siswa)
const getDailyScore = (student) => {
    const total = getTotalScore(student);
    // Simulasi: hash sederhana dari student.id untuk variasi deterministik
    const seed = student.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Math.round(total * ((seed % 40 + 10) / 100));
};

const buildLeaderboard = (mode = 'monthly') => {
    const kelasK1Students = STUDENTS.filter(s =>
        ADMIN_SISWA_INIT.find(a => a.id === s.id && a.kelasId === 'x1')
    );
    const getScore = mode === 'daily' ? getDailyScore : getTotalScore;
    return kelasK1Students
        .map(s => ({ ...s, totalScore: getScore(s) }))
        .sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            return kelasK1Students.findIndex(s => s.id === a.id)
                - kelasK1Students.findIndex(s => s.id === b.id);
        })
        .map((s, idx) => ({ ...s, rank: idx + 1 }));
};

/* ── AvatarCircle ── */
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

/* ── Podium Config ── */
const PODIUM_CONFIG = [
    { rank: 2, medal: '🥈', height: 72, label: '2nd', labelColor: '#8899AA', bg: 'rgba(136,153,170,.15)', border: 'rgba(136,153,170,.3)' },
    { rank: 1, medal: '🥇', height: 90, label: '1st', labelColor: '#F4A435', bg: 'rgba(244,164,53,.12)', border: 'rgba(244,164,53,.4)' },
    { rank: 3, medal: '🥉', height: 58, label: '3rd', labelColor: '#CD7F32', bg: 'rgba(205,127,50,.12)', border: 'rgba(205,127,50,.3)' },
];

const PodiumCard = ({ entry, config, isCurrentUser }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: config.rank === 1 ? 1.1 : 1 }}>
        <div style={{ position: 'relative' }}>
            {config.rank === 1 && (
                <div style={{
                    position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 20, lineHeight: 1,
                    animation: 'sr-crownFloat 2s ease-in-out infinite',
                    zIndex: 1,
                }}>👑</div>
            )}
            <div style={{ animation: glowAnim[config.rank], borderRadius: '50%' }}>
                <AvatarCircle
                    student={entry}
                    size={config.rank === 1 ? 64 : 52}
                    showBorder
                    borderColor={config.rank === 1 ? C.amber : config.border.replace('0.3)', '0.8)')}
                />
            </div>
            {isCurrentUser && (
                <div style={{
                    position: 'absolute', bottom: -4, right: -4,
                    background: C.teal, color: '#fff',
                    fontSize: FS.xs, fontWeight: 800,
                    padding: '2px 6px', borderRadius: 99,
                    border: '1.5px solid #fff',
                    whiteSpace: 'nowrap',
                }}>Kamu</div>
            )}
        </div>

        <div style={{ textAlign: 'center' }}>
            <div style={{
                fontSize: FS.base, fontWeight: 800, color: C.white,
                lineHeight: 1.3, maxWidth: 100,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{entry.name.split(' ')[0]}</div>
            <div style={{ fontSize: FS.lg, fontWeight: 900, color: config.labelColor, marginTop: 2 }}>
                {entry.totalScore.toLocaleString()} poin
            </div>
        </div>

        <div style={{
            width: '100%',
            height: config.height,
            background: config.bg,
            border: `1.5px solid ${config.border}`,
            borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FS.h2, fontWeight: 900, color: config.labelColor,
            position: 'relative', overflow: 'hidden',
        }}>
            {config.label}
            <div style={{
                position: 'absolute', top: 0, left: 0,
                width: '50%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)',
                animation: 'sr-shimmerSlide 2.2s ease-in-out infinite',
                pointerEvents: 'none',
            }} />
        </div>
    </div>
);

/* ── Main ── */
const LeaderboardSection = () => {
    const [mode, setMode] = useState('monthly'); // 'daily' | 'monthly'
    const { isMobile } = useBreakpoint();
    const podiumRef = useRef();

    const leaderboard = buildLeaderboard(mode);
    const myRank = leaderboard.find(s => s.id === CURRENT_STUDENT_ID);
    const maxScore = leaderboard.length > 0 ? Math.max(leaderboard[0].totalScore, 1) : 1;

    // Confetti saat mount
    const makeConfetti = () => {
        const container = podiumRef.current;
        if (!container) return;
        const colors = ['#F4A435', '#5DCAA5', '#7F77DD', '#D85A30', '#378ADD', '#63C132'];
        Array.from({ length: 16 }).forEach((_, i) => {
            const el = document.createElement('div');
            const size = 5 + Math.random() * 5;
            el.style.cssText = `
                position:absolute; width:${size}px; height:${size}px;
                border-radius:${Math.random() > .5 ? '50%' : '2px'};
                background:${colors[i % colors.length]};
                left:${10 + Math.random() * 80}%;
                top:0;
                animation: confettiFall ${1 + Math.random() * .8}s ease-out ${Math.random() * 1.2}s both;
                pointer-events:none; z-index:10;
            `;
            container.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        });
    };

    useEffect(() => {
        const t = setTimeout(makeConfetti, 300);
        return () => clearTimeout(t);
    }, [mode]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: C.bg }}>

            {/* ── Sticky header ── */}
            <div style={{ padding: '16px 22px 12px', background: C.bg, flexShrink: 0, borderBottom: `1px solid rgba(13,92,99,.07)` }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: FS.h1, fontWeight: 600, color: C.dark }}>🏆 Leaderboard</div>
                <div style={{ fontSize: FS.md, color: C.slate, marginTop: 3 }}>Peringkat kelas berdasarkan poin belajar.</div>
            </div>

            {/* ── Scrollable ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '20px 24px 28px' }}>

                {/* ── Toggle Daily / Monthly ── */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                    <div style={{
                        display: 'inline-flex',
                        background: C.dark,
                        borderRadius: 99,
                        padding: 4,
                        gap: 2,
                    }}>
                        {['daily', 'monthly'].map(m => (
                            <button key={m}
                                onClick={() => setMode(m)}
                                style={{
                                    padding: '8px 28px',
                                    borderRadius: 99,
                                    border: 'none',
                                    background: mode === m ? C.teal : 'transparent',
                                    color: mode === m ? '#fff' : 'rgba(255,255,255,.5)',
                                    fontSize: FS.base, fontWeight: 700,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'all .2s',
                                    boxShadow: mode === m ? '0 2px 8px rgba(13,92,99,.4)' : 'none',
                                }}
                            >
                                {m === 'daily' ? 'Harian' : 'Bulanan'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Podium ── */}
                {leaderboard.length >= 3 && (
                    <div ref={podiumRef} style={{
                        position: 'relative',
                        background: `linear-gradient(160deg, ${C.dark} 0%, ${C.darkM} 100%)`,
                        borderRadius: 20,
                        padding: isMobile ? '28px 16px 0' : '32px 40px 0',
                        border: `1px solid rgba(244,164,53,.2)`,
                        overflow: 'hidden',
                        marginBottom: 20,
                        boxShadow: '0 8px 32px rgba(26,35,50,.18)',
                    }}>
                        {/* bg decoration */}
                        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(244,164,53,.05)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(13,92,99,.12)', pointerEvents: 'none' }} />

                        {/* Mode label */}
                        <div style={{ textAlign: 'center', marginBottom: 28 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,164,53,.12)', border: '1px solid rgba(244,164,53,.3)', borderRadius: 99, padding: '6px 18px' }}>
                                <span style={{ fontSize: 16 }}>🏆</span>
                                <span style={{ color: C.amber, fontWeight: 800, fontSize: FS.lg }}>
                                    Top 3 — {mode === 'daily' ? 'Hari Ini' : 'Bulan Ini'}
                                </span>
                            </div>
                        </div>

                        {/* Podium row */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 6 : 12, justifyContent: 'center' }}>
                            {PODIUM_CONFIG.map(cfg => {
                                const entry = leaderboard[cfg.rank - 1];
                                if (!entry) return null;
                                return <PodiumCard key={cfg.rank} entry={entry} config={cfg} isCurrentUser={entry.id === CURRENT_STUDENT_ID} />;
                            })}
                        </div>
                    </div>
                )}

                {/* ── Banner posisi saat ini ── */}
                {myRank && (
                    <div style={{
                        background: `linear-gradient(135deg, ${C.teal}18, ${C.tealL}12)`,
                        borderRadius: 14, padding: '14px 20px',
                        border: `1.5px solid ${C.teal}35`,
                        marginBottom: 20,
                        display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                        <div style={{ fontSize: 28 }}>
                            {myRank.rank === 1 ? '🥇' : myRank.rank === 2 ? '🥈' : myRank.rank === 3 ? '🥉' : '🎖️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: FS.sm, color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 1 }}>
                                📍 Posisimu Sekarang
                            </div>
                            <div style={{ fontSize: FS.base, fontWeight: 800, color: C.dark }}>
                                Peringkat #{myRank.rank} dari {leaderboard.length} siswa
                            </div>
                            <div style={{ fontSize: FS.sm, color: C.darkL, marginTop: 2 }}>
                                {myRank.rank === 1
                                    ? 'Kamu di puncak! Pertahankan terus. 🌟'
                                    : (() => {
                                        const above = leaderboard[myRank.rank - 2];
                                        const diff = above ? above.totalScore - myRank.totalScore : 0;
                                        return diff <= 0
                                            ? `1 poin lagi untuk naik ke peringkat ${myRank.rank - 1}!`
                                            : `${diff} poin lagi untuk naik ke peringkat ${myRank.rank - 1}!`;
                                    })()
                                }
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: FS.h1, fontWeight: 900, color: C.teal, lineHeight: 1 }}>{myRank.totalScore.toLocaleString()}</div>
                            <div style={{ fontSize: FS.xs, color: C.slate }}>poin {mode === 'daily' ? 'hari ini' : 'bulan ini'}</div>
                        </div>
                    </div>
                )}

                {/* ── Tabel semua siswa ── */}
                <div style={{ background: C.white, borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.tealXL}`, boxShadow: '0 2px 12px rgba(13,92,99,.05)' }}>
                    {/* Header tabel */}
                    <div style={{ padding: '12px 20px', background: C.tealXL, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>📋</span>
                        <span style={{ fontSize: FS.md, fontWeight: 800, color: C.dark }}>Semua Siswa — {mode === 'daily' ? 'Harian' : 'Bulanan'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: FS.sm, color: C.slate, fontWeight: 600 }}>{leaderboard.length} siswa</span>
                    </div>

                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', background: '#f8fafb', borderBottom: `1px solid ${C.tealXL}` }}>
                        <div style={{ width: 36, fontSize: FS.sm, fontWeight: 700, color: C.slate, textAlign: 'center', flexShrink: 0 }}>Rank</div>
                        <div style={{ flex: 1, fontSize: FS.sm, fontWeight: 700, color: C.slate }}>Nama Siswa</div>
                        <div style={{ width: 70, textAlign: 'right', fontSize: FS.sm, fontWeight: 700, color: C.slate, flexShrink: 0 }}>Poin</div>
                    </div>

                    {/* Rows */}
                    {leaderboard.map((entry, idx) => {
                        const isMe = entry.id === CURRENT_STUDENT_ID;
                        const isTop3 = entry.rank <= 3;
                        const medalColors = [C.amber, '#8899AA', '#CD7F32'];
                        return (
                            <div key={entry.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 20px',
                                background: isMe ? `${C.teal}0e` : 'transparent',
                                borderBottom: idx < leaderboard.length - 1 ? `1px solid ${C.tealXL}` : 'none',
                                transition: 'background .15s',
                            }}
                                onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = `${C.teal}06`; }}
                                onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Rank */}
                                <div style={{ width: 36, textAlign: 'center', flexShrink: 0, fontSize: isTop3 ? 16 : FS.md, fontWeight: 800, color: isTop3 ? medalColors[entry.rank - 1] : C.slate }}>
                                    {isTop3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                                </div>

                                {/* Avatar + nama */}
                                <AvatarCircle student={entry} size={36} showBorder={isMe} borderColor={C.teal} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: FS.base, fontWeight: isMe ? 800 : 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {entry.name}
                                        </span>
                                        {isMe && (
                                            <span style={{ background: C.teal, color: '#fff', fontSize: FS.xs, fontWeight: 800, padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>
                                                Kamu
                                            </span>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: C.tealXL, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 99,
                                            background: isMe ? C.teal : isTop3 ? medalColors[entry.rank - 1] : `${C.teal}44`,
                                            width: `${Math.max(2, Math.round((entry.totalScore / maxScore) * 100))}%`,
                                            transition: 'width .8s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Poin */}
                                <div style={{ width: 70, textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: FS.lg, fontWeight: 900, color: isMe ? C.teal : isTop3 ? medalColors[entry.rank - 1] : C.darkM }}>
                                        {entry.totalScore.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: FS.xs, color: C.slate }}>poin</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardSection;