-- Presensi ber-radius (docs/06-RENCANA-PRESENSI-MOBILE.md §3). Koordinat asli
-- dari CEO BELUM ADA (§5 dokumen) -- dibangun sesuai instruksi eksplisit
-- user "jangan menunggu", dengan SATU baris lokasi_absen CONTOH yang jelas
-- berlabel, bukan data asli. Mekanismenya yang harus jadi dulu.

create type absen_tipe as enum ('masuk','pulang');
create type absen_status as enum ('valid','di_luar_radius','manual_hrd');
-- 'manual_hrd' TERSEDIA di tipe (sesuai skema asli dokumen) tapi TIDAK ADA
-- jalur UI yang menulisnya di tahap ini -- HRD membuat entri manual bukan
-- bagian dari 6 hal yang diminta, sengaja belum dibangun.
create type absen_keputusan as enum ('diterima','ditolak');
-- BUKAN dari skema asli dokumen -- ditambahkan karena user meminta layar
-- Terima/Tolak untuk tanda 🟡 (di luar 6 poin awal, diminta di pesan
-- berikutnya). 'disetujui_oleh'/'catatan' di bawah sudah ada di skema asli,
-- tinggal kolom KEPUTUSANnya sendiri yang belum ada tempatnya.

create table public.lokasi_absen (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  lokasi_id     uuid references public.lokasi(id),
  latitude      double precision not null,
  longitude     double precision not null,
  radius_meter  int not null default 200,
  aktif         boolean not null default true
);

create table public.penugasan_absen (
  user_id         uuid not null references public.profile(id) on delete cascade,
  lokasi_absen_id uuid not null references public.lokasi_absen(id) on delete cascade,
  -- Ditambahkan dari skema asli dokumen: jam kerja per ORANG, bukan cuma
  -- per-perusahaan -- "beda pekerjaan beda orang" (instruksi user). NULL
  -- berarti pakai default policy.jam_masuk/jam_pulang; diisi lewat
  -- atur_jam_kerja() di bawah, bukan update tabel langsung dari klien.
  jam_masuk       text,
  jam_pulang      text,
  primary key (user_id, lokasi_absen_id)
);

create table public.absensi (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profile(id),
  tanggal          date not null,
  tipe             absen_tipe not null,
  waktu            timestamptz not null default now(),
  lokasi_absen_id  uuid references public.lokasi_absen(id),
  latitude         double precision,
  longitude        double precision,
  akurasi_meter    double precision,
  jarak_meter      double precision,
  status           absen_status not null,
  foto_path        text not null,
  terlambat_menit  int,
  catatan          text,
  keputusan_hrd    absen_keputusan,
  disetujui_oleh   uuid references public.profile(id),
  created_at       timestamptz not null default now(),
  unique (user_id, tanggal, tipe)
);

-- ─── Fungsi (didefinisikan SEBELUM policy yang memakainya) ─────────────

-- "role hrd/kadiv HRD" (istilah user) -- role 'kadiv' generik dipegang
-- beberapa kepala divisi (CS, Perizinan, IT, Teknik, DTI, bukan cuma HRD),
-- jadi TIDAK CUKUP dicek dari role saja -- harus digabung profile.divisi.
-- Dipakai jadi satu fungsi supaya logikanya SATU tempat, bukan diulang di
-- RLS, RPC, dan halaman React masing-masing.
create or replace function public.is_hrd_kadiv()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role r
    join public.profile p on p.id = r.user_id
    where r.user_id = auth.uid() and r.role = 'kadiv' and p.divisi = 'HRD'
  );
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────

alter table public.lokasi_absen  enable row level security;
alter table public.penugasan_absen enable row level security;
alter table public.absensi enable row level security;

-- lokasi_absen & penugasan_absen: baca untuk semua yang login (sama pola
-- dengan `lokasi`/`assignment`, Task 04) -- pengisi perlu tahu titik & jam
-- kerjanya sendiri, dan itu bukan data rahasia. Tulis (buat/hapus baris,
-- ubah nama/koordinat/radius/aktif) HANYA ceo lewat halaman Admin -- jam
-- kerja per orang PENGECUALIAN, lewat RPC atur_jam_kerja() di bawah, bukan
-- lewat policy update biasa (menghindari jebakan "with check(true)" yang
-- sudah didokumentasikan di 04-CATATAN-TEKNIS.md §3.2 soal report_nudge --
-- RLS tidak bisa membatasi KOLOM mana yang boleh diubah, cuma BARIS mana).
create policy lokasi_absen_select on public.lokasi_absen for select using (auth.uid() is not null);
create policy lokasi_absen_admin  on public.lokasi_absen for all using (public.has_role('ceo')) with check (public.has_role('ceo'));

create policy penugasan_absen_select on public.penugasan_absen for select using (auth.uid() is not null);
create policy penugasan_absen_admin  on public.penugasan_absen for all using (public.has_role('ceo')) with check (public.has_role('ceo'));

-- absensi: baris sendiri SELALU; ceo/pusat SELALU (pola sama seperti akses
-- umum mereka ke `report` -- absensi bukan data serahasia accounting);
-- HRD (role kadiv + divisi='HRD', lihat is_hrd_kadiv() di bawah) juga bisa
-- melihat semua, karena dia yang meninjau tanda 🟡. TIDAK ADA policy
-- update/delete sama sekali untuk klien biasa -- baris ini bukti kehadiran,
-- sekali tercatat tidak boleh diubah pengirimnya sendiri; peninjauan HRD
-- (kolom keputusan_hrd/disetujui_oleh/catatan) lewat putuskan_absensi() di
-- bawah, security definer, bukan UPDATE biasa.
create policy absensi_select on public.absensi for select using (
  user_id = auth.uid() or public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv()
);
create policy absensi_insert on public.absensi for insert with check (user_id = auth.uid());

-- ─── RPC tambahan ────────────────────────────────────────────────────────

-- Terima/Tolak tanda 🟡 di halaman Tinjau Absensi. security definer supaya
-- bisa menulis kolom keputusan_hrd/disetujui_oleh/catatan tanpa policy
-- update umum di atas -- guard peran dicek MANUAL di dalam fungsi, sama
-- pola dengan tagih_laporan() (Task 18).
create or replace function public.putuskan_absensi(p_id uuid, p_diterima boolean, p_catatan text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv()) then
    raise exception 'Tidak berhak memutuskan presensi.';
  end if;
  update public.absensi
  set keputusan_hrd = case when p_diterima then 'diterima' else 'ditolak' end::absen_keputusan,
      disetujui_oleh = auth.uid(),
      catatan = coalesce(p_catatan, catatan)
  where id = p_id;
end $$;

-- Atur jam kerja PER ORANG (instruksi user, "beda pekerjaan beda orang").
-- Sama pola dengan putuskan_absensi() -- guard manual, security definer,
-- kolomnya sendiri sengaja TIDAK bisa diubah lewat policy update biasa.
create or replace function public.atur_jam_kerja(p_user_id uuid, p_lokasi_absen_id uuid, p_jam_masuk text, p_jam_pulang text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv()) then
    raise exception 'Tidak berhak mengatur jam kerja.';
  end if;
  update public.penugasan_absen
  set jam_masuk = p_jam_masuk, jam_pulang = p_jam_pulang
  where user_id = p_user_id and lokasi_absen_id = p_lokasi_absen_id;
end $$;

-- ─── Policy (§3.3) ─────────────────────────────────────────────────────

insert into public.policy (key, value) values
  ('jam_masuk',                   '"08:00"'),
  ('jam_pulang',                  '"17:00"'),
  ('toleransi_terlambat_menit',   '15'),
  ('absen_radius_default_meter',  '200'),
  ('absen_di_luar_radius',        '"izinkan_dengan_tanda"'),
  ('absen_wajib_foto',            'true'),
  ('absen_akurasi_maksimal_meter','100')
on conflict (key) do nothing;

-- ─── Storage ────────────────────────────────────────────────────────────
-- Bucket privat baru, TERPISAH dari 'bukti' (Task 11) -- isinya cuma foto
-- wajah presensi, bukan bukti laporan. Limit 10MB (foto 800px terkompresi
-- jauh di bawah itu -- headroom, bukan target) dan mime dikunci ke JPEG
-- karena kompresi klien SELALU menghasilkan image/jpeg (lib/gambar.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absensi', 'absensi', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

-- Path: {user_id}/{nama file}.jpg -- BUKAN {absensi_id}/... seperti pola
-- 'bukti' (report_id lalu attachment) -- baris `absensi` belum ada saat
-- foto diunggah (foto_path wajib diisi SAAT insert), jadi tidak ada id
-- baris untuk dijadikan folder. Diskop ke user sendiri sudah cukup aman.
create policy absensi_foto_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'absensi' and (storage.foldername(name))[1] = auth.uid()::text);

create policy absensi_foto_read on storage.objects for select to authenticated
  using (bucket_id = 'absensi' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role('ceo') or public.has_role('pusat') or public.is_hrd_kadiv()
  ));

-- ─── Contoh, BUKAN data asli ────────────────────────────────────────────
-- Koordinat dari contoh dokumen (§5) sendiri, dipakai apa adanya SUPAYA
-- jelas ini contoh, bukan tebakan lokasi sungguhan. Tidak ada penugasan
-- dibuat -- Admin yang menambah lewat halaman "Titik Absen" setelah
-- koordinat asli dari CEO tersedia.
insert into public.lokasi_absen (nama, lokasi_id, latitude, longitude, radius_meter, aktif)
values ('CONTOH -- ganti dari halaman Admin', null, -6.914744, 107.609810, 200, true);
