/**
 * SR MVP — MSW Mock Handlers
 * Tim 6 | src/mocks/handlers.js
 *
 * Mock Service Worker — intercept semua request API di browser (development).
 * Setiap handler di sini berpasangan 1-1 dengan fungsi di src/api/*.js.
 * Shape request & response sudah final — swap ke real backend Fase 3 tanpa ubah UI.
 *
 * ── Store ─────────────────────────────────────────────────────────────
 * In-memory store di-seed dari masterData. Semua mutasi (POST/PUT/DELETE)
 * langsung menulis ke store sehingga GET berikutnya selalu mengembalikan
 * state terkini — sinkron dengan AdminContext di UI.
 *
 * ── Handler Index ────────────────────────────────────────────────────
 *  AUTH (5 endpoint — tidak ada register, akun dibuat admin)
 *    POST /auth/login, /auth/google, /auth/logout, /auth/refresh
 *    POST /auth/forgot-password, /auth/aktivasi
 *    GET  /auth/me
 *
 *  MENTOR — Tim 5 (5 endpoint)
 *    POST   /mentor/chat
 *    POST   /mentor/chat/stream   (SSE — di-skip MSW, ditangani openStream)
 *    GET    /mentor/chat/history
 *    DELETE /mentor/chat/session
 *    POST   /mentor/insight
 *
 *  CONTENT — Tim 3 (6 endpoint — curriculum tidak diupload dari FE)
 *    POST /content/generate
 *    POST /content/publish
 *    GET  /content/siswa
 *    GET  /content/progress
 *    POST /content/quiz/submit
 *    GET  /content/recommend
 *
 *  EMOTION — Tim 1 (2 endpoint)
 *    POST /emotion/detect
 *    GET  /emotion/history
 *
 *  GAME — Tim 4 (3 endpoint — hirarki mapel→elemen→materi, deliver HTML)
 *    POST /game/generate
 *    GET  /game/list
 *    GET  /game/:game_id
 *
 *  ADMIN — Kelas (6 endpoint)
 *    GET    /admin/kelas
 *    GET    /admin/kelas/:id
 *    GET    /admin/kelas/:id/siswa
 *    POST   /admin/kelas
 *    PUT    /admin/kelas/:id
 *    DELETE /admin/kelas/:id
 *
 *  ADMIN — Guru (6 endpoint)
 *    GET    /admin/guru
 *    GET    /admin/guru/:id
 *    POST   /admin/guru
 *    PUT    /admin/guru/:id
 *    DELETE /admin/guru/:id
 *    POST   /admin/guru/bulk
 *
 *  ADMIN — Siswa (6 endpoint)
 *    GET    /admin/siswa
 *    GET    /admin/siswa/:id
 *    POST   /admin/siswa
 *    PUT    /admin/siswa/:id
 *    DELETE /admin/siswa/:id
 *    POST   /admin/siswa/bulk
 *
 *  ADMIN — Mapel (4 endpoint)
 *    GET    /admin/mapel
 *    POST   /admin/mapel
 *    PUT    /admin/mapel/:id
 *    DELETE /admin/mapel/:id
 *
 *  GURU — Rekomendasi (2 endpoint — fitur guru, bukan admin)
 *    POST /guru/rekomendasi
 *    GET  /guru/rekomendasi
 */

import { http, HttpResponse, delay } from 'msw';
import { DUMMY_ACCOUNTS } from '../data/masterData';
import {
  ADMIN_GURU_INIT,
  ADMIN_SISWA_INIT,
  ADMIN_KELAS_INIT,
  ADMIN_MAPEL_LIST,
} from '../data/masterData';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const url = (path) => `${BASE}${path}`;

// ─── In-memory store (di-seed dari masterData) ────────────────────────
const store = {
  guru: structuredClone(ADMIN_GURU_INIT),
  siswa: structuredClone(ADMIN_SISWA_INIT),
  kelas: structuredClone(ADMIN_KELAS_INIT),
  mapel: structuredClone(ADMIN_MAPEL_LIST),
  rekomendasi: [],   // { id, guru_id, guru_nama, guru_mapel, siswa_id, pesan, dibaca, created_at }
};

const d = (ms = 300) => delay(ms);
const nowISO = () => new Date().toISOString();

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════

export const handlers = [

  // POST /auth/login
  http.post(url('/auth/login'), async ({ request }) => {
    const { email, password } = await request.json();
    await d(400);
    const account = DUMMY_ACCOUNTS.find(
      a => (a.email === email || a.nis === email) && a.password === password && !a.googleOnly
    );
    if (!account) {
      return HttpResponse.json({ message: 'Email/NIS atau password salah.' }, { status: 401 });
    }
    return HttpResponse.json({
      access_token: 'mock_jwt_' + Date.now(),
      refresh_token: 'mock_refresh',
      user: {
        id: account.id,
        nama: account.nama,
        email: account.email,
        nis: account.nis ?? null,
        nip: account.nip ?? null,
        role: account.role,
        sekolah_id: account.sekolah_id,
        avatar: account.avatar ?? null,
        is_first_login: account.is_first_login ?? false,
        avatarBg: account.avatarBg ?? null,
        kelas_id: account.kelas_id ?? null,
      },
    });
  }),

  // POST /auth/google
  http.post(url('/auth/google'), async ({ request }) => {
    const { email } = await request.json();
    await d(700);
    const account = DUMMY_ACCOUNTS.find(a => a.email === email);
    if (!account) {
      return HttpResponse.json({ message: 'Akun Google tidak terdaftar di sistem.' }, { status: 401 });
    }
    return HttpResponse.json({
      access_token: 'mock_jwt_google_' + Date.now(),
      refresh_token: 'mock_refresh',
      user: {
        id: account.id,
        nama: account.nama,
        email: account.email,
        role: account.role,
        sekolah_id: account.sekolah_id,
        avatar: account.avatar ?? null,
        is_first_login: account.is_first_login ?? false,
        avatarBg: account.avatarBg ?? null,
        kelas_id: account.kelas_id ?? null,
      },
    });
  }),

  // POST /auth/logout
  http.post(url('/auth/logout'), async () => {
    await d(200);
    return HttpResponse.json({ message: 'Berhasil logout.' });
  }),

  // POST /auth/refresh
  http.post(url('/auth/refresh'), async () => {
    await d(200);
    return HttpResponse.json({
      access_token: 'mock_refreshed_jwt_' + Date.now(),
      refresh_token: 'mock_refresh_new',
    });
  }),

  // POST /auth/forgot-password
  http.post(url('/auth/forgot-password'), async ({ request }) => {
    const { email } = await request.json();
    await d(600);
    // Selalu 200 — tidak ekspos apakah email terdaftar (security)
    return HttpResponse.json({
      message: DUMMY_ACCOUNTS.some(a => a.email === email)
        ? 'Link reset password telah dikirim ke email Anda.'
        : 'Jika email terdaftar, link reset akan dikirimkan.',
    });
  }),

  // POST /auth/aktivasi
  http.post(url('/auth/aktivasi'), async ({ request }) => {
    const { password, user_id } = await request.json();
    await d(800);
    const siswa = store.siswa.find(s => s.id === user_id);
    if (!siswa) {
      return HttpResponse.json({ message: 'Siswa tidak ditemukan.' }, { status: 404 });
    }
    siswa.status = 'Aktif';
    siswa.is_first_login = false;
    const acc = DUMMY_ACCOUNTS.find(a => a.id === user_id);
    if (acc) { acc.password = password; acc.is_first_login = false; }
    return HttpResponse.json({
      access_token: 'mock_jwt_aktivasi_' + Date.now(),
      refresh_token: 'mock_refresh',
      user: {
        id: siswa.id,
        nama: siswa.nama,
        email: siswa.email,
        nis: siswa.nis,
        role: 'siswa',
        kelas_id: siswa.kelas_id || siswa.kelasId || null,
        is_first_login: false,
        status: 'Aktif',
      },
    });
  }),

  // PUT /auth/change-password
  // Body: { old_password, new_password }
  // FIX: handler baru — ChangePasswordModal & ForceChangePasswordModal butuh endpoint ini
  http.put(url('/auth/change-password'), async ({ request }) => {
    const { old_password } = await request.json();
    await d(600);
    // Validasi: old_password harus cocok dengan salah satu akun dummy yang login
    // Di mock, kita toleransi semua password lama asalkan bukan string kosong
    if (!old_password || old_password.length < 1) {
      return HttpResponse.json({ message: 'Password lama salah.' }, { status: 401 });
    }
    return HttpResponse.json({ message: 'Password berhasil diubah.' });
  }),

  // GET /auth/me
  http.get(url('/auth/me'), async () => {
    await d(200);
    // Dalam implementasi nyata: decode token → kembalikan profil user dari DB
    return HttpResponse.json({
      id: 'usr_001',
      nama: 'Budi Santoso',
      email: 'budi@siswa.sr',
      nis: '2025009',
      role: 'siswa',
      sekolah_id: 'sr_malang_001',
      kelas_id: 'x1',
      is_first_login: false,
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // MENTOR — Tim 5
  // ════════════════════════════════════════════════════════════════════

  // POST /mentor/chat
  // Body: { siswa_id, mapel_id, materi, materi_id, message, context? }
  http.post(url('/mentor/chat'), async ({ request }) => {
    const { materi, materi_id, message } = await request.json();
    await d(1200 + Math.random() * 600);
    const topik = materi || materi_id || 'materi ini';
    const reply = [
      `Pertanyaan menarik tentang **${topik}**!`,
      `Kamu bertanya: "${message || ''}"`,
      '',
      'Mari kita bahas step by step... 😊',
      '',
      '① Pahami konsep dasarnya',
      '② Coba contoh sederhana',
      '③ Latihan soal',
      '',
      'Mau mulai dari mana?',
    ].join('\n');
    return HttpResponse.json({ reply, session_id: 'sess_' + Date.now() });
  }),

  // FIX ⑤: POST /mentor/chat/stream — mock SSE via ReadableStream
  // Intercept fetch() dari openStream() di client.js.
  // Emit token 'data: <token>\n\n' tiap ~60ms, tutup dengan 'data: [DONE]\n\n'.
  http.post(url('/mentor/chat/stream'), async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    const topik = body.materi || body.materi_id || 'materi ini';
    const hasTanya = (body.pesan || '').includes('?');
    const baseTokens = [
      '\u2728 Oke! ', 'Mari ', 'kita ', 'bahas ', topik + '. ',
      hasTanya ? 'Pertanyaan ' : 'Topik ',
      'yang ', 'bagus! ', 'Konsep ', 'utamanya: ',
      'pemahaman ', 'bertahap. ',
      'Mulai ', 'dari ', 'dasar ', 'dulu, ', 'ya? ', '\ud83d\udcda',
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const token of baseTokens) {
          await new Promise(r => setTimeout(r, 55 + Math.random() * 45));
          controller.enqueue(encoder.encode('data: ' + token + '\n\n'));
        }
        await new Promise(r => setTimeout(r, 80));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }),
  // GET /mentor/chat/history
  // Params: { siswa_id, mapel_id, materi, materi_id }
  // FIX: kembalikan [] untuk sesi baru — hasRealConversation = false
  // sehingga ChatSection memanggil buildOpening() dan opening message materi tampil normal.
  http.get(url('/mentor/chat/history'), async () => {
    await d(400);
    return HttpResponse.json([]);
  }),

  // DELETE /mentor/chat/session
  // Params: { siswa_id, mapel_id, materi, materi_id }
  http.delete(url('/mentor/chat/session'), async () => {
    await d(200);
    return HttpResponse.json({ deleted: true, message: 'Sesi chat berhasil di-reset.' });
  }),

  // POST /mentor/insight
  // Body: { siswa_id, nama, top_mapel?, emosi_dominan?, total_jam?, rata_quiz?, streak_hari? }
  // Dipanggil dari DashboardSection (Hero card AI Insight)
  http.post(url('/mentor/insight'), async () => {
    await d(800 + Math.random() * 400);
    const insights = [
      '🌟 Kamu sudah menunjukkan semangat yang luar biasa — terus pertahankan ritme belajarmu!',
      '🚀 Progresmu terus meningkat! Konsistensi adalah kunci — jaga streakmu hari ini.',
      '💡 Emosi belajarmu positif — manfaatkan momentum ini untuk menyelesaikan satu topik lagi.',
      '📈 Rata-rata skormu bagus! Coba tantang dirimu dengan soal level lebih tinggi.',
    ];
    return HttpResponse.json({ text: insights[Math.floor(Math.random() * insights.length)] });
  }),

  // ════════════════════════════════════════════════════════════════════
  // CONTENT — Tim 3 (RAG + Agentic)
  // ════════════════════════════════════════════════════════════════════

  // POST /content/generate
  // Body: { siswa_id, mapel_id, materi, materi_id, tipe, level?, emosi?, profil_minat? }
  http.post(url('/content/generate'), async ({ request }) => {
    const { tipe, materi, materi_id } = await request.json();
    await d(2000);
    const nama = materi || materi_id || 'Materi';
    const upper = nama.toUpperCase();
    // FIX: kembalikan konten kosong agar ChatSection fallback ke getConfContent() lokal
    // yang menghasilkan kartu/mindmap kontekstual (nama materi spesifik).
    // Saat backend Tim 3 live, konten akan diisi hasil RAG yang sesungguhnya.
    const contentMap = {
      flashcard: { cards: [] },
      mindmap: { content: '' },
    };
    return HttpResponse.json({ tipe, content: contentMap[tipe] ?? {}, generated_at: nowISO() });
  }),

  // POST /content/publish
  // Body: PublishPayload (dari admin.js / KelolaBelajarSection)
  http.post(url('/content/publish'), async ({ request }) => {
    const body = await request.json();
    await d(1200);
    return HttpResponse.json(
      { publish_id: 'pub_' + Date.now(), kelas_ids: [body.kelas_id].filter(Boolean), published_at: nowISO() },
      { status: 201 }
    );
  }),

  // GET /content/siswa
  // Params: { siswa_id, mapel_id?, materi_id?, elemen_id? }
  // FIX 4: kembalikan bank konten yang sudah dipublish guru
  // Setiap paket berisi konten_list per tipe — siswa tidak perlu generating saat klik
  http.get(url('/content/siswa'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const mapelId = p.get('mapel_id') || 'mat';
    const elemenId = p.get('elemen_id') || p.get('materi_id') || 'bil_aljabar';
    const materi = p.get('materi_id') || 'Bilangan dan Aljabar';
    await d(500);
    // Simulasi bank konten yang sudah dipublish guru untuk semua level
    const LEVELS = ['Low', 'Mid', 'High'];
    return HttpResponse.json(LEVELS.map(lv => ({
      publish_id: `pub_${mapelId}_${elemenId}_${lv}_mock`,
      mapel_id: mapelId,
      elemen_id: elemenId,
      elemen_label: materi,
      materi: materi,
      level: lv,
      published_at: new Date(Date.now() - 86400000).toISOString(),
      konten_list: [
        // Flashcard — cards kosong → ChatSection pakai getConfContent() lokal
        { tipe: 'flashcard', level: lv, content: { cards: [] } },
        // Mindmap — content kosong → ChatSection pakai getConfContent() lokal
        { tipe: 'mindmap', level: lv, content: { content: '' } },
        // Bacaan — semua tipe tersedia, langsung 'generated: true'
        { tipe: 'bacaan', level: lv, content: { content: '' } },
        { tipe: 'quiz_pg', level: lv, content: { content: '' } },
        { tipe: 'quiz_essay', level: lv, content: { content: '' } },
      ],
    })));
  }),

  // GET /content/progress
  // Params: { siswa_id }
  http.get(url('/content/progress'), async () => {
    await d(300);
    return HttpResponse.json({
      siswa_id: 'usr_001',
      total_materi: 12,
      selesai: 4,
      dalam_proses: 3,
      belum_dimulai: 5,
      streak_hari: 7,
      total_poin_quiz: 560,
      total_waktu_menit: 225,
      rata_rata_quiz: 78,
      by_mapel: [
        { mapel_id: 'mat', selesai: 2, progress_avg: 72 },
        { mapel_id: 'ipa', selesai: 1, progress_avg: 85 },
        { mapel_id: 'bin', selesai: 1, progress_avg: 64 },
        { mapel_id: 'ips', selesai: 0, progress_avg: 30 },
      ],
    });
  }),

  // POST /content/quiz/submit
  // Body: { siswa_id, mapel_id, materi, materi_id, quiz_type, level, answers, score }
  // FIX 2c: quiz_type 'pretest' juga didukung — backend Tim 3 catat untuk RAG
  http.post(url('/content/quiz/submit'), async ({ request }) => {
    const { score, quiz_type, materi_id } = await request.json();
    await d(300);
    return HttpResponse.json({
      submitted: true, score: score ?? 0,
      quiz_type: quiz_type || 'mc',
      materi_id: materi_id || '',
      recorded_at: nowISO(),
    });
  }),

  // GET /content/recommend
  // Params: { siswa_id, mapel_ids? (comma-separated selectedMapels) }
  // FIX: kembalikan [] jika tidak ada info mapel → frontend fallback ke buildRekomendasiAwal
  // Saat backend Tim 3 live, RAG yang tentukan rekomendasi berdasarkan aktivitas siswa
  http.get(url('/content/recommend'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const mapelIds = (p.get('mapel_ids') || '').split(',').filter(Boolean);
    await d(500);
    // Jika tidak ada mapel_ids (siswa baru / belum aktivasi) → kembalikan []
    // Frontend akan pakai buildRekomendasiAwal(selectedMapels) sebagai fallback
    if (!mapelIds.length) return HttpResponse.json([]);
    // Kembalikan rekomendasi yang konsisten dengan mapel pilihan siswa
    // Menggunakan elemen & materi pertama per mapel — sama dengan buildRekomendasiAwal
    // sehingga tidak ada inkonsistensi nama antara rekomendasi API dan progressData
    const REKOM_MAP = {
      mat: { mapel_id: 'mat', materi: 'Operasi Bilangan Bulat dan Pecahan', materi_id: 'mat__op_bilangan', elemen_id: 'bil_aljabar', elemen_label: 'Bilangan dan Aljabar', alasan: 'Fondasi utama matematika yang perlu dikuasai lebih dulu' },
      bio: { mapel_id: 'bio', materi: 'Sel dan Organel Sel', materi_id: 'bio__sel', elemen_id: 'pemahaman_bio', elemen_label: 'Pemahaman Biologi', alasan: 'Konsep dasar Biologi yang menjadi dasar topik lanjutan' },
      fis: { mapel_id: 'fis', materi: 'Besaran dan Satuan Fisika', materi_id: 'fis__besaran', elemen_id: 'pemahaman_fis', elemen_label: 'Pemahaman Fisika', alasan: 'Titik awal yang tepat untuk memahami Fisika secara sistematis' },
      kim: { mapel_id: 'kim', materi: 'Struktur Atom', materi_id: 'kim__atom', elemen_id: 'pemahaman_kim', elemen_label: 'Pemahaman Kimia', alasan: 'Fondasi utama kimia modern' },
      mat_w: { mapel_id: 'mat_w', materi: 'Statistika Dasar', materi_id: 'mat_w__statistika', elemen_id: 'statistika', elemen_label: 'Statistika', alasan: 'Materi yang relevan dengan kebutuhan sehari-hari' },
      bin: { mapel_id: 'bin', materi: 'Teks Deskripsi', materi_id: 'bin__deskripsi', elemen_id: 'membaca', elemen_label: 'Membaca', alasan: 'Dasar literasi yang penting untuk semua mata pelajaran' },
      pai: { mapel_id: 'pai', materi: 'Akidah Islam', materi_id: 'pai__akidah', elemen_id: 'akidah', elemen_label: 'Akidah', alasan: 'Fondasi pemahaman agama yang kuat' },
    };
    return HttpResponse.json(
      mapelIds.slice(0, 3).map(id => REKOM_MAP[id]).filter(Boolean)
    );
  }),

  // ════════════════════════════════════════════════════════════════════
  // EMOTION — Tim 1
  // ════════════════════════════════════════════════════════════════════

  // POST /emotion/detect
  // Body: { siswa_id, frame_base64, session_id? }
  // 5 label emosi: antusias | bosan | bingung | frustrasi | tidak_terdeteksi
  // Distribusi probabilitas dibuat realistis: tidak_terdeteksi ~15%, lainnya merata
  http.post(url('/emotion/detect'), async () => {
    await d(300);
    // Weighted random: antusias 25%, bosan 25%, bingung 20%, frustrasi 15%, tidak_terdeteksi 15%
    const weighted = [
      'antusias', 'antusias', 'antusias', 'antusias', 'antusias',
      'bosan', 'bosan', 'bosan', 'bosan', 'bosan',
      'bingung', 'bingung', 'bingung', 'bingung',
      'frustrasi', 'frustrasi', 'frustrasi',
      'tidak_terdeteksi', 'tidak_terdeteksi', 'tidak_terdeteksi',
    ];
    const emosi = weighted[Math.floor(Math.random() * weighted.length)];
    // tidak_terdeteksi punya confidence rendah (kamera buram/tidak ada wajah)
    const confidence = emosi === 'tidak_terdeteksi'
      ? +(0.30 + Math.random() * 0.30).toFixed(2)
      : +(0.68 + Math.random() * 0.30).toFixed(2);
    return HttpResponse.json({ emosi, confidence, timestamp: nowISO() });
  }),

  // GET /emotion/history
  // Params: { siswa_id, session_id }
  // Return array EmotionResult terurut dari terlama ke terbaru
  // Mensimulasikan tren emosi yang berubah selama sesi belajar
  http.get(url('/emotion/history'), async () => {
    const now = Date.now();
    await d(300);
    return HttpResponse.json([
      { emosi: 'tidak_terdeteksi', confidence: 0.45, timestamp: new Date(now - 300000).toISOString() },
      { emosi: 'bosan', confidence: 0.72, timestamp: new Date(now - 240000).toISOString() },
      { emosi: 'bingung', confidence: 0.84, timestamp: new Date(now - 180000).toISOString() },
      { emosi: 'bingung', confidence: 0.79, timestamp: new Date(now - 120000).toISOString() },
      { emosi: 'antusias', confidence: 0.91, timestamp: new Date(now - 60000).toISOString() },
      { emosi: 'antusias', confidence: 0.88, timestamp: new Date(now - 10000).toISOString() },
    ]);
  }),

  // ════════════════════════════════════════════════════════════════════
  // GAME — Tim 4
  // Hirarki: mapel → elemen → materi (opsional, jika guru turun ke level materi)
  // Tim 4 deliver game dalam format HTML — frontend render via <iframe src={html_url}>
  // ════════════════════════════════════════════════════════════════════

  // POST /game/generate
  // Body: { mapel_id, elemen_id, elemen_label, materi?, materi_id?, kelas_id, level, jenjang?, prompt_tambahan? }
  // Hirarki wajib: mapel_id + elemen_id + elemen_label. Materi opsional.
  http.post(url('/game/generate'), async ({ request }) => {
    const { mapel_id, elemen_id, elemen_label, materi, materi_id, level } = await request.json();
    await d(2500);
    // Label topik: pakai materi jika ada, fallback ke elemen_label
    const topik = materi || elemen_label || 'Pelajaran';
    const game_id = 'game_' + Date.now();
    return HttpResponse.json({
      game_id,
      nama: `Quest: ${topik}`,
      deskripsi: `Game edukasi interaktif tentang ${topik} — level ${level || 'Low'}`,
      mapel_id: mapel_id || '',
      elemen_id: elemen_id || '',
      elemen_label: elemen_label || '',
      materi: materi || null,
      materi_id: materi_id || null,
      level: level || 'Low',
      status: 'ready',
      // html_url: URL ke file HTML game dari Tim 4
      // Di mock pakai placeholder — produksi: URL CDN/hosting Tim 4
      html_url: `https://game.sekolahrakyat.id/play/${game_id}?level=${level || 'Low'}`,
    });
  }),

  // GET /game/list
  // Params: { kelas_id?, mapel_id?, elemen_id?, materi_id? }
  // html_url tidak disertakan di list — fetch GET /:id untuk dapat html_url
  http.get(url('/game/list'), async ({ request }) => {
    await d(400);
    const p = new URL(request.url).searchParams;
    const filterMapel = p.get('mapel_id');
    const filterElemen = p.get('elemen_id');
    const games = [
      {
        game_id: 'g1',
        nama: 'Algebraic Quest',
        deskripsi: 'Selesaikan persamaan untuk mengalahkan musuh!',
        mapel_id: 'mat',
        elemen_id: 'bil_aljabar',
        elemen_label: 'Bilangan dan Aljabar',
        materi: 'Persamaan Linear Satu Variabel',
        materi_id: 'mat__persamaan_linear_satu_variabel',
        level: 'Mid',
        status: 'ready',
        pemain: 24,
      },
      {
        game_id: 'g2',
        nama: 'Data Explorer',
        deskripsi: 'Jelajahi dunia statistika lewat petualangan data!',
        mapel_id: 'mat',
        elemen_id: 'data_statistika',
        elemen_label: 'Data dan Statistika',
        materi: null,
        materi_id: null,
        level: 'Low',
        status: 'ready',
        pemain: 18,
      },
      {
        game_id: 'g3',
        nama: 'Bio Cell Wars',
        deskripsi: 'Pertahankan sel dari serangan virus dalam simulasi biologi!',
        mapel_id: 'bio',
        elemen_id: 'pemahaman_bio',
        elemen_label: 'Pemahaman Biologi',
        materi: 'Sel dan Organel Sel',
        materi_id: 'bio__sel_dan_organel_sel',
        level: 'High',
        status: 'ready',
        pemain: 11,
      },
    ];
    // Filter sesuai params yang dikirim
    const filtered = games.filter(g =>
      (!filterMapel || g.mapel_id === filterMapel) &&
      (!filterElemen || g.elemen_id === filterElemen)
    );
    return HttpResponse.json(filtered);
  }),

  // GET /game/:game_id
  // Mengembalikan detail lengkap termasuk html_url untuk iframe
  // Tidak ada leaderboard — game tidak menghasilkan skor numerik
  http.get(url('/game/:game_id'), async ({ params }) => {
    await d(300);
    // Seed data untuk game_id yang sudah ada
    const seed = {
      g1: {
        nama: 'Algebraic Quest',
        deskripsi: 'Selesaikan persamaan untuk mengalahkan musuh!',
        mapel_id: 'mat',
        elemen_id: 'bil_aljabar',
        elemen_label: 'Bilangan dan Aljabar',
        materi: 'Persamaan Linear Satu Variabel',
        materi_id: 'mat__persamaan_linear_satu_variabel',
        level: 'Mid',
      },
      g2: {
        nama: 'Data Explorer',
        deskripsi: 'Jelajahi dunia statistika lewat petualangan data!',
        mapel_id: 'mat',
        elemen_id: 'data_statistika',
        elemen_label: 'Data dan Statistika',
        materi: null,
        materi_id: null,
        level: 'Low',
      },
      g3: {
        nama: 'Bio Cell Wars',
        deskripsi: 'Pertahankan sel dari serangan virus dalam simulasi biologi!',
        mapel_id: 'bio',
        elemen_id: 'pemahaman_bio',
        elemen_label: 'Pemahaman Biologi',
        materi: 'Sel dan Organel Sel',
        materi_id: 'bio__sel_dan_organel_sel',
        level: 'High',
      },
    };
    const data = seed[params.game_id] || {
      nama: 'Game Edukasi',
      deskripsi: 'Game edukasi interaktif.',
      mapel_id: 'mat',
      elemen_id: 'bil_aljabar',
      elemen_label: 'Bilangan dan Aljabar',
      materi: null,
      materi_id: null,
      level: 'Low',
    };
    return HttpResponse.json({
      game_id: params.game_id,
      ...data,
      status: 'ready',
      // html_url: URL placeholder — Tim 4 ganti dengan URL CDN sebenarnya
      html_url: `https://game.sekolahrakyat.id/play/${params.game_id}?level=${data.level}`,
    });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Kelas (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/kelas
  http.get(url('/admin/kelas'), async () => {
    await d(300);
    return HttpResponse.json(store.kelas);
  }),

  // GET /admin/kelas/:id
  http.get(url('/admin/kelas/:id'), async ({ params }) => {
    await d(200);
    const kelas = store.kelas.find(k => k.id === params.id);
    if (!kelas) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json(kelas);
  }),

  // GET /admin/kelas/:id/siswa
  http.get(url('/admin/kelas/:id/siswa'), async ({ params }) => {
    await d(300);
    const kelas = store.kelas.find(k => k.id === params.id);
    const ids = kelas?.siswaIds || kelas?.siswa_ids || [];
    const siswa = ids.map(sid => store.siswa.find(s => s.id === sid)).filter(Boolean);
    return HttpResponse.json(siswa);
  }),

  // POST /admin/kelas
  http.post(url('/admin/kelas'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const newK = { ...body, id: 'k_' + Date.now(), siswaIds: [], jumlah_siswa: 0 };
    store.kelas.push(newK);
    return HttpResponse.json(newK, { status: 201 });
  }),

  // PUT /admin/kelas/:id
  http.put(url('/admin/kelas/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    store.kelas = store.kelas.map(k => k.id === params.id ? { ...k, ...body } : k);
    const updated = store.kelas.find(k => k.id === params.id);
    return updated
      ? HttpResponse.json(updated)
      : HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
  }),

  // DELETE /admin/kelas/:id
  http.delete(url('/admin/kelas/:id'), async ({ params }) => {
    await d(300);
    const exists = store.kelas.some(k => k.id === params.id);
    if (!exists) return HttpResponse.json({ message: 'Kelas tidak ditemukan.' }, { status: 404 });
    store.kelas = store.kelas.filter(k => k.id !== params.id);
    // Lepas referensi siswa ke kelas ini
    store.siswa = store.siswa.map(s =>
      (s.kelas_id || s.kelasId) === params.id ? { ...s, kelas_id: null, kelasId: null } : s
    );
    return HttpResponse.json({ deleted: true });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Guru (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/guru
  http.get(url('/admin/guru'), async () => {
    await d(300);
    return HttpResponse.json(store.guru);
  }),

  // GET /admin/guru/:id
  http.get(url('/admin/guru/:id'), async ({ params }) => {
    await d(200);
    const guru = store.guru.find(g => g.id === params.id);
    if (!guru) return HttpResponse.json({ message: 'Guru tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json(guru);
  }),

  // POST /admin/guru
  http.post(url('/admin/guru'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const newG = {
      ...body,
      id: 'g_' + Date.now(),
      avatar: (body.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    };
    store.guru.push(newG);
    return HttpResponse.json(newG, { status: 201 });
  }),

  // PUT /admin/guru/:id
  http.put(url('/admin/guru/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    store.guru = store.guru.map(g => g.id === params.id ? { ...g, ...body } : g);
    const updated = store.guru.find(g => g.id === params.id);
    return updated
      ? HttpResponse.json(updated)
      : HttpResponse.json({ message: 'Guru tidak ditemukan.' }, { status: 404 });
  }),

  // DELETE /admin/guru/:id
  http.delete(url('/admin/guru/:id'), async ({ params }) => {
    await d(300);
    const exists = store.guru.some(g => g.id === params.id);
    if (!exists) return HttpResponse.json({ message: 'Guru tidak ditemukan.' }, { status: 404 });
    store.guru = store.guru.filter(g => g.id !== params.id);
    // Lepas wali kelas dari semua kelas yang menggunakan guru ini
    store.kelas = store.kelas.map(k =>
      (k.waliKelasId === params.id || k.wali_kelas_id === params.id)
        ? { ...k, waliKelasId: null, wali_kelas_id: null }
        : k
    );
    return HttpResponse.json({ deleted: true });
  }),

  // POST /admin/guru/bulk
  // Multipart: { file }
  http.post(url('/admin/guru/bulk'), async () => {
    await d(1500);
    return HttpResponse.json({ total: 10, berhasil: 9, gagal: 1, errors: [{ row: 5, pesan: 'NIP sudah terdaftar.' }] });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Siswa (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/siswa
  http.get(url('/admin/siswa'), async () => {
    await d(300);
    return HttpResponse.json(store.siswa);
  }),

  // GET /admin/siswa/:id
  http.get(url('/admin/siswa/:id'), async ({ params }) => {
    await d(200);
    const siswa = store.siswa.find(s => s.id === params.id);
    if (!siswa) return HttpResponse.json({ message: 'Siswa tidak ditemukan.' }, { status: 404 });
    return HttpResponse.json(siswa);
  }),

  // POST /admin/siswa
  http.post(url('/admin/siswa'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const kelasId = body.kelas_id || body.kelasId;
    const newS = {
      ...body,
      id: 's_' + Date.now(),
      kelas_id: kelasId || null,
      status: body.status || 'Belum Aktif',
      is_first_login: true,
      bergabung: nowISO(),
      last_login: null,
      avatar: (body.nama || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    };
    store.siswa.push(newS);
    if (kelasId) {
      store.kelas = store.kelas.map(k =>
        k.id === kelasId ? { ...k, siswaIds: [...(k.siswaIds || []), newS.id] } : k
      );
    }
    return HttpResponse.json(newS, { status: 201 });
  }),

  // PUT /admin/siswa/:id
  http.put(url('/admin/siswa/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    const oldSiswa = store.siswa.find(s => s.id === params.id);
    if (!oldSiswa) return HttpResponse.json({ message: 'Siswa tidak ditemukan.' }, { status: 404 });

    store.siswa = store.siswa.map(s => s.id === params.id ? { ...s, ...body } : s);

    // Update relasi kelas jika kelas_id berubah
    const newKelasId = body.kelas_id;
    const oldKelasId = oldSiswa.kelas_id || oldSiswa.kelasId;
    if (newKelasId && newKelasId !== oldKelasId) {
      if (oldKelasId) {
        store.kelas = store.kelas.map(k =>
          k.id === oldKelasId
            ? { ...k, siswaIds: (k.siswaIds || []).filter(sid => sid !== params.id) }
            : k
        );
      }
      store.kelas = store.kelas.map(k =>
        k.id === newKelasId
          ? { ...k, siswaIds: [...(k.siswaIds || []), params.id] }
          : k
      );
    }
    return HttpResponse.json(store.siswa.find(s => s.id === params.id));
  }),

  // DELETE /admin/siswa/:id
  http.delete(url('/admin/siswa/:id'), async ({ params }) => {
    await d(300);
    const s = store.siswa.find(x => x.id === params.id);
    if (!s) return HttpResponse.json({ message: 'Siswa tidak ditemukan.' }, { status: 404 });
    store.siswa = store.siswa.filter(x => x.id !== params.id);
    const kelasId = s.kelas_id || s.kelasId;
    if (kelasId) {
      store.kelas = store.kelas.map(k =>
        k.id === kelasId
          ? { ...k, siswaIds: (k.siswaIds || []).filter(sid => sid !== params.id) }
          : k
      );
    }
    return HttpResponse.json({ deleted: true });
  }),

  // POST /admin/siswa/bulk
  // Multipart: { file, kelas_id }
  http.post(url('/admin/siswa/bulk'), async ({ request }) => {
    // Dalam mock: parse field kelas_id dari FormData jika perlu
    await d(1500);
    return HttpResponse.json({ total: 30, berhasil: 30, gagal: 0, errors: [] });
  }),

  // ════════════════════════════════════════════════════════════════════
  // ADMIN — Mapel (store-backed)
  // ════════════════════════════════════════════════════════════════════

  // GET /admin/mapel
  http.get(url('/admin/mapel'), async () => {
    await d(300);
    return HttpResponse.json(store.mapel);
  }),

  // POST /admin/mapel
  http.post(url('/admin/mapel'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    if (store.mapel.some(m => m.id === body.id)) {
      return HttpResponse.json({ message: 'id mapel sudah dipakai.' }, { status: 409 });
    }
    const newM = { icon: '📚', color: '#718096', ...body };
    store.mapel.push(newM);
    return HttpResponse.json(newM, { status: 201 });
  }),

  // PUT /admin/mapel/:id
  http.put(url('/admin/mapel/:id'), async ({ request, params }) => {
    const body = await request.json();
    await d(400);
    store.mapel = store.mapel.map(m => m.id === params.id ? { ...m, ...body } : m);
    const updated = store.mapel.find(m => m.id === params.id);
    return updated
      ? HttpResponse.json(updated)
      : HttpResponse.json({ message: 'Mapel tidak ditemukan.' }, { status: 404 });
  }),

  // DELETE /admin/mapel/:id
  http.delete(url('/admin/mapel/:id'), async ({ params }) => {
    await d(300);
    store.mapel = store.mapel.filter(m => m.id !== params.id);
    // Lepas mapel dari guru yang mengajarnya
    store.guru = store.guru.map(g => ({
      ...g,
      mapelId: (g.mapelId || []).filter(mid => mid !== params.id),
      mapel_ids: (g.mapel_ids || []).filter(mid => mid !== params.id),
    }));
    return HttpResponse.json({ deleted: true });
  }),

  // ════════════════════════════════════════════════════════════════════
  // GURU — Rekomendasi Guru → Siswa
  // Fitur guru (bukan admin). Endpoint di /guru/ bukan /admin/.
  // ════════════════════════════════════════════════════════════════════

  // POST /guru/rekomendasi
  // Body: { guru_id, siswa_id, mapel_id, pesan }
  // Role: guru
  http.post(url('/guru/rekomendasi'), async ({ request }) => {
    const body = await request.json();
    await d(400);
    const guru = store.guru.find(g => g.id === body.guru_id);
    const mapel = store.mapel.find(m => m.id === body.mapel_id);
    const newRek = {
      id: 'rek_' + Date.now(),
      guru_id: body.guru_id,
      guru_nama: guru?.nama || 'Guru',
      guru_mapel: `${mapel?.icon || '📚'} ${mapel?.label || body.mapel_id}`,
      siswa_id: body.siswa_id,
      pesan: body.pesan,
      dibaca: false,
      created_at: nowISO(),
    };
    store.rekomendasi.push(newRek);
    return HttpResponse.json({ id: newRek.id, created_at: newRek.created_at }, { status: 201 });
  }),

  // GET /guru/rekomendasi
  // Params: { siswa_id }
  // Role: siswa — dipanggil DashboardSection untuk notifikasi bell
  http.get(url('/guru/rekomendasi'), async ({ request }) => {
    const p = new URL(request.url).searchParams;
    const siswaId = p.get('siswa_id');
    await d(400);
    const hasil = store.rekomendasi
      .filter(r => !siswaId || r.siswa_id === siswaId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return HttpResponse.json(hasil);
  }),

];