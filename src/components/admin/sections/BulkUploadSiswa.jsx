/**
 * SR MVP — Admin: Bulk Upload Siswa (Fase 3 · Revised)
 * src/components/admin/sections/BulkUploadSiswa.jsx
 *
 * Alur lengkap:
 *   1. Admin upload CSV (nama, NIS, kelas, email)
 *   2. Sistem generate otomatis:
 *      - Password temporary: digenerate unik per siswa (8 char, alfanumerik)
 *      - 1 enroll key per kelas: "SR-" + kode-kelas + "-" + tahun
 *   3. Status siswa: "Belum Aktif"
 *   4. Admin download/cetak daftar kredensial
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Btn } from '../../shared/UI';
import { C, FONTS, FS } from '../../../styles/tokens';
import { INP_STYLE } from './adminUtils';

const MAX_MB = 5;
const ACCEPTED = '.xlsx,.xls,.csv';
const STEP = { IDLE: 'idle', PARSING: 'parsing', REVIEW: 'review', SAVING: 'saving', DONE: 'done', ERROR: 'error' };
const TAHUN = new Date().getFullYear();

const COL_ALIAS = {
    nama: ['nama', 'nama siswa', 'nama lengkap', 'name', 'full name'],
    nis: ['nis', 'nomor induk siswa', 'no induk', 'nisn', 'nomor siswa'],
    email: ['email', 'e-mail', 'alamat email'],
    kelas: ['kelas', 'class', 'kelas siswa', 'nama kelas'],
};

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmtSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const PALS = [C.teal, C.tealL, C.amber, C.purple, '#2F855A', C.orange, '#C53030'];
const avatarBg = (n = '') => { let h = 0; for (const c of n) h = (h + c.charCodeAt(0)) % PALS.length; return `linear-gradient(135deg,${PALS[h]},${PALS[(h + 2) % PALS.length]})`; };
const initials = (n = '') => { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); };
const resolveCol = (headers, aliases) => headers.find(h => aliases.includes(h.toLowerCase().trim())) ?? null;

/**
 * Password temporary seluruh siswa baru — tetap sama, tidak ditampilkan di UI.
 * Admin tidak perlu tahu nilai ini; hanya dipakai backend saat aktivasi.
 */
/**
 * Generate password sementara unik per siswa — 8 char alfanumerik.
 * Backend akan melakukan hal yang sama; ini hanya untuk preview di UI.
 * Karakter: huruf kapital + kecil + angka, mudah dibaca (tanpa 0/O/l/I).
 */
const genTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/* ── CSV Parser ──────────────────────────────────────────────────────── */
function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
    const sep = lines[0].includes(';') ? ';' : ',';
    const parse = (line) => {
        const cols = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === sep && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
            cur += ch;
        }
        cols.push(cur.trim());
        return cols;
    };
    const headers = parse(lines[0]);
    return lines.slice(1).map(line => {
        const v = parse(line);
        return Object.fromEntries(headers.map((h, i) => [h, v[i] ?? '']));
    });
}

const mapRow = (row, colMap, kelasList) => {
    const get = (key) => (colMap[key] ? (row[colMap[key]] ?? '') : '').toString().trim();
    const nama = get('nama'); if (!nama) return null;
    const rawKelas = get('kelas').toLowerCase();
    const kelasMatch = kelasList.find(k =>
        k.nama.toLowerCase() === rawKelas ||
        k.id === rawKelas ||
        k.nama.toLowerCase().replace('kelas ', '') === rawKelas
    );
    return {
        nama,
        nis: get('nis'),
        email: get('email'),
        kelasId: kelasMatch?.id ?? '',
        kelasNama: kelasMatch?.nama ?? '',
        status: 'Belum Aktif',
        bergabung: `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][new Date().getMonth()]} ${TAHUN}`,
        avatar: initials(nama),
        avatarBg: avatarBg(nama),
        is_first_login: true,
        _kelasRaw: rawKelas && !kelasMatch ? get('kelas') : '',
        _tempPassword: genTempPassword(),
    };
};

async function parseFile(file, kelasList) {
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
    if (!colMap.nis) throw new Error('Kolom "NIS" tidak ditemukan. Pastikan header sesuai template.');
    return rawRows.map(row => mapRow(row, colMap, kelasList)).filter(Boolean);
}

/* ── Download Template ───────────────────────────────────────────────── */
const downloadTemplate = (type = 'csv', kelasList = []) => {
    const firstKelas = kelasList[0]?.nama ?? 'Kelas 7A';
    const secondKelas = kelasList[1]?.nama ?? 'Kelas 7B';
    if (type === 'xlsx') {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nama Siswa', 'NIS', 'Email', 'Kelas'],
            ['Ahmad Fauzi', '2025001', 'ahmad@siswa.sr', firstKelas],
            ['Sari Dewi', '2025002', '', secondKelas],
            ['Budi Hartono', '2025003', 'budi@siswa.sr', firstKelas],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
        XLSX.writeFile(wb, 'template_siswa.xlsx');
    } else {
        const csv = `Nama Siswa,NIS,Email,Kelas\nAhmad Fauzi,2025001,ahmad@siswa.sr,${firstKelas}\nSari Dewi,2025002,,${secondKelas}\nBudi Hartono,2025003,budi@siswa.sr,${firstKelas}`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        a.download = 'template_siswa.csv';
        a.click();
    }
};

/* ── Download Kredensial ─────────────────────────────────────────────── */
const downloadKredensial = (savedRows) => {
    const rows = [['Nama Siswa', 'NIS', 'Email', 'Kelas', 'Password Sementara', 'Status']];
    savedRows.forEach(s => {
        rows.push([
            s.nama,
            s.nis,
            s.email || '-',
            s.kelasNama || s.kelasId,
            s._tempPassword || '-',
            'Belum Aktif',
        ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Style header row: bold + teal background
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let C_ = headerRange.s.c; C_ <= headerRange.e.c; C_++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C_ })];
        if (cell) cell.s = { fill: { fgColor: { rgb: '0D5C63' } }, font: { color: { rgb: 'FFFFFF' }, bold: true } };
    }
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kredensial Siswa');
    XLSX.writeFile(wb, `kredensial_siswa_${TAHUN}.xlsx`);
};

/* ── Cetak Kredensial ────────────────────────────────────────────────── */
const cetakKredensial = (savedRows) => {
    const byKelas = {};
    savedRows.forEach(s => {
        const key = s.kelasId;
        if (!byKelas[key]) byKelas[key] = { nama: s.kelasNama || key, siswa: [] };
        byKelas[key].siswa.push(s);
    });

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Kredensial Siswa — SR ${TAHUN}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; font-size: 12px; color: #1A2332; padding: 20px; }
  h1 { font-size: 16px; color: #0D5C63; margin-bottom: 4px; }
  .subtitle { font-size: 11px; color: #8899AA; margin-bottom: 20px; }
  .kelas-section { margin-bottom: 28px; page-break-inside: avoid; }
  .kelas-header { background: #0D5C63; color: white; padding: 8px 14px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
  .kelas-header h2 { font-size: 13px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #F0F9FA; color: #0D5C63; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; padding: 7px 12px; text-align: left; border: 1px solid #D4F0F3; }
  td { padding: 7px 12px; border: 1px solid #E8F4F5; font-size: 11px; }
  tr:nth-child(even) td { background: #FAFEFF; }
  .pwd { font-family: monospace; font-weight: 700; color: #0D5C63; }
  .badge { display: inline-block; font-size: 9px; padding: 2px 7px; border-radius: 99px; font-weight: 700; background: #FFF8EE; color: #B7791F; border: 1px solid #F6AD55; }
  @media print { @page { margin: 1cm; } .no-print { display: none; } }
  .footer { margin-top: 24px; font-size: 10px; color: #8899AA; text-align: center; border-top: 1px solid #D4F0F3; padding-top: 10px; }
  .instructions { background: #EBF8FF; border: 1px solid #BEE3F8; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 11px; color: #2C5282; line-height: 1.8; }
  .instructions b { font-weight: 700; }
</style>
</head>
<body>
  <h1>🏫 Sekolah Rakyat — Daftar Kredensial Siswa ${TAHUN}</h1>
  <div class="subtitle">Dokumen ini bersifat rahasia. Bagikan hanya kepada siswa yang bersangkutan.</div>
  <div class="instructions">
    <b>Panduan Aktivasi Akun Siswa:</b><br>
    1. Buka aplikasi SR dan login menggunakan <b>Email/NIS</b> + password sementara yang diberikan admin<br>
    2. Sistem akan menampilkan halaman Aktivasi Akun (wajib, tidak dapat dilewati)<br>
    3. Buat password baru (min. 8 karakter + angka)<br>
    4. Pilih 3 mata pelajaran → Akun aktif!
  </div>
  ${Object.values(byKelas).map(({ nama, siswa }) => `
  <div class="kelas-section">
    <div class="kelas-header">
      <h2>📚 ${nama}</h2>
    </div>
    <table>
      <thead><tr>
        <th>No</th><th>Nama Siswa</th><th>NIS</th><th>Email / Login</th>
        <th>Password Sementara</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${siswa.map((s, i) => `<tr>
          <td>${i + 1}</td>
          <td>${s.nama}</td>
          <td style="font-family:monospace">${s.nis}</td>
          <td>${s.email || s.nis}</td>
          <td style="font-family:monospace;font-weight:700;letter-spacing:1px">${s._tempPassword || '-'}</td>
          <td><span class="badge">Belum Aktif</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`).join('')}
  <div class="footer">
    Dibuat otomatis oleh Sistem Sekolah Rakyat &nbsp;·&nbsp; © ${TAHUN} BPSDM Komdigi — AITF
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
};

/* ════════════════════════════════════════════════════════════════════ */
const BulkUploadSiswa = ({ kelasList = [], onBulkSave, _externalOpen = false, _onExternalClose }) => {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(STEP.IDLE);
    const [file, setFile] = useState(null);
    const [drag, setDrag] = useState(false);
    const [rows, setRows] = useState([]);
    const [errMsg, setErrMsg] = useState('');
    const [savedRows, setSavedRows] = useState([]);
    // Modal konfirmasi sebelum simpan
    const [confirmOpen, setConfirmOpen] = useState(false);
    const fileRef = useRef();

    useEffect(() => { if (_externalOpen) setOpen(true); }, [_externalOpen]);

    const reset = () => { setStep(STEP.IDLE); setFile(null); setRows([]); setErrMsg(''); setSavedRows([]); setConfirmOpen(false); };
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
        if (!file) return;
        setStep(STEP.PARSING); setErrMsg('');
        try {
            const parsed = await parseFile(file, kelasList);
            if (!parsed.length) { setErrMsg('Tidak ada data siswa yang terbaca. Periksa format kolom.'); setStep(STEP.ERROR); return; }
            setRows(parsed.map((s, i) => ({ ...s, _id: `bs-${i}`, _checked: true })));
            setStep(STEP.REVIEW);
        } catch (e) { setErrMsg(e.message); setStep(STEP.ERROR); }
    };

    const upd = (id, k, v) => setRows(p => p.map(r => r._id === id ? { ...r, [k]: v } : r));
    const toggleRow = (id) => setRows(p => p.map(r => r._id === id ? { ...r, _checked: !r._checked } : r));
    const toggleAll = () => { const on = rows.every(r => r._checked); setRows(p => p.map(r => ({ ...r, _checked: !on }))); };

    const handleSave = async () => {
        const sel = rows.filter(r => r._checked);
        if (!sel.length) return;
        setConfirmOpen(false);
        setStep(STEP.SAVING);

        // _tempPassword sudah di-generate per siswa saat parsing (genTempPassword)
        const finalRows = sel.map(({ _id, _checked, _kelasRaw, ...rest }) => ({ ...rest }));

        try {
            await onBulkSave(finalRows);
            setSavedRows(sel);
            setStep(STEP.DONE);
        } catch (e) { setErrMsg(e.message); setStep(STEP.ERROR); }
    };

    const checkedCount = rows.filter(r => r._checked).length;
    const hasKelasIssue = rows.some(r => r._checked && !r.kelasId);
    const hasNisIssue = rows.some(r => r._checked && !r.nis);

    // Group rows by kelas for preview
    const kelasGroups = rows.reduce((acc, r) => {
        const k = r.kelasId || '__unassigned__';
        if (!acc[k]) acc[k] = { nama: r.kelasNama || r.kelasId || '— Belum dipilih —', rows: [] };
        acc[k].rows.push(r);
        return acc;
    }, {});

    if (!open) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.45)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 1300, backdropFilter: 'blur(3px)' }}
            onClick={[STEP.REVIEW, STEP.PARSING].includes(step) ? undefined : handleClose}
        >
            <div
                className="slide-right"
                onClick={e => e.stopPropagation()}
                style={{ width: step === STEP.REVIEW ? 760 : 500, height: '100vh', background: C.white, boxShadow: '-12px 0 48px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', transition: 'width .25s cubic-bezier(.4,0,.2,1)' }}
            >
                {/* Header */}
                <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid rgba(13,92,99,.08)`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 700, color: C.dark }}>
                            📂 Import Data Siswa
                        </div>
                        <div style={{ fontSize: FS.sm, color: C.slate, marginTop: 2 }}>
                            SR Kota Malang · Password sementara digenerate otomatis
                        </div>
                    </div>
                    {![STEP.PARSING, STEP.SAVING].includes(step) && (
                        <button onClick={handleClose} style={{ background: 'transparent', border: `1.5px solid ${C.tealXL}`, borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: FS.lg, color: C.slate }}>✕</button>
                    )}
                </div>

                {/* ── IDLE / ERROR ── */}
                {[STEP.IDLE, STEP.ERROR].includes(step) && (
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
                        {/* Alur info */}
                        <div style={{ background: `${C.teal}07`, border: `1.5px solid ${C.tealXL}`, borderRadius: 12, padding: '12px 16px', fontSize: FS.md, color: C.darkL, lineHeight: 1.75 }}>

                            {/* Kolom format */}
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.tealXL}` }}>
                                <div style={{ fontWeight: 700, color: C.dark, marginBottom: 4, fontSize: 11 }}>Format Kolom:</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
                                    {[['Nama Siswa', 'wajib'], ['NIS', 'wajib'], ['Kelas', 'wajib (nama kelas)'], ['Email', 'opsional']].map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
                                            <span style={{ fontWeight: 700, color: C.dark, minWidth: 80, fontSize: 11 }}>{k}</span>
                                            <span style={{ fontSize: FS.xs, color: C.slate }}>— {v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Daftar kelas */}
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.tealXL}` }}>
                                <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.dark, marginBottom: 4 }}>Nama kelas yang dikenali:</div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {kelasList.map(k => (
                                        <span key={k.id} style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 99, background: C.tealXL, color: C.teal, fontWeight: 600 }}>{k.nama}</span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.tealXL}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: FS.sm, color: C.slate }}>Download template:</span>
                                {['csv', 'xlsx'].map(t => (
                                    <button key={t} onClick={() => downloadTemplate(t, kelasList)}
                                        style={{ background: 'none', border: `1px solid ${C.teal}`, borderRadius: 6, padding: '2px 10px', fontSize: FS.sm, color: C.teal, cursor: 'pointer', fontWeight: 600 }}>
                                        ⬇ {t.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Drop zone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={onDrop}
                            onClick={() => fileRef.current?.click()}
                            style={{ border: `2px dashed ${drag ? C.teal : C.tealXL}`, borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? `${C.teal}06` : C.bg, transition: 'all .18s' }}
                        >
                            <input ref={fileRef} type="file" accept={ACCEPTED} onChange={e => pickFile(e.target.files?.[0])} style={{ display: 'none' }} />
                            <div style={{ fontSize: 36, marginBottom: 8 }}>🗂️</div>
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
                                <button onClick={e => { e.stopPropagation(); setFile(null); setErrMsg(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: FS.xl, color: C.slate }}>✕</button>
                            </div>
                        )}
                        {errMsg && <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', borderRadius: 10, padding: '10px 14px', fontSize: FS.md, color: C.red }}>⚠️ {errMsg}</div>}
                        <Btn variant="primary" onClick={handleParse} disabled={!file} style={{ justifyContent: 'center', fontSize: 13 }}>📊 Baca File</Btn>
                    </div>
                )}

                {/* ── PARSING ── */}
                {step === STEP.PARSING && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                        <div style={{ fontSize: 44, animation: 'spin 1s linear infinite' }}>⚙️</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: C.dark }}>Membaca file…</div>
                        <div style={{ fontSize: FS.md, color: C.slate }}>{file?.name}</div>
                        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                    </div>
                )}

                {/* ── REVIEW ── */}
                {step === STEP.REVIEW && (
                    <>
                        <div style={{ padding: '10px 20px', borderBottom: `1px solid rgba(13,92,99,.06)`, display: 'flex', alignItems: 'center', gap: 10, background: `${C.teal}04`, flexShrink: 0 }}>
                            <div style={{ flex: 1, fontSize: FS.md, color: C.dark }}>
                                Ditemukan <b style={{ color: C.teal }}>{rows.length} siswa</b> — password unik digenerate otomatis, bisa di-refresh per baris
                            </div>
                            <Btn variant="soft" onClick={toggleAll} style={{ fontSize: 11 }}>{rows.every(r => r._checked) ? '✗ Batal Semua' : '✓ Pilih Semua'}</Btn>
                            <Btn variant="soft" onClick={() => setRows(p => p.map(r => ({ ...r, _tempPassword: genTempPassword() })))} style={{ fontSize: 11 }} title="Generate ulang password semua siswa">↻ Pwd</Btn>
                        </div>

                        {(hasKelasIssue || hasNisIssue) && (
                            <div style={{ margin: '8px 16px 0', padding: '8px 12px', background: '#FFFBEB', border: '1px solid #F6E05E', borderRadius: 8, fontSize: FS.sm, color: '#744210' }}>
                                ⚠️ {[hasNisIssue && 'Ada NIS yang kosong', hasKelasIssue && 'Ada kelas yang belum terpilih'].filter(Boolean).join(' · ')} — Selesaikan sebelum menyimpan.
                            </div>
                        )}

                        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', marginTop: 4 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FS.md, minWidth: 680 }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                    <tr style={{ background: C.teal }}>
                                        {['✓', 'Nama Siswa', 'NIS', 'Email', 'Kelas', 'Pwd Temp', 'Status'].map(h => (
                                            <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontSize: FS.xs, fontWeight: 700, color: C.white, textTransform: 'uppercase', letterSpacing: .6, whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => {
                                        const kelasWarn = r._checked && !r.kelasId;
                                        const nisWarn = r._checked && !r.nis;
                                        return (
                                            <tr key={r._id} style={{ borderTop: `1px solid rgba(13,92,99,.05)`, background: r._checked ? (kelasWarn || nisWarn ? '#FFFBEB' : C.white) : '#FAFAFA', opacity: r._checked ? 1 : .5, transition: 'all .15s' }}>
                                                <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                                    <input type="checkbox" checked={r._checked} onChange={() => toggleRow(r._id)} style={{ width: 15, height: 15, accentColor: C.teal, cursor: 'pointer' }} />
                                                </td>
                                                <td style={{ padding: '7px 8px', minWidth: 140 }}>
                                                    <input value={r.nama} onChange={e => upd(r._id, 'nama', e.target.value)}
                                                        style={{ ...INP_STYLE, padding: '5px 8px', fontSize: 12 }}
                                                        onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
                                                </td>
                                                <td style={{ padding: '7px 8px', minWidth: 100 }}>
                                                    <input value={r.nis || ''} onChange={e => upd(r._id, 'nis', e.target.value)}
                                                        style={{ ...INP_STYLE, padding: '5px 8px', fontSize: FS.sm, fontFamily: 'monospace', borderColor: nisWarn ? C.red : C.tealXL }}
                                                        onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = nisWarn ? C.red : C.tealXL} />
                                                </td>
                                                <td style={{ padding: '7px 8px', minWidth: 130 }}>
                                                    <input value={r.email || ''} onChange={e => upd(r._id, 'email', e.target.value)} placeholder="(opsional)"
                                                        style={{ ...INP_STYLE, padding: '5px 8px', fontSize: 11 }}
                                                        onFocus={e => e.target.style.borderColor = C.teal} onBlur={e => e.target.style.borderColor = C.tealXL} />
                                                </td>
                                                <td style={{ padding: '7px 8px', minWidth: 130 }}>
                                                    <select value={r.kelasId || ''} onChange={e => { const kelas = kelasList.find(k => k.id === e.target.value); upd(r._id, 'kelasId', e.target.value); if (kelas) upd(r._id, 'kelasNama', kelas.nama); }}
                                                        style={{ ...INP_STYLE, padding: '5px 8px', fontSize: FS.sm, borderColor: kelasWarn ? C.red : C.tealXL }}>
                                                        <option value="">— Pilih kelas —</option>
                                                        {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                                                    </select>
                                                    {r._kelasRaw && kelasWarn && <div style={{ fontSize: FS.xs, color: C.red, marginTop: 2 }}>"{r._kelasRaw}" tidak dikenal</div>}
                                                </td>
                                                <td style={{ padding: '7px 8px', minWidth: 120 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <code style={{ fontSize: FS.sm, fontFamily: 'monospace', fontWeight: 700, color: C.dark, background: `${C.teal}0D`, padding: '3px 7px', borderRadius: 6, letterSpacing: .5, userSelect: 'all' }}>
                                                            {r._tempPassword}
                                                        </code>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '7px 8px' }}>
                                                    <span style={{ fontSize: FS.xs, padding: '2px 8px', borderRadius: 99, background: '#FFF8EE', color: '#B7791F', border: '1px solid #F6AD55', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        Belum Aktif
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ padding: '14px 20px', borderTop: `1px solid rgba(13,92,99,.08)`, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ flex: 1, fontSize: FS.md, color: C.slate }}>
                                <b style={{ color: C.dark }}>{checkedCount}</b> dari {rows.length} siswa dipilih
                            </div>
                            <Btn variant="ghost" onClick={() => { setStep(STEP.IDLE); setRows([]); }} style={{ fontSize: 12 }}>← Ulangi</Btn>
                            <Btn variant="amber"
                                onClick={() => setConfirmOpen(true)}
                                disabled={checkedCount === 0 || rows.filter(r => r._checked).some(r => !r.kelasId || !r.nis || !r.nama)}
                                style={{ fontSize: FS.md, justifyContent: 'center' }}>
                                ✅ Simpan {checkedCount > 0 ? `(${checkedCount})` : ''}
                            </Btn>
                        </div>
                    </>
                )}

                {/* ── CONFIRM MODAL ── */}
                {confirmOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,35,50,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, backdropFilter: 'blur(4px)' }}
                        onClick={() => setConfirmOpen(false)}>
                        <div className="bounce-in" onClick={e => e.stopPropagation()}
                            style={{ background: C.white, borderRadius: 16, padding: 28, width: 420, boxShadow: '0 24px 60px rgba(0,0,0,.22)' }}>
                            <div style={{ fontSize: 26, textAlign: 'center', marginBottom: 10 }}>💾</div>
                            <div style={{ fontFamily: FONTS.serif, fontSize: FS.xl, fontWeight: 600, color: C.dark, textAlign: 'center', marginBottom: 4 }}>
                                Konfirmasi Import Siswa
                            </div>
                            <div style={{ fontSize: FS.md, color: C.slate, textAlign: 'center', marginBottom: 20, lineHeight: 1.7 }}>
                                <b style={{ color: C.dark }}>{checkedCount} siswa</b> akan ditambahkan dengan status <b>Belum Aktif</b>.<br />
                                Password sementara unik akan digenerate otomatis oleh backend untuk setiap siswa.
                            </div>

                            <div style={{ background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: FS.sm, color: '#276749', lineHeight: 1.7 }}>
                                🔒 Password sudah terlihat di kolom <b>Pwd Temp</b> pada tabel review.<br />
                                Download XLSX setelah import selesai untuk menyimpan kredensial.
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <Btn variant="ghost" onClick={() => setConfirmOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Batal</Btn>
                                <Btn variant="amber"
                                    onClick={handleSave}
                                    style={{ flex: 2, justifyContent: 'center' }}>
                                    ✅ Simpan {checkedCount} Siswa
                                </Btn>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SAVING ── */}
                {step === STEP.SAVING && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{ fontSize: 40, animation: 'spin 1s linear infinite' }}>💾</div>
                        <div style={{ fontWeight: 700, color: C.dark }}>Menyimpan data siswa…</div>
                        <div style={{ fontSize: FS.md, color: C.slate }}>Backend sedang generate password unik per siswa…</div>
                    </div>
                )}

                {/* ── DONE ── */}
                {step === STEP.DONE && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
                        <div style={{ fontSize: 48 }}>✅</div>
                        <div style={{ fontFamily: FONTS.serif, fontSize: FS.h2, fontWeight: 600, color: C.dark, textAlign: 'center' }}>
                            {savedRows.length} siswa berhasil ditambahkan
                        </div>
                        <div style={{ fontSize: FS.md, color: C.slate, textAlign: 'center', lineHeight: 1.7 }}>
                            Unduh XLSX untuk menyimpan kredensial sebelum menutup halaman ini.
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            <Btn variant="soft" onClick={() => cetakKredensial(savedRows)} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                                🖨️ Cetak Kredensial
                            </Btn>
                            <Btn variant="soft" onClick={() => downloadKredensial(savedRows)} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
                                📥 Download XLSX
                            </Btn>
                        </div>
                        <Btn variant="primary" onClick={handleClose} style={{ fontSize: FS.base, width: '100%', justifyContent: 'center' }}>Selesai</Btn>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkUploadSiswa;