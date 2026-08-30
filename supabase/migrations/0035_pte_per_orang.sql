-- PTE bisa dimatikan PER ORANG (instruksi eksplisit user, 30 Agustus 2026)
-- -- default MENYALA, pengecualian harus disengaja lewat Admin (CEO saja).
-- Menggantikan BLUEPRINT.md §4 "semua user wajib role karyawan, tanpa
-- kecuali" -- role `karyawan` itu sendiri TETAP universal (tidak berubah),
-- yang baru bisa dikecualikan HANYA kewajiban PTE-nya (bonus/potongan/
-- hari_bolong), bukan kewajiban lapor personal_marketing itu sendiri.
alter table public.profile add column wajib_pte boolean not null default true;
alter table public.profile add column alasan_bebas_pte text;

-- Perluasan jaga_profil_sensitif() (0028/0029/0034) -- kolom sensitif baru,
-- pola SAMA PERSIS dengan divisi/aktif: HANYA CEO yang boleh mengubah.
create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('ceo') then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO yang boleh mengubah divisi atau status aktif.';
    end if;
    if old.harus_ganti_password = true and new.harus_ganti_password = false then
      raise exception 'harus_ganti_password hanya bisa dimatikan lewat proses ganti password resmi.';
    end if;
    if new.wajib_pte is distinct from old.wajib_pte or new.alasan_bebas_pte is distinct from old.alasan_bebas_pte then
      raise exception 'Hanya CEO yang boleh mengubah status wajib PTE.';
    end if;
  end if;
  return new;
end $$;

-- Jejak audit (instruksi eksplisit user: "perubahannya tercatat: siapa,
-- kapan, dari apa ke apa") -- trigger TERPISAH, bukan RPC, supaya
-- perubahan TERCATAT OTOMATIS lewat jalur mana pun yang lolos guard di
-- atas (CEO lewat Admin, atau perbaikan langsung lewat SQL kalau perlu),
-- tidak mungkin lupa dipanggil seperti kalau harus lewat RPC terpisah.
create table public.pte_pengecualian_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profile(id),
  actor_id        uuid references public.profile(id),
  wajib_pte_lama  boolean not null,
  wajib_pte_baru  boolean not null,
  alasan          text,
  created_at      timestamptz not null default now()
);

alter table public.pte_pengecualian_log enable row level security;
-- CEO saja -- ini catatan keputusan personal/HR-adjacent (siapa dikecualikan
-- dari PTE dan kenapa), bukan data operasional biasa. Tidak ada policy
-- insert untuk klien sama sekali -- HANYA trigger (security definer) yang
-- menulis, sama pola dengan putuskan_cuti()/putuskan_absensi() menulis ke
-- tabel yang tidak punya policy update untuk klien.
create policy pte_pengecualian_log_select on public.pte_pengecualian_log for select using (public.has_role('ceo'));

create or replace function public.catat_perubahan_wajib_pte()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.wajib_pte is distinct from old.wajib_pte then
    insert into public.pte_pengecualian_log (user_id, actor_id, wajib_pte_lama, wajib_pte_baru, alasan)
    values (new.id, auth.uid(), old.wajib_pte, new.wajib_pte, new.alasan_bebas_pte);
  end if;
  return new;
end $$;

create trigger pte_pengecualian_catat
  after update on public.profile
  for each row execute function public.catat_perubahan_wajib_pte();

-- marketing_bulanan_untuk(): signature BERTAMBAH satu kolom (`wajib_pte`)
-- dibanding migrasi 0023/0024/0025 -- Postgres TIDAK MENGIZINKAN
-- CREATE OR REPLACE mengubah return type function, jadi DROP + CREATE
-- ULANG (bukan REPLACE) -- CASCADE ikut menghapus `v_marketing_bulanan`
-- (0024, sekadar "select * from" fungsi ini), DIBUAT ULANG PERSIS SAMA
-- persis di bawah supaya dashboard Marketing/lib/kalenderPte.ts (4 file
-- pemanggil, TIDAK disentuh) tetap jalan tanpa perubahan.
--
-- `wajib_pte` dilipat ke `pte_berlaku` yang SUDAH ADA (bukan kolom baru
-- terpisah) -- satu boolean itu SUDAH jadi gerbang tunggal yang dipakai
-- hitungKelayakanBonus()/hitungPotongan() (lib/api/pte.ts) utk
-- menyembunyikan bonus & potongan sekaligus saat false, jadi "tidak kena
-- potongan closing" otomatis benar TANPA mengubah kode TS itu sama sekali.
-- Kolom `wajib_pte` SENDIRI ikut dikembalikan supaya dashboard Kontrol
-- Marketing (lib/api/marketing.ts, useMarketingBulananSemua) bisa
-- menyaring baris yang dikecualikan -- "tidak muncul di dashboard" perlu
-- filter EKSPLISIT di situ, beda dari pte_berlaku=false (yang tetap
-- tampil sebagai "belum berlaku") karena ini pengecualian DISENGAJA per
-- orang, bukan status program yang belum dinyalakan.
drop function public.marketing_bulanan_untuk(date) cascade;

create function public.marketing_bulanan_untuk(
  p_bulan date default date_trunc('month', (now() at time zone 'Asia/Jakarta'))::date
)
returns table (
  user_id uuid,
  nama text,
  divisi text,
  bulan date,
  pte_berlaku boolean,
  wajib_pte boolean,
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
    (p.mulai_berlaku is not null and pr.wajib_pte) as pte_berlaku,
    pr.wajib_pte,
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
      and pr.wajib_pte
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

-- v_marketing_bulanan dibuat ULANG persis bentuk 0024 (dihapus CASCADE di
-- atas) -- 4 pemanggil (dashboard Marketing, lib/kalenderPte.ts, dst.)
-- TIDAK disentuh, tetap `select * from v_marketing_bulanan` seperti biasa,
-- otomatis dapat kolom `wajib_pte` baru juga kalau butuh nanti.
create view public.v_marketing_bulanan as
select * from public.marketing_bulanan_untuk();

alter view public.v_marketing_bulanan set (security_invoker = on);
