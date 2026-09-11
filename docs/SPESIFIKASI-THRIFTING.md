# SPESIFIKASI BARANG THRIFTING

> Disusun dari data nyata Bestie Thrift, 5 September 2026.
> **Direvisi 6 September** setelah jawaban CEO — lihat §0.
> Menggantikan §5 di `RENCANA-PROYEK-BARU.md`.

---

## §0 · Jawaban CEO yang mengubah rancangan

> ⚠️ **Baris "Kasir" di bawah SUDAH DIGANTIKAN** (10 September 2026, setelah
> `pos-fnb` benar-benar dibaca langsung — lihat
> `docs/RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md`): thrifting jadi **outlet
> baru di `business` YANG SAMA** (brand baru), BUKAN business terpisah —
> `order_items` **DIPERLUAS** dengan kolom nullable (`barangId`, dst), bukan
> tabel polimorfik terpisah. Disetujui CEO menggantikan baris di bawah.
> "Tidak menyentuh apa pun milik Indokopi" TETAP benar dan tetap berlaku.

| Hal | Jawaban | Akibatnya |
|---|---|---|
| Kasir | ~~Terpisah, meja sendiri~~ **DIGANTIKAN, lihat catatan di atas** | ~~Thrifting jadi `business` tersendiri di `pos-fnb`. `order_items` tidak perlu polimorfik.~~ |
| Bestie Thrift | **Diganti** | Perlu pemindahan data barang lama |
| "SS" | **Kode pemilik barang titipan** — Salma | Konsinyasi itu nyata. Lihat §7 |
| Bagi hasil | **60% pemilik, 40% toko** | Perlu pencatatan dan laporan per pemilik |
| Kondisi A/B/C | **Tidak dipakai** | Dibuang. Harga ditentukan dari harga beli + banding Google |
| Barang masuk | 50–150 potong, tiap 2 minggu–1 bulan | Bukan harian. Justru berkelompok besar sekali duduk |
| Umur barang | **Dipakai** | Untuk melihat mana yang perlu didiskon |

---

## §1 · Yang terbaca dari data nyata

| Temuan | Artinya |
|---|---|
| "Rubi black **Uk.39** SS" | Ukuran dijejalkan ke nama. Tidak bisa disaring, tidak bisa dianalisis |
| Merek hampir semua `N/D` | Memang tidak dipakai. Jangan jadikan wajib |
| `Unit` selalu sama dengan `Category` (Sepatu → Sepatu) | Kolom ini tidak menambah apa pun |
| `Quantity` 1.00 atau 0.00 | Model satuan sudah berjalan, tapi lewat angka — rapuh |
| **Kondisi tidak ada sama sekali** | Lubang terbesar. Di thrifting, kondisi menentukan harga |
| Tidak ada tanggal masuk | Tidak bisa tahu barang mana yang sudah lama menumpuk |
| Modal → jual sekitar 2× | Berguna untuk harga usulan otomatis |

---

## §2 · Field yang dipakai

### Wajib — tanpa ini barang tidak bisa dijual

| Field | Tipe | Catatan |
|---|---|---|
| `kode` | teks unik | Dicetak jadi barcode Code128. Dibuat otomatis, jangan diketik |
| `foto` | gambar | Setiap barang unik, jadi fotonya juga unik. Wajib |
| `kategori_id` | pilih | Sepatu, Tas, Pakaian, Topi, … bisa ditambah dari Admin |
| `nama` | teks | Deskripsi singkat SAJA. Ukuran jangan masuk sini lagi |
| `harga_modal` | rupiah | |
| `harga_jual` | rupiah | Diisi otomatis 2× modal, boleh diubah |

| `pemilik_id` | pilih | **Baru.** Kosong = milik toko sendiri. Lihat §7 |

### Penting — kosong boleh, tapi sangat berguna

| Field | Tipe | Kenapa |
|---|---|---|
| `ukuran` | teks | **Baru.** Sekarang ada di nama. Bentuknya beda per kategori — lihat §4 |
| `warna` | teks | Pembeli mencari warna. Sekarang juga ada di nama |
| `tanggal_masuk` | tanggal | **Baru.** Otomatis. Tanpa ini tidak tahu barang menumpuk berapa lama |
| `merek` | teks bebas | **Bukan dropdown.** Ketik langsung, boleh kosong |
| `catatan` | teks panjang | Cacat kecil, keterangan tambahan |

### Dibuang

| Field sekarang | Kenapa dibuang |
|---|---|
| **Brand** (dropdown) | Hampir semua `N/D`. Ganti teks bebas opsional |
| **Sub Category** | Tidak dipakai. Kategori saja cukup |
| **Unit** | Selalu menyalin kategori. Semua barang thrifting satuan |
| **Barcode Symbology** | Selalu Code128. Tidak perlu ditanyakan |
| **Quantity** | Selalu 1 atau 0. Diganti `status` yang lebih jelas |
| **Type** (Single) | Tidak ada jenis lain |

Enam kolom hilang dari layar pengisian. Waktu isi berkurang jauh.

### Dihitung sistem, bukan diisi

| Field | Isi |
|---|---|
| `status` | `siap_jual` · `terjual` · `disimpan` · `rusak` |
| `terjual_pada` | Terisi sendiri saat transaksi |
| `umur_hari` | Hari ini − tanggal masuk. Untuk melihat barang menumpuk |
| `margin` | Harga jual − modal |

---

## §3 · Kondisi — tidak dipakai

Rancangan awal mengusulkan skala A/B/C. **CEO menolak**, dan alasannya masuk akal: pegawai kesulitan menilainya, dan harga ditentukan dari harga beli plus perbandingan Google, bukan dari tingkat kondisi.

Memaksakan field yang orang tidak bisa isi dengan yakin hanya menghasilkan data yang salah — lebih buruk daripada tidak ada data.

Sebagai gantinya, **`catatan` dipakai untuk mencatat cacat** kalau ada. Bebas, tidak wajib.

Kalau suatu saat ada keluhan pembeli soal kondisi barang yang tidak sesuai, baru pertimbangkan menambahkannya kembali — dengan bukti nyata bahwa itu dibutuhkan.

---

## §4 · Ukuran berbeda bentuk per kategori

Ini alasan ukuran dijejalkan ke nama — satu kolom tidak cocok untuk semua.

| Kategori | Bentuk ukuran | Pilihan |
|---|---|---|
| Sepatu | Angka | 36–46 |
| Pakaian | Huruf | S, M, L, XL, XXL |
| Celana | Angka pinggang | 28–38 |
| Tas, Topi | — | Kosongkan, atau isi bebas |

Simpan sebagai satu kolom teks, tapi **pilihannya menyesuaikan kategori yang dipilih**. Kategori punya kolom `jenis_ukuran` yang menentukan pilihan apa yang muncul.

Kalau kategorinya belum diatur jenis ukurannya, tampilkan isian teks bebas. Jangan menghalangi.

---

## §5 · Kecepatan pemasukan barang — ini yang menentukan sistemnya dipakai atau tidak

Barang thrifting datang berkarung. Kalau satu barang butuh dua menit untuk dimasukkan, lima puluh barang berarti hampir dua jam — dan orang akan berhenti memakai sistemnya.

**Target: di bawah 20 detik per barang.**

Layar pemasukan cepat, satu barang per layar:

```
    [ FOTO ]  ← kamera langsung terbuka, jepret

    Kategori    [Sepatu] [Tas] [Pakaian] [Topi]     ← tombol, bukan menu
    Ukuran      [38] [39] [40] [41] [42]            ← menyesuaikan kategori
    Kondisi     [ A ]  [ B ]  [ C ]                 ← tiga tombol besar

    Nama        _______________________
    Modal       Rp _______
    Jual        Rp _______   ← terisi 2× modal, boleh diubah

    [ Simpan & barang berikutnya ]
```

Enam ketukan dan dua angka. Setelah disimpan, layar kembali kosong dengan **kategori dan kondisi tetap seperti sebelumnya** — karena barang dalam satu karung biasanya sejenis.

Label dicetak belakangan sekaligus, bukan satu per satu. Pilih beberapa barang, cetak semuanya.

---

## §7 · Barang titipan dan bagi hasil

Ini yang paling terlewat di rancangan awal. Kode "SS" di setiap nama barang ternyata bukan hiasan — itu penanda pemilik.

**Sebagian barang bukan milik toko.** Orang menitipkan barangnya, toko yang menjualkan, hasilnya dibagi **60% pemilik, 40% toko**.

### Tabel pemilik

```sql
pemilik (
  id          uuid,
  kode        text unique,      -- "SS" — dicetak di label, dipakai di nama
  nama        text not null,    -- "Salma"
  kontak      text,             -- nomor WhatsApp untuk pembayaran bagi hasil
  persen_bagi bigint default 60,-- bisa berbeda per orang
  aktif       boolean default true,
  catatan     text
)
```

`barang.pemilik_id` boleh kosong. **Kosong berarti milik toko sendiri** — seluruh hasil jadi milik toko.

**Jawaban CEO (10 September 2026):** pemilik titipan sekarang **4 orang**, ke depan bisa **10+**. **Jangan terpaku pada kode 2-huruf gaya "SS"** — itu kebetulan cocok untuk Salma, tidak akan cukup/jelas begitu pemiliknya lebih banyak. **Layar "Tambah Pemilik" harus ada di Admin SEJAK AWAL** (bukan menyusul) — CEO/admin menambah pemilik baru sendiri kapan pun tanpa perlu developer, persis pola tab Admin yang sudah ada untuk Outlet/Lokasi/dst di sistem laporan ini.

### Yang berubah di layar

**Saat memasukkan barang:** tombol pemilik muncul di layar cepat, dan **nilainya bertahan ke barang berikutnya** — karena satu karung titipan biasanya dari satu orang. Itu penghematan waktu terbesar untuk sesi 150 barang.

Kode pemilik tidak perlu lagi diketik ke dalam nama barang. Cukup pilih sekali, sistem yang mencatat.

**Saat terjual:** sistem mencatat sendiri berapa bagian pemilik dan berapa bagian toko, dihitung dari `persen_bagi` yang berlaku **saat itu**. Simpan angkanya di baris transaksi, jangan dihitung ulang belakangan — kalau persentasenya diubah bulan depan, transaksi lama tidak boleh ikut berubah.

**Jawaban CEO (10 September 2026) soal KAPAN dibayar:** **BULANAN, saat tutup buku** — bukan per transaksi. Konsekuensinya bagi rancangan: **tidak perlu hitung/bayar per transaksi saat itu juga** — cukup baris transaksi menyimpan bagian pemilik (sesuai `persen_bagi` saat itu, seperti di atas), lalu **rekap BULANAN per pemilik** menjumlahkannya, dengan satu tombol **"Sudah Dibayar"** per rekap bulanan (bukan per transaksi/per barang).

### Laporan bagi hasil

Per pemilik, per rentang tanggal:

| | |
|---|---|
| Barang dititipkan | 45 potong |
| Terjual | 12 potong |
| Belum terjual | 33 potong |
| Total penjualan | Rp 1.850.000 |
| **Bagian pemilik (60%)** | **Rp 1.110.000** |
| Bagian toko (40%) | Rp 740.000 |
| Sudah dibayarkan | Rp 800.000 |
| **Sisa dibayar** | **Rp 310.000** |

Perlu tombol **"Tandai sudah dibayar"** dengan pencatatan tanggal dan jumlah. Tanpa itu, tidak ada yang tahu utang toko ke pemilik berapa.

Bisa diekspor ke Excel dan dikirim ke pemilik lewat WhatsApp.

### Yang perlu diputuskan

Kalau barang titipan **tidak laku berbulan-bulan**, apa yang terjadi? Dikembalikan ke pemilik, atau didiskon dengan persetujuannya? Perlu ditanyakan — dan `umur_hari` yang sudah dirancang justru dipakai untuk ini.

---

## §8 · Kasir dan shift — BUKAN cuma Ita

**Koreksi CEO (10 September 2026) atas catatan risiko sebelumnya** ("kasir dijaga Ita sendirian"): **keliru**. Toko buka `09:00`–`03:00` mengikuti jam kafe (lihat jadwal operasional Indokopi di sistem laporan), tapi Ita pulang `18:00`. Itu berarti **sembilan dari delapan belas jam buka** — lebih dari separuh — kasirnya dijaga orang LAIN (CEO sendiri atau staf lain), bukan pengecualian sesekali. Catatan risiko di `docs/PROGRESS.md` diperbaiki jadi "Ita cuma menjaga 9 dari 18 jam buka", bukan "dijaga sendirian".

Konsekuensi langsung untuk rancangan kasir thrifting di `pos-fnb`:

1. **BUKAN satu akun kasir untuk toko.** Harus ada lebih dari satu orang yang bisa membuka kas (login kasir) — minimal Ita dan siapa pun yang menggantikannya sore/malam. Login per-orang, bukan satu kredensial bersama yang dipakai bergiliran (kalau `pos-fnb` sudah punya pola multi-kasir dari sisi F&B, thrifting tinggal memakainya — ini salah satu hal yang perlu dicek saat membaca kodenya).

2. ✅ **BERUBAH TOTAL (10 September 2026) — TIDAK ADA TUNAI SAMA SEKALI.** CEO: semua outlet sudah cashless (QRIS + transfer saja, tunai yang masuk di-top-up ke rekening). Seluruh poin "hitung uang saat serah terima" di atas **tidak berlaku lagi** untuk thrifting — dan setelah `pos-fnb` dibaca langsung, ternyata **tidak ada kode baru yang perlu ditulis untuk ini**: `outlets.cashEnabled=false` (kolom yang SUDAH ADA, per-outlet, diatur dari halaman Admin outlet yang SUDAH ADA) membuat seluruh siklus shift otomatis lewat jalur tutup-shift ringkas (`closeCashlessShiftWithDb()`, SUDAH ADA sejak T15) — tidak ada modal awal, tidak ada hitung kas, tidak ada selisih. Metode pembayaran tunai (`isCashDrawer=true`) otomatis disembunyikan dari layar kasir outlet itu (`getPosCatalog()`, SUDAH ADA) — bukan cuma tombolnya disembunyikan, memang tidak ditawarkan. Detail lengkap di `docs/RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md` §7.

3. **Siapa yang melayani TIDAK PERLU jadi catatan manual baru** — BENAR untuk kasir bernama (F&B `getSalesByCashier` dipakai ulang apa adanya). **TAPI** ditemukan pengecualian penting: akun BERSAMA/tamu (lihat §9 di bawah) butuh SATU kolom baru (`shifts.servedByName`) karena `pos-fnb` tidak punya cara mencatat "siapa sungguhan melayani" kalau shift dibuka dengan kredensial bersama, bukan kredensial pribadi.

**Konsekuensi dari poin 2 di atas**: pertanyaan "berapa shift per hari & jam potongnya" TIDAK LAGI memblokir apa pun (dulu ditanyakan justru karena kas harus direkonsiliasi per orang) — tanpa uang tunai untuk dihitung, jumlah shift/hari jadi murni soal akuntabilitas "siapa sedang bertugas", bukan rekonsiliasi finansial. Ditutup dengan mekanisme akun tamu di §9: siapa pun yang bertugas sore/malam cukup buka shift baru (kredensial bersama + nama sendiri), berapa kali pun berganti orang, tanpa perlu jadwal shift tetap ditentukan di muka.

**Ita = MANAGER** (dikonfirmasi CEO, bukan kasir-dengan-kelonggaran) — dia mengurus barang masuk, harga, pemilik titipan, dan laporan bagi hasil, pekerjaan manajerial. `barang.manage`/`pemilik.manage` di rancangan permission (lihat `docs/RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md` §6.6) DIPERKETAT jadi `na` untuk role kasir (bukan `off`/bisa-di-override seperti draft sebelumnya) — sekarang TIDAK ADA jalan bagi akun kasir mana pun, termasuk akun tamu, untuk mendapat izin itu lewat override apa pun.

---

## §9 · Akun tamu bersama (jam sore/malam) dan label barcode admin-configurable

### Akun tamu

CEO: penjualan setelah jam 6 sore jauh lebih sedikit daripada jam 9–18 —
**tidak perlu tahu siapa yang melayani** di jam sepi itu, siapa saja
(termasuk anak part-time) boleh masuk dengan satu akun BERSAMA, bukan akun
per orang.

**Diperiksa dulu ke `pos-fnb` sebelum membangun** (instruksi eksplisit) — dua temuan:

1. ❌ **"Nama pelayan per shift" TIDAK DIDUKUNG sekarang.** `openShiftWithDb()`
   cuma menerima `employeeCode`+`pin` — nama yang tercatat SELALU
   `employees.fullName` hasil verifikasi PIN, tidak ada tempat mengetik nama
   bebas. **Butuh kolom baru**: `shifts.servedByName` (nullable) + kolom
   penanda `employees.isSharedAccount` (boolean) supaya server tahu KAPAN
   nama itu wajib diminta (cuma saat shift dibuka pakai akun bersama, bukan
   akun pribadi). Wajib diisi ditegakkan di `openShiftWithDb()`, sama pola
   validasi server-side yang sudah dipakai di file itu (bukan cuma di UI).
   Setiap tempat yang menampilkan `employeeName` (dashboard "siapa
   bertugas", laporan `getSalesByCashier`, struk) diprioritaskan membaca
   `servedByName` kalau terisi, supaya laporan malam menyebut nama
   sungguhan, bukan literal "Akun Tamu" berulang-ulang.
2. ✅ **Void/refund SUDAH TIDAK MUNGKIN dilakukan akun tamu** — bukan
   sesuatu yang perlu dibatasi, sudah begitu strukturnya: void/refund
   (`lib/pos/void-refund.ts`) digerbangi sesi Supabase Auth owner/manajer
   SUNGGUHAN (login dashboard penuh), BUKAN sesi PIN kasir yang dipakai
   layar kasir/buka-shift. Akun tamu (kredensial PIN) tidak pernah bisa
   sampai ke jalur itu sama sekali, apa pun izin yang diberikan lewat
   `permissions_override`. **Jawaban atas pertanyaan CEO poin 4**: pilihan
   pertama ("tidak bisa sama sekali") itulah yang SUDAH TERJADI secara
   arsitektur, bukan sesuatu yang perlu dipilih/dibangun. Kalau ada
   transaksi malam yang perlu di-void/refund, itu dikerjakan Ita/CEO lewat
   dashboard sungguhan setelahnya (login asli, bukan lewat layar kasir).

Rancangan akun tamu, lima syarat CEO dipetakan ke mekanisme yang ada:

| Syarat CEO | Mekanisme |
|---|---|
| 1-2. Nama pelayan wajib diketik saat buka shift | Kolom baru `shifts.servedByName` + validasi wajib di `openShiftWithDb()` (BARU, belum ada) |
| 3. Cuma bisa jual & buka/tutup shift | Satu employee row `role='cashier'` (default RBAC sudah membatasi `product`/`price`/`report`/`settings` untuk kasir) + `barang.manage`/`pemilik.manage` diperketat `na` (lihat di atas) — TIDAK PERLU override apa pun, defaultnya sudah pas |
| 4. Void/refund tidak bisa (atau lewat Ita) | SUDAH begitu secara struktur (lihat temuan #2 di atas) — tidak perlu dibangun |
| 5. Password (PIN) bisa diganti sekali tekan dari Admin | SUDAH ADA — tombol "reset PIN" T15b, dipakai apa adanya untuk akun tamu |

**Satu employee row baru** cukup: `code` (mis. "TAMU"), `fullName` "Akun
Tamu — Bestie Thrift", `role='cashier'`, `isSharedAccount=true`, PIN
ditentukan & bisa direset kapan pun dari Admin.

### Label barcode — TIDAK dikunci satu ukuran

CEO: kemarin label terasa kekecilan, tidak yakin lagi ukuran persisnya —
**jangan dikunci di kode**. Diatur dari Admin: lebar, tinggi, dan elemen apa
saja yang dicetak (barcode, nama, harga, kode pemilik, ukuran barang). Empat
preset umum di Indonesia (33×15, 50×25, 50×30, 50×80mm) + pilihan ukuran
bebas + **pratinjau di layar sebelum cetak** (supaya CEO bisa coba-coba
tanpa buang kertas label sungguhan). Detail skema (`label_settings` per
business, bukan per barang) ada di `docs/RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md` §8.

---

## §6 · Yang masih perlu ditanyakan

1. ✅ **TERJAWAB (10 September 2026) — Ada berapa pemilik titipan sekarang?** **4 orang**, ke depan bisa **10+** — lihat §7 (jangan terpaku kode 2-huruf, layar Tambah Pemilik wajib ada di Admin sejak awal).
2. **Persentase 60/40 sama untuk semua**, atau berbeda per orang? — MASIH TERBUKA.
3. **Barang titipan yang tidak laku berbulan-bulan** — dikembalikan, atau didiskon dengan izin pemiliknya? — MASIH TERBUKA.
4. ✅ **TERJAWAB (10 September 2026) — Bagi hasil dibayarkan kapan?** **Bulanan, saat tutup buku** — lihat §7 ("Laporan bagi hasil").
5. ✅ **TERJAWAB (10 September 2026) — Data barang di Bestie Thrift dipindahkan semua atau cukup yang belum terjual?** **CUKUP YANG BELUM TERJUAL.** Barang yang sudah terjual TETAP di sistem lama sebagai arsip, tidak ikut dipindahkan.
6. ✅ **TIDAK LAGI RELEVAN (10 September 2026) — "Berapa shift & jam potong"** — pertanyaan ini lahir dari kebutuhan rekonsiliasi kas per shift, yang sekarang tidak ada sama sekali (toko 100% cashless, lihat §8 poin 2). Ditutup lewat mekanisme akun tamu (§9): siapa pun yang bertugas cukup buka shift dengan namanya sendiri, tidak perlu jadwal shift baku.
7. ✅ **TERJAWAB (10 September 2026) — Ukuran label barcode** — lihat §9. TIDAK dikunci ke satu ukuran; diatur dari Admin (lebar, tinggi, elemen yang dicetak), dengan preset umum + ukuran bebas + pratinjau sebelum cetak.
8. **Pajak/service charge thrifting** — ✅ **TERJAWAB, tapi MENUNGGU konfirmasi resmi CEO ke pemilik proyek**: **PAJAK NOL** ("harga label = harga bayar, barang bekas titipan bukan restoran"). Dikerjakan dengan asumsi ini (`outlets.taxPercent=0` saat outlet dibuat, TT09) — kalau CEO membalikkan keputusan ini nanti, cuma satu nilai yang perlu diubah, bukan kode.

Sisa yang MASIH TERBUKA setelah sesi ini: poin 2 dan 3 saja — keduanya TIDAK memblokir pembangunan (lihat `docs/RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md`).

---

## §10 · Duplikasi angka dengan laporan manager_resto — BELUM mendesak, dicatat untuk nanti (11 September 2026)

**Status saat dicatat**: BELUM ADA outlet yang benar-benar memakai
`pos-fnb` sehari-hari — Indokopi maupun Indosteak belum pernah produksi
di sana, cuma didaftarkan namanya ke database dev untuk pengujian (lihat
`RENCANA-PEMBANGUNAN-KASIR-THRIFTING.md` §12). Form manual
`manager_resto` di sistem laporan ini (repo `reportkoperumnasgroup`)
tetap jalan seperti biasa. **Tidak ada yang perlu dibangun sekarang** —
ini catatan supaya tidak terlewat NANTI.

**Yang ditemukan**: `forms/f16-manager-resto.ts` (form harian yang
diisi manual manager resto) punya delapan kolom `uang` yang PERSIS
angka yang sama yang otomatis tercatat `pos-fnb` kalau outlet itu pakai
kasirnya:

| Kolom form (`f16-manager-resto.ts`) | Sumber sepadan di pos-fnb |
|---|---|
| `total_omzet` | `getSalesSummary()` — `netSales` |
| `penjualan_makanan` / `penjualan_minuman` | agregasi per kategori produk |
| `metode_cash` / `metode_qris` / `metode_transfer` / `metode_lainnya` | breakdown `payments` per `payment_methods` |
| `cash_diterima` / `sisa_cash` | shift cash reconciliation (`shifts.countedCash`/`expectedCash`) |

**Aturan yang HARUS ditegakkan begitu satu outlet benar-benar pindah ke
pos-fnb sehari-hari**: kedelapan kolom itu WAJIB dikunci jadi
**baca-saja** (pre-filled otomatis dari pos-fnb, bukan lagi diketik
manager) untuk outlet tersebut — bukan dibiarkan berdampingan sebagai
dua kolom yang bisa berbeda angka untuk hal yang sama. Ini pelajaran
yang sama yang sudah pernah susah payah dihindari di laporan
pembangunan (dua sumber kebenaran untuk satu angka = salah satu pasti
diam-diam salah, dan tidak ada yang tahu mana yang benar saat keduanya
beda).

**Kenapa belum dibangun sekarang**: pos-fnb belum punya jalur keluar
data sama sekali (tidak ada satu pun `/api/*` route, murni Server
Action internal) — menyambungkan dua sistem ini perlu endpoint baru +
otentikasi server-ke-server di pos-fnb, plus perubahan di form
`manager_resto` supaya tahu kapan harus membaca dari sana vs menerima
input manual. Pekerjaan nyata, bukan "sambil lewat" — ditunda sampai
ada outlet yang SUNGGUHAN produksi di pos-fnb, dicatat di sini supaya
tidak lupa begitu saatnya tiba.
