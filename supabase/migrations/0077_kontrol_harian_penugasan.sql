-- 0077 -- Ada/tidaknya penugasan Kontrol F&B per outlet (8 Oktober 2026).
--
-- Dipakai dua tempat:
--  1. Kontrol Harian: outlet TANPA penugasan kontrol_fnb tidak akan pernah punya Laporan
--     Kontrol F&B, jadi pesannya harus "uang masuk belum bisa diisi karena belum ada
--     penugasan" -- bukan "laporan belum ada" (yang terbaca seolah PIC lalai).
--  2. Kesiapan Outlet (CEO/Admin): butir "Penugasan Kontrol F&B".
--
-- Fungsi BARU, bukan mengubah kontrol_harian_uang (mengubah kolom kembalian butuh drop).
-- Gerbang sama dengan kontrol_harian_uang: boleh_lihat_kontrol_harian(), selain itu
-- TIDAK_BERHAK (bukan data kosong). Hanya mengembalikan ya/tidak per outlet -- tidak ada
-- nama orang.
--
-- ADITIF: satu fungsi baru. Tidak ada yang diubah/dihapus.

begin;

create or replace function public.kontrol_harian_penugasan()
returns table (outlet_id uuid, pos_outlet_id uuid, ada_penugasan boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.boleh_lihat_kontrol_harian() then
    raise exception 'TIDAK_BERHAK';
  end if;
  return query
    select m.outlet_id, m.pos_outlet_id,
      exists (select 1 from public.assignment a where a.form_key = 'kontrol_fnb' and a.outlet_id = m.outlet_id)
    from public.outlet_pos_map m
    where not m.diabaikan;
end
$$;
revoke all on function public.kontrol_harian_penugasan() from public, anon;
grant execute on function public.kontrol_harian_penugasan() to authenticated;

commit;
