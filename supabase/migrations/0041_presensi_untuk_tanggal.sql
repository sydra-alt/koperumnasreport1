-- Tinjau Absensi (halaman HRD/CEO) SELAMA INI cuma menampilkan antrean 🟡
-- di luar radius -- TIDAK ADA daftar presensi harian sama sekali, dan orang
-- yang belum absen sama sekali TIDAK PERNAH terlihat (justru itu yang
-- paling perlu dilihat HRD). Instruksi eksplisit user, 31 Agustus 2026.
--
-- `presensi_untuk_tanggal`: satu baris per ORANG per TANGGAL (bukan per
-- absensi_tipe) -- gabung masuk+pulang, sama pola pivot dengan ekspor
-- absensi (app/api/ekspor/absensi/route.ts). BUKAN security definer --
-- fungsi biasa `language sql` berjalan dengan hak PEMANGGIL, RLS
-- `absensi_select` (migrasi 0022) yang membatasi: HRD/ceo/pusat lihat
-- semua, karyawan biasa cuma baris sendiri (kolom masuk/pulang orang lain
-- otomatis NULL lewat LEFT JOIN) -- sama pola dengan `papan_untuk_tanggal`
-- (migrasi 0020), bukan celah baru.
--
-- Cakupan "satu baris per orang": SEMUA karyawan aktif yang punya minimal
-- satu titik absen ditugaskan (`penugasan_absen`) -- bukan cuma yang sudah
-- absen. Titik ditampilkan dari absensi SUNGGUHAN hari itu kalau ada
-- (orang bisa punya >1 titik ditugaskan, mis. Pak Toni pegang 3 outlet --
-- lihat docs/BLUEPRINT.md §7 -- titik yang RELEVAN adalah yang dia pakai
-- absen HARI ITU); kalau belum absen sama sekali, semua titik yang
-- ditugaskan ditampilkan digabung ("/") supaya HRD tahu ke mana harus
-- menagih tanpa menebak satu titik yang salah.
create or replace function public.presensi_untuk_tanggal(p_tanggal date default (now() at time zone 'Asia/Jakarta')::date)
returns table (
  user_id               uuid,
  nama                  text,
  titik_nama            text,
  masuk_id              uuid,
  jam_masuk             timestamptz,
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
    masuk.id, masuk.waktu, masuk.terlambat_menit, masuk.status, masuk.foto_path,
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

-- Presensi MILIK SENDIRI, dipakai halaman Akun (karyawan biasa perlu bisa
-- melihat riwayat presensinya sendiri, instruksi eksplisit user -- SELAMA
-- INI cuma bisa lihat hari ini di halaman Absen, tidak ada riwayat).
-- Sengaja fungsi TERPISAH dari `presensi_untuk_tanggal` (bukan dipakai
-- ulang dgn parameter tanggal tunggal) -- kalau dipakai ulang, PEMANGGIL
-- BIASA akan menerima NAMA & TITIK SELURUH KARYAWAN (kolom lain sudah
-- ternulkan RLS, tapi nama+titik tetap bocor karena bukan bagian dari
-- filter RLS `absensi_select`, cuma `profile`/`penugasan_absen` yang
-- policy select-nya memang terbuka untuk siapa pun login). Fungsi ini
-- MENYARING `user_id = auth.uid()` LANGSUNG di query -- tidak pernah
-- menyentuh baris atau nama orang lain sama sekali.
create or replace function public.presensi_saya_untuk_bulan(p_bulan text default to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM'))
returns table (
  tanggal          date,
  titik_nama       text,
  jam_masuk        timestamptz,
  terlambat_menit  int,
  status_masuk     absen_status,
  jam_pulang       timestamptz,
  status_pulang    absen_status
)
language sql stable as $$
  select
    d.tanggal,
    coalesce(lm.nama, lp.nama),
    masuk.waktu, masuk.terlambat_menit, masuk.status,
    pulang.waktu, pulang.status
  from (
    select distinct tanggal from public.absensi
    where user_id = auth.uid() and to_char(tanggal, 'YYYY-MM') = p_bulan
  ) d
  left join public.absensi masuk  on masuk.user_id = auth.uid()  and masuk.tanggal = d.tanggal  and masuk.tipe = 'masuk'
  left join public.absensi pulang on pulang.user_id = auth.uid() and pulang.tanggal = d.tanggal and pulang.tipe = 'pulang'
  left join public.lokasi_absen lm on lm.id = masuk.lokasi_absen_id
  left join public.lokasi_absen lp on lp.id = pulang.lokasi_absen_id
  order by d.tanggal desc;
$$;
