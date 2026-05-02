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
import { useState, useRef } from 'react';
import { Card, Btn } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
// FIX P2: sambungkan publishKonten (POST /content/publish) + generateGame (POST /game/generate)
import { publishKonten, generateContent } from '../../../api/content';
import { generateGame } from '../../../api/game';
import {
  ADMIN_MAPEL_LIST,
  ADMIN_KELAS_INIT,
  KURIKULUM_ELEMEN,
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
const CapaianPembelajaranBox = ({ mapelId, mapelColor, mapelLabel }) => {
  const [open, setOpen] = useState(true);
  const cp = CAPAIAN_PEMBELAJARAN[mapelId];
  if (!cp) return null;

  return (
    <div style={{
      borderRadius: 10, border: `1.5px solid ${mapelColor}30`,
      background: `${mapelColor}06`, overflow: 'hidden', marginTop: 14,
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
            background: `${mapelColor}20`, color: mapelColor,
            fontSize: FS.base, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>🎯</span>
          <div>
            <div style={{ fontSize: FS.sm, fontWeight: 700, color: mapelColor, textAlign: 'left' }}>
              Capaian Pembelajaran
            </div>
            <div style={{ fontSize: FS.xs, color: '#8899AA', textAlign: 'left' }}>
              {cp.fase} · {mapelLabel}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: FS.xs, color: mapelColor, fontWeight: 700,
          background: `${mapelColor}18`, borderRadius: 5,
          padding: '2px 6px',
        }}>
          {open ? '▲' : '▼ Lihat'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${mapelColor}15` }}>
          {/* Fase tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: `${mapelColor}15`, borderRadius: 99,
            padding: '2px 9px', margin: '8px 0 7px',
          }}>
            <span style={{ fontSize: 9 }}>📚</span>
            <span style={{ fontSize: FS.xs, fontWeight: 700, color: mapelColor }}>{cp.fase}</span>
          </div>

          {/* Deskripsi singkat */}
          <div style={{
            fontSize: FS.sm, color: '#4A5568', lineHeight: 1.65,
            fontStyle: 'italic', marginBottom: 9,
            padding: '7px 9px', background: '#FFFFFF80',
            borderRadius: 8, border: `1px solid ${mapelColor}12`,
          }}>
            {cp.deskripsi.length > 220 ? cp.deskripsi.slice(0, 220) + '…' : cp.deskripsi}
          </div>


          {/* Alignment note */}
          <div style={{
            marginTop: 10, padding: '7px 9px',
            background: `${mapelColor}10`, borderRadius: 7,
            border: `1px solid ${mapelColor}20`,
            fontSize: FS.xs, color: mapelColor, lineHeight: 1.5,
          }}>
            💡 Pastikan konten yang kamu buat selaras dengan Capaian Pembelajaran di atas untuk menjaga konsistensi kurikulum.
          </div>
        </div>
      )}
    </div>
  );
};

/* ── KontenCard ──────────────────────────────────────────────────── */
// kontenMap & setKontenMap di-lift ke parent (KelolaBelajarSection) agar
// handlePublish bisa membaca isi konten saat guru klik Publish.
const KontenCard = ({ type, config, approvedMap, setApprovedMap, kontenMap, setKontenMap }) => {
  const [open, setOpen] = useState(false);
  const [activeLevel, setActiveLevel] = useState('Low');
  const [editingKey, setEditingKey] = useState(null); // "type__level"
  const [editText, setEditText] = useState('');
  const [regenerating, setRegenerating] = useState(null);
  const [gamePreview, setGamePreview] = useState(null);

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

  const handleRegenerate = (lv) => {
    const key = `${type.id}__${lv}`;
    if (!editText.trim()) return;
    setRegenerating(key);
    setTimeout(() => {
      // Regenerasi: untuk tipe terstruktur gunakan placeholder object baru, untuk string concat label di depan.
      const baseRegen = generatePlaceholderKonten(type.id, lv, config);
      const regenResult = typeof baseRegen === 'object'
        ? baseRegen  // object shape (quiz_pg/quiz_essay/flashcard) -- label edit tidak bisa di-concat ke object
        : `[Diperbarui: "${editText}"]\n\n${baseRegen}`;
      setKontenMap(p => ({ ...p, [key]: regenResult }));
      setRegenerating(null);
      setEditingKey(null);
      setEditText('');
    }, 1800);
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
          {allApproved && <span style={{ fontSize: FS.xs, background: '#F0FFF4', color: C.green, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: '1px solid #9AE6B4' }}>✅ Disetujui</span>}
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
                      background: activeLevel === lv ? C.teal : approved ? '#F0FFF4' : C.white,
                      color: activeLevel === lv ? C.white : approved ? C.green : C.darkL,
                      border: `1.5px solid ${activeLevel === lv ? C.teal : approved ? '#9AE6B4' : C.tealXL}`,
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
                    <div style={{ fontSize: FS.md, color: C.slate }}>Meregenerasi konten…</div>
                  </div>
                ) : (
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
                              <div style={{ fontWeight: 700, color: C.dark, fontSize: FS.md, marginBottom: 6 }}>{i + 1}. {s.pertanyaan}</div>
                              {(s.pilihan || []).map((p, j) => (
                                <div key={j} style={{ paddingLeft: 12, marginBottom: 3 }}>
                                  <span style={{ fontSize: FS.md, color: p === s.jawaban ? C.green : C.darkL, fontWeight: p === s.jawaban ? 700 : 400 }}>
                                    {String.fromCharCode(97 + j)}) {p} {p === s.jawaban ? ' (jawaban)' : ''}
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
                          : (kontenMap[key].pertanyaan).map((p, i) => (
                            <div key={i} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: FS.md, color: C.darkL, lineHeight: 1.7 }}>{i + 1}. {p}</div>
                            </div>
                          ))
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
                    ) : (
                      <pre style={{ fontFamily: 'inherit', fontSize: FS.md, color: C.darkL, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {typeof kontenMap[key] === 'string' ? kontenMap[key] : JSON.stringify(kontenMap[key], null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Aksi baris */}
                {!isRegen && (
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
                    {!approved && !isEditing && (
                      <>
                        <button onClick={() => handleApprove(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #9AE6B4', background: '#F0FFF4', fontSize: FS.sm, color: C.green, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✓ Setuju
                        </button>
                        <button onClick={() => handleEdit(lv)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          ✏️ Edit
                        </button>
                      </>
                    )}
                    {approved && !isEditing && (
                      <button onClick={() => handleEdit(lv)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.sm, color: C.teal, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✏️ Ubah
                      </button>
                    )}
                    {approved && <span style={{ fontSize: FS.sm, color: C.green, fontWeight: 700 }}>✅ Disetujui</span>}
                  </div>
                )}

                {/* Form edit */}
                {isEditing && !isRegen && (
                  <div style={{ marginTop: 10, padding: 12, background: '#FFFBF0', borderRadius: 10, border: `1px solid ${C.amberL}` }}>
                    <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.orange, marginBottom: 8 }}>📝 Deskripsikan perubahan yang diinginkan</div>
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      placeholder="Contoh: Tambahkan lebih banyak contoh konkret, atau tingkatkan tingkat kesulitan soal"
                      style={{ ...INP, marginBottom: 8 }}
                      onFocus={e => e.target.style.borderColor = C.amber}
                      onBlur={e => e.target.style.borderColor = C.tealXL}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingKey(null); setEditText(''); }}
                        style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${C.tealXL}`, background: C.white, fontSize: FS.md, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Batal
                      </button>
                      <button onClick={() => handleRegenerate(lv)} disabled={!editText.trim()}
                        style={{ flex: 2, padding: '7px', borderRadius: 8, border: 'none', background: editText.trim() ? C.amber : '#E2E8F0', color: editText.trim() ? C.white : C.slate, fontSize: FS.md, fontWeight: 700, cursor: editText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                        🔄 Regenerasi
                      </button>
                    </div>
                  </div>
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
  // SEEDED_TEACHER_ID merujuk ke array TEACHERS (id: t1–t4).
  // ADMIN_GURU_INIT memakai id g1–g10. Guru yang sama (Bpk. Hendra) ada di keduanya.
  // Mapping: cari dulu di TEACHERS untuk dapat email/nama, lalu match ke ADMIN_GURU_INIT via email.
  const teacherFromTeachers = TEACHERS.find(t => t.id === SEEDED_TEACHER_ID);
  const guru = ADMIN_GURU_INIT.find(g =>
    g.id === 'g1' || // fallback langsung ke g1 (Hendra) jika email tidak tersedia
    (teacherFromTeachers?.name && g.nama.includes(teacherFromTeachers.name.split(',')[0].replace('Bpk. ', '').replace('Ibu ', '').trim()))
  ) || ADMIN_GURU_INIT[0]; // absolute fallback ke guru pertama
  const guruMapelIds = Array.isArray(guru?.mapelId) ? guru.mapelId : (guru?.mapelId ? [guru.mapelId] : []);
  const [jenjang, setJenjang] = useState('X');
  const [kelasId, setKelasId] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [elemenId, setElemenId] = useState('');
  const [materi, setMateri] = useState('');
  const [atpPoin, setAtpPoin] = useState(['']);

  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'result'
  const [approvedMap, setApprovedMap] = useState({});
  const [publishing, setPublishing] = useState(false);
  // kontenMap di-lift ke parent agar handlePublish bisa membaca isi konten saat guru Publish.
  const [kontenMap, setKontenMap] = useState({});
  // publishToast: tampilkan banner sukses singkat setelah publish berhasil
  const [publishToast, setPublishToast] = useState(null); // null | { mapelLabel, elemenLabel, publishedAt }

  const kelasList = ADMIN_KELAS_INIT.filter(k => k.tingkat === jenjang);
  const mapelList = ADMIN_MAPEL_LIST.filter(m => guruMapelIds.includes(m.id));
  const selectedMapel = mapelList.find(m => m.id === mapelId);
  const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
  const selectedElemen = elemenList.find(e => e.id === elemenId);

  const config = {
    jenjang, kelasId, mapelId,
    mapelLabel: selectedMapel?.label || '',
    elemenId, elemenLabel: selectedElemen?.label || elemenId,
    materi: materi || selectedElemen?.label || '',
    atp: atpPoin.filter(p => p.trim()).join('\n'),
  };

  // Semua konten disetujui = bisa publish
  const allApproved = KONTEN_TYPES.every(type => {
    const levels = type.hasLevel ? LEVELS : [''];
    return levels.every(lv => approvedMap[`${type.id}__${lv}`]);
  });

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
    // response: { tipe, level, content: { text }, generated_at }
    LEVELS.forEach(level => {
      promises.push(
        generateContent({ ...basePayload, tipe: 'bacaan', level })
          .then(res => {
            resultMap[`bacaan__${level}`] = res?.content?.text
              ? res.content.text
              : generatePlaceholderKonten('bacaan', level, config);
          })
          .catch(() => {
            resultMap[`bacaan__${level}`] = generatePlaceholderKonten('bacaan', level, config);
          })
      );
    });

    // POST /content/generate untuk mindmap (tanpa level)
    promises.push(
      generateContent({ ...basePayload, tipe: 'mindmap' })
        .then(res => {
          resultMap['mindmap__'] = res?.content?.content
            ? res.content.content
            : generatePlaceholderKonten('mindmap', '', config);
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
            })
            .catch(() => {
              resultMap[`${tipe}__${level}`] = generatePlaceholderKonten(tipe, level, config);
            })
        );
      });
    });

    // POST /game/generate untuk 3 level — Tim 4 deliver HTML
    // game.js payload: mapel_id, elemen_id, elemen_label, materi?, materi_id?, kelas_id, level, jenjang?
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
          level,
        })
          .then(res => {
            resultMap[`game__${level}`] = res?.game_id
              ? res
              : generatePlaceholderKonten('game', level, config);
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
    setPhase('result');
  };

  const handleBatal = () => {
    setPhase('form');
    setApprovedMap({});
    setPublishing(false);
    setKontenMap({});
    setAtpPoin(['']);
  };

  const handleReset = () => {
    setPhase('form');
    setApprovedMap({});
    setKontenMap({});
    setAtpPoin(['']);
  };

  const handlePublish = async () => {
    if (!allApproved || publishing) return;
    setPublishing(true);
    try {
      // Bangun konten_list dari semua KONTEN_TYPES yang disetujui guru
      // Field "tipe" (bukan "type") — konsisten dengan KontenItem typedef di content.js
      const snakeM = config.materi
        ? config.materi.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        : null;
      const kontenList = KONTEN_TYPES.flatMap(type => {
        const levels = type.hasLevel ? LEVELS : [''];
        return levels
          .filter(lv => approvedMap[`${type.id}__${lv}`])
          .map(lv => ({
            tipe: type.id,          // "tipe" bukan "type"
            level: lv || null,       // null untuk mindmap
            content: kontenMap[`${type.id}__${lv}`] || {},
            approved: true,
          }));
      });
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
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>Mata Pelajaran</label>
              <select value={mapelId} onChange={e => { setMapelId(e.target.value); setElemenId(''); }} style={{ ...INP }}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL}>
                <option value="">Pilih Mata pelajaran</option>
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
              </select>
            </div>

            {/* Capaian Pembelajaran — muncul setelah mapel dipilih */}
            {mapelId && selectedMapel && (
              <CapaianPembelajaranBox
                mapelId={mapelId}
                mapelColor={selectedMapel.color}
                mapelLabel={selectedMapel.label}
              />
            )}

            {/* Elemen */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 7 }}>Elemen</label>
              <select value={elemenId} onChange={e => setElemenId(e.target.value)} style={{ ...INP }}
                onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL}
                disabled={!mapelId}>
                <option value="">Pilih Elemen</option>
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
              {phase === 'result' ? 'Konten Digenerate' : 'Generate Konten'}
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
              <div style={{ fontSize: FS.md, marginTop: 4 }}>Isi form dan klik Generate Konten</div>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, border: `4px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .9s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: FS.lg, fontWeight: 600, color: C.dark }}>Sedang Generate Konten…</div>
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
              <KontenCard key={type.id} type={type} config={config} approvedMap={approvedMap} setApprovedMap={setApprovedMap} kontenMap={kontenMap} setKontenMap={setKontenMap} />
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
                style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: allApproved ? C.teal : '#CBD5E0', color: allApproved ? C.white : C.slate, fontSize: FS.base, fontWeight: 700, cursor: (allApproved && !publishing) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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