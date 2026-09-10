-- Jadwal operasional per outlet per hari (10 September 2026, jawaban CEO
-- soal jam buka -- lebih rumit dari sekadar satu angka):
--   - Semua outlet buka 09:00. Tutup: resto 22:00, kafe 03:00 (dini hari,
--     hari BERIKUTNYA). Akhir pekan: kafe buka 24 jam.
--   - Semua harus bisa diubah admin dari layar, tidak ditulis mati di kode.
--
-- Mengganti `outlet.jam_buka` (migrasi 0053, SATU kolom, SATU jam untuk
-- seluruh minggu) -- tidak cukup untuk kebutuhan ini. Rencana disetujui
-- CEO seluruhnya sebelum migrasi ini ditulis:
--   1. Model PER HARI (bukan "jadwal dasar + pengecualian") -- persis "Jam
--      Buka" ala Google Maps bisnis. Ini menyelesaikan "akhir pekan beda
--      jadwal" TANPA perlu konsep "hari akhir pekan" sama sekali -- admin
--      cukup isi baris Sabtu/Minggu beda dari hari lain. Tidak ada
--      "Sabtu"/"Minggu" ditulis mati di mana pun.
--   2. Jam tutup lewat tengah malam (kafe 09:00-03:00) -- TIDAK pakai kolom
--      penanda `tutup_besok` terpisah. Cukup `jam_buka` + `jam_tutup`, aturan
--      TETAP: `jam_tutup <= jam_buka` berarti tutup di HARI BERIKUTNYA. Dua
--      kolom yang bisa tidak sinkron (jam + penanda) lebih berisiko
--      daripada satu rumus yang didokumentasikan di satu tempat -- lihat
--      docs/04-CATATAN-TEKNIS.md §7 (jebakan baru, orang berikutnya yang
--      baca "09:00-03:00" akan mengira salah ketik kalau tidak tahu
--      aturan ini).
--      PENTING: aturan ini BELUM dipakai untuk hitung apa pun di migrasi
--      ini -- Kebersihan cuma pernah butuh jam BUKA (pagi, sebelum buka),
--      tidak pernah jam tutup. Kolom `jam_tutup` di sini murni supaya
--      datanya tersimpan BENAR untuk kebutuhan nanti, bukan menciptakan
--      logika baru yang belum ada pemakainya.
--   3. Kebersihan untuk outlet 24 jam -- "jam buka" tidak berarti apa-apa
--      hari itu. Kunci policy baru `kebersihan_batas_24jam` (jam tetap,
--      admin-editable lewat tab Policy yang sudah ada, TIDAK perlu layar
--      baru) dipakai sebagai batas kirim KHUSUS hari-hari `buka_24_jam`.

begin;

create table public.jadwal_operasional (
  outlet_id uuid not null references public.outlet(id),
  hari_iso smallint not null check (hari_iso between 1 and 7), -- 1=Senin ... 7=Minggu, SAMA persis lib/tanggal.ts hariISOWIB()
  jam_buka time null,
  jam_tutup time null,
  buka_24_jam boolean not null default false,
  primary key (outlet_id, hari_iso)
);

alter table public.jadwal_operasional enable row level security;

-- Pola SAMA PERSIS `outlet_admin`/`outlet_select` (migrasi awal) -- admin
-- mengelola penuh, semua yang login boleh membaca (dipakai UI pemilih
-- outlet Kebersihan, bukan cuma Admin).
create policy jadwal_operasional_admin on public.jadwal_operasional for all
  using (public.is_admin()) with check (public.is_admin());
create policy jadwal_operasional_select on public.jadwal_operasional for select to authenticated
  using (auth.uid() is not null);

-- `outlet.jam_buka` DIGANTIKAN tabel di atas -- masih null utk semua outlet
-- sejak migrasi 0053 (belum pernah diisi CEO), aman dihapus tanpa migrasi
-- data.
alter table public.outlet drop column if exists jam_buka;

-- Batas kirim Kebersihan KHUSUS hari outlet buka 24 jam (jam_buka tidak
-- berarti apa-apa hari itu) -- 10:00 nilai awal, DISETUJUI CEO, tetap
-- lewat policy (aturan #4 CLAUDE.md), bukan ditulis mati di kode.
insert into public.policy (key, value) values ('kebersihan_batas_24jam', '"10:00"')
on conflict (key) do nothing;

-- Ganti isi kebersihan_selesaikan_laporan() -- baca jadwal_operasional hari
-- ini (hari_iso dari tanggal WIB SEKARANG -- laporan Kebersihan selalu
-- untuk HARI INI, tidak pernah tanggal lampau), bukan outlet.jam_buka yang
-- sudah tidak ada.
create or replace function public.kebersihan_selesaikan_laporan(p_report_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_outlet_id uuid;
  v_hari_iso smallint;
  v_jadwal record;
  v_toleransi int;
  v_batas_24jam text;
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

  v_now_wib := now() at time zone 'Asia/Jakarta';
  v_hari_iso := extract(isodow from v_now_wib::date);

  select * into v_jadwal from public.jadwal_operasional where outlet_id = v_outlet_id and hari_iso = v_hari_iso;
  select (value #>> '{}')::int into v_toleransi from public.policy where key = 'kebersihan_toleransi_menit';

  if v_jadwal is null then
    -- Jadwal hari ini belum diatur sama sekali -- TIDAK ADA batas, jujur
    -- (sama prinsip dengan outlet.jam_buka kosong sebelumnya).
    v_status := 'terkirim';
  elsif v_jadwal.buka_24_jam then
    select (value #>> '{}') into v_batas_24jam from public.policy where key = 'kebersihan_batas_24jam';
    if v_batas_24jam is null then
      v_status := 'terkirim';
    else
      v_batas := date_trunc('day', v_now_wib) + v_batas_24jam::time;
      v_status := case when v_now_wib > v_batas then 'terlambat' else 'terkirim' end;
    end if;
  elsif v_jadwal.jam_buka is null then
    v_status := 'terkirim';
  else
    v_batas := date_trunc('day', v_now_wib) + v_jadwal.jam_buka + make_interval(mins => coalesce(v_toleransi, 0));
    v_status := case when v_now_wib > v_batas then 'terlambat' else 'terkirim' end;
  end if;

  update public.report
  set status = v_status, submitted_at = now(), updated_at = now()
  where id = p_report_id;
end;
$$;

commit;
