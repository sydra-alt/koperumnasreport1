-- Audit menyeluruh diminta user (30 Agustus 2026) setelah celah cuti_insert
-- (0026) ditemukan sendiri: "RLS insert wajib memeriksa NILAI kolom sensitif,
-- bukan cuma siapa pemiliknya. Periksa ulang seluruh insert policy lain
-- dengan kacamata itu." Diperiksa: decision, absensi, closing, pte_daily,
-- report.
--
-- DUA GAP NYATA dengan pola PERSIS SAMA dengan cuti_insert -- kolom
-- keputusan pihak lain bisa diisi bebas oleh pengaju sendiri saat insert,
-- MELEWATI RPC/policy update yang seharusnya jadi satu-satunya jalur:
--
-- 1. `decision` (dec_insert, 0002_rls.sql) -- cuma memeriksa report_id milik
--    pengirim, TIDAK memeriksa `status`/`decided_by`/`decided_at`. Karyawan
--    bisa insert baris `decision` langsung dgn status='disetujui',
--    decided_by=<uuid siapa saja>, decided_at=now() -- MEMALSUKAN keputusan
--    CEO yang belum pernah terjadi, melewati `dec_decide` (update policy yg
--    sebenarnya SUDAH benar, `using/with check (has_role('ceo'))`) sama
--    sekali. `lib/api/decision.ts` (`buatKeputusanDariLaporan`) TIDAK PERNAH
--    mengirim ketiga kolom ini -- aman diperbaiki tanpa mengubah app.
-- 2. `absensi` (absensi_insert, 0022_presensi.sql) -- cuma memeriksa
--    user_id, TIDAK memeriksa `keputusan_hrd`/`disetujui_oleh`. Karyawan
--    bisa insert baris presensi langsung dgn keputusan_hrd='diterima',
--    disetujui_oleh=<uuid siapa saja> -- MEMALSUKAN persetujuan HRD utk
--    tanda 🟡 di luar radius, melewati `putuskan_absensi()` sepenuhnya.
--    `useKirimAbsen` (lib/api/absensi.ts) TIDAK PERNAH mengirim kedua kolom
--    ini -- aman diperbaiki tanpa mengubah app. `status` ('manual_hrd' juga
--    ikut dibatasi -- nilai itu direncanakan utk entri manual HRD yang
--    BELUM dibangun jalurnya, `useKirimAbsen` cuma pernah kirim
--    'valid'/'di_luar_radius').
--
-- BUKAN gap yang sama, DIPERIKSA TAPI TIDAK DIUBAH -- dilaporkan, bukan
-- diperbaiki diam-diam, karena keduanya BEDA JENIS masalah:
--
-- - `closing`/`pte_daily` (closing_write/pte_write, 0002_rls.sql) -- TIDAK
--   punya kolom "keputusan pihak lain" sama sekali. Semua kolomnya (live,
--   undang_jumlah, status booking/akad/batal, dst.) MEMANG self-attested
--   BY DESIGN -- tidak ada peran approval terpisah di spesifikasi manapun
--   utk closing/PTE harian (beda dari cuti/absensi/decision yang punya alur
--   dua pihak eksplisit). `closing.status='akad'` memang langsung menambah
--   hitungan closing pemiliknya sendiri di marketing_bulanan_untuk() --
--   tapi itu levelnya "kepercayaan terhadap laporan sendiri", sama seperti
--   SELURUH sistem PTE (live/undangan/kesaksian dst. semuanya diketik
--   sendiri, tidak diverifikasi independen) -- risiko proses bisnis
--   perusahaan, bukan celah RLS yang bisa diperbaiki dgn WITH CHECK.
-- - `report` (report_insert/update, 0002_rls.sql) -- POLA BEDA, BUKAN
--   "kolom seharusnya tetap default sampai pihak lain memutuskan" seperti
--   3 tabel di atas. `status`/`warna`/`submitted_at` MEMANG legitimately
--   diisi SAAT insert/update oleh pengirim sendiri (itu tindakan "kirim
--   laporan"-nya) -- tapi NILAINYA dihitung di BROWSER (`apakahTerlambat()`,
--   `urgensiTerburukDariKirim()`, `lib/api/report.ts` `useKirimReport`) lalu
--   dikirim apa adanya, TIDAK diverifikasi ulang di server. Artinya
--   pengirim bisa memalsukan `submitted_at` mundur atau `status:'terkirim'`
--   padahal sebenarnya lewat batas waktu, TIDAK PERNAH tertangkap sebagai
--   'terlambat'. Perbaikannya BUKAN WITH CHECK sederhana (nilai itu MEMANG
--   boleh diisi si pengirim, bukan kolom "milik pihak lain") -- perlu
--   dihitung ULANG di server (trigger/RPC yang menimpa status/submitted_at
--   dari waktu server, bukan mempercayai payload klien). Perubahan lebih
--   besar, menyentuh SEMUA 15 form -- DILAPORKAN ke user, SENGAJA BELUM
--   dikerjakan tanpa izin eksplisit.
-- - `absensi.status` (bukan cuma keputusan_hrd) -- gap SERUPA `report` di
--   atas: `jarak_meter`/`status` ('valid' vs 'di_luar_radius') dihitung di
--   browser (`statusDariJarak`, lib/absen.ts) dari GPS yang dilaporkan
--   sendiri, tidak diverifikasi ulang terhadap koordinat `lokasi_absen` di
--   server. Karyawan bisa mengaku jarak dekat & status 'valid' walau
--   sungguhan jauh. DILAPORKAN, BELUM diperbaiki -- perlu penghitungan
--   jarak ulang di server (SQL, mis. rumus haversine), keputusan desain
--   terpisah yang lebih besar dari sekadar WITH CHECK.

drop policy dec_insert on public.decision;
create policy dec_insert on public.decision for insert with check (
  exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
  and status = 'menunggu'
  and decided_by is null
  and decided_at is null
);

drop policy absensi_insert on public.absensi;
create policy absensi_insert on public.absensi for insert with check (
  user_id = auth.uid()
  and status in ('valid', 'di_luar_radius')
  and keputusan_hrd is null
  and disetujui_oleh is null
);
