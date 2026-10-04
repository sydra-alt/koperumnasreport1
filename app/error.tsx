'use client';

import { useEffect } from 'react';
import { catatGalatBrowser } from '../lib/galat/catatBrowser';

export default function GalatHalaman({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    catatGalatBrowser(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 p-6">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--biru)' }}>Terjadi kesalahan</h1>
      <p className="text-sm">Halaman ini gagal dimuat. Kesalahannya sudah dicatat. Coba lagi; kalau tetap gagal, hubungi Admin.</p>
      <button
        type="button"
        onClick={reset}
        className="border px-4"
        style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, borderRadius: 8 }}
      >
        Coba lagi
      </button>
    </main>
  );
}
