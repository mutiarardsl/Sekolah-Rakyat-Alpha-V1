# API CONTRACT — SEKOLAH RAKYAT MVP
## Versi 3.1 — Production-Ready | Single Source of Truth

> **Status:** FINAL — Acuan wajib untuk Tim 6 BE, Tim 3 RAG, Tim 4 Game, Tim 5 Mentor, Tim 1 Emosi, Tim 6 FE  
> **Tanggal:** 2026-05-07  
> **Basis:** V3.0 FINAL + Addendum MVP CTA "Tanya Kak Nusa" (context injection hasil quiz ke Tim 5)

---

## DAFTAR ISI

1. [Konvensi Global](#1-konvensi-global)
2. [Changelog V3.1 — CTA "Tanya Kak Nusa"](#2-changelog-v31-addendum-mvp-cta-tanya-kak-nusa)
3. [Audit & Changelog dari V2](#3-audit--changelog-dari-v2)
4. [Peta Domain Endpoint](#4-peta-domain-endpoint)
5. [AUTH — Tim 6 BE](#5-auth--tim-6-be)
6. [ADMIN — Tim 6 BE](#6-admin--tim-6-be)
7. [GURU — Tim 6 BE](#7-guru--tim-6-be)
8. [SISWA — Tim 6 BE](#8-siswa--tim-6-be)
9. [KONTEN — Tim 3 RAG + Tim 6 BE](#9-konten--tim-3-rag--tim-6-be)
10. [SESI — Tim 6 BE](#10-sesi--tim-6-be)
11. [PRETEST — Tim 3 RAG + Tim 6 BE](#11-pretest--tim-3-rag--tim-6-be)
12. [QUIZ — Tim 6 BE](#12-quiz--tim-6-be)
13. [RAG — Tim 3](#13-rag--tim-3)
14. [GAME — Tim 4](#14-game--tim-4)
15. [EMOSI — Tim 1](#15-emosi--tim-1)
16. [MENTOR — Tim 5](#16-mentor--tim-5)
17. [LEADERBOARD — Tim 6 BE](#17-leaderboard--tim-6-be)
18. [NOTIFIKASI — Tim 6 BE](#18-notifikasi--tim-6-be)
19. [WebSocket Spec — Tim 6 BE](#19-websocket-spec--tim-6-be)
20. [Hirarki Kurikulum (Aturan Global)](#20-hirarki-kurikulum-aturan-global)
21. [Standard Response & Error](#21-standard-response--error)

---

## 1. KONVENSI GLOBAL

### 1.1 Base URL
```
https://api.sekolahrakyat.id/v1
```
Semua path endpoint di dokumen ini relatif terhadap base URL ini.

### 1.2 Autentikasi
Semua endpoint (kecuali yang ditandai `[PUBLIC]`) wajib menyertakan header:
```
Authorization: Bearer <access_token>
```

### 1.3 Standard Response Envelope
**Semua response WAJIB menggunakan envelope berikut:**
```json
{
  "data": {},
  "meta": null,
  "error": null
}
```
- **Success:** `data` berisi payload, `error` = `null`
- **Error:** `data` = `null`, `error` berisi objek error standar
- **Paginated:** `meta` berisi objek pagination (lihat 1.5)

### 1.4 Standard Error Object
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi error yang human-readable.",
    "details": {}
  }
}
```

**Error Codes standar:**
| Code | HTTP Status | Keterangan |
|------|-------------|------------|
| `UNAUTHORIZED` | 401 | Token tidak valid / expired |
| `FORBIDDEN` | 403 | Role tidak punya akses resource ini |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `CONFLICT` | 409 | Data duplikat (email, NIP, NIS, dll) |
| `VALIDATION_ERROR` | 400 | Field wajib kosong, format tidak valid |
| `UNPROCESSABLE` | 422 | Data tidak valid secara logika bisnis |
| `RATE_LIMITED` | 429 | Terlalu banyak request (LLM/RAG) |
| `INTERNAL_ERROR` | 500 | Kesalahan server tidak terduga |

### 1.5 Pagination
Endpoint list yang mungkin besar WAJIB mendukung pagination:

**Query params:** `?page=1&limit=20`

**Meta pagination di response:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  },
  "error": null
}
```

### 1.6 Konvensi Naming
- **Bahasa:** Field names dalam **Bahasa Indonesia** untuk domain bisnis; `id`, `status`, `level`, `score`, `role`, `email` tetap Inggris (common terms)
- **Format:** `snake_case` untuk semua field
- **Timestamp:** ISO 8601 (`2026-05-01T09:00:00.000Z`) untuk semua field waktu
- **ID:** String (bukan number) — hindari integer overflow
- **NIP:** String 18 digit
- **Level konten:** Kapital di awal → `"Low"` | `"Mid"` | `"High"` (generate/publish)
- **Level pretest/result RAG:** Lowercase → `"low"` | `"mid"` | `"high"`

### 1.7 HTTP Methods
| Method | Semantik |
|--------|----------|
| `GET` | Baca data, tidak mengubah state |
| `POST` | Buat resource baru / aksi yang tidak idempoten |
| `PUT` | Full replace resource |
| `PATCH` | Partial update resource |
| `DELETE` | Hapus resource |

### 1.8 Filtering, Sorting
```
GET /admin/siswa?kelas_id=x1&status=Aktif&sort=nama&order=asc
```
- `sort`: nama field yang digunakan untuk sort
- `order`: `asc` | `desc` (default: `asc`)
- Filter key = nama field resource

---

## 2. CHANGELOG V3.1 (Addendum Sesi & Konteks Mentor)

Perubahan V3.1 new bersifat **additive dan backward-compatible**.

| Titik | Perubahan |
|-------|-----------|
| `POST /sesi` — Request | **Hapus** field `konteks_quiz` — tidak lagi diperlukan |
| `POST /mentor/pesan` & `/stream` — Request | **Tambah** field opsional `hasil_quiz_id` di root body |
| `POST /mentor/pesan` — Request | **Tambah** field `konteks.publish_id` dan `konteks.bacaan` |
| `POST /sesi` — Timing | Dipanggil saat siswa **masuk chatbot** (bukan saat pesan pertama) |

**Alasan perubahan `konteks_quiz` → `hasil_quiz_id` di body pesan:**
Sesi merepresentasikan satu kunjungan siswa ke chatbot elemen/materi. CTA "Tanya Kak Nusa"
adalah bagian dari sesi yang sama — bukan kunjungan baru. Membuat sesi baru hanya untuk
membawa `konteks_quiz` menghasilkan sesi orphan yang tidak akurat untuk tracking durasi.
`hasil_quiz_id` cukup dikirim di body `POST /mentor/pesan` — BE Tim 6 lookup dan inject
konteks quiz ke Tim 5 pada saat menerima pesan, bukan saat sesi dibuat.

---

## 3. AUDIT & CHANGELOG DARI V2

### 2.1 Masalah di V2 yang Diperbaiki

**A. Endpoint Tidak Konsisten / Action-Based (diperbaiki ke resource-based):**
- `POST /summary/siswa/:id` → `POST /sesi/:id/summary` *(summary adalah sub-resource sesi)*
- `POST /content/generate` → `POST /konten/generate` *(pisahkan domain konten guru vs siswa)*
- `GET /content/siswa` → `GET /siswa/:id/konten` *(resource-centric)*
- `GET /content/progress/siswa` → `GET /siswa/:id/progress` *(milik siswa, bukan konten)*
- `GET /content/progress/guru` → `GET /kelas/:id/progress` *(milik kelas)*
- `POST /game/selesai` → `PATCH /game/:id/penyelesaian` *(partial update resource)*
- `GET /game/list` → `GET /game` *(RESTful)*

**B. Endpoint Overloaded (dipecah):**
- `GET /content/progress/siswa` mengandung KPI + progress + sudah_selesai_ids → dipecah ke:
  - `GET /siswa/:id/kpi` — KPI dashboard (streak, topik, poin, durasi)
  - `GET /siswa/:id/progress` — progress per elemen/materi
- `POST /content/quiz/submit` merangkap scoring MC + grading essay → logika grading tetap di BE, interface dipertahankan tapi dirapikan

**C. Redundansi & Overlap:**
- `GET /guru/rekomendasi?siswa_id=:id` dan `POST /guru/rekomendasi` → digabung dalam domain `/notifikasi` yang lebih generik dan konsisten
- `GET /emotion/history` ownership tidak jelas (komentar "Tim 6 BE (?)")  → dipindah ke `GET /sesi/:id/emosi` (sub-resource sesi)
- `GET /mentor/chat/history` → `GET /sesi/:id/chat` (sub-resource sesi)

**D. Query Param vs Path Param Tidak Konsisten:**
- `GET /content/quiz/history?siswa_id=...&elemen_id=...` → `GET /siswa/:id/quiz/history?elemen_id=...`
- `GET /content/pretest/status?siswa_id=...&mapel_id=...` → `GET /siswa/:id/pretest/status?mapel_id=...`

**E. FE Mengirim Data yang Seharusnya Dihitung BE:**
- `POST /content/quiz/submit` meminta FE mengirim `score` untuk MC → BE hitung sendiri dari `answers`
- `POST /content/insight` meminta FE mengirim KPI kalkulasi → BE ambil langsung dari database

**F. Inkonsistensi Level Casing:**
- V2 mendefinisikan `"Low"/"Mid"/"High"` dan `"low"/"mid"/"high"` di endpoint berbeda tanpa pola jelas → V3 buat aturan: Level yang **disimpan/dikembalikan BE** selalu `lowercase`; Level sebagai **input/filter dari UI** menggunakan kapital (generate konten)

**G. Endpoint Tanpa Ownership Jelas:**
- `GET /mentor/chat/history - Tim 6 BE (?)` → dipertegas sebagai `GET /sesi/:id/chat` milik Tim 6 BE

### 2.2 Ringkasan Perubahan URL

| V2 (Lama) | V3 (Baru) | Alasan |
|-----------|-----------|--------|
| `POST /summary/siswa/:id` | `POST /sesi/:id/summary` | summary sub-resource sesi |
| `GET /content/siswa` | `GET /siswa/:id/konten` | resource-centric |
| `GET /content/progress/siswa` | `GET /siswa/:id/progress` | milik siswa |
| `GET /content/progress/guru` | `GET /kelas/:id/progress` | milik kelas |
| `GET /content/riwayat` | `GET /guru/:id/konten` | milik guru |
| `POST /content/quiz/submit` | `POST /siswa/:id/quiz` | sub-resource siswa |
| `GET /content/quiz/history` | `GET /siswa/:id/quiz?elemen_id=` | sub-resource siswa |
| `GET /content/pretest/status` | `GET /siswa/:id/pretest/status` | sub-resource siswa |
| `POST /content/recommend` | `POST /rag/rekomendasi` | domain RAG jelas |
| `POST /content/insight` | `POST /rag/insight` | domain RAG jelas |
| `GET /guru/rekomendasi` | `GET /siswa/:id/notifikasi` | resource notifikasi |
| `POST /guru/rekomendasi` | `POST /notifikasi` | domain notifikasi |
| `GET /emotion/history` | `GET /sesi/:id/emosi` | sub-resource sesi |
| `GET /mentor/chat/history` | `GET /sesi/:id/chat` | sub-resource sesi |
| `POST /game/selesai` | `PATCH /game/:id/penyelesaian` | partial update resource |
| `GET /game/list` | `GET /game` | RESTful list |

---

## 4. PETA DOMAIN ENDPOINT

```
/auth          → Autentikasi & sesi
/admin         → Manajemen kurikulum, guru, siswa, kelas (role: admin)
/guru/:id      → Data & aksi guru
/siswa/:id     → Data & aksi siswa
/kelas/:id     → Data kelas (monitoring guru)
/konten        → Generate & publish konten (role: guru)
/sesi          → Sesi belajar siswa
/pretest       → Soal & submit pretest
/quiz          → Riwayat quiz (sub-resource siswa)
/rag           → Semua permintaan ke Tim 3 RAG (insight, rekomendasi)
/game          → Generate & aksi game (Tim 4)
/emosi         → Deteksi emosi frame (Tim 1)
/mentor        → Chatbot mentor (Tim 5)
/leaderboard   → Gamifikasi ranking
/notifikasi    → Notifikasi guru → siswa (satu arah)
/ws            → WebSocket monitoring real-time
```

---

## 5. AUTH — Tim 6 BE

### `[PUBLIC]` POST /auth/login
Login siswa, guru, atau admin. **Hanya email + password** — tidak ada NIS/NIP login, tidak ada OAuth.

**Request:**
```json
{
  "email": "budi@sekolah.id",
  "password": "passwordku"
}
```

**Response 200:**
```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "user": {
      "id": "usr_001",
      "nama": "Budi Santoso",
      "email": "budi@sekolah.id",
      "role": "siswa",
      "avatar": null,
      "is_first_login": true,
      "nis": "1234567890",
      "nip": null,
      "kelas_id": "x1"
    }
  },
  "meta": null,
  "error": null
}
```

> **Catatan field `user`:**
> - `nis`: hanya siswa, `null` untuk guru/admin
> - `nip`: hanya guru (string 18 digit), `null` untuk siswa/admin
> - `is_first_login: true` → FE wajib paksa alur aktivasi (ganti password + pilih 3 mapel)
> - `kelas_id`: hanya siswa, `null` untuk guru/admin

**Error 401:** `UNAUTHORIZED` — "Email atau password salah."

---

### `[PUBLIC]` POST /auth/refresh
Tukar refresh token dengan access token baru.

**Request:**
```json
{ "refresh_token": "eyJhbGci..." }
```

**Response 200:**
```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci..."
  },
  "meta": null,
  "error": null
}
```

**Error 401:** refresh token expired → FE paksa logout penuh.

---

### POST /auth/logout
Blacklist token aktif di server.

**Response 200:**
```json
{ "data": { "logged_out": true }, "meta": null, "error": null }
```

---

### POST /auth/aktivasi
Aktivasi akun siswa saat **first login** — ganti password + simpan 3 mapel pilihan. Atomik: jika gagal, seluruh aktivasi dianggap belum selesai.

**Auth:** role `siswa` (token sementara dari login pertama)

**Request:**
```json
{
  "password_baru": "passwordBaru123!",
  "mapel_ids": ["mat", "bio", "fis"]
}
```

> - `password_baru`: min 8 karakter, kombinasi huruf + angka
> - `mapel_ids`: tepat 3 elemen

> **Catatan:** `user_id` diambil dari JWT token — tidak perlu dikirim di body.

**Response 200:**
```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "user": {
      "id": "usr_001",
      "nama": "Budi Santoso",
      "email": "budi@sekolah.id",
      "role": "siswa",
      "avatar": null,
      "is_first_login": false,
      "nis": "1234567890",
      "nip": null,
      "kelas_id": "x1"
    },
    "mapel_terpilih": ["mat", "bio", "fis"]
  },
  "meta": null,
  "error": null
}
```

**Error 400:** "Harus memilih tepat 3 mata pelajaran."  
**Error 400:** "Password minimal 8 karakter dan harus mengandung huruf dan angka."

---

### PATCH /auth/password
Ganti password user yang sedang login (dari halaman profil).

**Auth:** semua role

**Request:**
```json
{
  "password_lama": "passwordLama",
  "password_baru": "passwordBaru123!"
}
```

**Response 200:**
```json
{ "data": { "updated": true }, "meta": null, "error": null }
```

**Error 401:** "Password lama tidak sesuai."

---

### `[PUBLIC]` POST /auth/lupa-password
Kirim link reset ke email. Selalu 200 (tidak bocorkan apakah email terdaftar).

**Request:** `{ "email": "budi@sekolah.id" }`

**Response 200:**
```json
{ "data": { "sent": true }, "meta": null, "error": null }
```

---

### GET /auth/me
Validasi sesi + ambil profil terbaru. Dipanggil saat refresh halaman.

**Response 200:** `data` = objek `user` identik dengan field `user` di `/auth/login`.

---

### PUT /auth/avatar
Upload / ganti foto profil user aktif.

**Auth:** semua role  
**Content-Type:** `multipart/form-data`  
**Form Fields:** `file` (JPEG/PNG, maks 2 MB)

**Response 200:**
```json
{
  "data": { "avatar": "https://cdn.sekolahrakyat.id/avatars/usr_001.jpg" },
  "meta": null,
  "error": null
}
```

**Error 400:** "Format file tidak didukung atau ukuran melebihi 2 MB."

---

## 6. ADMIN — Tim 6 BE

> Semua endpoint section ini hanya untuk role **`admin`**. Response `403` jika role lain mengakses.

---

### 5.1 Mapel (Mata Pelajaran)

#### GET /admin/mapel
Daftar semua mapel.

**Query Params (opsional):** `tingkat` (`X` | `XI` | `XII`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "mat",
      "label": "Matematika",
      "icon": "📐",
      "fase": "Fase E (Kelas X)",
      "deskripsi_cp": "Pada akhir fase ini, peserta didik mampu berpikir kritis...",
      "jumlah_elemen": 4
    }
  ],
  "meta": null,
  "error": null
}
```

#### GET /admin/mapel/:id
Detail satu mapel. **Response 200:** `data` = satu objek `Mapel`.

**Response 200:**
```json
{
  "id": "mat",
  "label": "Matematika",
  "icon": "📐",
  "tingkat": "X",
  "fase": "Fase E (Kelas X)",
  "deskripsi_cp": "Pada akhir fase ini...",
  "elemen": [
    { "id": "bil_aljabar", "label": "Bilangan dan Aljabar" },
    { "id": "geometri", "label": "Geometri dan Pengukuran" }
  ]
}
```

#### POST /admin/mapel
**Request:**
```json
{
  "id": "mat",
  "label": "Matematika",
  "icon": "📐",
  "tingkat": "X",
  "fase": "Fase E (Kelas X)",
  "deskripsi_cp": "Pada akhir fase ini..."
}
```
**Response 201:** `data` = `Mapel` yang dibuat.  
**Error 409:** "ID mapel sudah digunakan."

#### PATCH /admin/mapel/:id
`id` tidak bisa diubah. Body: `{ "label"?, "icon"?, "fase"?, "deskripsi_cp"? }`

**Request Body (partial):**
```json
{
  "label": "Matematika",
  "icon": "📐",
  "fase": "Fase E (Kelas X)",
  "deskripsi_cp": "..."
}
```

**Response 200:** `data` = `Mapel` yang diperbarui.

#### DELETE /admin/mapel/:id
**Response 200:** `{ "data": { "deleted": true } }` — elemen di bawah mapel ini dihapus cascade.

---

### 5.2 Elemen (Kurikulum)

> Elemen adalah level kurikulum langsung di bawah mapel. Hanya menyimpan `{ id, mapel_id, label }`.

#### GET /admin/mapel/:mapel_id/elemen
Ambil semua elemen untuk satu mapel. `mapel_id` wajib.

**Response 200:**
```json
{
  "data": [
    { "id": "bil_aljabar", "mapel_id": "mat", "label": "Bilangan dan Aljabar" },
    { "id": "geometri", "mapel_id": "mat", "label": "Geometri dan Pengukuran" }
  ],
  "meta": null,
  "error": null
}
```

#### GET /admin/mapel/:mapel_id/elemen/:id
Detail satu elemen. 

**Response 200:**
```json
{ "id": "bil_aljabar", "mapel_id": "mat", "label": "Bilangan dan Aljabar" }
```

#### POST /admin/mapel/:mapel_id/elemen
Tambah elemen ke mapel.

**Request Body:**
```json
{ "label": "Bilangan dan Aljabar" }
```

**Response 201:**
```json
{ "id": "bil_aljabar", "mapel_id": "mat", "label": "Bilangan dan Aljabar" }
```

**Error 409:** "Label elemen sudah ada di mapel ini."

---

#### PATCH /admin/mapel/:mapel_id/elemen/:id
`id` dan `mapel_id` tidak bisa diubah. 

**Request Body:**
```json
{ "label": "Nama Elemen Baru" }
```

**Response 200:**
```json
{ "id": "bil_aljabar", "mapel_id": "mat", "label": "Bilangan dan Aljabar" }
```

**Error 409:** "Label elemen sudah ada di mapel ini."

#### DELETE /admin/mapel/:mapel_id/elemen/:id
**Response 200:** `{ "data": { "deleted": true } }` — konten guru yang terkait dilepas otomatis.

---

### 5.3 Kelas

#### GET /admin/kelas?tingkat=:tingkat
Daftar semua kelas. `tingkat` opsional.

**Query Params (opsional):** `tingkat` (`X` | `XI` | `XII`)

**Response 200:**
```json
{
  "data": [
    {
      "id": "x1",
      "nama": "X-1",
      "tingkat": "X",
      "tahun_ajaran": "2025/2026",
      "jumlah_siswa": 30,
      "wali_kelas_id": "g1",
      "mapel_guru_map": {
        "mat": "g1",
        "bio": "g2"
      }
    }
  ],
  "meta": null,
  "error": null
}
```

#### GET /admin/kelas/:id
Detail satu kelas. **Response 200:** `data` = satu objek `Kelas`.

#### GET /admin/kelas/:id/siswa
Daftar siswa dalam kelas.

**Response 200:**
```json
{
  "data": [
    { "id": "s1", "nama": "Budi Santoso", "nis": "1234567890", "email": "budi@sekolah.id", "status": "Aktif" }
  ],
  "meta": { "page": 1, "limit": 50, "total": 30, "total_pages": 1 },
  "error": null
}
```

#### POST /admin/kelas
**Request:**
```json
{
  "nama": "X-1",
  "tingkat": "X",
  "tahun_ajaran": "2025/2026",
  "wali_kelas_id": null
}
```
**Response 201:** `data` = `Kelas` yang dibuat.

#### PATCH /admin/kelas/:id
Body: field yang diubah saja (`nama`, `wali_kelas_id`, `tahun_ajaran`).  
**Response 200:** `data` = `Kelas` yang diperbarui.

#### DELETE /admin/kelas/:id
**Response 200:** `{ "data": { "deleted": true } }` — siswa dilepas dari kelas (`kelas_id` → null), tidak dihapus.

---

#### POST /admin/kelas/:id/mapel
Tambah mapel ke kelas + assign guru pengampu.

**Request Body:**
```json
{ "mapel_id": "mat", "guru_id": "g1" }
```

**Response 201:** `data` = `Kelas` yang diperbarui.  
**Error 409:** "Mapel sudah ada di kelas ini."

#### PATCH /admin/kelas/:id/mapel/:mapel_id
Ganti guru pengampu untuk mapel di kelas ini.  
**Request:** `{ "guru_id": "g2" }`  
**Response 200:** `{ "data": { "mapel_id": "mat", "guru_id": "g2" } }`

#### DELETE /admin/kelas/:id/mapel/:mapel_id
Lepas mapel dari kelas.  
**Response 200:** `{ "data": { "deleted": true } }`

#### POST /admin/kelas/:id/siswa
Tambah siswa ke kelas. **Request:** `{ "siswa_id": "s5" }`  
**Response 201:** `data` = siswa yang diperbarui.  
**Error 409:** "Siswa sudah ada di kelas ini."

#### DELETE /admin/kelas/:id/siswa/:siswa_id
Lepas siswa dari kelas.  
**Response 200:** `{ "data": { "deleted": true } }`

---

### 5.4 Guru

#### GET /admin/guru?sort=nama&order=asc
Daftar semua guru.

**Response 200:**
```json
{
  "data": [
    {
      "id": "g1",
      "nama": "Ibu Sari",
      "nip": "199001012020012001",
      "email": "sari@sekolah.id",
      "avatar": null,
      "kelas_ids": ["x1", "x2"],
      "mapel_kelas_map": {
        "mat": ["x1", "x2"]
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 },
  "error": null
}
```

#### GET /admin/guru/:id
Detail satu guru. **Response 200:** `data` = satu objek `Guru`.

#### POST /admin/guru
**Request:**
```json
{
  "nama": "Pak Budi",
  "nip": "199501152019011001",
  "email": "budi.guru@sekolah.id",
  "mapel_kelas_map": { "bio": ["x1"] }
}
```
**Response 201:** `data` = `Guru` yang dibuat.  
**Error 409:** "Email atau NIP sudah terdaftar."

> BE generate password awal dan kirim via email setelah guru berhasil dibuat.

#### PATCH /admin/guru/:id
`mapel_kelas_map` bersifat **full replace** jika dikirim.  
**Request:** `{ "nama"?, "email"?, "nip"?, "mapel_kelas_map"? }`  
**Response 200:** `data` = `Guru` yang diperbarui.

#### DELETE /admin/guru/:id
**Response 200:** `{ "data": { "deleted": true } }` — relasi wali kelas dilepas otomatis.

#### POST /admin/guru/bulk
Upload data guru massal.

**Content-Type:** `multipart/form-data`  
**Form Fields:** `file` (CSV atau XLSX)

**Format CSV minimal:**
```
nama,nip,email
Ibu Sari,199001012020012001,sari@sekolah.id
```

**Response 200:**
```json
{
  "data": {
    "total": 10,
    "berhasil": 9,
    "gagal": 1,
    "errors": [{ "baris": 5, "pesan": "NIP sudah terdaftar." }]
  },
  "meta": null,
  "error": null
}
```

---

### 5.5 Siswa

#### GET /admin/siswa?kelas_id=:id&status=Aktif
Daftar semua siswa. Query params opsional: `kelas_id`, `status`.

**Response 200:**
```json
{
  "data": [
    {
      "id": "s1",
      "nama": "Budi Santoso",
      "nis": "1234567890",
      "email": "budi@sekolah.id",
      "kelas_id": "x1",
      "status": "Aktif",
      "is_first_login": false,
      "bergabung": "2026-01-15T00:00:00.000Z",
      "last_login": "2026-05-01T08:30:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 45, "total_pages": 3 },
  "error": null
}
```

> `status`: `"Aktif"` | `"Belum Aktif"` | `"Nonaktif"`  
> Siswa menjadi `"Aktif"` setelah menyelesaikan alur aktivasi (`POST /auth/aktivasi`).

#### GET /admin/siswa/:id
Detail satu siswa. **Response 200:** `data` = satu objek `Siswa`.

#### POST /admin/siswa
**Request:**
```json
{
  "nama": "Citra Dewi",
  "nis": "9876543210",
  "email": "citra@sekolah.id",
  "kelas_id": "x1"
}
```
**Response 201:** `data` = `Siswa` dengan `status: "Belum Aktif"`, `is_first_login: true`.

> BE generate password sementara dan kirim via email.

#### PATCH /admin/siswa/:id
Jika `kelas_id` berubah, relasi kelas lama dilepas otomatis.  

**Request Body (partial):**
```json
{
  "nama": "Citra Dewi Updated",
  "kelas_id": "x2"
}
```
**Response 200:** `data` = `Siswa` yang diperbarui.

#### DELETE /admin/siswa/:id
**Response 200:** `{ "data": { "deleted": true } }`

#### POST /admin/siswa/bulk
Upload data siswa massal.

**Content-Type:** `multipart/form-data`  
**Form Fields:** `file` (CSV atau XLSX), `kelas_id` (opsional — semua siswa di file masuk kelas ini)

**Format CSV minimal:**
```
nama,nis,email
Budi Santoso,1234567890,budi@sekolah.id
```

**Response 200:** sama dengan `/admin/guru/bulk`.

---

## 7. GURU — Tim 6 BE

> Endpoint profil dan data guru yang diakses oleh guru itu sendiri.

### GET /guru/:id
Profil guru. Guru hanya bisa mengakses profil sendiri; admin bisa akses semua.

**Auth:** role `guru` (hanya `id` sendiri) atau `admin`

**Response 200:**
```json
{
  "data": {
    "id": "g1",
    "nama": "Ibu Sari",
    "nip": "199001012020012001",
    "email": "sari@sekolah.id",
    "avatar": null,
    "mapel_kelas_map": {
      "mat": ["x1", "x2"]
    },
    "kelas_aktif": [
      { "id": "x1", "nama": "X-1", "tingkat": "X" },
      { "id": "x2", "nama": "X-2", "tingkat": "X" }
    ],
    "mapel_aktif": [
      { "id": "mat", "label": "Matematika", "icon": "📐" }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### GET /guru/:id/konten
Riwayat konten yang pernah dipublish guru. Menggantikan `GET /content/riwayat`.

**Auth:** role `guru` (hanya `id` sendiri)

**Query Params:** `mapel_id`? `kelas_id`? (opsional), `page`?, `limit`?

**Response 200:**
```json
{
  "data": [
    {
      "publish_id": "pub_mat_bil_aljabar_x1_20260501",
      "mapel_id": "mat",
      "mapel_label": "Matematika",
      "mapel_icon": "📐",
      "elemen_id": "bil_aljabar",
      "elemen_label": "Bilangan dan Aljabar",
      "materi": "Persamaan Linear",
      "materi_id": "mat__persamaan_linear",
      "kelas_id": "x1",
      "kelas_nama": "X-1",
      "jenjang": "X",
      "atp": "Siswa mampu...",
      "published_at": "2026-05-01T09:00:00.000Z",
      "game_penyelesaian": [
        {
          "level": "Low",
          "game_id": "game_1746342000_low",
          "siswa_selesai": [
            { "siswa_id": "s1", "nama": "Budi Santoso", "selesai_at": "2026-05-01T10:00:00.000Z" }
          ]
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 },
  "error": null
}
```

> `game_penyelesaian` hanya berisi siswa yang **benar-benar menyelesaikan** game (bukan yang hanya membuka).  
> Di UI guru: level yang diselesaikan tampil normal; level yang tidak diselesaikan **berwarna slate**.

---

## 8. SISWA — Tim 6 BE

### GET /siswa/:id
Profil siswa. Siswa hanya bisa akses profil sendiri; guru dan admin bisa akses semua.

**Auth:** role `siswa` (hanya `id` sendiri), `guru`, atau `admin`

**Response 200:**
```json
{
  "data": {
    "id": "s1",
    "nama": "Budi Santoso",
    "nis": "1234567890",
    "email": "budi@sekolah.id",
    "kelas_id": "x1",
    "kelas_nama": "X-1",
    "status": "Aktif",
    "avatar": null,
    "bergabung": "2026-01-15T00:00:00.000Z",
    "last_login": "2026-05-01T08:30:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

### GET /siswa/:id/kpi
KPI dashboard siswa — streak, topik, poin quiz, durasi. Dipakai di Hero Banner dashboard.

**Auth:** role `siswa` (hanya `id` sendiri)

**Response 200:**
```json
{
  "data": {
    "siswa_id": "s1",
    "streak_hari": 5,
    "total_topik": 8,
    "total_poin_quiz": 420,
    "total_durasi_menit": 195
  },
  "meta": null,
  "error": null
}
```

> **Formula poin quiz:** `Σ (mc_score × 60% + essay_score × 40%)` di semua sesi.  
> **Total topik:** jumlah elemen/materi unik yang pernah dipelajari.
> **Total_durasi_menit:** total waktu yang dihabiskan siswa untuk belajar.

---

### GET /siswa/:id/progress
Progress belajar siswa per mapel dan elemen. Dipakai di dashboard + ProgressSection.

**Auth:** role `siswa` (hanya `id` sendiri)

**Query Params:** `mapel_id`? (opsional, filter per mapel)

**Response 200:**
```json
{
  "data": {
    "siswa_id": "s1",
    "by_mapel": [
      {
        "mapel_id": "mat",
        "mapel_label": "Matematika",
        "mapel_icon": "📐",
        "selesai": 2,
        "dalam_proses": 1,
        "belum_dimulai": 3,
        "progress_pct": 55,
        "elemen": [
          {
            "elemen_id": "bil_aljabar",
            "elemen_label": "Bilangan dan Aljabar",
            "status": "selesai",
            "level_terakhir": "high",
            "nilai_agregasi_terakhir": 88,
            "materi": [
              {
                "materi_id": "mat__persamaan_linear",
                "materi_label": "Persamaan Linear",
                "status": "selesai",
                "level_terakhir": "high",
                "nilai_agregasi_terakhir": 88,
              }
            ]
          }
        ]
      }
    ],
    "sudah_selesai_ids": ["bil_aljabar", "data_statistika"],
    "sedang_dipelajari_ids": ["geometri"]
  },
  "meta": null,
  "error": null
}
```

> `sudah_selesai_ids` dan `sedang_dipelajari_ids` dipakai sebagai input ke `POST /rag/rekomendasi`.

---

### GET /siswa/:id/konten
Semua paket konten yang sudah dipublish guru untuk kelas siswa ini. Menggantikan `GET /content/siswa`.

**Auth:** role `siswa` (hanya `id` sendiri)

**Query Params:** `mapel_id`?, `elemen_id`?, `materi_id`?

**Response 200:**
```json
{
  "data": [
    {
      "publish_id": "pub_mat_bil_aljabar_x1_20260501",
      "mapel_id": "mat",
      "mapel_label": "Matematika",
      "mapel_icon": "📐",
      "elemen_id": "bil_aljabar",
      "elemen_label": "Bilangan dan Aljabar",
      "materi": "Persamaan Linear",
      "materi_id": "mat__persamaan_linear",
      "kelas_id": "x1",
      "jenjang": "X",
      "atp": "Siswa mampu menjelaskan dan menyelesaikan persamaan linear satu variabel.",
      "published_at": "2026-05-01T09:00:00.000Z",
      "konten_list": [
        {
          "tipe": "bacaan",
          "level": "Low",
          "content": { "text": "# Persamaan Linear\n\n## A. Pengertian\n..." }
        },
        {
          "tipe": "quiz_pg",
          "level": "Low",
          "content": {
            "soal": [
              {
                "id": "q1",
                "soal": "Berapakah nilai x dari persamaan 2x + 3 = 7?",
                "pilihan": ["1", "2", "3", "4"],
                "jawaban": 1
              }
            ]
          }
        },
        {
          "tipe": "quiz_essay",
          "level": "Low",
          "content": {
            "pertanyaan": [
              {
                "id": "e1",
                "soal": "Jelaskan langkah-langkah menyelesaikan persamaan linear satu variabel.",
                "rubrik": "Menyebutkan 3+ langkah dengan benar",
                "placeholder": "Tuliskan jawabanmu di sini..."
              }
            ]
          }
        },
        {
          "tipe": "flashcard",
          "level": "Low",
          "content": {
            "cards": [
              { "depan": "Persamaan Linear", "belakang": "Persamaan berderajat satu dengan satu atau lebih variabel" }
            ]
          }
        },
        {
          "tipe": "mindmap",
          "level": null,
          "content": {
            "nodes": [
              { "id": "n1", "label": "Persamaan Linear", "parent_id": null },
              { "id": "n2", "label": "Pengertian", "parent_id": "n1" }
            ]
          }
        },
        {
          "tipe": "game",
          "level": "Low",
          "content": {
            "game_id": "game_1746342000_low",
            "status": "ready",
            "html_url": "https://game.sekolahrakyat.id/play/game_1746342000_low"
          }
        }
      ]
    }
  ],
  "meta": null,
  "error": null
}
```

> **Catatan konten_list:** 16 item total per paket:
> `bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 + game×3`
>
> FE memfilter `konten_list` berdasarkan level siswa saat ini (hasil pretest).
> Konten `bacaan` dirender dari `content.text` (markdown) di chatbot.

---

### GET /siswa/:id/pretest/status
Status pretest siswa untuk semua elemen/materi dalam satu mapel. Dipakai FE untuk menghidrasi store lokal.

**Auth:** role `siswa` (hanya `id` sendiri)

**Query Params:** `mapel_id` (wajib)

**Response 200:**
```json
{
  "data": [
    { "elemen_id": "bil_aljabar", "materi_id": null, "status": "selesai", "level": "mid" },
    { "elemen_id": "geometri", "materi_id": null, "status": "belum", "level": null },
    { "elemen_id": "data_statistika", "materi_id": "mat__statistika_deskriptif", "status": "selesai", "level": "low" }
  ],
  "meta": null,
  "error": null
}
```

> - `materi_id: null` = status untuk elemen langsung (tanpa sub-materi)
> - `status`: `"belum"` | `"selesai"`
> - `level`: `"low"` | `"mid"` | `"high"` jika `status: "selesai"`, `null` jika `"belum"`

**Error 400:** "mapel_id wajib diisi."

---

### GET /siswa/:id/quiz
Riwayat quiz siswa per elemen/materi, dikelompokkan per level. Menggantikan `GET /content/quiz/history`.

**Auth:** role `siswa` (hanya `id` sendiri)

**Query Params:**
- `elemen_id` (wajib)
- `materi_id` (opsional)

**Response 200:**
```json
{
  "data": {
    "level_aktif": "mid",
    "riwayat": [
      { "tipe": "mc", "level": "low", "nilai": 85, "terkunci": true, "dikerjakan_at": "2026-05-01T09:00:00.000Z" },
      { "tipe": "essay", "level": "low", "nilai": 78, "terkunci": true, "dikerjakan_at": "2026-05-01T09:10:00.000Z" },
      { "tipe": "mc", "level": "mid", "nilai": 60, "terkunci": false, "dikerjakan_at": "2026-05-01T10:00:00.000Z" }
    ]
  },
  "meta": null,
  "error": null
}
```

> - `level_aktif`: level aktif siswa sekarang. Dipakai FE untuk mengisi `levelMap[activeKey]`.
> - `riwayat[].terkunci: true` = level sudah dilewati (siswa naik level) → quiz level ini **read-only**.
> - Riwayat per level: **1 record per tipe** (yang terbaru). BE simpan hanya hasil terakhir per `(siswa_id, elemen_id, materi_id, level, tipe)`.

**Response jika belum pernah quiz:**
```json
{ "data": { "level_aktif": "low", "riwayat": [] }, "meta": null, "error": null }
```

**Error 400:** "elemen_id wajib diisi."

---

### POST /siswa/:id/quiz
Submit hasil quiz siswa (MC atau Essay). Menggantikan `POST /content/quiz/submit`.

**Auth:** role `siswa` (hanya `id` sendiri)

**Request:**
```json
{
  "publish_id": "pub_mat_bil_aljabar_x1_20260501",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "elemen_label": "Bilangan dan Aljabar",
  "materi": "Persamaan Linear",
  "materi_id": "mat__persamaan_linear",
  "tipe": "mc",
  "level": "Low",
  "jawaban": {
    "q1": "1",
    "q2": "0",
    "q3": "2"
  }
}
```

> - `tipe`: `"mc"` | `"essay"`
> - `jawaban`: key = `id` soal dari konten. Value = string jawaban (untuk MC: string index pilihan; untuk essay: string teks jawaban)
> - **BE menghitung nilai MC sendiri** — FE tidak mengirim `score`
> - Untuk essay: BE kirim ke Tim 3 RAG untuk dinilai secara async

**Response 200:**
```json
{
  "data": {
    "disimpan": true,
    "tipe": "mc",
    "nilai": 80,
    "nilai_essay": null,
    "elemen_id": "bil_aljabar",
    "level": "low",
    "agregasi": null,
    "naik_level": false,
    "kkm": 75,
    "menunggu_agregasi": false,
    "dicatat_at": "2026-05-01T09:15:00.000Z",
    "hasil_quiz_id": "hq_20260501_0001"
  },
  "meta": null,
  "error": null
}
```

> **`hasil_quiz_id`:** Identifier opaque yang di-generate BE untuk referensi hasil quiz ini. FE menyimpan nilai ini dan meneruskannya ke `POST /mentor/pesan` (bukan ke `POST /sesi`) saat siswa membuka CTA "Tanya Kak Nusa". FE tidak perlu parsing format ID ini.

> **Logika naik level (di BE):**
> ```
> agregasi = nilai_mc × 60% + nilai_essay × 40%
> naik_level = agregasi >= 75
> ```
> `naik_level: true` → FE buka akses level berikutnya; quiz level sebelumnya jadi read-only.
>
> `menunggu_agregasi: true` jika essay baru disubmit dan masih menunggu penilaian RAG.

---

## 9. KONTEN — Tim 3 RAG + Tim 6 BE

> **Ownership endpoint:**
> - `POST /konten/generate` → **Tim 3 RAG** — generate konten dari VectorDB
> - `POST /konten/publish` → **Tim 6 BE** — simpan konten ke database MVP

---

### POST /konten/generate — Tim 3 RAG
Guru generate satu tipe konten per request. FE memanggil endpoint ini **13× paralel** saat klik "Generate Konten":
- `bacaan` × 3 level (Low/Mid/High)
- `quiz_pg` × 3 level
- `quiz_essay` × 3 level
- `flashcard` × 3 level
- `mindmap` × 1 (tanpa level)

> Game **tidak** melalui endpoint ini — gunakan `POST /game/generate` (Tim 4).

**Auth:** role `guru`

**Request:**
```json
{
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "elemen_label": "Bilangan dan Aljabar",
  "materi": "Persamaan Linear",
  "materi_id": "mat__persamaan_linear",
  "jenjang": "X",
  "atp": "Siswa mampu menjelaskan dan menyelesaikan persamaan linear satu variabel dalam konteks nyata.",
  "tipe": "bacaan",
  "level": "Low",
  "instruksi_revisi": "Soal terlalu mudah. Buat soal yang melibatkan persamaan dua variabel dan konteks cerita soal."
}
```

> - `materi` dan `materi_id`: opsional — hanya diisi jika guru menentukan sub-materi spesifik
> - `atp`: opsional tapi **sangat disarankan** untuk konten yang relevan dengan tujuan pembelajaran
> - `level`: `"Low"` | `"Mid"` | `"High"` — **null atau omit** untuk `mindmap` (mindmap tidak berlevel)
> - `instruksi_revisi`: opsional — HANYA diisi saat guru klik "Ulangi" di panel review. Generate pertama: kosong/tidak ada

**Response 200:**
```json
{
  "data": {
    "tipe": "bacaan",
    "level": "Low",
    "content": {
      "text": "# Persamaan Linear\n\n## A. Pengertian\n..."
    },
    "dibuat_at": "2026-05-01T09:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

**Struktur `content` per `tipe`:**

| tipe | Struktur `content` | Jumlah |
|------|-------------------|--------|
| `bacaan` | `{ "text": "markdown string" }` | — |
| `quiz_pg` | `{ "soal": [{ "id", "soal", "pilihan": string[], "jawaban": number }] }` | 10 soal |
| `quiz_essay` | `{ "pertanyaan": [{ "id", "soal", "rubrik", "placeholder" }] }` | 5 pertanyaan |
| `flashcard` | `{ "cards": [{ "depan", "belakang" }] }` | 5–10 kartu |
| `mindmap` | `{ "nodes": [{ "id", "label", "parent_id" }] }` | — |

> `quiz_pg.soal[].jawaban` = **index integer** dari array `pilihan` (bukan string jawaban).

**Error 422:** "elemen_id tidak dikenal di VectorDB."  
**Error 429:** "Terlalu banyak request. Coba beberapa saat lagi."

---

### POST /konten/publish — Tim 6 BE
Guru publish paket konten ke siswa setelah **semua item disetujui**. Konten disimpan permanen di database MVP.

**Auth:** role `guru`

**Request:**
```json
{
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "elemen_label": "Bilangan dan Aljabar",
  "materi": "Persamaan Linear",
  "materi_id": "mat__persamaan_linear",
  "kelas_id": "x1",
  "jenjang": "X",
  "guru_id": "g1",
  "atp": "Siswa mampu menjelaskan dan menyelesaikan persamaan linear satu variabel dalam konteks nyata.",
  "konten_list": [
    {
      "tipe": "bacaan",
      "level": "Low",
      "content": { "text": "# Persamaan Linear\n..." },
      "disetujui": true
    },
    {
      "tipe": "bacaan",
      "level": "Mid",
      "content": { "text": "# Persamaan Linear — Menengah\n..." },
      "disetujui": true
    },
    {
      "tipe": "bacaan",
      "level": "High",
      "content": { "text": "# Persamaan Linear — Lanjutan\n..." },
      "disetujui": true
    },
    {
      "tipe": "quiz_pg",
      "level": "Low",
      "content": { "soal": [ "..." ] },
      "disetujui": true
    },
    {
      "tipe": "quiz_essay",
      "level": "Low",
      "content": { "pertanyaan": [ "..." ] },
      "disetujui": true
    },
    {
      "tipe": "flashcard",
      "level": "Low",
      "content": { "cards": [ "..." ] },
      "disetujui": true
    },
    {
      "tipe": "mindmap",
      "level": null,
      "content": { "nodes": [ "..." ] },
      "disetujui": true
    },
    {
      "tipe": "game",
      "level": "Low",
      "content": {
        "game_id": "game_1746342000_low",
        "status": "ready",
        "html_url": "https://game.sekolahrakyat.id/play/game_1746342000_low"
      },
      "disetujui": true
    }
  ]
}
```

> `konten_list` berisi **16 item total**:
> `bacaan×3 + quiz_pg×3 + quiz_essay×3 + flashcard×3 + mindmap×1 + game×3`
>
> FE **hanya boleh publish jika semua 16 item `disetujui: true`**.  
> `approved` di V2 → `disetujui` di V3 (konsisten Bahasa Indonesia).

**Response 201:**
```json
{
  "data": {
    "publish_id": "pub_mat_bil_aljabar_x1_20260501",
    "kelas_ids": ["x1"],
    "dipublish_at": "2026-05-01T09:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

**Error 400:** "Semua konten harus disetujui sebelum publish."  
**Error 409:** "Konten untuk elemen ini sudah pernah dipublish ke kelas ini. Gunakan endpoint update."

---

## 10. SESI — Tim 6 BE

> Sesi belajar adalah unit terkecil dari aktivitas siswa. Dimulai saat siswa membuka chatbot, berakhir saat menutup atau timeout.

### POST /sesi
Mulai sesi belajar baru. Dipanggil saat siswa membuka chatbot.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "materi_id": "mat__persamaan_linear",
  "publish_id": "pub_mat_bil_aljabar_x1_20260501"
}
```

> **Catatan:** `POST /sesi` dipanggil saat siswa masuk chatbot (izin kamera diberikan),
> bukan saat pesan pertama dikirim. Field `konteks_quiz` telah dihapus di V3.2 —
> konteks quiz kini dikirim via `hasil_quiz_id` di body `POST /mentor/pesan`.

**Response 201:**
```json
{
  "data": {
    "sesi_id": "sesi_s1_20260501_bil_aljabar",
    "dimulai_at": "2026-05-01T09:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

### PATCH /sesi/:id
Update sesi (durasi, violations, emosi akhir). Dipanggil saat siswa menutup chatbot.

**Auth:** role `siswa`

**Request:**
```json
{
  "durasi_menit": 45,
  "emosi_akhir": "antusias",
  "violations": [
    { "detail": "Berpindah Tab / Menyembunyikan Halaman", "terjadi_at": "2026-05-01T09:30:00.000Z" }
  ]
}
```

**Response 200:**
```json
{
  "data": {
    "sesi_id": "sesi_s1_20260501_bil_aljabar",
    "durasi_menit": 45,
    "selesai_at": "2026-05-01T09:45:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

### POST /sesi/:id/summary — Tim 3 RAG
Generate summary AI untuk satu sesi belajar siswa. Dipanggil guru dari panel detail drawer monitoring. Menggantikan `POST /summary/siswa/:id`.

**Auth:** role `guru`

**Request:**
```json
{
  "siswa_id": "s1",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "materi_id": "mat__persamaan_linear",
  "durasi_menit": 45,
  "hasil_quiz": [
    { "level": "low", "tipe": "mc", "nilai": 80 },
    { "level": "low", "tipe": "essay", "nilai": 72 },
    { "level": "mid", "tipe": "mc", "nilai": 60 }
  ],
  "last_quiz": {
    "nilai_mc": 60,
    "nilai_essay": 72,
    "agregasi": 64.8
  },
  "emosi_sesi": ["antusias", "bingung", "antusias"],
  "violations": [
    { "detail": "Berpindah Tab / Menyembunyikan Halaman", "terjadi_at": "2026-05-01T09:30:00.000Z" }
  ]
}
```

> - `durasi_menit`: dalam menit (bukan detik)
> - `hasil_quiz`: **seluruh** quiz dalam sesi, bukan hanya yang terakhir
> - `last_quiz`: shortcut agregasi akhir untuk Tim 3
> - `emosi_sesi`: tren emosi dari awal hingga akhir sesi
> - `violations`: kosong `[]` jika tidak ada pelanggaran

> **Catatan:** `sesi_key` di V2 dihapus — `sesi_id` dari path sudah cukup sebagai identifier.

**Response 200:**
```json
{
  "data": {
    "teks": "Summary sesi 2026-05-01 — Budi Santoso:\n\nMateri level Menengah sudah dicoba namun perlu pendalaman pada soal essay...",
    "dibuat_at": "2026-05-01T09:50:00.000Z",
    "berlaku_hingga": "2026-05-02T09:50:00.000Z"
  },
  "meta": null,
  "error": null
}
```

**Error 422:** "Data sesi tidak cukup untuk menghasilkan evaluasi."

---

### GET /sesi/:id/emosi
Riwayat emosi sepanjang satu sesi (untuk log emosi di panel monitoring guru). Menggantikan `GET /emotion/history`.

**Auth:** role `siswa` (sesi sendiri) atau `guru`

**Response 200:**
```json
{
  "data": [
    { "emosi": "antusias", "confidence": 0.91, "terdeteksi_at": "2026-05-01T09:05:00.000Z" },
    { "emosi": "bingung",  "confidence": 0.84, "terdeteksi_at": "2026-05-01T09:20:00.000Z" },
    { "emosi": "antusias", "confidence": 0.78, "terdeteksi_at": "2026-05-01T09:35:00.000Z" }
  ],
  "meta": null,
  "error": null
}
```

> Guru hanya melihat log saat terjadi **perubahan emosi** (bukan setiap deteksi).  
> Ini dikembalikan dari data yang sudah disaring BE.

---

### GET /sesi/:id/chat
Riwayat percakapan satu sesi chatbot. Menggantikan `GET /mentor/chat/history`.

**Auth:** role `siswa` (sesi sendiri)

**Response 200:**
```json
{
  "data": [
    {
      "role": "user",
      "teks": "Aku bingung cara menyelesaikan 2x + 3 = 7",
      "dikirim_at": "2026-05-01T09:10:00.000Z"
    },
    {
      "role": "ai",
      "teks": "Tenang ya, kita mulai dari yang paling dasar...",
      "dikirim_at": "2026-05-01T09:10:05.000Z"
    }
  ],
  "meta": null,
  "error": null
}
```

---

## 11. PRETEST — Tim 3 RAG + Tim 6 BE

> Pretest **berbeda** dari quiz MC & essay di chatbot. Hanya dipakai sekali untuk menentukan level awal konten siswa.  
> `POST /pretest/soal` dan `POST /pretest/submit` → **Tim 3 RAG**  
> `GET /siswa/:id/pretest/status` → **Tim 6 BE** (lihat Seksi 8)

### POST /pretest/soal — Tim 3 RAG
Ambil 5 soal pretest untuk elemen/materi yang akan dipelajari.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "materi_id": "mat__persamaan_linear"
}
```

> `materi_id` opsional — jika tidak ada, pretest untuk level elemen.

**Response 200:**
```json
{
  "data": {
    "sesi_pretest_id": "pretest_1746342000_bil_aljabar",
    "soal": [
      {
        "id": "pretest_mat_bil_aljabar_1",
        "soal": "Seberapa familiar kamu dengan topik 'Bilangan dan Aljabar'?",
        "pilihan": [
          "Belum pernah mempelajari topik ini sama sekali",
          "Pernah mendengar tapi belum memahami konsepnya",
          "Sudah memahami sebagian konsep dasar",
          "Sudah memahami dan bisa menerapkan konsepnya"
        ],
        "jawaban": 2
      }
    ]
  },
  "meta": null,
  "error": null
}
```

---

### POST /pretest/submit — Tim 3 RAG
Submit jawaban pretest, dapatkan level awal siswa.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "materi_id": null,
  "sesi_pretest_id": "pretest_1746342000_bil_aljabar",
  "jawaban": {
    "pretest_mat_bil_aljabar_1": "2",
    "pretest_mat_bil_aljabar_2": "3",
    "pretest_mat_bil_aljabar_3": "1",
    "pretest_mat_bil_aljabar_4": "2",
    "pretest_mat_bil_aljabar_5": "3"
  }
}
```

**Response 200:**
```json
{
  "data": {
    "level": "mid",
    "nilai": 60,
    "benar": 3,
    "total": 5
  },
  "meta": null,
  "error": null
}
```

> **Logika level:**
> - `nilai >= 80` → `"high"`
> - `nilai >= 60` → `"mid"`
> - `nilai < 60` → `"low"`
>
> BE menyimpan hasil ini permanen. Status dapat diambil via `GET /siswa/:id/pretest/status`.

---

## 12. QUIZ — Tim 6 BE

> Endpoint quiz langsung berada di domain siswa (lihat Seksi 8):
> - `GET /siswa/:id/quiz` — riwayat quiz
> - `POST /siswa/:id/quiz` — submit quiz

Tidak ada endpoint quiz yang berdiri sendiri di domain `/quiz`. Desain ini sengaja dipilih karena quiz adalah **milik siswa**, bukan resource independen.

---

## 13. RAG — Tim 3

> Semua endpoint yang memerlukan komputasi AI dari Tim 3 RAG dikumpulkan di domain `/rag`.

### POST /rag/rekomendasi
Rekomendasi elemen/materi berikutnya berdasarkan progress siswa. Menggantikan `POST /content/recommend`.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "levels": {
    "bil_aljabar": "mid",
    "data_statistika": "low"
  },
  "sudah_selesai_ids": ["bil_aljabar", "data_statistika"],
  "sedang_dipelajari_ids": ["geometri"]
}
```

> Data ini diambil dari response `GET /siswa/:id/progress`.

**Response 200:**
```json
{
  "data": [
    {
      "mapel_id": "mat",
      "elemen_id": "geometri",
      "elemen_label": "Geometri dan Pengukuran",
      "materi": "Teorema Pythagoras",
      "materi_id": "mat__teorema_pythagoras",
      "alasan": "Kamu sudah menguasai aljabar dasar, saatnya melanjutkan ke geometri."
    }
  ],
  "meta": null,
  "error": null
}
```

> Maksimal 3 item rekomendasi.

---

### POST /rag/insight
Generate teks insight personal untuk Hero Banner dashboard siswa. Menggantikan `POST /content/insight`.

> **FE tidak menghitung KPI** — BE mengambil KPI dari database dan mengirim ke RAG.  
> FE hanya mengirim `siswa_id` dan `nama`.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "nama": "Budi Santoso",
  "streak": 5,
  "total_topik": 8,
  "total_poin_kuiz": 420,
  "total_durasi": 195
}
```

**Response 200:**
```json
{
  "data": {
    "teks": "🚀 Keren, Budi! Streak 5 hari berturut-turut — kamu konsisten sekali. Yuk lanjutkan momentum ini!"
  },
  "meta": null,
  "error": null
}
```

> Teks: 1–2 kalimat motivasi, dimulai satu emoji.

---

## 14. GAME — Tim 4

> Tim 4 deliver game dalam format **HTML file**. FE me-render via:
> ```html
> <iframe src={html_url} sandbox="allow-scripts allow-same-origin" />
> ```
> Game menghasilkan **3 level** (Low/Mid/High). Tracking hanya boolean selesai/tidak selesai.

### POST /game/generate — Tim 4
Guru generate game baru. Dipanggil **3×** (Low/Mid/High) paralel saat guru klik "Generate Konten".

**Auth:** role `guru`

**Request:**
```json
{
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "elemen_label": "Bilangan dan Aljabar",
  "materi": "Persamaan Linear",
  "materi_id": "mat__persamaan_linear",
  "kelas_id": "x1",
  "jenjang": "X",
  "atp": "Siswa mampu menjelaskan dan menyelesaikan persamaan linear satu variabel dalam konteks nyata.",
  "level": "Low",
  "instruksi_revisi": ""
}
```

> - `atp`: **wajib** — untuk menyesuaikan skenario game dengan tujuan pembelajaran
> - `instruksi_revisi`: opsional — hanya diisi saat revisi; kosong saat generate pertama

**Response 200:**
```json
{
  "data": {
    "game_id": "game_1746342000_low",
    "nama": "Quest: Persamaan Linear",
    "deskripsi": "Game edukasi interaktif tentang Persamaan Linear — level Low",
    "mapel_id": "mat",
    "elemen_id": "bil_aljabar",
    "materi_id": "mat__persamaan_linear",
    "level": "Low",
    "status": "ready",
    "html_url": "https://game.sekolahrakyat.id/play/game_1746342000_low"
  },
  "meta": null,
  "error": null
}
```

> Jika `status: "generating"` → `html_url: null` → FE **poll** `GET /game/:id` setiap 3 detik hingga `status: "ready"`.

**Error 422:** "elemen_id tidak dikenal."

---

### GET /game — Tim 4
Daftar game tersedia. `html_url` tidak disertakan di list — ambil via `GET /game/:id`.

**Query Params:** `kelas_id`?, `mapel_id`?, `elemen_id`?, `materi_id`?

**Response 200:**
```json
{
  "data": [
    {
      "game_id": "game_1746342000_low",
      "nama": "Quest: Persamaan Linear",
      "deskripsi": "...",
      "mapel_id": "mat",
      "elemen_id": "bil_aljabar",
      "elemen_label": "Bilangan dan Aljabar",
      "materi": "Persamaan Linear",
      "materi_id": "mat__persamaan_linear",
      "level": "Low",
      "status": "ready",
      "jumlah_pemain": 24
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "total_pages": 1 },
  "error": null
}
```

---

### GET /game/:id — Tim 4
Detail satu game. Digunakan untuk polling saat status masih `"generating"`.

**Response 200:** 
```json
{
  "game_id": "game_1746342000_low",
  "nama": "Quest: Persamaan Linear",
  "deskripsi": "...",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "materi_id": "mat__persamaan_linear",
  "level": "Low",
  "status": "ready",
  "html_url": "https://game.sekolahrakyat.id/play/game_1746342000_low"
}
```

---

### PATCH /game/:id/penyelesaian — Tim 4
Catat bahwa siswa **menyelesaikan** game. Menggantikan `POST /game/selesai`.

> Hanya dipanggil jika siswa benar-benar menyelesaikan game (event dari iframe ke parent FE).  
> Data ini muncul di `GET /guru/:id/konten` pada field `game_penyelesaian[].siswa_selesai`.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "level": "Low"
}
```

**Response 200:**
```json
{
  "data": {
    "tercatat": true,
    "game_id": "game_1746342000_low",
    "siswa_id": "s1",
    "level": "Low",
    "selesai_at": "2026-05-01T10:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

## 15. EMOSI — Tim 1

> Dipanggil dari `useWebcamEmotion` hook setiap **5 detik** selama siswa aktif di chatbot.

### POST /emosi/deteksi — Tim 1
Deteksi emosi dari satu frame webcam.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "sesi_id": "sesi_s1_20260501_bil_aljabar",
  "frame_base64": "base64_jpeg_string_224x224"
}
```

> `frame_base64`: JPEG base64 **tanpa** prefix `"data:image/jpeg;base64,"`.  
> `sesi_id`: untuk korelasi log di Tim 1 dan Tim 6 BE (disimpan ke riwayat emosi sesi).

**Response 200:**
```json
{
  "data": {
    "emosi": "antusias",
    "confidence": 0.89,
    "terdeteksi_at": "2026-05-01T09:10:00.000Z"
  },
  "meta": null,
  "error": null
}
```

> `emosi`: `"antusias"` | `"bosan"` | `"bingung"` | `"frustrasi"` | `"tidak_terdeteksi"`

**Error 400:** `{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "Frame tidak valid.", "details": { "emosi": "tidak_terdeteksi" } } }`

---

## 16. MENTOR — Tim 5

> **Tanggung jawab Tim 5:**
> - Interaksi chatbot selama sesi belajar
> - Feedback evaluasi quiz via CTA badge "📊 Evaluasi Kuis"

### POST /mentor/pesan
Kirim pesan ke mentor, tunggu full response (non-streaming). Fallback jika SSE tidak tersedia.

**Auth:** role `siswa`

**Request:**
```json
{
  "siswa_id": "s1",
  "sesi_id": "sesi_s1_20260501_bil_aljabar",
  "mapel_id": "mat",
  "elemen_id": "bil_aljabar",
  "elemen_label": "Bilangan dan Aljabar",
  "materi": "Persamaan Linear",
  "materi_id": "mat__persamaan_linear",
  "atp": "Siswa mampu...",
  "level": "Mid",
  "pesan": "Aku bingung cara menyelesaikan 2x + 3 = 7",
  "hasil_quiz_id": "hq_20260501_0001",
  "konteks": {
    "emosi": "bingung",
    "progress": 40,
    "publish_id": "pub_mat_bil_aljabar_x1_20260501",
    "bacaan": "# Persamaan Linear\n\n## A. Pengertian... (maks 3000 karakter)"
  }
}
```

> - `atp`: **wajib** — mentor menyesuaikan penjelasan dengan tujuan pembelajaran
> - `level`: level konten siswa saat ini, agar mentor menyesuaikan kedalaman jawaban
> - `konteks.emosi`: dari Tim 1, `null` jika tidak ada
> - `sesi_id`: untuk persistensi chat history di Tim 6 BE
> - `hasil_quiz_id`: opsional — hanya saat CTA "Tanya Kak Nusa". BE Tim 6 inject konteks quiz ke Tim 5 secara internal. `null` di flow normal.
> - `konteks.publish_id`: opsional — `null` jika konten belum dipublish
> - `konteks.bacaan`: opsional — teks bacaan level aktif, maks 3000 karakter. `null` jika konten belum tersedia. Tim 5 gunakan sebagai referensi utama saat menjawab pertanyaan siswa

**Response 200:**
```json
{
  "data": {
    "balasan": "Tenang ya, kita mulai dari yang paling dasar. Persamaan 2x + 3 = 7 artinya...",
    "sesi_id": "sesi_s1_20260501_bil_aljabar"
  },
  "meta": null,
  "error": null
}
```

---

### POST /mentor/pesan/stream
Identik dengan `/mentor/pesan` tapi response via **SSE (Server-Sent Events)** untuk efek ketik streaming.

**Request Body:** sama persis dengan `/mentor/pesan`.

**Response:** `Content-Type: text/event-stream`

**Format SSE:**
```
data: Tenang \n\n
data: ya, \n\n
data: kita \n\n
data: mulai \n\n
data: [DONE]\n\n
```

> FE menggunakan `EventSource` atau `fetch` dengan `ReadableStream`.  
> Ketika `data: [DONE]` diterima, FE tutup koneksi.

---

### Context Injection Hasil Quiz — Internal BE Logic (CTA "Tanya Kak Nusa")

> **Catatan:** Subseksi ini mendokumentasikan logic internal BE yang **transparan ke FE**. Request/response public `POST /mentor/pesan` dan `POST /mentor/pesan/stream` **tidak berubah**. SSE protocol **tidak berubah**.

Context Injection Hasil Quiz — Internal BE Logic (V3.2)
Saat BE menerima request POST /mentor/pesan dengan field hasil_quiz_id, BE:

1. Validasi bahwa hasil_quiz_id adalah milik siswa_id pada JWT
2. Fetch data hasil quiz dari DB
3. Inject ke Tim 5 sebagai bagian dari system context

Jika hasil_quiz_id tidak ada di body, BE meneruskan ke Tim 5 seperti biasa.
POST /sesi tidak lagi membawa konteks_quiz — sesi selalu di-reuse untuk elemen/materi yang sama dalam satu kunjungan.

---

## 17. LEADERBOARD — Tim 6 BE

### GET /leaderboard?kelas_id=:id&mode=monthly
Ranking siswa per kelas berdasarkan akumulasi nilai quiz.

**Auth:** role `siswa`

**Query Params:**
- `kelas_id` (wajib)
- `mode`: `"daily"` | `"monthly"` (default: `"monthly"`)
  - `"daily"`: poin hari ini, reset tengah malam WIB
  - `"monthly"`: poin bulan berjalan, reset tanggal 1

**Formula poin:** `Σ (nilai_mc × 60% + nilai_essay × 40%)` semua sesi dalam periode.

**Response 200:**
```json
{
  "data": [
    {
      "peringkat": 1,
      "siswa_id": "s1",
      "nama": "Budi Santoso",
      "avatar": "https://cdn.sekolahrakyat.id/avatars/s1.jpg",
      "kelas_id": "x1",
      "total_poin": 420,
      "streak_hari": 5
    }
  ],
  "meta": {
    "mode": "monthly",
    "periode": "2026-05",
    "kelas_id": "x1",
    "diperbarui_at": "2026-05-01T12:00:00.000Z"
  },
  "error": null
}
```

---

## 18. NOTIFIKASI — Tim 6 BE

> Notifikasi satu arah dari guru ke siswa. Menggantikan domain `/guru/rekomendasi`.

### POST /notifikasi
Guru kirim pesan/rekomendasi ke siswa. Muncul sebagai notifikasi di dashboard siswa.

**Auth:** role `guru`

**Request:**
```json
{
  "guru_id": "g1",
  "siswa_id": "s1",
  "mapel_id": "mat",
  "pesan": "Coba ulangi materi persamaan linear, fokus pada soal dua variabel."
}
```

**Response 201:**
```json
{
  "data": {
    "id": "notif_123",
    "dibuat_at": "2026-05-01T09:00:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

### GET /siswa/:id/notifikasi
Siswa ambil semua notifikasi yang diterima dari guru. (Lihat juga Seksi 8 — sub-resource siswa)

> Diletakkan di domain siswa agar konsisten dengan pola resource-centric.

**Auth:** role `siswa` (hanya `id` sendiri)

**Query Params:** `dibaca`? (`true`|`false`), `page`?, `limit`?

**Response 200:**
```json
{
  "data": [
    {
      "id": "notif_123",
      "guru_nama": "Ibu Sari",
      "guru_mapel": "📐 Matematika",
      "pesan": "Coba ulangi materi persamaan linear.",
      "dibaca": false,
      "dibuat_at": "2026-05-01T09:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "total_pages": 1 },
  "error": null
}
```

---

### PATCH /notifikasi/:id/baca
Tandai notifikasi sudah dibaca.

**Auth:** role `siswa`

**Response 200:**
```json
{ "data": { "dibaca": true }, "meta": null, "error": null }
```

---

## 19. WEBSOCKET SPEC — Tim 6 BE

### 18.1 Koneksi

**URL:**
```
wss://api.sekolahrakyat.id/v1/ws/monitoring
```

**Query Params:**
```
?kelas_id={kelas_id}&mapel_id={mapel_id}&token={access_token}
```

> `token` dikirim sebagai query param (bukan header) karena keterbatasan browser WebSocket API.  
> `mapel_id` wajib jika guru mengampu lebih dari 1 mapel di kelas tersebut.

**Env:**
```
VITE_WS_URL=wss://api.sekolahrakyat.id/v1/ws
```

---

### 18.2 Handshake

Setelah koneksi berhasil, server mengirim event `connected`:
```json
{
  "type": "connected",
  "payload": {
    "kelas_id": "x1",
    "mapel_id": "mat",
    "siswa_online": ["s1", "s3", "s5"]
  },
  "timestamp": "2026-05-01T09:00:00.000Z"
}
```

---

### 18.3 Event Types (Server → Client)

Semua event menggunakan envelope:
```json
{
  "type": "<event_type>",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {},
  "timestamp": "09:15:30"
}
```

**`siswa_aktif`** — Siswa mulai belajar:
```json
{
  "type": "siswa_aktif",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "mapel_id": "mat",
    "elemen_id": "bil_aljabar",
    "materi_id": "mat__persamaan_linear",
    "sesi_id": "sesi_s1_20260501_bil_aljabar"
  },
  "timestamp": "09:00:00"
}
```

**`siswa_nonaktif`** — Siswa menutup chatbot:
```json
{
  "type": "siswa_nonaktif",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "sesi_id": "sesi_s1_20260501_bil_aljabar",
    "durasi_menit": 45
  },
  "timestamp": "09:45:00"
}
```

**`progress_siswa`** — Update progress belajar:
```json
{
  "type": "progress_siswa",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "mapel_id": "mat",
    "elemen_id": "bil_aljabar",
    "materi_id": "mat__persamaan_linear",
    "level": "Mid",
    "progress_pct": 65
  },
  "timestamp": "09:15:30"
}
```

**`quiz_siswa`** — Siswa submit quiz:
```json
{
  "type": "quiz_siswa",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "mapel_id": "mat",
    "elemen_id": "bil_aljabar",
    "materi_id": "mat__persamaan_linear",
    "tipe": "mc",
    "nilai": 80,
    "level": "Low",
    "naik_level": false
  },
  "timestamp": "09:15:30"
}
```

**`emosi_siswa`** — Deteksi emosi berubah:
```json
{
  "type": "emosi_siswa",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "emosi": "bingung",
    "confidence": 0.84,
    "durasi_emosi_negatif_menit": 5
  },
  "timestamp": "09:15:30"
}
```

**`pelanggaran_siswa`** — Siswa terdeteksi pelanggaran:
```json
{
  "type": "pelanggaran_siswa",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "detail": "Berpindah Tab / Menyembunyikan Halaman"
  },
  "timestamp": "09:15:30"
}
```

**`smart_alert`** — Alert otomatis untuk guru (dikirim server saat kondisi terpenuhi):
```json
{
  "type": "smart_alert",
  "siswa": { "id": "s1", "nama": "Budi", "avatar": null },
  "payload": {
    "jenis": "emosi_negatif_berkepanjangan",
    "detail": "Budi terdeteksi bingung/frustasi selama >15 menit berturut-turut.",
    "durasi_menit": 17
  },
  "timestamp": "09:30:00"
}
```

> **Kondisi smart_alert server-side:**
> - `emosi_negatif_berkepanjangan`: emosi negatif (bosan/bingung/frustrasi) > 15 menit berturut-turut
> - `pelanggaran_aktif`: siswa melakukan pelanggaran

---

### 18.4 Event Types (Client → Server)

**`ping`** — Keepalive dari FE:
```json
{ "type": "ping" }
```

Server merespons dengan `pong`:
```json
{ "type": "pong", "timestamp": "09:15:30" }
```

---

### 18.5 Reconnect & Fallback

| Kondisi | Behavior |
|---------|----------|
| Koneksi terputus | FE retry dengan **exponential backoff**: 1s → 2s → 4s → 8s (maks 30s) |
| Token expired | FE refresh token via `POST /auth/refresh`, lalu reconnect |
| Server unreachable setelah 3 retry | FE fallback ke polling `GET /kelas/:id/progress` setiap 30 detik |
| `kelas_id` tidak valid | Server kirim event `error` dan tutup koneksi |

**Error event dari server:**
```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_KELAS",
    "message": "kelas_id tidak valid atau guru tidak mengampu kelas ini."
  }
}
```

---

## 20. HIRARKI KURIKULUM (ATURAN GLOBAL)

```
Kurikulum Merdeka
  └── Mapel       (Matematika)              ← fase & deskripsi_cp ada di sini
        └── Elemen   (Bilangan dan Aljabar)  ← elemen_id SELALU WAJIB
              └── Materi  (Persamaan Linear) ← opsional, diisi guru/siswa
```

### 19.1 Field Wajib di Semua Payload Content / Game / Mentor

| Field | Keterangan |
|-------|-----------|
| `mapel_id` | Selalu wajib |
| `elemen_id` | **Selalu wajib**, tidak boleh null atau omit |
| `elemen_label` | Wajib di semua payload mutasi (POST/PUT) — untuk konteks LLM & display |

### 19.2 Field Opsional

| Field | Keterangan |
|-------|-----------|
| `materi` | Nama materi (string label), hanya diisi jika guru/siswa turun ke level materi |
| `materi_id` | Format: `"{mapel_id}__{snake_case}"` — contoh: `"mat__persamaan_linear"` |
| `atp` | Alur Tujuan Pembelajaran — opsional tapi direkomendasikan untuk generate konten |

### 19.3 Aturan Validasi (Wajib Semua Tim)

- BE / Tim 3 / Tim 4 / Tim 5 **wajib menolak** payload yang punya `mapel_id` tapi **tidak punya `elemen_id`**
- FE membangun `materi_id`: `` materi_id = `${mapel_id}__${materi.toLowerCase().replace(/\s+/g, '_')}` ``
- `materi_id` hanya dikirim jika `materi` juga dikirim (keduanya sinkron)

---

## 21. STANDARD RESPONSE & ERROR

### 20.1 Response Envelope (Wajib Semua Endpoint)

```json
{
  "data": <object|array|null>,
  "meta": <object|null>,
  "error": <object|null>
}
```

### 20.2 Success Response

**Single resource:**
```json
{
  "data": { "id": "s1", "nama": "Budi" },
  "meta": null,
  "error": null
}
```

**Collection (tanpa pagination):**
```json
{
  "data": [{ "id": "s1" }, { "id": "s2" }],
  "meta": null,
  "error": null
}
```

**Collection (dengan pagination):**
```json
{
  "data": [{ "id": "s1" }, { "id": "s2" }],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  },
  "error": null
}
```

**Action berhasil:**
```json
{
  "data": { "deleted": true },
  "meta": null,
  "error": null
}
```

### 20.3 Error Response

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "elemen_id wajib diisi.",
    "details": {
      "field": "elemen_id",
      "constraint": "required"
    }
  }
}
```

**Multiple validation errors:**
```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Terdapat kesalahan validasi pada beberapa field.",
    "details": {
      "fields": [
        { "field": "elemen_id", "message": "Wajib diisi." },
        { "field": "mapel_id",  "message": "Nilai tidak dikenal." }
      ]
    }
  }
}
```

### 20.4 HTTP Status Code Reference

| Code | Penggunaan |
|------|-----------|
| 200 | OK — request berhasil |
| 201 | Created — resource baru berhasil dibuat |
| 400 | Bad Request — validasi gagal, field tidak valid |
| 401 | Unauthorized — token tidak valid atau expired |
| 403 | Forbidden — role tidak diizinkan mengakses resource ini |
| 404 | Not Found — resource tidak ditemukan |
| 409 | Conflict — duplikat data (email, NIP, NIS, dll) |
| 422 | Unprocessable Entity — data valid secara format tapi tidak valid secara logika bisnis |
| 429 | Too Many Requests — rate limit (khususnya endpoint LLM/RAG) |
| 500 | Internal Server Error — kesalahan server tidak terduga |

### 20.5 Caching Strategy (Rekomendasi)

| Endpoint | Cache Strategy | TTL |
|----------|---------------|-----|
| `GET /admin/mapel` | Server-side cache | 1 jam |
| `GET /admin/elemen` | Server-side cache | 1 jam |
| `GET /leaderboard?mode=daily` | Server-side cache | 5 menit |
| `GET /leaderboard?mode=monthly` | Server-side cache | 15 menit |
| `GET /siswa/:id/kpi` | No cache (real-time) | — |
| `POST /rag/*` | No cache (LLM call) | — |
| `GET /siswa/:id/konten` | Client-side cache | Sampai invalidasi |

---

## LAMPIRAN: QUICK REFERENCE ENDPOINT

### Auth
| Method | Path | Role | Keterangan |
|--------|------|------|-----------|
| POST | `/auth/login` | PUBLIC | Login |
| POST | `/auth/refresh` | PUBLIC | Refresh token |
| POST | `/auth/logout` | semua | Logout |
| POST | `/auth/aktivasi` | siswa | Aktivasi akun + pilih mapel |
| PATCH | `/auth/password` | semua | Ganti password |
| POST | `/auth/lupa-password` | PUBLIC | Kirim link reset |
| GET | `/auth/me` | semua | Profil sesi aktif |
| PUT | `/auth/avatar` | semua | Upload avatar |

### Admin
| Method | Path | Keterangan |
|--------|------|-----------|
| GET/POST | `/admin/mapel` | List & buat mapel |
| GET/PATCH/DELETE | `/admin/mapel/:id` | Detail, update, hapus |
| GET/POST | `/admin/elemen` | List & buat elemen |
| GET/PATCH/DELETE | `/admin/elemen/:id` | Detail, update, hapus |
| GET/POST | `/admin/kelas` | List & buat kelas |
| GET/PATCH/DELETE | `/admin/kelas/:id` | Detail, update, hapus |
| GET | `/admin/kelas/:id/siswa` | Siswa dalam kelas |
| POST/PATCH/DELETE | `/admin/kelas/:id/mapel/:mapel_id` | Kelola mapel kelas |
| POST/DELETE | `/admin/kelas/:id/siswa/:siswa_id` | Kelola siswa kelas |
| GET/POST | `/admin/guru` | List & buat guru |
| GET/PATCH/DELETE | `/admin/guru/:id` | Detail, update, hapus |
| POST | `/admin/guru/bulk` | Upload massal guru |
| GET/POST | `/admin/siswa` | List & buat siswa |
| GET/PATCH/DELETE | `/admin/siswa/:id` | Detail, update, hapus |
| POST | `/admin/siswa/bulk` | Upload massal siswa |

### Guru
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/guru/:id` | Profil guru |
| GET | `/guru/:id/konten` | Riwayat konten guru |

### Siswa
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/siswa/:id` | Profil siswa |
| GET | `/siswa/:id/kpi` | KPI dashboard |
| GET | `/siswa/:id/progress` | Progress belajar |
| GET | `/siswa/:id/konten` | Konten tersedia |
| GET | `/siswa/:id/pretest/status` | Status pretest |
| GET/POST | `/siswa/:id/quiz` | Riwayat & submit quiz |
| GET/PATCH | `/siswa/:id/notifikasi` | Notifikasi dari guru |

### Kelas (Guru Monitoring)
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/kelas/:id/progress` | Progress semua siswa di kelas |

> **Endpoint `/kelas/:id/progress`** — Tim 6 BE, dipakai guru di halaman monitoring (initial load sebelum WS aktif):

```json
{
  "data": {
    "kelas_id": "x1",
    "mapel_id": "mat",
    "total_siswa": 30,
    "aktif_hari_ini": 12,
    "rata_rata_progress": 68,
    "siswa": [
      {
        "siswa_id": "s1",
        "nama": "Budi Santoso",
        "avatar": null,
        "elemen_id": "bil_aljabar",
        "elemen_label": "Bilangan dan Aljabar",
        "materi": "Persamaan Linear",
        "materi_id": "mat__persamaan_linear",
        "level": "mid",
        "nilai_terakhir": 84,
        "durasi_menit": 45,
        "last_active": "2026-05-01T09:15:00.000Z",
        "aktif": true
      }
    ]
  },
  "meta": null,
  "error": null
}
```

**Query Params:** `mapel_id` (wajib jika guru mengampu >1 mapel di kelas)

### Konten (Guru)
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/konten/generate` | Tim 3 RAG | Generate satu tipe konten |
| POST | `/konten/publish` | Tim 6 BE | Publish paket konten |

### Sesi
| Method | Path | Keterangan |
|--------|------|-----------|
| POST | `/sesi` | Mulai sesi belajar |
| PATCH | `/sesi/:id` | Update/tutup sesi |
| POST | `/sesi/:id/summary` | Generate evaluasi AI (Tim 3) |
| GET | `/sesi/:id/emosi` | Log emosi sesi |
| GET | `/sesi/:id/chat` | Riwayat chat sesi |

### Pretest
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/pretest/soal` | Tim 3 RAG | Ambil soal pretest |
| POST | `/pretest/submit` | Tim 3 RAG | Submit jawaban pretest |

### RAG
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/rag/rekomendasi` | Tim 3 | Rekomendasi topik |
| POST | `/rag/insight` | Tim 3 | Insight personal dashboard |

### Game
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/game/generate` | Tim 4 | Generate game baru |
| GET | `/game` | Tim 4 | List game |
| GET | `/game/:id` | Tim 4 | Detail game + polling |
| PATCH | `/game/:id/penyelesaian` | Tim 4 | Catat penyelesaian game |

### Emosi
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/emosi/deteksi` | Tim 1 | Deteksi emosi dari frame |

### Mentor
| Method | Path | Tim | Keterangan |
|--------|------|-----|-----------|
| POST | `/mentor/pesan` | Tim 5 | Chat (non-streaming) |
| POST | `/mentor/pesan/stream` | Tim 5 | Chat (SSE streaming) |

### Leaderboard & Notifikasi
| Method | Path | Keterangan |
|--------|------|-----------|
| GET | `/leaderboard` | Ranking kelas |
| POST | `/notifikasi` | Guru kirim notifikasi |
| PATCH | `/notifikasi/:id/baca` | Tandai notifikasi dibaca |

### WebSocket
| URL | Keterangan |
|-----|-----------|
| `wss://.../v1/ws/monitoring?kelas_id=&mapel_id=&token=` | Real-time monitoring guru |

---

*— End of API Contract SR MVP V3.1 —*