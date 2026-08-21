-- Perbaikan atas cacat spesifikasi ditemukan Checkpoint 3 (22 Agustus 2026):
-- tanpa tanggal mulai, hari yang belum ada datanya ikut terhitung bolong.
-- Lihat 03-CALC-SPEC.md §3.

alter table public.profile add column if not exists mulai_kerja date;

-- null berarti kewajiban PTE belum berjalan sama sekali -- hari_wajib = 0
-- untuk semua orang sampai CEO mengisi tanggal ini.
insert into public.policy (key, value) values
  ('pte_mulai_berlaku', 'null')
on conflict (key) do nothing;
