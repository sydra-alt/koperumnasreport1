-- 0071 -- Aktivitas marketing Koperumnas tidak berlaku lagi (keputusan CEO, 6 Oktober 2026).
--
-- SATU saklar di tabel policy (aturan #4), dibaca lib/marketing.ts: menyembunyikan
-- Personal Marketing (tugas harian semua karyawan), PTE/Closing di Beranda,
-- halaman Kontrol Marketing, seksi Marketing di Terpusat, dan blok "Kontrol
-- PTA/PTE" di Laporan Manajer Resto (jadi arsip: tetap terbaca di riwayat).
--
-- ADITIF: hanya menyisipkan satu baris policy. TIDAK ada tabel, view, fungsi,
-- laporan, atau data PTE yang dihapus/diubah. Mengaktifkan kembali: ubah nilai
-- `marketing_aktif` menjadi true lewat Admin > Policy (tanpa ubah kode).
-- Papan Kontrol, "Tagih", batas kirim & status terlambat berbasis `assignment`
-- dan kiriman laporan; personal_marketing tidak punya assignment (0 baris) dan
-- formnya tidak lagi dirender, jadi tidak pernah terhitung belum/terlambat.

begin;

insert into public.policy (key, value) values ('marketing_aktif', 'false'::jsonb)
on conflict (key) do nothing;

commit;
