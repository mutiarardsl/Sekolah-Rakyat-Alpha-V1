/**
 * SR MVP — MSW Mock Handlers (V3.6 FINAL)
 * Tim 6 | src/mocks/handlers.js
 *
 * Mock Service Worker — intercept semua request API di browser (development).
 * Setiap handler di sini berpasangan 1-1 dengan fungsi di src/api/*.js.
 * Shape request & response sudah final — swap ke real backend tanpa ubah UI.
 * Semua response menggunakan envelope { data, meta, error } sesuai CONTRACT §1.3.
 *
 * ── Store ─────────────────────────────────────────────────────────────
 * In-memory store di-seed dari masterData. Semua mutasi (POST/PUT/DELETE)
 * langsung menulis ke store sehingga GET berikutnya selalu mengembalikan
 * state terkini — sinkron dengan AdminContext di UI.
 *
 * ── Handler Index (V3 — aktif) ────────────────────────────────────────
 *  AUTH — CONTRACT §8
 *    POST /auth/login, /auth/logout, /auth/refresh
 *    POST /auth/lupa-password [PUBLIC], /auth/aktivasi
 *    POST /auth/forgot-password (alias backward-compat → /auth/lupa-password)
 *    PATCH /auth/password
 *    GET  /auth/me
 *    PUT  /auth/avatar
 *
 *  V3 BRIDGE (proxy ke V2 store, akan dihapus setelah integrasi BE Tim 6)
 *    GET  /siswa/:id/kpi           → /content/progress/siswa (bridge)
 *    GET  /siswa/:id/progress      → /content/progress/siswa (bridge)
 *    GET  /siswa/:id/konten        → /content/siswa (bridge)
 *    GET  /siswa/:id/quiz          → /content/quiz/history (bridge)
 *    GET  /siswa/:id/pretest/status → /content/pretest/status (bridge)
 *    GET  /kelas/:id/progress      → /content/progress/guru (bridge)
 *    GET  /guru/:id/konten         → /content/riwayat (bridge)
 *    GET  /game (list)             → /game/list (bridge)
 *
 *  V3 NATIVE (tidak ada bridge ke V2)
 *    POST /siswa/:id/quiz/mc, /siswa/:id/quiz/essay
 *    POST /rag/rekomendasi, /rag/insight
 *    POST /pretest/soal, /pretest/submit
 *    POST /konten/generate, /konten/publish
 *    POST /game/generate, /game/regenerate
 *    PATCH /game/:id/penyelesaian
 *    POST /emosi/deteksi
 *    POST /mentor/pesan, /mentor/pesan/stream
 *    POST /mentor/evaluasi, /mentor/evaluasi/stream
 *    GET  /sesi/:id/chat
 *    POST /sesi, PATCH /sesi/:id, POST /sesi/:id/summary
 *    POST /notifikasi, GET /siswa/:id/notifikasi, PATCH /notifikasi/:id/baca
 *    GET  /leaderboard
 *    GET  /guru/:id, GET /game/:id
 *    ADMIN: semua endpoint /admin/*
 *
 *  V2 DEAD CODE (masih ada tapi tidak dipanggil FE V3 — akan dihapus)
 *    POST /content/generate, POST /content/publish, GET /content/siswa
 *    GET  /content/progress/siswa, GET /content/progress/guru
 *    POST /content/quiz/submit, GET /content/quiz/history
 *    GET  /content/pretest/status, POST /content/pretest/soal, POST /content/pretest/submit
 *    POST /content/recommend, GET /content/recommend, POST /content/insight
 *    GET  /content/riwayat, POST /summary/siswa/:id
 *    POST /emotion/detect, GET /emotion/history
 *    POST /game/selesai, GET /game/list
 *    POST /mentor/chat, POST /mentor/chat/stream, GET /mentor/chat/history
 *    POST /guru/rekomendasi, GET /guru/rekomendasi, PATCH /guru/rekomendasi/:id/baca
 */

import { http, HttpResponse, delay } from 'msw';
import { DUMMY_ACCOUNTS } from '../data/masterData';
import {
  ADMIN_GURU_INIT,
  ADMIN_SISWA_INIT,
  ADMIN_KELAS_INIT,
  ADMIN_MAPEL_LIST,
  STUDENTS,
  KURIKULUM_ELEMEN,
  MATERI_PER_ELEMEN,
} from '../data/masterData';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const url = (path) => `${BASE}${path}`;

// ─── In-memory store (di-seed dari masterData) ────────────────────────
const store = {
  guru: structuredClone(ADMIN_GURU_INIT),
  siswa: structuredClone(ADMIN_SISWA_INIT),
  kelas: structuredClone(ADMIN_KELAS_INIT),
  mapel: structuredClone(ADMIN_MAPEL_LIST),
  rekomendasi: [],   // { id, guru_id, guru_nama, guru_mapel, siswa_id, pesan, dibaca, created_at }
  publishedKonten: [], // RiwayatKontenItem[] — diisi saat POST /content/publish
};
const loginDates = {};
const d = (ms = 300) => delay(ms);
const nowISO = () => new Date().toISOString();

// ─── Helper: Enrich guru dengan mapel_kelas_map dari kelas store ──────────
// ADMIN_GURU_INIT tidak menyertakan mapel_kelas_map karena relasi itu tersimpan
// di sisi kelas (mapelGuruMap). Fungsi ini membalik relasi tersebut agar
// setiap guru punya mapel_kelas_map lengkap: { mapel_id: [kelas_id, ...] }
// Ini dipakai di GET /admin/guru dan PUT /admin/guru/:id response.
const enrichGuruWithKelasMap = (guru, kelasList) => {
  const mkm = { ...(guru.mapel_kelas_map || {}) };
  kelasList.forEach(kelas => {
    const mgm = kelas.mapelGuruMap || {};
    Object.entries(mgm).forEach(([mapelId, guruId]) => {
      if (guruId === guru.id) {
        if (!mkm[mapelId]) mkm[mapelId] = [];
        if (!mkm[mapelId].includes(kelas.id)) mkm[mapelId].push(kelas.id);
      }
    });
  });
  return { ...guru, mapel_kelas_map: mkm };
};

/**
 * CONTRACT V3.6 §10 — GET /guru/:id response shape.
 * Builds kelas_aktif[] and mapel_aktif[] from store data.
 */
const buildGuruProfileV3 = (guru, kelasList, mapelList) => {
  const enriched = enrichGuruWithKelasMap(guru, kelasList);
  const mkm = enriched.mapel_kelas_map || {};
  // kelas_aktif: unique kelas objects where this guru teaches
  const kelasIdSet = new Set(Object.values(mkm).flat());
  const kelas_aktif = kelasList
    .filter(k => kelasIdSet.has(k.id))
    .map(k => ({ id: k.id, nama: k.nama || k.id, tingkat: k.tingkat || 'X' }));
  // mapel_aktif: unique mapel objects where this guru teaches
  const mapel_aktif = Object.keys(mkm).map(mapelId => {
    const m = mapelList.find(mp => mp.id === mapelId);
    return { id: mapelId, label: m?.label || mapelId, icon: m?.icon || '📚' };
  });
  return { ...enriched, kelas_aktif, mapel_aktif };
};

// ─── Shared scoring helper ────────────────────────────────────────────────
// Dipakai oleh GET /content/progress DAN GET /leaderboard agar total_poin_quiz
// selalu konsisten untuk siswa yang sama di kedua endpoint.
//
// daily  → agregasi dari riwayat[0] (hari ini) saja: mc×60% + essay×40% per level
// monthly → akumulasi agregasi dari SEMUA riwayat siswa
//
// Sesuai flow .md: "total poin kuiz = akumulasi agregasi nilai quiz Pilgan & essay di semua sesi"
const MC_WEIGHT = 0.6;
const ESSAY_WEIGHT = 0.4;

const calcAgregasiFromQuizResults = (quiz_results = []) => {
  const grupMap = {};
  quiz_results.forEach(qr => {
    const key = qr.level || 'low';
    if (!grupMap[key]) grupMap[key] = { mc: null, essay: null };
    if (qr.type === 'essay') grupMap[key].essay = qr.score ?? null;
    else grupMap[key].mc = qr.score ?? null;
  });
  return Object.values(grupMap).reduce((sum, { mc, essay }) => {
    if (mc != null && essay != null) return sum + Math.round(mc * MC_WEIGHT + essay * ESSAY_WEIGHT);
    if (mc != null) return sum + mc;
    if (essay != null) return sum + essay;
    return sum;
  }, 0);
};

const getStudentScore = (siswaId, mode = 'monthly') => {
  // Cari data siswa di STUDENTS (rich data dengan riwayat + quiz_results)
  const siswaRich = STUDENTS.find(s => s.id === siswaId);

  if (siswaRich?.riwayat?.length) {
    if (mode === 'daily') {
      // Harian: ambil riwayat[0] (sesi terbaru/hari ini)
      const sesiHariIni = siswaRich.riwayat[0];
      const daily = calcAgregasiFromQuizResults(sesiHariIni?.quiz_results || []);
      const monthly = siswaRich.riwayat.reduce((sum, r) =>
        sum + calcAgregasiFromQuizResults(r.quiz_results || []), 0);
      const seed = siswaId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return { monthly, daily, selesai: siswaRich.riwayat.length, dalam_proses: 1, rata: Math.round(monthly / Math.max(siswaRich.riwayat.length, 1)), seed };
    } else {
      // Bulanan: akumulasi semua riwayat
      const monthly = siswaRich.riwayat.reduce((sum, r) =>
        sum + calcAgregasiFromQuizResults(r.quiz_results || []), 0);
      const seed = siswaId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const sesiHariIni = siswaRich.riwayat[0];
      const daily = calcAgregasiFromQuizResults(sesiHariIni?.quiz_results || []);
      return { monthly, daily, selesai: siswaRich.riwayat.length, dalam_proses: 1, rata: Math.round(monthly / Math.max(siswaRich.riwayat.length, 1)), seed };
    }
  }

  // Fallback deterministik jika siswa tidak ada di STUDENTS (seed-based)
  const seed = siswaId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const selesai = 2 + (seed % 5);
  const dalam_proses = 1 + (seed % 3);
  const rata = 65 + (seed % 30);
  const monthly = selesai * rata + Math.round(dalam_proses * rata * 0.5);
  const daily = Math.round(monthly * ((seed % 40 + 10) / 100));
  return { monthly, daily, selesai, dalam_proses, rata, seed };
};

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

export const handlers = [
  /** V3 bridging (envelope): proxy ke handler mock lama /content/*
   * FE real sekarang memanggil /siswa/:id/*. Agar tanpa refactor raksasa di mock lama,
   * kita gabung dari endpoint V2 eksisting lewat fetch internal MSW.
   */
  ...(function v3BridgingHandlers() {
    const envelope = (d, meta = null, status = 200) =>
      HttpResponse.json({ data: d, meta, error: null }, { status });

    /** Riwayat chat per sesi_id (proxy mentor V3 ← mock lama) */
    const chatSessions = Object.create(null);

    /**
     * Snapshot hasil quiz per hasil_quiz_id — dipakai mock POST /mentor/evaluasi saja.
     * Integrasi BE: Tim 6 lookup DB dari hasil_quiz_id; field ini tidak dipakai.
     */
    const mockHasilQuizById = Object.create(null);
    function rememberMockHasilQuiz(hasilQuizId, row) {
      if (hasilQuizId) mockHasilQuizById[hasilQuizId] = row;
    }

    /**
     * Store nilai MC terbaru per siswa+elemen+level — dipakai saat essay_dinilai
     * untuk mengisi nilai_mc yang akurat (bukan hardcode 80).
     * Key: `${siswa_id}__${elemen_id}__${level}`
     */
    const mockMcNilaiByKey = Object.create(null);
    function rememberMockMcNilai(siswaId, elemenId, level, nilai) {
      const key = `${siswaId}__${elemenId}__${level}`;
      mockMcNilaiByKey[key] = nilai;
    }
    function getMockMcNilai(siswaId, elemenId, level) {
      const key = `${siswaId}__${elemenId}__${level}`;
      return mockMcNilaiByKey[key] ?? null;
    }
    function buildEvaluasiMcBalasan(materi, levelLc, st) {
      const nilai = st.nilai ?? 0;
      const benar = st.benar ?? 0;
      const total = Math.max(1, st.total ?? 10);
      const wrong = Math.max(0, total - benar);
      const tag = `[${String(levelLc || 'low').toLowerCase()}]`;
      const scoreInfo = `Skor kamu **${nilai}/100** (**${benar}**/${total} soal benar).`;
      if (wrong === 0) {
        return `💬 **Mentor AI siap membahas quiz ${materi}** — ${scoreInfo}\n\n🌟 **Semua jawaban benar!** Kalau masih ada konsep yang ingin diperdalam, tulis saja — Mentor AI siap diskusi. 🚀`;
      }
      const bullets = Array.from({ length: Math.min(wrong, 5) }, (_, i) =>
        `• *${tag} Fokus bahasan ${i + 1} — konsep **${materi}** yang perlu dipastikan pemahamannya*`,
      ).join('\n');
      return `💬 **Mentor AI siap membahas quiz ${materi}** — ${scoreInfo}\n\nAda **${wrong} soal** yang jawabannya kurang tepat:\n${bullets}\n\n📌 **Soal nomor berapa yang ingin kamu bahas dulu?** Tulis nomornya atau langsung tanyakan bagian yang membingungkan — Mentor AI akan membantu menjelaskan! 🚀`;
    }
    function buildEvaluasiEssayBalasan(materi, levelLc, st) {
      const lv = String(levelLc || 'low').toLowerCase();
      const nilaiLine = st.nilai != null ? `\n\nNilai essay tercatat untuk attempt ini: **${st.nilai}/100**.` : '';
      return `📋 **Mentor AI siap membahas jawaban essaymu — ${materi}**${nilaiLine}\n\nKamu sudah mengerjakan **beberapa soal essay** dengan serius. Bagus! Mari kita pilih fokus supaya diskusinya mantap.\n\n✍️ **Soal mana yang ingin kamu bahas dulu?**\n1. *Analisis situasi: Bagaimana kamu menerapkan ${materi} dalam konteks nyata…*\n2. *Buatlah ringkasan singkat tentang ${materi} yang bisa kamu jelaskan ke teman…*\n3. *Bagaimana ${materi} berkaitan dengan pembelajaran di level **${lv}**? Uraikan hubungannya…*\n4. *Jelaskan pengertian ${materi} dengan kata-katamu sendiri!*\n\nTulis nomor soal atau tanya hal spesifik yang membingungkanmu — Mentor AI akan memberikan feedback mendalam pada jawabanmu! 😊`;
    }

    async function legacyJson(pathQuery) {
      const res = await fetch(`${BASE}${pathQuery}`, { credentials: "same-origin" });
      return res.json();
    }

    return [
      http.get(url('/siswa/:siswaId/kpi'), async ({ params }) => {
        await d(200);
        const j = await legacyJson(
          `/content/progress/siswa?siswa_id=${encodeURIComponent(params.siswaId)}`,
        );
        return envelope({
          siswa_id: params.siswaId,
          streak_hari: (() => {
            const sid = params.siswaId;
            const dates = loginDates[sid];
            if (!dates || dates.size === 0) return 0;
            const sorted = Array.from(dates)
              .map(s => new Date(s))
              .sort((a, b) => b - a);
            let streak = 1;
            for (let i = 1; i < sorted.length; i++) {
              const diff = Math.round((sorted[i - 1] - sorted[i]) / 86400000);
              if (diff === 1) streak++;
              else break;
            }
            return streak;
          })(),
          total_topik: j.total_topik ?? 0,
          total_poin_quiz: j.total_poin_quiz ?? 0,
          total_durasi_menit: j.total_durasi_menit ?? j.total_waktu_menit ?? 0,
        });
      }),

      http.get(url('/siswa/:siswaId/progress'), async ({ request, params }) => {
        await d(200);
        const j = await legacyJson(
          `/content/progress/siswa?siswa_id=${encodeURIComponent(params.siswaId)}`,
        );
        const qp = new URL(request.url).searchParams;
        const mapelFilter = qp.get('mapel_id');
        const byMap = (j.by_mapel || []).map((m) => ({
          ...m,
          mapel_icon: m.mapel_icon || '📚',
          dalam_proses: Math.max(
            0,
            Math.round((100 - (m.progress_avg || 0)) / 20),
          ),
          belum_dimulai: 0,
          progress_pct: m.progress_avg ?? m.progress_pct ?? 0,
          elemen: [],
        }));
        return envelope({
          siswa_id: params.siswaId,
          by_mapel: mapelFilter
            ? byMap.filter((x) => x.mapel_id === mapelFilter)
            : byMap,
          sudah_selesai_ids: Array.isArray(j.sudah_selesai_ids)
            ? j.sudah_selesai_ids
            : [],
          sedang_dipelajari_ids: Array.isArray(j.belum_selesai_ids)
            ? j.belum_selesai_ids
            : [],
        });
      }),

      http.get(url('/siswa/:siswaId/konten'), async ({ request, params }) => {
        const inbound = new URL(request.url).searchParams;
        const filterMapelId = inbound.get('mapel_id') || null;
        const filterElemenId = inbound.get('elemen_id') || inbound.get('materi_id') || null;
        const filterMateriId = inbound.get('materi_id') || null;
        await d(150);

        // Jika ada filter spesifik (siswa akses chatbot) → delegate ke legacy /content/siswa
        // untuk mendapatkan konten_list lengkap (bacaan, quiz, game, dll)
        if (filterElemenId || filterMateriId) {
          const q = new URLSearchParams({
            siswa_id: params.siswaId,
            mapel_id: filterMapelId || '',
            elemen_id: filterElemenId || '',
            materi_id: filterMateriId || '',
          });
          const arr = await legacyJson(`/content/siswa?${q}`);
          const mapped = Array.isArray(arr)
            ? arr.map((paket) => ({
              ...paket,
              atp: paket.atp ?? paket.ai_atp ?? 'Siswa mampu memahami topik dalam konteks nyata.',
              konten_list: (paket.konten_list || []).map((c) => ({ ...c, disetujui: true })),
            }))
            : [];
          return envelope(mapped);
        }

        // Tanpa filter (ProgressSection — ambil semua mapel yang dipublish untuk kelas siswa)
        // Simulasi BE real: return satu paket per elemen pertama dari setiap mapel di kelas siswa.
        // BE real: query publish berdasarkan kelas_id siswa → return semua paket published.
        const KELAS_MAPEL_IDS = {
          x1: ['mat', 'bio', 'fis', 'kim', 'eko', 'sos', 'geo', 'agama', 'bin', 'eng', 'ppkn', 'pjok', 'info', 'kka', 'sej', 'ant', 'seni'],
          x2: ['mat', 'bio', 'fis', 'kim', 'eko', 'sos', 'geo', 'agama', 'bin', 'eng', 'ppkn', 'pjok', 'info', 'kka', 'sej', 'ant', 'seni'],
          x3: ['mat', 'bio', 'fis', 'kim', 'eko', 'sos', 'geo', 'agama', 'bin', 'eng', 'ppkn', 'pjok', 'info', 'kka', 'sej', 'ant', 'seni'],
        };
        // Elemen pertama per mapel (representasi paket yang dipublish guru)
        const ELEMEN_PERTAMA = {
          mat: { id: 'bil_aljabar', label: 'Bilangan dan Aljabar' },
          bio: { id: 'pemahaman_bio', label: 'Pemahaman Biologi' },
          fis: { id: 'pemahaman_fis', label: 'Pemahaman Fisika' },
          kim: { id: 'pemahaman_kim', label: 'Pemahaman Kimia' },
          eko: { id: 'pemahaman_eko', label: 'Pemahaman Ekonomi' },
          sos: { id: 'pemahaman_sos', label: 'Pemahaman Sosiologi' },
          geo: { id: 'pemahaman_geo', label: 'Pemahaman Geografi' },
          agama: { id: 'aqidah', label: 'Aqidah' },
          bin: { id: 'membaca', label: 'Membaca' },
          eng: { id: 'listening', label: 'Listening' },
          ppkn: { id: 'pancasila', label: 'Pancasila' },
          pjok: { id: 'aktivitas_ritmik', label: 'Aktivitas Ritmik' },
          info: { id: 'berpikir_komputasional', label: 'Berpikir Komputasional' },
          kka: { id: 'manusia_ruang_waktu', label: 'Manusia, Ruang, dan Waktu' },
          sej: { id: 'sej_indonesia', label: 'Sejarah Indonesia' },
          ant: { id: 'pengantar_antropologi', label: 'Pengantar Antropologi' },
          seni: { id: "berpikir_artistik", label: "Berpikir dan Bekerja Artistik" }
        };

        // Cari kelas_id siswa dari mock STUDENTS atau fallback x1
        // Saat integrasi BE real: BE sudah tahu kelas_id siswa dari JWT/DB
        const MOCK_SISWA_KELAS = {
          s1: 'x1', s2: 'x1', s3: 'x1', s4: 'x1', s5: 'x1',
          s6: 'x1', s7: 'x1', s8: 'x1', s9: 'x1',
          s10: 'x2', s11: 'x2', s12: 'x2', s13: 'x2', s14: 'x2',
          s15: 'x3', s16: 'x3', s17: 'x3', s18: 'x3',
        };
        const kelasId = MOCK_SISWA_KELAS[params.siswaId] || 'x1';
        const mapelIds = filterMapelId
          ? [filterMapelId]
          : (KELAS_MAPEL_IDS[kelasId] || KELAS_MAPEL_IDS.x1);

        const pakets = mapelIds.map(mid => {
          const el = ELEMEN_PERTAMA[mid] || { id: mid, label: mid };
          return {
            publish_id: `pub_${mid}_${el.id}_mock`,
            mapel_id: mid,
            elemen_id: el.id,
            elemen_label: el.label,
            materi: null,
            materi_id: null,
            kelas_id: kelasId,
            jenjang: 'X',
            atp: 'Siswa mampu memahami topik dalam konteks nyata.',
            published_at: new Date(Date.now() - 86400000).toISOString(),
            // konten_list sengaja kosong di sini — di-fetch terpisah saat siswa buka chatbot
            // via getKontenSiswa({ elemen_id }) yang sudah ada filter → masuk cabang legacy di atas
            konten_list: [],
          };
        });

        return envelope(pakets);
      }),

      http.get(url('/siswa/:siswaId/quiz'), async ({ request, params }) => {
        const qp = new URL(request.url).searchParams;
        const qs = new URLSearchParams({
          siswa_id: params.siswaId,
          elemen_id: qp.get('elemen_id') || '',
          materi_id: qp.get('materi_id') || '',
        });
        await d(120);
        const j = await legacyJson(`/content/quiz/history?${qs}`);
        return envelope({
          level_aktif: j.current_level || 'low',
          riwayat: (j.history || []).map((h) => ({
            tipe: h.type === 'essay' ? 'essay' : 'mc',
            level: String(h.level || 'low').toLowerCase(),
            nilai: h.score,
            terkunci: !!h.locked,
            dikerjakan_at:
              typeof h.ts === 'string' && h.ts.includes('-')
                ? h.ts
                : new Date().toISOString(),
            hasil_quiz_id: h.hasil_quiz_id ?? `hq_mock_${h.type || 'mc'}_${Date.now().toString(36)}`, // CONTRACT V3.6 §11
          })),
        });
      }),

      // DEPRECATED — CONTRACT V3.3 §15: POST /siswa/:id/quiz → split ke /mc dan /essay
      // Handler ini dipertahankan untuk backward compat sementara — tidak bridge ke /content/quiz/submit
      // Gunakan POST /siswa/:id/quiz/mc atau /essay untuk flow baru.
      http.post(url('/siswa/:siswaId/quiz'), async ({ request, params }) => {
        const body = await request.json();
        await d(body.tipe === 'essay' ? 400 : 200);
        const levelLc = String(body.level || 'low').toLowerCase();
        const hasilQuizId = `hq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        // Native response — tidak bridge ke deprecated /content/quiz/submit
        return envelope({
          disimpan: true,
          tipe: body.tipe,
          nilai: body.tipe === 'mc' ? 80 : 0,
          nilai_essay: body.tipe === 'essay' ? null : null,
          elemen_id: body.elemen_id,
          level: levelLc, // CONTRACT V3.5 §2
          agregasi: null,
          naik_level: false,
          kkm: 75,
          menunggu_agregasi: false,
          dicatat_at: new Date().toISOString(),
          hasil_quiz_id: hasilQuizId,
        });
      }),

      // CONTRACT V3.6 §16 POST /rag/rekomendasi — native mock (tidak bridge ke /content/recommend)
      http.post(url('/rag/rekomendasi'), async ({ request }) => {
        await d(600);
        const body = await request.json();
        const selesai = new Set(body.sudah_selesai_ids || []);
        const sedang = new Set(body.sedang_dipelajari_ids || []);
        const allMapels = store.mapel.length > 0 ? store.mapel : ADMIN_MAPEL_LIST;
        const kandidat = [];
        for (const mapel of allMapels) {
          if (kandidat.length >= 3) break;
          const elemenList = KURIKULUM_ELEMEN[mapel.id] || [];
          for (const elemen of elemenList) {
            if (kandidat.length >= 3) break;
            if (!selesai.has(elemen.id) && !sedang.has(elemen.id)) {
              kandidat.push({
                mapel_id: mapel.id,
                elemen_id: elemen.id,
                elemen_label: elemen.label,
                materi: null,
                materi_id: null,
                alasan: `Lanjutkan mempelajari ${elemen.label} untuk melengkapi kurikulum.`,
              });
            }
          }
        }
        // Fallback jika kurang dari 3
        if (kandidat.length < 3) {
          for (const mapel of allMapels) {
            if (kandidat.length >= 3) break;
            const elemen = (KURIKULUM_ELEMEN[mapel.id] || [])[0];
            if (elemen && !kandidat.some(k => k.elemen_id === elemen.id)) {
              kandidat.push({
                mapel_id: mapel.id,
                elemen_id: elemen.id,
                elemen_label: elemen.label,
                materi: null,
                materi_id: null,
                alasan: `Topik yang sesuai dengan level progressmu saat ini.`,
              });
            }
          }
        }
        return envelope(kandidat.slice(0, 3)); // Maks 3 — CONTRACT V3.6 §16
      }),

      // CONTRACT V3.6 §16 POST /rag/insight — native mock (tidak bridge ke /content/insight)
      http.post(url('/rag/insight'), async ({ request }) => {
        await d(500);
        const body = await request.json();
        const { nama = 'Siswa', streak = 0, total_topik = 0, total_poin_kuiz = 0, total_durasi = 0 } = body;
        let teks;
        if (streak >= 7) {
          teks = `🔥 Luar biasa, ${nama}! Streak ${streak} hari berturut-turut — konsistensimu patut diacungi jempol!`;
        } else if (total_topik >= 5) {
          teks = `📚 Mantap, ${nama}! Sudah ${total_topik} topik kamu kuasai dengan total ${total_poin_kuiz} poin. Terus pertahankan!`;
        } else if (total_poin_kuiz >= 200) {
          teks = `🌟 Skor quiz kamu sudah ${total_poin_kuiz} poin, ${nama}! Kerja kerasmu membuahkan hasil.`;
        } else {
          teks = `🚀 Semangat, ${nama}! Streak ${streak} hari — setiap sesi belajar membawamu selangkah lebih maju!`;
        }
        return envelope({ teks }); // CONTRACT V3.6 §16: 1–2 kalimat motivasi, dimulai satu emoji
      }),

      http.get(url('/siswa/:siswaId/pretest/status'), async ({ request, params }) => {
        const qp = new URL(request.url).searchParams;
        const q = new URLSearchParams({
          siswa_id: params.siswaId,
          mapel_id: qp.get('mapel_id') || '',
        });
        await d(180);
        const arr = await legacyJson(`/content/pretest/status?${q}`);
        return envelope(arr);
      }),

      // CONTRACT V3.6 §14 POST /pretest/soal — native mock (tidak bridge ke /content/pretest/soal)
      http.post(url('/pretest/soal'), async ({ request }) => {
        await d(300);
        const body = await request.json();
        const { mapel_id = 'mat', elemen_id = 'umum' } = body;
        const elemenList = KURIKULUM_ELEMEN[mapel_id] || [];
        const elemenMeta = elemenList.find(e => e.id === elemen_id) || { label: elemen_id };
        const elemenLabel = elemenMeta.label;
        const sesiPretestId = `pretest_${Date.now().toString(36)}_${elemen_id}`;
        const pertanyaan = [
          `Seberapa familiar kamu dengan topik "${elemenLabel}"?`,
          `Pernahkah kamu mempelajari konsep-konsep dalam "${elemenLabel}" sebelumnya?`,
          `Seberapa percaya diri kamu mengerjakan soal tentang "${elemenLabel}"?`,
          `Apakah kamu bisa menjelaskan konsep dasar dari "${elemenLabel}"?`,
          `Bagaimana penilaianmu terhadap kemampuanmu dalam "${elemenLabel}"?`,
        ];
        const soal = Array.from({ length: 5 }, (_, i) => ({
          id: `pretest_${mapel_id}_${elemen_id}_${i + 1}`,
          soal: pertanyaan[i],
          pilihan: [
            'Belum pernah mempelajari topik ini sama sekali',
            'Pernah mendengar tapi belum memahami konsepnya',
            'Sudah memahami sebagian konsep dasar',
            'Sudah memahami dan bisa menerapkan konsepnya',
          ],
          // CATATAN KEAMANAN: field jawaban tidak dikembalikan ke client — CONTRACT V3.6 §14
        }));
        return envelope({ sesi_pretest_id: sesiPretestId, soal });
      }),

      // CONTRACT V3.6 §14 POST /pretest/submit — native mock (tidak bridge ke /content/pretest/submit)
      http.post(url('/pretest/submit'), async ({ request }) => {
        await d(450);
        const body = await request.json();
        const jawaban = body.jawaban || body.answers || {};
        const totalSoal = 5;
        // Logika penilaian: jawaban indeks >= 2 dianggap "paham"
        const benar = Object.values(jawaban).filter(v => Number(v) >= 2).length;
        const nilai = Math.round((benar / totalSoal) * 100);
        // CONTRACT V3.6 §14: nilai >= 80 → high, >= 60 → mid, < 60 → low
        const level = nilai >= 80 ? 'high' : nilai >= 60 ? 'mid' : 'low';
        return envelope({ level, nilai, benar, total: totalSoal });
      }),

      http.get(url('/kelas/:kelasId/progress'), async ({ request, params }) => {
        const qp = new URL(request.url).searchParams;
        const q = new URLSearchParams({
          kelas_id: params.kelasId,
          mapel_id: qp.get('mapel_id') || 'mat',
        });
        await d(300);
        const j = await legacyJson(`/content/progress/guru?${q}`);
        return envelope({
          kelas_id: j.kelas_id,
          mapel_id: j.mapel_id ?? qp.get('mapel_id'),
          total_siswa: j.total_siswa ?? 30,
          aktif_hari_ini: j.aktif_hari_ini ?? 0,
          rata_rata_progress: j.rata_rata_progress ?? 0,
          siswa: (j.siswa || []).map((s) => ({
            ...s,
            level: typeof s.level === 'string'
              ? s.level.toLowerCase()
              : s.level,
          })),
        });
      }),

      http.get(url('/guru/:guruId/konten'), async ({ request, params }) => {
        const qp = new URL(request.url).searchParams;
        const qs = new URLSearchParams({
          guru_id: params.guruId,
          mapel_id: qp.get('mapel_id') || '',
        });
        await d(350);
        const arr = await legacyJson(`/content/riwayat?${qs}`);
        const LVLS = ['low', 'mid', 'high']; // CONTRACT V3.5 §2: lowercase
        const mapped = (arr || []).map((item) => {
          const konten_list = (item.konten_list || []).map((c) => ({
            ...c,
            disetujui: c.disetujui ?? c.approved ?? true,
          }));
          const game_penyelesaian = LVLS.map((level) => {
            const gItem = konten_list.find(
              (ci) => ci.tipe === "game" && ci.level === level,
            );
            const game_id = gItem?.game_id ?? gItem?.content?.game_id ?? null;  // ← ambil dari item level, fallback ke content
            const siswa_selesai = gItem?.content?.siswa_selesai ?? [];
            return { level, game_id, siswa_selesai };
          }).filter((g) => g.game_id);
          return {
            ...item,
            konten_list,
            game_penyelesaian:
              game_penyelesaian.length > 0
                ? game_penyelesaian
                : item.game_penyelesaian ?? [],
          };
        });
        return envelope(mapped);
      }),

      // CONTRACT V3.6 §12 POST /konten/generate — native mock (tidak bridge ke /content/generate)
      http.post(url('/konten/generate'), async ({ request }) => {
        await d(1800);
        const body = await request.json();
        const { tipe, level, mapel_id, elemen_id, elemen_label, materi, instruksi_revisi, konten_id } = body;
        const isRegenerate = !!instruksi_revisi;
        // Jika regenerate, pakai konten_id lama agar FE tahu ID-nya tidak berubah
        const kontenId = isRegenerate && konten_id
          ? konten_id
          : `konten_${mapel_id}_${tipe}_${(level || 'none').toLowerCase()}_${Date.now().toString(36)}`;
        const levelLc = (level || 'none').toLowerCase();
        const topik = materi || elemen_label || 'Materi';
        let content;
        switch (tipe) {
          case 'bacaan':
            content = {
              text: `# ${topik}${isRegenerate ? ' (Diperbarui)' : ''}\n\n## Pengertian\n${isRegenerate ? `*Instruksi revisi: ${instruksi_revisi}*\n\n` : ''}Konten mock untuk ${topik} level ${levelLc}.\n\n## Contoh\nContoh penerapan dalam kehidupan sehari-hari.\n\n## Rangkuman\n**${topik}** adalah konsep penting.`,
              source: 'Buku Teks Mock 2025',
            };
            break;
          case 'quiz_pg':
            content = {
              soal: Array.from({ length: 10 }, (_, i) => ({
                id: `q${i + 1}`,
                soal: `[${levelLc}] Soal PG ${i + 1} tentang ${topik}`,
                pilihan: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
                jawaban: i % 4,
                penjelasan: `Penjelasan soal ${i + 1}: jawaban benar adalah pilihan indeks ${i % 4}.`, // CONTRACT V3.4 §2
              })),
            };
            break;
          case 'quiz_essay':
            content = {
              pertanyaan: Array.from({ length: 5 }, (_, i) => ({
                id: `e${i + 1}`,
                soal: `[${levelLc}] Jelaskan konsep ke-${i + 1} dari ${topik}`,
                rubrik: 'Menyebutkan minimal 3 poin dengan benar',
              })),
            };
            break;
          case 'flashcard':
            content = {
              cards: [
                { depan: topik, belakang: `Definisi ${topik} dalam konteks ${elemen_label || topik}` },
                { depan: `Contoh ${topik}`, belakang: `Contoh penerapan ${topik} dalam kehidupan sehari-hari` },
                { depan: `Mengapa ${topik} penting?`, belakang: `${topik} penting karena menjadi fondasi pemahaman level berikutnya` },
              ],
              source: 'Buku Teks Mock 2025', // CONTRACT V3.6: source adalah string, bukan array
            };
            break;
          case 'mindmap':
            content = {
              nodes: [
                { id: 'n1', label: topik, parent_id: null, penjelasan: '' }, // CONTRACT V3.4 §3
                { id: 'n2', label: 'Pengertian', parent_id: 'n1', penjelasan: `Definisi ${topik} secara formal.` },
                { id: 'n3', label: 'Contoh', parent_id: 'n1', penjelasan: `Contoh konkret penerapan ${topik}.` },
                { id: 'n4', label: 'Penerapan', parent_id: 'n1', penjelasan: `Cara menerapkan ${topik} dalam konteks nyata.` },
              ],
            };
            break;
          default:
            content = {};
        }
        return envelope({
          konten_id: kontenId,
          tipe,
          level: levelLc === 'none' ? null : levelLc, // CONTRACT V3.6 §12: mindmap level null
          content,
          dibuat_at: new Date().toISOString(),
        });
      }),

      // CONTRACT V3.6 §12 POST /konten/publish — native mock (tidak bridge ke /content/publish)
      http.post(url('/konten/publish'), async ({ request }) => {
        await d(400);
        const body = await request.json();
        // Validasi: semua item harus disetujui — CONTRACT V3.6 §12
        const allApproved = (body.konten_list || []).every(c => c.disetujui === true);
        if (!allApproved) {
          return HttpResponse.json(
            { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'Semua konten harus disetujui sebelum publish.' } },
            { status: 400 }
          );
        }
        const publishId = `pub_${body.mapel_id}_${body.elemen_id}_${body.kelas_id}_${Date.now().toString(36)}`;
        const mapelEntry = store.mapel.find(m => m.id === body.mapel_id) || {};
        const kelasEntry = store.kelas.find(k => k.id === body.kelas_id);
        store.publishedKonten.unshift({
          publish_id: publishId,
          guru_id: body.guru_id,
          mapel_id: body.mapel_id,
          mapel_label: mapelEntry.label || body.mapel_id,
          mapel_icon: mapelEntry.icon || '📚',
          elemen_id: body.elemen_id,
          elemen_label: body.elemen_label,
          materi: body.materi || null,
          materi_id: body.materi_id || null,
          kelas_id: body.kelas_id,
          kelas_nama: kelasEntry?.nama || body.kelas_id,
          jenjang: body.jenjang,
          atp: body.atp || '',
          published_at: new Date().toISOString(),
          konten_list: body.konten_list || [],
        });
        return envelope(
          { publish_id: publishId, kelas_ids: [body.kelas_id], dipublish_at: new Date().toISOString() },
          null,
          201 // CONTRACT V3.6 §12: 201 Created
        );
      }),

      // CONTRACT V3.6 §12 POST /konten/regenerate — native mock (tidak bridge ke /content/generate)
      // V3.3: iterative refinement via konten_id
      {/*http.post(url('/konten/regenerate'), async ({ request }) => {
        await d(1500);
        const body = await request.json();
        const { konten_id, tipe, level, elemen_label, materi, instruksi_revisi } = body;
        if (!konten_id) return HttpResponse.json(
          { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'konten_id tidak ditemukan.' } },
          { status: 404 }
        );
        if (!instruksi_revisi) return HttpResponse.json(
          { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'instruksi_revisi wajib diisi untuk regenerate.' } },
          { status: 422 }
        );
        const levelLc = (level || 'none').toLowerCase();
        const topik = materi || elemen_label || 'Materi';
        let content;
        switch (tipe) {
          case 'bacaan':
            content = {
              text: `# ${topik} (Diperbarui)\n\n*Instruksi revisi: ${instruksi_revisi}*\n\n## Pengertian\nKonten ${topik} yang sudah diperbarui sesuai instruksi guru.\n\n## Contoh Baru\nContoh yang lebih relevan sesuai masukan guru.`,
              source: 'Buku Teks Mock 2025', // CONTRACT V3.6: source adalah string, bukan array
            };
            break;
          case 'quiz_pg':
            content = {
              soal: Array.from({ length: 10 }, (_, i) => ({
                id: `q${i + 1}`,
                soal: `[${levelLc}] Soal PG Baru ${i + 1} tentang ${topik}`,
                pilihan: ['Pilihan A (baru)', 'Pilihan B (baru)', 'Pilihan C (baru)', 'Pilihan D (baru)'],
                jawaban: (i + 1) % 4,
                penjelasan: `Penjelasan revisi soal ${i + 1}.`, // CONTRACT V3.4 §2
              })),
            };
            break;
          case 'quiz_essay':
            content = {
              pertanyaan: Array.from({ length: 5 }, (_, i) => ({
                id: `e${i + 1}`,
                soal: `[${levelLc}] Pertanyaan Essay Baru ${i + 1} tentang ${topik}`,
                rubrik: 'Skor penuh: jawaban komprehensif dan akurat',
              })),
            };
            break;
          case 'flashcard':
            content = {
              cards: [
                { depan: `${topik} (revisi)`, belakang: `Definisi ${topik} yang lebih lengkap sesuai revisi` },
                { depan: `Aplikasi ${topik}`, belakang: 'Aplikasi baru yang lebih kontekstual' },
              ],
              source: 'Buku Teks Mock 2025', // CONTRACT V3.6: source adalah string, bukan array
            };
            break;
          case 'mindmap':
            content = {
              nodes: [
                { id: 'n1', label: topik, parent_id: null, penjelasan: '' },
                { id: 'n2', label: 'Pengertian (diperbarui)', parent_id: 'n1', penjelasan: `Definisi ${topik} yang diperbarui.` },
                { id: 'n3', label: instruksi_revisi.slice(0, 20), parent_id: 'n1', penjelasan: instruksi_revisi },
              ],
            };
            break;
          default:
            content = {};
        }
        return envelope({
          konten_id, // konten_id tetap sama — CONTRACT V3.6 §12
          tipe,
          level: levelLc === 'none' ? null : levelLc,
          content,
          dibuat_at: new Date().toISOString(),
        });
      }),*/},

      // V3.3: POST /siswa/:siswaId/quiz/mc — sinkronus, nilai langsung
      http.post(url('/siswa/:siswaId/quiz/mc'), async ({ request, params }) => {
        const body = await request.json();
        await d(200);
        const levelLc = String(body.level || 'low').toLowerCase();
        const hasilQuizId = `hq_mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        // Mock: hitung nilai MC dari jawaban siswa
        // Di production: BE Tim 6 hitung dari kunci jawaban di database
        const nilaiDariFE = typeof body.score === 'number' ? body.score : null;
        const jawaban = body.jawaban || {};
        const totalSoal = Object.keys(jawaban).length || 10;
        // Gunakan score dari FE jika ada; fallback ke hitung jumlah terisi (≥0)
        const nilai = nilaiDariFE ?? Math.min(100, Math.round(
          (Object.values(jawaban).filter(v => v !== null && v !== '').length / totalSoal) * 100
        ));
        const benar = Math.round((nilai / 100) * totalSoal);
        rememberMockHasilQuiz(hasilQuizId, {
          tipe: 'mc',
          nilai,
          benar,
          total: totalSoal,
          level: levelLc,
        });
        // Simpan nilai MC ke store agar bisa dipakai saat essay_dinilai di-dispatch
        rememberMockMcNilai(params.siswaId, body.elemen_id, levelLc, nilai);
        return envelope({
          tipe: 'mc',
          nilai,
          benar,
          total: totalSoal,
          elemen_id: body.elemen_id,
          level: levelLc,
          naik_level: false,
          agregasi: null,
          menunggu_essay: true,
          kkm: 75,
          hasil_quiz_id: hasilQuizId,
          dicatat_at: new Date().toISOString(),
        });
      }),

      // V3.3: POST /siswa/:siswaId/quiz/essay — CONTRACT V3.6 §11
      // Response: menunggu_penilaian: true, nilai: null
      // Nilai akhir datang via WebSocket event essay_dinilai — CONTRACT V3.6 §22.1.2
      http.post(url('/siswa/:siswaId/quiz/essay'), async ({ request, params }) => {
        const body = await request.json();
        await d(400);
        const levelLc = String(body.level || 'low').toLowerCase();
        const hasilQuizId = `hq_essay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        // Tidak bridge ke /content/quiz/submit (deprecated) — CONTRACT V3.3 §15
        // Mock: simulasikan WebSocket essay_dinilai setelah 4 detik
        // Di production: BE Tim 6 push event ini setelah Tim 3 RAG selesai menilai
        //
        // FIX #1: essayNilai dibuat selalu >= 75 (rentang 75–95) agar mock
        // mencerminkan skenario "siswa mengerjakan essay dengan baik".
        // Dengan mcNilai=80 dan essayNilai>=75:
        //   agregasiNilai = round(80×0.6 + 75×0.4) = round(48+30) = 78 → naik_level: true ✅
        //
        // Catatan untuk integrasi BE real: nilai ini akan datang dari Tim 3 RAG
        // berdasarkan rubrik penilaian aktual — mock ini hanya simulasi dev mode.
        const KKM_MOCK = 75;
        const essayNilai = Math.round(KKM_MOCK + Math.random() * 20); // 75–95, selalu layak naik level
        rememberMockHasilQuiz(hasilQuizId, {
          tipe: 'essay',
          nilai: essayNilai,
          level: levelLc,
        });
        // Ambil nilai MC aktual dari store — null jika MC belum dikerjakan
        const mcNilai = getMockMcNilai(body.siswa_id, body.elemen_id, levelLc);
        // Agregasi hanya dihitung jika MC sudah dikerjakan
        const agregasiNilai = mcNilai != null
          ? Math.round(mcNilai * 0.6 + essayNilai * 0.4)
          : null;
        const finalAgregasi = agregasiNilai != null
          ? Math.max(agregasiNilai, KKM_MOCK)
          : null;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('mock_ws_essay_dinilai', {
            detail: {
              type: 'essay_dinilai',
              siswa: { id: body.siswa_id, nama: 'Siswa', avatar: null },
              payload: {
                elemen_id: body.elemen_id,
                materi_id: body.materi_id || null,
                level: levelLc,
                nilai_essay: essayNilai,
                nilai_mc: mcNilai,                              // null jika MC belum dikerjakan
                agregasi: finalAgregasi,                        // null jika MC belum dikerjakan
                naik_level: finalAgregasi != null && finalAgregasi >= KKM_MOCK,
                kkm: KKM_MOCK,
              },
              timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            },
          }));
        }, 4000);

        return envelope({
          tipe: 'essay',
          nilai: null,
          elemen_id: body.elemen_id,
          level: levelLc,
          menunggu_penilaian: true,
          naik_level: null,
          agregasi: null,
          kkm: 75,
          hasil_quiz_id: hasilQuizId,
          dicatat_at: new Date().toISOString(),
        });
      }),

      http.post(url('/sesi'), async ({ request }) => {
        await d(140);
        const b = await request.json();
        const id = `sesi_${b.siswa_id}_${Date.now().toString(36)}`;
        return envelope(
          { sesi_id: id, dimulai_at: new Date().toISOString() },
          null,
          201,
        );
      }),

      http.get(url('/game'), async ({ request }) => {
        await d(120);
        const search = new URL(request.url).search;
        const arr = await legacyJson(`/game/list${search}`);
        return envelope(Array.isArray(arr) ? arr : [], {
          page: 1,
          limit: 20,
          total: Array.isArray(arr) ? arr.length : 0,
          total_pages: 1,
        });
      }),

      // CONTRACT V3.6 §17 PATCH /game/:gameId/penyelesaian — native mock (tidak bridge ke /game/selesai)
      http.patch(url('/game/:gameId/penyelesaian'), async ({ request, params }) => {
        await d(120);
        const body = await request.json();
        const selesai_at = new Date().toISOString();
        return envelope({
          tercatat: true,
          game_id: params.gameId,
          siswa_id: body.siswa_id,
          level: (body.level || 'low').toLowerCase(), // CONTRACT V3.5 §2
          selesai_at,
        });
      }),

      // CONTRACT V3.6 §18 POST /emosi/deteksi — native mock (tidak bridge ke /emotion/detect)
      http.post(url('/emosi/deteksi'), async ({ request }) => {
        await d(150);
        // CONTRACT V3.6 §18: 5 label emosi valid
        const weighted = [
          'antusias', 'antusias', 'antusias', 'antusias', 'antusias',
          'bosan', 'bosan', 'bosan', 'bosan',
          'bingung', 'bingung', 'bingung',
          'frustrasi', 'frustrasi',
          'tidak_terdeteksi',
        ];
        const emosi = weighted[Math.floor(Math.random() * weighted.length)];
        const confidence = emosi === 'tidak_terdeteksi'
          ? +(0.30 + Math.random() * 0.30).toFixed(2)
          : +(0.72 + Math.random() * 0.26).toFixed(2);
        return envelope({ emosi, confidence, terdeteksi_at: new Date().toISOString() });
      }),

      // CONTRACT V3.6 §19 POST /mentor/pesan — native mock (tidak bridge ke /mentor/chat)
      http.post(url('/mentor/pesan'), async ({ request }) => {
        await d(400);
        const body = await request.json();
        const sid = body.sesi_id || 'sesi_unknown';
        const iso = () => new Date().toISOString();
        const emosi = body.konteks?.emosi;
        const topik = body.elemen_label || body.materi || 'materi ini';
        let intro;
        if (emosi === 'bingung') intro = `Tenang dulu ya! Wajar kalau ${topik} terasa membingungkan. 😊`;
        else if (emosi === 'bosan') intro = `Yuk, kita bikin ${topik} jadi lebih seru! 🎯`;
        else if (emosi === 'frustrasi') intro = `Aku ngerti ini terasa berat. Tapi kamu sudah sampai sejauh ini! 🌟`;
        else if (emosi === 'antusias') intro = `Suka semangatnya! Ayo selami ${topik} lebih dalam! 🚀`;
        else intro = `Pertanyaan menarik tentang **${topik}**!`;
        const balasan = `${intro}\n\nKamu bertanya: "${body.pesan || ''}"\n\nMari kita bahas step by step... 😊\n① Pahami konsep dasarnya\n② Coba contoh sederhana\n③ Latihan soal\n\nMau mulai dari mana?`;
        if (!chatSessions[sid]) chatSessions[sid] = [];
        chatSessions[sid].push({ role: 'user', teks: body.pesan || '', dikirim_at: iso() });
        chatSessions[sid].push({ role: 'ai', teks: balasan, dikirim_at: iso() });
        return envelope({ balasan, sesi_id: sid });
      }),

      // CONTRACT V3.6 §19 POST /mentor/pesan/stream — SSE streaming (tidak bridge ke /mentor/chat)
      http.post(url('/mentor/pesan/stream'), async ({ request }) => {
        await d(150);
        const body = await request.json();
        const sid = body.sesi_id || 'sesi_unknown';
        const topik = body.elemen_label || body.materi || 'materi ini';
        const emosi = body.konteks?.emosi;
        let baseTokens;
        if (emosi === 'bingung') {
          baseTokens = ['😊 ', 'Tenang ', 'ya! ', 'Kita ', 'mulai ', 'dari ', 'dasar. ', topik + ' ', 'tidak ', 'sesulit ', 'kelihatannya. ', 'Yuk! 🌱'];
        } else if (emosi === 'antusias') {
          baseTokens = ['🚀 ', 'Suka ', 'semangatnya! ', 'Langsung ', 'ke ', 'inti ', topik + ': ', 'Gas ', 'terus! ', '⚡'];
        } else {
          baseTokens = ['✨ ', 'Oke! ', 'Mari ', 'kita ', 'bahas ', topik + '. ', 'Mulai ', 'dari ', 'dasar ', 'dulu. ', '📚'];
        }
        if (!chatSessions[sid]) chatSessions[sid] = [];
        chatSessions[sid].push({ role: 'ai', teks: baseTokens.join(''), dikirim_at: new Date().toISOString() });
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            for (const token of baseTokens) {
              await new Promise(r => setTimeout(r, 55 + Math.random() * 45));
              controller.enqueue(encoder.encode(`data: ${token}\n\n`));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
        });
      }),

      // CONTRACT V3.6 §19 POST /mentor/evaluasi — evaluasi quiz CTA (tidak bridge ke /mentor/chat)
      // Mock: isi dari mockHasilQuizById (submit MC/essay); fallback pola id + body.level.
      http.post(url('/mentor/evaluasi'), async ({ request }) => {
        await d(300);
        const body = await request.json();
        const sid = body.sesi_id || 'sesi_unknown';
        const iso = () => new Date().toISOString();
        const materi = body.materi || body.elemen_label || 'materi';
        const snap = body.hasil_quiz_id ? mockHasilQuizById[body.hasil_quiz_id] : null;
        const levelLc = String((snap && snap.level) || body.level || 'low').toLowerCase();
        const hq = body.hasil_quiz_id || '';
        const isEssay = snap ? snap.tipe === 'essay' : /essay|hq_essay/i.test(hq);
        let balasan;
        if (snap && snap.tipe === 'mc') {
          balasan = buildEvaluasiMcBalasan(materi, levelLc, snap);
        } else if (snap && snap.tipe === 'essay') {
          balasan = buildEvaluasiEssayBalasan(materi, levelLc, snap);
        } else if (isEssay) {
          balasan = buildEvaluasiEssayBalasan(materi, levelLc, { nilai: null });
        } else {
          balasan = buildEvaluasiMcBalasan(materi, levelLc, {
            nilai: 80,
            benar: 8,
            total: 10,
            level: levelLc,
          });
        }
        if (!chatSessions[sid]) chatSessions[sid] = [];
        chatSessions[sid].push({ role: 'ai', teks: balasan, dikirim_at: iso() });
        return envelope({ balasan, sesi_id: sid });
      }),

      // CONTRACT V3.6 §19 POST /mentor/evaluasi/stream — SSE versi evaluasi (tidak bridge ke /mentor/chat)
      http.post(url('/mentor/evaluasi/stream'), async ({ request }) => {
        await d(200);
        const body = await request.json();
        const sid = body.sesi_id || 'sesi_unknown';
        const materi = body.materi || body.elemen_label || 'materi';
        const snap = body.hasil_quiz_id ? mockHasilQuizById[body.hasil_quiz_id] : null;
        const levelLc = String((snap && snap.level) || body.level || 'low').toLowerCase();
        const hq = body.hasil_quiz_id || '';
        const isEssay = snap ? snap.tipe === 'essay' : /essay|hq_essay/i.test(hq);
        let balasan;
        if (snap && snap.tipe === 'mc') {
          balasan = buildEvaluasiMcBalasan(materi, levelLc, snap);
        } else if (snap && snap.tipe === 'essay') {
          balasan = buildEvaluasiEssayBalasan(materi, levelLc, snap);
        } else if (isEssay) {
          balasan = buildEvaluasiEssayBalasan(materi, levelLc, { nilai: null });
        } else {
          balasan = buildEvaluasiMcBalasan(materi, levelLc, {
            nilai: 80,
            benar: 8,
            total: 10,
            level: levelLc,
          });
        }
        if (!chatSessions[sid]) chatSessions[sid] = [];
        chatSessions[sid].push({ role: 'ai', teks: balasan, dikirim_at: new Date().toISOString() });
        const tokens = balasan.split(/(\s+)/).filter(Boolean);
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            for (const token of tokens) {
              controller.enqueue(encoder.encode(`data: ${token}\n\n`));
              await new Promise(r => setTimeout(r, 18));
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      }),

      http.get(url('/sesi/:sesiId/chat'), async ({ params }) => {
        await d(100);
        return envelope(chatSessions[params.sesiId] ?? []);
      }),


      // CONTRACT V3.6 §21 POST /notifikasi — native mock (tidak bridge ke /guru/rekomendasi)
      http.post(url('/notifikasi'), async ({ request }) => {
        await d(200);
        const body = await request.json();
        if (!body.guru_id || !body.siswa_id || !body.pesan) {
          return HttpResponse.json(
            { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'guru_id, siswa_id, pesan wajib diisi.' } },
            { status: 400 }
          );
        }
        const guru = store.guru.find(g => g.id === body.guru_id);
        const mapel = store.mapel.find(m => m.id === body.mapel_id);
        const newNotif = {
          id: `notif_${Date.now().toString(36)}`,
          guru_id: body.guru_id,
          guru_nama: guru?.nama || 'Guru',
          guru_mapel: `${mapel?.icon || '📚'} ${mapel?.label || body.mapel_id || ''}`,
          siswa_id: body.siswa_id,
          pesan: body.pesan,
          dibaca: false,
          dibuat_at: new Date().toISOString(),
        };
        store.rekomendasi.push(newNotif);
        return envelope(
          { id: newNotif.id, dibuat_at: newNotif.dibuat_at },
          null,
          201 // CONTRACT V3.6 §21: 201 Created
        );
      }),

      // CONTRACT V3.6 §21 — GET /siswa/:id/notifikasi: native mock (tidak lagi bridge ke /guru/rekomendasi deprecated)
      http.get(url('/siswa/:siswaId/notifikasi'), async ({ request, params }) => { // CONTRACT V3.6 §21
        await d(140);
        const qp = new URL(request.url).searchParams;
        const filterDibaca = qp.get('dibaca'); // 'true' | 'false' | null
        let notifs = store.rekomendasi.filter(n => n.siswa_id === params.siswaId);
        if (filterDibaca !== null) {
          const wantDibaca = filterDibaca === 'true';
          notifs = notifs.filter(n => !!n.dibaca === wantDibaca);
        }
        return envelope(notifs, {
          page: 1,
          limit: 20,
          total: notifs.length,
          total_pages: 1,
        });
      }),

      http.patch(url('/notifikasi/:notifId/baca'), async () => {
        await d(100);
        return envelope({ dibaca: true });
      }),

      http.post(url('/sesi/:sesiId/summary'), async ({ request }) => {
        await d(280);
        const b = await request.json();
        const now = new Date();
        const exp = new Date(now.getTime() + 86400000);
        const nQuiz = Array.isArray(b.hasil_quiz) ? b.hasil_quiz.length : 0;
        const text = `Ringkasan aktivitas siswa (${b.siswa_id}): durasi ${b.durasi_menit ?? 0} menit • ${nQuiz} catatan kuis dalam sesi ini.`;
        return envelope({
          teks: text,
          dibuat_at: now.toISOString(),
          berlaku_hingga: exp.toISOString(),
        });
      }),
    ];
  })(),

  // POST /auth/login — CONTRACT V3.6 §8 (envelope {data, meta, error})
  http.post(url('/auth/login'), async ({ request }) => {
    const { email, password } = await request.json();
    await d(400);
    const account = DUMMY_ACCOUNTS.find(
      a => (a.email === email || a.nis === email) && a.password === password
    );
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    if (!loginDates[account.id]) loginDates[account.id] = new Set();
    loginDates[account.id].add(today);
    if (!account) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Email atau password salah.' } },
        { status: 401 },
      );
    }
    // Token menyertakan userId agar GET /auth/me bisa resolve user tanpa DB
    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_${Date.now()}_${account.id}`,
        refresh_token: `mock_refresh_${account.id}`,
        user: {
          id: account.id,
          nama: account.nama,
          email: account.email,
          nis: account.nis ?? null,
          nip: account.nip ?? null,
          role: account.role,
          avatar: account.avatar ?? null,
          is_first_login: account.is_first_login ?? false,
          kelas_id: account.kelas_id ?? null,
          kelas_nama: store.kelas.find(k => k.id === account.kelas_id)?.nama ?? null,
        },
      },
      meta: null,
      error: null,
    });
  }),

  // POST /auth/logout — CONTRACT V3.6 §8 (envelope)
  http.post(url('/auth/logout'), async () => {
    await d(200);
    return HttpResponse.json({ data: { logged_out: true }, meta: null, error: null });
  }),

  // POST /auth/refresh — CONTRACT V3.6 §8 (envelope)
  // Body: { refresh_token }
  // Mock decode userId dari refresh_token → kembalikan access_token baru yang encode userId.
  // Penting: access_token baru harus encode userId agar GET /auth/me tetap resolve setelah refresh.
  http.post(url('/auth/refresh'), async ({ request }) => {
    await d(200);
    const { refresh_token } = await request.json();
    // Format refresh_token: "mock_refresh_<userId>"
    const userId = refresh_token?.replace('mock_refresh_', '') || null;
    const account = userId ? DUMMY_ACCOUNTS.find(a => a.id === userId) : null;
    if (!account) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Refresh token tidak valid atau sudah expired.' } },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_${Date.now()}_${userId}`,
        refresh_token: `mock_refresh_${userId}`,
      },
      meta: null,
      error: null,
    });
  }),

  // POST /auth/lupa-password — CONTRACT V3.6 §8 [PUBLIC] (envelope)
  // Selalu 200 — tidak ekspos apakah email terdaftar (security by design)
  http.post(url('/auth/lupa-password'), async ({ request }) => {
    const { email } = await request.json();
    await d(600);
    return HttpResponse.json({ data: { sent: true }, meta: null, error: null });
  }),

  // POST /auth/forgot-password — alias backward compat (V2 path)
  // Di deprecated.handlers sudah ada 410, tapi handler ini tetap aktif agar
  // komponen lama yang belum migrasi tidak 410. Akan dihapus setelah semua
  // komponen migrasi ke /auth/lupa-password.
  http.post(url('/auth/forgot-password'), async ({ request }) => {
    const { email } = await request.json();
    await d(600);
    return HttpResponse.json({ data: { sent: true }, meta: null, error: null });
  }),

  // POST /auth/aktivasi — CONTRACT V3.6 §8 (envelope)
  // Body: { password_baru, mapel_ids } — user_id diambil dari JWT token
  http.post(url('/auth/aktivasi'), async ({ request }) => {
    const { password_baru, mapel_ids } = await request.json();
    await d(800);

    // Decode user_id dari Authorization header (CONTRACT V3.6 §8 — tidak di body)
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('_');
    let user_id = null;
    if (parts.length >= 4 && parts[0] === 'mock' && parts[1] === 'jwt') {
      const afterTs = parts.slice(3).join('_');
      user_id = afterTs.startsWith('aktivasi_') ? afterTs.slice(9) : afterTs;
    }

    const siswa = store.siswa.find(s => s.id === user_id);
    if (!siswa) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Siswa tidak ditemukan.' } },
        { status: 404 },
      );
    }
    if (!Array.isArray(mapel_ids) || mapel_ids.length !== 3) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'Harus memilih tepat 3 mata pelajaran.' } },
        { status: 400 },
      );
    }
    if (!password_baru || password_baru.length < 8) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'Password minimal 8 karakter dan harus mengandung huruf dan angka.' } },
        { status: 400 },
      );
    }
    siswa.status = 'Aktif';
    siswa.is_first_login = false;
    siswa.mapel_ids = mapel_ids;
    const acc = DUMMY_ACCOUNTS.find(a => a.id === user_id);
    if (acc) { acc.password = password_baru; acc.is_first_login = false; }
    return HttpResponse.json({
      data: {
        access_token: `mock_jwt_${Date.now()}_aktivasi_${user_id}`,
        refresh_token: `mock_refresh_${user_id}`,
        user: {
          id: siswa.id,
          nama: siswa.nama,
          email: siswa.email,
          nis: siswa.nis,
          nip: null,
          role: 'siswa',
          avatar: null,
          kelas_id: siswa.kelas_id || 'x1',
          kelas_nama: ADMIN_KELAS_INIT.find(k => k.id === (siswa.kelas_id || 'x1'))?.nama || 'X-1',
          is_first_login: false,
          status: 'Aktif',
        },
        mapel_terpilih: mapel_ids,
      },
      meta: null,
      error: null,
    });
  }),

  // PATCH /auth/password — CONTRACT V3.6 §8
  // Body: { password_lama, password_baru }
  // BE decode user dari Authorization token — tidak perlu user_id di body.
  // ForceChangePasswordModal: password_lama = '' (first-login, diizinkan)
  http.patch(url('/auth/password'), async ({ request }) => {
    const { password_lama, password_baru } = await request.json(); // CONTRACT V3.6 §8
    await d(600);

    // Decode user dari Authorization header — format sama dengan login token
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('_');
    let userId = null;
    if (parts.length >= 4 && parts[0] === 'mock' && parts[1] === 'jwt') {
      const afterTs = parts.slice(3).join('_');
      userId = afterTs.startsWith('aktivasi_') ? afterTs.slice(9) : afterTs;
    }
    const acc = userId ? DUMMY_ACCOUNTS.find(a => a.id === userId) : null;

    // First-login: password_lama boleh kosong
    const isFirstLogin = acc?.is_first_login === true;
    if (!isFirstLogin && password_lama && acc && acc.password !== password_lama) {
      return HttpResponse.json({ data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Password lama tidak sesuai.' } }, { status: 401 });
    }
    if (!isFirstLogin && !password_lama) {
      return HttpResponse.json({ data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Password lama wajib diisi.' } }, { status: 401 });
    }

    if (acc && password_baru) {
      acc.password = password_baru;
      acc.is_first_login = false;
    }
    return HttpResponse.json({ data: { updated: true }, meta: null, error: null });
  }),

  // GET /auth/me
  // Membaca Authorization header → ambil token → lookup user dari DUMMY_ACCOUNTS.
  // Mock: token format "mock_jwt_<id>_<timestamp>" atau "mock_jwt_aktivasi_<id>_<ts>"
  // sehingga kita bisa decode user_id dan kembalikan profil yang sesuai.
  // Saat BE live: endpoint ini decode JWT → query DB → return AuthUser.
  http.get(url('/auth/me'), async ({ request }) => {
    await d(200);
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    // Token format: "mock_jwt_<timestamp>_<userId>" atau "mock_jwt_<timestamp>_aktivasi_<userId>"
    // Timestamp selalu numerik dan tidak mengandung underscore → aman split by '_'
    // parts[0]=mock, parts[1]=jwt, parts[2]=<timestamp>, parts[3..]=<userId segments>
    // Contoh: "mock_jwt_1716234567890_usr_001" → parts.slice(3).join('_') = "usr_001" ✓
    // Contoh: "mock_jwt_1716234567890_aktivasi_usr_001" → perlu strip prefix "aktivasi_"
    const parts = token.split('_');
    let userId = null;
    if (parts.length >= 4 && parts[0] === 'mock' && parts[1] === 'jwt') {
      const afterTs = parts.slice(3).join('_'); // "usr_001" atau "aktivasi_usr_001"
      userId = afterTs.startsWith('aktivasi_') ? afterTs.slice(9) : afterTs;
    }

    // Lookup dari DUMMY_ACCOUNTS berdasarkan user id yang ter-encode di token
    const account = userId ? DUMMY_ACCOUNTS.find(a => a.id === userId) : null;

    if (!account) {
      // Fallback: kembalikan 401 agar interceptor client.js bisa coba refresh
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'UNAUTHORIZED', message: 'Token tidak valid.' } },
        { status: 401 },
      );
    }

    // Lookup data siswa/guru dari store untuk field tambahan (kelas_id, dll.)
    const siswaData = store.siswa.find(s => s.id === account.id);
    // guruData reserved untuk field tambahan guru jika diperlukan

    return HttpResponse.json({
      data: {
        id: account.id,
        nama: account.nama,
        email: account.email,
        nis: account.nis ?? null,
        nip: account.nip ?? null,
        role: account.role,
        avatar: account.avatar ?? null,
        is_first_login: account.is_first_login ?? false,
        kelas_id: siswaData?.kelas_id ?? account.kelas_id ?? null,
        kelas_nama: store.kelas.find(k => k.id === (siswaData?.kelas_id ?? account.kelas_id))?.nama ?? null,
      },
      meta: null,
      error: null,
    });
  }),

  // PUT /auth/avatar
  // Content-Type: multipart/form-data. Field: file (JPEG/PNG, maks 2MB setelah compress)
  // Mock: baca file dari FormData via FileReader, kembalikan sebagai data URL.
  // Di produksi: BE upload ke CDN dan kembalikan URL permanen.
  // FIX: btoa(String.fromCharCode(...new Uint8Array(buffer))) crash untuk file besar
  // karena spread operator membuat call stack overflow. Gunakan chunk-based base64.
  http.put(url('/auth/avatar'), async ({ request }) => {
    await d(500);
    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) return HttpResponse.json({ data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'Format file tidak didukung atau ukuran melebihi 2 MB.' } }, { status: 400 });

      // Chunk-safe base64 conversion — aman untuk file besar (tidak stack overflow)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192; // 8KB per chunk
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64}`;
      return HttpResponse.json({ data: { avatar: dataUrl }, meta: null, error: null });
    } catch (err) {
      console.error('[MSW] PUT /auth/avatar error:', err);
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'Gagal memproses file.' } },
        { status: 400 },
      );
    }
  }),

  // PATCH /guru/rekomendasi/:id/baca
  // Tandai notifikasi sudah dibaca — update store mock.
  // [V2 DEAD CODE] — Diganti PATCH /notifikasi/:id/baca (§21). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  // Tolerant: jika id tidak ada di store (misal dummy seed ng1/ng2), tetap return 200 OK.
  // Di produksi BE akan validasi ownership, tapi FE tidak perlu rollback jika 404.
  http.patch(url('/guru/rekomendasi/:id/baca'), async ({ params }) => {
    await d(150);
    const notif = store.rekomendasi.find(r => r.id === params.id);
    if (notif) notif.dibaca = true;
    // Selalu 200 — dummy seed id (ng1, ng2) valid secara UX meski tidak ada di store
    return HttpResponse.json({ dibaca: true });
  }),



  // POST /mentor/chat
  // [V2 DEAD CODE] — Diganti /mentor/pesan (§19). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  // Body: { siswa_id, mapel_id, materi, materi_id, message, context? }
  // FIX B5: baca body.context.emosi untuk mensimulasikan adaptasi gaya mentor
  http.post(url('/mentor/chat'), async ({ request }) => {
    const { materi, materi_id, message, context } = await request.json();
    await d(1200 + Math.random() * 600);
    const topik = materi || materi_id || 'materi ini';
    const emosi = context?.emosi || null;

    // Adaptasi gaya mentor berdasarkan emosi siswa (FIX B5)
    let intro, steps, closing;
    if (emosi === 'bingung') {
      intro = `Tenang dulu ya! Wajar kalau ${topik} terasa membingungkan. 😊`;
      steps = ['① Kita mulai dari yang paling dasar', '② Pakai analogi sederhana dulu', '③ Baru masuk ke detailnya'];
      closing = 'Pelan-pelan saja, tidak ada yang terburu-buru!';
    } else if (emosi === 'bosan') {
      intro = `Yuk, kita bikin ${topik} jadi lebih seru! 🎯`;
      steps = ['① Coba tantangan soal dulu', '② Cari koneksi ke kehidupan nyata', '③ Kalau sudah ngerti, lanjut ke level berikutnya'];
      closing = 'Kadang yang bikin bosan adalah kita sudah sebenarnya bisa — tinggal satu langkah lagi! 💪';
    } else if (emosi === 'frustrasi') {
      intro = `Aku ngerti ini terasa berat. Tapi kamu sudah sampai sejauh ini — itu bukan hal kecil! 🌟`;
      steps = ['① Istirahat sejenak tidak apa-apa', '② Kita pecah masalah ini jadi bagian-bagian kecil', '③ Fokus satu langkah dulu'];
      closing = 'Frustrasi adalah tanda kamu sedang belajar hal yang sesungguhnya. Kamu pasti bisa!';
    } else if (emosi === 'antusias') {
      intro = `Suka semangatnya! Ayo kita selami ${topik} lebih dalam! 🚀`;
      steps = ['① Kita langsung ke konsep intinya', '② Lanjut ke soal yang lebih menantang', '③ Eksplorasi hubungan dengan topik lain'];
      closing = 'Semangat ini yang bikin belajar jadi efektif. Gas terus! ⚡';
    } else {
      intro = `Pertanyaan menarik tentang **${topik}**!`;
      steps = ['① Pahami konsep dasarnya', '② Coba contoh sederhana', '③ Latihan soal'];
      closing = 'Mau mulai dari mana?';
    }

    const reply = [
      intro,
      `Kamu bertanya: "${message || ''}"`,
      '',
      'Mari kita bahas step by step... 😊',
      '',
      ...steps,
      '',
      closing,
    ].join('\n');
    return HttpResponse.json({ reply, session_id: 'sess_' + Date.now() });
  }),

  // FIX ⑤ + FIX B5: POST /mentor/chat/stream — mock SSE via ReadableStream
  // Intercept fetch() dari openStream() di client.js.
  // Emit token 'data: <token>\n\n' tiap ~60ms, tutup dengan 'data: [DONE]\n\n'.
  // FIX B5: baca body.context.emosi dan variasikan tokens agar Tim 5 bisa validasi adaptasi
  http.post(url('/mentor/chat/stream'), async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const topik = body.materi || body.materi_id || 'materi ini';
    const emosi = body.context?.emosi || null;

    // Pilih token set berdasarkan emosi (FIX B5)
    let baseTokens;
    if (emosi === 'bingung') {
      baseTokens = [
        '😊 ', 'Tenang ', 'ya! ', 'Kita ', 'mulai ', 'dari ', 'yang ',
        'paling ', 'dasar. ', topik + ' ', 'itu ', 'sebenarnya ', 'tidak ',
        'sesulit ', 'yang ', 'kelihatan. ', 'Yuk ', 'pelan-pelan! 🌱',
      ];
    } else if (emosi === 'bosan') {
      baseTokens = [
        '🎯 ', 'Yuk ', 'kita ', 'bikin ', topik + ' ', 'jadi ',
        'lebih ', 'seru! ', 'Gimana ', 'kalau ', 'kita ', 'coba ',
        'tantangan ', 'soal ', 'dulu? ', '⚡ ', 'Pasti ', 'lebih ', 'asik!',
      ];
    } else if (emosi === 'frustrasi') {
      baseTokens = [
        '🌟 ', 'Kamu ', 'sudah ', 'sejauh ', 'ini — ', 'itu ', 'luar ',
        'biasa! ', 'Mari ', 'kita ', 'pecah ', topik + ' ', 'jadi ',
        'bagian ', 'kecil. ', 'Satu ', 'langkah ', 'dulu. ', '💪',
      ];
    } else if (emosi === 'antusias') {
      baseTokens = [
        '🚀 ', 'Suka ', 'semangatnya! ', 'Langsung ', 'ke ', 'inti ',
        topik + ': ', 'konsep ', 'utama, ', 'lalu ', 'soal ', 'tantangan. ',
        'Gas ', 'terus! ', '⚡',
      ];
    } else {
      baseTokens = [
        '✨ Oke! ', 'Mari ', 'kita ', 'bahas ', topik + '. ',
        'Konsep ', 'utamanya: ',
        'pemahaman ', 'bertahap. ',
        'Mulai ', 'dari ', 'dasar ', 'dulu, ', 'ya? ', '📚',
      ];
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const token of baseTokens) {
          await new Promise(r => setTimeout(r, 55 + Math.random() * 45));
          controller.enqueue(encoder.encode('data: ' + token + '\n\n'));
        }
        await new Promise(r => setTimeout(r, 80));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }),
  // GET /mentor/chat/history
  // Params: { siswa_id, mapel_id, materi, materi_id }
  // FIX: kembalikan [] untuk sesi baru — hasRealConversation = false
  // sehingga ChatSection memanggil buildOpening() dan opening message materi tampil normal.
  http.get(url('/mentor/chat/history'), async () => {
    await d(400);
    return HttpResponse.json([]);
  }),

  // POST /mentor/chat — CATATAN: /mentor/insight DIHAPUS.
  // Insight Hero Dashboard ditangani Tim 3 RAG via POST /content/insight (lihat handler di bawah).
  // Sesuai flow.md: "insight di handle oleh tim 3 RAG (bukan tim 5 mentor)".
  // ════════════════════════════════════════════════════════════════════

  // POST /content/generate
  // Body: { guru_id, mapel_id, elemen_id, elemen_label, materi?, materi_id?, jenjang, atp?, tipe, level? }
  // dipanggil 13× paralel dari KelolaBelajarSection saat guru klik "Generate Konten":
  //   bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1
  // game TIDAK lewat sini — via POST /game/generate Tim 4
  // [V2 DEAD CODE] — Diganti /konten/generate (§12). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.post(url('/content/generate'), async ({ request }) => {
    const { tipe, level, elemen_label, materi } = await request.json();
    await d(1500 + Math.random() * 1000);
    const topik = materi || elemen_label || 'Materi';
    const lv = level || 'Low';

    // Mock mengembalikan data dummy realistis per tipe.
    // Shape IDENTIK dengan yang akan dikembalikan backend Tim 3 (RAG).
    // KelolaBelajarSection hanya overwrite placeholder jika array.length > 0
    // (lihat Fix A di handleSubmit), sehingga data di sini langsung tampil di UI.
    let mockContent;

    if (tipe === 'bacaan') {
      const depthMap = {
        Low: 'Pengantar sederhana dengan bahasa sehari-hari.',
        Mid: 'Pembahasan mendalam dengan analogi kontekstual dan contoh nyata.',
        High: 'Analisis kritis yang mencakup perbandingan, implikasi, dan evaluasi konsep.',
      };
      mockContent = {
        text: `[Mock Bacaan – ${lv}]\n\n`
          + `Topik: ${topik}\n\n`
          + `${depthMap[lv]}\n\n`
          + `${topik} adalah salah satu konsep fundamental dalam pembelajaran ini. `
          + `Memahami ${topik} dengan baik akan membantu siswa dalam menghadapi tantangan `
          + `yang lebih kompleks di tahap selanjutnya. Melalui pendekatan ${lv.toLowerCase()} `
          + `ini, siswa diajak untuk membangun pemahaman yang kuat dan bermakna.`,
      };
    } else if (tipe === 'quiz_pg') {
      const diffMap = { Low: 'mudah', Mid: 'sedang', High: 'sulit' };
      mockContent = {
        soal: [
          {
            pertanyaan: `[${lv}] Manakah pernyataan yang BENAR tentang ${topik}?`,
            pilihan: [
              `${topik} hanya berlaku dalam kondisi tertentu`,
              `${topik} merupakan konsep universal yang mendasari ${elemen_label}`,
              `${topik} tidak berkaitan dengan materi sebelumnya`,
              `${topik} hanya dipelajari di jenjang atas`,
            ],
            jawaban: `${topik} merupakan konsep universal yang mendasari ${elemen_label}`,
          },
          {
            pertanyaan: `[${lv}] Dalam konteks ${elemen_label}, ${topik} digunakan untuk?`,
            pilihan: [
              `Memperumit proses analisis`,
              `Menyederhanakan perhitungan dasar saja`,
              `Membantu memahami pola dan hubungan antar konsep`,
              `Menggantikan metode konvensional sepenuhnya`,
            ],
            jawaban: `Membantu memahami pola dan hubungan antar konsep`,
          },
          {
            pertanyaan: `[${lv}] Kesulitan tingkat ${diffMap[lv]}: Jika ${topik} diterapkan pada kasus nyata, apa yang perlu diperhatikan pertama kali?`,
            pilihan: [
              `Mengabaikan konteks dan langsung menghitung`,
              `Memahami kondisi awal dan batasan masalah`,
              `Menggunakan rumus tanpa memahami maknanya`,
              `Mencari jawaban tercepat tanpa validasi`,
            ],
            jawaban: `Memahami kondisi awal dan batasan masalah`,
          },
        ],
      };
    } else if (tipe === 'quiz_essay') {
      mockContent = {
        pertanyaan: [
          `[${lv}] Jelaskan pengertian ${topik} dengan kata-katamu sendiri! Berikan minimal satu contoh konkret dari kehidupan sehari-hari.`,
          `[${lv}] Bagaimana ${topik} berkaitan dengan ${elemen_label}? Uraikan hubungannya secara sistematis.`,
          `[${lv}] Analisis situasi berikut: Seorang siswa menghadapi masalah yang berkaitan dengan ${topik}. Langkah-langkah apa yang harus ditempuh untuk menyelesaikannya?`,
        ],
      };
    } else if (tipe === 'flashcard') {
      mockContent = {
        cards: [
          {
            depan: `Apa definisi ${topik}?`,
            belakang: `${topik} adalah konsep dalam ${elemen_label} yang menjelaskan hubungan antara elemen-elemen dasar secara sistematis dan terstruktur.`,
          },
          {
            depan: `Sebutkan contoh penerapan ${topik} dalam kehidupan nyata!`,
            belakang: `Contoh: penerapan ${topik} dapat ditemukan dalam situasi sehari-hari seperti perencanaan, pemecahan masalah, dan pengambilan keputusan yang melibatkan ${elemen_label}.`,
          },
          {
            depan: `Mengapa ${topik} penting dipelajari pada level ${lv}?`,
            belakang: `Pada level ${lv}, ${topik} membangun fondasi pemahaman yang diperlukan untuk menghadapi konsep yang lebih kompleks di level berikutnya.`,
          },
        ],
      };
    } else if (tipe === 'mindmap') {
      mockContent = {
        content: `[Mock Mindmap]\nTopik Utama: ${topik}\n`
          + `\u251C\u2500 Definisi & Konsep Dasar\n`
          + `\u2502  \u251C\u2500 Pengertian ${topik}\n`
          + `\u2502  \u2514\u2500 Komponen utama\n`
          + `\u251C\u2500 Hubungan dengan ${elemen_label}\n`
          + `\u2502  \u251C\u2500 Keterkaitan konsep\n`
          + `\u2502  \u2514\u2500 Aplikasi dalam konteks\n`
          + `\u251C\u2500 Contoh & Penerapan\n`
          + `\u2502  \u251C\u2500 Kasus nyata\n`
          + `\u2502  \u2514\u2500 Simulasi problem\n`
          + `\u2514\u2500 Evaluasi & Refleksi\n`
          + `   \u251C\u2500 Soal latihan\n`
          + `   \u2514\u2500 Indikator penguasaan`,
      };
    } else {
      mockContent = {};
    }

    return HttpResponse.json({
      tipe,
      level: level || null,
      content: mockContent,
      generated_at: nowISO(),
    });
  }),

  // POST /content/publish
  // Body: PublishPayload { mapel_id, elemen_id, elemen_label, materi?, materi_id?,
  //                        kelas_id, jenjang, guru_id, atp, konten_list: KontenItem[] }
  // KontenItem: { tipe, level, content, approved }  (field "tipe" bukan "type")
  // Menyimpan ke store.publishedKonten agar GET /content/riwayat bisa membacanya kembali.
  // [V2 DEAD CODE] — Diganti /konten/publish (§12). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.post(url('/content/publish'), async ({ request }) => {
    const body = await request.json();
    await d(1200);
    const publishId = 'pub_' + Date.now();
    const publishedAt = nowISO();
    const kelasIds = body.kelas_id === '__semua__'
      ? store.kelas.filter(k => k.tingkat === body.jenjang).map(k => k.id)
      : [body.kelas_id].filter(Boolean);

    // Resolve display fields dari store agar RiwayatKontenSection render tanpa lookup lokal
    const mapelEntry = store.mapel.find(m => m.id === body.mapel_id) || {};
    const kelasEntry = store.kelas.find(k => k.id === body.kelas_id);
    const kelasNama = body.kelas_id === '__semua__'
      ? `Semua Kelas ${body.jenjang}`
      : kelasEntry?.nama || body.kelas_id;

    // Simpan ke store — shape: RiwayatKontenItem (typedef di api/content.js)
    const riwayatItem = {
      publish_id: publishId,
      guru_id: body.guru_id,
      mapel_id: body.mapel_id,
      mapel_label: mapelEntry.label || body.mapel_id,
      mapel_icon: mapelEntry.icon || '📚',
      elemen_id: body.elemen_id,
      elemen_label: body.elemen_label,
      materi: body.materi || null,
      materi_id: body.materi_id || null,
      kelas_id: body.kelas_id,
      kelas_nama: kelasNama,
      jenjang: body.jenjang,
      atp: body.atp || '',
      published_at: publishedAt,
      konten_list: body.konten_list || [],
    };
    // Prepend agar urut DESC (terbaru di atas)
    store.publishedKonten.unshift(riwayatItem);

    return HttpResponse.json(
      { publish_id: publishId, kelas_ids: kelasIds, published_at: publishedAt },
      { status: 201 }
    );
  }),

  // GET /content/siswa
  // Params: { siswa_id, mapel_id?, elemen_id?, materi_id? }
  // Response: PaketKonten[] — satu paket per publish yang relevan untuk siswa ini
  // PaketKonten: { publish_id, mapel_id, elemen_id, elemen_label, materi, materi_id,
  //                kelas_id, jenjang, published_at, konten_list: KontenItem[] }
  // KontenItem: { tipe, level, content, approved }  (field "tipe" bukan "type")
  //
  // REVISI FASE 3: konten_list = 16 item
  //   bacaan×3 (Low/Mid/High) + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 + game×3 = 16
  //   game disertakan di sini (mirror dari GET /game/list Tim 4) agar siswa GET /content
  //   mengembalikan jumlah yang sama dengan guru POST /content/publish (16 item).
  //   Frontend menyaring game berdasarkan level siswa saat ini.
  //
  // SISTEM BACAAN MARKDOWN:
  //   Konten bacaan dikirim dalam format Markdown penuh.
  //   Frontend (ChatSection) merender via renderMarkdown() yang sudah ada.
  //   Struktur per level:
  //     Low  → paragraf pengantar + 3 poin utama + 1 contoh sederhana
  // [V2 DEAD CODE] — Diganti /siswa/:id/konten (§11). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  //     Mid  → pembahasan mendalam + analogi + 2 contoh kontekstual + ringkasan
  //     High → analisis kritis + perbandingan + implikasi + evaluasi
  http.get(url('/content/siswa'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const mapelId = p.get('mapel_id') || 'mat';
    const elemenId = p.get('elemen_id') || p.get('materi_id') || 'bil_aljabar';
    const materiIdParam = p.get('materi_id') || null;
    // Cari label elemen dari store kurikulum (sudah ada di store.mapel via KURIKULUM_ELEMEN)
    // Fallback: ubah snake_case ke Title Case jika tidak ditemukan
    const toTitleCase = (str) => str
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
    const elemenEntry = elemenList.find(e => e.id === elemenId);
    const elemenLabel = elemenEntry?.label || toTitleCase(elemenId);
    const topikLabel = materiIdParam || elemenLabel;
    await d(500);
    const LVLS = ['low', 'mid', 'high']; // CONTRACT V3.5 §2: response level selalu lowercase

    // ── Helper: mock bacaan Markdown per level ─────────────────────
    const makeBacaan = (lv, topik) => {
      const depthMap = {
        Low: `# ${topik}

## A. Pengertian

**${topik}** merupakan salah satu konsep dasar yang dipelajari dalam ${elemenLabel}. Pemahaman yang baik terhadap konsep ini menjadi landasan untuk mempelajari materi-materi berikutnya.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Dengan memahami **${topik}**, kamu akan lebih mudah memecahkan berbagai permasalahan yang berkaitan.

## B. Ciri-ciri dan Karakteristik

Berikut ini adalah ciri-ciri utama dari **${topik}**:

1. Memiliki struktur yang teratur dan dapat diidentifikasi secara sistematis
2. Berkaitan erat dengan konsep-konsep lain dalam ${elemenLabel}
3. Dapat diterapkan dalam berbagai konteks kehidupan sehari-hari

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## C. Contoh Penerapan

**Contoh 1:**
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Dalam konteks ini, **${topik}** berperan sebagai alat bantu analisis yang efektif.

**Contoh 2:**
Excepteur sint occaecat cupidatat non proident. Prinsip **${topik}** diterapkan ketika kita perlu membandingkan dua situasi yang berbeda secara objektif.

## D. Rangkuman

> **${topik}** adalah konsep penting dalam ${elemenLabel} yang dapat membantu kita memahami dan menganalisis berbagai fenomena secara lebih terstruktur.

💡 *Setelah membaca materi ini, klik tombol "Selesai membaca" dan diskusikan dengan Mentor AI jika ada yang belum dipahami.*`,

        Mid: `# ${topik}: Pemahaman Mendalam

## A. Konsep Inti

**${topik}** dalam konteks ${elemenLabel} memiliki dimensi yang lebih luas dibandingkan pemahaman dasar. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.

## B. Hubungan Antar Konsep

Dalam kerangka ${elemenLabel}, **${topik}** berinteraksi dengan konsep-konsep lain sebagai berikut:

| Aspek | Keterangan |
|---|---|
| Keterkaitan Horizontal | Berhubungan dengan konsep setara dalam ${elemenLabel} |
| Keterkaitan Vertikal | Menjadi dasar bagi konsep-konsep tingkat lanjut |
| Penerapan Praktis | Dapat digunakan langsung dalam pemecahan masalah |

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## C. Analisis Kontekstual

**Situasi 1 — Konteks Formal:**
Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Penerapan **${topik}** dalam situasi ini memerlukan pemahaman yang komprehensif tentang kondisi dan variabel yang terlibat.

**Situasi 2 — Konteks Informal:**
Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. Di sini, **${topik}** membantu kita membuat keputusan yang lebih tepat dan terukur.

## D. Implikasi Praktis

1. **Perencanaan** — Ut labore et dolore magnam aliquam quaerat voluptatem
2. **Evaluasi** — Neque porro quisquam est, qui dolorem ipsum quia dolor
3. **Pengambilan Keputusan** — At vero eos et accusamus et iusto odio dignissimos

## E. Rangkuman

Pemahaman mendalam tentang **${topik}** membuka wawasan baru dalam memandang permasalahan di ${elemenLabel}. Dengan menguasai konsep ini, kamu mampu berpikir lebih kritis dan sistematis.

📌 *Refleksi: Identifikasi satu situasi nyata di mana kamu pernah menghadapi permasalahan yang berkaitan dengan ${topik}.*`,

        High: `# Analisis Kritis: ${topik}

## A. Tinjauan Teoretis

Pada tingkat analisis ini, **${topik}** dikaji tidak hanya dari perspektif deskriptif, melainkan juga dari sudut pandang evaluatif dan komparatif. Lorem ipsum dolor sit amet, consectetur adipiscing elit.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis.

## B. Perbandingan Pendekatan

| Dimensi | Pendekatan Konvensional | Pendekatan Berbasis ${topik} |
|---|---|---|
| Analisis | Linier, satu variabel | Multidimensi, sistematis |
| Validitas | Bergantung asumsi tunggal | Mempertimbangkan konteks |
| Fleksibilitas | Terbatas pada kondisi ideal | Adaptif terhadap variasi |
| Kesimpulan | Sering parsial | Lebih komprehensif |

## C. Batas dan Keterbatasan

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. **${topik}** paling efektif diterapkan ketika:

1. Variabel-variabel utama dapat didefinisikan dengan jelas
2. Data yang tersedia cukup untuk mendukung analisis yang valid
3. Konteks penerapan sesuai dengan asumsi dasar yang digunakan

Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.

## D. Kritik dan Perspektif Alternatif

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti.

Beberapa perspektif kritis terhadap penerapan **${topik}**:

- **Perspektif Reduksionis:** Risiko penyederhanaan yang berlebihan terhadap kompleksitas realita
- **Perspektif Kontekstualis:** Pentingnya mempertimbangkan faktor-faktor kualitatif yang tidak terukur
- **Perspektif Komparatif:** Keunggulan dan kelemahan dibandingkan pendekatan alternatif lainnya

## E. Evaluasi dan Sintesis

Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus.

**Pertanyaan evaluatif:**
1. Dalam kondisi apa **${topik}** memberikan hasil analisis yang paling akurat?
2. Bagaimana cara mengidentifikasi potensi bias dalam penerapan **${topik}**?
3. Apa yang dapat kamu tawarkan sebagai penyempurnaan terhadap pendekatan yang ada?

## F. Rangkuman

Analisis kritis terhadap **${topik}** menunjukkan bahwa konsep ini, meskipun kuat sebagai alat analisis, tetap memerlukan pemahaman kontekstual yang mendalam agar dapat diterapkan secara optimal.

🔬 *Tantangan: Cari satu kasus nyata di mana penerapan ${topik} menghasilkan kesimpulan yang berbeda dari intuisi awal. Diskusikan temuanmu dengan Mentor AI.*`,
      };
      return {
        text: depthMap[lv] || depthMap.Low,
        source: `Buku Teks ${elemenLabel} — Kemendikbud 2022`, // CONTRACT V3.6: source adalah string, bukan array
      };
    };

    // ── Helper: mock quiz_pg per level — 10 soal, key 'soal' ────────
    // Shape: { soal: Array<{ soal, pilihan, jawaban(index) }> }
    // jawaban adalah INDEX pilihan yang benar (bukan string) agar QuizModal bisa cek mcAnswers[i] === s.jawaban
    const makeQuizPG = (lv, topik) => ({
      soal: [
        {
          soal: `[${lv}] Manakah pernyataan yang BENAR tentang ${topik}?`,
          pilihan: [`${topik} hanya berlaku dalam kondisi tertentu saja`, `${topik} merupakan konsep fundamental dalam ${elemenLabel}`, `${topik} tidak berkaitan dengan materi lain`, `${topik} hanya dipelajari di jenjang atas`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Dalam konteks ${elemenLabel}, ${topik} digunakan untuk?`,
          pilihan: [`Memperumit proses analisis`, `Menyederhanakan perhitungan dasar saja`, `Membantu memahami pola dan hubungan antar konsep`, `Menggantikan metode konvensional sepenuhnya`],
          jawaban: 2,
        },
        {
          soal: `[${lv}] Apa ciri khas ${topik} pada level ${lv}?`,
          pilihan: [`Memahami kondisi awal dan batasan masalah`, `Mengabaikan konteks dan langsung menghitung`, `Menggunakan rumus tanpa memahami maknanya`, `Mencari jawaban tercepat tanpa validasi`],
          jawaban: 0,
        },
        {
          soal: `[${lv}] Hubungan antara ${topik} dan ${elemenLabel} paling tepat digambarkan sebagai?`,
          pilihan: [`Tidak saling berhubungan`, `${topik} adalah bagian dari ${elemenLabel}`, `${elemenLabel} menggantikan ${topik}`, `Keduanya identik tanpa perbedaan`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Manakah langkah pertama yang tepat saat mempelajari ${topik}?`,
          pilihan: [`Langsung latihan soal sulit`, `Memahami definisi dan konsep dasar`, `Menghafal rumus tanpa memahami konteks`, `Melewati materi dan lanjut ke topik lain`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Apa yang membedakan ${topik} dari konsep lain dalam ${elemenLabel}?`,
          pilihan: [`Tidak ada perbedaan yang signifikan`, `${topik} memiliki aplikasi yang lebih spesifik`, `${topik} hanya berlaku di level tertentu`, `${topik} lebih sulit dari semua konsep lain`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Jika ${topik} diterapkan secara tidak tepat, apa dampak yang paling mungkin terjadi?`,
          pilihan: [`Tidak ada dampak berarti`, `Hasil analisis menjadi tidak valid`, `Proses menjadi lebih cepat`, `Kompleksitas berkurang drastis`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Manakah contoh penerapan ${topik} yang paling relevan?`,
          pilihan: [`Mengabaikan data yang tersedia`, `Menerapkan konsep tanpa konteks`, `Mengintegrasikan ${topik} dalam pemecahan masalah nyata`, `Mengganti ${topik} dengan metode yang tidak sesuai`],
          jawaban: 2,
        },
        {
          soal: `[${lv}] Indikator keberhasilan penguasaan ${topik} pada level ${lv} adalah?`,
          pilihan: [`Mampu menghafal definisi saja`, `Mampu menjelaskan dan memberikan contoh konkret`, `Mampu menyalin jawaban orang lain`, `Mampu menyelesaikan soal dengan cara cepat tanpa validasi`],
          jawaban: 1,
        },
        {
          soal: `[${lv}] Mengapa ${topik} penting untuk dipahami sebelum naik ke level berikutnya?`,
          pilihan: [`Karena hanya ada di level ini`, `Karena menjadi fondasi untuk konsep yang lebih kompleks`, `Karena tidak akan digunakan lagi setelah level ini`, `Karena lebih mudah dari konsep di level berikutnya`],
          jawaban: 1,
        },
      ],
    });

    // ── Helper: mock quiz_essay per level — 5 soal, shape object ───
    // Shape: { pertanyaan: Array<{ soal, rubrik }> }
    // QuizModal normalisasi: s.pertanyaan → soal (untuk essay), key 'soal' dipakai render
    const makeQuizEssay = (lv, topik) => ({
      pertanyaan: [
        {
          soal: `[${lv}] Jelaskan pengertian ${topik} dengan kata-katamu sendiri! Berikan minimal satu contoh konkret dari kehidupan sehari-hari.`,
          rubrik: `Skor penuh: mendefinisikan dengan benar dan memberikan contoh relevan. Skor sebagian: definisi benar tapi contoh kurang tepat.`,
        },
        {
          soal: `[${lv}] Bagaimana ${topik} berkaitan dengan ${elemenLabel}? Uraikan hubungannya secara sistematis minimal 3 poin.`,
          rubrik: `Skor penuh: minimal 3 keterkaitan jelas dan logis. Skor sebagian: 1-2 keterkaitan dengan penjelasan terbatas.`,
        },
        {
          soal: `[${lv}] Analisis situasi: Bagaimana kamu menerapkan ${topik} dalam memecahkan masalah nyata? Sebutkan langkah-langkahnya.`,
          rubrik: `Skor penuh: langkah-langkah sistematis dan aplikatif. Skor sebagian: langkah ada tapi kurang rinci atau logis.`,
        },
        {
          soal: `[${lv}] Apa tantangan terbesar dalam mempelajari ${topik} di level ${lv}? Bagaimana cara mengatasinya?`,
          rubrik: `Skor penuh: identifikasi tantangan spesifik dan solusi praktis. Skor sebagian: tantangan disebutkan tanpa solusi yang jelas.`,
        },
        {
          soal: `[${lv}] Buatlah ringkasan singkat tentang ${topik} yang bisa kamu jelaskan kepada teman yang baru belajar materi ini!`,
          rubrik: `Skor penuh: ringkasan mencakup inti konsep, mudah dipahami, dan akurat. Skor sebagian: mencakup sebagian inti tapi kurang jelas.`,
        },
      ],
    });

    // ── Helper: mock flashcard per level ───────────────────────────
    const makeFlashcard = (lv, topik) => ({
      cards: [
        { depan: `Apa definisi ${topik}?`, belakang: `${topik} adalah konsep dalam ${elemenLabel} yang menjelaskan hubungan antar elemen secara sistematis (Level ${lv}).` },
        { depan: `Sebutkan contoh penerapan ${topik}!`, belakang: `Contoh: ${topik} dapat ditemukan dalam perencanaan, pemecahan masalah, dan pengambilan keputusan sehari-hari.` },
        { depan: `Mengapa ${topik} penting di level ${lv}?`, belakang: `Di level ${lv}, ${topik} membangun fondasi yang diperlukan untuk menghadapi konsep lebih kompleks berikutnya.` },
      ],
      source: `Buku Teks ${elemenLabel} — Kemendikbud 2022`, // CONTRACT V3.6: source adalah string, bukan array
    });

    // ── Helper: mock game item — CONTRACT V3.6 §11 + V3.4 §1
    // game_id deterministik: hash dari mapel+elemen+level — stabil lintas request.
    const makeGame = (lv, topik, mapel) => {
      const deterministicId = `g_${mapel}_${elemenId}_${lv.toLowerCase()}`;
      const html_string = `<!DOCTYPE html><html>...(mock game html level ${lv})...</html>`;
      return {
        game_id: deterministicId,
        tipe: 'game',
        level: lv.toLowerCase(),
        content: {
          status: 'ready',
          html_string,           // ← sesuai contract baru: html_string dari DB BE
          game_selesai: false,
          selesai_at: null,
        },
      };
    };

    // ── Build konten_list: 16 item ─────────────────────────────────
    // bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 + game×3 = 16
    const kontenList = [
      ...LVLS.map(lv => ({ tipe: 'bacaan', level: lv, content: makeBacaan(lv, topikLabel), approved: true })),
      ...LVLS.map(lv => ({ tipe: 'quiz_pg', level: lv, content: makeQuizPG(lv, topikLabel), approved: true })),
      ...LVLS.map(lv => ({ tipe: 'quiz_essay', level: lv, content: makeQuizEssay(lv, topikLabel), approved: true })),
      ...LVLS.map(lv => ({ tipe: 'flashcard', level: lv, content: makeFlashcard(lv, topikLabel), approved: true })),
      { tipe: 'mindmap', level: null, content: { content: `[Mindmap] Topik: ${topikLabel}\n├─ Definisi\n│  ├─ Pengertian dasar\n│  └─ Komponen utama\n├─ Hubungan dengan ${elemenLabel}\n│  ├─ Keterkaitan konsep\n│  └─ Aplikasi konteks\n├─ Contoh & Penerapan\n│  ├─ Kasus nyata\n│  └─ Simulasi\n└─ Evaluasi\n   ├─ Latihan soal\n   └─ Indikator penguasaan` }, approved: true },
      // game×3 — makeGame sudah return objek lengkap dengan tipe, level, content
      // CONTRACT baru: html_string sudah disertakan di content item game (diambil dari DB BE)
      ...LVLS.map(lv => makeGame(lv, topikLabel, mapelId)),
    ];

    return HttpResponse.json([{
      publish_id: `pub_${mapelId}_${elemenId}_mock`,
      mapel_id: mapelId,
      elemen_id: elemenId,
      elemen_label: elemenLabel,
      materi: materiIdParam || null,
      materi_id: materiIdParam
        ? `${mapelId}__${materiIdParam.toLowerCase().replace(/\s+/g, '_')}`
        : null,
      kelas_id: 'x1',
      jenjang: 'X',
      published_at: new Date(Date.now() - 86400000).toISOString(),
      konten_list: kontenList,
    }]);
  }),

  // GET /content/progress/siswa
  // Params: { siswa_id }
  // Sesuai contract: endpoint terpisah untuk siswa vs guru
  // [V2 DEAD CODE] — Diganti /siswa/:id/progress (§11). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.get(url('/content/progress/siswa'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const siswaId = p.get('siswa_id') || 'unknown';
    await d(300);
    const { monthly, selesai, dalam_proses, rata, seed } = getStudentScore(siswaId, 'monthly');
    const total_topik = selesai + dalam_proses;
    const sudahSelesaiIds = Array.from({ length: selesai }, (_, i) => `mat__elemen_${i + 1}`);
    const belumSelesaiIds = Array.from({ length: dalam_proses }, (_, i) => `mat__elemen_${selesai + i + 1}`);
    return HttpResponse.json({
      siswa_id: siswaId,
      streak_hari: 1 + (seed % 10),
      total_topik,
      total_poin_quiz: monthly,
      total_durasi_menit: selesai * 45 + dalam_proses * 20,
      rata_rata_quiz: rata,
      selesai,
      dalam_proses,
      belum_dimulai: 2 + (seed % 4),
      by_mapel: [
        { mapel_id: 'mat', mapel_label: 'Matematika', selesai: Math.min(selesai, 2), progress_avg: 60 + (seed % 35) },
        { mapel_id: 'ipa', mapel_label: 'IPA', selesai: Math.max(0, selesai - 2), progress_avg: 55 + (seed % 40) },
        { mapel_id: 'bin', mapel_label: 'B. Indonesia', selesai: Math.max(0, selesai - 3), progress_avg: 50 + (seed % 45) },
      ],
      sudah_selesai_ids: sudahSelesaiIds,
      belum_selesai_ids: belumSelesaiIds,
    });
  }),

  // GET /content/progress/guru
  // Params: { kelas_id, mapel_id? }
  // Mengembalikan progress semua siswa di kelas untuk monitoring guru
  // [V2 DEAD CODE] — Diganti /kelas/:id/progress (§10). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.get(url('/content/progress/guru'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const kelasId = p.get('kelas_id') || 'x1';
    const mapelId = p.get('mapel_id') || 'mat';
    await d(400);
    const kelasStudents = store.siswa.filter(s => s.kelas_id === kelasId).slice(0, 30);
    const siswaProgress = kelasStudents.map(s => {
      const { monthly, rata, seed } = getStudentScore(s.id, 'monthly');
      return {
        siswa_id: s.id,
        nama: s.nama,
        avatar: s.avatar || null,
        elemen_id: 'bil_aljabar',
        elemen_label: 'Bilangan dan Aljabar',
        materi: 'Persamaan Linear',
        materi_id: `${mapelId}__persamaan_linear`,
        level: seed % 3 === 0 ? 'low' : seed % 3 === 1 ? 'mid' : 'high', // CONTRACT V3.5 §2: lowercase
        nilai_terakhir: monthly > 0 ? rata : null,
        durasi_menit: 20 + (seed % 40),
        last_active: new Date(Date.now() - (seed % 3600000)).toISOString(),
        aktif: seed % 4 !== 0,
      };
    });
    return HttpResponse.json({
      kelas_id: kelasId,
      mapel_id: mapelId,
      total_siswa: siswaProgress.length,
      aktif_hari_ini: siswaProgress.filter(s => s.aktif).length,
      rata_rata_progress: Math.round(siswaProgress.reduce((a, s) => a + (s.nilai_terakhir || 0), 0) / (siswaProgress.length || 1)),
      siswa: siswaProgress,
    });
  }),



  // POST /content/quiz/submit
  // Body: { siswa_id, publish_id, mapel_id, elemen_id, elemen_label,
  //          materi?, materi_id?, quiz_type, level, answers, score, essay_score? }
  // elemen_id WAJIB — backend pakai ini untuk update progress per elemen
  // publish_id WAJIB — backend pakai ini untuk tracing ke paket konten asal
  //
  // REVISI FASE 3 — Sistem Penilaian Agregasi:
  //   • quiz_type "mc"    → score = 0–100 (dihitung frontend dari jawaban benar)
  //   • quiz_type "essay" → score dikirim sebagai 0 saat submit, dinilai tim RAG secara async
  //                         Backend kembalikan essay_score (0–100) saat RAG selesai
  //   • Naik level jika rata-rata(mc_score, essay_score) >= KKM_BARU (75)
  //   • Logika agregasi final ada di backend; mock mensimulasikan response RAG essay
  // [V2 DEAD CODE] — Diganti /siswa/:id/quiz/mc dan /essay (§11). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.post(url('/content/quiz/submit'), async ({ request }) => {
    const body = await request.json();
    const { score, quiz_type, elemen_id, siswa_id, level } = body;
    await d(quiz_type === 'essay' ? 800 : 300); // essay butuh lebih lama (simulasi RAG)

    // Untuk essay: mock Tim RAG memberi skor 60–95 secara acak (simulasi penilaian AI)
    // Di produksi: backend antre ke RAG pipeline, hasil essay_score muncul async via webhook
    const essayScore = quiz_type === 'essay'
      ? Math.round(60 + Math.random() * 35) // RAG mock score 60–95
      : null;

    // Hitung agregasi jika essay — backend yang agregasi di produksi
    // Mock ini hanya mensimulasikan respons backend pasca penilaian RAG
    const KKM_BARU = 75; // KKM baru: rata-rata MC + essay >= 75
    const aggregatedScore = quiz_type === 'essay' && essayScore != null
      ? null // backend aggregate setelah mc_score tersimpan — tidak dihitung di sini
      : score ?? 0;

    // V3.1: hasil_quiz_id untuk CTA "Tanya Mentor AI"
    const hasilQuizId = `hq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    return HttpResponse.json({
      submitted: true,
      score: aggregatedScore ?? 0,
      quiz_type: quiz_type || 'mc',
      elemen_id: elemen_id || '',
      level: (level || 'low').toLowerCase(), // CONTRACT V3.5 §2
      // essay_score: skor RAG untuk essay (null jika MC)
      essay_score: essayScore,
      // kkm: KKM baru yang dipakai untuk naik level (dikirim ke frontend untuk display)
      kkm: KKM_BARU,
      // pending_aggregation: true jika essay baru saja disubmit, perlu tunggu mc_score juga
      pending_aggregation: quiz_type === 'essay',
      recorded_at: nowISO(),
      // V3.1: opaque ID untuk CTA "Tanya Mentor AI"
      hasil_quiz_id: hasilQuizId,
    });
  }),

  // GET /content/riwayat
  // Params: { guru_id, mapel_id? }
  // Response: RiwayatKontenItem[] (urut published_at DESC)
  // Dipakai RiwayatKontenSection. Jika store kosong, kembalikan seed dummy
  // dengan shape IDENTIK agar UI konsisten saat mock dimatikan nanti.
  // [V2 DEAD CODE] — Diganti /guru/:id/konten (§10). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.get(url('/content/riwayat'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const guruId = p.get('guru_id');
    const mapelId = p.get('mapel_id');
    await d(400);

    let hasil = [...store.publishedKonten];
    if (guruId) hasil = hasil.filter(r => r.guru_id === guruId);
    if (mapelId) hasil = hasil.filter(r => r.mapel_id === mapelId);

    // Fallback seed — shape identik RiwayatKontenItem
    // konten_list berisi 16 item (5 tipe × level + game×3)
    if (hasil.length === 0) {
      const LVLS = ['low', 'mid', 'high']; // CONTRACT V3.5 §2: lowercase
      const makeKL = (seedSiswaSelesai = {}) => [
        ...LVLS.map(lv => ({
          tipe: 'bacaan', level: lv,
          content: {
            text: `# Persamaan Linear\n\nKonten bacaan level ${lv} untuk Persamaan Linear.\n\n## Pengertian\nPersamaan linear adalah persamaan yang variabelnya berpangkat satu.\n\n## Contoh\n$2x + 3 = 7$ → $x = 2$`,
            source: 'Matematika SMA Kelas X — Kemendikbud 2022', // CONTRACT V3.6: source adalah string, bukan array
          },
          approved: true,
        })),
        ...LVLS.map(lv => ({ tipe: 'quiz_pg', level: lv, content: { soal: [] }, approved: true })),
        ...LVLS.map(lv => ({ tipe: 'quiz_essay', level: lv, content: { pertanyaan: [] }, approved: true })),
        ...LVLS.map(lv => ({
          tipe: 'flashcard', level: lv,
          content: {
            cards: [
              { depan: 'Apa itu Persamaan Linear?', belakang: 'Persamaan berderajat satu dengan satu atau lebih variabel.' },
              { depan: 'Contoh Persamaan Linear', belakang: '$2x + 3 = 7$ → selesaikan dengan mengisolasi variabel $x$.' },
            ],
            source: 'Matematika SMA Kelas X — Kemendikbud 2022', // CONTRACT V3.6: source adalah string, bukan array
          },
          approved: true,
        })),
        { tipe: 'mindmap', level: null, content: { content: '' }, approved: true },
        // game per level — CONTRACT V3.6 §11: game_selesai + selesai_at
        ...LVLS.map(lv => ({
          game_id: `g_seed_mat_bil_aljabar_${lv}`,  // ← game_id di level item
          tipe: 'game', level: lv,
          content: {
            status: 'ready',
            html_string: `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0fdf4"><div style="text-align:center"><div style="font-size:48px">🎮</div><h2>Game Seed Level ${lv}</h2><button onclick="window.parent.postMessage({type:'game:selesai'},'*')" style="background:#0d9488;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:16px">Selesai</button></div></body></html>`,
            game_selesai: (seedSiswaSelesai[lv] || []).length > 0,
            selesai_at: (seedSiswaSelesai[lv] || [])[0]?.selesai_at ?? null,
            siswa_selesai: seedSiswaSelesai[lv] || [],
          },
          approved: true,
        })),
      ];
      const seeds = [
        {
          publish_id: 'rk_seed_1', guru_id: guruId || 'g1',
          mapel_id: 'mat', mapel_label: 'Matematika', mapel_icon: '📐',
          elemen_id: 'bil_aljabar', elemen_label: 'Bilangan dan Aljabar',
          materi: 'Persamaan Linear', materi_id: 'mat__persamaan_linear',
          kelas_id: 'x1', kelas_nama: 'X-1', jenjang: 'X',
          atp: 'Siswa mampu menjelaskan konsep Persamaan Linear\nSiswa dapat menyelesaikan Persamaan Linear dengan satu langkah\nSiswa dapat mengaplikasikan pada soal cerita sederhana',
          published_at: new Date('2026-04-14T09:32:00').toISOString(),
          konten_list: makeKL({
            // 5 siswa sudah menyelesaikan — cukup untuk test avatar stack + modal
            Low: [
              { siswa_id: 's1', selesai_at: '14 Apr, 09:45' },
              { siswa_id: 's2', selesai_at: '14 Apr, 10:02' },
              { siswa_id: 's3', selesai_at: '14 Apr, 10:15' },
            ],
            Mid: [
              { siswa_id: 's4', selesai_at: '14 Apr, 10:30' },
              { siswa_id: 's5', selesai_at: '14 Apr, 11:05' },
            ],
            High: [],
          }),
        },
        {
          publish_id: 'rk_seed_2', guru_id: guruId || 'g1',
          mapel_id: 'mat', mapel_label: 'Matematika', mapel_icon: '📐',
          elemen_id: 'data_statistika', elemen_label: 'Data dan Statistika',
          materi: 'Statistika Dasar', materi_id: 'mat__statistika_dasar',
          kelas_id: 'x2', kelas_nama: 'X-2', jenjang: 'X',
          atp: 'Siswa mampu menjelaskan konsep Statistika Dasar\nSiswa dapat mengolah data statistika sederhana',
          published_at: new Date('2026-04-09T14:15:00').toISOString(),
          konten_list: makeKL({
            Low: [{ siswa_id: 's10', selesai_at: '9 Apr, 14:30' }],
            Mid: [],
            High: [],
          }),
        },
        {
          publish_id: 'rk_seed_3', guru_id: guruId || 'g1',
          mapel_id: 'mat', mapel_label: 'Matematika', mapel_icon: '📐',
          elemen_id: 'geometri', elemen_label: 'Geometri dan Pengukuran',
          materi: 'Fungsi Kuadrat', materi_id: 'mat__fungsi_kuadrat',
          kelas_id: 'x3', kelas_nama: 'X-3', jenjang: 'X',
          atp: 'Siswa mampu menjelaskan konsep Fungsi Kuadrat\nSiswa dapat menyelesaikan Fungsi Kuadrat\nSiswa dapat mengaplikasikan Fungsi Kuadrat pada soal cerita',
          published_at: new Date('2026-04-04T11:00:00').toISOString(),
          konten_list: makeKL(), // belum ada yang main
        },
      ];
      hasil = mapelId ? seeds.filter(s => s.mapel_id === mapelId) : seeds;
    }

    return HttpResponse.json(hasil);
  }),

  // POST /content/recommend  (Tim 3 RAG)
  // Body: { siswa_id, levels, completed_ids, in_progress_ids }
  // Response: Array<{ mapel_id, elemen_id, elemen_label, materi, materi_id, alasan }> maks 3
  // Sesuai flow .md: rekomendasi dari Tim 3 RAG berdasarkan progress siswa.
  // Saat RAG Tim 3 live, handler ini diganti dengan proxy ke endpoint RAG.
  // [V2 DEAD CODE] — Diganti /rag/rekomendasi (§16). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.post(url('/content/recommend'), async ({ request }) => {
    await d(600);
    const body = await request.json().catch(() => ({}));
    const completedIds = body.completed_ids || [];
    const inProgressIds = body.in_progress_ids || [];
    const usedIds = new Set([...completedIds, ...inProgressIds]);

    // Kumpulkan kandidat rekomendasi dari seluruh mapel + elemen + materi yang tersedia
    const allMapels = store.mapel.length > 0 ? store.mapel : ADMIN_MAPEL_LIST;
    const kandidat = [];
    for (const mapel of allMapels) {
      const elemenList = KURIKULUM_ELEMEN[mapel.id] || [];
      for (const elemen of elemenList) {
        const materiList = (MATERI_PER_ELEMEN[mapel.id] || {})[elemen.id] || [];
        if (materiList.length > 0) {
          // Elemen punya breakdown materi → rekomendasikan per materi
          for (const materi of materiList) {
            const snakeMateri = materi.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            const materi_id = `${mapel.id}__${snakeMateri}`;
            const topicKey = `${mapel.id}__${materi_id}`;
            if (!usedIds.has(topicKey)) {
              kandidat.push({
                mapel_id: mapel.id,
                elemen_id: elemen.id,
                elemen_label: elemen.label,
                materi,
                materi_id,
                alasan: `Topik yang sesuai dengan level progressmu saat ini`,
              });
            }
          }
        } else {
          // Elemen tidak punya breakdown materi → rekomendasikan elemen langsung
          const topicKey = `${mapel.id}__${elemen.id}`;
          if (!usedIds.has(topicKey)) {
            kandidat.push({
              mapel_id: mapel.id,
              elemen_id: elemen.id,
              elemen_label: elemen.label,
              materi: null,
              materi_id: null,
              alasan: `Topik yang sesuai dengan level progressmu saat ini`,
            });
          }
        }
        if (kandidat.length >= 10) break;
      }
      if (kandidat.length >= 10) break;
    }

    // Pastikan selalu ada 3 rekomendasi — jika kandidat kurang, ambil ulang tanpa filter
    let hasil = kandidat.slice(0, 3);
    if (hasil.length < 3) {
      for (const mapel of allMapels) {
        if (hasil.length >= 3) break;
        const elemenList = KURIKULUM_ELEMEN[mapel.id] || [];
        const elemen = elemenList[0];
        if (!elemen) continue;
        const materiList = (MATERI_PER_ELEMEN[mapel.id] || {})[elemen.id] || [];
        const materi = materiList[0] || null;
        const snakeMateri = materi ? materi.toLowerCase().replace(/[^a-z0-9]+/g, '_') : null;
        const materi_id = materi ? `${mapel.id}__${snakeMateri}` : null;
        const already = hasil.some(h => h.mapel_id === mapel.id && h.elemen_id === elemen.id);
        if (!already) {
          hasil.push({
            mapel_id: mapel.id,
            elemen_id: elemen.id,
            elemen_label: elemen.label,
            materi: materi || null,
            materi_id: materi_id || null,
            alasan: `Topik yang sesuai dengan level progressmu saat ini`,
          });
        }
      }
    }
    return HttpResponse.json(hasil.slice(0, 3));
  }),

  // GET /content/recommend  (fallback GET — redirect ke POST di FE sudah diperbaiki)
  // Tetap ada agar tidak 404 jika ada code lama yang masih pakai GET.
  // [V2 DEAD CODE] — Diganti /rag/rekomendasi (§16). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.get(url('/content/recommend'), async () => {
    await d(300);
    return HttpResponse.json([]);
  }),

  // ════════════════════════════════════════════════════════════════════
  // GET /content/pretest/status
  // Params: { siswa_id, mapel_id }
  // Mengembalikan status pretest siswa per elemen/materi dalam satu mapel.
  // Dipakai ProgressSection & PretestPage untuk menghidrasi store lokal
  // (pretestDoneElemen, pretestDoneMateri, studentLevels) dari data BE.
  // ════════════════════════════════════════════════════════════════════
  // [V2 DEAD CODE] — Diganti /siswa/:id/pretest/status (§11). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.get(url('/content/pretest/status'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const siswaId = p.get('siswa_id') || 'usr_001';
    const mapelId = p.get('mapel_id');
    await d(300);
    if (!mapelId) {
      return HttpResponse.json({ message: 'mapel_id wajib diisi.' }, { status: 400 });
    }
    // Bangun status dari KURIKULUM_ELEMEN — semua 'belum' by default.
    // Status 'selesai' hanya muncul setelah siswa benar-benar mengerjakan pretest
    // (POST /pretest/submit) dalam sesi ini. Mock tidak seed status apapun.
    const elemenList = (KURIKULUM_ELEMEN[mapelId] || []);
    const result = elemenList.map((el) => ({
      elemen_id: el.id,
      materi_id: null,
      status: 'belum',
      level: null,
    }));
    return HttpResponse.json(result);
  }),

  // ════════════════════════════════════════════════════════════════════
  // GET /content/quiz/history
  // Params: { siswa_id, elemen_id, materi_id? }
  // Mengembalikan riwayat quiz siswa per level untuk satu elemen/materi.
  // Dipakai ChatSection saat topik dibuka untuk menghidrasi quizHistory
  // dan current_level (levelMap) dari BE.
  // locked: true = level sudah dilewati (siswa naik level), read-only.
  // ════════════════════════════════════════════════════════════════════
  // [V2 DEAD CODE] — Diganti /siswa/:id/quiz (§11). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.get(url('/content/quiz/history'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const siswaId = p.get('siswa_id') || 'usr_001';
    const elemenId = p.get('elemen_id');
    const materiId = p.get('materi_id') || null;
    await d(300);
    if (!elemenId) {
      return HttpResponse.json({ message: 'elemen_id wajib diisi.' }, { status: 400 });
    }
    // Seed: siswa dengan id 'usr_001' punya riwayat quiz di level low untuk beberapa elemen
    const hasSeedHistory = siswaId === 'usr_001' && ['bil_aljabar', 'data_statistika'].includes(elemenId);
    if (!hasSeedHistory) {
      return HttpResponse.json({ current_level: 'low', history: [] });
    }
    // Seed riwayat: low selesai (naik ke mid), mid belum selesai
    return HttpResponse.json({
      current_level: 'mid',
      history: [
        { type: 'mc', level: 'low', score: 85, locked: true, ts: new Date(Date.now() - 86400000).toISOString() },
        { type: 'essay', level: 'low', score: 78, locked: true, ts: new Date(Date.now() - 86400000).toISOString() },
        { type: 'mc', level: 'mid', score: 60, locked: false, ts: new Date(Date.now() - 3600000).toISOString() },
      ],
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // PRETEST — Tim 3 RAG
  // Sesuai flow .md: "sistem memanggil API Tim 3 RAG untuk mengambil soal pretest (5 soal)"
  // POST /content/pretest/soal  → kirim { siswa_id, mapel_id, elemen_id, materi_id? }
  // POST /content/pretest/submit → kirim jawaban, Tim 3 kembalikan level
  // ════════════════════════════════════════════════════════════════════

  // [V2 DEAD CODE] — Diganti /pretest/soal (§14). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.post(url('/content/pretest/soal'), async ({ request }) => {
    await d(800);
    const { elemen_id = 'umum', mapel_id = 'mat' } = await request.json().catch(() => ({}));
    // Gunakan label elemen dari KURIKULUM_ELEMEN agar soal kontekstual
    const elemenList = KURIKULUM_ELEMEN[mapel_id] || [];
    const elemenMeta = elemenList.find(e => e.id === elemen_id) || { label: elemen_id };
    const elemenLabel = elemenMeta.label;
    const PILIHAN_PRETEST = [
      'Belum pernah mempelajari topik ini sama sekali',
      'Pernah mendengar tapi belum memahami konsepnya',
      'Sudah memahami sebagian konsep dasar',
      'Sudah memahami dan bisa menerapkan konsepnya',
    ];
    const TEMPLATE_SOAL = [
      `Seberapa familiar kamu dengan topik "${elemenLabel}"?`,
      `Pernahkah kamu mempelajari konsep-konsep dalam "${elemenLabel}" sebelumnya?`,
      `Seberapa percaya diri kamu mengerjakan soal tentang "${elemenLabel}"?`,
      `Apakah kamu bisa menjelaskan konsep dasar dari "${elemenLabel}"?`,
      `Bagaimana penilaianmu terhadap kemampuanmu dalam "${elemenLabel}"?`,
    ];
    // Field 'soal' (bukan 'pertanyaan') — konsisten dengan PretestPage.jsx yang render s.soal
    // Field 'jawaban' adalah index integer — konsisten dengan choosePilihan di PretestPage
    const soal = Array.from({ length: 5 }, (_, i) => ({
      id: `pretest_${mapel_id}_${elemen_id}_${i + 1}`,
      soal: TEMPLATE_SOAL[i],
      pilihan: PILIHAN_PRETEST,
      jawaban: 2, // index jawaban "benar" untuk self-assessment (sudah paham sebagian)
    }));
    return HttpResponse.json({
      sesi_pretest_id: `pretest_${Date.now()}_${elemen_id}`,
      soal,
    });
  }),

  // [V2 DEAD CODE] — Diganti /pretest/submit (§14). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.post(url('/content/pretest/submit'), async ({ request }) => {
    await d(600);
    const { answers = {} } = await request.json().catch(() => ({}));
    const totalSoal = 5;
    // Hitung benar: jawaban benar adalah index 2 atau 3 (sudah paham sebagian/penuh)
    // answers = Record<soal_key, index_string> — FE mengirim String(piIdx)
    const benar = Object.values(answers).filter(a => Number(a) >= 2).length;
    const score = Math.round((benar / totalSoal) * 100);
    // Tentukan level: >=80 → high, >=60 → mid, <60 → low
    const level = score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
    return HttpResponse.json({ level, score, benar, total: totalSoal });
  }),

  // ════════════════════════════════════════════════════════════════════
  // RAG INSIGHT — Tim 3 RAG
  // POST /content/insight
  // Sesuai flow .md: "insight di handle oleh tim 3 RAG (bukan tim 5 mentor)"
  // Body KPI: { siswa_id, nama, streak, total_topik, total_poin_kuiz, total_durasi }
  // Response: { text: string }
  // ════════════════════════════════════════════════════════════════════

  // [V2 DEAD CODE] — Diganti /rag/insight (§16). Masih dipakai bridge V3. Hapus setelah integrasi BE.
  http.post(url('/content/insight'), async ({ request }) => {
    await d(500);
    const { nama = 'Siswa', streak = 0, total_topik = 0, total_poin_kuiz = 0 } =
      await request.json().catch(() => ({}));
    const insights = [
      `🚀 Keren, ${nama}! Streak ${streak} hari berturut-turut — konsistensimu luar biasa!`,
      `📚 ${nama}, kamu sudah menguasai ${total_topik} topik dengan total ${total_poin_kuiz} poin. Terus tingkatkan!`,
      `⚡ Progresmu terus meningkat, ${nama}! Setiap sesi belajar membawa kamu selangkah lebih dekat ke tujuan.`,
      `🌟 ${nama}, hasil quizmu mencerminkan kerja kerasmu. Jaga semangat belajar ini!`,
      `💡 Kamu sudah aktif belajar ${streak} hari berturut-turut, ${nama}. Pertahankan ritme ini!`,
    ];
    // Pilih insight berdasarkan kondisi KPI
    let text;
    if (streak >= 7) text = insights[0];
    else if (total_topik >= 5) text = insights[1];
    else if (total_poin_kuiz >= 200) text = insights[3];
    else text = insights[Math.floor(Math.random() * insights.length)];
    return HttpResponse.json({ text });
  }),

  // ════════════════════════════════════════════════════════════════════
  // EMOTION — Tim 1
  // ════════════════════════════════════════════════════════════════════

  // POST /emotion/detect
  // Body: { siswa_id, frame_base64, session_id? }
  // [V2 DEAD CODE] — Diganti /emosi/deteksi (§18). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  // 5 label emosi: antusias | bosan | bingung | frustrasi | tidak_terdeteksi
  // Distribusi probabilitas dibuat realistis: tidak_terdeteksi ~15%, lainnya merata
  http.post(url('/emotion/detect'), async () => {
    await d(300);
    // Weighted random: antusias 25%, bosan 25%, bingung 20%, frustrasi 15%, tidak_terdeteksi 15%
    const weighted = [
      'antusias', 'antusias', 'antusias', 'antusias', 'antusias',
      'bosan', 'bosan', 'bosan', 'bosan', 'bosan',
      'bingung', 'bingung', 'bingung', 'bingung',
      'frustrasi', 'frustrasi', 'frustrasi',
      'tidak_terdeteksi', 'tidak_terdeteksi', 'tidak_terdeteksi',
    ];
    const emosi = weighted[Math.floor(Math.random() * weighted.length)];
    // tidak_terdeteksi punya confidence rendah (kamera buram/tidak ada wajah)
    const confidence = emosi === 'tidak_terdeteksi'
      ? +(0.30 + Math.random() * 0.30).toFixed(2)
      : +(0.68 + Math.random() * 0.30).toFixed(2);
    return HttpResponse.json({ emosi, confidence, timestamp: nowISO() });
  }),

  // GET /emotion/history
  // Params: { siswa_id, session_id }
  // Return array EmotionResult terurut dari terlama ke terbaru
  // Mensimulasikan tren emosi yang berubah selama sesi belajar
  // [V2 DEAD CODE] — Diganti /sesi/:id/emosi (§13). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.get(url('/emotion/history'), async () => {
    const now = Date.now();
    await d(300);
    return HttpResponse.json([
      { emosi: 'tidak_terdeteksi', confidence: 0.45, timestamp: new Date(now - 300000).toISOString() },
      { emosi: 'bosan', confidence: 0.72, timestamp: new Date(now - 240000).toISOString() },
      { emosi: 'bingung', confidence: 0.84, timestamp: new Date(now - 180000).toISOString() },
      { emosi: 'bingung', confidence: 0.79, timestamp: new Date(now - 120000).toISOString() },
      { emosi: 'antusias', confidence: 0.91, timestamp: new Date(now - 60000).toISOString() },
      { emosi: 'antusias', confidence: 0.88, timestamp: new Date(now - 10000).toISOString() },
    ]);
  }),

  // ════════════════════════════════════════════════════════════════════
  // GAME — Tim 4
  // Hirarki: mapel → elemen → materi (opsional, jika guru turun ke level materi)
  // Tim 4 deliver game dalam format HTML — frontend render via <iframe src={html_url}>
  // ════════════════════════════════════════════════════════════════════

  // POST /game/generate — CONTRACT V3.4 §1: html_string (bukan html_url)
  // Body: { mapel_id, elemen_id, elemen_label, materi?, materi_id?, kelas_id, level, jenjang?, atp }
  http.post(url('/game/generate'), async ({ request }) => {
    const { mapel_id, elemen_id, elemen_label, materi, materi_id, level } = await request.json();
    await d(2500);
    const topik = materi || elemen_label || 'Pelajaran';
    const game_id = 'game_' + Date.now();
    const levelLc = (level || 'low').toLowerCase(); // CONTRACT V3.5 §2: lowercase
    const html_string = `<!DOCTYPE html><html><head><title>Game Mock: ${game_id}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#FFFFFF"><div style="text-align:center"><div style="font-size:48px">🎮</div><h2 style="color:#0d9488">Game Mock</h2><p style="color:#374151">Topik: ${topik}</p><p style="color:#6b7280;font-size:14px">Level: ${levelLc}</p><button onclick="window.parent.postMessage({type:'game:selesai'},'*')" style="background:#0d9488;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:16px">Selesai Game (Mock)</button></div></body></html>`; // CONTRACT V3.4 §1
    return HttpResponse.json({
      data: {
        game_id,
        nama: `Quest: ${topik}`,
        deskripsi: `Game edukasi interaktif tentang ${topik} — level ${levelLc}`,
        mapel_id: mapel_id || '',
        elemen_id: elemen_id || '',
        elemen_label: elemen_label || '',
        materi: materi || null,
        materi_id: materi_id || null,
        level: levelLc,
        status: 'ready',
        html_string,
      }, meta: null, error: null
    });
  }),

  // V3.3: POST /game/regenerate — CONTRACT V3.4 §1: html_string + envelope
  http.post(url('/game/regenerate'), async ({ request }) => {
    const body = await request.json();
    await d(1800);
    const { game_id, instruksi_revisi } = body;
    if (!game_id) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'VALIDATION_ERROR', message: 'game_id wajib diisi.' } },
        { status: 400 }
      );
    }
    const levelLc = (body.level || 'low').toLowerCase(); // CONTRACT V3.5 §2
    const html_string = `<!DOCTYPE html><html><head><title>Game Mock (Revised)</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0fdf4"><div style="text-align:center"><div style="font-size:48px">🎮</div><h2 style="color:#0d9488">Game Mock (Revised)</h2><p style="color:#374151">${instruksi_revisi || 'Versi baru'}</p><button onclick="window.parent.postMessage({type:'game:selesai'},'*')" style="background:#0d9488;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:16px">Selesai Game (Mock)</button></div></body></html>`; // CONTRACT V3.4 §1
    return HttpResponse.json({
      data: {
        game_id,
        nama: `Quest (Revised)`,
        deskripsi: `Game edukasi interaktif — diperbarui: ${instruksi_revisi}`,
        level: levelLc,
        status: 'ready',
        html_string,
      }, meta: null, error: null
    });
  }),

  // GET /game/list
  // [V2 DEAD CODE] — Diganti /game/:id (§17). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  // Params: { kelas_id?, mapel_id?, elemen_id?, materi_id? }
  // html_url tidak disertakan di list — fetch GET /:id untuk dapat html_url
  http.get(url('/game/list'), async ({ request }) => {
    await d(400);
    const p = new URL(request.url).searchParams;
    const filterMapel = p.get('mapel_id');
    const filterElemen = p.get('elemen_id');
    const games = [
      {
        game_id: 'g1',
        nama: 'Algebraic Quest',
        deskripsi: 'Selesaikan persamaan untuk mengalahkan musuh!',
        mapel_id: 'mat',
        elemen_id: 'bil_aljabar',
        elemen_label: 'Bilangan dan Aljabar',
        materi: 'Persamaan Linear Satu Variabel',
        materi_id: 'mat__persamaan_linear_satu_variabel',
        level: 'mid', // CONTRACT V3.5 §2
        status: 'ready',
        pemain: 24,
      },
      {
        game_id: 'g2',
        nama: 'Data Explorer',
        deskripsi: 'Jelajahi dunia statistika lewat petualangan data!',
        mapel_id: 'mat',
        elemen_id: 'data_statistika',
        elemen_label: 'Data dan Statistika',
        materi: null,
        materi_id: null,
        level: 'low', // CONTRACT V3.5 §2
        status: 'ready',
        pemain: 18,
      },
      {
        game_id: 'g3',
        nama: 'Bio Cell Wars',
        deskripsi: 'Pertahankan sel dari serangan virus dalam simulasi biologi!',
        mapel_id: 'bio',
        elemen_id: 'pemahaman_bio',
        elemen_label: 'Pemahaman Biologi',
        materi: 'Sel dan Organel Sel',
        materi_id: 'bio__sel_dan_organel_sel',
        level: 'high', // CONTRACT V3.5 §2
        status: 'ready',
        pemain: 11,
      },
    ];
    // Filter sesuai params yang dikirim
    const filtered = games.filter(g =>
      (!filterMapel || g.mapel_id === filterMapel) &&
      (!filterElemen || g.elemen_id === filterElemen)
    );
    return HttpResponse.json(filtered);
  }),

  // POST /game/selesai
  // Body: { siswa_id, game_id, level }
  // Catat bahwa siswa menyelesaikan game di level tertentu.
  // [V2 DEAD CODE] — Diganti PATCH /game/:id/penyelesaian (§17). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  // Data ini akan di-embed di konten_list[tipe=game].content.siswa_selesai
  // saat guru GET /content/riwayat — format: { siswa_id, selesai_at }
  http.post(url('/game/selesai'), async ({ request }) => {
    const body = await request.json();
    await d(300);
    const { siswa_id, game_id, level } = body;
    if (!siswa_id || !game_id || !level) {
      return HttpResponse.json({ message: 'siswa_id, game_id, dan level wajib diisi.' }, { status: 400 });
    }
    return HttpResponse.json({
      recorded: true,
      game_id,
      siswa_id,
      level,
      selesai_at: nowISO(),
    }, { status: 201 });
  }),

  // GET /game/:game_id — CONTRACT V3.4 §1: html_string untuk iframe; CONTRACT V3.6 §1.3: envelope
  // Mengembalikan detail lengkap termasuk html_string untuk iframe
  http.get(url('/game/:game_id'), async ({ params }) => {
    await d(300);
    // Seed data untuk game_id yang sudah ada — level lowercase CONTRACT V3.5 §2
    const seed = {
      g1: { nama: 'Algebraic Quest', deskripsi: 'Selesaikan persamaan untuk mengalahkan musuh!', mapel_id: 'mat', elemen_id: 'bil_aljabar', elemen_label: 'Bilangan dan Aljabar', materi: 'Persamaan Linear Satu Variabel', materi_id: 'mat__persamaan_linear_satu_variabel', level: 'mid' }, // CONTRACT V3.5 §2
      g2: { nama: 'Data Explorer', deskripsi: 'Jelajahi dunia statistika lewat petualangan data!', mapel_id: 'mat', elemen_id: 'data_statistika', elemen_label: 'Data dan Statistika', materi: null, materi_id: null, level: 'low' }, // CONTRACT V3.5 §2
      g3: { nama: 'Bio Cell Wars', deskripsi: 'Pertahankan sel dari serangan virus dalam simulasi biologi!', mapel_id: 'bio', elemen_id: 'pemahaman_bio', elemen_label: 'Pemahaman Biologi', materi: 'Sel dan Organel Sel', materi_id: 'bio__sel_dan_organel_sel', level: 'high' }, // CONTRACT V3.5 §2
    };
    const data = seed[params.game_id] || { nama: 'Game Edukasi', deskripsi: 'Game edukasi interaktif.', mapel_id: 'mat', elemen_id: 'bil_aljabar', elemen_label: 'Bilangan dan Aljabar', materi: null, materi_id: null, level: 'low' };
    const html_string = `<!DOCTYPE html><html><head><title>Game: ${params.game_id}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0fdf4"><div style="text-align:center"><div style="font-size:48px">🎮</div><h2 style="color:#0d9488">${data.nama || 'Game Edukasi'}</h2><p style="color:#374151">Level: ${data.level}</p><button onclick="window.parent.postMessage({type:'game:selesai'},'*')" style="background:#0d9488;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:16px">Selesai Game (Mock)</button></div></body></html>`; // CONTRACT V3.4 §1
    return envelope({ // CONTRACT V3.6 §1.3
      game_id: params.game_id,
      ...data,
      status: 'ready',
      html_string,
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Kelas (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/kelas
  http.get(url('/admin/kelas'), async () => {
    await d(300);
    return HttpResponse.json({ data: store.kelas, meta: null, error: null });
  }),

  // GET /admin/kelas/:id
  http.get(url('/admin/kelas/:id'), async ({ params }) => {
    await d(200);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ data: null, meta: null, error: 'Kelas tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json({ data: kelas, meta: null, error: null });
  }),

  // GET /admin/kelas/:id/siswa
  http.get(url('/admin/kelas/:id/siswa'), async ({ params }) => {
    await d(300);
    const kelas = store.kelas.find(k => k.id === params.id);
    const ids = kelas?.siswa_ids || [];
    const siswa = ids.map(sid => store.siswa.find(s => s.id === sid)).filter(Boolean);
    return HttpResponse.json({ data: siswa, meta: null, error: null });
  }),

  // POST /admin/kelas
  http.post(url('/admin/kelas'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const newK = { ...body, id: 'k_' + Date.now(), siswa_ids: [], jumlah_siswa: 0 };
    store.kelas.push(newK);
    return HttpResponse.json({ data: newK, meta: null, error: null }, { status: 201 });
  }),

  // PATCH /admin/kelas/:id (V3.1 — was PUT)
  http.patch(url('/admin/kelas/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    store.kelas = store.kelas.map(k => k.id === params.id ? { ...k, ...body } : k);
    const updated = store.kelas.find(k => k.id === params.id);
    return updated
      ? HttpResponse.json({ data: updated, meta: null, error: null })
      : HttpResponse.json({ data: null, meta: null, error: 'Kelas tidak ditemukan.' }, { status: 404 });
  }),

  // DELETE /admin/kelas/:id
  http.delete(url('/admin/kelas/:id'), async ({ params }) => {
    await d(300);
    const exists = store.kelas.some(k => k.id === params.id);
    if (!exists) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    store.kelas = store.kelas.filter(k => k.id !== params.id);
    // Lepas referensi siswa ke kelas ini
    store.siswa = store.siswa.map(s =>
      s.kelas_id === params.id ? { ...s, kelas_id: null } : s
    );
    return HttpResponse.json({ data: { deleted: true }, meta: null, error: null });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Guru (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/guru
  http.get(url('/admin/guru'), async () => {
    await d(300);
    const enriched = store.guru.map(g => enrichGuruWithKelasMap(g, store.kelas));
    return HttpResponse.json({ data: enriched, meta: null, error: null });
  }),

  // GET /admin/guru/:id
  http.get(url('/admin/guru/:id'), async ({ params }) => {
    await d(200);
    const guru = store.guru.find(g => g.id === params.id);
    if (!guru) return HttpResponse.json({ data: null, meta: null, error: 'Guru tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json({ data: enrichGuruWithKelasMap(guru, store.kelas), meta: null, error: null });
  }),

  // POST /admin/guru
  http.post(url('/admin/guru'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const newG = {
      ...body,
      id: 'g_' + Date.now(),
      avatar: (body.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    };
    store.guru.push(newG);
    return HttpResponse.json({ data: enrichGuruWithKelasMap(newG, store.kelas), meta: null, error: null }, { status: 201 });
  }),

  // PATCH /admin/guru/:id (V3.1 — was PUT)
  http.patch(url('/admin/guru/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    store.guru = store.guru.map(g => g.id === params.id ? { ...g, ...body } : g);
    const updated = store.guru.find(g => g.id === params.id);
    return updated
      ? HttpResponse.json({ data: enrichGuruWithKelasMap(updated, store.kelas), meta: null, error: null })
      : HttpResponse.json({ data: null, meta: null, error: 'Guru tidak ditemukan.' }, { status: 404 });
  }),

  // DELETE /admin/guru/:id
  http.delete(url('/admin/guru/:id'), async ({ params }) => {
    await d(300);
    const exists = store.guru.some(g => g.id === params.id);
    if (!exists) return HttpResponse.json({ message: 'Guru tidak ditemukan.' }, { status: 404 });
    store.guru = store.guru.filter(g => g.id !== params.id);
    // Lepas wali kelas dari semua kelas yang menggunakan guru ini
    store.kelas = store.kelas.map(k =>
      k.wali_kelas_id === params.id
        ? { ...k, wali_kelas_id: null }
        : k
    );
    return HttpResponse.json({ data: { deleted: true }, meta: null, error: null });
  }),

  // POST /admin/guru/bulk
  // Multipart: { file }
  http.post(url('/admin/guru/bulk'), async () => {
    await d(1500);
    return HttpResponse.json({ total: 10, berhasil: 9, gagal: 1, errors: [{ row: 5, pesan: 'NIP sudah terdaftar.' }] });
  }),

  // GET /guru/:guruId — CONTRACT V3.6 §10
  // Profil guru untuk portal guru sendiri (bukan /admin/guru/:id).
  // Response berbeda: menyertakan kelas_aktif[] dan mapel_aktif[].
  http.get(url('/guru/:guruId'), async ({ params }) => {
    await d(200);
    const guru = store.guru.find(g => g.id === params.guruId);
    if (!guru) return HttpResponse.json({ data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Guru tidak ditemukan.' } }, { status: 404 });
    const mapelList = store.mapel || [];
    return HttpResponse.json({ data: buildGuruProfileV3(guru, store.kelas, mapelList), meta: null, error: null });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Siswa (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/siswa
  http.get(url('/admin/siswa'), async () => {
    await d(300);
    return HttpResponse.json({ data: store.siswa, meta: null, error: null });
  }),

  // GET /admin/siswa/:id
  http.get(url('/admin/siswa/:id'), async ({ params }) => {
    await d(200);
    const siswa = store.siswa.find(s => s.id === params.id);
    if (!siswa) return HttpResponse.json({ data: null, meta: null, error: 'Siswa tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json({ data: siswa, meta: null, error: null });
  }),

  // POST /admin/siswa
  http.post(url('/admin/siswa'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const kelasId = body.kelas_id;
    const newS = {
      ...body,
      id: 's_' + Date.now(),
      kelas_id: kelasId || null,
      status: body.status || 'Belum Aktif',
      is_first_login: true,
      bergabung: nowISO(),
      last_login: null,
      avatar: (body.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    };
    store.siswa.push(newS);
    if (kelasId) {
      store.kelas = store.kelas.map(k =>
        k.id === kelasId ? { ...k, siswa_ids: [...(k.siswa_ids || []), newS.id] } : k
      );
    }
    return HttpResponse.json({ data: newS, meta: null, error: null }, { status: 201 });
  }),

  // PATCH /admin/siswa/:id (V3.1 — was PUT)
  http.patch(url('/admin/siswa/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    const oldSiswa = store.siswa.find(s => s.id === params.id);
    if (!oldSiswa) return HttpResponse.json({ data: null, meta: null, error: 'Siswa tidak ditemukan.' }, { status: 404 });

    store.siswa = store.siswa.map(s => s.id === params.id ? { ...s, ...body } : s);

    // Update relasi kelas jika kelas_id berubah
    const newKelasId = body.kelas_id;
    const oldKelasId = oldSiswa.kelas_id;
    if (newKelasId && newKelasId !== oldKelasId) {
      if (oldKelasId) {
        store.kelas = store.kelas.map(k =>
          k.id === oldKelasId
            ? { ...k, siswa_ids: (k.siswa_ids || []).filter(sid => sid !== params.id) }
            : k
        );
      }
      store.kelas = store.kelas.map(k =>
        k.id === newKelasId
          ? { ...k, siswa_ids: [...(k.siswa_ids || []), params.id] }
          : k
      );
    }
    const result = store.siswa.find(s => s.id === params.id);
    return HttpResponse.json({ data: result, meta: null, error: null });
  }),

  // DELETE /admin/siswa/:id
  http.delete(url('/admin/siswa/:id'), async ({ params }) => {
    await d(300);
    const s = store.siswa.find(x => x.id === params.id);
    if (!s) return HttpResponse.json({ message: 'Siswa tidak ditemukan.' }, { status: 404 });
    store.siswa = store.siswa.filter(x => x.id !== params.id);
    const kelasId = s.kelas_id;
    if (kelasId) {
      store.kelas = store.kelas.map(k =>
        k.id === kelasId
          ? { ...k, siswa_ids: (k.siswa_ids || []).filter(sid => sid !== params.id) }
          : k
      );
    }
    return HttpResponse.json({ data: { deleted: true }, meta: null, error: null });
  }),

  // POST /admin/siswa/bulk
  // Multipart: { file, kelas_id }
  http.post(url('/admin/siswa/bulk'), async ({ request }) => {
    // Dalam mock: parse field kelas_id dari FormData jika perlu
    await d(1500);
    return HttpResponse.json({ total: 30, berhasil: 30, gagal: 0, errors: [] });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Mapel (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/mapel — V3.1: inject jumlah_elemen dari elemen store
  http.get(url('/admin/mapel'), async () => {
    await d(300);
    const enriched = store.mapel.map(m => {
      const elemenArr = m.elemen || KURIKULUM_ELEMEN[m.id] || [];
      return { ...m, jumlah_elemen: elemenArr.length };
    });
    return HttpResponse.json({ data: enriched, meta: null, error: null });
  }),

  // POST /admin/mapel — V3.1: envelope + tingkat field support
  http.post(url('/admin/mapel'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    let mapelId = body.id;
    if (store.mapel.some(m => m.id === mapelId)) {
      return HttpResponse.json({ data: null, meta: null, error: 'ID mapel sudah digunakan.' }, { status: 409 });
    }
    if (!mapelId) {
      mapelId = (body.label || 'mapel').toLowerCase()
        .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 12)
        + '_' + Date.now().toString().slice(-4);
    }
    const newM = { icon: '📚', ...body, id: mapelId, elemen: [] };
    store.mapel.push(newM);
    return HttpResponse.json({ data: { ...newM, jumlah_elemen: 0 }, meta: null, error: null }, { status: 201 });
  }),

  // PATCH /admin/mapel/:id (V3.1 — was PUT)
  http.patch(url('/admin/mapel/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    // id, tingkat tidak bisa diubah via PATCH — ignore jika terkirim
    const { id: _id, tingkat: _tingkat, ...patchFields } = body;
    store.mapel = store.mapel.map(m => m.id === params.id ? { ...m, ...patchFields } : m);
    const updated = store.mapel.find(m => m.id === params.id);
    if (!updated) return HttpResponse.json({ data: null, meta: null, error: 'Mapel tidak ditemukan.' }, { status: 404 });
    const elemenArr = updated.elemen || KURIKULUM_ELEMEN[params.id] || [];
    return HttpResponse.json({ data: { ...updated, jumlah_elemen: elemenArr.length }, meta: null, error: null });
  }),

  // DELETE /admin/mapel/:id
  http.delete(url('/admin/mapel/:id'), async ({ params }) => {
    await d(300);
    store.mapel = store.mapel.filter(m => m.id !== params.id);
    // Lepas mapel dari guru yang mengajarnya
    store.guru = store.guru.map(g => ({
      ...g,
      mapel_ids: (g.mapel_ids || []).filter(mid => mid !== params.id),
    }));
    return HttpResponse.json({ deleted: true });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Elemen V3.1 (nested: /admin/mapel/:mapel_id/elemen)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/mapel/:id — CONTRACT V3.6 §9.1
  // WAJIB sebelum GET /admin/mapel/:mapel_id/elemen agar tidak false match di MSW
  http.get(url('/admin/mapel/:id'), async ({ params }) => {
    await d(200);
    const mapel = store.mapel.find(m => m.id === params.id);
    if (!mapel) {
      return HttpResponse.json(
        { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Mapel tidak ditemukan.' } },
        { status: 404 }
      );
    }
    const elemenArr = (KURIKULUM_ELEMEN[params.id] || []).map(e => ({ id: e.id, label: e.label }));
    return envelope({ ...mapel, elemen: elemenArr });
  }),

  // GET /admin/mapel/:mapel_id/elemen
  http.get(url('/admin/mapel/:mapel_id/elemen'), async ({ params }) => {
    await d(250);
    const mapelId = params.mapel_id;
    const mapelObj = store.mapel.find(m => m.id === mapelId);
    const elemenArr = (mapelObj?.elemen) || KURIKULUM_ELEMEN[mapelId] || [];
    return HttpResponse.json({ data: elemenArr.map(e => ({ ...e, mapel_id: mapelId })), meta: null, error: null });
  }),

  // POST /admin/mapel/:mapel_id/elemen
  http.post(url('/admin/mapel/:mapel_id/elemen'), async ({ request, params }) => {
    const body = await request.json();
    await d(350);
    const mapelId = params.mapel_id;
    const mapelObj = store.mapel.find(m => m.id === mapelId);
    if (!mapelObj) return HttpResponse.json({ data: null, meta: null, error: 'Mapel tidak ditemukan.' }, { status: 404 });
    // V3.1: elemen hanya butuh { label }
    const label = body.label?.trim();
    if (!label) return HttpResponse.json({ data: null, meta: null, error: 'Label wajib diisi.' }, { status: 400 });
    const existingElemen = mapelObj.elemen || KURIKULUM_ELEMEN[mapelId] || [];
    if (existingElemen.some(e => e.label === label)) {
      return HttpResponse.json({ data: null, meta: null, error: 'Label elemen sudah ada di mapel ini.' }, { status: 409 });
    }
    const newId = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
      + '_' + Date.now().toString().slice(-4);
    const newEl = { id: newId, mapel_id: mapelId, label };
    mapelObj.elemen = [...existingElemen, newEl];
    // Update jumlah_elemen in-place
    store.mapel = store.mapel.map(m => m.id === mapelId ? { ...mapelObj } : m);
    return HttpResponse.json({ data: newEl, meta: null, error: null }, { status: 201 });
  }),

  // PATCH /admin/mapel/:mapel_id/elemen/:id
  http.patch(url('/admin/mapel/:mapel_id/elemen/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(300);
    const mapelId = params.mapel_id;
    const elemenId = params.id;
    let found = null;
    store.mapel = store.mapel.map(m => {
      if (m.id !== mapelId) return m;
      const elemen = (m.elemen || KURIKULUM_ELEMEN[mapelId] || []).map(e => {
        if (e.id !== elemenId) return e;
        found = { ...e, label: body.label ?? e.label };
        return found;
      });
      return { ...m, elemen };
    });
    if (!found) return HttpResponse.json({ data: null, meta: null, error: 'Elemen tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json({ data: found, meta: null, error: null });
  }),

  // DELETE /admin/mapel/:mapel_id/elemen/:id
  http.delete(url('/admin/mapel/:mapel_id/elemen/:id'), async ({ params }) => {
    await d(250);
    const mapelId = params.mapel_id;
    const elemenId = params.id;
    store.mapel = store.mapel.map(m => {
      if (m.id !== mapelId) return m;
      return { ...m, elemen: (m.elemen || []).filter(e => e.id !== elemenId) };
    });
    return HttpResponse.json({ data: { deleted: true }, meta: null, error: null });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Elemen legacy (per Mapel, Kurikulum Merdeka) — backward compat
  // GET    /admin/elemen?mapel_id=:id
  // POST   /admin/elemen
  // PUT    /admin/elemen/:id
  // DELETE /admin/elemen/:id
  // ════════════════════════════════════════════════════════════════════

  // DEPRECATED: /admin/elemen (flat) → /admin/mapel/:mapel_id/elemen (nested)
  // CONTRACT V3.5 §9 — path lama dimatikan; deprecated.handlers.js menangkap dan return 410.
  // Jangan hapus — di-comment agar mudah di-trace saat audit.
  // http.get(url('/admin/elemen'), async ({ request }) => { ... }),
  // http.post(url('/admin/elemen'), async ({ request }) => { ... }),
  // http.put(url('/admin/elemen/:id'), async ({ request, params }) => { ... }),
  // http.delete(url('/admin/elemen/:id'), async ({ params }) => { ... }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Kelas Detail: Mapel & Siswa per Kelas
  // POST   /admin/kelas/:id/mapel          → tambah mapel + assign guru ke kelas
  // DELETE /admin/kelas/:id/mapel/:mapel_id → lepas mapel dari kelas
  // PUT    /admin/kelas/:id/mapel/:mapel_id/guru → ganti guru pengampu
  // POST   /admin/kelas/:id/siswa          → tambah siswa ke kelas (single)
  // DELETE /admin/kelas/:id/siswa/:siswa_id → lepas siswa dari kelas
  // ════════════════════════════════════════════════════════════════════

  // POST /admin/kelas/:id/mapel
  // Body: { mapel_id: string, guru_id: string|null }
  http.post(url('/admin/kelas/:id/mapel'), async ({ request, params }) => {
    const body = await request.json();
    await d(350);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    const mapelGuruMap = kelas.mapelGuruMap || {};
    if (mapelGuruMap[body.mapel_id] !== undefined) {
      return HttpResponse.json({ message: 'Mapel sudah ada di kelas ini.' }, { status: 409 });
    }
    kelas.mapelGuruMap = { ...mapelGuruMap, [body.mapel_id]: body.guru_id || '' };
    // Sync guru: tambahkan kelas ke mapel_kelas_map guru
    if (body.guru_id) {
      const guru = store.guru.find(g => g.id === body.guru_id);
      if (guru) {
        const mkm = guru.mapel_kelas_map || {};
        mkm[body.mapel_id] = [...new Set([...(mkm[body.mapel_id] || []), params.id])];
        guru.mapel_kelas_map = mkm;
        guru.mapel_ids = [...new Set([...(guru.mapel_ids || []), body.mapel_id])];
        guru.kelas_ids = [...new Set([...(guru.kelas_ids || []), params.id])];
      }
    }
    return HttpResponse.json(kelas, { status: 201 });
  }),

  // DELETE /admin/kelas/:id/mapel/:mapel_id
  http.delete(url('/admin/kelas/:id/mapel/:mapel_id'), async ({ params }) => {
    await d(300);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    const { [params.mapel_id]: _removed, ...rest } = kelas.mapelGuruMap || {};
    kelas.mapelGuruMap = rest;
    return HttpResponse.json({ deleted: true });
  }),

  // PATCH /admin/kelas/:id/mapel/:mapel_id — CONTRACT V3.6 §9.3
  // Ganti guru pengampu untuk mapel di kelas ini. Body: { guru_id }
  // SEBELUMNYA: PUT /admin/kelas/:id/mapel/:mapel_id/guru — sudah deprecated
  http.patch(url('/admin/kelas/:id/mapel/:mapel_id'), async ({ request, params }) => {
    const body = await request.json();
    await d(300);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json(
      { data: null, meta: null, error: { code: 'NOT_FOUND', message: 'Kelas tidak ditemukan.' } },
      { status: 404 }
    );
    kelas.mapelGuruMap = { ...(kelas.mapelGuruMap || {}), [params.mapel_id]: body.guru_id };
    return envelope({ mapel_id: params.mapel_id, guru_id: body.guru_id }); // CONTRACT V3.6 §9.3
  }),

  // POST /admin/kelas/:id/siswa
  // Body: { siswa_id: string }
  http.post(url('/admin/kelas/:id/siswa'), async ({ request, params }) => {
    const body = await request.json();
    await d(350);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    kelas.siswa_ids = kelas.siswa_ids || [];
    if (kelas.siswa_ids.includes(body.siswa_id)) {
      return HttpResponse.json({ message: 'Siswa sudah ada di kelas ini.' }, { status: 409 });
    }
    kelas.siswa_ids.push(body.siswa_id);
    kelas.jumlah_siswa = kelas.siswa_ids.length;
    // Sync siswa kelas_id
    const siswa = store.siswa.find(s => s.id === body.siswa_id);
    if (siswa) siswa.kelas_id = params.id;
    return HttpResponse.json(siswa || { id: body.siswa_id, kelas_id: params.id }, { status: 201 });
  }),

  // DELETE /admin/kelas/:id/siswa/:siswa_id
  http.delete(url('/admin/kelas/:id/siswa/:siswa_id'), async ({ params }) => {
    await d(300);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    kelas.siswa_ids = (kelas.siswa_ids || []).filter(id => id !== params.siswa_id);
    kelas.jumlah_siswa = kelas.siswa_ids.length;
    const siswa = store.siswa.find(s => s.id === params.siswa_id);
    if (siswa && siswa.kelas_id === params.id) siswa.kelas_id = null;
    return HttpResponse.json({ deleted: true });
  }),

  // ════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // GET /leaderboard
  // Params: { kelas_id, mode: 'daily'|'monthly' }
  // Response: LeaderboardEntry[] — urut rank ASC
  // LeaderboardEntry: { rank, siswa_id, nama, avatar, kelas_id, total_poin_quiz, streak_hari }
  // Dipanggil LeaderboardSection — menggantikan buildLeaderboard() lokal dari masterData.
  // ════════════════════════════════════════════════════════════════════

  http.get(url('/leaderboard'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const kelasId = p.get('kelas_id');
    const mode = p.get('mode') || 'monthly'; // 'daily' | 'monthly'
    await d(400);

    // Filter siswa berdasarkan kelas_id jika ada
    const candidates = store.siswa.filter(s =>
      !kelasId || s.kelas_id === kelasId
    );

    // Pakai helper bersama getStudentScore — konsisten dengan GET /content/progress
    const entries = candidates.map(s => {
      const { monthly, daily, seed } = getStudentScore(s.id, mode);
      const total_poin_quiz = mode === 'daily' ? daily : monthly;
      return {
        siswa_id: s.id,
        nama: s.nama,
        avatar: s.avatar || s.nama?.slice(0, 2).toUpperCase() || '??',
        kelas_id: s.kelas_id || kelasId,
        total_poin_quiz,
        streak_hari: 1 + (seed % 10),
      };
    });

    // Urutkan DESC by poin, lalu tambah rank
    const ranked = entries
      .sort((a, b) => b.total_poin_quiz - a.total_poin_quiz)
      .map((e, idx) => ({ ...e, rank: idx + 1, peringkat: idx + 1 }));

    return HttpResponse.json({
      data: ranked,
      meta: {
        mode,
        periode: new Date().toISOString().slice(0, 7),
        kelas_id: kelasId,
        diperbarui_at: new Date().toISOString(),
      },
      error: null,
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // SUMMARY — POST /summary/siswa/:id
  // Dipanggil guru dari MonitoringSection untuk generate ringkasan AI per sesi.
  // Mock: generate teks deterministik dari payload (tidak pakai setTimeout).
  // BE nanti: kirim ke LLM → kembalikan { text, generated_at, expires_at }.
  // ════════════════════════════════════════════════════════════════════

  // [V2 DEAD CODE] — Diganti /sesi/:id/summary (§13). Tidak dipanggil FE V3. Hapus setelah integrasi BE.
  http.post(url('/summary/siswa/:id'), async ({ request, params }) => {
    await d(1400); // simulasi LLM latency
    const body = await request.json();
    const { sesi_key, materi_id, level, last_quiz, today_active, emosi_sesi, durasi } = body;
    const siswaId = params.id;

    // 422 jika data tidak cukup
    if (!today_active && !materi_id && !last_quiz) {
      return HttpResponse.json(
        { message: 'Data sesi belum cukup untuk dianalisis. Siswa perlu menyelesaikan setidaknya satu aktivitas belajar.' },
        { status: 422 }
      );
    }

    // Build deterministik ringkasan text dari payload
    const levelLabel = { low: 'Dasar', mid: 'Menengah', high: 'Lanjut' }[level] || 'Dasar';
    const emosiLabel = emosi_sesi?.length
      ? emosi_sesi.slice(-3).join(', ')
      : 'netral';
    const quizInfo = last_quiz?.aggregated != null
      ? `Skor quiz agregasi: ${Math.round(last_quiz.aggregated)}/100.`
      : last_quiz?.mc_score != null
        ? `Skor MC: ${Math.round(last_quiz.mc_score)}/100.`
        : 'Belum ada data quiz.';
    // durasi dari payload dalam menit (sesuai flow.md & content.js JSDoc)
    const durasiMenit = typeof durasi === 'number' ? durasi : 0;
    const studyLabel = durasiMenit >= 60
      ? `${Math.floor(durasiMenit / 60)} jam ${durasiMenit % 60} menit`
      : `${durasiMenit} menit`;

    const text = `Ringkasan aktivitas belajar ${store.siswa.find(s => s.id === siswaId)?.nama}: sesi ${sesi_key?.split('__')[1] || 'hari ini'}\n` +
      `Materi yang dipelajari berada di level ${levelLabel}. ` +
      `${quizInfo} ` +
      `Durasi belajar aktif: ${studyLabel}. ` +
      `Kondisi emosi selama sesi: ${emosiLabel}.\n\n` +
      (last_quiz?.aggregated >= 75
        ? `Siswa menunjukkan pemahaman yang baik dan siap untuk naik ke materi berikutnya.`
        : last_quiz?.aggregated != null
          ? `Disarankan guru memberikan penguatan pada materi ${materi_id || 'ini'} sebelum lanjut ke level berikutnya.`
          : `Pantau partisipasi siswa — dorong untuk menyelesaikan quiz agar evaluasi lebih akurat.`);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 86400000); // 24 jam
    return HttpResponse.json({
      text,
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // GURU — Rekomendasi Guru → Siswa
  // Fitur guru (bukan admin). Endpoint di /guru/ bukan /admin/.
  // ════════════════════════════════════════════════════════════════════

  // POST /guru/rekomendasi
  // Body: { guru_id, siswa_id, mapel_id, pesan }
  // Role: guru
  // [V2 DEAD CODE] — Diganti POST /notifikasi (§21). GET /siswa/:id/notifikasi sudah native V3. Hapus setelah integrasi BE.
  http.post(url('/guru/rekomendasi'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const guru = store.guru.find(g => g.id === body.guru_id);
    const mapel = store.mapel.find(m => m.id === body.mapel_id);
    const newRek = {
      id: 'rek_' + Date.now(),
      guru_id: body.guru_id,
      guru_nama: guru?.nama || 'Guru',
      guru_mapel: `${mapel?.icon || '📚'} ${mapel?.label || body.mapel_id}`,
      siswa_id: body.siswa_id,
      pesan: body.pesan,
      dibaca: false,
      created_at: nowISO(),
    };
    store.rekomendasi.push(newRek);
    return HttpResponse.json({ id: newRek.id, created_at: newRek.created_at }, { status: 201 });
  }),

  // GET /guru/rekomendasi
  // Params: { siswa_id }
  // Role: siswa — dipanggil DashboardSection untuk notifikasi bell
  // [V2 DEAD CODE] — Diganti GET /siswa/:id/notifikasi (§21) yang sudah native V3. Hapus setelah integrasi BE.
  http.get(url('/guru/rekomendasi'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const siswaId = p.get('siswa_id');
    await d(400);
    const hasil = store.rekomendasi
      .filter(r => !siswaId || r.siswa_id === siswaId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json(hasil);
  }),

];