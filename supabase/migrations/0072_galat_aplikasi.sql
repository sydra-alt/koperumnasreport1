-- 0072 -- Log galat aplikasi (7 Oktober 2026): log error terkecil yang berguna.
--
-- Sebelumnya error hanya diketahui kalau ada yang melapor (log runtime Vercel Hobby
-- pendek). Sekarang error server (instrumentation.ts onRequestError) dan error layar
-- (app/error.tsx) dicatat di tabel sendiri -- tanpa layanan luar, tanpa pendaftaran.
--
-- - Tulis HANYA lewat catat_galat() (security definer). Peran diambil dari sesi
--   pemanggil (tabel role) di SQL -- tidak bisa dipalsukan, tanpa nama/email.
--   Pesan DISENSOR di sini (email, angka >= 4 digit = PIN/telepon/nominal, token,
--   "password=..."), rute tanpa query string, dipotong 300 karakter. Rem 60
--   baris/menit untuk semua pemanggil; disimpan 2000 baris terbaru.
-- - Baca: CEO/Admin saja (is_admin()). Tidak ada policy insert/update/delete.
-- - Jumlah per hari lewat view v_galat_per_hari (security_invoker = on, aturan #8).
--
-- ADITIF: satu tabel, dua fungsi, satu view. Tidak ada yang diubah/dihapus.

begin;

create table public.galat_aplikasi (
  id           bigint generated always as identity primary key,
  terjadi_pada timestamptz not null default now(),
  sumber       text not null check (sumber in ('server', 'browser')),
  rute         text not null,
  metode       text,
  peran        text,
  pesan        text not null,
  digest       text
);
create index galat_aplikasi_waktu on public.galat_aplikasi (terjadi_pada desc);
alter table public.galat_aplikasi enable row level security;
create policy galat_aplikasi_baca on public.galat_aplikasi for select using (public.is_admin());

create or replace function public.galat_sensor(p text, p_maks int)
returns text language sql immutable set search_path = public as $$
  select left(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(coalesce(p, ''),
      '(password|kata ?sandi|pin|secret|token|key|authorization)\s*[:=]\s*\S+', '\1=[disensor]', 'gi'),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
      'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*', '[token]', 'g'),
      '[A-Za-z0-9_-]{32,}', '[token]', 'g'),
      '[0-9]{4,}', '[angka]', 'g'),
    p_maks)
$$;

create or replace function public.catat_galat(p_sumber text, p_rute text, p_metode text, p_pesan text, p_digest text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_peran text;
begin
  if p_sumber is null or p_sumber not in ('server', 'browser') then return; end if;
  if (select count(*) from galat_aplikasi where terjadi_pada > now() - interval '1 minute') >= 60 then return; end if;
  select string_agg(r.role, ',' order by r.role) into v_peran from role r where r.user_id = auth.uid();
  insert into galat_aplikasi (sumber, rute, metode, peran, pesan, digest)
  values (
    p_sumber,
    coalesce(nullif(galat_sensor(split_part(coalesce(p_rute, ''), '?', 1), 200), ''), '-'),
    left(p_metode, 10),
    coalesce(v_peran, case when auth.uid() is null then 'tanpa sesi' else 'tanpa peran' end),
    coalesce(nullif(galat_sensor(p_pesan, 300), ''), '-'),
    left(regexp_replace(coalesce(p_digest, ''), '[^A-Za-z0-9_-]', '', 'g'), 64)
  );
  delete from galat_aplikasi where id <= (select max(id) from galat_aplikasi) - 2000;
end
$$;
revoke all on function public.catat_galat(text, text, text, text, text) from public;
grant execute on function public.catat_galat(text, text, text, text, text) to anon, authenticated;

create view public.v_galat_per_hari with (security_invoker = on) as
  select (terjadi_pada at time zone 'Asia/Jakarta')::date as tanggal,
         count(*) filter (where sumber = 'server')::int  as server,
         count(*) filter (where sumber = 'browser')::int as browser
  from public.galat_aplikasi
  group by 1;

commit;
