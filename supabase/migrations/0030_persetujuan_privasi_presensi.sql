-- Layar persetujuan privasi presensi (instruksi eksplisit user, 30 Agustus
-- 2026) -- UU PDP mengharuskan orang tahu data apa yang direkam SEBELUM
-- perekamannya mulai. Satu kolom timestamp di `profile`, diisi SEKALI lewat
-- RPC (bukan update langsung dari klien) -- nilainya dihitung SERVER (now()),
-- bukan dipercaya dari klien, supaya catatannya kuat sebagai bukti kalau
-- suatu saat dipersoalkan (kapan sungguhan disetujui, bukan tanggal yang bisa
-- diketik siapa pun). Idempoten lewat WHERE ... is null -- percobaan kedua
-- (klik dobel, refresh) tidak menimpa waktu persetujuan yang asli.
--
-- TIDAK ditambahkan ke trigger `jaga_profil_sensitif` (0028/0029) -- beda
-- kelas masalah dari divisi/aktif: kolom itu TIDAK memberi privilege atau
-- memalsukan persetujuan PIHAK LAIN, cuma catatan persetujuan diri sendiri.
-- RPC dgn now() sudah cukup kuat tanpa perlu proteksi tambahan sekelas itu.
alter table public.profile add column persetujuan_privasi_absen_at timestamptz;

create or replace function public.setujui_privasi_presensi()
returns void
language sql security definer set search_path = public as $$
  update public.profile set persetujuan_privasi_absen_at = now()
  where id = auth.uid() and persetujuan_privasi_absen_at is null;
$$;
