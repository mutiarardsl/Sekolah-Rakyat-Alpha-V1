/**
 * SR MVP — Student Store (Zustand) — REVISI PRETEST PER ELEMEN
 *
 * Perubahan:
 *  - pretestDoneElemen: Set<"mapelId__elemenId"> → pretest elemen (untuk elemen tanpa materi)
 *  - pretestDoneMateri: Set<"mapelId__elemenId__materiId"> → pretest per materi (elemen yg punya materi)
 *  - isPretestElemenDone / isPretestMateriDone — cek masing-masing
 *  - markPretestElemenDone / markPretestMateriDone — tandai + set level
 *  - selectedMapels: mapel pilihan siswa saat onboarding (untuk rekomendasi dashboard awal)
 *  - pretestDoneMapels & markPretestDoneWithLeveling dipertahankan (backward compat)
 */
import { create } from 'zustand';
import { PROGRESS_DATA_INIT, KURIKULUM, KURIKULUM_ELEMEN, MATERI_PER_ELEMEN } from '../data/masterData';

const makeKey = (mapelId, elemenId) => `${mapelId}__${elemenId}`;
const makeMateriKey = (mapelId, elemenId, materiId) => `${mapelId}__${elemenId}__${materiId}`;

// Seed: elemen yang sudah pretest (Budi sudah pretest elemen tertentu dari mat & kim)
const PRETEST_DONE_ELEMEN_INIT = new Set([
]);

// Seed: materi yang sudah dipretest (kosong — pretest materi baru berjalan setelah revisi ini)
const PRETEST_DONE_MATERI_INIT = new Set();

// Seed backward-compat
const PRETEST_DONE_MAPELS_INIT = new Set(['mat', 'kim']);

export const useStudentStore = create((set, get) => ({

  // ── Mapel pilihan siswa (onboarding) ─────────────────────────────
  // PENTING: baca dari localStorage agar tidak hilang saat reload / re-login
  // Key: sr_selected_mapels_{user_id} → agar beda siswa tidak tercampur
  selectedMapels: (() => {
    try {
      const saved = localStorage.getItem('sr_selected_mapels');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [];
  })(),
  setSelectedMapels: (mapels) => {
    try { localStorage.setItem('sr_selected_mapels', JSON.stringify(mapels)); } catch { /* ignore */ }
    set({ selectedMapels: mapels });
  },

  // ── Pretest status per ELEMEN ─────────────────────────────────────
  pretestDoneElemen: PRETEST_DONE_ELEMEN_INIT,

  isPretestElemenDone: (mapelId, elemenId) => {
    return get().pretestDoneElemen.has(makeKey(mapelId, elemenId));
  },

  markPretestElemenDone: (mapelId, elemenId, level = 'low') => {
    const key = makeKey(mapelId, elemenId);
    set(state => ({
      pretestDoneElemen: new Set([...state.pretestDoneElemen, key]),
      studentLevels: { ...state.studentLevels, [key]: level },
    }));
  },

  // ── Pretest status per MATERI (untuk elemen yang punya breakdown materi) ─────
  // key: "mapelId__elemenId__materiId"
  // Level disimpan di studentLevels dengan key yang sama
  pretestDoneMateri: PRETEST_DONE_MATERI_INIT,

  isPretestMateriDone: (mapelId, elemenId, materiId) => {
    return get().pretestDoneMateri.has(makeMateriKey(mapelId, elemenId, materiId));
  },

  markPretestMateriDone: (mapelId, elemenId, materiId, level = 'low') => {
    const key = makeMateriKey(mapelId, elemenId, materiId);
    set(state => ({
      pretestDoneMateri: new Set([...state.pretestDoneMateri, key]),
      studentLevels: { ...state.studentLevels, [key]: level },
    }));
  },

  // Level per materi (key: mapelId__elemenId__materiId)
  getMateriLevel: (mapelId, elemenId, materiId) => {
    return get().studentLevels[makeMateriKey(mapelId, elemenId, materiId)] || 'low';
  },

  // ── Pretest status per MAPEL (backward compat) ────────────────────
  pretestDoneMapels: PRETEST_DONE_MAPELS_INIT,

  markPretestDone: (mapelId) => set(state => ({
    pretestDoneMapels: new Set([...state.pretestDoneMapels, mapelId]),
  })),

  isPretestDone: (mapelId) => get().pretestDoneMapels.has(mapelId),

  markPretestDoneWithLeveling: (mapelId, wrongTopics = []) => {
    const elemenList = KURIKULUM_ELEMEN[mapelId] || [];
    const allCorrect = !wrongTopics || wrongTopics.length === 0;

    let wrongElemenIds = new Set();
    if (!allCorrect) {
      const mapelMateriPerElemen = (MATERI_PER_ELEMEN || {})[mapelId] || {};
      wrongTopics.forEach(wt => {
        const directMatch = elemenList.find(el => el.label === wt.materiId);
        if (directMatch) { wrongElemenIds.add(directMatch.id); return; }
        Object.entries(mapelMateriPerElemen).forEach(([elemenId, materiArr]) => {
          if (Array.isArray(materiArr) && materiArr.includes(wt.materiId)) {
            wrongElemenIds.add(elemenId);
          }
        });
      });
      if (wrongElemenIds.size === 0) {
        elemenList.forEach(el => wrongElemenIds.add(el.id));
      }
    }

    const newLevels = {};
    const newPretestDoneElemen = new Set([...get().pretestDoneElemen]);
    elemenList.forEach(el => {
      const level = allCorrect ? 'high' : wrongElemenIds.has(el.id) ? 'low' : 'mid';
      newLevels[makeKey(mapelId, el.id)] = level;
      newPretestDoneElemen.add(makeKey(mapelId, el.id));
    });

    set(state => ({
      pretestDoneMapels: new Set([...state.pretestDoneMapels, mapelId]),
      pretestDoneElemen: newPretestDoneElemen,
      studentLevels: { ...state.studentLevels, ...newLevels },
    }));
  },

  // ── Level per elemen ─────────────────────────────────────────────
  studentLevels: {
    'mat__bil_aljabar': 'low',
    'mat__data_statistika': 'mid',
    'mat__geometri': 'low',
    'mat__kalkulus': 'high',
    'kim__pemahaman_kim': 'mid',
    'kim__keterampilan_proses_kim': 'low',
  },

  setElemenLevel: (mapelId, elemenId, level) => set(state => ({
    studentLevels: { ...state.studentLevels, [makeKey(mapelId, elemenId)]: level },
  })),

  // Update level per materi (untuk elemen yang punya breakdown materi)
  setMateriLevel: (mapelId, elemenId, materiId, level) => set(state => ({
    studentLevels: { ...state.studentLevels, [makeMateriKey(mapelId, elemenId, materiId)]: level },
  })),

  getElemenLevel: (mapelId, elemenId) => {
    return get().studentLevels[makeKey(mapelId, elemenId)] || 'low';
  },

  tryLevelUp: (mapelId, elemenId, quizScore, quizTotal, gameCompleted) => {
    const pct = quizTotal > 0 ? quizScore / quizTotal : 0;
    if (pct <= 0.7 || !gameCompleted) return null;
    const current = get().studentLevels[makeKey(mapelId, elemenId)] || 'low';
    const next = current === 'low' ? 'mid' : current === 'mid' ? 'high' : 'high';
    if (next === current) return null;
    set(state => ({
      studentLevels: { ...state.studentLevels, [makeKey(mapelId, elemenId)]: next },
    }));
    return next;
  },

  gameCompleted: {},
  markGameComplete: (mapelId, elemenId, level) => set(state => ({
    gameCompleted: { ...state.gameCompleted, [`${mapelId}__${elemenId}__${level}`]: true },
  })),
  isGameComplete: (mapelId, elemenId, level) => {
    return !!get().gameCompleted[`${mapelId}__${elemenId}__${level}`];
  },

  progressData: { ...PROGRESS_DATA_INIT },
  setProgressData: (updater) => set(state => ({
    progressData: typeof updater === 'function' ? updater(state.progressData) : updater,
  })),

  markTopicOngoing: (materi) => set(state => {
    const { mapelId, materiId } = materi;
    if (!materiId) return state;
    const validMateris = KURIKULUM[mapelId] || [];
    const materiPerElemen = Object.values((MATERI_PER_ELEMEN[mapelId] || {})).flat();
    if (!validMateris.includes(materiId) && !materiPerElemen.includes(materiId)) return state;
    const key = makeKey(mapelId, materiId);
    if (state.progressData.sudahSelesai.find(m => makeKey(m.mapelId, m.materiId) === key)) return state;
    if (state.progressData.belumSelesai.find(m => makeKey(m.mapelId, m.materiId) === key)) return state;
    return {
      progressData: {
        ...state.progressData,
        belumSelesai: [
          ...state.progressData.belumSelesai,
          { id: `auto_${Date.now()}`, ...materi, progress: 10, lastChat: 'Baru saja', confDone: [], quizDone: false, quizScore: null },
        ],
      },
    };
  }),

  markTopicComplete: (materi, score) => set(state => {
    const key = makeKey(materi.mapelId, materi.materiId);
    const bs = state.progressData.belumSelesai.filter(m => makeKey(m.mapelId, m.materiId) !== key);
    const ss = state.progressData.sudahSelesai.filter(m => makeKey(m.mapelId, m.materiId) !== key);
    const existing = [...state.progressData.belumSelesai, ...state.progressData.sudahSelesai]
      .find(m => makeKey(m.mapelId, m.materiId) === key);
    return {
      progressData: {
        belumSelesai: bs,
        sudahSelesai: [...ss, { ...(existing ?? materi), progress: 100, quizDone: true, quizScore: score, lastChat: 'Baru saja' }],
      },
    };
  }),

  // ── Quiz history (persisten — tidak hilang saat keluar chatbot) ──────
  // key: mapelId__materiId  →  [{type, score, ts, level, soalSnapshot, ...}]
  // ── Aktivitas terbaru (persisten di store) ────────────────────────
  recentActivity: [],
  addRecentActivity: (entry) => set(state => ({
    recentActivity: [entry, ...state.recentActivity].slice(0, 10),
  })),

  quizHistory: {},
  setQuizHistory: (updater) => set(state => ({
    quizHistory: typeof updater === 'function' ? updater(state.quizHistory) : updater,
  })),

  // ── Level map per sesi (persisten) ────────────────────────────────
  // key: mapelId__materiId  →  'low' | 'mid' | 'high'
  levelMap: {},
  setLevelMap: (updater) => set(state => ({
    levelMap: typeof updater === 'function' ? updater(state.levelMap) : updater,
  })),

  msgsByKey: {},
  setMessages: (key, msgs) => set(state => ({ msgsByKey: { ...state.msgsByKey, [key]: msgs } })),
  appendMessage: (key, msg) => set(state => ({
    msgsByKey: { ...state.msgsByKey, [key]: [...(state.msgsByKey[key] ?? []), msg] },
  })),

  confContent: {},
  setConfItem: (materiKey, type, data) => set(state => ({
    confContent: { ...state.confContent, [materiKey]: { ...(state.confContent[materiKey] ?? {}), [type]: data } },
  })),

  chatMateri: null,
  setChatMateri: (m) => set({ chatMateri: m }),

  needsQuizAnalysis: false,
  lastQuizResult: null,
  setQuizAnalysisNeeded: (result) => set({ needsQuizAnalysis: true, lastQuizResult: result }),
  clearQuizAnalysis: () => set({ needsQuizAnalysis: false }),
}));