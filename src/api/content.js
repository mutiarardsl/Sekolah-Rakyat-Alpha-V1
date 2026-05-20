/**
 * SR MVP — Konten / siswa / guru Terbit (PUBLIC API bagi komponen)
 *
 * Delegasi ke service layer (+ adapter V3).
 * Tetap hindari struktur envelope V3 langsung dari komponen.
 *
 * V3.3: tambah submitQuizMC, submitQuizEssay
 * regenerateContent dihapus — digabung ke generateContent (1 endpoint Tim 3)
 */
export {
  generateContent,   // handles generate baru & regenerate — 1 endpoint Tim 3
  publishKonten,
  getKontenSiswa,
  getProgressSiswa,
  getProgressGuru,
  // submitQuiz — DEPRECATED (V3.3): gunakan submitQuizMC / submitQuizEssay dari quiz.service.js
  getRecommendations,
  getRiwayatGuru,
  getPretestSoal,
  submitPretestJawaban,
  getContentInsight,
  getPretestStatus,
  getQuizHistory,
  generateSummary,
} from "../services/student/content.service.js";

export {
  submitQuizMC,    // V3.3: submit MC synchronous (REFACTOR 1)
  submitQuizEssay, // V3.3: submit Essay asynchronous (REFACTOR 1)
} from "../services/student/quiz.service.js";
