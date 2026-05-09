/**
 * SR MVP — Admin Shared Utilities & Micro-Components
 */
import { useState } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';
import { kelasDetailApi } from '../../../api/admin';

export const ADMIN_SEKOLAH = {
  nama: "SR Kota Malang", kota: "Malang", provinsi: "Jawa Timur",
  kepalaSekolah: "Dr. Bambang Sudiro, M.Pd.", email: "admin@sr-malang.sch.id",
  tahunAjaran: "2025/2026", akreditasi: "A",
};

export const INP_STYLE = {
  width: "100%", padding: "9px 12px", border: `1.5px solid ${C.tealXL}`,
  borderRadius: 9, fontSize: FS.base, outline: "none", background: C.white,
  fontFamily: "inherit", transition: "border-color .2s",
};

export const StatusBadge = ({ status }) => {
  const cfg = {
    "Aktif": { bg: C.greenL, color: C.green },
    "Cuti": { bg: C.amberL, color: C.orange },
    "Nonaktif": { bg: "#EDF2F7", color: C.slate },
    "Keluar": { bg: C.redL, color: C.red },
  }[status] || { bg: "#EDF2F7", color: C.slate };
  return (
    <span style={{
      fontSize: FS.xs, padding: "2px 8px", borderRadius: 99, fontWeight: 700,
      background: cfg.bg, color: cfg.color, whiteSpace: "nowrap"
    }}>{status}</span>
  );
};

export const MultiCheckbox = ({ items, selected, onChange, labelKey = "label", idKey = "id" }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {items.map(item => {
      const isOn = selected.includes(item[idKey]);
      return (
        <button key={item[idKey]}
          onClick={() => onChange(isOn ? selected.filter(x => x !== item[idKey]) : [...selected, item[idKey]])}
          style={{
            padding: "4px 10px", borderRadius: 99, fontSize: FS.sm, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${isOn ? C.teal : C.tealXL}`,
            background: isOn ? C.tealXL : C.white, color: isOn ? C.teal : C.slate,
            transition: "all .15s",
          }}>
          {item[labelKey]}
        </button>
      );
    })}
  </div>
);

export const FormTambahMapel = ({ k, kelasId, mapelList, guruList, getMapel, getGuru, setKelasList, showToast, onDone }) => {
  const [pilihMapel, setPilihMapel] = useState("");
  const [pilihGuru, setPilihGuru] = useState("");
  const sudahAda = Object.keys(k.mapelGuruMap || {});
  const tersedia = mapelList.filter(m => !sudahAda.includes(m.id));
  const guruUntuk = pilihMapel ? guruList.filter(g => (g.mapel_ids || []).includes(pilihMapel) && g.status === "Aktif") : [];
  return (
    <div style={{ padding: "12px 16px", background: C.tealXL, borderBottom: `1px solid rgba(13,92,99,.1)` }}>
      <div style={{ fontSize: FS.sm, fontWeight: 700, color: C.teal, marginBottom: 8 }}>➕ Tambah Mapel ke Kelas Ini</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: FS.xs, color: C.teal, fontWeight: 600, display: "block", marginBottom: 4 }}>Pilih Mapel</label>
          <select value={pilihMapel} onChange={e => { setPilihMapel(e.target.value); setPilihGuru(""); }}
            style={{ ...INP_STYLE, padding: "7px 10px", fontSize: 12 }}>
            <option value="">— Pilih mapel —</option>
            {tersedia.map(m => <option key={m.id} value={m.id}>{m.icon} {m.label}</option>)}
            {tersedia.length === 0 && <option disabled>Semua mapel sudah ditetapkan</option>}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: FS.xs, color: C.teal, fontWeight: 600, display: "block", marginBottom: 4 }}>Guru (opsional)</label>
          <select value={pilihGuru} onChange={e => setPilihGuru(e.target.value)}
            style={{ ...INP_STYLE, padding: "7px 10px", fontSize: 12 }} disabled={!pilihMapel}>
            <option value="">— Tanpa guru dulu —</option>
            {guruUntuk.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
            {pilihMapel && guruUntuk.length === 0 && <option disabled>Belum ada guru mapel ini</option>}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled={!pilihMapel}
            onClick={async () => {
              const mapelLabel = getMapel(pilihMapel)?.label || pilihMapel;
              const guruLabel = pilihGuru ? getGuru(pilihGuru)?.nama : null;
              try {
                await kelasDetailApi.addMapel(kelasId, { mapel_id: pilihMapel, guru_id: pilihGuru || null });
              } catch { /* Fallback: tetap update local state */ }
              setKelasList(p => p.map(kl => kl.id === kelasId
                ? { ...kl, mapelGuruMap: { ...kl.mapelGuruMap, [pilihMapel]: pilihGuru || "" } } : kl));
              showToast(`✅ ${mapelLabel} ditambahkan ke kelas${guruLabel ? ` · Guru: ${guruLabel}` : ""}`);
              onDone();
            }}
            style={{
              padding: "8px 14px", background: pilihMapel ? C.teal : "#CBD5E0", border: "none",
              borderRadius: 8, color: "#fff", fontSize: FS.md, fontWeight: 700,
              cursor: pilihMapel ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: pilihMapel ? 1 : .6,
            }}>Tambahkan</button>
          <button onClick={onDone} style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontSize: FS.base, fontWeight: 600, fontFamily: "inherit" }}>Batal</button>
        </div>
      </div>
    </div>
  );
};