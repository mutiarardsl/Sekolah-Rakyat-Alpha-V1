/**
 * SR MVP — API Client Base
 * Tim 6 Fase 2 | src/api/client.js
 *
 * Axios instance tunggal yang dipakai semua modul API.
 * - Base URL dari .env (VITE_API_BASE_URL)
 * - Auto-attach JWT token dari localStorage
 * - 401 → clear token + dispatch event "sr:unauthorized"
 * - Request/response logging di mode development
 *
 * Contract: apiContract.json v2.1.0
 * Fase 3 TODO: tambah auto-refresh token di interceptor 401
 *              menggunakan refreshToken() dari auth.js
 */

import axios from "axios";

// ─── Environment ────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const IS_DEV = import.meta.env.DEV;

// ─── Axios Instance ──────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ─── Request Interceptor — attach token ─────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sr_access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (IS_DEV) console.log(`[API] → ${config.method?.toUpperCase()} ${config.url}`, config.data ?? "");
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor — handle 401 & logging ────────────────────
apiClient.interceptors.response.use(
  (response) => {
    if (IS_DEV) console.log(`[API] ← ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Contract: 401 → clear localStorage + dispatch sr:unauthorized
      // Fase 3: tambah logika refresh token di sini sebelum clear
      localStorage.removeItem("sr_access_token");
      localStorage.removeItem("sr_user");
      window.dispatchEvent(new Event("sr:unauthorized"));
    }
    if (IS_DEV) console.error(`[API] ✗ ${status} ${error.config?.url}`, error.response?.data);
    return Promise.reject(error);
  }
);

// ─── SSE Streaming helper — untuk chat mentor Tim 5 ────────────────
/**
 * openStream(path, body, onChunk, onDone, onError) → cancelFn
 *
 * Buka fetch + ReadableStream ke backend SSE.
 * Format server: "data: <token>\n\n" per chunk, "data: [DONE]\n\n" untuk menutup.
 *
 * Aktifkan dengan VITE_MENTOR_STREAM=true di .env.
 * Dipanggil dari: src/api/mentor.js#streamMessage
 *
 * @param {string} path
 * @param {object} body
 * @param {function(string):void} onChunk
 * @param {function():void} onDone
 * @param {function(Error):void} onError
 * @returns {function():void} cancelFn
 */
export function openStream(path, body, onChunk, onDone, onError) {
  const token = localStorage.getItem("sr_access_token");
  const url = `${BASE_URL}${path}`;
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        decoder
          .decode(value, { stream: true })
          .split("\n")
          .forEach((line) => {
            if (!line.startsWith("data: ")) return;
            const chunk = line.slice(6);
            if (chunk === "[DONE]") return;
            onChunk(chunk);
          });
      }
      onDone();
    } catch (err) {
      if (err.name !== "AbortError") onError(err);
    }
  })();

  return () => ctrl.abort();
}
