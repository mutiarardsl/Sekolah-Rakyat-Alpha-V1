// src/components/admin/sections/AddMenu.jsx
import { useState, useRef, useEffect, cloneElement } from 'react';
import { C, FONTS, FS } from '../../../styles/tokens';

const AddMenu = ({ label = 'Tambah', onManual, BulkComponent }) => {
    const [open, setOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const ref = useRef();

    // Tutup dropdown saat klik di luar
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Inject prop trigger ke BulkComponent
    const BulkWithTrigger = BulkComponent
        ? cloneElement(BulkComponent, {
            _externalOpen: bulkOpen,
            _onExternalClose: () => setBulkOpen(false),
        })
        : null;

    const handleManual = () => { setOpen(false); onManual?.(); };
    const handleBulk = () => { setOpen(false); setBulkOpen(true); };

    return (
        <div ref={ref} style={{ position: 'relative' }}>

            {/* ── SINGLE BUTTON (bukan split) ── */}
            <button
                onClick={() => setOpen(p => !p)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 14px',
                    background: C.teal, border: 'none', borderRadius: 9,
                    color: C.white, fontFamily: 'inherit',
                    fontWeight: 600, fontSize: FS.md, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(13,92,99,.25)',
                    transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.tealL}
                onMouseLeave={e => e.currentTarget.style.background = C.teal}
            >
                {label}
                {/* Chevron ikon di kanan */}
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 2 }}>
                    <path
                        d={open ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                        stroke="white" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                    />
                </svg>
            </button>

            {/* ── Dropdown menu ── */}
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 900,
                    background: C.white, borderRadius: 10, minWidth: 190,
                    boxShadow: '0 8px 28px rgba(26,35,50,.15)',
                    border: `1px solid rgba(13,92,99,.1)`,
                    overflow: 'hidden',
                    animation: 'fadeDown .12s ease-out',
                }}>
                    <style>{`
            @keyframes fadeDown {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

                    <MenuItem
                        icon="✏️"
                        title="Tambah Manual"
                        sub="Isi form satu per satu"
                        onClick={handleManual}
                    />

                    <div style={{ height: 1, background: 'rgba(13,92,99,.07)', margin: '0 10px' }} />

                    <MenuItem
                        icon="📂"
                        title="Import File"
                        sub="Upload .xlsx atau .csv"
                        onClick={handleBulk}
                    />
                </div>
            )}

            {/* Render BulkComponent (dipasang di DOM, tapi tersembunyi sampai di-trigger) */}
            {BulkWithTrigger}
        </div>
    );
};

/* ── MenuItem ── */
const MenuItem = ({ icon, title, sub, onClick }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 14px', border: 'none',
                background: hover ? `${C.teal}08` : 'transparent',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'background .12s',
            }}
        >
            <span style={{ fontSize: FS.h2, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
            <div>
                <div style={{ fontSize: FS.md, fontWeight: 700, color: C.dark }}>{title}</div>
                <div style={{ fontSize: FS.xs, color: C.slate, marginTop: 1 }}>{sub}</div>
            </div>
        </button>
    );
};

export default AddMenu;