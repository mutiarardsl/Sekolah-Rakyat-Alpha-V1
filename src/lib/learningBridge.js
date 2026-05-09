/**
 * Menjembatani pemanggilan mentor/sesi dengan konteks topik siswa tanpa mengubah UI.
 * Menyimpan publish_id dari bank konten & sesi_id dari POST /sesi / respons mentor.
 */

const bankKey = (siswaId, mapelId, elemenId, materiId) =>
  `${siswaId}|${mapelId}|${elemenId || "_"}|${materiId || "_"}`;

const publishMeta = new Map(); // bankKey → { publish_id }
const sesiRegistry = new Map(); // bankKey → sesi_id

export function recordPublishIdFromPaket(pakets, siswaId) {
  if (!siswaId || !Array.isArray(pakets)) return;
  for (const pkt of pakets) {
    if (!pkt?.publish_id) continue;
    const k = bankKey(siswaId, pkt.mapel_id, pkt.elemen_id, pkt.materi_id || null);
    publishMeta.set(k, { publish_id: pkt.publish_id, mapel_id: pkt.mapel_id, elemen_id: pkt.elemen_id, materi_id: pkt.materi_id ?? null });
  }
}

export function resolvePublishBundle(siswaId, mapelId, elemenId, materiId) {
  const k = bankKey(siswaId, mapelId, elemenId, materiId);
  if (publishMeta.has(k)) return publishMeta.get(k);
  for (const [key, meta] of publishMeta.entries()) {
    if (!key.startsWith(`${siswaId}|${mapelId}|`)) continue;
    if (materiId && meta.materi_id === materiId) return meta;
    if (elemenId && meta.elemen_id === elemenId && !meta.materi_id) return meta;
  }
  return null;
}

export function getStoredSesiId(siswaId, mapelId, elemenId, materiId) {
  return (
    sesiRegistry.get(bankKey(siswaId, mapelId, elemenId, materiId)) ||
    (materiId
      ? sesiRegistry.get(bankKey(siswaId, mapelId, "_", materiId))
      : null) ||
    null
  );
}

export function rememberSesiId(siswaId, mapelId, elemenId, materiId, sesiId) {
  if (!sesiId) return;
  sesiRegistry.set(bankKey(siswaId, mapelId, elemenId, materiId), sesiId);
  // Alias untuk getChatHistory yang tidak kirim elemen_id eksplisit
  if (materiId) {
    sesiRegistry.set(bankKey(siswaId, mapelId, "_", materiId), sesiId);
  }
}

export function clearSesiBridge() {
  publishMeta.clear();
  sesiRegistry.clear();
}
