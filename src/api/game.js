/**
 * SR MVP — Game API (Tim 4)
 * Tim 6 | src/api/game.js
 *
 * Antarmuka ke LLM Game Asset Generator Tim 4.
 * Tim 4 menghasilkan game edukatif dalam format HTML yang siap di-render
 * via iframe di dalam aplikasi.
 *
 * ── Hirarki Konten Game ──────────────────────────────────────────────
 *  Sama persis dengan hirarki generate konten guru:
 *    mapel → elemen → materi (opsional, jika guru turun sampai level materi)
 *
 *  Payload generate game selalu menyertakan mapel_id + elemen_id + elemen_label.
 *  Field materi & materi_id hanya ada jika guru memilih sampai level materi.
 *  Ini konsisten dengan PublishPayload di content.js.
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /game/generate  → guru generate game baru dari elemen/materi
 *  GET  /game/list      → daftar game tersedia untuk kelas/mapel/elemen
 *  GET  /game/:game_id  → detail game termasuk html_url untuk iframe
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Bearer token required semua endpoint.
 *  generate → role: guru
 *  list, get → role: siswa, guru
 *
 * ── Catatan Penting ──────────────────────────────────────────────────
 *  - Tim 4 deliver game dalam bentuk HTML (bukan JSON config).
 *  - Frontend me-render game via <iframe src={html_url}> di StudentView.
 *  - Game TIDAK menghasilkan skor numerik — tidak ada leaderboard/saveScore.
 *  - Status selesai hanya ditracking di frontend (boolean played).
 *  - Preview guru: GamePreviewModal di KelolaBelajarSection (iframe juga).
 *  - html_url bisa URL absolut (Tim 4 host) atau path relatif ke CDN.
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"generating"|"ready"|"failed"} GameStatus
 * @typedef {"Low"|"Mid"|"High"} Level
 *
 * @typedef {Object} GameItem
 * @property {string}      game_id
 * @property {string}      nama          - Nama game yang dihasilkan Tim 4
 * @property {string}      deskripsi
 * @property {string}      mapel_id
 * @property {string}      elemen_id     - ID elemen kurikulum (selalu ada)
 * @property {string}      elemen_label  - Label elemen untuk ditampilkan
 * @property {string|null} materi        - Nama materi (null jika hanya sampai level elemen)
 * @property {string|null} materi_id     - ID materi (null jika hanya sampai level elemen)
 * @property {Level}       level         - Low / Mid / High
 * @property {GameStatus}  status
 * @property {string|null} html_url      - URL game HTML dari Tim 4, null jika masih generating
 * @property {number}      [pemain]      - Jumlah siswa yang sudah memainkan (hanya di list)
 */

// ─── POST /game/generate ──────────────────────────────────────────────
/**
 * Guru generate game baru dari elemen/materi pelajaran.
 * Hirarki wajib: mapel_id + elemen_id + elemen_label.
 * Materi bersifat opsional — hanya diisi jika guru sudah turun ke level materi.
 *
 * Tim 4 menghasilkan file HTML per level kesulitan (Low/Mid/High).
 * Proses bisa memakan 2–5 detik — tampilkan loading spinner di UI.
 *
 * Success 200 → GameItem
 *   - status "ready"      → html_url terisi, game siap di-render via iframe
 *   - status "generating" → html_url null, poll GET /game/:id tiap 3 detik
 * Error   403 → role bukan guru
 * Error   422 → mapel_id atau elemen_id tidak valid
 *
 * @param {{
 *   mapel_id:         string,
 *   elemen_id:        string,
 *   elemen_label:     string,
 *   materi?:          string,   - opsional, nama materi jika sampai level materi
 *   materi_id?:       string,   - opsional, format: "{mapel_id}__{nama_snake_case}"
 *   kelas_id:         string,
 *   level:            Level,
 *   jenjang?:         "X"|"XI"|"XII",
 *   prompt_tambahan?: string
 * }} payload
 * @returns {Promise<GameItem>}
 */
export async function generateGame(payload) {
  const { data } = await apiClient.post("/game/generate", payload);
  return data;
}

// ─── GET /game/list ───────────────────────────────────────────────────
/**
 * Ambil daftar game yang tersedia untuk kelas dan/atau mapel/elemen tertentu.
 * Dipakai siswa (ChatSection — tombol "Main Game") dan guru (KelolaBelajarSection).
 *
 * Filter mengikuti hirarki kurikulum (semua opsional, makin spesifik makin sempit):
 *   mapel_id saja           → semua game mapel itu lintas elemen
 *   + elemen_id             → game spesifik elemen dalam mapel
 *   + materi_id             → game spesifik materi dalam elemen
 *
 * Success 200 → GameItem[]  (html_url tidak disertakan di list — fetch via GET /:id)
 *
 * @param {{
 *   kelas_id?:  string,
 *   mapel_id?:  string,
 *   elemen_id?: string,
 *   materi_id?: string
 * }} [params]
 * @returns {Promise<GameItem[]>}
 */
export async function getGameList(params) {
  const { data } = await apiClient.get("/game/list", { params });
  return data;
}

// ─── GET /game/:game_id ───────────────────────────────────────────────
/**
 * Ambil detail satu game termasuk html_url untuk rendering iframe.
 * Dipakai StudentView (game panel siswa) dan GamePreviewModal guru.
 *
 * Alur render game di frontend:
 *   1. Panggil getGame(game_id)
 *   2. Cek status:
 *      "ready"      → render <iframe src={html_url} />
 *      "generating" → tampilkan spinner, poll tiap 3 detik
 *      "failed"     → tampilkan pesan error + tombol generate ulang
 *   3. Iframe dikasih sandbox="allow-scripts allow-same-origin"
 *      agar game HTML Tim 4 bisa berjalan tapi tidak akses storage utama
 *
 * Success 200 → GameItem (dengan html_url jika status "ready")
 * Error   404 → game_id tidak ditemukan
 *
 * @param {string} gameId
 * @returns {Promise<GameItem>}
 */
export async function getGame(gameId) {
  const { data } = await apiClient.get(`/game/${gameId}`);
  return data;
}