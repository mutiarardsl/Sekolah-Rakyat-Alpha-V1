/**
 * SR MVP — Admin: Manajemen Siswa — REVISED
 *
 * Perubahan:
 *  - Tanggal bergabung otomatis saat akun dibuat
 *  - Tabel: tambahkan tombol hapus siswa
 *  - Status badge: gunakan icon emoji (bukan dot), seragam dengan PageGuru
 */
import { useState } from 'react';
import { Avatar, Btn, EmptyState } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { INP_STYLE } from './adminUtils';
import { ConfirmDeleteModal } from './PageGuru';
import BulkUploadSiswa from './BulkUploadSiswa';
import AddMenu from './AddMenu';
import { STATUS_CONFIG } from '../../../data/masterData';

const normalizeStatus = (s) => {
  if (!s) return 'Aktif';
  if (s === 'Non-Aktif' || s === 'Nonaktif') return 'Non-Aktif';
  if (s === 'Belum Aktif') return 'Belum Aktif';
  return 'Aktif';
};

const formatBergabung = () => {
  const now = new Date();
  return now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

/* ── StatusBadge ─────────────────────────────────────────────────── */
export const StatusBadge = ({ status, size = 'sm' }) => {
  const s = normalizeStatus(status);
  const cfg = STATUS_CONFIG[s];
  const p = size === 'sm' ? '3px 9px' : '4px 13px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: fs, padding: p, borderRadius: 99, fontWeight: 700, whiteSpace: 'nowrap',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

/* ── ResetPasswordModal ──────────────────────────────────────────── */
const ResetPasswordModal = ({ siswa, type, onClose, onConfirm }) => {
  const isTemp = type === 'temp';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1400, backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 16, padding: 28, width: "min(420px, calc(100vw - 24px))", boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>{isTemp ? '🔄' : '🔑'}</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 600, color: C.dark, textAlign: 'center', marginBottom: 6 }}>
          {isTemp ? 'Reset Password Sementara' : 'Reset Password Siswa'}
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, textAlign: 'center', marginBottom: 20, lineHeight: 1.8 }}>
          {isTemp ? (
            <>Password sementara untuk <b style={{ color: C.dark }}>{siswa.nama}</b> akan dikonfirmasi ulang.</>
          ) : (
            <>Password <b style={{ color: C.dark }}>{siswa.nama}</b> akan direset. Siswa harus membuat password baru saat login berikutnya.</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Batal</Btn>
          <Btn variant="primary" onClick={() => onConfirm()} style={{ flex: 2, justifyContent: 'center' }}>
            {isTemp ? '🔄 Konfirmasi Reset Temp' : '✅ Konfirmasi Reset'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ── SiswaDrawer ─────────────────────────────────────────────────── */
export const SiswaDrawer = ({ siswaId, siswaList, kelasList, getKelas, setSelectedSiswa, setModalData, setModal, onChangeStatus, onResetPassword, onDeleteSiswa }) => {
  const [drawerResetModal, setDrawerResetModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const s = siswaList.find(x => x.id === siswaId);
  if (!s) return null;
  const kelas = getKelas(s.kelas_id || s.kelasId);
  const status = normalizeStatus(s.status);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.4)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 998, backdropFilter: 'blur(2px)' }}
        onClick={() => setSelectedSiswa(null)}>
        <div className="slide-right" onClick={e => e.stopPropagation()}
          style={{ width: 'min(380px, 92vw)', height: '100vh', background: C.white, overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Avatar initials={s.avatar} bg={s.avatarBg} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: FS.xl, color: C.dark }}>{s.nama}</div>
              <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{s.email || '—'}</div>
              {kelas && (
                <span style={{ marginTop: 6, display: 'inline-block', fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontWeight: 700 }}>
                  {kelas.nama.replace('Kelas ', '')}
                </span>
              )}
            </div>
            <button onClick={() => setSelectedSiswa(null)} style={{ background: C.cream, border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>

            {/* Status hint */}
            {status === 'Belum Aktif' && (
              <div style={{ background: '#FFF8EE', border: '1px solid #F6AD55', borderRadius: 10, padding: '10px 14px', fontSize: FS.sm, color: '#744210', marginBottom: 14, lineHeight: 1.7 }}>
                ⏳ Siswa belum melakukan aktivasi akun. Bagikan password sementara berikut ke siswa.
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(246,173,85,.15)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: FS.xs, color: '#92400E' }}>Password sementara</span>
                  <code style={{ fontSize: FS.base, fontFamily: 'monospace', fontWeight: 800, color: '#92400E', letterSpacing: 2 }}>{s._tempPassword || '—'}</code>
                </div>
              </div>
            )}
            {status === 'Non-Aktif' && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 10, padding: '10px 14px', fontSize: FS.sm, color: '#C53030', marginBottom: 14, lineHeight: 1.7 }}>
                ⛔ Akun siswa ini dinonaktifkan. Siswa tidak dapat login ke sistem.
              </div>
            )}

            {/* Detail */}
            {[
              { l: 'NIS', v: s.nis },
              { l: 'Kelas', v: kelas?.nama || '—' },
              { l: 'Email', v: s.email || '—' },
              { l: 'Login Terakhir', v: s.lastLogin || '—' },
            ].map(item => (
              <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid rgba(13,92,99,.06)` }}>
                <span style={{ fontSize: FS.md, color: C.slate }}>{item.l}</span>
                <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark }}>{item.v}</span>
              </div>
            ))}

            {/* Aksi */}
            {status === 'Aktif' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>Aksi</div>
                <button onClick={() => setDrawerResetModal({ siswa: s, type: 'new' })}
                  style={{ background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none', borderRadius: 20, padding: '7px 12px', fontSize: FS.sm, fontWeight: 600, cursor: 'pointer', color: C.white, fontFamily: 'inherit' }}>
                  🔑 Reset Password
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 18px', borderTop: `1px solid rgba(13,92,99,.08)`, display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => setDeleteConfirm(true)}
              style={{
                padding: '9px 14px', background: '#FFF5F5', border: '1px solid #FEB2B2',
                borderRadius: 9, color: C.red, fontSize: FS.md, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit'
              }}>🗑</button>
            <Btn variant="soft" onClick={() => { setModalData({ ...s }); setModal('edit-siswa'); setSelectedSiswa(null); }}
              style={{ flex: 1, justifyContent: 'center', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white }}>✏️ Edit Data</Btn>
          </div>
        </div>
      </div>

      {drawerResetModal && (
        <ResetPasswordModal
          siswa={drawerResetModal.siswa}
          type={drawerResetModal.type}
          onClose={() => setDrawerResetModal(null)}
          onConfirm={() => { onResetPassword?.(drawerResetModal.siswa, drawerResetModal.type); setDrawerResetModal(null); }}
        />
      )}

      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Hapus Siswa?"
          message={<>Data <b>{s.nama}</b> akan dihapus permanen dari sistem dan dikeluarkan dari kelas. Tindakan ini tidak dapat dibatalkan.</>}
          onClose={() => setDeleteConfirm(false)}
          onConfirm={() => { onDeleteSiswa?.(s.id); setDeleteConfirm(false); setSelectedSiswa(null); }}
        />
      )}
    </>
  );
};

/* ── ModalSiswa ──────────────────────────────────────────────────── */
const genTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const ModalSiswa = ({ modalData, kelasList, saveSiswa, onClose }) => {
  const emptySiswa = { nama: '', nis: '', email: '', kelasId: '', status: 'Belum Aktif', bergabung: '' };
  const [form, setForm] = useState(() => {
    if (modalData) {
      // V3.1 FIX: API mengembalikan kelas_id (snake_case) — populate kelasId untuk dropdown
      const kelasIdFromApi = modalData.kelas_id || modalData.kelasId || '';
      return {
        ...emptySiswa,
        ...modalData,
        kelasId: kelasIdFromApi,
        kelas_id: kelasIdFromApi,
        status: normalizeStatus(modalData.status),
      };
    }
    return { ...emptySiswa, _tempPassword: genTempPassword(), bergabung: formatBergabung() };
  });
  const isEdit = !!form.id;
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 16, padding: 28, width: "min(480px, calc(100vw - 24px))", maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)' }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
          {isEdit ? '✏️ Edit Data Siswa' : '🎒 Tambah Siswa Baru'}
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 18 }}>SR Kota Malang</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Nama Lengkap *</label>
            <input value={form.nama} onChange={e => setF('nama', e.target.value)} placeholder="Nama lengkap siswa"
              style={{ ...INP_STYLE }} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
          </div>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>NIS *</label>
            <input value={form.nis} onChange={e => setF('nis', e.target.value)} placeholder="Nomor Induk Siswa"
              style={{ ...INP_STYLE }} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Email</label>
          <input value={form.email || ''} onChange={e => setF('email', e.target.value)} placeholder="nama@siswa.sr"
            style={{ ...INP_STYLE }} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Kelas *</label>
          <select value={form.kelasId} onChange={e => setF('kelasId', e.target.value)} style={{ ...INP_STYLE }}>
            <option value="">— Pilih Kelas —</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>
              Tanggal Bergabung
              {!isEdit && <span style={{ fontSize: FS.xs, color: C.teal, marginLeft: 6, fontWeight: 400 }}>● Otomatis</span>}
            </label>
            <input value={form.bergabung} onChange={e => setF('bergabung', e.target.value)} placeholder="Contoh: Juli 2025"
              style={{ ...INP_STYLE, color: !isEdit ? C.slate : C.dark }}
              onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
          </div>
          <div>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Status</label>
            <select value={form.status} onChange={e => setF('status', e.target.value)} style={{ ...INP_STYLE }}>
              <option value="Belum Aktif">⏳ Belum Aktif</option>
              <option value="Aktif">✅ Aktif</option>
              <option value="Non-Aktif">⛔ Non-Aktif</option>
            </select>
          </div>
        </div>

        {form.status === 'Belum Aktif' && !isEdit && (
          <div style={{ marginBottom: 12, padding: '7px 10px', border: '1px solid #F6AD55', borderRadius: 7 }}>
            <div style={{ fontSize: FS.xs, color: '#92400E', marginBottom: 4, fontWeight: 600 }}>Password sementara</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <code style={{ fontSize: FS.base, fontFamily: 'monospace', fontWeight: 800, color: '#92400E', letterSpacing: 1, flex: 1 }}>{form._tempPassword}</code>
              <button onClick={() => setF('_tempPassword', genTempPassword())}
                title="Buat ulang password"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#B7791F', padding: '0 4px' }}>↻</button>
            </div>
            <div style={{ fontSize: FS.xs, color: '#B7791F', marginTop: 4 }}>Catat sebelum simpan</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Batal</Btn>
          <Btn variant="amber" onClick={() => saveSiswa(form)} disabled={!form.nama || !form.nis || !form.kelasId}
            style={{ flex: 2, justifyContent: 'center', color: C.white }}>
            {isEdit ? '💾 Simpan Perubahan' : '✅ Tambah Siswa'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ── PageSiswa ───────────────────────────────────────────────────── */
const PageSiswa = ({ siswaList, kelasList, getKelas, setSelectedSiswa, setModalData, setModal, saveBulkSiswa, onChangeStatus, onResetPassword, onDeleteSiswa }) => {
  const [search, setSearch] = useState('');
  const [filterKelas, setFilterKelas] = useState('semua');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetModal, setResetModal] = useState(null);

  const emptySiswa = { nama: '', nis: '', email: '', kelasId: '', status: 'Belum Aktif', bergabung: '' };

  const filtered = siswaList.filter(s => {
    const matchSearch = !search
      || s.nama.toLowerCase().includes(search.toLowerCase())
      || s.nis.includes(search)
      || (s.email || '').toLowerCase().includes(search.toLowerCase());
    const matchKelas = filterKelas === 'semua' || (s.kelas_id || s.kelasId) === filterKelas;
    const normStatus = normalizeStatus(s.status);
    const matchStatus = filterStatus === 'semua' || normStatus === filterStatus;
    return matchSearch && matchKelas && matchStatus;
  });

  const counts = {
    belumAktif: siswaList.filter(s => normalizeStatus(s.status) === 'Belum Aktif').length,
    aktif: siswaList.filter(s => normalizeStatus(s.status) === 'Aktif').length,
    nonAktif: siswaList.filter(s => normalizeStatus(s.status) === 'Non-Aktif').length,
  };

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-header" style={{ background: C.white, borderBottom: `1px solid rgba(13,92,99,.08)`, padding: '16px 20px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: FONTS.serif, fontSize: 19, fontWeight: 600, color: C.dark }}>🎒 Manajemen Siswa</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{siswaList.length} terdaftar</span>
            {counts.belumAktif > 0 && <span style={{ color: '#B7791F', fontWeight: 600 }}>· ⏳ {counts.belumAktif} Belum Aktif</span>}
            {counts.aktif > 0 && <span style={{ color: C.teal, fontWeight: 600 }}>· ✅ {counts.aktif} Aktif</span>}
            {counts.nonAktif > 0 && <span style={{ color: C.red, fontWeight: 600 }}>· ⛔ {counts.nonAktif} Non-Aktif</span>}
          </div>
        </div>

        <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Kelas</option>
          {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, background: C.white, color: C.dark, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="semua">Semua Status</option>
          <option value="Belum Aktif">⏳ Belum Aktif</option>
          <option value="Aktif">✅ Aktif</option>
          <option value="Non-Aktif">⛔ Non-Aktif</option>
        </select>

        <div style={{ position: 'relative' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama / NIS / email..."
            style={{ padding: '7px 10px 7px 30px', borderRadius: 99, border: `1.5px solid ${C.tealXL}`, fontSize: FS.md, width: 220, fontFamily: 'inherit', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.tealXL} />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: FS.md, color: C.slate }}>🔍</span>
        </div>

        <AddMenu
          label="Tambah Siswa"
          onManual={() => { setModalData({ ...emptySiswa }); setModal('tambah-siswa'); }}
          BulkComponent={<BulkUploadSiswa kelasList={kelasList} onBulkSave={saveBulkSiswa} />}
        />
      </div>

      {/* Tabel */}
      <div className="admin-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 540 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: C.teal }}>
              {['Nama Siswa', 'NIS', 'Email', 'Kelas', 'Status', 'Bergabung', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700, color: C.white, textTransform: 'uppercase', letterSpacing: .7, whiteSpace: 'nowrap', borderBottom: `1px solid rgba(13,92,99,.08)` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const kelas = getKelas(s.kelas_id || s.kelasId);
              const status = normalizeStatus(s.status);
              return (
                <tr key={s.id}
                  style={{ borderTop: `1px solid rgba(13,92,99,.05)`, cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,92,99,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedSiswa(s.id)}>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar initials={s.avatar} bg={s.avatarBg} size={32} />
                      <div style={{ fontWeight: 600, fontSize: FS.md, color: C.dark }}>{s.nama}</div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: FS.md, color: C.darkL, fontFamily: 'monospace' }}>{s.nis}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: FS.md, color: C.teal }}>{s.email || '—'}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {kelas ? (
                      <span style={{ fontSize: FS.sm, padding: '3px 8px', borderRadius: 99, background: `linear-gradient(135deg,${C.teal},${C.tealL})`, color: C.white, fontWeight: 700 }}>
                        {kelas.nama.replace('Kelas ', '')}
                      </span>
                    ) : <span style={{ fontSize: FS.sm, color: C.slate }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <StatusBadge status={status} />
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: FS.sm, color: C.slate }}>{s.bergabung || '—'}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setModalData({ ...s }); setModal('edit-siswa'); }}
                        title="Edit"
                        style={{ background: C.white, border: `1px solid ${C.tealXL}`, borderRadius: 6, padding: '4px 8px', fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                      <button onClick={() => setDeleteTarget(s)}
                        title="Hapus"
                        style={{ background: C.white, border: `1px solid ${C.tealXL}`, borderRadius: 6, padding: '4px 8px', fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <EmptyState
            icon={siswaList.length === 0 ? '🎒' : '🔍'}
            title={siswaList.length === 0 ? 'Belum ada siswa terdaftar' : 'Tidak ada siswa ditemukan'}
            sub={siswaList.length === 0 ? "Klik '+ Tambah Siswa' untuk mendaftarkan siswa pertama" : 'Coba ubah kata kunci atau filter'}
          />
        )}
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Hapus Siswa?"
          message={<>Data <b>{deleteTarget.nama}</b> akan dihapus permanen dan dikeluarkan dari kelas. Tindakan ini tidak dapat dibatalkan.</>}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { onDeleteSiswa?.(deleteTarget.id); setDeleteTarget(null); }}
        />
      )}

      {resetModal && (
        <ResetPasswordModal
          siswa={resetModal.siswa}
          type={resetModal.type}
          onClose={() => setResetModal(null)}
          onConfirm={() => { onResetPassword?.(resetModal.siswa, resetModal.type); setResetModal(null); }}
        />
      )}
    </div>
  );
};

export default PageSiswa;