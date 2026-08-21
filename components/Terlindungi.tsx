'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/AuthProvider';

interface TerlindungiProps {
  peran: string | string[];
  children: ReactNode;
}

export function Terlindungi({ peran, children }: TerlindungiProps) {
  const { roles, loading } = useAuth();
  const peranDiizinkan = Array.isArray(peran) ? peran : [peran];

  if (loading) {
    return <div className="p-6">Memuat…</div>;
  }

  const berhak = peranDiizinkan.some((p) => roles.includes(p));

  if (!berhak) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-2xl" style={{ color: 'var(--merah)' }}>
          Tidak punya akses
        </h1>
        <p>Kamu tidak memiliki peran yang dibutuhkan untuk membuka halaman ini.</p>
      </main>
    );
  }

  return <>{children}</>;
}
