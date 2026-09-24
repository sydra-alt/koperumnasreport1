# RENCANA REVISI — Hasil Rapat Klien, 24 September 2026

Dokumen ini mencatat perubahan lingkup hasil rapat dengan klien dan
keputusan yang sudah diambil CEO atas perubahan itu. Ditulis sebelum
satu baris kode pun dibangun.

**Prinsip dari klien, dicatat persis:** sistem yang bagus bukan sistem
yang kompleks, melainkan sistem yang simpel dan benar-benar dipakai
secara maksimal.

---

## §1 · Lingkup baru

Delapan hal yang diminta klien:

1. **Opname wajib saat BUKA shift (stok awal) dan saat TUTUP shift
   (stok akhir)**, di semua outlet: Indosteak, Indokopi, thrifting.

2. **Stok awal dicocokkan dengan stok akhir shift sebelumnya** di
   outlet yang sama. Selisih harus memunculkan pertanyaan, bukan
   diterima diam-diam.

3. **Laporan PREPARE saat buka:** foto kondisi outlet, ada event atau
   tidak, plus stok awal.

4. **Laporan CLOSING saat tutup:** kondisi kebersihan, uang yang
   didapat hari itu, stok akhir.

5. **Cross-check penjualan vs pergerakan stok.** Kalau ada penjualan
   tapi stok tidak berkurang, itu anomali yang harus terlihat.

6. **Halaman AUDITOR untuk Ita.** Tiap pagi (sekitar 10.00–11.00,
   karena outlet baru buka jam 9) Ita meninjau semua outlet:
   Indosteak, Indokopi, thrifting.

7. **AI agent di dalam sistem** untuk impor data dan analisis.

8. **Redirect antar sistem tanpa login ulang.**

---

## §2 · KEPUTUSAN FINAL — Batas kerja AI

**AI boleh mengerjakan seluruh pekerjaan administratif:** membaca
Excel atau foto, mencocokkan nama bahan ke master data, normalisasi
satuan, validasi, dan mengisi draft sampai penuh.

**Manusia TIDAK mengetik ulang apa pun.** Tugas manusia hanya
memeriksa dan menekan konfirmasi.

**Satu-satunya batas:** AI tidak menulis langsung ke ledger stok. AI
mengisi DRAFT di layar opname yang sudah ada; manusia konfirmasi;
sistem yang menulis ke `stock_opname` dan ledger.

**Alasan batas itu** (bukan soal ketidakpercayaan pada AI): layar
opname yang sudah dibangun punya penjagaan yang sudah teruji, yaitu
write-once setelah disimpan, selisih otomatis masuk ledger sebagai
`adjustment`, bahan yang tidak dihitung dilewati bukan dinolkan, dan
RLS per outlet. Memberi AI jalur tulis sendiri berarti seluruh
penjagaan itu dibangun ulang, dan kemungkinan besar ada yang terlewat.

Alur yang disepakati:

```
Upload Excel / Foto
        ↓
    AI AGENT  (baca, cocokkan, normalisasi, validasi)
        ↓
  DRAFT terisi penuh di layar opname yang sudah ada
        ↓
  Manusia review, koreksi baris yang perlu saja
        ↓
     CONFIRM (sekali, untuk semua baris)
        ↓
  stock_opname + ledger + audit log
```

---

## §3 · KEPUTUSAN FINAL — Penandaan baris

**JANGAN memakai angka keyakinan dari AI.** Model yang menyatakan
"98%" tidak berarti benar 98 dari 100 kali. Angka itu dihasilkan model
dan tidak bisa dipakai sebagai ukuran.

Pakai aturan yang bisa dihitung pasti:

| Warna | Syarat |
|---|---|
| **HIJAU** | Nama cocok persis di master data DAN satuan sama |
| **KUNING** | Nama cocok sebagian (fuzzy), ATAU ada konversi satuan |
| **MERAH** | Nama tidak ketemu, ATAU ada lebih dari satu kandidat mirip |

**Aturan tambahan yang tidak bisa ditawar:** setiap baris yang
satuannya dikonversi dengan pengali 1000 (kg → gram, liter → ml)
**SELALU kuning**, sebagus apa pun pencocokan namanya. Di situ letak
kesalahan yang paling mahal. Kalau AI salah membaca "2" sebagai kg
padahal gram, selisihnya seribu kali lipat dan tidak akan terlihat
kalau barisnya hijau.

**Pemeriksa kedua, gratis dan lebih andal:** bandingkan terhadap stok
berjalan di sistem. Beras tercatat 8.160 gram lalu dibaca 7.900 gram
itu wajar. Dibaca 8 gram itu mustahil, tandai merah. Perbandingan
terhadap saldo berjalan menangkap kesalahan besaran jauh lebih andal
daripada penilaian model terhadap dirinya sendiri.

---

## §4 · KEPUTUSAN FINAL — Histori AI

Wajib disimpan setiap kali AI dipakai:

- Berkas atau foto aslinya
- Apa yang dibaca AI (hasil mentah)
- Apa yang dikoreksi manusia
- Siapa yang mengonfirmasi
- Kapan

Bagian **"apa yang dikoreksi"** yang paling berguna. Setelah sebulan,
ketahuan AI sering meleset di bahan mana, dan itu dipakai untuk
memperbaiki master data, bukan cuma menilai AI. Tanpa catatan ini,
tidak ada cara mengetahui apakah AI membantu atau diam-diam merusak
data.

---

## §5 · KEPUTUSAN FINAL — Urutan Excel dulu, foto menyusul

Excel memberi input bersih tanpa OCR. Kualitas pencocokan nama ke 225
bahan bisa dinilai tanpa tercampur masalah tulisan tangan.

Nama-nama di master data tidak mudah dicocokkan: "Susu Oatside",
"UHT Omela", "kremilk santari", "Golden Fieal Strawberry" (yang
ejaannya sendiri sudah keliru di sumber). Kalau pencocokan sudah
terbukti benar di Excel, OCR tinggal jadi lapisan tambahan di depannya,
dan kalau ada masalah sudah jelas itu masalah OCR bukan pencocokan.

---

## §6 · Yang sudah ada, perlu diverifikasi agent dari kode

Dugaan CEO, harus dibuktikan atau dibantah agent dengan membaca kode:

**Kemungkinan SUDAH ADA dan bisa dipakai apa adanya:**
- Tutup shift dengan hitung kas, toleransi selisih, alasan wajib
- Tutup-buka shift satu langkah (lintas pergantian hari bisnis)
- Force-close shift oleh manajer + layar "Perlu Ditinjau"
- Stock opname dengan selisih otomatis masuk ledger
- Potong stok otomatis saat penjualan lewat resep (B3, sudah menyala)
- Void/refund reversal stok
- Konsumsi bahan dari modifier
- Foto wajib saat kirim dan terima transfer stok
- Silang-cek omzet tiga sumber (Manager Resto, Kontrol F&B, POS)
- Visibilitas stok gudang saat request transfer

**Kemungkinan SUDAH ADA tapi perlu disambung:**
- Opname belum diikat ke buka/tutup shift
- Laporan kebersihan sudah ada, belum jadi bagian laporan closing

**Kemungkinan BELUM ADA sama sekali:**
- Laporan prepare (foto kondisi + event)
- Pencocokan stok awal vs stok akhir shift sebelumnya
- Deteksi anomali penjualan vs stok
- Halaman auditor Ita
- AI agent
- SSO / redirect tanpa login ulang

---

## §7 · Urutan pengerjaan

Yang memblokir dikerjakan dulu. Nomor 1 sampai 3 bukan pekerjaan
agent.

1. **Resep diisi** (dapur + Ita). Tanpa ini seluruh bagian stok tidak
   berarti. Lihat §8.
2. **Tentukan daftar bahan yang dihitung tiap shift.** Lihat §8.
3. **Opname pertama** untuk saldo awal 225 bahan.
4. Ikat opname ke buka/tutup shift, dengan daftar terbatas dari nomor 2
5. Laporan prepare dan closing dengan foto
6. Halaman anomali stok (query biasa, belum perlu AI)
7. Halaman auditor Ita
8. Samakan identitas dua sistem, lalu tautan masuk otomatis
9. AI agent: impor Excel dulu, foto menyusul

---

## §8 · PENGHALANG — bukan pekerjaan agent

**Resep belum terisi.** Dari 167 produk, baru segelintir yang punya
resep (barang jadi seperti Aqua, Badak, CLEO, Air Mineral, Yakult,
plus beberapa). Produk tanpa resep tidak memotong stok sama sekali.
Artinya kalau deteksi anomali (§1 nomor 5) dinyalakan sekarang, hampir
setiap penjualan akan muncul sebagai "ada penjualan tapi stok tidak
berkurang", bukan karena ada yang mencuri tapi karena resepnya belum
ada. AI tidak memperbaiki ini.

**Daftar bahan yang dihitung tiap shift belum ditentukan.** Opname
wajib dua kali sehari untuk 225 bahan di lima outlet tidak akan
dikerjakan orang. Bukti dari sistem yang sama: 2 laporan terkirim dari
24 penugasan. Form yang sudah ada saja belum diisi.

Praktik F&B yang lazim: opname tiap shift hanya untuk bahan bernilai
tinggi, cepat habis, atau rawan hilang, sekitar 10 sampai 20 item.
Opname penuh 225 bahan seminggu atau sebulan sekali. Cross-check tetap
jalan, tapi orangnya sanggup mengerjakannya.

**Keputusan ini milik Ita dan dapur, bukan agent.**

**Opname pertama belum dijalankan.** B3 (potong stok saat bayar) sudah
menyala, jadi tiap transaksi memotong stok tanpa saldo awal.

**Database produksi pos-fnb belum teridentifikasi.** Host di
`.env.production.local` NXDOMAIN; Worker hidup dan menjawab 200. Perlu
cek Cloudflare Workers → Settings → Variables.

**Penyedia AI belum dipilih.** Claude lewat API, Gemini, atau lainnya.
Menentukan biaya berjalan dan cara pemasangan. Harus diputuskan sebelum
nomor 9 dikerjakan.

---

## §9 · Pertanyaan terbuka untuk klien

**Siapa yang menghitung stok saat buka shift jam 9 pagi?** Kalau
jawabannya kasir yang sedang melayani pembeli pertama, alurnya harus
dirancang berbeda dari kalau jawabannya kepala outlet yang datang
setengah jam lebih awal.

---

## §10 · Syarat keamanan AI

Berlaku apa pun penyedia yang dipilih.

**AI wajib query atas nama pengguna yang memakainya, tunduk RLS yang
sama.** Kasir yang memakai AI tidak boleh bisa membaca data outlet lain
lewat AI, padahal lewat layar biasa dia tidak bisa.

Ini bukan detail teknis. Pembatasan akses per outlet (Tahap 0–5) dan
RLS berlapis yang sudah dibangun bisa dibatalkan seluruhnya dalam satu
percakapan kalau AI query memakai service-role.

**Biaya berjalan perlu batas.** Tiap pertanyaan ke AI berbayar,
terus-menerus selama sistem hidup.

---

## §11 · Catatan terpisah, bukan bagian rencana ini

Audit UI form lapor menemukan **10 field video bertanda `wajib: true`
tapi skemanya `boolean().optional()`**. Validasi kemungkinan lolos walau
centang kosong. Ini bug nyata di form yang sedang dipakai, perlu
diperiksa dan diperbaiki terpisah dari rencana ini.
