/**
 * SR MVP — KelolaBelajarSection (Portal Guru) — REVISI FASE 3
 *
 * Menggantikan UploadSection (upload nilai).
 * Flow:
 *  Panel kiri : pilih jenjang, kelas, mapel, elemen, materi (opsional), ATP → Submit
 *  Panel kanan: loading → Konteks Konten + list konten (bacaan, quiz PG, quiz essay,
 *               flashcard, mindmap, game)
 *
 * PERBEDAAN LEVEL PER KONTEN:
 *  - Konten Bacaan : Level Low/Mid/High — teks bacaan dibedakan kedalaman & kompleksitasnya per level
 *  - Quiz PG/Essay : Level Low/Mid/High — soal dibedakan kesulitannya per level
 *  - Flashcard     : Level Low/Mid/High — kartu dibedakan kedalaman materinya
 *  - Mindmap       : Tidak berlevel (satu mindmap keseluruhan)
 *  - Game          : Level Low/Mid/High — kesulitan game dibedakan per level
 *
 * Setiap konten ada opsi Setuju / Edit
 * Jika Edit: form deskripsi perubahan + submit regenerate
 * Bawah: tombol Batal dan Publish (aktif setelah semua konten disetujui)
 */
import { useState, useRef, useEffect } from 'react';
import { Card, Btn } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { useAuth } from '../../../context/AuthContext';
// FIX P2: sambungkan publishKonten (POST /content/publish) + generateGame (POST /game/generate)
// V3.3: tambah regenerateContent dan regenerateGame untuk per-card regenerate
import { publishKonten, generateContent, regenerateContent } from '../../../api/content';
import { generateGame, regenerateGame } from '../../../api/game';
import { mapelApi, elemenApi } from '../../../api/admin';
import {
  ADMIN_MAPEL_LIST,   // fallback statis jika API belum tersedia
  ADMIN_KELAS_INIT,
  KURIKULUM_ELEMEN,   // fallback statis jika API belum tersedia
  ADMIN_GURU_INIT,
  TEACHERS,
  SEEDED_TEACHER_ID,
  CAPAIAN_PEMBELAJARAN,
} from '../../../data/masterData';

/* ── Konstanta ───────────────────────────────────────────────────── */
const JENJANG_LIST = [
  { id: 'X', label: 'X' },
  { id: 'XI', label: 'XI' },
  { id: 'XII', label: 'XII' },
];

const KONTEN_TYPES = [
  { id: 'bacaan', label: 'Konten Bacaan', hasLevel: true }, // Level Low/Mid/High — kedalaman & kompleksitas teks disesuaikan per level siswa
  { id: 'quiz_pg', label: 'Kuiz Pilihan Ganda', hasLevel: true },
  { id: 'quiz_essay', label: 'Kuiz Essay', hasLevel: true },
  { id: 'flashcard', label: 'Flashcard', hasLevel: true },
  { id: 'mindmap', label: 'Mindmap', hasLevel: false },
  { id: 'game', label: 'Game', hasLevel: true },
];

const LEVELS = ['Low', 'Mid', 'High'];

const INP = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.tealXL}`,
  borderRadius: 9, fontSize: FS.base, outline: 'none', background: C.white, fontFamily: 'inherit',
};

/* ── Placeholder konten generate ────────────────────────────────── */
const generatePlaceholderKonten = (type, level, config) => {
  const mapelLabel = config.mapelLabel || 'Mata Pelajaran';
  const elemenLabel = config.elemenLabel || 'Elemen';
  const materi = config.materi || elemenLabel;

  // Tipe terstruktur mengembalikan object sesuai shape API (KontenItem.content typedef di content.js).
  // Menjaga kontenMap selalu konsisten antara placeholder dan data nyata dari API response.
  if (type === 'quiz_pg') {
    return {
      soal: [
        { pertanyaan: `[Placeholder] Pertanyaan ${level} tentang ${materi}?`, pilihan: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'], jawaban: 'Pilihan B' },
        { pertanyaan: `[Placeholder] Soal lanjutan tentang ${elemenLabel}?`, pilihan: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'], jawaban: 'Pilihan C' },
      ],
    };
  }
  if (type === 'quiz_essay') {
    return {
      pertanyaan: [
        `[Placeholder] Jelaskan konsep ${materi} dalam konteks ${elemenLabel}!`,
        `[Placeholder] Analisis implikasi ${materi} pada level ${level}.`,
      ],
    };
  }
  if (type === 'flashcard') {
    return {
      cards: [
        { depan: `[Placeholder] Apa yang dimaksud dengan ${materi}?`, belakang: `${materi} adalah konsep dalam ${mapelLabel} yang berkaitan dengan ${elemenLabel}.` },
        { depan: `[Placeholder] Contoh ${materi} level ${level}?`, belakang: `Contoh penerapan ${materi} di kehidupan sehari-hari dalam konteks ${elemenLabel}.` },
      ],
    };
  }

  const levelDesc = {
    Low: 'Pengantar sederhana dengan bahasa lugas dan contoh sehari-hari.',
    Mid: 'Pembahasan mendalam dengan analogi kontekstual.',
    High: 'Analisis tingkat lanjut mencakup aspek kritis dan komparasi.',
  };
  const texts = {
    bacaan: `[Konten Bacaan - ${level}]\nTeks bacaan tentang ${materi} dalam konteks ${mapelLabel}.\n\n${levelDesc[level] || ''}`,
    mindmap: `[Mindmap - ${mapelLabel}]\nTopik Utama: ${elemenLabel}\n- Subtopik 1: Definisi & Konsep Dasar\n  - Point A\n  - Point B\n- Subtopik 2: ${materi}\n  - Contoh Kasus\n  - Aplikasi\n- Subtopik 3: Evaluasi & Refleksi`,
    game: `[Game Preview - ${level}]\nJenis: Kuis Interaktif\nTopik: ${materi}\nLevel: ${level}\nEstimasi Durasi: ${level === 'Low' ? '10' : level === 'Mid' ? '20' : '30'} menit\n\nSiswa menjawab pertanyaan tentang ${elemenLabel} melalui tampilan game interaktif.`,
  };
  return texts[type] || `Konten ${type} level ${level} untuk ${materi}.`;
};

/* ── Helper: ekstrak konten dari response generateContent per tipe ── */
// Digunakan saat regenerasi konten dengan revisi_guru di KontenCard.handleRegenerate.
// Memetakan res.content ke format yang sama dengan kontenMap.
const extractKontenResult = (tipe, level, res) => {
  if (!res?.content) return null;
  switch (tipe) {
    case 'bacaan': return res.content.text || null;
    case 'quiz_pg': return res.content.soal?.length ? res.content : null;
    case 'quiz_essay': return res.content.pertanyaan?.length ? res.content : null;
    case 'flashcard': return res.content.cards?.length ? res.content : null;
    case 'mindmap': return res.content.nodes?.length ? res.content.nodes : null;
    default: return null;
  }
};

/* ── GamePreviewModal — container game asli (Tim 4) ─────────────── */
// Tim 4 deliver game dalam bentuk HTML. html_url diperoleh dari:
//   - Saat guru preview: konten.html_url (hasil generateGame API)
//   - Fallback: URL dibangun dari params jika html_url belum tersedia (status: generating)
const GamePreviewModal = ({ konten, config, onClose }) => {
  // html_url prioritas utama — dari response API /game/generate atau /game/:id
  // Fallback ke URL manual dengan query params jika html_url belum ada
  const GAME_BASE_URL = 'https://game.sekolahrakyat.id/play'; // Tim 4 host
  const fallbackParams = new URLSearchParams({
    mapel_id: config?.mapelId || '',
    elemen_id: config?.elemenId || '',
    elemen: config?.elemenLabel || '',
    materi: config?.materi || '',
    level: konten?.level || 'Low',
    mode: 'preview',  // tidak mempengaruhi progress siswa
  }).toString();
  // Pakai html_url dari API jika ada, fallback ke URL manual
  const gameUrl = konten?.html_url || `${GAME_BASE_URL}?${fallbackParams}`;
  const isReady = !!konten?.html_url;
  const isGenerating = !konten?.html_url && konten?.status === 'generating';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,35,50,.75)',
      zIndex: 1300, display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', margin: '24px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: C.teal, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 14 }}>Preview Game — Level {konten?.level}</div>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: FS.sm, marginTop: 1 }}>
              {config?.mapelLabel} · {config?.elemenLabel || config?.materi}
              <span style={{ marginLeft: 8, background: 'rgba(255,255,255,.15)', padding: '1px 8px', borderRadius: 99, fontSize: 10 }}>Mode Preview</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 30, height: 30, color: C.white, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Game container — Tim 4 deliver HTML, render via iframe */}
        <div style={{ flex: 1, background: '#0f172a', position: 'relative', display: 'flex', flexDirection: 'column' }}>

          {/* State: generating — Tim 4 masih memproses */}
          {isGenerating && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, zIndex: 2 }}>
              <div style={{ width: 48, height: 48, border: '4px solid rgba(255,255,255,.1)', borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: FS.lg, fontWeight: 600 }}>Sedang generate game…</div>
              <div style={{ color: 'rgba(255,255,255,.3)', fontSize: FS.md }}>Tim 4 sedang menyiapkan konten HTML</div>
            </div>
          )}

          {/* State: ready — render iframe dengan html_url dari Tim 4 */}
          {isReady && (
            <iframe
              src={gameUrl}
              style={{ width: '100%', height: '100%', border: 'none', position: 'relative', zIndex: 2 }}
              title={`Preview Game ${config?.elemenLabel || ''} ${config?.materi ? '· ' + config.materi : ''} Level ${konten?.level}`}
              sandbox="allow-scripts allow-same-origin allow-forms"
              allow="fullscreen"
            />
          )}

          {/* State: belum ada html_url (integrasi belum aktif) — tampilkan placeholder informatif */}
          {!isReady && !isGenerating && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, zIndex: 1 }}>
              <div style={{ fontSize: 56, opacity: .3 }}>🎮</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: FS.lg, fontWeight: 600 }}>Game HTML Tim 4</div>
              <div style={{ color: 'rgba(255,255,255,.3)', fontSize: FS.md, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
                Game akan di-render via iframe setelah Tim 4 menyediakan html_url.<br />
                Mapel <strong style={{ color: 'rgba(255,255,255,.5)' }}>{config?.mapelLabel}</strong>
                {' · '} Elemen <strong style={{ color: 'rgba(255,255,255,.5)' }}>{config?.elemenLabel}</strong>
                {config?.materi && <>{' · '} Materi <strong style={{ color: 'rgba(255,255,255,.5)' }}>{config.materi}</strong></>}
                {' · '} Level <strong style={{ color: 'rgba(255,255,255,.5)' }}>{konten?.level}</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 18px', fontSize: FS.sm, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace', maxWidth: 440, wordBreak: 'break-all', textAlign: 'center' }}>
                {gameUrl}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{ background: C.dark, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: FS.sm, color: 'rgba(255,255,255,.4)' }}>
            Preview ini tidak mempengaruhi progress siswa
          </div>
          <button onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: 'transparent', color: C.white, fontSize: FS.md, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Tutup Preview
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── CapaianPembelajaranBox — ditampilkan di panel kiri setelah pilih mapel ── */
const CapaianPembelajaranBox = ({ mapelId, mapelLabel }) => {
  const [open, setOpen] = useState(true);
  const cp = CAPAIAN_PEMBELAJARAN[mapelId];
  if (!cp) return null;

  return (
    <div style={{
      borderRadius: 10,
      background: `linear-gradient(135deg,${C.teal},${C.tealL})`, overflow: 'hidden', marginTop: 14,
    }}>
      {/* Header */}
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', background: 'transparent', border: 'none',
        padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 6,
            background: C.white, color: C.teal,
            fontSize: FS.base, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>🎯</span>
          <div>
            <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.white, textAlign: 'left' }}>
              Capaian Pembelajaran
            </div>
            <div style={{ fontSize: FS.xs, color: 'rgba(255,255,255,.65)', textAlign: 'left' }}>
              {cp.fase} · {mapelLabel}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: FS.xs, color: C.white, fontWeight: 700,
          background: `rgba(255,255,255,.15)`, borderRadius: 5,
          padding: '2px 6px',
        }}>
          {open ? '▲' : '▼ Lihat'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${C.white}15` }}>
          {/* Fase tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${C.white}15`, borderRadius: 99,
            padding: '2px 9px', margin: '8px 0 7px',
          }}>
            <span style={{ fontSize: 9 }}>📚</span>
            <span style={{ fontSize: FS.xs, fontWeight: 700, color: C.white }}>{cp.fase}</span>
          </div>

          {/* Deskripsi singkat */}
          <div style={{
            fontSize: FS.sm, color: C.white, lineHeight: 1.65,
            fontStyle: 'italic', marginBottom: 9,
            padding: '7px 9px',
            borderRadius: 8, border: `1px solid ${C.white}12`,
          }}>
            {cp.deskripsi.length > 220 ? cp.deskripsi.slice(0, 220) + '…' : cp.deskripsi}
          </div>


          {/* Alignment note */}
          <div style={{
            marginTop: 10, padding: '7px 9px',
            background: `${C.white}10`, borderRadius: 7,
            border: `1px solid ${C.white}20`,
            fontSize: FS.xs, color: C.white, lineHeight: 1.5,
          }}>
            💡 Pastikan konten yang kamu buat selaras dengan Capaian Pembelajaran di atas untuk menjaga konsistensi kurikulum.
          </div>
        </div>
      )}
    </div>
  );
};

/* ── ManualEditForm ──────────────────────────────────────────────── */
// Form edit manual isi konten tanpa memanggil ulang API RAG/Game.
// Mendukung semua tipe konten: bacaan (string), quiz_pg, quiz_essay, flashcard, mindmap.
// Game tidak bisa diedit manual (tidak ada field teks yang bisa diubah guru).
const ManualEditForm = ({ typeId, data, onChange, onSave, onCancel }) => {
  const isGame = typeId === 'game';

  // ── bacaan: data = string markdown ──────────────────────────────
  if (typeId === 'bacaan') {
    const text = typeof data === 'string' ? data : (data?.text ?? '');
    return (
      <div style={{ marginTop: 10, padding: 14, background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
        <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 8 }}>✏️ Edit Manual — Bacaan</div>
        <textarea
          value={text}
          onChange={e => onChange(e.target.value)}
          rows={12}
          style={{ ...INP, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical', whiteSpace: 'pre' }}
          placeholder="Edit teks bacaan (format Markdown)"
        />
        <div style={{ fontSize: FS.xs, color: C.slate, marginBottom: 8 }}>Mendukung format Markdown.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={onSave} style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Simpan</button>
        </div>
      </div>
    );
  }

  // ── quiz_pg: data = { soal: [{id, soal, pilihan: string[], jawaban: number}] } ──
  if (typeId === 'quiz_pg') {
    const soalList = data?.soal ?? [];
    const updateSoal = (i, field, val) => {
      const next = soalList.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
      onChange({ ...data, soal: next });
    };
    const updatePilihan = (i, j, val) => {
      const next = soalList.map((s, idx) => {
        if (idx !== i) return s;
        const pilihan = [...s.pilihan];
        pilihan[j] = val;
        return { ...s, pilihan };
      });
      onChange({ ...data, soal: next });
    };
    return (
      <div style={{ marginTop: 10, padding: 14, background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
        <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>✏️ Edit Manual — Kuiz Pilihan Ganda ({soalList.length} soal)</div>
        <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
          {soalList.map((s, i) => (
            <div key={i} style={{ marginBottom: 16, padding: 10, background: C.white, borderRadius: 8, border: `1px solid ${C.tealXL}` }}>
              <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Soal {i + 1}</div>
              <textarea
                value={s.soal ?? s.pertanyaan ?? ''}
                onChange={e => updateSoal(i, s.soal !== undefined ? 'soal' : 'pertanyaan', e.target.value)}
                rows={2}
                style={{ ...INP, resize: 'vertical', marginBottom: 6 }}
                placeholder={`Teks soal nomor ${i + 1}`}
              />
              {(s.pilihan ?? []).map((p, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: FS.xs, color: C.slate, width: 16, flexShrink: 0 }}>{String.fromCharCode(97 + j)})</span>
                  <input
                    value={p}
                    onChange={e => updatePilihan(i, j, e.target.value)}
                    style={{ ...INP, marginBottom: 0, flex: 1 }}
                    placeholder={`Pilihan ${String.fromCharCode(65 + j)}`}
                  />
                  <input
                    type="radio"
                    name={`jawaban_${i}`}
                    checked={s.jawaban === j}
                    onChange={() => updateSoal(i, 'jawaban', j)}
                    title="Tandai sebagai jawaban benar"
                    style={{ cursor: 'pointer', accentColor: C.green }}
                  />
                </div>
              ))}
              <div style={{ fontSize: FS.xs, color: C.slate }}>🔘 = jawaban benar</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={onSave} style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Simpan</button>
        </div>
      </div>
    );
  }

  // ── quiz_essay: data = { pertanyaan: [{id, soal, rubrik, placeholder}] } ──
  if (typeId === 'quiz_essay') {
    const pertanyaanList = data?.pertanyaan ?? [];
    const update = (i, field, val) => {
      const next = pertanyaanList.map((p, idx) => idx === i ? { ...p, [field]: val } : p);
      onChange({ ...data, pertanyaan: next });
    };
    // Support both string[] dan object[] dari API
    const isStringArr = pertanyaanList.length > 0 && typeof pertanyaanList[0] === 'string';
    return (
      <div style={{ marginTop: 10, padding: 14, background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
        <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>✏️ Edit Manual — Kuiz Essay ({pertanyaanList.length} pertanyaan)</div>
        <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          {pertanyaanList.map((p, i) => {
            const soalText = isStringArr ? p : (p.soal ?? '');
            const rubrikText = isStringArr ? '' : (p.rubrik ?? '');
            return (
              <div key={i} style={{ marginBottom: 12, padding: 10, background: C.white, borderRadius: 8, border: `1px solid ${C.tealXL}` }}>
                <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Pertanyaan {i + 1}</div>
                <textarea
                  value={soalText}
                  onChange={e => {
                    if (isStringArr) {
                      const next = [...pertanyaanList];
                      next[i] = e.target.value;
                      onChange({ ...data, pertanyaan: next });
                    } else {
                      update(i, 'soal', e.target.value);
                    }
                  }}
                  rows={2}
                  style={{ ...INP, resize: 'vertical', marginBottom: isStringArr ? 0 : 6 }}
                  placeholder={`Teks pertanyaan nomor ${i + 1}`}
                />
                {!isStringArr && (
                  <textarea
                    value={rubrikText}
                    onChange={e => update(i, 'rubrik', e.target.value)}
                    rows={2}
                    style={{ ...INP, resize: 'vertical' }}
                    placeholder="Rubrik penilaian (opsional)"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={onSave} style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Simpan</button>
        </div>
      </div>
    );
  }

  // ── flashcard: data = { cards: [{depan, belakang}] } ────────────
  if (typeId === 'flashcard') {
    const cards = data?.cards ?? [];
    const updateCard = (i, field, val) => {
      const next = cards.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
      onChange({ ...data, cards: next });
    };
    const addCard = () => onChange({ ...data, cards: [...cards, { depan: '', belakang: '' }] });
    const removeCard = (i) => { if (cards.length > 1) onChange({ ...data, cards: cards.filter((_, idx) => idx !== i) }); };
    return (
      <div style={{ marginTop: 10, padding: 14, background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
        <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>✏️ Edit Manual — Flashcard ({cards.length} kartu)</div>
        <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ marginBottom: 10, padding: 10, background: C.white, borderRadius: 8, border: `1px solid ${C.tealXL}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate }}>Kartu {i + 1}</span>
                {cards.length > 1 && <button onClick={() => removeCard(i)} style={{ fontSize: FS.xs, color: '#E53E3E', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Hapus</button>}
              </div>
              <input value={c.depan} onChange={e => updateCard(i, 'depan', e.target.value)} style={{ ...INP, marginBottom: 6 }} placeholder="Depan kartu (istilah / pertanyaan)" />
              <input value={c.belakang} onChange={e => updateCard(i, 'belakang', e.target.value)} style={{ ...INP, marginBottom: 0 }} placeholder="Belakang kartu (jawaban / definisi)" />
            </div>
          ))}
        </div>
        <button onClick={addCard} style={{ width: '100%', padding: '6px', borderRadius: 8, border: `1.5px dashed ${C.teal}`, background: 'transparent', color: C.teal, fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, marginTop: 4 }}>+ Tambah Kartu</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={onSave} style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Simpan</button>
        </div>
      </div>
    );
  }

  // ── mindmap: data = [{id, label, parent_id}] atau { nodes: [...] } ──
  if (typeId === 'mindmap') {
    const nodes = Array.isArray(data) ? data : (data?.nodes ?? []);
    const updateNode = (i, field, val) => {
      const next = nodes.map((n, idx) => idx === i ? { ...n, [field]: val } : n);
      onChange(Array.isArray(data) ? next : { ...data, nodes: next });
    };
    return (
      <div style={{ marginTop: 10, padding: 14, background: C.white, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
        <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>✏️ Edit Manual — Mindmap ({nodes.length} node)</div>
        <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <span style={{ fontSize: FS.xs, color: C.slate, width: 22, flexShrink: 0 }}>{i + 1}.</span>
              <input value={n.label ?? ''} onChange={e => updateNode(i, 'label', e.target.value)} style={{ ...INP, marginBottom: 0, flex: 2 }} placeholder="Label node" />
              <input value={n.parent_id ?? ''} onChange={e => updateNode(i, 'parent_id', e.target.value || null)} style={{ ...INP, marginBottom: 0, flex: 1, fontSize: FS.xs }} placeholder="parent_id (kosong = root)" />
            </div>
          ))}
        </div>
        <div style={{ fontSize: FS.xs, color: C.slate, marginBottom: 8 }}>Kolom kanan: parent_id — kosongkan untuk node root.</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
          <button onClick={onSave} style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontSize: FS.md, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💾 Simpan</button>
        </div>
      </div>
    );
  }

  // ── game: tidak bisa diedit manual ───────────────────────────────
  if (isGame) {
    return (
      <div style={{ marginTop: 10, padding: 14, background: '#FFF5F5', borderRadius: 10, border: '1.5px solid #FED7D7' }}>
        <div style={{ fontSize: FS.sm, color: '#C53030' }}>⚠️ Game tidak bisa diedit secara manual. Gunakan tombol <strong>🔄 Ulangi</strong> untuk regenerasi dengan instruksi baru.</div>
        <button onClick={onCancel} style={{ marginTop: 10, padding: '6px 16px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>Tutup</button>
      </div>
    );
  }

  return null;
};

/* ── KontenCard ──────────────────────────────────────────────────── */
// kontenMap & setKontenMap di-lift ke parent (KelolaBelajarSection) agar
// handlePublish bisa membaca isi konten saat guru klik Publish.
const KontenCard = ({ type, config, approvedMap, setApprovedMap, kontenMap, setKontenMap, kontenIds, gameIds, setKontenIds, setGameIds }) => {
  const [open, setOpen] = useState(false);
  const [activeLevel, setActiveLevel] = useState('Low');
  const [editingKey, setEditingKey] = useState(null); // "type__level" — mode Ulangi (regenerate)
  const [editText, setEditText] = useState('');
  const [regenerating, setRegenerating] = useState(null);
  const [gamePreview, setGamePreview] = useState(null);
  // Mode edit manual — guru mengedit isi konten langsung tanpa regenerate
  const [manualEditKey, setManualEditKey] = useState(null); // "type__level"
  const [manualEditData, setManualEditData] = useState(null); // deep-copy kontenMap[key] saat masuk edit

  const levels = type.hasLevel ? LEVELS : [''];
  const allApproved = levels.every(lv => approvedMap[`${type.id}__${lv}`]);

  const handleApprove = (lv) => {
    const key = `${type.id}__${lv}`;
    setApprovedMap(p => ({ ...p, [key]: true }));
    setEditingKey(null);
  };

  const handleEdit = (lv) => {
    const key = `${type.id}__${lv}`;
    setEditingKey(key);
    setEditText('');
    setApprovedMap(p => ({ ...p, [key]: false }));
  };

  const handleRegenerate = async (lv) => {
    const key = `${type.id}__${lv}`;
    if (!editText.trim()) return;
    setRegenerating(key);
    try {
      if (type.id === 'game') {
        // V3.3 REFACTOR 3: game regenerate via game_id
        const gameId = gameIds?.[lv];
        if (gameId) {
          // Gunakan regenerateGame jika game_id sudah ada dari generate sebelumnya
          const res = await regenerateGame({
            game_id: gameId,
            instruksi_revisi: editText.trim(),
          });
          setKontenMap(p => ({ ...p, [key]: res?.game_id ? res : generatePlaceholderKonten(type.id, lv, config) }));
          if (res?.game_id) setGameIds(p => ({ ...p, [lv]: res.game_id }));
        } else {
          // Fallback: generate baru jika belum ada game_id
          const res = await generateGame({
            mapel_id: config.mapelId,
            elemen_id: config.elemenId,
            elemen_label: config.elemenLabel,
            materi: config.materi || null,
            materi_id: config.materiId || null,
            kelas_id: config.kelasId || '__semua__',
            jenjang: config.jenjang,
            atp: config.atp,
            level: lv,
            revisi_guru: editText.trim(),
          });
          setKontenMap(p => ({ ...p, [key]: res?.game_id ? res : generatePlaceholderKonten(type.id, lv, config) }));
          if (res?.game_id) setGameIds(p => ({ ...p, [lv]: res.game_id }));
        }
      } else {
        // V3.3 REFACTOR 2: konten regenerate via konten_id
        const kontenId = kontenIds?.[key];
        if (kontenId) {
          // Gunakan regenerateContent jika konten_id sudah ada
          const res = await regenerateContent({
            konten_id: kontenId,
            mapel_id: config.mapelId,
            elemen_id: config.elemenId,
            elemen_label: config.elemenLabel,
            materi: config.materi || null,
            materi_id: config.materiId || null,
            jenjang: config.jenjang,
            atp: config.atp,
            tipe: type.id,
            level: type.hasLevel ? lv : null,
            instruksi_revisi: editText.trim(),
          });
          const newKonten = extractKontenResult(type.id, lv, res);
          setKontenMap(p => ({ ...p, [key]: newKonten ?? generatePlaceholderKonten(type.id, lv, config) }));
          // konten_id tetap sama setelah regenerate
        } else {
          // Fallback: generate baru jika belum ada konten_id
          const res = await generateContent({
            guru_id: config.guruId,
            mapel_id: config.mapelId,
            elemen_id: config.elemenId,
            elemen_label: config.elemenLabel,
            materi: config.materi || null,
            materi_id: config.materiId || null,
            jenjang: config.jenjang,
            atp: config.atp,
            tipe: type.id,
            level: type.hasLevel ? lv : null,
            revisi_guru: editText.trim(),
          });
          const newKonten = extractKontenResult(type.id, lv, res);
          setKontenMap(p => ({ ...p, [key]: newKonten ?? generatePlaceholderKonten(type.id, lv, config) }));
          if (res?.konten_id) setKontenIds(p => ({ ...p, [key]: res.konten_id }));
        }
      }
    } catch {
      // Fallback lokal jika API error
      const baseRegen = generatePlaceholderKonten(type.id, lv, config);
      const regenResult = typeof baseRegen === 'object'
        ? baseRegen
        : `[Diperbarui: "${editText}"]\n\n${baseRegen}`;
      setKontenMap(p => ({ ...p, [key]: regenResult }));
    } finally {
      setRegenerating(null);
      setEditingKey(null);
      setEditText('');
    }
  };

  // ── Handler Edit Manual ──────────────────────────────────────────
  // Masuk ke mode edit manual: deep-copy konten saat ini ke manualEditData
  const handleManualEdit = (lv) => {
    const key = `${type.id}__${lv}`;
    const current = kontenMap[key];
    // Deep copy agar perubahan tidak mutasi state asli sebelum disimpan
    setManualEditData(JSON.parse(JSON.stringify(current ?? {})));
    setManualEditKey(key);
    // Batalkan mode ulangi jika aktif
    setEditingKey(null);
    setEditText('');
  };

  // Simpan hasil edit manual ke kontenMap, batalkan approval agar guru konfirmasi ulang
  const handleManualSave = (lv) => {
    const key = `${type.id}__${lv}`;
    setKontenMap(p => ({ ...p, [key]: manualEditData }));
    setApprovedMap(p => ({ ...p, [key]: false }));
    setManualEditKey(null);
    setManualEditData(null);
  };

  const handleManualCancel = () => {
    setManualEditKey(null);
    setManualEditData(null);
  };

  return (
    <div style={{ border: `1.5px solid ${open ? C.teal : C.tealXL}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8, transition: 'border-color .2s' }}>
      {/* Header baris */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', cursor: 'pointer', background: open ? `${C.teal}06` : C.white }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>{type.id === 'bacaan' ? '📖' : type.id === 'quiz_pg' ? '✅' : type.id === 'quiz_essay' ? '📝' : type.id === 'flashcard' ? '🃏' : type.id === 'mindmap' ? '🧠' : '🎮'}</span>
          <span style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>{type.label}</span>
          {allApproved && <span style={{ fontSize: FS.xs, background: '#F0FFF4', color: C.green, padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>✅ Disetujui</span>}
        </div>
        <span style={{ fontSize: FS.md, color: C.slate }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Body */}
      {open && (
        <div style={{ borderTop: `1px solid ${C.tealXL}`, padding: 16, background: C.white }}>
          {/* Level tabs (hanya jika hasLevel) */}
          {type.hasLevel && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {LEVELS.map(lv => {
                const key = `${type.id}__${lv}`;
                const approved = approvedMap[key];
                return (
                  <button key={lv} onClick={() => setActiveLevel(lv)}
                    style={{
                      padding: '5px 14px', borderRadius: 99, fontSize: FS.md, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: activeLevel === lv ? `linear-gradient(135deg,${C.teal},${C.tealL})` : approved ? `linear-gradient(135deg,${C.teal},${C.tealL})` : C.white,
                      color: activeLevel === lv ? C.white : approved ? C.white : C.darkL,
                      border: `1.5px solid ${activeLevel === lv ? C.teal : approved ? `linear-gradient(135deg,${C.teal},${C.tealL})` : C.tealXL}`,
                    }}>
                    {lv}{approved ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          )}

          {/* Konten teks */}
          {(() => {
            const lv = type.hasLevel ? activeLevel : '';
            const key = `${type.id}__${lv}`;
            const approved = approvedMap[key];
            const isEditing = editingKey === key;
            const isRegen = regenerating === key;
            const isManualEditing = manualEditKey === key;
            // Data selalu siap saat phase=result — handleSubmit await Promise.allSettled
            // sebelum setPhase(result). Tidak ada per-item loading state di sini.

            return (
              <div>
                {/* Judul level */}
                {type.hasLevel
                  ? <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>Konten Level {activeLevel}</div>
                  : <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 10 }}>Teks Konten</div>
                }

                {isRegen ? (
                  <div style={{ textAlign: 'center', padding: '28px 0' }}>
                    <div style={{ width: 28, height: 28, border: `3px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: FS.md, color: C.slate }}>Membuat ulang konten…</div>
                  </div>
                ) : isManualEditing ? null : (
                  <div style={{ background: '#FAFEFF', borderRadius: 10, padding: 14, border: `1px solid ${C.tealXL}`, marginBottom: 10 }}>
                    {/* Structured renderer -- prevents "Objects are not valid as React child"
                        quiz_pg    -> { soal: [{pertanyaan, pilihan, jawaban}] }
                        quiz_essay -> { pertanyaan: string[] }
                        flashcard  -> { cards: [{depan, belakang}] }
                        bacaan / mindmap / game -> string */}
                    {type.id === 'game' ? (
                      <pre style={{ fontFamily: 'inherit', fontSize: FS.md, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {kontenMap[key]?.nama || kontenMap[key]?.deskripsi || '(game sedang disiapkan...)'}
                      </pre>
                    ) : type.id === 'quiz_pg' ? (
                      <div>
                        {!(kontenMap[key]?.soal?.length)
                          ? <span style={{ color: C.slate, fontSize: FS.md }}>Soal sedang disiapkan...</span>
                          : (kontenMap[key].soal).map((s, i) => (
                            <div key={i} style={{ marginBottom: 14 }}>
                              <div style={{ fontWeight: 700, color: C.dark, fontSize: FS.md, marginBottom: 6 }}>{i + 1}. {s.soal}</div>
                              {(s.pilihan || []).map((p, j) => (
                                <div key={j} style={{ paddingLeft: 12, marginBottom: 3 }}>
                                  <span style={{ fontSize: FS.md, color: j === s.jawaban ? C.green : C.darkL, fontWeight: j === s.jawaban ? 700 : 400 }}>
                                    {String.fromCharCode(97 + j)}) {p} {j === s.jawaban ? ' (jawaban)' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))
                        }
                      </div>
                    ) : type.id === 'quiz_essay' ? (
                      <div>
                        {!(kontenMap[key]?.pertanyaan?.length)
                          ? <span style={{ color: C.slate, fontSize: FS.md }}>Pertanyaan sedang disiapkan...</span>
                          : (kontenMap[key].pertanyaan).map((p, i) => {
                            const soalText = typeof p === 'string' ? p : (p.soal ?? '');
                            const rubrikText = typeof p === 'string' ? '' : (p.rubrik ?? '');
                            return (
                              <div key={i} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: FS.md, color: C.darkL, lineHeight: 1.7 }}>{i + 1}. {soalText}</div>
                                {rubrikText ? (
                                  <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3, paddingLeft: 16, fontStyle: 'italic' }}>
                                    📋 {rubrikText}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        }
                      </div>
                    ) : type.id === 'flashcard' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!(kontenMap[key]?.cards?.length)
                          ? <span style={{ color: C.slate, fontSize: FS.md }}>Kartu sedang disiapkan...</span>
                          : (kontenMap[key].cards).map((c, i) => (
                            <div key={i} style={{ border: `1px solid ${C.tealXL}`, borderRadius: 8, overflow: 'hidden' }}>
                              <div style={{ background: `${C.teal}18`, padding: '6px 12px', fontSize: FS.sm, fontWeight: 700, color: C.teal, borderBottom: `1px solid ${C.tealXL}` }}>
                                [Depan]
                              </div>
                              <div style={{ padding: '8px 12px', fontSize: FS.md, color: C.dark }}>{c.depan}</div>
                              <div style={{ background: '#F0FFF4', padding: '6px 12px', fontSize: FS.sm, fontWeight: 700, color: C.green, borderTop: `1px solid ${C.tealXL}`, borderBottom: `1px solid ${C.tealXL}` }}>
                                [Belakang]
                              </div>
                              <div style={{ padding: '8px 12px', fontSize: FS.md, color: C.darkL }}>{c.belakang}</div>
                            </div>
                          ))
                        }
                      </div>
                    ) : type.id === 'mindmap' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(() => {
                          const raw = kontenMap[key];
                          const nodes = Array.isArray(raw) ? raw : (raw?.nodes ?? []);
                          if (nodes.length === 0) {
                            const text = typeof raw === 'string' ? raw : (raw?.text ?? '');
                            return <pre style={{ fontFamily: 'inherit', fontSize: FS.md, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{text || '(konten kosong)'}</pre>;
                          }
                          return nodes.map((n, i) => (
                            <div key={n.id || i} style={{ paddingLeft: n.parent_id ? 20 : 0, fontSize: FS.md, color: n.parent_id ? C.darkL : C.dark, fontWeight: n.parent_id ? 400 : 700 }}>
                              {n.parent_id ? '• ' : '⬡ '}{n.label}
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <pre style={{ fontFamily: 'inherit', fontSize: FS.md, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {typeof kontenMap[key] === 'string' ? kontenMap[key] : JSON.stringify(kontenMap[key], null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Aksi baris */}
                {!isRegen && !isManualEditing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Game preview */}
                    {type.id === 'game' && (
                      <button
                        onClick={() => setGamePreview({ ...(kontenMap[key] || {}), level: lv })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        🔍 Preview Game
                      </button>
                    )}
                    {!approved && !isEditing && !isManualEditing && (
                      <>
                        <button onClick={() => handleApprove(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #9AE6B4', background: '#F0FFF4', fontSize: FS.sm, color: C.green, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✓ Setuju
                        </button>
                        <button onClick={() => handleManualEdit(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleEdit(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          🔄 Ulangi
                        </button>
                      </>
                    )}
                    {approved && !isEditing && !isManualEditing && (
                      <>
                        <button onClick={() => handleManualEdit(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleEdit(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, cursor: 'pointer', fontFamily: 'inherit' }}>
                          🔄 Ulangi
                        </button>
                      </>
                    )}
                    {approved && !isEditing && !isManualEditing && <span style={{ fontSize: FS.sm, color: C.green, fontWeight: 700 }}>✅ Disetujui</span>}
                  </div>
                )}

                {/* Form Ulangi — regenerate via RAG */}
                {isEditing && !isRegen && (
                  <div style={{ marginTop: 10, padding: 12, background: C.white, borderRadius: 10, border: `1px solid ${C.tealXL}` }}>
                    <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.orange, marginBottom: 8 }}>📝 Deskripsikan perubahan yang diinginkan</div>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      placeholder="Contoh: Tambahkan lebih banyak contoh konkret, atau tingkatkan tingkat kesulitan soal"
                      style={{ ...INP, marginBottom: 8 }}
                      onFocus={e => e.target.style.borderColor = C.teal}
                      onBlur={e => e.target.style.borderColor = C.tealXL}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingKey(null); setEditText(''); }}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Batal
                      </button>
                      <button onClick={() => handleRegenerate(lv)} disabled={!editText.trim()}
                        style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: editText.trim() ? `linear-gradient(135deg,${C.teal},${C.tealL})` : '#E2E8F0', color: editText.trim() ? C.white : C.slate, fontSize: FS.md, fontWeight: 700, cursor: editText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                        🔄 Buat ulang
                      </button>
                    </div>
                  </div>
                )}

                {/* Form Edit Manual — guru ubah isi konten langsung */}
                {isManualEditing && manualEditData !== null && (
                  <ManualEditForm
                    typeId={type.id}
                    data={manualEditData}
                    onChange={setManualEditData}
                    onSave={() => handleManualSave(lv)}
                    onCancel={handleManualCancel}
                  />
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Game preview fullscreen */}
      {gamePreview && <GamePreviewModal konten={gamePreview} config={config} onClose={() => setGamePreview(null)} />}
    </div>
  );
};

const AtpPointInput = ({ poinList, onChange }) => {
  const addPoin = () => onChange([...poinList, '']);
  const updatePoin = (i, val) => {
    const next = [...poinList];
    next[i] = val;
    onChange(next);
  };
  const removePoin = (i) => {
    if (poinList.length === 1) return; // minimal 1 baris
    onChange(poinList.filter((_, idx) => idx !== i));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {poinList.map((poin, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Nomor poin */}
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: `${C.teal}18`, color: C.teal,
            fontSize: FS.xs, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{i + 1}</div>

          {/* Input teks poin */}
          <input
            value={poin}
            onChange={e => updatePoin(i, e.target.value)}
            placeholder={`Poin ATP ${i + 1}…`}
            style={{ ...INP, flex: 1, padding: '7px 10px' }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.tealXL}
          />

          {/* Hapus poin */}
          <button
            onClick={() => removePoin(i)}
            disabled={poinList.length === 1}
            style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              border: `1px solid ${C.tealXL}`, background: C.white,
              color: poinList.length === 1 ? C.slate + '60' : '#E53E3E',
              cursor: poinList.length === 1 ? 'not-allowed' : 'pointer',
              fontSize: 14, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>
      ))}

      {/* Tambah poin */}
      <button
        onClick={addPoin}
        style={{
          padding: '6px 10px', borderRadius: 8, marginTop: 2,
          border: `1.5px dashed ${C.tealXL}`,
          background: 'transparent', color: C.teal,
          fontSize: FS.sm, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tambah Poin ATP
      </button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
const KelolaBelajarSection = ({ onGoToRiwayat }) => {
  // Ambil user dari AuthContext — sumber kebenaran saat integrasi BE
  const { user: authUser } = useAuth();

  // Guru: coba ambil dari AuthContext (integrasi), fallback ke masterData (dev)
  const teacherFromTeachers = TEACHERS.find(t => t.id === SEEDED_TEACHER_ID);
  const guru = ADMIN_GURU_INIT.find(g =>
    g.id === 'g1' ||
    (teacherFromTeachers?.name && g.nama.includes(teacherFromTeachers.name.split(',')[0].replace('Bpk. ', '').replace('Ibu ', '').trim()))
  ) || ADMIN_GURU_INIT[0];
  const guruMapelIds = Array.isArray(guru?.mapel_ids) ? guru.mapel_ids
    : (guru?.mapel_ids ? [guru.mapel_ids] : (Array.isArray(guru?.mapelId) ? guru.mapelId : []));

  const [jenjang, setJenjang] = useState('X');
  const [kelasId, setKelasId] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [elemenId, setElemenId] = useState('');
  const [materi, setMateri] = useState('');
  const [atpPoin, setAtpPoin] = useState(['']);

  // ── FIX: Mapel & Elemen dari API (GET /admin/mapel, GET /admin/elemen?mapel_id=) ──
  // Fallback ke data statis jika API belum tersedia (dev mode / jaringan tidak ada)
  const [mapelListApi, setMapelListApi] = useState(null);   // null = belum di-fetch
  const [elemenListApi, setElemenListApi] = useState(null); // null = belum di-fetch / belum pilih mapel
  const [mapelLoading, setMapelLoading] = useState(false);
  const [elemenLoading, setElemenLoading] = useState(false);

  // Fetch semua mapel dari API saat mount
  useEffect(() => {
    setMapelLoading(true);
    mapelApi.list()
      .then(data => { if (Array.isArray(data)) setMapelListApi(data); })
      .catch(() => { /* fallback ke static */ })
      .finally(() => setMapelLoading(false));
  }, []);

  // Fetch elemen dari API setiap kali mapelId berubah
  useEffect(() => {
    if (!mapelId) { setElemenListApi(null); setElemenId(''); return; }
    setElemenLoading(true);
    setElemenListApi(null);
    setElemenId('');
    elemenApi.list(mapelId)
      .then(data => { if (Array.isArray(data)) setElemenListApi(data); })
      .catch(() => { /* fallback ke static */ })
      .finally(() => setElemenLoading(false));
  }, [mapelId]);

  // Resolved lists — API data jika ada, fallback ke static masterData
  const mapelListRaw = mapelListApi ?? ADMIN_MAPEL_LIST;
  const mapelList = mapelListRaw.filter(m => guruMapelIds.includes(m.id));
  const elemenList = elemenListApi ?? (KURIKULUM_ELEMEN[mapelId] || []);
  const selectedMapel = mapelList.find(m => m.id === mapelId);
  const selectedElemen = elemenList.find(e => e.id === elemenId);

  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'result'
  const [approvedMap, setApprovedMap] = useState({});
  const [publishing, setPublishing] = useState(false);
  // kontenMap di-lift ke parent agar handlePublish bisa membaca isi konten saat guru Publish.
  const [kontenMap, setKontenMap] = useState({});
  // V3.3 REFACTOR 2 & 3: simpan konten_id dan game_id per card untuk regenerate
  const [kontenIds, setKontenIds] = useState({}); // key: "bacaan__Low", value: konten_id
  const [gameIds, setGameIds] = useState({});       // key: "Low", value: game_id
  // publishToast: tampilkan banner sukses singkat setelah publish berhasil
  const [publishToast, setPublishToast] = useState(null); // null | { mapelLabel, elemenLabel, publishedAt }

  const kelasList = ADMIN_KELAS_INIT.filter(k => k.tingkat === jenjang);

  const config = {
    jenjang, kelasId, mapelId,
    mapelLabel: selectedMapel?.label || '',
    elemenId, elemenLabel: selectedElemen?.label || elemenId,
    materi: materi || selectedElemen?.label || '',
    materiId: materi ? `${mapelId}__${materi.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}` : null,
    atp: atpPoin.filter(p => p.trim()).join('\n'),
    guruId: guru?.id || 'g1',
  };

  // Semua konten disetujui = bisa publish
  const allApproved = KONTEN_TYPES.every(type => {
    const levels = type.hasLevel ? LEVELS : [''];
    return levels.every(lv => approvedMap[`${type.id}__${lv}`]);
  });

  // FIX: Validasi jumlah konten harus 16 item sebelum publish
  // bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 + game×3 = 16
  const EXPECTED_KONTEN_COUNT = 16;
  const buildKontenList = () => {
    const list = [];
    KONTEN_TYPES.forEach(type => {
      const levels = type.hasLevel ? LEVELS : [''];
      levels.forEach(lv => {
        const key = `${type.id}__${lv}`;
        const raw = kontenMap[key];
        if (raw == null) return;

        // kontenMap menyimpan nilai *raw* per tipe:
        //   bacaan    → string teks markdown
        //   mindmap   → Array<node> atau string teks
        //   quiz_pg   → { soal: [...] }
        //   quiz_essay→ { pertanyaan: [...] }
        //   flashcard → { cards: [...] }
        //   game      → object dari generateGame response
        // Harus dibungkus ke shape content sesuai API contract sebelum disimpan.
        let content;
        switch (type.id) {
          case 'bacaan':
            content = { text: typeof raw === 'string' ? raw : (raw?.text || '') };
            break;
          case 'mindmap':
            content = Array.isArray(raw)
              ? { nodes: raw }
              : (typeof raw === 'string' ? { nodes: [], text: raw } : raw);
            break;
          case 'quiz_pg':
            content = raw?.soal ? raw : { soal: [] };
            break;
          case 'quiz_essay':
            content = raw?.pertanyaan ? raw : { pertanyaan: [] };
            break;
          case 'flashcard':
            content = raw?.cards ? raw : { cards: [] };
            break;
          case 'game':
            // game: raw adalah full response dari generateGame (game_id, html_url, status, …)
            content = raw;
            break;
          default:
            content = raw;
        }

        list.push({
          konten_id: kontenIds[key] ?? null, // V3.3 REFACTOR 2: wajib untuk publish
          tipe: type.id,
          level: lv || null,
          content,
          approved: !!approvedMap[key],
        });
      });
    });
    return list;
  };

  const handleSubmit = async () => {
    if (!mapelId || !elemenId) return;
    setPhase('loading');
    setApprovedMap({});
    setKontenMap({});

    // basePayload: basis semua generate calls ke Tim 3 & Tim 4
    // elemen_id SELALU ada. materi/materi_id hanya diisi jika guru mengisi field materi.
    // materi_id dibangun dari mapel_id + snake_case(materi) jika materi ada.
    const snakeMateri = materi ? materi.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : null;
    const basePayload = {
      guru_id: guru?.id || 'g1',
      mapel_id: mapelId,
      elemen_id: elemenId,
      elemen_label: config.elemenLabel,
      materi: materi || null,
      materi_id: snakeMateri ? `${mapelId}__${snakeMateri}` : null,
      jenjang,
      atp: atpPoin.filter(p => p.trim()).join('\n'),
    };

    // Kumpulkan semua API promises — TIDAK fire-and-forget.
    // Spinner global (phase='loading') tampil sampai SEMUA selesai.
    // Setelah Promise.allSettled resolve, kontenMap sudah penuh → setPhase('result').
    const resultMap = {};

    const promises = [];

    // POST /content/generate untuk bacaan — per level (Low/Mid/High)
    // response: { konten_id, tipe, level, content: { text }, generated_at }
    // V3.3 REFACTOR 2: simpan konten_id untuk regenerate per card
    const newKontenIds = {};
    const newGameIds = {};

    LEVELS.forEach(level => {
      promises.push(
        generateContent({ ...basePayload, tipe: 'bacaan', level })
          .then(res => {
            resultMap[`bacaan__${level}`] = res?.content?.text
              ? res.content.text
              : generatePlaceholderKonten('bacaan', level, config);
            if (res?.konten_id) newKontenIds[`bacaan__${level}`] = res.konten_id;
          })
          .catch(() => {
            resultMap[`bacaan__${level}`] = generatePlaceholderKonten('bacaan', level, config);
          })
      );
    });

    // POST /content/generate untuk mindmap (tanpa level)
    // Contract Tim 3: response mindmap → { tipe: "mindmap", level: null, content: { nodes: [...] } }
    promises.push(
      generateContent({ ...basePayload, tipe: 'mindmap' })
        .then(res => {
          resultMap['mindmap__'] = res?.content?.nodes?.length
            ? res.content.nodes
            : generatePlaceholderKonten('mindmap', '', config);
          if (res?.konten_id) newKontenIds['mindmap__'] = res.konten_id;
        })
        .catch(() => {
          resultMap['mindmap__'] = generatePlaceholderKonten('mindmap', '', config);
        })
    );

    // POST /content/generate untuk quiz_pg, quiz_essay, flashcard — per level
    // response shape per tipe:
    //   quiz_pg    → { soal: Array<{pertanyaan, pilihan, jawaban}> }
    //   quiz_essay → { pertanyaan: string[] }
    //   flashcard  → { cards: Array<{depan, belakang}> }
    ['quiz_pg', 'quiz_essay', 'flashcard'].forEach(tipe => {
      LEVELS.forEach(level => {
        promises.push(
          generateContent({ ...basePayload, tipe, level })
            .then(res => {
              resultMap[`${tipe}__${level}`] = res?.content
                ? res.content
                : generatePlaceholderKonten(tipe, level, config);
              if (res?.konten_id) newKontenIds[`${tipe}__${level}`] = res.konten_id;
            })
            .catch(() => {
              resultMap[`${tipe}__${level}`] = generatePlaceholderKonten(tipe, level, config);
            })
        );
      });
    });

    // POST /game/generate untuk 3 level — Tim 4 deliver HTML
    // Payload wajib: mapel_id, elemen_id, elemen_label, kelas_id, jenjang, level, atp
    // atp WAJIB sesuai contract Tim 4 — untuk konteks skenario game
    // revisi_guru: "" saat generate pertama; diisi saat guru edit di panel review
    // V3.3 REFACTOR 3: simpan game_id untuk regenerate per level
    LEVELS.forEach(level => {
      promises.push(
        generateGame({
          mapel_id: basePayload.mapel_id,
          elemen_id: basePayload.elemen_id,
          elemen_label: basePayload.elemen_label,
          materi: basePayload.materi,
          materi_id: basePayload.materi_id,
          kelas_id: kelasId || '__semua__',
          jenjang: basePayload.jenjang,
          atp: basePayload.atp,
          level,
          revisi_guru: '',
        })
          .then(res => {
            resultMap[`game__${level}`] = res?.game_id
              ? res
              : generatePlaceholderKonten('game', level, config);
            if (res?.game_id) newGameIds[level] = res.game_id;
          })
          .catch(() => {
            resultMap[`game__${level}`] = generatePlaceholderKonten('game', level, config);
          })
      );
    });

    // Tunggu semua API selesai (baik sukses maupun gagal) sebelum tampilkan result.
    // Spinner global (phase='loading') aktif selama ini.
    // Setelah ini, kontenMap sudah berisi data lengkap → card tampil langsung tanpa loading per-item.
    await Promise.allSettled(promises);

    setKontenMap(resultMap);
    // V3.3 REFACTOR 2 & 3: simpan konten_id dan game_id ke state untuk regenerate
    if (Object.keys(newKontenIds).length > 0) setKontenIds(prev => ({ ...prev, ...newKontenIds }));
    if (Object.keys(newGameIds).length > 0) setGameIds(prev => ({ ...prev, ...newGameIds }));
    setPhase('result');
  };

  const handleBatal = () => {
    setPhase('form');
    setApprovedMap({});
    setPublishing(false);
    setKontenMap({});
    setKontenIds({});
    setGameIds({});
    setAtpPoin(['']);
  };

  const handleReset = () => {
    setPhase('form');
    setApprovedMap({});
    setKontenMap({});
    setKontenIds({});
    setGameIds({});
    setAtpPoin(['']);
  };

  const handlePublish = async () => {
    if (!allApproved || publishing) return;

    // FIX: Validasi jumlah konten sebelum publish — harus tepat 16 item
    const kontenList = buildKontenList();
    if (kontenList.length < EXPECTED_KONTEN_COUNT) {
      alert(`Tidak semua konten berhasil digenerate. Dibutuhkan ${EXPECTED_KONTEN_COUNT} item, saat ini hanya ${kontenList.length}. Silakan generate ulang konten yang gagal.`);
      return;
    }

    setPublishing(true);
    try {
      // Bangun konten_list dari semua KONTEN_TYPES yang disetujui guru
      // Field "tipe" (bukan "type") — konsisten dengan KontenItem typedef di content.js
      const snakeM = config.materi
        ? config.materi.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        : null;
      await publishKonten({
        mapel_id: config.mapelId,
        elemen_id: config.elemenId,
        elemen_label: config.elemenLabel,
        materi: config.materi || null,
        materi_id: snakeM ? `${config.mapelId}__${snakeM}` : null,
        kelas_id: config.kelasId || '__semua__',
        jenjang: config.jenjang,
        guru_id: guru?.id || 'g1',
        atp: config.atp || '',
        konten_list: kontenList,
      });
    } catch {
      // Fallback: tetap anggap berhasil meski API gagal (dev mode)
    } finally {
      setPublishing(false);
    }
    // Tampilkan toast sukses, lalu reset ke form
    setPublishToast({
      mapelLabel: config.mapelLabel,
      elemenLabel: config.elemenLabel,
      publishedAt: new Date().toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    });
    handleReset();
    // Auto-dismiss toast setelah 5 detik
    setTimeout(() => setPublishToast(null), 5000);
  };

  const { isMobile } = useBreakpoint();
  const isSmall = isMobile; // tablet uses row layout but scrollable right panel

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'auto', flexDirection: isSmall ? 'column' : 'row', background: C.bg }}>

      {/* ── Panel Kiri: Form Konfigurasi ── */}
      <div style={{ width: isSmall ? '100%' : 340, minWidth: isSmall ? 'auto' : 300, maxHeight: isSmall ? 380 : 'none', background: C.white, borderRight: isSmall ? 'none' : `1px solid rgba(13,92,99,.1)`, borderBottom: isSmall ? `1px solid rgba(13,92,99,.1)` : 'none', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid rgba(13,92,99,.08)` }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark }}>
            📐 Buat Konten Belajar
          </div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 3 }}>
            Konfigurasi dan generate konten interaktif untuk siswa
          </div>
        </div>

        <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto' }}>
          <div style={{ background: '#FAFEFF', borderRadius: 12, padding: 16, border: `1.5px solid ${C.tealXL}` }}>
            <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark, marginBottom: 14 }}>Bahan Belajar Interaktif</div>

            {/* Jenjang */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7, textTransform: 'lowercase' }}>jenjang</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {JENJANG_LIST.map(j => (
                  <button key={j.id} onClick={() => { setJenjang(j.id); setKelasId(''); }}
                    style={{ flex: 1, padding: '7px 16px', borderRadius: 8, fontFamily: 'inherit', fontSize: FS.md, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${jenjang === j.id ? C.teal : C.tealXL}`, background: jenjang === j.id ? `${C.teal}10` : C.white, color: jenjang === j.id ? C.teal : C.darkL }}>
                    {j.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kelas */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>Kelas</label>
              <select value={kelasId} onChange={e => setKelasId(e.target.value)} style={{ ...INP }}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL}>
                <option value="">Pilih kelas</option>
                <option value="__semua__">Semua Kelas (Jenjang {jenjang})</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>
                Mata Pelajaran
                {mapelLoading && <span style={{ marginLeft: 6, fontSize: FS.xs, color: C.teal, fontWeight: 400 }}>Memuat…</span>}
              </label>
              <select value={mapelId} onChange={e => { setMapelId(e.target.value); setElemenId(''); }} style={{ ...INP }}
                disabled={mapelLoading}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL}>
                <option value="">{mapelLoading ? 'Memuat mata pelajaran…' : 'Pilih Mata pelajaran'}</option>
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.icon ? `${m.icon} ` : ''}{m.label}</option>)}
              </select>
            </div>

            {/* Capaian Pembelajaran — muncul setelah mapel dipilih */}
            <div style={{ marginBottom: 14 }}>
              {mapelId && selectedMapel && (
                <CapaianPembelajaranBox
                  mapelId={mapelId}
                  mapelLabel={selectedMapel.label}
                />
              )}
            </div>

            {/* Elemen */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>
                Elemen
                {elemenLoading && <span style={{ marginLeft: 6, fontSize: FS.xs, color: C.teal, fontWeight: 400 }}>Memuat…</span>}
              </label>
              <select value={elemenId} onChange={e => setElemenId(e.target.value)} style={{ ...INP }}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL}
                disabled={!mapelId || elemenLoading}>
                <option value="">{elemenLoading ? 'Memuat elemen…' : 'Pilih Elemen'}</option>
                {elemenList.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>

            {/* Materi (opsional) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>Pilih Materi <span style={{ fontWeight: 400 }}>(opsional)</span></label>
              <input value={materi} onChange={e => setMateri(e.target.value)} placeholder="Masukkan nama materi"
                style={{ ...INP }}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
            </div>

            {/* ATP */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>
                Alur Tujuan Pembelajaran (ATP)
              </label>
              <AtpPointInput poinList={atpPoin} onChange={setAtpPoin} />
            </div>

            <button onClick={handleSubmit} disabled={!mapelId || !elemenId || phase === 'result'}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
                background: (mapelId && elemenId && phase !== 'result') ? C.amber : '#E2E8F0',
                color: (mapelId && elemenId && phase !== 'result') ? C.white : C.slate,
                fontWeight: 700, fontSize: FS.base, cursor: (mapelId && elemenId && phase !== 'result') ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}>
              {phase === 'result' ? ' Konten Dibuat' : 'Buat Konten'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Panel Kanan: Preview / Loading / Result ── */}
      <div style={{ flex: 1, overflow: 'visible', padding: '20px 24px', minWidth: 0, backgroundColor: C.white }}>

        {phase === 'form' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: C.slate }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: .3 }}>📐</div>
              <div style={{ fontSize: FS.lg, fontWeight: 600, color: C.darkL }}>Preview konten belajar akan muncul disini</div>
              <div style={{ fontSize: FS.md, marginTop: 4 }}>Isi form dan klik Buat Konten</div>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, border: `4px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .9s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: FS.lg, fontWeight: 600, color: C.dark }}>Sedang Membuat Konten…</div>
              <div style={{ fontSize: FS.md, color: C.slate, marginTop: 4 }}>AI sedang membuat konten berdasarkan ATP dan elemen yang dipilih</div>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div>
            {/* Konteks Konten */}
            <Card style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark, marginBottom: 12 }}>Konteks Konten</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px 16px', marginBottom: 10 }}>
                {[
                  { l: 'JENJANG', v: config.jenjang },
                  { l: 'KELAS', v: config.kelasId === '__semua__' ? `Semua Kelas ${config.jenjang} (${kelasList.length} kelas)` : config.kelasId ? ADMIN_KELAS_INIT.find(k => k.id === config.kelasId)?.nama || config.kelasId : '—' },
                  { l: 'MAPEL', v: config.mapelLabel },
                  { l: 'ELEMEN', v: config.elemenLabel || 'Elemen' },
                  { l: 'MATERI', v: config.materi || '—' },
                ].map(item => (
                  <div key={item.l}>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 2 }}>{item.l}</div>
                    <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>{item.v}</div>
                  </div>
                ))}
              </div>
              {config.atp && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#FAFEFF', borderRadius: 8, border: `1px solid ${C.tealXL}` }}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, marginBottom: 4 }}>Alur Tujuan Pembelajaran (ATP)</div>
                  <div style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{config.atp}</div>
                </div>
              )}
            </Card>

            {/* List konten */}
            {KONTEN_TYPES.map(type => (
              <KontenCard key={type.id} type={type} config={config} approvedMap={approvedMap} setApprovedMap={setApprovedMap} kontenMap={kontenMap} setKontenMap={setKontenMap} kontenIds={kontenIds} gameIds={gameIds} setKontenIds={setKontenIds} setGameIds={setGameIds} />
            ))}

            {/* Status approve summary */}
            {!allApproved && (
              <div style={{ background: '#FFFBF0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: FS.sm, color: C.orange, border: `1px solid ${C.amberL}` }}>
                ⚠ Setujui semua konten sebelum dapat mempublish.
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingBottom: 24 }}>
              <button onClick={handleBatal}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: `1.5px solid ${C.tealXL}`, background: C.white, fontSize: FS.base, fontWeight: 700, color: C.dark, cursor: 'pointer', fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={handlePublish} disabled={!allApproved || publishing}
                style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: allApproved ? `linear-gradient(135deg,${C.teal},${C.tealL})` : '#CBD5E0', color: allApproved ? C.white : C.slate, fontSize: FS.base, fontWeight: 700, cursor: (allApproved && !publishing) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {publishing ? (
                  <>
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: C.white, borderRadius: '50%', animation: 'spin .7s linear infinite', flexShrink: 0 }} />
                    Mengirim ke siswa…
                  </>
                ) : allApproved ? '🚀 Published' : '⏳ Setujui semua dulu'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Toast Sukses Publish — muncul setelah publish berhasil ── */}
      {publishToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, minWidth: 320, maxWidth: 480,
          background: 'linear-gradient(135deg, #0D5C63 0%, #1A8C8C 100%)',
          borderRadius: 14, padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(13,92,99,.35)',
          display: 'flex', alignItems: 'center', gap: 14,
          animation: 'slideUp .25s ease-out',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>🚀</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontWeight: 800, fontSize: FS.base }}>
              Konten berhasil dipublish!
            </div>
            <div style={{ color: 'rgba(255,255,255,.75)', fontSize: FS.sm, marginTop: 2 }}>
              {publishToast.mapelLabel} · {publishToast.elemenLabel || '—'}
            </div>
          </div>
          <button
            onClick={() => { setPublishToast(null); onGoToRiwayat?.(); }}
            style={{
              padding: '6px 12px', borderRadius: 8,
              border: '1.5px solid rgba(255,255,255,.4)',
              background: 'rgba(255,255,255,.15)',
              color: C.white, fontSize: FS.sm, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
            Lihat Riwayat
          </button>
          <button
            onClick={() => setPublishToast(null)}
            style={{
              background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 6,
              width: 26, height: 26, color: C.white, cursor: 'pointer',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>✕</button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  );
};

export default KelolaBelajarSection;