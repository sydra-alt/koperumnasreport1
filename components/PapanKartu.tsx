'use client';

import type { PapanRow } from '../lib/api/papan';
import { jamWIB } from '../lib/tanggal';

const WARNA_LATAR: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'var(--hijau)',
  kuning: 'var(--kuning)',
  merah: 'var(--merah)',
};
const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };

interface PapanKartuProps {
  baris: PapanRow;
  formNama: string;
  bolehTagih: boolean;
  onTagih: () => void;
  menagih: boolean;
}

export function PapanKartu({ baris, formNama, bolehTagih, onTagih, menagih }: PapanKartuProps) {
  const belumLapor = !baris.reportId;

  if (belumLapor) {
    return (
      <div
        className="flex flex-col gap-2 border-2 border-dashed p-3"
        style={{ borderColor: 'var(--kosong)', minHeight: 44 }}
      >
        <p style={{ fontFamily: 'var(--display)', color: 'var(--kosong)' }}>{formNama}</p>
        <p className="text-sm">
          {baris.scopeNama} · PIC: {baris.picNama}
        </p>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          belum lapor
        </p>
        {baris.nudgedAt && (
          <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--biru-3)' }}>
            Sudah ditagih {jamWIB(new Date(baris.nudgedAt))}
          </p>
        )}
        {bolehTagih && (
          <button
            type="button"
            onClick={onTagih}
            disabled={menagih}
            className="border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, alignSelf: 'flex-start' }}
          >
            {menagih ? 'Menagih…' : 'Tagih'}
          </button>
        )}
      </div>
    );
  }

  const warna = baris.warna ?? 'hijau';
  return (
    <div className="flex flex-col gap-2 border-2 p-3" style={{ borderColor: WARNA_LATAR[warna] }}>
      <p style={{ fontFamily: 'var(--display)' }}>
        {IKON[warna]} {formNama}
      </p>
      <p className="text-sm">
        {baris.scopeNama} · PIC: {baris.picNama}
      </p>
      <p className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
        {baris.submittedAt ? jamWIB(new Date(baris.submittedAt)) : '—'}
        {baris.status === 'terlambat' ? ' · TERLAMBAT' : ''}
      </p>
    </div>
  );
}
