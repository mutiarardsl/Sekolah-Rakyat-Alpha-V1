/**
 * SR MVP — Centralized LaTeX/Markdown Renderer
 * src/components/shared/LatexRenderer.jsx
 *
 * Komponen reusable untuk merender teks yang mengandung:
 *   - Markdown (bold, list, heading, tabel, dll)
 *   - LaTeX inline : $...$  atau  \(...\)
 *   - LaTeX block  : $$...$$ atau  \[...\]
 *
 * Dependensi (sudah ada di package.json):
 *   react-markdown, remark-gfm, remark-math, rehype-katex, katex
 *
 * CSS KaTeX diimport global di main.jsx — tidak perlu import ulang di sini.
 *
 * Tiga varian ekspor:
 *   <MarkdownLatex>   — untuk konten panjang (bacaan, pesan AI chatbot)
 *                       Full markdown + LaTeX, styled sesuai design token SR
 *   <InlineLatex>     — untuk teks pendek satu baris (soal quiz, pilihan jawaban,
 *                       teks flashcard, label mindmap)
 *                       LaTeX tetap dirender, markdown minimal (bold/em/code saja)
 *   renderMarkdownSR  — fungsi helper yang mengembalikan JSX <MarkdownLatex>
 *                       (drop-in replacement untuk renderMarkdown() di ChatSection)
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { C, FONTS, FS } from '../../styles/tokens';

/* ─── Shared rehype/remark plugins ──────────────────────────────── */
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

/* ─── Shared markdown component overrides (full, untuk konten panjang) ── */
const FULL_COMPONENTS = {
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
  p: ({ children }) => (
    <p style={{ margin: '3px 0', lineHeight: 1.65, fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</p>
  ),
  h1: ({ children }) => (
    <div style={{ fontSize: FS.lg, fontWeight: 700, color: C.dark, margin: '10px 0 4px', fontFamily: FONTS.sans }}>{children}</div>
  ),
  h2: ({ children }) => (
    <div style={{ fontSize: FS.base + 1, fontWeight: 700, color: C.dark, margin: '8px 0 3px', borderBottom: `1px solid ${C.teal}15`, paddingBottom: 3, fontFamily: FONTS.sans }}>{children}</div>
  ),
  h3: ({ children }) => (
    <div style={{ fontSize: FS.base, fontWeight: 700, color: C.teal, margin: '6px 0 3px', fontFamily: FONTS.sans }}>{children}</div>
  ),
  ul: ({ children }) => (
    <ul style={{ margin: '3px 0', paddingLeft: 18, fontFamily: FONTS.sans }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '3px 0', paddingLeft: 18, fontFamily: FONTS.sans }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 2, lineHeight: 1.6, fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</li>
  ),
  pre: ({ children }) => (
    <pre style={{ background: '#1A2332', color: '#E2E8F0', padding: 12, borderRadius: 8, fontSize: FS.sm, overflowX: 'auto', margin: '6px 0', lineHeight: 1.5 }}>{children}</pre>
  ),
  code: ({ children, ...props }) => (
    <code style={{ background: `${C.teal}12`, padding: '1px 4px', borderRadius: 3, fontSize: FS.sm, fontFamily: 'monospace', color: C.teal }} {...props}>{children}</code>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: `3px solid ${C.teal}`, margin: '6px 0', paddingLeft: 12, color: C.darkL, fontStyle: 'italic', fontSize: FS.base, fontFamily: FONTS.sans }}>{children}</blockquote>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, fontFamily: FONTS.sans }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontFamily: FONTS.sans }}>{children}</em>
  ),
};

/* ─── Minimal component overrides (untuk teks pendek inline) ─────── */
// Hanya override p supaya tidak menambah margin; elemen lain biarkan default ReactMarkdown
const INLINE_COMPONENTS = {
  p: ({ children }) => (
    <span style={{ fontFamily: FONTS.sans }}>{children}</span>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, fontFamily: FONTS.sans }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontFamily: FONTS.sans }}>{children}</em>
  ),
};

/* ══════════════════════════════════════════════════════════════════
 * <MarkdownLatex>
 * Untuk konten panjang: bacaan materi, pesan AI chatbot, summary
 * Props:
 *   text        : string — teks markdown/LaTeX yang akan dirender
 *   style       : object (opsional) — override style wrapper div
 * ══════════════════════════════════════════════════════════════════ */
export const MarkdownLatex = ({ text = '', style }) => {
  if (!text) return null;
  return (
    <div style={style}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={FULL_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
 * <InlineLatex>
 * Untuk teks pendek satu baris: soal quiz, pilihan jawaban,
 * teks flashcard (depan/belakang), label mindmap, teks pretest
 *
 * Tetap render LaTeX ($...$, $$...$$) dan bold/em/code,
 * tapi TIDAK menambah margin/padding ekstra dari heading, list, dll.
 *
 * Props:
 *   text        : string — teks yang akan dirender
 *   style       : object (opsional) — override style wrapper span
 *   className   : string (opsional)
 * ══════════════════════════════════════════════════════════════════ */
export const InlineLatex = ({ text = '', style, className }) => {
  if (!text) return null;
  // Optimasi: jika tidak ada indikator LaTeX maupun Markdown,
  // kembalikan sebagai plain text untuk performa lebih baik.
  const hasLatex = text.includes('$') || text.includes('\\(') || text.includes('\\[');
  const hasMarkdown = /[*_`#\[\]]/.test(text);

  if (!hasLatex && !hasMarkdown) {
    return <span style={style} className={className}>{text}</span>;
  }

  return (
    <span style={{ display: 'inline', ...style }} className={className}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={INLINE_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </span>
  );
};

/* ══════════════════════════════════════════════════════════════════
 * renderMarkdownSR(text)
 * Helper function — drop-in replacement untuk renderMarkdown() lokal
 * di ChatSection. Mengembalikan JSX <MarkdownLatex>.
 * ══════════════════════════════════════════════════════════════════ */
export const renderMarkdownSR = (text) => <MarkdownLatex text={text} />;

export default MarkdownLatex;