/**
 * SR MVP — useWebSocket Hook (V3 HARDENED)
 * Tim 6 FE | src/hooks/useWebSocket.js
 *
 * ── PERUBAHAN V3 HARDENING ────────────────────────────────────────────
 * C2 FIX: Event name dimigrasi ke contract V3 FINAL via SOCKET_EVENTS constant.
 *   SEBELUM (V2 lama — SALAH):
 *     student_emotion, student_violation, student_progress, student_quiz
 *     student_active, student_inactive
 *   SESUDAH (V3 FINAL — BENAR):
 *     emosi_siswa, pelanggaran_siswa, progress_siswa, quiz_siswa
 *     siswa_aktif, siswa_nonaktif
 *
 * Semua event name diambil dari SOCKET_EVENTS — tidak ada hardcode string.
 *
 * TAMBAHAN:
 *   - Exponential backoff reconnect (1s->2s->4s->8s maks 30s)
 *   - Duplicate listener protection via cleanup ref
 *   - Stale closure protection via callback ref pattern
 *   - Keepalive ping setiap 30 detik (real WS mode)
 *
 * UI: TIDAK ADA PERUBAHAN — hook hanya mengubah payload mapping internal.
 * ─────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { STUDENTS } from '../data/masterData';
import { SOCKET_EVENTS, SOCKET_CLIENT_EVENTS } from '../constants/socket-events';

const USE_WS = import.meta.env.VITE_USE_WS === 'true';
const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const KEEPALIVE_MS = 30000;

const ACTIVE_STUDENTS = STUDENTS.filter(s => s.todayActive).map(s => ({
  id: s.id,
  nama: s.name,
  avatar: s.avatar,
  materiId: s.todayMateriId,
  mapelId: s.todayMapelId || (s.riwayat?.[0]?.mapelId) || null,
  elemenId: s.todayElemenId || (s.riwayat?.[0]?.elemenId) || null,
  level: s.todayLevel || 'low',
  emosi: s.emotionKey,
  quizScore: s.todayQuizScore,
  quizTotal: s.todayQuizTotal,
  lastActive: s.lastActive,
}));

const SEED_VIOLATIONS = STUDENTS.reduce((acc, s) => {
  const latest = s.riwayat?.[0];
  if (latest?.violations?.length) acc[s.id] = latest.violations;
  return acc;
}, {});

const DUMMY_EMOTIONS = ['bosan', 'bingung', 'frustrasi', 'antusias'];
const VIOLATION_DETAILS = [
  'Berpindah Tab / Menyembunyikan Halaman',
  'Membuka Aplikasi / Window Lain',
  'Browser Diperkecil / Split Screen',
];
const tsNow = () =>
  new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const randomDummyEvent = () => {
  const seed = ACTIVE_STUDENTS[Math.floor(Math.random() * ACTIVE_STUDENTS.length)];
  const siswa = { id: seed.id, nama: seed.nama, avatar: seed.avatar };
  const rand = Math.random();

  if (rand < 0.15) {
    return {
      type: SOCKET_EVENTS.PELANGGARAN_SISWA,
      siswa,
      payload: { detail: VIOLATION_DETAILS[Math.floor(Math.random() * VIOLATION_DETAILS.length)] },
      timestamp: tsNow(),
    };
  }

  const types = [SOCKET_EVENTS.EMOSI_SISWA, SOCKET_EVENTS.PROGRESS_SISWA, SOCKET_EVENTS.QUIZ_SISWA];
  const type = types[Math.floor(Math.random() * types.length)];

  const payloads = {
    [SOCKET_EVENTS.EMOSI_SISWA]: {
      emosi: DUMMY_EMOTIONS[Math.floor(Math.random() * DUMMY_EMOTIONS.length)],
      confidence: +(0.72 + Math.random() * 0.26).toFixed(2),
      durasi_emosi_negatif_menit: 0,
    },
    [SOCKET_EVENTS.PROGRESS_SISWA]: {
      mapel_id: seed.mapelId,
      elemen_id: seed.elemenId,
      materi_id: seed.materiId,
      level: seed.level,
      progress_pct: Math.floor(40 + Math.random() * 55),
    },
    [SOCKET_EVENTS.QUIZ_SISWA]: {
      mapel_id: seed.mapelId,
      elemen_id: seed.elemenId,
      materi_id: seed.materiId,
      tipe: 'mc',
      nilai: seed.quizScore ?? Math.floor(50 + Math.random() * 50),
      level: seed.level,
      naik_level: false,
    },
  };

  return { type, siswa, payload: payloads[type], timestamp: tsNow() };
};

export function useWebSocket({ kelasId, mapelId, guruId, enabled = true, onEssayDinilai }) {
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');
  const [events, setEvents] = useState([]);
  const [liveStudents, setLiveStudents] = useState({});

  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const intervalRef = useRef(null);
  const keepaliveRef = useRef(null);
  const retryCount = useRef(0);
  const pushEventRef = useRef(null);

  const pushEvent = useCallback((event) => {
    if (!event?.type || !event?.siswa?.id) return;

    setEvents(prev => [event, ...prev].slice(0, 60));

    // V3.3: essay_dinilai callback — invoke sebelum setLiveStudents
    if (event.type === SOCKET_EVENTS.ESSAY_DINILAI) {
      onEssayDinilai?.(event.payload, event.siswa);
    }

    setLiveStudents(prev => {
      const cur = prev[event.siswa.id] || { ...event.siswa };
      const upd = { ...cur, lastSeen: event.timestamp };

      switch (event.type) {
        case SOCKET_EVENTS.EMOSI_SISWA:
          upd.emosi = event.payload.emosi;
          break;

        case SOCKET_EVENTS.PROGRESS_SISWA:
          upd.mapelId = event.payload.mapel_id ?? upd.mapelId;
          upd.elemenId = event.payload.elemen_id ?? upd.elemenId;
          upd.materiId = event.payload.materi_id ?? upd.materiId;
          upd.level = event.payload.level ?? upd.level;
          upd.progress = event.payload.progress_pct;
          upd.aktif = true;
          break;

        case SOCKET_EVENTS.SISWA_AKTIF:
          upd.aktif = true;
          upd.mapelId = event.payload.mapel_id ?? upd.mapelId;
          upd.elemenId = event.payload.elemen_id ?? upd.elemenId;
          upd.materiId = event.payload.materi_id ?? upd.materiId;
          break;

        case SOCKET_EVENTS.SISWA_NONAKTIF:
          upd.aktif = false;
          break;

        case SOCKET_EVENTS.PELANGGARAN_SISWA: {
          const prevV = cur.violations || [];
          upd.violations = [...prevV, {
            detail: event.payload.detail,
            timestamp: event.payload.terjadi_at || event.timestamp,
          }].slice(0, 20);
          upd.lastViolation = event.payload.detail;
          upd.lastViolationTime = event.payload.terjadi_at || event.timestamp;
          upd.hasViolation = true;
          break;
        }

        case SOCKET_EVENTS.QUIZ_SISWA:
          upd.lastQuiz = event.payload.nilai;
          upd.lastQuizTotal = 100;
          upd.level = event.payload.level ?? upd.level;
          break;

        case SOCKET_EVENTS.SMART_ALERT:
          // Diteruskan ke events list — UI MonitoringSection yang render
          break;

        case SOCKET_EVENTS.ESSAY_DINILAI:
          // V3.3: Push notifikasi nilai essay selesai — callback ke komponen yang subscribe
          // onEssayDinilai dipanggil di level hook, komponen handle update UI
          // (REFACTOR 5: WebSocket essay_dinilai)
          break;

        default:
          if (import.meta.env.DEV) {
            console.warn('[WS] Unknown event type (periksa contract V3):', event.type);
          }
          break;
      }

      return { ...prev, [event.siswa.id]: upd };
    });
  }, []);

  useEffect(() => { pushEventRef.current = pushEvent; }, [pushEvent]);

  const startDummy = useCallback(() => {
    setWsStatus('connected');
    setConnected(true);

    ACTIVE_STUDENTS.forEach(s => {
      const seedV = SEED_VIOLATIONS[s.id] || [];
      setLiveStudents(prev => ({
        ...prev,
        [s.id]: {
          id: s.id,
          nama: s.nama,
          avatar: s.avatar,
          emosi: s.emosi,
          mapelId: s.mapelId,
          elemenId: s.elemenId,
          materiId: s.materiId,
          level: s.level,
          progress: Math.floor(40 + Math.random() * 50),
          aktif: true,
          lastSeen: s.lastActive,
          lastQuiz: s.quizScore,
          lastQuizTotal: s.quizTotal ?? 10,
          violations: seedV,
          hasViolation: seedV.length > 0,
          lastViolation: seedV.length ? seedV[seedV.length - 1].detail : null,
          lastViolationTime: seedV.length ? seedV[seedV.length - 1].timestamp : null,
        },
      }));
    });

    const schedule = () => {
      const delay = 5000 + Math.random() * 6000;
      intervalRef.current = setTimeout(() => {
        pushEventRef.current?.(randomDummyEvent());
        schedule();
      }, delay);
    };
    schedule();
  }, []);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // CONTRACT V3.6 §22.1.1: wss://.../ws/monitoring?kelas_id=&mapel_id=&token=
    const token = localStorage.getItem('sr_access_token');
    const mapelParam = mapelId ? `&mapel_id=${encodeURIComponent(mapelId)}` : '';
    const wsUrl = `${WS_BASE}/monitoring?kelas_id=${kelasId}${mapelParam}&token=${token || ''}`;
    setWsStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setWsStatus('connected');
      retryCount.current = 0;
      clearTimeout(retryRef.current);

      clearInterval(keepaliveRef.current);
      keepaliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: SOCKET_CLIENT_EVENTS.PING }));
        }
      }, KEEPALIVE_MS);
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === SOCKET_EVENTS.CONNECTED || event.type === SOCKET_EVENTS.PONG) return;
        if (event.type === SOCKET_EVENTS.ERROR) {
          console.error('[WS] Server error:', event.payload);
          return;
        }
        pushEventRef.current?.(event);
      } catch {
        /* malformed JSON — abaikan */
      }
    };

    ws.onerror = () => setWsStatus('error');

    ws.onclose = (e) => {
      setConnected(false);
      setWsStatus('disconnected');
      clearInterval(keepaliveRef.current);

      const backoff = Math.min(
        RECONNECT_BASE_MS * 2 ** retryCount.current,
        RECONNECT_MAX_MS,
      );
      retryCount.current += 1;
      if (import.meta.env.DEV) {
        console.log(`[WS] Disconnected (code ${e.code}). Retry in ${backoff}ms`);
      }
      retryRef.current = setTimeout(connectWS, backoff);
    };
  }, [kelasId, mapelId]);

  useEffect(() => {
    if (!enabled) return;
    if (USE_WS) {
      connectWS();
    } else {
      setWsStatus('connecting');
      const t = setTimeout(startDummy, 900);
      return () => clearTimeout(t);
    }
    return () => {
      wsRef.current?.close();
      clearTimeout(retryRef.current);
      clearTimeout(intervalRef.current);
      clearInterval(keepaliveRef.current);
    };
  }, [enabled, connectWS, startDummy]);

  const clearEvents = useCallback(() => setEvents([]), []);
  const disconnect = useCallback(() => {
    clearTimeout(retryRef.current);
    clearTimeout(intervalRef.current);
    clearInterval(keepaliveRef.current);
    wsRef.current?.close();
    setConnected(false);
    setWsStatus('disconnected');
  }, []);

  const students = Object.values(liveStudents);
  const activeCount = students.filter(s => s.aktif).length;
  const emotionSummary = students.reduce((acc, s) => {
    if (s.emosi) acc[s.emosi] = (acc[s.emosi] || 0) + 1;
    return acc;
  }, {});

  return { connected, wsStatus, events, liveStudents, clearEvents, disconnect, activeCount, emotionSummary, isDummy: !USE_WS };
}

/**
 * CONTRACT V3.6 §22.1.2 — WebSocket Siswa
 * URL: wss://.../ws/siswa?siswa_id=&sesi_id=&token=
 *
 * Digunakan siswa untuk menerima notifikasi async dari BE:
 *   - essay_dinilai: setelah Tim 3 selesai menilai essay → FE update UI naik level
 *
 * Connect setelah POST /sesi berhasil dan chatbot terbuka.
 * Di mock mode (USE_WS=false), hook tidak aktif — essay_dinilai ditangani via
 * custom event 'mock_ws_essay_dinilai' dari handler quiz/essay.
 *
 * @param {{ siswaId: string, sesiId: string, enabled?: boolean, onEssayDinilai?: Function }} params
 */
export function useWebSocketSiswa({ siswaId, sesiId, enabled = true, onEssayDinilai }) {
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');

  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const keepaliveRef = useRef(null);
  const retryCount = useRef(0);
  const callbackRef = useRef(onEssayDinilai);

  useEffect(() => { callbackRef.current = onEssayDinilai; }, [onEssayDinilai]);

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('sr_access_token');
    // CONTRACT V3.6 §22.1.2: wss://.../ws/siswa?siswa_id=&sesi_id=&token=
    const wsUrl = `${WS_BASE}/siswa?siswa_id=${siswaId}&sesi_id=${encodeURIComponent(sesiId || '')}&token=${token || ''}`;
    setWsStatus('connecting');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setWsStatus('connected');
      retryCount.current = 0;
      clearTimeout(retryRef.current);

      clearInterval(keepaliveRef.current);
      keepaliveRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: SOCKET_CLIENT_EVENTS.PING }));
        }
      }, KEEPALIVE_MS);
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === SOCKET_EVENTS.CONNECTED || event.type === SOCKET_EVENTS.PONG) return;
        if (event.type === SOCKET_EVENTS.ESSAY_DINILAI) {
          callbackRef.current?.(event.payload, event.siswa);
        }
      } catch { /* malformed JSON */ }
    };

    ws.onerror = () => setWsStatus('error');

    ws.onclose = (e) => {
      setConnected(false);
      setWsStatus('disconnected');
      clearInterval(keepaliveRef.current);
      const backoff = Math.min(RECONNECT_BASE_MS * 2 ** retryCount.current, RECONNECT_MAX_MS);
      retryCount.current += 1;
      retryRef.current = setTimeout(connectWS, backoff);
    };
  }, [siswaId, sesiId]);

  useEffect(() => {
    // Di mock mode: essay_dinilai ditangani via custom DOM event — tidak perlu WS
    if (!enabled || !USE_WS) return;
    connectWS();
    return () => {
      wsRef.current?.close();
      clearTimeout(retryRef.current);
      clearInterval(keepaliveRef.current);
    };
  }, [enabled, connectWS]);

  const disconnect = useCallback(() => {
    clearTimeout(retryRef.current);
    clearInterval(keepaliveRef.current);
    wsRef.current?.close();
    setConnected(false);
    setWsStatus('disconnected');
  }, []);

  return { connected, wsStatus, disconnect, isDummy: !USE_WS };
}