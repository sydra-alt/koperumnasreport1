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
