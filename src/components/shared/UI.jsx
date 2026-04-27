/**
 * SR MVP — Shared UI Components (RESPONSIVE v2)
 * src/components/shared/UI.jsx
 *
 * Perubahan:
 *  - GlobalStyle: tambah viewport-aware CSS variables, media queries
 *    untuk sidebar/bottom-nav, modal sizing, font scaling
 *  - Semua komponen atom: tidak ada perubahan API, hanya style internal
 *    diperkuat dengan min/max sizing agar tidak pecah di layar kecil
 */

import { C, FONTS, FS } from '../../styles/tokens';

// ── Button ─────────────────────────────────────────────────────────
export const Btn = ({ children, variant = 'primary', onClick, style = {}, disabled = false, size = 'md' }) => {
  const sizes = { sm: '6px 12px', md: '9px 18px', lg: '12px 28px' };
  const vars = {
    primary: { background: C.teal,   color: C.white, boxShadow: `0 2px 8px rgba(13,92,99,.3)` },
    amber:   { background: C.amber,  color: C.dark,  boxShadow: `0 2px 8px rgba(244,164,53,.3)` },
    ghost:   { background: 'transparent', color: C.teal, border: `1.5px solid ${C.teal}` },
    danger:  { background: C.red,    color: C.white },
    soft:    { background: C.tealXL, color: C.teal },
    dark:    { background: C.dark,   color: C.white },
    green:   { background: C.green,  color: C.white },
  };
  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: sizes[size], borderRadius: 8, border: 'none',
        fontFamily: 'inherit', fontWeight: 600,
        fontSize: size === 'sm' ? FS.md : FS.lg,
        transition: 'all .18s', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1, minHeight: 36,
        ...vars[variant], ...style,
      }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.opacity = '.9'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}
    >
      {children}
    </button>
  );
};

// ── Badge ──────────────────────────────────────────────────────────
export const Badge = ({ label, color = 'teal' }) => {
  const m = {
    teal:   { bg: C.tealXL,  fg: C.teal   },
    amber:  { bg: C.amberL,  fg: C.orange },
    red:    { bg: C.redL,    fg: C.red    },
    green:  { bg: C.greenL,  fg: C.green  },
    purple: { bg: C.purpleL, fg: C.purple },
    slate:  { bg: '#EDF2F7', fg: C.darkL  },
  };
  const s = m[color] ?? m.teal;
  return (
    <span style={{ background: s.bg, color: s.fg, padding: '2px 8px', borderRadius: 99, fontSize: FS.sm, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
};

// ── Avatar ─────────────────────────────────────────────────────────
export const Avatar = ({ initials, bg = C.teal, size = 36 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: C.white, fontWeight: 700, fontSize: size * .35, flexShrink: 0,
  }}>
    {initials}
  </div>
);

// ── ProgressBar ────────────────────────────────────────────────────
export const ProgressBar = ({ value, color = C.teal, height = 6 }) => (
  <div style={{ background: '#E8EFF5', borderRadius: 99, height, overflow: 'hidden', flex: 1 }}>
    <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .6s' }} />
  </div>
);

// ── Card ───────────────────────────────────────────────────────────
export const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.white, borderRadius: 14,
    boxShadow: '0 2px 12px rgba(26,35,50,.07)',
    border: `1px solid rgba(13,92,99,.08)`, ...style,
  }}>
    {children}
  </div>
);

// ── Divider ────────────────────────────────────────────────────────
export const Divider = () => (
  <div style={{ height: 1, background: 'rgba(13,92,99,.08)', margin: '10px 0' }} />
);

// ── Emotion color map ──────────────────────────────────────────────
export const EmotionColor = {
  antusias:  C.green,
  bosan:     C.darkL,
  bingung:   C.amber,
  frustrasi: C.red,
};

// ── Spinner ────────────────────────────────────────────────────────
export const Spinner = ({ size = 18, color = C.teal }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid rgba(13,92,99,.15)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin .8s linear infinite',
    flexShrink: 0,
  }} />
);

// ── StatusBadge ────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const cfg = {
    'Aktif':     { bg: C.greenL,  color: C.green  },
    'Cuti':      { bg: C.amberL,  color: C.orange },
    'Nonaktif':  { bg: '#EDF2F7', color: C.darkL  },
    'Keluar':    { bg: C.redL,    color: C.red    },
    'Normal':    { bg: C.greenL,  color: C.green  },
    'Perhatian': { bg: C.redL,    color: C.red    },
  }[status] ?? { bg: '#EDF2F7', color: C.darkL };
  return (
    <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
};

// ── EmptyState ─────────────────────────────────────────────────────
export const EmptyState = ({ icon = '📭', title = 'Belum ada data', sub = '', style = {}, children }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    width: '100%', ...style,
  }}>
    <div style={{ fontSize: 36, marginBottom: 12, opacity: .7 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark, marginBottom: 4 }}>{title}</div>
    {sub && <div style={{ fontSize: FS.md, color: C.darkL }}>{sub}</div>}
    {children}
  </div>
);

// ── SectionTitle ───────────────────────────────────────────────────
export const SectionTitle = ({ title, sub }) => (
  <div style={{ marginBottom: 20, flexShrink: 0 }}>
    <div style={{ fontFamily: FONTS.serif, fontSize: FS.h1, fontWeight: 600, color: C.dark }}>{title}</div>
    {sub && <div style={{ fontSize: FS.md, color: C.slate, marginTop: 3 }}>{sub}</div>}
  </div>
);

// ── Global Styles (RESPONSIVE) ─────────────────────────────────────
export const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html,body,#root{height:100%;width:100%;}
    body{font-family:${FONTS.sans};background:${C.bg};color:${C.dark};-webkit-text-size-adjust:100%;}

    /* ── CSS Variables — dipakai di semua View ── */
    :root{
      --sidebar-w:210px;
      --top-bar-h:0px;
      --content-px:20px;
      --content-py:20px;
      --modal-w:440px;
    }
    @media(max-width:767px){
      :root{
        --sidebar-w:0px;
        --top-bar-h:52px;
        --content-px:14px;
        --content-py:14px;
        --modal-w:calc(100vw - 24px);
      }
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:${C.tealXL};border-radius:99px;}

    /* ── Animations ── */
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideRight{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes bounceIn{0%{transform:scale(.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    @keyframes waveTyping{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
    @keyframes sr-shimmerSlide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
    @keyframes sr-glowPulse1{0%,100%{box-shadow:0 0 0 0 rgba(244,164,53,.5)}60%{box-shadow:0 0 0 12px rgba(244,164,53,0)}}
    @keyframes sr-glowPulse2{0%,100%{box-shadow:0 0 0 0 rgba(136,153,170,.5)}60%{box-shadow:0 0 0 10px rgba(136,153,170,0)}}
    @keyframes sr-glowPulse3{0%,100%{box-shadow:0 0 0 0 rgba(205,127,50,.5)}60%{box-shadow:0 0 0 10px rgba(205,127,50,0)}}
    @keyframes sr-crownFloat{0%,100%{transform:translateX(-50%) rotate(-5deg)}50%{transform:translateX(-50%) translateY(-5px) rotate(5deg)}}
    @keyframes confettiFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(48px) rotate(360deg);opacity:0}}

    .fade-in{animation:fadeIn .35s ease both;}
    .slide-in{animation:slideIn .3s ease both;}
    .slide-right{animation:slideRight .3s ease both;}
    .bounce-in{animation:bounceIn .4s cubic-bezier(.34,1.56,.64,1) both;}
    button{cursor:pointer;font-family:inherit;}
    input,textarea,select{font-family:inherit;}
    .shimmer{background:linear-gradient(90deg,${C.tealXL} 25%,#e8f8fa 50%,${C.tealXL} 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;}
    .skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;border-radius:6px;}
    .offline-banner{position:fixed;top:0;left:0;right:0;z-index:9999;background:${C.red};color:#fff;text-align:center;padding:6px 12px;font-size:12px;font-weight:600;}
    .degraded-banner{position:fixed;top:0;left:0;right:0;z-index:9999;background:${C.amber};color:${C.dark};text-align:center;padding:6px 12px;font-size:12px;font-weight:600;}

    /* ── App Shell — Admin (dipakai di AdminContent) ── */
    .admin-view{display:flex;width:100vw;height:100vh;overflow:hidden;position:fixed;inset:0;}
    .admin-sidebar{width:220px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden;transition:transform .25s ease,width .25s ease;}
    .admin-main{flex:1;min-width:0;display:flex;overflow:hidden;}
    .admin-page{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;}
    .admin-page-scroll{flex:1;overflow:auto;width:100%;}
    .admin-table-wrap{flex:1;overflow:auto;}
    .admin-table-wrap table{width:100%;border-collapse:collapse;}
    .admin-header{padding:14px var(--content-px);background:#fff;border-bottom:1px solid rgba(13,92,99,.08);display:flex;align-items:center;gap:12px;flex-shrink:0;flex-wrap:wrap;position:sticky;top:0;z-index:50;}

    /* Mobile: sidebar jadi overlay, sembunyikan by default */
    @media(max-width:767px){
      .admin-sidebar{
        position:fixed;left:0;top:0;bottom:0;z-index:300;
        transform:translateX(-100%);width:240px !important;
      }
      .admin-sidebar.open{transform:translateX(0);}
      .admin-sidebar-overlay{
        display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:299;
      }
      .admin-sidebar-overlay.open{display:block;}
    }

    /* ── Mobile Top Bar (hamburger + brand) ── */
    .sr-top-bar{
      display:none;
      height:var(--top-bar-h,52px);
      background:${C.dark};
      align-items:center;
      padding:0 16px;
      gap:12px;
      flex-shrink:0;
      border-bottom:1px solid rgba(255,255,255,.08);
      z-index:10;
    }
    @media(max-width:767px){
      .sr-top-bar{ display:flex; }
      /* konten utama butuh padding-top agar tidak tertutup fixed top bar */
      .sr-main-wrapper{
        padding-top:var(--top-bar-h,52px);
      }
    }
    /* Hamburger button */
    .sr-hamburger{
      background:none;border:none;cursor:pointer;
      padding:6px;display:flex;flex-direction:column;
      gap:4px;flex-shrink:0;
    }
    .sr-hamburger span{
      display:block;width:20px;height:2px;
      background:${C.white};border-radius:1px;
      transition:transform .2s, opacity .2s;
    }

    /* ── Sidebar Siswa/Guru — responsive ── */
    .sr-sidebar{
      width:var(--sidebar-w,210px);
      flex-shrink:0;
      display:flex;
      flex-direction:column;
      overflow:hidden;
      transition:transform .25s ease, width .25s ease;
    }
    /* Mobile & Tablet: sidebar jadi overlay drawer */
    @media(max-width:767px){
      .sr-sidebar{
        position:fixed;left:0;top:0;bottom:0;z-index:300;
        width:240px !important;
        transform:translateX(-100%);
      }
      .sr-sidebar.open{ transform:translateX(0); }
      .sr-sidebar-overlay{
        display:none;position:fixed;inset:0;
        background:rgba(0,0,0,.45);z-index:299;
      }
      .sr-sidebar-overlay.open{ display:block; }
    }

    /* ── Modal responsif ── */
    .sr-modal-box{
      background:${C.white};
      border-radius:20px;
      width:var(--modal-w,440px);
      max-height:90vh;
      overflow-y:auto;
      box-shadow:0 28px 64px rgba(0,0,0,.28);
    }

    /* ── Table: scroll horizontal di mobile ── */
    .sr-table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
    .sr-table-scroll table{min-width:540px;}

    /* ── Utility ── */
    .sr-hide-mobile{display:block;}
    .sr-show-mobile{display:none;}
    @media(max-width:767px){
      .sr-hide-mobile{display:none !important;}
      .sr-show-mobile{display:flex !important;}
    }
    /* Sticky page title bar — always sticky */
    .sr-page-title-bar{
      padding:14px var(--content-px,20px) 10px;
      background:${C.bg};
      flex-shrink:0;
      border-bottom:1px solid rgba(13,92,99,.07);
      position:sticky;top:0;z-index:50;
      box-shadow:0 2px 6px rgba(13,92,99,.05);
    }

    /* ── Drawer mobile: full-width ── */
    @media(max-width:767px){
      .sr-drawer{width:100% !important;max-width:100% !important;}
    }

    /* ── Input & tap target: min 44px on mobile ── */
    @media(max-width:767px){
      input,select,textarea,button{min-height:40px;}
      .admin-header{padding:10px var(--content-px);}
    }

    /* ── SplashPage title ── */
    .sr-splash-title{font-size:42px;}
    @media(max-width:479px){.sr-splash-title{font-size:clamp(24px,8vw,36px);}}
  `}</style>
);
