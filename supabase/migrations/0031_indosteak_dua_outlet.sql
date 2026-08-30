-- Indosteak sekarang DUA outlet (Cempaka & Pekansari), bukan satu -- CEO
-- lewat user, 30 Agustus 2026. Total 3 outlet: Indokopi Jatinegara,
-- Indosteak Cempaka, Indosteak Pekansari.
--
-- Dampak nyata (diperiksa dulu sebelum diperbaiki, instruksi eksplisit
-- user): `selisih_resto_untuk_tanggal()` (migrasi 0020) dan
-- `useOmzetRestoHariIni` (lib/api/accounting.ts, jalur KLIEN terpisah dengan
-- pola SAMA) sama-sama mencocokkan kunci JSON laporan Ita lewat
-- `'omzet_' || lower(nama outlet)`. "Indosteak Cempaka".toLowerCase() punya
-- spasi (bukan kunci JSON yang valid/rapi) dan DUA outlet sekarang berbagi
-- awalan "indosteak" -- pola nama tidak lagi cukup unik/aman.
--
-- Diperiksa juga (BUKAN celah, dikonfirmasi generik, tidak disentuh):
-- `manager_resto` form (`scope:'outlet'`, tidak ada nama outlet hardcode)
-- dan `v_manager_resto_untuk_ita` (group by `outlet_id`->nama generik) --
-- keduanya otomatis benar untuk 3 outlet tanpa perubahan.
--
-- Perbaikan: kolom `slug` baru di `outlet` -- identitas stabil yang TIDAK
-- bergantung pada spasi/kapitalisasi nama tampilan, dipakai sebagai kunci
-- JSON pengganti `lower(nama)`. Live DB diperiksa dulu -- kedua outlet lama
-- (Indokopi, Indosteak) punya NOL baris `report` (belum ada karyawan
-- sungguhan pakai sistem ini) -- aman diganti nama & slug di tempat, tidak
-- ada data historis yang perlu dipindah.
alter table public.outlet add column slug text;

update public.outlet set nama = 'Indokopi Jatinegara', slug = 'indokopi_jatinegara' where nama = 'Indokopi';
update public.outlet set nama = 'Indosteak Cempaka',   slug = 'indosteak_cempaka'   where nama = 'Indosteak';
insert into public.outlet (nama, slug) values ('Indosteak Pekansari', 'indosteak_pekansari')
  on conflict (nama) do nothing;

alter table public.outlet alter column slug set not null;
alter table public.outlet add constraint outlet_slug_unique unique (slug);

-- selisih_resto_untuk_tanggal(): 'omzet_' || o.slug, bukan lower(o.nama).
create or replace function public.selisih_resto_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (outlet text, versi_manager bigint, versi_ita bigint, selisih bigint)
language sql stable as $$
  select
    o.nama,
    (mr.data->>'total_omzet')::bigint,
    (it.data->>('omzet_' || o.slug))::bigint,
    (mr.data->>'total_omzet')::bigint - (it.data->>('omzet_' || o.slug))::bigint
  from public.outlet o
  join public.report mr on mr.form_key = 'manager_resto' and mr.outlet_id = o.id
                        and mr.tanggal = p_tanggal and mr.status <> 'draft'
  join public.report it on it.form_key = 'ita' and it.tanggal = p_tanggal and it.status <> 'draft';
$$;
