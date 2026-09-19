/**
 * Tautan dari dashboard laporan ke dashboard pos-fnb (sistem kasir).
 *
 * KEPUTUSAN (19 September 2026, docs/PROGRESS.md): penjualan kasir TIDAK
 * diintegrasikan ke database laporan -- cuma tautan keluar. pos-fnb adalah
 * sistem TERPISAH (proyek Supabase, hosting, dan akun login sendiri); sesi di
 * repo ini tidak menyambung ke sana. Jangan menyiratkan sebaliknya di UI.
 *
 * Bukan rahasia -- URL publik, jadi aman di klien. Bisa ditimpa lewat
 * NEXT_PUBLIC_POS_DASHBOARD_URL (mis. kalau pindah ke domain sendiri) tanpa
 * mengubah kode.
 */
const URL_DASAR_POS = (process.env.NEXT_PUBLIC_POS_DASHBOARD_URL ?? 'https://pos-fnb.badarbaradja112.workers.dev').replace(/\/+$/, '');

/**
 * Halaman drill-down yang paling berguna di pos-fnb: Laporan Penjualan --
 * filter outlet + tanggal, ringkasan, dan riwayat transaksi. (Beranda pos-fnb
 * cuma ringkasan hari ini.) pos-fnb belum menyimpan tujuan setelah login, jadi
 * kalau belum masuk di sana, pengguna mendarat di beranda POS setelah login.
 */
export const URL_LAPORAN_PENJUALAN_POS = `${URL_DASAR_POS}/reports/sales`;

/** Hanya CEO dan accounting -- BUKAN pusat, walau pusat melihat dashboard yang sama. */
export function bolehLihatTautanPos(roles: readonly string[]): boolean {
  return roles.includes('ceo') || roles.includes('accounting');
}
