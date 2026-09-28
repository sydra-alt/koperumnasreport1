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

**Penyedia AI: DIPUTUSKAN 28 September 2026 -- Google Gemini**, model
Flash termurah (`gemini-2.5-flash-lite`, US$0,10 / US$0,40 per 1 juta token
masuk/keluar, belum ada jadwal penghentian), nama model di env
`GEMINI_MODEL` supaya bisa diganti tanpa ubah kode. Lihat §12.

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

---

## §12 · Asisten AI fase 1 -- chat & analisis (28 September 2026)

**Lingkup.** HANYA tanya jawab dan analisis. Impor Excel ke draft opname
(§2, §5) adalah fase 2 dan BELUM dibangun.

**Letak.** Semua di reportkoperumnasgroup: layar `/asisten`, riwayat chat,
log alat, dan pemanggilan Gemini (`app/api/ai/chat`, `lib/ai/`). pos-fnb
cuma menjalankan daftar alat tetap lewat jembatan bertanda tangan
(`POST /api/ai/tools`), tanpa model AI apa pun di sana.

**Syarat §10 dipenuhi begini.** Gemini tidak menulis SQL dan tidak pernah
memegang service-role key -- ia cuma memilih alat dan argumen.
- Alat LOKAL (status laporan, presensi, omzet POS harian): fungsi `ai_*`
  migrasi 0064, `security invoker`, dipanggil lewat sesi PENANYA. RLS sama
  persis dengan layar biasa. Dua fungsi ikut mencerminkan aturan lihat
  tabel dasarnya (`can_see_report`, policy `absensi_select`) supaya orang
  yang datanya tersembunyi tidak terbaca "belum lapor"/"tidak absen" --
  angka palsu, bukan sekadar kosong.
- Alat POS (penjualan per item, stok bahan, status opname, penjualan vs
  stok): token 60 detik sekali pakai, audience `pos-fnb-ai-query`, cuma
  email+uid penanya. pos-fnb memetakan lewat `report_identity_links`, lalu
  membentuk SESI SUNGGUHAN untuk user pos-fnb itu (jalur `generateLink`
  yang sama dengan handoff) dan menjalankan query lewat `getUserDb` -- RLS
  pos-fnb berlaku. Tidak ada pemetaan = data POS kosong, bukan query tanpa
  cakupan. Kasir ditolak di keempat alat (izin layar aslinya tidak ia punya).

**Keterbatasan yang diketahui (belum ditutup).** RLS `stock_levels` dan
`stock_movements` di pos-fnb cuma per BISNIS, bukan per outlet. Untuk dua
alat stok (stok bahan, penjualan vs stok), penyaring outlet murni app layer
lewat helper `outletScopeCondition` yang sudah ada -- kalau helper itu
salah, database tidak menahan. Penjualan (`orders`) tetap dijaga RLS per
outlet. Menutupnya = policy RLS per outlet di dua tabel itu (pola
`auth_outlet_ids()` yang sudah dipakai `orders`/`shifts`), pekerjaan
terpisah.

**Batas laju Supabase (diperiksa).** Menukar magic link jadi sesi lewat
`/auth/v1/verify`, dibatasi 30 permintaan / 5 menit PER IP (bisa diubah di
Authentication > Rate Limits). Satu pertanyaan bisa 4 putaran alat, jadi
mint per putaran habis dalam ~7 pertanyaan untuk semua pengguna dari IP
worker yang sama. Karena itu sesi hasil mint disimpan per user 120 detik
di memori worker pos-fnb, lalu di-sign-out (scope `local`, supaya sesi
browser user itu sendiri tidak ikut keluar). Isolate worker yang mati
lebih dulu meninggalkan sesi tanpa pemegang; access token-nya kedaluwarsa
sendiri dalam 1 jam.

**Nonce.** Tiap putaran = satu token = satu nonce (maks 4 per pertanyaan).
`handoff_nonces` dibersihkan otomatis (nonce > 10 menit dihapus tiap
nonce baru dipakai, indeks `used_at`). Aman karena pos-fnb menolak token
yang masa berlakunya > TTL + 30 detik.

**Batas putaran.** Maks 4 putaran alat per pertanyaan. Kalau model masih
butuh alat sesudahnya, jawabannya "tidak bisa menjawab dengan lengkap" --
bukan jawaban parsial yang terlihat lengkap, dan tabel setengah jalan
tidak ditampilkan.

**Histori AI (§4).** Tiga tabel: `ai_percakapan` + `ai_pesan` (pribadi --
CEO pun tidak membaca chat orang lain; pesan append-only) dan
`ai_panggilan_alat` (siapa, alat apa, argumen apa, sumber, status, berapa
baris kembali; append-only; pemilik + CEO bisa membaca). Kalau pencatatan
gagal, jawaban tidak diberikan.

**Biaya & akses.** Batas pesan per orang per hari = policy
`ai_batas_pesan_harian` (awal 30), ditegakkan trigger di database; kunci
hilang = 0 = asisten mati, tidak ada angka cadangan di kode. Siapa boleh
memakai = PER ORANG, `profile.punya_akses_ai` (migrasi 0067, 29 September
2026, menggantikan policy per peran `ai_peran_boleh`): Putri, Ita, dan AKUN
UJI - CEO. Hanya CEO/Admin yang boleh mengubah (tab Penugasan di Admin). Omzet POS di database ini
cuma terbaca CEO/accounting (RLS lama) -- manajer resto yang bertanya
omzet mendapat "tidak ada data".

**Batas hak BUKAN data kosong (koreksi CEO, 28 September 2026).** Jawaban
yang benar secara teknis tapi terbaca sebagai fakta bisnis padahal fakta
tentang izin = bug. Diterapkan di semua alat:
- Peran yang tidak boleh melihat data (omzet POS untuk selain CEO/accounting,
  alat POS tanpa izin layar, membership POS tanpa outlet) -> `tidak_berhak`:
  "angka itu tidak tersedia untuk peranmu", bukan "tidak ada data".
  `ai_omzet_pos` juga MENOLAK eksplisit di database (bukan nol baris).
- Penanya melihat sebagian (laporan/presensi orang lain, outlet POS lain) ->
  hasil membawa `batas_hak`; nol baris jadi `kosong_dalam_hak`, bukan nol.
- Outlet yang diminta di luar hak -> `outlet_di_luar_hak`.
- `tidak_ada_data` HANYA kalau penanya melihat semuanya (`ai_cakupan()`,
  cermin RLS tiap tabel).
- Asisten tanpa kunci policy / batas 0 -> "belum diaktifkan untuk bisnis
  ini", terpisah tegas dari "batas N pesan tercapai" (`ai_status()`).

**Gerbang peran diuji dengan login sungguhan** (`scripts/uji-gerbang-ai.mts`):
accounting, pusat, admin, karyawan, dan tanpa peran ditolak 403 SEBELUM model
dibuat (penghitung model = 0, nol percakapan tersimpan); kontrol positif
manager_resto sampai ke model tepat sekali.

**Koreksi jawaban sesudah uji sungguhan pertama (CEO, 29 September 2026).**
- *Periode relatif = periode kalender.* "Minggu ini" sempat jadi 22-29 Sep
  (jendela 8 hari lintas dua minggu). Sekarang model mengisi argumen
  `periode` (hari_ini, kemarin, minggu_ini, minggu_lalu, bulan_ini,
  bulan_lalu) dan tanggalnya dihitung server: di repo ini dari tanggalWIB
  (`lib/ai/periode.ts`), di pos-fnb dari hari bisnis outlet dengan cutoff
  (`src/lib/calc/relative-period.ts`). Minggu mulai Senin.
- *Akun uji keluar dari jawaban.* `profile.akun_uji` (migrasi 0065), hanya
  CEO/Admin yang boleh mengubah; tujuh akun uji ditandai per email, TIDAK
  dinonaktifkan. `ai_status_laporan`/`ai_presensi` melewatinya.
- *Jangan bilang dua kali.* Kalau tabel tampil, prosa satu kalimat: angka
  utama (dari `ringkasan` hasil alat, bukan hitungan model), periode,
  cakupan. Dipaksa juga di server (`satuKalimat`).
- Model: `gemini-2.5-flash-lite` menjawab 404 untuk kunci ini; dipakai
  `gemini-3.1-flash-lite` lewat env `GEMINI_MODEL`.

**Pemetaan identitas ke pos-fnb (`report_identity_links`, 29 September 2026).**
Aturan: email sama PERSIS, tidak pernah dicocokkan kira-kira. Satu
pengecualian, DISETUJUI CEO: `putri@koperumnas.local` (di sini) ->
`putri@koperumnas.com` (pos-fnb, owner, semua outlet). Ita:
`ita@koperumnas.local` -> `ita@koperumnas.com` (akun pos-fnb baru, password
acak yang tidak pernah dicetak/disimpan -- masuk HANYA lewat "Buka Dashboard
Toko"; manager, semua outlet, `audit_all_outlets = true`). Bisnis pos-fnb
"[DEV] Demo Cafe" dinamai ulang "Koperumnas Group" (satu-satunya bisnis
sungguhan; berisi outlet Indosteak/Indokopi/Bestie Thrift).

**Belum dikerjakan (fase 1).** Pemantauan biaya per bulan di layar (datanya
sudah ada di `ai_panggilan_alat`). Hapus/ganti nama percakapan.
