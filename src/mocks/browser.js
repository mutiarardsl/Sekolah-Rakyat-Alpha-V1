/**
 * SR MVP — MSW Browser Worker Setup (V3 HARDENED)
 *
 * Handler priority (urutan penting — MSW match pertama yang cocok):
 *  1. handlers (legacy bridge — masih dipakai, tapi bridge V2 ditandai deprecated)
 *  2. sesiHandlers (V3 native PATCH /sesi — C3 FIX)
 *  3. deprecatedHandlers (eksplisit 410 untuk endpoint V2 lama — C1 FIX)
 *
 * Dengan urutan ini:
 *  - V3 endpoint yang sudah ada di `handlers` tetap bekerja
 *  - /sesi/:id PATCH sekarang ditangani sesiHandlers (native V3)
 *  - Endpoint V2 lama (/content/*, /game/selesai, dll.) → 410 Gone
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { sesiHandlers } from './v3/sesi.handlers';
import { deprecatedHandlers } from './v3/deprecated.handlers';

// Sesi handlers SEBELUM main handlers agar PATCH /sesi/:id tidak tertutup
// Deprecated handlers SETELAH semua V3 agar tidak block endpoint yang valid
export const worker = setupWorker(
    ...sesiHandlers,
    ...handlers,
    ...deprecatedHandlers,
);