/**
 * SR MVP — Mentor API (Tim 5)
 * Tim 6 | src/api/mentor.js
 *
 * Antarmuka ke LLM Private Mentor Chatbot Tim 5.
 * Session memory dikelola backend berdasarkan (siswa_id, mapel_id, materi_id).
 * Frontend tidak perlu kirim history percakapan — backend yang menyimpan konteks.
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST   /mentor/chat          → kirim pesan, terima full response (REST)
 *  POST   /mentor/chat/stream   → kirim pesan, terima SSE streaming
 *  GET    /mentor/chat/history  → ambil riwayat pesan satu sesi
 *  DELETE /mentor/chat/session  → reset sesi chat (mulai dari awal)
 *  POST   /mentor/insight       → AI insight personal untuk Hero dashboard siswa
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Semua endpoint butuh Bearer token.
 *  Role: siswa (chat, history, session, insight), guru (insight)
 *
 * ── Streaming ────────────────────────────────────────────────────────
 *  Aktifkan: VITE_MENTOR_STREAM=true di .env
 *  Format SSE server: "data: <token>\n\n" per chunk, "data: [DONE]\n\n" untuk tutup
 */

import { apiClient, openStream } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {"antusias"|"bosan"|"bingung"|"frustrasi"|"tidak_terdeteksi"} Emosi
 *
 * @typedef {Object} MentorContext
 * @property {Emosi|null}   [emosi]             - Emosi terkini dari Tim 1, untuk adaptasi gaya respons
 * @property {number|null}  [progress]          - Progress siswa di materi ini (0-100)
 * @property {string|null}  [rekomendasi_guru]  - Catatan/rekomendasi guru untuk siswa ini
 *
 * @typedef {Object} MentorChatPayload
 * @property {string}         siswa_id
 * @property {string}         mapel_id
 * @property {string}         materi      - Nama tampilan materi (label)
 * @property {string}         materi_id   - ID unik: "{mapel_id}__{nama_snake_case}"
 * @property {string}         message     - Pesan dari siswa
 * @property {MentorContext}  [context]   - Konteks opsional dari sistem lain
 *
 * @typedef {Object} ChatMessage
 * @property {"user"|"ai"}  role
 * @property {string}       text        - Konten pesan, mendukung Markdown
 * @property {string}       timestamp   - ISO8601
 * @property {string|null}  [team]      - Label tim AI, misal "Tim 5"
 *
 * @typedef {Object} InsightPayload
 * @property {string}       siswa_id
 * @property {string}       nama            - Nama siswa untuk personalisasi teks
 * @property {string|null}  [top_mapel]     - Mata pelajaran yang paling sering dipelajari
 * @property {string|null}  [emosi_dominan] - Emosi yang paling sering muncul
 * @property {number}       [total_jam]     - Total jam belajar
 * @property {number}       [rata_quiz]     - Rata-rata skor kuis (0-100)
 * @property {number}       [streak_hari]   - Hari belajar berturut-turut
 */

// ─── POST /mentor/chat ────────────────────────────────────────────────
/**
 * Kirim pesan ke mentor, tunggu full response (non-streaming).
 * Gunakan ini sebagai fallback saat SSE tidak tersedia atau VITE_MENTOR_STREAM=false.
 *
 * Success 200 → { reply: string, session_id: string }
 * Error   429 → rate limit, coba lagi setelah beberapa saat
 *
 * @param {MentorChatPayload} payload
 * @returns {Promise<{ reply: string, session_id: string }>}
 */
export async function sendMessage(payload) {
  const { data } = await apiClient.post("/mentor/chat", payload);
  return data;
}

// ─── POST /mentor/chat/stream ─────────────────────────────────────────
/**
 * Kirim pesan ke mentor, terima respons via SSE streaming.
 * Digunakan saat VITE_MENTOR_STREAM=true.
 * Payload identik dengan sendMessage.
 *
 * Format SSE:
 *   "data: <token>\n\n"  — tiap potongan teks
 *   "data: [DONE]\n\n"   — stream selesai
 *
 * @param {MentorChatPayload} payload
 * @param {function(string):void} onChunk  - dipanggil tiap token masuk
 * @param {function():void}       onDone   - dipanggil saat stream selesai
 * @param {function(Error):void}  onError  - dipanggil jika terjadi error
 * @returns {function():void} cancelFn     - panggil untuk abort stream
 */
export function streamMessage(payload, onChunk, onDone, onError) {
  return openStream("/mentor/chat/stream", payload, onChunk, onDone, onError);
}

// ─── GET /mentor/chat/history ─────────────────────────────────────────
/**
 * Ambil riwayat percakapan satu sesi belajar.
 * Sesi diidentifikasi oleh kombinasi (siswa_id, mapel_id, materi_id).
 * Dipakai saat siswa kembali ke topik yang sama — tampilkan histori chat.
 *
 * Success 200 → ChatMessage[]  (urutan: terlama ke terbaru)
 * Success 200 → []             (jika sesi baru / belum ada history)
 *
 * @param {{ siswa_id: string, mapel_id: string, materi: string, materi_id: string }} params
 * @returns {Promise<ChatMessage[]>}
 */
export async function getChatHistory(params) {
  const { data } = await apiClient.get("/mentor/chat/history", { params });
  return data;
}

// ─── DELETE /mentor/chat/session ──────────────────────────────────────
/**
 * Reset sesi chat — hapus history dan mulai percakapan dari awal.
 * Dipakai saat siswa klik "Reset Chat" atau mulai ulang topik.
 * Sesi diidentifikasi oleh params (sama dengan getChatHistory).
 *
 * Success 200 → { deleted: boolean, message: string }
 *
 * @param {{ siswa_id: string, mapel_id: string, materi: string, materi_id: string }} params
 * @returns {Promise<{ deleted: boolean, message: string }>}
 */
export async function resetSession(params) {
  const { data } = await apiClient.delete("/mentor/chat/session", { params });
  return data;
}

// ─── POST /mentor/insight ─────────────────────────────────────────────
/**
 * Generate AI insight personal untuk Hero card di dashboard siswa.
 * LLM Tim 5 membuat 1-2 kalimat motivasi berdasarkan data aktivitas siswa.
 *
 * Dipanggil dari: DashboardSection.jsx (Hero widget)
 * Frekuensi: sekali per load dashboard (di-cache oleh komponen via useState)
 *
 * Success 200 → { text: string }  — insight dalam Bahasa Indonesia, 1 emoji di awal
 *
 * @param {InsightPayload} payload
 * @returns {Promise<{ text: string }>}
 */
export async function getMentorInsight(payload) {
  const { data } = await apiClient.post("/mentor/insight", payload);
  return data;
}