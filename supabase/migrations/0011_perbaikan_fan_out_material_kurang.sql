-- Perbaikan BUG ditemukan saat menjalankan uji umpan "RAHASIA" ulang setelah
-- 0010: `left join lateral (jsonb_array_elements(...)) mk on true` MENGGANDAKAN
-- baris `r` sebanyak jumlah elemen `material_kurang` SEBELUM `group by`
-- dijalankan -- akibatnya `sum((r.data->>'target_unit')::int)` dkk. ikut
-- terlipat-ganda (lokasi dengan 2 baris material kurang membuat target_unit
-- 10 terbaca 20). Classic SQL fan-out trap: join satu-ke-banyak sebelum
-- agregat di kolom yang seharusnya satu-ke-satu per baris sumber.
--
-- Diperbaiki: material_kurang direkonstruksi lewat SUBQUERY BERKORELASI
-- (bukan JOIN) di dalam SELECT list -- ini tidak menggandakan baris `r` sama
-- sekali, tetap satu nilai jsonb per baris. Postgres tidak punya agregat
-- max(jsonb) bawaan (dicek langsung: "function max(jsonb) does not exist"),
-- jadi dibungkus max(...::text)::jsonb -- aman karena cuma ada SATU nilai
-- per grup (report_uniq menjamin 1 baris pic_lokasi per lokasi per hari).

drop view if exists public.v_pembangunan_per_lokasi;
create view public.v_pembangunan_per_lokasi
with (security_invoker = off) as        -- SENGAJA off: lihat penjaga di WHERE
select
  l.nama                                                    as lokasi,
  sum((r.data->>'target_unit')::int)                        as target,
  sum((r.data->>'unit_dibangun')::int)                      as sedang_dibangun,
  sum((r.data->>'unit_finishing')::int)                     as finishing,
  sum((r.data->>'unit_selesai')::int)                       as selesai_hari_ini,
  sum((r.data->>'unit_belum_mulai')::int)                   as belum_mulai,
  bool_or((r.data->>'material_cukup') = 'ya')               as material_cukup,
  max((
    select coalesce(jsonb_agg(jsonb_build_object(
      'material',           e->>'material',
      'kebutuhan',          e->>'kebutuhan',
      'untuk_unit',         e->>'untuk_unit',
      'dibutuhkan_tanggal', e->>'dibutuhkan_tanggal'
    )), '[]'::jsonb)
    from jsonb_array_elements(
      case when jsonb_typeof(r.data->'material_kurang') = 'array'
           then r.data->'material_kurang'
           else '[]'::jsonb end
    ) as e
  )::text)::jsonb                                           as material_kurang,
  sum((r.data->>'kiriman_precast_jumlah')::int)              as kiriman_precast_jumlah,
  max(r.data->>'jalan_status')                               as jalan_status,
  max(r.data->>'listrik_status')                             as listrik_status,
  max(r.data->>'air_status')                                 as air_status,
  bool_or((r.data->>'drainase_baik') = 'ya')                 as drainase_baik,
  bool_or((r.data->>'penerangan_baik') = 'ya')                as penerangan_baik,
  bool_or((r.data->>'gerbang_baik') = 'ya')                   as gerbang_baik
from report r
join lokasi l on l.id = r.lokasi_id
where r.form_key = 'pic_lokasi'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('pembangunan')                -- PENJAGA
group by l.nama;

-- Kunci JSON: sama seperti 0010 -- lihat komentar di sana untuk daftar
-- lengkap kontrak dengan forms/f13-pic-lokasi.ts, dan daftar field teks
-- bebas yang TETAP di luar view ini selamanya.
