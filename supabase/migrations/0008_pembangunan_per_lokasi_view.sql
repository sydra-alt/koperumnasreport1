-- §3.5b: satu angka, satu pengisi. Rekap pembangunan per lokasi dibaca dari
-- laporan PIC Lokasi (form_key='pic_lokasi'), bukan diketik ulang oleh Kepala
-- Pembangunan.
--
-- CATATAN: form pembangunan (LaporForm.tsx) TIDAK memakai view ini -- dia
-- membaca report.data langsung lewat lib/api/pembangunan.ts (useRekapPicLokasi)
-- supaya bisa menampilkan data tabel/status bersarang yang sulit dimodelkan
-- lewat SQL view. View ini disiapkan untuk agregasi skalar sederhana di
-- dashboard CEO (Task 20), yang memang cukup angka rata, bukan struktur.
--
-- Kunci JSON (target_unit, unit_dibangun, unit_finishing, unit_selesai,
-- unit_belum_mulai) adalah KONTRAK dengan forms/f13-pic-lokasi.ts blok 3.
-- Jangan ganti namanya tanpa mengganti field key di sana juga.
--
-- ⚠️ CELAH RLS BELUM DITUTUP: `can_see_report()` (0002_rls.sql) tidak memberi
-- role `kadiv` akses baca ke laporan pic_lokasi milik orang lain -- Kepala
-- Pembangunan sungguhan (Ronald, role kadiv+karyawan) TIDAK akan melihat
-- baris apa pun lewat view ini ataupun lewat useRekapPicLokasi, walau PIC
-- sudah kirim laporan. Dikonfirmasi lewat scripts/uji-rls-gap-pembangunan.mjs.
-- Menunggu keputusan user soal cara memberi akses (lihat docs/PROGRESS.md).

create or replace view public.v_pembangunan_per_lokasi as
select
  l.nama                                     as lokasi,
  (r.data->>'target_unit')::int              as target,
  (r.data->>'unit_dibangun')::int            as sedang_dibangun,
  (r.data->>'unit_finishing')::int           as finishing,
  (r.data->>'unit_selesai')::int             as selesai_hari_ini,
  (r.data->>'unit_belum_mulai')::int         as belum_mulai
from report r
join lokasi l on l.id = r.lokasi_id
where r.form_key = 'pic_lokasi'
  and r.tanggal = (now() at time zone 'Asia/Jakarta')::date
  and r.status <> 'draft';

alter view public.v_pembangunan_per_lokasi set (security_invoker = on);
