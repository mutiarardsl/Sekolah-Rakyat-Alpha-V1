/**
 * SR MVP — Konten / siswa / guru Terbit (PUBLIC API bagi komponen)
 *
 * Delegasi ke service layer (+ adapter V3).
 * Tetap hindari struktur envelope V3 langsung dari komponen.
 */
export {
  generateContent,
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
