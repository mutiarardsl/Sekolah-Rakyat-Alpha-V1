/**
 * SR MVP — Konten / siswa / guru Terbit (PUBLIC API bagi komponen)
 *
 * Delegasi ke service layer (+ adapter V3).
 * Tetap hindari struktur envelope V3 langsung dari komponen.
 *
 * V3.3: tambah submitQuizMC, submitQuizEssay, regenerateContent
 */
export {
  generateContent,
  regenerateContent, // V3.3: regenerate konten per card via konten_id (REFACTOR 2)
  publishKonten,
  getKontenSiswa,
  getProgressSiswa,
  getProgressGuru,
  submitQuiz,
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
