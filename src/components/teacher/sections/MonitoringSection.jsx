/**
 * SR MVP — MonitoringSection (Portal Guru) — REVISI FASE 3
 *
 * Perubahan:
 *  1. Tabel siswa: kolom Nama, Materi, Nilai Quiz, Durasi, Evaluasi, Aksi(Detail)
 *  2. Detail drawer: riwayat belajar per materi/elemen + log emosi (tren)
 *     Emosi: antusias, bosan, bingung, frustrasi, tidak_terdeteksi
 *     Log pelanggaran tetap ada jika ada data
 *  3. Modal 'Beri Rekomendasi': hanya textarea input, tanpa upload file
 *     Rekomendasi masuk notifikasi dashboard siswa
 *  4. Panel kanan: hapus distribusi emosi kelas, Smart Alert → Smart Info
 *     Smart Info: jumlah pelanggaran, jumlah per emosi, jumlah akses game
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Btn, EmptyState } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { STUDENTS, EMOSI_META, EMOSI_Y } from '../../../data/masterData';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import ReactDOM from 'react-dom';

/* ── Download CSV ────────────────────────────────────────────────── */
const downloadCSV = (content, filename) => {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

/* ── Emosi helpers ───────────────────────────────────────────────── */
const calcEmosiProfile = (emosiSesi) => {
  if (!emosiSesi || emosiSesi.length < 2) return null;
  const counts = { antusias: 0, bosan: 0, bingung: 0, frustrasi: 0, tidak_terdeteksi: 0 };
  emosiSesi.forEach(e => { if (counts[e.emosi] !== undefined) counts[e.emosi]++; });
  const total = emosiSesi.length;
  const firstEmosi = emosiSesi[0].emosi;
  const lastEmosi = emosiSesi[emosiSesi.length - 1].emosi;
  const isImproving = (EMOSI_Y[lastEmosi] ?? 4) < (EMOSI_Y[firstEmosi] ?? 4);
  const isDeclining = (EMOSI_Y[lastEmosi] ?? 4) > (EMOSI_Y[firstEmosi] ?? 4);
  const negRatio = (counts.frustrasi + counts.bingung) / total;
  return { counts, firstEmosi, lastEmosi, isImproving, isDeclining, negRatio, positiveEnd: lastEmosi === 'antusias' };
};

const toMinutes = (jam) => { const [h, m] = jam.split(':').map(Number); return h * 60 + (m || 0); };
const diffMinutes = (a, b) => Math.abs(toMinutes(b) - toMinutes(a));

const buildSegments = (sesi) => {
  if (!sesi || sesi.length < 2) return [];
  const segs = [];
  let cur = sesi[0];
  for (let i = 1; i < sesi.length; i++) {
    const next = sesi[i];
    segs.push({ emosi: cur.emosi, mulai: cur.jam, selesai: next.jam, durasi: diffMinutes(cur.jam, next.jam) });
    cur = next;
  }
  segs.push({ emosi: cur.emosi, mulai: cur.jam, selesai: null, durasi: null, isLast: true });
  return segs;
};

/* ── Evaluasi AI ─────────────────────────────────────────────────── */
const generateAIEvaluasi = (st) => {
  if (!st.todayActive) return null;
  const hasQuiz = st.todayQuizScore != null && st.todayQuizTotal != null;
  const noQuiz = st.todayActive && st.todayMateriId && !hasQuiz;
  const latestSesi = st.riwayat?.[0];
  const levelLabel = { low: 'Level Low', mid: 'Level Mid', high: 'Level High' };
  const levelCtx = st.todayLevel ? `(${levelLabel[st.todayLevel]}) ` : '';
  const emosiProfile = calcEmosiProfile(latestSesi?.emosiSesi);
  const durasi = st.todayStudyHours;
  const durasiLabel = !durasi ? null : durasi < 0.5 ? 'sangat singkat (< 30 menit)' : durasi < 1.0 ? 'singkat (< 1 jam)' : durasi >= 2.5 ? 'sangat panjang (> 2.5 jam)' : null;
  let emosiInsight = '';
  if (emosiProfile) {
    if (emosiProfile.isImproving && emosiProfile.positiveEnd) emosiInsight = 'Tren emosi menunjukkan progres positif — siswa berhasil membangun pemahaman.';
    else if (emosiProfile.isDeclining && emosiProfile.negRatio > 0.5) emosiInsight = 'Tren emosi menurun — siswa tampak kesulitan mempertahankan fokus.';
    else if (emosiProfile.counts.frustrasi >= 2) emosiInsight = 'Frustrasi berulang — materi mungkin terlalu sulit.';
    else if (emosiProfile.counts.bingung >= 3) emosiInsight = 'Kebingungan mendominasi — pendekatan visual disarankan.';
    else if (emosiProfile.counts.bosan >= 3) emosiInsight = 'Siswa terlihat bosan — coba variasikan dengan kuis ringan.';
    else if (emosiProfile.counts.tidak_terdeteksi > (latestSesi?.emosiSesi?.length ?? 0) * 0.4) emosiInsight = 'Banyak emosi tidak terdeteksi — periksa kondisi kamera siswa.';
  }
  if (noQuiz) {
    const parts = [`Siswa mengakses ${st.todayMateriId} namun belum mengerjakan kuis.`];
    if (durasiLabel) parts.push(`Durasi ${durasiLabel}.`);
    if (emosiInsight) parts.push(emosiInsight);
    parts.push('Dorong siswa untuk mengerjakan kuiz.');
    return parts.join(' ');
  }
  if (!hasQuiz) return null;
  const pct = st.todayQuizScore / st.todayQuizTotal;
  const pctStr = `${Math.round(pct * 100)}/100`;
  if (pct >= 0.9) {
    return [`Pencapaian luar biasa (${pctStr}).`, emosiProfile?.positiveEnd ? 'Emosi antusias — kondisi ideal.' : '', 'Siswa dapat diberi materi lanjut.'].filter(Boolean).join(' ');
  }
  if (pct >= 0.7) {
    return [`Pemahaman cukup baik (${pctStr}).`, durasiLabel === 'singkat (< 1 jam)' ? 'Durasi singkat — pendalaman berpotensi tingkatkan skor.' : '', emosiInsight, 'Latihan variatif untuk perkuat konsep.'].filter(Boolean).join(' ');
  }
  if (pct >= 0.5) {
    return [`Perlu perhatian (${pctStr}).`, emosiInsight || (emosiProfile?.negRatio > 0.4 ? 'Emosi negatif dominan — intervensi dini.' : ''), 'Rekomendasikan sesi ulang dengan pendekatan visual.'].filter(Boolean).join(' ');
  }
  return [`Pemahaman masih sangat kurang (${pctStr}).`, emosiInsight, 'Intervensi segera — pertimbangkan bimbingan individual.'].filter(Boolean).join(' ');
};

/* ── Smart Alerts ────────────────────────────────────────────────── */
function generateSmartAlerts(studentsWithLive) {
  const alerts = [];
  studentsWithLive.forEach(st => {
    if (!st.todayActive) return;
    if (st.hasViolation && st.violations?.length > 0) {
      alerts.push({ id: `violation-${st.id}`, level: 'warning', icon: '⚠️', text: `${st.name} terdeteksi ${st.violationCount}x pelanggaran`, color: '#C05621', bg: '#FFFBF0', student: st, isViolation: true });
    }
    if (st.todayQuizScore != null && st.todayQuizTotal != null) {
      const pct = st.todayQuizScore / st.todayQuizTotal;
      if (pct < 0.7) alerts.push({ id: `quiz-${st.id}`, level: pct < 0.5 ? 'critical' : 'warning', icon: '📝', text: `${st.name} skor ${st.todayQuizScore}/${st.todayQuizTotal} (${Math.round(pct * 100)}%)`, color: pct < 0.5 ? C.red : C.orange, bg: pct < 0.5 ? '#FFF5F5' : '#FFF8EE', student: st });
    }
    const latestRiwayat = st.riwayat?.[0];
    if (latestRiwayat?.emosiSesi) {
      const segs = buildSegments(latestRiwayat.emosiSesi);
      let kritisEmosi = null, totalDurasi = 0, firstJam = null, lastJam = null;
      segs.forEach(seg => {
        if ((seg.emosi === 'frustrasi' || seg.emosi === 'bingung') && seg.durasi !== null) {
          if (!kritisEmosi) { kritisEmosi = seg.emosi; firstJam = seg.mulai; }
          totalDurasi += seg.durasi; lastJam = seg.selesai;
        } else if (!seg.isLast) { kritisEmosi = null; totalDurasi = 0; firstJam = null; lastJam = null; }
      });
      if (totalDurasi > 15 && kritisEmosi && !alerts.find(a => a.id === `emosi-${st.id}`)) {
        const meta = EMOSI_META[kritisEmosi];
        alerts.push({ id: `emosi-${st.id}`, level: kritisEmosi === 'frustrasi' ? 'critical' : 'warning', icon: meta.emoji, text: `${st.name} terdeteksi ${meta.label} ±${totalDurasi} menit (${firstJam}${lastJam ? '–' + lastJam : ''})`, color: meta.color, bg: kritisEmosi === 'frustrasi' ? '#FFF5F5' : '#FFFBF0', student: st });
      }
    }
  });
  return alerts;
}

/* ── EmosiTimeline ───────────────────────────────────────────────── */
const EmosiTimeline = ({ sesi }) => {
  const segments = buildSegments(sesi);
  if (!segments.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 10 }}>
      {segments.map((seg, i) => {
        const meta = EMOSI_META[seg.emosi] || EMOSI_META.tidak_terdeteksi;
        return (
          <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
            <div style={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${meta.color}33`, marginTop: 4, flexShrink: 0 }} />
              {!seg.isLast && <div style={{ width: 2, flex: 1, background: `${meta.color}44`, minHeight: 20 }} />}
            </div>
            <div style={{ paddingBottom: seg.isLast ? 0 : 10, paddingLeft: 8, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                <span style={{ fontSize: FS.xs, fontWeight: 800, color: meta.color }}>{meta.emoji} {meta.label}</span>
                {seg.durasi !== null && (
                  <span style={{ fontSize: FS.xs, background: `${meta.color}18`, color: meta.color, padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>{seg.durasi} menit</span>
                )}
              </div>
              <div style={{ fontSize: FS.xs, color: C.slate }}>{seg.mulai}{seg.selesai ? ` → ${seg.selesai}` : ' (sedang berlangsung)'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Download Modal ──────────────────────────────────────────────── */
const DownloadModal = ({ cls, teacherMapel, studentsWithLive, onClose }) => {
  const todayISO = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const fileName = `Laporan_${cls?.label?.replace(/\s+/g, '_')}_${selectedDate}.csv`;

  const handleGenerate = () => { setGenerating(true); setTimeout(() => { setGenerating(false); setDone(true); }, 1000); };

  const handleDownload = () => {
    // Header — tanpa kolom evaluasi
    const header = [
      'Nama Siswa', 'NIS', 'Tanggal', 'Kelas', 'Mata Pelajaran',
      'Elemen / Materi', 'Level', 'Nilai Quiz', 'Durasi (jam)', 'Evaluasi',
    ].join(',');

    // Parse tanggal yang dipilih untuk matching riwayat
    const selDate = new Date(selectedDate + 'T00:00:00');
    const selHari = selDate.getDate();
    const selBulan = selDate.toLocaleDateString('id-ID', { month: 'short' });
    const selTahun = selDate.getFullYear();

    const rows = [];

    studentsWithLive.forEach(st => {
      // Kumpulkan semua sesi riwayat pada tanggal yang dipilih
      const sesiHariIni = (st.riwayat || []).filter(r =>
        r.tanggal?.includes(`${selHari}`) &&
        r.tanggal?.includes(selBulan) &&
        r.tanggal?.includes(`${selTahun}`)
      );

      if (sesiHariIni.length === 0) {
        // Siswa tidak aktif pada tanggal ini — 1 baris ringkasan
        rows.push([
          `"${st.name}"`, `"${st.nis || '-'}"`, selectedDate,
          `"${cls?.label || '-'}"`, `"${teacherMapel?.label || '-'}"`,
          '-', '-', '-', '-', 'Tidak Aktif',
        ].join(','));
      } else {
        // Satu baris per sesi (siswa bisa punya beberapa elemen/materi dalam satu hari)
        sesiHariIni.forEach(r => {
          const hasQuiz = r.quiz != null && r.quizTotal != null;
          rows.push([
            `"${st.name}"`, `"${st.nis || '-'}"`, selectedDate,
            `"${cls?.label || '-'}"`, `"${teacherMapel?.label || '-'}"`,
            `"${r.materiId || '-'}"`,
            `"${r.level || '-'}"`,
            hasQuiz ? Math.round((r.quiz / r.quizTotal) * 100) : '-',
            r.durasi != null ? r.durasi.toFixed(1) : '-',
            generateAIEvaluasi(st),
          ].join(','));
        });
      }
    });

    downloadCSV([header, ...rows].join('\n'), fileName);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(3px)' }} onClick={() => !generating && onClose()}>
      <div style={{ background: C.white, borderRadius: 18, width: 'min(380px, calc(100vw - 24px))', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark }}>📥 Unduh Laporan Harian</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{cls?.label} · {teacherMapel?.icon} {teacherMapel?.label}</div>
          </div>
          <button onClick={onClose} style={{ background: C.white, border: '2px solid #EDF2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          {generating ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ width: 34, height: 34, border: `3px solid ${C.tealXL}`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: FS.base, color: C.slate }}>Menyusun laporan…</div>
            </div>
          ) : !done ? (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: FS.sm, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7 }}>📅 Pilih Tanggal</label>
                <input type="date" value={selectedDate} max={todayISO} onChange={e => { setSelectedDate(e.target.value); setDone(false); }}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.tealXL}`, borderRadius: 9, fontSize: FS.base, fontFamily: 'inherit', outline: 'none', background: C.white, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Batal</Btn>
                <button onClick={handleGenerate} disabled={!selectedDate} style={{ flex: 2, padding: '10px 0', background: selectedDate ? `linear-gradient(135deg,${C.teal},${C.tealL})` : '#CBD5E0', border: 'none', borderRadius: 10, color: C.white, fontSize: FS.base, fontWeight: 700, cursor: selectedDate ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                  📋 Buat Laporan
                </button>
              </div>
            </>
          ) : (
            <div>
              <div style={{ background: '#F0FFF4', borderRadius: 12, padding: '14px 16px', marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
                <div style={{ fontSize: FS.base, fontWeight: 700, color: C.green }}>Laporan siap diunduh!</div>
              </div>
              <div onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${C.teal}`, cursor: 'pointer', background: C.tealXL, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>📊</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FS.md, fontWeight: 700, color: C.teal }}>{fileName}</div>
                </div>
                <span style={{ fontSize: FS.h1, color: C.teal, fontWeight: 800 }}>↓</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="ghost" onClick={() => setDone(false)} style={{ flex: 1, justifyContent: 'center' }}>← Ubah Tanggal</Btn>
                <Btn variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Tutup</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── EvaluasiDropdown ────────────────────────────────────────────── */
const EvaluasiDropdown = ({ text, color, bg }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('scroll', handleScroll, true);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('scroll', handleScroll, true); };
  }, [open]);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 8, left: Math.min(rect.left, window.innerWidth - 272) });
    }
    setOpen(v => !v);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button ref={btnRef} onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', border: `1px solid ${color}44`, borderRadius: 7, background: bg, cursor: 'pointer', fontSize: FS.sm, fontWeight: 700, color, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        Evaluasi {open ? '▲' : '▼'}
      </button>
      {open && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div ref={dropRef} style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateY(-100%)', zIndex: 9999, background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.16)', border: `1px solid ${color}33`, padding: '12px 14px', width: 260, fontSize: FS.sm, color: '#2D3748', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, color, marginBottom: 5, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: .7 }}>🤖 Evaluasi Mentor</div>
          {text}
        </div>,
        document.body
      )}
    </div>
  );
};

/* ── StudentDrawer ───────────────────────────────────────────────── */
const StudentDrawer = ({ student, recommendations, setRecModal, setRecText, onClose }) => {
  const [openSesiIdx, setOpenSesiIdx] = useState(null);
  const [openViolationIdx, setOpenViolationIdx] = useState(null);

  const riwayatByDate = useMemo(() => {
    const map = {};
    (student.riwayat || []).forEach((r, i) => {
      if (!map[r.tanggal]) map[r.tanggal] = [];
      map[r.tanggal].push({ ...r, origIdx: i });
    });
    return Object.entries(map).map(([tanggal, entries]) => ({ tanggal, entries }));
  }, [student]);

  const allHistoricViolations = new Set(
    (student.riwayat || []).flatMap(r => r.violations || []).map(v => `${v.detail}__${v.timestamp}`)
  );
  const wsViolations = (student.violations || []).filter(
    v => !allHistoricViolations.has(`${v.detail}__${v.timestamp}`)
  );
  const hasAnyViolation = wsViolations.length > 0 || student.hasViolation;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.4)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 998, backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div className="slide-right" onClick={e => e.stopPropagation()}
        style={{ width: 'min(420px, 96vw)', height: '100vh', background: C.bg, overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, ...(hasAnyViolation ? { borderLeft: '4px solid #C53030' } : {}) }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: hasAnyViolation ? '#C53030' : (student.todayActive ? student.avatarBg : '#CBD5E0'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: FS.lg, flexShrink: 0 }}>
            {student.avatar}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>{student.name}</div>
            <div style={{ fontSize: FS.sm, color: C.slate }}>{student.nis}</div>
          </div>
          <button onClick={onClose} style={{ background: C.bg, border: '2px solid #EDF2F7', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
        </div>

        {/* Tab label */}
        <div style={{ padding: '12px 18px 0', flexShrink: 0, borderBottom: `1px solid rgba(13,92,99,.08)` }}>
          <div style={{ fontSize: FS.md, fontWeight: 700, color: C.teal, paddingBottom: 10, borderBottom: `2px solid ${C.teal}`, display: 'inline-block' }}>
            📋 Riwayat Belajar
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {riwayatByDate.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: FS.md, color: C.slate }}>Belum ada riwayat belajar</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {riwayatByDate.map(({ tanggal, entries }) => (
                <div key={tanggal}>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📅 {tanggal}
                    {entries.length > 1 && <span style={{ background: C.amberL, color: C.orange, padding: '1px 7px', borderRadius: 99, fontWeight: 700, fontSize: 9 }}>{entries.length} materi</span>}
                  </div>
                  {entries.map((r) => {
                    const gIdx = r.origIdx;
                    const isTrenOpen = openSesiIdx === gIdx;
                    const isViolOpen = openViolationIdx === gIdx;
                    const quizColor = r.quiz / r.quizTotal >= 0.7 ? C.green : r.quiz / r.quizTotal >= 0.5 ? C.amber : C.red;
                    const isLatestSession = riwayatByDate[0]?.entries[0]?.origIdx === gIdx;
                    const rawSessionViolations = [...(r.violations || []), ...(isLatestSession ? wsViolations : [])];
                    const seenKeys = new Set();
                    const sessionViolations = rawSessionViolations.filter(v => {
                      const key = `${v.detail}__${v.timestamp}`;
                      if (seenKeys.has(key)) return false;
                      seenKeys.add(key);
                      return true;
                    });
                    const hasSessionViolation = sessionViolations.length > 0;
                    return (
                      <div key={gIdx} style={{ background: C.white, borderRadius: 10, border: `1.5px solid rgba(13,92,99,.07)`, marginBottom: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '11px 14px' }}>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark, marginBottom: 3 }}>{r.materiId}</div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <span style={{ fontSize: FS.sm, fontWeight: 700, color: quizColor }}>Quiz: {r.quiz}/{r.quizTotal}</span>
                              {r.level && (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, padding: '1px 7px',
                                  borderRadius: 99,
                                  background: r.level === 'high' ? '#FFF5F5' : r.level === 'mid' ? '#FFFBF0' : '#F0FFF4',
                                  color: r.level === 'high' ? '#9B2C2C' : r.level === 'mid' ? '#B7791F' : '#276749',
                                }}>
                                  Level {r.level}
                                </span>
                              )}
                              <span style={{ fontSize: FS.sm, color: C.darkL }}>{r.durasi.toFixed(1)} jam</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => { setOpenSesiIdx(isTrenOpen ? null : gIdx); if (!isTrenOpen) setOpenViolationIdx(null); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: isTrenOpen ? C.teal : C.tealXL, border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: FS.xs, color: isTrenOpen ? C.white : C.teal, fontWeight: 700, fontFamily: 'inherit' }}>
                              📈 Log Emosi {isTrenOpen ? '▲' : '▼'}
                            </button>
                            {hasSessionViolation && (
                              <button onClick={() => { setOpenViolationIdx(isViolOpen ? null : gIdx); if (!isViolOpen) setOpenSesiIdx(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: isViolOpen ? '#C53030' : '#FFF5F5', border: `1px solid ${isViolOpen ? '#C53030' : 'rgba(197,48,48,.3)'}`, borderRadius: 7, cursor: 'pointer', fontSize: FS.xs, color: isViolOpen ? '#fff' : '#C53030', fontWeight: 700, fontFamily: 'inherit' }}>
                                🚫 Log Pelanggaran
                                <span style={{ fontSize: FS.xs, background: isViolOpen ? 'rgba(255,255,255,.25)' : '#C53030', color: '#fff', padding: '0px 5px', borderRadius: 99, fontWeight: 800 }}>{sessionViolations.length}</span>
                                {isViolOpen ? ' ▲' : ' ▼'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable: Log Emosi */}
                        {isTrenOpen && (
                          <div style={{ borderTop: `1px solid rgba(13,92,99,.07)`, padding: '12px 14px', background: C.white }}>
                            <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 6 }}>Detail Perubahan Emosi</div>
                            <EmosiTimeline sesi={r.emosiSesi} />
                            {r.emosiSesi && r.emosiSesi.length >= 2 && (() => {
                              const first = r.emosiSesi[0].emosi;
                              const last = r.emosiSesi[r.emosiSesi.length - 1].emosi;
                              const improving = (EMOSI_Y[last] ?? 4) < (EMOSI_Y[first] ?? 4);
                              const stuck = ['frustrasi', 'bingung'].includes(last) && ['frustrasi', 'bingung'].includes(first);
                              const undetek = last === 'tidak_terdeteksi';
                              return (
                                <div style={{ marginTop: 10, padding: '7px 10px', borderRadius: 8, background: stuck ? C.redL : undetek ? '#F7FAFC' : improving ? C.greenL : C.amberL, fontSize: 11 }}>
                                  <span style={{ fontWeight: 700, color: stuck ? C.red : undetek ? C.slate : improving ? C.green : C.orange }}>
                                    {stuck ? `⚠ Terjebak ${EMOSI_META[last]?.label} dari ${r.emosiSesi[0].jam} s/d ${r.emosiSesi[r.emosiSesi.length - 1].jam}`
                                      : undetek ? `❓ Emosi akhir tidak terdeteksi — periksa kamera siswa`
                                        : improving ? `✅ Progres baik: ${EMOSI_META[first]?.label} → ${EMOSI_META[last]?.label}`
                                          : `ℹ ${EMOSI_META[first]?.label} → ${EMOSI_META[last]?.label}`}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Expandable: Log Pelanggaran */}
                        {isViolOpen && (
                          <div style={{ borderTop: '1px solid rgba(197,48,48,.15)', padding: '12px 14px', background: '#FFFAFA' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                              {sessionViolations.map((v, i) => {
                                const isTabSwitch = v.detail?.includes('Tab') || v.detail?.includes('Menyembunyikan');
                                const isResize = v.detail?.includes('Diperkecil') || v.detail?.includes('Split');
                                const isAppSwitch = v.detail?.includes('Aplikasi') || v.detail?.includes('Window');

                                const vColor = '#C53030';

                                const vIcon = isTabSwitch ? '🔀'
                                  : isResize ? '⬛'
                                    : isAppSwitch ? '🪟'
                                      : '⚠️';

                                const vBg = '#FFF5F5';
                                return (
                                  <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                                    <div style={{ width: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: vBg, border: `2px solid ${vColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.xs, marginTop: 4, flexShrink: 0 }}>
                                        {vIcon}
                                      </div>
                                      {i < sessionViolations.length - 1 && <div style={{ width: 2, flex: 1, background: `${vColor}33`, minHeight: 16 }} />}
                                    </div>
                                    <div style={{ paddingBottom: 12, paddingLeft: 10, flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: FS.sm, fontWeight: 700, color: vColor }}>{v.detail}</span>
                                        <span style={{ fontSize: FS.xs, background: vBg, color: vColor, padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>#{i + 1}</span>
                                      </div>
                                      <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 1 }}>🕐 {v.timestamp || 'Baru saja'}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid rgba(13,92,99,.08)`, flexShrink: 0 }}>
          {recommendations[student.id] && (
            <div style={{ background: C.amberL, borderRadius: 8, padding: '9px 12px', fontSize: FS.md, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, color: C.orange, marginBottom: 3 }}>📝 Rekomendasi Aktif</div>
              <div style={{ color: C.darkL, fontSize: 11 }}>{recommendations[student.id]}</div>
            </div>
          )}
          <Btn variant="amber" onClick={() => { setRecModal(student.id); setRecText(recommendations[student.id] || ''); }} style={{ width: '100%', justifyContent: 'center' }}>
            💬 {recommendations[student.id] ? 'Edit' : 'Beri'} Rekomendasi
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
const MonitoringSection = ({
  teacher, teacherMapel, cls, activeClass, setActiveClass,
  recommendations, recModal, setRecModal, recText, setRecText,
  recPipeline, setRecPipeline, sentToAI, setSentToAI,
  downloadModal, setDownloadModal,
  saveRec, barTooltip, setBarTooltip, selectedStudent, setSelectedStudent,
}) => {
  const { liveStudents } = useWebSocket({ kelasId: activeClass, guruId: teacher?.id || 'g1', enabled: true });
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const [smartInfoOpen, setSmartInfoOpen] = useState(false);

  const [violationMap, setViolationMap] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [dismissedViolations, setDismissedViolations] = useState(new Set());
  const [dismissedQuiz, setDismissedQuiz] = useState(new Set());

  useEffect(() => {
    const handleSrViolation = (e) => {
      const ev = e.detail;
      const siswaId = ev.siswa?.id;
      if (!siswaId) return;
      if (ev.type === 'student_violation') {
        setViolationMap(prev => ({
          ...prev,
          [siswaId]: [...(prev[siswaId] || []), { detail: ev.payload?.detail || 'Pelanggaran', timestamp: ev.payload?.timestamp || ev.timestamp }].slice(0, 30),
        }));
      }
    };
    window.addEventListener('sr_student_violation', handleSrViolation);
    return () => window.removeEventListener('sr_student_violation', handleSrViolation);
  }, []);

  const classStudents = useMemo(() => activeClass ? STUDENTS.filter(s => s.kelasId === activeClass) : STUDENTS, [activeClass]);

  const studentsWithLive = classStudents.map(s => {
    const live = liveStudents[s.id];
    const liveViolations = live?.violations || [];
    const eventViolations = violationMap[s.id] || [];
    const latestSessionViolations = s.riwayat?.[0]?.violations || [];
    const allViolations = [...latestSessionViolations, ...liveViolations, ...eventViolations].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    const seen = new Set();
    const violations = allViolations.filter(v => { const key = `${v.detail}__${v.timestamp}`; if (seen.has(key)) return false; seen.add(key); return true; });
    const baseStudent = live ? { ...s, todayActive: live.aktif ?? s.todayActive, todayLevel: live.level || s.todayLevel, emotionKey: live.emosi || s.emotionKey, todayMateriId: live.materiId || s.todayMateriId, todayQuizScore: live.lastQuiz ?? s.todayQuizScore, todayQuizTotal: live.lastQuizTotal ?? s.todayQuizTotal } : s;
    return { ...baseStudent, violations, hasViolation: violations.length > 0, lastViolation: violations[violations.length - 1] || null, violationCount: violations.length };
  });

  /* ── KPI ── */
  const aktifHariIni = studentsWithLive.filter(s => s.todayActive);
  const sudahQuiz = aktifHariIni.filter(s => s.todayQuizScore != null);
  const avgProgress = sudahQuiz.length > 0 ? Math.round(sudahQuiz.reduce((a, s) => a + (s.todayQuizScore / s.todayQuizTotal) * 100, 0) / sudahQuiz.length) : 0;

  /* ── Smart Info stats ── */
  const totalPelanggaran = studentsWithLive.filter(s => s.hasViolation).length;
  const totalAksesGame = studentsWithLive.filter(s => s.todayActive).length; // proxy: semua aktif berpotensi akses game
  const emosiCount = {};
  aktifHariIni.forEach(s => { const k = s.emotionKey || 'tidak_terdeteksi'; emosiCount[k] = (emosiCount[k] || 0) + 1; });
  const dominanEmosi = Object.entries(emosiCount).sort((a, b) => b[1] - a[1])[0];

  const smartAlerts = useMemo(() => generateSmartAlerts(studentsWithLive), [studentsWithLive]);
  const visibleAlerts = smartAlerts.filter(a => !dismissedAlerts.has(a.id));
  const visibleViolations = studentsWithLive.filter(s => s.hasViolation && !dismissedViolations.has(s.id));
  const visibleQuiz = studentsWithLive.filter(s => s.todayQuizScore != null && (s.todayQuizScore / s.todayQuizTotal) < 0.5 && !dismissedQuiz.has(s.id));

  const sortedStudents = [...studentsWithLive.filter(s => s.todayActive), ...studentsWithLive.filter(s => !s.todayActive)];

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>

      {/* ── Mobile Smart Info toggle button ── */}
      {isCompact && (
        <div style={{ padding: '6px 14px', background: C.white, borderBottom: `1px solid rgba(13,92,99,.07)`, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setSmartInfoOpen(o => !o)}
            style={{ background: smartInfoOpen ? C.teal : 'none', border: `1.5px solid ${C.tealXL}`, borderRadius: 8, padding: '5px 12px', fontSize: FS.sm, fontWeight: 700, color: smartInfoOpen ? '#fff' : C.darkL, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ℹ️ Smart Info {smartInfoOpen ? '▲' : '▼'}
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ══ CENTER ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', background: C.white, borderBottom: `3px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark }}>{cls?.label}</div>
              <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 1 }}>
                {teacherMapel?.icon} <strong style={{ color: teacherMapel?.color }}>{teacherMapel?.label}</strong>
                {' · '}{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div style={{ flex: 1 }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, background: C.bg }}>

            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {[
                { icon: '👥', label: 'Total Siswa', value: classStudents.length, sub: `Di ${cls?.label || 'kelas ini'}`, color: C.teal },
                { icon: '🟢', label: 'Aktif Hari Ini', value: aktifHariIni.length, sub: `${Math.round(aktifHariIni.length / (classStudents.length || 1) * 100)}% dari total`, color: C.green },
                { icon: '📊', label: 'Rata-rata Progress', value: `${avgProgress}%`, sub: aktifHariIni.length > 0 ? `${aktifHariIni.length} siswa aktif` : 'Belum ada aktivitas', color: C.purple },
                { icon: '🚨', label: 'Smart Alert', value: visibleAlerts.length, sub: visibleAlerts.length > 0 ? 'Perlu tindak lanjut' : 'Semua aman ✓', color: visibleAlerts.length > 0 ? C.red : C.green },
              ].map(s => (
                <Card key={s.label} style={{ padding: '14px' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: FS.xs, color: C.slate, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7 }}>{s.label}</div>
                  <div style={{ fontSize: s.value?.toString().length > 4 ? 20 : 26, fontWeight: 800, color: C.dark, margin: '3px 0' }}>{s.value}</div>
                  <div style={{ fontSize: FS.xs, color: s.color, fontWeight: 600, lineHeight: 1.3 }}>{s.sub}</div>
                </Card>
              ))}
            </div>

            {/* Tabel Aktivitas Siswa */}
            <Card style={{ overflow: 'visible' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>Aktivitas Siswa Hari Ini</div>
                  <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>Klik baris atau tombol Detail untuk melihat riwayat lengkap</div>
                </div>
                <div style={{ flex: 1 }} />
                <button onClick={() => setDownloadModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: `linear-gradient(135deg,${C.teal},${C.tealL})`, border: 'none', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', color: C.white, fontSize: FS.sm, fontWeight: 700 }}>
                  📥 Unduh Laporan
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.teal }}>
                      {[
                        { label: 'Nama Siswa', align: 'left' },
                        { label: 'Materi/Elemen', align: 'left' },
                        { label: 'Level', align: 'center' },
                        { label: 'Nilai Quiz', align: 'center' },
                        { label: 'Durasi', align: 'center' },
                        { label: 'Evaluasi', align: 'center' },
                        { label: 'Aksi', align: 'center' },
                      ].map(h => (
                        <th key={h.label} style={{ padding: '9px 12px', textAlign: h.align, fontSize: FS.xs, fontWeight: 700, color: C.white, textTransform: 'uppercase', letterSpacing: .7, whiteSpace: 'nowrap' }}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStudents.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState icon="👥" title="Belum ada siswa" sub="Tambahkan siswa melalui menu Manajemen Kelas" /></td></tr>
                    ) : sortedStudents.map(st => {
                      const isActive = st.todayActive;
                      const hasViolation = st.hasViolation && isActive;
                      const rowBg = hasViolation ? 'rgba(197,48,48,.04)' : (!isActive ? 'rgba(0,0,0,.012)' : 'transparent');
                      return (
                        <tr key={st.id}
                          style={{ borderTop: `1px solid rgba(13,92,99,.05)`, background: rowBg, transition: 'background .15s', ...(hasViolation ? { boxShadow: 'inset 3px 0 0 #C53030' } : {}) }}
                          onMouseEnter={e => e.currentTarget.style.background = hasViolation ? 'rgba(197,48,48,.07)' : 'rgba(13,92,99,.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = rowBg}>

                          {/* Nama */}
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ position: 'relative' }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: isActive ? st.avatarBg : '#CBD5E0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10 }}>{st.avatar}</div>
                                {isActive && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.green, border: '1px solid white' }} />}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: FS.md, color: hasViolation ? '#C53030' : isActive ? C.dark : C.slate }}>{st.name}</div>
                            </div>
                          </td>

                          {/* Materi */}
                          <td style={{ padding: '10px 12px' }}>
                            {isActive && st.todayMateriId
                              ? <span style={{ fontSize: FS.md, color: C.dark, fontWeight: 600 }}>{st.todayMateriId}</span>
                              : <span style={{ fontSize: FS.base, color: C.slate }}>—</span>}
                          </td>

                          {/* level*/}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isActive && st.todayLevel ? (() => {
                              const LEVEL_COLOR = {
                                low: { label: 'Low', color: '#276749', bg: '#F0FFF4' },
                                mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0' },
                                high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5' },
                              };
                              const lv = LEVEL_COLOR[st.todayLevel] || LEVEL_COLOR.low;
                              return (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                                  borderRadius: 99, background: lv.bg, color: lv.color,
                                  border: `1px solid ${lv.color}40`,
                                }}>{lv.label}</span>
                              );
                            })() : <span style={{ color: C.slate }}>—</span>}
                          </td>

                          {/* Nilai Quiz */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isActive && st.todayQuizScore != null
                              ? <span style={{ fontSize: FS.md, fontWeight: 600, color: C.dark }}>{Math.round((st.todayQuizScore / st.todayQuizTotal) * 100)}</span>
                              : <span style={{ fontSize: FS.base, color: C.slate }}>—</span>}
                          </td>

                          {/* Durasi */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {isActive && st.todayStudyHours != null
                              ? <span style={{ fontSize: FS.md, color: C.darkL, fontWeight: 600 }}>{st.todayStudyHours.toFixed(1)} jam</span>
                              : <span style={{ fontSize: FS.base, color: C.slate }}>—</span>}
                          </td>

                          {/* Evaluasi */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {(() => {
                              const evaluasi = generateAIEvaluasi(st);
                              if (!evaluasi) return <span style={{ fontSize: FS.base, color: C.slate }}>—</span>;
                              return <EvaluasiDropdown text={evaluasi} color={C.teal} bg={C.white} />;
                            })()}
                          </td>

                          {/* Aksi */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button onClick={() => setSelectedStudent(st)}
                              style={{ background: isActive ? C.tealXL : '#EDF2F7', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: FS.sm, color: isActive ? C.teal : C.slate, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>

        {/* ══ RIGHT PANEL — Smart Info + Alert ══ */}
        {(!isCompact || smartInfoOpen) && (
          <div style={{
            width: isCompact ? '100%' : 272,
            background: C.white,
            borderLeft: isCompact ? 'none' : `1px solid rgba(13,92,99,.1)`,
            borderTop: isCompact ? `1px solid rgba(13,92,99,.1)` : 'none',
            overflowY: 'auto',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            ...(isCompact ? { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50, maxHeight: '65%', boxShadow: '0 -4px 24px rgba(0,0,0,.12)' } : {}),
          }}>
            <div style={{ padding: '13px 13px 10px', borderBottom: `1px solid rgba(13,92,99,.07)`, flexShrink: 0 }}>
              <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>ℹ️ Smart Info</div>
              <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 2 }}>Ringkasan aktivitas kelas hari ini</div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 7 }}>

              {/* ── Kategori Pelanggaran (merah) ── */}
              {(() => {
                const siswaLanggaran = studentsWithLive.filter(s => s.hasViolation && s.todayActive && !dismissedViolations.has(s.id));
                return (
                  <div>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: '#C53030', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>
                      🚫 Pelanggaran
                    </div>
                    {siswaLanggaran.length === 0 ? (
                      <div style={{ background: '#F0FFF4', borderRadius: 9, padding: '9px 11px', border: '1px solid #9AE6B4', fontSize: FS.sm, color: C.green, fontWeight: 600 }}>
                        ✅ Tidak ada pelanggaran
                      </div>
                    ) : siswaLanggaran.map(st => (
                      <div key={st.id}
                        onClick={() => { setSelectedStudent(st); setDismissedViolations(prev => new Set([...prev, st.id])); }}
                        style={{ background: '#FFF5F5', borderRadius: 9, padding: '9px 11px', border: '1px solid #FEB2B2', marginBottom: 5, cursor: 'pointer', boxShadow: 'inset 3px 0 0 #C53030', transition: 'filter .15s' }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.97)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#C53030', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: FS.xs, flexShrink: 0 }}>
                            {st.avatar}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: FS.sm, fontWeight: 700, color: '#C53030', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</div>
                            <div style={{ fontSize: FS.xs, color: '#718096' }}>{st.violationCount}x pelanggaran · klik detail</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(13,92,99,.06)', margin: '3px 0' }} />

              {/* ── Kategori Emosi Negatif (oranye) — frustrasi/bingung >10 menit ── */}
              {(() => {
                const siswaEmosiNegatif = visibleAlerts.filter(a => a.id.startsWith('emosi-'));
                return (
                  <div>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: '#C05621', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>
                      😣 Emosi Negatif &gt;15 menit
                    </div>
                    {siswaEmosiNegatif.length === 0 ? (
                      <div style={{ background: '#FFFBF0', borderRadius: 9, padding: '9px 11px', border: '1px solid #F6AD55', fontSize: FS.sm, color: '#744210', fontWeight: 600 }}>
                        Tidak ada emosi negatif berkepanjangan
                      </div>
                    ) : siswaEmosiNegatif.map(alert => (
                      <div key={alert.id}
                        onClick={() => { setSelectedStudent(alert.student); setDismissedAlerts(prev => new Set([...prev, alert.id])); }}
                        style={{ background: '#FFFBF0', borderRadius: 9, padding: '9px 11px', border: '1px solid #F6AD55', marginBottom: 5, cursor: 'pointer', boxShadow: 'inset 3px 0 0 #C05621', transition: 'filter .15s' }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.97)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: FS.xl, flexShrink: 0 }}>{alert.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: FS.sm, fontWeight: 700, color: '#C05621', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.student?.name}</div>
                            <div style={{ fontSize: FS.xs, color: '#718096', lineHeight: 1.4 }}>{alert.text.replace(`${alert.student?.name} `, '')}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(13,92,99,.06)', margin: '3px 0' }} />

              {/* ── Kategori Quiz <50% (merah muda) ── */}
              {(() => {
                const siswaQuizRendah = studentsWithLive.filter(s =>
                  s.todayActive && s.todayQuizScore != null && s.todayQuizTotal != null &&
                  (s.todayQuizScore / s.todayQuizTotal) < 0.5 && !dismissedQuiz.has(s.id)
                );
                return (
                  <div>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: '#9B2C2C', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>
                      📝 Nilai Quiz &lt; 50%
                    </div>
                    {siswaQuizRendah.length === 0 ? (
                      <div style={{ background: '#FFF5F5', borderRadius: 9, padding: '9px 11px', border: '1px solid #FEB2B2', fontSize: FS.sm, color: '#9B2C2C', fontWeight: 600 }}>
                        Tidak ada nilai kritis
                      </div>
                    ) : siswaQuizRendah.map(st => {
                      const pct = Math.round((st.todayQuizScore / st.todayQuizTotal) * 100);
                      return (
                        <div key={st.id}
                          onClick={() => { setSelectedStudent(st); setDismissedQuiz(prev => new Set([...prev, st.id])); }}
                          style={{ background: '#FFF5F5', borderRadius: 9, padding: '9px 11px', border: '1px solid #FEB2B2', marginBottom: 5, cursor: 'pointer', transition: 'filter .15s' }}
                          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.97)'}
                          onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: st.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: FS.xs, flexShrink: 0 }}>
                              {st.avatar}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: FS.sm, fontWeight: 700, color: '#9B2C2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</div>
                              <div style={{ fontSize: FS.xs, color: '#718096' }}>Quiz: {pct}/100 · klik detail</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )} {/* end smart info conditional */}

      </div> {/* end inner flex row */}

      {/* Student Drawer */}
      {
        selectedStudent && (
          <StudentDrawer student={selectedStudent} recommendations={recommendations} setRecModal={setRecModal} setRecText={setRecText} onClose={() => setSelectedStudent(null)} />
        )
      }

      {/* Modal Rekomendasi — tanpa upload file */}
      {
        recModal && (() => {
          const s = STUDENTS.find(x => x.id === recModal);
          if (!s) return null;
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(3px)' }}
              onClick={() => setRecModal(null)}>
              <div className="bounce-in" onClick={e => e.stopPropagation()}
                style={{ background: C.white, borderRadius: 16, padding: 28, width: 'min(460px, calc(100vw - 24px))', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
                <div style={{ fontSize: FS.h1, marginBottom: 4 }}>💬</div>
                <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Beri Rekomendasi</div>
                <div style={{ fontSize: FS.base, color: C.darkL, marginBottom: 4 }}>untuk <strong>{s.name}</strong> — {teacherMapel?.icon} {teacherMapel?.label}</div>
                <div style={{ fontSize: FS.sm, color: C.slate, marginBottom: 14, background: C.tealXL, borderRadius: 8, padding: '8px 12px' }}>
                  ℹ️ Rekomendasi ini akan muncul sebagai notifikasi di dashboard siswa.
                </div>
                <textarea value={recText} onChange={e => setRecText(e.target.value)}
                  placeholder="Tulis rekomendasi untuk siswa ini... Contoh: 'Coba ulangi materi Pancasila dari elemen pertama, dan kerjakan latihan soal pada level Low terlebih dahulu.'"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.tealXL}`, borderRadius: 9, fontSize: FS.base, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.teal}
                  onBlur={e => e.target.style.borderColor = C.tealXL} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="ghost" onClick={() => { setRecModal(null); setRecText(''); }} style={{ flex: 1, justifyContent: 'center' }}>Batal</Btn>
                  <Btn variant="amber" onClick={() => saveRec(s.id)} disabled={!recText.trim()} style={{ flex: 2, justifyContent: 'center' }}>
                    📲 Kirim ke Siswa
                  </Btn>
                </div>
                {recommendations[s.id] && (
                  <div style={{ marginTop: 10, background: C.greenL, borderRadius: 8, padding: '8px 12px', fontSize: FS.md, color: C.green }}>
                    ✅ Tersimpan: "{recommendations[s.id]}"
                  </div>
                )}
              </div>
            </div>
          );
        })()
      }

      {/* Modal Download */}
      {
        downloadModal && (
          <DownloadModal cls={cls} teacherMapel={teacherMapel} studentsWithLive={studentsWithLive} onClose={() => setDownloadModal(false)} />
        )
      }
    </div >
  );
};

export default MonitoringSection;
