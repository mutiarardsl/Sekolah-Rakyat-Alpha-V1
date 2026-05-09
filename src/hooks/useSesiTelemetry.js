/**
 * SR MVP — useSesiTelemetry Hook
 * Tim 6 FE | src/hooks/useSesiTelemetry.js
 *
 * ── TUJUAN ────────────────────────────────────────────────────────────
 * C3 FIX: Menjembatani sessionTelemetry dengan flow chatbot siswa
 * TANPA mengubah UI/UX/layout ChatSection atau StudentView.
 *
 * Hook ini:
 *   1. Listen event 'sr_student_violation' dari ChatSection
 *      → forward ke sessionTelemetry.reportViolation()
 *   2. Expose startSesi() dan endSesi() yang dipanggil dari StudentView
 *      saat chatbot dibuka/ditutup
 *   3. Auto-end sesi saat komponen unmount (page navigation)
 *
 * ── CARA PAKAI (di StudentView, tanpa mengubah UI) ─────────────────────
 *   const { startSesi, endSesi } = useSesiTelemetry();
 *
 *   // Setelah POST /sesi mengembalikan sesi_id:
 *   startSesi(sesiId);
 *
 *   // Saat handleSafeBack() dipanggil:
 *   await endSesi(currentEmosi);
 * ─────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import { sessionTelemetry, flushOfflineQueue } from '../telemetry/sessionTelemetry';

export function useSesiTelemetry() {
    const emosiRef = useRef(null); // emosi terakhir dari useWebcamEmotion

    // ── Listen violation events dari ChatSection ─────────────────────────
    useEffect(() => {
        const handleViolation = (e) => {
            const detail = e.detail?.payload?.detail || e.detail?.detail || 'Pelanggaran terdeteksi';
            sessionTelemetry.reportViolation(detail);
        };

        window.addEventListener('sr_student_violation', handleViolation);

        // Flush sesi yang gagal dari sesi sebelumnya
        flushOfflineQueue().catch(() => { });

        return () => {
            window.removeEventListener('sr_student_violation', handleViolation);
        };
    }, []);

    // ── Cleanup saat unmount (navigasi ke halaman lain) ──────────────────
    useEffect(() => {
        return () => {
            // End sesi tanpa await — fire-and-forget untuk navigasi cepat
            if (sessionTelemetry.currentSesiId) {
                sessionTelemetry.end(emosiRef.current).catch(() => { });
            }
        };
    }, []);

    /** Mulai tracking sesi. Dipanggil setelah POST /sesi. */
    const startSesi = useCallback((sesiId) => {
        sessionTelemetry.start(sesiId);
    }, []);

    /** Update emosi terakhir (dipanggil dari useWebcamEmotion callback) */
    const setCurrentEmosi = useCallback((emosi) => {
        emosiRef.current = emosi;
    }, []);

    /** Akhiri sesi. Dipanggil saat siswa menutup chatbot. */
    const endSesi = useCallback(async (emosiAkhir) => {
        const emosi = emosiAkhir ?? emosiRef.current;
        await sessionTelemetry.end(emosi);
        emosiRef.current = null;
    }, []);

    return {
        startSesi,
        endSesi,
        setCurrentEmosi,
        currentSesiId: sessionTelemetry.currentSesiId,
        currentDurasi: sessionTelemetry.currentDurasiMenit,
    };
}