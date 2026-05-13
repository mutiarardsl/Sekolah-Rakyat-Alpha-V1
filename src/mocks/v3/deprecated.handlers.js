/**
 * SR MVP — Deprecated Endpoint Handlers
 * Tim 6 FE | src/mocks/v3/deprecated.handlers.js
 *
 * ── TUJUAN ────────────────────────────────────────────────────────────
 * C1 FIX: Endpoint V2 lama yang sebelumnya masih aktif di bridge sekarang
 * mengembalikan error eksplisit {error: "deprecated_endpoint"} agar:
 *   - Tim BE tahu ada FE yang masih menggunakan endpoint lama
 *   - Tidak ada silent fallback / silent mismatch
 *   - Integration failure terdeteksi dan traceable
 *
 * ENDPOINT YANG DIDEPRECATED (V2 → V3):
 *   /content/*               → /siswa/:id/*, /konten/*, /rag/*
 *   /game/selesai            → /game/:id/penyelesaian
 *   /game/list               → /game
 *   /emotion/detect          → /emosi/deteksi
 *   /emotion/history         → /sesi/:id/emosi
 *   /mentor/chat             → /mentor/pesan
 *   /mentor/chat/stream      → /mentor/pesan/stream
 *   /mentor/chat/history     → /sesi/:id/chat
 *   /summary/siswa/:id       → /sesi/:id/summary
 *   /guru/rekomendasi        → /notifikasi, /siswa/:id/notifikasi
 *   /auth/change-password    → /auth/password (PATCH)
 *   /auth/forgot-password    → /auth/lupa-password
 *
 * Handler ini HARUS diletakkan SETELAH semua handler V3 di browser.js
 * agar V3 endpoint tidak tertutup oleh catch-all ini.
 * ─────────────────────────────────────────────────────────────────────
 */

import { http, HttpResponse } from 'msw';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const url = (path) => `${BASE}${path}`;

const deprecatedResponse = (legacyPath, v3Path, methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) => {
    const body = {
        data: null,
        meta: null,
        error: {
            code: 'DEPRECATED_ENDPOINT',
            message: `Endpoint "${legacyPath}" sudah deprecated. Gunakan "${v3Path}".`,
            details: {
                legacy: legacyPath,
                migration: v3Path,
                version: 'V3',
                doc: 'API_Contract_SR_V3_FINAL.md',
            },
        },
    };
    return HttpResponse.json(body, { status: 410 }); // 410 Gone
};

// ── /content/* ─────────────────────────────────────────────────────────
const contentDeprecations = [
    ['/content/generate', '/konten/generate'],
    ['/content/publish', '/konten/publish'],
    ['/content/siswa', '/siswa/:id/konten'],
    ['/content/progress/siswa', '/siswa/:id/kpi + /siswa/:id/progress'],
    ['/content/progress/guru', '/kelas/:id/progress'],
    ['/content/riwayat', '/guru/:id/konten'],
    ['/content/quiz/submit', '/siswa/:id/quiz (POST)'],
    ['/content/quiz/history', '/siswa/:id/quiz (GET)'],
    ['/content/pretest/soal', '/pretest/soal'],
    ['/content/pretest/submit', '/pretest/submit'],
    ['/content/pretest/status', '/siswa/:id/pretest/status'],
    ['/content/recommend', '/rag/rekomendasi'],
    ['/content/insight', '/rag/insight'],
];

// ── /game/selesai, /game/list ──────────────────────────────────────────
const gameDeprecations = [
    ['/game/selesai', '/game/:id/penyelesaian'],
    ['/game/list', '/game'],
];

// ── emotion ────────────────────────────────────────────────────────────
const emotionDeprecations = [
    ['/emotion/detect', '/emosi/deteksi'],
    ['/emotion/history', '/sesi/:id/emosi'],
];

// ── mentor ─────────────────────────────────────────────────────────────
const mentorDeprecations = [
    ['/mentor/chat', '/mentor/pesan'],
    ['/mentor/chat/stream', '/mentor/pesan/stream'],
    ['/mentor/chat/history', '/sesi/:id/chat'],
];

// ── summary ────────────────────────────────────────────────────────────
const summaryDeprecations = [
    ['/summary/siswa/:id', '/sesi/:id/summary'],
];

// ── guru/rekomendasi ────────────────────────────────────────────────────
const guruDeprecations = [
    ['/guru/rekomendasi', '/notifikasi (POST) atau /siswa/:id/notifikasi (GET)'],
];

// ── auth V2 endpoint names ──────────────────────────────────────────────
const authDeprecations = [
    ['/auth/change-password', '/auth/password (PATCH)'],
    ['/auth/forgot-password', '/auth/lupa-password'],
];


// ── admin elemen legacy ─────────────────────────────────────────────────
// CONTRACT V3.5 §9: /admin/elemen (flat) → /admin/mapel/:mapel_id/elemen (nested)
const adminDeprecations = [
    ['/admin/elemen', '/admin/mapel/:mapel_id/elemen'],
];

function buildHandlers(deprecations) {
    return deprecations.flatMap(([legacy, v3]) => [
        http.get(url(legacy), () => deprecatedResponse(legacy, v3)),
        http.post(url(legacy), () => deprecatedResponse(legacy, v3)),
        http.put(url(legacy), () => deprecatedResponse(legacy, v3)),
        http.patch(url(legacy), () => deprecatedResponse(legacy, v3)),
        http.delete(url(legacy), () => deprecatedResponse(legacy, v3)),
    ]);
}

export const deprecatedHandlers = [
    ...buildHandlers(contentDeprecations),
    ...buildHandlers(gameDeprecations),
    ...buildHandlers(emotionDeprecations),
    ...buildHandlers(mentorDeprecations),
    ...buildHandlers(summaryDeprecations),
    ...buildHandlers(guruDeprecations),
    ...buildHandlers(authDeprecations),
    ...buildHandlers(adminDeprecations), // CONTRACT V3.5 §9
];