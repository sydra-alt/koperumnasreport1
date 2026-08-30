-- Menyatukan rumus marketing bulanan (instruksi eksplisit user, 30 Agustus
-- 2026): sejak migrasi 0023, rumus hari_wajib/hari_bolong/undangan/closing
-- ADA DI DUA TEMPAT -- `v_marketing_bulanan` (Task 15, dipakai dashboard
-- Marketing) dan `marketing_bulanan_untuk(p_bulan)` (dipakai ekspor). Ini
-- rumus yang menentukan bonus & potongan gaji sungguhan -- dua salinan
-- cepat atau lambat akan berbeda begitu salah satunya diedit tanpa
-- mengedit yang lain. Disatukan SELAGI MASIH KECIL, sebelum sempat terjadi.
--
-- View lama TIDAK DIHAPUS (dashboard Marketing & lib/kalenderPte.ts masih
-- memanggilnya lewat `.from('v_marketing_bulanan')`, tidak ada alasan
-- mengubah 4 file pemanggil itu) -- badannya diganti jadi SEKADAR
-- memanggil fungsi yang sama dengan parameter default (bulan berjalan).
-- Baris "CREATE OR REPLACE VIEW" AMAN dipakai di sini (bukan drop+create
-- seperti migrasi 0007) karena struktur kolomnya PERSIS SAMA, tidak ada
-- kolom baru disisipkan.
create or replace view public.v_marketing_bulanan as
select * from public.marketing_bulanan_untuk();

alter view public.v_marketing_bulanan set (security_invoker = on);
