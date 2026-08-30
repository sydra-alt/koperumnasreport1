-- Form `ita` dipecah jadi DUA (instruksi eksplisit user, 30 Agustus 2026):
-- `thrifting` (scope global, unit usaha Ita sendiri, TIDAK berubah field-nya
-- sama sekali) dan `kontrol_fnb` (scope OUTLET, satu laporan per outlet per
-- hari -- bisa diisi lebih dari satu orang, mis. Ita di Indokopi Jatinegara,
-- Rika di dua outlet Indosteak, tanpa saling tabrak).
--
-- Ini SEKALIGUS menutup celah `'omzet_' || outlet.slug` dari Perubahan 1
-- (migrasi 0031) -- laporan `kontrol_fnb` sekarang TERIKAT KE SATU OUTLET
-- lewat `outlet_id` (persis `manager_resto`), jadi kuncinya kembali polos
-- `omzet_sistem`, tidak perlu dijahit ke nama outlet lagi.

-- ─── v_manager_resto_untuk_ita -> v_manager_resto_untuk_kontrol_fnb ────
-- Isi PERSIS SAMA (migrasi 0013) -- cuma nama view & gerbang boleh_lihat_
-- rekap() yang berubah, mengikuti form_key baru. Blok "Kontrol Stok
-- Restoran"+"Kebutuhan Stok/RAB" yang memakai view ini sekarang ada di
-- form kontrol_fnb (forms/f16-kontrol-fnb.ts), bukan lagi ita.
drop view public.v_manager_resto_untuk_ita;

create view public.v_manager_resto_untuk_kontrol_fnb
with (security_invoker = off) as
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
where r.form_key = 'manager_resto' and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft'
  and public.boleh_lihat_rekap('kontrol_fnb')                  -- PENJAGA (diganti dari 'ita')
group by o.nama;

-- ─── selisih_resto_untuk_tanggal(): join outlet_id langsung, bukan slug ─
-- Kolom output `versi_ita` -> `versi_kontrol_fnb` (rename kolom RETURNS
-- TABLE, Postgres tidak izinkan CREATE OR REPLACE utk ini -- DROP+CREATE,
-- sama seperti marketing_bulanan_untuk() di migrasi 0035).
drop function public.selisih_resto_untuk_tanggal(date);

create function public.selisih_resto_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (outlet text, versi_manager bigint, versi_kontrol_fnb bigint, selisih bigint)
language sql stable as $$
  select
    o.nama,
    (mr.data->>'total_omzet')::bigint,
    (kf.data->>'omzet_sistem')::bigint,
    (mr.data->>'total_omzet')::bigint - (kf.data->>'omzet_sistem')::bigint
  from public.outlet o
  join public.report mr on mr.form_key = 'manager_resto' and mr.outlet_id = o.id
                        and mr.tanggal = p_tanggal and mr.status <> 'draft'
  join public.report kf on kf.form_key = 'kontrol_fnb' and kf.outlet_id = o.id
                        and kf.tanggal = p_tanggal and kf.status <> 'draft';
$$;
