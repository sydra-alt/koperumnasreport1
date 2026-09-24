-- ═══════════════════════════════════════════════════════════════════════
-- 0063_audit_review.sql
-- Tabel pengecatan "sudah ditinjau" per outlet per hari oleh auditor.
-- ───────────────────────────────────────────────────────────────────────
-- Kolom:
--   id            UUID PK
--   outlet_id     FK → outlet.id  (outlet yang ditinjau)
--   tanggal       DATE             (hari operasi yang ditinjau, BUKAN tanggal review)
--   reviewer_id   FK → profile.id (siapa yang meninjau)
--   ditinjau_pada TIMESTAMPTZ     (kapan review dilakukan — may differ from tanggal)
--   catatan       TEXT             (opsional)
--   created_at    TIMESTAMPTZ
-- ───────────────────────────────────────────────────────────────────────
-- Unique: satu user hanya boleh meninjau SATU outlet untuk SATU tanggal
--          operasi sekali. Tapi user berbeda boleh meninjau outlet sama
--          untuk tanggal sama (mis. Ita + Rika bersama-sama).
-- ───────────────────────────────────────────────────────────────────────

create table if not exists public.audit_review (
  id            uuid primary key default gen_random_uuid(),
  outlet_id     uuid not null references public.outlet(id) on delete cascade,
  tanggal      date not null,
  reviewer_id  uuid not null references public.profile(id) on delete cascade,
  ditinjau_pada timestamptz not null default now(),
  catatan      text,
  created_at   timestamptz not null default now()
);

alter table public.audit_review enable row level security;

-- Baca: user boleh baca hanya review yang mereka buat sendiri,
--       kecuali CEO baca semua.
create policy audit_review_select on public.audit_review for select
  using (
    reviewer_id = auth.uid()
    or public.has_role('ceo')
  );

-- Insert: hanya reviewer sendiri yang boleh insert review untuk diri mereka,
--         kecuali CEO.
create policy audit_review_insert on public.audit_review for insert
  with check (
    reviewer_id = auth.uid()
    or public.has_role('ceo')
  );

-- Update: hanya review sendiri yang boleh diupdate (mis. edit catatan),
--         kecuali CEO.
create policy audit_review_update on public.audit_review for update
  using (
    reviewer_id = auth.uid()
    or public.has_role('ceo')
  )
  with check (
    reviewer_id = auth.uid()
    or public.has_role('ceo')
  );

-- Delete: hanya review sendiri yang boleh dihapus, kecuali CEO.
create policy audit_review_delete on public.audit_review for delete
  using (
    reviewer_id = auth.uid()
    or public.has_role('ceo')
  );

-- Index: query per outlet + tanggal + reviewer
create index if not exists audit_review_outlet_tanggal_idx
  on public.audit_review (outlet_id, tanggal, reviewer_id);
