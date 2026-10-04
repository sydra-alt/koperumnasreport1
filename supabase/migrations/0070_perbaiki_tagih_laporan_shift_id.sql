-- 0070 -- tagih_laporan() memakai shift_id (4 Oktober 2026).
--
-- BUG PRODUKSI (ditemukan saat menghidupkan lagi scripts/uji-papan-kontrol.mjs):
-- badan fungsi dari 0002 masih menulis kolom teks report.shift / assignment.shift
-- yang sudah diganti shift_id (tabel shift, 0033). Akibatnya tombol "Tagih" di
-- Papan Kontrol GAGAL ("column shift of relation report does not exist") untuk
-- setiap penugasan yang belum punya baris laporan hari itu -- persis kasus yang
-- ingin ditagih.
--
-- ADITIF & KOMPATIBEL: CREATE OR REPLACE dengan tanda tangan, pemeriksaan peran
-- (pusat/ceo), dan perilaku yang sama; cuma kolom shift_id + target ON CONFLICT
-- yang mengikuti indeks report_uniq sekarang. Tidak ada baris yang diubah.

begin;

create or replace function public.tagih_laporan(assignment uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a record;
begin
  if not (public.has_role('pusat') or public.has_role('ceo')) then
    raise exception 'Tidak berhak';
  end if;

  select * into a from public.assignment where id = tagih_laporan.assignment;
  if not found then
    raise exception 'Penugasan tidak ditemukan';
  end if;

  insert into public.report (form_key, tanggal, author_id, lokasi_id, outlet_id, shift_id, nudged_at)
  values (a.form_key, (now() at time zone 'Asia/Jakarta')::date, a.user_id, a.lokasi_id, a.outlet_id, a.shift_id, now())
  on conflict (form_key, tanggal, author_id,
               coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
               coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set nudged_at = now();
end $function$;

commit;
