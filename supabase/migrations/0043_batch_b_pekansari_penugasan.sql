-- Batch B (instruksi CEO): titik absen Indosteak Pekansari + penugasan
-- outlet karyawan resto (31 Agustus 2026).
--
-- Sebelum ini dijalankan, diverifikasi lebih dulu (dilaporkan ke CEO,
-- bukan ditebak) bahwa `manager_resto`/`kontrol_fnb`/`selisih_resto_untuk_tanggal`
-- SUDAH generik terhadap jumlah outlet (migrasi 0036/0037) -- outlet
-- "Indokopi Lite Kemayoran" SUDAH ADA di tabel `outlet` (dibuat lewat
-- Admin sebelum sesi ini, bukan bagian migrasi ini) dan otomatis akan
-- muncul di kedua form serta cross-check tanpa perubahan kode.
--
-- Titik absen (lokasi_absen) BEDA dari outlet (form/laporan) -- outlet
-- "Indosteak Pekansari" sudah ada sejak migrasi 0031, tapi belum punya
-- TITIK ABSEN sendiri (karyawannya belum bisa absen di sana sama sekali).
insert into public.lokasi_absen (nama, lokasi_id, latitude, longitude, radius_meter, aktif)
values ('Indosteak Pekansari', null, -6.489506198837601, 106.8339425173476, 200, true);

-- Penugasan titik absen per orang (instruksi CEO eksplisit) -- Fikri/Fadil
-- SUDAH ditugaskan ke "Indokopi (Jatinegara)" sebelumnya, TIDAK disentuh
-- lagi di sini (idempoten by construction lewat `on conflict do nothing`,
-- bukan diasumsikan).
insert into public.penugasan_absen (user_id, lokasi_absen_id, jam_masuk, jam_pulang)
select p.id, la.id, null, null
from public.profile p, public.lokasi_absen la
where (p.nama, la.nama) in (
  ('Qasim', 'Indosteak cempaka putih'),
  ('Ahmad', 'Indosteak cempaka putih'),
  ('Ryan',  'Indosteak cempaka putih'),
  ('Toni',  'Indosteak cempaka putih'),
  ('Toni',  'Indokopi (Jatinegara)'),
  ('Lusy',  'Indosteak Pekansari'),
  ('Cuko',  'Indosteak Pekansari')
)
on conflict (user_id, lokasi_absen_id) do nothing;

-- Toni -> titik absen "Indokopi Lite Kemayoran" DAN penugasan manager_resto
-- sementara untuk outlet itu SENGAJA BELUM disertakan di migrasi ini:
-- (1) koordinat titik absen Kemayoran belum diberikan CEO -- tidak boleh
--     ditebak (lokasi presensi sungguhan, bukan angka kosmetik);
-- (2) CEO bilang Toni "sudah pegang" Cempaka Putih & Jatinegara -- tapi
--     `assignment` manager_resto KEDUA outlet itu sekarang milik Dea/Erry
--     (dikonfirmasi CEO sendiri sebelumnya, lihat docs/PROGRESS.md "Manager
--     sungguhan (tebakan Ryan/Toni dicabut CEO sendiri)"). Menambah role
--     manager_resto + assignment Toni di sana TANPA konfirmasi ulang
--     berisiko diam-diam menduakan tanggung jawab pelaporan outlet yang
--     sudah dikonfirmasi jelas pemiliknya. Ditanyakan balik ke CEO, bukan
--     ditebak.
