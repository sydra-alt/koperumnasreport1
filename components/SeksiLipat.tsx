'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

const KUERI_LEBAR = '(min-width: 640px)';
function langgananLebar(ubah: () => void) {
  const mq = window.matchMedia(KUERI_LEBAR);
  mq.addEventListener('change', ubah);
  return () => mq.removeEventListener('change', ubah);
}

/**
 * Pola halaman panjang di HP (6 Oktober 2026, audit UI R07): tiap bagian bisa
 * dilipat -- tertutup di HP (< 640px), terbuka di layar lebar, semua dibuka
 * sebelum dicetak -- plus ringkasan di atas yang menunjuk ke tiap bagian.
 */
export function SeksiLipat({
  id,
  judul,
  keterangan,
  ada,
  children,
}: {
  id: string;
  judul: ReactNode;
  keterangan?: ReactNode;
  /** true = ada laporannya, false = belum ada, undefined = rekap (netral). */
  ada?: boolean;
  children: ReactNode;
}) {
  const layarLebar = useSyncExternalStore(langgananLebar, () => window.matchMedia(KUERI_LEBAR).matches, () => false);
  const [pilihan, setPilihan] = useState<boolean | null>(null);
  const buka = pilihan ?? layarLebar;
  useEffect(() => {
    const cetak = () => setPilihan(true);
    window.addEventListener('beforeprint', cetak);
    return () => window.removeEventListener('beforeprint', cetak);
  }, []);
  return (
    <details
      id={id}
      open={buka}
      onToggle={(e) => {
        const terbuka = (e.currentTarget as HTMLDetailsElement).open;
        if (terbuka !== buka) setPilihan(terbuka);
      }}
      className="border print-seksi"
      style={{ borderColor: 'var(--garis)', scrollMarginTop: 72 }}
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-4" style={{ minHeight: 44 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          {judul}
          {ada === false && <span className="ml-2 text-sm" style={{ color: 'var(--kosong)', fontWeight: 400 }}>· belum ada laporan</span>}
        </span>
        {keterangan && (
          <span className="text-sm" style={{ color: 'var(--biru-3)' }}>
            {keterangan}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4 text-sm">{children}</div>
    </details>
  );
}

export interface ButirRingkasan {
  id: string;
  label: string;
  ada?: boolean;
}

export function RingkasanSeksi({ butir }: { butir: ButirRingkasan[] }) {
  const terhitung = butir.filter((b) => b.ada !== undefined);
  const adaData = terhitung.filter((b) => b.ada).length;
  return (
    <nav aria-label="Ringkasan bagian" className="panel flex flex-col gap-2 p-4">
      <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>
        Ringkasan: {adaData} dari {terhitung.length} laporan divisi sudah masuk
      </p>
      <ul className="flex flex-wrap gap-2">
        {butir.map((b) => (
          <li key={b.id}>
            <a
              href={`#${b.id}`}
              className="inline-flex items-center gap-1 border px-3 text-sm"
              style={{
                minHeight: 44,
                borderRadius: 'var(--radius-pil)',
                borderColor: b.ada === false ? 'var(--merah)' : 'var(--garis)',
                color: b.ada === false ? 'var(--merah)' : 'var(--tinta)',
              }}
            >
              {b.ada === false ? '○' : b.ada ? '●' : '·'} {b.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
