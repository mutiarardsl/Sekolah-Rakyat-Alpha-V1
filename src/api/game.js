/**
 * SR MVP — Game API (Tim 4)
 * Tim 6 | src/api/game.js
 *
 * Antarmuka ke LLM Game Asset Generator Tim 4.
 * Tim 4 menghasilkan skenario narasi, kuis, dan parameter konfigurasi game
 * dalam format JSON — bukan game playable itu sendiri.
 * Game engine/renderer dikelola terpisah oleh Tim 4.
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /game/generate  → guru generate game baru dari materi
 *  GET  /game/list      → daftar game tersedia untuk kelas/mapel
 *  GET  /game/:game_id  → detail & konfigurasi game tertentu
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Bearer token required semua endpoint.
 *  generate → role: guru
 *  list, get → role: siswa, guru
 *
 * ── Catatan Penting ──────────────────────────────────────────────────
 *  - Game TIDAK menghasilkan skor numerik.
 *  - Tidak ada endpoint leaderboard / saveScore.
 *  - Status "selesai" (complete) hanya ditracking di frontend.
 *  - Output Tim 4 adalah JSON config — game engine Tim 4 yang me-render-nya.
 *  - URL game engine untuk preview: lihat KelolaBelajarSection GamePreviewModal.
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"generating"|"ready"|"failed"} GameStatus
 * @typedef {"Low"|"Mid"|"High"} Level
 *
 * @typedef {Object} GameConfig
 * @property {string}     game_id
 * @property {string}     nama
 * @property {string}     deskripsi
 * @property {string}     mapel_id
 * @property {GameStatus} status
 * @property {object}     config    - JSON schema konfigurasi dari Tim 4
 *                                    (levels, questions_per_level, timer_seconds, dll)
 * @property {number}     [pemain]  - Jumlah siswa yang sudah memainkan (hanya di list)
 */

// ─── POST /game/generate ──────────────────────────────────────────────
/**
 * Generate game baru dari materi/elemen pelajaran.
 * Hanya bisa dilakukan oleh guru.
 * Tim 4 menghasilkan narasi, kuis, dan parameter game sesuai konteks.
 * Proses bisa memakan 2-5 detik — tampilkan loading spinner di UI.
 *
 * Success 200 → GameConfig (status: "ready" jika langsung selesai,
 *                            "generating" jika async — poll via GET /game/:id)
 * Error   403 → role bukan guru
 * Error   422 → mapel_id atau elemen tidak valid
 *
 * @param {{
 *   mapel_id: string,
 *   materi: string,
 *   sub_materi: string,
 *   kelas_id: string,
 *   level: Level,
 *   kelas_target?: "X"|"XI"|"XII",
 *   prompt_tambahan?: string
 * }} payload
 * @returns {Promise<GameConfig>}
 */
export async function generateGame(payload) {
  const { data } = await apiClient.post("/game/generate", payload);
  return data;
}

// ─── GET /game/list ───────────────────────────────────────────────────
/**
 * Ambil daftar game yang tersedia untuk kelas dan/atau mapel tertentu.
 * Dipakai siswa untuk memilih game dari ChatSection (tombol "Main Game").
 *
 * Success 200 → Array<{
 *   game_id: string,
 *   nama: string,
 *   mapel_id: string,
 *   materi: string,
 *   sub_materi: string,
 *   level: Level,
 *   status: GameStatus,
 *   pemain: number
 * }>
 *
 * @param {{ kelas_id?: string, mapel_id?: string, materi_id?: string }} [params]
 * @returns {Promise<object[]>}
 */
export async function getGameList(params) {
  const { data } = await apiClient.get("/game/list", { params });
  return data;
}

// ─── GET /game/:game_id ───────────────────────────────────────────────
/**
 * Ambil detail dan konfigurasi lengkap satu game.
 * Dipakai game engine Tim 4 untuk me-render game berdasarkan config JSON.
 * Tidak ada leaderboard — game tidak menghasilkan skor numerik.
 *
 * Success 200 → GameConfig (lengkap dengan config JSON detail)
 * Error   404 → game_id tidak ditemukan
 *
 * @param {string} gameId
 * @returns {Promise<GameConfig>}
 */
export async function getGame(gameId) {
  const { data } = await apiClient.get(`/game/${gameId}`);
  return data;
}