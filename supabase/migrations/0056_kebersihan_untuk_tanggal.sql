-- Tinjau Kebersihan (halaman CEO/pusat/HRD kadiv) SELAMA INI cuma
-- menampilkan outlet yang SUDAH punya baris `report` untuk tanggal itu --
-- outlet yang belum melapor sama sekali TIDAK PERNAH terlihat, padahal
-- justru itu yang paling perlu dilihat. Instruksi eksplisit CEO, 11
-- September 2026 -- pelajaran yang SAMA dengan `presensi_untuk_tanggal`
-- (migrasi 0041): "yang tidak ada datanya justru yang paling perlu
-- kelihatan".
--
-- `kebersihan_untuk_tanggal`: satu baris per OUTLET AKTIF per tanggal
-- (bukan per report) -- LEFT JOIN ke report+attachment, sama pola dengan
-- presensi_untuk_tanggal (LEFT JOIN dari profile ke absensi). Outlet
-- tanpa report untuk tanggal itu tetap muncul dengan report_id/status/
-- submitted_at NULL dan foto '[]' -- klien merender ini sebagai rail
-- merah "0 dari 5 foto".
--
-- BUKAN security definer -- fungsi biasa `language sql` berjalan dengan
-- hak PEMANGGIL: outlet_select terbuka untuk siapa pun login (migrasi
-- 0002), report_select/att_select dibatasi can_see_report (ceo/pusat
-- lihat kebersihan penuh, migrasi 0002+0053) -- sama pola persis
-- presensi_untuk_tanggal, bukan celah akses baru.
create or replace function public.kebersihan_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  outlet_id     uuid,
  outlet_nama   text,
  report_id     uuid,
  status        report_status,
  submitted_at  timestamptz,
  foto          jsonb
)
language sql stable as $$
  select
    o.id,
    o.nama,
    r.id,
    r.status,
    r.submitted_at,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'slot', a.field_key,
          'path', a.path,
          'created_at', a.created_at,
          'uploaded_by_nama', pr.nama
        ) order by a.created_at)
       from public.attachment a
       left join public.profile pr on pr.id = a.uploaded_by
       where a.report_id = r.id),
      '[]'::jsonb
    )
  from public.outlet o
  left join public.report r
    on r.outlet_id = o.id and r.form_key = 'kebersihan' and r.tanggal = p_tanggal
  where o.aktif
  order by o.nama;
$$;
