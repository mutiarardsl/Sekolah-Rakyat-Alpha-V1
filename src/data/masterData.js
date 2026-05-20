import { C } from '../styles/tokens.js'

// ─────────────────────────────────────────────────────────────────────────────
// HIERARKI DATA:
//   mapel  →  materi  →  subMateri
//
//  • mapel    : mata pelajaran (tampil di mana saja)
//  • materi   : topik utama dalam mapel (tampil di siswa & monitoring guru)
//  • subMateri: detail per materi (HANYA di form konfigurasi game guru)
//
// ATURAN KONSISTENSI:
//   - STUDENTS.riwayat[].materiId  → id materi (bukan subMateri)
//   - STUDENTS.todayMateriId       → id materi aktif hari ini
//   - PROGRESS_DATA_INIT           → field `materiId` (key: mapelId__materiId)
//   - SEARCH_TOPICS                → satu entry per materi
//   - CONF_CONTENT_INIT            → key: `mapelId__materiId`
//   - QUIZ_DATA                    → key: `mapelId__materiId`
//   - GameSection SUB_MATERI_MAP   → subMateri per materi (hanya guru/game)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Mata Pelajaran (tanpa penjurusan — Sekolah Rakyat belum ada penjurusan) ──
export const ADMIN_MAPEL_LIST = [
  { id: "agama", label: "Pendidikan Agama", icon: "🕌" },
  { id: "bio", label: "Biologi", icon: "🧬" },
  { id: "pjok", label: "PJOK", icon: "⚽" },
  { id: "mat", label: "Matematika", icon: "📐" },
  { id: "sos", label: "Sosiologi", icon: "👥" },
  { id: "info", label: "Informatika", icon: "💻" },
  { id: "eko", label: "Ekonomi", icon: "💰" },
  { id: "ppkn", label: "Pendidikan Pancasila", icon: "🏛️" },
  { id: "bin", label: "Bahasa Indonesia", icon: "📖" },
  { id: "kka", label: "KKA", icon: "🤝" },
  { id: "eng", label: "Bahasa Inggris", icon: "🌐" },
  { id: "sej", label: "Sejarah", icon: "📜" },
  { id: "fis", label: "Fisika", icon: "⚛️" },
  { id: "ant", label: "Antropologi", icon: "🗿" },
  { id: "kim", label: "Kimia", icon: "🧪" },
  { id: "geo", label: "Geografi", icon: "🗺️" },
  { id: "seni", label: "Seni Budaya", icon: "🎨" },
];

/* ── STATUS CONFIG ────────────────────────────────────────────────── */
export const STATUS_CONFIG = {
  'Belum Aktif': { color: '#B7791F', label: 'Belum Aktif', icon: '⏳' },
  'Aktif': { color: C.teal, label: 'Aktif', icon: '✅' },
  'Non-Aktif': { color: '#C53030', label: 'Non-Aktif', icon: '⛔' },
};

// ─── Kurikulum Merdeka: mapelId → daftar ELEMEN ATP ───────────────────────
// Sesuai struktur Alur Tujuan Pembelajaran (ATP):
//   Mata Pelajaran → Elemen → Materi (diisi guru via upload ATP)
//
// Admin hanya mengelola sampai level ELEMEN.
// Materi di bawah elemen dikelola guru lewat upload ATP.
//
// Format elemen: { id: string, label: string }
// Seeder ini mencerminkan Kurikulum Merdeka resmi (Kepmendikbudristek).
export const KURIKULUM_ELEMEN = {
  agama: [
    { id: "aqidah", label: "Aqidah" },
    { id: "ibadah", label: "Ibadah" },
    { id: "akhlak", label: "Akhlak" },
    { id: "quran_hadis", label: "Al-Qur'an dan Hadis" },
    { id: "fiqh", label: "Fiqh" },
    { id: "sejarah_peradaban", label: "Sejarah Peradaban Islam" },
  ],
  bio: [
    { id: "pemahaman_bio", label: "Pemahaman Biologi" },
    { id: "keterampilan_proses", label: "Keterampilan Proses" },
  ],
  pjok: [
    { id: "bola_besar", label: "Permainan dan Olahraga Bola Besar" },
    { id: "bola_kecil", label: "Permainan dan Olahraga Bola Kecil" },
    { id: "bela_diri", label: "Beladiri" },
    { id: "senam", label: "Senam" },
    { id: "aktivitas_ritmik", label: "Aktivitas Ritmik" },
    { id: "kebugaran", label: "Kebugaran Jasmani" },
    { id: "renang", label: "Aktivitas Akuatik" },
    { id: "kesehatan", label: "Kesehatan" },
  ],
  mat: [
    { id: "bil_aljabar", label: "Bilangan dan Aljabar" },
    { id: "geometri", label: "Geometri dan Pengukuran" },
    { id: "data_statistika", label: "Data dan Statistika" },
    { id: "kalkulus", label: "Kalkulus" },
  ],
  sos: [
    { id: "pemahaman_sos", label: "Pemahaman Sosiologi" },
    { id: "keterampilan_sos", label: "Keterampilan Sosiologi" },
  ],
  info: [
    { id: "bk", label: "Berpikir Komputasional" },
    { id: "tk", label: "Teknologi Informasi dan Komunikasi" },
    { id: "sk", label: "Sistem Komputer" },
    { id: "jk", label: "Jaringan Komputer dan Internet" },
    { id: "apd", label: "Analisis Data" },
    { id: "apk", label: "Algoritma dan Pemrograman" },
    { id: "dsk", label: "Dampak Sosial Informatika" },
    { id: "plb", label: "Praktik Lintas Bidang" },
  ],
  eko: [
    { id: "konsep_eko", label: "Konsep Ilmu Ekonomi" },
    { id: "keseimbangan_pasar", label: "Keseimbangan Pasar" },
    { id: "perilaku_produsen", label: "Perilaku Produsen dan Konsumen" },
    { id: "kebijakan_makro", label: "Kebijakan Ekonomi Makro" },
    { id: "pembangunan", label: "Pembangunan Ekonomi" },
    { id: "ketenagakerjaan", label: "Ketenagakerjaan" },
    { id: "akuntansi", label: "Akuntansi Dasar" },
  ],
  ppkn: [
    { id: "pancasila", label: "Pancasila" },
    { id: "uud1945", label: "UUD NRI Tahun 1945" },
    { id: "binneka", label: "Bhinneka Tunggal Ika" },
    { id: "nkri", label: "Negara Kesatuan Republik Indonesia" },
  ],
  bin: [
    { id: "menyimak", label: "Menyimak" },
    { id: "membaca_memirsa", label: "Membaca dan Memirsa" },
    { id: "berbicara_mempresentasi", label: "Berbicara dan Mempresentasikan" },
    { id: "menulis", label: "Menulis" },
  ],
  kka: [
    { id: "komunikasi", label: "Kecakapan Komunikasi" },
    { id: "kolaborasi", label: "Kerja Kolaborasi" },
    { id: "kepemimpinan", label: "Kepemimpinan" },
    { id: "kewirausahaan", label: "Kewirausahaan Sosial" },
  ],
  eng: [
    { id: "menyimak_eng", label: "Menyimak" },
    { id: "membaca_eng", label: "Membaca dan Memirsa" },
    { id: "berbicara_eng", label: "Berbicara dan Mempresentasikan" },
    { id: "menulis_eng", label: "Menulis" },
  ],
  sej: [
    { id: "manusia_ruang_waktu", label: "Manusia, Ruang, dan Waktu" },
    { id: "sej_indonesia", label: "Sejarah Indonesia" },
    { id: "sej_dunia", label: "Sejarah Dunia" },
  ],
  fis: [
    { id: "pemahaman_fis", label: "Pemahaman Fisika" },
    { id: "keterampilan_proses_fis", label: "Keterampilan Proses" },
  ],
  ant: [
    { id: "konsep_ant", label: "Konsep Dasar Antropologi" },
    { id: "keanekaragaman", label: "Keanekaragaman Budaya" },
    { id: "perubahan_budaya", label: "Perubahan Sosial Budaya" },
  ],
  kim: [
    { id: "pemahaman_kim", label: "Pemahaman Kimia" },
    { id: "keterampilan_proses_kim", label: "Keterampilan Proses" },
  ],
  geo: [
    { id: "pemahaman_geo", label: "Pemahaman Geografi" },
    { id: "keterampilan_geo", label: "Keterampilan Geografi" },
  ],
  seni: [
    { id: "berpikir_artistik", label: "Berpikir dan Bekerja Artistik" },
    { id: "mengalami", label: "Mengalami" },
    { id: "menciptakan", label: "Menciptakan" },
    { id: "merefleksikan", label: "Merefleksikan" },
    { id: "berdampak", label: "Berdampak" },
  ],
};

// ─── Kurikulum Merdeka: mapelId → Capaian Pembelajaran (CP) per fase ─────
// Mengacu pada Permendikbudristek No. 5 Tahun 2022 tentang Standar Kompetensi Lulusan
// dan Keputusan Kepala BSKAP tentang Capaian Pembelajaran.
// CP ditulis per FASE (Fase E = Kelas X, Fase F = Kelas XI-XII).
// Format: { fase: string, deskripsi: string }
export const CAPAIAN_PEMBELAJARAN = {
  agama: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu menganalisis ayat-ayat Al-Qur'an dan hadis tentang kewajiban beribadah, memahami konsep aqidah Islam yang benar, mengamalkan akhlak mulia dalam kehidupan sehari-hari, memahami fiqh ibadah mahdhah dan mu'amalah, serta meneladani perjuangan tokoh-tokoh Islam dalam sejarah peradaban.",
    butir: [
      "Menganalisis dan menghafalkan ayat-ayat Al-Qur'an dan Hadis sesuai tema",
      "Memahami dan mengimplementasikan konsep aqidah Islam (tauhid rububiyyah, uluhiyyah, asma' wa sifat)",
      "Menerapkan akhlak terpuji (jujur, amanah, toleran) dalam kehidupan bermasyarakat",
      "Memahami ketentuan thaharah, shalat, puasa, zakat, dan haji",
      "Menganalisis perkembangan Islam dari masa Rasulullah hingga masa modern",
    ],
  },
  bio: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu memahami dan menerapkan konsep-konsep biologi melalui pengamatan dan percobaan sederhana. Mereka dapat menjelaskan organisasi kehidupan mulai dari sel hingga ekosistem, menganalisis hubungan antar organisme, serta mengembangkan keterampilan proses ilmiah.",
    butir: [
      "Menjelaskan struktur sel dan fungsi organel pada sel prokariotik dan eukariotik",
      "Menganalisis keanekaragaman hayati Indonesia dan upaya pelestariannya",
      "Memahami konsep ekosistem, rantai makanan, dan aliran energi",
      "Menerapkan metode ilmiah dalam merancang dan melakukan percobaan biologi",
      "Mengidentifikasi permasalahan biologi kontekstual dan mengajukan solusi berbasis sains",
    ],
  },
  mat: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu berpikir kritis dan kreatif melalui pemecahan masalah matematis. Mereka menguasai konsep bilangan dan aljabar, geometri, statistika, serta kalkulus dasar; dan mampu menggunakannya dalam konteks kehidupan nyata maupun lintas disiplin ilmu.",
    butir: [
      "Menyelesaikan masalah yang berkaitan dengan bilangan real, eksponen, logaritma, dan persamaan/pertidaksamaan linear",
      "Menganalisis dan menyelesaikan masalah geometri bidang dan ruang termasuk transformasi",
      "Mengolah dan menyajikan data statistik serta membuat kesimpulan berbasis probabilitas",
      "Memahami konsep limit, turunan, dan integral fungsi aljabar sederhana",
      "Memodelkan situasi nyata ke dalam representasi matematis dan menafsirkan hasilnya",
    ],
  },
  bin: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu menyimak informasi berupa paparan lisan, menginterpretasi teks, mengekspresikan pikiran dan perasaan secara lisan maupun tulisan, serta memahami berbagai jenis teks untuk keperluan komunikasi dan akademik.",
    butir: [
      "Mengidentifikasi dan menyimpulkan informasi dari berbagai teks yang didengar",
      "Membaca kritis berbagai teks (argumentasi, eksposisi, narasi, deskripsi) dan menafsirkan makna",
      "Menyampaikan pendapat, argumen, dan informasi secara lisan dengan struktur yang jelas",
      "Menulis berbagai jenis teks (surat dinas, laporan, esai) menggunakan kaidah bahasa baku",
      "Memahami dan menganalisis unsur pembangun karya sastra (cerpen, puisi, drama)",
    ],
  },
  eng: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik menggunakan bahasa Inggris untuk berkomunikasi dalam berbagai situasi sehari-hari dan konteks akademik. Mereka mampu memahami dan memproduksi teks lisan dan tulis yang relevan, serta mengembangkan kesadaran budaya dalam konteks global.",
    butir: [
      "Memahami informasi tersurat dan tersirat dari teks lisan dan visual berbahasa Inggris",
      "Membaca dan memahami teks tulis berbahasa Inggris dalam berbagai format dan tujuan",
      "Bercakap dan berpresentasi dalam bahasa Inggris dengan kelancaran dan ketepatan yang memadai",
      "Menulis teks berbahasa Inggris yang kohesif untuk tujuan deskriptif, naratif, dan argumentatif",
      "Mengidentifikasi nuansa budaya dalam teks berbahasa Inggris",
    ],
  },
  fis: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu memahami konsep dasar fisika melalui pengamatan dan eksperimen, menerapkan hukum-hukum fisika untuk menjelaskan fenomena alam, serta mengembangkan kemampuan berpikir ilmiah dalam pemecahan masalah fisika.",
    butir: [
      "Memahami besaran-besaran fisika (vektor dan skalar) dan menggunakannya dalam pengukuran",
      "Menganalisis gerak benda (GLB, GLBB) menggunakan hukum Newton",
      "Menerapkan konsep energi, usaha, dan kalor untuk menjelaskan fenomena fisika",
      "Mendeskripsikan gejala gelombang, bunyi, dan cahaya dalam kehidupan sehari-hari",
      "Merancang dan melaksanakan percobaan fisika sederhana dengan metode ilmiah",
    ],
  },
  kim: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik memahami struktur materi dan hubungannya dengan sifat-sifat bahan, menguasai stoikiometri dan reaksi kimia, serta mampu menerapkan konsep kimia dalam konteks lingkungan dan kehidupan sehari-hari.",
    butir: [
      "Mendeskripsikan struktur atom, sistem periodik unsur, dan ikatan kimia",
      "Menyelesaikan perhitungan stoikiometri dalam reaksi kimia",
      "Mengidentifikasi perubahan energi dalam reaksi eksoterm dan endoterm",
      "Merancang dan melaksanakan percobaan kimia sederhana dengan prosedur keselamatan",
      "Menghubungkan konsep kimia dengan isu lingkungan (polusi, energi terbarukan)",
    ],
  },
  eko: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik memahami konsep dasar ilmu ekonomi, menganalisis mekanisme pasar, memahami perilaku pelaku ekonomi, serta mampu mengidentifikasi kebijakan ekonomi dan dampaknya bagi masyarakat.",
    butir: [
      "Menjelaskan konsep kelangkaan, kebutuhan, dan pilihan dalam pengambilan keputusan ekonomi",
      "Menganalisis mekanisme permintaan, penawaran, dan keseimbangan pasar",
      "Mendeskripsikan perilaku konsumen dan produsen serta hubungannya dengan struktur pasar",
      "Memahami konsep pertumbuhan ekonomi, pembangunan, dan ketenagakerjaan",
      "Menyusun laporan keuangan sederhana menggunakan prinsip akuntansi dasar",
    ],
  },
  ppkn: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu menganalisis nilai-nilai Pancasila sebagai ideologi dan pandangan hidup bangsa, memahami hak dan kewajiban warga negara berdasarkan UUD 1945, menghargai keberagaman dalam bingkai Bhinneka Tunggal Ika, serta memiliki kesadaran sebagai warga NKRI.",
    butir: [
      "Menganalisis nilai-nilai Pancasila dan penerapannya dalam kehidupan bermasyarakat",
      "Memahami hak dan kewajiban warga negara serta lembaga-lembaga negara sesuai UUD 1945",
      "Mengidentifikasi keberagaman suku, agama, ras, dan antargolongan (SARA) sebagai kekuatan bangsa",
      "Menampilkan sikap dan perilaku yang mencerminkan persatuan dan kesatuan NKRI",
      "Menganalisis ancaman terhadap NKRI dan strategi pertahanan negara",
    ],
  },
  info: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu menerapkan berpikir komputasional dalam pemecahan masalah, menggunakan perangkat teknologi informasi, memahami sistem komputer dan jaringan, menganalisis data, serta memahami dampak sosial informatika.",
    butir: [
      "Menerapkan strategi berpikir komputasional (dekomposisi, abstraksi, pengenalan pola, algoritma)",
      "Menggunakan teknologi informasi dan komunikasi untuk mendukung aktivitas belajar dan produktivitas",
      "Memahami arsitektur sistem komputer, perangkat keras dan lunak",
      "Memahami konsep jaringan komputer dan internet serta aspek keamanan siber",
      "Mengolah dan menganalisis data menggunakan perangkat lunak, serta memahami dampak sosial teknologi",
    ],
  },
  sej: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu memahami konsep dasar sejarah, menganalisis perkembangan peradaban Indonesia dan dunia, serta mengembangkan kesadaran sejarah sebagai bagian dari identitas kebangsaan.",
    butir: [
      "Memahami konsep waktu, ruang, dan manusia sebagai unsur dasar sejarah",
      "Menganalisis asal-usul dan perkembangan manusia purba serta pengaruhnya terhadap peradaban",
      "Mendeskripsikan perkembangan kerajaan-kerajaan Hindu-Buddha dan Islam di Nusantara",
      "Menganalisis perjuangan bangsa Indonesia melawan kolonialisme hingga kemerdekaan",
      "Menghubungkan peristiwa sejarah Indonesia dengan konteks sejarah dunia",
    ],
  },
  geo: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu memahami konsep dasar geografi, menganalisis fenomena geosfer, menggunakan peta dan teknologi geospasial, serta menerapkan perspektif keruangan dalam memahami lingkungan sekitar.",
    butir: [
      "Menjelaskan konsep dasar geografi, objek studi, dan pendekatan geografi",
      "Menganalisis dinamika geosfer (litosfer, pedosfer, atmosfer, hidrosfer, biosfer)",
      "Menggunakan peta, citra penginderaan jauh, dan SIG dalam analisis fenomena geografis",
      "Mengidentifikasi potensi sumber daya alam Indonesia dan strategi pengelolaannya",
      "Menghubungkan permasalahan lingkungan dengan tindakan mitigasi berbasis geografi",
    ],
  },
  sos: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu mendeskripsikan gejala sosial, menganalisis dinamika masyarakat, memahami penelitian sosial sederhana, serta mengembangkan kepekaan sosial dan sikap toleran dalam kehidupan bermasyarakat.",
    butir: [
      "Mengidentifikasi gejala sosial dan fungsi sosiologi dalam memahami masyarakat",
      "Menjelaskan proses sosialisasi, nilai dan norma, serta pembentukan kepribadian",
      "Menganalisis interaksi sosial, kelompok sosial, dan lembaga sosial dalam masyarakat",
      "Mengidentifikasi penyimpangan sosial dan mekanisme pengendalian sosial",
      "Merancang penelitian sosial sederhana menggunakan metode kualitatif atau kuantitatif",
    ],
  },
  pjok: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu menunjukkan kemampuan dalam berbagai aktivitas jasmani, memahami konsep kebugaran, menerapkan pola hidup sehat, serta mengembangkan karakter sportif, tanggung jawab, dan kerjasama melalui aktivitas fisik.",
    butir: [
      "Mempraktikkan keterampilan gerak permainan olahraga beregu (bola besar dan kecil) dengan teknik yang benar",
      "Menampilkan keterampilan atletik dan senam lantai secara individual",
      "Merancang program latihan kebugaran jasmani yang sesuai dengan kebutuhan diri",
      "Menerapkan prinsip hidup sehat dalam keseharian (gizi, istirahat, higienitas)",
      "Menunjukkan sikap sportif, disiplin, dan tanggung jawab dalam berbagai aktivitas fisik",
    ],
  },
  seni: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu mengekspresikan diri melalui karya seni, mengapresiasi karya seni budaya Indonesia, menganalisis elemen-elemen visual dan artistik, serta memahami peran seni dalam kehidupan sosial dan budaya.",
    butir: [
      "Mengidentifikasi dan mengapresiasi karya seni rupa, musik, tari, dan teater Nusantara",
      "Mengekspresikan gagasan dan perasaan melalui proses berkarya seni",
      "Menganalisis elemen artistik (garis, warna, bentuk, ritme) dalam karya seni",
      "Merefleksikan proses berkarya untuk pengembangan diri sebagai seniman pemula",
      "Menampilkan karya seni yang berdampak bagi lingkungan sekitar",
    ],
  },
  kka: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu berkomunikasi efektif, berkolaborasi dalam tim, menunjukkan jiwa kepemimpinan, serta mengembangkan kewirausahaan sosial sebagai bekal partisipasi aktif dalam masyarakat.",
    butir: [
      "Berkomunikasi secara efektif dalam berbagai situasi formal dan informal",
      "Berkolaborasi dalam tim lintas latar belakang dengan mengedepankan empati dan saling menghargai",
      "Menunjukkan kemampuan mengambil inisiatif dan memimpin dengan integritas",
      "Mengidentifikasi masalah sosial di lingkungan sekitar dan merancang solusi berbasis kewirausahaan",
      "Mempresentasikan ide dan proyek dengan percaya diri kepada audiens nyata",
    ],
  },
  ant: {
    fase: "Fase E (Kelas X)",
    deskripsi: "Pada akhir fase ini, peserta didik mampu memahami konsep dasar antropologi, mengidentifikasi keanekaragaman budaya, menganalisis perubahan sosial-budaya, serta mengembangkan sikap menghargai perbedaan budaya dalam konteks global.",
    butir: [
      "Mendeskripsikan konsep budaya, sub-budaya, dan wujud kebudayaan menurut Koentjaraningrat",
      "Mengidentifikasi keanekaragaman suku bangsa, bahasa, dan tradisi di Indonesia",
      "Menganalisis dinamika perubahan sosial-budaya akibat globalisasi dan modernisasi",
      "Memahami metode penelitian etnografi sederhana melalui observasi partisipan",
      "Mengembangkan sikap relativisme budaya dalam menghadapi perbedaan budaya",
    ],
  },
};

// ─── KURIKULUM (backward-compat): mapelId → array label elemen (string) ──
// Dipakai komponen lama (ProgressSection, ChatSection, SearchSection)
// yang masih memakai format array string.
// Hapus alias ini setelah semua komponen migrasi ke KURIKULUM_ELEMEN.
export const KURIKULUM = Object.fromEntries(
  Object.entries(KURIKULUM_ELEMEN).map(([mapelId, elemenArr]) => [
    mapelId,
    elemenArr.map(e => e.label),
  ])
);

// SUBJECTS: gabungan mapel + materi-nya, dipakai di ChatSection & ProgressSection
export const SUBJECTS = ADMIN_MAPEL_LIST
  .filter(m => KURIKULUM[m.id])
  .map(m => ({ ...m, subs: KURIKULUM[m.id] }));

// ─── Kelas (Sekolah Rakyat saat ini hanya jenjang X) ──────────────────────
export const CLASSES = [
  { id: "x1", label: "Kelas X-1" },
  { id: "x2", label: "Kelas X-2" },
  { id: "x3", label: "Kelas X-3" },
];

// ─── TEACHERS ──────────────────────────────────────────────────────
export const TEACHERS = [
  // t1: multi-mapel (bio/fis/kim), bukan first login — untuk test multi-mapel
  {
    id: "g2", name: "Sri Dewi, S.Pd.", initials: "SD",
    mapel_ids: ["bio", "fis", "kim"],
    bg: `linear-gradient(135deg,${C.amber},${C.orange})`,
    isFirstLogin: false,
  },
  // t2: 1 mapel (mat), bukan first login — DEFAULT seeded
  {
    id: "g1", name: "Bpk. Hendra, M.Pd.", initials: "BH",
    mapelId: "mat",
    bg: `linear-gradient(135deg,${C.teal},${C.tealL})`,
    isFirstLogin: false,
  },
  // t3: 1 mapel (bin), IS first login — untuk test ForceChangePassword
  {
    id: "g3", name: "Ibu Ratna, S.Pd.", initials: "IR",
    mapelId: "bin",
    bg: `linear-gradient(135deg,${C.purple},#9B72DB)`,
    isFirstLogin: true,
  },
  // t4: multi-mapel (eko/sos/geo), bukan first login
  {
    id: "g4", name: "Bpk. Yoga, S.Pd.", initials: "BY",
    mapel_ids: ["eko", "sos", "geo"],
    bg: `linear-gradient(135deg,${C.green},#48BB78)`,
    isFirstLogin: false,
  },
];
export const SEEDED_TEACHER_ID = "g1";       // default: 1 mapel — ganti ke "t1" untuk test multi
export const SEEDED_TEACHER_ID_MULTI = "g2"; // referensi cepat untuk developer

// ─── STUDENTS ─────────────────────────────────────────────────────
// riwayat[].materiId  → id materi (dari KURIKULUM[mapelId])
// todayMateriId       → materi yang sedang/terakhir dipelajari hari ini
// todayMapelId        → mapel yang sedang/terakhir dipelajari hari ini
//
// violations (per sesi): daftar pelanggaran anti-cheat
// { detail: string, timestamp: "HH:MM" }
export const STUDENTS = [
  // ─── s1: Ahmad Fauzi — nilai rendah, tidak aktif, ada riwayat pelanggaran ───
  {
    id: "s1", name: "Ahmad Fauzi", nis: "2025001", avatar: "AF", avatarBg: "#E53E3E",
    kelas_id: "x1",
    emotionKey: "bingung",
    status: "Perhatian", lastActive: "4 hari lalu",
    todayActive: false,
    todayStudyHours: null, todayLastQuiz: null,
    todayMapelId: null, todayMateriId: null, todayLevel: null,
    riwayat: [
      {
        tanggal: "Senin, 10 Mar 2026",
        mapelId: "mat", materiId: "Aljabar Dasar",
        durasi: 0.5,
        quiz_results: [
          { type: "mc", level: "mid", score: 30, ts: "09:25" },
          // essay belum dikerjakan
        ],
        emosiSesi: [{ jam: "09:00", emosi: "tidak_terdeteksi" }, { jam: "09:10", emosi: "bingung" }, { jam: "09:20", emosi: "frustrasi" }, { jam: "09:30", emosi: "frustrasi" }],
        violations: [
          { detail: "Membuka Aplikasi / Window Lain", timestamp: "09:08" },
          { detail: "Browser Diperkecil / Split Screen", timestamp: "09:22" },
        ]
      },
      {
        tanggal: "Rabu, 5 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 0.7,
        quiz_results: [
          { type: "mc", level: "low", score: 40, ts: "10:35" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bingung" }, { jam: "10:15", emosi: "bingung" }, { jam: "10:30", emosi: "frustrasi" }, { jam: "10:42", emosi: "frustrasi" }],
        violations: []
      },
    ]
  },
  // ─── s2: Dewi Rahayu — berprestasi, konsisten, sudah kerjakan MC+Essay di beberapa level ───
  {
    id: "s2", name: "Dewi Rahayu", nis: "2025002", avatar: "DR", avatarBg: C.teal,
    kelas_id: "x1",
    emotionKey: "antusias",
    status: "Normal", lastActive: "Hari ini 13:45",
    todayActive: true, todayStudyHours: 1.5,
    todayLastQuiz: { type: "essay", level: "high", mc_score: 80, essay_score: 84, aggregated: 81 },
    todayMapelId: "mat", todayMateriId: "Fungsi Kuadrat", todayLevel: "high",
    riwayat: [
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Fungsi Kuadrat",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "low", score: 85, ts: "08:30" },
          { type: "essay", level: "low", score: 80, ts: "08:55" },
          { type: "mc", level: "mid", score: 82, ts: "11:10" },
          { type: "essay", level: "mid", score: 78, ts: "11:35" },
          { type: "mc", level: "high", score: 80, ts: "13:20" },
          { type: "essay", level: "high", score: 84, ts: "13:45" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bingung" }, { jam: "13:30", emosi: "tidak_terdeteksi" }, { jam: "13:45", emosi: "antusias" }, { jam: "15:00", emosi: "antusias" }],
        violations: [{ detail: "Browser Diperkecil / Split Screen", timestamp: "13:45" }]
      },
      {
        tanggal: "Jumat, 14 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 1.8,
        quiz_results: [
          { type: "mc", level: "low", score: 90, ts: "08:40" },
          { type: "essay", level: "low", score: 88, ts: "09:05" },
        ],
        emosiSesi: [{ jam: "08:00", emosi: "bosan" }, { jam: "08:20", emosi: "antusias" }, { jam: "09:20", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Kamis, 13 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 2.0,
        quiz_results: [
          { type: "mc", level: "mid", score: 80, ts: "14:30" },
          { type: "essay", level: "mid", score: 82, ts: "14:55" },
        ],
        emosiSesi: [{ jam: "14:00", emosi: "bosan" }, { jam: "14:45", emosi: "antusias" }, { jam: "15:00", emosi: "antusias" }, { jam: "15:20", emosi: "antusias" }],
        violations: []
      },
    ]
  },
  // ─── s3: Rizki Pratama — nilai sangat rendah, tren emosi buruk, hanya MC ───
  {
    id: "s3", name: "Rizki Pratama", nis: "2025003", avatar: "RP", avatarBg: C.amber,
    kelas_id: "x1",
    emotionKey: "frustrasi",
    status: "Perhatian", lastActive: "3 hari lalu",
    todayActive: false, todayStudyHours: null, todayLastQuiz: null,
    todayMapelId: null, todayMateriId: null, todayLevel: null,
    riwayat: [
      {
        tanggal: "Jumat, 13 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 0.6,
        quiz_results: [
          { type: "mc", level: "low", score: 40, ts: "11:30" },
        ],
        emosiSesi: [{ jam: "11:00", emosi: "bingung" }, { jam: "11:10", emosi: "frustrasi" }, { jam: "11:20", emosi: "tidak_terdeteksi" }, { jam: "11:36", emosi: "frustrasi" }],
        violations: [
          { detail: "Membuka Aplikasi / Window Lain", timestamp: "11:05" },
          { detail: "Browser Diperkecil / Split Screen", timestamp: "11:12" },
        ]
      },
      {
        tanggal: "Rabu, 11 Mar 2026",
        mapelId: "mat", materiId: "Aljabar Dasar",
        durasi: 0.5,
        quiz_results: [
          { type: "mc", level: "low", score: 30, ts: "09:25" },
        ],
        emosiSesi: [{ jam: "09:00", emosi: "bingung" }, { jam: "09:15", emosi: "frustrasi" }, { jam: "09:30", emosi: "frustrasi" }],
        violations: [{ detail: "Berpindah Tab / Menyembunyikan Halaman", timestamp: "09:21" }]
      },
    ]
  },
  // ─── s4: Siti Nurhaliza — rajin, nilai sangat baik, MC+Essay semua level ───
  {
    id: "s4", name: "Siti Nurhaliza", nis: "2025004", avatar: "SN", avatarBg: C.purple,
    kelas_id: "x1",
    emotionKey: "antusias",
    status: "Normal", lastActive: "Hari ini 14:30",
    todayActive: true, todayStudyHours: 2.0,
    todayLastQuiz: { type: "essay", level: "high", mc_score: 100, essay_score: 96, aggregated: 99 },
    todayMapelId: "mat", todayMateriId: "Statistika", todayLevel: "high",
    riwayat: [
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 2.0,
        quiz_results: [
          { type: "mc", level: "low", score: 100, ts: "08:20" },
          { type: "essay", level: "low", score: 92, ts: "08:45" },
          { type: "mc", level: "mid", score: 100, ts: "11:00" },
          { type: "essay", level: "mid", score: 94, ts: "11:25" },
          { type: "mc", level: "high", score: 100, ts: "14:00" },
          { type: "essay", level: "high", score: 96, ts: "14:30" },
        ],
        emosiSesi: [{ jam: "14:00", emosi: "tidak_terdeteksi" }, { jam: "14:15", emosi: "bingung" }, { jam: "14:45", emosi: "antusias" }, { jam: "16:00", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Fungsi Kuadrat",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "high", score: 90, ts: "10:30" },
          { type: "essay", level: "high", score: 88, ts: "10:55" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:20", emosi: "bingung" }, { jam: "10:40", emosi: "antusias" }, { jam: "11:20", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Kamis, 13 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "high", score: 90, ts: "13:30" },
          { type: "essay", level: "high", score: 92, ts: "13:55" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bingung" }, { jam: "13:20", emosi: "antusias" }, { jam: "14:30", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Rabu, 12 Mar 2026",
        mapelId: "mat", materiId: "Aljabar Dasar",
        durasi: 2.0,
        quiz_results: [
          { type: "mc", level: "high", score: 100, ts: "09:15" },
          { type: "essay", level: "high", score: 95, ts: "09:40" },
        ],
        emosiSesi: [{ jam: "08:00", emosi: "bosan" }, { jam: "08:20", emosi: "antusias" }, { jam: "08:45", emosi: "bingung" }, { jam: "09:15", emosi: "antusias" }, { jam: "09:30", emosi: "antusias" }, { jam: "10:00", emosi: "antusias" }],
        violations: []
      },
    ]
  },
  // ─── s5: Bagas Firmansyah — aktif tapi boredom, skor pas-pasan, hanya MC ───
  {
    id: "s5", name: "Bagas Firmansyah", nis: "2025005", avatar: "BF", avatarBg: C.green,
    kelas_id: "x1",
    emotionKey: "bosan",
    status: "Normal", lastActive: "Hari ini 11:20",
    todayActive: true, todayStudyHours: 1.0,
    todayLastQuiz: { type: "mc", level: "high", mc_score: 70, essay_score: null, aggregated: null },
    todayMapelId: "mat", todayMateriId: "Persamaan Linear", todayLevel: "high",
    riwayat: [
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.0,
        quiz_results: [
          { type: "mc", level: "high", score: 70, ts: "10:50" },
          // essay belum dikerjakan
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:15", emosi: "tidak_terdeteksi" }, { jam: "10:30", emosi: "bosan" }, { jam: "10:45", emosi: "antusias" }, { jam: "11:00", emosi: "bosan" }],
        violations: [{ detail: "Browser Diperkecil / Split Screen", timestamp: "10:22" }]
      },
      {
        tanggal: "Jumat, 14 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "high", score: 60, ts: "13:50" },
          { type: "essay", level: "high", score: 55, ts: "14:15" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bosan" }, { jam: "13:20", emosi: "bingung" }, { jam: "14:00", emosi: "bosan" }, { jam: "14:30", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Rabu, 12 Mar 2026",
        mapelId: "mat", materiId: "Aljabar Dasar",
        durasi: 1.3,
        quiz_results: [
          { type: "mc", level: "high", score: 70, ts: "09:55" },
        ],
        emosiSesi: [{ jam: "09:00", emosi: "bingung" }, { jam: "09:20", emosi: "bosan" }, { jam: "09:40", emosi: "antusias" }, { jam: "10:20", emosi: "antusias" }],
        violations: []
      },
    ]
  },
  // ─── s6: Lina Kartika — nilai rendah, emosi negatif, stuck di level low ───
  {
    id: "s6", name: "Lina Kartika", nis: "2025006", avatar: "LK", avatarBg: "#B7791F",
    kelas_id: "x1",
    emotionKey: "bingung",
    status: "Normal", lastActive: "Hari ini 12:30",
    todayActive: true, todayStudyHours: 0.5,
    todayLastQuiz: { type: "mc", level: "low", mc_score: 40, essay_score: null, aggregated: null },
    todayMapelId: "mat", todayMateriId: "Persamaan Linear", todayLevel: "low",
    riwayat: [
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 0.5,
        quiz_results: [
          { type: "mc", level: "low", score: 40, ts: "12:25" },
        ],
        emosiSesi: [{ jam: "12:00", emosi: "bingung" }, { jam: "12:20", emosi: "frustrasi" }, { jam: "12:30", emosi: "bingung" }],
        violations: []
      },
      {
        tanggal: "Minggu, 15 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 0.8,
        quiz_results: [
          { type: "mc", level: "low", score: 40, ts: "10:45" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:15", emosi: "bingung" }, { jam: "10:48", emosi: "bingung" }],
        violations: []
      },
      {
        tanggal: "Jumat, 13 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.0,
        quiz_results: [
          { type: "mc", level: "low", score: 50, ts: "14:40" },
          { type: "essay", level: "low", score: 45, ts: "15:00" },
        ],
        emosiSesi: [{ jam: "14:00", emosi: "bingung" }, { jam: "14:30", emosi: "antusias" }, { jam: "14:45", emosi: "bingung" }, { jam: "15:00", emosi: "bingung" }],
        violations: [{ detail: "Berpindah Tab / Menyembunyikan Halaman", timestamp: "14:17" }]
      },
    ]
  },
  // ─── s7: Dino Prasetyo — tidak aktif kemarin, hanya MC level low ───
  {
    id: "s7", name: "Dino Prasetyo", nis: "2025007", avatar: "DP", avatarBg: "#2B6CB0",
    kelas_id: "x1",
    emotionKey: "bosan",
    status: "Normal", lastActive: "1 Hari lalu",
    todayActive: false, todayStudyHours: null, todayLastQuiz: null,
    todayMapelId: null, todayMateriId: null, todayLevel: null,
    riwayat: [
      {
        tanggal: "Minggu, 15 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.0,
        quiz_results: [
          { type: "mc", level: "low", score: 70, ts: "10:40" },
          { type: "essay", level: "low", score: 65, ts: "11:00" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:30", emosi: "tidak_terdeteksi" }, { jam: "10:45", emosi: "antusias" }, { jam: "11:00", emosi: "bosan" }],
        violations: []
      },
      {
        tanggal: "Sabtu, 14 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "low", score: 60, ts: "14:20" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bosan" }, { jam: "13:20", emosi: "bingung" }, { jam: "13:40", emosi: "bosan" }, { jam: "14:30", emosi: "antusias" }],
        violations: []
      },
    ]
  },
  // ─── s8: Ayu Maharani — tidak aktif, ada pelanggaran, nilai sedang ───
  {
    id: "s8", name: "Ayu Maharani", nis: "2025008", avatar: "AM", avatarBg: "#0D5C63",
    kelas_id: "x1",
    emotionKey: "bosan",
    status: "Normal", lastActive: "1 Hari lalu",
    todayActive: false, todayStudyHours: null, todayLastQuiz: null,
    todayMapelId: null, todayMateriId: null, todayLevel: null,
    riwayat: [
      {
        tanggal: "Minggu, 15 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.0,
        quiz_results: [
          { type: "mc", level: "low", score: 70, ts: "10:40" },
          { type: "essay", level: "low", score: 62, ts: "11:00" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:30", emosi: "bosan" }, { jam: "10:45", emosi: "antusias" }, { jam: "11:00", emosi: "antusias" }],
        violations: [
          { detail: "Berpindah Tab / Menyembunyikan Halaman", timestamp: "10:18" },
        ]
      },
      {
        tanggal: "Sabtu, 14 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "low", score: 60, ts: "14:20" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bosan" }, { jam: "13:20", emosi: "bingung" }, { jam: "13:40", emosi: "frustrasi" }, { jam: "14:00", emosi: "tidak_terdeteksi" }, { jam: "14:30", emosi: "bosan" }],
        violations: []
      },
    ]
  },
  // ─── s9: Budi Santoso — aktif hari ini, sedang naik dari low ke mid ───
  {
    id: "s9", name: "Budi Santoso", nis: "2025009", avatar: "BS", avatarBg: "#0D5C63",
    kelas_id: "x1",
    emotionKey: "bosan",
    status: "Normal", lastActive: "Hari ini 11:20",
    todayActive: true, todayStudyHours: 1.0,
    todayLastQuiz: { type: "essay", level: "mid", mc_score: 80, essay_score: 86, aggregated: 82 },
    todayMapelId: "mat", todayMateriId: "Persamaan Linear", todayLevel: "mid",
    riwayat: [
      {
        tanggal: "Senin, 16 Mar 2026",
        mapelId: "mat", materiId: "Persamaan Linear",
        durasi: 1.0,
        quiz_results: [
          { type: "mc", level: "low", score: 78, ts: "09:30" },
          { type: "essay", level: "low", score: 72, ts: "09:55" },
          { type: "mc", level: "mid", score: 80, ts: "10:50" },
          { type: "essay", level: "mid", score: 86, ts: "11:15" },
        ],
        emosiSesi: [{ jam: "10:00", emosi: "bosan" }, { jam: "10:15", emosi: "bosan" }, { jam: "10:40", emosi: "frustrasi" }, { jam: "11:00", emosi: "antusias" }],
        violations: []
      },
      {
        tanggal: "Minggu, 15 Mar 2026",
        mapelId: "mat", materiId: "Statistika",
        durasi: 1.5,
        quiz_results: [
          { type: "mc", level: "low", score: 72, ts: "13:40" },
          { type: "essay", level: "low", score: 65, ts: "14:05" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "bosan" }, { jam: "13:20", emosi: "bingung" }, { jam: "13:40", emosi: "bosan" }, { jam: "14:30", emosi: "tidak_terdeteksi" }],
        violations: []
      },
      {
        tanggal: "Sabtu, 14 Mar 2026",
        mapelId: "mat", materiId: "Fungsi Kuadrat",
        durasi: 2.0,
        quiz_results: [
          { type: "mc", level: "low", score: 85, ts: "13:30" },
          { type: "essay", level: "low", score: 80, ts: "13:55" },
          { type: "mc", level: "mid", score: 88, ts: "15:10" },
          { type: "essay", level: "mid", score: 82, ts: "15:35" },
        ],
        emosiSesi: [{ jam: "13:00", emosi: "tidak_terdeteksi" }, { jam: "13:20", emosi: "bingung" }, { jam: "14:00", emosi: "antusias" }, { jam: "15:00", emosi: "antusias" }],
        violations: []
      },
    ]
  },
]

// ─── Admin seed data ────────────────────────────────────────────────
export const ADMIN_GURU_INIT = [
  { id: "g1", nama: "Bpk. Hendra, M.Pd.", nip: "198205152008011005", email: "hendra@sr-malang.sch.id", mapel_ids: ["mat"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Agustus 2022", status: "Aktif", avatar: "BH", avatarBg: `linear-gradient(135deg,#0D5C63,#1A8A94)` },
  { id: "g2", nama: "Sri Dewi, S.Pd.", nip: "197911222005012003", email: "dewi@sr-malang.sch.id", mapel_ids: ["bio", "fis", "kim"], kelas_ids: ["x1", "x2"], bergabung: "Januari 2021", status: "Aktif", avatar: "SD", avatarBg: `linear-gradient(135deg,#F4A435,#DD6B20)` },
  { id: "g3", nama: "Ibu Ratna, S.Pd.", nip: "198507102010012009", email: "ratna@sr-malang.sch.id", mapel_ids: ["bin"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Juli 2023", status: "Aktif", avatar: "IR", avatarBg: `linear-gradient(135deg,#6B46C1,#9B72DB)` },
  { id: "g4", nama: "Bpk. Yoga, S.Pd.", nip: "199001152015011002", email: "yoga@sr-malang.sch.id", mapel_ids: ["eko", "sos", "geo"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Agustus 2023", status: "Aktif", avatar: "BY", avatarBg: `linear-gradient(135deg,#2F855A,#48BB78)` },
  { id: "g5", nama: "Ibu Sari, S.Pd.", nip: "198803042012012006", email: "sari@sr-malang.sch.id", mapel_ids: ["eng"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Maret 2022", status: "Aktif", avatar: "IS", avatarBg: `linear-gradient(135deg,#2B6CB0,#4299E1)` },
  { id: "g6", nama: "Bpk. Anton, S.Pd.", nip: "198612102014011004", email: "anton@sr-malang.sch.id", mapel_ids: ["pjok"], kelas_ids: ["x1", "x2"], bergabung: "Juli 2021", status: "Aktif", avatar: "BA", avatarBg: `linear-gradient(135deg,#C05621,#ED8936)` },
  { id: "g7", nama: "Ibu Wulan, S.Sn.", nip: "199205282016012008", email: "wulan@sr-malang.sch.id", mapel_ids: ["seni"], kelas_ids: ["x2", "x3"], bergabung: "Oktober 2024", status: "Aktif", avatar: "IW", avatarBg: `linear-gradient(135deg,#B7791F,#D69E2E)` },
  { id: "g8", nama: "Bpk. Dedi, S.Pd.", nip: "198109152009011007", email: "dedi@sr-malang.sch.id", mapel_ids: ["ppkn", "sej"], kelas_ids: ["x1", "x2"], bergabung: "Agustus 2020", status: "Aktif", avatar: "BD", avatarBg: `linear-gradient(135deg,#9B2C2C,#C53030)` },
  { id: "g9", nama: "Bpk. Arif, S.Pd.", nip: "199304122018011003", email: "arif@sr-malang.sch.id", mapel_ids: ["info", "kka"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Januari 2023", status: "Aktif", avatar: "BA", avatarBg: `linear-gradient(135deg,#2D3748,#4A5568)` },
  { id: "g10", nama: "Ibu Heni, S.Ag.", nip: "198701082011012005", email: "heni@sr-malang.sch.id", mapel_ids: ["agama", "ant"], kelas_ids: ["x1", "x2", "x3"], bergabung: "Juli 2022", status: "Non-Aktif", avatar: "IH", avatarBg: `linear-gradient(135deg,#2B6CB0,#3182CE)` },
]

export const ADMIN_KELAS_INIT = [
  {
    id: "x1", nama: "X-1", tingkat: "X", wali_kelas_id: "g1", jumlahSiswa: 32,
    mapel_ids: ["mat", "bio", "fis", "kim", "eko", "sos", "geo", "agama", "bin", "eng", "ppkn", "pjok", "info", "kka", "sej", "ant", "seni"],
    mapelGuruMap: { mat: "g1", bio: "g2", fis: "g2", kim: "g2", bin: "g3", eng: "g5", ppkn: "g8", pjok: "g6", eko: "g4", sos: "g4", geo: "g4", info: "g9", kka: "g9", sej: "g8", ant: "g10", agama: "g10", seni: "g7" },
    tahunAjaran: "2025/2026",
    siswa_ids: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"]
  },
  {
    id: "x2", nama: "X-2", tingkat: "X", wali_kelas_id: "g2", jumlahSiswa: 30,
    mapel_ids: ["mat", "bio", "fis", "kim", "eko", "sos", "geo", "agama", "bin", "eng", "ppkn", "pjok", "info", "kka", "sej", "ant", "seni"],
    mapelGuruMap: { mat: "g1", bio: "g2", fis: "g2", kim: "g2", bin: "g3", eng: "g5", ppkn: "g8", pjok: "g6", eko: "g4", sos: "g4", geo: "g4", info: "g9", kka: "g9", sej: "g8", ant: "g10", agama: "g10", seni: "g7" },
    tahunAjaran: "2025/2026",
    siswa_ids: ["s10", "s11", "s12", "s13", "s14"]
  },
  {
    id: "x3", nama: "X-3", tingkat: "X", wali_kelas_id: "g3", jumlahSiswa: 28,
    mapel_ids: ["mat", "bio", "fis", "kim", "eko", "sos", "geo", "agama", "bin", "eng", "ppkn", "pjok", "info", "kka", "sej", "ant", "seni"],
    mapelGuruMap: { mat: "g1", bio: "g2", fis: "g2", kim: "g2", bin: "g3", eng: "g5", ppkn: "g8", pjok: "g6", eko: "g4", sos: "g4", geo: "g4", info: "g9", kka: "g9", sej: "g8", ant: "g10", agama: "g10", seni: "g7" },
    tahunAjaran: "2025/2026",
    siswa_ids: ["s15", "s16", "s17", "s18", "s19", "s20", "s21"]
  },
]

export const ADMIN_SISWA_INIT = [
  { id: "s1", nama: "Ahmad Fauzi", nis: "2025001", email: "ahmad@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "4 hari lalu", avatar: "AF", avatarBg: "#E53E3E" },
  { id: "s2", nama: "Dewi Rahayu", nis: "2025002", email: "dewi@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "Hari ini", avatar: "DR", avatarBg: "#0D5C63" },
  { id: "s3", nama: "Rizki Pratama", nis: "2025003", email: "rizki@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "3 hari lalu", avatar: "RP", avatarBg: "#F4A435" },
  { id: "s4", nama: "Siti Nurhaliza", nis: "2025004", email: "siti@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "Hari ini", avatar: "SN", avatarBg: "#6B46C1" },
  { id: "s5", nama: "Bagas Firmansyah", nis: "2025005", email: "bagas@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "Hari ini", avatar: "BF", avatarBg: "#2F855A" },
  { id: "s6", nama: "Lina Kartika", nis: "2025006", email: "lina@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "1 hari lalu", avatar: "LK", avatarBg: "#B7791F" },
  { id: "s7", nama: "Dino Prasetyo", nis: "2025007", email: "dino@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "2 hari lalu", avatar: "DP", avatarBg: "#2B6CB0" },
  { id: "s8", nama: "Ayu Maharani", nis: "2025008", email: "ayu@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Non-Aktif", last_login: "5 hari lalu", avatar: "AM", avatarBg: "#D53F8C" },
  { id: "s9", nama: "Budi Santoso", nis: "2025009", email: "budi@siswa.sr.id", kelas_id: "x1", bergabung: "Jul 2025", status: "Aktif", last_login: "Hari ini", avatar: "BS", avatarBg: "#0D5C63" },
  { id: "s10", nama: "Citra Dewi", nis: "2025010", email: "citra@siswa.sr.id", kelas_id: "x2", bergabung: "Jul 2025", status: "Aktif", last_login: "1 hari lalu", avatar: "CD", avatarBg: "#9B2C2C" },
  { id: "s11", nama: "Fajar Nugroho", nis: "2025011", email: "fajar@siswa.sr.id", kelas_id: "x2", bergabung: "Jul 2025", status: "Aktif", last_login: "3 hari lalu", avatar: "FN", avatarBg: "#2F855A" },
  { id: "s12", nama: "Gilang Ramadhan", nis: "2025012", email: "gilang@siswa.sr.id", kelas_id: "x2", bergabung: "Jul 2025", status: "Aktif", last_login: "Hari ini", avatar: "GR", avatarBg: "#DD6B20" },
  { id: "s13", nama: "Hana Pertiwi", nis: "2025013", email: "hana@siswa.sr.id", kelas_id: "x2", bergabung: "Jul 2025", status: "Aktif", last_login: "2 hari lalu", avatar: "HP", avatarBg: "#6B46C1" },
  { id: "s14", nama: "Ilham Saputra", nis: "2025014", email: "ilham@siswa.sr.id", kelas_id: "x2", bergabung: "Jul 2025", status: "Non-Aktif", last_login: "2 minggu lalu", avatar: "IS", avatarBg: "#718096" },
  { id: "s15", nama: "Joko Santosa", nis: "2024001", email: "joko@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "Hari ini", avatar: "JS", avatarBg: "#0D5C63" },
  { id: "s16", nama: "Kartika Sari", nis: "2024002", email: "kartika@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "1 hari lalu", avatar: "KS", avatarBg: "#D53F8C" },
  { id: "s17", nama: "Lukman Hakim", nis: "2024003", email: "lukman@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "4 hari lalu", avatar: "LH", avatarBg: "#F4A435" },
  { id: "s18", nama: "Maya Anggraini", nis: "2024004", email: "maya@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "Hari ini", avatar: "MA", avatarBg: "#2B6CB0" },
  { id: "s19", nama: "Nanda Putra", nis: "2024005", email: "nanda@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "2 hari lalu", avatar: "NP", avatarBg: "#2F855A" },
  { id: "s20", nama: "Okta Purnama", nis: "2024006", email: "okta@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Non-Aktif", last_login: "1 bulan lalu", avatar: "OP", avatarBg: "#718096" },
  { id: "s21", nama: "Putri Handayani", nis: "2024007", email: "putri@siswa.sr.id", kelas_id: "x3", bergabung: "Jul 2024", status: "Aktif", last_login: "Hari ini", avatar: "PH", avatarBg: "#9B2C2C" },
]

// ─── Recommended materials ─────────────────────────────────────────
// Catatan: field `materiId` = nama materi dari KURIKULUM[mapelId]
export const RECOMMENDED_MATERIALS = [
  {
    id: "rm1", mapelId: "mat", mapelLabel: "Matematika", mapelIcon: "📐",
    materiId: "Persamaan Linear",
    deskripsi: "Cara menyelesaikan persamaan satu variabel dengan langkah sistematis", tag: "⭐ Utama"
  },
  {
    id: "rm2", mapelId: "bio", mapelLabel: "Biologi", mapelIcon: "🧬",
    materiId: "Ekosistem",
    deskripsi: "Rantai makanan, jaring-jaring makanan, dan interaksi antar organisme", tag: "⭐ Utama"
  },
  {
    id: "rm3", mapelId: "fis", mapelLabel: "Fisika", mapelIcon: "⚛️",
    materiId: "Gerak Lurus",
    deskripsi: "Mempelajari konsep dasar gerak, perpindahan, kecepatan, dan percepatan.", tag: "⭐ Utama"
  },
  {
    id: "rm4", mapelId: "kim", mapelLabel: "Kimia", mapelIcon: "🧪",
    materiId: "Sistem Periodik",
    deskripsi: "Mempelajari struktur zat, reaksi kimia alam kehidupan sehari-hari.", tag: "Topik Baru"
  },
  {
    id: "rm5", mapelId: "mat", mapelLabel: "Matematika", mapelIcon: "📐",
    materiId: "Statistika",
    deskripsi: "Mean, median, modus, dan penyajian data dalam grafik", tag: null
  },
  {
    id: "rm6", mapelId: "bio", mapelLabel: "Biologi", mapelIcon: "🧬",
    materiId: "Sel & Jaringan",
    deskripsi: "Struktur sel, fungsi organel, dan jaringan pada makhluk hidup", tag: "Topik Baru"
  },
]

// ─── Progress Data ─────────────────────────────────────────────────
// key: mapelId__materiId
// field `materiId` = nama materi dari KURIKULUM[mapelId]
export const PROGRESS_DATA_INIT = {
  belumSelesai: [
    { id: "p1", mapelId: "mat", mapelLabel: "Matematika", mapelIcon: "📐", materiId: "Fungsi Kuadrat", progress: 40, lastChat: "1 jam lalu", confDone: ["mindmap"], quizDone: false, quizScore: null },
    { id: "p2", mapelId: "fis", mapelLabel: "Fisika", mapelIcon: "⚛️", materiId: "Hukum Newton", progress: 20, lastChat: "2 hari lalu", confDone: [], quizDone: false, quizScore: null },
    { id: "p3", mapelId: "bin", mapelLabel: "Bahasa Indonesia", mapelIcon: "📖", materiId: "Teks Argumentasi", progress: 65, lastChat: "Kemarin", confDone: ["flashcard"], quizDone: false, quizScore: null },
    { id: "p4", mapelId: "eng", mapelLabel: "Bahasa Inggris", mapelIcon: "🌐", materiId: "Introduction", progress: 30, lastChat: "3 hari lalu", confDone: ["mindmap"], quizDone: false, quizScore: null },
  ],
  sudahSelesai: [
    //{ id: "p6", mapelId: "mat", mapelLabel: "Matematika", mapelIcon: "📐", materiId: "Aljabar Dasar", progress: 100, lastChat: "Kemarin", confDone: ["mindmap", "flashcard"], quizDone: true, quizScore: 70 },
  ],
}

// ─── Search Topics (satu entry per materi) ────────────────────────
export const SEARCH_TOPICS = ADMIN_MAPEL_LIST
  .filter(m => KURIKULUM[m.id])
  .flatMap(m =>
    KURIKULUM[m.id].map(mat => ({
      mapelId: m.id,
      mapelLabel: m.label,
      mapelIcon: m.icon,
      materiId: mat,      // ← nama materi (bukan subMateri)
    }))
  );

// ─── Conf Types ────────────────────────────────────────────────────
export const CONF_TYPES = [
  { type: "mindmap", icon: "🧠", label: "Mind Map", color: "#0D5C63", bgLight: "#D4F0F3" },
  { type: "flashcard", icon: "🃏", label: "Flashcard", color: "#0D5C63", bgLight: "#D4F0F3" },
]

// key: mapelId__materiId
export const CONF_CONTENT_INIT = {
  "mat__Persamaan Linear": {
    mindmap: {
      generated: false, ts: "Hari ini 14:35",
      tree: {
        label: "📐 Persamaan Linear",
        color: "#0D5C63",
        children: [
          { label: "Bentuk Umum", children: [{ label: "ax + b = c" }, { label: "a = koefisien" }, { label: "b = konstanta" }] },
          { label: "Langkah Penyelesaian", children: [{ label: "Pindah konstanta" }, { label: "Bagi koefisien" }] },
          { label: "Contoh", children: [{ label: "3x + 6 = 18" }, { label: "→ x = 4" }] },
        ]
      }
    },
    flashcard: { generated: false, ts: "Hari ini 14:40", cards: [{ depan: "Apa itu Persamaan Linear?", belakang: "Persamaan berderajat satu, bentuk ax + b = c" }] },
  },
}

// ─── Game data placeholder (diisi oleh Tim 4) ─────────────────────
// Guru mempublikasi game → entri ditambahkan di sini via API
export const GAMES_DATA = [];

// key: mapelId__materiId
export const QUIZ_DATA = {}

// ─── Dummy Accounts ────────────────────────────────────────────────
export const DUMMY_ACCOUNTS = [
  // ── Siswa ──────────────────────────────────────────────────────────────────
  // password temp = SR + NIS; is_first_login = true → wajib aktivasi dulu
  { id: 's2', email: 'dewi@siswa.sr.id', nis: '2025002', password: 'siswa123', role: 'siswa', nama: 'Dewi Rahayu', kelas_id: 'x1', avatar: 'DR', avatarBg: '#1D9E75', is_first_login: true },
  { id: 's9', email: 'budi@siswa.sr.id', nis: '2025009', password: 'siswa123', role: 'siswa', nama: 'Budi Santoso', kelas_id: 'x1', avatar: 'BS', avatarBg: '#0D5C63', is_first_login: false },

  // ── Guru ───────────────────────────────────────────────────────────────────
  // id harus cocok dengan TEACHERS[x].id agar TeacherView bisa lookup by user.id
  //
  //  t2 · Hendra  → 1 mapel (mat), sudah ganti password, login langsung masuk portal normal
  { id: 'g1', email: 'hendra@guru.sr.id', password: 'guru123', role: 'guru', nama: 'Bpk. Hendra, M.Pd.', avatar: 'BH', avatarBg: 'linear-gradient(135deg,#0D5C63,#1A8A94)', is_first_login: false },
  //  t1 · Sri Dewi → multi-mapel (bio/fis/kim), sudah login sebelumnya (is_first_login false)
  { id: 'g2', email: 'sridewi@guru.sr.id', password: 'guru123', role: 'guru', nama: 'Sri Dewi, S.Pd.', avatar: 'SD', avatarBg: 'linear-gradient(135deg,#F4A435,#DD6B20)', is_first_login: false },
  //  t3 · Ratna   → 1 mapel (bin), BELUM ganti password → force change password muncul
  { id: 'g3', email: 'ratna@guru.sr.id', password: 'guru123', role: 'guru', nama: 'Ibu Ratna, S.Pd.', avatar: 'IR', avatarBg: 'linear-gradient(135deg,#805AD5,#9B72DB)', is_first_login: true },
  //  t4 · Yoga    → multi-mapel (eko/sos), sudah login sebelumnya
  { id: 'g4', email: 'yoga@guru.sr.id', password: 'guru123', role: 'guru', nama: 'Bpk. Yoga, S.Pd.', avatar: 'BY', avatarBg: 'linear-gradient(135deg,#276749,#48BB78)', is_first_login: true },

  // ── Admin ──────────────────────────────────────────────────────────────────
  { id: 'a1', email: 'admin@sr.id', password: 'admin123', role: 'admin', nama: 'Admin Sekolah Rakyat', avatar: 'AD' },
];

// ─── Emosi Meta — dipakai MonitoringSection, GameSection, StudentView ──
// Jenis emosi ditambah dengan 'tidak_terdeteksi' (Fase 3)
export const EMOSI_META = {
  antusias: { emoji: '🤩', label: 'Antusias', color: '#2F855A', shortLabel: 'Ant' },
  bosan: { emoji: '🥱', label: 'Bosan', color: '#4A5568', shortLabel: 'Bos' },
  bingung: { emoji: '😕', label: 'Bingung', color: '#B7791F', shortLabel: 'Bin' },
  frustrasi: { emoji: '😖', label: 'Frustrasi', color: '#9B2C2C', shortLabel: 'Fru' },
  tidak_terdeteksi: { emoji: '❓', label: 'Tidak Terdeteksi', color: '#718096', shortLabel: 'N/A' },
};

export const EMOSI_ORDER = ['antusias', 'bosan', 'bingung', 'frustrasi', 'tidak_terdeteksi'];
export const EMOSI_Y = { antusias: 0, bosan: 1, bingung: 2, frustrasi: 3, tidak_terdeteksi: 4 };

// ─── MATERI_PER_ELEMEN — Dummy breakdown materi per elemen ────────────
// Mapel yang guru sudah input sampai level MATERI akan punya array isi.
// Mapel yang guru baru input sampai ELEMEN saja → nilai undefined/kosong
// sehingga ketika diklik langsung popup (tidak ada dropdown materi).
export const MATERI_PER_ELEMEN = {
  // ── Matematika ──
  mat: {
    bil_aljabar: [
      'Operasi Bilangan Bulat dan Pecahan',
      'Eksponen dan Logaritma',
      'Persamaan Linear Satu Variabel',
      'Pertidaksamaan Linear',
      'Aljabar Dasar',
    ],
    geometri: [
      'Jarak dan Sudut',
      'Bangun Datar dan Keliling',
      'Luas dan Volume Bangun Ruang',
      'Transformasi Geometri',
    ],
    data_statistika: [
      'Pengumpulan dan Penyajian Data',
      'Ukuran Pemusatan Data',
      'Ukuran Penyebaran Data',
      'Probabilitas Dasar',
    ],
    kalkulus: [
      'Limit Fungsi',
      'Turunan Fungsi',
      'Integral Tak Tentu',
      'Aplikasi Integral',
    ],
  },
  // ── Biologi ──
  bio: {
    pemahaman_bio: [
      'Sel dan Organel Sel',
      'Jaringan pada Tumbuhan dan Hewan',
      'Sistem Organ Manusia',
      'Ekosistem dan Keanekaragaman Hayati',
      'Genetika dan Pewarisan Sifat',
    ],
    keterampilan_proses: [
      'Metode Ilmiah dan Penelitian',
      'Penggunaan Mikroskop',
      'Klasifikasi Makhluk Hidup',
    ],
  },
  // ── Fisika ──
  fis: {
    pemahaman_fis: [
      'Besaran dan Satuan Fisika',
      'Gerak Lurus (GLB & GLBB)',
      'Hukum Newton',
      'Energi dan Kalor',
      'Gelombang dan Bunyi',
      'Listrik Statis dan Dinamis',
    ],
    keterampilan_proses_fis: [
      'Pengukuran dan Analisis Data',
      'Praktikum Fisika Dasar',
    ],
  },
  // ── Bahasa Indonesia ──
  bin: {
    menyimak: [
      'Menyimak Teks Berita',
      'Menyimak Diskusi dan Debat',
    ],
    membaca_memirsa: [
      'Teks Argumentasi',
      'Teks Eksposisi',
      'Teks Narasi dan Deskripsi',
      'Puisi dan Prosa',
    ],
    berbicara_mempresentasi: [
      'Teknik Berpidato',
      'Presentasi Efektif',
      'Debat',
    ],
    menulis: [
      'Surat Dinas',
      'Teks Laporan',
      'Cerpen dan Esai',
    ],
  },
  // ── Ekonomi ──
  eko: {
    konsep_eko: [
      'Pengertian dan Ruang Lingkup Ekonomi',
      'Kelangkaan dan Kebutuhan',
      'Sistem Ekonomi',
    ],
    keseimbangan_pasar: [
      'Permintaan dan Penawaran',
      'Harga Keseimbangan',
      'Elastisitas',
    ],
    perilaku_produsen: [
      'Teori Produksi',
      'Biaya Produksi',
      'Struktur Pasar',
    ],
    kebijakan_makro: [
      'Pertumbuhan Ekonomi',
      'Inflasi dan Deflasi',
      'Kebijakan Fiskal dan Moneter',
    ],
    pembangunan: [
      'Pembangunan Berkelanjutan',
      'Indikator Pembangunan',
    ],
    ketenagakerjaan: [
      'Pasar Tenaga Kerja',
      'Pengangguran dan Solusinya',
    ],
    akuntansi: [
      'Persamaan Dasar Akuntansi',
      'Jurnal dan Buku Besar',
      'Laporan Keuangan Sederhana',
    ],
  },
  // ── Mapel lain (guru belum input sampai materi — hanya elemen) ──
  // kka, info, ppkn, agama, sej, dst → tidak didefinisikan di sini
  // sehingga MATERI_PER_ELEMEN['kka'] === undefined → popup langsung
};