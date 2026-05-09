// ─── Design Tokens ───────────────────────────────────────────────
// Sistem warna konsisten berbasis Teal
// Primary  = teal (aksi utama, CTA, highlight)
// Secondary = slate/abu (teks sekunder, border, surface)
// Accent   = teal muda (background highlight, tag, badge)

export const C = {
  // ── PRIMARY: Teal ──────────────────────────────────────────────
  teal: "#0D5C63",   // primary-700  — teks, border kuat
  tealL: "#1A8A94",   // primary-500  — hover, gradient
  tealXL: "#D4F0F3",   // primary-100  — background ringan, border halus
  tealM: "#0F7280",   // primary-600  — tombol hover
  tealBg: "#F0FDFA",   // primary-50   — surface sangat ringan

  // ── SECONDARY: Slate ───────────────────────────────────────────
  dark: "#1A2332",   // slate-900  — teks utama
  darkM: "#2D3E50",   // slate-800  — teks kuat
  darkL: "#4A5568",   // slate-600  — teks sedang
  slate: "#8899AA",   // slate-400  — teks muted / placeholder
  slateL: "#CBD5E0",   // slate-300  — border halus
  slateXL: "#EDF2F7",   // slate-100  — background alternatif

  // ── SEMANTIC ───────────────────────────────────────────────────
  red: "#C53030",
  redL: "#FED7D7",
  green: "#276749",
  greenL: "#C6F6D5",
  amber: "#B7791F",
  amberL: "#FEFCBF",
  purple: "#553C9A",
  purpleL: "#E9D8FD",

  // ── SURFACE ────────────────────────────────────────────────────
  white: "#FFFFFF",
  bg: "#F7F9FA",
  cream: "#F8FAFB",
  bgChat: "#F4F8F9",
};

// ─── Typography ───────────────────────────────────────────────────
export const FONTS = {
  sans: "'Plus Jakarta Sans', sans-serif",
  serif: "'Source Serif 4', serif",
};

// ─── Font sizes ───────────────────────────────────────────────────
export const FS = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 16,
  h3: 17,
  h2: 18,
  h1: 20,
};

// ─── Spacing ──────────────────────────────────────────────────────
export const SP = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 28,
};

// ─── Role colors — teal unified ───────────────────────────────────
export const ROLE_COLORS = {
  siswa: { bg: C.teal, text: C.white },
  guru: { bg: C.tealL, text: C.white },
  admin: { bg: C.darkM, text: C.white },
};

// ─── Warna universal mapel (menggantikan color per-mapel) ─────────
export const MAPEL_COLOR = C.teal;
export const MAPEL_COLOR_LIGHT = C.tealXL;
export const MAPEL_COLOR_HOVER = C.tealL;
