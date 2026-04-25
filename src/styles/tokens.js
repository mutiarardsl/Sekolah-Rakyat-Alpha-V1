// ─── Design Tokens ───────────────────────────────────────────────
export const C = {
  teal:    "#0D5C63",
  tealL:   "#1A8A94",
  tealXL:  "#D4F0F3",
  amber:   "#F4A435",
  amberL:  "#FDE8C0",
  cream:   "#FDF6EC",
  dark:    "#1A2332",
  darkM:   "#2D3E50",
  darkL:   "#4A5568",
  slate:   "#8899AA",
  white:   "#FFFFFF",
  bg:      "#F7F9FA",
  slateL:  "#D4F0F3",
  red:     "#E53E3E",
  redL:    "#FED7D7",
  green:   "#2F855A",
  greenL:  "#C6F6D5",
  orange:  "#DD6B20",
  orangeL: "#FEEBC8",
  purple:  "#6B46C1",
  purpleL: "#E9D8FD",
};

// ─── Typography ───────────────────────────────────────────────────
export const FONTS = {
  sans:  "'Plus Jakarta Sans', sans-serif",
  serif: "'Source Serif 4', serif",
};

// ─── Font sizes ───────────────────────────────────────────────────
export const FS = {
  xs:      10,
  sm:      11,
  md:      12,
  base:    13,
  lg:      14,
  xl:      16,
  h3:      17,
  h2:      18,
  h1:      20,
};

// ─── Spacing ──────────────────────────────────────────────────────
export const SP = {
  xs:      4,
  sm:      8,
  md:      12,
  lg:      16,
  xl:      20,
  xxl:     24,
  section: 28,
};

// ─── Role colors ──────────────────────────────────────────────────
export const ROLE_COLORS = {
  siswa: { bg: C.teal,   text: C.white },
  guru:  { bg: C.amber,  text: C.dark  },
  admin: { bg: C.purple, text: C.white },
};
