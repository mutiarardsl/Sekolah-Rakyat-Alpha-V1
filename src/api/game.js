/**
 * Game Tim 4 — path V3
 * CONTRACT V3.4 §1: Tim 4 deliver game sebagai html_string.
 * Komponen masih pakai <iframe src={html_url}> — normalizeGameData bridge transparan terhadap UI.
 * html_string dikonversi ke Blob URL agar <iframe src> tetap bekerja.
 * Catatan: Blob URL harus di-revoke saat komponen unmount untuk mencegah memory leak.
 * Lihat REFACTOR_FINAL_CLEAN_V3_6.md §LAYER 3 — Catatan Integrasi BE.
 */
import { v3 } from "../http/requestV3.js";

// CONTRACT V3.4 §1 — bridge html_string → html_url (Blob URL)
function normalizeGameData(data) {
  if (!data) return data;
  if (data.html_string && !data.html_url) {
    try {
      const blob = new Blob([data.html_string], { type: 'text/html' });
      data = { ...data, html_url: URL.createObjectURL(blob) };
    } catch {
      // SSR / test env — Blob URL tidak tersedia, fallback null
      data = { ...data, html_url: null };
    }
  }
  return data;
}

export async function generateGame(payload) {
  const { revisi_guru, instruksi_revisi, ...rest } = payload;
  const data = await v3.post("/game/generate", {
    ...rest,
    instruksi_revisi: revisi_guru ?? instruksi_revisi ?? "",
  });
  return normalizeGameData(data); // CONTRACT V3.4 §1 bridge
}

/**
 * Regenerate game spesifik via game_id — V3.3
 * Dipanggil saat guru klik "Ulangi" di panel review game.
 * POST /game/regenerate
 * CONTRACT V3.6 §17
 */
export async function regenerateGame(payload) {
  const data = await v3.post("/game/regenerate", {
    game_id: payload.game_id,
    instruksi_revisi: payload.instruksi_revisi ?? "",
  });
  return normalizeGameData(data); // CONTRACT V3.4 §1 bridge
}

export async function getGameList(params) {
  return v3.get("/game", { params });
}

export async function getGame(gameId) {
  const data = await v3.get(`/game/${encodeURIComponent(gameId)}`);
  return normalizeGameData(data); // CONTRACT V3.4 §1 bridge
}

export async function recordGameSelesai(payload) {
  const raw = await v3.patch(
    `/game/${encodeURIComponent(payload.game_id)}/penyelesaian`,
    { siswa_id: payload.siswa_id, level: payload.level },
  );
  return {
    recorded: !!raw?.tercatat,
    game_id: raw?.game_id,
    siswa_id: raw?.siswa_id,
    level: raw?.level,
    selesai_at: raw?.selesai_at,
  };
}
