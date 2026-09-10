-- Perubahan arah CEO (docs/RENCANA-PROYEK-BARU.md §2, 2-3 September 2026):
-- fokus pindah dari Koperumnas (perumahan) ke Indosteak/Indokopi/Thrifting.
-- 9 form perumahan DINONAKTIFKAN, BUKAN dihapus -- instruksi eksplisit CEO
-- ("kalau ternyata CEO masih membutuhkannya, memulihkan lebih mudah daripada
-- menulis ulang", §3 dokumen).
--
-- "Nonaktifkan" di sini berarti: hapus baris `assignment` untuk 9 form_key
-- ini, supaya tidak ada lagi yang ditugaskan mengisinya -- form berhenti
-- muncul di Beranda/Papan Kontrol/nav Lapor (assignment-lah yang membuat
-- kartu tugas muncul, lihat `papan_untuk_tanggal()` migrasi 0020 dan
-- `hitungTugasHariIni` di lib/tugasHariIni.ts).
--
-- TIDAK disentuh sama sekali: schema form (`forms/*.ts`, `forms/index.ts`),
-- migrasi tabel `lokasi`/`v_pembangunan_*`, dan data `report` historis
-- form-form ini -- semuanya tetap ada, cuma tidak ada assignment baru yang
-- merujuknya. Tidak ada FK ke `assignment.id` dari tabel lain (diverifikasi
-- lewat information_schema sebelum migrasi ini ditulis), jadi penghapusan
-- baris ini tidak mencabut apa pun di luar dirinya sendiri.
--
-- `security` (form ke-16 yang terlewat di audit pertama, §3 poin 1) SENGAJA
-- TIDAK disentuh -- CEO sedang menanyakan ke pihak terkait apakah dipakai.
--
-- Personal_marketing TIDAK lewat assignment sama sekali (wajib otomatis
-- untuk semua role karyawan) -- tidak relevan di sini.
delete from public.assignment
where form_key in (
  'pic_lokasi', 'pembangunan', 'perizinan', 'dti', 'kendaraan', 'pusat', 'cs', 'ga', 'it'
);
