import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/FORMAT-ASLI-04-IT.md (format asli klien). scope 'global' --
 * satu PIC IT (Diki, lihat DATA-KARYAWAN.md), satu laporan per hari.
 *
 * §7 "PIC lokasi yang BELUM mengirim foto/video pembangunan" TIDAK jadi
 * field (keputusan D2) -- dihitung dari tabel `attachment` lewat
 * `usePicLokasiBelumUpload()` (lib/api/it.ts), dirender LaporForm.tsx.
 * IT tidak punya akses baris ke `pic_lokasi` (`can_see_report()` tidak
 * memberi role manapun selain author/ceo/pusat/dst. akses ke situ) --
 * dihitung lewat view security-definer `v_pic_lokasi_belum_upload_progress`
 * (migrasi 0012), pola §3.4b sama seperti rekap Kepala Pembangunan.
 *
 * Blok 1 dan 3 dokumen ASLI sama-sama menanyakan "Data pembayaran
 * ter-update: ✅/❌" -- literal sama persis, diketik SATU KALI di sini
 * (`data_pembayaran_terupdate`, blok 1), tidak diulang di blok 3. Ini
 * bukan D1-style silang-cek (dua ORANG berbeda mengukur hal berbeda) --
 * ini SATU orang (IT) ditanya pertanyaan yang SAMA persis dua kali dalam
 * SATU form, konsekuensi wajarnya sama seperti aturan "jangan bikin dua
 * field utk satu hal" yang berlaku sepanjang proyek ini (lihat f01/f13).
 *
 * Blok 13 "LAPORAN PERSONAL MARKETING IT" TIDAK dijadikan field -- rollup
 * generik yang sama dipakai semua form selain personal_marketing
 * (LaporForm.tsx, `perluRollupMarketing`).
 *
 * Blok 15 "REKAP IT UNTUK SABRINA" isinya hampir semua restatement dari
 * blok 1-11 (status sistem, data konsumen, dst.) -- TIDAK diulang sebagai
 * field, sama prinsipnya dengan form lain. Yang jadi field cuma yang
 * benar-benar baru: masalah utama, tindakan sudah dilakukan, belum
 * selesai, pemicu keputusan CEO, status IT hari ini.
 */
export const f14It: FormSchema = {
  key: 'it',
  nama: 'Laporan Harian IT',
  navLabel: 'Lapor IT',
  scope: 'global',
  blocks: [
    {
      id: 'sistem',
      judul: 'Sistem / Aplikasi Koperumnas',
      fields: [
        { key: 'aplikasi_normal', label: 'Aplikasi berjalan normal', type: 'ya_tidak' },
        { key: 'website_sistem_normal', label: 'Website berjalan normal', type: 'ya_tidak' },
        { key: 'login_normal', label: 'Login/user berjalan normal', type: 'ya_tidak' },
        { key: 'database_normal', label: 'Database berjalan normal', type: 'ya_tidak' },
        { key: 'data_pembayaran_terupdate', label: 'Data pembayaran ter-update', type: 'ya_tidak' },
        { key: 'data_konsumen_terupdate', label: 'Data konsumen ter-update', type: 'ya_tidak' },
        { key: 'error_detail', label: 'Jika ada error, detail', type: 'teks_panjang' },
        { key: 'error_mulai_jam', label: 'Mulai error jam', type: 'teks' },
        { key: 'error_sudah_diperbaiki', label: 'Sudah diperbaiki', type: 'ya_tidak' },
        { key: 'error_tindakan', label: 'Tindakan', type: 'teks' },
        { key: 'error_target_selesai', label: 'Target selesai', type: 'teks' },
      ],
    },
    {
      id: 'data_konsumen',
      judul: 'Update Data Konsumen di Sistem',
      catatan: 'Angka di blok ini menjadi sumber laporan konsumen harian Sabrina ke CEO.',
      fields: [
        { key: 'konsumen_total', label: 'Total konsumen', type: 'angka' },
        { key: 'konsumen_aktif', label: 'Aktif', type: 'angka' },
        { key: 'konsumen_baru_hari_ini', label: 'Konsumen baru hari ini', type: 'angka' },
        { key: 'konsumen_stk', label: 'STK', type: 'angka' },
        { key: 'konsumen_stkb', label: 'STKB', type: 'angka' },
        { key: 'konsumen_suspend', label: 'Suspend', type: 'angka' },
        { key: 'konsumen_menunggak', label: 'Menunggak', type: 'angka' },
        { key: 'konsumen_refund', label: 'Refund', type: 'angka' },
        { key: 'konsumen_take_over', label: 'Take Over', type: 'angka' },
        { key: 'perubahan_konsumen_baru_masuk', label: 'Perubahan -- konsumen baru masuk', type: 'angka' },
        { key: 'perubahan_aktif_ke_stk', label: 'Perubahan -- aktif ke STK', type: 'angka' },
        { key: 'perubahan_stk_ke_stkb', label: 'Perubahan -- STK ke STKB', type: 'angka' },
        { key: 'perubahan_jadi_suspend', label: 'Perubahan -- menjadi suspend', type: 'angka' },
        { key: 'perubahan_refund', label: 'Perubahan -- refund', type: 'angka' },
        { key: 'perubahan_take_over', label: 'Perubahan -- take over', type: 'angka' },
        { key: 'perubahan_lainnya', label: 'Perubahan lainnya', type: 'teks' },
        { key: 'data_belum_sinkron', label: 'Ada data belum sinkron', type: 'ya_tidak' },
        { key: 'data_belum_sinkron_detail', label: 'Detail data belum sinkron', type: 'teks_panjang' },
      ],
    },
    {
      id: 'pembayaran',
      judul: 'Sistem Pembayaran / Tagihan',
      catatan: 'IT memastikan sistem/data. Verifikasi keuangan tetap Accounting.',
      fields: [
        { key: 'pembayaran_masuk_sistem', label: 'Pembayaran masuk sistem (transaksi)', type: 'angka' },
        { key: 'tagihan_konsumen_terupdate', label: 'Tagihan konsumen ter-update', type: 'ya_tidak' },
        { key: 'status_tunggakan_terupdate', label: 'Status tunggakan ter-update', type: 'ya_tidak' },
        { key: 'transaksi_belum_masuk', label: 'Transaksi/data belum masuk', type: 'teks_panjang' },
        { key: 'pembayaran_tidak_cocok', label: 'Pembayaran tidak cocok', type: 'teks_panjang' },
        { key: 'pic_followup_pembayaran', label: 'PIC yang harus follow-up', type: 'teks' },
      ],
    },
    {
      id: 'website',
      judul: 'Website Koperumnas',
      fields: [
        { key: 'website_aktif', label: 'Website aktif', type: 'ya_tidak' },
        { key: 'website_info_program', label: 'Informasi program terbaru', type: 'ya_tidak' },
        { key: 'website_data_lokasi', label: 'Data lokasi', type: 'ya_tidak' },
        { key: 'website_kontak_wa', label: 'Kontak/WA', type: 'ya_tidak' },
        { key: 'website_form_pendaftaran', label: 'Form pendaftaran', type: 'ya_tidak' },
        { key: 'website_link_normal', label: 'Link berjalan normal', type: 'ya_tidak' },
        { key: 'website_foto_pembangunan_terbaru', label: 'Foto pembangunan terbaru', type: 'ya_tidak' },
        { key: 'website_update_dilakukan', label: 'Update yang dilakukan hari ini', type: 'teks_panjang' },
        { key: 'website_belum_diupdate', label: 'Yang belum di-update', type: 'teks_panjang' },
      ],
    },
    {
      id: 'medsos',
      judul: 'Update Official Media Sosial',
      catatan: 'IT wajib memastikan seluruh official aktif dan ter-update.',
      fields: [
        { key: 'ig_koperumnas', label: 'Koperumnas -- Instagram', type: 'ya_tidak' },
        { key: 'ig_koperumnas_konten', label: 'Koperumnas -- Instagram, jumlah konten', type: 'angka' },
        { key: 'tiktok_koperumnas', label: 'Koperumnas -- TikTok', type: 'ya_tidak' },
        { key: 'tiktok_koperumnas_konten', label: 'Koperumnas -- TikTok, jumlah konten', type: 'angka' },
        { key: 'youtube_koperumnas', label: 'Koperumnas -- YouTube', type: 'ya_tidak' },
        { key: 'youtube_koperumnas_konten', label: 'Koperumnas -- YouTube, jumlah konten', type: 'angka' },
        { key: 'threads_koperumnas', label: 'Koperumnas -- Threads', type: 'ya_tidak' },
        { key: 'threads_koperumnas_update', label: 'Koperumnas -- Threads, jumlah update', type: 'angka' },
        { key: 'ig_dti', label: 'DTI -- Instagram', type: 'ya_tidak' },
        { key: 'tiktok_dti', label: 'DTI -- TikTok', type: 'ya_tidak' },
        { key: 'youtube_dti', label: 'DTI -- YouTube', type: 'ya_tidak' },
        { key: 'ig_indokopi', label: 'Indokopi -- Instagram', type: 'ya_tidak' },
        { key: 'tiktok_indokopi', label: 'Indokopi -- TikTok', type: 'ya_tidak' },
        { key: 'threads_indokopi', label: 'Indokopi -- Threads', type: 'ya_tidak' },
        { key: 'ig_indosteak', label: 'Indosteak -- Instagram', type: 'ya_tidak' },
        { key: 'tiktok_indosteak', label: 'Indosteak -- TikTok', type: 'ya_tidak' },
        { key: 'threads_indosteak', label: 'Indosteak -- Threads', type: 'ya_tidak' },
        { key: 'medsos_belum_update', label: 'Official yang hari ini belum update', type: 'teks_panjang' },
        { key: 'medsos_alasan', label: 'Alasan', type: 'teks' },
        { key: 'medsos_target_selesai', label: 'Target diselesaikan', type: 'teks' },
      ],
    },
    {
      id: 'konten',
      judul: 'Konten & Video Mentahan',
      fields: [
        { key: 'video_mentahan_masuk', label: 'Video mentahan masuk hari ini', type: 'angka' },
        { key: 'video_pembangunan', label: 'Video pembangunan', type: 'angka' },
        { key: 'video_konsumen_testimoni', label: 'Video konsumen/testimoni', type: 'angka' },
        { key: 'video_resto_fnb', label: 'Video resto/F&B', type: 'angka' },
        { key: 'video_marketing', label: 'Video marketing', type: 'angka' },
        { key: 'konten_sudah_diedit', label: 'Sudah diedit', type: 'angka' },
        { key: 'konten_sudah_upload', label: 'Sudah upload', type: 'angka' },
        { key: 'konten_belum_diedit', label: 'Belum diedit', type: 'angka' },
        { key: 'konten_belum_upload', label: 'Belum upload', type: 'angka' },
        { key: 'konten_prioritas', label: 'Konten terbaik/prioritas hari ini', type: 'teks_panjang' },
      ],
    },
    {
      id: 'pembangunan_digital',
      judul: 'Update Pembangunan Digital',
      catatan: 'Daftar PIC lokasi yang belum mengirim foto/video ditampilkan otomatis di atas -- dihitung dari lampiran, bukan diketik.',
      fields: [
        { key: 'lokasi_update_hari_ini', label: 'Lokasi yang menerima update hari ini', type: 'teks_panjang' },
        { key: 'foto_pembangunan_masuk', label: 'Foto masuk', type: 'angka' },
        { key: 'video_pembangunan_masuk', label: 'Video masuk', type: 'angka' },
        { key: 'pembangunan_sudah_upload', label: 'Sudah upload', type: 'angka' },
        { key: 'pembangunan_belum_upload', label: 'Belum upload', type: 'angka' },
      ],
    },
    {
      id: 'google_review',
      judul: 'Google Review',
      fields: [
        { key: 'review_baru', label: 'Review baru hari ini', type: 'angka' },
        { key: 'review_dibalas', label: 'Review sudah dibalas', type: 'angka' },
        { key: 'review_belum_dibalas', label: 'Belum dibalas', type: 'angka' },
        { key: 'rating_saat_ini', label: 'Rating saat ini', type: 'angka' },
        { key: 'review_bermasalah', label: 'Review/komentar bermasalah', type: 'teks_panjang' },
        { key: 'review_tindak_lanjut', label: 'Perlu tindak lanjut', type: 'teks_panjang' },
      ],
    },
    {
      id: 'testimoni',
      judul: 'Kesaksian / Testimoni Konsumen',
      fields: [
        { key: 'kesaksian_masuk', label: 'Kesaksian masuk', type: 'angka' },
        { key: 'video_testimoni', label: 'Video testimoni', type: 'angka' },
        { key: 'testimoni_diedit', label: 'Sudah diedit', type: 'angka' },
        { key: 'testimoni_diposting', label: 'Sudah diposting', type: 'angka' },
        { key: 'testimoni_belum_diposting', label: 'Belum diposting', type: 'angka' },
        { key: 'testimoni_kebutuhan_baru', label: 'Kebutuhan testimoni baru', type: 'teks_panjang' },
      ],
    },
    {
      id: 'leads',
      judul: 'Komentar / DM / Leads Medsos',
      fields: [
        { key: 'dm_masuk', label: 'DM masuk', type: 'angka' },
        { key: 'komentar_masuk', label: 'Komentar masuk', type: 'angka' },
        { key: 'pertanyaan_calon_konsumen', label: 'Pertanyaan calon konsumen', type: 'angka' },
        { key: 'leads_baru', label: 'Leads baru dari medsos', type: 'angka' },
        { key: 'leads_diteruskan', label: 'Sudah diteruskan ke Marketing/CS', type: 'angka' },
        { key: 'leads_belum_ditindaklanjuti', label: 'Belum ditindaklanjuti', type: 'angka' },
        { key: 'leads_urgent', label: 'Leads urgent', type: 'teks_panjang' },
        { key: 'leads_pic_followup', label: 'PIC follow-up', type: 'teks' },
      ],
    },
    {
      id: 'backup',
      judul: 'Backup & Keamanan Data',
      fields: [
        { key: 'backup_database', label: 'Backup database', type: 'ya_tidak' },
        { key: 'backup_dokumen', label: 'Backup dokumen penting', type: 'ya_tidak' },
        { key: 'backup_foto_video', label: 'Backup foto/video', type: 'ya_tidak' },
        { key: 'storage_cukup', label: 'Storage cukup', type: 'ya_tidak' },
        { key: 'cctv_sistem_normal', label: 'CCTV/sistem terkait IT normal', type: 'ya_tidak' },
        { key: 'internet_kantor_normal', label: 'Internet kantor normal', type: 'ya_tidak' },
        { key: 'backup_masalah', label: 'Masalah', type: 'teks_panjang' },
      ],
    },
    {
      id: 'perangkat',
      judul: 'Perangkat & Jaringan',
      fields: [
        { key: 'komputer_kantor', label: 'Komputer kantor', type: 'ya_tidak' },
        { key: 'printer', label: 'Printer', type: 'ya_tidak' },
        { key: 'internet_wifi', label: 'Internet/WiFi', type: 'ya_tidak' },
        { key: 'cctv_perangkat', label: 'CCTV', type: 'ya_tidak' },
        { key: 'perangkat_pendukung', label: 'Perangkat pendukung', type: 'ya_tidak' },
        { key: 'kerusakan_perangkat', label: 'Kerusakan', type: 'teks_panjang' },
        { key: 'kerusakan_user_divisi', label: 'User/divisi', type: 'teks' },
        { key: 'kerusakan_sudah_ditangani', label: 'Sudah ditangani', type: 'ya_tidak' },
        { key: 'kerusakan_target_selesai', label: 'Target selesai', type: 'teks' },
      ],
    },
    {
      id: 'besok',
      judul: 'Target IT Besok',
      fields: [
        { key: 'besok_sistem', label: 'Sistem/aplikasi', type: 'teks' },
        { key: 'besok_data_konsumen', label: 'Data konsumen', type: 'teks' },
        { key: 'besok_website', label: 'Website', type: 'teks' },
        { key: 'besok_medsos', label: 'Medsos', type: 'teks' },
        { key: 'besok_konten', label: 'Konten/video', type: 'teks' },
        { key: 'besok_review_testimoni', label: 'Google Review/testimoni', type: 'teks' },
        { key: 'besok_masalah', label: 'Masalah IT yang harus diselesaikan', type: 'teks' },
      ],
    },
    blokKeputusanCeo('Rekap IT untuk Sabrina', 'Status IT hari ini', [
      { key: 'tindakan_sudah_dilakukan', label: 'Tindakan yang sudah dilakukan', type: 'teks_panjang' },
      { key: 'belum_selesai', label: 'Belum selesai', type: 'teks_panjang' },
    ]),
  ],
};
