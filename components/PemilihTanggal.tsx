'use client';

import { tanggalWIB, tanggalIndonesiaDariYmd } from '../lib/tanggal';

function tambahHari(tanggal: string, jumlah: number): string {
  const [t, b, h] = tanggal.split('-').map(Number);
  const d = new Date(Date.UTC(t, b - 1, h + jumlah));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface PemilihTanggalProps {
  tanggal: string;
  onUbah: (tanggal: string) => void;
}

/** Pemilih tanggal generik -- default hari ini, bisa mundur (tidak bisa maju melewati hari ini). Dipakai Papan Kontrol dan Laporan Terpusat. */
export function PemilihTanggal({ tanggal, onUbah }: PemilihTanggalProps) {
  const hariIni = tanggalWIB();
  const bukanHariIni = tanggal !== hariIni;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onUbah(tambahHari(tanggal, -1))}
        className="border px-3"
        style={{ borderColor: 'var(--garis)', minHeight: 44 }}
        aria-label="Tanggal sebelumnya"
      >
        ←
      </button>
      <input
        type="date"
        value={tanggal}
        max={hariIni}
        onChange={(e) => e.target.value && onUbah(e.target.value)}
        className="border px-2"
        style={{ borderColor: 'var(--garis)', minHeight: 44, fontFamily: 'var(--mono)' }}
      />
      <button
        type="button"
        onClick={() => onUbah(tambahHari(tanggal, 1))}
        disabled={tanggal >= hariIni}
        className="border px-3"
        style={{ borderColor: 'var(--garis)', minHeight: 44, opacity: tanggal >= hariIni ? 0.4 : 1 }}
        aria-label="Tanggal berikutnya"
      >
        →
      </button>
      {bukanHariIni && (
        <button
          type="button"
          onClick={() => onUbah(hariIni)}
          className="border px-3 text-sm"
          style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
        >
          Hari ini
        </button>
      )}
      <span className="text-sm" style={{ color: 'var(--biru-3)' }}>
        {tanggalIndonesiaDariYmd(tanggal)}
      </span>
    </div>
  );
}
