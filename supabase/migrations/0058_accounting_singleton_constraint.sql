-- §2 Constraint: satu laporan accounting non-draft per tanggal.
--
-- LATAR BELAKANG
-- Laporan accounting bersifat singleton per tanggal: hanya satu laporan
-- yang boleh berlaku (non-draft) untuk satu tanggal. Ini sesuai business
-- logic bahwa Accounting (Shabita) mengisi satu laporan keuangan harian,
-- dan v_keuangan_rekap di-query oleh CEO dengan .maybeSingle() -- dua baris
-- untuk tanggal yang sama akan menyebabkan runtime error di frontend.
--
-- KENAPA report_uniq TIDAK CUKUP
-- report_uniq = UNIQUE(form_key, tanggal, author_id, COALESCE(lokasi_id,
-- outlet_id, sentinel), COALESCE(shift_id, sentinel)) -- menyertakan
-- author_id. Artinya dua orang berbeda secara teknis bisa memasukkan
-- laporan accounting untuk tanggal yang sama tanpa melanggar constraint.
-- Meskipun saat ini hanya Shabita yang ditugaskan, constraint ini harus
-- mencerminkan rule bisnis, bukan kebetulan jumlah orang yang bertugas.
--
-- DESAIN INDEX
-- accounting selalu outlet_id = NULL (laporan keuangan tidak terikat satu
-- outlet). Partial unique index dengan filter form_key = 'accounting' AND
-- status <> 'draft' memastikan:
--   1. Hanya ada satu baris non-draft per tanggal, terlepas dari author_id.
--   2. Draft tidak terkena (seseorang bisa menyimpan draft lalu orang lain
--      membuat draft sendiri, yang normal dalam alur revisi internal).
--   3. Status enum aktual: 'draft', 'terkirim', 'terlambat'. Index berlaku
--      untuk 'terkirim' DAN 'terlambat' (status pengiriman, bukan konten).
--
-- BUKTI TIDAK ADA DUPLICATE DATA
-- Diverifikasi read-only sebelum migration dibuat (2026-09-19 01:22 WIB):
--   SELECT count(*) FROM public.report
--   WHERE form_key='accounting' AND status <> 'draft';
--   → 0 baris. Tidak ada data yang akan menyebabkan migration gagal.
--
-- MIGRATION INI TIDAK BOLEH DIAPPLY KE DATABASE LIVE SEBELUM DIAPPROVE
-- OLEH PEMILIK SISTEM.

create unique index report_accounting_singleton
  on public.report (tanggal)
  where form_key = 'accounting'
    and status <> 'draft';
