-- 04-CATATAN-TEKNIS.md §3.4b syarat #1, DIPERBAIKI user (23 Agustus 2026):
-- patokannya bukan "hanya angka", tapi "apakah isinya bisa ditebak". Tabel
-- terstruktur yang memang dibutuhkan (mis. daftar material kurang: nama,
-- jumlah, tanggal dibutuhkan) BOLEH masuk view -- Ronald perlu tahu material
-- APA yang kurang, bukan cuma berapa banyak jenisnya, supaya bisa memesan.
-- `infrastruktur_kebutuhan` dan `kiriman_kekurangan` TETAP ditutup -- keduanya
-- field teks bebas, isinya tidak bisa dijamin.
--
-- `material_kurang_jumlah` (migrasi 0009) diganti `material_kurang` --
-- jsonb array DIREKONSTRUKSI per elemen (bukan diteruskan mentah) supaya
-- kunci-nya dijamin cuma 4 yang di-whitelist, kalau suatu saat form
-- menambah kolom baru di tabel itu, view ini TIDAK otomatis ikut membocorkannya.

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
  coalesce(jsonb_agg(mk.item) filter (where mk.item is not null), '[]'::jsonb) as material_kurang,
  sum((r.data->>'kiriman_precast_jumlah')::int)              as kiriman_precast_jumlah,
  max(r.data->>'jalan_status')                               as jalan_status,
  max(r.data->>'listrik_status')                             as listrik_status,
  max(r.data->>'air_status')                                 as air_status,
  bool_or((r.data->>'drainase_baik') = 'ya')                 as drainase_baik,
  bool_or((r.data->>'penerangan_baik') = 'ya')               as penerangan_baik,
  bool_or((r.data->>'gerbang_baik') = 'ya')                  as gerbang_baik
from report r
join lokasi l on l.id = r.lokasi_id
-- Rekonstruksi tiap elemen material_kurang dengan WHITELIST 4 kunci saja --
-- kalau r.data->'material_kurang' bukan array (kosong/tidak ada), fallback
-- ke '[]' supaya jsonb_array_elements tidak pernah error.
left join lateral (
  select jsonb_build_object(
    'material',           e->>'material',
    'kebutuhan',          e->>'kebutuhan',
    'untuk_unit',         e->>'untuk_unit',
    'dibutuhkan_tanggal', e->>'dibutuhkan_tanggal'
  ) as item
  from jsonb_array_elements(
    case when jsonb_typeof(r.data->'material_kurang') = 'array'
         then r.data->'material_kurang'
         else '[]'::jsonb end
  ) as e
) mk on true
where r.form_key = 'pic_lokasi'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('pembangunan')                -- PENJAGA
group by l.nama;

-- Kunci JSON (target_unit, unit_dibangun, unit_finishing, unit_selesai,
-- unit_belum_mulai, material_cukup, material_kurang{material,kebutuhan,
-- untuk_unit,dibutuhkan_tanggal}, kiriman_precast_jumlah, jalan_status,
-- listrik_status, air_status, drainase_baik, penerangan_baik, gerbang_baik)
-- adalah KONTRAK dengan forms/f13-pic-lokasi.ts. Jangan ganti namanya tanpa
-- mengganti field key di sana juga.
--
-- ⚠️ TETAP DI LUAR view ini, SELAMANYA (teks bebas, §3.4b syarat #1):
-- infrastruktur_kebutuhan, kiriman_kekurangan, dan seluruh field lain di
-- pic_lokasi yang bertipe teks/teks_panjang bebas (keperluan_konsumen,
-- keluhan_tindak_lanjut, kavling_bermasalah, dst.).
--
-- ⚠️ form_key='accounting' TIDAK BOLEH menjadi sumber view mana pun selain
-- v_keuangan_rekap yang sudah ada -- §3.4b syarat #3.
