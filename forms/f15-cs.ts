import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN
 * CUSTOMER SERVICE" (baris 1109-1224). scope 'global' -- satu PIC CS.
 *
 * Blok rekap dokumen ini pakai "🔴 MASALAH URGENT" (bukan "MASALAH UTAMA")
 * dengan PIC/target selesai tambahan -- dilebur ke `masalah_utama` bersama
 * (blok 2 "KELUHAN URGENT" sudah punya PIC & target selesai sendiri secara
 * lebih detail, jadi tidak diduplikasi di sini).
 */
export const f15Cs: FormSchema = {
  key: 'cs',
  nama: 'Laporan Harian Customer Service',
  navLabel: 'Lapor CS',
  scope: 'global',
  blocks: [
    {
      id: 'tiket',
      judul: 'Tiket & Komunikasi Masuk',
      fields: [
        { key: 'tiket_masuk_total', label: 'Konsumen/tiket masuk hari ini', type: 'angka' },
        { key: 'tiket_telepon', label: 'Telepon', type: 'angka' },
        { key: 'tiket_whatsapp', label: 'WhatsApp', type: 'angka' },
        { key: 'tiket_datang_langsung', label: 'Datang langsung', type: 'angka' },
        { key: 'tiket_medsos', label: 'Dari medsos (diteruskan IT)', type: 'angka' },
        { key: 'tiket_video_call', label: 'Video call', type: 'angka' },
      ],
    },
    {
      id: 'keluhan',
      judul: 'Keluhan Konsumen',
      fields: [
        { key: 'keluhan_baru', label: 'Keluhan baru', type: 'angka' },
        { key: 'keluhan_selesai_hari_ini', label: 'Selesai hari ini', type: 'angka' },
        { key: 'keluhan_belum_selesai', label: 'Belum selesai', type: 'angka' },
        { key: 'tunggakan_keluhan_sebelumnya', label: 'Tunggakan keluhan dari hari sebelumnya', type: 'angka' },
        {
          key: 'daftar_keluhan',
          label: 'Daftar keluhan',
          type: 'tabel',
          kolom: [
            { key: 'nama_konsumen', label: 'Nama konsumen', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'jenis_keluhan', label: 'Jenis keluhan', type: 'teks' },
            { key: 'pic', label: 'PIC', type: 'teks' },
            { key: 'target_selesai', label: 'Target selesai', type: 'teks' },
            { key: 'status', label: 'Status', type: 'teks' },
          ],
        },
        { key: 'keluhan_urgent_konsumen', label: 'Keluhan urgent -- konsumen', type: 'teks' },
        { key: 'keluhan_urgent_lokasi', label: 'Lokasi', type: 'teks' },
        { key: 'keluhan_urgent_masalah', label: 'Masalah', type: 'teks_panjang' },
        { key: 'keluhan_urgent_lama', label: 'Sudah berapa lama', type: 'teks' },
        { key: 'keluhan_urgent_pic', label: 'PIC', type: 'teks' },
        { key: 'keluhan_urgent_target', label: 'Target selesai', type: 'teks' },
        { key: 'keluhan_urgent_bantuan', label: 'Butuh bantuan', type: 'teks' },
      ],
    },
    {
      id: 'penagihan',
      judul: 'Penagihan & Tunggakan',
      fields: [
        { key: 'ditagih_hari_ini', label: 'Konsumen ditagih hari ini', type: 'angka' },
        { key: 'yang_membayar', label: 'Yang membayar', type: 'angka' },
        { key: 'janji_bayar', label: 'Janji bayar', type: 'angka' },
        { key: 'tidak_bisa_dihubungi', label: 'Tidak bisa dihubungi', type: 'angka' },
        { key: 'menunggak_lebih_3_bulan', label: 'Konsumen menunggak >3 bulan (orang)', type: 'angka' },
        {
          key: 'daftar_tunggakan',
          label: 'Daftar tunggakan',
          type: 'tabel',
          kolom: [
            { key: 'nama', label: 'Nama', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'tunggakan', label: 'Tunggakan (Rp)', type: 'teks' },
            { key: 'bulan', label: 'Bulan', type: 'teks' },
            { key: 'terakhir_dihubungi', label: 'Terakhir dihubungi', type: 'teks' },
            { key: 'tindakan', label: 'Tindakan', type: 'teks' },
          ],
        },
        {
          key: 'rekomendasi_cs',
          label: 'Rekomendasi CS',
          type: 'pilih',
          pilihan: ['Tagih lagi', 'Surat peringatan', 'Suspend', 'Take over'],
        },
      ],
    },
    {
      id: 'perubahan_status',
      judul: 'Perubahan Status Konsumen',
      fields: [
        { key: 'refund_diajukan', label: 'Refund diajukan', type: 'angka' },
        { key: 'take_over_diajukan', label: 'Take over diajukan', type: 'angka' },
        { key: 'suspend_jumlah', label: 'Suspend', type: 'angka' },
        { key: 'pindah_lokasi_kavling', label: 'Pindah lokasi/kavling', type: 'angka' },
        { key: 'detail_perubahan_status', label: 'Detail & alasan', type: 'teks_panjang' },
        { key: 'infokan_it', label: 'Sudah diinfokan ke IT untuk update sistem', type: 'ya_tidak' },
        { key: 'infokan_accounting', label: 'Sudah diinfokan ke Accounting', type: 'ya_tidak' },
      ],
    },
    {
      id: 'serah_terima',
      judul: 'Serah Terima & STK',
      fields: [
        { key: 'serah_terima_hari_ini', label: 'Serah terima unit hari ini', type: 'angka' },
        { key: 'menunggu_serah_terima', label: 'Konsumen menunggu serah terima', type: 'angka' },
        { key: 'kendala_serah_terima', label: 'Kendala serah terima', type: 'teks' },
      ],
    },
    {
      id: 'besok',
      judul: 'Target CS Besok',
      fields: [
        { key: 'besok_keluhan_selesai', label: 'Keluhan yang harus selesai', type: 'teks' },
        { key: 'besok_konsumen_ditagih', label: 'Konsumen yang harus ditagih', type: 'teks' },
        { key: 'besok_follow_up', label: 'Follow-up', type: 'teks' },
      ],
    },
    blokKeputusanCeo('Rekap CS untuk Sabrina', 'Status CS hari ini'),
  ],
};
