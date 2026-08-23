import { blokKeputusanCeo } from './blok-bersama';
import type { FormSchema } from './types';

/**
 * Sesuai docs/02-FORMAT-LAPORAN-DIVISI-BARU.md, bagian "LAPORAN HARIAN HRD"
 * (baris 11-163). scope 'global' -- satu laporan per hari, satu PIC HRD
 * (Sabrina, lihat assignment seed), bukan per lokasi/outlet.
 *
 * Blok 6 "KONTROL KEPATUHAN MARKETING SELURUH KARYAWAN" dan blok 7 "LAPORAN
 * PERSONAL MARKETING HRD" TERLIHAT mirip rekap sistem, tapi BUKAN --
 * dokumen ini (beda dari REFERENSI-FORMAT-LAPORAN.md yang dipakai f01) tidak
 * menandai keduanya "(dihitung)", dan secara substansi HRD memang bertugas
 * MENGHITUNG SENDIRI kepatuhan seluruh karyawan sebagai kontrol manual --
 * itu poin dari blok ini. Jadi keduanya field angka biasa yang diketik HRD,
 * bukan agregasi otomatis. Agregasi company-wide sungguhan (kalau nanti
 * dibutuhkan) itu wilayah Task 20, bukan task ini.
 *
 * Data cuti/sakit/izin di blok 1 BELUM disambungkan ke pengecualian
 * `hari_bolong` di `v_marketing_bulanan` -- tabelnya cuma teks nama bebas,
 * tidak berelasi ke user_id, jadi tidak bisa dipakai otomatis. Tetap utang
 * WAJIB sebelum go-live yang sama seperti dicatat di PROGRESS.md sebelumnya.
 */
export const f14Hrd: FormSchema = {
  key: 'hrd',
  nama: 'Laporan Harian HRD',
  navLabel: 'Lapor HRD',
  scope: 'global',
  blocks: [
    {
      id: 'absensi',
      judul: '1 · Absensi Hari Ini',
      fields: [
        { key: 'pegawai_total', label: 'Total pegawai', type: 'angka' },
        { key: 'pegawai_hadir', label: 'Hadir', type: 'angka' },
        { key: 'pegawai_sakit', label: 'Sakit', type: 'angka' },
        { key: 'pegawai_izin', label: 'Izin', type: 'angka' },
        { key: 'pegawai_cuti', label: 'Cuti', type: 'angka' },
        { key: 'pegawai_terlambat', label: 'Terlambat', type: 'angka' },
        { key: 'pegawai_tanpa_keterangan', label: 'Tidak hadir tanpa keterangan', type: 'angka' },
        { key: 'tingkat_kehadiran', label: 'Tingkat kehadiran (%)', type: 'angka' },
        {
          key: 'daftar_tidak_hadir',
          label: 'Daftar tidak hadir / terlambat',
          type: 'tabel',
          kolom: [
            { key: 'nama', label: 'Nama', type: 'teks' },
            { key: 'divisi_lokasi', label: 'Divisi/Lokasi', type: 'teks' },
            { key: 'status', label: 'Status', type: 'teks' },
            { key: 'keterangan', label: 'Keterangan', type: 'teks' },
            { key: 'ada_surat', label: 'Ada surat/izin (ya/tidak)', type: 'teks' },
          ],
        },
        { key: 'tanpa_keterangan_detail', label: 'Tidak hadir tanpa keterangan (detail)', type: 'teks_panjang' },
        { key: 'tindakan_hrd_absensi', label: 'Tindakan HRD', type: 'teks_panjang' },
      ],
    },
    {
      id: 'kedisiplinan',
      judul: '2 · Kedisiplinan',
      fields: [
        { key: 'terlambat_hari_ini', label: 'Terlambat hari ini (orang)', type: 'angka' },
        { key: 'terlambat_lebih_3x', label: 'Terlambat >3x bulan ini (orang)', type: 'angka' },
        { key: 'nama_terlambat_berulang', label: 'Nama yang terlambat berulang', type: 'teks_panjang' },
        { key: 'pulang_awal_tanpa_izin', label: 'Pulang lebih awal tanpa izin', type: 'angka' },
        { key: 'tidak_pakai_seragam', label: 'Tidak pakai seragam', type: 'angka' },
        { key: 'tinggalkan_lokasi_tanpa_izin', label: 'Meninggalkan lokasi tanpa izin', type: 'angka' },
        { key: 'tindakan_kedisiplinan', label: 'Tindakan/teguran yang diberikan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'penempatan',
      judul: '3 · Karyawan & Penempatan',
      fields: [
        { key: 'karyawan_aktif', label: 'Karyawan aktif', type: 'angka' },
        { key: 'karyawan_baru_masuk', label: 'Karyawan baru masuk hari ini', type: 'angka' },
        { key: 'karyawan_keluar', label: 'Karyawan keluar/resign', type: 'angka' },
        { key: 'masa_percobaan', label: 'Dalam masa percobaan', type: 'angka' },
        { key: 'mutasi_rotasi', label: 'Mutasi/rotasi hari ini', type: 'angka' },
        { key: 'nama_keterangan_penempatan', label: 'Nama & keterangan', type: 'teks_panjang' },
        { key: 'posisi_kosong', label: 'Posisi yang masih kosong/dibutuhkan', type: 'teks_panjang' },
      ],
    },
    {
      id: 'administrasi',
      judul: '4 · Administrasi Kepegawaian',
      fields: [
        { key: 'kontrak_habis_30_hari', label: 'Kontrak akan habis 30 hari ke depan (orang)', type: 'angka' },
        { key: 'berkas_belum_lengkap', label: 'Berkas karyawan belum lengkap (orang)', type: 'angka' },
        { key: 'data_update_sistem', label: 'Data karyawan sudah update di sistem', type: 'ya_tidak' },
        { key: 'nama_berkas_kurang', label: 'Nama & berkas yang kurang', type: 'teks_panjang' },
      ],
    },
    {
      id: 'masalah_kepegawaian',
      judul: '5 · Masalah Kepegawaian',
      fields: [
        { key: 'konflik_karyawan', label: 'Konflik antar karyawan', type: 'teks' },
        { key: 'keluhan_karyawan', label: 'Keluhan karyawan', type: 'teks' },
        { key: 'pelanggaran_indisipliner', label: 'Pelanggaran/indisipliner', type: 'teks' },
        { key: 'surat_peringatan', label: 'Surat peringatan diterbitkan (SP1/SP2/SP3)', type: 'teks' },
        { key: 'detail_masalah_kepegawaian', label: 'Detail', type: 'teks_panjang' },
        { key: 'pic_penyelesaian', label: 'PIC penyelesaian', type: 'teks' },
        { key: 'target_selesai_masalah', label: 'Target selesai', type: 'teks' },
      ],
    },
    {
      id: 'kontrol_marketing',
      judul: '6 · Kontrol Kepatuhan Marketing Seluruh Karyawan',
      catatan: 'HRD memastikan seluruh karyawan mengirim Laporan Personal Marketing -- angka di blok ini diperiksa & diketik HRD, bukan dihitung otomatis.',
      fields: [
        { key: 'total_wajib_lapor', label: 'Total karyawan wajib lapor', type: 'angka' },
        { key: 'sudah_kirim_personal', label: 'Sudah mengirim laporan personal', type: 'angka' },
        { key: 'belum_kirim_personal', label: 'Belum mengirim', type: 'angka' },
        { key: 'nama_belum_kirim', label: 'Karyawan belum mengirim laporan personal', type: 'teks_panjang' },
        { key: 'pte_tidak_lengkap', label: 'Karyawan dengan PTE tidak lengkap', type: 'angka' },
        { key: 'tertinggal_target_undangan', label: 'Karyawan tertinggal target undangan (orang)', type: 'angka' },
        { key: 'tertinggal_target_closing', label: 'Karyawan tertinggal target closing (orang)', type: 'angka' },
        { key: 'tindakan_kontrol_marketing', label: 'Tindakan HRD (koordinasi Pak Fauzi & Pak Dea)', type: 'teks_panjang' },
      ],
    },
    {
      id: 'besok',
      judul: '8 · Target HRD Besok',
      fields: [
        { key: 'besok_absensi', label: 'Absensi/kedisiplinan', type: 'teks' },
        { key: 'besok_rekrutmen', label: 'Rekrutmen', type: 'teks' },
        { key: 'besok_administrasi', label: 'Administrasi', type: 'teks' },
        { key: 'besok_masalah', label: 'Masalah yang harus diselesaikan', type: 'teks' },
      ],
    },
    blokKeputusanCeo(9, 'Rekap HRD untuk Sabrina', 'Status HRD hari ini'),
  ],
};
