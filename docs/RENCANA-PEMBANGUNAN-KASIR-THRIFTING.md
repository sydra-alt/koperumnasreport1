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

Empat dari `SPESIFIKASI-THRIFTING.md` §6 langsung memblokir task tertentu di
bawah (ditandai di task-nya masing-masing) — dikumpulkan di sini supaya bisa
ditanyakan sekali jalan:

1. **Berapa shift per hari untuk toko thrifting, dan jam potongnya?** (§6.6) —
   memblokir TT09. Toko 18 jam, Ita cuma 9 jam pertama — minimal 2 shift/hari,
   tapi jam potong shift KEDUA-dan-seterusnya (kalau lebih dari 2 orang
   bergiliran) belum diketahui.
2. **Ukuran label barcode** — memblokir TT05 (33×15mm atau 50×25mm, sesuai
   opsi yang sudah diajukan `RENCANA-PROYEK-BARU.md` §6).
3. **Data barang Bestie Thrift lama** — memblokir TT13 (dipindahkan semua,
   atau cukup yang belum terjual?).
4. **Persentase 60/40 seragam atau per pemilik** — TIDAK memblokir (skema
   `pemilik.persen_bagi` di §7 sudah mendukung keduanya, per-baris), tapi
   mempengaruhi UI TT03 (kalau seragam, field ini bisa disembunyikan/default
   saja, bukan wajib diisi tiap pemilik baru).
5. **Barang tidak laku berbulan-bulan** — tidak memblokir pembangunan awal
   (bisa menyusul sebagai fitur TT10 lanjutan), tapi perlu dijawab sebelum
   toko berjalan beberapa bulan.
6. ✅ **DIJAWAB (10 September 2026) — Apakah thrifting kena pajak/service
   charge?** **PAJAK NOL.** Harga di label adalah harga yang dibayar — barang
   bekas titipan, bukan restoran. Diteruskan ke CEO untuk konfirmasi resmi,
   TIDAK menunggu jawaban itu untuk lanjut kerja — kalau CEO membalikkan
   keputusan ini nanti, cuma satu nilai (`outlets.taxPercent`) yang perlu
   diubah di TT09, tidak ada yang perlu ditulis ulang. **Belum ada
   `taxPercent` yang benar-benar diset ke mana pun sekarang** — outlet
   thrifting belum dibuat (itu TT09), jadi ini murni keputusan yang dicatat
   di sini untuk dipakai NANTI saat outlet itu dibuat, bukan perubahan data
   hari ini. `taxInclusive`/`serviceChargePercent` ikut nol (service charge
   tidak relevan sama sekali untuk toko titipan).

---

## 4 · Task board

Penomoran **TT** (Thrifting Task) — sengaja BUKAN melanjutkan T01-T34 F&B,
supaya tidak menyiratkan urutan ketergantungan dengan roadmap Fase 2/3 F&B
(inventori/HPP/payroll) yang berjalan terpisah. Format sama seperti
`01-TASK-BOARD.md`: `[ ]` belum, checklist "Selesai kalau".

### Fase A — Fondasi data

**[ ] TT01 — Skema `barang` + `pemilik` + kategori**
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

**[ ] TT02 — Perluas `order_items` untuk barang thrifting**
Kolom baru (nullable): `barangId`, `pemilikId`, `pemilikBagiPercentAtSale`,
`pemilikShareAmount`, `tokoShareAmount` — semua snapshot SAAT transaksi
(CLAUDE.md §3.2), tidak pernah dihitung ulang belakangan walau
`persen_bagi` pemilik diubah kemudian. Trigger/constraint: barang yang
sudah `status='terjual'` tidak boleh terjual lagi (cegah dobel-scan).
*Selesai kalau:* insert order_item dengan barangId mengunci status barang
jadi `terjual` dalam transaksi yang sama (tidak ada window race dua kasir
scan barang sama nyaris bersamaan).

> **Titik berhenti #1 (disarankan)** — TT01+TT02 murni skema. Cocok
> ditinjau sebagai DDL/diagram konkret sebelum lanjut ke UI, sama pola
> dengan `jadwal_operasional` kemarin ("tunjukkan rencana tabel dulu").

### Fase B — Barang masuk (§5: penentu sistem dipakai atau tidak)

**[ ] TT03 — CRUD Pemilik (Admin/dashboard)**
Layar tambah/ubah pemilik, gerbang `pemilik.manage`. **Wajib ada sejak
awal** (instruksi eksplisit CEO 10 September) — bukan menyusul setelah
kasir jalan.

**[ ] TT04 — Layar tambah barang cepat**
Foto (kamera langsung, pola sama `CameraCapture` kalau relevan — cek dulu
apakah `pos-fnb` sudah punya komponen kamera dari T09c, jangan bangun
duplikat), pilih kategori/ukuran/kondisi/harga, **tombol pemilik yang
nilainya bertahan ke barang berikutnya** (§7 — penghematan waktu terbesar
untuk sesi 150 barang), kode/barcode digenerate otomatis (bukan diketik).
🔴 Bergantung jawaban §3.4 untuk UX pemilihan pemilik (dropdown vs
tersembunyi kalau seragam).

**[ ] TT05 — Cetak label barcode**
Code128 digambar canvas/SVG, ukuran sesuai §3.2 (BLOCKED sampai dijawab).
Web Bluetooth ke printer termal ATAU aplikasi cetak pihak ketiga — pilihan
final tunggu jawaban §8 `RENCANA-PROYEK-BARU.md` poin 6-7 (printer yang
sudah dipunya).

### Fase C — Kasir jual barang

**[ ] TT06 — Layar kasir thrifting**
Cari/scan barcode → temukan barang (status HARUS `siap_jual`, bukan
`terjual`) → keranjang → bayar. Reuse penuh alur pembayaran/split/kembalian
dari T13 — TIDAK menulis ulang logika pembayaran.

**[ ] TT07 — Kalkulator bagi hasil** (`lib/calc/consignment-split.ts`)
Fungsi murni: input harga jual + persen_bagi pemilik SAAT itu → output
bagian pemilik + bagian toko, pembulatan konsisten (round2, sisa
pembulatan ke satu pihak yang konsisten — sama prinsip §A.2 CALC-SPEC).
**Test dulu, baru dipakai** (CLAUDE.md §7 poin 4) — golden case dari tabel
contoh di `SPESIFIKASI-THRIFTING.md` §7 (Rp1.850.000 → 60%=Rp1.110.000).

**[ ] TT08 — Struk thrifting**
Reuse template 80mm T14, header/nama outlet disesuaikan.

### Fase D — Operasional shift (kemungkinan besar cuma data, bukan kode)

**[ ] TT09 — Outlet, device, karyawan thrifting terdaftar**
🔴 BLOCKED oleh §3.1 (jumlah shift & jam potong). Setelah terjawab: buat
outlet "Bestie Thrift" (brand baru, `dayCutoffTime` sesuai jam tutup nyata,
`taxPercent=0`/`taxInclusive=false`/`serviceChargePercent=0` — sudah
diputuskan §3.6, tinggal dipakai), daftarkan Ita + siapa pun penggantinya
sebagai employee lewat halaman yang SUDAH ADA (T15b), pasangkan device
kasir (T15c/T22e). **Kemungkinan besar TIDAK ADA KODE BARU di task ini** —
murni pemakaian fitur yang sudah jadi. Kalau ternyata butuh LEBIH dari 2
shift standar per hari dengan pola tidak biasa, baru task ini punya
cakupan kode (jarang, tapi dicatat supaya tidak diasumsikan nol kode).

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
🔴 BLOCKED oleh §3.3 (semua data lama, atau cukup yang belum terjual).

**[ ] TT14 — Uji lapangan pilot**
Sama pola T20 F&B: jalan paralel dengan cara lama dulu (kalau ada) sebelum
sepenuhnya pindah. Fokus khusus: apakah 150 barang/sesi tetap tercapai
dengan alur TT04 (§5 eksplisit bilang ini penentu dipakai/tidaknya sistem).

---

## 5 · Titik berhenti untuk ditinjau

Disarankan **DUA** titik berhenti, bukan satu di akhir:

1. **Setelah TT01+TT02 disetujui bentuknya** (DDL konkret, belum jalan) —
   sebelum kode skema sungguhan ditulis. Ini yang paling murah dikoreksi
   kalau ada yang salah.
2. **Setelah TT06+TT07 (kasir bisa transaksi lengkap, tanpa label/laporan
   dulu)** — titik ini yang paling berarti dicoba LANGSUNG oleh Ita/CEO
   sebelum melanjutkan ke laporan (TT10-TT11) dan migrasi (TT13), karena
   §5 `SPESIFIKASI-THRIFTING.md` eksplisit: kecepatan pemasukan/penjualan
   barang itu sendiri yang menentukan sistem ini dipakai atau ditinggalkan.

Tidak direncanakan untuk dikerjakan sekaligus sampai selesai tanpa jeda —
lima pertanyaan di §3 (terutama jumlah shift dan ukuran label) perlu jawaban
CEO sebelum TT04/TT05/TT09/TT13 bisa dimulai, jadi jeda alami sudah ada di
task board ini sendiri.
