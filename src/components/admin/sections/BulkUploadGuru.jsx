/**
 * SR MVP — Admin: Bulk Upload Guru — REVISED
 *
 * Perubahan:
 *  - Kolom Mapel bisa diedit (MultiSelectMapel inline di tabel review)
 *  - Layout panel disesuaikan dengan lebar konten tabel
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Btn } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { INP_STYLE, ADMIN_SEKOLAH } from './adminUtils';

const MAX_MB = 5;
const ACCEPTED = '.xlsx,.xls,.csv';
const STEP = { IDLE: 'idle', PARSING: 'parsing', REVIEW: 'review', SAVING: 'saving', DONE: 'done', ERROR: 'error' };

const COL_ALIAS = {
  nama: ['nama', 'nama lengkap', 'name', 'full name'],
  nip: ['nip', 'no induk pegawai', 'nomor induk pegawai'],
  email: ['email', 'e-mail', 'alamat email'],
  mapel: ['mapel', 'mata pelajaran', 'subject', 'pelajaran'],
  kelas: ['kelas', 'class', 'kelas yang dipegang'],
  status: ['status'],
  bergabung: ['bergabung', 'tanggal bergabung', 'join date', 'mulai'],
};

const fmtSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const PALS = [C.teal, C.tealL, C.amber, C.purple, '#2F855A', C.orange];
const avatarBg = (n = '') => { let h = 0; for (const c of n) h = (h + c.charCodeAt(0)) % PALS.length; return `linear-gradient(135deg,${PALS[h]},${PALS[(h + 2) % PALS.length]})`; };
const initials = (n = '') => { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); };
const resolveCol = (headers, aliases) => headers.find(h => aliases.includes(h.toLowerCase().trim())) ?? null;

const genTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const sep = lines[0].includes(';') ? ';' : ',';
  const parse = (line) => {
    const cols = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { inQ = !inQ; continue; } if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ''; continue; } cur += ch; }
    cols.push(cur.trim()); return cols;
  };
  const headers = parse(lines[0]);
  return lines.slice(1).map(line => { const v = parse(line); return Object.fromEntries(headers.map((h, i) => [h, v[i] ?? ''])); });
}

const mapRow = (row, colMap, mapelList, kelasList) => {
  const get = (key) => (colMap[key] ? (row[colMap[key]] ?? '') : '').toString().trim();
  const nama = get('nama'); if (!nama) return null;
  const mapelId = get('mapel').split(/[,;|\/]/).map(s => s.trim().toLowerCase()).reduce((acc, token) => {
    const f = mapelList.find(m => m.label.toLowerCase() === token || m.id === token || m.label.toLowerCase().includes(token) || token.includes(m.id));
    if (f && !acc.includes(f.id)) acc.push(f.id); return acc;
  }, []);
  const kelasId = get('kelas').split(/[,;|\/]/).map(s => s.trim().toLowerCase()).reduce((acc, token) => {
    const f = kelasList.find(k => k.nama.toLowerCase() === token || k.id === token || k.nama.toLowerCase().replace('kelas ', '') === token);
    if (f && !acc.includes(f.id)) acc.push(f.id); return acc;
  }, []);
  const rawSt = get('status').toLowerCase();
  return {
    nama, nip: get('nip'), email: get('email'), bergabung: get('bergabung'),
    mapelId, mapelKelasMap: Object.fromEntries(mapelId.map(mid => [mid, kelasId])), kelasId,
    status: rawSt.includes('non') || rawSt.includes('tidak') || rawSt === '0' ? 'Non-Aktif' : 'Aktif',
    avatar: initials(nama), avatarBg: avatarBg(nama), _tempPassword: genTempPassword()
  };
};

async function parseFile(file, mapelList, kelasList) {
  const ext = file.name.split('.').pop().toLowerCase();
  let rawRows = [];
  if (['xlsx', 'xls'].includes(ext)) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  } else {
    rawRows = parseCSV(await file.text());
  }
  if (!rawRows.length) return [];
  const headers = Object.keys(rawRows[0]);
  const colMap = Object.fromEntries(Object.entries(COL_ALIAS).map(([k, a]) => [k, resolveCol(headers, a)]));
  if (!colMap.nama) throw new Error('Kolom "Nama" tidak ditemukan. Pastikan header sesuai template.');
  return rawRows.map(row => mapRow(row, colMap, mapelList, kelasList)).filter(Boolean);
}

const downloadTemplate = (type = 'csv') => {
  if (type === 'xlsx') {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Lengkap', 'NIP', 'Email', 'Mapel', 'Kelas', 'Status', 'Bergabung'],
      ['Dr. Siti Rahmawati M.Pd.', '197805142005012003', 'siti@sr.sch.id', 'Matematika', 'Kelas 7A', 'Aktif', 'Januari 2023'],
      ['Budi Santoso S.Pd.', '', 'budi@sr.sch.id', 'Bahasa Indonesia', 'Kelas 7B', 'Aktif', 'Maret 2024']
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Guru');
    XLSX.writeFile(wb, 'template_guru.xlsx');
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([
      'Nama Lengkap,NIP,Email,Mapel,Kelas,Status,Bergabung\nDr. Siti Rahmawati M.Pd.,197805142005012003,siti@sr.sch.id,Matematika,Kelas 7A,Aktif,Januari 2023\nBudi Santoso S.Pd.,,budi@sr.sch.id,Bahasa Indonesia,Kelas 7B,Aktif,Maret 2024'
    ], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'template_guru.csv';
    a.click();
  }
};

const downloadKredensialGuru = (savedRows) => {
  const rows = [['Nama Guru', 'NIP', 'Email', 'Password Sementara', 'Status']];
  savedRows.forEach(g => rows.push([g.nama, g.nip || '-', g.email || '-', g._tempPassword || '-', g.status || 'Aktif']));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kredensial Guru');
  XLSX.writeFile(wb, `kredensial_guru_${new Date().getFullYear()}.xlsx`);
};

/* ── MapelSelector — inline di tabel review ──────────────────────── */
const MapelSelector = ({ rowId, mapelId = [], mapelList, onChangeMapel }) => {
  const [open, setOpen] = useState(false);

  const toggle = (mid) => {
    const next = mapelId.includes(mid) ? mapelId.filter(x => x !== mid) : [...mapelId, mid];
    onChangeMapel(rowId, next);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(p => !p)}
        style={{
          background: open ? C.tealXL : C.bg, border: `1.5px solid ${open ? C.teal : C.tealXL}`,
          borderRadius: 8, padding: '4px 8px', fontSize: FS.sm, color: C.teal, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          minWidth: 100, flexWrap: 'wrap'
        }}>
        {mapelId.length === 0
          ? <span style={{ color: C.slate, fontStyle: 'italic' }}>Pilih mapel...</span>
          : mapelId.map(mid => {
            const m = mapelList.find(x => x.id === mid);
            return m ? (
              <span key={mid} style={{ fontSize: FS.xs, padding: '1px 6px', borderRadius: 99, background: m.color + '18', color: m.color, fontWeight: 700 }}>
                {m.icon} {m.label}
              </span>
            ) : null;
          })
        }
        <span style={{ marginLeft: 'auto', fontSize: FS.xs, opacity: .6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 100, top: '100%', left: 0, marginTop: 4,
          background: C.white, border: `1.5px solid ${C.tealXL}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 8, minWidth: 200
        }}>
          {mapelList.map(m => (
            <label key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7,
              cursor: 'pointer', fontSize: FS.md, color: C.dark,
              background: mapelId.includes(m.id) ? `${m.color}10` : 'transparent'
            }}>
              <input type="checkbox" checked={mapelId.includes(m.id)} onChange={() => toggle(m.id)}
                style={{ accentColor: m.color, width: 14, height: 14 }} />
              <span style={{ fontSize: 14 }}>{m.icon}</span>
              <span style={{ fontWeight: mapelId.includes(m.id) ? 700 : 400, color: mapelId.includes(m.id) ? m.color : C.dark }}>{m.label}</span>
            </label>
          ))}
          <div style={{ borderTop: `1px solid ${C.tealXL}`, marginTop: 6, paddingTop: 6, textAlign: 'right' }}>
            <button onClick={() => setOpen(false)}
              style={{ background: C.teal, border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: FS.sm, color: C.white, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════ */
const BulkUploadGuru = ({ mapelList = [], kelasList = [], onBulkSave, _externalOpen = false, _onExternalClose }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(STEP.IDLE);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [rows, setRows] = useState([]);
  const [errMsg, setErrMsg] = useState('');
  const [savedCount, setSaved] = useState(0);
  const [savedRows, setSavedRows] = useState([]);
  const fileRef = useRef();

  useEffect(() => { if (_externalOpen) setOpen(true); }, [_externalOpen]);

  const reset = () => { setStep(STEP.IDLE); setFile(null); setRows([]); setErrMsg(''); setSaved(0); setSavedRows([]); };
  const handleClose = () => { setOpen(false); reset(); _onExternalClose?.(); };

  const pickFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) { setErrMsg('Gunakan .xlsx atau .csv'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErrMsg(`Ukuran melebihi ${MAX_MB} MB`); return; }
    setErrMsg(''); setFile(f);
  }, []);

  const onDrop = (e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]); };

  const handleParse = async () => {
    if (!file) return; setStep(STEP.PARSING); setErrMsg('');
    try {
      const parsed = await parseFile(file, mapelList, kelasList);
      if (!parsed.length) { setErrMsg('Tidak ada data guru yang terbaca. Periksa format kolom.'); setStep(STEP.ERROR); return; }
      setRows(parsed.map((g, i) => ({ ...g, _id: `bg-${i}`, _checked: true }))); setStep(STEP.REVIEW);
    } catch (e) { setErrMsg(e.message); setStep(STEP.ERROR); }
  };

  const upd = (id, k, v) => setRows(p => p.map(r => r._id === id ? { ...r, [k]: v } : r));
  const updMapel = (id, newMapelIds) => setRows(p => p.map(r => r._id === id
    ? { ...r, mapelId: newMapelIds, mapelKelasMap: Object.fromEntries(newMapelIds.map(mid => [mid, r.mapelKelasMap?.[mid] || r.kelasId || []])) }
    : r));
  const toggleRow = (id) => setRows(p => p.map(r => r._id === id ? { ...r, _checked: !r._checked } : r));
  const toggleAll = () => { const on = rows.every(r => r._checked); setRows(p => p.map(r => ({ ...r, _checked: !on }))); };

  const handleSave = async () => {
    const sel = rows.filter(r => r._checked); if (!sel.length) return;
    setStep(STEP.SAVING);
    try {
      const finalRows = sel.map(({ _id, _checked, ...rest }) => rest);
      await onBulkSave(finalRows);
      setSaved(sel.length); setSavedRows(finalRows); setStep(STEP.DONE);
    } catch (e) { setErrMsg(e.message); setStep(STEP.ERROR); }
  };

  const checkedCount = rows.filter(r => r._checked).length;

  // Panel lebar adaptif: REVIEW pakai lebar lebih besar untuk akomodasi tabel
  const panelWidth = step === STEP.REVIEW ? 'min(780px, 100vw)' : 'min(500px, 96vw)';

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.45)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 1300, backdropFilter: 'blur(3px)' }}
      onClick={[STEP.REVIEW, STEP.PARSING].includes(step) ? undefined : handleClose}>
      <div className="slide-right" onClick={e => e.stopPropagation()}
        style={{ width: panelWidth, height: '100vh', background: C.white, boxShadow: '-12px 0 48px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', transition: 'width .25s cubic-bezier(.4,0,.2,1)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark }}>📂 Import Data Guru</div>
            <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>{ADMIN_SEKOLAH.nama} · {ADMIN_SEKOLAH.tahunAjaran}</div>
          </div>
          {![STEP.PARSING, STEP.SAVING].includes(step) && (
            <button onClick={handleClose} style={{ background: 'transparent', border: `1.5px solid ${C.tealXL}`, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
          )}
        </div>

        {/* IDLE / ERROR */}
        {[STEP.IDLE, STEP.ERROR].includes(step) && (
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <div style={{ background: `${C.teal}07`, border: `1.5px solid ${C.tealXL}`, borderRadius: 12, padding: '12px 16px', fontSize: FS.md, color: C.darkL, lineHeight: 1.75 }}>
              <div style={{ fontWeight: 700, color: C.teal, marginBottom: 6 }}>📋 Format Kolom</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                {[['Nama Lengkap', 'wajib'], ['NIP', 'opsional'], ['Email', 'wajib'], ['Mapel', 'opsional, pisah koma'], ['Kelas', 'opsional, pisah koma'], ['Status', 'opsional'], ['Bergabung', 'opsional']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, color: C.dark, minWidth: 90 }}>{k}</span>
                    <span style={{ fontSize: FS.xs, color: C.slate }}>— {v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.tealXL}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: FS.sm, color: C.slate }}>Download template:</span>
                {['csv', 'xlsx'].map(t => (
                  <button key={t} onClick={() => downloadTemplate(t)}
                    style={{ background: 'none', border: `1px solid ${C.teal}`, borderRadius: 6, padding: '2px 10px', fontSize: FS.sm, color: C.teal, cursor: 'pointer', fontWeight: 600 }}>
                    ⬇ {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${drag ? C.teal : C.tealXL}`, borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? `${C.teal}06` : C.bg, transition: 'all .18s' }}>
              <input ref={fileRef} type="file" accept={ACCEPTED} onChange={e => pickFile(e.target.files?.[0])} style={{ display: 'none' }} />
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: FS.lg, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{file ? file.name : 'Klik atau drag & drop file di sini'}</div>
              <div style={{ fontSize: FS.sm, color: C.slate }}>{file ? fmtSize(file.size) : `xlsx · csv · maks ${MAX_MB} MB`}</div>
            </div>

            {file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: `${C.teal}08`, borderRadius: 10, border: `1.5px solid ${C.tealXL}` }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: FS.base, color: C.dark }}>{file.name}</div>
                  <div style={{ fontSize: FS.sm, color: C.slate }}>{fmtSize(file.size)}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); setFile(null); setErrMsg(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: FS.xl, color: C.slate }}>✕</button>
              </div>
            )}

            {errMsg && <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 10, padding: '10px 14px', fontSize: FS.md, color: C.red }}>⚠️ {errMsg}</div>}
            <Btn variant="primary" onClick={handleParse} disabled={!file} style={{ justifyContent: 'center', fontSize: 13 }}>📊 Baca File</Btn>
          </div>
        )}

        {/* PARSING */}
        {step === STEP.PARSING && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontSize: 44, animation: 'spin 1s linear infinite' }}>⚙️</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>Membaca file…</div>
            <div style={{ fontSize: FS.md, color: C.slate }}>{file?.name}</div>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* REVIEW */}
        {step === STEP.REVIEW && (
          <>
            <div style={{ padding: '10px 20px', borderBottom: `1px solid rgba(13,92,99,.06)`, display: 'flex', alignItems: 'center', gap: 10, background: `${C.teal}04`, flexShrink: 0 }}>
              <div style={{ flex: 1, fontSize: FS.md, color: C.dark }}>Ditemukan <b style={{ color: C.teal }}>{rows.length} baris</b> · Periksa & edit jika perlu (termasuk kolom Mapel)</div>
              <Btn variant="soft" onClick={toggleAll} style={{ fontSize: 11 }}>{rows.every(r => r._checked) ? '✗ Batal Semua' : '✓ Pilih Semua'}</Btn>
              <Btn variant="soft" onClick={() => setRows(p => p.map(r => ({ ...r, _tempPassword: genTempPassword() })))} style={{ fontSize: 11 }} title="Generate ulang semua password">↻ Pwd</Btn>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                  <tr style={{ background: C.teal }}>
                    {['✓', 'Nama Lengkap', 'NIP', 'Email', 'Mapel', 'Pwd Temp', 'Status'].map(h => (
                      <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700, color: C.white, textTransform: 'uppercase', letterSpacing: .6, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r._id} style={{ borderTop: `1px solid rgba(13,92,99,.05)`, background: r._checked ? C.white : '#FAFAFA', opacity: r._checked ? 1 : .5, transition: 'all .15s' }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={r._checked} onChange={() => toggleRow(r._id)} style={{ width: 15, height: 15, accentColor: C.teal, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '7px 8px', minWidth: 160 }}>
                        <input value={r.nama} onChange={e => upd(r._id, 'nama', e.target.value)}
                          style={{ ...INP_STYLE, padding: '5px 8px', fontSize: 12 }}
                          onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
                      </td>
                      <td style={{ padding: '7px 8px', minWidth: 120 }}>
                        <input value={r.nip || ''} onChange={e => upd(r._id, 'nip', e.target.value.replace(/\D/g, ''))}
                          maxLength={18}
                          style={{ ...INP_STYLE, padding: '5px 8px', fontSize: FS.sm, fontFamily: 'monospace' }}
                          onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
                      </td>
                      <td style={{ padding: '7px 8px', minWidth: 155 }}>
                        <input value={r.email || ''} onChange={e => upd(r._id, 'email', e.target.value)}
                          style={{ ...INP_STYLE, padding: '5px 8px', fontSize: 12 }}
                          onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
                      </td>
                      {/* Kolom Mapel — EDITABLE */}
                      <td style={{ padding: '7px 8px', minWidth: 180 }}>
                        <MapelSelector
                          rowId={r._id}
                          mapelId={r.mapelId || []}
                          mapelList={mapelList}
                          onChangeMapel={updMapel}
                        />
                      </td>
                      <td style={{ padding: '7px 8px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <code style={{ fontSize: FS.sm, fontFamily: 'monospace', fontWeight: 700, color: C.dark, background: `${C.teal}0D`, padding: '3px 7px', borderRadius: 6, letterSpacing: .5, userSelect: 'all' }}>
                            {r._tempPassword}
                          </code>
                        </div>
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <select value={r.status || 'Aktif'} onChange={e => upd(r._id, 'status', e.target.value)}
                          style={{ ...INP_STYLE, padding: '5px 8px', fontSize: 11 }}>
                          <option value="Aktif">Aktif</option>
                          <option value="Non-Aktif">Non-Aktif</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid rgba(13,92,99,.08)`, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ flex: 1, fontSize: FS.md, color: C.slate }}><b style={{ color: C.dark }}>{checkedCount}</b> dari {rows.length} baris dipilih</div>
              <Btn variant="ghost" onClick={() => { setStep(STEP.IDLE); setRows([]); }} style={{ fontSize: 12 }}>← Ulangi</Btn>
              <Btn variant="amber" onClick={handleSave} disabled={checkedCount === 0} style={{ fontSize: FS.md, justifyContent: 'center' }}>
                ✅ Simpan {checkedCount > 0 ? `(${checkedCount})` : ''}
              </Btn>
            </div>
          </>
        )}

        {/* SAVING */}
        {step === STEP.SAVING && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>💾</div>
            <div style={{ fontWeight: 700, color: C.dark }}>Menyimpan…</div>
          </div>
        )}

        {/* DONE */}
        {step === STEP.DONE && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, textAlign: 'center' }}>
              {savedCount} guru berhasil ditambahkan
            </div>
            <div style={{ fontSize: FS.md, color: C.slate, textAlign: 'center', lineHeight: 1.7 }}>
              Password unik per guru telah digenerate.<br />
              Unduh XLSX untuk menyimpan kredensial sebelum menutup.
            </div>

            <div style={{ width: '100%', maxHeight: 220, overflowY: 'auto', border: `1px solid ${C.tealXL}`, borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0 }}>
                  <tr style={{ background: C.teal }}>
                    {['Nama', 'Email', 'Pwd Temp'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700, color: C.white, textTransform: 'uppercase', letterSpacing: .5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {savedRows.map((g, i) => (
                    <tr key={i} style={{ borderTop: `1px solid rgba(13,92,99,.06)`, background: i % 2 === 0 ? C.white : `${C.teal}04` }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600, color: C.dark }}>{g.nama}</td>
                      <td style={{ padding: '6px 10px', color: C.slate, fontSize: 10 }}>{g.email || g.nip || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <code style={{ fontSize: FS.sm, fontFamily: 'monospace', fontWeight: 800, color: C.teal, letterSpacing: .5, userSelect: 'all' }}>{g._tempPassword}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <Btn variant="soft" onClick={() => downloadKredensialGuru(savedRows)} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                📥 Download XLSX
              </Btn>
              <Btn variant="primary" onClick={handleClose} style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>Selesai</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkUploadGuru;
