/**
 * SR MVP — PageKurikulum (Portal Admin) — REVISI FASE 3
 *
 * Perubahan dari rancangan awal:
 *  1. Upload dokumen kurikulum → Dropdown pilih kurikulum (default: Merdeka)
 *  2. CRUD Materi (string bebas) → CRUD Elemen ATP (mapel → elemen)
 *     Admin hanya mengelola sampai level elemen; materi diisi guru via upload ATP
 *  3. Daftar elemen otomatis terisi dari seeder KURIKULUM_ELEMEN (Kurikulum Merdeka),
 *     namun admin tetap bisa CRUD manual
 */
import { useState } from 'react';
import { Card, Btn, EmptyState } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { KURIKULUM_ELEMEN, CAPAIAN_PEMBELAJARAN } from '../../../data/masterData';

const ICON_OPTIONS = ["📐", "🔬", "📖", "🌍", "🌐", "⚽", "🎨", "🇮🇩", "🎵", "💻", "🧪", "📊", "🏛️", "🔭", "🧮", "📗", "🖊️", "🌿"];
const COLOR_OPTIONS = [
  { label: "Teal", value: "#0D5C63" }, { label: "Orange", value: "#DD6B20" },
  { label: "Purple", value: "#6B46C1" }, { label: "Green", value: "#2F855A" },
  { label: "Blue", value: "#2B6CB0" }, { label: "Brown", value: "#C05621" },
  { label: "Gold", value: "#B7791F" }, { label: "Red", value: "#9B2C2C" },
  { label: "Pink", value: "#D53F8C" }, { label: "Slate", value: "#4A5568" },
];

const JENJANG_LIST = [
  { id: "X", label: "Kelas X" },
  { id: "XI", label: "Kelas XI" },
  { id: "XII", label: "Kelas XII" },
];

const KURIKULUM_OPTIONS = [
  { value: "merdeka", label: "Kurikulum Merdeka" },
];

const INP = {
  width: "100%", padding: "9px 12px", border: `1.5px solid ${C.tealXL}`,
  borderRadius: 9, fontSize: FS.base, outline: "none", background: C.white, fontFamily: "inherit",
};

/* ── Dropdown Pilih Kurikulum ─────────────────────────────────────── */
const PilihKurikulum = ({ selectedKurikulum, setSelectedKurikulum }) => (
  <Card style={{ padding: 20, marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: `${C.teal}18`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
      }}>📋</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark, marginBottom: 2 }}>
          Pilih Kurikulum Acuan
        </div>
        <div style={{ fontSize: FS.sm, color: C.slate, marginBottom: 12, lineHeight: 1.5 }}>
          Kurikulum yang dipilih menjadi acuan struktur mata pelajaran dan elemen di seluruh kelas.
        </div>
        <select
          value={selectedKurikulum}
          onChange={e => setSelectedKurikulum(e.target.value)}
          style={{ ...INP, width: "auto", minWidth: 260, cursor: "pointer" }}
          onFocus={e => e.target.style.borderColor = C.teal}
          onBlur={e => e.target.style.borderColor = C.tealXL}
        >
          {KURIKULUM_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  </Card>
);

/* ── CapaianPembelajaranPanel ─────────────────────────────────────── */
const CapaianPembelajaranPanel = ({ mapelId, mapelColor, mapelLabel, compact = false }) => {
  const [expanded, setExpanded] = useState(!compact);
  const cp = CAPAIAN_PEMBELAJARAN[mapelId];
  if (!cp) return null;

  return (
    <div style={{
      borderRadius: compact ? 10 : 12,
      border: `1.5px solid ${mapelColor}28`,
      background: `${mapelColor}08`,
      overflow: 'hidden',
      marginBottom: compact ? 0 : 20,
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
          padding: compact ? '9px 12px' : '11px 14px',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{
            width: compact ? 22 : 26, height: compact ? 22 : 26, borderRadius: 6,
            background: `${mapelColor}20`, color: mapelColor,
            fontSize: compact ? 12 : 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>🎯</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: mapelColor }}>
              Capaian Pembelajaran
            </div>
            {!expanded && (
              <div style={{ fontSize: FS.xs, color: '#718096', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {cp.fase}
              </div>
            )}
          </div>
        </div>
        <span style={{
          fontSize: FS.xs, color: mapelColor, fontWeight: 700,
          background: `${mapelColor}15`, borderRadius: 6,
          padding: '2px 7px', flexShrink: 0,
        }}>
          {expanded ? '▲ Tutup' : `▼ Lihat CP`}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div style={{
          padding: compact ? '0 12px 10px' : '0 14px 14px',
          borderTop: `1px solid ${mapelColor}18`,
        }}>
          {/* Fase badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: `${mapelColor}15`, borderRadius: 99,
            padding: '3px 10px', marginBottom: 8, marginTop: 8,
          }}>
            <span style={{ fontSize: 10 }}>📚</span>
            <span style={{ fontSize: FS.xs, fontWeight: 700, color: mapelColor }}>{cp.fase}</span>
          </div>

          {/* Deskripsi */}
          <div style={{
            fontSize: compact ? 11 : 12, color: '#4A5568', lineHeight: 1.7,
            marginBottom: 10, fontStyle: 'italic',
            background: '#FFFFFF88', borderRadius: 8,
            padding: '8px 10px', border: `1px solid ${mapelColor}15`,
          }}>
            "{cp.deskripsi}"
          </div>

        </div>
      )}
    </div>
  );
};

/* ── Modal Tambah/Edit Mapel — dengan CRUD Elemen ATP ────────────── */
const ModalMapel = ({ modalMapel, setModalMapel, saveMapelLocal }) => {
  const [form, setForm] = useState(modalMapel);

  const masterElemen = KURIKULUM_ELEMEN[modalMapel.id] || [];
  const initialElemen = (modalMapel.elemen && modalMapel.elemen.length > 0)
    ? modalMapel.elemen
    : masterElemen.map(e => ({ ...e }));

  const [elemen, setElemen] = useState(initialElemen);
  const [newElemen, setNewElemen] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");

  // CP state — load from masterData jika ada, atau dari modalMapel.cp
  const masterCP = CAPAIAN_PEMBELAJARAN[modalMapel.id];
  const initialCP = modalMapel.cp
    ? modalMapel.cp
    : masterCP
      ? { fase: masterCP.fase, deskripsi: masterCP.deskripsi }
      : { fase: "", deskripsi: "" };

  const [cp, setCp] = useState(initialCP);

  const isEdit = !!form.id;
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAddElemen = () => {
    const val = newElemen.trim();
    if (!val || elemen.some(e => e.label === val)) return;
    const newId = val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 20) + `_${Date.now()}`.slice(-4);
    setElemen(p => [...p, { id: newId, label: val }]);
    setNewElemen("");
  };

  const handleDeleteElemen = (idx) => setElemen(p => p.filter((_, i) => i !== idx));
  const handleStartEdit = (idx) => { setEditIdx(idx); setEditVal(elemen[idx].label); };
  const handleSaveEdit = (idx) => {
    const val = editVal.trim();
    if (!val) return;
    setElemen(p => p.map((e, i) => i === idx ? { ...e, label: val } : e));
    setEditIdx(null); setEditVal("");
  };

  // CP handlers
  const handleSaveEditCp = (idx) => {
    const val = editCpVal.trim();
    if (!val) return;
    setEditCpIdx(null); setEditCpVal("");
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(26,35,50,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1200, backdropFilter: "blur(4px)"
    }} onClick={() => setModalMapel(null)}>
      <div className="bounce-in" onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 16, padding: 28, width: 560, maxHeight: "90vh",
          overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.2)"
        }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, marginBottom: 4 }}>
          {isEdit ? "✏️ Edit Mata Pelajaran" : "📋 Tambah Mata Pelajaran Baru"}
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginBottom: 20 }}>SR Kota Malang</div>

        {/* Nama */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: "block", marginBottom: 5 }}>Nama Mata Pelajaran *</label>
          <input value={form.label} onChange={e => setF("label", e.target.value)} placeholder="Contoh: Matematika"
            style={{ ...INP }}
            onFocus={e => e.target.style.borderColor = C.teal}
            onBlur={e => e.target.style.borderColor = C.tealXL} />
        </div>

        {/* Ikon */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: "block", marginBottom: 8 }}>Ikon</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ICON_OPTIONS.map(ico => (
              <button key={ico} onClick={() => setF("icon", ico)}
                style={{
                  width: 34, height: 34, fontSize: FS.h2, borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  border: form.icon === ico ? `2px solid ${C.teal}` : `1px solid ${C.tealXL}`,
                  background: form.icon === ico ? C.tealXL : C.white
                }}>{ico}</button>
            ))}
          </div>
        </div>

        {/* Warna */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: "block", marginBottom: 8 }}>Warna</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c.value} onClick={() => setF("color", c.value)}
                style={{
                  padding: "4px 10px", borderRadius: 99, fontSize: FS.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  background: c.value + "18", color: c.value,
                  border: form.color === c.value ? `2px solid ${c.value}` : `1px solid ${c.value}44`
                }}>{c.label}</button>
            ))}
          </div>
        </div>

        {/* ─── Capaian Pembelajaran CRUD ─────────────────────────────── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            paddingBottom: 10, borderBottom: `1.5px solid ${C.tealXL}`
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: 7, background: `${form.color || C.teal}18`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
            }}>🎯</span>
            <div>
              <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>Capaian Pembelajaran</div>
              <div style={{ fontSize: FS.xs, color: C.slate }}>Fase dan deskripsi capaian pembelajaran</div>
            </div>
          </div>

          {/* Fase */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Fase</label>
            <input
              value={cp.fase}
              onChange={e => setCp(p => ({ ...p, fase: e.target.value }))}
              placeholder="Contoh: Fase E (Kelas X)"
              style={{ ...INP }}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.tealXL}
            />
          </div>

          {/* Deskripsi */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: FS.xs, fontWeight: 700, color: C.slate, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Deskripsi Umum CP</label>
            <textarea
              value={cp.deskripsi}
              onChange={e => setCp(p => ({ ...p, deskripsi: e.target.value }))}
              placeholder="Deskripsikan capaian pembelajaran secara umum untuk mapel ini..."
              rows={3}
              style={{
                ...INP, resize: "vertical", lineHeight: 1.6,
                fontFamily: "inherit", minHeight: 72
              }}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.tealXL}
            />
          </div>


        </div>

        {/* CRUD Elemen ATP */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: FS.sm, fontWeight: 700, color: C.dark, display: "block", marginBottom: 3 }}>
              🧩 Daftar Elemen ATP{" "}
              <span style={{ fontWeight: 400, color: C.slate }}>({elemen.length} elemen)</span>
            </label>
            <div style={{ fontSize: FS.xs, color: C.slate, lineHeight: 1.5 }}>
              Elemen sudah terisi sesuai Kurikulum Merdeka — admin dapat mengedit sesuai kebutuhan sekolah.
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input
              value={newElemen}
              onChange={e => setNewElemen(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddElemen(); } }}
              placeholder="Nama elemen baru, tekan Enter..."
              style={{ ...INP, flex: 1 }}
              onFocus={e => e.target.style.borderColor = C.teal}
              onBlur={e => e.target.style.borderColor = C.tealXL}
            />
            <button
              onClick={handleAddElemen}
              disabled={!newElemen.trim()}
              style={{
                padding: "9px 14px", borderRadius: 9, border: "none",
                background: newElemen.trim() ? C.teal : C.tealXL,
                color: newElemen.trim() ? C.white : C.slate,
                fontWeight: 700, fontSize: FS.md, cursor: newElemen.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit", flexShrink: 0, transition: "all .15s"
              }}>+ Tambah</button>
          </div>

          {elemen.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "20px", background: C.white,
              borderRadius: 10, fontSize: FS.md, color: C.slate, border: `1.5px dashed ${C.tealXL}`
            }}>
              Belum ada elemen. Tambahkan elemen ATP di atas.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {elemen.map((el, idx) => (
                <div key={el.id || idx} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: C.white, borderRadius: 8, padding: "8px 10px",
                  border: `1px solid ${C.tealXL}`
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 6, background: form.color + "18",
                    color: form.color, fontSize: FS.xs, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>{idx + 1}</span>

                  {editIdx === idx ? (
                    <input
                      value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") handleSaveEdit(idx);
                        if (e.key === "Escape") { setEditIdx(null); setEditVal(""); }
                      }}
                      style={{ flex: 1, padding: "4px 8px", border: `1.5px solid ${C.teal}`, borderRadius: 6, fontSize: FS.md, outline: "none", fontFamily: "inherit" }}
                      autoFocus
                    />
                  ) : (
                    <span style={{ flex: 1, fontSize: FS.md, color: C.dark }}>{el.label || el}</span>
                  )}

                  {editIdx === idx ? (
                    <>
                      <button onClick={() => handleSaveEdit(idx)} style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: C.teal, color: C.white, fontSize: FS.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✓</button>
                      <button onClick={() => { setEditIdx(null); setEditVal(""); }} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.tealXL}`, background: C.white, color: C.slate, fontSize: FS.sm, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleStartEdit(idx)} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.tealXL}`, background: C.white, color: C.teal, fontSize: FS.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✏️</button>
                      <button onClick={() => handleDeleteElemen(idx)} style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.redL}`, background: C.white, color: C.red, fontSize: FS.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={() => setModalMapel(null)} style={{ flex: 1, fontSize: FS.md, justifyContent: "center" }}>Batal</Btn>
          <Btn variant="amber" onClick={() => saveMapelLocal({ ...form, elemen, cp })} disabled={!form.label.trim()}
            style={{ flex: 2, fontSize: FS.md, justifyContent: "center" }}>
            {isEdit ? "💾 Simpan Perubahan" : "✅ Tambah Mapel"}
          </Btn>
        </div>
      </div>
    </div>
  );
};

/* ── PageKurikulum ───────────────────────────────────────────────── */
const PageKurikulum = ({ mapelList, kelasList, guruList, setMapelList, setGuruList, showToast }) => {
  const [selectedJenjang, setSelectedJenjang] = useState("X");
  const [selectedKurikulum, setSelectedKurikulum] = useState("merdeka");
  const [modalMapel, setModalMapel] = useState(null);
  const [konfirmHapus, setKonfirmHapus] = useState(null);

  const emptyMapel = { label: "", icon: "📗", color: "#0D5C63", jamPerMinggu: 2, tipe: "Wajib", elemen: [] };

  const saveMapelLocal = (data) => {
    if (data.id) {
      setMapelList(p => p.map(m => m.id === data.id ? { ...m, ...data } : m));
      showToast(`✅ Mapel ${data.label} diperbarui`);
    } else {
      const newId = data.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 10) + `_${Date.now()}`.slice(-4);
      setMapelList(p => [...p, { ...data, id: newId, jenjang: selectedJenjang }]);
      showToast(`✅ Mapel ${data.label} ditambahkan ke Kelas ${selectedJenjang}`);
    }
    setModalMapel(null);
  };

  const hapusMapel = (id) => {
    const m = mapelList.find(x => x.id === id);
    const dipakaiDi = kelasList.filter(k => (k.mapelGuruMap || {})[id]);
    if (dipakaiDi.length > 0) {
      showToast(`⚠ ${m?.label} masih dipakai di: ${dipakaiDi.map(k => k.nama).join(", ")}`, C.red);
      setKonfirmHapus(null); return;
    }
    setMapelList(p => p.filter(x => x.id !== id));
    if (setGuruList) setGuruList(p => p.map(g => ({ ...g, mapelId: g.mapelId.filter(mid => mid !== id) })));
    showToast(`🗑 ${m?.label} dihapus dari kurikulum`, C.red);
    setKonfirmHapus(null);
  };

  const mapelUsage = (mapelId) => kelasList.filter(k => Object.keys(k.mapelGuruMap || {}).includes(mapelId));
  const mapelJenjang = mapelList.filter(m => (m.jenjang || "X") === selectedJenjang);

  return (
    <div className="admin-page-scroll" style={{ padding: "20px 24px", background: C.bg }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: 22, fontWeight: 600, color: C.dark }}>
          📋 Kurikulum Sekolah Rakyat
        </div>
        <div style={{ fontSize: FS.md, color: C.slate, marginTop: 3 }}>
          SR Kota Malang · {mapelList.length} mata pelajaran terdaftar
        </div>
      </div>

      <PilihKurikulum selectedKurikulum={selectedKurikulum} setSelectedKurikulum={setSelectedKurikulum} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Jenjang</div>
        <div style={{ display: "flex", gap: 8 }}>
          {JENJANG_LIST.map(j => (
            <button key={j.id} onClick={() => setSelectedJenjang(j.id)}
              style={{
                padding: "8px 18px", borderRadius: 99, fontFamily: "inherit",
                fontSize: FS.base, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                border: selectedJenjang === j.id ? `2px solid ${C.teal}` : `1.5px solid ${C.tealXL}`,
                background: selectedJenjang === j.id ? `${C.teal}12` : C.white,
                color: selectedJenjang === j.id ? C.teal : C.darkL
              }}>
              {j.label}
              {(mapelList.filter(m => (m.jenjang || "X") === j.id)).length > 0 && (
                <span style={{
                  marginLeft: 6, fontSize: FS.xs, padding: "1px 6px", borderRadius: 99,
                  background: selectedJenjang === j.id ? C.teal : C.tealXL,
                  color: selectedJenjang === j.id ? C.white : C.teal
                }}>
                  {mapelList.filter(m => (m.jenjang || "X") === j.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>Daftar Mapel — Kelas {selectedJenjang}</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{mapelJenjang.length} mata pelajaran</div>
          </div>
          <Btn variant="primary" onClick={() => setModalMapel({ ...emptyMapel, jenjang: selectedJenjang })} style={{ fontSize: 12 }}>
            + Tambah Mapel Kelas {selectedJenjang}
          </Btn>
        </div>

        {selectedJenjang !== "X" && mapelJenjang.length === 0 ? (
          <div style={{ background: C.white, border: `1.5px dashed ${C.tealXL}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: .3 }}>📋</div>
            <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Kurikulum Kelas {selectedJenjang} Belum Tersedia</div>
            <div style={{ fontSize: FS.sm, color: C.slate }}>Tambah mapel untuk jenjang ini atau salin dari Kelas X.</div>
          </div>
        ) : mapelJenjang.length === 0 ? (
          <EmptyState icon="📋" title="Belum ada mata pelajaran" sub="Tambah mata pelajaran untuk jenjang ini">
            <Btn variant="primary" onClick={() => setModalMapel({ ...emptyMapel, jenjang: selectedJenjang })} style={{ marginTop: 14 }}>+ Tambah Mata Pelajaran</Btn>
          </EmptyState>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {mapelJenjang.map(m => {
              const usage = mapelUsage(m.id);
              const elemenArr = m.elemen || KURIKULUM_ELEMEN[m.id] || [];
              const elemenCount = elemenArr.length;
              return (
                <Card key={m.id} style={{ padding: "16px", transition: "transform .2s,box-shadow .2s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(13,92,99,.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(26,35,50,.07)"; }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: m.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS.h1, flexShrink: 0 }}>{m.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: FS.lg, color: C.dark }}>{m.label}</div>
                      <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: m.color + "12", color: m.color, borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>
                          🧩 {elemenCount} elemen
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: C.tealXL, color: C.teal, borderRadius: 99, padding: "2px 8px", fontWeight: 600 }}>
                          🏫 {usage.length} kelas
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setModalMapel({ ...emptyMapel, ...m, elemen: elemenArr })}
                      style={{ flex: 1, padding: "7px", background: C.tealXL, border: "none", borderRadius: 8, fontSize: FS.md, color: C.teal, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>✏️ Edit</button>
                    <button onClick={() => setKonfirmHapus(m.id)}
                      style={{ padding: "7px 12px", background: C.redL, border: "none", borderRadius: 8, fontSize: FS.md, color: C.red, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {modalMapel && (
        <ModalMapel modalMapel={modalMapel} setModalMapel={setModalMapel} saveMapelLocal={saveMapelLocal} />
      )}

      {konfirmHapus && (() => {
        const m = mapelList.find(x => x.id === konfirmHapus);
        const usedIn = mapelUsage(konfirmHapus);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(26,35,50,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, backdropFilter: "blur(4px)" }} onClick={() => setKonfirmHapus(null)}>
            <div className="bounce-in" onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 14, padding: 26, width: 380, boxShadow: "0 24px 60px rgba(0,0,0,.2)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontFamily: FONTS.serif, fontSize: FS.h3, fontWeight: 600, color: C.dark, marginBottom: 8 }}>Hapus {m?.label}?</div>
              {usedIn.length > 0 ? (
                <div style={{ background: C.redL, borderRadius: 9, padding: "10px 12px", marginBottom: 14, fontSize: FS.md, color: C.red }}>
                  ⚠ Mapel ini masih digunakan di {usedIn.length} kelas: {usedIn.map(k => k.nama).join(", ")}.<br />Hapus dari kelas tersebut terlebih dahulu.
                </div>
              ) : (
                <div style={{ fontSize: FS.base, color: C.darkL, marginBottom: 16, lineHeight: 1.6 }}>
                  Mapel beserta seluruh elemen ATP-nya akan dihapus dari kurikulum.
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <Btn variant="ghost" onClick={() => setKonfirmHapus(null)} style={{ flex: 1, justifyContent: "center" }}>Batal</Btn>
                {usedIn.length === 0 && (
                  <Btn variant="danger" onClick={() => hapusMapel(konfirmHapus)} style={{ flex: 1, justifyContent: "center" }}>🗑 Hapus</Btn>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default PageKurikulum;