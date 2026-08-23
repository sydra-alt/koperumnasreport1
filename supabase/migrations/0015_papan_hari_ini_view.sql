-- Task 18: Papan Kontrol. View persis 03-CALC-SPEC.md §4.1, dengan SATU
-- tambahan terhadap versi dokumen: kolom `nudged_at` lewat LEFT JOIN kedua
-- ke `report` (tanpa syarat status <> 'draft') supaya tombol "Tagih" (yang
-- menyentuh baris DRAFT, lihat tagih_laporan() di bawah) tetap kelihatan
-- hasilnya di Papan Kontrol walau laporannya sendiri belum terkirim.
-- security_invoker = ON -- pembacanya (pusat/ceo) memang berhak atas baris
-- `report` non-accounting lewat can_see_report() yang sudah ada, dan
-- `assignment`/`profile` sudah broadly readable (0002_rls.sql). Bukan kasus
-- §3.4b (tidak butuh security definer).
create or replace view public.v_papan_hari_ini as
select
  a.id                as assignment_id,
  a.form_key,
  a.lokasi_id, a.outlet_id,
  coalesce(l.nama, o.nama, a.form_key) as scope_nama,
  pr.nama             as pic_nama,
  r.id                as report_id,
  r.status,
  r.warna,
  r.submitted_at,
  rn.nudged_at
from public.assignment a
join public.profile pr on pr.id = a.user_id and pr.aktif
left join public.lokasi l on l.id = a.lokasi_id
left join public.outlet o on o.id = a.outlet_id
left join public.report r
       on r.form_key = a.form_key
      and r.author_id = a.user_id
      and r.tanggal  = (now() at time zone 'Asia/Jakarta')::date
      and coalesce(r.lokasi_id, r.outlet_id) is not distinct from coalesce(a.lokasi_id, a.outlet_id)
      and r.status <> 'draft'
left join public.report rn
       on rn.form_key = a.form_key
      and rn.author_id = a.user_id
      and rn.tanggal  = (now() at time zone 'Asia/Jakarta')::date
      and coalesce(rn.lokasi_id, rn.outlet_id) is not distinct from coalesce(a.lokasi_id, a.outlet_id);

alter view public.v_papan_hari_ini set (security_invoker = on);

-- `tagih_laporan` disiapkan sebagai stub kosong di 0002_rls.sql ("implementasi
-- menyusul di Task 18"). Diselesaikan di sini: tombol "Tagih" tidak bisa
-- UPDATE report.nudged_at langsung (policy report_nudge SENGAJA dihapus,
-- lihat 04-CATATAN-TEKNIS.md §3.2 -- with check(true) di situ terlalu
-- longgar). Jalan yang benar: RPC security definer, dan karena kartu
-- "belum lapor" secara definisi BELUM PUNYA baris report sama sekali, RPC
-- ini INSERT baris draft dulu (sekali) kalau belum ada, baru SET nudged_at --
-- pola sisipkan-sekali-lalu-update yang sama dengan useSimpanDraft
-- (lib/api/report.ts), supaya PIC yang belakangan mengisi laporannya sendiri
-- tetap mengisi baris draft yang SAMA, bukan baris kedua yang bentrok
-- report_uniq.
create or replace function public.tagih_laporan(assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
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

  insert into public.report (form_key, tanggal, author_id, lokasi_id, outlet_id, shift, nudged_at)
  values (a.form_key, (now() at time zone 'Asia/Jakarta')::date, a.user_id, a.lokasi_id, a.outlet_id, a.shift, now())
  on conflict (form_key, tanggal, author_id,
               coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
               coalesce(shift, '-'))
  do update set nudged_at = now();
end $$;
