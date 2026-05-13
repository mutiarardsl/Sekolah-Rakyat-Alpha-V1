/**
 * Mentor Tim 5 — delegasi ke service (V3)
 * V3.3: tambah sendEvaluasi, streamEvaluasi untuk endpoint evaluasi terpisah
 */
export {
  sendMessage,
  streamMessage,
  sendEvaluasi,    // V3.3: evaluasi quiz — POST /mentor/evaluasi
  streamEvaluasi,  // V3.3: evaluasi quiz streaming — POST /mentor/evaluasi/stream
  getChatHistory,
  createSesi,
} from "../services/mentor/mentor.service.js";
