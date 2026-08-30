-- Peran 'admin' BARU -- akses penuh ke panel Admin (Lokasi, Outlet,
-- Penugasan, Policy, Pengguna, Titik Absen, Shift) TANPA ikut privilese
-- bisnis/keuangan CEO (laporan accounting, keputusan atas laporan orang
-- lain, rekap PTE/closing pengawasan marketing). Instruksi eksplisit user,
-- 30 Agustus 2026: Diki & Ibnu (IT) diberi akses ini supaya bisa mengelola
-- sistem (Lokasi/Outlet/Penugasan/Policy/Pengguna/Titik Absen/Shift) sendiri.
--
-- Sengaja BUKAN menambahkan mereka ke role 'ceo' -- itu otomatis membuka
-- laporan accounting lewat can_see_report() (CLAUDE.md #3: "hanya boleh
-- terbaca role ceo, pada tahap mana pun, dengan alasan apa pun") dan hak
-- memutuskan (dec_decide) laporan siapa pun -- dua hal yang TIDAK diminta.
--
-- public.is_admin() = has_role('ceo') OR has_role('admin'), dipakai HANYA
-- di policy/trigger yang menjaga tabel KONFIGURASI SISTEM (role, lokasi,
-- outlet, assignment, policy, lokasi_absen, penugasan_absen, shift,
-- profile-edit, dua log audit admin). Policy yang menjaga ISI LAPORAN
-- (can_see_report, dec_select/dec_decide, pte_select, closing_select,
-- boleh_lihat_rekap, tagih_laporan, review presensi lewat is_hrd_kadiv)
-- SENGAJA TIDAK disentuh -- tetap has_role('ceo') murni, tidak ikut meluas.

alter table public.role drop constraint role_role_check;
alter table public.role add constraint role_role_check
  check (role in ('ceo','pusat','accounting','kontrol_marketing',
                  'kadiv','pic_lokasi','manager_resto','karyawan','admin'));

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('ceo') or public.has_role('admin');
$$;

-- ─── Tabel konfigurasi sistem: tulis oleh CEO ATAU admin ──────────────
drop policy role_admin   on public.role;
drop policy lokasi_admin on public.lokasi;
drop policy outlet_admin on public.outlet;
drop policy asg_admin    on public.assignment;
drop policy policy_admin on public.policy;

create policy role_admin   on public.role       for all using (public.is_admin()) with check (public.is_admin());
create policy lokasi_admin on public.lokasi     for all using (public.is_admin()) with check (public.is_admin());
create policy outlet_admin on public.outlet     for all using (public.is_admin()) with check (public.is_admin());
create policy asg_admin    on public.assignment for all using (public.is_admin()) with check (public.is_admin());
create policy policy_admin on public.policy     for all using (public.is_admin()) with check (public.is_admin());

drop policy lokasi_absen_admin    on public.lokasi_absen;
drop policy penugasan_absen_admin on public.penugasan_absen;
create policy lokasi_absen_admin    on public.lokasi_absen    for all using (public.is_admin()) with check (public.is_admin());
create policy penugasan_absen_admin on public.penugasan_absen for all using (public.is_admin()) with check (public.is_admin());

drop policy shift_admin on public.shift;
create policy shift_admin on public.shift for all using (public.is_admin()) with check (public.is_admin());

-- profile: admin boleh mengedit profil siapa pun (Tab Pengguna) seperti CEO
drop policy profile_update on public.profile;
create policy profile_update on public.profile for update
  using (id = auth.uid() or public.is_admin());

-- log audit tindakan admin: admin ikut boleh lihat, bukan cuma CEO
drop policy reset_password_log_select on public.reset_password_log;
create policy reset_password_log_select on public.reset_password_log for select using (public.is_admin());

drop policy pte_pengecualian_log_select on public.pte_pengecualian_log;
create policy pte_pengecualian_log_select on public.pte_pengecualian_log for select using (public.is_admin());

-- Trigger yang menjaga kolom sensitif profile (divisi, aktif,
-- harus_ganti_password, wajib_pte, alasan_bebas_pte) -- admin ikut boleh,
-- persis seperti ceo. Body SAMA seperti migrasi 0035 (jebakan #13 --
-- lihat 04-CATATAN-TEKNIS.md §7), hanya has_role('ceo') diganti is_admin().
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
  end if;
  return new;
end $$;
