-- Migrasi lanjutan dari 0033_tabel_shift.sql -- SENGAJA dipisah dari
-- migrasi itu (instruksi eksplisit user, 30 Agustus 2026, saat Perubahan 2
-- dikerjakan): kolom `shift` teks lama TIDAK dihapus di migrasi yang sama
-- dengan penambahan `shift_id`, supaya bisa mundur tanpa kehilangan data
-- kalau ada yang salah. User sudah mengonfirmasi semuanya jalan (0033
-- diverifikasi penuh -- backfill tanpa baris yatim, uji rename shift
-- "Pagi"->"Shift Pagi" membuktikan histori tetap benar) -- baru sekarang
-- kolom lama dihapus.
--
-- Aman dihapus: TIDAK ADA kode TS yang membaca/menulis kolom `shift` lagi
-- (semua sudah pindah ke `shift_id` sejak 0033), dan unique index
-- `assignment_uniq`/`report_uniq` SUDAH memakai `shift_id` sejak 0033 juga
-- -- kolom `shift` cuma data historis yang tidak lagi dipakai apa pun.
alter table public.assignment drop column shift;
alter table public.report drop column shift;
