/**
 * SR MVP — API Client Base
 * Tim 6 Fase 3 | src/api/client.js
 *
 * Axios instance tunggal yang dipakai semua modul API.
 * - Base URL dari .env (VITE_API_BASE_URL)
 * - Auto-attach JWT token dari localStorage
 * - 401 → coba refresh token dulu, baru clear + dispatch "sr:unauthorized"
 * - Request/response logging di mode development
 *
 * Contract: apiContract.json v2.1.0
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

// ─── Refresh token state — cegah multiple concurrent refresh ────────
let _isRefreshing = false;
let _refreshQueue = []; // [{ resolve, reject }]

function _processQueue(err, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token)
  );
  _refreshQueue = [];
}

function _clearSession() {
  localStorage.removeItem("sr_access_token");
  localStorage.removeItem("sr_refresh_token");
  localStorage.removeItem("sr_user");
  window.dispatchEvent(new Event("sr:unauthorized"));
}

// ─── Response Interceptor — handle 401 & logging ────────────────────
apiClient.interceptors.response.use(
  (response) => {
    if (IS_DEV) console.log(`[API] ← ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // Jangan coba refresh untuk endpoint auth itu sendiri
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/refresh") ||
      originalRequest?.url?.includes("/auth/login");

    if (status === 401 && !originalRequest._retried && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem("sr_refresh_token");

      // Tidak ada refresh token → langsung paksa logout
      if (!refreshToken) {
        _clearSession();
        if (IS_DEV) console.warn("[API] 401 tanpa refresh token — session dihapus.");
        return Promise.reject(error);
      }

      // Ada request lain yang sedang refresh → antri
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      // Mulai refresh
      originalRequest._retried = true;
      _isRefreshing = true;

      try {
        // Dynamic import untuk hindari circular dependency (auth.js → client.js → auth.js)
        const { refreshToken: doRefresh } = await import('./auth.js');
        const res = await doRefresh(refreshToken);
        const newAccessToken = res.access_token;
        // Simpan token baru ke localStorage
        localStorage.setItem('sr_access_token', newAccessToken);
        if (res.refresh_token) localStorage.setItem('sr_refresh_token', res.refresh_token);
        // Update default header agar request berikutnya otomatis pakai token baru
        apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        _processQueue(null, newAccessToken);
        if (IS_DEV) console.log('[API] Token di-refresh berhasil.');
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        _processQueue(refreshErr);
        _clearSession();
        if (IS_DEV) console.warn('[API] Refresh token gagal — session dihapus.', refreshErr.message);
        return Promise.reject(refreshErr);
      } finally {
        _isRefreshing = false;
      }
    }

    if (IS_DEV && error.config) console.error(`[API] ✗ ${status ?? 'network'} ${error.config?.url ?? ''}`, error.response?.data ?? error.message);
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
