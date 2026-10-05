-- 0075 -- Akses POS untuk peran Admin (keputusan CEO, 8 Oktober 2026: Pusat diakses Ita,
-- CEO, dan Admin).
--
-- Ita sudah punya akses semua outlet POS (profile.akses_semua_outlet_pos, migrasi 0068) dan
-- peran 'ceo' sudah dipetakan ke manager semua outlet -- keduanya otomatis mencakup Pusat
-- begitu Pusat dibuat. Yang belum: peran 'admin'. Dipetakan sama dengan CEO (manager, semua
-- outlet). Tetap butuh profile.punya_akses_pos per orang (hanya CEO/Admin yang menyalakan) --
-- baris ini TIDAK memberi siapa pun akses sendirian.
--
-- Tidak ada peran pembelian/gudang di sistem laporan; peran 'warehouse' pos-fnb tidak
-- dipetakan ke siapa pun (perlu keputusan baru kalau Pembelian Pusat butuh akun sendiri).
--
-- ADITIF: satu baris peta. Tidak ada yang diubah/dihapus.

begin;

insert into public.peta_akses_pos (sumber, kunci, peran_pos, cakupan, catatan) values
  ('peran', 'admin', 'manager', 'semua', 'Admin aplikasi -- semua outlet POS termasuk Pusat (keputusan CEO 8 Okt 2026). Tetap butuh punya_akses_pos per orang.')
on conflict (sumber, kunci) do nothing;

commit;
