# Rancangan Kontrol Harian & Laba Rugi Bulanan (Oktober 2026)

Dokumen diskusi untuk CEO, Ita, dan pemilik. Angka "hari ini" dibaca langsung dari database produksi pada 6 Oktober 2026 (baca-saja).

**Pembaruan 7 Oktober 2026 — keputusan CEO (final):**
- **Pilot 1 November 2026 di Indokopi Lite Kemayoran saja.** Cempaka Putih, Pekansari, dan Jatinegara menyusul setelah Kemayoran stabil. Di Kemayoran, laporan harian WhatsApp manual tetap berjalan paralel selama 2 minggu pertama (lihat bagian 8 dan 9).
- **Pusat (Rumah Ibu Putri) menjadi lokasi stok.** CEO ingin melihat nilai aset persediaan di pusat dan di tiap outlet, dan barang terjual berpindah dari aset ke HPP. Rencananya menunggu persetujuan; belum dibangun.
- **Alur laporan bulanan:** Draft → Ditinjau Ita → Final Akunting. CEO hanya melihat laporan Final (bagian 3a).
- Cloudflare tetap paket Free untuk sekarang.
- **Kontrol Harian (bagian 2) SUDAH DIBANGUN** pada 7 Oktober 2026: menu **Kontrol Harian** di sistem laporan.

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

**Status: sudah dibangun (7 Oktober 2026).** Menu **Kontrol Harian** di sistem laporan. Ita, CEO, dan Admin bisa menulis catatan; Pusat dan Accounting hanya melihat. Data stok dan penjualan ditarik dari POS. **Uang masuk diambil dari isian Cash/QRIS/Bank di Laporan Harian Kontrol F&B Ita** (field yang sudah ada, tidak ada input baru). Status **OK** hanya muncul kalau semua data lengkap. Kalau ada yang kurang (tidak ada shift, tidak ada opname buka/tutup, produk terjual tanpa resep, Laporan Kontrol F&B belum ada atau masih draf), statusnya **Data belum lengkap** beserta daftar yang kurang.

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

## 3a. Alur status laporan bulanan (keputusan CEO, 7 Oktober 2026)

| Status | Siapa | Yang dilakukan | Siapa yang melihat |
|---|---|---|---|
| **Draft** | Sistem / Ita | Angka omzet, HPP, stok tersusun otomatis dari POS. Ita mulai meninjau. | Ita, Accounting |
| **Ditinjau Ita** | Ita | Ita memeriksa penjualan dan stok (sisa aset, pemakaian), memberi catatan, lalu menandai "Ditinjau". | Ita, Accounting |
| **Final Akunting** | Accounting | Accounting mengisi biaya bulanan (kontrak sewa, gaji, dan lainnya), memeriksa, lalu menetapkan Final. Bulan terkunci. | **CEO** (hanya Final), Ita, Accounting |

- **CEO hanya melihat laporan berstatus Final Akunting.** Bulan yang belum final tidak tampil di layar CEO; yang tampil hanya keterangan "Bulan X belum final (status: Ditinjau Ita)".
- **Membuka kembali bulan yang sudah Final** wajib menyertakan alasan dan tercatat: siapa, kapan, alasan, dan status sebelum/sesudah. Setelah dibuka kembali, status kembali ke Ditinjau Ita.
- Biaya per baris menyimpan siapa yang mengisi dan kapan. Transaksi bulan yang sudah final tidak bisa diubah; koreksi dicatat di bulan berjalan.

## 4. Stok pusat "Pusat (Rumah Ibu Putri)"

- **Disetujui CEO (7 Oktober 2026): Pusat menjadi lokasi stok.** **Fase A dibangun 8 Oktober 2026** (pos-fnb `01d4fc9`, laporan `a3a4672`): lokasi "Pusat (Rumah Ibu Putri)" (gudang pusat, tanpa kasir dan shift), harga kirim Pindah Stok = rata-rata Pusat (terkunci; pemilik boleh mengganti dengan alasan, tercatat di audit), kiriman tidak pernah membuat stok Pusat minus, impor belanja bawaan Pusat dengan centang "Belanja langsung ke outlet (tidak lewat pusat)", opname Pusat lewat impor opname. Akses POS ke Pusat: CEO, Admin (migrasi 0075), Ita. Catatan: outlet "Gudang" lama ternyata adalah outlet DEMO yang sudah diarsipkan ("[ARSIP DEMO] Gudang"), jadi Pusat akan menjadi lokasi baru, bukan menghidupkan arsip itu.
- Pembelian masuk ke pusat. Outlet meminta barang lewat **Pindah Stok**; pusat mengirim, outlet menerima.
- Bulanan pusat: stok awal pusat (opname akhir bulan lalu) + pembelian − stok akhir pusat (opname akhir bulan) = barang keluar. Angka ini dicocokkan dengan Σ pindah stok terkirim. Selisihnya adalah kehilangan atau pencatatan yang kurang, **bukan HPP**.
- **Dampak ke Impor Belanja (item 3, jangan diubah dulu):**
  - Saat ini setiap baris nota memilih outlet tujuan.
  - Usulan setelah keputusan CEO: outlet bawaan setiap baris = Pusat. Pengecualian per baris tetap boleh untuk barang yang dibeli langsung oleh outlet (misalnya es batu, sayur harian).
  - Aturan "tanggal tidak sebelum opname terakhir outlet baris itu" otomatis berlaku untuk pusat.

## 4a. Nilai Aset Persediaan (Pusat fase B, dibangun 8 Oktober 2026)

Halaman `/aset-persediaan` (tautan dari Kontrol Harian), **baca saja** untuk CEO, Admin, Ita, dan Accounting. Gerbangnya `boleh_lihat_aset_persediaan()` (migrasi 0076). Ita dikenali dari tanda "akses semua outlet POS", bukan dari penugasan Kontrol F&B, karena penugasan itu juga dipegang Mba Rika.

Semua angka dihitung dengan SQL di pos-fnb (`/api/integrasi/aset-persediaan`). Sistem laporan hanya menampilkan.

- **Nilai persediaan saat ini:**
  - Nilai = Σ (stok × harga rata-rata) per lokasi: Pusat lebih dulu, lalu tiap outlet F&B aktif. Total = jumlah nilai lokasi.
  - Bahan yang **ada stoknya tetapi belum berharga** didaftar terpisah dan **tidak pernah dinilai Rp0**.
  - **Stok minus** juga didaftar terpisah dan tidak mengurangi nilai.
  - Selama salah satu dari dua daftar itu belum kosong, halaman menampilkan "belum lengkap", bukan angka final.
  - Bahan "biaya saja" (tidak dilacak stoknya) tidak ikut.
- **HPP bulanan:**
  - HPP = Σ HPP yang tersimpan pada tiap penjualan saat dibayar (snapshot), per outlet F&B, menurut bulan bisnis.
  - Ikut ditampilkan **jumlah penjualan yang HPP-nya belum lengkap**: ada bahan biaya saja tanpa harga, atau HPP 0 karena produk tanpa resep. Selama angka ini bukan 0, HPP bulan itu dibaca sebagai **batas bawah**.
  - Refund tidak mengurangi HPP. Pusat tidak menjual, jadi tidak punya baris HPP.
- **Nilai saat ini, belum per tanggal.** Untuk laba rugi diperlukan nilai pada akhir bulan. Lihat di bawah.

**Cara angka ini mengalir ke laba rugi bulanan (§3, §3a), belum dibangun:**

1. **Draft.**
   - Pada akhir bulan, sistem menyimpan **snapshot** nilai persediaan per lokasi, beserta daftar tanpa harga dan stok minus, ke bulan itu.
   - Snapshot diambil setelah opname akhir bulan terkonfirmasi. Nilai yang dipakai adalah snapshot, bukan nilai "saat ini" yang terus berubah.
   - Baris HPP diisi dari angka HPP bulanan di atas, beserta badge "x dari y penjualan HPP belum lengkap".
2. **Ditinjau Ita.**
   - Ita mencocokkan nilai stok awal (snapshot bulan lalu) + pembelian − stok akhir (snapshot bulan ini) terhadap HPP penjualan dan Pindah Stok.
   - Untuk Pusat: barang keluar = stok awal + pembelian − stok akhir. Angka ini dicocokkan dengan Σ Pindah Stok terkirim (§4); selisihnya kehilangan atau pencatatan, bukan HPP.
   - Ita menulis catatan untuk bahan tanpa harga, stok minus, dan penjualan tanpa resep, lalu menandai "Ditinjau".
3. **Final Akunting.**
   - Accounting mengisi biaya dan menetapkan Final. Snapshot persediaan dan HPP bulan itu ikut terkunci; koreksi masuk ke bulan berjalan.
   - CEO melihat laba rugi dengan baris "Persediaan akhir" (aset) dan "HPP". Badge kualitas tetap tampil kalau saat Final masih ada pengecualian, sehingga angka final tidak pernah tampak lebih lengkap dari datanya.

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

*Terjawab 7 Oktober 2026:* no. 1 (POS mulai 1 November di Kemayoran), no. 3 (Pusat menjadi lokasi stok; nama dan PIC menyusul), no. 5 (Ita meninjau, Accounting mengisi biaya dan menetapkan Final, CEO hanya melihat Final). Pertanyaan lain masih terbuka.

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

## 8. Rollout: Kemayoran dulu (keputusan CEO, 7 Oktober 2026)

1. **1 November 2026: pilot di Indokopi Lite Kemayoran saja.** Menu kecil, volume rendah.
2. **2 minggu pertama:** laporan harian WhatsApp manual tetap jalan paralel. Ita membandingkan Kontrol Harian dengan laporan manual setiap pagi.
3. **Syarat lanjut ke outlet berikutnya:** 2 minggu berturut-turut semua penjualan Kemayoran lewat POS, opname buka/tutup terisi setiap hari, status Kontrol Harian "OK" atau "Selisih" dengan penyebab tertulis (bukan "Data belum lengkap"), dan tidak ada gangguan aplikasi yang membuat kasir pindah ke nota kertas lebih dari sekali seminggu.
4. **Urutan berikutnya:** Cempaka Putih, Pekansari, lalu Jatinegara, masing-masing dengan pola yang sama.

## 9. Daftar kesiapan Kemayoran untuk 31 Oktober 2026

Dibaca dari produksi pada 7 Oktober 2026 (baca-saja). **OK** = siap, **Kurang** = belum ada, **Risiko** = ada tapi perlu dicek.

| Butir | Keadaan sekarang | Status | Siapa bertindak |
|---|---|---|---|
| Perangkat kasir | **0 perangkat** terdaftar untuk Kemayoran | Kurang | Owner (menu Perangkat) + tablet outlet dihubungkan sekali |
| Akun kasir | 2 kasir aktif | OK | — |
| PIN kasir | **Kedua kasir masih memakai PIN bawaan seed** | Risiko | Manajer outlet: Karyawan → Atur Ulang PIN (PIN sementara), lalu kasir Ganti PIN |
| Stok awal (Excel) & opname awal | **0 baris stok** di Kemayoran; satu-satunya opname (berkala, 29 Sep) dibatalkan; belum ada impor opname | Kurang | PIC Kemayoran menghitung, Ita mengimpor lewat Asisten AI > Impor opname |
| Resep 16 produk | **4 dari 16** punya resep. Belum: Butterscotch, Caffe Latte, Caramel Sea Salt, Coklat Bestie, Es Leci Tea, Es teh manis, Gultic blok m, Kopi Aren Tua, matcha aren, matcha latte, Mie Bestie, Roti Kenangan Coklat Keju | Kurang | Ita (template resep per produk, lembar IKLK) |
| Harga bahan | 6 bahan dipakai resep Kemayoran, **0 punya harga** | Kurang | Ita / pembelian: impor opname dengan harga, atau impor belanja |
| Bahan "Hitung Tiap Shift" | **0 bahan** ditandai (tanpa ini opname buka/tutup kosong dan Kontrol Harian selalu "Data belum lengkap") | Kurang | Ita + manajer: tandai 10–20 bahan utama di menu Bahan |
| Wajib opname shift | Aktif | OK | — |
| Batas hari bisnis | 04.00, sudah dikonfirmasi | OK | — |
| Pembayaran | QRIS dan Transfer aktif, Tunai nonaktif | OK | — |
| Tunai di setting outlet | **Masih aktif**, padahal metode Tunai nonaktif. Kasir akan diminta modal dan hitung kas | Risiko | Owner/manajer: matikan "Tunai di outlet" di menu Outlet |
| Pajak | 10% (Indokopi) | OK | — |
| Penerima laporan WhatsApp | **0 penerima** untuk laporan tutup shift | Kurang | Manajer: menu Penerima WA |
| Penugasan Kontrol F&B Ita | Ita punya Kontrol F&B untuk Jatinegara, Cempaka, Pekansari, **tapi tidak untuk Kemayoran**. Akibatnya uang masuk Kemayoran tidak bisa diisi dan Kontrol Harian selalu "Data belum lengkap" | Kurang | Admin: tambah penugasan kontrol_fnb Ita untuk Kemayoran |
| Laporan Manajer Resto Kemayoran | 1 penugasan ada | OK | — |
| Pemetaan outlet laporan ↔ POS | Sudah dipetakan | OK | — |
| Pelatihan runbook | Tidak tercatat di sistem | Risiko | Manajer Kemayoran + Ita: latih kasir dengan `RUNBOOK-HARI-PERTAMA.md` minggu terakhir Oktober |
| Gladi (rehearsal) di outlet | Belum pernah di tablet Kemayoran. **Gladi otomatis 1 hari di bisnis uji (5 Okt, paket Cloudflare Free): 68% muat halaman penuh gagal 503 ("Worker exceeded resource limits"), layar kasir /pos 94% dan Buka Shift 82%; bayar butuh 10–21 detik; satu order 17–96 detik; 2 dari 30 order gagal walau dicoba ulang.** Navigasi di dalam aplikasi hampir tidak pernah gagal (0,1%). | Risiko (penghalang) | CEO: naik ke Workers Paid sebelum 1 November, lalu gladi diulang; manajer + pengembang: gladi 1 hari di tablet Kemayoran |
| Cadangan database | Mingguan otomatis, uji pulih lolos; kunci belum disalin ke tempat kedua | Risiko | CEO: simpan salinan kunci |
