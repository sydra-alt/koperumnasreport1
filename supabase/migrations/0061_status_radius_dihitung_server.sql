-- Status radius dan jarak dihitung di SERVER (19 September 2026, keputusan CEO:
-- "siapa pun bisa mengirim 'valid' dari mana saja -- celah yang sama dengan
-- angka menit"). Melengkapi 0059.
--
-- Sebelumnya: klien menghitung jarak (haversine) dan status ('valid' /
-- 'di_luar_radius') lalu insert apa adanya. Sekarang trigger menimpa keduanya
-- dari KOORDINAT yang dikirim, dibandingkan titik absen yang ditugaskan
-- (lokasi_absen.latitude/longitude/radius_meter). Koordinat itu sendiri tetap
-- dari klien -- tidak ada cara lain; server hanya memastikan KEPUTUSAN
-- valid/di-luar-radius bukan kiriman HP. (GPS palsu di HP tetap tidak
-- terdeteksi server.)
--
-- Tambahan:
--   - policy.absen_di_luar_radius = 'tolak' kini ditegakkan di server juga
--     (sebelumnya hanya layar di HP).
--   - status 'manual_hrd' dari klien DITOLAK KERAS. RLS absensi_insert (0027)
--     sebenarnya sudah menolaknya, tapi BEFORE trigger berjalan SEBELUM cek
--     RLS: begitu trigger menimpa status, RLS tidak lagi melihat nilai kiriman
--     klien dan penolakan itu hilang diam-diam. Cek eksplisit di trigger
--     mempertahankan perilaku 0027. keputusan_hrd/disetujui_oleh SENGAJA tidak
--     disentuh trigger -- tetap dijaga RLS 0027 (klien yang mengirimnya ditolak).
-- Rumus haversine SAMA dengan lib/absen.ts (R = 6371000 m); batas dalam radius
-- juga sama (jarak <= radius = valid).
-- Insert tanpa JWT (owner/skrip/service_role) tetap tidak ditimpa.

begin;

create or replace function public.jarak_haversine_meter(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql immutable as $$
  select 6371000 * 2 * atan2(sqrt(a), sqrt(1 - a))
  from (
    select least(1.0, greatest(0.0,
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
    )) as a
  ) t;
$$;

create or replace function public.absensi_hitung_server()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_titik record;
begin
  if auth.uid() is null then
    return new; -- owner/skrip/service_role: bukan jalur klien, jangan ditimpa
  end if;

  -- Titik yang dipakai menentukan jam acuan DAN radius -- harus benar-benar
  -- ditugaskan ke orang ini.
  select la.latitude, la.longitude, la.radius_meter into v_titik
  from public.lokasi_absen la
  join public.penugasan_absen pa on pa.lokasi_absen_id = la.id
  where la.id = new.lokasi_absen_id and pa.user_id = new.user_id;
  if not found then
    raise exception 'Titik absen ini tidak ditugaskan kepada Anda.';
  end if;

  -- Nilai yang hanya boleh ditulis jalur HRD -- tolak keras (lihat catatan di atas).
  if new.status = 'manual_hrd' then
    raise exception 'Status presensi ini tidak boleh dikirim dari aplikasi.';
  end if;

  if new.latitude is null or new.longitude is null then
    raise exception 'Koordinat lokasi wajib disertakan.';
  end if;

  new.waktu := now();
  new.tanggal := (now() at time zone 'Asia/Jakarta')::date;

  new.jarak_meter := public.jarak_haversine_meter(new.latitude, new.longitude, v_titik.latitude, v_titik.longitude);
  new.status := (case when new.jarak_meter <= v_titik.radius_meter then 'valid' else 'di_luar_radius' end)::public.absen_status;
  if new.status = 'di_luar_radius'
     and (select value #>> '{}' from public.policy where key = 'absen_di_luar_radius') = 'tolak' then
    raise exception 'Anda berada di luar radius titik absen.';
  end if;

  new.terlambat_menit := case
    when new.tipe = 'masuk' then public.hitung_terlambat_menit(new.user_id, new.lokasi_absen_id, new.waktu)
    else null
  end;
  return new;
end $$;

commit;
