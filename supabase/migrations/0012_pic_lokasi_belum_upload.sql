-- Task 14 (it) §7 + keputusan D2: "PIC lokasi yang BELUM mengirim foto/video
-- pembangunan" WAJIB dihitung dari tabel attachment, bukan diketik PIC IT.
--
-- IT (role kadiv+karyawan, lihat DATA-KARYAWAN.md) TIDAK punya baris di
-- can_see_report() untuk form_key='pic_lokasi' -- pola sama dengan Ronald
-- (04-CATATAN-TEKNIS.md §3.4b). View agregat security-definer + penjaga
-- boleh_lihat_rekap('it') (fungsi sudah ada, migrasi 0009).
--
-- View ini CUMA berisi lokasi + lokasi_id -- BUKAN nama PIC. Nama PIC-nya
-- diambil terpisah lewat query biasa ke assignment+profile (keduanya sudah
-- broadly readable untuk siapa pun yang login, lihat 0002_rls.sql:
-- "profile: semua yang login boleh melihat nama rekan", "asg_select ...
-- using (auth.uid() is not null)") -- TIDAK butuh security definer sama
-- sekali, dan §3.4b sendiri melarang "nama orang" lewat view security-definer.
-- Pemisahan ini menjaga view ini tetap murni "pilihan tertutup" (nama lokasi,
-- dari himpunan tetap tabel lokasi), bukan data pribadi siapa pun.
create view public.v_pic_lokasi_belum_upload_progress
with (security_invoker = off) as        -- SENGAJA off: lihat penjaga di WHERE
select distinct
  al.lokasi_id,
  l.nama as lokasi
from (
  select distinct lokasi_id from assignment
  where form_key = 'pic_lokasi' and lokasi_id is not null
) al
join lokasi l on l.id = al.lokasi_id
where public.boleh_lihat_rekap('it')                       -- PENJAGA
  and not exists (
    select 1 from report r
    join attachment att on att.report_id = r.id and att.field_key = 'progress'
    where r.form_key = 'pic_lokasi'
      and r.lokasi_id = al.lokasi_id
      and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
      and r.status <> 'draft'
  );

-- ⚠️ form_key='accounting' tidak disentuh view ini -- §3.4b syarat #3 tetap
-- berlaku untuk semua view security-definer, bukan cuma yang menyangkut
-- pembangunan.
