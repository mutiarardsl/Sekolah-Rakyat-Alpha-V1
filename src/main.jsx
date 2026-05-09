/**
 * SR MVP — Entry Point
 * Tim 6 Fase 2 | src/main.jsx
 *
 * Boot sequence:
 *   1. Aktifkan MSW (jika VITE_USE_MSW=true) → intercept API calls
 *   2. Render React app
 *
 * Urutan ini penting: MSW harus aktif SEBELUM komponen mount dan mulai fetch.
 * Keycloak dihapus dari scope Fase 2.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// KaTeX CSS: import global di sini agar tersedia saat math di-render di komponen manapun,
// terlepas dari urutan lazy-load. Dibutuhkan oleh rehype-katex di ChatSection.
import 'katex/dist/katex.min.css';

async function enableMocking() {
  if (import.meta.env.VITE_USE_MSW !== 'true') return;
  const { worker } = await import('./mocks/browser.js');
  return worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}

async function boot() {
  await enableMocking();
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

boot().catch(console.error);
