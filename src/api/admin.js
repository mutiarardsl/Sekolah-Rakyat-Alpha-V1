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
 *            PATCH      /admin/kelas/:id
 *            DELETE /admin/kelas/:id
 *
 *  Guru   : GET    /admin/guru
 *            GET    /admin/guru/:id
 *            POST   /admin/guru
 *            PATCH      /admin/guru/:id
 *            DELETE /admin/guru/:id
 *            POST   /admin/guru/bulk
 *
 *  Siswa  : GET    /admin/siswa
 *            GET    /admin/siswa/:id
 *            POST   /admin/siswa
 *            PATCH      /admin/siswa/:id
 *            DELETE /admin/siswa/:id
 *            POST   /admin/siswa/bulk
 *
 *  Mapel  : GET    /admin/mapel
 *            POST   /admin/mapel
 *            PATCH      /admin/mapel/:id
 *            DELETE /admin/mapel/:id
 *
 *  Elemen : GET    /admin/elemen?mapel_id=:id         → daftar elemen per mapel
 *            POST   /admin/elemen                      → tambah elemen ke mapel
 *            PATCH      /admin/elemen/:id                  → edit label/deskripsi elemen
 *            DELETE /admin/elemen/:id                  → hapus elemen
 *
 *  Kelas Detail (manajemen isi kelas):
 *            POST   /admin/kelas/:id/mapel             → tambah mapel + assign guru ke kelas
 *            DELETE /admin/kelas/:id/mapel/:mapel_id   → lepas mapel dari kelas
 *            PATCH      /admin/kelas/:id/mapel/:mapel_id/guru → ganti guru pengampu mapel di kelas
 *            POST   /admin/kelas/:id/siswa             → tambah siswa ke kelas (single)
 *            DELETE /admin/kelas/:id/siswa/:siswa_id   → lepas siswa dari kelas
 *
 *  Notifikasi Guru → Siswa (CONTRACT V3.6 §21):
 *            POST   /notifikasi              → guru kirim notifikasi ke siswa
 *            GET    /siswa/:id/notifikasi    → siswa ambil notifikasi yang diterima
 *            PATCH  /notifikasi/:id/baca     → tandai notifikasi dibaca
 *
 *  Guru Profile (CONTRACT V3.6 §10):
 *            GET    /guru/:id               → profil guru (kelas & mapel aktif)
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Semua endpoint butuh Bearer token.
 *  role: admin       → semua endpoint /admin/*
 *  role: guru        → /notifikasi (POST), /guru/:id (GET)
 *  role: siswa       → /siswa/:id/notifikasi (GET), tidak ada akses ke /admin/*
 *
 * ── Field Conventions ────────────────────────────────────────────────
 *  - NIP guru: string 18 digit (bukan number — hindari overflow JS)
 *  - mapel_kelas_map: Record<mapel_id, kelas_id[]> — assignment guru multi-mapel/kelas
 *  - siswaIds / wali_kelas_id: mengacu ke id dari entitas lain (relasi)
 */

import { apiClient } from "./client.js";
import { v3 } from "../http/requestV3.js";
import { unwrapEnvelope } from "../http/envelope.js";

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
 */

export const kelasApi = {
  list: (params) => v3.get("/admin/kelas", { params }),

  get: (id) => v3.get(`/admin/kelas/${id}`),

  siswa: (id) => v3.get(`/admin/kelas/${id}/siswa`),

  create: (payload) => v3.post("/admin/kelas", payload),

  update: (id, payload) => v3.patch(`/admin/kelas/${id}`, payload),

  delete: (id) => v3.delete(`/admin/kelas/${id}`),
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
 * @property {string[]} mapel_ids        - mapel yang diajar
 * @property {string[]} kelas_ids        - kelas yang diajar
 * @property {Record<string, string[]>} mapel_kelas_map
 *   Pemetaan { mapel_id: [kelas_id, ...] } — guru bisa ajar mapel berbeda di kelas berbeda
 */

export const guruApi = {
  list: (params) => v3.get("/admin/guru", { params }),

  get: (id) => v3.get(`/admin/guru/${id}`),

  create: (payload) => v3.post("/admin/guru", payload),

  update: (id, payload) => v3.patch(`/admin/guru/${id}`, payload),

  delete: (id) => v3.delete(`/admin/guru/${id}`),

  bulk: (file, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post("/admin/guru/bulk", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then((r) => unwrapEnvelope(r.data));
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
 * @property {"Aktif"|"Belum Aktif"|"Nonaktif"} status
 * @property {boolean}                          is_first_login
 * @property {string|null}                      bergabung    - ISO8601 date
 * @property {string|null}                      last_login   - ISO8601 datetime
 */

export const siswaApi = {
  list: (params) => v3.get("/admin/siswa", { params }),

  get: (id) => v3.get(`/admin/siswa/${id}`),

  create: (payload) => v3.post("/admin/siswa", payload),

  update: (id, payload) => v3.patch(`/admin/siswa/${id}`, payload),

  delete: (id) => v3.delete(`/admin/siswa/${id}`),

  bulk: (file, kelas_id, onProgress) => {
    const form = new FormData();
    form.append("file", file);
    form.append("kelas_id", kelas_id);
    return apiClient.post("/admin/siswa/bulk", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    }).then((r) => unwrapEnvelope(r.data));
  },
};

// ════════════════════════════════════════════════════════════════════
// MAPEL (Mata Pelajaran)
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Mapel
 * @property {string} id            - slug unik, misal "mat", "bio", "fis"
 * @property {string} label         - nama tampilan, misal "Matematika"
 * @property {string} icon          - emoji, misal "📐"
 * @property {string} fase          - fase kurikulum merdeka, misal "Fase E (Kelas X)"
 * @property {string} deskripsi_cp  - deskripsi Capaian Pembelajaran umum mapel ini
 */

export const mapelApi = {
  list: () => v3.get("/admin/mapel"),

  get: (id) => v3.get(`/admin/mapel/${id}`),

  create: (payload) => v3.post("/admin/mapel", payload),

  update: (id, payload) => v3.patch(`/admin/mapel/${id}`, payload),

  delete: (id) => v3.delete(`/admin/mapel/${id}`),
};

// ════════════════════════════════════════════════════════════════════
// ELEMEN (per Mapel — Kurikulum Merdeka)
// ════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} Elemen
 * @property {string} id        - slug unik, misal "bil_aljabar"
 * @property {string} mapel_id  - id mapel induk
 * @property {string} label     - nama elemen, misal "Bilangan dan Aljabar"
 *
 * CATATAN: `fase` dan `deskripsi_cp` ada di level MAPEL (GET /admin/mapel),
 * BUKAN di level elemen. Elemen hanya menyimpan { id, mapel_id, label }.
 */

export const elemenApi = {
  list: (mapel_id) =>
    v3.get(`/admin/mapel/${encodeURIComponent(mapel_id)}/elemen`),

  create: (payload) =>
    v3.post(
      `/admin/mapel/${encodeURIComponent(payload.mapel_id)}/elemen`,
      { label: payload.label },
    ),

  update: (id, payload, mapel_id) =>
    v3.patch(
      `/admin/mapel/${encodeURIComponent(mapel_id)}/elemen/${encodeURIComponent(id)}`,
      payload,
    ),

  delete: (id, mapel_id) =>
    v3.delete(
      `/admin/mapel/${encodeURIComponent(mapel_id)}/elemen/${encodeURIComponent(id)}`,
    ),
};

// ════════════════════════════════════════════════════════════════════
// KELAS DETAIL — manajemen mapel, guru pengampu, dan siswa per kelas
// ════════════════════════════════════════════════════════════════════

export const kelasDetailApi = {
  addMapel: (kelasId, payload) =>
    v3.post(`/admin/kelas/${kelasId}/mapel`, payload),

  removeMapel: (kelasId, mapelId) =>
    v3.delete(`/admin/kelas/${kelasId}/mapel/${mapelId}`),

  updateGuruMapel: (kelasId, mapelId, payload) =>
    v3.patch(`/admin/kelas/${kelasId}/mapel/${mapelId}`, payload),

  addSiswa: (kelasId, payload) =>
    v3.post(`/admin/kelas/${kelasId}/siswa`, payload),

  removeSiswa: (kelasId, siswaId) =>
    v3.delete(`/admin/kelas/${kelasId}/siswa/${siswaId}`),
};

// ════════════════════════════════════════════════════════════════════
// REKOMENDASI GURU → SISWA
// ════════════════════════════════════════════════════════════════════

/**
 * POST /notifikasi — CONTRACT V3.6 §21
 * Guru kirim rekomendasi/catatan ke siswa tertentu.
 * Muncul sebagai notifikasi di dashboard siswa (bell icon).
 * Dipakai dari MonitoringSection (modal "Beri Rekomendasi").
 *
 * Endpoint ada di namespace /guru/ bukan /admin/ karena ini fitur guru,
 * bukan fitur administrasi. Hanya role guru yang boleh POST.
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
  // CONTRACT V3.6 §21 POST /notifikasi
  const raw = await v3.post("/notifikasi", payload);
  return {
    id: raw.id,
    created_at: raw.dibuat_at ?? raw.created_at,
  };
}

/**
 * GET /siswa/:id/notifikasi — CONTRACT V3.6 §11
 * Ambil semua notifikasi yang diterima siswa (notifikasi bell).
 * Dipakai DashboardSection siswa.
 * Role siswa yang mengakses, filter by siswa_id dari query param.
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
  // CONTRACT V3.6 §11 GET /siswa/:id/notifikasi
  const rows = await v3.get(`/siswa/${encodeURIComponent(params.siswa_id)}/notifikasi`, {
    params: { dibaca: params.dibaca, page: params.page, limit: params.limit },
  });
  return (rows || []).map((r) => ({
    ...r,
    created_at: r.dibuat_at ?? r.created_at,
  }));
}
// ─── PATCH /notifikasi/:id/baca — CONTRACT V3.6 §21 ─────────────────────────
/**
 * Tandai notifikasi rekomendasi sudah dibaca.
 * Dipanggil NotifikasiBell saat siswa membuka/expand notifikasi.
 * Fire-and-forget — state lokal tetap diupdate meski API gagal.
 *
 * Success 200 → { dibaca: true }
 * Error   404 → notifikasi tidak ditemukan
 *
 * @param {string} id - ID notifikasi rekomendasi
 * @returns {Promise<{ dibaca: boolean }>}
 */
export async function markRekomendasiBaca(id) {
  // CONTRACT V3.6 §21 PATCH /notifikasi/:id/baca
  return v3.patch(`/notifikasi/${encodeURIComponent(id)}/baca`, {});
}

// ─── GET /guru/:id ────────────────────────────────────────────────────
/**
 * Ambil profil guru lengkap dari BE.
 * CONTRACT V3.6 §10 GET /guru/:id
 *
 * Response shape:
 *   { id, nama, nip, email, avatar, mapel_kelas_map, kelas_aktif[], mapel_aktif[] }
 *
 * @param {string} guruId
 * @returns {Promise<object>}
 */
export async function getGuruProfile(guruId) {
  return v3.get(`/guru/${encodeURIComponent(guruId)}`);
}