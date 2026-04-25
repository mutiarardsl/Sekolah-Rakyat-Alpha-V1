/**
 * SR MVP — Auth API
 * Tim 6 | src/api/auth.js
 *
 * Semua endpoint autentikasi & manajemen sesi.
 * Backend: Tim 6 BE
 *
 * ── Endpoint Index ──────────────────────────────────────────────────
 *  POST /auth/login           → login email/NIS + password
 *  POST /auth/google          → login via Google OAuth
 *  POST /auth/logout          → invalidasi token di server
 *  POST /auth/refresh         → tukar refresh_token → access_token baru
 *  POST /auth/forgot-password → kirim email reset password
 *  POST /auth/aktivasi        → aktivasi akun siswa (first login: ganti password)
 *  GET  /auth/me              → profil user saat ini (dari token)
 *
 * ── Catatan Alur Akun ───────────────────────────────────────────────
 *  Tidak ada self-register. Semua akun (siswa & guru) didaftarkan admin:
 *   - Siswa : admin bulk upload CSV/XLSX → backend generate password sementara
 *             → siswa login → is_first_login=true → ActivasiPage → aktivasi
 *   - Guru  : admin tambah manual → backend kirim password via email
 *
 * ── Auth Requirement ────────────────────────────────────────────────
 *  Public (tanpa token) : login, google, forgot-password, refresh
 *  Bearer token required : logout, aktivasi, me
 *
 * ── localStorage Keys ───────────────────────────────────────────────
 *  sr_access_token  — JWT access token
 *  sr_user          — JSON.stringify(AuthUser)
 */

import { apiClient } from "./client";

// ─── Types ────────────────────────────────────────────────────────────
/**
 * @typedef {Object} AuthUser
 * @property {string}                   id
 * @property {string}                   nama
 * @property {string}                   email
 * @property {"siswa"|"guru"|"admin"}   role
 * @property {string}                   sekolah_id
 * @property {string|null}              avatar
 * @property {boolean}                  is_first_login
 * @property {string|null}              [nis]       - hanya siswa
 * @property {string|null}              [kelas_id]  - hanya siswa
 * @property {string|null}              [nip]       - hanya guru, 18 digit string
 *
 * @typedef {Object} AuthResponse
 * @property {string}   access_token
 * @property {string}   refresh_token
 * @property {AuthUser} user
 *
 * @typedef {Object} ErrorResponse
 * @property {string} message
 */

// ─── Helpers ──────────────────────────────────────────────────────────
function _saveSession(data) {
  localStorage.setItem("sr_access_token", data.access_token);
  localStorage.setItem("sr_user", JSON.stringify(data.user));
}

// ─── POST /auth/login ─────────────────────────────────────────────────
/**
 * Login dengan email atau NIS + password.
 * Field `email` menerima alamat email maupun NIS siswa.
 *
 * Success 200 → AuthResponse (token disimpan otomatis)
 * Error   401 → { message: string }
 *
 * @param {{ email: string, password: string }} payload
 * @returns {Promise<AuthResponse>}
 */
export async function login({ email, password }) {
  const { data } = await apiClient.post("/auth/login", { email, password });
  _saveSession(data);
  return data;
}

// ─── POST /auth/google ────────────────────────────────────────────────
/**
 * Login via Google OAuth.
 * Frontend mengirim email yang sudah diverifikasi Google SDK.
 * Akun Google harus sudah terdaftar di sistem oleh admin.
 *
 * Success 200 → AuthResponse
 * Error   401 → { message: "Akun Google tidak terdaftar di sistem." }
 *
 * @param {string} email  — email terverifikasi dari Google
 * @returns {Promise<AuthResponse>}
 */
export async function loginWithGoogle(email) {
  const { data } = await apiClient.post("/auth/google", { email });
  _saveSession(data);
  return data;
}

// ─── POST /auth/logout ────────────────────────────────────────────────
/**
 * Logout: blacklist token di server + bersihkan localStorage.
 * Selalu membersihkan sesi lokal meski request server gagal.
 *
 * Success 200 → { message: string }
 *
 * @returns {Promise<{ message: string }>}
 */
export async function logout() {
  try {
    const { data } = await apiClient.post("/auth/logout");
    return data;
  } finally {
    localStorage.removeItem("sr_access_token");
    localStorage.removeItem("sr_user");
  }
}

// ─── POST /auth/refresh ───────────────────────────────────────────────
/**
 * Tukar refresh_token dengan access_token baru.
 * Dipanggil otomatis oleh interceptor di client.js saat token expired.
 *
 * Success 200 → { access_token, refresh_token }
 * Error   401 → refresh token tidak valid / expired → paksa logout
 *
 * @param {string} refresh_token
 * @returns {Promise<{ access_token: string, refresh_token: string }>}
 */
export async function refreshToken(refresh_token) {
  const { data } = await apiClient.post("/auth/refresh", { refresh_token });
  localStorage.setItem("sr_access_token", data.access_token);
  return data;
}

// ─── POST /auth/forgot-password ───────────────────────────────────────
/**
 * Kirim link reset password ke email.
 * Selalu return 200 untuk keamanan (tidak membocorkan apakah email terdaftar).
 *
 * Success 200 → { message: string }
 *
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export async function forgotPassword(email) {
  const { data } = await apiClient.post("/auth/forgot-password", { email });
  return data;
}

// ─── POST /auth/aktivasi ──────────────────────────────────────────────
/**
 * Aktivasi akun siswa saat first login.
 * Siswa mengganti password sementara dengan password permanen.
 * Identitas & kelas sudah diverifikasi admin saat bulk upload.
 *
 * Success 200 → AuthResponse (token baru, is_first_login: false)
 * Error   404 → { message: "Siswa tidak ditemukan." }
 *
 * @param {{ password: string, user_id: string }} payload
 * @returns {Promise<AuthResponse>}
 */
export async function aktivasiAkun({ password, user_id }) {
  const { data } = await apiClient.post("/auth/aktivasi", { password, user_id });
  _saveSession(data);
  return data;
}

// ─── GET /auth/me ─────────────────────────────────────────────────────
/**
 * Ambil profil user yang sedang login dari token.
 * Dipakai untuk validasi sesi saat refresh halaman.
 *
 * Success 200 → AuthUser
 * Error   401 → token tidak valid / expired
 *
 * @returns {Promise<AuthUser>}
 */
export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}