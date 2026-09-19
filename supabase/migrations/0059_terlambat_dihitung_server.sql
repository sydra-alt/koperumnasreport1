-- Keterlambatan dihitung di SERVER, bukan dipercaya dari klien (19 September
-- 2026, instruksi CEO: "begitu pte_mulai_berlaku diisi, angka ini jadi
-- potongan gaji -- siapa pun bisa mengirim nol setiap hari").
--
-- Sebelumnya: app/absen/page.tsx menghitung terlambat_menit di browser dan
-- insert ke `absensi` mengirimnya apa adanya; tidak ada constraint/trigger
-- yang memeriksa. Sekarang trigger BEFORE INSERT menimpa tiga kolom dari
-- jam SERVER:
--   waktu           := now()                     (klien tidak bisa memalsukan jam absen)
--   tanggal         := tanggal WIB dari now()    (tidak bisa absen untuk tanggal lain)
--   terlambat_menit := hasil hitung_terlambat_menit()
-- Insert dari koneksi tanpa JWT (owner/skrip/service_role -> auth.uid() null)
-- TIDAK ditimpa, supaya isi-ulang data oleh admin tetap mungkin.
--
-- ATURAN (masing-masing berlaku per baris 'masuk'; 'pulang' selalu null):
--   1. Hari di luar policy.workdays        -> null (tidak dinilai)
--   2. Cuti/sakit/izin berstatus 'disetujui' menutup tanggal itu -> null
--   3. Selain itu: menit setelah (jam acuan + toleransi), minimal 0.
--   null = "tidak dinilai", BEDA dengan 0 = "tepat waktu".
--
-- JAM ACUAN sengaja dipisah ke SATU fungsi (`jam_masuk_acuan`) supaya
-- keputusan urutan acuan (penugasan_absen -> jadwal_operasional outlet ->
-- policy) cukup mengganti isi fungsi itu, tanpa menyentuh trigger.
-- SAAT INI urutannya SAMA dengan yang dipakai klien sebelumnya:
--   penugasan_absen.jam_masuk -> policy.jam_masuk.
-- `jadwal_operasional` (0055) BELUM dipakai -- menunggu keputusan CEO.

begin;

-- ─── 1. Jam acuan (SATU tempat) ───────────────────────────────────────────
-- Invoker biasa: yang dibaca (penugasan_absen, policy) memang terbuka untuk
-- semua yang login, jadi presensi_untuk_tanggal() di bawah boleh memakainya.
create or replace function public.jam_masuk_acuan(p_user_id uuid, p_lokasi_absen_id uuid, p_tanggal date)
returns text
language sql stable set search_path = public as $$
  select coalesce(
    (select nullif(trim(pa.jam_masuk), '') from public.penugasan_absen pa
      where pa.user_id = p_user_id and pa.lokasi_absen_id = p_lokasi_absen_id),
    (select value #>> '{}' from public.policy where key = 'jam_masuk')
  );
$$;

-- ─── 2. Hitung terlambat ─────────────────────────────────────────────────
-- security definer: membaca `cuti` milik orang lain tanpa bergantung pada
-- RLS pemanggil. Karena itu EXECUTE-nya DICABUT dari klien (di bawah) --
-- kalau tidak, siapa pun bisa menanyakan status cuti orang lain lewat RPC.
create or replace function public.hitung_terlambat_menit(p_user_id uuid, p_lokasi_absen_id uuid, p_waktu timestamptz)
returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_wib       timestamp := p_waktu at time zone 'Asia/Jakarta';
  v_tanggal   date := v_wib::date;
  v_hari_iso  int := extract(isodow from v_wib::date);
  v_workdays  jsonb;
  v_acuan     text;
  v_toleransi int;
  v_selisih   int;
begin
  -- Aturan 1: hari di luar policy.workdays. Kunci policy tidak ada -> anggap
  -- hari kerja (gagal ke arah "hitung", bukan "sembunyikan").
  select value into v_workdays from public.policy where key = 'workdays';
  if v_workdays is not null and not (v_workdays @> to_jsonb(v_hari_iso)) then
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
    return null; -- tidak ada acuan sama sekali: jujur "tidak dinilai", bukan menebak
  end if;
  select (value #>> '{}')::int into v_toleransi from public.policy where key = 'toleransi_terlambat_menit';

  v_selisih := (extract(hour from v_wib)::int * 60 + extract(minute from v_wib)::int)
             - (split_part(v_acuan, ':', 1)::int * 60 + split_part(v_acuan, ':', 2)::int)
             - coalesce(v_toleransi, 0);
  return greatest(v_selisih, 0);
end $$;

revoke all on function public.hitung_terlambat_menit(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ─── 3. Trigger ──────────────────────────────────────────────────────────
-- security definer supaya memanggil hitung_terlambat_menit() (EXECUTE-nya
-- dicabut dari klien) tetap jalan; auth.uid() tetap terbaca (bersumber dari
-- setting JWT, bukan dari role).
create or replace function public.absensi_hitung_server()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- owner/skrip/service_role: bukan jalur klien, jangan ditimpa
  end if;

  -- Titik yang dipakai menentukan jam acuan -- harus benar-benar ditugaskan
  -- ke orang ini, kalau tidak klien bisa memilih titik "yang jamnya enak".
  if new.lokasi_absen_id is null or not exists (
    select 1 from public.penugasan_absen pa
    where pa.user_id = new.user_id and pa.lokasi_absen_id = new.lokasi_absen_id
  ) then
    raise exception 'Titik absen ini tidak ditugaskan kepada Anda.';
  end if;

  new.waktu := now();
  new.tanggal := (now() at time zone 'Asia/Jakarta')::date;
  new.terlambat_menit := case
    when new.tipe = 'masuk' then public.hitung_terlambat_menit(new.user_id, new.lokasi_absen_id, new.waktu)
    else null
  end;
  return new;
end $$;

create or replace trigger absensi_hitung_server
  before insert on public.absensi
  for each row execute function public.absensi_hitung_server();

-- ─── 4. Kolom "jam masuk efektif" di Tinjau Absensi ─────────────────────────
-- Dulu menyalin logika coalesce sendiri; sekarang memanggil fungsi acuan yang
-- SAMA dengan yang dipakai menghitung, supaya tampilan penelusuran tidak
-- pernah bisa menyimpang dari angka tersimpan. Signature/return type sama.
create or replace function public.presensi_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  user_id               uuid,
  nama                  text,
  titik_nama            text,
  masuk_id              uuid,
  jam_masuk             timestamptz,
  masuk_jam_efektif     text,
  terlambat_menit       int,
  status_masuk          absen_status,
  masuk_foto_path       text,
  masuk_lat             double precision,
  masuk_lon             double precision,
  masuk_jarak_meter     double precision,
  masuk_akurasi_meter   double precision,
  masuk_keputusan_hrd   absen_keputusan,
  masuk_catatan         text,
  pulang_id             uuid,
  jam_pulang            timestamptz,
  status_pulang         absen_status,
  pulang_foto_path      text,
  pulang_lat            double precision,
  pulang_lon            double precision,
  pulang_jarak_meter    double precision,
  pulang_akurasi_meter  double precision,
  pulang_keputusan_hrd  absen_keputusan,
  pulang_catatan        text
)
language sql stable as $$
  select
    p.id,
    p.nama,
    coalesce(
      (select la.nama from public.lokasi_absen la where la.id = masuk.lokasi_absen_id),
      (select la.nama from public.lokasi_absen la where la.id = pulang.lokasi_absen_id),
      (select string_agg(la.nama, ' / ' order by la.nama)
         from public.penugasan_absen pa join public.lokasi_absen la on la.id = pa.lokasi_absen_id
         where pa.user_id = p.id)
    ),
    masuk.id, masuk.waktu,
    case when masuk.id is not null then public.jam_masuk_acuan(p.id, masuk.lokasi_absen_id, masuk.tanggal) end,
    masuk.terlambat_menit, masuk.status, masuk.foto_path,
    masuk.latitude, masuk.longitude, masuk.jarak_meter, masuk.akurasi_meter,
    masuk.keputusan_hrd, masuk.catatan,
    pulang.id, pulang.waktu, pulang.status, pulang.foto_path,
    pulang.latitude, pulang.longitude, pulang.jarak_meter, pulang.akurasi_meter,
    pulang.keputusan_hrd, pulang.catatan
  from public.profile p
  left join public.absensi masuk on masuk.user_id = p.id and masuk.tanggal = p_tanggal and masuk.tipe = 'masuk'
  left join public.absensi pulang on pulang.user_id = p.id and pulang.tanggal = p_tanggal and pulang.tipe = 'pulang'
  where p.aktif and exists (select 1 from public.penugasan_absen pa where pa.user_id = p.id)
  order by p.nama;
$$;

commit;
