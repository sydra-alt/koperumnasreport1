import type { FormSchema } from './types';

/**
 * Sesuai docs/FORMAT-ASLI-02-PUSAT.md §16/§17/Kesimpulan -- Task 21.
 * Bagian 1-15 dari format asli TIDAK ADA di sini sama sekali (bukan lupa) --
 * itu semua "hanya baca", dirender langsung di app/terpusat/page.tsx dari
 * view/query rollup (lib/api/terpusat.ts), BUKAN diketik Sabrina. Field di
 * schema ini HANYA yang benar-benar input baru miliknya sendiri: §16 Target
 * Besok (7 baris) dan Kesimpulan (3 baris) -- persis kalimat user "yang bisa
 * diketik Sabrina cuma bagian 16, 17, dan Kesimpulan".
 *
 * §17 "KEPUTUSAN YANG DIBUTUHKAN DARI CEO": mayoritas keputusan lahir dari
 * form DIVISI LAIN (blokKeputusanCeo/sumberKeputusan mereka masing-masing,
 * masuk `decision` lewat report_id form itu) -- ditampilkan READ-ONLY di
 * app/terpusat/page.tsx lewat `useAntreanKeputusan()` (Task 19) yang SUDAH
 * ada, tidak dibaca ulang di sini. TAPI Sabrina sendiri kadang menemukan hal
 * yang belum diangkat divisi mana pun -- `keputusan_ceo_tambahan` memberinya
 * jalan yang SAMA (generik, `sumberKeputusan`, Task 17/accounting) untuk
 * menambah sampai 3 keputusannya sendiri, bukan mekanisme baru.
 */
export const f21Pusat: FormSchema = {
  key: 'pusat',
  nama: 'Laporan Terpusat -- Target Besok, Keputusan Tambahan & Kesimpulan',
  navLabel: 'Lapor Terpusat',
  scope: 'global',
  blocks: [
    {
      id: 'target_besok',
      judul: 'Target Besok',
      fields: [
        { key: 'besok_pembangunan', label: 'Pembangunan', type: 'teks' },
        { key: 'besok_stk', label: 'STK', type: 'teks' },
        { key: 'besok_perizinan', label: 'Perizinan', type: 'teks' },
        { key: 'besok_penagihan', label: 'Penagihan/konsumen', type: 'teks' },
        { key: 'besok_marketing', label: 'Marketing', type: 'teks' },
        { key: 'besok_dti', label: 'DTI', type: 'teks' },
        { key: 'besok_pic_lokasi', label: 'PIC lokasi', type: 'teks' },
      ],
    },
    {
      id: 'keputusan_tambahan',
      judul: 'Keputusan Tambahan dari Pusat (kalau ada, di luar yang sudah diajukan divisi lain)',
      catatan: 'Keputusan yang sudah diajukan divisi lain lewat laporan mereka sendiri tampil otomatis di atas -- tidak diketik ulang di sini.',
      fields: [
        {
          key: 'keputusan_ceo_tambahan',
          label: 'Daftar keputusan tambahan',
          type: 'tabel',
          sumberKeputusan: true,
          kolom: [
            { key: 'judul', label: 'Untuk', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp, kalau ada)', type: 'teks' },
            { key: 'deadline', label: 'Deadline (YYYY-MM-DD)', type: 'teks' },
            { key: 'dampak', label: 'Dampak jika tidak diputuskan', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'kesimpulan',
      judul: 'Kesimpulan Sabrina Hari Ini',
      fields: [
        { key: 'kesimpulan_selesai_aman', label: '🟢 Selesai/aman', type: 'teks_panjang' },
        { key: 'kesimpulan_dikawal_besok', label: '🟡 Harus dikawal besok', type: 'teks_panjang' },
        { key: 'kesimpulan_diputuskan_ceo', label: '🔴 Harus diputuskan CEO', type: 'teks_panjang' },
      ],
    },
  ],
};
