-- Paksa ganti password (instruksi eksplisit user, 30 Agustus 2026) --
-- semua 39 akun dibuat dengan password awal seragam 'admin123' supaya
-- mudah dibagikan CEO, TAPI cuma aman kalau paksaan ganti dibangun
-- BERSAMAAN, bukan menyusul. Alasan user sendiri: begitu satu orang tahu
-- polanya, dia bisa login sebagai siapa pun yang belum ganti -- termasuk
-- Shabita (accounting, laporan berisi saldo bank & prioritas pembayaran).
-- RLS tidak menolong kalau pintunya dibuka dengan password yang benar.
alter table public.profile add column harus_ganti_password boolean not null default true;

-- Perluasan jaga_profil_sensitif() (trigger sudah ada sejak 0028/0029) --
-- pola SAMA PERSIS: blokir non-service/non-ceo dari mengubah kolom
-- sensitif secara langsung. `harus_ganti_password` HANYA boleh dimatikan
-- (true -> false) lewat proses ganti password resmi (app/api/ganti-
-- password/route.ts, service role, auth.uid() null di konteks itu) --
-- TANPA guard ini, siapa pun bisa langsung `update profile set
-- harus_ganti_password=false` lewat REST tanpa pernah benar-benar mengganti
-- password, MEMATIKAN seluruh mekanisme paksaan ini secara diam-diam --
-- persis pola celah yang sudah ditemukan berulang kali di sesi ini
-- (cuti_insert, decision_insert, absensi_insert, profile.divisi/aktif).
-- Menyalakan (false -> true, lewat "Atur ulang kata sandi" CEO) TIDAK
-- diblokir arah itu -- cuma arah mematikan yang dijaga.
create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role('ceo') then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO yang boleh mengubah divisi atau status aktif.';
    end if;
    if old.harus_ganti_password = true and new.harus_ganti_password = false then
      raise exception 'harus_ganti_password hanya bisa dimatikan lewat proses ganti password resmi.';
    end if;
  end if;
  return new;
end $$;
