/**
 * SR MVP — DashboardSection (REVISED v2)
 *
 * Perubahan v2:
 *  - Notifikasi guru: dipindah ke icon bell di pojok kanan atas Hero
 *  - Bell menampilkan badge unread count
 *  - Klik bell → dropdown panel notifikasi (expand/collapse per notif + hapus)
 */
import { useState, useEffect, useRef } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import { Card, EmptyState } from '../../shared/UI';
import { getMentorInsight } from '../../../api/mentor'; // FIX ①: pakai api/mentor bukan fetch() langsung
import { getRekomendasiSiswa, } from '../../../api/admin'; // FIX P1: load notifikasi bell dari backend
import { getLearningProgress, getRecommendations } from '../../../api/content'; // FIX P3 + rekomendasi API
import {
  STUDENTS,
  ADMIN_MAPEL_LIST,
  KURIKULUM_ELEMEN,
  KURIKULUM,
  MATERI_PER_ELEMEN,
} from '../../../data/masterData';
import { useStudentStore } from '../../../stores/studentStore';

/* ── Siswa yang login (hardcoded Budi Santoso = s9) ── */
const CURRENT_STUDENT_ID = 's9';

//bobot 
const MC_WEIGHT = 0.7;
const ESSAY_WEIGHT = 0.3;

/* ── Fallback rekomendasi awal dari mapel pilihan siswa ─────────────────── */
// Diambil dari elemen pertama masing-masing mapel yang dipilih siswa saat onboarding.
// Akan digantikan oleh rekomendasi dinamis setelah pretest elemen selesai.
const MAPEL_LIST_ALL = ADMIN_MAPEL_LIST.filter(m => KURIKULUM_ELEMEN[m.id] || KURIKULUM[m.id]);

const buildRekomendasiAwal = (selectedMapels) => {
  const mapelIds = selectedMapels && selectedMapels.length > 0
    ? selectedMapels
    : ['mat', 'bio', 'fis']; // fallback default jika belum pilih

  return mapelIds.slice(0, 3).map((mapelId, i) => {
    const mapelMeta = MAPEL_LIST_ALL.find(m => m.id === mapelId);
    const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
    const firstElemen = elemenList[0] || { id: mapelId, label: mapelId };

    // Cek apakah elemen pertama punya daftar materi
    const materiList = MATERI_PER_ELEMEN?.[mapelId]?.[firstElemen.id];
    const hasMateri = Array.isArray(materiList) && materiList.length > 0;

    // Jika ada materi → ambil materi pertama; jika tidak → materiId = label elemen
    const firstMateri = hasMateri ? materiList[0] : firstElemen.label;

    return {
      id: `rekom_init_${i}`,
      mapelId,
      mapelLabel: mapelMeta?.label || mapelId,
      mapelIcon: mapelMeta?.icon || '📚',
      mapelColor: mapelMeta?.color || C.teal,
      elemenId: firstElemen.id,
      elemenLabel: firstElemen.label,
      materiId: firstMateri,
      // isMateriLevel: true jika elemen punya breakdown materi → pretest per materi
      isMateriLevel: hasMateri,
      targetMateriId: hasMateri ? firstMateri : null,
      alasan: `Mulai belajar ${mapelMeta?.label || mapelId} dari${hasMateri ? ` materi "${firstMateri}" dalam` : ''} elemen ${firstElemen.label}. Pretest singkat menentukan level belajarmu.`,
      tag: '🎯 Mulai dari sini',
    };
  });
};

/* ── Ambil 4 topik terbaru dari progressData (diurutkan berdasarkan lastChat terbaru) ── */
const getLastTopicPerMapel = (progressData) => {
  // Gabungkan semua progress, ambil yang terbaru per materiId, urutkan by lastChat desc
  const all = [...progressData.belumSelesai, ...progressData.sudahSelesai];
  // Deduplikasi: jika materiId muncul di keduanya, ambil yang di sudahSelesai
  const byKey = {};
  all.forEach(m => {
    const key = `${m.mapelId}__${m.materiId}`;
    if (!byKey[key] || progressData.sudahSelesai.includes(m)) byKey[key] = m;
  });
  // Urutkan: yang paling baru di atas (lastChat = 'Baru saja' atau timestamp string)
  // Gunakan urutan array aslinya sebagai proxy waktu (entry terbaru ada di belakang array)
  const items = Object.values(byKey);
  // Kembalikan 4 terbaru — dibalik karena addRecentActivity prepend (terbaru di index 0)
  // progressData entries tidak punya timestamp eksplisit, gunakan posisi array (belakang = terbaru)
  return items.slice(-4).reverse();
};

/* ── Status helper ──────────────────────────────────────────────────────── */
const fmtWaktuRelatif = (ts) => {
  if (!ts) return 'Baru saja';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffJam = Math.floor(diffMin / 60);
  if (diffJam < 24) return `${diffJam} jam lalu`;
  const diffHari = Math.floor(diffJam / 24);
  return diffHari === 1 ? '1 hari lalu' : `${diffHari} hari lalu`;
};

/* ── Helper: format durasi jam (misal 3.8 jam) ── */
const fmtDurasi = (jamFloat) => {
  const num = parseFloat(jamFloat) || 0;
  if (num === 0) return '0 jam';
  return `${num.toFixed(1)} jam`;
};

/* ── Helper: hitung streak dari riwayat ──────────────────────────────────
 * Streak = hari belajar berturut-turut mundur dari tanggal terakhir belajar.
 * Field riwayat[].tanggal format: "Senin, 16 Mar 2026"
 */
const hitungStreak = (riwayat) => {
  if (!riwayat || riwayat.length === 0) return 0;

  // Parse semua tanggal unik dari riwayat
  const bulanMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
    Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11,
  };

  const uniqueDays = new Set();
  riwayat.forEach(r => {
    // Format: "Senin, 16 Mar 2026" → ambil bagian setelah koma
    const parts = (r.tanggal || '').split(', ');
    if (parts.length < 2) return;
    const [tgl, bln, thn] = parts[1].split(' ');
    if (!tgl || !bln || !thn) return;
    const dateKey = `${thn}-${bulanMap[bln]}-${parseInt(tgl, 10)}`;
    uniqueDays.add(dateKey);
  });

  // Urutkan descending
  const sorted = Array.from(uniqueDays)
    .map(k => { const [y, m, d] = k.split('-'); return new Date(+y, +m, +d); })
    .sort((a, b) => b - a);

  if (sorted.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffMs = sorted[i - 1] - sorted[i];
    const diffHari = Math.round(diffMs / 86400000);
    if (diffHari === 1) streak++;
    else break;
  }
  return streak;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 11) return { text: 'Selamat Pagi', emoji: '🌤️' };
  if (h < 15) return { text: 'Selamat Siang', emoji: '☀️' };
  if (h < 18) return { text: 'Selamat Sore', emoji: '🌇' };
  return { text: 'Selamat Malam', emoji: '🌙' };
};

/* ── Dummy notifikasi dari guru ─────────────────────────────────────────── */
const NOTIFIKASI_GURU_INIT = [
  {
    id: 'ng1',
    guruNama: 'Bpk. Hendra, M.Pd.',
    guruMapel: '📐 Matematika',
    pesan: 'Budi, coba ulangi materi Persamaan Linear dari awal ya. Fokus di soal-soal yang melibatkan dua variabel. Kalau masih bingung, tanya langsung ke mentor AI dan minta contoh soal bertahap.',
    ts: Date.now() - 1000 * 60 * 14,
    dibaca: false,
  },
  {
    id: 'ng2',
    guruNama: 'Bpk. Hendra, M.Pd.',
    guruMapel: '📐 Matematika',
    pesan: 'Skor kuizmu sudah bagus di Statistika! Coba lanjut ke Fungsi Kuadrat minggu ini dan selesaikan minimal level Mid ya.',
    ts: Date.now() - 1000 * 60 * 60 * 26,
    dibaca: true,
  },
];

/* ── BellIcon SVG ──────────────────────────────────────────────────────── */
const BellIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/* ── NotifikasiBell — icon bell + dropdown panel ──────────────────────── */
const NotifikasiBell = ({ siswaId }) => {
  // FIX P1: load rekomendasi dari GET /guru/rekomendasi — bukan dummy hardcoded
  const [notifs, setNotifs] = useState(NOTIFIKASI_GURU_INIT); // seed dengan dummy sambil API load
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const panelRef = useRef(null);

  // Fetch dari backend saat mount — fallback ke dummy jika API belum tersedia
  useEffect(() => {
    (async () => {
      try {
        const data = await getRekomendasiSiswa({ siswa_id: siswaId || CURRENT_STUDENT_ID });
        if (Array.isArray(data) && data.length > 0) {
          // Normalise response ke format notif lokal
          setNotifs(data.map(r => ({
            id: r.id,
            guruNama: r.guru_nama || 'Guru',
            guruMapel: r.guru_mapel || '📚 Pelajaran',
            pesan: r.pesan || '',
            ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            dibaca: r.dibaca ?? false,
          })));
        }
        // Jika array kosong — pertahankan dummy seed supaya UI tidak kosong saat dev
      } catch {
        // Fallback silent — dummy init tetap dipakai
      }
    })();
  }, [siswaId]);

  const unreadCount = notifs.filter(n => !n.dibaca).length;

  const fmtTs = (ts) => {
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 2) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffJam = Math.floor(diffMin / 60);
    if (diffJam < 24) return `${diffJam} jam lalu`;
    const diffHari = Math.floor(diffJam / 24);
    return diffHari === 1 ? 'Kemarin' : `${diffHari} hari lalu`;
  };

  const markRead = (id) => setNotifs(p => p.map(n => n.id === id ? { ...n, dibaca: true } : n));
  const deleteNotif = (e, id) => {
    e.stopPropagation();
    setNotifs(p => p.filter(n => n.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={panelRef} style={{ position: 'relative', zIndex: 10 }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'relative',
          background: open ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.12)',
          border: `1.5px solid ${open ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)'}`,
          borderRadius: 10,
          width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: C.white,
          backdropFilter: 'blur(6px)',
          transition: 'all .2s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = 'rgba(255,255,255,.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.4)'; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'rgba(255,255,255,.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.2)'; } }}
      >
        <BellIcon size={17} color={C.white} />
        {/* Badge unread */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            width: 18, height: 18, borderRadius: '50%',
            background: C.amber, color: C.white,
            fontSize: FS.xs, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(13,92,99,1)',
            animation: 'sr-pulse .7s ease-in-out infinite',
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 360, maxHeight: 480,
          background: C.white, borderRadius: 16,
          boxShadow: '0 16px 48px rgba(26,35,50,.22), 0 4px 16px rgba(0,0,0,.1)',
          border: `1.5px solid ${C.tealXL}`,
          overflow: 'hidden',
          animation: 'sr-fadeUp .2s ease both',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: `1px solid ${C.tealXL}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `linear-gradient(135deg, ${C.teal}08, transparent)`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>💬</span>
              <span style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>Notifikasi dari Guru</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: FS.xs, padding: '1px 8px', borderRadius: 99,
                  background: C.amber, color: C.white, fontWeight: 800,
                }}>
                  {unreadCount} baru
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.slate, fontSize: FS.xl, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}
            >✕</button>
          </div>

          {/* Notif list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>💬</div>
                <div style={{ fontSize: FS.md, color: C.slate }}>Belum ada notifikasi dari guru</div>
              </div>
            ) : notifs.map((n, idx) => {
              const isExpanded = expandedId === n.id;
              return (
                <div key={n.id} style={{
                  borderBottom: idx < notifs.length - 1 ? `1px solid ${C.tealXL}` : 'none',
                  background: !n.dibaca ? `${C.amber}06` : 'transparent',
                  transition: 'background .15s',
                }}>
                  {/* Header row */}
                  <div
                    onClick={() => { setExpandedId(isExpanded ? null : n.id); if (!n.dibaca) markRead(n.id); }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '12px 14px', cursor: 'pointer',
                    }}
                  >
                    {/* Avatar with unread dot */}
                    <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: `${C.amber}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h3,
                      }}>🧑‍🏫</div>
                      {!n.dibaca && (
                        <span style={{
                          position: 'absolute', top: -2, right: -2,
                          width: 8, height: 8, borderRadius: '50%',
                          background: C.amber, border: '2px solid white',
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>{n.guruNama}</span>
                        <span style={{ fontSize: FS.xs, color: C.slate }}>· {n.guruMapel}</span>
                      </div>
                      <div style={{
                        fontSize: FS.md, color: C.darkL, lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: isExpanded ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {n.pesan}
                      </div>
                      <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 4 }}>{fmtTs(n.ts)}</div>
                    </div>

                    {/* Right controls */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <button
                        onClick={(e) => deleteNotif(e, n.id)}
                        title="Hapus notifikasi"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: C.slate, fontSize: FS.base, padding: '2px 4px', borderRadius: 5,
                          transition: 'color .15s',
                          lineHeight: 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = C.red || '#E53E3E'}
                        onMouseLeave={e => e.currentTarget.style.color = C.slate}
                      >
                        🗑️
                      </button>
                      <span style={{ fontSize: FS.xs, color: C.teal }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/*  HERO GABUNGAN  (tanggal · greeting · streak · AI Insight + Bell Notif)  */
/* ─────────────────────────────────────────────────────────────────────── */
const HeroWithInsight = ({ adminData, totalSesiHours, avgQuiz, topMapel, dominantEmosi, streakDays }) => {
  const [aiInsight, setAiInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [displayed, setDisplayed] = useState('');
  const timerRef = useRef(null);

  const { text: greetText, emoji: greetEmoji } = getGreeting();
  const firstName = (adminData?.nama || 'Budi Santoso').split(' ')[0];
  const tanggal = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  /* Typing-effect helper */
  const typeText = (text) => {
    setDisplayed('');
    let i = 0;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timerRef.current);
    }, 18);
  };

  // FIX ①: pakai getMentorInsight() dari api/mentor.js
  //  - endpoint: POST /mentor/insight  (bukan /api/ai-insight)
  //  - melewati apiClient → auto-attach JWT → diintersep MSW
  //  - payload sesuai contract v2.1.0
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await getMentorInsight({
          siswa_id: CURRENT_STUDENT_ID,
          nama: adminData?.nama || 'Siswa',
          top_mapel: topMapel || null,
          emosi_dominan: dominantEmosi || null,
          total_jam: totalSesiHours,
          rata_quiz: avgQuiz,
          streak_hari: streakDays,
        });
        const t = result?.text || '';
        if (t) { setAiInsight(t); typeText(t); }
        else throw new Error('empty response');
      } catch {
        const f = '🌟 Kamu sudah menunjukkan semangat yang luar biasa — terus pertahankan ritme belajarmu!';
        setAiInsight(f);
        typeText(f);
      }
      setLoading(false);
    })();
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    // Wrapper luar: position relative + overflow visible agar dropdown bell tidak terpotong
    <div style={{ position: 'relative', marginBottom: 20, animation: 'sr-fadeUp .5s ease both' }}>

      {/* Bell ditaruh di LUAR hero (di atas, absolute pojok kanan) agar bebas dari overflow:hidden */}
      <div style={{ position: 'absolute', top: 14, right: 16, zIndex: 20 }}>
        <NotifikasiBell siswaId={CURRENT_STUDENT_ID} />
      </div>

      {/* Hero card — overflow:hidden hanya mempengaruhi konten di dalamnya */}
      <div style={{
        borderRadius: 22,
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${C.dark} 0%, #1e3a4a 45%, ${C.teal} 100%)`,
        boxShadow: `0 8px 32px rgba(13,92,99,.28), 0 2px 8px rgba(0,0,0,.12)`,
        position: 'relative',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 80, bottom: -60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -20, bottom: -30, width: 100, height: 100, borderRadius: '50%', background: `${C.amber}16`, pointerEvents: 'none' }} />
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '26px 28px 24px' }}>

          {/* Row 1 — tanggal (bell sudah dipindah ke luar hero) */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, paddingRight: 52 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,.09)', borderRadius: 99, padding: '4px 12px',
              fontSize: FS.sm, color: 'rgba(255,255,255,.65)',
              backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.1)',
            }}>
              📅 {tanggal}
            </div>
          </div>

          {/* Row 2 — Greeting */}
          <div style={{
            fontSize: 30, fontWeight: 800, color: C.white, lineHeight: 1.2, marginBottom: 10,
            letterSpacing: '-0.3px',
            animation: 'sr-fadeUp .5s .1s ease both', animationFillMode: 'forwards',
          }}>
            {greetEmoji} {greetText}, <span style={{ color: C.amberL }}>{firstName}!</span>
          </div>

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,.04))',
            marginBottom: 16, marginTop: 4,
          }} />

          {/* Row 3 — AI Mentor Insight */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            animation: 'sr-fadeUp .5s .2s ease both', animationFillMode: 'forwards',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: `linear-gradient(135deg,${C.amber}55,${C.amber}22)`,
              border: `1.5px solid ${C.amber}60`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              animation: 'sr-float 4s ease-in-out infinite',
            }}>🤖</div>

            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: FS.xs, fontWeight: 800, color: C.amber,
                textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                  background: C.amber,
                  animation: loading ? 'sr-pulse .7s ease-in-out infinite' : 'none',
                }} />
                AI Mentor Insight
              </div>

              {loading ? (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 22 }}>
                  {[0, .2, .4].map((d, i) => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: '50%', background: C.amber,
                      animation: `sr-pulse .8s ${d}s ease-in-out infinite`,
                    }} />
                  ))}
                  <span style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.md, marginLeft: 4 }}>
                    Menganalisis pola belajarmu...
                  </span>
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,.88)', fontSize: 13.5, lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
                  {displayed}
                  {aiInsight && displayed.length < aiInsight.length && (
                    <span style={{
                      display: 'inline-block', width: 2, height: 14, background: C.amber,
                      marginLeft: 2, verticalAlign: 'middle',
                      animation: 'sr-pulse .6s ease-in-out infinite',
                    }} />
                  )}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const RekomCard = ({ rekom, onStart }) => {
  const { getElemenLevel, getMateriLevel } = useStudentStore(s => ({
    getElemenLevel: s.getElemenLevel,
    getMateriLevel: s.getMateriLevel,
    _levels: s.studentLevels, // subscribe agar re-render saat level naik
  }));
  const elemenId = rekom.elemenId;
  const materiPerElemen = elemenId ? (MATERI_PER_ELEMEN[rekom.mapelId] || {})[elemenId] || [] : [];
  const hasMateriBreakdown = materiPerElemen.length > 0;
  const level = elemenId
    ? (hasMateriBreakdown && (rekom.targetMateriId || rekom.materiId)
      ? getMateriLevel(rekom.mapelId, elemenId, rekom.targetMateriId || rekom.materiId)
      : getElemenLevel(rekom.mapelId, elemenId))
    : 'low';
  const lvlMeta = { low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' }, mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' }, high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' } }[level] || { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' };
  return (
    <div style={{
      background: C.white, borderRadius: 14, overflow: 'hidden',
      border: `1.5px solid ${rekom.mapelColor}22`,
      boxShadow: `0 2px 12px ${rekom.mapelColor}10`,
      transition: 'transform .2s, box-shadow .2s',
      display: 'flex', flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${rekom.mapelColor}22`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 2px 12px ${rekom.mapelColor}10`; }}>
      <div style={{ height: 4, background: `linear-gradient(90deg,${rekom.mapelColor},${rekom.mapelColor}88)` }} />
      <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${rekom.mapelColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, flexShrink: 0 }}>
            {rekom.mapelIcon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FS.xs, fontWeight: 700, color: rekom.mapelColor, textTransform: 'uppercase', letterSpacing: 0.8 }}>{rekom.mapelLabel}</div>
            {rekom.elemenLabel && <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 1 }}>{rekom.elemenLabel}</div>}
            <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark, lineHeight: 1.3, marginTop: 2 }}>{rekom.materiId}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
            {rekom.tag && (
              <span style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 99, background: `${rekom.mapelColor}15`, color: rekom.mapelColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {rekom.tag}
              </span>
            )}
            <span style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 99, fontWeight: 700, background: lvlMeta.bg, color: lvlMeta.color, border: `1px solid ${lvlMeta.border}` }}>
              {lvlMeta.label}
            </span>
          </div>
        </div>
        <div style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.55, marginBottom: 10, flex: 1 }}>{rekom.alasan}</div>
        <button onClick={() => onStart(rekom)}
          style={{ width: '100%', padding: '9px 0', borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${rekom.mapelColor},${rekom.mapelColor}cc)`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          📚 Mulai Belajar
        </button>
      </div>
    </div>
  );
};

const ProgressCard = ({ m, onResume }) => (
  <div style={{ background: C.white, borderRadius: 12, padding: '12px 14px', border: `1px solid ${m.mapelColor}22`, display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.mapelColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, flexShrink: 0 }}>
      {m.mapelIcon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: FS.xs, fontWeight: 700, color: m.mapelColor }}>{m.mapelLabel}</div>
      <div style={{ fontSize: FS.base, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.materiId}</div>
    </div>
    <button onClick={() => onResume(m)}
      style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${m.mapelColor}`, background: 'none', color: m.mapelColor, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all .2s', whiteSpace: 'nowrap' }}
      onMouseEnter={e => { e.currentTarget.style.background = m.mapelColor; e.currentTarget.style.color = C.white; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = m.mapelColor; }}>
      Lanjutkan →
    </button>
  </div>
);

/* ── Main Component ─────────────────────────────────────────────────────── */
const DashboardSection = ({ progressData, setActivePage, openChatWithWebcam, pretestResult, onNavigateToPretest }) => {
  const mapelProgress = getLastTopicPerMapel(progressData);
  const [showAllActivity, setShowAllActivity] = useState(false);

  // Ambil aktivitas terbaru langsung dari store (persisten)
  const recentActivity = useStudentStore(s => s.recentActivity);

  /* ── Ambil data siswa untuk KPI & AI Insight ── */
  const studentData = STUDENTS?.find(s => s.id === CURRENT_STUDENT_ID);
  const riwayat = studentData?.riwayat || [];

  // FIX P3: fetch progress real dari GET /content/progress — augment data lokal
  // PENTING: API hanya dipakai jika data lokal (progressData / riwayat) kosong.
  // Jangan override data lokal yang sudah ada — data MSW/backend bisa berbeda dengan master data.
  const [apiProgress, setApiProgress] = useState(null);
  useEffect(() => {
    // Jika sudah ada data lokal yang valid, tidak perlu fetch API
    const hasLocalData = (progressData?.total_poin_quiz != null) ||
      ((studentData?.riwayat || []).length > 0);
    if (hasLocalData) return;
    getLearningProgress({ siswa_id: CURRENT_STUDENT_ID })
      .then(data => setApiProgress(data))
      .catch(() => { /* silent */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // selectedMapels dari store — harus dideklarasikan SEBELUM useEffect yang memakainya
  const selectedMapels = useStudentStore(s => s.selectedMapels);

  // Rekomendasi dari API — 3 sumber prioritas:
  //   1. pretestResult.wrongTopics (paling relevan)
  //   2. GET /content/recommend dengan mapel_ids → RAG Tim 3
  //   3. buildRekomendasiAwal(selectedMapels) → fallback lokal
  //
  // FIX flash: tidak ada useState(null) → rekomAwal tampil langsung tanpa flash.
  // FIX first-login: jika selectedMapels kosong → skip API → rekomAwal dipakai.
  // FIX konsistensi: kirim mapel_ids ke API, resolve label dari masterData.
  const [apiRekom, setApiRekom] = useState(null);
  useEffect(() => {
    if (!selectedMapels || selectedMapels.length === 0) return;
    let active = true;
    getRecommendations({
      siswa_id: CURRENT_STUDENT_ID,
      mapel_ids: selectedMapels.join(','),
    })
      .then(data => {
        if (!active || !Array.isArray(data) || !data.length) return;
        const normalized = data.map((r, i) => {
          const mapelId = r.mapel_id;
          const mapelMeta = MAPEL_LIST_ALL.find(m => m.id === mapelId) || {};
          const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
          const elemenMatch = elemenList.find(e => e.id === r.elemen_id) || elemenList[0]
            || { id: r.elemen_id || mapelId, label: r.elemen_label || mapelId };
          const elemenId = elemenMatch.id;
          const elemenLbl = elemenMatch.label;
          const materiList = (MATERI_PER_ELEMEN?.[mapelId]?.[elemenId]) || [];
          const isMateriLevel = materiList.length > 0;
          const materiMatch = materiList.find(
            m => m.toLowerCase() === (r.materi || '').toLowerCase()
          );
          const materiId = materiMatch || r.materi || elemenLbl;
          return {
            id: `rekom_api_${i}`,
            mapelId,
            mapelLabel: mapelMeta.label || mapelId,
            mapelIcon: mapelMeta.icon || '📚',
            mapelColor: mapelMeta.color || C.teal,
            elemenId,
            elemenLabel: elemenLbl,
            materiId,
            isMateriLevel,
            targetMateriId: isMateriLevel ? materiId : null,
            alasan: r.alasan || 'Direkomendasikan untuk kamu',
            tag: i === 0 ? '⭐ Rekomendasi' : '📝 Coba Ini',
          };
        });
        setApiRekom(normalized);
      })
      .catch(() => { });
    return () => { active = false; };
  }, [selectedMapels.join(',')]); // re-fetch jika selectedMapels berubah (setelah aktivasi)

  // REVISI FASE 3: localQuizScore = akumulasi agregasi (MC 70% + Essay 30%) semua materi
  // Baca dari quiz_results[] per sesi riwayat — format baru selaras dengan quizHistory store
  const localQuizScore = (() => {
    const riwayatArr = studentData?.riwayat || [];
    const grupMap = {};
    riwayatArr.forEach(r => {
      (r.quiz_results || []).forEach(qr => {
        const key = `${r.materiId || 'umum'}__${qr.level || 'low'}`;
        if (!grupMap[key]) grupMap[key] = { mc: null, essay: null };
        if (qr.type === 'essay') grupMap[key].essay = qr.score ?? null;
        else grupMap[key].mc = qr.score ?? null;
      });
    });
    return Object.values(grupMap).reduce((sum, { mc, essay }) => {
      if (mc != null && essay != null) return sum + Math.round(mc * MC_WEIGHT + essay * ESSAY_WEIGHT);
      if (mc != null) return sum + mc;
      if (essay != null) return sum + essay;
      return sum;
    }, 0);
  })();
  const totalScore = (progressData?.total_poin_quiz ?? localQuizScore) || apiProgress?.total_poin_quiz || 0;
  const streakDays = hitungStreak(riwayat) || apiProgress?.streak_hari || 0;
  const localSesiHours = riwayat.reduce((s, r) => s + (r.durasi || 0), 0).toFixed(1);
  const totalSesiHours = localSesiHours || (apiProgress ? (apiProgress.total_waktu_menit / 60).toFixed(1) : '0.0');
  // REVISI FASE 3: localAvgQuiz = rata-rata agregasi (MC 70% + Essay 30%) per materi+level
  const localAvgQuiz = (() => {
    const riwayatArr = studentData?.riwayat || [];
    if (!riwayatArr.length) return 0;
    const grupMap = {};
    riwayatArr.forEach(r => {
      (r.quiz_results || []).forEach(qr => {
        const key = `${r.materiId || 'umum'}__${qr.level || 'low'}`;
        if (!grupMap[key]) grupMap[key] = { mc: null, essay: null };
        if (qr.type === 'essay') grupMap[key].essay = qr.score ?? null;
        else grupMap[key].mc = qr.score ?? null;
      });
    });
    const scores = Object.values(grupMap).map(({ mc, essay }) => {
      if (mc != null && essay != null) return Math.round(mc * MC_WEIGHT + essay * ESSAY_WEIGHT);
      return mc ?? essay ?? null;
    }).filter(s => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  })();
  const avgQuiz = localAvgQuiz || apiProgress?.rata_rata_quiz || 0;
  const topMapel = (() => {
    if (!riwayat || riwayat.length === 0) return null;
    const freq = {};
    riwayat.forEach(r => {
      const key = r.materiId || 'Lainnya';
      freq[key] = (freq[key] || 0) + 1;
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();
  const dominantEmosi = (() => {
    if (!riwayat || riwayat.length === 0) return null;
    const freq = {};
    riwayat.forEach(r => {
      (r.emosiSesi || []).forEach(e => {
        freq[e.emosi] = (freq[e.emosi] || 0) + 1;
      });
    });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  /* Bangun daftar rekomendasi — FIX 1: 3 sumber dengan prioritas jelas
   * 1. wrongTopics dari pretest (paling relevan — siswa baru selesai pretest)
   * 2. apiRekom dari GET /content/recommend (RAG Tim 3 — berdasarkan aktivitas)
   * 3. buildRekomendasiAwal(selectedMapels) — fallback saat pertama login / API kosong
   */
  const rekomAwal = buildRekomendasiAwal(selectedMapels);
  const rekomList = (pretestResult?.wrongTopics?.length > 0)
    ? pretestResult.wrongTopics.slice(0, 3).map((wt, i) => ({
      ...wt,
      alasan: i === 0
        ? `Kamu menjawab salah soal ${wt.materiId} di pretest. Mentor AI siapkan materi step-by-step untuk topik ini.`
        : `${wt.materiId} perlu penguatan. Mulai dari konsep dasar untuk fondasi yang kuat.`,
      tag: i === 0 ? '⚡ Prioritas' : '📝 Perlu Latihan',
    }))
    : (apiRekom ?? rekomAwal);

  const ACTIVITY_LIMIT = 10;  // batas tampil aktivitas terbaru sebelum expand

  return (
    <div style={{ overflowY: 'auto', height: '100%', width: '100%', padding: 'var(--content-py, 20px) var(--content-px, 22px)', background: C.bg }}>

      {/* ── HERO GABUNGAN (dengan Bell Notif di pojok kanan atas) ── */}
      <HeroWithInsight
        adminData={studentData}
        totalSesiHours={totalSesiHours}
        avgQuiz={avgQuiz}
        topMapel={topMapel}
        dominantEmosi={dominantEmosi}
        streakDays={streakDays}
      />

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '⚡', val: `${streakDays} Hari`, label: 'Streak Belajar', color: C.amber },
          { icon: '🎓', val: progressData.sudahSelesai.length, label: 'Topik Selesai', color: C.green },
          { icon: '🏆', val: totalScore, label: 'Poin Quiz', color: C.teal },
          { icon: '⏳', val: fmtDurasi(totalSesiHours), label: 'Total Belajar', color: C.purple },
        ].map(s => (
          <Card key={s.label} style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: FS.xs, color: C.slate, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* ── Rekomendasi dari Pretest / RAG ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>⭐ Rekomendasi Belajar</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
              {pretestResult?.wrongTopics?.length > 0
                ? 'Topik yang perlu diperkuat berdasarkan hasil pretestmu'
                : 'Topik pilihan yang bagus untuk kamu pelajari'}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {rekomList.map((r, i) => (
            <RekomCard key={`${r.mapelId}-${r.materiId}-${i}`} rekom={r}
              onStart={(rekom) => {
                const store = useStudentStore.getState();
                const { mapelId, elemenId, elemenLabel, materiId, isMateriLevel, targetMateriId } = rekom;

                if (!elemenId) {
                  // Tidak ada elemenId — langsung buka chat (fallback)
                  openChatWithWebcam({
                    mapelId, mapelLabel: rekom.mapelLabel,
                    mapelIcon: rekom.mapelIcon, mapelColor: rekom.mapelColor,
                    materiId, source: 'dashboard',
                  });
                  return;
                }

                // Cek apakah pretest sudah dikerjakan
                const pretestDone = isMateriLevel
                  ? store.isPretestMateriDone(mapelId, elemenId, targetMateriId || materiId)
                  : store.isPretestElemenDone(mapelId, elemenId);

                if (!pretestDone) {
                  // Belum pretest → arahkan ke pretest dulu
                  onNavigateToPretest?.({
                    mapelId, elemenId,
                    elemenLabel: elemenLabel || materiId,
                    isMateriLevel: !!isMateriLevel,
                    targetMateriId: targetMateriId || null,
                    materiData: {
                      mapelId, mapelLabel: rekom.mapelLabel,
                      mapelIcon: rekom.mapelIcon, mapelColor: rekom.mapelColor,
                      materiId, elemenId, elemenLabel,
                      source: 'dashboard',
                    },
                  });
                } else {
                  // Sudah pretest → ambil level terkini dari store lalu buka chat
                  const materiPerElemen = (MATERI_PER_ELEMEN[mapelId] || {})[elemenId] || [];
                  const hasMateriBreakdown = materiPerElemen.length > 0;
                  const currentLevel = hasMateriBreakdown && (targetMateriId || materiId)
                    ? store.getMateriLevel(mapelId, elemenId, targetMateriId || materiId)
                    : store.getElemenLevel(mapelId, elemenId);

                  openChatWithWebcam({
                    mapelId, mapelLabel: rekom.mapelLabel,
                    mapelIcon: rekom.mapelIcon, mapelColor: rekom.mapelColor,
                    materiId, elemenId, elemenLabel,
                    level: currentLevel,
                    source: 'dashboard',
                  });
                }
              }} />
          ))}
        </div>
      </div>

      {/* ── Progress per Mapel (4 terbaru) ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>🔄 Progress Belajar</div>
          <button onClick={() => setActivePage('progress')} style={{ background: 'none', border: 'none', fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer' }}>Lihat Semua →</button>
        </div>
        {mapelProgress.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mapelProgress.map(m => <ProgressCard key={m.id} m={m}
              onResume={(materi) => {
                // Ambil level terkini dari store (bukan dari progressData yang bisa stale)
                const store = useStudentStore.getState();
                const elemenId = materi.elemenId;
                let currentLevel = 'low';
                if (elemenId) {
                  const materiPerElemen = (MATERI_PER_ELEMEN[materi.mapelId] || {})[elemenId] || [];
                  const hasMateriBreakdown = materiPerElemen.length > 0;
                  currentLevel = hasMateriBreakdown && materi.materiId
                    ? store.getMateriLevel(materi.mapelId, elemenId, materi.materiId)
                    : store.getElemenLevel(materi.mapelId, elemenId);
                }
                openChatWithWebcam({
                  mapelId: materi.mapelId,
                  mapelLabel: materi.mapelLabel,
                  mapelIcon: materi.mapelIcon,
                  mapelColor: materi.mapelColor,
                  materiId: materi.materiId,
                  elemenId: materi.elemenId,
                  elemenLabel: materi.elemenLabel,
                  level: currentLevel,
                  source: 'resume',
                });
              }} />)}
          </div>
        ) : (
          <EmptyState
            icon="📚"
            title="Belum ada progress belajar"
            sub="Mulai belajar dari rekomendasi di atas atau pilih mata pelajaran di menu Progress"
          />
        )}
      </div>

      {/* ── Aktivitas Terbaru ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>
            📋 Aktivitas Terbaru
          </div>
          {recentActivity.length > ACTIVITY_LIMIT && (
            <button onClick={() => setShowAllActivity(v => !v)}
              style={{ background: 'none', border: 'none', fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer' }}>
              {showAllActivity ? 'Sembunyikan ▲' : `Lihat semua (${recentActivity.length}) ▼`}
            </button>
          )}
        </div>
        <Card style={{ padding: '4px 0', overflow: 'hidden' }}>
          {(() => {
            const displayed = showAllActivity ? recentActivity : recentActivity.slice(0, ACTIVITY_LIMIT);
            return displayed.map((act, i) => {
              const lvl = act.level || null;
              const lvlMeta = lvl
                ? ({ low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' }, mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' }, high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' } }[lvl] || null)
                : null;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  borderBottom: i < displayed.length - 1 ? `1px solid ${C.tealXL}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: `${act.mapelColor}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h2, flexShrink: 0
                  }}>
                    {act.type === 'game' ? '🎮' : act.type === 'quiz' ? '📝' : act.mapelIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark, lineHeight: 1.4 }}>{act.label}</span>
                      {lvlMeta && (
                        <span style={{
                          fontSize: FS.xs, padding: '1px 7px', borderRadius: 99, fontWeight: 700,
                          background: lvlMeta.bg, color: lvlMeta.color, border: `1px solid ${lvlMeta.border}`,
                          flexShrink: 0,
                        }}>
                          Lv.{lvlMeta.label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{fmtWaktuRelatif(act.ts)}</div>
                  </div>
                </div>
              );
            });
          })()}
          {recentActivity.length === 0 && (
            <EmptyState icon="📖" title="Belum ada aktivitas" sub="Ayo mulai belajar!" style={{ fontSize: FS.md, padding: '24px' }} />
          )}
          {!showAllActivity && recentActivity.length > ACTIVITY_LIMIT && (
            <div
              onClick={() => setShowAllActivity(true)}
              style={{ padding: '10px 16px', textAlign: 'center', fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', borderTop: `1px solid ${C.tealXL}` }}
              onMouseEnter={e => e.currentTarget.style.background = `${C.teal}06`}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              + {recentActivity.length - ACTIVITY_LIMIT} aktivitas lainnya ▼
            </div>
          )}

        </Card>
      </div>
    </div>
  );
};

export default DashboardSection;