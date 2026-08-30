# DESIGN.md — Sistem Laporan Harian Koperumnas Group

> Sistem desain untuk aplikasi laporan harian internal PT Konsumen Perumahan Nasional (Koperumnas Group).
>
> **Prinsip utama:** aplikasi ini bukan “dashboard yang keren”. Ini adalah **alat kerja harian** yang harus bisa dipakai orang yang sedang berdiri, terburu-buru, memakai Android kelas menengah-bawah, dan tidak terbiasa dengan aplikasi kerja. Desain harus membantu pengguna tahu **apa yang harus dilakukan sekarang, apa yang sudah selesai, dan apa konsekuensinya** tanpa membuat mereka membaca banyak hal.

---

## 0. Konteks yang tidak boleh dilanggar

Aplikasi digunakan oleh 39 orang; mayoritas memakai HP Android kelas menengah-bawah, dengan kemampuan teknologi rendah sampai sedang, sering di lokasi kerja dengan sinyal seadanya, dan membuka aplikasi setiap hari. Ukuran keberhasilan desain yang paling konkret adalah: **Elsa dapat menyelesaikan laporan hariannya dalam ±5 menit tanpa bertanya kepada siapa pun pada hari pertama.**

Peran yang harus selalu dipertimbangkan:

- **Kasam** — satpam pabrik; absen sekitar 06.00 dan mengisi laporan keamanan per shift.
- **Dadang** — humas lokasi Tajur; laporan lokasi dengan foto pembangunan dan laporan marketing pribadi.
- **Elsa** — pelayan restoran; hanya perlu laporan marketing pribadi.
- **Ibu Putri** — CEO; melihat dashboard dan memutuskan permintaan persetujuan dana.
- **Ibu Sabrina** — pusat pelaporan; memantau siapa yang sudah melapor dan menyusun laporan untuk CEO.

### Tujuan desain

Setiap layar harus menjawab, dalam urutan ini:

1. **Apa yang harus saya lakukan?**
2. **Apa yang sudah selesai?**
3. **Apa yang masih kurang?**
4. **Kalau belum selesai, apa akibatnya?**

Jangan membebankan jawaban itu ke ikon, warna, atau tebakan pengguna.

---

# 1. Arah visual: “tenang, profesional, terasa seperti alat kerja”

## 1.1 Karakter visual

Gunakan bahasa visual yang terasa:

- **soft tetapi bukan pastel**
- bersih tetapi tidak steril
- profesional tetapi tidak kaku
- manusiawi tetapi tidak “aplikasi lifestyle”
- mudah dipindai dalam 2–3 detik

### Analogi

Bayangkan **clipboard kerja yang dirancang rapi**, bukan dashboard AI dan bukan aplikasi keuangan.

Clipboard kerja punya kertas putih, judul yang jelas, garis pembatas tipis, satu stabilo untuk hal penting, dan tanda status hanya ketika memang diperlukan. Ia tidak membutuhkan puluhan lingkaran berwarna.

## 1.2 Prinsip “soft tanpa menjadi AI-ish”

Keluhan desain saat ini: terlalu banyak bentuk bulat, badge, dot status, dan kotak berwarna terasa seperti antarmuka AI generik.

Karena itu:

- **Jangan** menjadikan lingkaran kecil sebagai bahasa utama status.
- **Jangan** memberi pill/badge pada setiap label.
- **Jangan** membuat setiap kartu seperti “floating island”.
- **Jangan** memakai gradient.
- **Jangan** membuat semua elemen punya shadow.
- **Jangan** menggunakan warna status sebagai dekorasi.

Sebagai gantinya, gunakan **hierarki melalui ukuran teks, ruang, garis, dan posisi**.

### Bahasa bentuk

- Kartu utama: radius sedang.
- Input: radius kecil–sedang.
- Tombol utama: radius sedang, bukan kapsul penuh.
- Status: **baris teks + penanda sempit** atau badge kecil hanya jika benar-benar membantu scanning.
- Progress: garis horizontal tipis dengan ujung sedikit membulat; bukan lingkaran progress.
- Ikon: kecil dan fungsional; selalu ditemani teks ketika fungsi tidak universal.

---

# 2. Token desain

## 2.1 Catatan warna logo

**Diperbarui 30 Agustus 2026 -- disampel LANGSUNG dari `public/logo-koperumnas.jpg` (1079×1079px), bukan lagi perkiraan dari screenshot.** Skrip sampling (`scripts/_sample-warna-logo.mjs`, sekali pakai, dihapus setelah dipakai) mengelompokkan seluruh piksel jadi bucket warna dan mengambil yang paling sering muncul, dipisah dari putih/abu netral:

| Elemen | Hex sebenarnya | Perkiraan lama (brief/screenshot) |
|---|---|---|
| Biru tua (teks, setengah gelap ikon) | **`#0047AF`** | `#1A4FA0` (brief) / `#0048AE` (screenshot) -- sangat dekat, dikonfirmasi |
| Biru muda (garis pentagon, setengah terang ikon) | **`#3FAAF2`** | `#57ADE6` (brief) / `#57A7DC` (screenshot) -- ternyata lebih jenuh/vivid dari kedua perkiraan |
| Emas (dua bintang) | **`#F3AB23`** | `#EFA829` -- dekat, sedikit lebih oranye di aset asli |
| Latar | `#FFFFFF` (putih solid) | sesuai brief |

Token di §2.2 di bawah SUDAH diperbarui memakai nilai sebenarnya ini sebagai jangkar (700=biru tua, 500=biru muda, gold-500=emas) -- langkah ramp lain (950–800, 600, 100–50, gold-600/100) dihitung sebagai tint/shade dari dua jangkar itu, bukan disampel terpisah.

## 2.2 CSS variables — siap ditempel

```css
:root {
  /* ================================
     BRAND
     ================================ */
  --color-brand-950: #002e72;
  --color-brand-900: #003789;
  --color-brand-800: #00409e;
  --color-brand-700: #0047af; /* disampel langsung dari logo -- lihat §2.1 */
  --color-brand-600: #2079d1;
  --color-brand-500: #3faaf2; /* disampel langsung dari logo -- lihat §2.1 */
  --color-brand-100: #e8f5fd;
  --color-brand-50:  #f4fafe;

  /* Aksen logo — jangan pakai sebagai status */
  --color-gold-600: #c78c1d;
  --color-gold-500: #f3ab23; /* disampel langsung dari logo -- lihat §2.1 */
  --color-gold-100: #fef7e9;

  /* ================================
     NEUTRAL
     ================================ */
  --color-white: #ffffff;
  --color-canvas: #f7f9fb;
  --color-surface: #ffffff;
  --color-surface-subtle: #f3f6f9;
  --color-surface-muted: #edf2f6;
  --color-border: #dfe6ed;
  --color-border-strong: #cbd6e0;
  --color-text: #182334;
  --color-text-secondary: #4f5e70;
  --color-text-muted: #748297;
  --color-text-disabled: #9aa6b5;

  /* ================================
     STATUS — SEMANTIC ONLY
     Jangan gunakan untuk dekorasi/background umum.
     ================================ */
  --color-safe: #23845d;
  --color-safe-bg: #eaf7f1;
  --color-safe-border: #bde6d3;

  --color-watch: #a96b00;
  --color-watch-bg: #fff5df;
  --color-watch-border: #f0d79b;

  --color-urgent: #b42332;
  --color-urgent-bg: #fcedef;
  --color-urgent-border: #f1c0c6;

  /* ================================
     FOCUS / INTERACTION
     ================================ */
  --color-focus: #2f7fc5;
  --focus-ring: 0 0 0 3px rgba(87, 173, 230, 0.24);

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
     SPACE
     Base unit = 4px
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
  --radius-pill: 999px;  /* only for compact status/progress */

  /* ================================
     SHADOW — SANGAT HEMAT
     ================================ */
  --shadow-none: none;
  --shadow-subtle: 0 1px 2px rgba(17, 35, 54, 0.04),
                   0 4px 12px rgba(17, 35, 54, 0.04);
  --shadow-nav: 0 -1px 8px rgba(17, 35, 54, 0.07);

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

### Kenapa token netral dominan?

Karena status perusahaan sudah memiliki arti tetap: **aman / perlu dikawal / urgent**. Bila UI dasar juga sering memakai hijau, kuning, atau merah, mata pengguna tidak dapat lagi membedakan “status” dari “dekorasi”. Warna status harus memiliki **attention privilege**: warna yang paling jarang muncul justru menjadi yang paling mudah terlihat.

---

# 3. Tipografi

Gunakan **Plus Jakarta Sans** melalui `next/font` karena sudah menjadi keputusan visual di versi berjalan dan cocok untuk teks antarmuka yang padat.

## 3.1 Skala

| Peran | Ukuran | Tebal | Line-height | Aturan |
|---|---:|---:|---:|---|
| Judul halaman | 28 px | 700 | 1.2 | Maks. 2 baris di 360px |
| Judul bagian | 20 px | 700 | 1.35 | Menjadi anchor utama tiap bagian |
| Subjudul/keterangan | 14–16 px | 400–500 | 1.5 | Menjelaskan konsekuensi atau konteks |
| Label field | 14 px | 600 | 1.35 | Kalimat biasa, bukan HURUF BESAR |
| Isian/input | 16 px | 500 | 1.5 | Tidak boleh lebih kecil dari 16px untuk mencegah zoom iOS dan menjaga keterbacaan |
| Placeholder | 15–16 px | 400 | 1.5 | Lebih redup dari isian, tetapi tetap terbaca |
| Bantuan/error | 13–14 px | 500 | 1.45 | Dekat dengan field yang dijelaskan |
| Angka ringkasan | 28–32 px | 700 | 1.1 | Hanya untuk angka yang perlu dipindai cepat |
| Angka kecil/progress | 16–20 px | 700 | 1.2 | Untuk “12 dari 16”, “0 dari 2”, dsb. |
| Nav label | 11–12 px | 600 | 1.2 | Tetap sertakan label teks |

### Alasan utama

**Jangan mengecilkan teks demi memasukkan lebih banyak informasi.** Pada layar 360px, solusi untuk konten yang terlalu panjang adalah **mengurangi kepadatan sekaligus mengatur hierarki**, bukan membuat huruf kecil.

### Aturan angka

Angka penting harus diperlakukan sebagai **hasil**, bukan sebagai dekorasi.

Contoh:

> **12 dari 16 laporan sudah masuk**
>
> 4 laporan masih ditunggu.

Lebih baik daripada:

> **12 / 16**

Karena yang kedua memaksa pengguna menafsirkan sendiri.

---

# 4. Sistem layout

## 4.1 Lebar mobile

Titik uji utama:

- **360 px** — wajib lolos
- 390–430 px — target nyaman
- desktop — terutama CEO/admin

Pada 360 px, gunakan horizontal padding:

```css
padding-inline: 16px;
```

Untuk layar > 640 px, dapat naik menjadi 20–24 px.

## 4.2 Grid vertikal

Gunakan ritme:

- 8 px: hubungan sangat dekat
- 12 px: hubungan dekat
- 16 px: antar field
- 20–24 px: antar subkelompok
- 28–32 px: antar bagian
- 40+ px: pemisahan konteks besar

**Aturan penting:** jangan membuat setiap field punya margin yang sama dengan setiap section. Itulah salah satu penyebab semua elemen terlihat sama penting.

---

# 5. Pola hierarki untuk form hingga 9 bagian

Ini adalah masalah terbesar pada aplikasi saat ini.

## 5.1 Jangan tampilkan 9 section sebagai 9 kartu setara

Pola lama:

> Kartu 1 → Kartu 2 → Kartu 3 → Kartu 4 → …

Hasilnya terasa seperti dokumen panjang.

Pola baru:

> **Ringkasan pekerjaan hari ini**
>
> 3 dari 9 bagian selesai · 6 masih perlu diisi
>
> [bar tipis progress]
>
> **01 — Absen** ✓ selesai
> **02 — Target closing pribadi** 0 dari 2
> **03 — Undangan konsumen** 0 dari 20
> **04 — PTE hari ini** 2 dari 6
> …
>
> lalu detail section yang sedang aktif.

### Analogi

Form panjang harus bekerja seperti **checklist perjalanan**, bukan seperti gulungan kertas resep. Pengguna perlu melihat peta kecil sebelum masuk ke detail.

## 5.2 Setiap section punya 4 lapisan visual

### Lapisan A — indeks

Contoh:

`02`  **Target closing pribadi**

Nomor kecil membantu otak tahu posisi tanpa membuat nomor menjadi dekorasi besar.

### Lapisan B — hasil/kemajuan

Contoh:

`0 dari 2 konsumen`

atau

`4 dari 6 kewajiban selesai`

### Lapisan C — konsekuensi

Contoh:

`Belum memenuhi target bulanan.`

atau:

`Semua 6 kegiatan harus lengkap agar PTE dapat diajukan.`

### Lapisan D — detail input

Field hanya tampil setelah pengguna memahami “mengapa saya mengisinya”.

## 5.3 Section tidak aktif boleh diringkas

Di daftar/ringkasan:

```text
02  Target closing pribadi
    0 dari 2 konsumen
    Belum memenuhi target
    Buka bagian →
```

Saat dibuka:

```text
02  Target closing pribadi
    Target minimal 2 konsumen / bulan

    Closing bulan ini
    [ 0 ]

    Data konsumen 1
    [Nama konsumen]
    [Lokasi proyek / blok]
    [Status]

    Data konsumen 2
    ...
```

**Alasan:** pengguna tidak perlu terus melihat semua detail sekaligus. Yang perlu selalu terlihat adalah orientasi dan kemajuan.

## 5.4 Hindari accordion yang menyembunyikan hal penting

Accordion boleh dipakai sebagai **ringkasan section**, bukan untuk menyembunyikan peringatan kritis, hasil, atau status yang perlu tindakan segera.

---

# 6. Kartu bagian form

## Struktur

```text
[02]  Target closing pribadi
      Target minimal 2 konsumen / bulan

      0 dari 2 konsumen
      ────────────────
      Belum memenuhi target

      [ detail field ... ]
```

### Spesifikasi

- Background: `--color-surface`
- Border: 1 px `--color-border`
- Radius: `--radius-lg`
- Padding mobile: 16 px
- Padding desktop: 20–24 px
- Shadow: none secara default
- Section aktif dapat memakai border brand sedikit lebih kuat, bukan glow.

### Penanda aktif

Gunakan salah satu:

- garis vertikal 3 px di sisi kiri; atau
- border `--color-brand-500` 1 px.

**Jangan** memakai halo biru, gradient, atau kartu yang “terbang”.

---

# 7. Field — spesifikasi semua tipe

## 7.1 Aturan umum field

```text
Label
[ input ]
Bantuan singkat / contoh
Pesan error bila ada
```

- Tinggi minimum: 48 px.
- Target sentuh: minimal 44 px.
- Label terpisah dari placeholder.
- Fokus: border brand + focus ring tipis.
- Jangan mengandalkan warna untuk menunjukkan fokus/error.
- Field wajib ditandai dengan `*` yang konsisten.

## 7.2 Angka

Contoh:

`Undangan baru hari ini *`

`[ 3 ] orang`

Gunakan alignment angka yang rapi. Hindari input pendek yang sulit disentuh.

## 7.3 Rupiah

Contoh:

`Nominal pengajuan *`

`Rp 300.000`

Tampilkan prefix `Rp` secara visual tetapi simpan nilai numerik bersih di schema.

## 7.4 Teks satu baris

Contoh:

`Nama konsumen`

`[ Nama lengkap konsumen ]`

## 7.5 Teks panjang

Contoh untuk laporan keamanan:

`Kejadian hari ini`

`[ 3–6 baris awal ]`

Textarea tumbuh sampai batas wajar. Jangan membuat kotak sangat pendek yang memaksa scroll internal.

## 7.6 Pilihan

Gunakan select native/styled select hanya ketika pilihan banyak. Untuk 2–4 pilihan yang jelas, gunakan **segmented choice** atau radio list.

Contoh:

`Status laporan`

`[ Aman ] [ Perlu dikawal ] [ Urgent ]`

Status harus tetap memakai warna semantik, tetapi **warna hanya menjadi penguat**, bukan satu-satunya pembeda.

## 7.7 Ya/Tidak

Gunakan pilihan dua opsi yang eksplisit:

`Sudah ditindaklanjuti?`

`[ Ya ] [ Belum ]`

Jangan gunakan switch jika konsekuensi aksinya belum jelas. Switch lebih cocok untuk setting on/off, bukan jawaban laporan.

## 7.8 Tabel berulang

Pada 360 px jangan gunakan tabel desktop yang dipaksa mengecil.

Ubah menjadi kumpulan item berulang:

```text
Konsumen 1
Nama           [ ... ]
Lokasi         [ ... ]
Status         [ ... ]
```

Jika jumlah item besar, tampilkan satu item per card ringan.

## 7.9 Unggah lampiran

Tombol utama:

`Pilih foto` / `Pilih video`

Setelah terpilih:

```text
✓ Foto bukti tersedia
nama-file.jpg
[ Ganti ]
```

Jangan mengandalkan “Choose File” bawaan browser karena terlalu teknis untuk pengguna non-teknis.

---

# 8. Panel terisi otomatis

Ini harus jelas berbeda dari input manual.

## Pola

```text
Terisi otomatis
Data diambil dari laporan hari ini

Nama: Dadang
Lokasi: Tajur
Jumlah undangan: 8

[ Tidak dapat diubah ]
```

### Visual

- Background: `--color-brand-50`
- Border: `--color-brand-100`
- Ikon kecil + teks `Terisi otomatis`
- Field tampil seperti data, **bukan seperti disabled input**.

### Alasan

Disabled input biasanya terlihat “rusak” atau seperti error. Pengguna perlu paham bahwa field memang **benar, berasal dari sistem, dan bukan tugas yang harus diisi**.

---

# 9. Panel PTE — enam kewajiban harian

Enam kewajiban:

1. Live streaming
2. Undangan konsumen baru
3. Kesaksian/testimoni konsumen
4. Google Review lokasi proyek
5. Minimal 3 konten media sosial
6. Video mentahan/progres kegiatan

Semua wajib lengkap dan memiliki bukti.

## 9.1 Jangan buat 6 kartu besar penuh warna

Pakai satu daftar kompak:

```text
PTE hari ini                           4 dari 6 selesai
──────────────────────────────────────────────────
✓  Live streaming                      Bukti ada
✓  Undangan konsumen baru              Bukti ada
✓  Testimoni konsumen                  Bukti ada
✓  Google Review                       Bukti ada
!  3 konten media sosial               Bukti belum ada
!  Video mentahan                      Bukti belum ada
```

## 9.2 Penanda status

- Selesai: ikon centang kecil + teks `Selesai`
- Belum: ikon garis/lingkaran sederhana + teks `Belum lengkap`
- Jangan mewarnai seluruh baris.

Status semantik dapat memakai warna di **ikon, label, atau garis kiri 3 px**.

## 9.3 Contoh pada layar aktual

Untuk form yang menunjukkan:

> `PTE hari ini — wajib tanpa alasan`
>
> Live: belum
> Undangan: belum
> Testimoni: belum
> G-Review: belum
> 3 konten: belum
> Video mentahan: belum

Jangan tampilkan enam simbol merah besar. Gunakan satu ringkasan utama:

> **PTE belum lengkap**
>
> 0 dari 6 kewajiban selesai.
>
> Masih perlu: Live, Undangan, Testimoni, Google Review, 3 konten, Video mentahan.

Lalu enam baris detail.

### Kenapa?

Satu keputusan visual cukup untuk memberi alarm. Enam alarm sekaligus membuat mata lelah dan menghilangkan prioritas.

---

# 10. Beranda

## 10.1 Tujuan

Layar pertama harus menjawab:

> **“Apa yang harus saya kerjakan sekarang?”**

## 10.2 Urutan konten

### 1. Sapaan singkat

Contoh:

> **Selamat pagi, Elsa.**
> Hari ini ada 1 laporan yang perlu diselesaikan.

Hindari sapaan marketing seperti “Semangat pagi!” sebagai elemen utama jika itu tidak memberi informasi.

### 2. Tugas hari ini

```text
Hari ini

● Absen                              Selesai
  06.00–09.00

● Laporan marketing                   Belum diisi
  Batas hari ini

● Laporan restoran                    —
  Tidak ada tugas
```

Pisahkan **“Belum diisi”** dari **“Tidak ada tugas”**.

### 3. Status absen

Tampilkan ringkas:

> **Absen masuk**
> 06.03 · Dalam radius kantor
>
> **Pulang**
> Belum dilakukan

Jangan memaksa pengguna masuk ke halaman absen hanya untuk melihat status.

### 4. CEO/admin

Untuk Ibu Putri/Ibu Sabrina, setelah tugas pribadi tampilkan area operasional:

> **Papan kontrol hari ini**
> 12 dari 16 laporan sudah masuk.

Baris kecil, bukan grid dashboard warna-warni.

---

# 11. Absen

## Tujuan

Absen harus terasa seperti **satu pekerjaan**, bukan mini-form.

## Urutan

1. Kamera
2. Lokasi GPS
3. Verifikasi radius
4. Foto
5. Kirim
6. Hasil

## Layout

```text
Absen masuk

Kamera terhubung
[ preview foto ]

Lokasi Anda
Jl. ...
120 m dari titik kantor
✓ Dalam radius

[ Ambil foto absen ]
```

Setelah foto siap:

```text
Foto siap
✓ Wajah terlihat
✓ Lokasi sesuai
✓ Waktu tercatat

[ Kirim absen ]
```

### Status radius

Jangan hanya berkata:

> `GPS aktif`

Gunakan:

> **Dalam radius**
> 120 m dari titik lokasi.

atau:

> **Di luar radius**
> Anda 580 m dari titik lokasi. Pindah lebih dekat untuk melanjutkan.

### Prinsip

Status GPS harus menjelaskan **apa artinya bagi tindakan pengguna**, bukan kondisi teknis perangkat.

---

# 12. Papan Kontrol

Untuk pusat pelaporan / admin.

## Ringkasan atas

```text
Laporan hari ini

12 dari 16 sudah masuk
██████████████░░░░
4 laporan masih ditunggu
```

Gunakan progress bar tipis. Jangan gunakan donut chart.

## Kartu laporan

Kartu minimal:

```text
Dadang
Humas · Tajur

Masuk 06.17
✓ Lengkap

[ Buka laporan ]
```

Jika kosong:

```text
Elsa
Restoran

Belum ada laporan hari ini
Terakhir masuk: kemarin, 17.03

[ Kirim pengingat ]
```

### Warna

- Default: netral.
- Aman: garis kiri + label kecil.
- Perlu dikawal: garis kiri + label kecil.
- Urgent: garis kiri + label kecil.

**Jangan** menjadikan seluruh kartu hijau/kuning/merah.

---

# 13. Antrean keputusan CEO

Setiap item harus memberikan **alasan untuk memutuskan**, bukan sekadar angka.

## Struktur

```text
Permintaan dana

Rp 3.500.000
Tenggat: hari ini, 15.00

Dampak
Pengecoran tidak dapat dimulai tanpa dana ini.

Diajukan oleh
Dadang · Tajur

[ Setujui ]   [ Tunda ]
[ Cicil ]     [ Tolak ]
```

### Urutan informasi

1. Nominal
2. Tenggat
3. Dampak
4. Pengaju
5. Tindakan

### Alasan

CEO mengambil keputusan dalam waktu singkat. Nominal saja tidak cukup untuk menentukan prioritas.

---

# 14. Kartu ringkasan angka

Digunakan untuk angka yang memang perlu dibaca cepat:

- 12 dari 16 laporan
- 0 dari 2 closing
- 4 dari 6 PTE
- 3 undangan besok

## Aturan

Satu kartu = **satu pertanyaan**.

Contoh yang baik:

> **Laporan masuk**
> **12 dari 16**
> 4 masih ditunggu

Contoh yang buruk:

> **12 / 16 / 4 / 0 / 100** dalam satu kartu.

Jangan memakai skor 0–100 sebagai penilaian karyawan. Itu tidak memiliki dasar pada aturan perusahaan menurut brief.

---

# 15. Nav bawah 5 tombol

Lima item:

1. Beranda
2. Laporan
3. **Absen** — tengah dan menonjol
4. Riwayat
5. Menu

## Posisi tombol Absen

Buat tombol tengah menonjol **melalui bentuk dan posisi**, bukan melalui warna neon.

Contoh visual:

```text
┌─────────────────────────────────┐
│  Beranda  Laporan   Absen  Riwayat  Menu │
│                     ●              │
└─────────────────────────────────┘
```

Tombol tengah dapat berada sedikit di atas baseline nav, dengan radius penuh karena ini satu-satunya bentuk bulat yang memiliki alasan fungsional jelas: **menjadi target sentuh utama**.

### Aturan

- Area nav: minimal 48 px per target sentuh.
- Tinggi nav total sekitar 72 px.
- Label teks selalu ada.
- Tombol tengah: diameter sekitar 52–56 px.
- Gunakan shadow sangat tipis bila diperlukan untuk memisahkan tombol dari nav.

### Kenapa satu bulatan boleh?

Karena ia menjadi **tanda tangan navigasi**, bukan bahasa visual seluruh aplikasi. Bila semua status dan kartu juga bulat, makna bentuknya hilang.

---

# 16. Keadaan kosong

Keadaan kosong harus menjawab: **“Apakah ini memang kosong, atau sistem bermasalah?”**

Contoh Riwayat:

```text
Belum ada laporan tersimpan

Laporan yang Anda kirim akan muncul di sini.

[ Buat laporan hari ini ]
```

Contoh Papan Kontrol:

```text
Belum ada laporan masuk

Belum ada anggota tim yang mengirim laporan hari ini.
```

Jangan gunakan ilustrasi besar atau ikon abu-abu raksasa sebagai pengganti penjelasan.

---

# 17. Pesan error

## Formula

**Apa yang salah → apa yang harus dilakukan.**

Contoh:

Buruk:

> `Validation failed.`

Baik:

> **Foto belum dipilih.**
> Ambil atau pilih foto absen terlebih dahulu.

Buruk:

> `Invalid GPS radius.`

Baik:

> **Lokasi belum sesuai.**
> Anda masih di luar radius yang diizinkan.

Buruk:

> `Required field.`

Baik:

> **Nama konsumen belum diisi.**

## Penempatan

Error ditempatkan **sedekat mungkin dengan field sumbernya**, lalu tambahkan ringkasan di bagian atas hanya bila banyak error.

---

# 18. Pola status 🟢 🟡 🔴 tanpa membuat layar penuh warna

## 18.1 Status semantic

| Status | Makna | Cara visual |
|---|---|---|
| Aman | Tidak perlu tindakan khusus | Ikon kecil + teks + garis kiri |
| Perlu dikawal | Ada hal yang perlu diperhatikan | Ikon kecil + teks + garis kiri |
| Urgent | Perlu ditangani segera | Ikon kecil + teks + garis kiri; boleh sedikit lebih kontras |

### Warna status

Gunakan warna yang disediakan token semantic hanya di:

- ikon status,
- label status,
- border kiri 3 px,
- background sangat tipis pada pesan yang benar-benar perlu disorot.

**Jangan** menggunakan status sebagai fill seluruh kartu.

## 18.2 Status kelengkapan berbeda dari status bisnis

Jangan campurkan:

- `Lengkap / Belum lengkap` = keadaan data/form.
- `Aman / Perlu dikawal / Urgent` = kondisi bisnis.

Contoh:

> **Laporan lengkap** · **Perlu dikawal**

Keduanya dapat muncul bersamaan karena menjawab dua pertanyaan berbeda.

---

# 19. Aturan penulisan (Bahasa Indonesia)

## 19.1 Nada

Gunakan Bahasa Indonesia yang:

- langsung,
- sopan,
- pendek,
- tidak teknis,
- tidak menggurui.

### Gunakan

- “Belum diisi”
- “Belum lengkap”
- “Pilih foto”
- “Kirim laporan”
- “Dalam radius”
- “Di luar radius”
- “Masih perlu 2 lagi”

### Hindari

- “Submit”
- “Upload”
- “Validation”
- “Sync”
- “Payload”
- “Field”
- “Database”
- nama tabel/kolom internal

## 19.2 Label

Gunakan bentuk benda/tindakan yang alami:

> `Jumlah undangan hari ini`
>
> `Nama konsumen`
>
> `Bukti Google Review`

Bukan:

> `INPUT UNDANGAN KONSUMEN`

## 19.3 Bantuan

Satu kalimat maksimal jika tidak dibutuhkan lebih.

Contoh:

> `Masukkan jumlah orang baru yang Anda undang hari ini.`

## 19.4 Konfirmasi

Contoh:

> **Laporan tersimpan.**
> Data hari ini sudah tercatat.

Untuk tindakan tidak dapat dibatalkan:

> **Kirim laporan sekarang?**
> Setelah dikirim, data akan tercatat sebagai laporan hari ini.
>
> `[ Kirim laporan ]` `[ Kembali ]`

---

# 20. Contoh nyata dari layar aplikasi

## 20.1 Beranda — kasus Diki/IT

Masalah layar saat ini: sapaan besar dan panel marketing tampil lebih kuat daripada pertanyaan “apa yang harus dilakukan”.

Pola yang disarankan:

```text
Selamat siang, Diki

Yang perlu diselesaikan hari ini

✓ Absen masuk
  12.04 · Dalam radius

! Laporan marketing pribadi
  Belum diisi
  6 kegiatan PTE + bukti

Target bulan ini

Closing            0 dari 2
Undangan           0 dari 20

[ Isi laporan marketing ]
```

Tujuan: tombol tindakan muncul setelah konteks, bukan setelah dekorasi.

## 20.2 Form target closing

Saat ini layar menunjukkan `0 / 2`, lalu field konsumen 1 dan 2 tanpa konsekuensi yang cukup jelas.

Pola baru:

```text
Target closing pribadi

0 dari 2 konsumen
Belum memenuhi target bulanan.

Closing bulan ini *
[ 0 ]

Konsumen 1
[ Nama konsumen ]
[ Lokasi proyek / blok ]
[ Status ]

Konsumen 2
[ Nama konsumen ]
[ Lokasi proyek / blok ]
[ Status ]
```

## 20.3 Panel PTE

Saat ini enam item muncul sebagai enam kotak dengan simbol merah. Itu membuat layar terasa seperti alarm.

Pola baru:

```text
PTE hari ini

0 dari 6 kewajiban selesai
Masih ada 6 kegiatan yang perlu dilengkapi.

○ Live streaming                 Belum lengkap
○ Undangan konsumen baru         Belum lengkap
○ Testimoni konsumen             Belum lengkap
○ Google Review                  Belum lengkap
○ 3 konten media sosial          Belum lengkap
○ Video mentahan                 Belum lengkap
```

## 20.4 Bukti PTE

Satu item dapat dibuka menjadi:

```text
Google Review

Jumlah: 2 review

Bukti
[ Pilih screenshot ]
atau
[ Tempel tautan Google Maps ]

✓ Bukti tersedia
```

Pengguna tidak perlu melihat semua uploader sekaligus.

## 20.5 Absen

Dari screenshot terlihat kamera, GPS, watermark dan foto masuk/pulang. Hierarki sebaiknya:

```text
Absen masuk

1. Lokasi
✓ Dalam radius
120 m dari Kantor Pusat

2. Foto
[ preview kamera ]

Wajah harus terlihat jelas.

[ Ambil foto absen ]
```

Setelah foto berhasil:

```text
✓ Foto tersimpan
✓ Lokasi sesuai
✓ Waktu 06.04 WIB

[ Kirim absen ]
```

---

# 21. Progress dan “rasa kemajuan”

Setiap pekerjaan berulang perlu satu indikator “tinggal berapa lagi”.

Gunakan formula:

> **sudah / target + kalimat manusia**

Contoh:

- `12 dari 16 laporan sudah masuk — 4 masih ditunggu.`
- `0 dari 2 closing — masih perlu 2 konsumen.`
- `4 dari 6 PTE selesai — tinggal 2 bukti.`
- `3 undangan besok — sesuai rencana.`

Hindari hanya:

- `12/16`
- `0/2`
- `66%`

Persentase boleh menjadi informasi sekunder, bukan bahasa utama.

---

# 22. Responsive behavior 360 px

## 22.1 Aturan keras

Pada 360 px:

- tidak boleh ada horizontal scroll,
- tombol utama tidak boleh terpotong,
- label field tidak boleh bertabrakan dengan ikon,
- angka penting tidak boleh membungkus secara aneh,
- tombol aksi tetap mudah disentuh satu tangan,
- nav tidak boleh mempunyai target yang terlalu rapat.

## 22.2 Field panjang

Label panjang boleh 2 baris.

Contoh:

> `3. Video mentahan / progres kegiatan lapangan`

Lebih baik label 2 baris daripada memperkecil font.

## 22.3 Button

Gunakan tinggi 48 px pada tombol utama.

Untuk tombol sekunder berdampingan di 360 px, pastikan setiap tombol tetap minimal 44 px tinggi dan memiliki padding horizontal cukup. Bila tidak cukup lebar, **susun vertikal**, jangan mengecilkan teks.

---

# 23. Aturan ikon SVG inline

Karena tidak boleh ada pustaka ikon:

- gunakan SVG inline,
- bentuk sederhana,
- stroke konsisten,
- hindari ikon dekoratif yang tidak menambah arti.

Ikon hanya membantu label, bukan menggantikan label.

Contoh:

```text
[ikon kamera] Absen
```

bukan:

```text
[ikon kamera saja]
```

### Gaya ikon

- ukuran umum 20–22 px,
- tombol nav 22–24 px,
- stroke 1.8–2 px,
- bentuk sedikit geometris, tidak kartun.

---

# 24. Bayangan, border, dan depth

Gunakan **border sebagai pemisah utama** dan shadow hanya untuk hubungan layer.

### Gunakan shadow pada:

- bottom navigation,
- tombol Absen tengah jika perlu terlihat melayang di atas nav,
- modal/dialog.

### Jangan gunakan shadow pada:

- setiap field,
- setiap kartu bagian,
- setiap badge,
- setiap panel.

### Kenapa?

Jika semua elemen tampak melayang, tidak ada yang terasa benar-benar penting.

---

# 25. Sistem komponen untuk renderer schema TypeScript

Semua form harus dirender dari satu schema generik. Karena itu desain tidak boleh bergantung pada nama form tertentu.

Contoh konsep schema:

```ts
type FieldType =
  | "number"
  | "currency"
  | "text"
  | "textarea"
  | "choice"
  | "boolean"
  | "repeatable"
  | "attachment"
  | "status";

interface FieldSchema {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  readOnly?: boolean;
  source?: "manual" | "automatic";
  statusMeaning?: "safe" | "watch" | "urgent";
}
```

Renderer harus memilih **varian komponen**, bukan membuat CSS baru per form.

Contoh:

```text
Schema
  ↓
FormSection
  ↓
FieldRenderer
  ├─ NumberField
  ├─ CurrencyField
  ├─ TextField
  ├─ TextareaField
  ├─ ChoiceField
  ├─ BooleanField
  ├─ RepeatableField
  ├─ AttachmentField
  └─ StatusField
```

Semua varian memakai token yang sama.

### Prinsip agent AI

Jika ditemukan kasus baru yang tidak tertulis di dokumen, agent harus memilih komponen berdasarkan **makna interaksi**, bukan membuat style baru:

> “Apakah user memasukkan nilai?” → field standar.
>
> “Apakah user hanya membaca hasil sistem?” → panel otomatis.
>
> “Apakah data harus terlihat sebagai satu dari beberapa pilihan?” → choice.
>
> “Apakah status ini memiliki makna bisnis tetap?” → semantic status.

---

# 26. Aturan prioritas visual

Gunakan urutan berikut dalam satu layar:

### P1 — Tugas yang harus dilakukan sekarang

Tombol, laporan yang belum selesai, bukti yang kurang.

### P2 — Konteks

Judul halaman, section, siapa/apa yang sedang dikerjakan.

### P3 — Hasil

Progress, angka, status.

### P4 — Penjelasan

Bantuan, kebijakan, detail tambahan.

### P5 — Dekorasi

Hampir tidak perlu.

Jika sebuah elemen tidak membantu P1–P4, pertanyakan apakah elemen itu perlu ada.

---

# 27. Apa yang secara eksplisit dilarang

- Gradient.
- Shadow tebal.
- Animasi berlebihan.
- HURUF BESAR SEMUA untuk label.
- Font mono untuk UI umum.
- Latar abu-kehijauan redup.
- Skor otomatis 0–100 sebagai penilaian karyawan.
- Istilah teknis kepada pengguna.
- Kartu warna-warni yang semuanya ingin menonjol.
- Ikon tanpa label teks pada fungsi non-universal.
- Menyembunyikan informasi penting hanya karena ingin tampilan bersih.
- Menggunakan hijau/kuning/merah sebagai warna dasar antarmuka.
- Membuat semua elemen berbentuk kapsul/pill.
- Membuat setiap section seperti kartu dashboard yang terpisah jauh.
- Menyelesaikan masalah kepadatan dengan mengecilkan font.

---

# 28. Definition of Done — mobile

Sebelum sebuah layar dianggap selesai, verifikasi di **360 px**:

### Layout

- [ ] Tidak ada horizontal scroll.
- [ ] Padding kiri/kanan konsisten.
- [ ] Judul halaman terbaca dalam maksimal 2–3 baris.
- [ ] Section tidak terlihat sebagai 9 kartu yang semuanya sama penting.

### Interaksi

- [ ] Semua target sentuh minimal 44 px.
- [ ] Target nav minimal 48 px.
- [ ] Tombol aksi utama dapat ditemukan tanpa mencari.
- [ ] Fokus keyboard terlihat.
- [ ] Error bisa ditemukan tanpa menebak field mana yang salah.

### Keterbacaan

- [ ] Isian tidak lebih kecil dari 16 px.
- [ ] Teks bantuan masih terbaca di layar murah.
- [ ] Kontras teks cukup untuk kondisi luar ruangan.
- [ ] Status dapat dipahami tanpa melihat warna saja.

### Hirarki

- [ ] Dalam 2–3 detik pengguna tahu apa yang harus dilakukan.
- [ ] Progress/kelengkapan terlihat tanpa membuka semua detail.
- [ ] Konsekuensi angka dijelaskan dekat angka.
- [ ] Informasi otomatis dapat dibedakan dari input manual.

### Status

- [ ] Hijau/kuning/merah hanya muncul pada status yang bermakna.
- [ ] Tidak ada kartu penuh warna status tanpa alasan kuat.
- [ ] `Lengkap/Belum lengkap` tidak tercampur dengan `Aman/Perlu dikawal/Urgent`.

### Copy

- [ ] Tidak ada istilah Inggris teknis.
- [ ] Tidak ada “Submit”, “Upload”, “Validation failed”, dan istilah sejenis.
- [ ] Pesan error menjelaskan masalah dan tindakan.
- [ ] Keadaan kosong menjelaskan apakah memang tidak ada data.

---

# 29. Snapshot untuk agent AI

> **Bangun aplikasi yang terasa seperti alat kerja manusia, bukan dashboard AI.**
>
> Gunakan putih + biru sebagai lingkungan netral. Simpan hijau, kuning, dan merah untuk status bisnis. Gunakan gold sangat hemat. Gunakan hierarchy melalui **teks + ruang + garis**, bukan melalui banyak badge/lingkaran/kartu berwarna.
>
> Setiap pekerjaan harus punya jawaban langsung untuk: **apa yang harus dilakukan, berapa yang sudah selesai, berapa yang masih kurang, dan apa akibatnya.**
>
> Form 9 bagian tidak boleh terasa seperti 9 kartu setara. Tampilkan **peta kemajuan** di atas, lalu detail. Jangan mengecilkan font untuk memuat lebih banyak.
>
> Komponen harus generik karena form berasal dari schema TypeScript. Bila ada kasus baru, gunakan komponen berdasarkan makna interaksi, jangan membuat style khusus per form.
>
> **Satu warna mencolok = satu pesan penting.**
>
> **Satu bentuk menonjol = satu fungsi penting.**
>
> Untuk mobile 360px, selalu pilih keterbacaan dan ketepatan tindakan daripada kepadatan informasi.

---

# 30. Ringkasan keputusan penting dan alasannya

| Keputusan | Alasan |
|---|---|
| Netral putih + biru sebagai dasar | Menjaga UI tenang dan membuat status tetap mencolok |
| Status bukan fill seluruh kartu | Menghindari layar terasa seperti alarm |
| Progress berupa angka + kalimat | Mengurangi kebutuhan interpretasi pengguna |
| Form diawali ringkasan kemajuan | Mengatasi rasa “form tak berujung” |
| Section dapat diringkas | Pengguna melihat peta tanpa kehilangan detail ketika bekerja |
| Field minimal 48 px | Aman untuk sentuh sambil berdiri/bergerak |
| Input 16 px | Keterbacaan dan menghindari zoom yang tidak diinginkan |
| Border sebagai pemisah utama | Soft tanpa terlihat seperti kumpulan kartu melayang |
| Shadow hanya untuk layer | Menjaga hierarki depth tetap bermakna |
| Ikon + teks | Banyak pengguna tidak mengenali ikon sendirian |
| Bahasa Indonesia sederhana | Menyesuaikan pengguna dengan kemampuan teknologi rendah–sedang |
| Panel otomatis berbeda secara visual | Mencegah pengguna mencoba mengedit data yang memang bukan tugasnya |
| Tidak ada skor 0–100 | Tidak ada dasar aturan perusahaan untuk menilai karyawan dengan skor tersebut |
| Tombol Absen tengah menonjol | Absen adalah tindakan frekuensi tinggi yang harus ditemukan cepat |
| Gold sangat hemat | Dekat dengan makna kuning/status; mudah mengaburkan semantik |

---

## Appendix — contoh microcopy siap pakai

### Beranda

- `Selamat pagi, Kasam.`
- `Ada 1 tugas yang belum selesai.`
- `Semua laporan hari ini sudah dikirim.`

### Absen

- `Dalam radius`
- `Di luar radius`
- `Wajah belum terlihat jelas.`
- `Foto absen sudah siap.`
- `Absen berhasil dicatat.`

### Laporan

- `Belum diisi`
- `Belum lengkap`
- `Sudah dikirim hari ini`
- `Laporan tersimpan.`
- `Periksa 2 bagian yang masih kurang.`

### PTE

- `4 dari 6 selesai`
- `Masih perlu 2 bukti.`
- `Bukti tersedia`
- `Bukti belum ada`

### Papan kontrol

- `12 dari 16 laporan sudah masuk.`
- `4 laporan masih ditunggu.`
- `Belum ada laporan hari ini.`

### Keputusan CEO

- `Menunggu keputusan`
- `Tenggat hari ini`
- `Dampak bila ditunda`
- `Setujui`
- `Cicil`
- `Tunda`
- `Tolak`

---

# 31. Koreksi 30 Agustus 2026 (sebelum penerapan dimulai)

Empat koreksi eksplisit dari CEO atas draf di atas, diterapkan mulai dari Beranda + form `personal_marketing` (`components/FormRenderer.tsx`, `app/page.tsx`). Berlaku untuk SELURUH dokumen ini, bukan cuma bagian yang disebut namanya.

**1. Bagian tertutup WAJIB terbuka saat ada galat.** §5.3 ("Section tidak aktif boleh diringkas") TIDAK berlaku kalau bagian itu punya galat validasi. Pengguna tidak boleh kehilangan galatnya di balik bagian yang tertutup -- kalau ada field bermasalah di dalamnya, bagian itu terbuka paksa, terlepas dari status togel manualnya. Diimplementasikan sebagai union: `terbuka = bermasalah || togelManual`.

**2. Absen BUKAN bagian form.** Contoh §10.2 yang mencampur "● Absen ... Selesai" ke dalam daftar bertitik bersama laporan-laporan lain SALAH DIIKUTI -- itu justru yang dikoreksi. Absen tidak pernah lewat mekanisme `assignment`/`form_key`, presensinya sistem yang sama sekali berbeda (lihat `app/absen/page.tsx`). Di Beranda, Absen SELALU section terpisah sendiri (§10.2.3 "Status absen"), tidak pernah masuk hitungan/daftar "Yang perlu dikerjakan hari ini" (§10.2.2, forms saja).

**3. Tidak ada emas di palet UI.** §2.2 mendefinisikan `--color-gold-*` dan bilang "Gold sangat hemat" -- ternyata bahkan "hemat" pun tidak boleh. Emas/kuning logo HANYA dipakai untuk merender logo itu sendiri (`public/logo-koperumnas.jpg`, dua bintang), TIDAK PERNAH sebagai warna UI (bukan aksen, bukan status, bukan dekorasi apa pun). Implementasi live (`app/tokens.css`) tidak punya token gold sama sekali -- token biru (`--biru`/`--biru-2`/`--biru-3`) memakai nilai ASLI hasil sampling logo (§2.1: `#0047AF`/`#1C74CD`/`#3FAAF2`), bukan nama token `--color-brand-*` dari draf ini.

**4. Pola "keadaan gagal" (baru, tidak ada di draf awal).** §16 cuma membahas "keadaan kosong" (memang tidak ada data). Kalau QUERY-nya sendiri GAGAL (jaringan/server), itu HARUS terlihat beda dari kosong -- keduanya kalau disamakan, pengguna tidak pernah tahu bedanya "memang belum ada tugas" vs "sistemnya lagi bermasalah". Komponen: `components/KeadaanGagal.tsx` -- pesan warna `--merah`, tombol "Coba lagi" eksplisit yang memanggil ulang query yang gagal (`refetch()`). Dipakai pertama kali di `DaftarTugas`/`StatusAbsenHariIni` (`app/page.tsx`).
