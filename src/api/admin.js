/**
 * SR MVP — Admin API
 * Tim 6 | src/api/admin.js
 *
 * Semua endpoint manajemen data untuk portal admin & guru.
 * Backend: Tim 6 BE.
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  Kelas  : GET    /admin/kelas
 *            GET    /admin/kelas/:id
 *            GET    /admin/kelas/:id/siswa
 *            POST   /admin/kelas
 *            PUT    /admin/kelas/:id
 *            DELETE /admin/kelas/:id
 *
 *  Guru   : GET    /admin/guru
 *            GET    /admin/guru/:id
 *            POST   /admin/guru
 *            PUT    /admin/guru/:id
 *            DELETE /admin/guru/:id
 *            POST   /admin/guru/bulk
 *
 *  Siswa  : GET    /admin/siswa
 *            GET    /admin/siswa/:id
 *            POST   /admin/siswa
 *            PUT    /admin/siswa/:id
 *            DELETE /admin/siswa/:id
 *            POST   /admin/siswa/bulk
 *
 *  Mapel  : GET    /admin/mapel
 *            POST   /admin/mapel
 *            PUT    /admin/mapel/:id
 *            DELETE /admin/mapel/:id
 *
 *  Nilai  : POST   /admin/nilai/upload
 *
 *  Rekomendasi Guru:
 *            POST   /admin/rekomendasi
 *            GET    /admin/rekomendasi
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Semua endpoint butuh Bearer token.
 *  role: admin       → semua endpoint
 *  role: guru        → nilai/upload, rekomendasi
 *  role: siswa       → (tidak ada akses ke /admin/*)
 *
 * ── Field Conventions ────────────────────────────────────────────────
 *  - NIP guru: string 18 digit (bukan number — hindari overflow JS)
 *  - mapel_kelas_map: Record<mapel_id, kelas_id[]> — assignment guru multi-mapel/kelas
 *  - siswaIds / wali_kelas_id: mengacu ke id dari entitas lain (relasi)
 */

import { apiClient } from "./client";

// ════════════════════════════════════════════════════════════════════
// KELAS
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Kelas
 * @property {string}      id
 * @property {string}      nama
 * @property {"X"|"XI"|"XII"} tingkat
 * @property {string}      tahun_ajaran       - Format: "2025/2026"
 * @property {number}      jumlah_siswa
 * @property {string|null} wali_kelas_id      - id guru, null jika belum ada
 * @property {string[]}    siswa_ids          - daftar id siswa di kelas ini
 * @property {string}      sekolah_id
 */

export const kelasApi = {
  /**
   * GET /admin/kelas
   * Ambil semua kelas. Filter opsional via params.
   *
   * @param {{ sekolah_id?: string, tingkat?: string }} [params]
   * @returns {Promise<Kelas[]>}
   */
  list: (params) => apiClient.get("/admin/kelas", { params }).then((r) => r.data),

  /**
   * GET /admin/kelas/:id
   * Ambil detail satu kelas termasuk siswa_ids dan wali_kelas_id.
   *
   * @param {string} id
   * @returns {Promise<Kelas>}
   */
  get: (id) => apiClient.get(`/admin/kelas/${id}`).then((r) => r.data),

  /**
   * GET /admin/kelas/:id/siswa
   * Ambil daftar siswa yang terdaftar di kelas ini.
   *
   * @param {string} id
   * @returns {Promise<Array<{ id: string, nama: string, nis: string, email: string, status: string }>>}
   */
  siswa: (id) => apiClient.get(`/admin/kelas/${id}/siswa`).then((r) => r.data),

  /**
   * POST /admin/kelas
   * Buat kelas baru.
   *
   * Success 201 → Kelas (dengan id yang di-generate server)
   *
   * @param {{
   *   nama: string,
   *   tingkat: "X"|"XI"|"XII",
   *   tahun_ajaran: string,
   *   sekolah_id: string,
   *   wali_kelas_id?: string|null
   * }} payload
   * @returns {Promise<Kelas>}
   */
  create: (payload) => apiClient.post("/admin/kelas", payload).then((r) => r.data),

  /**
   * PUT /admin/kelas/:id
   * Update data kelas. Partial update (hanya field yang dikirim).
   *
   * @param {string} id
   * @param {{ nama?: string, wali_kelas_id?: string|null, tahun_ajaran?: string }} payload
   * @returns {Promise<Kelas>}
   */
  update: (id, payload) => apiClient.put(`/admin/kelas/${id}`, payload).then((r) => r.data),

  /**
   * DELETE /admin/kelas/:id
   * Hapus kelas. Relasi siswa ke kelas ini akan dilepas (kelas_id siswa → null).
   *
   * Success 200 → { deleted: boolean }
   *
   * @param {string} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  delete: (id) => apiClient.delete(`/admin/kelas/${id}`).then((r) => r.data),
};

// ════════════════════════════════════════════════════════════════════
// GURU
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Guru
 * @property {string}   id
 * @property {string}   nama
 * @property {string}   nip              - 18 digit, tipe string
 * @property {string}   email
 * @property {string}   sekolah_id
 * @property {string[]} mapel_ids        - mapel yang diajar
 * @property {string[]} kelas_ids        - kelas yang diajar
 * @property {Record<string, string[]>} mapel_kelas_map
 *   Pemetaan { mapel_id: [kelas_id, ...] } — guru bisa ajar mapel berbeda di kelas berbeda
 */

export const guruApi = {
  /**
   * GET /admin/guru
   * Ambil semua guru. Filter opsional.
   *
   * @param {{ sekolah_id?: string }} [params]
   * @returns {Promise<Guru[]>}
   */
  list: (params) => apiClient.get("/admin/guru", { params }).then((r) => r.data),

  /**
   * GET /admin/guru/:id
   * Ambil detail satu guru termasuk mapel_kelas_map lengkap.
   *
   * @param {string} id
   * @returns {Promise<Guru>}
   */
  get: (id) => apiClient.get(`/admin/guru/${id}`).then((r) => r.data),

  /**
   * POST /admin/guru
   * Tambah guru baru. Password awal dikirim via email oleh backend.
   *
   * Success 201 → Guru (dengan id yang di-generate server)
   * Error   409 → email / NIP sudah terdaftar
   *
   * @param {{
   *   nama: string,
   *   nip: string,
   *   email: string,
   *   sekolah_id: string,
   *   mapel_kelas_map: Record<string, string[]>
   * }} payload
   * @returns {Promise<Guru>}
   */
  create: (payload) => apiClient.post("/admin/guru", payload).then((r) => r.data),

  /**
   * PUT /admin/guru/:id
   * Update data guru. mapel_kelas_map bersifat replace penuh (bukan patch per-mapel).
   *
   * @param {string} id
   * @param {{
   *   nama?: string,
   *   email?: string,
   *   nip?: string,
   *   mapel_kelas_map?: Record<string, string[]>
   * }} payload
   * @returns {Promise<Guru>}
   */
  update: (id, payload) => apiClient.put(`/admin/guru/${id}`, payload).then((r) => r.data),

  /**
   * DELETE /admin/guru/:id
   * Hapus guru. Otomatis melepas relasi wali kelas dari semua kelas.
   *
   * Success 200 → { deleted: boolean }
   *
   * @param {string} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  delete: (id) => apiClient.delete(`/admin/guru/${id}`).then((r) => r.data),

  /**
   * POST /admin/guru/bulk
   * Upload data guru massal via CSV/XLSX.
   * Dipakai BulkUploadGuru.jsx.
   * Multipart/form-data.
   *
   * Success 200 → {
   *   total: number,
   *   berhasil: number,
   *   gagal: number,
   *   errors: Array<{ row: number, pesan: string }>
   * }
   *
   * @param {File} file  - CSV atau XLSX
   * @param {function(number):void} [onProgress]
   * @returns {Promise<object>}
   */
  bulk: (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post("/admin/guru/bulk", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then((r) => r.data);
  },
};

// ════════════════════════════════════════════════════════════════════
// SISWA
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Siswa
 * @property {string}                           id
 * @property {string}                           nama
 * @property {string}                           nis
 * @property {string}                           email
 * @property {string}                           kelas_id
 * @property {string}                           sekolah_id
 * @property {"Aktif"|"Belum Aktif"|"Nonaktif"} status
 * @property {boolean}                          is_first_login
 * @property {string|null}                      bergabung    - ISO8601 date
 * @property {string|null}                      last_login   - ISO8601 datetime
 */

export const siswaApi = {
  /**
   * GET /admin/siswa
   * Ambil semua siswa. Filter opsional.
   *
   * @param {{ kelas_id?: string, sekolah_id?: string, status?: string }} [params]
   * @returns {Promise<Siswa[]>}
   */
  list: (params) => apiClient.get("/admin/siswa", { params }).then((r) => r.data),

  /**
   * GET /admin/siswa/:id
   * Ambil detail satu siswa termasuk bergabung & last_login.
   *
   * @param {string} id
   * @returns {Promise<Siswa>}
   */
  get: (id) => apiClient.get(`/admin/siswa/${id}`).then((r) => r.data),

  /**
   * POST /admin/siswa
   * Tambah siswa baru (satu per satu).
   * Backend generate password sementara + kirim ke email siswa.
   *
   * Success 201 → Siswa (status: "Belum Aktif", is_first_login: true)
   * Error   409 → NIS / email sudah terdaftar
   *
   * @param {{
   *   nama: string,
   *   nis: string,
   *   email: string,
   *   kelas_id: string,
   *   sekolah_id: string
   * }} payload
   * @returns {Promise<Siswa>}
   */
  create: (payload) => apiClient.post("/admin/siswa", payload).then((r) => r.data),

  /**
   * PUT /admin/siswa/:id
   * Update data siswa. Jika kelas_id berubah, relasi kelas lama dilepas otomatis.
   *
   * @param {string} id
   * @param {{ nama?: string, nis?: string, email?: string, kelas_id?: string, status?: string }} payload
   * @returns {Promise<Siswa>}
   */
  update: (id, payload) => apiClient.put(`/admin/siswa/${id}`, payload).then((r) => r.data),

  /**
   * DELETE /admin/siswa/:id
   * Hapus siswa. Otomatis melepas relasi dari kelas.
   *
   * Success 200 → { deleted: boolean }
   *
   * @param {string} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  delete: (id) => apiClient.delete(`/admin/siswa/${id}`).then((r) => r.data),

  /**
   * POST /admin/siswa/bulk
   * Upload data siswa massal via CSV/XLSX.
   * Dipakai BulkUploadSiswa.jsx.
   * Multipart/form-data.
   *
   * Success 200 → {
   *   total: number,
   *   berhasil: number,
   *   gagal: number,
   *   errors: Array<{ row: number, pesan: string }>
   * }
   *
   * @param {File} file  - CSV atau XLSX
   * @param {string} kelas_id  - Semua siswa di file akan masuk ke kelas ini
   * @param {function(number):void} [onProgress]
   * @returns {Promise<object>}
   */
  bulk: (file, kelas_id, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kelas_id", kelas_id);
    return apiClient.post("/admin/siswa/bulk", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then((r) => r.data);
  },
};

// ════════════════════════════════════════════════════════════════════
// MAPEL (Mata Pelajaran)
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Mapel
 * @property {string} id     - slug unik, misal "mat", "bio", "fis"
 * @property {string} label  - nama tampilan, misal "Matematika"
 * @property {string} icon   - emoji, misal "📐"
 * @property {string} color  - hex color, misal "#2D9CDB"
 */

export const mapelApi = {
  /**
   * GET /admin/mapel
   * Ambil semua mata pelajaran yang terdaftar.
   *
   * @returns {Promise<Mapel[]>}
   */
  list: () => apiClient.get("/admin/mapel").then((r) => r.data),

  /**
   * POST /admin/mapel
   * Tambah mata pelajaran baru.
   *
   * Success 201 → Mapel
   * Error   409 → id sudah dipakai
   *
   * @param {{ id: string, label: string, icon?: string, color?: string }} payload
   * @returns {Promise<Mapel>}
   */
  create: (payload) => apiClient.post("/admin/mapel", payload).then((r) => r.data),

  /**
   * PUT /admin/mapel/:id
   * Update mata pelajaran. id tidak bisa diubah.
   *
   * @param {string} id
   * @param {{ label?: string, icon?: string, color?: string }} payload
   * @returns {Promise<Mapel>}
   */
  update: (id, payload) => apiClient.put(`/admin/mapel/${id}`, payload).then((r) => r.data),

  /**
   * DELETE /admin/mapel/:id
   * Hapus mata pelajaran. Relasi guru ke mapel ini dilepas otomatis.
   * PERHATIAN: ini akan menghilangkan konten belajar yang terkait.
   *
   * Success 200 → { deleted: boolean }
   *
   * @param {string} id
   * @returns {Promise<{ deleted: boolean }>}
   */
  delete: (id) => apiClient.delete(`/admin/mapel/${id}`).then((r) => r.data),
};

// ════════════════════════════════════════════════════════════════════
// NILAI (Upload bulk dari guru)
// ════════════════════════════════════════════════════════════════════

/**
 * POST /admin/nilai/upload
 * Upload nilai siswa massal via CSV/XLSX.
 * Diizinkan untuk role: admin dan guru.
 * Multipart/form-data.
 *
 * Success 200 → {
 *   doc_id: string,
 *   filename: string,
 *   rows_parsed: number,
 *   rows_valid: number,
 *   rows_error: number,
 *   status: "processed"|"processing"|"failed",
 *   processed_at: string
 * }
 * Error   403 → role tidak diizinkan
 *
 * @param {{ file: File, kelas_id: string, mapel_id: string }} payload
 * @param {function(number):void} [onProgress]  - upload progress 0-100
 * @returns {Promise<object>}
 */
export async function uploadNilai(payload, onProgress) {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("kelas_id", payload.kelas_id);
  form.append("mapel_id", payload.mapel_id);

  const { data } = await apiClient.post("/admin/nilai/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

// ════════════════════════════════════════════════════════════════════
// REKOMENDASI GURU → SISWA
// ════════════════════════════════════════════════════════════════════

/**
 * POST /admin/rekomendasi
 * Guru kirim rekomendasi/catatan ke siswa tertentu.
 * Muncul sebagai notifikasi di dashboard siswa (bell icon).
 * Dipakai dari MonitoringSection (modal "Beri Rekomendasi").
 *
 * Success 201 → { id: string, created_at: string }
 *
 * @param {{
 *   guru_id: string,
 *   siswa_id: string,
 *   mapel_id: string,
 *   pesan: string
 * }} payload
 * @returns {Promise<{ id: string, created_at: string }>}
 */
export async function kirimRekomendasi(payload) {
  const { data } = await apiClient.post("/admin/rekomendasi", payload);
  return data;
}

/**
 * GET /admin/rekomendasi
 * Ambil semua rekomendasi yang diterima siswa (notifikasi bell).
 * Dipakai DashboardSection siswa — NOTIFIKASI_GURU_INIT akan digantikan ini.
 *
 * Success 200 → Array<{
 *   id: string,
 *   guru_nama: string,
 *   guru_mapel: string,
 *   pesan: string,
 *   dibaca: boolean,
 *   created_at: string   - ISO8601
 * }>
 *
 * @param {{ siswa_id: string }} params
 * @returns {Promise<object[]>}
 */
export async function getRekomendasiSiswa(params) {
  const { data } = await apiClient.get("/admin/rekomendasi", { params });
  return data;
}