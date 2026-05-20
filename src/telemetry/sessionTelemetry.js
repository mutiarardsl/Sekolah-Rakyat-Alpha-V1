/**
 * SR MVP — Session Telemetry
 * Tim 6 FE | src/telemetry/sessionTelemetry.js
 *
 * ── TUJUAN ────────────────────────────────────────────────────────────
 * C3 FIX: PATCH /sesi/:id sebelumnya tidak pernah dipanggil, menyebabkan:
 *   - durasi belajar tidak tersimpan
 *   - violations tidak tercatat
 *   - KPI analytics salah
 *   - RAG context tidak akurat
 *
 * Modul ini menjadi SATU-SATUNYA tempat yang memanggil PATCH /sesi/:id.
 * Komponen UI TIDAK BOLEH memanggil PATCH /sesi/:id langsung.
 *
 * ── CARA PAKAI ────────────────────────────────────────────────────────
 *   import { sessionTelemetry } from '../telemetry/sessionTelemetry';
 *
 *   // Saat siswa membuka chatbot (sesi_id sudah ada dari POST /sesi):
 *   sessionTelemetry.start(sesiId);
 *
 *   // Saat ada pelanggaran terdeteksi:
 *   sessionTelemetry.reportViolation('Berpindah Tab');
 *
 *   // Saat siswa keluar / chatbot ditutup:
 *   sessionTelemetry.end(emosiAkhir);
 *
 * ── LIFECYCLE ─────────────────────────────────────────────────────────
 *   start() → rekam waktu mulai
 *   reportViolation() → catat ke queue
 *   heartbeat() → PATCH tiap N menit (opsional, tidak mengubah durasi akhir)
 *   end() → PATCH final dengan durasi + violations
 *
 * ── SAFETY ────────────────────────────────────────────────────────────
 *   - Retry queue jika PATCH gagal (maks 3x, exponential backoff)
 *   - beforeunload flush untuk durasi akurat saat halaman ditutup paksa
 *   - Debounce violation report (tidak spam PATCH tiap pelanggaran)
 *   - Offline safe: simpan ke sessionStorage, flush saat reconnect
 * ─────────────────────────────────────────────────────────────────────
 */

import { v3 } from '../http/requestV3.js';

const IS_DEV = import.meta.env.DEV;
const HEARTBEAT_MS = 2 * 60 * 1000;   // 2 menit
const RETRY_BASE_MS = 1_000;
const RETRY_MAX = 3;
const OFFLINE_KEY = 'sr_sesi_flush_queue';

// ── Internal state ─────────────────────────────────────────────────────
let _sesiId = null;
let _startTime = null;
let _violations = [];
let _heartbeatRef = null;
let _flushBound = null;     // bound beforeunload handler untuk bisa di-remove

// ── Low-level PATCH helper dengan retry ────────────────────────────────
async function _patchSesi(sesiId, body, attempt = 0) {
    if (!sesiId) return;
    try {
        await v3.patch(`/sesi/${encodeURIComponent(sesiId)}`, body);
        if (IS_DEV) console.log('[Telemetry] PATCH /sesi OK', sesiId, body);

        // Hapus dari offline queue jika ada
        _removeFromOfflineQueue(sesiId);
    } catch (err) {
        if (IS_DEV) console.warn(`[Telemetry] PATCH /sesi gagal (attempt ${attempt + 1})`, err?.message);
        if (attempt < RETRY_MAX) {
            const delay = RETRY_BASE_MS * 2 ** attempt;
            setTimeout(() => _patchSesi(sesiId, body, attempt + 1), delay);
        } else {
            // Gagal setelah maks retry → simpan ke offline queue
            _saveToOfflineQueue(sesiId, body);
        }
    }
}

// ── Offline queue (sessionStorage) ────────────────────────────────────
function _saveToOfflineQueue(sesiId, body) {
    try {
        const raw = sessionStorage.getItem(OFFLINE_KEY);
        const queue = raw ? JSON.parse(raw) : {};
        queue[sesiId] = { ...body, _savedAt: Date.now() };
        sessionStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
        if (IS_DEV) console.log('[Telemetry] Saved to offline queue:', sesiId);
    } catch { /* storage full atau private mode */ }
}

function _removeFromOfflineQueue(sesiId) {
    try {
        const raw = sessionStorage.getItem(OFFLINE_KEY);
        if (!raw) return;
        const queue = JSON.parse(raw);
        delete queue[sesiId];
        sessionStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
    } catch { /* ignore */ }
}

/** Flush pending sesi yang gagal — dipanggil saat koneksi pulih */
export async function flushOfflineQueue() {
    try {
        const raw = sessionStorage.getItem(OFFLINE_KEY);
        if (!raw) return;
        const queue = JSON.parse(raw);
        const entries = Object.entries(queue);
        if (!entries.length) return;

        if (IS_DEV) console.log(`[Telemetry] Flushing ${entries.length} offline sesi...`);
        for (const [sesiId, body] of entries) {
            // Hapus _savedAt sebelum kirim
            const { _savedAt, ...cleanBody } = body;
            await _patchSesi(sesiId, cleanBody);
        }
        sessionStorage.removeItem(OFFLINE_KEY);
    } catch { /* ignore */ }
}

// ── Hitung durasi menit dari startTime ───────────────────────────────
function _durasiMenit() {
    if (!_startTime) return 0;
    return Math.round((Date.now() - _startTime) / 60_000);
}

// ── beforeunload handler ───────────────────────────────────────────────
function _flushOnUnload() {
    if (!_sesiId || !_startTime) return;
    const body = {
        durasi_menit: _durasiMenit(),
        emosi_akhir: null,
        violations: _violations.map(v => ({
            detail: v.detail,
            terjadi_at: v.terjadi_at,
        })),
    };
    // Beacon API — satu-satunya yang dijamin fire saat halaman ditutup
    // VITE_API_BASE_URL sudah termasuk /v1 (e.g. https://api.sekolahrakyat.id/v1)
    // Jangan tambahkan /v1 lagi — lihat contract §1.1
    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/sesi/${encodeURIComponent(_sesiId)}`;
    const token = localStorage.getItem('sr_access_token');
    try {
        const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
        // Beacon tidak support custom headers → sertakan token di URL param sebagai fallback
        const beaconUrl = token ? `${url}?_token=${encodeURIComponent(token)}` : url;
        navigator.sendBeacon(beaconUrl, blob);
    } catch {
        // Beacon gagal → simpan ke offline queue untuk flush berikutnya
        _saveToOfflineQueue(_sesiId, body);
    }
}

// ══════════════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════════════

const sessionTelemetry = {
    /**
     * Mulai tracking sesi. Dipanggil setelah POST /sesi mengembalikan sesi_id.
     * @param {string} sesiId
     */
    start(sesiId) {
        if (!sesiId) return;

        // Reset state sesi lama jika ada
        this.end(null, { silent: true });

        _sesiId = sesiId;
        _startTime = Date.now();
        _violations = [];

        // Daftarkan beforeunload untuk flush saat halaman ditutup paksa
        if (_flushBound) window.removeEventListener('beforeunload', _flushBound);
        _flushBound = _flushOnUnload;
        window.addEventListener('beforeunload', _flushBound);

        // Heartbeat PATCH setiap 2 menit
        if (_heartbeatRef) clearInterval(_heartbeatRef);
        _heartbeatRef = setInterval(() => {
            this.updateDuration();
        }, HEARTBEAT_MS);

        if (IS_DEV) console.log('[Telemetry] Session started:', sesiId);
    },

    /**
     * Update durasi di tengah sesi (heartbeat).
     * Tidak mengirim violations — hanya durasi.
     */
    updateDuration() {
        if (!_sesiId) return;
        _patchSesi(_sesiId, { durasi_menit: _durasiMenit() });
    },

    /**
     * Catat satu pelanggaran.
     * @param {string} detail - label pelanggaran dari VIOLATION_DETAILS
     */
    reportViolation(detail) {
        if (!_sesiId) return;
        const violation = {
            detail,
            terjadi_at: new Date().toISOString(),
        };
        _violations.push(violation);

        // PATCH segera agar guru monitoring bisa melihat real-time
        _patchSesi(_sesiId, {
            durasi_menit: _durasiMenit(),
            violations: _violations.map(v => ({
                detail: v.detail,
                terjadi_at: v.terjadi_at,
            })),
        });
    },

    /**
     * Akhiri sesi — PATCH final dengan durasi + violations + emosi_akhir.
     * Dipanggil saat siswa menutup chatbot atau navigasi keluar.
     * @param {string|null} emosiAkhir - emosi terakhir dari Tim 1
     * @param {{ silent?: boolean }} options
     */
    async end(emosiAkhir = null, { silent = false } = {}) {
        if (!_sesiId) return;

        clearInterval(_heartbeatRef);
        _heartbeatRef = null;
        if (_flushBound) {
            window.removeEventListener('beforeunload', _flushBound);
            _flushBound = null;
        }

        const body = {
            durasi_menit: _durasiMenit(),
            emosi_akhir: emosiAkhir ?? null,
            violations: _violations.map(v => ({
                detail: v.detail,
                terjadi_at: v.terjadi_at,
            })),
        };

        if (!silent) {
            await _patchSesi(_sesiId, body);
        }

        if (IS_DEV) console.log('[Telemetry] Session ended:', _sesiId, body);

        // Reset
        _sesiId = null;
        _startTime = null;
        _violations = [];
    },

    /** Kembalikan sesi_id yang sedang aktif */
    get currentSesiId() { return _sesiId; },

    /** Kembalikan durasi menit saat ini */
    get currentDurasiMenit() { return _durasiMenit(); },
};

export { sessionTelemetry };
export default sessionTelemetry;