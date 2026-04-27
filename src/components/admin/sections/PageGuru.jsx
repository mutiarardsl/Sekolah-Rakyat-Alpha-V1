/** SR MVP — Admin: Manajemen Guru — REVISED
 *
 * Perubahan:
 *  1. ModalGuru: tanggal bergabung otomatis saat akun dibuat, validasi email & NIP
 *  2. GuruDrawer: format seragam dengan SiswaDrawer (tampilkan login / password sementara)
 *  3. PageGuru tabel: tombol hapus guru, filter nama/email/mapel/NIP, filter status
 */
import { useState } from 'react';
import { Avatar, Btn, EmptyState } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { MultiCheckbox, INP_STYLE, ADMIN_SEKOLAH } from './adminUtils';
import BulkUploadGuru from './BulkUploadGuru';
import AddMenu from './AddMenu';

/* ── Helpers ──────────────────────────────────────────────────────── */
const genTempPasswordGuru = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const formatBergabung = () => {
  const now = new Date();
  return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateNIP = (nip) => !nip || /^\d{18}$/.test(nip.replace(/\s/g, ''));

/* ── ConfirmDeleteModal ───────────────────────────────────────────── */
export const ConfirmDeleteModal = ({ title, message, onConfirm, onClose, confirmLabel = '🗑 Hapus', confirmColor = '#E53E3E' }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, backdropFilter: 'blur(4px)' }}
    onClick={onClose}>
    <div className="bounce-in" onClick={e => e.stopPropagation()}
      style={{ background: '#FFFFFF', borderRadius: 16, padding: 28, width: "min(400px, calc(100vw - 24px))", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
      <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>⚠️</div>
      <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: '#1A2332', textAlign: 'center', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: FS.base, color: '#8899AA', textAlign: 'center', marginBottom: 24, lineHeight: 1.7 }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: C.bg, border: '1.5px solid #D4F0F3', borderRadius: 10, color: '#1A2332', fontSize: FS.base, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Batal</button>
        <button onClick={onConfirm} style={{ flex: 2, padding: '10px 0', background: confirmColor, border: 'none', borderRadius: 10, color: '#FFFFFF', fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

/* ── GuruDrawer ───────────────────────────────────────────────────── */
export const GuruDrawer = ({ guruId, guruList, kelasList, getMapel, getKelas, setSelectedGuru, setModalData, setModal, onDeleteGuru }) => {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const g = guruList.find(x => x.id === guruId);
  if (!g) return null;

  const waliDi = kelasList.filter(k => k.waliKelasId === g.id);

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(26,35,50,.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'flex-end', zIndex: 998, backdropFilter: 'blur(2px)'
      }} onClick={() => setSelectedGuru(null)}>
        <div className="slide-right" onClick={e => e.stopPropagation()}
          style={{
            width: 'min(400px, 92vw)', height: '100vh', background: '#FFFFFF', overflowY: 'auto',
            boxShadow: '-10px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column'
          }}>

          {/* Header */}
          <div style={{
            padding: '18px 18px 14px', borderBottom: 'rgba(13,92,99,.08) 1px solid',
            display: 'flex', alignItems: 'flex-start', gap: 12
          }}>
            <Avatar initials={g.avatar} bg={g.avatarBg} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark, marginTop: 2 }}>{g.nama}</div>
              <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{g.email}</div>
              {g.nip && (
                <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 3, fontFamily: 'monospace' }}>NIP: {g.nip}</div>
              )}
            </div>
            <button onClick={() => setSelectedGuru(null)} style={{
              background: C.bg, border: `1.5px solid ${C.tealXL}`, borderRadius: 8,
              width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate
            }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

            {/* Status + Bergabung */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                fontSize: FS.sm, padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                background: g.status === 'Non-Aktif' ? '#FFF5F5' : '#F0FFF4',
                color: g.status === 'Non-Aktif' ? '#C53030' : '#276749',
                border: `1px solid ${g.status === 'Non-Aktif' ? '#FEB2B2' : '#9AE6B4'}`
              }}>
                {g.status === 'Non-Aktif' ? '⛔ Non-Aktif' : '✅ Aktif'}
              </span>
              {g.bergabung && (
                <span style={{ fontSize: FS.sm, color: C.slate, display: 'flex', alignItems: 'center', gap: 4 }}>
                  📅 Bergabung {g.bergabung}
                </span>
              )}
            </div>

            {/* Login Info — password sementara */}
            {g._tempPassword && (
              <div style={{ background: '#FFF8EE', border: '1px solid #F6AD55', borderRadius: 10, padding: '10px 14px', fontSize: FS.sm, color: '#744210', marginBottom: 14, lineHeight: 1.7 }}>
                🔑 <b>Akun baru</b> — bagikan password sementara berikut ke guru.
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(246,173,85,.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: FS.xs, color: '#92400E' }}>Password sementara</span>
                  <code style={{ fontSize: FS.base, fontFamily: 'monospace', fontWeight: 800, color: '#92400E', letterSpacing: 2 }}>{g._tempPassword}</code>
                </div>
                <div style={{ fontSize: FS.xs, color: '#B7791F', marginTop: 4 }}>Guru harus mengganti password saat login pertama.</div>
              </div>
            )}

            {/* Wali kelas */}
            {waliDi.length > 0 && (
              <div style={{
                background: `${C.teal}0D`, border: `1px solid ${C.teal}22`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ fontSize: 16 }}>🧑‍🏫</span>
                <div>
                  <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal }}>Wali Kelas</div>
                  {waliDi.map(k => (
                    <div key={k.id} style={{ fontSize: FS.base, color: C.dark, fontWeight: 600 }}>{k.nama}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Detail rows */}
            {[
              { l: 'NIP', v: g.nip || '—', mono: true },
              { l: 'Email', v: g.email || '—' },
              { l: 'Bergabung', v: g.bergabung || '—' },
            ].map(item => (
              <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: 'rgba(13,92,99,.06) 1px solid' }}>
                <span style={{ fontSize: FS.md, color: C.slate }}>{item.l}</span>
                <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark, fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.v}</span>
              </div>
            ))}

            {/* Mapel */}
            <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark, marginBottom: 10, marginTop: 14 }}>📚 Mapel yang Diajar</div>
            {g.mapelId.length === 0 && (
              <span style={{ fontSize: FS.base, color: C.slate, fontStyle: 'italic' }}>Belum ada mapel</span>
            )}
            {g.mapelId.map(mid => {
              const m = getMapel(mid);
              const kelasIds = (g.mapelKelasMap || {})[mid] || g.kelasId || [];
              return m ? (
                <div key={mid} style={{
                  marginBottom: 10, background: C.bg,
                  borderRadius: 10, padding: '10px 12px', border: `1.5px solid ${m.color}22`
                }}>
                  <span style={{
                    fontSize: FS.md, padding: '7px 14px', borderRadius: 99,
                    background: m.color + '18', color: m.color, fontWeight: 700,
                    display: 'inline-block', marginBottom: 6
                  }}>{m.icon} {m.label}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {kelasIds.length === 0 && (
                      <span style={{ fontSize: FS.xs, color: C.slate, fontStyle: 'italic' }}>Belum ada kelas</span>
                    )}
                    {kelasIds.map(kid => {
                      const k = getKelas(kid);
                      const isWali = k?.waliKelasId === g.id;
                      return k ? (
                        <span key={kid} style={{
                          fontSize: FS.xs, padding: '2px 8px', borderRadius: 99,
                          background: isWali ? C.teal : C.tealXL,
                          color: isWali ? C.white : C.teal, fontWeight: 600
                        }}>
                          {k.nama.replace('Kelas ', '')}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              ) : null;
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 18px', borderTop: 'rgba(13,92,99,.08) 1px solid', display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setDeleteConfirm(true)}
              style={{
                padding: '9px 14px', background: '#FFF5F5', border: '1px solid #FEB2B2',
                borderRadius: 9, color: C.red, fontSize: FS.md, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>🗑</button>
            <Btn variant="soft" onClick={() => { setModalData({ ...g }); setModal('edit-guru'); setSelectedGuru(null); }}
              style={{ flex: 1, fontSize: FS.md, justifyContent: 'center' }}>✏️ Edit Data</Btn>
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Hapus Guru?"
          message={<>Data <b>{g.nama}</b> akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.</>}
          onClose={() => setDeleteConfirm(false)}
          onConfirm={() => { onDeleteGuru?.(g.id); setDeleteConfirm(false); setSelectedGuru(null); }}
        />
      )}
    </>
  );
};

/* ── ModalGuru ────────────────────────────────────────────────────── */
export const ModalGuru = ({ modalData, mapelList, kelasList, saveGuru, onClose }) => {
  const emptyGuru = {
    nama: '', nip: '', email: '',
    mapelId: [], mapelKelasMap: {}, kelasId: [],
    bergabung: '', status: 'Aktif', avatar: '', avatarBg: `linear-gradient(135deg,${C.teal},${C.tealL})`
  };
  const [form, setForm] = useState(() => {
    const d = modalData || emptyGuru;
    const base = { ...emptyGuru, ...d, mapelKelasMap: d.mapelKelasMap || {}, status: d.status || 'Aktif' };
    if (!d.id) {
      base._tempPassword = genTempPasswordGuru();
      base.bergabung = formatBergabung();
    }
    return base;
  });
  const [errors, setErrors] = useState({});
  const isEdit = !!form.id;
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const multiMapel = form.mapelId.length >= 2;

  const handleMapelChange = (newMapelIds) => {
    setForm(p => {
      const cleaned = {};
      newMapelIds.forEach(mid => { cleaned[mid] = p.mapelKelasMap[mid] || []; });
      return { ...p, mapelId: newMapelIds, mapelKelasMap: cleaned };
    });
  };

  const handleMapelKelasChange = (mapelId, newKelasIds) => {
    setForm(p => ({ ...p, mapelKelasMap: { ...p.mapelKelasMap, [mapelId]: newKelasIds } }));
  };

  const validate = () => {
    const errs = {};
    if (!form.nama.trim()) errs.nama = 'Nama wajib diisi';
    if (!form.email.trim()) errs.email = 'Email wajib diisi';
    else if (!validateEmail(form.email)) errs.email = 'Format email tidak valid (contoh: nama@domain.com)';
    if (form.nip && !validateNIP(form.nip)) errs.nip = 'NIP harus tepat 18 digit angka';
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const allKelas = [...new Set(Object.values(form.mapelKelasMap).flat())];
    saveGuru({ ...form, kelasId: allKelas });
  };

  const inpStyle = (field) => ({ ...INP_STYLE, ...(errors[field] ? { borderColor: C.red } : {}) });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16, padding: 28, width: 560, maxHeight: '90vh',
          overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)'
        }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
          {isEdit ? '✏️ Edit Data Guru' : '👨‍🏫 Tambah Guru Baru'}
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 18 }}>{ADMIN_SEKOLAH.nama} · {ADMIN_SEKOLAH.tahunAjaran}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Nama Lengkap *</label>
            <input value={form.nama} onChange={e => { setF('nama', e.target.value); setErrors(p => ({ ...p, nama: '' })); }}
              placeholder="Nama lengkap + gelar" style={inpStyle('nama')}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = errors.nama ? C.red : C.tealXL} />
            {errors.nama && <div style={{ fontSize: FS.xs, color: C.red, marginTop: 3 }}>⚠ {errors.nama}</div>}
          </div>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>NIP</label>
            <input value={form.nip} onChange={e => { setF('nip', e.target.value.replace(/\D/g, '')); setErrors(p => ({ ...p, nip: '' })); }}
              placeholder="18 digit angka" maxLength={18} style={{ ...inpStyle('nip'), fontFamily: 'monospace' }}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = errors.nip ? C.red : C.tealXL} />
            {errors.nip && <div style={{ fontSize: FS.xs, color: C.red, marginTop: 3 }}>⚠ {errors.nip}</div>}
            {form.nip && !errors.nip && <div style={{ fontSize: FS.xs, color: form.nip.length === 18 ? C.green : C.slate, marginTop: 3 }}>{form.nip.length}/18 digit</div>}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Email *</label>
          <input value={form.email} onChange={e => { setF('email', e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            placeholder="nama@sr-malang.sch.id" style={inpStyle('email')}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = errors.email ? C.red : C.tealXL} />
          {errors.email && <div style={{ fontSize: FS.xs, color: C.red, marginTop: 3 }}>⚠ {errors.email}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>
              Tanggal Bergabung
              {!isEdit && <span style={{ fontSize: FS.xs, color: C.teal, marginLeft: 6, fontWeight: 400 }}>● Otomatis</span>}
            </label>
            <input value={form.bergabung} onChange={e => setF('bergabung', e.target.value)}
              placeholder="Contoh: Juli 2025"
              style={{ ...INP_STYLE, color: !isEdit ? C.slate : C.dark }}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.tealXL} />
          </div>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Status</label>
            <select value={form.status} onChange={e => setF('status', e.target.value)} style={{ ...INP_STYLE }}>
              <option value="Aktif">✅ Aktif</option>
              <option value="Non-Aktif">⛔ Non-Aktif</option>
            </select>
          </div>
        </div>

        {/* Mapel */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 8 }}>Mapel yang Diajar *</label>
          <MultiCheckbox items={mapelList} selected={form.mapelId} onChange={handleMapelChange} idKey="id" labelKey="label" />
        </div>

        {/* Kelas per mapel */}
        {form.mapelId.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 10 }}>
              {multiMapel ? 'Kelas per Mapel' : 'Kelas yang Dipegang'}
            </label>
            {multiMapel && (
              <div style={{
                background: `${C.amber}0F`, borderRadius: 8, padding: '8px 12px',
                fontSize: FS.sm, color: C.orange, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'flex-start'
              }}>
                <span>ℹ️</span>
                <span>Guru mengajar {form.mapelId.length} mapel — pilih kelas untuk masing-masing secara terpisah.</span>
              </div>
            )}
            {form.mapelId.map(mid => {
              const m = mapelList.find(x => x.id === mid);
              if (!m) return null;
              return (
                <div key={mid} style={{
                  marginBottom: 12, background: C.white,
                  borderRadius: 10, padding: '10px 12px', border: `1.5px solid ${m.color}22`
                }}>
                  <div style={{ fontSize: FS.sm, fontWeight: 700, color: m.color, marginBottom: 8 }}>
                    {m.icon} {m.label}
                  </div>
                  <MultiCheckbox
                    items={kelasList.map(k => ({ id: k.id, label: k.nama.replace('Kelas ', '') }))}
                    selected={form.mapelKelasMap[mid] || []}
                    onChange={v => handleMapelKelasChange(mid, v)}
                    idKey="id" labelKey="label"
                  />
                </div>
              );
            })}
          </div>
        )}

        {!isEdit && (
          <div style={{ border: '1px solid #F6AD55', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: FS.xs, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>🔑 Password Sementara</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ fontSize: FS.lg, fontFamily: 'monospace', fontWeight: 800, color: '#92400E', letterSpacing: 1.5, flex: 1 }}>{form._tempPassword}</code>
              <button onClick={() => setF('_tempPassword', genTempPasswordGuru())}
                title="Generate ulang"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: FS.xl, color: '#B7791F', padding: '0 4px' }}>↻</button>
            </div>
            <div style={{ fontSize: FS.xs, color: '#B7791F', marginTop: 4 }}>Catat sebelum simpan — guru pakai ini untuk login pertama</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1, fontSize: FS.md, justifyContent: 'center' }}>Batal</Btn>
          <Btn variant="amber" onClick={handleSave} disabled={!form.nama || !form.email}
            style={{ flex: 2, fontSize: FS.md, justifyContent: 'center' }}>
            {isEdit ? '💾 Simpan Perubahan' : '✅ Tambah Guru'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ── PageGuru ─────────────────────────────────────────────────────── */
const PageGuru = ({ guruList, mapelList, kelasList, getMapel, getKelas, setSelectedGuru, setModalData, setModal, saveBulkGuru, onDeleteGuru }) => {
  const emptyGuru = {
    nama: '', nip: '', email: '',
    mapelId: [], mapelKelasMap: {}, kelasId: [],
    bergabung: '', avatar: '', avatarBg: `linear-gradient(135deg,${C.teal},${C.tealL})`
  };
  const [search, setSearch] = useState('');
  const [filterMapel, setFilterMapel] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = guruList.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || g.nama.toLowerCase().includes(q)
      || g.email.toLowerCase().includes(q)
      || (g.nip || '').includes(q);
    const matchMapel = filterMapel === 'semua' || g.mapelId.includes(filterMapel);
    const matchStatus = filterStatus === 'semua' || (g.status || 'Aktif') === filterStatus;
    return matchSearch && matchMapel && matchStatus;
  });

  const counts = {
    aktif: guruList.filter(g => (g.status || 'Aktif') === 'Aktif').length,
    nonAktif: guruList.filter(g => g.status === 'Non-Aktif').length,
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-header sr-page-title-bar" style={{ background: C.white, borderBottom: `1px solid rgba(13,92,99,.08)`, padding: '16px 20px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: 19, fontWeight: 600, color: C.dark }}>👨‍🏫 Manajemen Guru</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{guruList.length} guru terdaftar</span>
            {counts.aktif > 0 && <span style={{ color: '#276749', fontWeight: 600 }}>· ✅ {counts.aktif} aktif</span>}
            {counts.nonAktif > 0 && <span style={{ color: C.red, fontWeight: 600 }}>· ⛔ {counts.nonAktif} non-aktif</span>}
          </div>
        </div>

        <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Mapel</option>
          {mapelList.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Status</option>
          <option value="Aktif">✅ Aktif</option>
          <option value="Non-Aktif">⛔ Non-Aktif</option>
        </select>

        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / email / NIP..."
            style={{ padding: '7px 10px 7px 30px', borderRadius: 99, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, width: 230, fontFamily: 'inherit', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.tealXL} />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: FS.md, color: C.slate }}>🔍</span>
        </div>

        <AddMenu
          label="Tambah Guru"
          onManual={() => { setModalData({ ...emptyGuru }); setModal('tambah-guru'); }}
          BulkComponent={<BulkUploadGuru mapelList={mapelList} kelasList={kelasList} onBulkSave={saveBulkGuru} />}
        />
      </div>

      {/* Tabel */}
      <div className="admin-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: C.teal }}>
              {['Nama Guru', 'NIP', 'Email', 'Mapel', 'Status', 'Bergabung', 'Aksi'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700,
                  color: C.white, textTransform: 'uppercase', letterSpacing: .7, whiteSpace: 'nowrap',
                  borderBottom: `1px solid rgba(13,92,99,.08)`
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id}
                style={{ borderTop: `1px solid rgba(13,92,99,.05)`, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,92,99,.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => setSelectedGuru(g.id)}>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar initials={g.avatar} bg={g.avatarBg} size={32} />
                    <div style={{ fontWeight: 600, fontSize: FS.md, color: C.dark }}>{g.nama}</div>
                  </div>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: FS.sm, color: C.darkL, fontFamily: 'monospace' }}>{g.nip || '—'}</span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: FS.md, color: C.teal }}>{g.email}</span>
                </td>
                <td style={{ padding: '11px 14px', maxWidth: 240 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {g.mapelId.map(mid => {
                      const m = getMapel(mid);
                      return m ? (
                        <span key={mid} style={{ fontSize: FS.sm, padding: '2px 7px', borderRadius: 99, background: m.color + '18', color: m.color, fontWeight: 700, display: 'inline-block' }}>
                          {m.icon} {m.label}
                        </span>
                      ) : null;
                    })}
                    {g.mapelId.length === 0 && <span style={{ fontSize: FS.sm, color: C.slate }}>—</span>}
                  </div>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{
                    fontSize: FS.sm, padding: '3px 9px', borderRadius: 99, fontWeight: 700,
                    background: g.status === 'Non-Aktif' ? '#FFF5F5' : '#F0FFF4',
                    color: g.status === 'Non-Aktif' ? '#C53030' : '#276749',
                    border: `1px solid ${g.status === 'Non-Aktif' ? '#FEB2B2' : '#9AE6B4'}`
                  }}>
                    {g.status === 'Non-Aktif' ? '⛔ Non-Aktif' : '✅ Aktif'}
                  </span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ fontSize: FS.sm, color: C.slate }}>{g.bergabung || '—'}</span>
                </td>
                <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setModalData({ ...g }); setModal('edit-guru'); }}
                      title="Edit"
                      style={{ background: C.white, border: `1px solid ${C.tealXL}`, borderRadius: 6, padding: '4px 9px', fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                    <button onClick={() => setDeleteTarget(g)}
                      title="Hapus"
                      style={{ background: C.white, border: `1px solid ${C.tealXL}`, borderRadius: 6, padding: '4px 9px', fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState
            icon={guruList.length === 0 ? '👨‍🏫' : '🔍'}
            title={guruList.length === 0 ? 'Belum ada guru terdaftar' : 'Tidak ada guru ditemukan'}
            sub={guruList.length === 0 ? "Klik '+ Tambah Guru' untuk mendaftarkan guru pertama" : 'Coba ubah kata kunci atau filter pencarian'}
          />
        )}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Hapus Guru?"
          message={<>Data <b>{deleteTarget.nama}</b> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</>}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { onDeleteGuru?.(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
};

export default PageGuru;
