-- Rotasi Indokopi Jatinegara <-> Kemayoran (CEO, 6 September 2026): Toni,
-- Fikri, Fadil bertugas bergantian di kedua outlet -- ketiganya butuh titik
-- absen di KEDUA tempat supaya bisa absen di outlet mana pun mereka
-- ditugaskan hari itu, sistem sendiri yang memilih titik terdekat
-- (`urutkanTitikTerdekat`, lib/absen.ts -- mekanisme ini sudah ada, tidak
-- perlu dibangun ulang).
--
-- Titik absen "Indokopi Lite Kemayoran" BELUM PERNAH dibuat -- ditahan
-- sengaja di migrasi 0043 (Batch B) karena koordinatnya belum ada. CEO
-- sekarang memberi jawabannya: SAMA DENGAN Kantor Pusat. Dibuat sebagai
-- titik BARU dengan nama sendiri (bukan menugaskan langsung ke titik
-- "Kantor Pusat" yang sudah ada) -- supaya di Tinjau Absensi/laporan tetap
-- jelas orang ini hadir di outlet Kemayoran, bukan tercampur dengan staf
-- kantor pusat yang kebetulan berbagi koordinat fisik yang sama.
insert into public.lokasi_absen (nama, lokasi_id, latitude, longitude, radius_meter, aktif)
select 'Indokopi Lite Kemayoran', null, la.latitude, la.longitude, la.radius_meter, true
from public.lokasi_absen la
where la.nama = 'Kantor Pusat';

-- Toni sudah punya titik Cempaka Putih + Jatinegara (migrasi 0043) --
-- ditambah Kemayoran di sini. Fikri/Fadil sudah punya Jatinegara --
-- ditambah Kemayoran. `on conflict do nothing` sama pola migrasi 0043,
-- aman dijalankan ulang.
insert into public.penugasan_absen (user_id, lokasi_absen_id, jam_masuk, jam_pulang)
select p.id, la.id, null, null
from public.profile p, public.lokasi_absen la
where p.nama in ('Toni', 'Fikri', 'Fadil')
  and la.nama = 'Indokopi Lite Kemayoran'
on conflict (user_id, lokasi_absen_id) do nothing;
