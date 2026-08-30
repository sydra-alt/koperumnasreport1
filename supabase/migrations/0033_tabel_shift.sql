-- Shift dari tabel, bukan lagi CHECK CONSTRAINT terkunci ('pagi'/'siang'/
-- 'malam' di assignment & report) -- CEO sering mengubah jadwal shift,
-- instruksi eksplisit user (30 Agustus 2026) supaya bisa diatur dari
-- halaman Admin tanpa migrasi setiap kali.
--
-- KEPUTUSAN (dikonfirmasi user setelah rencana ditunjukkan dulu, bukan
-- ditebak):
-- 1. `assignment.shift`/`report.shift` (text, dibatasi CHECK) diganti KOLOM
--    BARU `shift_id uuid references shift(id)` -- BUKAN sekadar FK ke
--    `shift.nama` (text). Alasan user sendiri: nama yang bisa diedit CEO
--    bukan fondasi relasi historis -- PERSIS pelajaran `outlet.slug`
--    (migrasi 0031) yang baru diperbaiki. Diff lebih besar, disengaja.
-- 2. LIMA kolom, bukan empat: `id, nama, jam_mulai, jam_selesai,
--    batas_lapor, aktif`. `jam_mulai`/`jam_selesai` SENGAJA diseed NULL --
--    nilai `policy.shift_deadline` yang ada sekarang (14:30/22:30/07:30)
--    adalah DEADLINE DENGAN TENGGANG, BUKAN jam pulang sungguhan -- kalau
--    di-backfill ke jam_selesai, layar Admin akan menampilkan jam kerja yang
--    salah sejak hari pertama tanpa ada yang tahu itu asumsi (poin eksplisit
--    user). `batas_lapor` yang diseed dari nilai lama, `jam_mulai`/
--    `jam_selesai` menunggu CEO isi sendiri lewat Admin -- UI wajib
--    menampilkan "Jam kerja belum diisi" selama masih null, BUKAN
--    menyembunyikan/berpura-pura ada nilainya.
--
-- KESELAMATAN BACKFILL (instruksi eksplisit user): kalau SATU baris pun
-- `shift_id`-nya masih null setelah backfill padahal `shift` lama terisi,
-- SELURUH migrasi ini dibatalkan (DO block di bawah RAISE EXCEPTION --
-- migrasi dikirim sebagai satu pesan multi-statement lewat scripts/db.mjs,
-- jadi satu exception membatalkan SEMUA statement sebelumnya di file ini
-- juga, bukan cuma yang gagal).
--
-- KOLOM `shift` LAMA SENGAJA TIDAK DIHAPUS di migrasi ini (instruksi
-- eksplisit user) -- supaya bisa mundur tanpa kehilangan data kalau ada
-- yang salah. Penghapusannya ada di migrasi TERPISAH, SETELAH dikonfirmasi
-- semuanya jalan (lihat rencana selanjutnya, BELUM ditulis).

create table public.shift (
  id          uuid primary key default gen_random_uuid(),
  nama        text not null unique,
  jam_mulai   text,
  jam_selesai text,
  batas_lapor text,
  aktif       boolean not null default true
);

alter table public.shift enable row level security;
create policy shift_select on public.shift for select using (auth.uid() is not null);
create policy shift_admin  on public.shift for all using (public.has_role('ceo')) with check (public.has_role('ceo'));

-- Seed dari 3 nilai lama -- jam_mulai/jam_selesai KOSONG SENGAJA (lihat
-- catatan di atas), batas_lapor dari policy.shift_deadline yang ada supaya
-- TIDAK ADA regresi jam tenggang lapor.
insert into public.shift (nama, jam_mulai, jam_selesai, batas_lapor, aktif) values
  ('Pagi',  null, null, '14:30', true),
  ('Siang', null, null, '22:30', true),
  ('Malam', null, null, '07:30', true);

alter table public.assignment add column shift_id uuid references public.shift(id);
alter table public.report     add column shift_id uuid references public.shift(id);

update public.assignment a set shift_id = s.id
from public.shift s
where a.shift is not null and lower(s.nama) = a.shift;

update public.report r set shift_id = s.id
from public.shift s
where r.shift is not null and lower(s.nama) = r.shift;

do $$
declare
  yatim_assignment int;
  yatim_report     int;
begin
  select count(*) into yatim_assignment from public.assignment where shift is not null and shift_id is null;
  select count(*) into yatim_report     from public.report     where shift is not null and shift_id is null;
  if yatim_assignment > 0 or yatim_report > 0 then
    raise exception 'Backfill shift_id tidak lengkap -- assignment yatim: %, report yatim: %. Migrasi DIBATALKAN, tidak ada perubahan disimpan.', yatim_assignment, yatim_report;
  end if;
end $$;

-- Ganti kunci unik ke shift_id (uuid, pola coalesce SAMA dengan
-- lokasi_id/outlet_id di index yang sama) -- shift TEKS lama tidak lagi
-- bagian dari kunci unik sejak titik ini, walau kolomnya masih ada.
drop index public.assignment_uniq;
create unique index assignment_uniq on public.assignment (
  user_id, form_key,
  coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

drop index public.report_uniq;
create unique index report_uniq on public.report (
  form_key, tanggal, author_id,
  coalesce(lokasi_id, outlet_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- policy.shift_deadline digantikan shift.batas_lapor -- dihapus, bukan
-- dibiarkan basi (beda dari kolom `shift` di assignment/report yang
-- SENGAJA dipertahankan -- ini cuma satu baris config, gampang ditulis
-- ulang persis dari komentar migrasi ini kalau ternyata perlu).
delete from public.policy where key = 'shift_deadline';
