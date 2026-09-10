-- Perbaikan celah eskalasi privilese (ditemukan + dilaporkan sebelumnya,
-- dikonfirmasi CEO, 6 September 2026): policy lama `role_admin` cuma
-- mensyaratkan `is_admin()` TANPA peduli role APA yang sedang
-- ditulis/dihapus -- admin biasa bisa memberi role apa pun (termasuk 'ceo')
-- ke siapa pun, termasuk dirinya sendiri.
--
-- Percobaan perbaikan PERTAMA (daftar hitam, cuma menolak 'ceo') DITOLAK
-- CEO -- menutup satu pintu, membiarkan yang lain: admin masih bisa memberi
-- dirinya 'accounting' lalu membaca laporan keuangan lewat
-- `can_see_report()`. Perbaikan BENAR: DAFTAR PUTIH -- role mana yang
-- BOLEH diberikan admin, bukan yang dilarang.
--
--   Boleh diberikan admin  : karyawan, kadiv, pic_lokasi, manager_resto,
--                             kontrol_marketing, pusat
--   HANYA boleh ceo        : ceo, accounting, admin
--
-- 'admin' SENGAJA ikut terkunci -- kalau tidak, admin bisa mengangkat admin
-- baru dan pembatasan ini diperlebar sendiri dari dalam (persis kekhawatiran
-- CEO).
--
-- Diterapkan di DUA baris pertahanan yang TIDAK saling menggantikan:
-- 1. RLS di sini (satu-satunya yang benar-benar menahan -- REST langsung
--    tanpa lewat UI tetap kena).
-- 2. `DAFTAR_ROLE` di lib/api/admin.ts (UI) -- disaring per peran yang
--    membukanya, supaya admin biasa tidak disodori pilihan yang PASTI akan
--    ditolak backend (membingungkan tanpa RLS di sini, UI-nya cuma kosmetik).
--
-- Diperiksa juga SEKALIGUS: policy lama menerapkan syarat yang SAMA ke
-- USING dan WITH CHECK karena `for all`. Itu berarti pembatasan role
-- terkunci ini otomatis berlaku juga untuk DELETE (bukan cuma INSERT) --
-- admin biasa TIDAK BISA menghapus baris role 'ceo'/'accounting'/'admin'
-- milik siapa pun (mis. mencabut role ceo CEO sungguhan), bukan cuma
-- dicegah memberikannya. Ini penguatan tambahan yang mengikuti logis dari
-- desain yang sama, bukan diminta eksplisit -- dicatat di sini supaya
-- terlihat, bukan diam-diam.
create or replace function public.boleh_kelola_role(role_target text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('ceo')
      or (public.has_role('admin') and role_target not in ('ceo', 'accounting', 'admin'));
$$;

drop policy role_admin on public.role;
create policy role_admin on public.role for all
  using (public.boleh_kelola_role(role))
  with check (public.boleh_kelola_role(role));
