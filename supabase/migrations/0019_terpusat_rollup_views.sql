-- Task 21 (Laporan Terpusat Sabrina): dua view SUM lintas-baris yang belum
-- ada dari sebelas rollup yang sudah dipetakan (lihat "Analisis 5 format asli"
-- di PROGRESS.md). Kesembilan rollup LAIN (cs/ga/hrd/perizinan/dti/kendaraan/
-- it) sumbernya SATU baris report per hari (scope 'global') -- dibaca lewat
-- query biasa (pusat/ceo sudah punya can_see_report()), tidak butuh view.
-- security dan pic_lokasi/stk perlu view karena scope-nya 'lokasi' -- BANYAK
-- baris report per hari (satu per lokasi/shift) yang harus DIJUMLAH, dan
-- CLAUDE.md aturan #7 melarang menjumlah lintas-baris di React.

-- §4 SECURITY -- dijumlahkan lintas SEMUA lokasi+shift hari ini.
-- security_invoker = ON: pusat/ceo sudah berhak baca baris `security`
-- lewat can_see_report() (bukan kasus §3.4b).
create or replace view public.v_security_hari_ini as
select
  sum((data->>'satpam_hadir')::int)    as satpam_hadir,
  sum((data->>'tamu_datang')::int)     as tamu_datang,
  sum((data->>'konsumen_datang')::int) as konsumen_datang,
  count(*) filter (where (data->>'ada_kejadian') = 'ya') as jumlah_kejadian
from public.report
where form_key = 'security'
  and tanggal = (now() at time zone 'Asia/Jakarta')::date
  and status <> 'draft';

alter view public.v_security_hari_ini set (security_invoker = on);

-- §9 STK & Rumah Tidak Ditempati -- dijumlahkan dari `pic_lokasi` hari ini,
-- pola sama persis dengan v_pembangunan_hari_ini (Task 20, migrasi 0018) --
-- view TERPISAH (bukan kolom tambahan di view itu) supaya masing-masing
-- tetap satu tanggung jawab, sesuai gaya 03-CALC-SPEC.md §4 (satu view per
-- kebutuhan, bukan satu view raksasa).
create or replace view public.v_stk_hari_ini as
select
  sum((data->>'stk_total')::int)              as stk_total,
  sum((data->>'stk_sudah_ditempati')::int)    as sudah_ditempati,
  sum((data->>'stk_belum_ditempati')::int)    as belum_ditempati,
  sum((data->>'stk_rumah_kosong')::int)       as rumah_kosong,
  sum((data->>'stk_perlu_maintenance')::int)  as perlu_maintenance
from public.report
where form_key = 'pic_lokasi'
  and tanggal = (now() at time zone 'Asia/Jakarta')::date
  and status <> 'draft';

alter view public.v_stk_hari_ini set (security_invoker = on);

-- §13 MARKETING -- KONTROL PAK FAUZI & PAK DEA -- rollup harian SELURUH
-- karyawan (bukan per-orang seperti v_marketing_bulanan, §3). "Belum
-- bergerak/tertinggal" dan "closing bulan berjalan" TETAP diambil dari
-- v_marketing_bulanan yang sudah ada (Task 15) -- query langsung ke view
-- itu lalu DIFILTER/ditampilkan per baris di frontend, BUKAN dijumlah ulang
-- (memfilter/menampilkan baris ≠ menghitung ulang agregasi).
create or replace view public.v_marketing_hari_ini as
select
  (select count(*) from public.profile p join public.role r on r.user_id = p.id
     where r.role = 'karyawan' and p.aktif)                                  as total_karyawan,
  (select count(*) from public.report
     where form_key = 'personal_marketing'
       and tanggal = (now() at time zone 'Asia/Jakarta')::date
       and status <> 'draft')                                                as sudah_lapor_hari_ini,
  (select coalesce(sum(undang_jumlah), 0) from public.pte_daily
     where tanggal = (now() at time zone 'Asia/Jakarta')::date)              as undangan_hari_ini,
  (select count(*) from public.closing
     where tanggal = (now() at time zone 'Asia/Jakarta')::date
       and status <> 'batal')                                                as closing_hari_ini;

alter view public.v_marketing_hari_ini set (security_invoker = on);
