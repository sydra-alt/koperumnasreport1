-- 04-CATATAN-TEKNIS.md §3.4b: view agregat lintas divisi -- opsi (d), bukan
-- melebarkan can_see_report(). Kepala Pembangunan butuh ANGKA dari laporan
-- pic_lokasi, bukan ISINYA (keluhan konsumen, nama, permintaan keputusan CEO).
--
-- Pola sama dengan v_keuangan_rekap: Ibu Sabrina tidak diberi akses baris
-- laporan Accounting, cuma view berisi 4 angka. Ronald diperlakukan sama.

-- Boleh melihat rekap kalau ceo, pusat, atau memang ditugaskan mengisi form
-- yang membutuhkannya (mis. Ronald ditugaskan form_key='pembangunan').
create or replace function public.boleh_lihat_rekap(untuk_form text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
       public.has_role('ceo')
    or public.has_role('pusat')
    or exists (select 1 from assignment a
               where a.user_id = auth.uid() and a.form_key = untuk_form);
$$;

-- v_pembangunan_per_lokasi (migrasi 0008) diganti total: security_invoker
-- dimatikan SENGAJA (lihat penjaga boleh_lihat_rekap di WHERE), dan kolomnya
-- diperluas mencakup rekap material + kondisi infrastruktur -- TAPI HANYA
-- angka/status terstruktur (int, boolean, enum pendek dari field `pilih`),
-- TIDAK PERNAH teks bebas atau isi array (§3.4b syarat #1):
--   - `material_kurang` (array berisi nama material & catatan bebas per baris)
--     diringkas jadi JUMLAH baris saja (material_kurang_jumlah), bukan isinya.
--   - `kiriman_kekurangan` dan `infrastruktur_kebutuhan` (teks_panjang bebas)
--     TIDAK dimasukkan sama sekali -- tidak ada padanan angka yang aman.
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
  bool_or((r.data->>'material_cukup') = 'ya')                as material_cukup,
  sum(
    case when jsonb_typeof(r.data->'material_kurang') = 'array'
         then jsonb_array_length(r.data->'material_kurang')
         else 0 end
  )                                                          as material_kurang_jumlah,
  sum((r.data->>'kiriman_precast_jumlah')::int)              as kiriman_precast_jumlah,
  max(r.data->>'jalan_status')                               as jalan_status,
  max(r.data->>'listrik_status')                             as listrik_status,
  max(r.data->>'air_status')                                 as air_status,
  bool_or((r.data->>'drainase_baik') = 'ya')                  as drainase_baik,
  bool_or((r.data->>'penerangan_baik') = 'ya')                as penerangan_baik,
  bool_or((r.data->>'gerbang_baik') = 'ya')                   as gerbang_baik
from report r
join lokasi l on l.id = r.lokasi_id
where r.form_key = 'pic_lokasi'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('pembangunan')                -- PENJAGA
group by l.nama;

-- Kunci JSON (target_unit, unit_dibangun, unit_finishing, unit_selesai,
-- unit_belum_mulai, material_cukup, material_kurang, kiriman_precast_jumlah,
-- jalan_status, listrik_status, air_status, drainase_baik, penerangan_baik,
-- gerbang_baik) adalah KONTRAK dengan forms/f13-pic-lokasi.ts. Jangan ganti
-- namanya tanpa mengganti field key di sana juga.
--
-- ⚠️ form_key='accounting' TIDAK BOLEH menjadi sumber view mana pun selain
-- v_keuangan_rekap yang sudah ada -- §3.4b syarat #3. Jangan pernah
-- menambahkannya ke view ini atau view security-definer lain.
