/**
 * V3 API → bentuk yang sudah dikonsumsi komponen eksisting.
 */

export function mapProgressCombined(kpi, progress) {
  const byMapel = (progress?.by_mapel || []).map((m) => ({
    mapel_id: m.mapel_id,
    mapel_label: m.mapel_label,
    selesai: m.selesai,
    progress_avg: m.progress_pct ?? m.progress_avg ?? 0,
  }));

  const selesai =
    progress?.by_mapel?.reduce((a, m) => a + (m.selesai || 0), 0) ?? 0;
  const dalam =
    progress?.by_mapel?.reduce((a, m) => a + (m.dalam_proses || 0), 0) ?? 0;
  const belum =
    progress?.by_mapel?.reduce((a, m) => a + (m.belum_dimulai || 0), 0) ?? 0;

  const totalDurasi = kpi?.total_durasi_menit ?? 0;
  const streak = kpi?.streak_hari ?? 0;
  const totalTopik = kpi?.total_topik ?? selesai + dalam + belum;
  const poin = kpi?.total_poin_quiz ?? 0;

  return {
    siswa_id: kpi?.siswa_id || progress?.siswa_id,
    streak_hari: streak,
    total_topik: totalTopik,
    total_poin_quiz: poin,
    total_durasi_menit: totalDurasi,
    total_waktu_menit: totalDurasi,
    rata_rata_quiz:
      selesai + dalam > 0 ? Math.round(poin / Math.max(selesai + dalam, 1)) : 0,
    selesai,
    dalam_proses: dalam,
    belum_dimulai: belum,
    by_mapel: byMapel,
    sudah_selesai_ids: progress?.sudah_selesai_ids || [],
    belum_selesai_ids: progress?.sedang_dipelajari_ids || [],
  };
}

export function mapRecommendationsResponse(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    mapel_id: r.mapel_id,
    elemen_id: r.elemen_id,
    elemen_label: r.elemen_label,
    materi: r.materi ?? null,
    materi_id: r.materi_id ?? null,
    alasan: r.alasan ?? "",
  }));
}

export function mapInsightResponse(data) {
  return { text: data?.teks ?? data?.text ?? "" };
}

export function mapQuizHistoryV3(data) {
  const hist = (data?.riwayat || []).map((h) => ({
    type: h.tipe === "mc" ? "mc" : "essay",
    level: (h.level || "low").toLowerCase(),
    score: h.nilai ?? 0,
    locked: !!h.terkunci,
    ts: h.dikerjakan_at || new Date().toISOString(),
    hasil_quiz_id: h.hasil_quiz_id ?? null, // CONTRACT V3.6 §11 V3.6 Changelog #1
  }));
  return {
    current_level: (data?.level_aktif || "low").toLowerCase(),
    history: hist,
  };
}

export function mapQuizSubmitV3(data) {
  const lvl = data?.level;
  const levStr =
    typeof lvl === "string"
      ? lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase()
      : lvl;

  return {
    submitted: !!data?.disimpan,
    score: data?.nilai ?? 0,
    quiz_type: data?.tipe === "essay" ? "essay" : "mc",
    elemen_id: data?.elemen_id,
    level: levStr,
    essay_score: data?.nilai_essay ?? null,
    kkm: data?.kkm ?? 75,
    pending_aggregation: !!data?.menunggu_agregasi,
    recorded_at: data?.dicatat_at ?? new Date().toISOString(),
    hasil_quiz_id: data?.hasil_quiz_id ?? null,
  };
}

/** Paket konten siswa — disetujui → approved untuk kompatibilitas */
export function mapKontenSiswaList(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((item) => {
    if (!item?.konten_list) return item;
    return {
      ...item,
      konten_list: item.konten_list.map((c) => ({
        ...c,
        approved: c.approved ?? c.disetujui ?? false,
      })),
    };
  });
}

/** Riwayat guru — gabungkan game_penyelesaian Tim 6 ke konten_list game legacy */
export function mapGuruRiwayatV3(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((pkt) => {
    const completions = pkt.game_penyelesaian || [];
    const konten_list = (pkt.konten_list || []).map((c) => {
      let content = { ...(c.content || {}) };
      if (c.tipe === "game") {
        const lv = String(c.level || "Low").toLowerCase();
        const g = completions.find(
          (x) => String(x.level || "").toLowerCase() === lv,
        );
        if (g?.siswa_selesai?.length && !content.siswa_selesai) {
          content = {
            ...content,
            siswa_selesai: g.siswa_selesai.map((s) => ({
              siswa_id: s.siswa_id,
              selesai_at: s.selesai_at,
            })),
          };
        }
      }
      return { ...c, content, approved: c.approved ?? c.disetujui ?? false };
    });
    return { ...pkt, konten_list };
  });
}

export function mapPretestSoalV3(data) {
  const soal = (data?.soal || []).map((q) => ({
    id: q.id,
    pertanyaan: q.soal ?? q.pertanyaan,
    pilihan: q.pilihan || [],
    jawaban: q.jawaban,
  }));
  return { soal, sesi_pretest_id: data?.sesi_pretest_id };
}

export function mapSummaryV3(data) {
  return {
    text: data?.teks ?? "",
    generated_at: data?.dibuat_at ?? new Date().toISOString(),
    expires_at: data?.berlaku_hingga ?? new Date().toISOString(),
  };
}

export function mapChatHistoryV3(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((m) => ({
    role: m.role,
    text: m.teks ?? m.text ?? "",
    timestamp: m.dikirim_at ?? m.timestamp ?? new Date().toISOString(),
  }));
}

/** Hasil submit pretest V3 → field yang dipakai PretestPage */
export function mapPretestSubmitLegacy(data) {
  const lvl = data?.level;
  return {
    level: typeof lvl === "string" ? lvl.toLowerCase() : "low",
    score: data?.nilai ?? data?.score ?? 0,
    benar: data?.benar ?? 0,
    total: data?.total ?? 5,
  };
}

// ── V3.3 Quiz Split Mappers ────────────────────────────────────────────

/**
 * Mapper untuk response MC submit V3.3 (synchronous)
 * REFACTOR 1: Quiz Split — Integration Guide V3.3 §9.2
 */
export function mapQuizMCSubmitV3(data) {
  const lvl = data?.level;
  const levStr = typeof lvl === "string"
    ? lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase()
    : lvl;
  return {
    submitted: true,
    score: data?.nilai ?? 0,
    quiz_type: "mc",
    elemen_id: data?.elemen_id,
    level: levStr,
    benar: data?.benar ?? 0,
    total: data?.total ?? 10,
    naik_level: !!data?.naik_level,
    agregasi: data?.agregasi ?? null,
    menunggu_essay: !!data?.menunggu_essay,
    kkm: data?.kkm ?? 75,
    pending_aggregation: !!data?.menunggu_essay,
    hasil_quiz_id: data?.hasil_quiz_id ?? null,
    recorded_at: data?.dicatat_at ?? new Date().toISOString(),
  };
}

/**
 * Mapper untuk response Essay submit V3.3 (async — nilai null saat submit)
 * Nilai akhir datang via WebSocket essay_dinilai.
 * REFACTOR 1: Quiz Split — Integration Guide V3.3 §9.2
 */
export function mapQuizEssaySubmitV3(data) {
  const lvl = data?.level;
  const levStr = typeof lvl === "string"
    ? lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase()
    : lvl;
  return {
    submitted: true,
    score: null,                          // null — belum dinilai
    quiz_type: "essay",
    elemen_id: data?.elemen_id,
    level: levStr,
    naik_level: null,                     // null — menunggu penilaian
    agregasi: null,
    menunggu_penilaian: !!data?.menunggu_penilaian,
    kkm: data?.kkm ?? 75,
    pending_aggregation: true,
    hasil_quiz_id: data?.hasil_quiz_id ?? null,
    recorded_at: data?.dicatat_at ?? new Date().toISOString(),
    essay_state: "processing",            // idle | pending | processing | completed | failed
  };
}

/**
 * Mapper untuk WebSocket event essay_dinilai
 * REFACTOR 5: WebSocket essay_dinilai — Integration Guide V3.3 §8 & §9.2
 */
export function mapEssayDinilaiWS(payload) {
  const lvl = payload?.level;
  const levStr = typeof lvl === "string"
    ? lvl.charAt(0).toUpperCase() + lvl.slice(1).toLowerCase()
    : lvl;
  return {
    elemen_id: payload?.elemen_id,
    materi_id: payload?.materi_id ?? null,
    level: levStr,
    nilai_essay: payload?.nilai_essay ?? 0,
    nilai_mc: payload?.nilai_mc ?? 0,
    agregasi: payload?.agregasi ?? 0,
    naik_level: !!payload?.naik_level,
    kkm: payload?.kkm ?? 75,
    essay_state: "completed",
  };
}
