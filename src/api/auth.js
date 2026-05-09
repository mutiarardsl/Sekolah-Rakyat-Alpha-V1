/**
 * SR MVP — Auth API (V3 envelope + path FINAL)
 */
import { apiClient } from "./client.js";
import { v3 } from "../http/requestV3.js";
import { unwrapEnvelope } from "../http/envelope.js";

function _saveSession(data) {
  localStorage.setItem("sr_access_token", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("sr_refresh_token", data.refresh_token);
  }
  localStorage.setItem("sr_user", JSON.stringify(data.user));
}

export async function login({ email, password }) {
  const data = await v3.post("/auth/login", { email, password });
  _saveSession(data);
  return data;
}

export async function logout() {
  try {
    return await v3.post("/auth/logout", {});
  } finally {
    localStorage.removeItem("sr_access_token");
    localStorage.removeItem("sr_refresh_token");
    localStorage.removeItem("sr_user");
  }
}

export async function refreshToken(refresh_token) {
  const data = await v3.post("/auth/refresh", { refresh_token });
  localStorage.setItem("sr_access_token", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("sr_refresh_token", data.refresh_token);
  }
  return data;
}

export async function forgotPassword(email) {
  return v3.post("/auth/lupa-password", { email });
}

export async function aktivasiAkun({ password, user_id, mapel_ids }) {
  const data = await v3.post("/auth/aktivasi", {
    password,
    user_id,
    mapel_ids,
  });
  _saveSession(data);
  return data;
}

export async function changePassword({ old_password, new_password }) {
  return v3.patch("/auth/password", {
    password_lama: old_password,
    password_baru: new_password,
  });
}

export async function getMe() {
  return v3.get("/auth/me");
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.put("/auth/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrapEnvelope(res.data);
}