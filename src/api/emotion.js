/**
 * SR MVP — Emotion API (Tim 1)
 * Tim 6 | src/api/emotion.js
 *
 * Antarmuka ke Image Classifier Tim 1.
 * Mengirim frame webcam siswa → menerima label emosi + confidence score.
 * Hasil emosi dipakai untuk adaptasi konten (Tim 3) dan gaya chat mentor (Tim 5).
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /emotion/detect   → deteksi emosi dari 1 frame webcam
 *  GET  /emotion/history  → riwayat emosi satu sesi belajar
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Bearer token required semua endpoint.
 *  Role: siswa (detect, history), guru (history)
 *
 * ── Cara Pakai ───────────────────────────────────────────────────────
 *  Dipanggil dari: src/hooks/useWebcamEmotion.js
 *  Frekuensi: POST /emotion/detect setiap 5 detik (CAPTURE_INTERVAL_MS)
 *  Frame: base64 JPEG 224×224 pixel, TANPA prefix "data:image/jpeg;base64,"
 *
 * ── Label Emosi ──────────────────────────────────────────────────────
 *  "antusias"  — siswa aktif & bersemangat
 *  "netral"    — kondisi normal
 *  "bingung"   — ekspresi kebingungan
 *  "frustrasi" — siswa tampak frustrasi/terganggu
 *
 *  Catatan: label "senang"/"bosan" dari mock lama diganti ke "antusias"/"netral"
 *  agar konsisten dengan EMOSI_META di masterData.js dan MonitoringSection.
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"antusias"|"netral"|"bingung"|"frustrasi"} Emosi
 *
 * @typedef {Object} EmotionResult
 * @property {Emosi}  emosi       - Label emosi yang terdeteksi
 * @property {number} confidence  - Tingkat keyakinan model, 0.0–1.0
 * @property {string} timestamp   - ISO8601, waktu deteksi
 */

// ─── POST /emotion/detect ─────────────────────────────────────────────
/**
 * Deteksi emosi dari satu frame gambar webcam.
 * Frame dikirim sebagai base64 JPEG tanpa prefix data URI.
 *
 * Success 200 → EmotionResult
 * Error   400 → frame tidak valid / tidak ada wajah terdeteksi
 *               → { message: string, emosi: "tidak_terdeteksi" }
 * Error   429 → rate limit (kirim terlalu cepat)
 *
 * @param {{
 *   siswa_id: string,
 *   frame_base64: string,
 *   session_id?: string
 * }} payload
 * @returns {Promise<EmotionResult>}
 */
export async function detectEmotion(payload) {
  const { data } = await apiClient.post("/emotion/detect", payload);
  return data;
}

// ─── GET /emotion/history ─────────────────────────────────────────────
/**
 * Ambil riwayat emosi sepanjang satu sesi belajar.
 * Dipakai guru di StudentDrawer (MonitoringSection) untuk analisis tren emosi.
 * Sesi diidentifikasi oleh session_id yang diterima dari /emotion/detect response.
 *
 * Success 200 → EmotionResult[]  (urut dari terlama ke terbaru)
 * Success 200 → []               (jika sesi tidak ditemukan)
 *
 * @param {{ siswa_id: string, session_id: string }} params
 * @returns {Promise<EmotionResult[]>}
 */
export async function getEmotionHistory(params) {
  const { data } = await apiClient.get("/emotion/history", { params });
  return data;
}