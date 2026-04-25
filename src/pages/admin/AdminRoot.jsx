/**
 * SR MVP — Admin Root — REVISI FASE 3
 * src/pages/admin/AdminRoot.jsx
 */

import { AdminProvider } from '../../context/AdminContext';
import AdminView from '../../components/admin/AdminView';
import { ADMIN_GURU_INIT, ADMIN_KELAS_INIT, ADMIN_SISWA_INIT, ADMIN_MAPEL_LIST, KURIKULUM_ELEMEN } from '../../data/masterData';

// Inject elemen ATP dari KURIKULUM_ELEMEN ke setiap mapel sebagai data awal
// (field lama 'materi' dipertahankan untuk backward-compat komponen student/teacher)
const ADMIN_MAPEL_WITH_ELEMEN = ADMIN_MAPEL_LIST.map(m => ({
  ...m,
  elemen: m.elemen?.length ? m.elemen : (KURIKULUM_ELEMEN[m.id] || []),
}));

export default function AdminRoot() {
  return (
    <AdminProvider initialData={{ guru: ADMIN_GURU_INIT, kelas: ADMIN_KELAS_INIT, siswa: ADMIN_SISWA_INIT, mapel: ADMIN_MAPEL_WITH_ELEMEN }}>
      <AdminView />
    </AdminProvider>
  );
}
