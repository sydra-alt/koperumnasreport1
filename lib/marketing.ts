import type { PolicyMap } from './api/policy';

/**
 * Aktivitas marketing Koperumnas (Personal Marketing, PTE, Closing, halaman
 * Kontrol Marketing) -- keputusan CEO 6 Oktober 2026: TIDAK berlaku lagi.
 * Satu saklar di tabel `policy` (`marketing_aktif`, migrasi 0071), bukan
 * hardcode (aturan #4): semua tampilan marketing disembunyikan lewat sini,
 * tabel & datanya TIDAK dihapus. Kalau baris policy-nya tidak ada sama
 * sekali, perilaku lama (aktif) dipertahankan; selama policy belum termuat,
 * disembunyikan supaya tidak berkedip muncul lalu hilang.
 */
export function marketingAktif(policy: PolicyMap | null | undefined): boolean {
  if (!policy) return false;
  return policy.marketing_aktif !== false;
}

export const PESAN_MARKETING_NONAKTIF = 'Laporan dan pemantauan marketing tidak dipakai lagi (keputusan CEO). Data lama tetap tersimpan.';
