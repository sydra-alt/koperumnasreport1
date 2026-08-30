-- Perbaikan celah RLS ditemukan sendiri sambil menyiapkan uji (0025_cuti.sql,
-- BELUM di-commit): `cuti_insert` cuma memeriksa `user_id = auth.uid()`, tidak
-- memeriksa KOLOM `status` -- karyawan mana pun bisa insert baris `cuti`
-- langsung lewat REST dengan `status: 'disetujui'`, MELEWATI putuskan_cuti()
-- sepenuhnya. Akibatnya nyata: baris itu akan ikut mengecualikan hari_bolong
-- di marketing_bulanan_untuk() (migrasi 0025) -- karyawan bisa mengarang cuti
-- sendiri untuk menghindari potongan/PTE tanpa persetujuan siapa pun. Pola
-- jebakan yang sama seperti dicatat di 04-CATATAN-TEKNIS.md §3.2 (RLS bisa
-- membatasi BARIS, tidak otomatis membatasi ISI KOLOM).
drop policy cuti_insert on public.cuti;
create policy cuti_insert on public.cuti for insert with check (
  user_id = auth.uid()
  and status = 'diajukan'
  and disetujui_oleh is null
  and disetujui_at is null
);
