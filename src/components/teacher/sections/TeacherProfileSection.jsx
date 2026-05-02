/**
 * SR MVP — TeacherProfileSection
 * src/components/teacher/sections/TeacherProfileSection.jsx
 *
 * Revisi: struktur mengikuti ProfileSection siswa
 *  - Banner gradient full-width (bukan di dalam card)
 *  - Konten 2-kolom dalam satu card putih (Informasi Pribadi | Akun & Mengajar)
 *  - Seksi "Mata Pelajaran & Kelas" di bawah card
 *
 * REVISI PENTING:
 *  - Profile guru sekarang DINAMIS dari AuthContext (user yang sedang login)
 *  - Lookup: user.id → TEACHERS → cari di ADMIN_GURU_INIT by nama/mapelId
 *  - Saat integrasi BE: ganti lookup dengan GET /guru/profile?id=user.id
 *  - Mapel & kelas yang ditampilkan sesuai data guru yang login
 */
import { useState, useRef } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import ChangePasswordModal from '../../shared/ChangePasswordModal';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { useAuth } from '../../../context/AuthContext';
import {
  ADMIN_GURU_INIT,
  ADMIN_KELAS_INIT,
  ADMIN_MAPEL_LIST,
  TEACHERS,
} from '../../../data/masterData';

// ─── Mapping teacher id → guru id ─────────────────────────────────────────
// TEACHERS pakai id t1/t2/t3/t4, ADMIN_GURU_INIT pakai id g1/g2/g3/g4.
// Mapping ini menyambungkan keduanya.
// Saat integrasi BE: user.id akan langsung berupa guru_id dari database.
const TEACHER_TO_GURU_ID = {
  t1: 'g2',  // Sri Dewi → bio/fis/kim
  t2: 'g1',  // Hendra   → mat
  t3: 'g3',  // Ratna    → bin
  t4: 'g4',  // Yoga     → eko/sos
};

// ─── Resolve guru dari user yang sedang login ──────────────────────────────
// Prioritas: user.id → mapping t→g → ADMIN_GURU_INIT
// Fallback: cari berdasarkan nama atau langsung pakai guru pertama
const resolveGuru = (user) => {
  if (!user) return ADMIN_GURU_INIT[0];

  // Coba mapping langsung (mock environment: t1/t2/t3/t4)
  const mappedId = TEACHER_TO_GURU_ID[user.id];
  if (mappedId) {
    const guru = ADMIN_GURU_INIT.find(g => g.id === mappedId);
    if (guru) return guru;
  }

  // Jika user.id sudah berformat g1/g2/... (BE real), langsung cari
  const byId = ADMIN_GURU_INIT.find(g => g.id === user.id);
  if (byId) return byId;

  // Fallback: cari berdasarkan nama dari user session
  if (user.nama) {
    const byNama = ADMIN_GURU_INIT.find(g =>
      g.nama.toLowerCase().includes(
        user.nama.replace('Bpk. ', '').replace('Ibu ', '').split(',')[0].toLowerCase().trim()
      )
    );
    if (byNama) return byNama;
  }

  return ADMIN_GURU_INIT[0];
};

/* ── ReadonlyInput — sama persis dengan ProfileSection siswa ── */
const ReadonlyInput = ({ value }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    background: C.bg, borderRadius: 10,
    border: `1.5px solid ${C.tealXL}`,
    padding: '10px 14px',
  }}>
    <span style={{ flex: 1, fontSize: FS.base, color: C.dark, fontWeight: 500 }}>{value || '—'}</span>
  </div>
);

/* ── Field wrapper ── */
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 20 }}>
    <label style={{
      display: 'block', fontSize: FS.sm, fontWeight: 700,
      color: C.slate, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6,
    }}>{label}</label>
    {children}
  </div>
);

/* ── MapelBlock — chip kelas per mapel ── */
const MapelBlock = ({ mapelId, kelasList }) => {
  const mapel = ADMIN_MAPEL_LIST.find(m => m.id === mapelId);
  if (!mapel || kelasList.length === 0) return null;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 12,
      background: `${mapel.color}0C`, border: `1.5px solid ${mapel.color}28`,
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
            background: `${mapel.color}16`, color: mapel.color,
            border: `1px solid ${mapel.color}40`,
            borderRadius: 99, padding: '3px 10px',
          }}>{k.nama}</span>
        ))}
      </div>
    </div>
  );
};

/* ── Main ── */
const TeacherProfileSection = ({ onPwdSuccess }) => {
  const { isMobile } = useBreakpoint();
  const { user } = useAuth();

  // Resolve guru berdasarkan user yang sedang login (DINAMIS)
  // Saat integrasi BE: ganti resolveGuru() dengan data dari GET /guru/profile
  const guru = resolveGuru(user);
  const semuaKelas = ADMIN_KELAS_INIT;

  const waliKelasList = semuaKelas.filter(k => k.waliKelasId === guru?.id);
  const mapelKelasMap = (guru?.mapelId || []).map(mid => ({
    mapelId: mid,
    kelasList: semuaKelas.filter(k => k.mapelGuruMap?.[mid] === guru?.id),
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: C.bg }}>

      {/* ── Banner gradient full-width (sama dengan profil siswa) ── */}
      <div style={{
        background: `linear-gradient(130deg, ${C.dark} 0%, ${C.darkM} 55%, #1D4E55 100%)`,
        padding: isMobile ? '20px 18px 24px' : '24px 32px 28px',
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Decorasi */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 18, right: 200, width: 55, height: 55, borderRadius: '50%', background: 'rgba(244,164,53,.07)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>

          {/* Avatar + nama */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarSrc ? (
                <img src={avatarSrc} alt="Foto profil" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,.3)', boxShadow: '0 4px 16px rgba(0,0,0,.3)' }} />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: guru.avatarBg || `linear-gradient(135deg,${C.teal},${C.tealL})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: 26,
                  border: '3px solid rgba(255,255,255,.3)',
                  boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                  userSelect: 'none',
                }}>{guru.avatar}</div>
              )}
              <button onClick={handleAvatarClick} title="Ganti foto profil"
                style={{
                  position: 'absolute', bottom: 1, right: 1,
                  width: 26, height: 26, borderRadius: '50%',
                  background: C.amber, border: '2px solid rgba(255,255,255,.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: FS.md, cursor: 'pointer', color: '#fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,.3)', transition: 'transform .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >📷</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
            </div>

            <div>
              <div style={{ color: C.white, fontWeight: 800, fontSize: FS.h2, marginBottom: 2 }}>{guru.nama}</div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: FS.base }}>{guru.email}</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.sm, marginTop: 3 }}>
                NIP {guru.nip}
                {waliKelasList.length > 0 && ` · Wali ${waliKelasList.map(k => k.nama).join(', ')}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 32px', background: C.bg }}>
        <div style={{
          maxWidth: 860, margin: '0 auto',
          background: C.white, borderRadius: 20,
          border: `1px solid ${C.tealXL}`,
          boxShadow: '0 4px 28px rgba(13,92,99,.07)',
          overflow: 'hidden',
        }}>

          {/* 2-kolom — Informasi Pribadi | Akun & Status */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            padding: isMobile ? '20px 18px 24px' : '28px 32px',
          }}>

            {/* Kolom kiri */}
            <div style={{ paddingRight: isMobile ? 0 : 32, borderRight: isMobile ? 'none' : `1px solid ${C.tealXL}`, paddingBottom: isMobile ? 20 : 0 }}>
              <div style={{ fontSize: FS.sm, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${C.tealXL}` }}>
                Informasi Pribadi
              </div>
              <Field label="Nama Lengkap">
                <ReadonlyInput value={guru.nama} />
              </Field>
              <Field label="NIP">
                <ReadonlyInput value={guru.nip} />
              </Field>
              <Field label="Email">
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: C.bg, borderRadius: 10,
                  border: `1.5px solid ${C.tealXL}`,
                  padding: '10px 14px',
                }}>
                  <span style={{ flex: 1, fontSize: FS.base, color: C.teal, fontWeight: 600 }}>{guru.email}</span>
                </div>
              </Field>
              <Field label="Bergabung Sejak">
                <ReadonlyInput value={guru.bergabung} />
              </Field>
            </div>

            {/* Kolom kanan */}
            <div style={{ paddingLeft: isMobile ? 0 : 32, borderTop: isMobile ? `1px solid ${C.tealXL}` : 'none', paddingTop: isMobile ? 20 : 0 }}>
              <div style={{ fontSize: FS.sm, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16, paddingBottom: 8, borderBottom: `1px solid ${C.tealXL}` }}>
                Akun &amp; Status
              </div>
              <Field label="Password">
                <div style={{ display: 'flex', alignItems: 'center', background: C.bg, borderRadius: 10, border: `1.5px solid ${C.tealXL}`, padding: '10px 14px', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: FS.base, color: C.slate, letterSpacing: '.2em' }}>••••••••</span>
                  <button onClick={() => setShowChangePwd(true)} style={{
                    background: 'none', border: `1px solid ${C.tealXL}`, borderRadius: 7,
                    padding: '4px 10px', fontSize: FS.sm, color: C.teal, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.teal}10`; e.currentTarget.style.borderColor = C.teal; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.tealXL; }}
                  >🔐 Ganti</button>
                </div>
              </Field>
              <Field label="Wali Kelas">
                {waliKelasList.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0' }}>
                    {waliKelasList.map(k => (
                      <span key={k.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: `${C.amber}14`, border: `1.5px solid ${C.amber}40`,
                        borderRadius: 99, padding: '5px 14px',
                        fontSize: FS.md, fontWeight: 700, color: C.dark,
                      }}>🏆 {k.nama}</span>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: C.bg, borderRadius: 10,
                    border: `1.5px solid ${C.tealXL}`,
                    padding: '10px 14px',
                  }}>
                    <span style={{ fontSize: FS.base, color: C.slate, fontStyle: 'italic' }}>Bukan wali kelas</span>
                  </div>
                )}
              </Field>
              <Field label="Mata Pelajaran & Kelas Diampu">
                {mapelKelasMap.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
                    {mapelKelasMap.map(({ mapelId, kelasList }) => (
                      <MapelBlock key={mapelId} mapelId={mapelId} kelasList={kelasList} />
                    ))}
                  </div>
                ) : (
                  <div style={{
                    background: C.bg, borderRadius: 10,
                    border: `1.5px solid ${C.tealXL}`,
                    padding: '10px 14px',
                  }}>
                    <span style={{ fontSize: FS.base, color: C.slate, fontStyle: 'italic' }}>Belum ada kelas diampu</span>
                  </div>
                )}
              </Field>
              <Field label="Status Akun">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `${C.green}14`, borderRadius: 99, border: `1.5px solid ${C.green}30`, padding: '7px 16px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 0 3px ${C.green}30` }} />
                  <span style={{ fontSize: FS.md, fontWeight: 700, color: C.green }}>Aktif</span>
                </div>
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal & Toast ── */}
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
    </div>
  );
};

export default TeacherProfileSection;