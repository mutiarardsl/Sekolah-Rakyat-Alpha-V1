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
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { C, FONTS, FS } from '../styles/tokens';
import { Btn, Card, ProgressBar } from '../components/shared/UI';
import {
  ADMIN_MAPEL_LIST,
  KURIKULUM,
  KURIKULUM_ELEMEN,
} from '../data/masterData';
import { useStudentStore } from '../stores/studentStore';
import { useAuth } from '../context/AuthContext'; // FIX B3: ambil user.id untuk siswa_id yang benar
// Sesuai flow .md: soal pretest dari Tim 3 RAG (5 soal), level dikembalikan Tim 3 setelah submit.
// Pretest BERBEDA dari quiz MC & essay di chatbot.
import { getPretestSoal, submitPretestJawaban } from '../api/content';
import { InlineLatex } from '../components/shared/LatexRenderer';

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
  const { user } = useAuth(); // FIX B3: ambil user.id agar siswa_id payload benar

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

  // Sesuai flow .md: soal pretest diambil dari Tim 3 RAG (5 soal).
  // Tim 3 RAG juga yang mengembalikan level setelah jawaban disubmit.
  // Pretest BERBEDA dari quiz MC & essay di chatbot.
  const [stage, setStage] = useState('loading'); // loading | soal | submitting | result | invalid
  const [soalList, setSoalList] = useState([]);
  const [sesiPretestId, setSesiPretestId] = useState(null);
  const [pretestLevelResult, setPretestLevelResult] = useState(null); // level dari Tim 3 RAG
  const [soalIdx, setSoalIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [chosen, setChosen] = useState(null);

  // Fetch 5 soal pretest dari Tim 3 RAG saat mount
  // Sesuai flow .md: "sistem memanggil API Tim 3 RAG untuk mengambil soal pretest (5 soal)"
  useEffect(() => {
    if (!targetMapelId || !targetElemenId) { setStage('invalid'); return; }
    (async () => {
      try {
        const res = await getPretestSoal({
          siswa_id: user?.id || null,
          mapel_id: targetMapelId,
          elemen_id: targetElemenId,
          materi_id: isMateriLevel ? targetMateriId : null,
          is_materi_level: isMateriLevel,
        });
        const soal = res?.soal || [];
        if (soal.length === 0) throw new Error('empty');
        // Normalisasi: Tim 3 RAG mungkin kirim 'pertanyaan' atau 'soal' — unifikasi ke 'soal'
        setSoalList(soal.map(s => ({
          ...s,
          soal: s.soal || s.pertanyaan || '',  // field teks soal
          mapelId: targetMapelId,
          elemenId: targetElemenId,
        })));
        setSesiPretestId(res?.sesi_pretest_id || null);
        setStage('soal');
      } catch {
        // Fallback ke soal lokal jika Tim 3 RAG belum live
        const localSoal = buildSoalUntukElemen(
          targetMapelId,
          targetElemenId,
          isMateriLevel ? (targetMateriId || targetElemenLabel) : (targetElemenLabel || targetElemenId)
        );
        if (localSoal.length === 0) { setStage('invalid'); return; }
        setSoalList(localSoal);
        setStage('soal');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const soalKey = (s, idx) => `${s.mapelId}__${s.elemenId}__${idx}`;

  const choosePilihan = (piIdx) => {
    const key = soalKey(soalList[soalIdx], soalIdx);
    setChosen(piIdx);
    setAnswers(prev => ({ ...prev, [key]: piIdx }));
    setTimeout(() => setChosen(null), 200);
  };

  const goNext = () => {
    if (soalIdx < soalList.length - 1) setSoalIdx(soalIdx + 1);
    // Soal terakhir selesai → langsung submit ke RAG (tidak ada halaman "Hasil" dulu)
    else handleMulaiBelajar();
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

  const handleMulaiBelajar = async () => {
    setStage('submitting');

    // Sesuai flow .md: submit jawaban ke Tim 3 RAG, Tim 3 yang mengembalikan level hasil pretest.
    let level;
    try {
      const pretestRes = await submitPretestJawaban({
        siswa_id: user?.id || null,
        mapel_id: targetMapelId,
        elemen_id: targetElemenId,
        materi_id: isMateriLevel ? targetMateriId : null,
        sesi_pretest_id: sesiPretestId,
        answers: Object.fromEntries(
          soalList.map((s, idx) => [soalKey(s, idx), String(answers[soalKey(s, idx)] ?? '')])
        ),
        // quiz_type TIDAK dikirim — Tim 3 contract tidak mendefinisikannya di /pretest/submit
      });
      // Tim 3 RAG mengembalikan level → gunakan level dari Tim 3
      level = pretestRes?.level || 'low';
      setPretestLevelResult(pretestRes);
    } catch {
      // Fallback: hitung level lokal jika Tim 3 belum live
      const { benar, total } = computeResult();
      level = hitungLevel(benar, total);
    }

    // Simpan hasil pretest ke store lokal.
    // Catatan: BE menyimpan hasil ini secara permanen di sisi server melalui
    // POST /content/pretest/submit (sudah dipanggil di atas). Status pretest
    // akan dihidrasi kembali ke store dari BE via GET /content/pretest/status
    // yang dipanggil ProgressSection saat mount — sehingga status tidak hilang
    // saat siswa refresh halaman atau login ulang.
    if (isMateriLevel && targetMateriId) {
      markPretestMateriDone(targetMapelId, targetElemenId, targetMateriId, level);
    } else {
      markPretestElemenDone(targetMapelId, targetElemenId, level);
    }

    // Navigasi ke StudentView
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
  // Loading state — fetch soal dari Tim 3 RAG
  if (stage === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Menyiapkan soal pretest...</div>
          <div style={{ fontSize: FS.md, color: C.slate }}>sedang menyiapkan 5 soal untukmu.</div>
        </div>
      </div>
    );
  }

  // Submitting — menunggu level dari Tim 3 RAG
  if (stage === 'submitting') {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Menganalisis jawabanmu...</div>
          <div style={{ fontSize: FS.md, color: C.slate }}>sedang menentukan level belajar terbaikmu.</div>
        </div>
      </div>
    );
  }

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
              background: `${C.teal}12`,
              border: `1.5px solid ${C.teal}30`,
              borderRadius: 12, padding: '10px 14px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 22 }}>{mapelMeta.icon}</span>
              <div>
                <div style={{ fontSize: FS.md, fontWeight: 700, color: C.teal }}>
                  Pretest — {targetElemenLabel || targetElemenId}
                </div>
                <div style={{ fontSize: FS.sm, color: C.slate, lineHeight: 1.5 }}>
                  {mapelMeta.label} · {hasFallback
                    ? 'Jawab sesuai kemampuanmu — tidak ada jawaban benar atau salah.'
                    : 'Hasilnya menentukan level belajar elemen ini.'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <ProgressBar value={((soalIdx) / total) * 100} height={7} color={C.teal} />
              <span style={{ fontSize: FS.md, fontWeight: 700, color: C.teal, whiteSpace: 'nowrap' }}>{soalIdx + 1}/{total}</span>
            </div>

            {/* Kartu soal */}
            <Card style={{ padding: 28 }} key={soalIdx}>
              <div className="fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${C.teal}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {mapelMeta.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: 1.2 }}>{mapelMeta.label}</div>
                    <div style={{ fontSize: FS.sm, color: C.slate }}>Topik: <strong style={{ color: C.dark }}>{s.materiId}</strong></div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: FS.sm, color: C.slate }}>Soal {soalIdx + 1}/{total}</div>
                </div>

                <div style={{
                  fontFamily: FONTS.serif,
                  fontSize: FS.base,
                  fontWeight: 600,
                  color: C.dark,
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}>
                  <InlineLatex text={s.soal} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.pilihan.map((p, pi) => {
                    const isChosen = chosen === pi || answers[key] === pi;
                    return (
                      <button key={pi} onClick={() => choosePilihan(pi)} style={{
                        textAlign: 'left', padding: '11px 16px', borderRadius: 10,
                        border: `2px solid ${isChosen ? C.teal : C.tealXL}`,
                        background: isChosen ? `${C.teal}12` : C.white,
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: FS.base,
                        color: isChosen ? C.teal : C.dark,
                        fontWeight: isChosen ? 700 : 400,
                        transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 10,
                      }}
                        onMouseEnter={e => { if (!isChosen) { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.background = `${C.teal}06`; } }}
                        onMouseLeave={e => { if (!isChosen) { e.currentTarget.style.borderColor = C.tealXL; e.currentTarget.style.background = C.white; } }}>
                        <span style={{
                          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: FS.sm, fontWeight: 800,
                          background: isChosen ? C.teal : C.cream,
                          color: isChosen ? C.white : C.slate, transition: 'all .2s',
                        }}>{String.fromCharCode(65 + pi)}</span>
                        <span style={{ lineHeight: 1.5 }}><InlineLatex text={p} /></span>
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
                  background: answers[key] !== undefined ? `linear-gradient(135deg,${C.teal},${C.tealL})` : C.tealXL,
                  border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: FS.base,
                  color: answers[key] !== undefined ? '#fff' : C.slate,
                  cursor: answers[key] !== undefined ? 'pointer' : 'not-allowed',
                  fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .2s', opacity: answers[key] !== undefined ? 1 : 0.5,
                }}>
                {soalIdx < soalList.length - 1 ? 'Selanjutnya →' : 'Selesai & Mulai Belajar →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Stage 'result' tidak lagi digunakan — goNext() langsung panggil handleMulaiBelajar()
  // yang set stage='submitting' → submit ke RAG → navigate ke chatbot
  return null;
}