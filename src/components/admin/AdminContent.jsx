/**
 * SR MVP — AdminContent (Portal Admin) — REVISED
 *
 * Perubahan:
 *  - Wire up deleteGuru, deleteSiswa, deleteKelas dari AdminContext
 *  - Pass onDeleteGuru ke PageGuru & GuruDrawer
 *  - Pass onDeleteSiswa ke PageSiswa & SiswaDrawer
 *  - Pass onDeleteKelas ke PageKelas
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { C, FONTS, FS } from '../../styles/tokens';

import PageGuru, { GuruDrawer, ModalGuru } from './sections/PageGuru';
import PageSiswa, { SiswaDrawer, ModalSiswa } from './sections/PageSiswa';
import PageKelas, { ModalKelas } from './sections/PageKelas';
import PageKurikulum from './sections/KurikulumSection';

const AdminContent = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    guruList, siswaList, kelasList, mapelList,
    setKelasList, setGuruList, setSiswaList, setMapelList,
    saveGuru, deleteGuru,
    saveSiswa, deleteSiswa,
    saveKelas, deleteKelas,
  } = useAdmin();

  /* ── Navigation ───────────────────────────────────────────────── */
  const [activePage, setActivePage] = useState('kurikulum');
  const [selectedGuru, setSelectedGuru] = useState(null);
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [selectedKelas, setSelectedKelas] = useState(null);
  const [modal, setModal] = useState(null);
  const [modalData, setModalData] = useState(null);
  const [toast, setToast] = useState(null);

  /* ── Toast ────────────────────────────────────────────────────── */
  const showToast = (msg, color = C.green) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3200);
  };

  /* ── Helpers ──────────────────────────────────────────────────── */
  const getKelas = (id) => kelasList.find(k => k.id === id);
  const getGuru = (id) => guruList.find(g => g.id === id);
  const getMapel = (id) => mapelList.find(m => m.id === id);
  const getSiswaOfKelas = (kelasId) => siswaList.filter(s => s.kelasId === kelasId);

  /* ── Save wrappers ─────────────────────────────────────────────── */
  const handleSaveGuru = async (data) => {
    await saveGuru(data);
    showToast(data.id ? `✅ Data ${data.nama} diperbarui` : `✅ Guru ${data.nama} ditambahkan`);
    setModal(null);
  };

  const handleDeleteGuru = async (id) => {
    const g = guruList.find(x => x.id === id);
    await deleteGuru(id);
    showToast(`🗑 Guru ${g?.nama || ''} dihapus`, C.red);
  };

  const handleSaveSiswa = async (data) => {
    await saveSiswa(data);
    showToast(data.id ? `✅ Data ${data.nama} diperbarui` : `✅ Siswa ${data.nama} ditambahkan`);
    setModal(null);
  };

  const handleDeleteSiswa = async (id) => {
    const s = siswaList.find(x => x.id === id);
    await deleteSiswa(id);
    showToast(`🗑 Siswa ${s?.nama || ''} dihapus`, C.red);
  };

  const handleSaveKelas = async (data) => {
    await saveKelas(data);
    showToast(data.id ? `✅ Kelas ${data.nama} diperbarui` : `✅ Kelas ${data.nama} dibuat`);
    setModal(null);
  };

  const handleDeleteKelas = async (id) => {
    const k = kelasList.find(x => x.id === id);
    await deleteKelas(id);
    showToast(`🗑 Kelas ${k?.nama || ''} dihapus`, C.red);
  };

  const saveBulkGuru = async (guruArr) => {
    for (const guru of guruArr) await saveGuru(guru);
    showToast(`✅ ${guruArr.length} guru berhasil ditambahkan`, C.teal);
  };

  const saveBulkSiswa = async (siswaArr) => {
    for (const siswa of siswaArr) await saveSiswa(siswa);
    showToast(`✅ ${siswaArr.length} siswa berhasil ditambahkan`, C.teal);
  };

  const handleChangeStatusSiswa = async (siswa, newStatus) => {
    await saveSiswa({ ...siswa, status: newStatus });
    const icon = newStatus === 'Aktif' ? '✅' : newStatus === 'Nonaktif' ? '🚫' : '⏳';
    showToast(`${icon} ${siswa.nama} → ${newStatus}`);
  };

  const handleResetPassword = async (siswa, type) => {
    if (type === 'temp') {
      await saveSiswa({ ...siswa, status: 'Belum Aktif' });
      showToast(`🔄 Password sementara ${siswa.nama} dikonfirmasi`, C.teal);
    } else {
      await saveSiswa({ ...siswa, is_first_login: true });
      showToast(`🔑 Password ${siswa.nama} direset. Siswa harus buat password baru.`, C.teal);
    }
  };

  const navItems = [
    { id: 'kurikulum', icon: '📋', label: 'Kurikulum' },
    { id: 'guru', icon: '👨‍🏫', label: 'Manajemen Guru' },
    { id: 'siswa', icon: '🎒', label: 'Manajemen Siswa' },
    { id: 'kelas', icon: '📚', label: 'Manajemen Kelas' },
  ];

  return (
    <div className="admin-view" style={{ background: C.bg }}>

      {/* ── Sidebar ── */}
      <div className="admin-sidebar" style={{ background: C.dark }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 22 }}>🏫</span>
            <div>
              <div style={{ color: C.white, fontWeight: 700, fontSize: FS.base }}>Sekolah Rakyat</div>
              <div style={{ color: 'rgba(255,255,255,.35)', fontSize: FS.xs }}>Portal Admin</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.amber},${C.orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dark, fontWeight: 800, fontSize: FS.lg, flexShrink: 0 }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.white, fontWeight: 700, fontSize: FS.md }}>Admin</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: FS.xs, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SR Kota Malang</div>
              <div style={{ color: C.amber, fontSize: FS.xs, fontWeight: 700 }}>🔑 Administrator</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
          {navItems.map(item => (
            <button key={item.id}
              onClick={() => { setActivePage(item.id); if (item.id !== 'kelas') setSelectedKelas(null); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', background: activePage === item.id ? 'rgba(13,92,99,.5)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2, transition: 'all .15s' }}
              onMouseEnter={e => { if (activePage !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,.06)'; }}
              onMouseLeave={e => { if (activePage !== item.id) e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: FS.md, fontWeight: activePage === item.id ? 700 : 400, color: activePage === item.id ? C.white : 'rgba(255,255,255,.55)', flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.id === 'siswa' && siswaList.filter(s => s.status === 'Belum Aktif').length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#F6AD55', color: C.dark, fontSize: FS.xs, fontWeight: 800, borderRadius: 99, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                  {siswaList.filter(s => s.status === 'Belum Aktif').length}
                </span>
              )}
              {activePage === item.id && <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.amber, flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
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

      {/* ── Main Content ──────────────────────────────────────────── */}
      <div className="admin-main">
        {activePage === 'kurikulum' && (
          <PageKurikulum
            mapelList={mapelList}
            kelasList={kelasList}
            guruList={guruList}
            setMapelList={setMapelList}
            setGuruList={setGuruList}
            showToast={showToast}
          />
        )}

        {activePage === 'guru' && (
          <PageGuru
            guruList={guruList}
            kelasList={kelasList}
            mapelList={mapelList}
            getKelas={getKelas}
            getMapel={getMapel}
            getGuru={getGuru}
            getSiswaOfKelas={getSiswaOfKelas}
            setSelectedGuru={setSelectedGuru}
            setModalData={setModalData}
            setModal={setModal}
            saveBulkGuru={saveBulkGuru}
            onDeleteGuru={handleDeleteGuru}
          />
        )}

        {activePage === 'siswa' && (
          <PageSiswa
            siswaList={siswaList}
            kelasList={kelasList}
            getKelas={getKelas}
            setSelectedSiswa={setSelectedSiswa}
            setModalData={setModalData}
            setModal={setModal}
            saveBulkSiswa={saveBulkSiswa}
            onChangeStatus={handleChangeStatusSiswa}
            onResetPassword={handleResetPassword}
            onDeleteSiswa={handleDeleteSiswa}
          />
        )}

        {activePage === 'kelas' && (
          <PageKelas
            kelasList={kelasList}
            siswaList={siswaList}
            guruList={guruList}
            mapelList={mapelList}
            getKelas={getKelas}
            getGuru={getGuru}
            getMapel={getMapel}
            getSiswaOfKelas={getSiswaOfKelas}
            setKelasList={setKelasList}
            setSiswaList={setSiswaList}
            selectedKelas={selectedKelas}
            setSelectedKelas={setSelectedKelas}
            setModalData={setModalData}
            setModal={setModal}
            showToast={showToast}
            saveKelas={handleSaveKelas}
            onDeleteKelas={handleDeleteKelas}
          />
        )}
      </div>

      {/* ── Drawers ───────────────────────────────────────────────── */}
      {selectedGuru && (
        <GuruDrawer
          guruId={selectedGuru}
          guruList={guruList}
          kelasList={kelasList}
          mapelList={mapelList}
          getKelas={getKelas}
          getMapel={getMapel}
          setSelectedGuru={setSelectedGuru}
          setModalData={setModalData}
          setModal={setModal}
          onDeleteGuru={handleDeleteGuru}
        />
      )}

      {selectedSiswa && (
        <SiswaDrawer
          siswaId={selectedSiswa}
          siswaList={siswaList}
          kelasList={kelasList}
          getKelas={getKelas}
          setSelectedSiswa={setSelectedSiswa}
          setModalData={setModalData}
          setModal={setModal}
          onChangeStatus={handleChangeStatusSiswa}
          onResetPassword={handleResetPassword}
          onDeleteSiswa={handleDeleteSiswa}
        />
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}
      {(modal === 'tambah-siswa' || modal === 'edit-siswa') && (
        <ModalSiswa
          modalData={modal === 'edit-siswa' ? modalData : null}
          kelasList={kelasList}
          saveSiswa={handleSaveSiswa}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'tambah-guru' || modal === 'edit-guru') && (
        <ModalGuru
          modalData={modal === 'edit-guru' ? modalData : null}
          kelasList={kelasList}
          mapelList={mapelList}
          saveGuru={handleSaveGuru}
          onClose={() => setModal(null)}
        />
      )}

      {(modal === 'tambah-kelas' || modal === 'edit-kelas') && (
        <ModalKelas
          modalData={modal === 'edit-kelas' ? modalData : null}
          guruList={guruList}
          saveKelas={handleSaveKelas}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className="bounce-in" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: toast.color, color: C.white,
          padding: '12px 20px', borderRadius: 12, fontSize: FS.base, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)', maxWidth: 340,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AdminContent;
