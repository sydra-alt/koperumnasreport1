-- Koreksi lanjutan dari 0006_marketing_view_perbaikan.sql, sesuai
-- 03-CALC-SPEC.md §3 versi terbaru (diperbaiki user setelah Checkpoint 3).
-- Migrasi BARU, bukan edit 0006 yang sudah jalan -- riwayat tidak diubah diam-diam.
--
-- Beda nyata dari versi saya di 0006 (bukan cuma gaya):
--   1. Kolom baru `pte_berlaku` (boolean) -- satu sumber kebenaran untuk
--      "aturan sudah diumumkan atau belum", tidak perlu dicek terpisah di frontend.
--   2. `hari_bolong` di-clamp `greatest(..., 0)` -- versi saya BISA negatif
--      (pernah terlihat -3 saat pte_mulai_berlaku masih null tapi ada data
--      pte_daily historis). Ini perbaikan nyata, bukan kosmetik.
--   3. `nullif(value #>> '{}', '')` -- jaring pengaman tambahan andai value
--      berupa string kosong, bukan null JSON sungguhan.
--   4. pd/cl jadi LEFT JOIN LATERAL per-baris (bukan subquery group-by lalu
--      join) -- hasil sama, gaya beda.
--   5. Kolom target_undangan/target_closing di CTE `p` dihapus -- di versi
--      lama tidak pernah dipakai di SELECT manapun (kode mati sejak awal).

-- CREATE OR REPLACE VIEW menolak ini: `pte_berlaku` disisipkan DI TENGAH
-- urutan kolom lama (sebelum hari_wajib), bukan ditambah di akhir. Postgres
-- cuma izinkan replace-view menambah kolom baru di UJUNG, bukan menyisipkan
-- di tengah -- errornya persis "cannot change name of view column
-- hari_wajib to pte_berlaku". Drop dulu baru create.
drop view if exists public.v_marketing_bulanan;

create view public.v_marketing_bulanan as
with p as (
  select
    (select value from policy where key = 'workdays')                       as workdays,
    (select nullif(value #>> '{}', '')::date
       from policy where key = 'pte_mulai_berlaku')                         as mulai_berlaku
),
hi as (select (now() at time zone 'Asia/Jakarta')::date as d)
select
  pr.id                                as user_id,
  pr.nama,
  pr.divisi,
  date_trunc('month', hi.d)::date      as bulan,
  (p.mulai_berlaku is not null)        as pte_berlaku,
  hw.hari_wajib,
  coalesce(pd.hari_lengkap, 0)         as hari_lengkap,
  greatest(hw.hari_wajib - coalesce(pd.hari_lengkap, 0), 0) as hari_bolong,
  coalesce(pd.undangan, 0)             as undangan,
  coalesce(cl.closing, 0)              as closing
from profile pr
cross join p
cross join hi
-- hari_wajib dihitung PER KARYAWAN, karena mulai_kerja bisa berbeda-beda
left join lateral (
  select count(*)::int as hari_wajib
  from generate_series(
         greatest(date_trunc('month', hi.d)::date, p.mulai_berlaku, pr.mulai_kerja),
         hi.d,
         interval '1 day') g
  where p.mulai_berlaku is not null                     -- null = kewajiban belum berjalan
    and to_jsonb(extract(isodow from g)::int) <@ p.workdays
) hw on true
left join lateral (
  select count(*) filter (where lengkap) as hari_lengkap,
         sum(undang_jumlah)              as undangan
  from pte_daily
  where user_id = pr.id
    and tanggal >= date_trunc('month', hi.d)::date
) pd on true
left join lateral (
  select count(*) as closing
  from closing
  where user_id = pr.id
    and status <> 'batal'
    and tanggal >= date_trunc('month', hi.d)::date
) cl on true
where pr.aktif;

alter view public.v_marketing_bulanan set (security_invoker = on);
