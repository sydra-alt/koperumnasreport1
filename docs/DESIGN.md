# DESIGN.md — Sistem Laporan Harian Koperumnas Group

> Sistem desain untuk aplikasi laporan harian internal PT Konsumen Perumahan Nasional (Koperumnas Group).
>
> **Arah revisi penting:** desain tetap soft dan profesional, tetapi **lebih berwarna, lebih kontras, dan jauh lebih mudah dipindai**. Pengguna utama tidak boleh dipaksa membaca semua teks untuk menemukan laporan yang bermasalah. Warna dipakai sebagai alat orientasi dan prioritas, bukan sebagai dekorasi.

---

## 0. Konteks yang tidak boleh dilanggar

Aplikasi digunakan oleh 39 orang; mayoritas memakai HP Android kelas menengah-bawah, dengan kemampuan teknologi rendah sampai sedang, sering di lokasi kerja dengan sinyal seadanya, dan membuka aplikasi setiap hari. Ukuran keberhasilan desain yang paling konkret adalah: **Elsa dapat menyelesaikan laporan hariannya dalam ±5 menit tanpa bertanya kepada siapa pun pada hari pertama.** Brief sumber juga menegaskan bahwa CEO berusia sekitar 51 tahun dan membutuhkan informasi yang sangat mudah dipindai. fileciteturn0file0L18-L37

Peran yang harus selalu dipertimbangkan:

- **Kasam** — satpam pabrik; absen sekitar 06.00 dan mengisi laporan keamanan per shift.
- **Dadang** — humas lokasi Tajur; laporan lokasi dengan foto pembangunan dan laporan marketing pribadi.
- **Elsa** — pelayan restoran; hanya perlu laporan marketing pribadi.
- **Ibu Putri** — CEO; melihat dashboard dan memutuskan permintaan persetujuan dana.
- **Ibu Sabrina** — pusat pelaporan; memantau siapa yang sudah melapor dan menyusun laporan untuk CEO.

### Tujuan desain

Setiap layar harus menjawab, dalam urutan berikut:

1. **Apa yang harus saya lihat lebih dulu?**
2. **Apa yang harus saya kerjakan sekarang?**
3. **Apa yang sudah selesai?**
4. **Apa yang bermasalah dan perlu di-follow-up?**
5. **Apa akibatnya kalau dibiarkan?**

Jangan membebankan jawaban itu ke ikon atau tebakan pengguna.

---

# 1. Arah visual: “soft, berwarna, mudah dipindai”

## 1.1 Perubahan arah dari versi sebelumnya

Versi sebelumnya terlalu takut memakai warna sehingga hampir semua elemen jatuh ke putih + abu + sedikit biru. Hasilnya memang aman, tetapi terlalu datar.

**Revisi:** gunakan warna secara sengaja pada tiga lapisan:

- **Brand color** untuk orientasi dan tindakan utama.
- **Soft semantic color** untuk menunjukkan keadaan laporan.
- **Neutral surface** untuk semua informasi yang tidak membutuhkan perhatian.

Jadi aplikasi boleh **terlihat lebih hidup**, tetapi bukan menjadi “dashboard AI” yang penuh bubble, gradient, dan badge.

### Analogi

Bayangkan **papan kontrol kantor yang dicetak dengan stabilo**:

- putih = informasi biasa,
- biru = area navigasi dan tindakan,
- hijau = sudah aman,
- kuning/amber = perlu diperhatikan,
- merah = belum dilakukan / perlu segera ditindaklanjuti.

Yang penting bukan membuat seluruh papan berwarna. Yang penting adalah **mata langsung menangkap bagian yang perlu perhatian**.

## 1.2 Prinsip visual baru

### Prinsip A — “Warna menunjukkan prioritas”

Pada halaman CEO, laporan yang belum masuk **boleh memakai area merah muda lembut**. Laporan yang perlu follow-up memakai amber lembut. Laporan yang sudah selesai memakai hijau lembut.

Ini berbeda dari menjadikan setiap kartu sebagai lampu neon.

### Prinsip B — “Bentuk tetap tenang”

Warna boleh lebih berani, tetapi bentuk tetap sederhana:

- kartu rectangular dengan radius 14–16px,
- garis pembatas tipis,
- satu aksen vertikal 4px,
- label status kecil berbentuk kapsul **hanya saat benar-benar membantu scanning**,
- hindari kumpulan lingkaran status.

### Prinsip C — “Jangan semua warna sekaligus”

Satu viewport sebaiknya memiliki:

- 1 warna brand utama,
- 1–2 warna status yang sedang relevan,
- neutral sebagai mayoritas area.

Pada dashboard dengan banyak masalah, merah dan amber boleh muncul lebih sering karena **memang itulah data yang perlu dilihat**.

### Prinsip D — “CEO melihat pola, bukan detail”

Untuk pengguna seperti CEO, desain tidak boleh mengandalkan kemampuan membaca form panjang. Gunakan:

> **warna → angka besar → kata status → detail kecil**

Bukan:

> detail panjang → pengguna membaca → pengguna menyimpulkan status.

---

# 2. Sistem warna

Brief menetapkan biru tua `#1A4FA0`, biru muda `#57ADE6`, emas `#EFA829`, dan putih sebagai referensi brand; serta menetapkan bahwa hijau, kuning, dan merah adalah warna status perusahaan yang tidak boleh dipakai sebagai dekorasi dasar. fileciteturn0file0L41-L56

## 2.1 CSS variables — versi revisi

> ⚠️ **KOREKSI 31 Agustus 2026** — Nilai `--color-brand-700/600/500` di bawah
> tadinya PERKIRAAN (`#1A4FA0`/`#2F7FC5`/`#57ADE6`), ditulis sebelum warna asli
> logo disampel. Sudah diganti ke warna ASLI (disampel langsung dari
> `public/logo-koperumnas.jpg`) — SAMA PERSIS dengan yang sungguh berjalan di
> `app/tokens.css`: `--biru: #0047AF` (biru tua, dipakai judul), `--biru-2:
> #1C74CD` (tengah), `--biru-3: #3FAAF2` (biru muda). Kalau menulis CSS baru,
> pakai TIGA token nyata itu (`--biru`/`--biru-2`/`--biru-3`) — bukan skema
> penamaan `--color-brand-*` di bawah, itu cuma ilustrasi dari draf awal dan
> tidak pernah diimplementasikan penuh sebagai skala 9 tingkat. Tingkat lain
> di skala ini (950/900/800/200/100/50) TETAP nilai perkiraan lama, belum ada
> padanan aslinya di app — jangan dianggap sudah tersampel juga.

```css
:root {
  /* ================================
     BRAND
     ================================ */
  --color-brand-950: #0B2D63;
  --color-brand-900: #103C7A;
  --color-brand-800: #17478E;
  --color-brand-700: #0047AF; /* = --biru asli app/tokens.css (sebelumnya keliru #1A4FA0, perkiraan) */
  --color-brand-600: #1C74CD; /* = --biru-2 asli app/tokens.css (sebelumnya keliru #2F7FC5, perkiraan) */
  --color-brand-500: #3FAAF2; /* = --biru-3 asli app/tokens.css (sebelumnya keliru #57ADE6, perkiraan) */
  --color-brand-200: #CDEBFA;
  --color-brand-100: #E8F4FB;
  --color-brand-50:  #F4F9FD;

  /* ================================
     BRAND SUPPORT — DIPAKAI HEMAT
     ================================ */
  --color-gold-600: #B9780B;
  --color-gold-500: #EFA829;
  --color-gold-200: #F9D98C;
  --color-gold-100: #FFF5DD;

  /* ================================
     NETRAL
     ================================ */
  --color-white: #FFFFFF;
  --color-canvas: #F6F8FB;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F1F5F9;
  --color-surface-muted: #E9EFF5;
  --color-border: #DCE4EC;
  --color-border-strong: #C4D0DC;
  --color-text: #182334;
  --color-text-secondary: #536174;
  --color-text-muted: #738196;
  --color-text-disabled: #9DA9B7;

  /* ================================
     STATUS — SEMANTIC ONLY
     ================================ */
  --color-safe: #20825A;
  --color-safe-soft: #EDF8F2;
  --color-safe-border: #B9E1CC;
  --color-safe-strong: #176542;

  --color-watch: #A46600;
  --color-watch-soft: #FFF7E7;
  --color-watch-border: #EBCF93;
  --color-watch-strong: #7B4B00;

  --color-urgent: #B32638;
  --color-urgent-soft: #FFF0F2;
  --color-urgent-border: #EDC1C8;
  --color-urgent-strong: #8F1C2C;

  /* Status “belum lapor” pada papan kontrol = urgent-soft.
     Ini bukan dekorasi; ini adalah status pekerjaan. */

  /* ================================
     FOCUS
     ================================ */
  --color-focus: #2F7FC5;
  --focus-ring: 0 0 0 3px rgba(87, 173, 230, 0.25);

  /* ================================
     TYPE
     ================================ */
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  --text-xs: 0.75rem;     /* 12 */
  --text-sm: 0.875rem;    /* 14 */
  --text-md: 1rem;        /* 16 */
  --text-lg: 1.125rem;    /* 18 */
  --text-xl: 1.25rem;     /* 20 */
  --text-2xl: 1.5rem;     /* 24 */
  --text-3xl: 1.75rem;    /* 28 */
  --text-4xl: 2rem;       /* 32 */

  --leading-tight: 1.2;
  --leading-snug: 1.35;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  /* ================================
     SPACE — BASE 4px
     ================================ */
  --space-1: 0.25rem;  /* 4 */
  --space-2: 0.5rem;   /* 8 */
  --space-3: 0.75rem;  /* 12 */
  --space-4: 1rem;     /* 16 */
  --space-5: 1.25rem;  /* 20 */
  --space-6: 1.5rem;   /* 24 */
  --space-7: 1.75rem;  /* 28 */
  --space-8: 2rem;     /* 32 */
  --space-10: 2.5rem;  /* 40 */
  --space-12: 3rem;    /* 48 */
  --space-16: 4rem;    /* 64 */

  /* ================================
     RADIUS
     ================================ */
  --radius-sm: 0.5rem;   /* 8 */
  --radius-md: 0.75rem;  /* 12 */
  --radius-lg: 1rem;     /* 16 */
  --radius-xl: 1.25rem;  /* 20 */
  --radius-pill: 999px;  /* hanya status ringkas */

  /* ================================
     SHADOW — HALUS
     ================================ */
  --shadow-none: none;
  --shadow-card: 0 1px 2px rgba(16, 32, 52, 0.03),
                 0 6px 18px rgba(16, 32, 52, 0.04);
  --shadow-floating: 0 8px 24px rgba(16, 32, 52, 0.10);
  --shadow-nav: 0 -2px 10px rgba(16, 32, 52, 0.08);

  /* ================================
     SIZING
     ================================ */
  --touch-min: 44px;
  --touch-nav: 48px;
  --input-height: 48px;
  --button-height: 48px;
  --bottom-nav-height: 72px;
  --content-max: 760px;
}
```

## 2.2 Rasio visual warna

Gunakan patokan kasar berikut:

- **60–70%** neutral/surface putih dan `canvas`.
- **20–30%** brand blue dan blue-soft.
- **maks. 10%** semantic status / gold.

Untuk layar CEO yang sedang penuh masalah, proporsi status boleh naik karena data memang membutuhkan perhatian.

### Keputusan penting

**Jangan membuat semua status berbentuk titik merah/hijau/kuning.**

Gunakan **blok warna lembut + rail kiri + teks status**. Bentuk ini lebih tenang, tidak terasa seperti UI AI, dan lebih mudah dipindai oleh orang yang tidak punya kebiasaan membaca dashboard.

---

# 3. Tipografi untuk mata yang perlu scanning cepat

Gunakan Plus Jakarta Sans melalui `next/font`.

| Peran | Ukuran | Tebal | Line-height | Catatan |
|---|---:|---:|---:|---|
| Judul halaman | 28 px | 700 | 1.2 | Maks. 2 baris di 360 px |
| Judul dashboard CEO | 26–28 px | 700 | 1.2 | Jangan terlalu dekoratif |
| Judul bagian | 20 px | 700 | 1.3 | Menjadi anchor |
| Judul kartu penting | 18 px | 700 | 1.35 | Dipakai untuk nama orang / laporan |
| Label field | 14 px | 600 | 1.35 | Kalimat biasa |
| Isian | 16 px | 500 | 1.5 | Tidak boleh diperkecil |
| Bantuan | 14 px | 400–500 | 1.5 | Pendek |
| Status | 13–14 px | 700 | 1.3 | Kata kerja/status harus mudah terlihat |
| Angka utama | 28–32 px | 700 | 1.1 | `12 dari 16`, `0 dari 2` |
| Angka kecil | 18–20 px | 700 | 1.2 | Ringkasan sekunder |
| Nav label | 11–12 px | 600 | 1.2 | Selalu ada teks |

### Kenapa angka harus lebih besar?

CEO tidak datang ke dashboard untuk membaca formulir. Ia datang untuk mengetahui **“berapa yang sudah masuk, siapa yang belum, dan apa yang perlu saya lakukan?”** Angka dan status harus bisa ditangkap dalam satu tatapan.

---

# 4. Bahasa bentuk: lebih berwarna, lebih sedikit bubble

## 4.1 Bentuk utama

- Kartu: radius 16 px.
- Input: radius 10–12 px.
- Tombol: radius 12–14 px.
- Status tag: radius 999 px hanya jika pendek.
- Progress bar: tinggi 8 px, radius penuh.
- Tombol Absen tengah: lingkaran penuh karena memang menjadi tombol navigasi utama.

## 4.2 Gunakan “rail” sebagai pola visual utama

Contoh:

```text
┌─ merah 4px ─────────────────────────────┐
│  BELUM ADA LAPORAN                      │
│  Dadang · Tajur                          │
│  Belum mengirim laporan hari ini        │
│  [ Follow-up ]                           │
└─────────────────────────────────────────┘
```

Rail kiri menjadi bahasa status yang konsisten.

### Kenapa rail, bukan lingkaran?

Rail tidak menambah “gelembung” visual dan tetap memberi sinyal warna kuat. Ia juga masih terlihat ketika kartu memanjang dan ketika jumlah data banyak.

---

# 5. Pola hierarki untuk form sampai 9 bagian

Brief menyebut masalah utama saat ini: semua bagian terlihat sama penting, status sulit terlihat tanpa scroll, konsekuensi tidak langsung terlihat, form terasa tak berujung, dan tidak ada rasa kemajuan. fileciteturn0file0L71-L78

## 5.1 Form tidak boleh terasa seperti 9 kartu identik

Gunakan struktur:

```text
Laporan hari ini

4 dari 9 bagian selesai
████████████──────

⚠ 2 bagian perlu dilengkapi

01  Absen                      ✓ Selesai
02  Target closing             0 dari 2
03  Undangan                   8 dari 20
04  PTE                        4 dari 6
...

[ Lanjutkan laporan ]
```

**Bagian ringkasan ini harus tetap terlihat di awal halaman.**

## 5.2 Setiap section punya satu “headline outcome”

Contoh:

> **Target closing pribadi**
> **0 dari 2 konsumen**
> Masih perlu 2 konsumen untuk memenuhi target bulan ini.

Bukan hanya:

> Target closing pribadi
> 0 / 2

### Alasan

Angka mentah tidak selalu dipahami dengan cepat. Kalimat “masih perlu 2” mengubah angka menjadi tindakan.

## 5.3 Detail hanya setelah ringkasan

Section aktif:

```text
Target closing pribadi
0 dari 2 konsumen
Masih perlu 2 konsumen.

Closing bulan ini *
[ 0 ]

Konsumen 1
[ ... ]
```

Section lain cukup berupa summary row.

## 5.4 “Tinggal berapa lagi” wajib

Setiap target harus dapat diterjemahkan menjadi salah satu:

- `Tinggal 2`
- `Masih menunggu 4`
- `Semua sudah lengkap`
- `Perlu 1 bukti lagi`

Ini adalah cara termudah menciptakan rasa kemajuan.

---

# 6. Beranda — prioritas tindakan

Beranda harus menjawab “apa yang harus dikerjakan sekarang?”. Brief menjadikan Beranda sebagai layar pertama dan meminta sapaan, daftar laporan belum dikirim beserta jam batasnya, serta status absen. fileciteturn0file0L82-L98

## 6.1 Struktur visual

```text
Selamat pagi, Diki
Ada 2 hal yang perlu Anda selesaikan.

┌────────────────────────────────────┐
│ ABsen                              │
│ ✓ Selesai · 06.04 WIB              │
└────────────────────────────────────┘

┌─ amber ────────────────────────────┐
│ LAPORAN MARKETING                  │
│ Belum dikirim                      │
│ 6 kegiatan PTE perlu dilaporkan   │
│ [ Isi sekarang ]                   │
└────────────────────────────────────┘

Target bulan ini
┌─────────────┐  ┌─────────────────┐
│ 0 dari 2    │  │ 0 dari 20       │
│ Closing     │  │ Undangan        │
└─────────────┘  └─────────────────┘
```

### Warna

- Absen selesai → neutral + green rail kecil.
- Laporan belum dibuat → **amber atau merah tergantung tingkat urgensi**.
- Target → blue-soft.

Jangan membuat kedua target sama-sama berwarna merah hanya karena belum mencapai angka target. **Belum mencapai target ≠ urgent.**

---

# 7. CEO dashboard — “warna sebagai alat baca”

Ini area yang **boleh lebih berwarna** daripada form karyawan.

## 7.1 Ringkasan teratas

Buat tiga kartu ringkas dengan status yang langsung terlihat:

```text
Laporan hari ini

12 / 16
Sudah masuk

4
Belum lapor

2
Perlu follow-up
```

Visual:

- `12 / 16` → blue.
- `4 Belum lapor` → red-soft + red rail.
- `2 Perlu follow-up` → amber-soft + amber rail.

### Kenapa boleh merah?

Karena CEO memang membutuhkan **exception reporting**: yang perlu diperhatikan muncul lebih kuat daripada yang normal.

## 7.2 Papan kontrol

Brief secara eksplisit meminta kartu setiap laporan yang ditunggu, status sesuai warna, kartu kosong jika belum lapor, dan bar seperti “12 dari 16 sudah melapor”. fileciteturn0file0L92-L98

### Kartu normal

```text
┌─ green 4px ─────────────────────────────┐
│ Dadang                                  │
│ Humas · Tajur                           │
│                                         │
│ ✓ Sudah melapor                         │
│ 06.17 WIB                               │
│                                         │
│ [ Buka laporan ]                        │
└─────────────────────────────────────────┘
```

### Kartu belum lapor

```text
┌─ red 4px ───────────────────────────────┐
│ Elsa                                    │
│ Indosteak · Restoran                    │
│                                         │
│ ● BELUM LAPOR                            │
│ Belum ada laporan hari ini              │
│ Batas: 17.00 WIB                        │
│                                         │
│ [ Follow-up ]                            │
└─────────────────────────────────────────┘
```

**Seluruh kartu boleh mendapat background `urgent-soft`, bukan merah solid.**

### 7.3 Follow-up harus menjadi aksi utama

Jangan tampilkan “Belum lapor” tanpa tindakan.

Gunakan:

> **Belum lapor**
> [ Follow-up ]

Bukan:

> **Belum lapor**
> [ Detail ]

Karena pekerjaan CEO/admin bukan hanya melihat masalah, tetapi memutuskan tindakan.

---

# 8. Status: 3 tingkat + 1 status kelengkapan

## 8.1 Status bisnis

| Status | Warna | Visual | Contoh |
|---|---|---|---|
| Aman | Hijau | rail + ikon + teks | `Sudah lapor` |
| Perlu dikawal | Amber | rail + ikon + teks | `Follow-up diperlukan` |
| Urgent | Merah | rail + ikon + teks + soft fill | `Belum lapor` / tenggat dekat |

## 8.2 Status kelengkapan

Status kelengkapan harus terpisah:

- `Lengkap`
- `Belum lengkap`
- `Belum diisi`

Jangan menyamakan “belum target” dengan “urgent”.

Contoh:

> **Lengkap** · **Perlu dikawal**

Artinya data sudah lengkap, tetapi isi laporannya membutuhkan perhatian.

## 8.3 Status tidak boleh hanya mengandalkan warna

Selalu sertakan:

1. teks status,
2. ikon kecil atau simbol sederhana,
3. rail warna.

Jangan hanya:

> `[ merah ]`

Harus:

> `● Belum lapor`

## 8.4 Penggunaan merah yang tepat

Merah boleh tampil pada area yang memang membutuhkan perhatian:

- belum lapor,
- tenggat terlewat,
- pengajuan urgent,
- bukti wajib belum ada ketika pengiriman akan gagal.

Merah **tidak** boleh tampil untuk:

- background aplikasi,
- header umum,
- kartu target yang sekadar belum tercapai,
- tombol biasa.

---

# 9. Panel PTE — enam kewajiban

Brief menetapkan enam kewajiban harian: live, undangan konsumen, kesaksian/testimoni, Google Review, minimal tiga konten, dan video mentahan; masing-masing harus memiliki bukti. fileciteturn0file0L88-L90

## 9.1 Bentuk final

Di desktop/CEO:

```text
PTE hari ini                             4 dari 6 selesai
██████████████░░

✓  Live streaming                  Bukti ada
✓  Undangan konsumen               Bukti ada
✓  Testimoni konsumen              Bukti ada
✓  Google Review                   Bukti ada
!  3 konten media sosial           Bukti belum ada
!  Video mentahan                  Bukti belum ada
```

Di mobile, tiap baris menjadi kartu ringan dengan **rail kiri**.

### Alasan

Boleh ada lebih banyak warna di PTE karena enam item memang berisi status pekerjaan. Warna tetap dipasang pada rail/status, bukan 6 kotak penuh warna.

## 9.2 Ringkasan saat semuanya belum lengkap

Jangan tampilkan 6 ikon merah besar.

Gunakan:

```text
┌─ red 4px ────────────────────────────┐
│ PTE belum lengkap                    │
│ 0 dari 6 kewajiban selesai           │
│ Tinggal 6 kegiatan + bukti.          │
└──────────────────────────────────────┘
```

Detail di bawahnya tetap netral/soft.

---

# 10. Form field

## Aturan umum

- Tinggi minimum 48 px.
- Sasaran sentuh minimal 44 px.
- Label 14 px, semibold.
- Isi 16 px.
- Error dekat dengan field.
- Focus memakai border brand + focus ring tipis.
- Placeholder tidak boleh lebih dominan daripada nilai aktual.

## 10.1 Angka

```text
Undangan baru hari ini *
[ 3 ] orang
```

Tambahkan satuan di luar input bila memungkinkan supaya pengguna tidak perlu mengetik “orang”.

## 10.2 Rupiah

```text
Nominal pengajuan *
[ Rp 300.000 ]
```

## 10.3 Teks

```text
Nama konsumen
[ Nama lengkap konsumen ]
```

## 10.4 Teks panjang

Gunakan tinggi awal 96–120 px, dapat tumbuh sesuai isi.

## 10.5 Pilihan status

Untuk tiga status:

```text
Status laporan

[ Aman ] [ Perlu dikawal ] [ Urgent ]
```

Saat satu dipilih, opsi lain tetap netral. Warna muncul pada pilihan aktif saja.

## 10.6 Ya/tidak

Gunakan pilihan dua tombol yang jelas:

```text
Sudah ditindaklanjuti?
[ Ya ] [ Belum ]
```

## 10.7 Tabel berulang

Pada 360 px ubah menjadi list item.

## 10.8 Unggah bukti

Gunakan bahasa manusia:

> `Pilih foto bukti`

bukan:

> `Choose File`

Setelah file ada:

```text
✓ Foto bukti tersedia
bukti-review.jpg
[ Ganti foto ]
```

---

# 11. Panel terisi otomatis

Data otomatis harus terlihat **lebih informatif, bukan seperti disabled input**.

```text
┌─ blue-soft ────────────────────────────┐
│ Data dari laporan hari ini             │
│                                       │
│ Nama              Dadang               │
│ Lokasi            Tajur                │
│ Undangan          8 orang              │
│                                       │
│ Terisi otomatis · tidak perlu diubah  │
└────────────────────────────────────────┘
```

### Kenapa biru-soft?

Biru adalah warna identitas dan paling aman untuk informasi sistem. Jangan menggunakan abu-abu terlalu pucat karena pengguna 51 tahun atau pengguna di bawah sinar matahari bisa menganggap datanya tidak aktif/terbaca.

---

# 12. Absen

Brief meminta tombol besar, GPS, kamera, foto, titik lokasi, jarak, dan status berhasil/di luar radius. fileciteturn0file0L90-L94

## Urutan layar

```text
Absen masuk

Lokasi Anda
✓ Dalam radius
120 m dari Kantor Pusat

Kamera
[ preview ]

Pastikan wajah terlihat jelas.

[ Ambil foto absen ]
```

Setelah foto:

```text
✓ Foto siap
✓ Lokasi sesuai
06.04 WIB

[ Kirim absen ]
```

### Status GPS

Gunakan warna semantik:

- hijau-soft: `Dalam radius`
- merah-soft: `Di luar radius`
- amber-soft: `Lokasi sedang diperiksa`

Jangan gunakan pesan teknis seperti “GPS error 403”.

---

# 13. Antrean keputusan CEO

Brief meminta nominal, tenggat, dampak, dan tombol Setujui / Cicil / Tunda / Tolak. fileciteturn0file0L94-L98

## Struktur visual

```text
┌─ amber 4px ────────────────────────────┐
│ Permintaan dana                        │
│ Rp 3.500.000                           │
│                                        │
│ Tenggat       Hari ini, 15.00         │
│ Dampak        Pengecoran tertunda     │
│ Pengaju       Dadang · Tajur          │
│                                        │
│ [ Setujui ] [ Cicil ]                 │
│ [ Tunda ]  [ Tolak ]                  │
└────────────────────────────────────────┘
```

### Tombol

- `Setujui` = brand blue, primary.
- `Cicil` = amber-soft/outlined.
- `Tunda` = neutral outlined.
- `Tolak` = urgent outline, bukan tombol merah solid yang mendominasi.

### Alasan

Tindakan utama harus mudah terlihat, tetapi keputusan destruktif seperti “Tolak” tidak boleh lebih mencolok daripada “Setujui”.

---

# 14. Kartu ringkasan angka

Satu kartu = satu pertanyaan.

Contoh CEO:

```text
Laporan masuk
12 dari 16
4 masih ditunggu
```

```text
Belum lapor
4 orang
Follow-up diperlukan
```

```text
PTE
4 dari 6
2 bukti belum ada
```

### Warna

- Informasi = blue.
- Masalah = red-soft.
- Perlu tindak lanjut = amber-soft.
- Selesai = green-soft.

Ini adalah salah satu tempat utama untuk memberi “warna” tanpa membuat UI terasa ramai.

---

# 15. Riwayat

Gunakan filter bulan/tahun seperti tampilan sekarang, tetapi hasil harus menunjukkan status langsung:

```text
Agustus 2026

30 Agustus
Laporan marketing
✓ Lengkap · 12.04 WIB

29 Agustus
Laporan marketing
✓ Lengkap · 17.10 WIB
```

Untuk laporan belum lengkap:

```text
28 Agustus
Laporan marketing
! Belum lengkap
2 bukti PTE belum ada
```

Jangan hanya menampilkan tanggal dan judul; status membantu pengguna menemukan masalah lama tanpa membuka satu per satu.

---

# 16. Keadaan kosong

Keadaan kosong harus menjawab tiga hal:

1. apakah memang belum ada data,
2. kenapa belum ada,
3. apa yang dapat dilakukan.

Contoh:

```text
Belum ada laporan hari ini
Belum ada laporan yang masuk sampai sekarang.

[ Lihat papan kontrol ]
```

Riwayat:

```text
Belum ada laporan di bulan ini
Laporan yang sudah dikirim akan muncul di sini.

[ Buat laporan hari ini ]
```

Jangan gunakan ilustrasi besar; gunakan whitespace dan satu ikon sederhana bila perlu.

---

# 17. Pesan error

Formula:

> **Apa yang salah → tindakan yang harus dilakukan.**

Contoh:

> **Foto belum dipilih.**
> Ambil foto absen terlebih dahulu.

> **Lokasi belum sesuai.**
> Anda masih 580 m dari titik lokasi yang diizinkan.

> **Bukti PTE belum lengkap.**
> Lengkapi 2 bukti sebelum mengirim laporan.

### Error summary di form panjang

Di bagian atas form tampilkan satu baris ringkasan:

```text
┌─ red 4px ─────────────────────────────┐
│ Ada 3 bagian yang belum lengkap       │
│ Gulir ke bagian yang ditandai merah.  │
└────────────────────────────────────────┘
```

Lalu setiap error tetap ditaruh di field asalnya.

---

# 18. Tombol dan tindakan

## Primary

Biru brand, tinggi 48 px.

Contoh:

`Simpan laporan`
`Kirim absen`
`Follow-up`

## Secondary

Putih + border biru/neutral.

## Danger

Gunakan merah hanya jika tindakan atau keadaan memang urgent.

Contoh:

`Tolak permintaan`

Boleh memakai border merah + teks merah, tetapi jangan membuat semua tombol error berwarna merah.

## Tindakan utama harus terlihat dalam 1 viewport bila memungkinkan

Terutama:

- Isi laporan
- Kirim absen
- Follow-up
- Setujui

---

# 19. Nav bawah 5 tombol

Lima tombol:

1. Beranda
2. Laporan
3. **Absen** — tengah
4. Riwayat
5. Menu

### Visual

```text
┌─────────────────────────────────────┐
│ Beranda  Laporan   ( ABsen )  Riwayat Menu │
│                    ●                 │
└─────────────────────────────────────┘
```

Tombol Absen satu-satunya lingkaran besar yang menonjol. Semua tombol lain menggunakan ikon + label biasa.

### Kenapa ini berbeda?

Karena lingkaran tersebut memiliki fungsi navigasi yang sangat spesifik. Jangan ulangi bahasa bentuk itu pada status.

---

# 20. Pola warna per jenis layar

| Layar | Warna dominan | Warna status |
|---|---|---|
| Beranda karyawan | Putih + biru | Hijau/amber seperlunya |
| Form harian | Putih + blue-soft | Status hanya pada bagian terkait |
| PTE | Putih + blue-soft | Status pada item PTE |
| Absen | Putih + biru | Hijau/merah GPS |
| Papan kontrol CEO | Putih + blue | Hijau/amber/merah lebih terlihat |
| Antrean keputusan | Putih + blue | Amber/merah sesuai urgensi |
| Riwayat | Putih + blue-soft | Status pada laporan |

### Aturan paling penting

**Semakin banyak keputusan yang perlu dibuat pengguna, semakin banyak warna status yang boleh terlihat.**

Karyawan yang sedang mengisi form tidak perlu melihat 10 kartu merah. CEO yang melihat 16 laporan justru perlu melihat 4 laporan merah dengan jelas.

---

# 21. Contoh redesign langsung dari screenshot saat ini

## 21.1 “Target closing 0 / 2”

### Lama

> `0 / 2` lalu field konsumen.

### Baru

```text
Target closing pribadi

0 dari 2 konsumen
Masih perlu 2 konsumen untuk memenuhi target.

Closing bulan ini
[ 0 ]
```

Tambahkan **bar progress biru** tepat di bawah angka bila ruang memungkinkan.

## 21.2 “Target undangan 0 / 20”

Jangan tampilkan progress abu-abu kosong.

```text
Target undangan
0 dari 20
Masih perlu 20 undangan bulan ini.

████────────────────
```

Progress awal tetap blue-soft + blue, bukan abu-abu total.

## 21.3 PTE 0 / 6

### Lama

Enam tanda silang merah membuat layar seperti error.

### Baru

```text
PTE hari ini

0 dari 6 selesai
Masih perlu 6 kegiatan.

○ Live                         Belum lengkap
○ Undangan                     Belum lengkap
○ Testimoni                    Belum lengkap
○ Google Review                Belum lengkap
○ 3 konten                     Belum lengkap
○ Video mentahan               Belum lengkap
```

Hanya ringkasan utama menggunakan red-soft. Detail memakai neutral + status text.

## 21.4 Papan kontrol CEO

Inilah tempat menggunakan warna lebih kuat:

```text
Laporan hari ini
12 dari 16 sudah masuk

[ BLUE ] 12 Sudah masuk
[ RED  ]  4 Belum lapor
[ AMBER]  2 Perlu follow-up

-----------------------

Dadang   ✓ Sudah lapor
Elsa     ! Belum lapor   [ Follow-up ]
Kasam    ✓ Sudah lapor
...
```

Ini jauh lebih mudah dipindai daripada 16 kartu putih yang semuanya sama.

---

# 22. Mobile-first dan usia pengguna

Brief menetapkan 360 px sebagai lebar uji, sasaran sentuh minimal 44 px, 48 px untuk nav, dan kebutuhan keterbacaan di HP murah/sinar matahari. fileciteturn0file0L102-L113

## 22.1 Jangan menggunakan abu-abu terlalu pucat

Placeholder boleh lebih ringan, tetapi:

- teks isi harus gelap,
- status harus kontras,
- border harus tetap terlihat,
- label jangan memakai gray yang terlalu tipis.

## 22.2 Jangan membuat informasi penting bergantung pada hover

Semua status harus terlihat tanpa hover.

## 22.3 Jangan mengandalkan warna saja

CEO atau pengguna lain bisa melihat warna di bawah sinar berbeda. Selalu ada teks status.

## 22.4 Gunakan ukuran yang “lega”

Pada layar CEO, lebih baik menampilkan 4 kartu penting yang nyaman dibaca daripada 8 kartu kecil yang memerlukan konsentrasi.

---

# 23. Hal yang tetap dilarang

Brief melarang HURUF BESAR SEMUA, sudut siku, font mono di luar angka, latar suram, skor karyawan 0–100 yang tidak berdasar, istilah teknis, terlalu banyak kotak berwarna, gradient, shadow tebal, animasi berlebihan, dan ikon tanpa label. fileciteturn0file0L117-L135

Secara khusus, **jangan menerjemahkan “lebih berwarna” menjadi:**

- 20 badge warna-warni dalam satu layar,
- lingkaran merah/hijau/kuning di setiap item,
- gradient biru ke ungu,
- shadow besar,
- kartu mengambang di atas kartu lain,
- ilustrasi AI generik.

“Lebih berwarna” berarti **status dan prioritas lebih mudah terlihat**.

---

# 24. Aturan untuk agent AI saat membuat komponen baru

Ketika menemukan komponen/halaman baru yang belum dijelaskan di dokumen, gunakan urutan keputusan berikut:

### 1. Apakah elemen ini menunjukkan status?

Jika ya → gunakan semantic color + teks status.

### 2. Apakah elemen ini menunjukkan tindakan utama?

Jika ya → gunakan brand blue.

### 3. Apakah ini informasi biasa?

Jika ya → gunakan neutral surface.

### 4. Apakah pengguna perlu perhatian segera?

Jika ya → red-soft + red rail + tindakan jelas.

### 5. Apakah pengguna hanya perlu tahu bahwa sesuatu selesai?

Jika ya → green-soft atau green rail, jangan full green card kecuali konteks benar-benar membutuhkan scanning cepat.

### 6. Apakah ini hanya dekorasi?

Jika ya → **hapus**. Warna bukan dekorasi di aplikasi ini; warna adalah bahasa informasi.

---

# 25. Checklist mobile 360 px

Sebelum sebuah halaman dianggap selesai:

## Keterbacaan

- [ ] Judul halaman minimal 24–28 px dan tidak pecah aneh.
- [ ] Isian minimal 16 px.
- [ ] Status dapat terbaca tanpa memperbesar layar.
- [ ] Tidak ada teks abu-abu yang terlalu tipis.

## Warna

- [ ] Merah hanya menunjukkan keadaan yang memang urgent/belum dilakukan.
- [ ] Amber hanya menunjukkan perlu perhatian/follow-up.
- [ ] Hijau hanya menunjukkan keadaan aman/selesai.
- [ ] Warna status selalu disertai teks.
- [ ] Tidak ada layar yang tampak seperti kumpulan bubble AI.

## Hierarki

- [ ] Pengguna tahu apa tugas utama dalam 3 detik pertama.
- [ ] Angka penting lebih besar daripada detail.
- [ ] “Tinggal berapa lagi” terlihat.
- [ ] Tindakan utama terlihat tanpa harus mencari-cari.

## Sentuh

- [ ] Target sentuh minimal 44 px.
- [ ] Nav minimal 48 px.
- [ ] Tombol berdampingan tidak terlalu rapat.
- [ ] Tidak ada kontrol yang hanya mengandalkan ikon.

## Layout

- [ ] Tidak ada horizontal scroll.
- [ ] Tidak ada field yang terpotong.
- [ ] Tidak ada angka yang membungkus dengan aneh.
- [ ] Error berada dekat sumber masalah.
- [ ] Papan kontrol masih mudah dipindai satu tangan.

## CEO

- [ ] Dalam satu viewport dapat diketahui: total masuk, belum lapor, perlu follow-up.
- [ ] Laporan merah terlihat tanpa membaca detail.
- [ ] Tombol Follow-up terlihat pada laporan yang belum masuk.
- [ ] Informasi normal tidak mengalahkan informasi yang perlu tindakan.

---

# 26. Teaching snapshot — aturan yang harus diingat agent

> **Netral untuk hal biasa. Biru untuk tindakan dan orientasi. Hijau untuk aman. Amber untuk perlu dikawal. Merah untuk belum/urgent. Gunakan soft fill + rail, bukan kumpulan lingkaran. Besarkan angka dan status. Tulis “tinggal berapa”.**

Kalau harus memilih antara:

- membuat layar terlihat lebih minimal, atau
- membuat masalah lebih mudah ditemukan,

**pilih masalah lebih mudah ditemukan.**

Aplikasi ini dipakai setiap hari oleh orang yang sibuk dan tidak ingin “belajar aplikasi”. Desain terbaik adalah desain yang membuat mereka **tahu ke mana harus melihat sebelum mereka mulai membaca.**

---

# 27. Warna status butuh pembanding (koreksi 31 Agustus 2026)

Ditemukan lewat kasus nyata: Papan Kontrol menampilkan 37 kartu merah "belum lapor" padahal sistemnya BELUM PERNAH dibagikan ke satu pun dari 40 akun -- tidak ada yang tahu passwordnya. Datanya benar (memang belum ada laporan), tapi warnanya salah kesan: merah di sini terbaca sebagai "orang tidak bekerja", padahal yang sebenarnya terjadi adalah "sistem belum menyala".

## Aturan

**Warna status (hijau/kuning/merah) hanya berarti sesuatu kalau ada PEMBANDING** -- sebagian sudah, sebagian belum. Tanpa pembanding, keadaan yang benar bukan "buruk", tapi **"belum ada data"**.

| Keadaan | Contoh | Perlakuan |
|---|---|---|
| Sebagian sudah, sebagian belum | 12 dari 16 sudah lapor | Merah untuk yang belum SAH dipakai -- itu memang tertinggal dibanding yang lain. |
| Nol dari semua | 0 dari 37 sudah lapor | BUKAN merah. Ini "belum mulai", bukan "semua tertinggal" -- tampilkan keadaan kosong netral. |
| Semua sudah | 16 dari 16 sudah lapor | Hijau, tidak perlu warna lain. |

## Kenapa "nol dari semua" beda dari "sebagian tertinggal"

"Tertinggal" hanya masuk akal kalau ADA yang tidak tertinggal untuk dibandingkan. Kalau tidak satu pun sudah lapor, kemungkinan besar bukan berarti 100% orang bermasalah pada saat bersamaan -- lebih mungkin sistemnya belum dipakai (baru diluncurkan, akun belum dibagikan, atau memang hari itu belum waktunya). Menampilkan wall merah dalam keadaan begini membuat kesan pertama CEO salah total: dia akan mengira staf tidak bekerja, padahal stafnya belum pernah login.

## Pola tampilan

Keadaan kosong yang jujur (bukan wall merah):

```text
Belum ada laporan hari ini
37 laporan ditunggu dari 40 orang.
Kartu akan berubah warna begitu laporan mulai masuk.

[ Lihat daftar yang ditunggu ]
```

Kalau tombol itu ditekan, daftar boleh muncul -- tapi kartunya **netral** (rail abu-abu, bukan rail merah), karena belum ada pembanding yang membuat "belum lapor" berarti "tertinggal".

Begitu SATU laporan pertama masuk, keadaan berubah jadi "sebagian tertinggal" -- barulah sisanya boleh merah, karena sekarang ada pembanding sungguhan: sebagian orang sudah menunjukkan itu mungkin dilakukan hari itu, sebagian belum.

## Implementasi rujukan

`app/papan/page.tsx` (`belumMulai = totalSemua > 0 && totalSudah === 0`) dan `components/PapanKartu.tsx` (prop `netral`). Prinsip yang sama berlaku di mana pun ada agregasi status serupa (bukan cuma Papan Kontrol) -- kalau menemukan kasus baru "0 dari N", jangan tebak, terapkan pola yang sama: keadaan kosong netral dulu, warna status menyusul begitu ada pembanding sungguhan.

---

# BAGIAN TAMBAHAN — Revisi dari ChatGPT, ditinjau ulang (31 Agustus 2026)

CEO memasukkan sebuah draf redesign baru dari ChatGPT yang SEMPAT MENIMPA seluruh file ini. Seluruh isi §0–27 di atas sudah **dipulihkan utuh** dari git -- itu tetap sistem desain yang berlaku, lahir dari masalah nyata aplikasi ini, bukan teori. Bagian di bawah ini adalah **arahan TAMBAHAN** dari draf ChatGPT yang dinilai berguna dan TIDAK bertentangan dengan apa pun di atas atau dengan CLAUDE.md -- ditambahkan sebagai pelengkap, bukan pengganti.

**Aturan baca**: kalau bagian di bawah ini bentrok dengan §0–27 di atas, §0–27 YANG BERLAKU. Draf ChatGPT ditulis tanpa melihat kode aplikasi ini, jadi beberapa bagiannya keliru/generik -- yang keliru itu **dibuang total di sini, bukan cuma ditandai**:

- **Font Manrope** (draf ChatGPT mengganti seluruh font ke Manrope) -- **DIBUANG**. CLAUDE.md #10 mengunci Plus Jakarta Sans untuk seluruh antarmuka, dan `app/tokens.css` sudah berjalan dengannya. Tidak ada alasan untuk ganti.
- **Larangan tanda `--`/`—`/`·`/`→` "sebagai pengganti struktur layout"** (muncul dua kali di draf ChatGPT: §18.3 dan checklist Definition of Done) -- **DIBUANG**. Ini bentrok langsung dengan UI yang SUDAH BERJALAN di seluruh aplikasi (mis. `jamWIB` dipisah `·` di `PapanKartu`/`riwayat`/Tinjau Absensi -- "Masuk 09:23 · jam masuk 08:00 · toleransi 15 menit → terlambat 68 menit" -- pola yang baru saja diverifikasi & disetujui). Draf ChatGPT tidak melihat kode ini saat menulis aturan tsb.
- **"[Cetak / Ekspor PDF]"** di contoh Laporan Terpusat -- **dikoreksi jadi cuma "Unduh Excel"**. Aplikasi ini tidak punya (dan tidak pernah diminta punya) ekspor PDF, cuma `.xlsx` lewat `TombolEkspor`.

## T.1 Perbedaan "laporan masuk, nilai 0" vs "belum lapor" (BUKAN duplikat §27)

Ini aturan yang BERBEDA dari §27 di atas, walau kedengarannya mirip -- keduanya soal "jangan otomatis menganggap nol itu buruk", tapi di level yang berbeda:

- **§27 (di atas)** bicara soal AGREGAT lintas-orang di satu papan: "0 dari 37 SUDAH LAPOR" (belum ada satu pun laporan masuk sama sekali hari itu) -- itu netral, "belum mulai", karena tidak ada pembanding.
- **T.1 (di sini)** bicara soal ISI satu laporan yang SUDAH masuk: satu orang sudah lapor, dan salah satu ANGKA di laporannya kebetulan 0 (mis. "Satpam hadir: 0 orang" adalah jawaban sah, bukan tanda laporan kosong/belum lengkap).

Kedua aturan berlaku BERSAMAAN, di tempat berbeda -- jangan dianggap salah satu menggantikan yang lain.

**Belum lapor** (tidak ada laporan masuk sama sekali): rail kiri merah, latar merah-lembut, label "Belum lapor", aksi utama "Follow-up".

**Laporan masuk, nilai 0** (laporan sah sudah masuk, kebetulan nilainya 0): netral/hijau seperti laporan lain, angka tetap ditampilkan kuat, boleh ada label "Laporan diterima". Jangan pernah membuat angka 0 di DALAM laporan yang sudah masuk otomatis terlihat seperti error.

## T.2 Empat tingkat perhatian per layar

Kesalahan paling sering: membuat semua bagian di satu layar terlihat sama penting. Setiap layar (terutama form panjang & dashboard) sebaiknya mengikuti urutan:

1. **Orientasi** -- Apa halaman ini? (mis. "Laporan Hari Ini, Senin 31 Agustus 2026")
2. **Kondisi utama** -- Apa status saya sekarang? (mis. "12 dari 16 sudah melapor · 4 belum lapor · 3 perlu dikawal")
3. **Aksi** -- Apa yang harus dilakukan? (mis. "4 PIC belum melapor [Follow-up]")
4. **Detail** -- Baru di sini data rinci/bagian laporan ditampilkan.

Penjelasan metadata ("data ini berasal dari laporan Security seluruh lokasi & shift") jangan ditaruh sebagai paragraf panjang di ATAS data -- taruh sebagai baris kecil "Sumber data / Laporan Security / Seluruh lokasi & shift" SETELAH angka utama, bukan sebelum.

## T.3 Level permukaan (surface)

Maksimal empat level, jangan bikin 8–10 variasi abu-abu cuma untuk kesan "depth":

1. **Canvas** -- latar halaman.
2. **Surface** -- kartu/panel utama.
3. **Surface soft** -- field, sub-panel, area input.
4. **Semantic soft** -- area status merah/kuning/hijau (`--merah-lembut`/`--kuning-lembut`/`--biru-lembut` di `app/tokens.css`).

Kartu biasa cukup border lembut, TANPA shadow besar. Shadow (`--bayangan-kartu`) cuma untuk nav bawah, tombol mengambang Absen, dan panel yang sungguh mengambang -- bukan kartu biasa.

## T.4 Laporan Terpusat (belum ada spesifikasi tersendiri di atas)

```text
Laporan Terpusat

[Ringkasan status hari ini]

[Perlu ditindaklanjuti]

Semua bagian laporan
1. Data Konsumen / Sistem
2. CS & Masalah Konsumen
3. Operasional Kantor
...
15. Rekap Status PIC Lokasi

[Unduh Excel]
```

Section yang datanya belum tersedia: jangan bikin pengguna menebak-nebak. Pakai pola sama dengan keadaan kosong (§16): "**Belum ada laporan HRD hari ini.** Pastikan PIC terkait sudah mengirim laporan. [Follow-up PIC]" -- bukan cuma "Belum ada laporan HRD pada tanggal ini."

## T.5 Copywriting / aturan bahasa

Bahasa: langsung, pendek, manusiawi, sopan, tidak teknis.

Hindari bahasa sistem:
- Jangan "Validasi gagal." → "**Data belum lengkap.** Isi bagian yang masih kosong lalu coba kirim lagi."
- Jangan "Submission berhasil." → "**Laporan sudah dikirim.**"
- Jangan "Tidak ada data." → "**Belum ada laporan hari ini.** Belum ada data yang diterima dari PIC terkait."

Hindari nada "AI menjelaskan database":
- Jangan "Data ini berasal dari rekap laporan divisi lain dan tidak dapat diedit oleh pengguna karena merupakan hasil agregasi otomatis." → "**Terisi otomatis** — Data ini berasal dari laporan divisi lain."

(Bagian soal larangan tanda `--`/`—`/`·` yang ada di draf asli SENGAJA tidak dipindahkan ke sini -- lihat catatan pembuka bagian tambahan ini.)

## T.6 Warna berwarna tapi tidak norak

**Boleh**: soft red/amber/green surface, blue CTA, blue accent pada judul, tinted input background, angka berwarna status, rail kiri.

**Jangan**: gradient, neon, satu layar penuh 5 warna sekaligus, 10 badge pill berbeda, setiap baris diberi ikon warna berbeda, shadow tebal, glassmorphism, status dot berulang-ulang.

## T.7 Arsitektur komponen — pola ilustratif, BUKAN nama komponen sungguhan

Draf ChatGPT mengusulkan pohon komponen generik (`AppShell/TopBar/PageHeader/StatusSummary/SectionCard/StatusPanel/FollowUpCard/EmptyState/ErrorState/SuccessState/BottomNav`). **Ini cuma ilustrasi lapisan konsep** (shell → header → status → section → kartu → empty/error/success → nav) -- BUKAN nama komponen yang sungguh ada. Komponen SUNGGUHAN di aplikasi ini sudah ada dan harus dipakai ulang, bukan dibuat versi generiknya lagi: `FormRenderer` (form schema-driven, CLAUDE.md #6 -- jangan menulis komponen per form), `PapanKartu`, `AntreanKartu`, `CameraCapture`, `Terlindungi` (guard peran), `KeadaanGagal`, `PemilihTanggal`, `TombolEkspor`, `AngkaGrid`. Kalau butuh komponen baru, cek dulu apakah salah satu ini sudah cukup digeneralisasi sebelum menulis yang baru.

## T.8 Urutan prioritas -- draf awal, SUDAH BANYAK YANG SELESAI

Draf ChatGPT menulis urutan pengerjaan dari nol (tokens → shell → dashboard → ... → riwayat) dengan asumsi belum ada yang dibangun. **Itu tidak sesuai kenyataan** -- lihat `docs/PROGRESS.md` untuk status sungguhan: Panel PTE, Papan Kontrol (termasuk §27), Antrean Keputusan, Absen, Riwayat semuanya SUDAH direvisi. Jangan pakai urutan draf ini sebagai checklist "belum dikerjakan" -- cek PROGRESS.md dulu sebelum mengasumsikan sesuatu belum disentuh.

## T.9 Definition of Done (checklist tambahan, bukan pengganti §25 lama)

Redesign/perubahan visual baru dianggap selesai kalau, SELAIN checklist §25 di atas:

- Font tetap Plus Jakarta Sans (BUKAN "terasa modern" generik -- ganti font tidak termasuk definisi selesai di sini).
- UI terasa seperti aplikasi mobile modern, bukan aplikasi admin lama.
- Warna tetap punya makna (bukan sekadar lebih berwarna).
- Dashboard CEO bisa dipindai 3-5 detik.
- "Belum lapor" jelas terlihat sebagai masalah, "angka 0 di laporan yang sudah masuk" TIDAK disalahartikan sebagai belum lapor (lihat T.1).
- Teks abu-abu tetap terbaca.
- Tidak ada paragraf metadata bernada "AI menjelaskan database" (lihat T.5).
- Tidak ada bubble/pill berlebihan.
- Form panjang terasa terstruktur dan punya progres.
- Status PTE dipahami sekilas.
- Absen mudah dilakukan satu tangan.
- Semua layar tetap terbaca di 360px.
- Tidak ada UI kit atau library ikon tambahan (CLAUDE.md).

(Item "strip `--`/`—`/`·` tidak dipakai sebagai struktur layout" dari draf asli SENGAJA dihapus dari checklist ini -- lihat catatan pembuka bagian tambahan.)

## T.10 Golden rule

> **Buat pengguna melihat hal yang penting sebelum mereka membacanya.**
>
> Gunakan warna untuk prioritas, tipografi untuk hierarki, spacing untuk pengelompokan, dan teks untuk memastikan makna. Jangan menggunakan dekorasi untuk menggantikan struktur informasi.
