# Pemulihan Data — Cadangan Database Produksi

Berlaku untuk dua database produksi: **pos-fnb** (Supabase `txmkbklzhleavjhzrckm`) dan **sistem laporan** (Supabase `thiyulmidijbfqrvsmns`). Dibuat 7 Oktober 2026. Biaya: **Rp0**: tanpa layanan baru, tanpa pendaftaran, tanpa paket berbayar.

## 1. Yang diberikan Supabase saat ini

- Paket proyek **tidak bisa dibaca** dengan kredensial database kita. Untuk memastikannya, buka dashboard Supabase → Project Settings → Billing, serta Database → Backups.
- Ciri kedua proyek cocok dengan paket **Free**: komputasi terkecil (`max_connections` = 60), Postgres 17.6, ukuran database ±15–17 MB.
- Paket Free **tidak menyediakan cadangan harian yang bisa diunduh dan tidak punya point-in-time recovery**. Paket Pro menyediakan cadangan harian dengan retensi 7 hari, tapi berbayar.
- Karena itu kita membuat cadangan sendiri (bagian 2).

## 2. Cadangan otomatis

| Hal | Isi |
|---|---|
| Apa | `pg_dump` lengkap (format custom) kedua database: semua skema, termasuk `auth.users`. |
| Enkripsi | AES-256-GCM. Dump dialirkan langsung ke enkripsi, jadi tidak pernah ada salinan polos di disk. |
| Lokasi cadangan | `D:\USER\cadangan-koperumnas\` di laptop pengembang. Di luar semua repo git dan tidak pernah diunggah ke internet. |
| Lokasi kunci | `C:\Users\USER\.koperumnas-cadangan\kunci-cadangan.txt`. File terpisah dari cadangannya. Isinya tidak pernah dicetak atau di-commit. |
| Nama file | `pos-fnb-YYYY-MM-DD_HHMM.dump.enc`, `laporan-YYYY-MM-DD_HHMM.dump.enc` (jam WIB). |
| Jadwal | Windows Task Scheduler **"Koperumnas Cadangan Database"**: tiap **Senin 09.00** dan **10 menit setelah login**, dalam mode susulan (`--susulan --jarak-jam 144`). Cadangan hanya dibuat kalau cadangan OK terakhir sudah lebih dari 6 hari, jadi jadwal yang terlewat karena laptop mati tersusul begitu laptop dipakai lagi. |
| Status di aplikasi | Setiap percobaan menulis satu baris `status_cadangan` di database yang dicadangkan: tanggal, hasil, ukuran, dan nama file, tanpa rahasia. **Admin** (sistem laporan) dan **dashboard owner** (pos-fnb) menampilkan "Cadangan terakhir: N hari lalu", dengan peringatan merah kalau lebih dari 8 hari, belum pernah tercatat, atau percobaan terakhir gagal. |
| Retensi | 56 hari (±8 cadangan mingguan). Minimal 4 file terbaru per database selalu disimpan. |
| Catatan hasil | `D:\USER\cadangan-koperumnas\cadangan.log`: satu baris `OK`/`GAGAL` per database, tanpa kredensial. |
| Uji pemulihan | Task **"Koperumnas Uji Pemulihan"**, tiap 4 minggu (Senin 10.00), hasilnya di `uji-pemulihan.log`. |
| Alat | PostgreSQL 17 resmi (zip, tanpa instalasi) di `D:\USER\alat\pgsql\bin`. |
| Skrip | `scripts/cadangan/cadangkan.mjs` dan `scripts/cadangan/pulihkan.mjs` di repo ini. Skrip tidak berisi rahasia apa pun. |

**Wajib dilakukan sekali oleh pemilik:**

- **Salin kunci ke tempat kedua**, misalnya password manager CEO atau kertas di brankas. Tanpa kunci, cadangan tidak bisa dibuka sama sekali.
- **Pilih salinan kedua untuk cadangannya.** Cadangan dan kunci sekarang berada di satu laptop; kalau laptop hilang atau rusak, keduanya ikut hilang. Pilihan tanpa biaya:
  - salin folder `D:\USER\cadangan-koperumnas\` ke flashdisk yang disimpan terpisah, seminggu sekali; atau
  - salin ke OneDrive pribadi. Filenya terenkripsi, tapi **jangan** simpan kuncinya di OneDrive yang sama.

**Saat penjualan nyata dimulai, ubah jadwal ke harian** (PowerShell):

```powershell
$a = New-ScheduledTaskAction -Execute 'C:\nvm4w\nodejs\node.exe' -Argument 'scripts\cadangan\cadangkan.mjs --susulan --jarak-jam 20' -WorkingDirectory 'D:\USER\website_dev\reportkoperumnasgroup'
$t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME; $t2.Delay = 'PT10M'
Set-ScheduledTask -TaskName 'Koperumnas Cadangan Database' -Action $a -Trigger @((New-ScheduledTaskTrigger -Daily -At 9am), $t2)
```

Retensi tetap 56 hari, jadi sekitar 56 file per database dengan ukuran ±1 MB per file.

**Tidak ikut dicadangkan:** file foto di Supabase Storage (foto laporan ±18 MB, foto nota/opname POS ±0,4 MB). Yang ikut hanya catatan dan pathnya di database. Kalau proyek Supabase hilang total, foto-foto itu ikut hilang.

## 3. Memeriksa bahwa cadangan berjalan

1. Buka `D:\USER\cadangan-koperumnas\cadangan.log`. Baris terakhir harus `OK pos-fnb …` dan `OK laporan …` dengan tanggal Senin terakhir.
2. Ada baris `GAGAL`? Jalankan manual dari folder repo laporan: `node scripts/cadangan/cadangkan.mjs`, lalu baca pesannya. Penyebab paling umum: tidak ada internet, atau password database diganti sehingga `.env.local` perlu diperbarui.

## 4. Uji pemulihan (bulanan, otomatis)

Jalankan manual kapan saja dari folder repo laporan:

```
node scripts/cadangan/pulihkan.mjs --uji
```

Isi uji ini:

1. Cadangan terbaru tiap database dibuka (didekripsi) ke folder temp.
2. File itu dipulihkan ke Postgres sementara, khusus localhost di port 54329.
3. Jumlah baris **setiap** tabel `public` dan `auth.users` dibandingkan dengan produksi. Produksi hanya dibaca.
4. Postgres sementara dimatikan, lalu folder temp dan file polosnya dihapus.

Hasil uji pertama (4 Oktober 2026):

```
LOLOS pos-fnb: 55 tabel, 2063 baris dipulihkan; beda jumlah baris: tidak ada; pesan pg_restore: 0
LOLOS laporan: 32 tabel, 604 baris dipulihkan; beda jumlah baris: tidak ada; pesan pg_restore: 0
UJI PEMULIHAN LOLOS
```

## 5. Langkah pemulihan darurat

**Jangan pernah memulihkan langsung di atas database produksi yang masih berjalan.** Pulihkan dulu ke tempat terpisah, periksa, baru putuskan.

### A. Data terhapus atau rusak, proyek Supabase masih ada

1. Pilih file cadangan dari sebelum kejadian di `D:\USER\cadangan-koperumnas\`.
2. Buka filenya dari folder repo laporan:
   ```
   node scripts/cadangan/pulihkan.mjs --dekripsi D:\USER\cadangan-koperumnas\<file>.dump.enc C:\temp\pulih.dump
   ```
3. Pulihkan ke Postgres sementara untuk diperiksa. Uji pemulihan di bagian 4 melakukan hal yang sama secara otomatis. Untuk pemeriksaan manual, jalankan `node scripts/cadangan/pulihkan.mjs --uji`, atau ikuti langkah B.3–B.5 ke proyek Supabase cadangan.
4. Ambil baris yang hilang dari salinan itu, lalu masukkan kembali ke produksi lewat SQL yang ditinjau dua orang. Catat alasannya. Untuk pos-fnb, pakai jalur aplikasi bila ada; misalnya koreksi stok tetap lewat opname, bukan SQL langsung.
5. Hapus `C:\temp\pulih.dump` setelah selesai. File itu berisi data polos.

### B. Proyek Supabase hilang total

1. Buat proyek Supabase baru (paket Free bisa) di region yang sama. Simpan password database-nya hanya di `.env.local`.
2. Buka cadangan terbaru seperti langkah A.2.
3. Isi variabel koneksi (session pooler, port 5432) dari dashboard proyek baru → Connect. Ketik di PowerShell; jangan disimpan di file repo:
   ```powershell
   $env:PGHOST='<host pooler>'; $env:PGPORT='5432'; $env:PGUSER='postgres.<ref proyek baru>'
   $env:PGPASSWORD='<password>'; $env:PGDATABASE='postgres'; $env:PGSSLMODE='require'
   ```
4. Pulihkan akun login dulu, karena tabel `public` merujuk ke `auth.users`:
   ```
   D:\USER\alat\pgsql\bin\pg_restore --data-only --no-owner -n auth -t users -t identities -d postgres C:\temp\pulih.dump
   ```
5. Pulihkan semua tabel, fungsi, policy RLS, dan data aplikasi:
   ```
   D:\USER\alat\pgsql\bin\pg_restore --no-owner -n public -d postgres C:\temp\pulih.dump
   ```
6. Buat ulang bucket Storage dan policy-nya dengan menjalankan migrasi yang membuatnya: pos-fnb `0055_purchase_imports.sql` (bagian storage) dan migrasi Storage di `supabase/migrations/` sistem laporan. File fotonya sendiri tidak bisa dipulihkan (lihat bagian 2).
7. Arahkan aplikasi ke proyek baru:
   - **Sistem laporan (Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, lalu redeploy.
   - **pos-fnb (Cloudflare):** nilai yang sama di `wrangler secret` atau `vars`, lalu `npm run deploy`.
   - Perbarui juga `.env.local` di kedua repo dan `POS_INTEGRASI_URL` bila alamatnya berubah.
8. Uji: login sebagai akun uji, buka laporan dan kasir, cocokkan jumlah order dan laporan terakhir dengan cadangan.
9. Hapus `C:\temp\pulih.dump`.

Catatan: langkah A–B.5 sudah diuji ke Postgres biasa (bagian 4). Pemulihan ke proyek Supabase baru (B.6–B.8) belum pernah dicoba karena butuh proyek kedua. Sebaiknya dicoba sekali sebelum penjualan nyata dimulai.
