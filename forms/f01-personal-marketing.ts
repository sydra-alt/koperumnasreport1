import type { Block, FormSchema } from './types';

/** Label default kalau outlet pengisi belum ditautkan ke unit manapun, atau
 * unitnya belum punya aturan PTE (Koperumnas/DTI-Precast/Rukost/Thrifting
 * sekarang -- lihat migrasi 0057_pte_harian.sql). BUKAN tebakan nama unit --
 * cuma placeholder netral supaya form tetap bisa dibuka, keputusan poin
 * sungguhan tetap menunggu label per unit diisi CEO lewat Admin. */
const LABEL_UNDANGAN_DEFAULT = 'Undangan Customer';

/**
 * Blok "PTE Harian" (18 September 2026, MENGGANTIKAN "Enam Kewajiban" lama --
 * lihat lib/api/pte.ts, dinonaktifkan bukan dihapus). Empat komponen:
 * Digital (30 = 3 platform x 10), Undangan (20 = maks 2 orang x 10),
 * Google Review (10, all-or-nothing di 2), Kesaksian (20, all-or-nothing di
 * 2) -- nilai poin & target SEMUA dari policy.pte_poin_* (lib/api/pteHarian.ts),
 * bukan angka di sini. Label "Undangan" beda per unit (Indokopi/Indosteak,
 * disimpan di tabel unit_bisnis, bukan switch kode) -- makanya blok ini
 * FUNGSI, bukan objek statis, dipanggil LaporForm.tsx dengan label yang
 * sudah di-resolve dari outlet penugasan pengisi.
 */
function blokPteHarian(labelUndangan: string): Block {
  return {
    id: 'pte',
    judul: 'PTE Harian',
    catatan:
      'Poin dihitung otomatis dari isian + bukti, sesuai kebijakan yang berlaku sekarang -- tidak pernah diketik manual. Bonus/potongan gaji belum aktif.',
    fields: [
      {
        key: 'digital_tiktok_tautan',
        label: 'TikTok -- Tautan Postingan',
        type: 'teks',
        buktiWajib: true,
        buktiKunci: 'digital_tiktok',
        bantuan: 'Tautan wajib diisi supaya bisa diverifikasi ulang kapan saja. Sertakan tangkapan layar sebagai bukti.',
      },
      {
        key: 'digital_ig_tautan',
        label: 'Instagram/Reels -- Tautan Postingan',
        type: 'teks',
        buktiWajib: true,
        buktiKunci: 'digital_ig',
        bantuan: 'Tautan wajib diisi. Sertakan tangkapan layar sebagai bukti.',
      },
      {
        key: 'digital_threads_tautan',
        label: 'Threads -- Tautan Postingan',
        type: 'teks',
        buktiWajib: true,
        buktiKunci: 'digital_threads',
        bantuan: 'Tautan wajib diisi. Sertakan tangkapan layar sebagai bukti.',
      },
      {
        key: 'undangan_list',
        label: labelUndangan,
        type: 'tabel',
        buktiWajib: true,
        buktiPerBaris: true,
        buktiKunci: 'undangan',
        kolom: [
          { key: 'nama', label: 'Nama', type: 'teks', wajib: true },
          { key: 'kontak', label: 'Nomor Kontak', type: 'teks', wajib: true },
        ],
        bantuan: '1 orang = 10 poin, 2 orang = 20 poin (maksimal 2 dihitung). Bukti follow-up wajib per orang.',
      },
      {
        key: 'review_list',
        label: 'Google Review',
        type: 'tabel',
        buktiWajib: true,
        buktiPerBaris: true,
        buktiKunci: 'review',
        kolom: [
          { key: 'nama', label: 'Nama Reviewer', type: 'teks', wajib: true },
          { key: 'tanggal', label: 'Tanggal Review (YYYY-MM-DD)', type: 'teks', wajib: true },
        ],
        bantuan: '2 review = 10 poin, 1 review = 0 poin (semua atau tidak sama sekali). Tangkapan layar wajib per review.',
      },
      {
        key: 'kesaksian_list',
        label: 'Kesaksian / Testimoni',
        type: 'tabel',
        buktiWajib: true,
        buktiPerBaris: true,
        buktiKunci: 'kesaksian',
        kolom: [
          { key: 'nama', label: 'Nama Customer', type: 'teks', wajib: true },
          { key: 'setuju_publikasi', label: 'Setuju Dipublikasikan', type: 'pilih', pilihan: ['ya', 'tidak'], wajib: true },
        ],
        bantuan: '2 testimoni = 20 poin, 1 testimoni = 0 poin (semua atau tidak sama sekali). Video/foto wajib per testimoni.',
      },
    ],
  };
}

/**
 * Blok ARSIP -- "Enam Kewajiban" lama (dipensiunkan 18 September 2026,
 * digantikan blokPteHarian() di atas). Field-nya PERSIS SAMA seperti
 * sebelum diganti -- TUJUANNYA SATU: supaya laporan lama yang datanya
 * masih memakai field-field ini (live, undang_jumlah, dst.) TETAP terbaca
 * di /riwayat, bukan tampak kosong. `arsip: true` (forms/types.ts)
 * menyembunyikannya dari FormRenderer/validasi form AKTIF (blokBerlakuHariIni,
 * forms/validasi.ts) -- tidak ada yang bisa mengisi ulang field-field ini,
 * tapi LaporanBacaSaja/riwayat SENGAJA tidak memfilter `arsip`, jadi blok
 * ini tetap dirender di sana. id DIBEDAKAN ('pte_arsip', bukan 'pte') dari
 * blok PTE Harian baru supaya tidak tabrakan key React/anchor.
 */
function blokPteArsipEnamKewajiban(): Block {
  return {
    id: 'pte_arsip',
    judul: 'PTE Hari Ini — Enam Kewajiban (arsip, sebelum 18 September 2026)',
    arsip: true,
    catatan: 'Tidak cukup hanya menulis "sudah". Harus ada bukti. Tanpa bukti, jumlahnya dianggap nol.',
    fields: [
      { key: 'live', label: 'Live', type: 'ya_tidak', buktiWajib: true, buktiKunci: 'live' },
      { key: 'live_platform', label: 'Platform Live', type: 'teks', bantuan: 'Isi kalau Live = Ya' },
      {
        key: 'undang_jumlah',
        label: 'Undang Konsumen Baru (orang)',
        type: 'angka',
        buktiWajib: true,
        buktiKunci: 'undang',
        bantuan: 'Bukti: undangan / follow-up. Angka ini juga dipakai untuk progres undangan yang ditampilkan di bagian atas.',
      },
      { key: 'kesaksian_jumlah', label: 'Kesaksian / Testimoni', type: 'angka', buktiWajib: true, buktiKunci: 'kesaksian', bantuan: 'Bukti: video atau foto' },
      { key: 'review_jumlah', label: 'Google Review', type: 'angka', buktiWajib: true, buktiKunci: 'review', bantuan: 'Bukti: link atau screenshot' },
      {
        key: 'konten_jumlah',
        label: 'VT / Konten Medsos',
        type: 'angka',
        buktiWajib: true,
        buktiKunci: 'konten',
        bantuan: 'Minimal sesuai policy.pte_konten_minimal. Bukti: link, minimal 3 konten.',
      },
      { key: 'konten_1', label: 'Konten 1 (judul/tautan)', type: 'teks' },
      { key: 'konten_2', label: 'Konten 2 (judul/tautan)', type: 'teks' },
      { key: 'konten_3', label: 'Konten 3 (judul/tautan)', type: 'teks' },
      { key: 'mentahan_jumlah', label: 'Video Mentahan', type: 'angka', buktiWajib: true, buktiKunci: 'mentahan', bantuan: 'Bukti: file video' },
    ],
  };
}

/**
 * Sesuai docs/REFERENSI-FORMAT-LAPORAN.md §2 (versi benar, 23 Agustus 2026),
 * blok PTE diperbarui 18 September 2026 (lihat blokPteHarian di atas).
 *
 * Blok 1 (Identitas) SENGAJA tidak ada di sini -- spesifikasi bilang "hanya
 * baca dari profile, tidak perlu field". Ditampilkan di LaporForm.tsx dari
 * `useAuth()`, bukan sebagai field schema (schema untuk INPUT, bukan tampilan
 * baca-saja yang butuh data profile yang FormRenderer sendiri tidak punya).
 *
 * Baris "*dihitung*" di Blok 2/3/5/6/8 (closing ___/2, undangan ___/20, status
 * PTE, status warna) juga tidak berupa field -- ditampilkan LaporForm.tsx dari
 * `useProgresBulananSaya()` + `ringkasanPteHarian` (lib/api/pteHarian.ts),
 * supaya benar-benar "dihitung sistem", bukan schema statis yang bisa
 * disalahartikan sebagai field yang diketik user.
 *
 * `undang_jumlah` LAMA (Enam Kewajiban) sudah tidak ada -- diganti
 * `undangan_list` (tabel anak, satu baris per orang) di blokPteHarian().
 */
export function buatF01PersonalMarketing(labelUndangan: string = LABEL_UNDANGAN_DEFAULT): FormSchema {
  return {
  key: 'personal_marketing',
  nama: 'Laporan Personal Marketing',
  scope: 'user',
  blocks: [
    {
      id: 'closing',
      judul: 'Target Closing Pribadi',
      catatan: 'Target closing bulanan mengikuti kebijakan yang berlaku. Progres dan konsekuensinya sudah ditampilkan di atas -- tidak perlu diketik ulang di sini.',
      fields: [
        {
          key: 'closing_list',
          label: 'Konsumen Closing',
          type: 'tabel',
          kolom: [
            { key: 'nama_konsumen', label: 'Nama Konsumen', type: 'teks' },
            { key: 'lokasi', label: 'Lokasi (Tajur/Bekasi/DTI)', type: 'teks' },
            { key: 'status', label: 'Status (booking/akad/batal)', type: 'teks' },
          ],
        },
      ],
    },
    {
      id: 'undangan',
      judul: 'Target Undangan Konsumen Baru',
      catatan: '"Undangan hari ini" diisi di bagian "PTE Harian" -- satu daftar yang sama, tidak diulang di sini. Poin undangan (bagian dari 80 poin harian) dan akumulasi bulanan ditampilkan di atas.',
      fields: [
        { key: 'undang_merespons', label: 'Yang Merespons', type: 'angka' },
        { key: 'undang_mau_presentasi', label: 'Yang Mau Presentasi', type: 'angka' },
        { key: 'undang_jadi_prospek', label: 'Yang Menjadi Prospek', type: 'angka' },
      ],
    },
    blokPteHarian(labelUndangan),
    blokPteArsipEnamKewajiban(),
    {
      id: 'funnel',
      judul: 'Funnel Marketing Pribadi',
      catatan: 'Poin PTE (Digital/Undangan/Review/Kesaksian) dan closing bulan ini (dihitung sistem) ditampilkan di atas.',
      fields: [
        { key: 'funnel_prospek_aktif', label: 'Prospek Aktif', type: 'angka' },
        { key: 'funnel_presentasi', label: 'Presentasi', type: 'angka' },
        { key: 'funnel_survey', label: 'Survey Lokasi', type: 'angka' },
        { key: 'funnel_booking', label: 'Booking', type: 'angka' },
      ],
    },
    {
      id: 'besok',
      judul: 'Target Besok',
      fields: [
        { key: 'besok_undangan', label: 'Undangan Baru (orang)', type: 'angka' },
        { key: 'besok_followup', label: 'Follow-up (orang)', type: 'angka' },
        { key: 'besok_live', label: 'Live', type: 'teks' },
        { key: 'besok_konten', label: '3 Konten', type: 'teks' },
        { key: 'besok_prospek', label: 'Prospek yang Dikejar', type: 'teks' },
        { key: 'besok_closing', label: 'Target Closing', type: 'teks' },
      ],
    },
    {
      id: 'pernyataan',
      judul: 'Pernyataan Karyawan',
      fields: [
        {
          key: 'pernyataan',
          label: 'Saya memastikan laporan di atas sesuai aktivitas yang benar-benar saya kerjakan dan bukti telah saya lampirkan.',
          type: 'ya_tidak',
          wajibYa: true,
        },
      ],
    },
    ],
  };
}

/** Untuk formRegistry (forms/index.ts) -- butuh objek FormSchema statis di
 * situ, label undangan di-resolve ULANG dengan label yang benar di
 * LaporForm.tsx (lihat useLabelUndanganOutlet, lib/api/pteHarian.ts)
 * sebelum dirender ke pengguna. Registry-nya sendiri cuma dipakai untuk
 * lookup formKey -> nama/scope, bukan buat menampilkan field ke pengguna. */
export const f01PersonalMarketing: FormSchema = buatF01PersonalMarketing();
