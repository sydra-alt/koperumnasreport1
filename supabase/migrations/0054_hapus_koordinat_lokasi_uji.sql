-- Hapus koordinat "Lokasi Uji" dari produksi (10 September 2026, instruksi
-- eksplisit CEO: "Itu koordinat rumahku"). Migrasi 0032 sengaja dibuat
-- SEMENTARA untuk uji absen dari HP asli sebelum koordinat kantor
-- sungguhan tersedia -- sudah lama seharusnya dibersihkan (dicatat sebagai
-- utang wajib di docs/PROGRESS.md sejak 31 Agustus 2026, baru dikerjakan
-- sekarang).
--
-- TIDAK dihapus barisnya (DELETE) -- ada 2 baris `absensi` SUNGGUHAN milik
-- Putri sendiri (masuk+pulang, 30 Agustus 2026, dengan foto asli di
-- Storage) yang merujuk ke titik ini lewat FK `absensi_lokasi_absen_id_fkey`
-- (ON DELETE NO ACTION -- DELETE baris ini akan GAGAL kecuali riwayat
-- presensi asli itu ikut dihapus dulu). Riwayat presensi milik CEO sendiri
-- BUKAN data uji yang aman dibuang begitu saja -- jadi baris `lokasi_absen`
-- dipertahankan (integritas referensial riwayat presensi Putri tetap utuh),
-- tapi NILAI KOORDINAT rumahnya diganti nilai netral, `aktif` dimatikan, dan
-- namanya diubah supaya jelas ini bekas titik uji yang sudah dibersihkan.
update public.lokasi_absen
set nama = 'Bekas titik uji (nonaktif, koordinat sudah dihapus)',
    latitude = 0,
    longitude = 0,
    radius_meter = 0,
    aktif = false
where nama like 'Lokasi Uji%';

-- Cabut SEMUA penugasan_absen ke titik ini -- Putri (CEO, dashboard-only,
-- tidak punya penugasan outlet/lokasi kerja sungguhan), badar (akun
-- dev/infra, bukan staf sungguhan), dan AKUN UJI - Tanpa Peran (uji5,
-- sengaja dipakai scripts/uji-radius-gps-palsu.mjs -- skrip itu perlu
-- titik uji GPS baru kalau dipakai lagi, TIDAK dibuat di migrasi ini,
-- di luar cakupan permintaan "hapus Lokasi Uji").
--
-- TIDAK DIPINDAHKAN ke titik lain -- baik Putri maupun badar TIDAK PUNYA
-- penugasan outlet/lokasi kerja sungguhan untuk dijadikan titik absen
-- pengganti yang benar. Dilaporkan apa adanya, bukan ditebak.
delete from public.penugasan_absen
where lokasi_absen_id = (select id from public.lokasi_absen where nama like 'Bekas titik uji%');
