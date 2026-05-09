/**
 * SR MVP — Mock Handlers V3: Sesi Domain
 * Tim 6 FE | src/mocks/v3/sesi.handlers.js
 *
 * Handler NATIVE V3 untuk domain /sesi.
 * Menggantikan bridge yang sebelumnya tidak handle PATCH /sesi/:id.
 *
 * ENDPOINTS:
 *   POST  /sesi              → mulai sesi belajar
 *   PATCH /sesi/:id          → update/tutup sesi (C3 FIX)
 *   POST  /sesi/:id/summary  → generate AI summary (Tim 3 RAG)
 *   GET   /sesi/:id/emosi    → riwayat emosi sesi
 *   GET   /sesi/:id/chat     → riwayat chat sesi
 */

import { http, HttpResponse, delay } from 'msw';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const url = (path) => `${BASE}${path}`;
const d = (ms = 200) => delay(ms);
const nowISO = () => new Date().toISOString();

// In-memory sesi store (reset tiap browser reload)
const sesiStore = new Map(); // sesi_id → { siswa_id, mapel_id, elemen_id, durasi_menit, violations, emosi_akhir, ... }
const chatStore = new Map(); // sesi_id → [{ role, teks, dikirim_at }]

const envelope = (data, meta = null, status = 200) =>
    HttpResponse.json({ data, meta, error: null }, { status });

export const sesiHandlers = [
    // POST /sesi — mulai sesi baru
    http.post(url('/sesi'), async ({ request }) => {
        await d(140);
        const body = await request.json();
        const sesiId = `sesi_${body.siswa_id}_${Date.now().toString(36)}`;
        sesiStore.set(sesiId, {
            sesi_id: sesiId,
            siswa_id: body.siswa_id,
            mapel_id: body.mapel_id,
            elemen_id: body.elemen_id,
            materi_id: body.materi_id || null,
            publish_id: body.publish_id || null,
            dimulai_at: nowISO(),
            durasi_menit: 0,
            emosi_akhir: null,
            violations: [],
            selesai_at: null,
        });
        chatStore.set(sesiId, []);
        return envelope({ sesi_id: sesiId, dimulai_at: sesiStore.get(sesiId).dimulai_at }, null, 201);
    }),

    // PATCH /sesi/:id — C3 FIX: update durasi, violations, emosi_akhir
    http.patch(url('/sesi/:sesiId'), async ({ request, params }) => {
        await d(120);
        const { sesiId } = params;
        const body = await request.json();
        const existing = sesiStore.get(sesiId) || {};
        const updated = {
            ...existing,
            sesi_id: sesiId,
            durasi_menit: body.durasi_menit ?? existing.durasi_menit ?? 0,
            emosi_akhir: body.emosi_akhir ?? existing.emosi_akhir ?? null,
            violations: body.violations ?? existing.violations ?? [],
            selesai_at: nowISO(),
        };
        sesiStore.set(sesiId, updated);
        if (import.meta.env.DEV) {
            console.log('[Mock PATCH /sesi] durasi:', updated.durasi_menit, 'min | violations:', updated.violations?.length);
        }
        return envelope({
            sesi_id: sesiId,
            durasi_menit: updated.durasi_menit,
            selesai_at: updated.selesai_at,
        });
    }),

    // POST /sesi/:id/summary — Tim 3 RAG (native V3)
    http.post(url('/sesi/:sesiId/summary'), async ({ request, params }) => {
        await d(280);
        const body = await request.json();
        const sesi = sesiStore.get(params.sesiId) || {};
        const nQuiz = Array.isArray(body.hasil_quiz) ? body.hasil_quiz.length : 0;
        const durasi = body.durasi_menit ?? sesi.durasi_menit ?? 0;
        const now = new Date();
        const exp = new Date(now.getTime() + 86400000);

        const teks = `Ringkasan aktivitas siswa (${body.siswa_id}): durasi ${durasi} menit • ${nQuiz} catatan kuis dalam sesi ini.`;

        return envelope({
            teks,
            dibuat_at: now.toISOString(),
            berlaku_hingga: exp.toISOString(),
        });
    }),

    // GET /sesi/:id/emosi — riwayat emosi sesi
    http.get(url('/sesi/:sesiId/emosi'), async ({ params }) => {
        await d(120);
        // Sesi yang ada di store → generate emosi pseudo-realistis berdasarkan durasi
        const sesi = sesiStore.get(params.sesiId);
        const durasi = sesi?.durasi_menit ?? 20;
        const now = Date.now();
        const logs = [];
        const emosiSeq = ['antusias', 'bingung', 'antusias', 'bosan', 'antusias'];
        let t = now - durasi * 60_000;
        emosiSeq.forEach((emosi, i) => {
            t += Math.floor((durasi * 60_000) / emosiSeq.length);
            logs.push({
                emosi,
                confidence: +(0.75 + Math.random() * 0.22).toFixed(2),
                terdeteksi_at: new Date(t).toISOString(),
            });
        });
        return envelope(logs);
    }),

    // GET /sesi/:id/chat — riwayat percakapan sesi
    http.get(url('/sesi/:sesiId/chat'), async ({ params }) => {
        await d(100);
        return envelope(chatStore.get(params.sesiId) ?? []);
    }),
];

// Expose internal store untuk mentor service (menambah chat entry)
export function appendChatEntry(sesiId, entry) {
    if (!chatStore.has(sesiId)) chatStore.set(sesiId, []);
    chatStore.get(sesiId).push(entry);
}