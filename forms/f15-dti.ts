import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * DTI / PRECAST / PERIKAS" (baris 607-761). scope 'global' -- satu PIC
 * DTI, satu pabrik.
 */
export const f15Dti: FormSchema = {
  key: 'dti',
  nama: 'Laporan Harian DTI / Precast / Perikas',
  navLabel: 'Lapor DTI',
  scope: 'global',
  blocks: [
    {
      id: 'produksi',
      judul: '1 · Produksi Hari Ini',
      fields: [
        { key: 'target_produksi', label: 'Target produksi', type: 'angka' },
        { key: 'realisasi_produksi', label: 'Realisasi', type: 'angka' },
        { key: 'pencapaian_produksi_persen', label: 'Pencapaian (%)', type: 'angka' },
        { key: 'precast_target', label: 'Precast -- target (pcs)', type: 'angka' },
        { key: 'precast_dibuat', label: 'Precast -- dibuat hari ini (pcs)', type: 'angka' },
        { key: 'precast_lolos_qc', label: 'Precast -- lolos QC (pcs)', type: 'angka' },
        { key: 'precast_reject', label: 'Precast -- reject (pcs)', type: 'angka' },
        { key: 'perikas_target', label: 'Perikas -- target', type: 'angka' },
        { key: 'perikas_dibuat', label: 'Perikas -- dibuat hari ini', type: 'angka' },
        { key: 'perikas_lolos_qc', label: 'Perikas -- lolos QC', type: 'angka' },
        { key: 'perikas_reject', label: 'Perikas -- reject', type: 'angka' },
        { key: 'penyebab_tidak_capai_target', label: 'Jika tidak mencapai target, penyebab', type: 'teks_panjang' },
      ],
    },
    {
      id: 'stok_produksi',
      judul: '2 · Stok Hasil Produksi',
      fields: [
        { key: 'stok_precast_siap_kirim', label: 'Stok precast siap kirim (pcs)', type: 'angka' },
        { key: 'stok_perikas_siap_kirim', label: 'Stok perikas siap kirim', type: 'angka' },
        { key: 'dikirim_ke_lokasi_hari_ini', label: 'Dikirim ke lokasi hari ini (pcs)', type: 'angka' },
        {
          key: 'pengiriman_lokasi',
          label: 'Pengiriman ke lokasi',
          type: 'tabel',
          kolom: [
            { key: 'lokasi_tujuan', label: 'Lokasi tujuan', type: 'teks' },
            { key: 'barang', label: 'Barang', type: 'teks' },
            { key: 'jumlah', label: 'Jumlah', type: 'teks' },
            { key: 'surat_jalan', label: 'Surat jalan (ya/tidak)', type: 'teks' },
            { key: 'diterima', label: 'Diterima (ya/tidak)', type: 'teks' },
          ],
        },
        { key: 'permintaan_belum_terpenuhi', label: 'Permintaan lokasi yang belum bisa dipenuhi', type: 'teks_panjang' },
      ],
    },
    {
      id: 'stok_material',
      judul: '3 · Stok Material Produksi',
      fields: [
        {
          key: 'stok_material',
          label: 'Stok material',
          type: 'tabel',
          kolom: [
            { key: 'material', label: 'Material', type: 'teks' },
            { key: 'stok_awal', label: 'Stok awal', type: 'teks' },
            { key: 'terpakai', label: 'Terpakai', type: 'teks' },
            { key: 'sisa', label: 'Sisa', type: 'teks' },
            { key: 'cukup_untuk_hari', label: 'Cukup untuk (hari)', type: 'teks' },
          ],
        },
        { key: 'material_habis', label: 'Material habis', type: 'teks_panjang' },
        { key: 'material_akan_habis', label: 'Material akan habis (<3 hari)', type: 'teks_panjang' },
        { key: 'belanja_barang', label: 'Kebutuhan belanja -- barang', type: 'teks' },
        { key: 'belanja_jumlah', label: 'Jumlah', type: 'teks' },
        { key: 'belanja_rab', label: 'RAB', type: 'uang' },
        { key: 'belanja_dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
        { key: 'belanja_diajukan_accounting', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
      ],
    },
    {
      id: 'pembangunan_area',
      judul: '4 · Pembangunan Area DTI',
      fields: [
        { key: 'pekerjaan_berjalan_dti', label: 'Pekerjaan yang sedang berjalan', type: 'teks' },
        { key: 'progress_dti_persen', label: 'Progress (%)', type: 'angka' },
        { key: 'target_selesai_dti', label: 'Target selesai', type: 'teks' },
        { key: 'kendala_dti', label: 'Kendala', type: 'teks' },
      ],
    },
    {
      id: 'mesin',
      judul: '5 · Mesin & Peralatan',
      fields: [
        { key: 'mesin_normal', label: 'Mesin berfungsi normal', type: 'ya_tidak' },
        { key: 'cetakan_cukup', label: 'Cetakan/molding cukup', type: 'ya_tidak' },
        { key: 'alat_berat_normal', label: 'Alat berat normal', type: 'ya_tidak' },
        { key: 'kerusakan_mesin', label: 'Kerusakan', type: 'teks_panjang' },
        { key: 'perlu_servis_mesin', label: 'Perlu servis/perbaikan', type: 'teks' },
        { key: 'estimasi_biaya_servis', label: 'Estimasi biaya', type: 'uang' },
        { key: 'dampak_ke_produksi', label: 'Dampak ke produksi', type: 'teks' },
      ],
    },
    {
      id: 'tenaga_kerja',
      judul: '6 · Tenaga Kerja DTI',
      fields: [
        { key: 'pekerja_total', label: 'Total pekerja', type: 'angka' },
        { key: 'pekerja_hadir', label: 'Hadir', type: 'angka' },
        { key: 'pekerja_tidak_hadir', label: 'Tidak hadir', type: 'angka' },
        { key: 'kecelakaan_kerja_dti', label: 'Kecelakaan kerja', type: 'ya_tidak' },
        { key: 'apd_lengkap', label: 'APD dipakai lengkap', type: 'ya_tidak' },
        { key: 'keterangan_tenaga_kerja', label: 'Keterangan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kebersihan_dti',
      judul: '7 · Kebersihan & Keamanan Area',
      fields: [
        { key: 'kebersihan_area_produksi', label: 'Kebersihan area produksi', type: 'ya_tidak' },
        { key: 'area_penyimpanan_rapi', label: 'Area penyimpanan rapi', type: 'ya_tidak' },
        { key: 'keamanan_area_dti', label: 'Keamanan area', type: 'ya_tidak' },
        { key: 'material_aman_pencurian', label: 'Material aman dari pencurian', type: 'ya_tidak' },
        {
          key: 'video_kondisi_dti',
          label: 'Video kondisi DTI hari ini',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'kondisi_dti',
        },
        { key: 'masalah_kebersihan_dti', label: 'Masalah', type: 'teks_panjang' },
      ],
    },
    {
      id: 'besok',
      judul: '9 · Target DTI Besok',
      fields: [
        { key: 'besok_produksi_precast', label: 'Produksi precast (pcs)', type: 'angka' },
        { key: 'besok_produksi_perikas', label: 'Produksi perikas', type: 'angka' },
        { key: 'besok_pengiriman_lokasi', label: 'Pengiriman ke lokasi', type: 'teks' },
        { key: 'besok_material_datang', label: 'Material yang harus datang', type: 'teks' },
        { key: 'besok_perbaikan_mesin', label: 'Perbaikan mesin', type: 'teks' },
      ],
    },
    blokKeputusanCeo(10, 'Rekap DTI untuk Sabrina', 'Status DTI hari ini'),
  ],
};
