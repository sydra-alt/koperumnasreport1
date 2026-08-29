import type { FormSchema } from './types';

/**
 * Sesuai docs/REFERENSI-FORMAT-LAPORAN.md §2 (versi benar, 23 Agustus 2026).
 *
 * Blok 1 (Identitas) SENGAJA tidak ada di sini -- spesifikasi bilang "hanya
 * baca dari profile, tidak perlu field". Ditampilkan di LaporForm.tsx dari
 * `useAuth()`, bukan sebagai field schema (schema untuk INPUT, bukan tampilan
 * baca-saja yang butuh data profile yang FormRenderer sendiri tidak punya).
 *
 * Baris "*dihitung*" di Blok 2/3/5/6/8 (closing ___/2, undangan ___/20, status
 * PTE, status warna) juga tidak berupa field -- ditampilkan LaporForm.tsx dari
 * `useProgresBulananSaya()` + `hitungKelayakanBonus`/`hitungPotongan`/
 * `ringkasanPteHariIni`, supaya benar-benar "dihitung sistem", bukan schema
 * statis yang bisa disalahartikan sebagai field yang diketik user.
 *
 * `undang_jumlah` cuma didefinisikan SEKALI, di Blok 4 (tempat buktiWajib-nya
 * ada) -- Blok 3 cuma catatan yang merujuk ke situ, sesuai instruksi "jangan
 * dibuat dua field".
 */
export const f01PersonalMarketing: FormSchema = {
  key: 'personal_marketing',
  nama: 'Laporan Personal Marketing',
  scope: 'user',
  blocks: [
    {
      id: 'closing',
      judul: 'Target Closing Pribadi',
      catatan: 'Target minimal policy.closing_target closing/bulan. Progres "___/2" ditampilkan di atas, dihitung sistem.',
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
      catatan: 'Target minimal sesuai kebijakan undangan bulanan perusahaan. "Undangan hari ini" diisi di bagian "PTE Hari Ini — Enam Kewajiban" -- satu field yang sama, tidak diulang di sini. Progres "___/20" ditampilkan di atas.',
      fields: [
        { key: 'undang_merespons', label: 'Yang Merespons', type: 'angka' },
        { key: 'undang_mau_presentasi', label: 'Yang Mau Presentasi', type: 'angka' },
        { key: 'undang_jadi_prospek', label: 'Yang Menjadi Prospek', type: 'angka' },
      ],
    },
    {
      id: 'pte',
      judul: 'PTE Hari Ini — Enam Kewajiban',
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
    },
    {
      id: 'funnel',
      judul: 'Funnel Marketing Pribadi',
      catatan: 'Undangan & closing bulan ini (dihitung sistem) ditampilkan di atas.',
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
