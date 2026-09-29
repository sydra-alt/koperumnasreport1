-- Akses pos-fnb DITURUNKAN dari sistem laporan (29 September 2026, disetujui
-- CEO). Sistem laporan jadi satu-satunya sumber kebenaran "siapa bekerja di
-- mana": orang masuk sekali di sini, pos-fnb membuat/menyesuaikan akunnya
-- sendiri dari hasil fungsi akses_pos_saya() di bawah (dibawa token handoff
-- bertanda tangan, lihat CLAUDE.md #13 yang diperbarui).
--
-- Kunci pemetaan = PERAN laporan ATAU FORM PENUGASAN (bukan peran saja --
-- peran 'karyawan' dipegang 17 orang dengan pekerjaan sangat berbeda; yang
-- membedakan Kontrol FnB dari petugas kebersihan adalah form penugasannya).
--
-- Batas keras (juga dijaga pos-fnb, tidak bergantung ke sini):
-- - paling tinggi 'manager'; 'owner' dan 'accountant' TIDAK PERNAH bisa
--   diberikan dari sini (check di bawah)
-- - tidak dipetakan / punya_akses_pos = false / tanpa outlet = DITOLAK
--
-- TANPA begin/commit sendiri (scripts/db.mjs yang membungkus).

-- ─── 1. Tanda per orang: akses SEMUA outlet POS (hanya CEO/Admin) ────────
alter table public.profile add column akses_semua_outlet_pos boolean not null default false;
comment on column public.profile.akses_semua_outlet_pos is
  'Semua outlet POS termasuk Bestie Thrift + audit_all_outlets di pos-fnb, tanpa perlu penugasan di tiap outlet (penugasan juga menimbulkan kewajiban laporan harian). Hanya CEO/Admin yang boleh mengubah.';

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
    if new.akses_semua_outlet_pos is distinct from old.akses_semua_outlet_pos then
      raise exception 'Hanya CEO/Admin yang boleh mengubah akses semua outlet POS.';
    end if;
  end if;
  return new;
end $$;

-- ─── 2. Bestie Thrift: diberikan lewat form 'thrifting', bukan outlet laporan
alter table public.outlet_pos_map add column form_akses text unique;
comment on column public.outlet_pos_map.form_akses is
  'Outlet POS yang diberikan langsung oleh form penugasan ini (mis. thrifting -> Bestie Thrift), untuk outlet yang TIDAK punya padanan outlet laporan.';
comment on column public.outlet_pos_map.diabaikan is
  'Dikecualikan dari sinkron omzet POS (flag eksplisit). Tidak memengaruhi akses POS -- akses lewat outlet_id atau form_akses.';

update public.outlet_pos_map set form_akses = 'thrifting'
where pos_outlet_id = '01a08e38-0737-7e92-8fb1-1bf597e0c6a7' and diabaikan;

-- ─── 3. Peta peran/form laporan -> peran pos-fnb (hanya CEO/Admin) ──────
create table public.peta_akses_pos (
  sumber     text not null check (sumber in ('peran', 'form')),
  kunci      text not null,
  -- 'owner' dan 'accountant' SENGAJA tidak ada: provisioning paling tinggi manager,
  -- dan accountant di pos-fnb selalu tanpa batas outlet.
  peran_pos  text not null check (peran_pos in ('manager', 'warehouse', 'cashier', 'waiter', 'kitchen')),
  cakupan    text not null check (cakupan in ('penugasan', 'semua')),
  catatan    text,
  primary key (sumber, kunci)
);
alter table public.peta_akses_pos enable row level security;
create policy peta_akses_pos_select on public.peta_akses_pos for select using (public.is_admin());
create policy peta_akses_pos_kelola on public.peta_akses_pos for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.peta_akses_pos from anon;

insert into public.peta_akses_pos (sumber, kunci, peran_pos, cakupan, catatan) values
  ('peran', 'ceo',           'manager', 'semua',     'Direksi. Owner pos-fnb yang sudah ada tidak pernah diubah; akun baru paling tinggi manager.'),
  ('form',  'kontrol_fnb',   'manager', 'penugasan', 'Kontrol FnB -- outlet dari penugasan. audit_all_outlets HANYA dari tanda akses_semua_outlet_pos.'),
  ('form',  'manager_resto', 'manager', 'penugasan', 'Manajer resto -- outlet dari penugasan.'),
  ('form',  'thrifting',     'manager', 'penugasan', 'Thrifting -> Bestie Thrift (outlet_pos_map.form_akses).');

-- ─── 4. Akses POS pemanggil -- dihitung DI SINI, dibawa token handoff ─────
-- security definer: petugas biasa tidak bisa membaca outlet_pos_map /
-- peta_akses_pos sendiri, tapi berhak tahu aksesnya SENDIRI (auth.uid() saja,
-- tidak ada parameter orang lain).
create or replace function public.akses_pos_saya()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_aktif boolean;
  v_punya boolean;
  v_semua_flag boolean;
  v_cocok int;
  v_peran text;
  v_semua boolean;
  v_outlet uuid[];
begin
  select aktif, punya_akses_pos, akses_semua_outlet_pos into v_aktif, v_punya, v_semua_flag
  from public.profile where id = v_uid;
  if v_aktif is null or not v_aktif then
    return jsonb_build_object('boleh', false, 'alasan', 'nonaktif');
  end if;
  if not v_punya then
    return jsonb_build_object('boleh', false, 'alasan', 'tanpa_akses_pos');
  end if;

  select count(*),
         (array_agg(m.peran_pos order by case m.peran_pos
            when 'manager' then 1 when 'warehouse' then 2 when 'cashier' then 3 when 'waiter' then 4 else 5 end))[1],
         coalesce(bool_or(m.cakupan = 'semua'), false)
    into v_cocok, v_peran, v_semua
  from public.peta_akses_pos m
  where (m.sumber = 'peran' and exists (select 1 from public.role r where r.user_id = v_uid and r.role = m.kunci))
     or (m.sumber = 'form' and exists (select 1 from public.assignment a where a.user_id = v_uid and a.form_key = m.kunci));

  if v_semua_flag then
    v_semua := true;
    v_peran := coalesce(v_peran, 'manager');
  elsif v_cocok = 0 then
    return jsonb_build_object('boleh', false, 'alasan', 'peran_tidak_dipetakan');
  end if;

  if not v_semua then
    select coalesce(array_agg(distinct x.pos_outlet_id), '{}') into v_outlet
    from (
      select opm.pos_outlet_id
      from public.assignment a
      join public.peta_akses_pos m on m.sumber = 'form' and m.kunci = a.form_key and m.cakupan = 'penugasan'
      join public.outlet_pos_map opm on opm.outlet_id = a.outlet_id
      where a.user_id = v_uid and a.outlet_id is not null
      union
      select opm.pos_outlet_id
      from public.assignment a
      join public.peta_akses_pos m on m.sumber = 'form' and m.kunci = a.form_key and m.cakupan = 'penugasan'
      join public.outlet_pos_map opm on opm.form_akses = a.form_key
      where a.user_id = v_uid
    ) x;
    if cardinality(v_outlet) = 0 then
      return jsonb_build_object('boleh', false, 'alasan', 'tanpa_outlet');
    end if;
  end if;

  return jsonb_build_object(
    'boleh', true,
    'peran_pos', v_peran,
    'semua_outlet', v_semua,
    'audit_semua', v_semua_flag,
    'outlet_pos_ids', case when v_semua then null else to_jsonb(v_outlet) end
  );
end $$;
revoke all on function public.akses_pos_saya() from public, anon;
grant execute on function public.akses_pos_saya() to authenticated;

-- ─── 5. Tanda awal (disetujui CEO) ──────────────────────────────────────
-- Empat manajer resto + Mba Rika; AKUN UJI - CEO untuk uji produksi.
update public.profile set punya_akses_pos = true
where id in (select id from auth.users where email in (
  'cuko@koperumnas.local', 'dea@koperumnas.local', 'ery@koperumnas.local', 'toni@koperumnas.local',
  'rika@koperumnas.local', 'uji-ceo@koperumnas.local'
));
-- Ita saja: semua outlet POS + audit_all_outlets.
update public.profile set akses_semua_outlet_pos = true
where id in (select id from auth.users where email = 'ita@koperumnas.local');
