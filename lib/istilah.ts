/**
 * Penjelasan satu baris istilah sulit sistem laporan (5 Oktober 2026, audit
 * UI R06 + "terms needing help text"). Angka target SELALU dari `policy`
 * (aturan #4), dioper pemanggil -- tidak pernah ditulis di sini.
 */
export const teksPte = (poinMaksimal: number | null) =>
  `PTE = poin aktivitas pemasaran harian Anda${poinMaksimal ? ` (maksimal ${poinMaksimal} poin per hari)` : ''}, dihitung otomatis dari laporan Personal Marketing.`;

export const teksClosing = (target: number | null) =>
  `Closing = konsumen yang sudah jadi membeli rumah (akad/booking) bulan ini${target ? `; target ${target} per bulan` : ''}.`;

export const TEKS_PENUGASAN = 'Penugasan = laporan apa yang wajib Anda isi, untuk lokasi/outlet dan shift mana; diatur oleh admin.';
export const TEKS_TINJAU = 'Tinjau = periksa kiriman tim lalu setujui atau beri catatan.';
