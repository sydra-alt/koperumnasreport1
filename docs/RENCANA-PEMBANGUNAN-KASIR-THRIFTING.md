# RENCANA PEMBANGUNAN — Kasir Thrifting di `pos-fnb`

Ditulis 10 September 2026. **Belum ada kode yang ditulis** — ini rencana untuk
ditinjau dulu, sesuai instruksi eksplisit. `pos-fnb` HANYA dibaca untuk
menyusun dokumen ini, tidak diubah sama sekali (sesuai batasan "jangan
disentuh sampai aku bilang").

Sumber: `docs/SPESIFIKASI-THRIFTING.md` (seluruhnya, termasuk §8 hari ini) +
pembacaan langsung `pos-fnb/CLAUDE.md`, `docs/BLUEPRINT.md`,
`docs/01-TASK-BOARD.md`, `docs/03-CALC-SPEC.md`, dan `src/lib/db/schema.ts`.

---

## 0 · Kesimpulan yang menentukan seluruh rencana ini

**Kasir thrifting BUKAN sistem baru — sebagian besar sudah ada dan bisa
dipakai langsung, karena `pos-fnb` sudah jauh lebih matang dari yang terlihat
di §7 `RENCANA-PROYEK-BARU.md`.** Tiga alasan konkret, dari kode sungguhan
(bukan tebakan):

1. **`calculateOrder()` (`lib/calc/order-calculator.ts`) sudah generik total** —
   menerima baris abstrak (`qty`, `unitPrice`, `modifierTotal`, `itemDiscount`,
   `isTaxable`) + setting per outlet (pajak, service charge, pembulatan).
   Thrifting tidak butuh kalkulator baru untuk transaksi jual-beli — cukup
   panggil fungsi yang sama dengan `modifierTotal=0` dan setting outlet yang
   sesuai (kemungkinan `taxPercent=0`, perlu dipastikan ke CEO).
2. **Shift sudah mendukung multi-orang per hari, bukan satu shift per hari.**
   `shifts` (T15) sudah per-`employeeId`+per-`deviceId`+per-`outletId`, buka
   dengan modal awal, tutup dengan hitung kas SAAT itu (`countedCash`
   write-once) baru dibandingkan ke `expectedCash` — PERSIS mekanisme yang
   diminta CEO untuk serah terima Ita → penggantinya. **Ini bukan fitur baru
   yang perlu dibangun, cuma DATA baru** (karyawan, device) yang perlu
   didaftarkan lewat halaman yang sudah ada (T15b/T15c).
3. **`outlets.dayCutoffTime` sudah menangani "tutup lewat tengah malam" secara
   generik** (default `04:00:00`, per-outlet, dipakai menghitung
   `business_date`). Toko thrifting tinggal diberi outlet dengan
   `dayCutoffTime='03:00:00'` (atau jam yang benar) — tidak ada logika baru
   yang perlu ditulis untuk ini sama sekali.

**Yang benar-benar baru** cuma tiga hal, dan ketiganya SUDAH diketahui dari
`SPESIFIKASI-THRIFTING.md`: (a) model barang unik-per-potong (bukan stok
berbasis jumlah seperti `products`/`product_variants` yang ada sekarang), (b)
kepemilikan titipan + bagi hasil, (c) label barcode fisik. Rencana di bawah
disusun mengelilingi tiga hal ini — bagian lain (kasir, pembayaran, shift,
struk, laporan) adalah **penyambungan ke yang sudah ada**, bukan pembangunan
dari nol.

---

## 1 · Keputusan arsitektur — diajukan dengan alasan, bukan pertanyaan terbuka

Empat keputusan di bawah BUKAN pertanyaan ke CEO — ini keputusan teknis yang
saya ajukan dengan alasan eksplisit (pola yang diminta `pos-fnb/CLAUDE.md` §7
poin 3: "kalau menurutmu suatu keputusan tidak perlu jawaban saya, jangan
ajukan sebagai pertanyaan — putuskan sendiri dan sebutkan alasannya"). Bagian
§3 di bawah daftar terpisah untuk yang SUNGGUH perlu jawaban CEO.

- **Satu outlet baru** di bisnis yang sama (bukan bisnis/tenant terpisah) —
  brand baru (mis. "Bestie Thrift") lewat mekanisme `brands`+`outlets` yang
  sudah ada dari T22a. Alasan: `RENCANA-PROYEK-BARU.md` §2 sudah menggambarkan
  thrifting sebagai bagian dari `pos-fnb` yang sama, dan model multi-outlet
  (Indosteak, Indokopi) sudah terbukti jalan untuk kasus persis ini.
- **`order_items` DIPERLUAS lewat kolom nullable baru** (`barangId`,
  `pemilikId`, `pemilikBagiPercentAtSale`, `pemilikShareAmount`,
  `tokoShareAmount`), BUKAN tabel order terpisah untuk thrifting. Alasan:
  `productId` di `order_items` sudah nullable dan barisnya sudah snapshot
  penuh (`productName`, `unitPrice`, dst — CLAUDE.md §3.2) — pola yang sama
  persis dibutuhkan barang thrifting, dan kolom HPP (`unitCogs`/`cogsAmount`)
  yang sudah ada malah pas untuk `harga_modal` barang. Kolom F&B-only
  (`prepStation`, `kitchenStatus`) tinggal dibiarkan default/tidak dipakai
  untuk baris thrifting — sama seperti kolom F&B lain yang tidak semua channel
  pakai.
- **Kategori barang REUSE tabel `categories` yang sudah ada** (baris baru
  di-scope `business_id` yang sama), BUKAN tabel `barang_kategori` terpisah.
  Alasan: `categories` sudah generik (id, business_id, name, sort_order),
  tidak terikat ke `product_type` tertentu — membuat tabel kedua untuk hal
  yang sama akan jadi dua sumber kebenaran. Risiko yang perlu dijaga saat
  implementasi: filter kategori di layar kasir F&B vs thrifting harus jelas
  terpisah (kemungkinan lewat kolom penanda `applies_to` atau relasi ke
  outlet/brand) — detail ini masuk TT01, bukan diputuskan final di sini.
- **Barcode dibuat sendiri (Code128, canvas/SVG)**, sesuai usulan
  `SPESIFIKASI-THRIFTING.md` §6 — tidak perlu library baru
  (`pos-fnb/CLAUDE.md` §7 poin 5 melarang dependency baru tanpa izin).

---

## 2 · Yang dipakai ulang APA ADANYA (tidak disentuh sama sekali)

| Mekanisme yang sudah ada | Dipakai ulang untuk |
|---|---|
| `businesses`, `brands`, `outlets`, `product_outlets` (T22a) | Outlet + brand baru "Bestie Thrift" |
| `employees`, `devices`, PIN login (T07, T15b, T15c) | Multi-kasir thrifting (Ita + pengganti sore/malam) |
| Device pairing (T22e) | Tablet kasir thrifting tahu dia mewakili outlet thrifting |
| `shifts`, `cash_movements`, hitung kas dua langkah (T15) | Serah terima shift dengan hitung uang saat itu juga |
| `outlets.dayCutoffTime`, `business_date` (CLAUDE.md §3.3) | Toko tutup dini hari tidak salah tanggal laporan |
| `calculateOrder()` (`lib/calc/order-calculator.ts`) | Hitung total transaksi jual barang (tanpa modifier) |
| `orders`, `payment_methods`, `payments`, split payment, idempotency (T13) | Pembayaran thrifting — tunai/QRIS/dll, kembalian |
| Void & refund (T16) | Pembeli mengembalikan barang |
| Struk 80mm + cetak ulang (T14) | Struk thrifting (sesuaikan header outlet) |
| `getSalesByCashier`, `getOpenShiftsForBusiness`, dst (T17/T18) | Laporan penjualan & dashboard thrifting (query baru, pola sama) |
| RBAC 3-lapis (UI/server/RLS), `permissions_override` | Dua permission baru: `barang.manage`, `pemilik.manage` |

**Konsekuensi penting**: karena hampir semua infrastruktur transaksi sudah
ada, pekerjaan sungguhan terkonsentrasi di sisi **barang** (model data unik-
per-potong, layar tambah cepat, label) dan **bagi hasil** — bukan di
"membangun kasir dari nol" seperti Fase 0-1 F&B dulu. Tidak perlu fase
"kalkulator dulu" yang panjang seperti T01-T05 F&B — kalkulator jual-beli
sudah ada, yang baru cuma kalkulator bagi hasil (satu fungsi kecil, TT07).

---

## 3 · Pertanyaan yang HARUS dijawab CEO sebelum task dimulai

**Status 10 September 2026 (putaran kedua): empat dari enam sudah terjawab
atau tidak lagi relevan.** Cuma DUA yang masih genuinely terbuka, dan
keduanya TIDAK memblokir pembangunan sekarang.

1. ✅ **TIDAK LAGI RELEVAN — "Berapa shift per hari & jam potongnya".**
   Pertanyaan ini lahir dari kebutuhan rekonsiliasi kas per shift — sekarang
   TIDAK ADA kas untuk direkonsiliasi (poin 2 di bawah). Ditutup lewat
   mekanisme akun tamu (§9): jumlah shift/hari jadi fleksibel, tidak perlu
   ditentukan di muka.
2. ✅ **DIJAWAB (10 September 2026) — TIDAK ADA TUNAI SAMA SEKALI.** Semua
   outlet sudah cashless (QRIS + transfer). Lihat §7 — **tidak ada kode baru
   yang perlu ditulis**, `outlets.cashEnabled=false` (kolom yang sudah ada)
   menangani semuanya.
3. ✅ **DIJAWAB (10 September 2026) — Ukuran label barcode.** TIDAK dikunci
   ke satu ukuran — diatur dari Admin (lebar/tinggi/elemen), preset umum +
   ukuran bebas + pratinjau. Lihat §8 untuk rancangan skemanya. Sebelumnya
   ini memblokir TT05 dengan asumsi harus memilih SATU ukuran tetap —
   asumsi itu sendiri yang salah, jawabannya justru "jangan pilih satu".
4. ✅ **DIJAWAB (10 September 2026) — Data barang Bestie Thrift lama.**
   **CUKUP yang belum terjual** — yang sudah terjual tetap arsip di sistem
   lama, tidak ikut dipindahkan. Lihat TT13.
5. **MASIH TERBUKA, tidak memblokir** — Persentase 60/40 seragam atau per
   pemilik? Skema `pemilik.persenBagi` (§6.1) sudah mendukung keduanya
   (kolom per-baris) — jawabannya cuma memengaruhi UI TT03 (kalau seragam,
   field ini bisa didefaultkan & disembunyikan, bukan wajib diisi tiap
   pemilik baru). Bisa dikerjakan dengan asumsi "per pemilik, boleh beda"
   (lebih fleksibel) sambil menunggu jawaban.
6. **MASIH TERBUKA, tidak memblokir** — Barang tidak laku berbulan-bulan:
   dikembalikan, atau didiskon dengan izin pemiliknya? Bisa menyusul sebagai
   fitur TT10 lanjutan (kolom `umurHari` sudah dirancang untuk ini), tidak
   menghalangi TT01-TT07.

**Tax (dicatat lagi di sini karena memengaruhi TT09 langsung)**: ✅
**PAJAK NOL** ("harga label = harga bayar, barang bekas titipan bukan
restoran") — diteruskan ke CEO untuk konfirmasi resmi, TIDAK menunggu untuk
lanjut kerja. `outlets.taxPercent=0`/`taxInclusive=false`/
`serviceChargePercent=0` dipakai saat outlet dibuat (TT09) — belum ada nilai
yang benar-benar diset ke mana pun sekarang karena outlet itu sendiri belum
ada.

---

## 4 · Task board

Penomoran **TT** (Thrifting Task) — sengaja BUKAN melanjutkan T01-T34 F&B,
supaya tidak menyiratkan urutan ketergantungan dengan roadmap Fase 2/3 F&B
(inventori/HPP/payroll) yang berjalan terpisah. Format sama seperti
`01-TASK-BOARD.md`: `[ ]` belum, checklist "Selesai kalau".

### Fase A — Fondasi data

**[x] TT01 — Skema `barang` + `pemilik` + kategori** — SELESAI, diterapkan ke database dev.
Migration Drizzle: tabel `barang` (kode unik, kategori_id → `categories`,
nama, merek, ukuran, warna, kondisi, harga_modal, harga_jual, status enum
`baru_masuk`/`siap_jual`/`terjual`/`rusak`, pemilik_id nullable →
`pemilik`, outlet_id, masuk_pada, terjual_pada, foto path Storage — pola
sama `products.imagePath` T09c), tabel `pemilik` (persis §7: kode, nama,
kontak, persen_bagi, aktif, catatan). RLS `business_id`-scoped sama pola
tabel lain. Dua permission baru (`barang.manage`, `pemilik.manage`)
ditambah ke matriks RBAC (`docs/BLUEPRINT.md` §7).
*Selesai kalau:* migration jalan, test RLS (tenant lain tidak bisa lihat
barang tenant ini), status barang cuma bisa satu dari empat nilai.

**[x] TT02 — Perluas `order_items` untuk barang thrifting** — SELESAI, trigger diverifikasi lewat race condition sungguhan (lihat §10).
Kolom baru (nullable): `barangId`, `pemilikId`, `pemilikBagiPercentAtSale`,
`pemilikShareAmount`, `tokoShareAmount` — semua snapshot SAAT transaksi
(CLAUDE.md §3.2), tidak pernah dihitung ulang belakangan walau
`persen_bagi` pemilik diubah kemudian. Trigger/constraint: barang yang
sudah `status='terjual'` tidak boleh terjual lagi (cegah dobel-scan).
*Selesai kalau:* insert order_item dengan barangId mengunci status barang
jadi `terjual` dalam transaksi yang sama (tidak ada window race dua kasir
scan barang sama nyaris bersamaan).

> **Titik berhenti #1 — DISETUJUI (10 September 2026).** Bentuk skema di §6
> disetujui utuh, termasuk tiga penyesuaian yang ditemukan saat menulis DDL
> (trigger anti-jual-dobel, `categories.scope`, `pemilik.kode` nullable
> tidak unik). TT01+TT02 sekarang benar-benar DITERAPKAN (migration Drizzle
> dibuat & dijalankan) sebagai prasyarat TT03 — bukan lagi cuma dokumen.

### Fase B — Barang masuk (§5: penentu sistem dipakai atau tidak)

**[x] TT03 — CRUD Pemilik (Admin/dashboard)** — SELESAI (`/pemilik`).
Layar tambah/ubah pemilik, gerbang `pemilik.manage`. **Wajib ada sejak
awal** (instruksi eksplisit CEO 10 September) — bukan menyusul setelah
kasir jalan.

**[x] TT04 — Layar tambah barang cepat** — SELESAI (`/barang`), DIUPGRADE 11 September 2026 sesuai instruksi CEO langsung.
Versi pertama (10 September): `pos-fnb` TIDAK PUNYA `CameraCapture` sama
sekali (beda dari repo ini) — foto produk di seluruh `pos-fnb` cuma
pakai `<input type="file" accept="image/*">` (buka kamera/galeri OS di
HP). Kode/barcode digenerate server (`generateBarangKode()`, tidak
pernah diketik). Outlet/kategori/pemilik CONTROLLED dan bertahan ke
barang berikutnya setelah "Simpan & Tambah Lagi".

CEO menilai versi pertama belum cukup setelah titik periksa kedua
lolos, dengan tiga permintaan spesifik — dikerjakan sebelum TT05 sesuai
urutan yang diminta ("keduanya berpasangan: barang masuk lalu langsung
dicetak labelnya"):
1. **Kamera terbuka otomatis** — diganti `getUserMedia` bawaan browser
   (`facingMode: "environment"`), BUKAN library baru (CLAUDE.md
   melarang dependency tanpa izin). Stream TETAP HIDUP antar barang
   (tidak dihentikan saat "Simpan & Tambah Lagi") supaya layar langsung
   siap jepret lagi tanpa minta izin kamera ulang. Fallback otomatis ke
   pemilih file kalau kamera gagal/tidak tersedia (desktop, izin
   ditolak).
2. **Kategori, ukuran, kondisi, pemilik jadi tombol tap**, bukan
   dropdown. Ukuran/kondisi tetap kolom teks bebas di database (sengaja
   bukan enum, lihat §6.2) — tombol cuma preset umum (XS–XXL / Sangat
   baik–Baik–Cukup), admin masih bisa ketik manual di luar preset.
3. **Harga jual otomatis 2x harga modal**, berhenti auto-isi begitu
   admin mengubahnya sendiri secara manual.

Detail teknis: reset ukuran/kondisi/harga antar barang TIDAK memakai
`setState` di dalam `useEffect` (dilarang lint `react-hooks/set-state-
in-effect`) — dipindah ke pola remount-lewat-`key` (komponen kecil
`BarangPricingFields` di-key oleh `barangId` yang baru tersimpan).
Diverifikasi: `tsc --noEmit` bersih, `eslint` bersih, 257 test (35 file)
tetap hijau setelah perubahan.

**[x] TT05 — Cetak label barcode** — SELESAI, dikonfirmasi lolos uji pindai fisik (12 September 2026). Keputusan CEO menutup pertanyaan terbuka di atas: RawBT (bukan Web Bluetooth), Code128 digambar sendiri jadi gambar, lebar cetak 48mm dari kertas termal 58mm. Detail pembangunan di §15, investigasi bug "terbaca tapi salah" dan penutupannya (penyebab TIDAK bisa dipastikan, dicatat jujur) di §16.

### Fase C — Kasir jual barang

**[x] TT06 — Layar kasir thrifting** — SELESAI (`/pos/thrift`, route baru terpisah dari `/pos` F&B, dipilih otomatis lewat `outlets.posMode`).
Kode baru: `lib/pos/sell-barang.ts` (padanan `payOrderWithDb` khusus
thrifting — qty selalu 1, tanpa modifier/diskon), `lib/barang/lookup.ts`
(cari barang by kode), `ThriftPosScreen`+`ThriftPaymentDialog`
(barcode-first, satu kolom, BUKAN grid produk). Dibuktikan lewat penjualan
sungguhan di database dev, lihat §10.

**[x] TT07 — Kalkulator bagi hasil** (`lib/calc/consignment-split.ts`) — SELESAI.
Test-first sesuai CLAUDE.md §7 poin 4: 4 test golden case (termasuk
Rp1.850.000 → 60%=Rp1.110.000 dari §7) DITULIS DAN LULUS sebelum
`consignmentSplit()` dipakai `sell-barang.ts`. Sisa pembulatan diserap
TOKO (pemilik dibulatkan langsung, toko = sisa) — dibuktikan lewat kasus
khusus persen pecahan (TC-02) supaya `pemilikShareAmount + tokoShareAmount`
tidak pernah lebih dari harga jual walau ada sisa sen.

**[x] TT08 — Struk thrifting** — SELESAI, TANPA perubahan kode sama
sekali seperti diduga di rencana awal. `ReceiptView` sudah menyembunyikan
baris pajak/service charge otomatis kalau nilainya nol
(`!amount.isZero()`), jadi outlet `taxPercent=0` langsung menghasilkan
struk tanpa baris pajak, dibuktikan lewat struk sungguhan di §10.

### Fase D — Operasional shift (kemungkinan besar cuma data, bukan kode)

**[x] TT09 — Outlet, device, karyawan thrifting terdaftar** — SELESAI, lewat `scripts/demo-thrift-checkpoint.ts` (idempoten, aman dijalankan ulang):
outlet "Bestie Thrift" (`cashEnabled=false`, `taxPercent=0`,
`serviceChargePercent=0`, `posMode='thrifting'`), metode "Transfer Bank"
dibuat (belum ada sebelumnya di database dev, cuma QRIS), Ita terdaftar
`role=manager`, device "Kasir Thrifting 1" dipasangkan. **Satu deviasi
dari rencana**: `dayCutoffTime` masih default `04:00:00` bawaan skema —
jam tutup nyata Bestie Thrift belum dikonfirmasi CEO, jadi belum diisi
angka final (lihat §3 poin terbuka). Ganti kapan saja lewat halaman Outlet
begitu ada jawaban, tidak perlu migrasi.

**[x] TT09b — Akun tamu (nama pelayan wajib per shift)** — SELESAI.
Dikerjakan bersamaan TT09 (soal setup shift outlet ini juga). Perlu KODE
BARU (dua kolom + validasi server, lihat §9): `employees.isSharedAccount`,
`shifts.servedByName`, guard wajib-isi di `openShiftWithDb()` kalau shift
dibuka akun bersama, dan tiga tempat tampilan (`getOpenShiftsForBusiness`,
`getSalesByCashier`, struk) diutamakan membaca `servedByName`. Satu
employee row baru (`code="TAMU"`, `role="cashier"`,
`isSharedAccount=true`) dibuat lewat halaman Karyawan yang sudah ada.
*Selesai kalau (KETIGANYA DIVERIFIKASI sungguhan lewat
`scripts/demo-thrift-guest-account.ts` di database dev, bukan cuma
ditulis lalu diasumsikan benar):*
- Buka shift akun tamu TANPA nama → ditolak server: "Akun ini akun
  bersama -- isi nama siapa yang bertugas sebelum membuka shift." ✅
- Buka shift akun tamu DENGAN nama "Rani" → `getOpenShiftsForBusiness`
  DAN `getSalesByCashier` sama-sama menyebut "Rani", bukan "Akun Tamu —
  Bestie Thrift" (satu transaksi sungguhan Rp50.000 dijual di bawah shift
  ini untuk membuktikan baris laporannya, bukan cuma baris shift kosong).✅
- Karyawan bernama biasa (Ita) tidak diwajibkan `servedByName` sama
  sekali — dibuktikan tidak langsung lewat `demo-thrift-checkpoint.ts`
  (shift Ita dibuka dengan field ini kosong, tidak ditolak).✅
- Ditemukan DUA bug kecil sambil menulis verifikasi ini (diperbaiki di
  commit yang sama): (1) `getSalesByCashier` sebelumnya group-by
  `employees.fullName` mentah, akan menggabung SEMUA pemakai akun tamu
  jadi satu baris "Akun Tamu" — diganti group-by
  `coalesce(shifts.servedByName, employees.fullName)`; (2) key React di
  `SalesByCashierTable` cuma `cashierId` — dua baris berbeda nama tapi
  `cashierId` sama (akun tamu yang sama) akan tabrakan key, diganti
  `cashierId+cashierName+index`.

### Fase E — Laporan

**[ ] TT10 — Laporan stok barang**
Per kategori, per status (`siap_jual`/`terjual`/`rusak`), per umur hari
(`umur_hari` dari §7, "Yang perlu diputuskan" — makin relevan begitu §3.5
soal barang tak laku terjawab). Pola sama `sales-report.ts` (T17) tapi
untuk `barang`, bukan `products`.

**[ ] TT11 — Laporan bagi hasil bulanan per pemilik**
Persis tabel di §7: dititipkan/terjual/belum terjual/total
penjualan/bagian pemilik/bagian toko/sudah dibayar/sisa. Tombol **"Sudah
Dibayar"** per rekap BULANAN (bukan per transaksi — jawaban CEO 10
September). Bisa diekspor Excel (pola sama T34 F&B kalau sudah ada saat
ini dikerjakan, atau dibangun lebih dulu di sini kalau belum).

**[ ] TT12 — Dashboard ringkas thrifting** *(opsional, prioritas rendah)*
Reuse pola dashboard T18 kalau ada kapasitas — omzet harian, barang
terlaris, status shift berjalan.

### Fase F — Migrasi & peluncuran

**[ ] TT13 — Migrasi data barang lama**
✅ Tidak lagi diblokir. **CUKUP yang belum terjual** (dijawab CEO 10
September) — barang yang sudah terjual TETAP di sistem lama sebagai arsip,
tidak ikut dipindahkan ke `barang`.

**[ ] TT14 — Uji lapangan pilot**
Sama pola T20 F&B: jalan paralel dengan cara lama dulu (kalau ada) sebelum
sepenuhnya pindah. Fokus khusus: apakah 150 barang/sesi tetap tercapai
dengan alur TT04 (§5 eksplisit bilang ini penentu dipakai/tidaknya sistem).

---

## 5 · Titik berhenti untuk ditinjau

Disarankan **DUA** titik berhenti, bukan satu di akhir:

1. ✅ **Setelah TT01+TT02 disetujui bentuknya** — SELESAI, disetujui utuh
   10 September 2026 (§6, termasuk tiga penyesuaian yang ditemukan saat
   menulis DDL-nya).
2. ✅ **TERCAPAI (11 September 2026) — kasir bisa transaksi lengkap, tanpa
   label/laporan dulu.** TT03-TT09b selesai, dibuktikan lewat penjualan
   SUNGGUHAN di database dev (bukan cuma "kodenya sudah ditulis") — lihat
   bukti lengkap di §10. Titik ini masih SANGAT layak dicoba LANGSUNG oleh
   Ita/CEO di device fisik sebelum lanjut ke laporan (TT10-TT11) dan
   migrasi (TT13) — §5 `SPESIFIKASI-THRIFTING.md` eksplisit: kecepatan
   pemasukan/penjualan barang itu sendiri yang menentukan sistem ini
   dipakai atau ditinggalkan, dan itu cuma bisa dinilai jujur oleh tangan
   sungguhan di layar sungguhan, bukan skrip verifikasi (lihat catatan
   jujur soal ini di §10).

**Pembaruan 10 September 2026 (putaran kedua)**: dari lima pertanyaan yang
dulu jadi jeda alami di §3, tersisa DUA yang masih terbuka (persentase
seragam/per-pemilik, kebijakan barang tak laku) dan KEDUANYA tidak
memblokir — jalan menuju checkpoint #2 (TT03 → TT09b) sekarang bisa
dikerjakan tanpa jeda menunggu jawaban CEO lagi.

---

## 6 · TT01 + TT02 — Rancangan skema konkret (untuk ditinjau, BELUM diterapkan)

**Belum ditulis ke `pos-fnb` sama sekali** — ini teks DDL/Drizzle untuk
ditinjau, sesuai titik berhenti #1. Gaya kode mengikuti persis konvensi yang
sudah ada di `src/lib/db/schema.ts` (dibaca langsung, bukan ditebak): `uuid`
PK dengan `gen_random_uuid()`, `businessId` wajib + `onDelete: "cascade"` ke
`businesses`, tiga `pgPolicy` (select/insert/update) berbasis
`auth_business_ids()`, `.enableRLS()`.

### 6.1 Tabel baru — `pemilik`

```ts
export const pemilik = pgTable(
  "pemilik",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // NULLABLE, TIDAK unik -- koreksi dari draft SPESIFIKASI-THRIFTING.md
    // §7 lama ("kode text unique"): CEO eksplisit "jangan terpaku kode
    // 2-huruf gaya SS", jadi kode sekarang cuma label singkat OPSIONAL
    // (kalau admin mau), `nama` yang jadi identitas utama.
    kode: text("kode"),
    nama: text("nama").notNull(),
    kontak: text("kontak"),
    persenBagi: numeric("persen_bagi", { precision: 5, scale: 2 })
      .notNull()
      .default("60"),
    isActive: boolean("is_active").notNull().default(true), // master data, tidak pernah dihapus (CLAUDE.md §3.2)
    catatan: text("catatan"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("pemilik_select", { for: "select", using: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("pemilik_insert", { for: "insert", withCheck: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("pemilik_update", {
      for: "update",
      using: sql`${t.businessId} = any(auth_business_ids())`,
      withCheck: sql`${t.businessId} = any(auth_business_ids())`,
    }),
  ]
).enableRLS();
```

### 6.2 Tabel baru — `barang`

```ts
export const barangStatusEnum = pgEnum("barang_status", [
  "baru_masuk",
  "siap_jual",
  "terjual",
  "rusak",
]);

export const barang = pgTable(
  "barang",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    outletId: uuid("outlet_id")
      .notNull()
      .references(() => outlets.id),
    kode: text("kode").notNull(), // dicetak jadi label barcode (TT05), satu per potong -- SPESIFIKASI §5
    categoryId: uuid("category_id").references(() => categories.id),
    nama: text("nama").notNull(),
    merek: text("merek"),
    ukuran: text("ukuran"),
    warna: text("warna"),
    kondisi: text("kondisi"), // teks bebas ("Sangat baik"/"Baik"/"Cukup") -- SPESIFIKASI §3 eksplisit BUKAN enum terstruktur
    hargaModal: numeric("harga_modal", { precision: 16, scale: 2 }).notNull().default("0"),
    hargaJual: numeric("harga_jual", { precision: 16, scale: 2 }).notNull(),
    status: barangStatusEnum("status").notNull().default("baru_masuk"),
    pemilikId: uuid("pemilik_id").references(() => pemilik.id), // null = milik toko sendiri (SPESIFIKASI §7)
    imagePath: text("image_path"), // pola sama products.imagePath (T09c) -- bucket privat, signed URL saat dibaca
    masukPada: timestamp("masuk_pada", { withTimezone: true }).notNull().defaultNow(),
    terjualPada: timestamp("terjual_pada", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.businessId, t.kode),
    pgPolicy("barang_select", { for: "select", using: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("barang_insert", { for: "insert", withCheck: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("barang_update", {
      for: "update",
      using: sql`${t.businessId} = any(auth_business_ids())`,
      withCheck: sql`${t.businessId} = any(auth_business_ids())`,
    }),
  ]
).enableRLS();
```

Tidak ada policy DELETE (sama seperti `products`) — barang yang salah input
ditandai `rusak`, bukan dihapus (riwayat harus tetap bisa ditelusuri, sama
prinsip CLAUDE.md §3.2 walau `barang` bukan "master data" klasik).

### 6.3 `categories` diperluas — kolom `scope` baru

Reuse `categories` (disetujui) ternyata butuh SATU kolom tambahan supaya
daftar kategori F&B ("Kopi", "Makanan") dan thrifting ("Pakaian", "Sepatu")
tidak tercampur di mana pun `categories` dipakai (dropdown form produk, tab
kategori layar kasir) — **tidak ada kolom pembeda seperti ini di skema yang
sudah ada**, jadi ini penyesuaian yang ditemukan saat menulis DDL, bukan
diasumsikan sejak awal.

```ts
export const categoryScopeEnum = pgEnum("category_scope", ["fnb", "thrifting"]);

// ditambahkan ke definisi `categories` yang SUDAH ADA:
scope: categoryScopeEnum("scope").notNull().default("fnb"),
```

`default("fnb")` membuat migration ini AMAN untuk baris yang sudah ada
(Kopi, Makanan, dst otomatis tetap `fnb`, tidak perlu backfill manual) —
kategori thrifting (Pakaian, Sepatu, Tas, Topi, dst — CEO menyebut "dll",
berarti bisa bertambah, makanya tabel bukan enum tertutup) di-insert dengan
`scope='thrifting'` saat TT04. Titik yang perlu disentuh saat implementasi
(dicatat di sini supaya tidak lupa, BUKAN dikerjakan sekarang): setiap query
yang membaca `categories` untuk ditampilkan sebagai pilihan/filter perlu
tahu SATU dari dua scope ini, bukan menampilkan gabungan keduanya.

**Dikerjakan (11 September 2026)**: ditemukan SAAT menguji ulang kode
sebelum lapor titik periksa kedua, bukan diketahui sejak awal — tiga
tempat yang membaca `categories` untuk F&B (dropdown kategori di form
produk `products/new` dan `products/[id]`, chip filter kategori
`get-pos-catalog.ts`) SEMPAT tidak difilter `scope`, artinya begitu
kategori "Pakaian" dibuat lewat TT04, ia akan MUNCUL di form produk steak/
kopi dan di chip filter kasir F&B — persis risiko yang dicatat di
paragraf ini sendiri, keburu terlewat implementasinya. Ketiganya sudah
ditambah `eq(categories.scope, "fnb")`, dikonfirmasi lewat test suite F&B
penuh (35 file, 257 test) tetap hijau setelahnya.

### 6.4 `order_items` diperluas — lima kolom nullable baru

```ts
// ditambahkan ke definisi `order_items` yang SUDAH ADA, semua NULLABLE
// (baris F&B tidak terpengaruh sama sekali -- tetap semuanya null):
barangId: uuid("barang_id").references(() => barang.id),
pemilikId: uuid("pemilik_id").references(() => pemilik.id),
// SNAPSHOT saat transaksi (CLAUDE.md §3.2 + jawaban CEO §7: "simpan
// angkanya di baris transaksi, jangan dihitung ulang belakangan") -- kalau
// pemilik.persenBagi diubah BULAN DEPAN, transaksi bulan ini tidak ikut berubah.
pemilikBagiPercentAtSale: numeric("pemilik_bagi_percent_at_sale", { precision: 5, scale: 2 }),
pemilikShareAmount: numeric("pemilik_share_amount", { precision: 16, scale: 2 }),
tokoShareAmount: numeric("toko_share_amount", { precision: 16, scale: 2 }),
```

`unitCogs`/`cogsAmount` yang SUDAH ADA di `order_items` dipakai langsung
untuk `hargaModal` barang — tidak perlu kolom HPP baru. Kolom F&B-only
(`prepStation`, `kitchenStatus`, `variantId`, `modifierTotal`) dibiarkan
default/null untuk baris thrifting, sama seperti channel F&B lain yang
tidak memakai semua kolom (mis. `dine_in` vs `gofood`).

### 6.5 Penjaga anti-jual-dobel (kriteria "Selesai kalau" TT02)

Dua kasir men-scan barang yang sama nyaris bersamaan TIDAK BOLEH keduanya
berhasil. Trigger `BEFORE INSERT` di `order_items`, pola sama
`check_stock_transfer_transition` (state machine) yang sudah ada di T22:

```sql
create or replace function claim_barang_for_sale()
returns trigger as $$
begin
  if new.barang_id is not null then
    update barang
    set status = 'terjual', terjual_pada = now()
    where id = new.barang_id and status = 'siap_jual';

    if not found then
      raise exception 'Barang % sudah terjual atau belum siap dijual', new.barang_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_claim_barang_for_sale
before insert on order_items
for each row execute function claim_barang_for_sale();
```

`UPDATE ... WHERE status = 'siap_jual'` mengunci barisnya secara alami —
transaksi kedua yang mencoba meng-klaim barang yang sama akan MENUNGGU
transaksi pertama selesai, lalu melihat `status` sudah `'terjual'` dan
`not found` sehingga `raise exception` — kasir kedua dapat pesan jelas
("barang sudah terjual"), bukan dua struk untuk satu barang fisik.

### 6.6 Permission baru (BLUEPRINT §7 + `src/lib/auth/permissions.ts`)

Ditambahkan ke `PermissionKey` union + `PERMISSIONS` map (pola `row(owner,
manager, cashier, waiter, kitchen, warehouse, accountant)`):

```ts
"barang.manage": row("on", "on", "na", "na", "na", "na", "na"),
"pemilik.manage": row("on", "off", "na", "na", "na", "na", "na"),
```

**Diperbarui (10 September 2026)** — `barang.manage` awalnya diusulkan `off`
untuk kasir (bisa diaktifkan per karyawan), dengan catatan "belum diputuskan
apakah Ita manager atau cashier-dengan-override". **CEO sudah menjawab: Ita
= MANAGER**, bukan kasir dengan kelonggaran — mengurus barang masuk, harga,
pemilik, dan laporan bagi hasil adalah pekerjaan manajerial. Konsekuensinya
`barang.manage` diperketat jadi `na` untuk kasir, PERSIS pola `product.manage`
F&B — TIDAK ADA jalan bagi akun berkredensial kasir (termasuk akun tamu di
§9) untuk mendapatkannya lewat `permissions_override` apa pun. Ini juga yang
membuat akun tamu aman dipakai bersama tanpa perlu pengaman tambahan.

`pemilik.manage` mengikuti pola `employee.manage` (owner on, manajer
`off`/bisa diaktifkan, staf lain `na`) — menambah/mengubah mitra titipan
lebih dekat ke keputusan bisnis (persentase bagi hasil) daripada pekerjaan
operasional harian.

---

**Ringkasan yang perlu ditinjau di titik berhenti ini**: dua tabel baru
(`pemilik`, `barang`), satu kolom baru di tabel F&B yang sudah ada
(`categories.scope`, default aman), lima kolom nullable baru di
`order_items`, satu trigger anti-jual-dobel, dua permission key baru. Tidak
ada tabel/kolom F&B yang berubah PERILAKUNYA — cuma bertambah.

---

## 7 · Temuan: thrifting 100% cashless — TIDAK ADA KODE BARU yang perlu ditulis

CEO (10 September 2026): semua outlet sudah tidak menerima tunai sama
sekali (QRIS + transfer, tunai yang masuk di-top-up ke rekening). Diminta
diperiksa dulu, dilaporkan, BUKAN langsung diasumsikan bisa/tidak bisa.
Dibaca langsung `src/lib/pos/shift.ts`, `get-pos-catalog.ts`,
`src/app/(dashboard)/payment-methods/`, `scripts/bootstrap-production.ts`.

**Tiga pertanyaan CEO, tiga jawaban dari kode sungguhan:**

1. **Apakah siklus shift MEWAJIBKAN hitung kas, atau bisa dilewati?** —
   **BISA DILEWATI, dan jalurnya SUDAH DIBANGUN.** `closeCashlessShiftWithDb()`
   (`lib/pos/shift.ts`) menutup shift dalam SATU langkah, tidak pernah
   menyentuh `countedCash`/`expectedCash`/`cashVariance` (tetap `null`
   selamanya untuk shift itu) — dipakai kalau outlet cashless. Ada juga
   `getShiftSalesSummary()`: ringkasan penutupan TANPA kas sama sekali
   (jumlah transaksi + total per metode bayar), sudah dipakai di
   `close-cashless-shift-form.tsx`.
2. **Bisa dimatikan per outlet lewat pengaturan, atau perlu ubah kode?** —
   **PER OUTLET, LEWAT PENGATURAN, TIDAK PERLU UBAH KODE SAMA SEKALI.**
   `outlets.cashEnabled` (boolean, kolom yang SUDAH ADA sejak T15) dibaca
   ULANG di setiap titik keputusan (`openShiftWithDb`,
   `addCashMovementWithDb`, `submitCountedCashWithDb`,
   `closeCashlessShiftWithDb`, `getPosCatalog`) — bukan disimpan/di-cache
   sekali di awal. Diatur dari halaman Admin Outlet (`/outlets`, T22b) yang
   SUDAH ADA, form yang SUDAH ADA (`outlet-form-dialog.tsx`). Set
   `cashEnabled=false` untuk outlet thrifting saat dibuat (TT09) — **tidak
   menyentuh Indosteak/Indokopi sama sekali**, keduanya tetap
   `cashEnabled` apa pun nilainya sekarang (di luar cakupan kerja ini,
   tidak diperiksa/diubah).
3. **Metode pembayaran apa saja yang sudah ada? QRIS dan transfer ada?
   Tunai bisa dimatikan untuk outlet ini?** — `payment_methods` per-BISNIS
   (bukan per-outlet), tapi `getPosCatalog()` MENYARING metode
   `isCashDrawer=true` dari daftar yang ditampilkan kalau
   `outlet.cashEnabled=false` — jadi TIDAK PERLU baris metode bayar
   terpisah per outlet, cukup satu daftar dipakai bersama, disaring
   otomatis. **QRIS sudah ada** (`isCashDrawer=false`, dari
   `bootstrap-production.ts`). **"Transfer" TIDAK terlihat di config
   bootstrap default** (cuma QRIS + CASH) — kemungkinan sudah ditambahkan
   manual lewat halaman dashboard `/payment-methods` (yang SUDAH ADA,
   CRUD penuh) di data produksi yang sedang berjalan, tapi **saya tidak
   bisa memastikan dari sini** (tidak baca database produksi). Perlu
   dicek satu kali di halaman itu sebelum TT09 — kalau belum ada, tinggal
   ditambah lewat UI yang sudah ada, BUKAN kerja kode.

**Kesimpulan**: TT09 (buka outlet thrifting) sekarang MURNI pengaturan data
lewat halaman yang sudah ada — `cashEnabled=false`, `taxPercent=0`,
pastikan metode "Transfer" ada di `/payment-methods`. Tidak ada satu baris
kode pun yang perlu ditulis untuk bagian ini.

---

## 8 · Label barcode — ukuran & isi diatur dari Admin

CEO: ukuran kemarin ("kalau tidak salah 50×80, tapi kemarin terasa
kekecilan") tidak boleh dikunci ke kode. Rancangan: satu baris pengaturan
per bisnis (bukan per barang — semua label thrifting satu bisnis memakai
pengaturan yang sama, diubah kapan saja dari Admin):

```ts
export const labelSettings = pgTable(
  "label_settings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" })
      .unique(), // satu pengaturan aktif per bisnis, bukan banyak baris bersaing
    widthMm: numeric("width_mm", { precision: 5, scale: 1 }).notNull().default("50"),
    heightMm: numeric("height_mm", { precision: 5, scale: 1 }).notNull().default("80"),
    showBarcode: boolean("show_barcode").notNull().default(true),
    showName: boolean("show_name").notNull().default(true),
    showPrice: boolean("show_price").notNull().default(true),
    showPemilikKode: boolean("show_pemilik_kode").notNull().default(false),
    showUkuran: boolean("show_ukuran").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("label_settings_select", { for: "select", using: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("label_settings_insert", { for: "insert", withCheck: sql`${t.businessId} = any(auth_business_ids())` }),
    pgPolicy("label_settings_update", {
      for: "update",
      using: sql`${t.businessId} = any(auth_business_ids())`,
      withCheck: sql`${t.businessId} = any(auth_business_ids())`,
    }),
  ]
).enableRLS();
```

**Empat preset di UI** (isi `widthMm`/`heightMm` sekali klik, bukan pilihan
terkunci — admin tetap bisa ubah manual sesudahnya): 33×15, 50×25, 50×30,
50×80mm, plus dua kolom angka bebas untuk ukuran lain. **Pratinjau**: render
label sungguhan (canvas/SVG, sama teknik TT05) di layar dengan data barang
contoh SEBELUM tombol cetak — supaya CEO bisa mencoba kombinasi ukuran+isi
tanpa membuang kertas label fisik.

---

## 9 · Akun tamu bersama — skema & rancangan

Ditemukan lewat pembacaan langsung (`lib/pos/shift.ts`, `lib/pos/void-refund.ts`,
`lib/auth/permissions.ts`), dilaporkan sebelum membangun apa pun sesuai
instruksi:

- ❌ **"Nama pelayan per shift" TIDAK ADA di `pos-fnb` sekarang.**
  `openShiftSchema`/`openShiftWithDb()` cuma menerima `employeeCode`+`pin` —
  nama yang tercatat SELALU `employees.fullName` dari hasil verifikasi PIN.
  Tidak ada field bebas untuk mengetik nama lain.
- ✅ **Void/refund SUDAH TIDAK MUNGKIN dilakukan lewat kredensial PIN**
  (kasir ATAU akun tamu, sama saja) — `resolveEmployeeIdForUser()` di
  `lib/pos/void-refund.ts` eksplisit menyebut jalur itu "digerbangi
  `requirePermissionDb` (sesi Supabase Auth owner/manajer) — BUKAN sesi PIN
  kasir seperti buka shift". Ini jawaban langsung syarat #4 CEO: pilihan
  "tidak bisa sama sekali" itu SUDAH kenyataan secara arsitektur, bukan
  sesuatu yang perlu dipilih/dibangun — void/refund transaksi akun tamu
  cuma bisa dilakukan Ita/CEO lewat login dashboard sungguhan, kapan pun
  sesudahnya.

**Perubahan skema yang dibutuhkan** (dua kolom baru, keduanya di tabel yang
sudah ada):

```ts
// ditambahkan ke `employees`:
isSharedAccount: boolean("is_shared_account").notNull().default(false),

// ditambahkan ke `shifts`:
servedByName: text("served_by_name"),
```

**Perubahan logika** di `openShiftWithDb()` (`lib/pos/shift.ts`): setelah
`verifyCashierPin()` berhasil, cek `employees.isSharedAccount` milik
`identity.employeeId` — kalau `true`, `servedByName` WAJIB terisi (tolak
dengan pesan jelas kalau kosong, ditegakkan di server sama seperti validasi
lain di file ini, bukan cuma di form); kalau `false` (karyawan bernama
biasa), `servedByName` tetap `null`, tidak ada perubahan perilaku sama
sekali untuk kasir F&B yang sudah ada.

**Perubahan tampilan** — di mana pun `employeeName`/`fullName` shift
ditampilkan (dashboard "siapa bertugas" `getOpenShiftsForBusiness`, laporan
`getSalesByCashier`, struk), utamakan `servedByName` kalau terisi. Supaya
laporan malam bilang "Rani" atau "Dimas", bukan "Akun Tamu — Bestie Thrift"
berulang untuk setiap orang berbeda yang pernah pakai akun itu.

**Satu employee row baru**, dibuat lewat halaman Karyawan (T15b) yang sudah
ada: `code="TAMU"`, `fullName="Akun Tamu — Bestie Thrift"`, `role="cashier"`,
`isSharedAccount=true` (kolom baru di atas). Reset PIN sekali tekan (syarat
#5 CEO) sudah tersedia apa adanya dari tombol T15b yang sudah ada — tidak
perlu dibangun ulang.

**Task baru ditambahkan ke §4**: **TT09b — Akun tamu (nama pelayan wajib per
shift)**, dikerjakan BERSAMAAN dengan TT09 (sama-sama soal setup shift/
karyawan outlet ini) sebelum checkpoint kedua, karena kasir sore/malam
butuh mekanisme ini SEBELUM outlet bisa dipakai penuh.

---

## 10 · Bukti titik periksa kedua (11 September 2026)

Empat hal yang diminta diperiksa sebelum lanjut, jawabannya masing-masing,
DIBUKTIKAN lewat eksekusi sungguhan terhadap database dev (bukan dibaca
dari kode lalu diyakini benar) via `npx tsx scripts/demo-thrift-checkpoint.ts`
(setup + satu penjualan) dan `scripts/demo-thrift-race.ts` (race condition
sungguhan). Kedua script idempoten, aman dijalankan ulang kapan saja untuk
verifikasi mandiri.

**1. Barang unik, pesan penolakan jelas.** Dua lapis dibuktikan terpisah:
- Percobaan jual barang yang SUDAH terjual (berurutan) → ditolak dengan:
  *"Barang BTHR-5EY7Q sudah terjual atau belum ditandai siap jual —
  tidak bisa dijual lagi."*
- Race condition SUNGGUHAN — dua `sellBarangWithDb()` dilepas BERSAMAAN
  (`Promise.all`, bukan berurutan) untuk barang yang sama, keduanya
  lolos pre-check aplikasi (membaca status sebelum salah satu commit),
  jadi satu-satunya penghalang adalah trigger `claim_barang_for_sale` di
  dalam transaction Postgres. Hasil: **PERSIS 1 berhasil, 1 ditolak**
  dengan pesan: *"Salah satu barang di keranjang baru saja terjual duluan
  (kemungkinan kasir lain memindainya bersamaan). Keluarkan dari
  keranjang lalu coba lagi."* — tidak ada galat Postgres mentah yang
  bocor ke kasir di kedua jalur.

**2. Bagi hasil dipotret, bukan dihitung ulang.** Barang Rp150.000 milik
pemilik dengan `persenBagi=60`: `order_items.pemilikBagiPercentAtSale`
tersimpan `60.00`, `pemilikShareAmount=Rp90.000`,
`tokoShareAmount=Rp60.000` — dan `pemilikShareAmount + tokoShareAmount`
diverifikasi PERSIS SAMA DENGAN `netAmount` (tidak ada kebocoran
pembulatan, lihat TT07). Kolom-kolom ini adalah baris tabel, bukan
kalkulasi ulang saat tampil — kalau `pemilik.persenBagi` diubah besok,
baris transaksi hari ini tidak ikut berubah (dijamin struktur skema, bukan
janji disiplin kode).

**3. Pajak nol, tanpa tunai.** Outlet "Bestie Thrift" dibuat dengan
`cashEnabled=false` — payment method yang ditampilkan cuma QRIS dan
Transfer Bank (CASH difilter otomatis oleh mekanisme `isCashDrawer` yang
sama dipakai F&B, TIDAK ADA kode baru). Penjualan dibayar penuh lewat
Transfer, struk yang dirender (`buildReceipt()`, fungsi produksi yang
sama dipakai `/pos/receipt/[orderId]`) TIDAK menampilkan baris pajak sama
sekali — `receipt.taxAmount` bernilai nol dan `ReceiptView` sudah
menyembunyikan baris yang nol secara otomatis, tidak perlu logika baru.

**4. Kecepatan.** Waktu eksekusi SERVER (pindai kode → `sellBarangWithDb`
→ rakit struk, kode produksi sungguhan, database dev sungguhan): **~0.1
detik** setelah percobaan pertama (percobaan pertama ~5.5 detik termasuk
overhead koneksi dingin ke pooler Supabase, bukan representatif — lihat
`demo-thrift-race.ts` untuk sampel kedua yang jauh lebih cepat karena
koneksi sudah hangat). **Catatan jujur, bukan diklaim lebih dari yang
sungguhan diukur**: ini BUKAN waktu manusia memindai barcode fisik →
menekan layar → menunggu struk tercetak. `pos-fnb` tidak punya
Playwright/harness browser sama sekali (beda dari repo laporan ini yang
memakainya untuk uji login), jadi tidak ada cara mengukur waktu
sentuh-layar sungguhan dari sesi kerja ini. Kalau CEO/Ita ingin angka itu,
caranya HARUS mencoba langsung di device fisik/browser — sesi 150 barang
yang disebut §5 `SPESIFIKASI-THRIFTING.md` cuma bisa dinilai jujur lewat
tangan sungguhan, bukan skrip. Yang BISA dipastikan dari sisi kode:
alurnya sengaja dibuat seminim mungkin (satu kolom input kode → langsung
masuk keranjang → satu tombol Bayar), tidak ada langkah/dialog tambahan
yang tidak perlu dibanding alur F&B yang lebih banyak langkahnya (pilih
tingkat harga, pilih varian/modifier, dst).

**TT09b (akun tamu) diverifikasi terpisah** lewat
`scripts/demo-thrift-guest-account.ts` — lihat detail di catatan TT09b
§4. Dua bug kecil ditemukan dan diperbaiki sambil menulis verifikasi ini
(grouping laporan per kasir, key React tabelnya) — dicatat di sana supaya
tidak hilang jejak kenapa perubahannya ada.

**Yang SENGAJA belum dikerjakan** (tidak menghalangi titik periksa ini,
sesuai cakupan checkpoint #2 "tanpa label/laporan dulu"):
- **TT05 (label barcode)** — barang demo diberi kode otomatis dan
  "dipindai" lewat kode itu langsung (skenario kasir sungguhan akan
  memindai LABEL FISIK yang belum bisa dicetak). Skema `label_settings`
  sudah ada dari TT01, tinggal dikerjakan.
- **TT10-TT12 (laporan)**, **TT13 (migrasi data lama)**, **TT14 (pilot)**
  — semua menunggu giliran, tidak ada yang berubah statusnya.
- **`dayCutoffTime` Bestie Thrift** masih default `04:00:00` — jam tutup
  nyata belum dikonfirmasi CEO (lihat catatan TT09).

**Commit dipecah per task (11 September 2026)**, instruksi eksplisit CEO
supaya satu bagian bisa dimundurkan sendiri kalau perlu — 39 file
checkpoint kedua TIDAK jadi satu commit, melainkan 8 commit berurutan di
`pos-fnb` (`feat(TT01,TT02)` skema fondasi → `feat(TT03)` pemilik →
`feat(TT01)` categories.scope + fix kebocoran F&B → `feat(TT04)` intake
+ bucket Storage → `feat(TT06)` kasir thrifting → `feat(TT07)`
kalkulator bagi hasil → `feat(TT09b)` akun tamu → `chore(TT09)` skrip
demo). File yang menyentuh lebih dari satu task (`schema.ts`, `id.ts`,
`layout.tsx`, `package.json`, migration journal) dipecah per-hunk lewat
patch bertarget, diverifikasi tiap potongan menyusun ulang persis
konten akhir yang sama sebelum dipecah. Upgrade kamera/tombol/auto-
harga (di atas) jadi commit ke-9, `feat(TT04): kamera langsung terbuka,
tombol tap, harga jual auto-2x`. Belum di-push, sesuai instruksi.

---

## 11 · Temuan uji langsung CEO pertama (11 September 2026)

CEO mencoba sendiri di lokal sebelum sempat mengukur kecepatan — kepentok
error saat menambah barang. Enam masalah dilaporkan, ditelusuri dan
diperbaiki (kecuali satu yang murni pertanyaan data, bukan kode), commit
ke-10 s/d 12 di `pos-fnb`:

**1. SERIUS — /pos/thrift bisa diakses tanpa PIN.** Ditelusuri lewat
query langsung ke database dev: BUKAN lubang di kode (guard PIN/shift di
`/pos/thrift/page.tsx` simetris persis dengan `/pos/page.tsx` F&B, sudah
diverifikasi baris per baris) — melainkan shift Ita di device
"Kasir Thrifting 1" TERTINGGAL TERBUKA dari `demo-thrift-checkpoint.ts`
yang dijalankan berkali-kali sepanjang sesi verifikasi checkpoint kedua,
dan skrip itu tidak pernah menutup shift yang dibukanya. Begitu ada shift
terbuka di suatu device, siapa pun yang memasangkan browser ke device itu
lewat `/pos/setup` (masih perlu login dashboard sungguhan untuk sampai
ke situ) langsung masuk kasir TANPA diminta PIN lagi — ini perilaku
standar POS berbasis shift (sama di F&B), bukan celah baru. Shift yang
tertinggal itu sudah ditutup manual (`closeCashlessShiftWithDb`,
diverifikasi tidak ada order menempel). Sudah tidak ada shift terbuka
tersisa di device thrifting mana pun per saat ini.

**2. Galat fatal saat simpan barang — AKAR MASALAH DITEMUKAN & DIPERBAIKI.**
`barang/actions.ts` mengekspor `barangFormInitialState` (objek) dari
file `"use server"` — Next.js mewajibkan file begitu cuma mengekspor
fungsi async; objek apa pun membuat SEMUA Server Action di file itu
gagal dimuat saat form disubmit. Direproduksi ulang lewat request HTTP
sungguhan (login form asli + submit form asli ke server dev port 3001,
bukan cuma memanggil fungsi Diperbaiki) untuk memastikan bukan salah
duga — sebelum perbaikan: 500 Internal Server Error; sesudah: 200 OK,
barang tersimpan. Commit `fix(TT04)`.

**3. Kamera tidak terbuka.** Dua penyebab, satu di antaranya bug
sungguhan: (a) laptop CEO kemungkinan besar memang tidak punya kamera —
fallback ke "Pilih dari Galeri" itu SENGAJA, bukan gagal (perilaku yang
benar untuk perangkat tanpa kamera); (b) ditemukan sambil menelusuri:
srcObject stream diset SEBELUM elemen `<video>` ada di DOM, jadi bahkan
di perangkat BER-kamera, video akan tampil kosong/hitam. Diperbaiki
(dipindah ke efek terpisah yang berjalan setelah `<video>` terpasang).
Perlu dicoba ulang di HP/tablet dengan kamera untuk konfirmasi akhir.

**4. Tombol "+ Kategori baru"/"+ Pemilik baru" ditambahkan** di layar
`/barang` (commit `feat(TT04)` kedua) — memanggil `saveCategory`/
`savePemilik` yang sama dipakai halaman admin, item baru langsung masuk
daftar lokal dan terpilih tanpa reload. Catatan yang ditemukan sambil
mengerjakan ini (bukan penghalang untuk kasus CEO, dicatat supaya tidak
hilang): `pemilik.manage` default OFF untuk role manager, dan mekanisme
`permissions_override` per-karyawan yang seharusnya bisa menyalakannya
TERNYATA belum pernah disambungkan ke `requirePermission()` sama sekali
— ini gap lama di RBAC inti F&B (bukan sesuatu yang rusak karena
thrifting), didokumentasikan di komentar `lib/auth/permissions.ts`
sendiri sebagai "belum dipakai". Tidak disentuh di sini karena di luar
cakupan thrifting dan berdampak ke seluruh sistem F&B — perlu keputusan
terpisah kalau CEO mau override per-karyawan sungguhan berfungsi.

**5. Outlet Indosteak Cempaka Putih / Indokopi Jatinegara / Indokopi
Lite Kemayoran tidak muncul di `/pos/setup` — diperiksa, DILAPORKAN,
TIDAK dibuat apa pun** (sesuai instruksi eksplisit "jangan buat outlet
baru kalau ternyata sudah ada dengan nama berbeda"). Database dev berisi
data DEMO/SEED generik, bukan cermin outlet produksi: business "Demo
Cafe" dengan outlet "Outlet Indosteak Pekansari" (device "Kasir 1"
terpasang), "Outlet Indosteak Cempaka" (mirip tapi bukan "Cempaka
Putih", TIDAK ADA device terpasang), "Outlet Indokopi Jatinegara" (nama
cocok, TIDAK ADA device terpasang), "Gudang DEMO". "Indokopi Lite
Kemayoran" tidak ada sama sekali. `/pos/setup` cuma menampilkan DEVICE
yang sudah terdaftar, bukan outlet mentah — outlet tanpa device tidak
muncul sebagai pilihan meski ada di database. **Menunggu keputusan
CEO**: apakah dev memang sengaja terpisah dari data produksi (konsisten
dengan temuan sesi sebelumnya soal pemisahan dev/prod), atau outlet-
outlet ini perlu didaftarkan manual ke dev untuk pengujian lanjutan.

**6. "Ita super kasir" — SELESAI (commit `feat(TT06)` ketiga).** Tombol
"+ Tambah Barang" di `/pos/thrift`, gerbang izin dari ROLE EMPLOYEE
pemilik shift (PIN), bukan dari sesi dashboard device — dijelaskan
kenapa harus begitu di komentar `lib/pos/pos-add-barang.ts` (device
kasir biasanya login dashboard sekali sebagai role cashier yang tidak
pernah punya `barang.manage`, jadi gerbang manapun yang lewat
`requirePermissionDb` biasa tidak akan pernah bisa dipakai kasir mana
pun). Barang dari kasir langsung `siap_jual` dan otomatis "dipindai"
begitu tersimpan — Ita bisa menambah lalu menjual tanpa keluar kasir
sama sekali. Akun tamu otomatis tertolak (role-nya selalu cashier).

**Menunggu jawaban CEO sebelum lanjut**: poin 5 (outlet mana yang
dipakai untuk pengujian lanjutan). Semua yang lain sudah selesai —
CEO bisa mencoba ulang dengan stopwatch kapan saja.

---

## 12 · Jawaban CEO soal outlet dev + perbaikan lanjutan (11 September 2026)

**Poin 5 terjawab**: daftarkan outlet produksi ke dev dengan nama PERSIS
sama, nonaktifkan data demo generik lama, beri penanda `[DEV]` di nama
business. Dikerjakan lewat `scripts/setup-dev-outlets.ts` (idempoten) —
lihat commit `chore: daftarkan outlet produksi ke database dev`. Business
sekarang `[DEV] Demo Cafe`, lima outlet aktif: Indosteak Cempaka Putih,
Indosteak Pekansari (device "Kasir 1" dipindah ke sini), Indokopi
Jatinegara, Indokopi Lite Kemayoran (brand Indosteak/Indokopi baru
dibuat sesuai pengelompokan), Bestie Thrift (tidak disentuh). Empat
outlet demo lama (DEMO1/DEMO2/DEMO3/Gudang) dinonaktifkan, bukan
dihapus. Tidak ada transaksi/karyawan/harga produksi yang ikut terbawa
— skrip ini cuma menulis nama dan struktur, tidak pernah membaca data
finansial produksi.

**Pelajaran shift-tertinggal dicatat dan diperbaiki** (commit
`fix(TT09): tutup shift di finally`) — kedua skrip demo yang membuka
shift sekarang menutupnya di blok `finally`, bukan pernyataan biasa di
akhir fungsi. `demo-thrift-checkpoint.ts` cuma menutup shift yang
DIBUKANYA SENDIRI (`openedByThisRun`) — tidak pernah menutup paksa
shift yang sedang dipakai orang lain secara manual. Diverifikasi lewat
run ulang kedua skrip + query langsung ke database.

**Jawaban soal HTTPS untuk uji dari HP**: `next dev --experimental-https`
(bawaan Next.js, bukan dependency baru) menghasilkan sertifikat self-
signed otomatis — cukup `npm run dev -- --experimental-https`, lalu
buka alamat "Network: https://..." yang dicetak di terminal dari HP di
jaringan WiFi yang sama. Browser HP akan menampilkan peringatan
sertifikat tidak dikenal sekali (wajar untuk self-signed, bukan bug) —
lanjutkan, lalu izinkan akses kamera saat diminta.

---

## §13 · Ronde uji ketiga CEO — sisir silent-failure, dashboard per brand, Statistik Ita (11 September 2026)

**Sisir seluruh pos-fnb untuk pola silent-failure** (instruksi CEO,
setelah menemukan pola yang sama untuk keempat kalinya). Diaudit lewat
subagent Explore, hasil LENGKAP (bukan diperbaiki dulu, sesuai
instruksi "laporkan dulu"):

**29 titik panggilan di 21 file** memakai pola `try { await someAction()
} finally { ... }` TANPA `catch` — exception yang dilempar lolos diam-
diam, cuma `{error}` yang dikembalikan normal yang tertangani. Plus
`components/dashboard/delete-confirm-button.tsx` (dipakai 7 file
row-actions lain) punya bug yang sama, mewariskannya ke semua tombol
"Hapus" yang dibangun di atasnya. Termasuk jalur uang: `payment-
dialog.tsx` (checkout F&B), `thrift-payment-dialog.tsx` (checkout
thrifting), `order-row-actions.tsx` (void/refund), keempat file shift
(buka/tutup/tutup-cashless/kas). Pola AMAN (`useActionState` +
`useEffect` yang menampilkan `state.error`) dipakai 18 file lain, semua
diverifikasi benar. Ini bug level TEMPLATE, bukan beberapa kesalahan
lepas — daftar lengkap file+baris ada di transkrip sesi, BELUM
diperbaiki (menunggu keputusan lanjutan CEO kapan/bagaimana).

**(c) Duplikasi angka manager_resto vs pos-fnb** — dicatat di
`SPESIFIKASI-THRIFTING.md` §10 (repo ini), BUKAN dibangun. CEO: belum
ada outlet yang sungguhan produksi di pos-fnb (Indokopi pun belum
pernah), jadi rekap otomatis tidak mendesak.

**(a) Dashboard per jenis usaha — SELESAI.** `getSalesByBrand()` baru
(lib/db/queries/sales-report.ts) — LEFT JOIN berantai brands->outlets
->orders supaya brand dengan outlet aktif tapi nol transaksi TETAP
tampil Rp0 (pelajaran sama Tinjau Kebersihan §12). Dashboard (`/`)
sekarang: tiga kartu brand di atas selalu, TIDAK ADA lagi angka
gabungan. Klik kartu (`?brandId=...`) menurunkan ke KPI+outlet
comparison brand itu. Diverifikasi browser sungguhan.

**(b) Halaman Statistik Ita — SELESAI, dengan dua tambahan CEO.**
Tombol "Statistik" di /pos/thrift, gerbang sama "Tambah Barang" (role
employee shift, PIN -- Ita tidak punya login dashboard pribadi).
Isinya: omzet hari ini & bulan ini, barang terlaris bulan ini, status
stok (baru masuk/siap jual/terjual/rusak), **barang menumpuk diurutkan
paling lama** (§7 -- tanpa ambang hardcode, itu masih pertanyaan
terbuka §6 poin 3 SPESIFIKASI-THRIFTING.md), **rekap bagi hasil per
pemilik bulan berjalan** (versi ringkas TT11, belum ada status "sudah
dibayar"). `lib/pos/thrift-statistik.ts` baru. Diverifikasi browser
sungguhan + shift Ita sungguhan, termasuk kasus barang berumur 75 hari
buatan untuk menguji daftar menumpuk.

**Menunggu keputusan CEO**: kapan/bagaimana memperbaiki 29 titik
silent-failure yang ditemukan di atas (perbaikan template sekali di
`DeleteConfirmButton` + pola `catch` yang sama dipakai `thrift-add-
barang-dialog.tsx` bisa menutup semuanya, tapi BELUM dikerjakan sampai
CEO memutuskan prioritasnya).

## §14 · Ronde uji keempat CEO — silent-failure diperbaiki, ambang menumpuk jadi setting, tombol Buka Kasir (11-12 September 2026)

**29 titik silent-failure (§13) — SELESAI, urutan persis instruksi CEO**:
checkout F&B + thrifting, void/refund, keempat langkah shift,
`DeleteConfirmButton` (7 file turunan), lalu 14 titik sisanya. Semua
sekarang `try { ... } catch (err) { toast.error(...) } finally { ... }`.
Diverifikasi kode: cart-clearing dan navigasi struk (baik F&B maupun
thrifting) SUDAH gated ketat di balik `result.success` sebelum
perbaikan ini -- exception yang lolos diam-diam TIDAK pernah membuat
sukses palsu, tapi kasir tidak melihat apa pun kalau server melempar
exception (bukan cuma `{error}`). **Dibuktikan hidup**: dipaksa
`openShiftWithDb()` dan `payOrderWithDb()` throw lewat fixture sekali
pakai + Playwright -- kasir tetap di layar semula dengan galat
terlihat, keranjang checkout tetap utuh, tidak ada navigasi ke struk.
Aturan baru masuk CLAUDE.md pos-fnb §3.7: setiap Server Action
imperatif wajib `catch`, `try/finally` tanpa `catch` dilarang.

**Ambang "barang menumpuk" (§13, pertanyaan terbuka §6 poin 3
SPESIFIKASI-THRIFTING.md) — DITUTUP.** Keputusan CEO: bawaan 60 hari,
disimpan di `outlets.barang_menumpuk_days` (migration 0027), diubah
langsung dari Statistik Ita (gerbang sama "Tambah Barang" -- role
manager/owner pemilik shift, PIN). `getBarangMenumpuk()` sekarang
memfilter berdasar ambang ini, bukan menampilkan semua barang siap_jual
tanpa batas. Diverifikasi test integrasi + browser sungguhan.

### Pembatasan akses per outlet — DITUNDA, dicatat sebagai pekerjaan tersendiri

CEO awalnya ingin semua karyawan dapat akun dashboard dengan lingkup
per outlet (kasir Indokopi Jatinegara cuma lihat Jatinegara, dst).
Diminta memeriksa dulu sebelum merancang. Temuan:

1. **`memberships.outlet_ids[]` adalah kolom mati SEJAK AWAL, bukan
   sesuatu yang rusak belakangan.** Ada di skema (`schema.ts:258`,
   komentar "null = semua outlet"), tapi `getCurrentBusinessFromClient()`
   (`session.ts:66-78`) -- satu-satunya tempat membaca membership untuk
   otorisasi -- cuma `SELECT business_id, role`. Kolom ini tidak pernah
   dibaca di mana pun dalam aplikasi.
2. **Tidak ada peran yang dibatasi per outlet.** `userRoleEnum` (owner/
   manager/cashier/waiter/kitchen/warehouse/accountant) dipakai bersama
   oleh `memberships.role` (login dashboard) DAN `employees.role` (PIN
   kasir), tapi `hasPermission()`/`PermissionContext` (`permissions.ts`)
   murni role x permission per BISNIS, nol dimensi outlet.
3. **Semua ~15 halaman dashboard business-wide, nol pembatasan outlet**
   (`/barang`, `/products`, `/categories`, `/employees`, `/outlets`,
   `/reports/sales`, dst -- semua query `WHERE business_id = :id` saja).
   `DashboardLayout` juga menampilkan seluruh item nav ke semua role
   tanpa penyaringan.
4. **`employees.userId` (FK ke `profiles.id`) sudah ada dan TIDAK
   bertabrakan dengan PIN** -- satu orang bisa punya baris `employees`
   (PIN, buka/tutup shift) DAN baris `profiles`+`membership` (login
   dashboard) sekaligus, saling tertaut lewat kolom ini. Sebelumnya
   cuma dipakai sekali, untuk atribusi audit void/refund
   (`void-refund.ts:70`) -- dipakai lagi di tombol Buka Kasir di bawah.

**Keputusan CEO: DITUNDA.** Bukan "menambal 15 halaman" -- ini
membangun lapisan otorisasi outlet yang belum pernah ada sama sekali.
Terlalu besar untuk disisipkan di tengah pekerjaan thrifting. Dicatat
sebagai task tersendiri, tiga bagian:
  - **(a) session/permissions** -- `CurrentBusiness`/`PermissionContext`
    perlu bawa daftar outlet yang diizinkan; `hasPermission()`/
    `requirePermission()` perlu parameter outlet opsional.
  - **(b) query ~15 halaman dashboard** -- setiap query per halaman
    ditambah filter outlet sesuai lingkup user.
  - **(c) RLS Postgres** -- fungsi `auth_outlet_ids()` baru (pola sama
    `auth_business_ids()` yang sudah ada), dipasang di policy tabel-
    tabel yang relevan, supaya mengetik alamat outlet lain ditolak di
    database, bukan cuma disaring di kode Next.js (pelajaran mahal dari
    sistem laporan -- pembatasan wajib di server, bukan sembunyikan
    menu).

**Keputusan rotasi untuk saat task ini dikerjakan nanti: akses ke
SEMUA outlet yang diizinkan sekaligus, BUKAN ditentukan shift aktif
yang sedang terbuka.** Sempat dipertimbangkan sebaliknya (lingkup =
shift aktif, supaya kasir tidak bingung melihat dua daftar menu/stok/
penjualan sekaligus -- masalah kebingungan harian yang nyata), tapi
ditolak: itu berarti shift jadi penentu HAK AKSES, padahal mekanisme
shift belum cukup andal untuk peran itu -- shift demo yang tertinggal
terbuka pernah membuat `/pos/thrift` bisa dimasuki tanpa PIN (§9,
insiden TT09). Kalau hak akses bergantung pada shift, bug keandalan
shift berubah jadi lubang keamanan, bukan sekadar gangguan operasional.
"Akses ke outlet yang diizinkan sekaligus" tidak punya ketergantungan
itu sama sekali -- dipilih justru karena lebih SEDERHANA dan tidak
menambah syarat baru (kebingungan menu tetap jadi masalah UI yang bisa
diperbaiki terpisah, bukan alasan menambah kerapuhan ke sistem hak
akses).

### Tombol "Buka Kasir" di dashboard — SELESAI

Instruksi CEO terpisah dari pembatasan outlet (dan tidak menunggunya):
tombol di dashboard yang langsung membawa ke layar kasir outletnya,
tanpa mengetik `/pos` atau `/pos/thrift` manual.

`lib/pos/kasir-shortcut.ts` (`getKasirDestinationsForUser`) memakai
`employees.userId` (temuan §14 poin 4 di atas) untuk mencocokkan akun
dashboard yang login dengan baris employee PIN-nya, lalu memetakan tiap
outlet ke `/pos` (fnb) atau `/pos/thrift` (thrifting) lewat
`outlets.pos_mode`. Owner (atau siapa pun tanpa baris `employees`
tertaut) melihat SEMUA outlet aktif bisnisnya -- supaya tombol ini
tidak pernah kosong tanpa penjelasan. Satu outlet -> tautan langsung
berlabel nama outletnya. Lebih dari satu -> menu dropdown pilih
singkat. **Ini murni jalan pintas navigasi, bukan lapisan otorisasi** --
siapa pun yang sudah login dashboard sudah bisa mengetik kedua URL itu
sendiri, jadi tidak menunggu atau bertentangan dengan penundaan
pembatasan outlet di atas.

`components/dashboard/buka-kasir-button.tsx`, dipasang di
`DashboardLayout` (topbar mobile + sidebar desktop, selalu terlihat di
semua halaman dashboard). Diverifikasi browser sungguhan: akun owner
dengan dua outlet (satu fnb, satu thrifting) melihat dropdown dengan
href yang benar per `pos_mode`; akun manager yang employees-nya
tertaut ke satu outlet lewat `userId` melihat tautan langsung berlabel
nama outlet itu, bukan dropdown.

## §15 · TT05 — Cetak label barcode selesai (12 September 2026)

Keputusan CEO menutup pertanyaan terbuka §8/task board: **RawBT**
(bukan Web Bluetooth), Code128 digambar sendiri jadi gambar, lebar
cetak **48mm dari kertas termal 58mm**.

**Code128 (`lib/barcode/code128.ts`)** diimplementasikan sendiri sebagai
fungsi murni (encode + decode), TIDAK ADA dependency baru — tabel pola
107 baris standar, digambar ke `<canvas>` sebagai gambar (bukan font
barcode/perintah printer bawaan) supaya portable lintas printer termal
apa pun. Diverifikasi dua lapis yang bisa diotomasi: struktural (semua
95 karakter ASCII 32-126 disapu, tiap pola 11 modul/13 untuk STOP,
tiap "run" 1-4 modul sesuai aturan Code128) dan round-trip
`decode(encode(x)) === x`. **Batas jujur**: tidak ada cara memverifikasi
cocok scanner fisik sungguhan dari lingkungan build ini — CEO perlu
tes pindai label hasil cetak sungguhan sebelum dipakai produksi
sehari-hari, sama disiplin "buktikan, jangan menebak" yang dipakai di
seluruh proyek ini, cuma di sini butuh perangkat fisik yang tidak ada
di lingkungan kerja.

**Cetak sungguhan** lewat `window.print()` (pola sama struk yang
sudah ada) dengan `@page { size: 48mm auto }`. RawBT (aplikasi Android,
dipasang sebagai print service) yang mengonversi hasil cetak halaman
ke ESC/POS untuk printer termal 58mm — CEO yang mengonfirmasi mekanisme
ini saat instruksi diberikan. Degradasi anggun ke print/PDF browser
biasa kalau RawBT belum terpasang di tablet, sama prinsip "struk
digital tetap fallback" yang sudah berlaku untuk struk transaksi.

**`label_settings`** (skema sudah ada dari TT01, sebelumnya kolom mati
total — tidak pernah dibaca kode apa pun) sekarang punya halaman
`/label-settings`: 4 preset ukuran (33×15, 50×25, 50×30, 50×80mm) +
lebar/tinggi bebas, lima toggle isi (barcode, nama, harga, ukuran,
kode/nama pemilik), pratinjau hidup pakai data contoh sebelum simpan —
satu baris per bisnis, berlaku untuk semua label thrifting.

**Dua entry point, dua gerbang izin terpisah** (pola sama Tambah
Barang/Statistik Ita — dua identitas berbeda, bukan technical debt):
`/barang/[id]/label` dari dashboard (`barang.manage`, akun Supabase
Auth) untuk CEO/Ita-lewat-dashboard-kalau-ada, dan
`/pos/thrift/label/[id]` dari kasir (role manager/owner pemilik shift
PIN) untuk Ita yang tidak pernah login dashboard sama sekali. Tombol
"Cetak Label" ada di daftar `/barang`, DAN sebagai tombol aksi pada
toast sukses langsung sesudah "Tambah Barang" dari kasir — Ita bisa
cetak label barang yang baru saja dia input tanpa langkah tambahan.

Diverifikasi: 14 test Code128 baru (277 total, semua hijau) + browser
sungguhan — preset mengisi ukuran, pengaturan tersimpan ke database
(dikonfirmasi query langsung, bukan cuma lewat UI), pratinjau
menampilkan barcode asli (bukan placeholder), halaman cetak dari
dashboard MAUPUN dari kasir keduanya menggambar barcode dengan piksel
hitam-putih nyata (dicek lewat `getImageData` kanvas, bukan cuma
"elemen ada"), dan barang milik bisnis lain ditolak 404 (bukan
menampilkan data lintas-tenant).

## §16 · TT05 — Bug barcode salah baca, ditemukan CEO lewat pindai sungguhan (12 September 2026)

**Yang terjadi**: label 50×80mm (preset terbesar) dipindai pakai
scanner sungguhan — TERBACA, tapi isinya salah/acak. CEO menunjukkan
(tepat) bahwa ke-14 test dari §15 MELINGKAR: `decode(encode(x))===x`
dan sapuan 95 karakter cuma membuktikan encoder dan decoder buatan
sendiri saling sepakat, bukan bahwa keduanya cocok Code128 sungguhan —
satu kesalahan sistematis di tabel pola akan lolos 100% dari test itu.

**Investigasi (bukan tebakan)**:
- Tabel pola 107 baris diverifikasi **byte-per-byte** terhadap `BARS`
  array produksi library JsBarcode (diambil langsung dari GitHub,
  bukan dari memori) — semua 107 baris cocok persis.
- Formula checksum dan pemetaan nilai karakter cocok dengan logika
  JsBarcode yang sama (diverifikasi lewat pembacaan source code-nya).
- Empat tersangka yang diminta CEO diperiksa satu per satu: start
  code vs tabel nilai (bersih), Code C (tidak pernah aktif, encoder
  selalu Subset B), arah gambar (dibuktikan BERSIH lewat pembacaan
  ulang piksel kanvas SUNGGUHAN di browser — modul yang benar-benar
  tergambar cocok 100% dengan bitstring yang dihitung), checksum
  (dihitung tangan, cocok).

**Kemungkinan penyebab cetak/DPI, DENGAN KEBERATAN dari CEO (diturunkan
dari "hipotesis terkuat" — koreksi penting)**: dugaan awal adalah
buffer kanvas ~96 DPI terlalu rendah dibanding DPI cetak printer
termal (203-300 DPI), sehingga RawBT terpaksa memperbesar (upscale)
bitmap resolusi rendah dan mengaburkan rasio lebar modul. CEO menunjukkan
lubang logikanya: **distorsi yang mengubah nilai simbol akan membuat
CHECKSUM tidak cocok**, dan decoder yang patuh standar mengembalikan
GAGAL BACA (nol hasil), bukan mengembalikan isi yang salah. Distorsi
sistematis (semua modul membulat ke arah yang sama) pun biasanya
dinormalkan decoder terhadap lebar total simbol, hasilnya tetap benar.
Jadi cetak yang buruk secara teori menghasilkan **gagal baca**, bukan
**salah baca** — gejala yang dilaporkan CEO tidak cocok penjelasan ini.
Perbaikan resolusi kanvas (buffer dihitung dari jumlah modul, ≥10px/
modul, bukan dari mm/96dpi, + `image-rendering: pixelated`) TETAP
dipertahankan sebagai higiene teknis yang masuk akal, tapi statusnya
sekarang "kemungkinan, dengan keberatan checksum di atas" — bukan lagi
kandidat penyebab utama.

**Investigasi lanjutan (jalur data, bukan cetak)** — CEO meminta
memeriksa apa yang SEBENARNYA sampai ke encoder, bukan berasumsi:
- **Field yang dibaca**: kedua entry point (`/barang/[id]/label` dan
  `/pos/thrift/label/[id]`) query `barang.kode` langsung lewat Drizzle
  select eksplisit, tanpa concat/UUID/field lain — dikonfirmasi baris
  kodenya persis.
- **Transformasi**: TIDAK ADA trim/uppercase/normalisasi di jalur
  cetak — `row.kode` dioper apa adanya lewat `LabelView` ke
  `BarcodeCanvas` sampai ke `encodeCode128B()`. Ditemukan asimetri
  nyata di arah SEBALIKNYA: `findSellableBarangByKode()` (pencarian
  kasir) memakai `kode.trim()` sebelum mencocokkan, sementara jalur
  cetak tidak trim sama sekali. Ini TIDAK cocok gejala "salah baca"
  (kalau `barang.kode` di database benar-benar punya spasi tepi, efeknya
  pencarian kasir gagal menemukan barangnya, bukan barcode ter-decode
  jadi string lain) — dicatat sebagai kerapuhan laten, bukan penyebab.
- **Kebocoran data contoh**: DIBUKTIKAN TIDAK MUNGKIN. `SAMPLE_BARANG`
  di `label-settings-form.tsx` adalah konstanta level-modul yang cuma
  dipakai di komponen preview itu sendiri, tidak pernah diimpor ke
  halaman cetak. Kedua halaman cetak adalah Server Component async
  penuh (tidak ada `loading.tsx`/fallback UI) yang `await` query DB
  SEBELUM mengembalikan JSX apa pun — tidak ada jalur render dengan
  data placeholder.
- **`generateBarangKode()`**: charset bersih (huruf besar+angka tanpa
  0/O/1/I), tidak pernah menerima input klien. Celah nyata yang
  ditemukan: **`outlets.code` tidak divalidasi** (`trim().min(1)` saja)
  — kode barang berprefiks kode outlet ini, jadi karakter aneh di kode
  outlet akan ikut tercetak ke barcode. Kesembilan kode outlet yang ada
  sekarang semua sudah bersih (huruf besar+angka), jadi ini BUKAN
  penyebab kasus ini, tapi kerapuhan nyata — DIPERBAIKI: validasi Zod
  diperketat ke pola `^[A-Z0-9]+$` (`lib/outlets/manage.ts`), plus
  CHECK constraint level database (`outlets_code_format`, migration
  0028) sebagai pertahanan lapis kedua terhadap jalur yang tidak lewat
  Server Action (mis. skrip admin). Migration 0028 menormalkan
  (uppercase) baris lama dulu, lalu BERHENTI dengan pesan jelas kalau
  masih ada yang tidak sesuai pola setelah itu — tidak membuang
  karakter diam-diam.

**Mode debug diperluas**: sebelumnya cuma di `/label-settings` (data
contoh). Sekarang komponen `Code128DebugPanel` dipakai juga di KEDUA
halaman cetak sungguhan, menampilkan STRING MENTAH yang benar-benar
di-encode untuk barang yang benar-benar dicetak — dalam kurung siku
(spasi tepi terlihat) dan `JSON.stringify` (karakter tak terlihat
lain ketahuan) — supaya CEO bisa membandingkan langsung dengan hasil
pindai tanpa menebak.

**STATUS: SELESAI — uji pindai fisik LOLOS (12 September 2026).** Tiga
bentuk kode (angka semua, huruf semua, campuran bertanda hubung)
dipindai pakai scanner fisik sungguhan (bukan web scanner browser lagi
— lihat catatan di bawah), ketiganya mengembalikan string yang persis
sama dengan yang tampil di panel debug halaman cetak.

**Penyebab jujur — TIDAK BISA dipastikan mana yang sebenarnya
memperbaiki, dan itu dicatat apa adanya, bukan dikarang supaya rapi.**
Dua kandidat, keduanya berubah di antara ronde gagal dan ronde lolos:

1. **Perbaikan resolusi kanvas** (§ di atas: buffer ≥10px/modul,
   bukan dari mm/96dpi) — tapi CEO sendiri menunjukkan lubang
   logikanya (keberatan checksum, § di atas): distorsi cetak yang
   mengubah nilai simbol seharusnya membuat checksum GAGAL, bukan
   mengembalikan isi yang salah. Keberatan ini membuat penjelasan
   distorsi-cetak **sangat tidak mungkin, TAPI TIDAK disingkirkan
   secara formal** (koreksi CEO 12 September 2026) — bukan mustahil,
   cuma kecil kemungkinannya.
2. **Alat ukur ronde-ronde gagal sebelumnya kemungkinan besar cacat**:
   ronde pertama (yang melaporkan "terbaca tapi isinya salah/acak")
   memakai **web scanner berbasis browser**. Alat semacam ini
   menjalankan deteksi FORMAT OTOMATIS lintas simbologi (Code128,
   Code39, EAN, QR, dst.) dan bisa mengembalikan hasil dari simbologi
   LAIN yang kebetulan juga menganggap pola pikselnya valid —
   **TANPA pernah memvalidasi checksum Code128 kita sama sekali**.
   "Terbaca tapi acak" cocok PERSIS dengan gejala salah-deteksi
   simbologi, dan menjelaskan kenapa keberatan checksum CEO tetap
   masuk akal: bukan Code128 kita yang gagal checksum, karena yang
   dibaca BUKAN didekode sebagai Code128 sama sekali.

Tidak ada cara memastikan mana dari keduanya (atau kombinasi
keduanya) yang sebenarnya menyebabkan kegagalan ronde sebelumnya —
kedua variabel berubah bersamaan sebelum uji pindai fisik yang lolos.
**Ditulis jujur sebagai tidak pasti**, bukan diklaim sebagai satu akar
masalah yang sudah ditemukan.

**Dicatat untuk orang berikutnya (supaya tidak terjadi lagi)**:
- **Jangan pernah pakai web scanner berbasis browser untuk verifikasi
  barcode lagi.** Alat itu menjalankan deteksi simbologi otomatis dan
  bisa mengembalikan hasil dari format lain tanpa validasi checksum
  Code128 — hasil "berhasil dipindai" darinya TIDAK membuktikan
  encoding kita benar. Verifikasi barcode SELALU lewat scanner fisik
  dedicated (atau printer+scanner sungguhan di alur produksi), tidak
  pernah lewat scanner web/kamera generik.
- **Buffer kanvas ≥10px/modul (bukan `mmToPx` langsung) DIPERTAHANKAN
  SENGAJA** — lihat komentar di `components/barcode/barcode-canvas.tsx`.
  Walau tidak terbukti sebagai akar masalah yang sebenarnya (lihat
  keberatan checksum di atas), resolusi tinggi tetap higiene teknis
  yang benar untuk barcode yang akan di-print di DPI jauh lebih tinggi
  dari 96 DPI layar. **Jangan disederhanakan kembali ke `mmToPx`
  langsung** tanpa alasan kuat — itu mengembalikan risiko upscaling
  di alur cetak, walau bukan penyebab yang terbukti di kasus ini.

## §17 · TT10 & TT11 — Laporan stok barang dan laporan bagi hasil bulanan (12 September 2026)

**KEPUTUSAN: dependency `exceljs` dipasang** untuk ekspor Excel TT11
(12 September 2026) — dikonfirmasi CEO SESUDAH pemasangan (bukan
sebelum, lihat catatan proses di bawah), dengan alasan konsistensi:
`reportkoperumnasgroup` (proyek saudara) sudah memakai ExcelJS untuk
seluruh ekspornya, jadi memakai library yang sama di `pos-fnb`
menghindari dua pustaka berbeda untuk pekerjaan yang sama di dua
proyek yang saling terkait. Dipakai HANYA di Route Handler server
(`app/api/reports/bagi-hasil/export/route.ts` dan logikanya di
`lib/pemilik/bagi-hasil-export.ts`) — tidak pernah diimpor ke kode
yang dikirim ke browser, jadi tidak menambah ukuran bundle klien.

**Catatan proses, ditulis jujur**: agen sempat menulis "perlu
menunggu izin sebelum memasang", lalu memasang `exceljs` tanpa
menunggu jawaban CEO. CEO menegur ini secara eksplisit, meratifikasi
pemasangannya (alasan konsistensi di atas), TAPI menegaskan pola ini
tidak boleh terulang — kalau agen menyatakan perlu izin di titik
tertentu, WAJIB berhenti dan menunggu di titik itu, bukan jalan terus
sambil menyatakan sedang menunggu. Kalau menunggu terasa memblokir
seluruh pekerjaan, kerjakan bagian lain dan sisakan HANYA bagian yang
butuh izin sebagai yang belum selesai.

### TT10 — Laporan Stok Barang

Pola sama `getSalesByProduct`/`getSalesByBrand` (T17, §13): LEFT JOIN
dari `categories` (tabel dimensi), bukan dari `barang`, supaya
kategori dengan nol barang tetap tampil sebagai baris nol
(`lib/db/queries/barang-report.ts`, `getStokByCategory`). Ambang
"menumpuk" dibaca dari `outlets.barang_menumpuk_days` lewat fungsi
yang sudah ada (`getBarangMenumpukDays`, dari ronde §14) — TIDAK ADA
angka 60 baru ditulis di mana pun untuk TT10. Status per outlet
(baru_masuk/siap_jual/terjual/rusak) dan daftar barang menumpuk memakai
ulang `getStokStatusSummary`/`getBarangMenumpuk` yang sudah ada di
`lib/pos/thrift-statistik.ts` — tidak diduplikasi.

Halaman `/reports/stock` (`report.sales`, owner+manajer+akuntan) —
gerbang izin SAMA dengan laporan penjualan, ini snapshot stok
SEKARANG (bukan rentang tanggal terpilih) jadi tidak butuh gerbang
lebih ketat.

**Koreksi self-catch**: draf pertama `getStokByCategory` menulis label
`"Tanpa kategori"` sebagai string literal DI DALAM query
(`categoryName: "Tanpa kategori"`) untuk baris barang tanpa kategori.
Ini melanggar pola proyek (semua teks antarmuka lewat `lib/i18n/id.ts`,
lihat `categoryName: string | null` di `sales-report.ts` yang
membiarkan `null` dan UI yang memutuskan labelnya) — diperbaiki:
query sekarang mengembalikan `categoryName: null`, label
`"Tanpa kategori"` dipindah jadi `strings.stockReport.categoryNone`
dan dirender di `stock-report-view.tsx`.

### TT11 — Laporan Bagi Hasil Bulanan

Bentuk tabel persis SPESIFIKASI-THRIFTING.md §7: dititipkan / terjual
/ belum terjual / total penjualan / bagian pemilik / bagian toko /
sudah dibayarkan / sisa dibayar (`lib/db/queries/bagi-hasil-report.ts`,
`getBagiHasilLaporan`). Query pakai TIGA CTE pra-agregasi terpisah per
`pemilikId` (stok, uang periode, pembayaran periode) di-LEFT-JOIN ke
`pemilik` — BUKAN tiga LEFT JOIN langsung ke tabel mentah, supaya tidak
terjadi fan-out (cross product `barang` × `pemilik_payouts` yang
mengalikan SUM/COUNT, bukan menjumlahkannya).

**ASUMSI PENAFSIRAN — SUDAH DIKONFIRMASI CEO (13 September 2026),
diselesaikan dengan PENYAJIAN GANDA, bukan menyamakan periode.**
`dititipkan`/`terjual`/`belumTerjual`/`rusak` TETAP KUMULATIF sampai
akhir periode (bukan dibatasi rentang tanggal laporan), supaya
identitas tertutup `dititipkan = terjual + belumTerjual + rusak` tetap
berlaku — CEO menegaskan menyamakan periode (membatasi kelompok stok
ke startDate..endDate juga) akan MENGHILANGKAN barang lama yang
menumpuk dari laporan, padahal itu justru salah satu tujuan laporan
ini. Sebagai gantinya: `terjualPeriode` (dibatasi startDate..endDate
ketat, sudah dihitung `moneyCte` sejak awal tapi belum pernah
ditampilkan) sekarang punya kolom SENDIRI di layar dan ekspor Excel,
diposisikan TEPAT SEBELUM Total Penjualan di kelompok uang — supaya
tiap kelompok (stok kumulatif vs uang per periode) konsisten di
dalam dirinya sendiri, dan pembaca yang membaca satu baris utuh lewat
WhatsApp di HP tidak perlu memahami judul kolom kecil untuk tidak
salah baca (alasan eksplisit CEO menolak opsi "cukup ganti label
kolom" — itu taruhan pada orang membaca label, kalah di layar HP).
Judul kolom "Terjual" (kumulatif) dan "Terjual Periode Ini" (baru)
dibedakan dengan KATA, bukan tanda kurung kecil — kata persisnya
diusulkan Claude, keputusan final CEO (lihat komentar
`lib/i18n/id.ts`). Dibuktikan lewat test database sungguhan: pemilik
yang jual di periode LAMA (businessDate dipaksa mundur) dan periode
INI menghasilkan `terjualKumulatif` (2) berbeda dan lebih besar dari
`terjualPeriode` (1) untuk periode yang sama.

**LIMA SYARAT CEO, status masing-masing**:

1. **SNAPSHOT, BUKAN HITUNG ULANG** — `bagianPemilik`/`bagianToko`
   dijumlahkan dari `order_items.pemilikShareAmount`/`tokoShareAmount`
   tersimpan SAAT transaksi (kolom sudah ada sejak TT07/consignment-
   split), TIDAK PERNAH mengalikan ulang dengan `pemilik.persen_bagi`
   sekarang. **DIBUKTIKAN lewat database sungguhan**: test mengubah
   `persen_bagi` dari 60% jadi 90% SESUDAH transaksi tercatat, laporan
   bulan itu tetap `1.110.000` (60% lama), bukan `1.665.000` (90%
   baru) — `bagi-hasil-report.test.ts`.

   Ronde koreksi tambahan atas permintaan CEO: test serupa untuk sisi
   STOK, bukan cuma uang — barang yang laku SESUDAH `endDate` periode
   lama (fakta `terjualPada` yang baru terisi belakangan) tetap
   terhitung `belumTerjual` untuk laporan periode lama itu, TIDAK
   ikut `terjualKumulatif`, walau `status` barang di database SEKARANG
   sudah `'terjual'` sungguhan. Dibuktikan dengan barang
   `masukPada` tahun 2020, dijual via `sellBarangWithDb` sungguhan
   SETELAH laporan periode "kemarin" diambil, lalu laporan periode
   "kemarin" yang SAMA diambil ULANG dan angkanya harus identik —
   sejajar dengan uji snapshot persen_bagi di atas.

2. **"SUDAH DIBAYAR" BISA SEBAGIAN** — tabel baru `pemilik_payouts`
   (migration 0029): `pemilik_id`, `start_date`/`end_date` (identitas
   periode), `jumlah`, `tanggal_bayar`, `recorded_by_user_id`,
   `catatan`. APPEND-ONLY (tidak ada RLS policy UPDATE/DELETE, sama
   filosofi `stock_movements`) — koreksi jadi baris baru, bukan edit.
   "Sisa dibayar" (`lib/calc/bagi-hasil-payout.ts`,
   `calculateSisaDibayar`) = bagian pemilik dikurangi SEMUA baris
   pembayaran periode itu, sengaja TIDAK di-clamp ke nol supaya
   kelebihan bayar terlihat sebagai sisa negatif, bukan disembunyikan.
   Dibuktikan: 300.000 + 500.000 = 800.000, cocok contoh §7 persis.

3. **`dayCutoffTime` — PEMBLOKIR** — kolom baru
   `outlets.day_cutoff_confirmed` (boolean, default **false untuk
   SEMUA outlet** termasuk yang sudah ada, karena belum pernah ada
   manusia yang mengonfirmasi angka `04:00` bawaan). Direset otomatis
   ke `false` oleh `updateOutletWithDb` HANYA kalau `dayCutoffTime`
   benar-benar berubah NILAINYA (dibandingkan lewat `parseCutoffSeconds`,
   bukan string mentah — "04:00" vs "04:00:00" dianggap SAMA, tidak
   memicu reset palsu tiap simpan form). Nilai `04:00` bawaan **TIDAK
   DIUBAH/DITEBAK** — cuma mekanisme konfirmasinya yang dibangun.

   Halaman `/outlets` menampilkan kolom "Batas Hari" + badge
   terkonfirmasi/belum + tombol "Konfirmasi" (`confirmDayCutoffWithDb`).
   Laporan `/reports/bagi-hasil` TETAP BISA DILIHAT walau belum
   dikonfirmasi (banner peringatan tampil), TAPI ekspor Excel dan
   "Tandai sudah dibayar" DIKUNCI dengan pesan eksplisit.

   **Pembuktian gerbang, atas permintaan CEO — "kodenya ada" versus
   "terbukti hidup"**: awalnya seluruh logika ekspor (termasuk
   pengecekan `dayCutoffConfirmed`) ada LANGSUNG di dalam Route Handler
   (`app/api/reports/bagi-hasil/export/route.ts`), yang PALING SULIT
   diuji otomatis (butuh konteks request Next.js penuh) — celah nyata:
   jalur "Tandai sudah dibayar" sudah dites lewat database sungguhan,
   tapi jalur ekspor Excel BELUM SAMA SEKALI. Diperbaiki dengan
   memisah logikanya ke `lib/pemilik/bagi-hasil-export.ts`
   (`buildBagiHasilExport`, pola sama `*WithDb` lain di proyek ini)
   supaya Route Handler jadi pembungkus tipis, dan logika inti
   (termasuk gerbang) bisa dites lewat database sungguhan. Hasilnya
   (`bagi-hasil-export.test.ts`, SEMUA lewat database sungguhan, bukan
   mock):
   - Ekspor DITOLAK (`status: "locked"`) selama outlet belum
     dikonfirmasi, termasuk untuk outlet yang BARU SAJA dibuat (bukan
     cuma outlet lama yang kebetulan belum diklik).
   - SESUDAH `confirmDayCutoffWithDb` dipanggil sungguhan, ekspor
     berhasil menghasilkan file — dibuktikan BUKAN cuma "tidak
     melempar galat": byte pertama file dicek adalah tanda tangan ZIP
     (`PK`, karena `.xlsx` adalah arsip ZIP), lalu file itu DIBACA
     ULANG oleh ExcelJS (`Workbook.xlsx.load`) dan isinya diverifikasi
     (nama sheet, header kolom, nama pemilik muncul di baris) — bukti
     file yang dihasilkan benar-benar valid dibuka lagi, bukan byte
     acak yang kebetulan lolos.
   - "Tandai sudah dibayar" (`recordPemilikPayoutWithDb`,
     `payout-manage.test.ts`) sama: DITOLAK dengan pesan eksplisit
     ("belum dikonfirmasi") SELAMA belum dikonfirmasi, DIBUKTIKAN nol
     baris tersimpan ke database saat ditolak, lalu berhasil sesudah
     `confirmDayCutoffWithDb` dipanggil.

   **Kesimpulan jujur untuk CEO**: pagar syarat 3 TERBUKTI HIDUP lewat
   pemanggilan fungsi sungguhan ke database sungguhan (bukan mock, bukan
   cuma baca kode) untuk KEDUA jalur (ekspor Excel dan pencatatan
   pembayaran). Yang BELUM diverifikasi: klik tombol sungguhan di
   browser (Playwright) — gerbang sudah terbukti benar di lapisan
   logika/database, tapi belum dilihat langsung dari sisi pengguna.

4. **Pemilik nol penjualan TETAP TAMPIL** — LEFT JOIN dari `pemilik`
   (tabel dimensi), bukan dari transaksi. Dibuktikan: pemilik tanpa
   penjualan bulan ini tetap muncul dengan `Rp0`, `dititipkan`/
   `belumTerjual` tetap terhitung dari barang titipannya yang belum
   laku.

5. **EKSPOR EXCEL, satu sheet per periode, terkunci sampai syarat 3** —
   lihat poin 3 di atas.

**Verifikasi jujur — database sungguhan vs "kodenya ditulis" vs
browser sungguhan**:
- **Database sungguhan (integration test, DIVERIFIKASI)**: seluruh
  perhitungan uang dan stok TT10/TT11 (`bagi-hasil-report.test.ts`,
  `barang-report.test.ts`, `payout-manage.test.ts`,
  `bagi-hasil-export.test.ts`, plus 4 test baru `dayCutoffConfirmed`
  di `outlets/manage.test.ts`) — semuanya lewat `sellBarangWithDb`/
  akun Supabase Auth sungguhan, bukan insert baris manual yang
  mengarang angka.
- **`npx tsc --noEmit` dan `npm run lint`**: bersih, nol galat, nol
  peringatan, atas SELURUH proyek (bukan cuma file baru).
- **Lapisan UI (`/reports/stock`, `/reports/bagi-hasil`, dialog "Tandai
  sudah dibayar", unduhan `.xlsx` dari tautan ekspor) DIVERIFIKASI
  MANUAL OLEH CEO LANGSUNG DI BROWSER** (12 September 2026) — bukan
  Playwright/skrip otomatis. Keputusan CEO eksplisit: proyek ini
  konsisten lebih percaya verifikasi tangan manusia untuk lapisan UI
  daripada menambah dependency skrip browser baru, sama disiplin yang
  sudah dipakai TT05 (uji pindai barcode fisik, §16) — bukan celah yang
  belum ditutup, ini pilihan metode verifikasi yang disengaja.
  Perhitungan uang/stok di baliknya tetap diverifikasi otomatis lewat
  database sungguhan (baris di atas) — tangan manusia memverifikasi
  APA YANG TAMPIL, database sungguhan memverifikasi APA YANG BENAR.

### Koreksi CEO — pagar SYARAT 3 cuma memagari SATU dari DUA nilai (12 September 2026)

CEO menemukan lubang di verifikasi "pagar syarat 3 terbukti hidup" di
atas: batas periode laporan bagi hasil ditentukan **DUA** nilai
bersama — `dayCutoffTime` outlet DAN zona waktu (`businesses.timezone`)
tempat jam itu dibaca. Kode HANYA memagari nilai pertama (tombol
"Konfirmasi" di `/outlets` cuma soal jam). Kalau `businesses.timezone`
bukan WIB, "04:00" jatuh di momen UTC yang berbeda — CEO bisa
mengklik "Konfirmasi 04:00", merasa yakin, padahal angkanya tetap bisa
bergeser karena separuh syaratnya tidak pernah diperlihatkan ataupun
dipagari. **Pagar yang memberi rasa aman palsu lebih buruk daripada
tidak ada pagar** — kutipan CEO, dicatat karena ini prinsip yang
berlaku di luar TT11 juga.

**(a) Nilai sungguhan, dicek langsung, bukan ditebak**: SEMUA
`businesses.timezone` di database dev saat ini (termasuk bisnis nyata
`[DEV] Demo Cafe` dan sisa data uji) bernilai `Asia/Jakarta`. Jadi nilai
`04:00` yang sudah dikonfirmasi selama ini KEBETULAN benar (WIB), tapi
itu bukan karena kode memaksanya benar.

**(b) Zona waktu sekarang WAJIB tampil bersama cutoff** — kepala
laporan `/reports/bagi-hasil` (`bagi-hasil-view.tsx`, string
`strings.bagiHasil.cutoffInfo`) dan kepala sheet ekspor Excel
(`bagi-hasil-export.ts`, baris pertama sheet, SEBELUM baris label
kolom) sekarang sama-sama menampilkan `"Batas hari outlet ini: 04:00
WIB"`, bukan `"04:00"` sendirian. Singkatan WIB/WITA/WIT dipetakan dari
IANA timezone lewat `formatTimezoneAbbreviation()` baru
(`lib/utils/business-date.ts`) — HANYA untuk tiga zona resmi Indonesia
(standar negara, bukan tabel yang bisa berkembang bebas); zona di luar
itu ditampilkan apa adanya (nama IANA), tidak pernah menebak singkatan.

**(c) Nama parameter diperbaiki** — `getBagiHasilLaporan` dan
`buildBagiHasilExport` sebelumnya menerima parameter bernama
`outletTimezone` padahal sumbernya SELALU `businesses.timezone` (outlet
tidak punya kolom zona waktu sendiri di skema ini sama sekali) — nama
itu berbohong soal levelnya. Diganti jadi `businessTimezone` di seluruh
pemanggil.

**(d) Reset otomatis kalau `businesses.timezone` berubah** — dibangun
`updateBusinessTimezoneWithDb()` (`lib/businesses/manage.ts`, baru),
pola PERSIS sama dengan reset `dayCutoffConfirmed` yang sudah ada untuk
perubahan `dayCutoffTime` (`updateOutletWithDb`): kalau nilai timezone
berubah, `dayCutoffConfirmed` DIRESET ke `false` untuk **SEMUA** outlet
bisnis itu sekaligus (bukan cuma satu) — karena timezone properti
bisnis, mempengaruhi perhitungan cutoff setiap outletnya bersamaan.
Nilai yang sama (dibandingkan langsung, bukan dinormalisasi lebih
jauh) TIDAK memicu reset. Timezone yang bukan IANA valid (dicek lewat
`Intl.DateTimeFormat`) ditolak.

**Catatan jujur — fungsi ini BELUM punya pemanggil UI apa pun.** Tidak
ada halaman pengaturan bisnis di proyek ini sekarang yang bisa mengubah
`businesses.timezone` — nilainya cuma pernah diisi sekali saat bisnis
dibuat. `updateBusinessTimezoneWithDb()` dibangun sebagai mekanisme
aman yang SUDAH SIAP dipakai kapan pun jalur pengubahannya dibangun
(halaman pengaturan, atau skrip admin) — supaya jalur itu, kapan pun
dibangun, tidak bisa lupa mereset konfirmasi. Ini BUKAN keputusan
membangun halaman pengaturan bisnis baru (di luar lingkup TT11), CEO
belum diminta menyetujui itu — sengaja berhenti di fungsi + test saja.

Diverifikasi (database sungguhan, `businesses/__tests__/manage.test.ts`,
3 test baru): zona waktu tidak valid ditolak tanpa mengubah apa pun;
nilai sama tidak mereset outlet mana pun; timezone yang benar-benar
berubah (Asia/Jakarta → Asia/Jayapura, WIB → WIT) mereset
`dayCutoffConfirmed` KEDUA outlet uji sekaligus (bukan cuma yang
sedang aktif). Total setelah koreksi ini: 43 file test, 322 test,
semua hijau; `tsc`/`lint`/`build` bersih.

## §18 · Keputusan final dayCutoffTime, dan pengaman database uji (12 September 2026)

### Keputusan final — batas hari (`dayCutoffTime`)

**KEPUTUSAN CEO, FINAL — bukan lagi asumsi yang menunggu konfirmasi:**

- **Penjualan ikut hari SHIFT-nya dibuka.** Transaksi pukul 02:30
  tanggal 1 Oktober masuk ke tanggal 30 September, karena shift yang
  sedang berjalan saat itu dibuka tanggal 30. Ini konsisten dengan
  cara `businessDate()` sudah bekerja (§CALC-SPEC bagian F) — bukan
  perubahan logika, cuma konfirmasi bahwa logika yang sudah ada memang
  yang dimaksud.
- **`dayCutoffTime` = 04:00 DIKONFIRMASI BENAR**, berlaku untuk Bestie
  Thrift MAUPUN outlet Indokopi yang tutup jam 03:00 — 04:00 ada SATU
  JAM SETELAH tutup, cukup menampung transaksi larut malam/dini hari
  tanpa memotong di tengah operasional.
- **CEO sendiri yang mengklik tombol "Konfirmasi" lewat UI** di halaman
  `/outlets` untuk menyalakan `dayCutoffConfirmed` pada outlet yang
  sudah ada. Agen (Claude Code) **TIDAK PERNAH** mengubah nilai
  `dayCutoffConfirmed` lewat skrip atau migrasi — itu akan meniadakan
  seluruh maksud SYARAT 3 TT11 (konfirmasi manusia, bukan kode yang
  mengasumsikan dirinya sendiri benar).

**Catatan penting untuk orang berikutnya — Indokopi akhir pekan:**
Indokopi buka 24 jam Sabtu–Minggu. Di hari-hari itu, `04:00` BUKAN
garis yang mengikuti jam tutup (karena tidak pernah tutup) — itu garis
yang **DIPILIH**, semata-mata supaya satu `dayCutoffTime` yang sama
berlaku konsisten sepanjang minggu. Ini bukan masalah dan tidak perlu
diperbaiki, tapi harus tertulis di sini supaya tidak ada yang nanti
mengira angka `04:00` di hari Sabtu/Minggu punya dasar operasional
(jam tutup) yang sebenarnya tidak ada pada hari-hari itu.

**Keputusan CEO, FINAL — batas bulan (13 September 2026), tidak
dibahas ulang:** penjualan dini hari yang melewati pergantian bulan
tetap ikut aturan `businessDate()`/`dayCutoffTime` yang sama (hari
SHIFT-nya dibuka, lihat di atas) — CEO menerima konsekuensinya untuk
laporan bulanan (bagi hasil, dll.): traffic di atas jam 12 malam
sangat sepi, selisihnya paling satu-dua transaksi per bulan, dan
uangnya tetap dibayarkan di periode mana pun transaksi itu akhirnya
tercatat. Tidak ada perubahan kode — dicatat di sini supaya tidak ada
yang nanti mengira ini celah yang perlu ditambal.

### Pengaman database uji — gagal-tertutup, bukan gagal-terbuka

Usulan pertama (baca ref database produksi dari `.env.production.local`
untuk dibandingkan) DITOLAK CEO: kalau file itu tidak ada (clone baru,
terhapus), pengaman diam-diam tidak berbuat apa-apa — persis pola
gagal-terbuka yang dilarang proyek ini. **Dibalik: IZINKAN HANYA yang
dikenal, TOLAK sisanya.**

`lib/db/guard-test-database.ts` (baru) — daftar ref project Supabase
dev yang diizinkan ditulis **eksplisit sebagai konstanta di kode**
(`ALLOWED_TEST_PROJECT_REFS`), bukan dibaca dari env/file mana pun yang
bisa hilang. Project ref bukan rahasia (muncul di URL publik
`https://<ref>.supabase.co`). Kalau `DATABASE_URL` tidak cocok daftar
itu, tidak bisa diurai sama sekali, atau kosong — **LEMPAR GALAT**
dengan pesan yang menyebut ref yang ditemukan vs yang diharapkan.
Jalan keluar sengaja untuk kasus sah: `ALLOW_TEST_DB_OVERRIDE=1`
eksplisit (bukan default, bukan truthy sembarangan — harus persis
string `"1"`), dicatat dengan peringatan di output, bukan diam-diam.

Dipasang di `vitest.setup.ts` (setupFiles), jalan SATU KALI sebelum
file test mana pun sempat mengimpor `lib/db/client.ts` dan membuka
koneksi — BUKAN di `getAdminDb()` sendiri, karena fungsi itu juga
jalur skrip yang SAH menyentuh produksi (`scripts/bootstrap-
production.ts`, `scripts/demo:*`); memagari di sana akan mematahkan
skrip yang justru harus bisa menyentuh produksi.

**Satu penyimpangan disengaja dari spesifikasi CEO, ditulis di sini
supaya bisa dikoreksi kalau salah tafsir**: pengaman GLOBAL (dipanggil
dari `vitest.setup.ts`) sengaja **TIDAK melempar** kalau `DATABASE_URL`
SAMA SEKALI TIDAK ADA (bukan ada-tapi-salah) — karena proyek ini sudah
lama punya pola `describe.skipIf(!hasEnv)` di SETIAP file test
integrasi, yang mensyaratkan `DATABASE_URL` (dan dua env lain) sebelum
test itu jalan sama sekali. Kalau `DATABASE_URL` benar-benar kosong,
TIDAK ADA test integrasi yang akan jalan dan TIDAK ADA koneksi yang
akan dibuka — jadi tidak ada risiko untuk dipagari, dan melempar di
sini cuma akan mematahkan `npm test` untuk siapa pun yang sengaja
menjalankan test unit saja tanpa kredensial Supabase (pola yang sudah
ada sebelum pengaman ini dibangun). Fungsi murninya sendiri
(`checkTestDatabaseAllowed`) TETAP menolak `DATABASE_URL` kosong sesuai
spesifikasi CEO persis — penyimpangan ini HANYA ada di pembungkus yang
dipanggil `vitest.setup.ts`, bukan di logika intinya.

Diverifikasi (unit test murni, `guard-test-database.test.ts`, 17 test,
tidak butuh koneksi apa pun jadi selalu jalan): ref yang diizinkan
(bentuk pooler dan koneksi langsung) lolos; ref lain mana pun ditolak
dengan pesan yang menyebut kedua ref; `DATABASE_URL` kosong/rusak
ditolak di level fungsi murni; override `"1"` lolos dengan peringatan
walau ref tidak dikenal, TAPI nilai selain `"1"` persis (mis. `"true"`)
tetap ditolak; wrapper global tidak melempar untuk `DATABASE_URL` yang
sama sekali tidak ada (penyimpangan di atas), TAPI tetap melempar untuk
yang ada-tapi-salah. Dijalankan juga sebagai bagian full test suite
sungguhan (43 file, terhitung dengan file baru ini) -- pengaman lolos
diam-diam terhadap `DATABASE_URL` dev yang sungguhan dipakai proyek
ini, membuktikan wiring-nya sungguhan bekerja, bukan cuma lolos di
unit test terisolasi.

## §19 · Pertahanan berlapis: barcode gagal-encode tidak lagi diam-diam (13 September 2026)

Saat investigasi kelayakan TT13 (impor data lama Bestie Thrift dengan
kode barang dipertahankan apa adanya — **TT13 sendiri DIBATALKAN**,
lihat di bawah), ditemukan `components/barcode/barcode-canvas.tsx`
menangkap galat `encodeCode128B()` (kode di luar ASCII 32-126) lalu
membiarkan kanvas kosong TANPA pesan apa pun — label tercetak KOSONG,
baru ketahuan setelah barang ditempeli label itu dan dijual (tidak
bisa dipindai). Kelas kegagalan sama dengan 29 titik silent-failure
yang sudah disisir (CLAUDE.md §3.7), belum kena sisir sebelumnya
karena jalur ini dianggap tidak mungkin terjadi.

**CATATAN JUJUR — ini pertahanan berlapis, BUKAN perbaikan bug yang
sedang aktif hari ini.** Kode barang SELALU digenerate sistem
(`lib/barang/kode.ts`, alfabet aman: huruf besar+angka tanpa 0/O/1/I)
dan `outlets.code` dipaksa pola `^[A-Z0-9]+$` (Zod + CHECK constraint,
§16). Jadi setiap kode yang bisa terbentuk lewat aplikasi hari ini
DIJAMIN ASCII 32-126 — `encodeCode128B()` tidak akan pernah melempar
lewat jalur manapun yang ada sekarang. Satu-satunya jalan masuk kode
tak-encodable adalah impor dari sistem lain, dan **TT13 (impor data
lama) DIBATALKAN** oleh CEO. Diperbaiki karena sudah ditemukan dan
sudah terlanjur 80% dikerjakan saat pembatalan itu datang — dipasang
supaya jalur impor apa pun di masa depan tidak bisa menghasilkan label
kosong tanpa suara, bukan karena ada insiden sungguhan hari ini.

**Perbaikan**:
- `BarcodeCanvas` menerima `onEncodeError?: (message) => void` --
  dipanggil lewat `useEffect` (bukan langsung di badan komponen, supaya
  tidak melanggar aturan "render harus murni"). Saat encode gagal,
  kanvas diganti kotak pesan `"Barcode tidak bisa dibuat: [alasan]"` --
  SENGAJA tetap di dalam `#label-print-area` (area yang ikut tercetak),
  supaya kalau seseorang tetap memicu cetak lewat jalur lain (Ctrl+P)
  walau tombol kita terkunci, kertas yang keluar membawa pesan galat,
  bukan kosong tanpa penjelasan.
- `LabelPrintArea` (komponen client baru, `components/barang/`)
  menyatukan `LabelView` + tombol cetak + pesan galat dalam satu
  tempat yang menahan state — dipakai KEDUA halaman cetak
  (`barang/[id]/label` dashboard dan `pos/thrift/label/[id]` kasir),
  menggantikan pemanggilan `LabelView`+`PrintButton` langsung. Tombol
  cetak DIKUNCI (`disabled`) selama ada galat encode.
- Logika encode+tangkap-galat dipisah jadi `resolveBarcodeModules()`
  (diekspor dari `barcode-canvas.tsx`) supaya testable TANPA render
  React sungguhan -- proyek ini tidak punya `@testing-library/react`/
  jsdom (vitest environment `'node'` murni), jadi test yang ditulis
  menguji fungsi logika ini langsung (3 test: data valid, karakter di
  luar jangkauan, data kosong), BUKAN test render DOM/tombol terkunci.
  Dicatat jujur sebagai batas cakupan test, bukan diklaim sudah diuji
  sampai lapisan komponen.

**TT13 ditutup, dibatalkan CEO**: premis TT13 (kode barang lama bisa
membawa karakter yang tidak Code128-encodable, ditemukan hanya saat
impor) TIDAK BISA TERCAPAI karena kode SELALU digenerate sistem dari
alfabet aman -- satu-satunya jalan masuk (impor data lama) sudah
dibatalkan sebelum dibangun apa pun. Investigasi kelayakan (constraint
`barang.kode`, ruang tabrakan `generateBarangKode()`, status foto
nullable, tiga drift spec-vs-implementasi: `catatan` tidak ada di
skema, status `disimpan` tidak ada di kode, `kategori_id` "wajib" di
spec tapi nullable di skema) tidak menghasilkan kode apa pun -- cuma
laporan lisan ke CEO, tidak diarsipkan di sini karena TT13 tidak
dilanjutkan.

## §20 · Tiga prasyarat shift (§14, disetujui CEO, dikerjakan 13 September 2026)

Penghalang peluncuran (TT14, Ita mulai pakai sungguhan): toko buka
sampai 18 jam dengan akun tamu, shift yang tertinggal terbuka semalam
berisiko merusak atribusi transaksi hari berikutnya.

**Temuan investigasi dulu, sebelum kode ditulis** (CEO awalnya menduga
laporan bagi hasil ikut rusak -- salah, dan CEO sendiri yang
mengoreksi setelah saya tunjukkan jejaknya): `businessDate` transaksi
dihitung ULANG dari jam sungguhan setiap `sellBarangWithDb`/
`payOrderWithDb` dipanggil (`business_date()`, bukan diwariskan dari
`shifts.business_date`) -- laporan bagi hasil dan laporan stok
AMAN, keduanya memfilter murni lewat `orders.businessDate`/
`barang.masukPada`/`terjualPada`, tidak pernah menyentuh `shiftId`.
**Yang sungguhan rusak**: `orders.shiftId`/`cashierId` diwariskan dari
shift mana pun yang sedang `status='open'` untuk device itu, tidak
peduli sudah berapa lama dibuka -- `getSalesByCashier` jadi salah
atribusi (penjualan besok atas nama shift semalam), dan rekonsiliasi
kas shift itu mencampur uang lebih dari satu hari kerja jadi satu
angka yang mustahil diverifikasi.

**Query pengecekan sebelum memasang aturan baru** (13 September
2026): 3 baris `shifts.status='open'` di database dev, 2 di antaranya
data sungguhan basi (Indosteak Pekansari ~28 hari, Bestie Thrift ~2
hari, KEDUANYA cashless) dan 1 sisa data uji. **Tidak perlu skrip
pembersihan** -- keduanya cashless, tidak ada uang tersangkut, dan
begitu aturan poin 1 di bawah dipasang keduanya otomatis jadi
"tidak sellable" tanpa perlu disentuh manual, menunggu ditutup lewat
fitur poin 2/3.

### 1 · Penutupan otomatis — DIPUTUSKAN BUKAN CRON, diblokir di titik pemakaian

CEO menolak usulan cron (rancangan pertama): "masalahnya bukan shift
basi masih terbuka, masalahnya shift basi masih BISA BERJUALAN."
Nol infrastruktur baru dibangun -- cron ditunda, cuma kerapian nanti
kalau memang terasa perlu.

`checkShiftSellability()` (`lib/pos/shift.ts`, baru) menambah SATU
pengecekan ke `isShiftSellable()`: `shifts.businessDate` harus SAMA
dengan `businessDate(sekarang, businessTimezone, outlet.dayCutoffTime)`
-- kalau tidak, shift dianggap basi (`"stale"`), ditolak di SERVER
(`sellBarangWithDb`/`payOrderWithDb`), bukan cuma gate halaman.
`openShiftWithDb()` sebaliknya: shift basi TIDAK menghalangi shift
baru dibuka di device yang sama (justru itu jalan keluarnya) --
shift basi tetap `status='open'` apa adanya, menunggu ditutup lewat
poin 2 di bawah. Ambang waktunya `outlet.dayCutoffTime`, kolom
setting yang sudah ada, nol angka mati baru.

Diverifikasi database sungguhan (`shift.test.ts`): shift basi ditolak
jualan dengan pesan eksplisit ("shift kemarin belum ditutup"), shift
baru tetap bisa dibuka di device yang sama, shift lama tidak disentuh.

### 2 · Manajer menutup shift orang lain

Izin `shift.reconcile` (owner/manajer/akuntan) — SUDAH ADA di matriks
RBAC sejak awal, tidak pernah dipasang ke mana pun sebelum ini,
dipakai apa adanya (bukan izin baru). Beda dari `shift.open_close`
(kasir, shift milik sendiri).

`forceCloseShiftWithDb()` (baru): menutup shift ORANG LAIN, alasan
WAJIB, dicatat ke `audit_logs` (`action: "shift_force_closed"`, siapa
menutup [`profiles.id` manajer, di `metadata` -- bukan FK
`employees.id` yang tidak cocok identitasnya], shift siapa yang
ditutup, kapan, kenapa). Kas TIDAK PERNAH dihitung di titik ini,
bahkan untuk outlet bertunai -- manajer yang menutup dari jauh belum
tentu tahu isi laci kasnya. Kolom baru `shifts.forceClosedAt`
(migration 0030) memakai status `'reconciled'` yang SUDAH ADA di enum
sejak awal tapi dormant (tidak pernah ditulis kode mana pun sebelum
ini) -- outlet cashless langsung `'closed'` selesai (tidak ada apa pun
untuk direkonsiliasi), outlet bertunai `'closed'`+`forceClosedAt`
terisi = "perlu ditinjau" sampai `reconcileForceClosedShiftWithDb()`
(kas dalam toleransi -> langsung `'reconciled'`) atau
`confirmForceClosedReconciliationWithDb()` (di luar toleransi, alasan
tambahan wajib -- pola dua-langkah SAMA PERSIS alur tutup shift normal)
memindahkannya ke `'reconciled'`.

Layar baru di dashboard home (`ShiftsNeedingReview`, digerbang lewat
Server Action `shift.reconcile`) menampilkan DUA kategori: shift basi
("Tutup Paksa") dan shift force-closed menunggu kas ("Hitung Kas &
Selesaikan") -- `getShiftsNeedingReview()` menghitung staleness PER
OUTLET (dayCutoffTime beda-beda) di JavaScript sesudah query, bukan
di SQL, karena jumlah shift open per bisnis kecil.

Diverifikasi database sungguhan (7 test baru): force-close outlet
bertunai vs cashless, ditolak untuk shift sudah closed, reconcile
dalam/luar toleransi, write-once reconcile, ditolak untuk shift yang
bukan hasil force-close, isi `getShiftsNeedingReview()` benar untuk
kedua kategori.

### 3 · Layar "buka shift dulu"

Temuan: kode YANG SUDAH ADA sebelum ronde ini SUDAH redirect ke
`/pos/shift/open` (bukan halaman kosong) dan halaman itu SUDAH punya
judul+hint+form -- laporan awal saya soal ini keliru, CEO
mengoreksi. Yang BELUM tertangani: shift TERBUKA TAPI BASI dulu lolos
begitu saja (`status='open'` saja cukup lolos gate lama) -- perbaikan
poin 1 menutup celah itu. `/pos/shift/open` sekarang membedakan
alasan: shift basi menampilkan `strings.shift.staleShiftHint`
("Shift kemarin belum ditutup...") alih-alih hint pembuka biasa,
BUKAN diarahkan ke `/pos/shift/close` (itu untuk shift MILIK SENDIRI
yang sedang mid-close, shift basi belum tentu milik orang yang
berdiri di depan perangkat sekarang). Diterapkan konsisten di KEDUA
`/pos` dan `/pos/thrift` (plus halaman cetak label & Statistik Ita
yang memakai gate sama).

### 4 · Indokopi buka 24 jam Sabtu-Minggu — SELESAI (keputusan final CEO, dibangun 13 September 2026)

CEO menunjukkan celah yang saya lewatkan total di rancangan pertama:
outlet yang tidak pernah tutup akan mengalami blokir poin 1 tepat di
tengah transaksi jam 04:00. Tiga usulan diajukan, KETIGANYA diputuskan
CEO dan dibangun persis seperti diputuskan:

**(a) Peringatan sebelum cutoff** — kolom setting BARU
`outlets.shift_warning_minutes` (migration 0031, bawaan 30 menit
untuk semua outlet), BUKAN angka mati. `nextCutoffInstant()`
(`lib/utils/business-date.ts`, baru) menghitung instant UTC persis
kapan hari bisnis SEKARANG berakhir — dari `businessDate(now)` = X,
cutoff yang mengakhirinya selalu jatuh di kalender X+1 jam
`dayCutoffTime` (businessDate() sendiri mundur satu hari kalender
kalau jam lokal < cutoff). `ShiftCutoverBar` (client, baru) membanding
jam klien terhadap instant tetap ini tiap 30 detik, muncul non-blocking
di `/pos` dan `/pos/thrift` sekali masuk jendela peringatan — transaksi
yang sedang jalan tidak terganggu sama sekali.

**(b) Alur gabungan satu langkah** — `closeAndReopenShiftWithDb()`
(baru): tutup shift LAMA + buka shift BARU dalam SATU transaksi DB
atomik (tidak pernah ada keadaan "lama tertutup, baru gagal dibuka").
UI-nya satu dialog (`ShiftCutoverBar`), bukan dua layar terpisah.

**(c) SATU hitungan kas, DUA arti** — **koreksi tegas CEO** atas
usulan awal saya (satu angka jadi penutup DAN pembuka sekaligus secara
membabi buta): "kalau satu angka jadi penutup shift lama SEKALIGUS
saldo awal shift baru, selisih kas hilang sepenuhnya — sistem
menganggap angka itu benar menurut definisi, shift lama SELALU pas.
Satu angka tidak bisa jadi pengukur dan yang diukur sekaligus." Yang
dibangun: penjaga menghitung SEKALI (`countedCash`), angka itu dipakai
DUA KALI dengan ARTI BERBEDA — (1) dibandingkan dengan `expectedCash`
shift LAMA, selisih dihitung & DICATAT SEPERTI BIASA (termasuk alasan
wajib kalau di luar toleransi); BARU KEMUDIAN (2) disalin APA ADANYA
jadi `openingCash` shift BARU (bukan dihitung ulang, bukan angka
baru). Selisih di luar toleransi TETAP BOLEH LANJUT (pembeli menunggu,
toko 24 jam) — beda dari alur tutup shift normal yang menahan status
sampai dikonfirmasi terpisah, TIDAK PERNAH memblokir penjualan karena
urusan rekonsiliasi di sini; cukup isi alasan di form yang sama.
Kalau selisih di luar toleransi dan alasan belum diisi,
`closeAndReopenShiftWithDb()` mengembalikan pratinjau (`needsReason`)
TANPA menulis apa pun ke DB — dialog client menampilkan selisihnya,
minta alasan, submit ulang form yang sama (bukan navigasi ke layar
lain). Outlet CASHLESS melewati seluruh langkah kas ini.

Diverifikasi database sungguhan (6 test baru, termasuk yang WAJIB
diminta CEO — "kalau selisih selalu nol di test, berarti tidak ada
yang diuji"): selisih KECIL dalam toleransi (+5.000) tetap tercatat
apa adanya di shift lama SEKALIGUS jadi openingCash shift baru;
selisih BESAR di luar toleransi (-50.000) tanpa alasan menghasilkan
pratinjau tanpa tulis apa pun; selisih besar yang sama DENGAN alasan
tetap lanjut (shift baru tetap terbuka, bukan diblokir); PIN salah
gagal SEBELUM shift lama disentuh sama sekali; outlet cashless
melewati seluruh langkah kas.

**Kesalahan yang ditangkap sendiri lewat full test suite** (bukan oleh
CEO): draf pertama `shiftWarningMinutes` di skema Zod
`lib/outlets/manage.ts` WAJIB tanpa nilai bawaan -- mematahkan 8 test
di 4 file lain yang memanggil `createOutletWithDb()` tanpa tahu field
baru ini ada sama sekali. Diperbaiki dengan `.default(30)` (sama
dengan bawaan kolom DB), pola yang SAMA dengan `isCentralKitchen`/
`cashEnabled` di skema yang sama -- field baru pada fungsi yang sudah
dipakai banyak tempat harus punya nilai bawaan yang masuk akal, bukan
wajib diisi pemanggil lama yang tidak tahu field itu ada.

## §21 · Pembatasan akses per outlet — Tahap 0: kelola membership (13 September 2026)

Tiga prasyarat §14 tuntas (bagian di atas) membuka pekerjaan lebih
besar: **pembatasan akses per outlet**. Aturan yang sudah diputuskan
CEO sebelum satu baris pun ditulis (rangkuman, bukan verbatim):

- **Shift mempersempit, tidak pernah memberi.** Batas otorisasi tetap
  di `memberships.outlet_ids` + RLS; shift aktif cuma MENYARING dari
  yang sudah diizinkan. Alasannya kebingungan operasional (kasir
  salah pilih outlet), BUKAN keamanan — tapi CEO menegaskan itu cuma
  menjelaskan KENAPA lingkupnya dipersempit, bukan SEBERAPA KERAS
  ditegakkan: penegakan tetap harus dobel, aplikasi DAN database,
  sama seperti laporan akuntansi yang rahasia lewat RLS bukan lewat
  menyembunyikan tombol.
- **RLS ditambah SATU TABEL PER SATU TABEL** lewat fungsi baru
  `auth_outlet_ids()` (belum dibangun — menyusul Tahap 5), bukan
  mengubah `auth_business_ids()` yang sudah ada. Urutan tabel: orders
  → shifts → barang, dilaporkan di antara tiap tabel.
- **Owner dan akuntan tidak pernah dipersempit** — `allowedOutletIds`
  dipaksa `null` untuk kedua role ini di SATU tempat (fondasi Tahap 1),
  terlepas dari isi kolom `outlet_ids` mereka.
- **Halaman kelola membership adalah TAHAP 0, wajib lebih dulu dari
  apa pun** — investigasi menemukan tidak ada satu pun halaman
  dashboard yang mengelola tabel `memberships` (baris cuma pernah
  ditulis lewat skrip CLI). Tanpa halaman ini, siapa pun yang
  terkunci gara-gara `outlet_ids` cuma bisa diselamatkan lewat SQL
  langsung — persis ketergantungan yang jadi alasan sistem laporan
  ini dibangun sejak awal.

Urutan akhir yang diputuskan CEO: **Tahap 0** (halaman kelola
membership, dikerjakan sekarang) → Tahap 1 (fondasi `allowedOutletIds`,
aditif) → Tahap 2 (utilitas filter + assert) → Tahap 3 (halaman
baca-saja) → Tahap 4 (halaman tulis, termasuk kasus khusus
`stock_transfers` yang pakai `fromOutletId` ATAU `toOutletId`) →
Tahap 5 (RLS `orders` → `shifts` → `barang`, satu per satu) → Tahap 6
(sambungan shift-membership: `employees.userId` yang tertaut membership
dibatasi menolak buka shift di outlet di luar `outlet_ids`).

### Tahap 0 — dibangun dan diverifikasi

**Migrasi 0032** (`schema.ts`, aditif, tidak menyentuh
`auth_business_ids()`): tiga policy RLS baru —
`profiles_select_business_owner` (owner bisa lihat profil anggota
LAIN di bisnisnya; `profiles_select_own` sebelumnya cuma izinkan
lihat diri sendiri, jadi halaman tim tidak mungkin menampilkan nama
orang lain tanpa ini), `memberships_insert` dan `memberships_update`
(baru pertama kali ada — sebelumnya `memberships` cuma punya policy
SELECT, baris cuma pernah ditulis lewat skrip admin). Ketiganya
mensyaratkan pemanggil adalah owner AKTIF di bisnis yang sama —
jaring kedua di luar app layer, dibuktikan lewat tes RLS murni (lihat
bawah), bukan cuma diasumsikan.

**`membership.manage`** (`lib/auth/permissions.ts`) — permission key
baru, OWNER-ONLY (`na` untuk semua role lain, tidak bisa
di-override lewat `permissions_override`).

**`lib/memberships/manage.ts`** + **`lib/memberships/roles.ts`** +
halaman **`/team`**: `listMembershipsWithDb`, `inviteMembershipWithDb`,
`updateMembershipWithDb`. `assignableMembershipRoles` sengaja TIDAK
memuat `owner`/`accountant` — ditolak di skema zod, tidak pernah
sampai ke database.

**Dua pengaman ditambahkan TANPA diminta eksplisit dalam permintaan
awal, PERTAHANKAN keduanya (dikonfirmasi CEO)**:
1. Owner tidak bisa mengubah barisnya sendiri lewat halaman ini —
   mencegah kunci-diri-sendiri (menonaktifkan diri, atau menurunkan
   role sendiri kalau `assignableMembershipRoles` suatu saat berubah).
2. **Baris yang SUDAH berrole owner/accountant tidak bisa DIUBAH sama
   sekali lewat halaman ini** — bukan cuma dilarang MENJADI
   owner/accountant (permintaan asli CEO), tapi juga dilarang
   diturunkan DARI owner/accountant. Alasan: tanpa ini, satu owner
   bisa menurunkan owner lain jadi kasir lewat halaman yang sama.
   **Konsekuensi yang harus diingat**: satu-satunya cara mengubah role
   atau menonaktifkan baris owner/accountant adalah lewat skrip CLI
   (`scripts/bootstrap-production.ts`/`reset-owner.ts` atau SQL
   langsung) — TIDAK ADA tombol di dashboard untuk ini, sengaja.
   Jangan habiskan waktu mencarinya di UI.

**Mekanisme undangan** — `admin.generateLink(type:"invite")`, BUKAN
`inviteUserByEmail()` (bergantung SMTP yang belum tentu terkonfigurasi
untuk bisnis ini, gagal diam-diam kalau tidak) atau `createUser()`
dengan password (harus ditampilkan sekali, masalah yang sama yang
dihindari `bootstrap-production.ts` untuk password owner). Tautan
hasil `generateLink` ditampilkan SEKALI di dialog untuk owner salin
dan kirim sendiri (WhatsApp/email) — **tidak pernah ditulis ke
`audit_logs`** (itu bearer token, menyimpannya sama saja menyimpan
kredensial). Audit log tetap mencatat BAHWA undangan dibuat: siapa
mengundang siapa dan kapan (`action: "membership_invited"`,
`metadata.actorUserId`/`targetEmail`/`inviteLinkGenerated`), tanpa
tautannya. Dialog menampilkan waktu tautan dibuat + peringatan "kirim
segera, biasanya berlaku 24 jam (default Supabase, project ini bisa
beda)" — Supabase TIDAK mengembalikan waktu kedaluwarsa lewat API
`generateLink` sama sekali (dicek langsung ke tipe
`GenerateLinkProperties`), jadi UI sengaja tidak mengklaim angka pasti
yang bisa salah untuk project ini.

**Penjaga `listUsers({perPage:1000})`** (satu-satunya sumber email,
`profiles` tidak punya kolom email) — cukup untuk 26 orang saat ini,
tapi `listMembershipsWithDb` sekarang membandingkan `data.total`
(dikembalikan Supabase) terhadap `data.users.length` untuk mendeteksi
truncation dengan benar (bukan cuma `length === perPage`, yang salah
kalau totalnya PERSIS 1000), dan halaman `/team` menampilkan
peringatan eksplisit kalau batas ini mendekati/terlampaui — bukan
gagal senyap.

**Diverifikasi** — 15 tes baru (`lib/memberships/__tests__/manage.test.ts`)
lewat db RLS asli (bukan admin bypass), dua kelas: (1) aturan bisnis
lewat db owner — role owner/accountant ditolak, outlet asing ditolak,
array outlet kosong ditolak, undang ulang email yang sama mengaktifkan
baris LAMA, self-edit ditolak, baris accountant tidak bisa diubah,
audit log berisi actor/target/waktu TANPA tautan undangan; (2) RLS
MURNI dari sudut manajer (bukan owner) yang menulis LANGSUNG ke tabel
`memberships`/`profiles` TANPA lewat `manage.ts` sama sekali — database
menolak insert/update, manajer tidak bisa melihat profil owner. Full
suite: 46 file, 381 tes hijau. Build + lint + typecheck bersih.

Menunggu keputusan CEO untuk lanjut ke Tahap 1.

### Tahap 0 — tiga koreksi CEO, semua diterapkan

CEO menyetujui rancangan dengan tiga tambahan:
1. **Tautan undangan**: tampilkan waktu dibuat + peringatan "biasanya
   berlaku 24 jam (default Supabase)" di dialog -- supaya owner yang
   menyalin ke WhatsApp tahu ada batas waktu, bukan kaget saat anggota
   baru klik dan gagal tanpa penjelasan. Audit log mencatat bahwa
   undangan dibuat (`inviteLinkGenerated: true`, siapa->siapa, kapan)
   TANPA tautannya sendiri.
2. **Dua pengaman tanpa diminta eksplisit (self-edit block, baris
   owner/accountant tidak bisa diubah sama sekali)**: DIPERTAHANKAN
   keduanya, dikonfirmasi CEO — poin kedua "lebih kuat dari yang saya
   minta dan itu benar... tanpa itu satu owner bisa menurunkan owner
   lain jadi kasir." Konsekuensinya sudah dicatat di bagian di atas:
   satu-satunya cara mengubah baris owner/accountant adalah lewat
   skrip CLI.
3. **Penjaga `listUsers` mentok 1000**: `listMembershipsWithDb`
   sekarang mengembalikan `emailListTruncated` (dari `data.total` vs
   `data.users.length`, BUKAN cuma `length === perPage`), halaman
   `/team` menampilkan peringatan eksplisit kalau ini terjadi — cukup
   untuk 26 orang saat ini, tapi tidak gagal senyap kalau berubah.

## §22 · Pembatasan akses per outlet — Tahap 1: fondasi `allowedOutletIds` (13 September 2026)

Murni aditif, sesuai instruksi CEO ("jangan pasang ke halaman mana
pun dulu") — TIDAK ADA halaman atau Server Action yang menyaring apa
pun berdasarkan ini. Cuma menyediakan datanya.

**`lib/auth/outlet-scope.ts`** (baru) — `computeAllowedOutletIds(role,
outletIds)`: `UNRESTRICTED_OUTLET_ROLES = ["owner", "accountant"]`
dipaksa `null` DI KODE, apa pun isi `outlet_ids` mereka di database
(pertahanan berlapis — kalau nanti seseorang tidak sengaja mengisi
`outlet_ids` untuk akun owner/akuntan lewat `/team`, laporan lintas
outlet mereka TIDAK diam-diam menyusut). Peran lain meneruskan
`outlet_ids` apa adanya (`null` = semua outlet, array = dipersempit).
Fungsi murni, dites tanpa DB sama sekali.

**`CurrentBusiness`** (`lib/auth/session.ts`) dan **`PermissionContext`**
(`lib/auth/permissions.ts`) — field baru `allowedOutletIds: string[] |
null`, dihitung di `getCurrentBusinessFromClient()` (sekarang ikut
`select` kolom `outlet_ids`) dan diteruskan lewat `requirePermission`/
`requirePermissionDb`. Ini SATU-SATUNYA titik penghitungan — setiap
halaman/Server Action yang nanti memakainya (Tahap 3+) otomatis
konsisten, tidak ada jalan lupa menerapkan pengecualian owner/akuntan
di satu halaman tapi lupa di halaman lain.

**Kenapa aman ditambahkan tanpa memecah apa pun**: `PermissionContext`
dan `CurrentBusiness` cuma dapat field BARU (bukan field yang diubah/
dihapus) — setiap pemanggil lama yang destructure field lama saja
(`{ db, closeDb, businessId, role }` dst., dipakai di ~15 Server
Action) tetap jalan tanpa perubahan, field baru cuma diam kalau tidak
dipakai.

**Diverifikasi**: `lib/auth/__tests__/outlet-scope.test.ts` (8 tes) —
`computeAllowedOutletIds` dites murni per kombinasi role x outlet_ids
(termasuk owner/akuntan dengan `outlet_ids` array DIPAKSA tetap null),
plus satu tes end-to-end lewat sesi Supabase Auth sungguhan (owner yang
`outlet_ids`-nya dipaksa berisi array langsung di database — skenario
data rusak/diedit manual — tetap dapat `allowedOutletIds` null lewat
`getCurrentBusinessFromClient()`). Full suite: **47 file, 389 tes
hijau**. Build + lint + typecheck bersih.

Menunggu keputusan CEO untuk lanjut ke Tahap 2 (utilitas filter +
assert, masih belum dipasang ke halaman mana pun).

## §23 · Pembatasan akses per outlet — Tahap 2: utilitas filter + assert (13 September 2026)

### Pelajaran paling berharga dari Tahap 2 — bukan fiturnya (kata CEO, dan benar)

Draf pertama `lib/auth/__tests__/outlet-filter.test.ts` menulis:

```ts
.where(eq(stockTransfers.businessId, businessId) && outletScopeConditionForTransfer(...))
```

`&&` di sini operator JAVASCRIPT, bukan `and()` drizzle-orm. Kedua sisi
adalah OBJEK SQL — dan objek, apa pun isinya, SELALU truthy di
JavaScript. `&&` mengevaluasi operand kiri (truthy), lalu **langsung
mengembalikan operand KANAN begitu saja** — operand kiri dibuang,
bukan digabung. Efeknya: filter `business_id` hilang TOTAL dari query,
tanpa error, tanpa warning, tanpa baris merah di mana pun. Query tetap
valid secara SQL, tetap jalan, tetap mengembalikan hasil — cuma
hasilnya salah: **data lintas BISNIS**, bukan cuma lintas outlet.
Kalau ini lolos ke kode produksi, business A bisa melihat baris milik
business B, jenis kebocoran paling parah yang proyek ini punya (lebih
parah dari kebocoran lintas-outlet yang Tahap 2 ini dibangun untuk
dicegah — itu baru lintas TENANT).

Ini ditulis SENDIRI, di ronde yang secara eksplisit dibangun untuk
mencegah persis kelas bug ini ("null dibaca kosong, kosong dibaca
null, filter yang diam-diam tidak ikut"). Ditemukan lewat membaca
ulang kode sebelum menjalankannya, bukan oleh CEO, bukan oleh test
yang gagal — kalau tidak ketemu saat itu, tes yang saya tulis sendiri
akan lulus (fixture cuma satu bisnis, jadi hilangnya filter
business_id tidak akan pernah terlihat dari HASIL test, cuma dari
membaca query yang dihasilkan). **Pelajaran**: "sudah ditulis di file
yang tepat, dengan niat yang benar" bukan jaminan hasilnya benar --
kesalahan sekecil satu operator, di kode yang secara eksplisit
tentang keamanan data, tetap bisa lolos tanpa fixture yang cukup jahat
untuk mengeksposnya. Diperbaiki jadi `and(eq(...), outletScopeCondition(...))`
di semua 6 titik yang kena, sebelum pernah dijalankan sekali pun.

### Yang dibangun

Masih NOL pemasangan ke halaman/Server Action mana pun (Tahap 3/4) --
cuma utilitasnya, semua di `lib/auth/outlet-scope.ts` (satu file yang
sama dengan Tahap 1, sengaja -- supaya logika "null vs array kosong"
cuma ada di SATU tempat, bukan ditulis ulang tiap fungsi).

**Bentuk yang dipilih supaya sulit dipakai salah (permintaan CEO
eksplisit)**: `resolveOutletScope()` (privat, tidak diekspor) memaksa
setiap fungsi publik menangani TIGA kasus lewat `switch` tanpa
`default` (unrestricted/none/specific) -- pemanggil dari luar file ini
TIDAK PERNAH menulis `if (allowedOutletIds)` atau `.length` sendiri,
yang justru sumber dua arah kesalahan yang CEO khawatirkan:
- `outletScopeCondition(scope, column)` SELALU mengembalikan SQL yang
  valid untuk di-AND-kan tanpa syarat: `sql\`true\`` untuk tak
  terbatas, `sql\`false\`` untuk array kosong (BUKAN "tidak ada
  filter" -- dua konstanta SQL eksplisit yang tidak mungkin tertukar),
  `inArray(...)` untuk daftar spesifik. Tidak ada cabang kondisional
  yang diserahkan ke pemanggil sama sekali.
- `outletScopeConditionForTransfer(scope, fromColumn, toColumn)` --
  fungsi TERPISAH (bukan dipaksakan lewat `outletScopeCondition` satu
  kolom) untuk `stock_transfers`, OR lintas dua kolom.
- `isOutletAllowed(scope, outletId)` -- boolean, dipakai
  `assertOutletAllowed(scope, outletId, context)` yang SELALU MELEMPAR
  kalau ditolak (tidak pernah mengembalikan boolean yang bisa
  diabaikan pemanggil, keputusan CEO eksplisit).

**Diverifikasi lewat query DB sungguhan, KEDUA ARAH kesalahan** (bukan
cuma nilai balik fungsi murni):
- `lib/auth/__tests__/outlet-filter.test.ts` -- fixture 2 outlet + 2
  device (satu per outlet). Scope `null` mengembalikan KEDUA device
  (null tidak dibaca sebagai kosong); scope `[]` mengembalikan NOL
  device (kosong tidak dibaca sebagai null); scope `[outletA]`
  mengembalikan cuma device outlet itu.
- Kasus transfer stok: fixture 3 outlet (A/B/C) + 2 transfer (A→B,
  B→C). Scope `[outletB]` sengaja dites paling ketat -- B muncul
  sebagai TO di baris pertama DAN FROM di baris kedua, jadi hasil yang
  benar adalah KEDUA transfer kembali (membuktikan OR lintas kolom
  DAN lintas baris, bukan cuma kebetulan satu kolom cocok).
- `assertOutletAllowed` dites melempar (bukan cuma mengembalikan
  false) untuk kasus ditolak, dan pesan errornya menyertakan
  `context` yang diberikan pemanggil (memudahkan debug jalur non-UI).

(Kesalahan `&&` vs `and()` di draf pertama test file ini sudah dibahas
lengkap di bagian pembuka §23 di atas -- tidak diulang di sini.)

Full suite: **48 file, 404 tes hijau** (naik dari 47 file/389 tes di
Tahap 1 -- selisihnya 15 tes baru `outlet-filter.test.ts` di atas).
Build + lint + typecheck bersih.

Menunggu keputusan CEO untuk lanjut ke Tahap 3 (halaman baca-saja,
pemasangan filter PERTAMA kali ke halaman sungguhan).

## §24 · Pembatasan akses per outlet — Tahap 3, halaman 1/6: Dashboard (13 September 2026)

Aturan CEO untuk seluruh Tahap 3: SATU HALAMAN PER COMMIT, TIGA TES
wajib per halaman (scope null/satu-outlet/kosong), pesan eksplisit
"Anda tidak punya akses ke outlet manapun -- hubungi admin" saat scope
kosong (beda jelas dari "belum ada data"), JANGAN sentuh halaman tulis
atau RLS. Lapor setelah halaman pertama, bukan setelah keenamnya.

### Dashboard TERNYATA lebih besar dari lima halaman lain

Dashboard (`app/(dashboard)/page.tsx`) menyentuh TIGA fungsi query
berbeda, bukan satu -- lebih besar dari perkiraan awal "halaman
pertama untuk melihat pola":
- `getSalesByBrand()` (`lib/db/queries/sales-report.ts`) -- SEBELUM
  Tahap 3, fungsi ini TIDAK PUNYA parameter outlet sama sekali (selalu
  agregasi SEMUA outlet per brand). Ditambah `allowedOutletIds: OutletScope`
  WAJIB (bukan opsional) di parameter filter, diterapkan di JOIN
  `outlets` (kondisi tambahan sejajar `eq(outlets.isActive, true)` yang
  sudah ada) lewat `outletScopeCondition()` Tahap 2.
- `getOpenShiftsForBusiness()` dan `getShiftsNeedingReview()`
  (`lib/pos/shift.ts`) -- ditambah parameter `allowedOutletIds:
  OutletScope` WAJIB di akhir, diterapkan ke `shifts.outletId` lewat
  `outletScopeCondition()`. WAJIB, bukan opsional dengan default `null`
  -- kalau opsional, pemanggil baru yang lupa mengisi akan diam-diam
  dapat "semua outlet", persis kelas kesalahan yang seluruh Tahap 2/3
  ini dibangun untuk mencegah. Karena wajib, 4 titik panggil lama (3 di
  `shift.test.ts`, 1 di `scripts/demo-thrift-guest-account.ts`) GAGAL
  DI COMPILE TIME sampai diisi eksplisit `null` -- persis efek yang
  diinginkan, ditemukan lewat `tsc --noEmit`, bukan lolos diam-diam.

### Kombinasi dengan filter outlet yang SUDAH ADA sebelum Tahap 3

Dashboard sudah punya mekanisme penyempitan outlet sendiri sejak 11
September 2026 (drill-down per BRAND -- `SalesReportFilter.outletId:
string[]`, `outletFilterClause()` bahkan sudah punya penanganan
array-kosong-berarti-false sendiri, versi lama dari logika yang sama
Tahap 2 buat generik). Dua mekanisme ini WAJIB berlaku SEKALIGUS --
outlet yang lolos harus ada di KEDUANYA. Ditambahkan
`intersectOutletScope(allowedOutletIds, pageFilter)` di
`lib/auth/outlet-scope.ts` untuk ini, generik (bukan spesifik
Dashboard) -- kemungkinan besar dipakai lagi di Laporan Penjualan/
Laporan Stok kalau keduanya sudah punya dropdown pilih-outlet sendiri.

### Pesan scope kosong

Ditambahkan `strings.common.noOutletAccess` (satu string dipakai
ULANG di semua halaman Tahap 3, bukan ditulis ulang per halaman) --
Dashboard MEMOTONG SELURUH render begitu `allowedOutletIds` array
kosong terdeteksi (sebelum query lain apa pun dijalankan), menampilkan
CUMA pesan akses ini, bukan dashboard kosong yang mirip "toko sepi".

### Diverifikasi -- tiga tes wajib, dua file baru

- `lib/db/queries/__tests__/sales-by-brand-outlet-scope.test.ts` (4
  tes) -- dua outlet, order SUNGGUHAN (`payOrderWithDb`) beda qty per
  outlet supaya tidak mungkin tertukar diam-diam. Scope null -> netSales
  gabungan benar; scope satu outlet -> netSales CUMA outlet itu, outlet
  lain nol jejak; scope kosong -> **brand tidak muncul sama sekali di
  hasil**, bukan brand dengan angka nol.
- `lib/pos/__tests__/shift-outlet-scope.test.ts` (7 tes) -- dua outlet,
  shift terbuka di keduanya (satu sengaja dipaksa basi untuk menguji
  `getShiftsNeedingReview` juga). Tiga kasus yang sama untuk KEDUA
  fungsi.

Full suite: **50 file, 420 tes hijau** (naik dari 48 file/404 tes
sebelum halaman ini -- selisihnya 16 tes baru: 4 di
`sales-by-brand-outlet-scope.test.ts`, 7 di
`shift-outlet-scope.test.ts`, sisanya dari perluasan tes murni
`intersectOutletScope` di `outlet-filter.test.ts`). Build + lint +
typecheck bersih.
Halaman baca-saja lain (Laporan Penjualan, Laporan Stok, Laporan Bagi
Hasil, Barang, Kartu Stok Bahan) MASIH BELUM disentuh -- menunggu
keputusan CEO atas halaman pertama ini sebelum polanya diulang.

## §25 · Pembatasan akses per outlet — Tahap 3, halaman 2-5/6 (13 September 2026)

CEO menyetujui pola halaman 1 (Dashboard) apa adanya. Urutan sisa
ditetapkan: Laporan Penjualan → Laporan Stok → Barang → Kartu Stok
Bahan → **Laporan Bagi Hasil paling akhir** (satu-satunya yang
menyentuh pembayaran ke pihak luar — CEO ingin meninjau sebelum itu
dikerjakan). Empat halaman ini dikerjakan berurutan TANPA lapor di
tengah (instruksi eksplisit), tetap SATU HALAMAN PER COMMIT. Tiga
aturan yang dikonfirmasi tetap berlaku di semua: parameter outlet
WAJIB bukan opsional, tes pakai transaksi sungguhan dengan angka
BERBEDA per outlet, scope kosong = baris hilang (bukan baris nol).

### Halaman 2/6 — Laporan Penjualan (`reports/sales/page.tsx`)

BEDA dari Dashboard: `SalesReportFilter.outletId` SUDAH wajib diisi
sejak desain awal (bukan opsional) -- prinsip "wajib bukan opsional"
sudah terpenuhi tanpa perubahan skema. Yang baru: halaman menghitung
NILAI `outletId` itu lewat `intersectOutletScope(allowedOutletIds,
pilihanDropdown)`, bukan langsung dari dropdown mentah -- outletId di
URL untuk outlet di luar cakupan (bukan cuma dipilih dari dropdown)
otomatis diirisan jadi array kosong, bukan diloloskan. Dropdown outlet
(query `outletRows`) disaring `outletScopeCondition` supaya tidak
pernah menampilkan outlet terlarang (permintaan CEO soal dropdown).

Diverifikasi: `sales-report-outlet-scope.test.ts` (7 tes) -- dua
outlet, transaksi sungguhan qty 1 vs 4 (netSales 50000 vs 200000).
`getSalesSummary` (bentuk RINGKASAN, singleton) diuji terpisah dari
`getSalesByProduct` (bentuk DAFTAR) -- dicatat eksplisit di file tes
bahwa "baris hilang" cuma bermakna literal untuk bentuk daftar; bentuk
ringkasan scope kosong berarti semua angka nol, bukan "baris tidak
ada" (tidak ada konsep itu untuk satu baris tunggal). 51 file, 427 tes
hijau.

### Halaman 3/6 — Laporan Stok (`reports/stock/page.tsx`)

BEDA lagi dari dua halaman sebelumnya: `getStokByCategory`/
`getStokStatusSummary`/`getBarangMenumpuk*` SUDAH menerima SATU
`outletId: string` wajib (bukan array/scope) -- halaman ini per
desain menampilkan SATU outlet pada satu waktu (dropdown ganti-outlet,
bukan agregasi lintas outlet). Prinsip "wajib" sudah terpenuhi oleh
bentuk fungsi yang sudah ada; TIDAK ADA perubahan skema fungsi laporan
di halaman ini. Risiko satu-satunya ada di query DAFTAR OUTLET yang
mengisi dropdown DAN yang jadi sumber `selectedOutlet` (lewat fallback
`outletRows[0]` kalau `?outletId=` di URL tidak ketemu) -- disaring
`outletScopeCondition`. Karena fallback-nya SUDAH cuma memilih dari
`outletRows` yang sudah bersih, `selectedOutlet` TIDAK MUNGKIN jatuh
ke outlet terlarang secara struktural -- tidak ditambah pengecekan
assert terpisah (sengaja, itu jadi validasi untuk skenario yang tidak
mungkin terjadi lagi setelah query sumbernya benar).

Pesan scope kosong dicek LEBIH DULU dari query outletRows, supaya beda
jelas dari `noThriftOutlet` ("bisnis ini memang tidak punya outlet
thrifting") -- kalau dibalik urutannya, orang dengan scope kosong akan
salah baca pesannya sebagai "bisnis ini tidak jualan thrifting", bukan
"Anda tidak punya akses".

Diverifikasi: `stock-report-outlet-scope.test.ts` (4 tes) -- DUA
outlet thrifting + SATU outlet F&B (bukan cuma dua thrifting) supaya
sekalian membuktikan filter `posMode='thrifting'` yang sudah ada tidak
rusak oleh tambahan `outletScopeCondition`.

### Halaman 4/6 — Barang, daftar + cetak label (`barang/page.tsx`, `barang/[id]/label/page.tsx`)

Halaman ini SATU-SATUNYA dari enam yang punya form TULIS tertanam di
file yang sama (intake barang baru) -- form dan Server Action-nya
SENGAJA TIDAK disentuh (Tahap 3 cuma baca-saja), tapi dropdown outlet
form itu TETAP disaring `outletScopeCondition` murni sebagai narrowing
TAMPILAN (permintaan CEO soal dropdown, bukan perubahan validasi
Server Action). Kalau scope kosong, SELURUH halaman dipotong
(termasuk form) -- form dengan dropdown outlet kosong lebih
membingungkan daripada tidak ditampilkan sama sekali.

`barang/[id]/label/page.tsx` diakses LANGSUNG lewat URL by-id, bukan
lewat daftar yang sudah disaring -- jalur PERSIS yang diminta CEO
diuji sejak laporan enam-pertanyaan awal ("panggil dengan id outlet
lain lewat URL langsung"). Ditambah `isOutletAllowed()` (BUKAN
`assertOutletAllowed()` -- dipilih sengaja: `notFound()` konsisten
dengan penanganan "baris tidak ada" yang sudah ada di halaman ini,
dan tidak membocorkan bahwa kode barang itu ADA tapi di luar cakupan;
`assertOutletAllowed()` melempar Error mentah, cocok untuk jalur
tulis yang memang harus berisik, bukan halaman baca yang lebih baik
diam-diam jadi 404).

Diverifikasi: `barang-list-outlet-scope.test.ts` (7 tes) -- dua
barang beda kode/harga di outlet berbeda untuk daftar, plus kasus
`isOutletAllowed` untuk halaman label (scope null/satu-outlet/kosong).

### Halaman 5/6 — Kartu Stok Bahan (`ingredients/[id]/stock-card/page.tsx`)

`ingredients` katalog BISNIS (tidak punya `outletId`), tapi
`stock_movements`-nya PER OUTLET -- satu bahan yang sama punya
pergerakan stok terpisah tiap outlet, dan halaman ini menampilkan
GABUNGAN pergerakan lintas outlet untuk satu bahan. Disaring lewat
`outletScopeCondition` di `stock_movements.outlet_id` pada query
movement (bukan di query ingredient, yang business-wide dan tidak
perlu disentuh).

Diverifikasi: `stock-card-outlet-scope.test.ts` (4 tes) -- satu bahan,
dua movement outlet berbeda dengan qty BEDA (10 vs 25) lewat insert
langsung `stock_movements` (pola sama `inventory-tenancy-trigger.test.ts`,
bukan lewat alur pembelian/opname sungguhan -- yang diuji di sini
murni filter query-nya, bukan logika pencatatan movement).

**Kesalahan kecil ditangkap sendiri sebelum commit** (bukan oleh
CEO): draf pertama tes Kartu Stok Bahan menuliskan qty sebagai `"10"`/
`"25"` untuk membandingkan hasil query -- gagal, karena kolom
`stock_movements.qty` adalah `numeric(16,4)`, Postgres selalu
mengembalikannya sebagai `"10.0000"`/`"25.0000"` (string, presisi
penuh), bukan dipangkas. Bukan bug scoping (query sudah benar), murni
ekspektasi tes yang salah tebak format -- diperbaiki dengan
membandingkan string presisi penuh apa adanya.

Full suite (gabungan empat halaman ini): commit terpisah per halaman,
angka final dicatat di commit masing-masing. Build + lint + typecheck
bersih di setiap titik sebelum commit.

Berhenti SEBELUM Laporan Bagi Hasil sesuai instruksi CEO -- menunggu
tinjauan sebelum menyentuh halaman yang berurusan dengan pembayaran ke
pemilik titipan.

### Koreksi CEO — alasan sesungguhnya notFound() vs assertOutletAllowed(), jadikan POLA STANDAR

Alasan saya sebelumnya ("tidak membocorkan bahwa kode itu ada") BENAR
tapi tidak menjelaskan sampai tuntas. Alasan penuh dari CEO: kalau
halaman akses-by-id melempar pesan "akses ditolak" yang BEDA dari
"tidak ditemukan", orang yang punya beberapa kode barang di tangan
(hasil tebak-tebak, atau pernah lihat sebagian) bisa MEMBEDAKAN kode
yang benar-benar tidak ada dari kode yang ADA tapi di luar cakupannya
-- itu sendiri kebocoran informasi (mengonfirmasi keberadaan baris
data yang seharusnya dia tidak tahu ada), bahkan tanpa pernah melihat
isi barisnya. `notFound()` menyatukan kedua kasus jadi satu respons
yang tidak bisa dibedakan dari luar -- "tidak ada" dan "tidak boleh"
harus terlihat SAMA ke pemanggil.

**Ini jadi POLA STANDAR untuk SEMUA halaman akses-by-id ke depan**
(bukan cuma `barang/[id]/label`): fetch baris by id + businessId dulu,
lalu `if (!row || !isOutletAllowed(allowedOutletIds, row.outletId))
notFound();` -- SATU pengecekan gabungan, SATU respons, tidak pernah
pesan berbeda untuk "tidak ada" vs "di luar cakupan".
`assertOutletAllowed()` (melempar Error) tetap untuk jalur TULIS yang
memang harus berisik ke pemanggil yang salah pakai — bukan untuk
halaman baca yang diakses langsung by-id.

### UTANG TERBUKA — jendela nyata, dicatat dengan nama fungsi (WAJIB item PERTAMA Tahap 4)

**`saveBarang`** (Server Action, `app/(dashboard)/barang/actions.ts`) →
**`saveBarangWithDb`** (`lib/barang/manage.ts`) menerima `outletId`
mentah dari FormData TANPA validasi cakupan apa pun. Tahap 3 cuma
menyaring TAMPILAN dropdown form intake (supaya tidak menampilkan
outlet terlarang) -- dropdown yang bersih TIDAK MENCEGAH pemanggilan
langsung: manajer yang dibatasi ke Outlet A bisa memanggil `saveBarang`
langsung (bukan lewat form, misal lewat request manual) dengan
`outletId` Outlet B dan BERHASIL menambah barang di outlet yang bukan
haknya, HARI INI, selama Tahap 4 belum dikerjakan. Ini bukan risiko
teoretis -- ini gerbang yang sengaja belum dipasang, dicatat di sini
persis supaya tidak hilang di antara tahap.

**Tindakan wajib di Tahap 4**: `saveBarangWithDb` harus jadi fungsi
PERTAMA yang dipasangi `assertOutletAllowed(allowedOutletIds,
data.outletId, "saveBarangWithDb")` sebelum insert/update apa pun,
sebelum halaman tulis lain mana pun dikerjakan.

## §26 · Pembatasan akses per outlet — Tahap 3, halaman 6/6 (TERAKHIR): Laporan Bagi Hasil (13 September 2026)

Satu-satunya dari enam halaman yang menyentuh pembayaran ke pihak
LUAR (pemilik titipan) -- CEO minta tiga hal spesifik dibuktikan,
bukan cuma pola tiga-kasus generik yang sudah dipakai lima halaman
sebelumnya.

### Halaman utama (`reports/bagi-hasil/page.tsx`)

Struktur PERSIS sama Laporan Stok -- satu outlet per tampilan,
dropdown ganti-outlet, `getBagiHasilLaporan()` sudah menerima satu
`outletId: string` wajib (signature TIDAK berubah). Disaring di query
daftar outlet (sumber dropdown + fallback `selectedOutlet`), pesan
scope kosong dicek sebelum query itu, sama pola Laporan Stok.

### Ekspor Excel (`api/reports/bagi-hasil/export/route.ts` → `buildBagiHasilExport`)

Jalur TERPISAH dari tabel -- `outletId` datang langsung dari
`url.searchParams`, tidak lewat dropdown yang sudah disaring sama
sekali. Ditambah `allowedOutletIds: OutletScope` wajib, dicek PERSIS
di titik yang sama dengan gerbang SYARAT 3 (dayCutoffConfirmed) yang
sudah ada -- SEBELUM `getBagiHasilLaporan` dipanggil, SEBELUM workbook
dibangun sama sekali (instruksi CEO eksplisit: tolak dulu, jangan
bangun dulu baru ditolak).

**Dilipat jadi status `not_found` yang SAMA dengan outlet yang benar-
benar tidak ada** -- bukan status baru semacam "forbidden" -- pola
persis `notFound()` di `barang/[id]/label` (§25): mengetik `outletId`
outlet lain lewat URL ekspor tidak bisa dipakai membedakan "outlet ini
tidak ada" dari "outlet ini ada tapi di luar cakupan Anda".

### "Tandai Sudah Dibayar" (`recordPemilikPayoutWithDb`)

Jalur tulis KEDUA yang terpisah dari tabel. Ditambah
`assertOutletAllowed(allowedOutletIds, data.outletId,
"recordPemilikPayoutWithDb")` -- MELEMPAR, dicek sebelum gerbang
SYARAT 3 dan sebelum insert. **Catatan penting**: gerbang Server Action
pembungkusnya (`payroll.process`) HARI INI cuma bisa dipegang
owner/akuntan -- KEDUA role itu SELALU `allowedOutletIds` null (tidak
pernah dibatasi, keputusan Tahap 1). Artinya baris `assertOutletAllowed`
ini SECARA PRAKTIS tidak pernah menolak siapa pun hari ini -- tetap
dipasang untuk pertahanan berlapis, supaya kalau matriks izin berubah
nanti (mis. manajer diizinkan proses payroll), gerbangnya sudah ada
tanpa perlu diingat lagi terpisah.

### `fetchPayoutHistory` — ditambah PROAKTIF, di luar permintaan eksplisit CEO

Server Action ini (riwayat pembayaran per pemilik+outlet, dipakai
komponen riwayat di halaman) menerima `outletId` langsung dari
parameter panggilan, digerbang `report.sales` (izin LEBIH LONGGAR dari
`payroll.process`, bisa dipegang role yang dibatasi) -- risiko
strukturnya SAMA PERSIS dengan ekspor. CEO tidak menyebut fungsi ini
secara eksplisit, tapi dicatat di sini karena satu-satunya alasan
tidak disebut kemungkinan besar karena belum diketahui ada -- bukan
karena dianggap aman. Ditolak dengan pesan generik yang sama dengan
error tak terduga lain (pola sama `not_found`/`notFound()`: tidak
membedakan "outlet tidak ada" dari "di luar cakupan").

### Diverifikasi — tiga hal spesifik yang diminta CEO

`lib/pemilik/__tests__/bagi-hasil-outlet-scope.test.ts` (8 tes baru),
fixture pemilik **"Salma"** menjual satu barang **Rp100.000** (persenBagi
60%) di outlet **"BTHR"**, ditambah satu outlet **"OTHER"** kosong:

1. **Angka Salma IDENTIK, dilihat owner**: `getBagiHasilLaporan()`
   (dipakai tabel di layar, signature TIDAK disentuh sama sekali) DAN
   `buildBagiHasilExport()` dengan `allowedOutletIds: null` (owner)
   SAMA-SAMA menghasilkan `bagianPemilik` = **60000** persis -- file
   Excel dibaca ULANG dengan ExcelJS (bukan cuma bytes) untuk mencari
   baris "Salma" dan membaca kolom "Bagian Pemilik"-nya. Kalau gerbang
   baru ikut mengubah kalkulasi, angka ini akan meleset dari 60000.
2. **Manajer dibatasi ke outlet LAIN (`allowedOutletIds: [OTHER]`)**:
   daftar outlet TIDAK memuat BTHR sama sekali (dropdown/fallback
   tidak mungkin memilihnya), DAN `buildBagiHasilExport` dengan
   `outletId` BTHR dipaksa lewat parameter (mensimulasikan URL ekspor
   diketik langsung) mengembalikan `not_found` -- data Salma tidak
   pernah terbaca dari database sama sekali untuk permintaan ini.
3. **Scope array KOSONG**: daftar outlet nol baris, `buildBagiHasilExport`
   `not_found` juga -- BUKAN tabel/file kosong yang bisa disalahartikan
   "belum ada penjualan bulan ini".

Ditambah pengujian jalur "Tandai Sudah Dibayar" di
`lib/pemilik/__tests__/payout-manage.test.ts`: `allowedOutletIds`
tidak memuat outlet yang diminta -> `recordPemilikPayoutWithDb`
MELEMPAR, dibuktikan TIDAK ADA baris `pemilik_payouts` baru tertulis
(bukan cuma "melempar", tapi "melempar DAN tidak menulis apa pun").

Full suite: dicatat di commit. Build + lint + typecheck bersih.

**Tahap 3 TUTUP di sini** -- keenam halaman baca-saja selesai
(Dashboard, Laporan Penjualan, Laporan Stok, Barang, Kartu Stok Bahan,
Laporan Bagi Hasil). Menunggu keputusan CEO untuk Tahap 4 (halaman
tulis) -- dengan `saveBarangWithDb` sebagai item PERTAMA (utang
terbuka yang dicatat di atas).

## §27 · Pembatasan akses per outlet — Tahap 4: halaman tulis (13 September 2026)

CEO menyetujui pola Tahap 3, catat tiga hal jadi kebiasaan tetap:
lipat penolakan jadi status/pesan yang SAMA dengan "tidak ada" (bukan
status forbidden terpisah) di SEMUA jalur; terus cari jalur yang tidak
ada di daftar CEO sendiri; kegagalan infra (DNS dkk) dicek dulu,
jangan langsung dianggap flaky.

Urutan Tahap 4: (1) `saveBarangWithDb` [utang terbuka] → (2) Outlets →
(3) Employees → (4) Devices → (5) Stock transfers [paling rumit,
fromOutletId ATAU toOutletId — RANCANGAN dilaporkan dulu sebelum
dibangun]. Satu per commit. Berbeda dari Tahap 3: (a) tiap jalur tulis
butuh tes penolakan LANGSUNG ke *WithDb dengan pemeriksaan DATABASE
sesudahnya (bukan cuma nilai balik), (b) UPDATE diuji dari DUA sumber
outletId (baris yang diubah DAN input), (c) pesan penolakan manusiawi,
TIDAK menyebut outlet mana yang ditolak.

### Pesan penolakan — desain ulang, dipakai SEMUA jalur tulis ke depan

`strings.common.outletAccessDenied` = **"Outlet ini di luar akses Anda
-- hubungi admin."** -- satu pesan yang SAMA di semua jalur tulis,
TIDAK PERNAH menyebut nama/kode outlet (persis permintaan CEO).

`assertOutletAllowed()` (Tahap 2) DIUBAH: pesan yang DILEMPAR sekarang
SELALU string manusiawi ini, `context` (nama fungsi) dipindah ke
`console.error()` saja (log server, tidak pernah sampai ke pengguna) --
sebelumnya `context` ikut tercetak di pesan yang dilempar, itu OK
untuk debug tapi bukan sesuatu yang boleh dilihat pengguna kalau
error-nya sampai bocor mentah ke UI.

**Keputusan desain tambahan, dicatat eksplisit karena ini penyimpangan
dari pola `assertOutletAllowed()` yang sudah dipakai Tahap 3**: untuk
lima fungsi Tahap 4 (`saveBarangWithDb` dst.), penolakan outlet
ditulis sebagai `if (!isOutletAllowed(...)) return { error:
strings.common.outletAccessDenied }` -- BUKAN `assertOutletAllowed()`
yang melempar. Alasannya teknis: Next.js Server Actions MENYAMARKAN
pesan `Error` yang dilempar di production (diganti pesan generik demi
keamanan) KECUALI dikembalikan lewat nilai balik terstruktur -- pola
`{error, success}` yang SUDAH dipakai di setiap `*WithDb` lain di
proyek ini untuk alasan yang sama. Melempar di sini berisiko pesan
manusiawi yang CEO minta tidak pernah benar-benar sampai ke pengguna.
`assertOutletAllowed()` (throw) tetap dipertahankan sebagai primitif
untuk konteks yang BUKAN pola `{error}` (seperti gerbang
`recordPemilikPayoutWithDb` Tahap 3, tidak diubah) -- dua alat untuk
dua bentuk fungsi, bukan salah satu dihapus.

**CATATAN UNTUK DITINDAKLANJUTI SETELAH TAHAP 4 SELESAI (bukan
sekarang, instruksi CEO eksplisit)**: `isOutletAllowed()` mengembalikan
boolean biasa -- persis bentuk yang Tahap 2 sengaja hindari lewat
`assertOutletAllowed()` ("gagal diam-diam kalau pemanggil lupa
mengecek nilai baliknya"). Di kelima fungsi Tahap 4 ini aman karena
hasilnya SELALU langsung dipakai (`if (!isOutletAllowed(...)) return
{error}`), tapi tidak ada yang MEMAKSA pemanggil BARU menulis pola itu
-- lupa mengecek nilai balik `isOutletAllowed()` di fungsi kelima
belas nanti tidak akan dihentikan siapa pun, beda dengan
`assertOutletAllowed()` yang gagal keras kalau diabaikan. Perlu bentuk
yang menggabungkan DUA sifat: pesan yang sampai ke pengguna (lolos
penyamaran Next.js) DAN tidak bisa diam-diam diabaikan pemanggil.
Usulan dilaporkan SETELAH Tahap 4 (Outlets/Employees/Devices/Stock
Transfers) selesai, bukan sekarang -- supaya tidak menghentikan
momentum jalur tulis yang sedang dikerjakan.

### Tahap 4, item 1/5 — `saveBarangWithDb` (utang terbuka Tahap 3)

`allowedOutletIds: OutletScope` ditambahkan sebagai parameter WAJIB.
Dua sumber outletId diperiksa TERPISAH, sesuai bentuk fungsi ini:
- **CREATE**: `data.outletId` (input pengguna, satu-satunya sumber
  untuk barang baru) -- dicek SEBELUM lookup kode outlet, sebelum
  insert apa pun.
- **UPDATE**: outletId **BARIS YANG SEDANG DIUBAH** (diambil ulang
  dari DB, BUKAN `data.outletId` dari input) -- edit barang TIDAK
  PERNAH memindahkan outlet (kolom itu diabaikan total di SQL UPDATE,
  lihat komentar lama di file), jadi input outletId tidak relevan
  untuk cabang ini sama sekali. Manajer Outlet A tidak boleh mengedit
  barang Outlet B walau cuma ganti harga/nama.

**Ditambah PROAKTIF, di luar `saveBarangWithDb` yang eksplisit diminta
CEO** (mengikuti pujian "terus cari jalur yang tidak ada di daftar
saya"):
- **`setBarangStatusWithDb`** -- fungsi TERPISAH di file yang sama,
  gerbang izin sama (`barang.manage`), risiko identik (ubah status
  barang outlet lain lewat id langsung). Dicek TERPISAH dari kondisi
  `ne(status,'terjual')` yang sudah ada -- supaya pesan errornya
  sesuai alasan sesungguhnya, bukan satu pesan generik untuk dua kasus
  berbeda.
- **`addBarangFromShiftWithDb`** (`lib/pos/pos-add-barang.ts`, jalur
  "Ita super kasir" dari `/pos/thrift`) -- **LUBANG SUNGGUHAN YANG
  SUDAH TERBUKA DI PRODUKSI, BUKAN PERTAHANAN BERLAPIS** (koreksi bobot
  dari CEO, 13 September 2026 -- catatan pertama menyebutnya "temuan",
  itu meremehkan). Sebelum diperbaiki: `rawInput.outletId` (dikirim
  klien, bisa disunting) dipercaya MENTAH-MENTAH -- kasir yang shift-nya
  di Outlet A bisa mengirim `outletId` Outlet B di body request dan
  BERHASIL menambah barang ke Outlet B walau dia fisik/shift di Outlet
  A. **Ini bukan cuma "data tidak rapi"**: barang thrifting selalu
  terikat pemilik titipan dan persentase bagi hasil (lihat §17/§26) --
  barang yang masuk ke outlet yang salah muncul di LAPORAN BAGI HASIL
  OUTLET YANG SALAH, memindahkan uang pemilik titipan secara diam-diam
  dari satu outlet ke outlet lain di angka yang dibayarkan. Ini uang
  orang, bukan cuma kerapian data.

  Identitas di jalur ini BUKAN membership Supabase Auth sama sekali
  (gerbangnya sengaja role EMPLOYEE pemilik shift PIN, lihat komentar
  lama di file itu) -- `allowedOutletIds` dashboard TIDAK relevan di
  sini sama sekali. Diperbaiki dengan memaksa `[shift.outletId]`
  sebagai `allowedOutletIds` ke `saveBarangWithDb` -- REUSE mekanisme
  yang sama, bukan pengecekan baru terpisah. **Ini penerapan LANGSUNG
  prinsip "shift mempersempit, tidak pernah memberi" (§21, dasar
  seluruh pekerjaan pembatasan akses per outlet) ke jalur yang aturan
  itu belum pernah menyentuh sama sekali** -- shift PIN sudah lama ada
  (§14 dan sebelumnya), tapi tidak pernah secara eksplisit dipakai
  sebagai BATAS OUTLET untuk penulisan data sampai perbaikan ini.
  `OutletScope` di titik ini bukan turunan membership sama sekali, cuma
  daftar satu outlet yang sah untuk shift yang sedang terbuka --
  konfirmasi bahwa `OutletScope`/`isOutletAllowed` adalah primitif
  generik (bisa diisi dari SUMBER APA PUN yang punya makna "outlet mana
  yang sah di titik ini"), bukan cuma pipa dari `memberships.outlet_ids`.

### Diverifikasi

`lib/barang/__tests__/manage.test.ts` (10 tes, file BARU -- ketiga
fungsi ini sebelumnya NOL tes) dan
`lib/pos/__tests__/pos-add-barang-outlet-scope.test.ts` (3 tes, file
BARU). Semua kasus penolakan diperiksa DUA arah sesuai permintaan CEO:
nilai balik (`result.error`) DAN database (baris tidak baru/tidak
berubah), termasuk kasus jahat "outletId input diisi outlet yang
diizinkan padahal baris aslinya outlet lain" (update tetap ditolak,
baris tetap di outlet asalnya, tidak pernah "berpindah").

Full suite: dicatat di commit. Build + lint + typecheck bersih.

Lanjut Outlets → Employees → Devices tanpa lapor di tengah (instruksi
CEO). Berhenti SEBELUM Stock Transfers -- rancangan dilaporkan dulu.

CEO menegaskan bobot temuan `addBarangFromShiftWithDb`: **lubang
sungguhan yang sudah terbuka di produksi, bukan pertahanan berlapis**
-- barang thrifting terikat pemilik titipan + bagi hasil, jadi outlet
salah = uang pemilik titipan berpindah diam-diam ke laporan outlet
yang salah, bukan cuma data tidak rapi. Perbaikannya (`[shift.outletId]`)
dicatat sebagai penerapan LANGSUNG prinsip "shift mempersempit, tidak
pernah memberi" (§21) ke jalur yang aturan itu belum pernah menyentuh.

**Utang dicatat untuk DITINJAU SETELAH TAHAP 4 (bukan sekarang)**:
`isOutletAllowed()` mengembalikan boolean biasa, bisa diabaikan
pemanggil baru -- persis yang `assertOutletAllowed()` Tahap 2 hindari.
Aman di jalur yang sudah ada (hasilnya selalu langsung dipakai), tapi
tidak ada yang MEMAKSA pemanggil berikutnya menulis pola itu. Usulan
bentuk yang lebih sulit dipakai salah menyusul setelah item 5 (Stock
Transfers) selesai.

### Tahap 4, item 2/5 — Outlets (ubah outlet yang sudah ada)

`updateOutletWithDb`: outlet TIDAK PUNYA "outletId induk" seperti
employees/devices -- baris yang diubah ADALAH outletnya sendiri, jadi
cuma SATU sumber dicek: `data.id`. `createOutletWithDb` SENGAJA TIDAK
disentuh -- owner-only ("settings.business"), owner SELALU
`allowedOutletIds` null, dan outlet baru belum py "outlet existing"
untuk diperiksa cakupannya.

**Ditambah PROAKTIF**: `confirmDayCutoffWithDb` (tombol "Konfirmasi"
terpisah dari form edit penuh, TT11) -- fungsi tulis lain yang
menerima `outletId` langsung tanpa gerbang apa pun sampai sekarang,
gerbang izin sama (`outlet.manage`).

Diverifikasi: 6 tes baru di `outlets/__tests__/manage.test.ts` --
`updateOutletWithDb`/`confirmDayCutoffWithDb` outlet lain (DITOLAK,
baris tidak berubah, pesan tidak menyebut outlet), outlet yang
diizinkan (berhasil), array kosong (DITOLAK).

### Tahap 4, item 3/5 — Employees

**Kasus jahat CEO diterapkan persis**: `updateEmployeeWithDb` memeriksa
DUA sumber TERPISAH -- outletId BARIS SAAT INI (diambil ulang dari DB)
DAN outletId TUJUAN (`data.outletId`, employees BISA dipindah outlet
lewat form ini, beda dari barang). Baris di outlet lain ditolak walau
input tujuan diisi outlet yang diizinkan (mencoba "menarik"); baris di
outlet yang diizinkan ditolak juga kalau tujuannya outlet lain (mencoba
"mendorong keluar"). Kedua arah dites eksplisit dengan pembuktian baris
TIDAK PERNAH pindah.

**Kasus khusus**: `employees.outletId` NULLABLE (karyawan lintas-outlet).
Helper `isEmployeeOutletAllowed()` baru: outlet `null` cuma bisa
disentuh scope TAK TERBATAS (`null`) -- ambigu ditolak, bukan
diloloskan, supaya tidak jadi celah "karyawan tanpa outlet = bisa
disentuh siapa saja yang dibatasi".

**Ditambah PROAKTIF**: `resetPinWithDb` dan `unlockEmployeeWithDb` --
dua fungsi tulis terpisah, menerima `employeeId` langsung tanpa
gerbang apa pun sampai sekarang, gerbang izin sama (`employee.manage`).
Dibuktikan: PIN lama tetap berfungsi / karyawan tetap terkunci setelah
percobaan ditolak.

Diverifikasi: 8 tes baru di `employees/__tests__/manage.test.ts`.

### Tahap 4, item 4/5 — Devices

`updateDeviceWithDb`: pola DUA sumber sama persis employees
(`devices.outletId` NOT NULL, jadi tidak perlu helper null-handling
terpisah). `createDeviceWithDb`: satu sumber (input).

**Ditambah PROAKTIF, temuan paling jauh dari daftar CEO**:
`pairDeviceWithDb` (`lib/pos/device-pairing.ts`, `/pos/setup`) --
memasangkan tablet ke device outlet lain membiarkan manajer yang
dibatasi beroperasi seolah berwenang atas outlet itu SEBELUM PIN
karyawan pernah dicek. Pesan pakai `outletAccessDenied` (bukan pola
`notFound()` Tahap 3) -- ini jalur TULIS (baris `devices` diperbarui),
bukan halaman baca-by-id.

Diverifikasi: 7 tes baru gabungan `devices/__tests__/manage.test.ts`
(4 baru) dan `pos/__tests__/device-pairing.test.ts` (3 baru) --
termasuk bukti `lastPairedAt` TIDAK PERNAH tertulis untuk percobaan
yang ditolak.

Full suite: dicatat di commit (tiga commit terpisah, satu per item).
Build + lint + typecheck bersih.

**Berhenti SEBELUM Stock Transfers** -- rancangan wajib dilaporkan
dulu sebelum dibangun (gerbang per AKSI, bukan per baris: outlet ASAL
vs outlet TUJUAN beda hak untuk aksi berbeda).

## §28 · Pembatasan akses per outlet — Tahap 4, item 5/5: Stock Transfers (rancangan disetujui, 13 September 2026)

### Prinsip: gerbang per AKSI, bukan per baris

Satu baris `stock_transfers` punya `fromOutletId` (gudang pusat,
SELALU hasil `getCentralKitchen()`, tidak pernah dari input) dan
`toOutletId` (outlet peminta, dari input). Wewenang per AKSI:

| Aksi | Outlet yang diperiksa |
|---|---|
| Request | `toOutletId` (input) |
| Approve/Reject | `fromOutletId` (baris) |
| Send | `fromOutletId` (baris) |
| Receive | `toOutletId` (baris) |
| Cancel dari `requested`/`approved` | `toOutletId` (baris) -- murni status, tidak ada stok bergerak |
| **Cancel dari `received`** | **KEDUA outlet** (`fromOutletId` DAN `toOutletId`) -- lihat alasan di bawah |

**Kenapa bukan `outletScopeConditionForTransfer` (OR, Tahap 2) untuk
gerbang aksi**: utilitas itu untuk VISIBILITAS list (tampilkan baris
kalau outlet manapun match). Dipakai untuk gerbang APPROVE, manajer
outlet peminta bisa "menyetujui permintaannya sendiri" -- justru yang
sudah dicegah di level role (`stock.transfer_approve`: warehouse
sengaja `na`). OR cuma untuk daftar/tampilan, gerbang aksi selalu satu
kolom spesifik (atau AND dua kolom, khusus cancel-dari-received).

### Koreksi CEO — cancel dari `received` butuh KEDUA outlet, bukan `toOutletId` saja

Cancel dari `received` adalah REVERSAL STOK, beda kelas dari cancel
`requested`/`approved` (murni status). Kode yang ada (komentar asli,
tidak diubah):

> "reversal penuh di sisi OUTLET saja (mekanisme v1 dipertahankan)...
> Stok GUDANG (transfer_out saat kirim) TIDAK direversal -- barang
> memang sudah fisik meninggalkan gudang terlepas dari koreksi catatan
> penerimaan outlet."

**Pembedaan penting yang CEO minta ditulis eksplisit supaya tidak
disalahpahami orang berikutnya**: keputusan AKUNTANSI di atas (gudang
tidak ikut direversal) SENGAJA dan beralasan tertulis -- BUKAN yang
sedang diubah oleh pekerjaan Tahap 4 ini. Yang BARU (dan memang baru,
bukan pernah diputuskan sebelumnya) adalah pertanyaan AKSES: siapa
yang boleh MEMICU reversal asimetris ini. Frasa "mekanisme v1
dipertahankan" menandakan logika ini diwariskan dari versi
satu-langkah sebelum alur request→approve→send→receive ada, dipindah
apa adanya tanpa pernah ditinjau ulang untuk pertanyaan otorisasi --
bukan karena ada yang lupa, tapi karena pertanyaannya belum pernah
relevan sampai pembatasan akses per outlet ada.

Efeknya: `sentQty` bersih HILANG dari pembukuan kedua sisi (gudang
sudah -sentQty sejak SEND, outlet +receivedQty lalu -receivedQty saat
cancel = bersih nol, tidak pernah kembali ke gudang). Ini masuk akal
KALAU cancel-dari-received selalu berarti "barang ini pada dasarnya
tidak pernah sungguh sampai" -- tapi sistem tidak pernah mengonfirmasi
itu (lihat utang baru di bawah). Diputuskan: gerbang akses untuk kasus
ini butuh KEDUA outlet (`fromOutletId` DAN `toOutletId`) -- outlet-saja
membiarkan keputusan sepihak yang CEO ingin cegah, gudang-saja sama
janggalnya (kenapa gudang membatalkan catatan PENERIMAAN outlet tanpa
keterlibatan outlet itu). Keduanya adalah bar yang wajar untuk aksi
berkonsekuensi "stok hilang dari pembukuan".

### UTANG BARU — dicatat, TIDAK DIKERJAKAN sekarang (di luar lingkup Tahap 4)

**Formulir cancel tidak membedakan "barang hilang" dari "salah klik
terima, barangnya ada di outlet"** -- dua akibat yang seharusnya
BERLAWANAN:
- **Salah klik terima** (outlet fisik TIDAK punya barangnya, cuma
  salah catat) -- stok SEHARUSNYA kembali ke gudang (reversal DUA
  sisi: outlet turun, gudang naik lagi), bukan cuma turun di outlet.
- **Barang hilang sungguhan** (rusak/hilang di outlet setelah
  diterima) -- stok MEMANG harus hilang dari pembukuan, TAPI harus
  tercatat sebagai KERUGIAN BERNAMA (pola sama `transfer_loss` yang
  sudah ada untuk selisih sent vs received), bukan menguap tanpa jejak
  seperti sekarang.

Formulir cancel hari ini cuma minta alasan teks bebas, tidak
membedakan dua skenario ini sama sekali -- keduanya berakhir di
mekanisme yang SAMA (turun di outlet, gudang tidak tersentuh, tidak
ada movement kerugian bernama). **Ini utang PERILAKU STOK, bukan
akses** -- di luar lingkup pembatasan akses per outlet, dan CEO
eksplisit melarang dikerjakan sekarang: mengubah perilaku stok di
tengah pekerjaan akses adalah cara memastikan kedua-duanya rusak
sekaligus kalau ada yang salah. Menyusul sebagai pekerjaan TERPISAH,
kapan pun itu diputuskan, dengan kemungkinan solusi: tambah pilihan
eksplisit di formulir cancel ("barang kembali ke gudang" vs "barang
hilang/rusak"), masing-masing menulis movement yang benar.

### SYARAT PELUNCURAN (bukan catatan biasa) — gudang wajib ada di outlet_ids sebelum manajer dibatasi dibuat

Approve/send digerbang `fromOutletId` (gudang). Dicek langsung ke
database dev (13 September 2026, bukan dari ingatan): **masih 6 baris
membership, SEMUA role owner, SEMUA outlet_ids null** -- belum ada
satu pun membership manager/warehouse dibuat lewat `/team`. Central
kitchen ("Gudang", kode DEMO) sudah ada di bisnis "[DEV] Demo Cafe".

**Artinya gerbang ini AMAN dipasang sekarang** (nol membership
restricted yang bisa terkunci) -- TAPI begitu manajer sungguhan dibuat
dengan `outlet_ids` dibatasi ke outlet retailnya lewat `/team`, dan
dialah yang biasa approve/kirim transfer, alur BERHENTI DI HARI
PERTAMA kecuali outlet gudang ditambahkan ke `outlet_ids`-nya LEBIH
DULU. **Ini syarat operasional wajib sebelum peluncuran produksi**,
bukan sekadar catatan: siapa pun yang menyiapkan membership produksi
harus tahu peran approve/kirim transfer butuh akses ke outlet gudang
juga, tidak cukup outlet retailnya sendiri.

**Klarifikasi yang dicatat supaya tidak jadi sumber kebingungan
berulang**: gerbang `stock.transfer_approve`/`stock.transfer` dicek
dari **`memberships.role`** (identitas dashboard Supabase Auth) --
BUKAN `employees.role` (identitas PIN kasir POS). Dua sistem identitas
terpisah total (lihat catatan awal proyek ini soal itu) -- karyawan
PIN berperan "manager" TIDAK relevan sama sekali untuk gerbang ini.

### Temuan: list/dropdown/send/receive SUDAH BOCOR HARI INI, dicatat sebagai lubang terbuka

Sama seperti `addBarangFromShiftWithDb` -- BUKAN pencegahan
teoretis, ini kondisi SEKARANG sebelum diperbaiki:
- `/stock-transfers` (list): `SELECT * FROM stock_transfers WHERE
  business_id=...` -- NOL filter outlet. Siapa pun dengan izin
  `stock.transfer` melihat SEMUA transfer semua outlet.
- `/stock-transfers/new`: dropdown "outlet peminta" menampilkan SEMUA
  outlet retail aktif, tidak disaring.
- `/stock-transfers/[id]/send`, `/[id]/receive`: akses langsung by-id
  lewat URL, sudah pakai `notFound()` untuk status salah, TAPI belum
  ada pengecekan outlet sama sekali.

### Urutan pembangunan (disepakati, satu per commit)

1. List `/stock-transfers` -- pasang `outletScopeConditionForTransfer` (OR).
2. Dropdown outlet di `/stock-transfers/new` -- `outletScopeCondition` (satu kolom).
3. `/[id]/send`, `/[id]/receive` -- `isOutletAllowed` digabung ke `notFound()` yang sudah ada.
4. Lima fungsi `*WithDb` -- gerbang sesuai tabel di atas, cancel-dari-received butuh KEDUA outlet.
5. `getLastRequestForOutlet` -- gerbang DI FUNGSINYA SENDIRI (`assertOutletAllowed`), TIDAK mengandalkan pemanggil sudah menyaring dropdown lebih dulu (koreksi CEO: itu persis pola yang Tahap 2 hindari -- pemanggil baru lewat jalur lain tidak akan dihentikan siapa pun).

**Poin 4 (jawaban desain CEO, diterapkan langsung)**: tombol
Approve/Reject di halaman list DISEMBUNYIKAN kalau `fromOutletId`
tidak ada di `allowedOutletIds` -- konsisten dengan keputusan dropdown
Tahap 3 ("kontrol yang terlihat lalu gagal saat diklik itu
membingungkan"). Gerbang server TETAP ada, penyembunyian bukan
penggantinya.

Menunggu hasil pembangunan lima commit ini -- lapor setelah selesai,
Tahap 4 tutup di situ.

### SELESAI (13 September 2026) — lima bagian, lima commit, TAHAP 4 TUTUP

Dibangun persis urutan di atas, satu commit per bagian (pos-fnb):

1. `66b1015` -- List `/stock-transfers`: `outletScopeConditionForTransfer`
   (OR) untuk visibilitas, tombol Approve/Reject disembunyikan kalau
   `fromOutletId` di luar cakupan (poin 4, diterapkan langsung).
2. `3410ab3` -- Dropdown outlet peminta di `/stock-transfers/new`:
   `outletScopeCondition` (satu kolom).
3. `0a697c6` -- `/[id]/send`, `/[id]/receive`: `isOutletAllowed`
   digabung ke `notFound()` yang sudah ada (fromOutletId untuk send,
   toOutletId untuk receive).
4. `66f7041` -- Lima fungsi `*WithDb` (request/approve/reject/send/
   receive/cancel): gerbang sesuai tabel di atas, TERMASUK
   cancel-dari-received yang butuh KEDUA outlet -- dibuktikan lewat 4
   tes eksplisit (satu outlet saja ditolak dari kedua arah, kedua
   outlet berhasil).
5. `95fb34e` -- `getLastRequestForOutlet`: gerbang sendiri, tidak
   mengandalkan pemanggil.

**Penyimpangan sengaja dari rancangan di poin 5, dicatat supaya tidak
mengejutkan pembaca berikutnya**: rancangan di atas menyebut
`assertOutletAllowed` (throw) sebagai mekanismenya. Yang dibangun
malah `isOutletAllowed` + `return []` -- KARENA `getLastRequestForOutlet`
dipanggil di DALAM LOOP per outlet saat render halaman
`/stock-transfers/new` (satu panggilan per baris dropdown). `throw` di
tengah loop itu akan menjatuhkan SELURUH halaman kalau satu saja
outlet di luar cakupan ada di daftar -- padahal fungsi ini FUNGSI
BACA dengan tipe kembalian array yang sudah punya makna "tidak ada
riwayat" (`[]`) untuk kasus lain (belum pernah ada transfer). Menolak
dengan array kosong konsisten dengan makna itu dan tidak meledakkan
halaman untuk pengguna yang sah di outlet lain pada saat yang sama.
`assertOutletAllowed` tetap mekanisme yang benar untuk fungsi yang
BUKAN dipanggil berulang dalam loop render (lihat Tahap 3,
`recordPemilikPayoutWithDb`) -- prinsipnya "gerbang sendiri, tidak
mengandalkan pemanggil" dipertahankan penuh, cuma bentuk penolakannya
menyesuaikan konteks pemanggilan.

**Total pembatasan akses per outlet, Tahap 0-4**: enam halaman baca
(Tahap 3) + saveBarangWithDb, Outlets, Employees, Devices, dan Stock
Transfers lima-bagian (Tahap 4) -- semua diverifikasi lewat panggilan
`*WithDb`/query langsung dengan bukti database, bukan cuma pembacaan
kode. Tiga temuan proaktif tercatat di sepanjang jalan (confirmDayCutoff,
resetPin/unlockEmployee, pairDevice) plus dua yang lebih dulu
(setBarangStatusWithDb, addBarangFromShiftWithDb). Dua utang dicatat
eksplisit untuk pekerjaan terpisah nanti, TIDAK dikerjakan sekarang:
utang perilaku stok cancel (di atas) dan tinjauan
`isOutletAllowed`-sebagai-boolean-yang-bisa-diabaikan (dicatat §27).

## §29 · Pembatasan akses per outlet — Tahap 5: RLS level database, `orders` (13 September 2026)

Tahap paling berbahaya dari seluruh pekerjaan ini (kata CEO) -- gerbang
sekarang dipindah dari app layer (Tahap 1-4, bisa dilewati kalau ada
jalur baru yang lupa memanggilnya) ke **database itu sendiri** lewat
Row Level Security. Dibangun SATU tabel (`orders`), rancangan
dilaporkan dan disetujui CEO dulu sebelum satu baris migrasi pun ditulis.

### `auth_outlet_ids(business_id)` — BARU, `auth_business_ids()` TIDAK disentuh

```sql
CREATE OR REPLACE FUNCTION auth_outlet_ids(p_business_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN m.role IN ('owner', 'accountant') THEN NULL
      ELSE m.outlet_ids
    END
  FROM memberships m
  WHERE m.user_id = auth.uid()
    AND m.business_id = p_business_id
    AND m.is_active = true
  LIMIT 1
$$;
```

**Kenapa berparameter `business_id`, BEDA dari `auth_business_ids()`
yang tanpa argumen**: seorang user bisa punya membership di lebih dari
satu bisnis (constraint `memberships` cuma unique per
`(business_id, user_id)`, skema TIDAK melarangnya walau belum ada UI
ganti-bisnis) dengan role/`outlet_ids` BEDA di tiap bisnis. Fungsi
tanpa konteks bisnis tidak bisa tahu NULL (unrestricted) itu milik
membership yang mana -- bisa menembus ke bisnis lain tempat user itu
justru dibatasi. Dipanggil selalu dengan kolom baris itu sendiri:
`auth_outlet_ids(orders.business_id)`.

### Kondisi policy — guard `IS NULL OR` di depan

```sql
USING (
  orders.business_id = any(auth_business_ids())
  AND (
    auth_outlet_ids(orders.business_id) IS NULL
    OR orders.outlet_id = any(auth_outlet_ids(orders.business_id))
  )
)
```

Dipasang identik untuk `orders_select`, `orders_insert` (`WITH CHECK`),
`orders_update` (`USING` DAN `WITH CHECK`). `x = any(NULL)` di Postgres
adalah NULL -- diperlakukan TOLAK di `USING`/`WITH CHECK`, BUKAN
"semua diizinkan" seperti maksudnya di app layer. Tanpa guard
`IS NULL OR` di depan, owner/akuntan akan kehilangan SEMUA baris
`orders` tanpa galat apa pun begitu policy dipasang -- persis jebakan
yang diminta CEO dibuktikan sudah dipikirkan. Array KOSONG
(`outlet_ids = '{}'`) tidak butuh guard tambahan -- `x = any('{}')`
sudah terdefinisi FALSE (bukan NULL) di Postgres, otomatis menolak
semua baris, konsisten dengan `outletScopeCondition()` kind "none" di
app layer.

Migrasi: `0033_rls_outlet_ids_orders.sql` (pos-fnb).

### Kill-switch — disiapkan dan DIVERIFIKASI SEBELUM migrasi maju dipasang

`scripts/rls-rollback-orders.sql` (pos-fnb, bukan di plan doc ini --
orang yang panik tidak akan membuka dokumen perencanaan): revert tiga
policy `orders` persis ke kondisi business-only sebelum Tahap 5.
Dijalankan lewat Supabase SQL Editor (service role, BYPASSRLS) -- tidak
butuh akses dashboard aplikasi sama sekali, karena `service_role` di
Supabase tidak pernah tunduk RLS apa pun.

Diverifikasi SUNGGUHAN JALAN di database dev, DUA KALI: sekali sebelum
migrasi maju (no-op, membuktikan sintaks & privilese benar) dan sekali
lagi SETELAH migrasi maju dipasang (membuktikan revert benar-benar
mengembalikan teks policy persis ke baseline business-only) -- bukan
ditulis lalu diasumsikan benar.

### Sinkronisasi TS <-> SQL — tes PERILAKU, bukan cocok-teks

`UNRESTRICTED_OUTLET_ROLES` (TS) dan CASE di `auth_outlet_ids()` (SQL)
adalah dua tempat, satu aturan. Bukan dites dengan parse source SQL
lalu dibandingkan ke array TS (rapuh) -- untuk **setiap** role di
`userRoleEnum` (7 nilai ASLI dari database), tes men-set membership
sungguhan, memanggil `auth_outlet_ids()` LANGSUNG lewat sesi user itu,
dan membandingkan ke `computeAllowedOutletIds()` (TS) dengan input
sama. 23 tes (7 role x 3 bentuk `outlet_ids`: null/spesifik/kosong) --
kalau salah satu sisi diubah tanpa yang lain, test case role itu gagal
duluan, tidak menunggu insiden produksi.

### Bukti lima skenario + temuan empiris `order_items`

10 tes lewat koneksi RLS SUNGGUHAN (`getUserDb`, BUKAN `getAdminDb()`
untuk operasi yang diuji):
1. Owner -- lihat orders semua outlet.
2. Accountant -- sama, walau `outlet_ids` kolomnya sendiri tidak pernah
   diisi (NULL dipaksa dari ROLE, bukan kebetulan datanya NULL).
3. Manajer dibatasi outlet A -- lihat outlet A, NOL baris outlet B.
4. Membership `outlet_ids` KOSONG -- nol baris sama sekali.
5. INSERT/UPDATE ke outlet terlarang -- DITOLAK DATABASE. INSERT
   melempar (`violates row-level security policy`); UPDATE menyaring
   baris (0 baris ter-`returning()`, bukan galat) -- baris DIBUKTIKAN
   tidak berubah lewat pembacaan admin sesudahnya.

**Temuan empiris (dilaporkan, bukan dipercaya dari teori)**:
`order_items` policy-nya cuma `EXISTS (SELECT 1 FROM orders WHERE ...
business_id = any(auth_business_ids()))` -- TIDAK cek outlet sendiri.
Diuji langsung: manajer outlet A SELECT `order_items` milik order
outlet B -- **NOL baris**, TERWARISI OTOMATIS. RLS Postgres menegakkan
ulang policy `orders_select` di dalam `EXISTS` itu (bukan
`SECURITY DEFINER` yang bypass), jadi begitu `orders_select`
diperketat outlet, `order_items` ikut ketat tanpa kode tambahan.
**Bukan bug, bukan utang baru** -- dicatat di sini supaya orang
berikutnya tidak mengira ini butuh perbaikan terpisah kalau
`shifts`/barang nanti disentuh dengan pola serupa.

### Regresi bagi hasil BTHR — dijalankan ulang APA ADANYA

`bagi-hasil-outlet-scope.test.ts` (Tahap 3, sudah ada, `db` di situ
sudah RLS sungguhan lewat `createUserDbFixture`) -- bagian pemilik
Salma outlet BTHR = 60000, dilihat owner, dijalankan ulang tanpa
diubah SATU BARIS PUN sesudah policy baru dipasang. **Tetap 60000** --
policy baru tidak memotong baris owner diam-diam.

### UTANG BARU — dicatat, TIDAK dikerjakan sekarang

`search_path` belum di-set eksplisit untuk `auth_business_ids()`
MAUPUN `auth_outlet_ids()` (keduanya `SECURITY DEFINER` tanpa
hardening `search_path`) -- kalau ini mau dikeraskan, itu perubahan
untuk KEDUA fungsi SEKALIGUS (konsistensi), bukan cuma yang baru,
diputuskan CEO untuk ditunda.

### Cakupan — berhenti setelah `orders`

`shifts` dan tabel barang **belum disentuh** -- instruksi eksplisit
CEO. Commit pos-fnb: `8888169` (kill-switch), `e36fd01` (migrasi +
schema + dua file tes). Push ke origin (`badarbaradja/pos-fnb`)
dilakukan SEBELUM migrasi dipasang (71 commit sebelumnya belum pernah
ter-cadangkan di mesin manapun selain lokal -- risiko yang tidak perlu
persis di tahap paling mungkin butuh mundur ke commit sebelumnya).

## §30 · Pembatasan akses per outlet — Tahap 5: RLS level database, `shifts` (13 September 2026)

Lanjutan §29, tabel KEDUA (dan TERAKHIR untuk Tahap 5 -- CEO instruksi
eksplisit berhenti sebelum barang). `auth_outlet_ids(business_id)`
DIPAKAI ULANG APA ADANYA (migrasi 0033) -- **tidak ada fungsi SQL baru**
di migrasi 0034. Tiga policy `shifts` (select/insert/update) dapat AND
kondisi outlet persis sama bentuknya dengan `orders` (§29), guard
`IS NULL OR` di depan.

### Temuan WAJIB dilaporkan SEBELUM policy dipasang — jalur PIN+shift

CEO eksplisit meminta: kalau jalur PIN+shift lewat `authenticated`,
laporkan dulu sebelum memasang policy. Ditelusuri lewat pembacaan
kode (bukan tebakan):

1. **Verifikasi PIN** (`verifyCashierPin()`, `lib/auth/pin.ts`) --
   `createSupabaseAdminClient()`, **service_role, BYPASSRLS**. Tidak
   tersentuh sama sekali oleh policy `shifts`.
2. **Penulisan `shifts` sendiri** (`openShiftWithDb` dst,
   `app/(pos)/pos/shift/actions.ts`) -- `requirePermissionDb()` ->
   `getUserDb(accessToken)`, **role `authenticated`, RLS BENAR-BENAR
   berlaku** -- dari sesi Supabase Auth SIAPA PUN YANG SEDANG LOGIN DI
   BROWSER TABLET POS. `employees` (identitas PIN) **TIDAK wajib**
   punya akun Supabase Auth sama sekali (BLUEPRINT §3.1) -- jadi
   `auth_outlet_ids()` yang menggerbang `shifts` dibaca dari membership
   TABLET, BUKAN dari kasir yang sedang PIN.

**Akibatnya, dan ini kelas risiko yang beda dari `orders`**: kalau
akun yang login di tablet itu dibatasi (`manager`/`cashier`) dan
`outlet_ids`-nya tidak memuat outlet tablet itu sendiri, **SEMUA**
kasir yang PIN di tablet itu gagal buka/tutup shift -- bukan satu
laporan kosong, **seluruh outlet berhenti berjualan** lewat tablet
itu. Risiko hari ini NOL (data dev masih semua membership `owner`,
`outlet_ids` null, temuan Tahap 4). **Keputusan CEO: lanjut bangun,
dicatat sebagai SYARAT PELUNCURAN** (pola sama gudang-wajib-ada-di-
outlet_ids, Stock Transfers §28) -- siapa pun yang menyiapkan akun
untuk login di tablet POS produksi harus memastikan `outlet_ids`-nya
mencakup outlet tablet itu, atau memakai akun unrestricted.

**Temuan tambahan, dicatat sebagai utang (di luar lingkup RLS, TIDAK
diperbaiki di sini)**: dari 9 fungsi tulis di `lib/pos/shift.ts`, 8
membungkus SEMUA error jadi pesan generik `"Terjadi kesalahan, coba
lagi"` (aman tapi tidak diagnostik -- kasir tidak akan tahu ini soal
`outlet_ids`). **`closeAndReopenShiftWithDb` satu-satunya
pengecualian** -- meneruskan `err.message` MENTAH ke pengguna. Kalau
RLS ini pernah menolak jalur itu, teks error Postgres asli ("new row
violates row-level security policy...") bisa tampil di layar kasir.
Perilaku LAMA (bukan diperkenalkan Tahap 5), tapi Tahap 5 pemicu
pertama yang bisa membuatnya sungguh terjadi.

### Kill-switch — pola sama `orders`, diverifikasi dua kali

`scripts/rls-rollback-shifts.sql` -- revert tiga policy `shifts` ke
business-only. `cash_movements` TIDAK perlu disentuh terpisah di file
ini -- policy-nya (EXISTS ke `shifts`) pulih otomatis begitu
`shifts_select` kembali business-only. Diverifikasi jalan sungguhan
di dev, sebelum DAN sesudah migrasi maju dipasang.

### Bukti lima skenario + temuan empiris `cash_movements`

10 tes lewat koneksi RLS SUNGGUHAN:
1-4. Sama persis pola `orders`: owner dan akuntan lihat shift semua
outlet, manajer dibatasi outlet A lihat cuma outlet A, `outlet_ids`
kosong nol baris.
5. **INSERT diuji lewat `openShiftWithDb` SUNGGUHAN** (bukan raw
   insert, supaya jalur produksi asli yang terbukti) -- manajer A
   (login tablet-nya cuma outlet A) coba buka shift baru di outlet B:
   **DITOLAK**, dan pesan generik yang dikembalikan terbukti EMPIRIS
   (bukan cuma dibaca dari kode) -- error RLS asli muncul di
   `console.error` SERVER, TIDAK PERNAH sampai ke pengguna. Manajer A
   buka shift baru di outlet A sendiri (device beda): BERHASIL. UPDATE
   langsung ke shift outlet B: nol baris berubah.

**Temuan empiris**: `cash_movements` (policy-nya EXISTS ke `shifts`,
cuma cek `business_id`) -- diuji langsung, manajer A SELECT
`cash_movements` outlet B: **NOL baris, TERWARISI OTOMATIS**, sama
persis pola `order_items` di §29. Bukan bug, bukan utang baru.

### Regresi — dijalankan ulang APA ADANYA

`shift.test.ts` (27 tes: buka shift, tutup shift, tutup-buka satu
langkah §14, force-close manajer, reconcile, WRITE-ONCE counted_cash)
dan `shift-outlet-scope.test.ts` (7 tes, Tahap 3 app-layer). **Semua
hijau, tidak ada yang diakali.**

### Cakupan — berhenti setelah `shifts`

Barang **belum disentuh**. Commit pos-fnb: `8c14df8` (kill-switch),
`fe2e70b` (migrasi + schema + tes). Push ke origin dilakukan sebelum
migrasi 0034 dipasang (kelanjutan dari kebiasaan backup §29).

## §31 · Pembatasan akses per outlet — Tahap 5: RLS level database, `barang` (13 September 2026) — TAHAP 5 TUTUP

Tabel KETIGA dan TERAKHIR Tahap 5. `auth_outlet_ids(business_id)`
DIPAKAI ULANG APA ADANYA (migrasi 0033) -- tidak ada fungsi SQL baru
di migrasi 0035. Tiga policy `barang` (select/insert/update) dapat AND
kondisi outlet persis sama bentuknya dengan `orders` dan `shifts`.

### Temuan WAJIB dilaporkan SEBELUM policy dipasang — "Ita super kasir"

`addBarangFromShiftWithDb` (`lib/pos/pos-add-barang.ts`) menulis lewat
`requirePermissionDb()` -> `getUserDb(accessToken)` -- **sama kelas
risiko dengan `shifts`**: identitas RLS yang berlaku adalah akun yang
login di tablet POS, BUKAN Ita yang PIN. Kalau akun tablet dibatasi
dan `outlet_ids`-nya tidak memuat outlet shift itu sendiri, SEMUA
kasir gagal menambah barang dari kasir langsung. **Keputusan CEO:
lanjut bangun, dicatat sebagai SYARAT PELUNCURAN** (pola sama
shifts/gudang) -- akun yang login di tablet POS produksi harus
mencakup outlet tablet itu di `outlet_ids`-nya, atau memakai akun
unrestricted.

### Koreksi terhadap dugaan awal — ditemukan SAAT MENULIS TES, bukan diasumsikan lalu dibiarkan

Dugaan sebelum menulis kode: `saveBarangWithDb` jalur CREATE tidak
membungkus error jadi pesan generik (beda dari `shift.ts`), jadi kalau
RLS menolak, `addBarangFromShiftWithDb` akan MELEMPAR mentah.
**Terbukti salah saat tes dijalankan** -- hasil sungguhan adalah
`{error: "Terjadi kesalahan, coba lagi"}`, GRACEFUL, bukan lemparan.
Ditelusuri kenapa: baris PERTAMA `addBarangFromShiftWithDb` melakukan
`SELECT` ke `shifts` (`innerJoin` ke `employees`) untuk membaca shift
yang dimaksud -- SELECT ini SUDAH digerbang `shifts_select`
outlet-aware (§30, dipasang LEBIH DULU dari `barang`). Manajer yang
tidak berwenang di outlet shift itu GAGAL DI SITU (shift tidak
ketemu, `{error: unexpectedError}`, graceful) -- **tidak pernah
sampai ke `db.insert(barang)` sama sekali**.

Diverifikasi secara terpisah (raw INSERT langsung ke `barang`, BUKAN
lewat `addBarangFromShiftWithDb`) bahwa policy `barang_insert` MEMANG
melempar kalau benar-benar tercapai -- jadi celah try/catch di
`saveBarangWithDb` tetap NYATA secara struktural (utang, dicatat di
bawah), cuma TIDAK TERAKTIFKAN lewat pemanggil yang ada sekarang,
karena lapisan `shifts` yang dipasang lebih dulu menutupnya secara
transitif. Pelajaran yang dicatat eksplisit: **urutan pemasangan RLS
antar tabel yang saling berhubungan bisa mengubah PERILAKU kegagalan
tabel berikutnya** -- dugaan yang benar untuk `barang` sendirian bisa
salah begitu `shifts` sudah lebih dulu digerbang.

### Kill-switch — pola sama `orders`/`shifts`, diverifikasi dua kali

`scripts/rls-rollback-barang.sql` -- revert tiga policy `barang` ke
business-only, termasuk catatan eksplisit soal risiko "Ita super
kasir" di kepala file. Diverifikasi jalan sungguhan di dev, sebelum
DAN sesudah migrasi maju dipasang.

### Bukti lima skenario + temuan empiris `order_items`

11 tes lewat koneksi RLS SUNGGUHAN:
1-4. Sama persis pola `orders`/`shifts`: owner dan akuntan lihat
barang semua outlet, manajer dibatasi outlet A lihat cuma outlet A,
`outlet_ids` kosong nol baris.
5. `addBarangFromShiftWithDb` SUNGGUHAN: manajer A coba tambah barang
   dari shift outlet B -- DITOLAK (lewat gerbang `shifts`, dibuktikan
   di atas), tambah barang dari shift outlet A sendiri BERHASIL,
   UPDATE langsung ke barang outlet B nol baris berubah, DAN raw
   INSERT langsung (bukan lewat fungsi aplikasi) MELEMPAR --
   membuktikan `barang_insert` sendiri memang menolak.

**Temuan empiris `order_items`**: `order_items` punya `barangId`
menunjuk `barang`, TAPI policy-nya (`EXISTS` ke `orders` saja) TIDAK
PERNAH merujuk `barang` sama sekali. Diuji dengan kombinasi sengaja
janggal -- order_item yang `barangId`-nya menunjuk barang OUTLET B
(di luar cakupan manajer A) tapi order-nya sendiri di OUTLET A (dalam
cakupan) -- **order_item ini TETAP UTUH terlihat**, `barangId`-nya pun
tetap terbaca walau baris `barang` yang dirujuk sendiri tidak bisa
diakses langsung oleh manajer A. **`order_items` sepenuhnya
independen dari RLS `barang`.** Konsisten dengan `bagi-hasil-
report.ts` yang TIDAK PERNAH JOIN `order_items` ke `barang` untuk
`bagianPemilik` -- kolom `pemilikShareAmount` dkk sudah snapshot sejak
transaksi terjadi.

### Regresi WAJIB — dijalankan ulang APA ADANYA

`bagi-hasil-outlet-scope.test.ts`: **bagianPemilik Salma outlet BTHR
TETAP 60000** -- tabel paling dekat dengan uang pemilik titipan, tidak
terpotong diam-diam. `barang-list-outlet-scope.test.ts` (termasuk
bagian halaman cetak label akses by-id), `code128.test.ts`,
`barcode-canvas.test.ts`, `pos-add-barang-outlet-scope.test.ts`
(Tahap 4, app-layer), `barang/manage.test.ts` (Tahap 4). **Semua
hijau, tidak ada yang diakali.**

### Utang dikumpulkan — dikerjakan setelah Tahap 6, sekalian

Tiga akar penyebab berbeda, sengaja DIKUMPULKAN jadi satu putaran
perbaikan nanti (bukan dikerjakan sekarang, bukan dilupakan):
1. `search_path` belum di-set eksplisit untuk `auth_business_ids()`
   MAUPUN `auth_outlet_ids()` (§29).
2. `closeAndReopenShiftWithDb` meneruskan `err.message` MENTAH ke
   pengguna, beda dari 8 fungsi lain di `shift.ts` yang pakai pesan
   generik (§30).
3. `saveBarangWithDb` jalur CREATE tidak membungkus error RLS jadi
   pesan generik (beda dari pola `shift.ts`) -- saat ini tidak
   teraktifkan lewat `addBarangFromShiftWithDb` (ditutup transitif
   oleh gerbang `shifts`), TAPI tetap nyata secara struktural untuk
   pemanggil `saveBarangWithDb` lain mana pun di masa depan.

### TAHAP 5 TUTUP

Tiga tabel selesai: `orders` (§29), `shifts` (§30), `barang` (§31).
Pola yang konsisten di ketiganya: rancangan dilaporkan dan disetujui
CEO SEBELUM satu baris migrasi pun ditulis, kill-switch disiapkan dan
diverifikasi jalan sungguhan DUA KALI (sebelum dan sesudah migrasi
maju) sebelum migrasi dipasang, lima skenario RLS lewat koneksi
sungguhan (bukan admin bypass), tabel turunan dibuktikan EMPIRIS
(bukan dipercaya dari teori) -- `order_items` (dua kali, terhadap
`orders` dan terhadap `barang`), `cash_movements`. Semua regresi
wajib (termasuk yang paling dekat dengan uang pemilik titipan)
dijalankan ulang apa adanya, tidak ada yang diakali. Push ke origin
sebelum setiap migrasi maju dipasang.

Commit pos-fnb: `a040281` (kill-switch), `906ed99` (migrasi + schema +
tes, TAHAP 5 TUTUP).

## §32 · Tahap 6 — sambungan shift-membership: DILEWATI, dicatat sebagai UTANG TERIKAT PEMICU (13 September 2026)

**Keputusan CEO: Tahap 6 TIDAK dibangun sekarang.** Ini BUKAN
kelalaian atau lupa dikerjakan -- rancangannya sudah dianalisis penuh
(empat pertanyaan CEO dijawab lebih dulu, lihat di bawah), dan
keputusan melewatinya diambil SADAR berdasarkan bukti, bukan
diasumsikan.

### Kenapa dilewati

1. **Nol akun terlindungi hari ini.** `employees.userId` (kolom
   "optional link ke akun" di skema) terisi di **0 dari 8** baris
   `employees` di database dev, dicek langsung lewat query, bukan
   ditebak.
2. **Bukan "belum banyak dipakai" -- kolom DORMAN tanpa pintu masuk.**
   Ditelusuri SELURUH jalur tulis ke tabel `employees`
   (`lib/employees/manage.ts`, satu-satunya modul yang menulis ke
   tabel ini): **tidak ada satu form, Server Action, atau baris kode
   pun di seluruh aplikasi yang pernah mengisi `employees.userId`**.
   Dua pemakaian yang ADA (`kasir-shortcut.ts` untuk tombol "Buka
   Kasir", `void-refund.ts` untuk atribusi void/refund) cuma MEMBACA
   kolom ini, keduanya eksplisit didokumentasikan BUKAN lapisan
   otorisasi. Satu-satunya cara kolom ini pernah terisi adalah
   intervensi SQL manual.
3. **Risiko tidak simetris.** Tahap 6 salah pasang = kasir tidak bisa
   buka shift, outlet berhenti berjualan (kelas risiko sama dengan
   temuan akun tablet §30). Tahap 6 tidak dibangun = kehilangan
   perlindungan terhadap skenario yang PRASYARAT-nya sendiri (mengisi
   `employees.userId`) butuh SQL manual lebih dulu -- tidak bisa
   dipicu lewat aplikasi manapun hari ini. Ongkos membangun sekarang
   (risiko nyata: kasir terkunci) lebih besar dari manfaat sekarang
   (menutup celah yang belum bisa dieksploitasi).

### Analisis yang tetap berlaku (jangan diulang dari nol nanti)

**Celahnya NYATA secara struktural**, bukan argumen kosong: RLS
Postgres cuma tahu `auth.uid()` (sesi yang login), **RLS tidak bisa
tahu PIN siapa yang dimasukkan di form** -- itu murni data aplikasi.
Skenario yang tidak tertutup dua lapisan sebelumnya: tablet login
sebagai **owner** (unrestricted, wajar -- biasanya owner yang setup
tablet), lalu seorang MANAJER yang membership pribadinya dibatasi ke
outlet lain berjalan ke tablet itu dan PIN masuk membuka shift di
outlet yang bukan wewenangnya. Tahap 5 tidak menangkap ini (akun
tablet = owner = lolos RLS). Tahap 4 tidak menangkap ini (tidak
menyentuh `openShiftWithDb`). Cuma bisa ditutup oleh query
`employees.userId -> memberships` DI DALAM `openShiftWithDb` sendiri
-- app-layer, BUKAN RLS (RLS tidak punya akses ke `employeeId` yang
dikirim lewat PIN, cuma ke `auth.uid()` sesi).

**Rancangan siap pakai, tinggal diimplementasikan kalau pemicu di bawah terjadi:**
- Di dalam `openShiftWithDb` (`lib/pos/shift.ts`), setelah PIN
  terverifikasi (`identity.employeeId` didapat): `SELECT
  memberships.outlet_ids, memberships.role FROM employees JOIN
  memberships ON memberships.user_id = employees.user_id AND
  memberships.business_id = employees.business_id WHERE
  employees.id = identity.employeeId AND employees.user_id IS NOT
  NULL AND memberships.is_active = true`.
- **`employees.userId` NULL -> DILEWATKAN** (bukan ditolak) --
  konsisten dengan prinsip inti proyek "pegawai TIDAK harus punya
  akun auth" (BLUEPRINT §3.1). Menolak NULL akan mengunci SEMUA
  kasir PIN-murni (100% hari ini) dari buka shift sama sekali --
  regresi jauh lebih besar dari celah yang mau ditutup. NULL bukan
  berarti "tidak ada gerbang" -- dua lapisan lain (Tahap 4 app-layer,
  Tahap 5 RLS akun tablet) tetap berlaku penuh terlepas dari kolom
  ini.
- Kalau ketemu membership DAN `computeAllowedOutletIds(role,
  outlet_ids)` bukan null DAN `shift.outletId` tidak ada di
  dalamnya -> tolak buka shift dengan `strings.common
  .outletAccessDenied`, pola sama seluruh Tahap 4.
- **Bukan RLS, jadi bukan kill-switch `.sql`.** Pemulihan kalau salah
  pasang dan mengunci kasir: revert deploy (kode biasa), ATAU --
  lebih presisi, tanpa redeploy -- `UPDATE employees SET user_id =
  NULL WHERE id = '...'` lewat service role untuk melepas SATU
  karyawan yang salah kena, tanpa menyentuh siapa pun yang lain.
  Blast radius jauh lebih kecil dari kill-switch RLS Tahap 5.

### PEMICU — WAJIB dibaca sebelum melangkah, bukan sesudah

**Siapa pun yang membangun jalur pengisian `employees.userId` (form
"tautkan ke akun", impor massal, fitur undang karyawan yang
otomatis menaut ke membership, atau apa pun yang membuat kolom ini
punya nilai lewat aplikasi untuk PERTAMA KALINYA) WAJIB kembali ke
§32 ini dan mengimplementasikan pemeriksaan di atas SEBELUM fitur
itu diluncurkan ke produksi -- bukan sesudah.** Begitu ada jalur
pengisian, poin 1-2 di atas (nol akun, kolom dorman) tidak lagi
benar, dan celah yang dianalisis di atas jadi bisa dieksploitasi
sungguhan.

## §33 · Pembersihan utang terkumpul dari Tahap 5 (13 September 2026)

Tiga utang yang dikumpulkan sengaja selama Tahap 5 (§29-31) dikerjakan
sekaligus satu putaran, SETELAH Tahap 5/6 tutup -- bukan dicicil di
tengah pekerjaan RLS supaya tidak merusak dua hal sekaligus (prinsip
yang sama dipakai berulang sepanjang proyek ini).

### 1. `search_path` untuk `auth_business_ids()` DAN `auth_outlet_ids()`

Yang PALING berisiko dari ketiganya -- `auth_business_ids()` adalah
dasar SETIAP policy RLS di 30+ tabel sejak migrasi 0000, bukan cuma
satu tabel. Kill-switch (`scripts/rls-rollback-search-path.sql`)
disiapkan dan diverifikasi jalan sungguhan DUA KALI (sebelum dan
sesudah migrasi maju) mengikuti pola persis Tahap 5, sebelum migrasi
`0036_search_path_auth_functions.sql` dipasang.

`SET search_path = public` dipilih (BUKAN search_path kosong) supaya
body KEDUA fungsi tidak perlu diubah sama sekali -- referensi
`memberships` tanpa skema tetap resolve persis seperti sebelumnya.
Perubahan sekecil mungkin untuk fungsi yang jadi fondasi hampir
seluruh RLS proyek ini.

Diverifikasi lewat FULL SUITE (576 tes, 62 file) setelah migrasi
dipasang -- termasuk 23 tes sinkronisasi TS/SQL lintas 7 role
(`auth-outlet-ids-sync.test.ts`) dan seluruh tes RLS `orders`/
`shifts`/`barang` (§29-31) -- membuktikan perilaku KEDUA fungsi identik,
cuma search_path yang berubah. Commit: `9b1327f` (kill-switch),
`7dd97ea` (migrasi).

### 2. `closeAndReopenShiftWithDb` meneruskan `err.message` mentah

Satu-satunya dari 9 fungsi tulis di `lib/pos/shift.ts` yang tidak
memakai pesan generik seperti 8 lainnya. Race "shift lama sudah
ditutup pihak lain" (satu-satunya `throw` custom di file ini, dulu
ditangkap balik oleh catch-all yang sama) dipindah dari pola
throw+catch jadi flag `raceLost` yang dicek SETELAH transaksi selesai
-- pesan spesifiknya (`alreadyClosedError`) tetap sampai ke pengguna
tanpa perlu catch-all membedakan jenis error lagi, jadi catch-all
sekarang SELALU pesan generik seperti 8 fungsi lain.

Diverifikasi: seluruh 27 tes `shift.test.ts` (termasuk empat skenario
`closeAndReopenShiftWithDb`: selisih kecil/besar, PIN salah, outlet
cashless) tetap hijau tanpa perubahan apa pun ke tes-nya. Commit:
`b1bad8d`.

### 3. `saveBarangWithDb` jalur CREATE tidak membungkus error

`throw err` mentah di jalur non-unique-violation diganti pesan
generik, pola sama fungsi lain. HANYA jalur CREATE yang diubah --
`assertRowsAffected` di jalur UPDATE SENGAJA tetap melempar mentah
(bug struktural, bukan penolakan akses yang sah, beda kelas masalah,
lihat komentar `assertRowsAffected` di `lib/db/errors.ts`).

Diverifikasi: `barang/manage.test.ts` (10 tes), `pos-add-barang-
outlet-scope.test.ts` (3 tes), `rls-barang-outlet-scope.test.ts` (11
tes, termasuk raw INSERT yang membuktikan `barang_insert` sendiri
tetap melempar di level RLS) semua tetap hijau. Commit: `359835e`.

### Verifikasi menyeluruh, satu putaran

Full suite (576 tes, 62 file) dan `npm run build` dijalankan ULANG
setelah ketiga perbaikan digabung (bukan cuma per-perbaikan) -- semua
hijau, build bersih. Kedua repo (`pos-fnb`, `reportkoperumnasgroup`)
dikonfirmasi bersih dan ter-push ke origin.

---

## PEMBATASAN AKSES PER OUTLET — SELESAI (Tahap 0-5)

Tahap 0 (kelola membership) -- Tahap 1 (fondasi `allowedOutletIds`) --
Tahap 2 (utilitas filter+assert) -- Tahap 3 (enam halaman baca) --
Tahap 4 (lima jalur tulis app-layer, termasuk tiga temuan proaktif) --
Tahap 5 (RLS level database: `orders`, `shifts`, `barang`). Tahap 6
dilewati sadar, dicatat sebagai utang terikat pemicu di atas. Tiga
utang terkumpul dari Tahap 5 dibersihkan satu putaran di §33 --
`search_path` kedua fungsi RLS, `closeAndReopenShiftWithDb`, dan
`saveBarangWithDb`.

---

## §34 · Kesiapan sisi F&B (Indosteak & Indokopi) — investigasi + lima bukti ujung-ke-ujung (13 September 2026)

Rencana peluncuran CEO: Ita/thrifting dulu (matang) -> Indosteak ->
Indokopi. Investigasi menyeluruh (bukan dugaan) sebelum satu baris
kode pun dibangun untuk sisi F&B.

### Koreksi terhadap dugaan awal CEO — EMPAT dari LIMA sudah ada

CEO menduga modifier, varian, dine-in vs takeaway, dan tunai+kembalian
belum ada di sistem (dianggap "khas F&B" yang belum pernah disentuh
karena thrifting tidak butuh semuanya). **Keempatnya SUDAH ADA**,
dikonfirmasi lewat pembacaan kode dan (setelah investigasi awal) lewat
pembayaran sungguhan (lihat bukti di bawah):
- Modifier: skema+kode ada sejak Fase 1, matematikanya teruji ketat di
  `order-calculator.test.ts`.
- Varian: `product_prices.variant_id` + `product_variants.price_delta`
  ada sejak Fase 1.
- Dine-in vs takeaway: sudah JALAN lewat `price_tiers`+`channel`
  (DINEIN/TAKEAWAY/GOFOOD/MEMBER sudah ter-seed), `orders.channel`
  otomatis mengikuti tier yang dipilih kasir.
- Tunai+kembalian: `payments.change_amount` + perhitungan di
  `pay-order.ts` sudah ada sejak T13.

Satu dugaan yang **benar**: pajak & service charge (thrifting 0%) --
dikonfirmasi persis, tapi dengan catatan: `service_charge_percent`
saat ini **0% di SEMUA outlet produksi**, termasuk Indosteak/Indokopi
-- kalkulatornya siap, datanya belum diisi.

### PENGHALANG PELUNCURAN (bukan "data belum diisi" biasa) — pemisahan katalog per brand

**`product_outlets` = 0 baris. `products.brand_id` = 100% NULL.**
Aturan sistem: produk TANPA baris `product_outlets` = tersedia di
SEMUA outlet (default). Artinya **hari ini, kalau Indosteak dibuka
apa adanya, kasirnya akan melihat menu kopi/boba Indokopi (dan
sebaliknya)** -- 25 produk yang ada di database adalah menu kafe
generik demo, nol di antaranya menu Indosteak/Indokopi sungguhan, dan
mekanisme yang SUDAH ADA untuk memisahkannya (`product_outlets`
whitelist per outlet, `brands` untuk label) **belum dipakai sama
sekali**.

**Ini PENGHALANG PELUNCURAN untuk Indosteak, bukan catatan biasa** --
mengisi katalog+kategori+modifier Indosteak sungguhan DAN mengisi
`product_outlets`/`brand_id` yang sesuai WAJIB selesai sebelum outlet
pertama buka, atau kasir hari pertama menjual menu yang salah total.
Ini pekerjaan DATA (CEO yang isi), bukan pekerjaan kode -- mekanismenya
sudah ada dan terbukti benar (T22a).

### Lima jalur ujung-ke-ujung dibuktikan lewat pembayaran sungguhan (nol kode produksi baru)

Sebelumnya cuma teruji sebagai matematika murni (`order-calculator.test.ts`)
atau tidak teruji sama sekali lewat `payOrderWithDb` yang sungguh
menulis ke database. File baru `src/lib/pos/__tests__/pay-order-fnb-
integration.test.ts` (pos-fnb) membuktikan KELIMANYA, memakai
`calculateOrder()` sebagai ORACLE (input yang sama persis yang
dibangun `payOrderWithDb` secara internal) dibandingkan ke angka yang
BENAR-BENAR tersimpan di database, di outlet bergaya Indosteak/
Indokopi (pajak 10%, service charge 5% -- sengaja diisi di fixture
tes, bukan 0% seperti data produksi hari ini):

1. **Modifier berharga > 0** -- harga modifier masuk ke `grossAmount`/
   `netAmount`, tersimpan di `order_items`+`order_item_modifiers`, dan
   `getSalesByProduct` (laporan penjualan) menghitungnya benar.
2. **Varian (variantId non-null)** -- `unitPrice` yang tersimpan =
   harga dasar + `priceDelta` varian (bukan harga dasar polos) --
   dibuktikan angka eksplisit (20000+8000=28000), bukan cuma "lebih
   besar dari 0".
3. **Pajak > 0 ujung-ke-ujung** -- `taxAmount`/`total` yang tersimpan
   cocok PERSIS dengan `calculateOrder()` (bukan didekati/dibulatkan
   beda).
4. **Split payment** (dua metode bayar, QRIS+tunai, satu order) --
   **DIDUKUNG PENUH**, kedua baris `payments` tersimpan benar, jumlah
   keduanya menutupi total. **Catatan desain yang ditemukan, bukan
   bug**: kembalian dilekatkan ke pembayaran TERAKHIR di array yang
   dikirim klien, bukan ke pembayaran yang metodenya tunai -- kalau UI
   nanti mengirim urutan QRIS-setelah-tunai, kembalian akan salah
   nempel ke QRIS. UI wajib selalu mengirim tunai TERAKHIR kalau ada
   kembalian. Dicatat di sini supaya diperhatikan saat membangun layar
   split payment, BUKAN tugas coding sekarang.
5. **Service charge > 0 ujung-ke-ujung** (usul CEO, kelas sama poin 3)
   -- `serviceCharge` yang tersimpan cocok persis dengan oracle, DAN
   dibuktikan `serviceChargeInTaxBase=true` benar-benar mengubah
   `taxAmount` (bukan setting yang diam/tidak berpengaruh).

**Kelima jalur LULUS tanpa satu pun kegagalan** -- tidak ada yang perlu
diperbaiki, tidak ada temuan yang mengharuskan berhenti. Kesimpulan:
backend F&B (modifier, varian, pajak, split payment, service charge)
**siap dipakai apa adanya** untuk Indosteak/Indokopi, dengan satu
catatan desain (poin 4 di atas) untuk diperhatikan saat UI-nya
dibangun nanti.

### HPP nol -- angka laba TIDAK BOLEH dipakai mengambil keputusan (dicatat, TIDAK diperbaiki)

Dikonfirmasi §34 sejalan dengan §01-TASK-BOARD Fase 2: `pay-order.ts`
hardcode `unitCogs`/`cogsTotal` = `"0"` untuk SETIAP order F&B (skema
resep/bahan belum ada). **Implikasinya eksplisit, bukan cuma "belum
akurat"**: `grossProfit` yang tersimpan = `netSales` PENUH --
**margin/laba kotor per produk terbaca 100% di SEMUA produk F&B**,
angka yang secara harfiah salah kalau dipakai untuk keputusan harga
atau evaluasi produk mana yang menguntungkan. **Angka laba di sistem
ini TIDAK BOLEH dipakai mengambil keputusan bisnis apa pun sampai Fase
2 (resep/HPP) ada.** Dashboard (T18) sudah menandai ini sebagai
placeholder yang terlihat, bukan Rp0 yang menyesatkan diam-diam --
tapi "terlihat sebagai placeholder" beda dari "terbaca 100%", jadi
tetap perlu ditulis eksplisit di sini.

**Thrifting TIDAK kena masalah yang sama** -- `barang.harga_modal`
dicatat manual per barang (bukan dari resep), jadi laba kotor
thrifting sudah akurat sejak awal, tidak menunggu Fase 2.

### Ditunda, dicatat (instruksi eksplisit CEO -- jangan dikerjakan)

- **KDS (layar dapur)** dan **manajemen meja**: kolom/tabel ada di
  skema (`order_items.kitchen_status`, tabel `tables`,
  `orders.table_id`), nol baris kode yang pernah menyentuhnya. Ditunda.
- **Playwright/e2e untuk `/pos`**: proyek ini nol test otomatis untuk
  layar React kasir (cuma fungsi backend yang teruji). CEO setuju
  dengan alasan biaya-manfaat yang diajukan -- ditunda.
- **`product_outlets`/`brand_id`**: PENGHALANG PELUNCURAN (di atas),
  tapi pekerjaan DATA, bukan coding -- CEO yang mengisi.

### Data yang harus disiapkan sebelum Indosteak buka (ringkas dari laporan investigasi)

Katalog menu+kategori+modifier Indosteak sungguhan (nol hari ini,
25 produk yang ada = demo generik), `product_outlets`/`brand_id`
(lihat penghalang di atas), karyawan+PIN sungguhan (cuma 5 untuk
seluruh bisnis hari ini, jelas placeholder), device per outlet dicek
ter-pairing (4 device untuk 5 outlet aktif -- perlu dicek per outlet
mana yang belum), keputusan service charge (isi persen atau biarkan
0%).
