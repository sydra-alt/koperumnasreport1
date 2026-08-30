import type { MetadataRoute } from 'next';

/**
 * Web App Manifest bawaan Next.js (route `/manifest.webmanifest`, ditautkan
 * otomatis ke `<head>` -- tidak perlu `<link rel="manifest">` manual). Ini
 * yang membuat "Tambahkan ke Layar Utama" berperilaku seperti aplikasi
 * (`display: standalone`, ikon sendiri), §2 06-RENCANA-PRESENSI-MOBILE.md.
 *
 * Diperbarui 30 Agustus 2026 -- logo perusahaan asli sudah ada
 * (`public/logo-koperumnas.jpg`). Ikonnya sekarang berkas PNG statis
 * turunan logo (`public/icon-192.png`/`icon-512.png`, dibuat sekali lewat
 * `scripts/_buat-ikon-pwa.mjs`, sudah dihapus setelah dipakai), BUKAN lagi
 * digambar dari kode lewat `next/og` -- placeholder "KG" (`lib/ikonAplikasi.tsx`,
 * dihapus) itu memang sengaja sementara, sekarang sudah tidak dipakai.
 * Latar ikon PUTIH SOLID (bukan transparan) -- logo biru tua di atas putih,
 * transparan akan jadi biru-di-atas-hitam di HP bertema gelap.
 * `theme_color`/`background_color` diambil dari warna asli logo (§2.1
 * `docs/DESIGN.md`, disampel langsung dari berkas, bukan perkiraan).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Laporan Koperumnas',
    short_name: 'Koperumnas',
    description: 'Sistem laporan harian Koperumnas Group',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0047AF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
