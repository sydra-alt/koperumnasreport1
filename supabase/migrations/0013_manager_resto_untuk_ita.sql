-- Task 16: Ita butuh angka dari laporan Manager Resto tanpa membaca isi
-- lengkapnya (masalah karyawan, komplain customer, dst.) -- Ita TIDAK punya
-- baris can_see_report() ke form_key='manager_resto'. Pola §3.4b, sama
-- seperti v_pembangunan_per_lokasi.
--
-- Dipakai DUA blok Ita:
--   - blok "Kontrol Stok Restoran" (silang-cek, dipertahankan sebagai isian
--     Ita sendiri -- angka Manager cuma ditampilkan berdampingan utk
--     dibandingkan)
--   - blok "Kebutuhan Stok/RAB" (rollup BACA-SAJA -- Ita tidak mengetik ulang)
--
-- Kolom stok_habis/stok_akan_habis direkonstruksi dengan whitelist (sama
-- pola dengan material_kurang di v_pembangunan_per_lokasi) -- BUKAN kolom
-- teks bebas manager_resto yang mana pun, karena manager_resto memang
-- SENGAJA didesain memakai tabel terstruktur (bukan teks bebas) tepat
-- supaya bisa lewat view ini (lihat komentar di forms/f16-manager-resto.ts).
create view public.v_manager_resto_untuk_ita
with (security_invoker = off) as        -- SENGAJA off: lihat penjaga di WHERE
select
  o.nama                                                      as outlet,
  bool_or((r.data->>'ada_selisih_stok') = 'ya')                as ada_selisih_stok,
  sum(
    case when jsonb_typeof(r.data->'selisih_stok') = 'array'
         then jsonb_array_length(r.data->'selisih_stok')
         else 0 end
  )                                                            as jumlah_item_selisih,
  max((
    select coalesce(jsonb_agg(jsonb_build_object(
      'barang', e->>'barang', 'jumlah', e->>'jumlah', 'satuan', e->>'satuan'
    )), '[]'::jsonb)
    from jsonb_array_elements(
      case when jsonb_typeof(r.data->'stok_habis') = 'array'
           then r.data->'stok_habis' else '[]'::jsonb end
    ) as e
  )::text)::jsonb                                              as stok_habis,
  max((
    select coalesce(jsonb_agg(jsonb_build_object(
      'barang', e->>'barang', 'jumlah', e->>'jumlah', 'satuan', e->>'satuan',
      'kebutuhan_tanggal', e->>'kebutuhan_tanggal'
    )), '[]'::jsonb)
    from jsonb_array_elements(
      case when jsonb_typeof(r.data->'stok_akan_habis') = 'array'
           then r.data->'stok_akan_habis' else '[]'::jsonb end
    ) as e
  )::text)::jsonb                                              as stok_akan_habis
from report r
join outlet o on o.id = r.outlet_id
where r.form_key = 'manager_resto'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('ita')                          -- PENJAGA
group by o.nama;

-- Kunci JSON (ada_selisih_stok, selisih_stok, stok_habis{barang,jumlah,satuan},
-- stok_akan_habis{barang,jumlah,satuan,kebutuhan_tanggal}) adalah KONTRAK
-- dengan forms/f16-manager-resto.ts. Jangan ganti namanya tanpa mengganti
-- field key di sana juga.
--
-- ⚠️ form_key='accounting' tidak disentuh view ini -- §3.4b syarat #3.
