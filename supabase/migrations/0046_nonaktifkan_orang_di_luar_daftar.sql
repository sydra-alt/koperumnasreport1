-- Jawaban CEO soal siapa masuk sistem baru (docs/RENCANA-PROYEK-BARU.md,
-- 6 September 2026): Koperumnas tetap jalan TAPI hanya untuk pegawai
-- Indosteak, Indokopi, dan thrifting. "Sisanya dinonaktifkan, jangan
-- dihapus" -- persis pola `profile.aktif` yang sudah dipakai (bukan hapus
-- baris), dan yang SUDAH ditegakkan lewat `where p.aktif` di banyak
-- agregasi (papan_untuk_tanggal, presensi_untuk_tanggal, rollup marketing,
-- dst.) -- orang nonaktif otomatis berhenti dihitung sebagai yang wajib
-- lapor/PTE/presensi, tanpa kehilangan riwayat.
--
-- Daftar yang TETAP AKTIF (12 orang eksplisit dari CEO):
--   Indosteak Cempaka Putih : Dea (manager), Ryan, Qasim, Bagus
--   Indosteak Pekansari     : Cuko (manager), Elsa, Lusy
--   Indokopi (rotasi)       : Toni, Fikri, Fadil -- manager: Ery (dieja
--                             "Erry" oleh CEO, orang yang sama -- sudah
--                             dikonfirmasi sebelumnya, lihat docs/PROGRESS.md
--                             "Ery=Erry satu orang")
--   Thrifting               : Ita
--
-- SENGAJA TIDAK disentuh di migrasi ini (menunggu jawaban CEO, TIDAK
-- diputuskan sendiri):
--   - Ahmad -- ada di daftar lama Cempaka tapi hilang dari daftar baru.
--     Instruksi eksplisit CEO: tanya dulu, jangan dinonaktifkan.
--   - Didik, Sabrina (keduanya profile.divisi='HRD') dan Shabita
--     (profile.divisi='Keuangan', jabatan Accounting) -- CEO belum
--     menyebutkan HRD/Accounting sama sekali di daftar, sedang ditanyakan.
--   - 'badar' -- akun admin/developer sistem (tidak punya divisi/jabatan
--     sama sekali), bukan pegawai operasional, di luar cakupan pertanyaan
--     "siapa masuk sistem baru".
--   - Putri -- CEO sendiri.
--
-- SATU TEMUAN YANG DILAPORKAN, BUKAN DIPUTUSKAN SENDIRI (pola sama dengan
-- kasus Ahmad di atas): 'Mba Rika' (divisi 'Kontrol F&B') TIDAK ada di
-- daftar 12 orang CEO, TAPI dia PIC `assignment` form kontrol_fnb untuk
-- KEDUA outlet Indosteak yang ada sekarang (Cempaka & Pekansari, dari kerja
-- Batch B sebelumnya) -- form itu SENDIRI eksplisit dipertahankan CEO
-- ("kontrol_fnb -- inti sistem sekarang"). Menonaktifkan dia lewat migrasi
-- ini akan mencabut satu-satunya PIC kontrol_fnb yang berjalan di kedua
-- outlet itu -- dampak operasional nyata, bukan cuma status akun. TIDAK
-- disentuh, dilaporkan balik ke CEO.
update public.profile
set aktif = false
where nama in (
  'Anne', 'Avril', 'Cahya', 'Dadang', 'Dedi', 'Diki', 'Fauzan', 'Fauzy',
  'Fur', 'Ibnu', 'Jery', 'Kasam', 'Makruf', 'Masudin', 'Pak Tri', 'Ronald',
  'Seno', 'Syahbudin', 'Tasya', 'Toyib', 'Wandi', 'Yundi'
);
