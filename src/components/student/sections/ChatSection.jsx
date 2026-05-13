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
import { useBreakpoint } from '../../../hooks/useBreakpoint';
// FIX P0: sambungkan ke API Mentor (Tim 5) dan Content (Tim 3)
import { sendMessage, streamMessage, streamEvaluasi, sendEvaluasi, getChatHistory, createSesi } from '../../../api/mentor';
import { sessionTelemetry } from '../../../telemetry/sessionTelemetry';
import { getKontenSiswa, getQuizHistory } from '../../../api/content'; // bank konten guru + riwayat quiz dari BE
// FIX 4: getKontenSiswa → prefetch bank konten guru saat topik dibuka
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// katex/dist/katex.min.css diimport di main.jsx agar tersedia global,
// tidak bergantung pada apakah ChatSection sudah di-render (penting untuk code-split).

// Flag dari .env:
//   VITE_MENTOR_STREAM : true → stream token-per-token, false → tunggu full response
// VITE_USE_MSW mengcover semua skenario dev — tidak perlu flag gate API terpisah.
const USE_STREAM = import.meta.env.VITE_MENTOR_STREAM === 'true';


/* ─────────────────────────────────────────────────────────────────── */
const makeKey = (mapelId, sub) => `${mapelId}__${sub}`;

// Bobot agregasi quiz — MC 70%, Essay 30%
const MC_WEIGHT = 0.6;
const ESSAY_WEIGHT = 0.4;
const KKM_AGREGASI = 75;

/* ─── Markdown renderer for AI messages ─────────────────────────── */
const renderMarkdown = (text) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
            // ── Table styling ──
            table: ({ children }) => (
                <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                    <table style={{
                        width: '100%', borderCollapse: 'collapse',
                        fontSize: FS.base, fontFamily: FONTS.sans,
                        border: `1px solid ${C.teal}30`,
                        borderRadius: 8,
                    }}>{children}</table>
                </div>
            ),
            thead: ({ children }) => (
                <thead style={{ background: `${C.teal}14` }}>{children}</thead>
            ),
            th: ({ children }) => (
                <th style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontWeight: 700, fontSize: FS.sm, color: C.teal,
                    borderBottom: `2px solid ${C.teal}30`,
                    fontFamily: FONTS.sans,
                }}>{children}</th>
            ),
            td: ({ children }) => (
                <td style={{
                    padding: '7px 12px',
                    borderBottom: `1px solid ${C.teal}15`,
                    fontSize: FS.base, fontFamily: FONTS.sans,
                }}>{children}</td>
            ),
            // ── Typography — semua diseragamkan ke FS.base ──
            p: ({ children }) => (
                <p style={{ margin: '3px 0', lineHeight: 1.65, fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</p>
            ),
            h1: ({ children }) => (
                // h1 → sedikit di atas base agar tidak terlalu jumbo
                <div style={{ fontSize: FS.lg, fontWeight: 700, color: C.dark, margin: '10px 0 4px', fontFamily: FONTS.sans }}>{children}</div>
            ),
            h2: ({ children }) => (
                <div style={{ fontSize: FS.base + 1, fontWeight: 700, color: C.dark, margin: '8px 0 3px', borderBottom: `1px solid ${C.teal}15`, paddingBottom: 3, fontFamily: FONTS.sans }}>{children}</div>
            ),
            h3: ({ children }) => (
                <div style={{ fontSize: FS.base, fontWeight: 700, color: C.teal, margin: '6px 0 3px', fontFamily: FONTS.sans }}>{children}</div>
            ),
            // ── Lists ──
            ul: ({ children }) => (
                <ul style={{ margin: '3px 0', paddingLeft: 18, fontFamily: FONTS.sans }}>{children}</ul>
            ),
            ol: ({ children }) => (
                <ol style={{ margin: '3px 0', paddingLeft: 18, fontFamily: FONTS.sans }}>{children}</ol>
            ),
            li: ({ children }) => (
                <li style={{ marginBottom: 2, lineHeight: 1.6, fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</li>
            ),
            // ── Code ──
            pre: ({ children }) => (
                <pre style={{ background: '#1A2332', color: '#E2E8F0', padding: 12, borderRadius: 8, fontSize: FS.sm, overflowX: 'auto', margin: '6px 0', lineHeight: 1.5 }}>{children}</pre>
            ),
            code: ({ children, ...props }) => (
                <code style={{ background: `${C.teal}12`, padding: '1px 4px', borderRadius: 3, fontSize: FS.sm, fontFamily: 'monospace', color: C.teal }} {...props}>{children}</code>
            ),
            // ── Blockquote ──
            blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: `3px solid ${C.teal}`, margin: '6px 0', paddingLeft: 12, color: C.darkL, fontStyle: 'italic', fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</blockquote>
            ),
            // ── Strong / em ──
            strong: ({ children }) => (
                <strong style={{ fontWeight: 700, fontFamily: FONTS.sans }}>{children}</strong>
            ),
            em: ({ children }) => (
                <em style={{ fontFamily: FONTS.sans }}>{children}</em>
            ),
        }}
    >{text}</ReactMarkdown>
);

// Legacy simple renderer for user messages
const renderText = (text) => text.split('\n').map((line, i, arr) => (
    <p key={i} style={{ marginBottom: i < arr.length - 1 ? 5 : 0, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
));

// REVISI FASE 3: getOpeningMessage
// SISTEM BACAAN MARKDOWN:
//   Bacaan Markdown dari bank konten guru disimpan di confContent[key].bacaan.byLevel[level]
//   setelah prefetch GET /content/siswa (FIX 4b di useEffect).
//   renderMarkdown() di ChatSection merender teks MD ke HTML.
//   Pesan pembuka ini tetap sync/instan; bacaan MD tampil di panel kanan (tombol Bacaan).
/* ─── getOpeningMessage: alur baru ─────────────────────────────────────────
 * 1. Pesan pertama = materi bacaan Markdown (placeholder; konten asli
 *    di-inject via injectBacaanIntoOpening() setelah prefetch selesai).
 *    Pesan ini punya flag isBacaan: true + showReadBtn: true.
 * 2. Input chat DINONAKTIFKAN sampai siswa klik tombol "Selesai Membaca".
 * 3. Setelah klik → pesan opening pertanyaan kritis muncul → chat aktif.
 * ─────────────────────────────────────────────────────────────────────── */
const getOpeningMessage = (mapelId, mapelLabel, materiId, studiSessions, source) => {
    if (!materiId || !mapelId) {
        return [{ id: Date.now(), role: 'ai', text: 'Terjadi kesalahan saat memuat sub-materi. Silakan kembali.', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), team: 'Tim 5' }];
    }
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    // Pesan bacaan — konten placeholder akan diganti oleh injectBacaanIntoOpening() setelah prefetch
    const bacaanId = Date.now();
    return [{
        id: bacaanId,
        role: 'ai',
        text: `*⏳ Memuat materi bacaan...*`,
        isMateri: true,
        isBacaan: true,    // flag: pesan ini berisi konten bacaan
        showReadBtn: true, // flag: tampilkan tombol "Selesai Membaca"
        isMarkdown: true,
        time: now,
        team: 'Tim 5',
        materiId,
        mapelLabel,
        sapaan: '',
    }];
};

// Dipanggil setelah confContent ter-update (prefetch selesai) untuk meng-inject teks bacaan asli
const injectBacaanIntoOpening = (msgs, bacaanByLevel, currentLevel, sapaan, materiId) => {
    const text = bacaanByLevel?.[currentLevel] || bacaanByLevel?.['low'];
    if (!text) return msgs; // belum ada konten, biarkan placeholder
    return msgs.map(m => {
        if (m.isBacaan && m.showReadBtn) {
            return { ...m, text: text };
        }
        return m;
    });
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
const NODE_R = 10;
const NODE_FONT_SIZE = 11;         // px, font node biasa
const NODE_ROOT_FONT_SIZE = 12;    // px, font node root
const NODE_PADDING_X = 16;        // padding kiri-kanan dalam node
const NODE_PADDING_Y = 10;        // padding atas-bawah dalam node
const NODE_MAX_W = 200;           // batas maksimal lebar node (px)
const NODE_MIN_W = 80;            // batas minimal lebar node (px)
const CHARS_PER_LINE = 22;        // estimasi karakter per baris pada NODE_MAX_W
const LINE_H = NODE_FONT_SIZE + 4; // tinggi per baris teks
const LEVEL_GAP_X = 220;          // jarak horizontal antar level (harus > NODE_MAX_W)
const LEVEL_GAP_Y = 14;           // jarak vertikal antar node (spacing murni, bukan tinggi node)


// Helper: hitung dimensi node dari label
const getNodeSize = (label, isRoot = false) => {
    const safeLabel = (label || '').trim() || '—';
    const fs = isRoot ? NODE_ROOT_FONT_SIZE : NODE_FONT_SIZE;
    const charsPerLine = Math.floor((NODE_MAX_W - NODE_PADDING_X * 2) / (fs * 0.6));
    const words = safeLabel.split(' ');   // ← safeLabel
    const lines = [];
    let current = '';
    words.forEach(word => {
        const test = current ? `${current} ${word}` : word;
        if (test.length > charsPerLine && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    });
    if (current) lines.push(current);


    const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
    const rawW = longestLine * fs * 0.6 + NODE_PADDING_X * 2;
    const w = Math.min(NODE_MAX_W, Math.max(NODE_MIN_W, rawW));
    const h = lines.length * (fs + 4) + NODE_PADDING_Y * 2;
    return { w, h, lines, fs };
};


// ✅ SESUDAH — layoutTree dengan ukuran node dinamis
function layoutTree(node, depth = 0, startY = 0) {
    const isRoot = depth === 0;
    const { h } = getNodeSize(node.label || '', isRoot);
    const children = node.children || [];
    if (children.length === 0) {
        const slotH = h + LEVEL_GAP_Y;
        return { ...node, depth, y: startY, nodeH: h, subtreeH: slotH, layoutChildren: [] };
    }
    let curY = startY;
    const laid = children.map(c => {
        const n = layoutTree(c, depth + 1, curY);
        curY += n.subtreeH;
        return n;
    });
    const totalH = laid.reduce((s, n) => s + n.subtreeH, 0);
    const selfY = startY + (totalH - h) / 2;
    return { ...node, depth, y: selfY, nodeH: h, subtreeH: totalH, layoutChildren: laid };
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
    const svgW = padding * 2 + (maxDepth + 1) * LEVEL_GAP_X + NODE_MAX_W;
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y + n.nodeH));
    const svgH = maxY - minY + padding * 2 + 20;


    const nodeX = (depth) => padding + depth * LEVEL_GAP_X;
    const nodeY = (n) => n.y - minY + padding;
    const nodeCY = (n) => nodeY(n) + n.nodeH / 2;


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
                            const fromSize = getNodeSize(e.from.label || '', e.from.depth === 0);
                            const x1 = nodeX(e.from.depth) + fromSize.w;
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
                                    {(() => {
                                        const { w, h, lines, fs } = getNodeSize(n.label || '', isRoot);
                                        const totalTextH = lines.length * (fs + 4);
                                        const textStartY = y + (h - totalTextH) / 2 + fs;
                                        return (
                                            <>
                                                <rect x={x} y={y} width={w} height={h}
                                                    rx={NODE_R} ry={NODE_R}
                                                    fill={isRoot ? c : `${c}18`}
                                                    stroke={c} strokeWidth={isRoot ? 0 : 1.5} />
                                                <text
                                                    textAnchor="middle"
                                                    fill={isRoot ? '#fff' : c}
                                                    fontSize={fs} fontWeight={isRoot ? 700 : 600}
                                                    fontFamily="system-ui,sans-serif"
                                                    style={{ userSelect: 'none' }}>
                                                    {lines.map((line, li) => (
                                                        <tspan key={li} x={x + w / 2} y={textStartY + li * (fs + 4)}>
                                                            {line}
                                                        </tspan>
                                                    ))}
                                                </text>
                                            </>
                                        );
                                    })()}
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
// ─── Flashcard adaptive font helper ───────────────────────────────────────
// Menentukan ukuran font berdasarkan panjang teks agar tidak overflow.
// Min 50 char → font besar; mendekati 150 char → font mengecil otomatis.
const flashcardFontSize = (text = '') => {
    const len = text.length;
    if (len <= 60) return FS.xl;   // 16px — pendek, besar
    if (len <= 90) return FS.lg;   // 14px — sedang
    if (len <= 120) return FS.base; // 13px — agak panjang
    return FS.sm;                   // 11px — mendekati 150 char
};

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
                    minHeight: 200,
                    height: flashFlipped
                        ? Math.max(200, Math.ceil((card.belakang?.length || 0) / 1.8) + 120)
                        : Math.max(200, Math.ceil((card.depan?.length || 0) / 1.8) + 120),
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
                        <div style={{ fontSize: flashcardFontSize(card.depan), fontWeight: 700, color: C.dark, lineHeight: 1.6 }}>
                            {card.depan}
                        </div>
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
                        <div style={{ fontSize: flashcardFontSize(card.belakang), color: '#fff', lineHeight: 1.7, fontWeight: 500 }}>
                            {card.belakang}
                        </div>
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

/* ═══════════════ BACAAN VIEW (Panel Kanan) ══════════════════════ */
const BacaanView = ({ bacaanData, currentLevel, color, materiId }) => {
    const LEVEL_LABELS = { low: 'Low', mid: 'Mid', high: 'High' };
    const text = bacaanData?.byLevel?.[currentLevel] || bacaanData?.byLevel?.['low'] || null;

    if (!text) {
        return (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#718096' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📖</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Konten bacaan belum tersedia</div>
                <div style={{ fontSize: FS.sm }}>Bacaan untuk level {LEVEL_LABELS[currentLevel]} akan muncul setelah konten dimuat dari server.</div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, flex: 1 }}>
                    📖 Bacaan: {materiId}
                </div>
                <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, fontWeight: 700, border: `1px solid ${color}44` }}>
                    Level {LEVEL_LABELS[currentLevel]}
                </span>
            </div>
            <div style={{ fontSize: FS.sm, color: '#718096', marginBottom: 16 }}>
                Materi bacaan sesuai level aktifmu — baca dan pahami sebelum mengerjakan quiz.
            </div>
            <div
                style={{
                    background: '#F7FBFF',
                    border: `1.5px solid ${color}30`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    lineHeight: 1.8,
                    fontSize: FS.base,
                    color: C.dark,
                }}
            >
                {renderMarkdown(text)}
            </div>
            <div style={{ marginTop: 14, background: '#EBF8FF', borderRadius: 10, padding: '10px 14px', fontSize: FS.sm, color: '#2B6CB0', display: 'flex', gap: 8 }}>
                <span>💡</span>
                <span>Setelah membaca materi ini, kerjakan Flashcard untuk memantapkan hafalan, lalu selesaikan Quiz MC + Essay.</span>
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
    confContent, setConfContent, confOverlay, setConfOverlay,
    flashIdx, setFlashIdx, flashFlipped, setFlashFlipped,
    quizActive, setQuizActive, quizAnswers, setQuizAnswers, quizSubmitted, setQuizSubmitted,
    progressData, setProgressData,
    messagesEnd, chatFileRef, chatAttachments, setChatAttachments,
    setActivePage,
    camGranted, setCamGranted,
    addRecentActivity,
    openGame,
    sessionStreamRef,
    sessionVideoRef,
    stopSessionCamera,
}) => {
    const { isMobile, isTablet } = useBreakpoint();
    const [showRightPanelMobile, setShowRightPanelMobile] = useState(false);
    const [materiId, setSubMateri] = useState(null);
    const [openDrops, setOpenDrops] = useState({});
    const [confModal, setConfModal] = useState(null);
    const [pendingQuizResult, setPendingQuizResult] = useState(null);
    // readDone[key] = true setelah siswa klik "Selesai Membaca" pada topik key
    const [readDone, setReadDone] = useState(() => {
        try {
            const raw = localStorage.getItem(`sr_read_done`);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    });

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
    const rightPanelWidth = isMobile
        ? (showRightPanelMobile ? '100%' : 0)
        : isTablet
            ? (quizHistoryModal ? 320 : confModal ? 320 : 200)
            : (quizHistoryModal ? 380 : confModal ? 380 : 238);

    /* ── [TIM 5] Context Injection Pasca-Kuis ──────────────────────────
     * Setiap kali needsQuizAnalysis berubah jadi true dan ada quiz result,
     * kita susun pesan pembuka diskusi dari Kak Nusa — bukan langsung evaluasi,
     * tapi menanyakan soal mana yang ingin dibahas dulu.
     * Fase 3: digantikan stream dari Tim 5.
     */
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

    /* ── Anti-Cheating Monitor (Tab / Window Switch Detection) ───── */
    // Strategi baru: TIDAK pakai fullscreen.
    // Pelanggaran = siswa pindah tab lain atau split/minimize window (visibilitychange / blur).
    // Cek kamera via button di panel kiri — tidak trigger pelanggaran.
    const isExitingSession = useRef(false);
    // Flag: sedang buka file dialog OS (blur browser tapi bukan pindah tab — bukan pelanggaran)
    const isOpeningFileDialog = useRef(false);
    // Flag: webcam preview modal sedang terbuka (blur karena modal internal — bukan pelanggaran)
    const isWebcamPreviewOpen = useRef(false);
    const [violationModal, setViolationModal] = useState(null); // { detail, count }
    const violationCount = useRef(0);

    /* ── Webcam Preview Modal state ────────────────────────────────
     * Modal in-page untuk siswa cek posisi kamera tanpa keluar halaman.
     * Dibuka via button "Kamera Aktif" di panel kiri.
     * ─────────────────────────────────────────────────────────────── */
    const [showWebcamPreview, setShowWebcamPreview] = useState(false);
    const previewVideoRef = useRef(null);
    // TIDAK membuat stream baru — re-use sessionStreamRef yang sudah aktif dari startChat

    const openWebcamPreview = useCallback(() => {
        isWebcamPreviewOpen.current = true;
        setShowWebcamPreview(true);
        // Attach stream sesi ke preview video element setelah render
        setTimeout(() => {
            if (previewVideoRef.current && sessionStreamRef?.current) {
                previewVideoRef.current.srcObject = sessionStreamRef.current;
                previewVideoRef.current.play().catch(() => { });
            }
        }, 80);
    }, [sessionStreamRef]);

    const closeWebcamPreview = useCallback(() => {
        // JANGAN stop stream — stream sesi harus tetap berjalan
        // Cukup detach dari preview video element
        if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = null;
        }
        setShowWebcamPreview(false);
        setTimeout(() => { isWebcamPreviewOpen.current = false; }, 150);
    }, []);

    // V3.3: ref sebagai bridge — useWebSocket dipanggil sebelum handleEssayDinilaiPayload
    // dideklarasikan (karena activeKey belum ada). Ref memungkinkan callback terdaftar
    // sekarang tapi eksekusinya menunggu sampai fungsi asli siap.
    const essayDinilaiRef = useRef(null);
    const { liveStudents: _ls, ...wsHook } = useWebSocket({
        kelasId: 'kelas1',
        guruId: 'g1',
        enabled: false,
        onEssayDinilai: (payload) => essayDinilaiRef.current?.(payload),
    });

    const sendViolationToTeacher = useCallback((detail) => {
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
        if (isExitingSession.current) return;
        if (isOpeningFileDialog.current) return;
        if (isWebcamPreviewOpen.current) return; // buka modal webcam — bukan pelanggaran
        violationCount.current += 1;
        setViolationModal({ detail, count: violationCount.current });
        sendViolationToTeacher(detail);
        sessionTelemetry.reportViolation(detail); // catat ke telemetry → PATCH /sesi/:id
    }, [sendViolationToTeacher]);

    // reEnterFullscreen tidak lagi diperlukan — diganti noOp untuk kompatibilitas referensi file dialog
    const reEnterFullscreen = useCallback(() => { /* no-op: tidak pakai fullscreen */ }, []);

    // Fungsi safe exit — dipanggil tombol Kembali
    const handleSafeBack = useCallback(() => {
        isExitingSession.current = true;
        // Matikan kamera sesi — SATU-SATUNYA tempat stream dimatikan
        stopSessionCamera?.();
        // Kirim durasi + violations final ke BE sebelum keluar
        sessionTelemetry.end(useStudentStore.getState().currentEmosi || null);
        // Kirim status inactive ke teacher
        window.dispatchEvent(new CustomEvent('sr_student_violation', {
            detail: {
                type: 'student_inactive',
                siswa: { id: 'siswa1', nama: 'Budi Santoso', avatar: 'BS' },
                payload: { materiId: 'exit' },
                timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            }
        }));
        // Navigasi
        setActivePage('dashboard');
        setChatMateri(null);
        setSubMateri(null);
    }, [setActivePage, setChatMateri, stopSessionCamera]);

    // Setup & cleanup anti-cheating: deteksi pindah tab / split window
    useEffect(() => {
        if (!camGranted) return;
        isExitingSession.current = false;
        violationCount.current = 0;

        let pendingBlurTimer = null;

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // Batalkan pending blur — blur itu adalah efek samping minimize/tab-switch, bukan aksi terpisah
                if (pendingBlurTimer) { clearTimeout(pendingBlurTimer); pendingBlurTimer = null; }
                handleViolation('Berpindah Tab / Menyembunyikan Halaman');
            }
        };

        const onWindowBlur = () => {
            // Tahan eksekusi 80ms — beri kesempatan visibilitychange menyusul (kasus minimize)
            // Jika visibilitychange datang dalam window ini, timer dibatalkan di atas → tidak double-count
            pendingBlurTimer = setTimeout(() => {
                pendingBlurTimer = null;
                // Jika halaman sudah hidden berarti visibilitychange sudah fired dan menanganinya — skip
                if (document.visibilityState === 'hidden') return;
                handleViolation('Membuka Aplikasi / Window Lain');
            }, 80);
        };
        // ── 3. Window resize — browser diperkecil (split-screen / snap window) ──
        // Baseline diambil saat sesi dimulai; jika lebar turun >25% → pelanggaran
        const BASE_WIDTH = window.innerWidth;
        const SHRINK_THRESHOLD = 0.75; // toleransi: lebar turun lebih dari 25%
        let resizeViolationFired = false; // hanya trigger sekali per "kejadian" mengecil

        const onWindowResize = () => {
            const ratio = window.innerWidth / BASE_WIDTH;
            if (ratio < SHRINK_THRESHOLD) {
                if (!resizeViolationFired) {
                    resizeViolationFired = true;
                    handleViolation('Browser Diperkecil / Split Screen');
                }
            } else {
                // Browser kembali normal → reset flag agar bisa deteksi lagi jika mengecil ulang
                resizeViolationFired = false;
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('blur', onWindowBlur);
        window.addEventListener('resize', onWindowResize);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('blur', onWindowBlur);
            window.removeEventListener('resize', onWindowResize);
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
    // FIX D: getSessions() menggabungkan dua sumber:
    //  1. msgsByKey — topik yang SUDAH dibuka sesi ini (ada pesan chatnya)
    //  2. progressData.sudahSelesai + belumSelesai — topik dari SEMUA sesi sebelumnya
    //     yang tersimpan di store (persisten selama session browser tidak di-refresh)
    // Gabungkan keduanya dan deduplikasi by materiId agar panel kiri menampilkan
    // seluruh riwayat elemen/materi yang pernah dipelajari di mapel yang sama.
    const getSessions = () => {
        const prefix = chatMateri.mapelId + '__';

        // Kumpulkan semua materiId dari msgsByKey (sesi aktif)
        const keySet = new Set(
            Object.keys(msgsByKey).filter(k => k.startsWith(prefix))
        );

        // Tambahkan materiId dari progressData (sesi sebelumnya di mapel yang sama)
        const progressEntries = [
            ...progressData.sudahSelesai,
            ...progressData.belumSelesai,
        ].filter(m => m.mapelId === chatMateri.mapelId && m.materiId);

        progressEntries.forEach(m => keySet.add(prefix + m.materiId));

        return [...keySet].map(k => {
            const sub = k.split('__').slice(1).join('__');
            const done_ = progressData.sudahSelesai.find(
                m => m.mapelId === chatMateri.mapelId && m.materiId === sub
            );
            const ong_ = progressData.belumSelesai.find(
                m => m.mapelId === chatMateri.mapelId && m.materiId === sub
            );
            return { k, sub, score: done_?.quizScore ?? null, done: !!done_, ongoing: !!ong_ };
        });
    };

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

        // Masalah 3: buat sesi segera saat siswa masuk chatbot
        // sesi_id harus ada dari awal agar durasi belajar akurat dan Tim 5 bisa
        // menyimpan konteks percakapan sejak pertama kali siswa membuka chatbot
        (async () => {
            const sesiId = await createSesi({
                siswa_id: chatMateri.siswaId || useStudentStore.getState().user?.id || 'usr_001',
                mapel_id: chatMateri.mapelId || '',
                elemen_id: chatMateri.elemenId || chatMateri.materiId || '',
                materi_id: chatMateri.materiId || null,
            });
            // Mulai tracking durasi — wajib agar PATCH /sesi/:id akurat
            sessionTelemetry.start(sesiId);
        })();

        // Siswa selalu masuk dengan topik yang sudah dipilih dari luar (rekomendasi / progress / search)
        if (chatMateri.materiId) {
            const topikKey = makeKey(chatMateri.mapelId, chatMateri.materiId);

            // Coba load history dari API (MSW intercept jika VITE_USE_MSW=true).
            // Jika topik belum pernah dibuka sesi ini, fetch history untuk restore percakapan lama.
            if (!msgsByKey[topikKey]) {
                const buildOpening = () => {
                    const sess = Object.keys(msgsByKey)
                        .filter(k => k.startsWith(chatMateri.mapelId + '__'))
                        .map(k => ({ k, sub: k.split('__').slice(1).join('__') }));
                    setMsgsByKey(p => ({
                        ...p,
                        [topikKey]: getOpeningMessage(
                            chatMateri.mapelId, chatMateri.mapelLabel,
                            chatMateri.materiId, sess, chatMateri.source || null
                        ),
                    }));
                };

                // FIX 3: selalu panggil getChatHistory — MSW intercept jika VITE_USE_MSW=true
                (async () => {
                    try {
                        const history = await getChatHistory({
                            siswa_id: chatMateri.siswaId || 'usr_001',
                            mapel_id: chatMateri.mapelId || '',
                            materi: chatMateri.mapelLabel || chatMateri.materiId || '',
                            materi_id: chatMateri.materiId || '',
                        });
                        // Hanya pakai history jika ada percakapan nyata (ada role 'user')
                        const hasRealConversation = Array.isArray(history) &&
                            history.some(m => m.role === 'user');
                        if (hasRealConversation) {
                            const converted = history.map((m, i) => ({
                                id: i + 1, role: m.role, text: m.text,
                                time: new Date(m.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                                team: m.team || undefined,
                            }));
                            setMsgsByKey(p => ({ ...p, [topikKey]: converted }));
                        } else {
                            buildOpening();
                        }
                    } catch {
                        buildOpening();
                    }
                })();
            }
            setSubMateri(chatMateri.materiId);

            // Hidrasi quizHistory + levelMap dari BE (GET /content/quiz/history).
            // Dipanggil setiap kali topik dibuka — hanya mengisi store jika store masih kosong
            // untuk topik ini, agar tidak menimpa data yang sudah ada di sesi aktif.
            // Ini memastikan riwayat quiz & status naik-level tidak hilang saat siswa refresh.
            const existingHistoryForKey = (useStudentStore.getState().quizHistory || {})[activeKey];
            if (!existingHistoryForKey || existingHistoryForKey.length === 0) {
                (async () => {
                    try {
                        const qh = await getQuizHistory({
                            siswa_id: chatMateri.siswaId || 'usr_001',
                            elemen_id: chatMateri.elemenId || chatMateri.materiId,
                            materi_id: chatMateri.materiId || null,
                        });
                        if (!qh) return;
                        // Hidrate levelMap (current_level dari BE)
                        if (qh.current_level) {
                            setLevelMap(p => ({
                                ...p,
                                // hanya set jika store lokal belum punya entry untuk key ini
                                [activeKey]: p[activeKey] ?? qh.current_level,
                            }));
                        }
                        // Hidrate quizHistory (history per level + locked flag dari BE)
                        if (Array.isArray(qh.history) && qh.history.length > 0) {
                            setQuizHistory(p => {
                                // Jangan timpa jika sudah ada dari sesi ini
                                if ((p[activeKey] || []).length > 0) return p;
                                // Konversi shape BE → shape store lokal
                                const converted = qh.history.map(item => ({
                                    type: item.type,
                                    level: item.level,
                                    score: item.score,
                                    locked: item.locked,   // flag read-only dari BE
                                    ts: new Date(item.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                                    // soalSnapshot, correct, dll tidak tersedia dari BE —
                                    // panel review detail hanya aktif untuk quiz sesi ini
                                }));
                                return { ...p, [activeKey]: converted };
                            });
                        }
                    } catch {
                        // silent — store lokal tetap dipakai sebagai fallback
                    }
                })();
            }

            // FIX 4b: REVISI FASE 3 -- prefetch bank konten guru (GET /content/siswa)
            // konten_list kini 16 item: bacaan*3 + quiz_pg*3 + quiz_essay*3 + flashcard*3 + mindmap*1 + game*3
            // SISTEM BACAAN MARKDOWN:
            //   Item tipe 'bacaan' berisi content.text dalam format Markdown.
            //   Disimpan di confContent[key].bacaan.byLevel[level] (Low/Mid/High).
            //   Panel kanan (tombol Bacaan) menampilkan teks MD sesuai level aktif siswa via renderMarkdown().
            // SISTEM GAME:
            //   Item tipe 'game' (mirror GET /game/list Tim 4) disimpan di confContent[key].game.byLevel[level].
            //   Tombol 'Main Game' menggunakan game sesuai level aktif siswa.
            const topikKeyForConf = makeKey(chatMateri.mapelId, chatMateri.materiId);
            (async () => {
                try {
                    const bank = await getKontenSiswa({
                        siswa_id: chatMateri.siswaId || 'usr_001',
                        mapel_id: chatMateri.mapelId,
                        materi_id: chatMateri.materiId,
                        elemen_id: chatMateri.elemenId || chatMateri.materiId,
                    });
                    if (!Array.isArray(bank) || !bank.length) return;
                    // Cari paket yang cocok — fallback ke paket pertama (toleran untuk mock)
                    const paket = bank.find(p =>
                        p.elemen_id === (chatMateri.elemenId || chatMateri.materiId) ||
                        p.materi_id === chatMateri.materiId ||
                        p.materi === chatMateri.materiId
                    ) || bank[0];
                    if (!paket?.konten_list?.length) return;

                    setConfContent(prev => {
                        const existing = prev[topikKeyForConf] || {};
                        const updated = { ...existing };
                        // Simpan atp dari paket untuk dipakai di mentor payload
                        if (paket.atp) updated._atp = paket.atp;
                        paket.konten_list.forEach(item => {
                            const tipeKey = item.tipe;
                            if (tipeKey === 'flashcard') {
                                if (!updated.flashcard?.generated) {
                                    const lb = getConfContent(chatMateri.materiId, chatMateri.mapelLabel).flashcard || {};
                                    updated.flashcard = {
                                        ...lb, generated: true,
                                        ...(Array.isArray(item.content?.cards) && item.content.cards.length ? { cards: item.content.cards } : {})
                                    };
                                }
                            } else if (tipeKey === 'mindmap') {
                                if (!updated.mindmap?.generated) {
                                    const lb = getConfContent(chatMateri.materiId, chatMateri.mapelLabel).mindmap || {};
                                    updated.mindmap = {
                                        ...lb, generated: true,
                                        // Contract Tim 3: mindmap content = { nodes: [...] }
                                        ...(Array.isArray(item.content?.nodes) && item.content.nodes.length
                                            ? { nodes: item.content.nodes }
                                            : {}),
                                    };
                                }
                            } else if (tipeKey === 'bacaan' && item.content?.text) {
                                // BACAAN MARKDOWN: simpan per level (lowercase), dirender via renderMarkdown() di panel kanan
                                if (!updated.bacaan) updated.bacaan = { generated: true, byLevel: {} };
                                else if (!updated.bacaan.byLevel) updated.bacaan.byLevel = {};
                                const lvKey = (item.level || 'low').toLowerCase(); // normalisasi: 'Low' → 'low'
                                updated.bacaan.byLevel[lvKey] = item.content.text;
                                updated.bacaan.generated = true;
                            } else if (tipeKey === 'game' && item.level) {
                                // GAME: simpan per level, tombol Main Game pakai game sesuai level aktif
                                if (!updated.game) updated.game = { generated: true, byLevel: {} };
                                else if (!updated.game.byLevel) updated.game.byLevel = {};
                                updated.game.byLevel[item.level] = item.content;
                                updated.game.generated = true;
                            } else if (tipeKey === 'quiz_pg' && item.level) {
                                // FIX T2: QUIZ PILIHAN GANDA — simpan per level dari API, override QUIZ_BANK_V2 lokal
                                if (!updated.quiz_pg) updated.quiz_pg = { generated: true, byLevel: {} };
                                else if (!updated.quiz_pg.byLevel) updated.quiz_pg.byLevel = {};
                                const lvKey = (item.level || 'low').toLowerCase();
                                if (Array.isArray(item.content?.soal) && item.content.soal.length) {
                                    updated.quiz_pg.byLevel[lvKey] = item.content.soal;
                                }
                                updated.quiz_pg.generated = true;
                            } else if (tipeKey === 'quiz_essay' && item.level) {
                                // FIX T2: QUIZ ESSAY — simpan per level dari API, override bank lokal
                                if (!updated.quiz_essay) updated.quiz_essay = { generated: true, byLevel: {} };
                                else if (!updated.quiz_essay.byLevel) updated.quiz_essay.byLevel = {};
                                const lvKey = (item.level || 'low').toLowerCase();
                                if (Array.isArray(item.content?.pertanyaan) && item.content.pertanyaan.length) {
                                    updated.quiz_essay.byLevel[lvKey] = item.content.pertanyaan;
                                }
                                updated.quiz_essay.generated = true;
                            }
                        });
                        return { ...prev, [topikKeyForConf]: updated };
                    });
                } catch { /* silent -- konten lokal dari getConfContent dipakai jika bank kosong */ }
            })();
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

    /* ── V3.3: essay_dinilai handler — diletakkan setelah activeKey ── */
    // activeKey, chatMateri, materiId sudah tersedia di titik ini
    const handleEssayDinilaiPayload = useCallback((payload) => {
        const { level, nilai_essay, nilai_mc, agregasi, naik_level, kkm } = payload || {};
        const KKM_WS = kkm ?? KKM_AGREGASI;
        const LEVEL_ORDER_WS = ['low', 'mid', 'high'];
        const LEVEL_LABELS_WS = { low: 'Low', mid: 'Mid', high: 'High' };

        // Step 1: Update score essay di quizHistory
        setQuizHistory(p => ({
            ...p,
            [activeKey]: (p[activeKey] || []).map(r =>
                r.type === 'essay' && (r.level || 'low') === level
                    ? { ...r, score: nilai_essay }
                    : r
            ),
        }));

        // Step 2: Hapus pesan sistem "sedang dinilai"
        setMsgsByKey(p => ({
            ...p,
            [activeKey]: (p[activeKey] || []).filter(m => !m.isSystem || !m.text?.includes('sedang dinilai')),
        }));

        // FIX #2: Jangan hanya percaya flag naik_level dari WS payload.
        // Re-kalkulasi dari quizHistory aktual sebagai source of truth.
        //
        // Masalah sebelumnya: mock WS bisa mengirim naik_level: false
        // (karena essayNilai random 60–95 bisa menghasilkan agregasi < 75),
        // sehingga level tidak naik meskipun agregasi yang tampil di UI >= KKM.
        //
        // Solusi: Ambil nilai MC dari quizHistory yang sudah tersimpan saat MC submit,
        // gabungkan dengan nilai_essay dari WS event, lalu hitung agregasi ulang.
        // Ini juga memastikan konsistensi antara display UI dan logika naik level.
        const currentHistory = (useStudentStore.getState().quizHistory || {})[activeKey] || [];

        // Bangun riwayat terbaru — gabungkan record yang sudah ada dengan essay yang baru dinilai
        const updatedHistory = currentHistory.map(r =>
            r.type === 'essay' && (r.level || 'low') === level
                ? { ...r, score: nilai_essay }
                : r
        );

        // Cari nilai MC dari quizHistory (lebih akurat dari nilai_mc WS yang bisa hardcode)
        const mcRec = updatedHistory.find(r =>
            (r.type === 'mc' || !r.type) && (r.level || 'low') === level
        );
        const essayRec = updatedHistory.find(r =>
            r.type === 'essay' && (r.level || 'low') === level
        );

        // Gunakan nilai dari quizHistory jika ada, fallback ke nilai dari WS payload
        const finalMcScore = mcRec?.score ?? nilai_mc ?? null;
        const finalEssayScore = essayRec?.score ?? nilai_essay ?? null;

        // Hitung agregasi dari nilai aktual (bukan dari WS payload yang bisa tidak akurat di mock)
        let finalAgregasi = agregasi; // default: gunakan dari WS jika tidak bisa dihitung ulang
        let shouldNaikLevel = false;

        if (finalMcScore != null && finalEssayScore != null) {
            // Kedua nilai tersedia → hitung agregasi yang akurat
            finalAgregasi = Math.round(finalMcScore * MC_WEIGHT + finalEssayScore * ESSAY_WEIGHT);
            shouldNaikLevel = finalAgregasi >= KKM_WS;
        } else if (agregasi != null) {
            // Fallback ke agregasi dari WS (untuk BE real yang sudah menghitung di server)
            finalAgregasi = agregasi;
            shouldNaikLevel = naik_level === true && agregasi >= KKM_WS;
        }

        if (shouldNaikLevel) {
            const curLvlIdx = LEVEL_ORDER_WS.indexOf(level);
            const nxtLvl = LEVEL_ORDER_WS[Math.min(curLvlIdx + 1, LEVEL_ORDER_WS.length - 1)];
            const isAtMax = level === 'high';
            if (!isAtMax) {
                setLevelMap(p => ({ ...p, [activeKey]: nxtLvl }));
                const store = useStudentStore.getState();
                const elId = chatMateri?.elemenId;
                if (elId) {
                    const materiPerElemen = (MATERI_PER_ELEMEN[chatMateri.mapelId] || {})[elId] || [];
                    if (materiPerElemen.length > 0 && materiId) {
                        store.setMateriLevel(chatMateri.mapelId, elId, materiId, nxtLvl);
                    } else {
                        store.setElemenLevel(chatMateri.mapelId, elId, nxtLvl);
                    }
                }
                // Tandai semua record di level lama sebagai locked
                setQuizHistory(p => ({
                    ...p,
                    [activeKey]: (p[activeKey] || []).map(r =>
                        (r.level || 'low') === level ? { ...r, locked: true } : r
                    ),
                }));
                const levelUpMsg = {
                    id: Date.now() + 5, role: 'ai', isLevelUp: true,
                    fromLevel: level, toLevel: nxtLvl,
                    text: `🎉 Selamat! Kamu berhasil naik ke **Level ${LEVEL_LABELS_WS[nxtLvl]}**!\n\n📊 **Rekap Nilai:**\n- Pilihan Ganda: ${finalMcScore}/100\n- Essay: ${finalEssayScore}/100\n- **Nilai Agregasi (MC×60%+Essay×40%): ${finalAgregasi}/100** ✅\n\nSemua konten materi **${materiId || chatMateri?.elemenLabel || ''}** sekarang naik ke Level ${LEVEL_LABELS_WS[nxtLvl]}. Riwayat Level ${LEVEL_LABELS_WS[level]} masih bisa kamu lihat di panel kanan. Terus semangat! 💪`,
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                };
                setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), levelUpMsg] }));
            }
        }
    }, [activeKey, chatMateri, materiId, setLevelMap, setQuizHistory, setMsgsByKey]);

    // Assign ref setelah fungsi siap — bridge untuk useWebSocket yang dipanggil lebih awal
    essayDinilaiRef.current = handleEssayDinilaiPayload;

    // V3.3: listen mock_ws_essay_dinilai (MSW dev mode)
    // Di production: event datang dari WebSocket real via useWebSocket onEssayDinilai
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.payload) handleEssayDinilaiPayload(e.detail.payload);
        };
        window.addEventListener('mock_ws_essay_dinilai', handler);
        return () => window.removeEventListener('mock_ws_essay_dinilai', handler);
    }, [handleEssayDinilaiPayload]);

    // Inject konten bacaan ke pesan chat setelah prefetch selesai (mengganti placeholder "Memuat...")
    useEffect(() => {
        const bacaanByLevel = kConf.bacaan?.byLevel;
        if (!bacaanByLevel || !activeKey) return;
        setMsgsByKey(p => {
            // Jika msgsByKey[activeKey] belum ada, inisialisasi dari getOpeningMessage
            const existing = p[activeKey] || (materiId
                ? getOpeningMessage(chatMateri.mapelId, chatMateri.mapelLabel, materiId, sessions, null)
                : null);
            if (!existing) return p;
            const hasBacaanMsg = existing.some(m => m.isBacaan);
            if (!hasBacaanMsg) return p;
            const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
            const firstBacaan = existing.find(m => m.isBacaan);
            const injected = injectBacaanIntoOpening(existing, bacaanByLevel, currentLvl, firstBacaan?.sapaan || '', firstBacaan?.materiId || materiId);
            // Hanya update jika benar-benar berubah (cegah infinite loop)
            if (injected === existing) return p;
            return { ...p, [activeKey]: injected };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kConf.bacaan, activeKey]);

    // Chat diblokir sampai siswa klik "Selesai Membaca" pada topik aktif
    const isChatBlocked = !readDone[activeKey] && msgs.some(m => m.isBacaan && m.showReadBtn);

    const quizData = getQuizV2(activeKey);
    const quizSoal = quizData.multipleChoice; // untuk review di panel detail riwayat
    const quizResultRecord = progressData.sudahSelesai.find(m => m.mapelId === chatMateri.mapelId && m.materiId === materiId);
    const allHistory = quizHistory[activeKey] || [];
    const mcHistory = allHistory.filter(r => r.type === 'mc' || !r.type); // backward compat
    const essayHistory = allHistory.filter(r => r.type === 'essay');
    // REVISI: nilai yang dipakai = nilai terbaru (1 riwayat per level, sudah di-replace saat submit)
    const mcLatestRecord = mcHistory.length > 0 ? mcHistory[mcHistory.length - 1] : null;
    const mcLatestScore = mcLatestRecord?.score ?? null;

    /* ── Selesai Membaca → unlock chat + minta Tim 5 generate pertanyaan pembuka ── */
    const handleSelesaiBaca = () => {
        // Unlock input chat
        setReadDone(p => {
            const updated = { ...p, [activeKey]: true };
            try { localStorage.setItem('sr_read_done', JSON.stringify(updated)); } catch { }
            return updated;
        });

        // hardcode dari FE, tidak panggil Tim 5
        const currentLevel = levelMap[activeKey] || 'low';
        const LEVEL_LABELS = { low: 'Low', mid: 'Mid', high: 'High' };
        const openingMsg = {
            id: Date.now() + 1,
            role: 'ai',
            text: `Bagus! Kamu sudah selesai membaca materi **${materiId}** level **${LEVEL_LABELS[currentLevel]}**. 🎉\n\nSekarang saatnya memantapkan pemahamanmu:\n- 🃏 **Flashcard** — latihan hafalan aktif\n- 📝 **Quiz MC** — uji pemahaman konsep\n- ✍️ **Essay** — dalami dengan analisismu sendiri\n\nMulai dari mana dulu? Atau ada bagian dari bacaan tadi yang ingin kamu tanyakan? 😊`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), openingMsg] }));

    };

    /* ── Send message — FIX P0: pakai api/mentor sendMessage/streamMessage ── */
    const cancelStreamRef = useRef(null);

    /**
     * dispatchMentorMessage — core transport ke Tim 5 API.
     * Memisahkan "kirim teks ke mentor" dari input-state agar bisa dipanggil
     * oleh sendMsg() (chat normal) dan startQuizDiscussion() (CTA flow).
     *
     * @param {string} text        — teks pesan yang akan dikirim
     * @param {object} [opts]
     * @param {string|null} [opts.hasil_quiz_id]  — V3.2: dikirim di body POST /mentor/pesan
     *                                              BE Tim 6 inject konteks quiz ke Tim 5
     * @param {boolean} [opts.suppressUserBubble] — true → jangan render user bubble (CTA opener)
     */
    const dispatchMentorMessage = async (text, opts = {}) => {
        if (!text?.trim()) {
            console.warn('[CTA] dispatchMentorMessage: text kosong, dibatalkan');
            return;
        }
        if (!chatMateri) {
            console.warn('[CTA] dispatchMentorMessage: chatMateri belum ada, dibatalkan');
            return;
        }
        if (!activeKey) {
            console.warn('[CTA] dispatchMentorMessage: activeKey belum ada, dibatalkan');
            return;
        }

        const { hasil_quiz_id = null, suppressUserBubble = false } = opts;

        // Tampilkan user bubble kecuali CTA opener (suppressUserBubble)
        if (!suppressUserBubble) {
            const userMsg = {
                id: Date.now(), role: 'user', text,
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            };
            setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), userMsg] }));
        }

        setTyping(true);

        // Bangun payload sesuai MentorChatPayload contract Tim 5
        const siswaId = chatMateri?.siswaId || 'usr_001';
        const currentEmosi = useStudentStore.getState().currentEmosi || null;
        const elemenId = chatMateri?.elemenId || '';
        const elemenLabel = chatMateri?.elemenLabel || chatMateri?.mapelLabel || '';
        const activeLevelRaw = levelMap[activeKey] || chatMateri?.level || 'low';
        const activeLevelForMentor = activeLevelRaw.charAt(0).toUpperCase() + activeLevelRaw.slice(1).toLowerCase();
        const atpForMentor = confContent[activeKey]?._atp || confContent[makeKey(chatMateri?.mapelId, chatMateri?.materiId)]?._atp || '';

        // Bacaan level aktif — dikirim flat di konteks, Tim 5 gunakan sebagai referensi materi.
        const kNow = confContent[activeKey] || confContent[makeKey(chatMateri?.mapelId, chatMateri?.materiId)] || {};
        const lvl = (levelMap[activeKey] || chatMateri?.level || 'low').toLowerCase();
        const bacaanKonteks = kNow.bacaan?.byLevel?.[lvl]?.slice(0, 3000) || '';
        const storeHasilQuizId = useStudentStore.getState().ctaHasilQuizId ?? null;
        if (storeHasilQuizId) useStudentStore.getState().clearCtaHasilQuizId();
        const effectiveHasilQuizId = hasil_quiz_id || storeHasilQuizId || null;

        const payload = {
            siswa_id: siswaId,
            mapel_id: chatMateri?.mapelId || '',
            elemen_id: elemenId,
            elemen_label: elemenLabel,
            materi: chatMateri?.mapelLabel || materiId || null,
            materi_id: materiId || null,
            atp: atpForMentor,
            level: activeLevelForMentor,
            message: text,
            context: {
                emosi: currentEmosi,
                progress: null,
                publish_id: kNow._publishId || null,
                bacaan: bacaanKonteks,
            },
            // V3.2: hasil_quiz_id dikirim di body POST /mentor/pesan — bukan di POST /sesi
            // BE Tim 6 akan lookup dan inject konteks quiz ke Tim 5 secara internal
            ...(effectiveHasilQuizId ? { hasil_quiz_id: effectiveHasilQuizId } : {}),
        };

        console.log('[Mentor] dispatchMentorMessage payload:', {
            activeKey,
            message: text.slice(0, 60) + (text.length > 60 ? '…' : ''),
            has_hasil_quiz_id: !!effectiveHasilQuizId,
            suppressUserBubble,
        });

        try {
            // FIX 4: hapus gate USE_MENTOR_API — selalu panggil API (MSW intercept jika aktif)
            if (USE_STREAM) {
                // Streaming mode — token demi token
                if (cancelStreamRef.current) cancelStreamRef.current();
                let accumulated = '';
                const streamingMsgId = Date.now() + 1;
                // Tambahkan placeholder pesan AI untuk diisi stream
                setMsgsByKey(p => ({
                    ...p,
                    [activeKey]: [...(p[activeKey] || []), {
                        id: streamingMsgId, role: 'ai', text: '', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), team: 'Tim 5',
                    }],
                }));
                setTyping(false);
                cancelStreamRef.current = effectiveHasilQuizId
                    // V3.3 REFACTOR 4: evaluasi quiz → endpoint terpisah POST /mentor/evaluasi/stream
                    ? streamEvaluasi(
                        {
                            siswa_id: payload.siswa_id,
                            mapel_id: payload.mapel_id,
                            elemen_id: payload.elemen_id,
                            elemen_label: payload.elemen_label,
                            materi: payload.materi,
                            materi_id: payload.materi_id,
                            level: payload.level,
                            atp: payload.atp,
                            hasil_quiz_id: effectiveHasilQuizId,
                        },
                        (chunk) => {
                            accumulated += chunk;
                            setMsgsByKey(p => {
                                const msgs = p[activeKey] || [];
                                return {
                                    ...p,
                                    [activeKey]: msgs.map(m => m.id === streamingMsgId ? { ...m, text: accumulated } : m),
                                };
                            });
                        },
                        () => {
                            // onDone
                            cancelStreamRef.current = null;
                            setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
                        },
                        () => {
                            // onError — tampilkan pesan fallback
                            cancelStreamRef.current = null;
                            setMsgsByKey(p => {
                                const msgs = p[activeKey] || [];
                                return {
                                    ...p,
                                    [activeKey]: msgs.map(m => m.id === streamingMsgId
                                        ? { ...m, text: accumulated || '⚠️ Koneksi terputus. Coba kirim ulang pesanmu.' }
                                        : m),
                                };
                            });
                        },
                    )
                    // Chat normal → POST /mentor/pesan (tanpa hasil_quiz_id di V3.3)
                    : streamMessage(
                        payload,
                        (chunk) => {
                            accumulated += chunk;
                            setMsgsByKey(p => {
                                const msgs = p[activeKey] || [];
                                return {
                                    ...p,
                                    [activeKey]: msgs.map(m => m.id === streamingMsgId ? { ...m, text: accumulated } : m),
                                };
                            });
                        },
                        () => {
                            cancelStreamRef.current = null;
                            setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
                        },
                        () => {
                            cancelStreamRef.current = null;
                            setMsgsByKey(p => {
                                const msgs = p[activeKey] || [];
                                return {
                                    ...p,
                                    [activeKey]: msgs.map(m => m.id === streamingMsgId
                                        ? { ...m, text: accumulated || '⚠️ Koneksi terputus. Coba kirim ulang pesanmu.' }
                                        : m),
                                };
                            });
                        },
                    );
            } else {
                // Non-streaming — tunggu full response (atau MSW mock response)
                // V3.3 REFACTOR 4: route ke sendEvaluasi jika ada hasil_quiz_id
                const res = effectiveHasilQuizId
                    ? await sendEvaluasi({
                        siswa_id: payload.siswa_id,
                        mapel_id: payload.mapel_id,
                        elemen_id: payload.elemen_id,
                        elemen_label: payload.elemen_label,
                        materi: payload.materi,
                        materi_id: payload.materi_id,
                        level: payload.level,
                        atp: payload.atp,
                        hasil_quiz_id: effectiveHasilQuizId,
                    })
                    : await sendMessage(payload);
                const aiReply = {
                    id: Date.now() + 1,
                    role: 'ai',
                    text: res.reply || '😊 Mentor sedang memproses jawabanmu...',
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                    team: 'Tim 5',
                };
                setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), aiReply] }));
                setTyping(false);
                setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
            }
        } catch {
            // Fallback lokal jika API tidak tersedia
            const topikCtx = materiId || chatMateri?.mapelLabel;
            const aiReply = {
                id: Date.now() + 1, role: 'ai',
                text: `Pertanyaan bagus tentang **${topikCtx}**! 😊\n\nMari kita telaah lebih dalam. Konsep kunci yang perlu dipahami:\n\n1. Pahami definisi dasarnya terlebih dahulu\n2. Lihat contoh nyata di sekitar kita\n3. Coba kerjakan soal latihan untuk memastikan pemahamanmu\n\nApa yang masih membingungkan?`,
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), team: 'Tim 5',
            };
            setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), aiReply] }));
            setTyping(false);
            setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
    };

    /**
     * sendMsg — dipanggil saat user kirim pesan via input bar (chat normal).
     * Delegate ke dispatchMentorMessage dengan teks dari input state.
     */
    const sendMsg = async () => {
        if (!input.trim() && !chatAttachments.length) return;
        const sentText = input;
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = '38px';
        await dispatchMentorMessage(sentText);
    };

    /**
     * startQuizDiscussion — CTA "Tanya Kak Nusa" orchestration.
     *
     * Dipanggil oleh useEffect saat needsQuizAnalysis === true.
     * Flow:
     *   1. Bangun opener message dari data quiz
     *   2. Render user-visible trigger bubble (badge "📊 Evaluasi Kuis")
     *   3. Call dispatchMentorMessage() → reuse sesi_id yang sudah ada
     *      → POST /mentor/pesan dengan hasil_quiz_id di body
     *      → BE Tim 6 inject konteks quiz ke Tim 5 secara internal
     *   4. AI mentor merespons dengan analisis quiz kontekstual
     *
     * Race-condition guard: analysisProcessedRef mencegah double-fire.
     */
    const startQuizDiscussion = async (quizResult) => {
        if (!quizResult) return;
        if (!camGranted) {
            console.warn('[CTA] startQuizDiscussion: kamera belum diizinkan, dibatalkan');
            return;
        }
        if (!activeKey) {
            console.warn('[CTA] startQuizDiscussion: activeKey belum ada, dibatalkan');
            return;
        }

        const {
            quizType, score, correct, total,
            materiId: qMateriId, mapelLabel,
            wrongItems, essayAnswers, soalSnapshot,
            hasil_quiz_id,
        } = quizResult;

        // Bangun opener message yang akan dikirim ke Tim 5 sebagai pesan siswa
        const openerText = buildQuizDiscussionOpener({
            quizType: quizType || 'mc',
            score, correct, total,
            materiId: qMateriId, mapelLabel,
            wrongItems, essayAnswers, soalSnapshot,
        });

        console.log('[CTA] startQuizDiscussion fired:', {
            quizType,
            score,
            has_hasil_quiz_id: !!hasil_quiz_id,
            activeKey,
        });

        // Tampilkan trigger bubble di chat dengan badge khusus CTA
        const triggerBubble = {
            id: Date.now(),
            role: 'user',
            text: `📊 **Evaluasi Kuis** — ${quizType === 'essay' ? 'Essay' : 'Pilihan Ganda'} (${score ?? '?'}/100)`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            isCTATrigger: true,
        };
        setMsgsByKey(prev => ({
            ...prev,
            [activeKey]: [...(prev[activeKey] || []), triggerBubble],
        }));

        // Scroll ke bawah segera setelah bubble muncul
        setTimeout(() => messagesEnd?.current?.scrollIntoView({ behavior: 'smooth' }), 60);

        // Dispatch ke mentor pipeline — ini yang memicu network request
        // suppressUserBubble = true karena trigger bubble sudah di-render manual di atas
        try {
            await dispatchMentorMessage(openerText, {
                hasil_quiz_id: hasil_quiz_id ?? null,
                suppressUserBubble: true,
            });
        } catch (err) {
            console.error('[CTA] startQuizDiscussion: dispatchMentorMessage gagal:', err);
        }
    };

    /* ── [TIM 5] CTA useEffect — dipasang setelah startQuizDiscussion agar closure valid ── */
    useEffect(() => {
        if (!needsQuizAnalysis || !lastQuizResult || analysisProcessedRef.current) return;

        // Guard: set dulu sebelum async agar tidak double-fire
        analysisProcessedRef.current = true;
        clearQuizAnalysis();

        // Jalankan orchestration — async, tidak perlu await di dalam useEffect
        startQuizDiscussion(lastQuizResult).finally(() => {
            analysisProcessedRef.current = false;
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needsQuizAnalysis]);

    /* ── Buka Format Konten — konten sudah ada di bank (prefetch saat topik dibuka) ── */
    // Tidak ada generate on-demand lagi. Jika konten belum ada di confContent
    // (bank kosong / prefetch gagal), fallback ke getConfContent() lokal.
    const openConf = (type) => {
        const kConf = confContent[activeKey] || {};
        if (type === 'bacaan') {
            // Bacaan sudah di-prefetch dari API ke kConf.bacaan.byLevel — tidak perlu fallback lokal
            setConfModal({ type });
            return;
        }
        if (!kConf[type]?.generated) {
            // Konten belum di-prefetch — pakai lokal sebagai fallback
            const fallback = getConfContent(materiId || chatMateri?.mapelLabel, chatMateri?.mapelLabel);
            setConfContent(p => ({
                ...p,
                [activeKey]: {
                    ...(p[activeKey] || {}),
                    [type]: { ...(fallback[type] || {}), generated: true },
                },
            }));
        }
        setConfModal({ type });
    };

    /* ── Submit Quiz (dipanggil oleh QuizModal via prop onSubmit) ── */
    /* -- REVISI FASE 3: handleQuizSubmit -- Sistem Agregasi MC + Essay, KKM 75 --
     * KKM lama: 80 (hanya MC)
     * KKM baru: 75 (rata-rata MC + Essay dari RAG)
     * Naik level jika: avg(mcScore, essayScore) >= 75
     * Riwayat: tetap simpan 1 per level+tipe (replace, bukan append)
     * Essay score: diterima dari response POST /content/quiz/submit (essay_score dari RAG)
    */
    const handleQuizSubmit = (result) => {
        const { type, score, correct, total, wrongItems, answers, essayAnswers, soalSnapshot, kkm, hasil_quiz_id } = result;
        const KKM_BARU = kkm ?? KKM_AGREGASI;

        if (hasil_quiz_id) {
            useStudentStore.getState().setCtaHasilQuizId(hasil_quiz_id);
        }
        const currentLevelForRecord = levelMap[activeKey] || chatMateri?.level || 'low';

        const newRecord = {
            type,
            soalSnapshot,
            score: type === 'mc' ? (score ?? 0) : (score ?? null),
            level: currentLevelForRecord,
            ts: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            correct,
            total,
            answers,
            wrongItems,
            essayAnswers,
            kkm: KKM_BARU,
            // Wajib untuk CTA "Tanya Kak Nusa" dari modal riwayat — jangan hanya andalkan store global
            hasil_quiz_id: hasil_quiz_id ?? null,
        };

        setQuizHistory(p => {
            const existing = p[activeKey] || [];
            const filtered = existing.filter(r =>
                !((r.type === type || (!r.type && type === 'mc')) && (r.level || 'low') === currentLevelForRecord)
            );
            return { ...p, [activeKey]: [...filtered, newRecord] };
        });

        if (type === 'mc') setMcModal(false);
        if (type === 'essay') setEssayModal(false);
        setRetrySnapshot(null);

        if (materiId) {
            const progressRecord = {
                id: `q_${Date.now()}`, ...chatMateri, materiId, progress: 100, lastChat: 'Baru saja',
                confDone: [], quizDone: true,
                quizScore: type === 'mc' ? (score ?? 0) : null,
                quizEssayScore: type === 'essay' ? (score ?? null) : null,
                level: currentLevelForRecord,
            };
            setProgressData(p => ({
                sudahSelesai: [...p.sudahSelesai.filter(m => !(m.mapelId === chatMateri.mapelId && m.materiId === materiId)), progressRecord],
                belumSelesai: p.belumSelesai.filter(m => !(m.mapelId === chatMateri.mapelId && m.materiId === materiId)),
            }));

            // -- Hitung agregasi untuk naik level --
            // Ambil riwayat kedua tipe di level yang sama
            // (newRecord sudah di-queue ke setQuizHistory; simulasi state terbaru)
            const existingHistory = (useStudentStore.getState().quizHistory || {})[activeKey] || [];
            const allAtLevel = [
                ...existingHistory.filter(r =>
                    !((r.type === type || (!r.type && type === 'mc')) && (r.level || 'low') === currentLevelForRecord)
                ),
                newRecord,
            ];

            const mcRec = allAtLevel.find(r => (r.type === 'mc' || !r.type) && (r.level || 'low') === currentLevelForRecord);
            const essayRec = allAtLevel.find(r => r.type === 'essay' && (r.level || 'low') === currentLevelForRecord);
            const mcS = mcRec?.score ?? null;
            const essayS = essayRec?.score ?? null;

            let aggregatedScore = null;
            if (mcS != null && essayS != null) {
                // Agregasi penuh: rata-rata MC + Essay
                aggregatedScore = Math.round(mcS * MC_WEIGHT + essayS * ESSAY_WEIGHT);
            }
            // PENTING: aggregatedScore tetap null jika salah satu belum dikerjakan
            // Naik level HANYA jika keduanya sudah dikerjakan dan agregasi >= KKM

            const LEVEL_ORDER_LOCAL = ['low', 'mid', 'high'];
            const LEVEL_LABELS_LOCAL = { low: 'Low', mid: 'Mid', high: 'High' };
            const curLvlIdx = LEVEL_ORDER_LOCAL.indexOf(currentLevelForRecord);
            const nxtLvl = LEVEL_ORDER_LOCAL[Math.min(curLvlIdx + 1, LEVEL_ORDER_LOCAL.length - 1)];
            const isAtMax = currentLevelForRecord === 'high';

            if (aggregatedScore != null && aggregatedScore >= KKM_BARU && !isAtMax) {
                // Kedua quiz selesai + agregasi >= KKM → naik level
                setLevelMap(p => ({ ...p, [activeKey]: nxtLvl }));
                const store = useStudentStore.getState();
                const elemenId = chatMateri?.elemenId;
                if (elemenId) {
                    const materiPerElemen = (MATERI_PER_ELEMEN[chatMateri.mapelId] || {})[elemenId] || [];
                    if (materiPerElemen.length > 0 && materiId) {
                        store.setMateriLevel(chatMateri.mapelId, elemenId, materiId, nxtLvl);
                    } else {
                        store.setElemenLevel(chatMateri.mapelId, elemenId, nxtLvl);
                    }
                }
                // Tandai semua record di level lama sebagai locked:true — konsisten
                // dengan shape BE (GET /content/quiz/history mengembalikan locked:true
                // untuk level yang sudah dilewati). Ini memastikan panel kanan
                // menampilkan '👁 Hanya lihat' tanpa perlu re-fetch dari BE.
                setQuizHistory(p => {
                    const records = p[activeKey] || [];
                    const updated = records.map(r =>
                        (r.level || 'low') === currentLevelForRecord
                            ? { ...r, locked: true }
                            : r
                    );
                    return { ...p, [activeKey]: updated };
                });
                const levelUpMsg = {
                    id: Date.now() + 5, role: 'ai', isLevelUp: true,
                    fromLevel: currentLevelForRecord, toLevel: nxtLvl,
                    text: `🎉 Selamat! Kamu berhasil naik ke **Level ${LEVEL_LABELS_LOCAL[nxtLvl]}**!\n\n📊 **Rekap Nilai:**\n- Pilihan Ganda: ${mcS}/100\n- Essay: ${essayS}/100\n- **Nilai Agregasi (MC×60%+Essay×40%): ${aggregatedScore}/100** ✅\n\nSemua konten materi **${materiId}** sekarang naik ke Level ${LEVEL_LABELS_LOCAL[nxtLvl]}. Riwayat Level ${LEVEL_LABELS_LOCAL[currentLevelForRecord]} masih bisa kamu lihat di panel kanan. Terus semangat! 💪`,
                    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                };
                setMsgsByKey(p => ({ ...p, [activeKey]: [...(p[activeKey] || []), levelUpMsg] }));
            }
        }

        addRecentActivity?.({
            type: 'quiz', mapelIcon: chatMateri.mapelIcon,
            label: `Menyelesaikan ${type === 'essay' ? 'essay' : 'quiz PG'} ${materiId || chatMateri.mapelLabel}`,
            level: currentLevelForRecord, ts: Date.now(),
        });
    };


    // REVISI: addRecentActivity untuk event belajar (chat) juga menyertakan level
    const handleStartChatActivity = () => {
        addRecentActivity?.({
            type: 'chat',
            mapelIcon: chatMateri.mapelIcon,
            label: `Mempelajari ${materiId || chatMateri.mapelLabel}`,
            level: levelMap[activeKey] || chatMateri?.level || 'low',
            ts: Date.now(),
        });
    };

    /* ─────────────────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────────────────── */
    // Attach stream sesi ke sessionVideoRef saat camGranted aktif
    // (stream sudah ada di sessionStreamRef dari startChat di StudentView)
    useEffect(() => {
        if (!camGranted || !sessionStreamRef?.current) return;
        if (sessionVideoRef?.current) {
            sessionVideoRef.current.srcObject = sessionStreamRef.current;
            sessionVideoRef.current.play().catch(() => { });
        }
    }, [camGranted, sessionStreamRef, sessionVideoRef]);

    const [leftPanelOpen, setLeftPanelOpen] = useState(false);

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
            {/* Hidden video element untuk capture emosi */}
            <video
                ref={sessionVideoRef}
                autoPlay
                playsInline
                muted
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            />

            {/* Mobile: overlay backdrop for left panel */}
            {isMobile && leftPanelOpen && (
                <div
                    onClick={() => setLeftPanelOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 198 }}
                />
            )}

            {/* ══ PANEL KIRI ══════════════════════════════════════════ */}
            <div style={{
                width: isMobile ? 220 : 200,
                minWidth: isMobile ? 220 : 200,
                background: C.white,
                borderRight: `1px solid rgba(13,92,99,.08)`,
                display: 'flex', flexDirection: 'column', overflowY: 'auto',
                ...(isMobile ? {
                    position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 199,
                    transform: leftPanelOpen ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform .25s ease',
                    boxShadow: leftPanelOpen ? '4px 0 20px rgba(0,0,0,.15)' : 'none',
                } : {}),
            }}>
                <div style={{ padding: '14px 14px 12px' }}>
                    <button onClick={isMobile ? () => setLeftPanelOpen(false) : handleSafeBack}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: C.teal, fontWeight: 700, fontSize: FS.md, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
                        ← {isMobile ? 'Tutup' : 'Kembali'}
                    </button>

                    {/* Kamera aktif — klik untuk cek posisi kamera */}
                    <button
                        onClick={openWebcamPreview}
                        title="Klik untuk cek posisi kamera"
                        style={{ background: `${C.red}0F`, border: `1px solid ${C.red}33`, borderRadius: 9, padding: '7px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', width: '100%', fontFamily: 'inherit', textAlign: 'left', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = `${C.red}1A`}
                        onMouseLeave={e => e.currentTarget.style.background = `${C.red}0F`}
                    >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, display: 'inline-block', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.red }}>Kamera Aktif</div>
                            <div style={{ fontSize: FS.xs, color: C.slate }}>Tap untuk cek kamera</div>
                        </div>
                        <span style={{ fontSize: FS.xs, color: C.red, opacity: .7 }}>📸</span>
                    </button>

                    {/* Mapel info */}
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, marginBottom: 6 }}>
                        {chatMateri.mapelIcon}
                    </div>
                    <div style={{ fontSize: FS.xs, color: C.teal, fontWeight: 700, marginBottom: 2 }}>{chatMateri.mapelLabel}</div>
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
                                    const sessLevel = levelMap[sess.k] || chatMateri?.level || 'low';
                                    // Hitung agregasi untuk ditampilkan di riwayat topik
                                    const mcQh = qh ? qh.filter(r => (r.type === 'mc' || !r.type) && (r.level || 'low') === sessLevel) : [];
                                    const essayQh = qh ? qh.filter(r => r.type === 'essay' && (r.level || 'low') === sessLevel) : [];
                                    const latestMc = mcQh.length > 0 ? mcQh[mcQh.length - 1].score : null;
                                    const latestEssay = essayQh.length > 0 ? essayQh[essayQh.length - 1].score : null;
                                    const aggScore = latestMc != null && latestEssay != null
                                        ? Math.round(latestMc * MC_WEIGHT + latestEssay * ESSAY_WEIGHT)
                                        : null;
                                    const displayScore = aggScore ?? latestMc ?? latestEssay;
                                    const isPass = aggScore != null && aggScore >= 75; // lulus = agregasi kedua quiz >= KKM
                                    const sessLvlMeta = { low: { color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' }, mid: { color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' }, high: { color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' } }[sessLevel] || { color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' };
                                    return (
                                        <button key={sess.k} onClick={() => {
                                            setSubMateri(sess.sub);
                                            setChatMateri(cm => ({ ...cm, materiId: sess.sub }));
                                            setQuizActive(false); setQuizAnswers({}); setQuizSubmitted(false); setConfOverlay(null);
                                        }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', borderRadius: 8, border: `1px solid ${isActive ? C.teal : C.tealXL}`, background: isActive ? `${C.teal}12` : C.white, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}
                                            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.cream; e.currentTarget.style.borderColor = C.tealL; } }}
                                            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = C.white; e.currentTarget.style.borderColor = C.tealXL; } }}>
                                            <span style={{ fontSize: 12 }}>{chatMateri.mapelIcon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: FS.xs, fontWeight: 600, color: C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.sub}</div>
                                                <div style={{ fontSize: FS.xs, color: C.slate }}>
                                                    {displayScore != null
                                                        ? aggScore != null
                                                            ? <span style={{ fontWeight: 700, color: isPass ? '#276749' : '#B7791F' }}>Agregasi: {aggScore}/100 {isPass ? '✅' : '⏳'}</span>
                                                            : <span>Quiz: {displayScore}/100 <span style={{ opacity: .7 }}>(belum lengkap)</span></span>
                                                        : sess.done ? '✅ Selesai' : '🔄 Belajar'}
                                                </div>
                                                {/* Badge level per topik */}
                                                <div style={{ marginTop: 2 }}>
                                                    <span style={{ fontSize: FS.xs, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: sessLvlMeta.bg, color: sessLvlMeta.color, border: `1px solid ${sessLvlMeta.border}` }}>
                                                        Lv.{sessLevel === 'low' ? 'Low' : sessLevel === 'mid' ? 'Mid' : 'High'}
                                                    </span>
                                                </div>
                                            </div>
                                            {isActive && <span style={{ fontSize: FS.xs, color: C.teal }}>●</span>}
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

                    {/* Mobile: hamburger to open left panel */}
                    {isMobile && (
                        <button
                            onClick={() => setLeftPanelOpen(p => !p)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}
                        >
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 16, height: 2, background: C.teal, borderRadius: 1 }} />)}
                        </button>
                    )}

                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xl, flexShrink: 0 }}>🤖</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>Mentor AI — Kak Nusa</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                            <span style={{ fontSize: FS.xs, color: C.green }}>Online</span>
                            <span style={{ fontSize: FS.xs, color: C.slate, marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {materiId || chatMateri?.mapelLabel}</span>
                        </div>
                    </div>

                    {/* Mobile: right panel toggle + back button */}
                    {isMobile && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button
                                onClick={() => setShowRightPanelMobile(s => !s)}
                                style={{ background: showRightPanelMobile ? C.teal : 'none', border: `1.5px solid ${C.tealXL}`, cursor: 'pointer', color: showRightPanelMobile ? '#fff' : C.teal, fontWeight: 700, fontSize: FS.xs, padding: '4px 8px', borderRadius: 8, flexShrink: 0 }}
                            >
                                📚 Konten
                            </button>
                            <button onClick={handleSafeBack}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teal, fontWeight: 700, fontSize: FS.md, padding: '4px 8px', flexShrink: 0 }}>
                                ✕
                            </button>
                        </div>
                    )}
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
                                                background: `${C.teal}08`,
                                                borderRadius: 8,
                                                padding: '4px 8px',
                                                margin: '-4px -8px',
                                            } : {}),
                                        }}>
                                            {renderMarkdown(msg.text)}
                                        </div>

                                        {/* ── Tombol Selesai Membaca (hanya untuk pesan bacaan yang belum done) ── */}
                                        {msg.isBacaan && msg.showReadBtn && !readDone[activeKey] && (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                                                <button
                                                    onClick={handleSelesaiBaca}
                                                    style={{
                                                        padding: '5px 12px', borderRadius: 8,
                                                        background: 'transparent',
                                                        color: C.teal,
                                                        fontWeight: 600, fontSize: FS.xs,
                                                        border: `1px solid ${C.teal}55`,
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                        transition: 'all .15s',
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}12`; e.currentTarget.style.borderColor = C.teal; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${C.teal}55`; }}
                                                >
                                                    <span style={{ fontSize: 11 }}>✅</span> Selesai membaca
                                                </button>
                                            </div>
                                        )}
                                        {msg.isBacaan && readDone[activeKey] && (
                                            <div style={{ marginTop: 10, fontSize: FS.xs, color: C.teal, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                ✅ <span>Kamu sudah menyelesaikan bacaan ini</span>
                                            </div>
                                        )}

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
                                                    border: `1px solid ${speakingMsgId === msg.id ? C.teal : 'transparent'}`,
                                                    background: speakingMsgId === msg.id ? `${C.teal}12` : 'transparent',
                                                    color: speakingMsgId === msg.id ? C.teal : C.slate,
                                                    cursor: 'pointer', fontSize: FS.sm, fontFamily: 'inherit',
                                                    transition: 'all .15s',
                                                    animation: speakingMsgId === msg.id ? 'pulse 1.4s infinite' : 'none',
                                                }}
                                                onMouseEnter={e => {
                                                    if (speakingMsgId !== msg.id) {
                                                        e.currentTarget.style.borderColor = C.teal;
                                                        e.currentTarget.style.color = C.teal;
                                                        e.currentTarget.style.background = `${C.teal}08`;
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
                <div style={{ padding: isMobile ? '8px 12px calc(8px + var(--bottom-nav-h, 0px))' : '8px 12px', background: C.white, borderTop: `1px solid rgba(13,92,99,.08)`, flexShrink: 0 }}>
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
                            disabled={!sttSupported || isChatBlocked}
                            style={{
                                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                                border: `1.5px solid ${sttListening ? C.red : C.tealXL}`,
                                background: sttListening ? C.red : C.white,
                                cursor: (sttSupported && !isChatBlocked) ? 'pointer' : 'not-allowed',
                                fontSize: FS.lg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all .2s',
                                animation: sttListening ? 'pulse 1s infinite' : 'none',
                                opacity: (sttSupported && !isChatBlocked) ? 1 : .4,
                            }}>
                            🎙️
                        </button>
                        {/* Textarea — auto-resize ke atas */}
                        <div style={{ flex: 1, position: 'relative', alignSelf: 'flex-end' }}>
                            <textarea ref={textareaRef} value={input} onChange={e => {
                                if (isChatBlocked) return;
                                setInput(e.target.value);
                                const el = e.target;
                                el.style.height = 'auto';
                                el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                            }}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isChatBlocked) { e.preventDefault(); sendMsg(); } }}
                                placeholder={
                                    isChatBlocked
                                        ? '📖 Klik "✅ Selesai membaca" di bawah materi untuk mulai diskusi...'
                                        : sttListening
                                            ? '🎙️ Mendengarkan...'
                                            : materiId
                                                ? `Tanya tentang ${materiId}...`
                                                : `Tanya tentang ${chatMateri.mapelLabel}...`
                                }
                                disabled={isChatBlocked}
                                style={{
                                    width: '100%', padding: '8px 10px',
                                    border: `1.5px solid ${isChatBlocked ? C.tealXL : sttListening ? C.red : C.tealXL}`,
                                    borderRadius: 9, fontSize: FS.base, resize: 'none', outline: 'none',
                                    minHeight: 38, maxHeight: 160, height: 38,
                                    lineHeight: 1.5, overflowY: 'auto',
                                    transition: 'border-color .2s',
                                    boxSizing: 'border-box',
                                    fontStyle: sttListening ? 'italic' : 'normal',
                                    display: 'block',
                                    opacity: isChatBlocked ? 0.5 : 1,
                                    cursor: isChatBlocked ? 'not-allowed' : 'text',
                                    background: isChatBlocked ? '#F7FAFC' : '#fff',
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
                        <Btn variant="primary" onClick={sendMsg} disabled={isChatBlocked || (!input.trim() && !chatAttachments.length)}
                            style={{ height: 38, paddingLeft: 12, paddingRight: 12, flexShrink: 0, fontSize: FS.md, alignSelf: 'flex-end' }}>Kirim →</Btn>
                    </div>
                </div>
            </div>

            {/* ══ PANEL KANAN ══════════════════════════════════════════ */}
            {(!isMobile || showRightPanelMobile) && (
                <div style={{
                    width: isMobile ? '100%' : rightPanelWidth,
                    minWidth: isMobile ? '100%' : rightPanelWidth,
                    transition: 'width .3s cubic-bezier(.4,0,.2,1), min-width .3s cubic-bezier(.4,0,.2,1)',
                    borderLeft: `1px solid rgba(13,92,99,.08)`,
                    background: C.white,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    ...(isMobile ? { position: 'absolute', inset: 0, zIndex: 50 } : {}),
                }}>

                    {/* Mobile close button */}
                    {isMobile && (
                        <div style={{ padding: '8px 12px', background: C.dark, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button
                                onClick={() => setShowRightPanelMobile(false)}
                                style={{ background: 'none', border: 'none', color: C.white, fontWeight: 700, fontSize: FS.md, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                ← Kembali ke Chat
                            </button>
                        </div>
                    )}

                    {/* ── Mode: Detail Riwayat Quiz (menimpa format konten & latihan soal) ── */}
                    {quizHistoryModal ? (() => {
                        const { result, index } = quizHistoryModal;
                        const isMcResult = result.type === 'mc' || !result.type;
                        const isEssayResult = result.type === 'essay';
                        const pass = isMcResult && result.score >= 70;
                        const attemptNumber = index + 1;
                        const headerColor = isMcResult ? `linear-gradient(135deg,${C.teal},${C.tealL})` : `linear-gradient(135deg,${C.teal},${C.tealL})`;
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
                                            background: "transparent", border: 'none',
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
                                        <div style={{ fontSize: 26, marginBottom: 2 }}>✅</div>
                                        <div style={{ fontWeight: 700, fontSize: FS.base, color: headerColor, marginBottom: 2 }}>
                                            Jawaban Pilihan Ganda Terkirim
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: 26, color: pass ? C.green : C.amber }}>
                                            {result.score}
                                        </div>
                                    </div>
                                )}

                                {/* Status Essay */}
                                {isEssayResult && (
                                    <div style={{
                                        padding: '12px 14px 8px', textAlign: 'center',
                                        borderBottom: `1px solid rgba(13,92,99,.07)`, flexShrink: 0,
                                        background: `${C.teal}08`,
                                    }}>
                                        <div style={{ fontSize: 26, marginBottom: 2 }}>✅</div>
                                        <div style={{ fontWeight: 700, fontSize: FS.base, color: C.teal, marginBottom: 2 }}>
                                            Jawaban Essay Terkirim
                                        </div>
                                        {result.score != null ? (
                                            <div style={{ fontWeight: 800, fontSize: 26, color: result.score >= 70 ? C.green : C.amber }}>
                                                {result.score}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: FS.xs, color: C.teal }}>⏳ Sedang dinilai...</div>
                                        )}
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
                                                        borderBottom: si < (result.soalSnapshot?.length ?? 0) - 1 ? `1px solid ${C.teal}18` : 'none',
                                                    }}>
                                                        <div style={{ fontSize: FS.xs, fontWeight: 600, color: C.dark, marginBottom: 4, lineHeight: 1.4 }}>
                                                            Essay {si + 1}: {s.soal.slice(0, 70)}{s.soal.length > 70 ? '…' : ''}
                                                        </div>
                                                        <div style={{
                                                            fontSize: FS.xs, color: C.darkL, lineHeight: 1.6,
                                                            background: `${C.teal}08`, borderRadius: 6,
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
                                                    border: `1.0px solid ${C.teal}`,
                                                    background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                                                    color: C.white, fontWeight: 700, fontSize: FS.sm,
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
                                                // Prioritas: ID pada baris riwayat (benar per MC/Essay). Fallback: store (baru submit).
                                                const hasilQuizId = result.hasil_quiz_id
                                                    ?? useStudentStore.getState().ctaHasilQuizId
                                                    ?? null;
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
                                                    hasil_quiz_id: hasilQuizId,
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
                                    background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
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
                                            background: 'transparent', border: 'none',
                                            borderRadius: 6, width: 26, height: 26, color: '#fff',
                                            cursor: 'pointer', fontSize: FS.lg, flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>✕</button>
                                </div>

                                {/* Body — scrollable */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
                                    {/* Konten sudah ada dari bank guru (prefetch saat topik dibuka) */}
                                    {(
                                        <>
                                            {ct.type === 'bacaan' && (
                                                <BacaanView
                                                    bacaanData={kConf.bacaan}
                                                    currentLevel={levelMap[activeKey] || chatMateri?.level || 'low'}
                                                    color={ct.color}
                                                    materiId={materiId}
                                                />
                                            )}
                                            {ct.type === 'mindmap' && (
                                                <MindMapView tree={data.tree} color={ct.color} bgLight={`${ct.color}18`} materiId={materiId} />
                                            )}
                                            {ct.type === 'flashcard' && data.cards && (
                                                <FlashcardView
                                                    cards={data.cards} color={ct.color} bgLight={`${ct.color}18`} materiId={materiId}
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
                            {/* Format Konten — tanpa Bacaan (sudah tampil di chatbot) */}
                            <div style={{ padding: '12px 12px 8px', borderBottom: `1px solid rgba(13,92,99,.06)`, flexShrink: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: FS.md, color: C.dark, marginBottom: 3 }}>📦 Format Konten</div>
                                <div style={{ fontSize: FS.xs, color: C.slate, marginBottom: 8 }}>
                                    {materiId ? 'Pilih format konten belajar' : 'Pilih materi dulu'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {CONF_TYPES.filter(ct => ct.type !== 'bacaan').map(ct => {
                                        const done_ = kConf[ct.type]?.generated;
                                        return (
                                            <button key={ct.type}
                                                onClick={() => { if (!materiId) return; openConf(ct.type); }}
                                                disabled={!materiId}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${done_ ? ct.color : ct.color}`, cursor: materiId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', background: done_ ? `${ct.color}18` : C.white, color: done_ ? ct.color : C.slate, fontSize: FS.md, fontWeight: 700, textAlign: 'left', transition: 'all .2s', opacity: materiId ? 1 : .5 }}>
                                                <span style={{ fontSize: 15 }}>{ct.icon}</span>
                                                <span style={{ flex: 1 }}>{ct.label}</span>
                                                <span style={{ fontSize: FS.xs, opacity: .8 }}>Lihat</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tombol Game */}
                            <div style={{ padding: '8px 12px', borderBottom: `1px solid rgba(13,92,99,.06)`, flexShrink: 0 }}>
                                <button
                                    onClick={() => {
                                        if (materiId && openGame) {
                                            // FIX T4: Baca game_id dari byLevel sesuai level aktif siswa
                                            // byLevel disimpan saat prefetch getKontenSiswa (forEach di atas)
                                            const activeLvl = (levelMap[activeKey] || chatMateri?.level || 'Low');
                                            const activeLvlNorm = activeLvl.charAt(0).toUpperCase() + activeLvl.slice(1).toLowerCase();
                                            const gameConf = kConf.game?.byLevel?.[activeLvlNorm]
                                                || kConf.game?.byLevel?.[activeLvl]
                                                || kConf.game?.byLevel?.['Low']
                                                || null;
                                            openGame({
                                                mapelId: chatMateri.mapelId,
                                                mapelLabel: chatMateri.mapelLabel,
                                                mapelIcon: chatMateri.mapelIcon,
                                                elemenId: chatMateri.elemenId || null,
                                                elemenLabel: chatMateri.elemenLabel || null,
                                                materiId,
                                                level: activeLvlNorm,
                                                // FIX T4: game_id diteruskan dari byLevel → polling & iframe jalan
                                                game_id: gameConf?.game_id || gameConf?.id || null,
                                                html_url: gameConf?.html_url || null,
                                            });
                                        }
                                    }}
                                    disabled={!materiId}
                                    style={{
                                        width: '100%', padding: '9px 0', borderRadius: 9,
                                        border: `1.5px solid ${materiId ? C.teal : C.tealXL}`,
                                        background: materiId ? `${C.teal}10` : C.bg,
                                        color: materiId ? C.teal : C.slate,
                                        fontSize: FS.md, fontWeight: 700, cursor: materiId ? 'pointer' : 'not-allowed',
                                        fontFamily: 'inherit', transition: 'all .2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        opacity: materiId ? 1 : .5,
                                    }}
                                    onMouseEnter={e => { if (materiId) { e.currentTarget.style.background = C.teal; e.currentTarget.style.color = '#fff'; } }}
                                    onMouseLeave={e => { if (materiId) { e.currentTarget.style.background = `${C.teal}10`; e.currentTarget.style.color = C.teal; } }}
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
                                                            border: `1.5px solid ${mcDoneAtHigh ? '#CBD5E0' : C.teal}`,
                                                            background: mcDoneAtHigh ? '#F7FAFC' : `${C.teal}0F`,
                                                            color: mcDoneAtHigh ? '#A0AEC0' : C.teal,
                                                            fontWeight: 700, fontSize: FS.xs,
                                                            cursor: mcDoneAtHigh ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                                            display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', gap: 3,
                                                            transition: 'all .15s',
                                                            opacity: mcDoneAtHigh ? .65 : 1,
                                                        }}
                                                        onMouseEnter={e => { if (!mcDoneAtHigh) e.currentTarget.style.background = `${C.teal}20`; }}
                                                        onMouseLeave={e => { if (!mcDoneAtHigh) e.currentTarget.style.background = `${C.teal}0F`; }}
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
                                                            border: `1.5px solid ${essayDoneAtHigh ? '#CBD5E0' : C.teal}`,
                                                            background: essayDoneAtHigh ? '#F7FAFC' : `${C.teal}0F`,
                                                            color: essayDoneAtHigh ? '#A0AEC0' : C.teal,
                                                            fontWeight: 700, fontSize: FS.xs,
                                                            cursor: essayDoneAtHigh ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                                            display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', gap: 3,
                                                            transition: 'all .15s',
                                                            opacity: essayDoneAtHigh ? .65 : 1,
                                                        }}
                                                        onMouseEnter={e => { if (!essayDoneAtHigh) e.currentTarget.style.background = `${C.teal}20`; }}
                                                        onMouseLeave={e => { if (!essayDoneAtHigh) e.currentTarget.style.background = `${C.teal}0F`; }}
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

                                        {/* Info KKM dan nilai terakhir -- REVISI FASE 3: KKM agregasi 75 */}
                                        <div style={{ fontSize: FS.xs, color: C.slate, marginBottom: 10, lineHeight: 1.6 }}>
                                            {(() => {
                                                const currentLvl = levelMap[activeKey] || chatMateri?.level || 'low';
                                                const isHighLevel = currentLvl === 'high';
                                                const hasDoneAtHigh = isHighLevel && allHistory.some(r => (r.level || 'low') === 'high');
                                                if (hasDoneAtHigh) return (
                                                    <span style={{ color: '#9B2C2C', background: '#FFF5F5', border: '1px solid #FEB2B2', padding: '3px 8px', borderRadius: 6, display: 'inline-block', lineHeight: 1.5 }}>
                                                        Level High sudah diselesaikan. Gunakan <strong>Ulangi</strong> di riwayat
                                                    </span>
                                                );

                                                const mcRec = allHistory.find(r => (r.type === 'mc' || !r.type) && (r.level || 'low') === currentLvl);
                                                const essayRec = allHistory.find(r => r.type === 'essay' && (r.level || 'low') === currentLvl);
                                                const mcS = mcRec?.score ?? null;
                                                const essayS = essayRec?.score ?? null;
                                                const bothDone = mcS != null && essayS != null;
                                                const aggScore = bothDone ? Math.round(mcS * MC_WEIGHT + essayS * ESSAY_WEIGHT) : null;

                                                return (
                                                    <div style={{ color: '#4A5568', fontSize: FS.xs, textAlign: 'center', lineHeight: 1.5 }}>
                                                        {bothDone ? (
                                                            <span style={{ fontWeight: 700, color: aggScore >= 75 ? '#276749' : '#B7791F' }}>
                                                                Nilai agregasi: {aggScore}/100 {aggScore >= 75 ? '🎉' : `(butuh ${75 - aggScore} poin lagi)`}
                                                            </span>
                                                        ) : (
                                                            'Selesaikan keduanya untuk dapat nilai agregasi & naik level (KKM: 75)'
                                                        )}
                                                    </div>
                                                );
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
                                                        // isLocked: gunakan flag `locked` dari BE jika ada (hidrasi dari GET /content/quiz/history).
                                                        // Fallback ke kalkulasi lokal (isPast) jika record dari sesi ini (belum ada locked dari BE).
                                                        const isPast = LEVEL_ORDER_DISP.indexOf(lv) < LEVEL_ORDER_DISP.indexOf(currentLvl);
                                                        const isLocked = lvRecs.some(r => r.locked === true) || isPast;
                                                        return (
                                                            <div key={lv} style={{ marginBottom: 10 }}>
                                                                {/* Level header with aggregation */}
                                                                {(() => {
                                                                    const lvMc = lvRecs.find(r => r.type === 'mc' || !r.type);
                                                                    const lvEssay = lvRecs.find(r => r.type === 'essay');
                                                                    const lvMcS = lvMc?.score ?? null;
                                                                    const lvEssayS = lvEssay?.score ?? null;
                                                                    const lvAgg = (lvMcS != null && lvEssayS != null) ? Math.round(lvMcS * MC_WEIGHT + lvEssayS * ESSAY_WEIGHT) : null;
                                                                    return (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, padding: '3px 8px', borderRadius: 6, background: lvMeta.bg, border: `1px solid ${lvMeta.border}` }}>
                                                                            <span style={{ fontSize: FS.xs, fontWeight: 800, color: lvMeta.color }}>Level {LEVEL_LBL_DISP[lv]}</span>
                                                                            {lv === currentLvl && <span style={{ fontSize: FS.xs, color: lvMeta.color, fontWeight: 700 }}>· Level aktif</span>}
                                                                            {lvAgg != null && (
                                                                                <span style={{ fontSize: FS.xs, fontWeight: 700, color: lvMeta.color, marginLeft: 'auto' }}>
                                                                                    Nilai akhir {lvAgg}/100
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                    {lvRecs.map((r, i) => {
                                                                        const originalIndex = allHistory.indexOf(r);
                                                                        const isActiveItem = quizHistoryModal?.index === originalIndex;
                                                                        const isMcItem = r.type === 'mc' || !r.type;
                                                                        const itemColor = isMcItem ? C.teal : C.teal;
                                                                        return (
                                                                            <button key={i}
                                                                                onClick={() => setQuizHistoryModal(isActiveItem ? null : { result: r, index: originalIndex })}
                                                                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', borderRadius: 8, border: `1px solid ${isActiveItem ? itemColor : 'transparent'}`, background: isActiveItem ? `${itemColor}12` : C.cream, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', transition: 'all .15s' }}>
                                                                                <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isActiveItem ? `${itemColor}22` : `${itemColor}18`, border: `1px solid ${itemColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <span style={{ fontSize: 11 }}>{isMcItem ? '🔘' : '✍️'}</span>
                                                                                </div>
                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dark }}>
                                                                                        {isMcItem ? 'Pilihan Ganda' : 'Essay'}
                                                                                    </div>
                                                                                    <div style={{ fontSize: FS.xs, color: isActiveItem ? itemColor : C.teal, fontWeight: 600 }}>
                                                                                        {isLocked ? '👁 Hanya lihat' : isActiveItem ? 'Sedang dilihat ●' : 'Lihat detail →'}
                                                                                    </div>
                                                                                    <div style={{ fontSize: FS.xs, color: C.slate }}>{r.ts}</div>
                                                                                </div>
                                                                                <span style={{ fontSize: 10 }}>{r.score != null ? (r.score >= 75 ? '⭐' : '💪') : '📋'}</span>
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
            )} {/* end mobile right panel conditional */}

            {/* ══ Modal Pilihan Ganda ══════════════════════════════════ */}
            <QuizModal
                open={mcModal}
                onClose={() => { setMcModal(false); setRetrySnapshot(null); }}
                chatMateri={chatMateri}
                materiId={materiId}
                activeKey={activeKey}
                quizType="mc"
                soalSnapshot={retrySnapshot?.type === 'mc' ? retrySnapshot.soal : null}
                currentLevel={(levelMap[activeKey] || chatMateri?.level || 'low').toLowerCase()}
                apiSoal={kConf.quiz_pg?.byLevel?.[(levelMap[activeKey] || chatMateri?.level || 'low').toLowerCase()] || null}
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
                currentLevel={(levelMap[activeKey] || chatMateri?.level || 'low').toLowerCase()}
                apiSoal={kConf.quiz_essay?.byLevel?.[(levelMap[activeKey] || chatMateri?.level || 'low').toLowerCase()] || null}
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
                            background: C.white, borderRadius: 22, width: 'min(440px, calc(100vw - 32px))', padding: 36,
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
                            <div style={{ fontSize: FS.h2, fontWeight: 800, color: '#C53030', marginBottom: 8 }}>
                                Pelanggaran Terdeteksi
                            </div>
                            <div style={{ fontSize: FS.lg, color: C.darkL, marginBottom: 16, lineHeight: 1.7 }}>
                                Sistem mendeteksi kamu berpindah ke luar halaman sesi belajar.
                            </div>

                            {/* Detail pelanggaran */}
                            <div style={{
                                background: 'rgba(197,48,48,.06)', borderRadius: 12,
                                padding: '11px 16px', marginBottom: 12, fontSize: FS.md,
                                color: '#744210', lineHeight: 1.7, textAlign: 'left',
                            }}>
                                📋 <strong>Jenis:</strong> {violationModal.detail}<br />
                                🔢 <strong>Jumlah pelanggaran:</strong> {violationModal.count}x<br />
                            </div>

                            {/* Info box */}
                            <div style={{
                                background: '#FFF5F5', borderRadius: 12,
                                padding: '11px 16px', marginBottom: 24, fontSize: FS.md,
                                color: '#744210', lineHeight: 1.7, textAlign: 'left',
                            }}>
                                🔒 <strong>Sesi belajar masih berjalan.</strong>
                                <br />
                                Harap tetap berada di halaman ini selama sesi belajar berlangsung.
                            </div>

                            <button
                                onClick={() => setViolationModal(null)}
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
                                Kembali ke Sesi Belajar
                            </button>

                            <div style={{ marginTop: 12, fontSize: FS.sm, color: C.slate }}>
                                Tekan tombol di atas untuk melanjutkan sesi belajar
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ══ WEBCAM PREVIEW MODAL ═════════════════════════════════ */}
            {showWebcamPreview && (
                <div
                    style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(26,35,50,.6)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 9998,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                        animation: 'fadeIn .2s ease',
                    }}
                    onClick={closeWebcamPreview}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: C.white, borderRadius: 22, width: 480, padding: 0,
                            boxShadow: '0 24px 64px rgba(0,0,0,.3)',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '14px 18px', background: `linear-gradient(135deg, ${C.teal}, ${C.tealL})`,
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <span style={{ fontSize: 20 }}>📷</span>
                            <div style={{ flex: 1, color: '#fff' }}>
                                <div style={{ fontWeight: 700, fontSize: FS.md }}>Cek Posisi Kamera</div>
                                <div style={{ fontSize: FS.xs, opacity: .8 }}>Pastikan wajah terlihat jelas di tengah frame</div>
                            </div>
                            <button
                                onClick={closeWebcamPreview}
                                style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 30, height: 30, color: '#fff', cursor: 'pointer', fontSize: FS.lg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >✕</button>
                        </div>

                        {/* Video preview */}
                        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3', overflow: 'hidden' }}>
                            <video
                                ref={previewVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    transform: 'scaleX(-1)', // mirror agar natural
                                    display: 'block',
                                }}
                            />
                            {/* Overlay guide frame */}
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                pointerEvents: 'none',
                            }}>
                                <div style={{
                                    width: 140, height: 170,
                                    border: '2.5px dashed rgba(255,255,255,.55)',
                                    borderRadius: '50% 50% 45% 45%',
                                    boxShadow: '0 0 0 9999px rgba(0,0,0,.15)',
                                }} />
                            </div>
                            {/* Status indicator */}
                            <div style={{
                                position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,.6)', borderRadius: 99, padding: '4px 14px',
                                color: '#fff', fontSize: FS.xs, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#68D391', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
                                Kamera Aktif — Deteksi Emosi Berjalan
                            </div>
                        </div>

                        {/* Tips */}
                        <div style={{ padding: '14px 18px 18px' }}>
                            <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dark, marginBottom: 8 }}>💡 Tips agar deteksi emosi akurat:</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {[
                                    '👤 Pastikan wajah berada di tengah',
                                    '💡 Pastikan cahaya cukup',
                                    '😊 Usahakan ekspresi wajah terlihat natural',
                                ].map((tip, i) => (
                                    <div key={i} style={{ fontSize: FS.xs, color: C.darkL, background: C.cream, borderRadius: 7, padding: '5px 10px' }}>
                                        {tip}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={closeWebcamPreview}
                                style={{
                                    width: '100%', marginTop: 14, padding: '10px', borderRadius: 10,
                                    background: `linear-gradient(135deg, ${C.teal}, ${C.tealL})`,
                                    border: 'none', color: '#fff', fontWeight: 700, fontSize: FS.md,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    boxShadow: `0 4px 12px ${C.teal}55`,
                                }}
                            >
                                ✅ Sudah OK, Lanjut Belajar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatSection;