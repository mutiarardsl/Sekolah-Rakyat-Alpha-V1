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
    // V3.1: hasil_quiz_id dari CTA "Tanya Kak Nusa" — undefined di flow normal
    hasil_quiz_id,
  } = payload;

  // V3.1: CTA flow — WAJIB buat sesi baru agar konteks_quiz terkirim ke BE.
  // Bypass cache (getStoredSesiId) karena sesi lama tidak membawa konteks quiz.
  const isCTAFlow = !!hasil_quiz_id;

  if (!isCTAFlow) {
    // Flow normal: gunakan sesi yang sudah ada jika tersedia
    const existing = getStoredSesiId(siswa_id, mapel_id, elemen_id, materi_id);
    if (existing) {
      console.log('[Mentor] ensureSesiForMentor: reuse existing sesi', existing);
      return existing;
    }
  } else {
    console.log('[Mentor] ensureSesiForMentor: CTA flow — buat sesi baru dengan konteks_quiz', {
      hasil_quiz_id,
      siswa_id, mapel_id, elemen_id, materi_id,
    });
  }

  const bun =
    resolvePublishBundle(siswa_id, mapel_id, elemen_id, materi_id) ||
    {};

  // V3.1: inject konteks_quiz hanya jika CTA flow
  const konteksQuizPayload = isCTAFlow
    ? { konteks_quiz: { hasil_quiz_id } }
    : {};

  try {
    const res = await v3.post("/sesi", {
      siswa_id,
      mapel_id,
      elemen_id,
      materi_id: materi_id || null,
      publish_id: bun.publish_id || "pub_local_bridge",
      ...konteksQuizPayload,
    });

    console.log('[Mentor] ensureSesiForMentor: sesi dibuat', res.sesi_id, isCTAFlow ? '(CTA)' : '(normal)');
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
    konteks: {
      emosi: payload.context?.emosi ?? null,
      progress: payload.context?.progress ?? null,
    },
  };
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
  const ref = { cancel: () => {} };
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
