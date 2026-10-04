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
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => onUbah(tambahHari(tanggal, -1))}
        className="tombol-lingkar !w-10 !h-10 text-sm font-bold"
        aria-label="Tanggal sebelumnya"
      >
        ←
      </button>
      <input
        type="date"
        value={tanggal}
        max={hariIni}
        onChange={(e) => e.target.value && onUbah(e.target.value)}
        className="px-3 py-2 text-sm font-semibold"
        style={{ minHeight: 40, fontFamily: 'var(--mono)' }}
      />
      <button
        type="button"
        onClick={() => onUbah(tambahHari(tanggal, 1))}
        disabled={tanggal >= hariIni}
        className="tombol-lingkar !w-10 !h-10 text-sm font-bold disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Tanggal berikutnya"
      >
        →
      </button>
      {bukanHariIni && (
        <button
          type="button"
          onClick={() => onUbah(hariIni)}
          className="tombol-sekunder !py-1 !px-3.5 text-xs font-bold"
          style={{ minHeight: 40 }}
        >
          Hari ini
        </button>
      )}
      <span className="text-xs font-semibold px-2" style={{ color: 'var(--biru)' }}>
        {tanggalIndonesiaDariYmd(tanggal)}
      </span>
    </div>
  );
}
