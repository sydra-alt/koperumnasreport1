# 01 — TASK BOARD (Fase 1)

> Kerjakan **berurutan**. Satu task = satu commit. Jangan lompat.
> Setiap task punya bagian **Selesai kalau** — kalau belum semua terpenuhi, task belum selesai.
> Prompt siap tempel untuk tiap task ada di `02-PROMPT-PACK.md`.

Syarat mulai: seluruh checklist `00-SETUP-MANUAL.md` M1–M7 sudah ✅.

---

## Ringkasan

| # | Task | Tergantung |
|---|---|---|
| 01 | Fondasi proyek & token desain | — |
| 02 | Klien Supabase & sesi login | 01 |
| 03 | Migrasi database — tabel inti | — |
| 04 | Row Level Security | 03 |
| 05 | Seed `policy`, lokasi, outlet | 03 |
| 06 | Kerangka layout, routing, penjaga peran | 02 |
| 07 | Tipe `FormSchema` + `FormRenderer` | 01 |
| 08 | Komponen field | 07 |
| 09 | Aturan bukti wajib | 08 |
| 10 | Simpan draft & kirim laporan | 04, 07 |
| 11 | Unggah lampiran ke Storage | 10 |
| 12 | Form `personal_marketing` + sinkron `pte_daily` | 11 |
| 13 | Form `pic_lokasi` | 12 |
| 14 | Form `it`, `hrd`, `security`, `perizinan` | 13 |
| 15 | Form `pembangunan`, `dti`, `kendaraan`, `cs`, `ga` | 14 |
| 16 | Form `manager_resto`, `ita` | 15 |
| 17 | Form `accounting` (rahasia) | 16 |
| 18 | Papan Kontrol | 10 |
| 19 | Antrean Keputusan CEO | 10 |
| 20 | View agregasi + dashboard angka CEO | 17 |
| 21 | Laporan Terpusat Sabrina (auto-isi) | 20 |
| 22 | Dashboard Kontrol Marketing | 12 |
| 23 | Halaman admin | 04 |
| 24 | Uji RLS & deploy | semua |

---

## TASK 01 · Fondasi proyek & token desain

**Kerjakan**
- Buat `app/tokens.css` berisi variabel CSS dari palet cetak-biru (lihat `04-CATATAN-TEKNIS.md` §6), impor di `app/layout.tsx`
- Buat struktur folder sesuai `04-CATATAN-TEKNIS.md` §5
- Pasang `Barlow Condensed`, `IBM Plex Sans`, `IBM Plex Mono` memakai `next/font/google` di `app/layout.tsx` — bukan `<link>` manual
- Set `lang="id"` di `<html>`, dan `metadata.title = 'Pusat Kontrol Koperumnas Group'`

**Selesai kalau**
- `npm run dev` jalan tanpa error
- Halaman kosong sudah memakai font dan warna latar dari token
- `npm run build` lolos

**Jangan** memasang UI kit (MUI, AntD, shadcn), library ikon berat, atau React Router.

---

## TASK 02 · Klien Supabase & sesi login

**Kerjakan**
- `lib/supabase/client.ts` (`createBrowserClient`) dan `lib/supabase/server.ts` (`createServerClient` + `cookies()`), keduanya dari `@supabase/ssr`
- `proxy.ts` di root — menyegarkan sesi dan mengalihkan pengunjung belum login ke `/masuk`. Di Next.js 16 berkas ini bernama `proxy.ts` dengan fungsi `proxy`, bukan `middleware.ts` lagi
- `lib/auth/AuthProvider.tsx` (`'use client'`) — context berisi `session`, `profile`, `roles[]`, `assignments[]`, `loading`, `signIn`, `signOut`
- Halaman `app/masuk/page.tsx` — form email + password, pesan error berbahasa Indonesia
- Setelah login, ambil `profile`, `role`, dan `assignment` milik user

**Selesai kalau**
- Login dengan akun CEO (dibuat di M9) berhasil dan `roles` terisi `['ceo','karyawan']`
- Refresh halaman tidak melempar user keluar (sesi lewat cookie, bukan localStorage)
- Membuka `/papan` tanpa login dialihkan ke `/masuk` oleh proxy, bukan oleh kode di komponen
- Keluar (`signOut`) mengembalikan ke `/masuk`
- Salah password memunculkan pesan Indonesia, bukan teks Inggris dari Supabase

---

## TASK 03 · Migrasi database — tabel inti

**Kerjakan**
- Buat `supabase/migrations/0001_init.sql`
- Isi persis seperti `04-CATATAN-TEKNIS.md` §1 dan §2: enum, tabel `profile`, `role`, `lokasi`, `outlet`, `assignment`, `report`, `attachment`, `pte_daily`, `closing`, `decision`, `policy`, plus index
- Jalankan lewat Supabase SQL Editor (tempel isinya) atau `supabase db push`

**Selesai kalau**
- Semua tabel muncul di **Table Editor**
- `report` punya unique index yang mencegah dobel laporan (form + tanggal + author + scope)
- Kolom `pte_daily.lengkap` adalah generated column dan ikut terisi otomatis

**Jangan** menambah tabel di luar yang tertulis. Kalau merasa perlu, tulis alasannya di `04-CATATAN-TEKNIS.md` dulu.

---

## TASK 04 · Row Level Security

**Kerjakan**
- `supabase/migrations/0002_rls.sql`
- Fungsi `has_role(text)` dan `can_see_report(text, uuid)` — `security definer`, `set search_path = public`
- Aktifkan RLS di **semua** tabel dan pasang policy sesuai `04-CATATAN-TEKNIS.md` §3
- Policy Storage untuk bucket `bukti`

**Selesai kalau** (uji manual di SQL Editor pakai `set request.jwt.claims`)
- User ber-role `pusat` **tidak** bisa `select` baris `report` dengan `form_key = 'accounting'`
- User ber-role `ceo` bisa
- User biasa (`karyawan` saja) hanya melihat laporannya sendiri
- User tidak bisa `insert` report atas nama orang lain
- Semua tabel menunjukkan `rls_enabled = true`

⚠️ Ini task paling penting untuk keamanan. Jangan lanjut ke task 05 sebelum keempat pengujian di atas benar-benar dijalankan.

---

## TASK 05 · Seed `policy`, lokasi, outlet

**Kerjakan**
- `supabase/migrations/0003_seed.sql`
- Isi tabel `policy` dengan seluruh kunci di `03-CALC-SPEC.md` §1
- Isi `lokasi`: Ciwidey, Pangalengan, Soreang (data sementara, lihat asumsi A5)
- Isi `outlet`: Indosteak, Indokopi

**Selesai kalau**
- `select * from policy` mengembalikan minimal 9 baris
- Frontend bisa membaca `policy` (buat hook `usePolicy()` di `src/api/policy.ts`)

---

## TASK 06 · Kerangka layout, routing, penjaga peran

**Kerjakan**
- Header bergaya kop gambar teknik: nama grup, tanggal WIB, tab peran
- Tab peran **hanya menampilkan peran yang benar-benar dimiliki user**
- Rute berbasis folder di `app/`: `masuk`, `/`, `lapor/[formKey]`, `papan`, `keputusan`, `marketing`, `terpusat`, `admin`
- `<Terlindungi peran="ceo">` — komponen penjaga; kalau tidak berhak, tampilkan halaman "Tidak punya akses", bukan halaman kosong
- Mobile-first: sasaran sentuh minimal 44px, tidak ada scroll horizontal di lebar 360px

**Selesai kalau**
- User ber-role `karyawan` saja hanya melihat menu laporan personalnya
- Buka `/keputusan` sebagai non-CEO memunculkan halaman "Tidak punya akses"
- Di lebar 360px tidak ada elemen yang terpotong

---

## TASK 07 · Tipe `FormSchema` + `FormRenderer`

**Kerjakan**
- `src/forms/types.ts`:

```ts
export type FieldType =
  | 'angka' | 'uang' | 'teks' | 'teks_panjang' | 'pilih'
  | 'ya_tidak' | 'centang' | 'status_warna' | 'tabel' | 'lampiran';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  wajib?: boolean;
  buktiWajib?: boolean;          // centang tanpa lampiran → ditolak
  pilihan?: string[];            // untuk 'pilih'
  kolom?: { key: string; label: string; type: FieldType }[]; // untuk 'tabel'
  bantuan?: string;
  min?: number; max?: number;
}

export interface Block { id: string; judul: string; catatan?: string; fields: Field[]; }

export interface FormSchema {
  key: string;
  nama: string;
  scope: 'global' | 'lokasi' | 'outlet' | 'user';
  rahasia?: boolean;             // true hanya untuk 'accounting'
  blocks: Block[];
}
```

- `src/components/FormRenderer.tsx` — menerima `schema`, membangun form dengan react-hook-form
- `src/forms/index.ts` — registry `Record<string, FormSchema>`

**Selesai kalau**
- Satu schema contoh berisi 3 field ter-render dan nilainya terbaca di `console.log` saat submit
- Menambah field di schema langsung muncul di layar tanpa ubah komponen

---

## TASK 08 · Komponen field

**Kerjakan** satu komponen per `FieldType` di `src/components/fields/`. Ketentuan:
- `angka` — `inputMode="numeric"`, tidak boleh negatif kecuali `min` diset
- `uang` — tampilkan `Rp1.234.567` saat blur, simpan sebagai integer polos
- `status_warna` — tiga tombol besar 🟢 Aman / 🟡 Dikawal / 🔴 Urgent
- `tabel` — baris bisa ditambah/hapus, di HP tampil sebagai kartu bertumpuk, bukan tabel menyamping
- `lampiran` — tombol, `accept="image/*,video/*"`, `capture` di mobile, tampilkan pratinjau nama file

**Selesai kalau**
- Semua tipe bisa diisi dan dibaca ulang dari nilai tersimpan
- Di HP, field `tabel` tidak menyebabkan scroll horizontal

---

## TASK 09 · Aturan bukti wajib

**Kerjakan**
- Validasi zod dinamis dari schema
- Aturan: kalau field ber-`buktiWajib` diisi/dicentang **dan** tidak ada lampiran → submit ditolak
- Pesan error dikelompokkan di atas tombol kirim, bahasa Indonesia, sebutkan nama fieldnya
- Baris yang bermasalah diberi latar merah muda dan di-scroll ke tampilan

**Selesai kalau**
- Mencentang "Live" tanpa lampiran lalu menekan kirim → laporan **tidak** terkirim dan muncul pesan `Live dicentang tapi belum ada bukti`
- Setelah lampiran ditambahkan, kirim berhasil

Ini menegakkan aturan tertulis klien: *"Tidak cukup hanya menulis 'sudah'. Harus ada bukti."*

---

## TASK 10 · Simpan draft & kirim laporan

**Kerjakan**
- `src/api/report.ts` — `useReportHariIni(formKey, scopeId)`, `useSimpanDraft()`, `useKirimReport()`
- Draft tersimpan otomatis ke Supabase tiap 5 detik setelah berhenti mengetik
- Saat kirim: set `status`, `warna`, `submitted_at`
- Tentukan `terlambat` dengan membandingkan jam kirim WIB terhadap `policy.deadline_by_form`
- Kalau laporan hari ini sudah ada, buka isinya (jangan buat baris baru)

**Selesai kalau**
- Isi form → refresh browser → isian masih ada
- Kirim dua kali tidak membuat dua baris di tabel `report`
- Kirim lewat jam batas menghasilkan `status = 'terlambat'`

---

## TASK 11 · Unggah lampiran ke Storage

**Kerjakan**
- Unggah ke bucket `bukti`, path `{report_id}/{field_key}/{uuid}.{ext}`
- Simpan baris di tabel `attachment` termasuk `captured_at` kalau tersedia dari metadata file
- Kompres gambar di sisi browser sebelum unggah (sisi terpanjang maks 1600px, JPEG kualitas 0,8) memakai `canvas` — tanpa library tambahan
- Tampilkan bilah progres per file
- Tampilkan file dengan **signed URL**, bukan URL publik

**Selesai kalau**
- Foto 4 MB dari HP terunggah jadi di bawah 500 KB
- File tidak bisa dibuka tanpa signed URL (uji: tempel path mentah di browser → ditolak)
- Video tidak dikompres, hanya ditolak kalau lebih dari 50 MB, dengan pesan yang jelas

---

## TASK 12 · Form `personal_marketing` + sinkron `pte_daily`

**Kerjakan**
- Schema `f01-personal-marketing.ts` sesuai `REFERENSI-FORMAT-LAPORAN.md`
- Saat laporan dikirim, `upsert` ke `pte_daily` (lihat rumus di `03-CALC-SPEC.md` §2)
- Tulis baris `closing` untuk tiap closing yang dilaporkan
- Tampilkan progres berjalan: `undangan ___ / 20`, `closing ___ / 2`, diambil dari `policy`

**Selesai kalau**
- Mengirim laporan lengkap membuat `pte_daily.lengkap = true`
- Mencentang 5 dari 6 kewajiban → `lengkap = false`
- Angka `___ / 20` naik sesuai akumulasi bulan berjalan, bukan angka yang diketik user

---

## TASK 13 · Form `pic_lokasi`

**Kerjakan**
- Schema `f13-pic-lokasi.ts`
- Scope `lokasi`: kalau user meng-assign lebih dari satu lokasi, minta pilih lokasi dulu
- Blok "Butuh keputusan CEO": kalau dicentang dan judul terisi, buat baris `decision` saat kirim
- Foto/video progress bersifat wajib setiap hari (`buktiWajib`)

**Selesai kalau**
- PIC dengan 2 lokasi bisa mengirim 2 laporan terpisah di hari yang sama
- Mencentang eskalasi membuat 1 baris di `decision` berstatus `menunggu`
- Kirim tanpa foto progress ditolak

---

## TASK 14 · Form `it`, `hrd`, `security`, `perizinan`

**Kerjakan** empat schema sesuai `REFERENSI-FORMAT-LAPORAN.md`. Khusus `security`: scope lokasi **dan** shift (pagi/siang/malam), sehingga satu lokasi bisa punya 3 laporan per hari.

**Selesai kalau** keempat form bisa diisi, dikirim, dan muncul di Papan Kontrol; laporan security tidak saling menimpa antar shift.

---

## TASK 15 · Form `pembangunan`, `dti`, `kendaraan`, `cs`, `ga`

**Kerjakan** lima schema sesuai referensi. Blok "Butuh keputusan CEO" dipasang di kelimanya.

**Selesai kalau** kelima form terkirim dan eskalasi dari mana pun masuk ke antrean yang sama.

---

## TASK 16 · Form `manager_resto`, `ita`

**Kerjakan**
- `manager_resto` — scope outlet, termasuk daftar 10 video kontrol wajib
- `ita` — termasuk blok Stock Opname yang **hanya muncul hari Senin** (cek hari dalam zona WIB)
- Kedua form punya field selisih; kalau selisih ≠ 0, field penyebab jadi wajib

**Selesai kalau**
- Blok stock opname muncul Senin, hilang di hari lain
- Mengisi selisih tanpa penyebab ditolak
- 10 video kontrol wajib dilampirkan, kurang satu pun ditolak

---

## TASK 17 · Form `accounting` (rahasia)

**Kerjakan**
- Schema `f03-accounting.ts` dengan `rahasia: true`
- Form ini hanya dapat dibuka oleh role `accounting` dan `ceo`
- Beri penanda visual jelas di header form: **CONFIDENTIAL — CEO**

**Selesai kalau**
- Login sebagai `pusat` lalu buka `/lapor/accounting` → ditolak di **kedua** lapisan: UI dan database
- Uji langsung: `select data from report where form_key='accounting'` sebagai `pusat` mengembalikan 0 baris

---

## TASK 18 · Papan Kontrol

**Kerjakan**
- Hitung "laporan yang ditunggu hari ini" dari tabel `assignment`, bukan dari daftar tetap di kode
- Kartu per laporan: kode form, nama, PIC, jam kirim, warna status
- Belum lapor → kartu garis putus-putus, teks `belum lapor`
- Bar `x / y PIC sudah melapor`
- Untuk role `pusat`: tombol **Tagih** di kartu yang belum lapor (fase 1 cukup mencatat `nudged_at`; kirim WA masuk fase 2)

**Selesai kalau**
- Menambah `assignment` baru langsung menambah kartu, tanpa ubah kode
- Mengirim laporan mengubah kartunya dari putus-putus jadi berwarna, dan bar ikut naik
- Hari Minggu (`workdays`) papan kosong, bukan menampilkan semua orang telat

---

## TASK 19 · Antrean Keputusan CEO

**Kerjakan**
- Daftar `decision` status `menunggu`, urut `urgensi` lalu `deadline`
- Tombol: Setujui / Cicil / Tunda / Tolak + kolom catatan
- Simpan `decided_by`, `decided_at`, `keputusan_catatan`
- Tab riwayat keputusan
- Hanya `ceo` yang bisa memutuskan; `pusat` boleh melihat dan menyusun urutan prioritas

**Selesai kalau**
- Keputusan tercatat lengkap dengan siapa dan kapan
- `pusat` melihat daftar tapi tombol keputusannya tidak ada, dan `update` dari `pusat` ditolak database

---

## TASK 20 · View agregasi + dashboard angka CEO

**Kerjakan**
- `supabase/migrations/0004_views.sql` — view sesuai `03-CALC-SPEC.md` §4
- Dashboard CEO: dana tersedia, masuk, keluar, net, piutang, kewajiban 7 hari, surplus/kekurangan, rekap unit pembangunan
- Semua angka dari view, tidak ada yang dihitung ulang di React

**Selesai kalau**
- Angka di dashboard cocok dengan hasil query view langsung di SQL Editor
- Dashboard tetap tampil rapi kalau belum ada laporan sama sekali hari itu (keadaan kosong, bukan `NaN`)

---

## TASK 21 · Laporan Terpusat Sabrina (auto-isi)

**Kerjakan**
- 17 bagian sesuai format klien
- Bagian 1–15 **hanya baca**, terisi dari view. Beri label kecil sumbernya, misal `dari F-04 IT · 08.12`
- Bagian 11 (Keuangan) untuk `pusat` hanya 4 angka; untuk `ceo` versi lengkap
- Bagian 16, 17, dan Kesimpulan **bisa diisi** Sabrina
- Tombol cetak/ekspor PDF sederhana (`window.print` + CSS print)

**Selesai kalau**
- Tidak ada satu pun angka bagian 1–15 yang bisa diketik manual
- Login sebagai `pusat`, bagian 11 hanya menampilkan 4 angka
- Hasil cetak muat di kertas A4 dan terbaca

---

## TASK 22 · Dashboard Kontrol Marketing

**Kerjakan**
- Tabel karyawan × kepatuhan bulan berjalan: undangan/20, closing/2, hari PTE bolong, status Rp500.000, status potongan Rp300.000
- Semua dari view `v_marketing_bulanan` (`03-CALC-SPEC.md` §3)
- Bisa disaring per divisi, urut berdasarkan yang paling tertinggal
- Detail per karyawan: kalender bulan berjalan, hari bolong ditandai merah

**Selesai kalau**
- Angka cocok dengan hitungan manual pada data uji
- Hanya `kontrol_marketing`, `ceo`, `pusat` yang bisa membuka halaman ini

---

## TASK 23 · Halaman admin

**Kerjakan** CRUD sederhana untuk: `profile`, `role`, `assignment`, `lokasi`, `outlet`, `policy`. Hanya `ceo`.

Pembuatan user baru butuh `service_role` — buat Route Handler di `app/api/admin/user/route.ts`. Kunci dibaca dari `process.env.SUPABASE_SERVICE_ROLE_KEY` (**tanpa** awalan `NEXT_PUBLIC_`). Halaman admin memanggil endpoint itu lewat `fetch`, tidak pernah menyentuh kuncinya langsung.

**Selesai kalau**
- Bisa menambah lokasi baru dan meng-assign PIC-nya, dan kartunya langsung muncul di Papan Kontrol
- Bisa mengubah `policy.closing_target` dari 2 ke 3 dan angka `___ / 3` langsung berubah di seluruh aplikasi

---

## TASK 24 · Uji RLS & deploy

**Kerjakan**
- Buat 5 akun uji: ceo, pusat, accounting, pic_lokasi, karyawan
- Jalankan seluruh matriks uji di `04-CATATAN-TEKNIS.md` §4 dan catat hasilnya
- `npm run build` dan `npm run lint` bersih
- Deploy ke Vercel sesuai M10 — preset Next.js, dan `SUPABASE_SERVICE_ROLE_KEY` ditambahkan sebagai env server (bukan `NEXT_PUBLIC_`)
- Uji di HP asli, bukan hanya simulator browser

**Selesai kalau**
- Seluruh matriks uji hijau
- Aplikasi produksi bisa dipakai login, mengisi, dan mengirim laporan dari HP
- Akun `pusat` di produksi terbukti tidak bisa melihat data Accounting
