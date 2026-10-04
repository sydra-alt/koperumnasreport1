'use client';

import { useEffect } from 'react';
import { catatGalatBrowser } from '../lib/galat/catatBrowser';

/** Error di layout akar -- harus menggambar <html> sendiri (tanpa CSS aplikasi). */
export default function GalatGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    catatGalatBrowser(error);
  }, [error]);
  return (
    <html lang="id">
      <body style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', padding: 24, background: '#fff', color: '#0A2540' }}>
        <h1 style={{ fontSize: 18 }}>Terjadi kesalahan</h1>
        <p style={{ fontSize: 14 }}>Aplikasi gagal dimuat. Kesalahannya sudah dicatat. Coba lagi; kalau tetap gagal, hubungi Admin.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 16px', borderRadius: 8 }}>
          Coba lagi
        </button>
      </body>
    </html>
  );
}
