# Rancangan Kontrol Harian & Laba Rugi Bulanan (Oktober 2026)

Dokumen diskusi untuk CEO, Ita, dan pemilik. **Belum ada yang dibangun dari dokumen ini.** Angka "hari ini" dibaca langsung dari database produksi pada 6 Oktober 2026 (baca-saja).

## 0. Kondisi hari ini (fakta, bukan asumsi)

- **POS belum dipakai jualan di outlet F&B mana pun.** Jatinegara, Kemayoran, Cempaka Putih, Pekansari: **0 transaksi** sepanjang sejarah. Satu-satunya penjualan POS adalah Bestie Thrift: 7 transaksi, Rp799.000 di bulan September.
- **Gerakan stok** hanya berasal dari dua kali unggah opname: Jatinegara 18 September (65 baris) dan Cempaka 29 September (52 baris). Kemayoran dan Pekansari belum punya stok sama sekali di sistem.
- **Resep:** 212 dari 225 bahan Lacak stok tidak dipakai resep mana pun. Produk tanpa resep: Jatinegara 95/100, Kemayoran 12/16, Cempaka 44/51, Pekansari 44/51.
- **Laporan harian di sistem laporan untuk September:** 1 laporan Manajer Resto (Cempaka, 19 September, omzet kosong) dan 1 draf thrifting. Belum ada laporan Kontrol F&B maupun Accounting.
- **Draf laba rugi Ita bulan September:**
  - Penjumlahannya benar (selisih Rp1 di Cempaka).
  - Kolom **modal** jelas berupa asumsi rasio, bukan pembelian atau HPP: Indosteak Cempaka dan Pekansari = penjualan ÷ 2,3 (43,5%), Bestie Thrift = tepat 40% penjualan, Jatinegara 50,7%.
  - Sistem belum punya data untuk mencocokkannya: semua angka draf = selisih penuh terhadap sistem.
- **Kemayoran: beras, kerupuk bawang, leci kaleng "tidak terpotong".** Ada dua sebab:
  1. Bahan-bahan itu tidak ada di resep produk mana pun.
  2. Kemayoran sendiri belum mencatat satu pun penjualan atau stok di POS. Jadi saat ini tidak ada yang bisa terpotong, dengan atau tanpa resep.

  Sejak 6 Oktober, halaman **Kelengkapan Resep** di POS menunjukkan celah ini untuk semua bahan sekaligus, dan menyediakan template Excel untuk diisi Ita.

## 1. Peta kemampuan per poin SOP

| Poin SOP pemilik | Yang sudah ada di sistem | Yang belum ada |
|---|---|---|
| Semua pembelian masuk ke stok **pusat (Rumah Ibu Putri)** dulu | Lokasi stok = outlet. Ada outlet "Gudang" (dapur pusat), saat ini **nonaktif**. Impor belanja dari foto nota mencatat pembelian per baris ke outlet yang dipilih. | Lokasi aktif "Pusat (Rumah Ibu Putri)". Bawaan impor belanja = pusat. |
| Barang dikirim pusat → outlet | Fitur **Pindah Stok** (minta → setujui → kirim → terima; stok berkurang di asal, bertambah di tujuan). Baru dipakai 1 kali. | Rutinitas kirim harian dari pusat. Laporan "barang keluar pusat" per bulan. |
| Kontrol pusat: stok awal + pembelian − stok akhir = barang keluar (bukan HPP) | Opname (stok fisik), pembelian, pindah stok, kartu stok per bahan. | Laporan bulanan pusat dengan rumus itu, dan penanda bahwa ini **bukan** HPP. |
| Kontrol harian outlet: stok awal pagi + masuk − stok akhir malam = terpakai, dicocokkan dengan penjualan POS dan uang | Opname buka/tutup shift (hanya bahan bertanda *Hitung Tiap Shift*, saat ini 0 bahan). Penerimaan pindah stok. Penjualan POS per metode. Laporan tutup shift ke WhatsApp. | Layar **Kontrol Harian** yang menggabungkan semuanya. Pemakaian teoretis (penjualan × resep) dibandingkan pemakaian aktual. |
| Selisih dilaporkan hari yang sama + penyebab + tindakan | Alasan selisih kas saat tutup shift. Catatan opname. | Catatan "penyebab / tindakan" per outlet per hari, dan status OK/selisih. |
| HPP outlet = jumlah terjual × HPP per unit (bukan pembelian bulan itu) | **Sudah dihitung per transaksi**: tiap baris penjualan menyimpan HPP dari resep × harga rata-rata, dan ditandai *HPP belum lengkap* kalau ada bahan tanpa harga. | Resep yang lengkap (lihat bagian 0). Rekap HPP bulanan per outlet. |
| Bulanan: omzet − HPP = laba kotor; − gaji, listrik, sewa, gas, internet, operasional, lainnya = laba/rugi bersih | Omzet POS per hari, dan sinkron omzet POS → sistem laporan (sudah ada tabelnya, belum ada isinya). | Input biaya bulanan per outlet. Laporan laba rugi. Penguncian bulan. |
| Thrifting: stok awal + pembelian − stok akhir = HPP | Barang titipan dengan harga modal per barang. Laporan stok, bagi hasil, dan HPP per transaksi thrift. | Rekap bulanan thrift dalam format pemilik. |
| Ita: laporan kontrol harian singkat tiap pagi | Laporan Kontrol F&B harian di sistem laporan (diketik manual). Tautan WhatsApp (wa.me) untuk laporan shift. | Teks ringkas otomatis berformat pemilik. |
| Tanggung jawab (pembelian, sistem/rekonsiliasi, Ita, PIC outlet) | Peran: owner, manajer, kasir, gudang, dan penugasan per outlet. | Pembagian tugas yang tertulis di layar ("menunggu siapa"). |

## 2. Kontrol Harian (untuk Ita)

**Satu layar per tanggal**, satu baris per outlet, terbuka setiap pagi untuk hari kemarin.

1. **Penjualan vs uang**:
   - Penjualan di sistem (POS) per metode: QRIS dan Transfer. Tunai tidak dipakai, karena uang tunai disetor dulu lalu dicatat sebagai Transfer.
   - Uang masuk, diisi Ita dari mutasi bank/QRIS.
   - Selisih = uang masuk − penjualan sistem.
2. **Selisih stok per bahan**:
   - Pemakaian teoretis = Σ (porsi terjual × qty bahan di resep).
   - Pemakaian aktual = stok awal (opname buka / tutup kemarin) + barang masuk (pindah stok diterima, pembelian) − stok akhir (opname tutup).
   - Selisih = aktual − teoretis, ditampilkan dalam satuan dan rupiah (× harga rata-rata).
3. **Status**: **OK** kalau semua selisih di bawah ambang. Ambangnya sudah ada di setting outlet: *Ambang Peringatan Selisih Opname* dalam persen atau rupiah. Kalau tidak, statusnya **Selisih**.
4. **Catatan penyebab dan tindakan** per outlet per hari (wajib kalau status Selisih), tersimpan dan terlihat oleh CEO.
5. **Teks WhatsApp** berformat pemilik, dikirim lewat tautan wa.me yang sudah ada:
   - Per outlet: Outlet, Tanggal, PIC.
   - Per bahan: stok awal, masuk, terjual/terpakai, sisa.
   - Penjualan di sistem, uang masuk, selisih.
   - Status dan tindakan.

**Bahan yang tidak ada di resep muncul sendiri sebagai selisih.** Pemakaian teoretisnya 0 (tidak ada resep), padahal pemakaian aktualnya positif (stok berkurang di opname). Contoh: beras 2 kg terpakai, teoretis 0 → selisih +2 kg dengan keterangan otomatis *"tidak ada di resep mana pun"*. Ini menangkap kesalahan seperti kasus Kemayoran tanpa perlu dicari satu per satu.

**Syaratnya:**
- Opname buka dan tutup untuk bahan yang ingin dikontrol (tandai *Hitung Tiap Shift*).
- Penjualan memang lewat POS.
- Barang masuk dicatat lewat pindah stok.

## 3. Laba Rugi Bulanan per Outlet (struktur pemilik)

| Baris | Sumber | Badge kualitas data (contoh) |
|---|---|---|
| Omzet | Penjualan POS (dibayar, dikurangi pengembalian dana). Cadangan: omzet laporan harian Manajer Resto kalau POS belum dipakai. | "Sumber: laporan harian, bukan POS" / "12 hari tanpa data" |
| HPP | Σ HPP per transaksi (resep × harga rata-rata saat terjual) | "HPP belum lengkap: 38% penjualan tanpa resep" / "5 bahan tanpa harga" |
| Laba kotor | Omzet − HPP | ikut badge HPP |
| Gaji, sewa, listrik, gas, internet, operasional, lainnya | **Input biaya bulanan** per outlet. Bisa disalin dari bulan lalu; tiap angka punya catatan dan siapa yang mengisi. | "Belum diisi: listrik, gas" |
| Laba/rugi bersih | Laba kotor − total biaya | merah kalau ada baris belum lengkap |

- **Kunci bulan:** setelah dicek, bulan dikunci. Sesudah itu transaksi dan biaya bulan itu tidak bisa diubah lagi; koreksi masuk ke bulan berjalan dengan catatan.
- **Hak akses (usulan):**
  - Ita: mengisi biaya dan catatan, melihat semua outlet.
  - CEO: melihat semua dan mengunci bulan.
  - Accounting: mengisi biaya.
  - Manajer outlet: hanya melihat outletnya sendiri, tanpa gaji orang lain.
  - Laba rugi tidak terlihat oleh kasir.
- **Thrifting:**
  - HPP = stok awal (nilai modal barang di toko) + pembelian/titipan masuk − stok akhir.
  - Laba kotor = penjualan − HPP.
  - Untuk barang titipan, bagian pemilik titipan adalah biaya bagi hasil, bukan HPP. Ini perlu disepakati (pertanyaan 6).

## 4. Stok pusat "Pusat (Rumah Ibu Putri)"

- **Usulan:** aktifkan outlet "Gudang" yang sudah ada (sudah bertanda dapur pusat), ganti namanya menjadi **Pusat (Rumah Ibu Putri)**. Lokasi ini tanpa kasir dan tanpa shift.
- Pembelian masuk ke pusat. Outlet meminta barang lewat **Pindah Stok**; pusat mengirim, outlet menerima.
- Bulanan pusat: stok awal pusat (opname akhir bulan lalu) + pembelian − stok akhir pusat (opname akhir bulan) = barang keluar. Angka ini dicocokkan dengan Σ pindah stok terkirim. Selisihnya adalah kehilangan atau pencatatan yang kurang, **bukan HPP**.
- **Dampak ke Impor Belanja (item 3, jangan diubah dulu):**
  - Saat ini setiap baris nota memilih outlet tujuan.
  - Usulan setelah keputusan CEO: outlet bawaan setiap baris = Pusat. Pengecualian per baris tetap boleh untuk barang yang dibeli langsung oleh outlet (misalnya es batu, sayur harian).
  - Aturan "tanggal tidak sebelum opname terakhir outlet baris itu" otomatis berlaku untuk pusat.

## 5. Tahap berikutnya (opsional): "Permintaan stok besok"

Di laporan tutup, PIC mengisi permintaan per bahan. Sistem menyusunnya menjadi daftar permintaan Pindah Stok ke pusat, sekaligus total permintaan semua outlet untuk bagian pembelian. Ini menggantikan kolom "permintaan besok" di WhatsApp Ita.

## 6. Urutan pembangunan (dari yang terkecil tapi berguna)

1. **Data dasar dulu, tanpa kode baru:**
   - Lengkapi resep (template Excel → impor).
   - Pasang perangkat kasir di Kemayoran dan Cempaka.
   - Opname awal Kemayoran dan Pekansari.
   - Tandai *Hitung Tiap Shift* untuk 10–20 bahan utama per outlet.
   - Wajibkan semua penjualan lewat POS.
2. **Laba rugi bulanan, tahap minimal:** input biaya bulanan + laporan omzet/HPP/laba per outlet dengan badge kualitas + kunci bulan. Bisa dipakai untuk Oktober.
3. **Kontrol Harian:** penjualan vs uang (data sudah ada) lalu selisih stok teoretis vs aktual, dengan teks WhatsApp.
4. **Pusat aktif:** lokasi Pusat, impor belanja ke pusat, laporan bulanan pusat.
5. **Permintaan stok besok.**

**Risiko:**
- Angka laba rugi akan "jelek" di awal karena resep dan opname belum lengkap. Badge kualitas wajib supaya tidak disalahartikan.
- Opname harian butuh disiplin PIC. Mulailah dengan sedikit bahan.
- Kalau sebagian penjualan masih di luar POS, kontrol stok tidak berarti.
- Perangkat dan Worker POS masih paket gratis; jangan tergantung pada laporan berat di jam sibuk.

## 7. Pertanyaan untuk CEO (maks. 10)

1. Mulai tanggal berapa **semua** penjualan F&B wajib lewat POS (tanpa nota/catatan di luar sistem)?
2. Omzet resmi laba rugi: POS saja, atau laporan harian boleh dipakai selama POS belum jalan?
3. Setuju outlet "Gudang" diaktifkan dan diberi nama **Pusat (Rumah Ibu Putri)**? Siapa PIC opname pusat dan kirim barang?
4. Pembelian langsung oleh outlet (es batu, sayur) boleh tetap masuk ke outlet, atau semuanya lewat pusat?
5. Siapa yang mengisi biaya bulanan (gaji, sewa, listrik, gas, internet, operasional): Ita, accounting, atau keduanya? Siapa yang mengunci bulan?
6. Thrifting: bagian pemilik titipan dihitung sebagai biaya bagi hasil (bukan HPP)? Apakah thrift ikut menanggung gaji/operasional?
7. Ambang "selisih" harian: persen dan/atau rupiah berapa per outlet (setting yang ada sekarang bisa dipakai)?
8. Bahan apa saja yang dihitung harian per outlet (*Hitung Tiap Shift*) — siapa yang memilih daftar awalnya?
9. Draf September: perlu disusun ulang dengan rumus pemilik setelah data ada, atau September ditutup dengan catatan "modal = perkiraan"?
10. Manajer outlet boleh melihat laba rugi outletnya sendiri (tanpa rincian gaji per orang)?
