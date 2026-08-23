# 00 — SETUP MANUAL

> Yang ada di sini **harus dikerjakan manusia**, bukan agent. Agent tidak bisa membuat akun,
> menekan tombol di dashboard Supabase, atau menyimpan kunci rahasia.
> Selesaikan seluruh checklist ini dulu, baru jalankan `01-TASK-BOARD.md`.

---

## ✅ Checklist singkat

- [ ] M1 — Buat proyek Supabase
- [ ] M2 — Catat URL & anon key
- [ ] M3 — Buat bucket storage `bukti`
- [ ] M4 — Matikan pendaftaran mandiri
- [ ] M5 — Siapkan proyek React di lokal
- [ ] M6 — Isi `.env.local`
- [ ] M7 — Pasang Claude Code
- [ ] M8 — Kumpulkan data nyata perusahaan
- [ ] M9 — Buat akun CEO & admin pertama
- [ ] M10 — Siapkan Vercel (bisa ditunda sampai Task 20)

---

## M1 · Buat proyek Supabase

1. Buka <https://supabase.com> → **Sign in** → **New project**
2. Isi:
   - **Name:** `koperumnas-laporan`
   - **Database Password:** buat yang kuat, **simpan di password manager** — tidak bisa dilihat lagi
   - **Region:** `Southeast Asia (Singapore)` — paling dekat ke Indonesia
3. Tunggu ±2 menit sampai proyek siap.

## M2 · Catat URL & anon key

**Project Settings → API**, salin dua ini:

```
Project URL   : https://xxxxxxxx.supabase.co
anon public   : eyJhbGciOi...
```

⚠️ Di halaman yang sama ada **service_role key**. Jangan pernah dipakai di frontend dan jangan dimasukkan ke repo. Kunci itu melewati semua RLS.

## M3 · Buat bucket storage

**Storage → New bucket**

- Name: `bukti`
- Public bucket: **OFF** (harus privat — isinya bukti PTE dan video internal)
- File size limit: `52428800` (50 MB)

## M4 · Matikan pendaftaran mandiri

**Authentication → Sign In / Providers → Email**

- Enable email provider: **ON**
- **Confirm email: OFF** (karyawan lapangan banyak yang tidak punya email aktif)
- **Authentication → Sign Up → Allow new users to sign up: OFF**

Semua akun dibuat oleh admin. Tidak boleh ada orang luar mendaftar sendiri.

## M5 · Siapkan proyek React

```bash
npx create-next-app@latest koperumnas-laporan --ts --app --tailwind --eslint --src-dir=false --import-alias "@/*" --no-turbopack
cd koperumnas-laporan
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query react-hook-form zod @hookform/resolvers date-fns
git add -A && git commit -m "init"
```

`create-next-app` sudah menyiapkan Tailwind, ESLint, TypeScript, dan git sekaligus.

Lalu salin folder `docs/` dan file `CLAUDE.md` ke root proyek ini.

## M6 · Isi `.env.local`

Buat file `.env.local` di root proyek:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Template Next.js sudah mengabaikan `.env.local`, tapi cek lagi — ini satu-satunya file yang tidak boleh masuk repo.

⚠️ Awalan `NEXT_PUBLIC_` berarti nilainya **ikut terkirim ke browser**. Itu benar untuk anon key, karena RLS yang menjaga data. Jangan pernah memberi awalan itu pada `service_role key`.

## M7 · Pasang Claude Code

```bash
npm install -g @anthropic-ai/claude-code
cd koperumnas-laporan
claude
```

Prompt pertama yang ditempel ada di `02-PROMPT-PACK.md` bagian **P0**.

## M8 · Kumpulkan data nyata perusahaan

Agent tidak bisa menebak ini. Siapkan dalam bentuk daftar sederhana:

| Yang dibutuhkan | Bentuk |
|---|---|
| Daftar lokasi perumahan aktif | nama lokasi + nama PIC-nya |
| Daftar outlet | Indosteak, Indokopi — nama manager |
| Daftar karyawan | nama, jabatan, divisi, email (kalau ada) |
| Siapa CEO | nama + email |
| Siapa Pusat Pelaporan | Ibu Sabrina — email |
| Siapa Accounting | nama + email |
| Siapa Kontrol Marketing | Pak Fauzi, Pak Dea — email |

Kalau daftar karyawan panjang, cukup 5–10 orang dulu untuk tes; sisanya diimpor belakangan.

## M9 · Buat akun pertama

Setelah Task 03 selesai (tabel sudah ada):

**Authentication → Users → Add user → Create new user**

- Email: email CEO
- Password: sementara, minta ganti setelah login
- Auto Confirm User: **ON**

Lalu di **SQL Editor**, jalankan (ganti UUID dengan `id` user yang barusan dibuat):

```sql
insert into public.profile (id, nama, jabatan, divisi)
values ('UUID-DARI-AUTH', 'Nama CEO', 'CEO', 'Direksi');

insert into public.role (user_id, role) values
  ('UUID-DARI-AUTH', 'ceo'),
  ('UUID-DARI-AUTH', 'karyawan');
```

Ulangi untuk Ibu Sabrina (`pusat`, `karyawan`) dan Accounting (`accounting`, `karyawan`).

## M10 · Vercel

Dikerjakan setelah Batch E (Task 18-23) selesai -- daftar M10 di bawah sudah mencakup langkah tambahan yang muncul sejak Task 23 (Route Handler admin butuh `service_role`).

1. Push repo ke GitHub
2. <https://vercel.com> → **Import Project** → pilih repo
3. Framework Preset: **Next.js** (terdeteksi otomatis)
4. **Environment Variables** → tambahkan TIGA ini (bukan cuma dua):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` -- **wajib sejak Task 23** (dipakai `app/api/admin/user/route.ts` untuk membuat pengguna baru). Isi sama dengan `.env.local`, JANGAN diberi awalan `NEXT_PUBLIC_`.

   `SUPABASE_DB_URL` **TIDAK** perlu ditambahkan di Vercel -- itu cuma dipakai skrip `scripts/*.mjs` (migrasi, uji DB) yang jalan di komputer lokal, tidak pernah dibaca kode aplikasi yang di-deploy.
5. Deploy
6. Salin domain hasil deploy → kembali ke Supabase **Authentication → URL Configuration** → masukkan ke **Site URL** dan **Redirect URLs**

---

## Yang TIDAK boleh dilakukan

- ❌ Menaruh `service_role key` di kode frontend atau di repo
- ❌ Menyalakan pendaftaran mandiri
- ❌ Membuat bucket `bukti` jadi publik
- ❌ Menonaktifkan RLS "biar cepat dulu" — laporan Accounting bersifat rahasia, ini bukan hal yang bisa ditunda
- ❌ Memakai data konsumen asli untuk testing sebelum RLS terpasang dan diuji
