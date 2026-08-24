import type { FormSchema } from './types';

/**
 * Sesuai docs/FORMAT-ASLI-03-ACCOUNTING.md, pratinjau disetujui di
 * docs/PRATINJAU-FORM-ACCOUNTING.md. scope 'global' -- satu Accounting, satu
 * laporan per hari. `rahasia: true` -- form ini SATU-SATUNYA yang cuma bisa
 * dibaca CEO dan Accounting sendiri (`can_see_report()`, 0002_rls.sql, sudah
 * ada sejak Task 04 -- tidak ada RLS baru yang perlu dibuat utk kerahasiaan
 * dasarnya, itu sudah berlaku). `rahasia` di sini murni penanda dokumentasi/
 * UI (belum ada konsumennya, disiapkan utk Task 18/22).
 *
 * Keputusan user (setelah pratinjau direview):
 *
 * 4. Blok 10 "KONTRAKTOR/SUPPLIER/DTI" -- patokannya SIAPA YANG MENGAJUKAN:
 *    OTOMATIS (pengajuan divisi lain, dari view `v_kebutuhan_pembangunan_
 *    accounting`): precast/DTI (dari `dti`), material & infrastruktur/jalan
 *    (dari `pembangunan`). DIKETIK Accounting: kontraktor jatuh tempo,
 *    listrik/utilitas proyek (tagihan yang masuk ke meja Accounting sendiri,
 *    divisi lain tidak tahu). Blok 8 "KEBUTUHAN PEMBANGUNAN" JUGA otomatis
 *    penuh dari view yang sama -- TIDAK ADA di `blocks` (rollup baca-saja,
 *    sama pola dengan blok baca-saja form lain).
 *
 * 5. Blok 16 "PRIORITAS PEMBAYARAN": TIGA baris `decision` terpisah
 *    (urgensi 1/2/3), BUKAN satu keputusan per laporan seperti
 *    `blokKeputusanCeo` di form lain -- alasannya CEO bisa menyetujui satu,
 *    menunda satunya, menolak yang lain; masing-masing juga punya nominal/
 *    deadline/dampak sendiri. Field `prioritas_pembayaran` (blok 16) pakai
 *    `sumberKeputusan: true` (forms/types.ts) -- mekanisme GENERIK yang
 *    sama dipakai Task 13/15 (`blokKeputusanCeo`), bukan yang baru. Kolom
 *    tabelnya WAJIB `judul`/`nominal`/`deadline`/`dampak` persis (kontrak
 *    dengan LaporForm.tsx). Karena blok 16 sudah menutupi kebutuhan
 *    "keputusan CEO", form ini TIDAK memakai `blokKeputusanCeo()` sama
 *    sekali -- status hari ini sudah ada di blok 6 (Cashflow), catatan
 *    umum di blok 18.
 *
 * Blok 13 "REKONSILIASI RESTO": omzet versi Manager & versi Ita TIDAK lewat
 * view security-definer -- role `accounting` SUDAH punya can_see_report()
 * langsung ke form_key 'manager_resto' dan 'ita' (0002_rls.sql), jadi cukup
 * query biasa (lib/api/accounting.ts), tidak perlu security definer.
 *
 * Blok 3 berisi NAMA KONSUMEN -- field ini TIDAK PERNAH jadi sumber view
 * lintas-divisi mana pun, sesuai §3.4b (nama konsumen dilarang mutlak).
 */
export const f17Accounting: FormSchema = {
  key: 'accounting',
  nama: 'Laporan Harian Accounting',
  navLabel: 'Lapor Accounting',
  scope: 'global',
  rahasia: true,
  blocks: [
    {
      id: 'saldo',
      judul: 'Posisi Saldo Hari Ini',
      fields: [
        {
          key: 'daftar_saldo_bank',
          label: 'Saldo bank',
          type: 'tabel',
          kolom: [
            { key: 'nama_bank', label: 'Nama bank', type: 'teks' },
            { key: 'saldo', label: 'Saldo (Rp)', type: 'teks' },
          ],
        },
        { key: 'cash_kantor', label: 'Cash kantor', type: 'uang' },
        { key: 'cash_outlet', label: 'Cash outlet/resto', type: 'uang' },
        { key: 'cash_lainnya_saldo', label: 'Cash lainnya', type: 'uang' },
      ],
    },
    {
      id: 'uang_masuk',
      judul: 'Uang Masuk Hari Ini',
      fields: [
        { key: 'cicilan_konsumen', label: 'Cicilan konsumen', type: 'uang' },
        { key: 'booking_dp', label: 'Booking/DP', type: 'uang' },
        { key: 'pelunasan', label: 'Pelunasan', type: 'uang' },
        { key: 'pembayaran_lainnya_konsumen', label: 'Pembayaran lainnya (konsumen)', type: 'uang' },
        { key: 'masuk_indokopi', label: 'Indokopi', type: 'uang' },
        { key: 'masuk_indosteak', label: 'Indosteak', type: 'uang' },
        { key: 'masuk_unit_usaha_lainnya', label: 'Unit usaha lainnya', type: 'uang' },
        {
          key: 'penerimaan_lain',
          label: 'Penerimaan lain',
          type: 'tabel',
          kolom: [
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
          ],
        },
        { key: 'metode_bank_masuk', label: 'Metode -- Bank', type: 'uang' },
        { key: 'metode_cash_masuk', label: 'Metode -- Cash', type: 'uang' },
        { key: 'metode_qris_masuk', label: 'Metode -- QRIS', type: 'uang' },
        { key: 'metode_lainnya_masuk', label: 'Metode -- Lainnya', type: 'uang' },
      ],
    },
    {
      id: 'detail_penerimaan',
      judul: 'Detail Penerimaan Konsumen',
      fields: [
        {
          key: 'detail_penerimaan',
          label: 'Daftar penerimaan',
          type: 'tabel',
          kolom: [
            { key: 'nama_konsumen', label: 'Nama', type: 'teks' },
            { key: 'no_konsumen', label: 'No. konsumen', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'untuk_pembayaran', label: 'Untuk pembayaran', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
            { key: 'masuk_rekening', label: 'Masuk rekening', type: 'teks' },
            { key: 'sudah_input_sistem', label: 'Sudah input sistem (ya/tidak)', type: 'teks' },
          ],
        },
        { key: 'total_transaksi_masuk', label: 'Total transaksi masuk', type: 'angka' },
        { key: 'pembayaran_belum_teridentifikasi', label: 'Pembayaran belum teridentifikasi', type: 'teks_panjang' },
      ],
    },
    {
      id: 'uang_keluar',
      judul: 'Uang Keluar Hari Ini',
      fields: [
        {
          key: 'daftar_uang_keluar',
          label: 'Daftar pengeluaran',
          type: 'tabel',
          kolom: [
            { key: 'keperluan', label: 'Keperluan', type: 'teks' },
            { key: 'divisi_lokasi', label: 'Divisi/Lokasi', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
            { key: 'penerima', label: 'Penerima', type: 'teks' },
            { key: 'rekening_cash', label: 'Rekening/Cash', type: 'teks' },
            { key: 'acc', label: 'ACC', type: 'teks' },
            { key: 'bukti', label: 'Bukti (ya/tidak)', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'petty_cash',
      judul: 'Petty Cash',
      fields: [
        { key: 'saldo_awal_petty', label: 'Saldo awal petty cash', type: 'uang' },
        { key: 'pengisian_petty', label: 'Pengisian', type: 'uang' },
        { key: 'pemakaian_petty', label: 'Pemakaian hari ini', type: 'uang' },
        { key: 'saldo_akhir_petty', label: 'Saldo akhir fisik', type: 'uang' },
        { key: 'bukti_lengkap_petty', label: 'Bukti lengkap', type: 'ya_tidak' },
        { key: 'pengeluaran_tanpa_bukti_petty', label: 'Pengeluaran tanpa bukti', type: 'teks_panjang' },
      ],
    },
    {
      id: 'cashflow',
      judul: 'Cashflow Hari Ini',
      catatan: 'Saldo awal, uang masuk, uang keluar, net cashflow, dan saldo akhir dihitung otomatis dari blok 1, 2, dan 4.',
      fields: [{ key: 'status_cashflow', label: 'Status', type: 'status_warna' }],
    },
    {
      id: 'tagihan',
      judul: 'Tagihan / Kewajiban Jatuh Tempo',
      fields: [
        {
          key: 'jatuh_tempo_hari_ini',
          label: 'Jatuh tempo hari ini',
          type: 'tabel',
          kolom: [
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
          ],
        },
        {
          key: 'jatuh_tempo_7_hari',
          label: 'Jatuh tempo 7 hari ke depan',
          type: 'tabel',
          kolom: [
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
            { key: 'tanggal', label: 'Tanggal', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
          ],
        },
        { key: 'total_kewajiban_30_hari', label: 'Total kewajiban 30 hari ke depan', type: 'uang' },
        { key: 'prioritas_pembayaran_catatan', label: 'Prioritas pembayaran (catatan)', type: 'teks_panjang' },
      ],
    },
    {
      id: 'lahan',
      judul: 'Tanah / Lahan',
      fields: [
        { key: 'pembayaran_lahan_jatuh_tempo', label: 'Pembayaran lahan jatuh tempo', type: 'teks_panjang' },
        {
          key: 'daftar_kewajiban_lahan',
          label: 'Daftar kewajiban lahan',
          type: 'tabel',
          kolom: [
            { key: 'lokasi', label: 'Lokasi', type: 'teks' },
            { key: 'pemilik', label: 'Pemilik', type: 'teks' },
            { key: 'total_kewajiban', label: 'Total kewajiban (Rp)', type: 'teks' },
            { key: 'sudah_dibayar', label: 'Sudah dibayar (Rp)', type: 'teks' },
            { key: 'sisa', label: 'Sisa (Rp)', type: 'teks' },
            { key: 'jatuh_tempo', label: 'Jatuh tempo', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'kontraktor_supplier',
      judul: 'Kontraktor / Supplier / DTI',
      catatan: 'Precast/DTI, Material, dan Infrastruktur/jalan ditampilkan otomatis di atas dari pengajuan DTI & Kepala Pembangunan -- tidak diketik ulang.',
      fields: [
        { key: 'kontraktor_jatuh_tempo', label: 'Kontraktor jatuh tempo', type: 'uang' },
        { key: 'listrik_utilitas_proyek', label: 'Listrik/utilitas proyek', type: 'uang' },
        { key: 'kewajiban_lainnya_kontraktor', label: 'Kewajiban lainnya', type: 'uang' },
        { key: 'kontraktor_paling_urgent', label: 'Yang paling urgent', type: 'teks_panjang' },
      ],
    },
    {
      id: 'piutang',
      judul: 'Piutang / Uang yang Harus Ditagih',
      fields: [
        { key: 'piutang_konsumen', label: 'Piutang konsumen', type: 'uang' },
        { key: 'tunggakan_konsumen', label: 'Tunggakan konsumen', type: 'uang' },
        { key: 'piutang_kontraktor', label: 'Piutang kontraktor', type: 'uang' },
        { key: 'piutang_operasional_lahan', label: 'Piutang operasional lahan', type: 'uang' },
        { key: 'piutang_lainnya', label: 'Piutang lainnya', type: 'uang' },
        { key: 'target_penagihan_hari_ini', label: 'Target penagihan hari ini', type: 'uang' },
        { key: 'tertagih', label: 'Tertagih', type: 'uang' },
        {
          key: 'tagihan_besar_belum_masuk',
          label: 'Tagihan besar belum masuk',
          type: 'tabel',
          kolom: [
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
          ],
        },
        { key: 'pic_penagihan', label: 'PIC penagihan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'rekonsiliasi_bank',
      judul: 'Rekonsiliasi Bank',
      fields: [
        { key: 'mutasi_dicek', label: 'Semua mutasi bank dicek', type: 'ya_tidak' },
        { key: 'uang_masuk_teridentifikasi', label: 'Semua uang masuk teridentifikasi', type: 'ya_tidak' },
        { key: 'uang_keluar_ada_bukti', label: 'Semua uang keluar ada bukti', type: 'ya_tidak' },
        { key: 'saldo_buku_sama_bank', label: 'Saldo buku = saldo bank', type: 'ya_tidak' },
        { key: 'selisih_rekonsiliasi_bank', label: 'Selisih', type: 'uang' },
        { key: 'transaksi_belum_teridentifikasi_bank', label: 'Transaksi belum teridentifikasi', type: 'teks_panjang' },
      ],
    },
    {
      id: 'rekonsiliasi_resto',
      judul: 'Rekonsiliasi Resto',
      catatan: 'Omzet versi Manager Resto dan versi Ita ditampilkan otomatis di atas untuk tiap outlet -- Anda mengisi angka sisi bank, selisih dihitung sistem.',
      fields: [
        { key: 'cash_bank_indosteak', label: 'Indosteak -- Cash (versi bank)', type: 'uang' },
        { key: 'qris_bank_indosteak', label: 'Indosteak -- QRIS/Bank', type: 'uang' },
        { key: 'cash_bank_indokopi', label: 'Indokopi -- Cash (versi bank)', type: 'uang' },
        { key: 'qris_bank_indokopi', label: 'Indokopi -- QRIS/Bank', type: 'uang' },
      ],
    },
    {
      id: 'transaksi_bermasalah',
      judul: 'Transaksi Bermasalah',
      fields: [
        { key: 'pembayaran_tanpa_bukti_masalah', label: 'Pembayaran tanpa bukti', type: 'teks_panjang' },
        { key: 'transfer_belum_teridentifikasi_masalah', label: 'Transfer belum teridentifikasi', type: 'teks_panjang' },
        { key: 'pengeluaran_belum_acc', label: 'Pengeluaran belum ACC', type: 'teks_panjang' },
        { key: 'selisih_kas_masalah', label: 'Selisih kas', type: 'teks_panjang' },
        { key: 'selisih_bank_masalah', label: 'Selisih bank', type: 'teks_panjang' },
        { key: 'transaksi_perlu_klarifikasi', label: 'Transaksi perlu klarifikasi', type: 'teks_panjang' },
        { key: 'total_nilai_bermasalah', label: 'Total nilai yang masih bermasalah', type: 'uang' },
      ],
    },
    {
      id: 'kebutuhan_dana_ceo',
      judul: 'Kebutuhan Dana CEO',
      catatan: 'Dana tersedia, kebutuhan pembangunan, dan kebutuhan lahan diambil otomatis dari blok 1, 8, dan 9.',
      fields: [
        { key: 'kewajiban_urgent', label: 'Kewajiban urgent', type: 'uang' },
        { key: 'kebutuhan_operasional', label: 'Kebutuhan operasional', type: 'uang' },
      ],
    },
    {
      id: 'prioritas_pembayaran',
      judul: 'Prioritas Pembayaran -- Minta ACC CEO',
      catatan: 'Tiap baris jadi satu permintaan keputusan CEO terpisah (urutan baris = tingkat prioritas 1, 2, 3). Maksimal 3 baris yang diproses jadi keputusan.',
      fields: [
        {
          key: 'prioritas_pembayaran',
          label: 'Daftar prioritas',
          type: 'tabel',
          sumberKeputusan: true,
          kolom: [
            { key: 'judul', label: 'Untuk', type: 'teks' },
            { key: 'nominal', label: 'Nominal (Rp)', type: 'teks' },
            { key: 'deadline', label: 'Deadline (YYYY-MM-DD)', type: 'teks' },
            { key: 'dampak', label: 'Dampak jika tidak dibayar', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'proyeksi_besok',
      judul: 'Proyeksi Cashflow Besok',
      fields: [
        { key: 'perkiraan_masuk_besok', label: 'Perkiraan uang masuk', type: 'uang' },
        { key: 'perkiraan_keluar_besok', label: 'Perkiraan uang keluar', type: 'uang' },
        { key: 'perkiraan_saldo_akhir_besok', label: 'Perkiraan saldo akhir', type: 'uang' },
        { key: 'tagihan_dikejar_besok', label: 'Tagihan yang harus dikejar besok', type: 'teks_panjang' },
        { key: 'pembayaran_besok', label: 'Pembayaran yang harus dilakukan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'executive_summary',
      judul: 'Executive Summary untuk CEO',
      catatan: 'Kedelapan angka ringkasan dihitung otomatis dari blok-blok di atas.',
      fields: [{ key: 'catatan_accounting', label: 'Catatan Accounting', type: 'teks_panjang' }],
    },
  ],
};
