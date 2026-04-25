/**
 * SR MVP — Upload File Utility
 * Tim 6 Fase 2 | src/utils/uploadFile.js
 *
 * Wrapper upload file dengan progress tracking dan retry logic.
 * Dipakai oleh: upload kurikulum (admin), upload nilai (guru).
 */

import { uploadCurriculum } from "../api/content";
import { uploadNilai }      from "../api/admin";

/**
 * Upload kurikulum mapel ke Tim 3 RAG
 * @param {{ file:File, mapelId:string, deskripsi?:string }} opts
 * @param {function(number):void} onProgress  - 0..100
 * @returns {Promise<{ doc_id:string, chunk_count:number }>}
 */
export async function uploadKurikulum({ file, mapelId, deskripsi }, onProgress) {
  return uploadCurriculum({ file, mapel_id: mapelId, deskripsi }, onProgress);
}

/**
 * Upload file nilai guru ke backend
 * @param {{ file:File, kelasId:string, mapelId:string }} opts
 * @param {function(number):void} onProgress
 */
export async function uploadFileNilai({ file, kelasId, mapelId }, onProgress) {
  return uploadNilai({ file, kelas_id: kelasId, mapel_id: mapelId }, onProgress);
}

/**
 * Validasi file sebelum upload
 * @param {File} file
 * @param {{ maxMB?:number, accept?:string[] }} rules
 * @returns {{ valid:boolean, error?:string }}
 */
export function validateFile(file, { maxMB = 10, accept = [] } = {}) {
  if (maxMB && file.size > maxMB * 1024 * 1024) {
    return { valid: false, error: `Ukuran file melebihi ${maxMB}MB` };
  }
  if (accept.length) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!accept.includes(ext)) {
      return { valid: false, error: `Format tidak didukung. Gunakan: ${accept.join(", ")}` };
    }
  }
  return { valid: true };
}
