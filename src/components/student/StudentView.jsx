/**
 * SR MVP — StudentView Shell (REVISED)
 * src/components/student/StudentView.jsx
 *
 * Perubahan:
 *  - Kamera: camGranted state dikelola di sini, di-reset saat buka chat baru
 *  - recentActivity + addRecentActivity → diteruskan ke Dashboard & Chat
 *  - openChatWithWebcam: dipakai oleh "Mulai Belajar" & "Lanjutkan"
 *    → set chatMateri + reset camGranted → navigasi ke chat
 *  - Hapus showCamModal (modal kamera sekarang inside ChatSection)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentStore } from '../../stores/studentStore';
import { Btn } from '../shared/UI';
import ChangePasswordModal from '../shared/ChangePasswordModal';
import { C, FONTS, FS } from '../../styles/tokens';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CONF_CONTENT_INIT } from '../../data/masterData';
import { getGame } from '../../api/game';
import DashboardSection from './sections/DashboardSection';
import ProgressSection from './sections/ProgressSection';
import ChatSection from './sections/ChatSection';
import ProfileSection from './sections/ProfileSection';

const makeKey = (mapelId, sub) => `${mapelId}__${sub}`;

const LEVEL_META = {
  low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' },
  mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' },
  high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' },
};

/**
 * ATPCamModal — satu modal unified:
 *  • Tampilan: Level badge + ATP info (seperti gambar 2)
 *  • Fungsi : getUserMedia browser permission dipanggil saat klik "Izinkan"
 *  • States : idle → requesting → granted → denied
 */
const ATPCamModal = ({ camPendingMateri, onConfirm, onDeny }) => {
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied
  const [deniedList, setDeniedList] = useState([]);

  const materiId = camPendingMateri?.materiId || camPendingMateri?.mapelLabel || 'materi ini';
  const mapelLabel = camPendingMateri?.mapelLabel || '';
  const level = camPendingMateri?.level || 'low';
  const levelMeta = LEVEL_META[level] || LEVEL_META.low;

  const atpLines = [
    `Setelah mempelajari ${materiId}, siswa mampu:`,
    `Memahami konsep dasar dan prinsip-prinsip utama dari ${materiId}.`,
    `Menerapkan pengetahuan ${materiId} dalam konteks ${mapelLabel}.`,
    `Menganalisis permasalahan terkait ${materiId} secara kritis.`,
  ];

  const requestPermissions = async () => {
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStatus('granted');
      setTimeout(() => onConfirm(stream), 700);
    } catch (err) {
      const denied = [];
      try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch { denied.push('Kamera'); }
      try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { denied.push('Mikrofon'); }
      setDeniedList(denied.length > 0 ? denied : ['Kamera', 'Mikrofon']);
      setStatus('denied');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)',
      backdropFilter: 'blur(5px)', zIndex: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="bounce-in sr-modal-box" style={{
        overflow: 'hidden',
      }}>

        {/* ── Idle: tampilan ATP ── */}
        {status === 'idle' && (
          <div style={{ padding: '28px 26px 24px' }}>
            {/* Icons + title */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>📷🎙️</div>
              <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                Berikan Akses Kamera dan Mikrofon
              </div>
              <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.6 }}>
                Mentor AI membutuhkan kamera & mikrofon untuk sesi belajar{' '}
                <strong style={{ color: C.teal }}>{materiId}</strong>.
              </div>
            </div>

            {/* Level badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: FS.sm, padding: '4px 14px', borderRadius: 99, fontWeight: 700, background: levelMeta.bg, color: levelMeta.color, border: `1px solid ${levelMeta.border}` }}>
                Level Konten: {levelMeta.label}
              </span>
            </div>

            {/* ATP box */}
            <div style={{ background: `${C.teal}0f`, borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: `1px solid ${C.tealXL}` }}>
              <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 8 }}>Alur Tujuan Pembelajaran:</div>
              {atpLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, marginBottom: i < atpLines.length - 1 ? 5 : 0 }}>
                  <span style={{ color: C.teal, fontWeight: 700, fontSize: FS.sm, flexShrink: 0, marginTop: 1 }}>•</span>
                  <span style={{ fontSize: FS.md, color: C.darkL, lineHeight: 1.6 }}>{line}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onDeny}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: `1.5px solid ${C.tealXL}`, background: C.white, fontSize: FS.base, fontWeight: 700, color: C.darkL, cursor: 'pointer', fontFamily: 'inherit' }}>
                Tidak Sekarang
              </button>
              <button onClick={requestPermissions}
                style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: C.teal, color: C.white, fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Izinkan &amp; Mulai Belajar
              </button>
            </div>
          </div>
        )}

        {/* ── Requesting: spinner ── */}
        {status === 'requesting' && (
          <div style={{ padding: '40px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 14 }}>⏳</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
              Menunggu izin browser...
            </div>
            <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.65, marginBottom: 20 }}>
              Periksa notifikasi izin di bagian atas browser kamu, lalu klik <strong>"Izinkan"</strong>.
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 38, height: 38, border: `4px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          </div>
        )}

        {/* ── Granted ── */}
        {status === 'granted' && (
          <div style={{ padding: '40px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>✅</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 700, color: C.green, marginBottom: 8 }}>
              Izin Diberikan!
            </div>
            <div style={{ fontSize: FS.base, color: C.darkL, marginBottom: 14 }}>Memulai sesi belajar...</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: FS.base, color: C.green, fontWeight: 600 }}>
              <span>📷 Kamera ✓</span>
              <span>🎙️ Mikrofon ✓</span>
            </div>
          </div>
        )}

        {/* ── Denied ── */}
        {status === 'denied' && (
          <div style={{ padding: '28px 26px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⛔</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 700, color: C.red, marginBottom: 10 }}>
              Izin Ditolak
            </div>
            <div style={{ background: '#FFF5F5', borderRadius: 10, padding: '12px 16px', marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: FS.md, fontWeight: 700, color: C.red, marginBottom: 6 }}>Akses ditolak untuk:</div>
              {deniedList.map(d => (
                <div key={d} style={{ fontSize: FS.md, color: C.darkL, display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ color: C.red }}>✕</span> {d}
                </div>
              ))}
            </div>
            <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.7, marginBottom: 20 }}>
              Buka <strong>Pengaturan Browser → Privasi → Izin Situs</strong>, aktifkan kamera & mikrofon untuk halaman ini, lalu coba lagi.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onDeny}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.tealXL}`, background: 'none', color: C.darkL, fontWeight: 600, fontSize: FS.base, cursor: 'pointer', fontFamily: 'inherit' }}>
                Batal
              </button>
              <button onClick={() => setStatus('idle')}
                style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: C.teal, color: '#fff', fontWeight: 700, fontSize: FS.base, cursor: 'pointer', fontFamily: 'inherit' }}>
                🔄 Coba Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StudentView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Ambil state dari navigation (dikirim oleh PretestPage)
  const pretestResult = location.state?.pretestResult || null;
  // pretestElemenDone: dikirim PretestPage setelah pretest elemen selesai
  // → langsung buka ATPCamModal dengan materiData
  const pretestElemenDone = location.state?.pretestElemenDone || false;
  const pretestElemenMateriData = location.state?.materiData || null;

  const [activePage, setActivePage] = useState(
    location.state?.returnTo === 'progress' ? 'progress' : 'dashboard'
  );

  // Sync activePage saat kembali dari PretestPage
  useEffect(() => {
    if (location.state?.returnTo === 'progress') {
      setActivePage('progress');
    }
  }, [location.state?.returnTo]);

  // Setelah pretest elemen selesai → langsung buka ATPCamModal
  useEffect(() => {
    if (pretestElemenDone && pretestElemenMateriData) {
      setCamPendingMateri(pretestElemenMateriData);
      setShowCamModal(true);
      // Bersihkan state agar tidak loop
      navigate('/siswa', { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pretestElemenDone]);

  const onNavigate = (screen) => {
    if (screen === 'login') { logout(); navigate('/login', { replace: true }); return; }
    if (screen === 'teacher') { navigate('/guru'); return; }
    if (screen === 'dashboard' || screen === 'student') { navigate('/siswa'); return; }
  };

  /* ── Chat state ─────────────────────────────────────────────── */
  const [chatMateri, setChatMateri] = useState(null);
  const [msgsByKey, setMsgsByKey] = useState({});
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEnd = useRef(null);
  const chatFileRef = useRef(null);
  const [chatAttachments, setChatAttachments] = useState([]);

  /* ── Content / quiz state ───────────────────────────────────── */
  const [confContent, setConfContent] = useState(CONF_CONTENT_INIT);
  const [confOverlay, setConfOverlay] = useState(null);
  const [confGenerating, setConfGenerating] = useState(false);
  const [flashIdx, setFlashIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const {
    markTopicOngoing,
    progressData,           // ← dari store
    setProgressData,        // ← dari store
    addRecentActivity,      // ← dari store (persisten, anti stale-closure)
  } = useStudentStore();

  // gameContext: { mapelId, mapelLabel, mapelIcon, mapelColor, elemenId, elemenLabel, materiId, level, game_id? }
  // gameData:   response dari getGame() — berisi html_url + status dari Tim 4
  const [gameContext, setGameContext] = useState(null);
  const [gameData, setGameData] = useState(null);   // null | GameItem
  const [gameLoading, setGameLoading] = useState(false);

  /* ── Camera (inside ChatSection) ────────────────────────────── */
  const [camGranted, setCamGranted] = useState(false);
  const [camPendingMateri, setCamPendingMateri] = useState(null);
  const [showCamModal, setShowCamModal] = useState(false);

  // Stream kamera sesi — dibuat saat startChat, dimatikan HANYA saat handleSafeBack
  // Dikirim ke ChatSection via prop agar preview modal re-use stream yang sama
  const sessionStreamRef = useRef(null);
  const sessionVideoRef = useRef(null);

  const stopSessionCamera = () => {
    if (sessionStreamRef.current) {
      sessionStreamRef.current.getTracks().forEach(t => t.stop());
      sessionStreamRef.current = null;
    }
    if (sessionVideoRef.current) {
      sessionVideoRef.current.srcObject = null;
    }
  };

  /* ── Search ─────────────────────────────────────────────────── */
  const [searchQ, setSearchQ] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  /* ── Misc modals ─────────────────────────────────────────────── */
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdToast, setPwdToast] = useState(false);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [msgsByKey, typing, chatMateri]);
  /* ── Open chat with webcam flow ─────────────────────────────── */

  // Dipanggil oleh "Mulai Belajar" (dari rekomendasi) & "Lanjutkan" (dari progress).
  // materiOrMapel: { mapelId, mapelLabel, mapelIcon, mapelColor, [materiId] }
  // Dipanggil oleh "Mulai Belajar" (dari rekomendasi) & ProgressSection (sudah handle cam modal sendiri).
  // Untuk source 'progress': langsung startChat (cam modal sudah ditampilkan di ProgressSection).
  const openChatWithWebcam = (materiOrMapel) => {
    // Semua path masuk ATPCamModal (ATP info + browser permission dalam 1 modal).
    setCamPendingMateri(materiOrMapel);
    setShowCamModal(true);
  };

  // Dipanggil oleh DashboardSection "Mulai Belajar" — cek pretest dulu
  // Dashboard selalu pakai elemen pertama (materi pertama dari elemen pertama),
  // sehingga isMateriLevel ditentukan dari apakah ada MATERI_PER_ELEMEN[mapelId][elemenId]
  const handleNavigateToPretest = (params) => {
    const storeState = useStudentStore.getState();
    // Dashboard rekomendasi: elemen tanpa breakdown → pretest elemen; dengan breakdown → pretest materi
    const isMateriLevel = !!params.isMateriLevel;
    const targetMateriId = params.targetMateriId || null;

    const done = isMateriLevel
      ? storeState.isPretestMateriDone?.(params.mapelId, params.elemenId, targetMateriId)
      : storeState.isPretestElemenDone(params.mapelId, params.elemenId);

    if (done) {
      openChatWithWebcam(params.materiData);
    } else {
      navigate('/pretest', {
        state: {
          targetMapelId: params.mapelId,
          targetElemenId: params.elemenId,
          targetElemenLabel: params.elemenLabel,
          targetMateriId,
          isMateriLevel,
          materiData: params.materiData,
          returnTo: 'dashboard',
        },
      });
    }
  };

  const startChat = (materiOrMapel, stream) => {
    // Fullscreen tidak lagi dipaksakan — deteksi pelanggaran kini via visibilitychange / blur
    // Simpan stream yang sudah diperoleh dari ATPCamModal sebagai stream sesi persisten
    if (stream) {
      sessionStreamRef.current = stream;
      // Attach ke hidden video element jika sudah ada
      if (sessionVideoRef.current) {
        sessionVideoRef.current.srcObject = stream;
        sessionVideoRef.current.play().catch(() => { });
      }
    }
    markTopicOngoing(materiOrMapel);
    setChatMateri(materiOrMapel);
    setCamGranted(true);
    setActivePage("chat");
    setQuizActive(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setConfOverlay(null);
    // Pesan pembuka topik akan diinisialisasi di ChatSection via getOpeningMessage()
    // jika belum ada di msgsByKey — tidak perlu pre-populate di sini
  };

  /* ── Nav items ───────────────────────────────────────────────── */
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'progress', icon: '📈', label: 'Progress' },
    { id: 'profile', icon: '👤', label: 'Profil' },
  ];

  // Bottom nav item for mobile chat access (chat ditampilkan sebagai page penuh)
  const allNavItems = [
    { id: 'dashboard', icon: '🏠', label: 'Beranda' },
    { id: 'progress', icon: '📈', label: 'Progress' },
    { id: 'profile', icon: '👤', label: 'Profil' },
  ];

  const sharedChat = {
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
    sessionStreamRef,
    sessionVideoRef,
    stopSessionCamera,
    openGame: (ctx) => {
      // ctx: { mapelId, mapelLabel, mapelIcon, mapelColor, elemenId, elemenLabel, materiId?, level, game_id? }
      setGameContext(ctx);
      setGameData(null);
      // Jika ada game_id → fetch detail (html_url) dari Tim 4
      if (ctx.game_id) {
        setGameLoading(true);
        getGame(ctx.game_id)
          .then(data => { setGameData(data); setGameLoading(false); })
          .catch(() => setGameLoading(false));
      }
    },
  };

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>

        {/* ── Sidebar overlay backdrop (mobile/tablet) ── */}
        {(isMobile || isTablet) && (
          <div
            className={`sr-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar (desktop: always visible; mobile/tablet: overlay) ── */}
        {activePage !== 'chat' && (
          <div className={`sr-sidebar${(isMobile || isTablet) ? (sidebarOpen ? ' open' : '') : ''}`}
            style={{ background: C.dark, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Logo */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🏫</span>
              <div>
                <div style={{ color: C.white, fontWeight: 700, fontSize: FS.base }}>Sekolah Rakyat</div>
                <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.xs }}>Portal Siswa</div>
              </div>
            </div>

            {/* User info */}
            <div
              onClick={() => setActivePage('profile')}
              style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,.07)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: FS.lg, border: `2px solid ${activePage === 'profile' ? C.amber : 'rgba(244,164,53,.4)'}`, flexShrink: 0 }}>{user?.avatar || '?'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.white, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.nama || 'Siswa'}</div>
                  <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.xs, marginTop: 1 }}>SR Kota Malang</div>
                  <div style={{ color: 'rgba(255,255,255,.35)', fontSize: 10 }}>Kelas {user?.kelas_id || 'X-1'}</div>
                </div>
                <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 30 }}>›</span>
              </div>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', background: activePage === item.id ? 'rgba(13,92,99,.5)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2, transition: 'all .15s' }}
                  onMouseEnter={e => { if (activePage !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
                  onMouseLeave={e => { if (activePage !== item.id) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span style={{ fontSize: FS.md, fontWeight: activePage === item.id ? 700 : 400, color: activePage === item.id ? C.white : 'rgba(255,255,255,.55)' }}>{item.label}</span>
                  {activePage === item.id && <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: C.amber }} />}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '6px 8px 8px', borderTop: '1px solid rgba(255,255,255,.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={() => onNavigate('login')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', fontWeight: 'bold', gap: 8, padding: '7px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,.45)', fontSize: FS.sm, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.45)'; }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Keluar
              </button>
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        <div className={activePage !== 'chat' ? 'sr-main-content' : ''} style={{ flex: 1, display: 'flex', overflow: 'hidden', width: '100%', flexDirection: 'column' }}>

          {/* ── Top Bar with hamburger (mobile/tablet only, hidden during chat) ── */}
          {activePage !== 'chat' && isCompact && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: 52,
              padding: '0 16px',
              gap: 12,
              background: C.dark,
              flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,.08)',
              zIndex: 10,
            }}>
              <button
                onClick={() => setSidebarOpen(s => !s)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 0, margin: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 4, width: 24, height: 24, flexShrink: 0,
                }}
              >
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 20, height: 2, background: C.white, borderRadius: 1 }} />
                ))}
              </button>
              <span style={{ fontSize: 16, lineHeight: '1', display: 'flex', alignItems: 'center' }}>🏫</span>
              <span style={{ color: C.white, fontWeight: 700, fontSize: FS.base, lineHeight: '1' }}>
                Portal Siswa
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => { setActivePage('profile'); setSidebarOpen(false); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `linear-gradient(135deg,${C.teal},${C.tealL})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: FS.base,
                  border: `2px solid ${activePage === 'profile' ? C.amber : 'rgba(244,164,53,.3)'}`,
                }}>
                  {user?.avatar || '?'}
                </div>
              </button>
            </div>
          )}
          {activePage === 'dashboard' && (
            <DashboardSection
              currentUser={user}
              progressData={progressData}
              setActivePage={setActivePage}
              openChatWithWebcam={openChatWithWebcam}
              pretestResult={pretestResult}
              onNavigateToPretest={handleNavigateToPretest}
            />
          )}
          {activePage === 'progress' && (
            <ProgressSection
              progressData={progressData}
              openChatWithWebcam={openChatWithWebcam}
              onNavigateToPretest={(params) => {
                navigate('/pretest', {
                  state: {
                    targetMapelId: params.mapelId,
                    targetElemenId: params.elemenId,
                    targetElemenLabel: params.elemenLabel,
                    targetMateriId: params.targetMateriId || null,
                    isMateriLevel: !!params.isMateriLevel,
                    materiData: params.materiData,
                    returnTo: 'progress',
                  },
                });
              }}
            />
          )}
          {activePage === 'chat' && <ChatSection {...sharedChat} />}
          {activePage === 'profile' && (
            <ProfileSection
              currentUser={user}
              progressData={progressData}
              onChangePwd={() => setShowChangePwd(true)}
            />
          )}
        </div>
      </div>

      {/* ── Bottom Navigation removed — replaced by hamburger sidebar ── */}

      {gameContext && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: '#0d1520',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn .25s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 20px', flexShrink: 0,
            background: `linear-gradient(135deg, ${gameContext.mapelColor}, ${gameContext.mapelColor}cc)`,
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,.4)',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h1, flexShrink: 0 }}>
              {gameContext.mapelIcon || '🎮'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: FS.lg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎮 {gameData?.nama || 'Game Belajar'}
              </div>
              <div style={{ color: 'rgba(255,255,255,.7)', fontSize: FS.sm, marginTop: 1 }}>
                {gameContext.mapelLabel}
                {gameContext.elemenLabel && ` · ${gameContext.elemenLabel}`}
                {(gameData?.materi || gameContext.materiId) && ` · ${gameData?.materi || gameContext.materiId}`}
                {` · Level ${(gameContext.level || 'Low').toUpperCase()}`}
              </div>
            </div>
            <button
              onClick={() => { setGameContext(null); setGameData(null); setGameLoading(false); }}
              style={{
                background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.25)',
                borderRadius: 10, padding: '8px 16px', color: '#fff',
                fontWeight: 700, fontSize: FS.md, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.15)'}
            >
              ← Kembali Belajar
            </button>
          </div>

          {/* Game Canvas — Tim 4 deliver HTML, render via iframe */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

            {/* State: loading — fetch getGame() sedang berlangsung */}
            {gameLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0d1520 70%)' }}>
                <div style={{ width: 52, height: 52, border: `4px solid ${gameContext.mapelColor}33`, borderTopColor: gameContext.mapelColor, borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
                <div style={{ color: 'rgba(255,255,255,.6)', fontWeight: 600, fontSize: FS.lg }}>Memuat game…</div>
              </div>
            )}

            {/* State: generating — Tim 4 masih proses generate HTML */}
            {!gameLoading && gameData?.status === 'generating' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0d1520 70%)' }}>
                <div style={{ width: 52, height: 52, border: `4px solid ${gameContext.mapelColor}33`, borderTopColor: gameContext.mapelColor, borderRadius: '50%', animation: 'spin .9s linear infinite' }} />
                <div style={{ color: '#fff', fontWeight: 700, fontSize: FS.h2 }}>Sedang generate game…</div>
                <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.md, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
                  Tim 4 sedang menyiapkan game untuk<br />
                  <strong style={{ color: gameContext.mapelColor }}>{gameContext.elemenLabel || gameContext.mapelLabel}</strong>
                  {gameContext.materiId && <> · <strong style={{ color: 'rgba(255,255,255,.6)' }}>{gameContext.materiId}</strong></>}
                </div>
              </div>
            )}

            {/* State: failed */}
            {!gameLoading && gameData?.status === 'failed' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0d1520 70%)' }}>
                <div style={{ fontSize: 52 }}>⚠️</div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: FS.h2 }}>Gagal memuat game</div>
                <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.md }}>Coba kembali beberapa saat lagi</div>
                <button
                  onClick={() => { setGameContext(null); setGameData(null); setGameLoading(false); }}
                  style={{ marginTop: 8, padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${gameContext.mapelColor}`, background: 'transparent', color: gameContext.mapelColor, fontWeight: 700, fontSize: FS.md, cursor: 'pointer', fontFamily: 'inherit' }}
                >← Kembali Belajar</button>
              </div>
            )}

            {/* State: ready — render game HTML dari Tim 4 via iframe */}
            {!gameLoading && gameData?.status === 'ready' && gameData?.html_url && (
              <iframe
                key={gameData.html_url}
                src={gameData.html_url}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={`Game ${gameData.elemen_label || gameContext.mapelLabel}${gameData.materi ? ' · ' + gameData.materi : ''} Level ${gameData.level}`}
                sandbox="allow-scripts allow-same-origin allow-forms"
                allow="fullscreen"
              />
            )}

            {/* State: belum ada game_id — placeholder informatif */}
            {!gameLoading && !gameData && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 32, gap: 20,
                background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0d1520 70%)',
              }}>
                <div style={{ width: '100%', maxWidth: 680, aspectRatio: '16/9', borderRadius: 20, background: '#111c2a', border: `2px solid ${gameContext.mapelColor}44`, boxShadow: `0 0 60px ${gameContext.mapelColor}22, 0 8px 32px rgba(0,0,0,.5)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 240, height: 240, borderRadius: '50%', background: `${gameContext.mapelColor}18`, filter: 'blur(40px)', pointerEvents: 'none' }} />
                  <div style={{ fontSize: 60, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,.4))' }}>🎮</div>
                  <div style={{ textAlign: 'center', zIndex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: FS.h2, marginBottom: 8 }}>Game Edukatif</div>
                    <div style={{ color: 'rgba(255,255,255,.45)', fontSize: FS.base, lineHeight: 1.6, maxWidth: 360 }}>
                      Game HTML dari Tim 4 akan di-render di sini.<br />
                      Pilih game dari daftar di menu belajar.
                    </div>
                  </div>
                  <div style={{ background: `${gameContext.mapelColor}22`, border: `1px solid ${gameContext.mapelColor}55`, borderRadius: 12, padding: '8px 20px', zIndex: 1 }}>
                    <span style={{ color: gameContext.mapelColor, fontSize: FS.md, fontWeight: 700 }}>
                      {gameContext.elemenLabel || gameContext.mapelLabel}
                      {gameContext.materiId && ` · ${gameContext.materiId}`}
                      {` · Level ${(gameContext.level || 'Low').toUpperCase()}`}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: FS.md, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>
                  Klik &ldquo;← Kembali Belajar&rdquo; di atas untuk melanjutkan sesi dengan Mentor AI
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Popup Kamera — sederhana, tanpa scan/frame ── */}
      {showCamModal && (
        <ATPCamModal
          camPendingMateri={camPendingMateri}
          onConfirm={(stream) => {
            setShowCamModal(false);
            if (camPendingMateri) {
              // Stream TIDAK di-stop di sini — diserahkan ke useWebcamEmotion via startChat
              // useWebcamEmotion akan re-use atau request ulang lewat requestPermission
              // Track akan di-stop otomatis saat stopCapture() dipanggil saat keluar chatbot
              startChat(camPendingMateri, stream);
              setCamPendingMateri(null);
            }
          }}
          onDeny={() => { setShowCamModal(false); setCamPendingMateri(null); }}
        />
      )}

      {/* ── Change Password Modal ── */}
      {showChangePwd && (
        <ChangePasswordModal
          role="siswa" userName={user?.nama}
          onClose={() => setShowChangePwd(false)}
          onSuccess={() => { setPwdToast(true); setTimeout(() => setPwdToast(false), 3500); }}
        />
      )}

      {/* ── Toast ── */}
      {pwdToast && (
        <div className="bounce-in" style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: C.green, color: '#fff', borderRadius: 99, padding: '10px 22px', fontSize: FS.base, fontWeight: 700, zIndex: 9999 }}>
          ✅ Password berhasil diubah!
        </div>
      )}
    </>
  );
};

export default StudentView;