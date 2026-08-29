-- Task pra-peluncuran -- jejak audit untuk "Atur ulang kata sandi" di halaman
-- Admin. Tidak ada alur "lupa password" mandiri (lihat docs/07-CATATAN-
-- PELUNCURAN.md) -- satu-satunya jalan reset adalah CEO lewat halaman ini,
-- jadi wajib tercatat siapa mengatur ulang kata sandi siapa dan kapan.
--
-- Baris cuma pernah ditulis oleh Route Handler lewat service_role (RLS
-- dilewati di jalur itu, sama seperti pembuatan pengguna baru), karena itu
-- TIDAK ada policy insert/update/delete di sini sama sekali -- tanpa policy
-- itu, insert/update/delete dari klien biasa (anon/authenticated) otomatis
-- ditolak RLS, cuma service_role yang bisa menulis.
create table public.reset_password_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.reset_password_log enable row level security;

create policy reset_password_log_select on public.reset_password_log
  for select using (public.has_role('ceo'));
