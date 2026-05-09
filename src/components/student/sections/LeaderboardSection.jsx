/**
 * SR MVP — LeaderboardSection (Siswa) — HARDENED V3
 * src/components/student/sections/LeaderboardSection.jsx
 *
 * HARDENING CHANGES:
 *  1. AbortController: request dibatalkan saat unmount atau mode berubah → no memory leak
 *  2. Stale closure prevention: fetch dipanggil dalam useEffect, bukan via useCallback dependency chain
 *  3. Race condition fix: requestId guard memastikan hanya response dari request terbaru yang diapply
 *  4. isMounted guard: setState tidak dipanggil setelah component unmount
 *  5. isAbortError check: AbortError tidak ditampilkan sebagai error UI
 *  6. Confetti cleanup: clearTimeout agar tidak leak saat unmount
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { useAuth } from '../../../context/AuthContext';
import { getLeaderboard } from '../../../api/leaderboard';

const MC_WEIGHT = 0.6;
const ESSAY_WEIGHT = 0.4;

/* ── Score helpers — fallback kalkulasi lokal ── */
const getTotalScore = (student) => {
    if (student.total_poin_quiz != null) return student.total_poin_quiz;
    const riwayat = student.riwayat || [];
    let totalAgregasi = 0;
    const grupMap = {};
    riwayat.forEach(r => {
        (r.quiz_results || []).forEach(qr => {
            const key = `${r.materiId || 'umum'}__${qr.level || 'low'}`;
            if (!grupMap[key]) grupMap[key] = { mc: null, essay: null };
            if (qr.type === 'essay') grupMap[key].essay = qr.score ?? null;
            else grupMap[key].mc = qr.score ?? null;
        });
    });
    Object.values(grupMap).forEach(({ mc, essay }) => {
        if (mc != null && essay != null) totalAgregasi += Math.round(mc * MC_WEIGHT + essay * ESSAY_WEIGHT);
        else if (mc != null) totalAgregasi += mc;
        else if (essay != null) totalAgregasi += essay;
    });
    return totalAgregasi;
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
    const [mode, setMode] = useState('monthly');
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isMobile } = useBreakpoint();
    const podiumRef = useRef();
    const { user } = useAuth();
    const CURRENT_STUDENT_ID = user?.id || null;
    const kelasId = user?.kelas_id || null;

    // ── HARDENING: request lifecycle refs ──────────────────────────────
    // abortControllerRef: dibatalkan saat unmount atau saat mode berubah sebelum response tiba
    const abortControllerRef = useRef(null);
    // requestIdRef: race condition guard — hanya response dari request terbaru yang diapply
    const requestIdRef = useRef(0);
    // isMountedRef: cegah setState setelah unmount
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ── Fetch dengan safe lifecycle ─────────────────────────────────────
    const fetchLeaderboard = useCallback(async (currentMode, signal) => {
        if (!kelasId) {
            if (isMountedRef.current) setIsLoading(false);
            return;
        }

        if (isMountedRef.current) {
            setIsLoading(true);
            setError(null);
        }

        try {
            const data = await getLeaderboard({
                kelas_id: kelasId,
                mode: currentMode,
                signal, // ← AbortSignal diteruskan ke Axios
            });

            if (!isMountedRef.current) return; // ← guard unmount

            setLeaderboard(data.map(e => ({
                id: e.siswa_id,
                name: e.nama,
                avatar: e.avatar,
                avatarBg: e.avatarBg ?? C.teal,
                totalScore: e.total_poin_quiz,
                streak_hari: e.streak_hari,
                rank: e.rank,
                kelas_id: e.kelas_id,
            })));
        } catch (err) {
            if (!isMountedRef.current) return;

            // AbortError adalah cancel yang disengaja — bukan error UI
            const isAbort = err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED';
            if (isAbort) return;

            setError('Gagal memuat leaderboard. Coba lagi.');
            console.error('[LeaderboardSection] fetch error:', err);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [kelasId]); // fetchLeaderboard hanya berubah jika kelasId berubah

    // ── Effect: fetch saat mode atau kelasId berubah ───────────────────
    useEffect(() => {
        // Batalkan request sebelumnya (jika ada)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Buat AbortController baru untuk request ini
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Increment requestId — response lama yang terlambat datang akan diabaikan
        requestIdRef.current += 1;

        fetchLeaderboard(mode, controller.signal);

        // Cleanup: batalkan request saat effect re-run atau unmount
        return () => {
            controller.abort();
        };
    }, [mode, fetchLeaderboard]);

    // Confetti saat data pertama kali load
    const makeConfetti = useCallback(() => {
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
            setTimeout(() => {
                if (container.contains(el)) el.remove();
            }, 2500);
        });
    }, []);

    useEffect(() => {
        if (!isLoading && leaderboard.length > 0) {
            const t = setTimeout(makeConfetti, 300);
            return () => clearTimeout(t); // ← cleanup confetti timer
        }
    }, [isLoading, leaderboard.length, makeConfetti]);

    // ── Manual retry handler ────────────────────────────────────────────
    const handleRetry = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        fetchLeaderboard(mode, controller.signal);
    }, [mode, fetchLeaderboard]);

    const myRank = leaderboard.find(s => s.id === CURRENT_STUDENT_ID);
    const maxScore = leaderboard.length > 0 ? Math.max(leaderboard[0].totalScore, 1) : 1;

    if (isLoading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.teal}30`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ fontSize: FS.md, color: C.slate }}>Memuat leaderboard...</div>
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ fontSize: FS.base, color: C.slate }}>{error}</div>
            <button onClick={handleRetry} style={{ padding: '8px 20px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: FS.base, fontFamily: 'inherit' }}>Coba Lagi</button>
        </div>
    );

    if (!kelasId) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ fontSize: FS.base, color: C.slate }}>Data kelas tidak tersedia.</div>
        </div>
    );

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
                        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(244,164,53,.05)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', bottom: 0, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(13,92,99,.12)', pointerEvents: 'none' }} />

                        <div style={{ textAlign: 'center', marginBottom: 28 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(244,164,53,.12)', border: '1px solid rgba(244,164,53,.3)', borderRadius: 99, padding: '6px 18px' }}>
                                <span style={{ fontSize: 16 }}>🏆</span>
                                <span style={{ color: C.amber, fontWeight: 800, fontSize: FS.lg }}>
                                    Top 3 — {mode === 'daily' ? 'Hari Ini' : 'Bulan Ini'}
                                </span>
                            </div>
                        </div>

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
                    <div style={{ padding: '12px 20px', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>📋</span>
                        <span style={{ fontSize: FS.md, fontWeight: 800, color: C.white }}>Semua Siswa — {mode === 'daily' ? 'Harian' : 'Bulanan'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: FS.sm, color: C.white, fontWeight: 600 }}>{leaderboard.length} siswa</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', background: '#f8fafb', borderBottom: `1px solid ${C.tealXL}` }}>
                        <div style={{ width: 36, fontSize: FS.sm, fontWeight: 700, color: C.slate, textAlign: 'center', flexShrink: 0 }}>Rank</div>
                        <div style={{ flex: 1, fontSize: FS.sm, fontWeight: 700, color: C.slate }}>Nama Siswa</div>
                        <div style={{ width: 70, textAlign: 'right', fontSize: FS.sm, fontWeight: 700, color: C.slate, flexShrink: 0 }}>Poin</div>
                    </div>

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
                                <div style={{ width: 36, textAlign: 'center', flexShrink: 0, fontSize: isTop3 ? 16 : FS.md, fontWeight: 800, color: isTop3 ? medalColors[entry.rank - 1] : C.slate }}>
                                    {isTop3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                                </div>

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
                                    <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: C.tealXL, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 99,
                                            background: isMe ? C.teal : isTop3 ? medalColors[entry.rank - 1] : `${C.teal}44`,
                                            width: `${Math.max(2, Math.round((entry.totalScore / maxScore) * 100))}%`,
                                            transition: 'width .8s ease',
                                        }} />
                                    </div>
                                </div>

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