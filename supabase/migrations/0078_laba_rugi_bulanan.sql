-- 0078 -- Laba Rugi Bulanan terintegrasi (Oktober 2026, docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §3, §3a).
--
-- Mendukung Laba Rugi Bulanan terintegrasi antara reportkoperumnasgroup dan pos-fnb:
-- 1. kategori_biaya: kategori biaya bulanan berurutan (Sewa, Gaji, Gaji non cash, Listrik, Gas, Internet, Operasional, Administrasi, Lainnya).
-- 2. biaya_bulanan: pencatatan biaya bulanan per outlet per bulan oleh Akunting, dengan riwayat perubahan.
-- 3. laporan_bulanan: status alur laba rugi per outlet per bulan (Draft -> Ditinjau Ita -> Final Akunting).
--    CEO hanya melihat status Final Akunting. Pembukaan kembali oleh CEO/Admin dengan alasan tercatat.
-- 4. laporan_bulanan_manual: pencatatan angka omzet & modal manual untuk outlet yang belum memakai POS.
-- 5. Trigger kekekalan: saat laporan berstatus final_akunting, biaya dan angka manual terkunci tidak dapat diubah/dihapus.
-- 6. Hak akses & bucket storage bukti biaya.

begin;

-- 1. Kategori Biaya
create table if not exists public.kategori_biaya (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique check (char_length(nama) <= 100),
  urutan integer not null default 0,
  aktif boolean not null default true
);

alter table public.kategori_biaya enable row level security;

-- 2. Fungsi Hak Akses Laba Rugi
create or replace function public.boleh_lihat_laba_rugi()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_kontrol_fnb()
      or public.has_role('accounting')
      or exists (
        select 1 from public.profile p
        where p.id = auth.uid() and p.aktif and p.akses_semua_outlet_pos
      );
$$;

create or replace function public.boleh_ubah_biaya_bulanan()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_role('accounting');
$$;

create or replace function public.boleh_tinjau_laba_rugi()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_kontrol_fnb()
      or exists (
        select 1 from public.profile p
        where p.id = auth.uid() and p.aktif and p.akses_semua_outlet_pos
      );
$$;

create or replace function public.boleh_finalkan_laba_rugi()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_role('accounting');
$$;

create or replace function public.boleh_buka_kembali_laba_rugi()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

revoke all on function public.boleh_lihat_laba_rugi() from public, anon;
grant execute on function public.boleh_lihat_laba_rugi() to authenticated;

revoke all on function public.boleh_ubah_biaya_bulanan() from public, anon;
grant execute on function public.boleh_ubah_biaya_bulanan() to authenticated;

revoke all on function public.boleh_tinjau_laba_rugi() from public, anon;
grant execute on function public.boleh_tinjau_laba_rugi() to authenticated;

revoke all on function public.boleh_finalkan_laba_rugi() from public, anon;
grant execute on function public.boleh_finalkan_laba_rugi() to authenticated;

revoke all on function public.boleh_buka_kembali_laba_rugi() from public, anon;
grant execute on function public.boleh_buka_kembali_laba_rugi() to authenticated;

-- Policies kategori_biaya
drop policy if exists kb_baca on public.kategori_biaya;
create policy kb_baca on public.kategori_biaya for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists kb_tulis on public.kategori_biaya;
create policy kb_tulis on public.kategori_biaya for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed kategori biaya default
insert into public.kategori_biaya (nama, urutan, aktif) values
  ('Sewa', 10, true),
  ('Gaji', 20, true),
  ('Gaji non cash', 30, true),
  ('Listrik', 40, true),
  ('Gas', 50, true),
  ('Internet', 60, true),
  ('Operasional', 70, true),
  ('Administrasi', 80, true),
  ('Lainnya', 90, true)
on conflict (nama) do nothing;

-- 3. Biaya Bulanan
create table if not exists public.biaya_bulanan (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlet(id),
  bulan text not null check (bulan ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kategori_id uuid not null references public.kategori_biaya(id),
  jumlah bigint not null default 0 check (jumlah >= 0),
  catatan text not null default '' check (char_length(catatan) <= 2000),
  bukti_path text check (bukti_path is null or char_length(bukti_path) <= 500),
  created_by uuid not null default auth.uid() references public.profile(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references public.profile(id),
  updated_at timestamptz not null default now(),
  constraint uq_biaya_bulanan unique (outlet_id, bulan, kategori_id)
);

alter table public.biaya_bulanan enable row level security;

-- 4. Biaya Bulanan Riwayat
create table if not exists public.biaya_bulanan_riwayat (
  id uuid primary key default gen_random_uuid(),
  biaya_id uuid not null references public.biaya_bulanan(id) on delete cascade,
  outlet_id uuid not null references public.outlet(id),
  bulan text not null,
  kategori_nama text not null,
  jumlah_lama bigint,
  jumlah_baru bigint,
  catatan_lama text,
  catatan_baru text,
  diubah_oleh uuid not null default auth.uid() references public.profile(id),
  diubah_pada timestamptz not null default now()
);

alter table public.biaya_bulanan_riwayat enable row level security;

-- 5. Laporan Bulanan (Alur Status)
create table if not exists public.laporan_bulanan (
  outlet_id uuid not null references public.outlet(id),
  bulan text not null check (bulan ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'draft' check (status in ('draft', 'ditinjau_ita', 'final_akunting')),
  sumber text not null default 'pos' check (sumber in ('pos', 'manual')),
  catatan_ita text not null default '' check (char_length(catatan_ita) <= 2000),
  catatan_akunting text not null default '' check (char_length(catatan_akunting) <= 2000),
  catatan_kualitas_data text not null default '' check (char_length(catatan_kualitas_data) <= 2000),
  ditinjau_oleh uuid references public.profile(id),
  ditinjau_pada timestamptz,
  difinalkan_oleh uuid references public.profile(id),
  difinalkan_pada timestamptz,
  dibuka_kembali_oleh uuid references public.profile(id),
  dibuka_kembali_pada timestamptz,
  alasan_buka_kembali text check (alasan_buka_kembali is null or char_length(alasan_buka_kembali) <= 2000),
  primary key (outlet_id, bulan)
);

alter table public.laporan_bulanan enable row level security;

-- 6. Laporan Bulanan Riwayat Status
create table if not exists public.laporan_bulanan_riwayat_status (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlet(id),
  bulan text not null,
  status_sebelum text not null,
  status_sesudah text not null,
  alasan text not null default '',
  diubah_oleh uuid not null default auth.uid() references public.profile(id),
  diubah_pada timestamptz not null default now()
);

alter table public.laporan_bulanan_riwayat_status enable row level security;

-- 7. Laporan Bulanan Manual
create table if not exists public.laporan_bulanan_manual (
  outlet_id uuid not null references public.outlet(id),
  bulan text not null check (bulan ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  omzet_makanan bigint not null default 0 check (omzet_makanan >= 0),
  omzet_minuman bigint not null default 0 check (omzet_minuman >= 0),
  omzet_thrift bigint not null default 0 check (omzet_thrift >= 0),
  hpp_makanan bigint not null default 0 check (hpp_makanan >= 0),
  hpp_minuman bigint not null default 0 check (hpp_minuman >= 0),
  hpp_thrift bigint not null default 0 check (hpp_thrift >= 0),
  stok_awal_thrift bigint not null default 0 check (stok_awal_thrift >= 0),
  pembelian_thrift bigint not null default 0 check (pembelian_thrift >= 0),
  stok_akhir_thrift bigint not null default 0 check (stok_akhir_thrift >= 0),
  catatan text not null default '' check (char_length(catatan) <= 2000),
  diisi_oleh uuid not null default auth.uid() references public.profile(id),
  diisi_pada timestamptz not null default now(),
  primary key (outlet_id, bulan)
);

alter table public.laporan_bulanan_manual enable row level security;

-- 8. Policies RLS
-- biaya_bulanan
drop policy if exists bb_baca on public.biaya_bulanan;
create policy bb_baca on public.biaya_bulanan for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists bb_tambah on public.biaya_bulanan;
create policy bb_tambah on public.biaya_bulanan for insert to authenticated
  with check (public.boleh_ubah_biaya_bulanan());

drop policy if exists bb_ubah on public.biaya_bulanan;
create policy bb_ubah on public.biaya_bulanan for update to authenticated
  using (public.boleh_ubah_biaya_bulanan()) with check (public.boleh_ubah_biaya_bulanan());

drop policy if exists bb_hapus on public.biaya_bulanan;
create policy bb_hapus on public.biaya_bulanan for delete to authenticated
  using (public.boleh_ubah_biaya_bulanan());

-- biaya_bulanan_riwayat
drop policy if exists bbr_baca on public.biaya_bulanan_riwayat;
create policy bbr_baca on public.biaya_bulanan_riwayat for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists bbr_tambah on public.biaya_bulanan_riwayat;
create policy bbr_tambah on public.biaya_bulanan_riwayat for insert to authenticated
  with check (public.boleh_ubah_biaya_bulanan());

-- laporan_bulanan
drop policy if exists lb_baca on public.laporan_bulanan;
create policy lb_baca on public.laporan_bulanan for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists lb_tulis on public.laporan_bulanan;
create policy lb_tulis on public.laporan_bulanan for insert to authenticated
  with check (public.boleh_lihat_laba_rugi());

drop policy if exists lb_ubah on public.laporan_bulanan;
create policy lb_ubah on public.laporan_bulanan for update to authenticated
  using (public.boleh_lihat_laba_rugi()) with check (public.boleh_lihat_laba_rugi());

-- laporan_bulanan_riwayat_status
drop policy if exists lbr_baca on public.laporan_bulanan_riwayat_status;
create policy lbr_baca on public.laporan_bulanan_riwayat_status for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists lbr_tambah on public.laporan_bulanan_riwayat_status;
create policy lbr_tambah on public.laporan_bulanan_riwayat_status for insert to authenticated
  with check (public.boleh_lihat_laba_rugi());

-- laporan_bulanan_manual
drop policy if exists lbm_baca on public.laporan_bulanan_manual;
create policy lbm_baca on public.laporan_bulanan_manual for select to authenticated
  using (public.boleh_lihat_laba_rugi());

drop policy if exists lbm_tambah on public.laporan_bulanan_manual;
create policy lbm_tambah on public.laporan_bulanan_manual for insert to authenticated
  with check (public.boleh_ubah_biaya_bulanan());

drop policy if exists lbm_ubah on public.laporan_bulanan_manual;
create policy lbm_ubah on public.laporan_bulanan_manual for update to authenticated
  using (public.boleh_ubah_biaya_bulanan()) with check (public.boleh_ubah_biaya_bulanan());

drop policy if exists lbm_hapus on public.laporan_bulanan_manual;
create policy lbm_hapus on public.laporan_bulanan_manual for delete to authenticated
  using (public.boleh_ubah_biaya_bulanan());

-- 9. Trigger Kekekalan saat Status Final Akunting
create or replace function public.check_laporan_bulanan_immutability()
returns trigger language plpgsql as $$
declare
  v_status text;
begin
  select status into v_status
  from public.laporan_bulanan
  where outlet_id = coalesce(OLD.outlet_id, NEW.outlet_id)
    and bulan = coalesce(OLD.bulan, NEW.bulan);

  if v_status = 'final_akunting' then
    raise exception 'BULAN_FINAL: Laba rugi outlet ini untuk bulan % sudah Final Akunting (terkunci). Data tidak dapat diubah.', coalesce(OLD.bulan, NEW.bulan);
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_biaya_bulanan_immutable on public.biaya_bulanan;
create trigger trg_biaya_bulanan_immutable
before insert or update or delete on public.biaya_bulanan
for each row execute function public.check_laporan_bulanan_immutability();

drop trigger if exists trg_laporan_manual_immutable on public.laporan_bulanan_manual;
create trigger trg_laporan_manual_immutable
before insert or update or delete on public.laporan_bulanan_manual
for each row execute function public.check_laporan_bulanan_immutability();

-- 10. Storage Bucket untuk bukti biaya bulanan
insert into storage.buckets (id, name, public)
values ('biaya_bulanan', 'biaya_bulanan', false)
on conflict (id) do nothing;

drop policy if exists biaya_bukti_upload on storage.objects;
create policy biaya_bukti_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'biaya_bulanan' and public.boleh_ubah_biaya_bulanan());

drop policy if exists biaya_bukti_read on storage.objects;
create policy biaya_bukti_read on storage.objects for select to authenticated
  using (bucket_id = 'biaya_bulanan' and public.boleh_lihat_laba_rugi());

commit;
