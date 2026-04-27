/**
 * SR MVP — useWebSocket Hook (REVISED)
 * Tim 6 Fase 2 | src/hooks/useWebSocket.js
 *
 * PERUBAHAN:
 * - Dummy data selaraskan topik, quiz score, emosi, lastActive dari masterData
 * - Topik diambil dari todayTopik masing-masing siswa (tanggal 16 Mar = data hari ini)
 * - Quiz score mengikuti todayQuizScore (mis. 8/10, bukan 55/100)
 * - Emosi initial sesuai emotionKey masterData
 * BUGFIX (Fase 2):
 * - Tambah definisi SEED_VIOLATIONS yang hilang — penyebab startDummy() crash dengan
 *   ReferenceError sehingga live event monitoring guru tidak pernah berjalan.
 *   SEED_VIOLATIONS di-build dari riwayat[0].violations masing-masing siswa di masterData.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { STUDENTS } from '../data/masterData';

const USE_WS = import.meta.env.VITE_USE_WS === 'true';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

// Ambil hanya siswa yang aktif hari ini dari masterData
const ACTIVE_STUDENTS = STUDENTS.filter(s => s.todayActive).map(s => ({
  id: s.id,
  nama: s.name,
  avatar: s.avatar,
  // Sub-materi aktif hari ini (sesuai riwayat 16 Mar / todayMateriId)
  materiId: s.todayMateriId,
  level: s.todayLevel || 'low',
  // Emosi awal sesuai masterData
  emosi: s.emotionKey,
  // Quiz score aktual dari masterData
  quizScore: s.todayQuizScore,
  quizTotal: s.todayQuizTotal,
  // lastActive string dari masterData
  lastActive: s.lastActive,
}));

// Build SEED_VIOLATIONS dari sesi terbaru setiap siswa di masterData
// Format: { [siswaId]: [{ detail, timestamp }, ...] }
const SEED_VIOLATIONS = STUDENTS.reduce((acc, s) => {
  const latestSession = s.riwayat?.[0];
  if (latestSession?.violations?.length) {
    acc[s.id] = latestSession.violations;
  }
  return acc;
}, {});

const EMOTIONS = ['bosan', 'bingung', 'frustrasi', 'antusias'];
const VIOLATION_DETAILS = [
  'Berpindah Tab / Menyembunyikan Halaman',
  'Membuka Aplikasi / Window Lain',
  'Browser Diperkecil / Split Screen',
];

const now = () =>
  new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });


// Generate event yang realistis, topik & quiz dari masterData
// ~15% chance menghasilkan student_violation agar terasa realistis
const randomEvent = () => {
  const studentSeed = ACTIVE_STUDENTS[Math.floor(Math.random() * ACTIVE_STUDENTS.length)];
  const siswa = { id: studentSeed.id, nama: studentSeed.nama, avatar: studentSeed.avatar };

  // 15% chance violation event
  const rand = Math.random();
  if (rand < 0.15) {
    const detail = VIOLATION_DETAILS[Math.floor(Math.random() * VIOLATION_DETAILS.length)];
    return {
      type: 'student_violation',
      siswa,
      payload: { detail, timestamp: now() },
      timestamp: now(),
    };
  }

  const types = ['student_emotion', 'student_progress', 'student_quiz'];
  const type = types[Math.floor(Math.random() * types.length)];

  const payloads = {
    student_emotion: {
      emosi: EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)],
      confidence: +(0.72 + Math.random() * 0.26).toFixed(2),
    },
    student_progress: {
      materiId: studentSeed.materiId,
      progress: Math.floor(40 + Math.random() * 55),
    },
    student_quiz: {
      materiId: studentSeed.materiId,
      score: studentSeed.quizScore ?? Math.floor(5 + Math.random() * 5),
      total: studentSeed.quizTotal ?? 10,
    },
  };
  return { type, siswa, payload: payloads[type], timestamp: now() };
};

// ── Hook ───────────────────────────────────────────────────────────
export function useWebSocket({ kelasId, guruId, enabled = true }) {
  const [connected, setConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');
  const [events, setEvents] = useState([]);
  const [liveStudents, setLiveStudents] = useState({});

  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const intervalRef = useRef(null);

  // ── Shared: push one event & update liveStudents ──────────────
  const pushEvent = useCallback((event) => {
    setEvents(prev => [event, ...prev].slice(0, 60));
    setLiveStudents(prev => {
      const cur = prev[event.siswa.id] || { ...event.siswa };
      const upd = { ...cur, lastSeen: event.timestamp };
      if (event.type === 'student_emotion') upd.emosi = event.payload.emosi;
      if (event.type === 'student_progress') {
        upd.Materi = event.payload.Materi;
        upd.materiId = event.payload.materiId;
        upd.progress = event.payload.progress;
        upd.aktif = true;
      }
      if (event.type === 'student_active') {
        upd.aktif = true;
        upd.Materi = event.payload.Materi;
        upd.materiId = event.payload.materiId;
      }
      if (event.type === 'student_inactive') upd.aktif = false;
      if (event.type === 'student_violation') {
        // Tambahkan pelanggaran ke riwayat violations siswa
        const prevViolations = cur.violations || [];
        upd.violations = [...prevViolations, {
          detail: event.payload.detail,
          timestamp: event.payload.timestamp || event.timestamp,
        }].slice(0, 20); // max 20 catatan
        upd.lastViolation = event.payload.detail;
        upd.lastViolationTime = event.payload.timestamp || event.timestamp;
        upd.hasViolation = true;
      }
      if (event.type === 'student_progress') {
        upd.level = event.payload.level || prev.level;  // ← tambah
      }
      if (event.type === 'student_quiz') {
        // Simpan score aktual (bukan /100)
        upd.lastQuiz = event.payload.score;
        upd.lastQuizTotal = event.payload.total ?? 10;
      }
      return { ...prev, [event.siswa.id]: upd };
    });
  }, []);

  // ── DUMMY MODE ────────────────────────────────────────────────
  const startDummy = useCallback(() => {
    setWsStatus('connected');
    setConnected(true);

    // Seed initial live states + violations dari SEED_VIOLATIONS
    ACTIVE_STUDENTS.forEach(s => {
      const seedV = SEED_VIOLATIONS[s.id] || [];
      setLiveStudents(prev => ({
        ...prev,
        [s.id]: {
          id: s.id,
          nama: s.nama,
          avatar: s.avatar,
          emosi: s.emosi,
          materiId: s.materiId,
          level: s.todayLevel || 'low',
          progress: Math.floor(40 + Math.random() * 50),
          aktif: true,
          lastSeen: s.lastActive,
          lastQuiz: s.quizScore,
          lastQuizTotal: s.quizTotal ?? 10,
          // Seed violations langsung
          violations: seedV,
          hasViolation: seedV.length > 0,
          lastViolation: seedV.length > 0 ? seedV[seedV.length - 1].detail : null,
          lastViolationTime: seedV.length > 0 ? seedV[seedV.length - 1].timestamp : null,
        },
      }));
    });

    // Push periodic events (termasuk ~15% chance violation)
    const schedule = () => {
      const delay = 5000 + Math.random() * 6000;
      intervalRef.current = setTimeout(() => {
        pushEvent(randomEvent());
        schedule();
      }, delay);
    };
    schedule();
  }, [pushEvent]);

  // ── REAL WS MODE ──────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const token = localStorage.getItem('sr_access_token');
    const url = `${WS_URL}/monitoring?kelas_id=${kelasId}&guru_id=${guruId}&token=${token || ''}`;
    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); setWsStatus('connected'); clearTimeout(retryRef.current); };
    ws.onmessage = (e) => { try { pushEvent(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
    ws.onerror = () => setWsStatus('error');
    ws.onclose = () => {
      setConnected(false);
      setWsStatus('disconnected');
      retryRef.current = setTimeout(connectWS, 5000);
    };
  }, [kelasId, guruId, pushEvent]);

  // ── Lifecycle ─────────────────────────────────────────────────
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
      if (wsRef.current) wsRef.current.close();
      clearTimeout(intervalRef.current);
      clearTimeout(retryRef.current);
    };
  }, [enabled, connectWS, startDummy]);

  const clearEvents = useCallback(() => setEvents([]), []);
  const disconnect = useCallback(() => {
    clearTimeout(intervalRef.current);
    clearTimeout(retryRef.current);
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

  return {
    connected,
    wsStatus,
    events,
    liveStudents,
    clearEvents,
    disconnect,
    activeCount,
    emotionSummary,
    isDummy: !USE_WS,
  };
}