/**
 * Mentor Tim 5 + sesi untuk chat siswa — mapping ke V3.
 */
import { v3 } from "../../http/requestV3.js";
import { openStream } from "../../api/client.js";
import { mapChatHistoryV3 } from "../../adapters/v3/studentContent.js";
import {
  getStoredSesiId,
  rememberSesiId,
  resolvePublishBundle,
} from "../../lib/learningBridge.js";

async function ensureSesiForMentor(payload) {
  const {
    siswa_id,
    mapel_id,
    elemen_id,
    materi_id,
  } = payload;

  // Selalu reuse sesi yang sudah ada — baik flow normal maupun CTA.
  // V3.2: hasil_quiz_id tidak lagi memerlukan sesi baru karena konteks quiz
  // dikirim langsung di body POST /mentor/pesan, bukan di POST /sesi.
  const existing = getStoredSesiId(siswa_id, mapel_id, elemen_id, materi_id);
  if (existing) {
    console.log('[Mentor] ensureSesiForMentor: reuse existing sesi', existing);
    return existing;
  }

  const bun =
    resolvePublishBundle(siswa_id, mapel_id, elemen_id, materi_id) ||
    {};

  try {
    const res = await v3.post("/sesi", {
      siswa_id,
      mapel_id,
      elemen_id,
      materi_id: materi_id || null,
      publish_id: bun.publish_id || "pub_local_bridge",
    });

    console.log('[Mentor] ensureSesiForMentor: sesi dibuat', res.sesi_id);
    rememberSesiId(siswa_id, mapel_id, elemen_id, materi_id, res.sesi_id);
    return res.sesi_id;
  } catch (err) {
    console.error('[Mentor] ensureSesiForMentor: POST /sesi gagal', err);
    const fallback = `local_${siswa_id}_${mapel_id}_${elemen_id}`;
    rememberSesiId(siswa_id, mapel_id, elemen_id, materi_id, fallback);
    return fallback;
  }
}

function toMentorBody(payload, sesi_id) {
  return {
    siswa_id: payload.siswa_id,
    sesi_id,
    mapel_id: payload.mapel_id,
    elemen_id: payload.elemen_id,
    elemen_label: payload.elemen_label,
    materi: payload.materi,
    materi_id: payload.materi_id,
    atp: payload.atp || "",
    level: payload.level,
    pesan: payload.message,
    // V3.3: hasil_quiz_id DIHAPUS dari endpoint ini.
    // Evaluasi quiz sekarang via POST /mentor/evaluasi (REFACTOR 4)
    konteks: {
      emosi: payload.context?.emosi ?? null,
      progress: payload.context?.progress ?? null,
      publish_id: payload.context?.publish_id ?? null,
      bacaan: payload.context?.bacaan ?? null,
    },
  };
}

// ── V3.3: Evaluasi endpoint terpisah ────────────────────────────────

function toEvaluasiBody(payload, sesi_id) {
  return {
    siswa_id: payload.siswa_id,
    sesi_id,
    hasil_quiz_id: payload.hasil_quiz_id,  // wajib untuk evaluasi
    mapel_id: payload.mapel_id,
    elemen_id: payload.elemen_id,
    elemen_label: payload.elemen_label,
    materi: payload.materi,
    materi_id: payload.materi_id,
    level: payload.level,
    atp: payload.atp || "",
  };
}

/**
 * createSesi — buat sesi belajar segera saat siswa masuk chatbot.
 * Masalah 3: sesi_id harus ada sejak siswa masuk, bukan saat pesan pertama dikirim.
 * Dipanggil dari ChatSection useEffect saat camGranted = true.
 */
export async function createSesi({ siswa_id, mapel_id, elemen_id, materi_id }) {
  // Reuse sesi yang sudah ada untuk elemen/materi ini
  const existing = getStoredSesiId(siswa_id, mapel_id, elemen_id, materi_id);
  if (existing) {
    console.log('[Mentor] createSesi: reuse existing sesi', existing);
    return existing;
  }

  const bun = resolvePublishBundle(siswa_id, mapel_id, elemen_id, materi_id) || {};

  try {
    const res = await v3.post("/sesi", {
      siswa_id,
      mapel_id,
      elemen_id,
      materi_id: materi_id || null,
      publish_id: bun.publish_id || "pub_local_bridge",
    });
    console.log('[Mentor] createSesi: sesi dibuat sejak masuk chatbot', res.sesi_id);
    rememberSesiId(siswa_id, mapel_id, elemen_id, materi_id, res.sesi_id);
    return res.sesi_id;
  } catch (err) {
    console.error('[Mentor] createSesi: POST /sesi gagal', err);
    const fallback = `local_${siswa_id}_${mapel_id}_${elemen_id}`;
    rememberSesiId(siswa_id, mapel_id, elemen_id, materi_id, fallback);
    return fallback;
  }
}

export async function sendMessage(payload) {
  console.log('[Mentor] sendMessage: START', { has_hasil_quiz_id: !!payload.hasil_quiz_id });
  const sesi_id = await ensureSesiForMentor(payload);
  const body = toMentorBody(payload, sesi_id);
  console.log('[Mentor] sendMessage: POST /mentor/pesan', { sesi_id });
  const data = await v3.post("/mentor/pesan", body);
  if (data?.sesi_id) {
    rememberSesiId(
      payload.siswa_id,
      payload.mapel_id,
      payload.elemen_id,
      payload.materi_id,
      data.sesi_id,
    );
  }
  console.log('[Mentor] sendMessage: DONE', { balasan_len: data?.balasan?.length ?? 0 });
  return { reply: data.balasan ?? "", session_id: data.sesi_id ?? sesi_id };
}

export function streamMessage(payload, onChunk, onDone, onError) {
  console.log('[Mentor] streamMessage: START', { has_hasil_quiz_id: !!payload.hasil_quiz_id });
  const ref = { cancel: () => { } };
  (async () => {
    try {
      const sesi_id = await ensureSesiForMentor(payload);
      const body = toMentorBody(payload, sesi_id);
      console.log('[Mentor] streamMessage: POST /mentor/pesan/stream', { sesi_id });
      ref.cancel = openStream(
        "/mentor/pesan/stream",
        body,
        onChunk,
        onDone,
        onError,
      );
    } catch (e) {
      console.error('[Mentor] streamMessage: ERROR', e);
      onError?.(e);
    }
  })();
  return () => ref.cancel?.();
}

/**
 * sendEvaluasi — evaluasi quiz via endpoint terpisah (non-streaming).
 * POST /mentor/evaluasi
 * REFACTOR 4: Mentor Evaluasi Terpisah — Integration Guide V3.3 §7 & §12
 */
export async function sendEvaluasi(payload) {
  console.log('[Mentor] sendEvaluasi: START', { hasil_quiz_id: payload.hasil_quiz_id });
  const sesi_id = await ensureSesiForMentor(payload);
  const body = toEvaluasiBody(payload, sesi_id);
  console.log('[Mentor] sendEvaluasi: POST /mentor/evaluasi', { sesi_id });
  const data = await v3.post("/mentor/evaluasi", body);
  console.log('[Mentor] sendEvaluasi: DONE');
  return { reply: data.balasan ?? "", session_id: data.sesi_id ?? sesi_id };
}

/**
 * streamEvaluasi — evaluasi quiz via endpoint terpisah (streaming SSE).
 * POST /mentor/evaluasi/stream
 * REFACTOR 4: Mentor Evaluasi Terpisah — Integration Guide V3.3 §7 & §12
 */
export function streamEvaluasi(payload, onChunk, onDone, onError) {
  console.log('[Mentor] streamEvaluasi: START', { hasil_quiz_id: payload.hasil_quiz_id });
  const ref = { cancel: () => {} };
  (async () => {
    try {
      const sesi_id = await ensureSesiForMentor(payload);
      const body = toEvaluasiBody(payload, sesi_id);
      console.log('[Mentor] streamEvaluasi: POST /mentor/evaluasi/stream', { sesi_id });
      ref.cancel = openStream(
        "/mentor/evaluasi/stream",
        body,
        onChunk,
        onDone,
        onError,
      );
    } catch (e) {
      console.error('[Mentor] streamEvaluasi: ERROR', e);
      onError?.(e);
    }
  })();
  return () => ref.cancel?.();
}

export async function getChatHistory(params) {
  const siswa_id = params.siswa_id;
  const mapel_id = params.mapel_id || "";
  const materi_id = params.materi_id || null;
  const elemen_id = params.elemen_id || "";

  let sesi_id =
    getStoredSesiId(siswa_id, mapel_id, elemen_id, materi_id) ||
    getStoredSesiId(siswa_id, mapel_id, "_", materi_id);
  if (!sesi_id) return [];

  const rows = await v3.get(
    `/sesi/${encodeURIComponent(sesi_id)}/chat`,
  );
  return mapChatHistoryV3(rows || []);
}