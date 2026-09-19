-- Acuan jam masuk memakai jadwal_operasional untuk titik outlet (19 September
-- 2026, keputusan CEO setelah laporan poin 1: urutan usulan disetujui).
--
-- URUTAN JAM ACUAN (jam_masuk_acuan):
--   1. penugasan_absen.jam_masuk         override per orang per titik -- MENANG
--                                        atas semuanya, termasuk di hari outlet 24 jam
--   2. jadwal_operasional (0055)         HANYA titik yang terhubung outlet (lokasi_absen.outlet_id),
--                                        baris hari itu:
--                                          - jam_buka terisi        -> jam_buka
--                                          - buka_24_jam / jam_buka null / tidak ada baris hari itu
--                                                                   -> NULL (tidak dinilai)
--   3. policy.jam_masuk                  titik tanpa outlet (Kantor Pusat, Bekasi, Tajur),
--                                        dan outlet yang jadwalnya BELUM diisi sama sekali
--
-- HARI KERJA (hari_kerja_titik) -- dipisah dari jam acuan karena pertanyaannya beda:
--   - titik outlet dengan jadwal terisi: hari kerja = ada baris jadwal hari itu
--     (Indosteak buka 7 hari -> Minggu tetap dinilai; policy.workdays TIDAK dipakai)
--   - selain itu (titik tanpa outlet / outlet tanpa jadwal sama sekali): policy.workdays
--
-- Jam buka BUKAN jam kerja per se: memakainya berarti karyawan wajib hadir tepat
-- jam buka (+ toleransi). Ini keputusan CEO, bukan tebakan.
-- SHIFT SORE: cukup override per orang (baris 1). Jadwal per shift SENGAJA belum
-- dibangun sampai rotasi benar-benar terjadi.
--
-- Trigger absensi_hitung_server TIDAK disentuh -- hanya isi fungsi yang dipanggilnya.

begin;

create or replace function public.jam_masuk_acuan(p_user_id uuid, p_lokasi_absen_id uuid, p_tanggal date)
returns text
language plpgsql stable set search_path = public as $$
declare
  v_override text;
  v_outlet   uuid;
  v_jadwal   record;
begin
  select nullif(trim(pa.jam_masuk), '') into v_override
  from public.penugasan_absen pa
  where pa.user_id = p_user_id and pa.lokasi_absen_id = p_lokasi_absen_id;
  if v_override is not null then
    return v_override;
  end if;

  select la.outlet_id into v_outlet from public.lokasi_absen la where la.id = p_lokasi_absen_id;
  if v_outlet is not null and exists (select 1 from public.jadwal_operasional j where j.outlet_id = v_outlet) then
    select * into v_jadwal from public.jadwal_operasional j
      where j.outlet_id = v_outlet and j.hari_iso = extract(isodow from p_tanggal)::int;
    if not found or v_jadwal.buka_24_jam or v_jadwal.jam_buka is null then
      return null; -- tidak ada jam masuk yang bisa dijadikan acuan -> tidak dinilai
    end if;
    return to_char(v_jadwal.jam_buka, 'HH24:MI');
  end if;

  return (select value #>> '{}' from public.policy where key = 'jam_masuk');
end $$;

create or replace function public.hari_kerja_titik(p_lokasi_absen_id uuid, p_tanggal date)
returns boolean
language plpgsql stable set search_path = public as $$
declare
  v_outlet   uuid;
  v_hari     int := extract(isodow from p_tanggal)::int;
  v_workdays jsonb;
begin
  select la.outlet_id into v_outlet from public.lokasi_absen la where la.id = p_lokasi_absen_id;
  if v_outlet is not null and exists (select 1 from public.jadwal_operasional j where j.outlet_id = v_outlet) then
    return exists (select 1 from public.jadwal_operasional j where j.outlet_id = v_outlet and j.hari_iso = v_hari);
  end if;

  -- Kunci policy tidak ada -> anggap hari kerja (gagal ke arah "hitung").
  select value into v_workdays from public.policy where key = 'workdays';
  return v_workdays is null or v_workdays @> to_jsonb(v_hari);
end $$;

-- Sama dengan 0059, kecuali aturan 1 kini lewat hari_kerja_titik().
create or replace function public.hitung_terlambat_menit(p_user_id uuid, p_lokasi_absen_id uuid, p_waktu timestamptz)
returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_wib       timestamp := p_waktu at time zone 'Asia/Jakarta';
  v_tanggal   date := v_wib::date;
  v_acuan     text;
  v_toleransi int;
  v_selisih   int;
begin
  -- Aturan 1: hari kerja menurut titik (jadwal outlet, atau policy.workdays).
  if not public.hari_kerja_titik(p_lokasi_absen_id, v_tanggal) then
    return null;
  end if;

  -- Aturan 2: cuti/sakit/izin yang sudah disetujui.
  if exists (
    select 1 from public.cuti c
    where c.user_id = p_user_id and c.status = 'disetujui'
      and v_tanggal between c.tanggal_mulai and c.tanggal_selesai
  ) then
    return null;
  end if;

  -- Aturan 3.
  v_acuan := public.jam_masuk_acuan(p_user_id, p_lokasi_absen_id, v_tanggal);
  if v_acuan is null then
    return null; -- tidak ada acuan (mis. outlet 24 jam tanpa override): jujur "tidak dinilai"
  end if;
  select (value #>> '{}')::int into v_toleransi from public.policy where key = 'toleransi_terlambat_menit';

  v_selisih := (extract(hour from v_wib)::int * 60 + extract(minute from v_wib)::int)
             - (split_part(v_acuan, ':', 1)::int * 60 + split_part(v_acuan, ':', 2)::int)
             - coalesce(v_toleransi, 0);
  return greatest(v_selisih, 0);
end $$;

revoke all on function public.hitung_terlambat_menit(uuid, uuid, timestamptz) from public, anon, authenticated;

commit;
