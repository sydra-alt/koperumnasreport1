import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/FORMAT-ASLI-06-ITA.md, pratinjau disetujui di
 * docs/PRATINJAU-FORM-ITA.md. scope 'global' -- satu Ita, satu laporan per
 * hari.
 *
 * Keputusan user (setelah pratinjau direview):
 *
 * C. §10 PTE PERSONAL ITA TIDAK jadi field -- rollup generik yang sama
 *    dipakai semua form selain personal_marketing (LaporForm.tsx,
 *    `perluRollupMarketing`). Alasan: `pte_daily` punya `unique(user_id,
 *    tanggal)` -- dua form yang menulis PTE hari yang sama akan saling
 *    menimpa diam-diam. Dua field yang BUKAN PTE personal dipindah (bukan
 *    dihapus): "Google Review Indokopi" -> blok 6, "durasi live" -> blok 1.
 *
 * D-lanjutan. §9 "KEBUTUHAN STOK/RAB": daftar barang kurang TIDAK diketik
 *    ulang -- rollup baca-saja dari `manager_resto` (dia yang lihat rak
 *    kosong), Ita cuma menambah RAB + status pengajuan. Field baca-saja itu
 *    TIDAK ADA di `blocks` (sama pola dengan blok baca-saja form lain).
 *
 * Blok 8 "KONTROL STOK RESTORAN": TETAP silang-cek independen milik Ita
 *    (dipertahankan sebagai isian, BUKAN rollup) -- tapi angka `manager_resto`
 *    ditampilkan otomatis di sebelahnya utk dibandingkan, selisih dihitung
 *    sistem. Ita membandingkan, bukan mengetik ulang punya Manager.
 *
 * Kunci `omzet_<slug>` (blok pembukuan per outlet) adalah KONTRAK dengan
 * `selisih_resto_untuk_tanggal()` (migrasi 0031_indosteak_dua_outlet.sql) --
 * pola `'omzet_' || outlet.slug`. Jangan diganti namanya tanpa mengganti
 * `outlet.slug` juga.
 *
 * Sejak 30 Agustus 2026 Indosteak jadi DUA outlet (Cempaka & Pekansari,
 * bukan satu) -- tiga blok pembukuan sekarang (Indokopi Jatinegara,
 * Indosteak Cempaka, Indosteak Pekansari), bukan dua. Field kontrol
 * stok/stock-opname per outlet ikut dipecah tiga demi konsistensi, walau
 * itu bukan bagian kontrak JSON (cuma isian manual Ita).
 *
 * Blok "Stock Opname Mingguan" cuma tampil hari Senin (`hanyaHari: [1]`,
 * lihat forms/validasi.ts `blokBerlakuHariIni`).
 */
export const f16Ita: FormSchema = {
  key: 'ita',
  nama: 'Laporan Harian Ita (Thrifting & Kontrol F&B)',
  navLabel: 'Lapor Ita',
  scope: 'global',
  blocks: [
    {
      id: 'thrifting',
      judul: 'Penjualan Thrifting Hari Ini',
      fields: [
        { key: 'omzet_thrifting', label: 'Omzet hari ini', type: 'uang' },
        { key: 'barang_terjual', label: 'Jumlah barang terjual', type: 'angka' },
        { key: 'jumlah_transaksi_thrifting', label: 'Jumlah transaksi', type: 'angka' },
        { key: 'cash_thrifting', label: 'Cash', type: 'uang' },
        { key: 'transfer_thrifting', label: 'Transfer/Bank', type: 'uang' },
        { key: 'qris_thrifting', label: 'QRIS', type: 'uang' },
        { key: 'sesuai_sistem_thrifting', label: 'Sesuai dengan sistem', type: 'ya_tidak' },
        {
          key: 'selisih_thrifting',
          label: 'Selisih',
          type: 'uang',
          wajibJika: { field: 'sesuai_sistem_thrifting', nilai: 'tidak' },
        },
        {
          key: 'keterangan_thrifting',
          label: 'Keterangan',
          type: 'teks_panjang',
          wajibJika: { field: 'sesuai_sistem_thrifting', nilai: 'tidak' },
        },
        { key: 'durasi_live', label: 'Durasi live hari ini (menit)', type: 'angka' },
      ],
    },
    {
      id: 'barang_masuk',
      judul: 'Barang Thrifting Masuk',
      catatan: 'Tidak boleh ada barang masuk yang dijual sebelum didata dan masuk sistem.',
      fields: [
        { key: 'barang_masuk', label: 'Barang masuk hari ini (pcs)', type: 'angka' },
        { key: 'sudah_dihitung', label: 'Sudah dihitung', type: 'ya_tidak' },
        { key: 'sudah_dicek_kondisi', label: 'Sudah dicek kondisi', type: 'ya_tidak' },
        { key: 'sudah_diberi_label', label: 'Sudah diberikan label', type: 'ya_tidak' },
        { key: 'sudah_diberi_harga', label: 'Sudah diberikan harga', type: 'ya_tidak' },
        { key: 'sudah_didata', label: 'Sudah didata', type: 'ya_tidak' },
        { key: 'sudah_masuk_sistem_barang', label: 'Sudah masuk aplikasi/sistem', type: 'ya_tidak' },
        { key: 'sudah_siap_display', label: 'Sudah siap display/jual', type: 'ya_tidak' },
        { key: 'barang_belum_masuk_sistem', label: 'Barang belum masuk sistem (pcs)', type: 'angka' },
        { key: 'alasan_belum_masuk', label: 'Alasan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kontrol_stok_thrifting',
      judul: 'Kontrol Stok Thrifting',
      fields: [
        { key: 'stok_sistem_thrifting', label: 'Stok sistem (pcs)', type: 'angka' },
        { key: 'stok_aktual_thrifting', label: 'Stok aktual (pcs)', type: 'angka' },
        { key: 'status_stok_thrifting', label: 'Stok sistem = stok aktual', type: 'ya_tidak' },
        { key: 'kurang_lebih_thrifting', label: 'Kurang/Lebih (kalau selisih)', type: 'teks' },
        {
          key: 'penyebab_selisih_thrifting',
          label: 'Penyebab',
          type: 'teks_panjang',
          wajibJika: { field: 'status_stok_thrifting', nilai: 'tidak' },
        },
        { key: 'tindakan_selisih_thrifting', label: 'Tindakan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kebersihan_thrifting',
      judul: 'Kebersihan Area Thrifting',
      fields: [
        { key: 'lantai_thrifting', label: 'Lantai', type: 'ya_tidak' },
        { key: 'rak_display', label: 'Rak/display', type: 'ya_tidak' },
        { key: 'barang_tertata', label: 'Barang tertata', type: 'ya_tidak' },
        { key: 'barang_bersih', label: 'Barang bersih', type: 'ya_tidak' },
        { key: 'label_harga_rapi', label: 'Label/harga rapi', type: 'ya_tidak' },
        { key: 'area_kasir_thrifting', label: 'Area kasir', type: 'ya_tidak' },
        { key: 'gudang_stok', label: 'Gudang/stok', type: 'ya_tidak' },
        { key: 'tampilan_siap_customer', label: 'Tampilan siap customer', type: 'ya_tidak' },
        {
          key: 'video_kondisi_thrifting',
          label: 'Video kondisi Thrifting hari ini',
          type: 'ya_tidak',
          buktiWajib: true,
          buktiKunci: 'kondisi_thrifting',
        },
        { key: 'masalah_thrifting', label: 'Masalah', type: 'teks_panjang' },
      ],
    },
    {
      id: 'pembukuan_indokopi_jatinegara',
      judul: 'Cek Pembukuan Indokopi Jatinegara',
      fields: [
        { key: 'omzet_indokopi_jatinegara', label: 'Omzet sistem hari ini', type: 'uang' },
        { key: 'cash_indokopi_jatinegara', label: 'Cash', type: 'uang' },
        { key: 'qris_indokopi_jatinegara', label: 'QRIS', type: 'uang' },
        { key: 'bank_indokopi_jatinegara', label: 'Bank/Transfer', type: 'uang' },
        { key: 'sesuai_indokopi_jatinegara', label: 'Omzet sistem = uang penjualan', type: 'ya_tidak' },
        {
          key: 'selisih_indokopi_jatinegara',
          label: 'Selisih',
          type: 'uang',
          wajibJika: { field: 'sesuai_indokopi_jatinegara', nilai: 'tidak' },
        },
        {
          key: 'penyebab_indokopi_jatinegara',
          label: 'Penyebab/keterangan',
          type: 'teks_panjang',
          wajibJika: { field: 'sesuai_indokopi_jatinegara', nilai: 'tidak' },
        },
        { key: 'bukti_diberikan_accounting_indokopi_jatinegara', label: 'Bukti/data sudah diberikan ke Accounting', type: 'ya_tidak' },
        { key: 'review_google_indokopi_jatinegara', label: 'Google Review Indokopi Jatinegara (jumlah baru)', type: 'angka' },
      ],
    },
    {
      id: 'pembukuan_indosteak_cempaka',
      judul: 'Cek Pembukuan Indosteak Cempaka',
      fields: [
        { key: 'omzet_indosteak_cempaka', label: 'Omzet sistem hari ini', type: 'uang' },
        { key: 'cash_indosteak_cempaka', label: 'Cash', type: 'uang' },
        { key: 'qris_indosteak_cempaka', label: 'QRIS', type: 'uang' },
        { key: 'bank_indosteak_cempaka', label: 'Bank/Transfer', type: 'uang' },
        { key: 'sesuai_indosteak_cempaka', label: 'Omzet sistem = uang penjualan', type: 'ya_tidak' },
        {
          key: 'selisih_indosteak_cempaka',
          label: 'Selisih',
          type: 'uang',
          wajibJika: { field: 'sesuai_indosteak_cempaka', nilai: 'tidak' },
        },
        {
          key: 'penyebab_indosteak_cempaka',
          label: 'Penyebab/keterangan',
          type: 'teks_panjang',
          wajibJika: { field: 'sesuai_indosteak_cempaka', nilai: 'tidak' },
        },
        { key: 'bukti_diberikan_accounting_indosteak_cempaka', label: 'Bukti/data sudah diberikan ke Accounting', type: 'ya_tidak' },
      ],
    },
    {
      id: 'pembukuan_indosteak_pekansari',
      judul: 'Cek Pembukuan Indosteak Pekansari',
      fields: [
        { key: 'omzet_indosteak_pekansari', label: 'Omzet sistem hari ini', type: 'uang' },
        { key: 'cash_indosteak_pekansari', label: 'Cash', type: 'uang' },
        { key: 'qris_indosteak_pekansari', label: 'QRIS', type: 'uang' },
        { key: 'bank_indosteak_pekansari', label: 'Bank/Transfer', type: 'uang' },
        { key: 'sesuai_indosteak_pekansari', label: 'Omzet sistem = uang penjualan', type: 'ya_tidak' },
        {
          key: 'selisih_indosteak_pekansari',
          label: 'Selisih',
          type: 'uang',
          wajibJika: { field: 'sesuai_indosteak_pekansari', nilai: 'tidak' },
        },
        {
          key: 'penyebab_indosteak_pekansari',
          label: 'Penyebab/keterangan',
          type: 'teks_panjang',
          wajibJika: { field: 'sesuai_indosteak_pekansari', nilai: 'tidak' },
        },
        { key: 'bukti_diberikan_accounting_indosteak_pekansari', label: 'Bukti/data sudah diberikan ke Accounting', type: 'ya_tidak' },
      ],
    },
    {
      id: 'verifikasi_sabita',
      judul: 'Verifikasi dengan Bu Sabita',
      fields: [
        { key: 'mutasi_bank_dicek', label: 'Mutasi bank sudah dicek Accounting', type: 'ya_tidak' },
        { key: 'cash_sudah_disetor_verifikasi', label: 'Cash sudah disetor', type: 'ya_tidak' },
        { key: 'jumlah_cash_belum_disetor', label: 'Jumlah cash belum disetor', type: 'uang' },
        { key: 'selisih_perlu_ditelusuri', label: 'Selisih yang perlu ditelusuri', type: 'uang' },
        { key: 'keterangan_verifikasi', label: 'Keterangan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kontrol_stok_resto',
      judul: 'Kontrol Stok Restoran',
      catatan: 'Angka pengecekan Manager Resto ditampilkan otomatis di atas sebagai pembanding -- Anda tetap mengisi hasil pengecekan sendiri.',
      fields: [
        { key: 'stok_sesuai_indokopi_jatinegara', label: 'Indokopi Jatinegara -- stok sistem = stok aktual (versi Ita)', type: 'ya_tidak' },
        { key: 'stok_habis_indokopi_jatinegara', label: 'Indokopi Jatinegara -- stok habis', type: 'teks_panjang' },
        { key: 'stok_hampir_habis_indokopi_jatinegara', label: 'Indokopi Jatinegara -- stok hampir habis', type: 'teks_panjang' },
        { key: 'kebutuhan_indokopi_jatinegara', label: 'Indokopi Jatinegara -- kebutuhan', type: 'teks_panjang' },
        { key: 'stok_sesuai_indosteak_cempaka', label: 'Indosteak Cempaka -- stok sistem = stok aktual (versi Ita)', type: 'ya_tidak' },
        { key: 'stok_habis_indosteak_cempaka', label: 'Indosteak Cempaka -- stok habis', type: 'teks_panjang' },
        { key: 'stok_hampir_habis_indosteak_cempaka', label: 'Indosteak Cempaka -- stok hampir habis', type: 'teks_panjang' },
        { key: 'kebutuhan_indosteak_cempaka', label: 'Indosteak Cempaka -- kebutuhan', type: 'teks_panjang' },
        { key: 'stok_sesuai_indosteak_pekansari', label: 'Indosteak Pekansari -- stok sistem = stok aktual (versi Ita)', type: 'ya_tidak' },
        { key: 'stok_habis_indosteak_pekansari', label: 'Indosteak Pekansari -- stok habis', type: 'teks_panjang' },
        { key: 'stok_hampir_habis_indosteak_pekansari', label: 'Indosteak Pekansari -- stok hampir habis', type: 'teks_panjang' },
        { key: 'kebutuhan_indosteak_pekansari', label: 'Indosteak Pekansari -- kebutuhan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'rab_stok',
      judul: 'Kebutuhan Stok / RAB',
      catatan: 'Daftar stok habis/kebutuhan kiriman pusat ditampilkan otomatis di atas, dari laporan Manager Resto hari ini -- tidak diketik ulang.',
      fields: [
        { key: 'rab_kebutuhan_stok', label: 'RAB', type: 'uang' },
        { key: 'diajukan_pak_eri', label: 'Sudah diajukan ke Pak Eri', type: 'ya_tidak' },
        { key: 'diajukan_bu_rika', label: 'Sudah diajukan ke Bu Rika', type: 'ya_tidak' },
        {
          key: 'status_pengajuan_stok',
          label: 'Status',
          type: 'pilih',
          pilihan: ['Menunggu', 'Disetujui', 'Proses', 'Selesai'],
        },
      ],
    },
    {
      id: 'stock_opname',
      judul: 'Stock Opname Mingguan (khusus Senin)',
      hanyaHari: [1],
      catatan: 'Bagian ini cuma tampil hari Senin.',
      fields: [
        { key: 'so_thrifting_stok_sistem', label: 'Thrifting -- stok sistem (pcs)', type: 'angka' },
        { key: 'so_thrifting_stok_fisik', label: 'Thrifting -- stok fisik (pcs)', type: 'angka' },
        { key: 'so_thrifting_selisih_pcs', label: 'Thrifting -- selisih (pcs)', type: 'angka' },
        { key: 'so_thrifting_selisih_rp', label: 'Thrifting -- selisih (Rp)', type: 'uang' },
        { key: 'so_thrifting_status', label: 'Thrifting -- sesuai', type: 'ya_tidak' },
        { key: 'so_indokopi_jatinegara_stok_sistem', label: 'Indokopi Jatinegara -- nilai/jumlah stok sistem', type: 'teks' },
        { key: 'so_indokopi_jatinegara_stok_aktual', label: 'Indokopi Jatinegara -- stok aktual', type: 'teks' },
        { key: 'so_indokopi_jatinegara_selisih', label: 'Indokopi Jatinegara -- selisih', type: 'teks' },
        { key: 'so_indokopi_jatinegara_status', label: 'Indokopi Jatinegara -- sesuai', type: 'ya_tidak' },
        { key: 'so_indosteak_cempaka_stok_sistem', label: 'Indosteak Cempaka -- nilai/jumlah stok sistem', type: 'teks' },
        { key: 'so_indosteak_cempaka_stok_aktual', label: 'Indosteak Cempaka -- stok aktual', type: 'teks' },
        { key: 'so_indosteak_cempaka_selisih', label: 'Indosteak Cempaka -- selisih', type: 'teks' },
        { key: 'so_indosteak_cempaka_status', label: 'Indosteak Cempaka -- sesuai', type: 'ya_tidak' },
        { key: 'so_indosteak_pekansari_stok_sistem', label: 'Indosteak Pekansari -- nilai/jumlah stok sistem', type: 'teks' },
        { key: 'so_indosteak_pekansari_stok_aktual', label: 'Indosteak Pekansari -- stok aktual', type: 'teks' },
        { key: 'so_indosteak_pekansari_selisih', label: 'Indosteak Pekansari -- selisih', type: 'teks' },
        { key: 'so_indosteak_pekansari_status', label: 'Indosteak Pekansari -- sesuai', type: 'ya_tidak' },
        { key: 'so_daftar_barang_selisih', label: 'Daftar barang selisih', type: 'teks_panjang' },
        { key: 'so_penyebab_selisih', label: 'Penyebab selisih', type: 'teks_panjang' },
        { key: 'so_tindakan_perbaikan', label: 'Tindakan/perbaikan', type: 'teks_panjang' },
        { key: 'so_kebutuhan_minggu_depan', label: 'Kebutuhan stok minggu berikutnya', type: 'teks_panjang' },
        { key: 'so_rab_kebutuhan', label: 'RAB kebutuhan', type: 'uang' },
        { key: 'so_diajukan_eri_rika', label: 'Diajukan ke Pak Eri/Bu Rika', type: 'ya_tidak' },
      ],
    },
    blokKeputusanCeo('Rekap Ita Hari Ini', 'Status hari ini'),
  ],
};
