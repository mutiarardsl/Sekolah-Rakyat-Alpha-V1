/**
 * SR MVP — Content API (Tim 3 RAG + Agentic)
 * Tim 6 | src/api/content.js
 *
 * Antarmuka ke Agentic RAG Tim 3.
 * Tim 3 query VectorDB (kurikulum/silabus) + Tim 2 LLM → konten terstruktur.
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /content/generate       → generate mindmap / flashcard
 *  POST /content/publish        → guru publish paket konten ke siswa
 *  GET  /content/siswa          → ambil konten yang dipublish untuk siswa ini
 *  GET  /content/progress       → progress belajar siswa (dipakai dashboard + monitoring guru)
 *  POST /content/quiz/submit    → simpan hasil quiz siswa
 *  GET  /content/recommend      → rekomendasi topik berikutnya
 *
 * ── Catatan Kurikulum ────────────────────────────────────────────────
 *  Kurikulum (mapel → elemen) sudah tersedia di DB dan di masterData.js.
 *  Admin mengelola struktur kurikulum via /admin/mapel dan CRUD elemen.
 *  Tidak ada endpoint upload kurikulum dari FE — Tim 3 mengelola VectorDB
 *  secara internal di sisi backend.
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Bearer token required semua endpoint.
 *  generate, progress, quiz/submit, recommend  → role: siswa, guru
 *  publish                                     → role: guru
 *  curriculum                                  → role: admin
 *  siswa                                       → role: siswa
 *
 * ── Tipe Konten & Level ─────────────────────────────────────────────
 *  Konten Bacaan : tidak berlevel (1 versi, penyampaian AI disesuaikan per level siswa)
 *  Quiz PG/Essay : berlevel Low / Mid / High — kesulitan soal berbeda
 *  Flashcard     : berlevel Low / Mid / High — kedalaman berbeda
 *  Mindmap       : tidak berlevel (1 mindmap keseluruhan elemen)
 *  Game          : berlevel Low / Mid / High — kesulitan gameplay berbeda
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"antusias"|"bosan"|"bingung"|"frustrasi"|"tidak_terdeteksi"} Emosi
 * @typedef {"mindmap"|"flashcard"} ContentTipe
 * @typedef {"Low"|"Mid"|"High"} Level
 *
 * @typedef {Object} FlashcardContent
 * @property {Array<{ depan: string, belakang: string }>} cards
 *
 * @typedef {Object} MindmapContent
 * @property {string} content  - Teks terstruktur representasi mindmap
 *
 * @typedef {Object} ContentResponse
 * @property {ContentTipe}               tipe
 * @property {FlashcardContent|MindmapContent} content
 * @property {string}                    generated_at  - ISO8601
 *
 * @typedef {Object} LearningProgress
 * @property {string}   siswa_id
 * @property {number}   total_materi
 * @property {number}   selesai
 * @property {number}   dalam_proses
 * @property {number}   belum_dimulai
 * @property {number}   streak_hari
 * @property {number}   total_poin_quiz
 * @property {number}   total_waktu_menit
 * @property {number}   rata_rata_quiz     - 0-100, untuk monitoring guru
 * @property {Array<{ mapel_id: string, selesai: number, progress_avg: number }>} by_mapel
 *
 * @typedef {Object} KontenItem
 * @property {string}  type    - "bacaan"|"quiz_pg"|"quiz_essay"|"flashcard"|"mindmap"|"game"
 * @property {Level|null} level
 * @property {string}  content - Teks konten (atau JSON string untuk game)
 * @property {boolean} approved
 *
 * @typedef {Object} PublishPayload
 * @property {string}       mapel_id
 * @property {string}       elemen_id
 * @property {string}       elemen_label
 * @property {string|null}  materi        - Nama sub-materi jika ada
 * @property {string}       kelas_id      - "__semua__" untuk semua kelas di jenjang
 * @property {string}       jenjang       - "X"|"XI"|"XII"
 * @property {string}       atp           - Alur Tujuan Pembelajaran
 * @property {KontenItem[]} konten_list   - Semua item konten yang sudah disetujui guru
 */

// ─── POST /content/generate ───────────────────────────────────────────
/**
 * Generate konten belajar terpersonalisasi (mindmap / flashcard).
 * Agent Tim 3 query VectorDB → Tim 2 LLM → output terstruktur.
 * Dipanggil dari ChatSection saat siswa klik tombol "Buat Mindmap" / "Buat Flashcard".
 *
 * Success 200 → ContentResponse
 * Error   422 → materi_id tidak dikenal di VectorDB
 *
 * @param {{
 *   siswa_id: string,
 *   mapel_id: string,
 *   materi: string,
 *   materi_id: string,
 *   tipe: ContentTipe,
 *   level?: Level,
 *   emosi?: Emosi,
 *   profil_minat?: string
 * }} payload
 * @returns {Promise<ContentResponse>}
 */
export async function generateContent(payload) {
  const { data } = await apiClient.post("/content/generate", payload);
  return data;
}

// ─── POST /content/publish ────────────────────────────────────────────
/**
 * Guru publish paket konten belajar ke siswa.
 * Dipanggil dari KelolaBelajarSection setelah semua konten disetujui guru.
 * Backend menyimpan konten ke DB dan mengaitkan ke kelas tujuan.
 *
 * Success 201 → { publish_id: string, kelas_ids: string[], published_at: string }
 * Error   403 → role bukan guru
 * Error   400 → ada konten yang belum disetujui (validation di frontend sudah cukup)
 *
 * @param {PublishPayload} payload
 * @returns {Promise<{ publish_id: string, kelas_ids: string[], published_at: string }>}
 */
export async function publishKonten(payload) {
  const { data } = await apiClient.post("/content/publish", payload);
  return data;
}

// ─── GET /content/siswa ───────────────────────────────────────────────
/**
 * Ambil semua paket konten yang sudah dipublish untuk siswa ini.
 * Dipakai ProgressSection untuk menampilkan konten yang tersedia per elemen.
 *
 * Success 200 → Array<{
 *   publish_id: string,
 *   mapel_id: string,
 *   elemen_id: string,
 *   elemen_label: string,
 *   materi: string|null,
 *   konten_list: KontenItem[],
 *   published_at: string
 * }>
 *
 * @param {{ siswa_id: string, mapel_id?: string }} params
 * @returns {Promise<object[]>}
 */
export async function getKontenSiswa(params) {
  const { data } = await apiClient.get("/content/siswa", { params });
  return data;
}

// ─── GET /content/progress ────────────────────────────────────────────
/**
 * Progress belajar siswa lintas semua mapel.
 * Dipakai: KPI dashboard siswa + tabel monitoring guru (rata_rata_quiz, by_mapel).
 *
 * Success 200 → LearningProgress
 *
 * @param {{ siswa_id: string }} params
 * @returns {Promise<LearningProgress>}
 */
export async function getLearningProgress(params) {
  const { data } = await apiClient.get("/content/progress", { params });
  return data;
}

// ─── POST /content/quiz/submit ────────────────────────────────────────
/**
 * Simpan hasil quiz siswa ke backend.
 * Dipanggil dari QuizModal setelah siswa submit quiz (MC atau Essay).
 * Skor skala 0-100.
 *
 * Success 200 → { submitted: boolean, score: number, recorded_at: string }
 * Error   422 → materi_id / siswa_id tidak valid
 *
 * @param {{
 *   siswa_id: string,
 *   mapel_id: string,
 *   materi: string,
 *   materi_id: string,
 *   quiz_type: "mc"|"essay",
 *   level: "Low"|"Mid"|"High",
 *   answers: Record<string, string>,
 *   score: number
 * }} payload
 * @returns {Promise<{ submitted: boolean, score: number, recorded_at: string }>}
 */
export async function submitQuiz(payload) {
  const { data } = await apiClient.post("/content/quiz/submit", payload);
  return data;
}

// ─── GET /content/recommend ───────────────────────────────────────────
/**
 * Rekomendasi topik/materi berikutnya untuk siswa.
 * Tim 3 mempertimbangkan: progress, profil minat, dan hasil quiz.
 * Dipakai dashboard siswa (RekomCard) untuk menyarankan materi berikutnya.
 *
 * Success 200 → Array<{
 *   mapel_id: string,
 *   materi: string,
 *   materi_id: string,
 *   elemen_id: string,
 *   elemen_label: string,
 *   alasan: string
 * }>  (maks 3 item)
 *
 * @param {{ siswa_id: string, mapel_id?: string }} params
 * @returns {Promise<object[]>}
 */
export async function getRecommendations(params) {
  const { data } = await apiClient.get("/content/recommend", { params });
  return data;
}