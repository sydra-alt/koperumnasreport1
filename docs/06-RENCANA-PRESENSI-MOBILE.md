# 06 — RENCANA PRESENSI, TAMPILAN MOBILE & EKSPOR

> Tambahan yang diminta klien setelah melihat versi pertama, 24 Agustus 2026.
> Belum dikerjakan. Urutan dan alasannya di §1.

---

## §1 · Urutan pengerjaan

| Urutan | Bagian | Kapan | Alasan |
|---|---|---|---|
| **1** | Tampilan mobile (nav bawah + PWA) | **Sekarang, sebelum Task 24** | Menyentuh semua layar. Makin banyak layar, makin mahal |
| **2** | Task 24 + peluncuran fase 1 | Setelah itu | Sistem laporan sudah selesai, jangan ditahan |
| **3** | Presensi ber-radius | Setelah peluncuran | Modul baru, butuh koordinat dan keputusan kebijakan dari CEO |
| **4** | Ekspor Excel & PDF | Menjelang akhir bulan pertama | Baru dibutuhkan saat rekap bulanan pertama |

Ekspor sengaja terakhir: gunanya baru terasa saat ada data sebulan penuh untuk diekspor.

---

## §2 · Tampilan mobile

35 dari 36 orang memakai HP. Desktop hanya untuk CEO, Sabrina, dan admin.

**Nav bawah**, maksimal 5 tombol, isinya menyesuaikan peran:

| Karyawan biasa | CEO / Pusat |
|---|---|
| Beranda · Lapor · Riwayat · Akun | Beranda · Papan · Keputusan · Terpusat · Akun |

Nav atas yang sekarang dipindah jadi nav bawah di layar sempit, tetap atas di layar lebar.

**Ketentuan teknis**
- `padding-bottom: env(safe-area-inset-bottom)` — kalau tidak, tombol tertutup home bar iPhone
- Tinggi sasaran sentuh minimal 48px
- Nav tetap terlihat saat menggulir form panjang, jangan ikut hilang
- PWA lewat `@serwist/next`: bisa dipasang ke layar utama, ada ikon dan splash screen
- `display: standalone` supaya tidak terlihat seperti browser

**Yang berubah di form panjang:** tombol Kirim ikut menempel di bawah, di atas nav. Form personal marketing 9 blok itu panjang; kalau tombol kirim harus dicari dengan menggulir, orang akan mengira formnya belum selesai.

---

## §3 · Presensi ber-radius

### 3.1 Yang harus dipahami sebelum dijanjikan ke CEO

Empat hal ini bukan soal kualitas pengerjaan. Ini batas dari teknologinya, dan sebaiknya CEO tahu sejak awal.

**GPS di browser bisa dipalsukan, dan itu tidak sulit.** Aplikasi *mock location* tersedia bebas di Play Store dan tidak perlu root. Artinya presensi ber-radius adalah **penghalang, bukan bukti**. Orang yang niat curang tetap bisa. Yang dicegah adalah kecurangan spontan — titip absen dari rumah karena bangun kesiangan. Itu tetap berharga, tapi jangan disebut anti-curang.

Foto wajah saat presensi justru pengaman yang lebih kuat daripada koordinatnya, karena lebih repot dipalsukan.

**Akurasi GPS di HP jauh lebih buruk daripada yang dikira.** Di ruang terbuka 5–20 meter. Di dalam gedung, dekat tembok tinggi, atau saat mendung bisa 50–200 meter. Radius 30 meter akan menolak orang yang benar-benar berdiri di kantor, setiap hari, dan mereka akan berhenti percaya pada sistemnya dalam seminggu.

**Mulai dari 200 meter**, kumpulkan data sebulan, baru dipersempit berdasarkan kenyataan. Sistem menyimpan jarak dan akurasi setiap presensi, jadi keputusan mempersempitnya nanti berdasarkan angka, bukan tebakan.

**Kalau GPS gagal, apa yang terjadi?** Satpam shift pagi pukul 06.00 di area DTI saat hujan — GPS bisa tidak mengunci sama sekali. Kalau sistem menolak keras, dia tidak bisa absen dan tercatat mangkir padahal hadir.

Karena itu perilakunya dibuat **bisa diatur dari halaman Admin**, bukan dikunci di kode:

| Pilihan | Perilaku |
|---|---|
| `tolak` | Di luar radius → tidak bisa absen sama sekali |
| `izinkan_dengan_tanda` | Tetap bisa absen, tapi ditandai 🟡 "di luar radius" beserta jaraknya, masuk ke HRD untuk diperiksa |

Saran: mulai dengan `izinkan_dengan_tanda` selama sebulan. Anda akan melihat berapa banyak yang benar-benar curang dan berapa yang sekadar GPS-nya buruk. Baru setelah itu putuskan.

**Data lokasi karyawan itu data pribadi.** UU Perlindungan Data Pribadi berlaku. Yang disimpan hanya titik saat menekan tombol absen — bukan pelacakan sepanjang hari. Karyawan harus diberi tahu apa yang direkam dan untuk apa, sebelum sistem menyala. Sebaiknya ada pernyataan singkat yang mereka setujui sekali di awal.

### 3.2 Skema

```sql
create table public.lokasi_absen (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,              -- "Kantor Pusat", "Lokasi Tajur", "Pabrik DTI"
  lokasi_id     uuid references public.lokasi(id),   -- null untuk kantor pusat
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meter  int not null default 200,
  aktif         boolean not null default true
);

create table public.penugasan_absen (       -- siapa absen di mana
  user_id         uuid not null references public.profile(id) on delete cascade,
  lokasi_absen_id uuid not null references public.lokasi_absen(id) on delete cascade,
  primary key (user_id, lokasi_absen_id)
);

create type absen_tipe   as enum ('masuk','pulang');
create type absen_status as enum ('valid','di_luar_radius','manual_hrd');

create table public.absensi (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profile(id),
  tanggal          date not null,
  tipe             absen_tipe not null,
  waktu            timestamptz not null default now(),
  lokasi_absen_id  uuid references public.lokasi_absen(id),
  latitude         double precision,
  longitude        double precision,
  akurasi_meter    double precision,        -- dari GPS, untuk menilai keandalan
  jarak_meter      double precision,        -- dihitung ke titik lokasi_absen
  status           absen_status not null,
  foto_path        text not null,           -- bucket privat, wajib
  terlambat_menit  int,
  catatan          text,
  disetujui_oleh   uuid references public.profile(id),
  created_at       timestamptz not null default now(),
  unique (user_id, tanggal, tipe)
);
```

Jarak dihitung dengan rumus haversine, tidak perlu PostGIS untuk skala ini.

### 3.3 Kunci `policy` baru

```sql
('jam_masuk',                  '"08:00"'),
('jam_pulang',                 '"17:00"'),
('toleransi_terlambat_menit',  '15'),
('absen_radius_default_meter', '200'),
('absen_di_luar_radius',       '"izinkan_dengan_tanda"'),
('absen_wajib_foto',           'true'),
('absen_akurasi_maksimal_meter','100')      -- GPS lebih buruk dari ini → minta ulangi
```

Semuanya diatur dari halaman Admin, sama seperti kebijakan lain. Jam masuk dan pulang bisa berbeda per divisi — satpam per shift.

### 3.4 Alur di layar

```
[ ABSEN MASUK ]
      ↓
Minta izin lokasi → dapat koordinat + akurasi
      ↓
Akurasi lebih buruk dari batas?  → "Sinyal GPS lemah. Coba keluar ruangan lalu ulangi."
      ↓
Hitung jarak ke titik penugasannya
      ↓
Di dalam radius?  ──tidak──→ ikuti policy: tolak, atau izinkan dengan tanda 🟡
      ↓ ya
Buka kamera depan → ambil foto → kompres → unggah
      ↓
Simpan. Tampilkan: "Absen masuk 08.12 · Kantor Pusat · terlambat 12 menit"
```

Kamera memakai `getUserMedia` dengan `facingMode: 'user'`. Wajib HTTPS — Vercel sudah.

### 3.5 Yang ikut selesai karena presensi

Dua utang lama tertutup begitu presensi jalan:

**Laporan HRD bagian 1** sekarang diketik manual: total pegawai, hadir, sakit, izin, cuti, terlambat, tanpa keterangan. Setelah ada presensi, semua itu **terisi otomatis**. HRD tinggal mengurus yang tidak bisa dihitung mesin — alasan, tindak lanjut, surat izin. Ini prinsip §3.5b lagi.

**Hari cuti tidak lagi dihitung bolong PTE.** Ini utang yang tercatat sejak 22 Agustus dan menjadi penghalang sebelum sistem dipakai menghitung gaji. Setelah data cuti masuk lewat presensi, `v_marketing_bulanan` bisa mengecualikannya.

### 3.6 Penyimpanan

35 orang × 2 foto × 30 hari ≈ **2.100 foto per bulan**, di luar bukti PTE yang sudah ada. Kompres ke sisi terpanjang 800px — foto absen tidak perlu besar, cukup untuk mengenali wajah. Simpan 90 hari, setelah itu hapus fotonya dan sisakan catatannya saja.

---

## §4 · Ekspor Excel & PDF

**Excel** — dibuat di Route Handler `app/api/ekspor/`, memakai `exceljs`. Tambahan pustaka ini pengecualian yang disetujui atas kunci stack di BLUEPRINT §2.

| Berkas | Isi | Untuk siapa |
|---|---|---|
| Rekap absensi bulanan | per orang per tanggal, jam masuk/pulang, terlambat, di luar radius | HRD, penggajian |
| Kepatuhan marketing bulanan | undangan, closing, hari bolong, status bonus, status potongan | Fauzy & Dea, penggajian |
| Rekap laporan per divisi | seluruh isian sebulan, satu sheet per divisi | arsip, rapat |
| Rekap keuangan bulanan | **hanya CEO dan Accounting** | CEO |

Format angka `#,##0` gaya Indonesia, tanggal `dd/mm/yyyy`, baris judul dibekukan.

**PDF** — Laporan Terpusat harian, memakai CSS cetak yang sudah ada. Satu halaman A4, siap dikirim ke WhatsApp.

⚠️ Hak akses ekspor mengikuti aturan yang sama dengan layar. Ekspor keuangan tidak boleh bisa diunduh Sabrina. Setiap endpoint ekspor memeriksa peran di sisi server, bukan menyembunyikan tombol.

---

## §5 · Yang harus ditanyakan ke CEO

Presensi tidak bisa dimulai tanpa jawaban 1–3.

1. **Koordinat setiap titik absen.** Kantor pusat, Tajur, Bekasi, DTI, dan outlet. Cara paling mudah: buka Google Maps, tekan lama di titiknya, angka yang muncul di atas itulah koordinatnya. Kirim dalam bentuk `-6.914744, 107.609810`.

2. **Siapa absen di mana.** Manager resto di outletnya, satpam di DTI, PIC lokasi di lokasinya. Yang berpindah-pindah bagaimana — boleh absen di titik mana pun?

3. **Jam masuk dan pulang**, dan toleransi terlambat. Berbeda per divisi? Satpam per shift?

4. **Di luar radius: ditolak atau ditandai?** Saran: tandai dulu sebulan, lihat datanya, baru diputuskan.

5. **Absen wajib berfoto?** Foto adalah pengaman yang lebih kuat daripada koordinat, tapi menambah waktu dan penyimpanan.

6. **Karyawan sudah diberi tahu** bahwa lokasi dan foto mereka direkam? Ini harus dilakukan sebelum sistem menyala, bukan sesudah.
