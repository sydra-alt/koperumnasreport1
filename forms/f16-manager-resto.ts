import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/FORMAT-ASLI-05-MANAGER-RESTO.md, pratinjau disetujui di
 * docs/PRATINJAU-FORM-MANAGER-RESTO.md. scope 'outlet' -- Manager mengurus
 * SATU outlet (Indosteak/Indokopi), pola pemilih sama dengan pic_lokasi kalau
 * suatu saat ada yang mengurus 2 outlet.
 *
 * Keputusan user (setelah pratinjau direview):
 *
 * 1. "Dapur" (blok 6 & 8 dokumen asli) memang duplikat -- dipertahankan CUMA
 *    di blok 6 sebagai `dapur_bersih_sebelum_buka` (label diperjelas "sebelum
 *    buka"), DIHAPUS dari daftar blok 8.
 *
 * 2. Blok 12 "KEBUTUHAN UNTUK BESOK" jadi RINGKASAN BACA-SAJA, bukan field --
 *    §3.5b berlaku juga DI DALAM satu form: isinya sama dengan blok 4 (stok
 *    habis) + blok 5 (kebutuhan besok es batu/air/gas), jadi tidak diketik
 *    dua kali. TIDAK ADA di `blocks` di bawah (sama alasannya dengan blok
 *    baca-saja di form lain) -- dirender LaporForm.tsx dari data form yang
 *    SEDANG diisi sendiri (bukan dari laporan orang lain, jadi tidak butuh
 *    view apa pun, cukup baca ulang data yang sudah diketik di blok 4/5).
 *
 * Blok 4 "STOK HABIS / KEBUTUHAN KIRIMAN PUSAT" diubah dari teks bebas
 * (dokumen asli) jadi TABEL TERSTRUKTUR (barang, jumlah, satuan, dst.).
 * Ini BUKAN cuma soal blok 12 di atas -- field ini JUGA jadi sumber rollup
 * baca-saja utk form Ita (blok "Kebutuhan Stok/RAB" dan blok "Kontrol Stok
 * Restoran"), lewat view security-definer (04-CATATAN-TEKNIS.md §3.4b).
 * Syarat #1 di situ TEGAS: field teks bebas TIDAK BOLEH lewat view
 * security-definer, sedangkan tabel terstruktur (nama barang, jumlah,
 * tanggal) BOLEH -- sama pola dengan `material_kurang` di pic_lokasi.
 * Karena itu field ini WAJIB terstruktur sejak awal, bukan disesuaikan nanti.
 */
export const f16ManagerResto: FormSchema = {
  key: 'manager_resto',
  nama: 'Laporan Harian Manager Resto',
  navLabel: 'Lapor Resto',
  scope: 'outlet',
  blocks: [
    {
      id: 'karyawan',
      judul: 'Karyawan',
      fields: [
        { key: 'total_karyawan', label: 'Total karyawan', type: 'angka' },
        { key: 'karyawan_hadir', label: 'Hadir', type: 'angka' },
        { key: 'izin_sakit_cuti', label: 'Izin/Sakit/Cuti', type: 'angka' },
        { key: 'karyawan_terlambat', label: 'Terlambat', type: 'angka' },
        { key: 'seragam_lengkap', label: 'Seragam lengkap', type: 'ya_tidak' },
        { key: 'briefing_dilakukan', label: 'Briefing dilakukan', type: 'ya_tidak' },
        { key: 'karyawan_tidak_hadir', label: 'Karyawan tidak hadir/terlambat', type: 'teks_panjang' },
        { key: 'masalah_karyawan', label: 'Masalah karyawan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'penjualan',
      judul: 'Rekap Penjualan Hari Ini',
      fields: [
        { key: 'total_omzet', label: 'Total omzet', type: 'uang' },
        { key: 'penjualan_makanan', label: 'Penjualan makanan', type: 'uang' },
        { key: 'penjualan_minuman', label: 'Penjualan minuman', type: 'uang' },
        { key: 'penjualan_lainnya', label: 'Lainnya', type: 'uang' },
        { key: 'metode_cash', label: 'Metode -- Cash', type: 'uang' },
        { key: 'metode_qris', label: 'Metode -- QRIS', type: 'uang' },
        { key: 'metode_transfer', label: 'Metode -- Transfer/Bank', type: 'uang' },
        { key: 'metode_lainnya', label: 'Metode -- Lainnya', type: 'uang' },
        { key: 'semua_transaksi_masuk_sistem', label: 'Semua transaksi sudah masuk sistem', type: 'ya_tidak' },
        { key: 'cash_diterima', label: 'Cash diterima', type: 'uang' },
        { key: 'cash_sudah_disetor', label: 'Sudah ditransfer/disetor', type: 'ya_tidak' },
        { key: 'jumlah_disetor', label: 'Jumlah disetor', type: 'uang' },
        { key: 'sisa_cash', label: 'Sisa cash', type: 'uang' },
        {
          key: 'bukti_transfer_setoran',
          label: 'Bukti transfer/setoran',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'setoran',
        },
      ],
    },
    {
      id: 'kontrol_stok',
      judul: 'Kontrol Stok Sistem vs Stok Aktual',
      fields: [
        { key: 'stock_opname_dilakukan', label: 'Stock opname dilakukan', type: 'ya_tidak' },
        { key: 'ada_selisih_stok', label: 'Ada selisih stok', type: 'ya_tidak' },
        {
          key: 'selisih_stok',
          label: 'Daftar barang selisih',
          type: 'tabel',
          wajibJika: { field: 'ada_selisih_stok', nilai: 'ya' },
          kolom: [
            { key: 'nama_barang', label: 'Nama barang', type: 'teks' },
            { key: 'stok_sistem', label: 'Stok sistem', type: 'teks' },
            { key: 'stok_aktual', label: 'Stok aktual', type: 'teks' },
            { key: 'kurang', label: 'Kurang', type: 'teks' },
            { key: 'lebih', label: 'Lebih', type: 'teks' },
            { key: 'dugaan_penyebab', label: 'Dugaan penyebab', type: 'teks' },
            { key: 'pic_terkait', label: 'PIC terkait', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'stok_habis',
      judul: 'Stok Habis / Kebutuhan Kiriman Pusat',
      catatan: 'Manager tidak melakukan pembelanjaan stok. Seluruh kebutuhan stok dilaporkan untuk dikirim dari pusat.',
      fields: [
        {
          key: 'stok_habis',
          label: 'Sudah habis',
          type: 'tabel',
          kolom: [
            { key: 'barang', label: 'Barang', type: 'teks' },
            { key: 'jumlah', label: 'Jumlah', type: 'teks' },
            { key: 'satuan', label: 'Satuan', type: 'teks' },
          ],
        },
        {
          key: 'stok_akan_habis',
          label: 'Akan habis / kebutuhan besok',
          type: 'tabel',
          kolom: [
            { key: 'barang', label: 'Barang', type: 'teks' },
            { key: 'jumlah', label: 'Jumlah', type: 'teks' },
            { key: 'satuan', label: 'Satuan', type: 'teks' },
            { key: 'kebutuhan_tanggal', label: 'Harus dikirim tanggal', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'utilitas',
      judul: 'Utilitas',
      catatan: 'Manager wajib kontrol setiap hari.',
      fields: [
        { key: 'es_batu_stok_awal', label: 'Es batu -- stok awal', type: 'angka' },
        { key: 'es_batu_pemakaian', label: 'Es batu -- pemakaian', type: 'angka' },
        { key: 'es_batu_sisa', label: 'Es batu -- sisa', type: 'angka' },
        { key: 'es_batu_kebutuhan_besok', label: 'Es batu -- kebutuhan besok', type: 'angka' },
        { key: 'air_kondisi', label: 'Air -- kondisi', type: 'pilih', pilihan: ['Cukup', 'Kurang'] },
        { key: 'air_kebutuhan_besok', label: 'Air -- kebutuhan besok', type: 'teks' },
        { key: 'listrik_normal', label: 'Listrik -- normal', type: 'ya_tidak' },
        { key: 'listrik_kondisi', label: 'Listrik -- meter/kondisi', type: 'teks' },
        { key: 'listrik_gangguan', label: 'Listrik -- ada gangguan', type: 'teks' },
        { key: 'gas_stok', label: 'Gas -- stok (tabung)', type: 'angka' },
        { key: 'gas_terpakai', label: 'Gas -- terpakai', type: 'angka' },
        { key: 'gas_sisa', label: 'Gas -- sisa', type: 'angka' },
        { key: 'gas_kebutuhan_besok', label: 'Gas -- kebutuhan besok', type: 'angka' },
        { key: 'utilitas_bermasalah', label: 'Ada utilitas yang bermasalah', type: 'teks_panjang' },
      ],
    },
    {
      id: 'dapur',
      judul: 'Kesiapan Dapur',
      catatan: 'Sebelum operasional, Manager memastikan hal-hal berikut.',
      fields: [
        { key: 'soto_siap', label: 'Soto siap', type: 'ya_tidak' },
        { key: 'ayam_siap', label: 'Ayam siap', type: 'ya_tidak' },
        { key: 'bahan_makanan_siap', label: 'Bahan makanan siap', type: 'ya_tidak' },
        { key: 'bahan_minuman_siap', label: 'Bahan minuman siap', type: 'ya_tidak' },
        { key: 'dapur_bersih_sebelum_buka', label: 'Dapur bersih (sebelum buka)', type: 'ya_tidak' },
        { key: 'semua_menu_siap', label: 'Semua menu utama siap jual', type: 'ya_tidak' },
        { key: 'menu_tidak_tersedia', label: 'Menu/bahan yang tidak tersedia', type: 'teks_panjang' },
        {
          key: 'dapur_kondisi_catatan',
          label: 'Catatan kondisi dapur',
          type: 'teks_panjang',
          wajib: true,
          buktiWajib: true,
          buktiKunci: 'dapur',
          bantuan: 'Wajib lampirkan video kondisi & kesiapan dapur setiap hari.',
        },
      ],
    },
    {
      id: 'area_customer',
      judul: 'Kesiapan Area Customer',
      fields: [
        { key: 'meja_bersih', label: 'Meja bersih', type: 'ya_tidak' },
        { key: 'kursi_rapi', label: 'Kursi rapi', type: 'ya_tidak' },
        { key: 'tisu_tersedia', label: 'Tisu tersedia', type: 'ya_tidak' },
        { key: 'saus_lengkap', label: 'Saus lengkap', type: 'ya_tidak' },
        { key: 'sendok_tersedia', label: 'Sendok tersedia', type: 'ya_tidak' },
        { key: 'garpu_tersedia', label: 'Garpu tersedia', type: 'ya_tidak' },
        { key: 'peralatan_makan_bersih', label: 'Peralatan makan bersih', type: 'ya_tidak' },
        { key: 'area_customer_siap', label: 'Area customer siap', type: 'ya_tidak' },
        { key: 'kekurangan_area_customer', label: 'Kekurangan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kebersihan_outlet',
      judul: 'Kebersihan Outlet',
      fields: [
        { key: 'depan_resto', label: 'Depan resto', type: 'ya_tidak' },
        { key: 'area_makan', label: 'Area makan', type: 'ya_tidak' },
        { key: 'meja_kursi', label: 'Meja & kursi', type: 'ya_tidak' },
        { key: 'area_kasir', label: 'Area kasir', type: 'ya_tidak' },
        { key: 'musala', label: 'Musala', type: 'ya_tidak' },
        { key: 'kamar_mandi', label: 'Kamar mandi/toilet', type: 'ya_tidak' },
        { key: 'tempat_sampah', label: 'Tempat sampah', type: 'ya_tidak' },
        { key: 'area_belakang', label: 'Area belakang', type: 'ya_tidak' },
        { key: 'masalah_kebersihan', label: 'Masalah kebersihan', type: 'teks_panjang' },
        { key: 'pic_perbaikan_kebersihan', label: 'PIC yang harus memperbaiki', type: 'teks' },
      ],
    },
    {
      id: 'video_wajib',
      judul: 'Video Kontrol Wajib',
      catatan: 'Video harus kondisi hari tersebut, bukan video lama.',
      fields: [
        { key: 'video_depan_resto', label: 'Video tampak depan resto', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_depan' },
        { key: 'video_masuk_dalam', label: 'Video dari depan masuk sampai ke dalam', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_masuk' },
        { key: 'video_area_customer', label: 'Video seluruh area customer', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_customer' },
        { key: 'video_meja_alat_makan', label: 'Video meja + tisu + saus + alat makan', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_meja' },
        { key: 'video_dapur', label: 'Video dapur', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_dapur' },
        { key: 'video_persiapan_makanan', label: 'Video persiapan makanan/soto/ayam', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_persiapan' },
        { key: 'video_musala', label: 'Video musala', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_musala' },
        { key: 'video_kamar_mandi', label: 'Video kamar mandi', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_kamar_mandi' },
        { key: 'video_kebersihan_outlet', label: 'Video kebersihan outlet', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_kebersihan' },
        { key: 'video_suasana_customer', label: 'Video suasana restoran saat ada customer', type: 'centang', wajib: true, buktiWajib: true, buktiKunci: 'video_suasana' },
      ],
    },
    {
      id: 'customer_masalah',
      judul: 'Customer & Masalah Resto',
      fields: [
        { key: 'customer_hari_ini', label: 'Customer hari ini', type: 'angka' },
        { key: 'komplain', label: 'Komplain', type: 'angka' },
        { key: 'komplain_selesai', label: 'Komplain selesai', type: 'angka' },
        { key: 'komplain_belum_selesai', label: 'Belum selesai', type: 'angka' },
        { key: 'masalah_customer', label: 'Masalah customer', type: 'teks_panjang' },
        { key: 'masalah_operasional_resto', label: 'Masalah operasional resto', type: 'teks_panjang' },
        { key: 'kerusakan_alat_fasilitas', label: 'Kerusakan alat/fasilitas', type: 'teks_panjang' },
        { key: 'tindakan_dilakukan_resto', label: 'Tindakan yang sudah dilakukan', type: 'teks_panjang' },
        { key: 'butuh_bantuan_pusat', label: 'Butuh bantuan pusat', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kontrol_pte',
      judul: 'Kontrol PTA/PTE Seluruh Karyawan',
      catatan: 'Manager tidak perlu membuat laporan PTA personal karyawan. Manager hanya memastikan kewajiban PTE tiap karyawan terpenuhi.',
      fields: [
        { key: 'total_wajib_pte', label: 'Total karyawan wajib PTA/PTE', type: 'angka' },
        { key: 'sudah_kirim_pte', label: 'Sudah mengirim laporan personal', type: 'angka' },
        { key: 'belum_kirim_pte', label: 'Belum mengirim', type: 'angka' },
        { key: 'cek_live_lengkap', label: 'Live -- lengkap', type: 'angka' },
        { key: 'cek_live_total', label: 'Live -- dari total karyawan', type: 'angka' },
        { key: 'cek_undangan_lengkap', label: 'Undangan konsumen baru -- lengkap', type: 'angka' },
        { key: 'cek_undangan_total', label: 'Undangan konsumen baru -- dari total', type: 'angka' },
        { key: 'cek_kesaksian_lengkap', label: 'Kesaksian -- lengkap', type: 'angka' },
        { key: 'cek_kesaksian_total', label: 'Kesaksian -- dari total', type: 'angka' },
        { key: 'cek_review_lengkap', label: 'Google Review -- lengkap', type: 'angka' },
        { key: 'cek_review_total', label: 'Google Review -- dari total', type: 'angka' },
        { key: 'cek_vt_lengkap', label: 'Min. 3 VT/update medsos -- lengkap', type: 'angka' },
        { key: 'cek_vt_total', label: 'Min. 3 VT/update medsos -- dari total', type: 'angka' },
        { key: 'cek_mentahan_lengkap', label: 'Video mentahan -- lengkap', type: 'angka' },
        { key: 'cek_mentahan_total', label: 'Video mentahan -- dari total', type: 'angka' },
        { key: 'karyawan_pte_tidak_lengkap', label: 'Karyawan PTA/PTE tidak lengkap', type: 'teks_panjang' },
        { key: 'alasan_pte_tidak_lengkap', label: 'Alasan', type: 'teks_panjang' },
        { key: 'tindakan_manager_pte', label: 'Tindakan Manager', type: 'teks_panjang' },
      ],
    },
    blokKeputusanCeo('Rekap Manager Hari Ini', 'Status resto hari ini'),
  ],
};
