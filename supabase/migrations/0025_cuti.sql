-- Cuti diatur dari web, bukan SQL (instruksi eksplisit user, 30 Agustus
-- 2026). Menutup penghalang yang tercatat sejak 22 Agustus: selama
-- cuti/sakit/izin yang disetujui masih dihitung bolong di hari_wajib,
-- pte_mulai_berlaku tidak boleh diisi. Tanggal aktivasinya sendiri TETAP
-- keputusan CEO -- migrasi ini cuma menutup penghalang TEKNISnya.

create type public.cuti_jenis as enum ('cuti', 'sakit', 'izin');
create type public.cuti_status as enum ('diajukan', 'disetujui', 'ditolak');

create table public.cuti (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profile(id),
  tanggal_mulai     date not null,
  tanggal_selesai   date not null,
  jenis             cuti_jenis not null,
  keterangan        text,
  status            cuti_status not null default 'diajukan',
  surat_path        text,
  -- Catatan keputusan (mis. alasan ditolak) TERPISAH dari `keterangan`
  -- (alasan pengajuan milik karyawan) -- putuskan_cuti() di bawah cuma
  -- menulis kolom ini, tidak pernah menimpa alasan pengajuan aslinya.
  catatan_keputusan text,
  disetujui_oleh    uuid references public.profile(id),
  disetujui_at      timestamptz,
  created_at        timestamptz not null default now(),
  check (tanggal_selesai >= tanggal_mulai)
);

-- ─── RLS ────────────────────────────────────────────────────────────────
-- Gerbang tinjau: ceo ATAU is_hrd_kadiv() (migrasi 0022, fungsi yang sama
-- dipakai Tinjau Absensi -- TIDAK dibuat gerbang baru). SENGAJA TIDAK
-- menyertakan role 'pusat' seperti pola absensi_select -- instruksi
-- eksplisit user (koreksi 1, 30 Agustus 2026): "Peran 'pusat' TIDAK
-- otomatis dapat akses -- kalau suatu saat ada orang lain berperan pusat
-- tanpa HRD, dia tidak boleh menyetujui cuti orang." Sabrina tetap ikut
-- karena dia HRD (kadiv + divisi='HRD'), bukan karena dia 'pusat'.
alter table public.cuti enable row level security;

create policy cuti_select on public.cuti for select using (
  user_id = auth.uid() or public.has_role('ceo') or public.is_hrd_kadiv()
);
create policy cuti_insert on public.cuti for insert with check (user_id = auth.uid());

-- Tidak ada policy update/delete untuk klien biasa -- keputusan (status/
-- disetujui_oleh/disetujui_at/catatan_keputusan) HANYA lewat putuskan_cuti()
-- di bawah, security definer, guard manual (pola sama dengan
-- putuskan_absensi(), migrasi 0022 -- menghindari jebakan "with check(true)"
-- yang sudah didokumentasikan di 04-CATATAN-TEKNIS.md §3.2).
create or replace function public.putuskan_cuti(p_id uuid, p_disetujui boolean, p_catatan text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('ceo') or public.is_hrd_kadiv()) then
    raise exception 'Tidak berhak memutuskan pengajuan cuti.';
  end if;
  update public.cuti
  set status = case when p_disetujui then 'disetujui' else 'ditolak' end::cuti_status,
      disetujui_oleh = auth.uid(),
      disetujui_at = now(),
      catatan_keputusan = coalesce(p_catatan, catatan_keputusan)
  where id = p_id;
end $$;

-- ─── Storage (surat, opsional) ─────────────────────────────────────────
-- Bucket privat baru, path {user_id}/... (pola sama dengan 'absensi',
-- migrasi 0022) -- baris `cuti` bisa saja belum ada saat surat diunggah
-- kalau UI mengunggah dulu baru insert, jadi diskop ke user sendiri, bukan
-- ke id baris. PDF/JPEG/PNG -- surat sakit/izin bisa scan atau foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cuti', 'cuti', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy cuti_surat_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'cuti' and (storage.foldername(name))[1] = auth.uid()::text);

create policy cuti_surat_read on storage.objects for select to authenticated
  using (bucket_id = 'cuti' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role('ceo') or public.is_hrd_kadiv()
  ));

-- ─── Sambungkan ke hari_wajib (SATU rumus, bukan rumus ketiga) ─────────
-- `marketing_bulanan_untuk(p_bulan)` (migrasi 0023) sudah jadi SATU-satunya
-- sumber hari_wajib/hari_bolong sejak migrasi 0024 menyatukan
-- `v_marketing_bulanan` ke sekadar memanggil fungsi ini. CREATE OR REPLACE
-- FUNCTION dengan signature PERSIS SAMA -- satu-satunya perubahan: hari yang
-- tertutup cuti DISETUJUI dikecualikan dari generate_series hari_wajib.
-- Karena v_marketing_bulanan delegasi ke sini, dashboard Marketing (Task 22)
-- otomatis ikut benar tanpa disentuh.
create or replace function public.marketing_bulanan_untuk(
  p_bulan date default date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date
)
returns table (
  user_id uuid,
  nama text,
  divisi text,
  bulan date,
  pte_berlaku boolean,
  hari_wajib int,
  hari_lengkap bigint,
  hari_bolong bigint,
  undangan bigint,
  closing bigint
)
language sql stable as $$
  with p as (
    select
      (select value from policy where key = 'workdays')                       as workdays,
      (select nullif(value #>> '{}', '')::date
         from policy where key = 'pte_mulai_berlaku')                         as mulai_berlaku
  ),
  rentang as (
    select
      date_trunc('month', p_bulan)::date                                     as awal,
      (date_trunc('month', p_bulan) + interval '1 month' - interval '1 day')::date as akhir
  ),
  batas as (
    -- Bulan berjalan: jangan hitung hari yang belum terjadi. Bulan lalu:
    -- batasnya ya akhir bulan itu sendiri (LEAST tidak berpengaruh).
    select least(rentang.akhir, (now() at time zone 'Asia/Jakarta')::date) as d
    from rentang
  )
  select
    pr.id                                as user_id,
    pr.nama,
    pr.divisi,
    rentang.awal                         as bulan,
    (p.mulai_berlaku is not null)        as pte_berlaku,
    hw.hari_wajib,
    coalesce(pd.hari_lengkap, 0)         as hari_lengkap,
    greatest(hw.hari_wajib - coalesce(pd.hari_lengkap, 0), 0) as hari_bolong,
    coalesce(pd.undangan, 0)             as undangan,
    coalesce(cl.closing, 0)              as closing
  from profile pr
  cross join p
  cross join rentang
  cross join batas
  left join lateral (
    select count(*)::int as hari_wajib
    from generate_series(
           greatest(rentang.awal, p.mulai_berlaku, pr.mulai_kerja),
           batas.d,
           interval '1 day') g
    where p.mulai_berlaku is not null
      and to_jsonb(extract(isodow from g)::int) <@ p.workdays
      and not exists (
        select 1 from public.cuti c
        where c.user_id = pr.id
          and c.status = 'disetujui'
          and g::date between c.tanggal_mulai and c.tanggal_selesai
      )
  ) hw on true
  left join lateral (
    select count(*) filter (where lengkap) as hari_lengkap,
           sum(undang_jumlah)              as undangan
    from pte_daily
    where user_id = pr.id
      and tanggal >= rentang.awal
      and tanggal <= rentang.akhir
  ) pd on true
  left join lateral (
    select count(*) as closing
    from closing
    where user_id = pr.id
      and status <> 'batal'
      and tanggal >= rentang.awal
      and tanggal <= rentang.akhir
  ) cl on true
  where pr.aktif;
$$;
