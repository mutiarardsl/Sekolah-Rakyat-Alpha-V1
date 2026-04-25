/**
 * SR MVP — PretestPage (REVISI PRETEST PER ELEMEN)
 *
 * Perubahan dari revisi ini:
 *  1. Pretest sekarang per ELEMEN/MATERI (bukan per mapel)
 *     - Terima targetMapelId + targetElemenId + targetElemenLabel dari location.state
 *     - Soal difilter dari PRETEST_QUESTIONS[mapelId] yang materiId-nya cocok dengan elemen
 *     - Fallback: 3 soal self-assessment tentang elemen tersebut
 *  2. Tombol hasil bukan "Kembali" tapi "Mulai Belajar →"
 *     - navigate ke /siswa dengan state { pretestElemenDone: true, materiData: {...} }
 *     - StudentView akan membaca state ini dan langsung buka ATPCamModal
 *  3. Level ditentukan dari skor pretest elemen:
 *     - ≥ 80% benar → high
 *     - 40–79% benar → mid
 *     - < 40% benar → low
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { C, FONTS, FS } from '../styles/tokens';
import { Btn, Card, ProgressBar } from '../components/shared/UI';
import {
  ADMIN_MAPEL_LIST,
  KURIKULUM,
  KURIKULUM_ELEMEN,
} from '../data/masterData';
import { useStudentStore } from '../stores/studentStore';

const MAPEL_LIST = ADMIN_MAPEL_LIST.filter(m => KURIKULUM[m.id]);
const SOAL_PER_ELEMEN = 5;

// ── Hitung level dari skor ───────────────────────────────────────────────────
const hitungLevel = (benar, total) => {
  if (total === 0) return 'low';
  const pct = benar / total;
  if (pct >= 0.8) return 'high';
  if (pct >= 0.4) return 'mid';
  return 'low';
};

// ── Ambil soal untuk 1 elemen dari PRETEST_QUESTIONS ────────────────────────
// Cocokkan berdasarkan materiId atau ambil soal pertama dari mapel (max SOAL_PER_ELEMEN)
const buildSoalUntukElemen = (mapelId, elemenId, elemenLabel) => {
  const meta = MAPEL_LIST.find(m => m.id === mapelId);
  const soalMapel = [];

  // Coba cocokkan soal yang materiId-nya mirip dengan elemenLabel
  const soalMatching = soalMapel.filter(q =>
    q.materiId?.toLowerCase().includes(elemenLabel?.toLowerCase()?.split(' ')[0] || '') ||
    elemenLabel?.toLowerCase().includes(q.materiId?.toLowerCase() || '')
  );

  // Jika ada soal yang cocok, gunakan itu (max SOAL_PER_ELEMEN)
  if (soalMatching.length > 0) {
    return soalMatching.slice(0, SOAL_PER_ELEMEN).map(q => ({
      ...q,
      mapelId,
      elemenId,
      isSelfAssessment: false,
    }));
  }

  // Fallback: ambil soal mapel apa saja (max SOAL_PER_ELEMEN)
  if (soalMapel.length > 0) {
    return soalMapel.slice(0, SOAL_PER_ELEMEN).map(q => ({
      ...q,
      mapelId,
      elemenId,
      isSelfAssessment: false,
    }));
  }

  // Fallback terakhir: self-assessment tentang elemen ini
  return Array.from({ length: Math.min(SOAL_PER_ELEMEN, 3) }, (_, i) => ({
    mapelId,
    elemenId,
    materiId: elemenLabel,
    soal: i === 0
      ? `Seberapa familiar kamu dengan topik "${elemenLabel}" pada ${meta?.label || mapelId}?`
      : i === 1
        ? `Apakah kamu pernah mempelajari konsep-konsep dalam "${elemenLabel}"?`
        : `Seberapa percaya diri kamu mengerjakan soal tentang "${elemenLabel}"?`,
    pilihan: [
      'Belum pernah belajar sama sekali',
      'Pernah dengar tapi belum paham',
      'Sudah paham sebagian',
      'Sudah paham dengan baik',
    ],
    jawaban: 2,
    isSelfAssessment: true,
  }));
};

export default function PretestPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // State yang dikirim dari ProgressSection / DashboardSection / StudentView
  const {
    targetMapelId,
    targetElemenId,
    targetElemenLabel,
    targetMateriId,       // diisi jika pretest per materi (elemen dengan breakdown materi)
    isMateriLevel = false, // true → pretest untuk materi spesifik, bukan seluruh elemen
    materiData,
    returnTo = 'dashboard',
  } = location.state || {};

  const { markPretestElemenDone, markPretestMateriDone } = useStudentStore();

  const mapelMeta = MAPEL_LIST.find(m => m.id === targetMapelId) || { label: targetMapelId, icon: '📚', color: C.teal };

  // Build soal list:
  // - isMateriLevel: filter soal spesifik untuk targetMateriId
  // - !isMateriLevel: soal untuk seluruh elemen (elemen tanpa breakdown materi)
  const soalTarget = isMateriLevel ? (targetMateriId || targetElemenLabel) : (targetElemenLabel || targetElemenId);
  const initSoalList = (targetMapelId && targetElemenId)
    ? buildSoalUntukElemen(targetMapelId, targetElemenId, soalTarget)
    : [];

  const [stage, setStage] = useState(initSoalList.length > 0 ? 'soal' : 'invalid');
  const [soalList] = useState(initSoalList);
  const [soalIdx, setSoalIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [chosen, setChosen] = useState(null);

  const soalKey = (s, idx) => `${s.mapelId}__${s.elemenId}__${idx}`;

  const choosePilihan = (piIdx) => {
    const key = soalKey(soalList[soalIdx], soalIdx);
    setChosen(piIdx);
    setAnswers(prev => ({ ...prev, [key]: piIdx }));
    setTimeout(() => setChosen(null), 200);
  };

  const goNext = () => {
    if (soalIdx < soalList.length - 1) setSoalIdx(soalIdx + 1);
    else setStage('result');
  };

  // Hitung hasil pretest
  const computeResult = () => {
    let benar = 0;
    soalList.forEach((s, idx) => {
      const key = soalKey(s, idx);
      const userAns = answers[key];
      const isBenar = s.isSelfAssessment
        ? (userAns !== undefined && userAns >= 2)
        : userAns === s.jawaban;
      if (isBenar) benar++;
    });
    return { benar, total: soalList.length };
  };

  const handleMulaiBelajar = () => {
    const { benar, total } = computeResult();
    const level = hitungLevel(benar, total);

    if (isMateriLevel && targetMateriId) {
      // Pretest untuk materi spesifik
      markPretestMateriDone(targetMapelId, targetElemenId, targetMateriId, level);
    } else {
      // Pretest untuk elemen (elemen tanpa breakdown materi)
      markPretestElemenDone(targetMapelId, targetElemenId, level);
    }

    // Kembali ke StudentView — kirim signal untuk langsung buka ATPCamModal
    navigate('/siswa', {
      replace: true,
      state: {
        pretestElemenDone: true,
        level,
        // Selalu inject level baru ke materiData — level dari pretest mengoverride apapun yang ada
        materiData: {
          ...(materiData || {
            mapelId: targetMapelId,
            mapelLabel: mapelMeta.label,
            mapelIcon: mapelMeta.icon,
            mapelColor: mapelMeta.color,
            materiId: isMateriLevel ? targetMateriId : (targetElemenLabel || targetElemenId),
            elemenId: targetElemenId,
            elemenLabel: targetElemenLabel,
          }),
          level, // override dengan level hasil pretest yang baru dihitung
        },
        returnTo,
      },
    });
  };

  // ── Guard: state tidak lengkap ────────────────────────────────────
  if (stage === 'invalid' || !targetMapelId || !targetElemenId) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Data pretest tidak lengkap</div>
          <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 20 }}>Kembali ke halaman sebelumnya dan coba lagi.</div>
          <Btn variant="teal" onClick={() => navigate('/siswa', { replace: true })}>← Kembali</Btn>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
   * TAHAP SOAL
   * ════════════════════════════════════════════════════════════════════ */
  if (stage === 'soal') {
    const s = soalList[soalIdx];
    const key = soalKey(s, soalIdx);
    const done = Object.keys(answers).length;
    const total = soalList.length;
    const hasFallback = s.isSelfAssessment;

    return (
      <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: `linear-gradient(160deg,${mapelMeta.color}12,${C.bg} 40%)` }}>
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '32px 24px 64px' }}>
          <div style={{ width: '100%', maxWidth: 540 }}>

            {/* Banner konteks elemen */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: `${mapelMeta.color}12`,
              border: `1.5px solid ${mapelMeta.color}30`,
              borderRadius: 12, padding: '10px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 22 }}>{mapelMeta.icon}</span>
              <div>
                <div style={{ fontSize: FS.md, fontWeight: 700, color: mapelMeta.color }}>
                  Pretest — {targetElemenLabel || targetElemenId}
                </div>
                <div style={{ fontSize: FS.sm, color: C.slate, lineHeight: 1.5 }}>
                  {mapelMeta.label} · {hasFallback
                    ? 'Jawab sesuai kemampuanmu — tidak ada jawaban benar atau salah.'
                    : 'Hasilnya menentukan level belajar elemen ini.'}
                </div>
              </div>
            </div>

            {/* Self-assessment notice */}
            {hasFallback && (
              <div style={{
                background: '#FFFBF0', border: '1.5px solid #F6AD55', borderRadius: 10,
                padding: '8px 14px', marginBottom: 14,
                fontSize: FS.sm, color: '#B7791F', display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span>📋</span>
                <span>Pilih jawaban yang paling sesuai kemampuanmu.</span>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <ProgressBar value={((soalIdx) / total) * 100} height={7} color={mapelMeta.color} />
              <span style={{ fontSize: FS.md, fontWeight: 700, color: mapelMeta.color, whiteSpace: 'nowrap' }}>{soalIdx + 1}/{total}</span>
            </div>

            {/* Kartu soal */}
            <Card style={{ padding: 28 }} key={soalIdx}>
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${mapelMeta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {mapelMeta.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: mapelMeta.color, textTransform: 'uppercase', letterSpacing: 1.2 }}>{mapelMeta.label}</div>
                    <div style={{ fontSize: FS.sm, color: C.slate }}>Topik: <strong style={{ color: C.dark }}>{s.materiId}</strong></div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: FS.sm, color: C.slate }}>Soal {soalIdx + 1}/{total}</div>
                </div>

                <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark, lineHeight: 1.6, marginBottom: 20 }}>
                  {s.soal}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.pilihan.map((p, pi) => {
                    const isChosen = chosen === pi || answers[key] === pi;
                    return (
                      <button key={pi} onClick={() => choosePilihan(pi)} style={{
                        textAlign: 'left', padding: '11px 16px', borderRadius: 10,
                        border: `2px solid ${isChosen ? mapelMeta.color : C.tealXL}`,
                        background: isChosen ? `${mapelMeta.color}12` : C.white,
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: FS.base,
                        color: isChosen ? mapelMeta.color : C.dark,
                        fontWeight: isChosen ? 700 : 400,
                        transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 10,
                      }}
                        onMouseEnter={e => { if (!isChosen) { e.currentTarget.style.borderColor = mapelMeta.color; e.currentTarget.style.background = `${mapelMeta.color}06`; } }}
                        onMouseLeave={e => { if (!isChosen) { e.currentTarget.style.borderColor = C.tealXL; e.currentTarget.style.background = C.white; } }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: FS.sm, fontWeight: 800,
                          background: isChosen ? mapelMeta.color : C.cream,
                          color: isChosen ? C.white : C.slate, transition: 'all .2s',
                        }}>{String.fromCharCode(65 + pi)}</span>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Navigasi */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
              {soalIdx > 0 ? (
                <button onClick={() => setSoalIdx(soalIdx - 1)}
                  style={{ background: 'none', border: `1.5px solid ${C.tealXL}`, borderRadius: 8, padding: '8px 16px', fontSize: FS.base, color: C.slate, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ← Sebelumnya
                </button>
              ) : <div />}
              <button
                onClick={goNext}
                disabled={answers[key] === undefined}
                style={{
                  background: answers[key] !== undefined ? mapelMeta.color : C.tealXL,
                  border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: FS.base,
                  color: answers[key] !== undefined ? '#fff' : C.slate,
                  cursor: answers[key] !== undefined ? 'pointer' : 'not-allowed',
                  fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .2s', opacity: answers[key] !== undefined ? 1 : 0.5,
                }}>
                {soalIdx < soalList.length - 1 ? 'Selanjutnya →' : 'Lihat Hasil ✓'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
   * TAHAP HASIL
   * ════════════════════════════════════════════════════════════════════ */
  const { benar, total } = computeResult();
  const level = hitungLevel(benar, total);
  const pctCorrect = total > 0 ? Math.round((benar / total) * 100) : 0;
  const hasFallbackResult = soalList[0]?.isSelfAssessment;

  const LEVEL_META = {
    low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4', emoji: '💪', desc: 'Kita mulai dari dasar — perlahan tapi pasti!' },
    mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55', emoji: '📊', desc: 'Kamu sudah punya fondasi yang cukup baik!' },
    high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2', emoji: '🌟', desc: 'Luar biasa! Kamu sudah menguasai topik ini!' },
  };
  const lvlMeta = LEVEL_META[level];

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: `linear-gradient(160deg,${mapelMeta.color}18,${C.bg} 40%)` }}>
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px 80px' }}>
        <div className="bounce-in" style={{ maxWidth: 480, width: '100%' }}>

          {/* Header hasil */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>{lvlMeta.emoji}</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: 24, fontWeight: 600, color: C.dark }}>
              {hasFallbackResult ? 'Penilaian Selesai!' : 'Hasil Pretestmu!'}
            </div>
            {!hasFallbackResult && (
              <div style={{ fontSize: FS.base, color: C.darkL, marginTop: 6, lineHeight: 1.6 }}>
                {benar} dari {total} soal dijawab benar
                <span style={{ marginLeft: 8, fontSize: 15, fontWeight: 800, color: level === 'high' ? C.green : level === 'mid' ? C.amber : C.red }}>
                  ({pctCorrect}%)
                </span>
              </div>
            )}
          </div>

          {/* Level result card */}
          <Card style={{ padding: 24, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Level Belajarmu
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '10px 28px', borderRadius: 99,
              background: lvlMeta.bg, border: `2px solid ${lvlMeta.border}`,
              marginBottom: 14,
            }}>
              <span style={{ fontSize: 22 }}>{lvlMeta.emoji}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: lvlMeta.color }}>{lvlMeta.label}</span>
            </div>
            <div style={{ fontSize: FS.md, color: C.darkL, lineHeight: 1.6 }}>{lvlMeta.desc}</div>

            {/* Elemen info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
              padding: '10px 14px', borderRadius: 10,
              background: `${mapelMeta.color}08`, border: `1.5px solid ${mapelMeta.color}20`,
            }}>
              <span style={{ fontSize: 20 }}>{mapelMeta.icon}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: FS.xs, fontWeight: 700, color: mapelMeta.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{mapelMeta.label}</div>
                <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>
                  {isMateriLevel ? (targetMateriId || targetElemenLabel) : (targetElemenLabel || targetElemenId)}
                </div>
                {isMateriLevel && (
                  <div style={{ fontSize: FS.xs, color: C.slate }}>Elemen: {targetElemenLabel}</div>
                )}
              </div>
              <span style={{
                fontSize: FS.xs, padding: '3px 10px', borderRadius: 99, fontWeight: 700,
                background: lvlMeta.bg, color: lvlMeta.color, border: `1px solid ${lvlMeta.border}`,
                whiteSpace: 'nowrap',
              }}>
                Level {lvlMeta.label} ✓
              </span>
            </div>
          </Card>

          {/* CTA: Mulai Belajar → ATPCamModal */}
          <Btn variant="amber" onClick={handleMulaiBelajar}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 36px', fontSize: 14 }}>
            🚀 Mulai Belajar →
          </Btn>

          <div style={{ textAlign: 'center', marginTop: 10, fontSize: FS.sm, color: C.slate }}>
            Selanjutnya kamu akan diminta izin akses kamera untuk sesi belajar
          </div>
        </div>
      </div>
    </div>
  );
}
