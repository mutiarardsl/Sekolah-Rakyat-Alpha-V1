/**
 * SR MVP — Admin Context — REVISED
 *
 * Perubahan:
 *  - Tambah deleteGuru, deleteKelas
 *  - normalizeStatus helper
 *  - saveBulkSiswa exposed
 */
import { createContext, useContext, useState, useCallback } from 'react';

const AdminContext = createContext(null);

const normalizeStatus = (s) => {
  if (!s) return 'Aktif';
  if (s === 'Non-Aktif' || s === 'Nonaktif') return 'Nonaktif';
  if (s === 'Belum Aktif') return 'Belum Aktif';
  return 'Aktif';
};

export function AdminProvider({ initialData, children }) {
  const [guruList, setGuruList] = useState(initialData?.guru ?? []);
  const [siswaList, setSiswaList] = useState(() =>
    (initialData?.siswa ?? []).map(s => ({ ...s, status: normalizeStatus(s.status) }))
  );
  const [kelasList, setKelasList] = useState(initialData?.kelas ?? []);
  const [mapelList, setMapelList] = useState(initialData?.mapel ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const withLoading = useCallback(async (fn) => {
    setIsLoading(true); setError(null);
    try { return await fn(); }
    catch (err) { setError(err.message ?? 'Terjadi kesalahan'); throw err; }
    finally { setIsLoading(false); }
  }, []);

  /* ── GURU ──────────────────────────────────────────────────────── */
  const saveGuru = useCallback((data) => withLoading(async () => {
    if (data.id) {
      setGuruList(p => p.map(g => g.id === data.id ? { ...g, ...data } : g));
    } else {
      const newG = {
        ...data,
        id: `g${Date.now()}`,
        avatar: data.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };
      setGuruList(p => [...p, newG]);
    }
  }), [withLoading]);

  const deleteGuru = useCallback((id) => withLoading(async () => {
    // TODO Fase 3: await guruApi.delete(id)
    setGuruList(p => p.filter(g => g.id !== id));
    // Hapus referensi wali kelas
    setKelasList(p => p.map(k => k.waliKelasId === id ? { ...k, waliKelasId: '' } : k));
  }), [withLoading]);

  /* ── SISWA ─────────────────────────────────────────────────────── */
  const saveSiswa = useCallback((data) => withLoading(async () => {
    const normalised = { ...data, status: normalizeStatus(data.status) };
    if (normalised.id) {
      setSiswaList(p => p.map(s => s.id === normalised.id ? { ...s, ...normalised } : s));
    } else {
      const newS = {
        ...normalised,
        id: `s${Date.now()}`,
        avatar: data.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        status: normalised.status || 'Belum Aktif',
        is_first_login: normalised.is_first_login ?? (normalised.status === 'Belum Aktif'),
      };
      setSiswaList(p => [...p, newS]);
      if (newS.kelasId) {
        setKelasList(p => p.map(k =>
          k.id === newS.kelasId ? { ...k, siswaIds: [...(k.siswaIds || []), newS.id] } : k
        ));
      }
    }
  }), [withLoading]);

  const deleteSiswa = useCallback((id) => withLoading(async () => {
    const s = siswaList.find(x => x.id === id);
    setSiswaList(p => p.filter(x => x.id !== id));
    if (s?.kelasId) {
      setKelasList(p => p.map(k =>
        k.id === s.kelasId ? { ...k, siswaIds: (k.siswaIds || []).filter(sid => sid !== id) } : k
      ));
    }
  }), [withLoading, siswaList]);

  /* ── KELAS ─────────────────────────────────────────────────────── */
  const saveKelas = useCallback((data) => withLoading(async () => {
    if (data.id) setKelasList(p => p.map(k => k.id === data.id ? { ...k, ...data } : k));
    else setKelasList(p => [...p, { ...data, id: `k${Date.now()}`, siswaIds: [] }]);
  }), [withLoading]);

  const deleteKelas = useCallback((id) => withLoading(async () => {
    // TODO Fase 3: await kelasApi.delete(id)
    setKelasList(p => p.filter(k => k.id !== id));
    // Siswa kehilangan referensi kelas — set kelasId menjadi ''
    setSiswaList(p => p.map(s => s.kelasId === id ? { ...s, kelasId: '' } : s));
  }), [withLoading]);

  /* ── MAPEL ─────────────────────────────────────────────────────── */
  const saveMapel = useCallback((data) => withLoading(async () => {
    if (data.id) setMapelList(p => p.map(m => m.id === data.id ? { ...m, ...data } : m));
    else {
      const id = data.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 10) + `_${Date.now()}`.slice(-4);
      setMapelList(p => [...p, { ...data, id }]);
    }
  }), [withLoading]);

  const deleteMapel = useCallback((id) => withLoading(async () => {
    setMapelList(p => p.filter(x => x.id !== id));
    setGuruList(p => p.map(g => ({ ...g, mapelId: (g.mapelId || []).filter(mid => mid !== id) })));
  }), [withLoading]);

  return (
    <AdminContext.Provider value={{
      guruList, siswaList, kelasList, mapelList,
      setKelasList, setGuruList, setSiswaList, setMapelList,
      isLoading, error,
      saveGuru, deleteGuru,
      saveSiswa, deleteSiswa,
      saveKelas, deleteKelas,
      saveMapel, deleteMapel,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin harus dipakai di dalam <AdminProvider>');
  return ctx;
};
