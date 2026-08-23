-- Perbaikan atas 0016: migrasi itu SENDIRI masih salah, ditemukan lewat uji
-- DB sungguhan (scripts/uji-keputusan-ceo.mjs), bukan cuma dibaca kodenya.
--
-- `not exists (select 1 from report r where r.id = report_id and r.form_key
-- = 'accounting')` di dalam policy `dec_select` berjalan DI BAWAH RLS
-- `report_select` milik PEMANGGIL yang sama (Postgres tidak mengistimewakan
-- subquery di dalam policy) -- untuk Pusat, `report_select` sudah menyaring
-- baris `form_key='accounting'` itu SENDIRI, jadi EXISTS selalu mengembalikan
-- 0 baris bukan karena form_key-nya bukan accounting, tapi karena Pusat
-- memang tidak boleh melihat baris report itu sama sekali -- alhasil
-- `not exists(...)` selalu TRUE dan pengecualian tidak pernah menyala.
--
-- Sama seperti `has_role()`/`can_see_report()`, jawabannya adalah fungsi
-- `security definer` yang membaca form_key TANPA tunduk pada RLS pemanggil.
create or replace function public.laporan_form_key(r_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select form_key from public.report where id = r_id;
$$;

drop policy if exists dec_select on public.decision;
create policy dec_select on public.decision for select using (
  public.has_role('ceo')
  or (public.has_role('pusat') and public.laporan_form_key(report_id) is distinct from 'accounting')
  or exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);
