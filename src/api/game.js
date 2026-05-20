/**
 * Game Tim 4 — path V3
 * CONTRACT V3.4 §1: Tim 4 deliver game sebagai html_string.
 * Komponen masih pakai <iframe src={html_url}> — normalizeGameData bridge transparan terhadap UI.
 * html_string dikonversi ke Blob URL agar <iframe src> tetap bekerja.
 * Catatan: Blob URL harus di-revoke saat komponen unmount untuk mencegah memory leak.
 * Lihat REFACTOR_FINAL_CLEAN_V3_6.md §LAYER 3 — Catatan Integrasi BE.
 */
import { v3 } from "../http/requestV3.js";
import { getApiMode, shouldTryRealFirst, allowMockFallback } from "../config/apiMode.js"

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

/** Placeholder game saat BE/Tim 4 belum siap */
function gamePlaceholder(level) {
  const levelLc = (level || "low").toLowerCase();
  const html_string = `<!DOCTYPE html><html><head><title>Game Placeholder</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f0fdf4"><div style="text-align:center"><div style="font-size:48px">🎮</div><h2 style="color:#0d9488">Game Segera Hadir</h2><p style="color:#6b7280;font-size:14px">Level: ${levelLc}</p><button onclick="window.parent.postMessage({type:'game:selesai'},'*')" style="background:#0d9488;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:16px;margin-top:16px">Tandai Selesai</button></div></body></html>`;
  return normalizeGameData({
    game_id: `game_placeholder_${levelLc}_${Date.now()}`,
    nama: "Game Placeholder",
    deskripsi: `Game level ${levelLc} — menunggu Tim 4`,
    level: levelLc,
    status: "ready",
    html_string,
  });
}

export async function generateGame(payload) {
  // instruksi_revisi & revisi_guru di-strip — tidak ada di contract /game/generate
  // eslint-disable-next-line no-unused-vars
  const { revisi_guru: _r, instruksi_revisi: _i, ...rest } = payload;
  return runHybrid(
    async () => {
      const data = await v3.post("/game/generate", rest);
      return normalizeGameData(data);
    },
    () => Promise.resolve(gamePlaceholder(payload.level)),
  );
}

export async function regenerateGame(payload) {
  return runHybrid(
    async () => {
      const data = await v3.post("/game/regenerate", {
        game_id: payload.game_id,
        instruksi_revisi: payload.instruksi_revisi ?? "",
      });
      return normalizeGameData(data);
    },
    () => Promise.resolve(gamePlaceholder(payload.level)),
  );
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
