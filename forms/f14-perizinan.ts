import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * PERIZINAN" (baris 322-462). scope 'global' -- satu PIC Perizinan,
 * satu laporan per hari untuk SELURUH lokasi yang sedang diproses
 * (dokumen bilang "salin blok di atas untuk setiap lokasi" -- itu artinya
 * baris tabel berulang di SATU laporan, bukan laporan terpisah per lokasi
 * seperti pic_lokasi/security).
 *
 * "Tahapan" (persiapan/pengajuan/verifikasi/peninjauan/pembayaran/terbit)
 * dimodelkan sebagai kolom `pilih` berurutan -- sebuah izin ada di SATU
 * tahap pada satu waktu, bukan beberapa sekaligus, jadi bukan checkbox
 * melainkan satu dropdown berurutan.
 */
export const f14Perizinan: FormSchema = {
  key: 'perizinan',
  nama: 'Laporan Harian Perizinan',
  navLabel: 'Lapor Perizinan',
  scope: 'global',
  blocks: [
    {
      id: 'perizinan_berjalan',
      judul: 'Daftar Perizinan Berjalan',
      catatan: 'Satu baris per lokasi yang sedang diproses.',
      fields: [
        {
          key: 'perizinan_berjalan',
          label: 'Perizinan berjalan',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'jenis_izin', label: 'Jenis izin', type: 'teks' },
            { key: 'instansi', label: 'Instansi', type: 'teks' },
            { key: 'nomor_berkas', label: 'Nomor berkas', type: 'teks' },
            { key: 'tahap', label: 'Tahapan saat ini', type: 'pilih', pilihan: ['Persiapan dokumen', 'Pengajuan', 'Verifikasi instansi', 'Peninjauan lapangan', 'Pembayaran retribusi', 'Terbit'] },
            { key: 'progress_persen', label: 'Progress (%)', type: 'teks' },
            { key: 'mulai_diproses', label: 'Mulai diproses', type: 'teks' },
            { key: 'target_terbit', label: 'Target terbit', type: 'teks' },
            { key: 'deadline', label: 'Deadline', type: 'teks' },
            { key: 'dikerjakan_hari_ini', label: 'Yang dikerjakan hari ini', type: 'teks' },
            { key: 'kendala', label: 'Kendala', type: 'teks' },
            { key: 'biaya_keluar', label: 'Biaya sudah dikeluarkan (Rp)', type: 'teks' },
            { key: 'biaya_sisa', label: 'Perkiraan biaya sisa (Rp)', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'selesai',
      judul: 'Yang Selesai Hari Ini',
      fields: [
        {
          key: 'izin_selesai_hari_ini',
          label: 'Izin selesai hari ini',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'jenis_izin', label: 'Jenis izin', type: 'teks' },
            { key: 'nomor_izin_terbit', label: 'Nomor izin terbit', type: 'teks' },
            { key: 'masa_berlaku', label: 'Masa berlaku', type: 'teks' },
          ],
        },
        { key: 'dokumen_scan_arsip', label: 'Dokumen sudah discan/diarsipkan', type: 'ya_tidak' },
        { key: 'diserahkan_ke', label: 'Sudah diserahkan ke', type: 'teks' },
      ],
    },
    {
      id: 'belum_selesai',
      judul: 'Yang Belum Selesai',
      fields: [
        {
          key: 'izin_belum_selesai',
          label: 'Izin belum selesai',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'jenis_izin', label: 'Jenis izin', type: 'teks' },
            { key: 'tahap_saat_ini', label: 'Tahap saat ini', type: 'pilih', pilihan: ['Persiapan dokumen', 'Pengajuan', 'Verifikasi instansi', 'Peninjauan lapangan', 'Pembayaran retribusi', 'Terbit'] },
            { key: 'hambatan', label: 'Hambatan', type: 'teks' },
            { key: 'target', label: 'Target', type: 'teks' },
          ],
        },
        { key: 'izin_lewat_target', label: 'Izin yang melewati target', type: 'teks_panjang' },
        { key: 'alasan_keterlambatan', label: 'Alasan keterlambatan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'koordinasi',
      judul: 'Koordinasi Instansi',
      fields: [
        { key: 'kunjungan_instansi', label: 'Kunjungan instansi hari ini', type: 'angka' },
        { key: 'instansi_ditemui', label: 'Instansi yang ditemui', type: 'teks' },
        { key: 'pejabat_petugas', label: 'Pejabat/petugas', type: 'teks' },
        { key: 'hasil_pertemuan', label: 'Hasil pertemuan', type: 'teks_panjang' },
        { key: 'dokumen_diminta_instansi', label: 'Dokumen yang diminta instansi', type: 'teks_panjang' },
        { key: 'jadwal_tinjau_berikutnya', label: 'Jadwal tinjau lapangan berikutnya', type: 'teks' },
      ],
    },
    {
      id: 'kebutuhan_biaya',
      judul: 'Kebutuhan Biaya Perizinan',
      fields: [
        {
          key: 'kebutuhan_biaya',
          label: 'Kebutuhan biaya',
          type: 'tabel',
          kolom: [
            { key: 'untuk', label: 'Untuk', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
            { key: 'dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
            { key: 'urgensi', label: 'Urgensi', type: 'teks' },
          ],
        },
        { key: 'total_kebutuhan_biaya', label: 'Total kebutuhan', type: 'uang' },
        { key: 'diajukan_ke_accounting', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
        { key: 'status_pengajuan_biaya', label: 'Status', type: 'pilih', pilihan: ['Menunggu', 'Disetujui', 'Dibayar'] },
      ],
    },
    {
      id: 'risiko',
      judul: 'Risiko Perizinan',
      fields: [
        { key: 'izin_hambat_pembangunan', label: 'Izin yang bisa menghambat pembangunan', type: 'teks' },
        { key: 'lokasi_belum_boleh_dibangun', label: 'Lokasi yang belum boleh dibangun', type: 'teks' },
        { key: 'izin_kedaluwarsa_90_hari', label: 'Izin akan kedaluwarsa 90 hari ke depan', type: 'teks' },
        { key: 'dampak_jika_tidak_selesai', label: 'Dampak jika tidak selesai', type: 'teks_panjang' },
      ],
    },
    {
      id: 'besok',
      judul: 'Target Perizinan Besok',
      fields: [
        { key: 'besok_lokasi_dikejar', label: 'Lokasi yang dikejar', type: 'teks' },
        { key: 'besok_dokumen_disiapkan', label: 'Dokumen yang disiapkan', type: 'teks' },
        { key: 'besok_instansi_didatangi', label: 'Instansi yang didatangi', type: 'teks' },
        { key: 'besok_izin_terbit', label: 'Yang harus terbit', type: 'teks' },
      ],
    },
    blokKeputusanCeo('Rekap Perizinan untuk Sabrina', 'Status perizinan hari ini'),
  ],
};
