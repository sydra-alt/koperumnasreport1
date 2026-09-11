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

**[x] TT05 — Cetak label barcode** — SELESAI (12 September 2026). Keputusan CEO menutup pertanyaan terbuka di atas: RawBT (bukan Web Bluetooth), Code128 digambar sendiri jadi gambar, lebar cetak 48mm dari kertas termal 58mm. Detail lengkap di §15.

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
