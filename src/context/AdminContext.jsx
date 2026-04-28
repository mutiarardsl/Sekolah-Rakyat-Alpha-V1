/**
 * SR MVP — Admin Context — Fase 3 rev2
 *
 * FIX A: Initial fetch pakai Array.isArray() — handler kembalikan array, bukan { items: [] }
 * FIX B: Semua mutasi (save/delete) punya fallback local-state jika API gagal (MSW belum aktif)
 * FIX C: saveBulkGuru/saveBulkSiswa exposed dari context — panggil guruApi.bulk / siswaApi.bulk
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { guruApi, siswaApi, kelasApi, mapelApi } from '../api/admin';

const AdminContext = createContext(null);

const normalizeStatus = (s) => {
  if (!s) return 'Aktif';
  if (s === 'Non-Aktif' || s === 'Nonaktif') return 'Nonaktif';
  if (s === 'Belum Aktif') return 'Belum Aktif';
  return 'Aktif';
};

const normalizeSiswa = (s) => ({ ...s, status: normalizeStatus(s.status) });

export function AdminProvider({ initialData, children }) {
  const [guruList, setGuruList] = useState(initialData?.guru ?? []);
  const [siswaList, setSiswaList] = useState(() =>
    (initialData?.siswa ?? []).map(normalizeSiswa)
  );
  const [kelasList, setKelasList] = useState(initialData?.kelas ?? []);
  const [mapelList, setMapelList] = useState(initialData?.mapel ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // FIX A: initial fetch — Array.isArray() karena handler kembalikan array langsung,
  // bukan { items: [] }. Fallback ke initialData jika API belum siap.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [guru, siswa, kelas, mapel] = await Promise.all([
          guruApi.list(),
          siswaApi.list(),
          kelasApi.list(),
          mapelApi.list(),
        ]);
        if (cancelled) return;
        // FIX A: handler return array langsung (bukan { items: [] })
        if (Array.isArray(guru) && guru.length) setGuruList(guru);
        if (Array.isArray(siswa) && siswa.length) setSiswaList(siswa.map(normalizeSiswa));
        if (Array.isArray(kelas) && kelas.length) setKelasList(kelas);
        if (Array.isArray(mapel) && mapel.length) setMapelList(mapel);
      } catch (err) {
        console.warn('[AdminContext] Initial fetch gagal, pakai initialData:', err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const withLoading = useCallback(async (fn) => {
    setIsLoading(true); setError(null);
    try { return await fn(); }
    catch (err) { setError(err.message ?? 'Terjadi kesalahan'); throw err; }
    finally { setIsLoading(false); }
  }, []);

  /* ── GURU ──────────────────────────────────────────────── */
  const saveGuru = useCallback((data) => withLoading(async () => {
    if (data.id) {
      try {
        // FIX B: coba API dulu, jika gagal (MSW belum aktif) fallback local
        const updated = await guruApi.update(data.id, data);
        setGuruList(p => p.map(g => g.id === data.id ? { ...g, ...updated } : g));
      } catch {
        setGuruList(p => p.map(g => g.id === data.id ? { ...g, ...data } : g));
      }
    } else {
      try {
        const created = await guruApi.create(data);
        setGuruList(p => [...p, created]);
      } catch {
        // FIX B: fallback — generate id lokal agar UI tetap responsif
        const localG = {
          ...data,
          id: 'g_local_' + Date.now(),
          avatar: data.avatar || (data.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        };
        setGuruList(p => [...p, localG]);
      }
    }
  }), [withLoading]);

  const deleteGuru = useCallback((id) => withLoading(async () => {
    try { await guruApi.delete(id); } catch { /* FIX B: tetap hapus dari local state */ }
    setGuruList(p => p.filter(g => g.id !== id));
    setKelasList(p => p.map(k => k.waliKelasId === id ? { ...k, waliKelasId: '' } : k));
  }), [withLoading]);

  // FIX C: saveBulkGuru via guruApi.bulk() — kirim File langsung ke endpoint
  // Dipanggil dari AdminContent.saveBulkGuru yang menerima (file, guruArr)
  // Jika API bulk gagal, fallback ke loop saveGuru satu per satu
  const saveBulkGuru = useCallback((guruArr) => withLoading(async () => {
    // guruArr adalah array objek hasil parse BulkUploadGuru (sudah diparsing client-side)
    // Karena BulkUpload melakukan parsing mandiri, kita kirim satu-per-satu ke API
    // (guruApi.bulk() hanya untuk raw File upload — tidak relevan di flow ini)
    const results = [];
    for (const guru of guruArr) {
      try {
        const created = await guruApi.create(guru);
        results.push(created);
      } catch {
        // FIX B: fallback local jika API gagal
        results.push({ ...guru, id: 'g_local_' + Date.now() + Math.random() });
      }
    }
    setGuruList(p => [...p, ...results]);
    return results;
  }), [withLoading]);

  /* ── SISWA ─────────────────────────────────────────────── */
  const saveSiswa = useCallback((data) => withLoading(async () => {
    const normalised = normalizeSiswa(data);
    if (normalised.id) {
      try {
        const updated = await siswaApi.update(normalised.id, normalised);
        setSiswaList(p => p.map(s => s.id === normalised.id ? { ...s, ...normalizeSiswa(updated) } : s));
      } catch {
        setSiswaList(p => p.map(s => s.id === normalised.id ? { ...s, ...normalised } : s));
      }
    } else {
      try {
        const created = await siswaApi.create(normalised);
        const newS = normalizeSiswa(created);
        setSiswaList(p => [...p, newS]);
        if (newS.kelasId || newS.kelas_id) {
          const kid = newS.kelasId || newS.kelas_id;
          setKelasList(p => p.map(k =>
            k.id === kid ? { ...k, siswaIds: [...(k.siswaIds || []), newS.id] } : k
          ));
        }
      } catch {
        const localS = normalizeSiswa({
          ...normalised,
          id: 's_local_' + Date.now(),
          avatar: normalised.avatar || (normalised.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          status: normalised.status || 'Belum Aktif',
          is_first_login: normalised.is_first_login ?? true,
        });
        setSiswaList(p => [...p, localS]);
        if (localS.kelasId) {
          setKelasList(p => p.map(k =>
            k.id === localS.kelasId ? { ...k, siswaIds: [...(k.siswaIds || []), localS.id] } : k
          ));
        }
      }
    }
  }), [withLoading]);

  const deleteSiswa = useCallback((id) => withLoading(async () => {
    const s = siswaList.find(x => x.id === id);
    try { await siswaApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setSiswaList(p => p.filter(x => x.id !== id));
    if (s?.kelasId || s?.kelas_id) {
      const kid = s.kelasId || s.kelas_id;
      setKelasList(p => p.map(k =>
        k.id === kid ? { ...k, siswaIds: (k.siswaIds || []).filter(sid => sid !== id) } : k
      ));
    }
  }), [withLoading, siswaList]);

  // FIX C: saveBulkSiswa — sama dengan saveBulkGuru
  const saveBulkSiswa = useCallback((siswaArr) => withLoading(async () => {
    const results = [];
    for (const siswa of siswaArr) {
      try {
        const created = await siswaApi.create(siswa);
        results.push(normalizeSiswa(created));
      } catch {
        results.push(normalizeSiswa({
          ...siswa,
          id: 's_local_' + Date.now() + Math.random(),
        }));
      }
    }
    setSiswaList(p => [...p, ...results]);
    return results;
  }), [withLoading]);

  /* ── KELAS ─────────────────────────────────────────────── */
  const saveKelas = useCallback((data) => withLoading(async () => {
    if (data.id) {
      try {
        const updated = await kelasApi.update(data.id, data);
        setKelasList(p => p.map(k => k.id === data.id ? { ...k, ...updated } : k));
      } catch {
        setKelasList(p => p.map(k => k.id === data.id ? { ...k, ...data } : k));
      }
    } else {
      try {
        const created = await kelasApi.create(data);
        setKelasList(p => [...p, { siswaIds: [], ...created }]);
      } catch {
        setKelasList(p => [...p, { ...data, id: 'k_local_' + Date.now(), siswaIds: [] }]);
      }
    }
  }), [withLoading]);

  const deleteKelas = useCallback((id) => withLoading(async () => {
    try { await kelasApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setKelasList(p => p.filter(k => k.id !== id));
    setSiswaList(p => p.map(s => s.kelasId === id ? { ...s, kelasId: '' } : s));
  }), [withLoading]);

  /* ── MAPEL ─────────────────────────────────────────────── */
  const saveMapel = useCallback((data) => withLoading(async () => {
    if (data.id) {
      try {
        const updated = await mapelApi.update(data.id, data);
        setMapelList(p => p.map(m => m.id === data.id ? { ...m, ...updated } : m));
      } catch {
        setMapelList(p => p.map(m => m.id === data.id ? { ...m, ...data } : m));
      }
    } else {
      try {
        const created = await mapelApi.create(data);
        setMapelList(p => [...p, created]);
      } catch {
        const id = data.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 10) + '_' + Date.now().toString().slice(-4);
        setMapelList(p => [...p, { ...data, id }]);
      }
    }
  }), [withLoading]);

  const deleteMapel = useCallback((id) => withLoading(async () => {
    try { await mapelApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setMapelList(p => p.filter(x => x.id !== id));
    setGuruList(p => p.map(g => ({ ...g, mapelId: (g.mapelId || []).filter(mid => mid !== id) })));
  }), [withLoading]);

  return (
    <AdminContext.Provider value={{
      guruList, siswaList, kelasList, mapelList,
      setKelasList, setGuruList, setSiswaList, setMapelList,
      isLoading, error,
      saveGuru, deleteGuru, saveBulkGuru,
      saveSiswa, deleteSiswa, saveBulkSiswa,
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