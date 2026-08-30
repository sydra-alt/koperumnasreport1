-- Titik absen UJI (instruksi eksplisit user, 30 Agustus 2026) -- ditandai
-- JELAS di nama baris supaya tidak pernah keliru dianggap lokasi perusahaan
-- sungguhan (pola sama dengan baris 'CONTOH -- ganti dari halaman Admin' di
-- migrasi 0022, tapi ini koordinat ASLI dari CEO untuk dicoba dari HP-nya,
-- bukan koordinat contoh dokumen). DTI TETAP ditahan, tidak disentuh.
insert into public.lokasi_absen (nama, lokasi_id, latitude, longitude, radius_meter, aktif)
values ('Lokasi Uji -- BUKAN kantor perusahaan, cuma untuk coba dari HP', null, -6.982980702734919, 107.63522500320248, 200, true);

insert into public.penugasan_absen (user_id, lokasi_absen_id)
select u.id, la.id
from auth.users u, public.lokasi_absen la
where u.email in ('putri@koperumnas.local', 'dadang@koperumnas.local')
  and la.nama = 'Lokasi Uji -- BUKAN kantor perusahaan, cuma untuk coba dari HP'
on conflict do nothing;
