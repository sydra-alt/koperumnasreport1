# Pratinjau Form: Laporan Harian Manager Resto

> Dokumen ini BUKAN dokumentasi teknis. Isinya menggambarkan persis apa yang akan
> dilihat dan diisi Manager (Indosteak atau Indokopi) di layar, dari atas sampai
> bawah, setiap hari — supaya bisa dicocokkan dengan format asli di
> `docs/FORMAT-ASLI-05-MANAGER-RESTO.md`.
>
> Manager cuma mengurus SATU outlet. Kalau suatu saat ada Manager yang mengurus
> dua outlet, dia akan diminta pilih outlet dulu sebelum mengisi — sama seperti
> PIC yang mengurus 2 lokasi di form PIC Lokasi.

**Cara baca tabel:** Tipe = bentuk isian. Wajib diisi? = kalau "Ya" laporan tidak
bisa dikirim kalau kosong. Perlu bukti foto/video? = kalau "Ya" sistem menolak
kirim kalau belum ada foto/video yang dilampirkan.

---

## 🔒 Bagian yang TERISI OTOMATIS

### Identitas

| Yang tampil | Dari mana |
|---|---|
| Tanggal hari ini | Jam sistem, zona waktu Jakarta |
| Outlet (Indosteak/Indokopi) | Penugasan Manager di sistem |
| Nama Manager | Nama akun yang sedang login |

### Laporan Personal Marketing

Sama seperti semua form lain — kotak kecil berisi status laporan personal
(PTA/PTE) Manager sendiri hari ini + undangan/closing bulan berjalan, diambil
dari form Personal Marketing miliknya sendiri. **Catatan:** format asli Manager
Resto tidak menyebutkan bagian ini secara eksplisit, tapi kotak ini akan tetap
muncul karena semua karyawan wajib PTA/PTE setiap hari — sama seperti di form
lain. Beri tahu kalau ini tidak sesuai untuk Manager.

---

## ✍️ Bagian yang DIISI MANAGER

### Blok 1 · Karyawan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Total karyawan | Angka | Tidak | Tidak |
| Hadir | Angka | Tidak | Tidak |
| Izin/Sakit/Cuti | Angka | Tidak | Tidak |
| Terlambat | Angka | Tidak | Tidak |
| Seragam lengkap | Ya / Tidak | Tidak | Tidak |
| Briefing dilakukan | Ya / Tidak | Tidak | Tidak |
| Karyawan tidak hadir/terlambat | Teks panjang | Tidak | Tidak |
| Masalah karyawan | Teks panjang | Tidak | Tidak |

*Dari format asli §1 "KARYAWAN".*

### Blok 2 · Rekap Penjualan Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Total omzet | Uang (Rp) | Tidak | Tidak |
| Penjualan makanan | Uang (Rp) | Tidak | Tidak |
| Penjualan minuman | Uang (Rp) | Tidak | Tidak |
| Lainnya | Uang (Rp) | Tidak | Tidak |
| Cash | Uang (Rp) | Tidak | Tidak |
| QRIS | Uang (Rp) | Tidak | Tidak |
| Transfer/Bank | Uang (Rp) | Tidak | Tidak |
| Lainnya (metode) | Uang (Rp) | Tidak | Tidak |
| *(Total metode pembayaran)* | 🔒 Dihitung otomatis (jumlah 4 baris di atas) | — | — |
| Semua transaksi sudah masuk sistem | Ya / Tidak | Tidak | Tidak |
| Cash diterima | Uang (Rp) | Tidak | Tidak |
| Sudah ditransfer/disetor | Ya / Tidak | Tidak | Tidak |
| Jumlah disetor | Uang (Rp) | Tidak | Tidak |
| Sisa cash | Uang (Rp) | Tidak | Tidak |
| Bukti transfer/setoran | Ya / Tidak | Tidak | **Ya, kalau dijawab "Ya"** |

*Dari format asli §2 "REKAP PENJUALAN HARI INI". Baris "TOTAL" setelah metode pembayaran tidak diketik ulang — dihitung otomatis dari penjumlahan Cash+QRIS+Transfer+Lainnya, supaya tidak mungkin salah jumlah.*

### Blok 3 · Kontrol Stok Sistem vs Stok Aktual

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Stock opname dilakukan | Ya / Tidak | Tidak | Tidak |
| Ada selisih stok | Ya / Tidak | Tidak | Tidak |
| Daftar barang selisih (nama barang, stok sistem, stok aktual, kurang, lebih, dugaan penyebab, PIC terkait) | Tabel (bisa tambah baris) | Tidak | Tidak |

*Dari format asli §3 "KONTROL STOK SISTEM vs STOK AKTUAL".*

> ⚠️ **Aturan khusus dari daftar tugas Task 16**: kalau ada baris di tabel selisih
> dengan angka kurang/lebih yang tidak nol, kolom "dugaan penyebab" WAJIB diisi
> untuk baris itu — laporan ditolak kalau ada selisih tanpa penyebab. Ini beda
> dari kebanyakan field lain di form ini yang semuanya opsional.

### Blok 4 · Stok Habis / Kebutuhan Kiriman Pusat

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Sudah habis | Teks panjang | Tidak | Tidak |
| Akan habis / kebutuhan besok | Teks panjang | Tidak | Tidak |
| Jumlah yang dibutuhkan | Teks panjang | Tidak | Tidak |
| Harus dikirim tanggal | Teks singkat | Tidak | Tidak |

*Dari format asli §4 "STOK HABIS / KEBUTUHAN KIRIMAN PUSAT".*

> 📌 **Ini sumber data untuk Ita.** Empat baris di atas yang diketik Manager di
> sini akan tampil OTOMATIS di form Ita (blok "Kebutuhan Stok/RAB") — Ita tidak
> mengetik ulang, dia cuma menambahkan RAB dan status pengajuan ke Pak
> Eri/Bu Rika. Lihat pratinjau form Ita untuk detailnya.

### Blok 5 · Utilitas

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Es batu -- stok awal | Angka | Tidak | Tidak |
| Es batu -- pemakaian | Angka | Tidak | Tidak |
| Es batu -- sisa | Angka | Tidak | Tidak |
| Es batu -- kebutuhan besok | Angka | Tidak | Tidak |
| Air -- kondisi (Cukup/Kurang) | Pilih dari daftar | Tidak | Tidak |
| Air -- kebutuhan besok | Teks singkat | Tidak | Tidak |
| Listrik -- normal | Ya / Tidak | Tidak | Tidak |
| Listrik -- kondisi/meter | Teks singkat | Tidak | Tidak |
| Listrik -- ada gangguan | Teks singkat | Tidak | Tidak |
| Gas -- stok (tabung) | Angka | Tidak | Tidak |
| Gas -- terpakai | Angka | Tidak | Tidak |
| Gas -- sisa | Angka | Tidak | Tidak |
| Gas -- kebutuhan besok | Angka | Tidak | Tidak |
| Ada utilitas bermasalah | Teks panjang | Tidak | Tidak |

*Dari format asli §5 "UTILITAS".*

### Blok 6 · Kesiapan Dapur

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Soto siap | Ya / Tidak | Tidak | Tidak |
| Ayam siap | Ya / Tidak | Tidak | Tidak |
| Bahan makanan siap | Ya / Tidak | Tidak | Tidak |
| Bahan minuman siap | Ya / Tidak | Tidak | Tidak |
| Dapur bersih | Ya / Tidak | Tidak | Tidak |
| Semua menu utama siap jual | Ya / Tidak | Tidak | Tidak |
| Menu/bahan yang tidak tersedia | Teks panjang | Tidak | Tidak |
| Catatan kondisi dapur | Teks panjang | **Ya** | **Ya, setiap hari** |

*Dari format asli §6 "KESIAPAN DAPUR". Baris terakhir ("Catatan kondisi dapur") BUKAN field asli dari dokumen — ditambahkan supaya bisa memenuhi perintah dokumen "📹 WAJIB VIDEO kondisi dan kesiapan dapur" dengan cara yang sama seperti form PIC Lokasi: satu catatan wajib diisi + video wajib dilampirkan setiap hari, tidak tergantung jawaban field lain.*

### Blok 7 · Kesiapan Area Customer

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Meja bersih | Ya / Tidak | Tidak | Tidak |
| Kursi rapi | Ya / Tidak | Tidak | Tidak |
| Tisu tersedia | Ya / Tidak | Tidak | Tidak |
| Saus lengkap | Ya / Tidak | Tidak | Tidak |
| Sendok tersedia | Ya / Tidak | Tidak | Tidak |
| Garpu tersedia | Ya / Tidak | Tidak | Tidak |
| Peralatan makan bersih | Ya / Tidak | Tidak | Tidak |
| Area customer siap | Ya / Tidak | Tidak | Tidak |
| Kekurangan | Teks panjang | Tidak | Tidak |

*Dari format asli §7 "KESIAPAN AREA CUSTOMER".*

### Blok 8 · Kebersihan Outlet

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Depan resto | Ya / Tidak | Tidak | Tidak |
| Area makan | Ya / Tidak | Tidak | Tidak |
| Meja & kursi | Ya / Tidak | Tidak | Tidak |
| Dapur | Ya / Tidak | Tidak | Tidak |
| Area kasir | Ya / Tidak | Tidak | Tidak |
| Musala | Ya / Tidak | Tidak | Tidak |
| Kamar mandi/toilet | Ya / Tidak | Tidak | Tidak |
| Tempat sampah | Ya / Tidak | Tidak | Tidak |
| Area belakang | Ya / Tidak | Tidak | Tidak |
| Masalah kebersihan | Teks panjang | Tidak | Tidak |
| PIC yang harus memperbaiki | Teks singkat | Tidak | Tidak |

*Dari format asli §8 "KEBERSIHAN OUTLET".*

> ⚠️ **Perlu dicek:** baris "Dapur" di blok ini MIRIP dengan "Dapur bersih" di Blok 6 — tapi saya PERTAHANKAN keduanya sebagai dua pertanyaan terpisah karena konteksnya beda (Blok 6 = kesiapan sebelum buka/menjelang jam operasional, Blok 8 = audit kebersihan menyeluruh outlet). Kalau menurut Manager sehari-hari ini sebenarnya pertanyaan yang sama, beri tahu supaya digabung seperti kasus IT.

### Blok 9 · Video Kontrol Wajib

Manager wajib mengirim **10 video terpisah** setiap hari, masing-masing wajib ada buktinya sebelum laporan bisa dikirim:

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Video tampak depan resto | Centang | **Ya** | **Ya** |
| Video dari depan masuk sampai ke dalam | Centang | **Ya** | **Ya** |
| Video seluruh area customer | Centang | **Ya** | **Ya** |
| Video meja + tisu + saus + alat makan | Centang | **Ya** | **Ya** |
| Video dapur | Centang | **Ya** | **Ya** |
| Video persiapan makanan/soto/ayam | Centang | **Ya** | **Ya** |
| Video musala | Centang | **Ya** | **Ya** |
| Video kamar mandi | Centang | **Ya** | **Ya** |
| Video kebersihan outlet | Centang | **Ya** | **Ya** |
| Video suasana restoran saat ada customer | Centang | **Ya** | **Ya** |

*Dari format asli §9 "VIDEO KONTROL WAJIB" — semua 10 baris, persis nama-namanya, sesuai instruksi tugas Task 16 ("daftar 10 video kontrol wajib"). Kalau salah satu belum dilampirkan, laporan tidak bisa dikirim.*

### Blok 10 · Customer & Masalah Resto

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Customer hari ini | Angka | Tidak | Tidak |
| Komplain | Angka | Tidak | Tidak |
| Komplain selesai | Angka | Tidak | Tidak |
| Belum selesai | Angka | Tidak | Tidak |
| Masalah customer | Teks panjang | Tidak | Tidak |
| Masalah operasional resto | Teks panjang | Tidak | Tidak |
| Kerusakan alat/fasilitas | Teks panjang | Tidak | Tidak |
| Tindakan yang sudah dilakukan | Teks panjang | Tidak | Tidak |
| Butuh bantuan pusat | Teks panjang | Tidak | Tidak |

*Dari format asli §10 "CUSTOMER & MASALAH RESTO".*

### Blok 11 · Kontrol PTA/PTE Seluruh Karyawan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Total karyawan wajib PTA/PTE | Angka | Tidak | Tidak |
| Sudah mengirim laporan personal | Angka | Tidak | Tidak |
| Belum mengirim | Angka | Tidak | Tidak |
| Live -- jumlah karyawan lengkap | Angka | Tidak | Tidak |
| Live -- dari total karyawan | Angka | Tidak | Tidak |
| Undangan konsumen baru -- lengkap | Angka | Tidak | Tidak |
| Undangan konsumen baru -- dari total | Angka | Tidak | Tidak |
| Kesaksian -- lengkap | Angka | Tidak | Tidak |
| Kesaksian -- dari total | Angka | Tidak | Tidak |
| Google Review -- lengkap | Angka | Tidak | Tidak |
| Google Review -- dari total | Angka | Tidak | Tidak |
| Min. 3 VT/update medsos -- lengkap | Angka | Tidak | Tidak |
| Min. 3 VT/update medsos -- dari total | Angka | Tidak | Tidak |
| Video mentahan -- lengkap | Angka | Tidak | Tidak |
| Video mentahan -- dari total | Angka | Tidak | Tidak |
| Karyawan PTA/PTE tidak lengkap | Teks panjang | Tidak | Tidak |
| Alasan | Teks panjang | Tidak | Tidak |
| Tindakan Manager | Teks panjang | Tidak | Tidak |

*Dari format asli §11 "KONTROL PTA/PTE SELURUH KARYAWAN". Ini bukan hitungan otomatis — Manager mengecek satu-satu lalu mengetik jumlahnya sendiri, sama seperti blok serupa di form HRD.*

### Blok 12 · Kebutuhan untuk Besok

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Stok yang perlu dikirim pusat | Teks panjang | Tidak | Tidak |
| Kebutuhan operasional lainnya | Teks panjang | Tidak | Tidak |

*Dari format asli §12 "KEBUTUHAN UNTUK BESOK".*

> ⚠️ **Sengaja dipersingkat, perlu konfirmasi.** Dokumen asli §12 juga mengulang "Es batu/Air/Gas: ___" — tapi itu PERSIS sama dengan kolom "kebutuhan besok" yang sudah ada di Blok 5 (Utilitas) untuk masing-masing item, jadi TIDAK saya ulang di sini. "Stok yang perlu dikirim pusat" sendiri kemungkinan juga tumpang-tindih dengan Blok 4 (Stok Habis/Kebutuhan Kiriman Pusat) — saya PERTAHANKAN keduanya sebagai field terpisah untuk sekarang karena Blok 4 terasa seperti daftar barang spesifik sedangkan Blok 12 terasa seperti ringkasan umum utk besok, tapi ini judgment call saya, bukan sesuatu yang sudah pasti benar. Mohon dicek: apakah Manager biasanya mengisi kedua kolom ini dengan jawaban yang beda, atau selalu sama?

### Blok 13 · Rekap Manager Hari Ini

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Masalah utama | Teks panjang | Tidak | Tidak |
| Butuh keputusan CEO (centang) | Centang | Tidak | Tidak |
| Judul keputusan yang dibutuhkan | Teks singkat | Tidak* | Tidak |
| Status resto hari ini | Pilih warna (Hijau/Kuning/Merah) | Tidak | Tidak |

\* *Kalau "Butuh keputusan CEO" dicentang tapi judul dibiarkan kosong, laporan tetap terkirim tapi TIDAK masuk antrean keputusan CEO.*

*Dari format asli §14 "REKAP MANAGER HARI INI" dan §13 "MASALAH YANG HARUS DILAPORKAN". Baris ringkasan (omzet, stok, karyawan, seragam, kebersihan, dapur, utilitas, PTA/PTE, kebutuhan kiriman besok) TIDAK diulang jadi isian — semuanya sudah dijawab di blok-blok di atas. Daftar masalah per kategori di §13 (stok/penjualan/karyawan/customer/kebersihan/utilitas/fasilitas/PTA-PTE) juga tidak dibuat satu-satu — digabung jadi satu kolom "Masalah utama", sama seperti form-form lain.*

---

## Tombol kirim

Laporan **ditolak** kalau: (1) ada baris di tabel selisih stok (Blok 3) tanpa
dugaan penyebab, atau (2) salah satu dari 10 video wajib (Blok 9) belum
dilampirkan.

---

## Field di format asli yang TIDAK dibuat, dan alasannya

| Field di `FORMAT-ASLI-05-MANAGER-RESTO.md` | Kenapa tidak dibuat sebagai isian |
|---|---|
| §2 "TOTAL" (setelah metode pembayaran) | Dihitung otomatis dari Cash+QRIS+Transfer+Lainnya |
| §12 "Es batu/Air/Gas: ___" | Sudah ada di Blok 5 (Utilitas), tidak diulang |
| §13 daftar masalah per kategori (stok, penjualan/setoran, karyawan, customer, kebersihan, utilitas, fasilitas/peralatan, PTA/PTE) | Digabung jadi satu kolom "Masalah utama" di Blok 13, sama seperti form lain |
| §14 baris ringkasan (omzet, stok sistem vs aktual, karyawan, seragam, kebersihan, dapur, utilitas, PTA/PTE, kebutuhan kiriman besok) | Mengulang jawaban blok-blok di atas, tidak diketik ulang |
| Header "📅 Tanggal", "🏪 Outlet", "👤 Manager" | Diisi otomatis oleh kotak Identitas |
| "👤 Manager: __________" (footer §14) | Sama dengan nama di kotak Identitas |

---

**Untuk ditinjau — ada 3 hal yang saya tandai perlu keputusan, bukan sekadar
laporan biasa:**
1. Blok 6 "Catatan kondisi dapur" (field baru, bukan dari dokumen asli) — cara saya memenuhi perintah "WAJIB VIDEO", cocok?
2. Blok 8 "Dapur" vs Blok 6 "Dapur bersih" — dua pertanyaan atau digabung jadi satu seperti kasus IT?
3. Blok 12 vs Blok 4 — dua kolom kebutuhan kiriman pusat yang mirip, dipertahankan terpisah atau digabung?
