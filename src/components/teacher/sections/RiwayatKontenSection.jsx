/**
 * SR MVP — RiwayatKontenSection (Portal Guru) — REVISI FASE 3
 *
 * Load riwayat publish dari GET /content/riwayat (api/content.js → getRiwayatGuru).
 * Shape respons: RiwayatKontenItem[] — identik dengan PublishPayload + display fields.
 *
 * Poin-poin yang diperbaiki:
 *  1. Tidak ada lagi dummy hardcoded RIWAYAT_KONTEN — semua dari API / mock store
 *  2. Field names konsisten: tipe (bukan type), konten_list (bukan konten), atp string
 *  3. Renderer konten structured (quiz_pg/essay/flashcard) — tidak lagi <pre> object mentah
 *  4. ATP ditampilkan sebagai baris bernomor (split '\n'), bukan template literal {materi}
 *  5. publishedAt di-format dari ISO8601, bukan hardcoded string Indonesia
 *  6. game diperlakukan sebagai tipe dalam konten_list (dari /game/generate),
 *     bukan entity terpisah — siswa_selesai embedded di konten_list[tipe=game].content
 */
import { useState, useEffect } from 'react';
import { Card, Avatar } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { getRiwayatGuru } from '../../../api/content';
import { MarkdownLatex, InlineLatex } from '../../shared/LatexRenderer';
import { useAuth } from '../../../context/AuthContext';
import {
  ADMIN_MAPEL_LIST,
  ADMIN_KELAS_INIT,
  ADMIN_SISWA_INIT,
} from '../../../data/masterData';

/* ── Helpers ─────────────────────────────────────────────────────── */
// Format ISO8601 → "Senin, 14 Apr 2026 · 09:32"
const fmtPublishedAt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).replace(',', ',').replace(/\./g, ':').replace(' pukul ', ' · ');
  } catch { return iso; }
};

// ATP string (multiline) → array baris non-kosong
const atpLines = (atp) => (atp || '').split('\n').map(s => s.trim()).filter(Boolean);

/* ── Konstanta ───────────────────────────────────────────────────── */
const KONTEN_ICON = {
  bacaan: '📖', quiz_pg: '✅', quiz_essay: '📝',
  flashcard: '🃏', mindmap: '🧠', game: '🎮',
};
const KONTEN_LABEL = {
  bacaan: 'Konten Bacaan', quiz_pg: 'Kuiz Pilihan Ganda', quiz_essay: 'Kuiz Essay',
  flashcard: 'Flashcard', mindmap: 'Mindmap', game: 'Game',
};

const LEVEL_COLOR = { Low: '#276749', Mid: '#B7791F', High: '#9B2C2C' };
const LEVEL_BG = { Low: '#F0FFF4', Mid: '#FFFBF0', High: '#FFF5F5' };
const LEVEL_BORDER = { Low: '#9AE6B4', Mid: '#F6AD55', High: '#FEB2B2' };

/* ── GamePreviewModal (sama dengan KelolaBelajarSection) ─────────── */
const GamePreviewModal = ({ konten, riwayat, onClose }) => {
  const GAME_BASE = 'https://game.sekolahrakyat.id/play';
  const fallback = new URLSearchParams({
    mapel_id: riwayat.mapel_id,
    elemen_id: riwayat.elemen_id,
    elemen: riwayat.elemen_label,
    materi: riwayat.materi || '',
    level: konten.level || 'Low',
    mode: 'preview',
  }).toString();
  const gameUrl = konten.html_url || `${GAME_BASE}?${fallback}`;
  const isReady = !!konten.html_url;
  const isGenerating = !konten.html_url && konten.status === 'generating';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.75)', zIndex: 1300, display: 'flex', flexDirection: 'column', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: '24px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.teal, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>Preview Game — Level {konten.level}</div>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: FS.sm, marginTop: 1 }}>
              {riwayat.mapel_label} · {riwayat.elemen_label}
              <span style={{ marginLeft: 8, background: 'rgba(255,255,255,.15)', padding: '1px 8px', borderRadius: 99, fontSize: 10 }}>Mode Preview</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 30, height: 30, color: C.white, cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>
        <div style={{ flex: 1, background: '#0f172a', position: 'relative' }}>
          {isGenerating && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,.1)', borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: FS.lg, fontWeight: 600 }}>Sedang generate game…</div>
            </div>
          )}
          {isReady && <iframe src={gameUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={`Preview Game ${riwayat.elemen_label} Level ${konten.level}`} sandbox="allow-scripts allow-same-origin allow-forms" allow="fullscreen" />}
          {!isReady && !isGenerating && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 56, opacity: .3 }}>🎮</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: FS.lg, fontWeight: 600 }}>Game HTML Tim 4</div>
              <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 16px', fontSize: FS.xs, color: 'rgba(255,255,255,.35)', fontFamily: 'monospace', maxWidth: 420, wordBreak: 'break-all', textAlign: 'center' }}>{gameUrl}</div>
            </div>
          )}
        </div>
        <div style={{ background: C.dark, padding: '10px 18px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: 'transparent', color: C.white, fontSize: FS.md, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Tutup Preview</button>
        </div>
      </div>
    </div>
  );
};

/* ── KontenItemRenderer — render isi konten sesuai tipe ──────────── */
// Input: item KontenItem { tipe, level, content, approved }
// content shape sesuai API contract (sudah di-wrap oleh buildKontenList):
//   bacaan    → { text: string, source: string }
//   mindmap   → { nodes: [...] } atau { text: string } (fallback ke text jika nodes kosong)
//   quiz_pg   → { soal: [{ id, soal, pilihan, jawaban }] }
//   quiz_essay→ { pertanyaan: [string | { id, soal, rubrik }] }
//   flashcard → { cards: [{ depan, belakang }], source: string }
//   game      → { game_id, html_url, status, ... }
const KontenItemRenderer = ({ item }) => {
  const { tipe, content } = item;

  if (tipe === 'bacaan') {
    const text = typeof content === 'string' ? content : content?.text;
    const source = typeof content === 'object' ? (content?.source || null) : null;
    return text ? (
      <div>
        <MarkdownLatex text={text} style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.8 }} />
        {source && (
          <div style={{ marginTop: 8, textAlign: 'right', fontSize: 11, color: '#a0aec0' }}>
            📚 Sumber: {source}
          </div>
        )}
      </div>
    ) : <span style={{ color: C.slate, fontSize: FS.sm }}>(konten kosong)</span>;
}

  if (tipe === 'mindmap') {
    // content.nodes = array, atau fallback ke content.text jika nodes kosong
    const nodes = content?.nodes;
    if (Array.isArray(nodes) && nodes.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nodes.map((n, i) => (
            <div key={n.id || i} style={{ paddingLeft: n.parent_id ? 20 : 0, fontSize: FS.sm, color: n.parent_id ? C.darkL : C.dark, fontWeight: n.parent_id ? 400 : 700 }}>
              {n.parent_id ? '• ' : '⬡ '}{n.label}
            </div>
          ))}
        </div>
      );
    }
    const text = typeof content === 'string' ? content : content?.text;
    return text
      ? <MarkdownLatex text={text} style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.8 }} />
      : <span style={{ color: C.slate, fontSize: FS.sm }}>(konten kosong)</span>;
  }

  if (tipe === 'quiz_pg') {
    if (!content?.soal?.length) return <span style={{ color: C.slate, fontSize: FS.sm }}>Soal belum tersedia.</span>;
    return (
      <div>
        {content.soal.map((s, i) => {
          // API contract: s.soal = teks pertanyaan; placeholder: s.pertanyaan
          const soalText = s.soal || s.pertanyaan || '';
          // API contract: s.jawaban = index integer; placeholder: s.jawaban = string pilihan
          const jawabanIdx = typeof s.jawaban === 'number' ? s.jawaban : -1;
          return (
            <div key={s.id || i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: C.dark, fontSize: FS.sm, marginBottom: 5 }}>
                {i + 1}. <InlineLatex text={soalText} />
              </div>
              {(s.pilihan || []).map((p, j) => {
                const isJawaban = jawabanIdx >= 0 ? j === jawabanIdx : p === s.jawaban;
                return (
                  <div key={j} style={{ paddingLeft: 12, marginBottom: 2 }}>
                    <span style={{ fontSize: FS.sm, color: isJawaban ? C.green : C.darkL, fontWeight: isJawaban ? 700 : 400 }}>
                      {String.fromCharCode(97 + j)}) <InlineLatex text={p} />{isJawaban ? ' ✓' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  if (tipe === 'quiz_essay') {
    if (!content?.pertanyaan?.length) return <span style={{ color: C.slate, fontSize: FS.sm }}>Pertanyaan belum tersedia.</span>;
    return (
      <div>
        {content.pertanyaan.map((p, i) => {
          // pertanyaan item bisa berupa string (placeholder) atau objek { id, soal, rubrik }
          const soalText = typeof p === 'string' ? p : (p?.soal || '');
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.7 }}>
                {i + 1}. <InlineLatex text={soalText} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (tipe === 'flashcard') {
    if (!content?.cards?.length) return <span style={{ color: C.slate, fontSize: FS.sm }}>Kartu belum tersedia.</span>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {content.cards.map((c, i) => (
          <div key={i} style={{ border: `1px solid ${C.tealXL}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: `${C.teal}18`, padding: '5px 10px', fontSize: FS.xs, fontWeight: 700, color: C.teal, borderBottom: `1px solid ${C.tealXL}` }}>[Depan]</div>
            <div style={{ padding: '7px 10px', fontSize: FS.sm, color: C.dark }}>
              <InlineLatex text={c.depan} />
            </div>
            <div style={{ background: '#F0FFF4', padding: '5px 10px', fontSize: FS.xs, fontWeight: 700, color: C.green, borderTop: `1px solid ${C.tealXL}`, borderBottom: `1px solid ${C.tealXL}` }}>[Belakang]</div>
            <div style={{ padding: '7px 10px', fontSize: FS.sm, color: C.darkL }}>
              <InlineLatex text={c.belakang} />
            </div>
          </div>
        ))}
        {/* CONTRACT V3.6: source flashcard adalah string */}
        {content?.source && (
          <div style={{ marginTop: 4, textAlign: 'right', fontSize: 11, color: '#a0aec0' }}>
            📚 Sumber: {content.source}
          </div>
        )}
      </div>
    );
  }

  // game — tampilkan nama/deskripsi dari konten game
  return (
    <pre style={{ fontFamily: 'inherit', fontSize: FS.sm, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
      {content?.nama || content?.deskripsi || '(game sedang disiapkan)'}
    </pre>
  );
};

/* ── KontenGroupReview — satu tipe konten dengan level tabs ──────── */
// Mengambil semua KontenItem satu tipe dari konten_list dan render dengan tab level.
const KontenGroupReview = ({ tipe, items, riwayat }) => {
  const levelsAvail = items.map(it => it.level).filter(Boolean);
  const [activeLevel, setActiveLevel] = useState(levelsAvail[0] || '');
  const [gamePreview, setGamePreview] = useState(null);

  const activeItem = levelsAvail.length > 0
    ? items.find(it => it.level === activeLevel)
    : items[0];

  // html_url dan siswa_selesai sudah embedded di konten_list dari /content/riwayat
  // Tidak perlu augment dari /game/list lagi
  const displayItem = activeItem;

  return (
    <div style={{ background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}`, marginBottom: 10, overflow: 'hidden' }}>
      {/* Header tipe */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: `${C.teal}06`, borderBottom: `1px solid ${C.tealXL}` }}>
        <span style={{ fontSize: 15 }}>{KONTEN_ICON[tipe]}</span>
        <span style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>{KONTEN_LABEL[tipe] || tipe}</span>
      </div>

      <div style={{ padding: '10px 13px' }}>
        {/* Level tabs */}
        {levelsAvail.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {levelsAvail.map(lv => (
              <button key={lv} onClick={() => setActiveLevel(lv)}
                style={{ padding: '4px 12px', borderRadius: 99, fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: activeLevel === lv ? C.teal : LEVEL_BG[lv], color: activeLevel === lv ? C.white : LEVEL_COLOR[lv], border: `1.5px solid ${activeLevel === lv ? C.teal : LEVEL_BORDER[lv]}` }}>
                {lv}
              </button>
            ))}
          </div>
        )}

        {/* Isi konten */}
        <div style={{ background: '#FAFEFF', borderRadius: 8, padding: '10px 12px', border: `1px solid ${C.tealXL}`, marginBottom: tipe === 'game' ? 8 : 0 }}>
          {displayItem
            ? <KontenItemRenderer item={displayItem} />
            : <span style={{ color: C.slate, fontSize: FS.sm }}>Konten tidak tersedia.</span>
          }
        </div>

        {/* Preview game button */}
        {tipe === 'game' && (
          <button onClick={() => setGamePreview(displayItem || {})}
            style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔍 Preview Game Level {activeLevel}
          </button>
        )}
      </div>

      {gamePreview && <GamePreviewModal konten={gamePreview} riwayat={riwayat} onClose={() => setGamePreview(null)} />}
    </div>
  );
};

/* ── GameDetailModal — progress per siswa dengan badge Low/Mid/High ─ */
const LEVEL_BADGE = {
  Low: { active: { bg: '#EBF8FF', color: '#2B6CB0', border: '#90CDF4' }, label: 'Low' },
  Mid: { active: { bg: '#FEFCBF', color: '#B7791F', border: '#F6E05E' }, label: 'Mid' },
  High: { active: { bg: '#FFF5F5', color: '#C53030', border: '#FEB2B2' }, label: 'High' },
};
const LEVELS_ORDER = ['Low', 'Mid', 'High'];

// ── SiswaRow — satu baris siswa dengan badge level ──
const SiswaRow = ({ siswa, selesaiPerLevel }) => {
  const playedAny = LEVELS_ORDER.some(lv => selesaiPerLevel[lv][siswa.id] != null);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 10,
      background: playedAny ? `${C.teal}04` : '#FAFAFA',
      border: `1px solid ${playedAny ? `${C.teal}18` : '#EDF2F7'}`,
    }}>
      <Avatar initials={siswa.avatar} bg={siswa.avatarBg} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {siswa.nama}
        </div>
        {/* NIS — info tambahan agar guru bisa identifikasi siswa */}
        <div style={{ fontSize: 10, color: C.slate }}>
          NIS {siswa.nis}
          {playedAny && (() => {
            const lastLv = [...LEVELS_ORDER].reverse().find(lv => selesaiPerLevel[lv][siswa.id] != null);
            return ` · Terakhir: Level ${lastLv} · ${selesaiPerLevel[lastLv][siswa.id]}`;
          })()}
        </div>
      </div>

      {/* 3 badge Low/Mid/High */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {LEVELS_ORDER.map(lv => {
          const done = selesaiPerLevel[lv][siswa.id] != null;
          const badge = LEVEL_BADGE[lv];
          return (
            <span key={lv} title={done ? `Selesai: ${selesaiPerLevel[lv][siswa.id]}` : `Belum memainkan level ${lv}`}
              style={{
                fontSize: 10, fontWeight: 700,
                padding: '3px 8px', borderRadius: 99,
                background: done ? badge.active.bg : '#F7FAFC',
                color: done ? badge.active.color : '#A0AEC0',
                border: `1px solid ${done ? badge.active.border : '#E2E8F0'}`,
                transition: 'all .15s',
              }}>
              {lv}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const GameDetailModal = ({ riwayat, gameItems, onClose }) => {
  const isSemuaKelas = !riwayat.kelas_id || riwayat.kelas_id === '__semua__';

  // Kumpulkan kelas yang relevan
  // Jika "semua kelas": ambil kelas sesuai jenjang guru
  // Jika spesifik: hanya 1 kelas
  const relevantKelas = isSemuaKelas
    ? ADMIN_KELAS_INIT.filter(k => k.tingkat === (riwayat.jenjang || 'X'))
    : ADMIN_KELAS_INIT.filter(k => k.id === riwayat.kelas_id);

  // Tab kelas — hanya muncul jika publish ke semua kelas
  const [activeKelasId, setActiveKelasId] = useState(
    isSemuaKelas ? 'semua' : (relevantKelas[0]?.id || null)
  );

  // Build set selesaiPerLevel dari gameItems (embedded di konten_list)
  const selesaiPerLevel = {};
  LEVELS_ORDER.forEach(lv => { selesaiPerLevel[lv] = {}; });
  (gameItems || []).forEach(it => {
    const lv = it.level;
    if (!lv || !selesaiPerLevel[lv]) return;
    (it.content?.siswa_selesai || []).forEach(ss => {
      selesaiPerLevel[lv][ss.siswa_id] = ss.selesai_at || '';
    });
  });

  // Siswa yang ditampilkan sesuai tab aktif
  const displayKelas = isSemuaKelas && activeKelasId === 'semua'
    ? relevantKelas    // akan di-render per grup di bawah
    : relevantKelas.filter(k => k.id === activeKelasId);

  // Hitung total unik per kelas atau keseluruhan
  const allSiswaIds = relevantKelas.flatMap(k =>
    ADMIN_SISWA_INIT.filter(s => (k.siswa_ids || k.siswaIds || []).includes(s.id))
  );
  const uniqueAllIds = [...new Set(allSiswaIds.map(s => s.id))];
  const totalUnik = uniqueAllIds.filter(id =>
    LEVELS_ORDER.some(lv => selesaiPerLevel[lv][id] != null)
  ).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 16, width: 'min(560px, calc(100vw - 24px))', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark }}>🎮 Progress Game</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
              {riwayat.mapel_label} · {riwayat.elemen_label}{riwayat.materi ? ` · ${riwayat.materi}` : ''}
            </div>
            {/* Label publish target */}
            <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5, background: isSemuaKelas ? '#EBF8FF' : `${C.teal}10`, borderRadius: 99, padding: '2px 10px', border: `1px solid ${isSemuaKelas ? '#90CDF4' : C.tealXL}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: isSemuaKelas ? '#2B6CB0' : C.teal }}>
                {isSemuaKelas
                  ? `🌐 Dipublish ke Semua Kelas (${relevantKelas.length} kelas)`
                  : `📋 ${riwayat.kelas_nama || relevantKelas[0]?.nama || riwayat.kelas_id}`
                }
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.white, border: '2px solid #EDF2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
        </div>

        {/* Ringkasan & legenda */}
        <div style={{ padding: '10px 20px', borderBottom: `1px solid rgba(13,92,99,.06)`, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: FS.xs, color: C.slate }}>
            {totalUnik} / {uniqueAllIds.length} siswa sudah memainkan
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {LEVELS_ORDER.map(lv => (
              <div key={lv} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: LEVEL_BADGE[lv].active.bg, border: `1.5px solid ${LEVEL_BADGE[lv].active.border}` }} />
                <span style={{ fontSize: 10, color: C.slate }}>{lv}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#F7FAFC', border: '1.5px solid #E2E8F0' }} />
              <span style={{ fontSize: 10, color: C.slate }}>Belum</span>
            </div>
          </div>
        </div>

        {/* ── Tab kelas — hanya muncul jika publish ke semua kelas ── */}
        {isSemuaKelas && (
          <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, borderBottom: `1px solid rgba(13,92,99,.06)`, paddingBottom: 10 }}>
            <button
              onClick={() => setActiveKelasId('semua')}
              style={{
                padding: '4px 12px', borderRadius: 99, fontSize: FS.sm, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                background: activeKelasId === 'semua' ? C.teal : C.white,
                color: activeKelasId === 'semua' ? C.white : C.slate,
                borderColor: activeKelasId === 'semua' ? C.teal : C.tealXL,
              }}>
              Semua Kelas
            </button>
            {relevantKelas.map(k => {
              const siswaKelas = ADMIN_SISWA_INIT.filter(s => (k.siswa_ids || k.siswaIds || []).includes(s.id));
              const selesaiKelas = siswaKelas.filter(s =>
                LEVELS_ORDER.some(lv => selesaiPerLevel[lv][s.id] != null)
              ).length;
              return (
                <button key={k.id} onClick={() => setActiveKelasId(k.id)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: FS.sm, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                    background: activeKelasId === k.id ? C.teal : C.white,
                    color: activeKelasId === k.id ? C.white : C.dark,
                    borderColor: activeKelasId === k.id ? C.teal : C.tealXL,
                  }}>
                  {k.nama}
                  <span style={{ marginLeft: 5, opacity: .7, fontSize: 10 }}>
                    {selesaiKelas}/{siswaKelas.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Daftar siswa ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isSemuaKelas && activeKelasId === 'semua' ? (
            // Tampilkan semua kelas dalam grup terpisah agar guru tahu kelas masing-masing
            relevantKelas.map(kelas => {
              const siswaKelas = ADMIN_SISWA_INIT.filter(s => (kelas.siswa_ids || kelas.siswaIds || []).includes(s.id));
              if (siswaKelas.length === 0) return null;
              const selesaiCount = siswaKelas.filter(s =>
                LEVELS_ORDER.some(lv => selesaiPerLevel[lv][s.id] != null)
              ).length;
              return (
                <div key={kelas.id} style={{ marginBottom: 8 }}>
                  {/* Header grup kelas */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 8, marginBottom: 6,
                    background: `${C.teal}08`, border: `1px solid ${C.tealXL}`,
                  }}>
                    <span style={{ fontSize: 13 }}>🏫</span>
                    <span style={{ fontSize: FS.md, fontWeight: 800, color: C.teal }}>
                      Kelas {kelas.nama}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: FS.xs, color: C.slate, fontWeight: 600 }}>
                      {selesaiCount}/{siswaKelas.length} siswa
                    </span>
                    {/* Progress bar mini */}
                    <div style={{ width: 60, height: 5, borderRadius: 99, background: C.tealXL, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${siswaKelas.length > 0 ? (selesaiCount / siswaKelas.length) * 100 : 0}%`, background: C.teal, borderRadius: 99, transition: 'width .3s' }} />
                    </div>
                  </div>
                  {/* Siswa dalam kelas ini */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {siswaKelas.map(siswa => (
                      <SiswaRow key={siswa.id} siswa={siswa} selesaiPerLevel={selesaiPerLevel} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Tampilkan siswa dari 1 kelas (tab terpilih atau publish spesifik)
            (() => {
              const kelasTerpilih = relevantKelas.find(k => k.id === activeKelasId) || relevantKelas[0];
              const siswaKelas = kelasTerpilih
                ? ADMIN_SISWA_INIT.filter(s => (kelasTerpilih.siswa_ids || kelasTerpilih.siswaIds || []).includes(s.id))
                : ADMIN_SISWA_INIT.filter(s => s.kelas_id === riwayat.kelas_id); // FIX B4: snake_case
              const fallback = siswaKelas.length > 0 ? siswaKelas : ADMIN_SISWA_INIT;
              return fallback.map(siswa => (
                <SiswaRow key={siswa.id} siswa={siswa} selesaiPerLevel={selesaiPerLevel} />
              ));
            })()
          )}
        </div>
      </div>
    </div>
  );
};

/* ── RiwayatCard ─────────────────────────────────────────────────── */
// riwayat: RiwayatKontenItem (dari GET /content/riwayat)
// siswa_selesai sudah embedded di konten_list[tipe=game].content.siswa_selesai
const RiwayatCard = ({ riwayat }) => {
  const [expanded, setExpanded] = useState(false);
  const [gameModal, setGameModal] = useState(false);

  const kontenList = riwayat.konten_list || [];

  // Kelompokkan konten_list per tipe
  const tipeGroups = {};
  kontenList.forEach(item => {
    if (!tipeGroups[item.tipe]) tipeGroups[item.tipe] = [];
    tipeGroups[item.tipe].push(item);
  });

  const siswaMap = Object.fromEntries(ADMIN_SISWA_INIT.map(s => [s.id, s]));
  const gameItems = tipeGroups['game'] || [];

  // Gabungkan siswa_selesai dari semua level game (sudah embedded di konten_list)
  const allSelesai = gameItems.flatMap(it => it.content?.siswa_selesai || []);
  const totalSelesai = allSelesai.length;

  // AvatarStack: maks 4 avatar + "+N lainnya"
  const MAX_AVATAR_STACK = 4;
  const stackSiswa = allSelesai.slice(0, MAX_AVATAR_STACK);
  const remainCount = totalSelesai - stackSiswa.length;
  const atpArr = atpLines(riwayat.atp);

  // Urutan tampil konten
  const DISPLAY_ORDER = ['bacaan', 'quiz_pg', 'quiz_essay', 'flashcard', 'mindmap', 'game'];

  return (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: (riwayat.mapel_color || '#319795') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, flexShrink: 0 }}>
          {riwayat.mapel_icon || '📚'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>
            {riwayat.mapel_label} — {riwayat.elemen_label}
          </div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
            {riwayat.materi && <><strong>{riwayat.materi}</strong> · </>}
            {riwayat.jenjang} · {riwayat.kelas_nama}
          </div>
          <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3 }}>
            📅 {fmtPublishedAt(riwayat.published_at)}
          </div>
        </div>
        {/* Revisi 5: Avatar stack siswa selesai — klik buka GameDetailModal */}
        {totalSelesai > 0 && (
          <button
            onClick={() => setGameModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 0, flexShrink: 0,
            }}
            title={`${totalSelesai} siswa memainkan game`}
          >
            {/* Stack avatar — overlap kanan ke kiri */}
            <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center' }}>
              {remainCount > 0 && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#EDF2F7', border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: C.slate,
                  marginLeft: -8, zIndex: 1,
                }}>+{remainCount}</div>
              )}
              {[...stackSiswa].reverse().map((ss, i) => {
                const s = siswaMap[ss.siswa_id || ss.siswaId];
                if (!s) return null;
                const colors = ['#319795', '#805AD5', '#D69E2E', '#C53030', '#2B6CB0'];
                const bg = colors[i % colors.length];
                return (
                  <div key={i} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: bg, border: '2px solid #fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: '#fff',
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: stackSiswa.length - i + 1,
                    flexShrink: 0,
                  }}>
                    {(s.nama || s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: FS.xs, color: C.teal, fontWeight: 700 }}>
              🎮 {totalSelesai} selesai
            </span>
          </button>
        )}
      </div>

      {/* Konten chips — dari konten_list */}
      <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DISPLAY_ORDER
          .filter(tipe => tipeGroups[tipe]?.length > 0)
          .map(tipe => {
            const items = tipeGroups[tipe];
            const levels = items.map(it => it.level).filter(Boolean);
            return (
              <span key={tipe} style={{ fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, background: `${C.teal}10`, color: C.teal, fontWeight: 600, border: `1px solid ${C.tealXL}` }}>
                {KONTEN_ICON[tipe]} {KONTEN_LABEL[tipe] || tipe}
                {levels.length > 0 && <span style={{ marginLeft: 4, opacity: .7 }}>{levels.join('/')}</span>}
              </span>
            );
          })
        }
      </div>

      {/* Aksi */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid rgba(13,92,99,.07)`, display: 'flex', gap: 8 }}>
        <button onClick={() => setExpanded(v => !v)}
          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {expanded ? '▲ Sembunyikan' : '▼ Lihat Konten'}
        </button>
        {gameItems.length > 0 && (
          <button onClick={() => setGameModal(true)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            🎮 Detail Game
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '14px 16px 16px', borderTop: `1px solid rgba(13,92,99,.07)`, background: '#FAFEFF' }}>

          {/* ATP — tampilkan baris bernomor dari string multiline */}
          {atpArr.length > 0 && (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${C.tealXL}`, background: C.white }}>
              <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>
                📋 Alur Tujuan Pembelajaran (ATP)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {atpArr.map((poin, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: `${C.teal}18`, color: C.teal, fontSize: FS.xs, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.6 }}>{poin}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, marginBottom: 12 }}>Isi Konten Terpublish</div>

          {/* Render semua tipe konten dari konten_list */}
          {DISPLAY_ORDER
            .filter(tipe => tipeGroups[tipe]?.length > 0)
            .map(tipe => (
              <KontenGroupReview
                key={tipe}
                tipe={tipe}
                items={tipeGroups[tipe]}
                riwayat={riwayat}
                gameAugment={null}
              />
            ))
          }
        </div>
      )}

      {gameModal && (
        <GameDetailModal
          riwayat={riwayat}
          gameItems={gameItems}
          onClose={() => setGameModal(false)}
        />
      )}
    </Card>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
const RiwayatKontenSection = ({ publishedList = [] }) => {
  // CONTRACT V3.6: guru_id dari authUser.id (JWT token) bukan masterData
  const { user: authUser } = useAuth();
  const guruId = authUser?.id || null;

  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterKelas, setFilterKelas] = useState('semua');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!guruId) return;
      try {
        // CONTRACT V3.6 §10 GET /guru/:id/konten
        const data = await getRiwayatGuru({ guru_id: guruId });
        if (Array.isArray(data)) setRiwayat(data);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    load();
  }, [guruId]);

  // Konversi publishedList (camelCase dari KelolaBelajar) → snake_case agar konsisten
  // dengan shape RiwayatKontenItem dari API
  const normalizedPublished = publishedList.map(p => ({
    publish_id: p.id,
    guru_id: p.guru_id || guruId,
    mapel_id: p.mapelId,
    mapel_label: p.mapelLabel,
    mapel_icon: p.mapelIcon,
    elemen_id: p.elemenId,
    elemen_label: p.elemenLabel,
    materi: p.materi || null,
    kelas_id: p.kelasId,
    kelas_nama: p.kelas,
    jenjang: p.jenjang,
    atp: Array.isArray(p.atp) ? p.atp.join('\n') : (p.atp || ''),
    published_at: new Date().toISOString(),
    konten_list: p.kontenList || [],   // lihat patch KelolaBelajar di bawah
  }));

  // Merge: publishedList session ini di depan, API di belakang (dedup by publish_id)
  const apiIds = new Set(riwayat.map(r => r.publish_id));
  const mergedRiwayat = [
    ...normalizedPublished.filter(p => !apiIds.has(p.publish_id)),
    ...riwayat,
  ];

  const filtered = mergedRiwayat.filter(r => {
    const matchKelas = filterKelas === 'semua' || r.kelas_id === filterKelas;
    const q = search.toLowerCase();
    const matchSearch = !search
      || (r.mapel_label || '').toLowerCase().includes(q)
      || (r.elemen_label || '').toLowerCase().includes(q)
      || (r.materi || '').toLowerCase().includes(q);
    return matchKelas && matchSearch;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', background: C.white, borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark }}>📚 Riwayat Konten</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
            {loading ? 'Memuat…' : `${mergedRiwayat.length} konten dipublish`}
          </div>
        </div>

        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Kelas</option>
          {ADMIN_KELAS_INIT.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>

        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari mapel / elemen / materi..."
            style={{ padding: '7px 10px 7px 30px', borderRadius: 99, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, width: 230, fontFamily: 'inherit', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.tealXL} />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: FS.md, color: C.slate }}>🔍</span>
        </div>
      </div>

      {/* Daftar */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .9s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: FS.lg, color: C.slate }}>Memuat riwayat konten…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 36, opacity: .3, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: FS.lg, fontWeight: 600, color: C.darkL }}>
              {mergedRiwayat.length === 0 ? 'Belum ada konten dipublish' : 'Tidak ada hasil ditemukan'}
            </div>
            <div style={{ fontSize: FS.md, color: C.slate, marginTop: 4 }}>
              {mergedRiwayat.length === 0 ? 'Buat konten baru di menu Kelola Konten Belajar' : 'Coba ubah filter atau kata kunci'}
            </div>
          </div>
        ) : (
          filtered.map(r => (
            <RiwayatCard key={r.publish_id} riwayat={r} />
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RiwayatKontenSection;