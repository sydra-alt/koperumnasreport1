# PROGRESS

> Diperbarui setiap task selesai. Status: ⬜ belum · 🟨 berjalan · ✅ selesai

## Migrasi stack: Vite → Next.js 15/16 (21 Agustus 2026)

Keputusan diambil ulang oleh user, didokumentasikan di `BLUEPRINT.md` §2. Proyek di-scaffold ulang total dengan `create-next-app@latest --ts --app --tailwind --eslint --src-dir=false` (perintah persis dari `docs/MULAI-DI-SINI.md`).

**Versi Next.js: 16.3.2, bukan 15.** `create-next-app@latest` memasang versi terbaru (16), bukan 15 seperti tertulis di BLUEPRINT §2. Saya berhenti dan menanyakan ini secara eksplisit (scaffold Next.js sendiri men-generate `AGENTS.md` berisi peringatan "This is NOT the Next.js you know... breaking changes... may differ from your training data") — user memilih **lanjut dengan Next.js 16**. Konsekuensinya:
- `LayoutProps<'/'>` di `app/layout.tsx` adalah tipe baru yang butuh `npx next typegen` (atau `next dev`/`next build`) dijalankan dulu sebelum `tsc` bersih — bukan tersedia begitu saja.
- ESLint bawaan (`eslint-plugin-react-hooks` versi baru) punya aturan `react-hooks/refs` yang salah-tangkap (false positive) pola `useController` react-hook-form — lihat catatan di baris Task 07/08 di bawah.
- `next lint` sudah dihapus di v16; script `lint` di `package.json` memakai `eslint` langsung (sudah begitu dari scaffold, bukan saya ubah).
- Turbopack aktif default untuk `dev` dan `build` (tidak perlu flag `--turbopack` lagi).
- **BLUEPRINT.md dan CLAUDE.md belum diperbarui menyebut versi 16** — masih tertulis "Next.js 15". Ini utang dokumentasi, bukan kesalahan kode. *(Belum saya perbaiki sendiri karena bukan bagian dari 5 langkah yang diminta — tandai untuk diperbaiki.)*

**Duplikat `CLAUDE.md` ditemukan dan diberesi.** Proses update dokumen user menulis versi baru ke `docs/CLAUDE.md`, sementara versi lama (Vite) masih ada di root — dua sumber kebenaran yang saling bertentangan (root eksplisit bilang "Jangan pasang: Next.js"). Root `CLAUDE.md` ditimpa dengan isi baru (Next.js), `docs/CLAUDE.md` dihapus. Juga memperbaiki satu typo warisan di dalamnya: aturan #6 masih menyebut `src/forms/` padahal struktur baru §5 taruh `forms/` di root (tanpa `src/`, sesuai `--src-dir=false`).

**Task 01, 07, 08, 09 dipindah 1:1** dari `src/{components,forms,lib,styles}` (Vite) ke `{components,forms,lib}/` + `app/tokens.css` (Next.js root, `--src-dir=false`). Karena struktur folder relatif sama (components/, forms/, lib/ tetap sibling), **tidak ada satu pun import path yang berubah** — hanya penambahan `'use client'` di `FormRenderer.tsx` dan seluruh `components/fields/*.tsx` (BLUEPRINT §3.4). `forms/*.ts` dan `lib/rupiah.ts` tidak diberi `'use client'` (bukan komponen, tidak pakai hook).

Yang **tidak bisa** dipindah 1:1 (perbedaan mendasar Vite vs Next.js App Router, bukan pilihan bebas):
- Font Google (dulu `<link>` di `index.html`) → sekarang `next/font/google` di `app/layout.tsx`. Token `--display`/`--body`/`--mono` di `tokens.css` diubah dari nama font literal menjadi `var(--font-display)` dkk. supaya nyambung ke variabel yang di-generate `next/font`. Komponen yang memakai token ini (`FormRenderer`, semua field) **tidak disentuh** — mereka hanya mengonsumsi `var(--display)`, jadi tidak tahu dan tidak perlu tahu perubahan di baliknya.
- `index.html` (lang, title) → `app/layout.tsx` pakai `<html lang="id">` + `export const metadata`.
- `src/App.tsx` (placeholder Task 01) → `app/page.tsx`, isi sama (judul + subjudul pakai token).

**Task 02 (klien Supabase, AuthProvider, halaman Masuk) SENGAJA TIDAK dipindah** — instruksi migrasi eksplisit hanya menyebut 01/07/08/09. File lama (`src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `src/pages/Masuk.tsx`, `src/pages/Beranda.tsx`, `src/App.tsx` routing) ikut terhapus bersama `src/` lama dan **tidak ada lagi**. Task 02 perlu dikerjakan ulang dari nol nanti: BLUEPRINT §2/§5 sekarang mensyaratkan `@supabase/ssr` dengan dua klien terpisah (`lib/supabase/client.ts` browser, `lib/supabase/server.ts` cookie-based) menggantikan satu klien `@supabase/supabase-js` + localStorage yang lama, dan routing lewat App Router menggantikan React Router. Status Task 02 dikembalikan ke ⬜ di tabel bawah.

**Verifikasi ulang setelah pindah** (bukan cuma "berhasil di-copy", logika dijalankan ulang):
- `buildZodSchema()` dites lagi dengan 3 kasus yang sama persis seperti sebelum migrasi (centang tanpa bukti → ditolak dengan pesan sama; dengan bukti → lolos; tidak dicentang → lolos). Hasil identik.
- SSR (`renderToStaticMarkup`) FormRenderer dengan ke-10 tipe field + `nilaiAwal`, dari lokasi baru. Uang terformat, lampiran nilaiAwal muncul, tabel 1 baris sesuai nilaiAwal, ke-10 field render — semua OK, sama seperti hasil sebelum migrasi.
- `npx tsc --noEmit`, `npm run build`, `npm run lint` ketiganya bersih pada kondisi akhir.
- `npm run dev` dijalankan sungguhan, `curl` ke `/` → HTTP 200, `<title>Pusat Kontrol Koperumnas Group</title>` dan `lang="id"` terkonfirmasi ada di HTML yang sungguh-sungguh dikirim server.

**`.env.local`/`.env.local.example` diganti nama variabel** `VITE_SUPABASE_*` → `NEXT_PUBLIC_SUPABASE_*` sesuai instruksi.

**Efek samping ditemukan & diperbaiki selama migrasi** (tidak diminta eksplisit, tapi blocking/salah kalau dibiarkan):
- `.gitignore` sempat tertimpa total oleh punya scaffold Next.js (termasuk pola `.env*` yang akan meng-ignore `.env.local.example` yang justru harus ter-track) — digabung ulang manual.
- Warning `turbopack.root` ambigu karena ada `package-lock.json` tak terkait di folder induk (di luar repo ini) — diberesi dengan `turbopack.root` eksplisit di `next.config.ts`, bukan menyentuh file di luar repo.

| # | Task | Status | Diverifikasi | Catatan |
|---|---|---|---|---|
| 01 | Fondasi proyek & token desain | ✅ | Dipindah ke Next.js: `npx tsc --noEmit`, `npm run build`, `npm run lint` bersih; `npm run dev` + `curl` ke `/` → HTTP 200, `<title>` dan `lang="id"` terkonfirmasi di HTML sungguhan. | **Di-scaffold ulang total dari Vite ke Next.js 16** (21 Agustus 2026) — lihat bagian "Migrasi stack" di atas. `tokens.css` pindah ke `app/tokens.css`, font Google lewat `next/font/google` (bukan `<link>`), `index.html` digantikan `app/layout.tsx`. |
| 02 | Klien Supabase & sesi login | ✅ (sebagian terverifikasi nyata, sisanya menunggu M9 + migrasi) | `tsc`/`build`/`lint` bersih. **Diuji sungguhan, bukan diasumsikan**: (1) `npm run dev` + `curl` ke `/` tanpa sesi → **HTTP 307 redirect ke `/masuk`**, dan `curl` ke `/masuk` langsung → **HTTP 200, tidak redirect** — proxy benar-benar jalan (log server menunjukkan `proxy.ts: 14ms`), bukan disimpulkan dari kode. (2) `pesanErrorMasuk()` diuji ulang 2 kasus — selalu Bahasa Indonesia. (3) Build menunjukkan baris `ƒ Proxy (Middleware)`, konfirmasi Next.js mengenali `proxy.ts` dengan benar. | **Kode ditulis mengikuti persis** panduan resmi Supabase (`supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth`, dibuka sebelum menulis kode) DAN tipe `@supabase/ssr@0.12.4` yang benar-benar terpasang di `node_modules` (bukan disalin buta dari panduan) — `setAll` di `proxy.ts` memakai parameter `headers` kedua sesuai `SetAllCookies` di `node_modules/@supabase/ssr/dist/main/types.d.ts` (mencegah cookie sesi ke-cache CDN/reverse proxy), `createBrowserClient` tidak diberi opsi `cookies` sama sekali (opsional, ditangani otomatis oleh library — dikonfirmasi dari `createBrowserClient.d.ts`). **`middleware.ts` di task board sudah usang** — dicek ke docs Next.js 16 resmi (`node_modules/next/dist/docs/.../16-proxy.md` + upgrade guide `version-16.md`), dan panduan Supabase yang dibuka juga sudah memakai `proxy`/`proxy.ts`. File dibuat sebagai `proxy.ts` dengan fungsi bernama `proxy`, bukan `middleware.ts`/`middleware`. **Belum bisa diverifikasi** (butuh migrasi Task 03/04 + M9 dulu): login dengan akun CEO sungguhan, `roles` terisi `['ceo','karyawan']`, refresh tidak logout, `signOut` kembali ke `/masuk` — masuk daftar CHECKPOINT 4. `react-hooks/refs` dibatasi ke `components/fields/**/*.tsx` saja lewat `files` di `eslint.config.mjs` (bukan mati global lagi), atas instruksi user. |
| 03 | Migrasi database — tabel inti | ✅ | **Dijalankan dan diverifikasi langsung lewat koneksi Postgres** (`scripts/db.mjs`, `SUPABASE_DB_URL`), bukan cuma dibaca dari layar user: 11 tabel ada persis sesuai nama (`information_schema.tables`), `report_uniq` + `assignment_uniq` ada (`pg_indexes`), `pte_daily.lengkap` adalah generated column `ALWAYS` (`information_schema.columns`), trigger `report_updated` + `pte_daily_updated` ada (`information_schema.triggers`). Ternyata migrasi ini sudah pernah berhasil dijalankan user di sesi sebelumnya (klaim "database kosong" user salah — dibuktikan lewat screenshot Table Editor sebelum sesi verifikasi langsung ini), tidak perlu di-run ulang. | — |
| 04 | Row Level Security | ✅ **CHECKPOINT 2 LOLOS** | **Dijalankan lewat `npm run db -- supabase/migrations/0002_rls.sql`** (exit code 0), diverifikasi: `rls_aktif = true` di 11 tabel, 24 policy persis sesuai spesifikasi (`report_nudge` memang tidak ada), 4 fungsi/RPC ada, 2 policy storage ada. **Lalu matriks uji CHECKPOINT 2 dijalankan sungguhan** lewat `scripts/uji-checkpoint2.mjs` (penyamaran `set role authenticated` + `request.jwt.claims`, sanity check `auth.uid()` di tiap blok, GUC `uji.*`, EXCEPTION tunggal, reset role sebelum anon) — **13 dari 14 baris matriks LOLOS** dengan output mentah dicatat penuh di chat log sesi ini: kontrol positif (accounting lihat punya sendiri) = 1 → GRANT sehat; `pusat`/`kontrol_marketing` 0 baris di laporan accounting; `ceo` bisa lihat; insert atas nama orang lain ditolak; update laporan orang lain/tanggal lampau ditolak; keputusan cuma bisa diputuskan `ceo`; laporan dobel ditolak unique index; shift pagi+siang tidak bentrok; anon 0 baris dengan `auth.uid()` NULL. Seluruh 13 `auth.uid()` berisi UUID benar & konsisten per persona. Data dummy di-`ROLLBACK`, tidak ada yang tersimpan. | #3 (`v_keuangan_rekap`, Task 20) dan #10 (signed URL storage, Task 11) tetap dilewati dengan alasan eksplisit — sudah tercatat di "Utang uji" di bawah. |
| 05 | Seed `policy`, lokasi, outlet | ⬜ | | |
| 06 | Kerangka layout, routing, penjaga peran | ⬜ | | |
| 07 | Tipe `FormSchema` + `FormRenderer` | ✅ | Dipindah ke `forms/types.ts`, `forms/index.ts`, `components/FormRenderer.tsx` (+ `'use client'`). `tsc`/`build`/`lint` bersih. SSR ulang setelah pindah — 10 field render, sama seperti sebelumnya (lihat "Migrasi stack"). | **Masih berlaku dari sebelum migrasi**: perilaku submit → `console.log` interaktif di browser sungguhan belum diuji live (tidak ada tool browser/DOM headless di sesi ini) — lihat CHECKPOINT 4. |
| 08 | Komponen field | ✅ | Dipindah ke `components/fields/*.tsx`, semua + `'use client'`. `tsc`/`build`/`lint` bersih (setelah menonaktifkan false-positive `react-hooks/refs`, lihat "Migrasi stack"). SSR ulang: Uang terformat, StatusWarna/YaTidak/Lampiran/Tabel baca `nilaiAwal` dengan benar — sama seperti sebelum migrasi. | **Masih berlaku dari sebelum migrasi**: readback field tak-terkontrol di browser sungguhan dan uji viewport 360px belum diamati langsung — lihat CHECKPOINT 4. |
| 09 | Aturan bukti wajib | ✅ | Dipindah ke `forms/validasi.ts`. `buildZodSchema().safeParse()` dites ulang 3 kasus di lokasi baru — hasil identik dengan sebelum migrasi, termasuk teks pesan `"Live dicentang tapi belum ada bukti"`. | **Masih berlaku dari sebelum migrasi**: highlight merah muda & `scrollIntoView` belum diamati di browser sungguhan — lihat CHECKPOINT 4. Keputusan desain `buktiWajib` (tombol menempel di baris field, path `_bukti.<fieldKey>`) tidak berubah, sudah dikonfirmasi user sebelumnya. |
| 10 | Simpan draft & kirim laporan | ⬜ | | |
| 11 | Unggah lampiran ke Storage | ⬜ | | |
| 12 | Form `personal_marketing` + sinkron `pte_daily` | ⬜ | | |
| 13 | Form `pic_lokasi` | ⬜ | | |
| 14 | Form `it`, `hrd`, `security`, `perizinan` | ⬜ | | |
| 15 | Form `pembangunan`, `dti`, `kendaraan`, `cs`, `ga` | ⬜ | | |
| 16 | Form `manager_resto`, `ita` | ⬜ | | |
| 17 | Form `accounting` (rahasia) | ⬜ | | |
| 18 | Papan Kontrol | ⬜ | | |
| 19 | Antrean Keputusan CEO | ⬜ | | |
| 20 | View agregasi + dashboard angka CEO | ⬜ | | |
| 21 | Laporan Terpusat Sabrina (auto-isi) | ⬜ | | |
| 22 | Dashboard Kontrol Marketing | ⬜ | | |
| 23 | Halaman admin | ⬜ | | |
| 24 | Uji RLS & deploy | ⬜ | | |

---

## Perkakas `scripts/` (pengecualian dependensi, disetujui user)

`pg` dan `dotenv` dipasang sebagai **devDependency**, di luar stack aplikasi yang dikunci `BLUEPRINT.md` §2 — user menyetujui eksplisit ini karena keduanya cuma dipakai skrip CLI lokal, tidak pernah masuk bundle aplikasi.

- **`scripts/db.mjs`** (`npm run db -- <file.sql | "query">`) — konek langsung ke Postgres lewat `SUPABASE_DB_URL` (pooler Supabase), cetak hasil mentah sebagai tabel. Dipakai untuk verifikasi skema/migrasi. **Koneksi ini adalah pemilik tabel — melewati SELURUH RLS.** Tidak boleh dipakai untuk uji RLS (itu tugas skrip Checkpoint 2 yang menyamar lewat `set role authenticated` + `auth.uid()` sanity check). Ada jaring pengaman `sensor()` yang menyaring string mirip DSN dari pesan error sebelum dicetak, supaya `SUPABASE_DB_URL` tidak pernah nyasar ke layar/log.
- **`scripts/buat-akun.mjs`** (`npm run akun`) — **cikal bakal Task 23**. Pakai `supabase.auth.admin.createUser` (butuh `SUPABASE_SERVICE_ROLE_KEY`, dibaca dari `.env.local`, tidak pernah ditulis ke file lain), baca daftar akun dari `scripts/akun.json` (reusable untuk 36 karyawan nanti, bukan cuma 7 akun uji), idempoten (email yang sudah ada dilewati, dicek lewat `SUPABASE_DB_URL` sebelum createUser — bukan menebak dari pesan error GoTrue). Setelah akun ada, mengisi `profile`+`role` lewat query terparameter yang dibangun dari `akun.json` (bukan SQL statis tersalin ulang), supaya logikanya sama persis untuk 7 atau 36 akun. **Route Handler `app/api/admin/user` di Task 23 nanti memakai logika create-user + isi-profile-role yang sama persis** — skrip ini adalah versi CLI-nya duluan.
- **⚠️ Password sementara `123456` untuk SEMUA akun baru — keputusan sengaja user, bukan kelalaian.** Dipilih supaya tidak perlu klik manual 7× (lalu 36× bulan depan) dan supaya proses verifikasi fitur tetap simpel di tahap ini. **Wajib direset ke password asli per-orang sebelum dipakai karyawan sungguhan** — termasuk akun `ceo` dan `accounting`, dua peran paling sensitif di sistem ini. Belum ada mekanisme reset dibuat; catat ini supaya tidak lupa sebelum go-live.
- Kedua skrip diverifikasi jalan sungguhan: `db.mjs` diuji dengan query sepele dulu sebelum dipakai untuk hal penting; `buat-akun.mjs` dijalankan 2× berturut-turut untuk membuktikan idempotensinya (run kedua: semua "sudah ada, dilewati", tidak ada duplikat role).

---

## Utang uji — CHECKPOINT 4 (verifikasi browser sungguhan)

Belum bisa diuji di sesi ini karena tidak ada tool browser/DOM headless. Bukan diklaim selesai — **wajib dicek ulang saat sampai CHECKPOINT 4**, sebelum lanjut ke batch berikutnya:

- 🔴 **WAJIB — bukan opsional:** ketujuh akun uji (`docs/DATA-KARYAWAN.md` §3) masih berpassword **`123456`**, sama untuk semua, termasuk `ceo` dan `accounting` (pemegang laporan keuangan). Project Supabase ini terjangkau dari internet. **Reset ke password kuat berbeda per orang sebelum data laporan ASLI masuk ke sistem** — jangan lanjut ke pemakaian sungguhan selagi ini masih `123456`. (Ditegaskan ulang oleh user sebagai syarat keras, bukan catatan biasa.)
- Interaksi submit form → `onSubmit` benar-benar terpanggil dengan data yang benar, diklik sungguhan di browser (Task 07)
- Readback nilai *default* untuk field tak-terkontrol berbasis `register()` (angka, teks, teks_panjang, pilih, centang, isi sel tabel) — bergantung pada `useEffect` react-hook-form yang tidak jalan di SSR (Task 08)
- Field `tabel` tidak menyebabkan scroll horizontal di lebar 360px — baru diverifikasi lewat tinjauan kode (`flex-col`), bukan tangkapan layar viewport sungguhan (Task 08)
- Highlight latar merah muda pada baris field yang gagal validasi (Task 09)
- `scrollIntoView` ke field bermasalah pertama saat validasi gagal (Task 09)
- Submit benar-benar tertahan (tidak memanggil `onSubmit`) saat validasi zod gagal — disimpulkan dari cara kerja `handleSubmit`, belum diamati langsung (Task 09)
- Login dengan akun CEO sungguhan berhasil dan `roles` terisi `['ceo','karyawan']` — butuh Task 03/04 (migrasi) + M9 (akun) selesai dulu (Task 02)
- Refresh halaman tidak melempar user keluar (sesi lewat cookie) — perilaku terdokumentasi `@supabase/ssr`, belum diamati langsung di browser (Task 02)
- `signOut()` benar-benar mengembalikan ke `/masuk` saat diklik sungguhan, bukan cuma disimpulkan dari state React (Task 02)

## Utang uji (jangan sampai hilang)

- **Matriks RLS #3** (`select * from v_keuangan_rekap` sebagai `pusat` → harap 4 kolom saja, tanpa saldo bank) — **belum bisa diuji**, view-nya belum ada. Uji ulang begitu `0004_views.sql` dibuat (Task 20).
- **Matriks RLS #10** (buka path storage orang lain tanpa signed URL → harap ditolak) — **belum bisa diuji**, butuh baris nyata di `storage.objects` dari unggahan sungguhan. Uji ulang begitu unggah lampiran jalan (Task 11).

## Catatan lintas-task

- `docs/REFERENSI-FORMAT-LAPORAN.md` yang dirujuk `CLAUDE.md` dan `BLUEPRINT.md` **tidak ada** di folder `docs/`. Yang ada hanya `docs/02-FORMAT-LAPORAN-DIVISI-BARU.md`, isinya cuma 9 dari 15 format (HRD, Security, Perizinan, Pembangunan, DTI, Kendaraan, PIC Lokasi, CS, GA). Format "sudah berjalan" (Personal Marketing, Pusat, Accounting, IT, Manager Resto, Ita) belum ada sumbernya di manapun. Ini akan memblokir Task 12, 14 (sebagian: `it`), 16, 17 sampai dokumen ini disediakan.
- `docs/MODE-OTONOM.md` yang dirujuk instruksi awal tidak ada. Urutan batch & aturan checkpoint diambil dari prompt pertama user langsung, dikonfirmasi user.
- `CLAUDE.md` awalnya ditemukan di `docs/CLAUDE.md`, dipindahkan ke root proyek atas konfirmasi user.
- `docs/01-SPESIFIKASI-SISTEM.md` adalah dokumen LAMA yang sudah digantikan `BLUEPRINT.md` — isinya bertentangan (mengusulkan tabel `laporan_field` bergaya EAV, sedangkan BLUEPRINT memutuskan data laporan disimpan JSONB di `report.data`). Dipindahkan ke `docs/arsip/` atas instruksi user. **Jangan pernah dipakai sebagai acuan.**
- `docs/02-PROMPT-PACK.md` adalah prompt untuk manusia menempel ke agent, bukan dokumen untuk dibaca agent. Dilewati.
- `docs/05-RENCANA-FASE-2.md` adalah rencana setelah Fase 1 selesai. Belum dibaca, jangan dikerjakan sekarang.
