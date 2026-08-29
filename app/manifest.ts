import type { MetadataRoute } from 'next';

/**
 * Web App Manifest bawaan Next.js (route `/manifest.webmanifest`, ditautkan
 * otomatis ke `<head>` -- tidak perlu `<link rel="manifest">` manual). Ini
 * yang membuat "Tambahkan ke Layar Utama" berperilaku seperti aplikasi
 * (`display: standalone`, ikon sendiri), §2 06-RENCANA-PRESENSI-MOBILE.md.
 * Ikonnya dari `app/icon-192/route.tsx` dan `app/icon-512/route.tsx`
 * (dibuat dari kode lewat `next/og`, bukan berkas gambar yang ditaruh
 * manual -- proyek ini belum punya aset logo resmi dari klien).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pusat Kontrol Koperumnas Group',
    short_name: 'Koperumnas',
    description: 'Sistem laporan harian Koperumnas Group',
    start_url: '/',
    display: 'standalone',
    background_color: '#E6E9E3',
    theme_color: '#123A56',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
