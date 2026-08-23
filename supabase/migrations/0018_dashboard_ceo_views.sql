-- Task 20: tiga view sisa dari 03-CALC-SPEC.md §4 yang BELUM pernah dibuat
-- (v_marketing_bulanan §3 dan v_pembangunan_per_lokasi §3.4b SUDAH ada sejak
-- Task 15/16 -- migrasi 0007/0011, tidak dibuat ulang di sini).

-- §4.2 -- Pembangunan seluruh lokasi, dijumlahkan dari `pic_lokasi` hari ini.
-- security_invoker = ON: pembacanya (ceo/pusat) sudah berhak atas baris
-- `pic_lokasi` lewat can_see_report(), bukan kasus §3.4b. sum() tanpa GROUP BY
-- SELALU mengembalikan tepat 1 baris walau 0 laporan hari ini (kolom NULL,
-- bukan 0 baris) -- itulah yang membuat "keadaan kosong, bukan NaN" gampang
-- ditangani: frontend cukup coalesce NULL -> 0, tidak perlu cek "array kosong".
create or replace view public.v_pembangunan_hari_ini as
select
  sum((data->>'unit_dibangun')::int)    as sedang_dibangun,
  sum((data->>'unit_finishing')::int)   as finishing,
  sum((data->>'unit_selesai')::int)     as selesai_hari_ini,
  sum((data->>'unit_belum_mulai')::int) as belum_mulai
from public.report
where form_key = 'pic_lokasi'
  and tanggal = (now() at time zone 'Asia/Jakarta')::date
  and status <> 'draft';

alter view public.v_pembangunan_hari_ini set (security_invoker = on);

-- §4.3 -- Rekap keuangan untuk Sabrina, EMPAT angka mutlak. security_invoker
-- = OFF SENGAJA (04-CATATAN-TEKNIS.md §3.4, sudah diperbaiki user sebelum
-- Task 14): Sabrina (pusat) TIDAK berhak atas baris `accounting` sama sekali
-- lewat can_see_report(), itulah maksud view ini -- angkanya saja, bukan
-- barisnya. `total_masuk`/`total_keluar` di `report.data` disuntikkan oleh
-- LaporForm.tsx saat form accounting dikirim (lihat hitungCashflowHariIni,
-- Task 18) -- TANPA itu, view ini akan selalu kosong tanpa error apa pun
-- (jebakan §7 poin 3, kunci JSON tidak sinkron -- sudah diperbaiki lebih dulu
-- di commit Task 18, disebut lagi di sini karena inilah pembacanya).
create or replace view public.v_keuangan_rekap
with (security_invoker = off) as
select
  tanggal,
  (data->>'total_masuk')::bigint  as total_masuk,
  (data->>'total_keluar')::bigint as total_keluar,
  (data->>'total_masuk')::bigint - (data->>'total_keluar')::bigint as net,
  warna
from public.report
where form_key = 'accounting'
  and status <> 'draft'
  and (public.has_role('ceo') or public.has_role('pusat') or public.has_role('accounting'));

-- §4.4 -- Silang-cek omzet resto: versi Manager vs versi Ita, hari ini.
-- security_invoker = ON -- ceo/pusat/accounting semua sudah berhak atas
-- BAIK baris manager_resto MAUPUN ita lewat can_see_report() (bukan §3.4b).
-- INNER JOIN keduanya SENGAJA -- outlet yang salah satu laporannya belum
-- masuk hari ini tidak tampil sama sekali (bukan selisih palsu dari data
-- yang belum lengkap).
create or replace view public.v_selisih_resto as
select
  o.nama                                             as outlet,
  (mr.data->>'total_omzet')::bigint                  as versi_manager,
  (it.data->>('omzet_' || lower(o.nama)))::bigint    as versi_ita,
  (mr.data->>'total_omzet')::bigint
    - (it.data->>('omzet_' || lower(o.nama)))::bigint as selisih
from public.outlet o
join public.report mr on mr.form_key = 'manager_resto'
              and mr.outlet_id = o.id
              and mr.tanggal = (now() at time zone 'Asia/Jakarta')::date
              and mr.status <> 'draft'
join public.report it on it.form_key = 'ita'
              and it.tanggal = (now() at time zone 'Asia/Jakarta')::date
              and it.status <> 'draft';

alter view public.v_selisih_resto set (security_invoker = on);

-- ⚠️ 03-CALC-SPEC.md §4.4 juga meminta: "kalau selisih <> 0, KEDUA laporan
-- ditandai 🔴 di Papan Kontrol dan otomatis dibuatkan baris decision
-- berurgensi 2". Itu efek SAMPING lintas-laporan (mengubah warna laporan
-- lain + membuat decision otomatis di luar alur kirim form mana pun) --
-- BELUM diimplementasikan di sini, dicatat sebagai utang di docs/PROGRESS.md,
-- BUKAN dikerjakan diam-diam dengan trigger yang berisiko (INSERT/UPDATE
-- report yang saling memicu satu sama lain perlu dirancang hati-hati supaya
-- tidak infinite-loop). View ini baru menyediakan ANGKANYA untuk dashboard
-- CEO menampilkan selisih -- penandaan otomatisnya menyusul.
