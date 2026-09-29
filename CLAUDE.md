# CLAUDE.md

Konteks proyek untuk Claude Code. Dibaca otomatis setiap sesi.

## Proyek

Sistem laporan harian **Koperumnas Group** — perusahaan perumahan di Bandung dengan unit usaha tambahan (thrifting, dua restoran, pabrik precast). Menggantikan laporan harian berbasis WhatsApp dengan satu website terpusat.

Dokumen lengkap ada di `docs/`. **Baca `docs/BLUEPRINT.md` dulu.**

## Stack — jangan diganti

Next.js 16 (App Router) · TypeScript · Tailwind v4 · TanStack Query v5 · react-hook-form + zod · @supabase/ssr · Supabase (Postgres, Auth, Storage, RLS) · Vercel

Jangan pasang: React Router (App Router sudah menangani rute), ORM apa pun, Redux/Zustand, MUI/AntD/shadcn, next-auth, library ikon berat, library kompresi gambar.

## Aturan mutlak

1. **Bahasa Indonesia** untuk seluruh teks antarmuka, pesan error, dan label.
2. **Zona waktu Asia/Jakarta** untuk semua perhitungan tanggal. Jangan pernah `toISOString().slice(0,10)`. Pakai helper di `lib/tanggal.ts`.
3. **RLS tidak boleh dimatikan**, pada tahap mana pun, dengan alasan apa pun. Laporan `accounting` hanya boleh terbaca role `ceo`.
4. **Angka aturan bisnis dari tabel `policy`**, bukan hardcode. Rp500.000, Rp300.000, target 20, target 2 — semua lewat `usePolicy()`.
5. **Uang sebagai `bigint`**, satuan rupiah penuh. Tidak pernah float.
6. **Semua form lewat `FormRenderer`** yang dijalankan dari schema di `forms/`. Jangan menulis komponen React per form.
7. **Semua agregasi lewat view Postgres**, jangan dihitung ulang di React.
8. **View wajib `security_invoker = on`**, kalau tidak data rahasia bocor.
9. **Mobile-first.** Diuji di lebar 360px. Sasaran sentuh minimal 44px.
10. **Token desain di `docs/04-CATATAN-TEKNIS.md` §6** (diganti 30 Agustus 2026 -- "ringan, bukan resmi", bukan lagi cetak biru bersudut tajam): `border-radius` 8px input/tombol, 12px kartu, 999px tombol lampirkan — bukan 0. Satu keluarga huruf (`--font`, Plus Jakarta Sans) untuk seluruh antarmuka, tidak ada `text-transform: uppercase`. Baca §6 sebelum menulis CSS/style baru, jangan menebak nilai lama.
11. **`'use client'`** wajib di FormRenderer, semua komponen field, provider, dan apa pun yang memakai hook atau menangani klik. Layout dan halaman penyusun tata letak tetap Server Component.
12. **`SUPABASE_SERVICE_ROLE_KEY` tidak boleh berawalan `NEXT_PUBLIC_`** dan tidak boleh disentuh dari Client Component. Hanya di Route Handler atau Server Action.
13. **`GET /api/pos-handoff` (`lib/posHandoff.ts`) — PENGECUALIAN TERTULIS (25 September 2026, disetujui pemilik proyek):** satu-satunya tempat di repo ini yang menandatangani token untuk sistem LAIN (pos-fnb, proyek Supabase terpisah total). Bukan pengecualian RLS repo ini sendiri (route ini cuma baca sesi cookie milik pemanggil sendiri, sama seperti route lain) — tapi tetap dicatat di sini karena polanya gampang disalahgunakan kalau tidak dipagari eksplisit. Batasnya, jangan dilebarkan tanpa persetujuan baru:
    1. Token membawa `email` + `uid` milik user yang SEDANG login sungguhan di request ini (`supabase.auth.getUser()`) — TIDAK PERNAH atas nama orang lain — plus `nama` dan `akses`.
    2. Kedaluwarsa 60 detik, ditandatangani `POS_HANDOFF_SECRET` (rahasia server, sama nilainya dengan `POS_HANDOFF_SECRET` di pos-fnb — repo terpisah, lihat `src/lib/auth/handoff-token.ts` di sana untuk sisi verifikasi).
    3. **SEJAK 29 September 2026 (disetujui CEO) sistem laporan adalah SUMBER KEBENARAN siapa bekerja di mana** — menggantikan pemetaan manual `/team`. `akses` HANYA berasal dari `akses_pos_saya()` (migrasi 0068) milik penanya sendiri: `peta_akses_pos` (peran laporan ATAU form penugasan -> peran pos-fnb, hanya CEO/Admin), outlet dari penugasan lewat `outlet_pos_map` (`form_akses` untuk Bestie Thrift), `profile.akses_semua_outlet_pos` (semua outlet + audit, hanya CEO/Admin), gerbang `profile.punya_akses_pos`. pos-fnb (`src/lib/auth/provision.ts`) membuat/menyesuaikan akun & membership PERSIS sesuai akses itu pada setiap handoff dan setiap panggilan jembatan AI (penambahan DAN pencabutan).
    4. Batas yang DIJAGA pos-fnb sendiri, tidak bergantung isi token (kalau rahasia bocor, kerusakan terbatas di sini): paling tinggi `manager` (`owner`/`accountant` ditolak), membership `owner` yang sudah ada TIDAK PERNAH disentuh, outlet disaring ke bisnisnya, akun baru ber-password acak yang tidak pernah dicetak/disimpan. Jangan menambah field lain ke payload, dan jangan melonggarkan batas ini, tanpa persetujuan baru.
    5. **Pemakai kedua (28 September 2026): jembatan Asisten AI** (`lib/ai/jembatanPos.ts` -> `POST /api/ai/tools` pos-fnb). Fungsi tanda tangan, secret, TTL, dan isi payload SAMA (`buatTokenPos`), cuma `aud` = `pos-fnb-ai-query` — pos-fnb memeriksa aud eksplisit, jadi token AI tidak bisa dipakai login `/handoff` dan sebaliknya. Satu token baru per permintaan (satu per putaran alat). pos-fnb yang menentukan cakupan outlet dari membership user yang dipetakan; tidak ada pemetaan = data POS kosong (`tanpa_akses_pos`), bukan query tanpa cakupan.
    6. **Impor opname Excel (29 September 2026, fase 2):** token AI yang sama juga dipakai `POST /api/ai/opname-import` pos-fnb (`panggilImporOpnamePos`) -- endpoint itu HANYA menyimpan `opname_imports`, tidak pernah `stock_opnames`/ledger. Tautan "Buka draf" memakai query `next` di `/api/pos-handoff` -- TERPISAH dari token, bukan field payload -- dengan daftar putih ketat yang sama persis di dua sisi (`NEXT_POS_DIIZINKAN` di sini, `safeHandoffNext()` di pos-fnb): HANYA `/stock-opnames?import=<uuid>` dan (sejak 29 September 2026, disetujui CEO, impor resep lewat `POST /api/ai/recipe-import` yang HANYA menyimpan `recipe_imports`, tidak pernah resep) `/recipes?import=<uuid>`, dan (29 September 2026, disetujui CEO, tinjauan jenis ukuran bahan lewat `POST /api/ai/measure-review` yang HANYA menyimpan usulan AI di `ingredient_measure_reviews`, tidak pernah mengisi jenis ukuran) `/ingredients/jenis-ukuran?review=<uuid>`. SATU pola persis per jenis impor/tinjauan, tidak pernah wildcard; jenis impor baru = pola persis baru + persetujuan baru. Jangan dilonggarkan jadi "path relatif apa pun" (open redirect). Untuk impor resep dan tinjauan jenis ukuran, datanya berlaku seluruh bisnis (bukan per outlet), jadi syaratnya "boleh mengubah resep/bahan" (`product.manage`, owner/manajer); selain itu dijawab "tidak ditemukan". **id impor BUKAN kunci akses** (syarat persetujuan CEO): membuka tautan itu memeriksa ulang bahwa outlet impor ada dalam cakupan POS penonton DAN penonton boleh input opname di sana (`openImportAsDraftWithDb` + RLS `opname_imports` per `auth_outlet_ids`); pemegang tautan dari outlet lain mendapat jawaban yang sama persis dengan id yang tidak ada.
14. **Asisten AI (`/asisten`, `app/api/ai/chat`, `lib/ai/`) — Gemini TIDAK PERNAH menulis SQL dan TIDAK PERNAH memegang service-role key.** Ia cuma memilih alat dari daftar tetap (`lib/ai/alat.ts`); alat lokal memanggil fungsi `ai_*` (migrasi 0064) lewat klien Supabase MILIK PENANYA, jadi RLS sama persis dengan layar biasa. Alat baru = fungsi baru di daftar itu + (kalau lokal) fungsi SQL `security invoker`, bukan jalur query bebas. Siapa boleh memakai = PER ORANG, `profile.punya_akses_ai` (migrasi 0067, hanya CEO/Admin yang boleh mengubah, lewat Admin) — BUKAN per peran; batas pesan = policy `ai_batas_pesan_harian` (ditegakkan trigger di database, hanya pertanyaan yang terjawab yang memakai jatah). `GEMINI_API_KEY` cuma env server Vercel — tidak pernah `NEXT_PUBLIC_`, tidak pernah di `.env.local`, tidak pernah dicetak/di-log. Setiap panggilan alat WAJIB tercatat di `ai_panggilan_alat`; kalau pencatatan gagal, jawaban tidak diberikan. **Batas hak BUKAN data kosong** (CEO, 28 September 2026): jalur yang ditolak/dibatasi izin TIDAK PERNAH boleh kembali sebagai hasil kosong -- itu terbaca "angkanya nol" tentang bisnis. Pakai status `tidak_berhak` / `kosong_dalam_hak` / `outlet_di_luar_hak` / `tanpa_akses_pos` (`PESAN_STATUS` di `lib/ai/alat.ts`); `tidak_ada_data` HANYA kalau penanya melihat semuanya (`ai_cakupan()`). Begitu juga "asisten belum diaktifkan" (policy hilang/batas 0) TIDAK PERNAH boleh terbaca "jatah habis". **Angka utama dihitung SERVER** (CEO, 29 September 2026): untuk alat apa pun yang angka utamanya hitungan atau jumlah, server menghitungnya (`lib/ai/angkaUtama.ts` -> `ringkasan`/`ringkasan_per_outlet`) dan model HANYA mengutip -- tidak pernah menjumlahkan baris sendiri. Kalimat model yang memuat angka lain, atau menempelkan angka ke outlet yang bukan pemiliknya, diganti kalimat server (`periksaKalimat` di `lib/ai/agen.ts`). Alat baru wajib punya cabang di `hitungAngkaUtama`.

## Cara kerja

- Satu task per instruksi, berurutan dari `docs/01-TASK-BOARD.md`. Jangan lompat, jangan gabung.
- Jelaskan rencana maksimal 8 baris sebelum menulis kode, lalu tunggu persetujuan.
- Setelah selesai, laporkan bagian "Selesai kalau" mana yang sudah diverifikasi dan bagaimana caranya.
- Kalau dokumen tidak jelas, **bertanya**. Jangan menebak lalu jalan terus.
- Kalau menurutmu ada yang salah di skema atau spesifikasi, berhenti dan tunjukkan. Jangan diperbaiki diam-diam.

## Perintah

```bash
npm run dev      # pengembangan
npm run build    # wajib bersih sebelum commit — build Next.js ikut mengecek tipe
npx tsc --noEmit # cek tipe cepat
npm run lint     # eslint bawaan Next.js
```

## Peta dokumen

| File | Isi |
|---|---|
| `docs/MULAI-DI-SINI.md` | Langkah pertama memulai proyek |
| `docs/MODE-OTONOM.md` | Urutan batch & checkpoint wajib |
| `docs/PROGRESS.md` | Catatan kemajuan — diperbarui agent tiap task |
| `docs/BLUEPRINT.md` | Dokumen induk — menang atas dokumen lain |
| `docs/00-SETUP-MANUAL.md` | Langkah manual manusia (Supabase, env, akun) |
| `docs/01-TASK-BOARD.md` | 24 task berurutan + kriteria selesai |
| `docs/02-PROMPT-PACK.md` | Prompt per task (untuk manusia) |
| `docs/03-CALC-SPEC.md` | Rumus PTE, potongan, agregasi, zona waktu |
| `docs/04-CATATAN-TEKNIS.md` | SQL skema, RLS, matriks uji, token desain |
| `docs/05-RENCANA-FASE-2.md` | Setelah fase 1 — jangan dikerjakan dulu |
| `docs/06-RENCANA-PRESENSI-MOBILE.md` | Tampilan mobile (selesai) + presensi & ekspor (belum, tunggu keputusan CEO) |
| `docs/07-CATATAN-PELUNCURAN.md` | Urutan peluncuran ke 36 karyawan, blocker data, gerbang `pte_mulai_berlaku` |
| `docs/REFERENSI-FORMAT-LAPORAN.md` | Isi lengkap 15 form |

## Asumsi yang belum dikonfirmasi klien

Ada di `docs/BLUEPRINT.md` §7. Nilainya sudah ada di tabel `policy`. Kalau klien menjawab berbeda, yang berubah hanya isi tabel — bukan kode. Kalau ada bagian kode yang membuat asumsi ini sulit diubah, itu bug.
