/**
 * SR MVP — TeacherView Shell
 * Tim 6 Fase 2 | src/components/teacher/TeacherView.jsx
 *
 * PERUBAHAN (profil guru):
 *  - User-info di sidebar menjadi tombol klikable → buka halaman profil
 *    (mengikuti pola StudentView)
 *  - Item "Profil" dihapus dari navItems
 *  - Tombol "Ganti Password" dihapus dari sidebar footer
 *    (dipindah ke dalam TeacherProfileSection)
 *  - activePage 'profile' merender <TeacherProfileSection />
 *
 * FIX lama:
 *  1. c.count → hitung dari STUDENTS per kelasId
 *  2. cls fallback ke CLASSES[0] agar tidak pernah undefined
 *  3. useWebSocket re-seed saat activeClass berubah (via key prop)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ForceChangePasswordModal from '../shared/ForceChangePasswordModal';
import { C, FONTS, FS } from '../../styles/tokens';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { SUBJECTS, TEACHERS, SEEDED_TEACHER_ID, CLASSES, STUDENTS } from '../../data/masterData';

import MonitoringSection from './sections/MonitoringSection';
import KelolaBelajarSection from './sections/KelolaBelajarSection';
import RiwayatKontenSection from './sections/RiwayatKontenSection';
import TeacherProfileSection from './sections/TeacherProfileSection';

// FIX 1: derive count dari STUDENTS
const classesWithCount = CLASSES.map(c => ({
  ...c,
  count: STUDENTS.filter(s => s.kelasId === c.id).length,
}));

const TeacherView = () => {
  const navigate = useNavigate();
  const { user, logout, completeFirstLogin } = useAuth();
  const { isMobile } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showForceChange, setShowForceChange] = useState(user?.is_first_login === true);
  const onNavigate = (screen) => {
    if (screen === 'login') { logout(); navigate('/login', { replace: true }); return; }
    if (screen === 'student') { navigate('/siswa'); return; }
  };

  const [activeClass, setActiveClass] = useState(CLASSES[0].id);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [recommendations, setRecommendations] = useState({});
  const [recModal, setRecModal] = useState(null);
  const [recText, setRecText] = useState('');
  const [recPipeline, setRecPipeline] = useState(null);
  const [sentToAI, setSentToAI] = useState({});
  const [downloadModal, setDownloadModal] = useState(false);
  const [barTooltip, setBarTooltip] = useState(null);
  const [pwdToast, setPwdToast] = useState(false);

  const teacher = TEACHERS.find(t => t.id === SEEDED_TEACHER_ID);
  const teacherMapel = SUBJECTS.find(s => s.id === teacher?.mapelId);

  // FIX 2
  const cls = CLASSES.find(c => c.id === activeClass) ?? CLASSES[0];

  const saveRec = (studentId) => {
    const text = recText.trim(); if (!text) return;
    setRecommendations(p => ({ ...p, [studentId]: text }));
    setRecModal(null); setRecText('');
    setRecPipeline('saving');
    setTimeout(() => {
      setRecPipeline('done');
      setSentToAI(p => ({ ...p, [studentId]: { mapelId: teacher?.mapelId, text, ts: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) } }));
      setTimeout(() => setRecPipeline(null), 2500);
    }, 1500);
  };

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'kelola', icon: '📐', label: 'Kelola Konten Belajar' },
    { id: 'riwayat', icon: '📚', label: 'Riwayat Konten' },
  ];

  const sharedMonitoring = {
    teacher, teacherMapel, cls, activeClass, setActiveClass,
    recommendations, recModal, setRecModal, recText, setRecText,
    recPipeline, setRecPipeline, sentToAI, setSentToAI,
    downloadModal, setDownloadModal,
    saveRec, barTooltip, setBarTooltip, selectedStudent, setSelectedStudent,
  };

  return (
    <>
      <div style={{ display: 'flex', height: '100vh', background: C.bg, overflow: 'hidden' }}>

        {/* ── Mobile sidebar overlay ── */}
        {isMobile && (
          <div
            className={`admin-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <div className={`sr-sidebar${isMobile ? (sidebarOpen ? ' open' : '') : ''}`}
          style={{
            background: C.dark, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            ...(isMobile ? { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 300, width: 240, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease' } : {}),
          }}>

          {/* Brand */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏫</span>
            <div>
              <div style={{ color: C.white, fontWeight: 700, fontSize: FS.base }}>Sekolah Rakyat</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.xs }}>Portal Guru</div>
            </div>
          </div>

          {/* User info — klik untuk buka profil (mengikuti pola StudentView) */}
          <div
            onClick={() => { setActivePage('profile'); if (isMobile) setSidebarOpen(false); }}
            style={{
              padding: '14px',
              borderBottom: '1px solid rgba(255,255,255,.07)',
              cursor: 'pointer',
              background: activePage === 'profile' ? 'rgba(13,92,99,.35)' : 'transparent',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { if (activePage !== 'profile') e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
            onMouseLeave={e => { if (activePage !== 'profile') e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: teacher?.bg || `linear-gradient(135deg,${C.teal},${C.tealL})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: FS.lg,
                border: `2px solid ${activePage === 'profile' ? C.amber : 'rgba(244,164,53,.35)'}`,
                flexShrink: 0, transition: 'border-color .15s',
              }}>
                {teacher?.initials || 'GR'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.white, fontWeight: 700, fontSize: FS.md, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {teacher?.name || 'Guru'}
                </div>
                <div style={{ color: teacherMapel?.color || C.teal, fontSize: FS.xs, fontWeight: 700, marginTop: 1 }}>
                  {teacherMapel?.icon} {teacherMapel?.label}
                </div>
              </div>
              <span style={{ color: 'rgba(255,255,255,.3)', fontSize: 22, lineHeight: 1 }}>›</span>
            </div>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
            <div style={{ padding: '6px 10px', fontSize: FS.xs, fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Menu Utama
            </div>
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setActivePage(item.id); if (isMobile) setSidebarOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px',
                  background: activePage === item.id ? 'rgba(13,92,99,.5)' : 'transparent',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', marginBottom: 2, transition: 'all .15s',
                }}
                onMouseEnter={e => { if (activePage !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
                onMouseLeave={e => { if (activePage !== item.id) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ fontSize: FS.md, fontWeight: activePage === item.id ? 700 : 400, color: activePage === item.id ? C.white : 'rgba(255,255,255,.55)' }}>
                  {item.label}
                </span>
                {activePage === item.id && (
                  <span style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: C.amber }} />
                )}
              </button>
            ))}

            {/* Daftar Kelas */}
            <div style={{ padding: '0 6px', marginTop: 8 }}>
              <div style={{ padding: '6px 10px', fontSize: FS.xs, fontWeight: 700, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Daftar Kelas
              </div>
              {classesWithCount.map(c => (
                <button key={c.id} onClick={() => { setActiveClass(c.id); if (isMobile) setSidebarOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: activeClass === c.id ? 'rgba(13,92,99,.45)' : 'transparent',
                    border: 'none', borderRadius: 8,
                    color: activeClass === c.id ? C.white : 'rgba(255,255,255,.5)',
                    fontFamily: 'inherit', fontSize: FS.sm, cursor: 'pointer', marginBottom: 2, transition: 'all .18s',
                  }}>
                  <span>{c.label}</span>
                  <span style={{ background: 'rgba(255,255,255,.1)', borderRadius: 99, padding: '1px 7px', fontSize: 9 }}>
                    {c.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer sidebar — hanya tombol Keluar; Ganti Password sudah pindah ke profil */}
          <div style={{ padding: '6px 8px 8px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
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

        {/* ── Main content ── */}
        <div className="sr-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ── Mobile top bar with hamburger ── */}
          {isMobile && (
            <div style={{
              height: 52, background: C.dark, display: 'flex', alignItems: 'center',
              padding: '0 16px', gap: 12, flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,.08)',
            }}>
              <button
                onClick={() => setSidebarOpen(s => !s)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {[0, 1, 2].map(i => <div key={i} style={{ width: 20, height: 2, background: C.white, borderRadius: 1 }} />)}
              </button>
              <span style={{ fontSize: 16 }}>🏫</span>
              <span style={{ color: C.white, fontWeight: 700, fontSize: FS.base }}>Portal Guru</span>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {activePage === 'dashboard' && (
              /* FIX 3: key={activeClass} → MonitoringSection remount saat kelas berubah */
              <MonitoringSection key={activeClass} {...sharedMonitoring} />
            )}
            {activePage === 'kelola' && <KelolaBelajarSection />}
            {activePage === 'riwayat' && <RiwayatKontenSection />}
            {activePage === 'profile' && (
              <TeacherProfileSection
                onPwdSuccess={() => { setPwdToast(true); setTimeout(() => setPwdToast(false), 3500); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Navigation (mobile only) ── */}
      <nav className="sr-bottom-nav">
        {[
          { id: 'dashboard', icon: '📊', label: 'Monitor' },
          { id: 'kelola', icon: '📐', label: 'Kelola' },
          { id: 'riwayat', icon: '📚', label: 'Riwayat' },
          { id: 'profile', icon: '👤', label: 'Profil' },
        ].map(item => (
          <button key={item.id} onClick={() => setActivePage(item.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: activePage === item.id ? 700 : 400, color: activePage === item.id ? C.amber : 'rgba(255,255,255,.5)' }}>{item.label}</span>
            {activePage === item.id && <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.amber }} />}
          </button>
        ))}
        <button onClick={() => onNavigate('login')}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px', fontFamily: 'inherit' }}>
          <span style={{ fontSize: 20 }}>🚪</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Keluar</span>
        </button>
      </nav>

      {/* RecPipeline toast */}
      {recPipeline && recPipeline !== 'done' && (
        <div style={{ position: 'fixed', bottom: 28, right: 24, background: C.dark, color: C.white, borderRadius: 12, padding: '12px 18px', fontSize: FS.md, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: C.white, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          {recPipeline === 'saving' && 'Menyimpan rekomendasi…'}
        </div>
      )}
      {recPipeline === 'done' && (
        <div style={{ position: 'fixed', bottom: 28, right: 24, background: C.green, color: '#fff', borderRadius: 12, padding: '12px 18px', fontSize: FS.md, zIndex: 9999, fontWeight: 700 }}>
          ✅ Rekomendasi Terkirim!
        </div>
      )}

      {pwdToast && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: C.green, color: '#fff', borderRadius: 99, padding: '10px 22px', fontSize: FS.base, fontWeight: 700, zIndex: 9999 }}>
          ✅ Password berhasil diubah!
        </div>
      )}
    </>
  );
};

export default TeacherView;