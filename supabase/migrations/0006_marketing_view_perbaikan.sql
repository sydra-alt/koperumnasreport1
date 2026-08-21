-- Perbaikan v_marketing_bulanan (bukan edit 0004_marketing_view.sql yang sudah
-- pernah dijalankan -- riwayat migrasi tidak diubah diam-diam, ditumpuk lewat
-- migrasi baru). Lihat 03-CALC-SPEC.md §3 versi terbaru.
--
-- hari_wajib sekarang dihitung dari TANGGAL MULAI, yaitu yang paling akhir
-- di antara: (1) tanggal 1 bulan berjalan, (2) policy.pte_mulai_berlaku --
-- kalau NULL, hari_wajib = 0 untuk SEMUA ORANG, (3) profile.mulai_kerja.
--
-- CATATAN: blok SQL di 03-CALC-SPEC.md §3 masih menampilkan versi LAMA
-- (cuma prosa/tabelnya yang diperbarui, SQL-nya belum) -- view di bawah ini
-- ditulis mengikuti ATURAN BARU di prosa, bukan menyalin SQL basi di dokumen.

create or replace view public.v_marketing_bulanan as
with p as (
  select
    (select value::int   from policy where key = 'invite_target')  as target_undangan,
    (select value::int   from policy where key = 'closing_target') as target_closing,
    (select value        from policy where key = 'workdays')       as workdays,
    (select (value #>> '{}')::date from policy where key = 'pte_mulai_berlaku') as pte_mulai_berlaku
)
select
  pr.id                                   as user_id,
  pr.nama,
  pr.divisi,
  date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date as bulan,
  coalesce(hw.hari_wajib, 0)              as hari_wajib,
  coalesce(pd.hari_lengkap, 0)            as hari_lengkap,
  coalesce(hw.hari_wajib, 0) - coalesce(pd.hari_lengkap, 0) as hari_bolong,
  coalesce(pd.undangan, 0)                as undangan,
  coalesce(cl.closing, 0)                 as closing
from profile pr
cross join p
left join lateral (
  select count(*)::int as hari_wajib
  from generate_series(
         greatest(
           date_trunc('month', (now() at time zone 'Asia/Jakarta')::date)::date,
           p.pte_mulai_berlaku,
           coalesce(pr.mulai_kerja, '-infinity'::date)
         ),
         (now() at time zone 'Asia/Jakarta')::date,
         interval '1 day'
       ) g
  -- guard WAJIB: greatest() Postgres mengabaikan NULL, jadi tanpa baris ini
  -- pte_mulai_berlaku=null akan diam-diam DIABAIKAN, bukan bikin hari_wajib=0.
  where p.pte_mulai_berlaku is not null
    and (extract(isodow from g)::int)::text::jsonb <@ p.workdays
) hw on true
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
