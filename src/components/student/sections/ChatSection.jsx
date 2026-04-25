/**
 * SR MVP — ChatSection (REVISED — Full Dummy Flow)
 * src/components/student/sections/ChatSection.jsx
 *
 * Alur:
 *  1. Izin kamera
 *  2. Chat dimulai di level MAPEL — AI greets + tampilkan daftar topik sebagai pesan chat
 *  3. Siswa klik/pilih topik → AI deliver materi topik itu
 *  4. Topik tersimpan di riwayat left panel
 *  5. Jika kembali ke mapel yang sama: greet sesuaikan + tampilkan riwayat topik
 *
 * Format Konten & Quiz: slide-out CENTER MODAL (bukan right sidebar overlay)
 * - Bisa generate ulang, riwayat tersimpan
 * - Quiz: bisa diulang, riwayat tersimpan
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Btn, Card, Divider } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { CONF_TYPES, SUBJECTS, MATERI_PER_ELEMEN } from '../../../data/masterData';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useStudentStore } from '../../../stores/studentStore';
import QuizModal, { getQuizV2 } from './QuizModal';


/* ─────────────────────────────────────────────────────────────────── */
const makeKey = (mapelId, sub) => `${mapelId}__${sub}`;
/* ─── Markdown renderer for AI messages ─────────────────────────── */
const renderMarkdown = (text) => {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  const parseLine = (line) => {
    // Bold **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<div key={i} style={{ height: 8 }} />); i++; continue; }

    // Heading
    if (line.startsWith('## ')) {
      elements.push(<div key={i} style={{ fontSize: FS.base, fontWeight: 700, color: C.dark, marginTop: 12, marginBottom: 4, borderBottom: '1px solid rgba(13,92,99,.1)', paddingBottom: 4 }}>{parseLine(line.slice(3))}</div>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<div key={i} style={{ fontSize: FS.xl, fontWeight: 800, color: C.dark, marginTop: 8, marginBottom: 6 }}>{parseLine(line.slice(2))}</div>);
      i++; continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const num = lines[i].match(/^(\d+)\./)[1];
        listItems.push(<div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <span style={{ color: '#0D5C63', fontWeight: 700, minWidth: 18, fontSize: 12 }}>{num}.</span>
          <span style={{ lineHeight: 1.6, fontSize: 13 }}>{parseLine(lines[i].replace(/^\d+\.\s/, ''))}</span>
        </div>);
        i++;
      }
      elements.push(<div key={`ol-${i}`} style={{ marginTop: 6, marginBottom: 6 }}>{listItems}</div>);
      continue;
    }

    // Bullet •
    if (line.startsWith('• ') || line.startsWith('* ') || line.startsWith('- ')) {
      const listItems = [];
      while (i < lines.length && (lines[i].startsWith('• ') || lines[i].startsWith('* ') || lines[i].startsWith('- '))) {
        listItems.push(<div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
          <span style={{ color: '#0D5C63', fontWeight: 700, fontSize: FS.lg, marginTop: 1 }}>·</span>
          <span style={{ lineHeight: 1.6, fontSize: 13 }}>{parseLine(lines[i].replace(/^[•*-]\s/, ''))}</span>
        </div>);
        i++;
      }
      elements.push(<div key={`ul-${i}`} style={{ marginTop: 4, marginBottom: 4 }}>{listItems}</div>);
      continue;
    }

    // Arrow lines → 
    if (line.startsWith('→ ')) {
      elements.push(<div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
        <span style={{ color: '#0D5C63', fontWeight: 700 }}>→</span>
        <span style={{ lineHeight: 1.6, fontSize: 13 }}>{parseLine(line.slice(2))}</span>
      </div>);
      i++; continue;
    }

    // Regular paragraph
    elements.push(<p key={i} style={{ lineHeight: 1.7, fontSize: FS.base, marginBottom: 2 }}>{parseLine(line)}</p>);
    i++;
  }
  return elements;
};

// Legacy simple renderer for user messages
const renderText = (text) => text.split('\n').map((line, i, arr) => (
  <p key={i} style={{ marginBottom: i < arr.length - 1 ? 5 : 0, lineHeight: 1.6 }}
    dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
));

const getOpeningMessage = (mapelId, mapelLabel, materiId, studiSessions, source) => {
  if (!materiId || !mapelId) {
    return [{
      id: Date.now(),
      role: 'ai',
      text: 'Terjadi kesalahan saat memuat sub-materi. Silakan kembali dan pilih materi kembali.',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      team: 'Tim 5',
    }];
  }

  const hasHistory = studiSessions && studiSessions.length > 0;
  const alreadyStudied = hasHistory && studiSessions.find(s => s.sub === materiId);

  // ── 1. Sapaan sesuai konteks ──────────────────────────────────────────
  let sapaan;
  if (alreadyStudied) {
    sapaan = `Halo lagi, Budi! 👋 Senang kamu kembali melanjutkan belajar **${materiId}** di ${mapelLabel}.`;
  } else if (source === 'pretest') {
    sapaan = `Halo Budi! 🎯 Berdasarkan hasil pretestmu, kamu perlu penguatan di **${materiId}** — ${mapelLabel}. Tenang, Mentor AI akan memandu kamu step-by-step!`;
  } else if (source === 'progress') {
    sapaan = `Halo Budi! 📈 Kita lanjutkan progresmu di **${materiId}** — ${mapelLabel}. Semangat terus ya!`;
  } else {
    // search / default
    sapaan = `Halo Budi! 😊 Kamu memilih untuk belajar **${materiId}** di ${mapelLabel}. Pilihan yang bagus!`;
  }

  // ── 2. Materi topik ───────────────────────────────────────────────────
  const key = `${mapelId}__${materiId}`;
  const materi =
    `Deskripsi Konsep **${materiId}** At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.\n\n**Berikut adalah poin-poin yang perlu kamu perhatikan:**\n
1. Primus Inter Pares: Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.\n
2. Secundus Operandi: Omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.\n
3. Tertius Progressio: Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.`;

  // ── 3. Pertanyaan pancingan critical thinking ─────────────────────────
  const ctq =
    `Sebelum kita lanjutkan lebih dalam — menurutmu, di mana kamu pernah menjumpai konsep **${materiId}** dalam kehidupan sehari-hari? Coba pikirkan satu contoh nyata!`;

  const fullText = `${sapaan}\n\n${materi}\n\n💭 **Pertanyaan untuk kamu:** ${ctq}`;

  return [
    {
      id: Date.now(),
      role: 'ai',
      text: fullText,
      isMateri: true,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      team: 'Tim 5',
    },
  ];
};

/* ═══════════════ [TIM 5] QUIZ DISCUSSION OPENER ══════════════════
 * Dipanggil saat siswa klik "Tanya Kak Nusa" dari detail riwayat quiz.
 * TIDAK langsung mengevaluasi — AI tanya dulu soal mana yang ingin dibahas.
 * Fase 3: fungsi ini digantikan stream dari Tim 5.
 * ═══════════════════════════════════════════════════════════════════ */
const buildQuizDiscussionOpener = ({ quizType, score, correct, total, materiId, wrongItems, essayAnswers, soalSnapshot }) => {
  if (quizType === 'essay') {
    const answeredCount = essayAnswers ? Object.values(essayAnswers).filter(v => v?.trim()).length : 0;
    return `📋 **Kak Nusa siap membahas jawaban essaymu — ${materiId}**\n\nKamu sudah mengerjakan **${answeredCount} soal essay**. Bagus! Kak Nusa ingin membantu kamu mendalami lebih jauh.\n\n✍️ **Soal mana yang ingin kamu bahas dulu?**\n${(soalSnapshot || []).map((s, i) => `${i + 1}. *${s.soal.slice(0, 80)}${s.soal.length > 80 ? '…' : ''}*`).join('\n')}\n\nTulis nomor soal atau tanya hal spesifik yang membingungkanmu — Kak Nusa akan memberikan feedback mendalam pada jawabanmu! 😊`;
  }

  // MC
  const wrongCount = wrongItems?.length ?? 0;
  const pass = score >= 70;
  const scoreInfo = `Skor kamu **${score}/100** (${correct}/${total} soal benar).`;

  if (wrongCount === 0) {
    return `🌟 **Semua jawaban benar di quiz ${materiId}!** ${scoreInfo}\n\nLuar biasa! Meski sudah sempurna, apakah ada **konsep** dari topik ini yang ingin kamu perdalam atau tanyakan? Kak Nusa siap berdiskusi lebih jauh. 😊`;
  }

  const wrongList = (wrongItems || []).map((w, i) => `${i + 1}. *${w.soal.slice(0, 80)}${w.soal.length > 80 ? '…' : ''}*`).join('\n');
  const prompt = pass
    ? `Ada **${wrongCount} soal** yang jawabannya kurang tepat:`
    : `Ada **${wrongCount} soal** yang perlu kita bahas:`;

  return `💬 **Kak Nusa siap membahas quiz ${materiId}** — ${scoreInfo}\n\n${prompt}\n${wrongList}\n\n📌 **Soal nomor berapa yang ingin kamu bahas dulu?** Tulis nomornya atau langsung tanyakan bagian yang membingungkan — Kak Nusa akan membantu menjelaskan! 🚀`;
};

const getConfContent = (materiId, mapelLabel) => ({
  mindmap: {
    generated: true, ts: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    tree: {
      label: `🧠 ${materiId}`,
      color: '#2D3E50',
      children: [
        {
          label: 'Konsep Utama',
          children: [
            { label: 'Definisi & Pengertian' },
            { label: 'Ciri-ciri Khusus' },
            { label: 'Contoh Nyata' },
          ]
        },
        {
          label: 'Sub-topik',
          children: [
            { label: 'Poin Utama 1' },
            { label: 'Poin Utama 2' },
            { label: 'Poin Utama 3' },
          ]
        },
        {
          label: 'Penerapan',
          children: [
            { label: 'Soal Latihan' },
            { label: 'Kehidupan Sehari-hari' },
          ]
        },
      ]
    }
  },
  flashcard: {
    generated: true, ts: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    cards: [
      { depan: `Apa definisi dari ${materiId}?`, belakang: `${materiId} adalah konsep penting dalam ${mapelLabel} yang mencakup teori dasar, contoh aplikasi, dan relevansinya dalam kehidupan.` },
      { depan: `Sebutkan ciri-ciri utama ${materiId}!`, belakang: `Ciri utama: (1) Memiliki komponen spesifik, (2) Dapat diidentifikasi berdasarkan karakteristiknya, (3) Saling berkaitan dengan konsep lain.` },
      { depan: `Bagaimana ${materiId} diterapkan dalam kehidupan?`, belakang: `Penerapan ${materiId} dapat ditemui dalam konteks sehari-hari seperti alam, teknologi, dan fenomena sosial di sekitar kita.` },
    ],
  },
});

/* ═══════════════ MIND MAP SVG ════════════════════════════════════ */
const NODE_W = 130, NODE_H = 36, NODE_R = 10;
const LEVEL_GAP_X = 160, LEVEL_GAP_Y = 52;

function layoutTree(node, depth = 0, startY = 0) {
  const children = node.children || [];
  if (children.length === 0) {
    return { ...node, depth, y: startY, height: NODE_H + 14, subtreeH: NODE_H + 14, layoutChildren: [] };
  }
  let curY = startY;
  const laid = children.map(c => {
    const n = layoutTree(c, depth + 1, curY);
    curY += n.subtreeH;
    return n;
  });
  const totalH = laid.reduce((s, n) => s + n.subtreeH, 0);
  const selfY = startY + (totalH - NODE_H) / 2;
  return { ...node, depth, y: selfY, height: NODE_H + 14, subtreeH: totalH, layoutChildren: laid };
}

function collectNodes(node, nodes = [], edges = []) {
  nodes.push(node);
  (node.layoutChildren || []).forEach(child => {
    edges.push({ from: node, to: child });
    collectNodes(child, nodes, edges);
  });
  return { nodes, edges };
}

const MindMapView = ({ tree, color, bgLight, materiId }) => {
  const [scale, setScale] = useState(0.75); // mulai sedikit zoom out agar muat
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  if (!tree) return <div style={{ padding: 24, color: '#718096' }}>Data mind map tidak tersedia.</div>;

  const laid = layoutTree(tree, 0, 0);
  const { nodes, edges } = collectNodes(laid);

  const padding = 24;
  const maxDepth = Math.max(...nodes.map(n => n.depth));
  const svgW = padding * 2 + (maxDepth + 1) * LEVEL_GAP_X + NODE_W;
  const minY = Math.min(...nodes.map(n => n.y));
  const maxY = Math.max(...nodes.map(n => n.y + NODE_H));
  const svgH = maxY - minY + padding * 2 + 20;

  const nodeX = (depth) => padding + depth * LEVEL_GAP_X;
  const nodeY = (n) => n.y - minY + padding;
  const nodeCY = (n) => nodeY(n) + NODE_H / 2;

  const depthColors = ['#2D3E50', '#0D5C63', '#4A5568', '#DD6B20', '#C53030'];
  const getColor = (depth) => depthColors[depth % depthColors.length];

  // ── Zoom via scroll wheel ──
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale(s => Math.min(2, Math.max(0.3, s + delta)));
  };

  // ── Pan via drag ──
  const handleMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const handleMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handleMouseUp = () => { setDragging(false); dragStart.current = null; };

  // ── Reset view ──
  const handleReset = () => { setScale(0.75); setOffset({ x: 0, y: 0 }); };

  return (
    <div>
      {/* Title + kontrol zoom */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 600, color: C.dark, flex: 1 }}>
          🧠 {materiId}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))}
            style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #D4F0F3', background: '#fff', cursor: 'pointer', fontSize: FS.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0D5C63' }}>+</button>
          <span style={{ fontSize: FS.xs, color: '#718096', minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))}
            style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #D4F0F3', background: '#fff', cursor: 'pointer', fontSize: FS.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0D5C63' }}>−</button>
          <button onClick={handleReset}
            style={{ height: 26, padding: '0 8px', borderRadius: 6, border: '1.5px solid #D4F0F3', background: '#fff', cursor: 'pointer', fontSize: FS.xs, color: '#0D5C63', fontWeight: 600, fontFamily: 'inherit' }}>Reset</button>
        </div>
      </div>

      {/* Canvas area — fixed height, overflow hidden, draggable */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          background: bgLight,
          borderRadius: 12,
          height: 420,
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'grab',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* SVG dengan transform scale + translate */}
        <div style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'top left',
          display: 'inline-block',
        }}>
          <svg width={svgW} height={svgH} style={{ display: 'block' }}>
            {edges.map((e, i) => {
              const x1 = nodeX(e.from.depth) + NODE_W;
              const y1 = nodeCY(e.from);
              const x2 = nodeX(e.to.depth);
              const y2 = nodeCY(e.to);
              const mx = (x1 + x2) / 2;
              return (
                <path key={i}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={getColor(e.from.depth)}
                  strokeWidth={e.from.depth === 0 ? 2.5 : 1.5}
                  strokeOpacity={0.5}
                />
              );
            })}
            {nodes.map((n, i) => {
              const x = nodeX(n.depth);
              const y = nodeY(n);
              const c = getColor(n.depth);
              const isRoot = n.depth === 0;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={NODE_R} ry={NODE_R}
                    fill={isRoot ? c : `${c}18`} stroke={c} strokeWidth={isRoot ? 0 : 1.5} />
                  <text
                    x={x + NODE_W / 2} y={y + NODE_H / 2 + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={isRoot ? '#fff' : c}
                    fontSize={isRoot ? 12 : 11} fontWeight={isRoot ? 700 : 600}
                    fontFamily="system-ui,sans-serif" style={{ userSelect: 'none' }}>
                    {n.label && n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hint overlay di pojok bawah */}
        <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: FS.xs, color: '#718096', background: 'rgba(255,255,255,.75)', borderRadius: 6, padding: '3px 7px', pointerEvents: 'none' }}>
          scroll zoom · drag pan
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 8, fontSize: FS.xs, color: '#718096', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[...new Set(nodes.map(n => n.depth))].map(d => (
          <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: depthColors[d % depthColors.length], display: 'inline-block' }} />
            <span>{d === 0 ? 'Topik Utama' : d === 1 ? 'Cabang Utama' : 'Sub-cabang'}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════ FLASHCARD 3D FLIP ══════════════════════════════ */
const FlashcardView = ({ cards, color, bgLight, materiId, flashIdx, setFlashIdx, flashFlipped, setFlashFlipped }) => {
  const total = cards.length;
  const card = cards[flashIdx] || cards[0];

  const handleFlip = () => setFlashFlipped(f => !f);
  const handlePrev = () => { setFlashFlipped(false); setTimeout(() => setFlashIdx(i => Math.max(0, i - 1)), 50); };
  const handleNext = () => { setFlashFlipped(false); setTimeout(() => setFlashIdx(i => Math.min(total - 1, i + 1)), 50); };

  return (
    <div>
      <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 6 }}>🃏 Flashcard: {materiId}</div>
      <div style={{ fontSize: FS.md, color: '#718096', marginBottom: 20 }}>Klik kartu untuk melihat jawaban · Kartu {flashIdx + 1} dari {total}</div>

      {/* 3D Card */}
      <div
        onClick={handleFlip}
        style={{
          perspective: '900px',
          cursor: 'pointer',
          marginBottom: 20,
          userSelect: 'none',
        }}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          height: 220,
          transformStyle: 'preserve-3d',
          transform: flashFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.55s cubic-bezier(.4,0,.2,1)',
        }}>
          {/* Front face */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 18,
            background: `linear-gradient(135deg, ${color}18, ${color}08)`,
            border: `2px solid ${color}44`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,.1)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>❓</div>
            <div style={{ fontSize: FS.xl, fontWeight: 700, color: C.dark, lineHeight: 1.6 }}>{card.depan}</div>
            <div style={{ position: 'absolute', bottom: 14, fontSize: FS.sm, color: color, fontWeight: 600, opacity: 0.7 }}>
              Klik untuk melihat jawaban →
            </div>
          </div>

          {/* Back face */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 18,
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            border: `2px solid ${color}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 32,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,.15)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 14 }}>💡</div>
            <div style={{ fontSize: FS.lg, color: '#fff', lineHeight: 1.7, fontWeight: 500 }}>{card.belakang}</div>
            <div style={{ position: 'absolute', bottom: 14, fontSize: FS.sm, color: 'rgba(255,255,255,.65)', fontWeight: 600 }}>
              ← Klik untuk balik lagi
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={handlePrev} disabled={flashIdx === 0}
          style={{ padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${color}44`, background: flashIdx === 0 ? '#f7fafc' : '#fff', color: flashIdx === 0 ? '#a0aec0' : color, fontWeight: 700, fontSize: FS.base, cursor: flashIdx === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          ← Prev
        </button>

        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {cards.map((_, ci) => (
            <button key={ci} onClick={() => { setFlashFlipped(false); setTimeout(() => setFlashIdx(ci), 50); }}
              style={{ width: ci === flashIdx ? 22 : 8, height: 8, borderRadius: 99, background: ci === flashIdx ? color : `${color}40`, border: 'none', cursor: 'pointer', transition: 'all .3s', padding: 0 }} />
          ))}
        </div>

        <button onClick={handleNext} disabled={flashIdx === total - 1}
          style={{ padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${color}44`, background: flashIdx === total - 1 ? '#f7fafc' : '#fff', color: flashIdx === total - 1 ? '#a0aec0' : color, fontWeight: 700, fontSize: FS.base, cursor: flashIdx === total - 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          Next →
        </button>
      </div>

      <div style={{ marginTop: 16, background: '#EBF8FF', borderRadius: 10, padding: '10px 14px', fontSize: FS.sm, color: '#2B6CB0', display: 'flex', gap: 8 }}>
        <span>💡</span><span>Gunakan kartu ini untuk latihan hafalan aktif. Coba jawab dulu sebelum membalik!</span>
      </div>
    </div>
  );
};

/* ═══════════════ CENTER MODAL (Format Konten & Quiz) ════════════ */
const CenterModal = ({ children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    onClick={onClose}>
    <div className="bounce-in" onClick={e => e.stopPropagation()}
      style={{ background: C.white, borderRadius: 18, width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

/* ═══════════════ MAIN ChatSection ══════════════════════════════ */
const ChatSection = ({
  chatMateri, setChatMateri,
  msgsByKey, setMsgsByKey,
  input, setInput, typing, setTyping,
  confContent, setConfContent, confOverlay, setConfOverlay, confGenerating, setConfGenerating,
  flashIdx, setFlashIdx, flashFlipped, setFlashFlipped,
  quizActive, setQuizActive, quizAnswers, setQuizAnswers, quizSubmitted, setQuizSubmitted,
  progressData, setProgressData,
  messagesEnd, chatFileRef, chatAttachments, setChatAttachments,
  setActivePage,
  camGranted, setCamGranted,
  addRecentActivity,
  openGame,
}) => {
  const [materiId, setSubMateri] = useState(null);
  const [openDrops, setOpenDrops] = useState({});
  const [confModal, setConfModal] = useState(null); // { type }
  const [pendingQuizResult, setPendingQuizResult] = useState(null);

  const [quizHistoryModal, setQuizHistoryModal] = useState(null);
  // Quiz modal: dua tombol terpisah (MC dan Essay), masing-masing bisa di-klik ulang untuk soal baru
  const [mcModal, setMcModal] = useState(false);
  const [essayModal, setEssayModal] = useState(false);
  // Saat "Ulangi" dari riwayat, buka modal dengan soal snapshot yang sama
  const [retrySnapshot, setRetrySnapshot] = useState(null); // { type, soal }
  // Game panel — full container game dari Tim 4

  const sessionStart = useRef(null);
  const textareaRef = useRef(null);

  // [TIM 5] State untuk typing indicator pasca-kuis & status analisis
  const [quizAnalysisTyping, setQuizAnalysisTyping] = useState(false);
  const analysisProcessedRef = useRef(false); // mencegah double-fire

  // [TIM 5] Subscribe ke store untuk needsQuizAnalysis
  const needsQuizAnalysis = useStudentStore(s => s.needsQuizAnalysis);
  const lastQuizResult = useStudentStore(s => s.lastQuizResult);
  const clearQuizAnalysis = useStudentStore(s => s.clearQuizAnalysis);
  // quizHistory & levelMap dipindah ke store agar persisten saat keluar/masuk chatbot
  const quizHistory = useStudentStore(s => s.quizHistory);
  const setQuizHistory = useStudentStore(s => s.setQuizHistory);
  const levelMap = useStudentStore(s => s.levelMap);
  const setLevelMap = useStudentStore(s => s.setLevelMap);
  const rightPanelWidth = quizHistoryModal ? 380 : confModal ? 380 : 238;

  /* ── [TIM 5] Context Injection Pasca-Kuis ──────────────────────────
   * Setiap kali needsQuizAnalysis berubah jadi true dan ada quiz result,
   * kita susun pesan pembuka diskusi dari Kak Nusa — bukan langsung evaluasi,
   * tapi menanyakan soal mana yang ingin dibahas dulu.
   * Fase 3: digantikan stream dari Tim 5.
   */
  useEffect(() => {
    if (!needsQuizAnalysis || !lastQuizResult || analysisProcessedRef.current) return;
    if (!camGranted) return;
    if (!activeKey) return;

    analysisProcessedRef.current = true;
    clearQuizAnalysis();
    setQuizAnalysisTyping(true);

    const { quizType, score, correct, total, materiId, mapelLabel, wrongItems, essayAnswers, soalSnapshot } = lastQuizResult;

    const discussionDelay = 1200 + Math.random() * 800;

    setTimeout(() => {
      const aiText = buildQuizDiscussionOpener({
        quizType: quizType || 'mc',
        score, correct, total, materiId, mapelLabel,
        wrongItems, essayAnswers, soalSnapshot,
      });

      const aiMsg = {
        id: Date.now() + 2,
        role: 'ai',
        text: aiText,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        team: 'Tim 5',
        isQuizAnalysis: true,
      };

      setMsgsByKey(prev => ({
        ...prev,
        [activeKey]: [...(prev[activeKey] || []), aiMsg],
      }));

      setQuizAnalysisTyping(false);
      analysisProcessedRef.current = false;
      setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, discussionDelay);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsQuizAnalysis]);

  /* ── TTS State (per-message, lokal) ──────────────────────────── */
  const [speakingMsgId, setSpeakingMsgId] = useState(null); // id pesan yang sedang disuarakan
  const [feedbacks, setFeedbacks] = useState({});           // { [msgId]: 'like' | 'dislike' }
  const synthRef = useRef(null);

  const speakMsg = useCallback((msgId, text) => {
    // Hentikan jika sedang bicara pesan yang sama (toggle)
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    // Hentikan suara sebelumnya
    window.speechSynthesis.cancel();
    // Strip markdown symbols sebelum disuarakan
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/#{1,3}\s/g, '')
      .replace(/[•→\-]\s/g, '')
      .replace(/\n+/g, '. ');
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'id-ID';
    utt.rate = 0.95;
    utt.pitch = 1;
    // Pilih suara bahasa Indonesia jika tersedia
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id')) || voices.find(v => v.lang.startsWith('en'));
    if (idVoice) utt.voice = idVoice;
    utt.onend = () => setSpeakingMsgId(null);
    utt.onerror = () => setSpeakingMsgId(null);
    synthRef.current = utt;
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utt);
  }, [speakingMsgId]);

  const handleFeedback = useCallback((msgId, val) => {
    setFeedbacks(prev => {
      // Toggle off jika klik sama
      if (prev[msgId] === val) {
        const next = { ...prev };
        delete next[msgId];
        return next;
      }
      return { ...prev, [msgId]: val };
    });
  }, []);

  // Stop TTS saat unmount / ganti topik
  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);
  useEffect(() => {
    window.speechSynthesis.cancel();
    setSpeakingMsgId(null);
  }, [materiId]);

  /* ── STT State (inline di input bar) ─────────────────────────── */
  const [sttListening, setSttListening] = useState(false);
  const [sttSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recognitionRef = useRef(null);

  const toggleSTT = useCallback(() => {
    if (!sttSupported) return;
    if (sttListening) {
      recognitionRef.current?.stop();
      setSttListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'id-ID';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = () => setSttListening(true);
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    rec.onend = () => setSttListening(false);
    rec.onerror = () => setSttListening(false);
    recognitionRef.current = rec;
    rec.start();
  }, [sttListening, sttSupported, setInput]);

  // Stop STT saat unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  /* ── Anti-Cheating Monitor ────────────────────────────────────── */
  // Flag untuk membedakan exit resmi (klik tombol Back) vs exit paksa
  const isExitingSession = useRef(false);
  // Flag untuk membedakan saat file dialog OS terbuka (beberapa browser trigger fullscreenchange)
  const isOpeningFileDialog = useRef(false);
  const [violationModal, setViolationModal] = useState(null); // { detail, count }
  const violationCount = useRef(0);

  // WebSocket untuk kirim event ke dashboard guru
  const { liveStudents: _ls, ...wsHook } = useWebSocket({ kelasId: 'kelas1', guruId: 'g1', enabled: false });
  // Kirim violation event langsung ke pushEvent via custom approach — kita gunakan window event
  const sendViolationToTeacher = useCallback((detail) => {
    // Dispatch custom event yang bisa di-listen oleh MonitoringSection
    window.dispatchEvent(new CustomEvent('sr_student_violation', {
      detail: {
        type: 'student_violation',
        siswa: { id: 'siswa1', nama: 'Budi Santoso', avatar: 'BS' },
        payload: { detail, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }
    }));
  }, []);

  const handleViolation = useCallback((detail) => {
    // Gerbang utama: abaikan jika sedang proses exit resmi
    if (isExitingSession.current) return;
    // Abaikan jika sedang membuka file dialog OS (beberapa browser picu fullscreenchange)
    if (isOpeningFileDialog.current) return;
    violationCount.current += 1;
    setViolationModal({ detail, count: violationCount.current });
    sendViolationToTeacher(detail);
  }, [sendViolationToTeacher]);

  // Kembali ke fullscreen setelah file dialog / violation modal ditutup
  const reEnterFullscreen = useCallback(() => {
    if (!document.fullscreenElement && !isExitingSession.current) {
      document.documentElement.requestFullscreen().catch(() => { });
    }
  }, []);

  // Fungsi safe exit — dipanggil tombol Kembali
  const handleSafeBack = useCallback(() => {
    isExitingSession.current = true;
    // Kirim status inactive ke teacher
    window.dispatchEvent(new CustomEvent('sr_student_violation', {
      detail: {
        type: 'student_inactive',
        siswa: { id: 'siswa1', nama: 'Budi Santoso', avatar: 'BS' },
        payload: { materiId: 'exit' },
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      }
    }));
    // Keluar fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    // Navigasi
    setActivePage('dashboard');
    setChatMateri(null);
    setSubMateri(null);
  }, [setActivePage, setChatMateri]);

  // Setup & cleanup anti-cheating listeners saat camGranted aktif
  useEffect(() => {
    if (!camGranted) return;
    isExitingSession.current = false; // reset saat sesi baru dimulai

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        // Abaikan jika sedang buka file dialog — bukan pelanggaran
        if (isOpeningFileDialog.current) return;
        handleViolation('Keluar Fullscreen');
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      // Saat unmount, pastikan keluar dari fullscreen
      if (document.fullscreenElement && isExitingSession.current) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, [camGranted, handleViolation]);

  /* Sync materiId dari chatMateri prop */
  useEffect(() => {
    if (chatMateri?.materiId) setSubMateri(chatMateri.materiId);
    else setSubMateri(null);
  }, [chatMateri?.mapelId, chatMateri?.materiId]);

  useEffect(() => {
    if (chatMateri) {
      if (addRecentActivity) {
        addRecentActivity({
          type: 'chat',
          mapelIcon: chatMateri.mapelIcon,
          mapelColor: chatMateri.mapelColor,
          label: `Memulai pelajaran ${chatMateri.materiId || chatMateri.mapelLabel}`,
          ts: Date.now(),
        });
      }
      // Pastikan progress masuk meski quiz belum dikerjakan
      const store = useStudentStore.getState();
      if (chatMateri.materiId) store.markTopicOngoing(chatMateri);
    }
  }, []); // hanya saat mount

  const toggleDrop = (t) => setOpenDrops(p => ({ ...p, [t]: !p[t] }));

  if (!chatMateri) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>💬</div>
      <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark }}>Pilih materi dulu</div>
      <div style={{ fontSize: FS.base, color: C.slate, marginBottom: 8 }}>Klik "Mulai Belajar" atau "Lanjutkan" dari Dashboard</div>
      <Btn variant="primary" onClick={() => setActivePage('dashboard')}>← Ke Dashboard</Btn>
    </div>
  );

  /* ── Derived values (post-camera) ── */
  const mapelKey = `mapel__${chatMateri.mapelId}`;

  /* ── Riwayat topik per mapel ── */
  const getSessions = () =>
    Object.keys(msgsByKey)
      .filter(k => k.startsWith(chatMateri.mapelId + '__'))
      .map(k => {
        const sub = k.split('__').slice(1).join('__');
        const done_ = progressData.sudahSelesai.find(m => m.mapelId === chatMateri.mapelId && m.materiId === sub);
        const ong_ = progressData.belumSelesai.find(m => m.mapelId === chatMateri.mapelId && m.materiId === sub);
        return { k, sub, score: done_?.quizScore ?? null, done: !!done_, ongoing: !!ong_ };
      });

  const sessions = getSessions();

  /* ── Pilih topik dari chat ── */
  // handlePickTopik — dipertahankan untuk kompatibilitas internal (deep link dari riwayat sesi kiri)
  // Siswa tidak lagi memilih topik dari dalam chat (UI tombol topik sudah dihapus),
  // tapi fungsi ini masih dipakai saat klik riwayat topik di panel kiri.
  const handlePickTopik = (materiId) => {
    const k = makeKey(chatMateri.mapelId, materiId);
    setSubMateri(materiId);
    setChatMateri(p => ({ ...p, materiId: materiId }));

    // Inisialisasi pesan pembuka jika belum ada untuk sub-materi ini
    if (!msgsByKey[k]) {
      const sess = Object.keys(msgsByKey)
        .filter(key => key.startsWith(chatMateri.mapelId + '__'))
        .map(key => ({ k: key, sub: key.split('__').slice(1).join('__') }));
      setMsgsByKey(p => ({
        ...p,
        [k]: getOpeningMessage(chatMateri.mapelId, chatMateri.mapelLabel, materiId, sess, 'history')
      }));
    }

    setQuizActive(false); setQuizAnswers({}); setQuizSubmitted(false); setConfOverlay(null);
    if (!sessionStart.current) sessionStart.current = Date.now();
  };

  /* ── State setelah kamera diizinkan ── */
  useEffect(() => {
    if (!camGranted || !chatMateri) return;

    // Siswa selalu masuk dengan topik yang sudah dipilih dari luar (rekomendasi / progress / search)
    if (chatMateri.materiId) {
      const topikKey = makeKey(chatMateri.mapelId, chatMateri.materiId);

      // Inisialisasi 1 pesan pembuka AI jika topik ini belum pernah dibuka
      if (!msgsByKey[topikKey]) {
        const sess = Object.keys(msgsByKey)
          .filter(k => k.startsWith(chatMateri.mapelId + '__'))
          .map(k => ({ k, sub: k.split('__').slice(1).join('__') }));

        setMsgsByKey(p => ({
          ...p,
          [topikKey]: getOpeningMessage(
            chatMateri.mapelId, chatMateri.mapelLabel,
            chatMateri.materiId,
            sess,
            chatMateri.source || null
          )
        }));
      }
      setSubMateri(chatMateri.materiId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camGranted, chatMateri?.mapelId, chatMateri?.materiId]);

  /* ── Active chat key & messages ── */
  const activeKey = materiId ? makeKey(chatMateri.mapelId, materiId) : mapelKey;
  // Ambil messages dari state — fallback ke loading placeholder jika belum ada (useEffect akan segera mengisinya)
  const rawMsgs = msgsByKey[activeKey];
  // Fallback: useEffect akan segera mengisi state, ini hanya placeholder sementara
  const msgs = rawMsgs && rawMsgs.length > 0
    ? rawMsgs
    : materiId
      ? getOpeningMessage(chatMateri.mapelId, chatMateri.mapelLabel, materiId, sessions, null)
      : [];
  const kConf = confContent[activeKey] || {};
  const hasConf = CONF_TYPES.some(ct => kConf[ct.type]?.generated);
  const quizData = getQuizV2(activeKey);
  const quizSoal = quizData.multipleChoice; // untuk review di panel detail riwayat
  const quizResultRecord = progressData.sudahSelesai.find(m => m.mapelId === chatMateri.mapelId && m.materiId === materiId);
  const allHistory = quizHistory[activeKey] || [];
  const mcHistory = allHistory.filter(r => r.type === 'mc' || !r.type); // backward compat
  const essayHistory = allHistory.filter(r => r.type === 'essay');
  // REVISI: nilai yang dipakai = nilai terbaru (1 riwayat per level, sudah di-replace saat submit)
  const mcLatestRecord = mcHistory.length > 0 ? mcHistory[mcHistory.length - 1] : null;
  const mcLatestScore = mcLatestRecord?.score ?? null;

  /* ── Send message ── */
  const sendMsg = () => {
    if (!input.trim() && !chatAttachments.length) return;
    const userMsg = { id: Date.now(), role: 'user', text: input, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
    setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), userMsg] }));
    setInput(''); setTyping(true); if (textareaRef.current) { textareaRef.current.style.height = '38px'; }
    setTimeout(() => {
      const topikCtx = materiId || chatMateri.mapelLabel;
      const aiReply = {
        id: Date.now() + 1,
        role: 'ai',
        text: `Pertanyaan bagus tentang **${topikCtx}**! 😊\n\nMari kita telaah lebih dalam. Konsep kunci yang perlu dipahami:\n\n1. Pahami definisi dasarnya terlebih dahulu\n2. Lihat contoh nyata di sekitar kita\n3. Coba kerjakan soal latihan untuk memastikan pemahamanmu\n\nApa yang masih membingungkan?`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        team: 'Tim 5'
      };
      setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), aiReply] }));
      setTyping(false);
      setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, 1100);
  };

  /* ── Generate Format Konten ── */
  const generateConf = (type) => {
    setConfGenerating(true);
    setTimeout(() => {
      const content = getConfContent(materiId || chatMateri.mapelLabel, chatMateri.mapelLabel);
      setConfContent(p => ({ ...p, [activeKey]: { ...(p[activeKey] || {}), [type]: content[type] } }));
      setConfGenerating(false);
    }, 1500);
  };

  /* ── Submit Quiz (dipanggil oleh QuizModal via prop onSubmit) ── */
  const handleQuizSubmit = (result) => {
    const { type, score, correct, total, wrongItems, answers, essayAnswers, soalSnapshot } = result;

    // REVISI: Riwayat quiz per level hanya simpan 1 (yang terbaru).
    // Jika sudah ada riwayat untuk level & tipe yang sama, REPLACE (bukan append).
    const currentLevelForRecord = levelMap[activeKey] || chatMateri?.level || 'low';
    const newRecord = {
      type,                 // 'mc' | 'essay'
      soalSnapshot,
      score,
      level: currentLevelForRecord,
      ts: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      correct,
      total,
      answers,
      wrongItems,
      essayAnswers,
    };

    setQuizHistory(p => {
      const existing = p[activeKey] || [];
      // Hapus riwayat lama untuk level + tipe yang sama, lalu tambahkan yang baru
      const filtered = existing.filter(r =>
        !((r.type === type || (!r.type && type === 'mc')) && (r.level || 'low') === currentLevelForRecord)
      );
      return { ...p, [activeKey]: [...filtered, newRecord] };
    });

    // Tutup modal setelah submit
    if (type === 'mc') setMcModal(false);
    if (type === 'essay') setEssayModal(false);
    setRetrySnapshot(null);

    // Update progress hanya untuk MC (essay tidak punya skor numerik)
    if (materiId && type === 'mc') {
      const latestScore = score ?? 0;
      // Nilai yang dipakai = nilai terbaru (bukan best)
      const progressRecord = { id: `q_${Date.now()}`, ...chatMateri, materiId, progress: 100, lastChat: 'Baru saja', confDone: [], quizDone: true, quizScore: latestScore, level: currentLevelForRecord };
      setProgressData(p => ({
        sudahSelesai: [...p.sudahSelesai.filter(m => !(m.mapelId === chatMateri.mapelId && m.materiId === materiId)), progressRecord],
        belumSelesai: p.belumSelesai.filter(m => !(m.mapelId === chatMateri.mapelId && m.materiId === materiId)),
      }));

      // Naik level jika nilai >= KKM (80) dan belum level max
      const KKM = 80;
      const LEVEL_ORDER_LOCAL = ['low', 'mid', 'high'];
      const LEVEL_LABELS_LOCAL = { low: 'Low', mid: 'Mid', high: 'High' };
      const curLvlIdx = LEVEL_ORDER_LOCAL.indexOf(currentLevelForRecord);
      const nxtLvl = LEVEL_ORDER_LOCAL[Math.min(curLvlIdx + 1, LEVEL_ORDER_LOCAL.length - 1)];
      const isAtMax = currentLevelForRecord === 'high';

      if (latestScore >= KKM && !isAtMax) {
        setLevelMap(p => ({ ...p, [activeKey]: nxtLvl }));

        // Persist level baru ke studentStore agar Progress Section ikut terupdate
        const store = useStudentStore.getState();
        const elemenId = chatMateri?.elemenId;
        if (elemenId) {
          // Cek apakah elemen ini punya breakdown materi di kurikulum
          const materiPerElemen = (MATERI_PER_ELEMEN[chatMateri.mapelId] || {})[elemenId] || [];
          const hasMateriBreakdown = materiPerElemen.length > 0;

          if (hasMateriBreakdown && materiId) {
            // Elemen dengan breakdown materi → update level per materi
            store.setMateriLevel(chatMateri.mapelId, elemenId, materiId, nxtLvl);
          } else {
            // Elemen tanpa breakdown materi → update level elemen langsung
            store.setElemenLevel(chatMateri.mapelId, elemenId, nxtLvl);
          }
        }

        const levelUpMsg = {
          id: Date.now() + 5,
          role: 'ai',
          isLevelUp: true,
          fromLevel: currentLevelForRecord,
          toLevel: nxtLvl,
          text: `🚀 **Selamat! Kamu berhasil naik ke Level ${LEVEL_LABELS_LOCAL[nxtLvl]}!**\n\nNilai quiz terakhirmu ${latestScore}/100 telah melampaui KKM (${KKM}). Semua konten di materi **${materiId}** sekarang naik ke Level ${LEVEL_LABELS_LOCAL[nxtLvl]}.\n\nRiwayat quiz Level ${LEVEL_LABELS_LOCAL[currentLevelForRecord]} masih bisa kamu lihat di panel kanan, tapi tidak bisa dikerjakan ulang. Terus semangat! 💪`,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          team: 'Tim 5',
        };
        setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), levelUpMsg] }));
      }
    }

    addRecentActivity?.({
      type: 'quiz',
      mapelIcon: chatMateri.mapelIcon,
      mapelColor: chatMateri.mapelColor,
      // REVISI: label aktivitas menyertakan level
      label: `Menyelesaikan ${type === 'essay' ? 'essay' : 'quiz PG'} ${materiId || chatMateri.mapelLabel}`,
      level: currentLevelForRecord,
      ts: Date.now(),
    });

    // [TIM 5] Context injection — trigger saat klik "Tanya Kak Nusa" dari riwayat
  };

  // REVISI: addRecentActivity untuk event belajar (chat) juga menyertakan level
  const handleStartChatActivity = () => {
    addRecentActivity?.({
      type: 'chat',
      mapelIcon: chatMateri.mapelIcon,
      mapelColor: chatMateri.mapelColor,
      label: `Mempelajari ${materiId || chatMateri.mapelLabel}`,
      level: levelMap[activeKey] || chatMateri?.level || 'low',
      ts: Date.now(),
    });
  };

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ══ PANEL KIRI ══════════════════════════════════════════ */}
      <div style={{ width: 200, minWidth: 200, background: C.white, borderRight: `1px solid rgba(13,92,99,.08)`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 12px' }}>
          <button onClick={handleSafeBack}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.teal, fontWeight: 700, fontSize: FS.md, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
            ← Kembali
          </button>

          {/* Kamera aktif */}
          <div style={{ background: `${C.red}0F`, border: `1px solid ${C.red}33`, borderRadius: 9, padding: '7px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, display: 'inline-block', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.red }}>Kamera Aktif</div>
              <div style={{ fontSize: FS.xs, color: C.slate }}>Deteksi emosi ON</div>
            </div>
          </div>

          {/* Mapel info */}
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${chatMateri.mapelColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, marginBottom: 6 }}>
            {chatMateri.mapelIcon}
          </div>
          <div style={{ fontSize: FS.xs, color: chatMateri.mapelColor, fontWeight: 700, marginBottom: 2 }}>{chatMateri.mapelLabel}</div>
          {materiId ? (
            <>
              <div style={{ fontFamily: FONTS.serif, fontSize: FS.md, fontWeight: 600, color: C.dark, lineHeight: 1.4, marginBottom: 8 }}>{materiId}</div>
            </>
          ) : (
            <div style={{ fontSize: FS.sm, color: C.slate, marginBottom: 8, fontStyle: 'italic' }}>Belum pilih materi</div>
          )}

          {/* Level konten belajar — dinamis mengikuti levelMap */}
          {(() => {
            const lvl = (materiId ? levelMap[makeKey(chatMateri.mapelId, materiId)] : null) || chatMateri.level || 'low';
            const lvlMeta = { low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' }, mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' }, high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' } }[lvl] || { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' };
            const prevLvl = chatMateri.level || 'low';
            const hasLeveledUp = lvl !== prevLvl;
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: FS.xs, color: C.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>Level Konten</div>
                <span style={{
                  fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                  background: lvlMeta.bg, color: lvlMeta.color, border: `1px solid ${lvlMeta.border}`,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  transition: 'all .3s ease',
                }}>
                  {hasLeveledUp && <span style={{ fontSize: 9 }}>🚀</span>}
                  {lvlMeta.label}
                </span>
              </div>
            );
          })()}

          <Divider />

          {/* Riwayat topik mapel */}
          {sessions.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0 8px' }} />
              <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                📚 Riwayat {chatMateri.mapelLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {sessions.map(sess => {
                  const isActive = sess.sub === materiId;
                  const qh = quizHistory[sess.k];
                  // Nilai terbaru (1 riwayat per level, bukan best)
                  const mcQh = qh ? qh.filter(r => r.type === 'mc' || !r.type) : [];
                  const latestQ = mcQh.length > 0 ? mcQh[mcQh.length - 1].score : null;
                  const sessLevel = levelMap[sess.k] || chatMateri?.level || 'low';
                  const sessLvlMeta = { low: { color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' }, mid: { color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' }, high: { color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' } }[sessLevel] || { color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' };
                  return (
                    <button key={sess.k} onClick={() => {
                      setSubMateri(sess.sub);
                      setChatMateri(cm => ({ ...cm, materiId: sess.sub }));
                      setQuizActive(false); setQuizAnswers({}); setQuizSubmitted(false); setConfOverlay(null);
                    }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, border: `1px solid ${isActive ? chatMateri.mapelColor : C.tealXL}`, background: isActive ? `${chatMateri.mapelColor}12` : C.white, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.cream; e.currentTarget.style.borderColor = C.tealL; } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.tealXL; } }}>
                      <span style={{ fontSize: 12 }}>{chatMateri.mapelIcon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: FS.xs, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.sub}</div>
                        <div style={{ fontSize: FS.xs, color: C.slate }}>
                          {latestQ != null ? `Quiz: ${latestQ}/100` : sess.done ? '✅ Selesai' : '🔄 Belajar'}
                        </div>
                        {/* Badge level per topik */}
                        <div style={{ marginTop: 2 }}>
                          <span style={{ fontSize: FS.xs, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: sessLvlMeta.bg, color: sessLvlMeta.color, border: `1px solid ${sessLvlMeta.border}` }}>
                            Lv.{sessLevel === 'low' ? 'Low' : sessLevel === 'mid' ? 'Mid' : 'High'}
                          </span>
                        </div>
                      </div>
                      {isActive && <span style={{ fontSize: FS.xs, color: chatMateri.mapelColor }}>●</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ PANEL TENGAH — Chat ══════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: C.white }}>
        {/* Header */}
        <div style={{ padding: '10px 14px', background: C.white, borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xl, flexShrink: 0 }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>Mentor AI — Kak Nusa</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
              <span style={{ fontSize: FS.xs, color: C.green }}>Online</span>
              <span style={{ fontSize: FS.xs, color: C.slate, marginLeft: 6 }}>· {materiId || chatMateri.mapelLabel}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0', display: 'flex', background: C.cream, flexDirection: 'column', gap: 0 }}>
          {msgs.map(msg => (
            <div key={msg.id}>
              {/* ── USER BUBBLE (right-aligned) ── */}
              {msg.role === 'user' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', background: C.cream, padding: '10px 16px 2px' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '16px 4px 16px 16px',
                      background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                      color: '#fff',
                      fontSize: FS.base,
                      boxShadow: '0 2px 12px rgba(13,92,99,.25)',
                      lineHeight: 1.6,
                    }}>
                      {renderText(msg.text)}
                    </div>
                    <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3, textAlign: 'right', paddingRight: 4 }}>{msg.time}</div>
                  </div>
                </div>
              )}

              {/* ── AI ASSISTANT FULL-WIDTH LAYOUT ── */}
              {msg.role === 'ai' && (
                <div style={{
                  display: 'flex',
                  gap: 0,
                  padding: msg.isMateri ? '16px 16px 12px' : '14px 16px 10px',
                  borderBottom: '1px solid rgba(13,92,99,.04)',
                  background: msg.isMateri
                    ? `linear-gradient(135deg, ${C.teal}12 0%, rgba(212,240,243,.35) 50%, ${C.teal}06 100%)`
                    : msg.isQuizAnalysis
                      ? `linear-gradient(135deg, ${C.teal}0A, transparent 60%)`
                      : C.cream,
                  borderLeft: msg.isMateri
                    ? `4px solid ${C.teal}`
                    : msg.isQuizAnalysis
                      ? `3px solid ${C.teal}55`
                      : 'none',
                  animation: msg.isQuizAnalysis ? 'fadeIn .4s ease' : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Decorative badge untuk konten materi */}
                  {msg.isMateri && (
                    <div style={{
                      position: 'absolute', top: 8, right: 10,
                      background: `linear-gradient(135deg, ${C.teal}, ${C.tealL})`,
                      color: '#fff', fontSize: FS.xs, fontWeight: 800,
                      padding: '2px 8px', borderRadius: 99,
                      letterSpacing: .6, textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', gap: 4,
                      boxShadow: `0 2px 8px ${C.teal}44`,
                    }}>
                      📚 Materi
                    </div>
                  )}
                  {/* Avatar */}
                  <div style={{ flexShrink: 0, marginRight: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: FS.xl, boxShadow: '0 2px 8px rgba(13,92,99,.2)',
                      border: `2px solid ${C.white}`,
                    }}>🤖</div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name + time */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: FS.md, fontWeight: 700, color: C.teal }}>Mentor AI</span>
                      {/* Badge khusus untuk pesan evaluasi kuis */}
                      {msg.isQuizAnalysis && (
                        <span style={{
                          fontSize: FS.xs, padding: '2px 7px', borderRadius: 99,
                          background: `linear-gradient(135deg,${C.teal}22,${C.teal}11)`,
                          border: `1px solid ${C.teal}44`,
                          color: C.teal, fontWeight: 700, letterSpacing: .3,
                        }}>
                          📊 Evaluasi Kuis
                        </span>
                      )}
                      {/* <span style={{ fontSize: FS.xs, color: C.slate, marginTop: 3, textAlign: 'left', paddingLeft: 4 }}>{msg.time}</span> */}
                    </div>
                    {/* Message content — full markdown */}
                    <div style={{
                      color: C.dark, lineHeight: 1.7,
                      // Highlight subtle saat sedang disuarakan
                      ...(speakingMsgId === msg.id ? {
                        background: `${C.purple}08`,
                        borderRadius: 8,
                        padding: '4px 8px',
                        margin: '-4px -8px',
                      } : {}),
                    }}>
                      {renderMarkdown(msg.text)}
                    </div>

                    {/* ── Action bar: TTS + Feedback ── */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      marginTop: 8, paddingBottom: 6,
                    }}>
                      {/* Timestamp di ujung kanan */}
                      <span style={{ display: 'flex', fontSize: FS.xs, color: C.slate, opacity: .7 }}>
                        {msg.time}
                      </span>

                      {/* TTS Button */}
                      <button
                        onClick={() => speakMsg(msg.id, msg.text)}
                        title={speakingMsgId === msg.id ? 'Stop suara' : 'Putar suara'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 99,
                          border: `1px solid ${speakingMsgId === msg.id ? C.purple : 'transparent'}`,
                          background: speakingMsgId === msg.id ? `${C.purple}12` : 'transparent',
                          color: speakingMsgId === msg.id ? C.purple : C.slate,
                          cursor: 'pointer', fontSize: FS.sm, fontFamily: 'inherit',
                          transition: 'all .15s',
                          animation: speakingMsgId === msg.id ? 'pulse 1.4s infinite' : 'none',
                        }}
                        onMouseEnter={e => {
                          if (speakingMsgId !== msg.id) {
                            e.currentTarget.style.borderColor = C.purple;
                            e.currentTarget.style.color = C.purple;
                            e.currentTarget.style.background = `${C.purple}08`;
                          }
                        }}
                        onMouseLeave={e => {
                          if (speakingMsgId !== msg.id) {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.color = C.slate;
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {speakingMsgId === msg.id ? '⏹' : '🔊'}
                        </span>
                        <span style={{ fontSize: FS.xs, fontWeight: 600 }}>
                          {speakingMsgId === msg.id ? 'Stop' : 'Putar'}
                        </span>
                      </button>

                      {/* Divider dot */}
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,.12)', flexShrink: 0 }} />

                      {/* Like button */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'like')}
                        title="Jawaban membantu"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 7px', borderRadius: 99,
                          border: `1px solid ${feedbacks[msg.id] === 'like' ? C.white : 'transparent'}`,
                          background: feedbacks[msg.id] === 'like' ? `${C.white}12` : 'transparent',
                          cursor: 'pointer', fontSize: FS.sm, fontFamily: 'inherit',
                          transition: 'all .15s',
                          transform: feedbacks[msg.id] === 'like' ? 'scale(1.5)' : 'scale(1)',
                        }}
                        onMouseEnter={e => {
                          if (feedbacks[msg.id] !== 'like') {
                            e.currentTarget.style.borderColor = C.white;
                            e.currentTarget.style.color = C.white;
                          }
                        }}
                        onMouseLeave={e => {
                          if (feedbacks[msg.id] !== 'like') {
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: 12 }}>👍</span>
                      </button>

                      {/* Dislike button */}
                      <button
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        title="Jawaban kurang tepat"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '3px 7px', borderRadius: 99,
                          border: `1px solid ${feedbacks[msg.id] === 'dislike' ? C.white : 'transparent'}`,
                          background: feedbacks[msg.id] === 'dislike' ? `${C.white}12` : 'transparent',
                          cursor: 'pointer', fontSize: FS.sm, fontFamily: 'inherit',
                          transition: 'all .15s',
                          transform: feedbacks[msg.id] === 'dislike' ? 'scale(1.5)' : 'scale(1)',
                        }}
                        onMouseEnter={e => {
                          if (feedbacks[msg.id] !== 'dislike') {
                            e.currentTarget.style.borderColor = C.white;
                            e.currentTarget.style.color = C.white;
                          }
                        }}
                        onMouseLeave={e => {
                          if (feedbacks[msg.id] !== 'dislike') {
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: 12 }}>👎</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* topikList dihapus: siswa sudah memilih topik sebelum masuk chat */}
            </div>
          ))}
          {typing && (
            <div style={{ display: 'flex', gap: 0, padding: '14px 16px 10px', borderBottom: '1px solid rgba(13,92,99,.04)' }}>
              <div style={{ flexShrink: 0, marginRight: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xl, boxShadow: '0 2px 8px rgba(13,92,99,.2)', border: `2px solid ${C.white}` }}>🤖</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FS.md, fontWeight: 700, color: C.teal, marginBottom: 6 }}>Mentor AI <span style={{ fontSize: FS.xs, color: C.slate, fontWeight: 400, marginLeft: 4 }}>sedang mengetik...</span></div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, opacity: 0.7, animation: `waveTyping 1s ${i * .2}s infinite` }} />)}
                </div>
              </div>
            </div>
          )}
          {/* [TIM 5] Typing indicator khusus pasca-kuis — Kak Nusa menganalisis */}
          {quizAnalysisTyping && (
            <div style={{
              display: 'flex', gap: 0, padding: '14px 16px 10px',
              borderBottom: '1px solid rgba(13,92,99,.04)',
              background: `linear-gradient(135deg, ${C.teal}08, transparent)`,
              animation: 'fadeIn .3s ease',
            }}>
              <div style={{ flexShrink: 0, marginRight: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: FS.xl, boxShadow: '0 2px 8px rgba(13,92,99,.3)',
                  border: `2px solid ${C.white}`,
                  animation: 'pulse 1.4s infinite',
                }}>🤖</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FS.md, fontWeight: 700, color: C.teal, marginBottom: 4 }}>
                  Kak Nusa
                  <span style={{ fontSize: FS.xs, color: C.teal, fontWeight: 500, marginLeft: 8, opacity: .8 }}>
                    sedang menyiapkan pembahasan...
                  </span>
                </div>
                {/* Animated analysis dots */}
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                      animation: `waveTyping 1s ${i * .22}s infinite`,
                    }} />
                  ))}
                  <span style={{ fontSize: FS.xs, color: C.teal, opacity: .7, marginLeft: 4 }}>
                    💬 Membuka sesi pembahasan soal...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div style={{ padding: '8px 12px', background: C.white, borderTop: `1px solid rgba(13,92,99,.08)`, flexShrink: 0 }}>
          {chatAttachments.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {chatAttachments.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: C.white, borderRadius: 6, fontSize: 10 }}>
                  <span>🔗</span><span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setChatAttachments(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.slate, fontSize: 11 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <input type="file" ref={chatFileRef} style={{ display: 'none' }} multiple onChange={e => {
              // onChange terpicu = file dipilih, dialog sudah pasti tertutup
              isOpeningFileDialog.current = false;
              if (e.target.files.length === 0) return;
              const parsed = Array.from(e.target.files).map(f => ({ name: f.name, size: `${Math.round(f.size / 1024)} KB`, ext: f.name.split('.').pop() }));
              setChatAttachments(p => [...p, ...parsed].slice(0, 3));
              e.target.value = '';
              reEnterFullscreen();
            }} />
            {/* Upload file */}
            <button
              onClick={() => {
                isOpeningFileDialog.current = true;
                chatFileRef.current?.click();

                // Deteksi dialog tutup (cancel/X) via window focus — reliable di semua browser
                // saat file dialog ditutup, fokus kembali ke window
                const onFocus = () => {
                  // Beri jeda kecil agar onChange sempat terpicu lebih dulu jika ada file dipilih
                  setTimeout(() => {
                    if (isOpeningFileDialog.current) {
                      // onChange belum reset flag → berarti ini kasus cancel
                      isOpeningFileDialog.current = false;
                      reEnterFullscreen();
                    }
                  }, 200);
                };
                window.addEventListener('focus', onFocus, { once: true });

                // Safety fallback jika focus tidak terpicu sama sekali
                setTimeout(() => {
                  window.removeEventListener('focus', onFocus);
                  if (isOpeningFileDialog.current) {
                    isOpeningFileDialog.current = false;
                    reEnterFullscreen();
                  }
                }, 30000);
              }}
              title="Lampirkan file"
              style={{ width: 34, height: 34, borderRadius: 8, background: C.white, border: `1.5px solid ${C.tealXL}`, cursor: 'pointer', fontSize: FS.lg, flexShrink: 0 }}>
              🔗
            </button>
            {/* STT — mic permanen, aktif saat klik */}
            <button
              onClick={toggleSTT}
              title={!sttSupported ? 'Browser tidak mendukung STT' : sttListening ? 'Klik untuk berhenti merekam' : 'Klik untuk bicara'}
              disabled={!sttSupported}
              style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                border: `1.5px solid ${sttListening ? C.red : C.tealXL}`,
                background: sttListening ? C.red : C.white,
                cursor: sttSupported ? 'pointer' : 'not-allowed',
                fontSize: FS.lg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
                animation: sttListening ? 'pulse 1s infinite' : 'none',
                opacity: sttSupported ? 1 : .4,
              }}>
              🎙️
            </button>
            {/* Textarea — auto-resize ke atas */}
            <div style={{ flex: 1, position: 'relative', alignSelf: 'flex-end' }}>
              <textarea ref={textareaRef} value={input} onChange={e => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
              }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder={
                  sttListening
                    ? '🎙️ Mendengarkan...'
                    : materiId
                      ? `Tanya tentang ${materiId}...`
                      : `Tanya tentang ${chatMateri.mapelLabel}...`
                }
                style={{
                  width: '100%', padding: '8px 10px',
                  border: `1.5px solid ${sttListening ? C.red : C.tealXL}`,
                  borderRadius: 9, fontSize: FS.base, resize: 'none', outline: 'none',
                  minHeight: 38, maxHeight: 160, height: 38,
                  lineHeight: 1.5, overflowY: 'auto',
                  transition: 'border-color .2s',
                  boxSizing: 'border-box',
                  fontStyle: sttListening ? 'italic' : 'normal',
                  display: 'block',
                }}
                rows={1} />
              {/* Indikator STT aktif */}
              {sttListening && (
                <div style={{
                  position: 'absolute', right: 8, bottom: 10,
                  display: 'flex', gap: 2, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 3, borderRadius: 99, background: C.red,
                      animation: `waveTyping .8s ${i * .15}s infinite`,
                      height: 12,
                    }} />
                  ))}
                </div>
              )}
            </div>
            <Btn variant="primary" onClick={sendMsg} disabled={!input.trim() && !chatAttachments.length}
              style={{ height: 38, paddingLeft: 12, paddingRight: 12, flexShrink: 0, fontSize: FS.md, alignSelf: 'flex-end' }}>Kirim →</Btn>
          </div>
        </div>
      </div>

      {/* ══ PANEL KANAN ══════════════════════════════════════════ */}
      <div style={{
        width: rightPanelWidth,
        minWidth: rightPanelWidth,
        transition: 'width .3s cubic-bezier(.4,0,.2,1), min-width .3s cubic-bezier(.4,0,.2,1)',
        borderLeft: `1px solid rgba(13,92,99,.08)`,
        background: C.white,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Mode: Detail Riwayat Quiz (menimpa format konten & latihan soal) ── */}
        {quizHistoryModal ? (() => {
          const { result, index } = quizHistoryModal;
          const isMcResult = result.type === 'mc' || !result.type;
          const isEssayResult = result.type === 'essay';
          const pass = isMcResult && result.score >= 70;
          const attemptNumber = index + 1;
          const headerColor = isMcResult ? chatMateri.mapelColor : C.purple;
          // Pakai soalSnapshot dari riwayat jika ada, fallback ke quizSoal bank
          const reviewSoal = result.soalSnapshot || (isMcResult ? quizSoal : []);
          return (
            <div style={{
              display: 'flex', flexDirection: 'column',
              height: '100%', overflow: 'hidden',
              animation: 'fadeIn .2s ease both',
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 14px',
                background: headerColor,
                display: 'flex', alignItems: 'center', gap: 8,
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 15 }}>{isMcResult ? '🔘' : '✍️'}</span>
                <div style={{ flex: 1, color: C.white, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: FS.md, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isMcResult ? 'Pilihan Ganda' : 'Essay'} #{attemptNumber}
                  </div>
                  <div style={{ fontSize: FS.xs, opacity: .8 }}>{materiId} · {result.ts}</div>
                </div>
                <button onClick={() => setQuizHistoryModal(null)}
                  style={{
                    background: 'rgba(255,255,255,.2)', border: 'none',
                    borderRadius: 6, width: 26, height: 26, color: C.white,
                    cursor: 'pointer', fontSize: FS.base, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
              </div>

              {/* Skor ringkas — MC saja */}
              {isMcResult && (
                <div style={{
                  padding: '12px 14px 8px', textAlign: 'center',
                  borderBottom: `1px solid rgba(13,92,99,.07)`, flexShrink: 0,
                  background: pass ? `${C.green}08` : `${C.amber}08`,
                }}>
                  <div style={{ fontSize: 26, marginBottom: 2 }}>{pass ? '🌟' : '💪'}</div>
                  <div style={{ fontWeight: 800, fontSize: 26, color: pass ? C.green : C.amber }}>
                    {result.score}/100
                  </div>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: pass ? C.green : C.orange, marginTop: 1 }}>
                    {pass ? '⭐ Lulus!' : 'Perlu latihan lagi'}
                  </div>
                  <div style={{ fontSize: FS.xs, color: C.darkL }}>
                    {result.correct} dari {result.total} soal benar
                  </div>
                </div>
              )}

              {/* Status Essay */}
              {isEssayResult && (
                <div style={{
                  padding: '12px 14px 8px', textAlign: 'center',
                  borderBottom: `1px solid rgba(13,92,99,.07)`, flexShrink: 0,
                  background: `${C.purple}08`,
                }}>
                  <div style={{ fontSize: 26, marginBottom: 2 }}>✅</div>
                  <div style={{ fontWeight: 700, fontSize: FS.base, color: C.purple }}>
                    Jawaban Essay Terkirim
                  </div>
                  <div style={{ fontSize: FS.xs, color: C.darkL, marginTop: 2 }}>
                    Kak Nusa sudah memberi feedback di chat
                  </div>
                </div>
              )}

              {/* Review isi — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

                {/* Review MC */}
                {isMcResult && reviewSoal.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: FS.xs, color: C.dark, marginBottom: 8 }}>
                      🔍 Review Jawaban
                    </div>
                    {reviewSoal.map((s, si) => {
                      const userAns = result.answers?.[si];
                      const correct = userAns === s.jawaban;
                      return (
                        <div key={si} style={{
                          marginBottom: 7, paddingBottom: 7,
                          borderBottom: si < reviewSoal.length - 1 ? `1px solid rgba(13,92,99,.06)` : 'none',
                        }}>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start', marginBottom: 2 }}>
                            <span style={{ fontSize: FS.sm, flexShrink: 0 }}>{correct ? '✅' : '❌'}</span>
                            <div style={{ fontSize: FS.xs, color: C.dark, fontWeight: 600, lineHeight: 1.4 }}>
                              {si + 1}. {s.soal}
                            </div>
                          </div>
                          <div style={{ marginLeft: 17, fontSize: 9 }}>
                            <span style={{ color: correct ? C.green : C.red }}>
                              Jawabanmu: {s.pilihan[userAns] ?? '(tidak dijawab)'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Review Essay */}
                {isEssayResult && result.essayAnswers && (
                  <>
                    <div style={{ fontWeight: 700, fontSize: FS.xs, color: C.dark, marginBottom: 8 }}>
                      📋 Jawaban Essay
                    </div>
                    {(result.soalSnapshot || []).map((s, si) => {
                      const jawaban = result.essayAnswers?.[s.id] || '';
                      const wc = jawaban.trim().split(/\s+/).filter(Boolean).length;
                      return (
                        <div key={s.id} style={{
                          marginBottom: 10, paddingBottom: 10,
                          borderBottom: si < (result.soalSnapshot?.length ?? 0) - 1 ? `1px solid ${C.purple}18` : 'none',
                        }}>
                          <div style={{ fontSize: FS.xs, fontWeight: 600, color: C.dark, marginBottom: 4, lineHeight: 1.4 }}>
                            Essay {si + 1}: {s.soal.slice(0, 70)}{s.soal.length > 70 ? '…' : ''}
                          </div>
                          <div style={{
                            fontSize: FS.xs, color: C.darkL, lineHeight: 1.6,
                            background: `${C.purple}08`, borderRadius: 6,
                            padding: '6px 8px',
                            fontStyle: jawaban ? 'normal' : 'italic',
                          }}>
                            {jawaban || '(tidak dijawab)'}
                          </div>
                          <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3 }}>
                            {wc} kata ditulis
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer: tombol Ulangi + Tanya Kak Nusa */}
              <div style={{
                padding: '8px 12px', borderTop: `1px solid rgba(13,92,99,.07)`,
                flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5,
              }}>
                {/* Tombol Ulangi Quiz — hanya tampil jika ini riwayat level AKTIF */}
                {(() => {
                  const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
                  const isActiveLevelRecord = (result.level || 'low') === currentLvl;
                  if (!isActiveLevelRecord) return (
                    <div style={{
                      padding: '7px 10px', borderRadius: 8,
                      background: 'rgba(0,0,0,.03)', border: `1px solid rgba(0,0,0,.07)`,
                      fontSize: FS.xs, color: C.slate, textAlign: 'center', fontStyle: 'italic',
                    }}>
                      Riwayat level yang sudah dilampaui — tidak bisa diulang
                    </div>
                  );
                  return (
                    <button
                      onClick={() => {
                        setRetrySnapshot({ type: result.type || 'mc', soal: result.soalSnapshot || quizSoal });
                        setQuizHistoryModal(null);
                        if (isMcResult) setMcModal(true);
                        else setEssayModal(true);
                      }}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 8,
                        border: `1.5px solid ${headerColor}`,
                        background: `${headerColor}0F`,
                        color: headerColor, fontWeight: 700, fontSize: FS.sm,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${headerColor}20`}
                      onMouseLeave={e => e.currentTarget.style.background = `${headerColor}0F`}
                    >
                      🔄 Ulangi Soal Ini
                    </button>
                  );
                })()}

                {/* Tanya Kak Nusa — berlaku untuk MC dan Essay */}
                <div style={{
                  background: `${C.teal}0D`, borderRadius: 7, padding: '7px 9px',
                  fontSize: FS.xs, color: C.teal, lineHeight: 1.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 7,
                }}>
                  <span>💬 {isMcResult ? 'Bahas soal yang salah' : 'Minta feedback'} dengan <strong>Kak Nusa</strong></span>
                  <button
                    onClick={() => {
                      useStudentStore.getState().setQuizAnalysisNeeded({
                        quizType: result.type || 'mc',
                        score: result.score,
                        correct: result.correct,
                        total: result.total,
                        materiId: materiId || chatMateri.mapelLabel,
                        mapelLabel: chatMateri.mapelLabel,
                        wrongItems: result.wrongItems || [],
                        essayAnswers: result.essayAnswers || {},
                        soalSnapshot: result.soalSnapshot || [],
                      });
                      setQuizHistoryModal(null);
                    }}
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                      background: headerColor, border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: FS.md, boxShadow: `0 2px 6px ${headerColor}55`,
                      transition: 'transform .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >💬</button>
                </div>
              </div>
            </div>
          );
        })() : confModal ? (() => {
          /* ── Mode B: Format Konten (Mindmap / Flashcard) ── */
          const ct = CONF_TYPES.find(t => t.type === confModal.type);
          if (!ct) return null;
          const data = kConf[ct.type];
          return (
            <div style={{
              display: 'flex', flexDirection: 'column',
              height: '100%', overflow: 'hidden',
              animation: 'fadeIn .2s ease both',
            }}>
              {/* Header */}
              <div style={{
                padding: '12px 14px',
                background: ct.color,
                display: 'flex', alignItems: 'center', gap: 8,
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 18 }}>{ct.icon}</span>
                <div style={{ flex: 1, color: '#fff', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: FS.base, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ct.label}
                  </div>
                  <div style={{ fontSize: FS.xs, opacity: .8 }}>{materiId} · {chatMateri.mapelLabel}</div>
                </div>
                <button onClick={() => setConfModal(null)}
                  style={{
                    background: 'rgba(255,255,255,.2)', border: 'none',
                    borderRadius: 6, width: 26, height: 26, color: '#fff',
                    cursor: 'pointer', fontSize: FS.lg, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>✕</button>
              </div>

              {/* Body — scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
                {confGenerating ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
                    <div style={{ width: 36, height: 36, border: `4px solid ${ct.bgLight}`, borderTopColor: ct.color, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                    <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>Generating {ct.label}...</div>
                    <div style={{ fontSize: FS.sm, color: C.slate }}>sedang menyusun konten</div>
                  </div>
                ) : !data?.generated ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: C.slate }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>{ct.icon}</div>
                    <div style={{ fontSize: 13 }}>Klik "Generate Ulang" untuk membuat {ct.label}</div>
                  </div>
                ) : (
                  <>
                    {ct.type === 'mindmap' && (
                      <MindMapView tree={data.tree} color={ct.color} bgLight={ct.bgLight} materiId={materiId} />
                    )}
                    {ct.type === 'flashcard' && data.cards && (
                      <FlashcardView
                        cards={data.cards} color={ct.color} bgLight={ct.bgLight} materiId={materiId}
                        flashIdx={flashIdx} setFlashIdx={setFlashIdx}
                        flashFlipped={flashFlipped} setFlashFlipped={setFlashFlipped}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })() : (
          /* ── Mode: Normal — Format Konten + Latihan Soal ── */
          <>
            {/* Format Konten */}
            <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid rgba(13,92,99,.06)`, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: FS.md, color: C.dark, marginBottom: 3 }}>📦 Format Konten</div>
              <div style={{ fontSize: FS.xs, color: C.slate, marginBottom: 8 }}>
                {materiId ? 'Pilih format konten belajar' : 'Pilih materi dulu'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {CONF_TYPES.map(ct => {
                  const done_ = kConf[ct.type]?.generated;
                  return (
                    <button key={ct.type}
                      onClick={() => { if (!materiId) return; if (!done_) generateConf(ct.type); setConfModal({ type: ct.type }); }}
                      disabled={!materiId}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${done_ ? ct.color : C.tealXL}`, cursor: materiId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: done_ ? ct.bgLight : C.white, color: done_ ? ct.color : C.slate, fontSize: FS.md, fontWeight: 700, textAlign: 'left', transition: 'all .2s', opacity: materiId ? 1 : .5 }}>
                      <span style={{ fontSize: 15 }}>{ct.icon}</span>
                      <span style={{ flex: 1 }}>{ct.label}</span>
                      {done_
                        ? <span style={{ fontSize: FS.xs, opacity: .8 }}>Lihat</span>
                        : <span style={{ fontSize: FS.xs, color: C.tealL }}>Buat</span>
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tombol Game */}
            <div style={{ padding: '8px 12px', borderBottom: `1px solid rgba(13,92,99,.06)`, flexShrink: 0 }}>
              <button
                onClick={() => { if (materiId && openGame) openGame({
                  mapelId:     chatMateri.mapelId,
                  mapelLabel:  chatMateri.mapelLabel,
                  mapelIcon:   chatMateri.mapelIcon,
                  mapelColor:  chatMateri.mapelColor,
                  elemenId:    chatMateri.elemenId    || null,
                  elemenLabel: chatMateri.elemenLabel || null,
                  materiId,
                  level:       chatMateri.level || 'Low',
                  // game_id tidak diisi di sini — siswa pilih game dari getGameList
                  // di produksi: buka modal pilih game, set game_id sebelum openGame
                }); }}
                disabled={!materiId}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 9,
                  border: `1.5px solid ${materiId ? chatMateri.mapelColor : C.tealXL}`,
                  background: materiId ? `${chatMateri.mapelColor}10` : C.bg,
                  color: materiId ? chatMateri.mapelColor : C.slate,
                  fontSize: FS.md, fontWeight: 700, cursor: materiId ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', transition: 'all .2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: materiId ? 1 : .5,
                }}
                onMouseEnter={e => { if (materiId) { e.currentTarget.style.background = chatMateri.mapelColor; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={e => { if (materiId) { e.currentTarget.style.background = `${chatMateri.mapelColor}10`; e.currentTarget.style.color = chatMateri.mapelColor; } }}
              >
                <span style={{ fontSize: 15 }}>🎮</span>
                <span>Main Game</span>
              </button>
            </div>

            {/* Quiz */}
            <div style={{ padding: '10px 12px', flex: 1, overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ fontWeight: 700, fontSize: FS.md, color: C.dark, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                📝 Latihan Soal
              </div>

              {!materiId ? (
                <div style={{ fontSize: FS.sm, color: C.slate, background: C.cream, borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                  Pilih materi dulu untuk mulai latihan soal
                </div>
              ) : (
                <>
                  {/* ── 2 Tombol Sejajar ── */}
                  {(() => {
                    const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
                    const isHighLevel = currentLvl === 'high';
                    const mcDoneAtHigh = isHighLevel && allHistory.some(r => (r.type === 'mc' || !r.type) && (r.level || 'low') === 'high');
                    const essayDoneAtHigh = isHighLevel && allHistory.some(r => r.type === 'essay' && (r.level || 'low') === 'high');
                    return (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                        {/* Tombol Pilihan Ganda */}
                        <button
                          onClick={() => { if (!mcDoneAtHigh) { setRetrySnapshot(null); setMcModal(true); } }}
                          disabled={mcDoneAtHigh}
                          title={mcDoneAtHigh ? 'Sudah dikerjakan di level High. Gunakan tombol Ulangi di riwayat.' : undefined}
                          style={{
                            flex: 1, padding: '9px 4px', borderRadius: 8,
                            border: `1.5px solid ${mcDoneAtHigh ? '#CBD5E0' : chatMateri.mapelColor}`,
                            background: mcDoneAtHigh ? '#F7FAFC' : `${chatMateri.mapelColor}0F`,
                            color: mcDoneAtHigh ? '#A0AEC0' : chatMateri.mapelColor,
                            fontWeight: 700, fontSize: FS.xs,
                            cursor: mcDoneAtHigh ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 3,
                            transition: 'all .15s',
                            opacity: mcDoneAtHigh ? .65 : 1,
                          }}
                          onMouseEnter={e => { if (!mcDoneAtHigh) e.currentTarget.style.background = `${chatMateri.mapelColor}20`; }}
                          onMouseLeave={e => { if (!mcDoneAtHigh) e.currentTarget.style.background = `${chatMateri.mapelColor}0F`; }}
                        >
                          <span style={{ fontSize: 14 }}>{mcDoneAtHigh ? '🔒' : '🔘'}</span>
                          <span>Pilihan Ganda</span>
                          {mcHistory.length > 0 && (
                            <span style={{ fontSize: FS.xs, opacity: .7 }}>{mcDoneAtHigh ? 'Sudah dikerjakan' : `${mcHistory.length}x dikerjakan`}</span>
                          )}
                        </button>

                        {/* Tombol Essay */}
                        <button
                          onClick={() => { if (!essayDoneAtHigh) { setRetrySnapshot(null); setEssayModal(true); } }}
                          disabled={essayDoneAtHigh}
                          title={essayDoneAtHigh ? 'Sudah dikerjakan di level High. Gunakan tombol Ulangi di riwayat.' : undefined}
                          style={{
                            flex: 1, padding: '9px 4px', borderRadius: 8,
                            border: `1.5px solid ${essayDoneAtHigh ? '#CBD5E0' : chatMateri.mapelColor}`,
                            background: essayDoneAtHigh ? '#F7FAFC' : `${chatMateri.mapelColor}0F`,
                            color: essayDoneAtHigh ? '#A0AEC0' : chatMateri.mapelColor,
                            fontWeight: 700, fontSize: FS.xs,
                            cursor: essayDoneAtHigh ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 3,
                            transition: 'all .15s',
                            opacity: essayDoneAtHigh ? .65 : 1,
                          }}
                          onMouseEnter={e => { if (!essayDoneAtHigh) e.currentTarget.style.background = `${chatMateri.mapelColor}20`; }}
                          onMouseLeave={e => { if (!essayDoneAtHigh) e.currentTarget.style.background = `${chatMateri.mapelColor}0F`; }}
                        >
                          <span style={{ fontSize: 14 }}>{essayDoneAtHigh ? '🔒' : '✍️'}</span>
                          <span>Essay</span>
                          {essayHistory.length > 0 && (
                            <span style={{ fontSize: FS.xs, opacity: .7 }}>{essayDoneAtHigh ? 'Sudah dikerjakan' : `${essayHistory.length}x dikerjakan`}</span>
                          )}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Info KKM dan nilai terakhir */}
                  <div style={{ fontSize: FS.xs, color: C.slate, textAlign: 'center', marginBottom: 10, lineHeight: 1.6 }}>
                    {(() => {
                      const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
                      const isHighLevel = currentLvl === 'high';
                      const hasDoneAtHigh = isHighLevel && allHistory.some(r => (r.level || 'low') === 'high');
                      if (hasDoneAtHigh) return (
                        <span style={{ color: '#9B2C2C', background: '#FFF5F5', border: '1px solid #FEB2B2', padding: '3px 8px', borderRadius: 6, display: 'inline-block', lineHeight: 1.5 }}>
                          🔒 Level High sudah diselesaikan · Gunakan <strong>Ulangi</strong> di riwayat
                        </span>
                      );
                      return <>
                        Quiz ≥ 80 → otomatis naik level
                        {mcLatestScore != null && (
                          <span style={{ marginLeft: 5, fontWeight: 700, color: mcLatestScore >= 80 ? C.green : C.orange }}>
                            · Terakhir: {mcLatestScore}/100
                          </span>
                        )}
                      </>;
                    })()}
                  </div>

                  {/* ── Riwayat Quiz (1 per level, dikelompokkan per level) ── */}
                  {allHistory.length > 0 && (() => {
                    const LEVEL_ORDER_DISP = ['low', 'mid', 'high'];
                    const LEVEL_LBL_DISP = { low: 'Low', mid: 'Mid', high: 'High' };
                    const LEVEL_CLR_DISP = {
                      low: { color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' },
                      mid: { color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' },
                      high: { color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' },
                    };
                    const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
                    return (
                      <div>
                        <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, marginBottom: 8 }}>Riwayat Quiz</div>
                        {/* Tampilkan level dari tinggi ke rendah — level aktif di atas */}
                        {[...LEVEL_ORDER_DISP].reverse().map(lv => {
                          const lvRecs = allHistory.filter(r => (r.level || 'low') === lv);
                          if (lvRecs.length === 0) return null;
                          const lvMeta = LEVEL_CLR_DISP[lv];
                          const isPast = LEVEL_ORDER_DISP.indexOf(lv) < LEVEL_ORDER_DISP.indexOf(currentLvl);
                          return (
                            <div key={lv} style={{ marginBottom: 10 }}>
                              {/* Level header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, padding: '3px 8px', borderRadius: 6, background: lvMeta.bg, border: `1px solid ${lvMeta.border}` }}>
                                <span style={{ fontSize: FS.xs, fontWeight: 800, color: lvMeta.color }}>Level {LEVEL_LBL_DISP[lv]}</span>
                                {isPast && <span style={{ fontSize: FS.xs, color: C.slate, fontStyle: 'italic' }}>· Sudah dilampaui — hanya lihat</span>}
                                {lv === currentLvl && <span style={{ fontSize: FS.xs, color: lvMeta.color, fontWeight: 700 }}>· Level aktif</span>}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {lvRecs.map((r, i) => {
                                  const originalIndex = allHistory.indexOf(r);
                                  const isActiveItem = quizHistoryModal?.index === originalIndex;
                                  const isMcItem = r.type === 'mc' || !r.type;
                                  const itemColor = isMcItem ? chatMateri.mapelColor : C.purple;
                                  return (
                                    <button key={i}
                                      onClick={() => setQuizHistoryModal(isActiveItem ? null : { result: r, index: originalIndex })}
                                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 8, border: `1px solid ${isActiveItem ? itemColor : 'transparent'}`, background: isActiveItem ? `${itemColor}12` : C.cream, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', transition: 'all .15s' }}>
                                      <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isActiveItem ? `${itemColor}22` : `${itemColor}18`, border: `1px solid ${itemColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: 11 }}>{isMcItem ? '🔘' : '✍️'}</span>
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                          {isMcItem ? 'Pilihan Ganda' : 'Essay'}
                                          {isMcItem && r.score != null && (
                                            <span style={{ fontSize: FS.xs, padding: '1px 5px', borderRadius: 99, fontWeight: 800, background: r.score >= 80 ? C.greenL : C.amberL, color: r.score >= 80 ? C.green : C.orange }}>
                                              {r.score}/100
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: FS.xs, color: isActiveItem ? itemColor : C.teal, fontWeight: 600 }}>
                                          {isPast ? '👁 Hanya lihat' : isActiveItem ? 'Sedang dilihat ●' : 'Lihat detail →'}
                                        </div>
                                        <div style={{ fontSize: FS.xs, color: C.slate }}>{r.ts}</div>
                                      </div>
                                      <span style={{ fontSize: 10 }}>{isMcItem ? (r.score >= 80 ? '⭐' : '💪') : '📋'}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══ Modal Pilihan Ganda ══════════════════════════════════ */}
      <QuizModal
        open={mcModal}
        onClose={() => { setMcModal(false); setRetrySnapshot(null); }}
        chatMateri={chatMateri}
        materiId={materiId}
        activeKey={activeKey}
        quizType="mc"
        soalSnapshot={retrySnapshot?.type === 'mc' ? retrySnapshot.soal : null}
        onSubmit={handleQuizSubmit}
      />

      {/* ══ Modal Essay ══════════════════════════════════════════ */}
      <QuizModal
        open={essayModal}
        onClose={() => { setEssayModal(false); setRetrySnapshot(null); }}
        chatMateri={chatMateri}
        materiId={materiId}
        activeKey={activeKey}
        quizType="essay"
        soalSnapshot={retrySnapshot?.type === 'essay' ? retrySnapshot.soal : null}
        onSubmit={handleQuizSubmit}
      />


      {/* ══ VIOLATION WARNING MODAL ══════════════════════════════ */}
      {
        violationModal && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(197,48,48,.12)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            animation: 'fadeIn .2s ease',
          }}>
            <div style={{
              background: C.white, borderRadius: 22, width: 440, padding: 36,
              boxShadow: '0 28px 72px rgba(197,48,48,.28), 0 4px 24px rgba(0,0,0,.12)',
              border: '2px solid rgba(197,48,48,.25)', textAlign: 'center',
            }}>
              {/* Icon pulse */}
              <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 18px' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(197,48,48,.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                  animation: 'pulse 1.4s infinite',
                }}>⚠️</div>
              </div>
              <div style={{ fontSize: FS.lg, color: C.darkL, marginBottom: 16, lineHeight: 1.7 }}>
                Sistem mendeteksi aktivitas di luar platform:
              </div>

              {/* Info box */}
              <div style={{
                background: 'rgba(197,48,48,.06)', borderRadius: 12,
                padding: '11px 16px', marginBottom: 24, fontSize: FS.md,
                color: '#744210', lineHeight: 1.7, textAlign: 'left',
              }}>
                🔒 <strong>Sesi belajar masih berjalan.</strong>
                <br />
                Diperlukan layar penuh untuk melanjutkan belajar.
              </div>

              <button
                onClick={() => {
                  setViolationModal(null);
                  reEnterFullscreen();
                }}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #C53030, #E53E3E)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: FS.md,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(197,48,48,.35)',
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Kembali ke Mode Belajar Penuh
              </button>

              <div style={{ marginTop: 12, fontSize: FS.sm, color: C.slate }}>
                Tekan tombol di atas untuk melanjutkan sesi belajar
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default ChatSection;