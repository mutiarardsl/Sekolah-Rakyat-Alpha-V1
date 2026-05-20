/**
 * SR MVP — ProgressSection — REVISI FASE 3
 *
 * Perubahan:
 *  - Kolom kanan: list Elemen (dari KURIKULUM_ELEMEN), expand per elemen ke list Materi
 *  - Pretest gate: jika mapel belum pretest → popup "Belum Pretest" + arah ke pretest
 *  - Popup izin kamera: tampilkan info ATP elemen/materi dari konten guru
 *  - Progress & aktivitas: fallback jika belum ada data
 *  - Level badge per elemen (Low/Mid/High)
 */
import { useState, useEffect, useRef } from 'react';
import { C, FONTS, FS, MAPEL_COLOR, MAPEL_COLOR_LIGHT, MAPEL_COLOR_HOVER } from '../../../styles/tokens';
import { EmptyState } from '../../shared/UI';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
// FIX P3: load progress + konten real dari backend
import { getProgressSiswa, getKontenSiswa, getPretestStatus } from '../../../api/content';
import {
  ADMIN_MAPEL_LIST,
  KURIKULUM_ELEMEN,
  KURIKULUM,
  SEARCH_TOPICS,
  MATERI_PER_ELEMEN,
} from '../../../data/masterData';
import { useStudentStore } from '../../../stores/studentStore';
import { useAuth } from '../../../context/AuthContext';

// MAPEL_LIST_BASE: seluruh mapel dari kurikulum — difilter per-siswa di dalam komponen
const MAPEL_LIST_BASE = ADMIN_MAPEL_LIST.filter(m => KURIKULUM_ELEMEN[m.id] || KURIKULUM[m.id]);

const LEVEL_META = {
  low: { label: 'Low', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' },
  mid: { label: 'Mid', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' },
  high: { label: 'High', color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' },
};

/* ── Popup Belum Pretest ─────────────────────────────────────────── */
/**
 * PretestGateModal — muncul saat siswa klik elemen/materi yang belum dipretest.
 * Props:
 *   materi — label materi yang diklik (jika dari list materi, bisa beda dgn elemenLabel)
 *             jika sama dengan elemen atau kosong → tampilkan konteks elemen saja
 */
const PretestGateModal = ({ mapel, elemen, materi, onDoPretest, onDismiss }) => {
  const isMateriClick = materi && materi !== elemen?.label;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={onDismiss}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 18, padding: '32px 28px', width: 'min(420px, calc(100vw - 32px))', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>📝</div>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 700, color: C.dark, marginBottom: 6, lineHeight: 1.4 }}>
          Pretest dulu sebelum belajar!
        </div>

        {isMateriClick ? (
          /* Dipicu dari klik materi — tampilkan konteks materi + elemen */
          <>
            <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.7, marginBottom: 12 }}>
              Untuk belajar materi <strong style={{ color: C.dark }}>"{materi}"</strong>,<br />
              selesaikan dulu pretest nya:
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 16,
              background: `${mapel?.color}08`, border: `1.5px solid ${mapel?.color}25`,
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{mapel?.icon}</span>
                <div>
                  <div style={{ fontSize: FS.xs, fontWeight: 700, color: mapel?.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{mapel?.label}</div>
                  <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>{elemen?.label}</div>
                </div>
              </div>
              <div style={{ borderTop: `1px dashed ${mapel?.color}30`, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>📖</span>
                <span style={{ fontSize: FS.md, color: C.slate }}>Materi tujuan: <strong style={{ color: C.dark }}>{materi}</strong></span>
              </div>
            </div>
          </>
        ) : (
          /* Dipicu dari klik elemen langsung */
          <>
            <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.7, marginBottom: 8 }}>
              Kerjakan <strong>5 soal pretest</strong> untuk elemen:
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 16px', borderRadius: 99, marginBottom: 16,
              background: `${mapel?.color}12`, border: `1.5px solid ${mapel?.color}30`,
            }}>
              <span style={{ fontSize: 18 }}>{mapel?.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: FS.xs, fontWeight: 700, color: mapel?.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{mapel?.label}</div>
                <div style={{ fontSize: FS.base, fontWeight: 700, color: C.dark }}>{elemen?.label}</div>
              </div>
            </div>
          </>
        )}

        <div style={{ fontSize: FS.md, color: C.slate, lineHeight: 1.6, marginBottom: 24 }}>
          Hasil pretest menentukan level belajarmu.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDismiss}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: `1.5px solid ${C.tealXL}`, background: C.white, fontSize: FS.base, fontWeight: 700, color: C.darkL, cursor: 'pointer', fontFamily: 'inherit' }}>
            Tidak Sekarang
          </button>
          <button onClick={onDoPretest}
            style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: C.teal, color: C.white, fontSize: FS.base, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Mulai Pretest (5 Soal) →
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── ElemenPanel (kolom kanan) ───────────────────────────────────── */
const ElemenPanel = ({ mapel, progressData, onStartBelajar }) => {
  const [expandedElemen, setExpandedElemen] = useState(null);

  const { studentLevels, getElemenLevel, getMateriLevel, isPretestMateriDone, isPretestElemenDone } = useStudentStore(s => ({
    studentLevels: s.studentLevels,
    getElemenLevel: s.getElemenLevel,
    getMateriLevel: s.getMateriLevel,
    isPretestMateriDone: s.isPretestMateriDone,
    isPretestElemenDone: s.isPretestElemenDone,
  }));

  const elemenList = KURIKULUM_ELEMEN[mapel.id] || [];
  const legacyMateri = KURIKULUM[mapel.id] || [];

  // Progress per materi (dari progressData)
  const doneMateriSet = new Set(progressData.sudahSelesai.filter(m => m.mapelId === mapel.id).map(m => m.materiId));
  const ongoingMateriSet = new Set(progressData.belumSelesai.filter(m => m.mapelId === mapel.id).map(m => m.materiId));

  // Hitung pct: coba elemen-based dulu, fallback ke legacy
  const computePct = () => {
    if (elemenList.length > 0) {
      let scored = 0;
      elemenList.forEach(el => {
        const materiPerEl = (MATERI_PER_ELEMEN[mapel.id] || {})[el.id] || [];
        if (materiPerEl.length > 0) {
          const elScore = materiPerEl.reduce((acc, m) => {
            if (doneMateriSet.has(m)) return acc + 1;
            if (ongoingMateriSet.has(m)) return acc + 0.5;
            return acc;
          }, 0);
          scored += elScore / materiPerEl.length;
        } else {
          if (doneMateriSet.has(el.label)) scored += 1;
          else if (ongoingMateriSet.has(el.label)) scored += 0.5;
        }
      });
      return Math.min(100, Math.round((scored / elemenList.length) * 100));
    }
    if (legacyMateri.length > 0) {
      const doneCount = legacyMateri.filter(mat => doneMateriSet.has(mat)).length;
      const ongoingCount = legacyMateri.filter(mat => !doneMateriSet.has(mat) && ongoingMateriSet.has(mat)).length;
      return Math.min(100, Math.round(((doneCount + ongoingCount * 0.5) / legacyMateri.length) * 100));
    }
    // Fallback estimasi
    const totalActive = doneMateriSet.size + ongoingMateriSet.size;
    return totalActive > 0 ? Math.min(100, totalActive * 10) : 0;
  };
  const pct = computePct();

  // doneCount untuk label info (pakai doneMateriSet)
  const doneCount = doneMateriSet.size;

  // Helper: status per materi
  const getMateriStatus = (materiLabel) => {
    if (doneMateriSet.has(materiLabel)) return 'done';
    if (ongoingMateriSet.has(materiLabel)) return 'ongoing';
    return 'belum';
  };

  // Helper: status per elemen (berdasarkan materi di dalamnya, atau langsung dari progressData jika tanpa breakdown)
  const getElemenStatus = (el) => {
    const materiList = (MATERI_PER_ELEMEN[mapel.id] || {})[el.id] || [];
    if (materiList.length > 0) {
      const doneAll = materiList.every(m => doneMateriSet.has(m));
      const anyDone = materiList.some(m => doneMateriSet.has(m));
      const anyOngoing = materiList.some(m => ongoingMateriSet.has(m));
      if (doneAll) return 'done';
      if (anyDone || anyOngoing) return 'ongoing';
      return 'belum';
    }
    // Tidak ada breakdown — cek langsung dari label elemen
    if (doneMateriSet.has(el.label)) return 'done';
    if (ongoingMateriSet.has(el.label)) return 'ongoing';
    return 'belum';
  };

  // Metadata status visual
  const STATUS_META = {
    done: { label: 'Selesai', icon: '✅', color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' },
    ongoing: { label: 'Sedang dipelajari', icon: '🔄', color: '#B7791F', bg: '#FFFBF0', border: '#F6AD55' },
    belum: { label: 'Belum dipelajari', icon: '⬜', color: '#718096', bg: '#F7FAFC', border: '#E2E8F0' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header mapel */}
      <div style={{ padding: '18px 20px 14px', borderBottom: `1.5px solid ${MAPEL_COLOR}18`, background: `linear-gradient(135deg, ${MAPEL_COLOR}07 0%, transparent 60%)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${MAPEL_COLOR}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
            {mapel.icon}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>{mapel.label}</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
              {elemenList.length} elemen
              {legacyMateri.length > 0 && ` · ${legacyMateri.length} materi`}
              {doneCount > 0 && <span style={{ marginLeft: 6, color: C.green, fontWeight: 700 }}>{doneCount} selesai</span>}
            </div>
          </div>
        </div>

        {/* Progress bar + legend status */}
        {legacyMateri.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#E8EDF2', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${MAPEL_COLOR}, ${MAPEL_COLOR}aa)`, transition: 'width .5s' }} />
              </div>
              <span style={{ fontSize: FS.sm, fontWeight: 800, color: MAPEL_COLOR, minWidth: 34 }}>{pct}%</span>
            </div>
            {/* Legend status */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FS.xs, color: C.slate }}>
                  <span style={{ fontSize: 10 }}>{meta.icon}</span>
                  <span>{meta.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* List elemen */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {elemenList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: FS.md, color: C.slate }}>Belum ada elemen untuk mapel ini</div>
          </div>
        ) : elemenList.map((el, elIdx) => {
          const isOpen = expandedElemen === el.id;
          const level = getElemenLevel(mapel.id, el.id);
          const levelMeta = LEVEL_META[level] || LEVEL_META.low;

          const materiPerElemen = (MATERI_PER_ELEMEN[mapel.id] || {})[el.id] || [];
          const hasMateri = materiPerElemen.length > 0;

          const elemenStatus = getElemenStatus(el);
          const elemenStatusMeta = STATUS_META[elemenStatus];

          // Payload dasar yang sama untuk semua click di elemen ini
          const baseParams = {
            mapelId: mapel.id, mapelLabel: mapel.label,
            mapelIcon: mapel.icon,
            elemenId: el.id, elemenLabel: el.label, source: 'progress',
          };

          return (
            <div key={el.id} style={{ marginBottom: 8 }}>
              {/* Baris elemen */}
              <div
                onClick={() => {
                  if (hasMateri) {
                    // Ada materi → expand daftar materi, pretest nanti saat klik materi
                    setExpandedElemen(isOpen ? null : el.id);
                  } else {
                    // Tidak ada materi → elemen = materi, cek pretest elemen langsung
                    onStartBelajar({ ...baseParams, materiId: el.label });
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
                  borderRadius: 10, border: `1.5px solid ${isOpen ? MAPEL_COLOR : '#EDF2F7'}`,
                  background: isOpen ? `${MAPEL_COLOR}08` : elemenStatus === 'done' ? '#F0FFF4' : elemenStatus === 'ongoing' ? '#FFFBF0' : C.white,
                  cursor: 'pointer', transition: 'all .2s',
                }}
                onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.background = `${MAPEL_COLOR}06`; e.currentTarget.style.borderColor = `${MAPEL_COLOR}40`; } }}
                onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.background = elemenStatus === 'done' ? '#F0FFF4' : elemenStatus === 'ongoing' ? '#FFFBF0' : C.white; e.currentTarget.style.borderColor = '#EDF2F7'; } }}
              >
                {/* Nomor + status icon */}
                <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${MAPEL_COLOR}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.md, fontWeight: 700, color: MAPEL_COLOR }}>
                    {elIdx + 1}
                  </div>
                  {/* Status dot di pojok kanan atas */}
                  <span style={{
                    position: 'absolute', top: -3, right: -3, fontSize: FS.xs,
                    lineHeight: 1,
                  }}>
                    {elemenStatusMeta.icon}
                  </span>
                </div>

                <span style={{ flex: 1, fontSize: FS.base, fontWeight: isOpen ? 700 : 500, color: C.dark, lineHeight: 1.4 }}>
                  {el.label}
                </span>

                {/* Level / pretest badge — hanya untuk elemen TANPA breakdown materi.
                    - Belum pretest  → badge "pretest" (kuning)
                    - Sudah pretest  → badge level (Low / Mid / High) sesuai hasil pretest / level-up */}
                {!hasMateri && (() => {
                  const pretestDone = isPretestElemenDone(mapel.id, el.id);
                  if (!pretestDone) {
                    return (
                      <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: '#FFF8EE', color: '#B7791F', border: '1px solid #F6AD55', flexShrink: 0 }}>
                        pretest
                      </span>
                    );
                  }
                  return (
                    <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: levelMeta.bg, color: levelMeta.color, border: `1px solid ${levelMeta.border}`, flexShrink: 0 }}>
                      {levelMeta.label}
                    </span>
                  );
                })()}

                {/* Status text badge */}
                <span style={{
                  fontSize: FS.xs, padding: '2px 7px', borderRadius: 99, fontWeight: 700, flexShrink: 0,
                  background: elemenStatusMeta.bg, color: elemenStatusMeta.color, border: `1px solid ${elemenStatusMeta.border}`,
                }}>
                  {elemenStatusMeta.label}
                </span>

                <span style={{ color: C.slate, fontSize: FS.base, flexShrink: 0 }}>
                  {hasMateri ? (isOpen ? '▾' : '›') : '▶'}
                </span>
              </div>

              {/* Expanded: list materi dengan status masing-masing */}
              {isOpen && hasMateri && (
                <div style={{ marginTop: 4, marginLeft: 8, border: `1.5px solid ${MAPEL_COLOR}20`, borderRadius: 10, overflow: 'hidden', background: `${MAPEL_COLOR}03` }}>
                  {materiPerElemen.map((mat, matIdx) => {
                    const matStatus = getMateriStatus(mat);
                    const matStatusMeta = STATUS_META[matStatus];
                    return (
                      <div key={matIdx}
                        onClick={() => onStartBelajar({ ...baseParams, materiId: mat })}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: matIdx < materiPerElemen.length - 1 ? `1px solid ${MAPEL_COLOR}15` : 'none', cursor: 'pointer', transition: 'background .15s', background: matStatus === 'done' ? '#F0FFF413' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = `${MAPEL_COLOR}08`}
                        onMouseLeave={e => e.currentTarget.style.background = matStatus === 'done' ? '#F0FFF413' : 'transparent'}>
                        {/* Status icon */}
                        <span style={{ fontSize: FS.md, flexShrink: 0 }}>{matStatusMeta.icon}</span>
                        <span style={{ flex: 1, fontSize: FS.md, color: C.dark }}>{mat}</span>
                        {/* Level badge — muncul setelah pretest materi selesai */}
                        {isPretestMateriDone(mapel.id, el.id, mat) && (() => {
                          const ml = getMateriLevel(mapel.id, el.id, mat);
                          const mlM = LEVEL_META[ml] || LEVEL_META.low;
                          return <span style={{ fontSize: FS.xs, padding: '1px 7px', borderRadius: 99, fontWeight: 700, background: mlM.bg, color: mlM.color, border: `1px solid ${mlM.border}`, flexShrink: 0 }}>{mlM.label}</span>;
                        })()}
                        {/* Pretest badge — muncul jika belum dipretest */}
                        {!isPretestMateriDone(mapel.id, el.id, mat) && (
                          <span style={{ fontSize: FS.xs, padding: '1px 6px', borderRadius: 99, fontWeight: 700, background: '#FFF8EE', color: '#B7791F', border: '1px solid #F6AD55', flexShrink: 0 }}>pretest</span>
                        )}
                        {/* Status badge kecil */}
                        <span style={{ fontSize: FS.xs, padding: '1px 6px', borderRadius: 99, fontWeight: 700, background: matStatusMeta.bg, color: matStatusMeta.color, border: `1px solid ${matStatusMeta.border}`, flexShrink: 0 }}>
                          {matStatusMeta.label}
                        </span>
                        <span style={{ color: MAPEL_COLOR, fontSize: FS.lg, flexShrink: 0 }}>›</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════ */
const ProgressSection = ({ progressData, openChatWithWebcam, onNavigateToPretest }) => {
  const [filterTab, setFilterTab] = useState('ongoing');
  const [selectedMapelId, setSelectedMapelId] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();
  const { user } = useAuth();

  // Modal state
  const [pretestGateData, setPretestGateData] = useState(null);  // { mapel, elemen, materiData }

  // CONTRACT V3.6 §11: progress real dari GET /siswa/:id/progress
  const [apiLearningProgress, setApiLearningProgress] = useState(null);
  const [publishedKonten, setPublishedKonten] = useState(null);
  useEffect(() => {
    const siswaId = user?.id;
    if (!siswaId) return; // belum login, skip fetch
    // Fetch progress real dari GET /siswa/:id/progress
    getProgressSiswa({ siswa_id: siswaId })
      .then(data => {
        setApiLearningProgress(data);
        // Sync completed IDs ke store agar progressData.sudahSelesai akurat (tidak pakai dummy seed)
        if (data) {
          const { setProgressFromApi } = useStudentStore.getState();
          if (typeof setProgressFromApi === 'function') {
            setProgressFromApi(data);
          }
        }
      })
      .catch(() => { /* silent — pakai progressData lokal */ });
    // Definisi fetchPretest DULU sebelum dipanggil
    const { markPretestElemenDone, markPretestMateriDone } = useStudentStore.getState();
    const fetchPretest = (mapelIds) => {
      mapelIds.forEach(mapelId => {
        getPretestStatus({ siswa_id: siswaId, mapel_id: mapelId })
          .then(statusList => {
            if (!Array.isArray(statusList)) return;
            statusList.forEach(item => {
              if (item.status !== 'selesai' || !item.level) return;
              if (item.materi_id) {
                markPretestMateriDone(mapelId, item.elemen_id, item.materi_id, item.level);
              } else {
                markPretestElemenDone(mapelId, item.elemen_id, item.level);
              }
            });
          })
          .catch(() => { /* silent */ });
      });
    };

    // Baru panggil getKontenSiswa yang menggunakan fetchPretest
    getKontenSiswa({ siswa_id: siswaId })
      .then(data => {
        const kontenList = Array.isArray(data) ? data : [];
        setPublishedKonten(kontenList);
        const mapelIds = kontenList.length > 0
          ? [...new Set(kontenList.map(k => k.mapel_id).filter(Boolean))]
          : ADMIN_MAPEL_LIST.map(m => m.id);
        fetchPretest(mapelIds);
      })
      .catch(() => {
        setPublishedKonten([]);
        fetchPretest(ADMIN_MAPEL_LIST.map(m => m.id));
      });
  }, [user?.id]);

  const { isPretestElemenDone, isPretestMateriDone, getElemenLevel, getMateriLevel } = useStudentStore(s => ({
    isPretestElemenDone: s.isPretestElemenDone,
    isPretestMateriDone: s.isPretestMateriDone,
    getElemenLevel: s.getElemenLevel,
    getMateriLevel: s.getMateriLevel,
    // subscribe ke studentLevels agar komponen re-render saat level berubah
    _levels: s.studentLevels,
  }));

  // ── Helper: kumpulkan set materiId yang sudah selesai / sedang berjalan per mapel ──
  const getDoneSet = (mapelId) => new Set(
    progressData.sudahSelesai.filter(p => p.mapelId === mapelId).map(p => p.materiId)
  );
  const getOngoingSet = (mapelId) => new Set(
    progressData.belumSelesai.filter(p => p.mapelId === mapelId).map(p => p.materiId)
  );

  // ── getMapelPct: hitung % progres berdasarkan materi yang benar-benar ada di progressData ──
  // Ini yang menyebabkan progress bar selalu 0:
  // Sebelumnya hanya menghitung elemen yang *punya aktivitas*, bukan materi individu.
  // Setelah quiz selesai, materiId masuk ke sudahSelesai — perlu di-count dengan benar.
  const getMapelPct = (mapelId) => {
    const doneSet = getDoneSet(mapelId);
    const ongoingSet = getOngoingSet(mapelId);
    const allActiveMateri = new Set([...doneSet, ...ongoingSet]);

    const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
    const legacyMateri = KURIKULUM[mapelId] || [];

    // Prioritas: gunakan elemen dengan breakdown materi
    if (elemenList.length > 0) {
      let scored = 0;
      elemenList.forEach(el => {
        const materiPerEl = (MATERI_PER_ELEMEN[mapelId] || {})[el.id] || [];
        if (materiPerEl.length > 0) {
          // Tiap materi yang selesai (quiz done) berkontribusi penuh; yang ongoing 0.5
          const elScore = materiPerEl.reduce((acc, m) => {
            if (doneSet.has(m)) return acc + 1;
            if (ongoingSet.has(m)) return acc + 0.5;
            return acc;
          }, 0);
          scored += elScore / materiPerEl.length;
        } else {
          // Tidak ada breakdown materi — cek label elemen langsung
          if (doneSet.has(el.label)) scored += 1;
          else if (ongoingSet.has(el.label)) scored += 0.5;
        }
      });
      return Math.min(100, Math.round((scored / elemenList.length) * 100));
    }

    // Fallback: pakai legacy materi list
    if (legacyMateri.length > 0) {
      const doneCount = legacyMateri.filter(m => doneSet.has(m)).length;
      const ongoingCount = legacyMateri.filter(m => !doneSet.has(m) && ongoingSet.has(m)).length;
      return Math.min(100, Math.round(((doneCount + ongoingCount * 0.5) / legacyMateri.length) * 100));
    }

    // Tidak ada kurikulum terdaftar — pakai jumlah materi aktif sebagai estimasi
    if (allActiveMateri.size > 0) return Math.min(100, allActiveMateri.size * 10);
    return 0;
  };

  // ── Helper: apakah mapel punya aktivitas apapun ──
  const getMapelHasActivity = (mapelId) =>
    progressData.sudahSelesai.some(p => p.mapelId === mapelId) ||
    progressData.belumSelesai.some(p => p.mapelId === mapelId);

  // ── Helper: apakah semua materi mapel sudah selesai ──
  const getMapelIsFullyDone = (mapelId) => {
    const doneSet = getDoneSet(mapelId);
    const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
    const legacyMateri = KURIKULUM[mapelId] || [];

    if (elemenList.length > 0) {
      return elemenList.every(el => {
        const materiPerEl = (MATERI_PER_ELEMEN[mapelId] || {})[el.id] || [];
        if (materiPerEl.length > 0) return materiPerEl.every(m => doneSet.has(m));
        return doneSet.has(el.label);
      });
    }
    if (legacyMateri.length > 0) return legacyMateri.every(m => doneSet.has(m));
    return false;
  };

  // Progress menampilkan SEMUA mapel dari kurikulum yang terdaftar.
  // MAPEL_LIST dibangun dari publishedKonten — mapel yang guru sudah publish ke kelas siswa ini.
  // null  = masih loading → tampilkan semua (MAPEL_LIST_BASE) sebagai skeleton
  // []    = sudah fetch, kosong → tampilkan semua (guru belum publish)
  // [...] = sudah fetch, ada data → filter sesuai mapel yang dipublish
  const publishedMapelIds = publishedKonten !== null && publishedKonten.length > 0
    ? [...new Set(publishedKonten.map(k => k.mapel_id).filter(Boolean))]
    : null;
  const isPublishedKontenLoading = publishedKonten === null;
  const MAPEL_LIST = (!isPublishedKontenLoading && publishedMapelIds)
    ? MAPEL_LIST_BASE.filter(m => publishedMapelIds.includes(m.id))
    : MAPEL_LIST_BASE;

  // ── Hitung counter tab filter ──
  // "Belum selesai" = ada aktivitas TAPI belum semua selesai
  const totalOngoing = MAPEL_LIST.filter(mapel =>
    getMapelHasActivity(mapel.id) && !getMapelIsFullyDone(mapel.id)
  ).length;

  const totalDone = MAPEL_LIST.filter(mapel =>
    getMapelIsFullyDone(mapel.id)
  ).length;

  // ── Filter mapel berdasarkan tab aktif ──
  // Fix: sebelumnya filter "ongoing" selalu kosong karena mengecek KURIKULUM[] length
  // yang bisa tidak cocok dengan materiId yang disimpan dari quiz.
  const filteredMapel = MAPEL_LIST.filter(mapel => {
    if (filterTab === 'all') return true;
    if (filterTab === 'ongoing') return getMapelHasActivity(mapel.id) && !getMapelIsFullyDone(mapel.id);
    if (filterTab === 'done') return getMapelIsFullyDone(mapel.id);
    return true;
  });

  // Search — masih berbasis SEARCH_TOPICS untuk backward compat
  const searchResults = searchQ.trim()
    ? SEARCH_TOPICS.filter(t =>
      t?.materiId?.toLowerCase().includes(searchQ.toLowerCase()) ||
      t?.mapelLabel?.toLowerCase().includes(searchQ.toLowerCase())
    )
    : [];

  useEffect(() => {
    if (!selectedMapelId && filteredMapel.length > 0) setSelectedMapelId(filteredMapel[0].id);
  }, []);

  useEffect(() => {
    if (!searchQ && filteredMapel.length > 0) {
      if (!filteredMapel.find(m => m.id === selectedMapelId)) setSelectedMapelId(filteredMapel[0].id);
    }
  }, [filterTab]);

  const selectedMapel = MAPEL_LIST.find(m => m.id === selectedMapelId);

  // Dipanggil ketika siswa klik elemen/materi
  const handleStartBelajar = (params) => {
    const { mapelId, elemenId, elemenLabel, materiId } = params;
    const mapelMeta = MAPEL_LIST.find(m => m.id === mapelId);

    // Tentukan apakah klik ini berasal dari materi (bukan langsung elemen tanpa materi)
    // Elemen tanpa materi: materiId === elemenLabel (diset di baseParams)
    const materiPerElemen = (MATERI_PER_ELEMEN[mapelId] || {})[elemenId] || [];
    const hasMateriBreakdown = materiPerElemen.length > 0;

    if (hasMateriBreakdown) {
      // ── Elemen DENGAN materi → cek pretest per MATERI ────────────
      const pretestDone = isPretestMateriDone(mapelId, elemenId, materiId);
      if (!pretestDone) {
        setPretestGateData({
          mapel: mapelMeta,
          elemen: { id: elemenId, label: elemenLabel },
          materi: materiId,
          isMateriLevel: true,   // flag: pretest untuk materi spesifik
          materiData: {
            mapelId, mapelLabel: params.mapelLabel,
            mapelIcon: params.mapelIcon,
            materiId, elemenId, elemenLabel, source: 'progress',
          },
        });
        return;
      }
      // Sudah pretest materi → buka ATPCamModal dengan level materi
      const level = getMateriLevel(mapelId, elemenId, materiId);
      openChatWithWebcam({
        mapelId, mapelLabel: params.mapelLabel,
        mapelIcon: params.mapelIcon,
        materiId, elemenId, elemenLabel, level, source: 'progress',
      });

    } else {
      // ── Elemen TANPA materi → cek pretest per ELEMEN ─────────────
      const pretestDone = isPretestElemenDone(mapelId, elemenId);
      if (!pretestDone) {
        setPretestGateData({
          mapel: mapelMeta,
          elemen: { id: elemenId, label: elemenLabel },
          materi: null,
          isMateriLevel: false,
          materiData: {
            mapelId, mapelLabel: params.mapelLabel,
            mapelIcon: params.mapelIcon,
            materiId: elemenLabel, elemenId, elemenLabel, source: 'progress',
          },
        });
        return;
      }
      // Sudah pretest elemen → buka ATPCamModal
      const level = getElemenLevel(mapelId, elemenId);
      openChatWithWebcam({
        mapelId, mapelLabel: params.mapelLabel,
        mapelIcon: params.mapelIcon,
        materiId: elemenLabel, elemenId, elemenLabel, level, source: 'progress',
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: C.bg }}>

      {/* Header */}
      <div style={{ padding: 'var(--content-py,20px) var(--content-px,24px) 14px', flexShrink: 0, background: C.bg }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h1, fontWeight: 600, color: C.dark, marginBottom: 3 }}>
          📈 Progress Belajarku
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 16 }}>
          {totalDone > 0 || totalOngoing > 0
            ? `${totalDone} mata pelajaran selesai · ${totalOngoing} sedang dipelajari · Klik materi untuk mulai belajar`
            : 'Pilih mata pelajaran dan elemen untuk mulai belajar'}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: FS.lg, color: C.slate, pointerEvents: 'none' }}>🔍</div>
          <input
            value={searchQ}
            onChange={e => { setSearchQ(e.target.value); setShowDropdown(true); }}
            placeholder="Cari topik... (contoh : Trigonometri, Fotosintesis, Proklamasi)"
            style={{ width: '100%', padding: '10px 40px 10px 40px', borderRadius: 24, fontSize: FS.md, border: `2px solid ${C.tealXL}`, outline: 'none', background: C.white, transition: 'border .2s', boxSizing: 'border-box', fontFamily: 'inherit' }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => { e.target.style.borderColor = C.tealXL; setTimeout(() => setShowDropdown(false), 180); }}
          />
          {searchQ && (
            <button onClick={() => { setSearchQ(''); setShowDropdown(false); }} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: FS.lg, color: C.slate, cursor: 'pointer', padding: 0 }}>✕</button>
          )}
          {showDropdown && searchQ.trim() && searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: C.white, borderRadius: 12, zIndex: 200, boxShadow: '0 8px 32px rgba(26,35,50,.15)', border: `1.5px solid ${C.tealXL}`, maxHeight: 220, overflowY: 'auto' }}>
              {searchResults.slice(0, 8).map((t, i) => (
                <div key={i}
                  onMouseDown={() => { setSelectedMapelId(t.mapelId); setSearchQ(t.materiId); setShowDropdown(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? `1px solid ${C.tealXL}` : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 16 }}>{t.mapelIcon}</span>
                  <div>
                    <div style={{ fontSize: FS.md, fontWeight: 600, color: C.dark }}>{t.materiId}</div>
                    <div style={{ fontSize: FS.xs, color: C.slate }}>{t.mapelLabel}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'all', label: `Semua (${MAPEL_LIST.length})` },
            { id: 'ongoing', label: `Belum selesai${totalOngoing > 0 ? ` (${totalOngoing})` : ''}` },
            { id: 'done', label: `Selesai${totalDone > 0 ? ` (${totalDone})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setFilterTab(t.id)}
              style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${C.tealXL}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: FS.md, fontWeight: 700, background: filterTab === t.id ? C.teal : C.bg, color: filterTab === t.id ? C.white : C.darkL, transition: 'all .2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2-Column body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'auto', padding: `0 var(--content-px, 24px) 20px`, gap: 14, flexDirection: (isMobile || isTablet) ? 'column' : 'row' }}>

        {/* Kolom Kiri — Mata Pelajaran */}
        <div style={{ width: (isMobile || isTablet) ? '100%' : 340, flexShrink: 0, background: C.white, borderRadius: 14, border: '1.5px solid #E8EDF2', overflowY: (isMobile || isTablet) ? 'visible' : 'auto', maxHeight: (isMobile || isTablet) ? 'none' : '100%', boxShadow: '0 2px 10px rgba(26,35,50,.06)' }}>
          <div style={{ padding: '10px 14px 8px', fontSize: FS.md, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #EDF2F7', flexShrink: 0 }}>
            Mata Pelajaran
          </div>
          {filteredMapel.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, opacity: .3, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: FS.md, color: C.slate }}>Tidak ada mata pelajaran</div>
            </div>
          ) : filteredMapel.map(mapel => {
            const pct = getMapelPct(mapel.id);
            const isActive = selectedMapelId === mapel.id;
            // Cek apakah ada elemen yang belum dipretest di mapel ini
            const elemenMapel = KURIKULUM_ELEMEN[mapel.id] || [];
            const adaElemenBelumPretest = elemenMapel.some(el => !isPretestElemenDone(mapel.id, el.id));
            return (
              <div key={mapel.id}
                onClick={() => setSelectedMapelId(mapel.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 14px', cursor: 'pointer', background: isActive ? `${MAPEL_COLOR}0e` : 'transparent', borderLeft: `3px solid ${isActive ? MAPEL_COLOR : 'transparent'}`, borderBottom: '1px solid #F7F9FA', transition: 'all .15s' }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F7FAFC'; e.currentTarget.style.borderLeftColor = `${MAPEL_COLOR}44`; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; } }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${MAPEL_COLOR}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: FS.h3, flexShrink: 0 }}>
                  {mapel.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: FS.base, fontWeight: isActive ? 700 : 500, color: isActive ? MAPEL_COLOR : C.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mapel.label}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: '#E8EDF2', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: MAPEL_COLOR, transition: 'width .4s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Kolom Kanan — Elemen & Materi */}
        <div style={{ flex: 1, minWidth: 0, background: C.white, borderRadius: 14, border: '1.5px solid #E8EDF2', overflow: 'visible', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 10px rgba(26,35,50,.06)' }}>
          {selectedMapel ? (
            <ElemenPanel
              mapel={selectedMapel}
              progressData={progressData}
              onStartBelajar={handleStartBelajar}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, padding: 24 }}>
              <div style={{ fontSize: 32, opacity: .3 }}>📚</div>
              <div style={{ fontSize: FS.base, color: C.slate, textAlign: 'center' }}>Pilih mata pelajaran di sebelah kiri untuk melihat elemen</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Belum Pretest */}
      {pretestGateData && (
        <PretestGateModal
          mapel={pretestGateData.mapel}
          elemen={pretestGateData.elemen}
          materi={pretestGateData.materi}
          onDoPretest={() => {
            const d = pretestGateData;
            setPretestGateData(null);
            onNavigateToPretest?.({
              mapelId: d.mapel?.id,
              elemenId: d.elemen?.id,
              elemenLabel: d.elemen?.label,
              targetMateriId: d.isMateriLevel ? d.materi : null,
              isMateriLevel: !!d.isMateriLevel,
              materiData: d.materiData,
            });
          }}
          onDismiss={() => setPretestGateData(null)}
        />
      )}

    </div>
  );
};

export default ProgressSection;