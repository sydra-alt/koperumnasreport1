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
      className="neumo-kartu print-seksi transition-shadow"
      style={{ scrollMarginTop: 80, overflow: 'hidden' }}
    >
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-3 p-4 select-none hover:opacity-90" style={{ minHeight: 48 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 600, color: 'var(--biru)' }}>
          {judul}
          {ada === false && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--label)' }}>· belum ada laporan</span>}
        </span>
        {keterangan && (
          <span className="text-xs font-medium" style={{ color: 'var(--label)' }}>
            {keterangan}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 px-5 pb-5 text-sm" style={{ borderTop: '1px solid rgba(166, 180, 200, 0.16)', paddingTop: 16 }}>{children}</div>
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
    <nav aria-label="Ringkasan bagian" className="neumo-kartu flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--tinta)' }}>
          Ringkasan Divisi
        </p>
        <span className="text-xs font-bold" style={{ color: adaData === terhitung.length ? 'var(--hijau)' : 'var(--biru)' }}>
          {adaData} dari {terhitung.length} masuk
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {butir.map((b) => (
          <li key={b.id}>
            <a
              href={`#${b.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all"
              style={{
                minHeight: 38,
                borderRadius: 'var(--radius-pil)',
                background: 'var(--permukaan)',
                boxShadow: 'var(--bayangan-neumo-sm)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                color: b.ada === false ? 'var(--merah)' : b.ada ? 'var(--hijau)' : 'var(--tinta)',
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: b.ada === false ? 'var(--merah)' : b.ada ? 'var(--hijau)' : 'var(--label)' }} />
              {b.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
