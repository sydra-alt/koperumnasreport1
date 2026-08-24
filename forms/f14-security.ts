import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * SECURITY / SATPAM" (baris 165-320). scope 'lokasi' -- TAPI beda dari
 * f13-pic-lokasi: security juga di-scope SHIFT (pagi/siang/malam), jadi
 * satu lokasi bisa punya 3 laporan sehari. `LaporForm.tsx` memilih
 * kombinasi (lokasi, shift) dari `assignment`, bukan cuma lokasi -- lihat
 * `kombinasiDitugaskan` di sana.
 *
 * Header (tanggal/shift/lokasi/petugas) TIDAK jadi field -- shift & lokasi
 * sudah dipilih di pemilih kombinasi sebelum form ini dibuka, petugas dari
 * `useAuth()`, sama polanya dengan f13. Tidak ada blok "Target Besok" --
 * dokumen aslinya memang langsung lompat dari blok 8 (personal marketing)
 * ke blok 9 (rekap), tidak seperti form lain.
 */
export const f14Security: FormSchema = {
  key: 'security',
  nama: 'Laporan Harian Security / Satpam',
  navLabel: 'Lapor Keamanan',
  scope: 'lokasi',
  blocks: [
    {
      id: 'kehadiran',
      judul: 'Kehadiran Petugas',
      fields: [
        { key: 'satpam_terjadwal', label: 'Satpam terjadwal', type: 'angka' },
        { key: 'satpam_hadir', label: 'Satpam hadir', type: 'angka' },
        { key: 'satpam_tidak_hadir', label: 'Tidak hadir', type: 'angka' },
        { key: 'seragam_lengkap', label: 'Seragam lengkap', type: 'ya_tidak' },
        { key: 'serah_terima_shift', label: 'Serah terima shift dilakukan', type: 'ya_tidak' },
        { key: 'nama_tidak_hadir', label: 'Nama tidak hadir & keterangan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'tamu',
      judul: 'Tamu & Kunjungan',
      fields: [
        { key: 'tamu_datang', label: 'Tamu datang (orang)', type: 'angka' },
        { key: 'konsumen_datang', label: 'Konsumen datang (orang)', type: 'angka' },
        { key: 'tamu_tercatat_buku', label: 'Tamu tercatat di buku tamu', type: 'ya_tidak' },
        {
          key: 'tamu_penting',
          label: 'Tamu penting hari ini',
          type: 'tabel',
          kolom: [
            { key: 'nama', label: 'Nama', type: 'teks' },
            { key: 'keperluan', label: 'Keperluan', type: 'teks' },
            { key: 'bertemu', label: 'Bertemu', type: 'teks' },
            { key: 'jam_masuk', label: 'Jam masuk', type: 'teks' },
            { key: 'jam_keluar', label: 'Jam keluar', type: 'teks' },
          ],
        },
        { key: 'keperluan_penting_ceo', label: 'Keperluan penting yang perlu diketahui CEO', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kejadian',
      judul: 'Kejadian Keamanan',
      fields: [
        { key: 'ada_kejadian', label: 'Ada kejadian', type: 'ya_tidak' },
        { key: 'jenis_kejadian', label: 'Jenis kejadian (kalau ada)', type: 'teks' },
        { key: 'jam_kejadian', label: 'Jam kejadian', type: 'teks' },
        { key: 'lokasi_kejadian', label: 'Lokasi kejadian', type: 'teks' },
        { key: 'pihak_terlibat', label: 'Pihak terlibat', type: 'teks' },
        { key: 'kronologi', label: 'Kronologi', type: 'teks_panjang' },
        { key: 'tindakan_kejadian', label: 'Tindakan yang sudah dilakukan', type: 'teks_panjang' },
        { key: 'kerugian_kerusakan', label: 'Kerugian/kerusakan', type: 'teks' },
        { key: 'libatkan_polisi', label: 'Melibatkan pihak luar/polisi', type: 'ya_tidak' },
        { key: 'perlu_tindak_lanjut', label: 'Perlu tindak lanjut', type: 'teks' },
      ],
    },
    {
      id: 'patroli',
      judul: 'Patroli & Kontrol Area',
      fields: [
        { key: 'patroli_jumlah', label: 'Patroli dilakukan (kali)', type: 'angka' },
        { key: 'area_terpantau', label: 'Seluruh area terpantau', type: 'ya_tidak' },
        { key: 'pagar_aman', label: 'Pagar/pintu/gerbang aman', type: 'ya_tidak' },
        { key: 'gudang_aman', label: 'Gudang/material aman', type: 'ya_tidak' },
        { key: 'kendaraan_aman', label: 'Kendaraan perusahaan aman', type: 'ya_tidak' },
        { key: 'penerangan_normal', label: 'Penerangan area normal', type: 'ya_tidak' },
        { key: 'cctv_berfungsi', label: 'CCTV berfungsi', type: 'ya_tidak' },
        { key: 'titik_rawan', label: 'Titik rawan yang ditemukan', type: 'teks_panjang' },
        {
          key: 'video_patroli',
          label: 'Video/foto kondisi area saat patroli',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'patroli',
        },
      ],
    },
    {
      id: 'keamanan_material',
      judul: 'Keamanan Material & Aset Lokasi',
      fields: [
        { key: 'material_aman', label: 'Material di lokasi aman', type: 'ya_tidak' },
        { key: 'alat_lengkap', label: 'Alat/peralatan lengkap', type: 'ya_tidak' },
        { key: 'material_hilang', label: 'Ada material hilang/berkurang', type: 'ya_tidak' },
        { key: 'barang_hilang', label: 'Barang (kalau ada yang hilang)', type: 'teks' },
        { key: 'jumlah_hilang', label: 'Jumlah', type: 'teks' },
        { key: 'perkiraan_nilai_hilang', label: 'Perkiraan nilai', type: 'uang' },
        { key: 'terakhir_terlihat', label: 'Terakhir terlihat', type: 'teks' },
        { key: 'tindakan_material_hilang', label: 'Tindakan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kendaraan_keluar_masuk',
      judul: 'Keluar Masuk Kendaraan',
      fields: [
        { key: 'kendaraan_keluar', label: 'Kendaraan perusahaan keluar', type: 'angka' },
        { key: 'kendaraan_material_masuk', label: 'Kendaraan material masuk', type: 'angka' },
        { key: 'kendaraan_tercatat', label: 'Kendaraan sudah tercatat', type: 'ya_tidak' },
        {
          key: 'kendaraan_angkut_barang',
          label: 'Kendaraan mengangkut barang keluar (wajib ada surat jalan)',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'barang', label: 'Barang', type: 'teks' },
            { key: 'jumlah', label: 'Jumlah', type: 'teks' },
            { key: 'surat_jalan', label: 'Surat jalan (ya/tidak)', type: 'teks' },
            { key: 'yang_menyetujui', label: 'Yang menyetujui', type: 'teks' },
          ],
        },
        { key: 'barang_tanpa_surat_jalan', label: 'Barang keluar tanpa surat jalan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kebersihan_pos',
      judul: 'Kebersihan & Fasilitas Pos',
      fields: [
        { key: 'pos_bersih', label: 'Pos jaga bersih', type: 'ya_tidak' },
        { key: 'buku_tamu_rapi', label: 'Buku tamu terisi rapi', type: 'ya_tidak' },
        { key: 'alat_komunikasi_normal', label: 'Alat komunikasi/HT normal', type: 'ya_tidak' },
        { key: 'perlengkapan_lengkap', label: 'Senter/perlengkapan lengkap', type: 'ya_tidak' },
        { key: 'kebutuhan_pos', label: 'Kebutuhan pos', type: 'teks_panjang' },
      ],
    },
    blokKeputusanCeo('Rekap Security untuk Sabrina', 'Status keamanan hari ini'),
  ],
};
