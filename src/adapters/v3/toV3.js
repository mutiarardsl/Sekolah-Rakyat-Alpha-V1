/** Permintaan UI (legacy keys) → body V3 */
export function toKontenGeneratePayload(raw) {
  // eslint-disable-next-line no-unused-vars
  const { guru_id: _g, revisi_guru: _r, instruksi_revisi: _i, ...rest } = raw;
  return { ...rest };
}

// V3.3: include konten_id di setiap item konten_list (REFACTOR 2)
export function toKontenPublishPayload(payload) {
  const konten_list = (payload.konten_list || []).map((c) => {
    const { approved, disetujui, ...item } = c;
    void approved;
    return {
      ...item,
      konten_id: c.konten_id ?? c.id ?? null,  // V3.3: wajib disertakan
      disetujui:
        typeof disetujui === "boolean"
          ? disetujui
          : !!(approved ?? false),
    };
  });
  return { ...payload, konten_list };
}

export function toQuizSubmitV3(payload) {
  const level =
    typeof payload.level === "string"
      ? payload.level.charAt(0).toUpperCase() +
      payload.level.slice(1).toLowerCase()
      : payload.level;
  return {
    publish_id: payload.publish_id,
    mapel_id: payload.mapel_id,
    elemen_id: payload.elemen_id,
    elemen_label: payload.elemen_label,
    materi: payload.materi ?? null,
    materi_id: payload.materi_id ?? null,
    tipe: payload.quiz_type === "essay" ? "essay" : "mc",
    level,
    jawaban: payload.answers ?? {},
    score: payload.score ?? null,  // ← TAMBAH INI: untuk mock scoring; BE real ignore
  };
}

/**
 * levels dari store keyed "mapel__elemen" → V3 hanya elemen_id
 */
export function toRekomendasiV3(body) {
  const levels = {};
  for (const [k, v] of Object.entries(body.levels || {})) {
    const elemenId = String(k).includes("__")
      ? String(k).split("__").slice(-1)[0]
      : k;
    levels[elemenId] =
      typeof v === "string" ? v.toLowerCase() : v;
  }

  function parseIds(ids) {
    const out = [];
    for (const x of ids || []) {
      const s = String(x);
      if (s.includes("__")) out.push(s.split("__").slice(-1)[0]);
      else out.push(s);
    }
    return [...new Set(out)];
  }

  return {
    siswa_id: body.siswa_id,
    levels,
    sudah_selesai_ids: parseIds(body.completed_ids),
    sedang_dipelajari_ids: parseIds(body.in_progress_ids),
  };
}

export function normalizeEmosiSesiPayload(emosiArr) {
  if (!Array.isArray(emosiArr)) return [];
  return emosiArr.map((x) =>
    typeof x === "string" ? x : x?.emosi ?? x?.key ?? "",
  ).filter(Boolean);
}

export function toSummaryPayloadV3(payload) {
  const durasiMenit =
    typeof payload.durasi_menit === "number"
      ? payload.durasi_menit
      : Number(payload.durasi) || 0;

  const hasilQuiz = (payload.quiz_results || []).map((q) => ({
    level: typeof q.level === "string" ? q.level.toLowerCase() : "low",
    tipe: q.type === "essay" ? "essay" : "mc",
    nilai: q.score ?? 0,
  }));

  const violations = (payload.violations || []).map((v) => ({
    detail: v.detail,
    terjadi_at: v.terjadi_at ?? v.timestamp ?? new Date().toISOString(),
  }));

  return {
    siswa_id: payload.siswa_id,
    mapel_id: payload.mapel_id,
    elemen_id: payload.elemen_id,
    materi_id: payload.materi_id ?? null,
    durasi_menit: durasiMenit,
    hasil_quiz: hasilQuiz,
    last_quiz: payload.last_quiz
      ? {
        nilai_mc: payload.last_quiz.mc_score,
        nilai_essay: payload.last_quiz.essay_score,
        agregasi: payload.last_quiz.aggregated,
      }
      : null,
    emosi_sesi: normalizeEmosiSesiPayload(payload.emosi_sesi),
    violations,
  };
}
