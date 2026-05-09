/**
 * Game Tim 4 — path V3
 */
import { v3 } from "../http/requestV3.js";

export async function generateGame(payload) {
  const { revisi_guru, instruksi_revisi, ...rest } = payload;
  return v3.post("/game/generate", {
    ...rest,
    instruksi_revisi: revisi_guru ?? instruksi_revisi ?? "",
  });
}

export async function getGameList(params) {
  return v3.get("/game", { params });
}

export async function getGame(gameId) {
  return v3.get(`/game/${encodeURIComponent(gameId)}`);
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
