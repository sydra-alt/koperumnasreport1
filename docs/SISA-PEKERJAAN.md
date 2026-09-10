# SISA PEKERJAAN — status jujur per 10 September 2026

Ditulis setelah insiden login (Qasim/Ryan/Fikri/Dea/Fadil, 7-10 September) selesai
diperbaiki. Tujuannya satu: daftar yang bisa dipercaya tentang apa yang benar-benar
sudah teruji, apa yang cuma teruji lewat browser otomatis (bukan tangan orang di HP
sungguhan), apa yang belum dibangun sama sekali, dan utang lama mana yang masih
berarti setelah arah proyek berubah (2 September 2026, dari Koperumnas/perumahan ke
Indosteak · Indokopi · Thrifting).

**Catatan metodologi**: "diuji" di sesi-sesi sebelumnya sering berarti Playwright
(Chromium sungguhan, dikendalikan skrip) atau HTTP langsung dengan login sungguhan —
BUKAN tangan orang di HP fisik. Dokumen ini membedakan keduanya dengan tegas, karena
keduanya sudah pernah tercampur di `docs/PROGRESS.md` sebelumnya.

---

## 1 · Sudah selesai DAN diuji dari HP sungguhan (tangan orang, bukan Playwright)

- **Presensi ber-radius** (absen masuk/pulang, kamera, GPS, watermark foto) — checklist
  10 langkah dijalankan CEO langsung dari HP asli terhadap produksi, 29-30 Agustus
  2026, 10/10 sesuai. Termasuk pasang ke Layar Utama (PWA).
- **Alur dasar login + paksa ganti password pertama kali** (`admin123` → dipaksa ke
  `/ganti-password` → masuk) — diuji lapangan pertama kali akhir Agustus, DAN baru
  saja diuji ulang otomatis (lihat §2) setelah bug sesi invalidasi diperbaiki hari ini.
  **Belum diuji ulang dari HP fisik pasca-perbaikan hari ini** — lihat §2, ini yang
  paling penting untuk dicoba dulu sebelum dianggap benar-benar selesai.
- **Beranda menampilkan tugas harian yang benar per orang** (form apa, batas jam apa) —
  dikonfirmasi lapangan sebelumnya, mekanismenya tidak diubah sejak itu.
- **Pengajuan & persetujuan Cuti** (`/cuti`, `/cuti/tinjau`) — diuji lewat query DB
  langsung + Playwright, dan sudah dipakai mengecualikan `hari_bolong` PTE; belum ada
  catatan eksplisit "dicoba dari HP asli" spesifik untuk halaman ini di `PROGRESS.md`,
  tapi mekanismenya sama dengan form lain yang sudah lolos uji lapangan.

## 2 · Sudah DIBANGUN, tapi BELUM pernah diuji dari HP sungguhan

Ini daftar paling penting untuk dicoba duluan sebelum dipakai 15-26 orang sehari-hari.

- **Laporan Kebersihan** (`/lapor/kebersihan`) — ✅ **DIUJI DARI HP SUNGGUHAN, BERHASIL**
  (10 September 2026): satu laporan Indosteak Cempaka diisi Dea (Bar) DAN Qasim
  (Toilet) — laporan milik outlet, bukan milik orang, terbukti jalan di perangkat
  nyata. Ditemukan dari uji itu juga: kamera terkunci ke depan (salah untuk memotret
  ruangan) — **diperbaiki hari ini** (default kamera belakang + tombol balik kamera,
  facingMode jadi prop wajib komponen `CameraCapture`) tapi **perbaikan kamera INI
  SENDIRI belum dicoba dari HP fisik** — baru diuji Playwright (Chromium sungguhan,
  kamera palsu). `/kebersihan/tinjau` (review CEO/HRD) masih belum pernah dicoba dari
  HP sama sekali.
  - Batas kirim sekarang dari `jadwal_operasional` (mengganti `outlet.jam_buka`,
    lihat §4) — **sudah diisi CEO lewat Admin** untuk keempat outlet (09:00-22:00
    Indosteak, 09:00-03:00 + 24 jam akhir pekan Indokopi), jadi perilaku "terlambat"
    sekarang bisa langsung diuji dari HP tanpa perlu isi apa pun dulu.
- **Perbaikan login** (window.location.assign menggantikan router.push, login ulang
  otomatis setelah ganti password, layar konfirmasi, `autocomplete` di kedua form) —
  diuji 20-50× beruntun lewat Playwright, 0 gagal. **Belum dicoba dari HP fisik** —
  cara paling meyakinkan menutup insiden ini adalah kamu sendiri mengulang persis
  langkah yang tadinya gagal (admin123 → ganti password → logout → login lagi) dari HP.
- **Admin → Outlet → "Atur jadwal"** (7 baris per outlet, ganti input jam buka
  tunggal lama) — diuji Playwright saja (termasuk satu bug nyata yang sempat
  ditemukan & diperbaiki di jalur ini sebelum dipakai CEO — lihat §4).
- **Bilah progres unggah foto per file, dan kompresi gambar (`kompresGambar`, canvas)** —
  dicatat SEJAK Task 11 (akhir Agustus) sebagai "belum diverifikasi di device sungguhan
  dengan foto asli berukuran besar" — tidak pernah ditutup sejak itu, tetap terbuka.
- **`<input type="date">` di Papan Kontrol/Laporan Terpusat** (pemilih tanggal native) —
  perilakunya berbeda-beda antar OS HP, dicatat terbuka sejak Agustus, belum pernah
  disentuh sungguhan.
- **Draft otomatis bertahan setelah refresh di tengah mengisi form** — logikanya ada
  (debounce 5 detik), tapi langkah "isi separuh → refresh → isian masih ada" belum
  pernah dicoba lapangan.
- **Field tabel (`closing_list` dkk) di lebar HP sempit** — tidak ada keluhan waktu uji
  lapangan lama, tapi lebar-piksel & scroll horizontal belum diperiksa eksplisit.

## 3 · Belum dibangun sama sekali

- **Kasir/POS thrifting** — TIDAK ADA di repo ini, dan MEMANG TIDAK DIRENCANAKAN ada di
  sini. Sesuai `docs/RENCANA-PROYEK-BARU.md` §2 (arah final, 3 September 2026): kasir
  thrifting dibangun di repo `pos-fnb` (memakai infrastruktur kasir F&B yang sudah
  produksi di sana — layar kasir, pembayaran, struk, shift, laporan penjualan), BUKAN
  di repo laporan ini.
- **Penyambungan otomatis POS F&B → laporan Manager Resto** (rekap omzet harian
  terisi sendiri dari mesin kasir, bukan diketik manual) — `RENCANA-PROYEK-BARU.md` §7
  eksplisit bilang ini "belum bisa dinilai" dan §9 eksplisit menaruhnya sebagai
  langkah PALING TERAKHIR ("tidak dikerjakan sekarang"). Sampai ini ada, Manager
  Resto tetap mengetik omzet manual di form `manager_resto`.
- **Cetak struk / label barcode** — belum ada sama sekali di mana pun (juga bagian dari
  kasir thrifting yang belum dibangun).
- **Ekspor PDF** — tidak pernah ada. Semua ekspor yang ada (absensi, keuangan, laporan,
  marketing) memakai Excel lewat ExcelJS.
- **Alur "Lupa Password" mandiri lewat email** — sengaja tidak dibangun (email
  `@koperumnas.local` tidak nyata). Satu-satunya jalur reset adalah CEO/Admin lewat
  halaman Admin.
- **Role `admin_akun`** (delegasi reset password ke satu orang tepercaya selain
  CEO/Admin, dengan pengecualian wajib tidak boleh reset akun `ceo`/`accounting`) —
  DISETUJUI isinya sejak akhir Agustus, sengaja DITUNDA pembangunannya sampai ada data
  seberapa sering tombol reset dipakai.
- **Konsekuensi otomatis keterlambatan/PTE** (potongan Rp500.000, dst.) — mekanisme
  penghitungannya sudah ada, tapi TIDAK AKTIF: `policy.pte_mulai_berlaku` masih `null`,
  sengaja menunggu CEO sendiri yang mengisi tanggalnya (bukan agent, bukan otomatis).

## 4 · Utang lama di PROGRESS.md — mana yang MASIH berarti setelah pivot 2 September

Roster aktif sekarang 26 orang (turun dari 40 sebelum pivot), fokus Indosteak/
Indokopi/Thrifting. Banyak utang lama soal form perumahan (DTI, perizinan, pembangunan,
dst.) **sudah tidak relevan** — form-nya masih ada di kode (sengaja tidak dihapus,
cuma dinonaktifkan lewat migrasi 0045) tapi nol orang ditugaskan ke situ sekarang.
Yang MASIH berarti:

- ✅ **SELESAI (10 September 2026) — "Lokasi Uji" dibersihkan.** Koordinat diganti
  0,0, dinonaktifkan, ketiga penugasan dicabut (Putri sudah punya titik lain,
  "Kantor Pusat"; `badar`/`uji5` tidak butuh titik pengganti — bukan staf sungguhan).
  Baris tabelnya TIDAK dihapus (2 riwayat presensi asli Putri terikat lewat FK) —
  lihat `docs/PROGRESS.md`.
- **PIC `kontrol_fnb` untuk outlet Indokopi Lite Kemayoran belum ditentukan.** Mba Rika
  memegang kontrol_fnb kedua outlet Indosteak; Kemayoran belum ada yang ditugaskan.
  Saat ini cuma 2 orang total punya assignment `kontrol_fnb` di seluruh sistem.
  Belum ditebak, sesuai instruksi sebelumnya.
- ✅ **SELESAI (10 September 2026) — jadwal operasional keempat outlet sudah diisi.**
  `outlet.jam_buka` (kolom tunggal lama) DIGANTI tabel `jadwal_operasional` (per hari,
  migrasi 0055) karena kebutuhannya ternyata beda per hari (kafe tutup dini hari,
  buka 24 jam akhir pekan) — lihat `docs/PROGRESS.md`. Sudah diisi CEO lewat Admin
  untuk ketujuh hari, keempat outlet — Laporan Kebersihan sekarang punya batas kirim
  yang benar setiap hari, tidak perlu diisi apa pun lagi sebelum diuji dari HP.
- **`policy.absen_di_luar_radius` sengaja masih `izinkan_dengan_tanda`** — keputusan
  CEO 30 Agustus, ditinjau ulang lagi setelah terkumpul data presensi minimal satu
  bulan sejak roster (dulu 39/40, sekarang 26) benar-benar dipakai harian. Belum
  waktunya ditinjau ulang.
- **Siapa titik kontak kalau ada yang lupa password** — proses murni, belum pernah
  disepakati eksplisit (beda dari MEKANISMEnya yang sudah ada dan sudah teruji hari
  ini).
- **`docs/07-CATATAN-PELUNCURAN.md` (checklist peluncuran 36 orang) SUDAH SUPERSEDED**
  oleh pivot 2 September — ditulis untuk skenario Koperumnas 36-40 orang yang sudah
  tidak berlaku. Jangan dipakai sebagai acuan tanpa menyaring ulang mana yang masih
  cocok untuk skenario 26 orang/4 outlet sekarang.
- **Kuota Supabase belum pernah dipantau** di skala pemakaian harian sungguhan — masih
  berlaku, belum ada data baru sejak dicatat.

## 5 · Soal laporan stok — konfirmasi

**Bacaan kamu benar, dikonfirmasi langsung dari kode dan database:**

- Form `kontrol_fnb` (`forms/f16-kontrol-fnb.ts`) — SEMUA field stok (`stok_sesuai`,
  `stok_habis`, `stok_hampir_habis`, `kebutuhan`, seluruh blok Stock Opname Mingguan)
  adalah **isian teks manual**, diketik oleh Mba Rika/PIC berdasarkan pengecekan fisik
  sendiri. Tidak ada satu pun field yang terisi otomatis dari sistem apa pun.
- Diperiksa langsung ke database: **tidak ada satu pun tabel** bernama/berhubungan
  dengan `barang`, `stok`, `inventory`, `kasir`, atau `transaksi` di skema Postgres
  sistem laporan ini. Angka omzet (`omzet_sistem`) di form yang sama JUGA diketik
  manual oleh Manager Resto, bukan tersambung ke mesin kasir mana pun.
- Angka stok/omzet yang SUNGGUH berasal dari sistem kasir baru akan ada setelah dua
  hal yang keduanya belum dibangun (§3): kasir thrifting di `pos-fnb`, dan jalur
  rekap-otomatis dari `pos-fnb` (F&B maupun thrifting) ke laporan ini. Sampai itu ada,
  SEMUA angka stok dan omzet di sistem ini adalah laporan manusia tentang kondisi
  fisik, bukan catatan sistem — berguna untuk kontrol silang (apakah yang di sistem
  cocok dengan yang dilihat mata), tapi bukan sumber kebenaran angka itu sendiri.
