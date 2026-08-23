import type { Block, Field } from './types';

/**
 * Blok "Rekap ... untuk Sabrina" muncul di HAMPIR SEMUA format laporan divisi
 * (02-FORMAT-LAPORAN-DIVISI-BARU.md) dengan struktur identik: judul beda-beda
 * per divisi, tapi isinya SELALU cuma tiga hal yang benar-benar input baru --
 * sisanya di blok itu (lokasi, angka-angka, dst.) cuma me-restate data dari
 * blok-blok di atas dan TIDAK dijadikan field (lihat forms/f13-pic-lokasi.ts
 * untuk alasan lengkapnya, prinsip yang sama berlaku di sini).
 *
 * Kunci field DISENGAJA SAMA PERSIS di semua form yang memakai ini
 * (`masalah_utama`, `keputusan_ceo`, `keputusan_ceo_judul`, `status_hari_ini`)
 * -- supaya logika "kalau dicentang & judul terisi, buat baris decision"
 * di components/LaporForm.tsx bisa GENERIK, jalan untuk form APA PUN yang
 * pakai blok ini, bukan diperiksa satu-satu per formKey.
 */
export function blokKeputusanCeo(
  nomor: number | string,
  judulRekap: string,
  labelStatus: string,
  fieldTambahan: Field[] = [],
): Block {
  return {
    id: 'keputusan_ceo',
    judul: `${nomor} · ${judulRekap}`,
    fields: [
      { key: 'masalah_utama', label: 'Masalah utama', type: 'teks_panjang' },
      ...fieldTambahan,
      { key: 'keputusan_ceo', label: 'Butuh keputusan CEO', type: 'centang' },
      {
        key: 'keputusan_ceo_judul',
        label: 'Judul keputusan yang dibutuhkan',
        type: 'teks',
        bantuan: 'Isi kalau "Butuh keputusan CEO" dicentang -- keduanya harus terisi supaya masuk antrean keputusan.',
      },
      { key: 'status_hari_ini', label: labelStatus, type: 'status_warna' },
    ],
  };
}
