# RENCANA PROYEK BARU — Indosteak · Indokopi · Thrifting

> Perubahan arah dari CEO, 2 September 2026.
> Fokus berpindah dari Koperumnas (perumahan) ke tiga unit usaha: dua merek F&B
> dan thrifting.

---

## §1 · Apa yang berubah

| | Sebelumnya | Sekarang |
|---|---|---|
| Fokus | Koperumnas — perumahan, lokasi, DTI, perizinan | Indosteak, Indokopi, Thrifting |
| Jumlah orang | 40 | Sekitar 15 (perlu dipastikan) |
| Bentuk sistem | Pelaporan harian | Pelaporan **+ kasir (POS)** |
| Sistem lain | — | Sudah ada POS F&B di repo terpisah |

Yang tidak berubah: presensi ber-radius, kewajiban PTE, dan cara laporan harian bekerja.

---

## §2 · REVISI 3 September — arah dibalik

> Versi pertama dokumen ini menyarankan menyalin repo laporan lalu membangun kasir
> thrifting di dalamnya. **Itu keliru.** Saat itu isi `pos-fnb` belum terbaca.
> Setelah diperiksa, ternyata sistem itu sudah produksi di Indokopi.

### Dua sistem, masing-masing mengerjakan yang dikuasainya

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  pos-fnb                 │        │  sistem laporan          │
│  (sudah produksi)        │        │  (sudah jadi)            │
│                          │        │                          │
│  • kasir F&B             │        │  • presensi ber-radius   │
│  • kasir thrifting  BARU │        │  • PTE & marketing       │
│  • struk & label    BARU │        │  • cuti                  │
│  • shift & kas           │        │  • laporan harian        │
│  • laporan penjualan     │        │  • Admin & kebijakan     │
│  • stok                  │        │  • ekspor Excel          │
└───────────┬──────────────┘        └────────▲─────────────────┘
            │                                │
            └──── rekap omzet harian ────────┘
                  (satu arah, sekali sehari)
```

**Kasir thrifting dibangun di `pos-fnb`, bukan di repo laporan.** Di sana sudah ada layar kasir, pembayaran, cetak struk, siklus shift, refund, dan laporan penjualan — kasir thrifting memakai semuanya, hanya perlu jenis barang baru.

**Repo laporan tetap seperti sekarang**, dibersihkan dari form perumahan. Tidak perlu disalin ke repo baru sama sekali — cukup nonaktifkan yang tidak relevan.

**Penyambungannya satu arah dan longgar:** `pos-fnb` mengirim rekap omzet harian ke sistem laporan lewat API. Laporan Manager Resto tidak lagi diketik omzetnya — terisi dari mesin kasir. Itu prinsip "satu angka, satu pengisi", dan sekarang pengisinya mesin.

Jangan berbagi database. Pola aksesnya berbeda total — `pos-fnb` memakai Drizzle dengan koneksi Postgres langsung, sistem laporan memakai `supabase-js` dengan RLS. Dua pola di satu database akan menyulitkan keduanya.

### Yang berubah dari rencana lama

| Rencana lama | Sekarang |
|---|---|
| Salin repo ke `reportfnb` | **Tidak perlu.** Repo laporan tetap di tempatnya |
| Proyek Supabase baru | Tidak perlu |
| Kasir thrifting di repo laporan | Di `pos-fnb` |
| Buang 9 form | Tetap — tapi nonaktifkan dulu, jangan hapus |

Kalau folder `reportfnb` sudah terlanjur dibuat, hapus saja.

---

## §3 · Koreksi atas audit repo laporan

Empat hal yang salah di versi pertama dokumen ini:

1. **Ada 16 form, bukan 15.** Yang terlewat: `security`. Perlu ditanyakan ke CEO — toko thrifting dan resto juga butuh laporan keamanan. Kalau dipakai, scope-nya harus diubah dari lokasi ke outlet.
2. **Ekspor PDF tidak pernah ada.** Yang ada hanya Excel lewat ExcelJS. Jangan dianggap tinggal dibawa.
3. **`lib/api/dashboard.ts` dan `terpusat.ts` isinya campuran** — sebagian dibuang, sebagian inti sistem baru. Perlu dipisah per fungsi, bukan per file.
4. **Laporan Terpusat perlu ditulis ulang**, bukan disederhanakan. Lima dari enam fungsinya terikat form yang dibuang.

---

## §4 · POS itu jenis aplikasi yang berbeda — ini risiko terbesar

Aplikasi pelaporan dan aplikasi kasir punya tuntutan yang bertolak belakang. Ini perlu dipahami sebelum menulis kode apa pun.

| | Pelaporan | Kasir |
|---|---|---|
| Kecepatan | 2 detik tidak masalah | 2 detik per barang = antrean panjang |
| Offline | Boleh gagal, coba lagi nanti | **Transaksi TIDAK BOLEH hilang** |
| Kesalahan | Bisa diperbaiki besok | Uang sudah diterima, tidak bisa diulang |
| Frekuensi | 1× sehari | Ratusan kali sehari |

**Aturan mutlak untuk kasir: transaksi disimpan ke HP dulu, baru dikirim ke server.** Bukan sebaliknya. Kalau internet mati di tengah transaksi, uang sudah diterima dan strukku sudah dicetak — datanya tidak boleh hilang.

Ini berarti kasir memakai pola berbeda dari seluruh aplikasi yang sudah dibangun: tulis ke IndexedDB dulu, antrean kirim di belakang layar, tandai sudah tersinkron. Sistem pelaporan tidak butuh ini; kasir tidak bisa hidup tanpanya.

---

## §5 · Thrifting berbeda dari toko biasa

Ini yang paling sering salah dirancang, dan pengaruhnya ke seluruh skema.

**Di toko biasa**, stok berbasis jumlah: "Kaos Polos Hitam L — sisa 12". Sepuluh potong yang sama punya satu kode.

**Di thrifting, setiap barang unik.** Kemeja bekas merek A ukuran L kondisi bagus itu **satu barang, satu kode, jumlah selalu 1**. Terjual sekali, habis selamanya. Tidak ada dua yang persis sama.

Artinya:

```
barang (
  kode          text unique,      -- dicetak jadi label, satu per potong
  kategori_id,                    -- Pakaian, Sepatu, Tas, Topi, ...
  nama          text,
  merek         text,
  ukuran        text,
  warna         text,
  kondisi       text,             -- A / B / C, atau Sangat baik / Baik / Cukup
  harga_modal   bigint,
  harga_jual    bigint,
  status        enum,             -- baru_masuk / siap_jual / terjual / rusak
  masuk_pada    date,
  terjual_pada  date
)
```

Kategori dibuat sebagai tabel tersendiri supaya bisa ditambah dari Admin — CEO menyebut "pakaian, sepatu, tas, topi, dll", dan "dll" itu berarti akan bertambah.

**Alur kerja yang harus didukung:**
```
Barang masuk → foto → tentukan kategori, ukuran, kondisi → tetapkan harga →
cetak label berkode → pajang → pindai saat dijual → stok berkurang sendiri
```

Ini persis prinsip yang sudah tertulis di format Ita: *barang masuk → label → data → sistem → jual*.

---

## §6 · Cetak struk dan label — putuskan sejak awal

Ini bagian tersulit secara teknis di aplikasi web, dan menentukan bentuk seluruh kasirnya. Tiga pilihan:

| Cara | Kelebihan | Kekurangan |
|---|---|---|
| **Web Bluetooth ke printer termal** | Langsung dari HP, tanpa alat tambahan | Hanya Chrome Android. Tidak jalan di iPhone |
| **Aplikasi cetak pihak ketiga** (RawBT dll) | Paling sederhana, printer apa pun | Perlu pasang satu aplikasi lagi |
| **Struk digital** — QR atau WhatsApp | Tanpa printer sama sekali | Sebagian pembeli tetap minta kertas |

**Saran:** mulai dari struk digital plus opsi Web Bluetooth. Struk kertas jangan dijadikan syarat agar kasir bisa berjalan — kalau printernya bermasalah, jualan tidak boleh ikut berhenti.

Label harga butuh **barcode**. Cukup Code128, digambar sendiri dengan canvas atau SVG — tidak perlu pustaka. Ukuran label perlu dipastikan ke CEO (biasanya 33×15mm atau 50×25mm).

---

## §7 · Penyambungan dengan POS F&B yang sudah ada

Belum bisa saya nilai — repo-nya tidak bisa saya baca dari sini. Agent yang harus memeriksanya lebih dulu.

Yang perlu diketahui sebelum memutuskan cara menyambungkan:

1. Bahasa dan kerangka kerjanya apa
2. Databasenya apa, dan di mana
3. Apakah punya API, atau langsung ke database
4. Berapa banyak transaksi per hari sekarang
5. Siapa yang merawatnya

Tiga kemungkinan cara sambung:

| Cara | Kapan cocok |
|---|---|
| POS mengirim rekap harian ke sistem laporan lewat API | Paling aman, paling longgar. **Saran awal** |
| Dua sistem berbagi database Supabase yang sama | Kalau POS ternyata sudah memakai Supabase |
| POS ditulis ulang di dalam sistem baru | Hanya kalau POS lama memang bermasalah |

Yang paling penting: **laporan omzet harian Manager Resto seharusnya terisi otomatis dari POS**, bukan diketik ulang. Itu prinsip "satu angka, satu pengisi" yang sudah berlaku di seluruh sistem — dan sekarang angkanya datang dari mesin kasir, bukan dari orang.

---

## §8 · Yang harus ditanyakan ke CEO sebelum mulai

Sembilan pertanyaan. Empat pertama menghambat.

**🔴 Menghambat**

1. **Siapa saja yang masuk sistem baru ini?** Dari 40 orang, siapa yang pindah? Perkiraan saya sekitar 15 — pegawai Indosteak, Indokopi, thrifting, plus HRD dan Accounting. Perlu daftar pasti.
2. **Koperumnas lanjut atau berhenti?** Kalau lanjut, dua sistem berjalan bersamaan dan sebagian orang punya dua akun. Kalau berhenti, sistem lama dimatikan.
3. **POS F&B yang ada sekarang dipakai terus, atau diganti?**
4. **Thrifting sekarang jualannya bagaimana?** Sudah ada catatan, aplikasi lain, atau masih manual?

**🟡 Perlu, tapi bisa menyusul**

5. Berapa transaksi thrifting per hari? Menentukan seberapa cepat kasirnya harus.
6. Sudah punya printer termal? Merek apa?
7. Ukuran label harga berapa?
8. Kategori barang apa saja untuk awal?
9. Terima pembayaran apa saja — tunai, QRIS, transfer, kartu?

---

## §9 · Langkah pertama

Urut. Jangan lompat.

**1 · Salin repo** — §2 di atas. Repo GitHub baru, Supabase baru, Vercel baru.

**2 · Agent memeriksa POS lama.** Sebelum apa pun, dia perlu tahu apa yang sudah ada.

**3 · Bersihkan bagian Koperumnas.** Nonaktifkan form yang tidak relevan, jangan dihapus.

**4 · Sesuaikan daftar karyawan** setelah CEO menjawab pertanyaan 1.

**5 · Baru bangun kasir thrifting.** Ini yang paling besar, dan paling banyak hal barunya.

Yang **tidak** dikerjakan sekarang: penggabungan dengan POS F&B. Itu setelah kasir thrifting berjalan dan Anda paham betul kedua sistemnya.
