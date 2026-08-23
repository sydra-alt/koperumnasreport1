# Pratinjau Form: Laporan Harian IT

> Dokumen ini BUKAN dokumentasi teknis. Isinya menggambarkan persis apa yang akan
> dilihat dan diisi PIC IT (Diki) di layar HP/komputer, dari atas sampai bawah,
> setiap hari — supaya bisa dicocokkan dengan format kertas/WhatsApp yang selama
> ini dipakai perusahaan, di `docs/FORMAT-ASLI-04-IT.md`.
>
> Setiap bagian di bawah muncul sebagai satu kotak terpisah di layar, urut dari
> atas ke bawah persis seperti daftar ini.

**Cara baca tabel di setiap bagian:**
- **Tipe** = bentuk isiannya (angka, teks, pilihan, dst.)
- **Wajib diisi?** = kalau "Ya", laporan tidak bisa dikirim kalau kosong
- **Perlu bukti foto/video?** = kalau "Ya", sistem menolak kirim kalau belum ada foto/video yang dilampirkan untuk baris itu

---

## 🔒 Bagian yang TERISI OTOMATIS (bukan diketik PIC IT)

Tiga kotak ini muncul di paling atas, SEBELUM form yang diisi manual. PIC IT tidak
mengetik apa pun di sini — sistem yang mengisi, berdasarkan data yang sudah ada di
tempat lain.

### Identitas

| Yang tampil | Dari mana |
|---|---|
| Tanggal hari ini | Jam sistem, zona waktu Jakarta |
| Nama PIC | Nama akun yang sedang login |

*Menggantikan bagian header asli: "📅 Tanggal", "👤 Nama/PIC IT".*

### Laporan Personal Marketing

| Yang tampil | Dari mana |
|---|---|
| Laporan personal (PTA/PTE) sudah dikirim hari ini: ✅/❌ | Status laporan pribadi Diki sendiri hari ini, di form **Laporan Personal Marketing** yang terpisah |
| Undangan bulan ini: ___ / 20 | Jumlah undangan Diki bulan berjalan, dihitung sistem dari laporan personal hariannya |
| Closing bulan ini: ___ / 2 | Jumlah closing Diki bulan berjalan, dihitung sistem |

*Menggantikan bagian asli §13 "LAPORAN PERSONAL MARKETING IT" — angka undangan/closing
di situ TIDAK diketik ulang di form IT, karena sudah diisi Diki sendiri sekali di
form Personal Marketing-nya. Kalau diketik dua kali, ada risiko datanya saling
menimpa diam-diam tanpa ada peringatan.*

### PIC Lokasi yang Belum Mengirim Foto/Video Pembangunan

| Yang tampil | Dari mana |
|---|---|
| Daftar lokasi (kalau ada) yang PIC-nya belum mengirim foto/video progress pembangunan hari ini, beserta nama PIC-nya | Dihitung otomatis: sistem mengecek lampiran foto/video yang sudah masuk di laporan PIC Lokasi hari ini, lalu cocokkan dengan daftar lokasi yang seharusnya lapor |

*Menggantikan bagian asli §7, baris "PIC lokasi yang BELUM mengirim foto/video
pembangunan". Sebelumnya ini kolom kosong yang harus diisi Diki dengan mengecek
manual satu-satu — sekarang otomatis, supaya tidak ada yang lupa dicek atau salah
tulis.*

---

## ✍️ Bagian yang DIISI PIC IT

### Blok 1 · Sistem / Aplikasi Koperumnas

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Aplikasi berjalan normal | Ya / Tidak | Tidak | Tidak |
| Website berjalan normal | Ya / Tidak | Tidak | Tidak |
| Login/user berjalan normal | Ya / Tidak | Tidak | Tidak |
| Database berjalan normal | Ya / Tidak | Tidak | Tidak |
| Data pembayaran ter-update | Ya / Tidak | Tidak | Tidak |
| Data konsumen ter-update | Ya / Tidak | Tidak | Tidak |
| Jika ada error, detail | Teks panjang | Tidak | Tidak |
| Mulai error jam | Teks singkat | Tidak | Tidak |
| Sudah diperbaiki | Ya / Tidak | Tidak | Tidak |
| Tindakan | Teks singkat | Tidak | Tidak |
| Target selesai | Teks singkat | Tidak | Tidak |

*Dari format asli §1 "SISTEM / APLIKASI KOPERUMNAS", semua baris ada.*

> ⚠️ **Catatan gabungan:** Format asli menanyakan "Data pembayaran ter-update: ✅/❌"
> DUA KALI — sekali di §1 dan sekali lagi di §3, kata-katanya persis sama. Di form
> ini cuma ditanyakan SEKALI (di sini, Blok 1), supaya Diki tidak perlu jawab
> pertanyaan yang sama dua kali dan supaya tidak ada risiko jawabannya beda antara
> jawaban pertama dan kedua.

### Blok 2 · Update Data Konsumen di Sistem

*Catatan di layar: "Angka di blok ini menjadi sumber laporan konsumen harian Sabrina ke CEO."*

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Total konsumen | Angka | Tidak | Tidak |
| Aktif | Angka | Tidak | Tidak |
| Konsumen baru hari ini | Angka | Tidak | Tidak |
| STK | Angka | Tidak | Tidak |
| STKB | Angka | Tidak | Tidak |
| Suspend | Angka | Tidak | Tidak |
| Menunggak | Angka | Tidak | Tidak |
| Refund | Angka | Tidak | Tidak |
| Take Over | Angka | Tidak | Tidak |
| Perubahan -- konsumen baru masuk | Angka | Tidak | Tidak |
| Perubahan -- aktif ke STK | Angka | Tidak | Tidak |
| Perubahan -- STK ke STKB | Angka | Tidak | Tidak |
| Perubahan -- menjadi suspend | Angka | Tidak | Tidak |
| Perubahan -- refund | Angka | Tidak | Tidak |
| Perubahan -- take over | Angka | Tidak | Tidak |
| Perubahan lainnya | Teks singkat | Tidak | Tidak |
| Ada data belum sinkron | Ya / Tidak | Tidak | Tidak |
| Detail data belum sinkron | Teks panjang | Tidak | Tidak |

*Dari format asli §2 "UPDATE DATA KONSUMEN DI SISTEM", semua baris ada (bagian "Data per hari ini" dan "PERUBAHAN HARI INI").*

### Blok 3 · Sistem Pembayaran / Tagihan

*Catatan di layar: "IT memastikan sistem/data. Verifikasi keuangan tetap Accounting."*

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Pembayaran masuk sistem (transaksi) | Angka | Tidak | Tidak |
| Tagihan konsumen ter-update | Ya / Tidak | Tidak | Tidak |
| Status tunggakan ter-update | Ya / Tidak | Tidak | Tidak |
| Transaksi/data belum masuk | Teks panjang | Tidak | Tidak |
| Pembayaran tidak cocok | Teks panjang | Tidak | Tidak |
| PIC yang harus follow-up | Teks singkat | Tidak | Tidak |

*Dari format asli §3 "SISTEM PEMBAYARAN / TAGIHAN". "Data pembayaran ter-update" TIDAK diulang di sini — lihat catatan di Blok 1.*

### Blok 4 · Website Koperumnas

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Website aktif | Ya / Tidak | Tidak | Tidak |
| Informasi program terbaru | Ya / Tidak | Tidak | Tidak |
| Data lokasi | Ya / Tidak | Tidak | Tidak |
| Kontak/WA | Ya / Tidak | Tidak | Tidak |
| Form pendaftaran | Ya / Tidak | Tidak | Tidak |
| Link berjalan normal | Ya / Tidak | Tidak | Tidak |
| Foto pembangunan terbaru | Ya / Tidak | Tidak | Tidak |
| Update yang dilakukan hari ini | Teks panjang | Tidak | Tidak |
| Yang belum di-update | Teks panjang | Tidak | Tidak |

*Dari format asli §4 "WEBSITE KOPERUMNAS", semua baris ada.*

### Blok 5 · Update Official Media Sosial

*Catatan di layar: "IT wajib memastikan seluruh official aktif dan ter-update."*

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Koperumnas -- Instagram | Ya / Tidak | Tidak | Tidak |
| Koperumnas -- Instagram, jumlah konten | Angka | Tidak | Tidak |
| Koperumnas -- TikTok | Ya / Tidak | Tidak | Tidak |
| Koperumnas -- TikTok, jumlah konten | Angka | Tidak | Tidak |
| Koperumnas -- YouTube | Ya / Tidak | Tidak | Tidak |
| Koperumnas -- YouTube, jumlah konten | Angka | Tidak | Tidak |
| Koperumnas -- Threads | Ya / Tidak | Tidak | Tidak |
| Koperumnas -- Threads, jumlah update | Angka | Tidak | Tidak |
| DTI -- Instagram | Ya / Tidak | Tidak | Tidak |
| DTI -- TikTok | Ya / Tidak | Tidak | Tidak |
| DTI -- YouTube | Ya / Tidak | Tidak | Tidak |
| Indokopi -- Instagram | Ya / Tidak | Tidak | Tidak |
| Indokopi -- TikTok | Ya / Tidak | Tidak | Tidak |
| Indokopi -- Threads | Ya / Tidak | Tidak | Tidak |
| Indosteak -- Instagram | Ya / Tidak | Tidak | Tidak |
| Indosteak -- TikTok | Ya / Tidak | Tidak | Tidak |
| Indosteak -- Threads | Ya / Tidak | Tidak | Tidak |
| Official yang hari ini belum update | Teks panjang | Tidak | Tidak |
| Alasan | Teks singkat | Tidak | Tidak |
| Target diselesaikan | Teks singkat | Tidak | Tidak |

*Dari format asli §5 "UPDATE OFFICIAL MEDIA SOSIAL". Kombinasi platform per akun (mis. DTI tidak punya Threads, Indokopi/Indosteak tidak punya YouTube) mengikuti persis daftar di dokumen asli — bukan disamakan semua.*

### Blok 6 · Konten & Video Mentahan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Video mentahan masuk hari ini | Angka | Tidak | Tidak |
| Video pembangunan | Angka | Tidak | Tidak |
| Video konsumen/testimoni | Angka | Tidak | Tidak |
| Video resto/F&B | Angka | Tidak | Tidak |
| Video marketing | Angka | Tidak | Tidak |
| Sudah diedit | Angka | Tidak | Tidak |
| Sudah upload | Angka | Tidak | Tidak |
| Belum diedit | Angka | Tidak | Tidak |
| Belum upload | Angka | Tidak | Tidak |
| Konten terbaik/prioritas hari ini | Teks panjang | Tidak | Tidak |

*Dari format asli §6 "KONTEN & VIDEO MENTAHAN", semua baris ada.*

### Blok 7 · Update Pembangunan Digital

*Catatan di layar: "Daftar PIC lokasi yang belum mengirim foto/video ditampilkan otomatis di atas -- dihitung dari lampiran, bukan diketik."*

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Lokasi yang menerima update hari ini | Teks panjang | Tidak | Tidak |
| Foto masuk | Angka | Tidak | Tidak |
| Video masuk | Angka | Tidak | Tidak |
| Sudah upload | Angka | Tidak | Tidak |
| Belum upload | Angka | Tidak | Tidak |

*Dari format asli §7 "UPDATE PEMBANGUNAN DIGITAL". Baris "PIC lokasi yang BELUM mengirim foto/video pembangunan" dipindah ke kotak otomatis di paling atas halaman (lihat bagian terisi otomatis), bukan diketik di sini.*

### Blok 8 · Google Review

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Review baru hari ini | Angka | Tidak | Tidak |
| Review sudah dibalas | Angka | Tidak | Tidak |
| Belum dibalas | Angka | Tidak | Tidak |
| Rating saat ini | Angka | Tidak | Tidak |
| Review/komentar bermasalah | Teks panjang | Tidak | Tidak |
| Perlu tindak lanjut | Teks panjang | Tidak | Tidak |

*Dari format asli §8 "GOOGLE REVIEW", semua baris ada.*

### Blok 9 · Kesaksian / Testimoni Konsumen

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Kesaksian masuk | Angka | Tidak | Tidak |
| Video testimoni | Angka | Tidak | Tidak |
| Sudah diedit | Angka | Tidak | Tidak |
| Sudah diposting | Angka | Tidak | Tidak |
| Belum diposting | Angka | Tidak | Tidak |
| Kebutuhan testimoni baru | Teks panjang | Tidak | Tidak |

*Dari format asli §9 "KESAKSIAN / TESTIMONI KONSUMEN", semua baris ada.*

### Blok 10 · Komentar / DM / Leads Medsos

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| DM masuk | Angka | Tidak | Tidak |
| Komentar masuk | Angka | Tidak | Tidak |
| Pertanyaan calon konsumen | Angka | Tidak | Tidak |
| Leads baru dari medsos | Angka | Tidak | Tidak |
| Sudah diteruskan ke Marketing/CS | Angka | Tidak | Tidak |
| Belum ditindaklanjuti | Angka | Tidak | Tidak |
| Leads urgent | Teks panjang | Tidak | Tidak |
| PIC follow-up | Teks singkat | Tidak | Tidak |

*Dari format asli §10 "KOMENTAR / DM / LEADS MEDSOS", semua baris ada.*

### Blok 11 · Backup & Keamanan Data

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Backup database | Ya / Tidak | Tidak | Tidak |
| Backup dokumen penting | Ya / Tidak | Tidak | Tidak |
| Backup foto/video | Ya / Tidak | Tidak | Tidak |
| Storage cukup | Ya / Tidak | Tidak | Tidak |
| CCTV/sistem terkait IT normal | Ya / Tidak | Tidak | Tidak |
| Internet kantor normal | Ya / Tidak | Tidak | Tidak |
| Masalah | Teks panjang | Tidak | Tidak |

*Dari format asli §11 "BACKUP & KEAMANAN DATA", semua baris ada.*

### Blok 12 · Perangkat & Jaringan

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Komputer kantor | Ya / Tidak | Tidak | Tidak |
| Printer | Ya / Tidak | Tidak | Tidak |
| Internet/WiFi | Ya / Tidak | Tidak | Tidak |
| CCTV | Ya / Tidak | Tidak | Tidak |
| Perangkat pendukung | Ya / Tidak | Tidak | Tidak |
| Kerusakan | Teks panjang | Tidak | Tidak |
| User/divisi | Teks singkat | Tidak | Tidak |
| Sudah ditangani | Ya / Tidak | Tidak | Tidak |
| Target selesai | Teks singkat | Tidak | Tidak |

*Dari format asli §12 "PERANGKAT & JARINGAN", semua baris ada.*

### Blok 14 · Target IT Besok

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Sistem/aplikasi | Teks singkat | Tidak | Tidak |
| Data konsumen | Teks singkat | Tidak | Tidak |
| Website | Teks singkat | Tidak | Tidak |
| Medsos | Teks singkat | Tidak | Tidak |
| Konten/video | Teks singkat | Tidak | Tidak |
| Google Review/testimoni | Teks singkat | Tidak | Tidak |
| Masalah IT yang harus diselesaikan | Teks singkat | Tidak | Tidak |

*Dari format asli §14 "TARGET IT BESOK", semua baris ada. (Nomor loncat dari 12 ke 14 karena §13 "Laporan Personal Marketing" dipindah ke kotak otomatis di atas — lihat bagian terisi otomatis.)*

### Blok 15 · Rekap IT untuk Sabrina

| Label | Tipe | Wajib diisi? | Perlu bukti foto/video? |
|---|---|---|---|
| Masalah utama | Teks panjang | Tidak | Tidak |
| Tindakan yang sudah dilakukan | Teks panjang | Tidak | Tidak |
| Belum selesai | Teks panjang | Tidak | Tidak |
| Butuh keputusan CEO (centang) | Centang | Tidak | Tidak |
| Judul keputusan yang dibutuhkan | Teks singkat | Tidak* | Tidak |
| Status IT hari ini | Pilih warna (Hijau/Kuning/Merah) | Tidak | Tidak |

\* *Tidak wajib menurut sistem, tapi kalau "Butuh keputusan CEO" dicentang dan judul ini dibiarkan kosong, laporan tetap terkirim namun TIDAK masuk ke antrean keputusan CEO — jadi harus diisi kalau memang ingin ada tindak lanjut dari CEO.*

*Dari format asli §15 "REKAP IT UNTUK SABRINA". Baris-baris ringkasan status (🖥️ Sistem, 👥 Data konsumen, 💳 Data pembayaran, 🌐 Website, 📱 Official medsos, 🎥 Video mentahan, ⭐ Google Review, 🎤 Testimoni, 📩 Leads, 💾 Backup) TIDAK diulang jadi isian di sini — lihat daftar "tidak dibuat" di bawah untuk alasannya. "BUTUH KEPUTUSAN/BANTUAN" di dokumen asli menjadi "Butuh keputusan CEO" di sini.*

---

## Tombol kirim

Setelah Blok 15, ada tombol **Kirim**. Karena tidak ada field yang ditandai "wajib"
atau "perlu bukti" di form ini, laporan bisa dikirim walau banyak yang masih
kosong — beda dengan form PIC Lokasi (Task 13) yang menahan pengiriman kalau foto
progres belum dilampirkan.

---

## Field di format asli yang TIDAK dibuat, dan alasannya

| Field di `FORMAT-ASLI-04-IT.md` | Kenapa tidak dibuat sebagai isian |
|---|---|
| §7 "PIC lokasi yang BELUM mengirim foto/video pembangunan" | Dipindah jadi kotak **otomatis** di atas (lihat bagian terisi otomatis) -- dihitung sistem dari lampiran, bukan diketik, supaya tidak ada yang lupa dicek atau salah catat |
| §1 & §3 "Data pembayaran ter-update: ✅/❌" (muncul dua kali) | Digabung jadi satu isian saja (Blok 1) -- pertanyaannya persis sama, menanyakan dua kali cuma menambah risiko jawaban beda-beda tanpa manfaat |
| §13 "LAPORAN PERSONAL MARKETING IT" (undangan, closing) | Dipindah jadi kotak **otomatis** di atas -- angkanya sudah diisi Diki sendiri di form Personal Marketing terpisah; kalau diketik ulang di sini, dua tempat itu bisa saling menimpa datanya tanpa peringatan |
| §15 baris ringkasan: 🖥️ Sistem, 👥 Data konsumen, 💳 Data pembayaran, 🌐 Website | Ini cuma mengulang jawaban Ya/Tidak yang sudah diisi di Blok 1 & 2 -- tidak diketik ulang, supaya tidak ada dua jawaban berbeda untuk pertanyaan yang sama |
| §15 baris ringkasan: 📱 Official medsos (___ / ___), 🎥 Video mentahan masuk, ⭐ Google Review baru, 🎤 Testimoni baru, 📩 Leads medsos baru | Ini cuma mengulang angka yang sudah diisi di Blok 5, 6, 8, 9, 10 -- tidak diketik ulang untuk alasan yang sama |
| §15 baris "💾 Backup: 🟢 SELESAI / 🔴 BELUM" | Mengulang jawaban Blok 11 -- tidak diketik ulang |
| Header "📅 Tanggal", "👤 Nama/PIC IT" | Diisi otomatis oleh kotak Identitas di atas, bukan diketik |
| "📲 Dikirim ke: Ibu Sabrina – Pusat Pelaporan" (§ header) dan "📲 Laporan dikirim setiap hari kepada Ibu Sabrina" (§15) | Kalimat informasi biasa di dokumen asli, bukan sesuatu yang perlu diisi/dipilih |
| "👤 PIC IT: __________" (footer §15) | Sama dengan nama di kotak Identitas, tidak diulang |

---

**Untuk ditinjau:** apakah pembagian blok, urutan, dan kata-kata di atas sudah cocok
dengan cara kerja IT sehari-hari? Kalau ada yang perlu diubah (field kurang, field
berlebih, atau ada yang seharusnya wajib/butuh bukti foto), beri tahu sebelum lanjut
ke `manager_resto`, `ita`, dan `accounting`.
