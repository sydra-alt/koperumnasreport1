-- Laporan Kebersihan (CEO, 6 September 2026) -- pengganti laporan satpam
-- yang dibuang (migrasi 0047). 5 foto wajib per outlet per hari (bar,
-- toilet, meja, kursi, satu area bebas), diambil live lewat kamera
-- (`CameraCapture`, TANPA pemilih galeri), watermark nama outlet + jam
-- WIB. Rancangan disetujui CEO sebelum dibangun -- lihat percakapan.
--
-- SENGAJA memakai infrastruktur `report`+`attachment` yang SUDAH ADA,
-- bukan tabel baru -- form ini otomatis dapat integrasi gratis dengan
-- Beranda (`hitungTugasHariIni`), Papan Kontrol (`papan_untuk_tanggal`),
-- deadline (`policy.deadline_by_form`), dan bucket storage 'bukti' yang
-- RLS-nya SUDAH generik lewat `can_see_report()` (`bukti_read`/`bukti_upload`,
-- migrasi awal) -- tidak perlu bucket atau policy storage baru sama sekali.
-- `attachment.field_key` menampung nama slot ('bar'/'toilet'/'meja'/
-- 'kursi'/'area_bebas') sebagai teks biasa, sama seperti field lampiran
-- form lain -- tidak perlu enum baru.
--
-- `attachment.captured_at` SENGAJA TIDAK dipakai untuk laporan ini --
-- kolom itu diisi dari `file.lastModified` (metadata klien, bisa dipalsukan,
-- lihat komentar lib/api/attachment.ts) untuk lampiran generik. Bukti waktu
-- utk kebersihan adalah `attachment.created_at` (default `now()`, DITULIS
-- SERVER, tidak pernah dari input klien) -- exactly instruksi CEO "waktu
-- dicatat server, bukan dipercaya dari HP".

-- 1. can_see_report() -- tambah is_hrd_kadiv() KHUSUS form 'kebersihan',
--    tidak melebarkan akses form lain mana pun.
create or replace function public.can_see_report(f text, author uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
       author = auth.uid()
    or public.has_role('ceo')
    or (public.has_role('pusat')             and f <> 'accounting')
    or (public.has_role('kontrol_marketing') and f =  'personal_marketing')
    or (public.has_role('accounting')        and f in ('accounting','manager_resto','thrifting','kontrol_fnb'))
    or (public.has_role('manager_resto')     and f =  'personal_marketing')
    or (f = 'kebersihan' and public.is_hrd_kadiv());
$$;

-- 2. Penugasan: mengisi Laporan Kebersihan SIAPA yang sudah punya
--    assignment manager_resto di outlet itu -- outlet yang sama, orang
--    yang sama, form_key baru saja. Tidak menyalin baris masa depan
--    otomatis (kalau manager_resto outlet baru ditambah nanti, kebersihan
--    perlu ditambah eksplisit juga -- disengaja, bukan trigger otomatis,
--    supaya perubahan penugasan selalu terlihat lewat migrasi/Admin,
--    bukan efek samping tersembunyi).
-- `assignment` TIDAK punya unique constraint pada (user_id, form_key,
-- outlet_id) -- cuma primary key `id` -- jadi dijaga manual lewat
-- `not exists`, bukan `on conflict` (tidak ada target constraint untuk
-- ditangkap, akan diam-diam tidak mencegah duplikat kalau dipakai).
insert into public.assignment (user_id, form_key, outlet_id)
select a.user_id, 'kebersihan', a.outlet_id
from public.assignment a
where a.form_key = 'manager_resto'
  and not exists (
    select 1 from public.assignment k
    where k.user_id = a.user_id and k.form_key = 'kebersihan' and k.outlet_id = a.outlet_id
  );

-- 3. Deadline -- masuk policy.deadline_by_form, DIGABUNG (||) supaya tidak
--    menimpa entri form lain yang sudah ada.
update public.policy
set value = value || '{"kebersihan": "18:00"}'::jsonb
where key = 'deadline_by_form';
