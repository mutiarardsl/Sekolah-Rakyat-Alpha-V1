/**
 * Leaderboard API — V3 HARDENED
 * src/api/leaderboard.js
 *
 * CHANGES:
 *  - getLeaderboard sekarang menerima AbortSignal untuk cancellation
 *  - Field mapping defensif: handle envelope maupun raw array dari mock
 */
import { apiClient } from "./client";
import { unwrapEnvelope } from "../http/envelope";

/**
 * Fetch leaderboard data.
 *
 * @param {{ kelas_id: string, mode?: 'daily'|'monthly', signal?: AbortSignal }} opts
 * @returns {Promise<LeaderboardEntry[]>}
 */
export async function getLeaderboard({ kelas_id, mode = "monthly", signal }) {
  const response = await apiClient.get("/leaderboard", {
    params: { kelas_id, mode },
    signal, // ← cancellation support
  });

  // unwrapEnvelope handles both V3 envelope { data, meta, error }
  // and raw arrays (legacy mock fallback)
  const rows = unwrapEnvelope(response.data);

  if (!Array.isArray(rows)) return [];

  return rows.map((e) => ({
    ...e,
    rank: e.peringkat ?? e.rank,
    total_poin_quiz: e.total_poin ?? e.total_poin_quiz ?? 0,
    streak_hari: e.streak_hari ?? 0,
    nama: e.nama ?? "",
    siswa_id: e.siswa_id ?? "",
    avatar: e.avatar ?? null,
    kelas_id: e.kelas_id ?? kelas_id,
  }));
}