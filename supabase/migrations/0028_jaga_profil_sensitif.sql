-- Ditemukan sambil menambah kolom persetujuan privasi ke `profile` (batch
-- privasi presensi, 30 Agustus 2026) -- BUKAN salah satu dari 4 tabel yang
-- diminta user diperiksa (decision/absensi/closing/pte_daily), tapi pola
-- SAMA PERSIS dengan pelajaran yang baru ditegaskan ("periksa NILAI kolom,
-- bukan cuma pemilik"), dan LEBIH PARAH: `profile_update` (0002_rls.sql)
-- SAMA SEKALI tidak punya `WITH CHECK` -- Postgres lalu memakai `USING`
-- (`id = auth.uid() or has_role('ceo')`) sebagai check juga, yang cuma
-- memverifikasi ID baris TIDAK berubah, TIDAK membatasi kolom mana yang
-- boleh diubah pemiliknya sendiri.
--
-- DIBUKTIKAN LANGSUNG (penyamaran JWT, transaksi di-ROLLBACK): karyawan
-- biasa (Toyib, role 'karyawan' saja) BERHASIL mengubah `profile.divisi`
-- miliknya sendiri jadi 'HRD' lewat UPDATE langsung. Divisi 'HRD' + role
-- 'kadiv' = `is_hrd_kadiv()` bernilai true (migrasi 0022) -- dan role
-- 'kadiv' itu sendiri SUDAH dipegang oleh beberapa orang non-HRD (Avril/CS,
-- Makruf/Perizinan, Diki/IT, Ronald/Teknik, Seno/DTI, lihat
-- `docs/DATA-KARYAWAN.md` §1) yang TIDAK PERNAH ditambah lewat `role_admin`
-- (sudah benar, `has_role('ceo')`) -- mereka cuma perlu mengubah divisi
-- teks miliknya sendiri untuk lolos `is_hrd_kadiv()` dan mendapat akses
-- melihat & MEMUTUSKAN absensi/cuti SELURUH KARYAWAN (`putuskan_absensi`,
-- `putuskan_cuti`), bukan cuma milik sendiri. `aktif` juga rawan dgn cara
-- lebih halus -- karyawan bisa set `aktif=false` miliknya sendiri untuk
-- keluar dari filter `where pr.aktif` di `marketing_bulanan_untuk()`,
-- menyembunyikan kepatuhan PTE-nya sendiri dari perhitungan.
--
-- Perbaikan LEWAT TRIGGER, bukan WITH CHECK di policy -- RLS WITH CHECK
-- cuma melihat baris BARU, tidak punya cara bersih membandingkan ke nilai
-- LAMA tanpa subquery diri-sendiri yang rumit. Trigger BEFORE UPDATE punya
-- OLD/NEW secara native, pola yang sudah ada di tabel ini juga
-- (`report_updated`/`pte_daily_updated`, migrasi 0001) -- bukan mekanisme
-- baru bagi codebase ini.
create or replace function public.jaga_profil_sensitif()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('ceo') then
    if new.divisi is distinct from old.divisi or new.aktif is distinct from old.aktif then
      raise exception 'Hanya CEO yang boleh mengubah divisi atau status aktif.';
    end if;
  end if;
  return new;
end $$;

create trigger profil_sensitif_guard
  before update on public.profile
  for each row execute function public.jaga_profil_sensitif();
