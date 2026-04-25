/**
 * SR MVP — RiwayatKontenSection (Portal Guru) — REVISI FASE 3
 *
 * Menggantikan GameSection (Buat Game).
 * Berisi data konten belajar yang sudah dibuat dan dipublish.
 * Guru bisa melihat kembali konten-konten yang dihasilkan sebelumnya.
 * Poin 4: "Lihat Konten" menampilkan isi lengkap + level tabs, sama seperti review di KelolaBelajarSection.
 * Game: guru bisa preview fullscreen (container Tim 4) dan lihat siswa yang selesai.
 */
import { useState } from 'react';
import { Card, Btn, Avatar } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import {
  ADMIN_MAPEL_LIST,
  ADMIN_KELAS_INIT,
  ADMIN_SISWA_INIT,
  CAPAIAN_PEMBELAJARAN,
} from '../../../data/masterData';

/* ── Placeholder teks konten ─────────────────────────────────────── */
const getPlaceholderText = (type, level, riwayat) => {
  const mapel = riwayat.mapelLabel;
  const elemen = riwayat.elemenLabel;
  const materi = riwayat.materi || elemen;
  const t = {
    bacaan: `Teks bacaan tentang ${materi} dalam konteks ${mapel}.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`,
    quiz_pg: `[Quiz Pilihan Ganda – ${level}]\n1. Pertanyaan tentang ${materi}?\n   a) Pilihan A\n   b) Pilihan B ✓\n   c) Pilihan C\n   d) Pilihan D\n\n2. Soal lanjutan tentang ${elemen}?\n   a) Pilihan A\n   b) Pilihan B\n   c) Pilihan C ✓\n   d) Pilihan D`,
    quiz_essay: `[Quiz Essay – ${level}]\nJelaskan konsep ${materi} dalam konteks ${elemen}! Berikan contoh konkret dari kehidupan sehari-hari.`,
    flashcard: `[Flashcard – ${level}]\nDepan: Apa yang dimaksud dengan ${materi}?\nBelakang: ${materi} adalah konsep dalam ${mapel} yang berkaitan dengan ${elemen}.`,
    mindmap: `[Mindmap – ${mapel}]\nTopik Utama: ${elemen}\n├─ Subtopik 1: Definisi & Konsep\n│  ├─ Point A\n│  └─ Point B\n├─ Subtopik 2: ${materi}\n│  ├─ Contoh Kasus\n│  └─ Aplikasi\n└─ Subtopik 3: Evaluasi`,
    game: `[Game – Level ${level}]\nJenis: Kuis Interaktif Skenario\nTopik: ${materi}\nDurasi: ${level === 'Low' ? '10' : level === 'Mid' ? '20' : '30'} menit`,
  };
  return t[type] || `Konten ${type} level ${level} untuk ${materi}.`;
};

/* ── Game Preview Modal (container Tim 4) ────────────────────────── */
const GamePreviewRiwayat = ({ riwayat, level, onClose }) => {
  const gameParams = new URLSearchParams({
    mapelId: ADMIN_MAPEL_LIST.find(m => m.label === riwayat.mapelLabel)?.id || '',
    elemen: riwayat.elemenLabel, materi: riwayat.materi || '', level, mode: 'preview',
  }).toString();
  const gameUrl = `https://game.sekolahrakyat.id/play?${gameParams}`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.75)', zIndex: 1300, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: '24px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.teal, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>Preview Game — Level {level}</div>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: FS.sm, marginTop: 1 }}>
              {riwayat.mapelLabel} · {riwayat.elemenLabel}
              <span style={{ marginLeft: 8, background: 'rgba(255,255,255,.15)', padding: '1px 8px', borderRadius: 99, fontSize: 10 }}>Mode Preview</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 30, height: 30, color: C.white, cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ flex: 1, background: '#0f172a', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 56, opacity: .3 }}>🎮</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: FS.lg, fontWeight: 600 }}>Container Game Tim 4</div>
            <div style={{ color: 'rgba(255,255,255,.3)', fontSize: FS.md, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
              Game akan ditampilkan di sini setelah integrasi dengan Tim 4.<br />
              <strong style={{ color: 'rgba(255,255,255,.5)' }}>{riwayat.elemenLabel}</strong> · Level <strong style={{ color: 'rgba(255,255,255,.5)' }}>{level}</strong>
            </div>
            <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 16px', fontSize: FS.xs, color: 'rgba(255,255,255,.35)', fontFamily: 'monospace', maxWidth: 400, wordBreak: 'break-all', textAlign: 'center' }}>{gameUrl}</div>
          </div>
        </div>
        <div style={{ background: C.dark, padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: 'transparent', color: C.white, fontSize: FS.md, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Tutup Preview</button>
        </div>
      </div>
    </div>
  );
};

/* ── KontenReviewInline — tampilkan isi konten seperti di KelolaBelajar ── */
const KontenReviewInline = ({ k, riwayat }) => {
  const isBacaan = k.type === 'bacaan';
  const [activeLevel, setActiveLevel] = useState(k.levels?.[0] || '');
  const [gamePreview, setGamePreview] = useState(null);

  return (
    <div style={{ background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}`, marginBottom: 10, overflow: 'hidden' }}>
      {/* Header konten */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: `${C.teal}06`, borderBottom: `1px solid ${C.tealXL}` }}>
        <span style={{ fontSize: 16 }}>{KONTEN_ICON[k.type]}</span>
        <span style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>{k.label}</span>
        {k.type === 'game' && k.siswaSelesai?.length > 0 && (
          <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, background: '#F0F7FF', color: '#2B6CB0', fontWeight: 700, border: '1px solid #BEE3F8', marginLeft: 'auto' }}>
            🎮 {k.siswaSelesai.length} selesai
          </span>
        )}
      </div>

      <div style={{ padding: '12px 13px' }}>

        {/* Label judul */}
        {isBacaan
          ? <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>Teks Konten Bacaan</div>
          : k.levels?.length > 0 && <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>Teks Placeholder — Level {activeLevel}</div>
        }

        {/* Level tabs — hanya untuk konten NON-bacaan */}
        {!isBacaan && k.levels?.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {k.levels.map(lv => (
              <button key={lv} onClick={() => setActiveLevel(lv)}
                style={{ padding: '4px 12px', borderRadius: 99, fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: activeLevel === lv ? C.teal : LEVEL_BG[lv], color: activeLevel === lv ? C.white : LEVEL_COLOR[lv], border: `1.5px solid ${activeLevel === lv ? C.teal : LEVEL_BORDER[lv]}` }}>
                {lv}
              </button>
            ))}
          </div>
        )}

        {/* Isi konten */}
        <div style={{ background: '#FAFEFF', borderRadius: 8, padding: '10px 12px', border: `1px solid ${C.tealXL}`, marginBottom: 8 }}>
          <pre style={{ fontFamily: 'inherit', fontSize: FS.sm, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
            {getPlaceholderText(k.type, isBacaan ? '' : activeLevel, riwayat)}
          </pre>
        </div>

        {/* Aksi game */}
        {k.type === 'game' && (
          <button onClick={() => setGamePreview(activeLevel)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔍 Preview Game Level {activeLevel}
          </button>
        )}
      </div>

      {gamePreview && <GamePreviewRiwayat riwayat={riwayat} level={gamePreview} onClose={() => setGamePreview(null)} />}
    </div>
  );
};

/* ── Dummy riwayat konten published ─────────────────────────────── */
const RIWAYAT_KONTEN = [
  {
    id: 'rk1',
    jenjang: 'X', kelas: 'X-1', kelasId: 'x1',
    mapelId: 'mat', mapelLabel: 'Matematika', mapelIcon: '📐', mapelColor: '#319795',
    elemenLabel: 'Bilangan dan Aljabar',
    materi: 'Persamaan Linear',
    publishedAt: 'Senin, 14 Apr 2026 · 09:32',
    konten: [
      { type: 'bacaan', label: 'Konten Bacaan', levels: [] },
      { type: 'quiz_pg', label: 'Kuiz Pilihan Ganda', levels: ['Low', 'Mid', 'High'] },
      { type: 'quiz_essay', label: 'Kuiz Essay', levels: ['Low', 'Mid', 'High'] },
      { type: 'flashcard', label: 'Flashcard', levels: ['Low', 'Mid', 'High'] },
      { type: 'mindmap', label: 'Mindmap', levels: [] },
      {
        type: 'game', label: 'Game', levels: ['Low', 'Mid', 'High'],
        siswaSelesai: [
          { siswaId: 's2', level: 'High', selesaiAt: '09:45' },
          { siswaId: 's4', level: 'Mid', selesaiAt: '10:12' },
          { siswaId: 's5', level: 'Low', selesaiAt: '10:30' },
          { siswaId: 's9', level: 'Mid', selesaiAt: '11:05' },
        ],
      },
    ],
  },
  {
    id: 'rk2',
    jenjang: 'X', kelas: 'X-2', kelasId: 'x2',
    mapelId: 'mat', mapelLabel: 'Matematika', mapelIcon: '📐', mapelColor: '#319795',
    elemenLabel: 'Data dan Statistika',
    materi: 'Statistika Dasar',
    publishedAt: 'Rabu, 9 Apr 2026 · 14:15',
    konten: [
      { type: 'bacaan', label: 'Konten Bacaan', levels: ['Low', 'Mid', 'High'] },
      { type: 'quiz_pg', label: 'Kuiz Pilihan Ganda', levels: ['Low', 'Mid', 'High'] },
      { type: 'flashcard', label: 'Flashcard', levels: ['Low', 'Mid', 'High'] },
      { type: 'mindmap', label: 'Mindmap', levels: [] },
      {
        type: 'game', label: 'Game', levels: ['Low', 'Mid', 'High'],
        siswaSelesai: [
          { siswaId: 's10', level: 'Mid', selesaiAt: '14:45' },
          { siswaId: 's12', level: 'Low', selesaiAt: '15:20' },
        ],
      },
    ],
  },
  {
    id: 'rk3',
    jenjang: 'X', kelas: 'X-3', kelasId: 'x3',
    mapelId: 'mat', mapelLabel: 'Matematika', mapelIcon: '📐', mapelColor: '#319795',
    elemenLabel: 'Geometri dan Pengukuran',
    materi: 'Fungsi Kuadrat',
    publishedAt: 'Jumat, 4 Apr 2026 · 11:00',
    konten: [
      { type: 'bacaan', label: 'Konten Bacaan', levels: ['Low', 'Mid', 'High'] },
      { type: 'quiz_pg', label: 'Kuiz Pilihan Ganda', levels: ['Low', 'Mid', 'High'] },
      { type: 'quiz_essay', label: 'Kuiz Essay', levels: ['Low', 'Mid', 'High'] },
      { type: 'flashcard', label: 'Flashcard', levels: ['Low', 'Mid', 'High'] },
      { type: 'mindmap', label: 'Mindmap', levels: [] },
      {
        type: 'game', label: 'Game', levels: ['Low', 'Mid', 'High'],
        siswaSelesai: [
          { siswaId: 's15', level: 'High', selesaiAt: '11:30' },
          { siswaId: 's16', level: 'High', selesaiAt: '11:45' },
          { siswaId: 's18', level: 'Mid', selesaiAt: '12:10' },
          { siswaId: 's21', level: 'Low', selesaiAt: '12:25' },
          { siswaId: 's19', level: 'Mid', selesaiAt: '13:00' },
        ],
      },
    ],
  },
];

const KONTEN_ICON = {
  bacaan: '📖', quiz_pg: '✅', quiz_essay: '📝',
  flashcard: '🃏', mindmap: '🧠', game: '🎮',
};

const LEVEL_COLOR = { Low: '#276749', Mid: '#B7791F', High: '#9B2C2C' };
const LEVEL_BG = { Low: '#F0FFF4', Mid: '#FFFBF0', High: '#FFF5F5' };
const LEVEL_BORDER = { Low: '#9AE6B4', Mid: '#F6AD55', High: '#FEB2B2' };

/* ── GameDetailModal ─────────────────────────────────────────────── */
const GameDetailModal = ({ riwayat, onClose }) => {
  const gameKonten = riwayat.konten.find(k => k.type === 'game');
  if (!gameKonten) return null;
  const siswaMap = Object.fromEntries(ADMIN_SISWA_INIT.map(s => [s.id, s]));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="bounce-in" style={{ background: C.white, borderRadius: 16, width: 480, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark }}>🎮 Detail Game</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{riwayat.mapelLabel} · {riwayat.elemenLabel} · {riwayat.materi}</div>
          </div>
          <button onClick={onClose} style={{ background: C.white, border: '2px solid #EDF2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(85vh - 70px)' }}>
          {/* Siswa yang selesai */}
          <div>
            <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, marginBottom: 8 }}>
              Siswa yang Menyelesaikan ({gameKonten.siswaSelesai?.length || 0} siswa)
            </div>
            {!gameKonten.siswaSelesai?.length ? (
              <div style={{ fontSize: FS.md, color: C.slate, textAlign: 'center', padding: '20px 0' }}>Belum ada siswa yang menyelesaikan game</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gameKonten.siswaSelesai.map((ss, i) => {
                  const siswa = siswaMap[ss.siswaId];
                  if (!siswa) return null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${LEVEL_BORDER[ss.level]}`, background: LEVEL_BG[ss.level] }}>
                      <Avatar initials={siswa.avatar} bg={siswa.avatarBg} size={32} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>{siswa.nama}</div>
                        <div style={{ fontSize: FS.xs, color: C.slate }}>Selesai pukul {ss.selesaiAt}</div>
                      </div>
                      <span style={{ fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: C.white, color: LEVEL_COLOR[ss.level], border: `1px solid ${LEVEL_BORDER[ss.level]}` }}>
                        Level {ss.level}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── RiwayatCard ─────────────────────────────────────────────────── */
const RiwayatCard = ({ riwayat }) => {
  const [expanded, setExpanded] = useState(false);
  const [gameModal, setGameModal] = useState(false);
  const gameKonten = riwayat.konten.find(k => k.type === 'game');
  const totalSelesai = gameKonten?.siswaSelesai?.length || 0;
  const hasCP = !!CAPAIAN_PEMBELAJARAN[riwayat.mapelId];

  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: riwayat.mapelColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, flexShrink: 0 }}>
          {riwayat.mapelIcon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>{riwayat.mapelLabel} — {riwayat.elemenLabel}</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {riwayat.materi && <><strong>{riwayat.materi}</strong> · </>}
            {riwayat.jenjang} · {riwayat.kelas}
          </div>
          <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3 }}>📅 {riwayat.publishedAt}</div>
        </div>
        {/* Badges row */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {totalSelesai > 0 && (
            <span style={{ fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, background: '#F0F7FF', color: '#2B6CB0', fontWeight: 700, border: '1px solid #BEE3F8', whiteSpace: 'nowrap' }}>
              🎮 {totalSelesai} selesai
            </span>
          )}
        </div>
      </div>

      {/* Konten chips */}
      <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {riwayat.konten.map(k => (
          <span key={k.type} style={{ fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, background: `${C.teal}10`, color: C.teal, fontWeight: 600, border: `1px solid ${C.tealXL}` }}>
            {KONTEN_ICON[k.type]} {k.label}
            {k.levels?.length > 0 && <span style={{ marginLeft: 4, opacity: .7 }}>{k.levels.join('/')}</span>}
          </span>
        ))}
      </div>

      {/* Aksi */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid rgba(13,92,99,.07)`, display: 'flex', gap: 8 }}>
        <button onClick={() => setExpanded(v => !v)}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {expanded ? '▲ Sembunyikan' : '▼ Lihat Konten'}
        </button>
        {gameKonten && (
          <button onClick={() => setGameModal(true)}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #BEE3F8', background: '#F0F7FF', fontSize: FS.md, color: '#2B6CB0', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            🎮 Detail Game
          </button>
        )}
      </div>

      {/* Konten expanded — isi lengkap per konten dengan level tabs */}
      {expanded && (() => {
        const mapelEntry = ADMIN_MAPEL_LIST.find(m => m.id === riwayat.mapelId);
        const cp = CAPAIAN_PEMBELAJARAN[riwayat.mapelId];
        return (
          <div style={{ padding: '14px 16px 16px', borderTop: `1px solid rgba(13,92,99,.07)`, background: '#FAFEFF' }}>

            <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, marginBottom: 12 }}>Isi Konten Terpublish</div>
            {riwayat.konten.map(k => (
              <KontenReviewInline key={k.type} k={k} riwayat={riwayat} />
            ))}
          </div>
        );
      })()}

      {gameModal && <GameDetailModal riwayat={riwayat} onClose={() => setGameModal(false)} />}
    </Card>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
const RiwayatKontenSection = () => {
  const [filterKelas, setFilterKelas] = useState('semua');
  const [search, setSearch] = useState('');

  const filtered = RIWAYAT_KONTEN.filter(r => {
    const matchKelas = filterKelas === 'semua' || r.kelasId === filterKelas;
    const matchSearch = !search
      || r.mapelLabel.toLowerCase().includes(search.toLowerCase())
      || r.elemenLabel.toLowerCase().includes(search.toLowerCase())
      || (r.materi || '').toLowerCase().includes(search.toLowerCase());
    return matchKelas && matchSearch;
  });

  const totalGame = RIWAYAT_KONTEN.reduce((acc, r) => {
    const g = r.konten.find(k => k.type === 'game');
    return acc + (g?.siswaSelesai?.length || 0);
  }, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', background: C.white, borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark }}>📚 Riwayat Konten</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
            {RIWAYAT_KONTEN.length} konten dipublish
          </div>
        </div>

        {/* Filter kelas */}
        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Kelas</option>
          {ADMIN_KELAS_INIT.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari mapel / elemen / materi..."
            style={{ padding: '7px 10px 7px 30px', borderRadius: 99, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, width: 230, fontFamily: 'inherit', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: FS.md, color: C.slate }}>🔍</span>
        </div>
      </div>

      {/* Daftar riwayat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 36, opacity: .3, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: FS.lg, fontWeight: 600, color: C.darkL }}>
              {RIWAYAT_KONTEN.length === 0 ? 'Belum ada konten dipublish' : 'Tidak ada hasil ditemukan'}
            </div>
            <div style={{ fontSize: FS.md, color: C.slate, marginTop: 4 }}>
              {RIWAYAT_KONTEN.length === 0 ? 'Buat konten baru di menu Kelola Konten Belajar' : 'Coba ubah filter atau kata kunci'}
            </div>
          </div>
        ) : (
          filtered.map(r => <RiwayatCard key={r.id} riwayat={r} />)
        )}
      </div>
    </div>
  );
};

export default RiwayatKontenSection;