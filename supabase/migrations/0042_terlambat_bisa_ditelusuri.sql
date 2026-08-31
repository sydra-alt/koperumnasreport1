-- "Terlambat 68 menit" bikin BINGUNG tanpa konteks -- user sendiri salah
-- hitung manual (lupa toleransi 15 menit), lalu menegaskan: "kalau aku saja
-- bingung, HRD akan lebih bingung. Angka yang menyentuh penilaian orang
-- harus bisa ditelusuri tanpa bertanya." (31 Agustus 2026, lanjutan laporan
-- zona waktu ekspor sebelumnya).
--
-- `presensi_untuk_tanggal` (migrasi 0041) ditambah SATU kolom:
-- `masuk_jam_efektif` -- jam masuk yang SUNGGUH dipakai menghitung
-- `terlambat_menit` baris itu (per-orang lewat `penugasan_absen.jam_masuk`
-- kalau diatur admin, jatuh balik ke `policy.jam_masuk` kalau tidak) --
-- SAMA PERSIS logika `titikDipilih.jamMasuk ?? jamMasukDefault` yang
-- dipakai `app/absen/page.tsx` saat menghitung `terlambat_menit` real-time
-- (lib/absen.ts `hitungTerlambatMenit`), bukan angka baru/tebakan.
--
-- `drop function` dulu (bukan langsung `create or replace`) -- Postgres
-- menolak menambah kolom baru ke `returns table` fungsi yang sudah ada
-- tanpa didrop lebih dulu.
drop function if exists public.presensi_untuk_tanggal(date);
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
    case when masuk.id is not null then coalesce(
      (select pa.jam_masuk from public.penugasan_absen pa
        where pa.user_id = p.id and pa.lokasi_absen_id = masuk.lokasi_absen_id),
      (select value #>> '{}' from public.policy where key = 'jam_masuk')
    ) end,
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
