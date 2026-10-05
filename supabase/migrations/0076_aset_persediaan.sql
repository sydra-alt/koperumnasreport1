-- 0076 -- Gerbang halaman "Nilai Aset Persediaan" (Pusat fase B, keputusan CEO 8 Oktober 2026:
-- CEO, Admin, Ita, dan Accounting -- lihat saja).
--
-- Datanya ditarik server dari pos-fnb (/api/integrasi/aset-persediaan); tidak ada tabel baru di
-- sini. Route /api/aset-persediaan memanggil fungsi ini dengan klien Supabase MILIK PENANYA dan
-- menjawab 403 (bukan data kosong) kalau false.
--
-- Ita dikenali dari profile.akses_semua_outlet_pos (migrasi 0068: hanya CEO/Admin yang bisa
-- mengubah) -- tanda yang SUDAH memberinya stok & harga semua outlet di POS. SENGAJA BUKAN
-- penugasan kontrol_fnb (is_kontrol_fnb): itu juga dipegang Mba Rika (Pembelian Pusat), yang
-- tidak disebut di keputusan ini. Peran 'pusat' juga tidak.
--
-- ADITIF: satu fungsi baru. Tidak ada yang diubah/dihapus.

begin;

create or replace function public.boleh_lihat_aset_persediaan()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.has_role('accounting')
      or exists (select 1 from public.profile p where p.id = auth.uid() and p.aktif and p.akses_semua_outlet_pos);
$$;

revoke all on function public.boleh_lihat_aset_persediaan() from public, anon;
grant execute on function public.boleh_lihat_aset_persediaan() to authenticated;

commit;
