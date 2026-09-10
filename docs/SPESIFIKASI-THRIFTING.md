# SPESIFIKASI BARANG THRIFTING

> Disusun dari data nyata Bestie Thrift, 5 September 2026.
> **Direvisi 6 September** setelah jawaban CEO — lihat §0.
> Menggantikan §5 di `RENCANA-PROYEK-BARU.md`.

---

## §0 · Jawaban CEO yang mengubah rancangan

| Hal | Jawaban | Akibatnya |
|---|---|---|
| Kasir | **Terpisah**, meja sendiri | Thrifting jadi `business` tersendiri di `pos-fnb`. `order_items` **tidak** perlu polimorfik. Tidak menyentuh apa pun milik Indokopi |
| Bestie Thrift | **Diganti** | Perlu pemindahan data barang lama |
| "SS" | **Kode pemilik barang titipan** — Salma | Konsinyasi itu nyata. Lihat §7 |
| Bagi hasil | **60% pemilik, 40% toko** | Perlu pencatatan dan laporan per pemilik |
| Kondisi A/B/C | **Tidak dipakai** | Dibuang. Harga ditentukan dari harga beli + banding Google |
| Barang masuk | 50–150 potong, tiap 2 minggu–1 bulan | Bukan harian. Justru berkelompok besar sekali duduk |
| Umur barang | **Dipakai** | Untuk melihat mana yang perlu didiskon |

---

## §1 · Yang terbaca dari data nyata

| Temuan | Artinya |
|---|---|
| "Rubi black **Uk.39** SS" | Ukuran dijejalkan ke nama. Tidak bisa disaring, tidak bisa dianalisis |
| Merek hampir semua `N/D` | Memang tidak dipakai. Jangan jadikan wajib |
| `Unit` selalu sama dengan `Category` (Sepatu → Sepatu) | Kolom ini tidak menambah apa pun |
| `Quantity` 1.00 atau 0.00 | Model satuan sudah berjalan, tapi lewat angka — rapuh |
| **Kondisi tidak ada sama sekali** | Lubang terbesar. Di thrifting, kondisi menentukan harga |
| Tidak ada tanggal masuk | Tidak bisa tahu barang mana yang sudah lama menumpuk |
| Modal → jual sekitar 2× | Berguna untuk harga usulan otomatis |

---

## §2 · Field yang dipakai

### Wajib — tanpa ini barang tidak bisa dijual

| Field | Tipe | Catatan |
|---|---|---|
| `kode` | teks unik | Dicetak jadi barcode Code128. Dibuat otomatis, jangan diketik |
| `foto` | gambar | Setiap barang unik, jadi fotonya juga unik. Wajib |
| `kategori_id` | pilih | Sepatu, Tas, Pakaian, Topi, … bisa ditambah dari Admin |
| `nama` | teks | Deskripsi singkat SAJA. Ukuran jangan masuk sini lagi |
| `harga_modal` | rupiah | |
| `harga_jual` | rupiah | Diisi otomatis 2× modal, boleh diubah |

| `pemilik_id` | pilih | **Baru.** Kosong = milik toko sendiri. Lihat §7 |

### Penting — kosong boleh, tapi sangat berguna

| Field | Tipe | Kenapa |
|---|---|---|
| `ukuran` | teks | **Baru.** Sekarang ada di nama. Bentuknya beda per kategori — lihat §4 |
| `warna` | teks | Pembeli mencari warna. Sekarang juga ada di nama |
| `tanggal_masuk` | tanggal | **Baru.** Otomatis. Tanpa ini tidak tahu barang menumpuk berapa lama |
| `merek` | teks bebas | **Bukan dropdown.** Ketik langsung, boleh kosong |
| `catatan` | teks panjang | Cacat kecil, keterangan tambahan |

### Dibuang

| Field sekarang | Kenapa dibuang |
|---|---|
| **Brand** (dropdown) | Hampir semua `N/D`. Ganti teks bebas opsional |
| **Sub Category** | Tidak dipakai. Kategori saja cukup |
| **Unit** | Selalu menyalin kategori. Semua barang thrifting satuan |
| **Barcode Symbology** | Selalu Code128. Tidak perlu ditanyakan |
| **Quantity** | Selalu 1 atau 0. Diganti `status` yang lebih jelas |
| **Type** (Single) | Tidak ada jenis lain |

Enam kolom hilang dari layar pengisian. Waktu isi berkurang jauh.

### Dihitung sistem, bukan diisi

| Field | Isi |
|---|---|
| `status` | `siap_jual` · `terjual` · `disimpan` · `rusak` |
| `terjual_pada` | Terisi sendiri saat transaksi |
| `umur_hari` | Hari ini − tanggal masuk. Untuk melihat barang menumpuk |
| `margin` | Harga jual − modal |

---

## §3 · Kondisi — tidak dipakai

Rancangan awal mengusulkan skala A/B/C. **CEO menolak**, dan alasannya masuk akal: pegawai kesulitan menilainya, dan harga ditentukan dari harga beli plus perbandingan Google, bukan dari tingkat kondisi.

Memaksakan field yang orang tidak bisa isi dengan yakin hanya menghasilkan data yang salah — lebih buruk daripada tidak ada data.

Sebagai gantinya, **`catatan` dipakai untuk mencatat cacat** kalau ada. Bebas, tidak wajib.

Kalau suatu saat ada keluhan pembeli soal kondisi barang yang tidak sesuai, baru pertimbangkan menambahkannya kembali — dengan bukti nyata bahwa itu dibutuhkan.

---

## §4 · Ukuran berbeda bentuk per kategori

Ini alasan ukuran dijejalkan ke nama — satu kolom tidak cocok untuk semua.

| Kategori | Bentuk ukuran | Pilihan |
|---|---|---|
| Sepatu | Angka | 36–46 |
| Pakaian | Huruf | S, M, L, XL, XXL |
| Celana | Angka pinggang | 28–38 |
| Tas, Topi | — | Kosongkan, atau isi bebas |

Simpan sebagai satu kolom teks, tapi **pilihannya menyesuaikan kategori yang dipilih**. Kategori punya kolom `jenis_ukuran` yang menentukan pilihan apa yang muncul.

Kalau kategorinya belum diatur jenis ukurannya, tampilkan isian teks bebas. Jangan menghalangi.

---

## §5 · Kecepatan pemasukan barang — ini yang menentukan sistemnya dipakai atau tidak

Barang thrifting datang berkarung. Kalau satu barang butuh dua menit untuk dimasukkan, lima puluh barang berarti hampir dua jam — dan orang akan berhenti memakai sistemnya.

**Target: di bawah 20 detik per barang.**

Layar pemasukan cepat, satu barang per layar:

```
    [ FOTO ]  ← kamera langsung terbuka, jepret

    Kategori    [Sepatu] [Tas] [Pakaian] [Topi]     ← tombol, bukan menu
    Ukuran      [38] [39] [40] [41] [42]            ← menyesuaikan kategori
    Kondisi     [ A ]  [ B ]  [ C ]                 ← tiga tombol besar

    Nama        _______________________
    Modal       Rp _______
    Jual        Rp _______   ← terisi 2× modal, boleh diubah

    [ Simpan & barang berikutnya ]
```

Enam ketukan dan dua angka. Setelah disimpan, layar kembali kosong dengan **kategori dan kondisi tetap seperti sebelumnya** — karena barang dalam satu karung biasanya sejenis.

Label dicetak belakangan sekaligus, bukan satu per satu. Pilih beberapa barang, cetak semuanya.

---

## §7 · Barang titipan dan bagi hasil

Ini yang paling terlewat di rancangan awal. Kode "SS" di setiap nama barang ternyata bukan hiasan — itu penanda pemilik.

**Sebagian barang bukan milik toko.** Orang menitipkan barangnya, toko yang menjualkan, hasilnya dibagi **60% pemilik, 40% toko**.

### Tabel pemilik

```sql
pemilik (
  id          uuid,
  kode        text unique,      -- "SS" — dicetak di label, dipakai di nama
  nama        text not null,    -- "Salma"
  kontak      text,             -- nomor WhatsApp untuk pembayaran bagi hasil
  persen_bagi bigint default 60,-- bisa berbeda per orang
  aktif       boolean default true,
  catatan     text
)
```

`barang.pemilik_id` boleh kosong. **Kosong berarti milik toko sendiri** — seluruh hasil jadi milik toko.

### Yang berubah di layar

**Saat memasukkan barang:** tombol pemilik muncul di layar cepat, dan **nilainya bertahan ke barang berikutnya** — karena satu karung titipan biasanya dari satu orang. Itu penghematan waktu terbesar untuk sesi 150 barang.

Kode pemilik tidak perlu lagi diketik ke dalam nama barang. Cukup pilih sekali, sistem yang mencatat.

**Saat terjual:** sistem mencatat sendiri berapa bagian pemilik dan berapa bagian toko, dihitung dari `persen_bagi` yang berlaku **saat itu**. Simpan angkanya di baris transaksi, jangan dihitung ulang belakangan — kalau persentasenya diubah bulan depan, transaksi lama tidak boleh ikut berubah.

### Laporan bagi hasil

Per pemilik, per rentang tanggal:

| | |
|---|---|
| Barang dititipkan | 45 potong |
| Terjual | 12 potong |
| Belum terjual | 33 potong |
| Total penjualan | Rp 1.850.000 |
| **Bagian pemilik (60%)** | **Rp 1.110.000** |
| Bagian toko (40%) | Rp 740.000 |
| Sudah dibayarkan | Rp 800.000 |
| **Sisa dibayar** | **Rp 310.000** |

Perlu tombol **"Tandai sudah dibayar"** dengan pencatatan tanggal dan jumlah. Tanpa itu, tidak ada yang tahu utang toko ke pemilik berapa.

Bisa diekspor ke Excel dan dikirim ke pemilik lewat WhatsApp.

### Yang perlu diputuskan

Kalau barang titipan **tidak laku berbulan-bulan**, apa yang terjadi? Dikembalikan ke pemilik, atau didiskon dengan persetujuannya? Perlu ditanyakan — dan `umur_hari` yang sudah dirancang justru dipakai untuk ini.

---

## §6 · Yang masih perlu ditanyakan

1. **Ada berapa pemilik titipan sekarang?** Baru terlihat satu kode: SS (Salma).
2. **Persentase 60/40 sama untuk semua**, atau berbeda per orang?
3. **Barang titipan yang tidak laku berbulan-bulan** — dikembalikan, atau didiskon dengan izin pemiliknya?
4. **Bagi hasil dibayarkan kapan** — tiap barang terjual, mingguan, atau bulanan?
5. **Data barang di Bestie Thrift** perlu dipindahkan semua, atau cukup yang belum terjual?
