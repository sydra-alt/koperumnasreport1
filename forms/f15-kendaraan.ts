import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * KENDARAAN & DRIVER" (baris 763-922). scope 'global' -- satu Koordinator
 * Driver, satu laporan untuk seluruh armada.
 */
export const f15Kendaraan: FormSchema = {
  key: 'kendaraan',
  nama: 'Laporan Harian Kendaraan & Driver',
  navLabel: 'Lapor Kendaraan',
  scope: 'global',
  blocks: [
    {
      id: 'cek_kondisi',
      judul: 'Cek Kondisi Kendaraan',
      fields: [
        { key: 'mobil_dicek_jumlah', label: 'Mobil dicek', type: 'angka' },
        { key: 'mobil_total', label: 'Dari total mobil', type: 'angka' },
        {
          key: 'cek_mobil',
          label: 'Cek mobil',
          type: 'tabel',
          kolom: [
            { key: 'no_polisi', label: 'No. polisi', type: 'teks' },
            { key: 'driver', label: 'Driver', type: 'teks' },
            { key: 'dicek', label: 'Dicek (ya/tidak)', type: 'teks' },
            { key: 'bbm_persen', label: 'BBM (%)', type: 'teks' },
            { key: 'ban', label: 'Ban (ya/tidak)', type: 'teks' },
            { key: 'oli', label: 'Oli (ya/tidak)', type: 'teks' },
            { key: 'mesin', label: 'Mesin (ya/tidak)', type: 'teks' },
            { key: 'kondisi', label: 'Kondisi', type: 'teks' },
          ],
        },
        { key: 'truk_dicek_jumlah', label: 'Truk dicek', type: 'angka' },
        { key: 'truk_total', label: 'Dari total truk', type: 'angka' },
        {
          key: 'cek_truk',
          label: 'Cek truk',
          type: 'tabel',
          kolom: [
            { key: 'no_polisi', label: 'No. polisi', type: 'teks' },
            { key: 'driver', label: 'Driver', type: 'teks' },
            { key: 'dicek', label: 'Dicek (ya/tidak)', type: 'teks' },
            { key: 'bbm_persen', label: 'BBM (%)', type: 'teks' },
            { key: 'ban', label: 'Ban (ya/tidak)', type: 'teks' },
            { key: 'oli', label: 'Oli (ya/tidak)', type: 'teks' },
            { key: 'mesin', label: 'Mesin (ya/tidak)', type: 'teks' },
            { key: 'kondisi', label: 'Kondisi', type: 'teks' },
          ],
        },
        { key: 'alat_berat_dicek_jumlah', label: 'Kendaraan DTI/alat berat dicek', type: 'angka' },
        { key: 'alat_berat_total', label: 'Dari total kendaraan DTI/alat berat', type: 'angka' },
        {
          key: 'cek_alat_berat',
          label: 'Cek kendaraan DTI/alat berat',
          type: 'tabel',
          kolom: [
            { key: 'unit', label: 'Unit', type: 'teks' },
            { key: 'operator', label: 'Operator', type: 'teks' },
            { key: 'dicek', label: 'Dicek (ya/tidak)', type: 'teks' },
            { key: 'kondisi', label: 'Kondisi', type: 'teks' },
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
          ],
        },
        {
          key: 'foto_kondisi_kendaraan',
          label: 'Foto kondisi kendaraan hari ini',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'kondisi_kendaraan',
        },
      ],
    },
    {
      id: 'bbm',
      judul: 'BBM',
      fields: [
        { key: 'pengisian_bbm_kali', label: 'Pengisian hari ini (kali)', type: 'angka' },
        { key: 'total_liter_bbm', label: 'Total liter', type: 'angka' },
        { key: 'total_biaya_bbm', label: 'Total biaya', type: 'uang' },
        { key: 'struk_lengkap', label: 'Bukti/struk lengkap', type: 'ya_tidak' },
        {
          key: 'rincian_bbm',
          label: 'Rincian BBM',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'liter', label: 'Liter', type: 'teks' },
            { key: 'biaya', label: 'Biaya (Rp)', type: 'teks' },
            { key: 'km_terakhir', label: 'Km terakhir', type: 'teks' },
            { key: 'struk', label: 'Struk (ya/tidak)', type: 'teks' },
          ],
        },
        { key: 'bbm_tidak_wajar', label: 'Pemakaian BBM tidak wajar', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kerusakan_servis',
      judul: 'Kerusakan & Servis',
      fields: [
        {
          key: 'kendaraan_rusak',
          label: 'Kendaraan rusak',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'kerusakan', label: 'Kerusakan', type: 'teks' },
            { key: 'sejak_kapan', label: 'Sejak kapan', type: 'teks' },
            { key: 'bisa_dipakai', label: 'Bisa dipakai (ya/tidak)', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
          ],
        },
        {
          key: 'perlu_servis',
          label: 'Perlu servis',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'jenis_servis', label: 'Jenis servis', type: 'teks' },
            { key: 'km_jadwal', label: 'Km/jadwal', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
            { key: 'urgensi', label: 'Urgensi', type: 'teks' },
          ],
        },
        { key: 'total_estimasi_biaya_servis', label: 'Total estimasi biaya', type: 'uang' },
        { key: 'diajukan_ke_accounting_servis', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
        {
          key: 'status_servis',
          label: 'Status',
          type: 'pilih',
          pilihan: ['Menunggu', 'Disetujui', 'Dikerjakan', 'Selesai'],
        },
        { key: 'dampak_operasional', label: 'Dampak ke operasional jika tidak diperbaiki', type: 'teks_panjang' },
      ],
    },
    {
      id: 'penggunaan',
      judul: 'Penggunaan Kendaraan Hari Ini',
      fields: [
        {
          key: 'penggunaan_kendaraan',
          label: 'Penggunaan kendaraan',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'driver', label: 'Driver', type: 'teks' },
            { key: 'tujuan', label: 'Tujuan', type: 'teks' },
            { key: 'keperluan', label: 'Keperluan', type: 'teks' },
            { key: 'berangkat', label: 'Berangkat', type: 'teks' },
            { key: 'kembali', label: 'Kembali', type: 'teks' },
            { key: 'km', label: 'Km', type: 'teks' },
          ],
        },
        { key: 'total_perjalanan', label: 'Total perjalanan', type: 'angka' },
        { key: 'pengiriman_material', label: 'Pengiriman material', type: 'angka' },
        { key: 'antar_jemput_konsumen', label: 'Antar-jemput konsumen', type: 'angka' },
        { key: 'keperluan_kantor', label: 'Keperluan kantor', type: 'angka' },
        { key: 'perjalanan_tanpa_surat_tugas', label: 'Perjalanan tanpa surat tugas', type: 'teks_panjang' },
      ],
    },
    {
      id: 'driver',
      judul: 'Driver',
      fields: [
        { key: 'driver_total', label: 'Total driver', type: 'angka' },
        { key: 'driver_hadir', label: 'Hadir', type: 'angka' },
        { key: 'driver_tidak_hadir', label: 'Tidak hadir', type: 'angka' },
        { key: 'sim_berlaku_semua', label: 'SIM masih berlaku semua', type: 'ya_tidak' },
        { key: 'pelanggaran_lalu_lintas', label: 'Pelanggaran lalu lintas/tilang', type: 'ya_tidak' },
        { key: 'keterangan_driver', label: 'Keterangan', type: 'teks_panjang' },
        { key: 'sim_stnk_habis_60_hari', label: 'SIM/STNK akan habis 60 hari ke depan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'dokumen',
      judul: 'Dokumen Kendaraan',
      fields: [
        { key: 'stnk_lengkap_semua', label: 'STNK lengkap semua', type: 'ya_tidak' },
        { key: 'pajak_aman', label: 'Pajak kendaraan aman', type: 'ya_tidak' },
        { key: 'asuransi_aktif', label: 'Asuransi aktif', type: 'ya_tidak' },
        {
          key: 'dokumen_jatuh_tempo',
          label: 'Yang akan jatuh tempo',
          type: 'tabel',
          kolom: [
            { key: 'kendaraan', label: 'Kendaraan', type: 'teks' },
            { key: 'dokumen', label: 'Dokumen', type: 'teks' },
            { key: 'jatuh_tempo', label: 'Jatuh tempo', type: 'teks' },
            { key: 'biaya', label: 'Biaya (Rp)', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'besok',
      judul: 'Target Besok',
      fields: [
        { key: 'besok_kendaraan_dipakai', label: 'Kendaraan yang dipakai', type: 'teks' },
        { key: 'besok_pengiriman_jalan', label: 'Pengiriman yang harus jalan', type: 'teks' },
        { key: 'besok_servis_perbaikan', label: 'Servis/perbaikan', type: 'teks' },
        { key: 'besok_dokumen_diurus', label: 'Dokumen yang harus diurus', type: 'teks' },
      ],
    },
    blokKeputusanCeo('Rekap Kendaraan untuk Sabrina', 'Status kendaraan hari ini'),
  ],
};
