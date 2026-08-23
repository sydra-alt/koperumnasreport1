import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN PIC LOKASI"
 * (baris 924-1104), diindeks lewat docs/REFERENSI-FORMAT-LAPORAN.md §1.
 *
 * Blok 1 (header Tanggal/Lokasi/PIC) SENGAJA tidak di sini -- ditampilkan
 * LaporForm.tsx dari `useAuth()` + lokasi terpilih, sama polanya dengan
 * Blok 1 di f01-personal-marketing.
 *
 * Kunci `unit_dibangun`, `unit_finishing`, `unit_selesai`, `unit_belum_mulai`
 * (bagian 3) adalah KONTRAK dengan `v_pembangunan_hari_ini` (03-CALC-SPEC.md
 * §4.2) -- jangan diganti namanya tanpa mengganti view itu juga.
 *
 * Bukti foto/video progress "WAJIB setiap hari" (bukan tergantung isian lain)
 * ditempel di `progress_catatan`, yang bertipe wajib:true -- karena field wajib
 * SELALU "terisi" begitu form valid, buktiWajib di situ otomatis berarti bukti
 * dituntut di SETIAP pengiriman, bukan cuma kalau nilai tertentu dijawab.
 *
 * Bagian 9 "LAPORAN PERSONAL MARKETING" (rekap PTE/undangan/closing milik PIC
 * sendiri) TIDAK dijadikan field -- itu murni tampilan dihitung/digabung dari
 * data yang sudah ada, dirender LaporForm.tsx (sama alasannya dengan Blok
 * 2/5/6/8 di f01), sekarang GENERIK untuk semua form selain personal_marketing.
 *
 * Bagian 11 "REKAP LOKASI UNTUK SABRINA" dipakai lewat `blokKeputusanCeo()`
 * (forms/blok-bersama.ts) -- blok yang sama muncul di hampir semua format
 * divisi lain (Task 14/15) dengan kunci field PERSIS SAMA, supaya logika
 * "kalau dicentang & judul terisi, buat baris decision" di LaporForm.tsx
 * bisa generik, bukan diperiksa satu-satu per formKey.
 */
export const f13PicLokasi: FormSchema = {
  key: 'pic_lokasi',
  nama: 'Laporan Harian PIC Lokasi',
  navLabel: 'Lapor Lokasi',
  scope: 'lokasi',
  blocks: [
    {
      id: 'konsumen',
      judul: '1 · Konsumen di Lokasi',
      fields: [
        { key: 'konsumen_di_lokasi', label: 'Konsumen di lokasi ini', type: 'angka' },
        { key: 'konsumen_datang', label: 'Konsumen datang hari ini (orang)', type: 'angka' },
        { key: 'konsumen_baru', label: 'Konsumen baru', type: 'angka' },
        { key: 'keluhan_konsumen', label: 'Keluhan konsumen (jumlah)', type: 'angka' },
        { key: 'keperluan_konsumen', label: 'Keperluan konsumen yang datang', type: 'teks_panjang' },
        { key: 'keluhan_tindak_lanjut', label: 'Keluhan & tindak lanjut', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kavling',
      judul: '2 · Kavling',
      fields: [
        { key: 'kavling_total', label: 'Total kavling', type: 'angka' },
        { key: 'kavling_terjual', label: 'Kavling terjual', type: 'angka' },
        { key: 'kavling_tersedia', label: 'Kavling tersedia', type: 'angka' },
        { key: 'kavling_belum_laku', label: 'Kavling belum laku', type: 'angka' },
        { key: 'kavling_kebutuhan_tambahan', label: 'Kebutuhan kavling tambahan', type: 'angka' },
        { key: 'kavling_bermasalah', label: 'Kavling bermasalah (sengketa/akses/kondisi)', type: 'teks_panjang' },
      ],
    },
    {
      id: 'pembangunan',
      judul: '3 · Pembangunan di Lokasi Ini',
      catatan: 'Foto/video progress wajib dilampirkan setiap hari -- kirim tanpa itu ditolak.',
      fields: [
        { key: 'target_unit', label: 'Target (unit)', type: 'angka' },
        { key: 'unit_dibangun', label: 'Sedang dibangun (unit)', type: 'angka' },
        { key: 'unit_finishing', label: 'Finishing (unit)', type: 'angka' },
        { key: 'unit_selesai', label: 'Selesai hari ini (unit)', type: 'angka' },
        { key: 'unit_belum_mulai', label: 'Belum mulai (unit)', type: 'angka' },
        {
          key: 'progress_catatan',
          label: 'Progress pekerjaan hari ini',
          type: 'teks_panjang',
          wajib: true,
          buktiWajib: true,
          buktiKunci: 'progress',
          bantuan: 'Wajib lampirkan foto/video progress hari ini.',
        },
        { key: 'kontraktor', label: 'Kontraktor yang bekerja', type: 'teks' },
        { key: 'jumlah_tukang', label: 'Jumlah tukang hari ini (orang)', type: 'angka' },
        { key: 'pekerjaan_berhenti', label: 'Pekerjaan yang berhenti (kosongkan kalau tidak ada)', type: 'teks_panjang' },
        { key: 'pekerjaan_berhenti_penyebab', label: 'Penyebab pekerjaan berhenti', type: 'teks_panjang' },
        { key: 'foto_progress_jumlah', label: 'Jumlah foto', type: 'angka' },
        { key: 'video_progress_jumlah', label: 'Jumlah video', type: 'angka' },
        { key: 'progress_dikirim_it', label: 'Sudah dikirim ke IT', type: 'ya_tidak' },
      ],
    },
    {
      id: 'infrastruktur',
      judul: '4 · Infrastruktur Lokasi',
      fields: [
        { key: 'jalan_status', label: 'Jalan', type: 'pilih', pilihan: ['Baik', 'Perlu perbaikan', 'Rusak'] },
        { key: 'jalan_keterangan', label: 'Keterangan jalan', type: 'teks' },
        { key: 'listrik_status', label: 'Listrik', type: 'pilih', pilihan: ['Sudah', 'Proses', 'Belum'] },
        { key: 'listrik_keterangan', label: 'Keterangan listrik', type: 'teks' },
        { key: 'air_status', label: 'Air', type: 'pilih', pilihan: ['Sudah', 'Proses', 'Belum'] },
        { key: 'air_keterangan', label: 'Keterangan air', type: 'teks' },
        { key: 'drainase_baik', label: 'Drainase/saluran baik', type: 'ya_tidak' },
        { key: 'penerangan_baik', label: 'Penerangan jalan baik', type: 'ya_tidak' },
        { key: 'gerbang_baik', label: 'Gerbang/pagar baik', type: 'ya_tidak' },
        { key: 'infrastruktur_kebutuhan', label: 'Kebutuhan infrastruktur', type: 'teks_panjang' },
        { key: 'infrastruktur_estimasi_biaya', label: 'Estimasi biaya', type: 'uang' },
      ],
    },
    {
      id: 'perizinan',
      judul: '5 · Perizinan Lokasi',
      fields: [
        { key: 'izin_status', label: 'Status izin', type: 'teks' },
        { key: 'izin_boleh_bangun', label: 'Sudah boleh dibangun', type: 'ya_tidak' },
        { key: 'izin_ditunggu', label: 'Izin yang masih ditunggu', type: 'teks' },
        { key: 'izin_kendala', label: 'Kendala perizinan', type: 'teks' },
      ],
    },
    {
      id: 'stk',
      judul: '6 · STK & Rumah Tidak Ditempati',
      fields: [
        { key: 'stk_total', label: 'Rumah STK di lokasi ini', type: 'angka' },
        { key: 'stk_sudah_ditempati', label: 'Sudah ditempati', type: 'angka' },
        { key: 'stk_belum_ditempati', label: 'Belum ditempati', type: 'angka' },
        { key: 'stk_rumah_kosong', label: 'Rumah kosong', type: 'angka' },
        { key: 'stk_perlu_maintenance', label: 'Perlu maintenance', type: 'angka' },
        {
          key: 'rumah_kosong_bermasalah',
          label: 'Rumah kosong yang bermasalah',
          type: 'tabel',
          kolom: [
            { key: 'no_unit', label: 'No. unit', type: 'teks' },
            { key: 'nama_konsumen', label: 'Nama konsumen', type: 'teks' },
            { key: 'lama_kosong', label: 'Sudah berapa lama kosong', type: 'teks' },
            { key: 'kondisi', label: 'Kondisi', type: 'teks' },
            { key: 'tindakan', label: 'Tindakan', type: 'teks' },
          ],
        },
        { key: 'rumah_rusak', label: 'Rumah rusak/perlu perbaikan', type: 'teks_panjang' },
        { key: 'maintenance_estimasi_biaya', label: 'Estimasi biaya maintenance', type: 'uang' },
      ],
    },
    {
      id: 'kebersihan_keamanan',
      judul: '7 · Kebersihan & Keamanan Lokasi',
      fields: [
        { key: 'kebersihan_baik', label: 'Kebersihan lokasi baik', type: 'ya_tidak' },
        { key: 'rumput_terkendali', label: 'Rumput/semak terkendali', type: 'ya_tidak' },
        { key: 'sampah_terangkut', label: 'Sampah terangkut', type: 'ya_tidak' },
        { key: 'keamanan_baik', label: 'Keamanan lokasi baik', type: 'ya_tidak' },
        { key: 'material_aman', label: 'Material aman', type: 'ya_tidak' },
        { key: 'ada_satpam', label: 'Ada satpam bertugas', type: 'ya_tidak' },
        {
          key: 'video_kondisi_lokasi',
          label: 'Video kondisi lokasi hari ini',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'kondisi_lokasi',
        },
        { key: 'kebersihan_masalah', label: 'Masalah kebersihan/keamanan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'material',
      judul: '8 · Material di Lokasi',
      fields: [
        { key: 'material_cukup', label: 'Material cukup', type: 'ya_tidak' },
        {
          key: 'material_kurang',
          label: 'Material habis/kurang',
          type: 'tabel',
          kolom: [
            { key: 'material', label: 'Material', type: 'teks' },
            { key: 'kebutuhan', label: 'Kebutuhan', type: 'teks' },
            { key: 'untuk_unit', label: 'Untuk unit', type: 'teks' },
            { key: 'dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
          ],
        },
        { key: 'kiriman_precast_jumlah', label: 'Kiriman precast/perikas dari DTI diterima (pcs)', type: 'angka' },
        { key: 'kiriman_kekurangan', label: 'Kekurangan kiriman', type: 'teks' },
      ],
    },
    {
      id: 'besok',
      judul: '10 · Target Lokasi Besok',
      fields: [
        { key: 'besok_pembangunan', label: 'Pembangunan', type: 'teks' },
        { key: 'besok_infrastruktur', label: 'Infrastruktur', type: 'teks' },
        { key: 'besok_konsumen', label: 'Konsumen/penagihan', type: 'teks' },
        { key: 'besok_kebersihan', label: 'Kebersihan/keamanan', type: 'teks' },
        { key: 'besok_kirim_pusat', label: 'Yang harus dikirim pusat', type: 'teks' },
      ],
    },
    blokKeputusanCeo(11, 'Rekap Lokasi untuk Sabrina', 'Status lokasi hari ini'),
  ],
};
