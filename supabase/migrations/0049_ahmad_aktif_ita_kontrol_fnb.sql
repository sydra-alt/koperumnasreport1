-- Jawaban CEO (6 September 2026):
--
-- 1. Ahmad TETAP AKTIF -- kemungkinan keluar nanti, tapi masukkan dulu.
-- 2. Mba Rika TETAP AKTIF (dibantu Ita karena "agak gaptek") -- TAPI
--    keduanya TETAP akun terpisah, tidak berbagi satu akun, supaya kalau
--    ada selisih stok jelas siapa yang mengisi. Keduanya di-assign
--    kontrol_fnb untuk KEDUA outlet Indosteak. `report_uniq` sudah
--    mendukung banyak pengisi per (form_key, tanggal, outlet) via kolom
--    author_id (diverifikasi langsung ke index-nya sebelum migrasi ini
--    ditulis) -- pola yang sama yang sudah dipakai form `cs` untuk 7
--    pengisi sekaligus. Mba Rika sudah punya assignment di kedua outlet
--    (Batch B sebelumnya) -- yang ditambah di sini cuma Ita.
update public.profile set aktif = true where nama = 'Ahmad';

insert into public.assignment (user_id, form_key, outlet_id)
select p.id, 'kontrol_fnb', o.id
from public.profile p, public.outlet o
where p.nama = 'Ita' and o.slug in ('indosteak_cempaka', 'indosteak_pekansari')
  and not exists (
    select 1 from public.assignment a
    where a.user_id = p.id and a.form_key = 'kontrol_fnb' and a.outlet_id = o.id
  );
