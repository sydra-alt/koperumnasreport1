-- 0074 -- Kontrol Harian (7 Oktober 2026, docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §2).
--
-- Data stok & penjualan datang dari POS (pos-fnb /api/integrasi/kontrol-harian, ditarik
-- Route Handler app/api/kontrol-harian). Di database ini hanya:
--   1. Hak akses (keputusan CEO, 7 Oktober 2026): Ita (penugasan form kontrol_fnb), CEO
--      dan Admin boleh MENGUBAH catatan; pusat & accounting hanya MELIHAT.
--   2. kontrol_harian_catatan: penyebab & tindakan per outlet per tanggal, ditulis Ita.
--   3. kontrol_harian_uang(tanggal): uang masuk per outlet = isian cash/qris/bank di
--      Laporan Harian Kontrol F&B Ita (field yang SUDAH ADA, bukan input baru). HANYA tiga
--      angka itu + status laporan, untuk penonton yang boleh melihat Kontrol Harian --
--      bukan akses ke isi laporan lain (Admin tidak bisa membaca laporan kontrol_fnb lewat
--      report_select, dan tetap tidak bisa).
--
-- ADITIF: tiga fungsi baru, satu tabel baru, satu fungsi data. Tidak ada yang diubah/dihapus.

begin;

create or replace function public.is_kontrol_fnb()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assignment a where a.user_id = auth.uid() and a.form_key = 'kontrol_fnb');
$$;

create or replace function public.boleh_ubah_kontrol_harian()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_kontrol_fnb();
$$;

create or replace function public.boleh_lihat_kontrol_harian()
returns boolean language sql stable security definer set search_path = public as $$
  select public.boleh_ubah_kontrol_harian() or public.has_role('pusat') or public.has_role('accounting');
$$;

create table public.kontrol_harian_catatan (
  outlet_id   uuid not null references public.outlet(id),
  tanggal     date not null,
  penyebab    text not null default '' check (char_length(penyebab) <= 2000),
  tindakan    text not null default '' check (char_length(tindakan) <= 2000),
  diubah_oleh uuid not null default auth.uid() references public.profile(id),
  diubah_pada timestamptz not null default now(),
  primary key (outlet_id, tanggal)
);
alter table public.kontrol_harian_catatan enable row level security;
create policy khc_baca on public.kontrol_harian_catatan for select using (public.boleh_lihat_kontrol_harian());
create policy khc_tambah on public.kontrol_harian_catatan for insert
  with check (public.boleh_ubah_kontrol_harian() and diubah_oleh = auth.uid());
create policy khc_ubah on public.kontrol_harian_catatan for update
  using (public.boleh_ubah_kontrol_harian())
  with check (public.boleh_ubah_kontrol_harian() and diubah_oleh = auth.uid());

-- Uang masuk per outlet dari Laporan Kontrol F&B tanggal itu. status = status laporan
-- ('draft'/'terkirim'/'terlambat'); null = belum ada laporan. Field kosong/bukan angka -> null.
create or replace function public.kontrol_harian_uang(p_tanggal date)
returns table (outlet_id uuid, outlet_nama text, pos_outlet_id uuid, status_laporan text, cash bigint, qris bigint, bank bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.boleh_lihat_kontrol_harian() then
    raise exception 'TIDAK_BERHAK';
  end if;
  return query
    select o.id, o.nama, m.pos_outlet_id, r.status::text,
      case when jsonb_typeof(r.data->'cash') = 'number' then round((r.data->>'cash')::numeric)::bigint end,
      case when jsonb_typeof(r.data->'qris') = 'number' then round((r.data->>'qris')::numeric)::bigint end,
      case when jsonb_typeof(r.data->'bank') = 'number' then round((r.data->>'bank')::numeric)::bigint end
    from public.outlet_pos_map m
    join public.outlet o on o.id = m.outlet_id
    left join lateral (
      select rr.status, rr.data from public.report rr
      where rr.form_key = 'kontrol_fnb' and rr.outlet_id = o.id and rr.tanggal = p_tanggal
      order by (rr.status <> 'draft') desc, rr.submitted_at desc nulls last, rr.created_at desc
      limit 1
    ) r on true
    where not m.diabaikan;
end
$$;
revoke all on function public.kontrol_harian_uang(date) from public;
grant execute on function public.kontrol_harian_uang(date) to authenticated;

commit;
