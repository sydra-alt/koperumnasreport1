-- Akun uji keluar dari jawaban asisten AI (29 September 2026, instruksi CEO).
--
-- Jawaban sungguhan pertama asisten ("siapa yang belum kirim laporan minggu
-- ini?") memuat empat AKUN UJI sebagai "staf yang belum lapor" -- angka palsu
-- tentang bisnis. Akun uji TIDAK dinonaktifkan (dipakai skrip uji, lihat
-- scripts/buat-akun-uji.mjs); cukup ditandai, dan fungsi baca asisten yang
-- menghasilkan daftar ORANG melewatinya.
--
-- `akun_uji` dijaga jaga_profil_sensitif(): cuma CEO/Admin yang boleh
-- mengubahnya. Kalau tidak, siapa pun bisa menandai dirinya sendiri sebagai
-- akun uji dan hilang dari laporan "siapa yang belum lapor".

begin;

alter table public.profile add column akun_uji boolean not null default false;

comment on column public.profile.akun_uji is
  'Akun uji (bukan orang sungguhan). Dilewati fungsi asisten AI yang mendaftar orang. Hanya CEO/Admin yang boleh mengubah.';

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
  end if;
  return new;
end $$;

-- Tujuh akun uji dari scripts/buat-akun-uji.mjs -- daftar EKSPLISIT per email,
-- bukan pola nama, supaya tidak ada orang sungguhan yang ikut tertandai.
update public.profile set akun_uji = true
where id in (
  select id from auth.users where email in (
    'uji-ceo@koperumnas.local', 'uji1@koperumnas.local', 'uji2@koperumnas.local', 'uji3@koperumnas.local',
    'uji4@koperumnas.local', 'uji5@koperumnas.local', 'uji6@koperumnas.local'
  )
);

-- Dua fungsi asisten yang mendaftar ORANG -- sama persis 0064, ditambah
-- satu join yang melewati akun uji.
create or replace function public.ai_status_laporan(p_dari date, p_sampai date)
returns table (
  pic_nama text, form_key text, lingkup text,
  hari_wajib int, hari_terkirim int, hari_terlambat int, hari_belum int,
  tanggal_belum date[]
)
language plpgsql stable as $$
begin
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai - p_dari > 30 then
    raise exception 'Rentang tanggal tidak valid (maksimal 31 hari).';
  end if;
  return query
    select p.pic_nama, p.form_key, p.scope_nama,
           count(*)::int,
           count(*) filter (where p.report_id is not null)::int,
           count(*) filter (where p.status = 'terlambat')::int,
           count(*) filter (where p.report_id is null)::int,
           coalesce(array_agg(d.tanggal::date order by d.tanggal) filter (where p.report_id is null), '{}')
    from generate_series(p_dari, p_sampai, interval '1 day') as d(tanggal)
    cross join lateral public.papan_untuk_tanggal(d.tanggal::date) p
    join public.assignment a on a.id = p.assignment_id
    -- HANYA penugasan yang laporannya boleh dilihat pemanggil. Tanpa ini,
    -- penugasan yang terlihat tapi laporannya tersembunyi RLS akan terbaca
    -- "belum lapor" -- angka palsu, bukan sekadar data kosong.
    join public.profile pr_uji on pr_uji.id = a.user_id and not pr_uji.akun_uji
    where public.can_see_report(p.form_key, a.user_id)
    group by p.pic_nama, p.form_key, p.scope_nama
    order by count(*) filter (where p.report_id is null) desc, p.pic_nama, p.form_key;
end $$;


create or replace function public.ai_presensi(p_dari date, p_sampai date)
returns table (
  nama text, titik text,
  hari_absen_masuk int, hari_terlambat int, total_menit_terlambat int,
  hari_tanpa_absen_masuk int
)
language plpgsql stable as $$
begin
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai - p_dari > 30 then
    raise exception 'Rentang tanggal tidak valid (maksimal 31 hari).';
  end if;
  return query
    select x.nama, max(x.titik_nama),
           count(x.masuk_id)::int,
           count(*) filter (where coalesce(x.terlambat_menit, 0) > 0)::int,
           coalesce(sum(x.terlambat_menit) filter (where x.terlambat_menit > 0), 0)::int,
           count(*) filter (where x.masuk_id is null)::int
    from generate_series(p_dari, p_sampai, interval '1 day') as d(tanggal)
    cross join lateral public.presensi_untuk_tanggal(d.tanggal::date) x
    -- Cermin persis policy absensi_select: orang yang absensinya tidak boleh
    -- dilihat pemanggil TIDAK ikut (kalau ikut, tampil "tidak pernah absen"
    -- -- angka palsu).
    join public.profile pr_uji on pr_uji.id = x.user_id and not pr_uji.akun_uji
    where (x.user_id = auth.uid() or public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv())
    group by x.user_id, x.nama
    order by count(*) filter (where coalesce(x.terlambat_menit, 0) > 0) desc, x.nama;
end $$;


commit;
