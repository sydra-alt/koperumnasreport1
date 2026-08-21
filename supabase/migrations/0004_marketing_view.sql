-- Catatan penomoran: 04-CATATAN-TEKNIS.md §5 menyebut 0004_views.sql untuk
-- Task 20 (v_papan_hari_ini, v_pembangunan_hari_ini, v_keuangan_rekap,
-- v_selisih_resto). View ini (v_marketing_bulanan, dari 03-CALC-SPEC.md §3)
-- dibutuhkan LEBIH AWAL, di Task 12, supaya progres "undangan ___ / 20"
-- benar-benar dihitung sistem dari view -- bukan dihitung ulang di React
-- (jebakan #5, CATATAN-TEKNIS §7). Diberi nomor migrasi sendiri supaya
-- tidak bentrok dengan 0004_views.sql yang akan dibuat Task 20.

create or replace view public.v_marketing_bulanan as
with p as (
  select
    (select value::int   from policy where key = 'invite_target')  as target_undangan,
    (select value::int   from policy where key = 'closing_target') as target_closing,
    (select value        from policy where key = 'workdays')       as workdays
),
hari as (
  select count(*)::int as hari_wajib
  from generate_series(
         date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date,
         (now() at time zone 'Asia/Jakarta')::date,
         interval '1 day') g
  where (extract(isodow from g)::int)::text::jsonb <@ (select workdays from p)
)
select
  pr.id                                   as user_id,
  pr.nama,
  pr.divisi,
  date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date as bulan,
  (select hari_wajib from hari)           as hari_wajib,
  coalesce(pd.hari_lengkap, 0)            as hari_lengkap,
  (select hari_wajib from hari) - coalesce(pd.hari_lengkap, 0) as hari_bolong,
  coalesce(pd.undangan, 0)                as undangan,
  coalesce(cl.closing, 0)                 as closing
from profile pr
left join (
  select user_id,
         count(*) filter (where lengkap) as hari_lengkap,
         sum(undang_jumlah)              as undangan
  from pte_daily
  where tanggal >= date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)
  group by user_id
) pd on pd.user_id = pr.id
left join (
  select user_id, count(*) as closing
  from closing
  where status <> 'batal'
    and tanggal >= date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)
  group by user_id
) cl on cl.user_id = pr.id
where pr.aktif;

alter view public.v_marketing_bulanan set (security_invoker = on);
