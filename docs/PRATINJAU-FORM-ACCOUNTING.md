# Pratinjau Form: Laporan Harian Accounting → CEO

> 🔒 **CONFIDENTIAL — HANYA CEO DAN ACCOUNTING**
> Form ini SATU-SATUNYA di seluruh sistem yang isinya tidak bisa dibaca siapa
> pun kecuali CEO dan Accounting sendiri — bahkan Ibu Sabrina (Pusat Pelaporan,
> yang bisa membaca hampir semua laporan lain) TIDAK bisa membuka laporan ini.
> Dia cuma menerima 4 angka rekap (lihat bagian terakhir dokumen ini).

> Dokumen ini BUKAN dokumentasi teknis. Isinya menggambarkan persis apa yang akan
> dilihat dan diisi Accounting di layar, dari atas sampai bawah, setiap hari —
> supaya bisa dicocokkan dengan format asli di `docs/FORMAT-ASLI-03-ACCOUNTING.md`.

**Cara baca tabel:** Tipe = bentuk isian. Wajib diisi? = kalau "Ya" laporan tidak
bisa dikirim kalau kosong. Perlu bukti foto/video? = kalau "Ya" sistem menolak
kirim kalau belum ada foto/video yang dilampirkan.

---

## 🔒 Bagian yang TERISI OTOMATIS

### Identitas

| Yang tampil | Dari mana |
|---|---|
| Tanggal hari ini | Jam sistem, zona waktu Jakarta |
| Nama Accounting | Nama akun yang sedang login |

### Laporan Personal Marketing

Sama seperti form lain — status PTA/PTE Accounting sendiri hari ini + undangan/closing bulan berjalan, diambil dari form Personal Marketing miliknya.

---

## ✍️ Bagian yang DIISI ACCOUNTING

### Blok 1 · Posisi Saldo Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Daftar saldo bank (nama bank, saldo) | Tabel (bisa tambah baris) | Tidak | Tidak |
| *(Total saldo bank)* | 🔒 Dihitung otomatis (jumlah semua baris di tabel) | — | — |
| Cash kantor | Uang (Rp) | Tidak | Tidak |
| Cash outlet/resto | Uang (Rp) | Tidak | Tidak |
| Cash lainnya | Uang (Rp) | Tidak | Tidak |
| *(Total cash)* | 🔒 Dihitung otomatis | — | — |
| *(Total dana tersedia hari ini)* | 🔒 Dihitung otomatis (total saldo bank + total cash) | — | — |

*Dari format asli §1 "POSISI SALDO HARI INI".*

### Blok 2 · Uang Masuk Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Cicilan konsumen | Uang (Rp) | Tidak | Tidak |
| Booking/DP | Uang (Rp) | Tidak | Tidak |
| Pelunasan | Uang (Rp) | Tidak | Tidak |
| Pembayaran lainnya (konsumen) | Uang (Rp) | Tidak | Tidak |
| *(Total Koperumnas)* | 🔒 Dihitung otomatis | — | — |
| Indokopi | Uang (Rp) | Tidak | Tidak |
| Indosteak | Uang (Rp) | Tidak | Tidak |
| Unit usaha lainnya | Uang (Rp) | Tidak | Tidak |
| Penerimaan lain (keterangan, nominal) | Tabel (bisa tambah baris) | Tidak | Tidak |
| **Total uang masuk hari ini** | 🔒 Dihitung otomatis (jumlah semua di atas) — **ini yang dipakai sebagai "total_masuk" utk rekap Sabrina, lihat bagian terakhir** | — | — |
| Metode -- Bank | Uang (Rp) | Tidak | Tidak |
| Metode -- Cash | Uang (Rp) | Tidak | Tidak |
| Metode -- QRIS | Uang (Rp) | Tidak | Tidak |
| Metode -- Lainnya | Uang (Rp) | Tidak | Tidak |

*Dari format asli §2 "UANG MASUK HARI INI".*

### Blok 3 · Detail Penerimaan Konsumen

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Daftar penerimaan (nama konsumen, no. konsumen, lokasi, untuk pembayaran, nominal, masuk rekening, sudah input sistem) | Tabel (bisa tambah baris) | Tidak | Tidak |
| Total transaksi masuk | Angka | Tidak | Tidak |
| Pembayaran belum teridentifikasi | Teks panjang | Tidak | Tidak |

*Dari format asli §3 "DETAIL PENERIMAAN KONSUMEN".*

> 🔒 **Berisi nama konsumen — tidak pernah keluar dari form ini.** Tabel ini
> satu-satunya tempat di seluruh sistem yang mencatat nama+nomor konsumen
> terkait pembayaran. Tidak pernah, dalam bentuk apa pun, ditampilkan ke divisi
> lain atau ke rekap Sabrina — lihat aturan mutlak di bagian terakhir dokumen.

### Blok 4 · Uang Keluar Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Daftar pengeluaran (keperluan, divisi/lokasi, nominal, penerima, rekening/cash, ACC, bukti) | Tabel (bisa tambah baris) | Tidak | Tidak |
| **Total uang keluar** | 🔒 Dihitung otomatis — **ini yang dipakai sebagai "total_keluar" utk rekap Sabrina** | — | — |

*Dari format asli §4 "UANG KELUAR HARI INI".*

### Blok 5 · Petty Cash

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Saldo awal petty cash | Uang (Rp) | Tidak | Tidak |
| Pengisian | Uang (Rp) | Tidak | Tidak |
| Pemakaian hari ini | Uang (Rp) | Tidak | Tidak |
| Saldo akhir fisik | Uang (Rp) | Tidak | Tidak |
| Bukti lengkap | Ya / Tidak | Tidak | Tidak |
| Pengeluaran tanpa bukti | Teks panjang | Tidak | Tidak |

*Dari format asli §5 "PETTY CASH".*

### Blok 6 · Cashflow Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| *(Saldo awal hari)* | 🔒 Dihitung otomatis (saldo akhir hari sebelumnya) | — | — |
| *(Uang masuk)* | 🔒 Diambil dari Blok 2 | — | — |
| *(Uang keluar)* | 🔒 Diambil dari Blok 4 | — | — |
| *(Net cashflow hari ini)* | 🔒 Dihitung otomatis | — | — |
| *(Saldo akhir)* | 🔒 Dihitung otomatis | — | — |
| Status | Pilih warna (🟢 Positif / 🟡 Perlu dikontrol / 🔴 Defisit) | Tidak | Tidak |

*Dari format asli §6 "CASHFLOW HARI INI". Semua angka di blok ini adalah hasil hitungan dari blok-blok sebelumnya (§1, §2, §4) — Accounting cuma memilih status warnanya, tidak mengetik ulang angka.*

### Blok 7 · Tagihan / Kewajiban Jatuh Tempo

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Jatuh tempo hari ini (keterangan, nominal) | Tabel (bisa tambah baris) | Tidak | Tidak |
| *(Total hari ini)* | 🔒 Dihitung otomatis | — | — |
| Jatuh tempo 7 hari ke depan (keterangan, tanggal, nominal) | Tabel (bisa tambah baris) | Tidak | Tidak |
| *(Total 7 hari)* | 🔒 Dihitung otomatis | — | — |
| Total kewajiban 30 hari ke depan | Uang (Rp) | Tidak | Tidak |
| Prioritas pembayaran | Teks panjang | Tidak | Tidak |

*Dari format asli §7 "TAGIHAN / KEWAJIBAN JATUH TEMPO".*

### Blok 8 · Kebutuhan Pembangunan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| *(Daftar kebutuhan: lokasi, kebutuhan, nominal, deadline, urgensi)* | 🔒 Ditampilkan otomatis dari laporan **Kepala Pembangunan** hari itu (kebutuhan material borongan + rencana infrastruktur yang punya anggaran) | — | — |
| *(Total kebutuhan pembangunan)* | 🔒 Dihitung otomatis | — | — |

*Dari format asli §8 "KEBUTUHAN PEMBANGUNAN". Ini BUKAN diketik Accounting — sesuai keputusan yang sudah disetujui, Accounting menerima angka kebutuhan dana pembangunan langsung dari laporan Kepala Pembangunan (yang sudah mencatatnya di form-nya sendiri), bukan menulis ulang dari WhatsApp/percakapan lain. Ini butuh jalur data baru yang belum ada sebelumnya — sama pola dengan bagaimana Kepala Pembangunan menerima data unit dari PIC Lokasi.*

### Blok 9 · Tanah / Lahan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Pembayaran lahan jatuh tempo | Teks panjang | Tidak | Tidak |
| Daftar kewajiban lahan (lokasi, pemilik, total kewajiban, sudah dibayar, sisa, jatuh tempo) | Tabel (bisa tambah baris) | Tidak | Tidak |
| *(Total kebutuhan pembayaran lahan)* | 🔒 Dihitung otomatis | — | — |

*Dari format asli §9 "TANAH / LAHAN".*

### Blok 10 · Kontraktor / Supplier / DTI

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Kontraktor jatuh tempo | Uang (Rp) | Tidak | Tidak |
| *(Precast/DTI)* | 🔒 Ditampilkan otomatis dari laporan **DTI** hari itu (kebutuhan belanja material) | — | — |
| *(Material -- dari Pembangunan)* | 🔒 Ditampilkan otomatis, sama sumbernya dengan Blok 8 | — | — |
| *(Infrastruktur/jalan -- dari Pembangunan)* | 🔒 Ditampilkan otomatis, sama sumbernya dengan Blok 8 | — | — |
| Listrik/utilitas proyek | Uang (Rp) | Tidak | Tidak |
| Kewajiban lainnya | Uang (Rp) | Tidak | Tidak |
| *(Total)* | 🔒 Dihitung otomatis | — | — |
| Yang paling urgent | Teks panjang | Tidak | Tidak |

*Dari format asli §10 "KONTRAKTOR / SUPPLIER / DTI".*

> ⚠️ **Blok ini campuran — mohon dicek satu per satu.** "Kontraktor jatuh
> tempo" dan "Listrik/utilitas proyek" saya anggap catatan pembayaran milik
> Accounting sendiri (tidak ada di laporan divisi lain), jadi tetap diketik
> manual. "Precast/DTI", "Material", dan "Infrastruktur/jalan" saya anggap
> angka yang SAMA dengan yang sudah dicatat DTI/Pembangunan di laporan mereka,
> jadi saya jadikan otomatis. Kalau pembagian ini salah — misalnya
> "Material" ternyata beda dari yang dicatat Pembangunan — tolong dikoreksi.

### Blok 11 · Piutang / Uang yang Harus Ditagih

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Piutang konsumen | Uang (Rp) | Tidak | Tidak |
| Tunggakan konsumen | Uang (Rp) | Tidak | Tidak |
| Piutang kontraktor | Uang (Rp) | Tidak | Tidak |
| Piutang operasional lahan | Uang (Rp) | Tidak | Tidak |
| Piutang lainnya | Uang (Rp) | Tidak | Tidak |
| *(Total piutang)* | 🔒 Dihitung otomatis | — | — |
| Target penagihan hari ini | Uang (Rp) | Tidak | Tidak |
| Tertagih | Uang (Rp) | Tidak | Tidak |
| *(Pencapaian %)* | 🔒 Dihitung otomatis | — | — |
| Tagihan besar belum masuk (keterangan, nominal) | Tabel (bisa tambah baris) | Tidak | Tidak |
| PIC penagihan | Teks panjang | Tidak | Tidak |

*Dari format asli §11 "PIUTANG / UANG YANG HARUS DITAGIH".*

### Blok 12 · Rekonsiliasi Bank

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Semua mutasi bank dicek | Ya / Tidak | Tidak | Tidak |
| Semua uang masuk teridentifikasi | Ya / Tidak | Tidak | Tidak |
| Semua uang keluar ada bukti | Ya / Tidak | Tidak | Tidak |
| Saldo buku = saldo bank | Ya / Tidak | Tidak | Tidak |
| Selisih | Uang (Rp) | Tidak | Tidak |
| Transaksi belum teridentifikasi | Teks panjang | Tidak | Tidak |

*Dari format asli §12 "REKONSILIASI BANK".*

### Blok 13 · Rekonsiliasi Resto — Tiga Pengukuran, Satu Layar

Ini blok yang berubah paling banyak dari format asli. **Tiga orang menghitung
uang yang sama dari tiga sumber berbeda**, dan sekarang ketiganya tampil
berdampingan supaya Accounting bisa langsung membandingkan tanpa harus
menghubungi siapa-siapa:

**Indosteak**

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| *(Omzet versi Manager Indosteak)* | 🔒 Otomatis, dari laporan Manager Resto hari itu | — | — |
| *(Omzet versi Ita/sistem)* | 🔒 Otomatis, dari laporan Ita hari itu | — | — |
| Cash (versi bank/Accounting) | Uang (Rp) | Tidak | Tidak |
| QRIS/Bank (versi bank/Accounting) | Uang (Rp) | Tidak | Tidak |
| *(Total pembayaran versi Accounting)* | 🔒 Dihitung otomatis | — | — |
| *(Selisih — ketiga angka dibandingkan)* | 🔒 Dihitung otomatis | — | — |

**Indokopi** — kolom yang sama persis, untuk Indokopi.

*Dari format asli §13 "REKONSILIASI RESTO". Dokumen asli minta Accounting
mengetik ULANG "omzet sistem" -- sekarang tidak lagi. Manager dan Ita sudah
menghitung omzet dari sudut pandang masing-masing (Manager dari catatannya
sendiri, Ita dari sistem POS) — keduanya tampil otomatis di sini. Accounting
cuma mengetik angka dari sisi BANK (cash yang benar-benar diterima/masuk
rekening), lalu sistem menghitung selisih di antara ketiganya. Kalau ada
selisih, itu yang perlu ditelusuri — bukan menunggu tiga orang lapor manual
lalu dibandingkan belakangan.*

### Blok 14 · Transaksi Bermasalah

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Pembayaran tanpa bukti | Teks panjang | Tidak | Tidak |
| Transfer belum teridentifikasi | Teks panjang | Tidak | Tidak |
| Pengeluaran belum ACC | Teks panjang | Tidak | Tidak |
| Selisih kas | Teks panjang | Tidak | Tidak |
| Selisih bank | Teks panjang | Tidak | Tidak |
| Transaksi perlu klarifikasi | Teks panjang | Tidak | Tidak |
| Total nilai yang masih bermasalah | Uang (Rp) | Tidak | Tidak |

*Dari format asli §14 "TRANSAKSI BERMASALAH", semua baris ada.*

### Blok 15 · Kebutuhan Dana CEO

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| *(Dana tersedia)* | 🔒 Diambil dari Blok 1 | — | — |
| Kewajiban urgent | Uang (Rp) | Tidak | Tidak |
| Kebutuhan operasional | Uang (Rp) | Tidak | Tidak |
| *(Kebutuhan pembangunan)* | 🔒 Diambil dari Blok 8 | — | — |
| *(Kebutuhan lahan)* | 🔒 Diambil dari Blok 9 | — | — |
| *(Total kebutuhan)* | 🔒 Dihitung otomatis | — | — |
| *(Surplus/kekurangan dana)* | 🔒 Dihitung otomatis | — | — |

*Dari format asli §15 "KEBUTUHAN DANA CEO". "Kewajiban urgent" dan "Kebutuhan operasional" tidak punya sumber otomatis yang jelas (belum tentu sama dengan angka di blok lain), jadi tetap diketik manual.*

### Blok 16 · Prioritas Pembayaran — Minta ACC CEO

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Daftar prioritas (tingkat, untuk, nominal, deadline, dampak jika tidak dibayar) | Tabel (bisa tambah baris) | Tidak | Tidak |

*Dari format asli §16 "PRIORITAS PEMBAYARAN – MINTA ACC CEO".*

> ❓ **PERLU KEPUTUSAN ANDA — belum saya putuskan sendiri.** Di semua form lain,
> "butuh keputusan CEO" itu SATU tombol per laporan (centang + judul), lalu
> masuk ke satu antrean. Tapi §16 ini secara alami berisi SAMPAI 3 prioritas
> pembayaran berbeda dalam satu laporan yang semuanya perlu ACC CEO
> (Bayar/Tunda/Cicil) satu per satu. Ada dua pilihan:
> **(a)** tetap satu tombol keputusan per laporan seperti form lain, isi
> tabel ini dianggap lampiran informasi tambahan yang CEO baca sendiri saat
> memutuskan; atau
> **(b)** setiap baris di tabel ini otomatis jadi baris keputusan TERPISAH di
> antrean CEO (jadi bisa sampai 3 keputusan sekaligus dari satu laporan).
> (b) lebih sesuai dengan apa yang dokumen aslinya minta, tapi butuh mengubah
> cara antrean keputusan bekerja (sekarang cuma satu per laporan). Mohon
> pilih sebelum saya kerjakan.

### Blok 17 · Proyeksi Cashflow Besok

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Perkiraan uang masuk | Uang (Rp) | Tidak | Tidak |
| Perkiraan uang keluar | Uang (Rp) | Tidak | Tidak |
| Perkiraan saldo akhir | Uang (Rp) | Tidak | Tidak |
| Tagihan yang harus dikejar besok | Teks panjang | Tidak | Tidak |
| Pembayaran yang harus dilakukan | Teks panjang | Tidak | Tidak |

*Dari format asli §17 "PROYEKSI CASHFLOW BESOK", semua baris ada.*

### Blok 18 · Executive Summary untuk CEO

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| *(8 angka ringkasan: saldo, masuk, keluar, net, piutang, kewajiban 7 hari, kebutuhan pembangunan, kebutuhan lahan, surplus/kekurangan)* | 🔒 Semua dihitung otomatis dari blok-blok di atas | — | — |
| Catatan Accounting | Teks panjang | Tidak | Tidak |

*Dari format asli §18 "EXECUTIVE SUMMARY UNTUK CEO". "3 HAL YANG HARUS DIPUTUSKAN CEO" di dokumen asli terkait langsung dengan pertanyaan di Blok 16 — lihat catatan di sana; belum dibuat sampai keputusan (a)/(b) ditentukan.*

---

## Tombol kirim

Belum ada aturan penolakan khusus di form ini (beda dengan Manager Resto/Ita
yang menolak kalau selisih tanpa penyebab) — laporan bisa dikirim walau ada
kolom kosong. Beri tahu kalau Accounting butuh aturan serupa (misalnya:
laporan ditolak kalau "Saldo buku = saldo bank" dijawab Tidak tapi kolom
selisih kosong).

---

## Field di format asli yang TIDAK dibuat, dan alasannya

| Field di `FORMAT-ASLI-03-ACCOUNTING.md` | Kenapa tidak dibuat sebagai isian |
|---|---|
| Semua baris "TOTAL ..." di tiap blok (§1, §2, §4, §7, §11, dst.) | Dihitung otomatis dari baris-baris di atasnya |
| §6 seluruh isi (saldo awal, uang masuk, uang keluar, net, saldo akhir) | Dihitung otomatis dari §1/§2/§4 -- Accounting cuma pilih status warna |
| §8 seluruh isi (kebutuhan pembangunan) | Rollup otomatis dari laporan Kepala Pembangunan |
| §10 "Precast/DTI", "Material", "Infrastruktur/jalan" | Rollup otomatis dari laporan DTI/Pembangunan (lihat catatan Blok 10) |
| §13 "Omzet sistem" Indosteak & Indokopi | Rollup otomatis dari Manager Resto & Ita (lihat Blok 13) |
| §15 "Dana tersedia", "Kebutuhan pembangunan", "Kebutuhan lahan", totalnya | Dihitung/diambil otomatis dari blok lain |
| §18 seluruh 8 angka ringkasan | Dihitung otomatis dari blok-blok di atas |
| Header "📅 Tanggal", "👤 Accounting" | Diisi otomatis oleh kotak Identitas |
| "👤 Accounting: __________", "🕐 Jam laporan" (footer §18) | Nama dari kotak Identitas; jam otomatis dicatat sistem saat laporan dikirim |
| "🔐 LAPORAN DETAIL KEUANGAN..." dan "PRINSIP ACCOUNTING" (footer) | Kalimat aturan/prinsip, bukan isian |

---

## 🔒 Yang keluar dari form ini vs. yang tidak pernah keluar

CEO bisa menunjukkan bagian ini langsung untuk membuktikan batas kerahasiaan.

**Cuma 4 angka berikut yang bisa dilihat Ibu Sabrina** (lewat rekap khusus,
bukan membuka laporan ini):

| Angka yang boleh keluar | Diambil dari |
|---|---|
| Total uang masuk hari ini | Blok 2 |
| Total uang keluar hari ini | Blok 4 |
| Selisih (masuk − keluar) | Dihitung otomatis dari dua angka di atas |
| Status warna laporan | Warna yang dipilih Accounting saat kirim |

**Semua yang lain di form ini — TIDAK PERNAH, dalam bentuk apa pun, terlihat
oleh siapa pun selain CEO dan Accounting sendiri.** Termasuk semua saldo bank
(Blok 1), nama & nomor konsumen (Blok 3), rincian pengeluaran per pos (Blok 4),
piutang (Blok 11), rekonsiliasi resto (Blok 13), kebutuhan dana (Blok 15),
dan seluruh executive summary (Blok 18). Ini bukan sekadar niat baik — dijamin
lewat pengaturan hak akses di database itu sendiri, bukan cuma "tidak
ditampilkan di layar" (yang masih bisa dilihat kalau diakses lewat jalan lain).
Sudah diuji langsung dengan mencoba membaca laporan Accounting sebagai Ibu
Sabrina dan sebagai karyawan biasa — keduanya ditolak.

---

**Untuk ditinjau — 2 hal yang butuh keputusan sebelum saya tulis kode:**
1. **Blok 10**, pembagian mana yang otomatis (dari DTI/Pembangunan) vs manual — sudah benar?
2. **Blok 16/18**, cara "3 prioritas pembayaran" masuk ke antrean keputusan CEO — opsi (a) satu tombol keputusan, atau (b) sampai 3 keputusan terpisah per laporan?
