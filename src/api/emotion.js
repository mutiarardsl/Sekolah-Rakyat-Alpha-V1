/**
 * Emosi Tim 1 — V3
 */
import { v3 } from "../http/requestV3.js";

export async function detectEmotion(payload) {
  const data = await v3.post("/emosi/deteksi", {
    siswa_id: payload.siswa_id,
    sesi_id: payload.sesi_id ?? payload.session_id ?? null,
    frame_base64: payload.frame_base64,
  });
  return {
    emosi: data.emosi,
    confidence: data.confidence,
    terdeteksi_at: data.terdeteksi_at,
  };
}

export async function getEmotionHistory(params) {
  const sid = params.sesi_id ?? params.session_id;
  if (!sid) return [];
  const rows = await v3.get(`/sesi/${encodeURIComponent(sid)}/emosi`);
  return rows || [];
}
