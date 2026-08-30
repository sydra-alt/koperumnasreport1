-- Ekspor "Kepatuhan marketing bulanan" (§4 06-RENCANA-PRESENSI-MOBILE.md,
-- prioritas #2 user) butuh angka bulan LALU yang sudah SELESAI (dipakai
-- untuk penggajian) -- tapi `v_marketing_bulanan` (Task 15, migrasi 0007)
-- SENGAJA HANYA menghitung bulan BERJALAN: `hi.d := (now() WIB)::date`
-- dipakai sebagai batas atas `generate_series` maupun filter `pte_daily`/
-- `closing`, tanpa parameter sama sekali. Ditemukan sambil menulis Route
-- Handler ekspor, BUKAN dicari-cari -- kalau dipaksa query view ini untuk
-- bulan Juli sambil sekarang Agustus, hasilnya tetap angka Agustus, salah
-- tanpa error apa pun.
--
-- Fungsi baru `marketing_bulanan_untuk(p_bulan)` DITAMBAHKAN, TIDAK
-- MENGGANTIKAN view yang sudah ada -- dashboard Marketing (Task 22) dan
-- kalender PTE (`lib/kalenderPte.ts`) TETAP pakai view lama apa adanya,
-- tidak disentuh sama sekali (di luar cakupan "kerjakan ekspor", dan
-- mengubah 4 file yang sudah berjalan demi ini risikonya tidak sepadan).
-- Konsekuensi sadar: logika penghitungan hari_wajib/hari_bolong sekarang
-- ADA DI DUA TEMPAT (view lama + fungsi baru) -- kalau rumusnya berubah
-- lagi nanti, KEDUANYA harus ikut diubah. Dicatat di sini supaya tidak
-- lupa, bukan diam-diam dianggap tidak masalah.
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
