import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Dipecah dari form `ita` (30 Agustus 2026, instruksi eksplisit user) --
 * lihat catatan lengkap di `forms/f16-thrifting.ts`. Ini bagian KONTROL
 * F&B PER OUTLET (bagian 5-9 dokumen asli): cek pembukuan, verifikasi
 * dengan Accounting, kontrol stok restoran, kebutuhan stok/RAB.
 *
 * `scope: 'outlet'` (BUKAN lagi 'global') -- SATU laporan per outlet per
 * hari, pola sama `manager_resto`. Ini yang menyelesaikan celah
 * `'omzet_' || outlet.slug` yang ditemukan di Perubahan 1 (migrasi
 * 0031_indosteak_dua_outlet.sql): field pembukuan sebelumnya harus
 * dijahit ke nama outlet (`omzet_indosteak_cempaka` dkk, 3 blok
 * terpisah) karena SATU laporan `ita` global harus menampung ketiga
 * outlet sekaligus. Sekarang laporan ini SENDIRI sudah terikat ke SATU
 * outlet lewat scope, jadi kunci field kembali sederhana (`omzet_sistem`,
 * bukan `omzet_<slug>`) -- KONTRAK dengan `selisih_resto_untuk_tanggal()`
 * (migrasi 0036) berubah dari "cari field bernama sesuai outlet" jadi
 * "join langsung by outlet_id", sama seperti `manager_resto`.
 *
 * `review_google` (dulu `review_google_indokopi_jatinegara`, cuma ada di
 * blok Indokopi) SEKARANG generik utk ketiga outlet -- keputusan eksplisit
 * user: dulu cuma Indokopi karena cuma itu yang punya halaman Google,
 * bukan karena sengaja dibatasi; sekarang ketiga outlet punya halaman
 * Google. Isian nol untuk outlet yang belum aktif reviewnya TIDAK merusak
 * apa pun (beda dari field yang hilang).
 *
 * Blok "Stock Opname Mingguan" (khusus Senin, `hanyaHari: [1]` -- mekanisme
 * YANG SUDAH ADA, TIDAK dibuat baru) -- bagian per-outletnya di sini,
 * bagian thrifting di `f16-thrifting.ts`. Enam field penutup (daftar
 * barang selisih dkk) KUNCI SAMA dengan yang di thrifting tapi LABEL beda
 * menyebut "(outlet ini)" -- instruksi eksplisit user, supaya pengisi
 * tidak bingung melihat label sama di dua form.
 *
 * `so_diajukan_eri_rika` diganti `so_diajukan_persetujuan` (instruksi
 * eksplisit user) -- nama field tidak boleh menyebut orang, karena orang
 * bisa berganti tapi kunci field JSON historis tidak boleh ikut berganti.
 * Labelnya TETAP boleh menyebut nama kalau memang begitu alurnya.
 */
export const f16KontrolFnb: FormSchema = {
  key: 'kontrol_fnb',
  nama: 'Laporan Harian Kontrol F&B',
  navLabel: 'Lapor Kontrol F&B',
  scope: 'outlet',
  blocks: [
    {
      id: 'pembukuan',
      judul: 'Cek Pembukuan',
      fields: [
        { key: 'omzet_sistem', label: 'Omzet sistem hari ini', type: 'uang' },
        { key: 'cash', label: 'Cash', type: 'uang' },
        { key: 'qris', label: 'QRIS', type: 'uang' },
        { key: 'bank', label: 'Bank/Transfer', type: 'uang' },
        { key: 'sesuai', label: 'Omzet sistem = uang penjualan', type: 'ya_tidak' },
        {
          key: 'selisih',
          label: 'Selisih',
          type: 'uang',
          wajibJika: { field: 'sesuai', nilai: 'tidak' },
        },
        {
          key: 'penyebab',
          label: 'Penyebab/keterangan',
          type: 'teks_panjang',
          wajibJika: { field: 'sesuai', nilai: 'tidak' },
        },
        { key: 'bukti_diberikan_accounting', label: 'Bukti/data sudah diberikan ke Accounting', type: 'ya_tidak' },
        { key: 'review_google', label: 'Google Review (jumlah baru)', type: 'angka' },
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
        { key: 'stok_sesuai', label: 'Stok sistem = stok aktual (versi Anda)', type: 'ya_tidak' },
        { key: 'stok_habis', label: 'Stok habis', type: 'teks_panjang' },
        { key: 'stok_hampir_habis', label: 'Stok hampir habis', type: 'teks_panjang' },
        { key: 'kebutuhan', label: 'Kebutuhan', type: 'teks_panjang' },
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
      id: 'stock_opname_outlet',
      judul: 'Stock Opname Mingguan -- Outlet Ini (khusus Senin)',
      hanyaHari: [1],
      catatan: 'Bagian ini cuma tampil hari Senin.',
      fields: [
        { key: 'so_stok_sistem', label: 'Nilai/jumlah stok sistem', type: 'teks' },
        { key: 'so_stok_aktual', label: 'Stok aktual', type: 'teks' },
        { key: 'so_selisih', label: 'Selisih', type: 'teks' },
        { key: 'so_status', label: 'Sesuai', type: 'ya_tidak' },
        { key: 'so_daftar_barang_selisih', label: 'Daftar barang selisih (outlet ini)', type: 'teks_panjang' },
        { key: 'so_penyebab_selisih', label: 'Penyebab selisih (outlet ini)', type: 'teks_panjang' },
        { key: 'so_tindakan_perbaikan', label: 'Tindakan/perbaikan (outlet ini)', type: 'teks_panjang' },
        { key: 'so_kebutuhan_minggu_depan', label: 'Kebutuhan stok minggu depan (outlet ini)', type: 'teks_panjang' },
        { key: 'so_rab_kebutuhan', label: 'RAB kebutuhan outlet ini minggu depan', type: 'uang' },
        { key: 'so_diajukan_persetujuan', label: 'Diajukan ke persetujuan (outlet ini)', type: 'ya_tidak' },
      ],
    },
    blokKeputusanCeo('Rekap Kontrol F&B Hari Ini', 'Status hari ini'),
  ],
};
