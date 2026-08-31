# DESIGN — LAPISAN MODERN

> Tambahan untuk `DESIGN.md`. Bukan pengganti — seluruh aturan yang sudah ada
> tetap berlaku. Bagian ini menjawab satu keluhan: tampilannya sudah rapi,
> tapi terasa datar dan kuno.

---

## §M1 · Diagnosis — kenapa terasa kuno

Dari screenshot aplikasi berjalan, penyebabnya bukan warna dan bukan huruf. Empat hal ini:

**Semuanya kotak bergaris tipis di atas putih.** Kotak kamera, kartu login, kartu absen, kartu bagian form — semua memakai `border 1px` di atas latar putih. Antarmuka modern hampir tidak memakai garis; pemisahan dibuat lewat **perbedaan warna permukaan**, bukan garis.

**Skala huruf terlalu rata.** Judul 17px, isi 16px, label 13px. Jarak antar tingkatan terlalu kecil, jadi mata tidak menemukan titik masuk. Antarmuka modern punya lompatan besar — judul 28px, isi 16px.

**Tidak ada gerakan sama sekali.** Setiap perubahan keadaan terjadi seketika. Tanpa transisi, antarmuka terasa seperti halaman statis tahun 2010, bukan aplikasi.

**Ruang kosong dipakai sebagai sisa, bukan sebagai alat.** Di layar Absen, kotak kamera kosong memakan setengah layar lalu sisanya kosong melompong. Ruang kosong harus disengaja dan berirama, bukan kebetulan.

---

## §M2 · Ganti garis dekoratif dengan permukaan

> ⚠️ **KOREKSI 31 Agustus 2026** — Versi sebelumnya bagian ini terbaca terlalu
> absolut ("kartu tidak memakai garis" mudah disalahartikan jadi "garis
> dilarang" secara umum). Yang dihapus adalah **garis dekoratif pada kartu
> utama** — bukan semua garis di aplikasi. Garis TETAP dipakai untuk: input,
> kotak unggah, tabel, pemisah di dalam daftar, dan elemen lain yang memang
> butuh batas agar terbaca. **Input tanpa garis tidak terlihat sebagai
> tempat mengetik — itu menurunkan kegunaan, bukan menaikkan.**

Prinsipnya: **PERBEDAAN PERMUKAAN LEBIH DIUTAMAKAN DARIPADA GARIS** — bukan
"garis dilarang". Untuk KARTU UTAMA (kartu status, kartu absen, kartu login,
kartu bagian form) pemisahan dari latar halaman dibuat lewat **beda warna
permukaan**, bukan garis dekoratif di sekelilingnya.

```css
:root{
  --halaman:        #F4F6F8;   /* latar halaman — sedikit abu, BUKAN putih */
  --permukaan:      #FFFFFF;   /* kartu — putih, jadi terangkat sendiri */
  --permukaan-2:    #F8FAFB;   /* kartu di dalam kartu */
  --garis:          #E8EDF1;   /* garis FUNGSIONAL -- lihat daftar di bawah, BUKAN cuma pemisah daftar */
}
```

Perubahan intinya: **halaman jadi abu muda, kartu jadi putih.** Sekarang terbalik — halaman putih, kartu putih, jadi butuh garis supaya terlihat. Setelah dibalik, kartu UTAMA terangkat tanpa garis dekoratif di sekelilingnya.

**Garis TETAP dipakai** (bukan dihapus, hanya bukan lagi pembatas kartu utama):
- input & field isian — tanpa garis, tempat mengetik tidak terlihat sebagai tempat mengetik
- kotak unggah bukti/foto
- tabel (garis antar baris/kolom)
- pemisah di dalam daftar (antar item riwayat, dst.)
- elemen lain yang memang butuh batas supaya terbaca (keputusan per kasus, bukan larangan blanket)

| Dulu | Sekarang |
|---|---|
| `background: #FBFBF9; border: 1px solid #E4E0D3` di KARTU UTAMA | `background: var(--permukaan)` di atas `--halaman`, tanpa garis dekoratif |
| Garis di setiap kartu utama | Tanpa garis dekoratif. Bayangan sangat tipis saja |
| Garis pemisah antar field DI DALAM kartu | **Tidak berubah** — input/field tetap pakai garis (lihat daftar di atas), cuma jarak antar field ditambah jadi 20px |

Bayangan dipakai **sangat hemat**, dan hanya untuk elemen yang benar-benar mengambang:

```css
--bayang-kartu:  0 1px 2px rgba(16,32,46,.04), 0 2px 8px rgba(16,32,46,.04);
--bayang-nav:    0 -2px 12px rgba(16,32,46,.06);
--bayang-lembar: 0 -4px 24px rgba(16,32,46,.12);   /* bottom sheet */
```

Yang **tidak** berubah: rail kiri 4px tetap jadi bahasa status utama. Rail di atas permukaan putih justru lebih terbaca daripada di atas kartu bergaris.

---

## §M3 · Skala huruf dengan lompatan nyata

> ⚠️ **KOREKSI 31 Agustus 2026** — Bagian ini tadinya cuma bicara soal
> UKURAN, tidak pernah menyebut keluarga huruf sama sekali — celah yang bisa
> disalahartikan seolah font boleh ikut diganti saat "modernisasi" tipografi.
>
> **FONT TETAP: PLUS JAKARTA SANS.** CLAUDE.md #10 mengunci ini, `app/tokens.css`
> sudah berjalan dengannya, dan `docs/DESIGN.md` §T (Bagian Tambahan) sudah
> membuang draf lain yang mencoba menggantinya ke Manrope. §M3 ini HANYA
> boleh mengubah: ukuran, ketebalan (`font-weight`), `line-height`, dan
> `letter-spacing` — TIDAK PERNAH `font-family`. Jangan ganti ke Manrope,
> Inter, Poppins, DM Sans, atau font lainnya — "terasa lebih modern" bukan
> alasan yang cukup untuk mengganti font brand yang sudah berjalan.

```css
--teks-hero:    2rem;      /* 32px  · angka besar di dashboard */
--teks-judul:   1.75rem;   /* 28px  · judul halaman */
--teks-bagian:  1.25rem;   /* 20px  · judul bagian */
--teks-isi:     1rem;      /* 16px  · isian & teks utama */
--teks-label:   0.875rem;  /* 14px  · label field */
--teks-kecil:   0.8125rem; /* 13px  · keterangan */
```

Tiga aturan:

**Judul halaman 28px, tebal 700, `letter-spacing: -0.02em`.** Huruf besar dengan jarak sedikit dirapatkan itu ciri antarmuka modern. Sekarang judulnya 24px tanpa penyesuaian jarak, jadi terasa seperti dokumen.

**Label field naik dari 13px ke 14px.** 13px terlalu kecil untuk pengguna usia 50-an di HP murah.

**Angka besar pakai `font-variant-numeric: tabular-nums`.** Angka jadi rata lebarnya, tidak bergoyang saat berubah dari 9 ke 10.

---

## §M4 · Gerakan — sedikit, tapi harus ada

Tanpa gerakan, antarmuka terasa mati. Dengan gerakan berlebihan, terasa murah. Batasnya jelas:

```css
--gerak-cepat:  120ms cubic-bezier(.2,.8,.3,1);   /* tekan tombol */
--gerak-normal: 200ms cubic-bezier(.2,.8,.3,1);   /* buka-tutup bagian */
--gerak-lembar: 280ms cubic-bezier(.32,.72,0,1);  /* bottom sheet naik */
```

Yang **boleh** bergerak:
- Tombol saat ditekan: `transform: scale(.97)` — memberi rasa tertekan
- Bagian form membuka: tinggi dan opasitas
- Bottom sheet naik dari bawah
- Kartu baru muncul di daftar: memudar masuk, tanpa geser
- Bilah kemajuan: lebarnya beranimasi

Yang **tidak boleh** bergerak: apa pun saat halaman pertama dimuat, ikon, dekorasi, angka yang menghitung naik.

```css
@media (prefers-reduced-motion: reduce){
  *{ animation-duration:.01ms !important; transition-duration:.01ms !important }
}
```

---

## §M5 · Kerangka muat, bukan pemutar

> ⚠️ **KOREKSI 31 Agustus 2026** — CSS di bawah memakai `linear-gradient` utk
> animasi kerangka muat, padahal aturan lama (`DESIGN.md` §23, dan §T.6)
> MELARANG gradient — pertentangan yang tidak sengaja dibuat sendiri.
>
> **Gradient HANYA boleh dipakai untuk animasi kerangka muat/skeleton
> loading** (persis pola `.kerangka`/`@keyframes geser` di bawah, dan tidak
> untuk yang lain). Larangan gradient dari aturan lama TETAP BERLAKU PENUH
> untuk: latar halaman, tombol, header, kartu, rail, dan dekorasi apa pun.
> Ini pengecualian sempit satu kasus, bukan pelonggaran aturan gradient
> secara umum.

Ganti seluruh "Memuat..." dan lingkaran berputar dengan **kerangka abu berbentuk isi yang akan datang**.

```html
<div class="kerangka" style="height:20px;width:60%"></div>
<div class="kerangka" style="height:14px;width:40%;margin-top:8px"></div>
```

```css
.kerangka{
  background: linear-gradient(90deg,#EEF1F4 25%,#F6F8F9 37%,#EEF1F4 63%);
  background-size: 400% 100%;
  border-radius: 6px;
  animation: geser 1.4s ease infinite;
}
@keyframes geser{ 0%{background-position:100% 0} 100%{background-position:-100% 0} }
```

Alasannya bukan estetika: kerangka membuat tata letak tidak melompat saat data datang, dan di sinyal lambat orang bisa melihat sesuatu sedang terjadi.

---

## §M6 · Pola mobile yang membuatnya terasa aplikasi

Empat pola. Semuanya dibangun sendiri, tanpa pustaka.

**Lembar bawah, bukan kotak dialog.** Detail presensi, konfirmasi keputusan CEO, pemilih lokasi — naik dari bawah, sudut atas membulat 20px, ada garis penarik kecil di atas, latar belakang meredup. Kotak dialog di tengah layar itu pola desktop.

**Bilah aksi menempel.** Tombol Kirim di form panjang menempel di bawah, tepat di atas nav, dengan latar putih dan bayangan tipis. Sudah ada — pastikan latarnya tidak transparan supaya teks di baliknya tidak tembus.

**Kendali tersegmen, bukan menu jatuh.** Untuk pilihan 2–4, ganti `<select>` dengan tombol bersebelahan. Contoh: saringan Tinjau Absensi (Semua / Belum absen / Terlambat / Di luar radius), dan pilihan status 🟢🟡🔴 yang sudah begitu.

**Umpan balik sentuh.** Setiap elemen yang bisa diketuk butuh keadaan `:active` yang terlihat. Di HP tidak ada hover, jadi tanpa ini orang tidak yakin ketukannya masuk.

---

## §M7 · Angka sebagai tokoh utama

Di layar CEO, angka adalah isinya — bukan pelengkap label.

```
Salah:                      Benar:
Sudah melapor: 12 / 16      12/16
                            Sudah melapor
```

Angka 32px tebal 700 di atas, label 14px abu di bawah. Terbalik dari cara menulis kalimat, tapi benar untuk memindai cepat.

Berlaku di: Beranda CEO, ringkasan Papan Kontrol, panel PTE, dashboard marketing, dan ringkasan kemajuan form.

**Tidak berlaku** di layar karyawan yang sedang mengisi form — di sana angka adalah isian, bukan informasi.

---

## §M8 · Kepadatan berbeda untuk peran berbeda

| | CEO & Pusat | Karyawan |
|---|---|---|
| Jarak antar kartu | 12px | 20px |
| Angka | 32px, tokoh utama | ukuran isi biasa |
| Warna status | terasa kuat, membantu memindai | hanya di tempat yang perlu |
| Tujuan | melihat kondisi dalam 3 detik | menyelesaikan tugas tanpa bingung |

Layar CEO boleh padat karena dia memindai. Layar karyawan harus lapang karena dia mengetik sambil berdiri.

---

## §M9 · Daftar periksa

Sebelum sebuah layar dianggap modern:

- [ ] Tidak ada `border` di kartu — pemisahan lewat warna permukaan
- [ ] Latar halaman abu muda, kartu putih. Bukan sebaliknya
- [ ] Judul halaman 28px tebal dengan `letter-spacing: -0.02em`
- [ ] Ada satu elemen yang jelas paling besar di layar
- [ ] Perubahan keadaan punya transisi, tidak melompat
- [ ] Memuat memakai kerangka, bukan lingkaran berputar
- [ ] Setiap elemen bisa diketuk punya keadaan `:active`
- [ ] Angka penting lebih besar dari labelnya
- [ ] Tidak ada `<select>` untuk pilihan di bawah lima
- [ ] Ruang kosong terasa disengaja, bukan sisa
