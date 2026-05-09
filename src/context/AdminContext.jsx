/**
 * SR MVP — Admin Context — Fase 3 rev3
 *
 * FIX A: Initial fetch pakai Array.isArray() — handler kembalikan array, bukan { items: [] }
 * FIX B: Semua mutasi (save/delete) punya fallback local-state jika API gagal (MSW belum aktif)
 * FIX C: saveBulkGuru/saveBulkSiswa exposed dari context — panggil guruApi.bulk / siswaApi.bulk
 * FIX D: SR hanya satu sekolah — sekolah_id tidak dikirim ke endpoint manapun (dihapus dari semua payload)
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { guruApi, siswaApi, kelasApi, mapelApi, elemenApi } from '../api/admin';

const AdminContext = createContext(null);

const normalizeStatus = (s) => {
  if (!s) return 'Aktif';
  if (s === 'Non-Aktif' || s === 'Nonaktif') return 'Nonaktif';
  if (s === 'Belum Aktif') return 'Belum Aktif';
  return 'Aktif';
};

// normalizeSiswa: remaps form camelCase fields → snake_case sebelum dikirim ke API.
// Form UI masih boleh pakai camelCase (kelasId, dll.) tapi payload ke BE harus snake_case.
const normalizeSiswa = (s) => {
  const n = { ...s, status: normalizeStatus(s.status) };
  // Remap camelCase form fields ke snake_case jika perlu
  if (n.kelasId !== undefined && n.kelas_id === undefined) { n.kelas_id = n.kelasId; delete n.kelasId; }
  if (n.lastLogin !== undefined && n.last_login === undefined) { n.last_login = n.lastLogin; delete n.lastLogin; }
  return n;
};

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
        // v3.get unwrap envelope otomatis — terima array langsung
        if (Array.isArray(guru)) setGuruList(guru);
        if (Array.isArray(siswa)) setSiswaList(siswa.map(normalizeSiswa));
        if (Array.isArray(kelas)) setKelasList(kelas);
        if (Array.isArray(mapel)) setMapelList(mapel);
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
    // Remap form camelCase → snake_case sebelum dikirim ke API
    const normalizeGuru = (g) => {
      const n = { ...g };
      if (n.mapelId !== undefined) { n.mapel_ids = n.mapelId; delete n.mapelId; }
      if (n.kelasId !== undefined) { n.kelas_ids = Array.isArray(n.kelasId) ? n.kelasId : [n.kelasId].filter(Boolean); delete n.kelasId; }
      if (n.kelasIds !== undefined) { n.kelas_ids = n.kelasIds; delete n.kelasIds; }
      if (n.mapelKelasMap !== undefined) { n.mapel_kelas_map = n.mapelKelasMap; delete n.mapelKelasMap; }
      // Strip camelCase UI-only fields yang tidak boleh ikut ke API
      delete n.avatarBg;
      delete n.bergabung;
      delete n._tempPassword;
      return n;
    };
    const normalized = normalizeGuru(data);
    if (normalized.id) {
      // V3.1 PATCH: kirim nama, nip, email, mapel_kelas_map, status (admin boleh ubah status guru)
      // Strip: id, avatar (upload terpisah), kelas_ids/mapel_ids (computed dari mapel_kelas_map)
      // eslint-disable-next-line no-unused-vars
      const { id: _id, avatar: _av, kelas_ids: _ki, mapel_ids: _mi,
        bergabung: _bg, _tempPassword: _tp, avatarBg: _abg,
        ...guruPatchBody } = normalized;
      try {
        const updated = await guruApi.update(normalized.id, guruPatchBody);
        setGuruList(p => p.map(g => {
          if (g.id !== normalized.id) return g;
          // eslint-disable-next-line no-unused-vars
          const { mapelId, mapelKelasMap, kelasId, kelasIds, ...rest } = g;
          // Merge: state lama -> updated BE -> normalized (form paling akurat).
          // normalized menang agar mapel_kelas_map/mapel_ids/kelas_ids/status dari form tidak
          // tertimpa oleh data lama atau data BE yang mungkin tidak lengkap.
          return { ...rest, ...updated, ...normalized };
        }));
      } catch {
        setGuruList(p => p.map(g => {
          if (g.id !== normalized.id) return g;
          // eslint-disable-next-line no-unused-vars
          const { mapelId, mapelKelasMap, kelasId, kelasIds, ...rest } = g;
          return { ...rest, ...normalized };
        }));
      }
    } else {
      try {
        const created = await guruApi.create({ ...normalized });
        setGuruList(p => [...p, created]);
      } catch {
        // FIX B: fallback — generate id lokal agar UI tetap responsif
        const localG = {
          ...normalized,
          id: 'g_local_' + Date.now(),
          avatar: normalized.avatar || (normalized.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        };
        setGuruList(p => [...p, localG]);
      }
    }
  }), [withLoading]);

  const deleteGuru = useCallback((id) => withLoading(async () => {
    try { await guruApi.delete(id); } catch { /* FIX B: tetap hapus dari local state */ }
    setGuruList(p => p.filter(g => g.id !== id));
    setKelasList(p => p.map(k => k.wali_kelas_id === id ? { ...k, wali_kelas_id: '' } : k));
  }), [withLoading]);

  // FIX 13: saveBulkGuru — BulkUploadGuru sudah parse file ke array object di sisi client.
  // guruApi.bulk(file) hanya untuk raw File upload — tidak relevan di flow ini.
  // Gunakan Promise.all agar semua create berjalan paralel, bukan sequential.
  const saveBulkGuru = useCallback((guruArr) => withLoading(async () => {
    const settled = await Promise.allSettled(
      guruArr.map(guru => guruApi.create(guru))
    );
    const results = settled.map((res, i) =>
      res.status === 'fulfilled'
        ? res.value
        : { ...guruArr[i], id: 'g_local_' + Date.now() + '_' + i } // fallback lokal jika satu item gagal
    );
    setGuruList(p => [...p, ...results]);
    return results;
  }), [withLoading]);

  /* ── SISWA ─────────────────────────────────────────────── */
  const saveSiswa = useCallback((data) => withLoading(async () => {
    const normalised = normalizeSiswa(data);
    if (normalised.id) {
      // V3.1 PATCH: kirim editable field — nama, nis, email, kelas_id, status
      // status boleh dikirim — admin bisa set Aktif/Nonaktif
      // is_first_login, bergabung, last_login = server-managed, tidak boleh dikirim
      // eslint-disable-next-line no-unused-vars
      const { id: _id, avatar: _av, is_first_login: _ifl, bergabung: _bg, last_login: _ll,
        _tempPassword: _tp, ...siswaPatchBody } = normalised;
      try {
        const updated = await siswaApi.update(normalised.id, siswaPatchBody);
        setSiswaList(p => p.map(s => s.id === normalised.id ? { ...s, ...normalizeSiswa(updated) } : s));
      } catch {
        setSiswaList(p => p.map(s => s.id === normalised.id ? { ...s, ...normalised } : s));
      }
    } else {
      try {
        const created = await siswaApi.create({ ...normalised });
        const newS = normalizeSiswa(created);
        setSiswaList(p => [...p, newS]);
        if (newS.kelas_id) {
          const kid = newS.kelas_id;
          setKelasList(p => p.map(k =>
            k.id === kid ? { ...k, siswa_ids: [...(k.siswa_ids || []), newS.id] } : k
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
        if (localS.kelas_id) {
          setKelasList(p => p.map(k =>
            k.id === localS.kelas_id ? { ...k, siswa_ids: [...(k.siswa_ids || []), localS.id] } : k
          ));
        }
      }
    }
  }), [withLoading]);

  const deleteSiswa = useCallback((id) => withLoading(async () => {
    const s = siswaList.find(x => x.id === id);
    try { await siswaApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setSiswaList(p => p.filter(x => x.id !== id));
    if (s?.kelas_id) {
      const kid = s.kelas_id;
      setKelasList(p => p.map(k =>
        k.id === kid ? { ...k, siswa_ids: (k.siswa_ids || []).filter(sid => sid !== id) } : k
      ));
    }
  }), [withLoading, siswaList]);

  // FIX 13: saveBulkSiswa — sama dengan saveBulkGuru: Promise.all untuk parallelisme
  const saveBulkSiswa = useCallback((siswaArr) => withLoading(async () => {
    const settled = await Promise.allSettled(
      siswaArr.map(siswa => siswaApi.create(normalizeSiswa(siswa)))
    );
    const results = settled.map((res, i) => {
      if (res.status === 'fulfilled') return normalizeSiswa(res.value);
      // Fallback lokal jika satu item gagal
      return normalizeSiswa({
        ...siswaArr[i],
        id: 's_local_' + Date.now() + '_' + i,
        avatar: (siswaArr[i].nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        status: 'Belum Aktif',
        is_first_login: true,
      });
    });
    setSiswaList(p => [...p, ...results]);
    // Update kelasList untuk setiap siswa yang punya kelas_id
    results.forEach(s => {
      if (s.kelas_id) {
        setKelasList(p => p.map(k =>
          k.id === s.kelas_id ? { ...k, siswa_ids: [...(k.siswa_ids || []), s.id] } : k
        ));
      }
    });
    return results;
  }), [withLoading]);

  /* ── KELAS ─────────────────────────────────────────────── */
  const saveKelas = useCallback((data) => withLoading(async () => {
    // Remap form camelCase → snake_case sebelum dikirim ke API
    const normalizeKelas = (k) => {
      const n = { ...k };
      // Remap camelCase UI fields → snake_case contract
      if (n.waliKelasId !== undefined) { n.wali_kelas_id = n.waliKelasId; delete n.waliKelasId; }
      if (n.siswaIds !== undefined) { n.siswa_ids = n.siswaIds; delete n.siswaIds; }
      if (n.tahunAjaran !== undefined) { n.tahun_ajaran = n.tahunAjaran; delete n.tahunAjaran; }
      if (n.mapelGuruMap !== undefined) { delete n.mapelGuruMap; } // computed — tidak dikirim ke PATCH
      if (n.jumlahSiswa !== undefined) { delete n.jumlahSiswa; }   // computed
      if (n.mapel_ids !== undefined) { delete n.mapel_ids; }        // dikelola via /kelas/:id/mapel
      return n;
    };
    const normalized = normalizeKelas(data);
    if (normalized.id) {
      // V3.1 PATCH: hanya field editable — nama, wali_kelas_id, tahun_ajaran
      // eslint-disable-next-line no-unused-vars
      const { id: _id, jumlah_siswa: _js, siswa_ids: _si, mapel_guru_map: _mgm,
        tingkat: _tk, mapel_ids: _mi, mapelGuruMap: _mgm2,
        jumlahSiswa: _jss, _tempPassword: _tp, ...kelasPatchBody } = normalized;
      try {
        const updated = await kelasApi.update(normalized.id, kelasPatchBody);
        setKelasList(p => p.map(k => k.id === normalized.id ? { ...k, ...updated } : k));
      } catch {
        setKelasList(p => p.map(k => k.id === normalized.id ? { ...k, ...normalized } : k));
      }
    } else {
      try {
        const created = await kelasApi.create({ ...normalized });
        setKelasList(p => [...p, { siswa_ids: [], ...created }]);
      } catch {
        setKelasList(p => [...p, { ...normalized, id: 'k_local_' + Date.now(), siswa_ids: [] }]);
      }
    }
  }), [withLoading]);

  const deleteKelas = useCallback((id) => withLoading(async () => {
    try { await kelasApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setKelasList(p => p.filter(k => k.id !== id));
    setSiswaList(p => p.map(s => s.kelas_id === id ? { ...s, kelas_id: '' } : s));
  }), [withLoading]);

  /* ── MAPEL ─────────────────────────────────────────────── */
  const saveMapel = useCallback((data) => withLoading(async () => {
    if (data.id) {
      // V3.1 PATCH /admin/mapel/:id — strip readonly: id, tingkat, elemen array, jenjang
      // Contract: body hanya { label?, icon?, fase?, deskripsi_cp? }
      // eslint-disable-next-line no-unused-vars
      const { id: _id, tingkat: _tk, jenjang: _jn, elemen: elemenEdit = [], jumlah_elemen: _je, ...mapelPatchBody } = data;
      try {
        const updated = await mapelApi.update(data.id, mapelPatchBody);
        const mapelId = data.id;
        // Selalu fetch elemen terbaru dari API, lalu POST hanya yang belum ada
        const existingElemen = await elemenApi.list(mapelId).catch(() => []);
        const existingLabels = new Set((existingElemen || []).map(e => e.label));
        const newElemen = elemenEdit.filter(el => !existingLabels.has(el.label || el));
        let finalElemen = existingElemen || [];
        if (newElemen.length > 0) {
          const createdResults = await Promise.allSettled(
            newElemen.map(el => elemenApi.create({ mapel_id: mapelId, label: el.label || el }))
          );
          const createdOk = createdResults.filter(r => r.status === 'fulfilled').map(r => r.value);
          finalElemen = [...finalElemen, ...createdOk];
        }
        setMapelList(p => p.map(m =>
          m.id === mapelId
            // Merge: state lama -> updated BE -> mapelPatchBody (form paling akurat)
            // -> elemen final. mapelPatchBody menang agar fase/deskripsi_cp dari form tidak hilang.
            ? { ...m, ...updated, ...mapelPatchBody, elemen: finalElemen, jumlah_elemen: finalElemen.length }
            : m
        ));
      } catch {
        // Fallback lokal: pakai data form langsung agar UI tetap responsif
        setMapelList(p => p.map(m => m.id === data.id
          ? { ...m, ...mapelPatchBody, elemen: elemenEdit, jumlah_elemen: elemenEdit.length }
          : m
        ));
      }
    } else {
      // POST /admin/mapel — kirim id, label, icon, tingkat, fase, deskripsi_cp
      // elemen dikirim terpisah via elemenApi setelah mapel berhasil dibuat
      const slugBase = (data.label || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 12);
      const newId = slugBase + '_' + Date.now().toString().slice(-4);
      // eslint-disable-next-line no-unused-vars
      const { elemen: elemenToCreate = [], jenjang: _jn, ...mapelFields } = data;
      const payload = { ...mapelFields, id: newId };
      try {
        const created = await mapelApi.create(payload);
        const createdId = created?.id || newId;
        setMapelList(p => [...p, { ...created, elemen: [], jumlah_elemen: 0 }]);
        // V3.1: POST elemen satu per satu ke /admin/mapel/:id/elemen setelah mapel berhasil dibuat
        if (elemenToCreate.length > 0) {
          const createdElemen = await Promise.allSettled(
            elemenToCreate.map(el => elemenApi.create({ mapel_id: createdId, label: el.label || el }))
          );
          const successElemen = createdElemen
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
          setMapelList(p => p.map(m =>
            m.id === createdId
              ? { ...m, elemen: successElemen, jumlah_elemen: successElemen.length }
              : m
          ));
        }
      } catch {
        setMapelList(p => [...p, { ...payload, elemen: elemenToCreate, jumlah_elemen: elemenToCreate.length }]);
      }
    }
  }), [withLoading]);

  const deleteMapel = useCallback((id) => withLoading(async () => {
    try { await mapelApi.delete(id); } catch { /* FIX B: tetap hapus local */ }
    setMapelList(p => p.filter(x => x.id !== id));
    setGuruList(p => p.map(g => ({ ...g, mapel_ids: (g.mapel_ids || []).filter(mid => mid !== id) })));
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