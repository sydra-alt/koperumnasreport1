import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * PEMBANGUNAN" (baris 464-605). scope 'global' -- SATU laporan rekap
 * SELURUH lokasi oleh Kepala Pembangunan, BUKAN pengganti/duplikat
 * f13-pic-lokasi.
 *
 * PRINSIP §3.5b -- satu angka, satu pengisi; duplikasi vs silang-cek.
 *
 * Blok read-only (TIDAK ADA di `blocks` di bawah -- dirender LaporForm.tsx
 * langsung dari `useRekapPicLokasi()`, lib/api/pembangunan.ts, sama alasannya
 * dengan Blok 1/5/8 di f01-personal-marketing.ts: kalau tetap dimasukkan ke
 * `blocks` sebagai entri ber-`fields: []`, FormRenderer tetap merendernya
 * jadi fieldset kosong -- judul & catatan akan tampil DUA KALI):
 *   1. Rekap Unit       — dari report.data pic_lokasi (PIC Lokasi sumbernya)
 *   3. Material Lokasi  — rollup dari pic_lokasi blok 8 (PIC yang lihat tumpukan habis)
 *   5. Kondisi Infra    — rollup dari pic_lokasi blok 4 (PIC yang lihat kondisi)
 *
 * Blok input (cuma Kepala Pembangunan yang tahu):
 *   2. Catatan Selisih  — kalau angka PIC tidak cocok kenyataan
 *   4. Material Perusahaan — pembelian borongan, masalah supplier (bukan per lokasi)
 *   6. Rencana Infrastruktur — pekerjaan dijadwalkan, kontraktor, anggaran
 *   7. Kontraktor       — progress, masalah, rekomendasi
 *   8. Kualitas & Pengawasan
 *   9. Target Besok
 *  10. Rekap untuk Sabrina / Keputusan CEO
 *
 * D2: foto/video/kirim IT DIHAPUS — tabel attachment sudah tahu siapa yang
 * unggah, tidak perlu bertanya hal yang sudah diketahui sistem.
 */
export const f15Pembangunan: FormSchema = {
  key: 'pembangunan',
  nama: 'Laporan Harian Pembangunan',
  navLabel: 'Lapor Pembangunan',
  scope: 'global',
  blocks: [
    // ── 1. Rekap Unit (read-only dari PIC Lokasi) -- BUKAN entri di sini,
    // dirender LaporForm.tsx sebagai <RekapUnitOtomatis>, sama alasannya
    // dengan Blok 1/5/8 di f01-personal-marketing.ts: FormRenderer merender
    // SETIAP block di array ini apa adanya, termasuk yang fields-nya kosong
    // -- kalau tetap dimasukkan di sini, judul & catatannya akan tampil DUA
    // KALI (sekali dari komponen baca-saja, sekali lagi dari fieldset kosong
    // FormRenderer). ──────────────────────────────────────────────────────
    // ── 2. Catatan Selisih (input) ─────────────────────────────────────
    {
      id: 'catatan_selisih',
      judul: 'Catatan Selisih',
      catatan: 'Isi kalau angka dari PIC Lokasi tidak sesuai kenyataan lapangan. Kosongkan kalau tidak ada selisih.',
      fields: [
        {
          key: 'selisih_unit',
          label: 'Selisih unit',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'field', label: 'Besaran', type: 'teks' },
            { key: 'angka_pic', label: 'Angka menurut PIC', type: 'teks' },
            { key: 'angka_saya', label: 'Angka menurut saya', type: 'teks' },
            { key: 'penyebab', label: 'Penyebab', type: 'teks' },
          ],
        },
      ],
    },
    // ── 3. Material per Lokasi (read-only dari PIC Lokasi) -- dirender
    // <RekapMaterialOtomatis>, bukan entri di sini (alasan sama seperti 1). ──
    // ── 4. Material Perusahaan (input — cuma Kepala Pembangunan) ───────
    {
      id: 'material_perusahaan',
      judul: 'Material Tingkat Perusahaan',
      catatan: 'Kebutuhan material yang tidak terikat lokasi tertentu: pembelian borongan, masalah supplier, pasokan dari DTI.',
      fields: [
        { key: 'material_dari_dti', label: 'Material dari DTI/precast', type: 'teks' },
        { key: 'material_dari_supplier_luar', label: 'Material dari supplier luar', type: 'teks' },
        {
          key: 'material_borongan',
          label: 'Kebutuhan material borongan (tidak terikat lokasi)',
          type: 'tabel',
          kolom: [
            { key: 'material', label: 'Material', type: 'teks' },
            { key: 'kebutuhan', label: 'Kebutuhan', type: 'teks' },
            { key: 'estimasi_biaya', label: 'Estimasi biaya (Rp)', type: 'teks' },
            { key: 'dibutuhkan_tanggal', label: 'Dibutuhkan tanggal', type: 'teks' },
          ],
        },
        { key: 'total_kebutuhan_material_perusahaan', label: 'Total kebutuhan material perusahaan', type: 'uang' },
        { key: 'material_diajukan_accounting', label: 'Sudah diajukan ke Accounting', type: 'ya_tidak' },
        { key: 'masalah_supplier', label: 'Masalah supplier', type: 'teks_panjang' },
        { key: 'pekerjaan_berhenti_material', label: 'Pekerjaan berhenti karena material', type: 'teks_panjang' },
      ],
    },
    // ── 5. Kondisi Infrastruktur (read-only dari PIC Lokasi) -- dirender
    // <RekapInfrastrukturOtomatis>, bukan entri di sini (alasan sama). ─────
    // ── 6. Rencana Infrastruktur (input — cuma Kepala Pembangunan) ─────
    {
      id: 'infrastruktur_rencana',
      judul: 'Rencana & Biaya Infrastruktur',
      catatan: 'Pekerjaan infrastruktur yang dijadwalkan, kontraktor, anggaran, target selesai. Ini yang hanya Kepala Pembangunan yang tahu.',
      fields: [
        {
          key: 'infrastruktur_rencana_kerja',
          label: 'Rencana pekerjaan infrastruktur',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'pekerjaan', label: 'Pekerjaan', type: 'teks' },
            { key: 'kontraktor', label: 'Kontraktor', type: 'teks' },
            { key: 'anggaran', label: 'Anggaran (Rp)', type: 'teks' },
            { key: 'target_selesai', label: 'Target selesai', type: 'teks' },
            { key: 'status', label: 'Status', type: 'teks' },
          ],
        },
        { key: 'infrastruktur_harus_dikerjakan', label: 'Infrastruktur yang harus dikerjakan', type: 'teks_panjang' },
        { key: 'infrastruktur_estimasi_biaya', label: 'Total estimasi biaya', type: 'uang' },
      ],
    },
    // ── 7. Kontraktor (input) ──────────────────────────────────────────
    {
      id: 'kontraktor',
      judul: 'Kontraktor',
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
    // ── 8. Kualitas & Pengawasan (input — D2: foto/video hapus) ────────
    {
      id: 'kualitas',
      judul: 'Kualitas & Pengawasan',
      fields: [
        { key: 'lokasi_dikunjungi', label: 'Lokasi dikunjungi hari ini', type: 'teks' },
        { key: 'sesuai_spesifikasi', label: 'Pekerjaan sesuai spesifikasi', type: 'ya_tidak' },
        { key: 'temuan_cacat', label: 'Temuan kualitas/cacat', type: 'teks' },
        { key: 'pekerjaan_diulang', label: 'Pekerjaan yang harus diulang', type: 'teks' },
        { key: 'kecelakaan_kerja', label: 'Kecelakaan kerja', type: 'ya_tidak' },
        { key: 'detail_kecelakaan', label: 'Detail kecelakaan (kalau ada)', type: 'teks_panjang' },
      ],
    },
    // ── 9. Target Besok (input) ────────────────────────────────────────
    {
      id: 'besok',
      judul: 'Target Pembangunan Besok',
      fields: [
        { key: 'besok_unit_dikejar', label: 'Unit yang dikejar selesai', type: 'angka' },
        { key: 'besok_lokasi_prioritas', label: 'Lokasi prioritas', type: 'teks' },
        { key: 'besok_material_datang', label: 'Material yang harus datang', type: 'teks' },
        { key: 'besok_kontraktor_dikawal', label: 'Kontraktor yang harus dikawal', type: 'teks' },
        { key: 'besok_infrastruktur', label: 'Infrastruktur', type: 'teks' },
      ],
    },
    blokKeputusanCeo('Rekap Pembangunan untuk Sabrina', 'Status pembangunan hari ini'),
  ],
};
