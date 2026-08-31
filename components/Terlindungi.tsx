'use client';

import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/AuthProvider';
import { KerangkaTeks } from './Kerangka';

interface TerlindungiProps {
  peran: string | string[];
  /**
   * Kondisi TAMBAHAN di luar daftar `peran` biasa -- dipakai untuk kasus
   * yang tidak bisa dinyatakan sebagai nama peran tunggal, mis. "kadiv DAN
   * divisi='HRD'" (halaman Tinjau Absensi, presensi). `true` berarti boleh
   * masuk meski tidak ada `peran` yang cocok.
   */
  boleh?: boolean;
  children: ReactNode;
}

export function Terlindungi({ peran, boleh, children }: TerlindungiProps) {
  const { roles, loading } = useAuth();
  const peranDiizinkan = Array.isArray(peran) ? peran : [peran];

  if (loading) {
    return <div className="p-6"><KerangkaTeks /></div>;
  }

  const berhak = peranDiizinkan.some((p) => roles.includes(p)) || boleh === true;

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
