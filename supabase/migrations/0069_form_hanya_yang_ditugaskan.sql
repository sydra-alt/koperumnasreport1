-- 0069 -- Form divisi hanya untuk yang DITUGASKAN (4 Oktober 2026, audit UI R01).
--
-- MASALAH: report_insert/report_update (0002) cuma memeriksa
-- author_id = auth.uid(). Karyawan mana pun bisa membuka DAN mengirim form
-- divisi yang bukan tugasnya -- termasuk accounting, yang dibatasi satu per
-- hari (report_accounting_singleton, 0058): satu kiriman nyasar memblokir
-- laporan accounting sungguhan hari itu.
--
-- ATURAN BARU (brief pemilik proyek): seseorang boleh membuka/mengirim form
-- untuk outlet/lokasi O hanya kalau penugasannya mencakup form itu DAN O,
-- atau dia CEO/Admin (is_admin(), 0039). Pengecualian yang SUDAH ada di
-- desain aplikasi, bukan kelonggaran baru:
--   * personal_marketing -- kewajiban SEMUA karyawan berperan `karyawan`,
--     bukan assignment per orang (lib/tugasHariIni.ts, 0003_seed.sql).
--   * kebersihan -- berbasis penugasan_absen di outlet (keputusan CEO,
--     0053, boleh_isi_kebersihan). Baris bersamanya tetap dibuat HANYA lewat
--     RPC kebersihan_pastikan_laporan yang sudah menolak sebelum insert;
--     cabang di sini cuma menyamakan jalur generik dengan RPC itu.
--
-- ADITIF & KOMPATIBEL: dua fungsi baru + ALTER POLICY (tanpa DROP). Tidak
-- ada baris yang dihapus/diubah -- aturan ini cuma berlaku untuk INSERT dan
-- UPDATE berikutnya. Kolom, tabel, dan API tetap sama.
-- Kill-switch (kembali persis ke 0002): lihat bagian paling bawah.

begin;

-- Boleh menulis laporan form `f` untuk lokasi/outlet ini? Cocok PERSIS:
-- assignment global (lokasi & outlet null) hanya untuk laporan global;
-- assignment outlet X hanya untuk laporan outlet X. Shift TIDAK dicocokkan
-- (pemilihan shift tetap di form, seperti sebelumnya).
create or replace function public.boleh_isi_form(f text, p_lokasi uuid, p_outlet uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
       public.is_admin()
    or (f = 'personal_marketing' and public.has_role('karyawan'))
    or (f = 'kebersihan' and p_outlet is not null and public.boleh_isi_kebersihan(p_outlet))
    or exists (
      select 1 from public.assignment a
      where a.user_id = auth.uid()
        and a.form_key = f
        and a.lokasi_id is not distinct from p_lokasi
        and a.outlet_id is not distinct from p_outlet
    )
  );
$$;

-- Boleh MEMBUKA halaman form `f` (tanpa outlet/lokasi tertentu): punya
-- minimal satu penugasan form itu, atau CEO/Admin, atau pengecualian di
-- atas. Dipakai halaman /lapor/[formKey] di server sebelum form dirender.
create or replace function public.boleh_buka_form(f text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
       public.is_admin()
    or (f = 'personal_marketing' and public.has_role('karyawan'))
    or (f = 'kebersihan' and exists (
          select 1 from public.penugasan_absen pa
          join public.lokasi_absen la on la.id = pa.lokasi_absen_id
          where pa.user_id = auth.uid() and la.outlet_id is not null))
    or exists (select 1 from public.assignment a where a.user_id = auth.uid() and a.form_key = f)
  );
$$;

revoke all on function public.boleh_isi_form(text, uuid, uuid) from public;
revoke all on function public.boleh_buka_form(text) from public;
grant execute on function public.boleh_isi_form(text, uuid, uuid) to authenticated;
grant execute on function public.boleh_buka_form(text) to authenticated;

alter policy report_insert on public.report
  with check (author_id = auth.uid() and public.boleh_isi_form(form_key, lokasi_id, outlet_id));

-- USING tetap persis 0002 (milik sendiri, hari ini); WITH CHECK ditambah
-- aturan yang sama -- draf lama milik orang yang tidak ditugaskan tidak bisa
-- dikirim, tapi juga tidak dihapus/diubah oleh migrasi ini.
alter policy report_update on public.report
  using (author_id = auth.uid() and tanggal = ((now() at time zone 'Asia/Jakarta'))::date)
  with check (author_id = auth.uid() and public.boleh_isi_form(form_key, lokasi_id, outlet_id));

commit;

-- ── Kill-switch (jalankan manual di SQL Editor kalau perlu kembali ke 0002) ──
-- begin;
-- alter policy report_insert on public.report with check (author_id = auth.uid());
-- alter policy report_update on public.report
--   using (author_id = auth.uid() and tanggal = ((now() at time zone 'Asia/Jakarta'))::date)
--   with check (author_id = auth.uid());
-- commit;
-- (Fungsi boleh_isi_form/boleh_buka_form boleh dibiarkan -- tidak dipakai lagi.)
