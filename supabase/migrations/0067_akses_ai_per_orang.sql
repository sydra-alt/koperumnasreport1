-- Akses asisten AI PER ORANG, bukan per peran (29 September 2026, instruksi
-- CEO). Yang memakai asisten cuma akun CEO/Direksi dan Ita (Kontrol FnB,
-- peran 'karyawan'), mungkin satu orang IT nanti -- daftar peran
-- (`ai_peran_boleh`, migrasi 0064) tidak bisa menyatakan itu tanpa ikut
-- membuka semua orang lain yang berperan sama.
--
-- Pola sama `punya_akses_pos` (0063): kolom boolean di profile, default
-- false, hanya CEO/Admin yang boleh mengubah (jaga_profil_sensitif), diatur
-- lewat Admin. Kunci policy `ai_peran_boleh` DIHAPUS supaya tidak ada yang
-- mengira masih dipakai.
--
-- TANPA begin/commit sendiri: scripts/db.mjs yang membungkus berkas ini
-- dalam satu transaksi (pratinjau = ROLLBACK, --jalankan=HAPUS = COMMIT).

alter table public.profile add column punya_akses_ai boolean not null default false;

comment on column public.profile.punya_akses_ai is
  'Boleh memakai Asisten AI (/asisten). Gerbang sungguhan: boleh_pakai_ai() + RLS ai_percakapan/ai_pesan. Hanya CEO/Admin yang boleh mengubah.';

create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO/Admin yang boleh mengubah divisi atau status aktif.';
    end if;
    if old.harus_ganti_password = true and new.harus_ganti_password = false then
      raise exception 'harus_ganti_password hanya bisa dimatikan lewat proses ganti password resmi.';
    end if;
    if new.wajib_pte is distinct from old.wajib_pte or new.alasan_bebas_pte is distinct from old.alasan_bebas_pte then
      raise exception 'Hanya CEO/Admin yang boleh mengubah status wajib PTE.';
    end if;
    if new.punya_akses_pos is distinct from old.punya_akses_pos then
      raise exception 'Hanya CEO/Admin yang boleh mengubah akses tombol POS.';
    end if;
    if new.akun_uji is distinct from old.akun_uji then
      raise exception 'Hanya CEO/Admin yang boleh mengubah tanda akun uji.';
    end if;
    if new.punya_akses_ai is distinct from old.punya_akses_ai then
      raise exception 'Hanya CEO/Admin yang boleh mengubah akses Asisten AI.';
    end if;
  end if;
  return new;
end $$;

-- Gerbang masuk: orang ini sendiri punya tanda akses DAN profilnya aktif.
-- Peran tidak lagi menentukan apa pun di sini.
create or replace function public.boleh_pakai_ai()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile p
    where p.id = auth.uid() and p.aktif and p.punya_akses_ai
  );
$$;

-- "Aktif" kini cuma soal batas pesan harian (> 0). Siapa yang boleh adalah
-- urusan boleh_pakai_ai() per orang.
create or replace function public.ai_status()
returns table (aktif boolean, boleh boolean, batas int, terpakai int)
language sql stable security definer set search_path = public as $$
  with p as (
    select coalesce((select (value #>> '{}')::int from public.policy where key = 'ai_batas_pesan_harian'), 0) as batas
  )
  select
    p.batas > 0,
    public.boleh_pakai_ai(),
    p.batas,
    public.ai_terpakai_hari_ini(auth.uid())
  from p;
$$;

delete from public.policy where key = 'ai_peran_boleh';

-- Akun CEO/Direksi (Putri; AKUN UJI - CEO dipakai uji browser) dan Ita.
-- Daftar EKSPLISIT per email.
update public.profile set punya_akses_ai = true
where id in (
  select id from auth.users where email in (
    'putri@koperumnas.local', 'ita@koperumnas.local', 'uji-ceo@koperumnas.local'
  )
);
