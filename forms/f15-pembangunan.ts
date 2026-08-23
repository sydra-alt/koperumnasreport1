import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * PEMBANGUNAN" (baris 464-605). scope 'global' -- SATU laporan rekap
 * SELURUH lokasi oleh Kepala Pembangunan, BUKAN pengganti/duplikat
 * f13-pic-lokasi. Dokumen sendiri menandaskan: "Laporan ini adalah rekap
 * seluruh lokasi. Detail per lokasi ada di Laporan PIC Lokasi."
 *
 * PENTING -- bukan kontrak dengan v_pembangunan_hari_ini: kunci
 * unit_dibangun/unit_finishing/unit_selesai/unit_belum_mulai di
 * 03-CALC-SPEC.md §4.2 dijumlahkan dari `report where form_key='pic_lokasi'`
 * SAJA, bukan dari form_key='pembangunan' ini. Karena itu field di form ini
 * dinamai dengan sufiks `_total` (unit_sedang_dibangun_total, dst.) supaya
 * TIDAK bisa disalahsangka sebagai kunci yang sama dengan f13 -- keduanya
 * memang angka yang mirip secara konsep (rekap vs per-lokasi) tapi hidup
 * di form_key & namespace JSON yang sama sekali terpisah. Tidak ada view
 * yang membaca form_key='pembangunan' saat ini; kalau nanti dibutuhkan
 * (mis. dashboard CEO Task 20), itu view baru, bukan perluasan §4.2.
 *
 * "📹 Foto/video progress sudah dikirim ke IT: ✅/❌" TIDAK dipasangi
 * buktiWajib -- beda dari f13, kalimatnya berupa status ("sudah dikirim"),
 * bukan instruksi lampirkan bukti di form INI. Task 15 tidak memintanya.
 */
export const f15Pembangunan: FormSchema = {
  key: 'pembangunan',
  nama: 'Laporan Harian Pembangunan',
  navLabel: 'Lapor Pembangunan',
  scope: 'global',
  blocks: [
    {
      id: 'rekap_unit',
      judul: '1 · Rekap Unit Seluruh Lokasi',
      fields: [
        { key: 'target_pembangunan_total', label: 'Target pembangunan (unit)', type: 'angka' },
        { key: 'unit_sedang_dibangun_total', label: 'Sedang dibangun (unit)', type: 'angka' },
        { key: 'unit_finishing_total', label: 'Finishing (unit)', type: 'angka' },
        { key: 'unit_selesai_hari_ini_total', label: 'Selesai hari ini (unit)', type: 'angka' },
        { key: 'unit_selesai_bulan_ini_total', label: 'Selesai bulan ini (unit)', type: 'angka' },
        { key: 'unit_belum_mulai_total', label: 'Belum mulai (unit)', type: 'angka' },
        { key: 'pencapaian_persen', label: 'Pencapaian terhadap target (%)', type: 'angka' },
        {
          key: 'rincian_per_lokasi',
          label: 'Rincian per lokasi',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'target', label: 'Target', type: 'teks' },
            { key: 'dibangun', label: 'Dibangun', type: 'teks' },
            { key: 'finishing', label: 'Finishing', type: 'teks' },
            { key: 'selesai_hari_ini', label: 'Selesai hari ini', type: 'teks' },
            { key: 'belum_mulai', label: 'Belum mulai', type: 'teks' },
            { key: 'status', label: 'Status', type: 'teks' },
          ],
        },
        { key: 'lokasi_tertinggal_target', label: 'Lokasi tertinggal target', type: 'teks_panjang' },
        { key: 'penyebab_tertinggal', label: 'Penyebab', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kontraktor',
      judul: '2 · Kontraktor',
      fields: [
        {
          key: 'kontraktor_progress',
          label: 'Progress kontraktor',
          type: 'tabel',
          kolom: [
            { key: 'kontraktor', label: 'Kontraktor', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'unit_dikerjakan', label: 'Unit dikerjakan', type: 'teks' },
            { key: 'progress_persen', label: 'Progress (%)', type: 'teks' },
            { key: 'tenaga_kerja', label: 'Tenaga kerja (orang)', type: 'teks' },
            { key: 'status', label: 'Status', type: 'teks' },
          ],
        },
        { key: 'kontraktor_bermasalah_nama', label: 'Kontraktor bermasalah -- nama', type: 'teks' },
        { key: 'kontraktor_bermasalah_lokasi', label: 'Lokasi', type: 'teks' },
        { key: 'kontraktor_bermasalah_masalah', label: 'Masalah', type: 'teks_panjang' },
        { key: 'kontraktor_bermasalah_lama', label: 'Sudah berapa lama', type: 'teks' },
        { key: 'kontraktor_bermasalah_tindakan', label: 'Tindakan yang sudah dilakukan', type: 'teks_panjang' },
        { key: 'kontraktor_rekomendasi', label: 'Rekomendasi', type: 'pilih', pilihan: ['Lanjut', 'Peringatan', 'Ganti'] },
      ],
    },
    {
      id: 'material',
      judul: '3 · Material',
      fields: [
        { key: 'material_cukup_semua_lokasi', label: 'Material cukup di seluruh lokasi', type: 'ya_tidak' },
        {
          key: 'material_kurang',
          label: 'Material habis/kurang',
          type: 'tabel',
          kolom: [
            { key: 'material', label: 'Material', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'kebutuhan', label: 'Kebutuhan', type: 'teks' },
            { key: 'dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
          ],
        },
        { key: 'total_kebutuhan_material', label: 'Total kebutuhan material', type: 'uang' },
        { key: 'material_dari_dti', label: 'Material dari DTI/precast', type: 'teks' },
        { key: 'material_dari_supplier_luar', label: 'Material dari supplier luar', type: 'teks' },
        { key: 'material_diajukan_accounting', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
        { key: 'pekerjaan_berhenti_material', label: 'Pekerjaan berhenti karena material', type: 'teks_panjang' },
      ],
    },
    {
      id: 'infrastruktur',
      judul: '4 · Infrastruktur',
      fields: [
        {
          key: 'infrastruktur_per_lokasi',
          label: 'Infrastruktur per lokasi',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'jalan', label: 'Jalan (ya/tidak)', type: 'teks' },
            { key: 'listrik', label: 'Listrik (ya/tidak)', type: 'teks' },
            { key: 'air', label: 'Air (ya/tidak)', type: 'teks' },
            { key: 'drainase', label: 'Drainase (ya/tidak)', type: 'teks' },
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
          ],
        },
        { key: 'infrastruktur_harus_dikerjakan', label: 'Infrastruktur yang harus dikerjakan', type: 'teks_panjang' },
        { key: 'infrastruktur_estimasi_biaya', label: 'Estimasi biaya', type: 'uang' },
      ],
    },
    {
      id: 'kualitas',
      judul: '5 · Kualitas & Pengawasan',
      fields: [
        { key: 'lokasi_dikunjungi', label: 'Lokasi dikunjungi hari ini', type: 'teks' },
        { key: 'sesuai_spesifikasi', label: 'Pekerjaan sesuai spesifikasi', type: 'ya_tidak' },
        { key: 'temuan_cacat', label: 'Temuan kualitas/cacat', type: 'teks' },
        { key: 'pekerjaan_diulang', label: 'Pekerjaan yang harus diulang', type: 'teks' },
        { key: 'kecelakaan_kerja', label: 'Kecelakaan kerja', type: 'ya_tidak' },
        { key: 'detail_kecelakaan', label: 'Detail kecelakaan (kalau ada)', type: 'teks_panjang' },
        { key: 'progress_dikirim_it', label: 'Foto/video progress pembangunan sudah dikirim ke IT', type: 'ya_tidak' },
        { key: 'foto_progress_jumlah', label: 'Jumlah foto', type: 'angka' },
        { key: 'video_progress_jumlah', label: 'Jumlah video', type: 'angka' },
      ],
    },
    {
      id: 'besok',
      judul: '7 · Target Pembangunan Besok',
      fields: [
        { key: 'besok_unit_dikejar', label: 'Unit yang dikejar selesai', type: 'angka' },
        { key: 'besok_lokasi_prioritas', label: 'Lokasi prioritas', type: 'teks' },
        { key: 'besok_material_datang', label: 'Material yang harus datang', type: 'teks' },
        { key: 'besok_kontraktor_dikawal', label: 'Kontraktor yang harus dikawal', type: 'teks' },
        { key: 'besok_infrastruktur', label: 'Infrastruktur', type: 'teks' },
      ],
    },
    blokKeputusanCeo(8, 'Rekap Pembangunan untuk Sabrina', 'Status pembangunan hari ini'),
  ],
};
