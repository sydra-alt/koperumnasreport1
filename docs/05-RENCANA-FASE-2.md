# 05 — RENCANA FASE 2

> Jangan kerjakan apa pun di sini sebelum seluruh Task 01–24 fase 1 selesai dan Task 24 hijau.
> Isi dokumen ini masih rencana, bukan spesifikasi final.

---

## Urutan berdasarkan manfaat nyata

| Urutan | Fitur | Kenapa ini duluan |
|---|---|---|
| 1 | Mode offline | Tanpa ini, PIC lokasi akan kembali ke WhatsApp |
| 2 | Notifikasi WhatsApp | Kebiasaan tim sudah di WA; email tidak akan dibaca |
| 3 | Silang-cek otomatis | Menangkap selisih uang tanpa harus ada yang curiga dulu |
| 4 | Laporan bulanan & ekspor | Untuk rapat dan perhitungan gaji |
| 5 | Kompresi video | Menghemat biaya storage |
| 6 | Impor karyawan massal | Sekali pakai, tapi menghemat berjam-jam |

---

## F2-1 · Mode offline

**Masalah:** lokasi perumahan dan area DTI sering tanpa sinyal. Kalau form gagal terkirim dan isian hilang, PIC berhenti memakai sistem ini setelah dua kali kejadian.

**Rencana**
- Simpan draft di IndexedDB (`idb-keyval`) selain di Supabase
- Antrean kirim: laporan yang gagal masuk antrean lokal, dicoba ulang saat online
- Lampiran ikut diantre — ini bagian yang paling sulit, file bisa besar
- Indikator jelas di layar: `Tersimpan di HP · belum terkirim`
- Service worker via `next-pwa` atau `@serwist/next`, aplikasi bisa dipasang ke layar utama HP

**Hati-hati:** antrean offline bisa menghasilkan laporan dobel kalau pengiriman ulang tidak idempoten. Kunci pencegahnya sudah ada — unique index di `report`. Pastikan konflik ditangani sebagai "sudah terkirim", bukan sebagai error.

---

## F2-2 · Notifikasi WhatsApp

**Kejadian yang memicu pesan**
| Pemicu | Ke siapa | Isi |
|---|---|---|
| Lewat jam batas, belum lapor | PIC bersangkutan | pengingat |
| Pukul 19.00, masih ada yang belum lapor | Ibu Sabrina | daftar nama |
| `decision` baru berurgensi 1 | CEO | judul + nominal + deadline |
| CEO memutuskan | PIC pengaju | hasil keputusan |
| Selisih uang resto terdeteksi | Accounting + Ita | nominal selisih |
| Tanggal 25, PTE masih bolong | karyawan + Kontrol Marketing | jumlah hari bolong |

**Cara**
- Supabase Edge Function + `pg_cron` untuk jadwal
- Penyedia: WhatsApp Cloud API resmi (Meta), atau penyedia lokal seperti Fonnte/Wablas kalau volume kecil
- Template pesan disimpan di tabel `notif_template`, bisa diubah tanpa deploy
- Tabel `notif_log` untuk mencatat apa yang terkirim — supaya tidak ada yang mengirim dua kali dan ada bukti kalau ada yang mengaku tidak menerima

**Sebelum mulai, tanyakan ke klien:** nomor WA perusahaan yang dipakai, dan apakah bersedia melalui proses verifikasi bisnis Meta. Ini menentukan penyedia mana yang dipakai.

---

## F2-3 · Silang-cek otomatis

Berjalan sebagai Edge Function terjadwal, setelah jam batas laporan lewat.

| Pemeriksaan | Aksi kalau tidak cocok |
|---|---|
| Omzet resto versi Manager ≠ versi Ita | Dua laporan ditandai 🔴, buat `decision` urgensi 2 |
| Cash resto diterima tapi belum disetor > 1 hari | Naik ke Accounting, tandai 🔴 |
| Data konsumen versi IT ≠ jumlah di laporan PIC lokasi | Tandai 🟡 di kedua sisi |
| Tamu/konsumen masuk gerbang (Security) ≠ konsumen dilayani (PIC Lokasi) | Bukan duplikasi -- dua pengukuran berbeda yang seharusnya mirip (§3.5b). Selisih besar (mis. 12 masuk, 5 dilayani) ditandai 🟡, munculkan di Papan Kontrol lokasi terkait. Ditetapkan saat Batch D, 23 Agustus 2026 -- lihat BLUEPRINT.md §3.5b. |
| Stok sistem ≠ stok aktual tanpa penyebab | Tolak sejak validasi form (sudah ada di fase 1) |
| Kiriman DTI ≠ penerimaan di lokasi | Tandai 🟡, minta konfirmasi surat jalan |

Semua hasil pemeriksaan masuk tabel baru `flag`, ditampilkan sebagai lencana di Papan Kontrol.

---

## F2-4 · Laporan bulanan & ekspor

- Rekap bulanan per divisi dan per lokasi
- Rekap kepatuhan marketing untuk perhitungan gaji: siapa dapat Rp500.000, siapa kena potongan Rp300.000
- Ekspor Excel (`xlsx`) dan PDF
- Grafik tren: unit selesai per bulan, closing per bulan, cashflow

⚠️ Rekap gaji menyangkut pendapatan orang. Sebelum dipakai untuk memotong gaji, jalankan paralel dengan hitungan manual HRD selama **satu bulan penuh** dan bandingkan. Kalau ada beda satu orang pun, cari sebabnya dulu.

---

## F2-5 · Kompresi video

- Kompres di browser dengan `ffmpeg.wasm` sebelum unggah
- Target: 720p, ~2 Mbps
- Kebijakan simpan: video mentah 90 hari, setelah itu hanya thumbnail dan metadata
- Perkiraan tanpa kompresi: 10 video × 2 outlet × 30 hari ≈ 30–60 GB per bulan hanya dari resto

Kalau `ffmpeg.wasm` terlalu berat untuk HP kelas bawah yang dipakai di lapangan, alternatifnya turunkan resolusi rekaman lewat `MediaRecorder` sejak awal.

---

## F2-6 · Impor karyawan massal

Unggah CSV: nama, jabatan, divisi, email, role, assignment. Membuat akun lewat Edge Function ber-`service_role`, mengirim password sementara lewat WA.

---

## Yang sengaja TIDAK dibangun

| Ide | Kenapa tidak |
|---|---|
| Aplikasi Android/iOS asli | PWA sudah cukup; menambah dua platform untuk dirawat |
| Absensi wajah / GPS | Masalah privasi dan akurasi; HRD sudah punya cara sendiri |
| Chat di dalam aplikasi | WhatsApp sudah dipakai dan lebih baik; jangan bersaing dengannya |
| Penilaian kinerja otomatis | Data laporan harian bukan alat yang tepat untuk menilai orang |
| Multi-bahasa | Seluruh pengguna berbahasa Indonesia |

---

## Sebelum fase 2 dimulai

Tanyakan ke klien setelah fase 1 berjalan **minimal dua minggu**:

1. Divisi mana yang paling sering telat lapor, dan apa sebab sebenarnya?
2. Apakah ada field yang ternyata tidak pernah diisi? Buang saja.
3. Apakah ada yang justru mereka catat di luar sistem? Itu yang harus ditambahkan.
4. Berapa lama rata-rata mengisi satu laporan? Kalau lebih dari 10 menit, formnya terlalu panjang.

Data pemakaian nyata dua minggu lebih berguna daripada menebak fitur sekarang.
