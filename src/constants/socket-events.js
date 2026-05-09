/**
 * SR MVP — WebSocket Event Name Constants
 * SINGLE SOURCE OF TRUTH — jangan hardcode event name di luar file ini.
 *
 * Contract: API_Contract_SR_V3_FINAL.md §18.3
 * Tim: Tim 6 FE
 *
 * ──────────────────────────────────────────────────────────────────────
 * PERBAIKAN C2: useWebSocket.js sebelumnya menggunakan nama event V2 lama:
 *   student_emotion    ❌  → emosi_siswa       ✅
 *   student_violation  ❌  → pelanggaran_siswa ✅
 *   student_progress   ❌  → progress_siswa    ✅
 *   student_quiz       ❌  → quiz_siswa        ✅
 *   student_active     ❌  → siswa_aktif       ✅
 *   student_inactive   ❌  → siswa_nonaktif    ✅
 *
 * Semua komponen & hook WAJIB import dari sini — tidak boleh hardcode string.
 * ──────────────────────────────────────────────────────────────────────
 */

// ── Server → Client ────────────────────────────────────────────────────
export const SOCKET_EVENTS = Object.freeze({
    // Handshake
    CONNECTED: 'connected',
    ERROR: 'error',
    PONG: 'pong',

    // Siswa lifecycle
    SISWA_AKTIF: 'siswa_aktif',
    SISWA_NONAKTIF: 'siswa_nonaktif',

    // Real-time updates
    PROGRESS_SISWA: 'progress_siswa',
    QUIZ_SISWA: 'quiz_siswa',
    EMOSI_SISWA: 'emosi_siswa',
    PELANGGARAN_SISWA: 'pelanggaran_siswa',

    // Alerts
    SMART_ALERT: 'smart_alert',
});

// ── Client → Server ────────────────────────────────────────────────────
export const SOCKET_CLIENT_EVENTS = Object.freeze({
    PING: 'ping',
});

// ── Smart alert jenis ──────────────────────────────────────────────────
export const SMART_ALERT_JENIS = Object.freeze({
    EMOSI_NEGATIF: 'emosi_negatif_berkepanjangan',
    PELANGGARAN: 'pelanggaran_aktif',
});

// ── Emosi labels (dari contract Tim 1) ────────────────────────────────
export const EMOSI_LABELS = Object.freeze([
    'antusias',
    'bosan',
    'bingung',
    'frustrasi',
    'tidak_terdeteksi',
]);

export const EMOSI_NEGATIF = Object.freeze(['bosan', 'bingung', 'frustrasi']);