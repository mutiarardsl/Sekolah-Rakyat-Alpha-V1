/**
 * SR MVP — Content API (Tim 3 RAG + Agentic)
 * Tim 6 | src/api/content.js
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /content/generate       → guru generate satu tipe konten (13× paralel saat generate)
 *  POST /content/publish        → guru publish paket konten ke siswa
 *  GET  /content/siswa          → siswa ambil paket konten yang dipublish untuknya
 *  GET  /content/progress       → progress belajar siswa
 *  POST /content/quiz/submit    → siswa simpan hasil quiz
 *  GET  /content/recommend      → rekomendasi topik berikutnya untuk siswa
 *
 * ── Hirarki Kurikulum (BERLAKU DI SEMUA ENDPOINT) ────────────────────
 *
 *  mapel_id     : WAJIB di semua payload/params
 *  elemen_id    : WAJIB di semua payload/params — tidak ada konten tanpa elemen
 *  elemen_label : WAJIB di payload mutasi (generate, publish) — untuk konteks LLM & display
 *  materi       : OPSIONAL — diisi jika guru turun ke level sub-materi
 *  materi_id    : OPSIONAL — format "{mapel_id}__{nama_snake_case}", misal "mat__persamaan_linear"
 *                 Frontend membangunnya jika materi diisi: materi_id = `${mapel_id}__${snake(materi)}`
 *
 *  RULE PENTING: elemen_id SELALU ada. materi/materi_id hanya ada jika guru mengisinya.
 *  Backend Tim 3 TIDAK boleh menerima payload yang punya mapel_id tapi tidak punya elemen_id.
 *
 * ── Tipe Konten & Level ─────────────────────────────────────────────
 *  bacaan     : Low / Mid / High  — kedalaman & kompleksitas teks bacaan per level
 *  quiz_pg    : Low / Mid / High  — kesulitan soal pilihan ganda per level
 *  quiz_essay : Low / Mid / High  — kompleksitas pertanyaan essay per level
 *  flashcard  : Low / Mid / High  — kedalaman kartu per level
 *  mindmap    : TIDAK berlevel    — satu mindmap untuk keseluruhan elemen
 *  game       : Low / Mid / High  — via /game/generate Tim 4, BUKAN endpoint ini
 *
 * ── Field Name Convention ────────────────────────────────────────────
 *  Gunakan "tipe" (bukan "type") di semua KontenItem — konsisten bahasa Indonesia.
 *  Gunakan "content" sebagai field isi konten di semua tipe.
 *
 * ── Auth ─────────────────────────────────────────────────────────────
 *  generate, publish  → role: guru
 *  siswa, recommend   → role: siswa
 *  progress           → role: siswa, guru
 *  quiz/submit        → role: siswa
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"Low"|"Mid"|"High"} Level
 * @typedef {"bacaan"|"quiz_pg"|"quiz_essay"|"flashcard"|"mindmap"} KontenTipe
 *
 * @typedef {Object} KontenItem
 * @property {KontenTipe} tipe    - Tipe konten ("tipe" bukan "type")
 * @property {Level|null} level   - null hanya untuk tipe "mindmap"
 * @property {Object}     content - Struktur isi per tipe:
 *   bacaan    → { text: string }
 *   quiz_pg   → { soal: Array<{ pertanyaan: string, pilihan: string[], jawaban: string }> }
 *   quiz_essay→ { pertanyaan: string[] }
 *   flashcard → { cards: Array<{ depan: string, belakang: string }> }
 *   mindmap   → { content: string }
 * @property {boolean}    approved - true jika guru sudah approve
 *
 * @typedef {Object} PublishPayload
 * @property {string}       mapel_id
 * @property {string}       elemen_id      - WAJIB SELALU ADA
 * @property {string}       elemen_label   - WAJIB SELALU ADA
 * @property {string|null}  materi         - null jika tidak diisi guru
 * @property {string|null}  materi_id      - null jika tidak diisi guru
 * @property {string}       kelas_id       - atau "__semua__" untuk semua kelas jenjang ini
 * @property {string}       jenjang        - "X" | "XI" | "XII"
 * @property {string}       guru_id        - ID guru yang publish
 * @property {string}       atp            - Alur Tujuan Pembelajaran (boleh string kosong)
 * @property {KontenItem[]} konten_list    - Max 14 item (5 tipe × 3 level, minus mindmap × 2)
 *
 * @typedef {Object} PaketKonten
 * @property {string}       publish_id
 * @property {string}       mapel_id
 * @property {string}       elemen_id      - SELALU ADA
 * @property {string}       elemen_label   - SELALU ADA
 * @property {string|null}  materi
 * @property {string|null}  materi_id
 * @property {string}       kelas_id
 * @property {string}       jenjang
 * @property {string}       published_at   - ISO8601
 * @property {KontenItem[]} konten_list    - Semua item konten yang dipublish guru
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
 * @property {number}   rata_rata_quiz
 * @property {Array<{ mapel_id: string, selesai: number, progress_avg: number }>} by_mapel
 */

// ─── POST /content/generate ───────────────────────────────────────────
/**
 * Guru generate satu tipe konten untuk satu level.
 * Dipanggil dari KelolaBelajarSection secara paralel (13 calls sekaligus):
 *   bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 = 13 calls
 *   (game TIDAK lewat sini — via POST /game/generate Tim 4)
 *
 * Success 200 → { tipe, level, content, generated_at }
 * Error   403 → role bukan guru
 * Error   422 → mapel_id / elemen_id tidak dikenal di VectorDB
 *
 * @param {{
 *   guru_id:       string,
 *   mapel_id:      string,
 *   elemen_id:     string,
 *   elemen_label:  string,
 *   materi?:       string,
 *   materi_id?:    string,
 *   jenjang:       "X"|"XI"|"XII",
 *   atp?:          string,
 *   tipe:          KontenTipe,
 *   level?:        Level,   - wajib kecuali tipe "mindmap"
 * }} payload
 * @returns {Promise<{ tipe: KontenTipe, level: Level|null, content: object, generated_at: string }>}
 */
export async function generateContent(payload) {
  const { data } = await apiClient.post("/content/generate", payload);
  return data;
}

// ─── POST /content/publish ────────────────────────────────────────────
/**
 * Guru publish paket konten ke siswa setelah semua disetujui.
 * Backend menyimpan ke DB dan menautkan ke kelas tujuan.
 * Siswa di kelas tersebut bisa mengambil via GET /content/siswa.
 *
 * Success 201 → { publish_id: string, kelas_ids: string[], published_at: string }
 * Error   403 → role bukan guru
 * Error   400 → konten_list kosong atau elemen_id tidak ada
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
 * Siswa ambil semua paket konten yang sudah dipublish guru untuknya.
 * Dipanggil ChatSection saat siswa membuka topik (prefetch, fire-and-forget).
 * Response sudah berisi konten_list lengkap — tidak perlu generate ulang di sisi siswa.
 *
 * Filter (semua opsional, makin spesifik makin sempit):
 *   mapel_id saja   → semua paket mapel itu
 *   + elemen_id     → paket spesifik elemen
 *   + materi_id     → paket spesifik materi dalam elemen
 *
 * Success 200 → PaketKonten[]
 *
 * @param {{
 *   siswa_id:   string,
 *   mapel_id?:  string,
 *   elemen_id?: string,
 *   materi_id?: string,
 * }} params
 * @returns {Promise<PaketKonten[]>}
 */
export async function getKontenSiswa(params) {
  const { data } = await apiClient.get("/content/siswa", { params });
  return data;
}

// ─── GET /content/progress ────────────────────────────────────────────
/**
 * Progress belajar siswa lintas semua mapel.
 * KPI dashboard siswa + monitoring guru (rata_rata_quiz, by_mapel).
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
 * Dipanggil QuizModal setelah siswa submit quiz MC atau essay.
 * publish_id dipakai backend untuk tracing konten asal dan update progress per paket.
 *
 * Success 200 → { submitted: boolean, score: number, recorded_at: string }
 * Error   422 → siswa_id / elemen_id tidak valid
 *
 * @param {{
 *   siswa_id:     string,
 *   publish_id:   string,         - ID paket konten asal (PaketKonten.publish_id)
 *   mapel_id:     string,
 *   elemen_id:    string,         - WAJIB SELALU ADA
 *   elemen_label: string,
 *   materi?:      string,
 *   materi_id?:   string,
 *   quiz_type:    "mc"|"essay",
 *   level:        Level,
 *   answers:      Record<string, string>,
 *   score:        number,         - 0–100. Essay: 0, dinilai AI secara async
 * }} payload
 * @returns {Promise<{ submitted: boolean, score: number, recorded_at: string }>}
 */
export async function submitQuiz(payload) {
  const { data } = await apiClient.post("/content/quiz/submit", payload);
  return data;
}

// ─── GET /content/recommend ───────────────────────────────────────────
/**
 * Rekomendasi topik berikutnya untuk siswa.
 * Tim 3 mempertimbangkan progress, profil minat, dan hasil quiz.
 * Dipakai RekomCard di dashboard siswa.
 *
 * Success 200 → Array<{
 *   mapel_id:     string,
 *   elemen_id:    string,
 *   elemen_label: string,
 *   materi:       string|null,
 *   materi_id:    string|null,
 *   alasan:       string
 * }>  (maks 3 item)
 *
 * @param {{ siswa_id: string, mapel_id?: string }} params
 * @returns {Promise<object[]>}
 */
export async function getRecommendations(params) {
  const { data } = await apiClient.get("/content/recommend", { params });
  return data;
}