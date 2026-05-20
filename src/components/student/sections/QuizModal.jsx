/**
 * QuizModal.jsx — Komponen Latihan Soal Terintegrasi
 * 
 * Menggantikan quiz block di dalam ChatSection.jsx (bagian CenterModal Quiz)
 * 
 * STRUKTUR SOAL (per topik, disediakan Tim 3 via RAG):
 *   - 10 soal Multiple Choice (radio button)
 *   - 3 soal Essay
 * 
 * JENIS SOAL:
 *   - Pertanyaan singkat (teks biasa)
 *   - Literasi numerasi (disertai tabel/grafik deskriptif)
 *   - Soal bergambar (ada field `gambar` berisi URL/placeholder)
 * 
 * PENILAIAN ESSAY:
 *   Lihat section "Essay Scoring Strategy" di bawah untuk penjelasan lengkap.
 * 
 * INTEGRASI:
 *   Import komponen ini dan ganti blok {quizModal && <CenterModal>...</CenterModal>}
 *   di ChatSection.jsx dengan <QuizModal ... />
 */

import { useState, useEffect, useRef } from 'react';
import { Btn } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { submitQuizMC, submitQuizEssay } from '../../../api/content'; // FIX P1: simpan hasil quiz ke backend | V3.3: split MC/Essay
import { InlineLatex } from '../../shared/LatexRenderer';


/* ═══════════════════════════════════════════════════════════════════
 * ESSAY SCORING STRATEGY
 * ═══════════════════════════════════════════════════════════════════
 *
 * Penilaian essay TIDAK bisa otomatis seperti pilihan ganda karena:
 *   1. Jawaban bersifat open-ended — tidak ada satu jawaban benar
 *   2. Siswa bisa menjawab dengan kata berbeda tapi makna tepat
 *   3. Panjang & struktur jawaban bervariasi per siswa
 *
 * SOLUSI YANG DIIMPLEMENTASIKAN (Fase 2 → Fase 3):
 *
 * ── Fase 2 (sekarang) ───────────────────────────────────────────
 *   Essay TIDAK masuk ke dalam skor numerik total.
 *   Essay dikirim ke Mentor AI  sebagai CONTEXT INJECTION
 *   setelah quiz selesai. AI memberi feedback kualitatif berupa:
 *     "Jawaban essaymu tentang X sudah menyentuh poin Y, namun
 *      perlu diperdalam di bagian Z."
 *
 *   Skor quiz = (benar MC / 10) × 100 — hanya dari 10 soal MC.
 *   Essay muncul di review sebagai "Sedang dianalisis Mentor AI..."
 *
 * ── Fase 3 (rekomendasi Tim 3/5) ────────────────────────────────
 *   Opsi A — AI Scoring via RAG:
 *     Tim 3 menyediakan rubrik penilaian per topik.
 *     Tim 5 Mentor AI menilai essay dengan rubrik tersebut,
 *     menghasilkan skor 0–30 per soal (misal: 3 soal × 10 poin).
 *     Total skor = (MC benar / 10 × 60) + (essay score / 100 × 40)
 *
 *   Opsi B — Penilaian Guru Manual:
 *     Essay jawaban siswa dikirim ke dashboard guru.
 *     Guru memberi skor via MonitoringSection.
 *     Skor muncul di ProgressSection setelah guru submit.
 *
 *   Opsi C — Hybrid (direkomendasikan):
 *     AI memberi skor sementara (provisional) + feedback.
 *     Guru bisa override skor AI dari dashboard.
 *     Skor final = setelah guru review atau timeout 24 jam.
 *
 * ── Field yang perlu disiapkan Tim 3 di payload essay ───────────
 *   essayItems: [{
 *     soal: string,
 *     rubrik: string,       // kriteria penilaian (untuk AI/guru)
 *     bobotPoin: number,    // contoh: 10
 *     kunciJawaban: string, // poin-poin jawaban ideal (hidden dari siswa)
 *   }]
 * ═══════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════
 * DUMMY QUIZ BANK — FORMAT BARU
 * Struktur per topik:
 *   multipleChoice: array of 10 soal MC
 *   essay: array of 3 soal essay
 *
 * Jenis soal (via field `jenis`):
 *   'singkat'           — pertanyaan teks biasa
 *   'literasi_numerasi' — ada tabel/konteks numerik (field `konteks`)
 *   'bergambar'         — ada gambar (field `gambar` berisi URL/desc)
 * ═══════════════════════════════════════════════════════════════════ */
export const QUIZ_BANK_V2 = {
  'mat__Statistika': {
    multipleChoice: [
      // 1 — singkat
      {
        id: 1, jenis: 'singkat',
        soal: 'Mean dari data 4, 7, 8, 6, 5 adalah…',
        pilihan: ['5', '6', '7', '8'], jawaban: 1,
      },
      // 2 — singkat
      {
        id: 2, jenis: 'singkat',
        soal: 'Modus dari data 3, 3, 4, 5, 5, 5, 6 adalah…',
        pilihan: ['3', '4', '5', '6'], jawaban: 2,
      },
      // 3 — literasi numerasi (ada tabel konteks)
      {
        id: 3, jenis: 'literasi_numerasi',
        konteks: `Tabel nilai ulangan 5 siswa kelas X:
┌────────────┬───────┐
│ Nama       │ Nilai │
├────────────┼───────┤
│ Andi       │  70   │
│ Budi       │  85   │
│ Citra      │  90   │
│ Dina       │  75   │
│ Eko        │  80   │
└────────────┴───────┘`,
        soal: 'Berdasarkan tabel di atas, median nilai kelima siswa tersebut adalah…',
        pilihan: ['75', '80', '85', '90'], jawaban: 1,
      },
      // 4 — bergambar (diagram batang, digambarkan deskriptif)
      {
        id: 4, jenis: 'bergambar',
        gambar: {
          desc: 'Diagram batang penjualan es krim (cup): Senin 40, Selasa 55, Rabu 30, Kamis 65, Jumat 70',
          // Fase 3: ganti dengan URL gambar asli dari RAG
          // url: 'https://cdn.example.com/quiz/diagram-batang-eskrim.png'
        },
        soal: 'Berdasarkan diagram batang di atas, pada hari apakah penjualan es krim paling tinggi?',
        pilihan: ['Senin', 'Rabu', 'Kamis', 'Jumat'], jawaban: 3,
      },
      // 5 — literasi numerasi
      {
        id: 5, jenis: 'literasi_numerasi',
        konteks: `Data berat badan (kg) 8 siswa:
42, 45, 38, 50, 47, 42, 55, 41`,
        soal: 'Jangkauan (range) data berat badan di atas adalah…',
        pilihan: ['13 kg', '15 kg', '17 kg', '19 kg'], jawaban: 2,
      },
      // 6 — singkat
      {
        id: 6, jenis: 'singkat',
        soal: 'Simpangan baku merupakan akar dari…',
        pilihan: ['Mean', 'Median', 'Varians', 'Modus'], jawaban: 2,
      },
      // 7 — singkat
      {
        id: 7, jenis: 'singkat',
        soal: 'Diagram lingkaran cocok digunakan untuk menampilkan data…',
        pilihan: ['Kontinu', 'Proporsi/persentase', 'Urutan waktu', 'Frekuensi kumulatif'], jawaban: 1,
      },
      // 8 — bergambar
      {
        id: 8, jenis: 'bergambar',
        gambar: {
          desc: 'Grafik garis menunjukkan suhu rata-rata (°C) selama sepekan: Sen 28, Sel 30, Rab 27, Kam 32, Jum 31, Sab 29, Min 26',
        },
        soal: 'Berdasarkan grafik garis, selisih suhu tertinggi dan terendah dalam sepekan tersebut adalah…',
        pilihan: ['4°C', '5°C', '6°C', '7°C'], jawaban: 2,
      },
      // 9 — singkat
      {
        id: 9, jenis: 'singkat',
        soal: 'Kuartil atas (Q3) membagi data menjadi berapa persen dari bawah?',
        pilihan: ['25%', '50%', '75%', '100%'], jawaban: 2,
      },
      // 10 — literasi numerasi
      {
        id: 10, jenis: 'literasi_numerasi',
        konteks: `Hasil survei hobi 200 siswa SMA:
• Membaca     : 50 siswa
• Olahraga    : 80 siswa  
• Gaming      : 40 siswa
• Memasak     : 30 siswa`,
        soal: 'Persentase siswa yang hobi olahraga adalah…',
        pilihan: ['25%', '30%', '40%', '45%'], jawaban: 2,
      },
    ],
    essay: [
      // Essay 1 — pertanyaan singkat + analisis
      {
        id: 'e1', jenis: 'singkat',
        soal: 'Jelaskan perbedaan antara mean, median, dan modus. Berikan masing-masing satu contoh penggunaan yang tepat dalam kehidupan sehari-hari!',
        rubrik: 'Skor penuh: mendefinisikan ketiga konsep dengan benar dan memberikan contoh relevan. Skor sebagian: mendefinisikan tapi contoh kurang tepat.',
        bobotPoin: 10,
        placeholder: 'Tulis jawabanmu di sini. Jelaskan dengan bahasamu sendiri...',
      },
      // Essay 2 — literasi numerasi
      {
        id: 'e2', jenis: 'literasi_numerasi',
        konteks: `Dua kelas mendapat hasil ulangan sebagai berikut:
Kelas A: mean = 75, median = 78, modus = 80
Kelas B: mean = 75, median = 70, modus = 65`,
        soal: 'Meskipun mean kedua kelas sama (75), apakah kemampuan siswa di kedua kelas itu bisa dikatakan setara? Jelaskan analisismu menggunakan median dan modus yang tersedia!',
        rubrik: 'Skor penuh: menjelaskan bahwa mean saja tidak cukup, menggunakan median & modus untuk membedakan distribusi data, menarik kesimpulan yang logis.',
        bobotPoin: 10,
        placeholder: 'Analisis data di atas dan tuliskan pendapatmu...',
      },
      // Essay 3 — bergambar + interpretasi
      {
        id: 'e3', jenis: 'bergambar',
        gambar: {
          desc: 'Grafik batang: Nilai rata-rata UN Matematika SMA Kota X selama 5 tahun: 2020→62, 2021→58, 2022→65, 2023→71, 2024→68',
        },
        soal: 'Berdasarkan grafik di atas, identifikasi tren nilai UN Matematika dari 2020–2024. Menurutmu, faktor apa yang mungkin menyebabkan penurunan di tahun 2021 dan 2024? Berikan alasan yang logis!',
        rubrik: 'Skor penuh: mengidentifikasi tren naik-turun secara akurat, menyebutkan minimal 2 faktor yang logis dengan argumen yang jelas.',
        bobotPoin: 10,
        placeholder: 'Deskripsikan tren yang kamu lihat dan berikan analisismu...',
      },
    ],
  },
  // ── Fallback untuk topik lain (struktur minimal) ──────────────────
  _default: {
    multipleChoice: Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, jenis: 'singkat',
      soal: `Soal ${i + 1}: Pilih jawaban yang paling tepat untuk materi ini.`,
      pilihan: ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'], jawaban: 0,
    })),
    essay: [
      {
        id: 'e1', jenis: 'singkat',
        soal: 'Jelaskan pemahaman kamu tentang konsep utama materi ini dengan kata-katamu sendiri.',
        bobotPoin: 10,
        placeholder: 'Tulis jawabanmu di sini...',
      },
      {
        id: 'e2', jenis: 'singkat',
        soal: 'Berikan satu contoh nyata dari kehidupan sehari-hari yang berkaitan dengan materi ini.',
        bobotPoin: 10,
        placeholder: 'Tulis jawabanmu di sini...',
      },
      {
        id: 'e3', jenis: 'singkat',
        soal: 'Apa kesulitan terbesar yang kamu hadapi saat mempelajari materi ini? Bagaimana cara mengatasinya?',
        bobotPoin: 10,
        placeholder: 'Tulis jawabanmu di sini...',
      },
    ],
  },
};

export const getQuizV2 = (key) => QUIZ_BANK_V2[key] || QUIZ_BANK_V2['_default'];

/* ═══════════════════════════════════════════════════════════════════
 * HELPER: ImagePlaceholder
 * Fase 2 menggunakan gambar placeholder berbasis deskripsi teks.
 * Fase 3: ganti dengan <img src={gambar.url} ... />
 * ═══════════════════════════════════════════════════════════════════ */
const ImagePlaceholder = ({ gambar }) => (
  <div style={{
    background: `${C.teal}0D`,
    border: `1.5px dashed ${C.teal}55`,
    borderRadius: 10,
    padding: '12px 16px',
    marginBottom: 12,
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  }}>
    <span style={{ fontSize: FS.h2, flexShrink: 0 }}>🖼️</span>
    <div>
      <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.teal, marginBottom: 3, textTransform: 'uppercase', letterSpacing: .5 }}>
        Ilustrasi Soal
      </div>
      <div style={{ fontSize: FS.sm, color: C.darkL, lineHeight: 1.6 }}>{gambar.desc}</div>
      <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 4, fontStyle: 'italic' }}>
        * Gambar akan tersedia saat konten dari Tim 3 (RAG) sudah diintegrasikan
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
 * HELPER: KonteksBox — untuk soal literasi numerasi
 * ═══════════════════════════════════════════════════════════════════ */
const KonteksBox = ({ konteks }) => (
  <div style={{
    background: `${C.teal}08`,
    border: `1px solid ${C.teal}33`,
    borderLeft: `3px solid ${C.teal}`,
    borderRadius: '0 8px 8px 0',
    padding: '10px 14px',
    marginBottom: 12,
    fontFamily: 'monospace',
    fontSize: 11.5,
    color: C.darkL,
    lineHeight: 1.8,
    whiteSpace: 'pre',
    overflowX: 'auto',
  }}>
    {konteks}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
 * HELPER: JenisBadge
 * ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
 * MAIN: QuizModal
 *
 * Props:
 *   open           : boolean — tampilkan modal
 *   onClose        : () => void
 *   chatMateri     : { mapelLabel }
 *   materiId      : string
 *   activeKey      : string — key untuk QUIZ_BANK_V2
 *   quizType       : 'mc' | 'essay' — jenis soal yang ditampilkan
 *   soalSnapshot   : array | null — jika ada, pakai soal ini (mode ulangi dari riwayat)
 *   onSubmit       : (result) => void — dipanggil saat kumpulkan jawaban
 * ═══════════════════════════════════════════════════════════════════ */

// Helper: konversi materiLabel ke format materi_id BE (§23.2 contract)
// Jika materiLabel = elemenLabel (flag FE untuk elemen tanpa materi) → return null
const toMateriId = (mapelId, materiLabel, elemenLabel) => {
  if (!materiLabel || materiLabel === elemenLabel) return null;
  return `${mapelId}__${materiLabel.toLowerCase().replace(/\s+/g, '_')}`;
};

/* ── Fisher-Yates shuffle (untuk generate soal baru acak) ── */
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const QuizModal = ({
  open,
  onClose,
  chatMateri,
  materiId,
  activeKey,
  confContent,
  quizType = 'mc',
  soalSnapshot = null,  // null = soal baru (diacak); array = soal yang sama dari riwayat
  currentLevel = 'low', // level siswa saat ini di elemen/materi ini ('low'|'mid'|'high')
  apiSoal = null,       // FIX T2: soal dari API (quiz_pg.byLevel / quiz_essay.byLevel); override QUIZ_BANK_V2
  onSubmit,
}) => {
  const quizData = getQuizV2(activeKey);

  // activeSoal: dihitung ulang setiap modal dibuka (bukan setiap render)
  // Disimpan di state agar tidak berubah saat user sedang mengerjakan
  const [activeSoal, setActiveSoal] = useState([]);
  const [mcAnswers, setMcAnswers] = useState({});
  const [essayAnswers, setEssayAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const bodyRef = useRef(null);

  // ── REVISI FASE 3: State untuk skor essay dari RAG ─────────────────
  // essay_score: skor essay yang dikembalikan backend (Tim RAG) setelah penilaian async
  // Dalam mock: langsung tersedia dari response POST /content/quiz/submit
  // Di produksi: bisa datang via webhook atau polling setelah beberapa detik
  const [essayScore, setEssayScore] = useState(null); // 0–100 dari RAG
  const [essayScoreLoading, setEssayScoreLoading] = useState(false);
  const [essayState, setEssayState] = useState('idle'); // V3.3: idle | pending | processing | completed | failed

  // Reset semua state setiap kali modal dibuka — ini fix untuk bug soal tidak reset
  useEffect(() => {
    if (!open) return;
    setMcAnswers({});
    setEssayAnswers({});
    setSubmitted(false);
    setEssayScore(null);
    setEssayScoreLoading(false);
    setEssayState('idle'); // V3.3
    if (bodyRef.current) bodyRef.current.scrollTop = 0;

    // Soal baru: acak urutan. Soal lama (ulangi): pakai snapshot persis
    if (soalSnapshot) {
      setActiveSoal(soalSnapshot);
    } else if (Array.isArray(apiSoal) && apiSoal.length > 0) {
      // FIX T2: API soal tersedia → normalisasi ke shape internal QuizModal lalu acak
      // API quiz_pg shape:    { soal, pilihan: string[], jawaban: number(index) }  — 10 soal
      // API quiz_essay shape: { soal, rubrik }                         — 5 soal
      // Fallback s.pertanyaan dipertahankan untuk kompatibilitas backward (BE mungkin beda key)
      const normalized = apiSoal.map((s, idx) => {
        if (quizType === 'essay') {
          // essay: baca s.soal (shape baru) dengan fallback s.pertanyaan (shape lama/BE)
          return {
            id: s.id ?? idx + 1,
            soal: s.soal || s.pertanyaan || '',
            rubrik: s.rubrik || null,
          };
        }
        // mc: jawaban adalah index (number), bukan string — sesuai shape handler
        return {
          id: s.id ?? idx + 1,
          jenis: s.jenis || 'singkat',
          soal: s.soal || '',
          pilihan: Array.isArray(s.pilihan) ? s.pilihan : [],
          jawaban: typeof s.jawaban === 'number' ? s.jawaban : 0,
          konteks: s.konteks || null,
          gambar: s.gambar || null,
        };
      });
      setActiveSoal(shuffleArray(normalized));
    } else {
      const pool = quizType === 'mc' ? quizData.multipleChoice : quizData.essay;
      setActiveSoal(shuffleArray(pool));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const mcSoal = quizType === 'mc' ? activeSoal : [];
  const essaySoal = quizType === 'essay' ? activeSoal : [];

  const isMC = quizType === 'mc';
  const isEssay = quizType === 'essay';

  const mcAnsweredCount = Object.keys(mcAnswers).length;
  const essayAnsweredCount = Object.values(essayAnswers).filter(v => v && v.trim().length > 20).length;
  const allMcAnswered = isMC && mcAnsweredCount === mcSoal.length;

  const mcCorrect = isMC ? mcSoal.filter((s, i) => mcAnswers[i] === s.jawaban).length : 0;
  const mcScore = isMC ? Math.round((mcCorrect / mcSoal.length) * 100) : 0;

  // ── REVISI FASE 3: KKM baru 75, sistem agregasi MC + Essay ─────────
  // KKM_BARU: 75 (dari 80 sebelumnya)
  // Logika naik level: rata-rata(mcScore, essayScore) >= KKM_BARU
  // Jika hanya MC yang dikerjakan: mcScore >= KKM_BARU
  // Jika hanya Essay: ditentukan dari essay_score RAG >= KKM_BARU
  // Jika keduanya ada: rata-rata keduanya >= KKM_BARU
  const KKM = 75; // KKM baru Fase 3
  const passed = mcScore >= KKM; // untuk MC standalone

  const handleSubmit = async () => {
    if (isMC) {
      const wrongItems = mcSoal
        .map((s, i) => ({
          soal: s.soal,
          jawaban: s.pilihan[s.jawaban],
          userAns: s.pilihan[mcAnswers[i]] ?? '(tidak dijawab)',
        }))
        .filter((_, i) => mcAnswers[i] !== mcSoal[i].jawaban);

      setSubmitted(true);

      // FIX P1: kirim skor MC ke backend via POST /siswa/:id/quiz/mc (V3.3)
      // Fire-and-forget — tidak block UI jika API gagal
      const siswaId = chatMateri?.siswaId || useStudentStore.getState().user?.id || '';
      const levelCapitalized = (currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1));
      // V3.3 REFACTOR 1: gunakan submitQuizMC (sync, nilai langsung tersedia)
      submitQuizMC({
        siswa_id: siswaId,
        publish_id: confContent?.[activeKey]?._publishId || '',
        mapel_id: chatMateri?.mapelId || '',
        elemen_id: chatMateri?.elemenId || '',
        elemen_label: chatMateri?.elemenLabel || chatMateri?.mapelLabel || '',
        materi: chatMateri?.materiLabel || null,
        materi_id: toMateriId(chatMateri?.mapelId, materiId, chatMateri?.elemenLabel),
        quiz_type: 'mc',
        level: levelCapitalized,
        answers: { ...mcAnswers },
        score: mcScore,
      }).then((res) => {
        const hasilQuizId = res?.hasil_quiz_id ?? null;
        onSubmit?.({
          type: 'mc',
          score: mcScore,
          correct: mcCorrect,
          total: mcSoal.length,
          materiId: materiId || chatMateri?.mapelLabel,
          mapelLabel: chatMateri?.mapelLabel,
          wrongItems,
          answers: { ...mcAnswers },
          soalSnapshot: mcSoal,
          // REVISI FASE 3: sertakan KKM baru agar ChatSection bisa evaluasi level-up
          kkm: KKM,
          passed: mcScore >= KKM,
          // V3.1: opaque ID untuk CTA "Tanya Mentor AI"
          hasil_quiz_id: hasilQuizId,
        });
      }).catch(() => {
        // Fallback jika API gagal — tetap panggil onSubmit tanpa hasil_quiz_id
        onSubmit?.({
          type: 'mc',
          score: mcScore,
          correct: mcCorrect,
          total: mcSoal.length,
          materiId: materiId || chatMateri?.mapelLabel,
          mapelLabel: chatMateri?.mapelLabel,
          wrongItems,
          answers: { ...mcAnswers },
          soalSnapshot: mcSoal,
          kkm: KKM,
          passed: mcScore >= KKM,
          hasil_quiz_id: null,
        });
      });
    } else {
      // ── V3.3 REFACTOR 1: Essay submit — async via POST /siswa/:id/quiz/essay ──────────────
      // 1. Tampilkan submitted segera (UX: tidak blokir user)
      setSubmitted(true);
      setEssayScoreLoading(true);
      setEssayState('pending'); // V3.3

      const siswaId = chatMateri?.siswaId || useStudentStore.getState().user?.id || '';
      const levelCapitalized = (currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1));

      try {
        // 2. POST ke backend — V3.3: essay async, nilai datang via WebSocket essay_dinilai
        const response = await submitQuizEssay({
          siswa_id: siswaId,
          publish_id: confContent?.[activeKey]?._publishId || '',
          mapel_id: chatMateri?.mapelId || '',
          elemen_id: chatMateri?.elemenId || '',
          elemen_label: chatMateri?.elemenLabel || chatMateri?.mapelLabel || '',
          materi: chatMateri?.materiLabel || null,
          materi_id: toMateriId(chatMateri?.mapelId, materiId, chatMateri?.elemenLabel),
          quiz_type: 'essay',
          level: levelCapitalized,
          answers: { ...essayAnswers },
          score: 0,
        });

        // 3. V3.3: response menunggu_penilaian: true — nilai datang via WS essay_dinilai
        const hasilQuizId = response?.hasil_quiz_id ?? null;

        if (response?.menunggu_penilaian) {
          // V3.3 Async path — tampilkan "Sedang dinilai..." dan tunggu WS essay_dinilai
          setEssayState('processing');
          setEssayScoreLoading(true);
          // Tetap panggil onSubmit agar ChatSection tahu submit berhasil
          onSubmit?.({
            type: 'essay',
            score: null,              // null — menunggu penilaian Tim 3
            quizType: 'essay',
            materiId: materiId || chatMateri?.mapelLabel,
            mapelLabel: chatMateri?.mapelLabel,
            essayAnswers: { ...essayAnswers },
            soalSnapshot: essaySoal,
            isEssay: true,
            kkm: KKM,
            passed: false,           // false sampai WS essay_dinilai datang
            hasil_quiz_id: hasilQuizId,
            menunggu_penilaian: true, // V3.3: flag untuk ChatSection
          });
        } else {
          // Sync fallback (jika BE langsung kembalikan nilai)
          const ragEssayScore = response?.score ?? null;
          setEssayScore(ragEssayScore);
          setEssayScoreLoading(false);
          setEssayState('completed'); // V3.3
          onSubmit?.({
            type: 'essay',
            score: ragEssayScore,
            quizType: 'essay',
            materiId: materiId || chatMateri?.mapelLabel,
            mapelLabel: chatMateri?.mapelLabel,
            essayAnswers: { ...essayAnswers },
            soalSnapshot: essaySoal,
            isEssay: true,
            kkm: KKM,
            passed: ragEssayScore != null ? ragEssayScore >= KKM : false,
            hasil_quiz_id: hasilQuizId,
          });
        }
      } catch {
        // Fallback jika API gagal — essay tetap tersimpan lokal
        setEssayScoreLoading(false);
        setEssayScore(null);
        setEssayState('failed'); // V3.3
        onSubmit?.({
          type: 'essay',
          score: null,
          materiId: materiId || chatMateri?.mapelLabel,
          mapelLabel: chatMateri?.mapelLabel,
          essayAnswers: { ...essayAnswers },
          soalSnapshot: essaySoal,
          isEssay: true,
          kkm: KKM,
          passed: false,
          hasil_quiz_id: null,
        });
      }
    }
  };

  const handleReset = () => {
    setMcAnswers({});
    setEssayAnswers({});
    setSubmitted(false);
  };

  // Warna header: amber untuk MC, ungu untuk essay
  const color = isMC ? `linear-gradient(135deg,${C.teal},${C.tealL})` : `linear-gradient(135deg,${C.teal},${C.tealL})`;
  const headerIcon = isMC ? '🔘' : '✍️';
  const headerLabel = isMC ? `Pilihan Ganda — ${materiId}` : `Essay — ${materiId}`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(26,35,50,.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="bounce-in"
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16,
          width: '70vw', maxWidth: 680, minWidth: 320,
          height: 'calc(100vh - 32px)', maxHeight: 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,.28)',
          overflow: 'hidden',
        }}
      >

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{
          padding: '16px 22px',
          background: color,
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>{headerIcon}</span>
          <div style={{ flex: 1, color: C.white }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{headerLabel}</div>
            <div style={{ fontSize: FS.sm, opacity: .8 }}>
              {chatMateri?.mapelLabel} · {isMC ? `${mcSoal.length} soal` : `${essaySoal.length} soal essay`}
              {soalSnapshot && <span style={{ marginLeft: 8, opacity: .8 }}>· Soal tersimpan</span>}
            </div>
          </div>
          {!submitted && isMC && (
            <div style={{
              fontSize: FS.sm, color: 'rgba(255,255,255,.85)',
              padding: '4px 12px', borderRadius: 99,
              background: 'rgba(255,255,255,.15)',
            }}>
              {mcAnsweredCount}/{mcSoal.length} dijawab
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: 'none',
              borderRadius: 8, width: 32, height: 32,
              color: C.white, cursor: 'pointer', fontSize: FS.h3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>


        {/* ── BODY ────────────────────────────────────────────────── */}
        <div
          ref={bodyRef}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 26px' }}
        >

          {/* ══ BODY: PILIHAN GANDA ══ */}
          {isMC && !submitted && (
            <>
              {/* Instruksi */}
              <div style={{
                background: `${color}08`, border: `1px solid ${color}22`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                fontSize: FS.sm, color: C.darkL, display: 'flex', gap: 8,
              }}>
                <span>💡</span>
                <span>Pilih <strong>satu jawaban terbaik</strong> untuk setiap soal. Soal bertanda 📊 disertai konteks data, dan 🖼️ disertai ilustrasi.</span>
              </div>

              {mcSoal.map((s, si) => (
                <div key={s.id} style={{ marginBottom: 24 }}>
                  {/* Nomor + badge jenis */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    marginBottom: 8, flexWrap: 'wrap', gap: 4,
                  }}>
                    <span style={{
                      fontSize: FS.sm, color: color, fontWeight: 800,
                      background: `${color}12`, padding: '2px 8px',
                      borderRadius: 99,
                    }}>
                      {si + 1}
                    </span>
                  </div>

                  {/* Konteks numerasi */}
                  {s.jenis === 'literasi_numerasi' && s.konteks && (
                    <KonteksBox konteks={s.konteks} />
                  )}

                  {/* Gambar soal */}
                  {s.jenis === 'bergambar' && s.gambar && (
                    <ImagePlaceholder gambar={s.gambar} />
                  )}

                  {/* Pertanyaan */}
                  <div style={{
                    fontSize: FS.base,
                    fontWeight: 600, color: C.dark,
                    marginBottom: 12, lineHeight: 1.6,
                  }}>
                    <InlineLatex text={s.soal} />
                  </div>

                  {/* Pilihan — grid 2 kolom */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {s.pilihan.map((p, pi) => {
                      const selected = mcAnswers[si] === pi;
                      return (
                        <button
                          key={pi}
                          onClick={() => setMcAnswers(a => ({ ...a, [si]: pi }))}
                          style={{
                            textAlign: 'left', padding: '10px 14px',
                            borderRadius: 10,
                            border: `2px solid ${selected ? color : C.tealXL}`,
                            background: selected ? `${color}12` : C.white,
                            cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: FS.base,
                            color: selected ? color : C.dark,
                            fontWeight: selected ? 700 : 400,
                            transition: 'all .15s',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                        >
                          {/* Radio visual */}
                          <span style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: FS.sm, fontWeight: 800,
                            background: selected ? color : C.cream,
                            color: selected ? C.white : C.slate,
                            transition: 'all .15s',
                          }}>
                            {String.fromCharCode(65 + pi)}
                          </span>
                          <span>
                            <span style={{ fontWeight: 800, marginRight: 6 }}>
                              {String.fromCharCode(65 + pi)}.
                            </span>
                            <InlineLatex text={p} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ══ BODY: ESSAY ══ */}
          {isEssay && !submitted && (
            <>
              {/* Info penilaian essay */}
              <div style={{
                background: `${C.teal}0D`,
                border: `1px solid ${C.teal}33`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                fontSize: FS.sm, color: C.teal,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <span>🤖</span>
                <div>
                  Jawaban essaymu akan dianalisis oleh Mentor AI.
                  Tulis dengan kata-katamu sendiri, tidak perlu takut salah!
                </div>
              </div>

              {essaySoal.map((s, si) => {
                const val = essayAnswers[s.id] || '';
                const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
                const isGood = wordCount >= 30;
                return (
                  <div key={s.id} style={{ marginBottom: 28 }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 8, flexWrap: 'wrap',
                    }}>
                      <span style={{
                        fontSize: FS.sm, color: C.teal, fontWeight: 800,
                        background: `${C.teal}12`, padding: '2px 8px', borderRadius: 99,
                      }}>
                        Essay {si + 1}
                      </span>
                    </div>

                    {/* Konteks */}
                    {s.jenis === 'literasi_numerasi' && s.konteks && (
                      <KonteksBox konteks={s.konteks} />
                    )}

                    {/* Gambar */}
                    {s.jenis === 'bergambar' && s.gambar && (
                      <ImagePlaceholder gambar={s.gambar} />
                    )}

                    {/* Pertanyaan */}
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, color: C.dark,
                      marginBottom: 12, lineHeight: 1.7,
                    }}>
                      <InlineLatex text={s.soal} />
                    </div>

                    {/* Textarea */}
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={val}
                        onChange={e => setEssayAnswers(prev => ({ ...prev, [s.id]: e.target.value }))}
                        placeholder="Tulis jawabanmu di sini..."
                        style={{
                          width: '100%', padding: '12px 14px',
                          border: `1.5px solid ${val.length > 0 ? (isGood ? C.green : C.tealXL) : C.tealXL}`,
                          borderRadius: 10, fontSize: FS.base,
                          resize: 'vertical', outline: 'none',
                          minHeight: 120, lineHeight: 1.7,
                          fontFamily: 'inherit', color: C.dark,
                          transition: 'border-color .2s',
                          boxSizing: 'border-box',
                        }}
                        rows={5}
                      />
                      {/* Word count */}
                      <div style={{
                        position: 'absolute', bottom: 8, right: 10,
                        fontSize: FS.xs, color: isGood ? C.green : C.slate,
                        fontWeight: 600,
                      }}>
                        {wordCount} kata {isGood ? '✓' : '(min. ~30 kata)'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ══ HASIL: MC ══ */}
          {isMC && submitted && (() => {
            const pass = passed;
            const levelLabels = { low: 'Low', mid: 'Mid', high: 'High' };
            const nextLevelMap = { low: 'mid', mid: 'high', high: 'high' };
            const nextLevel = nextLevelMap[currentLevel] || 'high';
            const isMaxLevel = currentLevel === 'high';
            const willLevelUp = pass && !isMaxLevel;

            return (
              <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
                {/* ── Header seragam: ✅ + label + skor ── */}
                <div style={{ fontSize: 52, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: color, marginBottom: 4 }}>
                  Jawaban Pilihan Ganda Terkirim
                </div>
                <div style={{ fontWeight: 800, fontSize: 40, color: pass ? C.green : C.amber, marginBottom: 14 }}>
                  {mcScore}
                </div>

                {/* ── REVISI FASE 3: Info sistem agregasi ─── */}
                <div style={{
                  background: '#F0FDFA', border: '1px solid #90CDF4',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                  fontSize: FS.xs, color: '#0D5C63', lineHeight: 1.6, textAlign: 'left',
                }}>
                  <strong>📊 Sistem Penilaian Agregasi (Fase 3):</strong><br />
                  Skor MC kamu: <strong>{mcScore}/100</strong><br />
                  Naik level jika: rata-rata <strong>MC + Essay ≥ KKM ({KKM})</strong><br />
                  {pass
                    ? '✅ Skor MC sudah melampaui KKM — jika Essay juga ≥ KKM, kamu akan naik level.'
                    : `📝 Kerjakan Essay juga agar rata-rata agregasi bisa ≥ ${KKM}.`}
                </div>

                {/* Banner naik level */}
                {willLevelUp && (
                  <div style={{
                    background: 'linear-gradient(135deg, #F0FFF4, #C6F6D5)',
                    border: '1.5px solid #68D391',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
                    display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 28, flexShrink: 0 }}>⬆️</span>
                    <div>
                      <div style={{ fontWeight: 800, color: '#276749', fontSize: FS.base, marginBottom: 3 }}>
                        Selamat! Semua konten naik ke Level {levelLabels[nextLevel]}
                      </div>
                      <div style={{ fontSize: FS.sm, color: '#2F855A', lineHeight: 1.6 }}>
                        Konten bacaan, flashcard, game, dan quiz di elemen/materi ini otomatis naik ke <strong>Level {levelLabels[nextLevel]}</strong>.
                        Riwayat quiz Level {levelLabels[currentLevel]} masih bisa kamu lihat, tapi tidak bisa dikerjakan ulang.
                      </div>
                    </div>
                  </div>
                )}

                {/* Banner belum KKM */}
                {!pass && (
                  <div style={{
                    background: '#FFFBF0', border: '1.5px solid #F6AD55',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 16,
                    display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>📋</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#B7791F', fontSize: FS.md, marginBottom: 3 }}>
                        KKM Agregasi: {KKM} — Nilaimu: {mcScore}
                      </div>
                      <div style={{ fontSize: FS.sm, color: '#975A16', lineHeight: 1.6 }}>
                        Nilai yang digunakan adalah nilai quiz <strong>terbaru</strong>. Kamu bisa mengulang quiz ini.
                        Naik level ditentukan dari rata-rata nilai MC dan Essay — kerjakan keduanya untuk hasil terbaik!
                      </div>
                    </div>
                  </div>
                )}

                {/* Review MC */}
                <div style={{ textAlign: 'left', background: C.cream, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark, marginBottom: 12 }}>🔍 Review Jawaban</div>
                  {mcSoal.map((s, si) => {
                    const userAns = mcAnswers[si];
                    const correct = userAns === s.jawaban;
                    return (
                      <div key={si} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: si < mcSoal.length - 1 ? `1px solid rgba(13,92,99,.07)` : 'none' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 3 }}>
                          <span style={{ fontSize: FS.base, flexShrink: 0 }}>{correct ? '✅' : '❌'}</span>
                          <div style={{ fontSize: FS.sm, color: C.dark, fontWeight: 600, lineHeight: 1.4 }}>
                            {si + 1}. <InlineLatex text={s.soal} />
                          </div>
                        </div>
                        <div style={{ marginLeft: 20, fontSize: 11 }}>
                          {correct
                            ? <span style={{ color: C.green }}>Jawabanmu: <InlineLatex text={s.pilihan[userAns]} /></span>
                            : <div>
                              <span style={{ color: C.red }}>Jawabanmu: <InlineLatex text={s.pilihan[userAns] ?? '(tidak dijawab)'} /></span>
                              <span style={{ color: C.green, marginLeft: 10 }}>✓ Jawaban benar: <InlineLatex text={s.pilihan[s.jawaban]} /></span>
                            </div>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: FS.sm, color: C.slate, marginBottom: 8 }}>
                  {pass
                    ? 'Hasil tersimpan. Riwayat level ini bisa kamu lihat dari panel kanan.'
                    : 'Hasil tersimpan. Klik "Ulangi" di riwayat untuk mengerjakan soal yang sama.'}
                </div>
              </div>
            );
          })()}

          {/* ══ HASIL: ESSAY ══ */}
          {isEssay && submitted && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {/* ── Header seragam: ✅ + label + skor ── */}
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 800, fontSize: 22, color: C.teal, marginBottom: 4 }}>
                Jawaban Essay Terkirim
              </div>
              {/* Nilai quiz essay — tampilkan skor tanpa /100 */}
              {/* V3.3: gunakan essayState untuk state yang lebih granular */}
              {(essayScoreLoading || essayState === 'processing') ? (
                <div style={{ fontSize: FS.sm, color: C.teal, marginBottom: 14 }}>⏳ Sedang dinilai oleh sistem...</div>
              ) : essayState === 'failed' ? (
                <div style={{ fontSize: FS.sm, color: C.amber, marginBottom: 14 }}>⚠️ Gagal mengirim, coba lagi.</div>
              ) : essayScore != null ? (
                <div style={{ fontWeight: 800, fontSize: 40, color: essayScore >= KKM ? C.green : C.amber, marginBottom: 14 }}>
                  {essayScore}
                </div>
              ) : (
                <div style={{ marginBottom: 14 }} />
              )}


              <div style={{
                background: `${C.teal}0D`, border: `1px solid ${C.teal}33`,
                borderRadius: 12, padding: '14px 18px', textAlign: 'left', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: FS.md, color: C.teal, marginBottom: 8 }}>📋 Ringkasan Jawabanmu</div>
                {essaySoal.map((s, si) => {
                  const jawaban = essayAnswers[s.id] || '';
                  const wc = jawaban.trim().split(/\s+/).filter(Boolean).length;
                  return (
                    <div key={s.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: si < essaySoal.length - 1 ? `1px solid ${C.teal}22` : 'none' }}>
                      <div style={{ fontSize: FS.sm, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Essay {si + 1}: {s.soal.slice(0, 60)}...</div>
                      <div style={{ fontSize: FS.xs, color: jawaban ? C.green : C.red }}>
                        {jawaban ? `✓ ${wc} kata ditulis` : '✗ Belum dijawab'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: FS.sm, color: C.slate }}>
                Hasil disimpan ke riwayat. Gunakan tombol <strong>Ulangi</strong> di riwayat untuk mengerjakan soal yang sama.
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────── */}
        {!submitted && (
          <div style={{
            padding: '12px 22px', borderTop: `1px solid rgba(13,92,99,.07)`,
            display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
          }}>
            {isMC && (
              <>
                <div style={{ flex: 1, fontSize: FS.sm, color: C.slate }}>
                  {allMcAnswered
                    ? '✅ Semua soal dijawab'
                    : `${mcSoal.length - mcAnsweredCount} soal belum dijawab`}
                </div>
                <Btn
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!allMcAnswered}
                  style={{
                    fontSize: FS.md, padding: '9px 22px',
                    background: allMcAnswered ? `linear-gradient(135deg,${C.teal},${C.tealL})` : `linear-gradient(135deg,${C.teal},${C.tealL})`,
                  }}
                >
                  Kumpulkan Jawaban ✓
                </Btn>
              </>
            )}
            {isEssay && (
              <>
                <div style={{ flex: 1, fontSize: FS.sm, color: C.slate }}>
                  {essayAnsweredCount}/{essaySoal.length} soal sudah dijawab
                </div>
                <Btn
                  variant="primary"
                  onClick={handleSubmit}
                  style={{
                    fontSize: FS.md, padding: '9px 22px',
                    background: `linear-gradient(135deg,${C.teal},${C.teal}cc)`,
                  }}
                >
                  Kumpulkan Essay ✓
                </Btn>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizModal;