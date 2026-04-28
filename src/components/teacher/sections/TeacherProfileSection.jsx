/**
 * SR MVP — TeacherProfileSection
 * Tim 6 Fase 2 | src/components/teacher/sections/TeacherProfileSection.jsx
 *
 * Halaman profil guru:
 *  - Avatar dengan upload foto
 *  - Nama lengkap, NIP, Email, Tanggal bergabung
 *  - Wali kelas (jika ada)
 *  - Mata pelajaran & kelas yang diampu (dikelompokkan per mapel)
 *  - Tombol Ganti Password (dipindah dari sidebar)
 */
import { useState, useRef } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import ChangePasswordModal from '../../shared/ChangePasswordModal';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import {
  ADMIN_GURU_INIT,
  ADMIN_KELAS_INIT,
  ADMIN_MAPEL_LIST,
} from '../../../data/masterData';

// Guru yang sedang login (seeded = g1, Bpk. Hendra, mapped dari SEEDED_TEACHER_ID "t2")
const CURRENT_GURU_ID = 'g1';

// ─────────────────────────────────────────────────────────────────
// InfoRow
// ─────────────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, last = false, children }) => (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 0',
    borderBottom: last ? 'none' : `1px solid ${C.tealXL}`,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: `${C.teal}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: FS.h3, flexShrink: 0, marginTop: 1,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: FS.xs, color: C.slate, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// MapelBlock — satu mapel dengan chip kelas
// ─────────────────────────────────────────────────────────────────
const MapelBlock = ({ mapelId, kelasList }) => {
  const mapel = ADMIN_MAPEL_LIST.find(m => m.id === mapelId);
  if (!mapel || kelasList.length === 0) return null;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: `${mapel.color}0C`,
      border: `1.5px solid ${mapel.color}28`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 15 }}>{mapel.icon}</span>
        <span style={{ fontSize: FS.md, fontWeight: 800, color: mapel.color }}>{mapel.label}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {kelasList.map(k => (
          <span key={k.id} style={{
            fontSize: FS.sm, fontWeight: 700,
            background: `${mapel.color}16`,
            color: mapel.color,
            border: `1px solid ${mapel.color}40`,
            borderRadius: 99, padding: '3px 10px',
          }}>
            {k.nama}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
const TeacherProfileSection = ({ onPwdSuccess }) => {
  const { isMobile } = useBreakpoint();
  const guru = ADMIN_GURU_INIT.find(g => g.id === CURRENT_GURU_ID);
  const semuaKelas = ADMIN_KELAS_INIT;

  const waliKelasList = semuaKelas.filter(k => k.waliKelasId === CURRENT_GURU_ID);

  const mapelKelasMap = (guru?.mapelId || []).map(mid => ({
    mapelId: mid,
    kelasList: semuaKelas.filter(k => k.mapelGuruMap?.[mid] === CURRENT_GURU_ID),
  })).filter(m => m.kelasList.length > 0);

  const [avatarSrc, setAvatarSrc] = useState(null);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdToast, setPwdToast] = useState(false);
  const fileRef = useRef();

  const handleAvatarClick = () => fileRef.current?.click();
  const handleAvatarChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!guru) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.slate }}>
      Data guru tidak ditemukan.
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: C.bg,
    }}>

      {/* 1 ── Judul halaman — STICKY */}
      <div style={{ padding: '16px 28px 12px', background: C.bg, flexShrink: 0, borderBottom: `1px solid ${C.tealXL}` }}>
        <h1 style={{
          margin: 0,
          fontFamily: FONTS.serif,
          fontSize: 22, fontWeight: 700, color: C.dark, letterSpacing: '-.01em',
        }}>
          Profil Guru
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: FS.md, color: C.slate }}>
          Informasi akun dan data mengajar Anda di Sekolah Rakyat.
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 14px' : '28px 32px', background: C.bg }}>

        {/* 2 ── Kartu utama */}
        <div style={{
          background: C.white, borderRadius: 20,
          border: `1px solid ${C.tealXL}`,
          boxShadow: '0 4px 28px rgba(13,92,99,.08)',
          overflow: 'hidden', maxWidth: 760, margin: '0 auto',
        }}>

          {/* Banner — avatar di dalam, tanpa teks nama/NIP */}
          <div style={{
            background: `linear-gradient(130deg, ${C.dark} 0%, ${C.darkM} 55%, #1D4E55 100%)`,
            padding: '24px 32px', position: 'relative', overflow: 'hidden',
          }}>
            {/* dekorasi */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -20, right: 100, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 18, right: 195, width: 50, height: 50, borderRadius: '50%', background: 'rgba(244,164,53,.07)', pointerEvents: 'none' }} />

            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 12 }}>

              {/* Avatar di dalam banner */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Foto profil" style={{
                    width: 100, height: 100, borderRadius: '50%', objectFit: 'cover',
                    border: `3px solid rgba(255,255,255,.3)`,
                    boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                  }} />
                ) : (
                  <div style={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: guru.avatarBg || `linear-gradient(135deg,${C.teal},${C.tealL})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 900, fontSize: 26,
                    border: `3px solid rgba(255,255,255,.3)`,
                    boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                    userSelect: 'none',
                  }}>
                    {guru.avatar}
                  </div>
                )}
                {/* tombol upload foto */}
                <button
                  onClick={handleAvatarClick}
                  title="Ganti foto profil"
                  style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 26, height: 26, borderRadius: '50%',
                    background: C.amber, border: `2px solid rgba(255,255,255,.6)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: FS.md, cursor: 'pointer', color: '#fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,.3)',
                    transition: 'transform .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >📷</button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              </div>

              {/* Tombol Ganti Password */}
              <button
                onClick={() => setShowChangePwd(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '9px 18px', borderRadius: 99,
                  background: 'rgba(255,255,255,.1)',
                  border: '1.5px solid rgba(255,255,255,.25)',
                  color: '#fff', fontSize: FS.md, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  backdropFilter: 'blur(8px)',
                  transition: 'all .15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.25)'; }}
              >
                🔐 Ganti Password
              </button>
            </div>
          </div>

          {/* Body — 2 kolom (1 kolom di mobile) */}
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '0 40px', padding: isMobile ? '16px 18px 24px' : '20px 32px 32px',
          }}>

            {/* Kolom kiri */}
            <div>
              <InfoRow icon="👤" label="Nama Lengkap">
                <span style={{ fontSize: FS.lg, fontWeight: 700, color: C.dark }}>{guru.nama}</span>
              </InfoRow>
              <InfoRow icon="🪪" label="NIP">
                <span style={{ fontSize: FS.base, fontWeight: 600, color: C.dark, fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}>{guru.nip}</span>
              </InfoRow>
              <InfoRow icon="✉️" label="Email">
                <span style={{ fontSize: FS.base, fontWeight: 600, color: C.teal }}>{guru.email}</span>
              </InfoRow>
              <InfoRow icon="📅" label="Bergabung Sejak" last>
                <span style={{ fontSize: FS.base, fontWeight: 600, color: C.dark }}>{guru.bergabung}</span>
              </InfoRow>
            </div>

            {/* Kolom kanan */}
            <div>
              <InfoRow icon="🏫" label="Wali Kelas">
                {waliKelasList.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {waliKelasList.map(k => (
                      <span key={k.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: `${C.amber}14`, border: `1.5px solid ${C.amber}40`,
                        borderRadius: 99, padding: '4px 12px',
                        fontSize: FS.md, fontWeight: 700, color: C.dark,
                      }}>🏆 {k.nama}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: FS.md, color: C.slate, fontStyle: 'italic' }}>Bukan wali kelas</span>
                )}
              </InfoRow>

              <InfoRow icon="📚" label="Mata Pelajaran & Kelas yang Diampu" last>
                {mapelKelasMap.length > 0 ? (
                  <div style={{ marginTop: 2 }}>
                    {mapelKelasMap.map(({ mapelId, kelasList }) => (
                      <MapelBlock key={mapelId} mapelId={mapelId} kelasList={kelasList} />
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: FS.md, color: C.slate, fontStyle: 'italic' }}>Belum ada data mengajar.</span>
                )}
              </InfoRow>
            </div>
          </div>
        </div>

        {/* Modal & Toast */}
        {showChangePwd && (
          <ChangePasswordModal
            role="guru"
            userName={guru.nama}
            onClose={() => setShowChangePwd(false)}
            onSuccess={() => {
              setPwdToast(true);
              setTimeout(() => setPwdToast(false), 3500);
              if (onPwdSuccess) onPwdSuccess();
            }}
          />
        )}
        {pwdToast && (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: C.green, color: '#fff', borderRadius: 99,
            padding: '10px 24px', fontSize: FS.base, fontWeight: 700, zIndex: 9999,
            boxShadow: '0 4px 16px rgba(47,133,90,.4)',
          }}>
            ✅ Password berhasil diubah!
          </div>
        )}
      </div> {/* end scrollable content */}
    </div>
  );
};

export default TeacherProfileSection;