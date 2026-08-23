# BLUEPRINT — Sistem Laporan Harian Koperumnas Group

> Dokumen induk. Semua file lain di `docs/` menjabarkan bagian dari dokumen ini.
> Kalau ada pertentangan antar dokumen, **BLUEPRINT.md yang menang**.

---

## 1. Apa yang dibangun

Website laporan harian terpusat untuk Koperumnas Group. Setiap divisi mengisi form harian, dan laporan Ibu Sabrina serta dashboard CEO **terisi otomatis** dari isian divisi. Menggantikan laporan berbasis WhatsApp.

**Satu kalimat untuk agent:** aplikasi web multi-peran, mobile-first, di mana 15 jenis form harian di-render dari schema, disimpan sebagai JSONB di Supabase, lalu diagregasi jadi tiga dashboard (CEO, Pusat Pelaporan, Kontrol Marketing).

---

## 2. Stack — sudah diputuskan, jangan diganti

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Frontend | **Next.js 16 (App Router) + TypeScript** | |
| Styling | **Tailwind CSS v4** | token warna di `app/tokens.css` |
| Routing | **App Router** — berbasis folder di `app/` | tidak pakai React Router |
| Data | **TanStack Query v5** | semua akses Supabase lewat hook di `lib/api/` |
| Auth klien | **@supabase/ssr** | sesi lewat cookie, bukan localStorage |
| Form | **react-hook-form + zod** | |
| Backend | **Supabase** | Postgres, Auth, Storage, RLS, Edge Functions |
| Deploy | **Vercel** (frontend) | Supabase hosted |
| Bahasa UI | **Bahasa Indonesia**, semua label | |
| Zona waktu | **Asia/Jakarta (WIB)** | semua perhitungan tanggal pakai ini, bukan UTC |
| Mata uang | Rupiah, disimpan `bigint` **tanpa desimal** | tampilkan `Intl.NumberFormat('id-ID')` |

Tidak pakai: Prisma atau ORM apa pun, state manager global (Redux/Zustand), UI kit berat (MUI/AntD), `next-auth` (autentikasi sepenuhnya lewat Supabase Auth).

**Kenapa Next.js, bukan Vite.** Keputusan diambil ulang pada 21 Agustus 2026. Dua alasan: tim yang merawat sistem ini sudah menguasai Next.js, dan Fase 2 membutuhkan kode sisi server untuk notifikasi WhatsApp, pembuatan akun massal ber-`service_role`, serta silang-cek terjadwal — ketiganya cukup memakai Route Handler di `app/api/`, tanpa perlu Supabase Edge Function.

---

## 3. Keputusan arsitektur yang paling penting

### 3.1 Satu renderer untuk 15 form

Form **tidak** ditulis satu per satu sebagai komponen React. Setiap form didefinisikan sebagai schema TypeScript di `src/forms/`, lalu di-render oleh satu komponen `<FormRenderer schema={...} />`.

Alasan: format laporan Koperumnas masih akan sering berubah. Kalau form ditulis manual, setiap perubahan berarti ubah kode. Dengan schema, cukup ubah satu file data.

```
src/forms/
  types.ts            ← tipe FormSchema, Block, Field
  index.ts            ← registry: form_key → schema
  f01-personal-marketing.ts
  f02-pusat.ts
  ...
  f15-ga.ts
```

### 3.2 Data laporan disimpan sebagai JSONB, bukan kolom per field

Tabel `report` punya kolom `data jsonb`. Isian form masuk ke situ apa adanya.

Alasan: 15 form × puluhan field = ratusan kolom kalau dinormalisasi, dan berubah tiap kali format direvisi. JSONB + index GIN sudah cukup cepat untuk skala perusahaan ini.

**Pengecualian** — tiga hal ini punya tabel sendiri karena dipakai untuk perhitungan dan agregasi lintas laporan:
- `pte_daily` — kepatuhan PTE harian
- `closing` — closing konsumen
- `decision` — antrean keputusan CEO

### 3.3 Kerahasiaan ditegakkan di database, bukan di frontend

Laporan Accounting hanya boleh dilihat CEO. Ini **wajib** lewat Row Level Security di Postgres. Menyembunyikan tombol di React tidak dihitung sebagai keamanan.

Fungsi penentu: `public.can_see_report(form_key, author_id)` di `04-CATATAN-TEKNIS.md`.

### 3.4 Server Component adalah default, Client Component adalah pengecualian

Di App Router, setiap file adalah Server Component kecuali diberi `'use client'` di baris pertama.

Yang **wajib** `'use client'`: `FormRenderer`, seluruh komponen field, penyedia TanStack Query, penyedia Auth, dan apa pun yang memakai `useState`, `useEffect`, atau menangani klik.

Yang **tetap** Server Component: layout, halaman yang hanya menyusun tata letak, dan pengambilan data awal.

Ini sumber bug paling sering pada kode Next.js yang ditulis agent. Kalau muncul error semacam *"useState only works in Client Components"*, penyebabnya selalu `'use client'` yang lupa dipasang.

### 3.5 Kunci Supabase yang boleh terbaca browser

`NEXT_PUBLIC_*` **ikut terkirim ke browser** — itu memang tujuannya, dan aman untuk anon key karena RLS yang menjaga data.

`SUPABASE_SERVICE_ROLE_KEY` **tanpa** awalan `NEXT_PUBLIC_`, hanya boleh dibaca di Route Handler atau Server Action. Kunci itu melewati seluruh RLS. Salah menaruh awalan `NEXT_PUBLIC_` di depannya sama dengan membocorkan seluruh database.

### 3.5b Satu angka, satu pengisi

Setiap besaran hanya boleh diketik oleh **satu orang** — yang paling dekat dengan kenyataannya. Semua orang lain menerimanya sebagai angka terisi otomatis, hanya baca.

Contoh yang menentukan: jumlah unit dibangun diketik **PIC Lokasi**, karena merekalah yang berdiri di lokasi dan menghitung. Kepala Pembangunan **tidak** mengetik ulang totalnya — form dia menampilkan jumlah dari seluruh PIC lokasi sebagai angka terisi.

Kalau dua orang mengetik besaran yang sama, angkanya pasti berbeda cepat atau lambat, dan CEO akan melihat dua jumlah unit yang bertentangan di dua layar. Sejak saat itu kedua angka kehilangan kepercayaan, bukan hanya yang salah.

Form Kepala Pembangunan berisi hal yang hanya dia tahu: kontraktor, material, infrastruktur, pengawasan kualitas, dan **catatan selisih** kalau angka dari PIC lokasi menurutnya tidak sesuai kenyataan lapangan.

**Bedakan duplikasi dari silang-cek.** Duplikasi: dua orang mengetik hal yang sama, salah satunya pasti salah — hapus salah satunya. Silang-cek: dua orang mengukur hal yang **berbeda** yang seharusnya mirip — pertahankan keduanya, dan munculkan selisihnya sebagai peringatan.

Contoh silang-cek yang sehat: satpam menghitung tamu yang masuk gerbang, PIC lokasi menghitung konsumen yang dilayani. Kalau 12 orang masuk tapi hanya 5 dilayani, selisih 7 itu justru yang perlu ditanyakan.

Ditemukan saat Batch D, 22 Agustus 2026.

### 3.6 Aturan bisnis hidup di tabel `policy`, bukan hardcode

Nilai seperti Rp500.000, Rp300.000, target 20 undangan, target 2 closing, hari kerja, dan jam batas laporan disimpan di tabel `policy` sebagai JSONB. Jangan tulis angka ini di kode React.

Alasan: beberapa aturan belum dikonfirmasi klien (lihat bagian 7). Sistem harus bisa berubah tanpa deploy ulang.

---

## 4. Peran & hak akses

| Peran (`role`) | Mengisi | Melihat |
|---|---|---|
| `ceo` | Keputusan/ACC | **Semua**, termasuk Accounting |
| `pusat` (Ibu Sabrina) | Laporan Terpusat | Semua **kecuali** detail Accounting — hanya rekap 4 angka |
| `accounting` | Laporan Accounting | Keuangan + laporan resto & Ita (untuk rekonsiliasi) |
| `kontrol_marketing` (Fauzi, Dea) | Catatan tindak lanjut | Seluruh laporan personal marketing |
| `kadiv` | Form divisinya | Laporan divisinya sendiri |
| `pic_lokasi` | Form lokasinya | Lokasi yang di-assign |
| `manager_resto` | Form outletnya | Outletnya + status PTE karyawan outletnya |
| `karyawan` | Laporan Personal Marketing | Laporannya sendiri |

Satu user bisa punya banyak role. **Setiap user aktif otomatis punya role `karyawan`** — tidak ada pengecualian, termasuk CEO, IT, dan Accounting.

---

## 5. Daftar form

| form_key | Nama | Scope | Pengisi |
|---|---|---|---|
| `personal_marketing` | Laporan Personal Marketing | user | semua karyawan |
| `pusat` | Laporan Terpusat | global | Sabrina |
| `accounting` | Laporan Accounting (rahasia) | global | Accounting |
| `it` | Laporan IT | global | PIC IT |
| `manager_resto` | Laporan Manager Resto | outlet | manager |
| `ita` | Thrifting & Kontrol F&B | global | Ita |
| `hrd` | Laporan HRD | global | HRD |
| `security` | Laporan Security | lokasi + shift | satpam |
| `perizinan` | Laporan Perizinan | global | PIC perizinan |
| `pembangunan` | Laporan Pembangunan | global | kepala pembangunan |
| `dti` | Laporan DTI/Precast | global | PIC DTI |
| `kendaraan` | Laporan Kendaraan & Driver | global | koordinator driver |
| `pic_lokasi` | Laporan PIC Lokasi | lokasi | PIC tiap lokasi |
| `cs` | Laporan Customer Service | global | CS |
| `ga` | Operasional Kantor | global | GA |

Isi lengkap tiap form ada di `REFERENSI-FORMAT-LAPORAN.md`.

---

## 6. Tiga layar utama

**A. Papan Kontrol** (CEO & Pusat) — grid kartu, satu kartu per laporan yang ditunggu hari ini. Warna 🟢🟡🔴 dari `report.warna`, kartu putus-putus kalau belum lapor. Di atasnya bar `12 / 16 PIC sudah melapor`.

**B. Antrean Keputusan** (CEO) — semua `decision` berstatus `menunggu` dari seluruh laporan, urut prioritas. CEO menekan Setujui / Cicil / Tunda / Tolak, tersimpan dengan jejak waktu.

**C. Form harian** (semua pengisi) — mobile-first. Satu halaman, blok bertingkat, tombol lampirkan bukti menempel di baris yang butuh bukti.

Prototipe visual dari ketiganya ada di file `prototipe-koperumnas.html` (di luar repo, sebagai acuan tampilan).

---

## 7. Asumsi yang BELUM dikonfirmasi klien

Agent **boleh jalan** dengan asumsi ini, tapi nilainya harus masuk tabel `policy` supaya gampang diubah. Jangan hardcode.

| # | Hal | Asumsi sementara | Kunci `policy` |
|---|---|---|---|
| A1 | Syarat PTE Rp500.000 | Hangus kalau bolong 1 hari dalam sebulan | `pte_bonus_rule = "no_gap"` |
| A2 | Hari wajib lapor | Senin–Sabtu, Minggu libur | `workdays = [1,2,3,4,5,6]` |
| A3 | Jam batas laporan | 18.00 WIB, kecuali resto 23.00 dan security per shift | `deadline_by_form` |
| A4 | Potongan closing | Rp300.000 dipotong sekali di akhir bulan kalau closing < 2 | `closing_penalty` |
| A5 | Jumlah lokasi | 3 lokasi contoh (Ciwidey, Pangalengan, Soreang) | data seed |
| A6 | Login | Email + password, akun dibuat admin. Karyawan tanpa email pakai `nama@koperumnas.local` | — |

Kalau klien menjawab berbeda, yang berubah **hanya isi tabel `policy` dan data seed** — bukan kode.

---

## 8. Fase

| Fase | Isi | Dokumen |
|---|---|---|
| **1** | Auth, peran, form renderer, 15 form, papan kontrol, antrean keputusan, PTE & marketing, dashboard | `01-TASK-BOARD.md` |
| **2** | Notifikasi WhatsApp, mode offline, kompresi video, laporan bulanan, ekspor, silang-cek otomatis | `05-RENCANA-FASE-2.md` |

Fase 1 adalah target. Jangan kerjakan apa pun dari fase 2 sebelum fase 1 selesai dan dites.

---

## 9. Urutan baca untuk agent

1. `BLUEPRINT.md` — file ini
2. `00-SETUP-MANUAL.md` — yang harus dikerjakan **manusia** lebih dulu
3. `04-CATATAN-TEKNIS.md` — skema database, RLS, struktur folder
4. `03-CALC-SPEC.md` — rumus perhitungan, harus persis
5. `01-TASK-BOARD.md` — kerjakan berurutan
6. `02-PROMPT-PACK.md` — prompt siap tempel per task
7. `REFERENSI-FORMAT-LAPORAN.md` — isi tiap form
