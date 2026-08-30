# CATATAN PELUNCURAN

Ditulis 29 Agustus 2026, setelah Task 24 selesai: matriks RLS 14 baris LOLOS semua,
`tsc`/`build`/`lint` bersih, dan uji lapangan HP sungguhan (Checkpoint 4, 10 langkah)
10/10 SESUAI. Sistem **teknis sudah siap** — bagian yang belum siap adalah **data
orang** dan **satu keputusan kebijakan** yang bukan urusan kode. Dokumen ini
urutan langkah dari sini sampai 36 karyawan benar-benar memakainya.

---

## 0 · MEMBLOKIR — jawab dulu sebelum akun asli dibuat

`docs/DATA-KARYAWAN.md` §2 berisi enam pertanyaan yang dikirim ke CEO tanggal
21-23 Agustus, dan **sejauh yang tercatat di repo ini, belum ada jawabannya**.
Ini bukan detail kecil — dua di antaranya menentukan siapa yang boleh melihat
laporan keuangan:

| # | Pertanyaan | Kenapa memblokir |
|---|---|---|
| 1 | ✅ **TERJAWAB (30 Agustus 2026) — Siapa Accounting?** **Shabita.** `scripts/akun.json` dan `profile.nama` produksi sudah diperbarui dari placeholder `"GANTI"`. | ~~Form `accounting` adalah satu-satunya laporan rahasia di seluruh sistem — salah kasih akun ini ke orang yang salah = kebocoran laporan keuangan sejak hari pertama.~~ Selesai. |
| 2 | ✅ **TERJAWAB (30 Agustus 2026) — Siapa manager Indosteak & Indokopi?** Ryan & Toni **BUKAN** manager, tebakan dicabut CEO sendiri. Manager sungguhan: Erry → Indokopi Jatinegara, Dea → Indosteak Cempaka, Cuko → Indosteak Pekansari. | ~~Kalau tebakan salah, laporan restoran diisi orang yang tidak berwenang.~~ Selesai. |
| 3 | ✅ **TERJAWAB (30 Agustus 2026) — "Inservice" itu apa?** BUKAN divisi tersendiri — Dedi & Yundi satpam (`security`), Fauzan OB (`ga`), Cahya dua-duanya, Masudin masih ditunda (bukan ditebak). `docs/DATA-KARYAWAN.md` §1 sudah diperbarui. | ~~Kelima orang ini akan login lalu tidak menemukan tugas apa pun.~~ Selesai untuk 4 dari 5 — Masudin masih perlu dijawab. |
| 4 | **"Rukost" itu unit usaha sendiri?** ✅ **TERJAWAB (30 Agustus 2026)** — bukan unit usaha, Toyib karyawan biasa penjaga kost, tidak butuh form sendiri, tetap wajib PTE seperti yang lain. | ~~Satu orang tanpa tugas yang jelas.~~ Selesai. |
| 5 | **Lokasi perumahan cuma Tajur & Bekasi, atau ada lagi?** | Kalau ada lokasi lain tanpa PIC tercatat, laporan lokasi itu akan bolong tanpa ada yang bertugas. |
| 6 | ✅ **TERJAWAB (30 Agustus 2026) — Form `accounting`/`kendaraan`/`ga`/`ita`?** `accounting`→Shabita, `ga`→Fauzan+Cahya, `kendaraan`→Pak Tri (baru). `ita` sendiri sudah DIPECAH jadi `thrifting`+`kontrol_fnb` (Ita + Mba Rika, baru) — lihat `docs/DATA-KARYAWAN.md`. Assignment resminya masih **rencana**, menunggu CEO atur lewat tab Admin "Penugasan". | ~~Kalau memang tidak ada orangnya, form itu dicoret.~~ Selesai — semua form sekarang punya calon pengisi. |

Ada juga tiga kemungkinan salah tulis nama (Ery vs Erry, Avril muncul di dua
divisi, "Fur" nama lengkapnya apa) — kecil, tapi ikut menentukan berapa
akun yang sebenarnya dibuat (35, 36, atau 37).

**Jangan buat akun ke-8 sampai ke-36 sebelum ini terjawab.** Menjalankan
langkah 1 di bawah dengan tebakan yang salah berarti mengulang seluruh
proses onboarding untuk orang yang salah dapat akun.

---

## 1 · Urutan dari sekarang sampai 36 karyawan bisa dipakai

1. **Jawab pertanyaan §0 di atas** bersama CEO.
2. **Perbarui `docs/DATA-KARYAWAN.md`** dengan jawaban final — termasuk nama asli
   Accounting (bukan lagi "GANTI"), manager resto yang benar, dan keputusan soal
   Inservice/Rukost/form-tanpa-orang. Beri tahu saya perubahannya — saya yang
   memperbarui `scripts/akun.json` dan SQL assignment supaya keduanya tetap
   satu sumber kebenaran yang sama (bukan dua daftar yang bisa berbeda).
3. **Putuskan cara distribusi password** (lihat kotak keputusan di bawah) sebelum
   akun dibuat — bukan sesudah, supaya tidak ada akun yang password awalnya
   sempat tidak jelas siapa yang pegang.
4. **Buat 36 akun.** Dua jalan, pilih salah satu (atau campur):
   - **`scripts/buat-akun.mjs`** (`npm run akun`) — sekali jalan untuk semua,
     butuh terminal + `SUPABASE_SERVICE_ROLE_KEY`. Idempoten (aman diulang,
     akun yang sudah ada dilewati) — cocok untuk pembuatan massal awal.
   - **Halaman Admin → tab Pengguna** — satu-satu lewat browser sebagai CEO,
     tidak butuh terminal. Cocok untuk karyawan baru SETELAH peluncuran awal.
5. **Verifikasi spot-check** (tidak perlu 36 akun satu-satu) — cukup satu dari
   tiap jenis peran: satu `kadiv`, satu `pic_lokasi`, satu `karyawan` biasa,
   akun `accounting`, dan CEO sendiri. Untuk tiap satu: login sungguhan, cek
   Beranda menunjukkan tugas yang benar, cek dia TIDAK melihat menu/data yang
   bukan haknya.
6. **Nonaktifkan atau hapus ketujuh akun uji** (`docs/DATA-KARYAWAN.md` §3 —
   `putri@koperumnas.local` dkk, domain `.local` palsu) supaya tidak
   bercampur dengan 36 akun asli di halaman Admin. Kalau mau dipertahankan
   untuk uji di masa depan, minimal ganti passwordnya lagi dan jangan
   pernah dipakai orang sungguhan.
7. **Umumkan ke karyawan** (lihat §2 di bawah) — SEBELUM, bukan sesudah, hari
   pertama mereka diminta login.
8. **Nyalakan, lalu pantau minggu pertama** (§4 di bawah).

> ⚠️ **`pte_mulai_berlaku` TIDAK termasuk di langkah mana pun di atas.**
> Sistem bisa dipakai penuh untuk SEMUA laporan harian tanpa itu diisi.
> Aktivasinya adalah keputusan terpisah — lihat §3.

---

## Keputusan distribusi password — SELESAI (30 Agustus 2026)

**Pertanyaan nomor 1 di bawah ("Password awal 36 akun") sudah TERJAWAB dan DIBANGUN, bukan lagi risiko yang diterima sadar.** CEO memilih password awal seragam `admin123` untuk mudah dibagikan -- user (pemilik proyek) menegaskan itu HANYA aman kalau paksaan ganti dibangun BERSAMAAN, bukan menyusul, karena kalau tidak dipaksa sebagian besar orang tidak akan pernah ganti, dan satu orang yang tahu polanya bisa login sebagai siapa pun yang belum ganti -- termasuk Shabita (laporan Accounting, saldo bank & prioritas pembayaran).

**Dibangun (migrasi `0034_paksa_ganti_password.sql` + kode aplikasi):**
- `profile.harus_ganti_password` (default `true`) -- SEMUA akun baru (lewat `scripts/buat-akun.mjs` maupun tombol "Tambah pengguna baru" di Admin) dibuat dengan password `admin123` DAN penanda ini menyala.
- `proxy.ts` memaksa alih ke `/ganti-password` di SEMUA rute selama penanda masih menyala -- tidak bisa dilewati dengan mengetik alamat lain, satu tempat pencegat, bukan pengecekan per halaman yang bisa lupa dipasang.
- `/ganti-password` -- password baru minimal 8 karakter, tidak boleh `admin123`, diketik dua kali. Setelah berhasil, penanda mati dan langsung masuk Beranda.
- Tombol "Atur ulang kata sandi" (CEO) juga MENYALAKAN kembali penanda ini -- password yang direset tetap wajib diganti sendiri oleh pemiliknya.
- **Penanda TIDAK BISA dimatikan lewat update langsung** (guard trigger DB) -- cuma lewat `/api/ganti-password` yang membuktikan dulu password sungguhan berubah. Tanpa guard ini, siapa pun bisa mematikan penandanya lewat REST tanpa pernah ganti password, membuat seluruh mekanisme sia-sia -- pola celah yang sama ditemukan berulang sesi ini (`cuti`/`decision`/`absensi`/`profile.divisi`).
- Diterapkan juga ke ketujuh akun uji yang sudah ada (`scripts/terapkan-admin123-uji.mjs`) -- password mereka sekarang SAMA `admin123`, harus_ganti_password menyala, sama seperti akan diterima 39 akun asli nanti.

**Diverifikasi HTTP sungguhan** (`scripts/uji-paksa-ganti-password-http.mjs`, bukan penyamaran JWT): login Toyib (`admin123`) lewat sesi cookie sungguhan, `GET /papan` dan `GET /terpusat` LANGSUNG -- keduanya 307 ke `/ganti-password`. `POST /api/ganti-password` dengan password baru -- 200. Login ULANG dengan password baru (sesi fresh) -- `GET /papan` sekarang 200, tidak dialihkan lagi. Diperiksa juga langsung ke database: `harus_ganti_password` benar-benar `false` setelah itu. 6/6 titik lolos. Guard anti-bypass diverifikasi terpisah (`scripts/uji-jaga-harus-ganti-password.mjs`, 4/4 lolos).

Pertanyaan nomor 2 (titik kontak kalau lupa password) MASIH TERBUKA -- proses murni, bukan teknis, tetap perlu disepakati sebelum hari pertama.

## (Riwayat, sebelum 30 Agustus 2026)

**Ditutup hari ini:** halaman Admin → tab Pengguna sekarang punya tombol
**"Atur ulang kata sandi"** per orang. CEO login lewat browser biasa, klik
tombol di baris nama orangnya, kata sandi baru (16 karakter acak, pola sama
`scripts/set-password.mjs`) tampil SEKALI di layar untuk disalin & diberikan
langsung — tidak pernah tersimpan di mana pun selain layar itu. Tidak lagi
butuh saya/terminal/kunci service role untuk reset rutin. Setiap reset
tercatat (siapa mengatur ulang siapa, kapan) di tabel `reset_password_log`,
cuma bisa dibaca role `ceo`.

Sengaja **tidak** dibangun alur "Lupa Password" mandiri lewat email —
email `@koperumnas.local` tidak nyata, tombol reset bawaan Supabase akan
mengirim ke alamat yang tidak pernah ada. Minta ke admin (CEO) memang jalur
yang benar untuk perusahaan sebesar ini: admin tahu persis siapa yang
meminta, bukan percaya link email yang bisa disalahgunakan siapa saja yang
kebetulan tahu alamat surel seseorang.

**Masih perlu diputuskan** (dua pertanyaan lama menyempit jadi ini):

1. **Password awal 36 akun:** dibuatkan unik per orang lalu diberikan
   satu-satu (kertas, WhatsApp pribadi — bukan grup), ATAU satu password
   awal sama untuk semua dengan syarat "wajib diganti di login pertama"?
   **Sistem belum punya paksaan ganti-password-di-login-pertama** — kalau
   opsi kedua dipilih, itu risiko yang diterima sadar, bukan dibangun dulu
   (persis pelajaran `123456` yang jadi debt WAJIB untuk 7 akun uji, dan itu
   baru 7 orang).
2. **Siapa titik kontak kalau ada yang lupa password.** Mekanismenya sudah
   ada (poin di atas) — pertanyaan yang tersisa murni proses: karyawan
   menghubungi siapa (Sabrina? Langsung CEO?) supaya CEO tahu harus klik
   tombol itu untuk siapa. Perlu disepakati sebelum hari pertama, bukan
   ditentukan reaktif saat orang pertama benar-benar lupa.

**Usul role `admin_akun` — DISETUJUI isinya, DITUNDA pelaksanaannya (29 Agustus 2026):**
usul kalau CEO sering tidak sempat pegang HP/laptop untuk klik tombol ini —
role baru `admin_akun` untuk satu orang tepercaya (misalnya Sabrina), dengan
**pengecualian wajib: tidak boleh mengatur ulang kata sandi akun `ceo`
maupun `accounting`** (kalau tidak, siapa pun yang pegang role ini bisa
masuk ke laporan keuangan lewat jalur auth, bukan lewat query — membuat
seluruh matriks RLS yang sudah teruji jadi tidak berarti). User setuju isi
usulan ini, tapi sengaja menunda pelaksanaannya — belum ada data seberapa
sering tombol reset benar-benar dipakai, dan privilege baru jauh lebih
gampang ditambah daripada dicabut setelah orang terbiasa. Fitur ini
digerbangi `ceo` saja untuk sekarang. **Ditinjau ulang setelah sistem
berjalan ~1 bulan dengan 36 pengguna asli** — cek `reset_password_log`,
kalau seringnya tinggi baru dibangun. Detail lengkap ada di
`docs/PROGRESS.md`, bagian "Keputusan ditunda: role `admin_akun`".

Saya tidak memutuskan ini sepihak karena menyangkut cara kerja tim, bukan
soal teknis — tapi kalau dibiarkan tidak diputuskan, ini akan jadi masalah
nyata di hari pertama, bukan risiko teoretis.

---

## 2 · Yang harus diumumkan ke karyawan SEBELUM sistem menyala

Sampaikan **sebelum** hari pertama mereka diminta login, bukan bersamaan:

1. **Apa ini dan kenapa berubah.** Laporan harian pindah dari WhatsApp ke
   satu sistem terpusat — alasannya (biar tidak hilang di scroll chat, biar
   Papan Kontrol keliatan siapa yang belum lapor, dst.) sebaiknya datang dari
   CEO/atasan langsung, bukan dari pesan sistem.
2. **Login masing-masing** — email + password awal, dikirim **individual**
   (lihat kotak keputusan di atas), bukan ditempel di grup WhatsApp.
3. **Cara pasang ke layar utama HP** — "buka di Safari/Chrome → Bagikan →
   Tambah ke Layar Utama" (persis Langkah 1 checklist uji lapangan HP yang
   baru lolos). Ini bukan wajib teknis, tapi jauh lebih nyaman dipakai
   tiap hari dibanding buka browser & ketik alamat setiap kali.
4. **Form apa yang jadi tugas mereka, dan jam batasnya.** Beranda sudah
   menampilkan ini otomatis per orang setelah login — tapi pengumuman awal
   tetap perlu bilang "buka Beranda, itu yang wajib kamu isi" supaya tidak
   ada yang bingung form mana yang jadi tanggung jawabnya.
5. **Apa artinya "TERLAMBAT".** Saat ini status TERLAMBAT/tepat waktu cuma
   tercatat & terlihat di Papan Kontrol/laporan — **belum ada konsekuensi
   otomatis** (potongan PTE baru berlaku kalau `pte_mulai_berlaku` diisi,
   lihat §3). Jangan biarkan karyawan mengira telat = langsung dipotong gaji
   hari itu juga kalau itu belum benar.
6. **Bonus/potongan PTE marketing BELUM aktif** — jangan disinggung sebagai
   sudah berjalan. Tanggal aktivasinya akan diumumkan terpisah, terikat pada
   §3 di bawah, bukan bersamaan dengan peluncuran laporan harian ini.
7. **Kontak kalau ada masalah** — login gagal, form membingungkan, atau
   HP tidak bisa pasang ke layar utama. Satu kontak jelas, bukan "tanya
   siapa saja yang online".

---

## 3 · Kapan `pte_mulai_berlaku` boleh diisi

**Penghalang TEKNIS sudah tertutup (30 Agustus 2026) — tapi tanggalnya
TETAP keputusan CEO, bukan agent, dan bukan otomatis "sekarang boleh".**

Sebelumnya bagian ini mencatat debt yang ditegaskan ulang user 29 Agustus
2026: cuti/sakit/izin yang disetujui belum mengecualikan `hari_bolong`,
menunggu presensi dibangun lebih dulu. Presensi sudah jalan sejak 29 Agustus
(§3 `docs/06-RENCANA-PRESENSI-MOBILE.md`), dan halaman **Cuti** (`/cuti`
pengajuan, `/cuti/tinjau` persetujuan HRD/CEO) menutup penyambungannya ke
`hari_bolong` pada 30 Agustus 2026 — lihat `docs/PROGRESS.md` bagian "Batch
— Cuti diatur dari web" untuk detail lengkap + bukti uji
(`scripts/uji-cuti-rls.mjs`, 12 titik, semua lolos, termasuk pembuktian
langsung bahwa satu hari kerja yang tertutup cuti disetujui benar-benar
dikecualikan dari `hari_wajib`).

**Yang berubah secara konkret:** kalau `pte_mulai_berlaku` diisi sekarang,
karyawan yang cuti resmi (disetujui lewat `/cuti/tinjau`) **TIDAK LAGI**
tercatat bolong untuk hari itu — bekas risiko kerugian Rp500.000 yang
dicatat di bagian ini sebelumnya sudah tidak berlaku lagi secara teknis.

**Yang TIDAK berubah:** tanggal aktivasinya sendiri. User eksplisit
menegaskan ini (30 Agustus 2026): "Betul juga soal pte_mulai_berlaku:
penghalang teknisnya tertutup setelah ini, tapi tanggalnya tetap aku yang
isi, bukan kamu." Nilai produksi TETAP `null` — CEO yang mengisinya sendiri
lewat halaman Admin, kapan pun beliau siap, dan **umumkan ke staf marketing
lebih dulu** (bukan retroaktif di tengah bulan) supaya tidak ada yang kaget
kewajibannya tiba-tiba mulai dihitung.

Sampai CEO mengisinya, `hari_wajib=0` untuk semua orang dan status
bonus/potongan tetap tampil "belum berlaku" di layar — **itu benar, bukan
bug, dan tidak perlu "diperbaiki" supaya angka muncul lebih cepat.**

---

## 4 · Yang harus dipantau di minggu pertama

- **Papan Kontrol tiap hari** — siapa yang belum lapor mendekati jam batas.
  Tombol Tagih (Pusat) dipakai wajar, bukan spam ke semua orang tiap jam.
- **Permintaan reset password** — sudah dibahas di kotak keputusan atas;
  pastikan jalurnya benar-benar dipakai (bukan orang diam-diam tidak bisa
  login lalu berhenti coba).
- **Unggahan bukti foto/video dari HP nyata yang beragam.** Uji lapangan HP
  yang baru lolos cuma memakai SATU perangkat. 36 orang berarti puluhan
  kombinasi merek/OS/browser berbeda — pantau apakah ada yang gagal unggah
  atau kompresi macet di HP tertentu yang belum pernah dicoba.
- **PWA terpasang atau tidak.** Kalau banyak yang tetap buka lewat browser
  biasa (bukan dari ikon Layar Utama), itu bukan error, tapi tanda instruksi
  pemasangan di §2 poin 3 perlu diulang/diperjelas.
- **Pertanyaan soal bonus PTE dari staf marketing.** Kemungkinan besar akan
  ada yang bertanya "kapan mulai dihitung" — siap dengan jawaban §3, jangan
  biarkan pertanyaan itu berujung ke keputusan mengisi `pte_mulai_berlaku`
  buru-buru supaya ada jawaban.
- **36 akun asli vs 7 akun uji tidak tercampur** di halaman Admin (lihat
  langkah 6 di §1).
- **Kuota Supabase** (ukuran database, Storage, jumlah request) — belum
  pernah dipantau di skala 36 orang aktif harian; layak dicek di akhir
  minggu pertama, bukan diasumsikan aman selamanya dari beban 7 akun uji.

---

## Ringkasan satu paragraf

Sistemnya sudah siap secara teknis — RLS teruji penuh, dibangun & terbukti
jalan sungguhan di HP, dan mekanisme reset password (tombol Admin, tanpa
email fiktif) sudah ada. Yang menahan peluncuran ke 36 orang sekarang murni
dua hal manusia, bukan kode: **data karyawan yang masih punya 6 pertanyaan
terbuka ke CEO** (termasuk siapa Accounting, akun paling sensitif di sistem
ini), dan **dua keputusan kecil soal password** (password awal seragam atau
unik per orang, dan siapa titik kontak minggu pertama). `pte_mulai_berlaku`
sengaja tetap `null` — bukan lagi karena penghalang teknis (presensi +
pengecualian cuti/sakit/izin sudah selesai & teruji 30 Agustus 2026),
melainkan murni menunggu CEO sendiri yang menentukan & mengisi tanggalnya.
