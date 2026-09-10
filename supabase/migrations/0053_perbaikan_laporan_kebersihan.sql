-- Perbaikan Laporan Kebersihan (7 September 2026) -- migrasi 0052 salah pada
-- DUA hal, dikoreksi CEO: (1) pengisi HARUS berbasis penugasan_absen di
-- outlet (siapa pun yang bertugas fisik di sana pada hari itu), BUKAN cuma
-- manager_resto -- kalau manager libur, tidak ada yang bisa lapor padahal
-- staf lain hadir; (2) batas kirim per OUTLET (jam_buka + toleransi), BUKAN
-- policy.deadline_by_form (itu per FORM -- jam buka beda-beda per outlet,
-- dan kalau belum diisi TIDAK ADA batas sama sekali -- jangan diam-diam
-- jatuh ke deadline_default 18:00, laporan pagi akan tercatat "tepat waktu"
-- padahal angka itu tidak berarti apa-apa).
--
-- report_insert/report_update RLS generik (author_id = auth.uid()) TIDAK
-- DILONGGARKAN -- dipakai 14 form lain. Kebersihan lewat TIGA RPC security
-- definer baru supaya SATU baris report per outlet per hari bisa dibuat,
-- diisi fotonya, dan diselesaikan oleh siapa pun yang berhak -- tanpa
-- membuka report_insert/update/att_insert ke semua orang. SATU pengecualian
-- sungguhan: bukti_upload (storage RLS, bukan tabel Postgres -- unggah file
-- mentah langsung ke endpoint Storage, tidak bisa lewat RPC) diperluas
-- dengan cabang OR baru.

begin;

-- 1. Jam buka outlet (diatur dari Admin) -- dasar batas kirim, BUKAN
--    deadline_by_form.
alter table public.outlet add column if not exists jam_buka time null;

-- 2. Jembatan formal titik absen <-> outlet bisnis -- sebelumnya TIDAK ADA
--    sama sekali, cuma cocok nama secara implisit dan rapuh.
alter table public.lokasi_absen add column if not exists outlet_id uuid null references public.outlet(id);

update public.lokasi_absen set outlet_id = (select id from public.outlet where nama = 'Indokopi Jatinegara') where nama = 'Indokopi (Jatinegara)';
update public.lokasi_absen set outlet_id = (select id from public.outlet where nama = 'Indokopi Lite Kemayoran') where nama = 'Indokopi Lite Kemayoran';
update public.lokasi_absen set outlet_id = (select id from public.outlet where nama = 'Indosteak Cempaka') where nama = 'Indosteak cempaka putih';
update public.lokasi_absen set outlet_id = (select id from public.outlet where nama = 'Indosteak Pekansari') where nama = 'Indosteak Pekansari';

-- 3. Akuntabilitas per foto (BUKAN kontrol akses) -- siapa yang mengunggah,
--    ditampilkan sebagai keterangan kecil di halaman Tinjau maupun di daftar
--    slot pengisian ("Sudah dikirim [nama]").
alter table public.attachment add column if not exists uploaded_by uuid null references public.profile(id);

-- 4. Toleransi menit sesudah jam_buka -- dari policy (CLAUDE.md aturan #4),
--    bukan hardcode. 30 menit dipakai sebagai nilai awal (satu-satunya angka
--    yang pernah disebut CEO, "jam buka + 30 menit") -- bisa diubah lewat
--    Admin > Policy kapan pun tanpa ubah kode.
insert into public.policy (key, value) values ('kebersihan_toleransi_menit', '30')
on conflict (key) do nothing;

-- 5. Balikkan pendekatan salah migrasi 0052 -- kebersihan TIDAK memakai
--    deadline_by_form (per FORM), kebutuhannya per OUTLET (langkah 1+4 di
--    atas).
update public.policy set value = value - 'kebersihan' where key = 'deadline_by_form';

-- 6. Ery (manager Indokopi Jatinegara, lihat migrasi 0051) TIDAK PUNYA satu
--    pun penugasan_absen -- ditemukan saat verifikasi sebelum migrasi ini,
--    kontradiksi langsung dengan instruksi CEO "jangan sampai perbaikan ini
--    malah mengeluarkan mereka". Ditambahkan di sini, pola sama seperti
--    manager lain (Dea/Cuko/Toni) yang penugasan_absen-nya sudah ada di
--    titik outlet masing-masing.
insert into public.penugasan_absen (user_id, lokasi_absen_id)
select p.id, la.id
from public.profile p, public.lokasi_absen la
where p.nama = 'Ery' and la.nama = 'Indokopi (Jatinegara)'
on conflict do nothing;

-- 7. Satu laporan per OUTLET per hari, bukan per pengarang -- report_uniq
--    (form_key, tanggal, author_id, outlet_id, shift_id) TIDAK mencegah dua
--    orang membuat baris terpisah untuk outlet+tanggal yang sama (author_id
--    ikut kunci itu). Index parsial baru ini KHUSUS kebersihan, tidak
--    menyentuh report_uniq yang dipakai 14 form lain.
create unique index if not exists kebersihan_uniq on public.report (tanggal, outlet_id) where form_key = 'kebersihan';

-- 8. Siapa boleh mengisi Kebersihan outlet X: siapa pun yang punya
--    penugasan_absen di titik absen mana pun yang terhubung ke outlet itu
--    (langkah 2 di atas).
create or replace function public.boleh_isi_kebersihan(p_outlet_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.penugasan_absen pa
    join public.lokasi_absen la on la.id = pa.lokasi_absen_id
    where pa.user_id = auth.uid() and la.outlet_id = p_outlet_id
  );
$$;

-- 9. Overload can_see_report DENGAN outlet -- dipakai report_select dan
--    att_select supaya rekan seoutlet (bukan cuma penulis baris & HRD) bisa
--    membaca baris report/attachment kebersihan bersama itu (perlu untuk
--    menampilkan "Sudah dikirim [nama]" ke siapa pun yang berhak mengisi).
--    Overload 2-argumen yang sudah ada TIDAK diubah -- dipakai apa adanya
--    di sini sebagai basis, supaya perilaku 14 form lain persis sama.
create or replace function public.can_see_report(f text, author uuid, outlet uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.can_see_report(f, author)
      or (f = 'kebersihan' and outlet is not null and public.boleh_isi_kebersihan(outlet));
$$;

drop policy if exists report_select on public.report;
create policy report_select on public.report for select to authenticated
using (public.can_see_report(form_key, author_id, outlet_id));

drop policy if exists att_select on public.attachment;
create policy att_select on public.attachment for select to authenticated
using (
  exists (
    select 1 from public.report r
    where r.id = attachment.report_id
      and public.can_see_report(r.form_key, r.author_id, r.outlet_id)
  )
);

-- 10. Perluas bukti_upload -- SATU-SATUNYA policy yang tidak bisa dialihkan
--     ke RPC (unggah file mentah langsung ke endpoint Storage). Cabang lama
--     (author_id = auth.uid()) TIDAK dihapus -- masih dipakai 14 form lain
--     yang lampirannya author-locked.
drop policy if exists bukti_upload on storage.objects;
create policy bukti_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'bukti' and (
    (storage.foldername(name))[1] in (select r.id::text from public.report r where r.author_id = auth.uid())
    or (storage.foldername(name))[1] in (
      select r.id::text from public.report r where r.form_key = 'kebersihan' and public.boleh_isi_kebersihan(r.outlet_id)
    )
  )
);

-- 11. Pastikan baris report BERSAMA untuk outlet+hari ini -- cari dulu, baru
--     buat kalau belum ada (bukan report_insert generik yang author-locked).
--     `on conflict (tanggal, outlet_id) where form_key='kebersihan'` merujuk
--     langsung ke index parsial di langkah 7 (index parsial tidak bisa
--     dijadikan named constraint untuk `on conflict on constraint`).
create or replace function public.kebersihan_pastikan_laporan(p_outlet_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tanggal date := ((now() at time zone 'Asia/Jakarta')::date);
  v_id uuid;
begin
  if not public.boleh_isi_kebersihan(p_outlet_id) then
    raise exception 'Anda tidak ditugaskan di outlet ini.';
  end if;

  select id into v_id from public.report where form_key = 'kebersihan' and outlet_id = p_outlet_id and tanggal = v_tanggal;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.report (form_key, tanggal, author_id, outlet_id)
  values ('kebersihan', v_tanggal, auth.uid(), p_outlet_id)
  on conflict (tanggal, outlet_id) where form_key = 'kebersihan' do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.report where form_key = 'kebersihan' and outlet_id = p_outlet_id and tanggal = v_tanggal;
  end if;

  return v_id;
end;
$$;

-- 12. Catat satu foto -- dilalui SETIAP unggahan (bukan insert langsung ke
--     `attachment`) supaya `att_insert` (author_id = auth.uid(), dipakai 14
--     form lain) TIDAK perlu dilonggarkan. `uploaded_by` diisi server dari
--     auth.uid(), bukan dikirim klien. `captured_at` SENGAJA TIDAK diisi --
--     kolom itu artinya "metadata klien, bisa dipalsukan" (lib/api/attachment.ts);
--     bukti waktu Kebersihan adalah `created_at` (default now(), server).
create or replace function public.kebersihan_catat_foto(p_report_id uuid, p_slot text, p_path text, p_mime text, p_bytes bigint)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_outlet_id uuid;
  v_id uuid;
begin
  select outlet_id into v_outlet_id from public.report where id = p_report_id and form_key = 'kebersihan';
  if v_outlet_id is null then
    raise exception 'Laporan kebersihan tidak ditemukan.';
  end if;
  if not public.boleh_isi_kebersihan(v_outlet_id) then
    raise exception 'Anda tidak ditugaskan di outlet ini.';
  end if;

  insert into public.attachment (report_id, field_key, path, mime, bytes, uploaded_by)
  values (p_report_id, p_slot, p_path, p_mime, p_bytes, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- 13. Tandai laporan selesai -- batas dihitung dari outlet.jam_buka +
--     kebersihan_toleransi_menit. Kalau jam_buka BELUM diisi: TIDAK ADA
--     batas, selalu 'terkirim' (instruksi eksplisit CEO -- jangan jatuh ke
--     deadline_default yang menyesatkan untuk laporan yang dikirim pagi).
create or replace function public.kebersihan_selesaikan_laporan(p_report_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_outlet_id uuid;
  v_jam_buka time;
  v_toleransi int;
  v_now_wib timestamp;
  v_batas timestamp;
  v_status public.report_status;
begin
  select outlet_id into v_outlet_id from public.report where id = p_report_id and form_key = 'kebersihan';
  if v_outlet_id is null then
    raise exception 'Laporan kebersihan tidak ditemukan.';
  end if;
  if not public.boleh_isi_kebersihan(v_outlet_id) then
    raise exception 'Anda tidak ditugaskan di outlet ini.';
  end if;

  select jam_buka into v_jam_buka from public.outlet where id = v_outlet_id;
  select (value #>> '{}')::int into v_toleransi from public.policy where key = 'kebersihan_toleransi_menit';

  v_now_wib := now() at time zone 'Asia/Jakarta';

  if v_jam_buka is null then
    v_status := 'terkirim';
  else
    v_batas := date_trunc('day', v_now_wib) + v_jam_buka + make_interval(mins => coalesce(v_toleransi, 0));
    v_status := case when v_now_wib > v_batas then 'terlambat' else 'terkirim' end;
  end if;

  update public.report
  set status = v_status, submitted_at = now(), updated_at = now()
  where id = p_report_id;
end;
$$;

-- 14. Ganti populasi `assignment(form_key='kebersihan')` -- SEBELUMNYA
--     (migrasi 0052) mencerminkan manager_resto SAJA. Sekarang mencerminkan
--     SEMUA orang yang punya penugasan_absen di titik yang terhubung ke
--     outlet (langkah 2+6 di atas) -- ini yang dibaca UI (pemilih outlet)
--     dan Beranda/nav (`hitungTugasHariIni`/`tabLaporDinamis`, generik,
--     baca `assignment` apa adanya). `assignment` TIDAK punya unique
--     constraint (dicatat sebelumnya) -- hapus dulu baris lama, INSERT
--     ulang dari nol, bukan upsert.
delete from public.assignment where form_key = 'kebersihan';

insert into public.assignment (user_id, form_key, outlet_id)
select distinct pa.user_id, 'kebersihan', la.outlet_id
from public.penugasan_absen pa
join public.lokasi_absen la on la.id = pa.lokasi_absen_id
where la.outlet_id is not null;

commit;
