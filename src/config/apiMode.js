/**
 * SR MVP — API runtime mode (production / mock / hybrid)
 *
 * Hybrid: coba backend real dahulu; jika gagal (network / 5xx), fallback fixture mock.
 */

const RAW = String(import.meta.env.VITE_API_MODE || "real").toLowerCase();

/** @returns {'real' | 'mock' | 'hybrid'} */
export function getApiMode() {
  if (RAW === "mock" || RAW === "hybrid" || RAW === "real") return RAW;
  return "real";
}

export function shouldTryRealFirst() {
  return getApiMode() === "real" || getApiMode() === "hybrid";
}

export function allowMockFallback(err) {
  if (getApiMode() !== "hybrid") return false;
  if (!err?.response && err?.request) return true;
  const s = err?.response?.status;
  return !s || s >= 500;
}
