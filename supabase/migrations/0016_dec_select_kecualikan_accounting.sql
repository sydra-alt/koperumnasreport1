-- Task 19 (Antrean Keputusan CEO): ditemukan saat membangun halaman ini --
-- policy `dec_select` (0002_rls.sql) mengizinkan role `pusat` melihat SEMUA
-- baris `decision`, tanpa kecuali. Waktu ditulis (Task 04), `decision` belum
-- pernah dibuat dari laporan `accounting`. Sejak Task 17 (blok 16 "Prioritas
-- Pembayaran", `sumberKeputusan`), laporan `accounting` MEMANG membuat baris
-- `decision` -- dan `dec_select` yang lama membiarkan Pusat membacanya
-- (judul, nominal, dampak) lewat halaman Antrean Keputusan ini, melanggar
-- CLAUDE.md aturan #3 ("Laporan accounting hanya boleh terbaca role ceo")
-- dan komentar 0002_rls.sql sendiri ("pusat and f <> 'accounting' adalah
-- inti kerahasiaan"). Bukan disembunyikan di UI saja (§7 poin 6) -- policy-nya
-- diperbaiki di database.
drop policy if exists dec_select on public.decision;
create policy dec_select on public.decision for select using (
  public.has_role('ceo')
  or (
    public.has_role('pusat')
    and not exists (select 1 from public.report r where r.id = report_id and r.form_key = 'accounting')
  )
  or exists (select 1 from public.report r where r.id = report_id and r.author_id = auth.uid())
);
