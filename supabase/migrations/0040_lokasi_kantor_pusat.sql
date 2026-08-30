-- Baris `lokasi` "Kantor Pusat" -- BEDA dari `lokasi_absen` "Kantor Pusat"
-- yang sudah ada sejak batch sebelumnya (tabel `lokasi` dipakai untuk SCOPE
-- LAPORAN seperti form `security`, `lokasi_absen` dipakai untuk titik GPS
-- presensi -- dua tujuan berbeda, kebetulan nama sama). Ditahan sengaja
-- sejak DATA-KARYAWAN.md §2 ("BELUM ditambahkan, menunggu konfirmasi
-- eksplisit supaya tidak ditebak") -- CEO sudah mengonfirmasi (30 Agustus
-- 2026), sekarang ditambahkan supaya assignment `security` Cahya/Dedi/Yundi
-- bisa diselesaikan.
insert into public.lokasi (nama) values ('Kantor Pusat')
on conflict (nama) do nothing;
