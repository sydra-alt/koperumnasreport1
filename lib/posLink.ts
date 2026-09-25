/**
 * Tautan dari dashboard laporan ke dashboard pos-fnb (sistem kasir).
 *
 * SUPERSEDED (25 September 2026) -- keputusan 19 September 2026 di bawah
 * ini ("sesi tidak menyambung, buka tab baru, login sendiri") DIGANTI oleh
 * handoff satu pintu masuk: tombol sekarang lewat `/api/pos-handoff`
 * (lib/posHandoff.ts + route-nya), bukan tautan langsung ke pos-fnb.
 * Sesi TETAP tidak disalin/dua sistem TETAP terpisah total -- yang berubah
 * cuma orang tidak perlu login KEDUA KALINYA kalau sudah dipetakan di
 * pos-fnb (lihat report_identity_links, tabel di pos-fnb). Kalau belum
 * dipetakan, pos-fnb sendiri yang menampilkan "akun toko belum disiapkan".
 *
 * Bukan rahasia -- URL server-only (POS_INTEGRASI_URL, dibaca di
 * app/api/pos-handoff/route.ts, BUKAN di sini) karena token ditandatangani
 * server, tapi URL dasarnya sendiri bukan rahasia.
 */

/**
 * Kandidat 6 September 2026 §1 (investigasi handoff): gelombang pertama
 * cuma Ita (dan Putri untuk uji, dia sudah punya akun di kedua sistem).
 * Shabita menyusul SETELAH dia dipetakan di report_identity_links pos-fnb
 * -- tambahkan emailnya di sini BARENGAN dengan pemetaan itu dibuat,
 * jangan salah satu duluan (tombol tampil tapi mentok "belum disiapkan"
 * itu pengalaman buruk, sama seperti alasan CEO 19 September 2026 dulu).
 *
 * SENGAJA daftar eksplisit per-ORANG (bukan per-role) -- populasinya kecil
 * (lihat docs/BLUEPRINT.md investigasi 25 September 2026) dan sebagian
 * besar (Fikri/Toni) BUKAN manajer sungguhan walau kelihatannya berurusan
 * dengan outlet, jadi role saja tidak cukup presisi.
 */
const EMAIL_HANDOFF_DIIZINKAN: readonly string[] = [
  'putri@koperumnas.local',
  'ita@koperumnas.local',
];

export function bolehLihatTautanPos(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_HANDOFF_DIIZINKAN.includes(email.toLowerCase());
}
