/** SR MVP — Admin: Manajemen Kelas + Detail Kelas — REVISED
 *
 * Perubahan:
 *  1. PageKelas: tombol hapus kelas (dengan ConfirmDeleteModal)
 *  2. PageKelasDetail: ganti window.confirm → ConfirmDeleteModal, tambah kolom status siswa
 *  3. ModalKelas: jurusan hanya di jenjang XI & XII, tahun ajaran format baku (select)
 */
import { useState } from 'react';
import { Avatar, Card, Btn, EmptyState } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { INP_STYLE, FormTambahMapel } from './adminUtils';
import { ConfirmDeleteModal } from './PageGuru';
import { StatusBadge } from './PageSiswa';
import { kelasDetailApi } from '../../../api/admin';

/* ── Konstanta ────────────────────────────────────────────────────── */
const JURUSAN_LIST = ['IPA', 'IPS', 'Bahasa', 'Teknik', 'Kejuruan'];

const generateTahunAjaran = () => {
  const thisYear = new Date().getFullYear();
  return [
    `${thisYear - 1}/${thisYear}`,
    `${thisYear}/${thisYear + 1}`,
    `${thisYear + 1}/${thisYear + 2}`,
    `${thisYear + 2}/${thisYear + 3}`,
  ];
};

/* ── ModalKelas ───────────────────────────────────────────────────── */
export const ModalKelas = ({ modalData, guruList, saveKelas, onClose }) => {
  const defaultTA = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const emptyKelas = { nama: '', tingkat: 'X', jurusan: '', waliKelasId: '', mapelGuruMap: {}, tahunAjaran: defaultTA, siswaIds: [] };
  const [form, setForm] = useState(modalData || { ...emptyKelas });
  const isEdit = !!form.id;
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Jurusan hanya untuk jenjang XI dan XII
  const showJurusan = form.tingkat === 'XI' || form.tingkat === 'XII';

  const tahunAjaranOptions = generateTahunAjaran();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16, padding: 28, width: 460, maxHeight: '88vh',
          overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,.2)'
        }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
          {isEdit ? '✏️ Edit Kelas' : '📚 Tambah Kelas Baru'}
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 18 }}>SR Kota Malang</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Nama Kelas *</label>
            <input value={form.nama} onChange={e => setF('nama', e.target.value)} placeholder="Contoh: X-1"
              style={{ ...INP_STYLE }} onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
          </div>
          <div>
            <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Tahun Ajaran</label>
            <select value={form.tahunAjaran}
              onChange={e => setF('tahunAjaran', e.target.value)}
              style={{ ...INP_STYLE }}>
              {tahunAjaranOptions.map(ta => (
                <option key={ta} value={ta}>{ta}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: showJurusan ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Tingkat</label>
            <select value={form.tingkat} onChange={e => { setF('tingkat', e.target.value); if (e.target.value === 'X') setF('jurusan', ''); }} style={{ ...INP_STYLE }}>
              {['X', 'XI', 'XII'].map(t => <option key={t} value={t}>Kelas {t}</option>)}
            </select>
          </div>
          {showJurusan && (
            <div>
              <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Jurusan</label>
              <select value={form.jurusan || ''} onChange={e => setF('jurusan', e.target.value)} style={{ ...INP_STYLE }}>
                <option value="">— Pilih Jurusan —</option>
                {JURUSAN_LIST.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          )}
        </div>

        {!showJurusan && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: `${C.teal}07`, borderRadius: 8, fontSize: FS.sm, color: C.slate }}>
            ℹ️ Penjurusan hanya berlaku untuk jenjang XI dan XII.
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, display: 'block', marginBottom: 5 }}>Wali Kelas</label>
          <select value={form.waliKelasId || ''} onChange={e => setF('waliKelasId', e.target.value)} style={{ ...INP_STYLE }}>
            <option value="">— Belum ditentukan —</option>
            {guruList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1, fontSize: FS.md, justifyContent: 'center' }}>Batal</Btn>
          <Btn variant="amber" onClick={() => saveKelas(form)} disabled={!form.nama}
            style={{ flex: 2, fontSize: FS.md, justifyContent: 'center' }}>
            {isEdit ? '💾 Simpan Perubahan' : '✅ Buat Kelas'}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ── PageKelasDetail ──────────────────────────────────────────────── */
const PageKelasDetail = ({ kelasId, kelasList, guruList, siswaList, mapelList, getKelas, getGuru, getMapel, getSiswaOfKelas, setKelasList, setSiswaList, setModalData, setModal, showToast, setSelectedKelas }) => {
  const k = getKelas(kelasId);
  const [editMapelId, setEditMapelId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  if (!k) return null;
  const wk = getGuru(k.wali_kelas_id || k.waliKelasId);
  const siswas = getSiswaOfKelas(kelasId);
  const mapelGuruMap = k.mapelGuruMap || {};

  const openConfirm = (config) => setConfirmModal(config);
  const closeConfirm = () => setConfirmModal(null);

  return (
    <div className="admin-page-scroll" style={{ padding: '20px 24px' }}>
      <button onClick={() => setSelectedKelas(null)}
        style={{
          background: C.bg, border: 'none', color: C.teal, fontWeight: 700, fontSize: FS.base,
          cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5, padding: 0
        }}>
        ← Kembali ke Daftar Kelas
      </button>

      {/* Header banner */}
      <div style={{
        background: `linear-gradient(135deg,${C.teal},${C.tealL})`, borderRadius: 16,
        padding: '20px 24px', marginBottom: 20, position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: FONTS.serif, color: C.white, fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Kelas {k.nama}</div>
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>
            Tahun Ajaran {k.tahunAjaran} · Tingkat {k.tingkat}
            {k.jurusan ? ` · Jurusan ${k.jurusan}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {[{ v: siswas.length, l: 'Siswa' }, { v: Object.keys(mapelGuruMap).length, l: 'Mapel' }].map(s => (
              <div key={s.l} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 9, padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: FS.h2, color: C.white }}>{s.v}</div>
                <div style={{ fontSize: FS.xs, color: 'rgba(255,255,255,.7)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, marginBottom: 18 }}>
        {/* Wali Kelas */}
        <Card style={{ padding: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark, marginBottom: 12 }}>👤 Wali Kelas</div>
          {wk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar initials={wk.avatar} bg={wk.avatarBg} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>{wk.nama}</div>
                <div style={{ fontSize: FS.xs, color: C.teal }}>{wk.email}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: FS.md, color: C.red, marginBottom: 10 }}>⚠ Belum ada wali kelas</div>
          )}
          {/*<label style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, display: 'block', marginBottom: 5 }}>Ganti Wali Kelas</label>
          <select defaultValue={k.wali_kelas_id || k.waliKelasId || ''}
            onChange={e => {
              setKelasList(p => p.map(kl => kl.id === kelasId ? { ...kl, waliKelasId: e.target.value } : kl));
              showToast(`✅ Wali kelas ${k.nama} → ${getGuru(e.target.value)?.nama}`);
            }}
            style={{ ...INP_STYLE }}>
            <option value="">— Pilih Guru —</option>
            {guruList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
          </select>
          */}
        </Card>

        {/* Info kelas */}
        <Card style={{ padding: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark, marginBottom: 12 }}>📋 Info Kelas</div>
          {[
            { l: 'Nama Kelas', v: k.nama },
            { l: 'Tingkat', v: `Kelas ${k.tingkat}` },
            { l: 'Jurusan', v: k.jurusan || '— (tidak ada penjurusan)' },
            { l: 'Tahun Ajaran', v: k.tahunAjaran },
          ].map(item => (
            <div key={item.l} style={{
              display: 'flex', justifyContent: 'space-between', marginBottom: 8,
              paddingBottom: 8, borderBottom: `1px solid rgba(13,92,99,.06)`
            }}>
              <span style={{ fontSize: FS.sm, color: C.slate }}>{item.l}</span>
              <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark }}>{item.v}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Guru per Mapel */}
      <Card style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid rgba(13,92,99,.08)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>📚 Pengaturan Guru per Mapel</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
              {Object.keys(mapelGuruMap).length} mapel ditetapkan
            </div>
          </div>
          <button onClick={() => setEditMapelId('__add__')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none',
              borderRadius: 8, color: C.white, fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
            }}>
            + Tambah Mapel
          </button>
        </div>

        {editMapelId === '__add__' && (
          <FormTambahMapel k={k} kelasId={kelasId} mapelList={mapelList} guruList={guruList}
            getMapel={getMapel} getGuru={getGuru} setKelasList={setKelasList} showToast={showToast}
            onDone={() => setEditMapelId(null)} />
        )}

        <div style={{ padding: '8px 0' }}>
          {Object.keys(mapelGuruMap).length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: FS.md, color: C.slate }}>
              Belum ada mapel. Klik "+ Tambah Mapel" untuk memulai.
            </div>
          )}
          {Object.entries(mapelGuruMap).map(([mapelId, guruId]) => {
            const mapel = getMapel(mapelId);
            const assignedGuru = getGuru(guruId);
            const eligible = guruList.filter(g => (g.mapel_ids || g.mapelId || []).includes(mapelId));
            const isEditing = editMapelId === mapelId;
            if (!mapel) return null;
            return (
              <div key={mapelId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px', borderBottom: `1px solid rgba(13,92,99,.05)`
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: C.teal + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xl, flexShrink: 0
                }}>
                  {mapel.icon}
                </div>
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>{mapel.label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select defaultValue={guruId || ''}
                        onChange={async e => {
                          const newGuruId = e.target.value;
                          try {
                            await kelasDetailApi.updateGuruMapel(kelasId, mapelId, { guru_id: newGuruId });
                          } catch { /* Fallback: tetap update local state */ }
                          setKelasList(p => p.map(kl => kl.id === kelasId
                            ? { ...kl, mapelGuruMap: { ...kl.mapelGuruMap, [mapelId]: newGuruId } } : kl));
                          showToast(`✅ ${mapel.label} → ${getGuru(newGuruId)?.nama || '(kosong)'}`);
                          setEditMapelId(null);
                        }}
                        style={{ ...INP_STYLE, flex: 1, padding: '6px 10px', fontSize: 12 }}>
                        <option value="">— Tidak ada guru —</option>
                        {eligible.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                      </select>
                      <button onClick={() => setEditMapelId(null)}
                        style={{ background: 'none', border: 'none', color: C.slate, cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {assignedGuru ? (
                        <><Avatar initials={assignedGuru.avatar} bg={assignedGuru.avatarBg} size={24} />
                          <span style={{ fontSize: FS.md, color: C.dark }}>{assignedGuru.nama}</span></>
                      ) : <span style={{ fontSize: FS.sm, color: C.slate, fontStyle: 'italic' }}>Belum ada guru</span>}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => setEditMapelId(mapelId)}
                      style={{ background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none', borderRadius: 7, padding: '5px 9px', fontSize: FS.sm, color: C.white, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {assignedGuru ? 'Ganti' : 'Tetapkan'}
                    </button>
                    <button onClick={() => openConfirm({
                      title: 'Hapus Mapel dari Kelas?',
                      message: <><b>{mapel.label}</b> akan dihapus dari <b>{k.nama}</b>.</>,
                      onConfirm: async () => {
                        try {
                          await kelasDetailApi.removeMapel(kelasId, mapelId);
                        } catch { /* Fallback: tetap update local state */ }
                        setKelasList(p => p.map(kl => {
                          if (kl.id !== kelasId) return kl;
                          const newMap = { ...kl.mapelGuruMap }; delete newMap[mapelId];
                          return { ...kl, mapelGuruMap: newMap };
                        }));
                        showToast(`🗑 ${mapel.label} dihapus dari ${k.nama}`, C.red);
                        closeConfirm();
                      }
                    })}
                      style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 7, padding: '5px 9px', fontSize: FS.sm, color: C.red, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Daftar Siswa */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid rgba(13,92,99,.08)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>🎒 Daftar Siswa</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 1 }}>{siswas.length} siswa di kelas ini</div>
          </div>
          <Btn variant="soft" size="sm" onClick={() => { setModalData({ nama: '', nis: '', email: '', kelasId: kelasId, status: 'Aktif' }); setModal('tambah-siswa'); }}
            style={{ background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none', borderRadius: 7, padding: '5px 9px', fontSize: FS.sm, color: C.white, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Tambah Siswa
          </Btn>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.teal }}>
                {['Nama', 'NIS', 'Email', 'Status', 'Aksi'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700,
                    color: C.white, textTransform: 'uppercase', letterSpacing: .7, whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siswas.map(s => (
                <tr key={s.id} style={{ borderTop: `1px solid rgba(13,92,99,.05)` }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(13,92,99,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Avatar initials={s.avatar} bg={s.avatarBg} size={26} />
                      <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark }}>{s.nama}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 14px' }}><span style={{ fontSize: FS.sm, fontFamily: 'monospace', color: C.darkL }}>{s.nis}</span></td>
                  <td style={{ padding: '9px 14px' }}><span style={{ fontSize: FS.sm, color: C.teal }}>{s.email || '—'}</span></td>
                  <td style={{ padding: '9px 14px' }}>
                    <StatusBadge status={s.status} size="sm" />
                  </td>
                  <td style={{ padding: '9px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setModalData({ ...s }); setModal('edit-siswa'); }}
                        style={{ background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: FS.xs, color: C.white, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                      <button onClick={() => openConfirm({
                        title: 'Hapus Siswa dari Kelas?',
                        message: <><b>{s.nama}</b> akan dihapus dari kelas ini.</>,
                        onConfirm: async () => {
                          try {
                            await kelasDetailApi.removeSiswa(kelasId, s.id);
                          } catch { /* Fallback: tetap update local state */ }
                          setSiswaList(p => p.filter(x => x.id !== s.id));
                          setKelasList(p => p.map(kl => kl.id === kelasId ? { ...kl, siswaIds: (kl.siswaIds || []).filter(id => id !== s.id), siswa_ids: (kl.siswa_ids || []).filter(id => id !== s.id) } : kl));
                          showToast(`🗑 ${s.nama} dihapus`, C.red);
                          closeConfirm();
                        }
                      })}
                        style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 6, padding: '3px 8px', fontSize: FS.xs, color: C.red, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {siswas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', fontSize: FS.md, color: C.slate }}>Belum ada siswa di kelas ini</div>
          )}
        </div>
      </Card>

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmDeleteModal
          title={confirmModal.title}
          message={confirmModal.message}
          onClose={closeConfirm}
          onConfirm={confirmModal.onConfirm}
        />
      )}
    </div>
  );
};

/* ── PageKelas (daftar) ───────────────────────────────────────────── */
const JENJANG_LIST = [
  { id: 'X', label: 'Kelas X' },
  { id: 'XI', label: 'Kelas XI' },
  { id: 'XII', label: 'Kelas XII' },
];

const PageKelas = ({ kelasList, guruList, siswaList, mapelList, getKelas, getGuru, getMapel, getSiswaOfKelas, setKelasList, setSiswaList, selectedKelas, setSelectedKelas, setModalData, setModal, showToast, saveKelas, onDeleteKelas }) => {
  const [selectedJenjang, setSelectedJenjang] = useState('X');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const defaultTA = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const emptyKelas = { nama: '', tingkat: 'X', jurusan: '', waliKelasId: '', mapelGuruMap: {}, tahunAjaran: defaultTA, siswaIds: [] };

  if (selectedKelas) return (
    <PageKelasDetail kelasId={selectedKelas} kelasList={kelasList} guruList={guruList}
      siswaList={siswaList} mapelList={mapelList} getKelas={getKelas} getGuru={getGuru}
      getMapel={getMapel} getSiswaOfKelas={getSiswaOfKelas} setKelasList={setKelasList}
      setSiswaList={setSiswaList} setModalData={setModalData} setModal={setModal}
      showToast={showToast} setSelectedKelas={setSelectedKelas} />
  );

  const kelasJenjang = kelasList.filter(k => (k.tingkat || 'X') === selectedJenjang);

  return (
    <div className="admin-page-scroll" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 19, fontWeight: 600, color: C.dark }}>📚 Manajemen Kelas</div>
          <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{kelasList.length} kelas terdaftar</div>
        </div>
        <Btn variant="primary" onClick={() => { setModalData({ ...emptyKelas, tingkat: selectedJenjang }); setModal('tambah-kelas'); }}
          style={{ fontSize: 12 }}>+ Tambah Kelas</Btn>
      </div>

      {/* Filter Jenjang */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Jenjang</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {JENJANG_LIST.map(j => {
            const count = kelasList.filter(k => (k.tingkat || 'X') === j.id).length;
            return (
              <button key={j.id} onClick={() => setSelectedJenjang(j.id)}
                style={{
                  padding: '8px 18px', borderRadius: 99, fontFamily: 'inherit',
                  fontSize: FS.base, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  border: selectedJenjang === j.id ? `2px solid ${C.teal}` : `1.5px solid ${C.tealXL}`,
                  background: selectedJenjang === j.id ? `${C.teal}12` : C.white,
                  color: selectedJenjang === j.id ? C.teal : C.darkL
                }}>
                {j.label}
                {count > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: FS.xs, padding: '1px 6px', borderRadius: 99,
                    background: selectedJenjang === j.id ? C.teal : C.tealXL,
                    color: selectedJenjang === j.id ? C.white : C.teal
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, marginBottom: 14 }}>
          Daftar Kelas — Kelas {selectedJenjang}
          <span style={{ fontSize: FS.sm, fontWeight: 400, color: C.slate, marginLeft: 8 }}>{kelasJenjang.length} kelas</span>
        </div>
      </div>

      {selectedJenjang !== 'X' && kelasJenjang.length === 0 ? (
        <div style={{ background: C.bg, border: `1.5px dashed ${C.tealXL}`, borderRadius: 14, padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12, opacity: .3 }}>🏫</div>
          <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Kelas {selectedJenjang} Belum Tersedia</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {kelasJenjang.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState icon="📚" title="Belum ada kelas terdaftar" sub="Klik '+ Tambah Kelas' untuk membuat kelas pertama" />
            </div>
          ) : kelasJenjang.map(k => {
            const wk = getGuru(k.wali_kelas_id || k.waliKelasId);
            const siswas = getSiswaOfKelas(k.id);
            const mapelGuruMap = k.mapelGuruMap || {};
            const mapelCount = Object.keys(mapelGuruMap).length;
            const alerts = [];
            if (!k.wali_kelas_id && !k.waliKelasId) alerts.push('Belum ada wali kelas');
            if (mapelCount < 3) alerts.push('Mapel belum lengkap');
            return (
              <Card key={k.id} style={{ overflow: 'hidden', cursor: 'pointer', transition: 'transform .2s,box-shadow .2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(13,92,99,.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(26,35,50,.07)'; }}>
                <div style={{ height: 4, background: C.teal }} />
                <div style={{ padding: '16px' }}>
                  {alerts.length > 0 && (
                    <div style={{ background: '#FEFCE8', borderRadius: 7, padding: '5px 10px', fontSize: FS.xs, color: C.orange, fontWeight: 600, marginBottom: 10 }}>
                      ⚠ {alerts.join(' · ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 600, color: C.dark }}>Kelas {k.nama}</div>
                      <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
                        TA {k.tahunAjaran}
                        {k.jurusan ? ` · ${k.jurusan}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); setModalData({ ...k }); setModal('edit-kelas'); }}
                        style={{ width: 28, height: 28, background: C.white, border: `1px solid ${C.tealXL}`, borderRadius: 7, fontSize: FS.base, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.teal, transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.tealXL}
                        onMouseLeave={e => e.currentTarget.style.background = C.white}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(k); }}
                        style={{ width: 28, height: 28, background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 7, fontSize: FS.base, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red, transition: 'all .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FED7D7'}
                        onMouseLeave={e => e.currentTarget.style.background = '#FFF5F5'}>🗑</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: C.white, borderRadius: 8, border: `1.5px solid ${C.tealXL}`, padding: '9px 10px' }}>
                      <div style={{ fontSize: FS.h2, fontWeight: 800, color: C.dark }}>{siswas.length}</div>
                      <div style={{ fontSize: FS.sm, color: C.slate }}>Total Siswa</div>
                    </div>
                    <div style={{ background: C.white, borderRadius: 8, border: `1.5px solid ${C.tealXL}`, padding: '9px 10px' }}>
                      <div style={{ fontSize: FS.h2, fontWeight: 800, color: C.dark }}>{mapelCount}</div>
                      <div style={{ fontSize: FS.sm, color: C.slate }}>Mapel Terisi</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: FS.sm, color: C.slate, marginBottom: 4 }}>Wali Kelas</div>
                    {wk ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar initials={wk.avatar} bg={wk.avatarBg} size={24} />
                        <span style={{ fontSize: FS.md, color: C.dark, fontWeight: 600 }}>{wk.nama}</span>
                      </div>
                    ) : <span style={{ fontSize: FS.sm, color: C.red }}>⚠ Belum ditentukan</span>}
                  </div>
                  <Btn variant="primary" size="sm" onClick={() => setSelectedKelas(k.id)} style={{ width: '100%', justifyContent: 'center' }}>
                    Kelola Kelas
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title="Hapus Kelas?"
          message={<>Kelas <b>{deleteTarget.nama}</b> akan dihapus permanen. Data siswa tidak akan terhapus, namun akan kehilangan referensi kelas ini.</>}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            onDeleteKelas?.(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default PageKelas;
