import type { FormSchema } from './types';

/**
 * Laporan Kebersihan (CEO, 6 September 2026, pengganti laporan satpam yang
 * dibuang). BUKAN form berbasis field seperti form lain -- isinya 5 foto
 * (bar, toilet, meja, kursi, area bebas) yang WAJIB diambil langsung lewat
 * kamera (CameraCapture, tanpa pemilih galeri), bukan diketik. `blocks`
 * sengaja kosong -- `FormRenderer` TIDAK PERNAH dipakai untuk form ini.
 *
 * Entri ini tetap didaftarkan di `formRegistry` supaya ikut infrastruktur
 * generik yang sudah ada TANPA kode tambahan: nav tab dinamis
 * (`tabLaporDinamis`, lib/navLapor.ts), kartu tugas Beranda
 * (`hitungTugasHariIni`, lib/tugasHariIni.ts), dan Papan Kontrol
 * (`papan_untuk_tanggal`) -- semuanya bergantung pada `formRegistry[formKey]`
 * ada, bukan pada `blocks` berisi field sungguhan. `app/lapor/[formKey]/page.tsx`
 * mengalihkan `formKey === 'kebersihan'` ke `<LaporanKebersihan>`, bukan
 * `<LaporForm>` -- lihat komentar di sana.
 */
export const f18Kebersihan: FormSchema = {
  key: 'kebersihan',
  nama: 'Laporan Kebersihan',
  navLabel: 'Kebersihan',
  scope: 'outlet',
  blocks: [],
};
