-- 0073 -- Status cadangan database (7 Oktober 2026), untuk peringatan di Admin:
-- "Cadangan terakhir: N hari lalu" (merah kalau > 8 hari).
--
-- SATU baris per database, ditulis job cadangan di laptop pengembang
-- (scripts/cadangan/cadangkan.mjs, role postgres) setiap kali berjalan: tanggal
-- coba, hasil, tanggal OK terakhir, ukuran file, nama file. Tanpa rahasia.
-- Baca: CEO/Admin (is_admin()). Tidak ada policy tulis untuk pengguna aplikasi.
--
-- ADITIF: satu tabel baru. Tidak ada yang diubah/dihapus.

begin;

create table public.status_cadangan (
  basis_data     text primary key,
  terakhir_coba  timestamptz not null,
  hasil_terakhir text not null check (hasil_terakhir in ('ok', 'gagal')),
  terakhir_ok    timestamptz,
  ukuran_byte    bigint,
  nama_file      text
);
alter table public.status_cadangan enable row level security;
create policy status_cadangan_baca on public.status_cadangan for select using (public.is_admin());

commit;
