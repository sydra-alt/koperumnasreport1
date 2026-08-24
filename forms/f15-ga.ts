import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * OPERASIONAL KANTOR (GA)" (baris 1226-1323). scope 'global' -- satu PIC
 * GA/Umum.
 *
 * Blok rekap dokumen ini punya DUA baris teks bebas sebelum pemicu
 * keputusan CEO: "🔴 KENDALA HARI INI" (masuk `masalah_utama` bersama) dan
 * "📦 KEBUTUHAN" (field tambahan `kebutuhan_ga`, lewat parameter
 * `fieldTambahan` di `blokKeputusanCeo()` -- satu-satunya form di batch ini
 * yang butuh field ekstra di blok bersama tersebut).
 */
export const f15Ga: FormSchema = {
  key: 'ga',
  nama: 'Laporan Harian Operasional Kantor (GA)',
  navLabel: 'Lapor GA',
  scope: 'global',
  blocks: [
    {
      id: 'kebersihan',
      judul: 'Kebersihan Kantor',
      fields: [
        { key: 'kebersihan_ruang_kerja', label: 'Ruang kerja', type: 'ya_tidak' },
        { key: 'kebersihan_ruang_tamu', label: 'Ruang tamu/lobi', type: 'ya_tidak' },
        { key: 'kebersihan_ruang_meeting', label: 'Ruang meeting', type: 'ya_tidak' },
        { key: 'kebersihan_pantry', label: 'Pantry/dapur', type: 'ya_tidak' },
        { key: 'kebersihan_toilet', label: 'Toilet', type: 'ya_tidak' },
        { key: 'kebersihan_musala', label: 'Musala', type: 'ya_tidak' },
        { key: 'kebersihan_halaman', label: 'Halaman/parkir', type: 'ya_tidak' },
        { key: 'sampah_terangkut_ga', label: 'Tempat sampah terangkut', type: 'ya_tidak' },
        {
          key: 'foto_kondisi_kantor',
          label: 'Foto kondisi kantor hari ini',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'kondisi_kantor',
        },
        { key: 'masalah_kebersihan_ga', label: 'Masalah kebersihan', type: 'teks_panjang' },
        { key: 'pic_perbaikan_kebersihan', label: 'PIC yang harus memperbaiki', type: 'teks' },
      ],
    },
    {
      id: 'fasilitas',
      judul: 'Fasilitas & Utilitas',
      fields: [
        { key: 'listrik_normal_ga', label: 'Listrik normal', type: 'ya_tidak' },
        { key: 'air_normal_ga', label: 'Air normal', type: 'ya_tidak' },
        { key: 'ac_berfungsi', label: 'AC berfungsi', type: 'ya_tidak' },
        { key: 'internet_normal', label: 'Internet/WiFi normal', type: 'ya_tidak' },
        { key: 'genset_siap', label: 'Genset siap', type: 'ya_tidak' },
        {
          key: 'kerusakan_fasilitas',
          label: 'Kerusakan fasilitas',
          type: 'tabel',
          kolom: [
            { key: 'fasilitas', label: 'Fasilitas', type: 'teks' },
            { key: 'kerusakan', label: 'Kerusakan', type: 'teks' },
            { key: 'sejak', label: 'Sejak', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
            { key: 'urgensi', label: 'Urgensi', type: 'teks' },
          ],
        },
        { key: 'fasilitas_sudah_ditangani', label: 'Sudah ditangani', type: 'ya_tidak' },
        { key: 'fasilitas_target_selesai', label: 'Target selesai', type: 'teks' },
      ],
    },
    {
      id: 'perlengkapan',
      judul: 'Perlengkapan & ATK',
      fields: [
        { key: 'stok_atk_cukup', label: 'Stok ATK cukup', type: 'ya_tidak' },
        { key: 'air_minum_cukup', label: 'Air minum cukup', type: 'ya_tidak' },
        { key: 'perlengkapan_kebersihan_cukup', label: 'Perlengkapan kebersihan cukup', type: 'ya_tidak' },
        {
          key: 'kebutuhan_belanja',
          label: 'Kebutuhan belanja',
          type: 'tabel',
          kolom: [
            { key: 'barang', label: 'Barang', type: 'teks' },
            { key: 'jumlah', label: 'Jumlah', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
            { key: 'dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
          ],
        },
        { key: 'total_kebutuhan_belanja', label: 'Total', type: 'uang' },
        { key: 'belanja_diajukan_accounting_ga', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
      ],
    },
    {
      id: 'kegiatan',
      judul: 'Kegiatan Kantor Hari Ini',
      fields: [
        { key: 'meeting_jumlah', label: 'Meeting', type: 'angka' },
        { key: 'tamu_perusahaan', label: 'Tamu perusahaan', type: 'angka' },
        { key: 'kegiatan_khusus', label: 'Kegiatan khusus', type: 'teks' },
        { key: 'persiapan_besok', label: 'Persiapan untuk besok', type: 'teks_panjang' },
      ],
    },
    blokKeputusanCeo('Rekap Operasional Kantor untuk Sabrina', 'Status operasional kantor', [
      { key: 'kebutuhan_ga', label: 'Kebutuhan', type: 'teks_panjang' },
    ]),
  ],
};
