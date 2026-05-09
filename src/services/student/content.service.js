/**
 * Siswa / konten domain — Contract V3 + adapter → bentuk UI lama.
 * Tidak mengimpor JSX.
 */
import { getApiMode, shouldTryRealFirst, allowMockFallback } from "../../config/apiMode.js";
import { v3 } from "../../http/requestV3.js";
import * as LEG from "../../adapters/v3/studentContent.js";
import * as TO from "../../adapters/v3/toV3.js";
import {
  recordPublishIdFromPaket,
  resolvePublishBundle,
  rememberSesiId,
  getStoredSesiId,
} from "../../lib/learningBridge.js";

function fallbackProgress(sid) {
  return {
    siswa_id: sid,
    streak_hari: 3,
    total_topik: 6,
    total_poin_quiz: 260,
    total_durasi_menit: 180,
    total_waktu_menit: 180,
    rata_rata_quiz: 72,
    selesai: 2,
    dalam_proses: 1,
    belum_dimulai: 2,
    by_mapel: [
      {
        mapel_id: "mat",
        mapel_label: "Matematika",
        selesai: 2,
        progress_avg: 55,
      },
    ],
    sudah_selesai_ids: [],
    belum_selesai_ids: [],
  };
}

/** Dummy pretest ketika hybrid gagal atau mode mock konten offline */
const FIXTURE_PRETEST_SOAL = Array.from({ length: 5 }, (_, i) => ({
  id: `pretest_fixture_${i + 1}`,
  soal: `Seberapa paham kamu dengan topik ini (soal ${i + 1})?`,
  pilihan: [
    "Belum sama sekali",
    "Sedikit",
    "Cukup",
    "Sudah mahir",
  ],
  jawaban: 2,
}));

async function runHybrid(realExec, mockExec) {
  if (getApiMode() === "mock") return mockExec();
  if (shouldTryRealFirst()) {
    try {
      return await realExec();
    } catch (e) {
      if (allowMockFallback(e)) return mockExec();
      throw e;
    }
  }
  return realExec();
}

export async function getProgressSiswa(params) {
  const sid = params.siswa_id;
  return runHybrid(
    async () => {
      const [kpi, progress] = await Promise.all([
        v3.get(`/siswa/${encodeURIComponent(sid)}/kpi`),
        v3.get(`/siswa/${encodeURIComponent(sid)}/progress`),
      ]);
      return LEG.mapProgressCombined(kpi, progress);
    },
    () => Promise.resolve(fallbackProgress(sid)),
  );
}

export async function getProgressGuru(params) {
  const kelasId = params.kelas_id;
  const q = {};
  if (params.mapel_id) q.mapel_id = params.mapel_id;
  const data = await runHybrid(
    () => v3.get(`/kelas/${encodeURIComponent(kelasId)}/progress`, { params: q }),
    async () =>
      Promise.resolve({
        kelas_id: kelasId,
        mapel_id: params.mapel_id || null,
        total_siswa: 12,
        aktif_hari_ini: 7,
        rata_rata_progress: 62,
        siswa: [],
      }),
  );
  return data;
}

export async function getKontenSiswa(params) {
  const sid = params.siswa_id;
  const qp = {};
  if (params.mapel_id) qp.mapel_id = params.mapel_id;
  if (params.elemen_id) qp.elemen_id = params.elemen_id;
  if (params.materi_id) qp.materi_id = params.materi_id;
  const bank = await runHybrid(
    () => v3.get(`/siswa/${encodeURIComponent(sid)}/konten`, { params: qp }),
    () => Promise.resolve([]),
  );
  const rows = LEG.mapKontenSiswaList(bank || []);
  recordPublishIdFromPaket(rows, sid);
  return rows;
}

export async function getRecommendations(body) {
  const payload = TO.toRekomendasiV3(body);
  const data = await runHybrid(
    () => v3.post("/rag/rekomendasi", payload),
    () => [],
  );
  return LEG.mapRecommendationsResponse(Array.isArray(data) ? data : []);
}

/** Insight: UI mengirim total_durasi dalam jam numerik → V3 mengharapkan menit */
export async function getContentInsight(payload) {
  const body = {
    siswa_id: payload.siswa_id,
    nama: payload.nama,
    streak: payload.streak,
    total_topik: payload.total_topik,
    total_poin_kuiz:
      payload.total_poin_kuiz ?? payload.total_poin_quiz ?? 0,
    total_durasi: Math.round((Number(payload.total_durasi) || 0) * 60),
  };
  const data = await runHybrid(
    () => v3.post("/rag/insight", body),
    () => ({ teks: "" }),
  );
  return LEG.mapInsightResponse(data);
}

export async function submitQuiz(payload) {
  const sid = payload.siswa_id;
  const apiBody = TO.toQuizSubmitV3(payload);
  const raw = await runHybrid(
    () =>
      v3.post(`/siswa/${encodeURIComponent(sid)}/quiz`, apiBody),
    () =>
      ({
        disimpan: true,
        tipe: payload.quiz_type === "essay" ? "essay" : "mc",
        nilai: payload.score ?? 0,
        nilai_essay: null,
        elemen_id: payload.elemen_id,
        level: String(payload.level || "low").toLowerCase(),
        menunggu_agregasi: payload.quiz_type === "essay",
        kkm: 75,
        dicatat_at: new Date().toISOString(),
      }),
  );
  return LEG.mapQuizSubmitV3(raw);
}

export async function getQuizHistory(params) {
  const sid = params.siswa_id;
  const q = {
    elemen_id: params.elemen_id,
  };
  if (params.materi_id != null && params.materi_id !== "")
    q.materi_id = params.materi_id;
  const data = await runHybrid(
    () =>
      v3.get(`/siswa/${encodeURIComponent(sid)}/quiz`, {
        params: q,
      }),
    () => ({
      level_aktif: "low",
      riwayat: [],
    }),
  );
  return LEG.mapQuizHistoryV3(data);
}

export async function getPretestStatus(params) {
  const sid = params.siswa_id;
  return runHybrid(
    () =>
      v3.get(`/siswa/${encodeURIComponent(sid)}/pretest/status`, {
        params: { mapel_id: params.mapel_id },
      }),
    () => [],
  );
}

export async function getPretestSoal(body) {
  const raw = await runHybrid(
    () => v3.post("/pretest/soal", body),
    () =>
      ({
        sesi_pretest_id: body.sesi_pretest_id || `pretest_fallback_${Date.now()}`,
        soal: FIXTURE_PRETEST_SOAL,
      }),
  );
  return LEG.mapPretestSoalV3(raw);
}

export async function submitPretestJawaban(body) {
  const clean = {
    siswa_id: body.siswa_id,
    mapel_id: body.mapel_id,
    elemen_id: body.elemen_id,
    materi_id: body.materi_id ?? null,
    sesi_pretest_id: body.sesi_pretest_id,
    jawaban: body.answers ?? body.jawaban ?? {},
  };
  const data = await runHybrid(
    () => v3.post("/pretest/submit", clean),
    () =>
      ({
        level: "low",
        nilai: 50,
        benar: 2,
        total: 5,
      }),
  );
  return LEG.mapPretestSubmitLegacy(data);
}

/** Guru */
export async function generateContent(payload) {
  const data = await runHybrid(
    () => v3.post("/konten/generate", TO.toKontenGeneratePayload(payload)),
    () =>
      ({
        tipe: payload.tipe,
        level: payload.level,
        content: payload.tipe === "mindmap"
          ? { nodes: [{ id: "n1", label: "Mindmap mock", parent_id: null }] }
          : payload.tipe?.includes?.("quiz") ? { soal: [] }
          : { text: "# Konten Mock\nPlaceholder." },
        dibuat_at: new Date().toISOString(),
      }),
  );
  return {
    tipe: data.tipe,
    level: data.level,
    content: data.content,
    generated_at: data.dibuat_at ?? data.generated_at ?? new Date().toISOString(),
  };
}

export async function publishKonten(payload) {
  const data = await runHybrid(
    () =>
      v3.post("/konten/publish", TO.toKontenPublishPayload(payload)),
    async () =>
      ({
        publish_id: `pub_local_${Date.now()}`,
        kelas_ids: payload.kelas_id ? [payload.kelas_id].flat() : ["x1"],
        dipublish_at: new Date().toISOString(),
      }),
  );
  const kel = data.kelas_ids ?? (payload.kelas_id ? [payload.kelas_id] : []);
  return {
    publish_id: data.publish_id,
    kelas_ids: kel,
    published_at:
      data.dipublish_at ?? data.published_at ?? new Date().toISOString(),
  };
}

export async function getRiwayatGuru(params) {
  const gid = params.guru_id;
  const qp = {};
  if (params.mapel_id) qp.mapel_id = params.mapel_id;
  const rows = await runHybrid(
    () =>
      v3.get(`/guru/${encodeURIComponent(gid)}/konten`, { params: qp }),
    () => [],
  );
  return LEG.mapGuruRiwayatV3(rows || []);
}

/**
 * Monitoring: bridging sesi_key → path /sesi/:id/summary
 * RISK UI: idealnya path memakai sesi_id dari BE; sampai ada UI flow POST /sesi,
 * siswa_key diperlakukan sebagai opaque sesi slug.
 */
export async function generateSummary(payload) {
  const sesiId = encodeURIComponent(
    payload.sesi_id || payload.sesi_key || "unknown",
  );
  const mapped = TO.toSummaryPayloadV3(payload);
  const data = await runHybrid(
    () => v3.post(`/sesi/${sesiId}/summary`, mapped),
    () =>
      ({
        teks: `Ringkasan mock untuk ${payload.siswa_id}.`,
        dibuat_at: new Date().toISOString(),
        berlaku_hingga: new Date(Date.now() + 86400000).toISOString(),
      }),
  );
  return LEG.mapSummaryV3(data);
}
