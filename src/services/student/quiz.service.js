/**
 * SR MVP — Quiz Service V3.3
 * Memisahkan submit MC (sync) dan Essay (async).
 * UI existing di QuizModal tetap tidak berubah.
 *
 * REFACTOR 1: Quiz Split — Integration Guide V3.3 §4 & §9
 */
import { v3 } from "../../http/requestV3.js";
import { getApiMode, shouldTryRealFirst, allowMockFallback } from "../../config/apiMode.js";
import * as LEG from "../../adapters/v3/studentContent.js";
import * as TO from "../../adapters/v3/toV3.js";

async function runHybrid(realExec, mockExec) {
  if (getApiMode() === "mock") return mockExec();
  if (shouldTryRealFirst()) {
    try { return await realExec(); }
    catch (e) { if (allowMockFallback(e)) return mockExec(); throw e; }
  }
  return realExec();
}

/**
 * Submit Quiz MC — Synchronous.
 * Response langsung mengandung nilai.
 * POST /siswa/:id/quiz/mc
 */
export async function submitQuizMC(payload) {
  const sid = payload.siswa_id;
  const body = TO.toQuizSubmitV3({ ...payload, quiz_type: "mc" });
  const raw = await runHybrid(
    () => v3.post(`/siswa/${encodeURIComponent(sid)}/quiz/mc`, body),
    () => ({
      tipe: "mc",
      nilai: payload.score ?? 80,
      benar: 8,
      total: 10,
      elemen_id: payload.elemen_id,
      level: String(payload.level || "low").toLowerCase(),
      naik_level: false,
      agregasi: null,
      menunggu_essay: true,
      kkm: 75,
      hasil_quiz_id: `hq_mock_mc_${Date.now()}`,
      dicatat_at: new Date().toISOString(),
    }),
  );
  return LEG.mapQuizMCSubmitV3(raw);
}

/**
 * Submit Quiz Essay — Asynchronous.
 * Response: menunggu_penilaian: true, nilai: null.
 * Nilai akhir diterima via WebSocket event essay_dinilai.
 * POST /siswa/:id/quiz/essay
 */
export async function submitQuizEssay(payload) {
  const sid = payload.siswa_id;
  const body = TO.toQuizSubmitV3({ ...payload, quiz_type: "essay" });
  const raw = await runHybrid(
    () => v3.post(`/siswa/${encodeURIComponent(sid)}/quiz/essay`, body),
    () => ({
      tipe: "essay",
      nilai: null,
      elemen_id: payload.elemen_id,
      level: String(payload.level || "low").toLowerCase(),
      menunggu_penilaian: true,
      naik_level: null,
      agregasi: null,
      hasil_quiz_id: `hq_mock_essay_${Date.now()}`,
      dicatat_at: new Date().toISOString(),
    }),
  );
  return LEG.mapQuizEssaySubmitV3(raw);
}
